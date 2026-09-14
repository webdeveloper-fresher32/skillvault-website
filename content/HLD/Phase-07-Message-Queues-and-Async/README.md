# Phase 07 — Message Queues and Async Processing

Phase 06 made *reads* fast with caching. This phase makes *writes* — or more precisely, slow work that happens as a side effect of a write — stop blocking the user. Every "upload a video," "place an order," or "sign up" flow in a real product triggers a chain of slow, non-essential work: compressing a file, generating a thumbnail, sending an email, updating a search index. If your API handler does all of that inline, the user stares at a spinner for two minutes waiting on things they don't actually need to wait for. This phase covers how production systems break that chain apart with message queues, background workers, and event-driven design — the pattern behind almost every "why is this instant" moment in a well-built app.

This is also one of the highest-leverage topics in system design interviews: almost every case study in Phases 10-11 (video upload pipelines, notification fan-out, order processing) leans on the queue-and-worker pattern taught here.

## What This Phase Covers

- Why synchronous request handling breaks down once a request triggers slow, non-critical work, and how moving that work off the request path changes the user-perceived latency.
- Task queues in practice: the broker/worker split, Celery as the concrete Python implementation, `.delay()` to enqueue work, and what happens when a task fails.
- Publish-subscribe messaging and event-driven architecture as a different shape of async problem — one event, many independent reactions — and how Kafka and RabbitMQ differ at a conceptual level.

## Lesson Files

| # | File | Topic |
|---|------|-------|
| 01 | `01-Why-Async-Processing.md` | Synchronous vs queued request handling, the video-upload example |
| 02 | `02-Celery-Task-Queues.md` | Brokers, workers, `.delay()`, retries and failure handling |
| 03 | `03-Pub-Sub-and-Event-Driven.md` | Pub-sub vs task queues, Kafka vs RabbitMQ, event-driven services |

## Estimated Time

**2-3 days** (a lesson a day, plus time to run the Celery example against a local Redis broker).

## Prerequisites

- Phase 06 — caching and Redis, since Redis reappears here as a message broker and the pub/sub mechanism used in Lesson 03 is the same Redis feature.
- Comfort with the request/response model from Phase 01 — this phase is entirely about what happens *after* the response would normally be sent.
