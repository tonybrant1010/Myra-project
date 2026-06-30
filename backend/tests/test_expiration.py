import pytest
import datetime
from datetime import timezone
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, delete

# Set environment variables for testing before importing server
import os
os.environ["DB_DIALECT"] = "sqlite"
os.environ["ENVIRONMENT"] = "development"


import sys
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from server import (
    app,
    Base,
    User,
    StateCode,
    QuizSubmission,
    ChatMessage,
    MfaChallenge,
    TrustedDevice,
    AdminAuditLog,
    ADMIN_EMAIL_ALLOWLIST,
    _admin_audit,
    hash_password,
    _cleanup_expired_security_records,
    get_db,
    get_current_user,
    require_admin,
)

# Setup test in-memory SQLite database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

# Override get_db dependency
async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# Tell pytest to use anyio for async tests
@pytest.fixture
def anyio_backend():
    return "asyncio"

# Create a fixture to initialize the database
@pytest.fixture(autouse=True)
async def init_db():
    app.dependency_overrides[get_db] = override_get_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_register_requires_current_legal_acceptance():
    client = TestClient(app)

    response = client.post("/api/auth/register", json={
        "email": "legal-missing@example.com",
        "name": "Legal Missing",
        "password": "correct-password",
    })

    assert response.status_code == 400
    assert "feltételek" in response.json()["detail"]


@pytest.mark.anyio
async def test_register_stores_legal_acceptance_metadata():
    client = TestClient(app)

    response = client.post("/api/auth/register", json={
        "email": "legal-ok@example.com",
        "name": "Legal Ok",
        "password": "correct-password",
        "accepted_terms": True,
        "accepted_terms_version": "2026-06-15",
        "accepted_privacy_version": "2026-06-15",
    })

    assert response.status_code == 200
    async with TestingSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == "legal-ok@example.com"))).scalar_one()
        assert user.terms_version == "2026-06-15"
        assert user.privacy_version == "2026-06-15"
        assert user.terms_accepted_at is not None


@pytest.mark.anyio
async def test_first_registered_user_is_not_admin_without_allowlist():
    client = TestClient(app)
    original_allowlist = set(ADMIN_EMAIL_ALLOWLIST)
    ADMIN_EMAIL_ALLOWLIST.clear()
    try:
        response = client.post("/api/auth/register", json={
            "email": "first-user@example.com",
            "name": "First User",
            "password": "correct-password",
            "accepted_terms": True,
            "accepted_terms_version": "2026-06-15",
            "accepted_privacy_version": "2026-06-15",
        })

        assert response.status_code == 200
        async with TestingSessionLocal() as db:
            user = (await db.execute(select(User).where(User.email == "first-user@example.com"))).scalar_one()
            assert user.is_admin is False
    finally:
        ADMIN_EMAIL_ALLOWLIST.clear()
        ADMIN_EMAIL_ALLOWLIST.update(original_allowlist)


@pytest.mark.anyio
async def test_register_assigns_admin_only_from_allowlist():
    client = TestClient(app)
    original_allowlist = set(ADMIN_EMAIL_ALLOWLIST)
    ADMIN_EMAIL_ALLOWLIST.clear()
    ADMIN_EMAIL_ALLOWLIST.add("allowed-admin@example.com")
    try:
        response = client.post("/api/auth/register", json={
            "email": "allowed-admin@example.com",
            "name": "Allowed Admin",
            "password": "correct-password",
            "accepted_terms": True,
            "accepted_terms_version": "2026-06-15",
            "accepted_privacy_version": "2026-06-15",
        })

        assert response.status_code == 200
        async with TestingSessionLocal() as db:
            user = (await db.execute(select(User).where(User.email == "allowed-admin@example.com"))).scalar_one()
            assert user.is_admin is True
    finally:
        ADMIN_EMAIL_ALLOWLIST.clear()
        ADMIN_EMAIL_ALLOWLIST.update(original_allowlist)

