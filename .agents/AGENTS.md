# Myra Project - Fejlesztési és Telepítési Szabályok

Ez a szabálygyűjtemény a Myra Project környezetének biztonsági, fejlesztési és telepítési lépéseit, valamint abszolút útvonalait írja le. Az AI asszisztensnek ezeket a szabályokat szigorúan be kell tartania minden javaslat és parancsmegosztás során.

---

## 1. Frontend Élesítési és Build Parancsok
Bármikor, amikor a frontend módosításait kell élesíteni (Vercel deploy), a parancsnak mindig pontosan így kell kinéznie, az abszolút elérési út megadásával:

```powershell
cd c:\Users\TonyBrant\Desktop\Myra-Project-App\Myra-project-main\frontend
npm run deploy
```

---

## 2. Backend Élesítési Folyamat (VM / Docker Compose)

A backend VM-re történő manuális feltöltése során az alábbi szabályokat kell követni:

### A) Archívum (.tgz) létrehozása
* **SOHA** ne csomagold be a teljes projektet. A `.tgz` fájl **kizárólag** a ténylegesen módosított fájlokat tartalmazhatja (pl. `backend/server.py` és `backend/requirements.txt`).
* **SOHA** ne használd ugyanazt a fájlnevet a tgz-hez (pl. ne használd újra a korábbi `backend-supabase-update.tgz`-t), mert a GCP feltöltő átnevezi a fájlt ütközés esetén. Mindig adj egyedi, a feladatra utaló nevet az archívumnak (pl. `backend-sos-update.tgz`).

### B) Futtatandó parancsok a VM-en (kicsomagolás és indítás)
Mindig a következő parancssorozatot add meg a felhasználónak a VM-en történő élesítéshez:

1. **Kicsomagolás** a projekt gyökérbe (ez csak a módosított fájlokat írja felül, a `.env` és `data` mappák érintetlenek maradnak):
   ```bash
   tar -xzf ~/<egyedi-archivum-nev>.tgz -C ~/myra
   ```

2. **Újraépítés és újraindítás** (ha változtak a függőségek vagy a docker-compose):
   ```bash
   cd ~/myra
   docker compose build backend
   docker compose up -d backend
   ```

---

## 3. Általános magatartási szabályok
* **Ne feltételezz semmit:** Ha bizonytalan vagy a VM-en lévő fájlok állapotában, kérd meg a felhasználót, hogy futtassa le a listázó parancsot, ahelyett hogy feltételeznéd a sikerességet vagy a fájlok meglétét.
