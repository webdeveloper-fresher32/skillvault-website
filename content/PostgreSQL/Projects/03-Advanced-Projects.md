# Advanced PostgreSQL Projects & Capstones

---

## Project 5: High-Throughput IoT Time-Series Engine

### Architectural Goals
Design and deploy an industrial IoT metrics ingestion pipeline capable of storing 500 million telemetry events per month:
- Declarative Range Partitioning by month on `recorded_at`.
- **BRIN (Block Range Index)** indexing to keep indexes under 10MB per partition.
- Automated continuous rollups into hourly and daily summary tables.
- Zero-downtime partition detachment (`DETACH CONCURRENTLY`) to cold archive storage.

### Complete DDL & Automated Partition Pipeline

```sql
-- 1. Master Partitioned Telemetry Table
CREATE TABLE iot_telemetry (
    device_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    metric_type VARCHAR(32) NOT NULL,
    val_numeric NUMERIC(10, 4) NOT NULL,
    payload JSONB,
    PRIMARY KEY (device_id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- 2. Partition Provisioning Helper Procedure
CREATE OR REPLACE PROCEDURE create_monthly_partition(p_year INT, p_month INT)
LANGUAGE plpgsql AS $$
DECLARE
    v_start_date TEXT;
    v_end_date TEXT;
    v_part_name TEXT;
    v_sql TEXT;
BEGIN
    v_start_date := format('%s-%s-01 00:00:00+00', p_year, lpad(p_month::text, 2, '0'));
    
    IF p_month = 12 THEN
        v_end_date := format('%s-01-01 00:00:00+00', p_year + 1);
    ELSE
        v_end_date := format('%s-%s-01 00:00:00+00', p_year, lpad((p_month + 1)::text, 2, '0'));
    END IF;

    v_part_name := format('iot_telemetry_%s_%s', p_year, lpad(p_month::text, 2, '0'));

    v_sql := format('CREATE TABLE IF NOT EXISTS %I PARTITION OF iot_telemetry FOR VALUES FROM (%L) TO (%L);', 
                    v_part_name, v_start_date, v_end_date);
    EXECUTE v_sql;

    -- Add high-speed BRIN index to the partition
    v_sql := format('CREATE INDEX IF NOT EXISTS %I ON %I USING brin (recorded_at) WITH (pages_per_range = 128);',
                    'idx_brin_' || v_part_name, v_part_name);
    EXECUTE v_sql;

    RAISE NOTICE 'Partition % created with BRIN index.', v_part_name;
END;
$$;

-- Provision Q3 2026 partitions:
CALL create_monthly_partition(2026, 7);
CALL create_monthly_partition(2026, 8);
CALL create_monthly_partition(2026, 9);
```

---

## Project 6: AI Semantic Knowledge Assistant with `pgvector` & Hybrid Search

### Architectural Goals
Build an enterprise AI Retrieval-Augmented Generation (RAG) backend inside PostgreSQL that out-competes specialized vector databases:
- High-dimensional vector storage (`VECTOR(1536)`).
- **HNSW (Hierarchical Navigable Small World)** vector index for sub-5ms cosine distance seeks.
- Native English lexical search using `TSVECTOR` and GIN indexing.
- **Reciprocal Rank Fusion (RRF)** scoring algorithm combining keyword precision and semantic conceptual similarity in a single query.

### Complete DDL & Hybrid Search Implementation

```sql
-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Knowledge Documents Table
CREATE TABLE engineering_handbook (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    section_name TEXT NOT NULL,
    chunk_content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    -- Pre-calculated Full-Text search vector
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', chunk_content), 'B')
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. High-Performance Indexes
CREATE INDEX idx_handbook_hnsw 
ON engineering_handbook USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_handbook_fts 
ON engineering_handbook USING gin (search_vector);

-- 4. Hybrid Search Function (Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION search_handbook_hybrid(
    p_query_text TEXT,
    p_query_embedding VECTOR(1536),
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    document_id UUID,
    title TEXT,
    content_snippet TEXT,
    rrf_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH semantic_results AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> p_query_embedding) AS rank_sem
        FROM engineering_handbook
        ORDER BY embedding <=> p_query_embedding
        LIMIT 30
    ),
    keyword_results AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(search_vector, websearch_to_tsquery('english', p_query_text)) DESC) AS rank_kw
        FROM engineering_handbook
        WHERE search_vector @@ websearch_to_tsquery('english', p_query_text)
        LIMIT 30
    )
    SELECT 
        h.id,
        h.title,
        ts_headline('english', h.chunk_content, websearch_to_tsquery('english', p_query_text), 'MaxWords=30, MinWords=15') AS content_snippet,
        (COALESCE(1.0 / (60 + s.rank_sem), 0.0) + COALESCE(1.0 / (60 + k.rank_kw), 0.0))::FLOAT AS rrf_score
    FROM engineering_handbook h
    LEFT JOIN semantic_results s ON h.id = s.id
    LEFT JOIN keyword_results k  ON h.id = k.id
    WHERE s.id IS NOT NULL OR k.id IS NOT NULL
    ORDER BY rrf_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```
