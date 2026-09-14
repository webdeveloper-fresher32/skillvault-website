# MySQL JSON Data Type — Complete Guide

## Table of Contents
1. [JSON in MySQL](#1-json-in-mysql)
2. [Storing JSON](#2-storing-json)
3. [JSON Path Expressions](#3-json-path-expressions)
4. [Extracting Data](#4-extracting-data)
5. [Modifying JSON](#5-modifying-json)
6. [JSON Functions Reference](#6-json-functions-reference)
7. [Indexing JSON (Generated Columns)](#7-indexing-json-generated-columns)
8. [JSON Aggregation](#8-json-aggregation)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. JSON in MySQL

Picture a `products` table. A laptop needs `ram`, `cpu`, and `battery`. A pair of shoes needs `size`, `material`, and `color`. A t-shirt needs `size` and `fabric`. None of these attribute sets overlap much, and every category can invent new attributes next month.

Do you really want to add a nullable column for every attribute any product might ever have? You'd end up with a table that's mostly empty cells, and a migration every time someone launches a new product category. That's the pain JSON is meant to solve — you want the flexibility of "whatever attributes this row happens to need," but you don't want to abandon your relational database and reach for a separate NoSQL store just for this one column.

**The basic idea:** since MySQL 5.7.8, there's a native `JSON` column type, and it's smarter than just dumping a string into a `TEXT` column:
- It validates JSON on insert — invalid JSON is rejected outright.
- It stores the document in an optimized binary format, not plain text.
- It gives you functions to query and modify individual paths inside the document, without reading and rewriting the whole thing.
- It can even be indexed, indirectly, via generated columns (more on that trick in Section 7 — it's the best part).

```sql
-- JSON vs TEXT:
-- TEXT: stored as-is, no validation, no path queries
-- JSON: validated, binary-optimized, full function support
```

So think of `JSON` as "a `TEXT` column that actually understands its own contents."

---

## 2. Storing JSON

Using it is no different from any other column type — declare it, insert into it, and MySQL takes care of validating and storing it efficiently.

```sql
CREATE TABLE products (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  attributes JSON,               -- JSON column
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert valid JSON
INSERT INTO products (name, attributes) VALUES
('Laptop', '{"brand": "Dell", "ram": 16, "storage": 512, "tags": ["laptop", "work"]}'),
('Phone', '{"brand": "Apple", "model": "iPhone 15", "colors": ["black", "white"], "price": 999.00}');

-- Invalid JSON is rejected:
INSERT INTO products (name, attributes) VALUES ('Bad', '{not valid}');
-- ERROR: Invalid JSON text

-- JSON_OBJECT() helper for building JSON
INSERT INTO products (name, attributes) VALUES
('Tablet', JSON_OBJECT('brand', 'Samsung', 'size', 10.5, 'wifi', true));
```

Notice the third insert fails — MySQL checked `{not valid}` and refused it before it ever touched disk. A `TEXT` column would have happily stored that garbage and left you to discover the problem later, at read time.

---

## 3. JSON Path Expressions

Once a JSON document is sitting inside a column, how do you point at "just the brand" or "just the second tag"? That's what a **path expression** is for — think of it as a little address system for navigating inside the document, the same way a file path (`/home/user/docs`) navigates a filesystem.

Here's the syntax cheat sheet:

```
$            — root of the document
$.key        — object property
$[0]         — array element 0
$.a.b        — nested property
$.tags[*]    — all array elements
$**.name     — name at any depth (recursive)
```

```json
{
  "brand": "Dell",
  "specs": {
    "ram": 16,
    "storage": 512
  },
  "tags": ["laptop", "work", "portable"]
}

$.brand           → "Dell"
$.specs.ram       → 16
$.tags[0]         → "laptop"
$.tags[*]         → ["laptop", "work", "portable"]
$.specs.*         → [16, 512]
```

---

## 4. Extracting Data

### `->` and `->>` Operators

Here's a mistake almost everyone makes the first time they touch JSON in MySQL: they extract a brand name, compare it to `'Dell'`, and the `WHERE` clause quietly returns nothing — even though the row is right there. Why? Because what they extracted wasn't the string `Dell`, it was the *JSON value* `"Dell"`, quotes included. And `"Dell" = 'Dell'` is not always the match you'd expect once you start layering more comparisons or concatenation on top.

That's the whole reason MySQL gives you two different extraction operators instead of one.

- **`->`** is shorthand for `JSON_EXTRACT()`. It hands you back a JSON value — and JSON strings are always wrapped in quotes.
- **`->>`** is shorthand for `JSON_UNQUOTE(JSON_EXTRACT())`. It strips those quotes off and hands you back a plain string.

Think of `->` as "reach into the document and hand me the value, still shrink-wrapped in its JSON packaging" and `->>` as "reach in, and also unwrap it for me."

```sql
-- -> extracts as JSON value (with quotes for strings)
SELECT attributes->'$.brand' FROM products;
-- Result: "Dell"   (with quotes)

-- ->> extracts as unquoted string (alias for JSON_UNQUOTE(JSON_EXTRACT()))
SELECT attributes->>'$.brand' FROM products;
-- Result: Dell    (no quotes)

-- Nested path
SELECT attributes->>'$.specs.ram' FROM products WHERE name = 'Laptop';
-- Result: 16

-- Array element
SELECT attributes->>'$.tags[0]' FROM products WHERE name = 'Laptop';
-- Result: laptop
```

**When do you actually reach for which one?**

| | `->` (JSON_EXTRACT) | `->>` (JSON_UNQUOTE + JSON_EXTRACT) |
|---|---|---|
| Returns | JSON value — strings keep their quotes | Plain unquoted string/scalar |
| Use for | Feeding the result into another JSON function that expects JSON | `WHERE` comparisons, displaying to a user, concatenating with other strings |
| Example | `attributes->'$.brand'` → `"Dell"` | `attributes->>'$.brand'` → `Dell` |
| Rule of thumb | Rarely what you want at the end of a query | Almost always what you want at the end of a query |

If you remember nothing else: reach for `->>` by default, and only drop to `->` when you specifically need the JSON-typed value (for example, passing it straight into `JSON_CONTAINS`, which expects JSON on both sides).

> **Memory hook:** "`->` hands you the gift still in its wrapping paper. `->>` tears the wrapping off." One arrow, one layer of packaging left on; two arrows, fully unwrapped.

### JSON_EXTRACT()

`->` is just syntax sugar over the underlying function, `JSON_EXTRACT()` — spelled out in full, it looks like this:

```sql
SELECT JSON_EXTRACT(attributes, '$.brand') FROM products;
SELECT JSON_EXTRACT(attributes, '$.tags[*]') FROM products;

-- Multiple paths
SELECT JSON_EXTRACT(attributes, '$.brand', '$.specs.ram') FROM products;
-- Returns JSON array: ["Dell", 16]
```

### Filtering on JSON Fields

Now that you know why `->>` is the one you want for comparisons, filtering reads naturally:

```sql
-- WHERE on JSON field
SELECT name FROM products
WHERE attributes->>'$.brand' = 'Dell';

-- Numeric comparison
SELECT name FROM products
WHERE attributes->'$.specs.ram' >= 16;

-- JSON_CONTAINS: check if JSON contains a value
SELECT name FROM products
WHERE JSON_CONTAINS(attributes->'$.tags', '"laptop"');
-- Note: value must be valid JSON, so strings need quotes

-- JSON_CONTAINS_PATH: check if path exists
SELECT name FROM products
WHERE JSON_CONTAINS_PATH(attributes, 'one', '$.specs.gpu');
-- 'one' = at least one of the paths exists
-- 'all' = all of the paths exist
```

---

## 5. Modifying JSON

Here's the other thing JSON columns give you that a plain `TEXT` column never could: you can update *one field* inside the document without reading the whole thing into your app, editing it, and writing the entire blob back. MySQL has a small family of functions for this, and the names tell you exactly what each one is willing to do:

### JSON_SET — Set (insert or update)

```sql
UPDATE products
SET attributes = JSON_SET(attributes, '$.specs.ram', 32)
WHERE name = 'Laptop';

-- Add a new key
UPDATE products
SET attributes = JSON_SET(attributes, '$.in_stock', true)
WHERE name = 'Laptop';
```

### JSON_INSERT — Insert only (won't overwrite)

```sql
UPDATE products
SET attributes = JSON_INSERT(attributes, '$.warranty_years', 2)
WHERE name = 'Laptop';
-- Only inserts if $.warranty_years doesn't exist
```

### JSON_REPLACE — Replace only (won't create new key)

```sql
UPDATE products
SET attributes = JSON_REPLACE(attributes, '$.brand', 'HP')
WHERE name = 'Laptop';
-- Only updates if $.brand exists
```

### JSON_REMOVE — Remove a key/element

```sql
UPDATE products
SET attributes = JSON_REMOVE(attributes, '$.tags[1]')
WHERE name = 'Laptop';
-- Removes the second element from tags array

UPDATE products
SET attributes = JSON_REMOVE(attributes, '$.in_stock')
WHERE name = 'Laptop';
-- Removes the in_stock key
```

### JSON_ARRAY_APPEND

```sql
UPDATE products
SET attributes = JSON_ARRAY_APPEND(attributes, '$.tags', 'sale')
WHERE name = 'Laptop';
-- Appends 'sale' to the tags array
```

---

## 6. JSON Functions Reference

Beyond reading and writing paths, MySQL ships a grab-bag of utility functions for inspecting a JSON document's shape — what type is at a path, how many keys does it have, is it even valid JSON in the first place. You won't use all of these every day, but it's worth knowing they exist:

```sql
-- Type checking
JSON_TYPE(attributes)          -- "OBJECT", "ARRAY", "STRING", "INTEGER", etc.
JSON_VALID('{"a":1}')          -- 1 (true)
JSON_VALID('{bad}')            -- 0 (false)

-- Structure info
JSON_KEYS(attributes)          -- ["brand","specs","tags"]
JSON_LENGTH(attributes)        -- number of keys (object) or elements (array)
JSON_DEPTH(attributes)         -- max nesting depth

-- Formatting
JSON_PRETTY(attributes)        -- human-readable formatted JSON

-- Search
JSON_SEARCH(attributes, 'one', 'Dell')  -- returns path: "$.brand"

-- Merging
JSON_MERGE_PATCH('{"a":1}', '{"b":2}')  -- {"a":1,"b":2}
JSON_MERGE_PRESERVE('{"a":[1]}', '{"a":[2]}')  -- {"a":[1,2]}
```

---

## 7. Indexing JSON (Generated Columns)

You've now got thousands of products, and you're running `WHERE attributes->>'$.brand' = 'Dell'` on the reg. That query has to open every single row's JSON document, extract `$.brand`, and check it — a full table scan, every time. Add a normal index on the `attributes` column? MySQL won't let you — a JSON column can't be indexed directly, because an index needs a fixed, comparable value to sort and look up, not an entire nested document.

So are you stuck choosing between "keep the JSON flexibility" and "get fast lookups"? No — MySQL has a neat trick for exactly this: a **generated column**.

**The idea, in one sentence:** you tell MySQL "compute this column's value from an expression, keep it in sync automatically, and I'll index *that* instead of the raw JSON."

Here's what's actually happening under the hood:

```
                     products table
        ┌───────────────────────────────────────────┐
        │  attributes (JSON)     │  brand (VIRTUAL)  │
        │  ─────────────────     │  ───────────────  │
        │  {"brand":"Dell",...}  │  "Dell"  ◄─────────┼── computed on read from
        │  {"brand":"Apple",...} │  "Apple" ◄─────────┤   attributes->>'$.brand'
        │  {"brand":"Samsung"...}│  "Samsung"◄────────┘
        └───────────────────────────────────────────┘
                                          │
                                          ▼
                          CREATE INDEX idx_brand ON products(brand)
                                          │
                                          ▼
                     A normal B-tree index, just like on any VARCHAR column
                     — because `brand` IS just a normal scalar column,
                     it's simply never typed in directly by hand.
```

The JSON column stays exactly as flexible as before — you can still add a `waterproof` key to some future product without touching the schema. But for the one or two JSON fields you actually filter on all the time, you carve out a real, indexable column that MySQL keeps perfectly in sync for you.

```sql
ALTER TABLE products
  ADD COLUMN brand VARCHAR(100)
    GENERATED ALWAYS AS (attributes->>'$.brand') VIRTUAL;

CREATE INDEX idx_brand ON products(brand);

-- Now this query uses the index:
SELECT * FROM products WHERE brand = 'Dell';
-- Without the generated column: full table scan on JSON
```

Notice you never write to `brand` directly — you can't, it's `GENERATED ALWAYS`. Insert or update `attributes`, and `brand` recalculates itself automatically. `VIRTUAL` means it's computed on the fly at read time rather than stored on disk (there's also a `STORED` option that persists the computed value, trading a little extra disk space for slightly less CPU per read — either works fine for indexing).

The same trick works for numbers — just remember JSON numbers need an explicit `CAST` to become a proper numeric column:

```sql
-- For numeric fields:
ALTER TABLE products
  ADD COLUMN ram_gb INT
    GENERATED ALWAYS AS (CAST(attributes->>'$.specs.ram' AS UNSIGNED)) VIRTUAL;

CREATE INDEX idx_ram ON products(ram_gb);

SELECT * FROM products WHERE ram_gb >= 16;
```

**Zooming out — when should this data even be JSON?** Now that you've seen the indexing workaround, it's worth being honest about its limits. Here's how the three options actually compare:

| | Real relational columns | JSON column (+ generated column if indexed) | Document database (e.g. MongoDB) |
|---|---|---|---|
| Best for | Fixed, predictable fields you filter/join/sort on constantly | A handful of optional/variable fields per row, occasionally filtered | An entire record's shape varies, and *most* of your querying is document-shaped |
| Indexing | Native, first-class | Only via a generated column per path you care about | Native on any field, including inside arrays/nested docs |
| Schema flexibility | None — every new field is a migration | High — new keys need no migration | Highest — no fixed schema at all |
| Joins | Native, fast | Still works — the table is still relational | Limited (`$lookup`), often denormalized instead |
| When it's the wrong choice | Attributes genuinely vary wildly per row | You're filtering/sorting on the same JSON path for most of your queries | Your data is fundamentally tabular with strong relational integrity needs |

The takeaway: JSON columns are the "escape hatch" for the *few* fields that are genuinely variable, inside a table that's otherwise perfectly relational. If you notice most of your columns are turning into JSON, or you're indexing five different generated columns off the same JSON blob, that's a sign the data wants to be either real columns or a genuinely different database — not a sign to add more generated columns.

**Common mistakes to watch for:**
- Trying to `CREATE INDEX` directly on the JSON column itself and being surprised when MySQL refuses — you always need the generated-column detour.
- Filtering with `EXPLAIN` never checked. Always run `EXPLAIN SELECT ...` after adding the index to confirm MySQL is actually using it and not silently falling back to a full scan (Exercise 3 below has you do exactly this).
- Reaching for JSON + generated columns for data you filter, join, and sort on constantly — at that point you've reinvented a real column with extra steps, and you'd be better off just normalizing it into its own proper column from the start.

> **Memory hook:** "You can't put a lock on a filing cabinet drawer full of loose papers — but you can pin one important page to the front of the drawer and lock *that*."

---

## 8. JSON Aggregation

Sometimes you want to go the other direction — take rows from a normal relational query and package them up as JSON, ready to hand straight to a frontend or an API response.

```sql
-- Build JSON array of results
SELECT JSON_ARRAYAGG(name) FROM products;
-- ["Laptop","Phone","Tablet"]

-- Build JSON object of key-value pairs
SELECT JSON_OBJECTAGG(name, attributes->>'$.brand') FROM products;
-- {"Laptop":"Dell","Phone":"Apple","Tablet":"Samsung"}

-- Combine with GROUP BY
SELECT
  attributes->>'$.brand' AS brand,
  JSON_ARRAYAGG(name) AS product_names,
  COUNT(*) AS count
FROM products
GROUP BY brand;
```

---

## 9. Hands-On Exercises

**Exercise 1:** Create a `users` table with a `preferences` JSON column. Insert 5 users with different JSON preferences (theme, language, notifications). Query users where `theme = 'dark'`.

**Exercise 2:** Update a specific nested JSON field (`$.address.city`) for one user without replacing the entire JSON document.

**Exercise 3:** Create a generated virtual column for a frequently queried JSON field and index it. Run EXPLAIN to verify the index is used.

**Exercise 4:** Use `JSON_ARRAY_APPEND` to add a new tag to a product's tags array. Use `JSON_REMOVE` to remove a specific array element by index.

**Exercise 5:** Use `JSON_ARRAYAGG` and `JSON_OBJECTAGG` to build aggregated JSON result sets for a reporting query.

---

## 10. Interview Q&A

**Q: What is the advantage of MySQL's JSON type over TEXT?**
Answer: The JSON type validates on insert (rejects invalid JSON), stores data in optimized binary format for efficient reads, and supports path-based functions for querying and modifying individual fields without rewriting the entire document. TEXT stores JSON as a plain string with no validation or path support.

**Q: What is the difference between `->` and `->>` in MySQL?**
Answer: `->` (JSON_EXTRACT) returns the JSON-encoded value — strings have surrounding quotes. `->>`  (JSON_UNQUOTE + JSON_EXTRACT) returns the unquoted string value. For comparisons and display, `-->>` is usually what you want. Example: `col->'$.name'` returns `"Alice"`, `col->>'$.name'` returns `Alice`.

**Q: Can you index a JSON column in MySQL?**
Answer: Not directly. But you can create a virtual generated column that extracts a specific path from the JSON, then index that column. This lets MySQL use the index for WHERE clauses filtering on that JSON field. The generated column doesn't store extra data (VIRTUAL) but is computed on read.

**Q: When should you use JSON in MySQL vs proper columns?**
Answer: Use proper columns for structured, frequently-queried data that benefits from indexing and joins. Use JSON for semi-structured data where schema varies per row, configuration/preferences, or when the structure evolves rapidly and you want schema flexibility. Avoid JSON for fields you filter on heavily — use generated column indexes if needed.

**Q: What is JSON_MERGE_PATCH vs JSON_MERGE_PRESERVE?**
Answer: JSON_MERGE_PATCH follows RFC 7396 — duplicate keys in the second document overwrite the first. JSON_MERGE_PRESERVE keeps both values by merging arrays. For example: `MERGE_PATCH('{"a":1}', '{"a":2}')` → `{"a":2}`. `MERGE_PRESERVE('{"a":1}', '{"a":2}')` → `{"a":[1,2]}`.
