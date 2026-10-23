# The Anomalies — Complete Guide

> "Two flatmates each glance at the shopping list on the fridge, each go to the shop, and both come home with milk — neither of them did anything wrong."

---

## Table of Contents

1. [The Problem: Two Correct Programs Running at Once](#1-the-problem-two-correct-programs-running-at-once)
2. [The Fridge Shopping List Analogy](#2-the-fridge-shopping-list-analogy)
3. [The Mechanism: Interleaving and the Three Conflict Shapes](#3-the-mechanism-interleaving-and-the-three-conflict-shapes)
4. [Diagram: The Read Anomalies](#4-diagram-the-read-anomalies)
5. [Code Walkthrough: The Write-Driven Anomalies](#5-code-walkthrough-the-write-driven-anomalies)
6. [Comparing Lost Update to Write Skew](#6-comparing-lost-update-to-write-skew)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Two Correct Programs Running at Once

Every anomaly in this lesson comes from the same source: two transactions that are each individually correct, running at overlapping times, producing an outcome no serial order of them could produce.

### Correct Alone, Wrong Together

```text
Program: "sell one unit"
  1. SELECT on_hand FROM inventory WHERE sku = 'KB-87';   → 12
  2. UPDATE inventory SET on_hand = 11 WHERE sku = 'KB-87';

Run once            → 12 becomes 11. One sale, one unit. Correct.
Run twice serially  → 12 → 11 → 10. Two sales, two units. Correct.
Run twice overlapping → both read 12, both write 11. Two sales, ONE
                        unit gone, and nothing errored.
```

### What's Missing

No statement in that program is wrong, and no engine rejected anything. What is missing is a rule about which interleavings are allowed — a definition of the outcomes concurrency may produce and the ones it may not. The named anomalies below are that definition written as a list of forbidden shapes.

---

## 2. The Fridge Shopping List Analogy

Two flatmates share one paper list on the fridge. Each reads it, walks to the shop, and buys what the list said when they last looked. Neither is careless; the list simply changed underneath one of them, or both acted on the same line without knowing the other had.

### Reading the List Versus Owning It

```text
One flatmate → read the list, shop, cross items off, put it back. The
               list on the fridge and the list in their head always agree
Two flatmates → each holds a private snapshot of a list that is being
               edited while they are out; the fridge ends up in a state
               neither of them intended and neither can be blamed for
```

### Mapping the Analogy to Concurrency Anomalies

The list is a row or a set of rows; "what it said when I last looked" is a read; putting the list back is a write. Every anomaly below is one specific way that private snapshot and the shared fridge can disagree — read something that gets un-written, read the same line twice and get two answers, or both cross off the last carton.

---

## 3. The Mechanism: Interleaving and the Three Conflict Shapes

Two transactions only interfere when they touch the same data and at least one of them writes. That gives exactly three conflict shapes, and every named anomaly is an instance of one of them.

### The Timeline Notation Used Below

```text
        T1 (what one session does)      T2 (what the other does)
   ────────────────────────────────────────────────────────────────
   t1   BEGIN                           BEGIN
   t2   SELECT ... → value              ← time runs downward
  ↳ "→ value" is what that session actually saw. Every bug below shows
    up as a value in that position which no serial order could produce.
```

### Write-Read, Read-Write, Write-Write

```text
Write → Read   T2 reads what T1 wrote but has not committed
               ↳ dirty read
Read → Write   T2 changes a row T1 already read, or changes the set of
               rows T1's WHERE clause matched
               ↳ non-repeatable read, phantom, read skew, write skew
Write → Write  Both write the same row based on a value both read first
               ↳ lost update
```

---

## 4. Diagram: The Read Anomalies

### Dirty Read

```text
        T1 (transfer that will fail)    T2 (fraud report)
   ────────────────────────────────────────────────────────────────
   t1   UPDATE accounts SET balance=2500 WHERE id=1001   (uncommitted)
   t2                                   SELECT balance WHERE id=1001
                                        → 2500  ← never committed
   t3   ROLLBACK  (balance is 3000 again)
   t4                                   emails the customer about a 500
                                        debit that never happened
```

### Non-Repeatable Read and Read Skew

```text
   NON-REPEATABLE READ — one row, read twice, two answers
        T1 (checkout)                   T2 (price update)
   ────────────────────────────────────────────────────────────────
   t1   SELECT price WHERE sku='KB-87' → 89.00
   t2                                   UPDATE products SET price=99.00
                                        WHERE sku='KB-87';  COMMIT
   t3   SELECT price WHERE sku='KB-87' → 99.00  ← same query, new answer
   t4   customer was shown 89.00 and charged 99.00

   READ SKEW — each row consistent, the pair never true together
        T1 (nightly backup)             T2 (transfer of 500)
   ────────────────────────────────────────────────────────────────
   t1   SELECT balance WHERE id=1001 → 500
   t2                                   1001 → 0, 1002 → 1000;  COMMIT
   t3   SELECT balance WHERE id=1002 → 1000
   t4   backup stores 500 + 1000 = 1500 for a customer holding 1000
```

### Reading the Diagrams

A dirty read exposes a value that never existed in any committed state, so any decision made on it is unfounded. A non-repeatable read shows one row changing under a still-open transaction. Read skew is the same defect widened to several rows: each row is read from a legitimately committed state, but from two *different* committed states, so the combination is a total that was never true. The backup case is the damaging one, because the corrupt total is what gets stored.

---

## 5. Code Walkthrough: The Write-Driven Anomalies

These three end in a write, which is why they cause lasting damage rather than a wrong screen.

### Lost Update

```text
        T1 (order 8801)                 T2 (order 8802)
   ────────────────────────────────────────────────────────────────
   t1   SELECT on_hand WHERE sku='KB-87' → 12
   t2                                   SELECT on_hand
                                        WHERE sku='KB-87' → 12
   t3   UPDATE inventory SET on_hand=11
        WHERE sku='KB-87';  COMMIT
   t4                                   UPDATE inventory SET on_hand=11
                                        WHERE sku='KB-87';  COMMIT
   t5   on_hand = 11 after two sales    ← T1's update is simply gone
  ↳ Fix without touching the isolation level: SET on_hand = on_hand - 1
    folds the read and the write into one atomic statement.
```

### Phantom Read

```text
        T1 (capacity check)             T2 (competing booking)
   ────────────────────────────────────────────────────────────────
   t1   SELECT COUNT(*) FROM bookings WHERE room_id = 7
          AND booking_date = '2026-03-04' → 4   (limit is 5)
   t2                                   INSERT INTO bookings VALUES
                                        (7,'2026-03-04',...);  COMMIT
   t3   INSERT INTO bookings VALUES (7,'2026-03-04',...);  COMMIT
   t4   room 7 now holds 6 bookings for a 5-person room
  ↳ No row T1 read was modified. A NEW row appeared inside the range its
    WHERE covers, so row locks cannot help; the range needs locking.
```

### Write Skew

```text
   rule: one doctor must stay on call for shift 41; Chen and Aziz are on
        T1 (Dr Chen goes off call)      T2 (Dr Aziz goes off call)
   ────────────────────────────────────────────────────────────────
   t1   SELECT COUNT(*) WHERE shift_id=41 AND on_call → 2
   t2                                   SELECT COUNT(*) FROM on_call
                                        WHERE shift_id=41 AND on_call → 2
   t3   2 >= 2, safe to leave           2 >= 2, safe to leave
   t4   UPDATE on_call SET on_call=false
        WHERE doctor='chen';  COMMIT
   t5                                   UPDATE on_call SET on_call=false
                                        WHERE doctor='aziz';  COMMIT
   t6   shift 41 has zero doctors on call; no row was written by both
        transactions, so no same-row conflict check could have fired
```

---

## 6. Comparing Lost Update to Write Skew

Both end with an invariant broken by two concurrent read-modify-write transactions, but they differ in exactly the way that decides which defences work.

### Lost Update vs Write Skew

| | Lost update | Write skew |
|---|---|---|
| Rows written | Both transactions write the same row | Each writes a *different* row |
| What is violated | One update overwrites another | A constraint spanning rows neither one wrote together |
| Caught by same-row conflict detection | Yes — snapshot engines abort the second writer | No — there is no shared written row to conflict on |
| Fixed by an atomic single-statement update | Yes: `SET on_hand = on_hand - 1` | No — the decision depends on rows other than the one written |
| Reliably prevented by | REPEATABLE READ in most implementations, or explicit row locking | Nothing short of SERIALIZABLE, or a manual lock on a row standing for the invariant |

### Takeaway

Lost update is a collision on one row and every mechanism that notices two writers on one row will catch it. Write skew has no such row: the two transactions read an overlapping set and then write disjoint rows, so the conflict exists only between one transaction's write and the other's *read predicate*. Detecting that requires the engine to track predicates, which is precisely what serializable isolation does and what everything below it does not.

---

## 7. Common Mistakes

- **Treating phantom reads as just a stronger non-repeatable read.** A non-repeatable read is about a row that changed, and locking that row prevents it. A phantom is a row that did not exist when the query ran, so no row-level lock could have covered it — the whole range matched by the `WHERE` clause needs protection.
- **Believing a snapshot fixes everything.** Reading a consistent snapshot eliminates dirty reads, non-repeatable reads, and read skew outright, which makes it tempting to stop thinking. It does not eliminate write skew, because both transactions can read a perfectly consistent snapshot and still both decide it is safe to act.
- **Reproducing an anomaly with a read-modify-write done inside one SQL statement.** `UPDATE inventory SET on_hand = on_hand - 1` will not demonstrate lost update at any level, because the read and the write are one statement. The anomaly needs a `SELECT` in the application, a decision in application code, then an `UPDATE`.

---

## 8. Hands-On Exercises

**Exercise 1:** Open two sessions against an `accounts` table. In session A begin a transaction and update account 1001's balance without committing; in session B read the same row. Record what B sees, then roll back A and read again in B, noting whether the engine let you observe the uncommitted value.

**Exercise 2:** Reproduce the non-repeatable read from Section 4 on a `products` table: read `price` in session A, update and commit it in session B, then read again in session A inside the same still-open transaction. Record whether the two reads agree.

**Exercise 3:** Reproduce lost update exactly as written in Section 5 — `SELECT` the value into your client, compute `value - 1` yourself, then `UPDATE` with the literal. Run two sessions interleaved and confirm two sales consumed one unit.

**Exercise 4:** Repeat Exercise 3 but write the update as `SET on_hand = on_hand - 1` with no prior `SELECT`, and confirm the anomaly disappears — this is the mistake from Section 7 deliberately reproduced, showing why an atomic statement cannot demonstrate the bug.

**Exercise 5:** Build the `on_call` table with Chen and Aziz both true for shift 41, then run the write-skew timeline in two sessions. Confirm both commit and the count reaches zero. Then re-run it after raising both sessions to `SERIALIZABLE` and record what the engine does differently.

---

## 9. Interview Q&A

**Q: What is a dirty read and why is it especially dangerous?**
A dirty read is seeing a value written by another transaction that has not committed yet. It is dangerous because that value may never become part of any committed state — if the writer rolls back, every decision made from the value was based on data that never existed. That makes it the only anomaly where the application acts on a fact the database itself later denies ever happened.

**Q: What is the difference between a non-repeatable read and a phantom read?**
A non-repeatable read is a row you already read being changed or deleted by another committed transaction, so re-reading that row gives a different answer. A phantom is a *new* row appearing inside the range your `WHERE` clause matches, so re-running the same query returns a different set of rows. The distinction matters for defences: locking the rows you read prevents the first but not the second, because the phantom row did not exist to be locked.

**Q: What is write skew, and why does snapshot isolation not prevent it?**
Write skew is two transactions reading an overlapping set of rows, each deciding independently that an action is safe, and then each writing a *different* row, so that together they break an invariant neither broke alone. The classic case is two on-call doctors each seeing that two doctors are on call and each taking themselves off, leaving zero. Snapshot isolation misses it because its conflict detection is per row written, and here the two transactions write disjoint rows — the real conflict is between one transaction's write and the other's read predicate, which only serializable isolation tracks.

**Q: How is read skew different from a non-repeatable read?**
Read skew is the multi-row form. Each individual row is read from a genuine committed state, so no single read is wrong, but they are read from two *different* committed states, so the combination represents a state the database was never in. A backup or a report that reads a from-account before a transfer and a to-account after it will record a total that never existed, and unlike a wrong number on a screen, that corruption gets persisted.

**Q: What is lost update and what is the simplest fix?**
Lost update is two transactions reading the same value, each computing a new value from it in application code, and each writing it back, so one update silently overwrites the other. The simplest fix is not to raise the isolation level but to remove the round trip: express it as a single atomic statement like `UPDATE inventory SET on_hand = on_hand - 1`. Where the new value genuinely cannot be computed in SQL, the alternatives are an explicit row lock when reading, or a compare-and-set update whose `WHERE` clause includes the value that was read.
