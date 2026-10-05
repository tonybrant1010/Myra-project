# Adatvédelmi hatásvizsgálat (DPIA)

**GDPR 35. cikk szerinti hatásvizsgálat — Myra Project**

| | |
|---|---|
| **Verzió** | 1.1 |
| **Készült** | 2026. augusztus 17. |
| **Módosítva** | 2026. október 4. — backend saját szerveren (Google Cloud megszűnt), biztonsági mentések, K8: „Myra memóriája” |
| **Adatkezelő** | Ódor Antal, magánszemély — odor-antal@research.hu |
| **Következő felülvizsgálat** | 2027. augusztus 17., illetve a 7. pontban felsorolt események bármelyikekor |

---

## 1. Miért kell hatásvizsgálat

Három egymástól független alapon:

**a) A 35. cikk (3) b) pontja** — különleges adatok nagy léptékű kezelése. A „nagy léptékű"
kritérium néhány felhasználónál **vitatható**, ezért önmagában nem erre alapozunk.

**b) A 35. cikk (1) bekezdés általános kockázati tesztje**, a WP248 rev.01 kritériumok
mentén. Ebből **négy** teljesül egyszerre:

| kritérium | teljesül? |
|---|---|
| értékelés vagy pontozás (scoring) | **igen** — állapotkód képzése kérdőívből |
| különleges kategóriájú adat | **igen** — mentális állapotra utaló információ |
| innovatív technológia alkalmazása | **igen** — nagy nyelvi modell és vektoros keresés |
| sérülékeny érintettek | **igen** — mentális terheléssel élő személyek |

Kettő már indokolttá teszi; itt négy van.

**c) A NAIH kötelező listája** (a 35. cikk (4) bekezdése szerint), amelyből kettő illik:
- **5. tétel**: a szolgáltatás minőségét befolyásoló pontozás,
- **10. tétel**: egészségi állapoton vagy viselkedésen alapuló profilalkotás.

**Következtetés: a hatásvizsgálat kötelező.**

---

## 2. Az adatkezelés szisztematikus leírása

### 2.1 Mit csinál a rendszer

A Myra egy magánszemély által, nem kereskedelmi célból üzemeltetett, mérésvezérelt
önismereti alkalmazás. Működési lánca:

1. A felhasználó regisztrál (kizárólag 18 éven felüli), és elfogadja a tájékoztatókat.
2. Kitölt egy önbevalláson alapuló kérdőívet (ESV-modell: érzelem, stressz, viselkedés).
3. A rendszer ebből **belső állapotkódot** képez, amely 30 napig érvényes.
4. A felhasználó chatben beszélget egy nagy nyelvi modellel (Google Gemini), amely megkapja
   az állapotkódot, a beszélgetés előzményét, a vállalt mikro-célokat, és a PDF-tudásanyagból
   az adott üzenethez **relevanciaszűréssel** visszakeresett részleteket.
5. Opcionálisan fórumon oszthat meg tartalmat, és kérhet felolvasást.

### 2.2 Az adatáramlás

```
felhasználó böngészője
   -> Vercel (frontend + API-proxy, közös titokkal)
      -> Cloudflare Tunnel
         -> backend (az adatkezelő saját szervere, Magyarország, Docker, publikált port nélkül)
            -> Supabase PostgreSQL (EU/Írország) — tartós tárolás
            -> óránkénti biztonsági mentés a saját szerveren (48 óra / 30 nap)
            -> Google Gemini API — átmeneti feldolgozás a válaszhoz
```

### 2.3 Az érintettek

Felnőtt, önkéntesen regisztráló felhasználók, jelenleg kis létszámban, kézzel válogatva.
A célcsoport jellegéből adódóan **valószínűsíthetően fokozottan sérülékeny**: mentális
terheléssel, stresszel vagy krízishelyzettel élő személyek.

---

## 3. Szükségesség és arányosság

| kérdés | értékelés |
|---|---|
| Elérhető-e a cél kevesebb adattal? | Az állapotkódhoz a kérdőív elengedhetetlen. A chat-előzmény a beszélgetés folytonosságához kell. **Korlátozva:** 120 üzenet / 45 000 karakter. |
| Elérhető-e a cél AI nélkül? | Nem — a szolgáltatás lényege a beszélgetés. |
| Elérhető-e a cél a tudásanyag továbbítása nélkül? | Nem: enélkül a modell szakmai keret nélkül, hallucinációra hajlamosan válaszolna. **Korlátozva:** legfeljebb 5 részlet, relevanciaküszöbbel; ha nincs releváns találat, nem megy semmi. |
| Arányos-e a jogalap? | Igen: kifejezett hozzájárulás, bármikor visszavonható, a szolgáltatás önkéntes és ingyenes. |
| Van-e adatminimalizálás? | Igen, lásd fent; továbbá a felolvasás hangfájlja átmeneti, a TXT-export a böngészőben készül. |

