#!/usr/bin/env python3

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
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from urllib.parse import unquote, urlparse


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

KOTEG_MASODPERC = int(os.environ.get("MYRA_WATCH_BATCH_S", "300"))
MAX_ESEMENY_EMAILBEN = 40
INTEGRITAS_MASODPERC = int(os.environ.get("MYRA_WATCH_INTEGRITY_S", "60"))
MEGORZES_NAP = int(os.environ.get("MYRA_WATCH_RETENTION_D", "30"))
KARANTEN_BE = os.environ.get("MYRA_WATCH_QUARANTINE", "1") not in ("0", "false", "no")

KUSZOB = {
    "proxy-kopogtatas": (
        int(os.environ.get("MYRA_KUSZOB_PROXY", "25")), 600,
        int(os.environ.get("MYRA_KUSZOB_IP_PROXY", "3")),
    ),
    "elutasitott-admin": (
        int(os.environ.get("MYRA_KUSZOB_ADMIN", "10")), 600,
        int(os.environ.get("MYRA_KUSZOB_IP_ADMIN", "3")),
    ),
    "sikertelen-belepes": (
        int(os.environ.get("MYRA_KUSZOB_LOGIN", "20")), 600,
        int(os.environ.get("MYRA_KUSZOB_IP_LOGIN", "3")),
    ),
}

KARANTEN_TTL_MIN = int(os.environ.get("MYRA_KARANTEN_TTL_MIN", "30"))

SAJAT_KONTENEREK = {
    x.strip() for x in os.environ.get("MYRA_SAJAT_KONTENEREK", "").split(",") if x.strip()
}

UNIT_FAJL = os.environ.get(
    "MYRA_WATCH_UNIT", "/etc/systemd/system/myra-watch.service"
)
VEDETT_FAJLOK = [
    os.path.join(MYRA_DIR, "backend", "server.py"),
    os.path.join(MYRA_DIR, ".env"),
    os.path.join(MYRA_DIR, "docker-compose.yml"),
    os.path.join(MYRA_DIR, "docker-compose.override.yml"),
    os.path.join(OPS_DIR, "myra-watch.py"),
    os.path.join(OPS_DIR, "myra-stats.py"),
    os.path.join(OPS_DIR, "myra-backup.sh"),
    "/etc/caddy/Caddyfile",
    "/etc/caddy/myra.env",
    "/etc/fail2ban/jail.d/myra.conf",
    "/etc/fail2ban/jail.d/myra-rate.conf",
    "/etc/fail2ban/filter.d/myra-auth.conf",
    "/etc/fail2ban/filter.d/myra-badpath.conf",
    "/etc/fail2ban/filter.d/myra-rate.conf",
    "/etc/systemd/system/myra-stats.service",
    "/etc/systemd/system/myra-stats.timer",
    "/etc/systemd/system/myra-backup.service",
    "/etc/systemd/system/myra-backup.timer",
    UNIT_FAJL,
]

