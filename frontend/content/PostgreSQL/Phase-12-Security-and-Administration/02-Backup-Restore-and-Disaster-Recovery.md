# 02 — Backup, Restore & Disaster Recovery Runbooks

## Table of Contents
1. [Logical vs Physical Backups](#1-logical-vs-physical-backups)
2. [Mastering `pg_dump` and Custom Directory Format](#2-mastering-pg_dump-and-custom-directory-format)
3. [High-Speed Parallel Restores with `pg_restore`](#3-high-speed-parallel-restores-with-pg_restore)
4. [Enterprise Physical Backups with `pgBackRest`](#4-enterprise-physical-backups-with-pgbackrest)
5. [Backup Validation & Corruption Detection (`pg_checksums`)](#5-backup-validation--corruption-detection-pg_checksums)
6. [Defining RTO and RPO for SLA Commitments](#6-defining-rto-and-rpo-for-sla-commitments)
7. [The Disaster Recovery Emergency Runbook](#7-the-disaster-recovery-emergency-runbook)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. Logical vs Physical Backups

| Dimension | Logical Backups (`pg_dump`) | Physical Backups (`pgBackRest`, `pg_basebackup`) |
|---|---|---|
| **What is Stored** | SQL commands or binary row representations | Raw physical 8KB disk blocks and WAL files |
| **Speed on Large DBs** | Slow (hours on 1TB+ tables) | Fast (saturates network / disk I/O at Gbps speeds) |
| **Portability** | High (restore across OS architectures/versions)| Low (must match exact major PostgreSQL version) |
| **Granularity** | Single table, single schema, or full DB | Entire database cluster ($PGDATA) |
| **Point-In-Time (PITR)?**| NO (Snapshot at moment of dump) | **YES (Replays WAL to any exact second)** |

---

## 2. Mastering `pg_dump` and Custom Directory Format

Never use plain `.sql` text dumps for large production databases! Plain text cannot be restored in parallel.

Always use **Directory Format (`-Fd`)**, which creates a directory of compressed table chunks that can be dumped and restored using multiple CPU cores in parallel:

```bash
# Export using 8 parallel CPU workers with zstd compression:
pg_dump -h localhost -U vaultmaster -d skillvault \
  -Fd \
  -j 8 \
  -Z 6 \
  -f /var/backups/skillvault_dump_20260615/
```

### Useful Selective Options:
- `-t 'public.orders'`: Dump only the `orders` table.
- `-T 'public.audit_*'`: Exclude noisy audit tables.
- `--schema-only` (`-s`): Export DDL schema structures without data.
- `--data-only` (`-a`): Export rows without DDL definitions.

---

## 3. High-Speed Parallel Restores with `pg_restore`

Restore a directory format backup across multiple CPU threads:

```bash
# Restore with 8 workers, dropping existing tables cleanly if present:
pg_restore -h localhost -U vaultmaster -d skillvault_restored \
  -Fd \
  -j 8 \
  --clean \
  --if-exists \
  /var/backups/skillvault_dump_20260615/
```

By utilizing `-j 8`, `pg_restore` loads 8 tables concurrently and builds 8 indexes simultaneously, slashing restore time by up to **80%**.

---

## 4. Enterprise Physical Backups with `pgBackRest`

For multi-terabyte production clusters, `pgBackRest` is the gold standard:

```ini
# /etc/pgbackrest/pgbackrest.conf
[global]
repo1-type=s3
repo1-s3-bucket=skillvault-database-backups
repo1-s3-endpoint=s3.us-east-1.amazonaws.com
repo1-s3-region=us-east-1
repo1-s3-key=AKIAIOSFODNN7EXAMPLE
repo1-s3-key-secret=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
process-max=8
compress-type=zst

[main]
pg1-path=/var/lib/postgresql/16/main
```

### Backup Types:
1. **Full Backup (Weekly):** Copies all database files from scratch.
   ```bash
   pgbackrest --stanza=main --type=full backup
   ```
2. **Differential Backup (Daily):** Copies only files changed since the last **Full** backup.
   ```bash
   pgbackrest --stanza=main --type=diff backup
   ```
3. **Incremental Backup (Hourly):** Copies only files changed since the last **Differential or Full** backup.
   ```bash
   pgbackrest --stanza=main --type=incr backup
   ```

---

## 5. Backup Validation & Corruption Detection (`pg_checksums`)

An untested backup is not a backup!

PostgreSQL supports data page checksums to detect silent disk corruption (bit-rot) caused by failing hardware:

```bash
# Check if data checksums are active on the cluster:
SHOW data_checksums;

# Offline verification tool across entire cluster:
pg_checksums -c -D /var/lib/postgresql/16/main
```

---

## 6. Defining RTO and RPO for SLA Commitments

- **Recovery Point Objective (RPO):** Maximum acceptable data loss duration.
  - *Example:* Continuous WAL archiving with streaming replication guarantees an RPO of **< 1 second**.
- **Recovery Time Objective (RTO):** Maximum allowable downtime before the cluster is online again.
  - *Example:* Automated Patroni failover provides an RTO of **< 15 seconds**.

---

## 7. The Disaster Recovery Emergency Runbook

```
┌────────────────────────────────────────────────────────────────────────┐
│                   EMERGENCY DR INCIDENT PLAYBOOK                       │
├────────────────────────────────────────────────────────────────────────┤
│ 1. ASSESS: Confirm primary failure; verify Patroni heartbeat state.   │
│ 2. FENCE: Isolate failed node to eliminate dual-primary split brain.   │
│ 3. RESTORE / PROMOTE:                                                  │
│    - If HA cluster: Verify standby promotion to Read-Write Primary.    │
│    - If Total Infrastructure Loss: Restore latest pgBackRest snapshot. │
│ 4. POINT-IN-TIME TARGET: Set recovery_target_time to pre-incident LSN. │
│ 5. REPLAY WAL: Allow engine to apply incremental WAL logs from S3.     │
│ 6. SANITY TEST: Verify table counts, constraints, and smoke query.     │
│ 7. TRAFFIC CUTOVER: Update HAProxy / Route53 DNS to active endpoint.   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Summary & Key Takeaways

1. Always use `pg_dump -Fd -j <cores>` for parallel multi-threaded logical exports.
2. `pg_restore -j <cores>` rebuilds data and indexes concurrently.
3. For large clusters (> 500GB), use **`pgBackRest`** for fast physical incremental snapshots.
4. Enable `data_checksums` to protect against physical storage bit-rot.
5. Continuously drill and test disaster recovery procedures against real RTO and RPO targets.
