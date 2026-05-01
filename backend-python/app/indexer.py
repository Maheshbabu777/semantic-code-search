import os
import hashlib
from app.chunker import chunk_file
from app.embeddings import get_embeddings_batch
from app.db import client

SUPPORTED_EXTENSIONS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".java",
    ".go",
    ".rb",
    ".php",
    ".rs",
    ".c",
    ".cpp",
    ".cs",
    ".h",
    ".swift",
    ".sh",
}

SKIP_DIRS = {
    ".git",
    ".github",
    ".gitlab",
    ".husky",
    ".vscode",
    ".idea",
    "node_modules",
    "vendor",
    "__pycache__",
    "venv",
    ".venv",
    "env",
    ".env",
    "virtualenv",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    "target",
    "bin",
    "obj",
    "tests",
    "test",
    "__tests__",
    "coverage",
    ".nyc_output",
    "docs",
    "doc",
    "examples",
    "demo",
    "fixtures",
    "stubs",
}

SKIP_FILE_PATTERNS = ("test_", "spec_")

SKIP_FILE_SUFFIXES = (
    "_test.py",
    "_spec.py",
    ".test.js",
    ".spec.js",
    ".test.ts",
    ".spec.ts",
    ".test.jsx",
    ".spec.jsx",
    ".test.tsx",
    ".spec.tsx",
    "conftest.py",
    "setup.py",
    "setup.cfg",
)

MAX_CHUNKS = 2000


def should_skip_file(filename: str) -> bool:
    return any(filename.startswith(p) for p in SKIP_FILE_PATTERNS) or any(
        filename.endswith(s) for s in SKIP_FILE_SUFFIXES
    )


def _enrich_chunk(chunk: dict) -> str:
    filename = os.path.basename(chunk["filepath"])
    start = chunk["start_line"]
    end = chunk["end_line"]
    return f"File: {filename} (lines {start}–{end})\n\n{chunk['code']}"


def get_collection(session_id: str):
    return client.get_or_create_collection(
        name=f"code_{session_id}",
        metadata={"hnsw:space": "cosine"},
    )


def index_codebase(folder_path: str, session_id: str) -> dict:
    if not os.path.exists(folder_path):
        raise ValueError(f"Folder not found: {folder_path}")

    collection = get_collection(session_id)
    all_chunks = []
    skipped_ext = 0

    for root, dirs, files in os.walk(folder_path):
        dirs[:] = [d for d in dirs if d.lower() not in {s.lower() for s in SKIP_DIRS}]

        for file in files:
            if should_skip_file(file):
                continue
            ext = os.path.splitext(file)[1].lower()
            if ext not in SUPPORTED_EXTENSIONS:
                skipped_ext += 1
                continue
            filepath = os.path.join(root, file)
            chunks = chunk_file(filepath)
            all_chunks.extend(chunks)

    if not all_chunks:
        return {"indexed": 0, "message": "No supported files found."}

    warning = None
    if len(all_chunks) > MAX_CHUNKS * 2:
        raise ValueError(
            f"Codebase too large: {len(all_chunks)} chunks detected. "
            f"The limit is {MAX_CHUNKS}. Consider indexing a sub-folder."
        )
    if len(all_chunks) > MAX_CHUNKS:
        warning = (
            f"Large codebase: {len(all_chunks)} chunks found, "
            f"indexed the first {MAX_CHUNKS} (walk order). "
            f"Results may not cover all files."
        )
        all_chunks = all_chunks[:MAX_CHUNKS]

    enriched_texts = [_enrich_chunk(c) for c in all_chunks]
    embeddings = get_embeddings_batch(enriched_texts)

    ids = [
        hashlib.md5(f"{chunk['filepath']}:{chunk['start_line']}".encode()).hexdigest()
        for chunk in all_chunks
    ]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=enriched_texts,
        metadatas=[
            {
                "filepath": chunk["filepath"],
                "start_line": chunk["start_line"],
                "end_line": chunk["end_line"],
                "raw_code": chunk["code"],
            }
            for chunk in all_chunks
        ],
    )

    result = {"indexed": len(all_chunks)}
    if warning:
        result["warning"] = warning
    return result
