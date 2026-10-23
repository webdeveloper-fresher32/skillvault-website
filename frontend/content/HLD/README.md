# HLD (High-Level Design) — Complete Interview Prep Course

A self-contained, Python-first High-Level Design course built for interview prep at the **~3 years experience** level (Full Stack — Python + React + Node roles). It is the natural companion to the [`LLD/`](../../../02-SOFTWARE-ENGINEERING/01-LLD/README.md) course in this repo: where LLD teaches OOP, SOLID, patterns, and whiteboard-coding a handful of classic systems, HLD teaches the distributed-systems building blocks — load balancers, caching, sharding, queues, CAP theorem — and how to combine them under interview time pressure to design real systems at scale (Instagram, WhatsApp, Uber, URL Shorteners, and more). Every lesson follows the same spoon-fed style as LLD: a plain-English "what happens when..." walkthrough with an ASCII diagram and a short Python snippet (FastAPI, SQLAlchemy, Redis, Celery, JWT) before the formal definition, followed by interview Q&A.

---

## The Roadmap

The course builds up, phase by phase, from "what happens when I click Login" to designing a famous system end-to-end live in an interview:

```
Phase 01: Foundations & Request Lifecycle
        │   Browser → DNS → LB → Backend → Auth → DB → Response
        ▼
Phase 02: Monolith vs Microservices
        │   one app vs many services, when to split
        ▼
Phase 03: Scalability Fundamentals
        │   vertical vs horizontal scaling, statelessness
        ▼
Phase 04: Load Balancers
        │   algorithms, health checks, Nginx/HAProxy/ALB
        ▼
Phase 05: Database Design & Scaling
        │   indexing, replication, sharding, SQL vs NoSQL
        ▼
Phase 06: Caching
        │   cache-aside, eviction/invalidation, Redis
        ▼
Phase 07: Message Queues & Async Processing
        │   background jobs, Celery, pub/sub, event-driven
        ▼
Phase 08: Storage, Gateway & Auth
        │   object storage, API gateway, JWT
        ▼
Phase 09: Observability & Distributed Systems
        │   monitoring, CAP theorem, consistency & consensus
        ▼
Phase 10: Case Studies — Social & Media
        │   WhatsApp, Instagram, Twitter/X, YouTube, Netflix, Notifications
        ▼
Phase 11: Case Studies — Marketplace & Utility
        │   Uber, Swiggy, Hotel/Flight Booking, URL Shortener, Drive, Docs, Payments
        ▼
Phase 12: Interview Process & Advanced
            the repeatable framework, a mock interview, staff-level extensions
```

Each hop down this roadmap is a phase; each phase is a folder with its own lessons.

---

## Course Structure

```
HLD/
├── Phase-01-Foundations-and-Request-Lifecycle/
├── Phase-02-Monolith-vs-Microservices/
├── Phase-03-Scalability-Fundamentals/
├── Phase-04-Load-Balancers/
├── Phase-05-Database-Design-and-Scaling/
├── Phase-06-Caching/
├── Phase-07-Message-Queues-and-Async/
├── Phase-08-Storage-Gateway-and-Auth/
├── Phase-09-Observability-and-Distributed-Systems/
├── Phase-10-Case-Studies-Social-and-Media/
├── Phase-11-Case-Studies-Marketplace-and-Utility/
├── Phase-12-Interview-Process-and-Advanced/
├── Projects/
├── Quick-Reference/
└── README.md
```

Phases 01-09 teach the building blocks — one distributed-systems concept per phase, always grounded in a Python snippet (FastAPI/SQLAlchemy/Redis/Celery/JWT) before the abstract definition. Phases 10-11 apply every building block to 14 "design X" case studies, each walked through with the same five-part structure: requirements → back-of-envelope estimation → high-level architecture → deep dive → trade-offs at 10x scale. Phase 12 turns all of it into a repeatable interview performance.

`Projects/` is one evolving FastAPI backend — a simplified Instagram clone (users, posts, likes) — built incrementally across 10 stages, each stage bolting on the concept from the matching phase (JWT auth, Postgres via SQLAlchemy, Redis caching, Celery jobs, object storage, a load balancer, a microservices split, Docker, and finally a scaling discussion). Read the phase, then build the matching stage — this is the one project you should actually run locally before an interview.

`Quick-Reference/` holds the condensed cheatsheet, a 50-question interview drilling set, and a day-by-day 30-day study plan.

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Foundations and Request Lifecycle | Beginner | 2-3 days |
| 02 | Monolith vs Microservices | Beginner | 2 days |
| 03 | Scalability Fundamentals | Beginner | 1-2 days |
| 04 | Load Balancers | Intermediate | 2 days |
| 05 | Database Design and Scaling | Intermediate | 4 days |
| 06 | Caching | Intermediate | 2 days |
| 07 | Message Queues and Async Processing | Intermediate | 2-3 days |
| 08 | Storage, Gateway and Auth | Intermediate | 2-3 days |
| 09 | Observability and Distributed Systems | Advanced | 3-4 days |
| 10 | Case Studies: Social and Media | Advanced | 5-6 days |
| 11 | Case Studies: Marketplace and Utility | Advanced | 9-10 days |
| 12 | Interview Process and Advanced | Advanced | 2 days |

**Total estimated time: ~5-6 weeks** at roughly 2 hours/day — see [Quick-Reference/30-Day-Study-Plan.md](Quick-Reference/30-Day-Study-Plan.md) for a day-by-day schedule.

---

## How to Use This Course

1. **Read the phase.** Work through Phases 01-09 in order — they're cumulative (load balancers assume statelessness from Phase 03, caching assumes the DB layer from Phase 05, and so on). Each lesson gives you the diagram and code snippet before the formal term, so you build intuition first.
2. **Build the matching `Projects/` stage.** After finishing a phase, go build the corresponding stage of the evolving Instagram-clone backend in `Projects/` — e.g. after Phase 06 (Caching), build `Projects/04-Redis-Caching.md`. Running the code yourself is what makes the concept stick; reading alone won't.
3. **Work through the case studies.** Phases 10-11 apply everything from 01-09 to 14 real "design X" interview questions. Read each one, then try to reconstruct the architecture diagram yourself before checking it against the lesson.
4. **Drill with `Quick-Reference/`.** Use `Cheatsheet.md` for last-minute review, `Interview-QA.md` for rapid-fire question drilling, and revisit Phase 12's mock interview transcript the night before a real one.

---

## Prerequisites

- Comfortable writing basic Python (functions, classes, imports) — you don't need to know FastAPI, SQLAlchemy, Redis, or Celery beforehand; each is introduced from scratch in the phase that first needs it.
- No prior distributed-systems, networking, or system-design knowledge assumed — Phase 01 starts from "what is a client and what is a server."
- Helpful but not required: having worked through [`LLD/`](../../../02-SOFTWARE-ENGINEERING/01-LLD/README.md) first, since HLD assumes you're comfortable reasoning about a backend's code structure (routes, services, models) when it gets to Phase 02's monolith/microservices split.
