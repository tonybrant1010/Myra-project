# Myra Project

Magyar nyelvű mentálhigiénés önismereti webapp. A rendszer ESV-modell alapú mérést végez, állapotkódot számol, majd a mérés eredményére építve indít beszélgetést a Myra chatfelületen.

Fontos: a Myra nem hivatalos diagnosztikai vagy terápiás eszköz, és nem helyettesít szakembert.

## Éles Architektúra

```text
Felhasználó böngészője
  |
  v
Vercel frontend
  - Expo web export
  - /api útvonalak Vercel Function proxyn keresztül
  - X-Myra-Proxy-Secret header hozzáadása
  |
  v
Google Cloud VM backend
  - Docker Compose
  - FastAPI / Uvicorn
  - PDF fájlok: /app/data/kb_pdfs
  |
  v
Supabase EU Postgres
  - felhasználók
  - mérési adatok
  - chat előzmények
  - knowledge_chunks + pgvector embedding_384
```

A frontend Vercelen fut. A backend Google Cloud VM-en fut Docker konténerben. Az adatbázis helye Supabase/Postgres. A VM-en nem fut frontend konténer.

## Fő Funkciók

- felhasználói regisztráció, bejelentkezés és MFA email kód;
- ESV-modell alapú kérdőív és állapotkód-számítás;
- mérési eredményoldal;
- méréshez kötött Myra chat;
- chat- és mérési előzmények;
- bővített chat kontextus ugyanazon mérési szálon belül;
- TXT beszélgetés-export a chat felületről;
- Gemini Live beszélgetés az aktuális kapcsolat idejére korlátozott kontextussal;
- PDF-alapú RAG tudásvisszakeresés;
- admin tudásanyag-kezelés PDF feltöltéssel, törléssel és háttérben futó élesítéssel;
- admin rendszerbeállítások, karbantartási mód és SOS eszközök;
- 30 napos mérési érvényességi ciklus és archivált, olvasható beszélgetések;
- Vercel frontend, VM backend, Supabase adatbázis.

## Stack

### Backend

- Python 3.11
- FastAPI
- SQLAlchemy async
- asyncpg
- Supabase/Postgres
- pgvector
- FastEmbed 384 dimenziós lokális embedding
- pypdf PDF szövegkinyerés
- JWT auth
- Gmail SMTP MFA kódokhoz
- Docker / Docker Compose
- LLM provider admin felületről konfigurálva

### Frontend

- Expo Router
- React Native Web
- TypeScript
- Vercel deploy
- Expo web export

## Fontos Működési Részletek

### Vercel API proxy

A böngészőből induló API hívások `/api/...` útvonalra mennek. Vercelen ezt a `dist/api/proxy.js` Vercel Function kezeli, amely:

- továbbítja a kérést a VM backend felé;
- hozzáadja a `X-Myra-Proxy-Secret` headert;
- kiszűri a hop-by-hop HTTP headereket, például `transfer-encoding` és `content-length`, hogy a POST kérések ne akadjanak el a Vercel Function proxyban;
- megakadályozza, hogy a backend publikus originje közvetlenül használható legyen.

Emiatt a böngészőben gyakran ilyen útvonal látszik:

```text
/api/api/auth/login
```

Ez szándékos. Az első `/api` a Vercel proxy útvonala, a második `/api` a FastAPI backend prefixe.

### Backend origin védelem

A backend csak akkor fogad el éles külső kérést, ha a kérésben szerepel a helyes:

```text
X-Myra-Proxy-Secret
```

Ha ez hiányzik vagy rossz, a backend válasza:

```json
{"detail":"Direct access to origin is forbidden."}
```

A VM `.env` és a Vercel project env ugyanazt a `MYRA_PROXY_SECRET` értéket kell használja.

### Supabase IP allowlist

Ha a Google VM külső IP-je megváltozik, a Supabase Database Network Restrictions / allowlist alatt frissíteni kell az IP-t:

```text
<VM_EXTERNAL_IP>/32
```

