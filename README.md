# semantic-code-search

> Search any codebase using natural language. Paste a GitHub URL or upload a zip — get back the most semantically relevant code chunks with file path and line numbers.

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Node](https://img.shields.io/badge/node-ESM-green)
![Python](https://img.shields.io/badge/python-3.10-blue)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

---

## What it does

Most code search tools only match exact strings. This engine understands **meaning**.

Search `"function that finds a pattern in text"` and it returns your KMP and Boyer-Moore implementations — even though those exact words don't appear in the code.

It combines two complementary approaches:

- **Exact search** — KMP and Boyer-Moore string algorithms for precise pattern matching (character positions, line numbers)
- **Semantic search** — `st-codesearch-distilroberta-base` embeddings stored in ChromaDB for natural language → code retrieval

---

## Architecture

```
User
 │
 ├── GitHub URL or zip upload
 │
 ▼
Python FastAPI service (port 8000)
 ├── POST /index      → clone repo / extract zip → chunk files → embed → store in ChromaDB
 ├── POST /upload     → accept zip → extract → index (same pipeline)
 ├── POST /search     → embed query → ChromaDB similarity search → return top-k chunks
 └── POST /embed      → raw embedding endpoint (single + batch)
 │
 ▼
ChromaDB (persistent, session-scoped collections)
 └── code_{session_id} per user → fully isolated

Node.js Express service (port 3001)
 └── POST /search     → KMP / Boyer-Moore exact pattern matching with line + column resolution
```

Every user gets a unique `session_id` on indexing. All searches are scoped to that session — no data leaks between users.

---

## Tech stack

| Layer | Technology |
|---|---|
| Exact search | Node.js, Express, ESM |
| Semantic search | Python, FastAPI, uvicorn |
| Embedding model | `flax-sentence-embeddings/st-codesearch-distilroberta-base` |
| Vector store | ChromaDB (persistent) |
| Testing | Vitest (Node), pytest (Python) |
| Dev tooling | nodemon, conda |

### Why this embedding model

`st-codesearch-distilroberta-base` was trained on the **CodeSearchNet dataset** — natural language descriptions paired with code functions from GitHub. It was purpose-built for natural language → code retrieval, which is exactly this use case. Evaluated and chosen over mDeBERTa (multilingual overhead, irrelevant for code) and CodeBERT base (no pooling layer, heavier).

---

## Project structure

```
semantic-code-search/
├── backend-node/                  ← Exact string search service
│   ├── src/
│   │   ├── index.js               ← Express entry point
│   │   ├── search/
│   │   │   ├── kmp.js             ← KMP algorithm + failure table
│   │   │   ├── boyerMoore.js      ← Boyer-Moore bad character heuristic
│   │   │   └── utils.js           ← index → line/col resolution
│   │   └── routes/
│   │       └── search.js          ← POST /search route
│   ├── tests/
│   │   ├── kmp.test.js
│   │   └── boyerMoore.test.js
│   └── package.json
│
├── backend-python/                ← Semantic search service
│   ├── app/
│   │   ├── main.py                ← FastAPI entry point + lifespan cleanup
│   │   ├── embeddings.py          ← Model loading + single/batch inference
│   │   ├── chunker.py             ← Function-level chunker + line fallback
│   │   ├── indexer.py             ← File walker + ChromaDB upsert
│   │   ├── searcher.py            ← Query embed + ChromaDB query
│   │   ├── github.py              ← Git clone + cleanup
│   │   ├── uploader.py            ← Zip extraction
│   │   ├── state.py               ← In-memory session store
│   │   └── routes/
│   │       ├── embed.py           ← POST /embed/single, /embed/batch
│   │       ├── index.py           ← POST /index (GitHub URL)
│   │       ├── upload.py          ← POST /upload (zip file)
│   │       └── search.py          ← POST /search
│   ├── tests/
│   ├── requirements.txt
│   └── .env
│
├── frontend/                      ← React UI (coming Week 5)
├── docs/
├── docker-compose.yml             ← Coming Week 6
├── .env.example
├── .gitignore
└── README.md
```

---

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.10+
- conda
- Git

### 1. Clone the repo

```bash
git clone https://github.com/Maheshbabu777/semantic-code-search.git
cd semantic-code-search
```

### 2. Start the Node.js service

```bash
cd backend-node
npm install
npm run dev        # runs on port 3001 with nodemon
```

### 3. Start the Python service

```bash
cd backend-python
conda create -n code-search python=3.10
conda activate code-search
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

First run downloads the embedding model (~250MB, cached after that).

### 4. Copy environment variables

```bash
cp .env.example .env
```

---

## API reference

### Python service — `http://localhost:8000`

#### `GET /health`
```json
{ "status": "ok" }
```

#### `POST /index`
Index a public GitHub repo.
```json
{
  "github_url": "https://github.com/username/repo"
}
```
Returns:
```json
{
  "indexed": 42,
  "session_id": "uuid-here",
  "github_url": "https://github.com/username/repo"
}
```

#### `POST /upload`
Index a local codebase via zip upload.
```
multipart/form-data
file: your-project.zip
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
  "matchCount": 2,
  "matches": [
    { "index": 9, "line": 1, "col": 10 }
  ]
}
```

---

## How chunking works

Files are split at function boundaries using regex patterns that detect:
- Python: `def`, `async def`
- JavaScript/TypeScript: `function`, `const`, `let`, `var` assignments
- Other languages: fixed 25-line chunks (fallback)

Each chunk stores its `filepath`, `start_line`, and `end_line` as ChromaDB metadata — returned with every search result.

Skipped directories: `node_modules`, `.git`, `__pycache__`, `dist`, `build`, `.next`, `venv`.

---

## Session lifecycle

```
POST /index or /upload
  → generates session_id (uuid4)
  → clones/extracts to /tmp/codesearch_{id}
  → indexes into ChromaDB collection code_{session_id}
  → stores in state.sessions

POST /search
  → validates session_id exists
  → queries only that session's collection

Server shutdown
  → lifespan cleanup deletes all temp folders
```

Sessions are in-memory — a server restart requires re-indexing. Redis persistence is a planned improvement.

---

## Tasks

- [x] Node.js exact search — KMP + Boyer-Moore
- [x] FastAPI embedding service — `st-codesearch-distilroberta-base`
- [x] ChromaDB vector store with session isolation
- [x] GitHub URL indexing
- [x] Zip upload indexing
- [ ] React frontend — search UI with result highlighting
- [ ] Hybrid search router — auto-route exact vs semantic queries
- [ ] Docker Compose — one command startup
- [ ] Deploy — HuggingFace Spaces (Python) + Vercel (frontend)
- [ ] AI/RAG layer — LLM explains returned code chunks

---

## License

MIT
