# Myra Project

Magyar nyelvű mentálhigiénés önismereti webapp. A rendszer ESV-modell alapú mérést végez, állapotkódot számol, majd a mérés eredményére építve indít beszélgetést a Myra chatfelületen.

Fontos: a Myra nem hivatalos diagnosztikai vagy terápiás eszköz, és nem helyettesít szakembert.

## Fő Funkciók

- felhasználói regisztráció és bejelentkezés;
- ESV-modell alapú kérdőív;
- 256 állapotkód kezelése;
- mérési eredményoldal;
- méréshez kötött Myra chat;
- felhasználó kifejezett adatvédelmi hozzájárulását kezelő indító kártya a mérés megkezdése előtt;
- fix önismereti tájékoztatók és disclaimerek a mérés, a chat és a Live beszélgetések felületén;
- Zenodo-n publikált technikai és jogi megfelelőségi audit jelentés (DOI: 10.5281/zenodo.20698359);
- PDF-alapú tudásvisszakeresés: Myra az aktuális üzenethez releváns tudásrészleteket kapja meg, nem a teljes tudásanyagot;
- chat- és mérési előzmények;
- admin felület felhasználókhoz, mérésekhez, tudásbázishoz és LLM-beállításokhoz;
- modern Aurora Blue / glassmorphism arculat;
- Vercel webes frontend;
- Dockerben futó FastAPI backend;
- EU régiós Supabase/Postgres adatbázis érzékeny felhasználói adatokhoz;
- lokális SQLite fallback fejlesztéshez.

## Stack

### Backend

- Python 3.11
- FastAPI
- SQLAlchemy async
- Supabase/Postgres / `asyncpg`
- SQLite / `aiosqlite` lokális fejlesztési fallbackként
- PDF-alapú tudásindex Postgres/SQLite kompatibilis kereséssel
- JWT auth
- Docker / Docker Compose
- LLM provider: admin felületen konfigurálható, jelenleg főként Gemini használatra optimalizálva

### Frontend

- Expo Router
- React Native Web
- TypeScript
- Vercel deploy
- Expo web export

## Mappa Struktúra

```text
backend/
  server.py
  requirements.txt
  Dockerfile
  data/
    kb_pdfs/
      *.pdf
    knowledge_base.txt
    esv_calc.ods

frontend/
  app/
  src/
  assets/
  scripts/patch-dist.js
  vercel.json
  package.json

publication/
  self_audit_report.docx
  myra_data_flow_map.png

docker-compose.yml
README.md
```

## Adatkezelés

Az éles felhasználói adatok és a chat-/mérési előzmények EU régiós Supabase/Postgres adatbázisban élnek. A backend a `DATABASE_URL`, `DATABASE_SSL` és `DATABASE_SSL_MODE` környezeti változókból olvassa a kapcsolatot.

A backend konténerben az adatkönyvtár továbbra is bind mounttal van bekötve:

```yaml
volumes:
  - ./backend/data:/app/data
```

Ez jelenleg főként a PDF tudásanyag és lokális fejlesztési fájlok helye:

```text
backend/data/kb_pdfs/
```

Backend frissítéskor a konténer újraépíthető; az éles adatbázis ettől nem sérül, mert nem a konténerben és nem a VM fájlrendszerén tárolódik. A PDF tudásindex a Postgres adatbázis `knowledge_chunks` táblájában épül újra a `backend/data/kb_pdfs` PDF-jeiből.

## Lokális Fejlesztés

### Backend Dockerrel

Gyökérben hozz létre egy `.env` fájlt:

```env
JWT_SECRET=legalabb-32-karakteres-titok
ADMIN_EMAIL_ALLOWLIST=admin@email.hu
DATABASE_URL=postgresql://...
DATABASE_SSL=true
DATABASE_SSL_MODE=require
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

Indítás:

```bash
docker compose up -d --build
```

Backend ellenőrzés:

```bash
curl http://localhost:8001/api/config
```

Várt válasz:

```json
{"app_name":"Myra-project"}
```

## PDF Tudásanyag

Myra tudásanyaga PDF-ekből épített lokális keresőindexet használ. A cél az, hogy a chat ne kapja meg minden üzenetnél a teljes kutatási anyagot, hanem csak az adott beszélgetési pillanathoz illő, rövid PDF-részleteket. Ez csökkenti a tokenhasználatot és pontosabb kontextust ad az LLM-nek.

A PDF-ek helye szerveren:

```text
backend/data/kb_pdfs/
```

Google VM-en:

```text
/home/antalodor/myra/backend/data/kb_pdfs/
```

Rackhoston:

```text
/root/backend/data/kb_pdfs/
```

Új vagy módosított PDF-ek után az indexet újra kell építeni:

```bash
docker compose exec -T backend sh -c 'cd /app && python - <<'"'"'PY'"'"'
import asyncio
from server import SessionLocal, rebuild_pdf_knowledge_index

async def main():
    async with SessionLocal() as db:
        print(await rebuild_pdf_knowledge_index(db, "/app/data/kb_pdfs"))

