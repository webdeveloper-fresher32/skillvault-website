# Module 4: Python FastAPI AI Service & LLM Provider Abstraction

| Specification | Details |
| :--- | :--- |
| **Module Number** | 04 of 12 |
| **Topic** | High-Throughput ASGI Service, Multi-Provider Circuit Breakers & Client Disconnect Detection |
| **Target System** | Python 3.11, FastAPI, Pydantic v2, Uvicorn, LangChain Core |
| **Engineering Level** | Staff AI Systems & Distributed Backend Engineer |

---

## 1. Architectural Overview & Request Lifecycle

The Python FastAPI microservice is dedicated entirely to tensor computations, embeddings, LangGraph state machine execution, and SSE token streaming. It isolates heavy AI dependencies from the Node.js API Gateway.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        INCOMING REQUEST FROM NODE.JS GATEWAY                           │
│     POST /api/v1/ai/chat/stream  |  Headers: { X-Tenant-ID, X-User-ID, X-User-Role }   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FASTAPI ASGI WORKER PROCESS                              │
│                                                                                        │
│  [1. Pydantic v2 Request Validation]                                                   │
│       └── Validates ChatStreamRequest (conversation_id, message, history_window)       │
│                                                                                        │
│  [2. Active Tenant Context Injection]                                                  │
│       └── Sets tenant context var (used by database session & vector search)           │
│                                                                                        │
│  [3. Multi-Provider LLM Factory with Circuit Breaker]                                  │
│       ├── Primary Provider: OpenAI (gpt-4o-mini / gpt-4o)                              │
│       └── Fallback Provider: Anthropic (claude-3-5-sonnet) on 429 / 503 Outage         │
│                                                                                        │
│  [4. Asynchronous Event Generator with Disconnect Monitor]                             │
│       ├── Yields SSE chunks to client response stream                                  │
│       └── Periodically polls: await request.is_disconnected()                          │
│           └── If True: Triggers LangGraph cancellation to save tokens                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ADR: AI Service Framework

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PYTHON AI WEB FRAMEWORKS                                        │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Framework                │ Concurrency Engine          │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. FastAPI (ASGI)        │ Starlette Asyncio Event Loop│ 🏆 SELECTED (Pydantic v2 Native + Stream)│
│ 2. Flask (WSGI)          │ Synchronous Thread Pool     │ ❌ REJECTED (Blocks on streaming I/O)    │
│ 3. Django + Ninja        │ Synchronous / Async Hybrid  │ ❌ REJECTED (Excessive monolithic bloat) │
│ 4. Ray Serve             │ Distributed Actor System    │ ❌ REJECTED (Overkill for API gateways)  │
│ 5. BentoML               │ Model Serving Framework     │ ❌ REJECTED (Focused on offline batch)   │
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

### **🏆 1. FastAPI with Uvicorn (ASGI) — SELECTED**
* **Why Selected:**
  1. **Native Asyncio Event Loop:** Essential for streaming Server-Sent Events. Handles thousands of concurrent open HTTP streaming connections without allocating a dedicated OS thread per client.
  2. **Pydantic v2 Integration:** Written in Rust under the hood; data validation and serialization is $5\times\text{--}10\times$ faster than Pydantic v1.
  3. **Direct Disconnect Detection:** Native Starlette access to `request.is_disconnected()` enables instantaneous cancellation of LLM generation when the client aborts.

---

## 3. Concrete Code Implementation

### 3.1 Pydantic Request Schemas (`app/schemas/chat.py`)
```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class RoleEnum(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class ChatHistoryItem(BaseModel):
    role: RoleEnum
    content: str

class ChatStreamRequest(BaseModel):
    conversation_id: str = Field(..., description="Unique conversation UUID")
    message: str = Field(..., min_length=1, max_length=4000, description="User prompt text")
    history_window: List[ChatHistoryItem] = Field(default=[], description="Recent conversation turns")
    page_context: Optional[Dict[str, Any]] = Field(default=None, description="Active UI context")
```

