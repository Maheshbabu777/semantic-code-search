from app.embeddings import get_embedding
from app.reranker import rerank
from app.db import client
import app.state as state

MIN_CONFIDENT_SCORE = 0.10
RERANK_SCORE_FLOOR = -2.0


def keyword_overlap(query: str, text: str) -> float:
    q = set(query.lower().split())
    t = set(text.lower().split())
    if not q:
        return 0.0
    return len(q & t) / len(q)


def enrich_query(query: str) -> str:
    return f"Search for code that: {query}"


def search_code(query: str, session_id: str, k: int = 5) -> list[dict]:
    if session_id not in state.sessions:
        raise ValueError("Invalid or expired session. Please re-index your codebase.")

    try:
        collection = client.get_collection(name=f"code_{session_id}")
    except Exception:
        raise ValueError(
            "Session index not found. The server may have restarted — "
            "please re-index your codebase."
        )

    total = collection.count()
    if total == 0:
        return []

    n_results = min(20, total)
    embedding = get_embedding(enrich_query(query))

    results = collection.query(
        query_embeddings=[embedding],
        n_results=n_results,
    )

    candidates = []

    for i in range(len(results["documents"][0])):
        semantic_score = max(0.0, 1.0 - results["distances"][0][i])

        raw_code = results["metadatas"][0][i].get(
            "raw_code",
            results["documents"][0][i],
        )
        kw_score = keyword_overlap(query, raw_code)

        combined = round(0.75 * semantic_score + 0.25 * kw_score, 4)

        candidates.append(
            {
                "code": raw_code,
                "filepath": results["metadatas"][0][i]["filepath"],
                "start_line": results["metadatas"][0][i]["start_line"],
                "end_line": results["metadatas"][0][i]["end_line"],
                "score": combined,
            }
        )

    if not candidates:
        return []

    max_score = max(c["score"] for c in candidates)

    if max_score < MIN_CONFIDENT_SCORE:
        return []

    threshold = max(0.2, 0.5 * max_score)
    candidates = [c for c in candidates if c["score"] >= threshold]

    if not candidates:
        return []

    reranked = rerank(query, candidates, k_top=k)

    rerank_scores = [r.get("rerank_score", RERANK_SCORE_FLOOR) for r in reranked]
    best_rerank = max(rerank_scores) if rerank_scores else RERANK_SCORE_FLOOR
    worst_rerank = min(rerank_scores) if rerank_scores else RERANK_SCORE_FLOOR
    rerank_spread = best_rerank - worst_rerank

    reranker_has_signal = best_rerank > RERANK_SCORE_FLOOR and rerank_spread > 0.5

    if reranker_has_signal:
        for r in reranked:
            rerank_score = r.pop("rerank_score", RERANK_SCORE_FLOOR)
            normalised = max(0.0, min(1.0, (rerank_score + 5.0) / 10.0))
            r["score"] = round(0.7 * normalised + 0.3 * r["score"], 4)
        reranked = sorted(reranked, key=lambda x: x["score"], reverse=True)
    else:
        for r in reranked:
            r.pop("rerank_score", None)
        reranked = sorted(reranked, key=lambda x: x["score"], reverse=True)

    reranked = [r for r in reranked if r["score"] > 0.0]

    return reranked