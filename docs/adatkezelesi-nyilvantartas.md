# Adatkezelési tevékenységek nyilvántartása

**GDPR 30. cikk (1) bekezdés szerinti nyilvántartás**

| | |
|---|---|
| **Verzió** | 1.1 |
| **Készült** | 2026. augusztus 17. |
| **Módosítva** | 2026. október 4. — a backend saját szerverre költözött (Google Cloud megszűnt), biztonsági mentések, „Myra memóriája” (2.9), Supabase-régió pontosítva |
| **Következő felülvizsgálat** | 2027. augusztus 17., vagy bármely lényeges változás esetén |

---

## Miért kötelező ez a nyilvántartás

A GDPR 30. cikk (5) bekezdése mentesíti a 250 főnél kevesebb személyt foglalkoztató
szervezeteket — **de a mentesség itt nem áll fenn.** Elveszik, ha az adatkezelés

- nem alkalmi, **vagy**
- kockázatot jelenthet az érintettek jogaira, **vagy**
- **a 9. cikk szerinti különleges adatokat is érint.**

A Myra folyamatosan kezel mentális állapotra utaló adatot, tehát mindhárom feltétel
teljesül. A nyilvántartás vezetése kötelező, és kérésre a NAIH rendelkezésére kell bocsátani.

---

## 1. Az adatkezelő

| | |
|---|---|
| Név | Ódor Antal |
| Jogállás | magánszemély, nem kereskedelmi célú kutatási és fejlesztési projekt |
| E-mail | odor-antal@research.hu |
| Adatvédelmi tisztviselő | nincs kijelölve — lásd az indokolást a 8. pontban |
| Képviselő (GDPR 27. cikk) | nem releváns, az adatkezelő az EU-ban letelepedett |

---

## 2. Adatkezelési tevékenységek

### 2.1 Felhasználói fiók kezelése

| | |
|---|---|
| **Cél** | fiók létrehozása, azonosítás, bejelentkezés, jogosultságkezelés |
| **Jogalap** | GDPR 6. cikk (1) a) — hozzájárulás |
| **Érintettek** | regisztrált felhasználók (kizárólag 18 éven felüliek) |
| **Adatkategóriák** | név, e-mail cím, jelszó egyirányú hash formában, regisztráció és bejelentkezés időpontja, kétlépcsős azonosítás adatai, megbízható eszköz azonosítója |
| **Címzettek** | Supabase (adatbázis), Vercel (frontend és API-proxy), Cloudflare (titkosított átjáró); az alkalmazásszervert az adatkezelő maga üzemelteti |
| **Harmadik ország** | lásd 4. pont |
| **Törlési határidő** | a fiók törléséig; törléskor azonnali és végleges |

### 2.2 Állapotfelmérés és állapotkód

| | |
|---|---|
| **Cél** | önkitöltős kérdőív rögzítése, belső állapotkód képzése és megjelenítése, korábbi mérések visszanézhetősége |
| **Jogalap** | 6. cikk (1) a) + **9. cikk (2) a) — kifejezett hozzájárulás** |
| **Érintettek** | regisztrált felhasználók |
| **Adatkategóriák** | kérdőívre adott válaszok, számított állapotkód, mérési időpont, a kód érvényességi ideje — **különleges adat: mentális állapotra utaló információ** |
| **Címzettek** | Supabase |
| **Törlési határidő** | a fiók törléséig; az állapotkód 30 nap után lejár, de az adat megmarad |

### 2.3 Chat-beszélgetés

| | |
|---|---|
| **Cél** | személyre szabott önismereti beszélgetés, a beszélgetés folytonosságának biztosítása |
| **Jogalap** | 6. cikk (1) a) + **9. cikk (2) a)** |
| **Érintettek** | regisztrált felhasználók |
| **Adatkategóriák** | felhasználói üzenetek tartalma, AI-válaszok, időbélyegek, munkamenet-azonosító — **különleges adat** |
| **Címzettek** | Supabase; **Google (Gemini API)** a válasz generálásához |
| **Továbbított tartalom** | az aktuális üzenet, a beszélgetés korábbi részletei (legfeljebb 120 üzenet / 45 000 karakter), az állapotkódhoz kapcsolódó kontextus, a vállalt mikro-célok, és a tudásanyagból visszakeresett részletek |
| **Harmadik ország** | igen — lásd 4. pont |
| **Törlési határidő** | a fiók törléséig |

### 2.4 Mikro-célok

