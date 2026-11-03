"""Mode kata kunci (--keywords): Penyadapan, POLRI, Kepolisian, Polisi."""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from scraper.classify import KeywordClassifier  # noqa: E402

KW = KeywordClassifier("Penyadapan,POLRI,Kepolisian,Polisi".split(","))


def test_labels_and_variants():
    r = KW.classify("KPK Minta Kewenangan Menyadap Diperjelas", "Rancangan aturan penyadapan oleh Polri dan KPK")
    assert set(r.labels) == {"penyadapan", "polri"} and r.primary == "penyadapan"
    assert KW.label_of("polri") == "POLRI"


def test_whole_words_only():
    r = KW.classify("Politisi muda bicara kebijakan", "politik dan polisial bukan kata kunci; kepolisianisme juga bukan")
    assert not r.relevant
    assert KW.classify("Polisi tangkap pelaku", "").labels == ["polisi"]


def test_exact_mode():
    ex = KeywordClassifier(["Penyadapan"], exact=True)
    assert not ex.classify("Ponsel pejabat disadap", "disadap").relevant
    assert ex.classify("Aturan penyadapan", "").relevant


def test_prefilter_uses_title_or_slug():
    assert KW.prefilter("https://x.id/berita/polisi-tangkap-pelaku")
    assert not KW.prefilter("Harga cabai naik")
