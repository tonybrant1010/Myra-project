@echo off
title Myra release 2026-07-22
cd /d "%~dp0"
tar -czf myra_backend_update_20260722_v2.tgz backend/server.py
echo Backend csomag kesz: myra_backend_update_20260722_v2.tgz
git add backend/server.py backend/requirements.txt backend/assets/fonts backend/tests/test_goals_checkin_report.py frontend/app/chat.tsx frontend/app/quiz-result.tsx frontend/app/welcome.tsx frontend/src/components/ContentBackground.tsx frontend/src/constants/docs/gdpr.ts frontend/src/constants/docs/terms.ts frontend/src/auth/AuthContext.tsx README.md
git commit -m "2026-07-22"
git push origin main
echo.
echo ---- GIT PUSH KESZ ----
cd /d "%~dp0frontend"
call npm run deploy
echo.
echo ---- VERCEL DEPLOY VEGE ----
pause
