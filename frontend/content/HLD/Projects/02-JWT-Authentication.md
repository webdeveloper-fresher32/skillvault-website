# Stage 2: JWT Authentication

**Pairs with:** [Phase 08, Lesson 03 — JWT Authentication](../Phase-08-Storage-Gateway-and-Auth/03-JWT-Authentication.md)

## Why This Stage, Why Now

Stage 1 left a hole: anyone could call `POST /posts` and pretend to be any user. Phase 08 Lesson 03 taught the fix — a client logs in once, gets back a signed JWT, and attaches it to every future request instead of re-sending a password or relying on server-side session state. That statelessness matters a lot later: Phase 03 Lesson 02 explained that stateless auth is exactly what lets us put multiple server instances behind a load balancer in Stage 7 without users randomly getting logged out.

This stage adds `POST /signup`, `POST /login`, and a dependency that guards `POST /posts` behind a valid token.

## What's New

```
POST /signup  -> store user + hashed password
POST /login   -> verify password -> jwt.encode({"user_id": ...}, SECRET_KEY, algorithm="HS256")
POST /posts   -> requires "Authorization: Bearer <token>", decoded to get user_id
```

## Setup

```bash
pip install fastapi uvicorn pyjwt passlib[bcrypt]
```

## The Full Updated `main.py`

```python
from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from itertools import count
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext

app = FastAPI(title="Instagram Clone - Stage 2")

SECRET_KEY = "dev-secret-change-me"   # in real life: pull from env vars / a secrets manager
ALGORITHM = "HS256"
TOKEN_EXPIRY_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- In-memory "database" (still no real persistence — that's Stage 3) ---
users = []  # each: {"id": int, "username": str, "hashed_password": str}
_user_id_counter = count(1)

posts = []
_post_id_counter = count(1)


# --- Schemas ---
class SignupRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PostCreate(BaseModel):
    caption: str
    image_url: Optional[str] = None


class Post(PostCreate):
    id: int
    user_id: int


# --- Auth helpers ---
def create_access_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user_id(authorization: str = Header(...)) -> int:
    """FastAPI dependency: every route that depends on this requires a valid Bearer token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid token")

    return payload["user_id"]


# --- Routes ---
@app.post("/signup", status_code=201)
def signup(payload: SignupRequest):
    if any(u["username"] == payload.username for u in users):
        raise HTTPException(status_code=409, detail="username already taken")

    user = {
        "id": next(_user_id_counter),
        "username": payload.username,
        "hashed_password": pwd_context.hash(payload.password),
    }
    users.append(user)
    return {"id": user["id"], "username": user["username"]}


@app.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = next((u for u in users if u["username"] == payload.username), None)
    if not user or not pwd_context.verify(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="invalid username or password")

    token = create_access_token(user["id"])
    return TokenResponse(access_token=token)


@app.get("/posts", response_model=list[Post])
def list_posts():
    return posts


@app.post("/posts", response_model=Post, status_code=201)
def create_post(payload: PostCreate, user_id: int = Depends(get_current_user_id)):
    post = Post(id=next(_post_id_counter), user_id=user_id, **payload.dict())
    posts.append(post.dict())
    return post


@app.get("/users/{user_id}")
def get_user(user_id: int):
    for u in users:
        if u["id"] == user_id:
            return {"id": u["id"], "username": u["username"]}
    raise HTTPException(status_code=404, detail="user not found")
```

The key line to notice — it's the exact pattern from Phase 08 Lesson 03:

```python
jwt.encode(
    {"user_id": user.id},
    SECRET_KEY,
    algorithm="HS256"
)
```

`create_access_token` just wraps that call and adds an expiry claim.

## Run It

```bash
uvicorn main:app --reload
```

## Verify It

```bash
# 1. Sign up
curl -X POST http://127.0.0.1:8000/signup \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "hunter2"}'
# -> {"id":1,"username":"alice"}

# 2. Log in and capture the token
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "hunter2"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "Got token: $TOKEN"

# 3. Create a post using the token
curl -X POST http://127.0.0.1:8000/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"caption": "hello world", "image_url": "https://example.com/a.jpg"}'
# -> {"caption":"hello world","image_url":"https://example.com/a.jpg","id":1,"user_id":1}

# 4. Attempt WITHOUT a token -> 401
curl -i -X POST http://127.0.0.1:8000/posts \
  -H "Content-Type: application/json" \
  -d '{"caption": "no token here"}'
# -> HTTP/1.1 401 Unauthorized
# -> {"detail":"missing or malformed Authorization header"}
```

## What Changed and Why

- Passwords are never stored in plaintext — `passlib`'s bcrypt hashing handles that (a general security practice, not HLD-specific, but non-negotiable in any real backend).
- `user_id` for a new post now comes from the **decoded token**, not from the request body — the client can no longer forge another user's `user_id` on `POST /posts`.
- The token is stateless: the server verifies it by re-computing the signature with `SECRET_KEY`, it doesn't look anything up in a session table. This is exactly the property Phase 03 Lesson 02 said we'd need before we could run more than one server instance.

## Still Missing

No real database yet — `users` and `posts` are still in-memory lists, so a server restart wipes signups too. Stage 3 fixes that.
