# Spring Boot Actuator — Complete Guide

## Table of Contents

1. [Why Actuator Exists](#1-why-actuator-exists)
2. [Enabling Actuator](#2-enabling-actuator)
3. [Exposing Endpoints](#3-exposing-endpoints)
4. [The /health Endpoint](#4-the-health-endpoint)
5. [The /info Endpoint](#5-the-info-endpoint)
6. [The /metrics Endpoint](#6-the-metrics-endpoint)
7. [The /env and /beans Endpoints](#7-the-env-and-beans-endpoints)
8. [Writing a Custom HealthIndicator](#8-writing-a-custom-healthindicator)
9. [Securing Actuator Endpoints](#9-securing-actuator-endpoints)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Actuator Exists

A running Spring Boot application is, by default, a black box from the outside. A load balancer needs to know whether an instance is healthy enough to receive traffic. An operator debugging a production incident needs to know what configuration actually loaded, what beans exist, and what the JVM's memory usage looks like right now. A monitoring stack needs a machine-readable stream of metrics it can scrape every fifteen seconds. None of that is possible if the only way to inspect the application is to read its source code.

Spring Boot Actuator is a sub-project that adds production-ready operational endpoints to an application with almost no code. It exposes health, metrics, configuration, and diagnostic information over HTTP (and JMX), so the same artifact that runs your business logic can also answer "are you healthy?" and "what is your current heap usage?".

```
  Without Actuator                         With Actuator
  ┌───────────────────┐                    ┌───────────────────┐
  │  Spring Boot App   │                    │  Spring Boot App   │
  │                     │                    │                     │
  │  /api/orders        │                    │  /api/orders        │
  │  /api/users          │                   │  /api/users          │
  │                     │                    │                     │
  │  (opaque to ops)     │                   │  /actuator/health    │
  │                     │                    │  /actuator/info      │
  │                     │                    │  /actuator/metrics   │
  │                     │                    │  /actuator/env       │
  │                     │                    │  /actuator/beans     │
  └───────────────────┘                    └───────────────────┘
```

Actuator is not optional in any real deployment. Kubernetes liveness/readiness probes, load balancer health checks, and Prometheus scraping all assume Actuator (or an equivalent) is present.

---

## 2. Enabling Actuator

Actuator ships as a starter dependency. Adding it to the build is the entire "enablement" step — no annotations are required.

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

```gradle
// build.gradle
implementation 'org.springframework.boot:spring-boot-starter-actuator'
```

As soon as this dependency is on the classpath and the application starts, Actuator auto-configures a set of endpoints. By default, only `/actuator/health` is exposed over HTTP; everything else must be explicitly opted into (see the next section). This "secure by default" posture is intentional — Actuator endpoints can leak sensitive information (environment variables, bean graphs, full stack traces) if left wide open.

Verify it is working:

```bash
curl http://localhost:8080/actuator/health
# {"status":"UP"}
```

If Spring Security is also on the classpath, `/actuator/health` will still be reachable by default (Spring Boot auto-configures a permissive rule for the base health endpoint), but every other Actuator endpoint requires authentication once Security is present — see [Section 9](#9-securing-actuator-endpoints).

---

## 3. Exposing Endpoints

Actuator ships with roughly 20 built-in endpoints (`health`, `info`, `metrics`, `env`, `beans`, `mappings`, `loggers`, `threaddump`, `heapdump`, `shutdown`, `prometheus` when Micrometer's Prometheus registry is present, and more). Almost all of them are disabled over HTTP by default and must be explicitly included via `management.endpoints.web.exposure.include`.

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, env, beans, mappings
        # exclude: env   # can also explicitly exclude from a wildcard include
  endpoint:
    health:
      show-details: when-authorized   # never | when-authorized | always
      show-components: when-authorized
    shutdown:
      enabled: false   # the shutdown endpoint is dangerous; keep it off
```

`include: "*"` exposes every endpoint — this is convenient in local development but must never be used as-is in production, because it also exposes `shutdown` (which lets any caller terminate the JVM) and `heapdump` (which can leak secrets embedded in memory, such as passwords or tokens sitting in a `String` field).

```yaml
# A realistic production posture
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, prometheus
  endpoint:
    health:
      show-details: when-authorized
```

The management port can also be moved off the main application port entirely, so Actuator is only reachable on an internal network interface that the public load balancer never touches:

```yaml
management:
  server:
    port: 9001            # Actuator serves on 9001, business API stays on 8080
    address: 127.0.0.1     # bind only to loopback / internal interface
```

This is a very common production pattern: the public-facing port serves only `/api/**`, and a separate internal-only port serves `/actuator/**`, so no ingress rule change can accidentally expose it externally.

---

## 4. The /health Endpoint

`/actuator/health` aggregates the status of every registered `HealthIndicator` into a single overall status: `UP`, `DOWN`, `OUT_OF_SERVICE`, or `UNKNOWN`. Spring Boot auto-registers indicators for infrastructure it detects on the classpath — a `DataSource` gets a `db` indicator, a configured `RedisConnectionFactory` gets a `redis` indicator, disk space gets a `diskSpace` indicator, and so on.

```bash
curl http://localhost:8080/actuator/health
```

```json
{
  "status": "UP"
}
```

With `show-details: always` (or `when-authorized` and an authenticated caller), the response expands to show each component:

```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP",
      "details": { "database": "PostgreSQL", "validationQuery": "isValid()" }
    },
    "diskSpace": {
      "status": "UP",
      "details": { "total": 494384795648, "free": 300884795648, "threshold": 10485760 }
    },
    "paymentService": {
      "status": "UP",
      "details": { "latencyMs": 42 }
    },
    "ping": { "status": "UP" }
  }
}
```

If any component reports `DOWN`, the aggregate status becomes `DOWN`, and Spring Boot maps that to HTTP 503 on the `/actuator/health` response — which is exactly the signal a Kubernetes liveness/readiness probe or a load balancer health check is looking for.

Liveness and readiness can also be split into separate groups, which matters a great deal in Kubernetes: liveness should only fail when the process itself is broken (restart won't help otherwise get worse), while readiness should fail whenever a downstream dependency is unavailable (so traffic is routed away without killing the pod).

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true
  health:
    livenessstate:
      enabled: true
    readinessstate:
      enabled: true
```

```bash
curl http://localhost:8080/actuator/health/liveness
curl http://localhost:8080/actuator/health/readiness
```

---

## 5. The /info Endpoint

`/actuator/info` exposes arbitrary static or build-time metadata about the application — version, git commit, build timestamp, custom key/value pairs. Unlike `/health`, it contains no live logic; it just surfaces whatever configuration or build metadata is present.

```yaml
# application.yml
info:
  app:
    name: order-service
    description: Order management API
  team: platform-eng
```

```bash
curl http://localhost:8080/actuator/info
```

```json
{
  "app": { "name": "order-service", "description": "Order management API" },
  "team": "platform-eng"
}
```

Build and git metadata can be added automatically with build-plugin support, without hand-writing version numbers into `application.yml`:

```xml
<!-- pom.xml — generates META-INF/build-info.properties which Actuator picks up automatically -->
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <executions>
        <execution>
            <goals>
                <goal>build-info</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

```yaml
management:
  info:
    env:
      enabled: true
    git:
      mode: full   # include full git details, not just the commit id
```

The `git-commit-id-maven-plugin` (or the Gradle equivalent) generates `git.properties`, which Actuator also merges into `/actuator/info` automatically when present — a very common way to answer "which commit is running in production?" without SSHing into a box.

---

## 6. The /metrics Endpoint

`/actuator/metrics` is backed by Micrometer, Spring Boot's metrics facade. It exposes a catalog of metric names, and each metric can be queried individually for its current value plus available dimensions (tags).

```bash
curl http://localhost:8080/actuator/metrics
```

```json
{
  "names": [
    "jvm.memory.used", "jvm.gc.pause", "http.server.requests",
    "process.cpu.usage", "hikaricp.connections.active", "logback.events"
  ]
}
```

```bash
curl http://localhost:8080/actuator/metrics/http.server.requests
```

```json
{
  "name": "http.server.requests",
  "measurements": [
    { "statistic": "COUNT", "value": 1284 },
    { "statistic": "TOTAL_TIME", "value": 12.481 },
    { "statistic": "MAX", "value": 0.084 }
  ],
  "availableTags": [
    { "tag": "method", "values": ["GET", "POST"] },
    { "tag": "status", "values": ["200", "404", "500"] },
    { "tag": "uri", "values": ["/api/orders", "/api/orders/{id}"] }
  ]
}
```

A single tag can be drilled into with a query parameter:

```bash
curl "http://localhost:8080/actuator/metrics/http.server.requests?tag=status:500"
```

`/actuator/metrics` is a human-readable JSON view intended for ad-hoc inspection. It is not what a real monitoring stack scrapes — that role belongs to `/actuator/prometheus`, covered in [Lesson 03](./03-Packaging-Observability-and-Deployment.md), which exports the same underlying Micrometer registry in the Prometheus exposition text format.

---

## 7. The /env and /beans Endpoints

`/actuator/env` dumps every `PropertySource` Spring resolved at startup — `application.yml`, environment variables, system properties, command-line args — along with the final resolved value for each key. This is the single most useful endpoint for debugging "why is my configuration not what I expect," because it shows exactly which source won for a given property.

```bash
curl http://localhost:8080/actuator/env
```

```json
{
  "activeProfiles": ["prod"],
  "propertySources": [
    { "name": "systemEnvironment", "properties": {
        "SPRING_DATASOURCE_PASSWORD": { "value": "******", "origin": "System Environment Property..." }
    }},
    { "name": "applicationConfig: [classpath:/application-prod.yml]", "properties": {
        "server.port": { "value": 8080 }
    }}
  ]
}
```

Sensitive values (anything matching a pattern like `password`, `secret`, `key`, `token`, `credentials`) are automatically sanitized (`******`) by Spring Boot's `Sanitizer` unless `management.endpoint.env.show-values` is explicitly set to `always` — never do that in production.

A single property can be looked up directly: `curl http://localhost:8080/actuator/env/server.port`.

`/actuator/beans` dumps the entire Spring `ApplicationContext` bean graph — every bean's id, type, scope, and dependencies. It is invaluable when debugging "why did my bean not get created" or "why are there two beans of this type," but it is also one of the most information-dense endpoints Actuator has, so it must never be reachable without authentication.

```bash
curl http://localhost:8080/actuator/beans | jq '.contexts.application.beans.orderService'
```

```json
{
  "aliases": [],
  "scope": "singleton",
  "type": "com.example.orders.service.OrderService",
  "resource": "class path resource [com/example/orders/service/OrderService.class]",
  "dependencies": ["orderRepository", "paymentClient"]
}
```

---

## 8. Writing a Custom HealthIndicator

Spring Boot's built-in indicators cover common infrastructure (database, disk, message brokers), but they know nothing about your application's actual business dependencies — a third-party payment gateway, a partner's REST API, a legacy SOAP service. For those, you implement `HealthIndicator` yourself and Spring Boot automatically folds it into the aggregate `/actuator/health` response, keyed by the bean name (minus the `HealthIndicator` suffix).

```java
package com.example.orders.health;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;

@Component("paymentGateway")
public class PaymentGatewayHealthIndicator implements HealthIndicator {

    private final RestClient restClient;

    public PaymentGatewayHealthIndicator(RestClient.Builder builder) {
        this.restClient = builder
                .baseUrl("https://payments.internal.example.com")
                .build();
    }

    @Override
    public Health health() {
        Instant start = Instant.now();
        try {
            restClient.get()
                    .uri("/health")
                    .retrieve()
                    .toBodilessEntity();

            long latencyMs = Duration.between(start, Instant.now()).toMillis();

            if (latencyMs > 2000) {
                // Reachable, but slow enough to be a leading indicator of trouble.
                return Health.status("DEGRADED")
                        .withDetail("latencyMs", latencyMs)
                        .withDetail("threshold", "2000ms")
                        .build();
            }

            return Health.up()
                    .withDetail("latencyMs", latencyMs)
                    .build();

        } catch (RestClientException ex) {
            return Health.down(ex)
                    .withDetail("endpoint", "https://payments.internal.example.com/health")
                    .build();
        }
    }
}
```

Registering a custom `DEGRADED` status also requires telling Spring Boot how to map it to an HTTP status code, since it doesn't know about it out of the box:

```yaml
management:
  endpoint:
    health:
      status:
        order: DOWN, OUT_OF_SERVICE, DEGRADED, UNKNOWN, UP
        http-mapping:
          DEGRADED: 200   # still serve traffic, but surface it as a warning signal
```

With this in place, `/actuator/health` now includes a `paymentGateway` component, and — crucially — if this indicator reports `DOWN`, the overall application health becomes `DOWN` too, which a Kubernetes readiness probe will act on by removing the pod from the Service's endpoint list until the payment gateway recovers.

```json
{
  "status": "UP",
  "components": {
    "paymentGateway": { "status": "UP", "details": { "latencyMs": 41 } },
    "db": { "status": "UP" }
  }
}
```

For reactive applications, implement `ReactiveHealthIndicator` instead, returning `Mono<Health>` — the wiring is otherwise identical.

A subtlety worth internalizing: not every dependency should gate readiness. A health check that fails hard the instant a rarely-used downstream analytics service blips will cause your whole service to be pulled from rotation for something that barely matters. Reserve `Health.down()` for dependencies that genuinely make your service unable to do its job; for everything else, log the failure and report `UP` (or a custom non-fatal status) instead.

---

## 9. Securing Actuator Endpoints

Actuator endpoints must never be reachable by an unauthenticated caller in any environment that is not a throwaway sandbox. `/actuator/env`, `/actuator/beans`, and `/actuator/heapdump` can leak database credentials, internal topology, and secrets embedded in memory. `/actuator/shutdown`, if enabled, lets anyone kill the process. Treat Actuator as an administrative surface, not a public API.

If Spring Security is on the classpath, secure Actuator with a dedicated filter chain (or rule set) so it is governed independently of your business API's security rules:

```java
package com.example.orders.config;

import org.springframework.boot.actuate.autoconfigure.security.servlet.EndpointRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class ActuatorSecurityConfig {

    @Bean
    @Order(1) // evaluate this chain before the general application security chain
    public SecurityFilterChain actuatorSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .securityMatcher(EndpointRequest.toAnyEndpoint())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(EndpointRequest.to("health", "info")).permitAll()
                .anyRequest().hasRole("ACTUATOR_ADMIN")
            )
            .httpBasic(basic -> {}) // or reuse your existing JWT/OAuth2 resource server config
            .csrf(csrf -> csrf.disable()); // Actuator endpoints are not browser form targets

        return http.build();
    }
}
```

`EndpointRequest.toAnyEndpoint()` scopes this filter chain to `/actuator/**` only, so it does not interfere with your application's own security rules on `/api/**`. `EndpointRequest.to("health", "info")` lets those two low-sensitivity endpoints stay open (useful for load balancer health checks that cannot authenticate), while everything else requires the `ACTUATOR_ADMIN` role.

In practice, most production deployments layer two defenses rather than relying on Spring Security alone:

1. **Network isolation** — put Actuator on a separate management port bound to an internal interface (shown in [Section 3](#3-exposing-endpoints)), so it is unreachable from the public internet regardless of application-level auth.
2. **Application-level auth** — the filter chain above, as defense in depth in case the network boundary is ever misconfigured.

```yaml
# A minimal, defensible production baseline
management:
  server:
    port: 9001
    address: 127.0.0.1
  endpoints:
    web:
      exposure:
        include: health, info, metrics, prometheus
  endpoint:
    health:
      show-details: when-authorized
    shutdown:
      enabled: false
```

Never expose `/actuator/heapdump` or `/actuator/threaddump` outside of an authenticated, internal-only context — a heap dump is effectively a full memory snapshot and may contain plaintext secrets that were only ever meant to live transiently in a `String`.

---

## 10. Common Pitfalls

- **`management.endpoints.web.exposure.include: "*"` shipped to production.** This exposes `shutdown` and `heapdump` by default alongside everything else — a wildcard include should only ever be used locally.
- **Assuming `/actuator/health` returning `UP` means Actuator is secured.** The base health endpoint is deliberately public by default; every *other* endpoint needs its own exposure and auth decision.
- **Custom `HealthIndicator` throwing an uncaught exception.** An indicator that lets an exception escape `health()` will make Actuator itself report `DOWN` with a generic error rather than the meaningful detail you intended — always catch expected exceptions and translate them into `Health.down(ex)`.
- **Gating readiness on a non-critical dependency.** Wiring a health check for a "nice to have" downstream service directly into the aggregate status can cause a healthy application to be pulled from load balancer rotation over a dependency that doesn't actually block core functionality.
- **Forgetting `show-details: when-authorized` and instead using `always`.** `always` leaks internal topology (database vendor, connection pool internals, third-party hostnames) to any unauthenticated caller who can reach `/actuator/health`.
- **Running the management port on the same port as the business API without any auth.** If `management.server.port` is not set, Actuator endpoints live under `/actuator/**` on the exact same port as your public API — meaning a single ingress misconfiguration exposes both.

---

## 11. Best Practices

- Expose the minimum set of endpoints required: typically `health`, `info`, `metrics`, and `prometheus`. Everything else should be included only when actively needed for debugging, and only behind authentication.
- Bind the management port to an internal-only network interface whenever the deployment topology supports it, so Actuator is unreachable from outside the cluster/VPC regardless of application-level auth bugs.
- Split `/actuator/health/liveness` and `/actuator/health/readiness` in any Kubernetes deployment — do not point both probes at the same aggregate `/actuator/health`, since a slow downstream dependency should affect readiness, not trigger a pointless restart via liveness.
- Write custom `HealthIndicator`s only for dependencies whose failure genuinely means "this instance cannot serve its purpose" — not every downstream call needs to gate the aggregate status.
- Keep `management.endpoint.shutdown.enabled` false unless you have a specific, tightly-controlled operational reason to enable it (and even then, gate it behind strong auth).
- Treat `/actuator/env` and `/actuator/beans` as administrative-only, always behind authentication — never rely solely on obscurity ("nobody will guess the path").
- Add build/git metadata to `/actuator/info` via the Maven/Gradle plugin support rather than hand-maintaining version strings — it eliminates an entire class of "which build is this?" incidents.

---

## 12. Hands-On Exercises

**Exercise 1:** Add `spring-boot-starter-actuator` to an existing Spring Boot project. Start the app and confirm `curl http://localhost:8080/actuator/health` returns `{"status":"UP"}`. Then set `management.endpoints.web.exposure.include: health, info, metrics` and confirm `/actuator/metrics` now returns a JSON list of metric names, while an endpoint you did not include (e.g. `/actuator/beans`) returns HTTP 404.

**Exercise 2:** Populate `/actuator/info` with at least three custom keys under the `info:` prefix in `application.yml`. Add the `spring-boot-maven-plugin`'s `build-info` goal (or the Gradle equivalent) and confirm `/actuator/info` now also includes a `build` section with `version`, `artifact`, and `time`.

**Exercise 3:** Implement a custom `HealthIndicator` (following the pattern in [Section 8](#8-writing-a-custom-healthindicator)) that checks connectivity to any external HTTP endpoint of your choosing (a public API is fine for practice). Force it to fail by pointing it at an unreachable host, and confirm the aggregate `/actuator/health` status flips to `DOWN` and returns HTTP 503.

**Exercise 4:** Add Spring Security to the project and write an Actuator-specific `SecurityFilterChain` using `EndpointRequest.toAnyEndpoint()` that permits `health` and `info` unauthenticated but requires HTTP Basic auth with role `ACTUATOR_ADMIN` for everything else. Confirm `/actuator/metrics` returns 401 without credentials and 200 with correct credentials.

**Exercise 5:** Move Actuator to a separate management port (`management.server.port: 9001`) bound to `127.0.0.1`. Confirm `curl http://localhost:8080/actuator/health` now fails (connection refused, since the business API port no longer serves Actuator) while `curl http://localhost:9001/actuator/health` succeeds.

---

## 13. Interview Q&A

**Q: Why does Spring Boot only expose `/actuator/health` by default, and not the other endpoints?**
Answer: Actuator endpoints expose operationally sensitive information — environment variables and secrets via `/env`, the full dependency graph via `/beans`, memory contents via `/heapdump`, and the ability to terminate the process via `/shutdown`. Spring Boot defaults to exposing only the low-sensitivity `health` endpoint over HTTP and requires every other endpoint to be explicitly opted into via `management.endpoints.web.exposure.include`, so that adding the Actuator starter can never silently turn into an information disclosure or remote-shutdown vulnerability.

**Q: How would you make a custom health check affect a Kubernetes readiness probe but not a liveness probe?**
Answer: Enable `management.endpoint.health.probes.enabled: true` and point the readiness probe at `/actuator/health/readiness` and the liveness probe at `/actuator/health/liveness`. A custom `HealthIndicator` participates in the general aggregate `/actuator/health` group by default; whether it also affects the `readiness` group specifically depends on how the health groups are configured (custom indicators can be assigned to the `readiness` group explicitly). The key design decision is that liveness should only fail for problems a restart can fix (deadlock, unrecoverable internal state), while readiness should fail whenever an external dependency is temporarily unavailable, so traffic is routed away without needlessly killing and restarting a perfectly healthy process.

**Q: What is the risk of setting `management.endpoints.web.exposure.include: "*"` in production?**
Answer: The wildcard exposes every built-in Actuator endpoint over HTTP, including `shutdown` (lets any caller with network access terminate the JVM), `heapdump` (a full memory snapshot that can contain plaintext secrets), and `env`/`beans` (full configuration and dependency graph disclosure). Even with Spring Security in front of it, a wildcard include removes the safety net of "endpoints must be explicitly opted into," so a security misconfiguration elsewhere becomes much more dangerous. Production configurations should enumerate an explicit, minimal include list.

**Q: How do you prevent Actuator's `/env` endpoint from leaking a database password?**
Answer: Spring Boot's built-in `Sanitizer` automatically masks property values whose keys match common sensitive patterns (`password`, `secret`, `key`, `token`, `credentials`, etc.), replacing the value with `******` in the `/actuator/env` response. This happens automatically and does not need to be configured — what does need attention is never setting `management.endpoint.env.show-values` to `always`, which disables sanitization entirely, and never naming a custom property in a way that evades the sanitizer's pattern matching (e.g. calling a secret `dbPass` might not match, while `db.password` reliably will).

**Q: What's the difference between the `/actuator/metrics` and `/actuator/prometheus` endpoints?**
Answer: Both are backed by the same underlying Micrometer `MeterRegistry`, but they serve different consumers. `/actuator/metrics` is a human-readable JSON API meant for ad-hoc inspection — list all metric names, then drill into one metric with optional tag filters. `/actuator/prometheus` (added by the `micrometer-registry-prometheus` dependency) exports the entire registry in the Prometheus text exposition format in a single response, which is what a Prometheus server actually scrapes on an interval. In production you configure Prometheus to scrape the latter; the former is a debugging tool for a human at a terminal.

**Q: Why should Actuator run on a separate port from the business API in a production deployment?**
Answer: Binding `management.server.port` to a different, internal-only port (and address) means Actuator's operationally sensitive endpoints are physically unreachable from whatever network path exposes the public API — a public-facing load balancer or ingress rule simply has no route to the management port. This provides defense in depth: even if an application-level security rule is misconfigured or forgotten, the network topology itself prevents external access to `/actuator/env`, `/actuator/beans`, or any other sensitive endpoint.
