@echo off
cd /d "%~dp0"

echo Starting Lucid Detailing Cloudflare Tunnel...
cloudflared.exe tunnel --config "%~dp0config.yml" run lucid

pause