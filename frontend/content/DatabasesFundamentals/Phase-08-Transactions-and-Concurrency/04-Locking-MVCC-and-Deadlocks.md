# Locking MVCC and Deadlocks — Complete Guide

> "You can book the meeting room in advance and be certain of it, or walk down at two o'clock and hope it is free — booking costs you the booking, hoping costs you the wasted trip."

---

## Table of Contents

1. [The Problem: Someone Has to Wait or Someone Has to Fail](#1-the-problem-someone-has-to-wait-or-someone-has-to-fail)
2. [The Meeting Room Booking Analogy](#2-the-meeting-room-booking-analogy)
3. [The Mechanism: Shared and Exclusive Locks under Two-Phase Locking](#3-the-mechanism-shared-and-exclusive-locks-under-two-phase-locking)
4. [Diagram: How a Deadlock Cycle Forms](#4-diagram-how-a-deadlock-cycle-forms)
5. [Code Walkthrough: MVCC Snapshots and Version Chains](#5-code-walkthrough-mvcc-snapshots-and-version-chains)
6. [Comparing Pessimistic Locking to MVCC](#6-comparing-pessimistic-locking-to-mvcc)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Someone Has to Wait or Someone Has to Fail

Lesson 3 named the guarantees. This lesson is about the two families of machinery that deliver them, and there are only two, because there are only two ways to stop a collision.

### The Only Two Strategies

```text
Pessimistic → conflict is likely: lock the row first, and anyone else
              who wants it waits
              cost: waiting, and the chance of waiting forever
Optimistic  → conflict is unlikely: everyone proceeds on their own
              version of the data and it is sorted out later
              cost: discarded work, and old versions piling up
```

### What's Missing

Neither strategy is a refinement of the other; they trade the same currency in opposite directions. What is missing so far is the detail of how each one is actually built — which locks exist and in what order they are taken, or which versions exist and which ones a given transaction is allowed to see.

---

## 2. The Meeting Room Booking Analogy

Booking the room means putting a claim on it in advance: you are certain to get it, and everyone else who wanted that hour is now blocked whether or not you actually show up. Walking down at two o'clock costs nothing until it fails, and when it fails you have wasted the walk and have to find another slot.

### Booking Versus Turning Up

```text
Booking in advance → certainty, at the price of holding the room out of
                     everyone else's reach for the whole booked window
Turning up         → no overhead at all while the building is quiet, but
                     in a busy week, wasted trips and a meeting that
                     keeps getting rescheduled
```

### Mapping the Analogy to Locking and MVCC

The booking is a lock: acquired up front, held until you are finished, and blocking to everyone else for that whole time. Turning up is optimistic concurrency: no coordination cost until two people want the same hour, at which point one of them is turned away and has to start again. Which is cheaper depends entirely on how often the room is contended.

---

## 3. The Mechanism: Shared and Exclusive Locks under Two-Phase Locking

A lock is a claim on a data item held in one of two basic modes, recorded by a lock manager that answers one question: given what is already held, may this request proceed?

### Shared and Exclusive Modes

```text
              request S   request X
   held S        grant       wait
   held X        wait        wait

S (shared) is taken to read and any number coexist; X (exclusive) is
taken to write and is incompatible with everything. Readers never
block readers, and every other combination blocks.
```

```sql
-- Illustrative standard SQL: take the lock explicitly at read time
SELECT on_hand FROM inventory WHERE sku = 'KB-87' FOR UPDATE;  -- X
SELECT on_hand FROM inventory WHERE sku = 'KB-87' FOR SHARE;   -- S
```

### Granularity and Intent Locks

```text
Row   → most concurrency; one lock entry per row, so scanning 200,000
        rows means 200,000 entries in the lock manager
Page  → one entry per stored page; cheaper, but blocks unrelated rows
        that happen to be neighbours
Table → one entry, near-zero overhead, no concurrent writers at all
  ↳ Intent locks answer "does anyone hold a row lock under me?". Before
    locking a row a transaction takes IS or IX on the table, so a later
    table-level X sees the IX at once instead of scanning every row.
```

### Two-Phase Locking and Why It Serializes

```text
Growing phase   → locks may be acquired, none released
Shrinking phase → locks may be released, none acquired; the switch
                  happens once and is irreversible

Why that serializes: each transaction has one "lock point", the instant
it takes its last lock. Conflicting transactions must order ALL of their
conflicts by which reached its lock point first, so ordering them by
lock point yields an equivalent serial schedule.
  ↳ Strict 2PL also holds every X lock until COMMIT, so nobody reads a
    value that may still be rolled back — no cascading aborts.
```

---

## 4. Diagram: How a Deadlock Cycle Forms

### Two Transfers in Opposite Directions

```text
   T1 (1001 → 1002)                  T2 (1002 → 1001)
   ─────────────────────────────────────────────────────────────
   t1  UPDATE ... id=1001 → X on 1001
   t2                                UPDATE ... id=1002 → X on 1002
   t3  UPDATE ... id=1002 → waits for T2
   t4                                UPDATE ... id=1001 → waits for T1

   wait-for graph
        ┌──── needs 1002, held by T2 ────┐
        │                                ▼
     ┌──┴───┐                        ┌──────┐
     │  T1  │◄─── needs 1001 ────────┤  T2  │
     └──────┘      held by T1        └──────┘
```

### Reading the Diagram

The graph has a cycle, and a cycle is the definition of a deadlock: every member is waiting on a lock that only another member can release, so no amount of patience resolves it. Nothing about either transaction is wrong in isolation — the bug is that they acquired the same two rows in opposite orders.

```text
Detection → build the wait-for graph, find the cycle, abort a victim.
            Precise, and reports a clear error to exactly one session.
Timeout   → no graph; any wait longer than N seconds is aborted. Simple,
            but it kills innocent slow waiters and reacts only after N.
Victim    → the cheapest transaction to undo: fewest locks held, least
            log written, or most recently started. It gets a deadlock
            error and MUST be retried; the survivor notices nothing.
```

---

## 5. Code Walkthrough: MVCC Snapshots and Version Chains

Multi-version concurrency control never overwrites a row in place while an older reader might still need it. An update writes a new version and leaves the previous one reachable.

### A Row's Version Chain

```text
inventory row sku='KB-87', after three committed updates:
  version   on_hand   created by   removed by
  ────────────────────────────────────────────
  v3        10        txn 812      —
  v2        11        txn 807      txn 812
  v1        12        txn 790      txn 807
  ↳ Every version is a physical row; the engine picks which one you see.
```

### Reading a Snapshot

```text
A snapshot is the set of transactions already committed when this one
started — or when its statement started, at READ COMMITTED. A version
is visible when created-by committed before the snapshot AND removed-by
is either empty or had not committed by then.

  txn 815, snapshot taken before 812 committed → sees v2 (11)
  txn 820, snapshot taken after  812 committed → sees v3 (10)
  ↳ Neither reader waits and neither blocks 812's write: readers do not
    block writers and writers do not block readers. Two writers do.
```

### The Garbage Versions Leave Behind

```text
START TRANSACTION;                       -- snapshot taken here
  SELECT SUM(total_amount) FROM orders;  -- 40-minute report
  -- the session then sits idle with the transaction still open

Every version created after that snapshot must be retained, in case
this transaction still needs the older one.
  ↳ Dead versions accumulate, indexes grow to cover them, and scans read
    pages holding nothing visible. Cleanup can only reclaim what the
    oldest live snapshot no longer needs, so ONE forgotten open
    transaction bloats the entire table.
```

---

## 6. Comparing Pessimistic Locking to MVCC

Both deliver isolation; they differ in who waits, who fails, and what has to be cleaned up afterwards.

### Pessimistic Locking vs MVCC

| | Pessimistic locking | MVCC |
|---|---|---|
| Reader meets writer | One of them waits | Neither waits; the reader sees an older version |
| Writer meets writer on one row | Second writer waits | Second writer waits or aborts on conflict |
| Failure mode | Lock waits, and deadlocks that need a retry | Serialization conflicts and retries under strict levels |
| Space cost | Lock manager entries, proportional to rows touched | Old row versions, proportional to update rate and to the oldest open snapshot |
| Long read transaction | Blocks writers for its whole duration | Blocks nobody, but pins versions and prevents cleanup |

### Takeaway

The honest comparison is that MVCC moves the cost rather than removing it. It genuinely eliminates the reader-writer conflict, which is the most common conflict in most workloads, and that is a real win. In exchange, a long-running or forgotten transaction now damages the whole table's storage instead of blocking one writer, and the damage is silent — no session is waiting, no error is raised, and the first symptom is a table that has quietly grown several times larger than its live data. Neither strategy removes writer-writer conflicts, and neither removes the need to retry.

---

## 7. Common Mistakes

- **Acquiring the same rows in different orders in different code paths.** This is the direct cause of the cycle in Section 4, and it is entirely preventable: sort the identifiers before locking so that every transaction touching accounts 1001 and 1002 takes 1001 first, whichever direction the transfer runs. A consistent global order makes a cycle impossible rather than merely unlikely.
- **Keeping a transaction open across user interaction or a remote call.** A confirmation dialog or a payment-provider API call inside a transaction holds locks and pins snapshots for as long as a human or a network takes. Read what you need, close the transaction, do the slow thing, then reopen a short transaction to write.
- **Treating a deadlock error as an outage.** Deadlocks are expected under concurrency and the engine has already resolved this one by rolling a victim back. The correct handling is a bounded retry with a small backoff; the incorrect handling is an alert, a manual restart, or code that surfaces the raw error to a user.

---

## 8. Hands-On Exercises

**Exercise 1:** In session A, `SELECT ... FOR UPDATE` a single inventory row inside an open transaction. In session B, run a plain `SELECT` on the same row, then a `SELECT ... FOR UPDATE`, and record which one waits and which returns immediately.

**Exercise 2:** Reproduce the deadlock from Section 4 exactly: two sessions updating accounts 1001 and 1002 in opposite orders. Record which session receives the error, what the error says, and confirm the other session commits normally.

**Exercise 3:** Fix Exercise 2 by sorting the two account identifiers ascending in both code paths before issuing any update, then run the same interleaving again and confirm no deadlock occurs.

**Exercise 4:** Reproduce the mistake from Section 7 by opening a transaction, running a `SELECT`, and leaving it open while another session updates the same table several thousand times. Then measure the table's on-disk size before and after committing the idle transaction and letting cleanup run.

**Exercise 5:** Using two sessions, demonstrate that a reader is not blocked by a writer under MVCC: begin a transaction in session A and read a row, update and commit that row in session B, and confirm session A still sees the value from its own snapshot until it commits.

---

## 9. Interview Q&A

**Q: What is two-phase locking and why does it produce serializability?**
Two-phase locking splits a transaction into a growing phase where it may only acquire locks and a shrinking phase where it may only release them, with a single irreversible switch between them. Because of that split, every transaction has a lock point — the moment it takes its last lock — and any two conflicting transactions must order all of their conflicts the same way as their lock points. Ordering transactions by lock point therefore gives an equivalent serial schedule, which is exactly what serializability requires. Strict two-phase locking goes further and holds exclusive locks until commit, which also prevents other transactions from reading data that might still be rolled back.

**Q: What are intent locks for?**
They answer a hierarchy question cheaply. If a transaction wants an exclusive lock on a whole table, it needs to know whether anyone holds a row lock underneath, and checking that by examining every row would be far too slow. So before taking a row-level lock, a transaction takes an intent lock on the table, and the table-level request only has to check that one entry to discover the conflict.

**Q: What does MVCC actually give you, and what does it cost?**
It gives you reads that never block writes and writes that never block reads, because a writer creates a new version instead of overwriting and each reader is served the version visible in its own snapshot. The cost is that old versions must be kept alive as long as any snapshot could still need them, so the storage grows with the update rate and cleanup can only reclaim versions older than the oldest open transaction. That makes a single long-running or forgotten transaction unusually expensive: it silently pins garbage across the whole table, and the symptom is size and scan cost rather than a visible wait.

**Q: How does a deadlock form, and how do engines resolve it?**
A deadlock is a cycle in the wait-for graph — T1 waits on a lock T2 holds while T2 waits on a lock T1 holds — and it usually comes from two code paths acquiring the same rows in different orders. Engines resolve it either by detection, building the wait-for graph and aborting a victim chosen to be cheapest to undo, or by timeout, aborting any lock wait longer than a threshold. Detection is precise and fast; timeout is simpler but kills innocent slow waiters and takes the full timeout to react. Either way the victim gets an error and the application has to retry it.

**Q: How do you prevent deadlocks in application code?**
The main rule is a consistent lock ordering: decide a global order, such as ascending primary key, and acquire in that order everywhere, which makes a cycle structurally impossible. Beyond that, keep transactions short so the window for overlap is small, never hold a transaction open across user interaction or a remote API call, and touch the smallest set of rows the work actually requires. Since none of that removes deadlocks entirely under real concurrency, every write path still needs a bounded retry with a short backoff.
