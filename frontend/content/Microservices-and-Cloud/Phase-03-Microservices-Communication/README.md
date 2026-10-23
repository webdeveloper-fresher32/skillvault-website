# Phase 03: Microservices Communication

In a monolith, components communicate via in-memory function calls. In a microservices architecture, services communicate over a network. This fundamental shift introduces latency, network failures, and complex dependency chains.

Choosing the right communication style between services is one of the most critical architectural decisions you will make.

## Learning Objectives

By the end of this phase, you will understand:
- The difference between Synchronous (blocking) and Asynchronous (non-blocking) communication.
- When to use REST and gRPC (Synchronous).
- When to use Message Queues and Event Brokers like RabbitMQ and Kafka (Asynchronous).
- The power and complexity of Event-Driven Architecture.

## Files in this Phase

1. `01-Synchronous-Communication.md`: REST, gRPC, and the dangers of temporal coupling.
2. `02-Asynchronous-Communication.md`: Message queues, Pub/Sub, and decoupling services in time.
3. `03-Event-Driven-Architecture.md`: Designing systems that react to state changes rather than direct commands.
