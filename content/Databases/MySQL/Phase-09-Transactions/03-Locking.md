# Locking in MySQL — Complete Guide

## Table of Contents
1. [Why Locking?](#1-why-locking)
2. [Lock Types](#2-lock-types)
3. [Row-Level Locking](#3-row-level-locking)
4. [SELECT FOR UPDATE and FOR SHARE](#4-select-for-update-and-for-share)
5. [Gap Locks and Next-Key Locks](#5-gap-locks-and-next-key-locks)
6. [Deadlocks](#6-deadlocks)
7. [Monitoring Locks](#7-monitoring-locks)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Locking?

Picture this: two people are looking at the same bank account balance at the exact same moment.

```
T1: read balance (500), think "enough for 400 withdrawal"
T2: read balance (500), think "enough for 300 withdrawal"
T1: write balance - 400 = 100
T2: write balance - 300 = 200  ← overwrites T1! Balance should be -200 but shows 200
```

Both transactions read the same starting number. Both do their own math. Both write back a result — and the second write silently erases the first one. The account should be overdrawn by 200, but MySQL shows 200 sitting happily in the account. That's a **lost update**, and it's exactly the kind of bug that doesn't show up in testing but absolutely shows up in production, on payday, with real money.

The isolation levels covered in the previous file (`02-Transactions-Isolation.md`) describe *what* guarantees you get (repeatable reads, no dirty reads, and so on). Locking is *how* MySQL actually delivers those guarantees under the hood. Isolation is the promise; locking is the mechanism that keeps the promise.

So what's the fix? Simple in concept: when T1 is in the middle of modifying a row, make T2 **wait** instead of letting it barge in. That's all locking really is — a queue of one.

---

## 2. Lock Types

### A quick analogy first

Think of a shared meeting-room booking calendar. Anyone can *look* at the calendar at the same time — that's fine, nobody's changing anything just by reading it. But when someone wants to actually *book* a slot, you don't want two people booking the same slot simultaneously. Only one person gets to hold the pen at a time.

That's the entire idea behind shared vs. exclusive locks. Reading (peeking at the calendar) can happen concurrently. Writing (booking a slot) cannot.

### Shared (S) Lock — Readers

Multiple transactions can hold shared locks on the same row simultaneously. Everyone's just looking.

```
T1 holds S lock on row 5 → T2 can also acquire S lock on row 5 ✅
T1 holds S lock on row 5 → T2 cannot acquire X lock on row 5 ❌ (must wait)
```

### Exclusive (X) Lock — Writers

Only one transaction can hold an exclusive lock on a row at a time. This is "I'm booking this slot, nobody else touches it until I'm done."

```
T1 holds X lock on row 5 → T2 cannot acquire S or X lock on row 5 ❌ (must wait)
```

### Intention Locks (Table-Level)

Here's a practical problem: if T1 wants to lock the *entire table*, how does it check whether some other transaction already has a row locked somewhere inside it — without scanning every single row?

That's what intention locks solve. Before acquiring a row lock, InnoDB first sets an intention lock at the table level, essentially posting a note that says "heads up, I'm about to lock some rows in here." Other transactions can check this one table-level flag instead of scanning every row.

| Lock | Meaning |
|------|---------|
| IS (Intention Shared) | Transaction intends to acquire S locks on rows |
| IX (Intention Exclusive) | Transaction intends to acquire X locks on rows |

### Lock Compatibility Matrix

Here's the cheat sheet for which locks can coexist:

```
        IS    IX    S     X
IS      ✅    ✅    ✅    ❌
IX      ✅    ✅    ❌    ❌
S       ✅    ❌    ✅    ❌
X       ❌    ❌    ❌    ❌
```

Read it as: find the lock you already hold on the left, find the lock being requested on top, and the cell tells you if it's allowed. Notice X is a hard "no" across the entire row — once you're writing, nothing else gets in.

---

## 3. Row-Level Locking

You never actually have to write `LOCK` in most everyday SQL — it happens automatically. InnoDB uses row-level locking by default, which is a big deal: it means two transactions modifying *different* rows in the same table don't block each other at all. (Compare that to MyISAM's old table-level locking, where any write locks the *entire table* — brutal for concurrency.)

```sql
-- DML automatically acquires appropriate locks:
UPDATE orders SET status = 'shipped' WHERE id = 100;
-- → acquires X lock on row 100 automatically
-- → other transactions wait if they try to modify row 100
-- → released on COMMIT or ROLLBACK
```

Notice that last line: released on **COMMIT or ROLLBACK** — not the moment the statement finishes. Keep that in mind; it matters a lot in the "common mistakes" section below.

---

## 4. SELECT FOR UPDATE and FOR SHARE

Sometimes automatic locking isn't enough — you want to explicitly grab a lock *while reading*, before you've written anything, because you know you're about to make a decision based on that read.

```sql
-- Acquire exclusive lock (no one else can read or write until you commit)
SELECT * FROM accounts WHERE id = 'alice' FOR UPDATE;
-- Use when: you plan to update the row based on what you read

-- Acquire shared lock (others can read but not write)
SELECT * FROM accounts WHERE id = 'alice' FOR SHARE;
-- (Old syntax: LOCK IN SHARE MODE)
-- Use when: you need to read and ensure row doesn't change while you work
```

Let's connect this back to the opening scenario — the lost-update bug. Here's how `FOR UPDATE` actually prevents it:

```sql
-- Example: safe balance check + debit
START TRANSACTION;
SELECT balance FROM accounts WHERE id = 'alice' FOR UPDATE;
-- Alice's row is now X-locked — no other transaction can modify it
UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';
COMMIT;
```

The moment the `SELECT ... FOR UPDATE` runs, Alice's row gets an X lock. If a second transaction tries the same thing at the same time, it simply waits its turn — no more racing to read the same stale number.

---

## 5. Gap Locks and Next-Key Locks

This is one of the trickiest — and most commonly misunderstood — parts of MySQL locking, so let's slow down here.

**The problem it solves:** locking an existing row is easy to picture — you're putting a padlock on something that's already there. But what about rows that *don't exist yet*? Under REPEATABLE READ, if a transaction runs the same range query twice, it should see the same rows both times — including not suddenly seeing a brand-new row that someone else inserted in between (a "phantom read"). You can't put a padlock on a row that doesn't exist. So MySQL locks the *space* instead.

### Record Lock

The simple case: locks a single index record (a row that already exists).

### Gap Lock

Locks a **gap between index values** — not a row, but the empty space between two rows — so that nobody can insert a new row into that range while you're looking at it.

```sql
-- If table has rows with id: 1, 5, 10, 20
SELECT * FROM t WHERE id BETWEEN 5 AND 10 FOR UPDATE;
-- Record locks: rows 5 and 10
-- Gap locks: gaps (5,10) — no new row with id 6,7,8,9 can be inserted
```

### Next-Key Lock

In practice, InnoDB almost always combines the two: a next-key lock = record lock + the gap lock immediately before that record. This combined form is InnoDB's default locking granularity for range scans under REPEATABLE READ.

```
Index values: 1, 5, 10, 20
Next-key locks for range [5,10]:
  (-∞, 1] gap + record 1
  (1, 5]  gap + record 5
  (5, 10] gap + record 10   ← locked
```

Read that diagram as a sequence of "gap, then the record right after it" pairs marching along the index. For the query above, the range `[5,10]` ends up covered by the `(5, 10]` next-key lock — gap and record locked together, in one unit.

One more thing worth remembering: gap locks are specific to REPEATABLE READ. If you drop down to READ COMMITTED isolation, gap locks are effectively disabled — you trade phantom-read protection for less locking overhead and fewer surprise waits.

---

## 6. Deadlocks

This is the other trickiest concept in this file, so let's build it up carefully.

**The scenario:** two transactions, each holding a lock the other one needs, each waiting for the other to let go. Neither can ever proceed — because neither is willing (or able) to give up what it's holding. That's a deadlock.

### What it looks like, step by step

```
Timeline:
T1: acquires X lock on row A (orders row 1)
T2: acquires X lock on row B (orders row 2)
T1: tries to acquire X lock on row B → WAITS for T2
T2: tries to acquire X lock on row A → WAITS for T1
→ DEADLOCK! Neither can proceed.
```

Here's that same standoff drawn out as a picture — two transactions, each holding what the other wants:

```
        holds X lock on A                holds X lock on B
   ┌───────────────────┐            ┌───────────────────┐
   │        T1          │            │        T2          │
   └─────────┬──────────┘            └─────────┬──────────┘
             │                                  │
             │  wants X lock on B               │  wants X lock on A
             └───────────────►  B          A  ◄─┘
                            (held by T2)  (held by T1)

             T1 waits on T2 .... T2 waits on T1
                        (circular wait)
```

MySQL isn't going to just let both transactions sit there forever. InnoDB runs a **deadlock detector** in the background that watches these wait-for relationships. The moment it spots a cycle like the one above, it steps in and picks a **victim** — generally the transaction that's done less work (cheaper to throw away) — and forcibly rolls it back. That releases its locks, which lets the other transaction finally proceed.

```
InnoDB automatically detects this cycle and kills the transaction with
less work (the smaller transaction) with error:
"ERROR 1213: Deadlock found when trying to get lock; try restarting transaction"
```

The losing transaction doesn't just hang forever — it gets an explicit error back, so the application knows to retry.

### Deadlock Example

Here's the same scenario playing out concretely with two named accounts:

```sql
-- Session 1:
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';  -- locks alice
-- (pause)
UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';    -- waits for bob

-- Session 2 (simultaneously):
START TRANSACTION;
UPDATE accounts SET balance = balance - 50 WHERE id = 'bob';     -- locks bob
UPDATE accounts SET balance = balance + 50 WHERE id = 'alice';   -- waits for alice
-- DEADLOCK → one session gets Error 1213
```

Session 1 locked alice first and wants bob next. Session 2 locked bob first and wants alice next. Two arrows pointing at each other — that's the picture above, playing out for real.

### Deadlock Prevention

If deadlocks are a circular wait, the fix is simply: don't let a circle form.

```sql
-- 1. Always lock resources in the same order
-- (both transactions: alice first, then bob)

-- 2. Keep transactions short and fast

-- 3. Use SELECT ... FOR UPDATE to acquire all locks upfront
START TRANSACTION;
SELECT * FROM accounts WHERE id IN ('alice', 'bob') ORDER BY id FOR UPDATE;
-- Both rows locked in consistent order → no deadlock

-- 4. Retry on deadlock (application code)
-- Catch ER_LOCK_DEADLOCK (1213) and retry the transaction
```

Notice strategy #1 and #3 are really the same idea: if *every* transaction always locks alice before bob (alphabetical, by primary key, whatever consistent rule you pick), nobody can ever end up holding bob while waiting for alice, because nobody ever grabs bob first. No circle, no deadlock — the ordering rule breaks the cycle before it can form.

---

## 7. Monitoring Locks

Sometimes you don't need to prevent a deadlock — you need to *investigate* one that already happened, or figure out why a query has been sitting there for 30 seconds.

```sql
-- See current locks and waiting transactions
SELECT * FROM performance_schema.data_locks;
SELECT * FROM performance_schema.data_lock_waits;

-- Find blocking transactions
SELECT
  r.trx_id waiting_trx,
  r.trx_query waiting_query,
  b.trx_id blocking_trx,
  b.trx_query blocking_query
FROM information_schema.innodb_lock_waits w
JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id;

-- Last deadlock info (shows full deadlock trace)
SHOW ENGINE INNODB STATUS\G
-- Look for: LATEST DETECTED DEADLOCK section
```

That last query is especially useful: it directly tells you who's blocking whom, right now, so you're not guessing.

---

## Common Mistakes and Confusions

A couple of things trip people up over and over with MySQL locking:

- **Forgetting that an open transaction holds its locks until COMMIT or ROLLBACK — not until the statement finishes.** It's easy to picture a lock being released the instant the `UPDATE` statement returns. It isn't. If you `START TRANSACTION`, run an `UPDATE`, and then go do something slow — call an external API, wait on user input, whatever — that row stays locked the entire time. Every other transaction that wants that row queues up behind you. This is the single most common cause of "why is my app suddenly frozen" incidents: one long-running transaction quietly blocking a dozen others.
- **Not understanding gap locks under REPEATABLE READ.** People expect InnoDB to only ever lock rows that exist. Gap locks and next-key locks break that assumption on purpose — they lock the *space between* rows too, specifically so a concurrent transaction can't sneak a phantom row into a range you're working with. If you've ever seen an `INSERT` mysteriously blocked even though the exact row it's inserting doesn't exist yet, this is almost always why.
- **Mixing up "shared vs exclusive" with "row-level vs table-level."** These are two independent axes, not the same distinction. Shared/exclusive is about *what kind* of access you're requesting (read vs. write). Row-level/table-level is about *how much* of the table that lock covers. You can have a shared lock on one row, or an exclusive lock on an entire table — the two ideas combine.

### Compare with Related Concepts

| Concept | vs. | Key difference |
|---|---|---|
| Shared (S) lock | Exclusive (X) lock | S allows many concurrent readers; X allows exactly one writer and blocks everyone else |
| Row-level locking | Table-level locking | Row-level (InnoDB default) only blocks the specific rows touched; table-level (MyISAM) blocks the whole table for any write |
| Record lock | Gap lock | Record lock protects an existing row; gap lock protects the empty space between rows, blocking inserts |
| Next-key lock | Plain record lock | Next-key lock = record lock + the gap before it; it's what stops phantom reads under REPEATABLE READ |
| Pessimistic locking (`FOR UPDATE`) | Optimistic locking (version column check) | Pessimistic locks the row immediately, assuming conflict is likely; optimistic reads without locking and checks a version/timestamp at write time, assuming conflict is rare |

---

## Interview Answer

If you only remember one paragraph on this whole topic, make it this one: "MySQL's InnoDB engine uses row-level locking to let concurrent transactions modify different rows in the same table without blocking each other. Shared locks allow multiple concurrent readers, while exclusive locks allow only one writer and block all other access to that row until COMMIT or ROLLBACK. To prevent phantom reads under REPEATABLE READ, InnoDB adds gap locks and next-key locks, which lock the space between index values, not just the rows themselves. When two transactions each hold a lock the other needs, InnoDB's deadlock detector spots the circular wait and rolls back the cheaper transaction, returning error 1213 so the application can retry. The way to avoid deadlocks in the first place is to always acquire locks in the same order and keep transactions short."

> **Memory hook:** Shared locks are "many people can peek at the calendar"; exclusive locks are "only one person holds the pen to book a slot." A deadlock is two people each holding the pen the other one needs — and MySQL's detector is the referee that takes one pen away so the meeting can go on.

---

## 8. Hands-On Exercises

**Exercise 1:** Open two sessions. Session 1: START TRANSACTION; SELECT * FROM orders WHERE id=1 FOR UPDATE. Session 2: try to UPDATE orders WHERE id=1 — observe it waits. Session 1 COMMITs — Session 2 proceeds.

**Exercise 2:** Create a deadlock intentionally (two sessions updating same rows in opposite order). Observe MySQL's 1213 error and which session wins.

**Exercise 3:** Use `SHOW ENGINE INNODB STATUS\G` after creating a deadlock. Read the LATEST DETECTED DEADLOCK section — identify which transactions were involved.

**Exercise 4:** Fix the deadlock from exercise 2 by ensuring both sessions acquire locks in the same order.

**Exercise 5:** Use `SELECT ... FOR UPDATE` in a transaction to safely check and deduct inventory (no overselling).

---

## 9. Interview Q&A

**Q: What is the difference between a shared lock and an exclusive lock?**
Answer: A shared (S) lock is for reading — multiple transactions can hold shared locks on the same row simultaneously. An exclusive (X) lock is for writing — only one transaction can hold it, and it blocks all other locks on that row. DML statements (UPDATE/DELETE) automatically acquire X locks; SELECT FOR UPDATE explicitly acquires X locks.

**Q: What is a deadlock and how does MySQL handle it?**
Answer: A deadlock occurs when two transactions each hold a lock that the other needs, creating a circular wait. Neither can proceed. InnoDB automatically detects the cycle and kills the transaction with less work, rolling it back and returning error 1213. The other transaction then acquires the released lock and continues.

**Q: What is a gap lock?**
Answer: A gap lock locks the space between index values to prevent inserts into that range. Under REPEATABLE READ, if you query WHERE id BETWEEN 5 AND 10, MySQL places gap locks to prevent other transactions from inserting id 6,7,8,9 — this prevents phantom reads. Gap locks don't apply under READ COMMITTED isolation.

**Q: What is SELECT FOR UPDATE and when should you use it?**
Answer: SELECT FOR UPDATE acquires an exclusive lock on selected rows immediately, before you've modified them. Use it when you read a value and then make a decision to update it — this prevents another transaction from changing the row between your read and write. Without it, you risk lost updates.

**Q: How do you prevent deadlocks?**
Answer: Key strategies: (1) Always acquire locks in a consistent order across transactions, (2) Keep transactions as short as possible, (3) Use SELECT FOR UPDATE to acquire all needed locks at the start rather than incrementally, (4) In application code, catch error 1213 and retry the transaction with exponential backoff.
</content>
