import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "flax-sentence-embeddings/st-codesearch-distilroberta-base"

model = SentenceTransformer(MODEL_NAME)

def get_embedding(text: str) -> list[float]:
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()

def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist() 
