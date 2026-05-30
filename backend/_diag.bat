@echo off
cd /d "C:\Users\TonyBrant\Desktop\Myra-Project-App\Myra-project-main\backend"
echo === netstat 8001 ===
netstat -ano | findstr :8001
echo === curl 127.0.0.1 ===
curl -s -m 5 -o NUL -w "HTTP %%{http_code}\n" http://127.0.0.1:8001/api/config
echo === curl localhost ===
curl -s -m 5 -o NUL -w "HTTP %%{http_code}\n" http://localhost:8001/api/config
echo === body 127.0.0.1 ===
curl -s -m 5 http://127.0.0.1:8001/api/config
echo.
echo === localhost resolution ===
ping -n 1 localhost
echo DIAG_DONE
