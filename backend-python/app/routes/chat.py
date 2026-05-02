import json
import os

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from groq import AsyncGroq, AuthenticationError, RateLimitError

from app.searcher import search_code
import app.state as state

router = APIRouter()
groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

MODEL = "llama-3.3-70b-versatile"
MAX_TOKENS = 1024
MAX_HISTORY = 10
MAX_MSG_LEN = 2000


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: str
    history: list[HistoryMessage] = []


def build_system_prompt(chunks: list[dict]) -> str:
    rules = """\
You are a knowledgeable and friendly code navigator helping a developer understand their codebase. 
Your job is to guide, explain, and clarify — like a senior developer sitting next to them and 
walking them through the code patiently.

PERSONALITY:
- Warm but not over the top. A light personality is fine — occasional encouragement, 
  genuine curiosity — but never sycophantic. No "great question!" on every message.
- Be conversational, not robotic. Write like you're talking to a colleague.
- When something is genuinely interesting or tricky, you can say so.

ANSWERING QUESTIONS:
- Primary focus is the codebase. Always prefer answering from the retrieved code chunks below.
- If a question is about general coding concepts, programming, or something that helps the 
  developer understand the codebase better — you can answer from general knowledge. 
  Use judgment. "What is a closure?" is fair game. "Write me a resume" is not.
- If the retrieved context partially answers the question, answer what you can and clearly 
  flag what's missing — don't stop and refuse.
- Trace through logic step by step when explaining. Don't just tell — show the path.

USING CONTEXT:
- You will receive retrieved code chunks at the bottom of this prompt. These are the most 
  relevant parts of the codebase for the user's question.
- If a chunk has already been discussed in the conversation, do NOT repeat it. Reference it 
  by filepath and line numbers instead: "as we saw in `src/auth/middleware.py` lines 23–45"
- Always cite with full filepath and line numbers when referencing code: 
  `src/auth/middleware.py` lines 23–45
- Never invent code, functions, or behavior that isn't in the retrieved chunks or 
  the conversation history.

FOLLOW-UP AWARENESS:
- Pay close attention to the conversation history. If the user says "this function" or 
  "that file" or "what about that part", resolve what they mean from prior messages 
  before answering. Never ask "which one do you mean?" if the history makes it obvious.

WHEN CONTEXT IS NOT ENOUGH:
- Be honest. Say something like "the chunks I have don't cover this fully, but based on 
  what I can see..." and answer what you can. 
- Suggest the user rephrase or ask about a specific file/function if you think 
  a better query would surface more relevant code.

RETRIEVED CODE CONTEXT:
"""
    context_blocks = []
    for idx, chunk in enumerate(chunks, start=1):
        filepath = chunk["filepath"]
        start = chunk["start_line"]
        end = chunk["end_line"]
        score = chunk["score"]
        code = chunk["code"]

        parts = filepath.replace("\\", "/").split("/")
        short_path = "/".join(parts[-3:]) if len(parts) >= 3 else filepath

        context_blocks.append(
            f"Chunk {idx} {short_path} (lines {start}-{end}, score: {score:.3f}):\n"
            f"```\n{code}\n```"
        )
    return rules + "\n\n".join(context_blocks)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def stream_response(req: ChatRequest):
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
                "message": (
                    f"Message too long — please keep questions "
                    f"under {MAX_MSG_LEN} characters."
                ),
            }
        )
        return
    try:
        chunks = search_code(req.message, req.session_id, k=6)
    except ValueError as e:
        yield _sse({"type": "error", "message": str(e)})
        return
    except Exception as e:
        yield _sse({"type": "error", "message": f"Retrieval failed: {str(e)}"})
        return

    if not chunks:
        yield _sse(
            {
                "type": "text",
                "content": (
                    "I couldn't find anything relevant in the indexed codebase "
                    "for that question. Try asking about a specific function, "
                    "file, or feature."
                ),
            }
        )
        yield _sse({"type": "done"})
        return

    yield _sse(
        {
            "type": "context",
            "chunks": [
                {
                    "filepath": c["filepath"],
                    "start_line": c["start_line"],
                    "end_line": c["end_line"],
                    "score": c["score"],
                }
                for c in chunks
            ],
        }
    )

    system_prompt = build_system_prompt(chunks)
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
                "message": "Groq rate limit hit — wait a moment and try again.",
            }
        )
    except Exception as e:
        yield _sse({"type": "error", "message": f"LLM error: {str(e)}"})


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
