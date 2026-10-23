# Design a Distributed Key-Value Store

Every previous case study in this course has *used* a database or cache as a component — Redis for a cache, Postgres for booking inventory. This lesson flips the perspective: design the store itself, the way you'd be asked to "design Redis" or "design DynamoDB from scratch" in an interview. It's the natural capstone of this phase, because it's the one case study that pulls together nearly every distributed-systems building block from earlier in the course — consistent hashing for partitioning (Phase 04), replication and the CAP trade-off (Phase 09), and quorum-based agreement (Phase 09) — into a single system rather than using each in isolation.

## 1. Requirements

**Functional**
- `put(key, value)` — store a value under a key.
- `get(key)` — retrieve the value for a key.
- No complex queries, joins, or secondary indexes — this is deliberately a simpler interface than a relational database; the entire design effort goes into making these two operations correct and fast at massive, horizontally distributed scale.

**Non-functional**
- **Horizontal scalability** — the dataset must be able to grow far beyond what fits on (or can be served by) one machine, purely by adding more machines, with no single node ever needing to hold the entire keyspace.
- **High availability, tunable consistency** — this is the system where the CAP theorem (Phase 09 Lesson 02) stops being a whiteboard abstraction and becomes a literal configuration knob (see quorum deep dive below). Real systems like DynamoDB and Cassandra are explicitly AP-leaning by default specifically because "the shopping cart service is briefly unavailable" is worse for a retailer than "a cart occasionally shows slightly stale contents."
- **No single point of failure** — every node, not just a designated "primary," should be able to serve traffic; the system should keep functioning (in a degraded but available form) even when several nodes are down or unreachable.
- **Low, predictable latency** — single-digit-millisecond `get`/`put` latency, which shapes the choice of partitioning scheme (must route a request to the right node or two in O(1), not scan the whole cluster).

## 2. Back-of-envelope estimation

Assume 1 billion keys, average value size 1KB, a replication factor of 3, and 100,000 operations/sec at peak with a 9:1 read-to-write ratio typical of key-value workloads:

- Raw data size: 1,000,000,000 × 1KB ≈ **1TB** of logical data.
- Storage with replication: 1TB × 3 (replication factor) ≈ **3TB** actually stored across the cluster — the direct cost of the availability requirement above; every byte written is written three times, on three different nodes, so that any two can fail without losing data.
- Nodes needed: assuming each node comfortably holds 100GB of data (leaving headroom for compaction, indexes, and operational safety margin), 3TB ÷ 100GB ≈ **~30 nodes** minimum, purely from a storage-capacity standpoint (throughput requirements below may push this higher).
- Ops/sec per node: 100,000 ops/sec spread across 30 nodes ≈ **~3,300 ops/sec/node** average — modest for an in-memory or SSD-backed store, confirming that at this scale, capacity (not raw throughput) is the binding constraint on cluster size, though a real design would size for peak, not average, and add nodes well before any one is saturated.

## 3. High-level architecture

```
                     Client
                       │
                       ▼
            ┌─────────────────────┐
            │  Coordinator          │  any node can act as coordinator
            │  (any node receiving   │  for a request it receives
            │   the request)          │
            └──────────┬───────────┘
                       │ hash(key) → position on the ring
                       ▼
        ┌───────────────────────────────────┐
        │        Consistent Hash Ring          │   (Phase 04 L02)
        │                                         │
        │   Node A ── Node B ── Node C ── Node D  │
        │     ▲                             │      │
        │     └─────────────────────────────┘      │
        └───────────────────────────────────┘
                       │
        key's N=3 replicas = the next 3 nodes
        clockwise from hash(key) on the ring
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     Node B        Node C        Node D
   (replica 1)   (replica 2)   (replica 3)

   put/get waits for W (or R) of the 3 replicas to
   respond before returning to the client (quorum)
```

- Any node can act as the **coordinator** for a request it happens to receive from a client — there's no fixed leader for the cluster as a whole, which is itself a direct consequence of choosing availability over the "one primary" model.
- The **consistent hash ring** (Phase 04 Lesson 02) determines *which* nodes hold a given key's data: hash the key onto the ring, and the key's replicas are the next `N` distinct nodes walking clockwise from that point. This is the same structure Phase 04 introduces for load-balancer-to-server assignment with locality, reused here for data-to-node assignment — the underlying problem ("assign items to a changing set of nodes without reshuffling everything on every change") is identical.
- **Replication factor `N`** (commonly 3) means every key's data lives on 3 nodes, not 1 — the direct mechanism behind "no single point of failure" from the requirements.
- **Quorum reads/writes** (`W` and `R`, detailed below) determine how many of those `N` replicas must participate before an operation is considered successful, which is the literal, tunable expression of the CAP/consistency trade-off.

## 4. Deep dive

### 4.1 Consistent hashing for partitioning

