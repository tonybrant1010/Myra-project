@echo off
setlocal
title Myra backend csomag - 2026-07-27 biztonsagi kiadas
cd /d "%~dp0"

set PKG=myra_backend_update_20260727.tgz

echo ============================================================
echo  Myra backend csomag keszitese - 2026-07-27
echo ============================================================
echo.

echo [1/4] Szintaxis ellenorzese...
backend\.venv\Scripts\python.exe -c "import ast,io;ast.parse(io.open('backend/server.py',encoding='utf-8').read());print('  server.py OK')"
if errorlevel 1 goto :hiba
backend\.venv\Scripts\python.exe -c "import ast,io;ast.parse(io.open('backend/tests/test_account_deletion_and_reset.py',encoding='utf-8').read());print('  test_account_deletion_and_reset.py OK')"
if errorlevel 1 goto :hiba
echo.

echo [2/4] Regi csomag torlese, ha van...
if exist "%PKG%" del /q "%PKG%"
echo.

echo [3/4] Csomagolas...
rem A tar a projekt gyokerebol fut, hogy a csomagban "backend/..." utvonalak legyenek.
rem A VM-en ezt a "tar -xzf ... -C ~/myra/" varja el.
tar -czf "%PKG%" ^
  backend/server.py ^
  backend/tests/conftest.py ^
  backend/tests/test_security.py ^
  backend/tests/test_account_deletion_and_reset.py
if errorlevel 1 goto :hiba
echo.

echo [4/4] A csomag tartalma:
tar -tzvf "%PKG%"
echo.

echo ============================================================
echo  KESZ: %PKG%
echo ============================================================
echo.
echo  Kovetkezo lepes - feltoltes a VM-re:
echo.
echo    gcloud compute scp %PKG% ^<VM_NEV^>:~/ --zone ^<ZONA^>
echo.
echo  vagy sima SSH-val:
echo.
echo    scp %PKG% ^<USER^>@^<VM_IP^>:~/
echo.
echo  Utana a VM-en lasd: myra-deploy-utmutato-2026-07-27.md
echo.
pause
exit /b 0

:hiba
echo.
echo *** HIBA - a csomag NEM keszult el. Javitsd a fenti hibat. ***
echo.
pause
exit /b 1
