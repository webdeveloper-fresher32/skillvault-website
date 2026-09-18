# Stage 9: Containerizing with Docker

**Pairs with:** [`Docker/`](../../../03-DevOps/Docker) course in this repo for full Docker fundamentals, and [`Phase-04-Load-Balancers/03-Nginx-HAProxy-ALB-in-Practice.md`](../Phase-04-Load-Balancers/03-Nginx-HAProxy-ALB-in-Practice.md) for the Nginx piece being containerized here.

## Where We Left Off

Stage 8 split the backend into an Auth Service and a Post Service, each started by hand with `uvicorn`, alongside Postgres, Redis, MinIO, and a Celery worker started separately. That's seven things a reader has to remember to start, in the right order, with the right environment variables. This stage packages every piece into containers and wires them together with one `docker-compose.yml`.

## Step 1: Dockerfile per Service

Both services share the same shape. `auth_service/Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9001"]
```

`auth_service/requirements.txt`:

```
fastapi
uvicorn
sqlalchemy
psycopg2-binary
pyjwt
passlib[bcrypt]
```

`post_service/Dockerfile` (identical shape, different port):

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9002
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9002"]
```

`post_service/requirements.txt`:

```
fastapi
uvicorn
sqlalchemy
psycopg2-binary
pyjwt
redis
celery
boto3
python-multipart
```

`celery_worker/Dockerfile` (reuses Post Service's code — the task lives in the same codebase per Stage 5):

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["celery", "-A", "tasks", "worker", "--loglevel=info"]
```

## Step 2: `docker-compose.yml`

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: instagram
      POSTGRES_PASSWORD: instagram
      POSTGRES_DB: instagram_clone
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio-data:/data

  auth-service:
    build: ./auth_service
    environment:
      DATABASE_URL: postgresql://instagram:instagram@postgres:5432/instagram_clone
      JWT_SECRET: shared-secret-change-me
    depends_on:
      - postgres
    ports:
      - "9001:9001"

  post-service:
    build: ./post_service
    environment:
      DATABASE_URL: postgresql://instagram:instagram@postgres:5432/instagram_clone
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET: shared-secret-change-me
      MINIO_ENDPOINT: http://minio:9000
    depends_on:
      - postgres
      - redis
      - minio
    ports:
      - "9002:9002"

  celery-worker:
    build: ./celery_worker
    environment:
      DATABASE_URL: postgresql://instagram:instagram@postgres:5432/instagram_clone
      REDIS_URL: redis://redis:6379/0
      MINIO_ENDPOINT: http://minio:9000
    depends_on:
      - redis
      - postgres

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - auth-service
      - post-service
    ports:
      - "8080:8080"

volumes:
  postgres-data:
  minio-data:
```

## Step 3: Nginx Routes to Both Services

Update `nginx.conf` to route by path prefix instead of round-robining across identical instances (Stage 7's version load-balanced copies of one app; here we're routing to two *different* services):

```nginx
events {}

http {
    upstream auth_service {
        server auth-service:9001;
    }

    upstream post_service {
        server post-service:9002;
    }

    server {
        listen 8080;

        location /signup { proxy_pass http://auth_service; }
        location /login   { proxy_pass http://auth_service; }
        location /verify   { proxy_pass http://auth_service; }

        location /posts   { proxy_pass http://post_service; }
    }
}
```

## Run It

```bash
docker compose up --build
```

Compose builds all three application images, starts Postgres/Redis/MinIO, and brings up Nginx last (its `depends_on` waits for the app containers to start — note this only waits for the *container* to start, not for the app inside to be ready to accept connections; a production compose file would add healthchecks).

## Verify

```bash
# End-to-end smoke test through the single Nginx entrypoint
curl -X POST "http://localhost:8080/signup?email=carol@example.com&password=hunter2"

TOKEN=$(curl -s -X POST "http://localhost:8080/login?email=carol@example.com&password=hunter2" \
  | jq -r .access_token)

curl -X POST http://localhost:8080/posts \
  -H "Authorization: Bearer $TOKEN" \
  -F "caption=Fully containerized!" \
  -F "image=@./sunset.jpg"

curl http://localhost:8080/posts
```

If the final `GET /posts` returns the post just created, every container — Nginx, Post Service, Auth Service, Postgres, Redis, MinIO — is wired correctly, and the Celery worker log (`docker compose logs celery-worker`) should show the thumbnail task completing shortly after the upload.

## What's Still Missing

This is one Postgres, one Redis, one MinIO, running on one machine (or one `docker compose` host). Stage 10 is the discussion of what breaks first as real user counts grow, and which earlier phase's tool fixes each bottleneck.
