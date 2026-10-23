# Stage 4: Redis Caching

**Pairs with:** [Phase 06, Lesson 01 — Cache-Aside Pattern](../Phase-06-Caching/01-Cache-Aside-Pattern.md)

## Why This Stage, Why Now

Stage 3 gave us durability but every single `GET /posts` call now round-trips to Postgres. Feeds are read far more often than they're written — a typical user refreshes their feed many times for every post they make. Phase 06 Lesson 01 taught the fix for exactly this shape of problem: cache-aside. Check the cache first; on a miss, fall back to the database and populate the cache for next time.

## Get Redis Running Locally

```bash
docker run --name instagram-clone-redis -p 6379:6379 -d redis:7
```

## Setup

```bash
pip install fastapi uvicorn pyjwt "passlib[bcrypt]" sqlalchemy psycopg2-binary redis
```

## What's New in `main.py`

Add the Redis client and a cache key for the feed:

```python
import json
import time
import redis

cache = redis.Redis(host="localhost", port=6379, decode_responses=True)

FEED_CACHE_KEY = "feed:latest"
FEED_CACHE_TTL_SECONDS = 30
```

Update `list_posts` to check the cache first — this is the exact cache-aside shape from Phase 06 Lesson 01 (`r.get` → miss → DB → `r.set`), applied to our feed:

```python
@app.get("/posts", response_model=list[PostOut])
def list_posts(db: Session = Depends(get_db)):
    start = time.perf_counter()

    cached = cache.get(FEED_CACHE_KEY)
    if cached is not None:
        elapsed_ms = (time.perf_counter() - start) * 1000
        print(f"[cache HIT] feed served from Redis in {elapsed_ms:.2f}ms")
        return json.loads(cached)

    # Cache miss -> fall back to Postgres
    posts_from_db = db.query(Post).order_by(Post.created_at.desc()).all()
    result = [PostOut.model_validate(p).model_dump() for p in posts_from_db]

    cache.set(FEED_CACHE_KEY, json.dumps(result, default=str), ex=FEED_CACHE_TTL_SECONDS)

    elapsed_ms = (time.perf_counter() - start) * 1000
    print(f"[cache MISS] feed loaded from Postgres in {elapsed_ms:.2f}ms, cached for {FEED_CACHE_TTL_SECONDS}s")
    return result
```

Update `create_post` to invalidate the cached feed on write — a fresh post must show up immediately, not after the TTL expires:

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

    # Invalidate the cached feed -- delete-on-write, per Phase 06 Lesson 02.
    cache.delete(FEED_CACHE_KEY)

    return post
```

Everything else in `main.py` (signup, login, JWT dependency, `get_user`) is unchanged from Stage 3.

## Run It

```bash
uvicorn main:app --reload
```

Watch the terminal running `uvicorn` — that's where the `[cache HIT]` / `[cache MISS]` log lines print.

## Verify It — Watch the Cache Hit/Miss Timing

```bash
# 1. First call after a fresh cache: MISS, hits Postgres
curl http://127.0.0.1:8000/posts
# server log: [cache MISS] feed loaded from Postgres in 4.10ms, cached for 30s

# 2. Second call within 30s: HIT, served from Redis, and visibly faster
curl http://127.0.0.1:8000/posts
# server log: [cache HIT] feed served from Redis in 0.35ms

# 3. Create a new post (using the token from Stage 2/3's login flow)
curl -X POST http://127.0.0.1:8000/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"caption": "cache should be invalidated now"}'

# 4. Immediately call GET /posts again -- this is a MISS again (we deleted the key on write),
#    and the new post is visible right away instead of waiting out the TTL.
curl http://127.0.0.1:8000/posts
# server log: [cache MISS] feed loaded from Postgres in 3.87ms, cached for 30s
```

You can also verify the raw key directly against Redis:

```bash
docker exec -it instagram-clone-redis redis-cli GET feed:latest
docker exec -it instagram-clone-redis redis-cli TTL feed:latest
```

## What Changed and Why

- **Cache-aside, not write-through:** we only populate the cache on a read miss, never on write. This keeps writes fast and simple — the trade-off (per Phase 06 Lesson 01) is that the very first read after a miss pays the full DB cost.
- **TTL as a safety net, explicit delete as the primary invalidation:** the 30-second TTL guards against any invalidation we forgot to wire up; the `cache.delete()` on every write is what actually keeps the feed fresh in the common case.
- **A single cache key for now (`feed:latest`)** because Stage 4 is intentionally still a single-feed toy — a real per-user feed cache (`feed:user:{id}`) is a natural extension you'll see referenced in the Instagram case study in Phase 10 Lesson 02.

## Still Missing

Post creation is still fully synchronous — if we added an image-thumbnail step right now, the client would sit waiting for it before getting a response. Stage 5 moves that work onto a background worker.
