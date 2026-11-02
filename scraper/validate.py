#!/usr/bin/env python3
"""Validasi klasifikasi kategori terhadap pengodean manual.

1) Ambil sampel bertingkat + lembar kode buta (label mesin disembunyikan dari pengode):
   python validate.py sample --in output/articles.jsonl --n 200 --out validasi

   → validasi/lembar_kode_pengode1.csv, lembar_kode_pengode2.csv (isi kolom k_* dengan 1/0)
   → validasi/kunci_mesin.csv (JANGAN dibuka pengode)

2) Setelah pengode selesai:
   python validate.py evaluate --dir validasi [--gold validasi/adjudikasi.csv]

   → validasi/laporan_validasi.csv  (κ antar-pengode, presisi/recall/F1 mesin, ambang terbaik per kategori)
   → validasi/perbedaan_pengode.csv (butir yang perlu adjudikasi)
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import random
import sys
from collections import defaultdict

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))


def load_cats(path):
    cfg = yaml.safe_load(open(path, encoding="utf-8"))
    return list(cfg["categories"]), {k: v.get("label", k) for k, v in cfg["categories"].items()}, \
        float(cfg.get("min_score", 3))


# ---------------------------------------------------------------- statistik
def kappa(a, b):
    """Cohen's κ untuk dua vektor biner. None bila tak terdefinisi (kedua pengode konstan & sama)."""
    n = len(a)
    if n == 0:
        return None
    po = sum(x == y for x, y in zip(a, b)) / n
    pa, pb = sum(a) / n, sum(b) / n
    pe = pa * pb + (1 - pa) * (1 - pb)
    if pe >= 1:
        return None
    return (po - pe) / (1 - pe)


def prf(gold, pred):
    tp = sum(g and p for g, p in zip(gold, pred))
    fp = sum((not g) and p for g, p in zip(gold, pred))
    fn = sum(g and (not p) for g, p in zip(gold, pred))
    pr = tp / (tp + fp) if tp + fp else None
    rc = tp / (tp + fn) if tp + fn else None
    f1 = 2 * pr * rc / (pr + rc) if pr and rc else (0.0 if (pr is not None and rc is not None) else None)
    return tp, fp, fn, pr, rc, f1


def wilson(k, n, z=1.96):
    if not n:
        return (None, None)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0, c - h), min(1, c + h))


def landis(k):
    if k is None:
        return "tak terdefinisi"
    return ("buruk" if k < 0 else "sedikit" if k < .2 else "cukup" if k < .4 else "sedang"
            if k < .6 else "substansial" if k < .8 else "hampir sempurna")


