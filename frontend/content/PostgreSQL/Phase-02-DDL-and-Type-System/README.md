# Phase 02 — Advanced DDL & The Postgres Type System

## Overview

PostgreSQL's type system and Data Definition Language (DDL) capabilities go far beyond traditional SQL databases. In this phase, you will master PostgreSQL schemas, multi-tenancy namespace patterns, domain constraints, custom types, rich built-in types (UUID, Arrays, Ranges, Network types), and deep-dive into the industry-standard `JSONB` binary document engine.

---

## Objectives

By completing Phase 02, you will be able to:
1. Design multi-tenant schemas utilizing PostgreSQL namespaces and manipulate `search_path`.
2. Apply advanced table constraints: `CHECK`, `EXCLUDE` (with GiST), and `GENERATED ALWAYS AS ... STORED` computed columns.
3. Utilize PostgreSQL specialized types: UUID v4/v7, one-dimensional and multi-dimensional Arrays, Ranges (`tsrange`, `daterange`, `int4range`), and Network addresses (`inet`, `cidr`).
4. Master the differences between `JSON` and `JSONB` storage representations.
5. Query, index, and manipulate JSONB documents using operators (`->`, `->>`, `@>`, `#>`, `?|`) and JSON Path expressions (`jsonb_path_query`).

---

## Lessons in This Phase

| # | Lesson | Description |
|---|--------|-------------|
| 1 | [01-Schemas-Namespaces-and-Constraints.md](./01-Schemas-Namespaces-and-Constraints.md) | Schemas, search_path multi-tenancy, CHECK, EXCLUDE, and GENERATED columns. |
| 2 | [02-PostgreSQL-Rich-Data-Types.md](./02-PostgreSQL-Rich-Data-Types.md) | UUIDs, Arrays, Ranges, Enums, Network types (inet), and Temporal types. |
| 3 | [03-JSON-and-JSONB-Deep-Dive.md](./03-JSON-and-JSONB-Deep-Dive.md) | JSON vs JSONB, indexing JSONB with GIN, containment operators, and jsonpath. |

---

## Time Estimate

- **Estimated study time:** 7–9 hours.
- **Hands-on practice:** 3 hours modeling schema constraints and indexing JSONB structures.
