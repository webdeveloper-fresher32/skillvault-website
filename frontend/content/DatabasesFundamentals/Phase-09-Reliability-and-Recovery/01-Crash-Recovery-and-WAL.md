# Crash Recovery and the Write-Ahead Log — Complete Guide

> "A waiter spikes the order ticket before the cook touches a pan, so when the kitchen catches fire mid-service the tickets — not the half-cooked pans — say what was actually ordered."

---

## Table of Contents

1. [The Problem: A Process Killed Mid-Transaction](#1-the-problem-a-process-killed-mid-transaction)
2. [The Order Ticket Analogy](#2-the-order-ticket-analogy)
3. [The Mechanism: Log Records and the Write-Ahead Rule](#3-the-mechanism-log-records-and-the-write-ahead-rule)
4. [Diagram: The Three ARIES Passes](#4-diagram-the-three-aries-passes)
5. [Code Walkthrough: Replaying a Log by Hand](#5-code-walkthrough-replaying-a-log-by-hand)
6. [Comparing Redo to Undo](#6-comparing-redo-to-undo)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: A Process Killed Mid-Transaction

Phase 5 established that writes land in the buffer pool first and reach the data files later, and that a log record is written before the page is. This lesson is about the moment that ordering has to pay off: someone runs `kill -9`, or the power fails, and the process stops between instructions with no chance to clean up.

### What Actually Sits on Disk at the Instant of the Crash

```text
14:02:11.480  T41  UPDATE accounts SET balance = 900 WHERE id = 7
14:02:11.482  T41  COMMIT                        ← client was told "OK"
14:02:11.495  T42  UPDATE accounts SET balance = 300 WHERE id = 9
14:02:11.501  ***  kill -9                       ← T42 never committed

Disk one millisecond later:
  page 118 (id=7)  balance = 1000
    ↳ T41 committed, but its dirty page sat only in the buffer pool:
      an acknowledged change is MISSING from disk
  page 204 (id=9)  balance =  300
    ↳ T42 never committed, but the pool evicted this page anyway:
      an uncommitted change IS on disk
```

### What's Missing

Two failures point in opposite directions at the same time: work that should be there is absent, and work that should not be there is present. Re-reading the data files cannot distinguish either case, because a page carries no record of which transaction wrote it or whether that transaction ever finished. What is missing is a separate, ordered, durable account of intent — written before the pages changed — that can be replayed to add back the first kind and reversed to remove the second.

---

## 2. The Order Ticket Analogy

A restaurant kitchen never trusts the pans. The waiter writes the order on a ticket and spikes it before the cook touches anything, and the ticket is only pulled down and marked paid when the plate leaves. If the kitchen catches fire mid-service, nobody reconstructs the evening by inspecting half-cooked pans — the spike says which orders were taken, and the paid pile says which were finished.

### Pans vs the Ticket Spike

```text
The pans        → the partial, unlabelled state of the kitchen: a pan
                  of risotto could belong to a paid order, a cancelled
                  one, or one nobody has started plating
The spike       → every order in the sequence it was taken, written
                  before any cooking began, marked once paid
After the fire  → remake anything paid that never plated; scrape any
                  pan whose ticket was never paid
```

### Mapping the Analogy to Crash Recovery

The pans are the data pages; the spike is the write-ahead log. "Remake anything paid that never plated" is redo. "Scrape any pan whose ticket was never paid" is undo. The rule that the ticket is spiked before the cook starts is exactly the write-ahead rule, and it is what makes the two lists trustworthy after the fire.

---

## 3. The Mechanism: Log Records and the Write-Ahead Rule

The log is an append-only file of small records, each stamped with a monotonically increasing Log Sequence Number (LSN). The LSN is both an identity and an ordering: LSN 4187 happened strictly after LSN 4186, always.

### The Anatomy of a Log Record

```text
LSN    TXN    TYPE     PAGE   BEFORE   AFTER
4186   T41    UPDATE   118    1000     900
4187   T41    COMMIT   -      -        -
4188   T42    UPDATE   204     500     300
  ↳ BEFORE is undo information: what to restore if T42 loses. AFTER
    is redo information: what to reapply if T41's page never reached
    disk. Carrying both is what supports both passes.
```

### The Write-Ahead Rule

```text
1. Before page P reaches the data file, every log record describing a
   change to P must already be durable.
     ↳ else an uncommitted change reaches disk with no BEFORE image
       anywhere to undo it
2. Before a COMMIT is acknowledged, that transaction's records up to
   and including its COMMIT record must be fsync'd.
     ↳ this, not flushing data pages, makes the D in ACID true
```

### Checkpoints and Bounded Recovery Time

```text
Without checkpoints, recovery would scan from LSN 1. A checkpoint
record instead lists the transactions active at that moment plus the
dirty page table — pages modified in the buffer pool but not yet
written out, each with the LSN that first dirtied it.
  ↳ recovery starts at the oldest LSN in that table, bounding replay
    to what happened since the last checkpoint
Frequent checkpoints → shorter recovery, more steady-state I/O
Rare checkpoints     → cheaper running, longer outage after a crash
```

---

## 4. Diagram: The Three ARIES Passes

ARIES is the recovery algorithm most relational engines are modelled on. It makes exactly three passes over the log, in a fixed order.

### Analysis then Redo then Undo

```text
   Crash. Process restarts.  │
                             ▼
  ┌──────────────────────────┴──────────────────────┐
  │ 1 ANALYSIS  forward from the last checkpoint:   │
  │   rebuild the dirty page table, split txns into │
  │   winners (reached COMMIT) and losers (did not) │
  ├─────────────────────────────────────────────────┤
  │ 2 REDO  forward: reapply EVERY logged change —  │
  │   winners AND losers — whose page LSN shows it  │
  │   never landed. Disk now matches the log.       │
  ├─────────────────────────────────────────────────┤
  │ 3 UNDO  backward: reverse the losers from their │
  │   BEFORE images, logging each as a compensation │
  └──────────┬──────────────────────────────────────┘
             ▼   Open for connections.
```

### Reading the Diagram

The surprise is Pass 2 redoing losers too. ARIES calls this "repeating history": it first restores the exact page state that existed at the crash, including doomed work, so that Pass 3 has a known starting point to unwind from. Undo also logs its own compensation records, so a crash *during* recovery does not lose the progress recovery already made.

---

## 5. Code Walkthrough: Replaying a Log by Hand

The whole algorithm fits in about thirty lines once the log is a list of tuples. This runs standalone.

### A Log and the Three Passes

```python
# aries_mini.py — the three passes over a five-record log.
LOG = [                       # (lsn, txn, kind, page, before, after)
    (4186, "T41", "update", 118, 1000, 900),
    (4187, "T41", "commit", None, None, None),
    (4188, "T42", "update", 204,  500, 300),   # crash before its commit
    (4189, "T43", "update", 118,  900, 850),
    (4190, "T43", "commit", None, None, None)]
def recover(pages, page_lsn, redo_start):
    won = {r[1] for r in LOG if r[2] == "commit"}                # analysis
    losers = {r[1] for r in LOG if r[1] not in won}
    for lsn, txn, kind, page, before, after in LOG:              # redo
        if kind != "update" or lsn < redo_start:
            continue
        if page_lsn.get(page, 0) < lsn:   # else it already reached disk
            pages[page], page_lsn[page] = after, lsn
    for lsn, txn, kind, page, before, after in reversed(LOG):    # undo
        if kind == "update" and txn in losers:
            pages[page] = before
    return pages
# Section 1's disk state, replayed from LSN 4186:
print(recover({118: 1000, 204: 300}, {118: 0, 204: 4188}, 4186))
# {118: 850, 204: 500}
#   ↳ 118 redone forward to T43's committed 850; 204 undone to 500
```

### Idempotent Replay and Torn Pages

```text
page_lsn.get(page, 0) < lsn  →  apply, else skip
  ↳ Every page stores the LSN of the last change applied to it, so
    replay never applies a record twice. Running recovery twice, or
    crashing partway through it and rerunning, converges identically.
Torn page: an 8 KB page write is not atomic on a 4 KB-sector device, so
a crash mid-write leaves half old bytes and half new — plus a garbled
page LSN, meaning the stamp above cannot be trusted. Engines defend
with a full page image logged once per checkpoint (or a double-write
buffer) restored before redo, plus checksums to detect the tear.
```

---

## 6. Comparing Redo to Undo

Both passes rewrite data pages from log records, and both are mandatory, but they answer opposite questions and read opposite fields.

### Redo vs Undo

| | Redo | Undo |
|---|---|---|
| Fixes | Committed work missing from the data files | Uncommitted work already in the data files |
| Caused by | Data pages lagging behind the log | Buffer pool evicting a dirty page early |
| Log field used | AFTER image, scanned forward | BEFORE image, scanned backward |
| Applies to | Every logged change including losers | Loser transactions only |

### Takeaway

The two exist because the engine makes two independent optimizations: it delays writing dirty pages (creating the redo problem) and it allows evicting dirty pages before commit (creating the undo problem). An engine that flushed every page at commit would need no redo; one that pinned dirty pages until commit would need no undo. Real engines refuse both restrictions for throughput, and pay for it with a two-directional log.

---

## 7. Common Mistakes

- **Treating the commit fsync as tunable free performance.** Turning off synchronous commit makes the log write land in the OS page cache instead of the device, which does make commits faster and does not corrupt anything — but it silently converts "committed" into "probably committed", and a power loss can lose the last few hundred milliseconds of acknowledged transactions. That is a legitimate choice only when it is a deliberate, documented RPO decision (Lesson 3), never an accident.
- **Assuming redo alone is enough.** It is intuitive that a crash loses recent work, and much less intuitive that a crash can leave work on disk that was never committed. Both happen, in the same crash, and an engine with only a redo log has to prevent uncommitted pages from ever reaching disk — a real design (no-steal buffer management), but one that costs memory and pins pages.
- **Thinking a checkpoint makes the older log disposable.** A checkpoint records which pages are dirty; it does not necessarily flush them all. Log segments can only be discarded once every change they describe is on disk *and* no backup or replica still needs them — Lesson 2 shows what happens when that second condition is forgotten.
- **Believing a single page write is atomic.** Storage guarantees atomicity at sector granularity, not page granularity, so a crash mid-write can leave a page half-updated with an unusable LSN. Full-page images or checksums exist specifically for this, and disabling them to save log volume trades a real corruption risk for a modest write reduction.

---

## 8. Hands-On Exercises

**Exercise 1:** Run `aries_mini.py` from Section 5 exactly as written and confirm it prints `{118: 850, 204: 500}`. Then change T42's record to a commit at LSN 4188.5 by appending `(4191, "T42", "commit", None, None, None)` and rerun — page 204 should now stay at 300, because T42 became a winner.

**Exercise 2:** Start a local database, open a transaction, run an `UPDATE` without committing, and from a second shell kill the server process with `kill -9`. Restart it and query the row. Record whether the value reverted, then find the recovery lines in the server log — most engines print how many transactions were rolled forward and rolled back.

**Exercise 3:** Repeat Exercise 2 but commit the transaction first, and kill the process within a second of the commit returning. The committed value must survive. Note that nothing you did flushed a data page — only the log fsync at commit made this true.

**Exercise 4:** Write a loop that inserts 200,000 rows in autocommit mode and time it. Then wrap the whole loop in one explicit transaction and time it again. Explain the difference purely in terms of how many log fsync calls each version forces, not in terms of row count.

**Exercise 5:** Reproduce the third mistake from Section 7. Configure a very long checkpoint interval, write heavily for two minutes, then `kill -9` the process and time the restart. Repeat with a short checkpoint interval. Chart write throughput against restart duration and identify where the tradeoff sits for your workload.

---

## 9. Interview Q&A

**Q: A database process is killed mid-transaction. What two distinct problems does recovery have to solve?**
Some committed changes exist only in the log, because the dirty data pages were still in the buffer pool when the process died — recovery has to redo those from the AFTER images. And some uncommitted changes are already in the data files, because the buffer pool evicted a dirty page before that transaction committed — recovery has to undo those from the BEFORE images. They happen simultaneously in the same crash, and the data files alone can't tell you which pages are in which state, because a page doesn't record which transaction wrote it.

**Q: Why does ARIES redo the changes of transactions it already knows will be rolled back?**
It's called repeating history: the redo pass restores the exact page state that existed at the instant of the crash, including doomed work, so the undo pass starts from a state it can reason about. If redo skipped losers, undo would have to figure out which of its BEFORE images still apply and which describe changes that never made it to disk. Repeating history removes that ambiguity entirely, and it also makes the algorithm restartable — a crash during recovery just runs the same three passes again.

**Q: What is an LSN and why does it make replay idempotent?**
An LSN is a monotonically increasing sequence number stamped on every log record, and a copy of the highest applied LSN is stored on each data page. Before redo applies a record, it compares the record's LSN against the page's stamp and skips it if the page is already at or past that point. That single check means running recovery twice — or crashing halfway through recovery and rerunning it — converges on the same state, which is what lets recovery itself be crash-safe.

**Q: What does a checkpoint actually do, and how does it bound recovery time?**
It writes a record capturing the transactions active at that moment and the dirty page table — pages modified in memory with the LSN that first dirtied each one. Recovery then begins its scan at the oldest LSN in that table instead of at the start of the log, so the amount of log to replay is bounded by how much has happened since the last checkpoint. That's a direct tradeoff: frequent checkpoints mean more steady-state I/O but a shorter outage, infrequent ones mean cheaper running and a longer restart.

**Q: What is a torn page and how do engines defend against it?**
Storage devices guarantee atomicity at sector size, typically 4 KB, but databases write pages of 8 KB or 16 KB, so a crash in the middle of a page write can leave part of the page old and part new — including a garbled page LSN, which means recovery can't even trust the stamp it uses to decide whether to replay. The standard defenses are writing a full image of each page the first time it's dirtied after a checkpoint, so recovery can restore a known-good copy before redoing, or a double-write buffer that stages the page elsewhere first. Per-page checksums are the complementary measure: they don't repair a torn page, but they make sure it's detected rather than silently served.