# ---------------------------------------------------------------- sample
def cmd_sample(a):
    cats, labels, _ = load_cats(a.categories)
    recs, seen = [], set()
    for ln in open(a.inp, encoding="utf-8"):
        try:
            r = json.loads(ln)
        except ValueError:
            continue
        if r["url"] not in seen:
            seen.add(r["url"])
            recs.append(r)
    if not recs:
        sys.exit("Tidak ada artikel di " + a.inp)
    rng = random.Random(a.seed)
    # bertingkat per kategori utama (termasuk 'tanpa kategori') agar kategori jarang tetap terwakili
    strata = defaultdict(list)
    for r in recs:
        strata[r.get("primary") or "_none"].append(r)
    n = min(a.n, len(recs))
    per = max(1, n // len(strata))
    pick = []
    for k in sorted(strata):
        rng.shuffle(strata[k])
        pick += strata[k][:per]
    rest = [r for k in strata for r in strata[k][per:]]
    rng.shuffle(rest)
    pick += rest[: max(0, n - len(pick))]
    pick = pick[:n]
    rng.shuffle(pick)  # acak urutan agar pengode tak bisa menebak strata
    os.makedirs(a.out, exist_ok=True)
    head = ["id", "media", "published", "title", "url", "teks"] + [f"k_{c}" for c in cats] + ["catatan"]
    for i in (1, 2):
        with open(os.path.join(a.out, f"lembar_kode_pengode{i}.csv"), "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(head)
            for j, r in enumerate(pick, 1):
                teks = (r.get("body") or r.get("description") or "")[: a.chars]
                w.writerow([f"A{j:04d}", r["media"], r.get("published", ""), r["title"], r["url"], teks]
                           + [""] * len(cats) + [""])
    with open(os.path.join(a.out, "kunci_mesin.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["id", "url", "primary"] + [f"m_{c}" for c in cats] + [f"s_{c}" for c in cats])
        for j, r in enumerate(pick, 1):
            lab = set(r.get("labels", []))
            w.writerow([f"A{j:04d}", r["url"], r.get("primary") or ""] + [int(c in lab) for c in cats]
                       + [r.get("scores", {}).get(c, 0) for c in cats])
    with open(os.path.join(a.out, "panduan_kode.md"), "w", encoding="utf-8") as f:
        f.write("# Panduan pengodean\n\nIsi setiap kolom `k_*` dengan **1** bila artikel secara substansial membahas "
                "kategori itu, **0** bila tidak. Satu artikel boleh >1 kategori. Kodekan secara mandiri; jangan "
                "berdiskusi dan jangan membuka `kunci_mesin.csv` sebelum selesai. Teks dipotong; buka URL bila ragu.\n\n")
        for c in cats:
            f.write(f"- `k_{c}` — {labels[c]}: _(tulis definisi operasional di sini sebelum mulai)_\n")
    print(f"{len(pick)} artikel disampel dari {len(recs)} ({len(strata)} strata) → {a.out}/")


# ---------------------------------------------------------------- evaluate
def read_codes(path, cats):
    out = {}
    for row in csv.DictReader(open(path, encoding="utf-8-sig")):
        vals = {}
        for c in cats:
            v = (row.get(f"k_{c}") or "").strip()
            if v == "":
                vals = None
                break
            vals[c] = v in ("1", "ya", "y", "true", "x")
        if vals is not None:
            out[row["id"]] = vals
    return out


def cmd_evaluate(a):
    cats, labels, min_score = load_cats(a.categories)
    d = a.dir
    c1 = read_codes(os.path.join(d, "lembar_kode_pengode1.csv"), cats)
    p2 = os.path.join(d, "lembar_kode_pengode2.csv")
    c2 = read_codes(p2, cats) if os.path.exists(p2) else {}
    mach = {r["id"]: r for r in csv.DictReader(open(os.path.join(d, "kunci_mesin.csv"), encoding="utf-8-sig"))}
    gold_adj = read_codes(a.gold, cats) if a.gold else {}
    if not c1:
        sys.exit("Lembar pengode 1 belum terisi lengkap (baris dengan kolom k_* kosong diabaikan).")
    both = sorted(set(c1) & set(c2))
    # standar emas: adjudikasi > kesepakatan dua pengode > pengode 1 (bila hanya satu pengode)
    rows, diffs = [], []
    for c in cats:
        k12 = kappa([c1[i][c] for i in both], [c2[i][c] for i in both]) if both else None
        gold_ids, gold = [], []
        for i in sorted(set(c1) | set(gold_adj)):
            if i not in mach:
                continue
            if i in gold_adj:
                g = gold_adj[i][c]
            elif c2:
                if i not in c2 or c1[i][c] != c2[i][c]:
                    continue
                g = c1[i][c]
            else:
                g = c1[i][c]
            gold_ids.append(i)
            gold.append(g)
        pred = [mach[i][f"m_{c}"] == "1" for i in gold_ids]
        tp, fp, fn, pr, rc, f1 = prf(gold, pred)
        km = kappa(gold, pred)
        # sapuan ambang: label = skor >= t (aturan 'istilah kuat' sudah tercermin di skor terpotong)
        best_t, best_f = None, -1
        for t in [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20]:
            pt = [float(mach[i][f"s_{c}"] or 0) >= t for i in gold_ids]
            f = prf(gold, pt)[5]
            if f is not None and f > best_f:
                best_t, best_f = t, f
        lo, hi = wilson(tp, tp + fp)
        rows.append({
            "kategori": c, "label": labels[c], "n_emas": len(gold_ids), "positif_emas": sum(gold),
            "kappa_antar_pengode": _r(k12), "tafsir_kappa": landis(k12) if both else "",
            "n_dua_pengode": len(both), "kappa_mesin_vs_emas": _r(km),
            "TP": tp, "FP": fp, "FN": fn, "presisi": _r(pr), "presisi_CI95": f"{_r(lo)}–{_r(hi)}" if lo is not None else "",
            "recall": _r(rc), "F1": _r(f1), f"F1_pada_ambang_{min_score:g}": _r(f1),
            "ambang_terbaik": best_t, "F1_ambang_terbaik": _r(best_f if best_f >= 0 else None),
        })
        for i in both:
            if c1[i][c] != c2[i][c]:
                diffs.append([i, c, labels[c], int(c1[i][c]), int(c2[i][c])])
    out = os.path.join(d, "laporan_validasi.csv")
    with open(out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    with open(os.path.join(d, "perbedaan_pengode.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["id", "kategori", "label", "pengode1", "pengode2"])
        w.writerows(diffs)
    print(f"Pengode 1: {len(c1)} butir, pengode 2: {len(c2)} butir, keduanya: {len(both)}\n")
    print(f"{'Kategori':<44}{'κ antar':>8}{'P':>7}{'R':>7}{'F1':>7}{'n+':>5}  ambang*")
    for r in rows:
        print(f"{r['label'][:43]:<44}{_s(r['kappa_antar_pengode']):>8}{_s(r['presisi']):>7}{_s(r['recall']):>7}"
              f"{_s(r['F1']):>7}{r['positif_emas']:>5}  {r['ambang_terbaik']}")
    print("\n* ambang skor dengan F1 tertinggi pada sampel ini — rawan overfitting bila n+ kecil (< ~20).")
    print(f"Laporan: {out}\nButir berbeda antar-pengode ({len(diffs)}): {os.path.join(d, 'perbedaan_pengode.csv')}")
    flag = [r["label"] for r in rows if r["positif_emas"] < 10]
    if flag:
        print("Peringatan — < 10 contoh positif, metrik tidak stabil: " + "; ".join(flag))


def _r(x):
    return "" if x is None else round(x, 3)


def _s(x):
    return "–" if x == "" else f"{x:.2f}"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--categories", default=os.path.join(HERE, "config", "categories.yaml"))
    sp = ap.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("sample")
    s.add_argument("--in", dest="inp", default="output/articles.jsonl")
    s.add_argument("--n", type=int, default=200)
    s.add_argument("--seed", type=int, default=42)
    s.add_argument("--chars", type=int, default=1500, help="panjang teks di lembar kode")
    s.add_argument("--out", default="validasi")
    e = sp.add_parser("evaluate")
    e.add_argument("--dir", default="validasi")
    e.add_argument("--gold", help="lembar hasil adjudikasi (format sama dengan lembar kode)")
    a = ap.parse_args(argv)
    {"sample": cmd_sample, "evaluate": cmd_evaluate}[a.cmd](a)


if __name__ == "__main__":
    main()
