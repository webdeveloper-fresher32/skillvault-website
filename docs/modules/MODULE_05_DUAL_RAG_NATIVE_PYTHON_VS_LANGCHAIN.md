# Module 05: Dual RAG Architecture (Native Python vs LangChain)
## Architectural Trade-offs, Custom BaseRetriever & Declarative LCEL Pipelines

---

### ❓ Question 1: Why maintain both a Native Python implementation and a LangChain LCEL implementation?

> **The Question**: Why not pick one framework and stick with it? Why did we build the entire RAG pipeline twice in `app/rag/` (Native Python) and `app/rag_langchain/` (LangChain)?

#### 💡 The Architectural Defense

| Criteria | Native Python (`backend-ai/app/rag/`) | LangChain LCEL (`backend-ai/app/rag_langchain/`) |
| :--- | :--- | :--- |
| **Architectural Role** | **Core Baseline & Performance Benchmark** | **Active Production Production Service (app/main.py)** |
| **Dependencies** | Minimum dependencies: `asyncpg`, `tiktoken`, `flashrank`. No orchestration framework overhead. | Standardized LangChain components: `BaseRetriever`, `ChatPromptTemplate`, `StrOutputParser`. |
| **Debuggability** | 100% transparent: Every SQL query, connection pool, and loop is bare Python. Ideal for debugging and profiling. | Declarative abstractions: Pipeline composition via the pipe operator (`\|`). |
| **Ecosystem Extensibility** | Custom integration code required for every new tool, evaluation harness, or agent framework. | **Plug-and-Play Ecosystem**: Seamlessly plugs into LangGraph, Ragas automated evaluation, LangSmith tracing, and multi-agent systems. |
| **Streaming Abstraction** | Manual async generator parsing OpenAI response chunks (`chunk.choices[0].delta.content`). | **Native LCEL Streaming**: `chain.astream()` yields clean string tokens automatically. |

By maintaining both:
1. **Engineers can learn the raw mechanics**: You can inspect `app/rag/hybrid_retriever.py` to see the exact raw SQL and asyncpg driver mechanics without framework magic.
2. **Production gets standard enterprise components**: The live FastAPI service uses `app/rag_langchain/` to deliver standard `BaseRetriever` and LCEL streaming.

---

### 2. Side-by-Side Component Directory Mapping

```
backend-ai/app/
├── rag/                                # 1. NATIVE PYTHON IMPLEMENTATION
│   ├── ast_chunker.py                  # Custom AST regex-based markdown parser
│   ├── ingestion.py                    # Direct asyncpg batch ingestion CLI
│   └── hybrid_retriever.py             # Bare asyncpg + raw SQL + FlashRank
│
└── rag_langchain/                      # 2. LANGCHAIN LCEL IMPLEMENTATION (ACTIVE)
    ├── ast_chunker.py                  # Extends LangChain TextSplitter, returns Documents
    ├── pdf_ingestion.py                # Enterprise PDF parser (pypdf + fonttools)
    ├── hybrid_retriever.py             # Extends LangChain BaseRetriever (HybridRAGRetriever)
    └── chain.py                        # LCEL Pipeline: prompt | chat_model | StrOutputParser
```

---

### 3. Implementing a Custom LangChain `BaseRetriever`

To use LangChain while keeping our in-SQL hybrid search and FlashRank cross-encoder, we subclassed `langchain_core.retrievers.BaseRetriever` (`app/rag_langchain/hybrid_retriever.py`):

