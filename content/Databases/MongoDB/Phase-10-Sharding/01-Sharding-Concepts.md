# Phase 10 — Sharding Concepts

> Replica set gives copies. Sharding gives more space.

---

## Table of Contents

1. [What Is Sharding and Why It Exists](#1-what-is-sharding-and-why-it-exists)
2. [Horizontal vs Vertical Scaling](#2-horizontal-vs-vertical-scaling)
3. [Sharded Cluster Architecture](#3-sharded-cluster-architecture)
4. [Chunks and Chunk Splitting](#4-chunks-and-chunk-splitting)
5. [The Balancer](#5-the-balancer)
6. [sh.status() Explained](#6-shstatus-explained)
7. [When to Shard — Thresholds and Decision Matrix](#7-when-to-shard--thresholds-and-decision-matrix)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What Is Sharding and Why It Exists

Here's a question worth sitting with for a second: you already have a replica set. Three copies of your data, automatic failover, read scaling across secondaries. So why isn't that enough?

Because a replica set doesn't give you a single extra byte of *capacity*. Every secondary holds a full copy of the exact same data the primary holds. Ask for more disk, more RAM, more write throughput, and a replica set has nothing new to offer you — it was never built to solve that problem. It was built for availability, not for outgrowing a machine.

> Replica set gives copies. Sharding gives more space.

That's the whole distinction in one line. When your data (or your write load) has actually outgrown what any single machine can hold or handle, replicating the same overloaded machine three times just gives you three overloaded machines. What you actually need is to *split* the data — hand different pieces of it to different machines. That's sharding.

### The Core Problem

Concretely, here's where a single node runs out of road:

- CPU cores per machine cap out around 96–128 in practice.
- RAM per machine tops at a few TB at most.
- A single NVMe disk delivers ~7 GB/s sequential reads.
- A 24 TB NVMe array costs $50,000+; adding a second machine of the same spec costs the same but doubles capacity AND throughput.

Notice that last point — it's the real argument for sharding. Buying a bigger single machine gets exponentially more expensive as you approach the ceiling. Buying a *second* ordinary machine costs the same as the first one, and gives you double. That arithmetic only works if you're willing to split the data across machines rather than cramming it all onto one.

So: when your working set (the data accessed frequently) no longer fits in RAM, or write throughput saturates a single node's I/O, that's your signal — you need sharding.

### Real-World Analogy

Think of a library. A single librarian can handle 20 patrons per hour. When 200 patrons arrive, you hire 10 librarians and split the catalog across 10 desks. Each librarian owns a subset of books (by author last name, for example). A front-desk receptionist (mongos) routes each patron to the right librarian. A master catalog (Config Servers) tracks which desk owns which books.

That is exactly the MongoDB sharded cluster model — and notice it's a completely different move than "hire 10 librarians who each memorize the *entire* catalog" (that would be a replica set). Here, each librarian genuinely owns a *different slice* of the books.

**Basic definition:** sharding is MongoDB's approach to **horizontal scaling** — distributing data across multiple servers (shards) so that no single machine bears the entire read/write load or stores the entire dataset.

---

## 2. Horizontal vs Vertical Scaling

Once you accept you need more room, there are really only two directions to go: make the one machine bigger, or add more machines. Let's look at both honestly — vertical scaling isn't wrong, it's just got a ceiling.

### Vertical Scaling (Scale Up)

Increase the power of a single machine: more CPU, more RAM, faster disks.

```
Before                         After
┌─────────────────┐            ┌─────────────────────────┐
│  mongod         │            │  mongod                 │
│  8 vCPU         │  ──────►  │  64 vCPU                │
│  32 GB RAM      │            │  512 GB RAM             │
│  2 TB NVMe      │            │  32 TB NVMe             │
└─────────────────┘            └─────────────────────────┘
     $2,000/mo                       $20,000/mo
```

**Pros:**
- Simple — no application changes needed.
- No network latency between data and compute.
- Works well for datasets under ~5 TB.

**Cons:**
- Hard ceiling — the biggest machines stop at some point.
- Cost increases non-linearly (10x CPU costs 50x the price).
- Single point of failure even with replicas (they replicate data, not scale writes).
- Replica sets help with read scaling but NOT write scaling.

Why would you ever avoid this, if it's the "no application changes" option? Because it's a dead end. There's always a bigger machine you can't buy, at any budget.

### Horizontal Scaling (Scale Out)

Add more machines, each owning a partition of the data.

```
Before                           After
┌─────────────────┐            ┌──────┐  ┌──────┐  ┌──────┐
│  mongod         │            │Shard1│  │Shard2│  │Shard3│
│  64 vCPU        │  ──────►  │8 CPU │  │8 CPU │  │8 CPU │
│  512 GB RAM     │            │128GB │  │128GB │  │128GB │
│  32 TB NVMe     │            │10TB  │  │10TB  │  │10TB  │
└─────────────────┘            └──────┘  └──────┘  └──────┘
    $20,000/mo                   $6,000/mo (total: $18,000/mo, 3x capacity)
```

**Pros:**
- Near-linear capacity and throughput growth.
- Commodity hardware — no need for exotic machines.
- Fault isolation — one shard failing affects only its data range.
- Can add shards online without downtime.

**Cons:**
- Operational complexity — more moving parts.
- Requires careful shard key selection.
- Cross-shard aggregations and transactions carry overhead.
- Scatter-gather queries (hitting all shards) can be slow.

That's the trade you're making: you give up simplicity, and get an escape hatch from the ceiling. Whether that trade is worth it depends entirely on whether you've actually hit the ceiling yet — which is exactly what Section 7 will help you figure out.

### Comparison Table

| Dimension              | Vertical Scaling         | Horizontal Sharding          |
|------------------------|--------------------------|-------------------------------|
| Max throughput         | Limited by one machine   | Near-unlimited, add shards    |
| Cost curve             | Superlinear              | Linear                        |
| Complexity             | Low                      | High                          |
| Write scaling          | No (replicas don't help) | Yes                           |
| Read scaling           | Partial (add replicas)   | Yes                           |
| Fault tolerance        | Replica set handles it   | Per-shard replica sets        |
| Application changes    | None                     | Shard key awareness needed    |
| Ideal dataset size     | < 5 TB                   | > 1 TB or write bottleneck    |

---

## 3. Sharded Cluster Architecture

Splitting data across machines sounds simple until you ask the obvious follow-up question: when the application runs a query, how does it know *which* machine has the answer? It shouldn't have to know — and in MongoDB, it doesn't. That's the whole job of the three pieces below.

### Full Architecture Diagram

```
                        ┌─────────────────────────────┐
                        │       Application Layer      │
                        │   (Node.js / Python / Java)  │
                        └──────────────┬──────────────┘
                                       │  Connection String
                                       │  mongodb://mongos1:27017,mongos2:27017
                                       ▼
              ┌────────────────────────────────────────────┐
              │              mongos Layer                   │
              │   ┌────────────┐      ┌────────────┐       │
              │   │  mongos 1  │      │  mongos 2  │       │
              │   │ :27017     │      │ :27018     │       │
              │   └─────┬──────┘      └─────┬──────┘       │
              └─────────┼─────────────────┼─────────────────┘
                        │   Route queries │
                        ▼                 ▼
       ┌────────────────────────────────────────────────┐
       │           Config Server Replica Set (CSRS)     │
       │                                                 │
       │  ┌─────────────┐  ┌─────────────┐  ┌────────┐ │
       │  │  Config 1   │  │  Config 2   │  │Config 3│ │
       │  │  PRIMARY    │  │  SECONDARY  │  │SECONDARY│ │
       │  │  :27019     │  │  :27020     │  │:27021  │ │
       │  └─────────────┘  └─────────────┘  └────────┘ │
       │  Stores: chunk ranges, shard membership,        │
       │          collection metadata, balancer lock     │
       └────────────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────────┐
          ▼             ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Shard 1    │  │   Shard 2    │  │   Shard 3    │
│  (PSS set)   │  │  (PSS set)   │  │  (PSS set)   │
│              │  │              │  │              │
│ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │PRIMARY   │ │  │ │PRIMARY   │ │  │ │PRIMARY   │ │
│ │:27100    │ │  │ │:27200    │ │  │ │:27300    │ │
│ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │
│ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │SECONDARY │ │  │ │SECONDARY │ │  │ │SECONDARY │ │
│ │:27101    │ │  │ │:27201    │ │  │ │:27301    │ │
│ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │
│ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │SECONDARY │ │  │ │SECONDARY │ │  │ │SECONDARY │ │
│ │:27102    │ │  │ │:27202    │ │  │ │:27302    │ │
│ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │
│              │  │              │  │              │
│ Chunks:      │  │ Chunks:      │  │ Chunks:      │
│ [min, "g")   │  │ ["g", "p")   │  │ ["p", max]   │
└──────────────┘  └──────────────┘  └──────────────┘
```

Three roles, mapped straight back to the library analogy from Section 1:

- **mongos** is the receptionist. It never holds a book itself — it just knows who to send you to.
- **Config Servers** are the master catalog the receptionist consults to find out who owns what.
- **Shards** are the individual librarians' desks, each holding its own slice of the books.

### Component Deep Dive

#### mongos (Query Router)

- A lightweight routing process — it holds NO data.
- Reads cluster metadata from Config Servers on startup and caches it.
- Routes queries to the correct shard(s) based on the shard key.
- Can have many mongos instances — add more for query throughput scaling.
- Applications connect to mongos, never directly to shards.
- If a mongos dies, the client reconnects to another mongos (hence the connection string lists multiple).

#### Config Servers (CSRS)

- A standard 3-member replica set running `mongod --configsvr`.
- Stores the cluster's metadata in the `config` database.
- Key collections in `config`:
  - `config.shards` — list of shards and their connection strings.
  - `config.databases` — which databases are sharded vs unsharded.
  - `config.collections` — sharded collections and their shard keys.
  - `config.chunks` — every chunk range and which shard owns it.
  - `config.changelog` — history of chunk moves and splits.
  - `config.locks` — distributed lock used by the balancer.
- The CSRS must be a replica set (since MongoDB 3.4); standalone config servers are deprecated.

#### Shards

- Each shard is a replica set (Primary-Secondary-Secondary = PSS pattern).
- Each shard stores a subset of the sharded collection's chunks.
- Unsharded collections live entirely on the primary shard of their database.
- Shards communicate with mongos and with Config Servers.

### Query Routing Flow

Here's the part that actually matters day to day: what happens, step by step, the moment your application fires a query at mongos?

```
1. App sends: db.orders.find({ customerId: "C123" })
   │
2. mongos looks up shard key = customerId
   │
3. mongos consults its chunk cache:
   │  chunk [C000, C500) → Shard1
   │  chunk [C500, C999] → Shard2
   │
4. "C123" falls in [C000, C500) → route to Shard1 only
   │  (targeted query — hits 1 shard)
   │
   vs.
   │
   db.orders.find({ status: "pending" })
   │  status is NOT the shard key
   │  → scatter-gather: send to ALL shards, merge results
```

Notice the fork at the bottom. The single biggest performance lever in a sharded cluster is whether your query includes the shard key. Include it, and mongos goes straight to one shard. Leave it out, and mongos has no choice but to ask every shard and merge the answers itself — which is exactly as slow as it sounds. Keep this fork in mind; it's the thread that runs through the rest of this course.

### Setting Up a Sharded Cluster (Quick Start)

```bash
# Start Config Servers
mongod --configsvr --replSet configRS --port 27019 --dbpath /data/configdb1
mongod --configsvr --replSet configRS --port 27020 --dbpath /data/configdb2
mongod --configsvr --replSet configRS --port 27021 --dbpath /data/configdb3

# Initiate Config RS
mongosh --port 27019
rs.initiate({
  _id: "configRS",
  configsvr: true,
  members: [
    { _id: 0, host: "localhost:27019" },
    { _id: 1, host: "localhost:27020" },
    { _id: 2, host: "localhost:27021" }
  ]
})

# Start Shard 1
mongod --shardsvr --replSet shard1RS --port 27100 --dbpath /data/shard1a
mongod --shardsvr --replSet shard1RS --port 27101 --dbpath /data/shard1b
mongod --shardsvr --replSet shard1RS --port 27102 --dbpath /data/shard1c

# Initiate Shard 1 RS
mongosh --port 27100
rs.initiate({ _id: "shard1RS", members: [
  { _id: 0, host: "localhost:27100" },
  { _id: 1, host: "localhost:27101" },
  { _id: 2, host: "localhost:27102" }
]})

# Start mongos
mongos --configdb configRS/localhost:27019,localhost:27020,localhost:27021 --port 27017

# Add shards via mongos
mongosh --port 27017
sh.addShard("shard1RS/localhost:27100,localhost:27101,localhost:27102")
sh.addShard("shard2RS/localhost:27200,localhost:27201,localhost:27202")
sh.addShard("shard3RS/localhost:27300,localhost:27301,localhost:27302")

# Enable sharding on a database
sh.enableSharding("ecommerce")

# Shard a collection (hashed shard key on customerId)
sh.shardCollection("ecommerce.orders", { customerId: "hashed" })
```

---

## 4. Chunks and Chunk Splitting

### What Is a Chunk?

Once data is spread across shards, MongoDB needs some way to track *exactly* which shard owns which slice of the key range — otherwise mongos in Section 3 would have nothing to look up. That tracking unit is called a **chunk**: a contiguous range of shard key values.

```
Shard Key Range: [minKey, maxKey]

Initial state (1 chunk):
┌──────────────────────────────────────────────┐
│ Shard1: [minKey ──────────────────── maxKey] │
└──────────────────────────────────────────────┘

After splits (many chunks across shards):
Shard1: [minKey, "F")  ["F", "L")
Shard2: ["L", "R")     ["R", "V")
Shard3: ["V", "Z")     ["Z", maxKey]
```

Think of a chunk as a labelled shelf in the library — "authors F through L live here." As the library grows, a shelf that holds too many books gets split into two smaller shelves. That's chunk splitting, and it's what we'll walk through next.

### Chunk Size

- Default: **128 MB**.
- Configurable between 1 MB and 1024 MB.
- Stored in `config.settings`:

```js
// Check current chunk size
use config
db.settings.find({ _id: "chunksize" })

// Change to 64 MB
db.settings.updateOne(
  { _id: "chunksize" },
  { $set: { value: 64 } },
  { upsert: true }
)
```

### Chunk Splitting

When a chunk grows beyond the configured chunk size, MongoDB automatically splits it into two smaller chunks. This is done by the `mongos` or the shard itself.

```
Before split:
┌─────────────────────────────────────────┐
│ Chunk: [A, Z] — 256 MB (too large)     │
└─────────────────────────────────────────┘

After split at midpoint "M":
┌─────────────────┐   ┌─────────────────┐
│ Chunk: [A, M)   │   │ Chunk: [M, Z]   │
│ 128 MB          │   │ 128 MB          │
└─────────────────┘   └─────────────────┘
```

**Manual chunk split:**

```js
// Split at a specific key value
sh.splitAt("ecommerce.orders", { customerId: "C500" })

// Split at the midpoint of the chunk containing this key
sh.splitFind("ecommerce.orders", { customerId: "C250" })
```

### Chunk Migration (moveChunk)

Splitting a chunk only makes it smaller — it doesn't move it anywhere. So what happens when one shard ends up owning way more chunks than the others? Something has to physically relocate chunks between shards. That's a **chunk migration**, and the balancer (Section 5) is the process that decides when it needs to happen.

```
Before (imbalanced):
Shard1: 100 chunks  ████████████████████████████████
Shard2: 10 chunks   ██████
Shard3: 5 chunks    ███

Balancer runs moveChunk:

After (balanced):
Shard1: 38 chunks   ████████████
Shard2: 38 chunks   ████████████
Shard3: 39 chunks   ████████████
```

**Under the hood — moveChunk steps:**

```
1. Balancer selects source shard (most chunks) and destination shard (fewest).
2. Source shard clones documents in the chunk range to destination shard.
3. Source shard captures and replays oplog changes (incremental sync).
4. mongos routing table updates to point chunk range at destination.
5. Source shard deletes the migrated documents (cleanup phase).
6. Config Servers updated with new chunk ownership.
```

**Manual chunk move:**

```js
db.adminCommand({
  moveChunk: "ecommerce.orders",
  find: { customerId: "C100" },
  to: "shard2RS"
})
```

### Jumbo Chunks

Here's a trap worth knowing about before it bites you in production: what happens if a chunk is too big to split, but MongoDB can't find anywhere to split it?

A **jumbo chunk** is exactly that — a chunk that cannot be split because all documents share the same shard key value. The chunk grows beyond the max size but splitting would create two identical ranges — impossible.

```
// Mark chunk as jumbo (MongoDB does this automatically)
// To clear a jumbo flag manually:
db.adminCommand({ clearJumboFlag: "ecommerce.orders", find: { customerId: "C100" } })
```

**Common mistake:** treating jumbo chunks as a one-off nuisance to clear and forget. In reality, a jumbo chunk is a symptom, not the disease — it's telling you your shard key has **low cardinality**. Clearing the flag without fixing the underlying key just lets the same chunk balloon again.

**Interview answer:** "A jumbo chunk forms when a chunk exceeds the configured chunk size but MongoDB cannot split it, because every document in the range shares the same shard key value. It's a direct symptom of low cardinality in the shard key — for example, sharding on a `status` field with only three possible values. Jumbo chunks can't be migrated by the balancer either, since migration requires splitting first, so they create permanent, unfixable imbalance until the shard key itself is redesigned."

> **Memory hook:** "A jumbo chunk is a shelf you can't split in two — because every book on it has the exact same label."

---

## 5. The Balancer

### What the Balancer Does

You now know chunks can be split and moved — but *who* decides when to move one, and to where? That's the balancer's whole job: a background process, running on the primary Config Server, whose only concern is keeping chunks evenly spread across shards.

```
Balancer Decision Loop:

┌─────────────────────────────────────┐
│  Read chunk counts per shard        │
│  from config.chunks                 │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  Is imbalance > migration threshold?│
│  (8 chunks difference by default)   │
└──────────────┬───────────────────────┘
               │ YES                    │ NO
               ▼                        ▼
┌──────────────────────────┐   ┌──────────────────┐
│  Select chunk to move    │   │  Sleep and retry │
│  (from busiest shard)    │   └──────────────────┘
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  Execute moveChunk        │
│  (clones, syncs, routes) │
└──────────────────────────┘
```

It's a simple loop, but it runs constantly — which is exactly why an unmanaged balancer can quietly hurt you during your busiest hours, a point we'll come back to below.

### Balancer Migration Thresholds

| Number of Chunks per Shard | Migration Threshold |
|----------------------------|---------------------|
| Fewer than 20              | 2                   |
| 20–79                      | 4                   |
| 80 or more                 | 8                   |

### Balancer Commands

```js
// Check balancer state
sh.getBalancerState()          // true or false
sh.isBalancerRunning()         // true if actively migrating

// Start and stop the balancer
sh.startBalancer()
sh.stopBalancer()

// Stop balancer with a timeout (wait up to 60s for current migration to finish)
sh.stopBalancer(60000)

// Schedule balancer window (run only during off-peak hours)
use config
db.settings.updateOne(
  { _id: "balancer" },
  {
    $set: {
      activeWindow: {
        start: "01:00",   // 1 AM
        stop:  "05:00"    // 5 AM
      }
    }
  },
  { upsert: true }
)

// Remove the balancer window (run all day)
db.settings.updateOne(
  { _id: "balancer" },
  { $unset: { activeWindow: "" } }
)

// Disable balancing for a specific collection only
sh.disableBalancing("ecommerce.orders")
sh.enableBalancing("ecommerce.orders")
```

### Monitoring Balancer Activity

```js
// View recent balancer activity
use config
db.changelog.find({ what: "moveChunk.from" }).sort({ time: -1 }).limit(10)

// Count migrations in the last hour
db.changelog.countDocuments({
  what: "moveChunk.from",
  time: { $gte: new Date(Date.now() - 3600000) }
})
```

### Balancer Performance Impact

- During chunk migration, the source shard must do extra work (reading and sending data).
- Heavy balancing during peak hours can cause latency spikes.
- Best practice: restrict the balancer window to off-peak hours for large datasets.
- Each shard can only participate in one migration at a time per default.

**Common mistake:** leaving the balancer window unrestricted on a large, heavily-written collection and being surprised by latency spikes at 2pm. Migrations aren't free — the source shard is busy cloning documents and replaying oplog while your application is still hitting it with live traffic. If your dataset is large, give the balancer an off-peak window (as shown above) rather than letting it run whenever it likes.

**Interview answer:** "The balancer is a background process on the primary Config Server that watches chunk counts per shard and moves chunks from the busiest shard to the least busy one whenever the imbalance crosses a threshold — 2, 4, or 8 chunks depending on how many chunks already exist. Because each migration clones data and replays the oplog before cutting over, it consumes real CPU, disk, and network on the source shard, so production clusters typically restrict the balancer to an off-peak window rather than letting it run continuously."

> **Memory hook:** "The balancer is the librarian who reshelves books at night — not while patrons are still browsing."

---

## 6. sh.status() Explained

`sh.status()` is your primary monitoring command for a sharded cluster — the one place that answers "is my cluster actually healthy right now?" Here is a fully annotated output:

```js
mongosh --port 27017
sh.status()
```

**Sample output with annotations:**

```
--- Sharding Status ---
  sharding version: {               // Config server version info
    "_id" : 1,
    "minCompatibleVersion" : 5,
    "currentVersion" : 6,
    "clusterId" : ObjectId("...")
  }
  shards:                           // All registered shards
    {  "_id" : "shard1RS",
       "host" : "shard1RS/localhost:27100,localhost:27101,localhost:27102",
       "state" : 1 }                // 1 = active
    {  "_id" : "shard2RS",
       "host" : "shard2RS/localhost:27200,localhost:27201,localhost:27202",
       "state" : 1 }
    {  "_id" : "shard3RS",
       "host" : "shard3RS/localhost:27300,localhost:27301,localhost:27302",
       "state" : 1 }

  active mongoses:                  // Connected mongos instances
    "7.0.4" : 2                     // version : count

  autosplit:
    Currently enabled: yes          // Auto chunk splitting is on

  balancer:
    Currently enabled: yes          // Balancer is allowed to run
    Currently running: no           // Not migrating right now
    Collections with active migrations:  (none)
    Failed balancer rounds in last 5 attempts: 0
    Migration results for the last 24 hours:
      15 : Success                  // 15 migrations succeeded

  databases:
    {  "_id" : "config",  "primary" : "config",  "partitioned" : true }
    {  "_id" : "ecommerce",
       "primary" : "shard1RS",      // Unsharded collections go here
       "partitioned" : true }       // Sharding is enabled on this DB

    ecommerce.orders
      shard key: { "customerId" : "hashed" }
      unique: false
      balancing: true
      chunks:                       // Chunk distribution
        shard1RS    4               // shard1 owns 4 chunks
        shard2RS    4               // shard2 owns 4 chunks
        shard3RS    4               // shard3 owns 4 chunks (balanced!)
      { "customerId" : { "$minKey" : 1 } } -->> { "customerId" : NumberLong("-6148914691236517204") } on : shard1RS
      { "customerId" : NumberLong("-6148914691236517204") } -->> { "customerId" : NumberLong("-3074457345618258602") } on : shard2RS
      ...
      // Each line = one chunk range and which shard owns it
```

### Key Things to Check in sh.status()

Reading this output isn't about parsing every field — it's about scanning for the five red flags below:

```
1. "balancer running: yes" + "Currently running: yes"
   → Active migration happening. Don't do maintenance now.

2. "Failed balancer rounds in last 5 attempts: 3"
   → Balancer is struggling. Check locks, disk space, network.

3. Chunks heavily skewed (shard1: 100, shard2: 5, shard3: 3)
   → Bad shard key OR balancer disabled/windowed. Investigate.

4. "jumbo" tag on a chunk line
   → That chunk cannot be split. Monotonic or low-cardinality shard key.

5. "primary: shard1RS" for all databases
   → All unsharded collections live on shard1. Consider redistributing.
```

Notice how #3 and #4 both trace straight back to Section 4's shard key story — a bad shard key doesn't just cause theoretical problems, it shows up right here, staring at you in the output of a routine health check.

---

## 7. When to Shard — Thresholds and Decision Matrix

By now the temptation might be to shard everything, just because the tooling exists. Don't. Sharding adds real operational weight — more replica sets to run, more failure modes, careful shard key planning — and most applications never actually need it. This section is about recognizing the difference between "I'm curious about sharding" and "I actually need it."

### Hard Signals — You Must Shard Now

```
┌──────────────────────────────────────────────────────────┐
│  MUST SHARD indicators:                                   │
│                                                           │
│  ✗ Dataset > 75% of largest available single machine     │
│  ✗ Write throughput > 80% of single-node capacity        │
│  ✗ Working set no longer fits in available RAM            │
│  ✗ P99 write latency > SLA threshold despite tuning      │
│  ✗ Single collection > 2 TB (operational difficulty)     │
└──────────────────────────────────────────────────────────┘
```

### Soft Signals — Consider Sharding

```
┌──────────────────────────────────────────────────────────┐
│  CONSIDER SHARDING indicators:                            │
│                                                           │
│  ~ Dataset growth rate > 50% per year                    │
│  ~ Frequently hitting CPU ceiling during peak hours      │
│  ~ Geographic distribution requirements                  │
│  ~ Regulatory data residency (zone sharding)             │
│  ~ Multi-tenant isolation requirements                   │
└──────────────────────────────────────────────────────────┘
```

### Do NOT Shard Yet — Alternatives

Before reaching for sharding, it's worth asking: is there a cheaper fix? Most of the time, there is.

| Problem                        | Try This First                          |
|--------------------------------|-----------------------------------------|
| Read scaling needed            | Add replica set secondaries             |
| One slow query                 | Add an index                            |
| Moderate write load            | Tune writeConcern, journaling           |
| RAM pressure                   | Upgrade RAM (cheaper than sharding)     |
| Hot spot on one collection     | Archive old data, TTL indexes           |

### Decision Flowchart

```
Start
  │
  ▼
Is dataset < 2 TB and growing < 30%/yr?
  │ YES → Use replica set, no sharding needed
  │ NO  ▼
Is write throughput the bottleneck?
  │ YES → Shard (replicas don't help with writes)
  │ NO  ▼
Is working set > available RAM?
  │ YES → Shard OR upgrade RAM (compare cost)
  │ NO  ▼
Are reads slow despite good indexes?
  │ YES → Add secondaries + read preference
  │ NO  ▼
Is data locality (geo) required?
  │ YES → Zone sharding
  │ NO  → You don't need sharding yet
```

### Sharding Readiness Checklist

Once you've genuinely decided to shard, this is the checklist to run through before you flip the switch — most of it is exactly the material covered in the next lesson on shard key selection:

```
Before sharding a collection, verify:
[ ] Shard key chosen with high cardinality
[ ] Shard key is part of the most common query filter
[ ] Shard key is NOT monotonically increasing (e.g., not ObjectId alone)
[ ] Compound shard key considered for query targeting
[ ] All application queries include shard key OR accept scatter-gather
[ ] Indexes on shard key exist on all shards
[ ] Config Servers are a 3-member replica set
[ ] Each shard is a 3-member replica set
[ ] At least 2 mongos instances for HA
[ ] Balancer window configured for off-peak
[ ] Backup strategy updated (each shard backed up separately)
```

---

## 8. Hands-On Exercises

### Exercise 1 — Deploy a 3-Shard Cluster Locally

Using Docker Compose or mongod processes, deploy:
- 1 CSRS (3 config server nodes)
- 3 shards, each a 3-member PSS replica set
- 2 mongos instances

Steps:
1. Create mongod config files for each node.
2. Start all 9 shard nodes and 3 config nodes.
3. Initiate replica sets for each shard and the CSRS.
4. Start both mongos processes pointing at the CSRS.
5. Connect to mongos and run `sh.status()` to verify all shards appear.

**Validation:**
```js
sh.status()
// Should show 3 shards, 2 active mongoses, balancer enabled
```

---

### Exercise 2 — Shard a Collection and Observe Chunk Distribution

```js
// Connect to mongos
use ecommerce
sh.enableSharding("ecommerce")

// Create and populate orders collection
for (let i = 0; i < 100000; i++) {
  db.orders.insertOne({
    customerId: "C" + Math.floor(Math.random() * 10000).toString().padStart(4, "0"),
    amount: Math.random() * 1000,
    status: ["pending","shipped","delivered"][i % 3],
    createdAt: new Date()
  })
}

// Shard the collection with a hashed key
sh.shardCollection("ecommerce.orders", { customerId: "hashed" })

// Wait a moment, then check distribution
sh.status()
// Observe: how many chunks per shard? Is it balanced?
```

---

### Exercise 3 — Manual Chunk Split and Move

```js
// Find what chunk a specific document lives in
db.getSiblingDB("config").chunks.findOne({
  ns: "ecommerce.orders",
  min: { $lte: { customerId: "C5000" } },
  max: { $gt: { customerId: "C5000" } }
})

// Manually split a chunk
sh.splitAt("ecommerce.orders", { customerId: "C5000" })

// Move a chunk to a specific shard
db.adminCommand({
  moveChunk: "ecommerce.orders",
  find: { customerId: "C5000" },
  to: "shard3RS"
})

// Verify the move
sh.status()
```

---

### Exercise 4 — Balancer Window Configuration

```js
// Connect to mongos
use config

// Set balancer to run only between 2 AM and 4 AM
db.settings.updateOne(
  { _id: "balancer" },
  { $set: { activeWindow: { start: "02:00", stop: "04:00" } } },
  { upsert: true }
)

// Verify
db.settings.findOne({ _id: "balancer" })

// Temporarily stop the balancer for maintenance
sh.stopBalancer(30000)  // wait up to 30s for current migration to finish

// Do your maintenance...

// Re-enable
sh.startBalancer()

// Check migration history
db.changelog.find({ what: "moveChunk.from" }).sort({ time: -1 }).limit(5).pretty()
```

---

### Exercise 5 — Identify and Resolve a Jumbo Chunk

```js
// Find jumbo chunks
use config
db.chunks.find({ jumbo: true, ns: "ecommerce.orders" }).pretty()

// Attempt to clear jumbo flag (requires the chunk to actually be splittable)
db.adminCommand({
  clearJumboFlag: "ecommerce.orders",
  find: { customerId: "C9999" }  // a key in the jumbo chunk
})

// If the shard key has low cardinality and the chunk cannot be split,
// you must redesign the shard key. Demonstrate by:
// 1. Dropping the collection
// 2. Re-sharding with a compound shard key: { customerId: 1, _id: 1 }
//    (adds enough cardinality to split)
sh.shardCollection("ecommerce.orders", { customerId: 1, _id: 1 })
```

---

## 9. Interview Q&A

**Q1: What is a sharded cluster in MongoDB and what are its three main components?**

A: A sharded cluster distributes data across multiple servers for horizontal scalability. The three components are: (1) **Shards** — replica sets that store the actual data partitions; (2) **Config Servers (CSRS)** — a replica set that stores cluster metadata, chunk ranges, and shard membership; (3) **mongos** — a lightweight query router that directs operations to the correct shard(s) based on the shard key.

---

**Q2: What is a chunk and what is the default chunk size?**

A: A chunk is a contiguous range of shard key values, representing a logical partition of a sharded collection's data. The default chunk size is **128 MB**. Chunks are the unit of data migration between shards during balancing.

---

**Q3: Explain how the balancer works. When does it trigger a migration?**

A: The balancer runs on the primary Config Server and periodically checks the chunk count per shard. If the difference between the most-loaded and least-loaded shard exceeds the migration threshold (2 for < 20 chunks, 4 for 20–79, 8 for 80+), it moves a chunk from the overloaded shard to the underloaded one. Migration clones data, replays oplogs, updates routing, then deletes from the source.

---

**Q4: What happens when a query does NOT include the shard key?**

A: The mongos cannot determine which shard holds the requested data, so it performs a **scatter-gather** operation — broadcasting the query to all shards, collecting results from each, and merging them. This is more expensive than a targeted query (which goes to exactly one shard) and should be minimized for performance-critical operations.

---

**Q5: What is a jumbo chunk and why is it a problem?**

A: A jumbo chunk is a chunk that has grown beyond the maximum chunk size but cannot be split because all documents within it share the same shard key value. It cannot be migrated by the balancer (migrations require splitting first), leading to permanent imbalance. It indicates low cardinality in the shard key — for example, using `status` (only a few possible values) as the shard key.

---

**Q6: Can you add a shard to a running cluster without downtime?**

A: Yes. MongoDB supports online shard addition. Run `sh.addShard("rsName/host:port")` against a mongos. The cluster will begin migrating chunks to the new shard to rebalance. The application experiences no downtime, though the balancer may cause minor latency during heavy migrations.

---

**Q7: What is the purpose of mongos? Does it store any data?**

A: mongos is a stateless query router. It stores NO data permanently — it caches cluster metadata from the Config Servers. Because it is stateless, you can run multiple mongos instances for load distribution and high availability. Applications connect to mongos using a standard MongoDB connection string listing multiple mongos endpoints.

---

**Q8: Why is a replica set required for each shard and for the Config Servers?**

A: Replica sets provide high availability and durability. For shards: if a shard's primary fails and it was standalone, all data on that shard becomes unavailable. For Config Servers: the metadata is critical — if lost, the cluster loses all routing information. MongoDB requires the CSRS to be a replica set (since 3.4) to protect this critical metadata.

---

**Q9: What is the difference between sh.splitAt() and sh.splitFind()?**

A: `sh.splitAt("ns", { key: value })` splits the chunk at the exact specified key value. `sh.splitFind("ns", { key: value })` finds the chunk that contains the specified key and splits it at its midpoint. Use `splitAt` when you know the exact boundary you want; use `splitFind` when you want an even split of a specific chunk.

---

**Q10: How does the Config Server affect cluster availability?**

A: The Config Server primary must be reachable for writes (DDL operations, chunk migrations, new connections from mongos). However, existing mongos instances cache the routing table and can continue serving read/write operations to shards even if the Config Server is temporarily unavailable. A Config Server outage primarily impacts cluster management operations, not ongoing data operations served by cached routing.

---

**Q11: What is the `config.changelog` collection used for?**

A: `config.changelog` records a history of chunk splits and migrations, including which chunk moved, from which shard, to which shard, at what time, and whether it succeeded or failed. It is invaluable for diagnosing balancer issues, understanding data distribution history, and auditing cluster changes.

---

**Q12: How does the balancer window configuration help in production?**

A: Chunk migrations consume network bandwidth, CPU, and disk I/O on both source and destination shards. Running the balancer during peak business hours can degrade application performance. Configuring a balancer window (e.g., 2 AM to 5 AM) restricts migration activity to off-peak hours, ensuring production traffic is not impacted.

---

**Q13: What happens to the Config Server's data if all three Config Server nodes fail simultaneously?**

A: This is a catastrophic scenario. Without Config Server data, the routing table is lost. Existing mongos instances that have the routing table cached may continue serving queries temporarily, but they cannot update routes. Recovery requires restoring the Config Server replica set from a backup. This underscores why Config Servers should always be backed up and why you should not run Config Servers on the same physical machines as your shards.

---

**Q14: What is a targeted query vs a scatter-gather query? Give an example of each.**

A: A **targeted query** includes the shard key in the filter, so mongos routes it to exactly one shard. Example: `db.orders.find({ customerId: "C123" })` where `customerId` is the shard key. A **scatter-gather query** lacks the shard key, so mongos sends it to all shards and merges results. Example: `db.orders.find({ status: "shipped" })` when `status` is not the shard key.

---

**Q15: What is the minimum recommended number of mongos instances for a production cluster?**

A: At least **two** mongos instances, deployed close to your application servers (ideally on the same machines or in the same data center rack). This provides high availability — if one mongos dies, the application connection string lists the second, and the driver reconnects automatically. Some large deployments run one mongos per application server to eliminate network hops.
