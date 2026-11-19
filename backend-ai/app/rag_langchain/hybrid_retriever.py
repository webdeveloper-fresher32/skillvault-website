import os
import json
from typing import List, Dict, Any, Optional
import asyncpg
from pgvector.asyncpg import register_vector
from flashrank import Ranker, RerankRequest
from pydantic import Field, PrivateAttr
from dotenv import load_dotenv

from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.callbacks import AsyncCallbackManagerForRetrieverRun, CallbackManagerForRetrieverRun
from langchain_core.embeddings import Embeddings

from app.core.llm import get_embeddings_model

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:0000@localhost:5432/skillvault_local")
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/tmp/models")
DEFAULT_TENANT_ID = os.getenv("DEFAULT_TENANT_ID", "00000000-0000-0000-0000-000000000001")


class HybridRAGRetriever(BaseRetriever):
    """
    Production LangChain Hybrid RAG Retriever:
    1. Dense Embeddings via LangChain Embeddings (Ollama nomic-embed-text or Cloud API).
    2. Parallel HNSW (Dense Top-25) + GIN BM25 (Sparse Top-25) in PostgreSQL.
    3. In-SQL Reciprocal Rank Fusion (RRF k=60) yielding Top-20 candidates.
    4. In-Process FlashRank Cross-Encoder (MiniLM-L-12, ~22ms) yielding Top-K grounded passages.
    5. Standard LangChain BaseRetriever interface (ainvoke / invoke) returning List[Document].
    """

    db_url: str = Field(default_factory=lambda: DATABASE_URL)
    tenant_id: str = Field(default=DEFAULT_TENANT_ID)
    top_k: int = Field(default=5)

    _pool: Optional[asyncpg.Pool] = PrivateAttr(default=None)
    _ranker: Optional[Ranker] = PrivateAttr(default=None)
    _embeddings: Optional[Embeddings] = PrivateAttr(default=None)

    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        self._embeddings = get_embeddings_model()

    async def initialize(self):
        """Initialize PostgreSQL connection pool and FlashRank cross-encoder model."""
        if not self._pool:
            self._pool = await asyncpg.create_pool(self.db_url, min_size=2, max_size=10)
        if not self._ranker:
            print("🧠 [LangChain Retriever] Initializing FlashRank local cross-encoder...")
            self._ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2", cache_dir=MODEL_CACHE_DIR)
            print("   ✅ FlashRank ready.")
        if not self._embeddings:
            self._embeddings = get_embeddings_model()

    async def embed_query(self, query: str) -> List[float]:
        """Generate dense query embedding using LangChain Embeddings with contrastive prefix."""
        if not self._embeddings:
            self._embeddings = get_embeddings_model()
        formatted_query = f"search_query: {query}"
        return await self._embeddings.aembed_query(formatted_query)

    async def _aget_relevant_documents(
        self,
        query: str,
        *,
        run_manager: Optional[AsyncCallbackManagerForRetrieverRun] = None,
        **kwargs: Any
    ) -> List[Document]:
        """LangChain async retrieval entry point."""
        if not self._pool or not self._ranker:
            await self.initialize()

        tenant = kwargs.get("tenant_id", self.tenant_id)
        k = kwargs.get("top_k", self.top_k)

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

        async with self._pool.acquire() as conn:
            await register_vector(conn)
            rows = await conn.fetch(
                hybrid_query,
                tenant,
                query_embedding,
                query
            )

        if not rows:
            return []

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

        rerank_req = RerankRequest(query=query, passages=passages)
        reranked = self._ranker.rerank(rerank_req)
        top_passages = reranked[:k]

        documents: List[Document] = []
        for p in top_passages:
            meta = p.get("meta", {})
            doc_meta = meta.get("metadata", {})
            doc = Document(
                page_content=p.get("text", ""),
                metadata={
                    "chunk_id": p.get("id"),
                    "document_id": meta.get("document_id"),
                    "document_title": doc_meta.get("document_title", "Document"),
                    "section_header": doc_meta.get("section_header", "Section"),
                    "score": round(float(p.get("score", 0.0)), 4),
                    "rrf_score": round(float(meta.get("rrf_score", 0.0)), 5),
                    "dense_rank": meta.get("dense_rank"),
                    "sparse_rank": meta.get("sparse_rank"),
                    "metadata": doc_meta
                }
            )
            documents.append(doc)

        return documents

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: Optional[CallbackManagerForRetrieverRun] = None
    ) -> List[Document]:
        import asyncio
        return asyncio.run(self._aget_relevant_documents(query))

    async def search(
        self,
        query: str,
        tenant_id: str = DEFAULT_TENANT_ID,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Backwards-compatible search method returning the dict structure
        expected by existing tests and API callers.
        """
        docs = await self._aget_relevant_documents(query=query, tenant_id=tenant_id, top_k=top_k)
        return [
            {
                "id": doc.metadata.get("chunk_id"),
                "text": doc.page_content,
                "score": doc.metadata.get("score", 0.0),
                "meta": {
                    "document_id": doc.metadata.get("document_id"),
                    "metadata": doc.metadata.get("metadata", {}),
                    "dense_rank": doc.metadata.get("dense_rank"),
                    "sparse_rank": doc.metadata.get("sparse_rank"),
                    "rrf_score": doc.metadata.get("rrf_score", 0.0)
                }
            }
            for doc in docs
        ]

    async def close(self):
        """Gracefully close PostgreSQL connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
