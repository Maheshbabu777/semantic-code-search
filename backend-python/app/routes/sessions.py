import os
import shutil
from fastapi import APIRouter

from app.db import client, CHROMA_PATH
from app.github import cleanup_repo
from app.session_store import delete_session_record
import app.state as state

router = APIRouter()


def _drop_collection(collection_name: str) -> None:
    try:
        client.delete_collection(name=collection_name)
    except Exception as exc:
        msg = str(exc).lower()
        if "does not exist" in msg or "not found" in msg:
            print(f"[sessions] collection '{collection_name}' already gone — skipping")
        else:
            print(f"[sessions] unexpected error deleting '{collection_name}': {exc}")

    collection_folder = os.path.join(CHROMA_PATH, collection_name)
    if os.path.exists(collection_folder):
        try:
            shutil.rmtree(collection_folder)
            print(f"[sessions] deleted folder: {collection_folder}")
        except Exception as e:
            print(f"[sessions] error deleting folder: {e}")


@router.delete("/{session_id}")
def close_session(session_id: str):
    collection_name = f"code_{session_id}"

    _drop_collection(collection_name)

    session = state.sessions.pop(session_id, None)
    if session:
        folder = session.get("session_folder")
        if folder:
            cleanup_repo(folder)

    delete_session_record(session_id)

    return {"deleted": session_id}