| | |
|---|---|
| **Cél** | a felhasználó által önkéntesen vállalt apró önismereti célok rögzítése és követése |
| **Jogalap** | 6. cikk (1) a) + 9. cikk (2) a) |
| **Adatkategóriák** | a cél szövege, állapota (aktív/teljesített), létrehozás és teljesítés időpontja |
| **Címzettek** | Supabase; a cél szövege bekerül a Gemininek küldött kontextusba |
| **Törlési határidő** | a fiók törléséig |

### 2.5 Fórum

| | |
|---|---|
| **Cél** | felhasználók közötti nyilvános eszmecsere biztosítása |
| **Jogalap** | 6. cikk (1) a) — hozzájárulás; a közzététel a felhasználó saját döntése |
| **Adatkategóriák** | bejegyzés szövege, becenév, időbélyeg — **a felhasználó által közzétett tartalom különleges adatot is tartalmazhat** |
| **Címzettek** | Supabase; a bejegyzés más felhasználók számára látható |
| **Törlési határidő** | a fiók törléséig, illetve moderálási döntésig |
| **Megjegyzés** | a moderálási eljárást a Felhasználási feltételek 8. pontja írja le (DSA) |

### 2.6 Felolvasás (TTS)

| | |
|---|---|
| **Cél** | az AI-válasz hangos felolvasása a felhasználó kérésére |
| **Jogalap** | 6. cikk (1) a) |
| **Adatkategóriák** | a felolvasandó válasz szövege |
| **Címzettek** | **Google (Gemini TTS API)** |
| **Törlési határidő** | a hangfájl átmeneti, a kiszolgálás után törlődik; tartósan nem tárolódik |

### 2.7 Biztonság, naplózás, visszaélés-megelőzés

| | |
|---|---|
| **Cél** | jogosulatlan hozzáférés és túlterhelés megelőzése, hibakeresés, üzemeltetés |
| **Jogalap** | GDPR 6. cikk (1) f) — az adatkezelő jogos érdeke a szolgáltatás biztonságos működtetéséhez |
| **Adatkategóriák** | IP-cím, eszköz- és böngészőinformáció, hozzáférési kísérletek, hibanaplók, sebességkorlát-események |
| **Címzettek** | az adatkezelő saját szervere (nem kerül harmadik félhez), riasztási e-mail (Gmail) |
| **Törlési határidő** | a konténer naplója a konténer élettartamáig; a biztonsági események az admin felületen törölhetők; riasztási e-mailek a postafiók szabályai szerint |
| **Megjegyzés** | **Nem terjed ki a szükséges mértéken túlmutató tartalomelemzésre.** |

### 2.8 Mérési összefoglaló (PDF)

| | |
|---|---|
| **Cél** | a felhasználó kérésére, szakembernek szánt összefoglaló előállítása |
| **Jogalap** | 6. cikk (1) a) + 9. cikk (2) a) |
| **Adatkategóriák** | mérési eredmények, állapotkódok, időpontok |
| **Címzettek** | kizárólag a felhasználó; a megosztásról ő dönt |
| **Törlési határidő** | szerveroldalon nem tárolódik, kérésre generálódik |

### 2.9 „Myra memóriája” (felhasználói profil-kivonat)

| | |
|---|---|
| **Cél** | a korábbi mérésekből, célokból és beszélgetésekből képzett esetösszefoglaló, amelyet Myra a válaszadásnál figyelembe vesz; a mostanihoz hasonló korábbi beszélgetésrészletek jelentés szerinti visszakeresése |
| **Jogalap** | 6. cikk (1) a) + **9. cikk (2) a) — külön, önálló kifejezett hozzájárulás** (alapból kikapcsolva, a felhasználó kapcsolja be a Beállításokban) |
| **Adatkategóriák** | AI által képzett, leíró jellegű kivonat a mérésekről, célokról és a beszélgetésekről — **különleges adat: mentális állapotra utaló információ**; forrás-üzenetszám, mérésszám, készítés ideje; a felhasználói üzenetekből a saját szerveren képzett keresővektorok (`chat_message_embeddings`) |
| **Címzettek** | Supabase (tárolás), Google (Gemini API — a kivonat elkészítéséhez és a válaszadáshoz); az adatkezelő az admin felületen megtekintheti, újraképezheti, törölheti |
| **Törlési határidő** | a hozzájárulás visszavonásakor (kikapcsolás) azonnal, a keresővektorokkal együtt; a fiók vagy az üzenet törlésekor azonnal; biztonsági mentésekből legkésőbb 30 napon belül |
| **Megjegyzés** | a bekapcsoláskor azonnal elkészül a korábbi adatokból, ezután új mérés vagy 30 új üzenet után frissül; nem diagnózis, nem szolgál automatizált döntés alapjául |

### 2.10 Biztonsági mentés

