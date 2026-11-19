# ==============================================================================
# SkillVault AI Microservice - Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build & Pre-cache FlashRank Model
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Pre-download FlashRank & FastEmbed ONNX models during build to guarantee 0ms cold-starts
RUN python -c "from flashrank import Ranker; Ranker(model_name='ms-marco-MiniLM-L-12-v2', cache_dir='/build/models')" && \
    python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='nomic-ai/nomic-embed-text-v1.5', cache_dir='/build/models')"

# Stage 2: Minimal Hardened Runtime
FROM python:3.11-slim AS runner

WORKDIR /app

RUN groupadd -g 1001 appgroup && useradd -u 1001 -g appgroup -s /bin/sh appuser

COPY --from=builder /root/.local /home/appuser/.local
COPY --from=builder /build/models /tmp/models
COPY . .

ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    MODEL_CACHE_DIR=/tmp/models \
    PORT=8000

USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
