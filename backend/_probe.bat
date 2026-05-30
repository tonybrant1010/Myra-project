@echo off
cd /d "C:\Users\TonyBrant\Desktop\Myra-Project-App\Myra-project-main\backend"
echo === version ===
".venv\Scripts\python.exe" --version
echo === deps ===
".venv\Scripts\python.exe" -c "import fastapi,uvicorn,sqlalchemy,jwt,passlib,httpx,pypdf,dotenv,aiosqlite,bcrypt,email_validator; print('DEPS_OK')"
echo === db ===
".venv\Scripts\python.exe" -c "import sqlite3;c=sqlite3.connect('data/myra.db');print('codes',c.execute('select count(*) from state_codes').fetchone()[0]);print('users',c.execute('select count(*) from users').fetchone()[0])"
echo PROBE_DONE
