import os
import re
import json
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
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


def classify_conversational_intent(query: str) -> Optional[str]:
    """
    Fast rule-based intent router (0ms latency, $0 cost).
    Classifies conversational greetings, gratitude, and courtesies.
    Prevents unnecessary database queries and avoids irrelevant PDF preface citations.
    """
    cleaned = re.sub(r"[^\w\s]", "", query.strip().lower()).strip()
    words = cleaned.split()
    if not words:
        return "greeting"

    # 1. Gratitude (e.g., 'thanks', 'thank you so much', 'thx a lot')
    gratitude_phrases = {
        "thanks", "thank you", "thank u", "thx", "ty", "thanks a lot",
        "thank you so much", "many thanks", "appreciate it", "much appreciated"
    }
    if cleaned in gratitude_phrases or (len(words) <= 5 and any(w in words for w in ["thanks", "thank", "thx", "ty", "appreciated"])):
        return "gratitude"

    # 2. Greetings (e.g., 'hi', 'hello', 'hey there')
    greetings = {
        "hi", "hello", "hey", "hiya", "howdy", "good morning", "good afternoon",
        "good evening", "hey there", "hello there", "what can you do", "who are you"
    }
    if cleaned in greetings or (len(words) <= 3 and any(w in words for w in ["hi", "hello", "hey", "howdy"])):
        return "greeting"

    # 3. Acknowledgments / Confirmations (e.g., 'ok', 'cool', 'got it')
    acks = {"ok", "okay", "got it", "cool", "awesome", "great", "nice", "understood", "makes sense", "perfect"}
    if cleaned in acks or (len(words) <= 3 and any(w in words for w in ["cool", "awesome", "got it", "perfect"])):
        return "acknowledgment"

    # 4. Farewells (e.g., 'bye', 'see you')
    farewells = {"bye", "goodbye", "cya", "see you", "see ya", "have a good one"}
    if cleaned in farewells:
        return "farewell"

    return None


async def generate_rag_stream(
    query: str,
    tenant_id: str,
    top_k: int
) -> AsyncGenerator[str, None]:
    """
    Production-grade Intent-Routed SSE Streaming Generator:
    1. Fast-Path: Bypasses retrieval for conversational courtesies (e.g. 'thanks', 'hi')
       with immediate response and empty citations.
    2. Knowledge-Path: Executes LangChain Hybrid Retrieval (HNSW + BM25 + FlashRank),
       filters low-confidence noise, emits verified citations, and streams grounded LCEL tokens.
    """
    # 0. Intent Router Check
    conversational_intent = classify_conversational_intent(query)
    if conversational_intent:
        # Emit empty citations so the UI shows ZERO PDF citations
        yield "event: citations\ndata: []\n\n"

        conversational_replies = {
            "gratitude": "You're very welcome! 😊 If you have any more questions about React, Spring Boot, or Angular, feel free to ask anytime.",
            "greeting": "Hello! 👋 I'm SkillVault AI, your software engineering mentor. What topic or concept would you like to explore today?",
            "acknowledgment": "Sounds great! Whenever you're ready, let me know what you'd like to work on next.",
            "farewell": "Goodbye! Have fun building and coding. Reach out whenever you need assistance!"
        }
        reply_text = conversational_replies.get(
            conversational_intent,
            "You're welcome! How can I assist you with your software engineering studies today?"
        )

        for word in reply_text.split(" "):
            yield f"event: token\ndata: {json.dumps({'token': word + ' '})}\n\n"
            await asyncio.sleep(0.015)

        yield "event: done\ndata: {}\n\n"
        return

    # 1. Technical Query: Retrieve & Rerank via LangChain
    r, _, chain = await get_rag_components()
    docs = await r._aget_relevant_documents(query=query, tenant_id=tenant_id, top_k=top_k)

    # Filter out low-confidence noise chunks (FlashRank score < 0.15)
    relevant_docs = [d for d in docs if float(d.metadata.get("score", 0.0)) >= 0.15]
    if not relevant_docs and docs:
        relevant_docs = [docs[0]] if float(docs[0].metadata.get("score", 0.0)) >= 0.05 else []

    citations = []
    context_blocks = []

    for idx, doc in enumerate(relevant_docs, 1):
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

    # 2. Emit verified citation frame
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
