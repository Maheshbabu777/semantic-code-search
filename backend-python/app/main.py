from fastapi import FastAPI
from app.routes.embed import router as embed_router

app = FastAPI()

app.include_router(embed_router, prefix="/embed")

@app.get("/health")
def health():
    return {"status": "ok"}