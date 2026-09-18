# Phase 12: Database Design — Overview

## What You'll Learn

Database design is the foundation of every scalable system. Bad design causes slow queries, data duplication, and bugs that are impossible to fix without rewriting everything. This phase covers how to design schemas that are correct, efficient, and maintainable.

## Learning Objectives

- Understand normalization (1NF through BCNF)
- Identify and fix anomalies (insertion, update, deletion)
- Draw ER diagrams and translate them to MySQL schemas
- Apply common design patterns (soft delete, audit tables, polymorphic associations)
- Know when to denormalize for performance

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Normalization.md](01-Normalization.md) | 1NF, 2NF, 3NF, BCNF with examples | 3 days |
| [02-ER-Diagrams.md](02-ER-Diagrams.md) | Entities, relationships, cardinality, translation | 2 days |
| [03-Design-Patterns.md](03-Design-Patterns.md) | Soft delete, audit, polymorphic, JSONB hybrid | 2 days |

## Prerequisites

- All previous phases (DDL, DML, Joins, Indexes, Transactions)

## Estimated Time

1 week

## Next Steps

→ [Quick Reference](../Quick-Reference/README.md) — cheatsheets and interview prep
→ [Projects](../Projects/README.md) — apply design skills to real projects
