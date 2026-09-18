# Transactions & Isolation Levels — MySQL Complete Guide

## Table of Contents
1. [Transaction Syntax](#1-transaction-syntax)
2. [SAVEPOINTs](#2-savepoints)
3. [Autocommit](#3-autocommit)
4. [Isolation Levels](#4-isolation-levels)
5. [Concurrency Phenomena](#5-concurrency-phenomena)
6. [Setting Isolation Levels](#6-setting-isolation-levels)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Transaction Syntax

You already know from the ACID lesson that a transaction is "all or nothing." So what does that actually look like in SQL? Just three commands, really.

```sql
-- Start a transaction
START TRANSACTION;
-- or equivalent:
BEGIN;

-- Make changes
UPDATE accounts SET balance = balance - 100 WHERE id = 'alice';
UPDATE accounts SET balance = balance + 100 WHERE id = 'bob';

-- Save all changes permanently
COMMIT;

-- OR: undo all changes since START TRANSACTION
ROLLBACK;
```

That's the whole vocabulary: open a transaction, do your work, then either `COMMIT` (keep it) or `ROLLBACK` (throw it away as if it never happened).

Here's the same idea, but with a real decision baked in — check the balance before deciding whether to commit or roll back:

### Complete Example with Error Handling

```sql
START TRANSACTION;

UPDATE accounts SET balance = balance - 500 WHERE id = 'alice';

-- Check if alice had enough balance
SELECT balance INTO @alice_bal FROM accounts WHERE id = 'alice';

IF @alice_bal < 0 THEN
  ROLLBACK;
  SELECT 'Insufficient funds' AS message;
ELSE
  UPDATE accounts SET balance = balance + 500 WHERE id = 'bob';
  COMMIT;
  SELECT 'Transfer successful' AS message;
END IF;
```

Notice the pattern: the risky change happens first, you inspect the result, and only then do you decide which door to walk through — `COMMIT` or `ROLLBACK`. Nothing is final until you say so.

---

## 2. SAVEPOINTs

**The problem this solves:** sometimes you don't want an all-or-nothing rollback — you want to undo just the *last part* of a transaction and keep the rest.

Think of a multi-step order: create the order, add the line items, record the payment. If the payment step turns out wrong, do you really want to throw away the order and the items too? That would be like tearing up an entire receipt because you wrote the wrong tip amount at the bottom.

That's exactly what a **savepoint** is for — a named checkpoint inside a transaction that you can roll back to, without undoing everything before it.

```sql
START TRANSACTION;

INSERT INTO orders (customer_id, total) VALUES (1, 500);
SAVEPOINT after_order;   -- mark this point

INSERT INTO order_items (order_id, product_id, qty) VALUES (LAST_INSERT_ID(), 10, 2);
SAVEPOINT after_items;

-- Something goes wrong with payment
INSERT INTO payments (order_id, amount) VALUES (LAST_INSERT_ID(), 999);
-- Oops — wrong amount

ROLLBACK TO SAVEPOINT after_items;  -- undo payment only, keep order + items

INSERT INTO payments (order_id, amount) VALUES (LAST_INSERT_ID(), 500);
COMMIT;

-- Clean up savepoint (optional)
RELEASE SAVEPOINT after_order;
RELEASE SAVEPOINT after_items;
```

The order and items survive; only the botched payment gets undone and redone. That's the whole value proposition of a savepoint — surgical rollback instead of nuking the whole transaction.

---

## 3. Autocommit

**The problem this solves:** you need to know, by default, when your changes actually become permanent — is it the moment you run the statement, or only when you explicitly say so?

By default, MySQL answers: immediately. Every single statement you run is automatically wrapped in its own tiny transaction and committed the instant it finishes. This is called **autocommit** mode, and it's ON by default.

```sql
-- Check autocommit status
SHOW VARIABLES LIKE 'autocommit';
-- Value: ON (default)

-- With autocommit ON:
UPDATE users SET email = 'new@example.com' WHERE id = 1;
-- This is automatically committed — cannot be rolled back!
```

That last line is the important gotcha: with autocommit ON, there's no undo button. The moment the statement finishes, it's permanent — you'd need a *new* statement to fix it, not a rollback.

If you want the safety net of being able to undo, turn autocommit off for the session:

```sql
-- Disable autocommit for the session
SET autocommit = 0;
-- Now every statement is NOT automatically committed
UPDATE users SET email = 'new@example.com' WHERE id = 1;
ROLLBACK;  -- change undone

-- Must COMMIT manually

-- Re-enable
SET autocommit = 1;
```

**Note:** `START TRANSACTION` temporarily overrides autocommit for that transaction regardless of the setting — so even with autocommit ON, once you explicitly start a transaction, nothing commits until you say `COMMIT`.

---

## 4. Isolation Levels

### What problem does this solve?

Picture two transactions running at the same time, both touching the same rows. Without any rules about what one is allowed to "see" of the other's in-progress work, chaos follows — one transaction could read half-finished changes, get different answers to the same question asked twice, or see rows appear out of nowhere. **Isolation levels are the dial that controls how much of that chaos is allowed through.**

### Analogy

Think of isolation levels like privacy settings on a shared document. At the loosest setting, everyone sees your every keystroke as you type — including typos you're about to delete. At the strictest setting, nobody sees your changes until you hit "save," and while you're editing, nobody else can even open the document. MySQL gives you four settings in between those extremes.

### Basic definition

An **isolation level** determines how visible one transaction's in-progress changes are to other concurrently running transactions. MySQL supports four standard levels, each permitting or preventing a different set of "concurrency anomalies" (covered in detail in Section 5).

### How MySQL actually pulls this off: MVCC

Here's the part that trips people up: how does MySQL let a transaction see a "stable" view of data while other transactions keep writing to the same table — without just locking everything?

The answer is **MVCC — Multi-Version Concurrency Control**. Instead of a row having exactly one value at a time, InnoDB keeps *multiple historical versions* of a row around (via the undo log — the same undo log used for rollback). When a transaction reads a row, it doesn't necessarily get "the current value" — it gets "the value as of a specific point in time," reconstructed from these versions if needed.

```
Row for Alice's balance, as InnoDB actually stores it (simplified):

┌─────────────────────────────────────────────────────────┐
│ Current value: 400          (written by T1, uncommitted) │
│ Undo log ──▶ previous value: 500  (committed, visible    │
│                                     to older snapshots)   │
└─────────────────────────────────────────────────────────┘

T1 (uncommitted): sees 400 — its own change
T2 (under REPEATABLE READ, snapshot taken before T1 started):
      sees 500 — reconstructed from the undo log,
      completely untouched by T1's in-flight write
```

This is *why* readers never block writers and writers never block readers in InnoDB — a reader that wants an "older" version just walks the undo log instead of waiting for a lock to free up.

Now let's see where each isolation level draws its line, using two transactions running side by side:

```
Time →   T1 (writer)                    T2 (reader)
──────────────────────────────────────────────────────────
t0       START TRANSACTION              START TRANSACTION
t1       UPDATE balance = 400
         (not yet committed)
t2                                      SELECT balance
                                         ┌─────────────────────────────┐
                                         │ READ UNCOMMITTED → 400      │  ← dirty read!
                                         │ READ COMMITTED   → 500      │
                                         │ REPEATABLE READ  → 500      │
                                         │ SERIALIZABLE     → 500      │
                                         └─────────────────────────────┘
t3       COMMIT (balance is now 400)
t4                                      SELECT balance  (same txn, 2nd read)
                                         ┌─────────────────────────────┐
                                         │ READ UNCOMMITTED → 400      │
                                         │ READ COMMITTED   → 400      │  ← non-repeatable read!
                                         │ REPEATABLE READ  → 500      │  (MVCC snapshot holds)
                                         │ SERIALIZABLE     → 500      │
                                         └─────────────────────────────┘
```

Notice the diagonal staircase — every level up the ladder blocks one more anomaly than the level below it.

### Example

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

-- Session A
START TRANSACTION;
UPDATE accounts SET balance = 400 WHERE id = 'alice';
-- not committed yet...

-- Session B (also READ UNCOMMITTED)
START TRANSACTION;
SELECT balance FROM accounts WHERE id = 'alice';
-- Returns 400 — a value that might never actually exist,
-- if Session A later rolls back!
```

Switch Session B's isolation level to `READ COMMITTED` or stricter, and it will keep seeing the old committed value (500) until Session A actually commits. That single change in `SET SESSION TRANSACTION ISOLATION LEVEL` is the entire lever you're pulling.

### Compare with related concepts

This table is the single most quoted table in MySQL interviews — memorize the pattern, not just the checkmarks:

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|----------------|:----------:|:-------------------:|:------------:|
| READ UNCOMMITTED | ✅ Possible | ✅ Possible | ✅ Possible |
| READ COMMITTED | ❌ Prevented | ✅ Possible | ✅ Possible |
| REPEATABLE READ | ❌ Prevented | ❌ Prevented | ⚠️ Mostly prevented* |
| SERIALIZABLE | ❌ Prevented | ❌ Prevented | ❌ Prevented |

*MySQL's REPEATABLE READ prevents most phantom reads via gap locks.

**MySQL default: REPEATABLE READ**

### Common mistakes/confusions

The single most common trap: assuming `REPEATABLE READ` in MySQL behaves exactly like the SQL standard's `REPEATABLE READ`. It doesn't — the standard's minimum guarantee for that level still allows phantom reads. **MySQL's InnoDB goes further and mostly blocks phantom reads too**, using **gap locks** (locks on the "gaps" between index records, not just the records themselves) to stop other transactions from inserting rows into a range you've already queried. This is a MySQL-specific bonus, not something you can assume in every database engine — Postgres, for instance, follows the standard's weaker guarantee more literally at this level. Don't walk into an interview (or a cross-database migration) assuming "REPEATABLE READ" means the same thing everywhere.

### Interview answer

"MySQL supports four isolation levels — READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, and SERIALIZABLE — each allowing progressively fewer concurrency anomalies at the cost of more locking/overhead. InnoDB implements this mostly through MVCC: each transaction reads from a consistent snapshot reconstructed via the undo log, so readers don't block writers. MySQL's default, REPEATABLE READ, is stronger than the SQL standard requires, because InnoDB's gap locks also prevent most phantom reads — something you don't get for free in every database."

> **Memory hook:** Dirty → Committed → Repeatable → Serializable is a staircase — each step up blocks one more anomaly, costs a bit more concurrency.

---

## 5. Concurrency Phenomena

These are the three specific "things that can go wrong" that isolation levels exist to prevent. Let's take them one at a time, each with the pain first.

### Dirty Read

**What problem does this solve?** Imagine you read a number from an in-progress transaction — one that hasn't committed yet, and might never commit. You act on that number. Then the other transaction rolls back. You made a decision based on data that, as far as the database is concerned, *never actually happened*.

**Analogy:** it's like acting on a rumor before it's confirmed. Someone tells you "the meeting got moved to 3pm" — you show up at 3, but it turns out that was never finalized and the meeting was actually at 2. You trusted unconfirmed information and paid for it.

**Definition:** a dirty read happens when a transaction reads data written by another transaction that hasn't committed yet.

```
T1: UPDATE balance = 500 (not yet committed)
T2: reads balance = 500  ← dirty read!
T1: ROLLBACK → balance never was 500
T2: made decisions based on incorrect data ← problem!

Prevented by: READ COMMITTED and above
```

**Memory hook:**
> **Memory hook:** A dirty read is trusting a rumor before anyone's confirmed it's true.

---

### Non-Repeatable Read

**What problem does this solve?** You read a value mid-transaction. Then someone else changes it and commits. Then you read the *same row again, in the same transaction* — and get a different answer. Nothing about your own transaction changed; the ground shifted underneath you.

**Analogy:** you check the price tag on a shelf item, walk to the register, and the price has changed by the time you check out — even though you never put the item down. Same question, asked twice, two different answers, and you didn't do anything to cause that.

**Definition:** a non-repeatable read occurs when a transaction re-reads a row it already read, and gets a different value, because another transaction modified and committed a change to that row in between.

```
T1: SELECT balance → 500
T2: UPDATE balance = 300, COMMIT
T1: SELECT balance → 300  ← different result!

T1 read the same row twice and got different results.
Prevented by: REPEATABLE READ and above
```

**Memory hook:**
> **Memory hook:** Non-repeatable read is checking the price twice and getting two different answers, mid-shopping-trip.

---

### Phantom Read

**What problem does this solve?** You run a range query — say, "count all active users" — and get 10. Somewhere in the middle of your transaction, someone else inserts a new active user and commits. You run the *exact same query again*, still inside your original transaction, and now get 11. A row that didn't exist a moment ago has "phantom" appeared in your result set.

**Analogy:** you count the chairs in a room, step out for a moment, come back, count again, and there's an extra chair nobody told you about. Nothing about the chairs you already counted changed — a whole new one just showed up in the room.

**Definition:** a phantom read happens when a transaction re-runs a range query and sees rows that weren't there on the first run, because another transaction inserted (or deleted) matching rows and committed in between.

```
T1: SELECT COUNT(*) WHERE status='active' → 10 rows
T2: INSERT new active user, COMMIT
T1: SELECT COUNT(*) WHERE status='active' → 11 rows ← phantom!

T1 sees a new row that didn't exist at transaction start.
Prevented by: SERIALIZABLE (and mostly by REPEATABLE READ in MySQL via gap locks)
```

**Memory hook:**
> **Memory hook:** A phantom read is an extra chair appearing in the room while your back was turned.

---

## 6. Setting Isolation Levels

Now that you know *what* each level prevents, here's *how* to actually pick one — at three different scopes: just the next transaction, the whole session, or every future connection.

```sql
-- Set for current session
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Set globally (affects new connections)
SET GLOBAL TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Set for next transaction only
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
START TRANSACTION;
...
COMMIT;
-- Next transaction reverts to session level

-- Check current level
SELECT @@transaction_isolation;
-- or:
SHOW VARIABLES LIKE 'transaction_isolation';
```

Which one should you actually reach for? It comes down to how much you value strict correctness versus raw throughput:

### Choosing the Right Level

| Use Case | Recommended Level |
|----------|------------------|
| General OLTP applications | REPEATABLE READ (default) |
| Reporting/analytics (read-only) | READ COMMITTED (better concurrency) |
| Financial/banking | SERIALIZABLE (strictest) |
| High-throughput writes | READ COMMITTED (fewer locks) |

---

## 7. Hands-On Exercises

**Exercise 1:** Open two sessions. In session 1: START TRANSACTION; UPDATE a row. In session 2: observe that under READ COMMITTED you don't see the change until session 1 commits.

**Exercise 2:** Demonstrate a non-repeatable read: session 1 reads a value, session 2 updates it and commits, session 1 reads again. Under REPEATABLE READ this shouldn't happen. Verify.

**Exercise 3:** Test SAVEPOINTs: create an order with items and payment in a transaction. Use ROLLBACK TO SAVEPOINT to undo only the payment, then insert the correct payment.

**Exercise 4:** Disable autocommit. Make 3 INSERT statements. Close the session without COMMITting. Reconnect and verify the rows are gone.

**Exercise 5:** Time 10,000 individual auto-committed INSERTs vs the same in a single transaction. Record the time difference.

---

## 8. Interview Q&A

**Q: What is the default isolation level in MySQL and why?**
Answer: MySQL defaults to REPEATABLE READ. It prevents dirty reads and non-repeatable reads, and with InnoDB's gap locks, prevents most phantom reads too. It balances consistency and concurrency better than SERIALIZABLE (which is too slow) and READ COMMITTED (which allows non-repeatable reads).

**Q: What is a dirty read?**
Answer: A dirty read occurs when one transaction reads data that another transaction has modified but not yet committed. If the writing transaction rolls back, the reading transaction had data that never actually existed. Prevented by READ COMMITTED and stricter isolation levels.

**Q: What is the difference between READ COMMITTED and REPEATABLE READ?**
Answer: Under READ COMMITTED, each query within a transaction sees the latest committed data — the same query can return different results if another transaction commits between reads (non-repeatable reads). Under REPEATABLE READ, MySQL gives each transaction a snapshot of data at its start — re-reading the same row always returns the same value.

**Q: What is SERIALIZABLE isolation?**
Answer: SERIALIZABLE is the strictest level — transactions execute as if they were completely serial (one after another). It prevents all concurrency anomalies including phantom reads, but requires more locking, reducing throughput. Use only for critical financial operations where absolute consistency is required.

**Q: What is autocommit in MySQL?**
Answer: Autocommit means every SQL statement is automatically wrapped in its own transaction and committed immediately. This is MySQL's default (ON). When autocommit is ON, you cannot rollback individual statements. Use START TRANSACTION to explicitly begin a multi-statement transaction, which temporarily overrides autocommit.
