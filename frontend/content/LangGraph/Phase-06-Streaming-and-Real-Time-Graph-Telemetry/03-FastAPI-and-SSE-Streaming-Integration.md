# FastAPI and SSE Streaming Integration in LangGraph

> "Building a graph in a Jupyter notebook is fun. Serving that graph to thousands of web browsers over HTTP Server-Sent Events (SSE) is what makes it a real production product."

---

### Step 1: Why Do We Need This?

#### The Real Problem

You have built a working LangGraph agent with tool calling and checkpointing. Now your React or Next.js frontend needs to talk to it:
- If your backend uses standard REST `POST /chat` returning a single JSON response, the HTTP connection stays silent for 15 seconds.
- Web browsers cannot display live thinking indicators, active tool cards, or typewriter token generation over standard JSON POST.
- WebSockets require persistent two-way TCP connections, complex heartbeat pings, and sticky sessions on load balancers.

For 95% of AI streaming applications, you need a lightweight, standard HTTP streaming protocol: **Server-Sent Events (SSE)**.

#### Why LangGraph Solves It

LangGraph's async streaming API (`graph.astream()`) integrates cleanly with FastAPI's `StreamingResponse`:
- Uses standard HTTP (port 80/443).
- Works through proxies, corporate firewalls, and cloud CDNs without WebSocket upgrade issues.
- Emits formatted `data: {...}\n\n` event packets that the standard browser `EventSource` or `fetch()` API can parse instantly.

---

### Step 2: What Is It?

#### Simple Explanation

Think of a **live football radio broadcast over a telephone**:
- The user places a phone call (HTTP GET/POST request).
- The commentator (FastAPI + LangGraph) keeps the line open and continuously describes the action play-by-play as it happens (**Server-Sent Events**).
- When the game ends, the commentator hangs up the phone (HTTP connection closes cleanly).

#### Standard SSE Protocol Format

```text
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type": "node_start", "node": "triage"}

data: {"type": "tool_call", "tool": "search_database"}

data: {"type": "token", "content": "Here is the summary"}

data: {"type": "done"}
```

---

### Step 3: Real-World Example

#### Next.js Production Chat Assistant

Imagine a production Next.js chat application communicating with a FastAPI backend:
- **Client Action:** The user types: *"Summarize our quarterly sales report"*.
- **The SSE Stream:**
  1. `POST /api/chat/stream` opens an SSE stream.
  2. Packet 1: `{"node": "classifier", "status": "completed"}` -> Frontend shows: *"Question analyzed"*.
  3. Packet 2: `{"node": "sql_query", "status": "running"}` -> Frontend displays an animated SQL query badge.
  4. Packet 3: `{"token": "In Q3 2026, "}` -> First token appears on screen within 800ms!
  5. Packets 4-50: Remaining tokens stream smoothly.
- **What it outputs:** Instant time-to-first-token (TTFT) and high perceived performance.

---

### Step 4: How Does It Work?

1. **Async Generator Function:** Write an `async def event_generator()` function in FastAPI.
2. **Iterate with `graph.astream()`:** Stream graph updates or message chunks asynchronously.
3. **Format as SSE Packets:** Yield formatted strings: `f"data: {json.dumps(payload)}\n\n"`.
4. **Wrap in `StreamingResponse`:** Return `StreamingResponse(event_generator(), media_type="text/event-stream")`.
5. **Set Required Headers:** Add `Cache-Control: no-cache` and `X-Accel-Buffering: no` (to prevent Nginx from buffering stream chunks).

---

### Step 5: Code Example

Here is a complete, runnable FastAPI endpoint serving a LangGraph workflow over Server-Sent Events:

