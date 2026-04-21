import os
import hashlib
from app.chunker import chunk_file
from app.embeddings import get_embeddings_batch
from app.db import client

SUPPORTED_EXTENSIONS = {
    ".js", ".jsx", ".ts", ".tsx",
    ".py", ".java", ".go", ".rb", ".php", ".rs",
    ".c", ".cpp", ".cs", ".h", ".swift",
    ".sh"
}

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__",
    "dist", "build", ".next", "venv",
    "tests", "test", "__tests__",
    "docs", "doc", "examples", "demo"
}

SKIP_FILE_PATTERNS = (
    "test_", "spec_"
)

SKIP_FILE_SUFFIXES = (
    "_test.py", "_spec.py",
    ".test.js", ".spec.js",
    ".test.ts", ".spec.ts"
)

def should_skip_file(filename: str) -> bool:
    return (
        any(filename.startswith(p) for p in SKIP_FILE_PATTERNS) or
        any(filename.endswith(s) for s in SKIP_FILE_SUFFIXES)
    )
def get_collection(session_id: str):
    return client.get_or_create_collection(name=f"code_{session_id}")

def index_codebase(folder_path: str, session_id: str) -> dict:
    if not os.path.exists(folder_path):
        raise ValueError(f"Folder not found: {folder_path}")

    collection = get_collection(session_id)

    all_chunks = []

    for root, dirs, files in os.walk(folder_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for file in files:
            if should_skip_file(file):
                continue
            ext = os.path.splitext(file)[1]
            if ext in SUPPORTED_EXTENSIONS:
                filepath = os.path.join(root, file)
                chunks = chunk_file(filepath)
                all_chunks.extend(chunks)

    if not all_chunks:
        return { "indexed": 0, "message": "No supported files found." }
    
    MAX_CHUNKS = 2000
    if len(all_chunks) > MAX_CHUNKS:
        raise ValueError(f"Codebase too large: {len(all_chunks)}, "
                         f"limit is {MAX_CHUNKS}. Index them in smaller parts.")

    codes = [chunk["code"] for chunk in all_chunks]
    embeddings = get_embeddings_batch(codes)

    ids = [
        hashlib.md5(f"{chunk['filepath']}:{chunk['start_line']}".encode()).hexdigest()
        for chunk in all_chunks
    ]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=codes,
        metadatas=[{
            "filepath": chunk["filepath"],
            "start_line": chunk["start_line"],
            "end_line": chunk["end_line"]
        } for chunk in all_chunks]
    )

    return { "indexed": len(all_chunks) }