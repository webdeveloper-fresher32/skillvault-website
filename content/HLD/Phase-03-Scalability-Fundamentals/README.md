# Phase 03 — Scalability Fundamentals

Every phase after this one is, in some sense, a variation on the same question: **what do you do when one machine isn't enough?** Load balancers, database replication, sharding, caching, message queues — they're all specific answers to the general problem this phase introduces. If you understand vertical vs. horizontal scaling and why statelessness is the precondition for horizontal scaling, the rest of this course is just "here's a concrete tool for that."

This is also one of the most commonly asked warm-up questions in system design interviews — interviewers use it to check that you're not going to reach for "just add more RAM" as your only scaling lever for the rest of the interview.

## What This Phase Covers

- The two fundamental ways to give a system more capacity: making one machine bigger (vertical scaling) vs. adding more machines (horizontal scaling).
- The trade-offs of each approach — where vertical scaling hits a hard ceiling, and what horizontal scaling costs you in complexity.
- Why horizontal scaling silently breaks the moment a server keeps any request-specific state in local memory.
- Statelessness as a design requirement, and the two standard fixes: JWTs and shared/external session stores.

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-Vertical-vs-Horizontal-Scaling.md` | Scaling up vs. scaling out, trade-offs, when each makes sense |
| 02 | `02-Stateless-Services.md` | Why local session state breaks horizontal scaling, and how to externalize it |

## Estimated Time

**1-2 days.**

## Prerequisites

- Phase 01 — Foundations and Request Lifecycle (you should already be comfortable tracing a request from browser to database).
- Phase 02 — Monolith vs. Microservices (helps to already know that "the backend" can mean one process or many).
