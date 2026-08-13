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
Cloudflare Tunnel  (api.myra-project.hu)
  - a VM-en nincs nyitott port
  - cloudflared kifelé épít kapcsolatot
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

A frontend Vercelen fut. A backend Google Cloud VM-en fut Docker konténerben, Cloudflare Tunnel mögött: a VM-nek nincs publikusan nyitott portja. Az adatbázis helye Supabase/Postgres. A VM-en nem fut frontend konténer.

## Fő Funkciók

- felhasználói regisztráció, bejelentkezés és MFA email kód;
- ESV-modell alapú kérdőív és állapotkód-számítás;
- mérési eredményoldal sávonkénti szöveges eredmény-értelmezéssel;
- mérés utáni mikro-cél javaslatok, cél-követés a főoldalon, a célok chat-kontextusba illesztésével;
- proaktív Myra check-in: néhány nap kihagyás után Myra támogató visszakérdezéssel nyitja újra a beszélgetést (admin-beállítás: proactive_checkin_days, 0 = ki);
- ESV25 Inventory szakemberi PDF-összefoglaló (Myra Project arculat, kiemelt figyelmeztetés, teljes módszertani és POMP-transzparencia);
- méréshez kötött Myra chat;
- chat- és mérési előzmények;
- bővített chat kontextus ugyanazon mérési szálon belül;
- TXT beszélgetés-export a chat felületről;
- asztali gépen Enterrel küldés a chatben (Shift+Enter új sor);
- visszajelzés gomb a chat és a Live felületen, közvetlen e-mail-küldéssel a fejlesztőnek;
- fórum-értesítés: jelzés a menüben és a menügombon, ha új poszt érkezett;
- felhasználói adathordozhatóság (GDPR Art. 20) adatexporttal JSON formátumban;
- felhasználói fiók és adatok végleges önkiszolgáló törlése (GDPR Art. 17);
- Gemini Live beszélgetés az aktuális kapcsolat idejére korlátozott kontextussal;
- Fórum (csoportos üzenőfal) egyedi becenevekkel, 12 választható emoji-avatarral, magyar trágárságszűrővel és szerzői/adminisztrátori törlési jogkörökkel;
- PDF-alapú hibrid (pgvector + magyar full-text, RRF) RAG tudásvisszakeresés relevancia-küszöbbel;
- FastEmbed in-memory normalizált embedding gyorsítótár a válaszok gyorsításához és erőforrás-takarékossághoz;
- admin tudásanyag-kezelés PDF feltöltéssel, törléssel és háttérben futó élesítéssel;
- admin rendszerbeállítások, karbantartási mód és SOS eszközök;
- biztonsági adminisztrátori audit naplózás és megerősített brute-force védelem;
- 30 napos mérési érvényességi ciklus és archivált, olvasható beszélgetések;
- Vercel frontend, VM backend, Supabase adatbázis.

## Stack

### Backend

- Python 3.11 / 3.12
- FastAPI
- SQLAlchemy async
- asyncpg
- Supabase/Postgres
- pgvector
- FastEmbed 384 dimenziós lokális embedding és in-memory caching
- pypdf PDF szövegkinyerés
- JWT auth
- Gmail SMTP MFA kódokhoz
- Docker / Docker Compose
- LLM provider admin felületről konfigurálva
- Statikus kód- és függőség-sérülékenység ellenőrzés (bandit, pip-audit)
- Automatizált pytest tesztcsomag (biztonsági és megfelelőségi tesztek: OWASP szűrések, JWT token érvényesség, MFA ellenőrzés, biztonsági HTTP fejlécek validálása és GDPR megfelelőségi folyamatok)

### Frontend

- Expo Router
- React Native Web
- TypeScript
- Vercel deploy
- Expo web export

## Design Irány

A Myra jelenlegi arculati iránya az **Aurora Blue dark calm** rendszer. Ez egy sötét, nyugodt, minimalista,
üvegszerű felület, amely a beszélgetést és a mérést helyezi előtérbe. A design forrása:

```text
design_guidelines.json
frontend/src/theme.ts
frontend/src/components/ContentBackground.tsx
frontend/src/components/TopBar.tsx
```

