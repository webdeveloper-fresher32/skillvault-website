# Phase 05: HTTP & HTTPS Fundamentals

## Overview

Every full-stack engineer uses HTTP daily through frameworks like Express — but interviews probe the layer *underneath* the framework: what actually travels over the wire. This phase treats HTTP as a **network protocol**, not an application API. You'll learn the raw message format, how versions evolved to fix real performance problems, why HTTPS exists, and how connection reuse and multiplexing affect page-load speed.

> **Scope note:** This phase does **not** cover REST design principles, resource modeling, or the full HTTP status code catalog — that's already covered in depth at [`../../NodeJS/Phase-05-REST-API-Design/`](../../NodeJS/Phase-05-REST-API-Design/). If you want the applied, Express-flavored view of REST and status codes, go there. This phase is the protocol-level view: bytes on the wire, TCP/TLS interaction, and version history.

## Where This Fits

```
Phase-04-DNS-Deep-Dive          → resolves a hostname to an IP
Phase-05-HTTP-HTTPS-Fundamentals → THIS PHASE: the protocol carried over that connection
Phase-06-TLS-SSL-and-Handshake  → how the "S" in HTTPS is established
Phase-07-Cookies-Sessions       → state on top of stateless HTTP
```

By the time a browser sends an HTTP request, DNS has already resolved the domain (Phase 04) and, for HTTPS, a TCP connection plus TLS handshake (Phase 06) is already in place. This phase is about what happens *on top of* that connection.

## What You'll Learn

| Lesson | Topic |
|--------|-------|
| [01-HTTP-as-a-Protocol.md](01-HTTP-as-a-Protocol.md) | HTTP as a text-based request-response protocol over TCP; raw request/response message anatomy |
| [02-HTTP-Versions.md](02-HTTP-Versions.md) | HTTP/1.0 → 1.1 → 2 → 3, and the specific problem each version fixed |
| [03-Why-HTTPS.md](03-Why-HTTPS.md) | The threats plain HTTP is vulnerable to, and how TLS wrapping solves them |
| [04-Persistent-Connections-and-Multiplexing.md](04-Persistent-Connections-and-Multiplexing.md) | Keep-alive, head-of-line blocking, and true multiplexing — why they matter for performance |

## Prerequisites

- Phase 01 (OSI/TCP-IP models) — you should know what a "layer" is and where HTTP sits (Layer 7)
- Phase 02 (TCP vs UDP) — you should understand connection-oriented, reliable delivery
- Basic familiarity with using an HTTP API from Phase-05 REST content in the NodeJS course is helpful but not required

## Cross-References

- REST principles, HTTP verbs as applied semantics, and the full status code catalog: [`../../NodeJS/Phase-05-REST-API-Design/01-REST-Principles-and-HTTP-Semantics.md`](../../NodeJS/Phase-05-REST-API-Design/01-REST-Principles-and-HTTP-Semantics.md)
- TLS handshake internals (certificates, key exchange, cipher suites): [`../Phase-06-TLS-SSL-and-Handshake/`](../Phase-06-TLS-SSL-and-Handshake/)
- Cookies and session state on top of stateless HTTP: [`../Phase-07-Cookies-Sessions-and-Web-Auth/`](../Phase-07-Cookies-Sessions-and-Web-Auth/)

## Estimated Time

3-4 hours (reading + hands-on `curl`/`openssl` exercises)
