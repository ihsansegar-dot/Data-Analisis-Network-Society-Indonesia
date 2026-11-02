"""Uji end-to-end tanpa internet: FakeSession menyajikan fixture sebagai respons Scrapling asli.
Jalankan:  python -m pytest -q tests   (atau: python tests/test_offline.py)
"""
import csv
import json
import os
import sys
import tempfile
from types import SimpleNamespace

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from scrapling.engines.toolbelt.custom import Response  # noqa: E402

from run import scrape_source  # noqa: E402
from scraper.classify import CategoryClassifier  # noqa: E402
from scraper.discover import parse_date  # noqa: E402
from scraper.export import Store  # noqa: E402
from scraper.extract import extract  # noqa: E402
from scraper.fetch import PoliteFetcher  # noqa: E402

FX = os.path.join(ROOT, "tests", "fixtures")
B = "https://www.contoh.co.id"
ROUTES = {
    "/robots.txt": "robots.txt", "/sitemap_index.xml": "sitemap_index.xml",
    "/news-sitemap.xml": "news-sitemap.xml", "/": "home.html", "/rss": "rss.xml",
    "/berita/pks-dan-ppp-bahas-koalisi": "art_pks.html", "/berita/mui-terbitkan-fatwa": "art_mui.html",
    "/berita/moderasi-beragama-pesantren": "art_moderasi.html", "/berita/harga-cabai-naik": "art_cabai.html",
    "/terlarang/rahasia-ulama": "art_pks.html",
}


class FakeSession:
    def __init__(self):
        self.calls = []

    def get(self, url, **kw):
        self.calls.append(url)
        path = url.replace(B, "").replace("https://contoh.co.id", "") or "/"
        name = ROUTES.get(path)
        if name is None:
            return Response(url, b"not found", 404, "Not Found", {}, {}, {})
        return Response(url, open(os.path.join(FX, name), "rb").read(), 200, "OK", {}, {}, {})


CLF = CategoryClassifier(os.path.join(ROOT, "config", "categories.yaml"))


def _run(**over):
    sess = FakeSession()
    out = tempfile.mkdtemp()
    store = Store(out, CLF)
    args = SimpleNamespace(delay=0, stealth=False, ignore_robots=False, max_per_source=50,
                           no_prefilter=False, min_words=20, keep_body=True)
    for k, v in over.items():
        setattr(args, k, v)
    factory = lambda d, **kw: PoliteFetcher(d, session=sess, **kw)  # noqa: E731
    src = {"name": "Contoh", "domain": "contoh.co.id", "group": "nasional"}
    st = scrape_source(src, args, CLF, store, parse_date("2026-10-01"), parse_date("2026-10-31T23:59:59+07:00"),
                       fetcher_factory=factory)
    return st, store, sess, out


def test_classifier_basics():
    r = CLF.classify("PKS dan PPP Bahas Koalisi Partai Islam", "aspirasi umat dan politik umat; dukungan ulama")
    assert r.relevant and r.primary == "partai_islam"
    assert "politik_umat" in r.labels
    # batas kata: "pan" tidak cocok di dalam "panen"/"pangan"; "nu" tidak cocok di "menu"
    r2 = CLF.classify("Panen padi", "ketahanan pangan dan menu sehat, panen raya")
    assert not r2.relevant and r2.scores["partai_islam"] == 0
    # "PBB" tidak dipetakan ke partai
    assert CLF.classify("Sidang PBB", "PBB membahas iklim").scores["partai_islam"] == 0


def test_extract_jsonld_and_heuristic():
    a = extract(open(os.path.join(FX, "art_pks.html"), "rb").read(), B + "/x")
    assert a["title"].startswith("PKS dan PPP")
    assert a["author"] == "Rina Wartawan" and a["section"] == "Politik"
    assert a["published"].startswith("2026-10-30")
    assert "dukungan ulama" in a["body"]          # heuristik melengkapi articleBody yang terpotong
    assert "Baca juga" not in a["body"]            # paragraf noise dibuang
    m = extract(open(os.path.join(FX, "art_mui.html"), "rb").read(), B + "/y")
    assert m["author"] == "Redaksi" and "wakaf produktif" in m["body"]


def test_end_to_end():
    st, store, sess, out = _run()
    recs = {r["url"].rsplit("/", 1)[-1]: r for r in store.load()}
    assert set(recs) == {"pks-dan-ppp-bahas-koalisi", "mui-terbitkan-fatwa", "moderasi-beragama-pesantren"}, recs.keys()
    assert recs["pks-dan-ppp-bahas-koalisi"]["primary"] == "partai_islam"
    assert {"ekonomi_umat", "representasi_ulama_otoritas"} <= set(recs["mui-terbitkan-fatwa"]["labels"])
    assert recs["moderasi-beragama-pesantren"]["primary"] == "moderasi_beragama"
    # robots.txt dihormati; URL di luar rentang tanggal, /tag/, dan domain lain tidak diambil
    assert not any("terlarang" in c for c in sess.calls)
    assert not any("ulama-lama" in c or "/tag/" in c or "lain.com" in c for c in sess.calls)
    # sitemap 2025 dilewati berdasarkan lastmod
    assert not any("2025-01-05" in c for c in sess.calls)
    # prefilter: artikel cabai tidak diunduh
    assert not any("cabai" in c for c in sess.calls)
    paths = store.write_tables()
    rows = list(csv.DictReader(open(paths["sna"], encoding="utf-8-sig")))
    assert len(rows) == 3 and all(r["platform"] == "Media Online" and r["author"] == "Contoh" for r in rows)
    summ = {r["kategori"]: r for r in csv.DictReader(open(paths["summary"], encoding="utf-8-sig"))}
    assert summ["partai_islam"]["jumlah_sebagai_utama"] == "1"
    print(json.dumps(st, ensure_ascii=False))


def test_resume_and_no_prefilter():
    st, store, sess, out = _run(no_prefilter=True)
    assert any("cabai" in c for c in sess.calls)            # diunduh...
    assert "harga-cabai-naik" not in {r["url"].rsplit("/", 1)[-1] for r in store.load()}  # ...tapi tidak relevan
    # jalankan lagi pada folder yang sama → tidak ada unduhan artikel ulang
    sess2 = FakeSession()
    store2 = Store(out, CLF)
    args = SimpleNamespace(delay=0, stealth=False, ignore_robots=False, max_per_source=50,
                           no_prefilter=True, min_words=20, keep_body=True)
    scrape_source({"name": "Contoh", "domain": "contoh.co.id"}, args, CLF, store2,
                  parse_date("2026-10-01"), parse_date("2026-10-31T23:59:59+07:00"),
                  fetcher_factory=lambda d, **kw: PoliteFetcher(d, session=sess2, **kw))
    assert not any("/berita/" in c for c in sess2.calls)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("OK", name)
