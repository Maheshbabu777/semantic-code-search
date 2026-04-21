from app.embeddings import get_embedding
import app.state as state
from app.db import client

MIN_SCORE = 0.2

def search_code(query: str, session_id: str, top_k: int = 5) -> list[dict]:
    if session_id not in state.sessions:
        raise ValueError(f"Invalid or expired session. Index your codebase first.")
    
    collection = client.get_or_create_collection(name=f"code_{session_id}")
    embedding = get_embedding(query)

    results = collection.query(
        query_embeddings = [embedding],
        n_results = top_k
    )

    output = []
    for i in range(len(results["documents"][0])):
        score = max(0.0, round(1 - results["distances"][0][i], 4))
        if score < MIN_SCORE:
            continue
        output.append({
            "code": results["documents"][0][i],
            "filepath": results["metadatas"][0][i]["filepath"],
            "start_line": results["metadatas"][0][i]["start_line"],
            "end_line": results["metadatas"][0][i]["end_line"],
            "score": score,
        })
    
    return output