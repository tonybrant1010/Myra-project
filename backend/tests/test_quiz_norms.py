"""A v2 (POMP) ESV-normalizálás egységtesztjei.

A v1 hibája: a P dimenzió (1 - xp/30) érvényes, 1-5 közötti válaszokkal
legfeljebb 0.8-ig jutott, így a 4-es bucket ("erős érzelemszabályozás")
mérésből elérhetetlen volt. A v2 (POMP) képleteknél mind a négy dimenzió
a teljes [0, 1] tartományt kihasználja, és mind a négy bucket elérhető.
"""
import itertools

from server import NORM_VERSION, _bucket, _compute_norms


def _answers(a_val: int, p_val: int, h_val: int, c_val: int) -> list[int]:
    """21 elemű válaszlista blokkonként azonos értékekkel."""
    return [a_val] * 6 + [p_val] * 6 + [h_val] * 4 + [c_val] * 5


def test_norm_version_is_2():
    assert NORM_VERSION == 2
    assert _compute_norms(_answers(3, 3, 3, 1))["v"] == 2


def test_all_minimum_answers_reach_scale_edges():
    # Csupa minimum: A/H/C = 0, P = 1 (legjobb szabályozás)
    norms = _compute_norms(_answers(1, 1, 1, 0))
    assert norms["a"] == 0.0
    assert norms["p"] == 1.0
    assert norms["h"] == 0.0
    assert norms["c"] == 0.0
    code = f"{_bucket(norms['a'])}{_bucket(norms['p'])}{_bucket(norms['h'])}{_bucket(norms['c'])}"
    assert code == "1411"


def test_all_maximum_answers_reach_scale_edges():
    # Csupa maximum: A/H/C = 1, P = 0 (leggyengébb szabályozás)
    norms = _compute_norms(_answers(5, 5, 5, 2))
    assert norms["a"] == 1.0
    assert norms["p"] == 0.0
    assert norms["h"] == 1.0
    assert norms["c"] == 1.0
    code = f"{_bucket(norms['a'])}{_bucket(norms['p'])}{_bucket(norms['h'])}{_bucket(norms['c'])}"
    assert code == "4144"


def test_middle_answers_give_half():
    norms = _compute_norms(_answers(3, 3, 3, 1))
    assert norms["a"] == 0.5
    assert norms["p"] == 0.5
    assert norms["h"] == 0.5
    assert norms["c"] == 0.5


def test_all_norms_stay_in_unit_interval():
    for a_val, p_val, h_val, c_val in itertools.product(
        range(1, 6), range(1, 6), range(1, 6), range(0, 3)
    ):
        norms = _compute_norms(_answers(a_val, p_val, h_val, c_val))
        for key in ("a", "p", "h", "c"):
            assert 0.0 <= norms[key] <= 1.0, (key, norms[key])


def test_every_bucket_reachable_in_every_dimension():
    """v1-ben a P dimenzióban a 4-es bucket elérhetetlen volt — v2-ben már nem."""
    reachable = {"a": set(), "p": set(), "h": set(), "c": set()}
    # A/P blokk: 6 kérdés, összeg 6..30; H: 4 kérdés, 4..20; C: 5 kérdés, 0..10
    for xa in range(6, 31):
        reachable["a"].add(_bucket((xa - 6) / 24.0))
        reachable["p"].add(_bucket(1.0 - (xa - 6) / 24.0))
    for xh in range(4, 21):
        reachable["h"].add(_bucket((xh - 4) / 16.0))
    for xc in range(0, 11):
        reachable["c"].add(_bucket(xc / 10.0))
    for key, buckets in reachable.items():
        assert buckets == {1, 2, 3, 4}, f"{key} dimenzióban nem minden bucket érhető el: {buckets}"


def test_p_is_inverted_and_monotonic():
    """Magasabb P-válaszok (rosszabb szabályozás) monoton alacsonyabb P-normát adnak."""
    previous = None
    for p_val in range(1, 6):
        current = _compute_norms(_answers(3, p_val, 3, 1))["p"]
        if previous is not None:
            assert current < previous
        previous = current
