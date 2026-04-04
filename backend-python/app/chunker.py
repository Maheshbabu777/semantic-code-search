import re

def chunk_file(filepath: str) -> list[dict]:
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    chunks = []
    current_chunk = []
    start_line = 0
    in_function = False

    function_pattern = re.compile(
        r"^\s*(def |async def |function |let |const |var)(\w+)\s*[\(=]"
    )

    for i, line in enumerate(lines):
        if function_pattern.match(line):
            if current_chunk and in_function:
                chunks.append(
                    {
                        "code": "".join(current_chunk).strip(),
                        "start_line": start_line + 1,
                        "end_line": i,
                        "filepath": filepath,
                    }
                )
            current_chunk = [line]
            start_line = i
            in_function = True
        elif in_function:
            current_chunk.append(line)

    if current_chunk and in_function:
        chunks.append(
            {
                "code": "".join(current_chunk).strip(),
                "start_line": start_line + 1,
                "end_line": len(lines),
                "filepath": filepath,
            }
        )

    if not chunks:
        chunk_size = 25
        for i in range(0, len(lines), chunk_size):
            chunk = lines[i : i + chunk_size]
            chunks.append(
                {
                    "code": "".join(chunk).strip(),
                    "start_line": i + 1,
                    "end_line": min(i + chunk_size, len(lines)),
                    "filepath": filepath,
                }
            )

    return chunks
