# Lesson 3: Indexing with IVFFlat and HNSW in pgvector

Man, in Lessons 1 and 2 we saw how pgvector lets you run SQL vector searches. But if your table has 500,000 rows and you don't have an index, Postgres has to read every single row from disk in a slow sequential scan.

Let's explore pgvector's two indexing superpowers: **HNSW** and **IVFFlat**, and how to choose the right one for production.

---

### Step 1: Why Do We Need This?

When you create a table with a vector column and run queries, Postgres performs an **exact sequential scan**:
- It reads every single row off the disk.
- It calculates the cosine distance for every single vector in the table.
- At 1,000 rows, this takes 2 milliseconds.
- At 500,000 rows, this takes **1,500 milliseconds** and spikes your database CPU to 100%!

To serve real-time user queries in under 10 milliseconds, you must build an **Approximate Nearest Neighbor (ANN) index** on your vector column.

---

### Step 2: What Is It?

pgvector supports two index types for vector search:

1. **HNSW (Hierarchical Navigable Small World) — The Modern Standard:**
   - Builds a multi-layer network graph connecting vectors to their nearest neighbors.
   - Searches by jumping across "expressway" highway nodes at top layers, then zooming in on local clusters at lower layers.
   - **Superpower:** Incredible speed (< 5ms) and high recall (99%+). You can create it on an empty table and insert data dynamically without rebuilding!

2. **IVFFlat (Inverted File Flat) — The Low-RAM Specialist:**
   - Divides vector space into clusters (called Voronoi cells).
   - When querying, it searches only the vectors inside the few closest clusters.
   - **Trade-off:** Uses much less RAM than HNSW, but requires data to already exist before building the index, and search recall degrades as new data is added unless reindexed.

#### The Everyday Analogy: Highway Network vs Post Office Zones
- **HNSW is a modern highway system:** You take the high-speed interstate highway to cross the country (top layer), exit onto the state highway (middle layer), and take local neighborhood streets to the exact house (bottom layer). Fast and reliable.
- **IVFFlat is postal zip codes:** You sort all mail into 100 postal zone bins. When looking for a letter, you only check the 3 closest bins. It takes very little desk space, but if you add thousands of new letters without updating the bins, letters end up in the wrong piles.

---

### Step 3: Real-World Example

Let's compare search performance on a PostgreSQL database with 200,000 document embeddings (1,536 dimensions):

| Index Type | Build Time | Memory (RAM) Usage | Query Latency | Recall / Accuracy |
| :--- | :--- | :--- | :--- | :--- |
| **No Index (Seq Scan)** | 0 seconds | 0 MB | **850 ms** (Unusable) | 100% |
| **IVFFlat (`lists=500`)** | 45 seconds | **65 MB** | **18 ms** | 94.2% |
| **HNSW (`m=16, ef=64`)** | 3.5 minutes | **340 MB** | **4 ms** (Lightning Fast) | **99.1%** |

In 95% of production RAG applications, **HNSW is the clear winner** because of its speed and live dynamic insert support.

---

### Step 4: How Does It Work?

Here is how both indexes are created and tuned in PostgreSQL:

#### 1. Creating an HNSW Index (Recommended):
```sql
CREATE INDEX ON articles 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```
- `vector_cosine_ops`: Tells pgvector to optimize the index for the `<=>` (Cosine Distance) operator.
- `m`: Number of bidirectional links per vector (default 16). Higher = better recall, slightly more RAM.
- `ef_construction`: Size of the dynamic candidate list during index build (default 64). Higher = slower build, higher search recall.

#### Tuning HNSW at Query Time:
```sql
SET hnsw.ef_search = 40;  -- Default is 40. Increase to 100 for higher recall.
```

#### 2. Creating an IVFFlat Index:
```sql
-- Rule of thumb: lists = sqrt(total_rows) for <1M rows, or total_rows / 1000
CREATE INDEX ON articles 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 500);
```

#### Tuning IVFFlat at Query Time:
```sql
SET ivfflat.probes = 10;  -- Number of clusters to search. Default is 1.
```

---

### Step 5: Code Example

Here is a Python script using `psycopg` to build and tune an HNSW index on a PostgreSQL table:

```python
"""
Building and Tuning HNSW Indexes in pgvector
"""

import psycopg

DB_URL = "postgresql://postgres:postgres@localhost:5432/rag_db"

def setup_hnsw_index():
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            print("Creating HNSW index on articles table...")
            
            # Step 1: Build HNSW index with Cosine distance ops
            cur.execute("""
                CREATE INDEX IF NOT EXISTS articles_embedding_hnsw_idx 
                ON articles 
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
            """)
            conn.commit()
            print("HNSW Index created successfully!")

            # Step 2: Set query-time search depth
            cur.execute("SET hnsw.ef_search = 60;")
            
            # Step 3: Verify with EXPLAIN ANALYZE
            query_vector = "[0.12, 0.45, 0.78]"
            cur.execute(f"""
                EXPLAIN ANALYZE
                SELECT id, title
                FROM articles
                ORDER BY embedding <=> '{query_vector}'::vector
                LIMIT 5;
            """)
            
            plan = cur.fetchall()
            print("\n--- QUERY PLAN (Verifying Index Scan) ---")
            for line in plan:
                print(line[0])

if __name__ == "__main__":
    print("Run this script to configure HNSW indexing on your Postgres instance.")
```