A Vercel IP változása ezt nem érinti, mert a Supabase adatbázishoz a backend VM csatlakozik.

## RAG / Tudásanyag

A tudásanyag PDF-ekből épül:

```text
backend/data/kb_pdfs/*.pdf
```

A PDF feltöltés backend oldalon méretkorlátot és PDF tartalomellenőrzést kap. Az alapértelmezett
limit 25 MB/fájl, env-ből hangolható:

```env
KB_PDF_UPLOAD_MAX_BYTES=26214400
KB_TEXT_UPLOAD_MAX_BYTES=2097152
```

A backend a PDF-ekből szöveget nyer ki, chunkokra bontja, FastEmbed embeddinget készít, majd Supabase-ben tárolja:

```text
knowledge_chunks.embedding_384 vector(384)
```

Az aktív oszlop:

```text
embedding_384
```

A régi 768 dimenziós `embedding` oszlop már nem használatos.

### Supabase elvárt ellenőrzés

```sql
select
  count(*) as chunks,
  count(embedding_384) as embedded_384
from knowledge_chunks;

select
  source_name,
  count(*) as chunks,
  count(embedding_384) as embedded
from knowledge_chunks
group by source_name
order by source_name;
```

Jó állapotban:

- `chunks = embedded_384`;
- fájlonként `chunks = embedded`;
- jelenlegi teljes tudásanyag: 31 PDF, 271 chunk.

### Tudásanyag élesítése

Az admin felületen a **Tudásanyag élesítése** gomb háttérfolyamatot indít. A folyamat:

1. beolvassa a PDF-eket;
2. frissíti a `kb_text` beállítást;
3. újraépíti a `knowledge_chunks` táblát;
4. minden chunkhoz `embedding_384` vektort készít.

Fontos: rebuild közben a tábla átmenetileg kiürülhet. Ez normális, amíg a chunk szám utána újra növekszik.

## Chat

A chat az aktuális mérési sessionhöz kötődik. A backend a beszélgetés korábbi üzeneteiből kontrollált méretű kontextust ad át az LLM-nek.

Hangolható env változók:

```env
CHAT_HISTORY_MAX_MESSAGES=120
CHAT_HISTORY_MAX_CHARS=45000
```

Ha a válaszadás túl lassú, ezeket kisebb értékre lehet venni, például:

```env
CHAT_HISTORY_MAX_MESSAGES=60
CHAT_HISTORY_MAX_CHARS=25000
```

A chat felületen a betöltött beszélgetés TXT fájlként letölthető.

### Chat teljesítmény

A backend a chat válaszadásnál `chat_timing` logsort ír. Ez külön méri a fő lépéseket:

```text
settings, rag, history_db, history_format, llm, reply_db
```

Ebből látható, hogy a lassulást a beállítások lekérése, a RAG keresés, az előzmények olvasása,
az LLM hívás vagy a válasz mentése okozza-e. A chat előzmény lekéréséhez külön Postgres index
van:

```text
ix_chat_messages_user_session_created_at
```

Ez az aktuális mérési session üzeneteit időrend szerint, limitált mennyiségben tölti vissza, hogy
a beszélgetés folyamatát kövesse, de ne húzza be feleslegesen a teljes régi előzményt.

## Live Beszélgetés

A Live kapcsolat közvetlenül a Google Gemini Live API-val kommunikál. A backend csak
rövid élettartamú Live tokent ad ki; a böngésző mikrofonhangja és a generált hang a
Live kapcsolatban halad. A kapcsolatról nem készül leirat és bezárás után nem marad
felhasználói Live-előzmény.

A Live indításakor a backend technikai kontextusként átadja az aktuális
`Europe/Budapest` időpontot. Ez nem módosítja az admin felületen tárolt Myra-promptot.

