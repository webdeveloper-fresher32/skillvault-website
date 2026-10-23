# Design a Flight Booking System

A budget airline releases a 500-seat flash sale for a popular route. In the first minute, 2,000 people are simultaneously trying to book the last 12 seats in economy. This is the hotel-booking problem from Lesson 03 turned up to an extreme — same core requirement (never oversell inventory), but the contention on a single resource is orders of magnitude higher, which changes which concurrency-control technique is the right default.

## 1. Requirements

**Functional**
- A traveler searches flights by origin, destination, date, and gets fares across multiple airlines/routes.
- A traveler selects a flight and seat class, and books a seat, paying at booking time.
- The system must never sell more seats on a flight than physically exist.
- A traveler can cancel a booking, subject to fare-rules-driven refund policy.

**Non-functional**
- **Strong consistency for seat inventory** — same non-negotiable as hotel booking, but now under much higher per-resource contention (hundreds of concurrent requests can target the exact same flight+cabin-class inventory pool, versus a handful for a single hotel room).
- **Search and pricing must scale independently from booking** — a fare search fans out across many airlines/routes and is inherently more compute-heavy (this deep dive covers why it's kept as a separate service).
- **Latency target:** search results in 1-3 seconds (multi-airline fan-out is slower than a single-hotel-chain search); booking confirmation in under 3-5 seconds.
- **Scale target:** a handful of popular routes/dates absorb wildly disproportionate demand (holiday travel, flash sales) — the system must be designed for hot-spot contention, not just average load.

## 2. Back-of-envelope estimation

Assume a booking platform handling 500,000 bookings/day across many airlines, with demand heavily skewed toward peak booking windows and popular routes:

- Average bookings/sec: 500,000 ÷ 86,400 ≈ **~5.8/sec**, but a single popular flight during a flash sale can see hundreds of concurrent booking attempts against **one shared counter** (that flight's remaining-seats value) — this per-resource hot-spot contention, not aggregate throughput, is the number that actually drives the design.
- Search requests/day are typically 15-20x booking requests (comparison shopping across dates/airlines before committing): ~500,000 × 18 ÷ 86,400 ≈ **~104 searches/sec average**, spiking much higher around fare-sale announcements.
- Storage: a booking record (passenger, flight, seat, fare, status) at ~1.5KB, 500,000/day → 750MB/day ≈ **~270GB/year** — again, not the bottleneck; seat-inventory contention is.

## 3. High-level architecture

```
                     ┌───────────────────┐
   Traveler ────────▶│   API Gateway       │  (Phase 08 L02)
                     └─────────┬─────────┘
                               │
              ┌─────────────────┼─────────────────────┐
              ▼                                        ▼
     ┌──────────────────────┐                 ┌──────────────────────┐
     │  Search & Pricing        │                 │  Booking Service        │
     │  Service (read path,      │                 │ (write path — seat       │
     │  fans out to airline       │                 │  inventory, the           │
     │  fare APIs, aggressively    │                 │  contended resource)      │
     │  cached, Phase 06)          │                 └───────────┬────────────┘
     └──────────────────────┘                             │
                                                            ▼
                                                  ┌──────────────────────┐
                                                  │  Postgres — seat        │
                                                  │  inventory + bookings    │
                                                  │  (optimistic locking,     │
                                                  │  Phase 05 L04)             │
                                                  └───────────┬────────────┘
                                                              ▼
                                                  ┌──────────────────────┐
                                                  │  Payment Service         │
                                                  │  (Phase 11 L08,           │
                                                  │  idempotency keys)        │
                                                  └──────────────────────┘
```

- **Search & Pricing is a deliberately separate service** from Booking — it has a fundamentally different load profile (fan-out to many external fare sources, heavily cacheable, tolerant of a few seconds of staleness) versus Booking's need for exact, contended, real-time inventory truth. Coupling them into one service would force the low-latency-tolerant booking path to inherit the search path's fan-out latency, and vice versa force search to be over-cautious about consistency it doesn't need.
- **Booking Service** owns the seat-inventory table and is where the concurrency-control decision below actually matters.

## 4. Deep dive

**Seat inventory under much higher contention than a hotel room.** Lesson 03 recommended pessimistic locking (or a DB exclusion constraint) as the default for hotel bookings, because contention per room is low. Flights invert that: a single popular flight's remaining-seat-count can be hit by hundreds of concurrent booking attempts in a short window, and holding a pessimistic lock across that many waiting requests would serialize them into a long queue, tanking latency for everyone even though only a handful will actually succeed.

The better default here is **optimistic locking with retry**:
1. Read the flight's current seat count (and a version number, or rely on the row's own version via `xmin`/an explicit `version` column).
2. Attempt to decrement the count and insert the booking in one transaction, conditioned on the version matching what was read (`UPDATE flights SET seats_remaining = seats_remaining - 1, version = version + 1 WHERE flight_id = ? AND version = ? AND seats_remaining > 0`).
3. If zero rows were affected (someone else updated first, or seats ran out), retry the read-check-write from the top, or fail fast with "sold out" if `seats_remaining` was already 0.

This avoids any request holding a lock while it waits — every request either succeeds outright or is told immediately to retry, and the database's own atomic conditional update is what prevents overselling, not an application-held lock. The trade-off is wasted work on retries during extreme contention, which is an acceptable cost against the alternative (a long, serialized queue of lock-waiters). For truly extreme hot-spots (a flash sale on one flight), some real systems add a short-lived in-memory counter (Redis `DECR`, similar to a rate-limiting pattern from Phase 06 Lesson 03) as a fast pre-check that rejects obviously-sold-out attempts before they even reach the database, reserving the DB-level optimistic check as the final, authoritative gate.

**Keeping search/pricing separate from booking.** Fare search is a fundamentally different problem: it fans out across multiple airlines' inventory and pricing systems (or a cached aggregation of them), applies complex fare rules, and can tolerate results that are a few seconds stale — nobody is harmed if a displayed fare changes slightly by the time they click "book," as long as the booking step re-validates the actual price and availability before charging. Architecturally this means Search & Pricing is heavily cached (Phase 06) and can scale its read replicas independently, while Booking stays a small, tightly consistent service focused purely on the seat-decrement-and-charge transaction. Interviewers often probe this split specifically to see if you'll conflate "the thing users spend the most time on" (search) with "the thing that actually needs the strongest guarantees" (booking) — they are not the same service for good reason.

## 5. Trade-offs / what breaks at 10x scale

- **Even optimistic retry saturates on an extreme hot-spot** (a single viral flash-sale flight) — the fix is the Redis fast-pre-check mentioned above, or queueing excess demand behind a virtual waiting room (a pattern many ticketing/flash-sale systems use) rather than letting all demand hit the database simultaneously.
- **Search & Pricing's fan-out to external airline APIs becomes the latency bottleneck**, not this system's own infrastructure — the fix is aggressive caching of fare results with short TTLs and asynchronously refreshing popular routes ahead of demand, rather than fetching live on every search.
- **A single Booking Service database shard per flight/route works well until one route (say, a new low-cost carrier's flagship route) dominates traffic disproportionately** — at that point, that specific flight's row becomes a hot partition even within a well-sharded table, and the Redis pre-check layer becomes necessary rather than optional.

## Interview Q&A

**Q: Why does this system favor optimistic locking while the hotel-booking system favored pessimistic locking?**
A: The difference is contention level, not the underlying correctness requirement (both need strong consistency). A single hotel room is rarely contended by more than a couple of simultaneous requests, so a brief lock is cheap. A single flight's seat inventory can be hit by hundreds of concurrent requests during a sale, and holding a lock across that many waiters would serialize and slow down nearly everyone — optimistic locking lets each request attempt independently and only pays a retry cost on an actual conflict, which scales better under high contention.

**Q: Why is Search & Pricing a separate service from Booking rather than one flight service?**
A: They have opposite load and consistency profiles. Search fans out across many fare sources, is heavily cacheable, and tolerates a few seconds of staleness. Booking is a small, tightly consistent transaction against the authoritative seat count. Combining them would force search's fan-out latency onto booking, or force booking's strict consistency needs onto every search query — neither is necessary.

**Q: How do you prevent a flash-sale flight from overwhelming the database with retries?**
A: Add a fast, cheap pre-check ahead of the database — a Redis counter (`DECR`) that immediately rejects requests once the visible seat count hits zero, similar to a rate-limiter. This absorbs the bulk of doomed requests before they generate database load, while the database's own optimistic conditional update remains the final source of truth in case the Redis counter and the DB briefly disagree.

**Q: What happens if two optimistic-locking attempts both read the same seat count and both try to book the last seat?**
A: Only one of the two conditional updates (`WHERE version = <read_version> AND seats_remaining > 0`) will actually match a row and succeed — the database guarantees that atomically. The other update affects zero rows, and the application detects that and either retries against the fresh count (finding the flight sold out) or returns "sold out" immediately.

**Q: How would you handle refunds/cancellations without letting a cancelled seat's slot be double-sold to a new booking racing the cancellation?**
A: Cancellation is itself a conditioned update — incrementing `seats_remaining` and marking the booking `CANCELLED` happen in the same atomic transaction, versioned the same way as the booking path, so a concurrent new-booking attempt either sees the pre-cancellation count (and correctly fails if already full) or the post-cancellation count (and correctly succeeds) — never an inconsistent in-between state.
