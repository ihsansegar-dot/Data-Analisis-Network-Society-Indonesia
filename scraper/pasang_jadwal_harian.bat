@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Pasang jadwal scraping harian
if not exist ".venv\Scripts\python.exe" (
  echo Jalankan jalankan_scraper.bat sekali dulu untuk menyiapkan Python, lalu jalankan file ini lagi.
  pause & exit /b 1
)
set "JAM=06:17"
set /p JAM=Jam scraping setiap hari, format HH:MM (bawaan 06:17): 
if not defined JAM set "JAM=06:17"
schtasks /Create /F /SC DAILY /ST %JAM% /TN "NSI News Scraper Harian" /TR "\"%~dp0jalankan_harian.bat\"" 
if errorlevel 1 (
  echo Gagal membuat jadwal. Coba klik kanan file ini lalu "Run as administrator".
  pause & exit /b 1
)
echo.
echo ============================================================
echo  Jadwal dibuat: setiap hari pukul %JAM%.
echo  - Komputer harus menyala dan Anda sedang login pada jam itu.
echo    Jika terlewat, jadwal berikutnya mengambil 2 hari terakhir,
echo    jadi satu hari terlewat tetap tertutup.
echo  - Hasil kumulatif: output_harian\sna_explorer.csv
echo  - Riwayat: jadwal_harian.log dan output_harian\log.txt
echo  - Mencoba sekarang: klik dua kali jalankan_harian.bat
echo  - Menghapus jadwal: klik dua kali hapus_jadwal_harian.bat
echo ============================================================
pause
