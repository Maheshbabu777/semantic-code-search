import time
import uuid
import os
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.uploader import extract_upload
from app.indexer import index_codebase
from app.session_store import save_session
import app.state as state

router = APIRouter()


@router.post("/")
async def upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files supported")

    try:
        session_id = str(uuid.uuid4())
        tmp_zip = os.path.join(tempfile.gettempdir(), f"{session_id}.zip")

        with open(tmp_zip, "wb") as f:
            content = await file.read()
            f.write(content)

        tmp_dir = extract_upload(tmp_zip)
        os.remove(tmp_zip)

        result = index_codebase(tmp_dir, session_id)
        session_data = {
            "collection_id": f"code_{session_id}",
            "session_folder": tmp_dir,
            "source": file.filename,
            "created_at": time.time(),
        }

        save_session(session_id, session_data)
        state.sessions[session_id] = session_data

        return {
            **result,
            "session_id": session_id,
            "source": file.filename,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to process upload: {str(e)}"
        )


@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    try:
        result = await extract_upload(files)
        return JSONResponse({"status": "success", "message": result})
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
