# Phase 08 — Caching

## Overview

Caching is the single highest-leverage technique for making systems feel fast and for keeping servers from falling over under load. This phase covers **network-level caching** — the layers a request passes through *before* it ever reaches your application code: the browser, the OS/local resolver caches, CDNs, and reverse proxies.

This is distinct from **application-level caching** (e.g. caching a database query result in Redis inside your Node.js server). That topic is already covered in depth elsewhere in this repo:

> **See also:** [`../../NodeJS/Phase-10-Advanced-Node/03-Caching-with-Redis.md`](../../NodeJS/Phase-10-Advanced-Node/03-Caching-with-Redis.md) for the cache-aside pattern, TTLs, and application-layer cache invalidation with Redis.

Here, we focus on the HTTP contract between client and server: how a browser decides whether to reuse a response it already has, how CDNs and proxies cache responses on behalf of many users, and how you invalidate all of that safely when content changes.

## Why This Matters for Interviews

Caching questions are a staple of full-stack and backend interviews because they test whether you understand the full request path, not just your framework. Interviewers commonly ask:

- "Walk me through what happens when a browser re-requests a page it has visited before."
- "What's the difference between `Cache-Control: no-cache` and `no-store`?"
- "How do you safely cache a JS bundle for a year without serving stale code to users?"
- "How does a CDN decide whether to serve from edge or go back to origin?"

## What's in This Phase

| File | Topic |
|------|-------|
| [01-Where-Caching-Happens.md](01-Where-Caching-Happens.md) | The full caching chain: browser → OS/local cache → CDN → reverse proxy → application cache → database |
| [02-HTTP-Caching-Headers.md](02-HTTP-Caching-Headers.md) | `Cache-Control`, `Expires`, `ETag`, `Last-Modified`, conditional requests, and a full 304 exchange |
| [03-Cache-Invalidation-Strategies.md](03-Cache-Invalidation-Strategies.md) | Cache-busting via versioned filenames, immutable long-TTL caching, CDN purge APIs |

## Prerequisites

- Phase 05 (HTTP/HTTPS Fundamentals) — you should be comfortable with HTTP request/response structure and headers.
- Phase 09 and 10 (Load Balancers/Reverse Proxies, CDNs) pair naturally with this phase — caching is a core responsibility of both.

## How to Study This Phase

1. Read the three lessons in order — they build on each other (chain → headers → invalidation).
2. Run every `curl -I` exercise yourself against a real site. Seeing real `Cache-Control` and `ETag` headers in your terminal cements the concepts far better than reading about them.
3. After each lesson, attempt the Interview Q&A from memory before reading the answers.
