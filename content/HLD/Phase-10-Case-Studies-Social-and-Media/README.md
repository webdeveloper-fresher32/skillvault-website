# Phase 10 — Case Studies: Social and Media

Every phase so far has taught you one building block at a time: a load balancer, an index, a cache, a queue, a JWT. Real interviews don't ask about building blocks in isolation — they hand you a product ("design WhatsApp," "design YouTube") and watch whether you can *assemble* the right blocks, in the right order, under time pressure. That's what this phase is for: six full design walkthroughs of systems you already use every day, each one built entirely out of pieces from Phases 01-09.

Nothing in this phase is new theory. If a lesson says "fan-out-on-write," that's the cache-aside idea from Phase 06 applied to a list of posts instead of a single object. If a lesson says "queue per user," that's Phase 07's task-queue idea applied to message delivery. The skill being drilled here is translation: given a product, which of the last nine phases' tools solve which sub-problem, and in what order do you present them in 45 minutes.

## The 5-Part Case-Study Structure

Every lesson in this phase (and in Phase 11) follows the exact same shape, on purpose — repetition is what makes the framework automatic by interview day:

1. **Requirements** — 2-4 functional requirements (what the system must do) and non-functional requirements (consistency vs. availability trade-off, latency target, scale target).
2. **Back-of-envelope estimation** — DAU, requests/sec, storage/year, using the method from Phase 01 Lesson 03 (turn a user count into concrete numbers before drawing a single box).
3. **High-level architecture** — an ASCII component diagram naming actual pieces (which load balancer tier, which database, which cache, which queue, which gateway) rather than generic "Server" boxes.
4. **Deep dive** — the 1-2 hardest sub-problems specific to that system, worked through in real detail (this is where interviews are actually won or lost).
5. **Trade-offs / what breaks at 10x scale** — 2-3 bullets on where today's design cracks and what you'd change.

## What This Phase Covers

| System | Leans hardest on |
|---|---|
| WhatsApp / Chat | Phase 07 (queues, async delivery), Phase 06 (Redis presence), Phase 05 (NoSQL message stores) |
| Instagram | Phase 06 (caching/fan-out), Phase 08 (object storage + CDN), Phase 05 (sharding) |
| Twitter / X | Phase 06 (fan-out contrast with Instagram), Phase 05 (counting at scale) |
| YouTube | Phase 07 (async transcoding pipeline), Phase 08 (CDN delivery) |
| Netflix | Phase 08 (CDN pre-positioning), Phase 04 (global load balancing) |
| Notification Service | Phase 07 (queue-per-channel, retries), Phase 09 (idempotency/at-least-once delivery) |

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-WhatsApp-Chat.md` | Message delivery, online presence, read receipts, E2E encryption (high level) |
| 02 | `02-Instagram.md` | Feed generation (fan-out-on-write vs. read), celebrity-account hybrid, image CDN |
| 03 | `03-Twitter-X.md` | Timeline construction contrasted with Instagram, trending topics at scale |
| 04 | `04-YouTube.md` | Video upload/transcoding pipeline, CDN delivery, view-count counting |
| 05 | `05-Netflix.md` | Adaptive bitrate streaming, CDN pre-positioning, recommendations (high level) |
| 06 | `06-Notification-Service.md` | Fan-out to push/email/SMS, queue-per-channel, dedup, retry/backoff |

## Estimated Time

**5-6 days** — roughly one case study a day, plus a half day to re-derive Instagram vs. Twitter's feed trade-off from memory without looking at either lesson.

## Prerequisites

Phases 01-09, especially:
- Phase 01 (estimation method used in every case study here)
- Phase 04 (load balancers), Phase 05 (database scaling), Phase 06 (caching)
- Phase 07 (queues/async — the backbone of chat, video, and notifications)
- Phase 08 (object storage/CDN — the backbone of Instagram, YouTube, Netflix)
- Phase 09 (CAP/consistency — referenced whenever a case study picks strong vs. eventual consistency)
