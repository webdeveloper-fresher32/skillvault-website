# Stage 1: Basic FastAPI Backend

**Pairs with:** [Phase 01 — Foundations and Request Lifecycle](../Phase-01-Foundations-and-Request-Lifecycle/README.md)

## Why This Stage, Why Now

Phase 01 walked through what happens between a client and a server — the request-response cycle, the hops a request takes. Before we can talk about load balancers, databases, or caches, we need the simplest possible thing sitting at the end of that chain: a server that accepts a request and returns a response. This stage is that skeleton — nothing persists, nothing is authenticated, it's the "backend" in its most stripped-down form.

We're building a simplified Instagram clone. At this stage it has exactly two ideas: `users` and `posts`, both held in plain Python lists in memory. Restart the server and everything is gone — that's expected, and it's explicitly called out below as the thing the next two stages fix.

## What We're Building

```
Client --HTTP--> FastAPI app --> in-memory list --> HTTP response
```

Three endpoints:
- `GET /posts` — list all posts (the "feed").
- `POST /posts` — create a post.
- `GET /users/{id}` — fetch a single user by id.

## Project Setup

```bash
mkdir instagram-clone && cd instagram-clone
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
```

## The Code

`main.py`:

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from itertools import count

app = FastAPI(title="Instagram Clone - Stage 1")

# --- In-memory "database" ---
# NOTE: this is NOT persistence. Restarting the server wipes everything.
# We fix that in Stage 3 with a real Postgres database via SQLAlchemy.
users = [
    {"id": 1, "username": "alice"},
    {"id": 2, "username": "bob"},
]

posts = []
_post_id_counter = count(1)


class PostCreate(BaseModel):
    user_id: int
    caption: str
    image_url: Optional[str] = None


class Post(PostCreate):
    id: int


@app.get("/posts", response_model=list[Post])
def list_posts():
    """Return every post — this is the 'feed'."""
    return posts


@app.post("/posts", response_model=Post, status_code=201)
def create_post(payload: PostCreate):
    # NOTE: no auth check yet — anyone can post as any user_id.
    # Stage 2 closes this hole with a JWT-protected dependency.
    if not any(u["id"] == payload.user_id for u in users):
        raise HTTPException(status_code=404, detail="user not found")

    post = Post(id=next(_post_id_counter), **payload.dict())
    posts.append(post.dict())
    return post


@app.get("/users/{user_id}")
def get_user(user_id: int):
    for u in users:
        if u["id"] == user_id:
            return u
    raise HTTPException(status_code=404, detail="user not found")
```

## Run It

```bash
uvicorn main:app --reload
```

The app is now listening on `http://127.0.0.1:8000`.

## Verify It

```bash
# 1. Fetch a user
curl http://127.0.0.1:8000/users/1
# -> {"id":1,"username":"alice"}

# 2. Feed is empty at first
curl http://127.0.0.1:8000/posts
# -> []

# 3. Create a post
curl -X POST http://127.0.0.1:8000/posts \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "caption": "first post", "image_url": "https://example.com/a.jpg"}'
# -> {"id":1,"user_id":1,"caption":"first post","image_url":"https://example.com/a.jpg"}

# 4. Feed now has one post
curl http://127.0.0.1:8000/posts
# -> [{"id":1,"user_id":1,"caption":"first post","image_url":"https://example.com/a.jpg"}]

# 5. Creating a post for a user that doesn't exist fails
curl -X POST http://127.0.0.1:8000/posts \
  -H "Content-Type: application/json" \
  -d '{"user_id": 999, "caption": "ghost post"}'
# -> {"detail":"user not found"}  (404)
```

## What's Missing (On Purpose)

- **No authentication.** Anyone can call `POST /posts` and claim to be any `user_id`. Stage 2 fixes this with signup/login and a JWT-protected dependency.
- **No persistence.** Restart the server (`Ctrl+C` then `uvicorn main:app --reload` again) and `posts` is back to `[]`. Stage 3 replaces the in-memory lists with a real Postgres database.
- **No caching, no background jobs, no scaling story.** Those come in Stages 4, 5, and 7 respectively — one concept at a time, matching the phase order in the course.

## Interview Tie-In

If an interviewer asks "walk me through what happens when a client hits your API," this stage is the literal answer at its simplest: client sends an HTTP request, FastAPI routes it to a handler function, the handler reads/writes some state, and a JSON response goes back. Everything from Stage 2 onward is *hardening* that same basic loop — adding auth, durability, speed, and scale around it without changing the core idea.
