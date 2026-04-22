import os
import shutil
import sqlite3
import time

import chromadb
from fastapi import APIRouter

from app.github import cleanup_repo
import app.state as state

router = APIRouter()
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")


def _sqlite_path() -> str:
    return os.path.join(CHROMA_PATH, "chroma.sqlite3")


def _safe_rmtree(path: str, retries: int = 5, delay: float = 0.2) -> None:
    for i in range(retries):
        try:
            shutil.rmtree(path)
            return
        except Exception:
            if i == retries - 1:
                return
            time.sleep(delay)


def _get_referenced_segment_ids() -> set[str]:
    sqlite_path = _sqlite_path()
    if not os.path.exists(sqlite_path):
        return set()

    try:
        with sqlite3.connect(sqlite_path) as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM segments")
            return {row[0] for row in cur.fetchall()}
    except sqlite3.OperationalError:
        return set()


def _get_collection_segment_ids(collection_name: str) -> set[str]:
    sqlite_path = _sqlite_path()
    if not os.path.exists(sqlite_path):
        return set()

    try:
        with sqlite3.connect(sqlite_path) as conn:
            cur = conn.cursor()
            cur.execute("PRAGMA table_info(segments)")
            cols = {row[1] for row in cur.fetchall()}
            link_col = (
                "collection"
                if "collection" in cols
                else "collection_id" if "collection_id" in cols else None
            )
            if not link_col:
                return set()

            cur.execute(
                f"""
                SELECT s.id
                FROM segments s
                JOIN collections c ON s.{link_col} = c.id
                WHERE c.name = ?
                """,
                (collection_name,),
            )
            return {row[0] for row in cur.fetchall()}
    except sqlite3.OperationalError:
        return set()


def _delete_collection_and_segments(session_id: str) -> None:
    collection_name = f"code_{session_id}"
    client = chromadb.PersistentClient(path=CHROMA_PATH)

    segment_ids_for_collection = _get_collection_segment_ids(collection_name)

    try:
        client.delete_collection(name=collection_name)
    except Exception as e:
        print(f"[session] delete_collection failed for {collection_name}: {e}")

    for seg_id in segment_ids_for_collection:
        seg_path = os.path.join(CHROMA_PATH, seg_id)
        if os.path.isdir(seg_path):
            _safe_rmtree(seg_path)

    if not os.path.isdir(CHROMA_PATH):
        return

    referenced = _get_referenced_segment_ids()
    for entry in os.scandir(CHROMA_PATH):
        if entry.is_dir() and entry.name not in referenced:
            _safe_rmtree(entry.path)


@router.delete("/{session_id}")
def close_session(session_id: str):
    _delete_collection_and_segments(session_id)

    session = state.sessions.pop(session_id, None)
    if session:
        cleanup_repo(session["session_folder"])

    return {"deleted": session_id}
