# Phase 09 — Load Balancers and Reverse Proxies

## Why This Phase Matters

Every production system you'll work on as a full-stack engineer sits behind some kind of traffic-directing layer — nginx, HAProxy, an AWS ALB, a Kubernetes Ingress. Interviewers use this topic to check whether you understand what happens to a request *before* it reaches your application code. This phase builds that mental model from first principles: what a proxy is, how load balancers pick a backend, and how the whole system stays available when servers fail.

## What You'll Learn

| # | Lesson | Core Question Answered |
|---|--------|------------------------|
| 01 | [Forward Proxy vs Reverse Proxy](./01-Forward-Proxy-vs-Reverse-Proxy.md) | Who is the proxy hiding — the client or the server? |
| 02 | [Load Balancing Algorithms](./02-Load-Balancing-Algorithms.md) | Given N backend servers, which one gets the next request? |
| 03 | [Layer 4 vs Layer 7 Load Balancing](./03-Layer-4-vs-Layer-7-Load-Balancing.md) | Does the load balancer look inside the HTTP request, or just route packets? |
| 04 | [Health Checks and High Availability](./04-Health-Checks-and-High-Availability.md) | How does the system know a server is dead, and what happens next? |

## Prerequisites

- Phase 02 (TCP vs UDP) — L4 load balancing builds directly on TCP concepts.
- Phase 05 (HTTP/HTTPS Fundamentals) — L7 load balancing routes on HTTP semantics (paths, headers, hosts).
- Phase 06 (TLS/SSL and Handshake) — needed to understand SSL/TLS termination at the load balancer.

## How This Connects to Other Courses

Kubernetes Services and Ingress controllers are real, running examples of the concepts in this phase — a `ClusterIP`/`NodePort` Service is essentially an L4 load balancer, and an Ingress controller is an L7 reverse proxy with routing rules. See the [Kubernetes course](../../../04-SYSTEMS-INFRASTRUCTURE/03-DevOps/Kubernetes) for the hands-on side of this, especially its networking phases.

## Time Estimate

3–4 hours (reading + exercises across all 4 lessons).

---

**Next:** Start with [01-Forward-Proxy-vs-Reverse-Proxy.md](./01-Forward-Proxy-vs-Reverse-Proxy.md)
