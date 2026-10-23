# Relational and Document Models — Complete Guide

> "A cafe can keep one master list of regulars and print only a customer number on each order slip, or print the full name and address on every slip — the second is faster to read at the counter, right up until someone moves house."

---

## Table of Contents

1. [The Problem: The Shape of the Data Decides the Cost of the Query](#1-the-problem-the-shape-of-the-data-decides-the-cost-of-the-query)
2. [The Order Slip Analogy](#2-the-order-slip-analogy)
3. [The Mechanism: Normalization, Foreign Keys, and Embedding](#3-the-mechanism-normalization-foreign-keys-and-embedding)
4. [Diagram: One Order in Two Shapes](#4-diagram-one-order-in-two-shapes)
5. [Code Walkthrough: The Same Three Operations in Both Models](#5-code-walkthrough-the-same-three-operations-in-both-models)
6. [Comparing Relational Normalization to Document Embedding](#6-comparing-relational-normalization-to-document-embedding)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Shape of the Data Decides the Cost of the Query

One e-commerce dataset — users, orders, and the line items inside those orders — has to serve two very different questions: "show me order 5001 exactly as the customer sees it" and "how much revenue has SKU `KB-87` produced across every order ever placed." No single layout makes both free.

### One Order Page, Five Reads

```text
GET /orders/5001  needs, at minimum:
  users → buyer's name and email;  orders → status, placed_at, total
  addresses → shipping address;  order_items → 3 product/qty/price rows
  products → the name and image of each of those 3 products
      ↳ Five tables stitched together for one screen the user thinks
        of as a single object.
```

### What's Missing

Splitting data into one table per kind of thing is what makes the revenue question easy — every line item across all orders sits in one place. But it means the object the application actually renders never exists in one place; it has to be reassembled on every page load. The missing option is storing the order the way the application thinks about it.

---

## 2. The Order Slip Analogy

A cafe with a loyalty scheme has a choice. It can keep one binder of regulars and write only "customer #412" on each order slip, so a change of address is one correction in one binder. Or it can print the full name and address onto every slip, so the person at the pickup counter never has to open the binder at all — at the cost of every past slip still showing the old address forever.

### Master Binder vs Printed Slip

```text
Master binder  → details exist once; slips point at them by number;
                 reading a slip means opening the binder too, but
                 correcting an address is a single edit
Printed slip   → details are copied onto the slip, which is now
                 self-contained and instantly readable, but correcting
                 an address means reprinting every slip
```

### Mapping the Analogy to the Two Models

The binder is the relational model: each fact lives in exactly one row, and other rows refer to it by key. The printed slip is the document model: the order carries copies of what it needs, so reading it is one operation, and the cost moves from read time to update time.

---

## 3. The Mechanism: Normalization, Foreign Keys, and Embedding

The relational model stores data as tables of rows with a fixed set of typed columns. Relationships are not stored as nesting; they are stored as values — a column in one table holding the key of a row in another.

### Normalization by Default: One Fact, One Place

```sql
-- Illustrative standard SQL; engines spell the types slightly differently.
CREATE TABLE users (
  user_id INTEGER PRIMARY KEY, full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE);

CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY, status VARCHAR(20) NOT NULL,
  placed_at TIMESTAMP NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(user_id));

CREATE TABLE order_items (
  order_id   INTEGER NOT NULL REFERENCES orders(order_id),
  product_id VARCHAR(20) NOT NULL REFERENCES products(product_id),
  quantity INTEGER NOT NULL, unit_price NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id));
```

### Embedding by Default: One Document per Order

```json
{
  "order_id": 5001, "status": "shipped", "placed_at": "2025-03-14T09:12:00Z",
  "customer": { "user_id": 412, "full_name": "Priya Nair", "email": "priya@example.com" },
  "shipping_address": { "line1": "18 Brook Lane", "city": "Leeds", "postcode": "LS1 4AB" },
  "items": [
    { "product_id": "KB-87", "name": "Mechanical Keyboard", "quantity": 1, "unit_price": 89.00 },
    { "product_id": "MS-12", "name": "Wireless Mouse",      "quantity": 2, "unit_price": 24.50 }
  ]
}
```

### Where the Duplicate Data Lives

```text
"full_name": "Priya Nair"     ← one copy per order she ever placed
"name": "Mechanical Keyboard" ← one copy per order containing KB-87
      ↳ Relational stores each string once; document stores one copy
        per order, so a rename costs writes proportional to history.
```

---

## 4. Diagram: One Order in Two Shapes

The same order 5001 as five linked rows and as one nested document.

### The Two Layouts Side by Side

```text
RELATIONAL                          DOCUMENT
┌─────────┐   ┌──────────┐          ┌──────────────────────────┐
│ users   │◄──│ orders   │          │ order 5001, status, date │
│ 412     │   │ 5001     │          │  customer { 412, Priya } │
└─────────┘   └────┬─────┘          │  shipping_address { … }  │
                   │ 1:N            │  items [                 │
              ┌────▼────────┐       │    { KB-87, 1, 89.00 },  │
              │ order_items │       │    { MS-12, 2, 24.50 }   │
              │ 5001,KB-87  │       │  ]                       │
              │ 5001,MS-12  │       └──────────────────────────┘
              └────┬────────┘         one read, no assembly
                   │ N:1
              ┌────▼─────┐
              │ products │  ← 5 reads, joined at query time
              └──────────┘
```

### Reading the Diagram

On the left, `order_items` exists only to express a many-to-many relationship; nothing in the diagram is nested, and every arrow is a key comparison performed at query time. On the right the same relationships are expressed by containment — `items` is *inside* the order — so the read costs one lookup, but `products` and `users` no longer have a single authoritative copy of the fields that were copied in.

---

## 5. Code Walkthrough: The Same Three Operations in Both Models

Three operations, each written against both layouts, show exactly where each model spends its effort.

### Operation 1: Render the Order Page

```sql
SELECT u.full_name, o.status, oi.quantity, oi.unit_price, p.name
FROM orders o
JOIN users u        ON u.user_id    = o.user_id
JOIN order_items oi ON oi.order_id  = o.order_id
JOIN products p     ON p.product_id = oi.product_id
WHERE o.order_id = 5001;
```

```text
Document equivalent (illustrative pseudocode):
  db.orders.findOne({ order_id: 5001 })
      ↳ One key lookup returns the whole page: the join happened
        once at checkout, not on every read.
```

### Operation 2: Revenue per Product Across All Orders

```sql
SELECT product_id, SUM(quantity * unit_price) AS revenue
FROM order_items GROUP BY product_id ORDER BY revenue DESC;
```

The document equivalent scans every order, unwinds its `items` array, groups by `product_id` and sums `quantity * unit_price` — the same answer, but read out of millions of whole documents instead of one narrow table, so it touches far more bytes.

### Operation 3: The Customer Changes Their Name

```sql
UPDATE users SET full_name = 'Priya Sharma' WHERE user_id = 412;
-- One row. Every order everywhere now reads the new name.
```

```text
Document equivalent:
  db.orders.updateMany({ "customer.user_id": 412 },
                       { $set: { "customer.full_name": "Priya Sharma" } })
      ↳ Touches every order she ever placed, needs an index on
        customer.user_id to find them, and may be wrong anyway.
```

---

## 6. Comparing Relational Normalization to Document Embedding

Both models can store the same information; they differ in where the assembly cost is paid and what a single write can atomically change.

### Relational vs Document

| | Relational (normalized) | Document (embedded) |
|---|---|---|
| Read one order | Join across 3–5 tables | One lookup by key |
| Revenue per product | Scan one narrow table | Scan all orders, unwind arrays |
| Rename a customer | One row updated | One update per historical order |
| Natural unit of atomicity | A transaction spanning several tables | A single document |

### Takeaway

Normalization optimizes for writes and for questions that cut *across* entities; embedding optimizes for reads of a whole entity and pushes the cost onto updates that touch copied fields. The deciding question is not "which model is better" but "does this data get read as a self-contained unit more often than the copied fields change," and copied fields that are *meant* to be frozen — the price paid, the address shipped to — are not duplication at all.

---

## 7. Common Mistakes

- **Embedding an array that grows without bound.** Embedding order line items is safe because an order has a handful of them and stops growing once placed. Embedding every review a product ever receives, or every event in a user's activity log, produces a document that grows forever, must be rewritten in full on every append, and eventually hits the engine's maximum document size.
- **Assuming document databases cannot express relationships.** They can: a document can hold a reference key instead of a copy, and most document engines offer a lookup or join stage. What changes is the default — relational engines make referencing the path of least resistance, document engines make embedding it.
- **Copying a mutable field when a reference was meant.** A product's current display name embedded in an order is stale the moment marketing renames the product. A product's price at the time of purchase embedded in the order is correct precisely *because* it does not follow the current price. Ask whether the copy is a cache or a historical fact before deciding it is a bug.

---

## 8. Hands-On Exercises

**Exercise 1:** Model a blog with `users`, `posts`, `comments`, and `tags` as relational tables — write the `CREATE TABLE` statements including foreign keys and the join table tags require. Then model the same blog as documents where a post embeds its comments and tags. Write down, in one sentence each, what the second model makes cheap and what it makes expensive.

**Exercise 2:** For your document blog, write the update needed when a user changes their display name and that name is embedded in every post and every comment they have written. State how many documents it touches for a user with 40 posts and 900 comments, and what index makes finding them possible.

**Exercise 3:** Write the SQL for "the ten most-commented posts this month" against your relational schema, then describe in pseudocode how the same answer is produced from the document version. Note which model reads fewer bytes and why.

**Exercise 4:** Deliberately reproduce the unbounded-array mistake from Section 7: design a `products` document that embeds every review inline, then estimate its size after 50,000 reviews at 400 bytes each and describe what happens to a write that appends review 50,001. Then re-model reviews as their own collection referencing `product_id` and say what you lost.

**Exercise 5:** Take the e-commerce order from Section 3 and classify each embedded field as either a cache of a fact that lives elsewhere or a historical snapshot that must never change: `customer.full_name`, `customer.email`, `shipping_address`, `items[].name`, `items[].unit_price`. For each cache, name the event that invalidates it.

---

## 9. Interview Q&A

**Q: What is the core difference between the relational and document models?**
The relational model stores data as tables of rows, and relationships are expressed as key values that get matched at query time, so each fact ideally lives in exactly one place. The document model stores data as self-contained nested objects, and relationships are commonly expressed by containment, so an entity the application treats as one thing is stored as one thing. The practical consequence is that relational reads assemble and document reads retrieve.

**Q: What does "pre-joined" mean when people describe document storage?**
It means the join was done once, at write time, and the result was stored. A relational order page recomputes the join between users, orders, items, and products on every read; a document order already contains all of it, so reading it is a single key lookup. You pay for that at write time and whenever a copied field changes.

**Q: Where does duplicate data live in a document model, and why is that acceptable?**
It lives inside every document that embedded a copy — the customer name inside each of their orders, the product name inside each order containing that product. It is acceptable when the copy is either rarely changed or deliberately frozen: the unit price on an invoice should be the price at purchase, not the current price, so storing it in the order is correct rather than redundant.

**Q: When would you choose normalization over embedding?**
When the same fact is referenced from many places and changes often, when queries frequently cut across entities rather than reading one entity whole, or when a write needs to atomically change several related things at once. A reporting-heavy system that constantly aggregates line items across all orders is a much better fit for a narrow, normalized `order_items` table than for arrays scattered inside millions of documents.

**Q: Is embedding always faster to read?**
Only for the access pattern it was designed around. Reading one whole order is faster embedded. Reading a small slice of many orders is often slower, because the engine has to load entire documents — including fields the query does not need — to reach the nested array, whereas the normalized version reads one narrow table. Embedding is an optimization for a specific read shape, not a general speedup.
