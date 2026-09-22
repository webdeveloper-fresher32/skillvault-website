# 01 — Roles, Privileges & Row-Level Security (RLS)

## Table of Contents
1. [The PostgreSQL Unified Role System](#1-the-postgresql-unified-role-system)
2. [Role-Based Access Control (RBAC) Architecture](#2-role-based-access-control-rbac-architecture)
3. [The `ALTER DEFAULT PRIVILEGES` Trap](#3-the-alter-default-privileges-trap)
4. [What is Row-Level Security (RLS)?](#4-what-is-row-level-security-rls)
5. [Implementing Multi-Tenant RLS Policies](#5-implementing-multi-tenant-rls-policies)
6. [Session Settings (`current_setting`) & Application Integration](#6-session-settings-current_setting--application-integration)
7. [Hands-On RLS Security Verification](#7-hands-on-rls-security-verification)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. The PostgreSQL Unified Role System

In PostgreSQL, there is no separate concept of "users" and "groups". Both are represented uniformly by **Roles**:
- A role with `LOGIN` privilege is effectively a **User**.
- A role without `LOGIN` is effectively a **Group** that other roles can inherit.

```sql
-- Create a group role
CREATE ROLE readonly_analysts;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_analysts;

-- Create an individual login user and assign to group
CREATE ROLE alice WITH LOGIN PASSWORD 'AliceSecretPass2026!';
GRANT readonly_analysts TO alice;
```

---

## 2. Role-Based Access Control (RBAC) Architecture

Follow the Principle of Least Privilege:
1. **Superuser (`postgres`):** Reserved strictly for DBA maintenance, installing extensions, and disaster recovery. Application code must **NEVER** connect as superuser!
2. **Schema Migration Role (`ddl_admin`):** Has ownership over tables, runs migrations, but does not accept public API traffic.
3. **Application Runtime Role (`app_user`):** Granted only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on specific tables. Cannot alter or drop schemas!

---

## 3. The `ALTER DEFAULT PRIVILEGES` Trap

A common surprise for developers: you grant permissions on all tables in a schema, but next week when a migration creates a new table, the application crashes with `permission denied for table new_feature`!

Why? Because permissions in PostgreSQL only apply to **existing** tables. To grant access to tables created in the future, use **`ALTER DEFAULT PRIVILEGES`**:

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO app_user;
```

---

## 4. What is Row-Level Security (RLS)?

In traditional multi-tenant applications, data isolation relies on developers remembering to append `WHERE tenant_id = ?` to every query. If a junior developer forgets this filter on a single endpoint, Tenant A's private data is leaked to Tenant B!

**Row-Level Security (RLS)** moves tenant isolation into the database engine itself:
- Even if the application issues `SELECT * FROM orders;`, PostgreSQL automatically injects a hidden security predicate, returning **only the rows belonging to that specific tenant**.

---

## 5. Implementing Multi-Tenant RLS Policies

### Step 1: Enable RLS on the Table
```sql
CREATE TABLE tenant_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title TEXT NOT NULL,
    body TEXT
);

-- Enable RLS (Default: No non-superusers can read or write any rows!)
ALTER TABLE tenant_documents ENABLE ROW LEVEL SECURITY;

-- Enforce RLS even for table owners:
ALTER TABLE tenant_documents FORCE ROW LEVEL SECURITY;
```

### Step 2: Create Declarative Security Policies
```sql
-- 1. Read Policy (USING clause)
CREATE POLICY tenant_isolation_select_policy 
ON tenant_documents
FOR SELECT
USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

-- 2. Write Policy (WITH CHECK clause validates incoming rows)
CREATE POLICY tenant_isolation_insert_policy 
ON tenant_documents
FOR INSERT
WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

-- 3. Modify Policy (Both USING and WITH CHECK)
CREATE POLICY tenant_isolation_update_policy 
ON tenant_documents
FOR UPDATE
USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
```

---

## 6. Session Settings (`current_setting`) & Application Integration

When an HTTP request enters your API backend, your middleware extracts the authenticated tenant UUID from the JWT, checks out a pooled database connection, and executes:

```sql
-- Set the tenant context for the duration of this transaction:
SET LOCAL app.current_tenant_id = 'e7b2353a-4467-4d79-9944-1f2939be3345';

-- Run regular ORM query without any tenant filtering:
SELECT * FROM tenant_documents;
-- Returns strictly tenant e7b2's documents!
```

When the transaction completes (`COMMIT;`), `SET LOCAL` is automatically cleared, returning the connection clean to the pool.

---

## 7. Hands-On RLS Security Verification

```sql
-- Create two distinct tenants
INSERT INTO tenant_documents (tenant_id, title) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Acme Secret Blueprint'),
    ('22222222-2222-2222-2222-222222222222', 'Globex Financial Ledger');

-- Connect as unprivileged app_user
SET ROLE app_user;

-- Test 1: Set context to Acme Tenant
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SELECT title FROM tenant_documents;
-- Output: "Acme Secret Blueprint" (Globex is invisible!)

-- Test 2: Attempt illegal cross-tenant write
INSERT INTO tenant_documents (tenant_id, title) 
VALUES ('22222222-2222-2222-2222-222222222222', 'Infiltrating Globex');
-- ERROR: new row violates row-level security policy for table "tenant_documents"
```

---

## 8. Summary & Key Takeaways

1. Roles unify users and groups under a single permission hierarchy.
2. Configure `ALTER DEFAULT PRIVILEGES` to ensure future migration tables remain accessible.
3. Superusers bypass all security checks; never connect your application as `postgres`.
4. **Row-Level Security (RLS)** enforces data isolation at the kernel layer, eliminating multi-tenant data leaks.
5. Use `SET LOCAL app.current_tenant_id` combined with `USING` and `WITH CHECK` policies for bulletproof SaaS architectures.
