@echo off
title Myra frontend deploy - Vercel
cd /d "%~dp0frontend"
call npm run deploy
echo.
echo ---- DEPLOY VEGE ----
pause
