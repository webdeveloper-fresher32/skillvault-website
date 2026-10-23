# Phase 09 — PL/pgSQL, Stored Procedures & Triggers

## Overview

Procedural code executed directly inside the database engine minimizes network latency, encapsulates business invariants, and enables reactive auditing. In this phase, you will master PostgreSQL's procedural language (PL/pgSQL), the critical distinction between Functions and Stored Procedures (including internal transaction management with `COMMIT`/`ROLLBACK`), and building tamper-proof audit trails using row, statement, and event triggers.

---

## Objectives

By completing Phase 09, you will be able to:
1. Write robust PL/pgSQL functions with control structures (`IF/THEN/ELSE`, `LOOP`, `FOR`, `WHILE`) and exception handling (`BEGIN ... EXCEPTION WHEN ...`).
2. Differentiate between `IMMUTABLE`, `STABLE`, and `VOLATILE` function volatility categories and their impact on query optimization.
3. Understand the distinction between **Functions** (which evaluate inside a single statement and cannot commit) and **Stored Procedures** (which can manage their own internal transactions via `COMMIT`).
4. Implement row-level triggers (`BEFORE INSERT/UPDATE/DELETE`) using special variables (`NEW`, `OLD`, `TG_OP`).
5. Construct automated, tamper-proof security and audit logging tables that capture user identity, IP address, and JSON diffs of changes.

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-PLpgSQL-Functions-and-Control-Structures.md](./01-PLpgSQL-Functions-and-Control-Structures.md) | Syntax, variables, loops, exception trapping, and volatility categories (IMMUTABLE/STABLE). |
| 2 | [02-Stored-Procedures-with-Transaction-Control.md](./02-Stored-Procedures-with-Transaction-Control.md) | Functions vs Procedures, calling with CALL, committing intermediate batches in procedures. |
| 3 | [03-Triggers-and-Audit-Logging.md](./03-Triggers-and-Audit-Logging.md) | Row vs statement triggers, BEFORE/AFTER/INSTEAD OF, and building generic JSON audit loggers. |

---

## Time Estimate

- **Estimated study time:** 6–8 hours.
- **Hands-on practice:** 3 hours building an automated JSON audit logging trigger framework.
