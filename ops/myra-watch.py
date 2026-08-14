#!/usr/bin/env python3
"""Myra futasideju figyelo - konnyusulyu riaszto a VM-re.

Mit csinal:
  - olvassa a `docker events` folyamot (parancsinditas konteneren belul, OOM,
    varatlan leallas, ujrainditas),
  - olvassa a backend konteneri logjat es mintakat keres benne,
  - a talalatokat osszegyujti, es idokozonkent EGY osszefoglalo emailt kuld.

Amit szandekosan NEM csinal: nem all le semmit, nem zar karantenba. Kilenc
felhasznalonal egy ertesites eleg; az automatikus lekapcsolas csak azt
kockaztatna, hogy egy teves riasztas leallitja a Myrat.

Fuggosegek: csak a Python standard konyvtar. Nincs pip install.
Memoria: ~15-20 MB.
"""

import json
import os
import queue
import re
import smtplib
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText

# ---------------------------------------------------------------- beallitasok

ENV_FAJL = os.environ.get("MYRA_ENV", "/home/antalodor/myra/.env")
BACKEND_KONTENER = "myra-backend"

# Ennyi masodpercenkent megy ki legfeljebb egy email.
KOTEG_MASODPERC = int(os.environ.get("MYRA_WATCH_BATCH_S", "300"))
# Egy emailbe legfeljebb ennyi esemeny kerul, a tobbi csak szamkent.
MAX_ESEMENY_EMAILBEN = 40
# Sulyos esemenynel nem varunk a kotegre, azonnal kuldunk.
AZONNALI_TIPUSOK = {"oom", "die-hiba"}

# A backend logjaban ezeket keressuk. (minta, cimke, sulyos-e)
LOG_MINTAK = [
    (re.compile(r"Unauthorized direct access attempt"), "proxy-titok nelkuli kopogtatas", False),
    (re.compile(r"Traceback \(most recent call last\)"), "kezeletlen kivetel", True),
    (re.compile(r" - ERROR - "), "backend ERROR", True),
    (re.compile(r"CRITICAL"), "backend CRITICAL", True),
    (re.compile(r"rate limit|too many attempts|brute", re.I), "sebessegkorlat / brute-force", False),
    (re.compile(r'"(POST|GET|DELETE|PUT) /api/admin/[^"]*" (4\d\d|5\d\d)'), "elutasitott admin muvelet", True),
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
]

# ------------------------------------------------------------------ segedek


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


# ------------------------------------------------------------------ olvasok

SOR = queue.Queue(maxsize=5000)


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


def _esemeny(tipus, cimke, reszlet):
    try:
        SOR.put_nowait({"ido": most(), "tipus": tipus, "cimke": cimke, "reszlet": reszlet[:400]})
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
        _esemeny("exec", f"parancsinditas a(z) {nev} konteneren belul", parancs)

    elif akcio == "oom":
        _esemeny("oom", f"OOM: a(z) {nev} konteneri elfogyott a memoria", "")

    elif akcio == "die":
        kod = attrs.get("exitCode", "?")
        if kod not in ("0", 0):
            _esemeny("die-hiba", f"a(z) {nev} konteneri hibaval allt le", f"exitCode={kod}")

    elif akcio in ("kill", "restart"):
        _esemeny("eletciklus", f"{nev}: {akcio}", "")


def log_feldolgozo(sor):
    if not sor.strip():
        return
    if any(k.search(sor) for k in LOG_KIVETELEK):
        return
    for minta, cimke, sulyos in LOG_MINTAK:
        if minta.search(sor):
            _esemeny("log-sulyos" if sulyos else "log", cimke, sor)
            return


# -------------------------------------------------------------- osszegzes


def osszegzes_kuld(esemenyek):
    szamlalo = {}
    for e in esemenyek:
        szamlalo[e["cimke"]] = szamlalo.get(e["cimke"], 0) + 1

    sorok = [
        f"Myra figyelo - {len(esemenyek)} esemeny",
        f"Idopont: {most()}",
        "",
        "OSSZEGZES",
        "-" * 50,
    ]
    for cimke, db in sorted(szamlalo.items(), key=lambda x: -x[1]):
        sorok.append(f"{db:>4} x  {cimke}")

    sorok += ["", "RESZLETEK", "-" * 50]
    for e in esemenyek[:MAX_ESEMENY_EMAILBEN]:
        sorok.append(f"[{e['ido']}] {e['cimke']}")
        if e["reszlet"]:
            sorok.append(f"        {e['reszlet']}")
    if len(esemenyek) > MAX_ESEMENY_EMAILBEN:
        sorok.append(f"... es meg {len(esemenyek) - MAX_ESEMENY_EMAILBEN} esemeny")

    sorok += [
        "",
        "-" * 50,
        "Ezt a levelet a myra-watch kuldte a VM-rol.",
        "A figyelo NEM avatkozik be, csak jelent.",
    ]

    fo_cimke = max(szamlalo, key=szamlalo.get) if szamlalo else "esemeny"
    targy = f"[Myra] {len(esemenyek)} esemeny - {fo_cimke}"
    email_kuld(targy, "\n".join(sorok))


def fociklus():
    puffer = []
    kovetkezo_urites = time.time() + KOTEG_MASODPERC

    while True:
        varakozas = max(1.0, kovetkezo_urites - time.time())
        try:
            e = SOR.get(timeout=varakozas)
            puffer.append(e)
            if e["tipus"] in AZONNALI_TIPUSOK:
                osszegzes_kuld(puffer)
                puffer = []
                kovetkezo_urites = time.time() + KOTEG_MASODPERC
        except queue.Empty:
            pass

        if time.time() >= kovetkezo_urites:
            if puffer:
                osszegzes_kuld(puffer)
                puffer = []
            kovetkezo_urites = time.time() + KOTEG_MASODPERC


def main():
    print(f"[watch] Indul. Cimzett: {CIMZETT or '(nincs)'}, koteg: {KOTEG_MASODPERC}s")
    if not GMAIL_USER:
        print("[watch] FIGYELEM: nincs GMAIL_USER az .env-ben.", file=sys.stderr)

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

    fociklus()


if __name__ == "__main__":
    main()
