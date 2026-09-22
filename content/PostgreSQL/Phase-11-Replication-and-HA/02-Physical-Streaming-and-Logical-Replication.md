# 02 — Physical Streaming & Logical Replication

## Table of Contents
1. [Physical vs Logical Replication Overview](#1-physical-vs-logical-replication-overview)
2. [Physical Streaming Replication Mechanics](#2-physical-streaming-replication-mechanics)
3. [Synchronous vs Asynchronous Commit Modes](#3-synchronous-vs-asynchronous-commit-modes)
4. [Physical Replication Slots (Preventing WAL Lag Crushes)](#4-physical-replication-slots-preventing-wal-lag-crushes)
5. [Logical Replication: Publications and Subscriptions](#5-logical-replication-publications-and-subscriptions)
6. [Zero-Downtime Major Version Upgrades with Logical Replication](#6-zero-downtime-major-version-upgrades-with-logical-replication)
7. [Architectural Comparison Matrix](#7-architectural-comparison-matrix)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Summary & Key Takeaways](#9-summary--key-takeaways)

---

## 1. Physical vs Logical Replication Overview

PostgreSQL provides two distinct replication paradigms:
1. **Physical Streaming Replication:** A byte-for-byte binary replica of the entire cluster. Everything (tables, indexes, schemas, roles, transaction logs) is identical. The replica is in read-only standby mode.
2. **Logical Replication:** Replicates discrete data modification events (inserts, updates, deletes) on specific tables using a **Publish-Subscribe** model. The subscriber can be a different major PostgreSQL version, have different indexes, and accept its own local writes.

---

## 2. Physical Streaming Replication Mechanics

```
┌────────────────────────────────────────┐                ┌────────────────────────────────────────┐
│             PRIMARY NODE               │                │             STANDBY NODE               │
│                                        │                │                                        │
│  Backend Writes ──► WAL Buffers        │                │                                        │
│                          │             │                │                                        │
│                          ▼             │  WAL Stream    │                                        │
│                 [ WAL Sender Process ] ├───────────────►│ [ WAL Receiver Process ]               │
│                                        │  (TCP Port     │               │                        │
│                                        │     5432)      │               ▼                        │
│                                        │                │      Replays WAL into Disk Pages       │
│                                        │                │      (Read-Only Standby Queries)       │
└────────────────────────────────────────┘                └────────────────────────────────────────┘
```

The standby instance maintains a `standby.signal` file in its data directory, signaling the server to boot in continuous recovery mode.

---

## 3. Synchronous vs Asynchronous Commit Modes

### 1. Asynchronous Replication (`synchronous_commit = off / local`)
- Primary commits the transaction locally and immediately returns `OK` to the client application without waiting for the replica.
- **Pros:** Ultra-high write throughput.
- **Cons:** If the primary hardware dies before shipping WAL, **unreplicated transactions are lost (RPO > 0)**.

### 2. Synchronous Replication (`synchronous_commit = on / remote_apply`)
- The primary halts and waits until the replica confirms that the WAL record was written to disk (`on`) or applied to memory (`remote_apply`).
- **Pros:** **Zero Data Loss (RPO = 0)**.
- **Cons:** Write transactions incur round-trip network latency. If the replica goes down, all primary writes freeze!

```ini
# In postgresql.conf on Primary:
synchronous_commit = on
synchronous_standby_names = 'FIRST 1 (standby_node_1, standby_node_2)'
```

---

## 4. Physical Replication Slots (Preventing WAL Lag Crushes)

### The Catastrophic Failure Mode:
By default, the primary deletes old WAL files once local checkpoints pass. If a standby node experiences a network outage for 2 hours, the primary might delete the WAL segments that the standby still needs! When the network recovers, the standby is irreparably broken and must be rebuilt from scratch.

### The Solution: Replication Slots
A **Replication Slot** instructs the primary **never to delete any WAL segment** until the standby has explicitly acknowledged receiving it:

```sql
-- On Primary: Create permanent physical replication slot
SELECT pg_create_physical_replication_slot('standby_slot_node1');

-- In postgresql.conf on Standby:
primary_slot_name = 'standby_slot_node1'
```

> [!WARNING]
> If a standby server dies permanently and its replication slot is left on the primary, the primary will retain WAL files until the physical hard drive fills up completely! Always monitor `pg_replication_slots`.

---

## 5. Logical Replication: Publications and Subscriptions

Replicate individual tables selectively across databases:

### Step 1: On the Publisher (Source Database)
```sql
-- Set wal_level = logical in postgresql.conf first!
CREATE PUBLICATION pub_ecom_orders FOR TABLE orders, order_items;
```

### Step 2: On the Subscriber (Destination Database)
```sql
-- Create corresponding schema structure first, then subscribe:
CREATE SUBSCRIPTION sub_ecom_orders
CONNECTION 'host=publisher.internal dbname=prod user=replicator password=secret'
PUBLICATION pub_ecom_orders;
```

PostgreSQL automatically copies the initial table snapshot, then continuously streams change data capture (CDC) events!

---

## 6. Zero-Downtime Major Version Upgrades with Logical Replication

Because binary disk formats change between major releases (e.g. Postgres 13 to Postgres 16), physical replication cannot replicate between different versions.

**Logical replication supports cross-version streaming!**
1. Spin up a new PostgreSQL 16 cluster.
2. Publish tables from PostgreSQL 13 and subscribe on PostgreSQL 16.
3. Allow the replica to catch up until replication lag is 0ms.
4. Point DNS/load balancer to PostgreSQL 16 with **under 2 seconds of cutover downtime**.

---

## 7. Architectural Comparison Matrix

| Capability | Physical Streaming Replication | Logical Replication |
|---|---|---|
| **Replication Scope** | Whole Cluster (all DBs, users, catalogs) | Individual tables or schemas |
| **Write Capability on Replica** | Strictly Read-Only | Read-Write (can accept other local tables) |
| **Cross Major Versions?** | NO (Must be exact same version) | **YES (e.g. PG 13 -> PG 16)** |
| **Cross Operating Systems?** | NO (Endian/arch must match) | **YES (e.g. Linux x86 to ARM64)** |
| **DDL Schema Changes** | Replicated automatically | Must be applied manually to subscriber |
| **Sequence Sync** | Replicated in WAL | Sequences not synchronized automatically |

---

## 8. Hands-On Exercises

1. Inspect replication status on a running primary node:
   ```sql
   SELECT client_addr, state, sync_state, sync_priority, 
          pg_wal_lsn_diff(sent_lsn, write_lsn) AS write_lag_bytes,
          pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag_bytes
   FROM pg_stat_replication;
   ```
2. Create a test publication for a table and inspect its catalog metadata in `pg_publication`.

---

## 9. Summary & Key Takeaways

1. Physical replication provides an exact binary replica for high availability and read offloading.
2. Always protect standbys with **Replication Slots** to prevent primary checkpoint WAL deletion.
3. Use `synchronous_commit = on` when zero data loss is legally mandated.
4. **Logical Replication** allows selective table streaming, event sourcing, and zero-downtime major version upgrades.
5. Monitor `pg_stat_replication` to catch replica lag before failovers occur.
