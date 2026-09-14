# Phase 05 — Deadlocks

## Overview

Deadlocks are one of the most reliably-asked topics in backend/systems interviews — and one of the most misunderstood in practice, because most engineers only meet them as a mysterious "hung request" in production. This phase builds the concept from first principles: the four necessary conditions that must *all* hold for a deadlock to occur, how to model a deadlock with a resource allocation graph, and a real Python program that deadlocks two threads on purpose. From there you'll learn the three classic strategies — prevention, avoidance (Banker's Algorithm), and detection/recovery — and finish with the practical rules working engineers actually use to avoid deadlocks in real code and in database transactions (MySQL/MongoDB).

## Lessons

| # | File | Topic |
|---|------|-------|
| 01 | [What is a Deadlock](./01-What-is-a-Deadlock.md) | The 4 necessary conditions, a real Python deadlock, resource allocation graphs |
| 02 | [Deadlock Prevention and Avoidance](./02-Deadlock-Prevention-and-Avoidance.md) | Breaking each of the 4 conditions, Banker's Algorithm with a worked example |
| 03 | [Deadlock Detection and Recovery](./03-Deadlock-Detection-and-Recovery.md) | Wait-for graphs, detection algorithms, termination and preemption recovery |
| 04 | [Avoiding Deadlocks in Practice](./04-Avoiding-Deadlocks-in-Practice.md) | Lock ordering, timeouts, avoiding nested locks, database deadlock detection |

## Time Estimate

| Activity | Time |
|----------|------|
| Reading all 4 lessons | 2.5 – 3 hours |
| Hands-on exercises (including running the Python examples) | 1.5 – 2 hours |
| Interview Q&A review | 30 – 45 minutes |
| **Total** | **~4.5 – 5.5 hours** |

## Prerequisites

Phase 04 — Process Synchronization (locks, mutexes, semaphores, critical sections). You should be comfortable with the idea of a thread blocking while holding a lock and waiting for another lock.

## What's Next

Phase 06 moves from "processes competing for locks" to "processes competing for memory" — how the OS manages RAM allocation, paging, and segmentation.
