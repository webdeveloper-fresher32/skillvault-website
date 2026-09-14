# Why Load Balancing

Imagine your API server can comfortably handle 200 requests per second. Your app goes viral overnight and you're now getting 1,000 requests per second. What happens?

The server's request queue backs up, response times climb from 100ms to several seconds, the OS runs out of file descriptors or worker threads, and eventually the server starts dropping connections outright. Buying a bigger server (vertical scaling, from Phase 03) buys you some headroom, but there's always a ceiling — and a single server is always a single point of failure, viral traffic or not.

## The Fix: Spread the Load

```
                    ┌─────────────┐
      1000 req/s    │             │
   ───────────────▶ │Load Balancer│
                    │             │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
          ┌───────┐    ┌───────┐    ┌───────┐
          │ API-1 │    │ API-2 │    │ API-3 │
          │~333/s │    │~333/s │    │~333/s │
          └───────┘    └───────┘    └───────┘
```

Instead of one server absorbing all 1,000 requests/sec, the load balancer (LB) sits in front of a fleet of identical backend instances and distributes incoming requests across them. Each of API-1, API-2, and API-3 now only has to handle roughly a third of the traffic — well within what a single instance can manage.

Notice something important: this only works because the backend servers are **stateless** (Phase 03, Lesson 02). If a user's session lived only in API-1's memory, routing their next request to API-2 would log them out. The load balancer and statelessness are a package deal — one doesn't work well without the other.

This is also why production setups put a load balancer in front of the backend *even when there's only one server today*. It costs almost nothing to add, and it means scaling from 1 to N servers later is a config change, not an architecture change.

## What a Load Balancer Actually Does

At minimum, a load balancer:
1. Accepts incoming connections from clients.
2. Picks a healthy backend server using some algorithm (covered in Lesson 02).
3. Forwards the request to that server and relays the response back to the client.
4. Continuously checks whether each backend server is still alive — a **health check**.

That fourth point is easy to skip over, but it's the difference between a load balancer that helps and one that actively makes things worse.

## What Happens Without Health Checks

```
                    ┌─────────────┐
                    │Load Balancer│  (no health checks —
                    │  (blind)    │   just round-robins forever)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
          ┌───────┐    ┌───────┐    ┌───────┐
          │ API-1 │    │ API-2 │    │ API-3 │
          │  OK   │    │ CRASHED│   │  OK   │
          └───────┘    └───────┘    └───────┘
                            ▲
                            │
                 every 3rd request still
                 routed here → times out
                 or errors for the user
```

If the load balancer doesn't know API-2 crashed (out of memory, deploy gone wrong, dependency down — doesn't matter why), it keeps sending it roughly a third of all traffic anyway, because from the LB's point of view nothing has changed. Those requests time out or fail, and — worse — the client often can't tell whether *the whole system* is down or just bad luck on one request.

A **health check** fixes this: the load balancer periodically pings each backend (e.g., `GET /health` every few seconds) and stops routing traffic to any instance that fails to respond correctly. If API-2 stops answering its health check, the LB quietly removes it from rotation until it recovers — the other two instances absorb its share of traffic, and users never see the failure. This is the mechanism that turns "one server crashed" from an outage into a non-event, and it's the reason every production load balancer (Nginx, HAProxy, AWS ALB — Lesson 03) ships with health-check configuration as a first-class feature.

## Interview Q&A

**Q: Why do you need a load balancer if you could just make the server bigger (vertical scaling)?**
Answer: Vertical scaling has a hard ceiling — there's a biggest machine you can rent — and it doesn't eliminate the single point of failure; if that one (bigger) server crashes, everything is down. A load balancer lets you scale horizontally instead: add more identical servers and spread traffic across them. This scales further, removes the single point of failure, and is how virtually every production system beyond a toy scale actually operates.

**Q: Would you put a load balancer in front of a single backend server in production?**
Answer: Yes. Even with one server today, putting a load balancer in front of it costs very little and means that when you need a second server tomorrow, it's a configuration change (add the new server to the LB's pool) rather than a client-facing architecture change (clients already only ever talk to the LB's address, never directly to a backend).

**Q: What is a health check and why does it matter?**
Answer: A health check is the load balancer periodically probing each backend server (commonly an HTTP `GET /health` endpoint) to confirm it's still alive and able to serve traffic. Without it, a crashed server keeps receiving its share of requests indefinitely, causing timeouts and errors for whichever users happen to be routed to it. With it, the load balancer detects the failure within a few seconds and stops routing to that instance until it recovers.

**Q: If a load balancer removes an unhealthy server from rotation, what happens to the requests that server was handling?**
Answer: In-flight requests already sent to the unhealthy server will typically fail or time out on that connection — the load balancer can't retroactively save requests it already routed. But all *new* requests, from the moment the health check fails, get routed only to the remaining healthy servers, so the blast radius of the failure is limited to a brief window rather than an ongoing outage.

**Q: Is a load balancer itself a single point of failure?**
Answer: It can be, which is why production setups usually run load balancers in a redundant pair (active-passive or active-active) behind a further layer like DNS or a cloud provider's managed, highly-available load balancer service (e.g., AWS ALB, which is already replicated across availability zones). The goal is to make sure the component responsible for routing around backend failures doesn't become a new failure point itself.
