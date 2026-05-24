# Myra-project

Önállóan hosztolható mentálhigiénés önismereti webapp + AI chatbot (Myra).
Magyar nyelvű ESV-modell mérés (256 állapotkód), kalmáló UI, és egy konfigurálható
LLM (OpenAI / Anthropic / Google Gemini) beszélgető-partner.

## Stack
- **Backend**: FastAPI (Python 3.11+) · SQLite (`backend/data/myra.db`) · JWT auth (bcrypt)
- **Frontend**: Expo Router (React Native + web)
- **AI**: az admin által beállítható provider/modell/API kulcs (egyetlen külső függőség)

## Self-host (saját szerveren)

1. **Klónozd** a repót, lépj be:
   ```bash
   git clone <repo-url> myra-project && cd myra-project
   ```

2. **Hozz létre `.env`**-et a gyökérbe:
   ```env
   JWT_SECRET=valami-min-32-karakteres-titok
   ADMIN_EMAIL_ALLOWLIST=te@email.hu
   EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
   ```

3. **Indítsd**:
   ```bash
   docker compose up -d
   ```

4. **Seedeld a 256 ESV kódot** (egyszer):
   ```bash
   docker compose exec backend python scripts/seed_codes.py
   ```

5. **Nyisd meg**: http://localhost:3000

6. **Első bejelentkezés** → az első regisztráló admin lesz (vagy aki az `ADMIN_EMAIL_ALLOWLIST`-en).
   Lépj be → side menu → **Chatbot beállítások** → válaszd a providert (OpenAI / Anthropic / Gemini),
   add meg a modell nevét és az API kulcsod. Innen az AI máris él.

## Manuális (Docker nélkül)

```bash
# Backend
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
echo "JWT_SECRET=valami-min-32-karakteres-titok" > .env
echo "DATABASE_URL=sqlite+aiosqlite:////$(pwd)/data/myra.db" >> .env
python scripts/seed_codes.py
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend (másik terminálban)
cd ../frontend
echo "EXPO_PUBLIC_BACKEND_URL=http://localhost:8001" > .env
yarn install
yarn start --web
```

## API kulcs beszerzés
- **OpenAI** → https://platform.openai.com/api-keys
- **Anthropic (Claude)** → https://console.anthropic.com/settings/keys
- **Google Gemini** → https://aistudio.google.com/apikey

## Architektúra elvek
- **Független**: nincs külső auth / külső DB / külső LLM kulcs-szolgáltató. Minden a saját
  konténeredben fut, az LLM hívás az admin által megadott provider API-jához megy.
- **Egyetlen .db fájl**: minden adatod (user, ESV-kód, chat, beállítás) `backend/data/myra.db`-ben.
  Backup = ezt a fájlt másold le.
- **JWT auth**: stateless, a kliens tárolja a tokent. Logout = kliens-oldali token-törlés.

## Backup / migráció
```bash
# Backup
cp backend/data/myra.db backups/myra-$(date +%F).db

# Migrate to new host
scp backend/data/myra.db user@server:/path/to/myra-project/backend/data/
```
