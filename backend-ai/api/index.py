import os
import sys

# Ensure writable temporary directories for Vercel Serverless environment
os.environ.setdefault("MODEL_CACHE_DIR", "/tmp/models")
os.environ.setdefault("HF_HOME", "/tmp/huggingface")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp")

try:
    os.makedirs("/tmp/models", exist_ok=True)
    os.makedirs("/tmp/huggingface", exist_ok=True)
except Exception:
    pass

# Add backend-ai root directory to sys.path so app imports resolve on Vercel
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from app.main import app
