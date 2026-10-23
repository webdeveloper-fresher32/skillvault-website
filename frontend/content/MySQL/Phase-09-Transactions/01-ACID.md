# ACID Properties — MySQL Complete Guide

## Table of Contents
1. [What is ACID?](#1-what-is-acid)
2. [Atomicity](#2-atomicity)
3. [Consistency](#3-consistency)
4. [Isolation](#4-isolation)
5. [Durability](#5-durability)
6. [InnoDB Implementation](#6-innodb-implementation)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is ACID?

Picture this: a bank transfer app moves $100 from Alice's account to Bob's. Halfway through — after debiting Alice, before crediting Bob — the server crashes. The $100 is gone from Alice's account and never arrived in Bob's. Where did it go?

That single scenario is the reason ACID exists. ACID is a set of four guarantees MySQL (through the InnoDB storage engine) makes about every transaction, so situations like the one above simply can't happen — even when the power goes out, the network drops, or a thousand transactions are running at the same time.

```
A — Atomicity    → All or nothing
C — Consistency  → Rules are always enforced
I — Isolation    → Concurrent transactions don't see each other's partial work
D — Durability   → Committed data survives crashes
```

We'll use this bank transfer as the running example for every property below — because each of ACID's four letters is really just a different answer to "what could go wrong with this transfer, and how do we stop it?"

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';
UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';
COMMIT;
```

Without ACID, the server could crash between the two UPDATEs — Alice loses $100, Bob gets nothing.

Here's how the four properties map onto this exact scenario — keep this table in your back pocket, because we'll unpack each row in detail below:

| Property | What it guarantees for the transfer | What breaks without it |
|---|---|---|
| **Atomicity** | Either both UPDATEs happen, or neither does | Alice loses $100, Bob never receives it |
| **Consistency** | The transfer can never leave a balance negative or break a constraint | Corrupted, rule-violating data (e.g. balance < 0) |
| **Isolation** | A concurrent transaction never sees Alice's balance mid-debit | Another transaction reads a "half-applied" balance and acts on it |
| **Durability** | Once COMMIT returns, the transfer survives a crash a millisecond later | A confirmed transfer silently vanishes on restart |

---

## 2. Atomicity

**What problem does this solve?**

Back to the transfer. `UPDATE ... balance - 100` on Alice succeeds. Then, right before the second `UPDATE ... balance + 100` on Bob runs, the server crashes, the disk fills up, or the connection drops. Alice is now down $100 and Bob has nothing — the money has vanished into thin air. Multiply that across every transaction a bank ever runs, and you've got a system that slowly leaks money. Atomicity exists purely to make this impossible.

**Real-world analogy**

Think of a wire transfer form with two boxes: "take from" and "give to." A bank teller doesn't treat the two boxes as independent actions that can each succeed or fail on their own — they process the whole slip as one unit. Either the whole slip goes through, or the teller tears it up and nothing happens. There's no such thing as "half a transfer" at the counter, and there shouldn't be in the database either.

**Basic definition**

Atomicity means a transaction is treated as a single, indivisible unit of work: **all** of its operations succeed and are committed, or **none** of them are applied — even if some of them technically "worked" before a later step failed.

**Internal working — how InnoDB actually pulls this off**

```
Transfer: debit Alice (-100) + credit Bob (+100)

Success:  Both succeed → COMMIT → both changes permanent
Failure:  Either fails → ROLLBACK → neither change applies

┌──────────────────────────────────────────────────────┐
│ START TRANSACTION                                    │
│   UPDATE accounts SET balance = balance - 100 ...   │ ✅
│   UPDATE accounts SET balance = balance + 100 ...   │ ❌ FAILS
│ ROLLBACK  ← automatic if error, or manual           │
└──────────────────────────────────────────────────────┘
Alice's balance: unchanged. Bob's balance: unchanged. ✅
```

So how does MySQL "undo" a change that already physically happened? It doesn't magically forget — it keeps a receipt:

- **Undo log**: before InnoDB modifies a row, it first writes that row's *original* value to the undo log — a record of "what this row looked like before I touched it."
- **On ROLLBACK**: InnoDB reads the undo log and reapplies the old values, unwinding every change the transaction made.
- **On a mid-transaction crash**: when MySQL restarts, it sees the transaction was never committed, and uses that same undo log to reverse whatever partial changes had already made it to disk.

**Example**

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';
-- suppose this next statement fails (e.g. Bob's account doesn't exist)
UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';
ROLLBACK;  -- Alice's -100 is undone too — she's back to her original balance
```

**Common mistakes/confusions**

- **Confusing Atomicity with Isolation.** Atomicity is about a *single* transaction's own steps succeeding or failing together. Isolation (below) is about what a *different, concurrent* transaction is allowed to see while that first one is in progress. They sound similar but answer completely different questions.
- **Assuming every statement is automatically wrapped safely.** With `autocommit` on (MySQL's default), every statement you don't explicitly wrap in `START TRANSACTION` is its own separate mini-transaction. Run two UPDATEs back to back without wrapping them, and there's no atomicity *between* them — the first can succeed and the second can still fail independently, landing you right back in the "Alice loses money" scenario.

**Interview answer**

Atomicity means a transaction is treated as a single unit — either all its operations succeed and are committed, or none of them are applied. If any statement fails, the entire transaction is rolled back. InnoDB uses the undo log to reverse changes on rollback.

> **Memory hook:** A transaction is a single slip at the bank counter — the teller never processes half of it.

---

## 3. Consistency

**What problem does this solve?**

Atomicity guarantees both halves of the transfer either happen or don't — but it says nothing about whether the *result* makes sense. Say Alice only has $500 and the transfer tries to move $1000. Atomicity would happily let both UPDATEs run: Alice's balance becomes -$500, Bob's goes up. Both statements technically "succeeded." But a negative bank balance is nonsense — and closing that gap is exactly Consistency's job.

**Real-world analogy**

Think of Consistency as the terms and conditions printed on that same wire transfer slip: "you cannot send more than you have." The teller doesn't just check that both boxes are filled in — they check the *rules* are satisfied before the slip is allowed through at all.

**Basic definition**

A transaction must bring the database from one valid state to another valid state. Every constraint, trigger, and business rule must hold true at the end of the transaction — if it doesn't, the transaction cannot be committed.

**Example**

```sql
-- Consistency example: account balance can't go negative
CREATE TABLE accounts (
  id      VARCHAR(20) PRIMARY KEY,
  balance DECIMAL(10,2) NOT NULL CHECK (balance >= 0)
);

START TRANSACTION;
UPDATE accounts SET balance = balance - 1000 WHERE id = 'alice';
-- If alice.balance = 500, this would make it -500 → violates CHECK
-- MySQL raises an error → transaction is invalid → must ROLLBACK
```

**What enforces consistency:**
- NOT NULL, UNIQUE, CHECK constraints
- FOREIGN KEY referential integrity
- Triggers that fire on data changes
- Application-level business rules within the transaction

**Interview answer**

Consistency ensures every transaction brings the database from one valid state to another. All constraints (NOT NULL, UNIQUE, FK, CHECK), triggers, and application rules must hold at the end of every transaction. A transaction violating any constraint will be rejected.

> **Memory hook:** Atomicity asks "did both halves run?" — Consistency asks "does the result actually make sense?"

---

## 4. Isolation

**What problem does this solve?**

Suppose Atomicity and Consistency are both doing their job — but now a *second* transaction reads Alice's balance at the exact moment the transfer is halfway through: debited, but not yet credited to Bob. If that second transaction sees the temporarily "wrong" $400 and acts on it — say, approves a withdrawal because "she still has money" — you get a race condition instead of a crash. Isolation stops concurrent transactions from stepping on each other's half-finished work.

**Real-world analogy**

Two tellers at two windows, both touching Alice's account at the same moment. Isolation is the rule that each teller only ever sees a "complete" version of Alice's balance — never a snapshot taken mid-transfer by the other teller.

**Basic definition**

Concurrent transactions must not see each other's partial, uncommitted work. Depending on the isolation level, a transaction sees either the state before another transaction started, or its state after it fully committed — never something in between.

```
Timeline with two concurrent transactions:

T1: START → read Alice balance (500) → update (-100) → ... → COMMIT
T2: START →          read Alice balance (?)          → COMMIT

Without isolation: T2 might see 400 (Alice's balance mid-update)
With isolation:    T2 sees either 500 (before T1) or 400 (after T1)
                   — never a half-applied state
```

**How InnoDB implements Isolation:**
- **MVCC (Multi-Version Concurrency Control)**: Each transaction gets a snapshot of the data as it was at transaction start
- Readers don't block writers; writers don't block readers
- Different isolation levels control how "fresh" that snapshot is — the next file digs into this in depth

**Interview answer**

MVCC (Multi-Version Concurrency Control) means InnoDB keeps multiple versions of rows. Each transaction reads a snapshot of data as it existed at transaction start. This allows readers and writers to operate concurrently without blocking each other — readers see a consistent view even while writers modify data.

> **Memory hook:** Isolation is two tellers at two windows — neither ever sees the other's transfer half-done.

---

## 5. Durability

**What problem does this solve?**

The transfer completes. MySQL returns "COMMIT successful." The app shows Alice and Bob a confirmation. One second later, the server loses power. When it comes back up — is the transfer still there, or did it evaporate along with whatever was sitting in RAM? If a confirmed transaction can vanish because of a crash, nobody can trust that a COMMIT means anything. Durability is the guarantee that once you've been told "yes, it's saved," it actually, permanently is.

**Real-world analogy**

It's the difference between a teller saying "done!" while the transfer is still scribbled in pencil on a sticky note — one gust of wind and it's gone — versus the teller only saying "done!" after the transfer has been stamped and filed in a fireproof vault. Durability is that fireproof vault.

**Basic definition**

Once a COMMIT is issued and acknowledged, the transaction's changes are permanently saved — they survive a crash, a power outage, or a restart, even if that crash happens the instant after COMMIT returns.

**Internal working — how InnoDB actually pulls this off**

```
Without Durability:
  COMMIT → data in RAM → server crashes → data lost!

With Durability (InnoDB):
  COMMIT → data written to redo log (disk) → COMMIT returned to client
         → background: data written from redo log to data files
```

The mechanism behind this is the **redo log** — a write-ahead log (WAL):

- Every committed change is written to the redo log *before* MySQL ever tells the client "COMMIT succeeded."
- The redo log lives on disk, not just in RAM — so it survives a crash even if the in-memory buffer pool doesn't.
- On crash recovery, MySQL replays the redo log forward from the last checkpoint, reapplying every committed change that hadn't yet made it into the actual data files.
- `innodb_flush_log_at_trx_commit = 1` (the default) is the setting that forces that redo log flush to disk on *every single* COMMIT — this is what gives you full durability.

**Example**

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';
UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';
COMMIT;
-- The instant COMMIT returns, the redo log entry for this transaction
-- is already durably on disk. Kill the MySQL process right now —
-- on restart, this transfer is still there.
```

### Durability vs Performance Tradeoff

| `innodb_flush_log_at_trx_commit` | Durability | Performance |
|----------------------------------|------------|-------------|
| `1` (default) | Full — no data loss | Slowest |
| `2` | Lose ~1 second on OS crash | Faster |
| `0` | Lose ~1 second on MySQL crash | Fastest |

For financial data: always use `1`. For analytics/logs: `2` may be acceptable.

**Common mistakes/confusions**

- Assuming "COMMIT returned successfully" and "data is safely on disk" are always the same thing — they're only guaranteed to match when `innodb_flush_log_at_trx_commit = 1`. Turn that setting down for speed, and you've quietly traded away some durability.
- Confusing the **redo log** (durability / crash recovery) with the **undo log** (atomicity / rollback) — they're two different logs solving two different problems, and InnoDB writes to both on every change.

**Interview answer**

The redo log (write-ahead log) records all changes before they're written to data files. On COMMIT, MySQL flushes the redo log to disk before confirming success. If the server crashes, MySQL replays the redo log on restart to recover all committed transactions, ensuring no committed data is lost.

> **Memory hook:** Durability is the fireproof vault — the teller only says "done" after the transfer is stamped and filed, not while it's still on a sticky note.

---

## 6. InnoDB Implementation

Put all four properties together and here's the full path a single transaction takes through InnoDB, from `START TRANSACTION` down to a checkpoint hitting disk:

```
┌─────────────────────────────────────────────────────────────────┐
│                    InnoDB Transaction Path                      │
│                                                                 │
│  START TRANSACTION                                              │
│       │                                                         │
│       ▼                                                         │
│  DML (INSERT/UPDATE/DELETE)                                     │
│       │                                                         │
│       ├─── Write to UNDO LOG (for rollback/MVCC)               │
│       ├─── Write to REDO LOG buffer (for durability)           │
│       └─── Modify buffer pool (in-memory data pages)           │
│                                                                 │
│  COMMIT                                                         │
│       │                                                         │
│       ├─── Flush REDO LOG buffer to disk (WAL)                 │
│       └─── Transaction marked committed                         │
│                                                                 │
│  Background                                                     │
│       └─── Checkpoint: dirty pages written from buffer → disk  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Hands-On Exercises

**Exercise 1:** Simulate the bank transfer. Create accounts table with CHECK (balance >= 0). Try to overdraw Alice's account — observe the atomicity rollback.

**Exercise 2:** Open two MySQL sessions. In session 1, start a transaction and update a row but don't commit. In session 2, try to read that row — observe isolation in action.

**Exercise 3:** Set `innodb_flush_log_at_trx_commit = 0` and measure INSERT speed vs `= 1`. Observe the durability-performance tradeoff.

**Exercise 4:** Write a stored procedure that transfers money between two accounts. If either account doesn't exist or balance is insufficient, rollback. Otherwise commit.

**Exercise 5:** Insert 1000 rows in a transaction (batch) vs 1000 separate auto-commit inserts. Compare speed — explain why transactions are faster for bulk inserts.

---

## 8. Interview Q&A

**Q: What does Atomicity mean in ACID?**
Answer: Atomicity means a transaction is treated as a single unit — either all its operations succeed and are committed, or none of them are applied. If any statement fails, the entire transaction is rolled back. InnoDB uses the undo log to reverse changes on rollback.

**Q: What does Consistency guarantee?**
Answer: Consistency ensures every transaction brings the database from one valid state to another. All constraints (NOT NULL, UNIQUE, FK, CHECK), triggers, and application rules must hold at the end of every transaction. A transaction violating any constraint will be rejected.

**Q: What is MVCC and how does it support Isolation?**
Answer: MVCC (Multi-Version Concurrency Control) means InnoDB keeps multiple versions of rows. Each transaction reads a snapshot of data as it existed at transaction start. This allows readers and writers to operate concurrently without blocking each other — readers see a consistent view even while writers modify data.

**Q: What is the redo log and why is it critical for Durability?**
Answer: The redo log (write-ahead log) records all changes before they're written to data files. On COMMIT, MySQL flushes the redo log to disk before confirming success. If the server crashes, MySQL replays the redo log on restart to recover all committed transactions, ensuring no committed data is lost.

**Q: Why does MySQL wrap bulk inserts in a single transaction for performance?**
Answer: Each auto-committed INSERT flushes the redo log to disk. 1000 auto-committed inserts = 1000 disk flushes. Wrapping in one transaction = one disk flush on COMMIT. The performance gain is significant on SSD (100x faster) and even more on HDD.
