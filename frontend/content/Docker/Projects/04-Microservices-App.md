# Project 4 — Microservices App with Docker Compose

**Level:** Intermediate
**Time estimate:** 75 – 90 minutes
**Phase prerequisite:** Phase 2 – Docker Compose

---

## Overview

You will build a three-tier application that mirrors a real-world microservices topology:

- **Frontend** — Nginx acts as a reverse proxy, serving static assets and forwarding `/api/*` requests to the backend.
- **Backend** — A Node.js/Express API that reads from and writes to the database.
- **Database** — PostgreSQL with a persistent named volume.

Services communicate by **DNS name** on a custom bridge network. Health checks ensure the backend waits for Postgres before accepting traffic.

---

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin) installed
- Ports 80 and 5432 free on your host
- Project 2 (Node.js API) completed or equivalent familiarity with Express

---

## Project Structure

```
04-microservices-app/
├── docker-compose.yml
├── frontend/
│   ├── nginx.conf
│   └── index.html
└── backend/
    ├── Dockerfile
    ├── package.json
    └── src/
        └── server.js
```

---

## Step-by-Step Instructions

### Step 1 — Create the directory tree

```bash
mkdir 04-microservices-app && cd 04-microservices-app
mkdir -p frontend backend/src
```

### Step 2 — Backend: `backend/package.json`

```json
{
  "name": "microservices-backend",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "pg":      "^8.11.3"
  }
}
```

### Step 3 — Backend: `backend/src/server.js`

```javascript
const express = require('express');
const { Pool }  = require('pg');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

const pool = new Pool({
  host:     process.env.DB_HOST     || 'db',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'appdb',
  user:     process.env.DB_USER     || 'appuser',
  password: process.env.DB_PASSWORD || 'secret',
});

// Health check — also verifies DB connectivity
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS db_time');
    res.json({ status: 'ok', db_time: result.rows[0].db_time });
  } catch (err) {
    res.status(503).json({ status: 'error', detail: err.message });
  }
});

// GET /api/items — list all items
app.get('/api/items', async (req, res) => {
  const result = await pool.query('SELECT * FROM items ORDER BY id');
  res.json(result.rows);
});

// POST /api/items — create an item
app.post('/api/items', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = await pool.query(
    'INSERT INTO items (name, created_at) VALUES ($1, NOW()) RETURNING *',
    [name]
  );
  res.status(201).json(result.rows[0]);
});

app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
```

### Step 4 — Backend: `backend/Dockerfile`

```dockerfile
FROM node:20-alpine

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
USER app
EXPOSE 4000
CMD ["node", "src/server.js"]
```

### Step 5 — Frontend: `frontend/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Microservices Demo</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 640px; margin: 3rem auto; }
    input, button { padding: .5rem; font-size: 1rem; }
    ul { margin-top: 1rem; }
    li { padding: .3rem 0; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <h1>Items (from Postgres via Node.js)</h1>
  <div>
    <input id="nameInput" placeholder="New item name" />
    <button onclick="addItem()">Add</button>
  </div>
  <ul id="list"></ul>
  <script>
    async function loadItems() {
      const res  = await fetch('/api/items');
      const data = await res.json();
      document.getElementById('list').innerHTML =
        data.map(i => `<li>#${i.id} — ${i.name}</li>`).join('');
    }
    async function addItem() {
      const name = document.getElementById('nameInput').value.trim();
      if (!name) return;
      await fetch('/api/items', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name }),
      });
      document.getElementById('nameInput').value = '';
      loadItems();
    }
    loadItems();
  </script>
</body>
</html>
```

### Step 6 — Frontend: `frontend/nginx.conf`

```nginx
server {
    listen 80;

    # Serve static files from /usr/share/nginx/html
    location / {
        root  /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Reverse-proxy /api/* requests to the backend service
    location /api/ {
        proxy_pass         http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
}
```

### Step 7 — `docker-compose.yml`

```yaml
version: "3.9"

services:

  # ── Frontend (Nginx reverse proxy + static files) ─────────────────────────
  frontend:
    image: nginx:alpine
    container_name: ms_frontend
    ports:
      - "80:80"
    volumes:
      - ./frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./frontend/index.html:/usr/share/nginx/html/index.html:ro
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - ms_net

  # ── Backend (Node.js Express API) ─────────────────────────────────────────
  backend:
    build: ./backend
    container_name: ms_backend
    environment:
      PORT:        4000
      DB_HOST:     db
      DB_PORT:     5432
      DB_NAME:     appdb
      DB_USER:     appuser
      DB_PASSWORD: secret
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:4000/api/health || exit 1"]
      interval: 10s
      timeout:  5s
      retries:  5
    networks:
      - ms_net

  # ── Database (Postgres) ───────────────────────────────────────────────────
  db:
    image: postgres:16-alpine
    container_name: ms_db
    restart: unless-stopped
    environment:
      POSTGRES_DB:       appdb
      POSTGRES_USER:     appuser
      POSTGRES_PASSWORD: secret
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./db-init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d appdb"]
      interval: 10s
      timeout:  5s
      retries:  5
    networks:
      - ms_net

volumes:
  pg_data:

networks:
  ms_net:
    driver: bridge
```

### Step 8 — Create the database init script

Create `db-init.sql` in the project root:

```sql
CREATE TABLE IF NOT EXISTS items (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO items (name) VALUES ('Sample item A'), ('Sample item B');
```

### Step 9 — Start the stack

```bash
docker compose up -d --build
docker compose logs -f   # watch until all services are healthy
```

Open [http://localhost](http://localhost) — you should see the two seed items. Add a new one using the form and confirm it persists after a browser refresh.

---

## How Services Communicate by Name

Within the `ms_net` bridge network, Docker's embedded DNS resolves service names to container IP addresses. When Nginx proxies `http://backend:4000`, it resolves `backend` to the `ms_backend` container's IP automatically — no hardcoded addresses needed.

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| All services healthy | `docker compose ps` | All three `Up (healthy)` |
| Backend health | `curl -s http://localhost/api/health \| jq .status` | `"ok"` |
| List items | `curl -s http://localhost/api/items \| jq length` | `2` or more |
| Create item | `curl -X POST http://localhost/api/items -H "Content-Type: application/json" -d '{"name":"test"}'` | `201` with the new row |
| DB connectivity | `docker exec ms_db psql -U appuser -d appdb -c "SELECT count(*) FROM items;"` | Row count |

---

## Stretch Goals

1. **Secrets management** — replace plain-text passwords with Docker secrets and update the Compose file to use `secrets:`.
2. **Logging driver** — add `logging: driver: json-file` with `max-size` and `max-file` limits to all services.
3. **Adminer** — add an `adminer` service on port 8080 for a lightweight database GUI.
4. **Rate limiting** — add an Nginx `limit_req_zone` directive to throttle the `/api/` location to 10 requests/second.
5. **Scale the backend** — run `docker compose up -d --scale backend=3` and update the Nginx config to load-balance across all three instances.
