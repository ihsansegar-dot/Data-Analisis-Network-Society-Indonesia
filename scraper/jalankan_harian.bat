@echo off
rem ==== Scraping harian otomatis (dijalankan oleh Windows Task Scheduler) ====
rem Mengambil berita 2 hari terakhir dari semua media di config\sources.yaml dan
rem MENGGABUNGKAN hasilnya ke output_harian\ (artikel yang sudah ada tidak diunduh ulang).
rem Tidak ada pertanyaan dan tidak ada "pause", agar bisa berjalan tanpa ditunggui.
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [%date% %time%] .venv belum ada. Jalankan jalankan_scraper.bat sekali secara manual. >> jadwal_harian.log
  exit /b 1
)
if not exist output_harian mkdir output_harian
echo [%date% %time%] mulai >> jadwal_harian.log
".venv\Scripts\python.exe" run.py --last-days 2 --max-per-source 30 --workers 6 --out output_harian > output_harian\terakhir.txt 2>&1
echo [%date% %time%] selesai, kode %ERRORLEVEL% >> jadwal_harian.log
exit /b 0
