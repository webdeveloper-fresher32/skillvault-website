# SSE and FastAPI Streaming — Complete Guide

> "A ticker-tape machine prints continuous paper ribbons of live stock transactions directly onto the trading room floor without traders having to dial the phone for every price change."

---

## Table of Contents

1. [The Problem: Delivering Real-Time AI Tokens Over HTTP](#1-the-problem-delivering-real-time-ai-tokens-over-http)
2. [The Stock Ticker-Tape Analogy](#2-the-stock-ticker-tape-analogy)
3. [The Mechanism: Server-Sent Events (SSE) Wire Protocol](#3-the-mechanism-server-sent-events-sse-wire-protocol)
4. [Diagram: FastAPI to Browser SSE Streaming Architecture](#4-diagram-fastapi-to-browser-sse-streaming-architecture)
5. [Code Walkthrough: Production FastAPI Streaming Endpoint](#5-code-walkthrough-production-fastapi-streaming-endpoint)
6. [Comparing WebSockets vs Server-Sent Events (SSE)](#6-comparing-websockets-vs-server-sent-events-sse)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Delivering Real-Time AI Tokens Over HTTP

Standard REST APIs (`POST /api/chat`) return a single JSON object after full generation finishes.

### The Streaming Delivery Challenge

```text
Standard REST:
  Client POST ──▶ [10s Server Processing] ──▶ Returns {"response": "Full text..."}
  → High perceived latency.

Server-Sent Events (SSE):
  Client POST/GET ──▶ Server keeps HTTP connection open (Content-Type: text/event-stream)
  Chunk 1: "data: {\"token\": \"Hello\"}\n\n"
  Chunk 2: "data: {\"token\": \" world\"}\n\n"
  Chunk 3: "data: [DONE]\n\n"
  → Client renders words on screen with zero delay.
```

### The Solution: FastAPI `StreamingResponse` + LangChain `astream`

FastAPI pairs with LangChain async generators to stream standard W3C Server-Sent Events directly to browser `EventSource` and `fetch()` readers.

---

## 2. The Stock Ticker-Tape Analogy

Wall Street traders in 1920 did not place a long-distance telephone call every 10 seconds asking for the current price of US Steel stock.

### Periodic Phone Calls vs Continuous Ticker Tape

```text
Periodic Calls → Trader dials broker: "What is US Steel?"
                 Broker looks up price: "104". Trader hangs up (High overhead).
Ticker Tape    → A single telegraph wire feeds continuous character punches
                 into the glass-domed machine, printing trades as they occur.
```

### Mapping to LangChain & FastAPI

The client opens a single persistent HTTP stream; FastAPI acts as the telegraph wire; LangChain's `astream()` punches tokens across the wire.

---

## 3. The Mechanism: Server-Sent Events (SSE) Wire Protocol

SSE is a lightweight W3C standard over standard HTTP/1.1 or HTTP/2.

### Core FastAPI Streaming Structure

```python
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

app = FastAPI()

async def generate_sse_stream(prompt_text: str):
    prompt = ChatPromptTemplate.from_template("Answer concisely: {q}")
    chain = prompt | ChatOpenAI(model="gpt-4o") | StrOutputParser()

    async for token in chain.astream({"q": prompt_text}):
        payload = json.dumps({"token": token})
        yield f"data: {payload}\n\n"
    yield "data: [DONE]\n\n"
```

---

## 4. Diagram: FastAPI to Browser SSE Streaming Architecture

### End-to-End Streaming Lifecycle

```text
Browser Client (React / Next.js fetch API)
                    │
                    ▼ HTTP POST /api/chat/stream
┌─────────────────────────────────────────────────────────────┐
│ 1. FastAPI Route Handler                                    │
│    Returns: StreamingResponse(..., media_type="text/event-stream")│
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼ (Async Generator Iteration)
┌─────────────────────────────────────────────────────────────┐
│ 2. LangChain LCEL Async Pipeline (chain.astream yields deltas)│
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼ (Flushed chunks: "data: {\"token\": ...}\n\n")
┌─────────────────────────────────────────────────────────────┐
│ 3. Client Browser DOM Update (ReadableStream reader)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Code Walkthrough: Production FastAPI Streaming Endpoint

A production-ready FastAPI service handling SSE streaming, error traps, and client cancellation:

```python
# fastapi_streaming_server.py
import json
import asyncio
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

app = FastAPI(title="SkillVault Streaming API")

class ChatRequest(BaseModel):
    message: str

async def sse_token_generator(user_message: str):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a software tutor."),
        ("human", "{input}")
    ])
    model = ChatOpenAI(model="gpt-4o", streaming=True)
    chain = prompt | model | StrOutputParser()

    try:
        async for chunk in chain.astream({"input": user_message}):
            if chunk:
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                await asyncio.sleep(0)
        yield "data: [DONE]\n\n"
    except asyncio.CancelledError:
        print("[SSE] Client disconnected.")
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

@app.post("/api/chat/stream")
async def chat_stream_endpoint(req: ChatRequest):
    return StreamingResponse(
        sse_token_generator(req.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
```

---

## 6. Comparing WebSockets vs Server-Sent Events (SSE)

| Feature | Server-Sent Events (SSE) | WebSockets |
|---|---|---|
| Communication Flow | Unidirectional (Server $\to$ Client) | Bidirectional (Full duplex) |
| Protocol | Standard HTTP/1.1 or HTTP/2 | `ws://` or `wss://` upgraded protocol |
| Firewall / Proxy Traversal | Seamless (standard HTTP port 80/443) | Can be blocked by corporate proxies |
| Reconnection Handling | Built-in automatic browser reconnection | Requires manual client reconnection logic |
| Best Used For | LLM chat generation, real-time token feeds | Multiplayer games, collaborative whiteboards |

---

## 7. Common Mistakes

- **Omitting the trailing double newline (`\n\n`).** The SSE standard dictates that an event frame is only dispatched to the client when terminated by two newline characters; a single `\n` buffers forever.
- **Nginx buffering the stream.** When hosting behind Nginx, Nginx buffers HTTP response chunks by default; you must send header `"X-Accel-Buffering": "no"` to enable real-time streaming.
- **Using synchronous generators with `def` instead of `async def`.** Synchronous generators in FastAPI run in worker threads and can lock thread pools under load; use `async def` and `async for`.
- **Not handling `asyncio.CancelledError`.** When a user closes their browser tab mid-generation, FastAPI raises `CancelledError`; catch it cleanly to avoid noisy error tracebacks.
- **Passing unescaped newlines in the data payload.** Newlines inside JSON strings must be JSON-serialized (`json.dumps()`); unescaped raw newlines break SSE framing.

---

## 8. Hands-On Exercises

**Exercise 1:** Run a minimal FastAPI `StreamingResponse` endpoint that streams numbers 1 through 10 with 0.5s delays formatted as SSE.

**Exercise 2:** Connect a LangChain LCEL chain to a FastAPI `/stream` endpoint and test it with `curl -N http://localhost:8000/api/chat/stream`.

**Exercise 3:** Write a frontend JavaScript `fetch()` snippet with `response.body.getReader()` to parse SSE chunks and append them to an HTML `<div>`.

**Exercise 4:** Add `"X-Accel-Buffering": "no"` headers and verify that tokens stream without reverse-proxy buffering delays.

**Exercise 5:** Simulate client disconnection (canceling curl mid-stream) and verify that the backend logs the cancellation gracefully.

---

## 9. Interview Q&A

**Q: Why is Server-Sent Events (SSE) preferred over WebSockets for LLM chat streaming?**
Because LLM token streaming is fundamentally unidirectional (the client submits a query once, and the server pushes incremental token deltas). SSE operates over standard HTTP, traverses firewalls without special upgrades, supports built-in reconnection, and avoids the operational complexity of maintaining stateful WebSocket clusters.

**Q: What is the significance of the `X-Accel-Buffering: no` header in streaming AI architectures?**
Reverse proxies like Nginx buffer HTTP responses by default to optimize network packet size. Setting `X-Accel-Buffering: no` instructs Nginx to disable response buffering and immediately flush every chunk to the client as soon as FastAPI yields it.

**Q: Why is the double newline `\n\n` mandatory in Server-Sent Events?**
The SSE specification defines the boundary of an event message by two consecutive newline characters (`\n\n`). Without the second newline, the client's HTTP buffer will not dispatch the event to the application.

**Q: How does a modern frontend JavaScript client consume an SSE stream from a POST request?**
Since standard browser `EventSource` only supports GET requests, modern frontends use `fetch()` with `await response.body.getReader()`, iterating over the `ReadableStream` chunks with a `TextDecoder`.

**Q: What happens if an unhandled exception occurs inside a FastAPI streaming generator?**
Because HTTP 200 headers have already been sent to the client when streaming begins, the server cannot send a 500 status code. Instead, the generator should catch errors and emit a structured error event (`event: error\ndata: {...}\n\n`) before closing the stream.
