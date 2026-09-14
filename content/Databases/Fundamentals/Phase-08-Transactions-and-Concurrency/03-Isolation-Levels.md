# Isolation Levels — Complete Guide

> "A hostel dorm, a shared office, a private office and a soundproof studio all give you a desk — what they differ on is how much of everyone else you are forced to notice."

---

## Table of Contents

1. [The Problem: Serial Execution Would Be Correct and Far Too Slow](#1-the-problem-serial-execution-would-be-correct-and-far-too-slow)
2. [The Rented Workspace Analogy](#2-the-rented-workspace-analogy)
3. [The Mechanism: Levels Defined by the Anomalies They Permit](#3-the-mechanism-levels-defined-by-the-anomalies-they-permit)
4. [Diagram: The Ladder of Isolation Levels](#4-diagram-the-ladder-of-isolation-levels)
5. [Code Walkthrough: Setting and Observing the Level](#5-code-walkthrough-setting-and-observing-the-level)
6. [Comparing READ COMMITTED to SERIALIZABLE](#6-comparing-read-committed-to-serializable)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Serial Execution Would Be Correct and Far Too Slow

Lesson 2 showed six ways concurrent transactions produce outcomes no serial order allows. There is an obvious fix — run transactions one at a time — and an obvious reason nobody does it.

### The Cost of the Obvious Fix

```text
One at a time, each transaction taking 4 ms of work plus a 1 ms commit
flush → a ceiling near 200 transactions/second on any hardware, because
CPUs and disks sit idle while one transaction thinks

Fifty concurrent transactions → throughput bounded by real resources
instead of by the queue, at the cost of every anomaly in Lesson 2
```

### What's Missing

The choice is not "correct" versus "fast" — it is a dial, and what is missing is a vocabulary for the settings on it. Isolation levels are that vocabulary: each one is a named promise about which of Lesson 2's anomalies the engine will not let you observe.

---

## 2. The Rented Workspace Analogy

Every desk gets you somewhere to work. A hostel dorm lets you hear half-finished conversations you were never meant to hear; a shared office at least keeps the private meetings behind a door; a private office means nobody rearranges your desk while you are at lunch; a soundproof studio means the rest of the building might as well not exist.

### What Each Space Blocks Out

```text
Hostel dorm       → you overhear plans that get abandoned an hour later
Shared office     → you only hear decisions once they are announced
Private office    → what you left on your desk is there when you return
Soundproof studio → your day is identical whether or not anyone else
                    came to work; costs the most and seats the fewest
```

### Mapping the Analogy to Isolation Levels

Overheard-then-abandoned plans are dirty reads. Hearing only announcements is READ COMMITTED. A desk nobody rearranges is REPEATABLE READ. The soundproof studio is SERIALIZABLE — perfect, and the reason nobody puts a whole company in one is the same reason nobody runs every workload there.

---

## 3. The Mechanism: Levels Defined by the Anomalies They Permit

The SQL standard does not define these levels by how an engine works. It defines them by which phenomena a transaction running at that level is allowed to observe, which is why the definition is a table and not an algorithm.

### The Standard Anomaly Matrix

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| READ UNCOMMITTED | Permitted | Permitted | Permitted |
| READ COMMITTED | Not permitted | Permitted | Permitted |
| REPEATABLE READ | Not permitted | Not permitted | Permitted |
| SERIALIZABLE | Not permitted | Not permitted | Not permitted |

### What the Matrix Leaves Out

```text
The standard's table names exactly three phenomena. It does not name:
  lost update  → not in the table at all
  read skew    → not in the table at all
  write skew   → not in the table at all
  ↳ A level is "correct" per the standard while still permitting all
    three. This gap is the point of Berenson et al.'s 1995 critique of
    the ANSI definitions, and it is why SERIALIZABLE is best read as
    its other definition — the result must equal some serial order —
    rather than as "the row of the table with three No entries".
```

### Why the Names Are Not Portable

```text
Same name, different guarantee, depending on the engine:
  REPEATABLE READ  → in a locking engine: rows you read stay locked,
                     phantoms remain possible, exactly as the table says
                   → in a snapshot engine: your whole transaction reads
                     one frozen snapshot, so phantoms do not appear
                     either — stronger than the standard requires
  SERIALIZABLE     → sometimes strict two-phase locking (blocks)
                   → sometimes serializable snapshot isolation (does not
                     block, aborts a conflicting transaction at commit)
  READ UNCOMMITTED → some engines do not implement it at all and simply
                     give you READ COMMITTED without complaining
  ↳ Ask what your engine does at a level; never port an assumption.
```

---

## 4. Diagram: The Ladder of Isolation Levels

### The Ladder as Nested Guarantees

```text
┌─ READ UNCOMMITTED ───────────────────────────────────────────┐
│ may observe data no transaction ever committed               │
│ ┌─ READ COMMITTED ─────────────────────────────────────────┐ │
│ │ every read sees committed data only — but a fresh view   │ │
│ │ per statement, so two reads can disagree                 │ │
│ │ ┌─ REPEATABLE READ ────────────────────────────────────┐ │ │
│ │ │ a row you have read will not change under you;       │ │ │
│ │ │ per the standard, new rows may still appear          │ │ │
│ │ │ ┌─ SERIALIZABLE ───────────────────────────────────┐ │ │ │
│ │ │ │ outcome equals some serial order of the          │ │ │ │
│ │ │ │ transactions; nothing outside this box is        │ │ │ │
│ │ │ │ observable, including write skew                 │ │ │ │
│ │ │ └──────────────────────────────────────────────────┘ │ │ │
│ │ └──────────────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
   inner box → fewer anomalies permitted, less concurrency
```

### Reading the Diagram

The boxes nest, so the guarantees accumulate: anything REPEATABLE READ forbids, SERIALIZABLE also forbids. Moving inward never permits something a weaker level prevented, which is why raising the level is always safe for correctness and never free for throughput. Note that only the innermost box is defined by an outcome rather than by a list of forbidden phenomena — that is the difference that makes it the only level which covers write skew.

---

## 5. Code Walkthrough: Setting and Observing the Level

Isolation is set per transaction or per session, and the setting applies to the transaction that reads — not to the one that writes.

### Setting the Level

```sql
-- Illustrative standard SQL
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;   -- next transaction only
START TRANSACTION;
  SELECT price FROM products WHERE sku = 'KB-87';
  SELECT price FROM products WHERE sku = 'KB-87';  -- must match the first
COMMIT;

-- Session-wide default for every transaction that follows
SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Some engines also accept the mode on the opening statement
START TRANSACTION ISOLATION LEVEL SERIALIZABLE, READ ONLY;
```

### The Same Timeline at Two Levels

```text
   T2 commits UPDATE products SET price = 99.00 between T1's two reads.

   T1 at READ COMMITTED
     read 1 → 89.00      read 2 → 99.00      both reads legal
     ↳ each statement gets its own view of committed data

   T1 at REPEATABLE READ
     read 1 → 89.00      read 2 → 89.00      T1 commits, then sees 99.00
     ↳ the view is fixed for the whole transaction, so T1's arithmetic
       is internally consistent even though it is now stale
```

### The Retry Requirement at SERIALIZABLE

```sql
-- Illustrative pattern: any transaction that may be aborted for a
-- serialization conflict has to be retryable by the caller.
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
START TRANSACTION;
  SELECT COUNT(*) FROM on_call WHERE shift_id = 41 AND on_call = true;
  UPDATE on_call SET on_call = false WHERE doctor = 'chen';
COMMIT;   -- may fail with a serialization error; the application must
          -- re-run the whole transaction, not just re-issue the COMMIT
```

---

## 6. Comparing READ COMMITTED to SERIALIZABLE

READ COMMITTED is the default in most engines and SERIALIZABLE is the only level that removes reasoning about anomalies entirely, so the practical decision is almost always between these two.

### READ COMMITTED vs SERIALIZABLE

| | READ COMMITTED | SERIALIZABLE |
|---|---|---|
| Anomalies still possible | Non-repeatable read, phantom, read skew, lost update, write skew | None |
| View of the data | Fresh per statement | Equivalent to running alone |
| Typical failure mode | Silently wrong results | Visible serialization errors under contention |
| Application burden | Guard each invariant by hand — atomic updates, explicit locks | Wrap every transaction in a retry loop |
| Throughput under contention | High | Falls as conflicts rise, from blocking or from aborts and retries |
| Good fit for | Most OLTP work where each statement is self-contained | Multi-row invariants, financial postings, anything write-skew-shaped |

### Takeaway

Start at the engine's default, which is usually READ COMMITTED, and raise the level for the specific transactions that need it rather than globally. Raise to REPEATABLE READ when one transaction reads the same data more than once and must agree with itself — reports, multi-step calculations, exports. Raise to SERIALIZABLE when correctness depends on a rule spanning rows the transaction does not itself write, because that is the write-skew shape and nothing weaker catches it. The cost of SERIALIZABLE is not only slower commits: it is that transactions can now fail for a reason unrelated to their own inputs, so every caller needs a retry path.

---

## 7. Common Mistakes

- **Reading the level name as a portable guarantee.** REPEATABLE READ in a locking engine and REPEATABLE READ in a snapshot engine give measurably different behaviour on the same timeline, and one of them prevents phantoms the standard says are permitted. Test the behaviour you depend on against the engine you are running, and never carry the assumption across a migration.
- **Assuming SERIALIZABLE means transactions run one at a time.** Most implementations run transactions concurrently and only guarantee that the outcome matches *some* serial order. In optimistic implementations that guarantee is delivered by aborting transactions at commit, so code that never retries will fail under load exactly when it matters.
- **Raising the level globally to fix one bug.** Setting the session or server default to SERIALIZABLE to fix one report makes every unrelated transaction pay for it and exposes every caller to serialization failures it was never written to handle. Set it on the transaction that needs it.
- **Believing a higher level fixes lost update.** A read-modify-write done in application code can still lose an update at levels the standard calls strong, because the standard's table never mentions lost update. Fix it with an atomic single-statement update, an explicit locking read, or a compare-and-set `WHERE` clause.

---

## 8. Hands-On Exercises

**Exercise 1:** Query your engine for its default isolation level, then run `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` and confirm the change applies only to the next transaction and not to the one after it.

**Exercise 2:** Reproduce the two-read timeline from Section 5 at READ COMMITTED across two sessions on a `products` table, and record both values session A sees. Repeat at REPEATABLE READ and record them again.

**Exercise 3:** Run the phantom timeline from Lesson 2 at REPEATABLE READ. Record whether your engine actually permits the phantom — the standard says it may, and many engines do not. Write down which answer you got, because that single result tells you which family your engine belongs to.

**Exercise 4:** Reproduce the mistake from Section 7 by running the lost-update timeline from Lesson 2 at REPEATABLE READ with the `SELECT` and the arithmetic in your client. Confirm whether the update is still lost, and note that the anomaly is absent from the standard's matrix entirely.

**Exercise 5:** Run the write-skew `on_call` timeline at SERIALIZABLE in two sessions. Record which session fails and with what error, then write the smallest retry loop that makes the application correct rather than merely failing.

---

## 9. Interview Q&A

**Q: How are isolation levels defined?**
By which phenomena a transaction is permitted to observe, not by any implementation mechanism. The SQL standard names three — dirty read, non-repeatable read and phantom — and each level is a row in a table saying which of those three it permits. That is why two engines can implement the same level with locking and with multi-version snapshots respectively and both be conformant.

**Q: What anomalies does the standard's matrix not cover?**
Lost update, read skew and write skew are absent from it. That means an engine can conform to the definition of a strong-sounding level and still let a read-modify-write in application code silently lose an update, or let two transactions each read a consistent snapshot and then break an invariant between them. It is the main reason the phenomena-based definition has been criticised since the mid-1990s, and the reason serializable is better understood by its other definition: the outcome must equal some serial execution.

**Q: Why is "we use REPEATABLE READ" not a portable statement about behaviour?**
Because the standard sets a floor, not a ceiling, and engines implement above it in different ways. A locking implementation gives you exactly what the table says, including phantoms. A snapshot implementation freezes one view for the whole transaction, so phantoms do not appear in your reads either — stronger than required, and not something you can rely on after moving to a different engine. The safe habit is to ask what a specific engine does at a level rather than to quote the level name.

**Q: What level would you default to, and when would you raise it?**
READ COMMITTED, because it is the default in most engines, it removes dirty reads, and most OLTP transactions are short and statement-scoped enough not to need more. I raise to REPEATABLE READ when a transaction reads the same data more than once and has to agree with itself, such as a report or a multi-step calculation. I raise to SERIALIZABLE when correctness depends on a rule spanning rows the transaction does not write, which is the write-skew shape and the one nothing weaker prevents.

**Q: What does SERIALIZABLE actually cost?**
It costs concurrency, and it changes the failure model. A pessimistic implementation holds more and wider locks, so contending transactions wait; an optimistic implementation lets them run and then aborts one at commit time with a serialization error. Either way throughput falls as contention rises, and in the optimistic case the application must be able to re-run an entire transaction from the beginning — which means side effects such as sending an email cannot sit inside it.