asyncio.run(main())
PY'
```

Sikeres eredmény például:

```text
{'ok': True, 'source_dir': '/app/data/kb_pdfs', 'pdf_count': 28, 'indexed_files': 28, 'chunk_count': 247, 'skipped': []}
```

Az indexelés a tudásindexet építi újra, nem törli a felhasználókat, méréseket vagy chatelőzményeket.

### Frontend

```bash
cd frontend
yarn install
set EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
npx expo start --web
```

Windows CMD-ben egy parancsban:

```cmd
set EXPO_PUBLIC_BACKEND_URL=http://localhost:8001&& npx expo start --web
```

## Vercel Deploy

A frontend deploy a `frontend` mappából történik:

```bash
cd frontend
npm run deploy
```

A deploy folyamat:

1. Expo web export készül.
2. `scripts/patch-dist.js` átmásolja és javítja a webes ikon/font asseteket.
3. Frissül a `dist/vercel.json`.
4. Vercel production deploy fut.

Fontos routing sajátosság:

- a frontend API-hívásai `/api/...` útvonalra mennek;
- Vercelen az `/api/:path*` rewrite továbbítja ezeket a backendhez;
- ezért a böngészőben a végső kérés gyakran `/api/api/...` formában jelenik meg;
- ezt nem szabad automatikusan "egyszerűsíteni", mert a jelenlegi Vercel rewrite logika erre épül.

## Backend Üzemeltetés

Jelenlegi backend modell:

```text
Vercel frontend
  /api rewrite
Linux VM backend
  Docker Compose / FastAPI
  backend/data/kb_pdfs/*.pdf
Supabase EU Postgres
  user adatok
  mérések
  chat előzmények
  PDF tudásindex
```

A rendszer Rackhost VPS-en fut, és felépült egy párhuzamos Google Compute Engine VM környezet is. Mindkét backend ugyanarra a Supabase/Postgres adatbázisra csatlakozik, ezért backendváltáskor nem kell SQLite adatbázist mozgatni.

```text
Vercel frontend
  /api rewrite
Rackhost vagy Google VM backend
  Docker
  DATABASE_URL -> Supabase/Postgres
```

Átállás előtt a Google backend külön tesztelendő, az éles Vercel rewrite csak sikeres login, mérés, chat és admin teszt után módosítható.

## Backend Frissítés Adatvesztés Nélkül

Az éles adatbázis nem a backend mappában él. Frissítés előtt ellenőrizd, hogy a konténer valóban Postgresre csatlakozik:

```bash
docker compose exec -T backend python - <<'PY'
import asyncio
from sqlalchemy import text
from server import SessionLocal, DB_DIALECT

async def main():
    async with SessionLocal() as db:
        users = (await db.execute(text("select count(*) from users"))).scalar()
        messages = (await db.execute(text("select count(*) from chat_messages"))).scalar()
        print("DB_DIALECT:", DB_DIALECT)
        print("users:", users)
        print("chat_messages:", messages)

asyncio.run(main())
PY
```

Ezután jöhet a backend frissítése:

```bash
docker compose up -d --build
docker ps
curl http://localhost:8001/api/config
```

Ha a frissítés új PDF tudásanyagot is tartalmaz, a `backend/data/kb_pdfs` mappa frissítése után futtasd újra a PDF-indexelést a "PDF Tudásanyag" szakasz szerint.

Nem szabad vakon felülírni:

```text
.env
backend/data/kb_pdfs/ ellenőrzés nélkül
```

## Backup

Az éles adatbázis mentését Supabase/Postgres oldalon kell kezelni. Ha szerverről készült ideiglenes SQLite vagy export mentés, az nem kerülhet GitHubra, és csak titkosított/lokális mentési helyen maradhat.

## Hasznos Ellenőrző Parancsok

Backend konténer:

```bash
docker ps
docker logs --tail=100 myra-backend
curl http://localhost:8001/api/config
```

Erőforrás:

```bash
docker stats --no-stream myra-backend
free -h
df -h
du -sh ~/myra/backend/data
```

Frontend build:

```bash
cd frontend
npx expo export --platform web
node scripts/patch-dist.js
```

## Git / Repo Higiénia

Ne kerüljön GitHubra:

```text
.env
.venv/
node_modules/
dist/
.expo/
.metro-cache/
*.log
*.tgz
*.db
*.sqlite
live-db-backups/
backend/data/myra.db
```

A nagy mappák normálisak fejlesztés közben:

```text
backend/.venv        Python virtuális környezet
frontend/node_modules Node függőségek
frontend/dist        web build kimenet
frontend/.metro-cache Expo/Metro cache
```

Ezek újratelepíthetők, ezért nem részei a forráskód-mentésnek.

## Biztonsági Megjegyzések

- API kulcsot és `.env` fájlt ne commitolj.
- Éles adatbázis-exportot, SQLite mentést vagy felhasználói adatot tartalmazó fájlt ne commitolj.
- Privát repo esetén is érdemes úgy kezelni a titkokat, mintha később auditálni kellene.
- Felhasználói törlés esetén az app működési elve szerint a kapcsolódó felhasználói adatok is törlendők.
