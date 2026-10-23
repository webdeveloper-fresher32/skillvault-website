# Networking Master Course — Projects

This section contains four hands-on projects that turn the protocol theory from the phases into code you write yourself. Each project deliberately avoids high-level frameworks — you'll work directly with raw sockets — so the wire-format and protocol concepts from the corresponding phase stop being abstract and become something you've built byte-by-byte.

## Project Overview

| # | Project | Level | Phase Prerequisite | Description |
|---|---------|-------|---------------------|-------------|
| 1 | Raw TCP Chat Client/Server | Beginner | Phase 02 – TCP vs UDP | Multi-client chat server built on Python's `socket` module, broadcasting messages across simultaneous TCP connections |
| 2 | Simple HTTP Server from Raw Sockets | Intermediate | Phase 05 – HTTP/HTTPS Fundamentals | Hand-parse HTTP/1.1 requests and hand-assemble spec-correct responses directly over a TCP socket, with no `http.server` |
| 3 | DNS Resolver Script | Intermediate | Phase 04 – DNS Deep Dive | Resolve domains via the OS resolver, then bypass it entirely by hand-building a raw DNS query packet over UDP and parsing the binary response |
| 4 | Simple Reverse Proxy / Load Balancer | Advanced | Phase 09 – Load Balancers and Reverse Proxies | A raw-socket TCP relay that round-robins client requests across three backend servers |

---

## Project Summaries

### 1. Raw TCP Chat Client/Server (Beginner)
Build a multi-client chat server using nothing but Python's `socket` module — no frameworks. The server accepts multiple simultaneous TCP connections (one thread per client) and broadcasts messages from one client to every other connected client, making the three-way handshake and TCP's connection-oriented stream nature tangible.

### 2. Simple HTTP Server from Raw Sockets (Intermediate)
Build a minimal HTTP/1.1 server directly on top of `socket`, manually parsing the request line and headers off the wire and hand-assembling a spec-correct HTTP response. Proves that "an HTTP request is just text over a TCP socket" by having you parse it byte-by-byte yourself.

### 3. DNS Resolver Script (Intermediate)
First resolve hostnames the normal way with the OS-backed resolver (`socket.gethostbyname`, `socket.getaddrinfo`). Then bypass the OS resolver entirely: hand-build a raw DNS query packet per RFC 1035, send it over UDP to a public resolver (`8.8.8.8:53`), and manually parse the binary response — no `dnspython` involved.

### 4. Simple Reverse Proxy / Load Balancer (Advanced)
Run three copies of a trivial backend HTTP server, then build a raw-socket reverse proxy in front of them that round-robins incoming client requests across the backends, relaying raw request and response bytes — the same pattern used by real Layer 7 load balancers.
