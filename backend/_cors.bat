@echo off
echo === GET with Origin ===
curl -s -i -H "Origin: http://localhost:8081" http://localhost:8001/api/config
echo.
echo === OPTIONS preflight (login) ===
curl -s -i -X OPTIONS -H "Origin: http://localhost:8081" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type" http://localhost:8001/api/auth/login
echo.
echo CORS_DONE
