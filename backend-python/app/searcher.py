import chromadb
from app.embeddings import get_embedding
from app.reranker import rerank
from app.db import client
import app.state as state

def keyword_overlap(query: str, text: str) -> float:
    q=set(query.lower().split())
    t=set(text.lower().split())
    if not q:
        return 0.0
    return len(q & t) / len(q)

def enrich_query(query: str) -> str:
    return f"Search for code that: {query}"

def search_code(query: str, session_id: str, k:int = 5) -> list[dict]:
    if session_id not in state.sessions:
        raise ValueError("Invalid or expired session. Index your codebase first.")
    
    collection = client.get_or_create_collection(f"code_{session_id}")
    embedding = get_embedding(enrich_query(query))

    results = collection.query(
        query_embeddings=[embedding],
        n_results=20
    )

    candidates = []

    for i in range(len(results["documents"][0])):
        semantic_score = max(0.0, 1 - results["distances"][0][i])
        kw_score = keyword_overlap(query, results["documents"][0][i])
        combined = round(0.75 * semantic_score + 0.25 * kw_score, 4)

        candidates.append({
            "code": results["documents"][0][i],
            "filepath": results["metadatas"][0][i]["filepath"],
            "start_line": results["metadatas"][0][i]["start_line"],
            "end_line": results["metadatas"][0][i]["end_line"],
            "score": combined
        })

    if candidates:
        max_score = max(c["score"] for c in candidates)
        candidates = [c for c in candidates if c["score"] >= 0.5 * max_score]
    
    reranked = rerank(query, candidates, k_top=k)

    for r in reranked:
        r["score"] = r.pop("rerank_score")

    return reranked