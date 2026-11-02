"""Keluaran: JSONL (lengkap), CSV artikel, ringkasan kategori × media, CSV untuk SNA Explorer."""
from __future__ import annotations

import csv
import json
import os
import threading
from collections import Counter, defaultdict


class Store:
    def __init__(self, out_dir: str, classifier):
        os.makedirs(out_dir, exist_ok=True)
        self.dir = out_dir
        self.clf = classifier
        self.lock = threading.Lock()
        self.jsonl = os.path.join(out_dir, "articles.jsonl")
        self.seen_path = os.path.join(out_dir, "seen_urls.txt")
        self.seen = set()
        if os.path.exists(self.seen_path):
            self.seen = {ln.strip() for ln in open(self.seen_path, encoding="utf-8") if ln.strip()}

    def is_seen(self, url: str) -> bool:
        return url in self.seen

    def mark_seen(self, url: str):
        with self.lock:
            if url not in self.seen:
                self.seen.add(url)
                with open(self.seen_path, "a", encoding="utf-8") as f:
                    f.write(url + "\n")

    def add(self, rec: dict):
        with self.lock, open(self.jsonl, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def load(self) -> list[dict]:
        if not os.path.exists(self.jsonl):
            return []
        recs, keys = [], set()
        for ln in open(self.jsonl, encoding="utf-8"):
            try:
                r = json.loads(ln)
            except ValueError:
                continue
            if r["url"] not in keys:
                keys.add(r["url"])
                recs.append(r)
        return recs

    def write_tables(self, include_unlabeled: bool = False) -> dict:
        recs = self.load()
        cats = list(self.clf.cats)
        # 1) artikel
        p1 = os.path.join(self.dir, "articles.csv")
        with open(p1, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["media", "domain", "group", "published", "title", "url", "author", "section",
                        "n_words", "jenis", "kategori_utama", "kategori", "istilah_cocok", "konteks_islam"]
                       + [f"skor_{c}" for c in cats] + ["ringkasan"])
            for r in recs:
                w.writerow([r["media"], r["domain"], r.get("group", ""), r["published"], r["title"], r["url"],
                            r["author"], r["section"], r["n_words"], r.get("jenis", "berita"),
                            self.clf.label_of(r["primary"]) if r["primary"] else "",
                            "; ".join(self.clf.label_of(k) for k in r["labels"]),
                            " | ".join(f"{k}: {', '.join(v)}" for k, v in r["matched"].items()),
                            ", ".join(r["relevance_hits"][:10])]
                           + [r["scores"].get(c, 0) for c in cats]
                           + [(r["description"] or r["body"][:300])])
        # 2) ringkasan kategori × media (multi-label: satu artikel bisa dihitung di >1 kategori)
        per = defaultdict(Counter)
        prim = Counter()
        media = sorted({r["media"] for r in recs})
        for r in recs:
            for k in r["labels"]:
                per[k][r["media"]] += 1
            if r["primary"]:
                prim[r["primary"]] += 1
        p2 = os.path.join(self.dir, "kategori_ringkasan.csv")
        with open(p2, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["kategori", "label", "jumlah_artikel_multilabel", "jumlah_sebagai_utama"] + media)
            for k in cats:
                w.writerow([k, self.clf.label_of(k), sum(per[k].values()), prim[k]] + [per[k][m] for m in media])
            w.writerow(["(tanpa_kategori)", "Relevan tapi di bawah ambang", sum(1 for r in recs if not r["labels"]), "", ]
                       + [sum(1 for r in recs if not r["labels"] and r["media"] == m) for m in media])
        # 3) CSV untuk SNA Explorer (Media Online). term = kategori utama → node Term & Quote Media→Term.
        p3 = os.path.join(self.dir, "sna_explorer.csv")
        with open(p3, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["author", "text", "type", "target_user", "created_at", "platform", "atype", "term", "url"])
            for r in recs:
                if r.get("jenis", "berita") != "berita":
                    continue
                if not r["labels"] and not include_unlabeled:
                    continue
                lead = (r["description"] or r["body"])[:400]
                w.writerow([r["media"], f'{r["title"]}. {lead}'.strip(), "post", "", r["published"],
                            "Media Online", "news",
                            ";".join(self.clf.label_of(k) for k in r["labels"]), r["url"]])
        return {"articles": p1, "summary": p2, "sna": p3, "jsonl": self.jsonl, "n": len(recs)}
