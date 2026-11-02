"""Penemuan URL artikel: sitemap (robots.txt / lokasi umum / news sitemap) dan RSS."""
from __future__ import annotations

import gzip
import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse

log = logging.getLogger("discover")

COMMON_SITEMAPS = ["/sitemap.xml", "/sitemap_index.xml", "/news-sitemap.xml",
                   "/sitemap-news.xml", "/sitemap_news.xml"]
COMMON_FEEDS = ["/rss", "/feed", "/rss.xml", "/feed/"]
SKIP_URL = re.compile(r"/(tag|tags|topik|indeks|index|video|foto|galeri|gallery|author|penulis|search|login)(/|$)", re.I)


@dataclass
class Candidate:
    url: str
    title: str = ""
    published: datetime | None = None
    via: str = ""


def _strip_ns(root):
    for el in root.iter():
        if isinstance(el.tag, str) and "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]
    return root


def _xml(resp):
    body = resp.body
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)
    try:
        return _strip_ns(ET.fromstring(body))
    except ET.ParseError:
        return None


def parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    s = s.strip()
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        try:
            d = parsedate_to_datetime(s)
        except (TypeError, ValueError):
            m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
            if not m:
                return None
            d = datetime(int(m[1]), int(m[2]), int(m[3]))
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d


def _in_window(d, since, until) -> bool:
    if d is None:
        return True  # tanggal tak diketahui: biarkan, disaring lagi setelah ekstraksi
    if since and d < since:
        return False
    if until and d > until:
        return False
    return True


def _same_site(url: str, domain: str) -> bool:
    host = urlparse(url).netloc.lower()
    d = domain.lower().replace("www.", "")
    return host == d or host.endswith("." + d)


def _sitemap_name_date(url: str):
    """Banyak sitemap indeks menamai file per tanggal (…2026-10-31…); dipakai untuk melewati yang di luar rentang."""
    m = re.search(r"(20\d{2})[-_/]?(0[1-9]|1[0-2])(?:[-_/]?([0-3]\d))?", url)
    if not m:
        return None
    return datetime(int(m[1]), int(m[2]), int(m[3] or 1), tzinfo=timezone.utc), bool(m[3])


def walk_sitemap(fetcher, url, domain, since, until, out, seen, depth=0, max_maps=40):
    if url in seen or depth > 3 or len(seen) >= max_maps:
        return
    seen.add(url)
    r = fetcher.get(url)
    if r is None:
        return
    root = _xml(r)
    if root is None:
        return
    if root.tag == "sitemapindex":
        children = []
        for sm in root.findall("sitemap"):
            loc = (sm.findtext("loc") or "").strip()
            if not loc:
                continue
            lm = parse_date(sm.findtext("lastmod"))
            if since and lm and lm < since:
                continue
            nd = _sitemap_name_date(loc)
            if nd and since:
                d, has_day = nd
                slack = 1 if has_day else 31  # file bulanan bisa memuat sampai akhir bulan
                if (since - d).days > slack:
                    continue
            if nd and until and nd[0] > until:
                continue
            children.append((lm or datetime.min.replace(tzinfo=timezone.utc), loc))
        children.sort(reverse=True)  # terbaru dulu
        for _, loc in children:
            walk_sitemap(fetcher, loc, domain, since, until, out, seen, depth + 1, max_maps)
        return
    for u in root.findall("url"):
        loc = (u.findtext("loc") or "").strip()
        if not loc or not _same_site(loc, domain) or SKIP_URL.search(urlparse(loc).path):
            continue
        news = u.find("news")
        title = (news.findtext("title") if news is not None else "") or ""
        d = parse_date((news.findtext("publication_date") if news is not None else None)
                       or u.findtext("lastmod"))
        if _in_window(d, since, until):
            out.append(Candidate(loc, title.strip(), d, "sitemap"))


def parse_feed(resp, domain, since, until) -> list[Candidate]:
    root = _xml(resp)
    if root is None:
        return []
    out = []
    items = root.findall(".//item") or root.findall(".//entry")
    for it in items:
        link = (it.findtext("link") or "").strip()
        if not link:
            el = it.find("link")
            link = el.get("href", "") if el is not None else ""
        if not link or not _same_site(link, domain):
            continue
        d = parse_date(it.findtext("pubDate") or it.findtext("published") or it.findtext("updated"))
        if _in_window(d, since, until):
            out.append(Candidate(link, (it.findtext("title") or "").strip(), d, "rss"))
    return out


def feeds_from_home(resp) -> list[str]:
    hrefs = resp.css('link[rel="alternate"][type*="rss"]::attr(href), '
                     'link[rel="alternate"][type*="atom"]::attr(href)').getall()
    return [urljoin(resp.url, h) for h in hrefs]


def discover(fetcher, base, source, since=None, until=None, limit=300) -> list[Candidate]:
    domain = source["domain"]
    out: list[Candidate] = []
    seen: set[str] = set()
    maps = list(source.get("sitemaps") or []) + fetcher.sitemaps_from_robots()
    if not maps:
        maps = [base + p for p in COMMON_SITEMAPS]
    # utamakan news sitemap (paling segar & memuat judul)
    maps.sort(key=lambda m: 0 if "news" in m.lower() else 1)
    for m in maps:
        walk_sitemap(fetcher, urljoin(base + "/", m), domain, since, until, out, seen)
        if len(out) >= limit * 5:
            break
    feeds = list(source.get("rss") or [])
    if not feeds:
        home = fetcher.get(base + "/")
        if home is not None:
            feeds = feeds_from_home(home)
        if not feeds and not out:
            feeds = [base + p for p in COMMON_FEEDS]
    for f in feeds[:5]:
        r = fetcher.get(urljoin(base + "/", f))
        if r is not None:
            out.extend(parse_feed(r, domain, since, until))
    uniq, keys = [], set()
    for c in out:
        k = c.url.split("#")[0].rstrip("/")
        if k not in keys:
            keys.add(k)
            uniq.append(c)
    uniq.sort(key=lambda c: c.published or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    log.info("%s: %d kandidat URL", domain, len(uniq))
    return uniq
