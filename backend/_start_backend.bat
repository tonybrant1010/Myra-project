@echo off
cd /d "C:\Users\TonyBrant\Desktop\Myra-Project-App\Myra-project-main\backend"
".venv\Scripts\python.exe" -m uvicorn server:app --host 127.0.0.1 --port 8001