LOG_MINTAK = [
    (re.compile(r"MYRA_SECURITY_SIGNAL kind=admin_forbidden"),
     "elutasitott admin muvelet (hitelesitett)", "warn", "elutasitott-admin"),
    (re.compile(r'"(POST|GET|DELETE|PUT|PATCH) /api/admin/[^"]*" 401'),
     "anonim koppintas admin utvonalra (nincs token)", "info", None),
    (re.compile(r"Unauthorized direct access attempt"),
     "proxy-titok nelkuli kopogtatas", "warn", "proxy-kopogtatas"),
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

LOG_KIVETELEK = [
    re.compile(r'GET /api/config HTTP/1\.1" 200'),
    re.compile(r"passlib\.handlers\.bcrypt"),
    re.compile(r"error reading bcrypt version"),
    re.compile(r"module 'bcrypt' has no attribute"),
    re.compile(r"_load_backend_mixin"),
    re.compile(r"site-packages/passlib"),
]

EXEC_KIVETELEK = [
    re.compile(r"urllib\.request\.urlopen"),
    re.compile(r"api/config"),
    re.compile(r"pg_isready"),
]

WATCH_JELZO = f"myra_watch_{secrets.token_hex(8)}"
EXEC_KIVETELEK.append(re.compile(re.escape(WATCH_JELZO)))


def _env_beolvas(utvonal):
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
            db = kornyezet.get("POSTGRES_DB") or user
    except Exception as e:  # noqa: BLE001
        print(f"[watch] db kornyezet olvasasi hiba: {e}", file=sys.stderr)
    return user, db


PG_USER, PG_DB = _pg_adatok() if os.environ.get("MYRA_DB_MOD", "supabase").strip().lower() == "docker" else ("myra", "myra")


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
    return f"convert_from(decode('{_b64(s)}','base64'),'UTF8')"


def psql(sql):
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


def karanten_be(ok, tipus, azonnali=False):
    if azonnali or KARANTEN_TTL_MIN <= 0:
        until = ""
    else:
        helyi_tz = datetime.now(timezone.utc).astimezone().tzinfo
        until = (datetime.now(helyi_tz) + timedelta(minutes=KARANTEN_TTL_MIN)).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
    sql = "\n".join([
        beallitas_ir("maintenance_mode", "true"),
        beallitas_ir("quarantine_active", "true"),
        beallitas_ir("quarantine_reason", ok),
        beallitas_ir("quarantine_at", most()),
        beallitas_ir("quarantine_source", tipus),
        beallitas_ir("quarantine_until", until),
    ])
    siker = psql(sql)
    if siker:
        _karanten_cache["ertek"] = True
        _karanten_cache["at"] = time.time()
    return siker


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


_karanten_cache = {"ertek": False, "at": 0.0}
KARANTEN_CACHE_S = 10.0


def _karanten_aktiv_cached():
    now = time.time()
    if now - _karanten_cache["at"] < KARANTEN_CACHE_S:
        return bool(_karanten_cache["ertek"])
    ertek = karanten_aktiv_e()
    _karanten_cache["ertek"] = ertek
    _karanten_cache["at"] = now
    return ertek


def _beallitas_olvas(kulcs):
    parancs, kornyezet = _psql_parancs(
        ["-t", "-A", "-v", f"{WATCH_JELZO}=1",
         "-c", f"SELECT value FROM app_settings WHERE key = {_sz(kulcs)}"]
    )
    try:
        p = subprocess.run(parancs, text=True, capture_output=True, timeout=20, env=kornyezet)
        return (p.stdout or "").strip()
    except Exception:  # noqa: BLE001
        return ""


def _auto_feloldas():
    if not karanten_aktiv_e():
        return False
    until = _beallitas_olvas("quarantine_until")
    if not until:
        return False
    helyi_tz = datetime.now(timezone.utc).astimezone().tzinfo
    try:
        lejarat = datetime.strptime(until, "%Y-%m-%d %H:%M:%S").replace(tzinfo=helyi_tz)
    except ValueError:
        print(f"[watch] Ervenytelen quarantine_until: {until!r}", file=sys.stderr)
        return False
    if datetime.now(helyi_tz) < lejarat:
        return False

    cimke = "karanten automatikusan feloldva (idokorlat lejart)"
    sql = "\n".join([
        beallitas_ir("maintenance_mode", "false"),
        beallitas_ir("quarantine_active", "false"),
        beallitas_ir("quarantine_reason", ""),
        beallitas_ir("quarantine_source", ""),
        beallitas_ir("quarantine_until", ""),
    ])
    if not psql(sql):
        return False
    _karanten_cache["ertek"] = False
    _karanten_cache["at"] = time.time()
    esemeny_ment({
        "tipus": "feloldas", "sulyossag": "info", "cimke": cimke,
        "reszlet": f"idokorlat: {until}", "karanten": False,
    })
    try:
        SOR.put_nowait({
            "ido": most(), "tipus": "feloldas", "cimke": cimke,
            "reszlet": f"idokorlat: {until}", "sulyossag": "info", "karanten": False,
        })
    except queue.Full:
        pass
    print(f"[watch] {cimke} (idokorlat: {until})")
    return True


def szivdobbanas():
    psql(beallitas_ir("watch_heartbeat", most()))


def takaritas():
    psql(f"DELETE FROM security_events WHERE created_at < now() - interval '{MEGORZES_NAP} days';")


SZUNET_MAX_PERC = int(os.environ.get("MYRA_SZUNET_MAX", "480"))


def szunet_aktiv_e():
    try:
        with open(SZUNET_FAJL, "r", encoding="utf-8") as f:
            veg = float(f.read().strip())
        return time.time() < veg
    except Exception:  # noqa: BLE001
        return False


def szunet_allit(perc):
    try:
        perc = int(perc)
    except (TypeError, ValueError):
        perc = 0
    perc = max(0, min(perc, SZUNET_MAX_PERC))
    os.makedirs(OPS_DIR, exist_ok=True)
    with open(SZUNET_FAJL, "w", encoding="utf-8") as f:
        f.write(str(time.time() + perc * 60))
    if perc > 0:
        print(f"[watch] Karanten felfuggesztve {perc} percre (max {SZUNET_MAX_PERC}).")
    else:
        print("[watch] Karanten-szunet vege.")
    _esemeny(
        "szunet",
        f"karanten-szunet: {perc} perc" if perc > 0 else "karanten-szunet vege",
        "", "warn", None,
    )


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


def _ujjlenyomat(utvonal):
    h = hashlib.sha256()
    try:
        with open(utvonal, "rb") as f:
            for blokk in iter(lambda: f.read(65536), b""):
                h.update(blokk)
        return h.hexdigest()
    except FileNotFoundError:
        return "nincs"
    except PermissionError:
        try:
            s = os.stat(utvonal)
            return f"stat:{s.st_size}:{int(s.st_mtime)}"
        except OSError:
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


def _alapvonal_ment(adat):
    try:
        os.makedirs(OPS_DIR, exist_ok=True)
        with open(ALAPVONAL_FAJL, "w", encoding="utf-8") as f:
            json.dump({"rogzitve": most(), "fajlok": adat}, f, indent=2)
        return True
    except Exception as e:  # noqa: BLE001
        print(f"[watch] Alapvonal iras hiba: {e}", file=sys.stderr)
        return False


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
            if uj == regi:
                continue
            if regi == "nincs" and uj != "nincs":
                _esemeny(
                    "integritas",
                    f"uj vedett fajl rogzitve: {os.path.basename(utvonal)}",
                    f"{utvonal}\n  uj: {uj[:16]}",
                    "info",
                    None,
                )
                _alapvonal_ment(alapvonal)
            else:
                _esemeny(
                    "integritas",
                    f"vedett fajl megvaltozott: {os.path.basename(utvonal)}",
                    f"{utvonal}\n  regi: {regi[:16]}\n  uj:   {uj[:16]}",
                    "critical",
                    "azonnal",
                )
            alapvonal[utvonal] = uj


SOR = queue.Queue(maxsize=5000)
SZAMLALOK = {kulcs: deque() for kulcs in KUSZOB}
SZAMLALO_ZAR = threading.Lock()


def _folyam_olvas(parancs, feldolgozo, nev):
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


_IP_SIGNAL_RX = re.compile(r"\bip=([0-9a-fA-F\.:]{3,45})")
_IP_ACCESS_RX = re.compile(r"\s([0-9a-fA-F\.:]{3,45}):\d+ - \"")


def _sor_ip(sor):
    m = _IP_SIGNAL_RX.search(sor) or _IP_ACCESS_RX.search(sor)
    return m.group(1)[:45] if m else ""


def _kuszob_atlepve(kulcs, ip=""):
    darab, ablak, min_ip = KUSZOB[kulcs]
    mostanra = time.time()
    with SZAMLALO_ZAR:
        d = SZAMLALOK[kulcs]
        d.append((mostanra, ip or ""))
        while d and mostanra - d[0][0] > ablak:
            d.popleft()
        if len(d) < darab:
            return False
        return len({forras for _, forras in d if forras}) >= min_ip


def _esemeny(tipus, cimke, reszlet, sulyossag="info", karanten_tipus=None, ip=""):
    karanten = False
    if KARANTEN_BE and karanten_tipus:
        if karanten_tipus == "azonnal":
            karanten = True
        elif karanten_tipus in KUSZOB:
            if _karanten_aktiv_cached():
                cimke = f"{cimke} (mar karantenban, nem szamol)"
            else:
                karanten = _kuszob_atlepve(karanten_tipus, ip)

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
        karanten_be(cimke, tipus, karanten_tipus == "azonnal")

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
            return
        _esemeny(
            "exec",
            f"parancsinditas a(z) {nev} konteneren belul",
            parancs,
            "critical",
            "azonnal",
        )

    elif akcio == "start":
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
            _esemeny(tipus, cimke, sor, sulyossag, karanten_tipus, _sor_ip(sor))
            return


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
    kovetkezo_feloldas = time.time() + 30

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

        if time.time() >= kovetkezo_feloldas:
            try:
                _auto_feloldas()
            except Exception as e:  # noqa: BLE001
                print(f"[watch] Auto-feloldas hiba: {e}", file=sys.stderr)
            kovetkezo_feloldas = time.time() + 30

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
