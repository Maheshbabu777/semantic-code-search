import os
import chromadb

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
client = chromadb.PersistentClient(path=CHROMA_PATH)
