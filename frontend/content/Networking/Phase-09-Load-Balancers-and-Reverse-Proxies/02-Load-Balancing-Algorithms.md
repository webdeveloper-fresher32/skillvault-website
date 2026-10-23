# Load Balancing Algorithms — Complete Guide

## Table of Contents
1. [Round Robin (The Default)](#1-round-robin-the-default)
2. [Weighted Round Robin](#2-weighted-round-robin)
3. [Least Connections](#3-least-connections)
4. [IP Hash (Sticky Sessions)](#4-ip-hash-sticky-sessions)
5. [Consistent Hashing](#5-consistent-hashing)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

When a reverse proxy acting as a Load Balancer receives a request, it has a pool of backend servers (e.g., Server A, Server B, Server C) that can handle it.

How does it decide which server gets the next request? It uses a **Load Balancing Algorithm**.

Here are the most common algorithms you need to know for system design interviews.

---

## 1. Round Robin (The Default)

The load balancer maintains a list of backend servers and routes requests to them in order, sequentially.

```
Request 1 -> Server A
Request 2 -> Server B
Request 3 -> Server C
Request 4 -> Server A   (wraps back to the start)
```

**Pros:** Extremely simple to implement. No state needs to be tracked.

**Cons:** It assumes all requests take the same amount of time to process, and all servers have the same capacity. If Request 1 is a heavy video export and Request 2 is a simple ping, Server A gets bogged down while Server B sits idle.

---

## 2. Weighted Round Robin

A variation of Round Robin where you assign a "weight" to each server based on its hardware capacity.

If Server A has 64GB of RAM and Server B has 16GB, you assign A a weight of 4 and B a weight of 1.

```
Requests 1, 2, 3, 4 -> Server A   (weight 4)
Request 5           -> Server B   (weight 1)
```

**Pros:** Better utilization of uneven hardware pools — a beefier server gets proportionally more traffic than a smaller one.

**Cons:** The weight is usually a static, manually configured number. It doesn't automatically adapt if a server's real-time load changes (e.g., due to a slow background job), unlike Least Connections.

---

## 3. Least Connections

The load balancer keeps track of how many active TCP connections or active requests each backend server currently has. The next request goes to the server with the fewest active connections.

**Pros:** Solves the problem of Round Robin where heavy requests pile up on one server. If Server A is stuck processing a heavy video export (1 active connection), the load balancer will route the next 5 fast requests to Server B.

**Cons:** Requires the load balancer to compute and track the state of every server constantly, which adds a small amount of overhead compared to stateless algorithms like Round Robin.

---

## 4. IP Hash (Sticky Sessions)

The load balancer takes the client's IP address, runs it through a mathematical hash function, and uses the result to map the client to a specific server.

```
Alice (IP: 192.168.1.5) hashes to Server B.
Every request Alice ever makes will go to Server B.
```

**Pros:** Useful for legacy applications that store session data in local server RAM (instead of a shared Redis database). Since Alice always goes to Server B, Server B will always remember her session.

**Cons:** If Server B crashes, Alice loses her session and gets logged out. Also, it can lead to uneven load if many heavy users happen to hash to the same server. Generally discouraged in modern, stateless microservices architectures.

---

## 5. Consistent Hashing

Standard hashing (like `hash(IP) % num_servers`) has a massive flaw: if you add or remove a single server from the pool, the modulo changes (`% 3` becomes `% 4`), meaning almost *every single user* gets routed to a different server, breaking all caches instantly.

**Consistent Hashing** places both the servers and the requests onto a virtual "ring".

```
                 Server A
                    ●
          ┌──────────────────┐
          │                  │
   Server C●                 ●Server B
          │                  │
          └──────────────────┘
        Ring of hash values (0 → 2^32-1)

A request hashes to a point on the ring, then walks
clockwise to find the nearest server.
```

When a server is added or removed, only the requests immediately adjacent to it on the ring are re-routed. The vast majority of requests continue going to their original servers.

**Pros:** Essential for distributed caching systems (like Memcached or Redis clusters) where adding a node shouldn't destroy the entire cache.

**Cons:** More complex to implement, and requires "virtual nodes" (multiple ring positions per physical server) to keep the load evenly distributed.

---

## 6. Hands-On Exercises

**Exercise 1:** Write a small script (Node.js or Python) that simulates Round Robin across an array of 3 server names for 10 incoming requests. Print which server handles each request.

**Exercise 2:** Extend the Round Robin script to Weighted Round Robin. Give Server A a weight of 3 and Server B a weight of 1, and verify the output distributes requests 3:1.

**Exercise 3:** Simulate Least Connections: maintain a `connections` counter per server, randomly increment/decrement it to mimic requests finishing, and route each new request to whichever server currently has the lowest counter.

**Exercise 4:** Implement a basic consistent hashing ring in code (using a hash function like `md5` or `crc32`). Add a 4th server to a 3-server ring and measure what percentage of keys get remapped — compare that to what plain `hash(key) % n` would remap.

**Exercise 5:** If you have access to Nginx or HAProxy, configure `upstream` blocks using `round-robin` (default), `least_conn`, and `ip_hash` directives, and send repeated `curl` requests to observe which backend responds each time.

---

## 7. Interview Q&A

**Q: If you are building a fleet of stateless API servers, which load balancing algorithm would you choose?**
Answer: Least Connections (or Round Robin if the requests are very uniform). Because the servers are stateless, it doesn't matter which server a user hits. Least Connections ensures that if one server is temporarily bogged down by a heavy database query, it won't receive new requests until it recovers.

**Q: What is a "Sticky Session"? Why are they generally bad?**
Answer: Sticky sessions ensure a specific user is always routed to the same backend server (usually via IP Hashing or a special load-balancer cookie). They are bad because they tightly couple the user to a specific piece of hardware. If that hardware fails or needs to be restarted for an update, the user's state is lost. Modern applications should be stateless, storing session data in a highly available external store like Redis, allowing any server to handle any request.

**Q: How does Consistent Hashing minimize cache misses when scaling out?**
Answer: Unlike traditional modulo hashing which remaps almost all keys when the denominator (server count) changes, consistent hashing maps keys and servers onto a ring. When a new server is added, it takes over a small segment of the ring from its immediate neighbor. Only the keys in that small segment are remapped; the rest of the ring is completely undisturbed, preserving the cache hit rate for the majority of the data.

**Q: When would Weighted Round Robin be preferable to plain Round Robin?**
Answer: When your server pool is hardware-heterogeneous — for example, during a gradual migration where newer, more powerful instances sit alongside older ones. Weighted Round Robin lets you assign proportionally more traffic to the stronger machines without needing to track real-time connection counts, which keeps the algorithm simple while still respecting capacity differences.

**Q: What is a practical downside of Least Connections in a system with long-lived WebSocket connections?**
Answer: Least Connections assumes an active connection roughly correlates with server load, but a WebSocket connection can stay open for hours while being mostly idle. A server could show "many connections" yet have almost no CPU load, causing the load balancer to unfairly avoid it. In these cases, a resource-aware algorithm (tracking actual CPU/memory) or Round Robin may be more appropriate than raw connection counting.

**Q: How would you design a load balancer to handle a sudden 10x traffic spike without overwhelming any single backend?**
Answer: Combine Least Connections (or a resource-aware variant) with auto-scaling — the load balancer keeps routing to the least-loaded healthy servers while new instances spin up and register themselves into the pool. Health checks ensure only ready servers receive traffic, and rate limiting or a request queue at the load balancer layer protects the backend fleet from being overwhelmed during the scale-up window.
