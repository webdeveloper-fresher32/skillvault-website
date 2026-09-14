# Secrets Management and Configuration — Complete Guide

## Table of Contents
1. [The Secrets Problem](#1-the-secrets-problem)
2. [What Not to Do — Common Mistakes](#2-what-not-to-do--common-mistakes)
3. [Docker Secrets in Swarm](#3-docker-secrets-in-swarm)
4. [Secrets in Docker Compose](#4-secrets-in-docker-compose)
5. [Environment Variables vs Secrets](#5-environment-variables-vs-secrets)
6. [Build-Time Secrets with BuildKit](#6-build-time-secrets-with-buildkit)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Secrets Problem

Applications need credentials — database passwords, API keys, TLS certificates, OAuth tokens. Handling them incorrectly is one of the most common security vulnerabilities in containerized systems.

```
Secrets lifecycle risk points:
  ┌────────────────────────────────────────────────────────────┐
  │                                                            │
  │  Source code repo ← (NEVER commit secrets here)          │
  │         │                                                  │
  │         ▼                                                  │
  │  Dockerfile / docker-compose.yml                          │
  │         │   ← (NEVER hardcode secrets here)               │
  │         ▼                                                  │
  │  Image layers ← (NEVER bake secrets into layers)          │
  │         │                                                  │
  │         ▼                                                  │
  │  Container environment ← (visible via docker inspect)     │
  │         │                                                  │
  │         ▼                                                  │
  │  Runtime process ← secrets should only arrive here        │
  └────────────────────────────────────────────────────────────┘

Safe delivery methods:
  ● Docker Secrets (Swarm) — tmpfs mount at /run/secrets/<name>
  ● Docker Compose secrets  — file-based, not in ENV
  ● External vaults (HashiCorp Vault, AWS Secrets Manager)
  ● BuildKit --secret (build-time only, not baked into layers)
```

---

## 2. What Not to Do — Common Mistakes

### Mistake 1: Hardcoding in Dockerfile

```dockerfile
# WRONG — secret baked into image layer
FROM node:18-alpine
ENV DATABASE_PASSWORD=supersecret123
ENV API_KEY=sk-abcdef1234567890
RUN npm install
CMD ["node", "server.js"]

# Problem: `docker history myapp` or `docker inspect` reveals the secret.
# Anyone who pulls this image can read it.
```

### Mistake 2: Passing Secrets via docker run -e

```bash
# WRONG — visible in process list and docker inspect
docker run -e DB_PASSWORD=supersecret123 myapp

# Any user on the host can see it:
ps aux | grep docker
docker inspect <container_id>   # shows Env array with the value
```

### Mistake 3: Copying Secret Files into the Image

```dockerfile
# WRONG — file stays in image layer even after deletion
FROM node:18-alpine
COPY .env /app/.env           # secret is now in layer N
RUN rm /app/.env              # deletion creates a new layer N+1
                              # but layer N still contains the file!
```

```
Image layer visibility:
  Layer N:   ADD .env (contains DB_PASSWORD=secret)  ← extractable
  Layer N+1: RUN rm .env                             ← layer N is still there

  docker save myapp | tar xf - | inspect layer N tar = secrets exposed
```

### Mistake 4: Committing to Git

```
# Always add to .dockerignore AND .gitignore:
.env
*.pem
*.key
secrets/
config/production.yml
```

---

## 3. Docker Secrets in Swarm

Docker Swarm has a built-in secrets management system. Secrets are encrypted at rest and in transit, and mounted as a tmpfs filesystem inside the container — they never appear in environment variables or image layers.

```
Docker Swarm secrets architecture:
  ┌────────────────────────────────────────────────────────────┐
  │  Manager Node                                              │
  │  ┌─────────────────────────────────────────────────┐      │
  │  │  Raft consensus store (encrypted at rest)       │      │
  │  │  secret: db_password → [encrypted bytes]        │      │
  │  └─────────────────────────────────────────────────┘      │
  │         │  TLS-encrypted Swarm control plane              │
  │         ▼                                                  │
  │  Worker Node                                               │
  │  ┌──────────────────────────────────────────────────────┐  │
  │  │  Container                                           │  │
  │  │  /run/secrets/db_password  ← tmpfs (in-memory only) │  │
  │  │  Contents: "supersecret123"                          │  │
  │  │  Mode: 0400 (root-readable only by default)         │  │
  │  └──────────────────────────────────────────────────────┘  │
  └────────────────────────────────────────────────────────────┘
```

### Create and Manage Secrets

```bash
# Create a secret from a string (stdin)
echo "supersecret123" | docker secret create db_password -

# Create a secret from a file
docker secret create db_password ./db_password.txt

# Create a TLS certificate secret
docker secret create ssl_cert ./certs/server.crt

# List secrets (names only — values are never shown)
docker secret ls

# Inspect a secret (metadata only, not the value)
docker secret inspect db_password

# Remove a secret
docker secret rm db_password
```

### Using Secrets in a Swarm Service

```bash
# Attach a secret to a service
docker service create \
  --name myapi \
  --secret db_password \
  --secret api_key \
  -p 3000:3000 \
  myapi:latest

# Secret is available inside container at:
# /run/secrets/db_password
# /run/secrets/api_key

# Read from application code (Node.js example):
# const dbPass = fs.readFileSync('/run/secrets/db_password', 'utf8').trim();
```

### Secrets in a Swarm Stack (docker-stack.yml)

```yaml
version: "3.8"

services:
  api:
    image: myapi:latest
    secrets:
      - db_password
      - source: api_key
        target: /run/secrets/api_key
        mode: 0400
    environment:
      DB_HOST: postgres
      DB_USER: appuser
      # DB_PASSWORD intentionally absent — read from /run/secrets/db_password

  postgres:
    image: postgres:15
    secrets:
      - db_password
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    external: true     # must be pre-created with `docker secret create`
  api_key:
    external: true
```

```bash
# Deploy the stack
docker stack deploy -c docker-stack.yml myapp
```

---

## 4. Secrets in Docker Compose

Docker Compose (non-Swarm) supports secrets via file-based mounts. The secret file is bind-mounted into the container — not stored in Swarm's encrypted store.

```yaml
# docker-compose.yml
version: "3.8"

services:
  api:
    image: myapi:latest
    secrets:
      - db_password
    environment:
      DB_HOST: postgres

  postgres:
    image: postgres:15
    secrets:
      - db_password
    environment:
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # local file path — NOT committed to git
```

```
Compose secrets vs Swarm secrets:
  ┌──────────────────┬──────────────────────────┬────────────────────────┐
  │ Feature          │ Swarm Secrets            │ Compose Secrets        │
  ├──────────────────┼──────────────────────────┼────────────────────────┤
  │ Storage          │ Encrypted Raft store     │ Host filesystem file   │
  │ Encryption       │ At rest + in transit     │ None (rely on OS perms)│
  │ Distribution     │ Automatic to workers     │ Local only             │
  │ Mount point      │ /run/secrets/<name>      │ /run/secrets/<name>    │
  │ Best for         │ Production multi-node    │ Local dev / single host│
  └──────────────────┴──────────────────────────┴────────────────────────┘
```

---

## 5. Environment Variables vs Secrets

```
Environment variable drawbacks for secrets:
  1. Visible in `docker inspect <container>` (Env array)
  2. Visible in `docker service inspect <service>`
  3. Visible to all processes in the container (readable via /proc/<pid>/environ)
  4. Logged by many frameworks (Spring Boot, crash dumps, debug logs)
  5. Child processes inherit them by default
  6. Appear in orchestrator UIs (Swarm, ECS task definitions)

Secret file advantages:
  1. Not in docker inspect output
  2. tmpfs — never written to disk
  3. File permissions limit which process can read it
  4. Revocable: update secret without redeploying the image
  5. Audit trail in secret management systems
```

### Application Code Pattern — Prefer Files

```python
# Python: read secret from file (best), fall back to env (acceptable for non-prod)
import os

def get_secret(secret_name):
    secret_path = f"/run/secrets/{secret_name}"
    if os.path.exists(secret_path):
        with open(secret_path, 'r') as f:
            return f.read().strip()
    # fallback for local development only
    return os.environ.get(secret_name.upper())

db_password = get_secret("db_password")
```

```javascript
// Node.js: same pattern
const fs = require('fs');

function getSecret(name) {
  const secretPath = `/run/secrets/${name}`;
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch {
    return process.env[name.toUpperCase()];
  }
}

const dbPassword = getSecret('db_password');
```

---

## 6. Build-Time Secrets with BuildKit

Sometimes a build step needs a secret (e.g., a private npm registry token, a pip index URL). BuildKit's `--secret` flag injects the secret during `RUN` only — it is never stored in any image layer.

```dockerfile
# syntax=docker/dockerfile:1.4
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./

# Secret is mounted at /run/secrets/npm_token during this RUN only
# It does NOT appear in the image layer
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    npm config set //registry.npmjs.org/:_authToken=${NPM_TOKEN} && \
    npm ci --only=production

COPY . .

FROM gcr.io/distroless/nodejs18-debian11
WORKDIR /app
COPY --from=builder /app .
CMD ["server.js"]
```

```bash
# Build with the secret (never baked into the image)
DOCKER_BUILDKIT=1 docker build \
  --secret id=npm_token,src=./npm_token.txt \
  -t myapp:latest .

# Verify the secret is NOT in any layer
docker history myapp:latest    # no secret values visible
docker save myapp:latest | tar xf - | grep -r "npm_token" .  # nothing found
```

---

## 7. Hands-On Exercises

**Exercise 1:** Initialize a Docker Swarm with `docker swarm init`. Create a secret: `echo "my_db_pass_123" | docker secret create db_password -`. Run `docker secret ls` and `docker secret inspect db_password`. Confirm the value is never shown in inspect output. Then launch a service using that secret and exec into it to read `/run/secrets/db_password`.

**Exercise 2:** Start a postgres container using the `POSTGRES_PASSWORD_FILE` pattern: create a secret file locally, mount it via a Compose secrets block, and verify the database accepts connections using the password from the file. Confirm that `docker inspect <container>` does not show the password in the `Env` array.

**Exercise 3:** Demonstrate the layer-leakage problem: build an image that COPYs a `.env` file and then RMs it. Use `docker save myapp | tar xf - -C extracted/` and inspect the layer tarballs with `tar tf` to show the `.env` file is still present in an earlier layer.

**Exercise 4:** Rebuild the same image using BuildKit `--mount=type=secret` instead of COPY. Use `docker save` to extract layers again and confirm the secret file does not appear in any layer.

**Exercise 5:** Write a small Node.js or Python script that uses the `getSecret()` helper pattern (file first, ENV fallback). Run it in two modes: once with the secret at `/run/secrets/api_key` (use `--mount=type=bind,src=./api_key.txt,dst=/run/secrets/api_key`), and once with just `--env API_KEY=testvalue`. Confirm both modes work, then run `docker inspect` on both containers to see the difference in exposure.

---

## 8. Interview Q&A

**Q: Why should you never pass secrets via ENV variables in production?**
Answer: Environment variables passed to containers are visible in `docker inspect <container>` (under the `Env` array), readable via `/proc/<pid>/environ` by any process in the container, often captured by application crash dumps and debug logs, and appear in orchestrator control-plane UIs. Docker Secrets mount the value as a tmpfs file at `/run/secrets/<name>` — never stored in image layers, not in inspect output, and the value is encrypted at rest in the Swarm Raft store.

**Q: How does Docker Swarm encrypt and distribute secrets?**
Answer: Secrets are stored encrypted in Swarm's Raft consensus store on manager nodes, encrypted with keys derived from a manager join token. When a service task is scheduled on a worker, the secret value is transmitted over the mutually TLS-authenticated Swarm control plane and mounted inside the container as a tmpfs filesystem (in-memory, never written to disk). The secret is only decrypted and delivered to workers running tasks that have been granted access to it.

**Q: What is the difference between Swarm secrets and Compose secrets?**
Answer: Swarm secrets are stored encrypted in the Swarm Raft store, distributed securely to worker nodes over TLS, and are available across a multi-node cluster. Compose secrets are file-based bind mounts — the host file is mounted into the container at `/run/secrets/<name>`. Compose secrets have no encryption at rest (security depends on host filesystem permissions) and are local to a single host. Compose secrets are suitable for development; Swarm secrets are suitable for production.

**Q: How does BuildKit's `--mount=type=secret` prevent secret leakage in image layers?**
Answer: BuildKit mounts the secret as a tmpfs directory only during the execution of that specific `RUN` instruction. Once the instruction completes, the mount is removed and is not included in the resulting layer snapshot. Traditional `COPY secret /app/secret && RUN use && RUN rm` still stores the secret in the COPY layer, which persists and can be extracted with `docker save`. BuildKit's approach means the secret never touches any layer at all.

**Q: What is the `POSTGRES_PASSWORD_FILE` environment variable pattern?**
Answer: Many official Docker images (postgres, mysql, redis) support a `_FILE` convention: instead of setting `POSTGRES_PASSWORD=mypassword` directly (which leaks to inspect), you set `POSTGRES_PASSWORD_FILE=/run/secrets/db_password`. The container's entrypoint script reads the password from that file path at startup. This lets you use Docker Secrets with official images without modifying their Dockerfiles, while keeping the password out of environment variables and inspect output.
