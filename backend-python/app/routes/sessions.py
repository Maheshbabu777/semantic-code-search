from fastapi import APIRouter, HTTPException
from app.github import cleanup_repo
from app.indexer import client
import app.state as state

router = APIRouter()

@router.delete("/{session_id}")
def close_session(session_id: str):
    if session_id not in state.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    cleanup_repo(state.sessions[session_id]["session_folder"])
    client.delete_collection(f"code_{session_id}")
    del state.sessions[session_id]

    return { "deleted": session_id }