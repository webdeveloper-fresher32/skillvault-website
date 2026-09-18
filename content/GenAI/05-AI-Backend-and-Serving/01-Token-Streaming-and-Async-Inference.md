# Token Streaming and Async Inference — Complete Guide

> "Waiting for an LLM without streaming is like ordering a 7-course meal and waiting 3 hours for all dishes to be cooked before tasting a single bite; streaming is like serving each course piping hot the exact second it leaves the chef's pan."

---

## Table of Contents

1. [The Problem: The Latency Bottleneck of Autoregressive Decoding](#1-the-problem-the-latency-bottleneck-of-autoregressive-decoding)
2. [The Multi-Course Banquet Analogy](#2-the-multi-course-banquet-analogy)
3. [The Mechanism: Server-Sent Events (SSE) and Asynchronous Coroutines](#3-the-mechanism-server-sent-events-sse-and-asynchronous-coroutines)
4. [Diagram: The SSE Streaming HTTP Lifecycle](#4-diagram-the-sse-streaming-http-lifecycle)
5. [Code Walkthrough: Production FastAPI SSE Streaming with Disconnect Detection](#5-code-walkthrough-production-fastapi-sse-streaming-with-disconnect-detection)
6. [Comparing Streaming Protocols: Polling vs WebSockets vs SSE](#6-comparing-streaming-protocols-polling-vs-websockets-vs-sse)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Latency Bottleneck of Autoregressive Decoding

Unlike traditional CRUD endpoints that respond in 15 milliseconds, Large Language Models generate text autoregressively:
- Generating a 600-word response takes between 3 to 15 seconds.
- If a backend buffers the entire response in memory before returning a single HTTP response:
  1. **Terrible UX**: The human user stares at an empty screen or loading spinner for 10 seconds, assuming the application has crashed.
  2. **HTTP Gateway Timeouts**: Reverse proxies (NGINX, AWS ALB, Cloudflare) often enforce a 30-second connection timeout, dropping long requests mid-flight.
  3. **Thread Pool Exhaustion**: In synchronous frameworks (e.g. Flask/Django with standard Gunicorn workers), worker threads block for 10 seconds per user, grinding server concurrency to a halt.

### What Asynchronous Streaming Solves

By streaming tokens as they leave the GPU using **Server-Sent Events (SSE)** inside a non-blocking asynchronous event loop:
- **Time-to-First-Token (TTFT)** drops to under 300 milliseconds.
- Users read tokens in real time as they appear word-by-word.
- Python async workers handle thousands of simultaneous streaming connections on a single server without thread contention.

---

## 2. The Multi-Course Banquet Analogy

Consider the difference between traditional bulk delivery and progressive course serving at a banquet.

### All-at-Once Delivery vs Continuous Flow

```text
Bulk Delivery (Non-Streaming):
  Chef prepares: Soup, Salad, Steak, Dessert.
  - Table waits 90 minutes in complete silence with empty plates.
  - Soup is cold by the time the steak finishes cooking.
  - Customer frustration is at a maximum.

Progressive Service (Token Streaming via SSE):
  - 1 minute: Waiter brings warm bread and butter (TTFT ~ 200ms).
  - 3 minutes: Fresh soup arrives.
  - 8 minutes: Main course arrives.
  - Customer is engaged, happy, and eating continuously while the rest cooks.
```

---

## 3. The Mechanism: Server-Sent Events (SSE) and Asynchronous Coroutines

Production streaming backends combine standard web protocols with asynchronous Python event loops.

### 1. The Server-Sent Events (SSE) Protocol

SSE is a W3C web standard operating over standard HTTP/1.1 or HTTP/2:
- The server responds with `Content-Type: text/event-stream` and `Cache-Control: no-cache`.
- The connection remains open in a streaming chunked transfer mode (`Transfer-Encoding: chunked`).
- Messages are formatted as plain text blocks separated by double newlines (`\n\n`):

```http
data: {"token": "The"}

data: {"token": " capital"}

data: {"token": " of"}

data: [DONE]
```
Browsers natively consume this stream using the `EventSource` API or standard `fetch()` readers without custom binary socket protocols.

### 2. Asynchronous Python Concurrency

In Python, synchronous code (`time.sleep(5)` or blocking requests) halts the entire OS thread. FastAPI uses Python's `asyncio` event loop:
- Coroutines defined with `async def` yield execution when waiting on network I/O:
  ```python
  async for chunk in client.chat.completions.create(..., stream=True):
      yield f"data: {chunk}\n\n"
  ```
- While Request A is waiting 30ms for the GPU to emit its next token, the event loop switches to serve Request B, C, and D, allowing a single server instance to handle hundreds of concurrent streams.

### 3. Handling Client Disconnects & Ghost Generations

If a user closes their browser tab or clicks "Cancel" mid-stream:
- In naive code, the server continues generating tokens in the background until reaching `max_tokens`, wasting expensive GPU compute.
- In production, the generator must check `await request.is_disconnected()` after each token. If true, the generator breaks out of the loop and terminates the upstream model call immediately.

---

## 4. Diagram: The SSE Streaming HTTP Lifecycle

```text
[ Browser / Frontend Client ]                [ FastAPI Async Gateway ]           [ vLLM / OpenAI Engine ]
             │                                          │                                    │
             ├─── POST /api/chat {prompt} ─────────────►│                                    │
             │    Accept: text/event-stream             ├─── Submits Async Stream ──────────►│
             │                                          │    stream=True                     │
             │◄── HTTP 200 OK ──────────────────────────┤                                    │
             │    Content-Type: text/event-stream       │                                    │
             │                                          │◄── Emits Token "Machine" ──────────┤
             │◄── data: {"delta": "Machine"}\n\n ───────┤                                    │
             │                                          │◄── Emits Token " Learning" ────────┤
             │◄── data: {"delta": " Learning"}\n\n ─────┤                                    │
             │                                          │                                    │
   (User closes tab / clicks Stop)                      │                                    │
             X─────────────────────────────────────────►│                                    │
                                                        ├─── Detects Disconnect! ───────────►│
                                                        │    Cancels Upstream Request        └── (GPU releases KV-cache)
```

---

## 5. Code Walkthrough: Production FastAPI SSE Streaming with Disconnect Detection

Here is an end-to-end production FastAPI microservice implementing token streaming, JSON event serialization, and automated client disconnect termination:

```python
import asyncio
import json
from typing import AsyncGenerator
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Production AI Streaming Backend")

# 1. Request Payload Schema
class ChatRequest(BaseModel):
    prompt: str
    temperature: float = 0.0
    max_tokens: int = 100

# 2. Simulated Upstream Token Streamer (e.g. vLLM or OpenAI client)
async def mock_llm_stream_generator(prompt: str) -> AsyncGenerator[str, None]:
    """Simulates an autoregressive LLM generating tokens with 30ms inter-token latency."""
    response_tokens = [
        "In", " modern", " software", " engineering,", " artificial", " intelligence",
        " operates", " as", " a", " statistical", " inference", " layer", " augmenting",
        " deterministic", " application", " logic", " across", " distributed", " backends."
    ]
    for token in response_tokens:
        await asyncio.sleep(0.04)  # Simulate GPU memory-bandwidth decode latency
        yield token

# 3. Production SSE Event Generator with Cancellation Detection
async def sse_event_streamer(
    request: Request, 
    prompt: str
) -> AsyncGenerator[str, None]:
    try:
        # Initial preamble metadata event
        yield f"event: metadata\ndata: {json.dumps({'status': 'generation_started'})}\n\n"

        token_generator = mock_llm_stream_generator(prompt)
        
        async for token in token_generator:
            # CRITICAL PRODUCTION CHECK: Check if client closed connection
            if await request.is_disconnected():
                print(f"[CANCELLATION] Client disconnected mid-stream for prompt: '{prompt[:20]}...'. Halting compute.")
                break

            # Format strictly according to SSE specification
            event_payload = json.dumps({"token": token})
            yield f"data: {event_payload}\n\n"

        # Final end-of-stream delimiter
        yield "data: [DONE]\n\n"
        
    except asyncio.CancelledError:
        print("[CANCELLED] Task cancelled by upstream ASGI server.")
        raise
    except Exception as e:
        error_payload = json.dumps({"error": str(e)})
        yield f"event: error\ndata: {error_payload}\n\n"

# 4. FastAPI Streaming Endpoint
@app.post("/api/v1/chat/stream")
async def chat_stream_endpoint(request: Request, body: ChatRequest):
    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    return StreamingResponse(
        sse_event_streamer(request, body.prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disables proxy buffering in NGINX!
        }
    )

if __name__ == "__main__":
    import uvicorn
    print("Starting production AI streaming server on http://localhost:8000...")
    # Run server
    # uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 6. Comparing Streaming Protocols: Polling vs WebSockets vs SSE

### Protocol Comparison Matrix

| Feature | Short / Long Polling | WebSockets | Server-Sent Events (SSE) |
|---|---|---|---|
| **Directionality** | Client requests; server responds | Full-Duplex (Bidirectional) | **Unidirectional (Server to Client)** |
| **Transport Protocol** | Standard HTTP | Upgraded TCP Socket | **Standard HTTP/1.1 or HTTP/2** |
| **Proxy / Load Balancer Support** | Excellent | Difficult (requires sticky sessions) | **Excellent** (standard HTTP reverse proxy) |
| **Reconnection Handling** | Manual implementation | Manual implementation | **Built-in native browser auto-reconnect** |
| **Data Format** | Any (JSON, binary) | Binary or text frames | UTF-8 text streams (`data: ...\n\n`) |
| **Production Fit for LLMs** | Terrible (high latency, high overhead) | Overkill for simple prompt-to-response | **Universal Industry Standard** |

---

## 7. Common Mistakes

- **Forgetting `X-Accel-Buffering: no`.** When placing a streaming FastAPI service behind an NGINX reverse proxy, NGINX buffers HTTP responses by default. It holds the entire 600-word response until the buffer fills, completely neutralizing streaming for the end-user. Always send `X-Accel-Buffering: no`.
- **Using synchronous blocking calls inside an `async def` endpoint.** Calling synchronous code (like `time.sleep()`, synchronous `requests.get()`, or raw synchronous database drivers) inside an async endpoint blocks the entire `asyncio` event loop, freezing all other concurrent streaming sessions on that process!
- **Not catching client disconnects.** Failing to monitor `request.is_disconnected()` leaves background tasks running to completion when users navigate away, causing GPU memory congestion and wasted API credits.
- **Malformed SSE syntax.** Omitting the double newline (`\n\n`) at the end of each SSE chunk prevents the browser's `EventSource` parser from dispatching the message event.

---

## 8. Hands-On Exercises

**Exercise 1:** Write a Python client using the `httpx` library that connects to an SSE endpoint and streams tokens to `sys.stdout` using `async for line in response.aiter_lines():`.

**Exercise 2:** Implement an NGINX reverse proxy configuration block that forwards requests to a local FastAPI backend while disabling response buffering for `/api/v1/chat/stream`.

**Exercise 3:** Build a frontend JavaScript snippet using the browser `fetch()` API and `ReadableStreamDefaultReader` that decodes streaming chunks and appends tokens to a DOM `<div>` element in real time.

**Exercise 4:** Implement a streaming heartbeat: if the LLM takes longer than 2 seconds to generate its next token (e.g. during a long tool execution), emit an SSE comment `: ping\n\n` to prevent intermediary load balancers from dropping the connection.

**Exercise 5:** Test cancellation: write a test client that initiates an SSE stream, reads 5 tokens, and forcefully aborts the connection with `client.aclose()`. Verify that the server logs a cancellation event within 100ms.

---

## 9. Interview Q&A

**Q: What is the difference between Time-to-First-Token (TTFT) and Inter-Token Latency (ITL), and which one does SSE streaming optimize?**
- **Time-to-First-Token (TTFT)**: The duration from when the user submits their request to when the client receives the very first token. It measures the prompt prefill phase (embedding lookup, attention computation over prompt tokens) plus initial network roundtrips.
- **Inter-Token Latency (ITL)**: The average time elapsed between generating each successive token during autoregressive decoding. 
SSE streaming fundamentally optimizes **perceived user latency** by bringing TTFT down to the time of the very first token ($\approx 200–500\text{ms}$) instead of forcing the user to wait for the entire generation to finish ($5–15\text{ seconds}$). The user begins reading immediately while subsequent tokens stream at the rate of ITL.

**Q: Why does NGINX require `X-Accel-Buffering: no` for streaming endpoints?**
By default, NGINX operates as a buffering reverse proxy: it reads responses from backend application servers into internal memory buffers and only flushes data to the client once the buffer is full (e.g. 4KB or 8KB) or when the connection closes. For a streaming LLM response, each token is only 4 to 8 bytes. NGINX will buffer hundreds of tokens before flushing, defeating the entire streaming experience and causing text to appear in jarring, delayed bursts. Sending the HTTP header `X-Accel-Buffering: no` instructs NGINX to disable response buffering and flush each chunk down the socket immediately.

**Q: How does `asyncio` handle hundreds of concurrent streaming connections on a single CPU core?**
`asyncio` runs a single-threaded event loop utilizing cooperative multitasking. When a streaming connection is waiting on I/O (e.g. awaiting the next token chunk from a remote vLLM GPU server or network socket), it yields execution control back to the event loop via `await`. The event loop immediately switches to process ready I/O events for other active connections. Because waiting on network I/O consumes almost zero CPU cycles, a single Python process can maintain thousands of concurrent streaming connections with minimal memory overhead compared to spawning thousands of heavy OS threads.

**Q: What happens if an exception is raised in the middle of an SSE generator stream?**
In standard REST endpoints, an unhandled exception returns an HTTP 500 status code. In an active SSE stream, the HTTP headers (`HTTP/1.1 200 OK`) have already been sent down the wire at the beginning of the stream! The server cannot retroactively change the HTTP status code. To communicate the failure gracefully:
1. The generator wraps generation in a `try...except` block.
2. It yields a custom SSE event type: `event: error\ndata: {"message": "Internal engine failure"}\n\n`.
3. It closes the stream cleanly, allowing the client-side JavaScript reader to catch the error event and display an informative alert.

**Q: Why is chunked transfer encoding (`Transfer-Encoding: chunked`) required for streaming LLM responses in HTTP/1.1?**
In standard HTTP/1.1, the server must provide a `Content-Length` header indicating the exact total byte count of the response body so the client knows when transmission is complete. In an autoregressive LLM response, the server does not know in advance how many tokens the model will generate before reaching a `<stop>` token. Setting `Transfer-Encoding: chunked` informs the client that the body will be transmitted as a stream of self-delimiting data chunks without a predetermined content length, terminating only when an empty zero-length chunk is received.
