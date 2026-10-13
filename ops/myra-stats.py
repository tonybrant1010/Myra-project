#!/usr/bin/env python3
"""Myra forgalmi statisztika osszesito.

A Caddy hozzaferesi naplojat (JSON sorok) dolgozza fel NOVEKVO modon: fajlonkent
eltarolja a mar feldolgozott byte-offszetet, ezert percenkent lefutva is olcso.

Kimeneet: backend/data/statisztika.json  (ezt szolgalja ki a backend /api/admin/stats)

Ket kategoria:
  - frontend: minden nem /api/ alatti keres (statikus fajlok)
  - backend:  /api/ alatti keres
Es harom kimenetel:
  - sikeres     : 2xx/3xx
  - elutasitott : 4xx (beleertve 401/403/429)
  - szerverhIBA : 5xx
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

LOG_DIR = Path("/var/log/caddy")
NAPLO_MINTA = re.compile(r"^myra-access.*\.log$")
GYOKER = Path(__file__).resolve().parent.parent          # ~/myra
ADAT = GYOKER / "backend" / "data"
ALLAPOT = ADAT / ".statisztika-allapot.json"
KIMENET = ADAT / "statisztika.json"
NAPI_MEGTART = 14
TOP_DB = 10


def _nap(ts: str) -> str:
    """Caddy idobelyeg (ISO 8601, UTC) -> napi kulcs HHHH-NN-HH."""
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except Exception:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _ora(ts: str) -> str:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).strftime("%Y-%m-%dT%H")
    except Exception:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")


def _uj_nap() -> dict:
    return {
        "total": 0, "sikeres": 0, "elutasitott": 0, "szerverhiba": 0,
        "frontend_total": 0, "frontend_sikeres": 0, "frontend_elutasitott": 0,
        "api_total": 0, "api_sikeres": 0, "api_elutasitott": 0,
        "kodok": {},
        "ipk": {},       # elutasitott keresek IP-nkent (csak a toplistahoz)
        "utak": {},      # keresek utvonalankent (csak a toplistahoz)
    }


def _allapot_betolt() -> dict:
    try:
        return json.loads(ALLAPOT.read_text(encoding="utf-8"))
    except Exception:
        return {"fajlok": {}, "napok": {}, "orak": {}}


def _feldolgoz() -> dict:
    allapot = _allapot_betolt()
    fajlok = allapot.setdefault("fajlok", {})
    napok = allapot.setdefault("napok", {})
    orak = allapot.setdefault("orak", {})

    if not LOG_DIR.is_dir():
        return {"hiba": f"nincs naplokonyvtar: {LOG_DIR}"}

    elerheto = sorted(p for p in LOG_DIR.iterdir() if NAPLO_MINTA.match(p.name))
    # A regi fajlok bejegyzeset kidobjuk, hogy az allapot ne hizjon.
    for nev in list(fajlok):
        if nev not in {p.name for p in elerheto}:
            fajlok.pop(nev, None)

    feldolgozott = 0
    for ut in elerheto:
        try:
            meret = ut.stat().st_size
        except OSError:
            continue
        offszet = int(fajlok.get(ut.name, 0))
        # Forgatas/uj fajl: ha kisebb lett, elorol kezdjuk.
        if offszet > meret:
            offszet = 0
        if offszet == meret:
            continue
        try:
            with ut.open("r", encoding="utf-8", errors="replace") as fh:
                fh.seek(offszet)
                for sor in fh:
                    if not sor.endswith("\n"):
                        break  # felig irt sor: legkozelebb folytatjuk
                    offszet += len(sor.encode("utf-8", errors="replace"))
                    feldolgozott += 1
                    try:
                        esemeny = json.loads(sor)
                    except Exception:
                        continue
                    _szamol(esemeny, napok, orak)
        except OSError:
            continue
        fajlok[ut.name] = offszet

    _forgat(napok, orak)
    return {"fajlok": fajlok, "napok": napok, "orak": orak,
            "feldolgozott_sorok": feldolgozott}


def _szamol(esemeny: dict, napok: dict, orak: dict) -> None:
    req = esemeny.get("request") or {}
    ut = str(req.get("uri") or "/")
    ut = ut.split("?")[0]
    ip = str(req.get("remote_ip") or req.get("client_ip") or "-")
    status = int(esemeny.get("status") or 0)
    nap = _nap(str(esemeny.get("ts") or ""))
    ora = _ora(str(esemeny.get("ts") or ""))

    n = napok.setdefault(nap, _uj_nap())
    o = orak.setdefault(ora, {"total": 0, "elutasitott": 0, "api_total": 0})
    api = ut.startswith("/api/")

    n["total"] += 1
    o["total"] += 1
    n["kodok"][str(status)] = n["kodok"].get(str(status), 0) + 1
    n["utak"][ut[:120]] = n["utak"].get(ut[:120], 0) + 1

    if 200 <= status < 400:
        n["sikeres"] += 1
        n["api_sikeres" if api else "frontend_sikeres"] += 1
    elif 400 <= status < 500:
        n["elutasitott"] += 1
        o["elutasitott"] += 1
        n["api_elutasitott" if api else "frontend_elutasitott"] += 1
        n["ipk"][ip] = n["ipk"].get(ip, 0) + 1
    elif status >= 500:
        n["szerverhiba"] += 1

    if api:
        n["api_total"] += 1
        o["api_total"] += 1
    else:
        n["frontend_total"] += 1


def _forgat(napok: dict, orak: dict) -> None:
    hatar = (datetime.now(timezone.utc) - timedelta(days=NAPI_MEGTART)).strftime("%Y-%m-%d")
    for nap in list(napok):
        if nap < hatar:
            napok.pop(nap, None)
    ora_hatar = (datetime.now(timezone.utc) - timedelta(hours=48)).strftime("%Y-%m-%dT%H")
    for ora in list(orak):
        if ora < ora_hatar:
            orak.pop(ora, None)


def _top(d: dict, darab: int = TOP_DB) -> list:
    return [{"nev": k, "db": v} for k, v in sorted(d.items(), key=lambda x: -x[1])[:darab]]


def _fail2ban() -> dict:
    """A bortonok es a jelenleg tiltott IP-k szama. Root nelkul csak olvashato
    naplobol/parancsbol; ha nem elerheto, ures marad (nem hiba)."""
    ki = {}
    try:
        lista = subprocess.run(["fail2ban-client", "status"], capture_output=True,
                               text=True, timeout=10)
        if lista.returncode != 0:
            return ki
        m = re.search(r"Jail list:\s*(.+)", lista.stdout)
        if not m:
            return ki
        for borton in [x.strip() for x in m.group(1).split(",") if x.strip()]:
            try:
                st = subprocess.run(["fail2ban-client", "status", borton],
                                    capture_output=True, text=True, timeout=10)
                b = re.search(r"Currently banned:\s*(\d+)", st.stdout)
                t = re.search(r"Total banned:\s*(\d+)", st.stdout)
                ki[borton] = {"most": int(b.group(1)) if b else 0,
                              "osszesen": int(t.group(1)) if t else 0}
            except Exception:
                continue
    except Exception:
        pass
    return ki


def main() -> int:
    ADAT.mkdir(parents=True, exist_ok=True)
    allapot = _feldolgoz()
    napok = allapot.get("napok", {})
    ma = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    aktualis = napok.get(ma, _uj_nap())
    kimenet = {
        "frissitve": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "nap": ma,
        "ma": {k: v for k, v in aktualis.items() if k not in ("ipk", "utak")},
        "top_elutasito_ipk": _top(aktualis.get("ipk", {})),
        "top_utak": _top(aktualis.get("utak", {})),
        "napi": [dict(nap=n, **{k: v for k, v in ertek.items() if k not in ("ipk", "utak")})
                 for n, ertek in sorted(napok.items())],
        "orak": dict(sorted(allapot.get("orak", {}).items())),
        "fail2ban": _fail2ban(),
        "feldolgozott_sorok": allapot.get("feldolgozott_sorok", 0),
        "naplo_fajlok": sorted(allapot.get("fajlok", {}).keys()),
    }
    if "hiba" in allapot:
        kimenet["hiba"] = allapot["hiba"]

    ideiglenes = KIMENET.with_suffix(".tmp")
    ideiglenes.write_text(json.dumps(kimenet, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(ideiglenes, KIMENET)
    ALLAPOT.write_text(json.dumps({"fajlok": allapot.get("fajlok", {}),
                                   "napok": napok, "orak": allapot.get("orak", {})},
                                  ensure_ascii=False), encoding="utf-8")
    print(f"statisztika kesz: {KIMENET} (feldolgozott sor: {kimenet['feldolgozott_sorok']}, "
          f"ma: {kimenet['ma']['total']} keres, ebbol {kimenet['ma']['elutasitott']} elutasitott)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
