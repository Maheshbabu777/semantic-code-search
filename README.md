# Semantic Code Search

> Search any codebase using natural language. Paste a GitHub URL or upload a zip — get back the most semantically relevant code chunks with file path and line numbers.

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Node](https://img.shields.io/badge/node-ESM-green)
![Python](https://img.shields.io/badge/python-3.10-blue)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

---

## What it does

Most code search tools only match exact strings. This engine understands **meaning**.

Search `"function that finds a pattern in text"` and it returns your KMP and Boyer-Moore implementations — even though those exact words don't appear in the code.

It uses a **two-stage retrieve-then-rerank pipeline**:

- **Stage 1 — Bi-encoder retrieval** — `st-codesearch-distilroberta-base` embeds the query and retrieves the top 20 candidates from ChromaDB using approximate nearest neighbor search. Fast but shallow.
- **Stage 2 — Cross-encoder re-ranking** — `ms-marco-MiniLM-L-6-v2` reads the query and each candidate chunk together to produce a true relevance score. Slower but dramatically more accurate — captures interactions between query and code that bi-encoders miss.

Combined with keyword overlap scoring and dynamic thresholding, this produces production-grade retrieval quality on a fully local setup.

---

## Architecture

```
User
 │
 ├── GitHub URL  →  POST /index  →  git clone → chunk → enrich → embed → ChromaDB
 └── zip upload  →  POST /upload →  extract   → chunk → enrich → embed → ChromaDB
                                                                               │
                                                                        session_id returned
                                                                               │
 User searches  →  POST /search
                       │
                       ├── 1. enrich query
                       ├── 2. bi-encoder → top 20 candidates from ChromaDB
                       ├── 3. hybrid score (semantic 0.75 + keyword 0.25)
                       ├── 4. dynamic threshold filter
                       ├── 5. cross-encoder re-rank → top 5
                       └── results returned with filepath + line numbers

Node.js service (port 3001)
 └── POST /search  →  KMP / Boyer-Moore exact match → line + column positions
```

Every user gets a unique `session_id` on indexing. All searches are scoped to that session — no data leaks between concurrent users.

---

## Tech stack

| Layer | Technology |
|---|---|
| Exact search | Node.js, Express, ESM |
| Semantic search | Python 3.10, FastAPI, uvicorn |
| Bi-encoder model | `flax-sentence-embeddings/st-codesearch-distilroberta-base` |
| Re-ranking model | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| Vector store | ChromaDB (persistent, session-scoped) |
| Frontend | React 19, Vite, React Router, Axios |
| Testing | Vitest (Node.js) |
| Dev tooling | nodemon, conda |

### Model choices

**Bi-encoder — `st-codesearch-distilroberta-base`**

Trained on the **CodeSearchNet dataset** — natural language descriptions paired with code functions from GitHub. Purpose-built for natural language → code retrieval. Evaluated and chosen over:

- `mDeBERTa-v3-base` — multilingual overhead is irrelevant since all code is written in English regardless of developer background
- `codebert-base` — no pooling layer baked in, heavier at ~500MB
- `bge-small-en-v1.5` — trained on general English text, weak on code semantics

**Cross-encoder — `ms-marco-MiniLM-L-6-v2`**

Reads query and code chunk together rather than encoding independently. This joint reading captures relevance signals that bi-encoders miss — a chunk containing the right function but with low keyword overlap will still rank correctly. At ~80MB it runs on CPU without meaningful latency impact on a 20-candidate set.

---

## Project structure

```
semantic-code-search/
├── backend-node/                   ← Exact string search service
│   ├── src/
│   │   ├── index.js                ← Express entry point
│   │   ├── search/
│   │   │   ├── kmp.js              ← KMP algorithm + failure table
│   │   │   ├── boyerMoore.js       ← Boyer-Moore bad character heuristic
│   │   │   └── utils.js            ← character index → line/col resolution
│   │   └── routes/
│   │       └── search.js           ← POST /search route
│   ├── tests/
│   │   ├── kmp.test.js
│   │   └── boyerMoore.test.js
│   └── package.json
│
├── backend-python/                 ← Semantic search service
│   ├── app/
│   │   ├── main.py                 ← FastAPI entry point, CORS, lifespan cleanup
│   │   ├── db.py                   ← Single shared ChromaDB PersistentClient
│   │   ├── state.py                ← In-memory session store
│   │   ├── embeddings.py           ← Model loading + single/batch inference
│   │   ├── reranker.py             ← Cross-encoder re-ranking (ms-marco-MiniLM)
│   │   ├── chunker.py              ← Function-level chunker + 15-line fallback
│   │   ├── indexer.py              ← File walker, skip lists, enrichment, batch embed
│   │   ├── searcher.py             ← Two-stage pipeline: retrieve → hybrid score → rerank
│   │   ├── github.py               ← Git clone (depth=1) + temp folder cleanup
│   │   ├── uploader.py             ← Zip extraction to temp folder
│   │   └── routes/
│   │       ├── embed.py            ← POST /embed/single, /embed/batch
│   │       ├── index.py            ← POST /index (GitHub URL)
│   │       ├── upload.py           ← POST /upload (zip file)
│   │       ├── search.py           ← POST /search
│   │       └── sessions.py         ← DELETE /session/{id}
│   ├── requirements.txt
│   └── .env
│
├── frontend/                       ← React UI
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                 ← React Router setup
│   │   ├── index.css               ← Design system (DM Sans + DM Mono, dark theme)
│   │   ├── api/
│   │   │   └── client.js           ← All API calls
│   │   ├── pages/
│   │   │   ├── IndexPage.jsx       ← GitHub URL + zip upload + animated loading
│   │   │   └── SearchPage.jsx      ← Search bar + results + session exit
│   │   └── components/
│   │       └── ResultCard.jsx      ← Score badge, filepath, line range, code block
│   └── package.json
│
├── docs/
├── docker-compose.yml              ← Coming Week 6
├── .env.example
├── .gitignore
└── README.md
```

---

## Getting started

### Prerequisites

- Node.js 20+
- Python 3.10+
- conda
- Git

### 1. Clone the repo

```bash
git clone https://github.com/Maheshbabu777/semantic-code-search.git
cd semantic-code-search
```

### 2. Environment variables

```bash
cp .env.example .env
```

### 3. Start the Node.js service

```bash
cd backend-node
npm install
npm run dev        # port 3001, hot reload via nodemon
```

### 4. Start the Python service

```bash
cd backend-python
conda create -n code-search python=3.10
conda activate code-search
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

First run downloads both models (~330MB total). Cached after that — subsequent starts are fast.

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev        # port 5173
```

Open `http://localhost:5173`, paste a GitHub URL, and search.

---

## API reference

### Python service — `http://localhost:8000`

#### `GET /health`
```json
{ "status": "ok" }
```

#### `POST /index`
Index a public GitHub repository.
```json
{ "github_url": "https://github.com/username/repo" }
```
Returns:
```json
{
  "indexed": 156,
  "session_id": "uuid-here",
  "github_url": "https://github.com/username/repo"
}
```

#### `POST /upload`
Index a local codebase via zip file upload.
```
Content-Type: multipart/form-data
file: project.zip
```
Returns same shape as `/index` with `source` instead of `github_url`.

#### `POST /search`
Search the indexed codebase.
```json
{
  "query": "function that finds a pattern in text",
  "session_id": "uuid-from-index",
  "top_k": 5
}
```
Returns:
```json
{
  "query": "function that finds a pattern in text",
  "results": [
    {
      "code": "function kmpSearch(text, pattern) { ... }",
      "filepath": "/tmp/codesearch_abc/src/search/kmp.js",
      "start_line": 14,
      "end_line": 38,
      "score": 0.9121
    }
  ]
}
```

Scores reflect the cross-encoder relevance judgment, not raw cosine similarity.

#### `DELETE /session/{session_id}`
Close a session. Deletes the ChromaDB collection and temp folder.
```json
{ "deleted": "uuid-here" }
```

#### `POST /embed/single`
```json
{ "text": "binary search implementation" }
```

#### `POST /embed/batch`
```json
{ "texts": ["binary search", "linked list traversal"] }
```

---

### Node.js service — `http://localhost:3001`

#### `POST /search`
Exact pattern matching with line and column resolution.
```json
{
  "text": "function kmpSearch(text, pattern) { ... }",
  "pattern": "kmpSearch",
  "algorithm": "kmp"
}
```
`algorithm` accepts `"kmp"` (default) or `"bm"` (Boyer-Moore).

Returns:
```json
{
  "algorithm": "kmp",
  "pattern": "kmpSearch",
  "matchCount": 1,
  "matches": [
    { "index": 9, "line": 1, "col": 10 }
  ]
}
```

---

## How the retrieval pipeline works

### Chunking

Files are split at function boundaries using regex that detects:

- Python: `def`, `async def`
- JavaScript/TypeScript: `function`, `const`, `let`, `var` assignments

Files with no detected boundaries fall back to 15-line chunks so no file is silently skipped.

### Chunk enrichment

Before embedding, every chunk is enriched with file context:

```
File: kmp.js
Code:
function kmpSearch(text, pattern) { ... }
```

This aligns the chunk format with how the model was trained — on natural language + code pairs — improving semantic matching quality.

### Query enrichment

Queries are prefixed before embedding:

```
Search for code that: function that finds a pattern in text
```

### Hybrid scoring (Stage 1)

Initial candidates are scored using:

```
combined_score = 0.75 × semantic_score + 0.25 × keyword_overlap
```

Keyword overlap captures exact identifier matches that embedding similarity may underweight.

### Dynamic thresholding

Rather than a fixed cutoff, the threshold adapts to each query's score distribution:

```
threshold = max(0.2, 0.5 × max_score)
```

### Cross-encoder re-ranking (Stage 2)

Filtered candidates are passed as `[query, code]` pairs to the cross-encoder. It scores each pair jointly — reading query and code together — then returns the top-k by relevance score.

### Skipped directories

```
node_modules  .git  __pycache__  dist  build  .next  venv
tests  test  __tests__  docs  doc  examples  demo
```

### Skipped file patterns

`test_*`, `spec_*`, `*_test.py`, `*_spec.py`, `*.test.js`, `*.spec.js`, `*.test.ts`, `*.spec.ts`

Test files contain high keyword overlap with source queries and pollute results without contributing useful retrievals.

---

## Session lifecycle

```
POST /index or /upload
  → uuid4 session_id generated
  → repo cloned / zip extracted to /tmp/codesearch_{id}
  → files chunked, enriched, embedded in batch, upserted to ChromaDB
  → collection: code_{session_id}
  → session stored in state.sessions

POST /search
  → session_id validated
  → two-stage retrieval: bi-encoder → hybrid score → cross-encoder
  → top-k results returned

DELETE /session/{session_id}
  → ChromaDB collection deleted
  → temp folder deleted
  → session removed from state.sessions

Server startup
  → orphaned collections from previous runs auto-deleted

Server shutdown
  → all remaining temp folders cleaned up
```

Sessions are in-memory. A server restart requires re-indexing.

---

## Known limitations

- **In-memory sessions** — server restart wipes all sessions, users must re-index
- **Single-process ChromaDB** — `PersistentClient` is not safe for parallel write requests; concurrent indexing may cause conflicts
- **Blocking indexing** — indexing runs on the request thread; large repos hold the connection open until complete
- **No rate limiting** — repeated indexing requests can exhaust disk and memory
- **Regex-based chunker** — complex anonymous functions, decorators, or deeply nested closures may not chunk correctly

---

## Roadmap

- [x] Node.js exact search — KMP + Boyer-Moore with line/col resolution
- [x] FastAPI embedding service — `st-codesearch-distilroberta-base`
- [x] ChromaDB vector store — persistent, session-scoped, single shared client
- [x] GitHub URL indexing — depth=1 clone, temp folder, auto-cleanup
- [x] Zip upload indexing — multipart, extraction, same pipeline
- [x] Session isolation — uuid4 per user, isolated ChromaDB collections
- [x] Test file filtering — excluded from indexing to reduce noise
- [x] Chunk and query enrichment — file context prefix improves alignment
- [x] Hybrid scoring — semantic + keyword overlap combined score
- [x] Dynamic thresholding — adapts cutoff to each query's score distribution
- [x] Cross-encoder re-ranking — two-stage retrieve-then-rerank pipeline
- [x] Orphan cleanup — stale collections deleted on server startup
- [x] React frontend — dark theme, animated loading, search + results
- [ ] Docker Compose — single command to start all three services
- [ ] Deploy — HuggingFace Spaces (Python) + Vercel (frontend)
- [ ] AI/RAG layer — LLM explains returned code chunks and answers follow-ups

---

## License

MIT