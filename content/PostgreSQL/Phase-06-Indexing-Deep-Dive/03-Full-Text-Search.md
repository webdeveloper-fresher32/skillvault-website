# 03 — Native PostgreSQL Full-Text Search

## Table of Contents
1. [Why `LIKE '%keyword%'` Fails in Production](#1-why-like-keyword-fails-in-production)
2. [The Full-Text Search Pipeline](#2-the-full-text-search-pipeline)
3. [The `tsvector` Data Type](#3-the-tsvector-data-type)
4. [The `tsquery` Data Type & Boolean Matching](#4-the-tsquery-data-type--boolean-matching)
5. [Weighting Fields (`setweight`)](#5-weighting-fields-setweight)
6. [Accelerating Full-Text Search with GIN](#6-accelerating-full-text-search-with-gin)
7. [Relevancy Ranking with `ts_rank` and `ts_rank_cd`](#7-relevancy-ranking-with-ts_rank-and-ts_rank_cd)
8. [Search Highlighting with `ts_headline`](#8-search-highlighting-with-ts_headline)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Summary & Key Takeaways](#10-summary--key-takeaways)

---

## 1. Why `LIKE '%keyword%'` Fails in Production

Using `WHERE description LIKE '%phone%'` exhibits critical flaws:
- **Forces Full Table Scan:** A leading wildcard (`%`) prevents B-Trees from seeking.
- **No Stemming:** Searching for `"running"` will not find rows containing `"run"`, `"runs"`, or `"ran"`.
- **No Stop Words:** Matches noisy common words like `"the"`, `"an"`, `"is"`.
- **No Relevance Ranking:** Cannot rank documents by keyword proximity or importance.

PostgreSQL includes a **native search engine** that provides Elasticsearch-like text capabilities directly inside SQL.

---

## 2. The Full-Text Search Pipeline

```
Raw Text: "The rapid foxes are jumping over lazy dogs"
     │
     ▼ 1. Parsing & Tokenization (identifies words, emails, numbers)
Tokens: ['The', 'rapid', 'foxes', 'are', 'jumping', 'over', 'lazy', 'dogs']
     │
     ▼ 2. Stop Words Filtering (removes 'The', 'are', 'over')
Filtered: ['rapid', 'foxes', 'jumping', 'lazy', 'dogs']
     │
     ▼ 3. Linguistic Stemming (Porter stemmer algorithm)
Lexemes: 'dog':8 'fox':3 'jump':5 'lazi':7 'rapid':2
```

---

## 3. The `tsvector` Data Type

A `tsvector` stores a sorted list of normalized, stemmed **lexemes** accompanied by their word positions:

```sql
SELECT to_tsvector('english', 'PostgreSQL powers millions of production web applications');
-- Output: 'applic':7 'million':4 'power':2 'postgresql':1 'product':5 'web':6
```

---

## 4. The `tsquery` Data Type & Boolean Matching

A `tsquery` represents the user's search query, supporting boolean logic and phrase proximity:

- `&` (AND)
- `|` (OR)
- `!` (NOT)
- `<->` (FOLLOWED BY / Exact Phrase Search)

```sql
-- Match operator (@@)
SELECT to_tsvector('english', 'PostgreSQL database indexing architecture')
    @@ to_tsquery('english', 'postgres & (index | tuning)');
-- Evaluates to TRUE!

-- Phrase Search: "high availability" (words immediately adjacent)
SELECT to_tsvector('english', 'PostgreSQL high availability cluster')
    @@ to_tsquery('english', 'high <-> availability');
-- Evaluates to TRUE!
```

---

## 5. Weighting Fields (`setweight`)

In real search engines, a match in the article **Title** is far more relevant than a match in the body.

PostgreSQL supports 4 weight categories: **A (Highest)**, **B**, **C**, and **D (Lowest)**.

```sql
CREATE TABLE knowledge_base (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    body TEXT NOT NULL,
    -- Store precomputed weighted tsvector in a generated column
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(body, '')), 'D')
    ) STORED
);
```

---

## 6. Accelerating Full-Text Search with GIN

Create a GIN index directly on the generated search vector:

```sql
CREATE INDEX idx_knowledge_search_gin 
ON knowledge_base USING gin (search_vector);
```

This index maps every stemmed English lexeme to the exact rows containing it, executing complex queries in under 5 milliseconds across millions of documents.

---

## 7. Relevancy Ranking with `ts_rank` and `ts_rank_cd`

Order search results by mathematical relevance:
- `ts_rank`: Ranks based on word frequency.
- `ts_rank_cd` (Cover Density): Ranks higher when search keywords appear close together in the text.

```sql
SELECT 
    title,
    ts_rank(search_vector, query) AS rank_score
FROM knowledge_base, 
     to_tsquery('english', 'distributed & consensus') query
WHERE search_vector @@ query
ORDER BY rank_score DESC
LIMIT 10;
```

---

## 8. Search Highlighting with `ts_headline`

Generate Google-style text snippet snippets with `<b>` highlight tags:

```sql
SELECT 
    title,
    ts_headline('english', body, to_tsquery('english', 'replication & failover'),
        'StartSel = <mark>, StopSel = </mark>, MaxWords = 35, MinWords = 15'
    ) AS snippet
FROM knowledge_base
WHERE search_vector @@ to_tsquery('english', 'replication & failover');
```

---

## 9. Hands-On Exercises

1. Create a `tech_articles` table with `id`, `title`, `content`, and a GIN index on `to_tsvector('english', title || ' ' || content)`.
2. Insert 5 articles about databases and cloud computing.
3. Write a search query that searches for `("database" | "sql") & "scale"`.
4. Rank the results using `ts_rank()` and generate a highlighted snippet using `ts_headline()`.

---

## 10. Summary & Key Takeaways

1. `to_tsvector` parses text into stemmed lexemes with position markers.
2. `to_tsquery` parses user queries with boolean (`&`, `|`, `!`) and proximity (`<->`) operators.
3. Use `setweight` to give titles priority over body paragraphs.
4. GIN indexes turn full-text queries into instant inverted-index lookups.
5. `ts_rank` and `ts_headline` deliver a complete, search-engine quality user experience without external infrastructure.