The naive partitioning scheme — `node = hash(key) % num_nodes` — has a catastrophic problem the moment the cluster resizes: adding or removing a single node changes `num_nodes`, which changes the modulo result for *almost every key in the cluster*, meaning almost every key now maps to a different node than before. At the scale this design targets (30+ nodes, terabytes of data), that means a near-total data reshuffle triggered by a single node join or failure — exactly the failure mode Phase 04 Lesson 02 introduces consistent hashing to solve for load-balancer-to-server assignment.

Consistent hashing places both nodes and keys on the same conceptual ring (hash both onto the same numeric space, e.g., 0 to 2³²−1). A key belongs to the first node encountered walking clockwise from the key's hash position. When a node joins or leaves, only the keys that fell in the ring-segment immediately preceding that node are affected — every other key's assignment is untouched. In practice, each physical node is assigned many points on the ring (**virtual nodes**, per Phase 04 Lesson 02) rather than one, both to spread a departing node's load evenly across the remaining nodes (rather than dumping it all onto whichever single node happens to be next on the ring) and to smooth out uneven data distribution that a small number of raw node positions would otherwise produce.

For this key-value store specifically, the ring assignment also directly determines replica placement: a key's `N` replicas are simply the next `N` distinct physical nodes walking clockwise from the key's position — so the ring isn't just a load-distribution mechanism here, it's the entire replica-placement scheme.

### 4.2 Replication and quorum reads/writes

Storing `N` copies of every key protects against node failure, but introduces a new question: how many of those `N` copies need to agree before a `get` or `put` is considered successful? This is where Phase 09's CAP framing (Lesson 02) and quorum concept (Lesson 03) stop being abstract and become literal request-path parameters:

- **`W` (write quorum)** — the number of replicas that must acknowledge a `put` before it's considered successful and returned to the client.
- **`R` (read quorum)** — the number of replicas that must respond to a `get` before its result is returned to the client (if replicas disagree, the client/coordinator picks the most recent by timestamp/version).
- The standard tunable rule: **`W + R > N`** guarantees every read overlaps with the most recent write on at least one replica — if a write touched `W` replicas and a subsequent read consults `R` replicas out of the same `N`, and `W + R > N`, at least one replica must be in both sets by the pigeonhole principle, so the read is guaranteed to see the latest write on at least one of the replicas it consults.

Concretely, with `N = 3`:

- **`W = 3, R = 1`** — every write must reach all 3 replicas before succeeding (slow, and unavailable if even one replica is down), but any single replica read is guaranteed fresh. Strongly consistency-leaning.
- **`W = 1, R = 3`** — the inverse: fast, highly available writes (only one replica needs to ack), but every read must consult all 3 replicas to guarantee freshness (slow reads, and read fails if any replica is unreachable).
- **`W = 2, R = 2`** (with `N = 3`) — the classic balanced choice: `W + R = 4 > N = 3`, so freshness is still guaranteed, while both reads and writes tolerate one replica being down or slow, since only a majority (2 of 3) is needed either way. This is the default most real systems (DynamoDB, Cassandra) ship with, because it's the point on the curve where a single node failure never blocks either reads or writes.
- **`W = 1, R = 1`** — fastest and most available in both directions, but `W + R = 2` is not `> N = 3`, so there's no overlap guarantee — a read can legitimately return stale data if it happens to consult a replica the latest write didn't reach. This is a deliberate, explicit choice to favor availability and speed over the freshness guarantee — the AP end of the CAP trade-off, appropriate for workloads (a view counter, a shopping cart) where a few seconds of staleness is a non-issue but a rejected request is not.

Naming `W + R > N` explicitly, and walking through what changes at both extremes and the balanced middle, is the single most interview-relevant fact in this entire lesson — it's the mechanism that makes "distributed key-value stores let you tune consistency vs. availability" a concrete, calculable statement rather than a slogan.

### 4.3 Read repair and anti-entropy (conceptual)

Quorum reads/writes handle the *common* case of staleness detection at read time, but they don't by themselves fix a replica that's fallen behind — if `R = 2` and one of the two replicas consulted turns out to hold stale data, that replica just sits there stale until something actively corrects it. Two complementary mechanisms handle this at a conceptual level (a full treatment is out of scope, but naming both and what each solves is the expected depth):

- **Read repair** — a reactive, opportunistic fix. When a quorum read notices that the replicas it consulted disagree (one has an older version than another), the coordinator forwards the newer value to the stale replica(s) as a side effect of serving that read — piggybacking the repair on traffic that was happening anyway, rather than a separate dedicated process. This fixes staleness for keys that are actually being read; a key nobody reads for months stays stale under read repair alone.
- **Anti-entropy (via Merkle trees)** — a proactive, background fix for exactly that gap: periodically, replicas holding the same key range compare a **Merkle tree** (a hash tree summarizing the data in that range) instead of comparing every individual key. If two replicas' top-level hashes match, their entire ranges are provably identical and the comparison stops there; if they differ, the mismatch is narrowed down by recursively comparing child hashes, until only the specific differing keys are identified and synced — avoiding a full key-by-key comparison across potentially millions of keys per range. This is what eventually converges replicas that read repair alone would never touch.

