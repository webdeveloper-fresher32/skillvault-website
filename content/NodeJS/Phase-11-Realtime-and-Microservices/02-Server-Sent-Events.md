# Server-Sent Events (SSE) — Complete Guide

## Table of Contents
1. [What are Server-Sent Events?](#1-what-are-server-sent-events)
2. [SSE vs WebSockets](#2-sse-vs-websockets)
3. [The SSE Protocol](#3-the-sse-protocol)
4. [Complete Example: Live Notifications Feed](#4-complete-example-live-notifications-feed)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. What are Server-Sent Events?

SSE is a standard that lets a server push a stream of text events to a browser over a single, long-lived **HTTP connection** — no protocol upgrade, no special library on the server. The browser's native `EventSource` API handles the connection, parsing, and automatic reconnection.

```
Client                                    Server
  │── GET /events (Accept: text/event-stream) ──▶│
  │                                                │  connection stays open
  │◀── data: {"type":"notify","msg":"..."} ──────│  (server pushes whenever it has data)
  │                                                │
  │◀── data: {"type":"notify","msg":"..."} ──────│
  │        ...connection remains open indefinitely...
```

It's just HTTP with `Content-Type: text/event-stream` and a response that never ends — the server keeps writing chunks, the browser keeps reading them.

---

## 2. SSE vs WebSockets

| Aspect | SSE | WebSockets |
|--------|-----|------------|
| Direction | Server → Client only | Bidirectional |
| Protocol | Plain HTTP (no upgrade) | Requires protocol upgrade |
| Browser API | Native `EventSource` (no library needed) | Native `WebSocket` (or Socket.io) |
| Auto-reconnect | Built into the browser | Manual (or via Socket.io) |
| Data format | Text only (UTF-8) | Text or binary |
| Proxy/firewall friendliness | Excellent — it's just HTTP | Can be blocked by strict proxies |
| Max connections per browser | Limited by HTTP/1.1 connection limits (6 per domain) — HTTP/2 removes this | Not an issue |
| Typical use cases | Notifications, live feeds, progress updates, stock tickers | Chat, games, collaborative editing, anything needing client → server push |

### Decision Guide

```
Does the client ever need to push data to the server over the SAME channel?
  │
  ├── No, client only needs to POST occasionally via normal REST calls,
  │   and mostly RECEIVES updates
  │        → SSE is simpler: no new protocol, no extra library, auto-reconnect free
  │
  └── Yes, client and server both push frequently on one channel (chat, games)
           → WebSockets (or Socket.io) — SSE can't send client → server on the stream
```

SSE is the right tool when the data flow is fundamentally one-directional (server informs client) and you want to avoid the complexity of WebSocket infrastructure.

---

## 3. The SSE Protocol

The wire format is plain text, line-based:

```
data: hello world\n\n

event: notification\n
data: {"id": 1, "text": "New message"}\n\n

id: 42\n
event: update\n
data: {"count": 5}\n\n

: this is a comment/heartbeat, ignored by the client\n\n
```

Fields:

| Field | Purpose |
|-------|---------|
| `data:` | The payload (required). Multiple `data:` lines are joined with `\n`. |
| `event:` | Optional event name (defaults to `message`). Lets the client listen for specific event types. |
| `id:` | Optional event ID. Browser tracks the last-seen ID and sends it back via `Last-Event-ID` header on reconnect, so the server can resume the stream. |
| `retry:` | Optional reconnection delay in milliseconds. |
| Lines starting with `:` | Comments — often used as heartbeats to keep the connection alive through proxies. |

Every event block **must end with a blank line** (`\n\n`) — that's how the client knows one event is complete.

### Required Server Headers

```javascript
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
});
```

---

## 4. Complete Example: Live Notifications Feed

A notifications service: clients connect once, and the server pushes new notifications as they occur (e.g., "order shipped", "new comment"). Includes reconnection support via `Last-Event-ID` and periodic heartbeats.

### Server

```javascript
// notifications-server.js
const express = require('express');
const app = express();
app.use(express.json());

// Each connected client gets an entry: { id, res }
const clients = new Map();
let nextClientId = 1;
let nextEventId = 1;

// In-memory notification log, so we can replay missed events on reconnect
const notificationLog = [];

app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  const clientId = nextClientId++;
  clients.set(clientId, res);
  console.log(`Client ${clientId} connected. Total: ${clients.size}`);

  // Replay any notifications the client missed while disconnected
  const lastEventId = Number(req.headers['last-event-id']) || 0;
  for (const note of notificationLog) {
    if (note.id > lastEventId) sendEvent(res, note);
  }

  // Heartbeat comment every 15s keeps proxies/load balancers from closing the idle connection
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected. Total: ${clients.size}`);
  });
});

function sendEvent(res, note) {
  res.write(`id: ${note.id}\n`);
  res.write(`event: notification\n`);
  res.write(`data: ${JSON.stringify(note.payload)}\n\n`);
}

function broadcastNotification(payload) {
  const note = { id: nextEventId++, payload };
  notificationLog.push(note);
  if (notificationLog.length > 100) notificationLog.shift(); // cap the replay buffer

  for (const res of clients.values()) {
    sendEvent(res, note);
  }
}

