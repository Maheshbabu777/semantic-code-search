from fastapi import APIRouter, HTTPException
from app.github import cleanup_repo
from app.db import client
import app.state as state

router = APIRouter()

@router.delete("/{session_id}")
def close_session(session_id: str):
    if session_id not in state.sessions:
        return { "deleted": session_id, "note": "already removed"}
    
    cleanup_repo(state.sessions[session_id]["session_folder"])
    try:
        client.delete_collection(f"code_{session_id}")
    except Exception:
        pass
    
    del state.sessions[session_id]

    return { "deleted": session_id }