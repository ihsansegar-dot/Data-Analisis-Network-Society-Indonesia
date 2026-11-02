import csv
import json
import os
import random
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import validate as V  # noqa: E402


def test_kappa_known_values():
    # contoh buku teks: po=0.7, pe=0.5 → κ=0.4
    a = [1] * 35 + [1] * 15 + [0] * 15 + [0] * 35
    b = [1] * 35 + [0] * 15 + [1] * 15 + [0] * 35
    assert abs(V.kappa(a, b) - 0.4) < 1e-9
    assert V.kappa([1, 1, 1], [1, 1, 1]) is None
    assert V.kappa([1, 0, 1, 0], [1, 0, 1, 0]) == 1.0
    try:
        from sklearn.metrics import cohen_kappa_score
        r = random.Random(1)
        x = [r.random() < .3 for _ in range(500)]
        y = [v if r.random() < .8 else not v for v in x]
        assert abs(V.kappa(x, y) - cohen_kappa_score(x, y)) < 1e-12
    except ImportError:
        pass


def test_prf():
    tp, fp, fn, p, r, f = V.prf([1, 1, 0, 0, 1], [1, 0, 1, 0, 1])
    assert (tp, fp, fn) == (2, 1, 1) and abs(p - 2 / 3) < 1e-9 and abs(r - 2 / 3) < 1e-9 and abs(f - 2 / 3) < 1e-9


def test_sample_and_evaluate_roundtrip():
    cats, _, _ = V.load_cats(os.path.join(ROOT, "config", "categories.yaml"))
    d = tempfile.mkdtemp()
    rng = random.Random(0)
    src = os.path.join(d, "articles.jsonl")
    with open(src, "w", encoding="utf-8") as f:
        for i in range(120):
            prim = rng.choice(cats + [None])
            scores = {c: (rng.choice([5, 9, 14]) if c == prim else rng.choice([0, 0, 1, 2])) for c in cats}
            f.write(json.dumps({"url": f"https://x/{i}", "media": "M", "title": f"t{i}", "body": "isi " * 50,
                                "primary": prim, "labels": [prim] if prim else [], "scores": scores}) + "\n")
    out = os.path.join(d, "val")
    V.main(["sample", "--in", src, "--n", "60", "--out", out])
    key = {r["id"]: r for r in csv.DictReader(open(os.path.join(out, "kunci_mesin.csv"), encoding="utf-8-sig"))}
    assert len(key) == 60
    sheet1 = list(csv.DictReader(open(os.path.join(out, "lembar_kode_pengode1.csv"), encoding="utf-8-sig")))
    assert not any(k.startswith(("m_", "s_")) or k == "primary" for k in sheet1[0])  # buta
    # pengode 1 = persis mesin; pengode 2 = mesin dengan 10% sel dibalik
    for i, noise in ((1, 0.0), (2, 0.1)):
        p = os.path.join(out, f"lembar_kode_pengode{i}.csv")
        rows = list(csv.DictReader(open(p, encoding="utf-8-sig")))
        for r in rows:
            for c in cats:
                v = key[r["id"]][f"m_{c}"] == "1"
                r[f"k_{c}"] = str(int(v if rng.random() >= noise else not v))
        with open(p, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
    V.main(["evaluate", "--dir", out])
    rep = list(csv.DictReader(open(os.path.join(out, "laporan_validasi.csv"), encoding="utf-8-sig")))
    assert len(rep) == len(cats)
    # emas = butir yang disepakati; pengode1 = mesin → mesin sempurna pada emas
    for r in rep:
        if int(r["positif_emas"]) > 0:
            assert float(r["presisi"]) == 1.0 and float(r["recall"]) == 1.0
    assert os.path.getsize(os.path.join(out, "perbedaan_pengode.csv")) > 40


def test_semicolon_csv_from_excel(tmp_path):
    cats, _, _ = V.load_cats(os.path.join(ROOT, "config", "categories.yaml"))
    p = tmp_path / "x.csv"
    p.write_text("﻿id;k_relevan;" + ";".join(f"k_{c}" for c in cats) + "\nA0001;1;" + ";".join("1" if i == 0 else "0" for i in range(len(cats))) + "\n",
                 encoding="utf-8")
    codes = V.read_codes(str(p), cats, with_rel=True)
    assert codes["A0001"][cats[0]] is True and codes["A0001"]["_rel"] is True
