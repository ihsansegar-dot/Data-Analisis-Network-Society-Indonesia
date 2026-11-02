#!/usr/bin/env python3
"""Scraper berita online Indonesia + identifikasi 11 kategori keislaman-politik.

Contoh:
  python run.py --since 2026-10-01 --until 2026-10-31
  python run.py --sources republika.co.id,detik.com --max-per-source 100
  python run.py --group islam --stealth
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import yaml

from scraper.classify import CategoryClassifier
from scraper.discover import discover, parse_date
from scraper.export import Store
from scraper.extract import extract
from scraper.fetch import PoliteFetcher, resolve_base

log = logging.getLogger("run")
WIB = timezone(timedelta(hours=7))


def user_date(s: str) -> datetime:
    """Terima YYYY-MM-DD, YYYY-M-D, DD-MM-YYYY, DD/MM/YYYY (tanggal dianggap WIB)."""
    s = (s or "").strip()
    m = re.fullmatch(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", s)
    if m:
        y, mo, d = int(m[1]), int(m[2]), int(m[3])
    else:
        m = re.fullmatch(r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})", s)
        if not m:
            raise argparse.ArgumentTypeError(f"format tanggal tidak dikenali: '{s}' (pakai YYYY-MM-DD, mis. 2026-10-01)")
        d, mo, y = int(m[1]), int(m[2]), int(m[3])
    try:
        return datetime(y, mo, d, tzinfo=WIB)
    except ValueError as e:
        raise argparse.ArgumentTypeError(f"tanggal tidak valid: '{s}' ({e})")


def scrape_source(src, args, clf, store, since, until, fetcher_factory=PoliteFetcher):
    stats = {"media": src["name"], "kandidat": 0, "diunduh": 0, "relevan": 0, "berlabel": 0, "gagal": 0, "robots": 0,
             "luar_tanggal": 0, "pendek": 0, "tidak_relevan": 0, "tidak_terjangkau": 0}
    f = fetcher_factory(src["domain"], delay=args.delay, stealth=args.stealth or src.get("stealth", False),
                        respect_robots=not args.ignore_robots)
    try:
        base = resolve_base(f, src.get("base") or src["domain"])
        if base is None:
            log.warning("%s tidak terjangkau (www dan non-www), dilewati.", src["domain"])
            stats["tidak_terjangkau"] = 1
            return stats
        f.load_robots(base)
        cands = discover(f, base, src, since, until, limit=args.max_per_source)
        stats["kandidat"] = len(cands)
        if not args.no_prefilter:
            # judul (news sitemap / RSS) atau slug URL harus memuat istilah konteks; kandidat tanpa
            # judul dan slug tak informatif tetap dilewati — gunakan --no-prefilter bila perlu cakupan penuh
            cands = [c for c in cands if clf.prefilter(c.title + " " + urlparse(c.url).path)]
        n, streak_out, bad_via, last_via = 0, 0, set(), None
        for c in cands:
            if n >= args.max_per_source:
                break
            if c.via in bad_via:
                continue
            if streak_out >= 15:
                # run 3: kandidat dari halaman indeks Tempo ternyata bertanggal November; jangan hentikan seluruh
                # sumber, cukup tinggalkan jalur penemuan (sitemap/rss/indeks) yang bermasalah
                log.info("%s: 15 unduhan berturut-turut di luar rentang dari jalur '%s'; jalur ini dilewati.",
                         src["domain"], last_via)
                bad_via.add(last_via)
                streak_out = 0
                if len(bad_via) >= 3:
                    break
                continue
            if store.is_seen(c.url):
                continue
            if not f.allowed(c.url):
                stats["robots"] += 1
                continue
            r = f.get(c.url)
            store.mark_seen(c.url)
            if r is None:
                stats["gagal"] += 1
                continue
            n += 1
            stats["diunduh"] += 1
            try:
                art = extract(r.body, c.url)
            except Exception as e:  # noqa: BLE001
                log.warning("ekstraksi gagal %s: %s", c.url, e)
                stats["gagal"] += 1
                continue
            d = parse_date(art["published"]) or c.published
            if d and ((since and d < since) or (until and d > until)):
                stats["luar_tanggal"] += 1
                streak_out = streak_out + 1 if c.via == last_via else 1
                last_via = c.via
                continue
            streak_out = 0
            if not art["title"] and c.title:
                art["title"] = c.title
            if art["n_words"] < args.min_words:
                stats["pendek"] += 1
                continue
            res = clf.classify(art["title"], art["body"])
            if not res.relevant:
                stats["tidak_relevan"] += 1
                continue
            stats["relevan"] += 1
            stats["berlabel"] += bool(res.labels)
            rec = {**art, "media": src["name"], "domain": src["domain"], "group": src.get("group", ""),
                   "published": d.isoformat() if d else "", "via": c.via,
                   "scores": res.scores, "labels": res.labels, "primary": res.primary,
                   "matched": res.matched, "relevance_hits": res.relevance_hits, "jenis": res.jenis,
                   "scraped_at": datetime.now(timezone.utc).isoformat()}
            if not args.keep_body:
                rec["body"] = rec["body"][:1500]
            store.add(rec)
    except Exception as e:  # noqa: BLE001
        log.exception("%s gagal: %s", src["domain"], e)
    finally:
        f.close()
    log.info("%s", stats)
    return stats


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sources-file", default="config/sources.yaml")
    ap.add_argument("--categories", default="config/categories.yaml")
    ap.add_argument("--sources", help="daftar domain dipisah koma (default: semua di sources.yaml)")
    ap.add_argument("--group", help="hanya grup tertentu: nasional / daerah / islam")
    ap.add_argument("--since", type=user_date, help="YYYY-MM-DD (default: 7 hari terakhir)")
    ap.add_argument("--until", type=user_date, help="YYYY-MM-DD (inklusif)")
    ap.add_argument("--last-days", type=int, help="ambil N hari terakhir termasuk hari ini (untuk jadwal harian); "
                    "mengabaikan --since/--until")
    ap.add_argument("--max-per-source", type=int, default=None)
    ap.add_argument("--delay", type=float, default=None, help="jeda antar-permintaan per domain (detik)")
    ap.add_argument("--workers", type=int, default=6, help="jumlah domain yang diproses paralel")
    ap.add_argument("--min-words", type=int, default=80)
    ap.add_argument("--stealth", action="store_true", help="pakai StealthyFetcher (browser) untuk semua")
    ap.add_argument("--no-prefilter", action="store_true", help="unduh semua kandidat, bukan hanya yang judul/slug-nya relevan")
    ap.add_argument("--keep-body", action="store_true", help="simpan teks lengkap (default dipotong 1.500 karakter)")
    ap.add_argument("--include-unlabeled", action="store_true", help="sertakan artikel relevan tanpa kategori di sna_explorer.csv")
    ap.add_argument("--ignore-robots", action="store_true", help=argparse.SUPPRESS)
    ap.add_argument("--out", default="output")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    fmt = "%(asctime)s %(levelname)s %(name)s: %(message)s"
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format=fmt,
                        handlers=[logging.StreamHandler(),
                                  logging.FileHandler(os.path.join(args.out, "log.txt"), encoding="utf-8")])
    if not args.verbose:  # baris "Fetched (200) <GET …>" per permintaan terlalu ramai untuk konsol
        logging.getLogger("scrapling").setLevel(logging.WARNING)
    cfg = yaml.safe_load(open(args.sources_file, encoding="utf-8"))
    dflt = cfg.get("defaults", {})
    args.delay = args.delay if args.delay is not None else float(dflt.get("delay_seconds", 2.5))
    args.max_per_source = args.max_per_source or int(dflt.get("max_articles_per_source", 300))
    srcs = cfg["sources"]
    if args.sources:
        want = {s.strip().lower() for s in args.sources.split(",")}
        srcs = [s for s in srcs if s["domain"].lower() in want]
        known = {s["domain"].lower() for s in srcs}
        srcs += [{"name": d, "domain": d, "group": "lain"} for d in want - known]
    if args.group:
        srcs = [s for s in srcs if s.get("group") == args.group]
    if not srcs:
        log.error("Tidak ada sumber yang cocok dengan --sources/--group.")
        sys.exit(2)

    now = datetime.now(WIB)
    if args.last_days:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=args.last_days - 1)
        since, until = start, now
    else:
        since = args.since or now - timedelta(days=7)
        until = (args.until + timedelta(days=1) - timedelta(seconds=1)) if args.until else now
    if since > until:
        log.error("Tanggal mulai (%s) setelah tanggal akhir (%s).", since.date(), until.date())
        sys.exit(2)

    clf = CategoryClassifier(args.categories)
    store = Store(args.out, clf)
    log.info("%d sumber, %s s.d. %s", len(srcs), since.date(), until.date())
    allstats = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(scrape_source, s, args, clf, store, since, until) for s in srcs]
        for fu in as_completed(futs):
            allstats.append(fu.result())
    paths = store.write_tables(include_unlabeled=args.include_unlabeled)
    print("\nRingkasan per media:")
    for s in sorted(allstats, key=lambda x: -x["relevan"]):
        print(f"  {s['media']:<22} kandidat={s['kandidat']:<5} diunduh={s['diunduh']:<4} "
              f"relevan={s['relevan']:<4} berlabel={s['berlabel']:<4} gagal={s['gagal']:<3} robots={s['robots']:<3} "
              f"luar_tanggal={s['luar_tanggal']:<3} pendek={s['pendek']:<3} tidak_relevan={s['tidak_relevan']}")
    print(f"\nTotal artikel tersimpan: {paths['n']}")
    for k in ("articles", "summary", "sna", "jsonl"):
        print(f"  {paths[k]}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except KeyboardInterrupt:
        log.warning("Dihentikan pengguna. Artikel yang sudah tersimpan tetap ada; jalankan lagi untuk melanjutkan.")
        sys.exit(130)
    except Exception:  # noqa: BLE001
        log.exception("Program berhenti karena error. Kirim file output/log.txt untuk diperiksa.")
        sys.exit(1)
