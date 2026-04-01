import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "microsoft/codebert-base"

model = SentenceTransformer(MODEL_NAME)

def get_embedding(text: str) -> list[float]:
    embedding = model.encode(text, normalize_embedding=True)
    return embedding.tolist()

def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    embeddings = model.encode(texts, normalize_embedding=True)
    return embeddings.tolist() 
