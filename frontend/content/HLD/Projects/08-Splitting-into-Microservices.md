# Stage 8: Splitting into Microservices

**Pairs with:** [`Phase-02-Monolith-vs-Microservices/02-Microservices-Architecture.md`](../Phase-02-Monolith-vs-Microservices/02-Microservices-Architecture.md)

## Where We Left Off

Stage 7 proved the app scales horizontally, but it's still one codebase — every instance runs auth routes, post routes, everything. Phase 02 Lesson 02 describes the next step real companies take once a monolith's parts need to scale, deploy, or fail independently: carve it into services, each with its own process (and, eventually, its own datastore).

## Why Now

This backend has an obvious seam: **auth** (signup/login/token issuing) is a different concern from **posts** (create/read/cache/thumbnail). They change at different rates, and in a real system Auth would be called by every other service, so it benefits from being its own deployable unit. This stage extracts an **Auth Service** and a **Post Service** — the exact split pattern from Phase 02 Lesson 02's Login/Order/Product services example, scaled down to two services.

## Step 1: Auth Service

`auth_service/main.py`:

```python
import os
import jwt
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from passlib.hash import bcrypt
from database import get_db, User  # reused from Stage 3

app = FastAPI(title="Auth Service")

SECRET_KEY = os.environ.get("JWT_SECRET", "shared-secret-change-me")
ALGORITHM = "HS256"


@app.post("/signup")
def signup(email: str, password: str, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email already registered")
    user = User(email=email, hashed_password=bcrypt.hash(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email}


@app.post("/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user or not bcrypt.verify(password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    token = jwt.encode(
        {"user_id": user.id, "exp": datetime.utcnow() + timedelta(hours=1)},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    return {"access_token": token, "token_type": "bearer"}


@app.get("/verify")
def verify(token: str):
    """Kept for services that prefer a network call over local validation."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {"valid": True, "user_id": payload["user_id"]}
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
```

Run it on its own port:

```bash
cd auth_service && uvicorn main:app --port 9001
```

## Step 2: Post Service — Two Ways to Validate the JWT

**Option A — network call to Auth Service** (simple, but adds a hop and a hard dependency on Auth Service's uptime/latency to every single post read):

```python
import httpx

async def get_current_user_via_network(token: str) -> int:
    async with httpx.AsyncClient() as client:
        resp = await client.get("http://localhost:9001/verify", params={"token": token})
        if resp.status_code != 200:
            raise HTTPException(401, "Unauthorized")
        return resp.json()["user_id"]
```

**Option B — local validation with a shared secret** (Post Service decodes the JWT itself, using the same `JWT_SECRET` Auth Service signed it with — no network call per request):

```python
import os
import jwt
from fastapi import HTTPException, Header

SECRET_KEY = os.environ.get("JWT_SECRET", "shared-secret-change-me")
ALGORITHM = "HS256"


def get_current_user(authorization: str = Header(...)) -> int:
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["user_id"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
```

**Recommendation: Option B.** A JWT is self-verifying by design — the whole point of signing it is that any service holding the shared secret can validate it without asking the issuer. Option A turns every single post request into two requests and makes Post Service's availability hostage to Auth Service's, which defeats the fault-isolation benefit microservices were supposed to buy (Phase 02 Lesson 02).

`post_service/main.py` (using Option B):

```python
from fastapi import FastAPI, Depends, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db, Post
from auth_local import get_current_user
from storage import upload_image

app = FastAPI(title="Post Service")


@app.post("/posts")
def create_post(
    caption: str,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    image_url = upload_image(image.file.read(), image.content_type)
    post = Post(user_id=user_id, caption=caption, image_url=image_url)
    db.add(post)
    db.commit()
    db.refresh(post)
    return {"id": post.id, "caption": post.caption, "image_url": post.image_url}


@app.get("/posts")
def list_posts(db: Session = Depends(get_db)):
    return db.query(Post).order_by(Post.id.desc()).limit(50).all()
```

Run it on its own port:

```bash
cd post_service && uvicorn main:app --port 9002
```

Both services connect to the same Postgres instance for now — splitting the database per service is a further step real systems eventually take (and it's the point where distributed transactions get hard, per Phase 02 Lesson 02) but is out of scope for this stage.

## Run It

```bash
export JWT_SECRET=shared-secret-change-me
cd auth_service && uvicorn main:app --port 9001 &
cd post_service && uvicorn main:app --port 9002 &
```

## Verify

```bash
# 1. Signup + login against Auth Service directly
curl -X POST "http://localhost:9001/signup?email=bob@example.com&password=hunter2"
TOKEN=$(curl -s -X POST "http://localhost:9001/login?email=bob@example.com&password=hunter2" | jq -r .access_token)

# 2. Create a post against Post Service directly — no call back to Auth Service
curl -X POST http://localhost:9002/posts \
  -H "Authorization: Bearer $TOKEN" \
  -F "caption=Split into services!" \
  -F "image=@./sunset.jpg"

# 3. List posts from Post Service
curl http://localhost:9002/posts
```

If step 2 succeeds without Auth Service receiving any request during it (check Auth Service's terminal — no incoming log line), local JWT validation is confirmed working.

## What's Still Missing

Two services, each started by hand with `uvicorn`, each needing its own dependency install. Stage 9 packages every piece — Auth Service, Post Service, Nginx, Postgres, Redis, MinIO, the Celery worker — into containers that start with one command.
