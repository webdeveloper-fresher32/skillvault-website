# Microservices Architecture

## Table of Contents
1. [The Hook: Same Features, Split Apart](#1-the-hook-same-features-split-apart)
2. [Project Layout](#2-project-layout)
3. [Pros of Microservices](#3-pros-of-microservices)
4. [Cons of Microservices](#4-cons-of-microservices)
5. [Formal Definition](#5-formal-definition)
6. [Interview Q&A](#6-interview-qa)

---

## 1. The Hook: Same Features, Split Apart

Now imagine the same e-commerce backend, but at Amazon's scale — millions of orders a day, hundreds of engineers, and wildly different scaling needs across features (Login is read-heavy and simple; Payments is low-volume but must never lose data; Inventory changes constantly during flash sales). At that scale, one shared codebase and one shared database becomes the bottleneck, not the simplification. The fix: split each feature into its own independently deployable service, each with **its own database**.

```
                         ┌────────────────┐
                         │  API Gateway    │
                         └────────┬───────┘
              ┌───────────┬───────┼───────────┬───────────┐
              ▼           ▼       ▼           ▼           ▼
        ┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐
        │  Login    ││  Order    ││  Cart     ││ Inventory ││ Payment   │
        │  Service  ││  Service  ││  Service  ││  Service  ││  Service  │
        └────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘
             ▼            ▼            ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ Login DB │  │ Order DB │  │ Cart DB  │  │Inv. DB   │  │Payment DB│
        └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

Each box — Login Service, Order Service, Cart Service, Inventory Service, Payment Service — is its own running process, deployed on its own schedule, scaled independently, and owning its own data. Nothing reaches into another service's database directly; they talk to each other only over the network (usually HTTP/REST or gRPC, or asynchronously via a queue — see Phase 07).

## 2. Project Layout

Instead of one project with routers for every feature, you now have **one project per service**, each a complete, independently runnable FastAPI app:

```python
# auth-service/main.py
from fastapi import FastAPI

app = FastAPI(title="Auth Service")

@app.post("/login")
def login(email: str, password: str):
    # validates credentials against the Auth Service's OWN database
    # returns a JWT (Phase 08) that other services can verify independently
    ...
```

```python
# order-service/main.py
from fastapi import FastAPI
import httpx

app = FastAPI(title="Order Service")

@app.post("/orders")
def create_order(user_id: int, item_id: int):
    # calling another service now means an HTTP request, not a function call
    payment_response = httpx.post(
        "http://payment-service:8000/charge",
        json={"user_id": user_id, "item_id": item_id},
    )
    if payment_response.status_code != 200:
        return {"error": "payment failed"}
    # create the order in the Order Service's OWN database
    ...
```

```python
# product-service/main.py
from fastapi import FastAPI

app = FastAPI(title="Product Service")

@app.get("/products/{product_id}")
def get_product(product_id: int):
    ...
```

Three separate FastAPI apps — `Auth Service`, `Order Service`, `Product Service` — each deployable, scalable, and releasable independently of the others. The call from Order Service to Payment Service that used to be `PaymentService(self.db).charge(order)` (Lesson 01) is now `httpx.post("http://payment-service:8000/charge", ...)` — a real network hop that can time out, fail, or arrive out of order.

## 3. Pros of Microservices

- **Independent scaling.** If Inventory Service needs 20 instances during a flash sale but Login Service only needs 3, you scale each independently instead of paying for 20 copies of everything.
- **Independent deploys.** The Cart team can ship a fix ten times a day without coordinating with, or waiting on, the Payments team's release schedule.
- **Fault isolation.** A memory leak or crash in Product Service doesn't take down Login or Payments — the failure is contained to its own process (though a poorly designed dependency chain can still cause cascading failures, which is why timeouts and circuit breakers matter).
- **Teams own services end-to-end.** Each service can be owned by a small team that fully understands its data model, its deploys, and its on-call rotation, which scales organizationally far better than everyone working in one shared codebase.

## 4. Cons of Microservices

- **Network calls replace function calls.** Every cross-feature interaction that used to be an instant, reliable in-process call is now a network request that can be slow, can time out, and can fail independently of your own service being healthy.
- **Distributed transactions and data consistency get hard.** Order Service and Payment Service each have their own database — there is no single ACID transaction spanning both anymore. If the order is created but the payment call times out, you need patterns like sagas, the outbox pattern, or idempotency keys (all covered in later phases, especially Phase 11's Payment Gateway case study) to avoid double-charging or losing orders.
- **Operational overhead goes up sharply.** You now need a load balancer or API Gateway to route to the right service (Phase 04, Phase 08), centralized monitoring and tracing to debug a request that crosses five services (Phase 09), and infrastructure to deploy, version, and health-check each service independently. None of this exists "for free" the way it does in a monolith.

## 5. Formal Definition

A **microservices architecture** is a software design where an application is built as a collection of small, independently deployable services, each owning its own data store and communicating with other services over the network (rather than in-process). Each service is typically organized around a single business capability (Auth, Orders, Payments), can be developed, deployed, and scaled independently, and is often owned end-to-end by a single small team.

## 6. Interview Q&A

**Q: What is a microservices architecture, and how does it differ structurally from a monolith?**
Answer: Microservices split an application into independently deployable services, each with its own database, communicating over the network. A monolith is the opposite: one codebase, one process, one shared database, with in-process function calls between features. The core structural difference is that a function call becomes a network call, and a shared database becomes several independent ones.

**Q: What's the single biggest new problem microservices introduce that a monolith doesn't have?**
Answer: Distributed data consistency. Once each service owns its own database, you can no longer wrap a multi-service operation (like "create an order and charge a payment") in one atomic database transaction. You need explicit patterns — sagas, outbox pattern, idempotency keys — to handle partial failures safely, and those patterns add real design and operational complexity.

**Q: If Order Service calls Payment Service and the network call times out, what should happen?**
Answer: The Order Service should not assume the payment failed just because it didn't get a response in time — the payment might have actually succeeded on the Payment Service's side. A robust design uses idempotency keys so a safe retry doesn't double-charge, and treats "unknown" as a distinct state from "failed," often resolved later by reconciliation or a status-check call rather than blindly retrying.

**Q: Why do microservices need something like an API Gateway or load balancer that a monolith doesn't strictly need?**
Answer: In a monolith there's one process to talk to. In microservices, clients (and other services) need a single, stable entry point that can route requests to the right service, hide the internal service topology, and enforce cross-cutting concerns like authentication and rate limiting — otherwise every client would need to know the address of every individual service and re-implement those concerns itself.

**Q: Does splitting into microservices automatically make a system more scalable?**
Answer: Not automatically — it makes independent scaling *possible*, but only if the split follows real, differing scaling needs and the team has the operational maturity (monitoring, deployment automation, network resilience patterns) to run many services well. Splitting a system that doesn't have differing scaling needs, or splitting before the team can operate the added complexity, usually makes the system slower to develop and less reliable, not more scalable.
