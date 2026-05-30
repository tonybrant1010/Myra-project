# Myra Project

Magyar nyelvű mentálhigiénés önismereti webapp. A rendszer ESV-modell alapú mérést végez, állapotkódot számol, majd a mérés eredményére építve indít beszélgetést a Myra chatfelületen.

Fontos: a Myra nem hivatalos diagnosztikai vagy terápiás eszköz, és nem helyettesít szakembert.

## Fő Funkciók

- felhasználói regisztráció és bejelentkezés;
- ESV-modell alapú kérdőív;
- 256 állapotkód kezelése;
- mérési eredményoldal;
- méréshez kötött Myra chat;
- chat- és mérési előzmények;
- admin felület felhasználókhoz, mérésekhez, tudásbázishoz és LLM-beállításokhoz;
- modern Aurora Blue / glassmorphism arculat;
- Vercel webes frontend;
- Dockerben futó FastAPI backend;
- SQLite-alapú adatkezelés külső adatbázis-szolgáltató nélkül.

## Stack

### Backend

- Python 3.11
- FastAPI
- SQLAlchemy async
- SQLite / `aiosqlite`
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
    myra.db
    knowledge_base.txt
    kb_*.pdf
    esv_calc.ods

frontend/
  app/
  src/
  assets/
  scripts/patch-dist.js
  vercel.json
  package.json

docker-compose.yml
README.md
```

## Adatkezelés

A backend konténerben az adatkönyvtár bind mounttal van bekötve:

```yaml
volumes:
  - ./backend/data:/app/data
```

Ez azt jelenti, hogy a felhasználói adatok nem a konténer belsejében élnek, hanem a host gépen:

```text
backend/data/myra.db
```

Backend frissítéskor a konténer újraépíthető, az adatbázis ettől nem törlődik, amíg a `backend/data` mappa nincs felülírva vagy törölve.

## Lokális Fejlesztés

### Backend Dockerrel

Gyökérben hozz létre egy `.env` fájlt:

```env
JWT_SECRET=legalabb-32-karakteres-titok
ADMIN_EMAIL_ALLOWLIST=admin@email.hu
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
Linux VM
  Docker Compose
    myra-backend
  backend/data
    myra.db
    PDF-ek
    tudásbázis
```

A rendszer Rackhost VPS-en futott, majd felépült egy párhuzamos Google Compute Engine VM környezet is. A Google VM célja a VPS-költség kiváltása úgy, hogy a működés továbbra is egyben kezelhető maradjon:

```text
Vercel frontend
  /api rewrite
Google VM backend
  Docker
  SQLite
  backend/data volume
```

Átállás előtt a Google backend külön tesztelendő, az éles Vercel rewrite csak sikeres login, mérés, chat és admin teszt után módosítható.

## Backend Frissítés Adatvesztés Nélkül

Frissítés előtt mindig legyen DB-mentés:

```bash
cd ~/myra
mkdir -p backups
sqlite3 backend/data/myra.db ".backup 'backups/myra.db.$(date +%Y%m%d-%H%M%S).sqlite'"
```

Ezután jöhet a backend frissítése:

```bash
docker compose up -d --build
docker ps
curl http://localhost:8001/api/config
```

Nem szabad vakon felülírni:

```text
backend/data/myra.db
backend/data/
```

## Automatikus Backup

A Google VM-en napi helyi SQLite backup használható:

```bash
~/myra/backup-myra-db.sh
```

A script lényege:

```bash
sqlite3 "$DATA_DIR/myra.db" ".backup '$BACKUP_DIR/myra.db.$TS.sqlite'"
find "$BACKUP_DIR" -name "myra.db.*.sqlite" -type f -mtime +14 -delete
```

Cron példa:

```bash
15 2 * * * /home/antalodor/myra/backup-myra-db.sh >> /home/antalodor/myra/backups/backup.log 2>&1
```

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
ls -lh ~/myra/backend/data/myra.db
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
- Az éles `myra.db` felhasználói adatot tartalmazhat, GitHub helyett szerveroldali backupban tárolandó.
- Privát repo esetén is érdemes úgy kezelni a titkokat, mintha később auditálni kellene.
- Felhasználói törlés esetén az app működési elve szerint a kapcsolódó felhasználói adatok is törlendők.
