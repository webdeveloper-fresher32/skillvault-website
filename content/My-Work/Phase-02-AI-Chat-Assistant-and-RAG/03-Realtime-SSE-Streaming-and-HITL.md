# Real-Time Token Streaming (SSE) & Durable HITL Checkpoints

> **Module**: Phase 02 — Multi-Tenant AI Support & RAG Platform | **Lesson**: 03  
> **Tech Stack**: FastAPI Server-Sent Events, LangGraph `StateGraph`, `PostgresSaver`, `interrupt()`

---

## 1. LangGraph Cyclic State Machine with HITL Breakpoints

![LangGraph Agentic State Machine Flowchart](/images/my-work/04-langgraph-agentic-state-machine.png)

---

## 2. Real-Time Streaming via FastAPI Server-Sent Events (SSE)

When streaming with agent tool calls, streaming raw LLM tokens directly to the client leaks ugly JSON function calling schemas (e.g., `{"name": "get_subscription", "arguments": ...}`).

### The Filtered Streaming Architecture:
Using LangGraph's `astream_events(version="v2")`:
1. **Telemetry Status Events**: When `on_chain_start` fires for `rag_retrieval` or a tool node, we emit `event: status` with human-readable text (`"Searching knowledge base..."`).
2. **Filtered Token Deltas**: Tokens from `on_chat_model_stream` are only forwarded to the client if the emitting node is a user-facing generation node (`rag_generate` or `direct_chat`).
3. **Structured Metadata**: When the graph finishes, we emit `event: citations` with document titles, pages, and relevance scores.

```python
# app/api/routes/chat.py
import json
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/stream")
async def stream_chat(
    request: Request,
    body: ChatRequest,
    user = Depends(get_current_user),
    db = Depends(get_db)
):
    checkpointer = await get_checkpointer()
    graph = build_assistant_graph(checkpointer)

    thread_id = f"org_{user.organization_id}:thread_{body.conversation_id}"
    config = {
        "configurable": {
            "thread_id": thread_id,
            "llm": request.app.state.llm,
            "embedder": request.app.state.embedder,
            "retriever": request.app.state.retriever,
            "db_session": db
        }
    }

    initial_state = {
        "messages": [HumanMessage(content=body.message)],
        "organization_id": user.organization_id,
        "user_id": user.user_id,
        "user_role": user.role,
        "retrieved_docs": [],
        "citations": []
    }

    async def event_generator():
        yield f"event: open\ndata: {json.dumps({'thread_id': thread_id})}\n\n"

        async for event in graph.astream_events(initial_state, config=config, version="v2"):
            if await request.is_disconnected():
                break

            kind = event["event"]

            # 1. Telemetry / Status events
            if kind == "on_chain_start" and event["name"] == "rag_retrieval":
                yield f"event: status\ndata: {json.dumps({'message': 'Searching knowledge base...'})}\n\n"
            elif kind == "on_chain_start" and event["name"] == "billing_tool":
                yield f"event: status\ndata: {json.dumps({'message': 'Querying active subscription...'})}\n\n"

            # 2. Token-by-token streaming (Filtered to prevent tool schema JSON leakage)
            elif kind == "on_chat_model_stream":
                token = event["data"]["chunk"].content
                if token:
                    yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"

            # 3. Final completion event with citations
            elif kind == "on_chain_end" and event["name"] == "LangGraph":
                output = event["data"].get("output", {})
                citations = output.get("citations", [])
                yield f"event: citations\ndata: {json.dumps({'citations': citations})}\n\n"
                yield f"event: done\ndata: {json.dumps({'status': 'completed'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
```

---

## 3. Durable HITL Checkpoints with `PostgresSaver`

When a sensitive action is detected (e.g. refunding over \$100 or deleting a workspace), the graph executes:

```python
approval = interrupt({
    "action": "PROCESS_REFUND",
    "amount": 250.00,
    "user_id": state["user_id"],
    "organization_id": state["organization_id"]
})
```

- LangGraph writes the entire execution state into PostgreSQL under `thread_id` and terminates the execution thread.
- **Zero background workers or API servers remain blocked**.
- 14 hours later, when a supervisor approves the refund via the admin panel, the frontend calls:
  `POST /api/v1/chat/resume { thread_id, approved: true }`.
- LangGraph reloads the state from PostgreSQL and resumes execution directly at the tool execution node via `Command(resume={"approved": True})`.
