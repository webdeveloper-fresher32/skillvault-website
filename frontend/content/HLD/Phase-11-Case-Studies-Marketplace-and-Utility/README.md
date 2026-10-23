# Phase 11 — Case Studies: Marketplace and Utility

Phase 10 walked through consumer social/media products (WhatsApp, Instagram, Twitter/X, YouTube, Netflix, a generic Notification Service). This phase turns to the other half of the "design X" interview canon: **marketplace and utility systems** — two-or-three-sided marketplaces (Uber, Swiggy), inventory-constrained booking systems (hotels, flights), and infrastructure utilities (a URL shortener, Google Drive, Google Docs, a Payment Gateway). These systems are asked about just as often as the social/media ones, and they exercise a different muscle: **correctness under contention** (don't double-book a room, don't double-charge a card) rather than pure read-scaling (don't drop a viral post's fan-out).

Every one of the 8 case studies in this phase reuses the exact same 5-part structure introduced in Phase 10's README — Requirements → Back-of-envelope estimation → High-level architecture → Deep dive → Trade-offs / what breaks at 10x scale. It is not re-derived here; skim Phase 10's README if you haven't internalized it yet. What changes case to case is only the *deep dive* — the 1-2 hardest sub-problems specific to that system — and the earlier phase(s) it leans on hardest.

## What This Phase Covers

- **Two/three-sided marketplaces** — matching supply and demand in real time (Uber's drivers/riders, Swiggy's restaurants/customers/delivery partners) using geospatial indexing and async location updates.
- **Inventory under contention** — preventing double-booking when many users compete for the same finite resource (a hotel room, a flight seat) — pessimistic locking vs optimistic locking with retry.
- **Infrastructure utilities** — systems that look deceptively simple in an interview (a URL shortener) but hide real scaling/consistency decisions, and systems that need genuinely novel deep dives (Google Docs' real-time collaboration, Payment Gateway's idempotency guarantees).
- **Strong consistency where it actually matters** — this phase is where "always use NoSQL for scale" gets pushed back on: booking systems and payment systems are the canonical case for reaching for a relational database with real transactions.

## Lessons

| # | File | Topic |
|---|------|-------|
| 1 | `01-Uber-Lyft.md` | Ride-hailing: geospatial driver matching, real-time location updates, surge pricing |
| 2 | `02-Swiggy-Zomato.md` | Food delivery: 3-sided marketplace, order-state machine |
| 3 | `03-Hotel-Booking.md` | Hotel booking: inventory consistency, double-booking prevention |
| 4 | `04-Flight-Booking.md` | Flight booking: high-contention seat inventory, search/pricing vs booking split |
| 5 | `05-URL-Shortener.md` | URL shortener: short-code generation, read-heavy caching |
| 6 | `06-Google-Drive.md` | Cloud file storage: chunked upload, content-hash deduplication |
| 7 | `07-Google-Docs.md` | Real-time collaborative editing: OT/CRDT at a conceptual level, WebSocket sync |
| 8 | `08-Payment-Gateway.md` | Payments: idempotency keys, the outbox pattern, why SQL wins here |
| 9 | `09-Rate-Limiter.md` | Rate limiting: token bucket vs leaky bucket vs sliding window, distributed limits via Redis |
| 10 | `10-Web-Crawler.md` | Web crawler: URL frontier, politeness, Bloom-filter dedup, distributed crawling |
| 11 | `11-Distributed-Key-Value-Store.md` | Design Redis/DynamoDB from scratch: consistent hashing, replication, quorum |

## Estimated Time

9-10 days (roughly one focused evening per case study, two for the pair that most interviewers ask — Uber and Payment Gateway; the last three add ~2-3 days since Rate Limiter, Web Crawler, and the Distributed Key-Value Store are each frequently-asked standalone interview questions in their own right).

## Prerequisites

Phases 01-09 (all the building blocks) and Phase 10 (the case-study structure itself and the fan-out/CDN concepts this phase's studies build on). Each lesson below explicitly names the earlier phase its deep dive leans on hardest.
