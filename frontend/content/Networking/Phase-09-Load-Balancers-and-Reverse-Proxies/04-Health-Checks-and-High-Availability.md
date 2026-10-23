# Health Checks and High Availability — Complete Guide

## Table of Contents
1. [Active Health Checks](#1-active-health-checks)
2. [Passive Health Checks (Circuit Breaking)](#2-passive-health-checks-circuit-breaking)
3. [High Availability of the Load Balancer Itself](#3-high-availability-of-the-load-balancer-itself)
4. [Hands-On Exercises](#4-hands-on-exercises)
5. [Interview Q&A](#5-interview-qa)

---

A load balancer is only useful if the backend servers it routes traffic to are actually alive and functioning. If Server B crashes, the load balancer needs to know immediately so it can stop sending users to a dead server.

This is achieved through **Health Checks**.

---

## 1. Active Health Checks

An active health check means the load balancer actively pings the backend servers at a regular interval to see if they are alive.

**How it works (L7 - Application Level):**

```
Load Balancer ──GET /health (every 5s)──▶ Server A → 200 OK   (Healthy)
Load Balancer ──GET /health (every 5s)──▶ Server B → 500 / timeout   (Unhealthy)
```

1. The load balancer is configured to make a `GET /health` request to every backend server every 5 seconds.
2. The backend server's application code must explicitly implement this endpoint and return an `HTTP 200 OK`.
3. If Server B's hard drive fills up, its application might crash, or it might intentionally start returning an `HTTP 500 Internal Server Error` on the `/health` endpoint.
4. When the load balancer sees the `500` (or if the request times out completely), it marks Server B as **Unhealthy**.
5. It immediately stops routing any new user traffic to Server B. All traffic now flows to Server A and Server C.
6. The load balancer continues pinging Server B's `/health` endpoint in the background. Once it starts returning `200 OK` again, the load balancer marks it as **Healthy** and seamlessly reintroduces it to the pool.

**How it works (L4 - Transport Level):**

If you are doing L4 load balancing, the load balancer cannot parse HTTP. Instead, it simply tries to open a TCP connection to the backend port. If the TCP 3-way handshake succeeds, it assumes the server is healthy. (This is less reliable than L7 checks, because the TCP port might be open, but the application inside could be deadlocked).

---

## 2. Passive Health Checks (Circuit Breaking)

Instead of pinging the server in the background, a passive health check watches real user traffic.

If the load balancer sends a real user's request to Server C, and Server C returns a `502 Bad Gateway` or the connection times out, the load balancer takes note. If this happens 3 times in a row, the load balancer passively determines that Server C is dead and removes it from the pool.

```
Real user requests to Server C:
  Request 1 → 502 Bad Gateway   (strike 1)
  Request 2 → timeout            (strike 2)
  Request 3 → 502 Bad Gateway   (strike 3 — server ejected from pool)
```

This is often used in conjunction with active health checks to catch issues faster than the 5-second polling interval.

---

## 3. High Availability of the Load Balancer Itself

We've solved the problem of a backend server dying. But what happens if the **Load Balancer itself** dies? It is a single point of failure (SPOF) for your entire architecture.

To achieve True High Availability, you must have multiple load balancers.

### Active-Passive (Failover) Setup

You run two load balancers: a Primary and a Standby.

```
             Virtual IP (Floating IP)
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  Primary LB (active)      Standby LB (passive)
  owns the VIP              health-checks Primary
                             via VRRP/Keepalived
```

1. Both load balancers share a single virtual IP address (sometimes called a Floating IP).
2. Only the Primary load balancer actively receives traffic on this IP.
3. The Standby load balancer constantly runs a health check on the Primary load balancer (often using a protocol like VRRP or Keepalived).
4. If the Primary load balancer dies, it stops responding to the health check.
5. Within milliseconds, the Standby load balancer detects this, forcibly takes ownership of the Virtual IP address at the OS level, and instantly starts routing traffic.
6. From the outside user's perspective, there is no downtime. The IP address just instantly moved to a different physical machine.

### Active-Active Setup

In an Active-Active setup, both load balancers are actively serving traffic at the same time. You use DNS (see Phase 04) to hand out multiple IP addresses for your domain.

If one load balancer dies, DNS health checks will eventually stop handing out its IP address (though this is slower than VRRP due to DNS caching).

---

## 4. Hands-On Exercises

**Exercise 1:** Build a simple Express.js `/health` endpoint that returns `200 OK` normally, but returns `500` when a query parameter `?fail=true` is passed. Point an Nginx `upstream` health check at it and observe the backend get marked unhealthy.

**Exercise 2:** Configure Nginx (or HAProxy) active health checks with a custom interval and failure threshold, then kill the backend process and time how long it takes for the load balancer to stop routing to it.

**Exercise 3:** Simulate a passive health check / circuit breaker in code: track consecutive failures per backend in a simple in-memory counter, and "eject" a backend from the pool after 3 consecutive failed requests.

**Exercise 4:** Set up `keepalived` (or research its config format) to create a floating virtual IP shared between two mock load balancer VMs, and describe step by step what happens when the primary is powered off.

**Exercise 5:** Design (on paper or in a diagram tool) an Active-Active HA setup using DNS round robin across two regions, and list the tradeoffs versus an Active-Passive VRRP setup, especially around failover speed and DNS caching.

---

## 5. Interview Q&A

**Q: You have an Express.js app. How do you implement a proper `/health` endpoint?**
Answer: A naive health check just returns `res.status(200).send("OK")`. A *proper* health check actually verifies the application's dependencies. It should briefly ping the database (e.g., `SELECT 1`) and the Redis cache to ensure the application isn't just running, but is actually capable of serving useful requests. If the database connection is dead, the `/health` endpoint should return a `500` so the load balancer stops sending it traffic.

**Q: A backend server crashes mid-request. What does the user see?**
Answer: If the load balancer hasn't detected the failure yet, it sends the request. The TCP connection fails or times out. Most L7 load balancers will instantly detect this failure and transparently **retry** the request on a different, healthy backend server. The user will experience a slight delay, but the request will ultimately succeed. (This is why idempotency in APIs is critical!)

**Q: What is a Single Point of Failure (SPOF)?**
Answer: A component of a system that, if it fails, will stop the entire system from working. A single load balancer in front of 100 backend servers is a SPOF. To fix it, you must deploy a second standby load balancer and use a mechanism like VRRP/Keepalived to failover the IP address.

**Q: What's the difference between active and passive health checks, and why use both?**
Answer: Active health checks proactively poll a dedicated endpoint on a fixed interval (e.g., every 5 seconds), independent of real traffic — useful for catching failures even during quiet periods. Passive health checks watch real user requests and eject a server after a run of consecutive errors, catching failures faster than the polling interval would allow, but only when there's live traffic to observe. Using both gives you fast reaction to real failures (passive) plus reliable detection even when traffic is sparse (active).

**Q: Why is a TCP-level (L4) health check considered less reliable than an HTTP-level (L7) health check?**
Answer: A TCP health check only confirms that the OS can complete a 3-way handshake on the listening port — it says nothing about whether the application behind that port is actually functioning. A process can be deadlocked, stuck waiting on a hung database query, or completely out of worker threads while still holding the port open, so the TCP check would falsely report it as healthy. An L7 check that hits an application-level endpoint and verifies a real `200 OK` (ideally after checking dependencies) catches this class of failure that L4 checks miss.

**Q: How does VRRP achieve near-instant failover compared to DNS-based failover?**
Answer: VRRP (Virtual Router Redundancy Protocol) operates at the network layer — the standby node sends/receives heartbeat multicast packets to the primary, and if those stop, the standby takes over the shared virtual IP directly at the OS/ARP level within milliseconds. DNS-based failover instead requires updating a DNS record and waiting for that change to propagate, which is bottlenecked by DNS caching (TTLs) at resolvers and clients — this can take anywhere from seconds to hours depending on how aggressively records were cached.
