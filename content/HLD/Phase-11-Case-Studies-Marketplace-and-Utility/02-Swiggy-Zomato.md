# Design Swiggy / Zomato (Food Delivery)

You order biryani at 8pm. The app matches you to a restaurant, the restaurant accepts and starts cooking, a delivery partner is assigned and rides over, picks it up, and drops it at your door — with a live map the whole time. It looks like Uber with an extra hop, and the location/matching machinery genuinely *is* the same as Phase 11 Lesson 01. What's different, and the actual interview differentiator, is that this is a **three-sided marketplace** with an **order that moves through many more states** than a ride does.

## 1. Requirements

**Functional**
- A customer browses restaurants (by location + cuisine), places an order, and tracks it live.
- A restaurant receives the order, accepts/rejects it, and marks it "ready for pickup."
- A delivery partner is assigned, navigates to the restaurant, picks up, and delivers, updating location throughout.
- The system computes ETA at each stage and handles order cancellation at any point before pickup.

**Non-functional**
- **Availability for browsing/tracking** (stale ETA is acceptable), **consistency for order state** (an order must never be silently lost or double-assigned to two delivery partners).
- **Latency target:** order placement acknowledged in under 1 second; delivery-partner assignment within 10-20 seconds of restaurant acceptance.
- **Scale target:** regional — matching and restaurant search only ever need to consider one city/delivery-zone at a time, which is a major simplification versus a truly global system.

## 2. Back-of-envelope estimation

Assume 2 million orders/day across all cities, concentrated in three peak windows (lunch, dinner, late-night) that each carry roughly 25% of daily volume in a 2-hour window:

- Peak orders/sec: (2,000,000 × 0.25) ÷ (2 × 3600) ≈ **~70 orders/sec** at peak — modest compared to Uber's location firehose, because *order placement* is the write-heavy event here, not continuous position streaming (delivery-partner location still generates a similar per-partner ping volume as Phase 11 Lesson 01, just at a smaller fleet size).
- Each order triggers several downstream events (restaurant notify, delivery-partner match, 2-4 status-update pushes to the customer) — call it 6 events per order: 70 × 6 = **~420 events/sec** through the async pipeline at peak.
- Storage: an order record (items, prices, addresses, timestamps, state history) at ~3KB, 2M/day → 6GB/day ≈ **~2.2TB/year**, again comfortably within a relational database's normal operating range with time-based partitioning.

## 3. High-level architecture

```
   Customer App        Restaurant App        Delivery Partner App
        │                    │                        │
        └───────────┬────────┴───────────┬────────────┘
                     ▼                    ▼
              ┌────────────────────────────────┐
              │        API Gateway              │  (Phase 08 L02)
              └────────────┬───────────────────┘
                            │
        ┌───────────────────┼────────────────────────┐
        ▼                   ▼                        ▼
┌───────────────┐  ┌──────────────────┐     ┌───────────────────┐
│ Order Service   │  │ Matching Service   │     │ Location Service    │
│ (state machine, │  │ (delivery-partner  │     │ (same geo-index as  │
│  Postgres)       │  │  assignment,       │     │  Lesson 01, scoped  │
│  Phase 05 L04    │  │  reuses geo-index)  │     │  per delivery zone) │
└───────┬───────┘  └────────┬─────────┘     └───────────────────┘
        │                    │
        ▼                    ▼
┌────────────────────────────────────────┐
│      Event bus / queue (Phase 07)         │
│  order.placed → notify restaurant          │
│  order.accepted → trigger matching          │
│  order.picked_up → notify customer           │
│  order.delivered → close out, request rating  │
└────────────────────────────────────────┘
```

- The **Order Service** is the system of record for order state, backed by a relational database (Phase 05 Lesson 04) precisely because an order's lifecycle needs transactional guarantees — you never want a payment recorded against an order that silently vanished.
- **Matching Service** reuses the exact geospatial-index technique from Uber (Phase 11 Lesson 01) to find nearby available delivery partners, scoped to the restaurant's delivery zone.
- Every state transition is published as an event onto a **queue/event bus** (Phase 07 Lesson 03) so the restaurant app, customer app, and any analytics consumers react independently without the Order Service needing to know who's listening — this is the event-driven pattern, not a plain task queue, because multiple independent consumers care about the same event.

## 4. Deep dive

**Three-sided marketplace vs Uber's two-sided one.** Uber matches rider ↔ driver. This system matches customer ↔ restaurant ↔ delivery partner, and — critically — the *restaurant* is a stateful participant with its own workflow (accept/reject, cook time, mark-ready), not just a static catalog entry. That means:

