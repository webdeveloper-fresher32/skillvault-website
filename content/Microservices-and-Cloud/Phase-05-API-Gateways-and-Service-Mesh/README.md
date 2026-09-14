# Phase 05: API Gateways and Service Mesh

As your microservices ecosystem grows from 5 services to 50 or 500, managing the network traffic between them and the outside world becomes a massive operational burden.

Clients need a single entry point, services need to know where other services live dynamically, and security policies must be enforced universally.

## Learning Objectives

By the end of this phase, you will understand:
- The role of an API Gateway in routing external traffic into the cluster.
- How Service Discovery eliminates the need for hardcoded IP addresses.
- What a Service Mesh is, why it exists, and how it differs from an API Gateway.

## Files in this Phase

1. `01-API-Gateways.md`: Handling North-South traffic (Client to Server).
2. `02-Service-Discovery.md`: Dynamic routing and health checking (e.g., Consul, Eureka).
3. `03-Service-Mesh.md`: Handling East-West traffic (Server to Server) with sidecar proxies (e.g., Istio, Linkerd).
