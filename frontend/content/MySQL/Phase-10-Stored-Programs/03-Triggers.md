# Triggers — MySQL Complete Guide

## Table of Contents
1. [What is a Trigger?](#1-what-is-a-trigger)
2. [Trigger Syntax](#2-trigger-syntax)
3. [NEW and OLD References](#3-new-and-old-references)
4. [BEFORE vs AFTER Triggers](#4-before-vs-after-triggers)
5. [Practical Trigger Examples](#5-practical-trigger-examples)
6. [Managing Triggers](#6-managing-triggers)
7. [Trigger Limitations](#7-trigger-limitations)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What is a Trigger?

Here's a problem you've probably run into. You want every change to a table logged — who changed it, what the old value was, what the new value is. Or you want a `total` column on `orders` to always reflect the sum of its line items, without every part of your app remembering to recalculate it.

The naive fix is discipline: "every place in the codebase that updates `orders`, please also update `orders_audit`." That works right up until someone adds a new script, a new microservice, or a quick manual `UPDATE` in a terminal — and forgets. Now your audit log has a hole in it, or your total is silently wrong.

**The analogy:** think of a trigger like a motion-sensor light, or a tripwire. Nobody has to remember to flip the switch — the moment something crosses the sensor (a row gets inserted, updated, or deleted), the light comes on automatically. You wire it up once, at the table level, and it fires no matter *how* the row change happens — application code, a migration script, an ad-hoc query, anything.

**Basic definition:** a trigger is a stored program that automatically executes in response to a DML event (INSERT, UPDATE, DELETE) on a specific table. You attach it to the table once, and MySQL takes care of firing it every time that event happens — you don't call it, you don't remember it, it just runs.

```
Event on table  →  Trigger fires automatically  →  Runs your code

USE CASES:
  ✅ Audit logging (record who changed what)
  ✅ Automatic denormalization (keep a summary column in sync)
  ✅ Data validation beyond CHECK constraints
  ✅ Cascade custom logic (not handled by FK cascades)
  ✅ Maintain derived data (e.g., update totals when line items change)
```

> **Memory hook:** "A trigger is a tripwire on a table — it doesn't care who walks by, it just fires."

---

## 2. Trigger Syntax

Wiring up a tripwire means telling MySQL three things: which table to watch, which event to watch for (INSERT/UPDATE/DELETE), and whether to react *before* or *after* that event actually happens. That's exactly what the syntax below captures.

```sql
DELIMITER $$

CREATE TRIGGER trigger_name
  {BEFORE | AFTER} {INSERT | UPDATE | DELETE}
  ON table_name
  FOR EACH ROW
BEGIN
  -- trigger body
END$$

DELIMITER ;
```

### All 6 Trigger Types

```
BEFORE INSERT  — runs before a row is inserted
AFTER  INSERT  — runs after a row is inserted
BEFORE UPDATE  — runs before a row is updated
AFTER  UPDATE  — runs after a row is updated
BEFORE DELETE  — runs before a row is deleted
AFTER  DELETE  — runs after a row is deleted
```

---

## 3. NEW and OLD References

Once a trigger fires, the first question is always: what row am I actually looking at — the row as it was, or the row as it's about to become? That's exactly what `OLD` and `NEW` answer.

Think of `OLD` as a snapshot of the row *before* the change, and `NEW` as a snapshot of the row *after* the change. Naturally, a fresh INSERT has no "before" — the row didn't exist yet — so `OLD` makes no sense there. And a DELETE has no "after" — the row is gone — so `NEW` makes no sense there. UPDATE is the only event where both exist, because there's genuinely a before and an after.

| | INSERT | UPDATE | DELETE |
|---|--------|--------|--------|
| `NEW.col` | ✅ new values | ✅ new values | ❌ not available |
| `OLD.col` | ❌ not available | ✅ old values | ✅ old values |

```sql
-- In an UPDATE trigger:
-- OLD.price = value before update
-- NEW.price = value after update

-- In a BEFORE trigger, you can MODIFY NEW values:
SET NEW.email = LOWER(NEW.email);   -- normalize before insert
```

One more subtlety worth calling out now, because it drives the entire next section: `NEW` is only *modifiable* inside a **BEFORE** trigger. By the time an AFTER trigger runs, the row is already written to disk — reassigning `NEW.col` there simply does nothing.

---

## 4. BEFORE vs AFTER Triggers

So if `OLD`/`NEW` tell you *which* row snapshot you're looking at, BEFORE/AFTER tell you *when* your code runs relative to the actual write. This is the single most confusing thing about triggers the first time you meet them, so let's slow down and draw it out.

Picture the DML statement as a timeline, and the trigger as a checkpoint that either sits before or after the actual write to the table:

```
BEFORE trigger:

  Your code runs  →  MySQL writes the row  →  Statement completes
  (can inspect AND
   modify NEW; can
   SIGNAL to abort
   the whole write)


AFTER trigger:

  MySQL writes the row  →  Your code runs  →  Statement completes
  (row is already on
   disk; NEW is read-
   only for you now;
   safe to log/cascade)
```

The practical consequence: if you need to *change* what actually gets stored — normalize an email, clamp a value, reject an invalid row — you must do it BEFORE the write happens, because after that point it's too late; the row is already committed to the table. If you just need to *react* to a change that already happened — write an audit row, update a related table, send a notification — you do it AFTER, because by then you know the write definitely succeeded.

### BEFORE Triggers

- Can modify `NEW` values before they're written
- Can SIGNAL to prevent the operation (raise an error)
- Useful for: validation, normalization, canceling bad inserts

```sql
DELIMITER $$

CREATE TRIGGER validate_age
  BEFORE INSERT ON users
  FOR EACH ROW
BEGIN
  IF NEW.age < 0 OR NEW.age > 150 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid age value';
  END IF;
END$$

DELIMITER ;
```

### AFTER Triggers

- Cannot modify `NEW` (data is already written)
- Use for: audit logs, updating related tables, notifications

```sql
DELIMITER $$

CREATE TRIGGER log_salary_change
  AFTER UPDATE ON employees
  FOR EACH ROW
BEGIN
  IF OLD.salary <> NEW.salary THEN
    INSERT INTO salary_audit(employee_id, old_salary, new_salary, changed_at)
    VALUES (NEW.id, OLD.salary, NEW.salary, NOW());
  END IF;
END$$

DELIMITER ;
```

### Putting it all together

| Trigger type | Fires... | `OLD` available? | `NEW` available? | `NEW` modifiable? | Typical use |
|---|---|---|---|---|---|
| BEFORE INSERT | before the row is written | ❌ | ✅ | ✅ | normalize/validate incoming data |
| AFTER INSERT | after the row is written | ❌ | ✅ (read-only) | ❌ | audit log, update related totals |
| BEFORE UPDATE | before the row is overwritten | ✅ | ✅ | ✅ | normalize/validate, auto-set `updated_at` |
| AFTER UPDATE | after the row is overwritten | ✅ | ✅ (read-only) | ❌ | audit log, cascade to related tables |
| BEFORE DELETE | before the row is removed | ✅ | ❌ | n/a | block deletion (SIGNAL), archive the row first |
| AFTER DELETE | after the row is removed | ✅ | ❌ | n/a | audit log, clean up related rows |

> **Memory hook:** "BEFORE = you're still holding the pen, so you can cross things out. AFTER = the ink is already dry, all you can do is take a photo of it."

---

## 5. Practical Trigger Examples

### Auto-Update `updated_at` Timestamp

```sql
DELIMITER $$

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
BEGIN
  SET NEW.updated_at = NOW();
END$$

DELIMITER ;
```

### Audit Log Trigger

```sql
-- Audit table
CREATE TABLE orders_audit (
  audit_id     INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT,
  action       ENUM('INSERT','UPDATE','DELETE'),
  old_status   VARCHAR(50),
  new_status   VARCHAR(50),
  changed_by   VARCHAR(100),
  changed_at   DATETIME
);

DELIMITER $$

CREATE TRIGGER audit_order_insert
  AFTER INSERT ON orders
  FOR EACH ROW
BEGIN
  INSERT INTO orders_audit(order_id, action, new_status, changed_by, changed_at)
  VALUES (NEW.id, 'INSERT', NEW.status, USER(), NOW());
END$$

CREATE TRIGGER audit_order_update
  AFTER UPDATE ON orders
  FOR EACH ROW
BEGIN
  INSERT INTO orders_audit(order_id, action, old_status, new_status, changed_by, changed_at)
  VALUES (NEW.id, 'UPDATE', OLD.status, NEW.status, USER(), NOW());
END$$

CREATE TRIGGER audit_order_delete
  AFTER DELETE ON orders
  FOR EACH ROW
BEGIN
  INSERT INTO orders_audit(order_id, action, old_status, changed_by, changed_at)
  VALUES (OLD.id, 'DELETE', OLD.status, USER(), NOW());
END$$

DELIMITER ;
```

### Maintain Running Total (Denormalization)

```sql
DELIMITER $$

-- When an order item is inserted, add to order total
CREATE TRIGGER update_order_total_on_insert
  AFTER INSERT ON order_items
  FOR EACH ROW
BEGIN
  UPDATE orders
  SET total = total + (NEW.price * NEW.quantity)
  WHERE id = NEW.order_id;
END$$

-- When an order item is deleted, subtract from order total
CREATE TRIGGER update_order_total_on_delete
  AFTER DELETE ON order_items
  FOR EACH ROW
BEGIN
  UPDATE orders
  SET total = total - (OLD.price * OLD.quantity)
  WHERE id = OLD.order_id;
END$$

DELIMITER ;
```

### Prevent Deletion of Admin Users

```sql
DELIMITER $$

CREATE TRIGGER prevent_admin_delete
  BEFORE DELETE ON users
  FOR EACH ROW
BEGIN
  IF OLD.role = 'admin' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot delete admin users';
  END IF;
END$$

DELIMITER ;
```

---

## 6. Managing Triggers

```sql
-- List all triggers in current database
SHOW TRIGGERS\G

-- List triggers on a specific table
SHOW TRIGGERS FROM mydb LIKE 'orders'\G

-- View trigger definition
SHOW CREATE TRIGGER log_salary_change\G

-- Drop a trigger
DROP TRIGGER IF EXISTS log_salary_change;

-- Triggers can't be altered — must DROP and re-CREATE
```

---

## 7. Trigger Limitations

```
❌ Cannot call stored procedures with transactions inside BEFORE triggers
❌ Cannot use COMMIT, ROLLBACK inside triggers
❌ Triggers on same table/event can't call themselves (no recursive triggers by default)
❌ Cannot fire triggers on views
❌ LOAD DATA INFILE does fire triggers (INSERT trigger fires per row)
❌ Cannot see trigger execution in application — silent execution can surprise developers
```

---

## 8. Hands-On Exercises

**Exercise 1:** Create an audit table and three triggers (AFTER INSERT/UPDATE/DELETE) on a `products` table. Insert, update, and delete a product — verify the audit table records all changes.

**Exercise 2:** Create a BEFORE INSERT trigger on `users` that auto-lowercases the email field.

**Exercise 3:** Create a BEFORE DELETE trigger that prevents deleting rows where `status = 'active'` — raise a SIGNAL with a descriptive message.

**Exercise 4:** Create AFTER INSERT and AFTER DELETE triggers on `cart_items` that maintain a `cart_total` column in a `carts` table.

**Exercise 5:** List all triggers using `SHOW TRIGGERS\G`, then drop one and verify it's gone.

---

## 9. Interview Q&A

**Q: What is a trigger in MySQL?**
Answer: A trigger is a stored program that automatically fires before or after an INSERT, UPDATE, or DELETE on a specific table. It runs per-row (FOR EACH ROW) and can reference OLD and NEW row values. Common uses: audit logging, data validation, maintaining derived columns.

**Q: What is the difference between BEFORE and AFTER triggers?**
Answer: BEFORE triggers run before the DML change is applied — you can modify NEW values or SIGNAL an error to cancel the operation. AFTER triggers run after the data is written — you can't modify NEW, but you can log changes or update related tables. Use BEFORE for validation/normalization, AFTER for auditing.

**Q: What are NEW and OLD in triggers?**
Answer: NEW refers to the row data after the DML (available in INSERT and UPDATE). OLD refers to the row data before the DML (available in UPDATE and DELETE). In BEFORE INSERT, you can modify NEW to change what gets stored. In DELETE, only OLD is available.

**Q: How do you raise an error in a trigger?**
Answer: Use the SIGNAL statement: `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error message';`. SQLSTATE 45000 is the generic "unhandled user-defined exception" code. This cancels the DML operation and returns the error to the client.

**Q: What are the limitations of triggers?**
Answer: Triggers cannot use COMMIT/ROLLBACK (no transaction control), cannot call procedures that do transaction control, cannot be used on views, and execute silently (hard to debug). They can also introduce hidden performance costs on busy tables since every DML fires them.
