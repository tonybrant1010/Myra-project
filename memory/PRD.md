# Myra-project — PRD

## Áttekintés
A **Myra-project** egy iOS + Android (Expo) mobil app, amely mentálhigiénés önismereti folyamatot támogat. A felhasználó:
1. Bejelentkezik Google fiókkal (Emergent Google Auth)
2. Kitölt egy külső Google Forms kérdőívet (lépésenkénti onboarding magyarázattal)
3. A kérdőív eredményéből számolt **4 számjegyű ESV-kódot** beírja az appban
4. A **Myra** AI chatbottal beszélget (Gemini 3 Pro), aki a kód mögötti állapot-profil + 5 PDF tudásbázis alapján személyre szabottan reflektál

## ESV-modell (Érzelem–Stressz–Viselkedés)
A kód: `APHC` (4×4×4×4 = 256 kód)
- **A** = STAI Állapotszorongás
- **P** = DERS Érzelemszabályozás (fordított skála: magas P = erős kontroll)
- **H** = PSS Stresszérzékelés
- **C** = PHQ-15 Pszichoszomatikus tünetek
Mind a 256 kód a `state_codes` MongoDB kollekcióban van seedelve a `data/esv_calc.ods` fájlból (forrás: ESV_Calc1.xlsx). Mindegyikhez tartozik diagnózis cím + súlyossági szint (NORMAL/LOW/ELEVATED/CLINICAL) + AI-nak átadott profil.

## Frontend (Expo Router)
- `/` — auth-gate splash
- `/login` — Google login (Myra-project branding, "ESV-modell", "Fejlesztés alatt álló mentálhigiénés eszköz")
- `/forms` — kérdőív launcher + 3-lépéses onboarding
- `/code` — 4-jegyű OTP-stílusú beviteli képernyő
- `/chat` — Myra chat: bal felső sarokban "Myra" cím, jobb felső sarokban a felhasználó kódja
- Side menu — kód, kérdőív újra kitöltése, admin, kijelentkezés
- `/admin` — 256 kód kezelése (csak admin)

## Backend (FastAPI + MongoDB)
- Endpoints változatlanok az előző verzióhoz képest (`/api/auth/session`, `/api/codes/verify`, `/api/chat/send`, admin CRUD…)
- **Új validáció:** kód = 4 számjegy ÉS minden számjegy 1..4 közötti
- **Új AI-kontextus:** a Myra system prompt + felhasználó-specifikus blokk (`A/P/H/C` magyarázott értékekkel + cím + súlyosság + diagnózis) + 5 PDF tudásbázis szövege (`~70k token`) — összesen kb. 100k token system promptként minden chat induláskor. Gemini 3 Pro 1M context window-ja bőven elbír.
- A felhasználó kódja és a belső logika **NEM jelenik meg** a Myra válaszaiban (biztonsági protokoll: a prompt felülírhatatlan szabályként előírja).

## Branding változások
- App neve (app.json): `Myra-project`
- Login képernyő: cím = "Myra-project", overline = "ESV-MODELL", leírás = "Fejlesztés alatt álló mentálhigiénés eszköz."
- Chat topbar cím: "Myra"

## Konfigurálandó környezeti változók (`/app/backend/.env`)
- `FORMS_URL` = `https://forms.gle/6zRNFkaxbt8qArv16` (cserélhető)
- `CHAT_MODEL` = `gemini-3.1-pro-preview`
- `CHAT_PROVIDER` = `gemini`
- `ADMIN_EMAILS` (opcionális allowlist)
- `EMERGENT_LLM_KEY` (előre konfigurálva)

## Adat fájlok
- `/app/backend/data/esv_calc.ods` — 256 kód forrása (eredeti Excel/ODS)
- `/app/backend/data/knowledge_base.txt` — 5 PDF-ből kinyert tudásbázis szöveg
- `/app/backend/data/kb_1.pdf` … `kb_5.pdf` — eredeti PDF tudásbázis

## Műveletek
- Kódok újra-seedelése: `python /app/backend/scripts/seed_codes.py`
- KB újragenerálása: PDF-eket cseréld a `data/` mappában, majd futtasd a kinyerő scriptet (jelenleg ad-hoc Python script-tel)

## Még nyitva
- ⚠️ Google Forms átalakítás: jelenleg külső link, később bekerülhet az appba közvetlen kérdőív + automatikus kódszámítás (a `segedlet` lapról ismert képletekkel: `A=xa/30`, `P=1-xp/30`, `H=xh/20`, `C=xc/10` → küszöbös bucketelés 1-4 közé)
- ⚠️ A 4-jegyű kód jelenleg a user által beírt szám; átirányítás/auto-fill a kérdőívből nincs

## Üzleti / növekedési ötlet
A 256 kód közötti **átmenetek** vizualizálása idővel: ha a user havonta újra kitölti, kapjon egy „térkép-szerű" megjelenítést arról, hogyan vándorolt a 4 dimenzión (pl. C csökken, P nő). Erős memória- és visszahúzó-hatás.
