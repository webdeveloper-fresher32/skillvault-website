# MySQL Data Types — Complete Reference

> "Pick the wrong data type once, and you'll be paying for it forever — in wasted disk space, silent truncation, or rounding errors that show up in a customer's invoice."

Every column you create is a promise: "this is the shape of data that will live here." Get that promise wrong and you either waste space (an `INT` where a `TINYINT` would do), lose data (a `VARCHAR(10)` that truncates a longer name), or get silently wrong numbers (a `FLOAT` used for money). This file walks through every MySQL data type family with the reasoning behind *when* and *why* you'd reach for each one — not just a dictionary of names and byte counts.

## Table of Contents
1. [Integer Types](#1-integer-types)
2. [Decimal & Floating Point](#2-decimal--floating-point)
3. [String Types](#3-string-types)
4. [Date & Time Types](#4-date--time-types)
5. [Boolean](#5-boolean)
6. [JSON Type](#6-json-type)
7. [ENUM and SET](#7-enum-and-set)
8. [Type Selection Guide](#8-type-selection-guide)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Integer Types

**The problem it solves:** imagine every whole number in your database — ages, IDs, order counts, view counters — got stored the same fixed-size way. A column storing someone's `age` (never bigger than ~120) would reserve the same 8 bytes as a column storing a global population count in the billions. Multiply that waste across a million rows and you've burned a huge chunk of disk and RAM for nothing. Integer types exist so you can pick a "container" that's just big enough for what you're actually storing.

**Analogy:** think of it like choosing a box size when you ship something. You wouldn't put a single pair of earrings in a moving box — and you wouldn't try to cram a couch into a shoebox either. MySQL gives you five box sizes for whole numbers; you pick the smallest one that still fits every value you'll ever need.

**Definition:** MySQL offers five integer types, differing only in how many bytes they use and therefore what range of numbers they can hold.

| Type | Bytes | Signed Range | Unsigned Range | Use For |
|------|-------|-------------|----------------|---------|
| TINYINT | 1 | -128 to 127 | 0 to 255 | flags, status codes |
| SMALLINT | 2 | -32,768 to 32,767 | 0 to 65,535 | small counters |
| MEDIUMINT | 3 | -8.4M to 8.4M | 0 to 16.7M | medium-sized IDs |
| INT / INTEGER | 4 | -2.1B to 2.1B | 0 to 4.3B | most IDs, counts |
| BIGINT | 8 | ±9.2 quintillion | 0 to 18.4 quintillion | large IDs, unix timestamps |

**Example:**

```sql
id         INT          UNSIGNED NOT NULL AUTO_INCREMENT  -- common PK pattern
age        TINYINT      UNSIGNED                          -- 0-255
population BIGINT       UNSIGNED                          -- large numbers
score      SMALLINT                                       -- -32k to 32k
```

**UNSIGNED** doubles the positive range by removing negative values entirely. Use it whenever a negative value would be logically meaningless — nobody has an age of -5, an ID of -1, or a count of -10.

**Common mistake:** writing `INT(11)` and assuming the `11` limits the values that fit. It doesn't — that number is only a *display width* hint for padding output, not a storage size or a maximum value cap. It's been deprecated in MySQL 8.0 precisely because it confuses people this way.

**Interview answer:** "MySQL's integer types differ only in storage size and therefore range — TINYINT (1 byte) through BIGINT (8 bytes). You pick the smallest type that comfortably covers every value the column will ever hold, because oversizing wastes storage and index space across every row. UNSIGNED trades away negative numbers for double the positive range, which is a free win for columns like IDs, ages, and counts that are never negative."

> **Memory hook:** "Don't ship a single earring in a couch-sized box — pick the smallest container that still fits."

---

## 2. Decimal & Floating Point

**The problem it solves:** picture a payments system that stores prices as regular floating-point numbers. A customer buys two items at $0.10 and $0.20. Your total comes out to `$0.30000000000000004`. That's not a hypothetical — it's exactly what `0.1 + 0.2` returns in ordinary binary floating point, because some decimal fractions simply cannot be represented exactly in binary, the same way `1/3` can't be written exactly in decimal. For scientific measurements, that tiny error is irrelevant. For a bank balance or an invoice total, it's a bug report waiting to happen.

**Analogy:** think of DECIMAL as writing numbers out longhand on paper, digit by digit — exact, no shortcuts. FLOAT/DOUBLE are like measuring with a ruler that's *approximately* accurate — great for a science experiment, useless for a receipt where the customer will notice if the cents are wrong.

### DECIMAL (Exact Numeric)

**Basic definition:** `DECIMAL(p, s)` stores numbers as exact digit sequences, not as approximated binary floating point.
- `p` = total digits (precision)
- `s` = digits after the decimal point (scale)

**How it avoids rounding errors internally:** instead of converting your number into binary fractions (which can't exactly represent most decimal fractions), MySQL stores DECIMAL values digit-by-digit, much like you'd write them on paper:

```
DECIMAL(10,2) storing 123.45
        │
        ▼
  digits: [1][2][3] . [4][5]
        │
        ▼
  stored and computed as exact decimal digits —
  never converted to imprecise binary fractions
```

Because there's no binary conversion step, `0.10 + 0.20` really does equal `0.30` — exactly.

**Example:**

```sql
price      DECIMAL(10, 2)   -- up to 99,999,999.99
tax_rate   DECIMAL(5, 4)    -- e.g. 0.1500 (15%)
latitude   DECIMAL(9, 6)    -- e.g. -33.868900
```

Use DECIMAL for **money, financial data, GPS coordinates** — anywhere an exact value matters more than raw computation speed.

### FLOAT and DOUBLE (Approximate)

| Type | Bytes | Precision | Use For |
|------|-------|-----------|---------|
| FLOAT | 4 | ~7 significant digits | scientific approximations |
| DOUBLE | 8 | ~15 significant digits | higher precision floats |

**Compare DECIMAL vs FLOAT/DOUBLE:**

| Feature | DECIMAL | FLOAT / DOUBLE |
|---------|---------|-----------------|
| Storage | Exact digit string | Binary approximation |
| Rounding errors | None | Yes, for many decimal fractions |
| Speed | Slightly slower | Faster (native CPU floating point) |
| Use for | Money, financial data, coordinates | Scientific/statistical approximations |

**Common mistake — the classic rounding trap:**

```sql
-- NEVER use FLOAT/DOUBLE for money!
SELECT 0.1 + 0.2;  -- returns 0.30000000000000004 (floating point imprecision)

-- Always use DECIMAL for money:
SELECT CAST(0.1 AS DECIMAL(10,2)) + CAST(0.2 AS DECIMAL(10,2));  -- returns 0.30
```

**Interview answer:** "DECIMAL stores numbers as exact decimal digit sequences, so it never suffers the binary rounding errors that FLOAT and DOUBLE do — `0.1 + 0.2` is exactly `0.3` under DECIMAL but `0.30000000000000004` under floating point. Use DECIMAL for money, invoices, and anything where exactness matters legally or financially; reserve FLOAT/DOUBLE for scientific or statistical values where a tiny approximation error is acceptable and speed matters more."

> **Memory hook:** "DECIMAL writes the number out longhand, digit by digit — FLOAT eyeballs it with a ruler."

---

## 3. String Types

**The problem it solves:** text isn't one-size-fits-all either. A country code is always exactly 2 characters; a person's name could be 3 characters or 80. A comment might be a sentence; a blog post might be 10,000 words. If you store everything in one generic "text" column, you either waste space padding short fixed values, or you cap long content too aggressively and truncate it. MySQL splits string storage into several types precisely so you can match the container to the content.

### CHAR vs VARCHAR

**Analogy:** CHAR is like a name tag with a pre-printed fixed-width box — "AU" and "US" always take up exactly the same slot, padded with blanks if needed. VARCHAR is like a sticky note — it only uses as much space as the actual text, plus a little note-to-self recording how long the text is.

**Internal working:** VARCHAR's storage overhead comes from that length prefix — MySQL stores 1 extra byte (for strings up to 255 bytes) or 2 extra bytes (beyond that) recording the actual length, then only that many bytes of content:

```
VARCHAR(100) storing "Alice"
   [length: 5][A][l][i][c][e]
   → 6 bytes total, not 100

CHAR(100) storing "Alice"
   [A][l][i][c][e][ ][ ][ ]...[ ]   (padded with spaces to 100)
   → 100 bytes total, always
```

**Compare CHAR vs VARCHAR:**

| Feature | CHAR(n) | VARCHAR(n) |
|---------|---------|------------|
| Storage | Always n bytes (padded) | Actual length + 1-2 bytes |
| Max n | 255 | 65,535 |
| Speed | Slightly faster (fixed) | Slightly slower (variable) |
| Use for | Fixed-length: codes, hashes | Variable: names, emails |

**Example:**

```sql
country_code  CHAR(2)        -- always 'AU', 'US' — fixed 2 chars
gender        CHAR(1)        -- 'M', 'F'
name          VARCHAR(100)   -- variable length
email         VARCHAR(255)   -- variable length
password_hash CHAR(60)       -- bcrypt hashes are always 60 chars
```

**Memory hook for this pair:**

> **Memory hook:** "CHAR is a name tag with a fixed-size box — VARCHAR is a sticky note sized to fit."

### TEXT Family

**The problem it solves:** VARCHAR tops out at 65,535 bytes and, more importantly, isn't meant for holding entire articles or documents — you need dedicated types for genuinely large blocks of text, with size tiers matched to how much content you're actually storing.

| Type | Max Size | Use For |
|------|----------|---------|
| TINYTEXT | 255 bytes | Short descriptions |
| TEXT | 65 KB | Articles, comments |
| MEDIUMTEXT | 16 MB | Blog posts, HTML |
| LONGTEXT | 4 GB | Full book content |

```sql
-- TEXT types cannot have DEFAULT values (except DEFAULT NULL)
-- TEXT types cannot be fully indexed (must use prefix index)
body      TEXT          -- blog post content
html      MEDIUMTEXT    -- rendered HTML
```

**Common mistake:** trying to put a `DEFAULT` value on a TEXT column, or trying to index it the way you'd index a VARCHAR. Neither works directly — TEXT columns can only default to `NULL`, and indexing requires a prefix index (covered in the ENUM/TEXT interview answer below).

### BINARY and BLOB

**The problem it solves:** sometimes what you're storing isn't human-readable text at all — it's raw bytes: an image, a file checksum, an encrypted blob. Comparing these byte-by-byte (case-sensitively, with no character-set interpretation) is exactly what BINARY/BLOB types are for — they're the byte-oriented siblings of CHAR/VARCHAR/TEXT.

```sql
avatar     BLOB          -- binary image data (prefer storing files on disk + URL in DB)
checksum   BINARY(32)    -- fixed-length binary hash
```

---

## 4. Date & Time Types

**The problem it solves:** imagine a global app with users in Sydney, London, and New York. A user in Sydney creates a record at "2026-07-14 09:00" — but 9am *whose* time? If you store that literally with no timezone awareness, a user in London reading it back has no idea whether that's their 9am or a completely different moment. On the other hand, if you're storing a conference date fixed for 2050, you don't want any timezone conversion touching it — it should mean exactly what was typed, forever. MySQL gives you two different date-time types precisely because these are two genuinely different problems.

**Analogy:** think of TIMESTAMP like a flight departure time shown on an airport board — it's silently converted to whatever timezone you're standing in, because a UTC instant is what it *really* represents. DATETIME is more like a handwritten appointment in a diary — "July 14th, 9 AM" — no conversion, no interpretation, just exactly what was written down.

**Basic definition:** MySQL has five temporal types, split between "no timezone awareness" (DATE, TIME, DATETIME, YEAR) and "UTC-based, timezone-converting" (TIMESTAMP).

| Type | Bytes | Format | Range | Timezone |
|------|-------|--------|-------|---------|
| DATE | 3 | YYYY-MM-DD | 1000-01-01 to 9999-12-31 | None |
| TIME | 3 | HH:MM:SS | -838:59:59 to 838:59:59 | None |
| DATETIME | 8 | YYYY-MM-DD HH:MM:SS | 1000-01-01 to 9999-12-31 | None |
| TIMESTAMP | 4 | YYYY-MM-DD HH:MM:SS | 1970-01-01 to 2038-01-19 | UTC |
| YEAR | 1 | YYYY | 1901 to 2155 | None |

### DATETIME vs TIMESTAMP — Critical Differences

**How TIMESTAMP's conversion actually works internally:**

```
Write path:
  App inserts "2026-07-14 09:00:00" (session timezone: Australia/Sydney)
        │
        ▼
  MySQL converts to UTC before storing: "2026-07-13 23:00:00" UTC

Read path:
  A session in London reads the same row
        │
        ▼
  MySQL converts UTC back to London's local time before displaying it
```

DATETIME skips both conversion steps entirely — whatever string you insert is exactly the string you get back, no matter which timezone the reading session is in.

```sql
-- TIMESTAMP: stored as UTC, displayed in server's local timezone
-- DATETIME: stored exactly as-is, no timezone conversion

-- Common pattern: use TIMESTAMP for audit columns
created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

-- Use DATETIME for future dates or dates before 1970
event_date  DATETIME    -- conference in 2050 — TIMESTAMP can't store past 2038!
birth_date  DATE        -- just the date, no time needed
```

**Compare DATETIME vs TIMESTAMP:**

| Feature | DATETIME | TIMESTAMP |
|---------|----------|-----------|
| Storage | 8 bytes | 4 bytes |
| Timezone | Stored as-is, no conversion | Converted to/from UTC |
| Range | 1000 to 9999 | 1970 to 2038 |
| Typical use | Birthdates, future events, business dates | created_at/updated_at audit columns |

**Common mistake:** reaching for TIMESTAMP for a future-dated event (like a 2050 conference) and hitting the 2038 range wall — the classic "Year 2038 problem," the same 32-bit limit that famously affected Unix time. Another common trap: assuming DATETIME is "timezone aware" just because it looks like a date-time value — it isn't; it's stored and returned completely literally.

**Interview answer:** "TIMESTAMP is stored internally as UTC and converted to the session's local timezone whenever it's read back, but it's limited to the 1970–2038 range due to its 32-bit storage. DATETIME stores exactly what you insert with zero timezone conversion, and supports a far wider range, 1000 to 9999. The practical rule: use TIMESTAMP for audit columns like created_at/updated_at where 'when did this really happen, in absolute terms' matters; use DATETIME for things like birthdates or future-dated events where you want the literal value preserved, or where the date might fall outside TIMESTAMP's range."

> **Memory hook:** "TIMESTAMP is an airport departure board — it re-converts for whoever's watching. DATETIME is a handwritten diary entry — it never changes what it says."

### Useful Date Functions

```sql
SELECT NOW();                          -- 2026-06-24 14:30:00
SELECT CURDATE();                      -- 2026-06-24
SELECT DATE_FORMAT(NOW(), '%d/%m/%Y'); -- 24/06/2026
SELECT DATEDIFF('2026-12-31', NOW());  -- days until end of year
SELECT DATE_ADD(NOW(), INTERVAL 7 DAY); -- next week
SELECT YEAR(NOW()), MONTH(NOW()), DAY(NOW());
```

---

## 5. Boolean

**The problem it solves:** you need a simple yes/no, on/off flag — `is_active`, `is_verified` — but MySQL, unlike many languages, doesn't have a dedicated true boolean storage type under the hood.

**Definition:** `BOOLEAN` is really just an alias for `TINYINT(1)` in MySQL — it's syntactic sugar, not a distinct type.

```sql
is_active    BOOLEAN DEFAULT TRUE   -- stored as TINYINT(1), value 1 or 0
is_verified  TINYINT(1) DEFAULT 0   -- equivalent

-- Querying
SELECT * FROM users WHERE is_active = TRUE;   -- works
SELECT * FROM users WHERE is_active = 1;      -- same thing
SELECT * FROM users WHERE is_active;          -- also works (truthy)
```

> **Memory hook:** "BOOLEAN is just TINYINT(1) wearing a friendlier name tag."

---

## 6. JSON Type

**The problem it solves:** some data genuinely doesn't fit a fixed set of columns. A `products` table might sell laptops (RAM, CPU) and shoes (size, color) side by side — attributes vary wildly per row. Rather than a sea of nullable columns, or a separate lookup table for every possible attribute, sometimes the pragmatic answer is: just store a flexible blob of structured data.

**Analogy:** a JSON column is like a labeled folder you can drop any shaped document into — unlike a filing cabinet with fixed-size slots, the folder just expands to hold whatever you put in it, while still letting you search inside it by label.

**Definition:** introduced in MySQL 5.7, `JSON` stores validated JSON in an efficient binary format (not just as plain text) — MySQL rejects anything that isn't syntactically valid JSON, and you can query directly into its structure.

**Example:**

```sql
CREATE TABLE products (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(200),
  metadata JSON                    -- flexible attributes
);

INSERT INTO products (name, metadata) VALUES (
  'Laptop',
  '{"brand": "Dell", "specs": {"ram": 16, "storage": 512}, "tags": ["electronics", "sale"]}'
);

-- Extract values
SELECT metadata->>'$.brand' AS brand FROM products;          -- Dell
SELECT metadata->>'$.specs.ram' AS ram FROM products;        -- 16
SELECT metadata->>'$.tags[0]' AS first_tag FROM products;   -- electronics

-- Index JSON via generated column
ALTER TABLE products
  ADD COLUMN brand VARCHAR(100) AS (metadata->>'$.brand') STORED;
CREATE INDEX idx_brand ON products(brand);
```

Notice that last block: you can't directly index inside a JSON document, but you can carve out a **generated column** that mirrors one JSON field, then index *that* column normally — the best of both worlds.

> **Memory hook:** "JSON is a labeled folder for oddly-shaped documents — generated columns are the sticky tabs that make one page in it searchable."

---

## 7. ENUM and SET

**The problem it solves:** you have a column that should only ever hold one of a small, known set of values — an order's `status`, say. You could use a plain VARCHAR and hope nobody typos `'shpped'` instead of `'shipped'`, or you could get MySQL to enforce the valid list for you at the column level.

**Analogy:** ENUM is like a multiple-choice question where you can only circle one answer. SET is a multiple-choice question where you're allowed to circle several answers at once.

**Definition:**
- `ENUM` restricts a column to exactly **one** value from a predefined list.
- `SET` allows **one or more** values from a predefined list, stored internally as a bitmask (each possible value is a bit — combining values is just combining bits).

```sql
-- ENUM: exactly ONE value from a list
status  ENUM('pending','active','inactive','banned') DEFAULT 'pending'

-- SET: ONE OR MORE values from a list (stored as bitmask)
permissions  SET('read','write','delete','admin')

-- Usage
INSERT INTO users (status, permissions) VALUES ('active', 'read,write');
SELECT * FROM users WHERE FIND_IN_SET('write', permissions);
```

**Common mistake / pitfall:** ENUM values feel like they should be as easy to change as a VARCHAR value, but they're not — adding or removing a value from the list requires an `ALTER TABLE`, which can be slow (and lock the table) once it has millions of rows. If the list of valid values is likely to grow or change over time (say, order statuses evolving as the business changes), a lookup table with a foreign key is more flexible than baking the list into the column definition itself.

**Interview answer:** "ENUM stores one value from a predefined list; SET stores any combination of values from a predefined list, using a bitmask internally. Both enforce validity at the database level, which VARCHAR can't. The tradeoff is flexibility — changing an ENUM/SET's allowed values requires an ALTER TABLE, which is risky on large, high-traffic tables, so a reference/lookup table is usually preferred when the set of valid values changes frequently."

> **Memory hook:** "ENUM: circle exactly one answer. SET: circle as many as apply."

---

## 8. Type Selection Guide

```
What are you storing?
│
├── A whole number (count, ID, age)?
│   ├── 0-255 → TINYINT UNSIGNED
│   ├── Up to ~2 billion → INT
│   └── Larger → BIGINT
│
├── A decimal number?
│   ├── Money / exact → DECIMAL(p,s)
│   └── Scientific / approximate → FLOAT or DOUBLE
│
├── Text?
│   ├── Fixed length (codes, hashes) → CHAR(n)
│   ├── Variable short-medium (names, emails) → VARCHAR(n)
│   └── Long content (articles, HTML) → TEXT / MEDIUMTEXT
│
├── Date/time?
│   ├── Date only → DATE
│   ├── Date+time, no timezone → DATETIME
│   └── Auto-tracking, timezone-aware → TIMESTAMP
│
├── True/False → BOOLEAN (TINYINT(1))
├── JSON data → JSON
└── One of a list → ENUM; Multiple from list → SET
```

---

## 9. Hands-On Exercises

**Exercise 1:** Create an `orders` table with: id (INT PK), customer_id (INT), total (DECIMAL 10,2), status (ENUM: pending/paid/shipped/cancelled), created_at (TIMESTAMP auto), notes (TEXT nullable).

**Exercise 2:** Try inserting 0.1 + 0.2 using FLOAT vs DECIMAL — observe the difference in precision.

**Exercise 3:** Create a `profiles` table with a JSON `settings` column. Insert a row with settings like `{"theme":"dark","notifications":true}`. Query to extract the theme value.

**Exercise 4:** Create a table with a TIMESTAMP `updated_at` column with ON UPDATE CURRENT_TIMESTAMP. Update a row and verify the timestamp changes automatically.

**Exercise 5:** What is the storage size difference between `VARCHAR(255)` storing a 10-character string vs `CHAR(255)` storing the same? Calculate both.

---

## 10. Interview Q&A

**Q: When should you use DECIMAL instead of FLOAT?**
Answer: Always use DECIMAL for monetary values and anything requiring exact precision. FLOAT and DOUBLE are approximate — they cannot represent fractions like 0.1 exactly in binary. DECIMAL stores digits as exact strings, so 0.10 + 0.20 = 0.30, not 0.30000000000000004.

**Q: What is the difference between DATETIME and TIMESTAMP?**
Answer: TIMESTAMP is stored in UTC and converted to the session timezone on retrieval, with a range limited to 2038 (Unix 32-bit limit). DATETIME stores the exact value you insert with no timezone awareness, supporting dates from year 1000 to 9999. Use TIMESTAMP for created_at/updated_at; use DATETIME for future dates.

**Q: Why not always use BIGINT for all integer IDs?**
Answer: BIGINT uses 8 bytes vs INT's 4 bytes. For most tables, INT unsigned (0-4.3 billion rows) is more than enough. Using BIGINT unnecessarily wastes storage, increases index size, and can slow down joins. Switch to BIGINT only when approaching INT's limit.

**Q: What is the ENUM type and what are its drawbacks?**
Answer: ENUM stores one value from a predefined list. The drawback is that adding or removing valid values requires ALTER TABLE, which can lock the table on large datasets. A reference/lookup table with a foreign key is more flexible for values that evolve over time.

**Q: Can you index a TEXT or BLOB column?**
Answer: Not directly — you must use a prefix index specifying how many characters to index: `CREATE INDEX idx ON t(body(100))`. This indexes only the first 100 characters. Full-text search on TEXT columns requires a FULLTEXT index instead.
