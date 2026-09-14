# 02 — AOF and Hybrid Persistence

> A comprehensive reference covering the append-only file (AOF) persistence mechanism, `appendfsync` durability tradeoffs, AOF rewrite/compaction, hybrid RDB+AOF persistence, and how to choose between RDB, AOF, and hybrid for a given workload.

---

## Table of Contents

1. [The Problem: RDB's Snapshot Gap](#1-the-problem-rdbs-snapshot-gap)
2. [The Analogy: Security Camera vs Photograph](#2-the-analogy-security-camera-vs-photograph)
3. [What AOF Actually Is](#3-what-aof-actually-is)
4. [appendfsync: Trading Durability for Performance](#4-appendfsync-trading-durability-for-performance)
5. [AOF Rewrite and Hybrid Persistence](#5-aof-rewrite-and-hybrid-persistence)
6. [RDB vs AOF vs Hybrid: A Comparison](#6-rdb-vs-aof-vs-hybrid-a-comparison)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: RDB's Snapshot Gap

The previous lesson established RDB's fundamental limitation: it only captures the dataset at fixed moments in time, decided either manually (`SAVE`/`BGSAVE`) or by `save` rules ("snapshot if N keys changed in M seconds"). Between any two snapshots, Redis is still accepting writes — but none of those writes exist anywhere on disk yet. If the process crashes at any point in that window, everything written since the last snapshot is gone permanently.

For workloads where losing "whatever happened in the last few minutes" is an acceptable risk, that's a fine tradeoff — RDB is cheap and fast to restore from. But for workloads where every write genuinely matters (financial-adjacent counters, an order queue, anything where "we silently lost some writes" is a real incident), a fundamentally different mechanism is needed: one that records writes as they happen, not only at scheduled checkpoints.

---

## 2. The Analogy: Security Camera vs Photograph

**Real-world analogy:** RDB is the photograph from the previous lesson — a single, complete picture taken periodically. **AOF is a security camera recording continuously.** Instead of an occasional snapshot, it logs every single event (every write command) as it happens, in order, to a running log. If you need to know exactly what happened at any point, you can replay the footage from the beginning and reconstruct the room's exact state at any moment in between — not just at the moments a photo happened to be taken.

The tradeoff mirrors the real world too: continuous recording captures far more detail and far less is ever lost, but the footage itself takes more storage than a handful of photographs, and reconstructing "the current state of the room" by replaying an ever-growing tape from the very beginning gets slower the longer that tape runs — which is exactly why AOF needs a way to periodically compact itself (covered in Section 5).

---

## 3. What AOF Actually Is

**AOF (Append-Only File)** persistence works by logging every write command Redis executes to a file, in the order it was executed, as it happens. It's enabled with:

```
redis-cli> CONFIG SET appendonly yes
OK
```

(equivalently, `appendonly yes` in `redis.conf` to enable it at startup). Once enabled, Redis appends every write command — a `SET`, an `INCR`, an `LPUSH`, and so on — to a log file (conceptually `appendonly.aof`, though modern Redis versions organize it as a directory of multiple files under an "AOF manifest"). Restoring from AOF means replaying that entire command log from the start, in order, rebuilding the dataset one write at a time exactly as it originally happened.

Because AOF logs the *commands themselves* rather than a binary snapshot of the resulting data, it can, depending on the `appendfsync` policy (next section), capture writes far more granularly than RDB's "only at snapshot time" model — right down to logging (and durably flushing) individual commands as they're executed.

---

## 4. appendfsync: Trading Durability for Performance

Appending a command to the AOF file in Redis's own memory buffer is fast, but that alone doesn't guarantee it survives a crash — the operating system may still be holding it in its own write buffer rather than having physically written it to disk. The `appendfsync` setting controls **how often Redis forces that buffer to actually be flushed (`fsync`'d) to disk**, and it's a direct durability-vs-performance dial:

| `appendfsync` value | Behavior | Durability | Performance impact |
|---|---|---|---|
| `always` | `fsync` after every single write command | Strongest — effectively zero data loss on crash | Slowest — every write pays a disk `fsync` cost |
| `everysec` | `fsync` once per second, batching all writes in that second | Good — at most ~1 second of writes can be lost on crash | Small — the common default, a practical middle ground |
| `no` | Never explicitly `fsync`; let the OS decide when to flush | Weakest — the OS may buffer much longer, losing more on crash | Fastest — no explicit fsync overhead at all |

```
redis-cli> CONFIG SET appendfsync everysec
OK
redis-cli> CONFIG GET appendfsync
1) "appendfsync"
2) "everysec"
```

**Common mistakes:**
- Setting `appendfsync always` without understanding its real performance cost — forcing a disk `fsync` on every single write command can meaningfully reduce write throughput, and it's rarely necessary outside of workloads with extremely strict per-write durability requirements.
- Assuming AOF alone guarantees zero data loss. The common default, `everysec`, batches `fsync` calls once per second specifically for performance — which means a crash can still lose up to roughly a second's worth of the most recent writes. "AOF is enabled" is not the same claim as "AOF with `appendfsync always`."

**Interview angle:** "How does AOF's `appendfsync` setting trade off durability against performance, and which would you pick for a payments system vs a general cache?" is a favorite Redis persistence interview question, because it tests whether you understand that "durable" is a spectrum, not a boolean, and that the right answer depends on how much data loss the specific workload can actually tolerate.

---

## 5. AOF Rewrite and Hybrid Persistence

Because AOF logs every write command forever, the log file grows without bound over time — including commands that have since been overwritten or made irrelevant (e.g. ten `INCR` calls on the same counter could be replaced by one command setting the final value). Left unchecked, this means slower restarts (replaying a huge log takes longer) and wasted disk space.

Redis solves this with **AOF rewrite**: it rebuilds the AOF file from scratch, using the current in-memory dataset to produce the smallest set of commands needed to recreate it — logically similar to "collapse the whole history into just what's needed to reach today's state." This can be triggered manually:

```
redis-cli> BGREWRITEAOF
Background append only file rewriting started
```

Like `BGSAVE`, `BGREWRITEAOF` forks a child process to perform the rewrite so the parent keeps serving clients uninterrupted. Redis can also be configured to trigger this automatically once the AOF file grows past a configured percentage larger than it was after the last rewrite.

**Hybrid persistence** (the default in modern Redis versions when both RDB and AOF are relevant) takes this a step further: instead of an AOF rewrite producing a file of pure commands, it writes an **RDB-formatted preamble** — a compact binary snapshot of the dataset — followed by any AOF commands logged *after* that snapshot was taken. Restoring means loading the RDB preamble quickly (fast, like a normal RDB load) and then replaying only the small tail of AOF commands written since, rather than replaying the entire command history from the beginning. This gives you AOF's fine-grained durability going forward, with RDB's fast-restart properties for everything already captured in the preamble.

**Common mistakes:**
- Never triggering (or configuring automatic) AOF rewrites, letting the log grow indefinitely — this eventually turns "restart Redis" into a slow, disk-heavy operation as the entire uncompacted history has to be replayed.
- Assuming hybrid persistence is a third, separate mechanism you have to choose instead of AOF — it's really AOF's own file format being smarter about how it represents history (RDB snapshot + a short command tail) rather than a different persistence system entirely.

---

## 6. RDB vs AOF vs Hybrid: A Comparison

| | **RDB only** | **AOF only** | **Hybrid (RDB preamble + AOF tail)** |
|---|---|---|---|
| **Durability** | Weakest — loses everything since the last snapshot | Strong — as little as ~1 second lost with `everysec`, near-zero with `always` | Strong — same durability profile as AOF going forward |
| **Restart speed** | Fast — load one compact binary file | Slower — replay the full command log | Fast — load the RDB preamble, then replay only the short AOF tail |
| **Disk usage** | Compact — one point-in-time binary file | Larger — grows continuously until rewritten | Moderate — compact preamble plus a bounded recent tail |
| **Performance overhead during normal operation** | Low — only pays a cost during snapshot forks | Depends on `appendfsync` — `always` has real per-write overhead, `everysec` is modest | Same as AOF's `appendfsync` overhead, since writes still append to the AOF tail |

---

## 7. Hands-On Exercises

### Exercise 1 — Enable AOF and inspect the setting

Start a local Redis instance. Run `CONFIG SET appendonly yes`, then `CONFIG GET appendonly` to confirm it reports `yes`. Set a few keys, then explain (in a sentence) what you'd expect to find on disk as a result.

### Exercise 2 — Choose an `appendfsync` policy for two workloads

Workload A is a real-time multiplayer game's ephemeral session cache, where losing a second of data on a crash is a non-event (the client reconnects and resyncs). Workload B is a ledger recording point-in-time account balance adjustments. Write one sentence justifying an `appendfsync` choice for each.

### Exercise 3 — Trigger a rewrite and reason about restart time

Run `BGREWRITEAOF` against a local instance after writing a batch of keys (some of them overwritten multiple times, e.g. repeated `INCR` calls on the same counter). Explain, in your own words, why the rewritten AOF file is expected to be smaller than a log of every individual command that was ever run.

---

## 8. Interview Q&A

### Q1. What problem does AOF solve that RDB alone doesn't?

**Answer:** RDB only captures the dataset at fixed snapshot points, so any writes between the last snapshot and a crash are lost. AOF logs every write command as it happens, so far less — depending on the `appendfsync` policy, as little as a fraction of a second's worth — is ever at risk of being lost on a crash.

---

### Q2. What are the three `appendfsync` options and how do they differ?

**Answer:** `always` flushes to disk after every write command, giving the strongest durability at the cost of the most performance overhead. `everysec` (the common default) batches flushes to once per second, risking at most about a second of lost writes on crash with much lower overhead. `no` leaves flushing entirely to the operating system's own discretion, which is fastest but offers the weakest durability guarantee.

---

### Q3. Does enabling AOF with the default settings guarantee zero data loss?

**Answer:** No. The common default `appendfsync everysec` batches disk flushes once per second for performance, meaning a crash can still lose up to roughly the last second of writes. Only `appendfsync always` gets close to zero data loss, and it comes with a real per-write performance cost.

---

### Q4. Why does the AOF file need to be rewritten, and what does `BGREWRITEAOF` do?

**Answer:** AOF logs every write command forever, so the file grows continuously and can contain many redundant or superseded commands (e.g. many increments to the same counter). `BGREWRITEAOF` forks a child process that rebuilds the AOF file from the current dataset using the minimal set of commands needed to reproduce it, keeping the file smaller and restarts faster.

---

### Q5. What is hybrid persistence and why is it useful?

**Answer:** Hybrid persistence writes an AOF file as an RDB-formatted binary preamble (a compact snapshot) followed by a short tail of AOF commands logged since that snapshot. On restart, Redis loads the fast binary preamble and then replays only the small recent tail, combining RDB's fast restart times with AOF's fine-grained durability, instead of having to replay a full command history from scratch.

---

> 🧠 **Memory hook:** "RDB is a photograph; AOF is the security camera tape — hybrid persistence is watching the photo, then fast-forwarding through just the footage since it was taken."
