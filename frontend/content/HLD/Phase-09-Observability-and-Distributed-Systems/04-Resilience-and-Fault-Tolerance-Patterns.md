# Resilience and Fault Tolerance Patterns

It's 2am. Your Payment Gateway's fraud-check service — a downstream dependency it calls on every transaction — starts responding in 30 seconds instead of 200ms. Nobody touched fraud-check's code; its database just got slow. Your Payment Service, which calls fraud-check synchronously on every request, has no timeout configured. Within two minutes, every worker thread in your Payment Service is parked waiting on a fraud-check response that may never come. New payment requests pile up in the connection queue, then start getting rejected outright — not because payments are broken, but because a completely unrelated dependency got slow and your own service had no way to protect itself from that slowness. Dashboards (Phase 09 Lesson 01) told you *that* it broke. This lesson is about not breaking in the first place.

Monitoring answers "is it healthy?" Resilience patterns answer the harder question interviewers actually probe for: **"what happens, mechanically, when a downstream dependency is slow or down — and what did you build so your own service doesn't die with it?"**

## 1. Timeouts — the one thing every network call needs

A network call with no timeout is a promise to wait forever. In practice "forever" means until the OS kills the connection or the thread pool runs out — and the second one happens first, and it happens to *you*, not the dependency that's actually broken.

```
No timeout, fraud-check goes slow:

Payment Service thread pool (size 50)
┌────┬────┬────┬────┬────┬─── ... ───┬────┐
│ T1 │ T2 │ T3 │ T4 │ T5 │           │T50 │
│wait│wait│wait│wait│wait│  all waiting on   │
│ing │ing │ing │ing │ing │  fraud-check      │
└────┴────┴────┴────┴────┴───────────┴────┘
        ↑ 2 minutes later: pool exhausted
        ↑ new payment requests get NO thread → rejected
        ↑ a slow fraud-check just took down checkout entirely
```

The fix is almost embarrassingly simple to state and easy to forget in practice: every outbound network call — HTTP, database, cache, queue — gets an explicit timeout, sized to what's actually acceptable for the caller, not to whatever the library's default happens to be (which is often "none").

```python
import httpx

# No timeout: this call can hang indefinitely and slowly
# exhaust every worker thread waiting on it.
# response = httpx.get("https://fraud-check.internal/verify")

# Explicit timeout: this call fails fast and predictably,
# freeing the thread instead of parking it.
response = httpx.get(
    "https://fraud-check.internal/verify",
    timeout=httpx.Timeout(connect=1.0, read=2.0, write=1.0, pool=1.0),
)
```

A timeout converts an unbounded, unpredictable failure (a hang) into a bounded, predictable one (a fast error you can actually handle). That trade — turning "maybe never" into "definitely within 2 seconds" — is the foundation every other pattern in this lesson builds on.

## 2. Retries with exponential backoff and jitter

A timed-out or failed call is often transient — the dependency is momentarily overloaded, not permanently dead. Retrying is reasonable. Retrying *immediately and repeatedly* is not: if fraud-check is struggling under load, having every one of your Payment Service instances retry the instant a call fails just adds more requests on top of the load that caused the failure in the first place. This is a thundering herd, and naive retries are a common way well-intentioned code makes an outage worse instead of better.

```
Naive immediate retry (10 instances, all retry instantly on failure):

fraud-check load: ▓▓▓▓▓▓▓▓▓▓ (already struggling)
                        +10 retries land in the same instant
fraud-check load: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ← worse, not better
```

Exponential backoff spaces retries out (1s, 2s, 4s, 8s...) so load tapers instead of piling on. Jitter — adding a small random offset to each delay — prevents every caller from retrying in lockstep, which backoff alone doesn't fix if all callers failed at the same moment.

```python
import random
import time

def call_with_retry(fn, max_attempts=4, base_delay=0.5, max_delay=8.0):
    for attempt in range(max_attempts):
        try:
            return fn()
        except TimeoutError:
            if attempt == max_attempts - 1:
                raise
            backoff = min(max_delay, base_delay * (2 ** attempt))
            sleep_for = random.uniform(0, backoff)  # full jitter
            time.sleep(sleep_for)
```

