@echo off
cd /d "C:\Users\TonyBrant\Desktop\Myra-Project-App\Myra-project-main\backend"
echo === versions ===
".venv\Scripts\python.exe" -c "import sys,bcrypt,passlib;print('py',sys.version.split()[0]);print('bcrypt',getattr(bcrypt,'__version__','?'));print('passlib',passlib.__version__)" 2>&1
echo === hash test ===
".venv\Scripts\python.exe" -c "from passlib.context import CryptContext;c=CryptContext(schemes=['bcrypt'],deprecated='auto');print('HASH_OK',c.hash('test1234')[:20])" 2>&1
echo HASHTEST_DONE
