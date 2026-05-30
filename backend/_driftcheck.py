import sqlite3
import server  # imports Base + models (no server side effects on plain import)

db = 'data/myra.db'
c = sqlite3.connect(db)

def db_cols(t):
    return {r[1] for r in c.execute(f"PRAGMA table_info({t})").fetchall()}

meta = server.Base.metadata
issues = 0
for tname, table in meta.tables.items():
    model_cols = {col.name for col in table.columns}
    actual = db_cols(tname)
    if not actual:
        print(f"[MISSING TABLE] {tname}")
        issues += 1
        continue
    missing = model_cols - actual
    if missing:
        print(f"[DRIFT] {tname}: missing in DB -> {sorted(missing)}")
        issues += 1
    else:
        print(f"[OK] {tname} ({len(model_cols)} cols)")
print("ISSUES:", issues)
