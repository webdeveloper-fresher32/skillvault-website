# Phase 11 — Advanced MySQL

This phase covers production-grade MySQL topics that go beyond query writing and schema design. You will learn how MySQL replicates data across servers, how to partition large tables for performance and manageability, and how to store and query semi-structured data using the native JSON type.

## Modules

| # | File | Topic | Core Skill |
|---|------|--------|------------|
| 1 | `01-Replication.md` | Replication | High availability, read scaling, GTID |
| 2 | `02-Partitioning.md` | Table Partitioning | Partition pruning, archive strategy |
| 3 | `03-MySQL-JSON.md` | JSON Type & Functions | Semi-structured data, generated indexes |

## Prerequisites

- Comfortable with InnoDB internals (transactions, MVCC, redo/undo logs)
- Understands indexes (B-tree, covering index, EXPLAIN output)
- Has run a MySQL 8.x instance locally or via Docker

## Learning Outcomes

By the end of Phase 11 you will be able to:

1. Set up and monitor a GTID-based primary-replica replication topology
2. Design a partitioned table that prunes correctly on your most common WHERE clauses
3. Store JSON documents in MySQL, extract and mutate fields, and accelerate queries with generated-column indexes
4. Make the tradeoff decision between each technique and its simpler alternative

## Suggested Order

Work through the modules in order. Replication concepts appear in later discussions of Group Replication and InnoDB Cluster. Partitioning builds on the EXPLAIN tool used throughout. JSON is self-contained but benefits from a solid index foundation.
