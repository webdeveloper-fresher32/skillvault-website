# Phase 6: Databases

## Overview

Databases are the heart of almost every application. AWS offers purpose-built database services for different data models and access patterns. Choosing the right database is one of the most critical architectural decisions.

## The AWS Database Landscape

```
+------------------------------------------------------------------+
|                    AWS DATABASES                                  |
+------------------------------------------------------------------+
|                                                                  |
|  RELATIONAL (SQL)          NOSQL                                 |
|  +------------------+     +-------------------+                  |
|  | Amazon RDS        |     | Amazon DynamoDB   |                  |
|  | (MySQL, Postgres, |     | (Key-Value +      |                  |
|  |  Oracle, MSSQL,  |     |  Document)        |                  |
|  |  MariaDB)        |     +-------------------+                  |
|  +------------------+                                            |
|  +------------------+     +-------------------+                  |
|  | Amazon Aurora     |     | Amazon DocumentDB |                  |
|  | (MySQL/Postgres   |     | (MongoDB-compat.) |                  |
|  |  compatible)     |     +-------------------+                  |
|  +------------------+                                            |
|                           +-------------------+                  |
|  IN-MEMORY CACHE          | Amazon Neptune    |                  |
|  +------------------+     | (Graph Database)  |                  |
|  | ElastiCache       |     +-------------------+                  |
|  | (Redis, Memcached)|                                           |
|  +------------------+     +-------------------+                  |
|                           | Amazon Keyspaces  |                  |
|  DATA WAREHOUSE           | (Cassandra-compat)|                  |
|  +------------------+     +-------------------+                  |
|  | Amazon Redshift   |                                           |
|  | (OLAP, Petabytes) |     +-------------------+                  |
|  +------------------+     | Amazon Timestream |                  |
|                           | (Time Series)     |                  |
|  SEARCH                   +-------------------+                  |
|  +------------------+                                            |
|  | OpenSearch        |                                           |
|  | (Elasticsearch)   |                                           |
|  +------------------+                                            |
+------------------------------------------------------------------+
```

## Files in This Phase

| File | Service | Priority |
|------|---------|----------|
| [01-RDS-Complete.md](01-RDS-Complete.md) | RDS + Aurora | CRITICAL |
| [02-DynamoDB-Complete.md](02-DynamoDB-Complete.md) | DynamoDB | CRITICAL |
| [03-ElastiCache-Complete.md](03-ElastiCache-Complete.md) | ElastiCache (Redis/Memcached) | HIGH |
| [04-Database-Selection-Guide.md](04-Database-Selection-Guide.md) | Selection Guide | CRITICAL |

## Key Principle: Use the Right Tool

```
OLTP (Online Transaction Processing) → RDS or Aurora
  - Many small, fast read/write transactions
  - Banking, e-commerce, order processing

OLAP (Online Analytics Processing) → Redshift
  - Few, complex queries scanning millions of rows
  - Business intelligence, reporting

Key-Value / Document → DynamoDB
  - Flexible schema, high scale, serverless
  - Shopping carts, user profiles, session data

Caching → ElastiCache
  - Sub-millisecond read performance
  - Session store, frequently-read data

Graph → Neptune
  - Relationships between entities
  - Social networks, fraud detection

Search → OpenSearch
  - Full-text search
  - Application logs, search APIs
```

## Learning Path

```
Week 1:
  Day 1-2: RDS basics, Multi-AZ, Read Replicas
  Day 3:   Aurora deep dive
  Day 4-5: DynamoDB fundamentals, data modeling
  Day 6:   ElastiCache (Redis vs Memcached)
  Day 7:   Database selection guide

Week 2:
  Practice questions
  Hands-on: Launch RDS + connect from EC2
  Hands-on: Create DynamoDB table + query
```

## Critical Exam Topics

- Multi-AZ vs Read Replicas (most common exam trap)
- Aurora vs RDS differences
- DynamoDB partition key design
- ElastiCache patterns (Cache-Aside, Write-Through)
- When to use RDS vs DynamoDB vs Redshift
- RDS Proxy (especially for Lambda + RDS)
- DynamoDB DAX (caching for DynamoDB)
