import itertools

from server import NORM_VERSION, _bucket, _compute_norms


def _answers(a_val: int, p_val: int, h_val: int, c_val: int) -> list[int]:
    return [a_val] * 6 + [p_val] * 6 + [h_val] * 4 + [c_val] * 5


def test_norm_version_is_2():
    assert NORM_VERSION == 2
    assert _compute_norms(_answers(3, 3, 3, 1))["v"] == 2


def test_all_minimum_answers_reach_scale_edges():
    norms = _compute_norms(_answers(1, 1, 1, 0))
    assert norms["a"] == 0.0
    assert norms["p"] == 1.0
    assert norms["h"] == 0.0
    assert norms["c"] == 0.0
    code = f"{_bucket(norms['a'])}{_bucket(norms['p'])}{_bucket(norms['h'])}{_bucket(norms['c'])}"
    assert code == "1411"


def test_all_maximum_answers_reach_scale_edges():
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
    reachable = {"a": set(), "p": set(), "h": set(), "c": set()}
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
    previous = None
    for p_val in range(1, 6):
        current = _compute_norms(_answers(3, p_val, 3, 1))["p"]
        if previous is not None:
            assert current < previous
        previous = current
