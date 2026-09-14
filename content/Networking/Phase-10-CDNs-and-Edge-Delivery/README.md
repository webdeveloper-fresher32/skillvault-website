# Phase 10 — CDNs and Edge Delivery

## Overview

A Content Delivery Network (CDN) is a globally distributed network of servers that sits between your users and your origin server, serving content from a location physically closer to the user. This phase explains *why* that matters (physics — the speed of light is not infinite, and neither is your origin server's capacity), *how* a CDN decides which edge node handles a given request, and *what kinds* of content CDNs are good — and not good — at accelerating.

This phase builds directly on [Phase-08-Caching](../Phase-08-Caching/README.md). A CDN is, fundamentally, a distributed HTTP cache — everything you learned about `Cache-Control`, `ETag`, and cache invalidation applies at the edge too, just at a much larger, geographically distributed scale.

## Why This Matters for Interviews

CDN questions show up constantly in full-stack and system design interviews because they sit at the intersection of networking, performance, and architecture:

- "Why is our site slow for users in Australia when our servers are in the US?"
- "How does a CDN know which edge server is closest to a user?"
- "What happens on a cache miss at the edge?"
- "Can a CDN speed up an API that returns personalized, dynamic data?"
- "What's the difference between a CDN and edge compute (like Cloudflare Workers or Lambda@Edge)?"

## What's in This Phase

| File | Topic |
|------|-------|
| [01-What-is-a-CDN.md](01-What-is-a-CDN.md) | The latency/load problem CDNs solve, edge servers and PoPs (Points of Presence) |
| [02-How-CDN-Routing-Works.md](02-How-CDN-Routing-Works.md) | Anycast, GeoDNS, cache hit vs. cache miss at the edge, and the link to HTTP caching headers |
| [03-CDNs-for-Static-vs-Dynamic-Content.md](03-CDNs-for-Static-vs-Dynamic-Content.md) | Static asset acceleration vs. edge compute for dynamic content, and when a CDN doesn't help |

## Prerequisites

- Phase 04 (DNS Deep Dive) — GeoDNS routing builds directly on how DNS resolution works.
- Phase 05 (HTTP/HTTPS Fundamentals) — CDNs operate at the HTTP layer.
- Phase 08 (Caching) — a CDN is a distributed HTTP cache; you should already know `Cache-Control`, `ETag`, and cache invalidation before starting here.

## How to Study This Phase

1. Read the three lessons in order — problem → routing mechanics → content-type nuance.
2. As you read Lesson 2, keep a copy of Phase-08's `02-HTTP-Caching-Headers.md` open — you'll see the same headers reappear, just interpreted by an edge server instead of a browser.
3. After each lesson, attempt the Interview Q&A from memory before reading the provided answers.
