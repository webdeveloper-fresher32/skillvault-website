# Design Uber / Lyft

Imagine you open the app, tap "Request Ride," and within 2-3 seconds you're shown a driver 400 meters away, already en route. Behind that instant match is a system continuously ingesting millions of GPS pings and answering, dozens of times a second: *"which drivers are near this exact point on Earth, right now?"* That's the core hard problem — everything else (fare calculation, trip state, payment) is a more familiar CRUD problem you've already built muscle for in earlier phases.

## 1. Requirements

**Functional**
- A rider can request a ride from their current location to a destination and get matched with a nearby available driver.
- A driver's location updates continuously and is visible to the rider once matched.
- The system computes a fare estimate up front and a final fare at trip end (surge pricing may apply).
- Both parties can see trip status transitions (requested → matched → arriving → in-progress → completed).

**Non-functional**
- **Availability over strict consistency** for location data — a slightly stale driver position is fine; failing to show *any* nearby driver is not.
- **Latency target:** driver match in under 3-5 seconds end to end.
- **Scale target:** tens of millions of location updates per minute globally, matching happening per-city (matching is inherently regional — a driver in Mumbai is never a candidate for a rider in Austin).

## 2. Back-of-envelope estimation

Assume 5 million active drivers globally, each pushing a location ping every 4 seconds while online, with ~30% of drivers online at any given moment during peak:

- Concurrent online drivers: 5,000,000 × 0.30 = 1,500,000
- Location updates/sec: 1,500,000 ÷ 4 ≈ **375,000 writes/sec** globally (this is why location data never touches the primary relational database — see the deep dive below).
- Assume 10 million ride requests/day, each triggering a handful of driver reads (candidate lookup, re-ranking as drivers move) — call it 10 reads per request: 10,000,000 × 10 ÷ 86,400 ≈ **~1,150 candidate-lookup reads/sec**, small compared to the location-write firehose, which tells you where to spend your design effort.
- Storage: trip history (rider, driver, route, fare) is the durable record — at 10M trips/day × ~2KB per trip record ≈ 20GB/day ≈ **~7.3TB/year**, trivially handled by a normal relational database with time-based partitioning.

## 3. High-level architecture

```
                         ┌────────────────────┐
   Rider App ───────────▶│    API Gateway      │◀─────────── Driver App
                         │  (Phase 08 L02)      │   (location pings)
                         └─────────┬───────────┘
                                   │
                 ┌─────────────────┼───────────────────────┐
                 ▼                 ▼                       ▼
        ┌────────────────┐ ┌───────────────┐     ┌──────────────────┐
        │ Matching Service │ │ Location Service│     │  Trip Service    │
        │ (geo query)      │ │ (ingest + index)│     │ (state machine)  │
        └────────┬─────────┘ └───────┬────────┘     └────────┬─────────┘
                 │                   │                        │
                 ▼                   ▼                        ▼
        ┌─────────────────┐ ┌──────────────────┐     ┌──────────────────┐
        │  Geo-index store  │ │  Redis (last-known │     │  Postgres (trips, │
        │ (Redis geospatial  │ │  driver positions,  │     │  fares, payments) │
        │  / quadtree cache) │ │  keyed by geohash)   │     │  Phase 05 L04     │
        └─────────────────┘ └──────────────────┘     └──────────────────┘
                 ▲
                 │  async, high-throughput ingest
        ┌─────────────────┐
        │  Message queue    │  (Phase 07 — location pings are
        │  (Kafka)          │   fire-and-forget, decoupled from
        └─────────────────┘   the read path that serves matches)
```

- **API Gateway** (Phase 08 Lesson 02) fronts both the rider and driver apps and routes to the right service — riders never call the Location Service directly.
- **Location Service** absorbs the 375K writes/sec firehose. It does not write every ping straight into a database; pings flow through a **queue** (Phase 07) so a burst never backs up the ingest path, and the latest position per driver is kept in an in-memory **geospatial index** (Redis `GEOADD`/`GEOSEARCH`, or an application-level quadtree/geohash grid) rather than a relational table — see the deep dive.
- **Matching Service** issues geo-radius queries against that index to find the N nearest available drivers, then applies business filters (driver rating, vehicle type, whether they just declined this rider).
- **Trip Service** owns the actual state machine and is the one place backed by a real relational database with transactions, because a trip's lifecycle and fare/payment need durability and consistency guarantees the location firehose doesn't.

## 4. Deep dive

**Geospatial driver matching.** The naive approach — "loop over every driver, compute distance, sort" — is O(n) per query and falls over immediately at a few hundred thousand online drivers. Two standard techniques make "find nearby drivers" fast:

