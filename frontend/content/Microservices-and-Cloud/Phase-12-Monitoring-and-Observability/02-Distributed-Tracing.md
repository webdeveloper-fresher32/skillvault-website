# Distributed Tracing

In a microservices architecture, a single user click ("Place Order") might trigger a chain of HTTP calls across 8 different services. 

If the user complains that the checkout took 5 seconds, how do you find the bottleneck? 
- You can't just check the `Order` service logs, because it might say the request took 5 seconds, but it was actually waiting for the `Payment` service.
- If you check the `Payment` service logs, how do you know *which* of the 10,000 payment logs belongs to that specific user's click?

This is solved by **Distributed Tracing** (using standards like OpenTelemetry and tools like Jaeger or Zipkin).

## The Correlation ID

The entire concept of distributed tracing relies on a single string: the Correlation ID (or Trace ID).

### The Flow
1. **The Entry Point**: When the user clicks "Checkout", the request hits the API Gateway. The Gateway notices there is no `X-Correlation-ID` header. So, it generates a unique UUID (e.g., `trace-123abc`).
2. **Propagation**: The Gateway sends the request to the `Order` service, explicitly injecting `X-Correlation-ID: trace-123abc` into the HTTP headers.
3. **The Rule**: Every single microservice is programmed with a strict rule: *If you receive an incoming HTTP request, you must extract the Correlation ID, include it in every single log you write to `stdout`, and inject it into the headers of any outgoing HTTP requests you make.*
4. **The Database**: The `Order` service calls `Payment` and `Inventory`, passing `trace-123abc` to both.

### The Result
Now, when the developer logs into their centralized logging system (Kibana) and searches for `"trace-123abc"`, they instantly see every single log statement, from every single microservice, that was part of that exact user's request, perfectly ordered by timestamp.

## Traces and Spans

Distributed Tracing tools visualize this data.
- **A Trace**: Represents the entire journey of the request from start to finish.
- **A Span**: Represents the time spent within a specific service or component. 

A Trace is made up of multiple Spans.

When you look at a Trace in Jaeger, you see a Gantt chart. You can visually see:
- Gateway took 5ms.
- Order Service took 5000ms.
  - Call to Inventory took 50ms.
  - Call to Payment took 4945ms.

Instantly, without looking at a single line of code, you know the `Payment` service is the bottleneck.

## Implementation

Manually writing code to extract and inject Correlation IDs in every service is tedious. In modern architectures, a **Service Mesh** (like Istio) automatically handles the extraction and propagation of tracing headers without requiring application code changes.

## Summary
- Finding the root cause of an error or latency spike across microservices is nearly impossible without Distributed Tracing.
- A **Correlation ID** is generated at the Gateway and passed through HTTP headers to every downstream service.
- It allows developers to visualize the entire lifecycle of a request as a series of **Spans** forming a complete **Trace**.
