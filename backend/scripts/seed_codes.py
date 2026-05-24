"""Seed the 256 ESV state codes from the LibreOffice ODS file into SQLite."""
import asyncio
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from odf.opendocument import load as load_ods  # type: ignore
from odf.table import Table, TableRow, TableCell  # type: ignore
from odf.text import P  # type: ignore

from server import StateCode, SessionLocal, engine, Base, _now  # type: ignore
from sqlalchemy import select


def cell_text(cell) -> str:
    return " ".join(str(p) for p in cell.getElementsByType(P)).strip()


def parse_codes(ods_path: Path):
    doc = load_ods(str(ods_path))
    target = None
    for t in doc.getElementsByType(Table):
        if t.getAttribute("name") == "Diagnózisok":
            target = t
            break
    if target is None:
        raise RuntimeError("Diagnózisok sheet not found")
    items = []
    for row in target.getElementsByType(TableRow):
        cells = row.getElementsByType(TableCell)
        vals = []
        for c in cells:
            repeat = int(c.getAttribute("numbercolumnsrepeated") or 1)
            v = cell_text(c) or c.getAttribute("value") or ""
            for _ in range(repeat):
                vals.append(v)
                if len(vals) > 8:
                    break
            if len(vals) > 8:
                break
        if len(vals) < 6:
            continue
        a, p, h, c, code, diag = vals[0], vals[1], vals[2], vals[3], vals[4], vals[5]
        if not re.fullmatch(r"\d{4}", str(code)):
            continue
        m = re.search(r"\(([A-ZÁÉÍÓÖŐÚÜŰ]+)\)\s*$", diag)
        severity = m.group(1) if m else ""
        title = re.sub(r"\s*\([A-ZÁÉÍÓÖŐÚÜŰ]+\)\s*$", "", diag).strip()
        items.append({
            "code": str(code), "a": int(a), "p": int(p), "h": int(h), "c": int(c),
            "title": title, "severity": severity, "profile": diag,
        })
    return items


async def main():
    ods = ROOT / "data" / "esv_calc.ods"
    if not ods.exists():
        print("ERROR: data/esv_calc.ods missing", file=sys.stderr); sys.exit(1)
    items = parse_codes(ods)
    print(f"Parsed {len(items)} codes")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        for it in items:
            res = await db.execute(select(StateCode).where(StateCode.code == it["code"]))
            sc = res.scalar_one_or_none()
            if sc is None:
                sc = StateCode(code=it["code"])
                db.add(sc)
            sc.a, sc.p, sc.h, sc.c = it["a"], it["p"], it["h"], it["c"]
            sc.title, sc.severity, sc.profile = it["title"], it["severity"], it["profile"]
            sc.updated_at = _now()
        await db.commit()
        total = (await db.execute(select(StateCode))).scalars().all()
        print(f"Total codes in DB: {len(total)}")


if __name__ == "__main__":
    asyncio.run(main())
