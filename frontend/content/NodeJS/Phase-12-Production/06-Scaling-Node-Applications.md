# Scaling Node Applications — Complete Guide

## Table of Contents
1. [Horizontal vs Vertical Scaling](#1-horizontal-vs-vertical-scaling)
2. [Load Balancing](#2-load-balancing)
3. [Stateless App Design](#3-stateless-app-design)
4. [Externalizing Sessions and Cache](#4-externalizing-sessions-and-cache)
5. [Kubernetes: the Natural Next Step](#5-kubernetes-the-natural-next-step)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Horizontal vs Vertical Scaling

```
Vertical scaling (scale UP):              Horizontal scaling (scale OUT):

  [ Bigger server ]                        [Server 1] [Server 2] [Server 3] [Server 4]
   2 → 4 → 8 → 16 CPU cores                 each a modest, identical instance
   8 → 16 → 32 → 64 GB RAM                  add more instances as load grows
```

| | Vertical scaling | Horizontal scaling |
|---|---|---|
| How | Bigger machine (more CPU/RAM) | More machines/instances |
| Node fit | Limited — Node is single-threaded per process; a bigger machine alone doesn't help unless you also run more processes (PM2 cluster mode) | Natural fit — stateless Node processes replicate easily |
| Ceiling | Hard ceiling (biggest instance type available) | Effectively unlimited (add more instances) |
| Downtime risk | Usually requires a restart/resize | Can add/remove instances with zero downtime |
| Cost curve | Non-linear — bigger machines cost disproportionately more | Roughly linear — N instances cost ~N × base cost |

Because Node is single-threaded per process, vertical scaling alone (a bigger single machine) has diminishing returns — a single Node process can't use extra cores without clustering. This makes **horizontal scaling** (running multiple identical instances) the dominant strategy for scaling Node apps, often combined with PM2 cluster mode (see `02-Process-Management-with-PM2.md`) to use every core on each instance too.

```
Full picture — scaling dimensions combined:

  Machine 1 (4 cores) → PM2 cluster mode → 4 Node processes
  Machine 2 (4 cores) → PM2 cluster mode → 4 Node processes
  Machine 3 (4 cores) → PM2 cluster mode → 4 Node processes
                                             = 12 Node processes total,
                                               load-balanced across 3 machines
```

---

## 2. Load Balancing

A load balancer sits in front of multiple app instances and distributes incoming requests across them.

```
                         ┌──────────────┐
   Client requests  ───▶ │ Load Balancer │
                         │  (nginx/ALB)  │
                         └───────┬───────┘
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              [Node app 1] [Node app 2] [Node app 3]
```

### nginx as a reverse proxy / load balancer (concept)

```nginx
# nginx.conf (conceptual)
upstream node_app {
    least_conn;                     # route to the instance with fewest active connections
    server app1.internal:3000;
    server app2.internal:3000;
    server app3.internal:3000;
}

server {
    listen 80;

    location / {
        proxy_pass http://node_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Common load-balancing algorithms:

| Algorithm | Behavior |
|-----------|----------|
| Round robin | Requests distributed sequentially across instances |
| Least connections | Routes to whichever instance has fewest active connections |
| IP hash | Same client IP always routed to the same instance (useful if you must have "sticky" sessions — though stateless design avoids needing this at all) |

A reverse proxy like nginx (or a cloud load balancer, e.g., AWS ALB) also commonly handles TLS termination, gzip compression, and static asset serving in front of the Node app, keeping Node focused on application logic.

---

## 3. Stateless App Design

For horizontal scaling and load balancing to work correctly, **any request must be servable by any instance** — no instance can hold state that only it knows about.

```javascript
// BAD — state lives only in this process's memory
const sessions = new Map();  // in-memory session store

app.post('/login', (req, res) => {
  const sessionId = generateId();
  sessions.set(sessionId, { userId: user.id });  // only THIS instance knows this
  res.cookie('sessionId', sessionId);
  res.send('Logged in');
});

app.get('/profile', (req, res) => {
  const session = sessions.get(req.cookies.sessionId);
  // If the load balancer routes this request to a DIFFERENT instance
  // than the one that handled /login, session is undefined → broken!
  if (!session) return res.status(401).send('Not logged in');
  res.json(session);
});
```

```
Without externalized state:               With externalized state (Redis):

Client → LB → Instance A (has session)    Client → LB → Instance A ─┐
Client → LB → Instance B (NO session!)     Client → LB → Instance B ─┼─▶ Redis (shared)
         ↑ broken if routed here           Client → LB → Instance C ─┘
                                            any instance can serve any request
```

**Stateless** means: any in-memory data the app needs to serve a request (sessions, cached computed values, rate-limit counters, WebSocket presence info) must instead live in a shared, external store that every instance can read/write — not in that one process's memory.

---

## 4. Externalizing Sessions and Cache

Redis (covered in `../Phase-10-Advanced-Node/` of this course) is the standard choice for both session storage and caching in scaled Node deployments, because it's fast, shared, and independent of any single app instance's lifecycle.

### Sessions in Redis

```javascript
// server.js
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 },
}));

app.post('/login', (req, res) => {
  req.session.userId = user.id;   // written to Redis, not process memory
  res.send('Logged in');
});

app.get('/profile', (req, res) => {
  // works no matter which instance handles this request —
  // every instance reads from the same Redis
  if (!req.session.userId) return res.status(401).send('Not logged in');
  res.json({ userId: req.session.userId });
});
```

### Caching in Redis

```javascript
// GOOD — shared cache, every instance sees the same cached value
async function getProduct(productId) {
  const cached = await redisClient.get(`product:${productId}`);
  if (cached) return JSON.parse(cached);

  const product = await db.products.findById(productId);
  await redisClient.setEx(`product:${productId}`, 300, JSON.stringify(product)); // 5 min TTL
  return product;
}
```

```javascript
// BAD — in-memory cache is per-instance, inconsistent across the fleet,
// and wastes memory duplicating the same data N times
const cache = new Map();
async function getProduct(productId) {
  if (cache.has(productId)) return cache.get(productId);
  const product = await db.products.findById(productId);
  cache.set(productId, product);
  return product;
}
```

The same principle applies to rate limiting, feature flags, and WebSocket pub/sub coordination across instances — all belong in Redis (or an equivalent shared store) rather than process memory once you're running more than one instance.

---

## 5. Kubernetes: the Natural Next Step

Manually managing "how many instances, on which machines, behind what load balancer, restart which one if it dies" becomes unwieldy by hand. **Kubernetes** automates exactly this for containerized apps: it schedules pods (containers) across a cluster of machines, load-balances traffic to them via Services, restarts failed pods automatically, and can autoscale the number of pod replicas based on CPU/memory/custom metrics.

```
Conceptual mapping — what you'd build by hand vs what Kubernetes gives you:

By hand:                                   Kubernetes:
- N servers running the app                - Deployment with replicas: N
- nginx config listing each server         - Service (auto load-balances to pods)
- Manual restart on crash                  - Automatic pod restarts (liveness probes)
- Manual scale up/down                     - Horizontal Pod Autoscaler
- Manual rolling deploys                   - Rolling updates built into Deployments
```

Because the Node app is already Dockerized (`03-Dockerizing-a-Node-App.md`) and already designed to be stateless with externalized sessions/cache (this file), it's already Kubernetes-ready — no architectural changes needed, just deploying the same image via Kubernetes objects instead of manually.

For the full depth of Kubernetes concepts — Pods, Deployments, Services, Ingress, Horizontal Pod Autoscaler, ConfigMaps/Secrets, and production best practices — see **`../../Kubernetes/`**, which is a complete standalone course in this repo (Phase 01–12).

---

## 6. Hands-On Exercises

**Exercise 1:** Start three instances of the same Express app on different ports locally (e.g., 3001, 3002, 3003). Write a minimal nginx config (or use a simple Node-based round-robin proxy) that load-balances across all three, and confirm requests are distributed by checking a `/whoami` route that returns `process.env.PORT`.

**Exercise 2:** Build an app with an in-memory session Map (like the "BAD" example above). Run two instances behind a load balancer with round-robin. Log in via instance A, then make a request that gets routed to instance B — observe the broken session.

**Exercise 3:** Fix Exercise 2 by moving sessions to Redis using `express-session` + `connect-redis`. Confirm the session now works correctly regardless of which instance handles the follow-up request.

**Exercise 4:** Implement a product-lookup endpoint with an in-memory `Map` cache, then refactor it to cache in Redis with a TTL instead. Verify that restarting one instance doesn't lose the cached value (since it now lives in Redis, not that instance's memory).

**Exercise 5:** Read the Kubernetes Deployment and Service concepts in `../../Kubernetes/` and sketch (in a text file, no need to actually deploy) what a Deployment spec for this Node app would look like — replica count, container image, and the readiness/liveness probe paths from `04-Logging-and-Monitoring.md`.

---

## 7. Interview Q&A

**Q: What's the difference between horizontal and vertical scaling, and why is horizontal scaling generally preferred for Node.js apps?**
Answer: Vertical scaling means making a single machine bigger (more CPU/RAM); horizontal scaling means running more instances of the app across multiple machines. Since Node is single-threaded per process, a single process can't use extra cores from a bigger machine without clustering, so vertical scaling alone has limited benefit. Horizontal scaling — often combined with PM2 cluster mode per instance — is the dominant strategy because it has a much higher ceiling and can be done with zero downtime by adding/removing instances.

**Q: What role does a load balancer play in a scaled Node.js deployment?**
Answer: A load balancer (e.g., nginx, or a cloud load balancer like AWS ALB) sits in front of multiple app instances and distributes incoming requests across them using an algorithm like round robin or least connections. It also commonly handles TLS termination and can serve static assets, letting the Node app instances focus purely on application logic. It's what makes horizontal scaling actually usable by clients hitting a single entry point.

**Q: What does "stateless" mean for a horizontally scaled app, and why does it matter?**
Answer: Stateless means no instance holds data in its own process memory that only it knows about — any instance should be able to correctly handle any incoming request. This matters because a load balancer can route a client's requests to different instances over time; if session data or cached state lived only in one instance's memory, requests routed to a different instance would fail to find that data, causing inconsistent or broken behavior.

**Q: Why use Redis for sessions and caching instead of in-memory storage in a scaled Node app?**
Answer: In-memory storage (e.g., a `Map`) is local to a single Node process — it isn't shared across horizontally scaled instances, so a session created on one instance is invisible to others, and cached values get duplicated and can go stale independently per instance. Redis is an external, shared store that every instance reads from and writes to, so sessions and cached data stay consistent no matter which instance handles a given request — a requirement for correct horizontal scaling.

**Q: How does PM2 cluster mode relate to horizontal scaling across multiple machines?**
Answer: PM2 cluster mode scales vertically-per-machine by running multiple Node processes to use all CPU cores on one box, while horizontal scaling adds more machines/instances entirely. The two combine: each machine in a horizontally scaled fleet can itself run PM2 in cluster mode to fully utilize its cores, maximizing total throughput per dollar of infrastructure.

**Q: Why is Kubernetes described as a natural next step after PM2/manual horizontal scaling for Node apps?**
Answer: Kubernetes automates what becomes unmanageable by hand at scale — scheduling containers across a cluster, load-balancing traffic to them via Services, automatically restarting failed pods via liveness probes, performing rolling updates, and autoscaling replica counts based on load. A Node app that's already Dockerized and designed to be stateless (sessions/cache externalized to Redis) requires no architectural changes to run on Kubernetes — it's simply deploying the same container image through Kubernetes objects instead of managing instances manually.
