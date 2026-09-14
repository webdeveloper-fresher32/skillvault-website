# API Gateways (North-South Traffic)

In a microservices architecture, you might have 50 different services running. If a mobile app or web front-end needs to display a user's dashboard, it cannot be expected to know the IP addresses of all 50 services and make 50 individual API calls.

To solve this, we introduce an **API Gateway**.

## What is an API Gateway?

An API Gateway is a server that sits between the client (web/mobile app) and the microservices backend. It acts as the single entry point for all external traffic. This type of traffic (Client entering the Server ecosystem) is called **North-South Traffic**.

### Key Responsibilities

1. **Routing**: The Gateway receives a request to `api.myapp.com/orders` and routes it to the internal IP address of the `Order Service`.
2. **Authentication / Authorization**: Instead of every microservice verifying JWT tokens, the Gateway validates the token once. If valid, it forwards the request to the internal service. If invalid, it rejects the request before it even enters the internal network.
3. **Rate Limiting**: It prevents abuse by limiting how many requests a specific client or IP can make per second.
4. **SSL Termination**: The Gateway decrypts HTTPS traffic into HTTP before sending it to the internal services, saving the internal services from CPU-heavy decryption work.
5. **API Composition (BFF)**: Sometimes, the Gateway acts as a Backend-For-Frontend (BFF). If a mobile client requests `/dashboard`, the Gateway might synchronously call the `User`, `Order`, and `Billing` services, aggregate the JSON, and return a single payload to the client.

## Popular API Gateways

- **AWS API Gateway**: Fully managed cloud native gateway.
- **Kong**: Open-source, highly performant gateway built on Nginx.
- **NGINX / HAProxy**: Traditional load balancers often configured to act as basic API gateways.
- **Spring Cloud Gateway**: Popular in Java ecosystems.

## The Danger: The "God" Gateway

A common anti-pattern is pushing business logic into the API Gateway. 

If you start writing code in the Gateway to transform data formats, calculate discounts, or enforce complex domain rules, the Gateway becomes a Monolith (similar to the ESB from the SOA era). 

**Rule of Thumb:** The API Gateway should only handle cross-cutting concerns (security, routing, rate limiting). It should *never* contain domain business logic.
