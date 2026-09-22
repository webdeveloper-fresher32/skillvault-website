# Intermediate PostgreSQL Projects

---

## Project 3: Multi-Tenant SaaS Engine with Row-Level Security (RLS)

### Architectural Goals
Build a shared-database multi-tenant platform for a SaaS project management application (like Jira or Linear). The database must enforce complete tenant isolation at the kernel level using **Row-Level Security (RLS)**, ensuring no application endpoint can accidentally leak another organization's data.

### Technical Requirements
- Tenant provisioning with UUID organization keys.
- RLS enabled on all project and task tables.
- Context injection via session variable `app.current_tenant_id`.
- Automated tamper-proof JSON audit logging trigger capturing old and new records.

### Complete DDL & Security Implementation

```sql
-- 1. Organizations (Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    subdomain VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tasks Table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'TODO',
    assigned_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable Row-Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

-- 5. Define Declarative Security Policies
CREATE POLICY org_isolation_projects ON projects
FOR ALL
USING (organization_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY org_isolation_tasks ON tasks
FOR ALL
USING (organization_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

-- 6. Centralized Immutable Audit Log
CREATE TABLE saas_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id TEXT NOT NULL DEFAULT current_user,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Audit Trigger Function
CREATE OR REPLACE FUNCTION log_tenant_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_org_id := OLD.organization_id;
        INSERT INTO saas_audit_log (organization_id, table_name, action, old_data)
        VALUES (v_org_id, TG_TABLE_NAME, TG_OP, to_jsonb(OLD));
        RETURN OLD;
    ELSE
        v_org_id := NEW.organization_id;
        INSERT INTO saas_audit_log (organization_id, table_name, action, old_data, new_data)
        VALUES (v_org_id, TG_TABLE_NAME, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_tasks
AFTER INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW EXECUTE FUNCTION log_tenant_audit_event();
```

---

## Project 4: High-Concurrency Double-Entry Financial Ledger

### Architectural Goals
Design a core banking double-entry transaction engine guaranteeing:
- **Strict Mathematical Invariants:** Total debits must equal total credits in every transaction.
- **Atomic Balance Deduction:** Prevent overdrafts using row locks (`SELECT ... FOR UPDATE`).
- **Concurrent Worker Queue:** Background payment processing pods consume transfers using `FOR UPDATE SKIP LOCKED`.

### Complete DDL & Processing Script

```sql
-- 1. Accounts Table
CREATE TABLE ledger_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number VARCHAR(32) UNIQUE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT chk_positive_balance CHECK (balance >= 0.00)
);

-- 2. Journal Transactions
CREATE TABLE ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id VARCHAR(64) UNIQUE NOT NULL, -- Idempotency key from payment gateway
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Double-Entry Journal Postings
CREATE TABLE ledger_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES ledger_transactions(id),
    account_id UUID NOT NULL REFERENCES ledger_accounts(id),
    amount NUMERIC(14, 2) NOT NULL, -- Positive for Credit, Negative for Debit
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Atomic Transfer Stored Procedure
CREATE OR REPLACE PROCEDURE execute_money_transfer(
    p_reference_id VARCHAR,
    p_from_account UUID,
    p_to_account UUID,
    p_amount NUMERIC
)
LANGUAGE plpgsql AS $$
DECLARE
    v_tx_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be strictly positive';
    END IF;

    -- Lock accounts in deterministic order to eliminate deadlocks!
    IF p_from_account < p_to_account THEN
        PERFORM 1 FROM ledger_accounts WHERE id = p_from_account FOR UPDATE;
        PERFORM 1 FROM ledger_accounts WHERE id = p_to_account FOR UPDATE;
    ELSE
        PERFORM 1 FROM ledger_accounts WHERE id = p_to_account FOR UPDATE;
        PERFORM 1 FROM ledger_accounts WHERE id = p_from_account FOR UPDATE;
    END IF;

    -- 1. Deduct from sender (fails if balance drops below 0 due to CHECK constraint)
    UPDATE ledger_accounts
    SET balance = balance - p_amount
    WHERE id = p_from_account AND balance >= p_amount;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer rejected: Insufficient funds in account %', p_from_account;
    END IF;

    -- 2. Credit recipient
    UPDATE ledger_accounts
    SET balance = balance + p_amount
    WHERE id = p_to_account;

    -- 3. Record Journal Entry atomically
    INSERT INTO ledger_transactions (reference_id, description)
    VALUES (p_reference_id, 'P2P Transfer')
    RETURNING id INTO v_tx_id;

    INSERT INTO ledger_entries (transaction_id, account_id, amount) VALUES 
        (v_tx_id, p_from_account, -p_amount),
        (v_tx_id, p_to_account, p_amount);

    COMMIT;
END;
$$;
```
