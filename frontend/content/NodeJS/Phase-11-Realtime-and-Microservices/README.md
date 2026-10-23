# Phase 11 — Realtime and Microservices

This phase moves beyond the classic request/response cycle. You'll learn how servers push data to clients in real time, and how independent Node.js services talk to each other reliably at scale.

## What You'll Learn

| File | Topic |
|------|-------|
| `01-WebSockets-and-Socketio.md` | WebSocket protocol, Socket.io server/client, rooms, namespaces, a chat app |
| `02-Server-Sent-Events.md` | SSE vs WebSockets, a live notifications feed |
| `03-Message-Queues-and-Pubsub.md` | Why microservices need async messaging, RabbitMQ concepts, Redis pub/sub example |
| `04-Microservices-Communication-Patterns.md` | Sync vs async communication, API gateway, service discovery, HTTP retry logic |

## Why This Matters

- **Realtime UX** (chat, notifications, live dashboards, collaborative apps) is a standard interview and job expectation for full-stack engineers.
- **Microservices communication** is where most production incidents happen — network calls fail, services go down, and messages get lost. Understanding queues, pub/sub, and resilient HTTP patterns is core backend engineering knowledge.
- Python/React engineers usually know REST well but haven't built persistent connections or asynchronous service-to-service messaging — this phase closes that gap.

## Prerequisites

- Phase 04 (Express Fundamentals) and Phase 05 (REST API Design)
- Comfort with the Node.js event loop (Phase 02)
- Basic familiarity with npm packages and running multiple local processes

## How to Use This Phase

Each lesson is self-contained and runnable — code samples use only `express`, `socket.io`, and `redis`/`ioredis`, all installable via npm. Work through the lessons in order, run every example locally, then complete the Hands-On Exercises before checking the Interview Q&A.