---

### Step 6: How Is It Used in Production?

| Indexing Challenge | What Fails | The Production Fix | Real Impact |
| :--- | :--- | :--- | :--- |
| **Building IVFFlat on an Empty Table** | IVFFlat clusters data that doesn't exist yet; later inserts land in poor clusters | Only build IVFFlat *after* all initial rows are loaded, or use HNSW instead | Prevents recall collapsing to 30% |
| **Insufficient Maintenance Memory** | Building an HNSW index on 1M vectors fails with out of memory error | Run `SET maintenance_work_mem = '2GB';` before building the index | Speeds up build time by 5x |
| **Operator Mismatch** | Building index with `vector_l2_ops` but querying with `<=>` (cosine) | Always match index ops: `vector_cosine_ops` for `<=>`, `vector_ip_ops` for `<#>` | Ensures query planner uses the index |
| **HNSW RAM Sizing** | HNSW indexes must fit in RAM for maximum speed | Configure Postgres `shared_buffers` and server RAM to accommodate index size | Keeps latency under 5ms |

---

### Step 7: Quick Revision

- **Sequential Scan is Slow:** Without an index, Postgres checks every single vector ($O(n)$ full scan).
- **HNSW Is Default Choice:** Supports live dynamic inserts, delivers sub-5ms queries, and provides 99%+ recall.
- **IVFFlat Is Low-RAM Choice:** Uses less RAM, but requires data to exist before building and needs periodic rebuilding.
- **Match the Operator Class:** Use `vector_cosine_ops` when using the `<=>` operator.
- **Interview Answer:** *"In pgvector, HNSW builds a multi-layer graph index that enables sub-5ms Approximate Nearest Neighbor queries with high recall and supports live inserts. IVFFlat clusters vectors into Voronoi cells to conserve RAM, but requires rebuilding as the dataset grows."*

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;
    classDef decision fill:#f59e0b,stroke:#d97706,color:#ffffff,stroke-width:2px;
    classDef success fill:#10b981,stroke:#059669,color:#ffffff,stroke-width:2px;
    classDef process fill:#3b82f6,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;

    A([Determine Postgres Indexing Strategy]) --> B{What is your primary constraint?}:::decision

    B -- Best Speed & Recall + Live Inserts --> C[Choose HNSW Index]:::success
    B -- Severely Limited RAM on Small Server --> D[Choose IVFFlat Index]:::process

    C --> E[CREATE INDEX USING hnsw WITH m=16, ef_construction=64]:::success
    E --> F[Tune at query time: SET hnsw.ef_search = 40 to 100]

    D --> G[Load all initial data first]
    G --> H[CREATE INDEX USING ivfflat WITH lists=sqrt N]
    H --> I[Tune at query time: SET ivfflat.probes = 10]

    F --> J([Sub-5ms Query Latency Achieved]):::startEnd
    I --> J
```

---

### Step 9: Quiz

Test your understanding of pgvector indexing. Submit your answers as `1-A, 2-B, 3-C, 4-D`:

**1. Why is HNSW generally preferred over IVFFlat for production RAG pipelines?**
- A) HNSW deletes old data automatically.
- B) HNSW delivers higher search recall, sub-5ms query speed, and can be built on an empty table while handling live continuous inserts.
- C) HNSW works without installing PostgreSQL.
- D) HNSW only works on text under 10 characters.

**2. What happens if you build an IVFFlat index on a table that has zero rows, and then insert 100,000 vectors afterwards?**
- A) The database will throw an error and shut down.
- B) The initial clustering will be meaningless, leading to terrible search recall (low accuracy) unless the index is rebuilt.
- C) IVFFlat will automatically convert itself into an HNSW index.
- D) All vectors will turn into integers.

**3. Which operator class must be specified in the `CREATE INDEX` statement if you plan to query with the Cosine Distance operator `<=>`?**
- A) `vector_cosine_ops`
- B) `text_ops`
- C) `jsonb_path_ops`
- D) `btree_ops`

**4. What query-time setting can you increase in pgvector to trade slightly higher latency for higher search recall in HNSW?**
- A) `SET hnsw.ef_search = 100;`
- B) `SET memory = max;`
- C) `SET speed = fast;`
- D) `SET accuracy = true;`

*(Submit your answers to check your progress!)*
