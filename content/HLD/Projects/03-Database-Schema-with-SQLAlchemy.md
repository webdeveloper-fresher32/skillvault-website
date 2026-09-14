# Stage 3: Database Schema with SQLAlchemy

**Pairs with:** [Phase 05, Lesson 01 — Indexing](../Phase-05-Database-Design-and-Scaling/01-Indexing.md)

## Why This Stage, Why Now

Everything so far lived in Python lists that vanish on restart. Phase 05 is where the course moves from "how does a backend serve a request" to "how does a backend not lose data" — and Lesson 01 specifically taught the exact pattern we use below: a `Column(..., index=True)` on the field we'll look up constantly (`email`), so a lookup is a B-tree jump instead of a linear scan through every row.

This stage swaps the in-memory `users`/`posts` lists for real tables in Postgres, using SQLAlchemy as the ORM.

## Get a Local Postgres Running

```bash
docker run --name instagram-clone-db \
  -e POSTGRES_USER=appuser \
  -e POSTGRES_PASSWORD=apppassword \
  -e POSTGRES_DB=instagram_clone \
  -p 5432:5432 \
  -d postgres:16
```

## Setup

```bash
pip install fastapi uvicorn pyjwt "passlib[bcrypt]" sqlalchemy psycopg2-binary
```

## The Models

`models.py`:

```python
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)  # <- Phase 05 Lesson 01's exact pattern
    hashed_password = Column(String, nullable=False)

    posts = relationship("Post", back_populates="owner")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    caption = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="posts")
```

`email` is indexed because every login does `WHERE email = ?` — without the index that's a full table scan once we have more than a handful of rows. `user_id` on `Post` is indexed too, because fetching "all posts by this user" is a query we'll run constantly.

## Engine and Session Setup

`database.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://appuser:apppassword@localhost:5432/instagram_clone"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## The Full Updated `main.py`

```python
from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import engine, get_db
from models import Base, User, Post

app = FastAPI(title="Instagram Clone - Stage 3")

# Creates the "users" and "posts" tables if they don't already exist.
Base.metadata.create_all(bind=engine)

SECRET_KEY = "dev-secret-change-me"
ALGORITHM = "HS256"
TOKEN_EXPIRY_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PostCreate(BaseModel):
    caption: str
    image_url: Optional[str] = None


class PostOut(BaseModel):
    id: int
    user_id: int
    caption: str
    image_url: Optional[str]

    class Config:
        from_attributes = True


def create_access_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user_id(authorization: str = Header(...)) -> int:
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


@app.post("/signup", status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="email already registered")

    user = User(email=payload.email, hashed_password=pwd_context.hash(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email}


@app.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not pwd_context.verify(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="invalid email or password")

    return TokenResponse(access_token=create_access_token(user.id))


@app.get("/posts", response_model=list[PostOut])
def list_posts(db: Session = Depends(get_db)):
    return db.query(Post).order_by(Post.created_at.desc()).all()


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
    return post


@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return {"id": user.id, "email": user.email}
```

## Run It

```bash
uvicorn main:app --reload
```

## Verify It — Including Surviving a Restart

```bash
# 1. Sign up
curl -X POST http://127.0.0.1:8000/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "hunter2"}'

# 2. Log in
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "hunter2"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 3. Create a post
curl -X POST http://127.0.0.1:8000/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"caption": "surviving a restart now", "image_url": "https://example.com/a.jpg"}'

# 4. Fetch the feed
curl http://127.0.0.1:8000/posts
# -> [{"id":1,"user_id":1,"caption":"surviving a restart now","image_url":"https://example.com/a.jpg"}]

# 5. Stop the server (Ctrl+C), start it again:
#    uvicorn main:app --reload

# 6. Fetch the feed again -- the post is still there, because it's in Postgres, not RAM.
curl http://127.0.0.1:8000/posts
# -> [{"id":1,"user_id":1,"caption":"surviving a restart now","image_url":"https://example.com/a.jpg"}]
```

## What Changed and Why

- `email` carries a `unique=True, index=True` constraint — both a correctness guarantee (no duplicate accounts) and a performance one (login lookups stay fast as the `users` table grows).
- `Post.user_id` is a real foreign key now, not just an integer we trusted the client to send.
- Data now survives restarts, deploys, and (eventually) running multiple app instances against the same database — a precondition for Stage 7's load-balanced setup.

## Still Missing

Every `GET /posts` call still hits Postgres directly. That's fine at low traffic, but it's the first thing that gets expensive as the feed is read far more often than it's written. Stage 4 adds a cache in front of it.
