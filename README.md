# Myra Project

Magyar nyelvu mentalhigienes onismereti webapp. A rendszer ESV-modell alapu merest vegez, allapotkodot szamol, majd a meres eredmenyere epitve indit beszelgetest a Myra chatfeluleten.

Fontos: a Myra nem hivatalos diagnosztikai vagy terapias eszkoz, es nem helyettesit szakembert.

## Eles Architektura

```text
Felhasznalo bongeszoje
  |
  v
Vercel frontend
  - Expo web export
  - /api utvonalak Vercel Function proxyn keresztul
  - X-Myra-Proxy-Secret header hozzaadasa
  |
  v
Google Cloud VM backend
  - Docker Compose
  - FastAPI / Uvicorn
  - PDF fajlok: /app/data/kb_pdfs
  |
  v
Supabase EU Postgres
  - felhasznalok
  - meresi adatok
  - chat elozmenyek
  - knowledge_chunks + pgvector embedding_384
```

A frontend Vercelen fut. A backend Google Cloud VM-en fut Docker kontenerben. Az adatbazis helye Supabase/Postgres. A VM-en nem fut frontend kontener.

## Fo Funkciok

- felhasznaloi regisztracio, bejelentkezes es MFA email kod;
- ESV-modell alapu kerdoiv es allapotkod-szamitas;
- meresi eredmenyoldal;
- mereshez kotott Myra chat;
- chat- es meresi elozmenyek;
- bovitett chat kontextus ugyanazon meresi szalon belul;
- TXT beszelgetes-export a chat feluletrol;
- PDF-alapu RAG tudasvisszakereses;
- admin tudasanyag-kezeles PDF feltoltessel, torlessel es hatterben futo elesitessel;
- admin rendszerbeallitasok, karbantartasi mod es SOS eszkozok;
- 30 napos meresi ervenyessegi ciklus es archivalt olvashato beszelgetesek;
- Vercel frontend, VM backend, Supabase adatbazis.

## Stack

### Backend

- Python 3.11
- FastAPI
- SQLAlchemy async
- asyncpg
- Supabase/Postgres
- pgvector
- FastEmbed 384 dimenzios lokalis embedding
- pypdf PDF szovegkinyeres
- JWT auth
- Gmail SMTP MFA kodokhoz
- Docker / Docker Compose
- LLM provider admin feluletrol konfiguralva

### Frontend

- Expo Router
- React Native Web
- TypeScript
- Vercel deploy
- Expo web export

## Fontos Mukodesi Reszletek

### Vercel API proxy

A bongeszobol indulo API hivasok `/api/...` utvonalra mennek. Vercelen ezt a `dist/api/proxy.js` Vercel Function kezeli, amely:

- tovabbitja a kerest a VM backend fele;
- hozzaadja a `X-Myra-Proxy-Secret` headert;
- megakadalyozza, hogy a backend publikus originje kozvetlenul hasznalhato legyen.

Emiatt a bongeszoben gyakran ilyen utvonal latszik:

```text
/api/api/auth/login
```

Ez szandekos. Az elso `/api` a Vercel proxy utvonala, a masodik `/api` a FastAPI backend prefixe.

### Backend origin vedelem

A backend csak akkor fogad el eles kulso kerest, ha a keresben szerepel a helyes:

```text
X-Myra-Proxy-Secret
```

Ha ez hianyzik vagy rossz, a backend valasza:

```json
{"detail":"Direct access to origin is forbidden."}
```

A VM `.env` es a Vercel project env ugyanazt a `MYRA_PROXY_SECRET` erteket kell hasznalja.

### Supabase IP allowlist

Ha a Google VM kulso IP-je megvaltozik, a Supabase Database Network Restrictions / allowlist alatt frissiteni kell az IP-t:

```text
<VM_EXTERNAL_IP>/32
```

A Vercel IP valtozasa ezt nem erinti, mert a Supabase adatbazishoz a backend VM csatlakozik.

