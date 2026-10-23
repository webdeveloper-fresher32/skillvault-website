# Phase 11: Microservices & Realtime

## What You'll Learn

NestJS is not just an HTTP framework — it ships a first-class abstraction for building microservices that talk to each other over TCP, Redis, NATS, RabbitMQ, or Kafka, without touching Express or Fastify at all. This phase covers that `@nestjs/microservices` transporter layer, the request-response (`@MessagePattern`) and fire-and-forget (`@EventPattern`) messaging styles, and `ClientProxy` for inter-service calls. It then moves into realtime communication with WebSocket gateways (`@WebSocketGateway`, `@SubscribeMessage`, lifecycle hooks, room-based broadcasting, and handshake-time authentication). Finally, it covers background job processing with BullMQ queues and gives a conversant-level overview of `@nestjs/graphql` so you can read and reason about a GraphQL-based Nest API even if REST is your primary interface.

By the end of this phase you should be able to design a system where an HTTP-facing gateway service delegates work to backend microservices, push realtime updates to connected clients over WebSockets with proper room isolation and auth, offload slow work (like sending email) to a background queue instead of blocking a request, and hold an intelligent conversation about when and why you'd reach for GraphQL instead of REST.

## Learning Objectives

- Understand the transporter abstraction in `@nestjs/microservices` and how it decouples business logic from the underlying transport (TCP, Redis, NATS, RabbitMQ, Kafka)
- Distinguish `@MessagePattern` (request-response) from `@EventPattern` (fire-and-forget) and choose the right one for a given use case
- Use `ClientProxy` to send messages and emit events from one Nest application to another
- Build a hybrid application that serves HTTP and microservice transports side by side
- Create a `@WebSocketGateway()` with connection lifecycle hooks and `@SubscribeMessage()` handlers
- Broadcast to socket.io rooms for scoped realtime updates (chat rooms, per-user notification channels)
- Authenticate WebSocket connections at the handshake, since HTTP guards do not run the same way on socket events
- Explain why background job queues (BullMQ) exist and implement a queue producer/processor pair
- Describe the code-first vs schema-first approaches in `@nestjs/graphql` and write a basic resolver

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Nest-Microservices-and-Transporters.md](01-Nest-Microservices-and-Transporters.md) | Nest Microservices & Transporters — TCP, Redis, NATS, RabbitMQ, Kafka, MessagePattern/EventPattern, ClientProxy | 1 day |
| [02-WebSockets-and-Gateways.md](02-WebSockets-and-Gateways.md) | WebSockets & Gateways — lifecycle hooks, SubscribeMessage, rooms, handshake auth | 1 day |
| [03-Message-Queues-and-GraphQL-Overview.md](03-Message-Queues-and-GraphQL-Overview.md) | Message Queues (BullMQ) & GraphQL Overview — background jobs, resolvers | 1 day |

## Estimated Time

3 days

## Previous Phase

→ [Phase 10: Testing](../Phase-10-Testing/README.md)

## Next Phase

→ [Phase 12: Production and Deployment](../Phase-12-Production-and-Deployment/README.md)
