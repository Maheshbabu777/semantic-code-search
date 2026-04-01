from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.embeddings import get_embedding, get_embeddings_batch

router = APIRouter()

class SingleRequest(BaseModel):
    text: str

class BatchRequest(BaseModel):
    texts: list[str]

@router.post("/single")
def embed_single(req: SingleRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail='Input text cannot be empty')
    embedding = get_embedding(req.text)
    return {"text": req.text, "embedding": embedding, "dimensions": len(embedding)}

@router.post("/batch")
def embed_batch(req: BatchRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail='Input texts cannot be empty')
    embeddings = get_embeddings_batch(req.texts)
    return {"texts": req.texts, "embeddings": embeddings, "count": len(embeddings), "dimensions": len(embeddings[0])}
