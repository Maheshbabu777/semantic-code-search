import chromadb
from app.embeddings import get_embedding

client = chromadb.Client()
collection = client.get_or_create_collection(name="code_chunks")

def search_code(query: str, top_k: int = 5) -> list[dict]:
    embedding = get_embedding(query)

    results = collection.query(
        query_embeddings = [embedding],
        n_results = top_k
    )

    output = []
    for i in range(len(results["documents"][0])):
        output.append({
            "code": results["documents"][0][i],
            "filepath": results["metadatas"][0][i]["filepath"],
            "start_line": results["metadatas"][0][i]["start_line"],
            "end_line": results["metadatas"][0][i]["end_line"],
            "score": round(1 - results["distances"][0][i],4)
        })
    
    return output