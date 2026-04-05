import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.github import clone_repo, cleanup_repo
from app.indexer import index_codebase
import app.state as state

router = APIRouter()

class IndexRequest(BaseModel):
    github_url: str

@router.post("/")
def index(req: IndexRequest):
    try:
        session_id = str(uuid.uuid4())

        tmp_dir = clone_repo(req.github_url)

        result = index_codebase(tmp_dir, session_id)
        state.sessions[session_id] = {
            "collection_id": session_id,
            "session_folder": tmp_dir,
            "github_url": req.github_url
        }

        return {
            **result,
            "session_id":session_id,
            "github_url": req.github_url
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    
