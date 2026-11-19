import os
import json
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

from langchain_core.language_models.chat_models import BaseChatModel

# Exclusively import LangChain Components for active Chat Service
from app.rag_langchain.hybrid_retriever import HybridRAGRetriever
from app.rag_langchain.chain import create_rag_chain
from app.core.llm import get_chat_model
from app.schemas.rag import SearchRequest, ChatStreamRequest

load_dotenv()

# Dual Local Ollama (Default) <-> Cloud Provider (Groq / Grok / OpenAI) Configuration
LLM_BASE_URL = os.getenv("LLM_BASE_URL", os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"))
LLM_API_KEY = os.getenv("LLM_API_KEY", os.getenv("OPENAI_API_KEY", "ollama"))
CHAT_MODEL = os.getenv("CHAT_MODEL", "llama3.2")

retriever: HybridRAGRetriever = None
chat_model: BaseChatModel = None
rag_chain = None

SYSTEM_PROMPT = (
    "You are SkillVault AI, an expert software engineering mentor.\n"
    "Answer the user's question accurately and concisely, strictly based on the provided documentation excerpts.\n"
    "Rules:\n"
    "1. Ground every claim in the documentation.\n"
    "2. When stating facts or explaining mechanisms, reference the relevant citation like [1], [2].\n"
    "3. Provide clean code examples when relevant.\n"
    "4. If the documentation does not contain enough info to answer, state that clearly."
)


async def get_rag_components():
    """Lazy initialize LangChain retriever, LLM, and LCEL pipeline."""
    global retriever, chat_model, rag_chain
    if retriever is None:
        retriever = HybridRAGRetriever()
        await retriever.initialize()

    if chat_model is None:
        chat_model = get_chat_model(temperature=0.2)

    if rag_chain is None:
        rag_chain = create_rag_chain(
            chat_model=chat_model,
            system_prompt=SYSTEM_PROMPT
        )

    return retriever, chat_model, rag_chain


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting SkillVault AI Microservice (LangChain Powered)...")
    await get_rag_components()
    provider_type = "Cloud API" if "api." in LLM_BASE_URL or (LLM_API_KEY and LLM_API_KEY != "ollama") else "Local Ollama"
    print(f"   ✅ LangChain pipeline ready with {provider_type} ({CHAT_MODEL}) & FlashRank.")
    yield

    # Cleanup on shutdown
    if retriever:
        await retriever.close()
    print("🛑 SkillVault AI Microservice shut down.")


app = FastAPI(
    title="SkillVault AI Production RAG Service",
    description="LangChain-powered Enterprise Retrieval-Augmented Generation Service",
    version="2.0.0",
    lifespan=lifespan
)

# Permissive CORS configuration supporting localhost, Vercel deployments, and production domains
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health")
async def health():
    provider = "cloud_api" if "api." in LLM_BASE_URL or (LLM_API_KEY and LLM_API_KEY != "ollama") else "local_ollama"
    return {
        "status": "healthy",
        "service": "SkillVault AI Service (LangChain)",
        "provider": provider,
        "models": {
            "embeddings": os.getenv("EMBEDDING_MODEL", "nomic-embed-text"),
            "chat": CHAT_MODEL
        }
    }


@app.post("/api/v1/rag/search")
async def search_endpoint(req: SearchRequest):
    """Hybrid Search (HNSW + BM25 + RRF + FlashRank) Endpoint via LangChain Retriever."""
    try:
        r, _, _ = await get_rag_components()
        results = await r.search(
            query=req.query,
            tenant_id=req.tenant_id,
            top_k=req.top_k
        )
        return {
            "query": req.query,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def generate_rag_stream(
    query: str,
    tenant_id: str,
    top_k: int
) -> AsyncGenerator[str, None]:
    """
    Dual-stage SSE streaming generator powered exclusively by LangChain:
    1. Retrieves & reranks Top-K passages using LangChain HybridRAGRetriever (BaseRetriever).
    2. Emits verified citations event frame.
    3. Streams grounded answer tokens via LangChain LCEL pipeline (ChatPromptTemplate | ChatModel | StrOutputParser).
    """
    r, _, chain = await get_rag_components()

    # 1. Retrieve & Rerank via LangChain
    docs = await r._aget_relevant_documents(query=query, tenant_id=tenant_id, top_k=top_k)

    citations = []
    context_blocks = []

    for idx, doc in enumerate(docs, 1):
        meta = doc.metadata
        title = meta.get("document_title", "Document")
        header = meta.get("section_header", "Section")

        citations.append({
            "citation_index": idx,
            "chunk_id": meta.get("chunk_id"),
            "document_title": title,
            "section_header": header,
            "score": meta.get("score", 0.0)
        })

        context_blocks.append(
            f"--- [CITATION {idx}] (Document: {title} | Section: {header}) ---\n"
            f"{doc.page_content}\n"
        )

    context_str = "\n".join(context_blocks)

    # 2. Emit initial citation frame (protocol format: event + data)
    yield f"event: citations\ndata: {json.dumps(citations)}\n\n"

    # 3. Stream grounded tokens via LCEL (prompt | chat_model | StrOutputParser)
    async for token in chain.astream({"context": context_str, "question": query}):
        if token:
            payload = json.dumps({"token": token})
            yield f"event: token\ndata: {payload}\n\n"

    # 4. Emit completion frame
    yield "event: done\ndata: {}\n\n"


@app.options("/api/v1/rag/chat/stream")
@app.options("/api/v1/rag/search")
async def options_rag_endpoints():
    return {"status": "ok"}


@app.post("/api/v1/rag/chat/stream")
async def chat_stream_endpoint(req: ChatStreamRequest):
    """Server-Sent Events (SSE) streaming endpoint."""
    return StreamingResponse(
        generate_rag_stream(
            query=req.message,
            tenant_id=req.tenant_id,
            top_k=req.top_k
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    )
