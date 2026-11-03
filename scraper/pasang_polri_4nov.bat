@echo off
rem Mendaftarkan jalankan_polri_4nov.bat untuk berjalan SEKALI pada 05/11/2026 pukul 05:17.
chcp 65001 >nul
cd /d "%~dp0"
schtasks /Create /F /SC ONCE /SD 05/11/2026 /ST 05:17 /TN "NSI Scraper POLRI 4 Nov" /TR "\"%~dp0jalankan_polri_4nov.bat\"" > pasang_polri_4nov.log 2>&1
echo kode %ERRORLEVEL% >> pasang_polri_4nov.log
schtasks /Query /TN "NSI Scraper POLRI 4 Nov" /V /FO LIST >> pasang_polri_4nov.log 2>&1
