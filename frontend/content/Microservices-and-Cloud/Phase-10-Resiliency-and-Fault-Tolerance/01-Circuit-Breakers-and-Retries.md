# Circuit Breakers and Retries

When Service A calls Service B over the network, the call might fail due to a temporary network blip. The obvious solution is to retry the request. However, naive retries can accidentally destroy your own infrastructure.

## 1. The Danger of Retries (Retry Storms)

Imagine `Service B` is currently struggling because its database is slow. It takes 10 seconds to process a request instead of 1 second.

If 1,000 users are hitting `Service A`, and `Service A` has a 2-second timeout, all 1,000 requests will time out. 
If `Service A` is configured to blindly retry 3 times instantly:
- `Service B` receives the first 1,000 requests (and is struggling).
- 2 seconds later, `Service A` sends *another* 1,000 requests.
- 2 seconds later, *another* 1,000 requests.

`Service A` has effectively launched a Distributed Denial of Service (DDoS) attack against its own internal `Service B`, guaranteeing that `Service B` will crash completely.

### Exponential Backoff and Jitter
To fix this, retries must use **Exponential Backoff**:
- Retry 1: Wait 1 second.
- Retry 2: Wait 2 seconds.
- Retry 3: Wait 4 seconds.
- Retry 4: Wait 8 seconds.

This gives the struggling `Service B` time to recover. 

Additionally, you must add **Jitter** (randomness). If 1,000 requests all fail at exactly 12:00:00, and they all wait exactly 2 seconds, they will all hit `Service B` again at exactly 12:00:02 in a massive spike. Jitter randomizes the wait time (e.g., between 1.5s and 2.5s) to smooth out the traffic spike.

## 2. The Circuit Breaker Pattern

Even with backoff, if `Service B` is completely dead (e.g., the server is powered off), retrying is a waste of CPU, memory, and network bandwidth. Furthermore, while `Service A` is waiting for `Service B` to timeout, `Service A`'s threads are blocked, meaning `Service A` might run out of threads and crash too (Cascading Failure).

The **Circuit Breaker Pattern** (popularized by Netflix Hystrix, now often handled by a Service Mesh or libraries like Resilience4j) solves this.

It acts like an electrical circuit breaker in your house.

### How it Works

1. **CLOSED State (Normal)**: Traffic flows freely. `Service A` calls `Service B`.
2. **Monitoring**: The Circuit Breaker watches the failure rate. If 50% of the last 20 requests to `Service B` fail or timeout, the Circuit Breaker trips.
3. **OPEN State (Tripped)**: The circuit is broken. If `Service A` tries to call `Service B`, the Circuit Breaker intercepts the call and *immediately* returns an error (or a fallback response) without ever sending the network request. This prevents `Service A` from wasting time waiting for a timeout, and gives `Service B` total silence to recover.
4. **HALF-OPEN State (Testing)**: After a set timeout (e.g., 30 seconds), the Circuit Breaker allows a *single* test request to pass through to `Service B`. 
   - If the request succeeds, the breaker assumes `Service B` is healthy, resets to **CLOSED**, and allows normal traffic.
   - If the request fails, the breaker snaps back to **OPEN** for another 30 seconds.

## Summary
- Never implement basic `while(fail) { retry(); }` loops in microservices.
- Always use **Exponential Backoff and Jitter** when retrying.
- Use the **Circuit Breaker Pattern** to "fail fast" and prevent cascading failures when a downstream service is struggling.
