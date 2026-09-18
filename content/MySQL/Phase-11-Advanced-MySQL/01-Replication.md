# MySQL Replication

## Table of Contents

1. [What Is Replication?](#1-what-is-replication)
2. [Architecture Overview](#2-architecture-overview)
3. [The Binary Log](#3-the-binary-log)
4. [Binary Log Formats](#4-binary-log-formats)
5. [GTID-Based Replication](#5-gtid-based-replication)
6. [Setting Up a Primary](#6-setting-up-a-primary)
7. [Setting Up a Replica](#7-setting-up-a-replica)
8. [Monitoring Replication](#8-monitoring-replication)
9. [Replication Lag](#9-replication-lag)
10. [Semi-Synchronous Replication](#10-semi-synchronous-replication)
11. [Read Scaling Patterns](#11-read-scaling-patterns)
12. [InnoDB Cluster and Group Replication](#12-innodb-cluster-and-group-replication)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. What Is Replication?

Picture this: your entire application runs against one MySQL server. It's midnight, that server's disk fails, and the whole app goes down with it. No reads, no writes, nothing — until someone restores from a backup that might be hours old.

Or a milder version of the same pain: your app is healthy, but it's drowning in SELECT queries. Every dashboard load, every report, every search hits the same single server that's also trying to handle writes. It slows to a crawl under the combined load.

Both problems have the same root cause — everything depends on one server. Replication is MySQL's answer: keep one or more extra copies of the data, kept automatically in sync, so you're never betting the whole app on a single machine.

**Real-world analogy**: think of a manager and a team of assistants. The manager (the **primary**, formerly called master) is the only one who makes decisions — approves changes, writes them into the official log. The assistants (the **replicas**, formerly called slaves) each keep their own copy of that log and replay it, so they always know what the manager decided. Anyone can ask an assistant a read-only question ("what's the current status?"), but only the manager is allowed to make new decisions.

So, in plain terms: **replication is the process of automatically copying every change made on one MySQL server (the primary) to one or more other servers (the replicas).** Every committed write on the primary streams out to the replicas so they end up holding an identical — or near-identical — copy of the data.

### Why Replicate?

| Goal | How replication helps |
|------|-----------------------|
| High availability | If the primary fails, promote a replica to take over |
| Read scaling | Route SELECT queries to replicas, writes to primary |
| Backup isolation | Run backups against a replica — no impact on production |
| Analytics separation | Run slow OLAP queries on a dedicated replica |
| Geographic distribution | Replica closer to users for lower read latency |
| Disaster recovery | Off-site replica survives a data-center failure |

---

## 2. Architecture Overview

So how does the manager-and-assistants picture actually turn into running MySQL processes? Let's zoom into the machinery.

Writes and reads take completely different paths once replication is in play. Writes always go to the primary. Reads get spread across the replicas, usually behind a load balancer so your application doesn't need to know or care which replica answered.

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                        │
│                                                                 │
│  ┌──────────────────┐          ┌───────────────────────────┐   │
│  │  Write traffic   │          │      Read traffic         │   │
│  │  INSERT/UPDATE   │          │      SELECT               │   │
│  │  DELETE/DDL      │          │                           │   │
│  └────────┬─────────┘          └────────────┬──────────────┘   │
└───────────┼────────────────────────────────┼───────────────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐       ┌────────────────────────────────┐
│       PRIMARY         │       │         LOAD BALANCER          │
│  ┌─────────────────┐  │       │   (ProxySQL / HAProxy /        │
│  │   InnoDB        │  │       │    application logic)          │
│  │   Storage       │  │       └──────────┬─────────────────────┘
│  │   Engine        │  │                  │
│  └────────┬────────┘  │       ┌──────────┼──────────────────────┐
│           │           │       │          │                       │
│  ┌────────▼────────┐  │       ▼          ▼                       │
│  │   Binary Log    │  │  ┌─────────┐  ┌─────────┐               │
│  │   (binlog)      │◄─┼──│Replica 1│  │Replica 2│  ...          │
│  └────────┬────────┘  │  │         │  │         │               │
└───────────┼───────────┘  │ Relay   │  │ Relay   │               │
            │              │  Log    │  │  Log    │               │
            └──────────────►│         │  │         │               │
                           │ SQL     │  │ SQL     │               │
                           │ Thread  │  │ Thread  │               │
                           └─────────┘  └─────────┘               │
                           └─────────────────────────────────────┘
```

### Two Threads per Replica

Here's the part people usually get wrong: replication on the replica side is not one thread doing everything. It's two, and they run independently of each other — which turns out to matter a lot when things go wrong.

Every replica runs two background threads:

```
PRIMARY                         REPLICA
────────                        ───────────────────────────────────────
binlog                          ┌─ I/O Thread ──────────────────────┐
  │                             │  Connects to primary               │
  │  network stream             │  Reads binlog events               │
  ├────────────────────────────►│  Writes to relay log               │
  │                             └───────────────────────────────────┘
                                           │
                                           │ relay log on disk
                                           ▼
                                ┌─ SQL Thread ──────────────────────┐
                                │  Reads relay log                   │
                                │  Applies events to InnoDB          │
                                │  Updates replica position          │
                                └───────────────────────────────────┘
```

**I/O thread** — responsible only for fetching events from the primary's binary log and writing them to the local relay log. It maintains a network connection to the primary.

**SQL thread** — reads relay log events sequentially and replays them against the replica's InnoDB engine. This is where the actual data changes happen.

Because the two threads are independent, the relay log acts as a buffer. If the SQL thread falls behind, relay log files grow on disk. If the network drops, the I/O thread reconnects and resumes from where it left off.

This split is exactly why you can see `Replica_IO_Running: Yes` and `Replica_SQL_Running: No` at the same time later on — one thread happily fetching, the other stuck. Keep that picture in mind; it'll make the monitoring section (Section 8) click much faster.

> **Memory hook:** "The I/O thread is the courier dropping off mail (the relay log). The SQL thread is the clerk who actually opens and files it. The courier can keep running even if the clerk falls behind."

---

## 3. The Binary Log

Step back for a second. How does the "manager" in our analogy actually communicate every decision to the assistants, reliably, in the right order, even if an assistant is offline for a while and needs to catch up later?

The manager doesn't shout decisions out loud and hope everyone heard. They write every decision into an official logbook, in order, and the assistants each come read from that logbook whenever they're ready. That logbook is the **binary log (binlog)** — and it's the single mechanism that makes all of MySQL replication possible.

**In plain terms:** the binlog is a sequence of binary files on the primary that records every change that modifies data or structure — nothing more, nothing less.

```
binlog.000001  binlog.000002  binlog.000003  ...  binlog.000N
─────────────────────────────────────────────────────────────►
                                                        current
```

### What Goes Into the Binlog?

Only things that change data or structure get written. Read-only work never touches it — there'd be no point logging a SELECT, since a replica has nothing to "replay" from a query that changed nothing.

- Every committed DML statement: INSERT, UPDATE, DELETE, REPLACE
- DDL statements: CREATE TABLE, ALTER TABLE, DROP TABLE, etc.
- Stored procedure calls that modify data
- NOT included: SELECT, SHOW, uncommitted transactions, read-only sessions

### Binlog Position

So how does a replica know exactly where it left off reading the logbook? Originally, MySQL answered this the crude way — with a **filename + byte offset**:

```
File: binlog.000042
Position: 1048576
```

That's just "open this specific file, and start reading from this exact byte." It works fine day-to-day, but it's fragile in exactly the moment you need it most: a failover. After the primary changes, the new primary has different binlog files and different positions — someone has to manually work out the equivalent position, under pressure, during an outage. Section 5 (GTIDs) is MySQL's fix for this exact pain point.

### Enabling the Binary Log

```ini
# /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
log_bin            = /var/log/mysql/binlog
server-id          = 1
binlog_format      = ROW
expire_logs_days   = 7
max_binlog_size    = 100M
```

Verify it is active:

```sql
SHOW VARIABLES LIKE 'log_bin';
-- +---------------+-------+
-- | Variable_name | Value |
-- +---------------+-------+
-- | log_bin       | ON    |
-- +---------------+-------+

SHOW BINARY LOGS;
-- +------------------+-----------+
-- | Log_name         | File_size |
-- +------------------+-----------+
-- | binlog.000001    | 178       |
-- | binlog.000042    | 1048576   |
-- +------------------+-----------+
```

> **Memory hook:** "The binlog is the manager's logbook — every decision written down, in order, so any assistant can catch up by reading from wherever they last stopped."

---

## 4. Binary Log Formats

Okay — the manager writes decisions into the logbook. But *how* does the manager phrase each entry? Word-for-word what they said in the meeting ("raise all prices by 10%"), or the literal, itemized outcome ("shelf A: $9.99 → $10.99, shelf B: $24.99 → $27.49...")?

That's exactly the choice MySQL gives you, and it's one of the most-asked interview topics in this whole file — so let's slow down here.

MySQL supports three binary log formats. Understanding their tradeoffs is essential for choosing the right one.

| Format | What is recorded | Pros | Cons |
|--------|-----------------|------|------|
| **STATEMENT** | The exact SQL text that was executed | Compact log files; human-readable | Non-deterministic functions (NOW(), UUID(), RAND()) can produce different results on replica |
| **ROW** | The before/after image of each affected row | Deterministic — replica always gets the same result regardless of server time, UUIDs, etc. | Larger log files for bulk operations (UPDATE of 1M rows = 1M row images) |
| **MIXED** | STATEMENT by default; switches to ROW automatically when MySQL detects a non-deterministic statement | Balances log size and safety | Slightly harder to reason about; still not perfect — some edge cases exist |

Here's the confusion most people run into: **STATEMENT format sounds like it should just work** — after all, if the replica runs the exact same SQL, shouldn't it get the exact same result? Not always. If that SQL calls `NOW()`, `UUID()`, or `RAND()`, the replica executes it at a slightly different moment, on a slightly different machine, and gets a *different* answer than the primary did. Now your "identical" copies have quietly diverged. That's the whole reason ROW format exists, and why it's the default since MySQL 8.0.

### When to Use Each Format

```
STATEMENT: Legacy systems where log size is critical and you can
           guarantee all queries are deterministic.

ROW:       Default recommendation for production. Used by InnoDB
           Cluster. Required for conflict detection in Group
           Replication.

MIXED:     A reasonable middle ground for general use.
```

### ROW Format Under the Hood

Let's make this concrete instead of abstract. Say you run one UPDATE that touches three rows.

```sql
-- You execute this on the primary:
UPDATE products SET price = price * 1.10 WHERE category_id = 5;
-- (affects 3 rows)

-- What ROW format writes to the binlog (conceptually):
-- Event: UPDATE_ROWS
--   Row 1: before=(id=101, price=9.99)  after=(id=101, price=10.99)
--   Row 2: before=(id=208, price=24.99) after=(id=208, price=27.49)
--   Row 3: before=(id=315, price=4.99)  after=(id=315, price=5.49)
```

Notice what's *not* in that binlog event: the word `UPDATE`, the expression `price * 1.10`, or any SQL at all. The replica never re-executes your statement — it just replays these exact before/after row images directly against InnoDB. So it genuinely does not matter if the replica's clock is different, or if a UUID would have come out differently, because there's no non-deterministic expression left to evaluate. The target state was already computed on the primary and handed over as a fact, not a formula.

**Common mistake:** assuming STATEMENT format is "safe enough" because your queries "don't use random functions." It's an easy assumption to get burned by — triggers, stored functions, and even `LIMIT` without `ORDER BY` can behave non-deterministically in ways people don't expect. This is exactly why MIXED and ROW exist, and why ROW became the production default.

**Interview answer:** "MySQL binlogs come in three formats. STATEMENT logs the literal SQL, which is compact but breaks down for non-deterministic statements like ones using `NOW()` or `RAND()`, because the replica could compute a different result. ROW logs the actual before/after row images, so replication is always deterministic regardless of what generated the change — the tradeoff is larger binlogs for bulk writes. MIXED is STATEMENT by default but automatically upgrades to ROW when MySQL detects a statement that isn't safe to replicate as SQL text. ROW is the default since MySQL 8.0 and is required for Group Replication because it needs deterministic row-level conflict detection."

### Inspecting the Binlog

```bash
mysqlbinlog --no-defaults --base64-output=DECODE-ROWS -v \
  /var/log/mysql/binlog.000042 | head -60
```

```bash
# Or read directly in MySQL:
mysqlbinlog --read-from-remote-server --host=primary-host \
  --user=repl --password --raw binlog.000042
```

> **Memory hook:** "STATEMENT writes down what you *said* to do; ROW writes down what actually *happened*. Only one of those is guaranteed to mean the same thing twice."

---

## 5. GTID-Based Replication

Remember the fragile "filename + byte offset" bookkeeping from Section 3? Here's MySQL's fix for it.

A **Global Transaction Identifier (GTID)** is a unique label assigned to every committed transaction on the primary. Think of it as a tamper-proof serial number stamped on every decision in the manager's logbook — no matter which physical page of the logbook it ends up on, that serial number always identifies the same decision. It makes replication topology changes dramatically simpler.

### Format

```
server_uuid:transaction_id

Example:
3E11FA47-71CA-11E1-9E33-C80AA9429562:1
3E11FA47-71CA-11E1-9E33-C80AA9429562:2
3E11FA47-71CA-11E1-9E33-C80AA9429562:3-100   ← range notation
```

- `server_uuid` — the auto-generated UUID of the server that originally committed the transaction (stored in `auto.cnf`)
- `transaction_id` — a monotonically increasing integer on that server

### GTID Sets

A GTID set records all transactions a server has applied. Example:

```
3E11FA47-71CA-11E1-9E33-C80AA9429562:1-500,
9C6F4A38-CF09-11E3-9F9D-080027AE2DF9:1-20
```

This means: "I have applied transactions 1 through 500 from server A, and transactions 1 through 20 from server B."

### Why GTIDs Simplify Failover

```
Without GTID (position-based):
  Replica tracks: binlog.000042 position 1048576 on PRIMARY-1
  PRIMARY-1 fails. Promote REPLICA-1 as new primary.
  REPLICA-2 must now point to REPLICA-1.
  Problem: REPLICA-1 has different binlog files.
  You must manually calculate the equivalent position.
  This is error-prone and requires downtime or complex tooling.

With GTID:
  Every replica tracks: "I have applied GTIDs X:1-500"
  PRIMARY-1 fails. Promote REPLICA-1.
  REPLICA-2 simply says: "connect to REPLICA-1, give me everything
  after X:1-500."
  REPLICA-1 knows exactly which transactions REPLICA-2 is missing.
  No manual position math. Automated tools (orchestrator, MHA) work
  reliably.
```

### GTID Variables

```sql
-- On primary: the set of all GTIDs ever executed
SHOW GLOBAL VARIABLES LIKE 'gtid_executed';

-- On replica: GTIDs received but not yet applied
SHOW GLOBAL VARIABLES LIKE 'gtid_received';

-- Gap between primary and replica:
SELECT GTID_SUBTRACT(
  @@GLOBAL.gtid_executed,    -- primary
  @@GLOBAL.gtid_executed     -- replica (run on replica)
) AS missing_gtids;
```

> **Memory hook:** "A binlog position is like saying 'page 42, third line down' — meaningless once you switch logbooks. A GTID is like a serial number stamped on the decision itself — it means the same thing in every copy of the logbook."

---

## 6. Setting Up a Primary

Enough theory — let's actually build one. Setting up a primary is three small steps: tell MySQL to keep a binlog with GTIDs on, create an account the replicas can log in with, and take a starting snapshot of the data.

### Step 1: my.cnf Configuration

```ini
[mysqld]
# Unique across the entire replication topology
server-id          = 1

# Enable binary logging
log_bin            = /var/log/mysql/binlog
binlog_format      = ROW

# GTID mode — both ON required for GTID-based replication
gtid_mode          = ON
enforce_gtid_consistency = ON

# InnoDB durability (required for crash-safe replication)
innodb_flush_log_at_trx_commit = 1
sync_binlog        = 1
```

### Step 2: Create a Replication User

```sql
-- Run on the primary
CREATE USER 'repl'@'%' IDENTIFIED WITH caching_sha2_password BY 'StrongReplicationPass!';

GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';

FLUSH PRIVILEGES;
```

### Step 3: Record GTID Position (for initial data load)

```sql
-- Lock tables, record position, export data, unlock
FLUSH TABLES WITH READ LOCK;

SHOW MASTER STATUS\G
-- *************************** 1. row ***************************
--              File: binlog.000003
--          Position: 154
--      Binlog_Do_DB:
--  Binlog_Ignore_DB:
-- Executed_Gtid_Set: 3E11FA47-71CA-11E1-9E33-C80AA9429562:1-150

-- In another session: mysqldump or xtrabackup

UNLOCK TABLES;
```

For production, prefer **xtrabackup** (hot backup, no lock required):

```bash
xtrabackup --backup --target-dir=/backup/full \
  --user=root --password=rootpass
```

---

## 7. Setting Up a Replica

Now the other half: point a fresh MySQL instance at that primary, hand it a copy of the existing data to start from, and tell it "go follow that logbook from here."

### Step 1: my.cnf Configuration

```ini
[mysqld]
server-id          = 2          # Must differ from all other servers

# GTID mode — must match primary
gtid_mode          = ON
enforce_gtid_consistency = ON

# Read-only to prevent accidental writes
read_only          = ON
super_read_only    = ON

# Relay log
relay-log          = /var/log/mysql/relay-bin
relay_log_purge    = ON

# Make replication metadata crash-safe
relay_log_info_repository  = TABLE
master_info_repository     = TABLE
```

### Step 2: Restore the Base Dataset

```bash
# Restore mysqldump
mysql -u root -p < full_dump.sql

# Or restore xtrabackup
xtrabackup --prepare --target-dir=/backup/full
xtrabackup --copy-back --target-dir=/backup/full
chown -R mysql:mysql /var/lib/mysql
```

### Step 3: Point the Replica at the Primary

```sql
-- MySQL 8.0.23+ syntax (CHANGE REPLICATION SOURCE TO)
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST     = '10.0.0.1',
  SOURCE_PORT     = 3306,
  SOURCE_USER     = 'repl',
  SOURCE_PASSWORD = 'StrongReplicationPass!',
  SOURCE_AUTO_POSITION = 1;   -- Use GTID; no need to specify binlog file/position

START REPLICA;
```

For older MySQL 5.7 / 8.0 syntax:

```sql
CHANGE MASTER TO
  MASTER_HOST     = '10.0.0.1',
  MASTER_USER     = 'repl',
  MASTER_PASSWORD = 'StrongReplicationPass!',
  MASTER_AUTO_POSITION = 1;

START SLAVE;
```

### Step 4: Verify It Started

```sql
SHOW REPLICA STATUS\G
```

> **Memory hook:** "`SOURCE_AUTO_POSITION = 1` is you telling the replica: 'don't worry about page numbers — just tell the primary which serial numbers you're missing, and it'll send those.'"

---

## 8. Monitoring Replication

You've wired everything up — but how do you actually know replication is healthy, rather than silently broken in the background? `SHOW REPLICA STATUS\G` is your primary diagnostic tool. Key fields:

```
*************************** 1. row ***************************
             Replica_IO_State: Waiting for source to send event
                  Source_Host: 10.0.0.1
                  Source_User: repl
                  Source_Port: 3306
            Source_Log_File: binlog.000042
        Read_Source_Log_Pos: 1048576
             Relay_Log_File: relay-bin.000015
              Relay_Log_Pos: 524288
      Relay_Source_Log_File: binlog.000042
         Replica_IO_Running: Yes        ← I/O thread must be Yes
        Replica_SQL_Running: Yes        ← SQL thread must be Yes
          Seconds_Behind_Source: 0      ← 0 = replica is caught up
               Last_IO_Error:          ← empty = no error
              Last_SQL_Error:          ← empty = no error
  Retrieved_Gtid_Set: 3E11FA47:1-500
   Executed_Gtid_Set: 3E11FA47:1-500   ← matches = fully caught up
```

### What Each Status Means

| Field | Healthy value | Problem if... |
|-------|--------------|---------------|
| `Replica_IO_Running` | YES | NO = network issue, auth failure, or primary binlog inaccessible |
| `Replica_SQL_Running` | YES | NO = SQL error applying an event (duplicate key, missing table, etc.) |
| `Seconds_Behind_Source` | 0 or low | Growing = replica is falling behind (lag) |
| `Last_IO_Error` | empty | Any message = investigate immediately |
| `Last_SQL_Error` | empty | Any message = replication has stopped, requires intervention |

### Monitoring with Performance Schema

```sql
-- More detailed view available in MySQL 8.x
SELECT
  CHANNEL_NAME,
  SERVICE_STATE,
  LAST_ERROR_NUMBER,
  LAST_ERROR_MESSAGE,
  LAST_ERROR_TIMESTAMP
FROM performance_schema.replication_applier_status_by_worker;

-- Replication lag by worker thread
SELECT
  WORKER_ID,
  APPLYING_TRANSACTION,
  LAST_APPLIED_TRANSACTION_END_APPLY_TIMESTAMP,
  NOW() AS current_time
FROM performance_schema.replication_applier_status_by_worker;
```

> **Memory hook:** "Two green lights (`Replica_IO_Running`, `Replica_SQL_Running`) and `Seconds_Behind_Source: 0` — that's the replica equivalent of a car's dashboard showing no warning lights and a full tank."

---

## 9. Replication Lag

Here's a scenario that trips people up in production: a user submits a form, your app immediately re-reads the data from a replica to show a confirmation page — and the confirmation page shows the *old* value, or nothing at all. Nothing crashed. Nothing errored. The write just... hadn't arrived yet.

That's **replication lag**: the replica is behind the primary. Writes have been committed on the primary but not yet applied on the replica. Reads from the replica may return stale data. And this is arguably the single most common "gotcha" people hit the first time they put replicas into production — because everything looks like it's working, right up until it doesn't.

### Anatomy of Lag

```
Primary commits transaction at T=0
  │
  ├── I/O thread fetches it:         T=0 + network_latency
  │
  └── SQL thread applies it:         T=0 + network_latency + sql_queue_wait
                                                            + apply_time
                                                            = Seconds_Behind_Source
```

### Common Causes

| Cause | Why it happens | Fix |
|-------|---------------|-----|
| Large single transaction | A single UPDATE of 10M rows = one enormous relay log event that blocks the SQL thread | Break large writes into batches |
| DDL on a large table | ALTER TABLE is a single transaction and can run for hours | Use pt-online-schema-change or gh-ost |
| Single-threaded SQL thread | Default behavior: one thread applies events serially | Enable multi-threaded replication (see below) |
| Slow disk on replica | SQL thread writes to InnoDB slower than primary commits | Use faster disk on replica, or reduce sync_binlog |
| Network saturation | I/O thread cannot download binlog fast enough | Dedicated replication network |
| Replica CPU saturation | Applying writes is CPU-bound | Scale up replica, reduce replica load |

### Multi-Threaded Replication (MTS)

```ini
# In replica my.cnf
replica_parallel_workers = 8          # Number of parallel SQL threads
replica_parallel_type    = LOGICAL_CLOCK  # Parallelize based on commit timestamp
replica_preserve_commit_order = ON    # Maintain commit order for consistency
```

With `LOGICAL_CLOCK`, transactions that committed on the primary within the same binary log group commit can be applied in parallel on the replica, dramatically reducing lag for write-heavy workloads.

> **Memory hook:** "Lag is the gap between the manager making a decision and the slowest assistant finishing writing it into their own copy of the logbook. Read from that assistant in the gap, and you get yesterday's news."

---

## 10. Semi-Synchronous Replication

Here's a fact that surprises a lot of people coming from other systems: MySQL replication is **not synchronous by default**. Many people just assume "replication" means the copies are always kept perfectly, instantly in sync — it doesn't, unless you explicitly configure it to.

Standard MySQL replication is **asynchronous**: the primary commits and returns success to the client immediately. The replica applies the change later. If the primary crashes before the replica has received the transaction, that transaction is lost.

### The Risk

```
T=0  Client writes to primary
T=1  Primary commits, ACKs to client ("success")
T=2  Primary crashes before replica receives the binlog event
T=3  Failover: replica promoted
     The transaction committed by the client is now gone.
     Data loss has occurred.
```

### Semi-Synchronous

With semi-sync, the primary waits until **at least one replica** acknowledges receipt of the binlog event before returning success to the client.

```
T=0  Client writes to primary
T=1  Primary writes to binlog
T=2  Replica I/O thread receives binlog event, writes to relay log
T=3  Replica sends ACK to primary
T=4  Primary commits and returns success to client

If primary crashes at any point before T=4, the client gets a timeout
error, not a false success. The transaction is safe on at least one replica.
```

### Async vs Semi-Sync at a Glance

| | Asynchronous (default) | Semi-Synchronous |
|---|---|---|
| Primary waits for replica ACK before commit? | No | Yes (at least one replica) |
| Risk of data loss on primary crash | Yes — recent transactions can vanish | No — the acknowledged transaction survives on a replica |
| Write latency | Lowest | Slightly higher (waits for network round-trip + replica write) |
| Behavior if no replica ACKs in time | N/A | Falls back to async (configurable timeout) |

**Common mistake:** treating "I set up replication" as equivalent to "my data is safe on multiple servers in real time." Without semi-sync (or Group Replication's consensus), a crash at the wrong instant loses whatever hadn't made it to a replica yet — async replication optimizes for speed, not durability guarantees.

### Setup

```sql
-- On primary: install plugin
INSTALL PLUGIN rpl_semi_sync_source SONAME 'semisync_source.so';
SET GLOBAL rpl_semi_sync_source_enabled = ON;
SET GLOBAL rpl_semi_sync_source_timeout = 1000;  -- 1 second wait for ACK

-- On replica: install plugin
INSTALL PLUGIN rpl_semi_sync_replica SONAME 'semisync_replica.so';
SET GLOBAL rpl_semi_sync_replica_enabled = ON;
```

```sql
-- Monitor semi-sync status
SHOW STATUS LIKE 'Rpl_semi_sync%';
-- Rpl_semi_sync_source_clients          1   (number of semi-sync replicas)
-- Rpl_semi_sync_source_status           ON
-- Rpl_semi_sync_source_yes_tx           4829 (transactions sent with semi-sync)
-- Rpl_semi_sync_source_no_tx            0    (transactions that fell back to async)
```

**Fallback behavior**: If no ACK arrives within `rpl_semi_sync_source_timeout` ms, MySQL falls back to asynchronous commit to avoid blocking the primary indefinitely. This trades durability for availability.

**Interview answer:** "By default MySQL replication is asynchronous — the primary commits and tells the client 'success' without waiting for any replica to confirm it received the change. That means a primary crash right after commit can lose the most recent transactions. Semi-synchronous replication fixes this by making the primary wait for at least one replica to acknowledge it has written the event to its relay log before returning success — so any transaction the client was told succeeded is guaranteed to survive on at least one other server. It costs a bit of write latency, and if no replica acknowledges within the configured timeout, MySQL falls back to async so the primary doesn't hang forever."

> **Memory hook:** "Async is the manager shouting a decision over their shoulder and moving on. Semi-sync is the manager waiting for at least one assistant to shout back 'got it!' before moving on."

---

## 11. Read Scaling Patterns

Back to the other half of the original problem from Section 1 — too many SELECTs hammering one server. The most common production use of replication is routing read traffic to replicas.

### Pattern 1: Application-Level Routing

```python
import mysql.connector

# Two connection pools
primary_pool = mysql.connector.connect(host='10.0.0.1', ...)
replica_pool = mysql.connector.connect(host='10.0.0.2', ...)

def execute_write(sql, params):
    conn = primary_pool.get_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params)
    conn.commit()

def execute_read(sql, params):
    conn = replica_pool.get_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params)
    return cursor.fetchall()
```

**Caveat — read-your-own-writes**: After a write, a user who immediately reads from a replica may not see their own change yet. Solutions:

- Route reads to the primary for 500ms after a write
- Use session stickiness: if a user wrote in this session, read from primary
- Use semi-sync + check `Seconds_Behind_Source == 0` before routing read

### Pattern 2: ProxySQL

ProxySQL is a MySQL-aware proxy that handles routing transparently.

```
Application → ProxySQL :3306 → primary (writes)
                              → replica1 (reads)
                              → replica2 (reads)
```

```sql
-- ProxySQL rule: route SELECTs to replica hostgroup
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup)
VALUES (1, 1, '^SELECT', 20);  -- HG 20 = replicas

-- All other queries go to HG 10 = primary (default)
```

### Multiple Replicas — Horizontal Read Scaling

```
                    ┌─────────────┐
                    │   PRIMARY   │
                    │  (writes)   │
                    └──────┬──────┘
                           │ binlog stream
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │Replica 1 │ │Replica 2 │ │Replica 3 │
        │  OLTP    │ │ Analytics│ │  Backup  │
        │  reads   │ │  queries │ │  target  │
        └──────────┘ └──────────┘ └──────────┘
```

Each replica can serve a different purpose. The analytics replica can have slow queries running without impacting production reads.

> **Memory hook:** "Don't ask the manager every little question — ask an assistant, unless it's something only the manager just decided (that's the read-your-own-writes caveat)."

---

## 12. InnoDB Cluster and Group Replication

Everything so far assumes a human (or a tool like Orchestrator/MHA) decides when to promote a replica after a failure. What if you want MySQL to handle that election itself, with no single point of failure and no manual intervention? That's what Group Replication and InnoDB Cluster are for.

### Group Replication

Group Replication is MySQL's built-in multi-primary or single-primary cluster. Unlike classic replication:

- Uses **Paxos-based consensus** — a transaction commits only after the majority of nodes acknowledge it
- Supports **automatic failover** — if the primary fails, the group elects a new primary without human intervention
- Provides **conflict detection** — in multi-primary mode, conflicting writes on different nodes are detected and one is rolled back

```
┌─────────────────────────────────────────────────────────────┐
│                   GROUP REPLICATION CLUSTER                 │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Node 1     │  │   Node 2     │  │   Node 3     │     │
│  │  (PRIMARY)   │  │  (SECONDARY) │  │  (SECONDARY) │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                      Paxos Consensus                        │
│                   (majority must agree)                     │
└─────────────────────────────────────────────────────────────┘
```

### InnoDB Cluster

InnoDB Cluster is the full high-availability solution built on:

- **Group Replication** — the replication layer
- **MySQL Router** — the connection routing layer (replaces ProxySQL for basic use cases)
- **MySQL Shell** — the management interface

```bash
# Create cluster via MySQL Shell
mysqlsh root@primary-host --py
```

```python
cluster = dba.create_cluster('myCluster')
cluster.add_instance('root@replica1-host')
cluster.add_instance('root@replica2-host')

cluster.status()
# {
#   "clusterName": "myCluster",
#   "defaultReplicaSet": {
#     "name": "default",
#     "primary": "primary-host:3306",
#     "status": "OK",
#     "topology": {
#       "primary-host:3306":  {"mode": "R/W", "status": "ONLINE"},
#       "replica1-host:3306": {"mode": "R/O", "status": "ONLINE"},
#       "replica2-host:3306": {"mode": "R/O", "status": "ONLINE"}
#     }
#   }
# }
```

> **Memory hook:** "Classic replication is one manager and assistants who trust the manager blindly. Group Replication is a committee that votes on every decision — slower per-decision, but nobody has to guess who's in charge after someone leaves the room."

---

## 13. Hands-On Exercises

Time to actually build and break some of this yourself. These exercises walk through the full lifecycle: setting up replication, watching it lag, simulating a failover, turning on semi-sync, and reading raw binlog events.

### Exercise 1 — Docker Replication Lab

Set up a primary + replica using Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'
services:
  mysql-primary:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_REPLICATION_USER: repl
      MYSQL_REPLICATION_PASSWORD: replpass
    volumes:
      - ./primary.cnf:/etc/mysql/conf.d/primary.cnf
    ports:
      - "3306:3306"

  mysql-replica:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
    volumes:
      - ./replica.cnf:/etc/mysql/conf.d/replica.cnf
    ports:
      - "3307:3306"
    depends_on:
      - mysql-primary
```

Tasks:
- Configure GTID mode on both containers
- Create the replication user on the primary
- Run `CHANGE REPLICATION SOURCE TO` on the replica
- Insert rows on the primary and verify they appear on the replica
- Run `SHOW REPLICA STATUS\G` and identify all key fields

### Exercise 2 — Observe Replication Lag

1. On the primary, create a table with 5 million rows using a stored procedure
2. Run `UPDATE large_table SET col = col + 1` (updates all 5M rows in one transaction)
3. Monitor `Seconds_Behind_Source` on the replica during apply
4. Repeat the test with `replica_parallel_workers = 4` and `replica_parallel_type = LOGICAL_CLOCK`
5. Compare lag recovery time

### Exercise 3 — Simulate a Failover

1. Insert data on the primary
2. Stop the primary (`docker stop mysql-primary`)
3. On the replica, run `STOP REPLICA; RESET REPLICA ALL;`
4. Set the replica to read-write: `SET GLOBAL read_only = OFF;`
5. Update your application connection to point to the new primary
6. Start the old primary as a new replica pointing to the promoted server

### Exercise 4 — Semi-Synchronous Setup

1. Install the semi-sync plugins on both primary and replica
2. Enable them and verify with `SHOW STATUS LIKE 'Rpl_semi_sync%'`
3. Insert a row and observe `Rpl_semi_sync_source_yes_tx` increment
4. Stop the replica, insert a row, and observe the primary wait for `rpl_semi_sync_source_timeout` ms before falling back to async
5. Restart the replica and confirm the row is present

### Exercise 5 — Binary Log Inspection

1. Perform an INSERT, UPDATE, and DELETE on the primary
2. Use `mysqlbinlog` to decode the binary log and read the ROW format events
3. Identify the GTID for each event
4. Use `SHOW BINLOG EVENTS IN 'binlog.000001' FROM 154 LIMIT 20`
5. Practice filtering by GTID range: `mysqlbinlog --include-gtids='uuid:1-10' binlog.000001`

---

## 14. Interview Q&A

**Q1: What is the difference between asynchronous and semi-synchronous replication?**

In asynchronous replication, the primary commits and returns to the client immediately without waiting for any replica to acknowledge receipt of the binlog event. In semi-synchronous, the primary waits until at least one replica's I/O thread has written the event to its relay log before acknowledging the commit. Semi-sync prevents data loss on failover at the cost of slightly higher write latency.

---

**Q2: What is a GTID and why is it better than binlog position tracking?**

A GTID (Global Transaction Identifier) is a unique ID assigned to every committed transaction, formed as `server_uuid:transaction_id`. It is superior to position-based tracking because it is globally unique across the entire topology. After a failover, a replica can tell a new primary exactly which transactions it has applied, and the new primary can compute and send exactly the missing transactions — no manual binlog position calculation required.

---

**Q3: What does `Seconds_Behind_Source = 0` actually mean?**

It means the SQL thread on the replica has applied all relay log events up to the point the I/O thread had received at the time the query was run. It does not guarantee zero lag — a brief delay can exist between the I/O thread receiving an event and the status query running. For precise lag measurement, compare GTID sets between primary and replica.

---

**Q4: Why would `Replica_IO_Running` be YES but `Replica_SQL_Running` be NO?**

This means the I/O thread is successfully fetching binlog events from the primary and writing them to the relay log, but the SQL thread has stopped applying them. This is almost always caused by an error applying a specific event — a duplicate key violation, a row not found for UPDATE/DELETE, a missing table, or a constraint violation. Check `Last_SQL_Error` and `Last_SQL_Errno` in `SHOW REPLICA STATUS` for the specific error.

---

**Q5: How do you skip a replication error without fixing the underlying problem?**

Using GTID mode: inject an empty transaction to advance past the failing GTID.

```sql
STOP REPLICA;
SET GTID_NEXT = 'uuid:failing_transaction_id';
BEGIN; COMMIT;  -- inject empty transaction
SET GTID_NEXT = 'AUTOMATIC';
START REPLICA;
```

This is a last resort. The underlying data inconsistency remains and should be resolved.

---

**Q6: What is the relay log and when does it get cleaned up?**

The relay log is a set of local files on the replica that buffer binlog events received from the primary's I/O thread before the SQL thread applies them. With `relay_log_purge = ON` (the default), relay log files are automatically deleted after the SQL thread has fully applied them. If the SQL thread is far behind the I/O thread, relay log files accumulate on disk.

---

**Q7: What is ROW format replication and why is it the recommended default?**

ROW format records the before and after image of each affected row, rather than the SQL statement. It is deterministic: the replica always produces identical data regardless of non-deterministic functions (NOW(), UUID(), stored procedures with side effects). The tradeoff is larger binlog files for bulk operations. MySQL's default since 8.0 is ROW, and it is required for Group Replication.

---

**Q8: Can you replicate from MySQL 5.7 to MySQL 8.0?**

Yes, MySQL supports replicating from a lower-version primary to a higher-version replica, but not the reverse. This is the supported upgrade path. You set up the 8.0 instance as a replica, let it catch up, then promote it as the primary and decommission the 5.7 instance.

---

**Q9: What happens to replication if you run `SET sql_log_bin = 0`?**

Any DML executed in that session is not written to the binary log. The change is made only on the primary and will never be replicated. The replica's copy of that table drifts from the primary. This is useful for one-off administrative fixes on the primary (e.g., correcting data that should not be replicated) but should be used with extreme caution.

---

**Q10: What is `enforce_gtid_consistency` and which statements does it disallow?**

When `enforce_gtid_consistency = ON`, MySQL rejects statements that cannot be safely logged as a single atomic GTID transaction. Specifically:

- `CREATE TABLE ... SELECT ...` — combines DDL and DML in one statement
- Non-transactional DML inside a transaction (mixing InnoDB and MyISAM)
- `CREATE TEMPORARY TABLE` or `DROP TEMPORARY TABLE` inside a transaction

---

**Q11: How does multi-threaded replication (MTS) work?**

With `replica_parallel_workers > 1` and `replica_parallel_type = LOGICAL_CLOCK`, the replica's SQL thread is replaced by a coordinator thread plus N worker threads. The coordinator reads relay log events and assigns them to workers. Transactions that overlapped in time on the primary (committed within the same binary log group commit) can be applied in parallel on the replica. `replica_preserve_commit_order = ON` ensures commit ordering matches the primary despite parallel application.

---

**Q12: What is the difference between Group Replication single-primary and multi-primary mode?**

In single-primary mode, one node accepts writes and the others are read-only replicas. Failover is automatic — the group elects a new primary if the current one fails. In multi-primary mode, all nodes accept writes, but every write must pass Paxos consensus and conflict detection. Multi-primary is more complex and has restrictions (no foreign keys between tables that different primaries might update concurrently). Single-primary is recommended for most production workloads.

---

**Q13: How would you rebuild a replica that has drifted from the primary?**

1. Stop the replica: `STOP REPLICA`
2. Take a full backup from the primary using xtrabackup or mysqldump with `--single-transaction --master-data=2`
3. Restore the backup to the replica
4. Run `CHANGE REPLICATION SOURCE TO ... SOURCE_AUTO_POSITION = 1`
5. `START REPLICA` and verify with `SHOW REPLICA STATUS\G`

---

**Q14: What is `MASTER_DELAY` and when would you use it?**

```sql
CHANGE REPLICATION SOURCE TO SOURCE_DELAY = 3600;  -- 1 hour delay
```

A delayed replica applies transactions N seconds after they were committed on the primary. Use cases: protection against accidental DROP TABLE (you have a 1-hour window to stop the replica before the drop is applied and recover the data), or for time-travel queries against a consistent historical snapshot.

---

**Q15: How does ProxySQL differ from MySQL Router for read/write splitting?**

ProxySQL is a standalone high-performance proxy that runs independently of MySQL. It supports sophisticated query routing rules (regex-based), query caching, connection pooling with thousands of client connections multiplexed over fewer backend connections, and runtime configuration without restart. MySQL Router is simpler and more tightly integrated with InnoDB Cluster, handles basic read/write splitting based on hostgroup assignments, but lacks ProxySQL's advanced query manipulation capabilities. For InnoDB Cluster workloads, MySQL Router is the recommended choice. For complex routing logic, ProxySQL is preferred.
