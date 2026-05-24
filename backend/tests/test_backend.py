"""Backend API tests for Myra-project (Allapotkod) app — iteration 2.

Covers:
- /api/config (forms_url)
- 256 seeded ESV state codes, each /^[1-4]{4}$/ with full a/p/h/c/title/severity/profile fields
- Code verify: valid (2334), out-of-range (5678, 9999), wrong length (12), zero-digit (0000)
- Real Gemini call via /api/chat/send with mocked-auth user + verified code (2222)
- Chat history persistence + reset clears state_code and chat history
- Admin CRUD smoke
"""
import re
import pytest
from conftest import BASE_URL, auth_h


# ---------- Config ----------
class TestConfig:
    def test_get_config(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/config")
        assert r.status_code == 200
        data = r.json()
        assert data["forms_url"] == "https://forms.gle/6zRNFkaxbt8qArv16"


# ---------- 256 seeded ESV codes ----------
class TestSeedCodes:
    def test_exactly_256_codes(self, mongo):
        n = mongo.state_codes.count_documents({})
        assert n == 256, f"expected 256 state codes, got {n}"

    def test_all_codes_match_1to4_4digits(self, mongo):
        pat = re.compile(r"^[1-4]{4}$")
        bad = [
            d["code"]
            for d in mongo.state_codes.find({}, {"code": 1, "_id": 0})
            if not pat.match(d["code"])
        ]
        assert bad == [], f"codes not matching /^[1-4]{{4}}$/: {bad[:10]}"

    def test_all_codes_have_required_fields(self, mongo):
        required = {"code", "a", "p", "h", "c", "title", "severity", "profile"}
        missing = []
        for d in mongo.state_codes.find({}, {"_id": 0}):
            absent = required - set(d.keys())
            if absent:
                missing.append((d.get("code"), absent))
                if len(missing) >= 5:
                    break
        assert missing == [], f"docs missing required fields: {missing}"

    def test_subscore_ranges(self, mongo):
        """a/p/h/c must each be ints in 1..4 across all 256 docs."""
        bad = []
        for d in mongo.state_codes.find({}, {"_id": 0}):
            for k in ("a", "p", "h", "c"):
                v = d.get(k)
                if not isinstance(v, int) or v < 1 or v > 4:
                    bad.append((d["code"], k, v))
        assert not bad, f"subscore out of range or wrong type: {bad[:5]}"


# ---------- Auth gating ----------
class TestAuthGating:
    @pytest.mark.parametrize("method,path,body", [
        ("get", "/api/auth/me", None),
        ("post", "/api/codes/verify", {"code": "2334"}),
        ("post", "/api/chat/send", {"message": "hi"}),
        ("get", "/api/chat/history", None),
        ("get", "/api/codes/me", None),
        ("post", "/api/codes/reset", None),
        ("get", "/api/admin/codes", None),
    ])
    def test_requires_auth(self, api_client, method, path, body):
        fn = getattr(api_client, method)
        r = fn(f"{BASE_URL}{path}", json=body) if body is not None else fn(f"{BASE_URL}{path}")
        assert r.status_code == 401, f"{method} {path} expected 401 got {r.status_code}"

    def test_session_empty_token(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/session", json={"session_token": ""})
        assert r.status_code == 400


# ---------- Code verification ----------
class TestCodeVerify:
    def test_auth_me(self, api_client, regular_user):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_h(regular_user["token"]))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == regular_user["email"]

    def test_verify_valid_2334(self, api_client, regular_user, mongo):
        r = api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "2334"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        sc = data["state_code"]
        assert sc["code"] == "2334"
        # rich profile contract
        for k in ("a", "p", "h", "c", "title", "severity", "profile"):
            assert k in sc, f"missing field {k} in returned state_code"
        assert all(isinstance(sc[k], int) and 1 <= sc[k] <= 4 for k in ("a", "p", "h", "c"))
        # persisted in DB
        u = mongo.users.find_one({"user_id": regular_user["user_id"]})
        assert u["state_code"] == "2334"

    def test_verify_out_of_range_5678(self, api_client, regular_user):
        r = api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "5678"},
        )
        assert r.status_code == 400, r.text

    def test_verify_short_12(self, api_client, regular_user):
        r = api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "12"},
        )
        assert r.status_code == 400

    def test_verify_out_of_range_9999(self, api_client, regular_user):
        """9999: length OK but digit 9 invalid; validation must run BEFORE DB lookup."""
        r = api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "9999"},
        )
        assert r.status_code == 400, r.text
        assert "1" in r.json().get("detail", "") and "4" in r.json().get("detail", "")

    def test_verify_zero_digit_0000(self, api_client, regular_user):
        """All 256 codes are seeded, so use 0000 (digit 0 invalid) for the 'not seeded' style case."""
        r = api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "0000"},
        )
        assert r.status_code == 400, r.text

    def test_codes_me_empty(self, api_client, regular_user):
        r = api_client.get(f"{BASE_URL}/api/codes/me", headers=auth_h(regular_user["token"]))
        assert r.status_code == 200
        assert r.json()["state_code"] is None

    def test_codes_me_after_verify(self, api_client, regular_user):
        api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "2222"},
        )
        r = api_client.get(f"{BASE_URL}/api/codes/me", headers=auth_h(regular_user["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["state_code"] == "2222"
        assert data["profile"]["code"] == "2222"
        assert "title" in data["profile"] and data["profile"]["title"]

    def test_reset_clears_code_but_keeps_history(self, api_client, regular_user, mongo):
        """Iter 3: /api/codes/reset clears state_code BUT preserves chat_messages."""
        api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "2222"},
        )
        from datetime import datetime, timezone
        mongo.chat_messages.insert_one({
            "id": "TEST_msg1",
            "user_id": regular_user["user_id"],
            "state_code": "2222",
            "role": "user",
            "text": "TEST hi",
            "created_at": datetime.now(timezone.utc),
        })
        before = mongo.chat_messages.count_documents({"user_id": regular_user["user_id"]})
        assert before >= 1
        r = api_client.post(f"{BASE_URL}/api/codes/reset", headers=auth_h(regular_user["token"]))
        assert r.status_code == 200
        u = mongo.users.find_one({"user_id": regular_user["user_id"]})
        assert u["state_code"] is None
        assert u["code_verified_at"] is None
        # IMPORTANT: chat history must NOT be deleted on reset (iter 3 contract).
        after = mongo.chat_messages.count_documents({"user_id": regular_user["user_id"]})
        assert after == before, f"chat_messages were deleted on reset (before={before}, after={after})"

    def test_verify_does_not_delete_history(self, api_client, regular_user, mongo):
        """Iter 3: re-verifying a (new) code must not wipe chat history."""
        from datetime import datetime, timezone
        api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "2222"},
        )
        mongo.chat_messages.insert_many([
            {"id": f"TEST_msg_{i}", "user_id": regular_user["user_id"], "state_code": "2222",
             "role": "user", "text": f"TEST {i}", "created_at": datetime.now(timezone.utc)}
            for i in range(3)
        ])
        before = mongo.chat_messages.count_documents({"user_id": regular_user["user_id"]})
        assert before >= 3
        r = api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "2334"},
        )
        assert r.status_code == 200
        after = mongo.chat_messages.count_documents({"user_id": regular_user["user_id"]})
        assert after == before, f"verify deleted chat_messages (before={before}, after={after})"


