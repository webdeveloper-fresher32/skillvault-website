# Networking — Complete Learning Course

Master networking from OSI/TCP-IP fundamentals through the protocols that power every backend system: TCP vs UDP, IP addressing, DNS, HTTP/HTTPS, TLS/SSL, cookies and web auth, caching, load balancers and reverse proxies, CDNs, and realtime protocols (WebSockets/SSE). This course is built for backend engineering interview prep — every phase is written to answer "how does this actually work on the wire," not just "how do I use this library."

---

## Course Structure

```
Networking/
├── Phase-01-Fundamentals-and-OSI-TCPIP-Models/     → OSI 7 layers, TCP/IP 4 layers, encapsulation
├── Phase-02-TCP-vs-UDP/                            → Handshakes, flow/congestion control, reliability
├── Phase-03-IP-Addressing-and-Subnetting/          → IPv4/IPv6, CIDR, subnetting, NAT
├── Phase-04-DNS-Deep-Dive/                         → Resolution chain, record types, caching, TTL
├── Phase-05-HTTP-HTTPS-Fundamentals/                → Methods, status codes, HTTP/1.1 vs 2 vs 3
├── Phase-06-TLS-SSL-and-Handshake/                 → TLS handshake, certificates, CAs, mTLS
├── Phase-07-Cookies-Sessions-and-Web-Auth/         → Cookies, sessions, CSRF, JWTs
├── Phase-08-Caching/                                → Cache-Control, ETags, invalidation strategies
├── Phase-09-Load-Balancers-and-Reverse-Proxies/    → Forward vs reverse proxy, L4 vs L7, algorithms
├── Phase-10-CDNs-and-Edge-Delivery/                 → CDN routing, static vs dynamic content
├── Phase-11-WebSockets-SSE-and-Realtime-Protocols/ → WebSocket protocol, SSE, long-polling
├── Phase-12-Interview-Prep/                         → System design framing, rapid-fire Q&A
├── Quick-Reference/                                 → Cheatsheet + 50 interview Q&A
└── Projects/                                        → Beginner → Advanced raw-socket hands-on projects
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Fundamentals and OSI/TCP-IP Models | Beginner | 2 days |
| 02 | TCP vs UDP | Beginner | 3 days |
| 03 | IP Addressing and Subnetting | Beginner | 2 days |
| 04 | DNS Deep Dive | Intermediate | 2 days |
| 05 | HTTP/HTTPS Fundamentals | Intermediate | 3 days |
| 06 | TLS/SSL and Handshake | Intermediate | 3 days |
| 07 | Cookies, Sessions and Web Auth | Intermediate | 2 days |
| 08 | Caching | Intermediate | 2 days |
| 09 | Load Balancers and Reverse Proxies | Advanced | 3 days |
| 10 | CDNs and Edge Delivery | Advanced | 2 days |
| 11 | WebSockets, SSE and Realtime Protocols | Advanced | 2 days |
| 12 | Interview Prep | Advanced | 2 days |

**Total estimated time: 4-5 weeks**

---

## Prerequisites

- Comfort with basic command-line tools (`curl`, `ping`, `dig`/`nslookup`)
- Basic familiarity with a scripting language (the hands-on projects use Python's `socket` module)
- No prior networking coursework required — Phase 01 starts from first principles

---

## How to Use This Course

Work through the phases in order — later phases assume the vocabulary and mental models from earlier ones (e.g., Phase 06's TLS handshake assumes Phase 02's TCP handshake, and Phase 09's load balancing assumes Phase 05's HTTP semantics). Each phase directory has its own `README.md` summarizing its lessons. After finishing a phase, work the matching project in `Projects/` if one exists — building a raw-socket chat server, HTTP server, DNS resolver, or reverse proxy turns the protocol theory into something you've implemented byte-by-byte instead of just read about. Use `Quick-Reference/Networking-Cheatsheet.md` for fast lookups while studying, and `Quick-Reference/Interview-QA.md` for structured interview rehearsal once you've completed the phases. Phase 12 ties everything together with system-design framing and rapid-fire practice questions — treat it as a final review, not a starting point.

---

## Cross-References to Other Courses

- **`../NodeJS/`** — This course explains the protocols; the NodeJS course shows them applied in code. See it for building actual HTTP servers with Express, implementing WebSocket servers, handling cookies/sessions in middleware, and configuring caching headers in a real application.
- **`../OperatingSystems/`** — Networking performance ultimately rests on OS-level I/O. See that course for the depth behind concepts referenced here in passing: blocking vs non-blocking sockets, epoll/kqueue-based event loops, and how the OS schedules and buffers socket I/O under the hood.

---

## Quick Reference

```bash
curl -v https://example.com          # inspect the full HTTP request/response, including TLS handshake
dig example.com                      # query DNS records directly
ping example.com                     # test basic reachability (ICMP)
traceroute example.com               # see the hop-by-hop path packets take
openssl s_client -connect example.com:443   # inspect a TLS certificate chain manually
```
