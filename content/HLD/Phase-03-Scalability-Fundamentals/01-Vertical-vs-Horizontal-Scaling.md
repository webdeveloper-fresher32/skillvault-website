# Vertical vs. Horizontal Scaling

Imagine you launch a small app on a single server. It has 2GB of RAM and one CPU core. With 100 users browsing around, it hums along fine — CPU sits at 5%, memory barely moves. Then the app goes viral. A million users show up in a month. That same server now falls over: requests time out, memory fills up, the process gets killed and restarted in a crash loop.

You have exactly two levers to pull to fix this: make the one server bigger, or add more servers.

## The two fixes, as diagrams

**Vertical scaling — make the box bigger:**

```
BEFORE                              AFTER
┌─────────────────────┐             ┌─────────────────────┐
│   Server (1 box)     │             │   Server (1 box)     │
│   2 GB RAM            │   ───►      │   16 GB RAM           │
│   1 CPU core          │             │   8 CPU cores         │
│   ~500 req/s ceiling  │             │   ~5,000 req/s ceiling│
└─────────────────────┘             └─────────────────────┘
        ▲                                     ▲
        │                                     │
     All traffic                          All traffic
   (single point of failure either way)
```

You didn't change the architecture at all. You just moved the same single-server design to a bigger piece of hardware — more RAM, more CPU cores, faster SSDs. The app's code doesn't need to change; it still assumes "there is one of me."

**Horizontal scaling — add more boxes:**

```
                     ┌────────────────┐
                     │  Load Balancer  │
                     └────────┬───────┘
             ┌────────────────┼────────────────┬────────────────┐
             ▼                ▼                ▼                ▼
      ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
      │  Server 1   │   │  Server 2   │   │  Server 3   │   │  Server 4   │
      │  2 GB RAM   │   │  2 GB RAM   │   │  2 GB RAM   │   │  2 GB RAM   │
      └────────────┘   └────────────┘   └────────────┘   └────────────┘
```

Instead of one bigger server, you run several small, identical servers side by side and put a load balancer (Phase 04) in front to spread requests across them. Each server is no more powerful than the original — you just have four of them instead of one.

## Trade-offs

| | Vertical Scaling | Horizontal Scaling |
|---|---|---|
| **How it works** | Add more CPU/RAM/disk to one machine | Add more machines running the same app |
| **Code changes needed** | Usually none | Needs the app to be stateless (Lesson 02) |
| **Ceiling** | Hard hardware ceiling — eventually there's no bigger box to buy (or it becomes absurdly expensive) | Near-unlimited — keep adding boxes |
| **Single point of failure** | Yes — if that one box dies, everything is down | No — if one server dies, the load balancer routes around it |
| **Operational complexity** | Low — one thing to deploy, monitor, patch | Higher — needs a load balancer, service discovery, consistent deploys across N boxes |
| **Cost curve** | Cheap at first, then very expensive per unit of extra capacity at the high end | Roughly linear — twice the servers, roughly twice the capacity (and twice the cost) |
| **Downtime for scaling** | Often requires a resize/reboot | Add a new server without touching the running ones |

Vertical scaling is the right first move for a small app — it's simple, requires no architecture changes, and buys you time. But every piece of hardware has a ceiling, and even before you hit it, a single machine is a single point of failure: one crash and the whole app is down. Horizontal scaling removes that ceiling and that single point of failure, but it isn't free — it only works cleanly if any request can be served by any server, which is exactly the statelessness requirement covered in the next lesson.

## Formal definition

**Vertical scaling** (scaling *up*) increases the capacity of an existing machine by adding resources — more CPU, RAM, faster disks.

**Horizontal scaling** (scaling *out*) increases capacity by adding more machines that each run a copy of the application, with load distributed across them.

Most production systems eventually do both: individual services get reasonably-sized boxes (not the cheapest possible), and then those boxes are horizontally scaled behind a load balancer.

## Interview Q&A

**Q: What is the difference between vertical and horizontal scaling?**
A: Vertical scaling adds more resources (CPU, RAM, disk) to a single existing server. Horizontal scaling adds more servers running the same application and distributes load across them via a load balancer. Vertical scaling is simpler but has a hardware ceiling and remains a single point of failure; horizontal scaling removes both limitations but requires the application to be stateless.

**Q: Why can't you scale vertically forever?**
A: Physical and economic limits. There's a maximum amount of CPU/RAM/disk you can put in one machine, and the cost of the largest available instances grows much faster than the capacity they add. At some point the biggest box you can buy still isn't enough, or costs far more than several smaller boxes combined.

**Q: If horizontal scaling is "near-unlimited," why doesn't every system just scale horizontally from day one?**
A: Because it adds real complexity: you need a load balancer, the app must be stateless, deployments have to roll out consistently across every instance, and you now have a distributed system with all the failure modes that come with it (partial failures, network calls between nodes). For a small app with predictable, modest load, one well-sized vertical server is simpler to build, deploy, and debug.

**Q: Is a single powerful server ever "good enough" for production?**
A: Yes, for many real systems — internal tools, low-traffic services, early-stage products. The key risk to flag in an interview is that it's a single point of failure: if that box crashes, restarts, or needs a deploy, there's downtime. Many teams vertically scale a single machine but still run at least two of them behind a load balancer purely for redundancy, even before load requires it.

**Q: How do vertical and horizontal scaling affect cost differently?**
A: Vertical scaling has a non-linear cost curve — doubling a small machine's specs is cheap, but doubling a very large machine's specs is disproportionately expensive (and eventually impossible). Horizontal scaling has a roughly linear cost curve — adding a fifth identical server costs about the same as adding the second one did, so cost scales predictably with load.
