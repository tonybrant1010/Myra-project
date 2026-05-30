@echo off
cd /d "C:\Users\TonyBrant\Desktop\Myra-Project-App\Myra-project-main\frontend"
set EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8001
set BROWSER=none
call yarn start --web --port 8081
