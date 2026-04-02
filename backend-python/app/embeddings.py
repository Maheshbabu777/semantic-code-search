import os
import numpy as np
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
MODEL_NAME = "flax-sentence-embeddings/st-codesearch-distilroberta-base"

model = SentenceTransformer(MODEL_NAME, token=HF_TOKEN)

def get_embedding(text: str) -> list[float]:
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()

def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist() 
