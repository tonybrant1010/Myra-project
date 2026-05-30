@echo off
cd /d "C:\Users\TonyBrant\Desktop\Myra-Project-App\Myra-project-main\backend"
".venv\Scripts\python.exe" -c "import sqlite3;c=sqlite3.connect('data/myra.db');r=c.execute(\"select sql from sqlite_master where type='table' and name='users'\").fetchone();print(r[0] if r else 'NO users TABLE')" 2>&1
echo === columns ===
".venv\Scripts\python.exe" -c "import sqlite3;c=sqlite3.connect('data/myra.db');print([row[1] for row in c.execute('PRAGMA table_info(users)').fetchall()])" 2>&1
echo SCHEMA_DONE
