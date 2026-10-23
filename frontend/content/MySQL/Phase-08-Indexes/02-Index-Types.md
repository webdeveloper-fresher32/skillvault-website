# MySQL Index Types — Complete Guide

You already know indexes speed things up — that was the whole point of the last file. But "an index" isn't one thing. MySQL gives you almost a dozen different flavors, each built for a different kind of pain: searching text, searching geometry, filtering on multiple columns at once, saving space on giant strings, testing whether an index is even needed before you delete it.

This file walks through each type the same way: what problem forced this index to exist, a real-world analogy, how it actually works under the hood, and where people trip over it. Two of these — composite indexes (leftmost prefix rule) and covering indexes — are the ones interviewers actually probe on, so those get the deepest treatment.

## Table of Contents
1. [B-Tree Index (Default)](#1-b-tree-index-default)
2. [FULLTEXT Index](#2-fulltext-index)
3. [SPATIAL Index](#3-spatial-index)
4. [Composite Indexes](#4-composite-indexes)
5. [Unique Indexes](#5-unique-indexes)
6. [Covering Indexes](#6-covering-indexes)
7. [Prefix Indexes](#7-prefix-indexes)
8. [Invisible Indexes (MySQL 8.0)](#8-invisible-indexes-mysql-80)
9. [Descending Indexes (MySQL 8.0)](#9-descending-indexes-mysql-80)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. B-Tree Index (Default)

**The problem:** you run `CREATE INDEX idx ON table(column)` without specifying a type — what do you actually get, and what can it and can't it do?

**Analogy:** the phone book. Names are sorted A→Z, so "find Smith" is fast — you jump straight to the S section. But "find everyone whose name ends in -son" doesn't work with a phone book at all — you'd have to read every entry, because it's sorted by the *start* of the name, not the end.

**Basic definition:** the B-tree index is MySQL's default and workhorse index type — the same sorted, self-balancing tree structure covered in the previous file. Unless you say otherwise, every `CREATE INDEX` you write is a B-tree.

```sql
CREATE INDEX idx_name ON table(column);
-- Equivalent to:
CREATE INDEX idx_name ON table(column) USING BTREE;
```

Because the tree is sorted, it's good at anything that respects that sort order, and useless at anything that doesn't:

**Supports:**
- `=` (equality)
- `<`, `>`, `<=`, `>=`, `BETWEEN` (range)
- `LIKE 'prefix%'` (prefix match — "prefix" sorts together, same as the phone book)
- `ORDER BY` and `GROUP BY` (avoids filesort)
- `IS NULL` and `IS NOT NULL`

**Does NOT support:**
- `LIKE '%suffix'` or `LIKE '%middle%'` (no leading wildcard — same reason the phone book can't find "-son" names)
- Functions on the indexed column: `WHERE UPPER(name) = 'JOHN'` (the function's output isn't what's stored in the sorted tree)
- Non-equality on non-leading columns in composite index (more on this in Section 4)

> **Memory hook:** a B-tree index is a phone book — great for "starts with," useless for "ends with."

---

## 2. FULLTEXT Index

**The problem:** you have a `body TEXT` column full of article content, and you want to search it the way Google does — "find articles about database performance" — not the way `LIKE` does.

Try that with a B-tree and `LIKE '%database performance%'`: no leading wildcard means no index use, so MySQL scans every row, and even then it only matches the *exact substring*, not "articles that are relevant to these words."

**Analogy:** think of the index at the back of a textbook that lists every important word and which pages mention it — except this one also ranks *how relevant* each page is to the word, not just whether the word appears.

**Basic definition:** a FULLTEXT index builds a word-level index over one or more text columns, enabling natural-language relevance search instead of exact substring matching.

**How it's different from a B-tree, internally:** a B-tree stores whole column values in sorted order. A FULLTEXT index instead breaks the text into individual words, and for each word keeps a list of which rows contain it (plus how often/where) — so `MATCH() AGAINST()` isn't "scan and compare," it's "look up this word, get the row list, rank by relevance."

```sql
-- Create fulltext index
CREATE TABLE articles (
  id      INT PRIMARY KEY,
  title   VARCHAR(200),
  body    TEXT,
  FULLTEXT INDEX ft_content (title, body)
);

-- Natural language mode (default)
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST('database performance');

-- Boolean mode — more control
SELECT *, MATCH(title, body) AGAINST('+mysql -oracle' IN BOOLEAN MODE) AS score
FROM articles
WHERE MATCH(title, body) AGAINST('+mysql -oracle' IN BOOLEAN MODE);
-- +word: must contain, -word: must not contain, "phrase": exact phrase

-- Query expansion — finds related terms
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST('database' WITH QUERY EXPANSION);
```

### Boolean Mode Operators

| Operator | Meaning |
|----------|---------|
| `+word` | Row must contain this word |
| `-word` | Row must NOT contain this word |
| `"phrase"` | Exact phrase match |
| `word*` | Wildcard (prefix match) |
| `~word` | Lower the relevance if present |

> **Memory hook:** a FULLTEXT index is the "index of important words" at the back of a textbook — it points you at relevant pages, it doesn't just check if a phrase literally appears.

---

## 3. SPATIAL Index

**The problem:** "find all restaurants within this polygon on the map." A B-tree sorts values along one line — it has no concept of "near" or "inside this shape" for two-dimensional points.

**Analogy:** a B-tree is like sorting names alphabetically — one dimension. Location data is two (or more) dimensional: a point has both an x and a y, and "nearby" isn't a simple sort-order concept the way "starts with S" is.

**Basic definition:** a SPATIAL index is a special index (R-tree based) for GEOMETRY column types — points, lines, polygons — that supports queries like "is this point inside that shape" efficiently.

```sql
CREATE TABLE locations (
  id    INT PRIMARY KEY,
  name  VARCHAR(100),
  point POINT NOT NULL,
  SPATIAL INDEX idx_location (point)
);

-- Find locations within a polygon
SELECT name FROM locations
WHERE ST_Contains(
  ST_GeomFromText('POLYGON((0 0, 0 10, 10 10, 10 0, 0 0))'),
  point
);
```

Requires GEOMETRY column types and MyISAM or InnoDB (MySQL 5.7.5+).

> **Memory hook:** a SPATIAL index is a map with a grid overlay — it lets you ask "what's inside this box" instead of just "what's before or after this line."

---

## 4. Composite Indexes

**The problem:** you keep querying `WHERE department = 'Sales' AND salary > 50000` together. One single-column index on `department` narrows things down, then MySQL still has to scan every Sales row to filter by salary. Can one index handle *both* conditions at once?

**Analogy:** a phone book sorted by last name — but what if it were sorted by **last name, then first name**? Now "find all the Smiths" is fast, and "find Smith, Bob specifically" is even faster, because within the Smith block, first names are also sorted. That's a composite index.

**Basic definition:** an index built on multiple columns together, where **column order is part of the index's identity** — changing the order effectively creates a different index with different capabilities.

```sql
-- Composite index: (department, salary)
CREATE INDEX idx_dept_salary ON employees(department, salary);
```

### The Leftmost Prefix Rule

Here's the part that trips people up in interviews and in production alike. A composite index is really *one* sorted structure, sorted first by column 1, then within each column-1 value, sorted by column 2, and so on. That means you can only "jump into" the sorted structure by starting from the leftmost column — same as you can't open a phone book to "people named Bob" without knowing the last name first.

```
INDEX (department, salary, hire_date)

Queries that CAN use this index:
✅ WHERE department = 'Sales'
✅ WHERE department = 'Sales' AND salary > 50000
✅ WHERE department = 'Sales' AND salary = 60000 AND hire_date > '2020-01-01'
✅ ORDER BY department, salary  (covers sort)

Queries that CANNOT use this index:
❌ WHERE salary = 60000              (skips first column)
❌ WHERE hire_date > '2020-01-01'   (skips first two columns)
❌ WHERE salary = 60000 AND hire_date > '2020-01-01'  (skips first column)
```

```
Visual: index like a phone book sorted by (LastName, FirstName)
┌──────────────────────────────────────────┐
│  Smith, Alice                            │
│  Smith, Bob     ← can find all Smiths    │
│  Smith, Carol      (leftmost used)       │
│  Taylor, Dave                            │
│  Taylor, Eve    ← cannot find all "Bobs" │
└──────────────────────────────────────────┘  without knowing last name
```

Notice the shape of the rule: as long as you supply the columns *in order, from the left*, the optimizer can keep using the index — you can stop at any point (just `department`, or `department` + `salary`), but you can't skip the front of the line.

### Column Order Best Practices

So if column order matters this much, how do you pick it? A simple three-tier rule of thumb:

1. **Equality columns first** (columns with `=` in WHERE)
2. **Sort columns next** (ORDER BY)
3. **Range columns last** (`>`, `<`, `BETWEEN`)

```sql
-- Query: WHERE dept = 'Sales' AND salary > 50000 ORDER BY salary
-- Best index:
CREATE INDEX idx ON employees(dept, salary);
--                             ^^^^  ^^^^^
--                           equality range+sort
```

Why in that order? Equality columns narrow the search to a single, contiguous block in the sorted tree — the cheapest possible filter. Range columns can only narrow within whatever block you've already landed in, and once you hit a range condition, no column after it in the index can be used for further filtering (it's no longer a single contiguous slice).

**Common mistakes with composite indexes:**
- Defining `INDEX (department, salary, hire_date)` but writing `WHERE salary > 50000` with no `department` filter — the index sits there unused because the query skips the leftmost column.
- Assuming column order doesn't matter — `(department, salary)` and `(salary, department)` are two *entirely different* indexes with different use cases.
- Putting a range column before an equality column — it works, but wastes the index's ability to also filter on the later equality column efficiently.
- Creating too many composite indexes "just in case" — every index, composite or not, is extra work on every INSERT/UPDATE/DELETE. More on this trade-off in the previous file's Section 6 (Index Overhead).

**Interview answer:** "A composite index on (a, b, c) is a single sorted structure, sorted by a, then by b within each a, then by c within each (a,b). Because of that sort order, the optimizer can only use the index if your query filters starting from the leftmost column — `a`, `a AND b`, or `a AND b AND c` all work; `b` alone, `c` alone, or `b AND c` don't, because there's no way to jump into the middle of a multi-level sort without knowing what comes before it. This is exactly like a phone book sorted by last name then first name: you can find all the Smiths, but you can't find 'anyone named Bob' without scanning the whole book."

> **Memory hook:** a composite index is a phone book sorted by (last name, first name) — you can only walk in from the left.

---

## 5. Unique Indexes

**The problem:** two users signing up with the same email address. You need the database itself to refuse that — not just application code, which can always be bypassed or have bugs.

**Analogy:** think of it as a B-tree index with a bouncer standing at the door — it does everything a regular index does (fast lookups), plus it rejects any new entry that duplicates an existing one.

**Basic definition:** a unique index is a B-tree index with a uniqueness constraint attached — it speeds up lookups *and* guarantees no two rows share the same value (or combination of values, for a composite unique index).

```sql
CREATE UNIQUE INDEX idx_email ON users(email);

-- Composite unique
CREATE UNIQUE INDEX idx_order_product ON order_items(order_id, product_id);
```

A UNIQUE constraint automatically creates a unique index — you get both for the price of one declaration. One quirk worth remembering: NULL values are exempt from the uniqueness check, so multiple rows can each have a NULL email without conflicting.

> **Memory hook:** a unique index is a regular index with a bouncer at the door — fast lookups, zero duplicates allowed.

---

## 6. Covering Indexes

**The problem:** you've already added the "obvious" index, but EXPLAIN still shows extra work. Say you run:

```sql
SELECT name, email FROM users WHERE status = 'active';
```

An index on just `status` gets you to the right rows fast — but then, for every matching row, MySQL still has to go back to the actual table to fetch `name` and `email`. That's an extra disk/memory hop per row, on top of the index lookup you already paid for.

**Analogy:** imagine a library card catalog that lists not just the book's shelf location, but the entire summary, author bio, and table of contents right there on the card. You'd never have to walk to the shelf at all — the card *is* the answer.

**Basic definition:** a covering index is an index that includes **every column the query needs** — for filtering, sorting, and selecting — so MySQL can answer the whole query from the index alone, without ever touching the underlying table.

**How it works internally, step by step:**

```
Without covering index:
  Index lookup → get row pointer → fetch row from table (extra I/O)

With covering index:
  Index lookup → data is right there in the index leaf → done!
```

```sql
-- Query: get name and email for active users
SELECT name, email FROM users WHERE status = 'active';

-- Covering index: includes all 3 columns (status, name, email)
CREATE INDEX idx_covering ON users(status, name, email);
-- EXPLAIN shows: Extra: Using index  ← no table row lookup needed!
```

Why does putting `name` and `email` in the index (not just `status`) help, even though you're not filtering on them? Because a B-tree index's leaf nodes already store the full indexed column values — if those values happen to include everything the `SELECT` list asks for, there's simply nothing left to fetch from the table.

**Common mistakes:**
- Forgetting that column *order* still matters here too — the leading columns should still be the ones used for filtering/sorting (leftmost prefix rule applies), with the "extra" SELECT-only columns tacked on at the end.
- Assuming `SELECT *` can ever be covered — it can't, unless the index happens to include literally every column in the table, which defeats the purpose.
- Over-widening a covering index to cover every possible query — a bloated index costs more on every write, so this only pays off for genuinely hot, predictable queries.

**Interview answer:** "A covering index contains every column a query touches — the WHERE columns, the ORDER BY columns, and the SELECT columns — so MySQL can satisfy the entire query by reading the index's leaf nodes and never has to do a second lookup against the actual table row. You can confirm this with EXPLAIN: the Extra column shows 'Using index' when a query is fully covered. It's most valuable for frequent, read-heavy queries with a small, predictable set of columns."

> **Memory hook:** a covering index is a library card that already has the whole book summarized on it — you never walk to the shelf.

---

## 7. Prefix Indexes

Index only the first n characters of a VARCHAR/TEXT column — saves space.

```sql
-- Index first 20 characters of URL
CREATE INDEX idx_url ON pages(url(20));

-- Index first 10 characters of description
CREATE INDEX idx_desc ON products(description(10));
```

**Tradeoffs:**
- ✅ Smaller index — faster to scan, less memory
- ❌ Lower selectivity (same prefix = same entry = more collisions)
- ❌ Cannot be a covering index
- ❌ Cannot use for ORDER BY

**Finding the right prefix length:**

```sql
-- Find how many characters give ~90% selectivity
SELECT
  COUNT(DISTINCT LEFT(email, 5)) / COUNT(*) AS sel_5,
  COUNT(DISTINCT LEFT(email, 10)) / COUNT(*) AS sel_10,
  COUNT(DISTINCT LEFT(email, 20)) / COUNT(*) AS sel_20,
  COUNT(DISTINCT email) / COUNT(*) AS sel_full
FROM users;
-- Pick the shortest length that approaches sel_full
```

---

## 8. Invisible Indexes (MySQL 8.0)

Make an index invisible to the query optimizer — test the impact before dropping.

```sql
-- Make index invisible (optimizer ignores it, index still maintained)
ALTER TABLE users ALTER INDEX idx_email INVISIBLE;

-- Run your queries — if they're still fast, the index isn't needed
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
-- type: ALL  ← confirms optimizer not using it

-- If performance is fine without it, drop it
DROP INDEX idx_email ON users;

-- If performance drops, make it visible again
ALTER TABLE users ALTER INDEX idx_email VISIBLE;
```

---

## 9. Descending Indexes (MySQL 8.0)

For queries with ORDER BY mixing ASC and DESC.

```sql
-- Query: ORDER BY last_name ASC, created_at DESC
-- Standard index can't efficiently serve mixed sort direction

-- Create descending index on created_at
CREATE INDEX idx_name_date ON users(last_name ASC, created_at DESC);

-- Now this query avoids filesort:
SELECT * FROM users ORDER BY last_name ASC, created_at DESC;
```

---

## 10. Hands-On Exercises

**Exercise 1:** Create a `posts` table with title and body TEXT columns. Add a FULLTEXT index. Insert 10 rows with varied content. Search using boolean mode with + and - operators.

**Exercise 2:** Create a composite index on (status, created_at) for an orders table. Test which of these queries use the index: WHERE status='paid', WHERE created_at > '2025-01-01', WHERE status='paid' AND created_at > '2025-01-01'.

**Exercise 3:** Design a covering index for this query: `SELECT id, name, price FROM products WHERE category_id = 5 AND is_active = 1`. Verify with EXPLAIN that Extra shows "Using index".

**Exercise 4:** Find the optimal prefix length for an email column in a users table with 10,000 rows using the selectivity query above.

**Exercise 5:** Make an existing index invisible, run affected queries, verify EXPLAIN shows full scan, then make it visible again.

---

## 11. Interview Q&A

**Q: What is the leftmost prefix rule for composite indexes?**
Answer: A composite index (a, b, c) can be used for queries filtering on (a), (a,b), or (a,b,c) — but not (b), (c), or (b,c) alone. The optimizer must start from the leftmost column. Think of it like a phone book sorted by last name then first name — you can look up by last name, or last+first, but not by first name alone.

**Q: What is a covering index?**
Answer: A covering index contains all the columns needed to satisfy a query — SELECT columns, WHERE columns, and ORDER BY columns. MySQL can answer the query entirely from the index without accessing the table rows, eliminating an extra I/O step. EXPLAIN shows "Using index" in the Extra column.

**Q: When would you use a prefix index?**
Answer: When indexing very long VARCHAR or TEXT columns where full-value indexing wastes significant space. Choose the shortest prefix that maintains near-full selectivity. Tradeoff: can't be used as a covering index or for ORDER BY.

**Q: What is a FULLTEXT index and when should you use it?**
Answer: FULLTEXT indexes enable natural language search on text columns using relevance ranking. Use them for search features (article search, product search). They support boolean mode operators (+/-/"") and don't work with standard LIKE queries. Available in InnoDB since MySQL 5.6.

**Q: What is an invisible index and why is it useful?**
Answer: An invisible index (MySQL 8.0+) is maintained by MySQL but hidden from the query optimizer. It lets you safely test whether an index is actually used before dropping it — set invisible, run queries, if no performance drop, drop it. Safer than dropping and re-creating.
