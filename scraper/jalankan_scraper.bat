@echo off
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
title News Scraper - Network Society Indonesia

rem --- cari Python 3.10+ ---
set "PY="
py -3 --version >nul 2>&1 && set "PY=py -3"
if not defined PY ( python --version >nul 2>&1 && set "PY=python" )
if not defined PY (
  echo Python tidak ditemukan. Pasang Python 3.10 atau lebih baru dari https://www.python.org/downloads/
  echo Centang "Add python.exe to PATH" saat instalasi, lalu jalankan file ini lagi.
  pause & exit /b 1
)
%PY% -c "import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)" || (
  echo Versi Python terlalu lama. Dibutuhkan 3.10 atau lebih baru.
  pause & exit /b 1
)

rem --- lingkungan virtual + dependensi (hanya pertama kali) ---
if not exist ".venv\Scripts\python.exe" (
  echo Menyiapkan lingkungan Python, mohon tunggu...
  %PY% -m venv .venv || (pause & exit /b 1)
)
set "VPY=.venv\Scripts\python.exe"
if not exist ".venv\.terpasang" (
  echo Memasang Scrapling dan dependensi, sekali saja, beberapa menit...
  "%VPY%" -m pip install -q --upgrade pip
  "%VPY%" -m pip install -q -r requirements.txt || (echo Gagal memasang dependensi. & pause & exit /b 1)
  echo ok> ".venv\.terpasang"
)
if not exist ".venv\.browser" (
  echo Memasang browser untuk situs yang memblokir scraper, sekali saja, bisa beberapa menit...
  ".venv\Scripts\scrapling.exe" install && echo ok> ".venv\.browser"
  if not exist ".venv\.browser" echo Browser gagal dipasang; situs yang memblokir akan dilewati.
)

rem --- parameter ---
echo.
echo Kosongkan lalu tekan Enter untuk memakai nilai bawaan.
set "SINCE="
set /p SINCE=Tanggal mulai  (mis. 2026-10-01, bawaan 7 hari terakhir): 
set "UNTIL="
set /p UNTIL=Tanggal akhir  (mis. 2026-10-31, bawaan hari ini): 
set "SOURCES="
set /p SOURCES=Media (domain dipisah koma, bawaan semua 33 media): 
if defined SOURCES set "SOURCES=%SOURCES: =%"
set "MAXN=50"
set /p MAXN=Maks. artikel per media (bawaan 50): 
if not defined MAXN set "MAXN=50"

set "ARGS=--max-per-source %MAXN% --out output"
if defined SINCE set "ARGS=%ARGS% --since %SINCE%"
if defined UNTIL set "ARGS=%ARGS% --until %UNTIL%"
if defined SOURCES set "ARGS=%ARGS% --sources %SOURCES%"

echo.
echo Menjalankan: python run.py %ARGS%
echo (log lengkap juga disimpan di output\log.txt)
echo.
"%VPY%" run.py %ARGS%
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo ============================================================
  echo  Program berhenti dengan error. Baca pesan di atas,
  echo  lalu kirim file ini ke Claude:
  echo    %~dp0output\log.txt
  echo ============================================================
  start "" "%~dp0output"
  pause & exit /b %RC%
)
echo ============================================================
echo  Selesai. File untuk SNA Explorer:
echo    %~dp0output\sna_explorer.csv
echo  File lain di folder yang sama: articles.csv, kategori_ringkasan.csv, log.txt
echo ============================================================
start "" "%~dp0output"
pause
