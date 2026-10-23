# Server-Sent Events (SSE) at the Protocol Level — Complete Guide

## Table of Contents
1. [Why SSE Instead of WebSockets](#1-why-sse-instead-of-websockets)
2. [How SSE Works](#2-how-sse-works)
3. [Built-In Reconnection and State Recovery](#3-built-in-reconnection-and-state-recovery)
4. [WebSockets vs. SSE vs. Polling](#4-websockets-vs-sse-vs-polling)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. Why SSE Instead of WebSockets

WebSockets are powerful, but they represent a massive paradigm shift. You have to abandon HTTP entirely, use a binary framing protocol, and write custom logic to handle reconnection if the TCP socket drops.

What if you just want a simple one-way stream of data from the server to the client (like a live stock ticker or a Twitter feed)?
You don't need the client to stream data *back* to the server simultaneously.

**Server-Sent Events (SSE)** is the answer. It provides a real-time, one-way stream using nothing but standard, plain HTTP.

---

## 2. How SSE Works

SSE is not a new protocol. It is literally just a very long, infinite HTTP response.

1. **Client Request:**
   The browser makes a standard HTTP GET request, telling the server it expects an event stream.
   ```http
   GET /stock-ticker HTTP/1.1
   Host: example.com
   Accept: text/event-stream
   ```

2. **Server Response:**
   The server responds with an `HTTP 200 OK`, but it sets the `Content-Type` to `text/event-stream`.
   Crucially, the server **does not close the connection**. It keeps the TCP socket open.
   ```http
   HTTP/1.1 200 OK
   Content-Type: text/event-stream
   Cache-Control: no-cache
   Connection: keep-alive
   ```

3. **Streaming Data:**
   Whenever the server has a new stock price, it just writes a few lines of text to the open HTTP connection and flushes the buffer.

   The data format is incredibly simple. Every event is separated by two newline characters (`\n\n`).

   ```text
   data: {"symbol": "AAPL", "price": 150.25}

   data: {"symbol": "TSLA", "price": 900.50}

   ```
   The browser's `EventSource` API receives each chunk of text, parses the JSON, and fires a JavaScript event.

---

## 3. Built-In Reconnection and State Recovery

If a user drives through a tunnel and their 4G connection drops, the TCP socket is severed.

With WebSockets, the connection dies, and the developer must manually write JavaScript to detect the failure, wait a few seconds, reconnect, and ask the server for any messages missed during the downtime.

**SSE handles this entirely automatically at the protocol level.**

When sending an event, the server can optionally include an `id`:
```text
id: 1045
data: {"symbol": "AAPL", "price": 150.25}

```

If the connection drops, the browser automatically (without any JavaScript code) attempts to reconnect via a new HTTP request. When it does, it sends a special header indicating the last ID it saw:

```http
GET /stock-ticker HTTP/1.1
Host: example.com
Accept: text/event-stream
Last-Event-ID: 1045
```

The server reads this header, queries its database for any events that occurred after ID 1045, and immediately streams them down to the client so no data is lost.

---

## 4. WebSockets vs. SSE vs. Polling

| Feature | Long Polling | Server-Sent Events (SSE) | WebSockets |
| :--- | :--- | :--- | :--- |
| **Direction** | Client pulls | Server pushes (One-way) | Bidirectional (Full Duplex) |
| **Protocol** | Standard HTTP | Standard HTTP | Upgraded Binary Protocol |
| **Data Format** | JSON/XML/Text | UTF-8 Text Only | Binary or UTF-8 Text |
| **Reconnection**| Manual JS | **Automatic built-in** | Manual JS |
| **Best For** | Legacy browsers only | Stock tickers, News feeds, Notifications | Multiplayer Games, Chat apps, Live Collaboration |

---

## 5. Hands-On Exercises

**Exercise 1:** Write a minimal Node.js or Python HTTP endpoint that sets `Content-Type: text/event-stream` and writes a `data: ...` line every second without ever closing the response. Connect to it with `curl -N http://localhost:3000/stream` and watch events arrive live.

**Exercise 2:** In the browser console, run `const es = new EventSource('/stream'); es.onmessage = e => console.log(e.data);` against your server from Exercise 1, and confirm events appear as JavaScript events.

**Exercise 3:** Add an `id:` field to each event on your server. Kill the server mid-stream, restart it, and inspect (via DevTools Network tab) the automatic reconnect request — confirm it carries a `Last-Event-ID` header matching the last ID the client saw.

**Exercise 4:** Use Wireshark or `curl -v` to compare the raw bytes of an SSE stream against a WebSocket connection to the same host — confirm the SSE traffic still looks like ordinary chunked HTTP/1.1, while WebSocket traffic switches to binary frames after the 101 response.

**Exercise 5:** Try sending a Base64-encoded image over your SSE endpoint as a `data:` line, and measure the payload size increase compared to sending the raw binary bytes over a WebSocket, to see the ~33% overhead in practice.

---

## 6. Interview Q&A

**Q: If I'm building a live sports score app, should I use WebSockets or SSE?**
Answer: SSE is the perfect fit. The data flows purely in one direction (server to client). SSE is far simpler to implement, works natively over standard HTTP without load balancer configuration headaches, and provides built-in reconnection logic. WebSockets would be overkill because the client doesn't need to stream data back to the server.

**Q: Can I send binary data (like an image) over SSE?**
Answer: Not natively. SSE strictly requires the payload to be UTF-8 text because it relies on newline characters (`\n\n`) to frame the messages. If you must send an image over SSE, you would have to Base64 encode it into a text string, which increases the file size by ~33%. If heavy binary streaming is required, WebSockets are the better choice.

**Q: Do I need a special server library to support SSE?**
Answer: No. Because SSE is just a standard HTTP response that is left open, you can implement it natively in almost any language (Node, Python, Go) simply by setting the `Content-Type: text/event-stream` header and writing strings to the response buffer without closing it.

**Q: How does the browser know to automatically reconnect an SSE stream, and how does it avoid missing data?**
Answer: The `EventSource` API has built-in reconnection logic at the protocol level — if the underlying HTTP connection drops, the browser automatically issues a new GET request after a short delay. It includes a `Last-Event-ID` header set to the ID of the last event it successfully received, and a correctly implemented server uses that ID to replay any events the client missed, all without any custom JavaScript.

**Q: Can SSE be load balanced the same way as regular HTTP traffic?**
Answer: Yes, and this is one of its biggest practical advantages over WebSockets. Because an SSE connection is just a long-lived, ordinary HTTP response, standard L7 load balancers and reverse proxies already understand how to route and hold it open — there's no need for special `Upgrade` header handling as with WebSockets, though idle timeouts still need to be tuned high enough to avoid the proxy cutting the stream.
