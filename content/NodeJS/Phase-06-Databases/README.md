# Phase 06 — Databases (Node's Integration Layer)

Node.js talks to databases through drivers and ORMs/ODMs. This phase is **not** a database fundamentals course — it's about the Node-specific plumbing: how to connect, model data, run CRUD, pool connections, configure credentials per environment, and wrap multi-step writes in transactions.

> **For deep MongoDB/MySQL fundamentals** (indexing, aggregation pipelines, normalization, query optimization, replication, sharding, SQL joins/subqueries, transactions internals, etc.), **see the sibling `../../Databases/MongoDB/` and `../../Databases/MySQL/` courses in this repo — this phase covers Node's integration layer only.**

## Why This Phase Matters

As a Python/React engineer, you already know SQLAlchemy/Django ORM or PyMongo conceptually. This phase maps that knowledge onto Node's two dominant tools — **Mongoose** (MongoDB ODM) and **Prisma** (SQL ORM) — plus the operational concerns (pooling, env config, transactions) that come up constantly in interviews and in production incidents.

## Files in This Phase

| File | Topic |
|------|-------|
| `01-MongoDB-with-Mongoose.md` | Connecting with Mongoose, schemas/models, CRUD, validation, population (refs) |
| `02-SQL-with-an-ORM-Prisma.md` | Connecting to Postgres/MySQL with Prisma, `schema.prisma`, migrations, CRUD, relations |
| `03-Connection-Pooling-and-Environment-Config.md` | Why pooling matters, pool sizing, `dotenv`, config patterns for dev/test/prod |
| `04-Transactions-in-Node.md` | Mongoose sessions and Prisma `$transaction`, a balance-transfer example |

## Learning Path

| Step | Topic | Difficulty | Time |
|------|-------|------------|------|
| 1 | MongoDB with Mongoose | Medium | 2-3 hrs |
| 2 | SQL with an ORM (Prisma) | Medium | 2-3 hrs |
| 3 | Connection Pooling and Environment Config | Medium | 1-2 hrs |
| 4 | Transactions in Node | Medium-Hard | 2 hrs |

## Prerequisites

Phase 01 (Node fundamentals), Phase 02 (event loop/async — every DB call here is a Promise), Phase 04 (Express — routes call into these DB layers). Basic familiarity with MongoDB or SQL concepts (from the sibling courses, or prior experience) is assumed.

## Outcome

By the end of this phase you can wire an Express app to either MongoDB or a SQL database, define schemas/models with validation and relations, configure pooled connections safely across environments, and reach for a transaction when a multi-step write must be all-or-nothing.
