# ACID Precisely — Complete Guide

> "A package holiday either puts you on the plane and in the hotel bed or does neither — nobody sells the trip where you land at midnight with a ticket and no room."

---

## Table of Contents

1. [The Problem: Work That Stops Halfway](#1-the-problem-work-that-stops-halfway)
2. [The Package Holiday Booking Analogy](#2-the-package-holiday-booking-analogy)
3. [The Mechanism: What Each Letter Actually Guarantees](#3-the-mechanism-what-each-letter-actually-guarantees)
4. [Diagram: A Transaction From BEGIN to Durable on Disk](#4-diagram-a-transaction-from-begin-to-durable-on-disk)
5. [Code Walkthrough: Transaction Boundaries and Savepoints](#5-code-walkthrough-transaction-boundaries-and-savepoints)
6. [Comparing Autocommit to an Explicit Transaction](#6-comparing-autocommit-to-an-explicit-transaction)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Work That Stops Halfway

One business action almost never maps to one write. Moving 500 between two accounts is two statements, and a machine can die between them.

### Two Writes, One Business Action

```text
UPDATE accounts SET balance = balance - 500 WHERE account_id = 1001;
  ↳ succeeds; account 1001 now holds 2500 instead of 3000
    *** power loss / process kill / connection drop ***
UPDATE accounts SET balance = balance + 500 WHERE account_id = 1002;
  ↳ never runs; account 1002 still holds 800

Result: 500 has left the bank; no data records that a transfer was open.
```

### What's Missing

Nothing about the two statements is wrong on its own; each did exactly what it said. What is missing is a way to declare that they are one unit — that the system is only ever allowed to show the world the state before both or the state after both, never the state between them.

---

## 2. The Package Holiday Booking Analogy

A flight-only agent sells you a seat and stops caring. A package operator holds the seat and the room together and confirms both or releases both, because a customer standing in a foreign airport with half a holiday is worse than a customer who never left home.

### Half-Booked Versus Package-Booked

```text
Flight-only agent → books the seat and charges the card; a full hotel is
                    your problem, and you own a ticket to a bedless city
Package operator  → holds seat and room together, confirming both or
                    releasing both, and only then issuing a confirmation
```

### Mapping the Analogy to ACID

The operator confirming both or neither is atomicity. Refusing to sell a trip to a city it does not fly to is consistency — a rule declared up front, not discovered afterwards. Two customers competing for the last room without seeing each other's half-finished bookings is isolation. The confirmation number that stays valid even after the booking office burns down is durability.

---

## 3. The Mechanism: What Each Letter Actually Guarantees

Each letter is a precise claim, and three of the four are claims the engine makes to you. One of them is mostly a claim you make to yourself.

### Atomicity: All or Nothing, Enforced by Undo

```text
Before applying any change, the engine writes the old value down:
  undo record: accounts(1001).balance was 3000
  undo record: accounts(1002).balance was 800

ROLLBACK → replay those undo records backwards; 3000 and 800 return
CRASH    → recovery finds no COMMIT record for this transaction and
           performs exactly the same undo, unattended
  ↳ Atomicity is not "both writes land at the same instant"; it is
    "any write that did land can be taken back" — hence an undo log.
```

### Consistency: The Letter Everyone Gets Wrong

```text
What C does NOT mean → "the database will keep your data correct"
What C DOES mean     → if the state before satisfied every declared
                       constraint, the state after does too; otherwise
                       the transaction is rejected
Declared constraints → PRIMARY KEY, UNIQUE, NOT NULL, CHECK,
                       FOREIGN KEY, and supported assertions
NOT a constraint     → "a transfer must never change the total money in
                       the system" — unless written as a CHECK or a
                       trigger, no engine knows this rule exists
  ↳ A, I and D are the engine's job. C is the application's job, and
    the engine enforces only the part you were explicit about.
```

### Isolation and Durability: As If Alone, and Written for Good

```text
Isolation  → the outcome of concurrent transactions equals the outcome of
             running them one at a time in *some* order — the SERIALIZABLE
             ideal. Lessons 2 and 3 show how far the weaker levels fall
             short and why they exist anyway.
Durability → once COMMIT returns, the effects survive process crash, OS
             crash and power loss. The price: COMMIT cannot return until
             the log record is on stable storage — a disk flush per
             commit, which puts a hard floor under commit latency.
```

---

## 4. Diagram: A Transaction From BEGIN to Durable on Disk

### The Path of One Transaction

```text
BEGIN
  │
  ▼
┌──────────────────────────────────────────────┐
│ each UPDATE / INSERT / DELETE:               │
│   new value  → data page in memory           │
│   old value  → undo log   (enables ROLLBACK) │
│   the change → redo log   (enables recovery) │
└───────────────────┬──────────────────────────┘
          ┌─────────┴──────────┐   (loop repeats per statement)
          ▼                    ▼
      ROLLBACK              COMMIT
          │                    │
          ▼                    ▼
 undo replayed backwards;  redo log forced to stable storage,
 pages restored; no        and only THEN does COMMIT return
 COMMIT record written     │
          ▼                ▼
  "rolled back"      dirty data pages are repaired after a
                     crash by replaying the redo log
```

### Reading the Diagram

Durability attaches to the log, not to the data pages — that is the whole trick. Writing one sequential log record and forcing it to disk is far cheaper than writing every scattered data page the transaction touched, and it is sufficient, because the log contains enough information to redo those page writes after a crash. The single moment the client waits on a disk is COMMIT.

---

## 5. Code Walkthrough: Transaction Boundaries and Savepoints

A transaction starts at an explicit boundary and ends at exactly one of two verbs. Everything in this section is illustrative standard SQL; spellings vary slightly by engine.

### Explicit Boundaries

```sql
-- Illustrative standard SQL
START TRANSACTION;              -- most engines also accept BEGIN
  INSERT INTO orders (order_id, customer_id, total_amount)
  VALUES (77401, 5120, 249.00);

  UPDATE inventory SET on_hand = on_hand - 1
  WHERE sku = 'KB-87';
COMMIT;                         -- both rows durable, or neither exists
```

### SAVEPOINT and ROLLBACK TO SAVEPOINT

```sql
-- Illustrative standard SQL
START TRANSACTION;
  INSERT INTO orders (order_id, customer_id, total_amount)
  VALUES (77402, 5120, 89.00);

  SAVEPOINT before_gift_wrap;
    INSERT INTO order_options (order_id, option_code)
    VALUES (77402, 'GIFTWRAP');
  ROLLBACK TO SAVEPOINT before_gift_wrap;   -- gift wrap gone, order kept
  RELEASE SAVEPOINT before_gift_wrap;       -- discard the marker itself
COMMIT;                                     -- order 77402 is now durable
```

### What a Savepoint Is Not

```text
ROLLBACK TO SAVEPOINT s → undo back to marker s; the transaction is
                          still open and still holds every lock it took
RELEASE SAVEPOINT s     → forget the marker; work done after it stays
ROLLBACK (no TO)        → discard the entire transaction, markers and all
  ↳ A savepoint is a partial undo inside one transaction, not a nested
    commit. Nothing a savepoint spares is durable until the outer COMMIT.
```

---

## 6. Comparing Autocommit to an Explicit Transaction

Every connection is always inside a transaction; autocommit only decides how short it is, and most engines and drivers enable it by default.

### Autocommit vs Explicit Transaction

| | Autocommit | Explicit transaction |
|---|---|---|
| Boundary | Each statement is its own transaction | START TRANSACTION through COMMIT or ROLLBACK |
| Two related writes | Two independent atomic units; one can survive alone | One atomic unit |
| ROLLBACK afterwards | Nothing to undo — the statement already committed | Undoes everything since the boundary |
| Commit cost | One log force per statement | One log force per transaction |
| Failure between writes | Silent partial state | Clean rollback, visible error |

### Takeaway

The dangerous case is not choosing autocommit; it is not knowing it is on. Code that issues the two transfer statements from Section 1 without an explicit boundary looks transactional, reviews as transactional, and is not — it simply commits twice and leaves a hole in the ledger when the second statement fails.

---

## 7. Common Mistakes

- **Reading Consistency as a promise that the data will be correct.** It only promises that declared constraints hold before and after the transaction. An invariant like "debits equal credits" is enforced only if it exists as a `CHECK`, an assertion, a foreign key, or a trigger — otherwise the engine will durably and atomically commit nonsense, exactly as instructed.
- **Assuming the driver or ORM opened a transaction for you.** Many drivers run in autocommit until told otherwise, so a multi-statement function can commit each statement separately. Verify the boundary explicitly rather than inferring it from the fact that the code is grouped in one function.
- **Treating `ROLLBACK TO SAVEPOINT` as committing the surviving work.** The transaction is still open and its locks are still held; a later `ROLLBACK` or a crash throws away everything, including the part the savepoint preserved.
- **Holding a transaction open across user think-time or a network call.** Locks and old row versions are retained for the whole open interval, which is how a five-second remote API call becomes a five-second lock wait for every other session. Lesson 4 shows what that does to deadlock rates.

---

## 8. Hands-On Exercises

**Exercise 1:** Create `accounts(account_id, balance)` with two rows holding 3000 and 800. Inside `START TRANSACTION ... COMMIT`, run the two transfer statements from Section 1 and confirm the totals move together. Then repeat with `ROLLBACK` instead of `COMMIT` and confirm both balances are unchanged.

**Exercise 2:** Add `CHECK (balance >= 0)` to the table, then attempt a transaction that withdraws 5000 from the 3000 balance. Observe which statement fails and confirm that after the failure the row still reads 3000 — this is the C in ACID doing exactly and only what it was told.

**Exercise 3:** Write the "total money is conserved" rule as an explicit constraint or trigger over the two accounts, then attempt a transaction that subtracts 500 without adding it anywhere. Confirm it is now rejected, and note that before you wrote it the same transaction committed happily.

**Exercise 4:** Reproduce the autocommit trap from Section 6. With autocommit on, issue the two transfer statements as separate calls and kill the client between them. Confirm the first is committed and the money is gone, then issue `ROLLBACK` and confirm it recovers nothing.

**Exercise 5:** Open a transaction, insert an order, set `SAVEPOINT before_gift_wrap`, insert an option row, `ROLLBACK TO SAVEPOINT before_gift_wrap`, and confirm the order row is still visible to your own session. Then issue a plain `ROLLBACK` and confirm the order is gone too — proving the savepoint committed nothing.

---

## 9. Interview Q&A

**Q: What does the C in ACID actually mean?**
It means the database moves from one state that satisfies all declared constraints to another state that satisfies them, and rejects the transaction otherwise. It is not a guarantee that your data is semantically correct — the engine only knows the rules you declared as primary keys, unique constraints, not-null, checks, foreign keys or triggers. Business invariants that were never declared are the application's responsibility, which is why people call C the odd letter out: A, I and D are properties the engine provides, while C is mostly a contract you enforce yourself.

**Q: How is atomicity actually implemented?**
Before applying a change the engine records the previous value in an undo log, so any change can be reversed. A `ROLLBACK` replays those undo records backwards, and crash recovery does the same thing automatically for any transaction with no commit record on disk. So atomicity is not about making writes land simultaneously; it is about guaranteeing that writes that did land can be taken back.

**Q: What does durability cost?**
It costs a forced write to stable storage before `COMMIT` can return. The engine flushes the redo log record — sequential and small — rather than the scattered data pages, which is why one disk sync per commit is enough to survive a crash. That sync is a real device round trip, so it puts a floor under commit latency and is the reason systems batch or group commits under load.

**Q: What is the risk of not knowing autocommit is enabled?**
Every statement becomes its own transaction, so a sequence of statements that reads like one unit of work is actually several. If the process dies partway through, the earlier statements are already durable and there is nothing left to roll back, which produces exactly the half-finished state transactions exist to prevent. The fix is to make the boundary explicit rather than assuming the driver or ORM opened one.

**Q: What is a savepoint and when would you use one?**
A savepoint is a named marker inside an open transaction that you can roll back to without abandoning the whole transaction. It is useful when one optional step may fail — applying a promotional code, attaching an add-on — and you want to discard just that step while keeping the rest. It is not a nested commit: the transaction stays open, keeps its locks, and nothing is durable until the outer `COMMIT`.