```python
import asyncio
import json
from typing import TypedDict, Annotated, List, AsyncGenerator
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import add_messages
from langgraph.checkpoint.memory import MemorySaver

# 1. State definition
class ChatState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]

# 2. Node that produces simulated multi-step agent actions
async def agent_node(state: ChatState) -> dict:
    await asyncio.sleep(0.5)  # Simulate LLM thinking
    return {"messages": [AIMessage(content="I analyzed your request and located the documentation.")]}

async def summarizer_node(state: ChatState) -> dict:
    await asyncio.sleep(0.5)  # Simulate summarization
    return {"messages": [AIMessage(content="Final Summary: All systems are operational.")]}

# Build graph
builder = StateGraph(ChatState)
builder.add_node("agent", agent_node)
builder.add_node("summarizer", summarizer_node)

builder.add_edge(START, "agent")
builder.add_edge("agent", "summarizer")
builder.add_edge("summarizer", END)

checkpointer = MemorySaver()
graph = builder.compile(checkpointer=checkpointer)

# 3. FastAPI Application
app = FastAPI(title="LangGraph SSE Streaming Service")

class ChatRequest(BaseModel):
    message: str
    thread_id: str

# 4. SSE Generator Function
async def stream_graph_events(user_message: str, thread_id: str) -> AsyncGenerator[str, None]:
    config = {"configurable": {"thread_id": thread_id}}
    input_payload = {"messages": [HumanMessage(content=user_message)]}

    try:
        # Stream updates from the graph as each node completes
        async for chunk in graph.astream(input_payload, config=config, stream_mode="updates"):
            for node_name, updates in chunk.items():
                event_data = {
                    "event": "node_complete",
                    "node": node_name,
                    "last_message": updates["messages"][-1].content
                }
                # Format strictly as an SSE message with double newline!
                yield f"data: {json.dumps(event_data)}\n\n"

        # Emit completion sentinel
        yield f"data: {json.dumps({'event': 'done'})}\n\n"

    except Exception as e:
        error_payload = {"event": "error", "message": str(e)}
        yield f"data: {json.dumps(error_payload)}\n\n"

# 5. FastAPI Streaming Endpoint
@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    return StreamingResponse(
        stream_graph_events(request.message, request.thread_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Critical for Nginx / reverse proxies!
        }
    )

if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI LangGraph SSE server on http://localhost:8000 ...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

---

### Step 6: How Is It Used in Production?

#### Production Patterns & Edge Cases

| Scenario | Production Challenge | Recommended Solution |
| :--- | :--- | :--- |
| **Nginx Proxy Buffering** | Nginx buffers SSE packets until 4KB accumulates, destroying the real-time effect. | Send response header: `X-Accel-Buffering: no` and configure `proxy_buffering off;`. |
| **Client Disconnects** | User closes tab while LLM is generating tokens, wasting compute. | Use `request.is_disconnected()` inside your streaming loop to cancel background graph tasks. |
| **CORS for Web Clients** | Next.js frontend on `localhost:3000` cannot read SSE from FastAPI on `localhost:8000`. | Add `CORSMiddleware` in FastAPI with `allow_origins=["*"]` and `allow_credentials=True`. |
| **Reconnection Handling** | Mobile network drops and client reconnects after 2 seconds. | Pass `thread_id` so the client can resume streaming from the latest checkpoint snapshot. |

---

### Step 7: Quick Revision

- Server-Sent Events (SSE) provide one-way real-time HTTP streaming over standard port 80/443.
- FastAPI uses `StreamingResponse(generator(), media_type="text/event-stream")`.
- Every SSE packet must follow the format: `data: {...}\n\n` (ends with two newlines).
- Always include `X-Accel-Buffering: no` to prevent proxy buffering delays.
- Use `graph.astream()` inside async generators to stream graph updates without blocking the server.

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    Client["Next.js Browser Client"]:::startStyle -->|POST /api/chat/stream| FastApi["FastAPI Endpoint"]:::nodeStyle
    FastApi --> StreamGen["async def stream_graph_events()"]:::nodeStyle
    StreamGen -->|graph.astream()| GraphExec["LangGraph Execution Engine"]:::decisionStyle
    
    GraphExec -->|Node 1 Updates| StreamGen
    StreamGen -->|data: Node 1 Done\n\n| Client
    
    GraphExec -->|Node 2 Updates| StreamGen
    StreamGen -->|data: Node 2 Done\n\n| Client
    
    StreamGen -->|data: {event: done}\n\n| Client

    classDef startStyle fill:#0284c7,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef nodeStyle fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;
    classDef decisionStyle fill:#334155,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
```

---

### Step 9: Quiz

Try answering these questions to check your understanding:

1. What `media_type` must be set on `StreamingResponse` for Server-Sent Events?
   - A) `application/json`
   - B) `text/event-stream`
   - C) `text/html`
   - D) `video/mp4`

2. What characters must appear at the end of every SSE data packet for browsers to parse it?
   - A) `\r`
   - B) `\n\n` (two newline characters)
   - C) `END`
   - D) `;`

3. Why is the header `X-Accel-Buffering: no` critical when deploying FastAPI behind Nginx?
   - A) It speeds up SSL handshakes
   - B) It prevents Nginx from buffering stream chunks in memory, ensuring packets reach the browser immediately
   - C) It blocks ad blockers
   - D) It enables dark mode

4. Why is SSE often preferred over WebSockets for AI chat streaming?
   - A) SSE is simpler, runs over standard HTTP without connection upgrades, and works reliably through enterprise firewalls and load balancers
   - B) WebSockets are deprecated in modern web browsers
   - C) SSE uses UDP for maximum gaming speed
   - D) WebSockets cannot send text

*Submit your answers (e.g. 1-B, 2-B, 3-B, 4-A) to verify your score!*
