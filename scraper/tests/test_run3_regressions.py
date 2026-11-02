"""Regresi run 3: kandidat indeks yang dialihkan, jalur penemuan bermasalah tidak menghentikan sumber."""
import os
import sys
from datetime import datetime, timezone
from types import SimpleNamespace

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from scrapling.engines.toolbelt.custom import Response  # noqa: E402

from scraper.discover import from_index_pages  # noqa: E402
from scraper.fetch import PoliteFetcher  # noqa: E402


def test_index_redirect_ignored():
    class S:
        def get(self, url, **kw):
            # situs mengalihkan indeks tanggal lama ke indeks hari ini
            return Response("https://www.tempo.co/indeks", b"<a href='/politik/berita-baru-november-2305000'>Berita November terbaru</a>",
                            200, "OK", {}, {}, {})

    f = PoliteFetcher("tempo.co", delay=0, session=S())
    src = {"domain": "tempo.co", "index_urls": ["https://www.tempo.co/indeks/{Y}-{m}-{d}"]}
    assert from_index_pages(f, src, datetime(2026, 10, 1, tzinfo=timezone.utc), datetime(2026, 10, 2, tzinfo=timezone.utc)) == []


def test_bad_discovery_path_does_not_stop_source(tmp_path):
    from run import scrape_source
    from scraper.classify import CategoryClassifier
    from scraper.discover import Candidate
    from scraper.export import Store
    import run as runmod

    clf = CategoryClassifier(os.path.join(ROOT, "config", "categories.yaml"))
    nov = "<html><head><meta property='og:title' content='X'><meta property='article:published_time' content='2026-11-02T10:00:00+07:00'></head><body><article><p>" + "kata " * 100 + "</p></article></body></html>"
    okt = ("<html><head><meta property='og:title' content='PKS dan Ulama Bahas Umat Islam'><meta property='article:published_time' "
           "content='2026-10-15T10:00:00+07:00'></head><body><article><p>" + "Partai Keadilan Sejahtera PKS bertemu ulama dan kiai pesantren membahas umat Islam. " * 15 + "</p></article></body></html>")
    cands = [Candidate(f"https://x.id/a/indeks-berita-{i}", "", datetime(2026, 10, 1, tzinfo=timezone.utc), "indeks") for i in range(20)]
    cands += [Candidate("https://x.id/a/pks-dan-ulama-bahas-umat", "", datetime(2026, 10, 15, tzinfo=timezone.utc), "sitemap")]

    class F:
        def __init__(self, *a, **k): pass
        def load_robots(self, base): pass
        def allowed(self, url): return True
        def close(self): pass
        def get(self, url):
            return Response(url, (okt if "pks" in url else nov).encode(), 200, "OK", {}, {}, {})

    orig_d, orig_r = runmod.discover, runmod.resolve_base
    runmod.discover = lambda *a, **k: cands
    runmod.resolve_base = lambda f, d: "https://x.id"
    try:
        store = Store(str(tmp_path), clf)
        args = SimpleNamespace(delay=0, stealth=False, ignore_robots=False, max_per_source=60, no_prefilter=True,
                               min_words=20, keep_body=False)
        st = scrape_source({"name": "X", "domain": "x.id"}, args, clf, store, datetime(2026, 10, 1, tzinfo=timezone.utc),
                           datetime(2026, 10, 31, 23, tzinfo=timezone.utc), fetcher_factory=F)
    finally:
        runmod.discover, runmod.resolve_base = orig_d, orig_r
    assert st["luar_tanggal"] == 15 and st["relevan"] == 1


def test_stop_after_consecutive_network_failures():
    class S:
        n = 0

        def get(self, url, **kw):
            S.n += 1
            raise TimeoutError("timeout")

    f = PoliteFetcher("islampos.com", delay=0, session=S())
    for i in range(10):
        f.get(f"https://www.islampos.com/x{i}")
    assert S.n == 3
