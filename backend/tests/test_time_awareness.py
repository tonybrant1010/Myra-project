import os
import sys
from datetime import timedelta

os.environ["DB_DIALECT"] = "sqlite"
os.environ["ENVIRONMENT"] = "development"

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from server import _build_system_prompt, StateCode, _now

def test_build_system_prompt_time_awareness():
    sc = StateCode(
        code="1234",
        a="A1",
        p="P1",
        h="H1",
        c="C1",
        title="Teszt Állapot",
        profile="Teszt profil leírás",
        severity="Enyhe"
    )
    
    prompt = _build_system_prompt("Rendszer üzenet", "Tudásbázis tartalom", sc, "János")
    assert "János" in prompt
    assert "Teszt Állapot" in prompt
    assert "[IDŐ KONTEXTUS]" in prompt
    assert "FONTOS: A beszélgetés előzményeiben szereplő üzenetek" in prompt
    
    now = _now()
    verified_at = now - timedelta(days=10)
    prompt_with_date = _build_system_prompt("Rendszer üzenet", "Tudásbázis tartalom", sc, "János", verified_at)
    
    assert "Felhasználó stresszfelmérése (mérése): 10 napja történt" in prompt_with_date
    assert "Mérési kód érvényessége: még 20 napig aktív" in prompt_with_date
