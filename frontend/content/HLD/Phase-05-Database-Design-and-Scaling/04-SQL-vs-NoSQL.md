# SQL vs NoSQL

You've now got the tools to make a database fast (indexing) and to make it scale (replication, sharding) — but all of that assumed you'd already picked *what kind* of database to build on. That choice — relational (SQL) vs non-relational (NoSQL) — is usually the very first database decision in a design interview, and it's asked before any of the scaling techniques even come up.

## Two Different Bets

```
SQL (PostgreSQL, MySQL)              NoSQL (MongoDB, Cassandra, DynamoDB)
─────────────────────────            ──────────────────────────────────
Fixed schema, defined                Flexible schema — documents in
up front (tables, columns,           the same "table" can have
foreign keys)                        different fields

Strong consistency, ACID              Often eventual consistency,
transactions across rows/tables       tuned for availability & speed

Relationships enforced by             Relationships often denormalized
the database (JOINs, foreign          into the document itself —
key constraints)                      fewer JOINs, more duplication

Scales vertically easily;             Scales horizontally by design —
horizontal scaling (sharding)         built from the ground up to
requires deliberate effort            shard/partition across nodes
```

Neither is "better" — they're optimized for different shapes of problem, and picking one is a bet on what your system needs more of: strict correctness and relationships, or raw horizontal write throughput and schema flexibility.

## When SQL Wins

Reach for SQL when the data has real relationships that need to be enforced, and when correctness matters more than raw throughput — a lost or double-processed row is a real-world problem, not just a bad user experience.

- **Payments.** A `Payment Gateway` (covered as a full case study in Phase 11) cannot afford a transaction to partially apply — money debited from one account but never credited to another. SQL's ACID transactions guarantee the whole operation succeeds or the whole thing rolls back.
- **Orders and inventory.** An `Order` referencing a `User` and multiple `Product` rows, where stock counts must never go negative, benefits from foreign keys and multi-row transactions.

```python
# A SQL transaction: both writes succeed, or neither does.
with session.begin():
    debit_account(from_user, amount)
    credit_account(to_user, amount)
# if credit_account raises, debit_account is rolled back too
```

## When NoSQL Wins

Reach for NoSQL when the data doesn't have a fixed shape, when you need to write at very high volume across many machines from day one, or when the read/write pattern is simple key-based lookups rather than complex relational queries.

- **Chat messages.** Each message is a simple, self-contained document (sender, text, timestamp) with no need for cross-message JOINs, and a chat app may need to absorb enormous write volume (Phase 10's WhatsApp case study).
- **Social feed data.** A post can have wildly different shapes (text-only, image, video, poll), and feeds are read far more than they're strictly relationally queried — a document model fits naturally and shards easily by user or post ID.

## A Quick Comparison Table

| | SQL | NoSQL |
|---|---|---|
| Schema | Fixed, enforced | Flexible, per-document |
| Consistency | Strong (ACID) | Often eventual, tunable |
| Relationships | Native JOINs, foreign keys | Denormalized / app-managed |
| Horizontal scaling | Possible, but manual (sharding) | Built in by design |
| Best for | Payments, orders, anything needing transactions | Chat, feeds, logs, high-write-volume data |

## Interview Q&A

**Q: When would you choose NoSQL over SQL for a new system?**
A: When the data's shape varies or evolves quickly, when write throughput needs to scale horizontally from the start, and when you don't need multi-row transactional guarantees — chat messages and feed content are classic examples.

**Q: Why would a payment system almost always use SQL, even in an otherwise NoSQL-heavy architecture?**
A: Because payments require ACID transactions — a debit and a credit must both succeed or both fail, with no partial state ever visible. NoSQL databases historically trade away strict multi-row transaction guarantees in exchange for availability and horizontal scale, which is the wrong trade-off for money movement.

**Q: Can a single system use both SQL and NoSQL?**
A: Yes, and most real systems do — this is called polyglot persistence. A social app might use SQL for user accounts and payments, NoSQL for feed/message content, and Redis for caching and session data, choosing the right tool per data type rather than forcing everything into one model.

**Q: Is NoSQL always more scalable than SQL?**
A: Not automatically — SQL databases can be sharded and replicated too (Lessons 02-03 in this phase). NoSQL databases are typically *designed* for horizontal scaling from the ground up, making it easier by default, but a well-sharded SQL system can scale to enormous size as well; it just takes more deliberate engineering.

**Q: What's the risk of denormalizing data the way NoSQL encourages?**
A: Data duplication and the possibility of inconsistency — if the same piece of information (say, a username) is copied into many documents, updating it means updating every copy, and a missed one leaves stale data behind. SQL's normalized, single-source-of-truth model avoids this at the cost of needing JOINs to reassemble related data.
