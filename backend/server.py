"""Myra-project backend — SQLite + custom JWT, no external dependencies except the
configurable LLM provider (OpenAI / Anthropic / Google Gemini) chosen by the admin."""
import asyncio
import json
import os
import re
import time
import uuid
import logging
import smtplib
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, List, Literal, Optional
from email.mime.text import MIMEText

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Request, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Text, JSON, func, select, delete,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Config ----------
JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALG = os.environ.get("JWT_ALG", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:////app/backend/data/myra.db")
ADMIN_EMAIL_ALLOWLIST = {
    e.strip().lower() for e in os.environ.get("ADMIN_EMAIL_ALLOWLIST", "").split(",") if e.strip()
}

# Gmail SMTP Config
GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")

if not JWT_SECRET or len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET must be set in .env and be at least 32 chars long")

# Ensure data dir
DB_FILE_DIR = ROOT_DIR / "data"
DB_FILE_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("myra")

# ---------- DB ----------
engine = create_async_engine(DATABASE_URL, future=True, echo=False)
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    password_hash = Column(String(200), nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    state_code = Column(String(4), nullable=True)
    code_verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Új oszlopok a 6 jegyű biztonsági kódhoz
    reset_token = Column(String(10), nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)


class StateCode(Base):
    __tablename__ = "state_codes"
    code = Column(String(4), primary_key=True)
    a = Column(Integer, nullable=False)
    p = Column(Integer, nullable=False)
    h = Column(Integer, nullable=False)
    c = Column(Integer, nullable=False)
    title = Column(String(300), nullable=False)
    severity = Column(String(50), nullable=False, default="")
    profile = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String(40), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    state_code = Column(String(4), nullable=True, index=True)
    role = Column(String(20), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class QuizSubmission(Base):
    __tablename__ = "quiz_submissions"
    id = Column(String(40), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    answers = Column(JSON, nullable=False)
    norms = Column(JSON, nullable=False)
    code = Column(String(4), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AppSetting(Base):
    """Key-value bag for admin-managed configuration (LLM provider/model/api_key/system_prompt/kb_text)."""
    __tablename__ = "app_settings"
    key = Column(String(60), primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


# ---------- Security ----------
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(p: str) -> str:
    return pwd_ctx.hash(p)


def verify_password(p: str, h: str) -> bool:
    try:
        return pwd_ctx.verify(p, h)
    except Exception:
        return False


def create_access_token(user: User) -> str:
    now = _now()
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "is_admin": user.is_admin,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


# In-memory throttle (per-process)
_attempts: dict[tuple[str, str], dict] = {}
THROTTLE_WINDOW_S = 60
THROTTLE_MAX = 8
THROTTLE_BLOCK_S = 300


def _throttle_key(request: Request, email: str) -> tuple[str, str]:
    ip = request.client.host if request.client else "?"
    return (ip, (email or "").lower())


def _check_throttle(request: Request, email: str) -> None:
    key = _throttle_key(request, email)
    s = _attempts.get(key)
    now = time.monotonic()
    if s and now < s.get("blocked_until", 0):
        raise HTTPException(status_code=429, detail="Túl sok sikertelen próbálkozás. Próbáld újra később.")
    if s and now - s.get("first", now) > THROTTLE_WINDOW_S:
        _attempts.pop(key, None)


def _register_failure(request: Request, email: str) -> None:
    key = _throttle_key(request, email)
    now = time.monotonic()
    s = _attempts.get(key) or {"failed": 0, "first": now, "blocked_until": 0}
    if now - s.get("first", now) > THROTTLE_WINDOW_S:
        s = {"failed": 1, "first": now, "blocked_until": 0}
    else:
        s["failed"] = s.get("failed", 0) + 1
    if s["failed"] >= THROTTLE_MAX:
        s["blocked_until"] = now + THROTTLE_BLOCK_S
    _attempts[key] = s


# ---------- DB session ----------
async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Hiányzó token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Érvénytelen vagy lejárt token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Hibás token típus")
    try:
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Hibás token tartalom")
    res = await db.execute(select(User).where(User.id == uid))
    user = res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Felhasználó nem található")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Csak adminok férnek hozzá")
    return user


# ---------- App settings helpers ----------
DEFAULT_SYSTEM_PROMPT = """A neved Myra. A Myra-project mentálhigiénés rendszer chatbotja vagy.
Empatikus, hétköznapi nyelven beszélgető önismereti kísérő. Ne adj orvosi tanácsot,
kerüld a szakzsargont, soha ne hivatkozz a felhasználó kódjára vagy a belső modellre."""


async def get_setting(db: AsyncSession, key: str, default: str = "") -> str:
    res = await db.execute(select(AppSetting).where(AppSetting.key == key))
    s = res.scalar_one_or_none()
    return s.value if (s and s.value is not None) else default


async def set_setting(db: AsyncSession, key: str, value: str) -> None:
    res = await db.execute(select(AppSetting).where(AppSetting.key == key))
    s = res.scalar_one_or_none()
    if s:
        s.value = value
        s.updated_at = _now()
    else:
        db.add(AppSetting(key=key, value=value))


# ---------- App ----------
app = FastAPI(title="Myra API")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Initialise default settings if missing
    async with SessionLocal() as db:
        for k, v in [
            ("llm_provider", "gemini"),
            ("llm_model", "gemini-2.5-flash"),
            ("llm_api_key", ""),
            ("system_prompt", DEFAULT_SYSTEM_PROMPT),
            ("kb_text", ""),
        ]:
            res = await db.execute(select(AppSetting).where(AppSetting.key == k))
            if res.scalar_one_or_none() is None:
                db.add(AppSetting(key=k, value=v))
        await db.commit()


@app.on_event("shutdown")
async def on_shutdown():
    await engine.dispose()


# ---------- Schemas ----------
class RegisterBody(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    is_admin: bool
    state_code: Optional[str] = None


class CodeVerifyBody(BaseModel):
    code: str


class QuizSubmitBody(BaseModel):
    answers: List[int]


class ChatSendBody(BaseModel):
    message: str


class StateCodeIn(BaseModel):
    code: str
    title: str
    profile: str
    severity: str = ""
    a: Optional[int] = None
    p: Optional[int] = None
    h: Optional[int] = None
    c: Optional[int] = None


class SettingsIn(BaseModel):
    llm_provider: Optional[Literal["openai", "anthropic", "gemini", "groq"]] = None
    llm_model: Optional[str] = None
    llm_api_key: Optional[str] = None
    system_prompt: Optional[str] = None
    kb_text: Optional[str] = None


# ---------- Email Helper ----------
def _send_gmail_reset(to_email: str, token: str):
    msg = MIMEText(f"""Kedves Felhasználó!

A Myra-project alkalmazásban jelszó-visszaállítást kértél.

A visszaállításhoz szükséges 6 jegyű biztonsági kódod: {token}

Ez a kód 1 óráig érvényes. Írd be a kódot az alkalmazás felületén az új jelszavad megadásához.

A Myra-project bejelentkezési oldala: https://myra-project.cfd/login

Ha nem te kérted a visszaállítást, kérjük, hagyd figyelmen kívül ezt a levelet!

Üdvözlettel,
Myra-project csapat""", "plain", "utf-8")
    
    msg["Subject"] = "Jelszó visszaállítás - Myra-project"
    msg["From"] = "antalodor@gmail.com"
    msg["To"] = to_email

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login("antalodor@gmail.com", "yfuaardbujyydzkb")
            server.sendmail("antalodor@gmail.com", [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"[!] Gmail küldési hiba: {e}")
        return False


# ---------- Auth ----------
@api.post("/auth/register")
async def auth_register(body: RegisterBody, request: Request, db: AsyncSession = Depends(get_db)):
    _check_throttle(request, body.email)
    email = body.email.lower()
    res = await db.execute(select(User).where(User.email == email))
    if res.scalar_one_or_none():
        _register_failure(request, email)
        raise HTTPException(status_code=400, detail="Ez az email már regisztrálva van.")
    # Admin assignment: first user OR in allowlist
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    is_admin = (email in ADMIN_EMAIL_ALLOWLIST) or (total == 0)
    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password), is_admin=is_admin)
    db.add(user)
    await db.flush()
    token = create_access_token(user)
    return {"access_token": token, "user": _user_out(user)}


@api.post("/auth/login")
async def auth_login(body: LoginBody, request: Request, db: AsyncSession = Depends(get_db)):
    _check_throttle(request, body.email)
    email = body.email.lower()
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        _register_failure(request, email)
        await asyncio.sleep(0.3)
        raise HTTPException(status_code=401, detail="Hibás email vagy jelszó.")
    token = create_access_token(user)
    return {"access_token": token, "user": _user_out(user)}


@api.post("/auth/forgot-password")
async def auth_forgot_password(body: ForgotPasswordBody, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    email = body.email.lower().strip()
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()

    if user and user.is_active:
        token = "".join([str(random.randint(0, 9)) for _ in range(6)])
        user.reset_token = token
        user.token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.flush()
        background_tasks.add_task(_send_gmail_reset, user.email, token)

    return {"ok": True, "detail": "Ha a cím létezik, elküldtük a biztonsági kódot."}


@api.post("/auth/reset-password")
async def auth_reset_password(body: ResetPasswordBody, db: AsyncSession = Depends(get_db)):
    token_str = body.token.strip()
    
    res = await db.execute(select(User).where(User.reset_token == token_str))
    user = res.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="Hibás vagy lejárt biztonsági kód.")
        
    if user.token_expires_at:
        expires_at = user.token_expires_at.replace(tzinfo=timezone.utc) if user.token_expires_at.tzinfo is None else user.token_expires_at
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="A biztonsági kód ideje lejárt.")
        
    user.password_hash = hash_password(body.new_password)
    user.reset_token = None
    user.token_expires_at = None
    await db.flush()
    
    return {"ok": True, "detail": "Jelszó sikeresen megváltoztatva."}


@api.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    return {"user": _user_out(user)}


@api.post("/auth/logout")
async def auth_logout(user: User = Depends(get_current_user)):
    return {"ok": True}


def _user_out(u: User) -> dict:
    return {
        "id": u.id, "email": u.email, "name": u.name,
        "is_admin": u.is_admin, "state_code": u.state_code,
    }


# ---------- Codes ----------
def _clean_code(s: str) -> str:
    return "".join(ch for ch in (s or "") if ch.isdigit())


@api.post("/codes/verify")
async def codes_verify(body: CodeVerifyBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    code = _clean_code(body.code)
    if len(code) != 4:
        raise HTTPException(status_code=400, detail="A kódnak 4 számjegyűnek kell lennie.")
    if any(d not in "1234" for d in code):
        raise HTTPException(status_code=400, detail="Érvénytelen kód: minden számjegynek 1 és 4 között kell lennie.")
    res = await db.execute(select(StateCode).where(StateCode.code == code))
    sc = res.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=404, detail="Ezt a kódot nem találom. Ellenőrizd a kérdőív végén kapott számot.")
    user.state_code = code
    user.code_verified_at = _now()
    return {"ok": True, "state_code": _sc_out(sc)}


@api.get("/codes/me")
async def codes_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.state_code:
        return {"state_code": None, "profile": None}
    res = await db.execute(select(StateCode).where(StateCode.code == user.state_code))
    sc = res.scalar_one_or_none()
    return {"state_code": user.state_code, "profile": _sc_out(sc) if sc else None}


@api.post("/codes/reset")
async def codes_reset(user: User = Depends(get_current_user)):
    user.state_code = None
    user.code_verified_at = None
    return {"ok": True}


def _sc_out(sc: StateCode) -> dict:
    return {
        "code": sc.code, "a": sc.a, "p": sc.p, "h": sc.h, "c": sc.c,
        "title": sc.title, "severity": sc.severity, "profile": sc.profile,
    }


# ---------- Quiz ----------
QUIZ_QUESTIONS = {
    "A": [
        "Idegesnek érzem magam", "Aggódom valami miatt", "Úgy érzem, nem tudok megnyugodni",
        "Ingerlékeny vagyok", "Képtelen vagyok ellazulni", "Nyugtalan vagyok, nem tudok koncentrálni",
    ],
    "P": [
        "Gyakran cselekszem impulzívan, amikor erős érzelmeim vannak",
        "Nehezemre esik megnyugodni, amikor felzaklat valami",
        "Ha stresszes vagyok, nehezen gondolkodom világosan",
        "Néha nem tudom, mit érzek",
        "Képtelen vagyok úgy irányítani az érzelmeimet, ahogyan szeretném",
        "Ha rosszul érzem magam, gyakran túlságosan lekötnek ezek az érzések",
    ],
    "H": [
        "Úgy érzem, hogy nem tudok megbirkózni a fontos dolgaimmal",
        "Úgy érzem, túl sok stressz ér egyszerre",
        "Úgy érzem, elvesztem az irányítást az életem felett",
        "Úgy érzem, hogy túlfeszülök, and nem tudok leállni",
    ],
    "C": ["Fáradtság, kimerültség", "Fejfájás", "Szívdobogásérzés", "Alvászavar",
          "Hasi diszkomfort, fájdalom vagy puffadás"],
}
QUIZ_SECTIONS = [
    {"id": "A", "title": "Aktuális érzelmi állapot",
     "intro": "Az alábbi kijelentések a most érzett állapotodról szólnak.",
     "scale": [(1, "Egyáltalán nem"), (2, "Kicsit"), (3, "Mérsékelten"), (4, "Eléggé"), (5, "Nagyon")]},
    {"id": "P", "title": "Érzelemszabályozás",
     "intro": "Az alábbi kijelentések arról szólnak, hogyan kezeled általában az érzelmeidet.",
     "scale": [(1, "Egyáltalán nem jellemző"), (2, "Ritkán jellemző"), (3, "Néha jellemző"),
               (4, "Gyakran jellemző"), (5, "Szinte mindig jellemző")]},
    {"id": "H", "title": "Stresszérzékelés",
     "intro": "Az alábbi kijelentések az általános stressz-szintedről szólnak az elmúlt időszakban.",
     "scale": [(1, "Egyáltalán nem jellemző"), (2, "Ritkán jellemző"), (3, "Néha jellemző"),
               (4, "Gyakran jellemző"), (5, "Szinte mindig jellemző")]},
    {"id": "C", "title": "Testi tünetek",
     "intro": "Az elmúlt időszakban mennyire zavartak az alábbi testi tünetek?",
     "scale": [(0, "Egyáltalán nem zavart"), (1, "Kicsit zavart"), (2, "Nagyon zavart")]},
]


def _bucket(norm: float) -> int:
    if norm <= 0.3: return 1
    if norm <= 0.6: return 2
    if norm <= 0.8: return 3
    return 4


@api.get("/quiz/questions")
async def quiz_questions(_: User = Depends(get_current_user)):
    return {"sections": [
        {"id": s["id"], "title": s["title"], "intro": s["intro"],
         "scale": [{"value": v, "label": l} for v, l in s["scale"]],
         "questions": QUIZ_QUESTIONS[s["id"]]}
        for s in QUIZ_SECTIONS
    ]}


@api.post("/quiz/submit")
async def quiz_submit(body: QuizSubmitBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    a = body.answers
    if len(a) != 21:
        raise HTTPException(status_code=400, detail="21 választ kell megadnod.")
    for v in a[0:16]:
        if not isinstance(v, int) or v < 1 or v > 5:
            raise HTTPException(status_code=400, detail="Az 1-16. kérdésekre 1 és 5 közötti érték kell.")
    for v in a[16:21]:
        if not isinstance(v, int) or v < 0 or v > 2:
            raise HTTPException(status_code=400, detail="A 17-21. kérdésekre 0 és 2 közötti érték kell.")
    a_n = sum(a[0:6]) / 30.0
    p_n = 1.0 - sum(a[6:12]) / 30.0
    h_n = sum(a[12:16]) / 20.0
    c_n = sum(a[16:21]) / 10.0
    code = f"{_bucket(a_n)}{_bucket(p_n)}{_bucket(h_n)}{_bucket(c_n)}"
    res = await db.execute(select(StateCode).where(StateCode.code == code))
    sc = res.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=500, detail=f"A kód ({code}) nincs az adatbázisban.")
    user.state_code = code
    user.code_verified_at = _now()
    db.add(QuizSubmission(
        id=str(uuid.uuid4()), user_id=user.id, answers=a,
        norms={"a": a_n, "p": p_n, "h": h_n, "c": c_n}, code=code,
    ))
    return {"ok": True, "code": code, "state_code": _sc_out(sc), "norms": {"a": a_n, "p": p_n, "h": h_n, "c": c_n}}


# ---------- Chat (pluggable LLM provider) ----------
def _build_system_prompt(system_prompt: str, kb_text: str, sc: StateCode) -> str:
    a_map = {1: "alacsony szorongás", 2: "enyhe szorongás", 3: "emelkedett szorongás", 4: "magas szorongás"}
    p_map = {1: "gyenge érzelemszabályozás", 2: "ingadozó érzelemszabályozás",
             3: "stabil érzelemszabályozás", 4: "erős érzelemszabályozás"}
    h_map = {1: "alacsony stressz", 2: "enyhe stressz", 3: "emelkedett stressz", 4: "magas stressz"}
    c_map = {1: "kevés testi tünet", 2: "enyhe testi tünetek",
             3: "fokozott testi tünetek", 4: "kifejezett testi tünetek"}
    state_block = (
        "BELSŐ KONTEXTUS – soha ne idézd a felhasználónak.\n"
        f"- Kód: {sc.code}\n"
        f"- A (érzelmi állapot): {sc.a} ({a_map.get(sc.a, '-')})\n"
        f"- P (érzelemszabályozás, fordított): {sc.p} ({p_map.get(sc.p, '-')})\n"
        f"- H (stresszérzékelés): {sc.h} ({h_map.get(sc.h, '-')})\n"
        f"- C (testi tünetek): {sc.c} ({c_map.get(sc.c, '-')})\n"
        f"- Diagnózis: {sc.title} ({sc.severity})\n"
    )
    parts = [system_prompt, "", state_block]
    if kb_text.strip():
        parts += ["", "TUDÁSANYAG (csak felismeréshez, soha ne idézd):", kb_text]
    return "\n".join(parts)


async def _call_llm(provider: str, model: str, api_key: str, system_prompt: str, history: List[dict], user_message: str) -> str:
    if not api_key:
        raise HTTPException(status_code=400, detail="Nincs API kulcs beállítva. Az admin a Beállítások menüben megadhatja.")
    import httpx

    if provider in ("openai", "groq"):
        base_url = (
            "https://api.openai.com/v1/chat/completions"
            if provider == "openai"
            else "https://api.groq.com/openai/v1/chat/completions"
        )
        msgs = [{"role": "system", "content": system_prompt}]
        for m in history:
            msgs.append({"role": m["role"], "content": m["text"]})
        msgs.append({"role": "user", "content": user_message})
        r = await httpx.AsyncClient(timeout=90).post(
            base_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": msgs},
        )
        if r.status_code != 200:
            label = "Groq" if provider == "groq" else "OpenAI"
            raise HTTPException(status_code=502, detail=f"{label} hiba: {r.text[:300]}")
        return r.json()["choices"][0]["message"]["content"]

    if provider == "anthropic":
        msgs = []
        for m in history:
            msgs.append({"role": m["role"], "content": m["text"]})
        msgs.append({"role": "user", "content": user_message})
        r = await httpx.AsyncClient(timeout=90).post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            json={"model": model, "max_tokens": 1024, "system": system_prompt, "messages": msgs},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Anthropic hiba: {r.text[:300]}")
        data = r.json()
        return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")

    if provider == "gemini":
        contents = []
        for m in history:
            role = "user" if m["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m["text"]}]})
        contents.append({"role": "user", "parts": [{"text": user_message}]})
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        r = await httpx.AsyncClient(timeout=90).post(
            url,
            json={"systemInstruction": {"parts": [{"text": system_prompt}]}, "contents": contents},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Gemini hiba: {r.text[:300]}")
        data = r.json()
        cands = data.get("candidates", [])
        if not cands:
            raise HTTPException(status_code=502, detail="Üres válasz a Gemini-től.")
        return "".join(p.get("text", "") for p in cands[0].get("content", {}).get("parts", []))

    raise HTTPException(status_code=400, detail=f"Ismeretlen LLM provider: {provider}")


@api.get("/chat/history")
async def chat_history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(ChatMessage).where(ChatMessage.user_id == user.id).order_by(ChatMessage.created_at)
    )
    msgs = res.scalars().all()
    return {"messages": [
        {"id": m.id, "role": m.role, "text": m.text,
         "created_at": m.created_at.isoformat(), "state_code": m.state_code}
        for m in msgs
    ]}


@api.post("/chat/send")
async def chat_send(body: ChatSendBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.state_code:
        raise HTTPException(status_code=400, detail="Először töltsd ki a kérdőívet.")
    res = await db.execute(select(StateCode).where(StateCode.code == user.state_code))
    sc = res.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=400, detail="A kódhoz nincs profil.")
    text = (body.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Üres üzenet.")

    provider = await get_setting(db, "llm_provider", "gemini")
    model = await get_setting(db, "llm_model", "gemini-2.5-flash")
    api_key = await get_setting(db, "llm_api_key", "")
    sys_prompt_base = await get_setting(db, "system_prompt", DEFAULT_SYSTEM_PROMPT)
    kb_text = await get_setting(db, "kb_text", "")
    sys_prompt = _build_system_prompt(sys_prompt_base, kb_text, sc)

    res = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.state_code == user.state_code)
        .order_by(ChatMessage.created_at)
    )
    history = [{"role": m.role, "text": m.text} for m in res.scalars().all()][-20:]

    user_msg = ChatMessage(id=str(uuid.uuid4()), user_id=user.id, state_code=user.state_code,
                           role="user", text=text)
    db.add(user_msg)
    await db.flush()

    try:
        reply = await _call_llm(provider, model, api_key, sys_prompt, history, text)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"AI hiba: {e}")

    ai_msg = ChatMessage(id=str(uuid.uuid4()), user_id=user.id, state_code=user.state_code,
                         role="assistant", text=str(reply))
    db.add(ai_msg)
    await db.flush()

    def _out(m: ChatMessage) -> dict:
        return {"id": m.id, "role": m.role, "text": m.text,
                "created_at": m.created_at.isoformat() if m.created_at else _now().isoformat(),
                "state_code": m.state_code}

    return {"user_message": _out(user_msg), "assistant_message": _out(ai_msg)}


# ---------- Admin: state codes ----------
@api.get("/admin/codes")
async def admin_list_codes(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(StateCode).order_by(StateCode.code))
    items = [_sc_out(sc) for sc in res.scalars().all()]
    return {"items": items}


@api.post("/admin/codes")
async def admin_upsert_code(body: StateCodeIn, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    code = _clean_code(body.code)
    if not re.fullmatch(r"[1-4]{4}", code):
        raise HTTPException(status_code=400, detail="A kód 4 db 1-4 közötti számjegyből álljon.")
    res = await db.execute(select(StateCode).where(StateCode.code == code))
    sc = res.scalar_one_or_none()
    if sc is None:
        sc = StateCode(code=code)
        db.add(sc)
    sc.a = body.a if body.a is not None else int(code[0])
    sc.p = body.p if body.p is not None else int(code[1])
    sc.h = body.h if body.h is not None else int(code[2])
    sc.c = body.c if body.c is not None else int(code[3])
    sc.title = body.title
    sc.profile = body.profile
    sc.severity = body.severity or ""
    sc.updated_at = _now()
    await db.flush()
    return {"item": _sc_out(sc)}


@api.delete("/admin/codes/{code}")
async def admin_delete_code(code: str, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    code = _clean_code(code)
    r = await db.execute(delete(StateCode).where(StateCode.code == code))
    return {"deleted": r.rowcount or 0}


# ---------- Admin: app settings ----------
SUGGESTED_MODELS = {
    "openai": ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    "anthropic": ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"],
    "gemini": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    "groq": [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "deepseek-r1-distill-llama-70b",
    ],
}


@api.get("/admin/settings")
async def admin_get_settings(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    provider = await get_setting(db, "llm_provider", "gemini")
    model = await get_setting(db, "llm_model", "gemini-2.5-flash")
    api_key = await get_setting(db, "llm_api_key", "")
    system_prompt = await get_setting(db, "system_prompt", DEFAULT_SYSTEM_PROMPT)
    kb_text = await get_setting(db, "kb_text", "")
    masked = (api_key[:4] + "…" + api_key[-4:]) if len(api_key) >= 10 else ("•" * len(api_key))
    return {
        "llm_provider": provider, "llm_model": model,
        "llm_api_key_set": bool(api_key), "llm_api_key_preview": masked if api_key else "",
        "system_prompt": system_prompt, "kb_text": kb_text,
        "suggested_models": SUGGESTED_MODELS,
    }


@api.put("/admin/settings")
async def admin_update_settings(body: SettingsIn, _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if body.llm_provider is not None:
        await set_setting(db, "llm_provider", body.llm_provider)
    if body.llm_model is not None:
        await set_setting(db, "llm_model", body.llm_model.strip())
    if body.llm_api_key is not None:
        await set_setting(db, "llm_api_key", body.llm_api_key.strip())
    if body.system_prompt is not None:
        await set_setting(db, "system_prompt", body.system_prompt)
    if body.kb_text is not None:
        await set_setting(db, "kb_text", body.kb_text)
    return {"ok": True}


@api.post("/admin/kb/upload")
async def admin_upload_kb(file: UploadFile = File(...), _: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    raw = await file.read()
    name = (file.filename or "feltöltés").strip()
    text = ""
    if name.lower().endswith(".pdf"):
        try:
            from pypdf import PdfReader
            import io
            r = PdfReader(io.BytesIO(raw))
            text = "\n".join((p.extract_text() or "") for p in r.pages).strip()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF olvasási hiba: {e}")
    else:
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Csak .pdf vagy UTF-8 .txt fájlt fogadok el.")
    if not text.strip():
        raise HTTPException(status_code=400, detail="A fájlból nem tudtam szöveget kinyerni.")
    current = await get_setting(db, "kb_text", "")
    joined = (current + f"\n\n===== {name} =====\n\n" + text).strip()
    await set_setting(db, "kb_text", joined)
    return {"ok": True, "added_chars": len(text), "total_chars": len(joined)}


# ---------- Config (public) ----------
@api.get("/config")
async def public_config():
    return {"app_name": "Myra-project"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)