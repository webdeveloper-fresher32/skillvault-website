import os
import json
from typing import List, Dict, Any
import asyncpg
from pgvector.asyncpg import register_vector
from flashrank import Ranker, RerankRequest
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:0000@localhost:5432/skillvault_local")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/tmp/models")


class HybridRAGRetriever:
    """
    Production Dual Hybrid Retriever:
    1. Parallel HNSW (Dense Top-25) + GIN BM25 (Sparse Top-25).
    2. In-SQL Reciprocal Rank Fusion (RRF k=60) yielding Top-20.
    3. In-Process FlashRank Cross-Encoder (MiniLM-L-12, ~22ms) yielding Top-5.
    """

    def __init__(self, db_url: str = DATABASE_URL):
        self.db_url = db_url
        self.pool = None
        self.ollama = AsyncOpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")
        
        # Local in-process Cross-Encoder (zero cloud latency, $0 cost)
        print("🧠 Initializing FlashRank local cross-encoder...")
        self.ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2", cache_dir=MODEL_CACHE_DIR)
        print("   ✅ FlashRank ready.")

    async def initialize(self):
        if not self.pool:
            self.pool = await asyncpg.create_pool(self.db_url, min_size=2, max_size=10)

    async def embed_query(self, query: str) -> List[float]:
        """Embed search query with 'search_query: ' prefix for nomic-embed-text."""
        formatted_query = f"search_query: {query}"
        response = await self.ollama.embeddings.create(
            model=EMBEDDING_MODEL,
            input=formatted_query
        )
        return response.data[0].embedding

    async def search(
        self,
        query: str,
        tenant_id: str = "00000000-0000-0000-0000-000000000001",
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        await self.initialize()

        query_embedding = await self.embed_query(query)

        # Dual Parallel Dense + Sparse + Reciprocal Rank Fusion (k=60)
        hybrid_query = """
        WITH dense_search AS (
            SELECT 
                id, 
                content, 
                metadata, 
                document_id,
                ROW_NUMBER() OVER (ORDER BY embedding <=> $2::vector) as dense_rank
            FROM document_chunks
            WHERE organization_id = $1::uuid
            ORDER BY embedding <=> $2::vector
            LIMIT 25
        ),
        sparse_search AS (
            SELECT 
                id, 
                content, 
                metadata, 
                document_id,
                ROW_NUMBER() OVER (ORDER BY ts_rank_cd(tsv_content, plainto_tsquery('english', $3)) DESC) as sparse_rank
            FROM document_chunks
            WHERE organization_id = $1::uuid AND tsv_content @@ plainto_tsquery('english', $3)
            ORDER BY ts_rank_cd(tsv_content, plainto_tsquery('english', $3)) DESC
            LIMIT 25
        ),
        fused_results AS (
            SELECT 
                COALESCE(d.id, s.id) as chunk_id,
                COALESCE(d.content, s.content) as content,
                COALESCE(d.metadata, s.metadata) as metadata,
                COALESCE(d.document_id, s.document_id) as document_id,
                d.dense_rank,
                s.sparse_rank,
                COALESCE(1.0 / (60 + d.dense_rank), 0.0) + 
                COALESCE(1.0 / (60 + s.sparse_rank), 0.0) as rrf_score
            FROM dense_search d
            FULL OUTER JOIN sparse_search s ON d.id = s.id
        )
        SELECT chunk_id, content, metadata, document_id, dense_rank, sparse_rank, rrf_score
        FROM fused_results
        ORDER BY rrf_score DESC
        LIMIT 20;
        """

        async with self.pool.acquire() as conn:
            await register_vector(conn)
            rows = await conn.fetch(
                hybrid_query,
                tenant_id,
                query_embedding,
                query
            )

        if not rows:
            return []

        # Prepare passages for FlashRank cross-encoder reranking
        passages = [
            {
                "id": str(r["chunk_id"]),
                "text": r["content"],
                "meta": {
                    "document_id": str(r["document_id"]),
                    "metadata": json.loads(r["metadata"]) if isinstance(r["metadata"], str) else r["metadata"],
                    "dense_rank": r["dense_rank"],
                    "sparse_rank": r["sparse_rank"],
                    "rrf_score": float(r["rrf_score"])
                }
            }
            for r in rows
        ]

        # In-process cross-encoder scoring
        rerank_req = RerankRequest(query=query, passages=passages)
        reranked = self.ranker.rerank(rerank_req)

        # Return Top-K highest precision grounded passages
        return reranked[:top_k]

    async def close(self):
        if self.pool:
            await self.pool.close()