# Microservices Communication Patterns — Complete Guide

## Table of Contents
1. [Synchronous vs Asynchronous Communication](#1-synchronous-vs-asynchronous-communication)
2. [REST vs gRPC](#2-rest-vs-grpc)
3. [The API Gateway Pattern](#3-the-api-gateway-pattern)
4. [Service Discovery](#4-service-discovery)
5. [Complete Example: Two Services with Retry Logic](#5-complete-example-two-services-with-retry-logic)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Synchronous vs Asynchronous Communication

Microservices need to talk to each other. There are two fundamentally different ways to do it.

### Synchronous — caller waits for a response

```
Order Service ──── HTTP/gRPC request ────▶ Inventory Service
     │                                            │
     │  (blocked, waiting)                        │ checks stock
     │                                            │
     │◀─────────── response: "in stock" ─────────│
     ▼
Continues processing
```

Used when the caller genuinely **needs the answer right now** to proceed (e.g., "is this item in stock?" must be answered before confirming an order).

### Asynchronous — caller doesn't wait

```
Order Service ── publish "order.created" ──▶ [ Message Broker ]
     │ (returns immediately)                        │
     ▼                                    ┌──────────┴──────────┐
Order saved,                              ▼                     ▼
response sent                     Email Service          Analytics Service
                                   (processes later)      (processes later)
```

Used when the caller doesn't need an immediate answer — it just needs to guarantee the work eventually happens (see lesson 03 for full queue/pub-sub details).

### Trade-offs

| Aspect | Synchronous | Asynchronous |
|--------|-------------|---------------|
| Coupling | Tight (caller depends on callee's uptime) | Loose (broker absorbs downtime) |
| Latency perceived by caller | Sum of all downstream call latencies | Immediate (caller doesn't wait) |
| Failure handling | Caller must handle timeouts/retries directly | Broker/queue handles retry and redelivery |
| Consistency | Easier to reason about (request/response is immediate) | Eventual consistency — data settles over time |
| Best for | Queries needing an immediate answer | Side effects, notifications, cross-service workflows |

Most real systems use **both**: synchronous calls for read-heavy, answer-needed-now queries, and asynchronous messaging for side effects and cross-service workflows.

---

## 2. REST vs gRPC

Both are synchronous communication styles — the difference is in protocol and serialization.

| Aspect | REST (over HTTP/JSON) | gRPC (over HTTP/2 + Protocol Buffers) |
|--------|------------------------|----------------------------------------|
| Payload format | JSON (text, human-readable) | Protobuf (binary, compact) |
| Contract | Informal (OpenAPI/Swagger docs, not enforced) | Strict `.proto` schema, code-generated clients/servers |
| Performance | Slower — text parsing, larger payloads | Faster — binary, smaller payloads, HTTP/2 multiplexing |
| Streaming | Not native (polling or SSE/WebSockets needed) | Native bidirectional streaming built into the protocol |
| Browser support | Universal (any HTTP client) | Requires grpc-web proxy for direct browser use |
| Tooling maturity | Extremely mature, easy to debug with curl/Postman | Requires protobuf compiler, less human-debuggable |
| Best for | Public APIs, browser-facing APIs, simplicity | Internal service-to-service calls at scale, low-latency needs |

```
REST call:
  POST /api/inventory/check   Content-Type: application/json
  { "sku": "WIDGET-1" }
  ──▶ { "inStock": true, "quantity": 42 }

gRPC call (conceptually — defined in a .proto file):
  service Inventory {
    rpc CheckStock (StockRequest) returns (StockResponse);
  }
  Client calls inventoryClient.checkStock({sku: "WIDGET-1"}) like a local function —
  the binary protobuf serialization and HTTP/2 transport are hidden by generated code.
```

Rule of thumb: **REST for anything a browser or external partner touches; gRPC for internal, high-throughput service-to-service calls** where the performance and strict contract benefits outweigh the reduced debuggability.

---

## 3. The API Gateway Pattern

Without a gateway, clients must know about every microservice individually:

```
Mobile App ──┬──▶ Order Service       (order.internal:3001)
             ├──▶ Inventory Service   (inventory.internal:3002)
             ├──▶ User Service        (user.internal:3003)
             └──▶ Payment Service     (payment.internal:3004)

Problems: client needs 4 different URLs, 4 auth checks, no unified rate limiting,
          any service's internal address change breaks the client.
```

An API Gateway sits in front of all services as a single entry point:

```
                          ┌─────────────────────┐
Mobile App ──────────────▶│    API Gateway       │
                          │  - auth/JWT check     │
                          │  - rate limiting       │
                          │  - request routing     │
                          │  - response aggregation│
                          └──────────┬────────────┘
                    ┌─────────────────┼─────────────────┬─────────────────┐
                    ▼                 ▼                 ▼                 ▼
             Order Service    Inventory Service   User Service     Payment Service
```

### What an API Gateway typically handles

| Responsibility | Why it belongs at the gateway, not each service |
|-----------------|--------------------------------------------------|
| Authentication/authorization | Enforce once, consistently, instead of duplicating in every service |
| Rate limiting | Protect the whole system from a single client, in one place |
| Request routing | Client only needs to know one hostname; gateway maps paths to services |
| Response aggregation | Combine data from multiple services into one response for the client (avoids "chatty" clients making 4 round trips) |
| Protocol translation | e.g., expose REST externally while internal services use gRPC |
| Logging/observability | Single place to capture metrics for every request entering the system |

### Minimal Express API Gateway (conceptual)

```javascript
// gateway.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/api/orders', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
}));

app.use('/api/inventory', createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
}));

app.listen(8080, () => console.log('API Gateway on :8080'));
```

The client only ever talks to `:8080` — the gateway forwards `/api/orders/*` to the Order Service and `/api/inventory/*` to the Inventory Service, transparently.

---

## 4. Service Discovery

Hardcoding service addresses breaks down as soon as services scale, restart, or move (e.g., in Kubernetes, container IPs change on every deploy).

```
Hardcoded (fragile):
  Order Service config: INVENTORY_URL=http://10.0.1.15:3002
  → breaks the moment the Inventory Service pod restarts with a new IP
```

### Service discovery solves this by maintaining a live registry

```
                    ┌─────────────────────┐
Inventory Service ──▶│  Service Registry    │◀── Order Service
  (registers itself   │  (e.g., Consul,       │    (looks up "inventory-service"
   on startup:         │   etcd, or built into  │     to get a current address)
   "I'm at 10.0.2.8")  │   Kubernetes DNS)      │
                       └─────────────────────┘

Order Service asks: "where is inventory-service right now?"
Registry answers: "10.0.2.8:3002" (always current, updates as instances come/go)
```

Two common approaches:

| Approach | How it works |
|----------|--------------|
| **Client-side discovery** | The calling service queries a registry (e.g., Consul, etcd, Eureka) directly, then makes the request itself. More logic in each client. |
| **Server-side discovery / DNS-based** | The calling service just makes a request to a stable logical name (e.g., `http://inventory-service`), and infrastructure (a load balancer, Kubernetes' internal DNS) resolves it to a live instance. This is what Kubernetes Services provide out of the box — you never hardcode pod IPs. |

In practice, most teams running Kubernetes get service discovery for free: a Kubernetes `Service` object gives every deployment a stable DNS name (`inventory-service.default.svc.cluster.local`) that always routes to healthy pods, regardless of how many times they restart or reschedule.

---

## 5. Complete Example: Two Services with Retry Logic

Two Node/Express services: an **Order Service** that needs to check stock via the **Inventory Service** over HTTP, with retry logic (exponential backoff) to tolerate transient failures — a core resilience pattern for synchronous service-to-service calls.

### Inventory Service (deliberately flaky, to demonstrate retries)

```javascript
// inventory-service.js
const express = require('express');
const app = express();
app.use(express.json());

const stock = { 'WIDGET-1': 42, 'GADGET-2': 0 };

let requestCount = 0;

app.get('/stock/:sku', (req, res) => {
  requestCount++;

  // Simulate transient failures: fail ~40% of the time to exercise retry logic
  if (Math.random() < 0.4) {
    console.log(`[Inventory] Simulated failure for request #${requestCount}`);
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  const sku = req.params.sku;
  const quantity = stock[sku] ?? null;

  if (quantity === null) {
    return res.status(404).json({ error: 'SKU not found' });
  }

  console.log(`[Inventory] Request #${requestCount} succeeded: ${sku} -> ${quantity}`);
  res.json({ sku, quantity, inStock: quantity > 0 });
});

app.listen(3002, () => console.log('Inventory Service on :3002'));
```

### Order Service (calls Inventory Service with retry + exponential backoff)

```javascript
// order-service.js
const express = require('express');
const app = express();
app.use(express.json());

const INVENTORY_URL = 'http://localhost:3002';

/**
 * Calls a URL with retry logic using exponential backoff.
 * Retries on network errors and 5xx responses; does NOT retry on 4xx
 * (a 404 or 400 won't fix itself by retrying).
 */
async function fetchWithRetry(url, { maxRetries = 3, baseDelayMs = 200 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return await response.json();
      }

      // Don't retry client errors — retrying a 404 will never succeed
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error ${response.status}, not retrying`);
      }

      lastError = new Error(`Server error ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < maxRetries) {
      const delay = baseDelayMs * 2 ** attempt; // 200ms, 400ms, 800ms...
      console.log(`[Order] Attempt ${attempt + 1} failed (${lastError.message}), retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`All ${maxRetries + 1} attempts failed. Last error: ${lastError.message}`);
}

app.post('/orders', async (req, res) => {
  const { sku } = req.body;

  try {
    const stockInfo = await fetchWithRetry(`${INVENTORY_URL}/stock/${sku}`);

    if (!stockInfo.inStock) {
      return res.status(409).json({ error: 'Item out of stock', sku });
    }

    // In a real system: save order to DB, publish "order.created" event, etc.
    res.status(201).json({
      message: 'Order created',
      sku,
      quantityAvailable: stockInfo.quantity,
    });
  } catch (err) {
    // All retries exhausted — fail gracefully instead of hanging
    console.error(`[Order] Failed to check inventory: ${err.message}`);
    res.status(503).json({ error: 'Inventory service unavailable, please try again later' });
  }
});

app.listen(3001, () => console.log('Order Service on :3001'));
```

### Run It

```bash
# Terminal 1
node inventory-service.js

# Terminal 2
node order-service.js

# Terminal 3
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{"sku": "WIDGET-1"}'
```

Because the Inventory Service fails ~40% of the time, you'll see the Order Service log retries in the console before eventually succeeding (or exhausting retries and returning a 503) — this simulates real-world transient network blips without needing to physically kill a process.

### Request Flow with Retries

```
Order Service                              Inventory Service
     │── GET /stock/WIDGET-1 ─────────────▶│
     │◀──────────── 503 (simulated) ───────│
     │  wait 200ms
     │── GET /stock/WIDGET-1 (retry 1) ────▶│
     │◀──────────── 503 (simulated) ───────│
     │  wait 400ms
     │── GET /stock/WIDGET-1 (retry 2) ────▶│
     │◀──────────── 200 { quantity: 42 } ──│
     ▼
  Order created successfully
```

### Additional Resilience Patterns Worth Knowing

| Pattern | Purpose |
|---------|---------|
| **Timeout** | Never wait forever — abort a call after N seconds so one slow service can't stall the whole request chain. |
| **Retry with backoff** | Shown above — tolerate transient failures without hammering a struggling service. |
| **Circuit breaker** | After repeated failures, stop calling a service entirely for a cooldown period, failing fast instead of piling up more failing requests (e.g., via the `opossum` npm package). |
| **Bulkhead** | Isolate resources (e.g., separate connection pools) per downstream dependency, so one failing dependency can't exhaust resources needed by others. |

---

## 6. Hands-On Exercises

**Exercise 1:** Run both services and hit `/orders` several times via curl. Observe the retry logs in the Order Service terminal when the Inventory Service simulates a failure.

**Exercise 2:** Change `maxRetries` to 0 and re-run. Confirm the Order Service now fails immediately on the first simulated 503, with no retry attempts logged.

**Exercise 3:** Add a request timeout to `fetchWithRetry` using `AbortController` (5 second timeout per attempt) so a hung Inventory Service can't stall the Order Service indefinitely.

**Exercise 4:** Build a minimal API Gateway (using the `http-proxy-middleware` snippet in section 3) that proxies `/api/orders` to port 3001 and `/api/inventory` to port 3002. Confirm you can hit both services through a single gateway port.

**Exercise 5:** Implement a basic circuit breaker by hand: track consecutive failures in a module-level counter in `order-service.js`; if failures exceed 5 in a row, short-circuit and immediately return a 503 without calling Inventory Service for the next 10 seconds. Reset the counter on the next success.

---

## 7. Interview Q&A

**Q: When should two microservices communicate synchronously versus asynchronously?**
Answer: Use synchronous calls (REST or gRPC) when the caller needs an immediate answer to proceed — e.g., "is this item in stock?" must be known before confirming an order. Use asynchronous messaging (queues or pub/sub) when the caller just needs to guarantee a side effect eventually happens and doesn't need to block on the result — e.g., sending a confirmation email or updating analytics after an order is placed. Most real systems mix both: synchronous for read-heavy queries needing an answer now, asynchronous for side effects and cross-service workflows.

**Q: What are the main trade-offs between REST and gRPC for service-to-service communication?**
Answer: REST uses JSON over HTTP/1.1, which is human-readable, universally supported, and easy to debug with tools like curl, but is slower due to text parsing and larger payloads, and has no enforced contract beyond documentation. gRPC uses Protocol Buffers over HTTP/2, giving compact binary payloads, a strictly enforced schema with generated client/server code, and native bidirectional streaming — at the cost of harder debuggability and needing a proxy for direct browser use. REST typically fits public/browser-facing APIs; gRPC fits high-throughput internal service-to-service calls.

**Q: What problems does an API Gateway solve, and what would break without one?**
Answer: Without a gateway, every client must know the address of every individual microservice, duplicate authentication/authorization logic across services, and make multiple round trips to assemble data that spans several services. An API Gateway centralizes cross-cutting concerns — authentication, rate limiting, routing, response aggregation, and observability — behind a single entry point, so clients only need one hostname and services don't each need to reimplement the same infrastructure logic.

**Q: What is service discovery and why is it necessary in a microservices architecture?**
Answer: Service discovery is the mechanism by which a service finds the current network address of another service at runtime, instead of relying on a hardcoded IP or hostname. It's necessary because service instances in modern deployments (containers, Kubernetes pods, auto-scaled instances) are ephemeral — their IPs change on every restart or rescale. A service registry (Consul, etcd) or DNS-based discovery (Kubernetes Services) keeps track of healthy instances so callers always resolve to a currently-live address rather than a stale one.

**Q: In the retry example, why does the code avoid retrying on 4xx errors but retry on 5xx errors and network failures?**
Answer: A 4xx error (like 404 Not Found or 400 Bad Request) indicates the request itself is invalid or the resource doesn't exist — retrying the identical request will produce the identical error every time, wasting time and resources. A 5xx error or network failure typically indicates a transient condition (server overloaded, briefly down, network blip) that has a reasonable chance of resolving on its own within a short window, so retrying with backoff can succeed where an immediate retry or giving up would not.

**Q: Why use exponential backoff instead of retrying immediately or at a fixed interval?**
Answer: Immediate or fixed-interval retries from many clients simultaneously can create a "thundering herd" that overwhelms an already-struggling service right as it's trying to recover, making the outage worse. Exponential backoff increases the delay between attempts (e.g., 200ms, 400ms, 800ms), spreading out retry traffic over time and giving the downstream service room to recover, while still resolving transient issues faster than a single long fixed wait would.