- **Geohashing:** encode latitude/longitude into a string where common prefixes mean geographic proximity (e.g. `tdr1y` and `tdr1z` are neighboring cells). Drivers are bucketed by geohash cell; a query for "drivers near me" becomes "look up my cell and its 8 neighbors" — an O(1) hash lookup instead of a scan. This is exactly what Redis's `GEOADD`/`GEOSEARCH` commands do under the hood.
- **Quadtrees:** recursively subdivide the map into four quadrants, subdividing further wherever driver density is high. A quadtree adapts to non-uniform density (dense in city centers, sparse in suburbs) better than a fixed geohash grid, at the cost of more implementation complexity — most interview answers can stop at "geohash into Redis" and only reach for a quadtree if pushed on non-uniform density.

Either way, the key design decision is: **driver location never lives in the primary database.** It lives in a fast, mutable, in-memory index, refreshed continuously, because it's inherently transient (a position from 30 seconds ago is close to useless) and its write volume would drown any relational store. This is the same lesson as Phase 06's cache-aside pattern taken to its logical extreme — here the "cache" *is* the source of truth for the read path, and the database is only for the durable trip record.

**Real-time location updates.** Each driver's app pushes a ping over a persistent connection (WebSocket, or short-lived HTTP behind the Load Balancer from Phase 04) roughly every 3-5 seconds. Ingesting this at scale is an async-processing problem straight out of Phase 07: pings are pushed onto a queue/log (Kafka is the industry-standard choice here because it can sustain very high sequential write throughput) and a pool of consumers updates the geo-index. This decouples "how fast can we ingest" from "how fast can we update the index," so a temporary index slowdown doesn't cause dropped pings — they just queue briefly.

**Surge pricing (brief).** When demand (open ride requests) in a geo-cell outpaces supply (available drivers in that cell) beyond a threshold, a multiplier is applied to the base fare in that cell, computed on a short rolling window and cached per-cell (again, Redis) so every fare-estimate request isn't recomputing it from scratch. It is intentionally not deep-dived further here — it's a business-rules problem layered on top of the same geo-index, not a new infrastructure problem.

## 5. Trade-offs / what breaks at 10x scale

- **A single Redis geo-index becomes a bottleneck and a single point of failure.** The fix is sharding the index by city/region (matching is regional anyway, so this is a natural, low-cost partition — unlike sharding a general-purpose relational table) plus read replicas per shard.
- **The matching service's "find N nearest, then filter" approach degrades in extremely dense cells** (a stadium letting out 50,000 people simultaneously) — at that point you need tighter geo-cells and possibly a queueing/ticketing UX for demand spikes rather than pure real-time matching.
- **Trip Service's relational database becomes a write bottleneck** at 10x trip volume — the standard fix is the same one from Phase 05: read replicas for trip-history reads, and sharding trips by city or by a hash of `trip_id` once a single write node can't keep up.

## Interview Q&A

**Q: Why not just store driver locations in the same Postgres database as trips and users?**
A: Location updates are extremely high-frequency (hundreds of thousands of writes/sec) and each individual value is short-lived and low-value once superseded by the next ping — the opposite profile of a trip record, which is written once and needs durability. A relational database optimized for durable, transactional writes is the wrong tool for a firehose of ephemeral position updates; an in-memory geospatial index (Redis) is built for exactly this access pattern.

**Q: How do you find the nearest available drivers efficiently?**
A: Bucket driver positions by geohash (or maintain a quadtree) so "nearby" becomes a cheap lookup of the requester's cell plus its immediate neighbors, instead of a full scan-and-sort over every online driver. Redis's geospatial commands (`GEOADD`, `GEOSEARCH`) implement this pattern directly.

**Q: What happens if two riders are matched to the same driver at nearly the same instant?**
A: The Matching Service must treat "assign driver to rider" as an atomic operation — typically a conditional update (e.g., a Redis `SETNX`-style lock or a DB row-level lock on the driver's availability flag) so only one match wins; the loser is immediately re-matched to the next-nearest available driver.

**Q: How would you handle a driver going offline mid-trip (app crash, dead phone)?**
A: Location pings double as a heartbeat — if no ping arrives for a threshold window (say 30-60 seconds), the Trip Service flags the trip for manual/support intervention and the driver is marked unavailable in the geo-index so they stop being matched to new riders, even though their in-progress trip stays open until resolved.

**Q: Why is surge pricing computed per geo-cell instead of city-wide?**
A: Demand/supply imbalance is highly local — a stadium event can spike demand in one cell while the rest of the city is normal. Computing the multiplier per cell (using the same geo-index used for matching) gives accurate, responsive pricing instead of averaging away the actual imbalance across an entire city.
