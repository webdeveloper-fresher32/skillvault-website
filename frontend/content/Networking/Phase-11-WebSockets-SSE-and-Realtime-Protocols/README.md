# Phase 11 — WebSockets, SSE, and Real-Time Protocols

## Overview

Plain HTTP was built for a client that asks and a server that answers, once, then the connection is done. That model breaks the moment you need a chat message, a stock price tick, or a notification to reach the browser the instant it happens on the server — with nobody asking. This phase is about the **protocol-level mechanics** that solve that problem: what actually travels over the wire when a WebSocket connection "upgrades" from HTTP, what a WebSocket frame looks like, and how Server-Sent Events piggyback a live stream on top of an ordinary HTTP response.

This phase deliberately stays below the application layer. You will not find Socket.io room/namespace code or Express SSE handlers here — that implementation depth already lives in this repo at:

**`../../NodeJS/Phase-11-Realtime-and-Microservices/`**
- `01-WebSockets-and-Socketio.md` — Socket.io server/client setup, rooms, namespaces, a full chat app
- `02-Server-Sent-Events.md` — Express SSE handler, live notification feed, client-side `EventSource`

Read this phase first (or alongside) if you've ever wondered *why* `ws.send()` works the way it does, why the handshake needs a `Sec-WebSocket-Key`, or why SSE reconnects automatically but WebSockets don't. Then go to the NodeJS phase to see it built.

## Lessons

| # | Lesson | What You'll Learn |
|---|--------|--------------------|
| 01 | [The Limits of Request-Response](01-The-Limits-of-Request-Response.md) | Why HTTP's request/response model can't push data to clients, short polling and long polling explained with sequence diagrams, why both are workarounds rather than solutions |
| 02 | [The WebSocket Protocol](02-The-WebSocket-Protocol.md) | The HTTP Upgrade handshake shown literally header-by-header, `Sec-WebSocket-Key`/`Accept` mechanics, full-duplex framing, why WebSocket needed a new protocol instead of reusing HTTP |
| 03 | [Server-Sent Events at the Protocol Level](03-Server-Sent-Events-Protocol-Level.md) | The `text/event-stream` format shown literally, how SSE reuses plain HTTP instead of upgrading, built-in reconnection via `Last-Event-ID`, WebSocket vs SSE vs long polling comparison |

## Time Estimate

**3–4 hours** (reading + hands-on exercises), spread over 1–2 sessions.

## Prerequisites

- Phase 05 (HTTP/HTTPS Fundamentals) — you should be comfortable reading raw HTTP request/response headers.
- Phase 02 (TCP vs UDP) — WebSocket and SSE both ride on a single persistent TCP connection; it helps to know what that means underneath HTTP.

## What's Next

Phase 12 pulls everything in this course together into structured interview prep — including "how would you build a live chat feature" style system-design questions that draw directly on this phase.
