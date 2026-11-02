"""Identifikasi kategori berbasis kamus (codebook) — multi-label, transparan, bisa disunting."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import yaml

_B = r"[^\w]"  # batas kata (\w mencakup huruf Unicode)


def _pattern(term: str) -> re.Pattern:
    body = r"\s+".join(re.escape(p) for p in term.lower().split())
    return re.compile(rf"(?:^|{_B}){body}(?={_B}|$)", re.IGNORECASE | re.UNICODE)


@dataclass
class Classification:
    relevant: bool
    relevance_hits: list[str]
    scores: dict[str, float]
    labels: list[str]
    primary: str | None
    matched: dict[str, list[str]] = field(default_factory=dict)
    jenis: str = "berita"  # "berita" atau "panduan_ibadah" (doa, niat, tata cara: bukan berita)


class CategoryClassifier:
    def __init__(self, path: str):
        cfg = yaml.safe_load(open(path, encoding="utf-8"))
        rel = cfg.get("relevance", {})
        self.min_rel = int(rel.get("min_terms", 1))
        self.rel_terms = [(t, _pattern(t)) for t in rel.get("terms", [])]
        # istilah lemah dihitung, tetapi tidak cukup sendirian (mis. "umat Katolik", "Kemenag", "PAN")
        self.rel_weak = set(rel.get("weak_terms", []))
        self.min_score = float(cfg.get("min_score", 3))
        # istilah ambigu: diabaikan bila teks memuat salah satu konteks pembatalnya (mis. PKB = pajak kendaraan)
        self.ambig = {t.lower(): [_pattern(x) for x in xs] for t, xs in (cfg.get("ambiguous") or {}).items()}
        nn = cfg.get("non_news_title")
        self.non_news = re.compile(nn, re.IGNORECASE) if nn else None
        self.cats: dict[str, dict] = {}
        for key, c in cfg["categories"].items():
            terms = []
            for w, lst in (c.get("terms") or {}).items():
                for t in lst:
                    terms.append((str(t), float(w), _pattern(str(t))))
            self.cats[key] = {"label": c.get("label", key), "terms": terms}

    def label_of(self, key: str) -> str:
        return self.cats[key]["label"]

    @staticmethod
    def _count(p: re.Pattern, text: str, cap: int = 3) -> int:
        n = 0
        for _ in p.finditer(text):
            n += 1
            if n >= cap:
                break
        return n

    def _ok(self, term: str, full: str) -> bool:
        return not any(p.search(full) for p in self.ambig.get(term, ()))

    def classify(self, title: str, body: str) -> Classification:
        title = (title or "").lower()
        full = f"{title}\n{(body or '').lower()}"
        hits = [t for t, p in self.rel_terms if p.search(full) and self._ok(t, full)]
        scores, matched = {}, {}
        for key, c in self.cats.items():
            s, m, strong = 0.0, [], False
            for term, w, p in c["terms"]:
                if term in self.ambig and not self._ok(term, full):
                    continue
                nb = self._count(p, full)
                if not nb:
                    continue
                nt = 1 if p.search(title) else 0
                s += w * (nb + nt)  # kemunculan di judul dihitung ganda
                m.append(term)
                strong |= w >= 2
            scores[key] = round(s, 2) if strong else min(round(s, 2), self.min_score - 0.01)
            if m:
                matched[key] = m
        # Kategori hanya dilabel bila ada >=1 istilah berbobot >=2 (istilah pendukung saja tidak cukup);
        # skornya dipotong tepat di bawah ambang.
        labels = [k for k, v in sorted(scores.items(), key=lambda kv: -kv[1]) if v >= self.min_score]
        jenis = "berita"
        if self.non_news and self.non_news.search(title.strip()):
            jenis, labels = "panduan_ibadah", []
        return Classification(
            relevant=len(hits) >= self.min_rel and any(h not in self.rel_weak for h in hits),
            relevance_hits=hits,
            scores=scores,
            labels=labels,
            primary=labels[0] if labels else None,
            matched=matched,
            jenis=jenis,
        )

    def prefilter(self, text: str) -> bool:
        """Saringan murah untuk judul/slug sebelum artikel diunduh."""
        t = (text or "").lower().replace("-", " ")
        return any(p.search(t) for _, p in self.rel_terms)
