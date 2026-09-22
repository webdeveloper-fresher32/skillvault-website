# PostgreSQL Production Projects Catalog

## Overview

The best way to solidify your database engineering expertise is by building production-grade schemas, constraints, and query pipelines. This catalog contains tiered projects ranging from foundational relational design to high-throughput multi-tenant SaaS engines, time-series telemetry pipelines, and hybrid AI search backends.

---

## Project Tracks

### 1. [Beginner Projects](./01-Beginner-Projects.md)
- **Project 1: E-Commerce Store with Rich Postgres Types & Constraints** (UUID primary keys, generated columns, check constraints, enum status types, and foreign keys).
- **Project 2: University Course Enrollment & Attendance Tracker** (Preventing double bookings using `EXCLUDE USING gist`, date ranges, and array tags).

### 2. [Intermediate Projects](./02-Intermediate-Projects.md)
- **Project 3: Multi-Tenant SaaS Engine with Row-Level Security (RLS)** (Shared database with complete tenant isolation via `current_setting`, automated JSONB audit logging triggers).
- **Project 4: Double-Entry Financial Ledger Engine** (ACID atomic transfers, idempotent transaction processing using `ON CONFLICT`, and worker queues with `FOR UPDATE SKIP LOCKED`).

### 3. [Advanced Capstone Projects](./03-Advanced-Projects.md)
- **Project 5: High-Throughput IoT Time-Series Pipeline** (Declarative monthly range partitioning, BRIN indexes, continuous rollups, and zero-downtime partition detachment).
- **Project 6: AI Semantic Knowledge Assistant with `pgvector` & Full-Text Search** (Hybrid search combining BM25 lexical tsvector search with HNSW vector cosine similarity ranking).
