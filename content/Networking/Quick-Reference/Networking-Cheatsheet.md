# Networking Cheatsheet

Dense, scannable, last-minute interview reference. Not a tutorial.

---

### OSI 7-Layer Model

| # | Layer | Function | Example Protocol |
|---|-------|----------|-------------------|
| 7 | Application | End-user facing services (HTTP requests, email) | HTTP |
| 6 | Presentation | Data translation, encryption, compression | TLS/SSL |
| 5 | Session | Establishes/manages/terminates sessions | NetBIOS |
| 4 | Transport | End-to-end delivery, reliability, flow control | TCP |
| 3 | Network | Logical addressing, routing between networks | IP |
| 2 | Data Link | Framing, MAC addressing, error detection on a link | Ethernet |
| 1 | Physical | Raw bit transmission over physical medium | 802.3 (cables, NICs) |

Mnemonic (top→bottom): **A**ll **P**eople **S**eem **T**o **N**eed **D**ata **P**rocessing.

TCP/IP model collapses this into 4 layers: **Application** (7-6-5) → **Transport** (4) → **Internet** (3) → **Link** (2-1).

---

### TCP vs UDP

| Aspect | TCP | UDP |
|--------|-----|-----|
| Connection | Connection-oriented (handshake) | Connectionless |
| Reliability | Guaranteed delivery, retransmits | Best-effort, no retransmit |
| Ordering | Preserves order | No ordering guarantee |
| Speed | Slower (overhead) | Faster (minimal overhead) |
| Header size | 20 bytes | 8 bytes |
| Flow/congestion control | Yes (sliding window, congestion avoidance) | None |
| Use cases | HTTP, HTTPS, FTP, SSH, DB connections | DNS, DHCP, video streaming, VoIP, gaming |

---

### TCP 3-Way Handshake

One-liner: **SYN → SYN-ACK → ACK** — client and server exchange initial sequence numbers to synchronize before data transfer.

```
Client                          Server
  | ---------  SYN (seq=x)  --------> |
  | <----- SYN-ACK (seq=y, ack=x+1) --|
  | ---------  ACK (ack=y+1) -------> |
  |         connection established     |
```

Teardown is a 4-way handshake: **FIN → ACK → FIN → ACK** (each side closes independently, since TCP is full-duplex).

---

### Common Port Numbers

| Port | Protocol/Service |
|------|-------------------|
| 20/21 | FTP (data/control) |
| 22 | SSH |
| 25 | SMTP |
| 53 | DNS |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 27017 | MongoDB |

---

### HTTP Status Codes

| Range | Class | Common Codes |
|-------|-------|--------------|
| 1xx | Informational | 100 Continue |
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirection | 301 Moved Permanently, 302 Found, 304 Not Modified |
| 4xx | Client Error | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests |
| 5xx | Server Error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

---

### HTTP/1.1 vs HTTP/2 vs HTTP/3

- **HTTP/1.1** — text-based, one request per TCP connection at a time (head-of-line blocking), keep-alive reuses connections but still serializes requests.
- **HTTP/2** — binary framing, multiplexes many requests over a single TCP connection, header compression (HPACK), server push — but still suffers TCP-level head-of-line blocking.
- **HTTP/3** — runs over QUIC (UDP-based) instead of TCP, eliminates TCP head-of-line blocking, built-in TLS 1.3, faster connection setup (0-RTT/1-RTT).

---

### TLS Handshake (TLS 1.2 simplified)

One-liner: **ClientHello → ServerHello+Certificate → Key Exchange → Finished** — negotiates cipher suite, verifies server identity via certificate, derives a shared symmetric session key.

Steps:
1. Client sends `ClientHello` (supported TLS versions, cipher suites, random number).
2. Server responds `ServerHello` (chosen cipher suite, random number) + its certificate (public key).
3. Client verifies certificate against trusted CA, generates pre-master secret, encrypts with server's public key, sends it.
4. Both sides derive the same symmetric session key from the pre-master secret.
5. `Finished` messages exchanged, encrypted with session key — handshake complete, symmetric encryption begins.

TLS 1.3 shortens this to a **1-RTT** handshake (and 0-RTT for resumed sessions).

---

### Cookie Attributes

| Attribute | Purpose |
|-----------|---------|
| `Secure` | Cookie only sent over HTTPS |
| `HttpOnly` | Inaccessible to JavaScript (`document.cookie`) — mitigates XSS |
| `SameSite=Strict` | Never sent on cross-site requests |
| `SameSite=Lax` | Sent on top-level navigation (default in modern browsers) |
| `SameSite=None` | Sent on all cross-site requests (requires `Secure`) |
| `Max-Age` / `Expires` | Controls cookie lifetime |
| `Domain` | Scopes cookie to a domain (and subdomains) |
| `Path` | Scopes cookie to a URL path |

---

### Cache-Control Directives

| Directive | Meaning |
|-----------|---------|
| `no-cache` | Must revalidate with server before using cached copy |
| `no-store` | Never cache at all |
| `private` | Cacheable only by the browser, not shared caches/CDNs |
| `public` | Cacheable by any cache including CDNs |
| `max-age=N` | Fresh for N seconds |
| `s-maxage=N` | Like `max-age` but only for shared caches (CDN) |
| `must-revalidate` | Once stale, must revalidate before use, no serving stale |
| `immutable` | Resource will never change during freshness lifetime |

---

### Load Balancing Algorithms

- **Round Robin** — requests distributed sequentially across servers.
- **Weighted Round Robin** — servers with higher capacity get proportionally more requests.
- **Least Connections** — routes to the server with fewest active connections.
- **Least Response Time** — routes to fastest-responding server.
- **IP Hash** — client IP hashed to consistently route to the same server (session affinity).
- **Random** — requests distributed randomly, sometimes with two-choice power-of-two refinement.

---

### WebSocket vs SSE vs Long-Polling

| Aspect | WebSocket | SSE (Server-Sent Events) | Long-Polling |
|--------|-----------|---------------------------|--------------|
| Direction | Full-duplex (bidirectional) | Server → client only | Client → server request, server holds until data ready |
| Protocol | `ws://`/`wss://`, upgraded from HTTP | Plain HTTP, `text/event-stream` | Plain HTTP |
| Reconnection | Manual | Automatic (built into `EventSource`) | New request each cycle |
| Overhead | Low (single persistent connection) | Low | Higher (repeated HTTP requests) |
| Browser support | Wide | Wide (not native in old IE) | Universal |
| Use cases | Chat, gaming, collaborative editing | Live feeds, notifications, stock tickers | Fallback when WS/SSE unavailable |
