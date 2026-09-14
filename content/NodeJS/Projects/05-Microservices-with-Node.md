# Project 5 — Microservices with Node.js

**Level:** Advanced
**Time estimate:** 90 – 120 minutes
**Phase prerequisite:** Phase 11 – Realtime and Microservices

---

## Requirements

Build two independent Node.js services that communicate asynchronously via Redis pub/sub instead of calling each other's HTTP APIs directly:

- **Orders Service** — exposes `POST /api/orders` to create an order, saves it in memory, and **publishes** an `order.created` event to Redis
- **Notifications Service** — has no knowledge of the Orders service's internals; it **subscribes** to the `order.created` channel and logs/"sends" a notification whenever an order event arrives, and exposes `GET /api/notifications` to list everything it has processed

This demonstrates the core microservices pattern: services stay decoupled — Orders doesn't know or care who (if anyone) is listening, and Notifications doesn't know or care who published the event. Either service can be deployed, scaled, or restarted independently.

---

## Project Structure

```
05-microservices-with-node/
├── orders-service/
│   ├── package.json
│   ├── .env
│   └── server.js
└── notifications-service/
    ├── package.json
    ├── .env
    └── server.js
```

Each service is a fully independent Node project with its own `package.json` — in a real deployment these would live in separate repositories or separate deployable directories.

---

## Code

### `orders-service/package.json`

```json
{
  "name": "orders-service",
  "version": "1.0.0",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "redis": "^4.6.14"
  }
}
```

### `orders-service/.env`

```bash
PORT=6001
REDIS_URL=redis://127.0.0.1:6379
ORDER_CREATED_CHANNEL=order.created
```

### `orders-service/server.js`

```javascript
// orders-service/server.js — publishes order.created events to Redis
require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');

const app = express();
app.use(express.json());

const CHANNEL = process.env.ORDER_CREATED_CHANNEL;

// In-memory "database" for this demo — a real service would use MongoDB/Postgres
const orders = [];
let nextOrderId = 1;

async function main() {
  // Redis pub/sub requires the publisher connection to be separate from any
  // connection used for subscribing — here we only ever publish, so one client.
  const publisher = createClient({ url: process.env.REDIS_URL });
  publisher.on('error', (err) => console.error('Redis publisher error:', err));
  await publisher.connect();
  console.log('Orders service connected to Redis');

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

  // GET /api/orders — list all orders (for debugging/inspection)
  app.get('/api/orders', (req, res) => {
    res.status(200).json({ count: orders.length, data: orders });
  });

  // POST /api/orders — create an order and publish an event about it
  app.post('/api/orders', async (req, res) => {
    const { customerName, item, quantity } = req.body;

    if (!customerName || !item || !quantity) {
      return res.status(400).json({ error: 'customerName, item, and quantity are required' });
    }

    const order = {
      id: nextOrderId++,
      customerName,
      item,
      quantity,
      createdAt: new Date().toISOString(),
    };
    orders.push(order);

    // Publish the event — fire-and-forget from Orders' perspective.
    // It does not know or care whether any subscriber is listening.
    const event = JSON.stringify({ type: 'order.created', order });
    await publisher.publish(CHANNEL, event);
    console.log(`Published order.created for order #${order.id}`);

    res.status(201).json({ data: order });
  });

  const PORT = process.env.PORT || 6001;
  app.listen(PORT, () => console.log(`Orders service listening on http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error('Failed to start Orders service:', err);
  process.exit(1);
});
```

### `notifications-service/package.json`

```json
{
  "name": "notifications-service",
  "version": "1.0.0",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "redis": "^4.6.14"
  }
}
```

### `notifications-service/.env`

```bash
PORT=6002
REDIS_URL=redis://127.0.0.1:6379
ORDER_CREATED_CHANNEL=order.created
```

### `notifications-service/server.js`

```javascript
// notifications-service/server.js — subscribes to order.created events from Redis
require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');

const app = express();
app.use(express.json());

const CHANNEL = process.env.ORDER_CREATED_CHANNEL;

// In-memory log of processed notifications, for inspection via GET /api/notifications
const notifications = [];

async function main() {
  // Redis requires a DEDICATED connection for subscribing — once a client calls
  // subscribe(), that connection can no longer issue normal commands.
  const subscriber = createClient({ url: process.env.REDIS_URL });
  subscriber.on('error', (err) => console.error('Redis subscriber error:', err));
  await subscriber.connect();
  console.log('Notifications service connected to Redis');

  await subscriber.subscribe(CHANNEL, (message) => {
    try {
      const event = JSON.parse(message);
      if (event.type === 'order.created') {
        const notification = {
          id: notifications.length + 1,
          message: `Notification: order #${event.order.id} for ${event.order.customerName} ` +
                   `(${event.order.quantity}x ${event.order.item}) has been received.`,
          receivedAt: new Date().toISOString(),
          order: event.order,
        };
        notifications.push(notification);
        console.log(notification.message);
      }
    } catch (err) {
      console.error('Failed to process message from Redis:', err);
    }
  });

  app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

  // GET /api/notifications — list everything this service has processed so far
  app.get('/api/notifications', (req, res) => {
    res.status(200).json({ count: notifications.length, data: notifications });
  });

  const PORT = process.env.PORT || 6002;
  app.listen(PORT, () =>
    console.log(`Notifications service listening on http://localhost:${PORT}`)
  );
}

