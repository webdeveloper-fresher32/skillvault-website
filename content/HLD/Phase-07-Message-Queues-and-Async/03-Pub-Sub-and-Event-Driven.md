# Pub-Sub and Event-Driven Architecture

The Celery example in the previous lesson has one producer (the API) and, effectively, one logical consumer for each job: `process_video` runs once, does its three steps, and is done. But imagine a different scenario: a user places an order, and *three completely unrelated services* each need to react — Inventory needs to decrement stock, Notifications needs to email a receipt, and Analytics needs to log the sale for a dashboard. None of these services should have to know about each other, and none of them should block the order-placement request. This is a different shape of async problem, and it calls for a different tool: **publish-subscribe**.

## Task Queue vs Pub-Sub: One Job, One Worker vs One Event, Many Reactions

```
Task Queue (Celery-style)                 Pub-Sub (event-driven)

  Producer                                  Publisher
     |                                          |
     v                                          v
  [ Queue ]                              [ Topic: "order.placed" ]
     |                                     /        |        \
     v                                    v         v          v
  ONE worker                        Inventory   Notification  Analytics
  takes the job                     Service     Service        Service
  (job removed                      (each gets its OWN copy of the event;
   once claimed)                    none of them "consume" it away from the others)
```

In a task queue, a job is claimed by exactly one worker and then it's gone — this is "do this piece of work once." In pub-sub, a publisher emits an event to a **topic** (a named channel), and every **subscriber** listening to that topic receives its own independent copy. Adding a fourth subscriber later (say, a Fraud-Detection service) requires zero changes to the publisher or the existing subscribers — it just starts listening too.

## The Event-Driven Example

```
   Client
     |
     v
  Order Service  ---publishes---> "order.placed" event {order_id, user_id, items}
     |                                   |         |          |
     | (returns 201 Created              v         v          v
     |  immediately, doesn't wait     Inventory  Notification Analytics
     |  for any subscriber)           Service    Service      Service
     v                                   |          |            |
  responds to client                decrement    send email   log sale
                                     stock          receipt      event
```

The Order Service's only responsibility is to save the order and publish one event describing what happened. It has no idea Inventory, Notifications, or Analytics even exist — that's the whole point. Each subscriber independently decides what "an order was placed" means for its own domain. This is **event-driven architecture**: services communicate by broadcasting facts about what happened, not by directly calling each other.

## Kafka vs RabbitMQ, Conceptually

Both show up constantly in system design interviews as "the pub-sub tool," but they solve slightly different problems:

| | RabbitMQ | Kafka |
|---|---|---|
| Model | Traditional message broker — messages are routed to queues/subscribers and typically removed once consumed | Distributed, append-only log — events are written to a durable log and *retained*, subscribers read from whatever offset they want |
| Best for | Task distribution, request/reply, complex routing rules | High-throughput event streaming, replaying history, multiple independent consumers reading at their own pace |
| Replay | Once a message is consumed and acked, it's typically gone | A new subscriber can read events from the beginning of the log, even ones published before it existed |

The practical distinction interviewers care about: RabbitMQ is optimized for "route this message to the right place and mark it done," while Kafka is optimized for "durably record a stream of events that many current and future consumers can read, at their own pace, possibly replaying old ones." A recommendation engine that wants to reprocess a week of "user clicked" events to retrain a model is a Kafka-shaped problem; a checkout flow that needs to reliably dispatch one email is closer to a RabbitMQ/task-queue-shaped problem.

## Redis Pub/Sub, Briefly

Phase 06 mentioned Redis's pub/sub feature as a preview of this lesson. Redis pub/sub is the simplest possible version of this pattern — a publisher does `PUBLISH channel message`, and any currently-connected subscriber doing `SUBSCRIBE channel` receives it in real time. It's useful for lightweight, ephemeral fan-out (e.g. pushing a "user is typing" event to open WebSocket connections), but unlike Kafka it has no durability — if no one is subscribed at the moment a message is published, that message is simply lost. For anything that needs to be reliably delivered even if a subscriber is temporarily down, Kafka or RabbitMQ is the right tool.

## Formal Definition

**Publish-subscribe (pub-sub)** is a messaging pattern where publishers emit messages to a named topic/channel without knowledge of who (if anyone) is listening, and any number of subscribers independently receive a copy of each message. **Event-driven architecture** applies this pattern at the service level: services communicate by publishing events describing state changes ("order placed," "user signed up") rather than by calling each other's APIs directly, allowing new consumers of an event to be added without modifying the publisher.

## Interview Q&A

**Q: How is pub-sub different from the Celery task queue from the previous lesson?**
A: A task queue delivers a job to exactly one worker, and the job disappears once claimed — it's "do this once." Pub-sub broadcasts an event to every current subscriber independently — it's "notify everyone who cares," and the number of interested parties can grow without the publisher changing at all.

**Q: In the order-placed example, what happens if the Notification service is down when the event is published?**
A: It depends on the broker. With Redis pub/sub, the event is lost — there's no durability once emitted. With Kafka, the event stays in the log; the Notification service can resume from where it left off once it's back up, since Kafka retains events rather than discarding them on delivery. This durability difference is exactly why Kafka is favored for event-driven systems where consumers can't be guaranteed to always be listening.

**Q: When would you reach for Kafka over RabbitMQ in an interview answer?**
A: When the scenario involves high-volume event streams that multiple, possibly-future consumers need to read (activity logs, clickstreams, metrics pipelines), or when you need to replay history. Reach for RabbitMQ (or a Celery+Redis task queue) when the scenario is really "reliably run this one job" rather than "broadcast this fact to whoever's listening."

**Q: How would you design the order-placed event so new services can be added later without touching the Order Service?**
A: Define a stable event schema (e.g. `{order_id, user_id, items, timestamp}`) published to a well-known topic name, and treat it as a contract — the Order Service publishes it and never needs to know who subscribes. Any new service (fraud detection, loyalty points) just subscribes to the existing topic; no code in the Order Service changes.

**Q: What's the risk of event-driven architecture that a task-queue-only design doesn't have?**
A: Debugging and consistency get harder — a single user action can trigger a cascade of independent reactions across services, and there's no single place to see "did everything that was supposed to happen, happen?" Tracing a bug often means correlating logs across every subscriber, which is why observability (Phase 09) matters even more in event-driven systems.
