# Phase 10: Sharding — Horizontal Scaling in MongoDB

## Overview

Sharding is MongoDB's answer to the question: "What do you do when a single server can no longer hold your data or handle your query load?" Rather than upgrading to a bigger machine (vertical scaling, which has limits), sharding distributes data across multiple servers (horizontal scaling, which is theoretically unlimited). This phase takes you from the fundamentals of how data is partitioned to the operational realities of running a sharded cluster.

---

## Table of Contents

1. [Objectives](#objectives)
2. [Topics Covered](#topics-covered)
3. [File Index](#file-index)
4. [Estimated Timeline](#estimated-timeline)
5. [Prerequisites](#prerequisites)
6. [Sharding Architecture Diagram](#sharding-architecture-diagram)
7. [Key Concepts at a Glance](#key-concepts-at-a-glance)
8. [How the Files Connect](#how-the-files-connect)
9. [Quick Reference Commands](#quick-reference-commands)

---

## Objectives

By the end of Phase 10, you will be able to:

- **Explain the three sharding roles**: mongos (query router), config servers, and shards
- **Choose an appropriate shard key** based on cardinality, write distribution, and query patterns
- **Understand chunk-based data distribution** and how the balancer moves chunks between shards
- **Distinguish** between ranged sharding and hashed sharding (and when to use each)
- **Recognize targeted queries vs scatter-gather queries** and why this matters for performance
- **Configure zone sharding** to pin certain data to specific geographic shards
- **Monitor shard balance** using sh.status() and diagnose imbalances
- **Understand the limitations of sharding**: transactions, $lookup across shards, shard key immutability
- **Add a shard** to a running cluster and manage the rebalancing process
- **Troubleshoot common sharding problems**: hotspots, jumbo chunks, stale routing

---

## Topics Covered

### Module 1 — Sharding Fundamentals ([01-Sharding-Fundamentals.md](./01-Sharding-Fundamentals.md))

```
┌───────────────────────────────────────────────────────────┐
│              SHARDING FUNDAMENTALS TOPICS                  │
├───────────────────────────────────────────────────────────┤
│  Architecture         │  mongos, config servers, shards   │
│  Shard Key Selection  │  Cardinality, write dist, queries  │
│  Ranged Sharding      │  Contiguous ranges, hotspots       │
│  Hashed Sharding      │  Even distribution, no range scans │
│  Chunks               │  Default 128MB, splits, merges     │
│  The Balancer         │  Background chunk migrations        │
│  Targeted Queries     │  Include shard key → 1 shard       │
│  Scatter-Gather       │  No shard key → all shards         │
│  Shard Key Immutability│  Cannot update shard key value    │
│  Zone Sharding        │  Pin data to geographic shards     │
└───────────────────────────────────────────────────────────┘
```

### Module 2 — Operations & Monitoring ([02-Sharding-Operations.md](./02-Sharding-Operations.md))

```
┌───────────────────────────────────────────────────────────┐
│             SHARDING OPERATIONS TOPICS                     │
├───────────────────────────────────────────────────────────┤
│  sh.status()          │  Full cluster overview             │
│  Adding a Shard       │  sh.addShard() + balancing         │
│  Chunk Management     │  Manual splits, moveChunk          │
│  Jumbo Chunks         │  Causes, detection, resolution     │
│  Balancer Management  │  Enable/disable, windows, status   │
│  Resharding           │  Changing shard key (MongoDB 5.0+) │
│  Transactions         │  Multi-shard distributed txns      │
│  $lookup Across Shards│  Limitations and workarounds       │
│  Config Server        │  Metadata, CSRS, failure handling  │
│  Monitoring           │  mongostat, mongotop, Atlas metrics│
└───────────────────────────────────────────────────────────┘
```

---

## File Index

| File | Description | Approx Lines |
|------|-------------|--------------|
| [01-Sharding-Fundamentals.md](./01-Sharding-Fundamentals.md) | Architecture, shard keys, chunk distribution, zone sharding | 550+ |
| [02-Sharding-Operations.md](./02-Sharding-Operations.md) | Cluster management, monitoring, advanced operations | 550+ |

---

## Estimated Timeline

```
┌────────────────────────────────────────────────────────────┐
│                   PHASE 10 SCHEDULE                        │
│                      1.5 WEEKS                             │
├──────────────┬─────────────────────────────────────────────┤
│  Days 1-3    │  01-Sharding-Fundamentals.md               │
│              │  - Understand architecture diagrams         │
│              │  - Practice shard key analysis              │
│              │  - Set up local sharded cluster with Docker │
├──────────────┼─────────────────────────────────────────────┤
│  Days 4-6    │  02-Sharding-Operations.md                  │
│              │  - Run sh.status() and read output          │
│              │  - Observe the balancer in action           │
│              │  - Identify jumbo chunks and fix them       │
├──────────────┼─────────────────────────────────────────────┤
│  Days 7-10   │  Consolidation + Interview Prep             │
│              │  - Review Q&A sections in both files        │
│              │  - Compare sharding to replication          │
│              │  - Write shard key analysis for a          │
│              │    real-world data model of your choice     │
└──────────────┴─────────────────────────────────────────────┘
```

---

## Prerequisites

Before starting Phase 10, you should be comfortable with:

- **Phase 8** — Performance: indexes, explain plans, query optimization
- **Phase 9** — Replication: replica sets, failover, oplog — each shard in a sharded cluster IS a replica set
- Understanding of MongoDB's write concern and read preference
- Basic network concepts: ports, IP addresses, connection strings

---

## Sharding Architecture Diagram

```
                     SHARDED CLUSTER ARCHITECTURE
                     =============================

  Application Layer
  ─────────────────
  [ App Server ]  [ App Server ]  [ App Server ]
         │               │               │
         └───────────────┼───────────────┘
                         │
                         ▼
  Routing Layer (mongos — stateless query routers)
  ─────────────────────────────────────────────────
                [ mongos ] [ mongos ]
                     │         │
                     └────┬────┘
                          │  reads cluster metadata
                          ▼
  Config Server Layer (CSRS — Config Server Replica Set)
  ────────────────────────────────────────────────────────
            [ Config Primary ]
            [ Config Secondary ]
            [ Config Secondary ]
            
            Stores: chunk ranges, shard locations,
                    collection routing metadata
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
  Shard Layer
  ────────────────────────────────────────────────────────
  [ Shard 0 Replica Set ]     [ Shard 1 Replica Set ]
  ┌──────────────────┐        ┌──────────────────┐
  │  PRIMARY         │        │  PRIMARY         │
  │  SECONDARY       │        │  SECONDARY       │
  │  SECONDARY       │        │  SECONDARY       │
  └──────────────────┘        └──────────────────┘
  Chunks: userId [0, 500)      Chunks: userId [500, MAX)
```

---

## Key Concepts at a Glance

### How Data Is Distributed: Chunks

```
┌─────────────────────────────────────────────────────────┐
│                    CHUNK DISTRIBUTION                    │
│                                                         │
│  Collection: orders (sharded on userId, ranged)         │
│                                                         │
│  Shard 0 owns:                                          │
│    Chunk 1: userId [MinKey, 1000)                       │
│    Chunk 2: userId [1000, 2000)                         │
│    Chunk 3: userId [2000, 3000)                         │
│                                                         │
│  Shard 1 owns:                                          │
│    Chunk 4: userId [3000, 4000)                         │
│    Chunk 5: userId [4000, 5000)                         │
│    Chunk 6: userId [5000, MaxKey)                       │
│                                                         │
│  When a chunk exceeds 128MB → automatic split           │
│  When shards are imbalanced → balancer migrates chunks  │
└─────────────────────────────────────────────────────────┘
```

### Ranged vs Hashed Sharding

| Property | Ranged | Hashed |
|----------|--------|--------|
| Distribution | Based on value ranges | Based on MD5 hash |
| Write pattern | Can create hotspots | Even distribution |
| Range queries | Efficient (targeted) | Inefficient (scatter) |
| Best for | Time-series with range queries | High-write with key lookup |
| Example key | createdAt, zipCode | _id, userId |

### The Shard Key Golden Rules

```
A GOOD shard key has:
  ✓ High cardinality (many distinct values)
  ✓ Even write distribution (no hotspots)
  ✓ Appears in most of your queries (enables targeting)

A BAD shard key has:
  ✗ Low cardinality (e.g., boolean field → only 2 chunks ever)
  ✗ Monotonically increasing values (e.g., ObjectId → all writes
    go to the last chunk = hotspot)
  ✗ Never appears in queries → all queries become scatter-gather
```

---

## How the Files Connect

```
  Phase 10 Learning Path
  ──────────────────────

  01-Sharding-Fundamentals.md
  ├── WHY shard: capacity, write throughput, geographic needs
  ├── WHAT the architecture looks like: mongos, config, shards
  ├── HOW data is distributed: chunks, ranges, hashes
  └── HOW to choose a shard key (the most critical decision)
           │
           ▼ builds on
  02-Sharding-Operations.md
  ├── HOW to manage a running cluster: adding shards, balancer
  ├── HOW to monitor health: sh.status(), chunk counts
  ├── HOW to diagnose problems: jumbo chunks, hotspots
  └── HOW to handle advanced scenarios: resharding (5.0+),
      multi-shard transactions, $lookup limitations
```

---

## Quick Reference Commands

```js
// Show full sharded cluster status
sh.status()

// Enable sharding on a database
sh.enableSharding("myDatabase")

// Shard a collection (ranged on userId)
sh.shardCollection("myDatabase.orders", { userId: 1 })

// Shard a collection (hashed on _id)
sh.shardCollection("myDatabase.events", { _id: "hashed" })

// Add a new shard
sh.addShard("shard2RS/mongo-shard2a:27017,mongo-shard2b:27017")

// Check balancer status
sh.getBalancerState()
sh.isBalancerRunning()

// Enable/disable balancer
sh.startBalancer()
sh.stopBalancer()

// See which shard a document lives on
db.orders.find({ userId: 12345 }).explain("executionStats")

// Move a chunk manually (advanced)
db.adminCommand({
  moveChunk: "myDatabase.orders",
  find: { userId: 12345 },
  to: "shard1"
})
```

---

*Phase 10 of the MongoDB & SQL Mastery Series — Sharding & Horizontal Scaling*
