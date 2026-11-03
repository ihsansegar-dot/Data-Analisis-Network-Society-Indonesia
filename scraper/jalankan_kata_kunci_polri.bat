@echo off
rem Scraping MODE KATA KUNCI: Penyadapan, POLRI, Kepolisian, Polisi - sejak 3 November 2026 sampai hari ini.
rem Semua media di config\sources.yaml, maks. 100 artikel per media, hasil di output_polri\.
rem Bisa dihentikan dan dijalankan lagi: artikel yang sudah diambil tidak diunduh ulang.
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
title Scraping kata kunci POLRI / Penyadapan
if not exist ".venv\Scripts\python.exe" (
  echo Jalankan jalankan_scraper.bat sekali dulu.
  pause & exit /b 1
)
echo Kata kunci: Penyadapan, POLRI, Kepolisian, Polisi. Sejak 2026-11-03. Perkiraan 15-30 menit.
".venv\Scripts\python.exe" run.py --keywords "Penyadapan,POLRI,Kepolisian,Polisi" --since 2026-11-03 --max-per-source 100 --workers 6 --out output_polri
echo.
echo Selesai. File untuk SNA Explorer: %~dp0output_polri\sna_explorer.csv
pause
