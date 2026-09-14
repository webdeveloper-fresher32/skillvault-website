# Monitoring and Observability

Imagine your Instagram-clone backend from the Projects/ track is running fine at 2pm. At 2:15pm, users start complaining posts are loading slowly. You have no dashboards. What do you do — SSH into the server and start running `top`, guessing? Now imagine the same incident, except you have a dashboard that shows request latency spiked from 80ms to 4 seconds at 2:03pm, exactly when a deploy went out, and the error rate on `/feed` jumped from 0.1% to 12% at the same moment. You didn't have to guess — the system told you where to look, in under a minute.

That difference is observability. It's not optional at scale; it's the thing that turns "the site is slow, good luck" into "here's exactly which service, which endpoint, and which deploy caused it."

## What companies actually watch

```
                    ┌─────────────────────────────┐
                    │        Dashboard             │
                    │  (Grafana)                   │
                    └──────────────▲────────────────┘
                                    │ queries
                    ┌───────────────┴────────────────┐
                    │   Metrics store (Prometheus)    │
                    └───────────────▲────────────────┘
                                    │ scrapes every N seconds
        ┌───────────────┬──────────┴──────────┬───────────────┐
        ▼               ▼                     ▼               ▼
  ┌───────────┐   ┌───────────┐         ┌───────────┐   ┌───────────┐
  │  Server 1  │   │  Server 2  │         │  Database  │   │  Cache     │
  │  CPU: 42%  │   │  CPU: 88%  │         │  Conns: 90  │   │  Hit%: 94  │
  │  Latency   │   │  Latency   │         │  Slow qrs:3 │   │  Evictions │
  │  Errors    │   │  Errors    │         │             │   │             │
  │  Req/sec   │   │  Req/sec   │         │             │   │             │
  └───────────┘   └───────────┘         └───────────┘   └───────────┘
```

The five numbers every team watches on nearly every service, all day, every day:

- **CPU** — is a server compute-bound? A sustained 90%+ CPU on one instance while others sit at 40% points at an uneven load balancer or a hot key.
- **RAM** — memory creeping up over hours/days usually means a leak; a sudden spike usually means a bad query or an unbounded cache.
- **Latency** — how long a request takes, usually tracked as p50/p95/p99 (the 99th-percentile number matters more than the average, because it's what your worst-treated users feel).
- **Error rate** — the percentage of requests returning 5xx (or business-logic failures). A jump here is the single fastest way to know "something just broke."
- **Requests/sec** — traffic volume. Useful both to spot unexpected spikes (a bug causing a retry storm) and unexpected drops (something upstream is failing silently and users aren't even reaching you).

## The tools

- **Prometheus** — scrapes numeric time-series metrics (CPU, latency, req/sec) from every service at a regular interval and stores them.
- **Grafana** — turns Prometheus's stored metrics into the dashboards humans actually look at, plus alerting rules ("page someone if p99 latency > 1s for 5 minutes").
- **ELK Stack** (Elasticsearch, Logstash, Kibana) — collects, indexes, and lets you search raw log lines across every service, so you can go from "latency spiked" to "here's the exact stack trace from the request that failed."

## The three pillars of observability

```
METRICS                LOGS                    TRACES
"What is happening,     "What exactly            "Where did THIS
 in aggregate?"          happened, in detail?"    specific request go?"

p99 latency: 3.2s   →   ERROR 14:03:02          Request abc123:
error rate: 12%          POST /feed              Gateway (2ms)
CPU: 88%                  user_id=4021             → Auth (5ms)
                          DB timeout after 5s        → Post Service (8ms)
                                                       → Database (4980ms) ← found it
```

- **Metrics** tell you *that* something is wrong and roughly how bad — a number over time, cheap to store, great for dashboards and alerts.
- **Logs** tell you *what* happened in detail for a specific event — a structured record ("user_id=4021, endpoint=/feed, error=DB timeout"), more expensive to store, great for post-incident digging.
- **Traces** tell you *where in a distributed request path* the time went — following one request across the API gateway, auth service, post service, and database (from Phase 02's microservices split) so you can see which hop actually took 4.98 of the 5 seconds.

You need all three. Metrics tell you *that* the feed endpoint is slow. Logs tell you it's timing out on a specific query. Traces tell you that query lives inside the Post Service, not the Auth Service you might have guessed.

## Alert on symptoms, not just causes

A "cause" alert fires on an internal condition: "database CPU is above 80%." A "symptom" alert fires on what the user actually experiences: "p99 latency on `/feed` is above 1 second" or "error rate is above 2%."

The trap with cause-only alerting is that a system can have a scary-looking cause metric (say, DB CPU at 85%) that never actually degrades the user experience because it has enough headroom — that's a false alarm that trains engineers to ignore alerts. Conversely, a system can look "healthy" on every cause metric individually while the user-facing symptom is broken (e.g., a single downstream service call is silently retrying 5 times, each cheap on CPU but expensive in wall-clock time). Symptom-based alerts page you for what actually matters — the user's experience — and causes are what you dig into with logs and traces *after* the symptom alert fires, not the other way around.

## Interview Q&A

**Q: What's the difference between metrics, logs, and traces?**
A: Metrics are numeric time-series data (latency, error rate, CPU) — cheap to store, great for dashboards and alerting on trends. Logs are detailed records of individual events, useful for understanding exactly what happened during a specific failure. Traces follow a single request as it moves across multiple services, showing exactly where time was spent in a distributed call chain. Together they answer "is something wrong," "what exactly happened," and "where in the system did it happen."

**Q: Why should you alert on symptoms rather than causes?**
A: Symptom-based alerts (elevated latency, error rate) reflect what users actually experience, so every symptom alert is meaningful and actionable. Cause-based alerts (high CPU, high memory) can fire without any real user impact if the system has headroom, or fail to fire even when users are affected by a cause you didn't anticipate. Alerting on symptoms first, then using logs/traces to find the cause, keeps the on-call engineer focused on real problems and avoids alert fatigue.

**Q: Why does p99 latency matter more than average latency?**
A: Average latency can look fine even while a meaningful fraction of users have a terrible experience — a handful of very slow requests get smoothed out by many fast ones. p99 (or p95) shows you the experience of your worst-treated users, which is usually where real bugs (a specific slow query path, a specific server under load) show up first, long before the average moves.

**Q: What would you monitor for a new microservice on day one?**
A: At minimum: request rate, error rate, and latency (the "RED" trio — Rate, Errors, Duration) at the service boundary, plus CPU/RAM on the underlying hosts or containers. If the service talks to a database or cache, add connection pool usage and query latency for those too. This gives you both the outside view (is this service serving its callers well) and an early signal on the resources it depends on.

**Q: Your dashboards show a service is "healthy" by every metric, but users are reporting errors. What's the gap?**
A: Likely one of: the metric being watched doesn't match the actual failure mode (e.g., you're tracking 5xx errors but the bug returns a 200 with a broken payload), the failure is isolated to a specific user segment or region your aggregate metrics average away, or the failure is happening in a component you aren't instrumenting at all (a third-party API call, a client-side bug). This is exactly why traces and logs matter alongside metrics — aggregates hide problems that only show up when you look at individual requests.
