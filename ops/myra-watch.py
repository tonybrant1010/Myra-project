#!/usr/bin/env python3
"""Myra futasideju figyelo es karanten - v2.

Mit csinal:
  - olvassa a `docker events` folyamot (parancsinditas konteneren belul, OOM,
    varatlan leallas, ujrainditas, idegen kontener indulasa),
  - olvassa a backend konteneri logjat es mintakat keres benne,
  - percenkent ellenorzi a vedett fajlok (server.py, .env, compose) ujjlenyomatat,
  - minden talalatot beir a `security_events` tablaba, hogy az admin feluleten
    latszodjon akkor is, ha nem vagy gep kozelben,
  - sulyos jelnel KARANTENBA zarja a platformot (maintenance_mode = true),
  - emailt kuld: a sulyos eseteket azonnal, a tobbit idokozonkent kotegelve.

Mit jelent a karanten:
  A backend a nem-admin keresekre 503-at ad, amig te fel nem oldod az admin
  feluleten. A cloudflared es a backend TOVABB FUT, tehat te be tudsz lepni
  akkor is, ha eppen nem vagy a gep kozeleben. Semmit nem allitunk le.

Mit szandekosan NEM csinal: nem all le semmi, nem tilt IP-t, nem ir at semmit.

Fuggosegek: csak a Python standard konyvtar. Nincs pip install.
Az adatbazisba a `docker exec ... psql` uton ir, igy akkor is mukodik,
ha a backend eppen beragadt.

Hasznalat:
  myra-watch.py                  # figyelo mod (systemd ezt inditja)
  myra-watch.py --alapvonal      # a vedett fajlok ujjlenyomatanak rogzitese
  myra-watch.py --szunet 60      # 60 percre felfuggeszti a karantent (karbantartas)
  myra-watch.py --szunet 0       # a szunet azonnali vege
  myra-watch.py --mentes 5       # 5 perces ablak a mentes sajat pg_dump-janak
  myra-watch.py --teszt          # teszt esemeny + teszt email
"""

import base64
import hashlib
import json
import os
import queue
import re
import secrets
import smtplib
import subprocess
import sys
import threading
import time
from collections import deque
from datetime import datetime, timezone
from email.mime.text import MIMEText
from urllib.parse import unquote, urlparse

# ----------------------------------------------------------------- beallitasok

