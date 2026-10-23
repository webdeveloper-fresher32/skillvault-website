# API Gateway

Picture the microservices picture from Phase 02: an Auth Service, an Orders Service, a Payments Service, a Products Service, each with its own database, each deployed independently. Now imagine you're building the mobile app that talks to all of them. Does the app need to know the internal hostname of four different services, retry each one separately, and re-implement authentication four times? That's exactly the mess an API Gateway exists to prevent.

## The Problem: Clients Talking Directly to Every Service

```
❌ Without a gateway — client juggles every service directly

  Mobile App
   ├──────────────▶ Auth Service       (auth.internal:8001)
   ├──────────────▶ Orders Service     (orders.internal:8002)
   ├──────────────▶ Payments Service   (payments.internal:8003)
   └──────────────▶ Products Service   (products.internal:8004)

  - The client must know every service's address and how it moves
  - Each service re-implements its own auth check
  - Each service re-implements its own rate limiting
  - Adding/removing/splitting a service breaks every client that hardcoded it
```

## The Fix: One Front Door

```
✅ With a gateway — one address, one place to enforce cross-cutting concerns

  Client
    │
    ▼
┌─────────────────┐
│   API Gateway    │
└─────────────────┘
    │       │       │        │
    ▼       ▼       ▼        ▼
  Auth   Orders  Payments  Products
Service Service  Service   Service
```

The client only ever talks to the gateway. The gateway is responsible for figuring out which backend service should actually handle each request, and forwarding it there.

## What a Gateway Does Beyond Routing

Routing alone would just be "a smarter reverse proxy." An API Gateway earns its name by also handling the concerns that would otherwise be duplicated in every service:

- **Auth enforcement** — validate the caller's JWT (Phase 08 Lesson 03) *once*, at the gateway, before the request ever reaches Orders or Payments. Services behind the gateway can trust that an authenticated request already carries a verified identity, instead of each service re-implementing token validation.
- **Rate limiting** — reject or throttle a client making too many requests per second, protecting every downstream service with a single policy instead of four separate ones (this reuses the Redis-counter pattern from Phase 06 Lesson 03).
- **Request/response transformation** — adapt a public-facing API shape to whatever internal services actually expect (e.g. combining fields from two internal services into one response, or translating an old API version's request shape into the new one), so clients are insulated from internal refactors.
- **Load balancing and service discovery** — the gateway (often paired with the load balancer from Phase 04) knows how to find a healthy instance of "Orders Service" without the client ever knowing an instance even exists.
- **Observability** — a single place to log/measure every request that crosses the system boundary, feeding directly into the monitoring stack from Phase 09.

## A Minimal Gateway Route (FastAPI, Conceptually)

Production systems reach for dedicated gateway software (Kong, AWS API Gateway, NGINX with routing rules), but the logic a gateway performs is simple enough to sketch directly:

```python
from fastapi import FastAPI, Request, HTTPException
import httpx
import jwt

app = FastAPI()
SECRET_KEY = "shared-secret"

SERVICE_MAP = {
    "orders": "http://orders-service:8002",
    "payments": "http://payments-service:8003",
    "products": "http://products-service:8004",
}

@app.api_route("/{service}/{path:path}", methods=["GET", "POST"])
async def gateway(service: str, path: str, request: Request):
    # 1. Auth enforcement — done once, here, not in every downstream service
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    try:
        jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or missing token")

    # 2. Routing — forward to the right internal service
    if service not in SERVICE_MAP:
        raise HTTPException(status_code=404, detail="Unknown service")

    target_url = f"{SERVICE_MAP[service]}/{path}"
    async with httpx.AsyncClient() as client:
        response = await client.request(
            request.method, target_url, headers=dict(request.headers),
            content=await request.body(),
        )
    return response.json()
```

Note what this buys the downstream `orders-service` and `payments-service`: they never see an unauthenticated request, never implement their own JWT check, and never need to know the client's real network address — the gateway is the only thing they trust.

## Why Clients Shouldn't Talk to Microservices Directly

Beyond the duplication problem above, direct client-to-service access breaks encapsulation at the architecture level: internal services become part of your *public* API surface the moment a client hardcodes their address. You lose the ability to split a service in two, merge two services, move one behind a cache, or change an internal protocol — any of which would now be a breaking change for every client. The gateway is the seam that keeps "how the backend is internally organized" separate from "what the outside world is allowed to depend on."

## Interview Q&A

**Q: What problem does an API Gateway solve in a microservices architecture?**
Answer: Without a gateway, every client needs to know the address of every internal service and each service must duplicate cross-cutting concerns like auth checks and rate limiting. A gateway gives clients one stable entry point, handles routing to the right internal service, and centralizes auth, rate limiting, and request/response transformation so individual services don't have to reimplement them.

**Q: Isn't an API Gateway just a fancier load balancer?**
Answer: They overlap but solve different problems. A load balancer (Phase 04) distributes requests across multiple *identical* instances of one service to spread load. An API Gateway routes requests across *different* services based on the request path/content, and additionally enforces auth, rate limiting, and transformation — a gateway often sits in front of, and works alongside, a load balancer for each service it routes to.

**Q: Where should JWT validation happen — in the gateway, or in each downstream service?**
Answer: At minimum, the gateway should validate the token's signature and reject anything invalid before it reaches any internal service, since that removes duplicated auth logic and protects every service uniformly. Some architectures still have each service perform a lightweight local check (verify the JWT signature with a shared secret) as defense-in-depth, but the heavier logic — checking the token is present and well-formed at all — belongs at the gateway.

**Q: What happens if the API Gateway goes down?**
Answer: Since it's the single entry point, it becomes a single point of failure for the entire system if run as one instance — so in practice the gateway itself is deployed as multiple stateless instances behind a load balancer (same statelessness argument as Phase 03), so no single gateway instance failing takes down client access.

**Q: How does an API Gateway help when you want to change your internal service boundaries later (e.g. split one service into two)?**
Answer: Because clients only ever address the gateway and never know the real internal service topology, you can split, merge, rename, or move internal services and only update the gateway's routing rules — clients see no difference. Without a gateway, any change to internal service addresses would be a breaking change for every client that hardcoded them.