Design módosításnál az alapelv: a működő app-felület maradjon az első képernyő, ne marketing landing page
legyen belőle. A chat és a Live felület maradjon alacsony zajszintű, gyors, könnyen olvasható és mobilon is
stabil. Új színpaletta, nagyobb vizuális átalakítás vagy Myra promptot érintő változtatás csak külön jóváhagyással
kerülhet be.

## Fontos Működési Részletek

### ESV normalizálás — v2 (POMP, 2026-07-02)

A kvíz normalizálása a pszichometriában standard POMP-skálázást használja (percent of maximum possible): `(összeg − minimum) / (maximum − minimum)`. Képletek: `A(t)=(xa−6)/24`, `P(t)=1−(xp−6)/24`, `H(t)=(xh−4)/16`, `C(t)=xc/10`.

A v1 (2026-07-02 előtt) csak a maximummal osztott, ezért az A/P/H dimenziók nem érték el a skála szélét; a P-nél emiatt a 4-es bucket ("erős érzelemszabályozás") érvényes kitöltésből elérhetetlen volt. A v2 lineáris átskálázás: a kitöltők sorrendjét és a dimenziók közötti korrelációkat nem változtatja meg, de a határközeli kitöltők bucketje eltolódhat. Az új mérések `norms` mezőjében `"v": 2` jelzi a verziót; a régi (v1) mérések változatlanul maradnak, és a 30 napos ciklus végén maguktól lejárnak. A számítási referencia (`backend/data/esv_calc.ods`, ill. a gyökérben az `ESV_Calc1_egyéni_v2.ods`) ugyanezeket a képleteket tartalmazza, üressor-védelemmel (üres adat-sor nem kap értéket és diagnózist).

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

Ez 2026-08-13 óta a második védelmi réteg. Az első a Cloudflare Tunnel: a backend a
`cloudflared` konténeren keresztül, kifelé épített kapcsolattal érhető el az
`api.myra-project.hu` címen. A VM-en nincs publikált port (`docker-compose.yml`-ben a
backendnek nincs `ports:` szekciója), a GCP tűzfalban a 8001-es szabály letiltva.
Kívülről nézve a gép nem válaszol, a proxy-titok pedig akkor is véd, ha az alagút címe
kiderül.

Ellenőrzés kívülről:

```bash
curl -i https://api.myra-project.hu/api/config     # 403, "Direct access to origin is forbidden."
curl -m 5 http://<VM_EXTERNAL_IP>:8001/api/config  # timeout
```

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

### Keresési pipeline (2026-07-03 óta)

Postgres/Supabase alatt a keresés hibrid: pgvector cosine keresés és magyar szótövezett
full-text ág (`to_tsquery('hungarian')`, GIN indexszel) fut egy SQL-ben, az eredmény
RRF-fúzióval áll össze. SQLite (fejlesztői) módban FTS5/BM25 keresés fut. A chunkolás
1400 karakter / 200 átfedés, az embedding a dokumentumcímmel együtt készül. A modellt
egy háttérfolyamat tartja melegen, hogy kevés RAM-ú VM-en se swapoljon ki tétlenség
alatt.

**Változás 2026-08-13:** a szöveges ág korábban `websearch_to_tsquery`-t használt, ami a
szavakat ÉS-sel köti össze — így egy valódi mondatra soha nem talált, mert minden szónak
ugyanabban a chunkban kellett volna szerepelnie. Helyette VAGY-alapú `to_tsquery` épül a
lekérdezésből, a 7 karakternél hosszabb szavak prefixként (`ambivalencia:*`), mert a
magyar szótövező külön lexémát csinál az `ambivalencia` és az `ambivalens` alakból.

Ugyanekkor megszűnt a találati szűrés: a rangsor élén álló `limit` darab chunk **mindig**
átmegy az LLM-hez. Korábban abszolút távolságküszöb vágott, ami magyar szövegen
véletlenszerűen vágott — krízis-megfogalmazásoknál rendszeresen üresen ment ki a prompt.
Egy közepesen illeszkedő részlet ára pár száz token; a nulla részleté hiányos válasz.

RAG-hoz hangolható env változók:

```env
RAG_VECTOR_MAX_DISTANCE=0.62
RAG_CANDIDATE_POOL=20
RAG_KEEPWARM_INTERVAL_S=240
DISABLE_RAG_STARTUP_WARMUP=false
FASTEMBED_MODEL_NAME=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
```

- `RAG_VECTOR_MAX_DISTANCE`: 2026-08-13 óta **nem szűr**, csak diagnosztikai viszonyítási pont a logban.
- `RAG_CANDIDATE_POOL`: a hibrid fuzio jeloltszama aganként.
- `RAG_KEEPWARM_INTERVAL_S`: keep-warm gyakorisag masodpercben; `0` kikapcsolja.
- `DISABLE_RAG_STARTUP_WARMUP=true`: kikapcsolja a startup RAG warmupot, ha gyors kontenerinditas fontosabb az elso RAG keresesi kesleltetesnel.

Diagnosztika: minden keresés `rag_search candidates=... txt_hits=... kept=... best_dist=...`
sort logol. A `txt_hits` a szöveges ág találatait mutatja — ha tartósan 0, a lexikális ág
nem dolgozik. A `scripts/bench_embed.py` a konteneren belul meri a modell betoltesi
idejet, query-latencyt es RAM-igenyt.

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
- az aktuális chunk- és PDF-számot az admin felület Tudásanyag szekciója mutatja.

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
API_REQUEST_MAX_BYTES=1048576
CHAT_MESSAGE_MAX_CHARS=8000
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
preflight, settings, rag, history_db, history_format,
user_db, goals, prompt, llm, reply_db, other
```

Ebből látható, hogy a lassulást a beállítások lekérése, a RAG keresés, az előzmények olvasása,
az LLM hívás vagy a válasz mentése okozza-e.

A `preflight` a kérés eleje a beállítások betöltéséig (három DB-lekérdezés), a `user_db` a
felhasználó üzenetének mentése, a `goals` a célok lekérése, a `prompt` a system prompt
összeállítása. Az **`other` a legfontosabb**: `total` mínusz az összes mért szakasz. A
szakaszok nem fedik át egymást, tehát ha az `other` nagy, a lassulás olyan helyen van,
ahol még nincs mérés — és onnan kell tovább keresni. Normál működésnél `other=0.00s`. A chat előzmény lekéréséhez külön Postgres index
van:

```text
ix_chat_messages_user_session_created_at
```

Ez az aktuális mérési session üzeneteit időrend szerint, limitált mennyiségben tölti vissza, hogy
a beszélgetés folyamatát kövesse, de ne húzza be feleslegesen a teljes régi előzményt.

### Időkezelés

A modell minden időbélyeget **magyar helyi időben** kap: az előzmény-üzenetek bélyegét, az
aktuális üzenetét és a system prompt „Aktuális időpont" sorát is. Az adatbázis továbbra is
UTC-ben tárol; a váltás csak a megjelenítésnél történik (`_to_local`, nyári/téli
időszámítással, és kézi EU-s tartalékszabállyal, ha a konténerből hiányzik a tz-adatbázis).

2026-08-12 előtt a modell nyers UTC-t látott, ezért 14:20-kor 12:20-at hitt, és ennek
megfelelően köszönt vagy tájékozódott az időben.

A válaszból az esetleg beszivárgó `[ÉÉÉÉ.HH.NN ÓÓ:PP]` bélyeg eltávolításra kerül. A szűrő
a hiányzó záró zárójelet és a zárójelen belüli sortörést is kezeli — a modell mindkettőt
produkálta élesben.

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
  tests/
    test_security_headers.py
    test_auth_flow.py
    test_compliance.py
    test_owasp.py
  scripts/
    bench_embed.py
  data/
    kb_pdfs/
      *.pdf
    esv_calc.ods

frontend/
  app/
    chat.tsx
    forum.tsx
    myra-live.tsx
  src/
    components/
      FeedbackButton.tsx
      SideMenu.tsx
      TopBar.tsx
    utils/
      forumSeen.ts
  assets/
  scripts/patch-dist.js
  vercel.json
  package.json

publication/
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

A `docker ps -a` a `myra-backend` mellett egy `myra-docker-socket-proxy` konténert is mutat.
Ez egy szűkre szabott (tecnativa/docker-socket-proxy) proxy a vészleállítás (`/admin/down`)
funkcióhoz: a backend konténer emiatt nem éri el közvetlenül a hoszt `/var/run/docker.sock`-ját,
csak ezen a proxyn keresztül, kizárólag container-stop hívást tud indítani.

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
cd /d <PROJEKT_MAPPA>\frontend && npm run deploy
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

Frontend ellenőrzés deploy előtt:

```bash
cd frontend
npm run typecheck
npm run lint
node --check scripts/patch-dist.js
npm run audit:high
```

Az `audit:high` a szigorú, kézi ellenőrzés — ez ma szándékosan pirosat ad (lásd lentebb).
A CI kapuja az `audit:ci` (`--audit-level=critical`), a magas szintű lista mellette
tájékoztató lépésként fut tovább.

Backend ellenorzes tiszta fejlesztoi kornyezetben:

```bash
cd backend
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m pytest tests
.\.venv\Scripts\python -m bandit server.py scripts\migrate_sqlite_to_postgres.py scripts\seed_codes.py
.\.venv\Scripts\python -m pip_audit -r requirements.txt
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
CLOUDFLARE_TUNNEL_TOKEN=...
```

A `CLOUDFLARE_TUNNEL_TOKEN` a `cloudflared` konténeré. Ha kiszivárog, a Cloudflare Zero
Trust felületen töröld a tunnelt és hozz létre újat — a token nem forgatható a helyén.

Vercel:

```env
MYRA_PROXY_SECRET=...
MYRA_BACKEND_ORIGIN=https://api.myra-project.hu
EXPO_PUBLIC_BACKEND_URL=/api
MYRA_PROXY_TIMEOUT_MS=55000
```

A `MYRA_BACKEND_ORIGIN` 2026-08-13 óta a Cloudflare Tunnel hosztneve, nem a VM IP-je. A
`MYRA_PROXY_TIMEOUT_MS` 55000, hogy a proxy ne vágja el az LLM-választ a Vercel ~60 mp-es
függvénykorlátja előtt.

Vercelen a `MYRA_BACKEND_ORIGIN`/`BACKEND_URL` és a `MYRA_PROXY_SECRET` kötelező. Ha bármelyik hiányzik, a proxy szándékosan hibával leáll, és nem próbál régi, beégetett VM IP-re továbbítani.

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
backend/data/
backend/data/myra.db
```