---

## 4. Kockázatok és kezelésük

A besorolás: **valószínűség × súlyosság**, három fokozatban (alacsony / közepes / magas).

### K1 — Mentális állapotra utaló adat jogosulatlan megismerése

| | |
|---|---|
| **Hatás az érintettre** | súlyos: stigmatizáció, munkahelyi vagy magánéleti hátrány |
| **Kezelés nélküli kockázat** | **magas** |
| **Intézkedések** | jelszó bcrypt hash; kétlépcsős azonosítás; TLS-kényszer az adatbázis felé; publikált port nélküli backend Cloudflare Tunnelen; útvonalszűrő; proxy-titok; zárt szerver-tűzfal, SSH csak helyi hálózatról; az adatbázis csak a szerver IP-címéről érhető el; védett fájlok integritásfigyelése automatikus karanténnal; sebességkorlátozás |
| **Maradék kockázat** | **alacsony–közepes** |

### K2 — Az AI-szolgáltatóhoz továbbított tartalom

| | |
|---|---|
| **Hatás** | a beszélgetés tartalma harmadik félhez kerül |
| **Kezelés nélküli kockázat** | **magas** |
| **Intézkedések** | fejlesztői (API) felület, amelynek feltételei kizárják a modelltanításra való felhasználást; a továbbított kontextus korlátozott és relevanciaszűrt; a tartós tárolás az EU-ban marad; a tájékoztató 7. pontja tételesen felsorolja, mi kerül továbbításra |
| **Maradék kockázat** | **közepes** — a továbbítás ténye nem szüntethető meg, csak korlátozható |

### K3 — Harmadik országba történő továbbítás jogalapjának megszűnése

| | |
|---|---|
| **Hatás** | a továbbítás jogalap nélkülivé válhat |
| **Kezelés nélküli kockázat** | **közepes** |
| **Intézkedések** | a megfelelőségi határozat mellett általános szerződési feltételek is rendelkezésre állnak; a tartós tárolás EU-n belül |
| **Maradék kockázat** | **közepes** — a *Latombe* ügy fellebbezése folyamatban, **figyelendő** |

### K4 — Téves vagy káros AI-válasz krízishelyzetben

| | |
|---|---|
| **Hatás** | **a legsúlyosabb lehetséges kimenet**: a felhasználó nem kap időben élő segítséget |
| **Kezelés nélküli kockázat** | **magas** |
| **Intézkedések** | krízisfelismerő modul, amely külön biztonsági keretet aktivál; a keret előírja a 112 és a 116-123 megjelenítését és az élő segítség felé terelést; az ÁSZF 3. pontja külön szakaszban rögzíti, hogy a rendszer nem sürgősségi szolgáltatás; a rendszerprompt tiltja a módszerismertetést és a moralizálást; súlyos krízisjelzés esetén az adatkezelő e-mail-értesítést kap az üzenet szövegével (felhasználónként legfeljebb 6 óránként) |
| **Maradék kockázat** | **közepes** — nyelvi modell viselkedése nem garantálható |
| **Nyitott** | a krízisprotokoll szövege jelenleg a „tudásanyag, soha ne idézd" fejléc alatt kerül a promptba, holott szó szerint kimondandó mondatot és segélyhívó számokat tartalmaz. **Ez ellentmondás, javítandó.** |

### K5 — Az állapotkód orvosi minősítésként való félreértelmezése

| | |
|---|---|
| **Hatás** | a felhasználó öndiagnózist von le, vagy elhalasztja a szakemberhez fordulást |
| **Kezelés nélküli kockázat** | **közepes–magas** |
| **Intézkedések** | az ÁSZF 1. és 2. pontja kifejezetten kizárja a diagnosztikai és terápiás rendeltetést; a letölthető összefoglaló is tartalmazza a kizárást; a rendszerprompt tiltja a szakzsargont és a kioktató elemzést |
| **Maradék kockázat** | **közepes** — a megfogalmazás következetessége folyamatos figyelmet kíván (MDR-határvonal) |

### K6 — A fórumon közzétett különleges adat

