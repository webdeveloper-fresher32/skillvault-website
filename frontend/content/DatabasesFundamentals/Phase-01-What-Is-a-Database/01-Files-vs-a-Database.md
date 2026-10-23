# Files vs a Database — Complete Guide

> "A shared paper ledger on a desk works until two clerks reach for it at the same time; a bank teller window works because exactly one person is served at a time and every entry is stamped before the drawer closes."

---

## Table of Contents

1. [The Problem: A Shared CSV That Two People Save at Once](#1-the-problem-a-shared-csv-that-two-people-save-at-once)
2. [The Bank Teller Window Analogy](#2-the-bank-teller-window-analogy)
3. [The Mechanism: What a DBMS Adds on Top of Files](#3-the-mechanism-what-a-dbms-adds-on-top-of-files)
4. [Diagram: Server, Instance, Database, Schema, Table](#4-diagram-server-instance-database-schema-table)
5. [Code Walkthrough: The Same Task in Files and in SQL](#5-code-walkthrough-the-same-task-in-files-and-in-sql)
6. [Comparing Flat Files to a DBMS](#6-comparing-flat-files-to-a-dbms)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: A Shared CSV That Two People Save at Once

An `orders.csv` on a shared drive is a perfectly good database for one person on one machine. Every failure below appears the moment that stops being true.

### Two Writers, One File

```text
09:00:00  Alice's script reads orders.csv (50,000 rows) into memory
09:00:04  Bob's script   reads orders.csv (50,000 rows) into memory
09:01:10  Alice appends order 50001 and writes the whole file back
09:02:30  Bob   appends order 50002 and writes the whole file back
            ↳ Bob's copy never contained order 50001, so rewriting the
              file deletes it. No error is raised anywhere.
```

### The Crash in the Middle of a Write

```text
The process is 41 MB into rewriting a 62 MB file when the host loses power.
On disk afterwards:
  bytes 0 .. 41,943,040          → the new version
  bytes 41,943,041 .. 65,011,712 → the old version, mid-row, mid-field
            ↳ Nothing records where the boundary is, and no copy of the
              41 MB that was overwritten survives anywhere.
```

### The Question You Cannot Ask

```text
"How many orders did customer 3182 place in March?"
  ↳ Parse all 50,000 rows and count. Cost grows with the file, not the
    answer: 3 matching rows still costs 50,000 reads.
"Reject any order whose qty is zero"
  ↳ Nothing enforces it; every writing program must remember to.
"Let the intern read orders but not customers.email"
  ↳ Permissions are per file, not per table or column.
```

### What's Missing

None of these are exotic. They are lost updates, non-atomic writes, unindexed scans, unenforced integrity, and all-or-nothing access control — five distinct problems that every application storing data eventually hits. What is missing is a single component that owns the bytes and solves all five in one place, so the application never has to.

---

## 2. The Bank Teller Window Analogy

A branch could put the ledger on a table and let customers write in it themselves. It does not, because two people writing at once produces a book nobody can trust. Instead there is a teller: one window, one customer at a time, every transaction stamped and journalled before the drawer closes, and a rule about who is allowed to see which account.

### Open Ledger vs Teller Window

```text
Open ledger   → anyone writes directly, in any order; a half-finished
                entry stays half-finished; anyone holding the book
                sees every account in it
Teller window → only the teller touches the ledger; requests queue and
                are served one at a time; each is journalled before it
                counts as done; the teller checks who you are first
```

### Mapping the Analogy to a DBMS

The teller is the database server process. The ledger behind the counter is the set of data files, which no application ever opens directly. The queue at the window is concurrency control, the journal is the write-ahead log, and the identity check is authentication plus privileges. An application asks for what it wants; it does not reach over the counter.

---

## 3. The Mechanism: What a DBMS Adds on Top of Files

A database management system (DBMS) is a long-running program that exclusively owns a set of files on disk and mediates every read and write to them. Underneath it is still files — the DBMS just refuses to let anyone else touch them, which is precisely what buys the guarantees.

### Five Failures, Five Answers

```text
Lost update           → concurrency control: locking or multi-version
                        reads pick a winner, and tell the loser
Torn file after crash → transactions plus a write-ahead log: a change is
                        fully applied or fully absent, never half of it
Scan for a single row → indexes: find the matches without reading the
                        other 49,997
Garbage values        → constraints: NOT NULL, CHECK, UNIQUE, PRIMARY
                        KEY, FOREIGN KEY — rejected at write time
Everyone sees all     → access control: privileges per user and table
```

### The Client/Server Model

```text
Application process                    Database server process
  │  open connection ─────────────────►  authenticate user "app_rw"
  │  send "SELECT ... WHERE id = 7" ──►  parse → plan → execute, reading
  │  ◄───────────────── result rows      pages from buffer pool or disk
  │  close connection ────────────────►  release locks, free memory
       ↳ The application holds no file handle on the data files, so it
         cannot corrupt them by writing badly — it never writes at all.
```

---

## 4. Diagram: Server, Instance, Database, Schema, Table

The word "database" gets used for four different things in the same sentence. These are the four levels, from the machine down to the rows.

### The Nesting

```text
Host machine — one physical or virtual server, an address and a port
  ▼
┌───────────────────────────────────────────────────────────┐
│ Instance — one server process, its memory, its data files │
│  ┌─────────────────────┐   ┌─────────────────────┐        │
│  │ Database: shop      │   │ Database: reporting │        │
│  │  ┌────────────────┐ │   │  ┌────────────────┐ │        │
│  │  │ Schema: sales  │ │   │  │ Schema: public │ │        │
│  │  │  ├ orders      │ │   │  │  ├ daily_sales │ │        │
│  │  │  ├ order_items │ │   │  │  └ cohorts     │ │        │
│  │  │  └ customers   │ │   │  └────────────────┘ │        │
│  │  └────────────────┘ │   └─────────────────────┘        │
│  └─────────────────────┘   table orders → rows → columns  │
└───────────────────────────────────────────────────────────┘
```

### Reading the Diagram

One host can run several instances on different ports; one instance can hold many databases; one database can hold many schemas; one schema holds tables. A fully qualified name walks the chain downward — `shop.sales.orders` — and the connection string picks the first two levels for you. Engines disagree about the middle: some treat database and schema as genuinely separate levels, others collapse them so that "schema" and "database" mean the same thing. When a later course uses one of those words, check which level it means before assuming.

---

## 5. Code Walkthrough: The Same Task in Files and in SQL

The task: record an order and decrement stock for the same item. Two facts must change together or not at all.

### The File Version

```python
# Illustrative pseudocode, not production code.
orders, stock = read_csv("orders.csv"), read_csv("stock.csv")
orders.append({"order_id": 50001, "sku": "KB-104", "qty": 1})
stock["KB-104"] -= 1              # nothing checks it was above zero
write_csv("orders.csv", orders)   # ← power loss here and ...
write_csv("stock.csv",  stock)    # ← ... this line never runs
```

### The Database Version

```sql
-- Illustrative standard SQL.
BEGIN;
INSERT INTO orders (order_id, customer_id, sku, qty)
VALUES (50001, 3182, 'KB-104', 1);
UPDATE stock SET on_hand = on_hand - 1
 WHERE sku = 'KB-104' AND on_hand >= 1;
COMMIT;
```

```text
BEGIN ... COMMIT
  ↳ Both statements are durable, or neither is; a power loss before
    COMMIT leaves no trace of either.
AND on_hand >= 1
  ↳ Updates zero rows when stock is exhausted, so the caller can check
    the affected-row count and roll back instead of going negative.
FOREIGN KEY (customer_id) REFERENCES customers(id)
  ↳ Declared once; the server then rejects any order naming a
    customer that does not exist, from every client.
```

---

## 6. Comparing Flat Files to a DBMS

Files are not wrong — they are the substrate a DBMS is built on. The comparison is about what has to be re-implemented by hand when you stop at the file layer.

### Flat Files vs a DBMS

| | Flat files (CSV, JSON, log files) | DBMS |
|---|---|---|
| Concurrent writers | Last writer wins, silently | Serialised by locks or multi-version reads |
| Crash mid-write | File may be left torn or truncated | Write-ahead log replays or discards on restart |
| Finding one row | Read and parse the whole file | Index lookup, cost roughly independent of table size |
| Data integrity | Whatever each writing program remembers | Declared once as constraints, enforced server-side |
| Access control | Per file, for anyone who can read the disk | Per user, per table, often per column |
| Operating cost | Nothing to install or run | A server to tune, back up, and upgrade |
| Good fit for | Config, exports, append-only logs, interchange | Shared mutable state with more than one writer |

### Takeaway

Every guarantee a DBMS provides can be reimplemented on top of files — that is literally what the DBMS did. The question is never "files or database" in the abstract; it is whether the application is willing to write and maintain its own locking, its own crash recovery, its own index structures, and its own permission model. For a single-writer config file the answer is reasonably yes. For anything with concurrent writers and a durability requirement, the answer is almost always no.

---

## 7. Common Mistakes

- **Treating a file lock as concurrency control.** An advisory lock file or an `O_EXCL` flag stops two processes opening the file at once, but it says nothing about what happens when the holder crashes mid-write, gives no way to let many readers proceed while one writer works, and leaves the lost-update window in Section 1 wide open if any process forgets to take the lock.
- **Assuming a successful write call means the data is on disk.** A write returns once the bytes reach the operating system's page cache, not the platter or the flash. Without an explicit flush at a point where the on-disk state is known to be consistent, a power loss can lose writes that the application already reported as saved — the exact problem a write-ahead log plus a flush at commit exists to solve.
- **Confusing the instance with the database.** "Restart the database" and "drop the database" refer to different levels: one restarts a server process holding many databases, the other deletes one namespace inside it. Getting these confused is how a routine restart turns into an outage, and it is worth being precise about which level a command touches.
- **Reaching for a DBMS for data that is never concurrently mutated.** A static lookup table shipped with the application, or an append-only audit log written by exactly one process, does not gain much from a server and does add an operational dependency. The DBMS earns its cost when state is shared and mutable.

---

## 8. Hands-On Exercises

**Exercise 1:** Generate a CSV of 50,000 order rows with columns `order_id`, `customer_id`, `sku`, `qty`, `placed_at`. Write down, step by step, everything you would have to build to let two people edit it safely at once: how a writer announces intent, how a reader knows it is looking at a complete file, what happens if the holder of the lock crashes, and how a second writer learns its change was rejected. Then list which of those steps a `BEGIN ... COMMIT` block replaces.

**Exercise 2:** Take the same CSV and time two operations by hand: counting orders for one specific `customer_id`, and counting orders per `customer_id` for all customers. Record how many rows each one had to read. Then write one sentence predicting how each number changes if the file grows to 5,000,000 rows, and one sentence on which of the two an index would help.

**Exercise 3:** Write out the byte-level state of `orders.csv` at three moments during a full-file rewrite that is interrupted at 60 percent: what a reader opening the file sees at each moment. Then design a rename-based scheme (write to `orders.csv.tmp`, then rename over the original) and state precisely which of the three moments it fixes and which it does not.

**Exercise 4:** For a `customers` table with `id`, `email`, `country`, and `salary_band`, write down the access rules for three roles: an analyst who may read everything except `salary_band`, an application account that may insert and update but never delete, and a support agent who may read only rows where `country = 'IE'`. Express each as a sentence of the form "role X may VERB on OBJECT". Then explain why filesystem permissions cannot express any of the three.

**Exercise 5:** Deliberately reproduce the second mistake in Section 7. Write a script that appends a line to a file and prints "saved" immediately after the write call returns, with no flush. Run it under a forced power-cut simulation — kill the machine or the container abruptly, not the process — and check whether the last few "saved" lines are actually present in the file afterwards. Record how many reported-saved lines were lost.

---

## 9. Interview Q&A

**Q: What does a database management system give you that a file on disk does not?**
Five things, each answering a specific failure of the file approach: concurrency control so two writers cannot silently overwrite each other, transactions with a write-ahead log so a crash mid-write leaves the data either fully changed or fully unchanged, indexes so finding one row does not mean reading every row, declared constraints so invalid data is rejected at write time regardless of which client sent it, and per-user access control finer than filesystem permissions. Underneath it is still files — the point is that one component owns them and enforces all five in one place.

**Q: Why does a database run as a server that clients connect to, rather than as a library the application links against?**
Because the guarantees require a single arbiter. If every application process opened the data files directly, there would be no one place that knows which rows are currently locked, which transactions are in flight, or what order to replay the log in after a crash. A server process owns the files, holds the buffer pool and lock table in its own memory, and serialises every request through itself. That said, embedded engines that link as a library do exist and are a reasonable fit when there is exactly one process.

**Q: Someone says "restart the database" — what did they actually mean?**
Almost certainly the instance: the running server process, its memory, and every database it hosts. A database in the strict sense is a namespace inside that instance holding schemas and tables, and you do not restart one of those independently. The four levels worth keeping straight are host, instance, database, and schema, with tables inside the schema — and engines differ on whether database and schema are genuinely separate levels or effectively the same one.

**Q: If a file write returns successfully, is the data safe?**
No. A successful write means the bytes reached the operating system's page cache; the operating system decides later when to send them to the device. A power loss in between loses data that the application already believed was saved. This is why a database issues an explicit flush at commit time, and why the write-ahead log is flushed before the data pages are — the log is what lets recovery reconstruct or discard whatever was in flight.

**Q: Is there any case where files are the right answer over a database?**
Yes, several. Configuration read at startup and never mutated at runtime, data interchange between systems, bulk export and import, and append-only logs written by a single process are all well served by plain files. The break point is concurrent mutation: as soon as more than one writer can change the same state, or a crash must not leave the state half-changed, the work of doing it correctly on raw files is the work of building a database engine badly.
