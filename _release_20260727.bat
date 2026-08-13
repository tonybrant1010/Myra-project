@echo off
setlocal
title Myra release 2026-07-27 - biztonsagi javitasok
cd /d "%~dp0"

set PKG=myra_backend_update_20260727.tgz

echo ============================================================
echo  MYRA RELEASE 2026-07-27 - biztonsagi javitasok
echo ============================================================
echo.
echo  FONTOS: a frontend es a backend EGYUTT megy ki.
echo  A /api/auth/reset-password mostantol kotelezoen keri az
echo  email mezot - regi frontenddel a jelszo-visszaallitas eltorik.
echo.
echo  A Supabase migracio MAR le lett futtatva (2026-07-27).
echo.
echo ============================================================
choice /c IN /m "Indulhat a kiadas? (I=igen, N=nem)"
if errorlevel 2 goto :megse
echo.

rem ---------------------------------------------------------------- 1
echo [1/6] Backend tesztek futtatasa...
cd /d "%~dp0backend"
set JWT_SECRET=test-jwt-secret-at-least-32-chars-long-security-pipeline
set DATABASE_URL=sqlite+aiosqlite:///:memory:
set ENVIRONMENT=development
set DISABLE_RAG_STARTUP_WARMUP=true
.venv\Scripts\python.exe -m pytest tests/ -q
if errorlevel 1 goto :teszthiba
set JWT_SECRET=
set DATABASE_URL=
set ENVIRONMENT=
cd /d "%~dp0"
echo.

rem ---------------------------------------------------------------- 2
echo [2/6] Frontend ellenorzesek...
cd /d "%~dp0frontend"
call npm run typecheck
if errorlevel 1 goto :fronthiba
node --check scripts/patch-dist.js
if errorlevel 1 goto :fronthiba
cd /d "%~dp0"
echo.

rem ---------------------------------------------------------------- 3
echo [3/6] Backend csomag keszitese...
if exist "%PKG%" del /q "%PKG%"
tar -czf "%PKG%" ^
  backend/server.py ^
  backend/tests/conftest.py ^
  backend/tests/test_security.py ^
  backend/tests/test_account_deletion_and_reset.py
if errorlevel 1 goto :csomaghiba
tar -tzvf "%PKG%"
echo.

rem ---------------------------------------------------------------- 4
echo [4/6] Git commit es push...
git add ^
  backend/server.py ^
  backend/tests/conftest.py ^
  backend/tests/test_security.py ^
  backend/tests/test_account_deletion_and_reset.py ^
  frontend/vercel.json ^
  frontend/scripts/patch-dist.js ^
  frontend/app/login.tsx ^
  frontend/app/reset-password.tsx ^
  frontend/app/+html.tsx ^
  .github/workflows/security.yml ^
  .github/dependabot.yml
git commit -m "2026-07-27 biztonsagi javitasok: fioktorles FK cascade (GDPR Art.17), reset-flow megerositese, MFA kiserletszamlalo javitasa, rate limitek, CSP report-only"
git tag -a v2026.07.27 -m "Biztonsagi javitasi kiadas"
git push origin main
git push origin v2026.07.27
echo.
echo ---- GIT PUSH KESZ ----
echo.

rem ---------------------------------------------------------------- 5
echo [5/6] Frontend deploy Vercelre...
cd /d "%~dp0frontend"
call npm run deploy
if errorlevel 1 goto :vercelhiba
cd /d "%~dp0"
echo.
echo ---- VERCEL DEPLOY KESZ ----
echo.

rem ---------------------------------------------------------------- 6
echo [6/6] Backend csomag feltoltese...
echo.
echo  A %PKG% keszen all a projekt gyokereben.
echo  Told fel a VM-re, majd futtasd ott a kicsomagolast:
echo.
echo    scp %PKG% ^<USER^>@^<VM_IP^>:~/
echo.
echo    ssh ^<USER^>@^<VM_IP^>
echo    cp ~/myra/backend/server.py ~/server.py.bak-$(date +%%F-%%H%%M)
echo    tar -xzf ~/%PKG% -C ~/myra/
echo    cd ~/myra ^&^& docker compose build backend ^&^& docker compose up -d backend
echo    docker logs --tail 80 myra-backend
echo.
echo  Reszletes lepesek es ellenorzesek:
echo    myra-deploy-utmutato-2026-07-27.md
echo.
echo ============================================================
echo  KESZ. A backend meg NINCS kint - az a kovetkezo lepes.
echo ============================================================
pause
exit /b 0

:teszthiba
echo.
echo *** A BACKEND TESZTEK ELBUKTAK - a kiadas leallt. ***
echo *** Semmi nem lett commitolva vagy deployolva.    ***
pause
exit /b 1

:fronthiba
echo.
echo *** FRONTEND ELLENORZES ELBUKOTT - a kiadas leallt. ***
pause
exit /b 1

:csomaghiba
echo.
echo *** A CSOMAGOLAS ELBUKOTT - a kiadas leallt. ***
pause
exit /b 1

:vercelhiba
echo.
echo *** A VERCEL DEPLOY ELBUKOTT.                          ***
echo *** A git push MAR MEGTORTENT - a backendet ne told    ***
echo *** ki, amig a frontend nincs kint (reset-flow torne). ***
pause
exit /b 1

:megse
echo.
echo Megszakitva - semmi nem tortent.
pause
exit /b 0
