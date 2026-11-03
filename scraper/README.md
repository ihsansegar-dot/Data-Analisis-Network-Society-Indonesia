# News Scraper — Identifikasi Kategori Keislaman & Politik (Scrapling)

Scraper berita online Indonesia berbasis [Scrapling](https://github.com/D4Vinci/Scrapling). Artikel diklasifikasikan
(multi-label) ke 11 kategori:

| Kode | Kategori |
|---|---|
| identitas_keislaman | Identitas keislaman |
| politik_umat | Politik umat |
| moralitas_kepemimpinan_islam | Moralitas dan kepemimpinan Islam |
| nasionalisme_religius | Nasionalisme religius |
| moderasi_beragama | Moderasi beragama |
| ekonomi_umat | Ekonomi umat |
| pendidikan_sosial_keagamaan | Pendidikan dan sosial keagamaan |
| keadilan_sosial | Keadilan sosial |
| politik_kebijakan_publik | Politik kebijakan publik |
| representasi_ulama_otoritas | Representasi ulama dan otoritas keagamaan |
| partai_islam | Partai Islam |

## Instalasi

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
scrapling install        # opsional: unduh browser untuk mode --stealth / fallback anti-bot
```

## Windows: cara paling mudah

Klik dua kali `jalankan_scraper.bat`. Pada percobaan pertama, file ini membuat lingkungan Python dan memasang
Scrapling. Setelah itu ia menanyakan tanggal, media, dan batas artikel, lalu membuka folder `output\` setelah selesai.
Python 3.10 atau lebih baru harus sudah terpasang.

## Pemakaian

```bash
# semua media di config/sources.yaml, 7 hari terakhir
python run.py

# rentang tanggal tertentu
python run.py --since 2026-10-01 --until 2026-10-31

# hanya media tertentu / grup tertentu
python run.py --sources republika.co.id,detik.com,nu.or.id --max-per-source 100
python run.py --group islam

# cakupan penuh (unduh semua kandidat, bukan hanya yang judul/slug-nya relevan) — jauh lebih lambat
python run.py --no-prefilter
```

Opsi lain: `--delay` (jeda per domain, default 2,5 detik), `--workers` (domain paralel, default 6),
`--stealth` (pakai browser untuk semua permintaan), `--keep-body` (simpan teks lengkap),
`--include-unlabeled`, `--out`, `-v`. Jalankan ulang dengan `--out` yang sama untuk melanjutkan; URL yang
sudah diproses dicatat di `seen_urls.txt`.

## Menjalankan di GitHub (tanpa instal apa pun)

1. Buka repo di GitHub, lalu tab **Actions**, lalu **News Scraper**, lalu **Run workflow**.
2. Isi domain, rentang tanggal, dan batas artikel, lalu klik **Run workflow**.
3. Setelah selesai, buka run tersebut. Ringkasan per media dan per kategori tampil di halaman run, dan
   tabelnya dapat diunduh dari **Artifacts** (`hasil-scraping-N`, disimpan 7 hari).

Catatan:
- Repo ini publik, jadi artefak dapat diunduh pengguna GitHub lain yang login. Karena itu `articles.jsonl` yang
  berisi teks artikel tidak diunggah; yang diunggah hanya tabel dengan judul dan cuplikan.
- Server GitHub berada di luar Indonesia dan memakai IP pusat data, sehingga sebagian media mungkin memblokir.
  Bila sebuah media selalu `kandidat=0` atau `gagal` tinggi di GitHub, jalankan untuk media itu dari komputer lokal.
- Setiap push ke `scraper/` otomatis menjalankan uji.

## Scraping otomatis harian (Windows)

1. Pastikan `jalankan_scraper.bat` sudah pernah dijalankan sekali (menyiapkan Python dan Scrapling).
2. Klik dua kali `pasang_jadwal_harian.bat` dan isi jamnya (bawaan 06:17). File ini membuat tugas Windows Task Scheduler
   bernama "NSI News Scraper Harian".
3. Setiap hari pada jam itu, `jalankan_harian.bat` mengambil berita **2 hari terakhir** dari semua media (maks. 30 artikel
   baru per media per hari) dan menggabungkannya ke `output_harian\`. Artikel yang sudah ada tidak diunduh ulang, dan
   `output_harian\sna_explorer.csv` selalu berisi seluruh hasil kumulatif.
4. Riwayat jalannya jadwal ada di `jadwal_harian.log`; keluaran run terakhir ada di `output_harian\terakhir.txt`.
5. Untuk menghentikan, klik dua kali `hapus_jadwal_harian.bat`.

Komputer harus menyala dan pengguna sedang login pada jam yang dijadwalkan. Karena setiap run mengambil 2 hari, satu hari
yang terlewat tetap tertutup oleh run berikutnya; lebih dari itu perlu dijalankan manual dengan `--since/--until`.

## Mode kata kunci (topik di luar kategori keislaman)

```bash
python run.py --keywords "Penyadapan,POLRI,Kepolisian,Polisi" --since 2026-10-03 --max-per-source 100 --out output_polri
```

Artikel disimpan bila memuat salah satu kata kunci (kata utuh, tidak peka huruf besar/kecil); gerbang relevansi
keislaman dan 11 kategori tidak dipakai. Setiap kata kunci menjadi label, sehingga di `sna_explorer.csv` kolom `term`
berisi kata kunci yang ditemukan. Varian imbuhan dipakai untuk kata kunci yang dikenal (Penyadapan → menyadap, disadap,
sadap, penyadap, sadapan); `--exact-keywords` mematikannya. Peluncur Windows: `jalankan_kata_kunci_polri.bat`.

## Alur kerja

1. **Penemuan URL**: baris `Sitemap:` di robots.txt, lalu lokasi sitemap umum (news sitemap diutamakan),
   lalu feed RSS/Atom yang dideteksi dari beranda. Sitemap indeks yang lebih tua dari `--since` dilewati.
2. **Prefilter**: kandidat hanya diunduh bila judul (dari news sitemap/RSS) atau path URL memuat istilah konteks keislaman.
3. **Pengambilan**: `FetcherSession(impersonate="chrome")` dengan jeda per domain dan pengecekan robots.txt;
   bila HTTP 403/429/503, dicoba ulang dengan `StealthyFetcher`.
4. **Ekstraksi**: JSON-LD `NewsArticle`, lalu meta OpenGraph, lalu heuristik kontainer dengan teks `<p>` terbanyak.
   Paragraf "Baca juga" dan sejenisnya dibuang.
5. **Gerbang relevansi**: minimal 2 istilah konteks keislaman (`relevance` di `config/categories.yaml`).
6. **Klasifikasi**: skor = Σ bobot × (jumlah kemunculan, maksimal 3) + bonus judul. Label diberikan bila skor ≥ 3
   **dan** ada minimal satu istilah berbobot ≥ 2. Kategori utama adalah kategori dengan skor tertinggi.

## Keluaran (`output/`)

| File | Isi |
|---|---|
| `articles.jsonl` | Rekaman lengkap: metadata, teks, skor semua kategori, istilah yang cocok |
| `articles.csv` | Tabel artikel: media, tanggal, judul, URL, kategori utama, semua label, istilah cocok, skor |
| `kategori_ringkasan.csv` | Jumlah artikel per kategori × media (multi-label dan sebagai kategori utama) |
| `sna_explorer.csv` | Siap diunggah ke **SNA Explorer**: `author` = media, `platform` = Media Online, `term` = kategori |

Di SNA Explorer, aktifkan Node Type **Term** dan Link Type **Quote → Media–Term** untuk melihat jaringan media ↔ kategori.

## Menyunting kategori

Ubah `config/categories.yaml`: istilah per bobot (3 = sangat khas, 2 = khas, 1 = pendukung), `min_score`, dan
`relevance.min_terms`. Istilah dicocokkan sebagai kata utuh, sehingga `pan` tidak cocok dengan "panen" atau "pangan".
Singkatan ambigu sengaja tidak dipakai. Contohnya `pbb` (bisa berarti PBB/UN, Pajak Bumi dan Bangunan, atau
Partai Bulan Bintang); yang dipakai adalah "partai bulan bintang".

## Validasi kategori (wajib sebelum klaim penelitian)

```bash
# 1) sampel bertingkat 200 artikel + lembar kode buta untuk 2 pengode
python validate.py sample --in output/articles.jsonl --n 200 --out validasi
# 2) dua pengode mengisi kolom k_* (1/0) secara mandiri di lembar_kode_pengode1.csv dan _pengode2.csv
#    (lengkapi definisi operasional di validasi/panduan_kode.md lebih dulu)
# 3) hitung metrik
python validate.py evaluate --dir validasi
# 4) opsional: adjudikasi butir di perbedaan_pengode.csv, simpan sebagai adjudikasi.csv, lalu
python validate.py evaluate --dir validasi --gold validasi/adjudikasi.csv
```

`laporan_validasi.csv` berisi, per kategori:
- κ antar-pengode (tafsir Landis & Koch)
- presisi (dengan CI 95% Wilson), recall, F1, dan κ mesin terhadap standar emas
- ambang skor dengan F1 tertinggi

Standar emas dipilih dengan urutan: adjudikasi, lalu butir yang disepakati kedua pengode, lalu pengode 1 bila
hanya ada satu pengode. Memakai hanya butir yang disepakati membuat metrik mesin sedikit **optimistis**, karena
butir sulit tersisih; adjudikasi menghilangkan bias ini. Sampel bertingkat menurut kategori utama mesin
memastikan kategori jarang tetap terwakili. Akibatnya, presisi dan recall di sampel ini tidak sama dengan
prevalensi di korpus. Ambang "terbaik" rawan overfitting bila contoh positifnya sedikit, jadi uji ulang pada
sampel baru sebelum mengubah `min_score`.

## Keterbatasan — baca sebelum memakai hasilnya

- **Klasifikasi berbasis kamus, belum tervalidasi.** Hasilnya adalah indikasi awal, bukan pengodean final. Sebelum
  dipakai untuk klaim penelitian, ambil sampel acak (mis. 200 artikel), kodekan secara manual oleh ≥ 2 pengode,
  hitung κ (Cohen) dan presisi/recall per kategori, lalu revisi kamus. Kategori yang abstrak
  (moralitas, nasionalisme religius, keadilan sosial) paling rawan salah.
- **Tumpang tindih istilah**: frasa dan singkatannya bisa sama-sama terhitung ("partai keadilan sejahtera" + "pks"),
  sehingga skor lebih tinggi daripada jumlah konsep yang sebenarnya. Ini memengaruhi peringkat, tetapi jarang
  mengubah label.
- **"Seluruh media" tidak harfiah.** Cakupannya adalah daftar di `config/sources.yaml` (±33 media).
  Tambahkan media lain dengan `name`, `domain`, `group`, dan opsional `sitemaps`, `rss`, `stealth: true`.
- **Struktur situs berubah.** Sitemap atau feed yang tidak ditemukan membuat media tersebut menghasilkan 0 kandidat.
  Lihat ringkasan per media di akhir proses, lalu isi `sitemaps:`/`rss:` secara manual bila perlu.
- **Prefilter mengorbankan recall.** Artikel relevan yang judul dan URL-nya tidak memuat istilah keislaman akan
  terlewat. Gunakan `--no-prefilter` untuk korpus penelitian.
- **Etika & hukum**: robots.txt dihormati secara default, dan ada jeda antar-permintaan. Teks berita dilindungi hak
  cipta, jadi simpan untuk analisis dan jangan sebarkan ulang teks lengkapnya. Secara default teks dipotong
  1.500 karakter; `--keep-body` hanya untuk analisis internal. Periksa juga ketentuan layanan tiap media.

## Uji

```bash
pip install pytest && python -m pytest -q tests      # 7 uji: scraper + statistik validasi
```

Uji berjalan offline: sesi palsu menyajikan fixture (robots.txt, sitemap indeks, news sitemap, RSS, 4 artikel)
sebagai objek `Response` Scrapling asli. Yang diuji: penghormatan robots.txt, filter tanggal/domain/tag, ekstraksi
JSON-LD + heuristik, klasifikasi, prefilter, resume, dan format CSV.
