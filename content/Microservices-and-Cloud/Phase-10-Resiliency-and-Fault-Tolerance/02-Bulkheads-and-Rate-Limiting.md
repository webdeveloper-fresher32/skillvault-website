# Bulkheads and Rate Limiting

To build a truly resilient system, you must protect your services from resource exhaustion. If a service runs out of memory, database connections, or threads, it will crash.

Two critical patterns for protecting resources are Bulkheads and Rate Limiting.

## 1. The Bulkhead Pattern

The name comes from shipbuilding. The hull of a ship is divided into multiple watertight compartments called bulkheads. If the ship hits an iceberg and water breaches one compartment, the bulkheads prevent the water from flooding the entire ship. The ship stays afloat.

In microservices, we apply this same concept to system resources (like connection pools and threads).

### The Problem
Imagine an `API Gateway` that routes traffic to `Service A` and `Service B`. The Gateway has a total thread pool of 100 threads.
- `Service A` becomes extremely slow. 
- Requests to `Service A` start piling up, waiting for a response.
- Very quickly, all 100 threads in the Gateway are stuck waiting for `Service A`.
- Now, a user requests `Service B` (which is perfectly healthy). The request fails because the Gateway has no threads left to process it.

### The Bulkhead Solution
Using the Bulkhead pattern, you divide the Gateway's thread pool. 
- Allocate 50 threads *only* for calling `Service A`.
- Allocate 50 threads *only* for calling `Service B`.

If `Service A` slows down, its 50 threads will be exhausted. Any new requests for `Service A` will immediately be rejected. However, the 50 threads for `Service B` are completely unaffected. Traffic to `Service B` continues flawlessly. The failure is isolated.

## 2. Rate Limiting (Throttling)

While Bulkheads protect internal resources, Rate Limiting protects the system from external abuse.

Rate limiting restricts the number of requests a user (or an internal service) can make within a specific time window.

### Common Algorithms

1. **Token Bucket**: The most common algorithm (used by AWS and Stripe). You are given a bucket with a maximum capacity of "tokens". Every request removes a token. Tokens are refilled at a constant rate. This allows for brief bursts of traffic, but enforces a steady long-term limit.
2. **Leaky Bucket**: Requests enter the top of a bucket at any speed, but they leak out the bottom (are processed) at a strict, constant rate. This smooths out traffic spikes entirely.
3. **Fixed Window**: "You get 100 requests per minute." (00:00 to 00:01). The flaw is that a user can make 100 requests at 00:00:59, and another 100 at 00:01:01, effectively pushing 200 requests in 2 seconds.

### Where to Implement?
Rate limiting is almost always implemented at the **API Gateway** level, preventing malicious or runaway traffic from ever reaching your internal microservices.

## Summary
- **Bulkheads** isolate internal resources (thread pools, connection pools) so a failure in one area doesn't drain the resources needed by other areas.
- **Rate Limiting** protects the system by capping the amount of traffic allowed in, usually implemented at the API Gateway via the Token Bucket algorithm.
