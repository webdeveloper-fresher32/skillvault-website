# Project 06 — Production Redis Capstone

## Goal

Combine persistence configuration, a read-scaling replica, basic monitoring, and an ACL-restricted application user into one coherent, production-style Redis setup — the capstone project tying together the operational half of the course.

## What You'll Build

A two-instance Redis setup (one master, one replica) with persistence enabled on the master, a monitoring check script that reports memory usage, hit ratio, and slow commands, and a dedicated ACL-restricted user that an application would use instead of the default full-access account.

## Phases Required

- Phase 5 — Persistence
- Phase 6 — Replication and High Availability
- Phase 11 — Redis with Application Code
- Phase 12 — Production Patterns and Security

## Requirements

- The master Redis instance must have persistence configured (RDB, AOF, or hybrid) rather than running with defaults untouched — state and justify which one you chose and why.
- A second Redis instance must be configured as a replica of the master (`REPLICAOF`), and you must confirm via `INFO replication` on both instances that the master shows connected replica(s) and the replica shows the correct master link status.
- Write a small Python (or `redis-cli`-based) monitoring check that reports: current memory usage against `maxmemory` (if configured), a computed cache hit ratio from `keyspace_hits`/`keyspace_misses`, and the most recent entries from `SLOWLOG GET`.
- Create a restricted ACL user (via `ACL SETUSER`) intended for application use, limited to only the commands and key patterns an application actually needs (e.g. `GET`/`SET`/`MGET` on a specific key prefix) — not full access.
- Demonstrate that a client authenticating as the restricted user can perform its allowed operations but is rejected when attempting something outside its granted permissions (a disallowed command or an out-of-pattern key).
- Write to the master and confirm (allowing for brief replication lag) that the same data becomes readable from the replica.

## Suggested Approach

1. Start with a single master instance and enable persistence first, in isolation — pick RDB, AOF, or hybrid based on how much write-loss you're willing to tolerate on a crash, and confirm it's actually active (e.g. `BGSAVE` completing, or `appendonly.aof` growing as you write data).
2. Bring up a second Redis instance and point it at the master with `REPLICAOF <host> <port>`; check `INFO replication` on both sides to confirm `role:master`/`role:slave` and that the master's `connected_slaves` count reflects the new replica.
3. Write some data to the master, then read it back from the replica to confirm replication is actually flowing — and separately, try writing directly to the replica to confirm it correctly rejects writes as read-only.
4. Build the monitoring check as a standalone script: pull `INFO memory` and `INFO stats` for memory and hit-ratio numbers, and `SLOWLOG GET 10` for recent slow commands, printing a short human-readable summary.
5. Design the restricted ACL user around a concrete, minimal use case (e.g. "this app only ever needs to read and write keys under `app:`"), then create it with `ACL SETUSER` granting only those commands and that key pattern, denying everything else.
6. Connect as the restricted user and run both an allowed operation (should succeed) and a disallowed one — a command outside its permission list, or an operation on a key outside its pattern (should be rejected) — to prove the restriction is real, not just configured and untested.
7. Write a short closing summary (a few sentences) of what you'd still need for a fully production-ready setup that this capstone doesn't cover (e.g. Sentinel-based automatic failover from Phase 6, or Cluster-based sharding from Phase 7), to connect this project back to the rest of the course.

## Stretch Goals

- Add Redis Sentinel monitoring the master/replica pair and demonstrate an automatic failover by stopping the master and confirming Sentinel promotes the replica.
- Enable TLS between the client and the Redis instances and confirm the restricted ACL user's connection still works over an encrypted connection.
- Extend the monitoring script to alert (even just a printed warning) when the hit ratio drops below a threshold or the slow log has grown past a certain count.

## Evaluation Checklist

- [ ] The master instance has a working, verified persistence mechanism (a snapshot or AOF file is demonstrably created/updated as data changes).
- [ ] The replica correctly mirrors data written to the master, confirmed by reading the same key from both.
- [ ] The replica rejects direct write attempts, confirming its read-only replica status.
- [ ] The monitoring script successfully reports memory usage, a computed hit ratio, and slow log entries using real `INFO`/`SLOWLOG` output.
- [ ] The restricted ACL user can perform its allowed operations and is demonstrably rejected for at least one disallowed command or out-of-pattern key.
- [ ] A short written summary identifies at least one production concern (e.g. automatic failover, clustering) intentionally left out of scope for this capstone.
