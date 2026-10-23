# Beginner PostgreSQL Projects

---

## Project 1: E-Commerce Store with Rich Postgres Types & Constraints

### Architectural Goals
Design a production e-commerce relational schema utilizing modern PostgreSQL features rather than legacy SQL constructs:
- UUID v4 primary keys (`gen_random_uuid()`)
- Generated stored columns for price calculations
- Native `JSONB` for flexible product attributes (dimensions, color, specs)
- Check constraints enforcing non-negative inventory and positive prices
- Native `ENUM` types for order workflow states

### Complete Working DDL Schema

```sql
-- 1. Custom Types
CREATE TYPE order_status AS ENUM (
    'PENDING_PAYMENT',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);

-- 2. Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(64) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL,
    discount_pct NUMERIC(3, 2) DEFAULT 0.00,
    -- Computed stored column
    sale_price NUMERIC(10, 2) GENERATED ALWAYS AS (
        base_price * (1.00 - discount_pct)
    ) STORED,
    stock_quantity INT NOT NULL DEFAULT 0,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Invariants
    CONSTRAINT chk_positive_price CHECK (base_price > 0),
    CONSTRAINT chk_valid_discount CHECK (discount_pct >= 0 AND discount_pct <= 0.90),
    CONSTRAINT chk_non_negative_stock CHECK (stock_quantity >= 0)
);

-- 3. Customers Table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    shipping_address JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Orders Table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    status order_status NOT NULL DEFAULT 'PENDING_PAYMENT',
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Order Line Items
CREATE TABLE order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL,
    subtotal NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    CONSTRAINT chk_item_quantity CHECK (quantity > 0)
);

-- Indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_attributes_gin ON products USING gin (attributes jsonb_path_ops);
CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);
```

### Verification Exercises:
1. Insert 3 products with different attributes (e.g. `{"color": "silver", "ram_gb": 32}`).
2. Write a query to find all products where `attributes @> '{"color": "silver"}'`.
3. Attempt to insert a product with `base_price = -10.00` and verify the `chk_positive_price` constraint failure.

---

## Project 2: University Classroom & Enrollment Tracker

### Architectural Goals
Prevent physical double-booking of classrooms and exam slots using PostgreSQL **Exclusion Constraints (`EXCLUDE USING gist`)** and range types (`TSRANGE`), eliminating calendar scheduling bugs in SQL without application locks.

### Complete Working DDL Schema

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE classrooms (
    room_id INT PRIMARY KEY,
    building_name VARCHAR(50) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0)
);

CREATE TABLE class_schedules (
    schedule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id INT NOT NULL REFERENCES classrooms(room_id),
    course_code VARCHAR(20) NOT NULL,
    instructor_name VARCHAR(100) NOT NULL,
    time_slot TSRANGE NOT NULL,
    -- Prevent overlapping reservations for the same room!
    CONSTRAINT no_classroom_double_booking
        EXCLUDE USING gist (
            room_id WITH =,
            time_slot WITH &&
        )
);
```

### Verification Exercises:
1. Book Room 101 for `2026-09-01 09:00:00` to `2026-09-01 11:00:00`.
2. Try to book Room 101 for `2026-09-01 10:00:00` to `2026-09-01 12:00:00`.
3. Verify that PostgreSQL immediately blocks the conflicting booking with constraint violation `no_classroom_double_booking`.
