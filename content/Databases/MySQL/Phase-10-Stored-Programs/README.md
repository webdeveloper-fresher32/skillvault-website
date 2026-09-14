# Phase 10: Stored Programs

```
┌─────────────────────────────────────────────────────────────────┐
│                  MySQL Stored Programs Overview                  │
│                                                                 │
│   Code that lives inside the database — executed server-side,   │
│   version-controlled per schema, and invoked by any client.     │
└─────────────────────────────────────────────────────────────────┘
```

## What This Phase Covers

Phase 10 moves from ad-hoc SQL queries into **server-side programming**: writing logic that lives inside MySQL and runs on the database engine itself. This is how production databases enforce business rules, automate operations, and expose safe interfaces to application code.

---

## Module Map

```
Phase-10-Stored-Programs/
├── 01-Stored-Procedures.md   ← Named routines with IN/OUT params, cursors, error handling
├── 02-Functions.md           ← Scalar functions called inside SQL expressions
├── 03-Triggers.md            ← Event-driven logic bound to table mutations
└── 04-Events.md              ← Scheduled jobs managed by the Event Scheduler
```

---

## The Four Pillars

| File | Mechanism | Invoked By | Returns |
|------|-----------|------------|---------|
| Stored Procedures | `CALL proc()` | Explicit client call | Result sets / OUT params |
| Functions | `SELECT func()` | SQL expressions | Single scalar value |
| Triggers | Automatic | INSERT / UPDATE / DELETE | Nothing (side effects) |
| Events | Automatic | Scheduler clock | Nothing (side effects) |

---

## Why Stored Programs Matter

**Performance** — Logic executes on the server, reducing round-trips. Complex multi-step operations happen in one network call.

**Encapsulation** — Applications call a procedure interface; internal table structure can change without touching application code.

**Security** — Grant `EXECUTE` on a procedure without exposing the underlying tables. Least-privilege access at the SQL layer.

**Consistency** — Triggers and procedures enforce rules regardless of which application or user modifies the data.

**Automation** — Events replace cron jobs that would otherwise require external scripts and OS-level scheduling.

---

## Prerequisites

Before starting Phase 10, you should be comfortable with:

- `SELECT`, `INSERT`, `UPDATE`, `DELETE` (Phases 1–3)
- Joins and subqueries (Phases 4–5)
- Indexes and query execution plans (Phase 7)
- Transactions and locking (Phase 8)
- Window functions (Phase 9)

---

## How to Use These Notes

Each module follows the same structure:

1. Concept explanation with real-world analogy
2. Syntax reference with annotated code blocks
3. Full working example (≥ 30 lines, runnable against a sample schema)
4. Common pitfalls and debugging tips
5. Five hands-on exercises
6. Interview Q&A section

Run every example against a local MySQL 8.0+ instance. The sample schema used throughout Phase 10 is a billing system with tables: `customers`, `subscriptions`, `invoices`, `invoice_items`, `audit_log`, and `daily_stats`.

---

## Quick Reference: Enabling the Environment

```sql
-- Confirm MySQL version (8.0+ recommended)
SELECT VERSION();

-- Enable the Event Scheduler (required for Phase 10 Module 04)
SET GLOBAL event_scheduler = ON;
SHOW VARIABLES LIKE 'event_scheduler';

-- Create the sample schema
CREATE DATABASE IF NOT EXISTS billing_db;
USE billing_db;
```

---

## Learning Path

```
01-Stored-Procedures  ──►  02-Functions
        │                       │
        └───────────┬───────────┘
                    ▼
             03-Triggers
                    │
                    ▼
             04-Events
```

Procedures first — they introduce DECLARE, control flow, cursors, and error handling that all other modules reference. Functions next, since the contrast with procedures is clearest when procedures are fresh. Triggers after that — they build on the same body syntax. Events last, as the simplest bodies.

---

## Sample Schema (Used Across All Modules)

```sql
CREATE TABLE customers (
    customer_id   INT AUTO_INCREMENT PRIMARY KEY,
    first_name    VARCHAR(50)  NOT NULL,
    last_name     VARCHAR(50)  NOT NULL,
    email         VARCHAR(100) NOT NULL UNIQUE,
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscriptions (
    subscription_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id     INT          NOT NULL,
    plan_name       VARCHAR(50)  NOT NULL,
    monthly_price   DECIMAL(8,2) NOT NULL,
    status          ENUM('active','paused','cancelled') DEFAULT 'active',
    started_at      DATE         NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE invoices (
    invoice_id    INT AUTO_INCREMENT PRIMARY KEY,
    customer_id   INT          NOT NULL,
    issued_date   DATE         NOT NULL,
    due_date      DATE         NOT NULL,
    total_amount  DECIMAL(10,2) DEFAULT 0.00,
    status        ENUM('draft','sent','paid','overdue') DEFAULT 'draft',
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE invoice_items (
    item_id       INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id    INT          NOT NULL,
    description   VARCHAR(200) NOT NULL,
    quantity      INT          NOT NULL DEFAULT 1,
    unit_price    DECIMAL(8,2) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
);

CREATE TABLE audit_log (
    log_id        INT AUTO_INCREMENT PRIMARY KEY,
    table_name    VARCHAR(64)  NOT NULL,
    record_id     INT          NOT NULL,
    action        ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    changed_by    VARCHAR(100) DEFAULT CURRENT_USER(),
    changed_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    old_value     JSON,
    new_value     JSON
);

CREATE TABLE daily_stats (
    stat_date       DATE         PRIMARY KEY,
    new_customers   INT          DEFAULT 0,
    active_subs     INT          DEFAULT 0,
    revenue         DECIMAL(12,2) DEFAULT 0.00,
    computed_at     DATETIME     DEFAULT CURRENT_TIMESTAMP
);
```

---

*Phase 10 of the MySQL mastery series. Continue to Phase 11: Replication & High Availability.*
