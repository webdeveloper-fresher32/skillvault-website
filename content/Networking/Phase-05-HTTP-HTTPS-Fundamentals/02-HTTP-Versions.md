# HTTP Versions — Complete Guide

## Table of Contents
1. [Why Versions Exist](#1-why-versions-exist)
2. [HTTP/1.0 — One Request, One Connection](#2-http10--one-request-one-connection)
3. [HTTP/1.1 — Keep-Alive and Pipelining](#3-http11--keep-alive-and-pipelining)
4. [HTTP/2 — Multiplexing and Binary Framing](#4-http2--multiplexing-and-binary-framing)
5. [HTTP/3 — QUIC Over UDP](#5-http3--quic-over-udp)
6. [Comparison Table](#6-comparison-table)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Versions Exist

Each HTTP version exists because the previous one had a specific, well-understood performance problem when the web got more complex — more requests per page, more concurrent users, lossier networks (mobile). The story of HTTP versions is a story of chasing away one bottleneck at a time:

```
HTTP/1.0 → 1.1 : fixes "new TCP connection for every single request"
HTTP/1.1 → 2   : fixes "head-of-line blocking at the HTTP layer"
HTTP/2   → 3   : fixes "head-of-line blocking at the TCP layer itself"
```

---

## 2. HTTP/1.0 — One Request, One Connection

In HTTP/1.0 (1996), the default behavior was: open a TCP connection, send one request, get one response, **close the connection**. Every single resource — the HTML, then each CSS file, each image, each script — required its own fresh TCP handshake.

```
Page with 1 HTML + 3 images:

Request 1: [TCP handshake] → GET /index.html  → response → [close]
Request 2: [TCP handshake] → GET /logo.png    → response → [close]
Request 3: [TCP handshake] → GET /banner.png  → response → [close]
Request 4: [TCP handshake] → GET /icon.png    → response → [close]

4 resources = 4 full TCP handshakes = massive latency overhead
```

On a slow or high-latency network, the TCP handshake cost (at least one round trip) was being paid over and over for a single page load. This was the dominant bottleneck once web pages started embedding multiple images and stylesheets.

---

## 3. HTTP/1.1 — Keep-Alive and Pipelining

HTTP/1.1 (1997) made **persistent connections (keep-alive)** the default: the TCP connection stays open after a response, so subsequent requests to the same host can reuse it — no repeated handshake.

```
Page with 1 HTML + 3 images, HTTP/1.1 keep-alive:

[TCP handshake once] → GET /index.html → response
                     → GET /logo.png   → response   (same connection reused)
                     → GET /banner.png → response   (same connection reused)
                     → GET /icon.png   → response   (same connection reused)
```

HTTP/1.1 also introduced **pipelining** — sending multiple requests back-to-back without waiting for each response before sending the next. In theory this hides round-trip latency. In practice, pipelining was barely adopted, because of **head-of-line (HOL) blocking**: responses must come back in the *same order* the requests were sent, so if the first response is slow, everything behind it queues up even though it's ready.

```
Client pipelines 3 requests on one connection:

  Request A ──▶
  Request B ──▶
  Request C ──▶

  Response A  (slow — server is busy)      ◀── must arrive first
  Response B  (ready immediately)           ◀── STUCK waiting behind A
  Response C  (ready immediately)           ◀── STUCK waiting behind A and B

Result: B and C are done but can't be delivered out of order.
This is HOL blocking at the HTTP layer.
```

Because of this, most browsers never enabled pipelining by default — instead they opened **multiple parallel TCP connections** per host (typically 6) as a workaround, trading one bottleneck for connection overhead and server load.

---

## 4. HTTP/2 — Multiplexing and Binary Framing

HTTP/2 (2015, based on Google's SPDY) attacked the HOL blocking problem directly by changing the wire format entirely.

### Binary Framing

Instead of plain text, HTTP/2 breaks every request and response into small **binary frames**, each tagged with a **stream ID**. Frames from different streams can be interleaved on the same TCP connection and reassembled by ID on the other end.

```
Single TCP connection, HTTP/2:

Stream 1 (HTML):   [HEADERS frame][DATA frame][DATA frame]
Stream 3 (CSS):    [HEADERS frame][DATA frame]
Stream 5 (image):  [HEADERS frame][DATA frame][DATA frame][DATA frame]

On the wire, frames interleave:
[S1-HEADERS][S3-HEADERS][S5-HEADERS][S1-DATA][S5-DATA][S3-DATA][S1-DATA][S5-DATA]...

Receiver demultiplexes by stream ID → reassembles 3 independent responses.
```

### True Multiplexing

Because frames carry stream IDs, a slow response on stream 1 no longer blocks stream 3 or stream 5 from delivering their frames — this eliminates HTTP-layer HOL blocking entirely (see Lesson 04 for a deeper walkthrough with diagrams). A single TCP connection can now efficiently carry many concurrent requests, which is why HTTP/2 also discourages the old "6 parallel connections" workaround — one connection is enough.

### Header Compression (HPACK)

HTTP/1.1 sends full, verbose headers on *every single request* — including repetitive things like `User-Agent`, `Cookie`, `Accept-Language` that rarely change between requests to the same host. HTTP/2 uses **HPACK** compression: it maintains a shared table of previously-seen header fields between client and server, and subsequent requests can reference "same as before" instead of re-transmitting the full text — significantly shrinking overhead, especially on connections with many small requests.

### Server Push (mostly deprecated)

HTTP/2 also introduced server push (server proactively sends resources it predicts the client will need). In practice this proved hard to tune correctly and most major browsers have deprecated/removed support for it — worth knowing it exists, but not something to rely on today.

---

## 5. HTTP/3 — QUIC Over UDP

HTTP/2 solved HOL blocking *at the HTTP layer*, but a subtler problem remained *underneath* it: HOL blocking **at the TCP layer**. TCP guarantees in-order delivery of *all* bytes on a connection — so if a single packet is lost, TCP holds up delivery of every subsequent packet (even ones belonging to a completely different, unrelated HTTP/2 stream) until the lost packet is retransmitted and arrives.

```
TCP-level HOL blocking with HTTP/2 multiplexing:

Packets on the wire:  [Stream1-pkt][Stream3-pkt][Stream1-pkt][Stream3-pkt]
                                        │
                                   packet LOST
                                        │
                                        ▼
Even though Stream1's later packets arrived fine, TCP won't hand ANY of them
to the application until the lost Stream3 packet is retransmitted.
One lost packet stalls ALL streams on the connection.
```

HTTP/3 (standardized 2022) fixes this by abandoning TCP altogether and running over **QUIC**, a new transport protocol built on top of **UDP**.

```
HTTP/1.1 / HTTP/2 stack:          HTTP/3 stack:
┌─────────────┐                   ┌─────────────┐
│    HTTP     │                   │    HTTP/3    │
├─────────────┤                   ├─────────────┤
│  TLS (opt.) │                   │ QUIC (built-in TLS 1.3) │
├─────────────┤                   ├─────────────┤
│     TCP     │                   │     UDP      │
├─────────────┤                   ├─────────────┤
│      IP     │                   │      IP      │
└─────────────┘                   └─────────────┘
```

Key QUIC properties:
- **Per-stream loss recovery** — QUIC implements its own reliability *per stream*, so a lost packet only stalls the one stream it belongs to, not the whole connection. This finally kills HOL blocking at the transport level.
- **Built-in encryption** — TLS 1.3 is baked into the QUIC handshake itself (not layered on separately), which also means fewer round trips to establish a secure connection.
- **Faster connection setup** — QUIC can often combine what used to be separate TCP + TLS handshakes into a single round trip (or even zero round trips for resumed connections).
- **Connection migration** — a QUIC connection is identified by a connection ID, not an IP/port tuple, so switching networks (Wi-Fi to mobile data) doesn't require a fresh connection.

The tradeoff: UDP is not natively guaranteed to be handled well by every middlebox/firewall (some networks throttle or block UDP), so HTTP/3 deployments typically fall back to HTTP/2 when QUIC isn't reachable.

---

## 6. Comparison Table

| Feature | HTTP/1.0 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|---|
| Year | 1996 | 1997 | 2015 | 2022 |
| Transport | TCP | TCP | TCP | QUIC (over UDP) |
| Connection per request | Yes (new TCP each time) | No (keep-alive default) | No (one connection, multiplexed) | No (one QUIC connection, multiplexed) |
| Message format | Plain text | Plain text | Binary frames | Binary frames (QUIC packets) |
| Multiple concurrent requests | No | Pipelining (rarely used, HOL-blocked) | True multiplexing over one connection | True multiplexing, no transport-level HOL blocking |
| Header compression | No | No | Yes (HPACK) | Yes (QPACK) |
| Encryption | Separate (optional) | Separate (optional) | Separate (optional, but almost always used) | Built into QUIC (mandatory) |
| HOL blocking | N/A (one request at a time) | Yes, at HTTP layer | Fixed at HTTP layer, still present at TCP layer | Fixed at both layers |
| Problem it fixed | — | Repeated TCP handshakes | HTTP-layer HOL blocking, verbose repeated headers | TCP-layer HOL blocking, slow handshake setup |

---

## 7. Hands-On Exercises

**Exercise 1:** Run `curl -v --http1.1 https://example.com` then `curl -v --http2 https://www.google.com` (needs a server that supports HTTP/2) and compare the reported protocol version in curl's output.

**Exercise 2:** Open Chrome DevTools → Network tab → right-click the column header → enable the "Protocol" column. Reload a modern site (e.g. google.com or cloudflare.com) and observe which requests use `h2` vs `h3` vs `http/1.1`.

**Exercise 3:** Run `curl -v --http1.0 https://example.com` and check the `Connection` header in the response — compare it against the same request with default HTTP/1.1 to see the keep-alive difference.

**Exercise 4:** Research (or inspect via DevTools) whether your own company's production site or a well-known site (e.g. cloudflare.com) serves over HTTP/3 — look for an `alt-svc` response header advertising `h3`.

**Exercise 5:** Use `curl -v --http2 -o /dev/null https://http2.golang.org/reqinfo` (or any HTTP/2 test endpoint) and identify in the verbose output where curl reports stream usage.

---

## 8. Interview Q&A

**Q: What specific problem did HTTP/1.1's keep-alive fix compared to HTTP/1.0?**
Answer: HTTP/1.0 closed the TCP connection after every single request/response, forcing a fresh TCP handshake (and TLS handshake, if applicable) for every resource on a page. HTTP/1.1 made persistent connections the default, so one TCP connection can serve many sequential requests to the same host, eliminating repeated handshake overhead.

**Q: What is head-of-line blocking, and at which layer does it occur in HTTP/1.1 vs HTTP/2 vs HTTP/3?**
Answer: Head-of-line blocking is when one slow/blocked item holds up others behind it that are otherwise ready. In HTTP/1.1, it happens at the HTTP layer — pipelined responses must return in the exact order requested, so a slow response blocks faster ones queued behind it. HTTP/2 fixes this with multiplexed binary streams, but HOL blocking persists at the TCP layer — a single lost packet stalls all streams on the connection because TCP guarantees strict in-order byte delivery. HTTP/3 fixes this by replacing TCP with QUIC (over UDP), which does per-stream loss recovery, so a lost packet only stalls its own stream.

**Q: How does HTTP/2 achieve multiplexing, and why couldn't HTTP/1.1 pipelining achieve the same thing?**
Answer: HTTP/2 encodes every request/response as binary frames tagged with a stream ID, allowing frames from many concurrent streams to interleave on one TCP connection and be reassembled independently — responses can complete out of order. HTTP/1.1 pipelining sent requests back-to-back as plain text but still required responses to come back in the exact same order they were requested, so it couldn't avoid HOL blocking; it just hid the request round-trip, not the response ordering problem.

**Q: Why does HTTP/3 use UDP instead of TCP if UDP is unreliable?**
Answer: HTTP/3 doesn't use raw unreliable UDP — it runs QUIC on top of UDP, and QUIC re-implements reliability, ordering, and congestion control itself, but per-stream rather than per-connection. This lets QUIC avoid TCP's strict connection-wide in-order delivery guarantee, so a lost packet on one stream doesn't stall unrelated streams. UDP is used purely as a lightweight, unordered transport that QUIC can build its own smarter reliability layer on top of, since TCP's built-in ordering guarantee is exactly what caused HOL blocking in HTTP/2.

**Q: What is HPACK and why was it needed?**
Answer: HPACK is HTTP/2's header compression scheme. HTTP/1.1 re-sends full, often-repetitive headers (cookies, user-agent, etc.) on every single request in plain text, which wastes significant bandwidth especially when a page fires dozens of requests. HPACK maintains a shared, indexed table of previously-sent header fields between client and server so repeated headers can be referenced by a short index instead of retransmitted in full, shrinking per-request overhead considerably.

**Q: If HTTP/2 already multiplexes requests over one connection, why was HTTP/3 needed at all?**
Answer: HTTP/2's multiplexing happens above TCP, but TCP itself still enforces strict in-order delivery of every byte on the connection. A single lost or delayed packet — even one belonging to just one of the multiplexed streams — blocks the OS/kernel from handing over already-arrived data for *any* stream until the lost packet is retransmitted. This is HOL blocking at the transport layer, invisible to HTTP/2 itself, and only fixable by changing the transport — which is exactly what QUIC (over UDP) does in HTTP/3.
