# Lesson 1: pgvector Fundamentals

Man, welcome to Phase 7! In Phases 5 and 6, we used dedicated vector databases like Chroma and Pinecone. But what if your company already runs PostgreSQL for all its user and product data?

Do you really need to buy and manage a second database just for vectors? No! With **pgvector**, you can store and search vectors directly inside PostgreSQL tables.

---

### Step 1: Why Do We Need This?

Adding a separate, external vector database to an existing software stack introduces serious headaches:
1. **Data Synchronization Drift:** Your articles and users live in Postgres, but their embeddings live in an external vector DB. When a user edits an article or deletes their account, you must update two separate databases. If one write fails, data goes out of sync.
2. **Two Databases to Maintain:** Your DevOps team now has to manage backups, security patches, connection limits, and billing for two independent systems.
3. **No ACID Relational Joins:** You cannot easily run: *"Find the top 5 articles similar to this question, but ONLY from users with an active premium subscription."* You have to query the vector DB, fetch IDs, and then query Postgres to check subscriptions.

pgvector solves this by making vector search a native feature of PostgreSQL.

---

### Step 2: What Is It?

**pgvector** is an open-source extension for PostgreSQL that adds native support for vector similarity search.

It adds three core capabilities to Postgres:
1. **A new column type: `vector(dim)`:** Stores a list of floating-point numbers directly in a table row (e.g. `embedding vector(1536)`).
2. **Built-in Distance Operators:**
   - `<=>`: **Cosine Distance** (1 - cosine similarity). The standard for text search.
   - `<->`: **Euclidean (L2) Distance**. Straight-line ruler distance.
   - `<#>`: **Negative Inner Product**. Used for normalized dot products.
3. **Native SQL Integration:** You query vectors using standard SQL: `ORDER BY embedding <=> query_vector LIMIT 5`.

#### The Everyday Analogy: The Swiss Army Knife
- Carrying a dedicated standalone vector database is like buying a separate pocket knife when you already carry a Swiss Army knife.
- Installing pgvector is simply flipping open the scissor attachment on the Swiss Army knife you already carry in your pocket. One tool, zero extra baggage.

---

### Step 3: Real-World Example

Imagine an e-commerce platform with a `products` table in Postgres:

```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    price NUMERIC(10, 2),
    in_stock BOOLEAN DEFAULT TRUE,
    embedding vector(1536)  -- OpenAI embedding column
);
```

A customer searches: *"Lightweight running shoes for marathon training"*, and filters for items under $100 that are currently in stock.

With pgvector, you execute a **single SQL query**:
```sql
SELECT id, title, price
FROM products
WHERE price <= 100.00 AND in_stock = TRUE
ORDER BY embedding <=> '[0.015, -0.042, ...]'::vector
LIMIT 5;
```

Postgres filters the price and inventory, calculates vector similarity, and returns the top products in one atomic query.

---

### Step 4: How Does It Work?

Here is how pgvector executes inside PostgreSQL:

```
[SQL Query Submitted]
SELECT title FROM docs 
WHERE category = 'finance' 
ORDER BY embedding <=> query_vector 
LIMIT 3;
               │
[PostgreSQL Query Planner]
1. Relational Filter: Filters rows where category = 'finance'
2. Vector Calculation: Computes distance using <=> operator
3. Sort & Limit: Returns top 3 closest rows
               │
[Single ACID Result Set Returned]
```

#### Why `<=>` Measures Distance, Not Similarity:
In SQL, `ORDER BY` sorts from smallest to largest by default.
- Cosine **Similarity** ranges from 1.0 (best) to -1.0 (worst).
- Cosine **Distance** is `1 - similarity`. When vectors are identical, distance is **0.0** (smallest).
- Therefore, `ORDER BY embedding <=> query_vector LIMIT 5` naturally sorts the best matches to the top!

---

### Step 5: Code Example

Here is a Python script using `psycopg` (v3) and `pgvector` to insert and query vectors in Postgres:

```python
"""
pgvector Fundamentals: Creating tables, inserting vectors, and querying with SQL
Requires: pip install "psycopg[binary]" pgvector
"""

import psycopg
from pgvector.psycopg import register_vector
import numpy as np

# Database connection string
DB_URL = "postgresql://postgres:postgres@localhost:5432/rag_db"

def run_pgvector_demo():
    # 1. Connect to PostgreSQL
    with psycopg.connect(DB_URL) as conn:
        # Register pgvector extension types with psycopg
        register_vector(conn)
        
        with conn.cursor() as cur:
            # 2. Enable the extension
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            
            # 3. Create table with a vector column (3 dimensions for demo)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS articles (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    category TEXT NOT NULL,
                    embedding vector(3)
                );
            """)
            cur.execute("TRUNCATE TABLE articles;")

            # 4. Insert rows with vectors
            cur.execute("""
                INSERT INTO articles (title, category, embedding) VALUES
                ('Health insurance renewal guide', 'hr', '[0.9, 0.1, 0.2]'),
                ('Paid parental leave policy', 'hr', '[0.85, 0.15, 0.1]'),
                ('Kubernetes cluster disaster recovery', 'tech', '[0.05, 0.95, 0.8]');
            """)
            conn.commit()
            print("Articles inserted with embeddings.")

            # 5. Query: Find HR articles closest to query vector
            query_vec = np.array([0.88, 0.12, 0.18])
            
            cur.execute("""
                SELECT id, title, category, (embedding <=> %s) AS distance
                FROM articles
                WHERE category = 'hr'
                ORDER BY embedding <=> %s
                LIMIT 2;
            """, (query_vec, query_vec))

            print("\n--- QUERY RESULTS (Ordered by Cosine Distance) ---")
            for row in cur.fetchall():
                print(f"ID: {row[0]} | Title: {row[1]} | Category: {row[2]} | Distance: {row[3]:.4f}")

if __name__ == "__main__":
    # Note: Requires a running PostgreSQL instance with pgvector installed
    print("Run this script against any Postgres instance with pgvector enabled.")
```