// Simulate an internal event that triggers a notification (e.g., from an order service)
app.post('/notify', (req, res) => {
  const { message } = req.body;
  broadcastNotification({ message, timestamp: new Date().toISOString() });
  res.json({ status: 'broadcast', recipients: clients.size });
});

app.listen(3000, () => console.log('Notifications server on :3000'));
```

### Client

```html
<!-- notifications.html -->
<!DOCTYPE html>
<html>
<head><title>Live Notifications</title></head>
<body>
  <h2>Notifications</h2>
  <ul id="feed"></ul>

  <script>
    const feed = document.getElementById('feed');
    const source = new EventSource('http://localhost:3000/events');

    source.addEventListener('notification', (event) => {
      const data = JSON.parse(event.data);
      const li = document.createElement('li');
      li.textContent = `[${data.timestamp}] ${data.message}`;
      feed.prepend(li);
    });

    source.onopen = () => console.log('SSE connection opened');

    source.onerror = (err) => {
      // EventSource auto-reconnects on its own; this just logs the event
      console.warn('SSE connection error, browser will retry automatically', err);
    };
  </script>
</body>
</html>
```

### Trigger a Notification

```bash
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Your order has shipped!"}'
```

Every open browser tab connected to `/events` receives the notification instantly.

### Data Flow Diagram

```
                     ┌─────────────────────────┐
POST /notify ───────▶│  Notifications Server    │
(from order service, │                          │
 cron job, etc.)     │  clients: Map<id, res>   │
                     └───────────┬──────────────┘
                                 │ res.write() to every open connection
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
           Browser Tab 1   Browser Tab 2   Browser Tab 3
           (EventSource)   (EventSource)   (EventSource)
```

---

## 5. Hands-On Exercises

**Exercise 1:** Run the notifications server, open `notifications.html` in two browser tabs, and POST to `/notify` via curl. Confirm both tabs update instantly.

**Exercise 2:** Kill the server, restart it, and reload one tab. Verify the browser's `EventSource` reconnects automatically (check the Network tab — the request retries).

**Exercise 3:** Extend the server to support per-user notifications: add a `userId` query param to `/events`, store `clients` keyed by userId, and have `/notify` accept a target `userId` to send to only that user.

**Exercise 4:** Implement the `Last-Event-ID` replay properly: disconnect a client (close the tab), POST 3 notifications while it's offline, then reopen the tab and confirm all 3 missed notifications appear (the browser sends `Last-Event-ID` automatically on reconnect).

**Exercise 5:** Add a `retry: 3000\n` field to the SSE stream and explain (in a comment) what changes about reconnection behavior compared to the browser's default.

---

## 6. Interview Q&A

**Q: What is Server-Sent Events and how does it differ fundamentally from WebSockets?**
Answer: SSE is a one-directional streaming protocol built on plain HTTP — the server keeps a response open and writes text-formatted events (`data: ...\n\n`) over time, while the browser's native `EventSource` API reads them. Unlike WebSockets, there's no protocol upgrade and no client-to-server push over the same channel — SSE is inherently server-to-client only, and any client input goes through separate normal HTTP requests.

**Q: Why would you choose SSE over WebSockets for a notifications feature?**
Answer: If the client never needs to push data on the same channel — it only receives updates — SSE is simpler: it's plain HTTP so it passes through proxies/firewalls without special configuration, the browser's `EventSource` handles automatic reconnection with no extra library, and the server-side code is just writing to a normal HTTP response. WebSockets would be overkill and add complexity (managing reconnection, framing) for a purely one-way stream.

**Q: How does automatic reconnection work with SSE, and how can the server avoid re-sending events the client already received?**
Answer: The browser's `EventSource` automatically retries the connection if it drops, using a delay controlled by the server's `retry:` field (default ~3 seconds). Each event can carry an `id:` field; when reconnecting, the browser automatically sends the last received ID back via a `Last-Event-ID` request header. The server should keep a short buffer or log of recent events and replay everything with an ID greater than `Last-Event-ID` so the client doesn't miss data during the gap.

**Q: What's a heartbeat in the context of SSE, and why is it needed?**
Answer: A heartbeat is a periodic no-op message (typically an SSE comment line starting with `:`) written to the stream even when there's no real data to send. It's needed because idle HTTP connections can be silently closed by proxies, load balancers, or browsers after a timeout; writing a small keep-alive chunk every 15-30 seconds prevents the connection from being reaped and lets the client detect a dead connection faster.

**Q: What are SSE's practical limitations compared to WebSockets?**
Answer: SSE only supports UTF-8 text (no binary), it's one-directional, and under HTTP/1.1 browsers cap concurrent connections per domain (commonly 6), which can be a problem if a page opens multiple SSE streams — HTTP/2 removes this limit by multiplexing over one connection. WebSockets have no such direction or per-domain connection constraints and support binary frames, but require more infrastructure work (upgrade handling, manual reconnection logic unless using a library like Socket.io).
