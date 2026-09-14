# What Happens When You Type a URL and Press Enter — Complete Guide

## Table of Contents
1. [Why This Question Matters](#1-why-this-question-matters)
2. [Step-by-Step Walkthrough](#2-step-by-step-walkthrough)
3. [Full Sequence Diagram](#3-full-sequence-diagram)
4. [Common Follow-Up Twists](#4-common-follow-up-twists)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. Why This Question Matters

"What happens when you type `google.com` into your browser and press Enter?" is the single most common networking/systems interview question for full-stack and backend roles. It isn't really about DNS or TCP in isolation — it's a test of whether you can narrate a **complete, correctly ordered system** that spans the entire stack: parsing, resolution, transport, security, application protocol, server-side processing, and rendering.

This lesson ties together Phases 01–11 of this course into one story. Each step below references the phase where the concept is covered in depth.

---

## 2. Step-by-Step Walkthrough

We'll trace `https://www.google.com/search?q=networking` end to end.

### Step 1 — Parse the URL

The browser breaks the typed string into components before doing anything on the network.

```
https://www.google.com:443/search?q=networking#results
└─┬──┘   └──────┬──────┘└┬┘└───┬───┘└─────┬────┘└──┬───┘
scheme      host        port  path       query    fragment
```

- **Scheme** (`https`) tells the browser which protocol to use, and implicitly the default port (443 for HTTPS, 80 for HTTP).
- **Host** (`www.google.com`) is what needs to be resolved to an IP address.
- **Port** defaults to 443/80 if omitted.
- **Path** and **query** are sent to the server later in the HTTP request line.
- **Fragment** (`#results`) is never sent to the server — it's resolved entirely client-side.

If the input isn't a well-formed URL (no scheme, has spaces), the browser instead treats it as a search engine query. Assume here it's a valid URL.

*(Covered conceptually — this is browser-internal, not a course phase.)*

### Step 2 — Check Local Caches (Before Any Network Call)

Before touching the network, the browser checks whether it already knows the answer:

1. **Browser cache** — has this exact resource been fetched before, and is it still fresh per `Cache-Control`/`Expires`? (Phase 08 — Caching)
2. **HSTS list** — has this host previously told the browser to *always* use HTTPS? If so, skip straight to HTTPS even if `http://` was typed.
3. **DNS cache** — browser DNS cache, then OS-level DNS cache (Phase 04 — DNS Deep Dive).

If the browser has a fresh cached response for this exact URL, the flow can stop here entirely (served from disk/memory cache, no network round trip). Assume no cache hit — we proceed to DNS.

### Step 3 — DNS Resolution

The domain name `www.google.com` must become an IP address. Resolution is checked at each cache level before going further upstream (Phase 04 — DNS Deep Dive):

```
1. Browser DNS cache        → checked first, fastest
2. OS DNS cache             → checked next (e.g. via getaddrinfo)
3. Router / local DNS cache → home router often caches too
4. ISP's Recursive Resolver → if all above miss, query goes here
```

If the recursive resolver doesn't have it cached either, it performs the full **iterative recursive resolution**:

```
Recursive Resolver:
  1. Ask a Root Server        → "I don't know, but ask the .com TLD server"
  2. Ask the .com TLD Server  → "I don't know, but ask google.com's authoritative NS"
  3. Ask google.com's Authoritative Name Server
                              → "www.google.com = 142.250.190.68"
  4. Cache the result for its TTL, return it to the OS/browser
```

Record types involved: the resolver typically looks up an `A` (IPv4) or `AAAA` (IPv6) record, following any `CNAME` aliases along the way. The result is cached at every level for the record's TTL.

### Step 4 — TCP Connection Setup (3-Way Handshake)

With an IP address in hand, the OS opens a TCP socket to `142.250.190.68:443` (Phase 02 — TCP vs UDP).

```
Client                                   Server
  |------ SYN (seq=x) ------------------>|
  |<----- SYN-ACK (seq=y, ack=x+1) ------|
  |------ ACK (ack=y+1) ----------------->|
  |                                       |
  |     TCP connection established       |
```

TCP is chosen (over UDP) because HTTP needs reliable, ordered, connection-oriented delivery — retransmission of lost packets, flow control, and congestion control all matter for correctly rendering a page.

### Step 5 — TLS Handshake (Because It's HTTPS)

Since the scheme is `https`, a TLS handshake runs on top of the now-open TCP connection before any HTTP data is exchanged (Phase 06 — TLS/SSL and Handshake).

```
Client                                          Server
  |---- ClientHello (TLS versions, cipher suites,
  |      supported groups, SNI="www.google.com") -->|
  |<--- ServerHello (chosen cipher suite),           |
  |      Certificate, ServerKeyExchange,             |
  |      ServerHelloDone -----------------------------|
  |---- verify certificate against trusted CAs        |
  |---- key exchange material, Finished ------------->|
  |<--- Finished --------------------------------------|
  |                                                   |
  |   Symmetric session key derived on both sides     |
  |   All further traffic is encrypted                |
```

Key things happening here:
- **SNI (Server Name Indication)** in the ClientHello tells the server which hostname's certificate to present — needed because many sites can share one IP.
- The browser validates the server's **certificate chain** up to a trusted root CA, checks the hostname matches, and checks it hasn't expired/been revoked.
- A **shared symmetric key** is derived (via asymmetric key exchange, e.g. ECDHE) and used for fast symmetric encryption of the actual HTTP traffic — asymmetric crypto is too slow for bulk data.
- Modern TLS 1.3 shortens this to roughly one round trip; earlier TLS 1.2 took two.

### Step 6 — Browser Sends the HTTP Request

Now, over the encrypted TCP connection, the browser sends an HTTP request (Phase 05 — HTTP/HTTPS Fundamentals):

```
GET /search?q=networking HTTP/1.1
Host: www.google.com
User-Agent: Mozilla/5.0 (...)
Accept: text/html,application/xhtml+xml
Accept-Encoding: gzip, br
Cookie: session=abc123; pref=dark-mode
Connection: keep-alive
```

Notable pieces:
- The **`Cookie` header** carries any cookies previously set for this domain — used for session identification, authentication tokens, or preferences (Phase 07 — Cookies, Sessions, and Web Auth). If using token-based auth instead of cookies, an `Authorization: Bearer <JWT>` header may be sent instead.
- Conditional headers like `If-None-Match` (ETag) or `If-Modified-Since` may be included if the browser has a cached-but-possibly-stale copy, enabling a `304 Not Modified` response (Phase 08 — Caching).
- `Connection: keep-alive` requests the TCP connection stay open for further requests instead of tearing down after this one.

### Step 7 — Request Travels the Network

The HTTP request, wrapped in TCP segments, wrapped in IP packets, wrapped in link-layer frames, travels across the network (Phase 01 — OSI/TCP-IP Models; Phase 03 — IP Addressing):

```
Application  →  HTTP request
Transport    →  segmented into TCP segments (port 443)
Network      →  wrapped into IP packets (routed hop by hop via routers)
Data Link    →  framed for each physical link (Ethernet/Wi-Fi)
Physical     →  transmitted as electrical/radio/light signals
```

The request may pass through several intermediaries before reaching Google's actual application server:

- **A reverse proxy / load balancer** (e.g. Google Front End) terminates the connection and distributes the request across many backend servers (Phase 09 — Load Balancers and Reverse Proxies).
- **A CDN edge node** may serve the request directly if the resource is static and cached at the edge, without ever reaching an origin server (Phase 10 — CDNs and Edge Delivery). For a dynamic search query, the request usually still needs to reach an application server, though static assets on the resulting page (images, JS, CSS) are commonly CDN-served.

### Step 8 — Server Processes the Request

The receiving server (behind the load balancer):

1. Parses the HTTP request line, headers, and any body.
2. Authenticates the session (validates the cookie or JWT).
3. Routes the request to the appropriate application logic (e.g. search service).
4. Queries databases/caches/downstream services as needed.
5. Constructs an HTTP response.

### Step 9 — Server Sends the HTTP Response

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8
Content-Length: 51823
Cache-Control: private, max-age=0
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Lax
Content-Encoding: gzip

<!DOCTYPE html>...
```

- The **status code** (`200 OK` here) tells the browser how to interpret the response — 2xx success, 3xx redirect, 4xx client error, 5xx server error (Phase 05).
- **`Cache-Control`** headers instruct the browser (and any intermediate caches) how long, and whether, to cache this response (Phase 08).
- **`Set-Cookie`** may issue a new or refreshed session cookie, ideally marked `HttpOnly`, `Secure`, and with a `SameSite` policy (Phase 07).
- The body travels back the same layered path (TCP segments → IP packets → link frames) in reverse.

### Step 10 — Browser Renders the Page

*(Brief mention — rendering itself is outside this networking course, but it's the natural conclusion of the flow.)*

1. Browser parses the HTML into a DOM, encountering `<link>`/`<script>`/`<img>` tags that trigger **additional requests** (CSS, JS, images, fonts) — each of which repeats a lighter version of steps 2–9 (cache check → maybe DNS → maybe new TCP/TLS if a different host → HTTP request/response), often reusing the existing keep-alive connection or opening parallel connections for other hosts.
3. Browser builds the CSSOM, combines it with the DOM into a render tree, computes layout, and paints pixels to the screen.
4. JavaScript executes, may make further asynchronous requests (`fetch`/`XHR`), and can upgrade a connection to WebSocket for real-time features (Phase 11 — WebSockets, SSE, and Realtime Protocols) if the page needs live updates (e.g. live chat, stock tickers).

### Step 11 — Connection Reuse or Close

- With `Connection: keep-alive` (HTTP/1.1 default) or HTTP/2's multiplexing, the same TCP+TLS connection is reused for subsequent requests to the same host — avoiding repeated handshake costs.
- The connection eventually closes via a **TCP 4-way termination** (FIN/ACK from each side) after an idle timeout, or the OS/browser closes it when the tab is closed.

```
Client                                   Server
  |------ FIN ---------------------------->|
  |<----- ACK ------------------------------|
  |<----- FIN ------------------------------|
  |------ ACK ---------------------------->|
  |          Connection closed             |
```

---

## 3. Full Sequence Diagram

```
 BROWSER                                                        SERVER / NETWORK
    |
    | 1. Parse URL (scheme, host, port, path, query, fragment)
    |
    | 2. Check caches: browser cache -> HSTS -> DNS cache
    |
    | 3. DNS RESOLUTION
    |    browser cache -> OS cache -> router cache -> ISP resolver
    |------------------------------------------------------------->|  Recursive Resolver
    |                                                               |     |
    |                                                               |     v  Root -> .com TLD -> Authoritative NS
    |<--------------------------------------------------------------|  returns IP, cached w/ TTL
    |
    | 4. TCP 3-WAY HANDSHAKE (to resolved IP, port 443)
    |------------------------- SYN ------------------------------->|
    |<---------------------- SYN-ACK --------------------------------|
    |------------------------- ACK ------------------------------->|
    |
    | 5. TLS HANDSHAKE (only if HTTPS)
    |------------------- ClientHello (+ SNI) ---------------------->|
    |<---------- ServerHello + Certificate --------------------------|
    |------------------- Key Exchange, Finished --------------------->|
    |<---------------------- Finished ---------------------------------|
    |          [ session key derived; channel now encrypted ]
    |
    | 6. HTTP REQUEST  (GET /search?q=... , Host, Cookie/JWT, headers)
    |----------------------------------------------------------------->|
    |                                          7. Travels via routers, |
    |                                             load balancer / CDN edge
    |                                          8. Server processes:
    |                                             authn -> app logic -> DB
    |
    | 9. HTTP RESPONSE (status, headers: Cache-Control, Set-Cookie, body)
    |<-----------------------------------------------------------------|
    |
    | 10. RENDERING: parse HTML -> fetch sub-resources (repeat 2-9 per
    |     host) -> build DOM/CSSOM -> layout -> paint -> run JS
    |     (JS may open a WebSocket for real-time features)
    |
    | 11. CONNECTION reused (keep-alive/HTTP2) for more requests,
    |     eventually closed via FIN/ACK 4-way termination
    |
```

---

## 4. Common Follow-Up Twists

Interviewers commonly push further after the base answer. Be ready for:

| Follow-up | What to say |
|-----------|-------------|
| "What if DNS returns multiple IPs?" | Browser/OS picks one (often round-robin or latency-based); this is a simple form of DNS load balancing (Phase 04, Phase 09). |
| "What if the site uses HTTP/2 or HTTP/3?" | HTTP/2 multiplexes many requests over one TCP connection (no head-of-line blocking at the app layer); HTTP/3 replaces TCP with QUIC (over UDP) to also avoid TCP-level head-of-line blocking and speed up the handshake. |
| "What if it's a redirect (301/302)?" | Browser receives a redirect response, re-parses the new URL, and repeats resolution/connection steps against the new location. |
| "What about a CDN?" | Static assets are often served from a nearby edge PoP without reaching origin — reduces latency and origin load (Phase 10). |
| "What if TLS certificate validation fails?" | Browser blocks the request and shows a security warning instead of proceeding — a deliberate fail-closed behavior. |
| "Is DNS over TCP or UDP?" | Normally UDP (fast, low overhead) for most queries; falls back to TCP for large responses or DNS-over-TCP/DoH/DoT for security and privacy. |

---

## 5. Hands-On Exercises

**Exercise 1:** Run `curl -v https://example.com` and map each line of output (`* Connected to...`, `* SSL connection using...`, `> GET / HTTP/1.1`, `< HTTP/1.1 200 OK`) to the corresponding step in this lesson's walkthrough (DNS resolution, TCP handshake, TLS handshake, HTTP request/response).

**Exercise 2:** Run `dig www.google.com` followed immediately by `dig www.google.com` again. Compare the response times and the `TTL` field to observe DNS caching in action.

**Exercise 3:** Open your browser's DevTools Network tab, hard-refresh a page, and inspect the timing breakdown (DNS Lookup, Initial Connection, SSL, Waiting/TTFB, Content Download) for the first request. Match each phase to a step in this lesson.

**Exercise 4:** Use Wireshark (or `tcpdump -i any port 443`) to capture the traffic generated by visiting an HTTPS site, and identify the TCP SYN/SYN-ACK/ACK packets followed by the TLS ClientHello/ServerHello exchange.

**Exercise 5:** Visit a site that issues a 301/302 redirect (e.g. `http://github.com` redirecting to `https://github.com`) with `curl -v -L`, and observe the browser repeating DNS/TCP/TLS steps against the new location.

---

## 6. Interview Q&A

**Q: Why does the browser check multiple caches before making a DNS query?**
Answer: Each cache layer (browser, OS, router, ISP resolver) avoids a slower round trip. Checking the fastest and closest cache first (browser's own in-memory cache) minimizes latency — a full recursive DNS resolution across root, TLD, and authoritative servers is the slowest path and only happens on a full miss.

**Q: Why does TCP need a 3-way handshake before TLS or HTTP can happen?**
Answer: TCP is connection-oriented — both sides must agree on initial sequence numbers and confirm bidirectional reachability before any reliable, ordered data transfer can begin. TLS and HTTP both assume an already-established reliable byte stream; they don't handle retransmission or ordering themselves.

**Q: What's the difference between what happens for `http://` vs `https://` in this flow?**
Answer: The overall flow is identical through DNS resolution and TCP handshake. `https://` adds a TLS handshake immediately after the TCP handshake and before any HTTP data is sent, encrypting all subsequent traffic. `http://` skips straight to sending the plaintext HTTP request after the TCP handshake.

**Q: Where would a CDN or load balancer fit into this flow?**
Answer: A load balancer typically sits in front of an origin's application servers and distributes incoming requests (Phase 09). A CDN sits even earlier in the path, geographically closer to the client, and can serve static/cacheable content directly from an edge node — short-circuiting steps 7 and 8 entirely for cacheable resources (Phase 10).

**Q: What determines whether the browser can reuse the same TCP connection for the next request?**
Answer: HTTP/1.1's `Connection: keep-alive` (the default) keeps the TCP+TLS connection open for a configured idle timeout so subsequent requests to the same host skip the handshake costs. HTTP/2 goes further by multiplexing many concurrent requests over a single connection.
