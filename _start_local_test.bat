@echo off
title Myra local inditas
cd /d "%~dp0backend"
echo [1/3] fpdf2 ellenorzese a backend venv-ben...
.venv\Scripts\python.exe -c "import fpdf" 2>nul
if errorlevel 1 .venv\Scripts\pip.exe install fpdf2==2.8.7
echo [2/3] Backend inditasa: http://127.0.0.1:8001
start "Myra backend" cmd /k .venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8001
cd /d "%~dp0frontend"
echo [3/3] Frontend inditasa: http://localhost:8081
start "Myra frontend" cmd /k call _start_frontend.bat
echo Varakozas a frontendre (kb. 25 mp), utana nyilik a bongeszo...
timeout /t 25 /nobreak >nul
start http://localhost:8081
exit
