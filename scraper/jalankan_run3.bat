@echo off
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
title News Scraper RUN 3 - Network Society Indonesia

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

rem --- RUN 3: pengaturan tetap (tidak perlu mengisi apa pun) ---
rem Semua media di config\sources.yaml (nasional, daerah, islam), 1-31 Okt 2026,
rem maks. 60 artikel per media agar tidak ada satu media yang mendominasi.
set "ARGS=--since 2026-10-01 --until 2026-10-31 --max-per-source 60 --workers 6 --out output_run3"
echo.
echo RUN 3 - semua media, 1-31 Oktober 2026, maks. 60 artikel per media.
echo Perkiraan 30-60 menit. Biarkan jendela ini terbuka dan komputer tidak tidur.
echo Jika terhenti, jalankan file ini lagi: artikel yang sudah diambil tidak diunduh ulang.
echo.
echo Menjalankan: python run.py %ARGS%
echo (log lengkap juga disimpan di output_run3\log.txt)
echo.
"%VPY%" run.py %ARGS%
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo ============================================================
  echo  Program berhenti dengan error. Baca pesan di atas,
  echo  lalu kirim file ini ke Claude:
  echo    %~dp0output_run3\log.txt
  echo ============================================================
  start "" "%~dp0output_run3"
  pause & exit /b %RC%
)
echo ============================================================
echo  Selesai. File untuk SNA Explorer:
echo    %~dp0output_run3\sna_explorer.csv
echo  File lain di folder yang sama: articles.csv, kategori_ringkasan.csv, log.txt
echo ============================================================
start "" "%~dp0output_run3"
pause
