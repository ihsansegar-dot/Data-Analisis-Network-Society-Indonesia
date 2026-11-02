@echo off
rem Unduh ulang artikel Oktober + harian lama untuk mendapatkan TEKS PENUH (data lama tersimpan terpotong
rem 1.500 karakter), lalu klasifikasi ulang dengan kamus terkini. Hasil: output_penuh\. File lama tidak diubah.
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
title Unduh ulang teks penuh
if not exist ".venv\Scripts\python.exe" (
  echo Jalankan jalankan_scraper.bat sekali dulu.
  pause & exit /b 1
)
echo Mengunduh ulang sekitar 870 artikel, perkiraan 15-30 menit. Bisa dihentikan dan dilanjutkan.
".venv\Scripts\python.exe" run.py --refetch output_run3\articles.jsonl output_harian\articles.jsonl --out output_penuh --workers 6
echo.
echo Selesai. Hasil: output_penuh\articles.jsonl
pause
