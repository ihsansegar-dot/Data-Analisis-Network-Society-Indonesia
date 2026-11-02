@echo off
chcp 65001 >nul
schtasks /Delete /F /TN "NSI News Scraper Harian"
if errorlevel 1 (echo Jadwal tidak ditemukan atau gagal dihapus.) else (echo Jadwal scraping harian dihapus.)
pause
