@echo off
title Myra backend csomag keszitese
cd /d "%~dp0"
tar -czf myra_backend_update_20260722.tgz backend/server.py backend/requirements.txt backend/assets/fonts/Manrope_400Regular.ttf backend/assets/fonts/Manrope_600SemiBold.ttf backend/assets/fonts/Manrope_700Bold.ttf backend/tests/test_goals_checkin_report.py
echo.
echo ---- A csomag tartalma: ----
tar -tzf myra_backend_update_20260722.tgz
echo.
echo Kesz: myra_backend_update_20260722.tgz
pause
