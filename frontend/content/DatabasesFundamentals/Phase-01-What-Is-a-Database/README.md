# Phase 1: What Is a Database

## What You'll Learn

How a database management system answers each specific failure of storing data in plain files, how the two dominant workload shapes pull storage design in opposite directions, and how the families of database in use today map onto a small set of questions about access patterns.

## Learning Objectives

- Name the five capabilities a DBMS adds over flat files — concurrency control, transactions and crash recovery, indexing, constraints, and access control — and the file-level failure each one answers.
- Distinguish server, instance, database, schema, and table, and use the client/server model to explain why an application never opens the data files itself.
- Classify a requirement as OLTP or OLAP from rows touched, columns needed, and deadline, and explain why a row-oriented and a column-oriented layout cannot both be optimal.
- Place any database product on a map of families — relational, document, key-value, wide-column, graph, time-series, vector, search — and justify why relational remains the reasonable default.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Files-vs-a-Database.md](01-Files-vs-a-Database.md) | lost updates and torn writes on shared files; what a DBMS is; the client/server model; server vs instance vs `database` vs `schema` vs `table` | 1 day |
| [02-OLTP-OLAP-and-Workload-Shapes.md](02-OLTP-OLAP-and-Workload-Shapes.md) | point lookups vs full scans; row-store vs column-store layout and compression; HTAP and why it is hard; recognising a workload shape | 1 day |
| [03-The-Database-Landscape.md](03-The-Database-Landscape.md) | relational, document, key-value, wide-column, graph, time-series, vector, search; managed vs self-hosted; where this repo's courses fit | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 2: Data Models](../Phase-02-Data-Models/README.md)
