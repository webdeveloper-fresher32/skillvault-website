# Stateless Services

You just added a second server and a load balancer, feeling good about horizontally scaling your app. A user logs in. Their login request happens to land on **Server 1**, which stores "this session belongs to this user" in a plain Python dictionary in memory. Their next click — say, "View Profile" — gets load-balanced to **Server 2**. Server 2 has never heard of this session. As far as it's concerned, the user was never logged in. They get bounced back to the login page, confused and annoyed.

This is the single most common way horizontal scaling silently breaks.

## The failure, as a diagram

```
                     ┌────────────────┐
   1. POST /login    │  Load Balancer  │
   ────────────────► └────────┬───────┘
                               │ routes to Server 1
                               ▼
                     ┌────────────────┐
                     │   Server 1      │
                     │  session_store  │ ← { "user:42": "logged_in" } lives ONLY here,
                     │  = {} (memory)  │    in this process's RAM
                     └────────────────┘

                     ┌────────────────┐
   2. GET /profile   │  Load Balancer  │
   ────────────────► └────────┬───────┘
                               │ routes to Server 2 this time
                               ▼
                     ┌────────────────┐
                     │   Server 2      │
                     │  session_store  │ ← empty! Never saw user:42.
                     │  = {} (memory)  │    Response: 401 Unauthorized
                     └────────────────┘
```

Nothing crashed. No error was logged as a "bug" in the traditional sense. The system is just architecturally incapable of remembering the user consistently, because "memory" means "one specific process's RAM," and the load balancer has no reason to keep sending the same user to the same box.

## The fix: get state out of the server's memory

There are two standard ways to solve this, and you'll see both again later in this course:

1. **Stateless tokens (JWT)** — instead of the server remembering "this session is logged in," the *client* holds a signed token that proves who they are on every request. Any server can verify the token without needing to have seen the login request. Covered in depth in Phase 08, Lesson 03 (JWT Authentication).
2. **Shared/external session store** — the server still uses "sessions," but instead of storing them in local memory, it stores them in a shared store like Redis that every server instance can read from. Server 1 writes the session to Redis; Server 2 reads it from Redis. Covered in Phase 06 (Caching), which is exactly the kind of low-latency shared store this needs.

Either way, the fix is the same idea: **no server keeps anything in local memory that another server would need to know about.** Any request should be answerable by any server, using only the token it was handed or data fetched from a shared backend (database, cache). That property is called being *stateless*, and it's the precondition that makes the horizontal scaling diagram from Lesson 01 actually work in practice.

## Code contrast: stateful session dict vs. stateless JWT

**Stateful — breaks the moment you add a second server:**

```python
# In-memory session store — lives only in THIS process's RAM
session_store = {}

@app.post("/login")
def login(credentials: LoginRequest):
    user = authenticate(credentials)
    session_store[user.id] = {"logged_in": True}  # only Server 1 knows this
    return {"message": "logged in"}

@app.get("/profile")
def profile(user_id: int):
    if user_id not in session_store:  # Server 2 has never seen this dict entry
        raise HTTPException(status_code=401, detail="Not logged in")
    return get_profile(user_id)
```

**Stateless — any server can handle any request:**

```python
import jwt

SECRET_KEY = "super-secret-key"

@app.post("/login")
def login(credentials: LoginRequest):
    user = authenticate(credentials)
    token = jwt.encode({"user_id": user.id}, SECRET_KEY, algorithm="HS256")
    return {"token": token}  # client stores this, sends it on every future request

@app.get("/profile")
def profile(token: str = Header(...)):
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])  # any server can verify
    return get_profile(payload["user_id"])
```

The second version stores nothing about the session in server memory at all. Server 1 issues the token; Server 2, 3, or 4 can decode and trust it without ever having talked to Server 1. That's what makes it safe to load-balance across any number of identical servers.

## Formal definition

A **stateless service** is one where no server instance retains client-specific data (sessions, in-progress request state) between requests in its own local memory. Any instance can handle any request, given the request's own contents (a token) or data fetched from a shared, external store (database, cache).

A **stateful service**, by contrast, keeps such data locally — which forces all of a given client's requests to be routed to the same specific instance (a pattern called "sticky sessions," discussed as a load balancer trade-off in Phase 04) or breaks entirely without that guarantee.

## Interview Q&A

**Q: Why does horizontal scaling require statelessness?**
A: A load balancer distributes requests across servers without guaranteeing that the same client always hits the same server. If a server stores session-specific state only in its own memory, any request routed to a different server won't have access to that state, causing failures like being logged out mid-session. Statelessness ensures any server can correctly handle any request.

**Q: What are the two main ways to make an authentication system stateless?**
A: (1) Use a self-contained, signed token like a JWT that the client holds and sends with every request — the server verifies it without needing to remember anything. (2) Keep server-side sessions, but store them in a shared external store like Redis instead of local memory, so every server instance can read the same session data.

**Q: What is a "sticky session," and is it a real fix for this problem?**
A: A sticky session configures the load balancer to always route a given client to the same backend server (often via a cookie or IP hash). It works around the immediate symptom, but it doesn't actually make the service stateless — that server is still a single point of failure for that user's session, and it complicates rebalancing traffic or handling that server going down. It's a band-aid, not the underlying fix.

**Q: Between JWTs and a shared Redis session store, which would you recommend and why?**
A: It depends on the requirement. JWTs avoid a network hop to verify a session (the token is self-contained and verified locally), which is faster and scales better, but revoking a JWT before it expires is hard (you'd need a blocklist). A shared session store makes revocation trivial (just delete the session) and keeps sensitive session data server-side, at the cost of an extra network call to Redis on every request. Many production systems use short-lived JWTs plus a refresh-token mechanism to get most of the speed benefit while still allowing revocation.

**Q: Does "stateless" mean the application has no state anywhere?**
A: No — it means no server instance holds client-specific state in its own local memory between requests. The actual state (user data, sessions, posts) still lives somewhere durable and shared — a database, a cache like Redis — that every server instance can reach. "Stateless" describes the servers, not the system as a whole.