- Matching happens in **two separate steps**, not one: first the *order* is placed against a restaurant (a normal catalog + checkout flow), and only *after* the restaurant accepts does delivery-partner matching begin. Coupling these into a single step would mean assigning a delivery partner before you even know the restaurant will accept — wasted matches and idle partners.
- The delivery partner's job now has two legs — restaurant → pickup, then pickup → customer — so the Location Service's geo-index needs to answer two different queries at two different times ("who's near this restaurant" then implicitly "who's already en route with this order"), whereas Uber's driver only ever has one leg (pickup → drop-off) per match.

**Order-state machine design.** This is the actual hard problem this lesson adds beyond Uber's matching problem — an order has far more legitimate states and far more places it can be legitimately cancelled:

```
PLACED → RESTAURANT_ACCEPTED → PREPARING → READY_FOR_PICKUP
       → PARTNER_ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
       ↘ (from PLACED or RESTAURANT_ACCEPTED) CANCELLED
       ↘ (from PLACED)                        RESTAURANT_REJECTED
```

Two design rules keep this tractable at scale:
1. **Transitions are enforced server-side as an explicit whitelist** (e.g. `PICKED_UP` can only follow `PARTNER_ASSIGNED`), not left to client apps to "just call the right endpoint in order" — three different client apps (customer, restaurant, delivery partner) each trigger a subset of transitions, and without server-side enforcement a buggy or malicious client could skip a state and corrupt the order record.
2. **Every transition writes an immutable state-history row** (not just an overwritten `status` column) — this is what powers the live tracking UI, dispute resolution ("the restaurant claims they marked it ready at 8:05, the delivery partner says they weren't assigned until 8:20"), and analytics, without needing a separate audit-log system bolted on afterward.

## 5. Trade-offs / what breaks at 10x scale

- **A single Order Service database becomes a write bottleneck during lunch/dinner peaks** — the standard fix is sharding by city or delivery zone (orders are inherently regional, same argument as Uber's geo-index sharding), plus read replicas for the tracking-page read load.
- **The event bus becomes a fan-out bottleneck** if every consumer (notifications, analytics, fraud detection) subscribes to the same raw event stream at 10x volume — the fix is giving high-fan-out consumers their own filtered/aggregated topic rather than all consumers re-processing every raw event.
- **Restaurant accept/reject latency becomes the dominant customer-facing delay** at scale, not the infrastructure — this is a product problem (auto-reject after a timeout, surface restaurant responsiveness in ranking) more than an architecture one, worth naming explicitly in an interview to show you can distinguish infra bottlenecks from product-design bottlenecks.

## Interview Q&A

**Q: How is this system's matching problem different from Uber's?**
A: Uber is a two-sided match (rider ↔ driver) done once per trip. This is a three-sided marketplace where the *restaurant* is itself a stateful actor that must accept the order before delivery-partner matching even begins — so matching happens in two sequential stages instead of one, and the delivery partner's job has two legs (to the restaurant, then to the customer) instead of one.

**Q: Why store order-state transitions as an append-only history instead of just a `status` column?**
A: An append-only history gives you the exact timestamped sequence of what happened and when, for free — powering live tracking, dispute resolution between the three parties, and analytics — without a separate audit log. A single mutable `status` column would need a bolted-on audit table to get the same guarantees, and you'd have to keep the two in sync yourself.

**Q: Why enforce state transitions server-side instead of trusting each app to call the right endpoint in sequence?**
A: Three independent client apps (customer, restaurant, delivery partner) each drive a subset of transitions, and any one of them could be buggy, out of date, or malicious. A server-side whitelist of valid transitions (e.g., `PICKED_UP` only follows `PARTNER_ASSIGNED`) is the single source of truth that keeps the order record consistent regardless of what any individual client sends.

**Q: Why use an event bus / pub-sub here instead of the Order Service directly calling the notification and matching services?**
A: Multiple independent consumers care about the same order-state event — the restaurant app, the customer app, analytics, fraud checks — and that list grows over time. Publishing an event and letting each consumer subscribe (Phase 07 Lesson 03's pattern) means the Order Service never needs to know or change when a new consumer is added, versus a growing list of direct synchronous calls that couple it to every downstream system's availability.

**Q: What happens if the assigned delivery partner cancels or goes offline after pickup but before delivery?**
A: The Order Service transitions the order back to a re-matchable state (conceptually similar to `READY_FOR_PICKUP`, but flagged as already-paid-for/in-transit) and the Matching Service re-runs the geo-query to assign a new nearby partner; the state-history log captures the reassignment for support/dispute purposes.
