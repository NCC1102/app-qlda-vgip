@echo off
rem Mo App QLDA KCN Van Giang tren Edge/Chrome qua may chu cuc bo (localhost:8765).
rem Dong cua so nay = tat may chu.
cd /d "%~dp0"
where python >nul 2>nul || (echo Can cai Python 3 ^(python.org^) roi chay lai. & pause & exit /b 1)
start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:8765/index.html"
python -m http.server 8765 --bind 127.0.0.1
