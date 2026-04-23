from sentence_transformers import CrossEncoder

MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"
reranker = CrossEncoder(MODEL_NAME)


def rerank(query: str, results: list[dict], k_top: int = 5) -> list[dict]:
    if not results:
        return results

    pairs = [[query, res["code"]] for res in results]

    scores = reranker.predict(pairs)

    for i, res in enumerate(results):
        res["rerank_score"] = round(float(scores[i]), 4)

    results.sort(key=lambda x: x["rerank_score"], reverse=True)

    return results[:k_top]