The conceptual takeaway worth stating explicitly: an AP system's promise isn't "you'll never see stale data," it's "the system stays available during a partition, and stale replicas will *eventually* converge to consistency once the partition heals" — read repair and anti-entropy are the two mechanisms that make "eventually" an actual engineering guarantee rather than a hand-wave.

## 5. Trade-offs / what breaks at 10x scale

- **A hot key can overwhelm the small set of nodes that own it**, no matter how good the partitioning scheme is — consistent hashing distributes keys evenly, but it can't prevent one specific key (a viral post's like-counter, a flash-sale item) from getting disproportionate traffic against its fixed `N` replicas. The fix is detecting hot keys and giving them extra replicas beyond the normal `N` (or caching them at the coordinator/client layer) specifically for that key, rather than over-provisioning replication for the entire keyspace.
- **Merkle-tree anti-entropy becomes expensive to run at full scale if triggered too broadly** — comparing entire ranges across many replica pairs at once, at 10x data volume, competes for the same disk/network bandwidth as live traffic. The fix is scheduling anti-entropy incrementally and off-peak, and scoping each run to a bounded slice of the keyspace rather than a full-cluster sweep.
- **Quorum overlap guarantees degrade during a large-scale partition or correlated failure** — `W + R > N` assumes enough replicas are reachable to form both a write quorum and a read quorum; if more than `N − W` (or `N − R`) replicas in a given range are simultaneously unreachable (a rack or availability-zone outage taking out more nodes than the replication factor was sized to tolerate), operations against that range start failing outright. The fix is placing a key's `N` replicas across failure domains (different racks/AZs, not just different nodes) as part of the ring's replica-placement rule, so a single physical outage can't plausibly take out more replicas of one key than the design already tolerates.

## Interview Q&A

**Q: How do you avoid a massive data reshuffle every time a node joins or leaves the cluster?**
A: Consistent hashing — place both nodes and keys on the same hash ring, so a key belongs to the next node clockwise from its hash position. Adding or removing a node only affects the keys in the ring segment adjacent to that node, not the entire keyspace, unlike naive `hash(key) % num_nodes` where a change in node count reshuffles nearly every key's assignment. Virtual nodes (each physical node holding many ring positions) further smooth the load redistribution when a node does join or leave.

**Q: What does `W + R > N` mean, and why does it matter?**
A: `N` is the replication factor, `W` the number of replicas a write must reach to succeed, `R` the number a read must consult. If `W + R > N`, any read quorum and any write quorum are guaranteed to share at least one common replica (by the pigeonhole principle), so a read is guaranteed to see the most recent write on at least one of the replicas it checks. It's the concrete mechanism that turns "tune consistency vs. availability" from a slogan into an actual dial — e.g., `W=2, R=2, N=3` guarantees freshness while tolerating one replica being down on either path.

**Q: Would you build this as a CP or an AP system, and what would you tell the interviewer either way?**
A: Default to AP for a general-purpose key-value store — DynamoDB and Cassandra both lean this way by default — because for most key-value workloads (session data, shopping carts, caches) staying available during a partition matters more than every read being perfectly fresh, and quorum tuning (`W=1, R=1` or similar) lets you lean further toward availability when a workload tolerates it. If the interviewer specifies a workload where correctness is non-negotiable (a ledger balance, an inventory count), that's the signal to shift toward CP-leaning quorum settings (`W=N` or `R=N`) or point out that this workload might actually belong on a system with real transactions instead, the same argument the Hotel Booking and Payment Gateway lessons make for reaching for SQL.

**Q: What's the difference between read repair and anti-entropy, and why do you need both?**
A: Read repair is reactive — it only fixes staleness on replicas that happen to be touched by a quorum read, piggybacking the fix onto traffic that's happening anyway. Anti-entropy (via Merkle tree comparison) is proactive — it runs in the background and finds and fixes stale data even on keys nobody has read in a long time, which read repair alone would never touch. Together they guarantee eventual convergence: read repair handles the common, frequently-accessed case cheaply, anti-entropy is the backstop that guarantees nothing stays stale forever.

**Q: How would this design need to change to support range queries or secondary indexes, which the base design explicitly excludes?**
A: Consistent hashing on the primary key is deliberately bad for range queries — keys near each other logically (e.g., timestamps) hash to essentially random, unrelated positions on the ring, so a range scan would have to fan out to nodes across the entire ring instead of a contiguous few. Supporting real range queries typically means partitioning by key ranges instead of hash (as Cassandra's own column-family model or a system like HBase does), accepting a harder "how do you keep partitions balanced" problem in exchange for range-scan locality — a materially different partitioning trade-off worth naming rather than assuming the simple hash-ring scheme extends for free.
