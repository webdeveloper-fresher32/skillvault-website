# Keys and Relationships — Complete Guide

> "A hotel can have two guests both named James Smith checking in on the same afternoon, which is exactly why the front desk writes a room number on the key card instead of a name."

---

## Table of Contents

1. [The Problem: Two Rows That Look Identical](#1-the-problem-two-rows-that-look-identical)
2. [The Hotel Room Number Analogy](#2-the-hotel-room-number-analogy)
3. [The Mechanism: From Candidate Key to Foreign Key](#3-the-mechanism-from-candidate-key-to-foreign-key)
4. [Diagram: What a Foreign Key Blocks and Allows](#4-diagram-what-a-foreign-key-blocks-and-allows)
5. [Code Walkthrough: A Many-to-Many Junction Table](#5-code-walkthrough-a-many-to-many-junction-table)
6. [Comparing Surrogate Keys to Natural Keys](#6-comparing-surrogate-keys-to-natural-keys)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Two Rows That Look Identical

A table without a rule about identity will happily store the same fact twice, and a table that points at another table without a rule about validity will happily point at nothing.

### Duplicates and Orphans in the Same Schema

```text
customer                        customer_order
  full_name      city             order_id  customer_name  total
  James Smith    Leeds            9001      James Smith    42.50
  James Smith    Leeds            9002      Jane Okafor    18.00
  ↳ One person twice, or two       ↳ Which James Smith? And no
    people? Nothing can say.         Jane Okafor exists at all.
```

### What's Missing

Two separate guarantees are absent. First, a way to say "this combination of values identifies exactly one row and may never repeat." Second, a way to say "the value in this column must already exist over there." The first is a key; the second is a foreign key.

---

## 2. The Hotel Room Number Analogy

A hotel does not identify guests by name, because names collide and change. It assigns a room number at check-in, prints it on the key card, and every other record for that stay — the restaurant bill, the minibar charge, the wake-up call — carries the room number rather than the guest's name.

### Name Tag vs Room Number

```text
Guest's name  → descriptive, human-friendly, and not unique — two
                James Smiths can both be in the building tonight
Room number   → assigned by the hotel, unique for the stay, and all
                the billing system needs to link a charge to a guest
Charge slip   → references a room number; the desk refuses a slip
                for room 812 when no one is staying in 812
```

### Mapping the Analogy to Keys

The room number is a primary key: the hotel picked it, it identifies one stay, and it is never blank. The charge slip's room-number field is a foreign key, and the desk clerk refusing a slip for an empty room is referential integrity. The guest's passport number is a natural key — genuinely unique in the outside world, but longer, format-varying, and not something the hotel wants stamped on every towel receipt.

---

## 3. The Mechanism: From Candidate Key to Foreign Key

Relational theory has precise words for the parts of a table, and they are worth learning because normalization in Lesson 3 is defined entirely in those terms.

### The Vocabulary of Relations and Keys

```text
Relation    → the table: a set of tuples over a fixed set of attributes
Tuple       → the row: one fact, one value per attribute
Attribute   → the column: a name plus a domain (its set of legal values)
Degree      → how many attributes the relation has
Cardinality → how many tuples it currently holds
  ↳ A relation is a set, so duplicate tuples cannot exist and row order
    is meaningless. A SQL table is a multiset: duplicates are possible
    unless a key constraint forbids them, which is why declaring keys
    is your job and not the engine's.

Superkey        → any attribute set whose values are unique per row
Candidate key   → a superkey with no removable attribute (minimal)
Primary key     → the one candidate key you nominate; implicitly NOT NULL
Alternate key   → any remaining candidate key, enforced with UNIQUE
Composite key   → any candidate key made of two or more attributes
Foreign key     → an attribute set required to match a key over there
```

### Declaring Them in Illustrative Standard SQL

```sql
CREATE TABLE customer (
    customer_id BIGINT       PRIMARY KEY,      -- surrogate, chosen key
    email       VARCHAR(254) NOT NULL UNIQUE,  -- alternate key
    full_name   VARCHAR(120) NOT NULL
);
```

### Foreign Keys and Referential Integrity

A foreign key says the values in one or more columns must appear as a key value in a referenced table. That rule is called referential integrity, and the engine enforces it on every insert, update, and delete.

```sql
CREATE TABLE customer_order (
    order_id    BIGINT     PRIMARY KEY,
    customer_id BIGINT     NOT NULL,
    placed_at   TIMESTAMP  NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customer (customer_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);
```

---

## 4. Diagram: What a Foreign Key Blocks and Allows

The constraint above ties two tables together in one direction only: `customer_order` depends on `customer`, never the reverse.

### The Link and the Delete Decision

```text
   customer (parent)                 customer_order (child)
  ┌───────────────┐                  ┌──────────────────┐
  │ customer_id PK│◄─────────────────│ customer_id   FK │
  └───────────────┘                  └──────────────────┘

DELETE FROM customer WHERE customer_id = 42;
        │
        ▼
Does any customer_order row still hold customer_id = 42?
        │
   ┌────┴─────┐
   No         Yes
   │           │
   ▼           ▼
Delete     The declared ON DELETE action decides:
proceeds     ├─ RESTRICT → error immediately, nothing is deleted
             ├─ NO ACTION → error, checked at end of statement
             ├─ CASCADE → those order rows are deleted too
             ├─ SET NULL → their customer_id becomes NULL
             └─ SET DEFAULT → customer_id becomes the column default
```

### Reading the Diagram

`CASCADE` is right when the child cannot exist alone and carries no independent value — order lines under an order, address rows under a user. `RESTRICT` is right when deleting the parent is almost certainly a mistake you want to hear about, which covers most business entities. `SET NULL` needs a nullable column and only makes sense when "no parent" is a real state, such as an employee whose manager left. `SET DEFAULT` needs the default value to itself exist in the parent table, which is rarely true.

---

## 5. Code Walkthrough: A Many-to-Many Junction Table

Relationship cardinality is not a column type; it is a consequence of where the keys sit.

### One-to-One and One-to-Many

```text
One-to-one   → FK on either side, plus UNIQUE on it
               employee.employee_id ← locker.employee_id UNIQUE
One-to-many  → FK on the many side, no UNIQUE
               customer.customer_id ← customer_order.customer_id
Many-to-many → neither side can hold it; a third table must exist
```

### The Junction Table

```sql
CREATE TABLE order_item (
    order_id   BIGINT        NOT NULL,
    product_id BIGINT        NOT NULL,
    quantity   INTEGER       NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,
    PRIMARY KEY (order_id, product_id),          -- composite key
    FOREIGN KEY (order_id) REFERENCES customer_order (order_id)
        ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES product (product_id)
        ON DELETE RESTRICT
);
```

```text
PRIMARY KEY (order_id, product_id)
  ↳ The pair is the row's identity, so no surrogate id is needed and
    a product cannot be listed twice on one order.
ON DELETE CASCADE on order_id → a line item is meaningless alone
ON DELETE RESTRICT on product_id → a sold product must not vanish
```

A column holds one value, so a many-to-many relationship has nowhere to live inside either table. Packing `"12,44,90"` into a `product_ids` column destroys the foreign key check, makes every lookup a string scan, and violates 1NF (Lesson 3). The junction table stores one row per pair and gets a natural home for the attributes that belong to the pairing itself — `quantity` and `unit_price` describe neither the order alone nor the product alone.

---

## 6. Comparing Surrogate Keys to Natural Keys

A natural key is drawn from the data's own meaning — an ISBN, an email address, a country code. A surrogate key is a value the system invents with no meaning outside the database.

### Surrogate vs Natural

| | Surrogate key | Natural key |
|---|---|---|
| Source | Generated by the system (sequence, identity, UUID) | Already present in the business data |
| Stability | Never changes, because nothing outside depends on its meaning | Changes when the business rule changes (email edited, ISBN reassigned) |
| Join cost | Narrow fixed-width integer repeated in every child table | Can be wide or composite, repeated in every child table |
| Duplicate risk | Two surrogate rows can hold identical business data unnoticed | The key itself forbids the duplicate |

### Takeaway

The honest trade is stability against self-description, and the usual answer is both rather than either: a surrogate primary key for children to reference, plus a `UNIQUE` constraint on the natural key so duplicates are still impossible. Skipping the `UNIQUE` is what turns "always use a surrogate key" into a real bug, because the surrogate guarantees only that rows are distinct, not that facts are.

---

## 7. Common Mistakes

- **Adding a surrogate primary key and no unique constraint on the natural key.** The table now permits two rows with the same email or the same ISBN and different generated ids, and the duplicates only surface when a report double-counts. A surrogate key answers "which row"; it never answers "is this fact already recorded".
- **Reaching for ON DELETE CASCADE because it makes an error message go away.** Cascade is a statement that the child data has no independent existence. Applied to something like orders under a customer, a single mistaken delete silently removes financial history that nothing else references, and there is no error to notice.
- **Modelling a many-to-many relationship with a comma-separated column.** A `tag_ids` column holding `'4,17,23'` cannot be foreign-key checked, cannot be indexed usefully, and turns "which posts have tag 17" into a substring match that also finds tag 170. The fix is a junction table, whose composite primary key is not a design smell but the row's actual identity.

---

## 8. Hands-On Exercises

**Exercise 1:** Create the `customer` and `customer_order` tables from Section 3 in any SQL engine. Insert two customers with the same `full_name` and confirm both are accepted, then insert a second customer with an existing `email` and confirm the `UNIQUE` constraint rejects it.

**Exercise 2:** Attempt `INSERT INTO customer_order (order_id, customer_id, placed_at) VALUES (9002, 777, CURRENT_TIMESTAMP)` where no customer 777 exists. Record the exact error text, then insert a valid order and confirm it succeeds.

**Exercise 3:** Build `product` and the `order_item` junction table from Section 5. Insert one order with three different products, then attempt to insert the same `(order_id, product_id)` pair twice and observe which constraint fires.

**Exercise 4:** With rows in place, run `DELETE FROM product WHERE product_id = <one that was ordered>` and confirm `RESTRICT` blocks it. Then run `DELETE FROM customer_order WHERE order_id = <that order>` and confirm `CASCADE` removed its `order_item` rows by querying the junction table afterwards.

**Exercise 5:** Reproduce the third mistake from Section 7. Add a `product_ids VARCHAR(200)` column to `customer_order`, store `'4,17,23'` in one row and `'170'` in another, then write `WHERE product_ids LIKE '%17%'` and confirm it matches both. Now write the equivalent junction-table query and confirm it matches only one.

---

## 9. Interview Q&A

**Q: What is the difference between a candidate key and a primary key?**
A candidate key is any minimal set of attributes whose values are unique across every row — minimal meaning you cannot drop an attribute and keep uniqueness. A table can have several candidate keys; the primary key is simply the one you nominate as the row's official identity, and it is implicitly NOT NULL. The remaining candidate keys are alternate keys and are normally enforced with UNIQUE constraints so the guarantees are not lost.

**Q: Would you use a surrogate key or a natural key for a primary key?**
Usually a surrogate for the primary key, because it never changes and stays narrow when it is copied into every child table, but with a UNIQUE constraint on the natural key alongside it. The natural key is what actually prevents duplicate facts; the surrogate only prevents duplicate rows. Dropping the natural-key constraint is the common failure, and it shows up later as the same customer existing twice with different generated ids.

**Q: When is ON DELETE CASCADE the right choice and when is it dangerous?**
It is right when the child row genuinely has no meaning without its parent — order line items, address rows belonging to one user, join rows in a junction table. It is dangerous whenever the child has independent business value, because a single delete of a parent then silently destroys records nobody meant to touch. For those relationships RESTRICT is safer: it turns a destructive accident into an error message you can act on.

**Q: Why does a many-to-many relationship always require a third table?**
Because a foreign key is a column value, and a column holds exactly one value per row. To let one order reference many products and one product be referenced by many orders, you need a row per pair, which is exactly what a junction table is. It also gives the relationship's own attributes somewhere to live — quantity and the price captured at purchase time describe the pairing, not the order and not the product.

**Q: What does referential integrity actually guarantee?**
That every non-null foreign key value corresponds to an existing key value in the referenced table, checked by the engine on insert, update, and delete rather than by application code. It does not guarantee the reference is semantically correct — pointing an order at the wrong valid customer still passes — and it does not stop nulls unless the column is declared NOT NULL. Its value is that orphaned rows become impossible regardless of which application, script, or console session wrote the data.