# ---------- Admin smoke ----------
class TestAdmin:
    def test_non_admin_forbidden(self, api_client, regular_user):
        r = api_client.get(f"{BASE_URL}/api/admin/codes", headers=auth_h(regular_user["token"]))
        assert r.status_code == 403

    def test_admin_list_codes(self, api_client, admin_user):
        r = api_client.get(f"{BASE_URL}/api/admin/codes", headers=auth_h(admin_user["token"]))
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 256
        assert any(i["code"] == "2334" for i in items)

    def test_admin_crud(self, api_client, admin_user, mongo):
        new_code = "1111"  # exists; we will fully clean up after
        original = mongo.state_codes.find_one({"code": new_code}, {"_id": 0})
        try:
            r = api_client.post(
                f"{BASE_URL}/api/admin/codes",
                headers=auth_h(admin_user["token"]),
                json={"code": new_code, "title": "TEST_Title_v1", "profile": "TEST profile v1"},
            )
            assert r.status_code == 200, r.text
            assert r.json()["item"]["title"] == "TEST_Title_v1"

            # Upsert (update) path
            r = api_client.post(
                f"{BASE_URL}/api/admin/codes",
                headers=auth_h(admin_user["token"]),
                json={"code": new_code, "title": "TEST_Title_v2", "profile": "p2"},
            )
            assert r.status_code == 200
            assert r.json()["item"]["title"] == "TEST_Title_v2"

            # Delete then re-create to verify delete works
            r = api_client.delete(
                f"{BASE_URL}/api/admin/codes/{new_code}",
                headers=auth_h(admin_user["token"]),
            )
            assert r.status_code == 200
            assert r.json()["deleted"] == 1
            assert mongo.state_codes.find_one({"code": new_code}) is None
        finally:
            # Restore the original 1111 document so we don't break the 256 seed
            mongo.state_codes.delete_one({"code": new_code})
            if original:
                mongo.state_codes.insert_one(original)

    def test_admin_create_invalid_code(self, api_client, admin_user):
        r = api_client.post(
            f"{BASE_URL}/api/admin/codes",
            headers=auth_h(admin_user["token"]),
            json={"code": "12", "title": "x", "profile": "y"},
        )
        assert r.status_code == 400


