# Monolith Architecture

## Table of Contents
1. [The Hook: One Codebase, Every Feature](#1-the-hook-one-codebase-every-feature)
2. [Project Layout](#2-project-layout)
3. [Pros of a Monolith](#3-pros-of-a-monolith)
4. [Cons of a Monolith](#4-cons-of-a-monolith)
5. [Formal Definition](#5-formal-definition)
6. [Interview Q&A](#6-interview-qa)

---

## 1. The Hook: One Codebase, Every Feature

Imagine you're building the backend for an e-commerce site. You need login, product listings, a shopping cart, order management, and payments. The simplest possible way to build this — and the way almost every real product actually starts — is to put all of it inside **one project**, running as **one process**, backed by **one database**.

```
ecommerce-backend/                 ← ONE repo, ONE deployable app
├── routes/
│   ├── login.py
│   ├── orders.py
│   ├── payments.py
│   ├── cart.py
│   └── products.py
├── models/
│   ├── user.py
│   ├── order.py
│   ├── payment.py
│   ├── cart_item.py
│   └── product.py
├── services/
│   ├── auth_service.py
│   ├── order_service.py
│   └── payment_service.py
├── database/
│   └── db.py                     ← ONE connection, ONE database
└── main.py                        ← ONE process starts everything
```

Every feature — Login, Orders, Payments, Cart, Products — lives inside the same repository, gets deployed together, and talks to the same database. This is a **monolith**.

## 2. Project Layout

Here's what that layout looks like as an actual FastAPI project, following the `/routes`, `/models`, `/services`, `/database` split shown above:

```python
# main.py
from fastapi import FastAPI
from routes import login, orders, payments, cart, products

app = FastAPI()

app.include_router(login.router, prefix="/auth")
app.include_router(orders.router, prefix="/orders")
app.include_router(payments.router, prefix="/payments")
app.include_router(cart.router, prefix="/cart")
app.include_router(products.router, prefix="/products")
```

```python
# routes/orders.py
from fastapi import APIRouter, Depends
from services.order_service import OrderService
from database.db import get_db

router = APIRouter()

@router.post("/")
def create_order(user_id: int, db=Depends(get_db)):
    return OrderService(db).create_order(user_id)
```

```python
# services/order_service.py
from services.payment_service import PaymentService  # a plain in-process function call

class OrderService:
    def __init__(self, db):
        self.db = db

    def create_order(self, user_id: int):
        order = self.db.orders.create(user_id=user_id, status="PENDING")
        PaymentService(self.db).charge(order)  # no network hop — just a method call
        return order
```

Notice that `OrderService` calling `PaymentService` is a plain Python function call, not a network request. Every part of the app can reach every other part directly, because it's all one running process sharing one memory space and one database connection pool.

## 3. Pros of a Monolith

- **Simple to develop** — one repo to clone, one language/framework version, no need to reason about network calls between your own features.
- **Simple to deploy** — one build artifact, one deployment pipeline, one thing to roll back if something breaks.
- **Simple to debug** — a stack trace for a bug in checkout can show you the exact call path through cart → order → payment, all in one process, no need to correlate logs across services.
- **Easy transactions** — since Orders and Payments share one database, you can wrap "create the order" and "charge the payment" in a single ACID database transaction. If the charge fails, the order creation rolls back automatically. This is genuinely hard to get right across separate databases (see Phase 11's Payment Gateway case study for the distributed version of this problem).

## 4. Cons of a Monolith

- **One bug can take down everything.** A memory leak in the recommendation feature, or an infinite loop in report generation, can consume all the process's resources and take checkout and login down with it — even though those features are logically unrelated.
- **Hard to scale one part independently.** If Product Search suddenly needs 10x the compute (e.g., a big sale event) but Payments doesn't, you can't scale just Search — you have to scale the *entire* monolith, wasting resources on the parts that didn't need it.
- **Deploys couple all features together.** A one-line fix to the Cart feature requires redeploying Login, Orders, Payments, and Products too, because they're all part of the same artifact. As the codebase and the team grow, this means more people are waiting on the same deploy pipeline, and one team's bug can block every other team's release.

## 5. Formal Definition

A **monolithic architecture** is a software design where all of an application's features are built, packaged, and deployed as a single unit, typically sharing one codebase, one runtime process, and one database. It is not inherently "bad architecture" — it is the right default for most new products, until specific scaling or organizational pressures (covered in Lesson 03) justify splitting it apart.

## 6. Interview Q&A

**Q: What is a monolithic architecture?**
Answer: A monolith is an application where all features are part of one codebase and deployed as a single unit, usually sharing a single database. Every internal component talks to every other component through in-process function calls rather than network requests.

**Q: Why would a team deliberately choose a monolith for a new product instead of microservices?**
Answer: Monoliths are far simpler to develop, deploy, and debug in the early stages — one team, one repo, one deploy pipeline, no distributed-systems overhead. Early on, you also don't yet know where the real scaling and team boundaries will be, so splitting prematurely means guessing wrong and paying the cost of network calls and operational complexity for no real benefit.

**Q: What is the biggest operational risk of a monolith in production?**
Answer: A single point of failure — because every feature shares one process and often one database connection pool, a bug, resource leak, or crash in any one feature can degrade or take down the entire application, including unrelated features.

**Q: How do transactions work differently in a monolith versus a system with separate databases per feature?**
Answer: In a monolith, related operations (like creating an order and charging a payment) typically share one database, so they can be wrapped in a single ACID transaction — either everything commits or everything rolls back. Once features have separate databases (as in microservices), you lose that guarantee and need patterns like the saga pattern or the outbox pattern to approximate it.

**Q: If a monolith gets a sudden 10x traffic spike on just one feature, like product search, what are your options?**
Answer: With a true monolith, your main option is to scale the entire application horizontally (run more copies of the whole process behind a load balancer), because you can't scale one internal feature independently — every instance carries the full weight of every feature. This is one of the concrete pressures that eventually pushes teams toward extracting the hot feature into its own service, which Lesson 03 covers.
