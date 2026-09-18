# 01 — RDB Snapshotting

> A comprehensive reference covering why an in-memory store needs a persistence story at all, how RDB point-in-time snapshots work, `SAVE` vs `BGSAVE`, the copy-on-write fork mechanism, and when RDB alone isn't durable enough.

---

## Table of Contents

1. [The Problem: Everything Lives in RAM](#1-the-problem-everything-lives-in-ram)
2. [The Analogy: A Photograph of the Room](#2-the-analogy-a-photograph-of-the-room)
3. [What RDB Actually Is](#3-what-rdb-actually-is)
4. [SAVE vs BGSAVE and the Fork Mechanism](#4-save-vs-bgsave-and-the-fork-mechanism)
5. [Configuring Automatic Snapshots](#5-configuring-automatic-snapshots)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Everything Lives in RAM

Phase 1 established that Redis keeps its dataset in memory for speed. That speed comes with an obvious and unavoidable risk: RAM is volatile. If the `redis-server` process is killed, the machine reboots, or the container restarts, everything held only in memory is gone the instant power to that memory is lost — there is no "it's still there, just slower to reach" fallback the way there is with a disk-backed database.

For a pure, disposable cache in front of another system of record, that might be perfectly fine — a cache miss just means falling back to the real database (Phase 10 covers this pattern in depth). But plenty of real Redis deployments hold data that isn't trivially reconstructable elsewhere: a rate limiter's counters, a session store, a leaderboard built up over weeks. The core problem this phase addresses: **how does an in-memory store survive a restart or a crash without becoming a fresh, empty instance every time?**

Redis has two distinct answers to that problem — RDB snapshotting (this lesson) and the append-only file, AOF (next lesson). They solve overlapping but different halves of "don't lose my data."

---

## 2. The Analogy: A Photograph of the Room

**Real-world analogy:** imagine a room that's constantly being rearranged — furniture moved, objects added and removed, all day long. Every so often, someone walks in and takes a **photograph** of the room exactly as it looks at that moment. That photograph is fast to take, complete, and self-contained — anyone looking at it later sees the entire room as a single, coherent, point-in-time picture.

But the photograph has one obvious limitation: **anything that happens after the photo was taken and before the next one is lost** if the room burns down in between. If the last photo was taken at 2:00pm and the room is destroyed at 2:07pm, everything rearranged in those seven minutes is gone — the photo only knows about 2:00pm.

**RDB is that photograph.** It's a complete, point-in-time binary snapshot of Redis's entire dataset written to disk. Restoring from it means loading the whole picture back into memory in one shot — fast and simple. But anything written to Redis after the most recent snapshot was taken, and before the process stopped, is not in that photograph. That gap is exactly what AOF (Lesson 2 of this phase) exists to close.

---

## 3. What RDB Actually Is

**RDB** (Redis Database) is a single binary file — by default named `dump.rdb` — that contains a compact, compressed, point-in-time snapshot of every key and value currently in Redis. It is:

- **Complete** — one file captures the entire dataset as of the moment the snapshot was taken, not an incremental diff.
- **Compact** — because it's a binary serialization rather than a text log of commands, it's typically smaller on disk than the equivalent AOF log and loads back into memory quickly on restart.
- **Point-in-time** — it reflects Redis's state at one specific instant, not a continuous record of every change since the last snapshot.

Those properties make RDB well suited for backups, disaster recovery, and moving a dataset between machines (copy one `.rdb` file, done) — but poorly suited, on its own, for minimizing data loss on a crash, because anything written since the last snapshot simply isn't in the file.

---

## 4. SAVE vs BGSAVE and the Fork Mechanism

Redis can produce an RDB snapshot two ways:

- **`SAVE`** — performs the snapshot **synchronously**, in the main Redis process. While `SAVE` runs, Redis cannot serve any other client's commands, because the single command-execution thread (Phase 1) is busy writing the snapshot. On a large dataset this can block the server for seconds — rarely acceptable in production.
- **`BGSAVE`** — performs the snapshot **in the background**. Redis `fork()`s a child process, and that child process writes the RDB file while the original (parent) process keeps serving client reads and writes normally.

```
redis-cli> BGSAVE
Background saving started
```

Checking whether it finished, and when it last succeeded, uses `LASTSAVE`, which returns a Unix timestamp:

```
redis-cli> LASTSAVE
(integer) 1721904000
```

That integer is the number of seconds since the Unix epoch at which the last successful RDB save completed. If you run `BGSAVE` and then immediately run `LASTSAVE` again once the save finishes, you'll see the timestamp update to the time the background save completed.

**Why forking works without blocking:** when Redis calls `fork()`, the operating system creates a child process that initially shares the exact same memory pages as the parent — no data is copied at that instant, which is why the fork itself is very fast even for a large dataset. The child then writes out those (shared) pages to the RDB file. Meanwhile, if the parent process needs to modify a piece of data that the child hasn't finished reading yet, the OS uses **copy-on-write (COW)**: only the specific memory page being modified gets duplicated at that moment, so the child continues to see the original, unmodified version it started with, and the parent's clients see their writes go through immediately. The dataset the child writes to disk is therefore a consistent snapshot of "the moment `BGSAVE` was called," even though the live dataset kept changing underneath it.

**Common mistakes:**
- Running `SAVE` directly on a production instance with a large dataset — it blocks every client until the snapshot finishes, which can look like a full outage for several seconds.
- Assuming `BGSAVE` has zero cost — forking still briefly pauses the parent process (proportional to memory size, not dataset content) and can spike memory usage under heavy concurrent writes because of the copy-on-write duplication, so it's not entirely free even though it doesn't block command execution the way `SAVE` does.

**Interview angle:** "Explain the difference between `SAVE` and `BGSAVE`, and why forking doesn't require copying the whole dataset upfront" is a very common Redis persistence question. Interviewers want to hear that you know `SAVE` blocks the single command thread while `BGSAVE` forks a child process, and that you can explain copy-on-write at a conceptual level — that the fork is cheap because pages are only duplicated when modified, not all at once.

---

## 5. Configuring Automatic Snapshots

Rather than manually running `BGSAVE`, Redis can be configured to trigger snapshots automatically based on how much writing has happened, using `save` rules in `redis.conf` (or via `CONFIG SET save "..."` at runtime). Each rule is a `<seconds> <changes>` pair meaning "take a snapshot if at least this many seconds have passed **and** at least this many keys have changed." Multiple rules are OR'd together — if any one of them is satisfied, a `BGSAVE` fires.

A typical default set of rules looks like:

```
save 900 1
save 300 10
save 60 10000
```

Read as: snapshot if 1 key changed in the last 900 seconds (15 minutes), **or** if 10 keys changed in the last 300 seconds (5 minutes), **or** if 10,000 keys changed in the last 60 seconds. The last rule exists specifically to handle bursts of heavy write activity without waiting a full 15 minutes for the first rule to trigger.

You can disable automatic snapshotting entirely (relying only on manual `BGSAVE` calls, or on AOF instead) by setting an empty `save ""` rule.

**Common mistakes:**
- Relying solely on infrequent RDB snapshots (e.g. only the default `save 900 1` rule) for a workload that genuinely can't tolerate losing the last few minutes of writes on a crash — a crash one minute before the next scheduled snapshot loses everything written since the previous one. This exact gap is what AOF, covered next, is designed to close.
- Forgetting that `save ""` disables automatic snapshotting silently — a common cause of "wait, why doesn't my `dump.rdb` ever update?" confusion in a misconfigured instance.

---

## 6. Hands-On Exercises

### Exercise 1 — Trigger and confirm a snapshot

Start a local Redis instance (Phase 1, Lesson 2 covers installation). Run `SET mykey "hello"`, then `redis-cli BGSAVE`, then `redis-cli LASTSAVE`. Note the returned timestamp. Wait a few seconds, set another key, run `BGSAVE` again, and confirm `LASTSAVE` returns a newer (larger) timestamp.

### Exercise 2 — Reason about the fork's memory behavior

Suppose a Redis instance holds 2GB of data and `BGSAVE` is running via a forked child process. Write a short explanation (a few sentences) of what happens, physically, if the parent process modifies a 1KB value while the child is still mid-write. Use the term "copy-on-write" in your explanation.

### Exercise 3 — Design `save` rules for two different workloads

Workload A writes rarely (a handful of keys per hour). Workload B is a high-throughput counter service updating thousands of keys per second. Write one `save` rule set for each, and explain in a sentence why the same rules wouldn't suit both workloads well.

---

## 7. Interview Q&A

### Q1. What is an RDB snapshot?

**Answer:** RDB is a complete, point-in-time binary snapshot of Redis's entire dataset written to a single file on disk (`dump.rdb` by default), used to restore Redis's state after a restart or for backups.

---

### Q2. What's the difference between `SAVE` and `BGSAVE`?

**Answer:** `SAVE` writes the snapshot synchronously in the main Redis process, blocking all other client commands until it finishes. `BGSAVE` forks a child process to write the snapshot in the background, letting the parent process keep serving reads and writes normally while the snapshot is created.

---

### Q3. Why doesn't forking a large dataset for `BGSAVE` require copying all of it immediately?

**Answer:** The operating system's `fork()` gives the child process the same memory pages the parent already has, without duplicating them upfront. Copy-on-write means a given page is only actually duplicated at the moment either process modifies it — so the child keeps seeing the dataset as it was at fork time, while the parent's ongoing writes only duplicate the specific pages being changed.

---

### Q4. How would you check when the last successful RDB save completed?

**Answer:** Run `LASTSAVE`, which returns a Unix timestamp of the last time an RDB save finished successfully — either via `SAVE`, `BGSAVE`, or an automatic snapshot triggered by a configured `save` rule.

---

### Q5. What's the main weakness of relying only on RDB for durability?

**Answer:** RDB only captures data at the moment a snapshot is taken, so anything written after the most recent snapshot and before a crash is permanently lost. Workloads that can't tolerate losing even a few minutes of writes need AOF (or AOF combined with RDB) instead of RDB alone.

---

> 🧠 **Memory hook:** "RDB is a photograph of the room — fast, complete, but blind to anything that happens after the shutter clicks."
