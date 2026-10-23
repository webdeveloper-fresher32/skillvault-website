# 03 — Connection Pooling with PgBouncer & High Availability Clusters

## Table of Contents
1. [The "Process-per-Connection" Tax](#1-the-process-per-connection-tax)
2. [What is PgBouncer?](#2-what-is-pgbouncer)
3. [The Three Pooling Modes: Session vs Transaction vs Statement](#3-the-three-pooling-modes-session-vs-transaction-vs-statement)
4. [Deploying PgBouncer in Production](#4-deploying-pgbouncer-in-production)
5. [Transaction Pooling Gotchas & Workarounds](#5-transaction-pooling-gotchas--workarounds)
6. [High Availability Architecture: Patroni, Etcd & HAProxy](#6-high-availability-architecture-patroni-etcd--haproxy)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The "Process-per-Connection" Tax

In PostgreSQL, every incoming client connection spawns an entire independent operating system process consuming roughly 10MB of baseline RAM.

When a Kubernetes microservice cluster scales to 100 pods, each running a thread pool of 20 connections, the database suddenly faces **2,000 concurrent direct connections**:
- Context-switching overhead cripples CPU cache lines.
- Linux memory is exhausted by thousands of private `work_mem` allocations.
- Severe connection starvation degrades query throughput.

```
Without PgBouncer:  2,000 App Threads ──► 2,000 Heavy OS Postgres Processes (Server Crashes!)
With PgBouncer:     2,000 App Threads ──► PgBouncer (RAM: 20MB) ──► 50 Pooled Postgres Backends
```

---

## 2. What is PgBouncer?

**PgBouncer** is an ultra-lightweight, single-threaded connection pooler for PostgreSQL built on `libevent`. It sits between your application servers and PostgreSQL, maintaining a small pool of warm backend database connections and multiplexing thousands of incoming client sockets across them.

---

## 3. The Three Pooling Modes: Session vs Transaction vs Statement

```
┌─────────────────┬──────────────────────────────────────────┬─────────────────────────────────────┐
│ Mode            │ Server Connection Leased                 │ Client Compatibility                │
├─────────────────┼──────────────────────────────────────────┼─────────────────────────────────────┤
│ **Session**     │ For the entire lifetime of client socket │ 100% full SQL feature compatibility │
├─────────────────┼──────────────────────────────────────────┼─────────────────────────────────────┤
│ **Transaction** │ Strictly for duration of `BEGIN..COMMIT` │ **Recommended default.** 10,000     │
│ (Standard)      │ Returned to pool immediately on commit!  │ clients multiplexed to 50 backends. │
├─────────────────┼──────────────────────────────────────────┼─────────────────────────────────────┤
│ **Statement**   │ Strictly for a single SQL query          │ No multi-statement transactions!    │
└─────────────────┴──────────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 4. Deploying PgBouncer in Production

Sample `pgbouncer.ini` configuration:

```ini
[databases]
skillvault = host=127.0.0.1 port=5432 dbname=skillvault

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# Pooling configuration
pool_mode = transaction
max_client_conn = 5000         # Maximum simultaneous client application connections
default_pool_size = 50         # Number of real PostgreSQL backend processes kept open
min_pool_size = 10
reserve_pool_size = 10
reserve_pool_timeout = 5.0
max_prepared_statements = 100  # PgBouncer 1.21+ handles prepared statements natively!
```

---

## 5. Transaction Pooling Gotchas & Workarounds

In **Transaction Pooling Mode**, each transaction might execute on a completely different backend worker process. Therefore:

1. **Session Variables (`SET search_path`):** Reset after every transaction.
   - *Fix:* Configure user-level search paths (`ALTER ROLE app_user SET search_path = ...`).
2. **Session Advisory Locks (`pg_advisory_lock`):** Could be acquired on Connection A and never unlocked because the next query executes on Connection B!
   - *Fix:* Always use transaction-scoped advisory locks: `pg_advisory_xact_lock()`.
3. **Prepared Statements:** Historically failed in transaction pooling.
   - *Fix:* Upgrade to PgBouncer 1.21+ which includes native protocol-level prepared statement translation!

---

## 6. High Availability Architecture: Patroni, Etcd & HAProxy

For automated, zero-data-loss failover without human intervention, enterprise companies use the **Patroni HA Stack**:

```
                     ┌──────────────────────────┐
                     │ Client Application / App │
                     └─────────────┬────────────┘
                                   │
                                   ▼
                     ┌──────────────────────────┐
                     │    HAProxy / Keepalived  │  ◄── Routes Writes to 5000, Reads to 5001
                     └──────┬────────────┬──────┘
                            │            │
             Port 5000 (RW) │            │ Port 5001 (RO)
                            ▼            ▼
             ┌──────────────────┐    ┌──────────────────┐
             │  Primary Node    │    │  Standby Node    │
             │  (Patroni Agent) │    │  (Patroni Agent) │
             └────────┬─────────┘    └────────┬─────────┘
                      │                       │
                      │  Heartbeat / Leader   │
                      │       Lease           │
                      ▼                       ▼
             ┌──────────────────────────────────────────┐
             │       Etcd Distributed Consensus         │  ◄── Raft leader lease coordination
             └──────────────────────────────────────────┘
```

### How Patroni Works:
1. **DCS Leader Lease:** The Patroni daemon on the primary periodically renews an ephemeral leader lease key in the **Etcd** cluster.
2. **Heartbeat Failure:** If the primary hardware dies, the lease in Etcd expires in 10 seconds.
3. **Automated Election:** The surviving standbys inspect each other's LSN positions in Etcd; the standby with the most advanced LSN is automatically elected new Primary.
4. **Zero Split-Brain:** Patroni executes node fencing (STONITH / watchdog) to guarantee the old primary can never write again.

---

## 7. Hands-On Exercises

1. Connect to PgBouncer's internal administration console:
   ```bash
   psql -p 6432 -U pgbouncer pgbouncer
   ```
2. Inspect active connection pools:
   ```sql
   SHOW POOLS;
   SHOW CLIENTS;
   SHOW STATS;
   ```
3. Observe how 500 simulated client connections share 25 server connections seamlessly.

---

## 8. Summary & Key Takeaways

1. PostgreSQL's process-per-connection model requires pooling to handle thousands of clients.
2. **PgBouncer** is the gold standard connection multiplexer.
3. **Transaction Pooling** delivers maximum connection consolidation.
4. Always use `pg_advisory_xact_lock()` inside transaction-pooled environments.
5. **Patroni + Etcd** provides production-grade, split-brain-proof automated failover.