# A projekt gyokere: a szkript sajat helyebol vezetjuk le (ops/ szulomappaja),
# igy mindegy, melyik felhasznalo home-jaban van.
MYRA_DIR = os.environ.get(
    "MYRA_DIR", os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
ENV_FAJL = os.environ.get("MYRA_ENV", os.path.join(MYRA_DIR, ".env"))
OPS_DIR = os.environ.get("MYRA_OPS_DIR", os.path.join(MYRA_DIR, "ops"))
BACKEND_KONTENER = os.environ.get("MYRA_BACKEND_KONTENER", "myra-backend")
DB_KONTENER = os.environ.get("MYRA_DB_KONTENER", "myra-db")

ALAPVONAL_FAJL = os.path.join(OPS_DIR, "integritas.json")
SZUNET_FAJL = os.path.join(OPS_DIR, "karanten-szunet")
MENTES_FAJL = os.path.join(OPS_DIR, "mentes-fut")

# Ennyi masodpercenkent megy ki legfeljebb egy osszefoglalo email.
KOTEG_MASODPERC = int(os.environ.get("MYRA_WATCH_BATCH_S", "300"))
# Egy emailbe legfeljebb ennyi esemeny kerul, a tobbi csak szamkent.
MAX_ESEMENY_EMAILBEN = 40
# A vedett fajlokat ennyi masodpercenkent nezzuk meg.
INTEGRITAS_MASODPERC = int(os.environ.get("MYRA_WATCH_INTEGRITY_S", "60"))
# Ennyi naposnal regebbi esemenyeket takaritunk.
MEGORZES_NAP = int(os.environ.get("MYRA_WATCH_RETENTION_D", "30"))
# Ha "0", a figyelo sosem zar karantenba (csak riaszt) - a regi viselkedes.
KARANTEN_BE = os.environ.get("MYRA_WATCH_QUARANTINE", "1") not in ("0", "false", "no")

# Kuszobok: (esemenyszam, ablak masodpercben). Elerve karanten.
KUSZOB = {
    "proxy-kopogtatas": (int(os.environ.get("MYRA_KUSZOB_PROXY", "10")), 600),
    "elutasitott-admin": (int(os.environ.get("MYRA_KUSZOB_ADMIN", "5")), 600),
    "sikertelen-belepes": (int(os.environ.get("MYRA_KUSZOB_LOGIN", "10")), 600),
}

# A compose altal inditott kontenereken kivul ezek sem szamitanak idegennek.
SAJAT_KONTENEREK = {
    x.strip() for x in os.environ.get("MYRA_SAJAT_KONTENEREK", "").split(",") if x.strip()
}

# A vedett fajlok. Ezek megvaltozasa azonnali karanten.
VEDETT_FAJLOK = [
    os.path.join(MYRA_DIR, "backend", "server.py"),
    os.path.join(MYRA_DIR, ".env"),
    os.path.join(MYRA_DIR, "docker-compose.yml"),
    os.path.join(MYRA_DIR, "docker-compose.override.yml"),
]

# A backend logjaban ezeket keressuk.
# (minta, cimke, sulyossag, karanten_tipus)
#   sulyossag: "info" | "warn" | "critical"
#   karanten_tipus: None = csak riaszt
#                   "azonnal" = azonnali karanten
#                   kulcs a KUSZOB-bol = szamlalunk, kuszob felett karanten
LOG_MINTAK = [
    (re.compile(r"Unauthorized direct access attempt"),
     "proxy-titok nelkuli kopogtatas", "warn", "proxy-kopogtatas"),
    (re.compile(r'"(POST|GET|DELETE|PUT|PATCH) /api/admin/[^"]*" (4\d\d|5\d\d)'),
     "elutasitott admin muvelet", "warn", "elutasitott-admin"),
    (re.compile(r'"POST /api/auth/(login|mfa/verify|totp/login|admin/action-code)[^"]*" (401|403|429)'),
     "sikertelen belepesi kiserlet", "warn", "sikertelen-belepes"),
    (re.compile(r"Traceback \(most recent call last\)"),
     "kezeletlen kivetel", "critical", None),
    (re.compile(r" - ERROR - "),
     "backend ERROR", "critical", None),
    (re.compile(r"CRITICAL"),
     "backend CRITICAL", "critical", None),
    (re.compile(r"rate limit|too many attempts|brute", re.I),
     "sebessegkorlat / brute-force", "warn", None),
]

# Ezeket a log sorokat sosem jelentjuk (zaj).
LOG_KIVETELEK = [
    re.compile(r'GET /api/config HTTP/1\.1" 200'),          # healthcheck
    re.compile(r"passlib\.handlers\.bcrypt"),               # ismert, artalmatlan
    re.compile(r"error reading bcrypt version"),
    re.compile(r"module 'bcrypt' has no attribute"),
    re.compile(r"_load_backend_mixin"),
    re.compile(r"site-packages/passlib"),
]

# A healthcheck is exec_create esemenyt general - ezt kiszurjuk.
EXEC_KIVETELEK = [
    re.compile(r"urllib\.request\.urlopen"),
    re.compile(r"api/config"),
    re.compile(r"pg_isready"),
]

# A figyelo maga is `docker exec ... psql`-lel ir az adatbazisba, ami szinten
# exec_create esemeny. Hogy ne zarja karantenba onmagat, minden sajat psql
# hivasba beleteszi ezt az inditasonkent generalt jelzot, es csak azt engedi at.
# Random, tehat nem lehet "kivulrol" utanozni a jelszo ismerete nelkul.
WATCH_JELZO = f"myra_watch_{secrets.token_hex(8)}"
EXEC_KIVETELEK.append(re.compile(re.escape(WATCH_JELZO)))

# -------------------------------------------------------------------- segedek


def _env_beolvas(utvonal):
    """Egyszeru KEY=VALUE olvaso, hogy ne kelljen kettezni a titkokat."""
    ertekek = {}
    try:
        with open(utvonal, "r", encoding="utf-8") as f:
            for sor in f:
                sor = sor.strip()
                if not sor or sor.startswith("#") or "=" not in sor:
                    continue
                kulcs, ertek = sor.split("=", 1)
                ertekek[kulcs.strip()] = ertek.strip().strip('"').strip("'")
    except FileNotFoundError:
        print(f"[watch] Nincs meg az env fajl: {utvonal}", file=sys.stderr)
    return ertekek


ENV = _env_beolvas(ENV_FAJL)
GMAIL_USER = ENV.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = ENV.get("GMAIL_APP_PASSWORD", "")
CIMZETT = ENV.get("MYRA_ALERT_EMAIL") or GMAIL_USER


def _pg_adatok():
    """A psql felhasznalo/adatbazis a db kontener sajat kornyezetebol.

    Az .env DATABASE_URL-je szandekosan NEM forras: az a Supabase-re mutat
    (postgres.<projekt> szerepnevvel), a helyi kontener viszont a compose
    override sajat POSTGRES_USER/POSTGRES_DB ertekeivel fut. A `docker inspect`
    nem general exec esemenyt, tehat a figyelo nem riasztja magat vele.
    """
    user, db = "myra", "myra"
    nyers = os.environ.get("MYRA_DB_URL", "")
    if nyers:
        try:
            u = urlparse(nyers.replace("postgresql+asyncpg://", "postgresql://"))
            return (u.username or user), ((u.path or "").lstrip("/") or db)
        except Exception:  # noqa: BLE001
            return user, db
    try:
        p = subprocess.run(
            ["docker", "inspect", "-f", "{{json .Config.Env}}", DB_KONTENER],
            text=True, capture_output=True, timeout=15,
        )
        if p.returncode == 0:
            kornyezet = {}
            for sor in json.loads(p.stdout or "[]"):
                if "=" in sor:
                    k, v = sor.split("=", 1)
                    kornyezet[k] = v
            user = kornyezet.get("POSTGRES_USER") or user
            # Ha nincs POSTGRES_DB, a Postgres a felhasznalo nevevel egyezo db-t hoz letre.
            db = kornyezet.get("POSTGRES_DB") or user
    except Exception as e:  # noqa: BLE001
        print(f"[watch] db kornyezet olvasasi hiba: {e}", file=sys.stderr)
    return user, db


PG_USER, PG_DB = _pg_adatok() if os.environ.get("MYRA_DB_MOD", "supabase").strip().lower() == "docker" else ("myra", "myra")


# 2026-10: a backend a Supabase-t hasznalja, helyi adatbazis nincs.
# MYRA_DB_MOD=supabase (alapertelmezes): a figyelo a hoszt psql-jevel, halozaton
# at irja a Supabase-t, a .env DATABASE_URL-je alapjan. A jelszo kornyezeti
# valtozoban megy at (PGPASSWORD), nem a parancssorban, igy a `ps` sem latja.
# MYRA_DB_MOD=docker: a regi viselkedes (docker exec myra-db psql).
DB_MOD = os.environ.get("MYRA_DB_MOD", "supabase").strip().lower()


def _supabase_kapcsolat():
    nyers = ENV.get("DATABASE_URL", "")
    if not nyers:
        print("[watch] Nincs DATABASE_URL az .env-ben.", file=sys.stderr)
        return None, None
    u = urlparse(nyers.replace("postgresql+asyncpg://", "postgresql://"))
    adatbazis = (u.path or "/postgres").lstrip("/") or "postgres"
    sslmode = ENV.get("DATABASE_SSL_MODE", "") or "require"
    conninfo = (
        f"host={u.hostname} port={u.port or 5432} dbname={adatbazis} "
        f"user={unquote(u.username or '')} sslmode={sslmode} connect_timeout=10"
    )
    kornyezet = dict(os.environ)
    kornyezet["PGPASSWORD"] = unquote(u.password or "")
    return conninfo, kornyezet


SB_CONNINFO, SB_ENV = _supabase_kapcsolat() if DB_MOD == "supabase" else (None, None)


def _psql_parancs(extra):
    """A psql parancs eleje a valasztott mod szerint."""
    if DB_MOD == "supabase":
        return ["psql", SB_CONNINFO] + extra, SB_ENV
    return ["docker", "exec", "-i", DB_KONTENER, "psql", "-U", PG_USER, "-d", PG_DB] + extra, None


def most():
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")


def email_kuld(targy, torzs):
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        print("[watch] Nincs Gmail hitelesites az .env-ben, nem kuldok emailt.", file=sys.stderr)
        return False
    msg = MIMEText(torzs, "plain", "utf-8")
    msg["Subject"] = targy
    msg["From"] = GMAIL_USER
    msg["To"] = CIMZETT
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as server:
            server.starttls()
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:  # noqa: BLE001 - a figyelo sosem allhat le email hiba miatt
        print(f"[watch] Email kuldes sikertelen: {e}", file=sys.stderr)
        return False


# ---------------------------------------------------------------- adatbazis

DDL = """
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(60) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    source VARCHAR(20) NOT NULL DEFAULT 'watch',
    kind VARCHAR(40) NOT NULL DEFAULT '',
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    label VARCHAR(200) NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    quarantined BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS ix_security_events_created_at ON security_events (created_at DESC);
"""


def _b64(s):
    return base64.b64encode((s or "").encode("utf-8")).decode("ascii")


def _sz(s):
    """Szoveg literal SQL-be, base64-en keresztul. Igy nincs idezojel-gond."""
    return f"convert_from(decode('{_b64(s)}','base64'),'UTF8')"


def psql(sql):
    """SQL futtatasa a db konteneren belul. True, ha sikerult."""
    parancs, kornyezet = _psql_parancs(
        ["-v", "ON_ERROR_STOP=1", "-v", f"{WATCH_JELZO}=1", "-q", "-f", "-"]
    )
    try:
        p = subprocess.run(parancs, input=sql, text=True, capture_output=True, timeout=25, env=kornyezet)
        if p.returncode != 0:
            print(f"[watch] psql hiba: {(p.stderr or '').strip()[:300]}", file=sys.stderr)
            return False
        return True
    except Exception as e:  # noqa: BLE001
        print(f"[watch] psql futtatasi hiba: {e}", file=sys.stderr)
        return False


def beallitas_ir(kulcs, ertek):
    return (
        f"INSERT INTO app_settings(key, value, updated_at) "
        f"VALUES ({_sz(kulcs)}, {_sz(ertek)}, now()) "
        f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();"
    )


def esemeny_ment(e):
    sql = (
        "INSERT INTO security_events (created_at, source, kind, severity, label, detail, quarantined) "
        f"VALUES (now(), 'watch', {_sz(e['tipus'])}, {_sz(e['sulyossag'])}, "
        f"{_sz(e['cimke'])}, {_sz(e['reszlet'])}, {'true' if e.get('karanten') else 'false'});"
    )
    psql(sql)


def karanten_be(ok, tipus):
    """maintenance_mode = true + a karanten allapot rogzitese. Idempotens."""
    sql = "\n".join([
        beallitas_ir("maintenance_mode", "true"),
        beallitas_ir("quarantine_active", "true"),
        beallitas_ir("quarantine_reason", ok),
        beallitas_ir("quarantine_at", most()),
        beallitas_ir("quarantine_source", tipus),
    ])
    return psql(sql)


def karanten_aktiv_e():
    parancs, kornyezet = _psql_parancs(
        ["-t", "-A", "-v", f"{WATCH_JELZO}=1",
         "-c", "SELECT value FROM app_settings WHERE key = 'quarantine_active'"]
    )
    try:
        p = subprocess.run(parancs, text=True, capture_output=True, timeout=20, env=kornyezet)
        return (p.stdout or "").strip() == "true"
    except Exception:  # noqa: BLE001
        return False


def szivdobbanas():
    psql(beallitas_ir("watch_heartbeat", most()))


def takaritas():
    psql(f"DELETE FROM security_events WHERE created_at < now() - interval '{MEGORZES_NAP} days';")


# ------------------------------------------------------------------- szunet


def szunet_aktiv_e():
    """Karbantartasi ablak: ilyenkor riasztunk, de nem zarunk karantenba."""
    try:
        with open(SZUNET_FAJL, "r", encoding="utf-8") as f:
            veg = float(f.read().strip())
        return time.time() < veg
    except Exception:  # noqa: BLE001
        return False


def szunet_allit(perc):
    os.makedirs(OPS_DIR, exist_ok=True)
    with open(SZUNET_FAJL, "w", encoding="utf-8") as f:
        f.write(str(time.time() + perc * 60))
    if perc > 0:
        print(f"[watch] Karanten felfuggesztve {perc} percre.")
    else:
        print("[watch] Karanten-szunet vege.")


# --------------------------------------------------------------- mentesi ablak
#
# A myra-backup oranként `docker exec myra-db pg_dump`-ot futtat. Ez kivulrol
# megkulonbozhetetlen egy adatlopasi kiserlettol, ezert a mentes a sajat
# futasa elott ide bejelentkezik. Szandekosan szuk: CSAK a db kontener
# pg_dump hivasa mehet at nemán, es csak az ablakon belul. Minden mas exec
# - beleertve a pg_dump-ot barmikor mashol - tovabbra is azonnali karanten.


def mentes_folyamatban():
    try:
        with open(MENTES_FAJL, "r", encoding="utf-8") as f:
            return time.time() < float(f.read().strip())
    except Exception:  # noqa: BLE001
        return False


def mentes_allit(perc):
    os.makedirs(OPS_DIR, exist_ok=True)
    with open(MENTES_FAJL, "w", encoding="utf-8") as f:
        f.write(str(time.time() + perc * 60))
    print(f"[watch] Mentesi ablak {perc} percre nyitva.")


# --------------------------------------------------------------- integritas


def _ujjlenyomat(utvonal):
    h = hashlib.sha256()
    try:
        with open(utvonal, "rb") as f:
            for blokk in iter(lambda: f.read(65536), b""):
                h.update(blokk)
        return h.hexdigest()
    except FileNotFoundError:
        return "nincs"
    except Exception as e:  # noqa: BLE001
        return f"hiba:{e}"


def alapvonal_ir():
    adat = {u: _ujjlenyomat(u) for u in VEDETT_FAJLOK}
    os.makedirs(OPS_DIR, exist_ok=True)
    with open(ALAPVONAL_FAJL, "w", encoding="utf-8") as f:
        json.dump({"rogzitve": most(), "fajlok": adat}, f, indent=2)
    for u, h in adat.items():
        print(f"  {h[:16]}  {u}")
    print(f"[watch] Alapvonal elmentve: {ALAPVONAL_FAJL}")
    return adat


def alapvonal_olvas():
    try:
        with open(ALAPVONAL_FAJL, "r", encoding="utf-8") as f:
            return json.load(f).get("fajlok") or {}
    except Exception:  # noqa: BLE001
        return {}


def _integritas_ciklus():
    alapvonal = alapvonal_olvas()
    if not alapvonal:
        print("[watch] Nincs integritas-alapvonal, most rogzitem.", file=sys.stderr)
        alapvonal = alapvonal_ir()
    while True:
        time.sleep(INTEGRITAS_MASODPERC)
        for utvonal in VEDETT_FAJLOK:
            regi = alapvonal.get(utvonal)
            uj = _ujjlenyomat(utvonal)
            if regi is None:
                alapvonal[utvonal] = uj
                continue
            if uj != regi:
                _esemeny(
                    "integritas",
                    f"vedett fajl megvaltozott: {os.path.basename(utvonal)}",
                    f"{utvonal}\n  regi: {regi[:16]}\n  uj:   {uj[:16]}",
                    "critical",
                    "azonnal",
                )
                alapvonal[utvonal] = uj  # csak egyszer jelentjuk


# --------------------------------------------------------------------- olvasok

SOR = queue.Queue(maxsize=5000)
SZAMLALOK = {kulcs: deque() for kulcs in KUSZOB}
SZAMLALO_ZAR = threading.Lock()


def _folyam_olvas(parancs, feldolgozo, nev):
    """Egy kulso parancs kimenetet olvassa vegtelenul, ujrainditassal."""
    while True:
        try:
            proc = subprocess.Popen(
                parancs,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                bufsize=1,
            )
            for sor in proc.stdout:
                feldolgozo(sor.rstrip("\n"))
            proc.wait()
        except Exception as e:  # noqa: BLE001
            print(f"[watch] {nev} olvaso hiba: {e}", file=sys.stderr)
        print(f"[watch] {nev} folyam megszakadt, ujrainditas 10 mp mulva.", file=sys.stderr)
        time.sleep(10)


def _kuszob_atlepve(kulcs):
    """Sliding window szamlalo. True, ha az ablakban elerte a kuszobot."""
    darab, ablak = KUSZOB[kulcs]
    mostanra = time.time()
    with SZAMLALO_ZAR:
        d = SZAMLALOK[kulcs]
        d.append(mostanra)
        while d and mostanra - d[0] > ablak:
            d.popleft()
        return len(d) >= darab


def _esemeny(tipus, cimke, reszlet, sulyossag="info", karanten_tipus=None):
    """Egyetlen belepesi pont: osztalyoz, dont a karantenrol, sorba tesz."""
    karanten = False
    if KARANTEN_BE and karanten_tipus:
        if karanten_tipus == "azonnal":
            karanten = True
        elif karanten_tipus in KUSZOB:
            karanten = _kuszob_atlepve(karanten_tipus)

    if karanten and szunet_aktiv_e():
        karanten = False
        cimke = f"{cimke} (karanten-szunet alatt)"

    e = {
        "ido": most(),
        "tipus": tipus,
        "cimke": cimke,
        "reszlet": (reszlet or "")[:400],
        "sulyossag": sulyossag,
        "karanten": karanten,
    }

    if karanten:
        karanten_be(cimke, tipus)

    esemeny_ment(e)
    try:
        SOR.put_nowait(e)
    except queue.Full:
        pass


def docker_esemeny_feldolgozo(sor):
    if not sor.strip():
        return
    try:
        ev = json.loads(sor)
    except json.JSONDecodeError:
        return

    akcio = ev.get("Action", "")
    attrs = (ev.get("Actor") or {}).get("Attributes") or {}
    nev = attrs.get("name", "?")

    if akcio.startswith("exec_create"):
        parancs = akcio[len("exec_create: "):] if ": " in akcio else ""
        if any(k.search(parancs) for k in EXEC_KIVETELEK):
            return
        if nev == DB_KONTENER and parancs.lstrip().startswith("pg_dump") and mentes_folyamatban():
            return  # az oránkénti mentes sajat pg_dump-ja, bejelentkezett ablakon belul
        # Parancsinditas konteneren belul: ezt csak ember csinalja.
        _esemeny(
            "exec",
            f"parancsinditas a(z) {nev} konteneren belul",
            parancs,
            "critical",
            "azonnal",
        )

    elif akcio == "start":
        # A compose minden altala inditott konteneren otthagyja ezt a cimket.
        if attrs.get("com.docker.compose.project"):
            return
        if nev in SAJAT_KONTENEREK:
            return
        _esemeny(
            "idegen-kontener",
            f"nem a compose inditotta ezt a kontenert: {nev}",
            f"image={attrs.get('image', '?')}",
            "critical",
            "azonnal",
        )

    elif akcio == "oom":
        _esemeny("oom", f"OOM: a(z) {nev} konteneri elfogyott a memoria", "", "critical", None)

    elif akcio == "die":
        kod = attrs.get("exitCode", "?")
        if kod not in ("0", 0):
            _esemeny("die-hiba", f"a(z) {nev} konteneri hibaval allt le", f"exitCode={kod}", "critical", None)

    elif akcio in ("kill", "restart"):
        _esemeny("eletciklus", f"{nev}: {akcio}", "", "warn", None)


def log_feldolgozo(sor):
    if not sor.strip():
        return
    if any(k.search(sor) for k in LOG_KIVETELEK):
        return
    for minta, cimke, sulyossag, karanten_tipus in LOG_MINTAK:
        if minta.search(sor):
            tipus = "log-sulyos" if sulyossag == "critical" else "log"
            _esemeny(tipus, cimke, sor, sulyossag, karanten_tipus)
            return


# ------------------------------------------------------------------ osszegzes

AZONNALI_TIPUSOK = {"oom", "die-hiba"}


def osszegzes_kuld(esemenyek):
    szamlalo = {}
    for e in esemenyek:
        szamlalo[e["cimke"]] = szamlalo.get(e["cimke"], 0) + 1

    karantenosak = [e for e in esemenyek if e.get("karanten")]

    sorok = [
        f"Myra figyelo - {len(esemenyek)} esemeny",
        f"Idopont: {most()}",
        "",
    ]
    if karantenosak:
        sorok += [
            "*** KARANTEN BEKAPCSOLVA ***",
            f"Ok: {karantenosak[0]['cimke']}",
            "A platform a nem-admin kereseket 503-mal utasitja el.",
            "Feloldas: admin felulet -> Biztonsag -> Karanten feloldasa.",
            "",
        ]

    sorok += ["OSSZEGZES", "-" * 50]
    for cimke, db in sorted(szamlalo.items(), key=lambda x: -x[1]):
        sorok.append(f"{db:>4} x  {cimke}")

    sorok += ["", "RESZLETEK", "-" * 50]
    for e in esemenyek[:MAX_ESEMENY_EMAILBEN]:
        jel = "[K] " if e.get("karanten") else ""
        sorok.append(f"[{e['ido']}] {jel}{e['cimke']}")
        if e["reszlet"]:
            sorok.append(f"        {e['reszlet']}")
    if len(esemenyek) > MAX_ESEMENY_EMAILBEN:
        sorok.append(f"... es meg {len(esemenyek) - MAX_ESEMENY_EMAILBEN} esemeny")

    sorok += [
        "",
        "-" * 50,
        "Ezt a levelet a myra-watch kuldte a szerverrol.",
        "Az esemenyek az admin feluleten is megjelennek.",
    ]

    fo_cimke = max(szamlalo, key=szamlalo.get) if szamlalo else "esemeny"
    if karantenosak:
        targy = f"[MYRA KARANTEN] {karantenosak[0]['cimke']}"
    else:
        targy = f"[Myra] {len(esemenyek)} esemeny - {fo_cimke}"
    email_kuld(targy, "\n".join(sorok))


def fociklus():
    puffer = []
    kovetkezo_urites = time.time() + KOTEG_MASODPERC
    kovetkezo_takaritas = time.time() + 3600

    while True:
        varakozas = max(1.0, kovetkezo_urites - time.time())
        try:
            e = SOR.get(timeout=varakozas)
            puffer.append(e)
            if e.get("karanten") or e["tipus"] in AZONNALI_TIPUSOK:
                osszegzes_kuld(puffer)
                puffer = []
                kovetkezo_urites = time.time() + KOTEG_MASODPERC
        except queue.Empty:
            pass

        if time.time() >= kovetkezo_urites:
            if puffer:
                osszegzes_kuld(puffer)
                puffer = []
            szivdobbanas()
            kovetkezo_urites = time.time() + KOTEG_MASODPERC

        if time.time() >= kovetkezo_takaritas:
            takaritas()
            kovetkezo_takaritas = time.time() + 3600


def main():
    print(f"[watch] Indul. Cimzett: {CIMZETT or '(nincs)'}, koteg: {KOTEG_MASODPERC}s, "
          f"karanten: {'be' if KARANTEN_BE else 'ki'}, db: {DB_KONTENER}/{PG_DB}")
    if not GMAIL_USER:
        print("[watch] FIGYELEM: nincs GMAIL_USER az .env-ben.", file=sys.stderr)

    if not psql(DDL):
        print("[watch] FIGYELEM: az adatbazis nem elerheto, csak emailben riasztok.", file=sys.stderr)
    szivdobbanas()

    if karanten_aktiv_e():
        print("[watch] A platform mar karantenban van.", file=sys.stderr)

    threading.Thread(
        target=_folyam_olvas,
        args=(["docker", "events", "--format", "{{json .}}"], docker_esemeny_feldolgozo, "docker-events"),
        daemon=True,
    ).start()

    threading.Thread(
        target=_folyam_olvas,
        args=(["docker", "logs", "-f", "--tail", "0", BACKEND_KONTENER], log_feldolgozo, "backend-log"),
        daemon=True,
    ).start()

    threading.Thread(target=_integritas_ciklus, daemon=True).start()

    fociklus()


if __name__ == "__main__":
    if "--alapvonal" in sys.argv:
        alapvonal_ir()
    elif "--mentes" in sys.argv:
        i = sys.argv.index("--mentes")
        mentes_allit(int(sys.argv[i + 1]) if len(sys.argv) > i + 1 else 5)
    elif "--szunet" in sys.argv:
        i = sys.argv.index("--szunet")
        perc = int(sys.argv[i + 1]) if len(sys.argv) > i + 1 else 60
        szunet_allit(perc)
    elif "--teszt" in sys.argv:
        print(f"[watch] psql: {'ok' if psql(DDL) else 'HIBA'}")
        _esemeny("teszt", "teszt esemeny a myra-watch-bol", "ez csak proba", "info", None)
        osszegzes_kuld([SOR.get()])
        print("[watch] Teszt kesz.")
    else:
        main()