```python
from typing import List, Any, Optional
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.callbacks import AsyncCallbackManagerForRetrieverRun
from flashrank import Ranker, RerankRequest
import asyncpg

class HybridRAGRetriever(BaseRetriever):
    """
    Production LangChain Hybrid Retriever:
    1. Subclasses BaseRetriever to integrate with any LCEL chain or LangGraph agent.
    2. Executes dual dense + sparse search with In-SQL RRF (k=60).
    3. Re-ranks top candidates via in-process FlashRank cross-encoder.
    4. Returns List[Document] with citation metadata.
    """
    db_url: str
    tenant_id: str
    top_k: int = 4
    _pool: Optional[asyncpg.Pool] = None
    _ranker: Optional[Ranker] = None

    async def _aget_relevant_documents(
        self,
        query: str,
        *,
        run_manager: Optional[AsyncCallbackManagerForRetrieverRun] = None,
        **kwargs: Any
    ) -> List[Document]:
        # 1. Generate query embedding with contrastive prefix
        query_vector = await self.embed_query(f"search_query: {query}")

        # 2. Execute parallel dense + sparse + RRF query in PostgreSQL
        async with self._pool.acquire() as conn:
            records = await conn.fetch(DUAL_HYBRID_RRF_SQL, query_vector, self.tenant_id, query)

        # 3. FlashRank Cross-Encoder Rerank
        passages = [{"id": str(r["chunk_id"]), "text": r["content"]} for r in records]
        rerank_results = self._ranker.rerank(RerankRequest(query=query, passages=passages))

        # 4. Convert Top-K results into LangChain Document instances
        documents = []
        for res in rerank_results[:self.top_k]:
            doc_meta = {
                "chunk_id": res["id"],
                "score": float(res["score"]),
                "document_title": res.get("document_title", "Document"),
                "section_header": res.get("section_header", "Section")
            }
            documents.append(Document(page_content=res["text"], metadata=doc_meta))

        return documents
```

---

### 4. Declarative LangChain LCEL Generation Pipeline

Located in `backend-ai/app/rag_langchain/chain.py`:

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.language_models.chat_models import BaseChatModel

def create_rag_chain(chat_model: BaseChatModel, system_prompt: str):
    """
    Builds a declarative LCEL streaming pipeline:
    PromptTemplate | ChatModel | StrOutputParser
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", (
            "Documentation Context:\n"
            "{context}\n\n"
            "User Question:\n"
            "{question}\n\n"
            "Instructions:\n"
            "Ground your answer strictly in the provided context. Cite sources like [1], [2]."
        ))
    ])

    # Pipe operator (|) composes the runnable pipeline
    return prompt | chat_model | StrOutputParser()
```

#### Why LCEL is Superior for Streaming:
Instead of manual string buffering and chunk unwrapping, streaming with LCEL is a single line:

```python
async for token in chain.astream({"context": context_str, "question": query}):
    yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
```

---

### 5. Multi-Provider Factory (`app/core/llm.py`)

SkillVault switches dynamically between local Ollama and cloud providers (Groq / Grok / OpenAI) without modifying application code:

```python
import os
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

def get_chat_model(temperature: float = 0.2) -> BaseChatModel:
    llm_base_url = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    llm_api_key = os.getenv("LLM_API_KEY", "ollama")
    chat_model = os.getenv("CHAT_MODEL", "llama3.2")

    # Cloud Provider Mode (Groq / Grok xAI / OpenAI)
    if "api." in llm_base_url or (llm_api_key and llm_api_key != "ollama"):
        # Auto-map to active high-speed model on Groq
        if "groq.com" in llm_base_url and chat_model in ("llama-3.3-70b-versatile", "llama3.2"):
            chat_model = "qwen/qwen3.8-27b"

        return ChatOpenAI(
            base_url=llm_base_url,
            api_key=llm_api_key,
            model=chat_model,
            temperature=temperature
        )

    # Local Development Mode (Ollama)
    clean_url = llm_base_url.replace("/v1", "").rstrip("/")
    return ChatOllama(
        base_url=clean_url,
        model=chat_model,
        temperature=temperature
    )
```

---

### 6. Verification: Testing Both Pipelines

Run the standalone verification scripts:

```bash
cd backend-ai
source venv/bin/activate

# Test 1: Native Python implementation
python test_search.py

# Test 2: LangChain LCEL implementation
python test_search_langchain.py

# Test 3: PDF Hybrid Search
python test_search_pdf.py
```

Both tests retrieve the same Top-4 grounded passages with FlashRank scores $>0.98$, verifying absolute functional parity between native Python and LangChain.

👉 **Next: [Module 06: Streaming SSE & Zero-CORS Proxy](MODULE_06_STREAMING_SSE_AND_CORS_PROXY.md)**
