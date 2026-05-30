import sqlite3

db = 'data/myra.db'
c = sqlite3.connect(db)

def cols(t):
    return [r[1] for r in c.execute(f"PRAGMA table_info({t})").fetchall()]

ucols = cols('users')
print('users before:', ucols)

added = []
if 'reset_token' not in ucols:
    c.execute("ALTER TABLE users ADD COLUMN reset_token VARCHAR(10)"); added.append('reset_token')
if 'token_expires_at' not in ucols:
    c.execute("ALTER TABLE users ADD COLUMN token_expires_at DATETIME"); added.append('token_expires_at')
c.commit()
print('added:', added)
print('users after :', cols('users'))

# Verify the SELECT that was previously failing now works
row = c.execute(
    "SELECT id,email,name,password_hash,is_admin,is_active,is_suspended,"
    "state_code,code_verified_at,created_at,reset_token,token_expires_at "
    "FROM users WHERE email=?", ('nobody@example.com',)
).fetchone()
print('SELECT ok, row =', row)

# Verify the INSERT write-path works, then ROLL BACK so no test user persists
c.execute(
    "INSERT INTO users (email,name,password_hash,is_admin,is_active,is_suspended) "
    "VALUES (?,?,?,?,?,?)", ('rolltest@example.com', 'rt', 'h', 0, 1, 0)
)
print('INSERT ok (rolling back, not persisting)')
c.rollback()

print('user count :', c.execute("SELECT count(*) FROM users").fetchone()[0])
print('OK')
