import os
import chromadb
from app.chunker import chunk_file
from app.embeddings import get_embeddings_batch

client = chromadb.Client()
collection = client.get_or_create_collection(name="code_chunks")

SUPPORTED_EXTENSIONS = {
    ".js", ".jsx", ".ts", ".tsx",
    ".py", ".java", ".go", ".rb", ".php", ".rs",
    ".c", ".cpp", ".cs", ".h", ".swift",
    ".sh"
}

def index_codebase(folder_path: str) -> dict:
    if not os.path.exists(folder_path):
        raise ValueError(f"Folder not found: {folder_path}")

    all_chunks = []

    for root, dirs, files in os.walk(folder_path):
        dirs[:] = [d for d in dirs if d not in {
            "node_modules", ".git", "__pycache__",
            "dist", "build", ".next", "venv"
        }]
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext in SUPPORTED_EXTENSIONS:
                filepath = os.path.join(root, file)
                chunks = chunk_file(filepath)
                all_chunks.extend(chunks)

    if not all_chunks:
        return { "indexed": 0, "message": "No supported files found." }

    codes = [chunk["code"] for chunk in all_chunks]
    embeddings = get_embeddings_batch(codes)

    collection.add(
        ids=[f"chunk_{i}" for i in range(len(all_chunks))],
        embeddings=embeddings,
        documents=codes,
        metadatas=[{
            "filepath": chunk["filepath"],
            "start_line": chunk["start_line"],
            "end_line": chunk["end_line"]
        } for chunk in all_chunks]
    )

    return { "indexed": len(all_chunks) }