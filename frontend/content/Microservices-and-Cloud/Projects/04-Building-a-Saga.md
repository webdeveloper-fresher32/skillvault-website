# Project 4: Building a Saga

This is an advanced project that demonstrates how microservices communicate asynchronously without creating temporal coupling, the foundation of Event-Driven Architecture.

## The Goal
Build an `Order` service and an `Inventory` service that communicate entirely via a Message Broker (RabbitMQ), simulating the Saga pattern.

## Requirements

1. **The Message Broker**: 
   - Run a RabbitMQ instance locally using Docker (`docker run -p 5672:5672 -p 15672:15672 rabbitmq:3-management`).
2. **The Order Service**:
   - Creates an HTTP endpoint `/checkout`.
   - When called, it does NOT call the Inventory service via HTTP.
   - Instead, it connects to RabbitMQ and publishes a JSON message to a queue named `order_events`: `{"event": "OrderPlaced", "item_id": 123}`.
   - It immediately returns `HTTP 202 Accepted` to the user.
3. **The Inventory Service**:
   - Has no HTTP endpoints.
   - When it boots up, it connects to RabbitMQ and continuously listens to the `order_events` queue.
   - When it receives the `OrderPlaced` message, it logs to the console: `"Reserving item 123 in the database..."`.

## The Resiliency Test (Temporal Decoupling)

To prove this architecture is resilient:
1. Turn **OFF** the Inventory service.
2. Hit the `/checkout` endpoint on the Order service 5 times. Notice that it succeeds instantly every time. The Order service is completely unaffected by the Inventory service being down.
3. Check the RabbitMQ management UI (localhost:15672). You will see 5 messages sitting safely in the queue.
4. Turn the Inventory service back **ON**. 
5. Watch the console. It will instantly pull all 5 messages from the queue and process them. Zero data was lost.

## Why this matters
You have implemented asynchronous communication, solved temporal coupling, and demonstrated load-leveling buffering—the three core benefits of Event-Driven microservices.
