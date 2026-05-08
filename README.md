# Semantic Code Search

> Search any codebase using natural language. Paste a GitHub URL or upload a zip — get back the most semantically relevant code chunks with file paths and line numbers. Ask follow-up questions via a streaming RAG chat interface with source citations.

![Status](https://img.shields.io/badge/status-live-brightgreen)
![Python](https://img.shields.io/badge/python-3.10-blue)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

🔗 **Live:** [mahebabu-semlog.hf.space](https://semlogic.vercel.app/)

---

## What it does

Most code search tools only match exact strings. This engine understands **meaning**.

Search `"function that finds a pattern in text"` and it returns your KMP and Boyer-Moore implementations — even though those exact words don't appear anywhere in the code. It combines semantic embeddings with keyword overlap scoring, dynamic thresholding, and a RAG chat interface that lets you ask follow-up questions with streaming responses and inline code citations.

Two input modes are supported:

- **GitHub URL** — clones the repo at depth 1, indexes it, and returns a session ID
- **Zip upload** — extracts the archive locally and runs the same indexing pipeline

After indexing, users get access to two interfaces:

- **Search** — returns ranked code chunks with file paths, line numbers, and relevance scores
- **Chat** — a RAG-powered chat interface that retrieves relevant chunks and streams an answer with `[Chunk N]` citations. Clicking a cited chunk opens a slide-in code panel showing the exact lines.

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
                       ├── 1. enrich query ("Search for code that: <query>")
                       ├── 2. bi-encoder → top 20 candidates from ChromaDB
                       ├── 3. hybrid score (semantic 0.75 + keyword 0.25)
                       ├── 4. dynamic threshold filter
                       └── results returned with filepath + line numbers

 User chats  →  POST /chat (SSE stream)
                       │
                       ├── 1. query planner LLM call → 1–3 targeted search queries
                       ├── 2. retrieve top chunks per query via search pipeline
                       ├── 3. deduplicate + re-rank by score
                       ├── 4. inject top 8 chunks into system prompt with [Chunk N] labels
                       ├── 5. stream response via Groq (llama-3.3-70b-versatile)
                       └── SSE stream → frontend with real-time citation highlighting
```

Every user gets a unique `session_id` on indexing. All searches and chats are scoped to that session — no data leaks between concurrent users.

---

## Tech stack

| Layer | Technology |
|---|---|
| Semantic search API | Python 3.10, FastAPI, uvicorn |
| Bi-encoder model | `flax-sentence-embeddings/st-codesearch-distilroberta-base` |
| LLM inference | Groq API — `llama-3.3-70b-versatile` |
| Vector store | ChromaDB (persistent, session-scoped, cosine similarity) |
| Session persistence | SQLite via `session_store.py` |
| Frontend | React 19, Vite, React Router v7, Axios |
| Containerisation | Docker Compose with named volumes |

### Model decisions

**`st-codesearch-distilroberta-base`** was trained on the CodeSearchNet dataset, purpose-built for natural language → code retrieval. Several alternatives were evaluated:

- `bge-small-en-v1.5` and `mDeBERTa-v3` — general-purpose models that degrade on code-specific semantics
- `codebert-base` — no built-in pooling layer, requires custom mean-pooling, and weighs ~500MB

This model is ~330MB, fast on CPU, and produces strong results on code-specific queries without fine-tuning.

A cross-encoder reranker (`ms-marco-MiniLM-L-6-v2`) was evaluated and deliberately removed. It is trained on web passage pairs, not code, and produces near-random relevance scores on code chunks — degrading retrieval quality rather than improving it. The `reranker.py` file remains in the repo as documentation of this decision.

ChromaDB collections are created with `hnsw:space: cosine`. The default L2 distance would make `1 - distance` mathematically incorrect and produce negative similarity scores — cosine is required for correct normalisation.

---

## Project structure

```
semantic-code-search/
│
├── backend-python/                   ← Semantic search + RAG chat service
│   ├── app/
│   │   ├── main.py                   ← FastAPI entry point, lifespan cleanup, orphan sweep
│   │   ├── db.py                     ← Single shared ChromaDB PersistentClient singleton
│   │   ├── state.py                  ← In-memory session store, loads from SQLite on startup
│   │   ├── session_store.py          ← SQLite-backed session persistence (init, save, load, delete)
│   │   ├── embeddings.py             ← Model loading + single/batch inference
│   │   ├── chunker.py                ← Function-level chunker + fixed-size fallback
│   │   ├── indexer.py                ← File walker, skip lists, enrichment, batch embed + upsert
│   │   ├── searcher.py               ← Hybrid scoring pipeline + dynamic threshold
│   │   ├── reranker.py               ← Cross-encoder reranker (evaluated, disabled)
│   │   ├── github.py                 ← git clone (depth=1) + temp folder cleanup
│   │   ├── uploader.py               ← Zip extraction to temp folder
│   │   └── routes/
│   │       ├── index.py              ← POST /index
│   │       ├── upload.py             ← POST /upload
│   │       ├── search.py             ← POST /search
│   │       ├── embed.py              ← POST /embed/single, /embed/batch
│   │       ├── sessions.py           ← DELETE /session/{id}
│   │       └── chat.py               ← POST /chat — SSE streaming, Groq, RAG pipeline
│   ├── requirements.txt
│   └── DockerFile
│
└── frontend/                         ← React SPA
    ├── src/
    │   ├── App.jsx                   ← React Router setup — 3 routes: /, /search, /chat
    │   ├── api/client.js             ← All API calls (index, upload, search, chat, session delete)
    │   ├── index.css                 ← Global dark theme tokens + component styles
    │   ├── pages/
    │   │   ├── IndexPage.jsx         ← GitHub URL + zip upload tabs + animated loading messages
    │   │   ├── SearchPage.jsx        ← Search bar + result cards + localStorage cache
    │   │   └── ChatPage.jsx          ← Streaming chat, history, resizable code panel, abort
    │   └── components/
    │       ├── ResultCard.jsx        ← Score badge, filepath, line range, scrollable code block
    │       ├── ChatMessage.jsx       ← Markdown rendering via react-markdown + citation parsing
    │       ├── CodePanel.jsx         ← Slide-in panel with line-number gutters, Esc to close
    │       └── SourcePills.jsx       ← Citation pills with active/cited highlight states
    ├── index.html
    ├── nginx.conf                    ← Reverse-proxy config for Docker deployment
    ├── DockerFile
    └── package.json
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

Open `.env` and fill in your keys:

```env
GROQ_API_KEY=your_groq_key
HF_TOKEN=your_huggingface_token
```

Optionally add a second Groq key for round-robin rotation under load:

```env
GROQ_API_KEY2=your_second_groq_key
```

### 3. Start the Python backend

```bash
cd backend-python
conda create -n code-search python=3.10
conda activate code-search
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The first run downloads the embedding model (~330MB) to `.cache/`. Subsequent starts are fast — the model is read from disk.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Docker (full stack)

```bash
docker-compose up --build
```

Spins up the Python backend and React frontend. Named volumes persist the ChromaDB data and HuggingFace model cache between container restarts. The frontend is served via nginx on port 80 with a reverse proxy to the backend.

---

## How the retrieval pipeline works

### Chunking

Files are split at function boundaries using language-aware regex:

- **Python** — detects `def` and `async def`, uses indentation tracking to find where each function ends. Handles nested functions correctly by comparing indent levels against the definition's indent depth.
- **JavaScript / TypeScript** — detects `function` declarations, arrow functions assigned to variables, and `const`/`let`/`var` with function expressions. Uses brace depth counting to find the closing brace.
- **All other supported languages** (Java, Go, Rust, C/C++, Swift, PHP, Ruby, C#) — use the brace-based chunker which recognises common method and function signatures.

Files with no detected function boundaries fall back to fixed 25-line chunks so no file is silently skipped. Chunks are capped at 60 lines and split further if exceeded. Test files, spec files, and noisy directories (`node_modules`, `dist`, `__pycache__`, `venv`, `build`, `coverage`, `docs`, `fixtures`, etc.) are excluded at walk time to reduce noise in the index.

### Chunk enrichment

Before embedding, every chunk is prefixed with a natural language header:

```
File: kmp.js (lines 14–38)

function kmpSearch(text, pattern) {
  ...
}
```

This prefix is applied **at index time**, aligning the document format with how the bi-encoder model was trained on NL + code pairs. Queries are prefixed with `"Search for code that: <query>"` at search time to match this asymmetry.

Enrichment must happen before embedding — applying it only at query time produces a document-query embedding mismatch that measurably degrades retrieval quality. Both sides of the pair must be formatted consistently.

### Hybrid scoring

```
combined_score = 0.75 × semantic_score + 0.25 × keyword_overlap
```

- **`semantic_score`** — cosine similarity from ChromaDB, normalised as `max(0.0, 1 - distance)`. ChromaDB returns cosine distances, not similarities, so the conversion is necessary.
- **`keyword_overlap`** — Jaccard-style word overlap between query tokens and `raw_code` from chunk metadata, not the enriched document. Using the enriched doc would inflate scores via file path prefix matches that appear on every chunk regardless of content.

The 75/25 weighting was chosen empirically. Semantic score alone misses queries with specific identifier names. Keyword overlap alone degrades on natural language queries. The combined score handles both cases well.

### Dynamic thresholding

```
threshold = max(0.2, 0.5 × max_score)
```

Rather than a fixed cutoff, the threshold adapts to each query's score distribution. A query with a strong best match raises the bar for weaker candidates. Results below `MIN_CONFIDENT_SCORE = 0.10` are dropped entirely before thresholding applies. This prevents low-confidence junk results from surfacing on queries that don't match anything well.

### RAG chat pipeline

1. **Query planning** — a fast, zero-temperature LLM call converts the user's question and recent conversation history into 1–3 targeted search queries. Conversational turns (`"thanks"`, `"what is a closure?"`) and abstract meta-questions (`"what does this project do?"`) return an empty query list, skipping retrieval and answering from project context or general knowledge instead.
2. **Multi-query retrieval** — each generated query is run through the full hybrid search pipeline independently, returning up to 4 chunks per query.
3. **Deduplication** — chunks appearing across multiple query results are deduplicated by `(filepath, start_line)`, keeping the highest score. Total chunks are capped at 8.
4. **Context injection** — chunks are injected into the system prompt with `[Chunk N]` labels that include filepath, line range, and relevance score. The LLM is instructed to cite chunks inline using this notation.
5. **Streaming** — the response is streamed via Groq's async API and forwarded to the browser as SSE events. The frontend incrementally parses `[Chunk N]` references as tokens arrive and highlights the matching source pills in real time.
6. **No-context fallback** — when no chunks meet the confidence threshold, a broad project-context search is run and the LLM falls back to general coding knowledge rather than refusing. The answer is clearly framed as coming from general knowledge rather than indexed code.

History is compressed for long conversations: messages beyond the most recent 4 are summarised into a single system message to stay within context window limits while preserving conversational continuity.

---

## Session lifecycle

```
POST /index or /upload
  → uuid4 session_id generated
  → repo cloned / zip extracted to /tmp/codesearch_{id}/
  → files walked, chunks generated, enriched, embedded in batch
  → embeddings upserted to ChromaDB collection: code_{session_id}
  → session metadata saved to SQLite + in-memory state.sessions dict
  → session_id + indexed count returned to client

POST /search or POST /chat
  → session_id validated against state.sessions
  → ChromaDB collection looked up by name: code_{session_id}
  → retrieval and LLM calls fully scoped to this collection

DELETE /session/{session_id}
  → ChromaDB collection deleted (vector segment folder removed from disk)
  → temp source folder deleted from /tmp/
  → session record removed from SQLite
  → session removed from in-memory state.sessions

Server startup
  → SQLite sessions loaded into state.sessions
  → ChromaDB collections enumerated; any collection not present in SQLite is deleted (orphan sweep)

Server shutdown (FastAPI lifespan handler)
  → all active collections deleted from ChromaDB
  → all temp source folders cleaned up from /tmp/
  → all session records removed from SQLite
  → state.sessions cleared
```

Sessions persist across page refreshes via `localStorage` (session ID and indexed chunk count) and `sessionStorage` (chat message history, keyed by session ID). A server restart wipes in-memory state — users must re-index. TTL-based auto-expiry was intentionally rejected in favour of explicit user-driven cleanup (the exit session button) combined with the startup orphan sweep for anything left over.

**Important:** A single shared `PersistentClient` instance is used across all modules via `db.py`. Multiple `PersistentClient` instances pointing at the same path cause orphaned collection bugs and SQLite file lock conflicts. The singleton pattern in `db.py` is required, not optional.

---

## API reference

### Python service — `http://localhost:8000`

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/health` | Health check | — |
| POST | `/index` | Index a GitHub repo | `{ github_url }` |
| POST | `/upload` | Index a zip file | multipart: `file` |
| POST | `/search` | Semantic search | `{ query, session_id, top_k }` |
| POST | `/chat` | RAG chat stream (SSE) | `{ message, session_id, history }` |
| DELETE | `/session/{id}` | Close and clean up session | — |
| POST | `/embed/single` | Embed a single text string | `{ text }` |
| POST | `/embed/batch` | Embed multiple text strings | `{ texts }` |

#### Chat SSE event types

```json
{ "type": "context", "chunks": [...] }    // retrieved code chunks — arrives before LLM starts
{ "type": "queries",  "queries": [...] }  // search queries generated by the planner
{ "type": "text",    "content": "..."  }  // single streamed LLM token
{ "type": "done"                       }  // stream complete
{ "type": "error",   "message": "..."  }  // error message — should be displayed to the user
```

---

## Known limitations

- **In-memory sessions** — server restart requires re-indexing; there is no durable hot-reload of in-memory state between process restarts
- **Single-process ChromaDB** — concurrent indexing on the same path can cause SQLite lock conflicts inside ChromaDB
- **Blocking indexing** — large repos hold the HTTP connection open until indexing completes; very large codebases (>2000 chunks after the hard cap) return a 400 error
- **No rate limiting** — repeated indexing calls can exhaust disk space and memory; the 2000-chunk hard cap limits damage per session but does not prevent abuse across sessions
- **Regex-based chunker** — heavily decorated functions, complex anonymous callbacks, or unconventional formatting may not chunk cleanly and silently fall back to fixed-size splits

---

## Roadmap

- [x] Semantic search with `st-codesearch-distilroberta-base`
- [x] ChromaDB vector store — persistent, session-scoped, cosine similarity
- [x] GitHub URL + zip upload indexing
- [x] Hybrid scoring — semantic + keyword overlap
- [x] Dynamic thresholding
- [x] Session isolation — SQLite persistence + startup orphan sweep
- [x] React frontend — dark theme, search + result cards
- [x] RAG chat — streaming responses, `[Chunk N]` citations, resizable code panel
- [x] Query planner — multi-query retrieval for complex questions
- [x] Docker Compose
- [x] Deployed to HuggingFace Spaces

---

## License

MIT