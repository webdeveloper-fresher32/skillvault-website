# Indexing

Imagine your `users` table has grown to 1,000,000 rows, and every login runs `SELECT * FROM users WHERE email = 'ganesh@example.com'`. Without help, the database has no idea where that row lives — it has to look at every single row until it finds a match.

## Without an Index: The Linear Scan

```
Looking for email = "ganesh@example.com" among 1,000,000 rows:

Row 1        email = "alice@example.com"      ❌ not a match
Row 2        email = "bob@example.com"        ❌ not a match
Row 3        email = "carol@example.com"      ❌ not a match
   ⋮                    ⋮
Row 847,213  email = "ganesh@example.com"      ✅ found it — after 847,213 checks
   ⋮
Row 1,000,000

Worst case: 1,000,000 comparisons. Average case: ~500,000.
```

This is `O(n)` — the more rows you add, the slower every lookup gets, in direct proportion. At 1 million rows this might take tens of milliseconds. At 100 million rows, it's unusable.

## With an Index: The Direct Jump

An index is a separate, sorted data structure the database maintains alongside the table, mapping the indexed column's values straight to the row's physical location.

```
Index on `email` (conceptually, a sorted lookup structure):

"alice@example.com"    → Row 1
"bob@example.com"       → Row 2
"carol@example.com"     → Row 3
   ⋮
"ganesh@example.com"    → Row 847,213   ← binary search lands here in ~20 steps
   ⋮

Lookup: binary-search the index (fast) → jump directly to Row 847,213 (fast)
```

Instead of 847,213 comparisons, a lookup takes roughly `log(n)` comparisons — about 20 steps to search 1,000,000 sorted entries, because each comparison cuts the remaining search space in half.

## Declaring an Index in SQLAlchemy

In practice you don't build this structure yourself — you tell the ORM which columns need one, and the database engine builds and maintains it for you:

```python
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, index=True)   # <-- this line makes lookups by email fast
    hashed_password = Column(String)
```

`index=True` tells SQLAlchemy to create a database index on the `email` column when the table is created. Primary keys (`id` here) are indexed automatically by the database — `index=True` is what you add explicitly for the *other* columns you frequently filter or `JOIN` on, like `email`, `user_id` foreign keys, or a `created_at` column you sort feeds by.

## The B-Tree, Briefly

Most relational databases implement indexes as a **B-tree** — a balanced tree structure where every leaf is the same distance from the root, and each node holds a sorted range of keys pointing either to more nodes or to actual rows. Balanced means no lookup ever has to walk further than `log(n)` levels deep, regardless of which value you're searching for. That's the entire reason indexed lookups scale so much better than table scans: doubling the table size adds roughly one extra level to the tree, not a doubling of work.

## The Trade-Off: Indexes Aren't Free

An index has to be kept in sync with the table. Every `INSERT`, `UPDATE`, or `DELETE` that touches an indexed column has to also update the index's tree structure — so indexes speed up reads at the cost of slower writes and extra disk space.

```
INSERT INTO users (email, ...) VALUES ('new@example.com', ...);
                │
                ├─→ write the new row to the table
                └─→ ALSO update the email index's B-tree to include it
```

This is why you index columns you *filter, sort, or join on frequently* (`email`, `user_id`), not every column in a table. A table with ten indexes on it can make `SELECT`s fast and `INSERT`s noticeably slower — a real trade-off you should be ready to name in an interview, not just index everything "to be safe."

## Interview Q&A

**Q: What does a database index actually do, mechanically?**
A: It maintains a separate, sorted structure (typically a B-tree) mapping column values to row locations, so a lookup can binary-search the structure — roughly `log(n)` steps — instead of scanning every row (`O(n)`).

**Q: Why not just index every column in every table?**
A: Every index has to be updated on every write to that column, so more indexes mean slower `INSERT`/`UPDATE`/`DELETE` operations and more disk space used. You index columns that are frequently filtered, sorted, or joined on — not everything.

**Q: If a query is still slow even though the column has an index, what would you check?**
A: Whether the index is actually being used (some query patterns, like a leading wildcard `LIKE '%term'` or applying a function to the column, can prevent the database from using the index), whether it's the right *type* of index for the query, and whether the table statistics are stale so the query planner is making a bad choice.

**Q: Does a composite (multi-column) index help a query that only filters on the second column?**
A: Generally no — a composite index on `(a, b)` is sorted by `a` first, so it's most useful for queries filtering on `a` alone or on `a` and `b` together. A query filtering only on `b` typically can't use that index efficiently and may need its own index.

**Q: How does indexing relate to the "reads go to replicas" pattern from the next lesson?**
A: They solve different problems — indexing makes each individual query faster, while replication adds more machines to handle more *concurrent* queries. A well-indexed replica is still much faster than a poorly-indexed one; the two techniques stack.
