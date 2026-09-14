# Parse, Plan, Execute — Complete Guide

> "A waiter writes the table's order onto a ticket, the kitchen checks that ticket against what is actually in the walk-in fridge, and only then does anyone decide which station starts cooking first."

---

## Table of Contents

1. [The Problem: The Same Query Two Very Different Runtimes](#1-the-problem-the-same-query-two-very-different-runtimes)
2. [The Restaurant Order Ticket Analogy](#2-the-restaurant-order-ticket-analogy)
3. [The Mechanism: Parser Binder Rewriter Planner Executor](#3-the-mechanism-parser-binder-rewriter-planner-executor)
4. [Diagram: The Operator Tree Rows Flow Upward](#4-diagram-the-operator-tree-rows-flow-upward)
5. [Code Walkthrough: Pulling Rows Through the Tree](#5-code-walkthrough-pulling-rows-through-the-tree)
6. [Comparing the SQL Text to the Plan Tree](#6-comparing-the-sql-text-to-the-plan-tree)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Same Query Two Very Different Runtimes

SQL states which rows are wanted. It never states how to fetch them. Everything between the text and the result set is decided by the engine, at the moment the statement is submitted — which means the decision can come out differently on Friday than it did on Monday.

### Unchanged Text Changed Runtime

```text
-- deployed once in January, never edited since
SELECT c.name, SUM(o.total) FROM customers c
JOIN   orders o ON o.customer_id = c.id
WHERE  o.placed_at >= DATE '2026-01-01' GROUP BY c.name;

    Monday 09:00      14 ms
    Friday 09:00   9,400 ms
      ↳ Same text, engine, and server. Rows grew 3% over the week
        and the application deployed nothing. What changed was
        the plan the engine chose for it.
```

### What the Statement Does Not Say

```text
SAYS:     which columns, tables, join predicate, filter, grouping
SAYS NOT: which table is read first, whether an index is used, which
          join algorithm runs, whether grouping is done by sorting or
          hashing, how much memory the sort gets, what runs in parallel
```

### What's Missing

Every one of those unstated decisions has to be made by something, and made freshly, because the right answer depends on facts that change: how many rows are in `orders` today, which indexes exist today, how much memory is free today. What's missing from a mental model of "SQL runs" is the compiler sitting between the text and the rows, and the fact that it recompiles rather than remembering.

---

## 2. The Restaurant Order Ticket Analogy

A spoken order does not cook anything. It gets written on a ticket, the ticket gets checked against the real inventory in the walk-in, and the head chef decides which station starts first and in what sequence — grill before plating, sauce in parallel. Only then does food move.

### From Spoken Order to Plated Food

```text
Spoken order    → "two steaks medium rare, one without the sauce"
Written ticket  → a structured slip: item, quantity, modifier
Inventory check → "steak" is a real dish, the walk-in has steak,
                  "no sauce" is a modifier that dish supports
Head chef       → grill starts now, salad in four, meet at the pass
Stations        → cook, each pulling from the one before it
```

### Mapping the Analogy to Query Processing

The spoken order is the SQL text, the written ticket is the syntax tree, the walk-in check is name resolution against the catalogue, and the head chef is the optimizer choosing an order of operations that the stations — the executor's operators — then carry out. Nobody cooks the words.

---

## 3. The Mechanism: Parser Binder Rewriter Planner Executor

A statement passes through five stages, each consuming the previous stage's output and producing a strictly more concrete artifact: text, then a syntax tree, then a resolved and rewritten tree, then a physical plan, then rows.

### The Five Stages

```text
SQL text
   ↓  PARSER    — is this grammatically valid SQL?      → syntax tree
   ↓  BINDER    — do these names exist, and as what?    → resolved tree
   ↓  REWRITER  — expand views, flatten, simplify       → logical tree
   ↓  PLANNER   — search plans, cost them, keep cheapest → physical plan
   ↓  EXECUTOR  — run the operators                     → result rows
```

### Parser and Binder

The parser knows grammar and nothing else. `SELECT * FORM orders` fails here. `SELECT * FROM ordrs` passes the parser — it is grammatically perfect — and fails at the binder, which is the first stage that consults the catalogue.

```text
PARSER rejects:  SELECT * FORM orders
  ↳ "FORM" is not a keyword — pure syntax error, no catalogue read
BINDER rejects:  SELECT total FROM ordrs
  ↳ grammatically perfect; fails because no relation "ordrs" exists
BINDER resolves: orders.total → column 4 of orders, type NUMERIC
                 SUM(...)     → the aggregate defined for NUMERIC
                 o            → alias bound to relation orders
```

### Rewriter and Planner

The rewriter applies transformations that are always valid regardless of data — a view is textually replaced by its definition, a constant expression is folded, a contradiction is recognised. The planner is the only stage that makes a choice, and the only stage that consults statistics.

```sql
-- Illustrative standard SQL. What the developer wrote:
CREATE VIEW active_orders AS SELECT * FROM orders WHERE status = 'ACTIVE';
SELECT customer_id FROM active_orders WHERE placed_at > DATE '2026-01-01';

-- What the planner actually receives, after view expansion:
SELECT customer_id FROM orders
WHERE  status = 'ACTIVE' AND placed_at > DATE '2026-01-01';
```

---

## 4. Diagram: The Operator Tree Rows Flow Upward

### The Plan as a Tree of Operators

```text
        ┌──────────────────────────────┐
        │ Aggregate SUM by c.name       │ ← result set leaves here
        └──────────────┬───────────────┘
        ┌──────────────┴───────────────┐   rows flow UP
        │ Hash Join o.customer_id=c.id │
        └──┬────────────────────────┬──┘
   ┌───────┴───────────┐  ┌─────────┴────────────┐
   │ Seq Scan customers│  │ Index Range Scan     │
   │ (build side)      │  │ orders placed_at>=.. │
   └───────────────────┘  └──────────────────────┘
      leaves are the only operators touching stored pages
```

### Reading the Diagram

Leaves are the only operators that touch storage — the pages, B+ trees, and buffer pool from Phase 5. Every operator above them consumes rows from its children and produces rows for its parent, and the root's output is the result set. A plan is read innermost-first: the two scans happen before the join can produce anything, and the join produces before the aggregate can.

---

## 5. Code Walkthrough: Pulling Rows Through the Tree

Rows are not materialised stage by stage into temporary tables. In the classic Volcano (iterator) model every operator exposes the same three-method interface, and the root is asked for one row at a time; the request cascades down the tree.

### Every Operator Has the Same Interface

```python
# Illustrative sketch of the Volcano/iterator model: open() acquires,
# next() returns ONE row or None, close() releases.

class Filter:
    def __init__(self, child, predicate):
        self.child, self.predicate = child, predicate

    def open(self):  self.child.open()    # cascades down the tree
    def close(self): self.child.close()

    def next(self):
        while True:
            row = self.child.next()   # pull one row from below
            if row is None:
                return None           # exhausted — propagate upward
            if self.predicate(row):
                return row            # push one row to the parent

root.open()                           # executor talks only to the root
while (row := root.next()) is not None: emit(row)
root.close()
```

### Why the Same SQL Gets a Different Plan

```text
Plan choice depends on inputs that are not in the SQL text:
  table statistics     → orders grew from 2M to 40M rows overnight
  statistics freshness → last refreshed before a 30M-row bulk load
  available indexes    → someone dropped idx_orders_placed_at
  bind parameter value → status='ACTIVE' (18M rows) vs 'DISPUTED' (140)
  memory available     → a hash join costed higher than sort-merge
  engine version       → an upgrade added a new transformation
  ↳ None of these live in the statement, so identical text can
    legitimately compile to a different plan on a different day.
```

---

## 6. Comparing the SQL Text to the Plan Tree

The SQL text and the operator tree describe the same result, but they are different artifacts with different shapes, and the order of clauses in one has almost nothing to do with the order of operators in the other.

### SQL Text vs Plan Tree

| | SQL Text | Plan Tree |
|---|---|---|
| Nature | Declarative — states the result wanted | Procedural — states the steps taken |
| Written by | The developer | The planner, freshly, per compilation |
| Order | Clause order (`SELECT`, `FROM`, `WHERE`) | Data-flow order, leaves upward |
| Join sequence | The order tables are typed | Whatever order the planner costed cheapest |
| Stability | Fixed until someone edits it | Can change with statistics, indexes, memory |

### Takeaway

Reading a plan is not reading the SQL back in a different font — it is reading the engine's chosen strategy, which is the only artifact that explains runtime. When a query is slow, the text tells you the intent and the plan tells you the cost; only one of the two changed overnight.

---

## 7. Common Mistakes

- **Assuming clause order controls execution order.** `FROM a, b, c` does not mean the engine reads `a` first, and `WHERE` conditions listed left to right are not evaluated left to right. The planner reorders freely as long as the result is provably identical, so reasoning about performance from the shape of the text is guesswork.
- **Treating a plan as a permanent property of a query.** A plan is compiled from the statement plus statistics plus available indexes plus current memory settings. Change any of the inputs and the same text can legitimately compile to something entirely different — which is exactly why "it was fast last week" is a real and common symptom rather than a contradiction.
- **Believing the executor materialises each stage into a temporary result.** In the iterator model rows are pulled one at a time through the whole tree, so a `LIMIT 10` at the root can stop the leaf scans early. Assuming full materialisation makes it impossible to explain why adding a limit sometimes changes runtime by three orders of magnitude.

---

## 8. Hands-On Exercises

**Exercise 1:** Take any non-trivial `SELECT` in a database you have access to and write out, on paper and before looking at anything, which table you believe is read first and which join algorithm you expect. Then obtain the plan and compare — the gap between your prediction and the plan is the thing this phase is teaching.

**Exercise 2:** Submit `SELECT * FORM orders;` and then `SELECT * FROM ordrs;`. Record the two error messages verbatim and identify which stage — parser or binder — produced each, using the wording as evidence.

**Exercise 3:** Create a view over a base table with a `WHERE status = 'ACTIVE'` filter, then query the view with an additional `WHERE placed_at > ...` predicate. Obtain the plan and confirm the view name does not appear as an operator: the rewriter expanded it before the planner ever saw it.

**Exercise 4:** Write the `Filter` iterator from Section 5 in any language, plus a `Scan` iterator over a Python list of dicts and a `Limit` iterator that stops after N rows. Add a print statement inside `Scan.next()` and confirm that `Limit(2)` causes far fewer scan calls than the list length — that is early termination in the pull model.

**Exercise 5:** Reproduce the third mistake from Section 7 deliberately. Insert several million rows into a test table, obtain and save the plan for a filtered query, then run the engine's statistics-collection command and obtain the plan again. Diff the two and note that nothing about the statement changed.

---

## 9. Interview Q&A

**Q: Walk me through what happens between submitting a SQL string and getting rows back.**
The text goes to a parser that checks grammar and produces a syntax tree, then to a binder that resolves every name and type against the catalogue, then to a rewriter that expands views, flattens subqueries where it can, and simplifies predicates. The result goes to the planner, which is the only stage that makes a real choice — it searches candidate plans, costs them using table statistics, and keeps the cheapest. The executor then runs that plan as a tree of operators and emits rows.

**Q: Why can the same SQL text produce a different execution plan on different days?**
Because the plan is compiled from more than just the text. Statistics change as data grows, an index may have been added or dropped, available memory differs, bind parameter values differ in selectivity, and engine upgrades add new transformations. The statement is one input to the planner among several, and the others are not under the application's control.

**Q: What is the difference between a syntax error and a binding error?**
A syntax error means the parser could not fit the text to the SQL grammar — a misspelled keyword or an unbalanced parenthesis — and no catalogue was consulted at all. A binding error means the grammar was fine but a name could not be resolved: no such table, no such column, ambiguous alias. They come from consecutive stages, and the message wording usually tells you which one you are looking at.

**Q: What does the Volcano or iterator model mean in practice?**
Every operator implements the same small interface — open, next, close — where `next()` returns a single row. The executor asks the root operator for a row, and that request cascades down the tree as each operator pulls from its children. The practical consequence is that rows stream rather than materialise, so an operator near the root that stops early, like a limit, can prevent the leaf scans from ever reading most of the table.

**Q: In a plan tree, which direction does data flow and where should you start reading?**
Data flows upward: leaves are the scan operators that touch storage, and each parent consumes its children's output. So you read a plan innermost and deepest first, because those operators run before anything above them can produce a single row, and the root's output is the result set the client receives.