Backend újraindítás után a RAG modell előmelegítése az alkalmazás indulásakor fut le,
egyetlen próba-embeddinggel és egy csak olvasó kereséssel. Emiatt a konténer csak a
modell betöltése után lesz kész, de az első chat- vagy Live-felhasználónak nem kell
megvárnia a FastEmbed/Hugging Face cold startot. Ez nem indít tudásanyag-élesítést és
nem ír át `knowledge_chunks` rekordot.

## Mappa Struktúra

```text
backend/
  server.py
  requirements.txt
  Dockerfile
  .dockerignore
  data/
    kb_pdfs/
      *.pdf
    esv_calc.ods

frontend/
  app/
  src/
  assets/
  scripts/patch-dist.js
  vercel.json
  package.json

publication/
tests/
docker-compose.yml
README.md
```

## Backend Üzemeltetés VM-en

Frissítés tipikus menete, ha `.tgz` csomag kerül fel a VM home mappájába:

```bash
mv ~/backend-update.tgz ~/myra/
cd ~/myra
tar -xzvf backend-update.tgz -C ~/myra/
docker compose build backend
docker compose up -d backend
```

Ellenőrzés:

```bash
cd ~/myra
docker ps -a
docker logs --tail 80 myra-backend
docker stats myra-backend --no-stream
```

Tárhely ellenőrzés:

```bash
df -h /
docker system df
```

Build cache biztonságos takarítása:

```bash
docker builder prune -f
```

## Frontend Deploy

A frontend deploy a `frontend` mappából történik:

```bash
cd frontend
npm run deploy
```

Windows CMD:

```cmd
cd /d C:\Users\TonyBrant\Desktop\Myra-Project-App\Myra-project-main\frontend && npm run deploy
```

A deploy folyamat:

1. Expo web export készül.
2. `scripts/patch-dist.js` javítja a `dist` kimenetet.
3. Létrejön a Vercel proxy function.
4. Frissül a `dist/vercel.json`.
5. Vercel production deploy fut.

## Lokális Fejlesztés

Backend:

```bash
docker compose up -d --build
```

Frontend:

```bash
cd frontend
yarn install
set EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
npx expo start --web
```

## Kötelező Env Változók

Backend / VM:

```env
JWT_SECRET=...
DATABASE_URL=postgresql://...
DATABASE_SSL=true
DATABASE_SSL_MODE=require
MYRA_PROXY_SECRET=...
GMAIL_USER=...
GMAIL_APP_PASSWORD=...
TRUST_PROXY=true
TTS_ENGINE=piper
```

Vercel:

```env
MYRA_PROXY_SECRET=...
MYRA_BACKEND_ORIGIN=http://<VM_EXTERNAL_IP>:8001
EXPO_PUBLIC_BACKEND_URL=/api
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

A következő lokális segédanyagok nem részei az éles forráskódnak:

```text
backend-search.py
search-details.py
backend/rag/
```

## Biztonsági Megjegyzések

- API kulcsot és `.env` fájlt ne commitolj.
- Éles adatbázis-exportot vagy felhasználói adatot tartalmazó fájlt ne commitolj.
- Supabase IP allowlist változás után mindig ellenőrizd a login, mérés, chat és admin tudásanyag folyamatot.
- Backend restart után az első RAG keresés FastEmbed cold start miatt lassabb lehet.
- A jelszó-visszaállító 6 jegyű kód a felhasználónak továbbra is emailben megy ki, de a backend a DB-ben csak hash formában tárolja.
- A jelszó-reset frontend hívás a központi `apiUrl()` útvonalat használja, nem fix domainre küld érzékeny adatot.
- A backend és a Vercel frontend alap biztonsági HTTP fejléceket ad: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, éles HTTPS alatt `Strict-Transport-Security`.
- Szigorú Content-Security-Policy jelenleg nincs bekapcsolva, mert a Gemini Live/WebSocket és Expo web bundle miatt külön, célzott tesztelést igényelne.
- Az admin log nézet maszkolja az URL-ben vagy headerben megjelenő API kulcsokat és bearer tokeneket.
- A személyes vagy admin jellegű API válaszok `Cache-Control: no-store` fejléccel mennek ki.