@pytest.mark.anyio
async def test_delete_account_removes_user_data_and_writes_minimal_audit():
    client = TestClient(app)
    now = datetime.datetime.now(timezone.utc)

    async with TestingSessionLocal() as db:
        user = User(
            id=31,
            email="delete-me@example.com",
            name="Delete Me",
            password_hash=hash_password("correct-password"),
            is_admin=False,
            state_code="1221",
            code_verified_at=now,
        )
        db.add(user)
        db.add(QuizSubmission(
            id="delete-session",
            user_id=31,
            answers=[3] * 21,
            norms={"a": 0.5, "p": 0.5, "h": 0.5, "c": 0.5},
            code="1221",
            created_at=now,
        ))
        db.add(ChatMessage(
            id="delete-message",
            user_id=31,
            session_id="delete-session",
            state_code="1221",
            role="user",
            text="torlendo uzenet",
        ))
        db.add(MfaChallenge(
            id="delete-challenge",
            user_id=31,
            code_hash="hash",
            purpose="login",
            expires_at=now + datetime.timedelta(minutes=5),
        ))
        db.add(TrustedDevice(
            user_id=31,
            device_hash="delete-device",
            label="Device",
            expires_at=now + datetime.timedelta(days=1),
        ))
        await db.commit()

        res = await db.execute(select(User).where(User.id == 31))
        db_user = res.scalar_one()
        app.dependency_overrides[get_current_user] = lambda: db_user

    r = client.request(
        "DELETE",
        "/api/auth/delete-account",
        headers={"Authorization": "Bearer fake-token"},
        json={"current_password": "correct-password"},
    )

    assert r.status_code == 200
    assert r.json() == {"ok": True}

    async with TestingSessionLocal() as db:
        assert (await db.execute(select(User).where(User.id == 31))).scalar_one_or_none() is None
        assert (await db.execute(select(ChatMessage).where(ChatMessage.user_id == 31))).scalars().all() == []
        assert (await db.execute(select(QuizSubmission).where(QuizSubmission.user_id == 31))).scalars().all() == []
        assert (await db.execute(select(MfaChallenge).where(MfaChallenge.user_id == 31))).scalars().all() == []
        assert (await db.execute(select(TrustedDevice).where(TrustedDevice.user_id == 31))).scalars().all() == []
        audit = (await db.execute(select(AdminAuditLog).where(AdminAuditLog.action == "user.account.delete"))).scalar_one()
        assert "user_id=31" in audit.detail
        assert "delete-me@example.com" not in audit.detail


@pytest.mark.anyio
async def test_delete_account_requires_current_password():
    client = TestClient(app)

    async with TestingSessionLocal() as db:
        user = User(
            id=32,
            email="keep-me@example.com",
            name="Keep Me",
            password_hash=hash_password("correct-password"),
            is_admin=False,
        )
        db.add(user)
        await db.commit()

        res = await db.execute(select(User).where(User.id == 32))
        db_user = res.scalar_one()
        app.dependency_overrides[get_current_user] = lambda: db_user

    r = client.request(
        "DELETE",
        "/api/auth/delete-account",
        headers={"Authorization": "Bearer fake-token"},
        json={"current_password": "wrong-password"},
    )

    assert r.status_code == 400

    async with TestingSessionLocal() as db:
        assert (await db.execute(select(User).where(User.id == 32))).scalar_one_or_none() is not None
        assert (await db.execute(select(AdminAuditLog).where(AdminAuditLog.action == "user.account.delete"))).scalar_one_or_none() is None


@pytest.mark.anyio
async def test_logout_all_devices_requires_current_password():
    client = TestClient(app)
    now = datetime.datetime.now(timezone.utc)

    async with TestingSessionLocal() as db:
        user = User(
            id=33,
            email="devices@example.com",
            name="Devices User",
            password_hash=hash_password("correct-password"),
            is_admin=False,
            token_version=0,
        )
        db.add(user)
        db.add(TrustedDevice(
            id=3301,
            user_id=33,
            device_hash="device-hash",
            label="Browser",
            expires_at=now + datetime.timedelta(days=1),
        ))
        await db.commit()

        res = await db.execute(select(User).where(User.id == 33))
        db_user = res.scalar_one()
        app.dependency_overrides[get_current_user] = lambda: db_user

    r = client.post(
        "/api/auth/security/logout-all",
        headers={"Authorization": "Bearer fake-token"},
        json={"current_password": "wrong-password"},
    )

    assert r.status_code == 400

    async with TestingSessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == 33))).scalar_one()
        device = (await db.execute(select(TrustedDevice).where(TrustedDevice.id == 3301))).scalar_one()
        assert user.token_version == 0
        assert device.revoked_at is None


