# Design a Hotel Booking System

Two guests, on two different devices, both look at the last available Deluxe room for the same weekend, and both hit "Book" within the same second. Exactly one of them should get the room and a confirmation email; the other should get a clean "sorry, just booked" — not a double-booked room, not a charged card with no reservation, and not a system that just silently fails for both. This is the defining hard problem of a booking system: **read-heavy browsing, write-contended booking**, and unlike the social/media case studies in Phase 10, correctness under concurrency matters more than raw throughput.

## 1. Requirements

**Functional**
- A guest can search available rooms by location, date range, and room type.
- A guest can reserve a room for a date range and pay for it; a confirmed reservation must never overlap another confirmed reservation for the same room.
- A guest can cancel a reservation, subject to a cancellation policy.
- Hotels manage their own room inventory and pricing.

**Non-functional**
- **Strong consistency for the booking write path** — this is the one place in the course where "just use NoSQL and eventual consistency" is the wrong answer; overselling a room is a business-critical bug, not a UX nitpick.
- **Availability for search/browsing** — a slightly stale search result (a room shown as available that just got booked) is acceptable as long as the *booking* step itself re-validates and fails safely.
- **Latency target:** search results in under 500ms; booking confirmation in under 2-3 seconds (payment round-trip included).
- **Scale target:** search traffic vastly outweighs booking traffic — a huge fraction of visits are lookers, not bookers.

## 2. Back-of-envelope estimation

Assume a platform aggregating 50,000 hotels, 2 million searches/day, and a 5% search-to-booking conversion rate:

- Bookings/day: 2,000,000 × 0.05 = 100,000 → 100,000 ÷ 86,400 ≈ **~1.2 bookings/sec average**, spiking several-fold around weekend-planning peaks (Monday mornings, Thursday evenings) — call peak **~10-15 bookings/sec**, which is small in absolute terms but each one requires a strongly consistent read-check-write.
- Searches/sec at the same peak ratio: **~250-300 searches/sec**, roughly 20-25x the booking rate — this ratio is *why* the architecture below splits search (cacheable, eventually-consistent) from booking (strongly consistent) into different paths.
- Storage: a reservation row (guest, room, dates, price, status) at ~1KB, 100,000/day → 100MB/day ≈ **~36GB/year** — trivial; the real capacity question here is booking *throughput under lock contention*, not storage volume.

## 3. High-level architecture

```
                     ┌───────────────────┐
   Guest ───────────▶│   API Gateway       │  (Phase 08 L02)
                     └─────────┬─────────┘
                               │
              ┌─────────────────┼─────────────────────┐
              ▼                                        ▼
     ┌──────────────────┐                     ┌──────────────────────┐
     │  Search Service    │                     │  Booking Service       │
     │ (read path)         │                     │ (write path, the       │
     └────────┬───────────┘                     │  contended one)         │
              │                                  └───────────┬────────────┘
              ▼                                              ▼
     ┌──────────────────┐                          ┌──────────────────────┐
     │  Redis cache        │◀── refreshed async ────│  Postgres              │
     │ (Phase 06, room/     │      on booking/       │ (rooms, reservations,  │
     │  availability index) │      inventory change   │  strong consistency,    │
     └──────────────────┘                          │  Phase 05 L04)          │
              ▲                                     └───────────┬────────────┘
              │                                                 │
     ┌──────────────────┐                          ┌──────────────────────┐
     │  Postgres read       │                          │  Payment Service        │
     │  replicas (Phase 05   │                          │ (Phase 11 L08 — same    │
     │  L02) — feed the cache│                          │  idempotency pattern)   │
     └──────────────────┘                          └──────────────────────┘
```

