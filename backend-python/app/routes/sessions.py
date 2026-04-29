import os
import shutil
import sqlite3
from fastapi import APIRouter
from app.db import client, CHROMA_PATH
from app.github import cleanup_repo
from app.session_store import delete_session
import app.state as state

router = APIRouter()

CHROMA_SQLITE = os.path.join(CHROMA_PATH, "chroma.sqlite3")

def _get_vector_segment_folder(collection_name: str) -> str | None:
    if not os.path.exists(CHROMA_SQLITE):
        return None
    try:
        con = sqlite3.connect(CHROMA_SQLITE)
        row = con.execute(
            """
            SELECT s.id
            FROM segments s
            JOIN collections c ON s.collection = c.id
            WHERE c.name = ?
              AND s.scope = 'VECTOR'
            """,
            (collection_name,),
        ).fetchone()
        con.close()
        return row[0] if row else None
    except Exception as exc:
        print(f"[sessions] could not read segment id for '{collection_name}': {exc}")
        return None


def _drop_collection(collection_name: str) -> None:
    segment_folder = _get_vector_segment_folder(collection_name)

    try:
        client.delete_collection(name=collection_name)
    except Exception as exc:
        msg = str(exc).lower()
        if "does not exist" in msg or "not found" in msg:
            print(f"[sessions] collection '{collection_name}' already gone — skipping")
        else:
            print(f"[sessions] unexpected error deleting '{collection_name}': {exc}")

    if segment_folder:
        folder_path = os.path.join(CHROMA_PATH, segment_folder)
        if os.path.exists(folder_path):
            try:
                client._server._system.stop()
                shutil.rmtree(folder_path)
                client._server._system.start()
                print(f"[sessions] removed segment folder: {segment_folder}")
            except Exception as exc:
                print(
                    f"[sessions] could not remove segment folder '{folder_path}': {exc}"
                )
                try:
                    client._server._system.start()
                except Exception:
                    pass


@router.delete("/{session_id}")
def close_session(session_id: str):
    collection_name = f"code_{session_id}"
    _drop_collection(collection_name)

    session = state.sessions.pop(session_id, None)
    if session:
        folder = session.get("session_folder")
        if folder:
            cleanup_repo(folder)

    delete_session(session_id)

    return {"deleted": session_id}
