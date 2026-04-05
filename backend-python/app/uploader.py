import zipfile 
import tempfile
import os

def extract_upload(zip_path: str) -> str:
    tmp_dir = tempfile.mkdtemp(prefix="codesearch_")

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(tmp_dir)
    
    return tmp_dir