## RAG / Tudasanyag

A tudasanyag PDF-ekbol epul:

```text
backend/data/kb_pdfs/*.pdf
```

A backend a PDF-ekbol szoveget nyer ki, chunkokra bontja, FastEmbed embeddinget keszit, majd Supabase-ben tarolja:

```text
knowledge_chunks.embedding_384 vector(384)
```

Az aktiv oszlop:

```text
embedding_384
```

A regi 768 dimenzios `embedding` oszlop mar nem hasznalatos.

### Supabase elvart ellenorzes

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

Jo allapotban:

- `chunks = embedded_384`;
- fajlonkent `chunks = embedded`;
- jelenlegi teljes tudasanyag: 31 PDF, 271 chunk.

### Tudasanyag elesitese

Az admin feluleten a **Tudasanyag elesitese** gomb hatterfolyamatot indit. A folyamat:

1. beolvassa a PDF-eket;
2. frissiti a `kb_text` beallitast;
3. ujraepiti a `knowledge_chunks` tablat;
4. minden chunkhoz `embedding_384` vektort keszit.

Fontos: rebuild kozben a tabla atmenetileg kiurulhet. Ez normalis, amig a chunk szam utana ujra novekszik.

## Chat

A chat az aktualis meresi sessionhoz kotodik. A backend a beszelgetes korabbi uzeneteibol kontrollalt meretu kontextust ad at az LLM-nek.

Hangolhato env valtozok:

```env
CHAT_HISTORY_MAX_MESSAGES=120
CHAT_HISTORY_MAX_CHARS=45000
```

Ha a valaszadas tul lassu, ezeket kisebb ertekre lehet venni, peldaul:

```env
CHAT_HISTORY_MAX_MESSAGES=60
CHAT_HISTORY_MAX_CHARS=25000
```

A chat feluleten a betoltott beszelgetes TXT fajlkent letoltheto.

## Mappa Struktura

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

## Backend Uzemeltetes VM-en

Frissites tipikus menete, ha `.tgz` csomag kerul fel a VM home mappajaba:

```bash
mv ~/backend-update.tgz ~/myra/
cd ~/myra
tar -xzvf backend-update.tgz -C ~/myra/
docker compose build backend
docker compose up -d backend
```

Ellenorzes:

```bash
cd ~/myra
docker ps -a
docker logs --tail 80 myra-backend
docker stats myra-backend --no-stream
```

Targyhely ellenorzes:

```bash
df -h /
docker system df
```

Build cache biztonsagos takaritasa:

```bash
docker builder prune -f
```

## Frontend Deploy

A frontend deploy a `frontend` mappabol tortenik:

```bash
cd frontend
npm run deploy
```

Windows CMD:

```cmd
cd /d C:\Users\TonyBrant\Desktop\Myra-Project-App\Myra-project-main\frontend && npm run deploy
```

A deploy folyamat:

1. Expo web export keszul.
2. `scripts/patch-dist.js` javitja a `dist` kimenetet.
3. Letrejon a Vercel proxy function.
4. Frissul a `dist/vercel.json`.
5. Vercel production deploy fut.

## Lokalis Fejlesztes

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

## Kotelezo Env Valtozok

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

## Git / Repo Higienia

Ne keruljon GitHubra:

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

A kovetkezo lokalis segedanyagok nem reszei az eles forraskodnak:

```text
backend-search.py
search-details.py
backend/rag/
```

## Biztonsagi Megjegyzesek

- API kulcsot es `.env` fajlt ne commitolj.
- Eles adatbazis-exportot vagy felhasznaloi adatot tartalmazo fajlt ne commitolj.
- Supabase IP allowlist valtozas utan mindig ellenorizd a login, meres, chat es admin tudasanyag folyamatot.
- Backend restart utan az elso RAG kereses FastEmbed cold start miatt lassabb lehet.
