"""Ekstraksi artikel: JSON-LD NewsArticle → meta OpenGraph → heuristik kontainer <p> terpanjang."""
from __future__ import annotations

import json
import re

from scrapling.parser import Selector

from .discover import parse_date

NOISE = re.compile(r"^(baca juga|simak juga|lihat juga|baca selengkapnya|advertisement|scroll to continue|"
                   r"ikuti berita|dapatkan update|follow|download aplikasi)", re.I)
ART_TYPES = {"newsarticle", "article", "reportagenewsarticle", "analysisnewsarticle", "opinionnewsarticle",
             "blogposting", "webpage"}


def _iter_ld(obj):
    if isinstance(obj, list):
        for o in obj:
            yield from _iter_ld(o)
    elif isinstance(obj, dict):
        if "@graph" in obj:
            yield from _iter_ld(obj["@graph"])
        yield obj


def _types(o):
    t = o.get("@type", "")
    return {x.lower() for x in (t if isinstance(t, list) else [t]) if isinstance(x, str)}


def _author(a):
    if isinstance(a, list):
        return ", ".join(filter(None, (_author(x) for x in a)))
    if isinstance(a, dict):
        return a.get("name", "") or ""
    return a or ""


def _clean(t: str) -> str:
    return re.sub(r"\s+", " ", t or "").strip()


def _jsonld(page) -> dict:
    best = {}
    for raw in page.css('script[type="application/ld+json"]::text').getall():
        try:
            data = json.loads(raw.strip())
        except (ValueError, TypeError):
            continue
        for o in _iter_ld(data):
            ts = _types(o)
            if ts & ART_TYPES and (o.get("headline") or o.get("articleBody")):
                if "webpage" in ts and best:
                    continue
                best = o
                if ts - {"webpage"}:
                    return best
    return best


def _body_heuristic(page) -> str:
    best, best_len = [], 0
    for cont in page.css("article, [itemprop=articleBody], .detail__body-text, .read__content, "
                         ".detail-text, .post-content, .entry-content, .content-detail, main, div"):
        ps = [_clean(p.get_all_text()) for p in cont.css(":scope > p, :scope > div > p")]
        ps = [p for p in ps if len(p) > 40 and not NOISE.match(p)]
        n = sum(len(p) for p in ps)
        if n > best_len:
            best, best_len = ps, n
    return "\n".join(best)


def extract(html: str | bytes, url: str) -> dict:
    page = Selector(html if isinstance(html, str) else html.decode("utf-8", "ignore"), url=url)
    ld = _jsonld(page)
    meta = lambda sel: _clean(page.css(sel).get() or "")  # noqa: E731
    title = _clean(ld.get("headline", "")) or meta('meta[property="og:title"]::attr(content)') \
        or meta("h1::text") or meta("title::text")
    published = (ld.get("datePublished") or meta('meta[property="article:published_time"]::attr(content)')
                 or meta('meta[name="pubdate"]::attr(content)') or meta('meta[name="publishdate"]::attr(content)')
                 or meta('meta[itemprop="datePublished"]::attr(content)') or meta("time::attr(datetime)"))
    author = _author(ld.get("author")) or meta('meta[name="author"]::attr(content)')
    section = ld.get("articleSection") or meta('meta[property="article:section"]::attr(content)')
    if isinstance(section, list):
        section = ", ".join(section)
    kw = ld.get("keywords") or meta('meta[name="keywords"]::attr(content)')
    if isinstance(kw, list):
        kw = ", ".join(kw)
    body = _clean(ld.get("articleBody", ""))
    heur = _body_heuristic(page)
    if len(heur) > len(body) * 1.2:  # articleBody sering terpotong
        body = heur
    desc = meta('meta[property="og:description"]::attr(content)') or meta('meta[name="description"]::attr(content)')
    d = parse_date(published)
    return {
        "url": meta('link[rel="canonical"]::attr(href)') or url,
        "title": title,
        "published": d.isoformat() if d else "",
        "author": _clean(author),
        "section": _clean(section or ""),
        "keywords": _clean(kw or ""),
        "description": desc,
        "body": body,
        "n_words": len(body.split()),
    }
