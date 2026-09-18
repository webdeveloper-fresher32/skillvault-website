# Database Security Fundamentals — Complete Guide

> "A hotel gives a guest a key card that opens one room for three nights — not the master key that also opens the safe, the kitchen and the payroll office."

---

## Table of Contents

1. [The Problem: The Application That Connects as Admin](#1-the-problem-the-application-that-connects-as-admin)
2. [The Hotel Key Card Analogy](#2-the-hotel-key-card-analogy)
3. [The Mechanism: Authentication, Authorization and Least Privilege](#3-the-mechanism-authentication-authorization-and-least-privilege)
4. [Diagram: Where a Parameter Enters the Query Pipeline](#4-diagram-where-a-parameter-enters-the-query-pipeline)
5. [Code Walkthrough: An Injectable Query and Its Fix](#5-code-walkthrough-an-injectable-query-and-its-fix)
6. [Comparing Encryption in Transit to Encryption at Rest](#6-comparing-encryption-in-transit-to-encryption-at-rest)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: The Application That Connects as Admin

The connection string was written on day one to make the first migration work, and it has been the application's production credential ever since. It authenticates as the database superuser, so every bug in the application is now a bug with unlimited authority behind it.

### One Credential, Unlimited Authority

```text
DATABASE_URL=postgres://postgres:hunter2@db.internal:5432/shop
  ↳ This account can read every row of every table, DROP any table,
    create new superusers, and disable auditing.
An injection in one rarely-used search endpoint therefore reaches:
  customers.email, customers.date_of_birth  (all 4M rows)
  payment_tokens (unused here), and DROP TABLE orders
```

### What's Missing

The vulnerability was one unescaped search box, but the blast radius was the whole database, and that second part was a configuration decision made months earlier by someone who was in a hurry. What is missing is a separation between who you are, what you are allowed to do, and what a compromised process can reach even when the attacker fully controls it.

---

## 2. The Hotel Key Card Analogy

A hotel does not decide "this person is a guest, therefore give them everything". Reception verifies identity at check-in, then issues a card scoped to one room and one date range. Housekeeping's card opens many rooms but not the safe deposit or the payroll office, and even the manager's master key is logged whenever it is used.

### Master Key vs Scoped Key Card

```text
Master key   → opens everything, held by everyone who needed it once,
               and a lost copy compromises the whole hotel
Key card     → identity checked once at reception, then authority
               limited to room 412 until Thursday, revocable in
               seconds, every swipe recorded
```

### Mapping the Analogy to Database Access

Checking the passport at reception is authentication. Deciding which doors the card opens is authorization. Giving housekeeping its own card rather than the master key is least privilege. Recording every swipe is auditing. The whole of database security is these four ideas applied to connections, roles, and rows.

---

## 3. The Mechanism: Authentication, Authorization and Least Privilege

Authentication answers "who is this connection", and authorization answers "what may this identity do". They are separate systems, and confusing them is how a correctly authenticated connection ends up with far more authority than the feature needs.

### Authentication vs Authorization

```text
Authentication → password, client certificate, or a cloud IAM token,
                 verified once when the connection is established
Authorization  → GRANT and REVOKE on specific objects, evaluated on
                 every single statement that connection sends
  ↳ A correct password proves identity and says nothing about which
    tables that identity may read.
```

### Roles for Migration, Runtime and Analytics

```sql
-- One role per job. None of them owns the schema or holds superuser.
CREATE ROLE app_runtime   LOGIN PASSWORD :'runtime_pw';
CREATE ROLE app_migrator  LOGIN PASSWORD :'migrator_pw';
CREATE ROLE analytics_ro  LOGIN PASSWORD :'analytics_pw';

-- Runtime: read and write rows, never change the schema.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
    TO app_runtime;
-- Migrator: owns the schema, used only by the deploy pipeline.
GRANT CREATE ON SCHEMA public TO app_migrator;
GRANT SELECT ON orders, order_lines TO analytics_ro;  -- read-only
```

### Row-Level Security

```sql
-- RBAC decides which TABLES a role may touch. Row-level security
-- decides which ROWS, via a predicate the engine appends to every
-- query — unforgettable in a way a WHERE clause is not.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoices
    USING (tenant_id = current_setting('app.tenant_id')::bigint);
-- SELECT * FROM invoices now returns only the current tenant's rows,
-- even if the application forgot its own tenant filter.
```

---

## 4. Diagram: Where a Parameter Enters the Query Pipeline

### Parse First, Then Bind

```text
STRING CONCATENATION                 PARAMETERIZED STATEMENT
"...WHERE email='" + input + "'"     "...WHERE email = $1", [input]
        │                                     │
        ▼                                     ▼
   input becomes part of              statement text parsed FIRST,
   the SQL TEXT, so the               with no input present; the
   parser reads keywords              value is then bound to the
   and values mixed together          finished plan as DATA
        │                                     │
        ▼                                     ▼
   ' OR 1=1 -- becomes a real         ' OR 1=1 -- is just an
   OR clause and a comment            email matching nobody
```

### Reading the Diagram

The fix is not that the parameter is cleaned; it is that the parameter arrives after parsing is finished, so there is no moment at which it could have been read as syntax. The statement's shape — which tables, which operators, where the clauses end — is fixed before the value exists, and a value cannot retroactively add an `OR` to a plan that has already been built.

---

## 5. Code Walkthrough: An Injectable Query and Its Fix

The vulnerability is always the same shape: a string that the developer thinks of as data is handed to the parser as code.

### The Vulnerable Query and the Attack String

```python
# VULNERABLE — never write this.
def find_user(email):
    return db.execute("SELECT id, email, is_admin FROM users "
                      "WHERE email = '" + email + "'")
```

```text
Normal input:  ada@example.com  → ... WHERE email = 'ada@example.com'
Attack input:  ' OR '1'='1      → ... WHERE email = '' OR '1'='1'
                                    ↳ returns every row in users
Attack input:  '; UPDATE users SET is_admin = true WHERE id = 7; --
  ↳ Two statements; the trailing -- comments out the stray quote,
    and if the role can UPDATE users, this succeeds.
```

### The Parameterized Fix, and Why Escaping Is Not One

```python
# SAFE — value sent separately from the statement text.
def find_user(email):
    return db.execute(
        "SELECT id, email, is_admin FROM users WHERE email = $1", [email])
# $1 is a placeholder, not interpolation: the driver sends statement
# and value as two distinct protocol fields; the parser never sees it.
```

```text
Why the alternatives fail:
  Escaping by hand → must be right for every character, encoding and
                     context (quoted, LIKE pattern, identifier) at
                     every call site, forever. One miss is a hole.
  Blocklists       → "reject OR, --, DROP" blocks O'Brien and "R&D --
                     Q3", and misses encodings, comment variants and
                     case tricks it never listed.
  ↳ Identifiers cannot be parameterized at all — validate table and
    column names against an allowlist you control.
```

---

## 6. Comparing Encryption in Transit to Encryption at Rest

Both are called encryption and are frequently treated as one checkbox, but they defend against completely different attackers and neither covers the other's gap.

### In Transit vs At Rest

| | In transit (TLS) | At rest (disk or volume encryption) |
|---|---|---|
| Protects against | Anyone reading or altering traffic between app and database, while the connection is open | Anyone obtaining the physical disk, a raw volume snapshot, or a stolen backup file |
| Useless against | A stolen backup file | A compromised application, or anyone with valid credentials |
| Typical failure | `sslmode` left at a value that accepts an unverified certificate | Assuming it protects live data — a running engine decrypts transparently for every authorized query |

### The Secret That Undoes Both

```text
Where connection strings leak, in rough order of frequency:
  a committed .env or config file in a repository
  application logs printing the DSN on startup or on error
  an exception page or stack trace shown to a user
  ↳ Rotate on any exposure, treat rotation as routine rather than an
    incident, and prefer short-lived credentials from a secrets
    manager or cloud IAM over static passwords.
```

### Takeaway

At-rest encryption protects the disk, not the database. To a running engine with a valid session, encrypted storage is completely transparent — so it stops a thief with your backup tape and does nothing whatever about an SQL injection, a leaked password, or an over-privileged application role. That is why least privilege and parameterization are the load-bearing controls and encryption is the layer underneath them, not a substitute for them.

---

## 7. Common Mistakes

- **Running the application as the schema owner or a superuser.** It makes the first deploy easy and turns every subsequent application bug into a full-database compromise. Separate the migration role that owns the schema from the runtime role that only reads and writes rows, and give analytics its own read-only role that has been explicitly revoked from sensitive tables.
- **Believing encryption at rest protects against application compromise.** It protects against someone walking off with a disk or a snapshot. A running engine decrypts transparently for anyone holding valid credentials, so an injection or a leaked password reads the data in plaintext exactly as the application would.
- **Trying to fix injection with escaping or a blocklist.** Escaping must be correct in every context at every call site forever; blocklists reject legitimate input like `O'Brien` while missing encodings and comment forms nobody enumerated. Parameterization works because the value arrives after parsing, which is a structural guarantee rather than a filter that can be outsmarted.
- **Keeping personal data indefinitely because storage is cheap.** Data-protection regimes generally require a stated purpose, a retention period, and the ability to locate and delete an individual's data on request — so an unbounded `users` table with free-text notes and no deletion job is a compliance problem and a growing breach radius at once. Classify PII columns, set a retention period per class, run the deletion job on a schedule, and keep an audit log of privileged access that is written somewhere the database roles cannot edit.

---

## 8. Hands-On Exercises

**Exercise 1:** Create three roles on a scratch database — `app_runtime`, `app_migrator`, `analytics_ro` — with the grants shown in Section 3. Connect as `app_runtime` and confirm that `INSERT` succeeds while `CREATE TABLE` and `DROP TABLE` are refused.

**Exercise 2:** Enable row-level security on a two-tenant `invoices` table with the policy from Section 3. Set `app.tenant_id` to each tenant in turn and confirm that `SELECT * FROM invoices` returns different rows with no `WHERE` clause anywhere in the query.

**Exercise 3:** Write the vulnerable `find_user` from Section 5 against a real table, then run it with the input `' OR '1'='1` and record how many rows come back. Rewrite it with a parameterized placeholder and run the identical input again, confirming zero rows and no error.

**Exercise 4:** Deliberately reproduce the third mistake in Section 7. Add a blocklist that rejects input containing `OR`, `--` or `DROP`, then find two legitimate inputs it wrongly rejects and one attack payload that still gets through — for example one using a different comment form or mixed case.

**Exercise 5:** Take a table containing personal data and write down, per column, whether it is PII, why it is retained, and for how long. Then write the deletion query that would satisfy an erasure request for one individual, and list every other table that would also need rows removed for that deletion to be complete.

---

## 9. Interview Q&A

**Q: What is the difference between authentication and authorization in a database?**
Authentication is proving who the connection is — a password, a client certificate, or an IAM-issued token — and it happens once, when the connection is established. Authorization is what that identity is permitted to do, expressed as grants on specific objects, and it is evaluated on every statement the connection sends. A correct password says nothing about which tables you may read, which is exactly why an application that authenticates successfully as a superuser is still a security problem.

**Q: How should an application connect to its database?**
As a role with the narrowest set of grants the application actually needs, which for runtime is usually `SELECT`, `INSERT`, `UPDATE` and `DELETE` on specific tables and nothing else. Schema changes belong to a separate migration role used only by the deploy pipeline, and analytics gets a third read-only role that has been explicitly revoked from sensitive tables. The point is that when the application is compromised — not if — the attacker inherits only what that role could already do.

**Q: Explain SQL injection and why parameterized queries fix it.**
Injection happens when user input is concatenated into the SQL string, so the parser reads the input as syntax rather than data — an input of `' OR '1'='1` closes the intended string literal and adds a condition that matches every row. Parameterized queries send the statement text and the values as separate parts of the protocol: the statement is parsed first, with a placeholder where the value goes, and the value is bound afterwards. Because parsing has already finished by the time the value exists, there is no point at which the input could become part of the statement's structure.

**Q: Why aren't escaping and input blocklists an adequate defence?**
Escaping has to be correct for every character, encoding and syntactic context — quoted string, `LIKE` pattern, identifier — at every call site in the codebase, permanently, and one missed spot is a hole. Blocklists are worse: rejecting `OR`, `--` or `DROP` breaks real inputs like `O'Brien` while missing encodings, comment variants and case tricks nobody thought to list. Parameterization is a structural property rather than a filter, which is why it is the answer, and identifiers that genuinely cannot be parameterized should be validated against an allowlist instead.

**Q: What does encryption at rest actually protect against?**
Someone obtaining the physical media, a raw volume snapshot, or a backup file — that is the whole threat model. A running engine decrypts transparently for any session with valid credentials, so at-rest encryption does nothing about SQL injection, a leaked connection string, or an over-privileged role, and TLS in transit does nothing about a stolen backup. They are two different layers underneath the controls that actually matter for application compromise, which are least privilege, parameterized queries, and auditing.
