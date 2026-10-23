# 03 — Installation, psql Mastery & Configuration

## Table of Contents
1. [Installation Methods](#1-installation-methods)
2. [Production Docker Compose Environment](#2-production-docker-compose-environment)
3. [Mastering the `psql` Interactive CLI](#3-mastering-the-psql-interactive-cli)
4. [Server Configuration via `postgresql.conf`](#4-server-configuration-via-postgresqlconf)
5. [Client Authentication via `pg_hba.conf`](#5-client-authentication-via-pghbaconf)
6. [Hot Reloading Configuration (Zero Downtime)](#6-hot-reloading-configuration-zero-downtime)
7. [Hands-On Practice Exercises](#7-hands-on-practice-exercises)
8. [Summary & Key Takeaways](#8-summary--key-takeaways)

---

## 1. Installation Methods

### macOS (via Homebrew)
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Ubuntu / Debian Linux
```bash
sudo apt update
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-16 postgresql-contrib-16
sudo systemctl enable --now postgresql
```

---

## 2. Production Docker Compose Environment

For local experimentation and reproducible testing, use this `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: skillvault-postgres
    restart: always
    environment:
      POSTGRES_DB: skillvault
      POSTGRES_USER: vaultmaster
      POSTGRES_PASSWORD: VaultSecurePassword2026!
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    command: >
      postgres
        -c shared_buffers=512MB
        -c work_mem=32MB
        -c maintenance_work_mem=128MB
        -c max_connections=100
        -c wal_level=replica
        -c logging_collector=on
        -c log_min_duration_statement=250

volumes:
  pgdata:
    driver: local
```

Launch the cluster:
```bash
docker compose up -d
docker exec -it skillvault-postgres psql -U vaultmaster -d skillvault
```

---

## 3. Mastering the `psql` Interactive CLI

The `psql` command-line tool is a power tool for database engineers. Rather than using slow graphical tools, senior engineers use `psql` for scripting, introspection, and execution.

### Essential Meta-Commands (The Backslash Commands)

| Command | Action | Explanation |
|---|---|---|
| `\l` or `\l+` | List Databases | Shows all databases, owners, encoding, and disk size on disk. |
| `\c <dbname>` | Connect to DB | Switches current connection to a different database. |
| `\dt` or `\dt+` | List Tables | Displays all tables in the current search path with disk size. |
| `\d <tablename>` | Describe Table | Shows columns, data types, nullability, defaults, and foreign keys. |
| `\d+ <tablename>` | Extended Describe | Includes indexes, constraints, triggers, and storage statistics. |
| `\di+` | List Indexes | Lists all indexes across schemas with physical size on disk. |
| `\dn` | List Schemas | Shows all schemas and their owners. |
| `\df` | List Functions | Shows user-defined and system functions. |
| `\timing` | Toggle Timing | Measures wall-clock execution time for every executed SQL statement. |
| `\x` | Expanded Display | Toggles vertical row display (ideal for inspecting wide rows with many columns). |
| `\e` | External Editor | Opens the previous query in `$EDITOR` (e.g. Vim/Nano) for multi-line editing. |
| `\q` | Quit | Disconnects and exits the shell. |

### Practical `psql` Pro-Tips

```sql
-- 1. Enable execution timing and expanded auto-mode
\timing on
\x auto

-- 2. Inspect a table structure in full detail
\d+ users

-- 3. Execute a query and output directly into CSV without writing an export script
\copy (SELECT id, username, email FROM users WHERE active = true) TO 'active_users.csv' WITH CSV HEADER;
```

---

## 4. Server Configuration via `postgresql.conf`

The primary configuration file resides in the cluster data directory (`$PGDATA/postgresql.conf`).

### Key Parameters to Master

```ini
# --- CONNECTION SETTINGS ---
listen_addresses = '*'          # Network interfaces to bind to ('*' = all)
port = 5432                     # Port number
max_connections = 100           # Maximum concurrent backend processes

# --- MEMORY SETTINGS ---
shared_buffers = 4GB            # 25% of total server RAM
effective_cache_size = 12GB     # 75% of total RAM (informs query planner of OS cache)
work_mem = 32MB                 # Memory allocated per sort/hash operation
maintenance_work_mem = 512MB    # Memory for VACUUM, CREATE INDEX, and ALTER TABLE

# --- WRITE-AHEAD LOG (WAL) ---
wal_level = replica             # Minimally required for streaming replication
max_wal_size = 16GB             # Target max WAL disk size before forcing checkpoint
min_wal_size = 1GB              # Retained WAL recycling floor
checkpoint_completion_target = 0.9 # Smooths checkpoint I/O over 90% of checkpoint_timeout

# --- QUERY PLANNER COST CONSTANTS ---
random_page_cost = 1.1          # 1.1 for NVMe SSDs (default 4.0 was designed for spinning HDDs)
effective_io_concurrency = 200  # Number of concurrent disk I/O requests for SSDs
```

---

## 5. Client Authentication via `pg_hba.conf`

The Host-Based Authentication configuration file (`pg_hba.conf`) defines who can connect, from where, and using what authentication mechanism.

### The Record Format:
```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
```

```ini
# Allow local socket connections for postgres superuser using peer authentication
local   all             postgres                                peer

# Allow local loopback TCP connections using modern SCRAM-SHA-256 password hash
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256

# Allow application server subnet to connect via SSL only
hostssl skillvault      vaultmaster     10.0.1.0/24             scram-sha-256

# Reject all unencrypted remote passwords
host    all             all             0.0.0.0/0               reject
```

> [!CAUTION]
> Never use `trust` authentication on network addresses in production! It allows anyone on that subnet to connect without entering a password. Always use `scram-sha-256`.

---

## 6. Hot Reloading Configuration (Zero Downtime)

Most parameters in `postgresql.conf` and all rules in `pg_hba.conf` can be reloaded without dropping active client connections:

```sql
-- 1. Check if a parameter requires a full server restart
SELECT name, setting, unit, context 
FROM pg_settings 
WHERE name IN ('shared_buffers', 'work_mem', 'max_connections', 'listen_addresses');
-- Context 'sighup' = reloadable online.
-- Context 'postmaster' = requires full cluster restart.

-- 2. Trigger configuration reload from inside SQL:
SELECT pg_reload_conf();

-- 3. Verify file reload timestamp
SELECT pg_conf_load_time();
```

---

## 7. Hands-On Practice Exercises

1. Connect to PostgreSQL using `psql`:
   ```bash
   psql -h localhost -p 5432 -U vaultmaster -d skillvault
   ```
2. Turn on statement timing:
   ```sql
   \timing on
   ```
3. Create a scratch table and populate 100,000 rows using `generate_series()`:
   ```sql
   CREATE TABLE benchmark_test (
       id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       random_payload TEXT,
       created_at TIMESTAMPTZ DEFAULT now()
   );

   INSERT INTO benchmark_test (random_payload)
   SELECT md5(random()::text) 
   FROM generate_series(1, 100000);
   ```
4. Inspect the table size using `\dt+ benchmark_test` and check its column metadata using `\d+ benchmark_test`.

---

## 8. Summary & Key Takeaways

1. Use Docker Compose or modern package managers to deploy PostgreSQL 16+.
2. The `psql` CLI provides deep introspection with `\d+`, `\dt+`, `\di+`, `\timing`, and `\copy`.
3. `postgresql.conf` governs memory allocations (`shared_buffers`, `work_mem`) and planner cost constants.
4. `pg_hba.conf` controls network security and should always enforce `scram-sha-256` and `hostssl`.
5. Configuration changes with `context = 'sighup'` can be hot-reloaded safely using `SELECT pg_reload_conf()`.
