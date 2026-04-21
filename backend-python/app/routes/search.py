from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.searcher import search_code

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    session_id: str
    top_k: int = 10

@router.post("/")
def search(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    try:
        results = search_code(req.query, req.session_id, req.top_k)
        return { "query": req.query, "results": results }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))