| | |
|---|---|
| **Cél** | adatvesztés elleni védelem, a rendszer helyreállíthatósága |
| **Jogalap** | GDPR 6. cikk (1) f) — jogos érdek; a különleges adatokra a 9. cikk (2) a) szerinti hozzájárulás kiterjed |
| **Adatkategóriák** | a teljes felhasználói adatbázis tartalma |
| **Címzettek** | nincs — az adatkezelő saját, Magyarországon elhelyezett szerverén, korlátozott hozzáféréssel |
| **Törlési határidő** | óránkénti mentés 48 óra, napi mentés 30 nap, utána automatikus törlés |
| **Megjegyzés** | a mentésekhez kizárólag adatvesztés esetén, helyreállítás céljából nyúl az adatkezelő; az admin felületről letölthető mentés a tudásanyag-index nélküli, felhasználói adatokat tartalmazó változat |

### 2.11 Krízisjelzés az adatkezelőnek

| | |
|---|---|
| **Cél** | súlyos krízisjelzés (öngyilkossági vagy önsértési szándék) esetén az adatkezelő értesítése, hogy szükség esetén megtehesse az ÁSZF 8. pontja szerinti lépéseket |
| **Jogalap** | GDPR 6. cikk (1) d) és 9. cikk (2) c) — az érintett létfontosságú érdeke; emellett a 9. cikk (2) a) szerinti hozzájárulás |
| **Adatkategóriák** | név, e-mail-cím, időpont, a jelzést kiváltó üzenet szövege (legfeljebb 500 karakter) — **különleges adat** |
| **Címzettek** | az adatkezelő saját postafiókja (Gmail SMTP-n keresztül) |
| **Törlési határidő** | az értesítő e-mail az ügy lezárása után, legkésőbb 30 napon belül törlendő; a biztonsági eseménynaplóban csak a felhasználó azonosítója és az időpont marad, üzenetszöveg nélkül |
| **Megjegyzés** | csak kulcsszavas, súlyos jelzésre indul; felhasználónként legfeljebb 6 óránként egy értesítés; nem folyamatos felügyelet és nem sürgősségi szolgáltatás |

---

## 3. Adatfeldolgozók

| Feldolgozó | Szerep | Tárolás helye |
|---|---|---|
| Supabase | felhasználói adatbázis (PostgreSQL, pgvector) | **EU — Írország (eu-west-1 régió)** |
| Vercel | frontend kiszolgálás és API-proxy | globális CDN — tartós adat nem tárolódik |
| Cloudflare | titkosított alagút (Tunnel) a backendhez, DNS, WAF | globális — átmenő forgalom, tartós adat nem tárolódik |

Az alkalmazásszerver (backend) 2026. október 4. óta az adatkezelő saját, Magyarországon
elhelyezett szerverén fut; ez nem adatfeldolgozó, hanem az adatkezelő saját eszköze.
| Google (Gemini API) | AI-válasz és felolvasás generálása | lásd 4. pont |
| Google (Gmail SMTP) | rendszerriasztások küldése | — |

Az AI-szolgáltatók fejlesztői (API) felületein keresztül történik a továbbítás, amelyek
szerződéses feltételei kizárják a beküldött adatok modelltanításra való felhasználását.

---

## 4. Harmadik országba történő továbbítás

| | |
|---|---|
| **Érintett feldolgozók** | Google (Gemini API), Vercel, Cloudflare |
| **Célország** | Amerikai Egyesült Államok |
| **Garancia** | EU–USA adatvédelmi keret (Data Privacy Framework) megfelelőségi határozat a keret tanúsított résztvevőinél; egyébként az Európai Bizottság általános szerződési feltételei (GDPR 46. cikk (2) c)) |
| **Kockázati megjegyzés** | a megfelelőségi határozat 2026 augusztusában érvényes, de a Törvényszék *Latombe* (T-553/23) ítélete ellen fellebbezés van folyamatban a Bíróság előtt. **Felülvizsgálandó, ha az ügyben döntés születik.** |

A tartós felhasználói adatbázis szándékosan az EU-ban (Írország) marad, a biztonsági mentések Magyarországon.

---

## 5. Technikai és szervezési intézkedések (GDPR 32. cikk)

**Hozzáférés és hitelesítés**
- Jelszavak egyirányú hash (bcrypt) formában tárolva, visszafejthetetlenül.
- Kétlépcsős azonosítás (TOTP) a bejelentkezéshez.
- Munkamenet-lejárat: adminisztrátor 1 óra, normál felhasználó legfeljebb 7 nap tétlenség.
- Admin funkciók e-mail-alapú engedélyezőlistához kötve.

