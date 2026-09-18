# Phase 9 — Replication

## Overview

Replication is the process of synchronising data across multiple MongoDB servers so that your data remains available even when individual nodes fail. This phase covers everything you need to understand, configure, and operate MongoDB Replica Sets in production.

---

## Why Replication Matters

A single MongoDB instance is a single point of failure. If that machine crashes, your application loses access to the database entirely. Replication solves this by maintaining multiple copies of your data on separate servers.

```
Without Replication         With Replication
┌──────────────┐            ┌──────────────┐
│  App Server  │            │  App Server  │
└──────┬───────┘            └──────┬───────┘
       │                           │
┌──────▼───────┐     ┌─────────────▼───────────────┐
│  MongoDB     │     │       Replica Set            │
│  (single)    │     │  ┌─────────┐  ┌──────────┐  │
│              │     │  │ Primary │  │Secondary │  │
│  CRASH = 💥  │     │  └────┬────┘  └────┬─────┘  │
└──────────────┘     │       │  oplog      │        │
                     │  ┌────▼────────────▼─────┐  │
                     │  │       Secondary        │  │
                     │  └───────────────────────┘  │
                     └─────────────────────────────┘
```

---

## Files in This Phase

| File | Topic | Lines |
|------|-------|-------|
| `01-Replica-Sets.md` | Replica set architecture, oplog, setup, read preferences, hidden and delayed members | 500+ |
| `02-Failover.md` | Automatic failover, Raft elections, rollback, monitoring | 400+ |

---

## Key Concepts at a Glance

- **Replica Set** — A group of MongoDB instances (typically 3 or more) that maintain the same data set.
- **Primary** — The node that accepts all write operations.
- **Secondary** — Nodes that replicate the Primary's oplog and serve reads (when configured).
- **Arbiter** — A lightweight member that votes in elections but holds no data.
- **Oplog** — The Operations Log, a special capped collection that records every write to the Primary.
- **Failover** — The automatic process by which a new Primary is elected when the old one goes down.
- **Election** — A Raft-based consensus vote among replica set members to choose a new Primary.

---

## Learning Path

```
01-Replica-Sets.md
      │
      ├── Understand the architecture
      ├── Learn the oplog
      ├── Practise rs.initiate()
      ├── Configure read preferences
      └── Explore hidden/delayed members
              │
              ▼
02-Failover.md
      │
      ├── Understand election triggers
      ├── Study the Raft algorithm
      ├── Handle rollbacks
      └── Monitor with rs.status()
```

---

## Prerequisites

- Phase 1–8 complete (CRUD, Indexes, Aggregation, Transactions)
- Docker or multiple VMs/machines available for replica set setup
- Basic understanding of distributed systems concepts

---

## Quick Reference Commands

```bash
# Initiate a replica set
rs.initiate()

# Check replica set status
rs.status()

# Add a member
rs.add("hostname:27017")

# Check replication info
rs.printReplicationInfo()

# Step down current primary
rs.stepDown()
```

---

## Next Phase

After completing this phase, proceed to **Phase 10 — Sharding**, where you will learn how MongoDB distributes data horizontally across multiple shards to handle datasets that exceed the capacity of a single replica set.
