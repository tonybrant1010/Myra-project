#!/bin/bash
# Myra mentes – Supabase valtozat (2026-10). Helyi adatbazis nincs.
# Amit ment: orankent a Supabase public semajanak teljes dumpja (halozaton at,
# a hoszt pg_dump-javal), naponta egyszer emelle a konfig + a tudasanyag PDF-jei.
# A jelszo kornyezeti valtozoban megy at, nem a parancssorban.
# Kell hozza: postgresql-client, legalabb 17-es (a Supabase PostgreSQL 17).
set -uo pipefail
SRC=/home/myra-admin/myra
LOCAL=/home/myra-admin/myra-backups
MIRROR=/mnt/win/MyraBackup
STAMP=$(date +%Y%m%d-%H%M)
TODAY=$(date +%Y%m%d)

mkdir -p "$LOCAL/orankent" "$LOCAL/napi"
chmod 700 "$LOCAL"

# Kapcsolodasi adatok a .env DATABASE_URL-jebol -> PG* kornyezeti valtozok.
eval "$(python3 - "$SRC/.env" <<'PY'
import shlex, sys
from urllib.parse import urlparse, unquote
env = {}
for sor in open(sys.argv[1], encoding="utf-8"):
    sor = sor.strip()
    if sor and not sor.startswith("#") and "=" in sor:
        k, v = sor.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
u = urlparse(env.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://"))
ertekek = {
    "PGHOST": u.hostname or "",
    "PGPORT": str(u.port or 5432),
    "PGDATABASE": (u.path or "/postgres").lstrip("/") or "postgres",
    "PGUSER": unquote(u.username or ""),
    "PGPASSWORD": unquote(u.password or ""),
    "PGSSLMODE": env.get("DATABASE_SSL_MODE") or "require",
    "PGCONNECT_TIMEOUT": "15",
}
for k, v in ertekek.items():
    print(f"export {k}={shlex.quote(v)}")
PY
)"
if [ -z "${PGHOST:-}" ]; then
  echo "HIBA: nincs DATABASE_URL az .env-ben, a mentes kimaradt"
  exit 1
fi

DUMP="$LOCAL/orankent/db-$STAMP.sql.gz"
pg_dump -n public --no-owner --no-privileges --clean --if-exists | gzip > "$DUMP"
# Ures vagy csonka dumpot nem tartunk meg: az hamis biztonsagerzetet ad.
if [ ! -s "$DUMP" ] || [ "$(stat -c%s "$DUMP")" -lt 1000 ]; then
  rm -f "$DUMP"
  echo "HIBA: a pg_dump ures vagy csonka, a mentes kimaradt"
  exit 1
fi
# Kisebb, felhasznaloi mentes az admin felulet "Adatbazis mentes letoltese" gombjahoz:
# minden tabla, de a knowledge_chunks tartalma nelkul (az ujraindexelheto a PDF-ekbol).
USERDUMP="$LOCAL/orankent/userdata-$STAMP.sql.gz"
pg_dump -n public --no-owner --no-privileges --clean --if-exists \
  --exclude-table-data=public.knowledge_chunks | gzip > "$USERDUMP"
if [ ! -s "$USERDUMP" ] || [ "$(stat -c%s "$USERDUMP")" -lt 1000 ]; then
  rm -f "$USERDUMP"
  echo "FIGYELEM: a felhasznaloi mentes ures vagy csonka, kimaradt"
fi
unset PGPASSWORD

if [ ! -f "$LOCAL/napi/myra-$TODAY.tar.gz" ]; then
  tar -czf "$LOCAL/napi/myra-$TODAY.tar.gz" -C "$SRC" \
    .env docker-compose.yml docker-compose.override.yml \
    backend/server.py backend/data/kb_pdfs 2>/dev/null
  cp "$DUMP" "$LOCAL/napi/db-$TODAY.sql.gz"
fi

# Forgatas: 48 ora orankent, 30 nap naponta.
find "$LOCAL/orankent" -name 'db-*.sql.gz' -mmin +2880 -delete
find "$LOCAL/orankent" -name 'userdata-*.sql.gz' -mmin +2880 -delete
find "$LOCAL/napi" -name '*.gz' -mtime +30 -delete

# Tukrozes a masodik lemezre. Ha az nincs csatolva, a helyi mentes akkor is megvan.
if mountpoint -q /mnt/win; then
  mkdir -p "$MIRROR"
  rsync -a --delete "$LOCAL/" "$MIRROR/"
else
  echo "FIGYELEM: /mnt/win nincs csatolva, a tukrozes kimaradt"
fi
echo "mentes kesz: $DUMP ($(du -h "$DUMP" | cut -f1)), osszesen: $(du -sh "$LOCAL" | cut -f1)"