### 3.2 Resilient Multi-Provider LLM Factory (`app/core/llm.py`)
```python
import os
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

class ResilientLLMProvider:
    def __init__(self):
        self.primary_model = ChatOpenAI(
            model=os.getenv("PRIMARY_LLM_MODEL", "gpt-4o-mini"),
            temperature=0.2,
            streaming=True,
            timeout=30.0,
            max_retries=2
        )
        self.fallback_model = ChatAnthropic(
            model_name=os.getenv("FALLBACK_LLM_MODEL", "claude-3-5-sonnet-20241022"),
            temperature=0.2,
            streaming=True,
            timeout=30.0,
            max_retries=2
        )

    async def get_streaming_model(self) -> BaseChatModel:
        # Returns primary; circuit breaker fallback handled in graph nodes
        return self.primary_model

llm_provider = ResilientLLMProvider()
```

### 3.3 Streaming Endpoint with Disconnect Monitoring (`app/api/stream.py`)
```python
import json
import asyncio
from fastapi import APIRouter, Request, Header, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.chat import ChatStreamRequest
from app.agent.graph import app_graph

router = APIRouter(prefix="/api/v1/ai", tags=["AI Stream"])

@router.post("/chat/stream")
async def chat_stream_endpoint(
    request: Request,
    payload: ChatStreamRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
    x_user_id: str = Header(..., alias="X-User-ID"),
    x_user_role: str = Header("MEMBER", alias="X-User-Role")
):
    async def event_generator():
        initial_state = {
            "conversation_id": payload.conversation_id,
            "tenant_id": x_tenant_id,
            "user_id": x_user_id,
            "user_role": x_user_role,
            "user_message": payload.message,
            "history_window": [h.model_dump() for h in payload.history_window],
            "page_context": payload.page_context or {},
            "retrieved_docs": [],
            "intent": None,
            "retry_count": 0,
            "tool_calls": []
        }

        try:
            # Stream events directly from LangGraph execution
            async for event in app_graph.astream_events(initial_state, version="v2"):
                # Check if client disconnected (tab closed or abort clicked)
                if await request.is_disconnected():
                    print(f"[STREAM ABORTED] Client disconnected for conv {payload.conversation_id}")
                    break

                kind = event["event"]

                # 1. Capture Agent Thought Steps
                if kind == "on_chain_start" and event["name"] in ["query_analyzer", "hybrid_retriever"]:
                    yield f"event: thought\ndata: {json.dumps({'step': f'Executing {event[\"name\"]}...'})}\n\n"

                # 2. Capture Real-time LLM Token Deltas
                elif kind == "on_chat_model_stream":
                    chunk_content = event["data"]["chunk"].content
                    if chunk_content:
                        yield f"event: chunk\ndata: {json.dumps({'delta': chunk_content})}\n\n"

                # 3. Capture Tool Confirmation Requirements
                elif kind == "on_chain_end" and event["name"] == "confirmation_gate":
                    gate_data = event["data"].get("output", {})
                    if gate_data.get("requires_confirmation"):
                        yield f"event: confirmation_required\ndata: {json.dumps(gate_data)}\n\n"

            yield f"event: done\ndata: {json.dumps({'status': 'SUCCESS'})}\n\n"

        except Exception as e:
            print(f"[STREAM ERROR] {str(e)}")
            yield f"event: error\ndata: {json.dumps({'error': 'INFERENCE_FAILED', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "none"
        }
    )
```

---

## 4. Production Testing Scenarios

| Failure Scenario | SRE Automated Handling |
| :--- | :--- |
| **User Aborts Mid-Sentence** | `request.is_disconnected()` returns `True`, breaking the generator loop and cancelling background inference. |
| **OpenAI Rate Limit (HTTP 429)** | Circuit breaker intercepts 429 and dynamically reroutes execution to Anthropic Claude 3.5 Sonnet. |
| **Missing Tenant Header** | FastAPI Pydantic header validation returns `422 Unprocessable Entity` before triggering any LLM call. |
