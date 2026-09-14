# Phase 04 — Load Balancers

Phase 03 established the fix for "one server falls over" — add more servers (horizontal scaling) and keep them stateless. But horizontal scaling only works if something is actually deciding *which* of those servers handles each incoming request. That "something" is a load balancer, and it is one of the first components an interviewer expects to see appear in almost any "design X at scale" answer, right after you've drawn the client and before you've drawn a single backend box. This phase covers why load balancers exist, how they decide where to send traffic, and what actually runs in production (you are not writing a load balancer in Python — Nginx, HAProxy, and AWS's ALB do this job).

## What This Phase Covers

- Why a single server — even a beefy one — cannot survive real production traffic, and why a load balancer sits in front of the backend fleet to fix that.
- Health checks: how a load balancer knows a server is dead, and what happens (badly) if it doesn't check.
- The main load-balancing algorithms — round robin, weighted round robin, least connections, and consistent hashing — and when to reach for each.
- Why "the same user always hits the same server" (sticky sessions / consistent hashing) matters once a server holds anything cache-like locally.
- What actually runs this in production: Nginx and HAProxy as software load balancers, AWS ALB as a managed one, and the L4 vs L7 distinction between them.

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-Why-Load-Balancing.md` | Why one server can't handle real traffic, health checks |
| 02 | `02-LB-Algorithms.md` | Round robin, weighted round robin, least connections, consistent hashing |
| 03 | `03-Nginx-HAProxy-ALB-in-Practice.md` | Real-world load balancers, `nginx.conf`, L4 vs L7 |

## Estimated Time

**2 days** (a day for the concepts in Lessons 01-02, a day to actually run the Nginx config from Lesson 03 against a couple of local FastAPI instances).

## Prerequisites

- Phase 03 — Scalability Fundamentals (horizontal scaling and statelessness are the reasons a load balancer is needed at all).
