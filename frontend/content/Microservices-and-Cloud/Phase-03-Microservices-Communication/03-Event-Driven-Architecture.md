# Event-Driven Architecture (EDA)

Building upon asynchronous communication, **Event-Driven Architecture (EDA)** is a paradigm where services do not command other services to do things. Instead, they simply announce that something happened (an Event), and any service that cares can listen and react.

## Commands vs. Events

To understand EDA, you must understand the difference between a Command and an Event.

- **Command**: Directed at a specific service. "Hey Shipping Service, ship this order." (Imperative, high coupling).
- **Event**: A statement of historical fact broadcast to the world. "An order was placed." (Declarative, zero coupling).

## How EDA Decouples Services

Imagine we add a new feature: When an order is placed, we want to send the user a promotional email.

**Without EDA (Command approach):**
The `Order` service must be updated. A developer has to modify the `Order` codebase to add a call to the new `Marketing` service. This couples the `Order` service to the `Marketing` service.

**With EDA (Event approach):**
The `Order` service already publishes an `OrderPlaced` event to a Message Broker (like Kafka) every time a user checks out. 
To add the new feature, the `Marketing` service simply subscribes to the `OrderPlaced` topic on the broker. 
**The `Order` service never needs to be touched.** It doesn't even know the `Marketing` service exists.

This is the ultimate form of decoupling. You can add infinite new features (analytics, marketing, auditing) simply by spinning up new microservices that listen to existing events, without touching core services.

## Event Notification vs. Event-Carried State Transfer

There are two primary ways to format an Event payload:

### 1. Event Notification
The event contains only the bare minimum information needed to announce the change (e.g., just an ID).
```json
{
  "eventId": "9b1deb4d-3b7d",
  "type": "CustomerAddressUpdated",
  "customerId": "CUST-123",
  "timestamp": "2023-10-27T10:00:00Z"
}
```
**Pros**: Very lightweight.
**Cons**: If a listening service needs the new address, it has to make a synchronous API call back to the `Customer` service to fetch it, causing a traffic spike.

### 2. Event-Carried State Transfer
The event contains the actual data that changed, so listeners do not need to call the source service.
```json
{
  "eventId": "9b1deb4d-3b7d",
  "type": "CustomerAddressUpdated",
  "customerId": "CUST-123",
  "newAddress": {
    "street": "123 Main St",
    "city": "Seattle"
  },
  "timestamp": "2023-10-27T10:00:00Z"
}
```
**Pros**: Listeners get all the data they need immediately. They can even cache this data in their own local databases (CQRS).
**Cons**: Payloads are larger, and ordering becomes extremely critical.

## The Challenge of EDA: Idempotency

Message brokers (like Kafka or RabbitMQ) cannot guarantee "exactly once" delivery over a distributed network. They guarantee **"at least once" delivery**. 

This means a network blip might cause the broker to send the *exact same* `OrderPlaced` event to the `Shipping` service twice.

If your code is not written defensively, you will ship the customer two products and charge them twice. 
To fix this, event consumers must be **Idempotent**. An idempotent operation means that executing it once has the exact same effect as executing it 100 times.

**Technical Deep Dive: Idempotent Consumer Code**
```javascript
async function handleOrderPlacedEvent(event) {
    // 1. Check if we've already processed this specific event ID
    const alreadyProcessed = await db.processed_events.findById(event.eventId);
    
    if (alreadyProcessed) {
        // Idempotency check failed: We already did this! 
        // Acknowledge the message to remove it from the queue, but do NO work.
        console.log("Duplicate event ignored");
        return;
    }

    // 2. Process the order (Charge card, ship item)
    await processOrder(event);

    // 3. Record that we finished processing this event ID
    await db.processed_events.insert(event.eventId);
}
```

## Summary
- EDA relies on broadcasting historical facts (Events) rather than direct Commands.
- It provides the highest level of decoupling, allowing new services to be added without touching existing ones.
- Because message brokers guarantee "at least once" delivery, all consumers must be coded to be **Idempotent** to handle duplicate events safely.
