# Beginner Projects: Foundations & Scripting

> "Beginner projects build muscle memory: writing syntactically clean code, handling edge cases, reading files, parsing arguments, and exposing your very first HTTP endpoints."

---

## Project Catalog

### Project 1: CLI Task & Habit Manager with Persistence
- **Domain**: Developer Tools / Programming Fundamentals
- **Core Skills**: File I/O (JSON/SQLite), CLI argument parsing (`yargs` or `argparse`), data validation, formatting terminal tables.
- **Tech Stack**: TypeScript (Node.js) OR Python.
- **Key Requirements**:
  - Add, list, complete, and delete tasks with priority levels and due dates.
  - Persist records to a local JSON file or SQLite database.
  - Implement search and filter flags (`--status=completed`, `--priority=high`).
- **Exit Verification**: Unit tests verify adding, updating, and querying tasks across process restarts.

---

### Project 2: Thread-Safe In-Memory LRU Cache
- **Domain**: Data Structures & Low-Level Design
- **Core Skills**: Hash Maps + Doubly Linked Lists, $O(1)$ lookup and eviction, thread safety/mutexes, TTL expiry.
- **Tech Stack**: Java OR Python OR Go.
- **Key Requirements**:
  - `get(key)` and `put(key, value, ttl)` operating in strict $O(1)$ time complexity.
  - Evict least-recently-used item when capacity limit is reached.
  - Thread-safe access under concurrent read/write operations.
- **Exit Verification**: Concurrency stress test asserting zero race conditions and correct eviction ordering.

---

### Project 3: Production-Ready REST API with Validation
- **Domain**: Backend Development
- **Core Skills**: REST semantics, HTTP status codes, request body validation (Pydantic / Zod), SQLite storage, error middleware.
- **Tech Stack**: FastAPI (Python) OR Express / NestJS (TypeScript).
- **Key Requirements**:
  - CRUD operations for a Product Inventory or Blog entity.
  - Strict input validation rejecting malformed payloads with descriptive 400 errors.
  - Health check endpoint (`/health`) returning server uptime and database ping.
- **Exit Verification**: Automated test suite asserting status codes 200, 201, 400, 404, and 500.

---

### Project 4: Linux Automated Server Health & Backup Utility
- **Domain**: Operating Systems & DevOps
- **Core Skills**: Bash scripting, Linux cron jobs, file archiving (`tar`, `gzip`), exit code handling, remote sync (`rsync` / AWS S3 CLI).
- **Tech Stack**: Bash / Linux Shell.
- **Key Requirements**:
  - Check disk space, CPU load average, and memory utilization; send an alert if thresholds exceed 85%.
  - Compress a target directory, append a timestamp, and sync it to a backup directory or AWS S3 bucket.
  - Retain only the last 7 daily backup archives, automatically purging older files.
- **Exit Verification**: Execute script on an Ubuntu machine; verify backup creation, cron installation, and alerting output.

---

### Project 5: Supervised ML Model Training & Inference Script
- **Domain**: AI & Machine Learning
- **Core Skills**: Feature normalization, Train/Test split, Model training (Scikit-Learn), Metrics (Precision, Recall, F1), Model serialization (`joblib`).
- **Tech Stack**: Python, NumPy, Pandas, Scikit-Learn.
- **Key Requirements**:
  - Ingest tabular CSV data (e.g. customer churn or house prices).
  - Preprocess missing values, encode categoricals, and normalize numerical features.
  - Train a classification model and export `model.joblib` and evaluation metric reports.
- **Exit Verification**: Load the serialized model in a separate script and execute batch predictions on unseen data.
