@echo off
REM Free port 5000 from any stale/previous server before starting a fresh one
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
python app.py
pause
