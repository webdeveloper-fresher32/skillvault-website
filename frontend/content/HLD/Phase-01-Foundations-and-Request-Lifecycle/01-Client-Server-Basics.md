# Client-Server Basics — Complete Guide

## Table of Contents
1. [The Hook: What Happens When You Click "Login"](#1-the-hook-what-happens-when-you-click-login)
2. [Breaking Down Each Hop](#2-breaking-down-each-hop)
3. [A Minimal FastAPI `/login` Endpoint](#3-a-minimal-fastapi-login-endpoint)
4. [Formal Definitions](#4-formal-definitions)
5. [Interview Q&A](#5-interview-qa)

---

## 1. The Hook: What Happens When You Click "Login"

Imagine a plain HTML button:

```html
<button>Login</button>
```

You click it. A username and password get sent somewhere, and a second or two later you're looking at your inbox, your feed, or your dashboard. Nothing about that feels complicated from the user's side — but that single click sets off a chain of hops across machines you'll never see, on a company's infrastructure that might span multiple continents.

```
   You click "Login"
        │
        ▼
 ┌───────────┐      ┌─────────────┐      ┌──────────────────┐      ┌────────────────┐
 │  Browser   │ ───▶ │  Internet    │ ───▶ │  Load Balancer     │ ───▶ │ Backend Server  │
 │  (Client)  │      │ (routers,    │      │ (distributes       │      │ (runs your app  │
 │            │      │  ISPs)       │      │  the request)      │      │  code)          │
 └───────────┘      └─────────────┘      └──────────────────┘      └────────────────┘
                                                                              │
                                                                              ▼
                                                                     ┌────────────────┐
                                                                     │ Authentication  │
                                                                     │ (check creds)   │
                                                                     └────────────────┘
                                                                              │
                                                                              ▼
                                                                     ┌────────────────┐
                                                                     │   Database      │
                                                                     │ (look up user)  │
                                                                     └────────────────┘
                                                                              │
                                                                              ▼
                                                                     ┌────────────────┐
                                                                     │   Response      │
                                                                     │ (200 OK + JWT)  │
                                                                     └────────────────┘
                                                                              │
        ◀─────────────────────────────────────────────────────────────────────
   Browser renders your dashboard
```

That entire round trip — client asks, server answers — is the single most important mental model in this course. Every phase after this one is this same diagram, redrawn with more boxes, more copies of each box, and smarter routing between them.

---

## 2. Breaking Down Each Hop

Each box in that diagram earns its own one-sentence definition, because interviewers will pull on any of them individually:

- **Client** — the program that *initiates* the request and consumes the result; usually a browser, mobile app, or another service calling yours. It never receives requests unprompted — it always speaks first.
- **Server** — the program that *listens* for requests and sends back a response; it can serve many clients concurrently and generally has no idea who a given client is between requests unless it's told (more on this in Phase 03).
- **"The Internet"** — a convenient abstraction over a genuinely enormous amount of machinery: your ISP, backbone routers, undersea cables, peering agreements between networks. As an interview candidate you don't need to explain any of that — you just need to know that "the internet" is doing packet routing, not business logic, and that DNS (Lesson 02) has to run before this hop can even begin.
- **Load Balancer** — a component that sits in front of your backend and decides which backend instance handles each incoming request. Even a "one server" production setup typically still has a load balancer in front of it, for three reasons: it gives you a stable public entry point while backend IPs change (deploys, restarts, autoscaling), it lets you add a second server later with zero client-facing changes, and it can run health checks and stop routing traffic to a server the moment it dies. Skipping it because "we only have one server" is exactly the kind of shortcut that turns into a 3 a.m. outage the day you need a second one.
- **Backend Server** — where your actual application code runs: routing, business logic, calling the database, calling other services.
- **Authentication** — the step where the backend verifies *who* is making the request (valid credentials, valid token) before doing anything sensitive on their behalf. It's drawn as a separate box here because it's conceptually distinct from "run the business logic," even though in a small system it might just be a function call inside the same backend process.
- **Database** — durable storage the backend reads from and writes to; in the login example, it's where the user's hashed password and profile live.
- **Response** — the data (and status code) sent back down the same path to the client. The client then decides what to do with it — render a page, show an error, store a token.

---

## 3. A Minimal FastAPI `/login` Endpoint

Here's the backend + authentication portion of that diagram as real code — a stub, but structurally the real shape you'll see in production services:

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

# Stand-in for the "Database" box — a real service queries Postgres/MySQL here.
FAKE_USER_DB = {
    "asha@example.com": {"password": "hunter2", "user_id": 1},
}


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/login")
def login(payload: LoginRequest):
    user = FAKE_USER_DB.get(payload.email)

    # --- Authentication step ---
    if user is None or user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # In a real system: issue a JWT here instead of a bare success message
    # (covered in full in Phase 08, Lesson 03).
    return {"message": "Login successful", "user_id": user["user_id"]}
```

Run it with `uvicorn main:app --reload` and it's already a real client-server pair: your terminal's `curl` (or a browser) is the client, this process is the server, and the request-response cycle is exactly the last three boxes of the diagram above, minus the load balancer (which you'd only need once there's more than one instance of this process — Phase 04).

```bash
curl -X POST http://127.0.0.1:8000/login \
  -H "Content-Type: application/json" \
  -d '{"email": "asha@example.com", "password": "hunter2"}'
```

---

## 4. Formal Definitions

- **Client-server architecture** — a distributed application structure that partitions work between service providers (servers) and service requesters (clients), where clients initiate communication and servers respond. It's the dominant model for web and mobile applications precisely because it lets many clients share one (or a fleet of) centrally-managed servers, rather than every user's device having to talk directly to every other user's device.
- **Request-response cycle** — the full round trip of a client sending a request and a server sending back a response, treated as one logical unit of interaction. Every HTTP call — a page load, an API call, the `/login` POST above — is one instance of this cycle. Everything this course adds (caching, queues, replication) exists to make that cycle faster, more reliable, or cheaper at scale, without changing its basic shape.

---

## 5. Interview Q&A

**Q: What's the difference between a client and a server?**
Answer: A client initiates a request and consumes the response; a server listens for requests and produces responses. The relationship is directional — a browser is a client to your API, but your API can itself be a client when it calls a database or another microservice. "Client" and "server" describe a role in a given interaction, not a fixed identity of a machine.

**Q: Why would you put a load balancer in front of just one backend server?**
Answer: Even with a single instance, a load balancer gives clients one stable address to talk to while the backend's actual IP or instance can change behind the scenes (restarts, deploys, autoscaling), and it lets you run health checks so traffic automatically stops going to a crashed instance. Most importantly, it means scaling from one server to many later requires zero changes to how clients connect — you're not retrofitting your architecture under pressure once traffic grows.

**Q: In the login diagram, why is "Authentication" drawn as a separate step from "Backend Server"?**
Answer: They're conceptually distinct concerns even if they run in the same process for a small app: the backend server handles routing and orchestration, while authentication specifically verifies identity before anything sensitive happens. Drawing them separately makes it obvious where you'd extract authentication into its own service (an Auth Service, or an API Gateway's built-in auth layer — Phase 08) once the system grows.

**Q: Does the client need to know anything about the database or authentication logic?**
Answer: No — and that's the point of the client-server split. The client only needs to know the API contract (send this JSON to this endpoint, expect this JSON back). Everything behind the load balancer — auth checks, database schema, internal service calls — is free to change without the client ever knowing, as long as the contract stays stable.

**Q: If a request fails between the browser and the backend, at which hop would you start debugging?**
Answer: Start from the client side and work inward: confirm DNS resolved to the right IP, confirm the request actually left the browser (network tab), then check the load balancer's health checks and logs, then the backend's own logs, then the database. In an interview, naming this order signals you understand the request lifecycle as a sequence of independently-failing hops, not a single opaque "the internet" step.
