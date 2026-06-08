import argparse
import asyncio
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


def parse_dt(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
    except ValueError:
        try:
            dt = datetime.strptime(text, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def parse_json(value):
    if isinstance(value, (list, dict)):
        return value
    if value in (None, ""):
        return None
    return json.loads(value)


def bool_value(value):
    return bool(int(value or 0))


def rows(conn, table):
    conn.row_factory = sqlite3.Row
    return [dict(row) for row in conn.execute(f"SELECT * FROM {table}")]


def prepare_server_import(target_url):
    os.environ.setdefault("JWT_SECRET", "local-migration-only-secret-32chars")
    os.environ["DATABASE_URL"] = target_url
    backend_dir = Path(__file__).resolve().parents[1]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    import server
    return server


async def migrate(source_sqlite, target_url, wipe_target=False):
    server = prepare_server_import(target_url)
    source = sqlite3.connect(source_sqlite)
    source.row_factory = sqlite3.Row

    async with server.engine.begin() as conn:
        await conn.run_sync(server.Base.metadata.create_all)
    await server._run_startup_migrations()

    async with server.SessionLocal() as db:
        if wipe_target:
            for model in [
                server.ChatMessage,
                server.QuizSubmission,
                server.KnowledgeChunk,
                server.AppSetting,
                server.StateCode,
                server.User,
            ]:
                await db.execute(server.delete(model))
            await db.commit()

        for row in rows(source, "users"):
            await db.merge(server.User(
                id=row["id"],
                email=row["email"],
                name=row["name"],
                password_hash=row["password_hash"],
                is_admin=bool_value(row["is_admin"]),
                is_active=bool_value(row["is_active"]),
                is_suspended=bool_value(row.get("is_suspended")),
                state_code=row.get("state_code"),
                code_verified_at=parse_dt(row.get("code_verified_at")),
                created_at=parse_dt(row.get("created_at")),
                reset_token=row.get("reset_token"),
                token_expires_at=parse_dt(row.get("token_expires_at")),
            ))

        for row in rows(source, "state_codes"):
            await db.merge(server.StateCode(
                code=row["code"],
                a=row["a"],
                p=row["p"],
                h=row["h"],
                c=row["c"],
                title=row["title"],
                severity=row.get("severity") or "",
                profile=row["profile"],
                created_at=parse_dt(row.get("created_at")),
                updated_at=parse_dt(row.get("updated_at")),
            ))

        for row in rows(source, "quiz_submissions"):
            await db.merge(server.QuizSubmission(
                id=row["id"],
                user_id=row["user_id"],
                answers=parse_json(row["answers"]),
                norms=parse_json(row["norms"]),
                code=row["code"],
                created_at=parse_dt(row.get("created_at")),
            ))

        for row in rows(source, "chat_messages"):
            await db.merge(server.ChatMessage(
                id=row["id"],
                user_id=row["user_id"],
                session_id=row.get("session_id"),
                state_code=row.get("state_code"),
                role=row["role"],
                text=row["text"],
                created_at=parse_dt(row.get("created_at")),
            ))

        for row in rows(source, "app_settings"):
            await db.merge(server.AppSetting(
                key=row["key"],
                value=row.get("value"),
                updated_at=parse_dt(row.get("updated_at")),
            ))

        for row in rows(source, "knowledge_chunks"):
            await db.merge(server.KnowledgeChunk(
                id=row["id"],
                source_name=row["source_name"],
                source_path=row["source_path"],
                source_hash=row["source_hash"],
                chunk_index=row["chunk_index"],
                title=row["title"],
                content=row["content"],
                created_at=parse_dt(row.get("created_at")),
            ))

        await db.commit()

    source.close()

    if server.DB_DIALECT == "postgresql":
        async with server.engine.begin() as conn:
            await server._reset_postgres_sequences(conn)

    async with server.SessionLocal() as db:
        counts = {}
        for name, model in [
            ("users", server.User),
            ("state_codes", server.StateCode),
            ("quiz_submissions", server.QuizSubmission),
            ("chat_messages", server.ChatMessage),
            ("app_settings", server.AppSetting),
            ("knowledge_chunks", server.KnowledgeChunk),
        ]:
            result = await db.execute(server.select(server.func.count()).select_from(model))
            counts[name] = result.scalar_one()
    await server.engine.dispose()
    return counts


def main():
    parser = argparse.ArgumentParser(description="Copy Myra SQLite data into a Postgres/Supabase database.")
    parser.add_argument("--source", default=str(Path(__file__).resolve().parents[1] / "data" / "myra.db"))
    parser.add_argument("--target-url", default=os.environ.get("SUPABASE_DATABASE_URL") or os.environ.get("DATABASE_URL"))
    parser.add_argument("--wipe-target", action="store_true", help="Delete target Myra tables before import.")
    args = parser.parse_args()

    if not args.target_url:
        raise SystemExit("Missing --target-url or SUPABASE_DATABASE_URL.")
    if not Path(args.source).exists():
        raise SystemExit(f"SQLite source not found: {args.source}")

    counts = asyncio.run(migrate(args.source, args.target_url, wipe_target=args.wipe_target))
    print(json.dumps({"ok": True, "counts": counts}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