**Hálózati elhatárolás**
- A backend **nem publikál portot** az interneten (2026-08-13 óta). Kizárólag Cloudflare Tunnelen keresztül érhető el, amely kifelé épít kapcsolatot.
- A tunnel útvonalszűrője csak az `^/api/.*` mintát engedi tovább, minden más 404.
- A Vercel-proxy és a backend közös titkot használ (`X-Myra-Proxy-Secret`); enélkül a kérés elutasításra kerül.
- A szerver tűzfala (UFW) a bejövő irányban zárt; SSH kizárólag a helyi hálózatról érhető el, publikus port nincs.
- A backend csak a szerveren belül (`127.0.0.1`) figyel; az adatbázis IP-alapú hozzáférés-korlátozása kizárólag a szerver címét engedi.

**Adatbázis**
- Kizárólag TLS-en keresztüli kapcsolat (`DATABASE_SSL_MODE=require`).
- A tudásanyag technikai keresési adatai (embeddingek) elkülönítve a felhasználói beszélgetésektől.

**Alkalmazásszintű védelem**
- Végpontonkénti sebességkorlátozás (chat, felolvasás, visszajelzés, fórum).
- Biztonsági HTTP-fejlécek (CSP, X-Frame-Options, HSTS, Referrer-Policy).
- A Docker-daemonhoz csak szűkített jogosultságú proxyn keresztül van hozzáférés, kizárólag konténerleállításra.

**Felügyelet és helyreállítás**
- Futásidejű figyelő szolgáltatás (`ops/myra-watch.py`), amely OOM-, hiba- és jogosulatlan hozzáférési eseményekre e-mailben riaszt.
- Telepítés utáni füstteszt automatikus visszaállással (`ops/myra-deploy.py`): ha egy végpont eltűnik, a rendszer visszaáll az előző működő verzióra.
- A védett fájlok (`server.py`, `.env`, compose) ujjlenyomatának figyelése; eltérés esetén automatikus karantén (karbantartási oldal a felhasználóknak).
- Óránkénti adatbázis-mentés (`ops/myra-backup.sh`), 48 órás / 30 napos megőrzéssel, második lemezre tükrözve.

**Adatminimalizálás**
- A Gemininek küldött kontextus korlátos: legfeljebb 120 üzenet / 45 000 karakter előzmény, és legfeljebb 6 tudásanyag-részlet, relevanciaszűréssel és újrarangsorolással; a tudásanyag-keresés (embedding és újrarangsorolás) helyben, a saját szerveren fut, nem külső szolgáltatónál.
- A TTS hangfájl átmeneti, kiszolgálás után törlődik.

---

## 6. Érintetti jogok gyakorlása

| Jog | Hogyan biztosított |
|---|---|
| Hozzáférés (15. cikk) | Beállítások → Adatok letöltése |
| Helyesbítés (16. cikk) | Beállítások, illetve e-mailben |
| Törlés (17. cikk) | Beállítások → Fiók törlése — azonnali és végleges; a mentésekből legkésőbb 30 napon belül |
| Korlátozás (18. cikk) | e-mailben |
| Hordozhatóság (20. cikk) | Beállítások → Adatok letöltése, gépileg olvasható JSON |
| Tiltakozás (21. cikk) | e-mailben, a jogos érdeken alapuló kezelés ellen |
| Hozzájárulás visszavonása | a fiók törlésével; a „Myra memóriája” esetén a Beállításokban a kapcsoló kikapcsolásával (a kivonat azonnal törlődik) |

---

## 7. Adatvédelmi incidens kezelése

Incidens gyanúja esetén: a hatás felmérése, a hozzáférés lezárása, a napló megőrzése.
Ha az incidens valószínűsíthetően kockázattal jár: **bejelentés a NAIH felé 72 órán belül**
(33. cikk). Ha magas kockázattal jár — egészségügyi jellegű adat esetén ez valószínű —:
**az érintettek közvetlen tájékoztatása** (34. cikk).

---

## 8. Adatvédelmi tisztviselő (37. cikk)

**Nincs kijelölve.** Indokolás: a 37. cikk (1) b) pontja *fő tevékenységként* végzett,
*nagymértékű, rendszeres és szisztematikus megfigyelést* kíván; a c) pont *nagy számban*
kezelt különleges adatot. A Myra néhány, kézzel válogatott felhasználót szolgál ki,
nem kereskedelmi célból. **A felhasználószám növekedése esetén ezt újra kell értékelni.**

---

## 9. Kapcsolódó dokumentumok

- Adatkezelési tájékoztató (felhasználóknak): `frontend/src/constants/docs/gdpr.ts`
- Felhasználási feltételek: `frontend/src/constants/docs/terms.ts`
- Adatvédelmi hatásvizsgálat: `docs/hatasvizsgalat-dpia.md`
