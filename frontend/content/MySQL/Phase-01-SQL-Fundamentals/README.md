# Phase 01 — SQL Fundamentals

## Overview

This phase lays the foundation for everything that follows. Before writing a single query
you need to understand *why* relational databases exist, *how* MySQL fits into the broader
SQL ecosystem, and *where* to set up a working environment. By the end of Week 1 you will
be able to spin up a MySQL server, connect to it, create databases and tables, and explain
the core concepts in an interview setting.

---

## Table of Contents

1. [Objectives](#objectives)
2. [Files in This Phase](#files-in-this-phase)
3. [Prerequisites](#prerequisites)
4. [Time Estimate](#time-estimate)
5. [Next Phase](#next-phase)

---

## Objectives

By completing Phase 01 you will be able to:

1. Explain what SQL is, why it is declarative, and how it differs from imperative code.
2. Name the five SQL sublanguages (DDL, DML, DQL, DCL, TCL) and give an example statement for each.
3. Describe MySQL's history, architecture layers, and storage engine choices.
4. Install MySQL on macOS, Ubuntu, or Windows and verify the service is running.
5. Connect via the CLI and MySQL Workbench, run `mysql_secure_installation`, and create a database with a dedicated user.
6. Create a database and a table with correct data types and explain what `CHARACTER SET utf8mb4` means.

---

## Files in This Phase

| # | File | Description |
|---|------|-------------|
| 1 | [01-What-is-SQL-MySQL.md](./01-What-is-SQL-MySQL.md) | SQL language overview, MySQL history, architecture, storage engines, comparisons |
| 2 | [02-Installation-Setup.md](./02-Installation-Setup.md) | Install on macOS/Ubuntu/Windows, Docker, CLI, Workbench, config |
| 3 | [03-Database-Tables-Basics.md](./03-Database-Tables-Basics.md) | CREATE DATABASE, CREATE TABLE, data types, information_schema |

---

## Prerequisites

None. This is the starting point of the curriculum. Comfort with the command line (navigating
directories, running commands) is helpful but not required.

---

## Time Estimate

**1 week** — approximately 8–10 hours spread across 5 days:

| Day | Activity |
|-----|----------|
| 1 | Read 01-What-is-SQL-MySQL.md, complete its exercises |
| 2 | Work through 02-Installation-Setup.md, get MySQL running locally |
| 3 | Read 03-Database-Tables-Basics.md, create your first schema |
| 4 | Revisit all exercises, attempt the Interview Q&A without looking |
| 5 | Review weak areas, write a brief self-summary |

---

## Next Phase

When you are comfortable with all six objectives above, proceed to:

[Phase 02 — Data Definition Language (DDL)](../Phase-02-DDL/README.md)
