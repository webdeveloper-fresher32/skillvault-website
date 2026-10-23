# Lesson 2: Hybrid Relational and Vector Queries

Man, in Lesson 1 we saw how pgvector adds vector columns to PostgreSQL. Now let's explore pgvector's greatest superpower: **combining relational SQL joins, WHERE filters, and Row-Level Security (RLS) with vector similarity in a single query**.

---

### Step 1: Why Do We Need This?

In enterprise software, search is never just about semantic similarity:
- You don't just want *"documents about cloud security"*; you want *"documents about cloud security that are active, published by an author from the Security Team, and visible to users in the EU region."*

If you use a standalone vector database:
1. You must duplicate the `users`, `departments`, `permissions`, and `regions` tables into metadata.
2. Every time a user changes teams or an organization updates permissions, you must write complex synchronization scripts to update vector metadata.
3. You risk serious permission leaks if the synchronization pipeline lags by even a few seconds.

With pgvector, vector search joins directly with your live application tables. No duplication, no synchronization lag, and 100% ACID consistency.

---

### Step 2: What Is It?

A **Hybrid Relational and Vector Query** is a SQL statement that combines traditional relational database features with vector distance math:

- **Relational Filters:** `WHERE status = 'published' AND created_at > '2025-01-01'`
- **Relational Joins:** `JOIN organizations ON organizations.id = documents.org_id`
- **Vector Ranking:** `ORDER BY documents.embedding <=> query_vector`
- **Row-Level Security (RLS):** Postgres automatically hides rows that the current user does not have permission to view.

#### The Everyday Analogy: VIP Access at a Concert
- Imagine a concert hall where thousands of people are seated.
- A standalone vector DB searches the whole room and gives you the 5 best-dressed people, but then you realize 3 of them are in the general admission section and not allowed into the VIP lounge.
- A hybrid relational query tells the security guard at the VIP door: *"Only let me look at people who already have a VIP wristband, and from that group, find the 5 best dressed."*

---

### Step 3: Real-World Example

Imagine a multi-tenant B2B customer support portal with three tables:

1. `tenants (id, name, plan_tier)`
2. `users (id, tenant_id, role)`
3. `knowledge_chunks (id, tenant_id, author_id, content, is_confidential, embedding)`

A support agent for Acme Corp asks: *"How do I reset customer SSO tokens?"*

```sql
SELECT 
    kc.content,
    u.role AS author_role,
    kc.embedding <=> '[0.12, 0.44, ...]'::vector AS distance
FROM knowledge_chunks kc
JOIN tenants t ON t.id = kc.tenant_id
JOIN users u ON u.id = kc.author_id
WHERE t.name = 'Acme Corp'
  AND kc.is_confidential = FALSE
ORDER BY kc.embedding <=> '[0.12, 0.44, ...]'::vector
LIMIT 3;
```

Postgres checks tenant ownership, verifies confidentiality flags, joins user roles, and ranks by semantic similarity—all in **6 milliseconds**!

---

### Step 4: How Does It Work?

Here is how the PostgreSQL query planner handles a hybrid query:

```
[SQL Query Submitted]
        │
[1. Index Scan or Filter Scan]
Evaluates B-Tree indexes on relational columns:
WHERE tenant_id = 42 AND is_confidential = false
        │
Filtered Rows (e.g. 500 candidate chunks)
        │
[2. Vector Index Distance Calculation]
Calculates distance (<=>) ONLY on the 500 filtered candidates
        │
[3. JOIN & LIMIT]
Joins author info and takes Top-K closest matches
        │
[Single Clean Result Set Returned to RAG App]
```

#### Row-Level Security (RLS) Superpower:
If you enable Postgres Row-Level Security:
```sql
CREATE POLICY tenant_isolation_policy ON knowledge_chunks
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::int);
```
Any vector query executed during that database session will **automatically and physically restrict results to that tenant**, making cross-tenant data leaks impossible at the database engine level!

---

### Step 5: Code Example

Here is a Python script using `psycopg` demonstrating a relational join combined with vector search:

```python
"""
pgvector Hybrid Relational Joins and Vector Queries
"""

import psycopg
from pgvector.psycopg import register_vector
import numpy as np

DB_URL = "postgresql://postgres:postgres@localhost:5432/rag_db"

def run_hybrid_query(tenant_id: int, query_vector: np.ndarray, top_k: int = 2):
    with psycopg.connect(DB_URL) as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            # Query combining relational JOIN, WHERE clause, and Vector Distance
            sql = """
                SELECT 
                    d.title,
                    d.content,
                    u.name AS author_name,
                    d.embedding <=> %s AS distance
                FROM documents d
                JOIN users u ON u.id = d.author_id
                WHERE d.tenant_id = %s
                  AND d.is_published = TRUE
                ORDER BY d.embedding <=> %s
                LIMIT %s;
            """
            cur.execute(sql, (query_vector, tenant_id, query_vector, top_k))
            
            rows = cur.fetchall()
            print(f"--- HYBRID SEARCH RESULTS (Tenant {tenant_id}) ---")
            for r in rows:
                print(f"Title: {r[0]} | Author: {r[2]} | Distance: {r[3]:.4f}")
                print(f"Snippet: {r[1][:80]}...\n")

if __name__ == "__main__":
    # Simulated 3-dim embedding
    sample_query = np.array([0.15, 0.82, 0.31])
    print("Execute this function against your PostgreSQL database.")
```

