# Phase 3: Relational Theory and Schema Design

## What You'll Learn

How relations, keys, and foreign keys give a schema its guarantees, how to turn a written requirement into an entity-relationship model and then into tables, and how to normalize a table to BCNF and decide when to deliberately step back from it.

## Learning Objectives

- Distinguish candidate, primary, composite, surrogate, and natural keys, and choose referential actions (`CASCADE`, `RESTRICT`, `SET NULL`) that match the relationship being modelled.
- Turn prose requirements into an ER model with explicit cardinality and optionality, then translate that model mechanically into tables.
- Establish functional dependencies, drive one table from unnormalised to BCNF naming the anomaly each normal form removes, and justify any step back from it with a measurement, a single writer path, and a reconciliation query.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Keys-and-Relationships.md](01-Keys-and-Relationships.md) | relations, tuples, attributes; candidate, primary, composite, surrogate and natural keys; foreign keys and referential integrity; `ON DELETE` actions; why many-to-many needs a junction table | 1 day |
| [02-ER-Modelling-and-Cardinality.md](02-ER-Modelling-and-Cardinality.md) | entities, attributes, relationships; crow's foot cardinality and optionality; a library domain from prose to ER diagram to DDL; verbs that are entities and hidden many-to-many | 1 day |
| [03-Normalization-1NF-to-BCNF.md](03-Normalization-1NF-to-BCNF.md) | functional dependencies; insert, update and delete anomalies; 1NF, 2NF, 3NF and BCNF on one running table; why 4NF and 5NF rarely come up | 1 day |
| [04-When-to-Denormalize.md](04-When-to-Denormalize.md) | derived aggregates, counters and materialised reporting tables; captured immutable values that are not copies; keeping a denormalised copy correct; measuring before trading | 1 day |

## Estimated Time

4 days

## Next Phase

→ [Phase 4: SQL Foundations](../../../../04-SYSTEMS-INFRASTRUCTURE/04-Developer-Tools/Git/Phase-01-Git-Core-Architecture-and-Plumbing/README.md)
