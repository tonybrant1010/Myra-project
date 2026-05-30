@echo off
echo === HTML head (script srcs) ===
curl -s http://localhost:8081/ | findstr /I "script src bundle"
echo.
echo === search bundle for backend url ===
curl -s "http://localhost:8081/index.bundle?platform=web&dev=true&hot=false" -o "%TEMP%\myra_bundle.js"
echo bundle bytes:
for %%A in ("%TEMP%\myra_bundle.js") do echo %%~zA
echo --- localhost:8001 hits ---
findstr /C:"localhost:8001" "%TEMP%\myra_bundle.js" >NUL && echo FOUND localhost:8001 || echo NOT FOUND localhost:8001
echo --- EXPO_PUBLIC_BACKEND_URL context ---
findstr /C:"EXPO_PUBLIC_BACKEND_URL" "%TEMP%\myra_bundle.js" >NUL && echo FOUND raw EXPO_PUBLIC_BACKEND_URL token || echo not present (inlined)
echo INSPECT_DONE