@pytest.mark.anyio
async def test_failed_admin_emergency_password_is_audited():
    client = TestClient(app)

    async with TestingSessionLocal() as db:
        admin = User(
            id=34,
            email="admin-audit@example.com",
            name="Admin Audit",
            password_hash=hash_password("correct-password"),
            is_admin=True,
            is_active=True,
        )
        db.add(admin)
        await db.commit()

        res = await db.execute(select(User).where(User.id == 34))
        db_admin = res.scalar_one()
        app.dependency_overrides[require_admin] = lambda: db_admin

    r = client.post(
        "/api/admin/maintenance",
        headers={"Authorization": "Bearer fake-token"},
        json={"maintenance_mode": True, "current_password": "wrong-password"},
    )

    assert r.status_code == 400

    async with TestingSessionLocal() as db:
        audit = (await db.execute(
            select(AdminAuditLog).where(AdminAuditLog.action == "admin.maintenance.toggle.denied")
        )).scalar_one()
        assert audit.admin_user_id == 34
        assert audit.detail == "reason=bad_password"
        assert "wrong-password" not in audit.detail


@pytest.mark.anyio
async def test_admin_user_delete_audit_omits_email():
    client = TestClient(app)

    async with TestingSessionLocal() as db:
        admin = User(
            id=35,
            email="admin-delete@example.com",
            name="Admin Delete",
            password_hash=hash_password("correct-password"),
            is_admin=True,
            is_active=True,
        )
        target = User(
            id=36,
            email="target-delete@example.com",
            name="Target Delete",
            password_hash=hash_password("correct-password"),
            is_admin=False,
            is_active=True,
        )
        db.add_all([admin, target])
        await db.commit()

        db_admin = (await db.execute(select(User).where(User.id == 35))).scalar_one()
        app.dependency_overrides[require_admin] = lambda: db_admin

    r = client.delete("/api/admin/users/36", headers={"Authorization": "Bearer fake-token"})

    assert r.status_code == 200

    async with TestingSessionLocal() as db:
        audit = (await db.execute(
            select(AdminAuditLog).where(AdminAuditLog.action == "admin.user.delete")
        )).scalar_one()
        assert audit.detail == "user_id=36"
        assert "target-delete@example.com" not in audit.detail


@pytest.mark.anyio
async def test_admin_audit_masks_sensitive_detail_before_storage():
    mock_request = type("Req", (), {})()
    mock_request.headers = {
        "user-agent": "curl Authorization: Bearer sk-proj-secret1234567890",
        "x-forwarded-for": "127.0.0.1",
    }
    mock_request.client = type("Client", (), {"host": "127.0.0.1"})()

    async with TestingSessionLocal() as db:
        admin = User(
            id=37,
            email="admin-mask@example.com",
            name="Admin Mask",
            password_hash=hash_password("correct-password"),
            is_admin=True,
            is_active=True,
        )
        db.add(admin)
        await db.flush()

        await _admin_audit(
            db,
            admin,
            mock_request,
            "admin.test.mask",
            "api_key=AIzaSyDrxRwZqITYSLSvOWCQKMep6yIzTUmPV8w token=sk-proj-secret1234567890",
        )
        await db.commit()

        audit = (await db.execute(
            select(AdminAuditLog).where(AdminAuditLog.action == "admin.test.mask")
        )).scalar_one()
        assert "AIzaSyDrxRwZqITYSLSvOWCQKMep6yIzTUmPV8w" not in audit.detail
        assert "sk-proj-secret1234567890" not in audit.detail
        assert "[redacted]" in audit.detail
        assert "sk-proj-secret1234567890" not in audit.user_agent


