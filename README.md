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
- **Egyesített Adminisztráció menü**: Az admin funkciók egyetlen lenyitható (collapsible) menüpont alá csoportosítva;
- **Tudásanyag Kezelő (`/admin-kb`)**: PDF fájlok feltöltése, listázása és törlése közvetlenül a felületről, egykattintásos indexeléssel és Gemini Context Cache frissítéssel;
- **Sürgősségi Eszközök (SOS)**: Valós idejű rendszerdiagnosztika, karbantartási mód, token-érvénytelenítés, Gemini cache ürítés és backend Docker konténer-restart közvetlenül mobiltelefonról;
- modern Aurora Blue / glassmorphism arculat;
- Vercel webes frontend;
- Dockerben futó FastAPI backend;
- EU régiós Supabase/Postgres adatbázis érzékeny felhasználói adatokhoz;
- 30 napos mérési érvényességi ciklus és automatikus beszélgetés-archiválás (lock & gate) rendszer.

## Stack

### Backend

- Python 3.11
- FastAPI
- SQLAlchemy async
- Supabase/Postgres / `asyncpg` (kizárólagos adatbázis mind lokális, mind éles környezetben)
- PDF-alapú tudásindex Postgres kompatibilis kereséssel
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
    esv_calc.ods
  tests/                 # Backend integrációs és egységtesztek

frontend/
  app/
  src/
  assets/
  scripts/patch-dist.js
  vercel.json
  package.json

publication/
  self_audit_report.docx # Hitelesített önértékelési jelentés
  myra_data_flow_map.png # Adatfolyam és architektúra térkép

tests/
  __init__.py            # Root tesztelési modul

docker-compose.yml
README.md
```

## Adatkezelés

Az éles és a lokális fejlesztési adatok kizárólag EU régiós Supabase/Postgres adatbázisban élnek. A backend a `DATABASE_URL`, `DATABASE_SSL` és `DATABASE_SSL_MODE` környezeti változókból olvassa a kapcsolatot.

> [!IMPORTANT]
> A projektben szigorúan tilos bármilyen SQLite `.db` fájl vagy egyéb lokális adatbázis-fájl használata, generálása és commitolása a repóba. A rendszer kizárólagos adatbázisa a Supabase/PostgreSQL.

A backend konténerben az adatkönyvtár továbbra is bind mounttal van bekötve:

```yaml
volumes:
  - ./backend/data:/app/data
```

Ez a PDF tudásanyagok és a lokális fejlesztési fájlok helye:

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
GMAIL_USER=myra.project.hu@gmail.com
GMAIL_APP_PASSWORD=titkos-gmail-alkalmazaskod
TRUST_PROXY=true
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

## PDF Tudásanyag Kezelése és SOS Eszközök

A Myra tudásanyaga PDF-ekből épített lokális keresőindexet és Gemini Context Cache-t használ. A PDF-ek közvetlenül kezelhetők a felhasználói felületen keresztül, nincs szükség kézi szerveroldali parancssor használatára.

### Adminisztrációs felület elérése
Bejelentkezés után a navigációs menüben lévő **Adminisztráció** collapsible menü alatt négy rész érhető el:
1. **Rendszerbeállítások**: modell paraméterek, system prompt, globális közlemények konfigurálása, és az SOS gombok.
2. **Tudásanyag**: a szerveren tárolt `.pdf` fájlok kezelése (feltöltés és törlés), valamint az index és a Gemini gyorsítótár újraépítése.
3. **Állapotkódok**: ESV kódok profiljainak és címeinek szerkesztése.
4. **Felhasználók**: felhasználók admin státuszának kezelése, felfüggesztés.

### Tudásanyag frissítése a felületről (`/admin-kb`):
1. Navigálj a **Tudásanyag** menüpontra.
2. Kattints a **PDF Feltöltése** gombra és válassz ki egy `.pdf` dokumentumot (a szerver kizárólag PDF formátumot fogad el a pontosság és a hibamentesség érdekében).
3. A törlendő fájlok melletti kuka ikonra kattintva eltávolíthatod a dokumentumot (megerősítő ablak után).
4. Ha végeztél a módosításokkal, kattints a **Tudásanyag Élesítése** gombra. Ez automatikusan lefolytatja a backend szöveg-kinyerést, a PostgreSQL index frissítést és a Gemini Context Cache megújítását.

### Sürgősségi Eszközök (SOS) használata:
A Rendszerbeállítások oldal alján található **Sürgősségi Eszközök (SOS)** panel segítségével laptop nélkül, akár mobilról is elvégezhetők az alábbi műveletek:
- **Rendszerdiagnosztika futtatása**: Ellenőrzi a Supabase adatbázis-kapcsolatot, a Gemini API kulcs meglétét, a TTS hanggeneráló motor állapotát, és a PDF fájlok számát.
- **Karbantartási mód**: Bekapcsolásával a nem-admin felhasználók egy barátságos tájékoztató üzenetet kapnak, a chat és a hangalapú asszisztens ideiglenesen blokkolásra kerül.
- **Összes nem-admin kijelentkeztetése**: Azonnal érvényteleníti az összes aktív felhasználói munkamenetet (JWT tokenek azonnali elutasítása a token_version növelésével).
- **Gemini Context Cache ürítése**: Törli az aktív Gemini cache-t.
- **Backend konténer újraindítása**: Leállítja a backend python folyamatot (`os._exit(0)`). Mivel a Docker konténer `restart: unless-stopped` szabályra van állítva, a Docker azonnal újraindítja a konténert, így a teljes backend tiszta lappal indul újra 5-10 másodperc alatt.
- **Élő memórialogok**: Megjeleníti a szerver memóriájában tárolt utolsó 100 log sort a gyors hibakereséshez.

---

### Frontend indítása lokálisan

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

Átállás előtt a Google backend külön tesztelendő, az éles Vercel rewrite csak sikeres login, mérés, chat és admin teszt után módosítható.

## Backup

Az adatbázis mentéseit a Supabase/Postgres beépített biztonsági mentési rendszere végzi. A Rendszerbeállítások felületről gombnyomásra letölthető az adatbázis mentés. A projekt mappájában semmilyen adatbázis-export fájl nem tárolható.

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
