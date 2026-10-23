# Phase 02 — Monolith vs Microservices

In Phase 01 you traced a single request from the browser all the way to a database and back. That request landed on "the backend" — but what does "the backend" actually look like on disk, in a repo, running as processes? This phase answers that question: how do real companies structure the code and services that sit behind the request you just traced? Every "design X" interview eventually asks (explicitly or implicitly) whether you'd build the system as one deployable unit or many, and whether you can defend that choice under follow-up pressure. This phase gives you both architectures in concrete, code-level terms, plus a decision framework you can recite live in an interview.

## What This Phase Covers

- What a monolith actually is: one codebase, one deployable artifact, one database, containing every feature (login, orders, payments, cart, products).
- The concrete pros and cons of a monolith — why it's the right default for small teams and early-stage products, and exactly where it starts to hurt.
- What microservices actually are: independently deployable services, each owning its own database, communicating over the network instead of in-process function calls.
- The concrete pros and cons of microservices — independent scaling and deploys, fault isolation, versus network overhead, distributed data consistency, and operational complexity.
- A practical decision framework (team size, deploy cadence, differing scaling needs, Conway's Law) for choosing between them in an interview or in real life.
- Why "start monolith, extract services later" is the pragmatic default answer most senior engineers give, and how to talk through a concrete extraction (pulling a Payment Service out of a monolith).

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-Monolith-Architecture.md` | Monolith structure, project layout, pros/cons |
| 02 | `02-Microservices-Architecture.md` | Service-per-domain structure, pros/cons |
| 03 | `03-Choosing-Between-Them.md` | Decision framework, monolith-first, service extraction |

## Estimated Time

**2 days** (read both architecture lessons back-to-back on day one, since they're best understood as a direct contrast; use day two for the decision framework and Q&A drilling).

## Prerequisites

- Phase 01 — Foundations and Request Lifecycle (you need the mental model of a single request hitting "a backend" before you can compare what that backend is built from).
