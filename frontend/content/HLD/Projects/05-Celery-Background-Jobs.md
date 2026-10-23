# Stage 5: Celery Background Jobs

**Pairs with:** [Phase 07, Lesson 02 — Celery Task Queues](../Phase-07-Message-Queues-and-Async/02-Celery-Task-Queues.md)

## Why This Stage, Why Now

Right now `POST /posts` returns as soon as the database write commits — fine, because there's no slow work happening. But a real Instagram-like app generates a thumbnail from every uploaded image, and thumbnail generation is exactly the kind of slow, non-essential-to-the-response work Phase 07 Lesson 01 used as its motivating example (upload → compress → thumbnail → email, user waits). Phase 07 Lesson 02 taught the fix: hand the slow work to Celery, return to the client immediately, let a background worker process finish it after the fact.

This stage adds a stub thumbnail-generation task and moves it off the request path.

## Setup

Redis is already running from Stage 4 — Celery can reuse it as the message broker.

```bash
pip install fastapi uvicorn pyjwt "passlib[bcrypt]" sqlalchemy psycopg2-binary redis celery
```

## The Worker

`worker.py`:

```python
from celery import Celery
import time

celery = Celery(
    "instagram_clone",
    broker="redis://localhost:6379/0",   # Redis also works as a Celery broker, not just a cache
    backend="redis://localhost:6379/0",
)


@celery.task
def process_thumbnail(post_id: int, image_url: str):
    """Stub thumbnail generation -- a real version would download the image,
    resize it, and upload the thumbnail somewhere (Stage 6 adds real object storage)."""
    print(f"[worker] starting thumbnail for post {post_id} ({image_url})")
    time.sleep(3)  # pretend this is expensive image processing
    print(f"[worker] thumbnail DONE for post {post_id}")
```

This is the exact `@celery.task` pattern from Phase 07 Lesson 02, with our own stubbed-out work inside it instead of `compress()` / `thumbnail()` / `send_email()`.

## What's New in `main.py`

Import the task and call `.delay(...)` instead of doing the work inline — again, the exact pattern from Phase 07 Lesson 02 (`process_video.delay()`):

```python
from worker import process_thumbnail
```

Update `create_post` to kick off the background job after committing, but before returning:

```python
@app.post("/posts", response_model=PostOut, status_code=201)
def create_post(
    payload: PostCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    post = Post(user_id=user_id, caption=payload.caption, image_url=payload.image_url)
    db.add(post)
    db.commit()
    db.refresh(post)

    cache.delete(FEED_CACHE_KEY)

    if post.image_url:
        process_thumbnail.delay(post.id, post.image_url)  # fire-and-forget, returns immediately

    return post
```

The request handler no longer waits on `process_thumbnail` at all — `.delay()` just drops a message on the Redis broker and returns a task handle we're ignoring here. The actual work happens in a separate worker process.

## Run It

You need two processes running side by side, plus Redis and Postgres from earlier stages already up.

**Terminal 1 — the API:**

```bash
uvicorn main:app --reload
```

**Terminal 2 — the Celery worker:**

```bash
celery -A worker worker --loglevel=info
```

## Verify It — Response Returns Before the Worker Finishes

```bash
# Time the request -- it should return in well under 3 seconds even though
# thumbnail processing (a 3-second sleep) is queued behind it.
time curl -X POST http://127.0.0.1:8000/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"caption": "async thumbnail test", "image_url": "https://example.com/a.jpg"}'
```

Expected: the `curl` call returns in a few milliseconds with the created post JSON.

Meanwhile, watch **Terminal 2** (the worker) — a few seconds later you'll see:

```
[worker] starting thumbnail for post 4 (https://example.com/a.jpg)
[worker] thumbnail DONE for post 4
```

The log line proves the ordering: the HTTP response came back to the client immediately, and the "expensive" work finished afterward, off the request path.

## What Changed and Why

- **Broker vs worker, made concrete:** Redis (already running from Stage 4) is now doing double duty as a message broker — `process_thumbnail.delay()` pushes a task message onto a Redis-backed queue; the `celery worker` process is a separate long-running process that pulls tasks off that queue and executes them.
- **Retry/failure handling** (mentioned in Phase 07 Lesson 02, not wired up here to keep the example minimal) would matter for a real thumbnail job — Celery supports `@celery.task(bind=True, max_retries=3)` with `self.retry()` on failure. Worth calling out in an interview even if this toy project doesn't need it yet.
- **User experience improvement:** without this stage, a slow thumbnail step would make every `POST /posts` call feel sluggish. With it, the perceived latency of posting stays flat regardless of how expensive image processing gets.

## Where This Goes Next

Stages 6–10 (object storage, load balancing, microservices, containerization, and the final scaling discussion) build on top of everything in Stages 1–5. The image URL this stage still points at a stub (`https://example.com/a.jpg`) becomes a real uploaded file in Stage 6.
