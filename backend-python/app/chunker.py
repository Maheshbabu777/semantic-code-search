import os
import re

MAX_CHUNK_LINES = 60
FALLBACK_SIZE = 25
MIN_CHUNK_LINES = 3

_INDENT_EXTS = {".py"}
_BRACE_EXTS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".go",
    ".rs",
    ".c",
    ".cpp",
    ".cs",
    ".h",
    ".swift",
    ".php",
}

_PY_FUNC_RE = re.compile(r"^(\s*)(async\s+)?def\s+\w+\s*\(")

_BRACE_FUNC_RE = re.compile(
    r"^\s*"
    r"("
    r"(export\s+)?(default\s+)?async\s+function\s+\w+"
    r"|function\s+\w+"
    r"|(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?(\([^)]*\)|[a-zA-Z_]\w*)\s*(=>|\{)"
    r"|(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?function"
    r"|(\b(public|private|protected|static|final|override|virtual|inline)\b\s+)*"
    r"[\w<>\[\]*&]+\s+\w+\s*\("
    r"|func\s+(\(\s*\w+\s+\*?\w+\s*\)\s+)?\w+\s*\("
    r")"
)


def _make_chunk(lines: list[str], start_0idx: int, filepath: str) -> dict:
    return {
        "code": "".join(lines).strip(),
        "start_line": start_0idx + 1,
        "end_line": start_0idx + len(lines),
        "filepath": filepath,
    }


def _split_oversized(chunk: dict, filepath: str) -> list[dict]:
    lines = chunk["code"].splitlines(keepends=True)
    if len(lines) <= MAX_CHUNK_LINES:
        return [chunk]

    result = []
    base_line = chunk["start_line"] - 1
    for i in range(0, len(lines), MAX_CHUNK_LINES):
        block = lines[i : i + MAX_CHUNK_LINES]
        result.append(_make_chunk(block, base_line + i, filepath))
    return result


def _indent_level(line: str) -> int:
    expanded = line.expandtabs(4)
    return len(expanded) - len(expanded.lstrip())


def _chunk_python(lines: list[str], filepath: str) -> list[dict]:
    chunks = []
    i = 0
    n = len(lines)

    preamble = []
    while i < n and not _PY_FUNC_RE.match(lines[i]):
        preamble.append(lines[i])
        i += 1
    if "".join(preamble).strip():
        for sub in _split_oversized(_make_chunk(preamble, 0, filepath), filepath):
            if sub["code"]:
                chunks.append(sub)

    while i < n:
        line = lines[i]
        m = _PY_FUNC_RE.match(line)
        if not m:
            i += 1
            continue

        def_indent = len(m.group(1).expandtabs(4))
        start_0idx = i
        body = [line]
        i += 1

        while i < n:
            curr = lines[i]
            stripped = curr.strip()

            if not stripped or stripped.startswith("#"):
                body.append(curr)
                i += 1
                continue

            curr_indent = _indent_level(curr)

            if curr_indent <= def_indent:
                if _PY_FUNC_RE.match(curr):
                    break
                if curr_indent < def_indent:
                    break
                if def_indent == 0:
                    break

            body.append(curr)
            i += 1

        chunk = _make_chunk(body, start_0idx, filepath)
        for sub in _split_oversized(chunk, filepath):
            if sub["code"]:
                chunks.append(sub)

    return chunks


def _chunk_braces(lines: list[str], filepath: str) -> list[dict]:
    chunks = []
    i = 0
    n = len(lines)

    preamble = []
    while i < n and not _BRACE_FUNC_RE.match(lines[i]):
        preamble.append(lines[i])
        i += 1
    if "".join(preamble).strip():
        for sub in _split_oversized(_make_chunk(preamble, 0, filepath), filepath):
            if sub["code"]:
                chunks.append(sub)

    while i < n:
        if not _BRACE_FUNC_RE.match(lines[i]):
            i += 1
            continue

        start_0idx = i
        body = []
        depth = 0
        found_open = False

        while i < n:
            line = lines[i]
            body.append(line)

            depth += line.count("{") - line.count("}")
            found_open = found_open or ("{" in line)
            i += 1

            if found_open and depth <= 0:
                break

        if body:
            chunk = _make_chunk(body, start_0idx, filepath)
            for sub in _split_oversized(chunk, filepath):
                if sub["code"]:
                    chunks.append(sub)

    return chunks


def _fallback_chunks(lines: list[str], filepath: str) -> list[dict]:
    chunks = []
    for i in range(0, len(lines), FALLBACK_SIZE):
        block = lines[i : i + FALLBACK_SIZE]
        c = _make_chunk(block, i, filepath)
        if c["code"]:
            chunks.append(c)
    return chunks


def chunk_file(filepath: str) -> list[dict]:
    ext = os.path.splitext(filepath)[1].lower()

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except OSError:
        return []

    if not lines:
        return []

    if ext in _INDENT_EXTS:
        chunks = _chunk_python(lines, filepath)
    elif ext in _BRACE_EXTS:
        chunks = _chunk_braces(lines, filepath)
    else:
        chunks = []

    chunks = [c for c in chunks if c["code"].strip()]

    chunks = [c for c in chunks if len(c["code"].splitlines()) >= MIN_CHUNK_LINES]

    if not chunks:
        chunks = _fallback_chunks(lines, filepath)

    return chunks
