# Phase 7: Transactions

## Overview

MongoDB transactions allow you to execute multiple operations atomically — either all succeed or all fail — just like SQL transactions. Phase 7 covers the theoretical foundations of ACID in MongoDB and the practical mechanics of multi-document transactions.

**Estimated Time:** 1 week

---

## Learning Objectives

By the end of Phase 7 you will be able to:

- Explain how MongoDB achieves each of the ACID properties
- Configure read concerns and write concerns for your workload
- Write Node.js code that starts, commits, and retries transactions
- Identify when transactions are appropriate and when to avoid them
- Reason about performance costs and limitations of distributed transactions

---

## Files in This Phase

```
Phase-07-Transactions/
├── README.md                        ← you are here
├── 01-ACID-MongoDB.md               ← ACID properties, read/write concerns, sessions
└── 02-Multi-Document-Transactions.md ← Node.js transactions, retryable writes, shards
```

### File 1 — [01-ACID-MongoDB.md](./01-ACID-MongoDB.md)

Covers the theoretical backbone:

- Atomicity at the single-document and multi-document level
- Consistency via schema validation
- Isolation using snapshot isolation and MVCC
- Durability via the WiredTiger journal
- Read concerns: `local`, `available`, `majority`, `linearizable`
- Write concerns: `w:1`, `w:majority`, `j:true`, `wtimeout`
- Causally consistent sessions

### File 2 — [02-Multi-Document-Transactions.md](./02-Multi-Document-Transactions.md)

Covers practical implementation:

- Full Node.js transaction example with `startSession` / `startTransaction` / `commitTransaction`
- Error handling with try/catch/finally and retry logic
- Transaction limitations (60 s max runtime, 16 MB oplog cap, performance cost)
- Retryable writes
- Distributed transactions across shards

---

## Prerequisites

- Phase 6 (Indexes) completed — understanding query execution helps reason about transaction performance
- Node.js driver (`mongodb` npm package) installed for code examples

---

## Quick Reference

```
Single-document ops  →  always atomic, no transaction needed
Multi-document ops   →  use explicit transactions (MongoDB 4.0+)
Cross-shard ops      →  distributed transactions (MongoDB 4.2+)
```

---

## Phase Navigation

| Previous | Current | Next |
|---|---|---|
| [Phase 6 — Indexes](../Phase-06-Indexes/README.md) | **Phase 7 — Transactions** | [Phase 8 — Performance](../Phase-08-Performance/README.md) |
