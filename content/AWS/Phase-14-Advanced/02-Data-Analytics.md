# AWS Data Analytics Services — Complete Guide

---

## Table of Contents

1. [Amazon Redshift](#amazon-redshift)
2. [Amazon Athena](#amazon-athena)
3. [AWS Glue](#aws-glue)
4. [Amazon Kinesis](#amazon-kinesis)
5. [Amazon EMR](#amazon-emr)
6. [Amazon OpenSearch Service](#amazon-opensearch-service)
7. [Amazon QuickSight](#amazon-quicksight)
8. [AWS Lake Formation](#aws-lake-formation)
9. [Comprehensive Interview Q&A](#comprehensive-interview-qa)

---

## Amazon Redshift

### What Is Redshift?

Amazon Redshift is a fully managed, petabyte-scale **columnar data warehouse** optimized for **OLAP (Online Analytical Processing)** workloads — complex queries that aggregate large volumes of data across many rows. It is explicitly **not** designed for OLTP (Online Transactional Processing), which involves many small, fast read/write operations on individual rows.

The fundamental difference between OLAP and OLTP:

| Dimension          | OLAP (Redshift)                              | OLTP (RDS, Aurora)                           |
|--------------------|----------------------------------------------|----------------------------------------------|
| Operation type     | Complex aggregations, joins, GROUP BY        | INSERT, UPDATE, DELETE single rows           |
| Data volume        | Terabytes to petabytes                       | Gigabytes to terabytes                       |
| Query frequency    | Fewer, long-running queries                  | Millions of short queries per second         |
| Users              | Analysts, data scientists, BI tools          | Application backends                         |
| Storage layout     | Columnar (reads only needed columns)         | Row-based (reads entire row)                 |

### Architecture: Leader Node + Compute Nodes

Redshift uses a **massively parallel processing (MPP)** architecture:

**Leader Node:**
- Receives all client SQL queries
- Parses and creates a query execution plan
- Compiles and distributes the compiled code to compute nodes
- Aggregates intermediate results from compute nodes
- Returns the final result to the client
- Does not store data or participate in computation
- Clients connect to the leader node only (never directly to compute nodes)

**Compute Nodes:**
- Store actual data in columnar format across **slices**
- Each node is subdivided into slices; each slice processes data independently in parallel
- Execute the compiled code received from the leader node
- Return intermediate results to the leader node
- The number of compute nodes and their type determines total cluster capacity

**Slices:**
- A node slice is a partition of a node's memory and disk
- Each slice processes a portion of the data assigned to that node
- Data distribution (see Distribution Styles below) determines how rows are allocated across slices

### Node Types

**RA3 Nodes (Recommended):**
- Decouples compute from storage using Redshift Managed Storage (RMS)
- Data is automatically tiered: hot data stays in local NVMe SSD, warm/cold data spills to S3
- You scale compute and storage independently
- Supports cross-AZ cluster relocation
- Good for: variable or unpredictable storage growth, when you want to scale compute without paying for more storage

**DC2 Nodes (Dense Compute):**
- Fixed local SSD storage — storage and compute are tightly coupled
- High performance for datasets up to several terabytes
- Lower cost per TB for fixed workloads
- Good for: stable, smaller datasets where local disk I/O performance is critical

### Redshift Serverless

Redshift Serverless removes all cluster management overhead:

- No need to provision nodes, choose node types, or resize clusters
- Automatically scales compute capacity up and down based on workload
- Measures capacity in **RPUs (Redshift Processing Units)**
- You set a **max RPU limit** to control cost
- **Base RPU capacity** ensures minimum performance when workload resumes
- Pay only for the compute used (per second during active query execution)
- Ideal for: intermittent workloads, teams that don't want to manage infrastructure, development/test environments

### Table Design: Distribution Styles

Distribution styles control how Redshift distributes table rows across compute node slices. The goal is to minimize **data movement** during joins and aggregations (i.e., avoid redistributing data across the network mid-query).

**KEY Distribution:**
- Rows are distributed based on the value of a chosen column (the distkey)
- Rows with the same key value land on the same slice
- Use when: two large tables are frequently joined on the same column — distribute both tables on the join key so matching rows already live on the same slice, eliminating network shuffling
- Risk: **data skew** if the key column has uneven value distribution (some slices get far more data)

**ALL Distribution:**
- A full copy of the entire table is stored on every compute node
- Use when: the table is small (dimension tables, lookup tables) and is frequently joined with large fact tables
- Benefit: every node has the full table locally, eliminating network movement during joins
- Cost: storage is multiplied by the number of nodes; not suitable for large tables

**EVEN Distribution:**
- Rows are distributed in a round-robin fashion across slices, regardless of any column value
- Use when: the table is not involved in joins, or when you don't have a clear distribution key
- Good for: staging tables, landing tables, tables used mainly for aggregation with no joins

**AUTO Distribution (Default):**
- Redshift automatically assigns the best distribution style based on table size
- Small tables: Redshift assigns ALL distribution
- Large tables: Redshift assigns EVEN distribution, then may evolve to KEY as query patterns are observed
- Best practice: start with AUTO; tune to KEY only if query profiling shows redistribution bottlenecks

### Sort Keys

Sort keys define the physical order in which rows are stored on disk within each slice. Redshift uses **zone maps** — metadata about the min/max values of each 1 MB disk block — to skip entire blocks that cannot contain relevant data.

**Compound Sort Key:**
- Columns listed in order of priority (like a multi-column index)
- Extremely efficient when queries filter on the first sort key column, or the first then second column in order
- Less efficient for queries that filter on only the second or third column without the first
- Good for: time-series data (sort by event_date), queries with clear column filter hierarchy

**Interleaved Sort Key:**
- Gives equal weight to each column in the sort key
- Any subset of sort key columns can be used efficiently in filters
- Higher maintenance cost (VACUUM REINDEX needed more frequently)
- Good for: tables queried with varying filter combinations on multiple columns
- Generally less recommended in modern Redshift; compound keys with careful design are usually preferred

### COPY Command

The primary way to load bulk data into Redshift:

```sql
COPY table_name
FROM 's3://bucket-name/prefix/'
IAM_ROLE 'arn:aws:iam::account-id:role/RedshiftRole'
FORMAT AS PARQUET;
```

Key options:
- `FORMAT AS CSV DELIMITER ',' IGNOREHEADER 1` — for CSV with header row
- `FORMAT AS JSON 'auto'` — auto-detect JSON field mapping
- `FORMAT AS PARQUET` — recommended; columnar format, no parsing overhead
- `GZIP` — decompress on the fly
- `MAXERROR n` — tolerate up to n errors before aborting
- `COMPUPDATE ON` — automatically apply best compression encodings

The COPY command reads from S3 in parallel — multiple files in the prefix are loaded simultaneously by multiple slices. Best practice: split large files into multiple smaller files (one per slice) for maximum parallelism.

The IAM role must be attached to the Redshift cluster and must have `s3:GetObject` and `s3:ListBucket` permissions on the source bucket.

### UNLOAD Command

Export query results from Redshift to S3:

```sql
UNLOAD ('SELECT * FROM orders WHERE order_date >= ''2024-01-01''')
TO 's3://bucket-name/exports/orders/'
IAM_ROLE 'arn:aws:iam::account-id:role/RedshiftRole'
FORMAT AS PARQUET
PARALLEL ON;
```

Key options:
- `PARALLEL ON` — write multiple files simultaneously (one per slice) for faster export
- `ALLOWOVERWRITE` — overwrite existing files at the S3 prefix
- `FORMAT AS CSV DELIMITER ','` — CSV export
- `FORMAT AS PARQUET` — recommended columnar format for downstream tools

### Redshift Spectrum

Redshift Spectrum allows Redshift to query data directly in S3 **without loading it into Redshift tables**:

- Uses **external tables** that reference S3 locations
- External table metadata is stored in the **AWS Glue Data Catalog** (or an Apache Hive metastore)
- Queries split: Redshift compute nodes handle local tables; Spectrum nodes (AWS-managed, thousands of them) handle the S3 scan
- Supports Parquet, ORC, CSV, JSON, Avro, Gzip, Snappy
- Cost: $5 per TB scanned from S3 (on top of regular Redshift cluster cost)

```sql
-- Create external schema linked to Glue Data Catalog
CREATE EXTERNAL SCHEMA spectrum_schema
FROM DATA CATALOG
DATABASE 'my_glue_database'
IAM_ROLE 'arn:aws:iam::account-id:role/RedshiftRole'
CREATE EXTERNAL DATABASE IF NOT EXISTS;

-- Query S3 data as if it were a normal table
SELECT s.customer_id, r.order_amount
FROM spectrum_schema.s3_orders s
JOIN redshift_internal.customers r ON s.customer_id = r.id;
```

Use case: query historical cold data in S3 while joining with hot data inside Redshift — no need to load all data into the cluster.

### Materialized Views

Materialized views pre-compute and cache the results of complex queries:

```sql
CREATE MATERIALIZED VIEW daily_revenue AS
SELECT DATE_TRUNC('day', order_date) AS day,
       SUM(amount) AS total_revenue
FROM orders
GROUP BY 1;
```

- Results are physically stored in Redshift (not recomputed each time)
- Subsequent queries against the MV are much faster
- **Auto-refresh**: configure `AUTO REFRESH YES` so Redshift automatically refreshes when base tables change
- **Incremental refresh**: Redshift can update only the changed rows (not full recompute) for eligible queries
- Good for: expensive aggregation queries run repeatedly by BI tools

### Redshift ML

Create machine learning models using SQL, backed by **Amazon SageMaker Autopilot**:

```sql
CREATE MODEL customer_churn_model
FROM (SELECT age, total_purchases, days_since_last_purchase, churned FROM training_data)
TARGET churned
FUNCTION predict_churn
IAM_ROLE 'arn:aws:iam::account-id:role/RedshiftRole'
SETTINGS (S3_BUCKET 'my-redshift-ml-bucket');
```

- SageMaker Autopilot automatically tries multiple algorithms and hyperparameter combinations
- Once trained, the model is deployed as a SQL function callable inside Redshift queries
- No Python or ML expertise needed — data analysts can run inference with SQL
- Use cases: churn prediction, fraud detection, customer lifetime value

### Concurrency Scaling

Handles sudden bursts in query volume:

- When main cluster is at capacity, Redshift automatically routes incoming queries to transient **concurrency scaling clusters**
- These burst clusters spin up in seconds
- Each cluster accumulates **1 free hour of burst capacity per 24 hours of main cluster usage**
- Beyond free credits, you pay per second for burst capacity
- Enable per workload management (WLM) queue

### Data Sharing

Share live Redshift data across clusters and accounts without copying:

- **Producer cluster**: publishes a datashare (schema + tables)
- **Consumer cluster**: reads data directly from the producer's storage
- Data is always live — consumers see current data, not a snapshot
- Works across AWS accounts and regions (with some restrictions)
- Use cases: give analysts in other accounts read access without copying data; share specific schemas between teams

### When Redshift vs Athena

| Scenario                                | Use Redshift                        | Use Athena                         |
|-----------------------------------------|-------------------------------------|------------------------------------|
| Regular BI reporting (daily/hourly)     | Yes — pre-loaded, fast              | Possible but repeated cost         |
| Ad-hoc exploration of raw S3 data       | Overkill                            | Yes — pay per query, no setup      |
| Complex joins across many large tables  | Yes — MPP engine optimized for this | Slower on very large joins         |
| Infrequent, unpredictable queries       | Cluster idle = wasted cost          | Yes — only pay when querying       |
| Need sub-second dashboard response      | Yes — with SPICE or materialized views | Generally slower                |
| Querying data that already lives in S3  | Use Spectrum or Athena              | Yes — simpler setup                |

### Performance Tuning Tips

**VACUUM:**
- Recovers storage from deleted/updated rows and re-sorts unsorted rows
- `VACUUM FULL table_name` — sort + reclaim space
- `VACUUM SORT ONLY table_name` — only re-sort, skip reclaiming space
- Run periodically; Redshift auto-vacuum runs during idle periods
- Automatic since Redshift 1.0.1764, but manual runs may be needed after large deletes

**ANALYZE:**
- Updates table statistics used by the query planner
- Without accurate statistics, the query planner makes poor execution decisions
- `ANALYZE table_name` — analyze specific table
- `ANALYZE COMPRESSION table_name` — recommend compression encodings
- Run after bulk loads

**Compression Encodings:**
- Columnar storage enables per-column compression
- `ENCODE AZ64` — Amazon's encoding, good for numeric and date columns
- `ENCODE ZSTD` — general purpose, good compression ratio
- `ENCODE BYTEDICT` — excellent for low-cardinality string columns (gender, status)
- `ENCODE DELTA` — good for incrementing integer or date columns
- `ENCODE RUNLENGTH` — best when many consecutive repeated values
- Use `ANALYZE COMPRESSION` to get recommendations

### Interview Q&A — Redshift

**Q1: What is the difference between OLAP and OLTP, and why is Redshift suited for OLAP?**

A: OLTP handles many fast transactions on individual rows (INSERT, UPDATE, DELETE) — think order placement, account creation. OLAP handles complex analytical queries that scan millions of rows and aggregate data — think "total revenue by region by quarter." Redshift uses columnar storage, which means only the queried columns are read from disk (not the full row), dramatically reducing I/O for aggregation-heavy queries. Its MPP architecture parallelizes work across many nodes and slices simultaneously, making it ideal for large analytical workloads.

**Q2: You have a 500 TB Redshift cluster but only use it 8 hours a day. What would you recommend?**

A: Switch to Redshift Serverless or a Serverless endpoint, which only charges for compute during active query execution. Alternatively, implement cluster scheduling to pause the cluster outside business hours. If the workload is truly intermittent, Serverless eliminates idle cluster cost entirely and auto-scales capacity for bursts.

**Q3: A query joining two 50-billion-row tables is running slowly. How do you diagnose and fix it?**

A: First, check the SVL_QUERY_SUMMARY or STL_EXPLAIN system tables to see the query execution plan. Look for "DS_BCAST_INNER" (broadcasting one table to all nodes) or "DS_DIST_BOTH" (redistributing both tables) — these indicate data movement. The fix is to set the same DISTKEY on the join column for both tables so matching rows already live on the same node slice. Also verify sort keys include the join column if applicable, run ANALYZE to ensure fresh statistics, and confirm compression encodings are appropriate.

**Q4: What is Redshift Spectrum and when would you choose it over loading data directly?**

A: Redshift Spectrum enables querying S3 data via external tables without loading it into Redshift, using the Glue Data Catalog as the metastore. Use it when: data is too large or too infrequently queried to justify loading into the cluster (cold/archival data), when data already lives in a data lake and you want to join it with Redshift internal tables, or when you want to query data in-place without the ETL overhead. The trade-off is that Spectrum adds $5/TB scanned cost and is generally slower than querying internal tables.

**Q5: Explain Redshift's WLM (Workload Management).**

A: WLM lets you create multiple query queues with defined memory allocations and concurrency limits, so different workloads don't starve each other. For example: a "critical" queue for dashboards (high memory, low concurrency) and an "analytics" queue for ad-hoc queries (lower memory, higher concurrency). Short Query Acceleration (SQA) automatically routes short-running queries to a dedicated queue, preventing them from waiting behind long-running queries. Automatic WLM dynamically manages queue resources based on system load.

**Q6: What is data skew in Redshift and how do you detect and fix it?**

A: Data skew occurs when one or a few slices hold disproportionately more data than others, causing those slices to become bottlenecks while others sit idle. Detect it by querying SVV_TABLE_INFO (skew_rows column) or checking slice-level row counts. Fix it by choosing a DISTKEY with high cardinality and even value distribution. If no good key exists, switch to EVEN distribution to spread rows uniformly (at the cost of potential data movement during joins).

**Q7: How does Redshift handle concurrency? What happens when too many users run queries simultaneously?**

A: Redshift WLM manages concurrency through queues. Each queue has a concurrency limit; queries beyond that limit wait in the queue. Concurrency Scaling adds automatic burst capacity — when all slots in a queue are busy, overflow queries are routed to transient clusters that spin up in seconds. Each 24 hours of main cluster usage earns 1 free hour of concurrency scaling. For sustained high concurrency, consider Redshift Serverless, which scales more fluidly.

**Q8: What is the COPY command, why is it preferred over INSERT for bulk loads, and how do you optimize it?**

A: The COPY command uses MPP parallelism — it reads from multiple S3 files simultaneously, one per slice, loading data far faster than sequential INSERT statements. INSERT in Redshift is a single-threaded operation that goes through the leader node, making it extremely slow for bulk data. Optimize COPY by: splitting the source files into as many files as there are slices (number_of_nodes × slices_per_node), using Parquet format (no parsing overhead), enabling COMPUPDATE ON for automatic compression, and using manifest files when loading from specific file lists.

---

## Amazon Athena

### What Is Athena?

Amazon Athena is a **serverless, interactive SQL query service** that lets you analyze data directly in Amazon S3 using standard SQL. Under the hood, Athena is powered by **Presto** (now Trino), an open-source distributed SQL query engine. There is no infrastructure to provision — you simply point Athena at your S3 data, define a table schema, and run SQL queries.

### Pay Per Query

- You are charged **$5.00 per terabyte of data scanned**
- Charges apply only when a query actually scans data — no idle cost
- Cancelled queries are still charged for data scanned before cancellation
- DDL statements (CREATE TABLE, DROP TABLE) and failed queries are not charged
- Cost optimization strategy: reduce data scanned through columnar formats, partitioning, and compression

### Supported File Formats

| Format     | Type       | Notes                                                      |
|------------|------------|------------------------------------------------------------|
| CSV        | Row-based  | Human-readable, easy to produce, expensive to scan        |
| TSV        | Row-based  | Tab-separated variant of CSV                              |
| JSON       | Row-based  | Flexible schema, but slow for analytical queries          |
| Avro       | Row-based  | Schema-embedded, good for streaming data                  |
| Parquet    | Columnar   | Best for Athena — low cost, high speed                    |
| ORC        | Columnar   | Similar to Parquet, excellent compression                  |
| Ion        | Row-based  | Amazon's structured data format                           |

### Why Parquet and ORC?

These columnar formats fundamentally change how Athena reads data:

**Row-based query on CSV:** To compute `SUM(sales_amount)`, Athena must read every column of every row — even `customer_name`, `address`, `phone`, etc. — to find the `sales_amount` values.

**Columnar query on Parquet:** Athena reads only the `sales_amount` column, skipping all other columns entirely. If a query filters on `region = 'US'`, Parquet's **row group statistics** (min/max per column per chunk) allow Athena to skip entire row groups where `region` cannot be 'US'. This is called **predicate pushdown**.

Results:
- Dramatically less data scanned = lower cost
- Faster queries due to reduced I/O
- Better compression ratios (similar values are stored together in columns)

Convert CSV/JSON to Parquet using AWS Glue ETL jobs or AWS Lambda.

### Partitioning

Partitioning organizes S3 data into logical directories that correspond to column values. When a query filters on a partition column, Athena only scans the relevant partitions, skipping everything else.

**S3 prefix structure with Hive-compatible partitioning:**
```
s3://my-bucket/events/
    year=2024/month=01/day=01/file1.parquet
    year=2024/month=01/day=02/file1.parquet
    year=2024/month=02/day=01/file1.parquet
    year=2025/month=01/day=01/file1.parquet
```

```sql
CREATE EXTERNAL TABLE events (
    event_id STRING,
    user_id BIGINT,
    event_type STRING,
    amount DECIMAL(10,2)
)
PARTITIONED BY (year STRING, month STRING, day STRING)
STORED AS PARQUET
LOCATION 's3://my-bucket/events/';

-- Add partitions to the catalog
MSCK REPAIR TABLE events;
-- or manually:
ALTER TABLE events ADD PARTITION (year='2024', month='01', day='01')
LOCATION 's3://my-bucket/events/year=2024/month=01/day=01/';
```

A query like `WHERE year='2024' AND month='01'` will scan only January 2024 data, ignoring all other partitions. Without partitioning, Athena would scan the entire S3 prefix.

Best partitioning strategies:
- **Time-based**: year/month/day — most common for event data, logs, clickstreams
- **Cardinality**: choose columns with moderate cardinality. Too many partitions (e.g., one per user_id) creates metadata overhead. Too few partitions (e.g., by continent) provides little filtering benefit
- Avoid over-partitioning: thousands of tiny files (the "small file problem") are worse than fewer large files — each file read incurs S3 API overhead

### AWS Glue Data Catalog Integration

Athena uses the **AWS Glue Data Catalog** as its metastore — the central repository that stores database and table definitions (schema, location, partition information). This is the same catalog used by:
- AWS Glue ETL jobs
- Redshift Spectrum
- Amazon EMR
- AWS Lake Formation

When you create a table in Athena (CREATE EXTERNAL TABLE), the metadata is written to the Glue Data Catalog. When a Glue Crawler scans your S3 data, it writes schema and partition information to the same catalog, which Athena can then query immediately — no manual table creation required.

The Glue Data Catalog is regional. Tables created in Athena are visible in Glue Console and vice versa.

### Creating External Tables

```sql
CREATE EXTERNAL TABLE IF NOT EXISTS web_logs (
    request_id STRING,
    timestamp TIMESTAMP,
    method STRING,
    path STRING,
    status_code INT,
    response_bytes BIGINT,
    user_agent STRING,
    ip_address STRING
)
PARTITIONED BY (year STRING, month STRING, day STRING)
ROW FORMAT SERDE 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe'
STORED AS INPUTFORMAT 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat'
OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat'
LOCATION 's3://my-log-bucket/web-logs/'
TBLPROPERTIES ('classification'='parquet', 'parquet.compress'='SNAPPY');
```

For CSV:
```sql
CREATE EXTERNAL TABLE sales (
    order_id STRING,
    product_id INT,
    quantity INT,
    price DECIMAL(10,2)
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
STORED AS TEXTFILE
LOCATION 's3://my-bucket/sales/'
TBLPROPERTIES ("skip.header.line.count"="1");
```

### Federated Queries

Athena Federated Queries allow querying data sources beyond S3:

- Uses **AWS Lambda data source connectors** to translate Athena SQL into native queries against each source
- Available connectors: Amazon RDS (MySQL, PostgreSQL), Aurora, DynamoDB, CloudWatch, CloudWatch Logs, DocumentDB, HBase, Redis, OpenSearch, JDBC sources
- Connectors are deployed as Lambda functions in your account
- Results from federated sources can be joined with Athena tables in S3

```sql
-- Query a DynamoDB table via federated connector
SELECT * FROM dynamo.default.user_sessions WHERE session_start > '2024-01-01';

-- Join DynamoDB data with S3 data
SELECT s.user_id, d.email, COUNT(s.event_id) AS event_count
FROM s3_events.default.events s
JOIN dynamo.default.users d ON s.user_id = d.user_id
GROUP BY 1, 2;
```

### Athena Workgroups

Workgroups separate query execution by team, project, or environment:

- **Cost control**: set a per-query data scan limit (e.g., abort any query scanning more than 10 GB)
- **Enforce result location**: force all queries in a workgroup to write results to a specific S3 prefix
- **Per-workgroup metrics**: CloudWatch metrics isolated per workgroup for cost attribution
- **Access control**: IAM policies restrict which users/roles can use which workgroups
- **Query history**: separate history per workgroup

```json
{
    "Name": "analytics-team",
    "Configuration": {
        "ResultConfiguration": {
            "OutputLocation": "s3://my-results/analytics-team/"
        },
        "BytesScannedCutoffPerQuery": 10737418240,
        "EnforceWorkGroupConfiguration": true
    }
}
```

### Query Result Caching

- Athena caches query results for **up to 7 days** (configurable)
- If an identical query is re-executed within the cache window, Athena returns the cached result instantly with **no data scan charge**
- Cache is per workgroup
- Caching is based on exact query string match — even a whitespace difference counts as a different query
- Best for: BI tools that run the same dashboard query repeatedly

### Named Queries (Saved Queries)

- Save frequently used SQL queries with a name and description
- Stored in the Athena console and accessible via SDK/CLI
- Share across team members with appropriate IAM permissions
- Useful for: standard reports, compliance queries, template queries with parameters

### Athena vs Redshift

| Dimension              | Athena                                   | Redshift                                    |
|------------------------|------------------------------------------|---------------------------------------------|
| Setup                  | Zero — serverless                        | Provision cluster or use Serverless         |
| Cost model             | Pay per TB scanned                       | Pay per hour (provisioned) or per RPU      |
| Query frequency        | Best for infrequent/ad-hoc               | Best for regular/repeated queries          |
| Data location          | Always in S3                             | Loaded into cluster (or Spectrum for S3)   |
| Performance            | Good but variable                        | Consistently fast for loaded data          |
| Schema enforcement     | Schema-on-read (flexible)                | Schema-on-write (strict)                   |
| Concurrent users       | Essentially unlimited (serverless)       | Limited by WLM queues (Serverless scales)  |
| Best for               | Data exploration, log analysis           | BI dashboards, standard reports            |

### Optimization Tips

1. **Use Parquet or ORC** — single most impactful change; can reduce scanned data by 85–99%
2. **Partition your data** — filter on partition columns to skip irrelevant S3 prefixes
3. **Compress your data** — Snappy or GZIP for Parquet; reduces bytes transferred from S3
4. **Avoid SELECT *** — list only needed columns; Athena still scans full row groups unless using columnar format
5. **Optimize file size** — aim for 128 MB to 1 GB per file; avoid thousands of tiny files
6. **Use columnar predicates** — add WHERE clauses on columns with statistics; Parquet row group statistics allow entire chunks to be skipped
7. **Bucketing** — for very large tables queried by a specific column, bucketing pre-clusters data for faster joins

### Interview Q&A — Athena

**Q1: Why does using Parquet format reduce Athena costs significantly?**

A: Athena charges $5 per TB scanned. In CSV, a query scanning one column still reads all columns from every row. Parquet stores data column-by-column, so Athena reads only the specific columns referenced in the query. For a table with 50 columns where a query uses only 3, you might scan 2% of the data compared to CSV. Additionally, Parquet's row group statistics (min/max per block per column) allow Athena to skip entire blocks that cannot satisfy the WHERE clause. The combined effect can reduce costs by 90%+ compared to CSV.

**Q2: A query on a large table is scanning 50 TB and costing $250. How do you reduce this cost?**

A: First, convert the data from CSV/JSON to Parquet or ORC. This alone typically reduces scanned bytes by 70-90%. Second, implement partitioning on commonly filtered columns (e.g., year/month/day for time-series data). Third, apply compression (Snappy for balanced speed/ratio). Fourth, avoid SELECT * — list only needed columns. Fifth, review file sizes: merge small files into 128 MB–1 GB files. Combined, these changes can reduce cost from $250 to under $5 on the same logical dataset.

**Q3: What is the Glue Data Catalog and why does Athena need it?**

A: Athena is a query engine but has no persistent storage for table definitions. The Glue Data Catalog is the external metastore that stores database/table names, column names, data types, S3 locations, serialization formats, and partition metadata. Without it, Athena wouldn't know where data lives, what format it's in, or what the schema is. The Glue Data Catalog also serves as a shared catalog — tables created by Glue Crawlers are immediately queryable in Athena, and tables created in Athena can be read by Glue ETL jobs, forming a unified data lake catalog.

**Q4: What are Athena Federated Queries and when would you use them?**

A: Federated Queries use Lambda-based connectors to let Athena issue queries against non-S3 data sources — RDS, DynamoDB, CloudWatch, etc. Athena generates a query plan, delegates data source-specific reads to the Lambda connector, and joins results back in Athena's execution engine. Use when: you need to enrich S3 data with operational database data without ETL, run ad-hoc analysis across multiple data sources, or avoid copying data to S3 for one-off analysis. Trade-off: higher latency than native Athena queries (Lambda cold start + source query time) and limited pushdown optimization.

**Q5: Explain Athena Workgroups and why they matter in an enterprise setting.**

A: In an enterprise, multiple teams share Athena (cost control, isolation). Workgroups enforce: (1) result output location per team so each team writes to its own S3 prefix; (2) per-query scan limits to prevent runaway expensive queries; (3) separate CloudWatch metrics per team for accurate cost attribution; (4) access control via IAM so Team A cannot run queries or see results from Team B's workgroup. Without workgroups, all queries go to a shared pool with a single result location, making cost attribution and governance difficult.

**Q6: How does Athena handle schema evolution (adding/removing columns)?**

A: Athena uses schema-on-read — it reads data at query time and applies the schema defined in the Glue Data Catalog. If you add a column to the Parquet files but haven't updated the table definition, Athena won't see the new column. Update the table with ALTER TABLE ADD COLUMNS. If you remove a column from newer files, Athena returns NULL for that column on newer data. For Parquet/ORC, column resolution is by column name (not position), so adding columns in the middle doesn't break existing reads — unlike CSV where position matters.

**Q7: What is the "small file problem" in Athena and how do you fix it?**

A: S3 charges per API request, and Athena must make one API call per file. If your S3 prefix has 100,000 files of 10 KB each, Athena makes 100,000 API calls totaling 1 GB — the API overhead dominates. Additionally, Athena's execution engine spawns a task per file up to a limit; too many tiny files overwhelm scheduling. Fix: use AWS Glue or EMR to periodically compact small files into 128 MB–1 GB Parquet files. For streaming data, set Kinesis Firehose buffering to 128 MB or use Spark's coalesce() before writing.

**Q8: Can Athena query encrypted data? How?**

A: Yes. Athena supports: (1) SSE-S3 (server-side encryption with S3-managed keys) — transparent, no configuration needed; (2) SSE-KMS (S3 server-side encryption with KMS key) — Athena's IAM role needs kms:Decrypt permission on the key; (3) CSE-KMS (client-side encryption with KMS) — Athena decrypts at read time using the KMS key. Athena can also encrypt query results in S3 using SSE-S3, SSE-KMS, or CSE-KMS. Configure result encryption per workgroup.

---

## AWS Glue

### What Is AWS Glue?

AWS Glue is a fully **serverless ETL (Extract, Transform, Load) and data integration service**. It covers two primary functions: (1) the **Glue Data Catalog**, a centralized metadata repository for all your data assets, and (2) **Glue ETL**, a managed environment for running Apache Spark and Python-based data transformation jobs without provisioning or managing any servers.

### Glue Crawlers

A Glue Crawler automatically scans your data sources and populates the Data Catalog:

**How it works:**
1. You configure a crawler with: a data source (S3 path, RDS database, DynamoDB table, etc.), an IAM role, a target database in the Data Catalog, and a schedule (or on-demand)
2. The crawler connects to the data source, reads sample data, infers the schema (column names, data types)
3. It detects partition columns from S3 path structure (e.g., `year=2024/month=01/`)
4. It writes or updates table definitions in the Glue Data Catalog
5. On subsequent runs, it detects schema changes and adds new partitions

**Classifier:** Crawlers use built-in classifiers (CSV, JSON, Parquet, ORC, Avro, XML, etc.) to determine data format. You can create custom classifiers using grok patterns for non-standard formats.

**Incremental crawling:** Configure crawlers to only scan new/changed S3 objects since the last run, saving time and cost.

**When to use crawlers vs manual table creation:**
- Crawlers: when data schema evolves frequently, when schema is unknown, when adding many new partitions automatically
- Manual (CREATE TABLE in Athena/Glue): when schema is stable and known, when you want precise control over data types

### Glue Data Catalog

The Data Catalog is a persistent metadata store with three levels:

```
Data Catalog
└── Database (logical grouping)
    └── Table (schema + location + format)
        └── Partitions (partition values + S3 sub-locations)
```

**Table properties stored:**
- Column names and data types (can include nested/complex types)
- S3 location (or JDBC connection)
- File format (Parquet, ORC, CSV, JSON, etc.)
- SerDe (Serializer/Deserializer) information
- Partition keys and all partition values
- Table statistics (row counts, column statistics)
- Custom properties (classification, created_by, etc.)

**Services that use the Glue Data Catalog:**
- Amazon Athena — query engine using catalog for table definitions
- Redshift Spectrum — external table metadata
- Amazon EMR — Hive/Spark SQL table discovery
- AWS Glue ETL jobs — read/write table definitions
- AWS Lake Formation — applies permissions on top of catalog metadata

The Glue Data Catalog is a regional resource. Cross-region access requires catalog federation.

### Glue ETL Jobs

Glue ETL jobs run Apache Spark code in a serverless environment:

**Key concepts:**
- **DPUs (Data Processing Units)**: unit of compute; 1 DPU = 4 vCPUs + 16 GB memory
- **Workers**: Standard (2 DPU each), G.1X (1 DPU, good for memory-bound), G.2X (2 DPU, large transforms), G.025X (0.25 DPU, streaming micro-batch)
- **Glue version**: determines Spark and Python version (Glue 4.0 = Spark 3.3, Python 3.10)
- Auto-generated code: provide source/target; Glue generates PySpark boilerplate

**Job types:**

| Type               | Description                                          | When to Use                                     |
|--------------------|------------------------------------------------------|--------------------------------------------------|
| Spark (batch)      | Full Apache Spark, runs on DPU workers               | Large-scale batch ETL, complex transformations  |
| Python Shell       | Single-node Python, no Spark                         | Light transformations, API calls, simple SQL    |
| Spark Streaming    | Spark Structured Streaming on DPU workers            | Near-real-time streaming ETL from Kafka/Kinesis |
| Ray                | Distributed Python with Ray framework (Glue 4.0+)   | Python-heavy ML preprocessing                   |

**Job bookmarks:** Track which S3 data has already been processed. On the next run, Glue skips already-processed files, enabling incremental ETL without custom state management.

### Glue Studio

Visual drag-and-drop ETL builder within the Glue Console:

- Add source nodes (S3, Glue Data Catalog, Kinesis, Kafka, JDBC)
- Add transform nodes (Join, Filter, SelectFields, DropFields, ApplyMapping, SplitFields, FillMissingValues, custom Spark transform)
- Add target nodes (S3, Glue Data Catalog, JDBC, Redshift)
- Glue Studio generates PySpark code from the visual graph
- View the auto-generated code and customize it
- Run directly from Studio with real-time logs
- Schedule or trigger from Studio

### Glue DataBrew

No-code data cleaning and normalization tool:

- Upload data from S3, Glue Data Catalog, Redshift, RDS, or other sources
- Visually explore data: histogram, outlier detection, null distribution, correlation heatmap
- Apply **300+ built-in transformations**: trim whitespace, change case, parse dates, split columns, remove duplicates, encode categorical variables, normalize numeric ranges, mask sensitive data (PII)
- Create a **Recipe** (ordered list of transformations)
- Run the Recipe as a **DataBrew Job** to process the full dataset and write output to S3
- Profile jobs generate data quality statistics (completeness, uniqueness, cardinality)
- Target users: data analysts, data scientists who prefer visual tools over code

### DynamicFrame vs Spark DataFrame

| Feature                    | Glue DynamicFrame                              | Spark DataFrame                                  |
|----------------------------|------------------------------------------------|--------------------------------------------------|
| Schema                     | Schema-flexible — tolerates missing/extra fields, type mismatches | Schema-strict — mismatched types cause job failure |
| Nested data                | Handles nested/semi-structured JSON natively   | Requires manual explode/flatten                  |
| Relationship to DataFrame  | Can be converted to/from DataFrame             | Standard Spark abstraction                       |
| Error handling             | Resolves conflicts with resolveChoice()        | Throws exception on schema conflict              |
| Performance                | Slightly lower due to flexibility overhead     | Slightly higher                                  |
| Best for                   | Raw ingestion of messy, variable-schema data   | Well-structured, consistent-schema data          |

DynamicFrame methods: `resolveChoice()` (handle type ambiguities), `relationalize()` (flatten nested JSON into tabular form), `toDF()` (convert to Spark DataFrame for complex operations), `fromDF()` (convert back).

### Job Bookmarks

Job bookmarks prevent reprocessing of already-ingested data:

- Glue stores the state of the last job run (which S3 files were processed, which JDBC offsets were read)
- On the next run, only new data (files added after the last run) is processed
- Works with S3 sources (based on file modification timestamp and ETags), JDBC sources (based on primary key ranges)
- Enable per job: `--job-bookmark-option job-bookmark-enable`
- Reset bookmarks to reprocess all data: `--job-bookmark-option job-bookmark-reset`
- Pause bookmarks (process current run without advancing the bookmark): `--job-bookmark-option job-bookmark-pause`

### Triggers

Glue Triggers start ETL jobs:

- **On-demand**: manual start via console, CLI, SDK, or API
- **Scheduled**: cron expression (e.g., "run every day at 2 AM UTC")
- **Event-based (Conditional)**: trigger when another Glue job or crawler succeeds, fails, or times out; enables chaining of dependent jobs
- **EventBridge**: trigger Glue job from an EventBridge rule (e.g., when a new file lands in S3, when a time-based event fires)

### Glue Workflows

Orchestrate multiple interdependent Glue jobs and crawlers:

- Define a graph of triggers → crawlers → jobs
- Example: S3 landing → Crawler (update catalog) → ETL Job (transform) → Crawler (update output catalog) → Second ETL Job (aggregate)
- Visual workflow designer in Glue Console
- Track run history and individual step status
- For complex orchestration beyond Glue Workflows, use AWS Step Functions or Apache Airflow (MWAA)

### Connection Types

Glue Connections store JDBC connection details (host, port, database, credentials via Secrets Manager):

| Connection Type | Details                                                          |
|-----------------|------------------------------------------------------------------|
| JDBC            | MySQL, PostgreSQL, Oracle, SQL Server, Redshift, Aurora          |
| Amazon S3       | Native, no explicit connection needed                            |
| Amazon DynamoDB | Native connector                                                 |
| Apache Kafka    | Bootstrap servers, security configuration                        |
| Amazon Kinesis   | Stream name, region                                              |
| MongoDB/DocumentDB | Connection string                                             |
| Network         | VPC, subnet, security group for jobs running inside VPC         |

### Interview Q&A — Glue

**Q1: What is the Glue Data Catalog and why is it central to the AWS data lake architecture?**

A: The Glue Data Catalog is the persistent metadata repository for all data assets — it stores database/table definitions, column schemas, S3 locations, file formats, partition information, and statistics. It's central because multiple services share it: Athena queries use it to know where data is and what schema to apply; Redshift Spectrum uses it for external tables; EMR accesses it for Hive/Spark SQL tables; Lake Formation manages permissions on top of it. This unified catalog eliminates metadata silos — create a table definition once and all services can see it.

**Q2: Explain the difference between a DynamicFrame and a Spark DataFrame. When would you use each?**

A: DynamicFrame is Glue's abstraction built on top of Spark that handles schema flexibility. It tolerates missing columns, extra columns, and type inconsistencies (e.g., a column that is sometimes INT and sometimes STRING) without throwing errors. It stores type conflicts as a choice type and lets you resolve them explicitly. This is essential for raw data ingestion where producers don't always conform to a rigid schema. Spark DataFrames are stricter — mismatched types cause runtime failures. Use DynamicFrame for landing raw messy data; convert to DataFrame (`toDF()`) for heavy computation and when schema is known to be consistent.

**Q3: What is a Glue Job Bookmark and how does it enable incremental processing?**

A: A job bookmark is Glue's way of remembering what data has already been processed. For S3 sources, Glue records file ETags and modification timestamps; on the next run, only files modified after the last run are read. For JDBC sources, Glue tracks the max primary key value processed. This enables incremental ETL — instead of reprocessing all 5 TB of historical data daily, only the 50 MB of new data since yesterday is processed. This reduces job duration and cost dramatically. Bookmarks can be reset (reprocess all), paused (process current run without advancing state), or enabled/disabled per job.

**Q4: What are DPUs in Glue and how do you choose the right number?**

A: A DPU (Data Processing Unit) is Glue's compute unit: 4 vCPUs + 16 GB RAM. Glue charges per DPU-hour. For Standard workers, each worker is 2 DPUs. Choosing the right number involves: (1) start with auto-scaling (Glue 3.0+ supports worker auto-scaling within a range you set); (2) for fixed allocation, estimate data size and complexity — a 100 GB transform typically needs 10 workers; (3) G.1X workers give more memory per vCPU for memory-intensive operations (large joins, wide schemas); (4) G.025X workers are cost-effective for streaming jobs where each micro-batch is small. Profile job runs in CloudWatch to see if workers are CPU-bound or memory-bound and adjust accordingly.

**Q5: How do Glue Crawlers handle schema evolution? What are their limitations?**

A: When a crawler runs on a previously crawled location and detects schema changes (new columns, deleted columns, type changes), its behavior depends on the schema change policy configured: (1) Update the table definition in the Data Catalog to reflect the new schema; (2) Add new tables for newly discovered prefixes; (3) Mark tables as deprecated (not delete them) if their S3 path disappears. Limitations: crawlers have difficulty with tables where different partitions have wildly different schemas; they may make incorrect type inferences on poorly formatted data; they don't detect column renames (treats it as delete + add). For precise schema control, manually define tables in Athena or Glue.

**Q6: What is the difference between Glue ETL jobs and AWS Lambda for data transformation?**

A: Glue ETL is designed for large-scale, long-running transformations on datasets from GBs to TBs, using Apache Spark for parallelism. Lambda is designed for event-driven, short-duration functions (max 15 minutes) processing small payloads. Use Glue for: batch ETL across large S3 datasets, transforming millions of records, complex joins/aggregations. Use Lambda for: lightweight row-by-row transformations triggered by S3 events, enrichment of individual records, simple format conversions. In Kinesis Firehose pipelines, Lambda is often used for per-record transformation before Firehose delivers to S3 — this is appropriate because each record is small.

**Q7: How does Glue Streaming work and what is it connected to?**

A: Glue Streaming uses Apache Spark Structured Streaming to process data in near-real-time micro-batches. Input sources: Kinesis Data Streams or Apache Kafka (MSK). The job reads micro-batches, applies Spark/DynamicFrame transformations, and writes to S3, Glue Data Catalog targets, or other sinks. Checkpointing is used to track stream position (Kinesis sequence numbers or Kafka offsets) for fault tolerance. Workers use G.025X type for cost efficiency. Use cases: continuous ETL from event streams, real-time data lake ingestion with transformations, CDC (change data capture) from Kafka.

**Q8: Compare Glue DataBrew and Glue Studio. When do you use each?**

A: Glue Studio is a visual IDE for building Apache Spark-based ETL pipelines — it generates PySpark code and targets data engineers who want a visual canvas but may also write custom code. It handles large-scale batch and streaming ETL. Glue DataBrew is a no-code data preparation tool aimed at data analysts — it has 300+ visual transformations, data profiling, and is designed for data cleaning, normalization, and PII masking without any coding. Use DataBrew when: business analysts or data scientists need to clean/profile data independently; use Glue Studio when: data engineers need to build production-grade multi-step ETL pipelines with custom logic.

---

## Amazon Kinesis

### Overview

Amazon Kinesis is a family of four services for collecting, processing, and analyzing real-time streaming data:

1. **Kinesis Data Streams** — real-time data streaming with custom consumers
2. **Kinesis Data Firehose** — managed delivery to storage destinations
3. **Kinesis Data Analytics (Managed Apache Flink)** — stream processing with SQL or Flink
4. **Kinesis Video Streams** — video streaming and ML processing

---

### Kinesis Data Streams (KDS)

#### What Is It?

Kinesis Data Streams is a durable, real-time data streaming service. Producers push records to a stream; consumers pull and process those records. The stream is composed of **shards** — independently scaled units of capacity.

#### Core Architecture

```
Producers                  Kinesis Data Stream               Consumers
---------                  -------------------               ---------
EC2 instances   ─────►    Shard 1 (records sorted          KCL Application
IoT devices     ─────►    Shard 2  by sequence number)  ►  AWS Lambda
Mobile apps     ─────►    Shard 3                          Kinesis Analytics
Clickstream     ─────►    Shard 4                          Kinesis Firehose
```

#### Shard Capacity

Each shard provides:

| Direction | Throughput        | Record limit          |
|-----------|-------------------|-----------------------|
| Write (ingest) | 1 MB/s       | 1,000 records/second  |
| Read (consume) | 2 MB/s       | 5 reads/second (GetRecords) |
| Enhanced Fan-Out | 2 MB/s per consumer per shard | Push-based (SubscribeToShard) |

**Example:** You have 10,000 events/second averaging 0.5 KB each = 5 MB/s write throughput. You need at least 5 shards (5 MB/s ÷ 1 MB/s per shard). If 4 consumers read the stream simultaneously with enhanced fan-out, each gets 2 MB/s × 5 shards = 10 MB/s.

#### Partition Key

The partition key is a string included in each `PutRecord` call. Kinesis hashes the partition key (MD5) to assign the record to a specific shard:

- Records with the **same partition key always go to the same shard** → guaranteed ordering per partition key
- Distribute partition keys evenly to avoid hot shards (one shard receiving all traffic)
- Use a high-cardinality field as partition key (e.g., user_id, device_id) — not a low-cardinality field (e.g., country)

#### Sequence Number

Each record within a shard is assigned a monotonically increasing sequence number. Records within a shard are ordered by sequence number — this is the ordering guarantee Kinesis provides. Records across different shards have no ordering guarantee.

#### Retention Period

- Default: **24 hours** (1 day)
- Configurable: up to **365 days** (Extended Data Retention)
- 7-day retention: standard feature, additional cost
- 365-day retention: Long-Term Data Retention, additional cost per shard-hour
- Retention allows consumers to replay the stream — rewind to an earlier position and reprocess data

#### Enhanced Fan-Out

Standard GetRecords (polling): up to 5 reads/second per shard, shared among all consumers → if 5 consumers share 1 shard, each consumer gets at most 400 KB/s.

Enhanced Fan-Out (SubscribeToShard): each registered consumer gets a **dedicated 2 MB/s push connection per shard**, independent of other consumers. Eliminates consumer contention. Additional cost per shard-hour.

Use Enhanced Fan-Out when: multiple consumers need to process the same stream at full throughput simultaneously (e.g., Lambda for alerting + KCL for database writes + Firehose for archival — all at full speed).

#### Consumers

| Consumer              | Description                                                              |
|-----------------------|--------------------------------------------------------------------------|
| KCL (Kinesis Client Library) | Java/Python/Ruby library; manages shard leases, checkpointing via DynamoDB |
| AWS Lambda           | Event source mapping; Lambda polls shards or uses Enhanced Fan-Out      |
| Kinesis Data Firehose | Attach Firehose as a consumer; no custom processing, direct delivery    |
| Kinesis Data Analytics | Apache Flink jobs reading from the stream                              |
| Custom SDK consumers  | Direct GetRecords API calls for full control                            |

#### Capacity Modes

**Provisioned Mode:**
- You choose number of shards upfront
- You manage shard count manually (merge/split as needed)
- Cost: per shard-hour
- Best for: predictable, steady workloads where you know throughput requirements

**On-Demand Mode:**
- Kinesis automatically scales shards up and down based on observed throughput
- Scales to handle up to 200 MB/s write or 200,000 records/s by default
- No shard management required
- Cost: higher per-GB cost than provisioned, but no idle shard costs
- Best for: variable or unpredictable workloads, new streams where load is unknown

#### When to Use KDS

- You need **millisecond latency** between record production and consumption
- You need **custom processing logic** (anomaly detection, enrichment, stateful aggregation)
- Multiple independent consumers need to process the same data simultaneously
- You need **replay capability** — reprocess data from a point in time
- You need **ordering guarantees** per partition key
- Downstream pipeline is Lambda, Flink, or custom KCL application

---

### Kinesis Data Firehose

#### What Is It?

Kinesis Data Firehose is a fully managed **data delivery service** that buffers, optionally transforms, and reliably delivers streaming data to destinations. Unlike KDS, there are no consumers to write — Firehose handles all delivery mechanics automatically.

#### Delivery Destinations

| Destination        | Notes                                                            |
|--------------------|------------------------------------------------------------------|
| Amazon S3          | Primary destination; supports partitioning by date/time         |
| Amazon Redshift    | Via intermediate S3 + COPY command                              |
| Amazon OpenSearch  | Real-time log ingestion                                         |
| Splunk             | SIEM integration                                                |
| HTTP Endpoint      | Any custom REST endpoint                                        |
| Datadog            | Monitoring platform integration                                 |
| MongoDB            | Direct to MongoDB Atlas                                         |
| Snowflake          | Cloud data warehouse integration                                |
| New Relic          | Observability platform integration                              |

#### Buffering

Firehose does **not** deliver records one-by-one. It buffers data and flushes when either:
- **Size threshold** reached: 1 MB to 128 MB (default 5 MB for S3)
- **Time threshold** reached: 60 to 900 seconds (default 300 seconds for S3)

Whichever condition is met first triggers delivery. This means:
- Minimum latency is 60 seconds (at lowest time buffer)
- If stream is quiet and buffer size never fills, data is held until the time buffer expires
- For Redshift destination, Firehose first delivers to S3, then runs COPY into Redshift on a configurable schedule

#### Lambda Transformation

Before delivering to the destination, Firehose can invoke a Lambda function to transform each record:

```python
def lambda_handler(event, context):
    output = []
    for record in event['records']:
        # Decode base64 record
        payload = base64.b64decode(record['data']).decode('utf-8')
        data = json.loads(payload)
        
        # Transform: add field, filter, enrich
        data['processed_at'] = datetime.utcnow().isoformat()
        data['region'] = 'us-east-1'
        
        # Encode result
        output_record = {
            'recordId': record['recordId'],
            'result': 'Ok',
            'data': base64.b64encode(json.dumps(data).encode('utf-8')).decode('utf-8')
        }
        output.append(output_record)
    return {'records': output}
```

Records with result `'Dropped'` are discarded. Records with `'ProcessingFailed'` are sent to an error S3 prefix.

#### Format Conversion

Firehose can convert incoming JSON records to **Parquet or ORC** before delivering to S3:
- Uses the **Glue Data Catalog** table definition to get schema for conversion
- Converts at Firehose level — no ETL job needed
- Enables cost-optimized Athena queries without a separate conversion step

#### Compression

Firehose automatically compresses delivered files:
- Supported: GZIP, Snappy, Zip, Hadoop-compatible GZIP
- Applied at the destination (to the final output file, after transformation)
- Combined with Parquet format: very cost-efficient S3 storage

#### Dynamic Partitioning

Configure Firehose to dynamically partition S3 output based on record fields:
```
s3://my-bucket/data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/customer=!{partitionKeyFromQuery:customer_id}/
```
Creates Hive-compatible S3 prefix structures, making partitioned Athena tables directly queriable without a separate Glue Crawler run.

#### When to Use Firehose

- You just need to **reliably land data in S3, Redshift, or OpenSearch** — no custom processing
- Near-real-time is acceptable (60+ second latency)
- You want **zero consumer code** to write and maintain
- You need **automatic format conversion** to Parquet/ORC for data lakes
- You need **automatic compression** without custom code
- Small teams without streaming expertise who need operational simplicity

---

### Kinesis Data Analytics (Amazon Managed Service for Apache Flink)

#### What Is It?

Formerly Kinesis Data Analytics (SQL), now rebranded as **Amazon Managed Service for Apache Flink** — a fully managed service for running Apache Flink applications on streaming data.

Apache Flink is an open-source distributed stream processing framework supporting:
- Stateful computations over unbounded data streams
- Exactly-once processing semantics
- Event time processing (based on when events occurred, not when they arrived)
- Windowing: tumbling windows, sliding windows, session windows
- Complex event processing (CEP)

#### Languages Supported

- **Java** — primary Flink language, full API access
- **Scala** — Flink Scala API
- **Python** — PyFlink (Table API and DataStream API, with some limitations)
- **SQL** — Flink SQL for declarative stream processing (recommended for simpler use cases)

#### Flink SQL Example

```sql
-- Count events per user per 5-minute tumbling window
SELECT 
    user_id,
    COUNT(*) AS event_count,
    TUMBLE_START(event_time, INTERVAL '5' MINUTE) AS window_start,
    TUMBLE_END(event_time, INTERVAL '5' MINUTE) AS window_end
FROM event_stream
GROUP BY 
    user_id, 
    TUMBLE(event_time, INTERVAL '5' MINUTE);
```

#### Input Sources

- Kinesis Data Streams
- Apache Kafka (Amazon MSK or self-managed)

#### Output Sinks (Destinations)

- Amazon S3
- Amazon Redshift
- Amazon OpenSearch Service
- AWS Lambda (for triggering downstream actions)
- Another Kinesis Data Stream
- Amazon Kinesis Data Firehose (for further delivery)
- Apache Kafka

#### Use Cases

- Real-time dashboards (aggregate metrics every 10 seconds)
- Anomaly detection (flag unusual patterns as they occur)
- Real-time ETL (transform and enrich events before storing)
- Alert generation (trigger alerts when fraud patterns detected)
- Sessionization (group events into user sessions with session windows)
- Continuously refreshed materialized views

---

### Kinesis Video Streams

#### What Is It?

Kinesis Video Streams ingests live video, audio, and time-serialized data from:
- IP cameras
- Security cameras
- Drones, dashcams
- Audio feeds, RADAR data
- Any device with the Kinesis Video Streams SDK

#### Capabilities

- **Durable storage**: store video data for configurable retention period
- **Playback**: HTTP Live Streaming (HLS) or DASH for video playback in browsers
- **ML integration**: Amazon Rekognition Video for facial recognition, object detection; custom ML models
- **WebRTC**: low-latency two-way streaming for video conferencing, remote control
- **Fragments**: video is stored as time-indexed fragments; consumers can request specific time ranges

#### Use Cases

- Smart home security camera feeds with Rekognition for person detection
- Industrial machine monitoring with anomaly detection on video feeds
- Traffic monitoring and vehicle counting
- Telemedicine: remote patient monitoring

---

### Kinesis Data Streams vs Firehose Comparison

| Dimension              | Kinesis Data Streams                          | Kinesis Data Firehose                           |
|------------------------|-----------------------------------------------|-------------------------------------------------|
| Management overhead    | You manage consumers (KCL, Lambda code)       | Fully managed — no consumer code needed         |
| Latency                | Milliseconds (real-time)                      | 60–900 seconds (near-real-time)                 |
| Consumer flexibility   | Any custom processing logic                   | Fixed destinations (S3, Redshift, OpenSearch…)  |
| Replay capability      | Yes — up to 365 days                          | No — data delivered and gone                    |
| Scaling                | Manual (provisioned) or auto (on-demand)      | Fully automatic                                 |
| Number of consumers    | Multiple independent consumers simultaneously | One delivery destination (with optional Lambda) |
| Data transformation    | Fully custom in consumer code                 | Lambda transformation (per record), format conv |
| Cost model             | Per shard-hour + PUT payload units            | Per GB ingested (no shard cost)                 |
| Typical use case       | Real-time processing, alerting, stream joins  | Log archival, S3 data lake landing, ETL pipelines |
| Ordering guarantee     | Per shard (per partition key)                 | No ordering guarantee                           |
| Fan-out                | Enhanced fan-out: multiple consumers at speed | Single delivery path                            |

---

### Interview Q&A — Kinesis

**Q1: Explain the concept of shards in Kinesis Data Streams. How do you determine the right number of shards?**

A: A shard is the base unit of capacity: 1 MB/s write, 2 MB/s read, up to 1,000 records/second write. To determine shard count: (1) Calculate peak write throughput in MB/s (max_records_per_second × average_record_size_KB ÷ 1024). Divide by 1 MB/s per shard. Round up. (2) Calculate read throughput: if using standard polling with N consumers, each consumer needs 2 MB/s × number_of_shards; if using enhanced fan-out, each consumer gets dedicated 2 MB/s per shard. (3) Add 20-25% headroom for spikes. In on-demand mode, Kinesis handles this automatically up to the service limits.

**Q2: What is a hot shard and how do you prevent it?**

A: A hot shard occurs when a disproportionate amount of traffic is routed to one shard due to a skewed partition key distribution. For example, if all records use `partition_key = "US"`, every record goes to the same shard, which hits the 1 MB/s limit while other shards sit idle. Prevention: (1) Use high-cardinality fields as partition keys (user_id, device_id, UUID). (2) If a low-cardinality field is needed, append a random suffix to the key: `country + "_" + random(1, 100)` — this spreads load across 100 effective partition keys. (3) Use on-demand mode — it rebalances shards based on actual traffic patterns.

**Q3: What is the difference between enhanced fan-out and standard polling in Kinesis?**

A: Standard polling uses GetRecords API: consumers poll each shard up to 5 times/second, receiving up to 2 MB/s read throughput. This 2 MB/s is **shared** among all consumers — if 4 consumers poll the same shard, each effectively gets ~500 KB/s. Enhanced fan-out uses SubscribeToShard (HTTP/2 push): each registered consumer gets a **dedicated 2 MB/s push connection per shard**, independent of other consumers. No polling needed; records are pushed as they arrive. This eliminates consumer contention. Enhanced fan-out costs more (~$0.015 per shard-hour + $0.013 per GB), but is essential when multiple consumers must process the same stream at full throughput concurrently.

**Q4: You have real-time clickstream data. Some downstream systems need it in 100ms (fraud detection), others need it in S3 for next-day analysis. How do you architect this?**

A: Use **Kinesis Data Streams** as the backbone. Producers write clicks to KDS. Two consumers: (1) A Lambda function with Enhanced Fan-Out subscription processes records in real-time (100ms latency) for fraud detection, calling a fraud scoring API and taking immediate action. (2) Kinesis Data Firehose is attached to the same KDS stream, buffers data (5 min / 128 MB), converts to Parquet using Glue schema, compresses with Snappy, and delivers to S3 with dynamic date-based partitioning for next-day Athena analysis. Both consumers operate independently at their own throughput without interfering with each other.

**Q5: Kinesis Data Firehose is delivering records to S3 with duplicate entries. Why might this happen and how do you handle it?**

A: Firehose provides **at-least-once delivery semantics** — in rare cases of network failures or retries during delivery, a record may be written more than once. Causes: Firehose retries after transient S3 write failures; Lambda transformation function timed out and was retried. Handling: (1) Make your downstream consumers idempotent — use a unique record ID to deduplicate. (2) At query time (e.g., Athena), use `SELECT DISTINCT` or `ROW_NUMBER() OVER (PARTITION BY record_id ORDER BY ingested_at)` to deduplicate. (3) Use Firehose delivery retry settings to limit retry count (fewer retries = fewer duplicates, but higher risk of data loss).

**Q6: When would you use Managed Apache Flink (Kinesis Data Analytics) instead of Lambda for stream processing?**

A: Use Managed Apache Flink when: (1) **Stateful processing** — aggregating events over time windows (e.g., sum revenue per user per 5-minute window), joining two streams with a temporal window, sessionizing events. Lambda is stateless; maintaining state in DynamoDB or ElastiCache adds complexity. (2) **Complex event processing** — detecting patterns like "3 failed login attempts within 30 seconds." (3) **High throughput** — Flink handles millions of events/second with sub-second latency; Lambda has concurrency limits. (4) **Event-time semantics** — Flink handles late-arriving events with watermarks; Lambda has no built-in concept. Use Lambda for: simple record-by-record transformations, enrichment from an API, format conversion, when stateful window operations aren't needed.

**Q7: Explain Kinesis Data Streams retention and replay. When is this valuable?**

A: KDS retains records from 24 hours (default) up to 365 days. Consumers track their position via a **shard iterator** (or checkpoint in KCL). Replay works by resetting the iterator to a specific sequence number, timestamp, or TRIM_HORIZON (beginning of retention window). Value: (1) A new consumer joins the stream and needs to backfill from the beginning. (2) A bug in a consumer caused incorrect processing — fix the bug and replay from before the bug was introduced. (3) Testing a new consumer version against real historical traffic before switching production consumers. This is impossible with Firehose (data is gone after delivery) or SQS (message is deleted after consumption).

**Q8: How do you achieve exactly-once processing semantics with Kinesis Data Streams?**

A: KDS itself provides **at-least-once** delivery (checkpointing means you might reprocess records after a failure). Achieving exactly-once requires the consumer to be idempotent: (1) **KCL with DynamoDB checkpointing**: KCL checkpoints sequence numbers to DynamoDB. After a failure, KCL reprocesses from the last checkpoint. Make your processing logic idempotent — use the sequence number as an idempotency key in downstream writes (e.g., `INSERT ... ON CONFLICT (sequence_number) DO NOTHING`). (2) **Managed Flink (Apache Flink)**: natively supports exactly-once semantics using two-phase commit protocol with Flink checkpoints — the state is consistent with the output sink. (3) For S3 destinations: write to a temp file; only rename/move on success; reprocessing a duplicate record will overwrite the same temp file.

**Q9: What is the difference between Kinesis and SQS for decoupling producers and consumers?**

A: SQS is a message queue — each message is consumed once by one consumer, then deleted. It's designed for task distribution (one producer, one consumer processing). KDS is a data stream — records persist for up to 365 days and can be read by multiple independent consumers simultaneously, each with their own position (shard iterator). SQS has no ordering guarantee (standard queue) or per-message-group ordering (FIFO queue, limited throughput). KDS guarantees ordering per shard. Use SQS for: job queues, task distribution, microservice decoupling. Use KDS for: multiple consumers processing the same event stream, replay capability, ordered processing, real-time analytics.

**Q10: A Kinesis consumer is falling behind (growing iterator age). What are the possible causes and fixes?**

A: Iterator age is the age of the last record read by the consumer — if growing, the consumer isn't keeping up with ingestion. Causes and fixes: (1) **Consumer too slow**: optimize consumer processing logic; add parallelism within the consumer. (2) **Too few shards**: add shards (split existing shards) to increase read throughput. (3) **Throttling on GetRecords**: switch to enhanced fan-out for dedicated throughput per consumer. (4) **Lambda concurrency limit**: increase Lambda reserved concurrency. (5) **Downstream bottleneck** (e.g., RDS write limit): batch writes to downstream systems; use a write buffer. (6) **Data format parsing overhead**: pre-aggregate or pre-validate data before writing to stream; use binary format (Avro, Protobuf) instead of JSON. Monitor `GetRecords.IteratorAgeMilliseconds` in CloudWatch for early detection.

---

## Amazon EMR

### What Is Amazon EMR?

Amazon EMR (Elastic MapReduce) is a **managed big data platform** that runs open-source distributed data processing frameworks on a cluster of EC2 instances. EMR handles cluster provisioning, configuration, framework installation, monitoring, and auto-scaling, eliminating the operational overhead of managing Hadoop/Spark infrastructure manually.

### Supported Frameworks

| Framework       | Purpose                                              |
|-----------------|------------------------------------------------------|
| Apache Spark    | In-memory distributed data processing, ML (MLlib)   |
| Apache Hive     | SQL-like queries on Hadoop (HiveQL)                  |
| Apache HBase    | NoSQL distributed database on HDFS                  |
| Presto/Trino    | Fast SQL query engine (similar to Athena's engine)  |
| Apache Flink    | Real-time stream processing                         |
| Apache Pig      | Scripting language for Hadoop data flows             |
| Apache MXNet    | Distributed deep learning                           |
| JupyterHub      | Notebooks for interactive Spark development          |
| Apache Zeppelin | Collaborative notebooks                             |
| Ganglia         | Monitoring for EMR clusters                         |

### Cluster Types

**Long-Running Clusters:**
- Cluster remains active continuously (24/7)
- Jobs are submitted interactively or on a schedule
- Data may live in HDFS on the cluster
- Higher cost (paying for idle time)
- Use case: interactive data exploration, frequent recurring jobs, HBase database that must stay running

**Transient Clusters:**
- Cluster starts, runs a specific job (or set of jobs), stores output to S3, then terminates
- Pay only for job execution time
- Much lower cost than long-running clusters
- Use case: nightly batch jobs, one-time data migrations, dev/test processing
- Best practice for most batch EMR workloads

### Node Types

**Master Node (Primary Node):**
- Coordinates the cluster: runs YARN ResourceManager, HDFS NameNode, Spark Driver (for cluster mode)
- One master node per cluster (no HA by default; EMR 6.x supports multi-master for HA)
- Does not store HDFS data blocks
- Should use On-Demand instance to avoid job failure if spot is reclaimed

**Core Nodes:**
- Store HDFS data (DataNode) AND execute tasks (YARN NodeManager)
- Losing a core node means potential HDFS data loss
- Use On-Demand or Reserved instances for stability
- Minimum: 1 core node (required for HDFS)

**Task Nodes:**
- Execute tasks only (YARN NodeManager) — do not store HDFS data
- Stateless: losing a task node doesn't lose data; YARN re-schedules the failed task
- Perfect candidates for **Spot instances** (up to 90% cost savings)
- Add or remove task nodes dynamically based on workload
- Good for burst capacity during peak processing windows

### EMR Serverless

EMR Serverless removes the need to provision or manage EC2 clusters:
- Specify which framework (Spark or Hive)
- Submit jobs directly — EMR Serverless provisions compute automatically
- Scales from zero (no idle cost) to handling large jobs
- Pre-initialized capacity: optionally keep some workers warm for faster cold start
- Good for: teams that want Spark power without cluster management, variable workloads

### EMR on EKS

Run EMR jobs (Spark) on existing Amazon EKS (Kubernetes) clusters:
- Share Kubernetes infrastructure between EMR jobs and other containerized workloads
- Kubernetes resource isolation (namespaces, resource quotas)
- Use Kubernetes node groups with Spot instances for cost optimization
- Multi-framework on the same cluster: run Spark, Flink, PyTorch alongside EMR
- Good for: organizations standardizing on Kubernetes infrastructure

### Storage: EMRFS vs HDFS

**HDFS (Hadoop Distributed File System):**
- Data stored locally on EC2 instance disks attached to core nodes
- Fast random read/write (local disk, no S3 API calls)
- Data is lost if core nodes are terminated (no persistence beyond cluster)
- Only accessible within the cluster
- Use for: intermediate data (shuffle output, temporary working data), data that's read/written many times within a job

**EMRFS (EMR File System):**
- Abstraction layer that presents S3 as if it were HDFS
- Data persists beyond cluster lifetime
- Accessible by any EMR cluster, Athena, Redshift Spectrum, Glue
- Higher latency than HDFS (S3 API calls vs local disk I/O)
- Essentially unlimited storage (S3 capacity)
- Use for: input data, final output, any data that needs to persist

**Best Practice:** Store all input/output in S3 (EMRFS). Use HDFS only for intermediate shuffle data within a multi-stage job. Terminate the cluster after job completion — S3 data persists; cluster cost stops.

### Cost Optimization

1. **Spot instances for Task nodes**: Task nodes hold no HDFS data; Spot interruptions just reschedule tasks. Savings: 50-90% vs On-Demand.
2. **Transient clusters**: start, process, terminate. Pay only for job time.
3. **Managed Scaling**: EMR auto-scales core and task nodes based on YARN metrics (pending containers, free memory). Set min/max bounds.
4. **Right-size instance types**: use R-series for memory-intensive Spark jobs, C-series for compute-bound, D-series for HDFS-heavy workloads.
5. **EMR Serverless**: zero idle cost; only pay for vCPU-hours and memory-hours during job execution.

### When EMR vs Glue

| Dimension              | Amazon EMR                                            | AWS Glue                                              |
|------------------------|-------------------------------------------------------|-------------------------------------------------------|
| Complexity             | Full Spark/Hadoop cluster; more control and tuning    | Managed Spark; less control                           |
| Configuration          | Choose instance types, Spark config, YARN settings    | Choose DPUs; limited Spark configuration              |
| Custom libraries       | Install any library on cluster nodes                  | Limited to bundled libraries + .egg/.jar uploads      |
| ML workloads           | Excellent — Spark MLlib, TensorFlow, PyTorch on EMR  | Not designed for ML                                   |
| Cluster management     | Manage cluster lifecycle yourself (or Serverless)     | Fully serverless                                      |
| Data Catalog           | Uses Glue Data Catalog via configuration              | Native Glue Data Catalog integration                  |
| Best for               | Complex Spark/Hadoop jobs, ML, custom frameworks      | Standard ETL, data catalog updates, simpler transforms|

---

## Amazon OpenSearch Service

### What Is OpenSearch Service?

Amazon OpenSearch Service (formerly Amazon Elasticsearch Service) is a managed service for deploying, operating, and scaling **OpenSearch clusters**. OpenSearch is an open-source fork of Elasticsearch (and Kibana), maintained by AWS and the community after Amazon's 2021 fork from Elasticsearch.

OpenSearch is a distributed, document-oriented search and analytics engine. Data is stored as JSON documents in **indices**. Each document is analyzed, tokenized, and stored in an **inverted index** — enabling fast full-text search.

### Use Cases

| Use Case                    | Description                                                          |
|-----------------------------|----------------------------------------------------------------------|
| Log analytics               | Ingest, search, and visualize application/infrastructure logs        |
| Full-text search            | Product catalog search, document search, e-commerce                 |
| Application monitoring      | Trace analysis, error rate visualization, APM                       |
| Clickstream analytics       | Real-time behavioral analytics                                       |
| Security analytics          | SIEM — security event correlation and threat hunting                |
| Geospatial analytics        | Location-based queries and visualizations                           |

### Cluster Architecture

**Master Nodes (Dedicated):**
- Manage cluster state: index creation/deletion, node joins/leaves, shard allocation
- Recommended: 3 dedicated master nodes for production (prevents split-brain)
- Do not store data; isolated from data operations

**Data Nodes:**
- Store index shards (primary + replica shards)
- Execute search and indexing requests
- Scale out by adding more data nodes

**UltraWarm Nodes:**
- Lower-cost storage tier for less-frequently accessed data
- Uses S3 as backing store with local cache
- Cost ~90% less per GB than standard data nodes
- Suitable for logs older than 7-14 days that are still occasionally queried

**Cold Storage:**
- Cheapest tier: data stored in S3, nodes allocated only when data is actually accessed
- Very low query frequency use case (monthly compliance queries on old data)
- Data is "detached" when not in use; attach/query/detach

### OpenSearch Dashboards

OpenSearch Dashboards (formerly Kibana) is the built-in visualization interface:

- **Discover**: search and filter documents in real-time; view individual documents
- **Visualize**: create bar charts, pie charts, line graphs, data tables, maps
- **Dashboard**: combine multiple visualizations into interactive dashboards
- **Canvas**: presentation-ready custom layouts
- **Maps**: geospatial data visualization
- **Dev Tools**: interact with OpenSearch REST API via a console

### Ingestion Methods

| Method                  | Description                                                              |
|-------------------------|--------------------------------------------------------------------------|
| Kinesis Data Firehose   | Stream → Firehose → OpenSearch; fully managed                           |
| AWS Lambda              | Event-triggered indexing; process and index from DynamoDB, S3, etc.     |
| Logstash                | Open-source log pipeline with many input plugins                        |
| OpenSearch Ingestion    | AWS-managed Logstash-compatible pipeline service                        |
| Direct REST API         | Client applications index documents directly via HTTP                  |
| AWS IoT                 | IoT rules forward device data to OpenSearch                             |

### Index Lifecycle Management (ILM)

Automate index management over time:
- **Hot phase**: active indexing and searching; high-performance data nodes
- **Warm phase**: reduced query frequency; move to UltraWarm nodes
- **Cold phase**: very infrequent queries; move to cold storage
- **Delete phase**: index age exceeds retention; delete automatically

Policies are defined in JSON and applied to index patterns. New daily indices (e.g., `logs-2024-01-15`) automatically transition through phases as they age.

### OpenSearch Serverless

OpenSearch Serverless removes cluster management:
- No need to provision data nodes or master nodes
- Automatically scales based on query and indexing load
- Priced per OCU-hour (OpenSearch Compute Unit) and storage
- Two collection types: **Time Series** (log analytics) and **Search** (full-text search)
- Good for: variable workloads, teams avoiding operational overhead

---

## Amazon QuickSight

### What Is QuickSight?

Amazon QuickSight is a fully managed, cloud-native **Business Intelligence (BI) and data visualization service**. It enables analysts and business users to create interactive dashboards, perform ad-hoc data exploration, and share insights across an organization — without managing servers, BI software, or licenses.

### Data Sources

QuickSight connects to a wide range of data sources:

| Category            | Sources                                                              |
|---------------------|----------------------------------------------------------------------|
| AWS native          | S3, Athena, Redshift, Aurora, RDS (MySQL/PostgreSQL), OpenSearch    |
| AWS analytics       | S3 with Glue Catalog, Timestream                                    |
| SaaS                | Salesforce, ServiceNow, Adobe Analytics, GitHub, JIRA              |
| External JDBC       | Snowflake, Databricks, any JDBC-compatible database                 |
| File upload         | CSV, TSV, XLSX, JSON (up to 1 GB)                                   |

### SPICE (Super-fast Parallel In-memory Calculation Engine)

SPICE is QuickSight's in-memory data store and calculation engine:

- Data is imported from source into SPICE for dramatically faster query performance
- Queries run against SPICE in-memory data, not hitting the source database
- Capacity: 10 GB per user by default; purchasable up to petabyte scale
- Auto-refresh: schedule data refresh from source (hourly, daily, weekly)
- Not required: can query directly without SPICE import (Direct Query mode), which is slower but always shows current data
- SPICE is replicated across multiple AZs for high availability

### Chart Types

QuickSight supports a rich library of visualizations:
- **Bar charts**: grouped, stacked, horizontal
- **Line charts**: trend over time, multi-metric
- **Pie / donut charts**: part-to-whole relationships
- **Scatter plots**: correlation between two measures
- **Heat maps**: correlation matrix visualization
- **Tree maps**: hierarchical proportional area
- **Pivot tables**: tabular cross-tabulation
- **KPI widgets**: single metric with trend comparison
- **Gauge charts**: progress toward goal
- **Geospatial maps**: point, choropleth (filled map) for geographic data
- **Word clouds**: frequency visualization for text data
- **Funnel charts**: conversion analysis

### ML Insights

QuickSight includes built-in ML capabilities powered by Amazon ML:

- **Anomaly Detection**: automatically detects anomalies in time-series data using Random Cut Forest algorithm; highlights outliers on charts
- **Forecasting**: ML-based time-series forecasting; configurable confidence intervals
- **Narrative Summaries (Q Auto-Narrative)**: automatically generates natural-language summaries of chart insights ("Revenue increased 15% compared to last month, primarily driven by the US West region")
- **Amazon Q in QuickSight**: natural-language BI — ask questions in plain English ("Show me sales by region for Q3") and QuickSight generates the visualization

### Embedded Analytics

Embed QuickSight dashboards inside your own applications:

- **Embedded dashboards**: authenticated users see QuickSight dashboards inside your app without knowing it's QuickSight
- **Embedded consoles**: full authoring experience embedded in your application
- **Anonymous embedding**: public dashboards accessible without QuickSight accounts (no user management needed)
- Integration via RegisteredUser embedding URL API or 1-click embedding
- Use case: ISVs embedding analytics in their SaaS product, internal portals showing role-specific dashboards

### Row-Level Security (RLS)

Control which rows each user can see in a dataset:

- Create a dataset rules file: maps user names (or group names) to filter values
- Example: Sales Rep A can only see rows where `region = 'US-West'`; Sales Rep B can only see `region = 'Europe'`
- Rules file stored in S3 or as a QuickSight dataset
- Applies transparently: users never see data they're not permitted to see; they don't know rows are filtered

### Column-Level Security

- Restrict which columns are visible per user or group
- Example: HR dashboards show salary data to HR managers but hide it from department heads

### Pricing

| Tier        | Price           | Capabilities                                                    |
|-------------|-----------------|------------------------------------------------------------------|
| Author      | $18–$24/month   | Create and publish dashboards; full authoring; SPICE access     |
| Reader      | $5/month or pay-per-session ($0.30/session, max $5/month) | View and interact with dashboards only |
| Q (add-on) | Additional cost | Natural language queries against QuickSight datasets            |

Sessions: A reader session is 30 minutes of activity. Pay-per-session pricing is cost-effective for infrequent dashboard viewers.

---

## AWS Lake Formation

### What Is Lake Formation?

AWS Lake Formation is a service that makes it easy to **set up, secure, and manage a data lake on Amazon S3**. A data lake is a centralized repository storing structured, semi-structured, and unstructured data at any scale. Lake Formation provides:

1. **Centralized permissions** — fine-grained access control for data lake assets
2. **Data ingestion blueprints** — automate moving data from databases to S3
3. **Governed Tables** — ACID transactional tables on S3
4. **Cross-account data sharing** — share data lake tables with other AWS accounts

### The Problem Lake Formation Solves

Before Lake Formation: permissions for data lake access were managed at the S3 bucket/prefix level (coarse-grained IAM + bucket policies). You couldn't say "this user can query this table but only see rows where region='US' and can't see the salary column." Lake Formation adds a permissions layer on top of S3 + Glue Data Catalog that enables column-level, row-level, and cell-level security.

### Fine-Grained Access Control

Lake Formation permissions operate at multiple granularities:

**Database level:** `GRANT ALL ON DATABASE sales_db TO ROLE analysts;`

**Table level:** `GRANT SELECT ON TABLE sales_db.orders TO ROLE analysts;`

**Column level:** Grant SELECT on specific columns only; hide sensitive columns (e.g., SSN, salary) from certain roles.

**Row level (Row Filters):** Define filter expressions that restrict which rows a principal can see. Example: `region = 'US-East'` — users with this filter applied only see rows matching the condition.

**Cell level:** Combine column and row filtering for cell-level security.

**Data Filters:** Defined as reusable filter objects; attach to principals. Lake Formation enforces these filters whenever Athena, Redshift Spectrum, or EMR queries the table via the catalog.

### Governed Tables

Governed Tables (Iceberg format on S3) provide:

- **ACID transactions**: multiple concurrent writers can modify the table; readers see consistent snapshots; failed writes are rolled back
- **Time travel**: query the table as it existed at any point in time (`SELECT * FROM table FOR SYSTEM_TIME AS OF '2024-01-01'`)
- **Schema evolution**: add/rename/drop columns safely
- **Compaction**: automatic small file compaction for query performance

This brings data warehouse-like transactional guarantees to S3-based data lakes.

### Data Lake Blueprints

Blueprints automate ingesting data from operational sources into the data lake:

- **Incremental database ingestion**: connect to RDS, Aurora (MySQL/PostgreSQL); Lake Formation automatically creates Glue workflows to incrementally load changed records to S3
- **Log file ingestion**: import CloudTrail, ELB access logs, etc.
- **Full load**: initial one-time full copy from a database table
- Blueprints generate Glue crawlers and ETL jobs automatically; you don't write any code

### Cross-Account Data Sharing

Share data lake assets with other AWS accounts using AWS Resource Access Manager (RAM):

- Producer account: creates a Data Catalog resource share (database, tables) via RAM and grants LF permissions to consumer account's IAM principals
- Consumer account: subscribes to the share; sees the tables in their own Glue Data Catalog under a resource link
- Consumer queries the table via Athena/Redshift Spectrum; Lake Formation enforces the producer's column/row-level permissions on behalf of the consumer
- No data copying — consumers query producer's S3 data directly with enforced access controls

### Integration with Analytic Services

| Service               | How It Integrates                                                        |
|-----------------------|--------------------------------------------------------------------------|
| Amazon Athena         | Respects LF column/row/cell-level permissions; LF registered S3 buckets |
| Redshift Spectrum     | External tables inherit LF permissions                                  |
| Amazon EMR            | EMR Spark jobs can use LF credentials for fine-grained access           |
| AWS Glue              | LF manages Glue Data Catalog permissions                                |
| QuickSight            | Athena datasets governed by LF automatically restrict QuickSight views  |

---

## Comprehensive Interview Q&A

### All Data Analytics Services — 15 Questions

**Q1: Walk me through the end-to-end architecture of a real-time data lake pipeline on AWS.**

A: Here's a production-grade architecture: (1) **Ingestion**: IoT devices and application servers send events to **Kinesis Data Streams** (millisecond latency, ordered per partition key, replay capability). (2) **Real-time processing**: A **Managed Apache Flink** job reads from KDS, aggregates events in 5-minute tumbling windows, detects anomalies, and writes real-time metrics to **OpenSearch Service** for live dashboards. (3) **Landing in data lake**: A second consumer (**Kinesis Data Firehose**) buffers the same stream, converts JSON to Parquet using **Glue schema**, adds dynamic S3 partitioning (year/month/day), and delivers compressed files to **S3** (raw zone). (4) **Cataloging**: A **Glue Crawler** runs hourly to update partition metadata in the **Glue Data Catalog**. (5) **Transformation**: **Glue ETL jobs** (Spark) run nightly to clean/transform raw data and write it to S3 curated zone in optimized Parquet, also updating the catalog. (6) **Access control**: **AWS Lake Formation** applies column and row-level permissions on the Glue Data Catalog tables. (7) **Ad-hoc exploration**: Data scientists use **Amazon Athena** to query curated S3 data with SQL, respecting Lake Formation permissions. (8) **BI reporting**: **Amazon QuickSight** connects to Athena (with SPICE import for dashboard performance) for executive dashboards with Row-Level Security per business unit. (9) **Redshift for reporting**: For complex multi-join analytical queries run hourly by the finance team, data is loaded into **Amazon Redshift** via COPY from S3; Redshift Spectrum joins internal tables with raw archival data in S3.

**Q2: Compare Redshift, Athena, and EMR/Spark for a given use case: analyzing 100 TB of log data stored in S3.**

A: For 100 TB of log data in S3, the choice depends on query patterns and team: **Athena** is best for ad-hoc, infrequent queries — $5/TB × 100 TB = $500 per full scan, but with Parquet + partitioning, a typical query might scan 1 TB = $5. Zero setup; ideal for exploration. **Redshift Spectrum** is best if you also have internal Redshift tables to join against — query S3 with the full power of Redshift's query planner, joining with loaded data. **EMR/Spark** is best for programmatic transformations: filtering, aggregation, ML feature engineering, writing out processed results; gives full Spark API flexibility. **Athena** is the simplest for SQL-only analytics; **EMR** for data engineering workflows on this dataset.

**Q3: Explain the role of the Glue Data Catalog in the AWS data lake ecosystem.**

A: The Glue Data Catalog is the **single source of truth for metadata** in the AWS data lake. It answers: "Where is this data? What format is it in? What are the column names and types? What partitions exist?" Without a catalog, each service would need its own schema definition — tables defined separately in Athena, Redshift Spectrum, and EMR. With the Glue catalog: define a table once; Athena, Redshift Spectrum, and EMR all see it immediately. Lake Formation adds permission management on top of the catalog metadata. Glue Crawlers automate catalog population. The result: a unified, discoverable data asset registry for the entire organization.

**Q4: A Kinesis Data Streams application is experiencing read throttling (ProvisionedThroughputExceededException). What do you do?**

A: ProvisionedThroughputExceededException on reads means the 2 MB/s or 5 reads/second per shard limit is exceeded. Solutions: (1) **Enhanced fan-out**: each consumer gets dedicated 2 MB/s per shard, eliminating shared read throughput contention — use SubscribeToShard instead of GetRecords. (2) **Increase shard count**: split hot shards to add more read capacity (but adds cost). (3) **Optimize consumer**: batch records in fewer larger GetRecords calls (up to 10,000 records per call, max 10 MB); reduce GetRecords call frequency. (4) **Exponential backoff and retry**: implement in consumer code to gracefully handle transient throttles without cascading failures. (5) Switch to **on-demand capacity mode** which auto-scales shard count.

**Q5: When would you choose Kinesis Data Firehose over Kinesis Data Streams for a given project?**

A: Choose Firehose when: (1) The only goal is reliably landing streaming data in S3, Redshift, or OpenSearch — you don't need custom real-time processing. (2) You want zero consumer code: no KCL application, no Lambda stream-processing function to write and maintain. (3) Near-real-time is acceptable (60 seconds minimum latency). (4) You want automatic Parquet conversion and compression without ETL jobs. (5) Team lacks streaming expertise. Choose Kinesis Data Streams when: (1) You need millisecond latency. (2) Multiple independent systems must consume the same stream. (3) You need to replay data. (4) Custom stateful processing (aggregations, joins) is required. In many architectures, both are used together: KDS for real-time processing → Firehose also attached to KDS for archival, providing both capabilities.

**Q6: Explain Redshift's distribution styles and why they matter for query performance.**

A: Distribution styles determine how rows are spread across compute node slices, which determines whether queries require inter-node data shuffling (slow network I/O) or can be answered locally. EVEN distributes rows round-robin — great for tables that aren't joined, but joins require redistributing rows. KEY distributes rows by column value — if two large tables use the same distribution key (the join column), matching rows already live on the same slice, eliminating all redistribution. ALL copies the entire table to every node — ideal for small dimension tables so every node has a local copy for joining with the large fact table. The goal: design distribution styles so the query engine can execute joins without moving data across the network.

**Q7: What is EMR Spot Instance strategy and what happens when a Spot instance is reclaimed?**

A: EMR uses a two-tier strategy: On-Demand for master and core nodes (never risk data loss or job failure), Spot for task nodes (stateless, no HDFS data). When a Spot task node is reclaimed by EC2: YARN detects the node is lost, marks its running containers as failed, and re-schedules those tasks on remaining nodes. With checkpointing (Spark's RDD checkpointing or application-level checkpointing), only the work done since the last checkpoint is redone — not the entire job. EMR's managed scaling can automatically replace reclaimed Spot instances with new Spot capacity or fall back to On-Demand if Spot is unavailable. Spot savings: 50-90% vs On-Demand for task node compute.

**Q8: A business analyst says their Athena query costs $150 per run and takes 45 minutes. How do you optimize it?**

A: Step 1: Check the data format — if CSV, convert to Parquet using a Glue ETL job. Parquet typically reduces scanned data by 85-95% → cost drops from $150 to $7.50. Step 2: Check partitioning — if the WHERE clause filters on date/region and the table isn't partitioned, add partitioning and migrate data into partitioned S3 structure. Reduces scanned data proportional to partition selectivity. Step 3: Check file size — if thousands of small files exist, compact to 128 MB-1 GB Parquet files. Step 4: Check compression — Snappy or ZSTD for Parquet. Step 5: For the same query run repeatedly, enable result reuse. Step 6: If this query runs on the same data daily for a BI dashboard, consider loading the data into Redshift for consistent sub-second performance.

**Q9: Explain Lake Formation's column-level and row-level security and how it compares to S3 bucket policies.**

A: S3 bucket policies control access at the bucket/prefix level — you can allow/deny a principal access to `s3://bucket/prefix/*`. You can't say "this principal can see this S3 file but only the 'name' and 'age' columns, not 'ssn', and only rows where 'department=engineering'." Lake Formation's fine-grained access control adds this expressiveness on top of the Glue Data Catalog layer. Column-level security hides specific columns from a principal — they can query the table but the restricted columns return no data. Row-level filters apply SQL-like expressions per principal, restricting which rows they can see. Cell-level combines both. Enforced by Athena, Redshift Spectrum, and EMR at query time — the service checks LF permissions before executing the query.

**Q10: What is Redshift Serverless and when would you choose it over a provisioned cluster?**

A: Redshift Serverless eliminates cluster provisioning — no choosing node types, no managing cluster size, no paying for idle capacity. It automatically scales compute (RPUs) based on query demand, from idle (zero cost) to whatever is needed for peak queries. Choose Serverless when: (1) Workload is intermittent or unpredictable; (2) Team doesn't want cluster management overhead; (3) Development/test environments; (4) Small to medium analytical workloads. Choose provisioned when: (1) Workload is steady and predictable — Reserved Instance pricing gives 75% savings over On-Demand; (2) You need maximum control over cluster configuration (node count, WLM, maintenance windows); (3) Very large clusters where Serverless RPU costs exceed provisioned cluster costs.

**Q11: How does Glue DataBrew differ from Glue Studio, and what business problem does each solve?**

A: Glue DataBrew is a **no-code visual data preparation tool** designed for data analysts and data scientists who aren't comfortable writing code. It provides 300+ visual transformations (handle nulls, normalize formats, encode categoricals, mask PII), profiling dashboards showing data quality statistics, and recipe-based transformation that non-engineers can create and maintain. Glue Studio is a **visual ETL pipeline builder** for data engineers — it generates Apache Spark code from a drag-and-drop canvas, supports complex multi-step pipelines, and targets production ETL workflows at scale. DataBrew is for "clean and prepare this dataset for analysis." Glue Studio is for "build and maintain a reliable nightly pipeline that transforms and loads data into the data warehouse."

**Q12: You need to detect fraudulent transactions in real-time as they come through a Kinesis stream. Which AWS services would you use and how?**

A: Architecture: (1) **Kinesis Data Streams**: transactions flow in at high throughput. (2) **Managed Apache Flink**: subscribe to the KDS stream; maintain per-user state (transaction counts, amounts in the last 5 minutes using a sliding window); apply fraud detection rules (e.g., "3+ transactions > $500 in 5 minutes from the same user"); emit fraud alerts to an output stream for rule-based detection. (3) **Lambda with SageMaker Endpoint**: for ML-based scoring, a Lambda function consumes from KDS, calls a SageMaker real-time inference endpoint with the transaction features, gets a fraud probability score, and takes action (block transaction, alert). (4) **SNS/SES**: on fraud detection, publish alert to SNS; SNS notifies fraud team via email/SMS. (5) **DynamoDB**: store transaction state for real-time lookups (user's transaction history for the last hour).

**Q13: What is the difference between Redshift Spectrum and Athena for querying S3 data? When would you use one over the other?**

A: Both query S3 data using the Glue Data Catalog, both charge $5/TB scanned, both support Parquet/ORC. Key differences: **Redshift Spectrum** runs as an extension of your Redshift cluster — you can join S3 data (external tables) with internal Redshift tables in the same query, using Redshift's MPP planner. Requires an active Redshift cluster. **Athena** is fully serverless — no cluster required. It's ideal for ad-hoc queries without a Redshift cluster. Use Spectrum when: you have a Redshift cluster and need to join cold S3 archival data with hot Redshift table data; combine multi-year historical data (in S3) with this year's data (in Redshift). Use Athena when: you have no Redshift cluster; workload is pure S3 queries; ad-hoc exploration; serverless simplicity is desired.

**Q14: Explain the OpenSearch index lifecycle and how UltraWarm nodes reduce costs.**

A: In a typical log analytics use case, data has a clear temperature curve: new logs are hot (high query frequency for incident response), week-old logs are warm (occasional investigation), month-old logs are cold (compliance queries only), year-old logs can be deleted. OpenSearch Index Lifecycle Management (ILM) automates this: indices automatically transition from hot data nodes (expensive fast SSD) → UltraWarm nodes (S3-backed with local cache, ~10x cheaper/GB) → Cold storage (S3-only, allocate nodes only on access, ~96% cheaper/GB) → Deleted. For a use case retaining 90 days of logs: keep 7 days on hot nodes, 83 days on UltraWarm. Cost reduction: if hot storage costs $1,000/month for full 90 days, tiered storage might cost $150/month for the same data.

**Q15: Design a cost-effective analytics architecture for a startup with 1 TB of clickstream data per day, a team of 5 analysts, and a budget of $500/month.**

A: (1) **Ingestion**: Kinesis Data Firehose (cheapest real-time ingestion; ~$25/TB ingested = ~$750/month... too much). Alternative: write directly to S3 from application via batched PUT every 5 minutes (~$0.023/GB storage = ~$23/TB/month). (2) **Storage**: S3 with intelligent tiering (~$23/month for 1 TB/day raw, but accumulates). Convert to Parquet with **Glue ETL job** ($0.44/DPU-hour; a daily job might cost ~$2/day = $60/month). Parquet reduces storage by 80% → 200 GB/day after conversion = 6 TB/month = $140/month S3. (3) **Catalog**: Glue Data Catalog (free for first million objects; crawler ~$0.44/hour = ~$1/day = $30/month). (4) **Querying**: Athena with partitioned Parquet. Analysts run 50 queries/day, each scanning 10 GB on average = 500 GB/day = 15 TB/month scanned × $5/TB = $75/month. (5) **Visualization**: QuickSight — 5 authors × $18/month = $90/month. Total: ~$395/month. Optimization: add result reuse in Athena to eliminate repeated scans; encourage analysts to filter by partition. No Redshift needed at this scale and budget.
