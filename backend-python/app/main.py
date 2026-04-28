from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.embed import router as embed_router
from app.routes.index import router as index_router
from app.routes.search import router as search_router
from app.routes.upload import router as upload_router
from app.routes.sessions import router as session_router, _drop_collection
from app.github import cleanup_repo
from app.db import client
from app.session_store import load_all_sessions, delete_session
import app.state as state


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        existing_collections = {c.name for c in client.list_collections()}
        active_collection_names = {f"code_{sid}" for sid in state.sessions}
        orphans = existing_collections - active_collection_names
        for name in orphans:
            print(f"[startup] sweeping orphaned collection: {name}")
            _drop_collection(name)
    except Exception as exc:
        print(f"[startup] orphan sweep failed (non-fatal): {exc}")

    yield

    for session_id, session in list(state.sessions.items()):
        try:
            _drop_collection(f"code_{session_id}")
        except Exception as exc:
            print(f"[shutdown] error dropping collection for {session_id}: {exc}")

        folder = session.get("session_folder")
        if folder:
            try:
                cleanup_repo(folder)
            except Exception as exc:
                print(f"[shutdown] error cleaning folder for {session_id}: {exc}")

        try:
            delete_session(session_id)
        except Exception as exc:
            print(f"[shutdown] error deleting session record for {session_id}: {exc}")

        state.sessions.pop(session_id, None)
    print("[shutdown] all sessions cleaned up.")


app = FastAPI(title="Semantic Code Search - Python API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(embed_router, prefix="/embed")
app.include_router(index_router, prefix="/index")
app.include_router(search_router, prefix="/search")
app.include_router(upload_router, prefix="/upload")
app.include_router(session_router, prefix="/session")


@app.get("/health")
def health():
    return {"status": "ok"}
