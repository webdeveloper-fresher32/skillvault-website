# 01 — Master-Replica Replication

> A comprehensive reference covering why a single Redis instance is a liability, how asynchronous master-replica replication works internally, `REPLICAOF`, `INFO replication`, and the tradeoffs of scaling reads with replicas.

---

## Table of Contents

1. [The Problem: One Instance, One Point of Failure](#1-the-problem-one-instance-one-point-of-failure)
2. [The Analogy: A Manager and Their Assistants](#2-the-analogy-a-manager-and-their-assistants)
3. [Internal Flow: How Asynchronous Replication Works](#3-internal-flow-how-asynchronous-replication-works)
4. [Code Example: Setting Up a Replica and Inspecting Replication State](#4-code-example-setting-up-a-replica-and-inspecting-replication-state)
5. [Reads on Replicas, Writes on the Master](#5-reads-on-replicas-writes-on-the-master)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: One Instance, One Point of Failure

Every lesson so far has quietly assumed one Redis process, running on one machine, handling every read and every write. That works fine right up until it doesn't:

- **The machine dies.** Hardware fails, a cloud instance gets terminated, the process crashes. With one instance, that's not "degraded service" — it's a total outage. Every client trying to reach Redis gets a connection error.
- **Read traffic outgrows one process.** Even though a single Redis instance can handle a huge number of operations per second (Phase 1's single-threaded event loop is fast), there's still a ceiling. A product catalog read a million times a minute has nowhere else to go if it's all landing on one instance.
- **You want a safety copy of the data**, ideally one that's already warm and ready to take over, rather than restoring from a snapshot on disk (Phase 5) after the fact.

The core problem: **how do you avoid a single Redis process being both your only copy of the data and your only point of failure — without giving up the simplicity of "one authoritative place writes go"?**

---

## 2. The Analogy: A Manager and Their Assistants

**Real-world analogy:** picture an office with one manager who makes every decision — approves every request, updates every record. Anyone who needs an answer has to go through the manager directly, and if the manager is out sick, nothing gets decided.

Now give the manager a couple of assistants. Every decision the manager makes gets relayed to each assistant, who writes it down in their own up-to-date copy of the same records. Employees who just need to *look something up* — not change it — can ask any assistant instead of queuing up at the manager's door. The manager is still the only one who makes and finalizes new decisions, but the assistants can each independently answer questions from their own copy, and if the manager is unreachable for a moment, the assistants still have yesterday's decisions on hand.

**The manager is the Redis master. The assistants are Redis replicas.** Writes always go through the master; replicas maintain their own continuously-updated copy and can serve reads on their own, without bothering the master for every lookup.

---

## 3. Internal Flow: How Asynchronous Replication Works

Redis replication connects one or more **replicas** to a single **master**, and keeps each replica's dataset in sync with the master's, in three phases:

1. **Configure the replica to follow a master.** Running `REPLICAOF <master-host> <master-port>` on an instance tells it: "stop being independent, become a replica of that master." (`SLAVEOF` is the older name for the same command, kept for backward compatibility — `REPLICAOF` is the current, preferred name.)
2. **Initial synchronization.** The replica connects to the master and requests a full sync. The master starts a background save (conceptually the same `BGSAVE` mechanism from Phase 5 — it forks, so it can keep serving other clients while producing a consistent point-in-time snapshot) and streams the resulting RDB file to the replica. The replica loads that RDB file, which brings it up to the master's dataset as of that snapshot moment.
3. **Continuous command streaming.** From that point on, the master forwards every write command it accepts to all connected replicas, in the same order it applied them itself, over a persistent connection. Each replica applies those commands to its own copy as they arrive. If a replica's connection drops briefly and reconnects, Redis can often perform a **partial resync** — replaying just the backlog of commands the replica missed from an in-memory buffer — instead of transferring the entire dataset again.

Crucially, this streaming is **asynchronous**: the master doesn't wait for a replica to confirm it applied a write before telling the client the write succeeded. This makes writes fast (no round-trip to remote replicas on the critical path) but means a replica's copy is always *slightly* behind the master's — usually by milliseconds, but that gap is real and matters for certain read patterns (see Section 5).

```
Client ──▶ SET key value ──▶ [ MASTER ] ──▶ (write applied, ack'd to client immediately)
                                   │
                                   ├──▶ streamed asynchronously ──▶ [ REPLICA A ]
                                   └──▶ streamed asynchronously ──▶ [ REPLICA B ]
```

---

## 4. Code Example: Setting Up a Replica and Inspecting Replication State

Assume two Redis instances are already running: one on the default port `6379` (intended as the master) and another started on port `6380` (intended as the replica) — for example via two separate `docker run` containers or two local `redis-server` processes with different `--port` values.

**Step 1 — make the `6380` instance a replica of the `6379` instance:**

```bash
redis-cli -p 6380 REPLICAOF 127.0.0.1 6379
# OK
```

**Step 2 — write to the master, confirm it's visible on the replica:**

```bash
redis-cli -p 6379 SET greeting "hello from master"
# OK

redis-cli -p 6380 GET greeting
# "hello from master"
```

**Step 3 — inspect replication state with `INFO replication`.**

On the master:

```bash
redis-cli -p 6379 INFO replication
# role:master
# connected_slaves:1
# slave0:ip=127.0.0.1,port=6380,state=online,offset=421,lag=0
# master_failover_state:no-failover
# master_replid:8c530fd3e2a1b4c9d7e6f5a4b3c2d1e0f9a8b7c6   (a unique replication ID)
# master_repl_offset:421
```

On the replica:

```bash
redis-cli -p 6380 INFO replication
# role:slave
# master_host:127.0.0.1
# master_port:6379
# master_link_status:up
# master_last_io_seconds_ago:0
# slave_repl_offset:421
# slave_read_only:1
```

`role:master` / `role:slave` is the field to check first; `master_link_status:up` on the replica confirms the connection to the master is healthy (it would read `down` if the replica lost contact); the matching `421` offset on both sides confirms the replica has caught up to the master's write stream. (Redis's internal field/variable names still use `slave` in places for backward compatibility, even though `REPLICAOF`/"replica" is the current preferred terminology.)

---

## 5. Reads on Replicas, Writes on the Master

Once replication is set up, the traffic-splitting pattern is simple: **send writes to the master, spread reads across the master and its replicas.**

| | **Master** | **Replica** |
|---|---|---|
| **Accepts writes** | Yes | No (read-only by default) |
| **Accepts reads** | Yes | Yes |
| **Data freshness** | Always current | Slightly behind (asynchronous replication lag) |
| **Role after a promotion (`REPLICAOF NO ONE`)** | — | Becomes an independent master, stops replicating |
| **Typical use** | All writes; reads for data that must be perfectly current | Scaling out read throughput; a warm standby copy |

Promoting a replica to stand on its own is a single command: `REPLICAOF NO ONE` tells it to stop replicating and start accepting writes directly. (Phase 6's next lesson, Redis Sentinel, covers *automating* that promotion when a master actually fails — this lesson is just the manual mechanics.)

**Common mistakes:**
- Sending a write to a replica and being surprised by an error — by default `replica-read-only` is enabled, so a replica rejects writes with a `READONLY You can't write against a read only replica.` error. This is intentional: it prevents a replica's copy from silently diverging from the master's.
- Ignoring replication lag — reading from a replica immediately after writing to the master can return stale data for a brief window, because the write hasn't streamed over yet. For a "read your own write" requirement (e.g., showing a user their own just-submitted comment), read from the master, not a replica.
- Assuming replication alone gives you automatic failover — it doesn't. If the master dies, replicas keep serving reads with what they last received, but nothing promotes a replica to master automatically; that's Sentinel's job, covered next.

**Interview angle:** "Explain how Redis replication works" is a staple system-design and Redis-specific interview question. Strong answers name the three phases (`REPLICAOF` configuration, initial RDB-based full sync, then continuous asynchronous command streaming), explicitly say replication is asynchronous (not synchronous) and explain the resulting consistency tradeoff, and distinguish "replication gives you read scaling and a warm copy" from "replication alone does NOT give you automatic failover" — that second point is exactly what trips people up and exactly what the next lesson (Sentinel) exists to solve.

---

## 6. Common Mistakes

- Writing directly to a replica during testing and getting confused by the `READONLY` error instead of realizing replicas are intentionally read-only.
- Building a feature that reads from a replica right after writing to the master and treating any staleness as a bug, rather than an inherent (and usually small) consequence of asynchronous replication.
- Manually running `REPLICAOF NO ONE` on a replica during an incident without a plan for how existing application connections and DNS/service discovery get pointed at the newly-promoted master — this manual dance is precisely what Sentinel automates.

---

## 7. Hands-On Exercises

### Exercise 1 — Stand up a master and a replica

Start two Redis instances (two `docker run -p <port>:6379 redis` containers on different host ports, or two local `redis-server --port <port>` processes). Run `REPLICAOF <master-ip> <master-port>` on the second one. Write a key on the master and confirm it appears on the replica with `GET`.

### Exercise 2 — Observe replication lag

With the same two-instance setup, write a script (or a fast sequence of `redis-cli` commands) that sets 1,000 keys on the master in a tight loop, then immediately queries `DBSIZE` on the replica. Run it a few times and note whether the replica's count ever briefly lags behind the master's — this is asynchronous replication lag made visible.

### Exercise 3 — Promote a replica manually

On your replica instance, run `REPLICAOF NO ONE`, then confirm with `INFO replication` that its `role` field changed from `slave` to `master`. Try writing to it directly and confirm the write now succeeds where it would have failed before.

---

## 8. Interview Q&A

### Q1. Is Redis replication synchronous or asynchronous, and why does that matter?

**Answer:** Asynchronous — the master applies a write and acknowledges the client immediately, without waiting for any replica to confirm it received the command. This keeps write latency low, but it means a replica's data can briefly lag behind the master's, which matters for any read pattern that needs to see its own most recent write.

---

### Q2. Can you write directly to a Redis replica?

**Answer:** Not by default. Replicas are read-only (`replica-read-only yes` by default) and reject write commands with a `READONLY` error, specifically to prevent a replica's dataset from silently diverging from the master's authoritative copy.

---

### Q3. What happens during the initial sync when a replica connects to a master?

**Answer:** The master performs a background save (the same fork-based mechanism as `BGSAVE`) to produce a consistent point-in-time RDB snapshot, streams that snapshot to the replica, and the replica loads it. After that, the master streams new write commands to the replica continuously as they happen.

---

### Q4. Does setting up master-replica replication give you automatic failover if the master crashes?

**Answer:** No. Replication by itself only keeps replicas' data in sync and lets them serve reads; nothing about plain replication detects a master failure or promotes a replica automatically. That orchestration is what Redis Sentinel (or Cluster) adds on top.

---

### Q5. How would you promote a replica to become a standalone master?

**Answer:** Run `REPLICAOF NO ONE` on the replica — it stops replicating from its former master and starts accepting writes directly as an independent instance. Doing this manually during an incident is exactly the manual process Sentinel automates.

---

> 🧠 **Memory hook:** "The master is the manager who decides; replicas are assistants who each keep their own copy up to date and can answer questions on their own — but only the manager makes new decisions."
