from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.routes.embed import router as embed_router
from app.routes.index import router as index_router
from app.routes.search import router as search_router
from app.routes.upload import router as upload_router
from app.routes.sessions import router as session_router
from app.github import cleanup_repo
import app.state as state

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    for session in state.sessions.values():
        cleanup_repo(session["session_folder"])
    print(f"Cleaned up {len(state.sessions)} sessions")

app = FastAPI(lifespan=lifespan)

app.include_router(embed_router, prefix="/embed")
app.include_router(index_router, prefix="/index")
app.include_router(search_router, prefix="/search")
app.include_router(upload_router, prefix="/upload")
app.include_router(session_router, prefix="/session")

@app.get("/health")
def health():
    return {"status": "ok"}