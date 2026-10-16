#!/usr/bin/env python3

import os
import smtplib
import ssl
import subprocess
import sys
import time
from datetime import datetime, timezone
from email.mime.text import MIMEText

MYRA_DIR = os.environ.get("MYRA_DIR", "/home/<user>/myra")
ENV_FAJL = os.path.join(MYRA_DIR, ".env")
KONTENER = "myra-backend"
IMAGE = "myra-backend"
ROLLBACK_TAG = "myra-backend:rollback"

HEALTH_TIMEOUT_S = int(os.environ.get("MYRA_HEALTH_TIMEOUT_S", "1800"))
HEALTH_POLL_S = 10
HALADAS_S = 60
WARMUP_JELEK = ("RAG warmup k", "RAG warmup figyelmeztet")

ELLENORZESEK = [
    ("GET", "/api/config", 200),
    ("GET", "/api/auth/me", 401),
    ("GET", "/api/forum/latest", 401),
    ("GET", "/api/forum/posts", 401),
    ("GET", "/api/forum/profile", 401),
    ("GET", "/api/goals", 401),
    ("GET", "/api/quiz/sessions", 401),
    ("GET", "/api/chat/history", 401),
    ("GET", "/api/chat/send", 405),
    ("GET", "/api/auth/login", 405),
    ("GET", "/api/tts/speak", 405),
    ("GET", "/api/ez-a-vegpont-soha-nem-letezett", 404),
]

BELSO_TESZT = r'''
import os, sys, urllib.request, urllib.error

SECRET = os.environ.get("MYRA_PROXY_SECRET", "")
BASE = "http://localhost:8001"
CHECKS = __CHECKS__

def statusz(metodus, utvonal):
    req = urllib.request.Request(BASE + utvonal, method=metodus)
    if SECRET:
        req.add_header("X-Myra-Proxy-Secret", SECRET)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        print("KAPCSOLATI HIBA %s %s: %s" % (metodus, utvonal, e))
        return -1

hibak = []
for metodus, utvonal, vart in CHECKS:
    kapott = statusz(metodus, utvonal)
    jo = (kapott == vart)
    print("%-4s %-6s %-45s -> %s (vart: %s)" % (
        "OK" if jo else "HIBA", metodus, utvonal, kapott, vart))
    if not jo:
        hibak.append("%s %s: %s helyett %s" % (metodus, utvonal, vart, kapott))

if hibak:
    print("SMOKE_FAIL")
    sys.exit(1)
print("SMOKE_OK")
'''


def most():
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")


