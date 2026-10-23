# Phase 01 — Foundations and Request Lifecycle

High-Level Design (HLD) interviews rarely start with "design Instagram." They start smaller: *"Explain what happens when you type a URL into your browser,"* or *"Why would you put a load balancer in front of a single server?"* The interviewer is testing whether you understand what happens behind a single button click — and whether that understanding can be stretched, hop by hop, to explain a system serving a hundred million users. This phase builds that foundation: the client-server model, how a request actually travels across the internet, and the back-of-envelope math every design interview eventually demands.

Every lesson in this course (and every case study in Phases 10-11) is really just this phase's request lifecycle, redrawn with bigger boxes and more of them. Get this phase solid and the rest of the course is mostly vocabulary.

## What This Phase Covers

- The client-server model: what a "client" and a "server" actually are, and why almost nothing in modern software works any other way.
- The full path of a request: Browser → Internet → Load Balancer → Backend Server → Authentication → Database → Response — and why a load balancer belongs in that path even for a "one server" setup.
- DNS resolution: how a domain name like `www.instagram.com` becomes an IP address, step by step, before a single byte of your actual request is sent.
- Why "what happens when you type google.com into your browser" is one of the most common opening questions in system design interviews, and what a strong answer covers.
- Latency vs. throughput — two numbers that sound similar but answer completely different questions.
- Back-of-envelope capacity estimation: turning "10 million daily active users" into concrete numbers for requests/sec and storage/year, the way every interviewer expects before you touch a whiteboard.

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-Client-Server-Basics.md` | Client-server model, the request-response cycle, why a load balancer sits in front of even one server |
| 02 | `02-DNS-and-How-a-Request-Travels.md` | DNS resolution step by step, the "type a URL" interview question, HTTPS and CDNs at a glance |
| 03 | `03-Latency-Throughput-and-Estimation.md` | Latency vs. throughput, back-of-envelope estimation, memorizable latency numbers |

## Estimated Time

**2-3 days** (read each lesson, then explain the request lifecycle out loud from memory — that's the actual skill being tested).

## Prerequisites

None. This is the entry point of the HLD course — no prior distributed-systems or system-design knowledge is assumed, just comfort writing basic backend code.
