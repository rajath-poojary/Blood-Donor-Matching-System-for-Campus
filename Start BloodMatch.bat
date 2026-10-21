@echo off
cd /d "%~dp0"
start "Campus Blood Match Server" /min cmd.exe /c "cd /d ""%~dp0"" && npm start"
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(20); do { try { Invoke-WebRequest -Uri 'http://127.0.0.1:5502/api/status' -TimeoutSec 1 -UseBasicParsing | Out-Null; exit 0 } catch { Start-Sleep -Milliseconds 300 } } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
    echo The server did not start. Make sure Node.js 18 or later is installed.
    pause
    exit /b 1
)
start "" "http://127.0.0.1:5502/"
