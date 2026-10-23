# Project 2 — Node.js REST API

**Level:** Beginner
**Time estimate:** 45 – 60 minutes
**Phase prerequisite:** Phase 1 – Images & Containers

---

## Overview

You will containerise a small Express.js application that exposes three JSON endpoints. The Dockerfile uses a **multi-stage build**: the first stage installs all dependencies (including devDependencies), while the second stage copies only the production artefacts into a clean image — resulting in a significantly smaller final image.

---

## Prerequisites

- Docker Desktop (or Docker Engine) installed and running
- Basic knowledge of JavaScript/Node.js (reading level is enough)
- No Node.js installation required on the host — Docker handles everything

---

## Project Structure

```
02-nodejs-api/
├── Dockerfile
├── .dockerignore
├── package.json
└── src/
    └── server.js
```

---

## Step-by-Step Instructions

### Step 1 — Create the project directory

```bash
mkdir 02-nodejs-api && cd 02-nodejs-api
mkdir src
```

### Step 2 — Create `package.json`

```json
{
  "name": "docker-nodejs-api",
  "version": "1.0.0",
  "description": "A minimal Express REST API containerised with Docker",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### Step 3 — Create `src/server.js`

```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// GET /  — health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Docker Node.js API is running',
    timestamp: new Date().toISOString(),
  });
});

// GET /users  — return a static list of users
app.get('/users', (req, res) => {
  const users = [
    { id: 1, name: 'Alice Nguyen',  role: 'admin'  },
    { id: 2, name: 'Bob Müller',    role: 'editor' },
    { id: 3, name: 'Carol Santos',  role: 'viewer' },
  ];
  res.json({ count: users.length, users });
});

// POST /echo  — echo the request body back to the caller
app.post('/echo', (req, res) => {
  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'Request body must not be empty' });
  }
  res.json({ received: body });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

### Step 4 — Create `.dockerignore`

```
node_modules
npm-debug.log
.env
.git
*.md
```

This file tells Docker not to copy these paths into the build context, keeping the build fast and the image clean.

### Step 5 — Write the Dockerfile

```dockerfile
# ── Stage 1: install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first so the layer is cached unless dependencies change
COPY package*.json ./
RUN npm ci

# Copy application source
COPY src/ ./src/


# ── Stage 2: production runtime ────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production node_modules and source from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./

USER appuser

EXPOSE 3000

CMD ["node", "src/server.js"]
```

### Step 6 — Build the image

```bash
docker build -t nodejs-api:1.0 .
```

Check the final image size — it should be under 70 MB:

```bash
docker image ls nodejs-api:1.0
```

### Step 7 — Run the container

```bash
docker run -d \
  --name api \
  -p 3000:3000 \
  -e PORT=3000 \
  nodejs-api:1.0
```

### Step 8 — Test the endpoints

```bash
# Health check
curl http://localhost:3000/

# List users
curl http://localhost:3000/users

# Echo endpoint
curl -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -d '{"hello": "from Docker"}'
```

Expected output for the echo endpoint:

```json
{
  "received": {
    "hello": "from Docker"
  }
}
```

### Step 9 — Inspect and clean up

```bash
# View logs
docker logs api

# Shell into the container (Alpine uses sh, not bash)
docker exec -it api sh

# Stop and remove
docker stop api && docker rm api
docker rmi nodejs-api:1.0
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Container status | `docker ps` | `api` listed as `Up` |
| Health check | `curl -s http://localhost:3000/ \| jq .status` | `"ok"` |
| Users endpoint | `curl -s http://localhost:3000/users \| jq .count` | `3` |
| Non-root user | `docker exec api whoami` | `appuser` |

---

## Stretch Goals

1. **Add a `/health` liveness endpoint** that returns `200 OK` so an orchestrator can probe it.
2. **Compare stage sizes** — `docker build --target builder -t api-builder .` then compare `api-builder` vs `nodejs-api:1.0` with `docker image ls`.
3. **Pass a custom port** — rebuild with `-e PORT=4000 -p 4000:4000` and confirm the API responds on the new port.
4. **Add input validation** — install `zod` or `joi` and validate the POST `/echo` body against a schema.
5. **Scan for vulnerabilities** — run `docker scout cves nodejs-api:1.0` (requires Docker Desktop) and review the report.
