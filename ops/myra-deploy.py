#!/usr/bin/env python3
"""Myra backend deploy fusttesztel es automatikus visszaallassal.

A `docker compose up -d --build backend` helyett ezt futtasd. Amit csinal:

  1. elmenti a jelenlegi image-et `myra-backend:rollback` neven,
  2. ujraepiti es elinditja a backendet,
  3. megvarja, amig a konteneri healthcheck "healthy" lesz (a RAG warmup ~7 perc),
  4. vegigpingeli a fontos vegpontokat a konteneren BELULROL,
  5. ha barmelyik nem azt adja, amit kell: VISSZAALL a mentett image-re,
  6. mindket esetben kuld egy emailt.

A fuggetlen otlet: hitelesites nelkul is meg lehet allapitani, hogy egy vegpont
LETEZIK-e. Ha letezik es vedett, 401-et ad. Ha nincs meg, 404-et. Pontosan ez a
kulonbseg fogta volna meg a 2026-08-14-i esetet, amikor a /api/forum/latest
egy elavult server.py-jal eltunt a rendszerbol.

FONTOS a "unhealthy" allapotrol (2026-08-16-i javitas):
A server.py lifespan-jeben a `await _warmup_rag_runtime()` a `yield` ELOTT fut,
ezert az uvicorn ~7 percig egyaltalan nem fogad kapcsolatot. A compose
healthcheckje kozben 30 mp-enkent probalkozik, 3 sikertelen probalkozas utan
pedig a Docker "unhealthy"-re allitja a konteneri allapotat -- vagyis kb. 90
masodperccel minden egyes indulas utan, teljesen egeszseges build eseten is.
Az "unhealthy" a Dockerben NEM vegallapot: a probak tovabb futnak, es az elso
sikeres probanal visszavalt "healthy"-re. Ezert itt az "unhealthy" varakozasra
ok, nem visszaallasra. Csak ezek jelentenek valodi bukast: a konteneri leall,
ujraindulasi hurokba kerul, vagy lejar az idokeret.

Fuggosegek: csak a Python standard konyvtar. A titkokat a ~/myra/.env-bol olvassa.
"""

import os
import smtplib
import subprocess
import sys
import time
from datetime import datetime, timezone
from email.mime.text import MIMEText

MYRA_DIR = os.environ.get("MYRA_DIR", "/home/antalodor/myra")
ENV_FAJL = os.path.join(MYRA_DIR, ".env")
KONTENER = "myra-backend"
IMAGE = "myra-backend"
ROLLBACK_TAG = "myra-backend:rollback"

# A warmup hossza a VM memorianyomasatol fugg es eleg szelesen ingadozik:
# 439 mp (2026-08-13) es 596.6 mp (2026-08-16) is volt mar, az utobbi eseten a
# konteneri 720 mp-nel lett healthy. A 900 mp-es regi keret ezt meg elbirta, de
# csak 180 mp tartalekkal -- egy lassabb induals mar hamis visszaallast okozott
# volna. Az idotullepes itt vegso vedohalo: a valodi bukast (leallas,
# ujrainditasi hurok) a ciklus kulon, azonnal eszreveszi, ezert a bo keret nem
# keslelteti a hibafelismerest, csak a ritka "elindult, de sosem lesz kesz"
# esetben var tovabb.
HEALTH_TIMEOUT_S = int(os.environ.get("MYRA_HEALTH_TIMEOUT_S", "1800"))
HEALTH_POLL_S = 10
# Ennyi masodpercenkent irunk ki egy "meg megy" sort, hogy ne tunjon lefagyottnak.
HALADAS_S = 60
# A server.py "RAG warmup kesz: ..." vagy "RAG warmup figyelmeztetes: ..." sort ir
# ki, amikor a warmup lefutott. Ez a fajl szandekosan ekezet nelkuli, a logban
# viszont ekezetes a szoveg -- ezert csak az ekezet elotti reszre illesztunk.
WARMUP_JELEK = ("RAG warmup k", "RAG warmup figyelmeztet")

# (metodus, utvonal, vart statusz)
#   200 = nyilvanos
#   401 = letezik, de hitelesitest kivan   <- ez bizonyitja, hogy a route megvan
#   405 = letezik, de mas metodussal
#   404 = NINCS MEG a route                <- ez a regresszio jele
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
    # Negativ kontroll: ha EZ nem 404, akkor a teszt maga romlott el.
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


def email_kuld(targy, torzs):
    user = ENV.get("GMAIL_USER", "")
    jelszo = ENV.get("GMAIL_APP_PASSWORD", "")
    cimzett = ENV.get("MYRA_ALERT_EMAIL") or user
    if not user or not jelszo:
        print("[deploy] Nincs Gmail hitelesites, email nem megy.")
        return
    msg = MIMEText(torzs, "plain", "utf-8")
    msg["Subject"] = targy
    msg["From"] = user
    msg["To"] = cimzett
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as s:
            s.starttls()
            s.login(user, jelszo)
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
    """(futasi allapot, health allapot, ujrainditasok szama) egy hivasbol."""
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
    """Megvarja, amig a konteneri healthy lesz.

    Az "unhealthy" itt SZANDEKOSAN nem bukas: a warmup alatt minden egeszseges
    indulas atmegy rajta (lasd a modul tetejen levo magyarazatot). Valodi bukas
    csak a leallas, az ujrainditasi hurok es az idotullepes.
    """
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

        # Ezek valodi bukasok.
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


def fusztteszt():
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

    # 1. Mentes. Ha nincs meg image (elso futas), ezt atugorjuk.
    van_rollback = bool(kimenet(["docker", "images", "-q", IMAGE]))
    if van_rollback:
        fut(["docker", "tag", IMAGE + ":latest", ROLLBACK_TAG])
        print("[deploy] Jelenlegi image elmentve: %s" % ROLLBACK_TAG)
    else:
        print("[deploy] Nincs meglevo image, visszaallas nem lesz lehetseges.")

    # 2. Epites es inditas.
    if fut(["docker", "compose", "build", "backend"]).returncode != 0:
        email_kuld("[Myra] Deploy MEGHIUSULT - build hiba",
                   "A `docker compose build backend` hibaval allt le.\n"
                   "A futo rendszerhez nem nyultunk, minden a regi verzion megy tovabb.\n\n"
                   "Idopont: %s" % most())
        return 1

    fut(["docker", "compose", "up", "-d", "backend"])

    # 3. Varakozas.
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

    # 4. Fuszttesz.
    print("[deploy] Fuszttesz indul.")
    rendben, naplo = fusztteszt()

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

    email_kuld("[Myra] Deploy VISSZAALLITVA - fusztteszt bukott",
               "Az uj verzio elindult, de nem minden vegpont volt a helyen.\n\n"
               "%s\n\n%s\nIdopont: %s" % (naplo, allapot, most()))
    print("[deploy] A fusztteszt bukott.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
