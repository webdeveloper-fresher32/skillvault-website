# Phase 10 — Shard Key Selection

> A shard key is the label you file every book under. Pick a bad one, and one shelf holds everything while the rest sit empty.

---

## Table of Contents

1. [Shard Key Fundamentals](#1-shard-key-fundamentals)
2. [Shard Key Requirements](#2-shard-key-requirements)
3. [Ranged vs Hashed Sharding](#3-ranged-vs-hashed-sharding)
4. [Criteria for a Good Shard Key](#4-criteria-for-a-good-shard-key)
5. [Why ObjectId as Shard Key Creates Write Hotspots](#5-why-objectid-as-shard-key-creates-write-hotspots)
6. [Compound Shard Keys](#6-compound-shard-keys)
7. [Zone Sharding for Geographic Data](#7-zone-sharding-for-geographic-data)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Shard Key Fundamentals

You already know from the previous lesson that sharding splits data across machines instead of replicating the same overloaded machine three times. But *splitting* raises an immediate question: split by what? Every document has to be filed under some value, and MongoDB uses exactly one field (or set of fields) to decide which shard a document belongs to. That's the shard key.

Get this choice right, and the cluster behaves like the library from Section 1 of the last lesson — ten librarians, each genuinely busy, each holding a fair share of the books. Get it wrong, and you end up with nine idle librarians and one buried alive at their desk. Sharding "worked" in the sense that the collection is technically distributed — but you bought nine extra machines for nothing.

That's the stakes here: the shard key determines...

- **Which shard stores which document** (data distribution).
- **Which queries can be targeted** vs scattered across all shards.
- **Whether writes concentrate on one shard** (hotspot) or spread evenly.
- **Whether the cluster can be rebalanced** as it grows.

**Basic definition:** the shard key is one field, or a small set of fields, that MongoDB uses to decide which chunk — and therefore which shard — a document lives on.

And here's the part that makes this lesson worth taking seriously: a bad shard key cannot be changed after sharding without dropping and re-creating the collection (prior to MongoDB 5.0) or using `reshardCollection` (MongoDB 5.0+). This isn't a setting you tweak later. Choose carefully.

### The Shard Key Index

Every shard key field or compound shard key must be backed by an index. MongoDB creates this index automatically when you call `sh.shardCollection()`. For compound shard keys, the index must exist in the same order as the shard key fields.

```js
// This creates the shard key index automatically:
sh.shardCollection("ecommerce.orders", { customerId: 1, createdAt: 1 })

// For hashed sharding:
sh.shardCollection("ecommerce.orders", { customerId: "hashed" })
```

### Immutability of Shard Key Values

Once a document is inserted into a sharded collection, its shard key value **cannot be modified** (unless using `updateOne` with `upsert: false` in MongoDB 4.2+ which allows partial updates, but the shard key field itself cannot move the document to a different shard without using `findOneAndReplace`). Design your shard key from fields that never change.

---

## 2. Shard Key Requirements

Before you even get to "is this a *good* shard key," MongoDB has a shorter list of things it simply won't let you get away with. Think of these as the hard floor — fail one of these and `sh.shardCollection()` just refuses to run.

### Hard Requirements (MongoDB enforces these)

```
1. The shard key field(s) must exist in every document.
   Bad:  { customerId: 1 } when some docs have no customerId field
   Fix:  Ensure field is present before sharding, or use a field guaranteed present

2. The shard key must have an index before or during sharding.
   MongoDB creates it automatically on sh.shardCollection().

3. For unique indexes: the shard key must be a prefix of the unique index.
   Unique index: { customerId: 1, email: 1 }
   Shard key must be: { customerId: 1 } (prefix matches)

4. The shard key cannot be an array field (multikey index not allowed as shard key).

5. Shard key values cannot exceed 512 bytes total.
```

Beyond those hard rules, there's a second list — not enforced by MongoDB, but enforced by reality once your cluster is under load. These are the practical requirements Section 4 dives into in detail:

### Practical Requirements (Best Practices)

```
1. High cardinality       — enough distinct values to split into many chunks
2. Even write distribution — writes spread across all shards, not concentrated
3. Query-friendly         — common queries include the shard key for targeting
4. Immutable              — shard key values do not change after insert
5. Not monotonically      — avoid values that always increase (timestamps, ObjectId)
   increasing
```

---

## 3. Ranged vs Hashed Sharding

Here's a question that shapes everything downstream: once you've picked a field, how does MongoDB actually decide which chunk a given value falls into? There are two answers — ranged and hashed — and they trade off against each other in a way that will feel familiar if you've ever chosen between a phone book (alphabetical, range-friendly) and a hash table (uniform, but useless for "give me everyone between M and P").

### Ranged Sharding

Documents are distributed based on contiguous ranges of shard key values. MongoDB assigns each chunk a [min, max) range of shard key values.

```
Shard Key: { customerId: 1 }  (ranged)

Shard1:  [minKey   ──── "C200")
Shard2:  ["C200"   ──── "C600")
Shard3:  ["C600"   ──── maxKey]

Insert { customerId: "C150" } → Shard1
Insert { customerId: "C450" } → Shard2
Insert { customerId: "C800" } → Shard3
```

**Range query targeting:**

```js
// WITH ranged sharding on customerId:
db.orders.find({ customerId: { $gte: "C100", $lte: "C300" } })
// → targeted to Shard1 only (the range overlaps one chunk)

// If the range spans multiple chunks:
db.orders.find({ customerId: { $gte: "C100", $lte: "C700" } })
// → hits Shard1 AND Shard2 (both chunks overlap the range)
```

### Hashed Sharding

MongoDB computes a hash of the shard key value and distributes chunks based on hash ranges. The hash function is deterministic — the same key always produces the same hash.

```
Shard Key: { customerId: "hashed" }

customerId "C001" → hash: -7234891234  → Shard1
customerId "C002" → hash:  3456789012  → Shard3
customerId "C003" → hash: -1234567890  → Shard2
customerId "C004" → hash:  8901234567  → Shard3

Even though C001–C004 are sequential, they land on different shards.
```

Notice what just happened: four sequential customer IDs, scattered across shards, purely because their hashes have nothing to do with their sequence. That's the whole point of hashed sharding — it deliberately throws away any ordering the field had, in exchange for even distribution. But that trade cuts both ways:

**Range queries with hashed sharding:**

```js
// With hashed sharding on customerId:
db.orders.find({ customerId: { $gte: "C100", $lte: "C200" } })
// → SCATTER-GATHER: hashes are not contiguous, must hit all shards
// Range queries lose targeting with hashed shard keys!
```

### Comparison Table: Ranged vs Hashed

| Dimension                  | Ranged Sharding               | Hashed Sharding                        |
|----------------------------|-------------------------------|----------------------------------------|
| Data distribution          | By value range                | By hash — near-uniform                 |
| Equality query targeting   | Yes (exact shard key match)   | Yes (hash computed, shard identified)  |
| Range query targeting      | Yes (if range in one chunk)   | No — always scatter-gather             |
| Risk of write hotspot      | High (if monotonic key)       | Very low (hash distributes evenly)     |
| Presplit efficiency        | Natural for range data        | MongoDB pre-splits automatically       |
| Sort operations            | Can use index on same shard   | Cannot (data spread across shards)     |
| Good for                   | Range scans, geographic zones | Sequential keys (ObjectId, timestamps) |
| Bad for                    | Monotonically increasing keys | Range queries on shard key             |

### Choosing Ranged or Hashed

So which do you reach for? It comes down to one question: do your queries do range scans on this field, or just equality lookups?

```
Use RANGED when:
  ├── Your common queries do range scans on the shard key
  ├── You want sort results from a single shard (not scatter)
  ├── You are using zone sharding for geographic data
  └── Your shard key has naturally even distribution (e.g., username)

Use HASHED when:
  ├── Your shard key is monotonically increasing (ObjectId, createdAt)
  ├── Your workload is mostly equality lookups, not range scans
  ├── You want maximum write distribution with minimal tuning
  └── You have high-volume insert workloads
```

---

## 4. Criteria for a Good Shard Key

So far this has been "here's what MongoDB requires." This section is different — it's "here's what production experience has taught people to require of themselves." Five criteria, and almost every shard key horror story traces back to violating one of them.

### 1. High Cardinality

Here's the problem in one sentence: if a field only has a handful of possible values, MongoDB can only ever create a handful of chunks — no matter how much data you have.

Cardinality = the number of distinct values a field can have. High cardinality means MongoDB can create many chunks, which means finer-grained balancing.

```
Low cardinality (BAD):
  Field: status → values: ["pending","shipped","delivered"] (3 values)
  → Maximum 3 chunks. Cannot rebalance beyond 3 shards. Jumbo chunks guaranteed.

  Field: country → values: ~200 countries
  → Maximum 200 chunks. Better, but still limited.

High cardinality (GOOD):
  Field: userId → values: millions of UUIDs
  → Unlimited chunks. Full balancer flexibility.

  Field: email → values: millions of unique emails
  → Unlimited chunks. Works well.
```

### 2. Even Write Distribution

Writes should spread uniformly across all shards. A hotspot occurs when one shard receives a disproportionate share of writes.

```
Write distribution check:
  Insert rate per shard should be approximately equal.

Good: hashed customerId
  Shard1: ~33% of inserts
  Shard2: ~33% of inserts
  Shard3: ~34% of inserts

Bad: ranged timestamp (monotonically increasing)
  Shard1: 0% of new inserts  (old data only)
  Shard2: 0% of new inserts  (old data only)
  Shard3: 100% of new inserts (the current time range)
```

### 3. Query Isolation (Targeted Queries)

The shard key should appear in your most frequent, most performance-critical queries. If a query does not include the shard key, it scatter-gathers across all shards.

```
Collection: orders
Most common query patterns:
  1. Find all orders for a customer:    { customerId: "C123" }   ← high frequency
  2. Find orders by status:             { status: "pending" }    ← medium frequency
  3. Find orders in a date range:       { createdAt: { ... } }   ← low frequency

Best shard key: customerId
  → Query 1 is perfectly targeted (hits 1 shard)
  → Queries 2 and 3 scatter-gather (acceptable for lower frequency)
```

### 4. Immutability

```js
// GOOD shard key — userId never changes
sh.shardCollection("app.profiles", { userId: 1 })

// BAD shard key — email can change (user updates their email)
sh.shardCollection("app.profiles", { email: 1 })
// Problem: if email changes, the document's shard key value changes,
// requiring a delete-on-old-shard and insert-on-new-shard (expensive,
// and disallowed without explicitly using findOneAndReplace)
```

### 5. Not Monotonically Increasing

This is the one that trips people up most often, and it gets its own full section next, because the failure mode is subtle enough to deserve a walkthrough. The short version: monotonically increasing keys cause all new inserts to land on the last (highest-range) chunk, which always lives on one shard — a **write hotspot**.

```
BAD: { createdAt: 1 }  (always increasing)
  Time  0: all inserts → Shard1 (owns [min, Jan 1])
  Time  1: all inserts → Shard2 (owns [Jan 1, Jul 1])
  Time  2: all inserts → Shard3 (owns [Jul 1, max]) ← 100% of new writes here

BAD: { _id: 1 }  (ObjectId is time-based, monotonically increasing)
  → Same hotspot problem as timestamps

GOOD: { _id: "hashed" }  (hash of ObjectId spreads writes evenly)
GOOD: { customerId: 1 }  (not monotonic — customers insert in no particular order)
```

---

## 5. Why ObjectId as Shard Key Creates Write Hotspots

Of all five criteria above, "not monotonically increasing" is the one people violate by accident most often — because MongoDB's own default `_id` field is secretly guilty of it. Let's see exactly why.

### ObjectId Structure

An ObjectId is 12 bytes composed as:

```
┌──────────────────────────────────────────────────────────┐
│ ObjectId: 507f1f77bcf86cd799439011                       │
│                                                           │
│ Bytes 0–3:   Unix timestamp (seconds since epoch)        │
│              → MONOTONICALLY INCREASING                  │
│ Bytes 4–6:   Machine identifier                          │
│ Bytes 7–8:   Process ID                                  │
│ Bytes 9–11:  Random increment counter                    │
└──────────────────────────────────────────────────────────┘
```

The first 4 bytes are a timestamp. This means ObjectIds generated later in time are always larger than earlier ones. When used as a ranged shard key, all new documents have the largest ObjectId values and land in the "max" chunk — which lives on one shard.

### The Hotspot Illustrated

```
Ranged sharding on { _id: 1 } (ObjectId):

Jan:  Shard1 owns max chunk → 100% of writes land here
      ┌──────────────────────────────────────────────────┐
      │ Shard1 (MAXED OUT):   ████████████████████████  │
      │ Shard2 (IDLE):                                   │
      │ Shard3 (IDLE):                                   │
      └──────────────────────────────────────────────────┘

Feb:  Balancer splits chunk and moves it to Shard2
      New max chunk → Shard2 gets 100% of writes
      ┌──────────────────────────────────────────────────┐
      │ Shard1 (history):     ████████████████████████  │
      │ Shard2 (MAXED OUT):   ████████████████████████  │
      │ Shard3 (IDLE):                                   │
      └──────────────────────────────────────────────────┘

Effect: shards are never used concurrently for writes — this is NOT horizontal scaling!
```

Look closely at what the balancer is doing here: it's not broken, it's actually working as designed — splitting the overloaded chunk and moving it off. But the *next* chunk immediately becomes the new max chunk, and 100% of writes just follow it there. The balancer is bailing water out of a boat with a hole that never closes. No amount of balancing fixes a monotonic shard key, because the problem isn't chunk placement — it's that every single new document wants to go to the same place.

### The Fix: Hash the _id

```js
// Instead of ranged sharding on _id:
sh.shardCollection("app.events", { _id: 1 })    // BAD — write hotspot

// Use hashed sharding on _id:
sh.shardCollection("app.events", { _id: "hashed" })  // GOOD — even distribution

// OR use a compound key with a high-cardinality non-monotonic field first:
sh.shardCollection("app.events", { userId: 1, _id: 1 })
// userId is not monotonic, so writes spread based on userId
```

### When Monotonic Keys Are Acceptable

It's not that monotonic keys are always wrong — it's that using them *naively* is wrong. Monotonic keys are acceptable only when:
- You explicitly want range-based queries on the shard key (e.g., time-range queries).
- You pair the monotonic field with a high-cardinality prefix in a compound key.
- You use zone sharding to explicitly assign time ranges to shards.

**Common mistake:** assuming `_id` is a "safe default" shard key because it's always present and always indexed. It is present and indexed — but it's also time-based and monotonic, which makes it one of the worst default choices for a write-heavy ranged-sharded collection.

**Interview answer:** "ObjectId embeds a 4-byte Unix timestamp as its leading bytes, so newer ObjectIds are always numerically larger than older ones. With ranged sharding, the highest-value chunk lives on exactly one shard, and since every new insert has the largest ObjectId seen so far, 100% of writes land there — a hotspot. The balancer can split and relocate that chunk, but the *next* chunk instantly inherits the same problem, so balancing never actually distributes the write load. The fix is to hash the field, or prefix it with a high-cardinality, non-monotonic field in a compound key."

> **Memory hook:** "ObjectId is a clock wearing a disguise — sort by it, and every new insert stands in the same line."

---

## 6. Compound Shard Keys

Sometimes no single field satisfies all five criteria from Section 4 at once — one field has great cardinality but the wrong query pattern, another matches your queries but is monotonic. The fix isn't to compromise on one field; it's to combine two.

A compound shard key uses two or more fields as the shard key. This is a powerful technique to achieve both high cardinality and query targeting.

### Syntax

```js
sh.shardCollection("ecommerce.orders", { customerId: 1, createdAt: 1 })
// Shard key is the combination of customerId + createdAt
```

### How Compound Shard Keys Work

```
Chunk ranges with compound shard key { customerId: 1, createdAt: 1 }:

Chunk 1: [ {customerId: minKey, createdAt: minKey}, {customerId: "C500", createdAt: minKey} )
Chunk 2: [ {customerId: "C500", createdAt: minKey}, {customerId: "C500", createdAt: 2024-06-01} )
Chunk 3: [ {customerId: "C500", createdAt: 2024-06-01}, {customerId: maxKey, createdAt: maxKey} ]
```

### Query Targeting with Compound Shard Keys

The rule to remember: MongoDB can only use a compound shard key for targeting if your query includes at least the *leading* field(s), the same way a compound index only helps queries that use its prefix.

```js
// Full shard key query — perfectly targeted
db.orders.find({ customerId: "C123", createdAt: { $gte: ISODate("2024-01-01") } })
// → targeted to the shard(s) holding C123's data in that date range

// Prefix-only query — still targeted (first field of compound key)
db.orders.find({ customerId: "C123" })
// → targeted to shard(s) holding C123 (all of them, but still far fewer than all shards)

// Non-prefix query — scatter-gather
db.orders.find({ createdAt: { $gte: ISODate("2024-01-01") } })
// → scatter-gather, createdAt alone is not the shard key prefix
```

### Compound Key Patterns

Three patterns cover most real-world cases:

#### Pattern 1: High Cardinality + Monotonic

```js
// customerId (high cardinality, not monotonic) + createdAt (monotonic)
sh.shardCollection("ecommerce.orders", { customerId: 1, createdAt: 1 })

// Benefit: customerId distributes writes across shards
// Benefit: range queries on customerId + date are targeted
// Benefit: createdAt adds enough cardinality to avoid jumbo chunks
```

#### Pattern 2: Tenant + Resource

```js
// For multi-tenant applications:
sh.shardCollection("saas.events", { tenantId: 1, eventId: "hashed" })

// Benefit: all data for a tenant can be on one shard (zone sharding potential)
// Benefit: hashed eventId prevents hotspot within a tenant's chunk
```

#### Pattern 3: Geographic + Local ID

```js
sh.shardCollection("global.users", { region: 1, userId: 1 })
// Combined with zone sharding: US users → US shard, EU users → EU shard
```

That last pattern is the bridge into the next section — pairing a shard key with zone sharding is exactly how you make geography a first-class part of your data placement.

---

## 7. Zone Sharding for Geographic Data

### What Problem Does This Solve?

Everything so far has assumed the balancer gets to put chunks *wherever* it wants, as long as the load is even. But what if you don't want that freedom? What if EU user data legally has to stay on EU servers, or you want your paying customers on the fast NVMe shards while everyone else sits on cheaper disks?

That's a constraint the balancer can't infer from chunk counts alone — you have to tell it explicitly. That's zone sharding.

### Real-World Analogy

Back to the library: normally, the head librarian is free to reshelve any book to any desk to keep things balanced. Zone sharding is like drawing a line down the middle of the library and saying "European-language books never leave that side of the room, no matter how uneven the shelves get." The librarian still balances — but only within the boundary you drew.

### Basic Definition

Zone sharding (formerly "tag-aware sharding") lets you assign specific shard key ranges to specific shards. This is essential for:

- **Data residency** — keeping EU user data on EU servers to comply with GDPR.
- **Latency optimization** — routing US users to US data centers.
- **Hardware tiers** — keeping hot (recent) data on NVMe, cold (old) data on HDD.
- **Multi-tenancy** — dedicating certain shards to premium customers.

### Zone Architecture Diagram

```
Geographic Zone Sharding:

            mongos
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 Shard-US1  Shard-EU1  Shard-AP1
 Zone: US   Zone: EU   Zone: AP

config.shards tags:
  Shard-US1 → "US"
  Shard-EU1 → "EU"
  Shard-AP1 → "AP"

config.tags chunk ranges:
  region: ["US-min", "US-max") → Zone "US" → Shard-US1
  region: ["EU-min", "EU-max") → Zone "EU" → Shard-EU1
  region: ["AP-min", "AP-max") → Zone "AP" → Shard-AP1
```

### Setting Up Zone Sharding

```js
// Step 1: Add shard tags (zones) to shards
sh.addShardTag("shard-us1", "US")
sh.addShardTag("shard-eu1", "EU")
sh.addShardTag("shard-ap1", "AP")

// Or use the newer addShardToZone syntax (MongoDB 3.4+)
sh.addShardToZone("shard-us1", "US")
sh.addShardToZone("shard-eu1", "EU")
sh.addShardToZone("shard-ap1", "AP")

// Step 2: Enable sharding on the database
sh.enableSharding("globalapp")

// Step 3: Shard the collection with a shard key that includes region
sh.shardCollection("globalapp.users", { region: 1, userId: 1 })

// Step 4: Add tag ranges (assign key ranges to zones)
sh.addTagRange(
  "globalapp.users",
  { region: "US", userId: MinKey },  // range start (inclusive)
  { region: "US", userId: MaxKey },  // range end (exclusive)
  "US"                               // zone name
)

sh.addTagRange(
  "globalapp.users",
  { region: "EU", userId: MinKey },
  { region: "EU", userId: MaxKey },
  "EU"
)

sh.addTagRange(
  "globalapp.users",
  { region: "AP", userId: MinKey },
  { region: "AP", userId: MaxKey },
  "AP"
)

// Step 5: Verify zone configuration
sh.status()
// Should show zone assignments and chunk ranges per zone
```

### Hot/Cold Tiering with Zone Sharding

Geography isn't the only axis you can draw a zone boundary along. The same mechanism works for hardware tiers — recent data on fast disks, old data on cheap ones:

```js
// Shards with fast NVMe
sh.addShardToZone("shard-hot1", "hot")
sh.addShardToZone("shard-hot2", "hot")

// Shards with cheap HDD
sh.addShardToZone("shard-cold1", "cold")
sh.addShardToZone("shard-cold2", "cold")

// Shard on createdAt (ranged)
sh.shardCollection("app.events", { createdAt: 1 })

// Keep the last 3 months on hot storage
sh.addTagRange(
  "app.events",
  { createdAt: new Date("2024-04-01") },
  { createdAt: MaxKey },
  "hot"
)

// Archive older data to cold storage
sh.addTagRange(
  "app.events",
  { createdAt: MinKey },
  { createdAt: new Date("2024-04-01") },
  "cold"
)

// NOTE: Update these tag ranges monthly to keep recent data on hot storage
```

### Removing Zone Tags

```js
// Remove a tag range
sh.removeTagRange(
  "globalapp.users",
  { region: "US", userId: MinKey },
  { region: "US", userId: MaxKey },
  "US"
)

// Remove zone from a shard (shard no longer restricted to that zone)
sh.removeShardFromZone("shard-us1", "US")
```

### Common Mistakes / Confusions

```
1. Zones constrain the balancer — it will only move chunks within zone boundaries.
   If a zone has more chunks than shards assigned to it, balancing is limited.

2. All shards must have a zone assignment, OR have no zone assignment.
   If some shards have zones and others do not, untagged shards will
   receive overflow chunks that don't match any zone range.
   This can cause unintended data placement.

3. Updating zone ranges requires manual sh.addTagRange() and sh.removeTagRange() calls.
   Automate this for time-based tier rolling.

4. Zone sharding does not guarantee exact per-document routing without
   the zone field being the leading field in the shard key.
```

**Interview answer:** see Q6 and Q14 below — both walk through a real-world zone sharding scenario in full.

> **Memory hook:** "Zone sharding draws a fence around part of the library — the balancer can still reshelve, but never across the fence."

---

## 8. Hands-On Exercises

### Exercise 1 — Compare Shard Key Cardinality

```js
// Create a collection with three candidate shard keys
use analysis

for (let i = 0; i < 50000; i++) {
  db.events.insertOne({
    eventType: ["click","view","purchase","share"][i % 4],  // 4 values — LOW cardinality
    country: ["US","AU","UK","DE","FR","JP","SG","IN","BR","CA"][i % 10], // 10 — MEDIUM
    sessionId: UUID().toString(),   // unique per doc — HIGH cardinality
    userId: "U" + (i % 5000).toString().padStart(5,"0"),
    createdAt: new Date(Date.now() - Math.random() * 86400000 * 365)
  })
}

// Count distinct values for each candidate
db.events.distinct("eventType").length    // Should be 4
db.events.distinct("country").length      // Should be 10
db.events.distinct("sessionId").length    // Should be ~50000

// Which makes the best shard key and why? Document your reasoning.
// Hint: sessionId is good for cardinality but think about query patterns.
// If most queries filter by userId, what compound key makes sense?
```

---

### Exercise 2 — Demonstrate Write Hotspot with Ranged _id

```js
// Shard a collection with { _id: 1 } (ranged, monotonic — bad!)
use hotspot_demo
sh.enableSharding("hotspot_demo")
sh.shardCollection("hotspot_demo.logs", { _id: 1 })

// Insert 10,000 documents
for (let i = 0; i < 10000; i++) {
  db.logs.insertOne({ message: "event " + i, ts: new Date() })
}

// Check chunk distribution — expect all chunks on one shard
sh.status()
// All data should be on the "max chunk" shard

// Now compare with hashed:
db.logs_hashed.drop()
sh.shardCollection("hotspot_demo.logs_hashed", { _id: "hashed" })
for (let i = 0; i < 10000; i++) {
  db.logs_hashed.insertOne({ message: "event " + i, ts: new Date() })
}
sh.status()
// Chunks should be spread across shards
```

---

### Exercise 3 — Design a Compound Shard Key

For a multi-tenant SaaS application with this query pattern:
- 70% of queries: `{ tenantId: X, resourceId: Y }` (exact match)
- 20% of queries: `{ tenantId: X }` (all resources for a tenant)
- 10% of queries: `{ status: "active" }` (admin dashboards — can scatter)

```js
use saas
sh.enableSharding("saas")

// Option A: { tenantId: 1, resourceId: 1 }
sh.shardCollection("saas.resources_a", { tenantId: 1, resourceId: 1 })

// Option B: { tenantId: "hashed" }
sh.shardCollection("saas.resources_b", { tenantId: "hashed" })

// Option C: { tenantId: 1, _id: 1 }
sh.shardCollection("saas.resources_c", { tenantId: 1, _id: 1 })

// Insert test data and run explain() on each collection:
db.resources_a.find({ tenantId: "T001", resourceId: "R100" }).explain("executionStats")
// Check: is it a SINGLE_SHARD or SCATTER_GATHER plan?
// Which option best matches the query patterns above? Document your answer.
```

---

### Exercise 4 — Configure Geographic Zone Sharding

```js
// Assume you have 3 shards: shard-us, shard-eu, shard-ap
use admin

sh.addShardToZone("shard-us", "US")
sh.addShardToZone("shard-eu", "EU")
sh.addShardToZone("shard-ap", "AP")

sh.enableSharding("platform")
sh.shardCollection("platform.users", { region: 1, userId: 1 })

sh.addTagRange("platform.users",
  { region: "US", userId: MinKey }, { region: "US", userId: MaxKey }, "US")
sh.addTagRange("platform.users",
  { region: "EU", userId: MinKey }, { region: "EU", userId: MaxKey }, "EU")
sh.addTagRange("platform.users",
  { region: "AP", userId: MinKey }, { region: "AP", userId: MaxKey }, "AP")

// Insert users from each region
["US","EU","AP"].forEach(region => {
  for (let i = 0; i < 1000; i++) {
    db.users.insertOne({ region, userId: region + "_" + i, email: `u${i}@${region.toLowerCase()}.example` })
  }
})

// Verify data landed on correct shards
sh.status()
// EU users should ONLY be on shard-eu
// US users should ONLY be on shard-us
```

---

### Exercise 5 — Use explain() to Identify Scatter-Gather Queries

```js
use ecommerce
// Assuming orders collection sharded on { customerId: "hashed" }

// Targeted query (uses shard key)
db.orders.find({ customerId: "C1234" }).explain("executionStats")
// Look for: "SINGLE_SHARD" in winningPlan.stage

// Scatter-gather (no shard key)
db.orders.find({ status: "pending" }).explain("executionStats")
// Look for: "SHARD_MERGE" in winningPlan.stage
// Count: how many shards were contacted?

// Range query on shard key (hashed — will scatter)
db.orders.find({ customerId: { $gte: "C1000", $lte: "C2000" } }).explain("executionStats")
// With hashed sharding, range queries always scatter

// Range query on shard key (ranged sharding — targeted if within one chunk)
// Re-shard or use a collection with ranged sharding to compare:
db.orders_ranged.find({ customerId: { $gte: "C1000", $lte: "C1100" } }).explain("executionStats")
// Should show SINGLE_SHARD if range fits within one chunk

// Document your findings: which query patterns are safe with your shard key?
```

---

## 9. Interview Q&A

**Q1: What makes a shard key "good" vs "bad"? List the key criteria.**

A: A good shard key has: (1) **High cardinality** — many distinct values for fine-grained chunk splitting; (2) **Even write distribution** — inserts spread across all shards, no hotspots; (3) **Query isolation** — common queries include the shard key for targeted routing; (4) **Immutability** — values never change after document insertion; (5) **Not monotonically increasing** — avoids write hotspots caused by always landing on the "max chunk" shard.

---

**Q2: Why does using ObjectId as a ranged shard key cause a write hotspot?**

A: ObjectId contains a 4-byte Unix timestamp as its most significant component, making it monotonically increasing over time. With ranged sharding, MongoDB assigns the "max chunk" (highest key range) to one shard. Since every new ObjectId is always larger than all existing ones, 100% of new inserts land on that one shard. This negates the write-scaling benefit of sharding entirely.

---

**Q3: What is the difference between ranged and hashed sharding? When would you use each?**

A: Ranged sharding distributes documents based on contiguous value ranges, supporting range query targeting but risking hotspots with monotonic keys. Hashed sharding computes a hash of the shard key value, distributing documents uniformly at the cost of range query targeting (range queries always scatter-gather). Use ranged sharding when range scans are common and the key is not monotonic. Use hashed sharding when the key is monotonic or when maximum write distribution is the priority.

---

**Q4: Can you change a shard key after sharding a collection?**

A: In MongoDB 5.0+, you can use `reshardCollection` to change the shard key. In earlier versions, you cannot change the shard key — you must dump the data, drop the collection, re-shard with the new key, and restore. This is why shard key selection deserves careful planning before going to production.

---

**Q5: What is a compound shard key and when should you use one?**

A: A compound shard key uses multiple fields as the shard key, e.g., `{ customerId: 1, createdAt: 1 }`. Use compound keys when: (1) a single field has insufficient cardinality; (2) you want targeted queries on multiple field combinations; (3) you want to pair a high-cardinality non-monotonic field with a monotonic field to get both distribution and range targeting.

---

**Q6: Explain zone sharding and give a real-world use case.**

A: Zone sharding assigns specific shard key ranges to specific shards, constraining the balancer to only place those chunks on designated shards. Real-world use case: **GDPR compliance** — a global application stores EU user data (where `region: "EU"`) only on EU-based shards, ensuring European personal data never leaves EU data centers. Another use case: **hardware tiering** — recent (hot) data stays on NVMe-backed shards, older (cold) data migrates to cheaper HDD-backed shards.

---

**Q7: What happens if you shard on a field with only 5 distinct values?**

A: With only 5 distinct values, MongoDB can create at most 5 chunks (one per value). The balancer cannot further split these chunks because all documents within each chunk share the same shard key value — they become **jumbo chunks**. You cannot add more than 5 shards effectively, the cluster cannot be rebalanced properly, and the low-cardinality field creates uneven distribution if one value is more common than others.

---

**Q8: How does a scatter-gather query work? What is its performance impact?**

A: When a query does not include the shard key, mongos cannot determine which shard holds the data. It broadcasts (scatters) the query to all shards simultaneously. Each shard executes the query on its local data and returns results to mongos, which then merges (gathers) and returns the final result. The performance impact: query latency = max(shard latency), and all shards bear CPU/IO load. For large clusters, scatter-gather queries are significantly more expensive than targeted queries.

---

**Q9: What is the `_id` field's relationship to the shard key?**

A: The `_id` field does not have to be the shard key. However, if `_id` is NOT included in the shard key, MongoDB does not enforce uniqueness of `_id` across shards (only within each shard). To maintain global uniqueness, the shard key must be a prefix of the unique index, or you can use a unique index that includes the shard key. For the `_id` field specifically, MongoDB automatically ensures cluster-wide uniqueness for `_id` regardless of sharding.

---

**Q10: How does sh.addShardTag() differ from sh.addShardToZone()?**

A: `sh.addShardTag()` is the older syntax (MongoDB 3.2 and earlier). `sh.addShardToZone()` is the equivalent introduced in MongoDB 3.4 with clearer naming. Both assign a zone/tag name to a shard. The older "tag" terminology was renamed to "zone" to better reflect the feature's semantics. Functionally identical; use the newer `addShardToZone` / `addTagRange` in modern deployments.

---

**Q11: Can you have a unique index on a sharded collection that is NOT the shard key?**

A: Partially. MongoDB supports unique indexes on sharded collections only if the shard key is a prefix of the unique index. For example, with shard key `{ customerId: 1 }`, you can have a unique index on `{ customerId: 1, email: 1 }` — MongoDB can enforce uniqueness per shard. You cannot have a unique index on `{ email: 1 }` alone because email is not the shard key, and MongoDB cannot enforce uniqueness across all shards without routing every insert to check every shard.

---

**Q12: What is query targeting and how do you verify it with explain()?**

A: Query targeting means a query is routed to the minimum number of shards (ideally one). You verify it with `db.collection.find(query).explain("executionStats")`. In the output, look at `winningPlan.stage`: `SINGLE_SHARD` indicates targeting (one shard hit), while `SHARD_MERGE` indicates scatter-gather (multiple shards hit). Also look at `shards` in the `executionStats` section to see exactly which shards were contacted.

---

**Q13: What is the impact of a high-frequency insert workload on shard key selection?**

A: For high-frequency inserts, the primary concern is **write distribution**. If the shard key is monotonically increasing (e.g., a timestamp), all inserts hit one shard, creating a bottleneck that grows worse over time. The ideal shard key for high-frequency inserts has high cardinality and no ordering correlation with insert time — or use hashed sharding to guarantee uniform distribution regardless of key ordering.

---

**Q14: Describe a scenario where zone sharding and compound shard keys work together.**

A: Multi-tenant global SaaS with data residency requirements. Shard key: `{ region: 1, tenantId: 1 }`. Zones: `EU` zone assigned to EU shards, `US` zone assigned to US shards. Zone ranges: `{ region: "EU", tenantId: MinKey }` to `{ region: "EU", tenantId: MaxKey }` → EU zone. This ensures: (1) EU data stays on EU shards (compliance); (2) queries filtered by `region` and `tenantId` are targeted to a single shard; (3) the balancer only moves EU chunks between EU shards.

---

**Q15: What monitoring would you set up to detect shard key hotspots in production?**

A: Monitor the following: (1) **Write throughput per shard** via `db.serverStatus().opcounters` on each shard's primary — unequal insert rates signal a hotspot; (2) **Chunk distribution** via `sh.status()` — heavily skewed chunk counts indicate imbalance; (3) **CPU and I/O utilization per shard** via system metrics or MongoDB Atlas metrics; (4) **Balancer migration rate** via `config.changelog` — constant migrations suggest the balancer is fighting a hotspot it cannot fully correct; (5) **Jumbo chunks** via `db.getSiblingDB("config").chunks.find({ jumbo: true })`.
</content>
