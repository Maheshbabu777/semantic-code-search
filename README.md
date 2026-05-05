# Semantic Code Search

> Search any codebase using natural language. Paste a GitHub URL or upload a zip — get back the most semantically relevant code chunks with file path and line numbers. Ask follow-up questions via the RAG chat interface.

![Status](https://img.shields.io/badge/status-complete-brightgreen)
![Node](https://img.shields.io/badge/node-ESM-green)
![Python](https://img.shields.io/badge/python-3.10-blue)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

---

## What it does

Most code search tools only match exact strings. This engine understands **meaning**.

Search `"function that finds a pattern in text"` and it returns your KMP and Boyer-Moore implementations — even though those exact words don't appear in the code. It combines semantic embeddings with keyword overlap scoring, dynamic thresholding, and a RAG chat interface that lets you ask follow-up questions with streaming responses and source citations.

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
                       └── results returned with filepath + line numbers

 User chats  →  POST /chat
                       │
                       ├── 1. retrieve top 6 chunks via search pipeline
                       ├── 2. build system prompt with retrieved context
                       ├── 3. stream response via Groq (llama-3.3-70b-versatile)
                       └── SSE stream → frontend with [Chunk N] citations

Node.js service (port 3001)
 └── POST /search  →  KMP / Boyer-Moore exact match → line + column positions
```

Every user gets a unique `session_id` on indexing. All searches and chats are scoped to that session — no data leaks between concurrent users.

---

## Tech stack

| Layer | Technology |
|---|---|
| Exact search | Node.js, Express, ESM |
| Semantic search | Python 3.10, FastAPI, uvicorn |
| Bi-encoder model | `flax-sentence-embeddings/st-codesearch-distilroberta-base` |
| LLM inference | Groq API — `llama-3.3-70b-versatile` |
| Vector store | ChromaDB (persistent, session-scoped, cosine similarity) |
| Session persistence | SQLite via `session_store.py` |
| Frontend | React 19, Vite, React Router, Axios |
| Testing | Vitest (Node.js) |
| Dev tooling | nodemon, conda |
| Infrastructure | Docker Compose with named volumes |

### Model choice

**`st-codesearch-distilroberta-base`** — trained on the CodeSearchNet dataset, purpose-built for natural language → code retrieval. Evaluated against alternatives and chosen because general-purpose models (`bge-small-en-v1.5`, `mDeBERTa-v3`) degrade on code semantics, and `codebert-base` lacks a built-in pooling layer and is heavier at ~500MB.

A cross-encoder reranker (`ms-marco-MiniLM-L-6-v2`) was evaluated and deliberately removed. It is trained on web passage pairs, not code, and produces near-random relevance scores on code chunks — degrading retrieval quality rather than improving it. This is documented as an intentional decision, not an omission.

ChromaDB collections are created with `hnsw:space: cosine` — the default L2 distance makes `1 - distance` mathematically incorrect and produces negative similarity scores.

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
│   │   └── routes/search.js
│   ├── tests/
│   │   ├── kmp.test.js
│   │   └── boyerMoore.test.js
│   └── package.json
│
├── backend-python/                 ← Semantic search + RAG chat service
│   ├── app/
│   │   ├── main.py                 ← FastAPI entry point, lifespan cleanup, orphan sweep
│   │   ├── db.py                   ← Single shared ChromaDB PersistentClient singleton
│   │   ├── state.py                ← In-memory session store, loads from SQLite on startup
│   │   ├── session_store.py        ← SQLite-backed session persistence
│   │   ├── embeddings.py           ← Model loading + single/batch inference
│   │   ├── chunker.py              ← Function-level chunker + fixed-size fallback
│   │   ├── indexer.py              ← File walker, skip lists, enrichment, batch embed
│   │   ├── searcher.py             ← Hybrid scoring pipeline + dynamic threshold
│   │   ├── github.py               ← Git clone (depth=1) + temp folder cleanup
│   │   ├── uploader.py             ← Zip extraction to temp folder
│   │   └── routes/
│   │       ├── index.py            ← POST /index
│   │       ├── upload.py           ← POST /upload
│   │       ├── search.py           ← POST /search
│   │       ├── sessions.py         ← DELETE /session/{id}
│   │       └── chat.py             ← POST /chat — SSE streaming, Groq, RAG
│   ├── requirements.txt
│   └── .env
│
├── frontend/                       ← React UI
│   ├── src/
│   │   ├── App.jsx                 ← React Router setup
│   │   ├── api/client.js           ← All API calls
│   │   ├── pages/
│   │   │   ├── IndexPage.jsx       ← GitHub URL + zip upload + animated loading
│   │   │   ├── SearchPage.jsx      ← Search bar + result cards + session exit
│   │   │   └── ChatPage.jsx        ← Streaming chat, history, resizable code panel
│   │   └── components/
│   │       ├── ResultCard.jsx      ← Score badge, filepath, line range, code block
│   │       ├── ChatMessage.jsx     ← Markdown rendering via react-markdown
│   │       ├── CodePanel.jsx       ← Slide-in panel with line-number gutters
│   │       └── SourcePills.jsx     ← Citation pills with highlight on chunk reference
│   └── package.json
│
├── docker-compose.yml
├── .env.example
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

Add your keys to `.env`:

```
GROQ_API_KEY=your_groq_key
HF_TOKEN=your_huggingface_token
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

First run downloads the embedding model (~330MB). Cached after that — subsequent starts are fast.

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev        # port 5173
```

Open `http://localhost:5173`, paste a GitHub URL, and search.

### Docker

```bash
docker-compose up --build
```

Covers the Python backend and React frontend with named volumes for ChromaDB persistence and HuggingFace model caching. Node backend is excluded as it is stateless.

---

## How the retrieval pipeline works

### Chunking

Files are split at function boundaries using language-aware regex:

- **Python** — detects `def` and `async def` with indentation tracking to find where each function ends
- **JavaScript/TypeScript** — detects `function`, arrow functions, and `const`/`let`/`var` assignments with brace depth counting

Files with no detected boundaries fall back to fixed 25-line chunks so no file is silently skipped. Chunks are capped at 60 lines and split further if exceeded. Test files, spec files, and common non-source directories (`node_modules`, `dist`, `__pycache__`, `venv` etc.) are excluded from indexing to reduce noise.

### Chunk enrichment

Before embedding, every chunk is prefixed with file context:

```
File: kmp.js (lines 14–38)

function kmpSearch(text, pattern) { ... }
```

This prefix is applied **at index time**, aligning the document format with how the model was trained on natural language + code pairs. Queries are enriched with `"Search for code that: <query>"` to match this asymmetry. Enrichment must happen before embedding — applying it only at query time produces an embedding mismatch that degrades retrieval quality.

### Hybrid scoring

```
combined_score = 0.75 × semantic_score + 0.25 × keyword_overlap
```

- `semantic_score` — cosine similarity from ChromaDB, normalized as `max(0.0, round(1 - distance / 2, 4))`
- `keyword_overlap` — Jaccard-style word overlap between query tokens and `raw_code` from metadata, not the enriched document, to avoid false matches on the file prefix

### Dynamic thresholding

```
threshold = max(0.2, 0.5 × max_score)
```

Rather than a fixed cutoff, the threshold adapts to each query's score distribution. A query with a strong best match raises the bar for everything else. Results below `MIN_CONFIDENT_SCORE` are dropped entirely before thresholding.

### RAG chat

Retrieved chunks (top 6) are injected into the system prompt with `[Chunk N]` labels including filepath, line range, and score. The LLM is instructed to cite chunks inline using this notation. The frontend parses `[Chunk N]` references from the streamed response in real time and highlights the corresponding source pills. Clicking a pill opens the code panel showing the exact file and lines. When no chunks meet the confidence threshold, the LLM answers from general coding knowledge rather than refusing.

---

## Session lifecycle

```
POST /index or /upload
  → uuid4 session_id generated
  → repo cloned / zip extracted to /tmp/codesearch_{id}
  → files chunked, enriched, embedded in batch, upserted to ChromaDB
  → collection: code_{session_id}
  → session saved to SQLite + loaded into state.sessions

POST /search or POST /chat
  → session_id validated against state.sessions
  → retrieval scoped to code_{session_id} collection

DELETE /session/{session_id}
  → ChromaDB collection deleted
  → temp folder deleted
  → session removed from SQLite and state.sessions

Server startup
  → SQLite sessions loaded into memory
  → orphaned ChromaDB collections (not in SQLite) auto-deleted

Server shutdown
  → all active collections deleted
  → all temp folders cleaned up
  → all session records removed from SQLite
```

Sessions persist across page refreshes via `localStorage` (session ID) and `sessionStorage` (chat history). A server restart requires re-indexing. TTL-based cleanup was intentionally rejected in favour of explicit user-driven cleanup and the startup orphan sweep.

A single shared `PersistentClient` instance in `db.py` is used across all modules. Multiple `PersistentClient` instances cause orphan collection bugs — the singleton pattern is the fix.

---

## API reference

### Python service — `http://localhost:8000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/index` | Index a GitHub repo — body: `{ github_url }` |
| POST | `/upload` | Index a zip file — multipart form: `file` |
| POST | `/search` | Search — body: `{ query, session_id, top_k }` |
| POST | `/chat` | RAG chat (SSE) — body: `{ message, session_id, history }` |
| DELETE | `/session/{id}` | Close and clean up a session |

### Node.js service — `http://localhost:3001`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/search` | Exact match — body: `{ text, pattern, algorithm }` |

`algorithm` accepts `"kmp"` (default) or `"bm"` (Boyer-Moore). Returns match indices with line and column resolution.

---

## Known limitations

- **In-memory sessions** — server restart requires re-indexing
- **Single-process ChromaDB** — concurrent indexing may cause conflicts
- **Blocking indexing** — large repos hold the connection open until complete
- **No rate limiting** — repeated indexing can exhaust disk and memory
- **Regex-based chunker** — complex anonymous functions or decorators may not chunk correctly

---

## Roadmap

- [x] KMP + Boyer-Moore exact search with line/col resolution
- [x] Semantic search — `st-codesearch-distilroberta-base`
- [x] ChromaDB vector store — persistent, session-scoped, cosine similarity
- [x] GitHub URL + zip upload indexing
- [x] Hybrid scoring — semantic + keyword overlap
- [x] Dynamic thresholding
- [x] Session isolation — SQLite persistence + orphan sweep
- [x] React frontend — dark theme, search + results
- [x] RAG chat — streaming, [Chunk N] citations, resizable code panel
- [x] Docker Compose
- [ ] Deploy — HuggingFace Spaces + Vercel

---

## License

MIT