# DELETE — Removing Data in MySQL

## Table of Contents
1. [Basic DELETE](#1-basic-delete)
2. [DELETE with JOIN](#2-delete-with-join)
3. [DELETE with ORDER BY and LIMIT](#3-delete-with-order-by-and-limit)
4. [Soft Delete Pattern](#4-soft-delete-pattern)
5. [TRUNCATE vs DELETE vs DROP](#5-truncate-vs-delete-vs-drop)
6. [Cascading Deletes via Foreign Keys](#6-cascading-deletes-via-foreign-keys)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Basic DELETE

Here's a story every developer has lived through at least once: you meant to delete *one* row — say, a banned user — and one missing keyword later, you've just wiped out the entire `users` table. That's the whole reason this section exists: `DELETE` is one of the few SQL statements where a tiny typo can erase your production data in milliseconds.

Think of `DELETE FROM table` like a shredder. Add `WHERE` and you feed it one specific document. Leave `WHERE` out, and it happily shreds the entire filing cabinet, drawer by drawer, without asking twice.

In plain terms: `DELETE` removes rows from a table that match a condition. No condition means no filter — every row goes.

```sql
-- ⚠️ ALWAYS use WHERE — without it, ALL rows are deleted!
DELETE FROM users WHERE id = 42;

-- Delete multiple rows matching a condition
DELETE FROM sessions WHERE expires_at < NOW();

-- Delete with IN
DELETE FROM products WHERE id IN (10, 20, 30);

-- Delete with subquery
DELETE FROM orders
WHERE customer_id IN (SELECT id FROM customers WHERE status = 'banned');
```

### Safe DELETE — Check First

The habit that saves you from the "oops, I deleted everything" story: never type `DELETE` first. Type `SELECT` first, look at what comes back, and only then swap the keyword.

```sql
-- Step 1: Run SELECT to verify what will be deleted
SELECT * FROM logs WHERE created_at < '2025-01-01';

-- Step 2: Replace SELECT * with DELETE
DELETE FROM logs WHERE created_at < '2025-01-01';
-- Rows deleted: 1,847
```

MySQL also gives you a seatbelt for this exact mistake:

```sql
SET sql_safe_updates = 1;
-- Now DELETE without WHERE on a key column returns an error
```

Turn it on, and MySQL simply refuses to run a `DELETE` (or `UPDATE`) that doesn't use a key column in its `WHERE` clause — a built-in guard against the "forgot the WHERE" disaster.

---

## 2. DELETE with JOIN

Sometimes the rows you want gone don't live in the table you can filter on. "Delete every order placed by a customer who's now inactive" — the `inactive` status lives on the `customers` table, not `orders`. A plain `WHERE` clause on `orders` alone can't see it.

That's what `DELETE ... JOIN` is for: delete rows from one table based on a match in another table, exactly like a `SELECT ... JOIN`, but pointed at deletion instead of retrieval.

```sql
-- Delete orders for inactive customers
DELETE o
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE c.status = 'inactive';

-- Delete from multiple tables in one statement
DELETE o, oi
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.created_at < '2020-01-01';
```

---

## 3. DELETE with ORDER BY and LIMIT

Your `logs` table has 50 million rows and you only want to trim it gradually — say, chip away the oldest 100 rows at a time instead of one giant `DELETE` that locks the table for minutes. `ORDER BY` + `LIMIT` on a `DELETE` lets you say "delete only the oldest N rows," turning a scary bulk cleanup into small, controlled bites.

```sql
-- Delete the 100 oldest log entries
DELETE FROM logs
ORDER BY created_at ASC
LIMIT 100;

-- Delete cheapest product (dangerous — use carefully)
DELETE FROM products
ORDER BY price ASC
LIMIT 1;
```

---

## 4. Soft Delete Pattern

A user clicks "delete my account." You run `DELETE FROM users WHERE id = 42` — and now it's gone. Really gone. No audit trail, no "oops, restore it," and if support needs to know what that account looked like last week, tough luck. Worse, if other tables reference that user, you may have just orphaned or cascaded away a pile of related data you didn't mean to touch.

**The analogy:** think of a "Recently Deleted" folder, the one your phone's Photos app or your email client uses. Deleting a photo doesn't shred it immediately — it just gets tagged as "deleted" and hidden from the normal view, sitting there in case you change your mind.

**The idea:** instead of physically removing a row, you mark it as deleted with a timestamp column. The row never leaves the table. This preserves history, makes "undo" trivial, and sidesteps a lot of foreign-key headaches.

```sql
-- Add soft delete column
ALTER TABLE users
  ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;

-- Soft delete (mark as deleted)
UPDATE users SET deleted_at = NOW() WHERE id = 42;

-- Query only active (non-deleted) rows
SELECT * FROM users WHERE deleted_at IS NULL;

-- Restore a soft-deleted row
UPDATE users SET deleted_at = NULL WHERE id = 42;

-- Hard delete old soft-deleted rows (cleanup after 90 days)
DELETE FROM users
WHERE deleted_at IS NOT NULL
  AND deleted_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### Add a Partial Index for Performance

Here's the catch with soft delete: once your table has millions of rows, most of your queries filter on `WHERE deleted_at IS NULL` — but a plain index doesn't know that's the common case, so it still indexes every dead row along with the live ones. MySQL doesn't support true partial indexes, so the workaround is a generated column that flags deleted rows, which you then index directly.

```sql
-- Index only non-deleted rows (MySQL 8.0+)
-- Most queries filter WHERE deleted_at IS NULL, so index only those:
CREATE INDEX idx_users_active ON users (email) WHERE deleted_at IS NULL;
-- Note: MySQL doesn't support partial indexes directly — use generated columns instead
ALTER TABLE users ADD COLUMN is_deleted TINYINT(1) AS (deleted_at IS NOT NULL) STORED;
CREATE INDEX idx_users_not_deleted ON users (is_deleted);
```

**Common mistake:** turning on soft delete and then forgetting to add `WHERE deleted_at IS NULL` to every existing query. Suddenly "deleted" users start reappearing in search results, dropdowns, and reports — the delete didn't fail, your queries just never learned to ignore them.

**Interview answer:** soft delete replaces a physical `DELETE` with an `UPDATE` that flags a row as deleted (typically via a `deleted_at` timestamp), keeping the row and its history intact. It buys you an audit trail, an easy "undo," and freedom from foreign-key cleanup headaches — at the cost of every query needing to explicitly filter out deleted rows, and the table growing forever unless you periodically hard-delete old soft-deleted rows.

> **Memory hook:** "Soft delete is the Recently Deleted folder — hidden, not gone, until you empty the trash for real."

---

## 5. TRUNCATE vs DELETE vs DROP

Picture this: you need to wipe a 50-million-row `session_logs` table before a load test. You run `DELETE FROM session_logs;` and go make coffee — it's still running twenty minutes later, because `DELETE` walks the table row by row, logging every single deletion so it *can* be rolled back if something goes wrong. That's the exact moment you learn there were faster tools sitting right there the whole time.

Think of it as three different levels of "get rid of it":
- **DELETE** is picking books off a shelf one at a time and writing each removal in a log book — controlled, reversible, but slow if there are a lot of books.
- **TRUNCATE** is tipping the whole shelf into the bin in one motion — fast, but you can't pick and choose, and there's no log book entry to undo it.
- **DROP** is removing the shelf itself, along with the room it stood in.

Internally, that's exactly why the speed differs: `DELETE` removes rows individually and writes them to the transaction log (so `ROLLBACK` can bring them back), while `TRUNCATE` skips all that bookkeeping — it just deallocates the data pages wholesale, which is why it's fast but can't be undone with `ROLLBACK`, and why it also resets `AUTO_INCREMENT` (there's no row-by-row history left to infer the last value from).

| | DELETE | TRUNCATE | DROP |
|--|--------|---------|------|
| Removes rows | ✅ All or filtered | ✅ All rows | ✅ All rows |
| Removes table structure | ❌ | ❌ | ✅ |
| WHERE clause | ✅ | ❌ | ❌ |
| Rollback (COMMIT/ROLLBACK) | ✅ | ❌ (auto-commit) | ❌ |
| Fires DELETE triggers | ✅ | ❌ | ❌ |
| Resets AUTO_INCREMENT | ❌ | ✅ | ✅ |
| Speed on large tables | Slow (logs each row) | Fast (deallocates pages) | Fast |
| FK constraint check | ✅ | ✅ (error if referenced) | ✅ |

```sql
-- Delete all rows but keep structure + triggers fire
DELETE FROM session_logs;

-- Delete all rows, reset auto_increment — faster, no trigger
TRUNCATE TABLE session_logs;

-- Remove the entire table
DROP TABLE session_logs;
```

**Use TRUNCATE** when you want to empty a table fast and don't need triggers or rollback.
**Use DELETE** when you need WHERE, triggers, or rollback capability.

**Common mistake:** reaching for `TRUNCATE` out of habit inside a transaction, expecting a `ROLLBACK` to bring the rows back. It won't — `TRUNCATE` auto-commits. Another one: forgetting that `TRUNCATE` resets `AUTO_INCREMENT` while `DELETE` doesn't, so the next inserted row after a plain `DELETE FROM table;` can still pick up an ID number you weren't expecting.

**Interview answer:** `DELETE` removes rows individually, can be filtered with `WHERE`, fires triggers, and is transactional (rollback-able) — but it's slow on large tables because every row removal is logged. `TRUNCATE` empties the whole table by deallocating its data pages in one shot, resets `AUTO_INCREMENT`, doesn't fire triggers, and can't be rolled back, making it much faster. `DROP` goes a step further and removes the table definition itself, not just its data.

> **Memory hook:** "DELETE picks books off the shelf one at a time and logs it. TRUNCATE tips the whole shelf into the bin. DROP takes the shelf away."

---

## 6. Cascading Deletes via Foreign Keys

Say you delete a customer, and — because their `orders` table has a plain foreign key with no cascade rule — MySQL throws an error and refuses, because there are still order rows pointing at that customer. Now you're stuck manually deleting orders, then order items, then the customer, in the right order, every single time. `ON DELETE CASCADE` exists so you don't have to do that dance by hand.

**The analogy:** think of knocking down a building versus scheduling a full teardown-and-clearing crew. Without CASCADE, MySQL is a strict inspector: "you can't demolish this building, there are still tenants (rows) depending on it." With `ON DELETE CASCADE`, deleting the building automatically evicts the tenants first — and if those tenants had their own dependents, those get cleared too.

**In plain terms:** when a parent row is deleted, child rows that reference it via a foreign key defined `ON DELETE CASCADE` are automatically deleted as well — and this propagates recursively down the chain.

**How it actually plays out, step by step, for the example below:**

```text
DELETE FROM customers WHERE id = 100
        |
        v
MySQL checks: does anything reference customers.id = 100?
        |
       YES → orders.customer_id (ON DELETE CASCADE)
        |
        v
MySQL deletes matching rows in `orders`
        |
        v
For each deleted order, MySQL checks: does anything
reference that order's id?
        |
       YES → order_items.order_id (ON DELETE CASCADE)
        |
        v
MySQL deletes matching rows in `order_items`
        |
        v
Done — one DELETE statement, three tables affected
```

```sql
CREATE TABLE orders (
  id          INT PRIMARY KEY,
  customer_id INT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE order_items (
  id       INT PRIMARY KEY,
  order_id INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Deleting a customer automatically deletes all their orders and order items
DELETE FROM customers WHERE id = 100;
-- → orders for customer 100 deleted
-- → order_items for those orders deleted
```

**Be careful with CASCADE** — a single DELETE can remove thousands of related rows across multiple tables.

**Common mistake:** treating `ON DELETE CASCADE` as a "nice default" and adding it everywhere without thinking through the blast radius. One `DELETE FROM customers WHERE id = 100` can silently ripple through orders, order items, invoices, and shipment records — and by the time you notice, it's already committed. Always ask "what's downstream of this FK?" before wiring CASCADE onto it.

**Interview answer:** `ON DELETE CASCADE` tells MySQL that deleting a parent row should automatically delete every child row that references it through that foreign key. This propagates recursively — if those children have their own CASCADE children, those get swept up too. It saves you from manually deleting in dependency order, but because the effect can span many tables and rows, it needs to be used deliberately, not as a blanket default.

> **Memory hook:** "CASCADE is knocking down a building and letting the wrecking crew clear out everyone still inside — including their tenants' tenants."

---

## 7. Hands-On Exercises

**Exercise 1:** Create a `temp_logs` table, insert 20 rows, then delete rows where `created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`. Verify the count before and after.

**Exercise 2:** Implement soft delete on a `products` table. Mark 3 products as deleted. Write a SELECT that shows only active products, and another that shows only deleted ones.

**Exercise 3:** Create `customers` and `orders` tables with ON DELETE CASCADE. Insert a customer with 3 orders. Delete the customer and verify all orders are gone.

**Exercise 4:** Compare DELETE vs TRUNCATE on a large table: insert 10,000 rows, time DELETE FROM t, re-insert, time TRUNCATE TABLE t. Observe the speed difference.

**Exercise 5:** Write a DELETE with a JOIN to remove all orders placed by customers who registered more than 5 years ago and have never placed a paid order.

---

## 8. Interview Q&A

**Q: What happens if you run DELETE without a WHERE clause?**
Answer: It deletes every row in the table. The table structure remains, but all data is gone. With `sql_safe_updates=1`, MySQL will block this. Always run a SELECT first to verify what you're about to delete.

**Q: What is the difference between DELETE and TRUNCATE?**
Answer: DELETE removes rows one by one (logging each), supports WHERE clauses, fires triggers, and is transactional (can be rolled back). TRUNCATE removes all rows by deallocating data pages, is faster, resets AUTO_INCREMENT, doesn't fire triggers, and cannot be rolled back.

**Q: What is soft delete and why is it preferred?**
Answer: Soft delete marks rows as deleted (using a `deleted_at` timestamp) instead of physically removing them. Benefits include audit trails, recovery from accidental deletes, and avoiding FK complications. The downside is queries must always filter `WHERE deleted_at IS NULL`.

**Q: How does ON DELETE CASCADE work?**
Answer: When a parent row is deleted, MySQL automatically deletes all child rows that reference it via a FK with CASCADE. This propagates recursively — if those children also have CASCADE FK children, those are deleted too. It's powerful but can unexpectedly delete large amounts of data.

**Q: Can you DELETE and JOIN in MySQL?**
Answer: Yes — MySQL supports multi-table DELETE: `DELETE t1 FROM t1 JOIN t2 ON t1.id = t2.ref_id WHERE t2.status = 'x'`. You specify which tables to delete from after DELETE, and use standard JOIN syntax to filter.
