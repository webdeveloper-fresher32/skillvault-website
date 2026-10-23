# Phase 04: Microservices Data Management

Data management is arguably the most difficult aspect of microservices architecture. 

In a monolith, data is centralized. You can join tables easily, and you can rely on the database to ensure ACID (Atomicity, Consistency, Isolation, Durability) transactions. If a multi-step operation fails, the database simply rolls it all back.

In microservices, data is decentralized. You can no longer run simple SQL `JOIN`s across services, and there is no single database to handle rollbacks.

## Learning Objectives

By the end of this phase, you will understand:
- The "Database per Service" pattern and why it is mandatory.
- How to handle distributed transactions using the Saga Pattern.
- How to perform complex queries across multiple databases using API Composition and CQRS.
- The reality of Eventual Consistency.

## Files in this Phase

1. `01-Database-Per-Service.md`: The rule that prevents the Distributed Monolith.
2. `02-The-Saga-Pattern.md`: Managing transactions that span multiple microservices.
3. `03-CQRS-and-API-Composition.md`: How to query data when you can't use SQL `JOIN`s.
