#!/usr/bin/env python3
"""Susun SNA Explorer versi PRIBADI berisi data nyata dari keluaran news scraper.

    python tools/build_private_artifact.py --jsonl run3/articles.jsonl harian/articles.jsonl --out /tmp/index.html

Langkah:
1. Gabungkan semua articles.jsonl (URL unik; rekaman pertama dipakai).
2. Bersihkan: hanya jenis=berita, URL artikel (bukan kanal/advertorial), relevan menurut kamus saat ini.
   Kategori diambil dari hasil klasifikasi saat scraping (teks penuh); rekaman lama tanpa kolom "jenis"
   diklasifikasi ulang dari teks yang tersimpan.
3. Tulis CSV format SNA Explorer (judul + cuplikan <=350 karakter, tanpa teks lengkap).
4. Jalankan build.js dengan REALDATA_JSON sehingga data dimuat otomatis saat aplikasi dibuka.

Hasilnya HANYA untuk artifact pribadi. Jangan di-commit: berisi cuplikan berita (hak cipta).
"""
from __future__ import annotations

import argparse
import collections
import csv
import html
import io
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scraper"))

from scraper.classify import CategoryClassifier  # noqa: E402
from scraper.discover import looks_like_article  # noqa: E402


def load(paths):
    recs, seen = [], set()
    for p in paths:
        if not os.path.exists(p):
            print(f"(dilewati, tidak ada) {p}")
            continue
        for ln in open(p, encoding="utf-8"):
            try:
                r = json.loads(ln)
            except ValueError:
                continue
            if r.get("url") and r["url"] not in seen:
                seen.add(r["url"])
                recs.append(r)
    return recs


def clean(recs, clf, reclassify=True):
    rows, keep, drop = [], [], collections.Counter()
    for r in recs:
        title = html.unescape(r.get("title") or "").strip()
        if not looks_like_article(r["url"]):
            drop["url_non_artikel"] += 1
            continue
        # penyaring judul non-berita dijalankan ulang dengan kamus terkini (pola baru juga berlaku untuk data lama)
        if clf.is_non_news(title):
            drop["panduan_ibadah"] += 1
            continue
        if not reclassify and "jenis" in r:
            if r["jenis"] != "berita":
                drop["panduan_ibadah"] += 1
                continue
            labels = r.get("labels") or []
        else:  # klasifikasi ulang dengan kamus terkini (satu versi kamus untuk seluruh korpus)
            x = clf.classify(title, r.get("body") or "")
            # rekaman baru (punya "jenis") sudah lolos gerbang relevansi saat scraping dengan teks penuh;
            # teks lama di jsonl bisa terpotong, jadi keputusan relevansinya tidak diulang
            if not x.relevant and "jenis" not in r:
                drop["tidak_relevan"] += 1
                continue
            if x.jenis != "berita":
                drop["panduan_ibadah"] += 1
                continue
            labels = x.labels
        lead = html.unescape(r.get("description") or r.get("body") or "").strip()
        if lead.lower().startswith(title.lower()[:40]):
            lead = lead[len(title):].lstrip(" .-")
        rows.append([r["media"], f"{title}. {lead[:350]}".strip(), "post", "", r.get("published", ""), "Media Online",
                     "news", ";".join(clf.label_of(k) for k in labels if k in clf.cats), r["url"]])
        keep.append(r)
    return rows, keep, drop


def meta_text(keep, drop):
    grp = collections.Counter(r.get("group", "lain") for r in keep)
    media = collections.Counter(r["media"] for r in keep)
    days = sorted(r["published"][:10] for r in keep if r.get("published"))
    rng = f"{days[0]} s.d. {days[-1]}" if days else "tanggal tidak diketahui"
    top = ", ".join(f"{m} {n}" for m, n in media.most_common(4))
    g = ", ".join(f"{k} {v}" for k, v in grp.most_common())
    return (f"{len(keep)} artikel berita dari {len(media)} media ({g}), {rng}, hasil news scraper (run Oktober + jadwal "
            f"harian) yang dibersihkan otomatis ({drop.get('panduan_ibadah', 0)} konten panduan ibadah dan "
            f"{drop.get('url_non_artikel', 0) + drop.get('tidak_relevan', 0)} artikel non-berita/tidak relevan dibuang). "
            f"Media terbanyak: {top}. Komposisi media tidak seimbang dan beberapa media besar belum terambil. "
            f"Hanya judul dan cuplikan pembuka yang disimpan."), rng


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--jsonl", nargs="+", required=True)
    ap.add_argument("--out", required=True, help="path index.html keluaran")
    ap.add_argument("--csv-out", help="opsional: simpan juga CSV yang disisipkan")
    ap.add_argument("--keep-scrape-labels", action="store_true",
                    help="pakai label saat scraping (bisa campuran versi kamus) alih-alih klasifikasi ulang")
    a = ap.parse_args(argv)
    clf = CategoryClassifier(os.path.join(ROOT, "scraper", "config", "categories.yaml"))
    recs = load(a.jsonl)
    rows, keep, drop = clean(recs, clf, reclassify=not a.keep_scrape_labels)
    if not rows:
        sys.exit("Tidak ada artikel setelah dibersihkan; artifact TIDAK diperbarui.")
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["author", "text", "type", "target_user", "created_at", "platform", "atype", "term", "url"])
    w.writerows(rows)
    meta, rng = meta_text(keep, drop)
    meta += f" Kategori: kamus v{clf.version}, belum tervalidasi."
    data = {"name": "media_online_data_nyata.csv", "title": f"Media Online {rng} (data nyata)", "meta": meta,
            "csv": buf.getvalue()}
    if a.csv_out:
        open(a.csv_out, "w", encoding="utf-8").write(buf.getvalue())
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
        tmp = f.name
    env = dict(os.environ, REALDATA_JSON=tmp, OUT_FILE=os.path.abspath(a.out))
    subprocess.run(["node", os.path.join(ROOT, "build.js")], check=True, env=env)
    os.unlink(tmp)
    summary = {"kamus": clf.version, "artikel": len(rows), "media": len({r['media'] for r in keep}), "rentang": rng,
               "berkategori": sum(1 for r in rows if r[7]), "dibuang": dict(drop), "rekaman_masuk": len(recs)}
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
