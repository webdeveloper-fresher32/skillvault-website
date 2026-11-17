# Module 8: Real-Time SSE Streaming & Protocol Engineering

| Specification | Details |
| :--- | :--- |
| **Module Number** | 08 of 12 |
| **Topic** | Server-Sent Events (SSE), Multiplexed Typed Events, Edge Buffering Mitigation & Heartbeats |
| **Target System** | Python FastAPI, Node.js Gateway Proxy, NGINX / Cloudflare Edge, Next.js Client |
| **Engineering Level** | Staff Network Protocols & Distributed Systems Engineer |

---

## 1. Streaming Protocol Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FASTAPI ASGI PRODUCER                                 │
│  Yields formatted SSE chunks: "event: <type>\ndata: <json>\n\n"                       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP/2 Chunked Stream
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          NODE.JS REVERSE PROXY PIPELINE                                │
│  - Sets: 'X-Accel-Buffering: no' (Disables NGINX proxy buffering)                      │
│  - Sets: 'Cache-Control: no-cache, no-transform' (Prevents CDN compression buffering)   │
│  - Pipes bytes directly to client response without buffering into memory               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS CLIENT SSE PARSER                                 │
│  - Dispatches typed events directly to corresponding React component state             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Event Specification & Framing

Every packet conforms strictly to the W3C Server-Sent Events specification:
`event: <event_type>\ndata: <json_string>\n\n`

| Event Type | Payload Schema | UI Component Triggered |
| :--- | :--- | :--- |
| **`thought`** | `{"step": "Searching Spring Boot Security chunks..."}` | Reasoning Accordion (displays active internal cognitive step) |
| **`tool_call`** | `{"tool": "get_tasks", "params": {"status": "TODO"}}` | Tool Status Chip (shows spinning execution indicator) |
| **`tool_result`**| `{"tasks": [...]}` | Tool Result Summary (renders task count or table preview) |
| **`chunk`** | `{"delta": "In Spring Boot 3..."}` | Markdown Stream Viewer (appends text with smooth cursor) |
| **`citation`** | `[{"documentId": "...", "title": "...", "chunkId": "..."}]`| Citation Badge Bar (renders clickable document pills) |
| **`confirmation_required`** | `{"action": "delete_project", "params": {...}}` | Modal Dialog (blocks until user clicks "Approve" or "Cancel") |
| **`done`** | `{"total_tokens": 412, "latency_ms": 680}` | Finalizes message; re-enables chat input box |
| **`error`** | `{"code": "RATE_LIMIT_EXCEEDED", "message": "..."}` | Error Toast with retry action |

---

## 3. Concrete Code Implementation

### 3.1 Node.js Gateway Reverse-Streaming Proxy (`src/controllers/chat.controller.ts`)
```typescript
import { Request, Response } from 'express';
import http from 'http';

export async function proxyChatStream(req: Request, res: Response) {
  // 1. Set critical headers to prevent proxy and CDN buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Crucial for NGINX edge reverse proxies

  res.flushHeaders();

  const aiServiceUrl = new URL('http://backend-ai:8000/api/v1/ai/chat/stream');
  
  const proxyReq = http.request(
    aiServiceUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': req.tenantId || '',
        'X-User-ID': req.user?.userId || '',
        'X-User-Role': req.user?.role || 'MEMBER',
      },
    },
    (proxyRes) => {
      // Pipe incoming SSE chunks straight to the browser without buffering
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error('AI Proxy Error:', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'AI_SERVICE_UNAVAILABLE' })}\n\n`);
    res.end();
  });

  // Client aborted or closed tab -> abort backend AI request immediately
  req.on('close', () => {
    proxyReq.destroy();
  });

  proxyReq.write(JSON.stringify(req.body));
  proxyReq.end();
}
```

### 3.2 Heartbeat Generator (`app/core/stream_heartbeat.py`)
```python
import asyncio
import json

async def with_keepalive_heartbeat(generator, interval_seconds: float = 15.0):
    """
    Wraps an async generator with periodic comment pings (: ping\n\n)
    to prevent aggressive cellular NAT / firewall timeouts during slow tool calls.
    """
    queue = asyncio.Queue()

    async def consume_inner():
        async for item in generator:
            await queue.put(item)
        await queue.put(None) # Sentinel indicating completion

    consumer_task = asyncio.create_task(consume_inner())

    while True:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=interval_seconds)
            if item is None:
                break
            yield item
        except asyncio.TimeoutError:
            # Emit standard SSE comment line (ignored by clients, keeps TCP socket active)
            yield ": ping\n\n"

    await consumer_task
```

---

## 4. Production Network Failure Modes

| Network Scenario | Failure Risk | Protocol Remediation |
| :--- | :--- | :--- |
| **NGINX / Vercel Edge Buffering** | Proxy holds chunks in 4KB buffer; response appears all at once after 4s | Injected `X-Accel-Buffering: no` and `Cache-Control: no-transform` headers disable proxy buffers. |
| **Cellular NAT Timeout (Mobile)** | Long tool execution (5s) causes carrier NAT to drop silent TCP socket | Background heartbeat generator emits `: ping\n\n` comments every 15s to keep socket alive. |
| **Client Aborts Stream** | User navigates away; server continues generating expensive tokens | Node.js `req.on('close')` destroys upstream proxy connection; FastAPI `is_disconnected()` terminates LangGraph. |
