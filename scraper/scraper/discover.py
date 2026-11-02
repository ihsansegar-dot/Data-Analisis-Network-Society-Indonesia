"""Penemuan URL artikel: sitemap (robots.txt / lokasi umum / news sitemap) dan RSS."""
from __future__ import annotations

import gzip
import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse

log = logging.getLogger("discover")

COMMON_SITEMAPS = ["/sitemap.xml", "/sitemap_index.xml", "/news-sitemap.xml",
                   "/sitemap-news.xml", "/sitemap_news.xml"]
COMMON_FEEDS = ["/rss", "/feed", "/rss.xml", "/feed/"]
SKIP_URL = re.compile(r"/(tag|tags|topik|topic|indeks|index|kanal|channel|kategori|category|arsip|archive|tokoh|"
                      r"video|videos|foto|fotonews|fototravel|galeri|gallery|infografis|author|penulis|search|login)(/|$)", re.I)
# subdomain advertorial/konten berbayar (mis. fyb.detik.com) — bukan berita redaksi
SKIP_HOST = re.compile(r"^(fyb|adv|advertorial|sponsored|partner|brandstory|promo)\.", re.I)


def looks_like_article(url: str) -> bool:
    """Halaman artikel hampir selalu punya slug judul (>=2 tanda hubung) atau ID numerik panjang;
    halaman kanal/indeks ('/dunia-islam', '/kajian-alquran') tidak."""
    p = urlparse(url)
    if SKIP_HOST.match(p.netloc) or SKIP_URL.search(p.path):
        return False
    last = [x for x in p.path.split("/") if x]
    if not last:
        return False
    return last[-1].count("-") >= 2 or bool(re.search(r"\d{5,}", p.path))


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


URL_DATE = re.compile(r"/(20\d{2})[/-]?(0[1-9]|1[0-2])[/-]?(0[1-9]|[12]\d|3[01])(?=[/-]|\d{3,}|$)")


def date_from_url(url: str):
    """Banyak media menaruh tanggal di path (/read/2026/10/14/..., /20261014...)."""
    m = URL_DATE.search(urlparse(url).path)
    if not m:
        return None
    try:
        return datetime(int(m[1]), int(m[2]), int(m[3]), 12, tzinfo=timezone(timedelta(hours=7)))
    except ValueError:
        return None


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
        if not loc or not _same_site(loc, domain) or not looks_like_article(loc):
            continue
        news = u.find("news")
        title = (news.findtext("title") if news is not None else "") or ""
        d = parse_date((news.findtext("publication_date") if news is not None else None)
                       or u.findtext("lastmod")) or date_from_url(loc)
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
        if not link or not _same_site(link, domain) or not looks_like_article(link):
            continue
        d = parse_date(it.findtext("pubDate") or it.findtext("published") or it.findtext("updated")) or date_from_url(link)
        if _in_window(d, since, until):
            out.append(Candidate(link, (it.findtext("title") or "").strip(), d, "rss"))
    return out


def feeds_from_home(resp) -> list[str]:
    hrefs = resp.css('link[rel="alternate"][type*="rss"]::attr(href), '
                     'link[rel="alternate"][type*="atom"]::attr(href)').getall()
    return [urljoin(resp.url, h) for h in hrefs]


def from_index_pages(fetcher, source, since, until, max_days=62) -> list[Candidate]:
    """Halaman indeks per tanggal (config: index_urls, placeholder {Y} {m} {d}). Judul diambil dari teks tautan.
    Hanya halaman pertama tiap tanggal yang dibaca."""
    tpls = source.get("index_urls") or []
    if not tpls or not since:
        return []
    end = (until or datetime.now(timezone.utc)).date()
    day, out, n = since.date(), [], 0
    hits = {t: 0 for t in tpls}
    dead = set()
    while day <= end and n < max_days:
        for t in tpls:
            if t in dead:
                continue
            if n >= 3 and hits[t] == 0:  # templat salah/tidak didukung: tinggalkan setelah 3 hari tanpa hasil
                log.info("templat indeks tidak menghasilkan tautan, dilewati: %s", t)
                dead.add(t)
                continue
            url = t.format(Y=f"{day.year:04d}", m=f"{day.month:02d}", d=f"{day.day:02d}")
            r = fetcher.get(url)
            if r is None:
                continue
            before = len(out)
            for a in r.css("a[href]"):
                href = urljoin(r.url, a.attrib.get("href", ""))
                if not _same_site(href, source["domain"]) or not looks_like_article(href):
                    continue
                txt = re.sub(r"\s+", " ", a.get_all_text() or "").strip()
                pub = date_from_url(href) or datetime(day.year, day.month, day.day, 12, tzinfo=timezone(timedelta(hours=7)))
                out.append(Candidate(href, txt if len(txt) > 15 else "", pub, "indeks"))
            hits[t] += len(out) - before
        day += timedelta(days=1)
        n += 1
    return out


def discover(fetcher, base, source, since=None, until=None, limit=300) -> list[Candidate]:
    domain = source["domain"]
    out: list[Candidate] = from_index_pages(fetcher, source, since, until)
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
    uniq, keys = [], {}
    for c in out:
        k = c.url.split("#")[0].rstrip("/")
        if k not in keys:
            keys[k] = c
            uniq.append(c)
        else:
            o = keys[k]
            if len(c.title) > len(o.title):
                o.title = c.title
            if o.published is None:
                o.published = c.published
    log.info("%s: %d kandidat URL", domain, len(uniq))
    return spread_by_day(uniq)


def spread_by_day(cands: list[Candidate]) -> list[Candidate]:
    """Urutkan bergiliran per hari (hari terbaru dulu, lalu satu artikel dari tiap hari, dst.) agar batas
    --max-per-source tersebar di seluruh rentang tanggal, bukan habis di beberapa hari terakhir.
    Kandidat tanpa tanggal ditaruh paling akhir."""
    by = {}
    for c in cands:
        by.setdefault(c.published.date() if c.published else None, []).append(c)
    days = sorted((d for d in by if d is not None), reverse=True)
    for d in days:
        by[d].sort(key=lambda c: c.published, reverse=True)
    out, i = [], 0
    while True:
        added = False
        for d in days:
            if i < len(by[d]):
                out.append(by[d][i])
                added = True
        if not added:
            break
        i += 1
    return out + by.get(None, [])
