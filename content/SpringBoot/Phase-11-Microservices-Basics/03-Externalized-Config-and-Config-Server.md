# Externalized Configuration and Spring Cloud Config Server — Complete Guide

## Table of Contents
1. [Why Hardcoded Configuration Doesn't Scale](#1-why-hardcoded-configuration-doesnt-scale)
2. [Spring's Externalized Configuration Basics](#2-springs-externalized-configuration-basics)
3. [Profile-Specific Configuration](#3-profile-specific-configuration)
4. [Spring Cloud Config Server — Conceptual Overview](#4-spring-cloud-config-server--conceptual-overview)
5. [Setting Up a Config Server](#5-setting-up-a-config-server)
6. [Consuming Config From a Client Application](#6-consuming-config-from-a-client-application)
7. [Fallback to Local Defaults](#7-fallback-to-local-defaults)
8. [@RefreshScope — Picking Up Changes Without Restart](#8-refreshscope--picking-up-changes-without-restart)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Hardcoded Configuration Doesn't Scale

A single Spring Boot application with one `application.yml` file is simple to configure — but that simplicity breaks down fast once a system has multiple services and multiple environments.

```
  One config file, multiplied by reality
  ┌──────────────────────────────────────────────────────────┐
  │  order-service    →  needs its own DB URL, feature flags  │
  │  customer-service →  needs its own DB URL, feature flags  │
  │  inventory-service→  needs its own DB URL, feature flags  │
  │                                                            │
  │  ...each one deployed to:                                  │
  │      dev  |  staging  |  production                        │
  │                                                            │
  │  = 3 services × 3 environments = 9 distinct configurations  │
  │    to keep correct, consistent, and in sync — by hand.      │
  └──────────────────────────────────────────────────────────┘
```

Specific problems that hardcoded, baked-in-the-JAR configuration creates:

- **Rebuild-to-reconfigure.** If a database URL or an external API key is hardcoded in `application.yml` and packaged into the JAR, changing it for a new environment means rebuilding and redeploying — turning a config change into a full release.
- **Config drift across instances.** If ten instances of a service are each configured independently (e.g., ten copies of a config file on ten machines), it's easy for them to silently diverge — one instance quietly running with an old feature flag value.
- **Secrets in version control.** Hardcoding a production database password directly into a file that gets committed to source control is both a common practice and a serious security risk.
- **No single source of truth.** When an incident happens and someone asks "what's the actual current timeout value in production right now," there's no reliable place to look if config lives scattered across deployed artifacts.
- **No audit trail.** A hardcoded value that changes on a server has no history — no record of who changed it, when, or why.

Externalized configuration solves this by moving configuration **out of the packaged application** and into environment variables, external files, or — for a multi-service system — a centralized configuration service that every instance reads from at startup (and optionally, on demand).

---

## 2. Spring's Externalized Configuration Basics

Spring Boot already supports externalized configuration without any Spring Cloud dependency, using a well-defined precedence order. From lowest to highest priority (higher overrides lower):

```
  Spring Boot configuration precedence (simplified, highest wins)
  ┌────────────────────────────────────────────────────────────┐
  │ 1. application.properties / application.yml (packaged in   │
  │    the JAR) — the baseline defaults                        │
  │ 2. Profile-specific files: application-{profile}.yml        │
  │ 3. Config files OUTSIDE the JAR (same directory as the      │
  │    JAR, or a configured external location)                  │
  │ 4. Environment variables                                    │
  │ 5. Command-line arguments (--server.port=8081)              │
  │ 6. Spring Cloud Config Server properties (if enabled) --     │
  │    fetched at startup, can take precedence depending on      │
  │    spring.config.import ordering                             │
  └────────────────────────────────────────────────────────────┘
```

The everyday building blocks:

```yaml
# application.yml — baseline defaults, safe to commit
spring:
  application:
    name: order-service

server:
  port: 8080

app:
  feature-flags:
    new-checkout-flow: false
  downstream:
    customer-service-timeout: 3s
```

```bash
# Environment variable override (common in containers) --
# SPRING_APPLICATION_JSON or individual relaxed-binding env vars
export APP_DOWNSTREAM_CUSTOMER_SERVICE_TIMEOUT=5s
export SERVER_PORT=8081
```

Spring's *relaxed binding* means `APP_DOWNSTREAM_CUSTOMER_SERVICE_TIMEOUT` (environment variable convention: upper snake case) automatically binds to `app.downstream.customer-service-timeout` (YAML convention: lower kebab case) — no manual mapping needed.

---

## 3. Profile-Specific Configuration

Profiles let one codebase carry different configuration values for different environments, activated by a single `spring.profiles.active` setting rather than by rebuilding anything.

```
application.yml              # shared defaults, always loaded
application-dev.yml          # overrides active only when profile "dev" is active
application-staging.yml      # overrides active only when profile "staging" is active
application-prod.yml         # overrides active only when profile "prod" is active
```

```yaml
# application.yml
spring:
  application:
    name: order-service

app:
  downstream:
    customer-service-timeout: 3s
  feature-flags:
    new-checkout-flow: false

logging:
  level:
    root: INFO
```

```yaml
# application-dev.yml
spring:
  config:
    activate:
      on-profile: dev

app:
  downstream:
    customer-service-timeout: 10s   # generous timeout for local debugging
  feature-flags:
    new-checkout-flow: true         # try new features locally first

logging:
  level:
    root: DEBUG
    com.example.orderservice: TRACE

spring:
  datasource:
    url: jdbc:h2:mem:orderdb
```

```yaml
# application-prod.yml
spring:
  config:
    activate:
      on-profile: prod

app:
  downstream:
    customer-service-timeout: 2s    # tight timeout, fail fast in production
  feature-flags:
    new-checkout-flow: false        # roll out gradually, off by default

logging:
  level:
    root: WARN

spring:
  datasource:
    url: ${DB_URL}                  # supplied via environment, never hardcoded
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
```

Activating a profile:

```bash
# Via command-line argument
java -jar order-service.jar --spring.profiles.active=prod

# Via environment variable (common in containers/Kubernetes)
export SPRING_PROFILES_ACTIVE=prod
java -jar order-service.jar
```

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.time.Duration;

@Component
public class DownstreamConfig {

    @Value("${app.downstream.customer-service-timeout}")
    private Duration customerServiceTimeout;

    public Duration getCustomerServiceTimeout() {
        return customerServiceTimeout;
    }
}
```

Notice that production secrets (`DB_USERNAME`, `DB_PASSWORD`) are referenced via `${...}` placeholders resolved from environment variables — never committed as literal values, even in a profile-specific file.

---

## 4. Spring Cloud Config Server — Conceptual Overview

Profiles solve "different config per environment" for a single service reading its own files. They do not solve "one centralized place to manage configuration for every service, across every environment, with version history and the ability to change a value without redeploying." That is what **Spring Cloud Config Server** provides.

```
  Centralized, Git-backed configuration
  ┌─────────────────────────────────────────────────────────┐
  │            Git Repository (config-repo)                  │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │ order-service.yml                                   │  │
  │  │ order-service-dev.yml                               │  │
  │  │ order-service-prod.yml                              │  │
  │  │ customer-service.yml                                │  │
  │  │ customer-service-prod.yml                           │  │
  │  │ application.yml   (shared defaults, ALL services)    │  │
  │  └───────────────────────────────────────────────────┘  │
  │           git commit history = config audit trail         │
  └───────────────────────┬───────────────────────────────────┘
                           │ reads
                           ▼
              ┌─────────────────────────┐
              │  Spring Cloud Config     │
              │       Server              │
              │  (serves config over      │
              │   HTTP as JSON/YAML)      │
              └──────────┬───────┬───────┘
                          │       │
        fetch at startup  │       │  fetch at startup
                          ▼       ▼
              ┌───────────────┐ ┌───────────────┐
              │ order-service  │ │customer-service│
              └───────────────┘ └───────────────┘
```

The Config Server itself is a thin HTTP layer over a Git repository (it can also back onto a filesystem, Vault, or a JDBC source, but Git is by far the most common). It exposes endpoints like `GET /order-service/prod` that return the merged configuration for a given application name and profile, resolved from the matching files in the repo (`order-service.yml` + `order-service-prod.yml`, with the profile-specific one taking precedence — the same merge semantics as local profile files, just centralized).

The key benefits over per-service local config files:

- **Single source of truth** — every environment's configuration for every service lives in one Git repository, reviewable via normal pull requests.
- **Full audit trail** — `git log` on the config repo shows exactly who changed what value and when.
- **No rebuild required** — updating a config value is a Git commit, not a code change; combined with `@RefreshScope` (Section 8), it doesn't even require a restart.
- **Consistency across instances** — every instance of a service fetches the same config from the same server, eliminating drift between instances that were configured independently.

---

## 5. Setting Up a Config Server

### Dependency

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-config-server</artifactId>
</dependency>
```

### Enabling the Server

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.config.server.EnableConfigServer;

@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(ConfigServerApplication.class, args);
    }
}
```

### Pointing at the Git Repository

```yaml
# config-server application.yml
server:
  port: 8888

spring:
  application:
    name: config-server
  cloud:
    config:
      server:
        git:
          uri: https://github.com/example-org/config-repo.git
          default-label: main
          clone-on-start: true
          # For private repos:
          # username: ${GIT_USERNAME}
          # password: ${GIT_TOKEN}
```

### Verifying the Server

Once running, the config server exposes configuration over HTTP using a `{application}/{profile}` URL pattern:

```bash
# Fetch merged config for order-service in the "prod" profile
curl http://localhost:8888/order-service/prod

# Fetch config for order-service with no profile (defaults only)
curl http://localhost:8888/order-service/default

# Fetch a specific file directly
curl http://localhost:8888/order-service-prod.yml
```

The response is JSON describing every property source that was merged, in priority order — useful for debugging exactly where a given value came from when multiple files could plausibly supply it.

---

## 6. Consuming Config From a Client Application

### Dependency

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-config</artifactId>
</dependency>
```

### Bootstrapping the Client (Spring Boot 3.x style)

In modern Spring Cloud (compatible with Boot 3.x), config import is declared with `spring.config.import` in `application.yml` rather than the older separate `bootstrap.yml` file:

```yaml
# order-service application.yml
spring:
  application:
    name: order-service     # used by the config server to find order-service*.yml
  config:
    import: "optional:configserver:http://localhost:8888"
  profiles:
    active: prod
```

The `optional:` prefix is important — without it, if the config server is unreachable at startup, the application **fails to start**. With `optional:`, the application logs a warning and falls back to whatever local configuration it has (see Section 7).

### Confirming What Was Loaded

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class ConfigStartupLogger implements CommandLineRunner {

    @Value("${app.downstream.customer-service-timeout:NOT_SET}")
    private String customerServiceTimeout;

    @Override
    public void run(String... args) {
        System.out.println("Loaded customer-service-timeout = " + customerServiceTimeout);
    }
}
```

This is a useful sanity check during initial setup: it confirms the value actually came from the config server (or fell back correctly) rather than silently using an unrelated default.

---

## 7. Fallback to Local Defaults

Depending entirely on a remote config server for a service to start is fragile — if the config server is temporarily unreachable during a deploy, having every dependent service fail to start turns one outage into many. The standard pattern is to keep a minimal, safe set of local defaults in the application's own `application.yml`, and let the config server *override* them when available rather than being the sole source of truth.

```yaml
# order-service application.yml -- local, safe fallback defaults
spring:
  application:
    name: order-service
  config:
    import: "optional:configserver:http://localhost:8888"

# Local fallback values -- used if the config server is unreachable,
# or overridden by whatever the config server actually returns
app:
  downstream:
    customer-service-timeout: 3s
  feature-flags:
    new-checkout-flow: false

resilience4j:
  circuitbreaker:
    instances:
      customerService:
        failure-rate-threshold: 50
        wait-duration-in-open-state: 10s
```

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FeatureFlagConfig {

    // Explicit fallback literal in the @Value expression is a SECOND
    // layer of safety, independent of the local application.yml default --
    // useful for properties introduced after this class was deployed.
    @Value("${app.feature-flags.new-checkout-flow:false}")
    private boolean newCheckoutFlowEnabled;

    public boolean isNewCheckoutFlowEnabled() {
        return newCheckoutFlowEnabled;
    }
}
```

```
  Startup resolution order with optional config server import
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Attempt to fetch config from configserver:...           │
  │       Success → merge remote values OVER local defaults     │
  │       Failure (optional: prefix) → log warning, continue     │
  │                                    using local application.yml│
  │ 2. Application starts either way -- never hard-fails purely  │
  │    because the config server was briefly unreachable         │
  └──────────────────────────────────────────────────────────┘
```

This layered approach means the config server is treated as a source of *overrides and centralization*, not as a single point of failure that can prevent every microservice in the system from starting.

---

## 8. @RefreshScope — Picking Up Changes Without Restart

By default, Spring Boot configuration is read once at startup and cached in beans for the lifetime of the application — changing a value in the config server's Git repo has no effect on already-running instances until they restart. `@RefreshScope` (from Spring Cloud) marks a bean for **lazy re-initialization**: the next time it's accessed after a refresh event, Spring recreates it using the latest configuration values, without restarting the JVM.

### Dependency

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

```yaml
management:
  endpoints:
    web:
      exposure:
        include: refresh, health, info
```

### Marking a Bean Refreshable

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.context.config.annotation.RefreshScope;
import org.springframework.stereotype.Component;
import java.time.Duration;

@Component
@RefreshScope
public class DownstreamConfig {

    @Value("${app.downstream.customer-service-timeout}")
    private Duration customerServiceTimeout;

    public Duration getCustomerServiceTimeout() {
        return customerServiceTimeout;
    }
}
```

### Triggering a Refresh

After updating and committing the new value in the Git config repo (e.g., changing `customer-service-timeout` from `3s` to `5s`), calling the Actuator `/actuator/refresh` endpoint on the running instance picks up the change without a restart:

```bash
curl -X POST http://localhost:8080/actuator/refresh
# Response: ["app.downstream.customer-service-timeout"]
# (the endpoint returns the list of property keys that actually changed)
```

```
  Refresh flow
  ┌─────────────────────────────────────────────────────────┐
  │ 1. Config value changed + committed in Git config-repo    │
  │ 2. POST /actuator/refresh on the running order-service      │
  │        instance                                            │
  │ 3. Spring re-fetches config from the Config Server           │
  │ 4. Any bean annotated @RefreshScope is torn down and         │
  │    lazily recreated on next use, picking up the new value    │
  │ 5. Beans WITHOUT @RefreshScope keep their original,           │
  │    startup-time value until the process is actually          │
  │    restarted                                                │
  └─────────────────────────────────────────────────────────┘
```

For updating many instances at once (rather than curling each one individually), Spring Cloud Bus (backed by a message broker like RabbitMQ or Kafka) can broadcast a single refresh event to every instance of every service simultaneously — worth knowing the name of even if a deep dive on it belongs in a more advanced messaging-focused lesson.

---

## 9. Common Pitfalls

- **Hardcoding secrets in the Git config repo.** A Config Server backed by Git is still Git — commit history is effectively permanent. Secrets belong in a dedicated secrets manager (Vault, AWS Secrets Manager) or environment variables injected at deploy time, referenced from config rather than stored directly in it.
- **Forgetting the `optional:` prefix on `spring.config.import`.** Without it, a temporarily unreachable config server prevents the application from starting at all — turning a config server blip into a fleet-wide outage.
- **Assuming `@RefreshScope` refreshes everything automatically.** Only beans explicitly annotated `@RefreshScope` (or configuration bound via `@ConfigurationProperties`, which Spring Cloud refreshes by default) pick up new values on a refresh call; plain `@Value`-injected fields in non-refresh-scoped beans do not change until restart.
- **Not versioning/pinning the config repo branch or label per environment.** If every environment reads from the same mutable branch with no environment-specific label, a change intended for staging can accidentally apply to production simultaneously.
- **Treating profile-specific YAML as a substitute for centralized config in a multi-service system.** Profiles solve per-environment variation for one service's own files; they don't solve keeping many services' configuration consistent, auditable, and centrally manageable — that is specifically the Config Server's job.
- **Refreshing configuration-sensitive beans that hold open resources (e.g., a connection pool) without verifying they tear down and recreate cleanly** — `@RefreshScope` proxies the bean, but a bean with expensive or stateful initialization logic needs testing to confirm refresh doesn't leak connections or leave the bean in a partially initialized state.

---

## 10. Best Practices

- Keep **secrets out of the config repo entirely** — reference them via placeholders resolved from environment variables or a dedicated secrets manager, never as literal values in any file the Config Server serves.
- Always use `optional:configserver:...` in `spring.config.import` and keep sane, safe local defaults in each service's own `application.yml` as a fallback.
- Structure the config repo with a **shared `application.yml`** for cross-cutting defaults (logging format, common Actuator settings) plus **per-service, per-profile files** (`order-service-prod.yml`) for anything service- or environment-specific.
- Use `@ConfigurationProperties` classes (which Spring Cloud automatically refreshes) over scattered `@Value` fields where practical — it groups related settings, is type-safe, and integrates cleanly with `@RefreshScope`/refresh events.
- Protect the `/actuator/refresh` endpoint in production — it should not be publicly exposed; put it behind authentication or restrict it to internal network access only.
- Treat the config repo like production code: require pull request review for changes, especially to `*-prod.yml` files, since a bad config change can be just as impactful as a bad code deploy.
- For fleets of many instances, prefer Spring Cloud Bus (or a platform-level rolling restart) over manually curling `/actuator/refresh` on every instance — manual refresh doesn't scale past a handful of instances.

---

## 11. Hands-On Exercises

**Exercise 1:** Create a local Git repository (it can be a plain local folder initialized with `git init`, no remote needed) containing `order-service.yml`, `order-service-dev.yml`, and `order-service-prod.yml`, each defining a different value for `app.downstream.customer-service-timeout`. Stand up a Config Server pointing at this repo and confirm `curl http://localhost:8888/order-service/dev` and `curl http://localhost:8888/order-service/prod` return the correct, different merged values.

**Exercise 2:** Build an `order-service` client that imports config via `spring.config.import: "optional:configserver:http://localhost:8888"` with `spring.profiles.active=dev`. Add a `CommandLineRunner` that prints the resolved `app.downstream.customer-service-timeout` value at startup and confirm it matches what the Config Server returned for the `dev` profile in Exercise 1.

**Exercise 3:** Stop the Config Server entirely, then start `order-service` again. Confirm the application still starts successfully (thanks to `optional:` and local fallback defaults in `order-service`'s own `application.yml`), and that the printed value at startup is the local fallback rather than the config-server value.

**Exercise 4:** Add `@RefreshScope` to a `@Component` that exposes `app.downstream.customer-service-timeout` via `@Value`. With the Config Server and `order-service` both running, change the value in the Git config repo, commit it, then call `POST /actuator/refresh` on the running `order-service` instance. Confirm — without restarting the JVM — that a subsequent call to the component's getter method returns the new value.

**Exercise 5:** Remove `@RefreshScope` from the component in Exercise 4 and repeat the same experiment (change config, commit, call `/actuator/refresh`). Confirm the value does NOT change until the application is actually restarted, demonstrating concretely what `@RefreshScope` is responsible for.

---

## 12. Interview Q&A

**Q: Why does hardcoded configuration become a problem as a system grows past a single service and single environment?**
Answer: A single hardcoded config file works fine for one service in one environment, but real systems have multiple services each needing different values, and each service is deployed to multiple environments (dev, staging, prod) that need different values again. Hardcoding forces a rebuild-and-redeploy cycle for every config change, invites configuration drift when instances are configured independently, and provides no audit trail of who changed what. Externalized configuration — and for multi-service systems, a centralized config server — decouples configuration changes from code deployments and gives every instance a consistent, auditable source of truth.

**Q: What problem does Spring Cloud Config Server solve that profile-specific YAML files (application-{profile}.yml) do not?**
Answer: Profile-specific files solve per-environment variation within a single service's own packaged configuration — `application-prod.yml` overrides `application.yml` when the `prod` profile is active. They don't solve managing configuration consistently across many services, since each service's config still lives inside its own deployable artifact with no shared audit trail or single place to review changes. Spring Cloud Config Server centralizes configuration for every service and every environment in one Git repository, giving a single source of truth, a full commit history for auditing changes, and the ability to update configuration without rebuilding or redeploying the service (especially combined with `@RefreshScope`).

**Q: Why should spring.config.import use the "optional:" prefix when pointing at a Config Server?**
Answer: Without the `optional:` prefix, if the Config Server is unreachable when a client application starts — due to a network blip, the server being mid-deploy, or any transient issue — the client application fails to start entirely. With `optional:configserver:...`, the client logs a warning and falls back to whatever local configuration defaults are packaged in its own `application.yml`, letting the service start in a degraded-but-functional state instead of failing outright. This turns the Config Server from a single point of failure for the entire fleet into a source of overrides that enhances, but doesn't gate, service startup.

**Q: What does @RefreshScope actually do, and what does it not do?**
Answer: `@RefreshScope` marks a bean so that, when a refresh event occurs (triggered via the Actuator `/actuator/refresh` endpoint, or broadcast fleet-wide via Spring Cloud Bus), Spring tears down the existing bean instance and lazily recreates it the next time it's accessed, picking up whatever configuration values are current at that point — all without restarting the JVM. It does not automatically refresh every bean in the application: only beans explicitly annotated `@RefreshScope` (or properties bound through `@ConfigurationProperties`, which Spring Cloud refreshes by default) are affected; plain `@Value`-injected fields on ordinary singleton beans retain their startup-time values until the process actually restarts.

**Q: Where should secrets like database passwords live in a Spring Cloud Config setup, and why not directly in the config repo?**
Answer: Secrets should not be stored as literal values in the Git-backed config repo, because Git history is effectively permanent — even if a secret is later removed from the latest commit, it remains recoverable from earlier commits unless the history itself is rewritten, which is disruptive and easy to get wrong. Instead, secrets should be injected via environment variables at deploy time (referenced from config files using `${DB_PASSWORD}`-style placeholders) or managed through a dedicated secrets manager like HashiCorp Vault or AWS Secrets Manager, which Spring Cloud Config can also integrate with directly as a backend, keeping the audit-friendly, version-controlled convenience of the Config Server for non-sensitive configuration while keeping actual credentials out of source control entirely.

**Q: How would you roll out a configuration change across a fleet of many running instances without restarting each one manually?**
Answer: For a small number of instances, an operator can call `POST /actuator/refresh` on each instance individually after committing the change to the config repo, and any `@RefreshScope` beans on that instance will pick up the new values on next access. That approach doesn't scale to a large fleet, so the standard solution is Spring Cloud Bus, which connects every service instance to a shared message broker (RabbitMQ or Kafka) and lets a single refresh event — triggered once, often via a `/actuator/busrefresh` call to any one instance — be broadcast to every instance of every connected service simultaneously, rather than requiring an operator to individually contact each one.
