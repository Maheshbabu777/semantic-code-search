import subprocess
import tempfile
import shutil
import os

def clone_repo(github_url: str) -> str:
    tmp_dir = tempfile.mkdtemp()

    result = subprocess.run(
        ["git","clone","--depth=1",github_url,tmp_dir],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        shutil.rmtree(tmp_dir)
        raise ValueError(f"Git clone failed: {result.stderr.strip()}")
    
    return tmp_dir

def cleanup_repo(folder_path:str):
    if folder_path and os.path.exists(folder_path):
        shutil.rmtree(folder_path, ignore_errors=True)