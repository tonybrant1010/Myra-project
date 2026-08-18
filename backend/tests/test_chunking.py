"""A darabolás a beágyazó modell 128 tokenes korlátjához igazodik.

2026-08-18-i mérés (Cloud Shell, valódi tudásanyag-részlet): 500 karakter fölött a
szöveg vége már egyáltalán nem változtat az embeddingen. A régi 1400-as darabolással
a 980 részletből 825 csonkolva indexelődött, és a tudásanyag 57%-a soha nem került
be a szemantikus keresésbe.
"""

from server import (
    _chunk_text,
    _split_long_paragraph,
    RAG_CHUNK_MAX_CHARS,
    RAG_CHUNK_MIN_CHARS,
    RAG_CHUNK_OVERLAP,
)

# A leghosszabb cím 77 karakter, és a beágyazásba "{title}\n{chunk}" megy.
BEAGYAZASI_KORLAT = 500
LEGHOSSZABB_CIM = 77


def test_alapertelmezett_darab_belefer_a_modell_ablakaba():
    assert RAG_CHUNK_MAX_CHARS + LEGHOSSZABB_CIM + 1 <= BEAGYAZASI_KORLAT


def test_hosszu_bekezdes_darabjai_nem_lepik_tul_a_korlatot():
    szoveg = "A kiégés lassan alakul ki és sokáig észrevétlen marad. " * 120
    for darab in _chunk_text(szoveg):
        assert len(darab) <= RAG_CHUNK_MAX_CHARS


def test_tobb_bekezdes_eseten_is_tartja_a_korlatot():
    szoveg = "\n\n".join(f"{i}. bekezdés: " + ("szó " * 60) for i in range(30))
    darabok = _chunk_text(szoveg)
    assert len(darabok) > 1
    for darab in darabok:
        assert len(darab) <= RAG_CHUNK_MAX_CHARS


def test_semmi_nem_vesz_el_a_szovegbol():
    """A darabolás nem dobhat el tartalmat -- a régi hiba nem az volt, hogy
    elveszett a szöveg, hanem hogy az indexelés nem látta."""
    szoveg = "\n\n".join(f"egyedi{i} bekezdés tartalma itt" for i in range(40))
    egyben = " ".join(_chunk_text(szoveg))
    for i in range(40):
        assert f"egyedi{i}" in egyben


def test_atfedes_nem_okoz_vegtelen_ciklust():
    """Ha az overlap >= max_chars, a régi kód nem haladt volna előre."""
    darabok = _chunk_text("x" * 5000, max_chars=200, overlap=500)
    assert len(darabok) > 1
    assert all(len(d) <= 200 for d in darabok)


def test_ures_szoveg():
    assert _chunk_text("") == []
    assert _chunk_text("   \n\n  ") == []


def test_overlap_alapertelmezes_ertelmes():
    assert 0 <= RAG_CHUNK_OVERLAP < RAG_CHUNK_MAX_CHARS


# --- a 2026-08-18-i újraindexelés hibája ellen -------------------------------------


def _hosszu_bekezdes(karakter: int) -> str:
    """Valósághű, folyó magyar szakszöveg, adott hosszúságra vágva szóhatáron."""
    mondat = ("A koregulációs képesség internalizálódása mérhető folyamat, amely a "
              "csoportfejlődés során fokozatosan alakul át külső szabályozásból belsővé. ")
    szoveg = (mondat * 60)[:karakter]
    return szoveg.rsplit(" ", 1)[0]


def test_nincs_tormelek_darab():
    """A régi daraboló pontos karakterpozíciónál vágott, ezért a bekezdés végén
    ilyenek maradtak: '.', 'lja', 'ás).', 'zsgálatát.' — 3166 darabból 108."""
    for hossz in range(500, 4001, 137):
        for darab in _chunk_text(_hosszu_bekezdes(hossz)):
            assert len(darab) >= 50, f"törmelék {len(darab)} karakterrel: {darab!r}"


def test_szohataron_vag_nem_szo_kozepen():
    darabok = _split_long_paragraph(_hosszu_bekezdes(3000), 400, 80)
    egesz = _hosszu_bekezdes(3000)
    for darab in darabok:
        for szo in darab.split():
            assert szo in egesz.split(), f"csonka szó: {szo!r}"


def test_minden_szo_megmarad():
    eredeti = _hosszu_bekezdes(3000).split()
    kapott = set()
    for darab in _split_long_paragraph(_hosszu_bekezdes(3000), 400, 80):
        kapott.update(darab.split())
    assert set(eredeti) <= kapott


def test_nincs_csak_atfedesbol_allo_darab():
    """Minden darabnak kell legalább egy olyan szót tartalmaznia, ami az előzőben nincs."""
    darabok = _split_long_paragraph(_hosszu_bekezdes(2600), 400, 80)
    for elozo, kovetkezo in zip(darabok, darabok[1:]):
        assert kovetkezo != elozo
        assert not kovetkezo.startswith(elozo)


def test_rovid_bekezdes_beolvad_ha_belefer():
    szoveg = "Első bekezdés hosszabb szöveggel, ami önmagában elég hosszú.\n\nRövid."
    darabok = _chunk_text(szoveg, max_chars=400, overlap=80, min_chars=120)
    assert len(darabok) == 1
    assert "Rövid." in darabok[0]


def test_rovid_egyedi_tartalom_nem_vesz_el():
    """Ha nem fér be az előzőbe, akkor is meg kell maradnia -- törölni nem szabad."""
    hosszu = "x" * 390
    darabok = _chunk_text(f"{hosszu}\n\nRövid egyedi címsor.", max_chars=400, overlap=80, min_chars=120)
    egyben = " ".join(darabok)
    assert "Rövid egyedi címsor." in egyben


def test_min_chars_ertelmes_alapertelmezes():
    assert 0 < RAG_CHUNK_MIN_CHARS <= RAG_CHUNK_MAX_CHARS