| | |
|---|---|
| **Hatás** | a felhasználó önmagáról nyilvánosan oszt meg egészségi állapotra utaló adatot |
| **Kezelés nélküli kockázat** | **közepes** |
| **Intézkedések** | a közzététel a felhasználó saját, tudatos döntése; moderálási eljárás a Felhasználási feltételek 8. pontja szerint; bejelentési lehetőség; hatósági értesítés élet elleni fenyegetés esetén |
| **Maradék kockázat** | **alacsony–közepes** |

### K7 — Adatvesztés vagy rendelkezésre állási hiba

| | |
|---|---|
| **Hatás** | a felhasználó elveszíti az előzményeit, vagy nem éri el a szolgáltatást |
| **Kezelés nélküli kockázat** | **közepes** |
| **Intézkedések** | Supabase mint felügyelt adatbázis-szolgáltatás; óránkénti saját mentés (48 óra / 30 nap), második lemezre tükrözve; telepítés utáni füstteszt automatikus visszaállással; futásidejű figyelő e-mailes riasztással; karbantartás alatt tájékoztató oldal; adathordozhatóság a felhasználó felé (JSON-export) |
| **Megjegyzés** | a saját szerver otthoni internetkapcsolaton és dinamikus IP-címen működik: áramszünet, hálózati hiba vagy IP-változás átmeneti kiesést okozhat |
| **Maradék kockázat** | **alacsony** |

### K8 — „Myra memóriája”: egészségi állapotra utaló profil-kivonat

| | |
|---|---|
| **Hatás** | a mentális állapotról összesített, AI által írt kivonat jön létre; pontatlan lehet, és megismerése súlyosabb a különálló üzeneteknél |
| **Kezelés nélküli kockázat** | **közepes–magas** |
| **Intézkedések** | külön, önálló hozzájárulás, alapból kikapcsolva; kikapcsoláskor a kivonat és az üzenet-keresővektorok azonnali törlése; a keresővektorok a saját szerveren készülnek, külső szolgáltatóhoz nem kerülnek; Myra magától csak magas relevanciájú korábbi részletet hozhat elő; leíró jelleg, nem diagnózis, nem automatizált döntés; Myra nem idézheti fel nyíltan; a felhasználó a JSON-exportban látja a pontos szövegét; az admin általi újraképzés és törlés naplózott |
| **Maradék kockázat** | **alacsony–közepes** |

---

## 5. Az érintettek véleménye (35. cikk (9))

Formális konzultáció nem történt. Indokolás: a felhasználói kör jelenleg kicsi és
kézzel válogatott, a visszajelzés közvetlen és folyamatos (visszajelzés gomb az
alkalmazásban, illetve közvetlen kapcsolat). **A felhasználószám érdemi növekedése
esetén strukturált visszajelzés-gyűjtés indokolt.**

---

## 6. Következtetés

Az azonosított kockázatok az intézkedések után **nem érik el azt a szintet, amely a
GDPR 36. cikke szerinti előzetes konzultációt tenné szükségessé a NAIH-nál**. Két
kockázat marad tartósan közepes szinten, és ezek nem szüntethetők meg, csak kezelhetők:

- **K2** — az AI-szolgáltatóhoz továbbítás ténye,
- **K4** — a nyelvi modell viselkedése krízishelyzetben.

Ezek a szolgáltatás természetéből következnek. A kezelésük folyamatos figyelmet igényel.

**Egy azonosított, kijavítandó ellentmondás:** a krízisprotokoll a „soha ne idézd"
fejléc alatt kerül a promptba (lásd K4).

---

## 7. Mikor kell újra elvégezni

- ha biometrikus bemenet kerül a rendszerbe (hangszín-elemzés, kamera, gépelési dinamika) — **ekkor az AI-rendelet szerinti nagy kockázatú besorolás is felmerül**;
- ha a felhasználószám nagyságrendet nő;
- ha a szolgáltatás 18 éven aluliak felé nyílik;
- ha a szolgáltatás kereskedelmi jelleget ölt;
- ha az EU–USA adatvédelmi keret megfelelőségi határozata megszűnik vagy módosul;
- ha új adatkategória vagy új adatfeldolgozó kerül a rendszerbe;
- egyébként évente.

---

## 8. Kapcsolódó dokumentumok

- Adatkezelési tevékenységek nyilvántartása: `docs/adatkezelesi-nyilvantartas.md`
- Adatkezelési tájékoztató: `frontend/src/constants/docs/gdpr.ts`
- Felhasználási feltételek: `frontend/src/constants/docs/terms.ts`
- NAIH kötelező hatásvizsgálati lista: https://www.naih.hu/hatasvizsgalati-lista