Two guardrails that matter as much as the backoff math: only retry idempotent operations (retrying a "charge the card" call blindly is how Phase 11's Payment Gateway lesson ends up needing an idempotency key in the first place), and always cap the number of attempts — infinite retries are just a slower-motion version of the thundering herd.

## 3. Circuit breaker — stop calling a dependency that's already down

Retries assume the dependency will recover soon. But if fraud-check is genuinely down for five minutes, every single request during those five minutes paying the full timeout-then-retry cost is pure waste — it delays your own response to the user *and* keeps hammering a dependency that needs room to recover, not more traffic.

A circuit breaker wraps a call and tracks its recent failure rate, moving through three states:

```
        failures exceed threshold
   ┌────────────┐ ─────────────────▶ ┌────────────┐
   │   CLOSED    │                     │    OPEN     │
   │ (calls flow  │ ◀───── success ─── │ (calls fail  │
   │  normally)   │        during trial │  instantly,  │
   └────────────┘                     │  no network  │
         ▲                              │  call made)  │
         │                              └──────┬──────┘
         │                                     │ after cooldown timeout
         │            failure during trial     ▼
         └───────────────────────── ┌──────────────┐
                                     │  HALF-OPEN    │
                                     │ (one trial     │
                                     │  request let    │
                                     │  through)       │
                                     └──────────────┘
```

- **Closed** — normal operation, calls go through, failures are counted.
- **Open** — once failures cross a threshold (say, 50% of the last 20 calls), the breaker "trips": every call fails instantly *without touching the network at all* for a cooldown period. This is the key benefit — a struggling dependency gets a window with zero load from you instead of a stream of doomed requests.
- **Half-open** — after the cooldown, one trial request is let through. If it succeeds, the breaker closes and traffic resumes normally; if it fails, it reopens and the cooldown restarts.

```python
class CircuitBreaker:
    def __init__(self, failure_threshold=0.5, window=20, cooldown=30):
        self.state = "CLOSED"
        self.failures, self.calls = 0, 0
        self.opened_at = None
        self.cooldown = cooldown

    def call(self, fn):
        if self.state == "OPEN":
            if time.time() - self.opened_at < self.cooldown:
                raise CircuitOpenError("fraud-check circuit is open")
            self.state = "HALF_OPEN"
        try:
            result = fn()
            if self.state == "HALF_OPEN":
                self.state, self.failures, self.calls = "CLOSED", 0, 0
            return result
        except TimeoutError:
            self.failures += 1
            self.calls += 1
            if self.state == "HALF_OPEN" or (self.failures / self.calls) > 0.5:
                self.state, self.opened_at = "OPEN", time.time()
            raise
```

Retries and circuit breakers are complementary, not redundant: retries handle a single request's transient blip; the circuit breaker handles the case where the blip isn't transient, and stops the whole service from wasting effort discovering that fact over and over.

## 4. Bulkhead — don't let one dependency sink the whole ship

The circuit breaker stops you from hammering fraud-check once it's known to be down, but it doesn't answer a related question: while fraud-check *is* down (or slow), are calls to it silently eating resources that your other dependencies — say, the inventory service, or the notification service — also need? If all outbound calls share one connection pool or one thread pool, a hung fraud-check can starve every other dependency of capacity even though those other dependencies are perfectly healthy. This is the same failure mode as the opening scenario, just spread across dependencies instead of confined to one.

The bulkhead pattern — named after a ship's watertight compartments, where flooding one section doesn't sink the rest — isolates resources per dependency so one dependency's failure is contained to its own slice.

```
Without bulkheads:                  With bulkheads:
┌─────────────────────┐             ┌───────┐ ┌───────┐ ┌───────┐
│ one shared pool (50)  │             │fraud- │ │invent-│ │notify │
│ fraud-check: 48 stuck │             │check   │ │ory    │ │       │
│ inventory: 1 (starved)│             │pool:20 │ │pool:20│ │pool:10│
│ notify: 1 (starved)   │             │(stuck) │ │(fine) │ │(fine) │
└─────────────────────┘             └───────┘ └───────┘ └───────┘
```

```python
# Separate connection pools per downstream dependency, not one shared pool
fraud_check_client = httpx.Client(
    base_url="https://fraud-check.internal",
    limits=httpx.Limits(max_connections=20),
    timeout=2.0,
)
inventory_client = httpx.Client(
    base_url="https://inventory.internal",
    limits=httpx.Limits(max_connections=20),
    timeout=2.0,
)
```

The cost is real — you provision resources per dependency instead of sharing one flexible pool, which can mean lower overall utilization. That cost is the price of containment, and for a dependency whose failure you can't afford to spread, it's cheap insurance.

## 5. Graceful degradation and fallback

Timeouts, retries, circuit breakers, and bulkheads are all about failing *fast and contained*. Graceful degradation goes one step further: instead of just failing cleanly, can you serve something useful anyway?

This is Phase 06's cache-aside pattern turned into a resilience tool rather than just a performance one. If a recommendation service is down, falling back to a cached "popular items" list from an hour ago is a worse experience than a fresh personalized one — but it's a vastly better experience than a broken page. The trick is knowing *which* calls are safe to degrade this way and which aren't: a product listing page can degrade gracefully; a payment authorization cannot (Phase 11's Payment Gateway lesson is explicit that correctness there is non-negotiable — there's no "approximate" charge).

```python
def get_recommendations(user_id):
    try:
        return recommendation_service.get(user_id, timeout=1.0)
    except (TimeoutError, CircuitOpenError):
        cached = cache.get(f"popular_items:{region_of(user_id)}")
        if cached:
            return cached          # degraded but useful
        return []                  # last resort: empty, not a 500
```

The general rule: rank your dependencies by whether a stale/generic answer beats no answer (recommendations, "related products," non-critical banners — yes) versus whether it doesn't (payment decisions, inventory decrement, anything Phase 11 flags as requiring strong consistency — no). Degrade the first category; fail loud and fast on the second.

## 6. Backpressure — the consumer telling the producer to slow down

Everything so far protects a service calling a slow dependency. Backpressure protects the mirror case: a service that is itself the dependency, getting hit faster than it — or its queue — can keep up. This is Phase 07's message queue territory: a queue absorbs bursts, but an unbounded queue in front of an overloaded consumer doesn't fix overload, it just delays and hides it while memory climbs and latency for every queued item grows unboundedly.

```
No backpressure: queue grows without bound
producer ──▶ [██████████████████████████████████...] ──▶ consumer (slow)
                        ↑ memory pressure, ever-growing latency

With backpressure: producer is signaled to slow down or shed load
producer ──▶ [████████████] ──▶ consumer (slow)
             ↑ queue capped; producer gets "429 / queue full"
             ↑ producer slows its own rate, or drops low-priority work
```

Backpressure can be implemented at whichever layer makes sense: a bounded queue that rejects new work once full (forcing the producer to slow down or shed load rather than queue infinitely), a consumer that pulls at its own pace instead of having work pushed at it, or an explicit "slow down" signal (an HTTP 429 with a `Retry-After` header) sent back up the chain. The unifying idea is that an overloaded system's healthiest response is to say "not right now" to *some* of its incoming work, rather than accept all of it and collapse under all of it.

```python
# Bounded queue: producer gets an explicit signal instead of
# the queue growing without limit
from queue import Queue, Full

work_queue = Queue(maxsize=1000)

def enqueue(item):
    try:
        work_queue.put_nowait(item)
    except Full:
        raise BackpressureError("queue full — slow down or shed load")
```

## Interview Q&A

**Q: Why does every network call need an explicit timeout, and what happens if it doesn't have one?**
A: Without a timeout, a slow or hung dependency causes the calling thread to wait indefinitely. As more requests arrive and more threads get stuck waiting, the caller's own thread or connection pool exhausts — a slowdown in an unrelated downstream service cascades into the caller being unable to serve *any* request, including ones that don't even depend on the slow service. An explicit timeout bounds the damage: it turns an unpredictable hang into a fast, predictable failure that can be retried, circuit-broken, or degraded gracefully.

**Q: Why can naive retries make an outage worse, and how does exponential backoff with jitter fix it?**
A: If a dependency is failing because it's overloaded, and every caller retries immediately on failure, the retries land on top of the load that caused the failure in the first place — a thundering herd that deepens the outage instead of recovering from it. Exponential backoff spaces retries further apart on each attempt so aggregate load tapers over time; jitter adds randomness to each delay so that callers who failed simultaneously don't all retry in lockstep, which backoff alone doesn't prevent.

**Q: Explain the three states of a circuit breaker and why the open state matters.**
A: Closed is normal operation — calls go through and failures are tracked. Once failures cross a threshold, the breaker trips to open: every call fails instantly without making a network call at all, for a cooldown period. This matters because it gives a struggling dependency a window with zero added load from this caller, instead of a continuous stream of doomed requests that waste both sides' resources. After the cooldown, half-open lets a single trial request through — success closes the breaker and resumes normal traffic, failure reopens it and restarts the cooldown.

**Q: What's the difference between a circuit breaker and a bulkhead, and why do you need both?**
A: A circuit breaker protects a *dependency* from being hammered once it's known to be failing, by cutting off calls to it. A bulkhead protects your *own service* from one dependency's failure by isolating resources (thread pools, connection pools) per dependency, so a hung call to dependency A can't exhaust the resources needed to call healthy dependency B. They solve different failure directions — circuit breaker stops you hurting a bad dependency further; bulkhead stops a bad dependency hurting your other, unrelated calls — and a production system typically needs both.

**Q: Walk me through what happens end-to-end when your Payment Gateway's fraud-check dependency starts timing out.**
A: The Payment Service's call to fraud-check has an explicit timeout (say, 2 seconds), so instead of a worker thread hanging indefinitely, the call fails fast and the thread is freed. A retry with exponential backoff and jitter attempts the call again once or twice, in case it's a transient blip — but the payment request itself must already be tagged with an idempotency key (Phase 11's Payment Gateway lesson), because if the *charge* were retried instead of just the fraud-check, that risks a double charge. If failures keep crossing the threshold, the circuit breaker for fraud-check trips open, so subsequent payment requests fail the fraud-check step instantly without adding more load to an already-struggling service. Because fraud-check calls use their own connection pool (bulkhead), the Payment Service's calls to the database and to the external card processor are unaffected and keep working normally. At this point graceful degradation isn't an option — the Payment Gateway's non-functional requirement is strong consistency and exact financial correctness, so there's no "approximate" fraud decision to fall back to; the honest response is to decline the payment with a clear "try again shortly" error rather than approve a transaction with an unverified fraud check. Throughout, the symptom-based alert on Payment Service error rate (Phase 09 Lesson 01) fires, and traces show the time is concentrated in the fraud-check hop, pointing on-call straight at the actual failing dependency instead of the Payment Service itself.
