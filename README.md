<p align="center"><img src="assets/logo.webp" alt="Network Society Indonesia" height="64"></p>

# SNA Explorer — Data Analisis Network Society Indonesia

Aplikasi web untuk **analisis jaringan sosial (SNA) dan sentimen per platform** media sosial: TikTok, Instagram, X, YouTube, Threads, Facebook, dan Media Online. Seluruh aplikasi berjalan di browser dalam satu file (`index.html`), tanpa server; data tidak dikirim ke mana pun kecuali bila fitur klasifikasi Claude AI dipakai (lihat di bawah).

## Cara memakai

1. Buka `index.html` di browser (Chrome/Edge/Firefox terbaru). Data contoh **sintetis** dimuat otomatis.
2. Unggah CSV Anda lewat **Data** atau **Projects → + Add Projects**. Setiap CSV menjadi satu proyek; semua proyek di daftar digabung.
3. Pilih platform (tombol platform atau **Sources**), lalu jelajahi graf, tabel aktor, sentimen, dan entitas.
4. Ekspor hasil: **GEXF** (Gephi), **VOSviewer** (map/network/JSON), **Metrik CSV**, **Sentimen CSV**, **Entitas CSV**, atau **laporan PDF**.

Untuk publikasi daring, `index.html` bisa langsung dilayani lewat GitHub Pages (Settings → Pages → branch `main`, folder `/`).

## Format CSV

| Kolom | Wajib | Keterangan |
|---|---|---|
| `author` | ya | akun penulis/pelaku interaksi |
| `text` | dianjurkan | isi teks (dipakai untuk sentimen, entitas, mention, filter) |
| `type` | ya | `retweet`/`share`/`repost`, `reply`/`comment`/`komentar`, `like`/`reaksi`, `quote`, `tweet`/`post` |
| `target_user` | untuk interaksi | akun yang di-retweet/dibalas/disukai/dikutip (bila kosong, dicoba dari “RT @…”/“@…” di teks) |
| `created_at` | dianjurkan | tanggal/waktu (untuk filter tanggal & tren) |
| `platform` | opsional | TikTok, Instagram, X/Twitter, YouTube, Threads, Facebook, Media Online |
| `sentiment` | opsional | label manual/model (positif/negatif/netral) untuk validasi |
| `account_type` / `node_type` | opsional | tipe akun (pribadi/person, media/news, organisasi) |
| `location`, `place`, `organisasi`, `term`, `hashtags` | opsional | dipakai sebagai entitas |

Template tersedia lewat tombol **Template CSV** di aplikasi.

## Fitur utama

- **Jaringan per platform** (akun tidak digabung lintas platform): Retweet/Share, Reply/Komentar, Like, Mention, Co-occurrence (Named Entity, Hashtag), Quote (Account, Media → Named Entity, Term, Hashtag).
- **Metrik**: in/out-degree berbobot, betweenness (Brandes), PageRank, komunitas Louvain, densitas, resiprositas, komponen.
- **Node Types**: Account, Person, News Site, Organisasi, Lokasi, Tempat/Place, Term, #Hashtag — dengan bentuk node berbeda dan daftar centang tampil/sembunyi.
- **VOSviewer**: metode graf Force-Directed/VOS, normalisasi Association strength/None, Quick Settings (Account, Account-Topic, Actor-Topic, Cooccurrence), ekspor map/network/JSON.
- **Sentimen**: leksikon bawaan (negasi, penguat, kontras, emoji), leksikon unggahan, label kolom CSV, atau klasifikasi Claude AI (hanya saat dibuka di Claude); word cloud kata positif/negatif/netral; aktor positif/negatif/netral; validasi manual (akurasi, Cohen’s κ, P/R/F1) dengan interval kepercayaan Wilson.
- **Filter**: rentang tanggal, filter teks Boolean (`"frasa" OR kata -kecuali vaksin*`), fokus entitas.

## Struktur repositori

```
index.html          aplikasi siap pakai (hasil build, mandiri)
src/app.html        kerangka HTML/CSS + logika utama
src/core.js         parsing CSV, graf, metrik, Louvain, normalisasi, GEXF
src/sentiment.js    pemberi skor sentimen berbasis leksikon
src/feat.js         klasifikasi Claude AI, panel validasi
src/ui2.js          panel interaktif (aktor kunci, sentimen, word cloud, komentar)
src/ent.js          Node Types, entitas, Edge/Link Types
src/vos.js          VOSviewer: layout VOS, ukuran node, ekspor
src/proj.js         Projects, Sources, filter Boolean
src/pdf2.js         laporan PDF
assets/logo.webp    logo Network Society Indonesia
build.js            menyusun index.html dari src/
tests/              verifikasi metrik terhadap NetworkX
```

## Build & verifikasi

```bash
npm install          # d3 7.8.5 & jsPDF 2.5.1 (ditanam ke index.html)
npm run build        # menulis ulang index.html dari src/
pip install networkx
npm run verify       # membandingkan PageRank, betweenness, in-degree dengan NetworkX
```

## Catatan metode & keterbatasan

- **Betweenness** dihitung tanpa bobot (jumlah langkah) dan dinormalisasi 1/((n−1)(n−2)); untuk >4.000 node diaproksimasi dari 1.000 sumber. **PageRank** berbobot, α = 0,85. Keduanya setara NetworkX (lihat `tests/`).
- **Louvain** berjalan pada proyeksi tak berarah dan bergantung seed; dengan normalisasi *association strength* (s<sub>ij</sub> = 2m·c<sub>ij</sub>/(w<sub>i</sub>w<sub>j</sub>)) bobot ternormalisasi dipakai untuk klaster & layout, bukan untuk centrality.
- **Layout VOS** adalah pendekatan fungsi tujuan VOSviewer (attraction 2, repulsion 1), bukan implementasi identik; klaster memakai Louvain, bukan algoritma VOS/Leiden. Untuk peta final, impor ekspor VOSviewer ke VOSviewer.
- **Leksikon sentimen bawaan belum divalidasi**; gunakan validasi manual atau label model (mis. IndoBERT) sebelum menarik kesimpulan substantif. Sentimen entitas = sentimen teks yang menyebutnya, bukan sentimen yang pasti ditujukan kepadanya.
- **Co-occurrence** menunjukkan kemunculan bersama, bukan hubungan semantik. Jaringan **Like** hanya dapat dibentuk bila data mencatat akun yang menyukai.
- Penggabungan proyek tidak menghapus duplikat lintas file. Filter teks/entitas membuang baris tanpa teks (mis. like/share).
- **Klasifikasi Claude AI** mengirim teks komentar ke Claude dan memakai kuota akun Claude pengguna; fitur ini hanya aktif saat aplikasi dibuka sebagai artifact di Claude.

## Lisensi

Belum ditentukan oleh pemilik repositori.

---

Dikembangkan untuk **Network Society Indonesia**.
