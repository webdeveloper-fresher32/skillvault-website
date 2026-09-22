# 03 — JSON and JSONB Deep-Dive

## Table of Contents
1. [The Document Store Inside PostgreSQL](#1-the-document-store-inside-postgresql)
2. [JSON vs JSONB: Internal Storage Differences](#2-json-vs-jsonb-internal-storage-differences)
3. [Core Extraction and Traversal Operators](#3-core-extraction-and-traversal-operators)
4. [Containment and Key Existence Operators](#4-containment-and-key-existence-operators)
5. [In-Place Mutation and Updating JSONB](#5-in-place-mutation-and-updating-jsonb)
6. [Indexing JSONB: Standard GIN vs `jsonb_path_ops`](#6-indexing-jsonb-standard-gin-vs-jsonb_path_ops)
7. [SQL/JSON Path Expressions (`jsonpath`)](#7-sqljson-path-expressions-jsonpath)
8. [JSONB vs MongoDB: Architectural Tradeoffs](#8-jsonb-vs-mongodb-architectural-tradeoffs)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Summary & Key Takeaways](#10-summary--key-takeaways)

---

## 1. The Document Store Inside PostgreSQL

PostgreSQL's **JSONB** (Binary JSON) feature provides the flexibility of a schema-less NoSQL document database combined with the transactional ACID rigor, foreign keys, joins, and indexing power of a relational engine.

Instead of deploying a separate document database cluster like MongoDB alongside your relational store, modern architectures frequently consolidate both workloads into PostgreSQL.

---

## 2. JSON vs JSONB: Internal Storage Differences

PostgreSQL provides two JSON data types:

| Feature | `JSON` | `JSONB` |
|---|---|---|
| **Storage Format** | Raw text copy of input string | Decomposed binary representation |
| **Ingestion Speed** | Fast (simple text copy + syntax check) | Slightly slower (must parse and decompose into binary tree) |
| **Query Speed** | Slow (must re-parse text on every query) | **Ultra-Fast** (direct binary pointer offsets to keys) |
| **Whitespace & Formatting** | Preserved exact formatting | Whitespace stripped |
| **Key Ordering** | Preserved order of input | Re-ordered and sorted by key length/alphabet |
| **Duplicate Keys** | Preserved | Automatically deduplicated (last value wins) |
| **Indexable** | Only via functional B-Tree expressions | **Full GIN and jsonb_path_ops indexing** |

> [!IMPORTANT]
> **Rule of Thumb:** Always use `JSONB` for general storage, querying, and indexing. Only use plain `JSON` if you strictly need to preserve exact input whitespace or duplicate keys for auditing.

---

## 3. Core Extraction and Traversal Operators

```sql
CREATE TABLE customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile JSONB NOT NULL
);

INSERT INTO customer_profiles (profile) VALUES 
('{
    "user": "alex_turner",
    "tier": "enterprise",
    "settings": {
        "theme": "dark",
        "notifications": { "email": true, "sms": false }
    },
    "login_count": 42,
    "tags": ["admin", "devops", "security"]
}');
```

### Extraction Operators:

| Operator | Return Type | Description | Example | Result |
|---|---|---|---|---|
| `->` | `jsonb` | Extract element by key or array index | `profile -> 'settings'` | `{"theme": "dark", ...}` |
| `->>` | `text` | Extract element **as text** | `profile ->> 'tier'` | `'enterprise'` |
| `#>` | `jsonb` | Extract nested object by path array | `profile #> '{settings, notifications}'` | `{"email": true, "sms": false}` |
| `#>>` | `text` | Extract nested leaf **as text** | `profile #>> '{settings, theme}'` | `'dark'` |

```sql
-- Querying with typed casting:
SELECT 
    profile ->> 'user' AS username,
    (profile ->> 'login_count')::INT AS logins
FROM customer_profiles
WHERE (profile ->> 'login_count')::INT > 30;
```

---

## 4. Containment and Key Existence Operators

The `@>` (containment) operator checks whether the left JSONB document contains the exact key-value hierarchy of the right document:

```sql
-- 1. Check if profile contains "tier": "enterprise"
SELECT * FROM customer_profiles 
WHERE profile @> '{"tier": "enterprise"}';

-- 2. Check nested key containment
SELECT * FROM customer_profiles 
WHERE profile @> '{"settings": {"theme": "dark"}}';

-- 3. Check if an array inside JSONB contains an element
SELECT * FROM customer_profiles 
WHERE profile -> 'tags' @> '["devops"]';

-- 4. Key existence (?)
SELECT * FROM customer_profiles WHERE profile ? 'login_count';

-- 5. Any key exists (?|)
SELECT * FROM customer_profiles WHERE profile ?| array['mobile', 'sms'];

-- 6. All keys exist (?&)
SELECT * FROM customer_profiles WHERE profile ?& array['user', 'tier'];
```

---

## 5. In-Place Mutation and Updating JSONB

Modifying nested JSON values without overwriting the entire document:

```sql
-- 1. jsonb_set: Update a nested key value
UPDATE customer_profiles
SET profile = jsonb_set(profile, '{settings, theme}', '"system"')
WHERE profile ->> 'user' = 'alex_turner';

-- 2. Merge operator (||): Add or overwrite top-level keys
UPDATE customer_profiles
SET profile = profile || '{"last_active": "2026-06-15T09:00:00Z", "verified": true}'::jsonb;

-- 3. Key removal (-): Delete a top-level key
UPDATE customer_profiles
SET profile = profile - 'login_count';

-- 4. Path removal (#-): Delete a nested key
UPDATE customer_profiles
SET profile = profile #- '{settings, notifications, sms}';
```

---

## 6. Indexing JSONB: Standard GIN vs `jsonb_path_ops`

PostgreSQL offers two distinct Generalized Inverted Index (GIN) strategies for JSONB:

### 1. Default GIN Index (`gin(column)`)
- **Indexes:** Both keys and values.
- **Supports:** `@>`, `?`, `?|`, `?&` operators.
- **Index Size:** Larger.
```sql
CREATE INDEX idx_profiles_gin ON customer_profiles USING gin(profile);
```

### 2. Fast Path-Ops GIN Index (`gin(column jsonb_path_ops)`)
- **Indexes:** Hashes entire key-value paths (e.g. `hash("settings.theme:dark")`).
- **Supports:** Only the `@>` containment operator.
- **Index Size:** **Up to 60% smaller and significantly faster than standard GIN!**
```sql
CREATE INDEX idx_profiles_path_gin ON customer_profiles USING gin(profile jsonb_path_ops);
```

---

## 7. SQL/JSON Path Expressions (`jsonpath`)

Starting in PostgreSQL 12+, Postgres implemented the official SQL:2016 JSON Path standard:

```sql
-- Find profiles where login_count is greater than 20
SELECT profile ->> 'user' 
FROM customer_profiles
WHERE jsonb_path_exists(profile, '$.login_count ? (@ > 20)');

-- Extract matching items from an array
SELECT jsonb_path_query(profile, '$.tags[*] ? (@ == "admin")')
FROM customer_profiles;
```

---

## 8. JSONB vs MongoDB: Architectural Tradeoffs

```
+-------------------------------------------------------------------------------+
|                       PostgreSQL JSONB vs MongoDB BSON                        |
+-------------------------------------------------------------------------------+
| ACID Transactions: Postgres provides full multi-statement serializable ACID   |
| Join Capability:   Join JSONB fields directly to regular relational tables    |
| Foreign Keys:      Reference relational IDs inside or outside JSONB documents |
| Tooling:           Single unified operational backup, PITR, and replica pipe  |
| Sharding:          MongoDB shards easier; Postgres scales higher vertically   |
+-------------------------------------------------------------------------------+
```

---

## 9. Hands-On Exercises

1. Create a table `product_catalog` with columns `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` and `metadata JSONB NOT NULL`.
2. Insert 3 products with different attributes (color, size, specifications, warranty).
3. Create a `jsonb_path_ops` GIN index on `metadata`.
4. Run `EXPLAIN (ANALYZE, BUFFERS)` to verify that a containment query (`@> '{"brand": "Sony"}'`) uses a **Bitmap Index Scan** on your GIN index.

---

## 10. Summary & Key Takeaways

1. Use `JSONB` for binary-stored, indexable, and performant document workloads.
2. `->>` extracts text, while `->` extracts JSONB objects.
3. `@>` (containment) is the most powerful operator and is heavily accelerated by GIN indexes.
4. `jsonb_path_ops` produces compact, ultra-fast GIN indexes when queries rely on containment tests.
5. `jsonb_set` and `||` enable granular in-place document mutations.
