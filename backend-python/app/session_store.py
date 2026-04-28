import os
import sqlite3
import time
from contextlib import contextmanager

DB_PATH = os.getenv("DB_PATH", "./sessions.db")

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    collection_name TEXT NOT NULL,
    session_folder TEXT,
    source TEXT,
    github_url TEXT,
    created_at REAL NOT NULL
)
"""

@contextmanager
def _conn():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()

def init_db() -> None:
    with _conn() as con:
        con.execute(_CREATE_TABLE)

def save_session(session_id: str, data: dict) -> None:
    with _conn() as con:
        con.execute(
            """
            INSERT OR REPLACE INTO sessions (session_id, collection_name, session_folder, source, github_url, created_at) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                data.get("collection_id", f"code_{session_id}"),
                data.get("session_folder"),
                data.get("source"),
                data.get("github_url"),
                data.get("created_at", time.time())
            ),
        )

def delete_session(session_id: str) -> None:
    with _conn() as con:
        con.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))

def load_all_sessions() -> dict:
    with _conn() as con:
        rows = con.execute("SELECT * FROM sessions").fetchall()
    
    sessions = {}
    for row in rows:
        sessions[row["session_id"]] = {
            "collection_id": row["collection_name"],
            "session_folder": row["session_folder"],
            "source": row["source"],
            "github_url": row["github_url"],
            "created_at": row["created_at"]
        }
    
    return sessions