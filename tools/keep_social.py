#!/usr/bin/env python3
"""Pertahankan baris media sosial saat artifact dibangun ulang dari data berita.

Pembaruan harian membangun artifact hanya dari hasil news scraper (platform "Media Online").
Skrip ini mengambil baris non-berita (X, Instagram, TikTok, Threads, YouTube, ...) dari versi
artifact yang sedang tayang dan menyisipkannya ke hasil build baru, beserta catatan metodenya.

  python3 tools/keep_social.py --baru index_auto.html --lama live.html --out index_auto.html

Tidak ada data yang ditulis ke repo; berkas HTML berada di working directory pemanggil.
"""
import argparse, csv, io, json, re, sys

PAT = re.compile(r'(<script>window\.REALDATA=)(.*?)(;?</script>)', re.S)
BERITA = {'media online', 'media', 'berita'}


def baca(path):
    t = open(path, encoding='utf-8').read()
    m = PAT.search(t)
    if not m:
        sys.exit('REALDATA tidak ditemukan di ' + path)
    return t, m, json.loads(m.group(2).rstrip(';'))


def rows_of(R):
    rd = csv.DictReader(io.StringIO(R.get('csv') or ''))
    return rd.fieldnames or [], list(rd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--baru', required=True)
    ap.add_argument('--lama', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    tb, mb, RB = baca(a.baru)
    _, _, RL = baca(a.lama)
    hb, rb = rows_of(RB)
    hl, rl = rows_of(RL)
    sos = [r for r in rl if (r.get('platform') or '').strip().lower() not in BERITA]
    if not sos:
        open(a.out, 'w', encoding='utf-8').write(tb)
        print(json.dumps({'sosmed_dipertahankan': 0}))
        return
    H = hb + [c for c in hl if c not in hb]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=H, extrasaction='ignore', lineterminator='\n')
    w.writeheader()
    for r in rb + sos:
        w.writerow({k: r.get(k, '') for k in H})
    RB['csv'] = buf.getvalue()
    ml = RL.get('meta') or ''
    i = ml.find('Media sosial')
    if i >= 0 and 'Media sosial' not in (RB.get('meta') or ''):
        RB['meta'] = (RB.get('meta') or '').rstrip() + ' ' + ml[i:]
    if '+ media sosial' not in (RB.get('title') or '') and 'media sosial' in (RL.get('title') or ''):
        RB['title'] = RL['title']
    if not RB.get('app') and RL.get('app'):
        RB['app'] = RL['app']
    js = json.dumps(RB, ensure_ascii=False).replace('</', '<\\/')
    out = tb[:mb.start()] + mb.group(1) + js + ';</script>' + tb[mb.end():]
    open(a.out, 'w', encoding='utf-8').write(out)
    cnt = {}
    for r in sos:
        cnt[r.get('platform')] = cnt.get(r.get('platform'), 0) + 1
    print(json.dumps({'sosmed_dipertahankan': len(sos), 'per_platform': cnt, 'berita': len(rb)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
