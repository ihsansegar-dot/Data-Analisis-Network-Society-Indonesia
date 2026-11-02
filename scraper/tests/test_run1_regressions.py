"""Regresi dari run nyata pertama (Okt 2026): URL kanal/advertorial, relevansi 'umat Katolik', haji."""
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from scraper.classify import CategoryClassifier  # noqa: E402
from scraper.discover import Candidate, looks_like_article, spread_by_day  # noqa: E402

CLF = CategoryClassifier(os.path.join(ROOT, "config", "categories.yaml"))


def test_article_urls():
    no = ["https://republika.co.id/kanal/iqra/kajian-alquran", "https://republika.co.id/kanal/dunia-islam",
          "https://republika.co.id/kanal/news/universitas-muhammadiyah-malang",
          "https://fyb.detik.com/story/11453/buru-promo-haji-dan-umrah-kunjungi-booth-27-nra-group",
          "https://www.tempo.co/tokoh/anies-baswedan", "https://www.tempo.co/arsip/2026-10",
          "https://travel.detik.com/fototravel/d-8711111/foto-masjid-indah-di-lombok"]
    yes = ["https://khazanah.republika.co.id/berita/tn1mmp430/mui-ingatkan-fatwa-haram-pembakaran-hutan-dan-lahan",
           "https://www.tempo.co/hukum/polisi-menggerebek-pondok-pesantren-di-sukoharjo-2302821",
           "https://news.detik.com/kolom/d-8719540/santri-desil-satu",
           "https://www.nu.or.id/nasional/pesantren-didorong-lahirkan-profesor-abc12"]
    assert [u for u in no if looks_like_article(u)] == []
    assert [u for u in yes if not looks_like_article(u)] == []


def test_spread_by_day():
    d = lambda day, h: datetime(2026, 10, day, h, tzinfo=timezone.utc)  # noqa: E731
    cs = [Candidate(f"u{day}{h}", "", d(day, h)) for day in (30, 30, 30, 1) for h in (1, 2)] + [Candidate("x")]
    out = [c.url for c in spread_by_day(cs)]
    assert out[:2] == ["u302", "u12"]          # hari terbaru, lalu hari paling awal — tidak menumpuk di tgl 30
    assert out[-1] == "x"


def test_weak_relevance():
    katolik = CLF.classify("Keliru: Klaim Bantuan Dana Umat Katolik", "bantuan untuk umat Katolik. Kemenag membantah. "
                           "Situs resmi Kementerian Agama.")
    assert not katolik.relevant
    assert CLF.classify("PBNU bahas umat", "Nahdlatul Ulama dan umat Islam").relevant


def test_haji_promo_not_pendidikan():
    r = CLF.classify("Buru Promo Haji dan Umrah di BSI Expo", "promo paket haji dan umrah, jemaah haji, umrah plus "
                     "Turki. Travel haji resmi. haji haji umrah umrah")
    assert "pendidikan_sosial_keagamaan" not in r.labels
    k = CLF.classify("Hakim Konfrontasi Saksi Kasus Korupsi Kuota Haji", "kasus korupsi kuota haji di Kementerian Agama, "
                     "kuota haji tambahan, umat Islam dirugikan")
    assert "politik_kebijakan_publik" in k.labels and "pendidikan_sosial_keagamaan" not in k.labels


def test_resolve_base_fallback():
    from scraper.fetch import PoliteFetcher, resolve_base

    class S:
        def get(self, url, **kw):
            if url.startswith("https://www.rmol.id"):
                raise ConnectionError("DNS gagal")
            from scrapling.engines.toolbelt.custom import Response
            return Response(url, b"User-agent: *", 200, "OK", {}, {}, {})

    f = PoliteFetcher("rmol.id", delay=0, session=S())
    assert resolve_base(f, "rmol.id") == "https://rmol.id"


# ---- regresi run 2 (34 media, Okt 2026) ----
def test_date_from_url():
    from scraper.discover import date_from_url
    assert date_from_url("https://rmol.id/read/2026/10/14/715529/judul-berita").day == 14
    assert date_from_url("https://news.okezone.com/read/2026/10/03/337/3230940/judul").month == 10
    assert date_from_url("https://www.viva.co.id/berita/politik/1712345-judul-tanpa-tanggal") is None


def test_ambiguous_and_non_news():
    pajak = CLF.classify("Mau Bayar PKB? Cek 23 Lokasi Samsat Keliling", "bayar pkb di samsat dekat masjid")
    assert "partai_islam" not in pajak.labels and not pajak.relevant
    doa = CLF.classify("Niat Sholat Tahajud Lengkap dengan Doanya", "umat islam sholat nabi ulama")
    assert doa.jenis == "panduan_ibadah" and doa.labels == []
    assert CLF.classify("Surat Edaran Menag soal Hari Santri", "santri pesantren").jenis == "berita"


def test_body_fallback_br_paragraphs():
    from scraper.extract import extract
    para = "Partai Keadilan Sejahtera menyatakan sikap resmi terkait kebijakan pemerintah tentang pendidikan pesantren. "
    html = ("<html><head><meta property='og:title' content='PKS Bersikap'></head><body>"
            "<div class='detail-desc'>" + "<br><br>".join([para] * 12) + "</div></body></html>")
    a = extract(html, "https://x/y")
    assert a["n_words"] > 100


def test_index_pages():
    from datetime import datetime, timezone
    from scrapling.engines.toolbelt.custom import Response
    from scraper.discover import from_index_pages
    from scraper.fetch import PoliteFetcher

    class S:
        calls = []

        def get(self, url, **kw):
            S.calls.append(url)
            html = ("<a href='/read/2026/10/02/1/pks-dan-ulama-bertemu-bahas-umat'>PKS dan Ulama Bertemu Bahas Umat</a>"
                    "<a href='/kanal/politik'>Politik</a><a href='https://lain.com/a-b-c'>x</a>")
            return Response(url, html.encode(), 200, "OK", {}, {}, {})

    f = PoliteFetcher("rmol.id", delay=0, session=S())
    src = {"domain": "rmol.id", "index_urls": ["https://rmol.id/indeks?date={Y}-{m}-{d}"]}
    out = from_index_pages(f, src, datetime(2026, 10, 1, tzinfo=timezone.utc), datetime(2026, 10, 2, tzinfo=timezone.utc))
    assert S.calls == ["https://rmol.id/indeks?date=2026-10-01", "https://rmol.id/indeks?date=2026-10-02"]
    assert {c.url for c in out} == {"https://rmol.id/read/2026/10/02/1/pks-dan-ulama-bertemu-bahas-umat"}
    assert out[0].title.startswith("PKS dan Ulama") and out[0].published.day == 2


def test_unreachable_source_skipped():
    from scraper.fetch import PoliteFetcher, resolve_base

    class S:
        def get(self, url, **kw):
            raise TimeoutError("timeout")

    assert resolve_base(PoliteFetcher("islampos.com", delay=0, session=S()), "islampos.com") is None
