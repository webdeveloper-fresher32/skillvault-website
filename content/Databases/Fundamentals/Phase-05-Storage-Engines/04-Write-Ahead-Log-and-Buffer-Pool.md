# Write-Ahead Log and Buffer Pool — Complete Guide

> "A kitchen keeps what it is cooking with on the counter rather than the walk-in fridge, and spikes every order on a ticket before a single pan moves — so a power cut costs you the pans, never the orders."

---

## Table of Contents

1. [The Problem: Fast Writes That Also Survive a Crash](#1-the-problem-fast-writes-that-also-survive-a-crash)
2. [The Order Ticket and Prep Counter Analogy](#2-the-order-ticket-and-prep-counter-analogy)
3. [The Mechanism: Buffer Pool and Dirty Pages](#3-the-mechanism-buffer-pool-and-dirty-pages)
4. [Diagram: One Update from Client to Disk](#4-diagram-one-update-from-client-to-disk)
5. [Code Walkthrough: Checkpoints and fsync](#5-code-walkthrough-checkpoints-and-fsync)
6. [Comparing Sequential Log Writes to Random Page Writes](#6-comparing-sequential-log-writes-to-random-page-writes)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Fast Writes That Also Survive a Crash

A committed transaction must still be there after someone trips over the power cable. The obvious way to guarantee that is to write the changed page to its home location on disk before acknowledging the commit — and that turns out to be unaffordable.

### The Naive Durable Commit

```text
UPDATE accounts SET balance = balance - 50 WHERE id = 4471;
  page 19,204 modified in memory, then:
  → write it to its home offset  ← random 8 KB write
  → force it to media, then ack  ← fsync, ~0.5-1 ms
3 pages = 3 random writes + fsync; ceiling on good NVMe ≈ 1,000-
3,000 commits/s, while the same device appends at ≈ 2,000 MB/s.
  ↳ The cost is not the data, it is *where* it must go and the
    wait for the device to promise it arrived.
```

### What's Missing

Durability does not actually require the page to be on disk — it requires that the change can be *reconstructed* after a crash. What is missing is a cheaper artefact that proves what happened, written where writing is cheap, so the expensive page write can be postponed and batched.

---

## 2. The Order Ticket and Prep Counter Analogy

A busy kitchen never fetches an onion from the walk-in fridge each time it needs one; it pulls a crate onto the prep counter and works from there, returning what is left only when the counter runs out of room. And no cook starts a dish from memory: the order goes on a ticket, spiked in arrival order, before anything hits a pan. If the power fails mid-service, the half-cooked pans are lost, but the ticket spike says exactly which orders were in flight and what each one was.

### Walk-In Fridge and Ticket Spike

```text
Walk-in fridge → full stock, cold and far away; a trip costs a
                 minute you do not have mid-service
Prep counter   → the subset in active use, an arm's reach away
Ticket spike   → append-only, in order, never rewritten
Ticket first   → spiked BEFORE the pan moves, so it can never
                 miss a started dish
```

### Mapping the Analogy to the Storage Engine

The fridge is the disk, the counter is the buffer pool, and the spike is the write-ahead log. The ordering rule is the whole trick: because the ticket is always spiked first, a crash can leave pans unfinished but can never leave a started order unrecorded — and that is exactly what makes recovery possible.

---

## 3. The Mechanism: Buffer Pool and Dirty Pages

The **buffer pool** is a fixed-size array of page-sized frames in the database's own memory. Every page a query touches is read into it first, and every modification happens there — never directly on disk.

### The Pool and Its Frames

```text
sized by shared_buffers (PostgreSQL) / innodb_buffer_pool_size (MySQL)
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ page 41  │ page 902 │ page 19k │  free    │ page 77  │
│ clean    │ DIRTY    │ DIRTY    │          │ clean    │
└──────────┴──────────┴──────────┴──────────┴──────────┘
  clean → identical to disk; evict by forgetting it
  DIRTY → modified in memory only; evicting means writing first

Reading a page when the pool is full:
  1. choose a victim (PostgreSQL: clock sweep over usage counts;
     InnoDB: LRU with midpoint insertion so one scan cannot flush
     the pool)   2. if it is DIRTY → write it out first
  3. read the wanted page into the freed frame
  ↳ Step 2 is why a workload dirtying pages faster than the
    background writer flushes them stalls: reads wait on writes.
```

### Hit Rate Is the Number That Matters

```sql
-- PostgreSQL: fraction of page requests served from memory.
-- MySQL: 1 - Innodb_buffer_pool_reads / ..._read_requests
SELECT round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2)
  AS hit_pct FROM pg_stat_database WHERE datname = current_database();
```

```text
Memory hit → ~100 ns │ Disk miss → ~100 µs (NVMe), 1,000x slower
hit rate 99% → 0.99×0.1µs + 0.01×100µs ≈ 1.1 µs average
hit rate 95% → 0.95×0.1µs + 0.05×100µs ≈ 5.1 µs average
  ↳ 99% to 95% is not a 4% regression but ~5x slower — the misses
    dominate. Hence: check hit rate before anything else.
```

---

## 4. Diagram: One Update from Client to Disk

The write-ahead rule: the log record describing a change must be durable before the changed page may be written to its home location, and all of a transaction's log records must be durable before its commit is acknowledged.

### The Path of a Single Update

```text
 COMMIT of UPDATE accounts SET balance = balance - 50
 ┌──────────────────────────▼─────────────────────────┐
 │ 1. append to the WAL BUFFER (memory): LSN 4471,    │
 │    page 19204, before=1200, after=1150             │
 │ 2. modify page 19204 in the BUFFER POOL → DIRTY,   │
 │    stamped with LSN 4471                           │
 │ 3. write + fsync the WAL up to LSN 4471 ← the ONE  │
 │    sequential, durable write on this path          │
 │ 4. acknowledge COMMIT to the client ◀── durable    │
 └──────────────────────────┬─────────────────────────┘
   ...later, asynchronously ▼
   5. background writer / checkpointer writes page 19204
      to its home offset ← random write, off the hot path
```

### Reading the Diagram

The client waits for step 3 and nothing else. Steps 1-2 are memory, step 5 is deferred and batched — dozens of updates to the same page cost one eventual page write. A crash between steps 4 and 5 loses the page but not the change, because the log record survived and recovery can replay it.

---

## 5. Code Walkthrough: Checkpoints and fsync

Recovery, checkpoints and `fsync` turn "the log survived" into "the database is correct".

### Redo Recovery After a Crash

```text
Crash. The page on disk holds LSN 4102; the log runs to LSN 9800.
  ANALYSIS → scan from the last checkpoint, rebuilding the dirty
             page list and in-flight transaction list
  REDO     → replay every record with LSN > the page's own LSN
  UNDO     → roll back transactions that never reached COMMIT,
             using before-images from the same log
  ↳ Comparing page LSN to record LSN makes redo IDEMPOTENT, so
    recovery can crash halfway and be safely re-run (ARIES).
```

### Checkpoints and What They Bound

```sql
-- A checkpoint flushes dirty buffers and records the LSN from
-- which recovery must start.
SHOW checkpoint_timeout;  -- 5min: interval between automatic ones
SHOW max_wal_size;        -- 1GB: WAL volume that also triggers one
CHECKPOINT;               -- force one now
-- Without checkpoints recovery replays from the beginning of time
-- and the WAL never gets recycled. A checkpoint bounds RECOVERY
-- TIME (replay starts there, not LSN 1) and DISK USAGE (older
-- segments become recyclable), paying in random page writes.
```

### fsync the OS Page Cache and Group Commit

```text
write(fd, log_record, 200)
  ↳ returns once the bytes are in the OPERATING SYSTEM page cache.
    Nothing durable yet: a process crash survives this, a power
    cut does not.
fsync(fd)
  ↳ forces the OS cache to the device and waits — THIS is what
    "durable" means, and what a commit waits on.
Device write cache → a third layer; unless battery-backed or
    honouring flush, even fsync can be lied to (Section 7).
Knobs trading durability for throughput:
  innodb_flush_log_at_trx_commit = 1  fsync per commit (safe)
                                 = 2  write per commit, fsync ~1/s
  synchronous_commit = off (PostgreSQL) — same bargain: a crash
    can lose roughly the last second of commits
Group commit
  ↳ commits arriving while an fsync is in flight queue behind it
    and flush with the next, so 500 commits share one fsync;
    throughput scales with concurrency though fsync latency does not.
```

---

## 6. Comparing Sequential Log Writes to Random Page Writes

Both paths write the same logical change; they differ in where the bytes land, and that difference is the entire reason a WAL exists.

### WAL Write vs Page Write

| | WAL record | Data page |
|---|---|---|
| Pattern | Append to the end of one file | Seek to the page's home offset |
| On the commit path | Yes — the client waits for its fsync | No — deferred to checkpoint or eviction |
| If lost in a crash | Committed data is gone | Harmless — redo rebuilds it |

### Takeaway

The WAL converts many small random writes into one sequential write per commit batch, and then converts the page writes from urgent into optional. Deferring page writes is not a shortcut around durability; the log is what makes it safe, and the write-ahead ordering rule is what makes the log sufficient. Every knob in this lesson — checkpoint frequency, `synchronous_commit`, `innodb_flush_log_at_trx_commit` — is choosing where on that line to sit.

---

## 7. Common Mistakes

- **Treating a returned `write()` as durable.** `write()` copies into the operating system's page cache and returns; only `fsync` or `fdatasync` forces those bytes to the device and waits for confirmation. A process crash survives an un-fsynced write, but a power cut does not — and if the device's own write cache is volatile and does not honour flush commands, even `fsync` can be lied to.
- **Sizing the buffer pool by remaining free RAM instead of by hit rate.** The number that matters is the fraction of page requests served from memory, and its relationship to memory is steeply non-linear: the pool only has to be big enough for the working set, after which more memory buys nothing, and just below that threshold a small increase can move the hit rate several points and the latency several fold.
- **Assuming a `COMMIT` that returned means the data pages are on disk.** It means the *log records* are durable; the pages may sit dirty in the buffer pool for minutes. That is correct and intended — recovery replays the log — but it explains why the data directory lags reality, and why copying those files without the WAL produces an unusable backup.
- **Setting `innodb_flush_log_at_trx_commit = 2` or `synchronous_commit = off` without stating the loss window.** Both are legitimate, deliberate trades that can multiply throughput, and both mean a power cut can lose roughly the last second of committed transactions. The mistake is choosing them for speed without anyone agreeing that those transactions are acceptable to lose.

---

## 8. Hands-On Exercises

**Exercise 1:** Query your buffer pool hit rate with the `pg_stat_database` statement from Section 3 (or the two `Innodb_buffer_pool_*` status variables in MySQL). Run a query that scans a table larger than the pool, then re-check the hit rate and watch it fall.

**Exercise 2:** Set `shared_buffers` to 16 MB, restart, and time a workload whose working set is 200 MB. Raise it to 512 MB, restart, and time the same workload again. Record both hit rates alongside both timings and confirm the latency change is far larger than the memory change.

**Exercise 3:** Benchmark durability settings honestly. Run `pgbench -c 8 -T 60` with `synchronous_commit = on`, then again with it `off`, and record transactions per second for each. Write down, in one sentence, exactly what the faster configuration can lose.

**Exercise 4:** Force a checkpoint with `CHECKPOINT` and note the WAL file count in `pg_wal` before and after. Then set `checkpoint_timeout = '30s'`, run a write-heavy workload, and observe both the checkpoint frequency in the log and the resulting write pattern.

**Exercise 5:** Reproduce the third mistake from Section 7. Insert rows in a committed transaction, confirm they are visible, then `kill -9` the server process before any checkpoint. Restart it, watch the log announce redo recovery, and confirm the rows are present — proving the commit was durable even though the pages never reached disk.

---

## 9. Interview Q&A

**Q: What is the write-ahead rule and why does it make crash recovery possible?**
The log record describing a change must reach durable storage before the modified page may be written to its home location, and all of a transaction's log records must be durable before the commit is acknowledged. That ordering guarantees the log is never missing a change that is already on disk, so after a crash the log is a complete description of everything that happened. Recovery can then replay committed changes the pages never received and roll back transactions that never committed, using nothing but the log and whatever pages happen to be there.

**Q: Why is a sequential log write so much cheaper than writing the data page?**
The log is appended to the end of one file, so consecutive commits form one large sequential transfer the device handles at full bandwidth, and it carries only the bytes that changed rather than a whole 8 or 16 KB page. A page write instead seeks to that page's home offset, which is the device's slowest pattern, and a transaction touching three pages needs three of them. The WAL therefore replaces several random writes on the commit path with one sequential one, and lets the page writes be deferred and batched off the hot path entirely.

**Q: What does a checkpoint bound?**
Two things. Recovery time, because replay begins at the last checkpoint rather than at the start of the log; and disk usage, because WAL segments older than the checkpoint can be recycled. The trade is direct: frequent checkpoints give fast recovery and a small WAL at the cost of a steady stream of random page writes, while rare ones smooth out I/O but make a restart after a crash take longer.

**Q: Why is "the write returned" not the same as "the data is safe"?**
`write()` only copies the bytes into the operating system's page cache and returns; the data is still in volatile memory. `fsync` is what pushes it to the device and waits, and beneath that the device's own write cache is a third layer that must either be battery-backed or honour flush commands, or even `fsync` is not the end of the story. This is why `innodb_flush_log_at_trx_commit = 2` and `synchronous_commit = off` are faster: they skip or defer the fsync, which is a legitimate choice as long as everyone knows a power cut then costs roughly the last second of committed work.

**Q: What is group commit?**
While one `fsync` is in flight, transactions that commit behind it queue up and get flushed together by the next one, so a single `fsync` can make hundreds of commits durable at once. It matters because fsync latency is a property of the hardware and does not improve with load, whereas commit throughput needs to. Group commit is what lets a system with a one-millisecond fsync sustain far more than a thousand commits per second, and it is why concurrency often raises throughput without raising per-commit latency much at all.
