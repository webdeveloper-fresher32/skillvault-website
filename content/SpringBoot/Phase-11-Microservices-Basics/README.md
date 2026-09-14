# Phase 11: Microservices Basics

## What You'll Learn

An introduction to building and consuming microservices with Spring Boot. Real systems are rarely a single monolithic application — they're a collection of independently deployable services that talk to each other over HTTP, need to find each other at runtime, must survive partial failures gracefully, and must be configured differently per environment without rebuilding a JAR. This phase covers the foundational building blocks: synchronous HTTP clients (`RestTemplate`, `RestClient`, `WebClient`), service discovery concepts and resilience patterns with Resilience4j, and externalized configuration with Spring Cloud Config Server.

This phase is intentionally scoped to *basics*. It does not cover full Spring Cloud Netflix/Eureka cluster setup, Kubernetes-native service meshes, or event-driven microservices with Kafka — those are advanced topics for a dedicated microservices/cloud-native course. The goal here is to understand the problems microservices architectures create and the standard Spring Boot idioms used to solve them, so that you can read, extend, and reason about a real multi-service Spring Boot system.

## Learning Objectives

- Call downstream HTTP services using `RestTemplate`, the modern `RestClient`, and the reactive `WebClient`
- Configure connection/read timeouts and retries on each client, and know when to choose blocking vs reactive
- Explain why hardcoded service URLs break down in a multi-instance, auto-scaled environment
- Describe conceptually how client-side service discovery (Eureka/Consul-style) works
- Apply Resilience4j's `@CircuitBreaker`, `@Retry`, `@RateLimiter`, and bulkhead patterns to protect against cascading failures
- Write a fallback method that activates when a circuit breaker opens
- Explain why hardcoded configuration values don't scale across environments and instances
- Describe how Spring Cloud Config Server centralizes configuration in a Git repository
- Use profile-specific YAML files (`application-{profile}.yml`) to vary configuration per environment
- Use `@RefreshScope` to pick up configuration changes without restarting the application

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-REST-Clients-and-WebClient.md](01-REST-Clients-and-WebClient.md) | REST Clients — RestTemplate, RestClient, and WebClient | 1 day |
| [02-Service-Discovery-and-Resilience.md](02-Service-Discovery-and-Resilience.md) | Service Discovery Concepts and Resilience4j Patterns | 1 day |
| [03-Externalized-Config-and-Config-Server.md](03-Externalized-Config-and-Config-Server.md) | Externalized Configuration and Spring Cloud Config Server | 1 day |

## Estimated Time

3 days

## Previous Phase

→ [Phase 10: Caching and Async](../Phase-10-Caching-and-Async/README.md)

## Next Phase

→ [Phase 12: Production and Actuator](../Phase-12-Production-and-Actuator/README.md)
