# Phase 12: Production and Actuator

> The final phase of the Spring Boot course — taking an application from "it works on my machine" to a service that is observable, configurable, and deployable in a real production environment.

## What You'll Learn

Every Spring Boot application you have built so far has run with a single, hardcoded configuration and no way for an operator to see what is happening inside it at runtime. This phase closes that gap. You will learn how to expose operational insight into a running application with Spring Boot Actuator, how to manage configuration safely across dev/staging/production environments without leaking secrets, and how to package and ship the application as a production-ready container image with structured logs, exported metrics, and a graceful shutdown path.

By the end of this phase you will be able to take any Spring Boot service built in Phases 01–11 and make it operable by a platform team: it will report its health, expose metrics that a monitoring stack can scrape, load different configuration per environment without code changes, and shut down cleanly during a rolling deployment.

## Learning Objectives

- Enable and configure Spring Boot Actuator, and understand exactly which endpoints are safe to expose publicly and which are not.
- Implement a custom `HealthIndicator` that reports the health of a downstream dependency (database, message broker, external API).
- Secure Actuator endpoints with Spring Security so operational data is never exposed unauthenticated.
- Use Spring Profiles (`@Profile`, `application-{profile}.yml`, `spring.profiles.active`) to run the same artifact against different environments.
- Externalize secrets via environment variables instead of committing them to `application.yml`.
- Bind configuration to type-safe `@ConfigurationProperties` classes with validation, and understand when to prefer it over `@Value`.
- Understand Spring's configuration property precedence order end-to-end.
- Build an executable JAR (and understand when a WAR is still needed), and use layered JARs so Docker image layers cache efficiently.
- Configure structured JSON logging suitable for a log aggregation pipeline.
- Export application metrics in Prometheus format via Micrometer and `/actuator/prometheus`.
- Configure graceful shutdown so in-flight requests complete before the JVM exits during a deployment.
- Write a production-grade multi-stage Dockerfile for a Spring Boot application.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Spring-Boot-Actuator.md](./01-Spring-Boot-Actuator.md) | Spring Boot Actuator | 4-5 hours |
| [02-Profiles-and-Configuration-Management.md](./02-Profiles-and-Configuration-Management.md) | Profiles and Configuration Management | 4-5 hours |
| [03-Packaging-Observability-and-Deployment.md](./03-Packaging-Observability-and-Deployment.md) | Packaging, Observability, and Deployment | 5-6 hours |

## Estimated Time

**2 days** (approximately 14-16 hours of focused study and hands-on practice)

## Previous Phase

[Phase 11: Microservices Basics](../Phase-11-Microservices-Basics/README.md)

---

This is the final phase of the Spring Boot course. From here:

- Head to **[Quick-Reference](../Quick-Reference/)** for the consolidated cheatsheet and the full set of 50 interview questions spanning every phase of this course.
- Head to **[Projects](../Projects/)** to apply everything you've learned — including the production concerns covered in this phase — to complete, end-to-end builds like the Blog API and E-commerce backend.
