# Myra Frontend Client

Ez a Myra mentálhigiénés önismereti alkalmazás webes és mobil frontendje, amely React Native és Expo használatával készült, és Vercelre van optimalizálva.

## Fő Technológiai Stack

- **Expo (SDK 51)** és **React Native Web**: Lehetővé teszi az univerzális kódmegosztást és a reszponzív, glassmorphism alapú webes felületet.
- **Expo Router**: Fájlrendszer-alapú navigáció és útvonalkezelés.
- **TypeScript**: Tiszta, típusbiztos kódbázis.
- **Vite/Vercel**: Gyors betöltést biztosító frontend hosztolási és útvonal-átirányítási struktúra.

## Mappa Struktúra

- `/app`: A navigációs képernyők és útvonalak helye (pl. `chat.tsx`, `quiz.tsx`, `welcome.tsx`).
- `/src/components`: Közös UI komponensek (pl. `SideMenu.tsx`, `TopBar.tsx`, `PasswordInput.tsx`).
- `/src/auth`: Bejelentkezési folyamatok és munkamenet-érvényesség kezelése (`AuthContext.tsx`).
- `/assets`: Képek, betűtípusok és dizájn-assetek.
- `/scripts`: Gyártási folyamatokat segítő scriptek (pl. asset patcher Vercel-hez).

## Fejlesztési Folyamat

### Lokális futtatás

1. Telepítsd a függőségeket:
   ```bash
   yarn install
   ```

2. Állítsd be a backend elérését környezeti változóban, majd indítsd el a dev szervert:
   ```bash
   set EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
   npx expo start --web
   ```

## Vercel Élesítés

A projekt élesítése a `frontend` mappából futtatott alábbi paranccsal történik:
```bash
npm run deploy
```
Ez a parancs lefuttatja a webes exportot (`npx expo export --platform web`), alkalmazza a szükséges javításokat az asseteken a `scripts/patch-dist.js` segítségével, majd feltölti a buildet a Vercel-re.

Az API hívások átirányítását a backend felé a `vercel.json` rewrite szabályai kezelik.