# ---------- Chat (real Gemini call) ----------
class TestChat:
    def test_chat_without_code(self, api_client, regular_user):
        r = api_client.post(
            f"{BASE_URL}/api/chat/send",
            headers=auth_h(regular_user["token"]),
            json={"message": "Szia"},
        )
        assert r.status_code == 400

    def test_chat_real_gemini_and_history(self, api_client, regular_user, mongo):
        """Real Gemini round-trip; validates new Myra system prompt is in effect."""
        # Verify code 2222
        v = api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "2222"},
        )
        assert v.status_code == 200

        r = api_client.post(
            f"{BASE_URL}/api/chat/send",
            headers=auth_h(regular_user["token"]),
            json={"message": "Szia Myra! Egy kicsit fáradt vagyok ma."},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["assistant_message"]["role"] == "assistant"
        reply = data["assistant_message"]["text"]
        assert len(reply) > 0

        # Myra prompt contract: no ESV jargon leaked
        lower = reply.lower()
        assert "esv" not in lower, f"system prompt leaked 'ESV': {reply[:200]}"
        assert "p-érték" not in lower, f"jargon 'P-érték' leaked: {reply[:200]}"
        # Should not quote the user's code back
        assert "2222" not in reply, f"code 2222 echoed back: {reply[:200]}"
        # Heuristic Hungarian-language sanity check: at least one common Hungarian word
        hu_markers = ["a ", " és ", "vagy", "hogy", "nem", "te ", "én ", "is ", "itt", "így", "nagyon", "csak"]
        assert any(m in (" " + lower + " ") for m in hu_markers), f"reply doesn't look Hungarian: {reply[:200]}"

        # History contains both messages, in order
        h = api_client.get(
            f"{BASE_URL}/api/chat/history",
            headers=auth_h(regular_user["token"]),
        )
        assert h.status_code == 200
        msgs = h.json()["messages"]
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles
        assert roles[0] == "user" and roles[1] == "assistant"

    def test_chat_empty_message(self, api_client, regular_user):
        api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "2222"},
        )
        r = api_client.post(
            f"{BASE_URL}/api/chat/send",
            headers=auth_h(regular_user["token"]),
            json={"message": "   "},
        )
        assert r.status_code == 400


