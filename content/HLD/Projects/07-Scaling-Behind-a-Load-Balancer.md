# Stage 7: Scaling Behind a Load Balancer

**Pairs with:** [`Phase-04-Load-Balancers/03-Nginx-HAProxy-ALB-in-Practice.md`](../Phase-04-Load-Balancers/03-Nginx-HAProxy-ALB-in-Practice.md) and [`Phase-03-Scalability-Fundamentals/02-Stateless-Services.md`](../Phase-03-Scalability-Fundamentals/02-Stateless-Services.md)

## Where We Left Off

The app from Stage 6 is a single FastAPI process talking to Postgres, Redis, and MinIO. One process means one point of failure and one ceiling on throughput. This stage doesn't add a single line of application code — it proves the app is already **stateless** (per Phase 03 Lesson 02) by running two copies of it and putting Nginx in front.

## Why Now

Phase 04 Lesson 03 makes the point that you don't hand-write a load balancer in Python — a reverse proxy like Nginx, HAProxy, or a cloud ALB sits in front of your app and distributes requests across instances. That only works cleanly if the app has no server-local state to lose when a request lands on a different instance. Check what Stage 2–6 already gave us:

- **Auth** is a JWT decoded independently on every request (no server-side session dict).
- **Persistent data** lives in Postgres, shared by every instance.
- **Cache** lives in Redis, shared by every instance.
- **Uploaded media** lives in MinIO, shared by every instance.

Nothing about "which port the app happens to be running on" matters. That's exactly the statelessness precondition Phase 03 Lesson 02 said horizontal scaling needs.

## Step 1: Run Two Instances of the Same App

```bash
uvicorn main:app --port 8001 &
uvicorn main:app --port 8002 &
```

Both processes connect to the same Postgres, Redis, and MinIO — nothing in `main.py` changes.

## Step 2: Add an Instance-Identifying Response Header

To make the load balancing *visible* in verification (rather than just trusting it), add one small, temporary line to `main.py` — a response header identifying which instance answered:

```python
import os
from fastapi import FastAPI, Request

app = FastAPI()

INSTANCE_ID = os.environ.get("INSTANCE_ID", "unknown")


@app.middleware("http")
async def add_instance_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Served-By"] = INSTANCE_ID
    return response
```

Start each instance with a distinct `INSTANCE_ID`:

```bash
INSTANCE_ID=instance-1 uvicorn main:app --port 8001 &
INSTANCE_ID=instance-2 uvicorn main:app --port 8002 &
```

## Step 3: Nginx Config (reusing Phase 04 Lesson 03's `upstream` block)

Create `nginx.conf`:

```nginx
events {}

http {
    upstream backend {
        server 127.0.0.1:8001;
        server 127.0.0.1:8002;
    }

    server {
        listen 8080;

        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

Run Nginx pointed at this config:

```bash
docker run -d --name nginx-lb \
  --network host \
  -v "$(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro" \
  nginx:alpine
```

(`--network host` lets the containerized Nginx reach the two `uvicorn` processes running directly on the host at `127.0.0.1:8001`/`8002`; on Linux this works natively, on Docker Desktop for Mac/Windows swap the upstream addresses for `host.docker.internal:8001`/`8002`.)

## Run It

```bash
INSTANCE_ID=instance-1 uvicorn main:app --port 8001 &
INSTANCE_ID=instance-2 uvicorn main:app --port 8002 &
docker run -d --name nginx-lb --network host \
  -v "$(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine
```

## Verify

```bash
for i in $(seq 1 6); do
  curl -s -o /dev/null -D - http://localhost:8080/posts | grep -i x-served-by
done
```

Expected output (Nginx's default round-robin algorithm, per Phase 04 Lesson 02) — the header alternates between instances:

```
X-Served-By: instance-1
X-Served-By: instance-2
X-Served-By: instance-1
X-Served-By: instance-2
X-Served-By: instance-1
X-Served-By: instance-2
```

If both a `login → get JWT` and `create-a-post` request sequence via `http://localhost:8080` work regardless of which instance answers, that's proof-positive statelessness: no user got logged out or lost a post because their two requests landed on different processes.

## What's Still Missing

One codebase, one deployable unit — every instance runs *all* the routes. Stage 8 splits the app into independently deployable services.
