import json
import os
import re

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from groq import AsyncGroq, AuthenticationError, RateLimitError

from app.searcher import search_code
import app.state as state

router = APIRouter()
groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

MODEL = "llama-3.3-70b-versatile"
MAX_TOKENS = 2048
MAX_HISTORY = 10
MAX_MSG_LEN = 2000
MAX_QUERIES = 3
MAX_CHUNKS_PER_QUERY = 4
MAX_TOTAL_CHUNKS = 8


QUERY_PLANNER_SYSTEM = """\
You are a search query planner for a semantic code search engine.

Given a developer's question and conversation history, your job is to decide what to 
search for in the codebase to best answer the question.

Output ONLY a valid JSON object — no explanation, no markdown, no extra text. Format:
{
  "queries": ["query one", "query two"]
}

Rules:
- Output 1 to 3 search queries (strings).
- Each query should target a distinct aspect of the question.
- Queries should be short, specific, semantic descriptions of code behaviour 
  (e.g. "user authentication middleware", "session expiry cleanup", "JWT token validation").
- If the question is conversational/general (e.g. "thanks", "what is a closure?"), 
  output: {"queries": []}
- If the question is abstract/meta (e.g. "what is this project?", "how is the codebase structured?", 
  "what does this system do?", "architecture overview"), output: {"queries": []}
- Never output anything outside the JSON object.
"""


def build_answer_system(chunks: list[dict]) -> str:
    rules = """\
You are a knowledgeable and friendly code navigator helping a developer understand their codebase.
Your job is to guide, explain, and clarify — like a senior developer sitting next to them.

PERSONALITY:
- Warm but not over the top. Conversational, not robotic.
- No "great question!" on every message.

ANSWERING QUESTIONS:
- Primary focus is the codebase. Always prefer answering from the retrieved code chunks below.
- For general coding concepts that help the developer understand — answer from general knowledge.
  "What is a closure?" is fair game. "Write me a resume" is not.
- Trace through logic step by step when explaining.

USING CONTEXT:
- Retrieved code chunks are listed below.
- If a chunk was already discussed, reference it by filepath and line numbers rather than 
  repeating it: "as we saw in `src/auth/middleware.py` lines 23–45"
- Always cite chunks using [Chunk N] notation (e.g. [Chunk 1], [Chunk 2]).
- Never invent code, functions, or behaviour that isn't in the retrieved chunks or 
  conversation history.

MARKDOWN FORMATTING:
- Use **bold** for emphasis and inline identifiers.
- Use fenced code blocks ONLY for multi-line snippets.
- Use numbered lists for step-by-step, bullet points for items.

FOLLOW-UP AWARENESS:
- Resolve "this function" / "that file" from conversation history before answering.

WHEN CONTEXT IS NOT ENOUGH:
- Say "the chunks I have don't cover this fully, but based on what I can see..." 
  and answer what you can.

RETRIEVED CODE CONTEXT:
"""
    blocks = []
    for idx, chunk in enumerate(chunks, start=1):
        filepath = chunk["filepath"]
        start = chunk["start_line"]
        end = chunk["end_line"]
        score = chunk["score"]
        code = chunk["code"]
        parts = filepath.replace("\\", "/").split("/")
        short = "/".join(parts[-3:]) if len(parts) >= 3 else filepath
        blocks.append(
            f"[Chunk {idx}] {short} (lines {start}–{end}, score: {score:.3f}):\n"
            f"```\n{code}\n```"
        )
    return rules + "\n\n".join(blocks)


NO_CONTEXT_SYSTEM = """\
You are a knowledgeable software engineer and friendly code assistant helping a developer.
No relevant code chunks were found for this question.

You can answer:
- Questions about the project itself (purpose, architecture, structure, etc.)
- General software development concepts
- Questions unrelated to software development — politely refuse these.

PERSONALITY: Warm but not over the top. Conversational, not robotic.
MARKDOWN: Bold for identifiers, fenced blocks only for multi-line snippets.
"""


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _dedup_chunks(chunks: list[dict]) -> list[dict]:
    seen: dict[tuple, dict] = {}
    for chunk in chunks:
        key = (chunk["filepath"], chunk["start_line"])
        if key not in seen or chunk["score"] > seen[key]["score"]:
            seen[key] = chunk
    return sorted(seen.values(), key=lambda c: c["score"], reverse=True)


