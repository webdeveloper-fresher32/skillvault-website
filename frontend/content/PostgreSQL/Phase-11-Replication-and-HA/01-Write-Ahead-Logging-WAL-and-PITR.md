# 01 — Write-Ahead Logging (WAL) & Point-In-Time Recovery (PITR)

## Table of Contents
1. [The Fundamental Law of Write-Ahead Logging](#1-the-fundamental-law-of-write-ahead-logging)
2. [WAL Structure: Segments, Records & Log Sequence Numbers (LSN)](#2-wal-structure-segments-records--log-sequence-numbers-lsn)
3. [The Checkpointing Process](#3-the-checkpointing-process)
4. [WAL Archiving Strategy](#4-wal-archiving-strategy)
5. [Taking Base Backups with `pg_basebackup`](#5-taking-base-backups-with-pg_basebackup)
6. [Executing a Point-In-Time Recovery (PITR)](#6-executing-a-point-in-time-recovery-pitr)
7. [Hands-On Verification](#7-hands-on-verification)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The Fundamental Law of Write-Ahead Logging

Writing dirty 8KB data pages directly to random locations on disk upon every `COMMIT` would destroy performance because random disk I/O is orders of magnitude slower than sequential I/O.

PostgreSQL solves this using **Write-Ahead Logging (WAL)**:
> **The WAL Law:** Before any change (insert, update, delete) can be written to the table data files on disk, a sequential description of that change must first be flushed and fsynced to the append-only Write-Ahead Log.

If power cuts out or the OS crashes, table data files might be corrupted or outdated, but the WAL on disk contains an unbroken, durable ledger of all committed operations. During reboot, PostgreSQL replays the WAL to restore 100% database consistency.

---

## 2. WAL Structure: Segments, Records & Log Sequence Numbers (LSN)

- **WAL Segments:** Stored in `$PGDATA/pg_wal/` as contiguous **16MB binary files** (e.g. `000000010000000A0000002F`).
- **Log Sequence Number (LSN):** A 64-bit integer representing a byte offset position in the WAL stream (e.g. `16/B374D848`).
  - Every 8KB page in `shared_buffers` records the LSN of the last transaction that touched it in its page header (`pd_lsn`).

```sql
-- Check current write LSN:
SELECT pg_current_wal_lsn();

-- Check current WAL file name:
SELECT pg_walfile_name(pg_current_wal_lsn());
```

---

## 3. The Checkpointing Process

Dirty pages in `shared_buffers` cannot stay in RAM indefinitely. Periodically, the **Checkpointer** process runs:
1. Flushes all dirty shared buffer pages to disk.
2. Issues an `fsync()` system call to ensure operating system disk controller caches are committed to persistent physical media.
3. Writes a **checkpoint record** to the WAL.
4. Old WAL segments older than the checkpoint are marked for deletion or recycled.

### Tuning Checkpoints in `postgresql.conf`:
```ini
checkpoint_timeout = 15min          # Time between automatic checkpoints
max_wal_size = 16GB                 # Max WAL accumulated before forcing checkpoint
checkpoint_completion_target = 0.9  # Spread disk I/O over 90% of checkpoint_timeout (13.5 min)
```

---

## 4. WAL Archiving Strategy

For disaster recovery, completed 16MB WAL segment files are continuously shipped to durable object storage (e.g. AWS S3, Google Cloud Storage):

```ini
# In postgresql.conf:
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /mnt/nfs_wal/%f && cp %p /mnt/nfs_wal/%f'
# Or using enterprise tooling like pgBackRest:
# archive_command = 'pgbackrest --stanza=main archive-push %p'
```

---

## 5. Taking Base Backups with `pg_basebackup`

A **Base Backup** is a complete physical filesystem copy of the `$PGDATA` directory taken while the database is actively accepting live read and write queries:

```bash
pg_basebackup -h localhost -U replicator -D /var/backups/pg_base_20260601 -Ft -z -P -R
```
- `-Ft`: Output tar archives.
- `-z`: Gzip compression.
- `-P`: Show progress bar.
- `-R`: Automatically generate `standby.signal` connection settings.

---

## 6. Executing a Point-In-Time Recovery (PITR)

Suppose a developer accidentally runs `DROP TABLE users;` at **`2026-06-15 14:32:10 UTC`**.

With PITR, you can recover the cluster to **`2026-06-15 14:32:05 UTC`** (5 seconds before the disaster!):

### Step 1: Restore the latest Base Backup
Extract your Sunday night base backup tar into a clean `$PGDATA` directory.

### Step 2: Create Recovery Configuration
In `$PGDATA/postgresql.conf`:
```ini
restore_command = 'cp /mnt/nfs_wal/%f %p'
recovery_target_time = '2026-06-15 14:32:05+00'
recovery_target_action = 'promote'
```

### Step 3: Start PostgreSQL
PostgreSQL will:
1. Boot into recovery mode.
2. Read WAL segments sequentially from the archive.
3. Replay every transaction until precisely `14:32:05 UTC`.
4. Stop replaying, promote the instance to a read-write primary, and resume normal traffic with zero lost tables!

---

## 7. Hands-On Verification

```sql
-- 1. Create a bookmark test table
CREATE TABLE pitr_demo (id SERIAL, val TEXT, created_at TIMESTAMPTZ DEFAULT now());
INSERT INTO pitr_demo (val) VALUES ('Initial state');

-- 2. Force a manual WAL file switch:
SELECT pg_switch_wal();

-- 3. Measure distance between two LSNs in bytes:
SELECT pg_wal_lsn_diff('16/B374D848', '16/B2000000') AS bytes_written;
```

---

## 8. Summary & Key Takeaways

1. Changes are always written to the sequential WAL stream before touching table data pages.
2. LSNs are monotonically increasing 64-bit pointers tracking transaction offsets.
3. Spread checkpoint I/O using `checkpoint_completion_target = 0.9` to prevent disk saturation.
4. Continuous WAL archiving combined with weekly base backups enables **Point-In-Time Recovery (PITR)** to any exact second.
