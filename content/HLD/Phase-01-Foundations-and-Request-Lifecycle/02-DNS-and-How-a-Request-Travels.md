# DNS and How a Request Travels — Complete Guide

## Table of Contents
1. [The Hook: "What Happens When You Type google.com Into Your Browser?"](#1-the-hook-what-happens-when-you-type-googlecom-into-your-browser)
2. [DNS Resolution, Step by Step](#2-dns-resolution-step-by-step)
3. [Why Interviewers Love This Question](#3-why-interviewers-love-this-question)
4. [Interview Q&A](#4-interview-qa)

---

## 1. The Hook: "What Happens When You Type google.com Into Your Browser?"

This is arguably the single most common opening question across system design interviews — precisely because it's small enough to answer in two minutes, but rich enough that a strong candidate and a weak candidate answer it very differently. Let's build the full picture using `www.instagram.com` as the example.

You type `www.instagram.com` and hit Enter. Before your browser can send a single byte of an actual HTTP request, it needs an **IP address** — computers route traffic using IP addresses, not human-readable domain names. Getting from the domain name to an IP address is DNS's entire job.

```
 You type "www.instagram.com" and press Enter
        │
        ▼
 ┌───────────┐   "what's the IP    ┌──────────────┐
 │  Browser   │ ──  for this  ──▶  │     DNS       │
 │            │      domain?        │  Resolution   │
 └───────────┘                     └──────────────┘
                                           │
                                   returns an IP, e.g. 157.240.2.174
                                           ▼
 ┌───────────┐      ┌──────────────────┐      ┌────────────────┐
 │  Browser   │ ───▶ │  Load Balancer     │ ───▶ │ Backend Server  │
 │ (has IP now)│      │ (at that IP)       │      │                 │
 └───────────┘      └──────────────────┘      └────────────────┘
                                                        │
                                            cache check first (fast path)
                                                        ▼
                                               ┌────────────────┐
                                               │  Redis Cache    │
                                               └────────────────┘
                                                        │
                                              cache miss → fall through
                                                        ▼
                                               ┌────────────────┐
                                               │   Database      │
                                               └────────────────┘
                                                        │
                                                        ▼
                                               ┌────────────────┐
                                               │   Response      │
                                               └────────────────┘
```

Notice the DNS step happens entirely *before* the request even leaves for Instagram's infrastructure — it's a separate lookup, usually to a totally different set of servers than the ones that will eventually handle your request.

---

## 2. DNS Resolution, Step by Step

DNS resolution is itself a small chain of lookups, each one asked only if the previous one didn't have an answer cached:

1. **Browser cache** — the browser checks if it already resolved this domain recently and remembers the IP. If yes, done — this is by far the most common case for sites you visit often.
2. **OS cache** — if the browser doesn't have it, the operating system keeps its own DNS cache and is checked next.
3. **Recursive resolver (usually your ISP's, or a public one like `8.8.8.8`)** — if neither local cache has an answer, the OS asks a resolver, which does the actual multi-step lookup on your behalf.
4. **Root server** — the resolver asks a root DNS server, which doesn't know the answer either but knows *who to ask next* — the TLD server for `.com`.
5. **TLD server** — the `.com` TLD server doesn't know Instagram's IP either, but it knows which **authoritative server** is responsible for `instagram.com`.
6. **Authoritative server** — this server actually holds the DNS records for `instagram.com` and returns the real IP address.
7. The resolver returns that IP back up the chain, and every layer (OS, browser) caches it for next time, honoring a **TTL (time-to-live)** on the record so the cache doesn't go stale forever.

This lookup chain is intentionally kept brief here — DNS is HLD-relevant mostly as "this happens, and it's usually fast because of caching," not as a networking deep-dive. If you want the full protocol-level detail (record types, recursive vs iterative queries, DNSSEC), see this repo's `Networking/` course, which covers DNS end to end.

---

## 3. Why Interviewers Love This Question

It's asked constantly because a strong answer requires touching almost every idea in this phase without any prior system-design vocabulary: DNS resolution, the client-server model, load balancing, caching, and a database — in the right order. A weak answer stops at "the browser looks it up and gets the page." A strong answer:

- Names DNS resolution as a distinct first step, and mentions caching at multiple layers (this is *why* repeat visits to the same site are near-instant).
- Explains that once an IP is known, the request goes to a load balancer, not directly to "a server" — because production systems are never a single box.
- Mentions that a read-heavy request checks a cache (Redis, Phase 06) before hitting the database, because that's how real systems keep latency low.
- Doesn't stop at "get the page" — mentions the response traveling back and the browser rendering it, closing the loop.

Two follow-ups are almost guaranteed, and worth pre-empting in your answer:

- **"What about HTTPS?"** — at a high level: before any HTTP data is exchanged, the browser and server perform a TLS handshake — they agree on an encryption method and exchange keys (via certificates) so everything sent afterward is encrypted. You don't need the cryptographic details for an HLD interview, just that this handshake adds a small amount of latency before the first byte of your actual response arrives, and that it's why URLs start with `https://`.
- **"What would a CDN change here?"** — a CDN (Content Delivery Network) would let DNS resolve you to a server *geographically close to you* instead of Instagram's origin servers, and could serve static assets (images, JS, CSS) directly from that nearby edge location without ever hitting the origin backend or database at all. CDNs are covered properly once we reach caching and the media-heavy case studies in Phases 06 and 10 — for now, just know DNS is the mechanism that makes "route the user to their nearest server" possible in the first place.

---

## 4. Interview Q&A

**Q: Walk me through what happens when I type `www.instagram.com` into my browser and press Enter.**
Answer: First, the browser resolves the domain to an IP address via DNS — checking browser cache, then OS cache, then asking a recursive resolver which walks root → TLD → authoritative servers if needed. Once it has an IP, the browser opens a connection (performing a TLS handshake for HTTPS) and sends an HTTP request, which arrives at a load balancer, which routes it to a backend server. The backend checks a cache like Redis for the requested data; on a cache miss it queries the database, populates the cache, and returns a response that travels back through the same path to the browser, which then renders it.

**Q: Why does DNS resolution usually feel instant even though it involves multiple servers?**
Answer: Because of caching at nearly every layer — the browser, the OS, and the recursive resolver all cache DNS answers according to the record's TTL. The full root → TLD → authoritative chain only runs on a genuine cache miss, such as the very first time anyone on that resolver looks up that domain, or after the TTL expires.

**Q: At a high level, what does HTTPS add to this flow that plain HTTP doesn't have?**
Answer: A TLS handshake happens after the IP is known but before any actual HTTP request/response data is exchanged — the client and server agree on encryption keys (verified via a certificate) so that everything sent afterward is encrypted in transit. This adds a small amount of one-time latency to establish the connection, but protects against anyone on the network path reading or tampering with the request or response.

**Q: How would a CDN change this diagram?**
Answer: A CDN would let the DNS lookup route you to an edge server geographically near you rather than the origin infrastructure, and that edge server could serve cacheable content (images, video segments, static files) directly — without the request ever reaching the origin load balancer, backend, or database. It reduces both latency (shorter physical distance) and origin load (fewer requests reach the real backend at all).

**Q: Is DNS resolution part of "the internet" hop from the client-server diagram in Lesson 01, or is it separate?**
Answer: It's logically separate and happens first. "The internet" hop in the client-server diagram is about routing an already-addressed packet from your machine to a known IP; DNS is the step that produces that IP in the first place. In an interview, calling this out explicitly (rather than folding DNS into "the request goes over the internet") is one of the clearest signals of a structured answer.