- **Search Service** is a classic read-heavy path: it serves off Redis (Phase 06's cache-aside pattern) backed by read replicas (Phase 05 Lesson 02), because a search result that's a few seconds stale is a non-issue — the booking step re-validates regardless.
- **Booking Service** talks directly to the primary Postgres database for the actual reserve-or-fail operation — this path deliberately bypasses the cache, because the cache is exactly the kind of stale data you cannot tolerate at the moment you're committing to a reservation.
- A booking success invalidates/refreshes the relevant cache entries so search results catch up quickly (delete-on-write from Phase 06 Lesson 02), and calls the Payment Service using the same idempotency-key pattern covered in Lesson 08 of this phase.

## 4. Deep dive

**Preventing double-booking is a concurrency-control problem, not a matching problem.** The naive flow — "check if room X is free for these dates, then insert a reservation" — has a classic time-of-check-to-time-of-use (TOCTOU) race: two requests can both pass the check before either commits the insert. There are two standard fixes, and a strong interview answer names both and picks one with a reason:

- **Pessimistic locking:** take a row-level lock on the room (or the specific date range) before checking availability, hold it through the insert, then release. In Postgres terms, `SELECT ... FOR UPDATE` on the room row, or better, a range-exclusion constraint (`EXCLUDE USING gist (room_id, daterange WITH =, WITH &&)`) that makes the database itself reject any overlapping insert — this pushes the correctness guarantee into the schema instead of application code, which is the most robust option. The trade-off is that a lock briefly serializes bookings for the same room, but since a single room is only ever contended by a handful of concurrent requests (not millions), this cost is negligible.
- **Optimistic locking with retry:** read the room's current version/availability without locking, attempt the insert, and if a uniqueness/version conflict occurs, retry the read-then-write from scratch (with a small backoff). This avoids holding a lock during the read, which matters more under very high contention — but for hotel bookings, contention per room is low (rarely more than a few simultaneous requests for the exact same room and dates), so the added retry-loop complexity usually isn't worth it. It becomes the better choice once contention gets much higher — see Lesson 04 (Flight Booking), where a single seat can be contended by hundreds of concurrent requests.

Either way, the fix must live at the database layer (a constraint or an explicit lock plus transaction), not purely in application logic — two application servers checking an in-memory flag will still race, because "check" and "act" happening in two separate network round-trips to the DB is exactly the gap the race exploits.

**Payment sequencing.** A subtle failure mode: if payment is charged *before* the reservation insert succeeds, and the insert then loses the race, you've charged a guest with no reservation to show for it. The safe order is: reserve the room first (inside the same transaction/lock that enforces no-overlap), and only charge payment *after* the reservation is durably committed — with a short hold window if payment itself can fail, so a payment failure cleanly rolls back the reservation rather than leaving an unpaid "confirmed" booking.

## 5. Trade-offs / what breaks at 10x scale

- **A single primary Postgres instance for bookings becomes a write bottleneck** at high volume — but because booking writes are naturally partitionable by hotel/room (a room in Tokyo never contends with a room in Toronto), sharding by hotel ID (Phase 05 Lesson 03) scales this out cleanly, unlike systems where writes are globally contended.
- **The exclusion-constraint/lock approach degrades if a single, extremely popular property (a mega-resort with one bookable "presidential suite") gets disproportionate contention** — at that point the flight-booking-style optimistic-retry approach (Lesson 04) becomes worth adopting for that specific hot row.
- **Search cache staleness becomes more visible at 10x traffic** because more users see the same stale "available" room before the cache catches up to a just-completed booking — mitigated with a shorter TTL specifically on high-demand/low-remaining-inventory rooms, trading a bit more cache-miss load for fresher availability exactly where it matters.

## Interview Q&A

**Q: How do you prevent two guests from booking the same room for overlapping dates at the same time?**
A: Enforce the check-then-reserve sequence atomically at the database layer — either a row lock (`SELECT ... FOR UPDATE`) held across the check-and-insert, or, more robustly, a range-exclusion constraint on `(room_id, daterange)` that makes the database itself reject any overlapping insert regardless of what the application code does. Checking availability in application code without a DB-level guarantee will still race under concurrent requests.

**Q: Why is search served from a cache while booking talks directly to the primary database?**
A: The two paths have opposite consistency needs. Search only needs to be roughly right — a slightly stale "available" is a minor UX issue, not a correctness bug, and search traffic is 20x+ higher than booking traffic, making it exactly the kind of read load caching is built for. Booking is the moment the system commits to a guarantee, so it must read and write against the source of truth, re-validating availability rather than trusting a cache that could be seconds stale.

**Q: Should payment be charged before or after the reservation is confirmed?**
A: After. If you charge first and the reservation insert then loses a concurrency race, you've charged a guest with nothing to show for it. Reserving first (inside the transaction that enforces no-overlap) and charging only once that's durably committed means a payment failure can cleanly roll back an unpaid reservation, instead of a payment success stranding a reservation that never happened.

**Q: Why not just use a NoSQL database here for horizontal write scale, like you might for a chat or feed system?**
A: Because the core requirement is strong consistency under contention — a room must never be sold twice — and relational databases with real transactions and constraints are the tool purpose-built for that guarantee. NoSQL's appeal (flexible schema, easy horizontal write scale) matters most when eventual consistency is tolerable; here it isn't, and the actual write volume (a few bookings/sec) doesn't need NoSQL's scale benefits anyway.

**Q: How would you design cancellation so it doesn't reintroduce a race with a new booking for the freed-up room?**
A: Cancellation is itself a state transition guarded by the same transactional boundary — marking a reservation `CANCELLED` and making the room available again happens atomically, so a concurrent booking attempt either sees the room as still-reserved (and is correctly rejected) or sees it as freed (and can proceed) — there's no window where the room is ambiguously in both states.
