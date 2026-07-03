from types import SimpleNamespace

from server import _build_chat_kb_query, _chunk_text, _expand_knowledge_query, _fts_query


def _msg(role: str, text: str):
    return SimpleNamespace(role=role, text=text)


STATE = SimpleNamespace(title="Emelkedett stressz", severity="közepes", profile="x" * 500)


def test_chunk_text_respects_size_limits():
    text = "\n\n".join(f"{i}. bekezdés: " + ("szó " * 80) for i in range(40))
    chunks = _chunk_text(text)
    assert len(chunks) > 1
    for c in chunks:
        assert len(c) <= 1400 + 200 + 2


def test_chunk_text_keeps_all_content():
    paragraphs = [f"egyedi-jelolo-{i} " + ("tartalom " * 30) for i in range(30)]
    chunks = _chunk_text("\n\n".join(paragraphs))
    joined = " ".join(chunks)
    for i in range(30):
        assert f"egyedi-jelolo-{i}" in joined


def test_chunk_text_splits_oversized_paragraph_with_overlap():
    huge = "betű" * 1000
    chunks = _chunk_text(huge)
    assert all(len(c) <= 1400 for c in chunks)
    assert len(chunks) >= 3


def test_build_chat_kb_query_specific_message_stays_clean():
    q = _build_chat_kb_query(
        "Mostanában nagyon nehezen alszom el és feszültnek érzem magam este.",
        [_msg("user", "korábbi üzenet"), _msg("assistant", "válasz")],
        STATE,
    )
    assert q == "Mostanában nagyon nehezen alszom el és feszültnek érzem magam este."
    assert "Emelkedett" not in q


def test_build_chat_kb_query_short_message_pulls_context():
    q = _build_chat_kb_query(
        "És miért?",
        [_msg("user", "Folyton ugyanazon a dolgon pörgök és nem tudom elengedni."), _msg("assistant", "...")],
        STATE,
    )
    assert "pörgök" in q
    assert "És miért?" in q
    assert "Emelkedett stressz" in q


def test_build_chat_kb_query_short_message_without_history():
    q = _build_chat_kb_query("Szia!", [], STATE)
    assert "Szia!" in q
    assert "Emelkedett stressz" in q


def test_fts_query_filters_stopwords():
    q = _fts_query("hogy vagy ma este szorongás")
    assert '"szorongás"' in q
    assert '"hogy"' not in q


def test_expand_knowledge_query_adds_concepts():
    q = _expand_knowledge_query("mindig ugyanoda jutok vissza, beragadok")
    assert "kényszerhurok" in q
