# Backups and Point-in-Time Recovery — Complete Guide

> "A photo album tells you where everyone stood each Christmas, but only the home video lets you rewind to the second before the vase hit the floor."

---

## Table of Contents

1. [The Problem: The Backup That Was Taken Yesterday](#1-the-problem-the-backup-that-was-taken-yesterday)
2. [The Photo Album and Home Video Analogy](#2-the-photo-album-and-home-video-analogy)
3. [The Mechanism: Logical Dumps and Physical File Copies](#3-the-mechanism-logical-dumps-and-physical-file-copies)
4. [Diagram: A Week of Full Incremental and Differential Backups](#4-diagram-a-week-of-full-incremental-and-differential-backups)
5. [Code Walkthrough: Recovering Past a Bad DELETE](#5-code-walkthrough-recovering-past-a-bad-delete)
6. [Comparing Logical Backups to Physical Backups](#6-comparing-logical-backups-to-physical-backups)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Backup That Was Taken Yesterday

Lesson 1 covered the crash the database can fix by itself: the process dies, restarts, and the log puts the data files right. This lesson is about the failures the log alone cannot repair — a dropped table, a disk that never comes back, an `UPDATE` with a typo in its `WHERE` clause. The engine faithfully replayed those; they were committed, legitimate transactions.

### The Restore Everyone Assumes They Have

```text
02:00  nightly dump completes           orders: 4,180,332 rows
14:32  DELETE FROM orders WHERE 1=1     orders:         0 rows
14:47  a support ticket arrives
14:52  the nightly dump is restored     orders: 4,180,332 rows
         ↳ correct as of 02:00 — and every order placed between
           02:00 and 14:32 is gone. 12.5 hours of real business
           destroyed by the fix, not by the incident.
```

### What's Missing

A backup taken once a night is a series of still frames with twelve-hour gaps between them, and restoring one means accepting everything since as collateral damage. What is missing is a way to land on an arbitrary instant — 14:31:59, one second before the mistake — rather than on whichever scheduled snapshot happens to be nearest.

---

## 2. The Photo Album and Home Video Analogy

A family photo album has one picture per Christmas: complete, self-contained, and useless for answering "what happened in the thirty seconds before the vase fell?" A home video answers that, but only if you also know which frame to start playing from — the tape alone, with no reference point, is just motion with no anchor.

### Album Page vs Video Frame

```text
Album page    → a complete picture of one moment, standing alone, but
                only for the handful of moments someone chose to shoot
Video reel    → every moment in between, in order, but meaningless
                without a starting picture to play forward from
Together      → open the album at the last Christmas before the vase
                broke, then roll the tape forward and stop one second
                short of the crash
```

### Mapping the Analogy to Backups

The album page is a base backup — a full copy of the data files at one instant. The video reel is the archived write-ahead log, the same log from Lesson 1, shipped off-machine as it fills. Neither gives point-in-time recovery alone. Together they do: restore the base backup, then replay archived log records forward and stop at a chosen timestamp.

---

## 3. The Mechanism: Logical Dumps and Physical File Copies

There are two fundamentally different things people call "a backup", and they restore differently, take different amounts of time, and survive different kinds of version change.

### A Logical Dump

```sql
-- A logical dump is a re-executable description of the data, not the
-- bytes on disk. Restoring it means running these statements.
CREATE TABLE orders (
  id          BIGINT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  total_cents INTEGER NOT NULL,
  placed_at   TIMESTAMP NOT NULL
);
INSERT INTO orders VALUES (1, 88, 4500, '2026-08-07 09:14:02');
INSERT INTO orders VALUES (2, 91, 12300, '2026-08-07 09:14:11');
-- ...4,180,330 more, then every index rebuilt from scratch
```

### A Physical File Copy

```bash
# A physical backup copies the data directory itself — pages, indexes,
# and internal structures, byte for byte. Nothing is re-parsed on restore.
$ ls /var/lib/database/data
  base/  pg_wal/  global/  pg_tblspc/  postgresql.conf
# PostgreSQL's base-backup tool is one concrete example of the idea;
# every engine ships an equivalent under a different name.
$ pg_basebackup -D /backups/base-2026-08-08 -Ft -z -P
```

### Why a Naive File Copy Is Not a Backup

```text
$ cp -r /var/lib/database/data /backups/naive   # while the DB is running
  ↳ cp reads base/16384 at 02:00:03 and pg_wal/ at 02:04:41. In those
    four minutes the engine split a B+ tree page, moved rows between
    pages, and checkpointed twice.
The copy holds page 118 from 02:00:03 and page 119 from 02:04:41 — two
halves of an index that never coexisted. Nothing detects this at copy
time; it surfaces as corruption during the restore you needed. A usable
physical backup requires either a coordinated backup mode that records
a start LSN and archives every log record written during the copy, or a
storage-level atomic snapshot of the whole volume at once.
```

---

## 4. Diagram: A Week of Full Incremental and Differential Backups

Full backups are simple and expensive. Incremental and differential backups both reduce what is stored each night, but they trade storage against how many files a restore has to chain.

### A Week Against a 100 GB Database

```text
              Sun      Mon     Tue     Wed     Thu     Fri     Sat
FULL          ██100G   ██100G  ██100G  ██100G  ██100G  ██100G  ██100G
              700 GB stored for the week; restore = 1 file

INCREMENTAL   ██100G   ░4G     ░6G     ░3G     ░5G     ░4G     ░2G
              each ░ holds only what changed since the PREVIOUS backup
              124 GB stored; restore of Thu = Sun+Mon+Tue+Wed+Thu (5)

DIFFERENTIAL  ██100G   ░4G     ░░10G   ░░13G   ░░18G   ░░22G   ░░24G
              each ░ holds everything changed since the last FULL
              191 GB stored; restore of Thu = Sun+Thu (2 files)
```

### Reading the Diagram

Incremental stores the least and restores the slowest, because every link in the chain must be applied in order and one missing or corrupt link breaks everything after it. Differential stores more each night — Saturday's file re-includes Monday's changes — but a restore never touches more than two files. Full is the most storage and the fastest, simplest restore. None of the three lets you land between two scheduled runs; that needs Section 5.

---

## 5. Code Walkthrough: Recovering Past a Bad DELETE

Continuous archiving is the base backup plus every log segment produced since it. Because the log is a complete, ordered record of every change (Lesson 1), replaying it partway lands on any instant in between.

### Setting Up Continuous Archiving

```bash
# 1. Every filled log segment is shipped somewhere durable and off-host.
#    Illustrative PostgreSQL settings; the concept is engine-agnostic.
archive_mode    = on
archive_command = 'aws s3 cp %p s3://acme-db-archive/wal/%f'

# 2. A base backup every night — the anchor the replay starts from.
$ pg_basebackup -D /backups/base-2026-08-08 -Ft -z -P
#    ↳ 02:00. Without this, the archived log has nothing to apply to.
```

### The Timeline of the Incident

```text
02:00:00  base backup completes                    ← the anchor
02:00 →   log segments archived continuously to s3://acme-db-archive
14:31:59  last known-good state — 4,180,332 orders
14:32:07  DELETE FROM orders WHERE 1=1    (committed, replicated)
14:47:00  a support ticket arrives; the table is empty
            ↳ the replica has the same empty table. Replication
              copied the mistake faithfully within milliseconds.
```

### Restoring to 14:31

```bash
# 3. Restore the 02:00 base backup into a NEW data directory. Never
#    restore over the damaged one — it is evidence and a fallback.
$ tar -xzf /backups/base-2026-08-08/base.tar.gz -C /var/lib/db-restore

# 4. Tell recovery where to fetch archived segments and when to stop.
restore_command      = 'aws s3 cp s3://acme-db-archive/wal/%f %p'
recovery_target_time = '2026-08-08 14:31:59'
#    ↳ recovery replays every archived record in LSN order and halts
#      at the first transaction that committed after this timestamp.
#      The 14:32:07 DELETE is on the tape but is never applied.

# 5. Start the instance, verify, then promote it to accept writes.
$ SELECT count(*) FROM orders;   -- 4,180,332
```

---

## 6. Comparing Logical Backups to Physical Backups

Both produce a file you can restore from, and most serious setups keep both, because the failures they cover barely overlap.

### Logical vs Physical

| | Logical Dump | Physical Copy |
|---|---|---|
| What it contains | Statements or rows that rebuild the data | The data files byte for byte |
| Restore cost | Slow — every row re-inserted, every index rebuilt | Fast — copy files back and start |
| Portability | Restores into a different major version, and often a different engine | Usually same engine, often same major version and page layout |
| Granularity | One table or one schema can be restored alone | All or nothing — the whole cluster |
| Supports PITR | No — it is a snapshot with no log stream behind it | Yes, when paired with continuous log archiving |
| Corruption carry-over | Reads through the engine, so page-level corruption is not copied | Copies corrupt pages verbatim into the backup |

### Takeaway

Physical backups plus archived log are the operational answer: fast restores and any-second recovery. Logical dumps are the escape hatch physical backups cannot provide — restoring one table without touching the rest, moving to a new major version, or rebuilding after page corruption that a physical copy would have faithfully preserved. Weekly logical dumps alongside daily physical ones cost little and cover a real gap.

---

## 7. Common Mistakes

- **Copying the data directory of a running database with `cp` or `rsync`.** The copy is stitched together from bytes read at different instants, so it contains index pages and heap pages that never coexisted. It completes without error, reports a plausible size, and fails only during the restore — which is the one moment there is no fallback. Use the engine's coordinated backup mode or an atomic volume snapshot.
- **Archiving the log but never taking a fresh base backup.** The log is only useful applied to something. If the base backup is four months old, point-in-time recovery means replaying four months of log records, which can take longer than the outage it was supposed to shorten — and it silently assumes every segment in those four months is still present and readable.
- **Deleting log segments on a schedule instead of on a condition.** A segment can only be discarded once the change it describes is in a base backup that is still within retention. A "delete anything older than 7 days" rule combined with a weekly base backup will eventually remove the segments that connect the last base backup to the present, leaving a gap that makes PITR stop early.
- **Restoring on top of the damaged instance.** The damaged data directory is both evidence for the post-mortem and the fallback if the restore itself is bad. Restore into a new directory, verify row counts and a few known records, and only then redirect traffic.

---

## 8. Hands-On Exercises

**Exercise 1:** Take a logical dump of a database with at least a million rows and time it. Restore it into an empty database and time that separately. Record the ratio — restore is usually several times slower than dump, because every index is rebuilt from scratch.

**Exercise 2:** Take a physical base backup of the same database using your engine's own base-backup tool, and compare both its size and its restore time against the logical dump from Exercise 1.

**Exercise 3:** Reproduce the first mistake in Section 7. With the database under a continuous write load, `cp -r` the data directory to another path, then start an instance against the copy. Record exactly what it reports — most engines refuse to start or report a checksum failure, and that message is what an untested backup looks like at 3am.

**Exercise 4:** Enable log archiving to a local directory, take a base backup, then run a `DELETE` you can identify by timestamp. Restore the base backup into a fresh directory with a recovery target time one second before the `DELETE` and confirm the rows are present.

**Exercise 5:** Repeat Exercise 4 but delete one archived log segment from the middle of the archive before starting recovery. Observe where recovery stops and what it reports, then reason about how much data a single missing segment cost.

---

## 9. Interview Q&A

**Q: What is the difference between a logical and a physical backup?**
A logical backup is a re-executable description of the data — statements or rows — so restoring it means running those statements and rebuilding every index from scratch. A physical backup copies the data files byte for byte, so restoring is just putting the files back and starting the engine. Logical is slow to restore but portable across major versions and sometimes engines, and it can restore a single table; physical is fast but generally tied to the same engine and page layout, and it is all-or-nothing.

**Q: What is the difference between an incremental and a differential backup?**
An incremental backup stores only what changed since the previous backup of any kind, so a week of them forms a chain and restoring Thursday means applying Sunday's full plus every incremental up to Thursday. A differential stores everything changed since the last full backup, so each night's file is larger than the one before but a restore only ever needs the full plus one differential. Incremental minimizes storage and maximizes restore complexity and chain fragility; differential trades storage back for a two-file restore.

**Q: What does point-in-time recovery actually require?**
Two things that are useless separately: a base backup, which is a full physical copy anchored at a known instant, and a continuous archive of every write-ahead log segment produced since. Recovery restores the base backup into a fresh directory, then replays archived log records in LSN order and stops at a configured target timestamp. That is what lets you land at 14:31:59 rather than at whichever nightly snapshot happens to be nearest.

**Q: Why is copying a running database's files with `rsync` not a valid backup?**
Because the copy is not a consistent view of any single instant — files read at the start and end of the copy are minutes apart, and in between the engine split pages, moved rows, and checkpointed. You end up with an index page that references a heap page as it existed four minutes later, which no recovery process can reconcile. The copy looks fine and only fails at restore time, so you need either the engine's coordinated backup mode, which records a start LSN and archives the log written during the copy, or an atomic volume snapshot.

**Q: If you have a replica, do you still need backups?**
Yes, because a replica protects against a machine or datacenter failing, not against a mistake. A `DELETE` with no `WHERE` clause is a legitimate committed transaction, and replication will apply it on every replica within milliseconds — the failure mode is faithfully copied. Only a backup with a log archive lets you go back to before the mistake, and only a logical dump lets you pull back one table without rolling everything else back with it.
