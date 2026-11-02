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
