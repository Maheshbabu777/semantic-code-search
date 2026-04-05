from pathlib import Path
import sys
import os
import pytest

# Ensure backend-python is importable when running pytest directly
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.indexer import index_codebase

# Prefer env var: CODEBASE_PATH, fallback to project root
CODEBASE_PATH = Path(os.getenv("CODEBASE_PATH", str(PROJECT_ROOT))).resolve()


@pytest.mark.integration
def test_index_existing_codebase():
    if not CODEBASE_PATH.exists():
        pytest.skip(f"CODEBASE_PATH does not exist: {CODEBASE_PATH}")
    index_codebase(str(CODEBASE_PATH))