@pytest.mark.anyio
async def test_cleanup_expired_security_records_keeps_active_records():
    now = datetime.datetime.now(timezone.utc)
    async with TestingSessionLocal() as db:
        user = User(
            id=11,
            email="cleanup@example.com",
            name="Cleanup User",
            password_hash="fakehash",
            is_admin=False,
        )
        db.add(user)
        db.add_all([
            MfaChallenge(
                id="expired",
                user_id=11,
                code_hash="hash",
                purpose="login",
                expires_at=now - datetime.timedelta(minutes=1),
            ),
            MfaChallenge(
                id="consumed",
                user_id=11,
                code_hash="hash",
                purpose="login",
                expires_at=now + datetime.timedelta(minutes=10),
                consumed_at=now,
            ),
            MfaChallenge(
                id="active",
                user_id=11,
                code_hash="hash",
                purpose="login",
                expires_at=now + datetime.timedelta(minutes=10),
            ),
            TrustedDevice(
                user_id=11,
                device_hash="expired-device",
                label="Expired",
                expires_at=now - datetime.timedelta(days=1),
            ),
            TrustedDevice(
                user_id=11,
                device_hash="revoked-device",
                label="Revoked",
                expires_at=now + datetime.timedelta(days=1),
                revoked_at=now,
            ),
            TrustedDevice(
                user_id=11,
                device_hash="active-device",
                label="Active",
                expires_at=now + datetime.timedelta(days=1),
            ),
        ])
        await db.commit()

        await _cleanup_expired_security_records(db, user_id=11)
        await db.commit()

        mfa_ids = set((await db.execute(select(MfaChallenge.id))).scalars().all())
        device_hashes = set((await db.execute(select(TrustedDevice.device_hash))).scalars().all())

    assert mfa_ids == {"active"}
    assert device_hashes == {"active-device"}


@pytest.mark.anyio
async def test_expiration_scenarios():
    client = TestClient(app)

    # 1. Setup test data (User, StateCode, QuizSubmission)
    async def setup_data(verified_days_ago: int, user_id: int, session_id: str):
        async with TestingSessionLocal() as db:
            # Clear old records to avoid integrity errors
            await db.execute(delete(ChatMessage))
            await db.execute(delete(QuizSubmission))
            await db.execute(delete(User))
            await db.execute(delete(StateCode))
            await db.commit()

            # Add state code
            sc = StateCode(
                code="1221",
                a=1, p=2, h=2, c=1,
                title="Átlagos állapot",
                severity="NORMAL",
                profile="Minden rendben van."
            )
            db.add(sc)
            
            # Add user
            now = datetime.datetime.now(timezone.utc)
            verified_at = now - datetime.timedelta(days=verified_days_ago)
            user = User(
                id=user_id,
                email="test@example.com",
                name="Teszt User",
                password_hash="fakehash",
                is_admin=False,
                state_code="1221",
                code_verified_at=verified_at
            )
            db.add(user)
            
            # Add quiz submission (session)
            submission = QuizSubmission(
                id=session_id,
                user_id=user_id,
                answers=[1,2,3,4],
                norms={"a": 0.1, "p": 0.2, "h": 0.2, "c": 0.1},
                code="1221",
                created_at=verified_at
            )
            db.add(submission)
            
            await db.commit()
            
            # Set dependency override to return this specific user
            res = await db.execute(select(User).where(User.id == user_id))
            db_user = res.scalar_one()
            app.dependency_overrides[get_current_user] = lambda: db_user

    # Scenario 1: Pre-expiration (28 days ago) -> Active with 2 days remaining
    await setup_data(verified_days_ago=28, user_id=1, session_id="session-1234")
    
    # Test /api/codes/me
    headers = {"Authorization": "Bearer fake-token"}
    r = client.get("/api/codes/me", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_expired"] is False
    assert data["days_remaining"] == 2
    
    # Test /api/auth/me
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    user_data = r.json()["user"]
    assert user_data["is_code_expired"] is False
    assert user_data["code_days_remaining"] == 2

    # Scenario 2: Post-expiration (31 days ago) -> Expired
    await setup_data(verified_days_ago=31, user_id=2, session_id="session-5678")
    
    # Test /api/codes/me
    r = client.get("/api/codes/me", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["is_expired"] is True
    assert data["days_remaining"] == 0
    
    # Test /api/auth/me
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    user_data = r.json()["user"]
    assert user_data["is_code_expired"] is True
    assert user_data["code_days_remaining"] == 0
    
    # Test /api/chat/send (should return 403 Forbidden with custom detail)
    r = client.post("/api/chat/send", json={"message": "Szia", "session_id": "session-5678"}, headers=headers)
    assert r.status_code == 403
    assert r.json()["detail"] == "Ez a mérési ciklus lezárult. Kérjük, tölts ki egy új kérdőívet."