main().catch((err) => {
  console.error('Failed to start Notifications service:', err);
  process.exit(1);
});
```

---

## How to Run

Start Redis first (required by both services):

```bash
docker run -d --name redis -p 6379:6379 redis:7
```

Set up and start each service in its **own terminal window** — they are independent processes:

```bash
# Terminal 1
mkdir -p 05-microservices-with-node/orders-service
cd 05-microservices-with-node/orders-service
# create package.json, .env, server.js as above
npm install
npm run dev
```

```bash
# Terminal 2
mkdir -p 05-microservices-with-node/notifications-service
cd 05-microservices-with-node/notifications-service
# create package.json, .env, server.js as above
npm install
npm run dev
```

With both running, create an order:

```bash
curl -X POST http://localhost:6001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Alice","item":"Wireless Mouse","quantity":2}'
```

Watch **Terminal 2** (Notifications service) — within milliseconds it logs the received event. Confirm via its API:

```bash
curl http://localhost:6002/api/notifications
```

You should see a notification entry referencing order #1, created without Orders ever calling Notifications' HTTP API directly.

---

## Design Notes

- **Pub/sub decouples producer from consumer.** Orders publishes to a named channel (`order.created`) and moves on — it has no reference to the Notifications service's URL, port, or even its existence. You could stop Notifications entirely and Orders would keep accepting requests without error; the event is simply not consumed while no subscriber is connected (basic Redis pub/sub does not queue messages for offline subscribers — see Extensions for a durable alternative).
- **Separate Redis client instances for pub vs. sub is not optional.** Once a `redis` client issues `SUBSCRIBE`, that connection is dedicated to receiving messages and can no longer run normal commands like `GET`/`SET`/`PUBLISH`. Each service here only needs one role, but a service that both publishes and subscribes needs two separate client connections.
- **Each service owns its own data and process.** Orders' in-memory `orders` array and Notifications' in-memory `notifications` array are never shared or directly accessed by the other service — the only contract between them is the shape of the JSON event on the `order.created` channel. This is the essence of a microservices boundary: independent deployability and independent data ownership.
- **This is "notification," not "confirmation."** Because basic pub/sub is fire-and-forget with no delivery guarantee or acknowledgment, this pattern suits use cases like logging, analytics, or best-effort notifications — not workflows where losing a message is unacceptable (e.g. payment processing), which need a durable queue instead.

---

## Possible Extensions

1. **Durable queue instead of pub/sub** — swap Redis pub/sub for Redis Streams (`XADD`/`XREADGROUP`) or a message broker like RabbitMQ so events persist and are redelivered if Notifications is offline when they're published.
2. **Add a third service** — an "Inventory" service that also subscribes to `order.created` and decrements stock, demonstrating fan-out to multiple independent consumers of the same event.
3. **API gateway** — put a lightweight Express reverse proxy in front of both services so clients hit one base URL (`/orders/*`, `/notifications/*`) instead of knowing two ports.
4. **Containerize both services** — write a `Dockerfile` for each and a `docker-compose.yml` that also runs Redis, tying this project back to the Docker course's microservices patterns.
5. **Correlation IDs** — attach a `correlationId` to each published event and propagate it through logs in both services, useful for tracing a single order's lifecycle across services.
