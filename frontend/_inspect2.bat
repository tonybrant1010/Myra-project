@echo off
set "URL=http://localhost:8081/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable"
curl -s "%URL%" -o "%TEMP%\myra_entry.js"
echo bundle bytes:
for %%A in ("%TEMP%\myra_entry.js") do echo %%~zA
echo --- localhost:8001 ---
findstr /C:"localhost:8001" "%TEMP%\myra_entry.js" >NUL && echo FOUND localhost:8001 || echo NOT FOUND
echo --- 127.0.0.1:8001 ---
findstr /C:"127.0.0.1:8001" "%TEMP%\myra_entry.js" >NUL && echo FOUND 127.0.0.1:8001 || echo NOT FOUND
echo --- raw env token (means NOT inlined) ---
findstr /C:"EXPO_PUBLIC_BACKEND_URL" "%TEMP%\myra_entry.js" >NUL && echo FOUND token || echo NOT FOUND
echo --- context lines containing BACKEND_URL ---
findstr /N /C:"BACKEND_URL" "%TEMP%\myra_entry.js"
echo INSPECT2_DONE
