@echo off
rem Scraping kata kunci POLRI/Penyadapan KHUSUS tanggal 4 November 2026 (dijalankan otomatis 5 Nov 05:17).
rem Hasil digabung ke output_polri\ (artikel yang sudah ada tidak diunduh ulang). Tanpa pertanyaan/pause.
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
echo [%date% %time%] mulai 4 Nov >> output_polri\jadwal_polri.log
".venv\Scripts\python.exe" run.py --keywords "Penyadapan,POLRI,Kepolisian,Polisi" --since 2026-11-04 --until 2026-11-04 --max-per-source 100 --workers 6 --out output_polri > output_polri\terakhir_4nov.txt 2>&1
echo [%date% %time%] selesai 4 Nov, kode %ERRORLEVEL% >> output_polri\jadwal_polri.log