async def _plan_queries(
    message: str,
    history: list[dict],
) -> list[str]:
    history_text = ""
    for m in history[-6:]:
        role = m.get("role", "user")
        content = m.get("content", "")[:400]
        history_text += f"{role}: {content}\n"

    user_content = ""
    if history_text:
        user_content += f"Conversation so far:\n{history_text}\n"
    user_content += f"New question: {message}"

    try:
        resp = await groq_client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": QUERY_PLANNER_SYSTEM},
                {"role": "user", "content": user_content},
            ],
            max_tokens=128,
            temperature=0.0,
        )
        raw = resp.choices[0].message.content.strip()

        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            return [message]

        parsed = json.loads(json_match.group())
        queries = parsed.get("queries", [])

        if not isinstance(queries, list):
            return [message]

        queries = [str(q).strip() for q in queries if str(q).strip()]
        return queries[:MAX_QUERIES]

    except Exception:
        return [message]


async def _get_project_context(session_id: str) -> str:
    try:
        results = search_code("main entry point project structure architecture overview", session_id, k=5)
        if not results:
            return ""
        
        context = "INDEXED PROJECT CONTEXT:\n\n"
        for idx, chunk in enumerate(results, 1):
            filepath = chunk["filepath"]
            start = chunk["start_line"]
            end = chunk["end_line"]
            code = chunk["code"][:500]
            context += f"[File {idx}] {filepath} (lines {start}–{end}):\n```\n{code}\n```\n\n"
        return context
    except Exception:
        return ""


async def stream_response(req: "ChatRequest"):
    if req.session_id not in state.sessions:
        yield _sse(
            {
                "type": "error",
                "message": "Invalid or expired session. Please re-index your codebase.",
            }
        )
        return

    if len(req.message) > MAX_MSG_LEN:
        yield _sse(
            {
                "type": "error",
                "message": f"Message too long — keep questions under {MAX_MSG_LEN} characters.",
            }
        )
        return

    history_dicts = [m.dict() for m in req.history]
    queries = await _plan_queries(req.message, history_dicts)

    raw_chunks: list[dict] = []

    if queries:
        for q in queries:
            try:
                results = search_code(q, req.session_id, k=MAX_CHUNKS_PER_QUERY)
                raw_chunks.extend(results)
            except ValueError as e:
                yield _sse({"type": "error", "message": str(e)})
                return
            except Exception:
                pass

    chunks = _dedup_chunks(raw_chunks)[:MAX_TOTAL_CHUNKS]

    if chunks:
        yield _sse(
            {
                "type": "context",
                "chunks": [
                    {
                        "filepath": c["filepath"],
                        "start_line": c["start_line"],
                        "end_line": c["end_line"],
                        "score": c["score"],
                        "code": c["code"],
                    }
                    for c in chunks
                ],
            }
        )
        system_prompt = build_answer_system(chunks)
    else:
        project_context = await _get_project_context(req.session_id)
        system_prompt = NO_CONTEXT_SYSTEM
        if project_context:
            system_prompt += f"\n\n{project_context}"

    if queries:
        yield _sse({"type": "queries", "queries": queries})

    groq_messages = [
        {"role": "system", "content": system_prompt},
        *[{"role": m.role, "content": m.content} for m in req.history[-MAX_HISTORY:]],
        {"role": "user", "content": req.message},
    ]

    try:
        stream = await groq_client.chat.completions.create(
            model=MODEL,
            messages=groq_messages,
            max_tokens=MAX_TOKENS,
            stream=True,
            temperature=0.2,
        )

        async for chunk in stream:
            text = chunk.choices[0].delta.content
            if text:
                yield _sse({"type": "text", "content": text})

        yield _sse({"type": "done"})

    except AuthenticationError:
        yield _sse(
            {
                "type": "error",
                "message": "GROQ_API_KEY is missing or invalid. Check your .env file.",
            }
        )
    except RateLimitError:
        yield _sse(
            {
                "type": "error",
                "message": "Groq rate limit hit — wait a moment and try again or use search feature.",
            }
        )
    except Exception as e:
        yield _sse({"type": "error", "message": f"LLM error: {str(e)}"})


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: str
    history: list[HistoryMessage] = []


@router.post("/")
async def chat(req: ChatRequest):
    return StreamingResponse(
        stream_response(req),
        media_type="text/event-stream",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )