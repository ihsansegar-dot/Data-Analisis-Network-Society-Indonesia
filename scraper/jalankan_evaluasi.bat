@echo off
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
title Evaluasi validasi kategori
if not exist ".venv\Scripts\python.exe" (
  echo Jalankan jalankan_scraper.bat sekali dulu untuk menyiapkan Python.
  pause & exit /b 1
)
if not exist "validasi\lembar_kode_pengode1.csv" (
  echo Folder validasi belum ada. Buat dulu dengan: python validate.py sample
  pause & exit /b 1
)
set "GOLD="
if exist "validasi\adjudikasi.csv" set "GOLD=--gold validasi\adjudikasi.csv"
".venv\Scripts\python.exe" validate.py evaluate --dir validasi %GOLD%
echo.
echo Laporan: validasi\laporan_validasi.csv   Butir beda pengode: validasi\perbedaan_pengode.csv
start "" "%~dp0validasi"
pause
