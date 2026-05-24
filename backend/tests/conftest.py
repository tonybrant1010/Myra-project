import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Use the public preview URL (EXPO_PUBLIC_BACKEND_URL is what frontend uses)
BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://cf368d4c-a251-4439-b121-b12f0fde5d9b.preview.emergentagent.com"
).rstrip("/")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def mongo():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


def _now():
    return datetime.now(timezone.utc)


def _make_user(mongo, email, is_admin=False, state_code=None):
    user_id = f"user_TEST_{uuid.uuid4().hex[:10]}"
    mongo.users.delete_many({"email": email})
    mongo.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": "TEST User",
        "picture": None,
        "is_admin": is_admin,
        "state_code": state_code,
        "code_verified_at": _now() if state_code else None,
        "created_at": _now(),
    })
    token = f"TEST_tok_{uuid.uuid4().hex}"
    mongo.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": _now() + timedelta(days=1),
        "created_at": _now(),
    })
    return user_id, token


@pytest.fixture
def regular_user(mongo):
    email = f"TEST_user_{uuid.uuid4().hex[:6]}@example.com"
    uid, tok = _make_user(mongo, email)
    yield {"user_id": uid, "token": tok, "email": email}
    mongo.users.delete_many({"user_id": uid})
    mongo.user_sessions.delete_many({"user_id": uid})
    mongo.chat_messages.delete_many({"user_id": uid})
    mongo.quiz_submissions.delete_many({"user_id": uid})


@pytest.fixture
def admin_user(mongo):
    email = f"TEST_admin_{uuid.uuid4().hex[:6]}@example.com"
    uid, tok = _make_user(mongo, email, is_admin=True)
    yield {"user_id": uid, "token": tok, "email": email}
    mongo.users.delete_many({"user_id": uid})
    mongo.user_sessions.delete_many({"user_id": uid})
    mongo.chat_messages.delete_many({"user_id": uid})
    mongo.quiz_submissions.delete_many({"user_id": uid})


def auth_h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