def env_beolvas(utvonal):
    ertekek = {}
    try:
        with open(utvonal, "r", encoding="utf-8") as f:
            for sor in f:
                sor = sor.strip()
                if not sor or sor.startswith("#") or "=" not in sor:
                    continue
                k, v = sor.split("=", 1)
                ertekek[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return ertekek


ENV = env_beolvas(ENV_FAJL)


SMTP_HOST = ENV.get("MYRA_SMTP_HOST_LOCAL") or ENV.get("MYRA_SMTP_HOST") or "smtp.protonmail.ch"
try:
    SMTP_PORT = int(ENV.get("MYRA_SMTP_PORT_LOCAL") or ENV.get("MYRA_SMTP_PORT") or 587)
except ValueError:
    SMTP_PORT = 587
SMTP_USER = ENV.get("MYRA_SMTP_USER", "")
SMTP_PASSWORD = ENV.get("MYRA_SMTP_PASSWORD", "")
MAIL_FROM = ENV.get("MYRA_MAIL_FROM") or "noreply@myra-project.hu"
# A riasztas a rendszer feladojatol megy, de emberhez kell erkeznie.
CONTACT = ENV.get("MYRA_CONTACT_EMAIL") or "info@myra-project.hu"
SMTP_TLS_VERIFY = (ENV.get("MYRA_SMTP_TLS_VERIFY") or "true").strip().lower() in {"1", "true", "yes", "on"}


def _tls_context():
    """TLS-kontextus. A Bridge onnalairt tanusitvanyanal az ellenorzes kikapcsol."""
    ctx = ssl.create_default_context()
    if not SMTP_TLS_VERIFY:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def email_kuld(targy, torzs):
    cimzett = ENV.get("MYRA_ALERT_EMAIL") or CONTACT
    if not SMTP_USER or not SMTP_PASSWORD:
        print("[deploy] Nincs Proton SMTP hitelesites, email nem megy.")
        return
    msg = MIMEText(torzs, "plain", "utf-8")
    msg["Subject"] = targy
    msg["From"] = f"Myra-project <{MAIL_FROM}>"
    msg["To"] = cimzett
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as s:
            s.starttls(context=_tls_context())
            s.login(SMTP_USER, SMTP_PASSWORD)
            s.send_message(msg)
        print("[deploy] Email elkuldve: %s" % cimzett)
    except Exception as e:  # noqa: BLE001
        print("[deploy] Email kuldes sikertelen: %s" % e)


def fut(parancs, **kw):
    print("[deploy] $ %s" % " ".join(parancs))
    return subprocess.run(parancs, cwd=MYRA_DIR, text=True, **kw)


def kimenet(parancs):
    p = subprocess.run(parancs, cwd=MYRA_DIR, text=True,
                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return (p.stdout or "").strip()


def kontener_allapot():
    nyers = kimenet(["docker", "inspect", "--format",
                     "{{.State.Status}}|{{.State.Health.Status}}|{{.RestartCount}}",
                     KONTENER])
    reszek = (nyers or "||").split("|")
    while len(reszek) < 3:
        reszek.append("")
    return reszek[0], reszek[1], reszek[2]


def warmup_lefutott():
    naplo = kimenet(["docker", "logs", "--tail", "80", KONTENER])
    return any(jel in naplo for jel in WARMUP_JELEK)


def varj_healthre():
    kezdet = time.time()
    hatarido = kezdet + HEALTH_TIMEOUT_S
    utolso_allapot = ""
    utolso_haladas = kezdet
    kezdeti_restart = None
    warmup_jelezve = False

    while time.time() < hatarido:
        futas, egeszseg, restart = kontener_allapot()
        if kezdeti_restart is None:
            kezdeti_restart = restart

        eltelt = int(time.time() - kezdet)
        jelenlegi = "%s / %s" % (futas or "?", egeszseg or "nincs healthcheck")

        if jelenlegi != utolso_allapot:
            megjegyzes = ""
            if egeszseg == "unhealthy":
                megjegyzes = "  <- varhato a warmup alatt, varunk tovabb"
            print("[deploy] %4d mp | %s%s" % (eltelt, jelenlegi, megjegyzes))
            utolso_allapot = jelenlegi
            utolso_haladas = time.time()

        if egeszseg == "healthy":
            print("[deploy] %4d mp | a konteneri healthy." % eltelt)
            return True

        if futas in ("exited", "dead"):
            print("[deploy] A konteneri leallt (%s), nincs ertelme tovabb varni." % futas)
            return False
        if kezdeti_restart is not None and restart != kezdeti_restart:
            print("[deploy] A konteneri ujraindult (RestartCount %s -> %s): "
                  "ujrainditasi hurok." % (kezdeti_restart, restart))
            return False

        if time.time() - utolso_haladas >= HALADAS_S:
            if not warmup_jelezve and warmup_lefutott():
                print("[deploy] %4d mp | a RAG warmup lefutott, a health mar csak "
                      "a kovetkezo probara var." % eltelt)
                warmup_jelezve = True
            else:
                print("[deploy] %4d mp | meg varunk (%s)." % (eltelt, jelenlegi))
            utolso_haladas = time.time()

        time.sleep(HEALTH_POLL_S)

    print("[deploy] Idotullepes: a konteneri nem lett healthy %s mp alatt." % HEALTH_TIMEOUT_S)
    print("[deploy] Utolso 30 naplosor:")
    print(kimenet(["docker", "logs", "--tail", "30", KONTENER]))
    return False


def fustteszt():
    script = BELSO_TESZT.replace("__CHECKS__", repr(ELLENORZESEK))
    p = subprocess.run(
        ["docker", "compose", "exec", "-T", "backend", "python", "-"],
        cwd=MYRA_DIR, input=script, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    print(p.stdout or "")
    return p.returncode == 0, (p.stdout or "")


def visszaallas():
    print("[deploy] VISSZAALLAS a mentett image-re.")
    fut(["docker", "tag", ROLLBACK_TAG, IMAGE + ":latest"])
    fut(["docker", "compose", "up", "-d", "--force-recreate", "backend"])
    print("[deploy] A regi verzio elindult. A warmup ujra ~7 perc.")


def main():
    print("[deploy] Indul: %s" % most())

    van_rollback = bool(kimenet(["docker", "images", "-q", IMAGE]))
    if van_rollback:
        fut(["docker", "tag", IMAGE + ":latest", ROLLBACK_TAG])
        print("[deploy] Jelenlegi image elmentve: %s" % ROLLBACK_TAG)
    else:
        print("[deploy] Nincs meglevo image, visszaallas nem lesz lehetseges.")

    if fut(["docker", "compose", "build", "backend"]).returncode != 0:
        email_kuld("[Myra] Deploy MEGHIUSULT - build hiba",
                   "A `docker compose build backend` hibaval allt le.\n"
                   "A futo rendszerhez nem nyultunk, minden a regi verzion megy tovabb.\n\n"
                   "Idopont: %s" % most())
        return 1

    fut(["docker", "compose", "up", "-d", "backend"])

    print("[deploy] Varakozas a healthcheckre (a RAG warmup ~7 perc)...")
    if not varj_healthre():
        if van_rollback:
            visszaallas()
        email_kuld("[Myra] Deploy VISSZAALLITVA - nem indult el",
                   "A konteneri nem lett healthy %s mp alatt.\n"
                   "%s\n\nIdopont: %s" % (
                       HEALTH_TIMEOUT_S,
                       "A regi verzio visszaallt." if van_rollback
                       else "FIGYELEM: nem volt mentett image, a rendszer allhat!",
                       most()))
        return 1

    print("[deploy] Fustteszt indul.")
    rendben, naplo = fustteszt()

    if rendben:
        email_kuld("[Myra] Deploy rendben",
                   "Az uj verzio elindult es minden vegpont a helyen van.\n\n"
                   "%s\nIdopont: %s" % (naplo, most()))
        print("[deploy] KESZ. Minden rendben.")
        return 0

    if van_rollback:
        visszaallas()
        allapot = "A regi verzio visszaallt, a rendszer mukodik."
    else:
        allapot = "FIGYELEM: nem volt mentett image, a hibas verzio fut!"

    email_kuld("[Myra] Deploy VISSZAALLITVA - fustteszt bukott",
               "Az uj verzio elindult, de nem minden vegpont volt a helyen.\n\n"
               "%s\n\n%s\nIdopont: %s" % (naplo, allapot, most()))
    print("[deploy] A fustteszt bukott.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
