# PostgreSQL Quick Reference & Interview Master Guide

## Overview

This directory provides rapid-lookup cheatsheets and high-yield interview preparation materials for senior database engineers, backend architects, and technical interview candidates.

---

## Resources

1. **[PostgreSQL Syntax & Operations Cheatsheet](./PostgreSQL-Cheatsheet.md)**
   - Essential `psql` meta-commands (`\dt+`, `\di+`, `\timing`, `\x auto`, `\copy`).
   - JSONB operators (`->`, `->>`, `@>`, `#>`, `jsonb_path_query`).
   - CTE and Window Function syntax templates.
   - Core administrative tuning parameters for `postgresql.conf`.

2. **[Staff & Senior Database Interview Questions](./Interview-Questions.md)**
   - 50+ rigorous architectural interview questions with in-depth answers.
   - Deep-dives into MVCC tuple headers (`xmin`, `xmax`), autovacuum freeze heuristics, SSI isolation anomalies, B-Tree vs BRIN index trade-offs, and Patroni high-availability failover.
