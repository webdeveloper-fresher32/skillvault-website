# Schema Migrations and Zero-Downtime Change — Complete Guide

> "Replacing the water pipes in an occupied apartment block means running the new line alongside the old one and switching flats over one at a time — not shutting the water off for a week."

---

## Table of Contents

1. [The Problem: The ALTER That Took the Site Down](#1-the-problem-the-alter-that-took-the-site-down)
2. [The Occupied Building Plumbing Analogy](#2-the-occupied-building-plumbing-analogy)
3. [The Mechanism: Blocking Versus Online Operations](#3-the-mechanism-blocking-versus-online-operations)
4. [Diagram: The Expand and Contract Timeline](#4-diagram-the-expand-and-contract-timeline)
5. [Code Walkthrough: Renaming a Column Without Downtime](#5-code-walkthrough-renaming-a-column-without-downtime)
6. [Comparing Expand and Contract to a Single ALTER](#6-comparing-expand-and-contract-to-a-single-alter)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The ALTER That Took the Site Down

The migration ran fine against a development database with 400 rows. Against the 80-million-row production `orders` table, it took a lock, held it for eleven minutes, and every request that touched orders queued behind it until connections ran out.

### One Statement, One Outage

```text
14:02:00  ALTER TABLE orders ALTER COLUMN status TYPE varchar(32);
          → engine begins rewriting all 80M rows into a new file
14:02:01  → SELECT ... FROM orders waits on the table lock
14:02:04  → connection pool (Phase 11) exhausted; requests error
14:13:20  → ALTER completes; site recovers
  ↳ 11m20s of downtime from a statement that returned no error and
    did exactly what it was asked to do.
```

### What's Missing

Nothing here was a bug. The statement was correct, the tests passed, and the rollback plan — "run the reverse migration" — would itself have taken another eleven minutes under the same lock. What is missing is a way to change a schema in steps small enough that no single step is ever long or exclusive, and a deploy sequence that keeps old and new application code both working while the change is in progress.

---

## 2. The Occupied Building Plumbing Analogy

A plumber replacing the risers in an occupied apartment block does not cut the water to the building. The new pipe is run alongside the old one, both are pressurised, each flat is switched over to the new line one at a time, and only once every tap is fed from the new pipe does anyone remove the old one.

### Cut the Water vs Run a Parallel Line

```text
Cut the water   → one short job on paper, but the whole block is dry
                  for its full duration, and if it overruns there is
                  no way back except finishing
Parallel line   → more steps and more total work, but every flat has
                  water from one pipe or the other at every moment,
                  and any step can be stopped
```

### Mapping the Analogy to Schema Change

The old pipe is the existing column, the new pipe is the new column, "both pressurised" is the dual-write period, switching flats over is the read cutover, and removing the old pipe is the drop. This pattern is called expand/contract, or parallel change, and its defining property is that no intermediate state is broken.

---

## 3. The Mechanism: Blocking Versus Online Operations

An operation is blocking when it holds a lock that other queries need for as long as the work takes, and the work is proportional to table size. It is online when the engine can do the work in the background while normal reads and writes continue.

### What Makes an Operation Blocking

```text
Usually cheap and near-instant (metadata only):
  ADD COLUMN, no default or a constant default stored once
  DROP COLUMN, where the engine marks it dead rather than rewriting
Usually expensive, proportional to row count:
  ADD COLUMN NOT NULL with a computed or volatile default
  ALTER COLUMN TYPE (varchar(32) → text, int → bigint)
  ADD a foreign key or CHECK constraint that validates every row
  ADD INDEX without the online/concurrent option
  ↳ The exact classification is engine- and version-specific. Never
    assume: check your engine's docs and rehearse on a full-size copy.
```

### Online Operations and What They Still Cost

```text
An "online" index build does not block writes, but it still reads
every row (competing for I/O and buffer pool, Phase 5), locks briefly
at start and end, and can fail partway leaving an invalid index.
  ↳ Online means "not exclusive". Not free, and not safe at peak.
```

### Backward and Forward Compatibility During a Rolling Deploy

```text
During a rolling deploy, two application versions run at once:
  time →   pod A: v1  v1  v2  v2
           pod B: v1  v2  v2  v2
           schema:  S1 ─── S2 ────
  ↳ Every schema state must be readable AND writable by both the
    version before it and the version after it — why a rename is
    never one step.
```

---

## 4. Diagram: The Expand and Contract Timeline

### Six Steps, Each With Its Own Deploy

```text
STEP 1  migration: ADD COLUMN status_code (nullable, no default)
   │    both columns exist; app v1 ignores the new one
   ▼
STEP 2  deploy v2: write BOTH columns, read the OLD one
   ▼
STEP 3  backfill: copy old → new in batches, old rows only
   │    runs for hours if needed; nothing waits on it
   ▼
STEP 4  verify: rows with new IS NULL and old IS NOT NULL must be 0
   ▼
STEP 5  deploy v3: read the NEW column, still write both
   │    ← reversible point: revert v3 to go back
   ▼
STEP 6  deploy v4: write only the NEW column, then wait days
   ▼
STEP 7  migration: DROP COLUMN status (irreversible)
```

### Reading the Diagram

Steps 2, 5 and 6 are application deploys; steps 1, 3 and 7 are database migrations, and they alternate deliberately. The reversible window runs from step 1 to step 6: up to the moment the old column stops being written, going back is a code revert with no data loss. After step 7 there is no going back without a restore, which is why it is a separate deploy days later, not the tail of the same one.

---

## 5. Code Walkthrough: Renaming a Column Without Downtime

Renaming `orders.status` (free text) to `orders.status_code` (a constrained code) is the canonical example, because a single `RENAME` would break every running instance of the old application version the instant it lands.

### The Six Steps as SQL and Deploys

```sql
-- STEP 1 (migration 20250311_01): expand. Nullable, no default, so
-- the engine touches metadata only and returns at once.
ALTER TABLE orders ADD COLUMN status_code varchar(16);
```

```python
# STEP 2 (app v2): dual-write. Old column still authoritative for reads.
def save_order_status(order_id, status):
    db.execute("UPDATE orders SET status = :s, status_code = :c "
               "WHERE id = :id",
               {"s": status, "c": STATUS_CODES[status], "id": order_id})
```

```sql
-- STEP 5 (v3) reads status_code. STEP 6 (v4) drops `status` from the
-- UPDATE above. STEP 7, days later:
ALTER TABLE orders DROP COLUMN status;
```

### Backfilling Without Saturating I/O

```sql
-- STEP 3: never update every NULL row in one statement — one huge
-- transaction holds locks and floods the WAL (Phase 9). Batch it:
UPDATE orders
SET status_code = upper(status)
WHERE id BETWEEN :lo AND :lo + 4999
  AND status_code IS NULL;
-- commit, sleep 200ms, advance :lo by 5000, repeat.

-- STEP 4 gate: this must return 0 before any read is switched over.
SELECT count(*) FROM orders WHERE status_code IS NULL;
```

---

## 6. Comparing Expand and Contract to a Single ALTER

Both approaches end at the same schema. They differ in how many intermediate states exist, and whether any of those states is broken.

### Expand/Contract vs One-Shot ALTER

| | Expand and contract | Single ALTER in one deploy |
|---|---|---|
| Steps, and longest lock held | 6–7 over days, milliseconds each | 1, held minutes to hours, proportional to rows |
| Rolling deploy safe | Yes — every state works for both app versions | No — old pods break the moment it lands |
| Reversible | Yes, until the drop | Only by running an equally long reverse ALTER |
| Blast radius if wrong | One step, revertible | The whole table, during the outage |

### What a Migration Tool Must Give You

```text
versioned   → unique ordered id per migration; the database records
              which ones have been applied
ordered     → applied in the same sequence everywhere, always
idempotent  → re-running an applied migration is a no-op, not a
              duplicate column or a hard error
reversible  → a down-migration where one can exist, marked impossible
              where it cannot (a DROP COLUMN's "reverse" recreates
              the column, never the data)
```

### Takeaway

"Roll back the migration" is a reasonable plan for a schema change that added something and a bad plan for anything that removed or transformed data, because the reverse migration restores structure, not content. The real rollback strategy is the sequencing itself: keep the old column written and populated until the new path has been in production long enough to trust, so that rolling back is a code revert rather than a data recovery. Once you have dropped the old column, your rollback plan is your backup and point-in-time recovery (Phase 9), and it should be tested before the drop, not after.

---

## 7. Common Mistakes

- **Testing a migration only against a small development database.** Lock duration and rewrite cost scale with row count, so a migration that finishes in 20 milliseconds against 400 rows tells you nothing about the same statement against 80 million. Rehearse against a restored production-sized copy and record the actual duration before scheduling it.
- **Backfilling in one enormous statement.** A single `UPDATE` over every row holds locks for its whole duration, generates write-ahead log faster than replicas can consume it, and if it fails at 90% it rolls all of it back. Batch by primary key, commit per batch, pause between batches, and make the job restartable from where it stopped.
- **Deploying the code and the migration as one atomic unit.** During a rolling deploy both versions are live simultaneously, so any schema state that only the new code understands will break the old pods still serving traffic. Migrations and deploys have to alternate, with each intermediate state working for both.
- **Dropping the old column in the same release that switches the reads.** That collapses the reversible window to zero. If the new column turns out to have a backfill bug, the fix is now a restore instead of a revert — wait days between the read switch and the drop.

---

## 8. Hands-On Exercises

**Exercise 1:** Create a table with 5 million generated rows, then time `ALTER TABLE ... ADD COLUMN x int` (nullable, no default) against `ALTER TABLE ... ALTER COLUMN some_varchar TYPE text`. Record both durations and, from a second session, run a `SELECT` during each to see which one blocks.

**Exercise 2:** Write out the full expand/contract sequence for splitting a `users.full_name` column into `first_name` and `last_name`, labelling each of the seven steps as either a migration or a deploy, and naming what breaks if two adjacent steps are swapped.

**Exercise 3:** Implement the batched backfill from Section 5 as a loop that processes 5,000 rows per transaction with a pause between batches. Kill it halfway, then restart it and confirm it resumes correctly rather than redoing completed work.

**Exercise 4:** Write a down-migration for a `DROP COLUMN` and then explain in one paragraph, in the migration file itself, exactly what it does and does not restore.

**Exercise 5:** Deliberately reproduce the third mistake in Section 7. With the old application version still running against the table, apply a migration that renames a column it selects, and observe the errors the old version produces — then redo it as an expand/contract sequence and confirm both versions stay healthy throughout.

---

## 9. Interview Q&A

**Q: Why can a simple ALTER TABLE take a production site down?**
Because some schema changes require the engine to rewrite every row, and while that rewrite happens it holds a lock other queries need. The work is proportional to table size, so a statement that returns instantly against a development database can hold an 80-million-row table for ten minutes, and every request touching it queues until the connection pool is exhausted. Which operations are cheap and which are rewrites is engine- and version-specific, so the only reliable answer is to check the documentation and rehearse against a production-sized copy.

**Q: Walk me through the expand/contract pattern.**
Add the new column as nullable with no default, so the migration is metadata-only. Deploy code that writes both the old and new columns while still reading the old one. Backfill the historical rows in batches, then verify the backfill is complete as an explicit gate. Deploy code that reads the new column but still writes both — this is the last fully reversible point. Days later, deploy code that stops writing the old column, and only then drop it.

**Q: How do you backfill a very large table without hurting production?**
In batches, driven by the primary key, with one transaction per batch and a deliberate pause between them. A single statement over all rows holds locks for its entire duration, produces write-ahead log faster than replicas can apply it, and rolls everything back if it fails near the end. The job should also be restartable, so that killing it and starting it again resumes rather than repeats, and its batch size and pause should be tunable while it runs.

**Q: Why can't you just deploy the code and the migration together?**
Because a rolling deploy runs two application versions at the same time, so for a window of minutes the old code and the new code are both talking to whatever schema is live. Every intermediate schema state therefore has to be both readable and writable by the version before and the version after. That constraint is the entire reason a rename becomes six steps instead of one.

**Q: What is your rollback plan for a migration?**
For an additive change, reverting the migration is fine. For anything that removes or transforms data, "reverse the migration" is not a plan, because the down-migration restores structure and not content — recreating a dropped column gives you an empty column. The real strategy is the sequencing: keep the old column written and populated until the new path has been trusted in production for days, so rollback is a code revert. After the drop, the only rollback is point-in-time recovery from backup, which is exactly why the drop is deliberately the last and latest step.