# ---------- Quiz (iter 3) ----------
class TestQuiz:
    # GET /api/quiz/questions
    def test_quiz_questions_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/quiz/questions")
        assert r.status_code == 401

    def test_quiz_questions_shape(self, api_client, regular_user):
        r = api_client.get(f"{BASE_URL}/api/quiz/questions",
                           headers=auth_h(regular_user["token"]))
        assert r.status_code == 200, r.text
        sections = r.json()["sections"]
        assert isinstance(sections, list) and len(sections) == 4
        by_id = {s["id"]: s for s in sections}
        assert set(by_id) == {"A", "P", "H", "C"}
        # Question counts: A=6, P=6, H=4, C=5 → total 21
        assert len(by_id["A"]["questions"]) == 6
        assert len(by_id["P"]["questions"]) == 6
        assert len(by_id["H"]["questions"]) == 4
        assert len(by_id["C"]["questions"]) == 5
        total = sum(len(by_id[k]["questions"]) for k in "APHC")
        assert total == 21
        # Scales: A/P/H use 1..5 (5 items), C uses 0..2 (3 items)
        for k in ("A", "P", "H"):
            scale_vals = [item["value"] for item in by_id[k]["scale"]]
            assert scale_vals == [1, 2, 3, 4, 5], f"{k} scale mismatch: {scale_vals}"
            for item in by_id[k]["scale"]:
                assert isinstance(item["label"], str) and item["label"]
        c_vals = [item["value"] for item in by_id["C"]["scale"]]
        assert c_vals == [0, 1, 2], f"C scale mismatch: {c_vals}"

    # POST /api/quiz/submit happy paths (Excel formula bucketing)
    @pytest.mark.parametrize("a,p,h,c,expected_code,expected_norms", [
        # (a) min everywhere
        ([1]*6, [5]*6, [1]*4, [0]*5, "1111", {"a": 0.2, "p": 0.0, "h": 0.2, "c": 0.0}),
        # (b) max everywhere
        ([5]*6, [1]*6, [5]*4, [2]*5, "4344", {"a": 1.0, "p": 0.8, "h": 1.0, "c": 1.0}),
        # (c) mid → 2222
        ([3]*6, [3]*6, [3]*4, [1]*5, "2222", {"a": 0.6, "p": 0.4, "h": 0.6, "c": 0.5}),
    ])
    def test_quiz_submit_vectors(self, api_client, regular_user, mongo,
                                 a, p, h, c, expected_code, expected_norms):
        answers = a + p + h + c
        assert len(answers) == 21
        r = api_client.post(
            f"{BASE_URL}/api/quiz/submit",
            headers=auth_h(regular_user["token"]),
            json={"answers": answers},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["code"] == expected_code, f"got {data['code']} expected {expected_code}"
        sc = data["state_code"]
        assert sc["code"] == expected_code
        for k in ("a", "p", "h", "c", "title", "severity", "profile"):
            assert k in sc
        norms = data["norms"]
        for k in ("a", "p", "h", "c"):
            assert abs(norms[k] - expected_norms[k]) < 1e-6, f"norm {k}={norms[k]}"
        # /api/codes/me reflects the new code
        me = api_client.get(f"{BASE_URL}/api/codes/me",
                            headers=auth_h(regular_user["token"]))
        assert me.status_code == 200
        assert me.json()["state_code"] == expected_code
        # User doc persisted
        u = mongo.users.find_one({"user_id": regular_user["user_id"]})
        assert u["state_code"] == expected_code
        # quiz_submissions has the record
        sub = mongo.quiz_submissions.find_one(
            {"user_id": regular_user["user_id"], "code": expected_code}
        )
        assert sub is not None
        # cleanup the submission row
        mongo.quiz_submissions.delete_many({"user_id": regular_user["user_id"]})

    # Validation errors
    def test_quiz_submit_too_few(self, api_client, regular_user):
        r = api_client.post(
            f"{BASE_URL}/api/quiz/submit",
            headers=auth_h(regular_user["token"]),
            json={"answers": [1] * 20},
        )
        assert r.status_code == 400, r.text

    def test_quiz_submit_too_many(self, api_client, regular_user):
        r = api_client.post(
            f"{BASE_URL}/api/quiz/submit",
            headers=auth_h(regular_user["token"]),
            json={"answers": [1] * 22},
        )
        assert r.status_code == 400, r.text

    def test_quiz_submit_a_out_of_range(self, api_client, regular_user):
        # First A answer = 7 (must be 1..5)
        answers = [7] + [1]*5 + [3]*6 + [3]*4 + [1]*5
        r = api_client.post(
            f"{BASE_URL}/api/quiz/submit",
            headers=auth_h(regular_user["token"]),
            json={"answers": answers},
        )
        assert r.status_code == 400, r.text

    def test_quiz_submit_c_out_of_range(self, api_client, regular_user):
        # First C answer = 5 (must be 0..2)
        answers = [3]*6 + [3]*6 + [3]*4 + [5, 1, 1, 1, 1]
        r = api_client.post(
            f"{BASE_URL}/api/quiz/submit",
            headers=auth_h(regular_user["token"]),
            json={"answers": answers},
        )
        assert r.status_code == 400, r.text

    def test_quiz_submit_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/quiz/submit", json={"answers": [1]*21})
        assert r.status_code == 401

    # Chat history preservation across quiz re-takes
    def test_quiz_submit_preserves_chat_history(self, api_client, regular_user, mongo):
        from datetime import datetime, timezone
        # Seed pre-existing chat messages tied to an older code
        mongo.chat_messages.insert_many([
            {"id": f"TEST_pre_{i}", "user_id": regular_user["user_id"],
             "state_code": "1111", "role": "user", "text": f"old {i}",
             "created_at": datetime.now(timezone.utc)}
            for i in range(4)
        ])
        before = mongo.chat_messages.count_documents({"user_id": regular_user["user_id"]})
        assert before == 4
        # Submit a fresh quiz computing a different code
        r = api_client.post(
            f"{BASE_URL}/api/quiz/submit",
            headers=auth_h(regular_user["token"]),
            json={"answers": [3]*6 + [3]*6 + [3]*4 + [1]*5},  # → 2222
        )
        assert r.status_code == 200
        # GET /api/chat/history still returns the 4 old messages
        h = api_client.get(f"{BASE_URL}/api/chat/history",
                           headers=auth_h(regular_user["token"]))
        assert h.status_code == 200
        msgs = h.json()["messages"]
        old_ids = {m["id"] for m in msgs if m["id"].startswith("TEST_pre_")}
        assert old_ids == {f"TEST_pre_{i}" for i in range(4)}, \
            f"chat history was wiped on quiz submit; remaining: {old_ids}"
        after = mongo.chat_messages.count_documents({"user_id": regular_user["user_id"]})
        assert after == before


# ---------- Chat persistence: state_code tagging ----------
class TestChatStateCodeField:
    def test_chat_send_persists_state_code_field(self, api_client, regular_user, mongo):
        # Verify code
        v = api_client.post(
            f"{BASE_URL}/api/codes/verify",
            headers=auth_h(regular_user["token"]),
            json={"code": "2222"},
        )
        assert v.status_code == 200
        # Send a chat message (real Gemini call). If quota dies, skip gracefully.
        r = api_client.post(
            f"{BASE_URL}/api/chat/send",
            headers=auth_h(regular_user["token"]),
            json={"message": "Szia Myra, csak tesztelek."},
            timeout=120,
        )
        if r.status_code == 402:
            pytest.skip("LLM budget exhausted (environment limited)")
        assert r.status_code == 200, r.text
        # Both inserted docs should carry state_code='2222'
        docs = list(mongo.chat_messages.find(
            {"user_id": regular_user["user_id"]}, {"_id": 0}
        ).sort("created_at", 1))
        assert len(docs) >= 2
        for d in docs[-2:]:
            assert d.get("state_code") == "2222", \
                f"chat_messages doc missing state_code: {d}"
        roles = [d["role"] for d in docs[-2:]]
        assert roles == ["user", "assistant"]