---

### Step 6: How Is It Used in Production?

| Architecture Aspect | What Fails | The Production Solution | Real Impact |
| :--- | :--- | :--- | :--- |
| **Missing B-Tree Index on Filter** | Filtering on `WHERE tenant_id = 42` without a standard index scans the whole table | Add standard B-tree index on relational filter columns (`CREATE INDEX ON docs(tenant_id)`) | 10x faster query execution |
| **Over-Filtering Dilemma** | If a filter matches only 2 rows, vector indexes might skip them | Understand Postgres planner choices; small row counts trigger fast exact scans | Ensures accurate recall |
| **Session-Level RLS Forgetting** | Forgetting to set `app.current_tenant_id` at the start of a connection pool session | Set tenant context in FastAPI middleware before executing queries | 100% guaranteed multi-tenant safety |
| **Bloated Result Payloads** | Selecting `SELECT *` returns huge binary vector columns over the wire to your app | Explicitly list columns (`SELECT id, title, content`) and omit the vector column | Reduces network bandwidth by 80% |

---

### Step 7: Quick Revision

- **The Ultimate Combo:** Combine standard SQL `WHERE` clauses, `JOIN` statements, and `<=>` vector distance in one query.
- **Row-Level Security (RLS):** Let PostgreSQL enforce tenant permissions automatically at the engine level.
- **Index Both Sides:** Use B-Tree indexes on relational filter columns (`tenant_id`, `status`) and HNSW indexes on vector columns.
- **Omit Vector Columns in SELECT:** Never return raw embedding floats over the network unless debugging.
- **Interview Answer:** *"pgvector allows developers to execute hybrid queries that combine relational filters, multi-table joins, and Row-Level Security with vector similarity ranking in a single ACID transaction, eliminating data duplication and synchronization drift between databases."*

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;
    classDef decision fill:#f59e0b,stroke:#d97706,color:#ffffff,stroke-width:2px;
    classDef success fill:#10b981,stroke:#059669,color:#ffffff,stroke-width:2px;
    classDef process fill:#3b82f6,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;

    A([User Request with JWT Token]) --> B[Extract tenant_id & user permissions]
    B --> C[Open Postgres Connection & Set RLS Context]
    
    C --> D[Execute Unified SQL Query]
    D --> E[Postgres Evaluates WHERE tenant_id & is_published=true]:::process
    E --> F[Joins Relational User / Organization Tables]
    F --> G[Calculates Cosine Distance with <=> Operator]:::success
    G --> H[Sorts by Smallest Distance and applies LIMIT k]

    H --> I([Return Grounded Chunks to RAG Pipeline]):::startEnd
```

---

### Step 9: Quiz

Test your understanding of hybrid relational and vector queries. Submit your answers as `1-A, 2-B, 3-C, 4-D`:

**1. Why is performing hybrid relational queries in pgvector safer than synchronizing permissions to an external vector database?**
- A) Postgres has no passwords.
- B) Relational permissions and vector embeddings reside in the exact same ACID database, eliminating synchronization lag and data leaks.
- C) External vector databases cannot store text.
- D) Hybrid queries make the internet run faster.

**2. How does PostgreSQL's Row-Level Security (RLS) benefit a multi-tenant RAG system?**
- A) It prevents the database from using memory.
- B) It automatically restricts every query to rows belonging to the current tenant, preventing cross-tenant data leaks at the database engine level.
- C) It translates SQL into Python.
- D) It deletes old vectors after 5 minutes.

**3. Why should you avoid using `SELECT *` when querying tables that contain vector embeddings in production?**
- A) Postgres will crash if you use the asterisk symbol.
- B) Returning large high-dimensional floating-point vectors over the network wastes bandwidth and slows down API latency.
- C) Asterisks can only be used on numerical tables.
- D) Vectors can only be viewed in JSON format.

**4. What type of index should you create on relational filter columns (like `tenant_id` or `status`) in a pgvector table?**
- A) A standard B-Tree index.
- B) An audio waveform index.
- C) A CSS stylesheet.
- D) No index is ever needed in SQL.

*(Submit your answers to check your progress!)*
