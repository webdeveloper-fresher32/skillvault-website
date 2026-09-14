# Database Design Patterns — MySQL Complete Guide

## Table of Contents
1. [Soft Delete](#1-soft-delete)
2. [Audit / History Tables](#2-audit--history-tables)
3. [Polymorphic Associations](#3-polymorphic-associations)
4. [Tag/Label System](#4-taglabel-system)
5. [Hierarchical Data](#5-hierarchical-data)
6. [Status Machine Pattern](#6-status-machine-pattern)
7. [Event Sourcing / Ledger Pattern](#7-event-sourcing--ledger-pattern)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Soft Delete

**The problem, as a story:**

Someone clicks "delete" on their account. Do you actually run `DELETE FROM users WHERE id = 42` and let MySQL erase the row forever?

Think about what that throws away:
- If it was a mistake (wrong button, hacked session), there's no undo.
- If a support agent needs to explain "why did this order disappear," there's nothing left to look at.
- If you're subject to an audit or a "show your work" compliance requirement, a genuinely deleted row leaves no trail at all.

**The analogy:** it's your computer's Recycle Bin / Trash folder. Dragging a file to Trash doesn't erase it — it just moves it out of sight and marks it "not really here anymore." You can restore it, or empty the bin later if you truly want it gone.

**The basic idea:** instead of physically deleting a row, add a column that marks it as deleted, and simply filter deleted rows out of your normal queries.

```sql
-- Add a deleted_at timestamp column (NULL = not deleted)
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;

-- Soft delete
UPDATE users SET deleted_at = NOW() WHERE id = 42;

-- Query active users only
SELECT * FROM users WHERE deleted_at IS NULL;

-- Query all including deleted
SELECT * FROM users;

-- Restore
UPDATE users SET deleted_at = NULL WHERE id = 42;
```

A nice trick to stop every developer on the team from having to remember `WHERE deleted_at IS NULL` on every single query: hide it behind a view.

### With Views for Transparency

```sql
-- Create a view that hides deleted rows
CREATE VIEW active_users AS
  SELECT * FROM users WHERE deleted_at IS NULL;

-- Application queries active_users instead of users
SELECT * FROM active_users WHERE email = 'alice@example.com';
```

Now the application just queries `active_users` like it's a normal table, and never has to think about the filter again.

### Compare: Soft Delete vs Hard Delete

So which one should you actually reach for? It depends on what you value more — recoverability, or a lean table.

| Soft Delete | Hard Delete |
|-------------|------------|
| Recoverable | Not recoverable |
| Audit trail preserved | No record of deletion |
| Table grows over time | Table stays smaller |
| All queries need WHERE deleted_at IS NULL | No extra filter needed |
| Unique indexes must include deleted_at | Simple unique constraints |

### Common mistake: soft delete quietly breaks UNIQUE constraints

Here's a trap that catches almost everyone the first time. Say `email` is `UNIQUE` on `users`. Alice signs up with `alice@example.com`, then deletes her account (soft delete — the row is still there, just flagged). Now she tries to sign up again with the same email.

MySQL says no — the row is "deleted," but it's still physically occupying that unique value. The UNIQUE constraint doesn't know or care about `deleted_at`; it just sees the same email twice.

**The fix:** make the uniqueness conditional on "not deleted," by folding `deleted_at` into the unique index itself:

```sql
-- Unique index with soft delete: allow re-use of email after "deletion"
CREATE UNIQUE INDEX idx_email_active ON users(email, deleted_at);
-- This allows same email in table if one is deleted (deleted_at IS NOT NULL)
```

This works because `deleted_at` is `NULL` for active rows and a real timestamp for deleted ones — so two soft-deleted rows can even share the same email, since their `(email, deleted_at)` pairs differ.

**Interview answer:** "Soft delete marks a row as deleted (typically via a `deleted_at` timestamp) instead of physically removing it, preserving the data for recovery, audit trails, or compliance. The tradeoff is that every query needs a `WHERE deleted_at IS NULL` filter — usually hidden behind a view — and unique constraints must include `deleted_at` in the index, otherwise a 'deleted' row still blocks reuse of its unique value (like an email address)."

> **Memory hook:** "It's not the trash truck — it's the Recycle Bin. The file's still there until you empty it."

---

## 2. Audit / History Tables

**The problem, as a story:**

A product's price silently changed from $49.99 to $0.00 last night. Was it a bug, a hacked admin account, or a fat-fingered typo? With just the `products` table, you have no idea — it only remembers the *current* price, not what it used to be or who changed it.

**The analogy:** "Track Changes" in a Word document, or a bank statement. You don't just see your current balance — you see every deposit and withdrawal that got you there, with a timestamp on each one.

**The basic idea:** keep the main table holding only the current state (fast to query), and keep a second table that records every version a row ever had, plus who changed it and when.

```sql
-- Main table (current state)
CREATE TABLE products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200),
  price       DECIMAL(10,2),
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by  INT   -- FK to users
);

-- Audit/history table (every version)
CREATE TABLE products_history (
  history_id  INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT NOT NULL,
  name        VARCHAR(200),
  price       DECIMAL(10,2),
  action      ENUM('INSERT','UPDATE','DELETE'),
  changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by  VARCHAR(100),   -- USER() at time of change
  INDEX idx_product_id (product_id)
);

-- Trigger to populate history
DELIMITER $$
CREATE TRIGGER product_audit_update
  AFTER UPDATE ON products
  FOR EACH ROW
BEGIN
  INSERT INTO products_history(product_id, name, price, action, changed_by)
  VALUES (OLD.id, OLD.name, OLD.price, 'UPDATE', USER());
END$$
DELIMITER ;
```

Notice the trigger fires on every `UPDATE` and copies the *old* values (`OLD.name`, `OLD.price`) into history before they're overwritten. So `products_history` ends up being a timeline of everything the row used to be.

There's a second way to get the same result, without a separate table at all.

### Temporal Table Pattern (Current + History in One Table)

Instead of splitting "current" and "history" into two tables, you can keep every version in one table, and tag each row with the date range it was valid for.

```sql
-- All versions in one table, query by valid_from/valid_to
CREATE TABLE products_temporal (
  id           INT NOT NULL,
  name         VARCHAR(200),
  price        DECIMAL(10,2),
  valid_from   DATETIME NOT NULL,
  valid_to     DATETIME NOT NULL DEFAULT '9999-12-31 23:59:59',
  PRIMARY KEY (id, valid_from)
);

-- Get current state
SELECT * FROM products_temporal WHERE valid_to = '9999-12-31 23:59:59';

-- Point-in-time query
SELECT * FROM products_temporal
WHERE id = 10 AND '2025-06-01' BETWEEN valid_from AND valid_to;
```

Here, every version of the product is its own row — a new price doesn't overwrite the old one, it inserts a new row with a new `valid_from`, and closes off the previous row's `valid_to`. Want to know what the price was on June 1st? Just ask which row's date range contains June 1st.

**Interview answer:** "Audit / history tracking captures every change to a row — what changed, who changed it, and when — usually via a trigger that copies the old values into a separate history table on every UPDATE/DELETE. The Temporal Table variant folds current and historical state into a single table using `valid_from`/`valid_to` columns, letting you query 'what did this look like on date X' without a separate history table."

> **Memory hook:** "Track Changes in a Word doc — you don't just see the final draft, you see every edit that got you there."

---

## 3. Polymorphic Associations

**The problem, as a story:**

You're building comments for a site where users can comment on a blog post, a video, *or* a product. A comment is a comment — same fields (`body`, `user_id`, `created_at`) no matter what it's attached to. Do you really want three near-identical tables — `post_comments`, `video_comments`, `product_comments` — just to satisfy "one FK per table"? That triples your comment logic for zero benefit, and "show me all of this user's comments" now needs three queries glued together.

What you actually want is *one* `comments` table that can point at *any* of several different parent tables.

**The analogy:** think of a package delivery label. It doesn't just say an address — it says "Apartment" or "House" *and then* the address, because the courier needs to know which kind of building to look for once they get there. The comment needs the same two-part label: "what kind of thing am I attached to" (post? video? product?) plus "which specific one."

**The basic idea:** add two columns to the child table — one naming *which* parent table the row belongs to (`parent_type`), and one holding the ID *within* that table (`parent_id`).

```sql
-- comments can belong to posts OR videos OR products
CREATE TABLE comments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  body         TEXT NOT NULL,
  parent_type  VARCHAR(50) NOT NULL,  -- 'post', 'video', 'product'
  parent_id    INT NOT NULL,          -- PK of the parent table
  user_id      INT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_type, parent_id)
  -- NOTE: cannot use a real FK here (multi-table polymorphism)
);

-- Query comments for a post
SELECT * FROM comments WHERE parent_type = 'post' AND parent_id = 5;
```

**How this actually resolves at query time, step by step:**

```text
Application wants: "show comments for post #5"
        |
        v
SELECT * FROM comments
WHERE parent_type = 'post' AND parent_id = 5
        |
        v
MySQL uses the (parent_type, parent_id) index
        |
        v
Rows returned — application already knows they're
"post" comments, so it doesn't need to look anywhere else
```

The catch is right there in the SQL comment: **`parent_id` cannot be a real foreign key**, because a foreign key points at exactly one table, and `parent_id` might mean "row 5 in `posts`" for one comment and "row 5 in `videos`" for another. MySQL has no way to express "this FK points at whichever table `parent_type` says."

That means nothing stops you from inserting a comment with `parent_type = 'post', parent_id = 99999` where post 99999 doesn't exist. It also means `ON DELETE CASCADE` is off the table — if a post gets deleted, its comments don't automatically clean up; you'd need application code or a trigger for that.

If that tradeoff bothers you, there's an alternative that keeps real foreign keys, at the cost of some unused columns.

### Alternative: Separate FK Columns

```sql
-- More FK-safe: separate nullable FK per type
CREATE TABLE comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  body       TEXT NOT NULL,
  post_id    INT NULL,
  video_id   INT NULL,
  product_id INT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (video_id) REFERENCES videos(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  CHECK (
    (post_id IS NOT NULL)::INT +
    (video_id IS NOT NULL)::INT +
    (product_id IS NOT NULL)::INT = 1
  )
);
```

Here, every comment has three FK columns, but only one of them is ever filled in — the `CHECK` constraint enforces "exactly one of these three is non-NULL." It's more verbose, and adding a fourth commentable type (say, `comments` on `articles`) means an `ALTER TABLE` to add a fourth nullable FK column. But in exchange, you get real referential integrity and real cascading deletes.

### Compare: Single Polymorphic Column vs Separate FK Columns

| `parent_type` + `parent_id` | Separate nullable FK per type |
|---|---|
| One pair of columns, works for any number of parent types | One column pair per parent type — grows with each new type |
| No real FK — no referential integrity, no `ON DELETE CASCADE` | Real FKs — full referential integrity and cascading |
| Adding a new parent type = no schema change | Adding a new parent type = `ALTER TABLE` to add a column |
| Risk of orphaned rows (parent deleted, comment left behind) | `CHECK` constraint enforces "exactly one FK is set" |

### Common mistakes with polymorphic associations

- **Assuming the FK-like column behaves like a FK.** It doesn't. MySQL will happily let you insert `parent_type = 'video', parent_id = 12345` even if video 12345 was deleted five minutes ago. If you need that guarantee, you must enforce it in application code (or use the separate-FK-columns alternative).
- **Forgetting the index covers both columns.** A query like `WHERE parent_type = 'post' AND parent_id = 5` needs an index on `(parent_type, parent_id)` together — an index on `parent_id` alone would mix rows from every parent type.
- **Trying to JOIN directly.** You can't write one clean `JOIN` to pull in "the parent's title" because the parent lives in a different table depending on the row. You typically need a `CASE`/`UNION` per type, or a lookup per row in application code.

**Interview answer:** "A polymorphic association lets one table (like comments or attachments) belong to multiple different parent tables, using a `parent_type + parent_id` pattern instead of a single foreign key. It's flexible — no schema change needed to support a new parent type — but it sacrifices referential integrity, since MySQL can't enforce a foreign key that conditionally points at different tables. The alternative is separate nullable FK columns per parent type, enforced with a CHECK constraint that exactly one is set, which restores real FK guarantees at the cost of a wider table."

> **Memory hook:** "It's a shipping label with two lines: 'Apartment or House' and then the address — you need both to know where it actually goes."

---

## 4. Tag/Label System

**The problem, as a story:**

A blog post about "MySQL indexing" could reasonably be tagged `mysql`, `performance`, and `databases`. Another post might share the `mysql` tag but none of the others. One post, many tags; one tag, many posts. Neither side belongs on the other's table directly — you can't cram a variable-length list of tags into a single column and still query it efficiently.

**The analogy:** sticky notes on a corkboard. The same sticky note ("mysql") can be stuck next to many different documents, and one document can have several different sticky notes on it.

**The basic idea:** this is a classic many-to-many, so it needs a junction (bridge) table sitting between `posts` and `tags`.

```sql
CREATE TABLE tags (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE post_tags (
  post_id INT NOT NULL,
  tag_id  INT NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

Notice the primary key is the *pair* `(post_id, tag_id)` — that's what stops the same tag being attached to the same post twice. And `ON DELETE CASCADE` on both sides means deleting a post or a tag automatically cleans up its junction rows, no orphans left behind.

```sql
-- Get all tags for a post
SELECT t.name
FROM tags t
JOIN post_tags pt ON t.id = pt.tag_id
WHERE pt.post_id = 10;

-- Get all posts for a tag
SELECT p.title
FROM posts p
JOIN post_tags pt ON p.id = pt.post_id
JOIN tags t ON t.id = pt.tag_id
WHERE t.slug = 'mysql';

-- Count posts per tag
SELECT t.name, COUNT(pt.post_id) AS post_count
FROM tags t
LEFT JOIN post_tags pt ON t.id = pt.tag_id
GROUP BY t.id
ORDER BY post_count DESC;
```

Same junction table, three different questions: "what tags does this post have," "what posts have this tag," and "how popular is each tag." All three fall out of the same three-table shape.

**Where you'll see this:** tags, categories-as-labels, permissions/roles on users, "liked by" relationships — basically any many-to-many.

> **Memory hook:** "Sticky notes on a corkboard — the same note can sit next to many documents, and a document can wear several notes."

---

## 5. Hierarchical Data

**The problem, as a story:**

A product category like "Electronics" contains "Phones," which contains "Smartphones," which contains "5G Smartphones." Categories nest inside categories, potentially many levels deep. How do you store a tree — where every row has exactly one parent, but potentially many children — in flat, tabular rows?

**The analogy:** a family tree, or a company's org chart. Everyone (except the very top) reports to exactly one person above them, but can have several people below them.

There are two common ways to store this. They trade off "simple to write" against "simple to query."

### Adjacency List (simplest)

**The basic idea:** each row just stores the ID of its own direct parent — nothing fancier than that.

```sql
CREATE TABLE categories (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100),
  parent_id INT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Get all children of category 5 (one level)
SELECT * FROM categories WHERE parent_id = 5;

-- Full tree with recursive CTE
WITH RECURSIVE category_tree AS (
  SELECT id, name, parent_id, 0 AS depth
  FROM categories WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.name, c.parent_id, ct.depth + 1
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree ORDER BY depth, name;
```

Simple to insert (just set `parent_id`), simple to read one level at a time. The catch: to get the *whole* tree, or to answer "who are all of this category's ancestors," you need a recursive CTE walking the chain one level at a time — which gets slower the deeper the tree goes.

If you're constantly asking "all ancestors" or "all descendants" and want that to be a single flat lookup, there's a pattern built exactly for that.

### Closure Table (best for arbitrary queries)

**The basic idea:** instead of storing only direct parent-child links, pre-compute and store *every* ancestor-descendant pair — including a category's relationship to itself. More storage, but every "ancestors" or "descendants" question becomes one flat `SELECT`.

```sql
CREATE TABLE category_paths (
  ancestor   INT NOT NULL,
  descendant INT NOT NULL,
  depth      INT NOT NULL,
  PRIMARY KEY (ancestor, descendant),
  FOREIGN KEY (ancestor) REFERENCES categories(id),
  FOREIGN KEY (descendant) REFERENCES categories(id)
);

-- Get all descendants of category 5
SELECT descendant FROM category_paths WHERE ancestor = 5;

-- Get all ancestors of category 12
SELECT ancestor FROM category_paths WHERE descendant = 12 ORDER BY depth DESC;
```

For example, if category 7's ancestors are 1, 3, and 5, the closure table holds rows `(1→7)`, `(3→7)`, `(5→7)`, and `(7→7)` — every ancestor paired with 7, no recursion needed to find them.

### Compare: Adjacency List vs Closure Table

| Adjacency List | Closure Table |
|---|---|
| One `parent_id` column — minimal storage | One row per ancestor-descendant pair — much more storage |
| Simple insert (set one FK) | Insert must also add rows for every new ancestor pair |
| "All descendants/ancestors" needs a recursive CTE | "All descendants/ancestors" is one flat SELECT |
| Gets slower as tree depth grows | Query speed doesn't depend on depth |

> **Memory hook:** "A family tree with just 'my dad's name' (adjacency list) vs. a genealogy chart that pre-lists every ancestor for every person (closure table)."

---

## 6. Status Machine Pattern

**The problem, as a story:**

An order goes `pending` → `payment_received` → `processing` → `shipped` → `delivered`. Support keeps asking "when exactly did this order move to 'shipped,' and who or what triggered it?" A plain `status` column only tells you where the order is *right now* — it forgot everywhere it's been.

**The analogy:** a package tracking page. It doesn't just say "delivered" — it shows the whole timeline: picked up, in transit, out for delivery, delivered, each with its own timestamp.

**The basic idea:** keep a `status` column for "where things are now" (fast to query, fast to filter on), and log every transition into a separate history table.

```sql
CREATE TABLE orders (
  id     INT PRIMARY KEY,
  status ENUM('pending','payment_received','processing','shipped','delivered','cancelled')
    DEFAULT 'pending'
);

-- Status transition log
CREATE TABLE order_status_history (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  from_status VARCHAR(50),
  to_status   VARCHAR(50),
  changed_by  INT,
  changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes       TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Trigger to log transitions
DELIMITER $$
CREATE TRIGGER log_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO order_status_history(order_id, from_status, to_status, changed_by, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, @current_user_id, NOW());
  END IF;
END$$
DELIMITER ;
```

Notice the trigger only fires when `OLD.status <> NEW.status` — a no-op update (writing the same status back) doesn't clutter the history with a fake transition. The `orders.status` column stays your fast "current state" filter (`WHERE status = 'shipped'`), while `order_status_history` answers "show me the full timeline."

**Interview answer:** "The Status Machine Pattern keeps a `status` column for an object's current state, plus a separate history table logging every transition — from-status, to-status, who changed it, and when — usually populated by a trigger. This keeps 'what's the current status' queries fast while still preserving the full timeline for auditing or support."

> **Memory hook:** "A package tracking page — not just 'delivered,' but every checkpoint that got it there."

---

## 7. Event Sourcing / Ledger Pattern

**The problem, as a story:**

A bank account has a `balance` column. Someone deposits $100, then withdraws $30. If you just `UPDATE balance = balance - 30`, the balance is correct — but you've thrown away the fact that a withdrawal of $30 ever happened. If a customer disputes a charge, or a regulator asks "show me every transaction on this account for the last year," an overwritten `balance` column has nothing to show them.

**The analogy:** your bank statement. You never see a single "balance" field update in place — you see a running list of every deposit and withdrawal, and the balance is just *the total of that list*, computed whenever you need it.

**The basic idea:** never update a row to reflect a new state. Instead, only ever append new rows — "events" — and derive the current state by summing/replaying them.

```sql
-- Ledger: append-only log of transactions
CREATE TABLE account_ledger (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  amount     DECIMAL(15,2) NOT NULL,   -- positive = credit, negative = debit
  type       ENUM('deposit','withdrawal','transfer_in','transfer_out'),
  reference  VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_account (account_id)
);

-- Current balance = sum of all entries
SELECT account_id, SUM(amount) AS balance
FROM account_ledger
WHERE account_id = 42;

-- Balance at a point in time
SELECT SUM(amount)
FROM account_ledger
WHERE account_id = 42 AND created_at <= '2026-01-01';
```

There's no `UPDATE` anywhere in this pattern — only `INSERT`. The "current balance" isn't a stored fact, it's a computed one: `SUM(amount)` for that account. Want the balance as of some past date? Just add a date filter to the same sum. That's a point-in-time query for free, something an overwritten `balance` column could never give you.

**Interview answer:** "The event sourcing / ledger pattern never updates a row to reflect new state — it only appends immutable event rows, and the current state (like an account balance) is derived by summing or replaying those events. This is essential wherever you need a complete, tamper-evident history: financial ledgers, inventory movements, compliance auditing. The tradeoff is that reads which need 'current state' must aggregate over potentially many rows, though this is usually mitigated with periodic snapshots or the Computed-style running totals seen elsewhere in this guide."

> **Memory hook:** "Your bank statement doesn't edit history — it just keeps adding lines, and the balance is whatever they add up to."

---

## 8. Hands-On Exercises

**Exercise 1:** Implement soft delete on a `products` table. Write queries that show only active products, only deleted products, and restore a deleted product.

**Exercise 2:** Build an audit system for an `employees` table using triggers. Update an employee's salary and verify the audit table captures the before/after values.

**Exercise 3:** Design a comment system that uses polymorphic associations (comments on posts, videos, and products). Insert comments for each type and query them correctly.

**Exercise 4:** Build a category tree using adjacency list. Write a recursive CTE that outputs the full hierarchy with depth levels.

**Exercise 5:** Implement the ledger pattern for a wallet system. Write queries for current balance, transaction history, and balance at a specific date.

---

## 9. Interview Q&A

**Q: What is soft delete and when should you use it?**
Answer: Soft delete marks rows as deleted (usually with a `deleted_at` timestamp) instead of physically removing them. Use it when you need audit trails, undo capability, or compliance requirements (GDPR right to be forgotten via anonymization, not deletion). Downside: tables grow indefinitely and all queries need `WHERE deleted_at IS NULL`.

**Q: What is a polymorphic association?**
Answer: A polymorphic association lets one table (like comments or attachments) belong to multiple different parent tables, using a `parent_type + parent_id` pattern. It's flexible but sacrifices FK enforcement (MySQL can't have a FK that points to different tables conditionally). Alternative: separate nullable FK columns per parent type.

**Q: How do you model a tag system?**
Answer: Use a M:N junction table. Create a `tags` table (id, name), a main table (posts), and a `post_tags` junction table (post_id FK, tag_id FK, composite PK). ON DELETE CASCADE on both FKs keeps things clean. Index both FK columns for efficient lookup in both directions.

**Q: What is the Closure Table pattern for hierarchical data?**
Answer: The Closure Table stores every ancestor-descendant pair, not just direct parent-child. For a category with ancestors [1, 3, 5] and id=7, it stores rows (1→7), (3→7), (5→7), (7→7). This enables efficient "all ancestors" and "all descendants" queries without recursive CTEs, at the cost of extra storage.

**Q: When would you use the event sourcing / ledger pattern?**
Answer: When you need a complete, immutable history of state changes — financial systems (balances), inventory tracking, compliance auditing. Instead of updating a "current balance" column, you append transaction rows and compute the current state by summing. This gives you point-in-time queries and a full audit trail for free.