---

### Step 6: How Is It Used in Production?

| Production Challenge | Why It Breaks | The Production Fix | Impact |
| :--- | :--- | :--- | :--- |
| **Using the Wrong Operator** | Using `<->` (Euclidean) instead of `<=>` (Cosine) on unnormalized vectors | Always use `<=>` for text semantic search | Guarantees direction-based semantic ranking |
| **Missing Index on Large Tables** | Running vector queries on 500k rows without an index causes a full sequential table scan | Build an HNSW or IVFFlat index on the vector column | Drops query time from 1,200ms to 8ms |
| **Dimension Mismatch Error** | Trying to insert a 1,536-dim vector into a `vector(768)` column | Verify embedding model dimensions before writing table schemas | Prevents fatal SQL insertion crashes |
| **PgBouncer Transaction Pooling** | Prepared statements in vector queries fail under aggressive transaction pooling | Use named parameter queries or set `prepare_threshold=0` | Smooth, crash-free connection pooling |

---

### Step 7: Quick Revision

- **pgvector Keeps Everything in Postgres:** Vectors live as regular columns in standard relational tables.
- **Single Source of Truth:** Eliminates data drift between relational data and vector stores.
- **Distance Operators:**
  - `<=>`: Cosine Distance (0.0 = identical match).
  - `<->`: Euclidean L2 Distance.
  - `<#>`: Negative Inner Product.
- **ACID Compliant:** Vector updates happen in the exact same transaction as document updates.
- **Interview Answer:** *"pgvector extends PostgreSQL with a native `vector(dim)` data type and similarity search operators like `<=>`. It eliminates the need for separate vector database infrastructure, allowing applications to perform hybrid relational queries and vector searches within a single ACID-compliant database."*

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;
    classDef decision fill:#f59e0b,stroke:#d97706,color:#ffffff,stroke-width:2px;
    classDef success fill:#10b981,stroke:#059669,color:#ffffff,stroke-width:2px;
    classDef process fill:#3b82f6,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;

    A([PostgreSQL Database]) --> B[Run CREATE EXTENSION vector]
    B --> C[Create Table with embedding vector N column]
    C --> D[Insert Rows: Text + Metadata + Vectors]:::process

    E([Incoming Query]) --> F{What type of search is needed?}:::decision
    F -- Pure Semantic Search --> G[ORDER BY embedding <=> query_vector LIMIT k]
    F -- Hybrid Relational + Vector --> H[WHERE dept='legal' AND active=true ORDER BY embedding <=> query_vector LIMIT k]:::success

    G --> I[Return Top-K Rows]:::startEnd
    H --> I
```

---

### Step 9: Quiz

Test your understanding of pgvector fundamentals. Submit your answers as `1-A, 2-B, 3-C, 4-D`:

**1. What is the primary operational advantage of using pgvector over an external standalone vector database?**
- A) pgvector deletes PostgreSQL to free up disk space.
- B) You do not need to manage, synchronize, or pay for a separate database; vectors live directly in your existing Postgres tables.
- C) pgvector makes Python run 100x faster.
- D) pgvector works without electricity.

**2. Which operator in pgvector computes Cosine Distance between two vectors?**
- A) `<=>`
- B) `==`
- C) `&&`
- D) `->>`

**3. In SQL, why do we use `ORDER BY embedding <=> query_vector LIMIT 5` to find the most similar items?**
- A) Because Cosine Distance is 0.0 for identical vectors, so sorting ascending brings the best matches to the top.
- B) Because SQL requires all queries to end with the `<=>` symbol.
- C) Because it converts all numbers into positive integers.
- D) Because Postgres refuses to sort numbers without it.

**4. Can you perform standard SQL `JOIN` and `WHERE` clauses on the same table that holds pgvector embeddings?**
- A) No, pgvector disables all other SQL features.
- B) Yes, you can combine relational joins, WHERE filters, and vector ordering in a single query.
- C) Only if the table has fewer than 10 rows.
- D) Only on Windows servers.

*(Submit your answers to check your progress!)*
