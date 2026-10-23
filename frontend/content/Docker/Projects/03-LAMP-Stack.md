# Project 3 — LAMP Stack with Docker Compose

**Level:** Intermediate
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 2 – Docker Compose

---

## Overview

You will use Docker Compose to run a classic **Linux · Apache · MySQL · PHP** stack as three separate, coordinated containers. A named volume keeps MySQL data alive between restarts. A PHP script connects to MySQL and renders the result in the browser, proving all three tiers are wired together end-to-end.

---

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin) installed
- Ports 8080 and 3306 free on your host machine
- Phase 2 (Docker Compose) completed

---

## Project Structure

```
03-lamp-stack/
├── docker-compose.yml
├── php/
│   └── Dockerfile
└── www/
    └── index.php
```

---

## Step-by-Step Instructions

### Step 1 — Create the project directory

```bash
mkdir 03-lamp-stack && cd 03-lamp-stack
mkdir php www
```

### Step 2 — Write `www/index.php`

This script connects to MySQL and displays a live query result:

```php
<?php
$host     = getenv('DB_HOST')     ?: 'db';
$port     = getenv('DB_PORT')     ?: '3306';
$dbname   = getenv('DB_NAME')     ?: 'appdb';
$user     = getenv('DB_USER')     ?: 'appuser';
$password = getenv('DB_PASSWORD') ?: 'secret';

try {
    $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    $stmt = $pdo->query("SELECT VERSION() AS version, NOW() AS server_time");
    $row  = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die("<p style='color:red'>Connection failed: " . htmlspecialchars($e->getMessage()) . "</p>");
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LAMP Stack — Docker</title>
  <style>
    body { font-family: Arial, sans-serif; background:#f0f4f8; display:flex; justify-content:center; padding:3rem; }
    .card { background:#fff; border-radius:8px; padding:2rem 3rem; box-shadow:0 4px 16px rgba(0,0,0,.1); max-width:500px; width:100%; }
    h1 { color:#2d6a4f; }
    table { width:100%; border-collapse:collapse; margin-top:1rem; }
    td, th { padding:.6rem 1rem; border:1px solid #dee2e6; text-align:left; }
    th { background:#2d6a4f; color:#fff; }
  </style>
</head>
<body>
  <div class="card">
    <h1>LAMP Stack is Live!</h1>
    <p>PHP successfully connected to MySQL. Live data from the database:</p>
    <table>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>MySQL Version</td><td><?= htmlspecialchars($row['version']) ?></td></tr>
      <tr><td>Server Time</td><td><?= htmlspecialchars($row['server_time']) ?></td></tr>
      <tr><td>Database</td><td><?= htmlspecialchars($dbname) ?></td></tr>
    </table>
  </div>
</body>
</html>
```

### Step 3 — Write `php/Dockerfile`

The official `php:apache` image includes Apache; we just need to add the PDO MySQL extension:

```dockerfile
FROM php:8.2-apache

# Install PDO MySQL driver
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache mod_rewrite
RUN a2enmod rewrite
```

### Step 4 — Write `docker-compose.yml`

```yaml
version: "3.9"

services:

  # ── Apache + PHP ──────────────────────────────────────────────────────────
  web:
    build:
      context: ./php
      dockerfile: Dockerfile
    container_name: lamp_web
    ports:
      - "8080:80"
    volumes:
      - ./www:/var/www/html      # mount PHP source into Apache web root
    environment:
      DB_HOST:     db
      DB_PORT:     3306
      DB_NAME:     appdb
      DB_USER:     appuser
      DB_PASSWORD: secret
    depends_on:
      db:
        condition: service_healthy
    networks:
      - lamp_net

  # ── MySQL ─────────────────────────────────────────────────────────────────
  db:
    image: mysql:8.0
    container_name: lamp_db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: rootsecret
      MYSQL_DATABASE:      appdb
      MYSQL_USER:          appuser
      MYSQL_PASSWORD:      secret
    volumes:
      - mysql_data:/var/lib/mysql   # named volume for persistence
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "--password=rootsecret"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - lamp_net

  # ── phpMyAdmin (optional GUI) ─────────────────────────────────────────────
  phpmyadmin:
    image: phpmyadmin:latest
    container_name: lamp_pma
    ports:
      - "8081:80"
    environment:
      PMA_HOST:     db
      PMA_PORT:     3306
      PMA_USER:     appuser
      PMA_PASSWORD: secret
    depends_on:
      - db
    networks:
      - lamp_net

volumes:
  mysql_data:

networks:
  lamp_net:
    driver: bridge
```

### Step 5 — Build and start the stack

```bash
docker compose up -d --build
```

Watch the startup logs until MySQL passes its health check:

```bash
docker compose logs -f db
# Look for: ready for connections
```

### Step 6 — Verify end-to-end

```bash
# 1. All three containers running
docker compose ps

# 2. PHP page loads and queries MySQL
curl -s http://localhost:8080 | grep "MySQL Version"

# 3. Connect directly to MySQL
docker exec -it lamp_db mysql -u appuser -psecret appdb -e "SELECT VERSION();"
```

Open [http://localhost:8080](http://localhost:8080) in your browser. You should see the MySQL version and server time rendered by PHP.

Open [http://localhost:8081](http://localhost:8081) for phpMyAdmin.

### Step 7 — Test data persistence

```bash
# Create a table and insert a row
docker exec lamp_db mysql -u appuser -psecret appdb \
  -e "CREATE TABLE notes (id INT AUTO_INCREMENT PRIMARY KEY, body TEXT); INSERT INTO notes (body) VALUES ('persisted!');"

# Restart the stack — data should survive
docker compose restart db
docker exec lamp_db mysql -u appuser -psecret appdb -e "SELECT * FROM notes;"
```

### Step 8 — Tear down

```bash
docker compose down          # stops and removes containers, keeps the volume
docker compose down -v       # also removes the named volume (data is gone)
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| All services healthy | `docker compose ps` | `web`, `db`, `phpmyadmin` all `Up` |
| HTTP response | `curl -o /dev/null -sw "%{http_code}" http://localhost:8080` | `200` |
| MySQL reachable | `docker exec lamp_db mysqladmin ping -h localhost` | `mysqld is alive` |
| Volume persists | Restart db, re-query the `notes` table | Row is still there |

---

## Stretch Goals

1. **Seed data** — add an `init.sql` file and mount it at `/docker-entrypoint-initdb.d/` to pre-create tables on first boot.
2. **Environment file** — move credentials to a `.env` file and reference them with `${VAR}` syntax in `docker-compose.yml`.
3. **SSL termination** — add a second Apache virtual host on port 443 with a self-signed certificate.
4. **Redis cache** — add a `redis` service and update `index.php` to cache the MySQL result for 30 seconds.
5. **Upgrade MySQL** — change the image to `mysql:8.4` and observe how Compose handles the change.
