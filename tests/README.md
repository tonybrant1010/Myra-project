# Myra Tesztkörnyezet

Ez a mappa a Myra Project tesztelési keretrendszerét és tesztdokumentációit tartalmazza.

## Fájlok és Tesztek Leírása

- **Root `tests/` mappa**: A teljes projekt szintű tesztelési modulok és gyűjtőhelyük.
- **[backend/tests/test_expiration.py](test_expiration.py)**: A backend 30 napos mérési érvényességi ciklusának és a munkamenet-lezárásoknak (chat blokkolás, figyelmeztető bannerek) az egység- és integrációs tesztjei.

## Tesztek Futtatása

A tesztek futtatásához lépj be a `backend/` mappába, és futtasd a `pytest` parancsot:

```bash
cd backend
pytest -v
```

> [!NOTE]
> A backend tesztek egy teljesen elkülönített, in-memory SQLite adatbázisban (`sqlite+aiosqlite:///:memory:`) futnak le, így nem érintik az éles Supabase adatbázist, nem írnak fájlokat a lemezre, és rendkívül gyorsak.
