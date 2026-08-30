@echo off
title Myra restart seged
taskkill /f /t /fi "WINDOWTITLE eq Myra backend*" >nul 2>&1
timeout /t 2 /nobreak >nul
cd /d "%~dp0backend"
start "Myra backend" cmd /k .venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8001
exit
