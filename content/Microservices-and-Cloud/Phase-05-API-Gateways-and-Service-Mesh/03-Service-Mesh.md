# Service Mesh (East-West Traffic)

While an API Gateway handles traffic coming from the outside world into your cluster (North-South traffic), it is not well-suited for managing traffic *between* internal microservices (East-West traffic).

For internal service-to-service communication, the modern architectural standard is the **Service Mesh**.

## The Problem

When `Service A` calls `Service B` over the network, a lot can go wrong.
- The network is not secure (data is in plaintext).
- `Service B` might be slow, causing `Service A` to time out.
- `Service A` needs to know how to retry failed requests without overwhelming `Service B`.
- You need to collect metrics on how long the call took (Distributed Tracing).

Historically, developers had to write all this logic (retries, timeouts, circuit breakers, TLS encryption) directly into the application code of *every single microservice*, using libraries like Netflix Hystrix. This was a nightmare to maintain across multiple programming languages.

## The Service Mesh Solution

A Service Mesh extracts all of this complex network logic *out* of the application code and pushes it down into the infrastructure layer.

The most famous implementations are **Istio** and **Linkerd**.

### The Sidecar Proxy Pattern

A Service Mesh operates using the **Sidecar Pattern**. 

1. Next to every single microservice instance, the Service Mesh deploys a tiny, high-performance proxy (like Envoy). This is the "Sidecar".
2. Your application code no longer talks to the network directly. 
3. When `Service A` wants to call `Service B`, `Service A` actually just sends a local request to its own Sidecar.
4. The Sidecar intercepts the request, encrypts it (mTLS), adds tracing headers, handles retries, and sends it over the network to `Service B`'s Sidecar.
5. `Service B`'s Sidecar decrypts the request and hands it to the `Service B` application code.

### Benefits of a Service Mesh

Because the Sidecar proxies intercept 100% of the network traffic between all services, they can enforce powerful rules globally without requiring a single line of code change in your applications:

1. **Mutual TLS (mTLS)**: All traffic between services is automatically encrypted. If a hacker breaches your internal network, they cannot read the traffic.
2. **Advanced Routing (Canary Deployments)**: You can tell the Service Mesh: "Route 90% of traffic to v1 of the Order Service, and 10% to v2."
3. **Resiliency**: The mesh automatically handles retries, timeouts, and circuit breaking.
4. **Observability**: Because all traffic passes through the proxies, the Service Mesh automatically generates detailed metrics and distributed tracing data (showing exactly how data flows through the system).

## API Gateway vs. Service Mesh

- **API Gateway**: Focuses on North-South traffic. Exposes your APIs to the public internet, handles user authentication (JWTs), rate limits external users, and acts as the front door.
- **Service Mesh**: Focuses on East-West traffic. Secures and observes the internal network traffic *between* your microservices. Handles mTLS, internal retries, and sidecar proxying.

## Summary
- A Service Mesh uses **Sidecar Proxies** attached to every microservice.
- It abstracts network complexity (encryption, retries, tracing) away from application code.
- Popular meshes include Istio and Linkerd.
