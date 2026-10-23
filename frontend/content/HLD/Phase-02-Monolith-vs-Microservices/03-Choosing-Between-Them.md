# Choosing Between Monolith and Microservices

## Table of Contents
1. [The Hook: The Interviewer Asks You to Decide](#1-the-hook-the-interviewer-asks-you-to-decide)
2. [A Decision Framework](#2-a-decision-framework)
3. [The Pragmatic Default: Start Monolith, Extract Services Later](#3-the-pragmatic-default-start-monolith-extract-services-later)
4. [Worked Example: Extracting a Payment Service](#4-worked-example-extracting-a-payment-service)
5. [Interview Q&A](#5-interview-qa)

---

## 1. The Hook: The Interviewer Asks You to Decide

You've now seen both architectures in full detail (Lessons 01 and 02). The natural next interview question is: "So which one would *you* use, and why?" There's no single correct answer here — the correct answer is a **reasoned decision framework** applied to the specifics of the problem the interviewer just gave you, not a memorized preference for one architecture.

## 2. A Decision Framework

Walk through these four questions whenever you're deciding, in an interview or in real life:

1. **Team size.** A team of 3-5 engineers gains almost nothing from microservices — there's no coordination problem to solve yet, and the operational tax (deploy pipelines, service discovery, monitoring per service) outweighs the benefit. Microservices start paying off once you have multiple teams that need to move independently.

2. **Deployment frequency needs.** If different parts of the system need to ship on very different schedules — Payments changes rarely and needs heavy review, while the Product Catalog UI backend ships daily — coupling their deploys in one monolith becomes a real drag. Independent deploy cadence is one of the strongest signals for splitting.

3. **Differing scaling needs.** If every feature in your system scales roughly together, a monolith scales fine — just run more copies of the whole thing. If one feature (say, Inventory during a flash sale, or a Notification fan-out during a viral event) needs to scale 50x independently of everything else, that's a strong, concrete signal to extract it into its own service.

4. **Organizational boundaries (Conway's Law).** Conway's Law observes that a system's architecture tends to mirror the communication structure of the organization that builds it — so if you already have separate teams that own separate business domains (Payments team, Search team, Catalog team), your architecture will naturally want to split along those same lines, and fighting that with one shared codebase creates constant coordination overhead.

## 3. The Pragmatic Default: Start Monolith, Extract Services Later

Given that framework, the answer most experienced engineers give — and the answer that plays well in interviews — is: **start with a monolith, and extract services later, only when a specific pressure (from the framework above) justifies it.**

Why this is the pragmatic default:

- **You don't know your real boundaries on day one.** Early in a product's life, you're still discovering which features are actually related, which will need to scale differently, and which teams will actually form around which domains. Splitting into services based on a guess means re-drawing service boundaries later anyway — except now it requires a network-level migration instead of just moving some files.
- **A monolith is cheaper to build and change while requirements are unstable.** Refactoring a function call inside one codebase takes minutes. Refactoring a network contract between two independently-deployed services requires versioning, backward compatibility, and coordinating two deploys.
- **Extraction is a well-understood, incremental process.** You don't have to choose "monolith forever" vs. "microservices from day one" — you can start monolithic and peel off one service at a time, exactly when the pain of keeping it in the monolith exceeds the cost of extracting it.

## 4. Worked Example: Extracting a Payment Service

Suppose the e-commerce monolith from Lesson 01 is now successful. Payments has become the bottleneck: it needs PCI-compliance isolation, a different on-call team, and it needs to scale independently during big sales — while Login and Product Browsing don't have those pressures. Here's the extraction, step by step:

**Before — inside the monolith:**
```python
# services/order_service.py
from services.payment_service import PaymentService

class OrderService:
    def create_order(self, user_id, cart):
        order = self.db.orders.create(...)
        PaymentService(self.db).charge(order)   # in-process call, shared DB
        return order
```

**Step 1 — give Payments its own database and its own FastAPI app, but keep it running as a normal function internally for now**, migrating the payment-related tables out of the shared database into a dedicated `payments_db`.

**Step 2 — stand up the Payment Service as an independently deployable app**, exposing the same capability over HTTP:
```python
# payment-service/main.py
from fastapi import FastAPI

app = FastAPI(title="Payment Service")

@app.post("/charge")
def charge(order_id: int, amount: float, idempotency_key: str):
    # writes to payments_db only — fully independent of the monolith's DB
    ...
```

**Step 3 — change the call site in the monolith from a function call to an HTTP call**, and add resilience (timeout, retry with the idempotency key, handling a failure without double-charging):
```python
# order_service.py, now inside the (smaller) monolith
import httpx

class OrderService:
    def create_order(self, user_id, cart):
        order = self.db.orders.create(...)
        httpx.post(
            "http://payment-service/charge",
            json={"order_id": order.id, "amount": order.total, "idempotency_key": order.id},
            timeout=5,
        )
        return order
```

**Step 4 — deploy and scale Payment Service on its own schedule**, independently of the rest of the monolith, which is the whole point of the exercise.

Notice that nothing about the *business logic* changed — only the boundary. This is the essence of "extract, don't rewrite": you carve a service out along a seam you already understand, rather than trying to predict every future service boundary up front.

## 5. Interview Q&A

**Q: How would you decide whether to use a monolith or microservices for a new project?**
Answer: I'd start by asking about team size, expected deployment cadence differences across features, and whether any part of the system is expected to have very different scaling needs than the rest. For a new product with a small team and unclear boundaries, I'd default to a monolith — it's cheaper to build and change while requirements are still unstable. I'd only reach for microservices upfront if there were already multiple independent teams with clear domain ownership, or a known, extreme scaling requirement for one specific part of the system from day one.

**Q: Why is "start monolith, extract services later" considered the pragmatic default rather than just an excuse to avoid microservices?**
Answer: Because early in a product's life you don't yet know your real service boundaries — which features will need to scale differently, or which teams will form around which domains. Guessing wrong and building microservices too early means paying the network/consistency/operational tax without knowing if the split is even along the right lines. A monolith keeps changes cheap while those boundaries are still being discovered, and extraction later is a well-understood, incremental migration rather than a rewrite.

**Q: What is Conway's Law, and how does it relate to this decision?**
Answer: Conway's Law states that a system's architecture tends to mirror the communication structure of the organization that builds it. In practice, if your company already has separate, autonomous teams owning separate business domains, your system's architecture will naturally push toward matching those boundaries with separate services — fighting that by keeping everything in one shared codebase tends to create constant cross-team coordination friction.

**Q: What's a concrete signal, mid-project, that it's time to extract a service out of a monolith?**
Answer: A specific, measurable pressure that a monolith can't absorb cheaply anymore — for example, one feature needing to scale 10-50x independently of the rest (like Inventory during a flash sale), a compliance requirement that demands isolation (like PCI scope for Payments), or a deploy cadence mismatch where one team is blocked waiting on another team's unrelated release. The signal should be concrete and current, not speculative ("we might need to scale this someday").

**Q: Is it ever correct to build microservices from day one?**
Answer: Yes, in narrower cases — for example, if you already know, with certainty, that one component has an extreme and very different scaling or compliance profile from everything else, or if the organization already has multiple established teams that must ship independently from the start. But for most new products with small teams and unclear requirements, building microservices from day one adds cost (network calls, distributed consistency, operational overhead) before there's a real problem for it to solve.
