"""A 2026-08-17-i felhasználói teszt négy anomáliája ellen.

A modell a beszélgetési előzmény formátumát vette át, és a saját válaszát
időbélyeggel / formátum-törmelékkel kezdte. A tesztek két oldalt fognak közre:
a bemenetet (mit lát a modell) és a kimenetet (mit engedünk ki).
"""

from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

from server import _clean_llm_reply, _format_chat_history_for_llm


def _msg(role: str, text: str, when: datetime):
    return SimpleNamespace(role=role, text=text, created_at=when)


BASE = datetime(2026, 8, 17, 17, 22, 44, tzinfo=timezone.utc)


# --- bemeneti oldal: mit lát a modell -------------------------------------------------

def test_history_timestamps_only_on_user_messages():
    """Myra saját korábbi válaszai NEM kaphatnak időbélyeget: abból tanulta meg,
    hogy 'így írok én', és sajátot kezdett generálni."""
    hist = _format_chat_history_for_llm([
        _msg("user", "Szia myra", BASE),
        _msg("assistant", "Szia, Kira! Jó itt lenni.", BASE),
        _msg("user", "Mit tudsz?", BASE + timedelta(minutes=2)),
    ])
    user_items = [h for h in hist if h["role"] == "user"]
    ai_items = [h for h in hist if h["role"] == "assistant"]

    assert all(h["text"].startswith("[") for h in user_items)
    assert not any(h["text"].startswith("[") for h in ai_items)
    assert ai_items[0]["text"] == "Szia, Kira! Jó itt lenni."


def test_history_timestamp_has_seconds():
    """Másodperc nélkül az azonos percbe eső üzenetek sorrendje nem állapítható meg."""
    hist = _format_chat_history_for_llm([
        _msg("user", "első", BASE),
        _msg("user", "második", BASE.replace(second=51)),
    ])
    assert hist[0]["text"] != hist[1]["text"]
    for h in hist:
        stamp = h["text"].split("]")[0]
        assert stamp.count(":") == 2, f"nincs másodperc: {stamp}"


# --- kimeneti oldal: biztonsági háló --------------------------------------------------

def test_strips_single_timestamp():
    assert _clean_llm_reply("[2026.08.17 19:23] Az a teljes megszűnés") == "Az a teljes megszűnés"


def test_strips_repeated_timestamps():
    """A korábbi egyszeri re.sub csak az elsőt vitte el — a második bennmaradt,
    és pontosan ez került ki a felhasználóhoz."""
    raw = "[2026.08.17 19:22] [2026.08.17 19:23] Az a teljes megszűnés"
    assert _clean_llm_reply(raw) == "Az a teljes megszűnés"


def test_strips_timestamp_with_seconds():
    assert _clean_llm_reply("[2026.08.17 19:23:07] Jogos") == "Jogos"


def test_strips_markup_prefix():
    assert _clean_llm_reply("</div>\nJó, ebben teljesen igazad van") == "Jó, ebben teljesen igazad van"


def test_strips_markup_and_timestamp_together():
    raw = "</div>\n[2026.08.17 19:30] Jogos, elbeszéltem magam."
    assert _clean_llm_reply(raw) == "Jogos, elbeszéltem magam."


def test_strips_invisible_characters():
    assert _clean_llm_reply("⁠Az írás néha") == "Az írás néha"
    assert _clean_llm_reply("﻿[2026.08.17 19:23] Szia") == "Szia"


def test_leaves_normal_reply_untouched():
    for jo in [
        "Szia, Kira! Jó itt lenni.",
        "A 740. rész az már komoly elköteleződés!",
        "Az orchideák [zárójeles megjegyzés] után is jók.",
        "<3 ez maradjon meg",
        "2026.08.17 — ez dátum a mondat elején, nem előtag",
    ]:
        assert _clean_llm_reply(jo) == jo


def test_does_not_eat_the_whole_reply():
    """Csak az elejéről vágunk; a szövegtörzsben lévő minta maradjon."""
    raw = "[2026.08.17 19:23] Erre írtad: [2026.08.17 19:20] szia"
    assert _clean_llm_reply(raw) == "Erre írtad: [2026.08.17 19:20] szia"