A következő lokális segédanyagok nem részei az éles forráskódnak:

```text
backend-search.py
search-details.py
backend/rag/
```

## Biztonsági Megjegyzések

- A backend nem érhető el közvetlenül az internetről: Cloudflare Tunnel mögött fut, a VM-en nincs publikált port, a GCP tűzfalban a 8001-es szabály letiltva. A proxy-titok a második réteg.
- A Supabase publikus REST API-ja zárt: minden táblán be van kapcsolva az RLS, policy nélkül — ez Postgresben teljes tiltást jelent. Az `anon` kulccsal semmilyen sor nem olvasható. Ezt ne kapcsold ki: a backend közvetlen Postgres-kapcsolattal, tábla-tulajdonosként dolgozik, nem a REST API-n keresztül.
- API kulcsot és `.env` fájlt ne commitolj.
- Éles adatbázis-exportot vagy felhasználói adatot tartalmazó fájlt ne commitolj.
- Supabase IP allowlist változás után mindig ellenőrizd a login, mérés, chat és admin tudásanyag folyamatot.
- Új admin jogosultságot csak az `ADMIN_EMAIL_ALLOWLIST` adhat; nincs automatikus "első felhasználó admin" kiosztás.
- Backend restart után az első RAG keresés FastEmbed cold start miatt lassabb lehet.
- A jelszó-visszaállító 6 jegyű kód a felhasználónak továbbra is emailben megy ki, de a backend a DB-ben csak hash formában tárolja.
- A regisztráció jogi elfogadása szerveroldalon is kötelező: a backend az aktuális Felhasználási feltételek és Adatkezelési tájékoztató verzióját, valamint az elfogadás idejét eltárolja.
- A belépési MFA és admin műveleti biztonsági kódok kiküldése felhasználó + IP + cél alapján limitált, hogy ne lehessen kódküldéssel email floodot vagy felesleges terhelést okozni.
- A veszélyes admin műveletekhez kért jelszó hibás megadása is audit logba kerül `*.denied` műveletként, jelszó vagy érzékeny adat nélkül.
- A rate-limit tárolók automatikusan takarítják a régi vagy túl sok rekordot, hogy támadás alatt se nőjenek korlátlanul memóriában.
- Az admin beállítások mezőszintű hosszlimiteket kapnak, így túlméretes modelnév, API kulcs, globális üzenet, prompt vagy manuális tudásbázis-szöveg nem kerülhet kontroll nélkül adatbázisba.
- A jelszó-reset frontend hívás a központi `apiUrl()` útvonalat használja, nem fix domainre küld érzékeny adatot.
- A backend és a Vercel frontend alap biztonsági HTTP fejléceket ad: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, éles HTTPS alatt `Strict-Transport-Security`.
- A Vercel API proxy fail-closed módon működik: hiányzó backend origin vagy proxy secret esetén nem továbbít kérést, és nincs beégetett VM IP fallback.
- A backend production módban az `OPTIONS` preflight kéréseket is csak engedélyezett originről engedi proxy secret nélkül; ismeretlen origin vagy direkt origin nélküli OPTIONS kérés 403-at kap.
- A frontend `package.json` célzott `overrides`/`resolutions` réteget használ a magasabb kockázatú transitive build-eszköz sérülékenységek zárására; Expo/React Native főverziót csak külön regressziós teszttel frissíts. A pineket rendszeresen felül kell vizsgálni: egy korábban javító verzió idővel maga is sérülékennyé válhat, és akkor a pin már lefelé rögzít.
- Az `overrides` csak akkor kaphat lapos (verziónként nem bontott) értéket, ha a csomag egyetlen főverzióban van jelen a fában. A `brace-expansion` például négy példányban, négy főverzióval szerepel, és az 5-ös ág már objektumot exportál függvény helyett — lapos override esetén a `minimatch v3` build közben `expand is not a function` hibával áll meg. Ilyenkor `npm ls <csomag>` és a lockfile alapján kell dönteni, nem az `npm audit` javaslata alapján.
- Az `image-size` sérülékenységéhez (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) nincs javított kiadás: a legfrissebb verzió is érintett, és a Metro bundleren keresztül az egész Expo/React Native lánc örökli. Emiatt a `--audit-level=high` kapu nem teljesíthető. A CI ezért `--audit-level=critical` szinten blokkol (`audit:ci`), a magas szintű jelentés pedig nem blokkoló lépésként fut. Ez build idejű, nem futásidejű kockázat: a hibás kód a bundlerben van, nem a böngészőbe kiküldött csomagban, és nem lát felhasználói bemenetet.
- Az `uuid` maradék figyelmeztetése az `xcode` csomagon keresztül jön, ami kizárólag natív iOS-építéshez kell; a webes bundle nem tartalmazza.
- Backend dependency frissítés előtt és után futtasd a `pip-audit -r backend/requirements.txt` ellenőrzést; a framework csomagokat (`fastapi`, `starlette`) mindig együtt validáld teljes backend teszttel.
- Szigorú Content-Security-Policy jelenleg nincs bekapcsolva, mert a Gemini Live/WebSocket és Expo web bundle miatt külön, célzott tesztelést igényelne.
- Az admin log nézet maszkolja az URL-ben vagy headerben megjelenő API kulcsokat és bearer tokeneket.
- Az admin audit log `detail` és `user_agent` mezői mentés előtt is maszkolva vannak, és felhasználótörlésnél csak a belső `user_id` kerül naplózásra, email cím nem.
- A személyes vagy admin jellegű API válaszok `Cache-Control: no-store` fejléccel mennek ki.
- Supabase/Postgres környezetben az adatbázis backup nem az alkalmazásból készül; a tiltott backup-kérés admin audit logba kerül.
