# Profiles and Configuration Management — Complete Guide

## Table of Contents

1. [Why Configuration Management Matters in Production](#1-why-configuration-management-matters-in-production)
2. [Spring Profiles](#2-spring-profiles)
3. [@Profile on Beans](#3-profile-on-beans)
4. [Profile-Specific Configuration Files](#4-profile-specific-configuration-files)
5. [Activating Profiles](#5-activating-profiles)
6. [Externalizing Secrets](#6-externalizing-secrets)
7. [@ConfigurationProperties vs @Value](#7-configurationproperties-vs-value)
8. [Worked Example — Type-Safe Config with Validation](#8-worked-example--type-safe-config-with-validation)
9. [Configuration Precedence Order](#9-configuration-precedence-order)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Configuration Management Matters in Production

A Spring Boot application built for local development typically points at `localhost` for its database, logs at `DEBUG`, and has no real secrets in play. The exact same compiled artifact then needs to run in staging against a shared test database, and in production against a highly available cluster with credentials that must never appear in source control. If configuration is hardcoded, "the same artifact everywhere" becomes a fiction — you end up rebuilding the JAR per environment, which defeats the entire point of a reproducible build pipeline.

```
  One build artifact, many environments
  ┌─────────────────────────────────────────────────────────┐
  │  order-service-1.4.2.jar                                 │
  │                                                           │
  │   spring.profiles.active=dev    →  local Postgres,       │
  │                                     DEBUG logging          │
  │                                                           │
  │   spring.profiles.active=staging →  shared test DB,       │
  │                                     INFO logging           │
  │                                                           │
  │   spring.profiles.active=prod   →  HA cluster DB,          │
  │                                     WARN logging,           │
  │                                     secrets from env vars   │
  └─────────────────────────────────────────────────────────┘
```

Spring Boot's answer to this is a layered configuration system: profiles select which named configuration set is active, externalized properties (env vars, command-line args) override file-based defaults, and `@ConfigurationProperties` gives type safety and validation on top of whatever raw key/value pairs end up resolved. This lesson covers all three.

---

## 2. Spring Profiles

A **profile** is a named, logical grouping of beans and configuration that is only active when explicitly selected. Profiles let a single codebase describe multiple environment-specific variants without `if` statements scattered through business logic.

Common profile names: `dev`, `test`, `staging`, `prod` — though nothing forces this naming; profiles are just strings.

```yaml
# application.yml — profile-agnostic defaults
spring:
  application:
    name: order-service
server:
  port: 8080
```

```yaml
# application-dev.yml — only loaded when the "dev" profile is active
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/orders_dev
    username: dev
    password: dev
logging:
  level:
    root: DEBUG
    com.example.orders: TRACE
```

```yaml
# application-prod.yml — only loaded when the "prod" profile is active
spring:
  datasource:
    url: jdbc:postgresql://orders-db.prod.internal:5432/orders
logging:
  level:
    root: WARN
    com.example.orders: INFO
```

Multiple profiles can be active simultaneously (e.g. `prod,eu-region`), and Spring Boot merges their configuration in the order they are declared, with later profiles overriding earlier ones for any overlapping key.

---

## 3. @Profile on Beans

`@Profile` restricts an entire `@Component`, `@Configuration`, or individual `@Bean` method to only be registered when the given profile is active. This is the mechanism for swapping entire implementations per environment — not just property values.

```java
package com.example.orders.notification;

public interface NotificationSender {
    void send(String to, String message);
}
```

```java
package com.example.orders.notification;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class SesNotificationSender implements NotificationSender {

    @Override
    public void send(String to, String message) {
        // real integration with Amazon SES
    }
}
```

```java
package com.example.orders.notification;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!prod") // active for every profile except "prod" — dev, test, staging, etc.
public class LoggingNotificationSender implements NotificationSender {

    @Override
    public void send(String to, String message) {
        System.out.printf("[MOCK NOTIFICATION] to=%s message=%s%n", to, message);
    }
}
```

`@Profile` expressions support `!` (not), `&` (and), and `|` (or): `@Profile("prod & eu-region")` only activates when both are active simultaneously. Because the two beans above implement the same interface and their `@Profile` conditions are mutually exclusive, exactly one `NotificationSender` bean exists in the context at any time — Spring never sees a `NoUniqueBeanDefinitionException`, and the rest of the application depends only on the `NotificationSender` interface, never on which implementation is active.

---

## 4. Profile-Specific Configuration Files

Spring Boot resolves configuration files using the naming convention `application-{profile}.yml` (or `.properties`), layered on top of the base `application.yml`. Both single-file-per-profile and Spring Boot 2.4+'s multi-document-in-one-file style are common in real projects.

**Separate files (most common, clearest for larger teams):**

```
src/main/resources/
├── application.yml           ← shared defaults, always loaded
├── application-dev.yml       ← loaded only when profile "dev" is active
├── application-staging.yml   ← loaded only when profile "staging" is active
└── application-prod.yml      ← loaded only when profile "prod" is active
```

**Multi-document single file (convenient for small services):**

```yaml
# application.yml
spring:
  application:
    name: order-service
---
spring:
  config:
    activate:
      on-profile: dev
  datasource:
    url: jdbc:postgresql://localhost:5432/orders_dev
---
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: jdbc:postgresql://orders-db.prod.internal:5432/orders
```

The `---` document separator plus `spring.config.activate.on-profile` scopes each document to a profile, functioning identically to a separate `application-{profile}.yml` file. Whichever style you choose, keep it consistent across a codebase — mixing both makes it much harder to answer "where does this property actually come from?"

---

## 5. Activating Profiles

There are several ways to set `spring.profiles.active`, each appropriate to a different stage of the deployment pipeline:

```bash
# 1. Command-line argument (highest precedence of these options)
java -jar order-service.jar --spring.profiles.active=prod

# 2. Environment variable — the standard way in containers/Kubernetes
export SPRING_PROFILES_ACTIVE=prod
java -jar order-service.jar

# 3. JVM system property
java -Dspring.profiles.active=prod -jar order-service.jar

# 4. In application.yml itself (rarely appropriate for prod — usually only for a default/local profile)
```

```yaml
# application.yml — a sensible default so local `mvn spring-boot:run` "just works"
spring:
  profiles:
    active: dev
```

```yaml
# docker-compose.yml — profile passed via environment variable
services:
  order-service:
    image: order-service:1.4.2
    environment:
      SPRING_PROFILES_ACTIVE: staging
```

```yaml
# Kubernetes Deployment — same pattern
env:
  - name: SPRING_PROFILES_ACTIVE
    value: prod
```

In practice, the default in `application.yml` should only ever point at `dev` (a safe, harmless local default) — production environments always set `SPRING_PROFILES_ACTIVE` explicitly via the deployment platform, never relying on a fallback.

---

## 6. Externalizing Secrets

Committing a database password, API key, or JWT signing secret into `application.yml` — even a "prod" one — means it lives in git history forever, readable by anyone with repository access, and impossible to fully purge without rewriting history. Secrets must be externalized so the value is injected at deploy time, never checked in.

```yaml
# application.yml — reference an environment variable, never a literal secret
spring:
  datasource:
    url: jdbc:postgresql://orders-db.prod.internal:5432/orders
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}

app:
  jwt:
    secret: ${JWT_SIGNING_SECRET}
```

```bash
# The actual secret value is supplied only at runtime, by the deployment platform —
# never written into a file that gets committed.
export DB_USERNAME=orders_app
export DB_PASSWORD='S3cur3-Runtime-Only-Value'
export JWT_SIGNING_SECRET='a-long-random-signing-key'
java -jar order-service.jar
```

`${VAR_NAME}` placeholders are resolved from any property source, and environment variables are automatically one of them — Spring Boot even relaxes the naming so `DB_PASSWORD` (env var convention) satisfies `db.password` (property convention) without any extra mapping.

```yaml
# A placeholder can also declare a fallback default for non-secret values —
# but secrets should never have a hardcoded fallback, so a missing env var fails loudly.
server:
  port: ${SERVER_PORT:8080}          # fine — non-sensitive, safe default
spring:
  datasource:
    password: ${DB_PASSWORD}          # no default — startup fails if this isn't provided
```

In real production platforms, the environment variable itself is typically populated from a secrets manager (Kubernetes Secrets, AWS Secrets Manager, HashiCorp Vault) rather than typed by hand — the application code never needs to know that though; it just reads `${DB_PASSWORD}` and the platform is responsible for making that variable correct and access-controlled.

A `.gitignore` entry and repository convention should also explicitly exclude any local file that might carry real secrets during development:

```
# .gitignore
application-local.yml
.env
```

---

## 7. @ConfigurationProperties vs @Value

`@Value("${some.property}")` injects a single property directly into a field. It works, but it does not scale: every related property becomes a separate injection point, there is no structural validation, and typos in the property key are only caught at runtime (or never, if the field silently keeps its default).

```java
// @Value approach — works, but fragmented and untyped
@Component
public class RateLimiterConfig {

    @Value("${app.rate-limit.requests-per-minute:60}")
    private int requestsPerMinute;

    @Value("${app.rate-limit.burst-capacity:10}")
    private int burstCapacity;

    @Value("${app.rate-limit.enabled:true}")
    private boolean enabled;
}
```

`@ConfigurationProperties` instead binds an entire prefixed block of configuration to a single class in one step, giving you a cohesive, typed, IDE-autocompletable object, and it integrates directly with Bean Validation (`@Valid`, `@NotNull`, `@Min`, etc.) so invalid configuration fails application startup immediately, rather than surfacing as a confusing runtime bug hours later.

| | `@Value` | `@ConfigurationProperties` |
|---|---|---|
| Binds | one property at a time | a whole prefixed object graph |
| Type safety | manual, per-field | structural, compiler-checked |
| Validation | none built in | integrates with `@Validated` / JSR-380 |
| Relaxed binding (`kebab-case`, env vars) | partial | full |
| Metadata / IDE autocomplete | no | yes, via `spring-boot-configuration-processor` |
| Best for | one-off, single values | related settings that belong together |

`@ConfigurationProperties` is the recommended default for any non-trivial group of related settings; reach for `@Value` only for a genuinely standalone, single value that doesn't warrant its own class.

---

## 8. Worked Example — Type-Safe Config with Validation

A rate-limiting feature needs three related settings — whether it's enabled, the sustained rate, and the burst capacity — plus a nested block for per-client overrides. This is exactly the shape `@ConfigurationProperties` is built for.

```yaml
# application.yml
app:
  rate-limit:
    enabled: true
    requests-per-minute: 120
    burst-capacity: 20
    premium-client:
      requests-per-minute: 600
      burst-capacity: 100
```

```java
package com.example.orders.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.NestedConfigurationProperty;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitProperties {

    private boolean enabled = true;

    @Min(1)
    private int requestsPerMinute = 60;

    @Min(1)
    private int burstCapacity = 10;

    @NotNull
    @NestedConfigurationProperty
    private ClientOverride premiumClient = new ClientOverride();

    public static class ClientOverride {

        @Min(1)
        private int requestsPerMinute = 60;

        @Min(1)
        private int burstCapacity = 10;

        public int getRequestsPerMinute() { return requestsPerMinute; }
        public void setRequestsPerMinute(int requestsPerMinute) { this.requestsPerMinute = requestsPerMinute; }
        public int getBurstCapacity() { return burstCapacity; }
        public void setBurstCapacity(int burstCapacity) { this.burstCapacity = burstCapacity; }
    }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public int getRequestsPerMinute() { return requestsPerMinute; }
    public void setRequestsPerMinute(int requestsPerMinute) { this.requestsPerMinute = requestsPerMinute; }
    public int getBurstCapacity() { return burstCapacity; }
    public void setBurstCapacity(int burstCapacity) { this.burstCapacity = burstCapacity; }
    public ClientOverride getPremiumClient() { return premiumClient; }
    public void setPremiumClient(ClientOverride premiumClient) { this.premiumClient = premiumClient; }
}
```

```java
package com.example.orders.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(RateLimitProperties.class)
public class RateLimitConfig {
    // RateLimitProperties is now a bean, ready to be @Autowired anywhere
}
```

```java
package com.example.orders.ratelimit;

import com.example.orders.config.RateLimitProperties;
import org.springframework.stereotype.Component;

@Component
public class RateLimiter {

    private final RateLimitProperties properties;

    public RateLimiter(RateLimitProperties properties) {
        this.properties = properties;
    }

    public boolean allow(String clientId) {
        if (!properties.isEnabled()) {
            return true;
        }
        int limit = "premium".equals(clientId)
                ? properties.getPremiumClient().getRequestsPerMinute()
                : properties.getRequestsPerMinute();
        // ... actual token-bucket / sliding-window logic using `limit`
        return true;
    }
}
```

With `@Min(1)` in place, if an operator accidentally sets `app.rate-limit.requests-per-minute: 0` in a config file, the application fails to start with a clear `ConstraintViolationException` naming the exact field and value — instead of silently accepting zero and rate-limiting every request to death in production. Adding `spring-boot-configuration-processor` as an annotation-processor dependency also generates metadata that gives IDE autocomplete and inline documentation for `app.rate-limit.*` keys in `application.yml`.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-configuration-processor</artifactId>
    <optional>true</optional>
</dependency>
```

---

## 9. Configuration Precedence Order

Spring Boot resolves the same logical property from many possible sources, and needs a deterministic order to decide which value wins when more than one source defines it. From highest to lowest precedence (abbreviated to the sources most relevant in day-to-day work; the full `PropertySource` order Spring Boot documents has more entries for less common cases like devtools and servlet config):

```
  Highest precedence (wins)
  ┌───────────────────────────────────────────────────────────┐
  │ 1. Command-line arguments        --server.port=9090         │
  │ 2. JVM system properties          -Dserver.port=9090         │
  │ 3. Environment variables          SERVER_PORT=9090           │
  │ 4. Profile-specific config files  application-prod.yml       │
  │ 5. Application config file        application.yml            │
  │ 6. @PropertySource-annotated files                            │
  │ 7. Default properties (set in code, e.g. SpringApplication    │
  │    .setDefaultProperties)                                     │
  └───────────────────────────────────────────────────────────┘
  Lowest precedence (loses)
```

The practical consequence: a value baked into `application-prod.yml` can always be overridden at deploy time by an environment variable, and an environment variable can in turn be overridden by a command-line argument passed to `java -jar`. This is precisely what makes "same artifact, different environment" workable — the packaged JAR never needs rebuilding; only the surrounding invocation changes.

```bash
# application-prod.yml sets server.port: 8080, but this run overrides it
java -jar order-service.jar --spring.profiles.active=prod --server.port=9090
# → the app starts on 9090, because command-line args outrank the profile file
```

A concrete worked trace: suppose `application.yml` sets `app.rate-limit.requests-per-minute: 60`, `application-prod.yml` sets it to `120`, and the Kubernetes Deployment sets the env var `APP_RATE-LIMIT_REQUESTS-PER-MINUTE` — actually, because dots and dashes don't survive well in most shells/env var names, Spring Boot's relaxed binding accepts `APP_RATELIMIT_REQUESTSPERMINUTE=200` as an equivalent match for `app.rate-limit.requests-per-minute`. With `spring.profiles.active=prod` and that env var set, the final resolved value is `200` — the environment variable outranks the profile file, which in turn outranks the base file.

---

## 10. Common Pitfalls

- **Committing a real secret into `application-prod.yml`"just this once."** Once it's in git history, rotating the credential is the only real fix — deleting the line does not remove it from history.
- **Relying on a hardcoded fallback for a secret placeholder**, e.g. `password: ${DB_PASSWORD:changeme}`. This silently starts the application with a useless default credential instead of failing loudly when the real secret wasn't provided.
- **Mixing `@Value` and `@ConfigurationProperties` for the same logical settings block**, making it unclear which mechanism actually governs a given property when debugging.
- **Forgetting `@Validated`** on a `@ConfigurationProperties` class — without it, `@Min`/`@NotNull` annotations are silently ignored and invalid configuration passes through uncaught.
- **Assuming profile-specific YAML files are automatically included** — a file named `application-prod.yml` only loads when `prod` is in the active profile list; a typo in `SPRING_PROFILES_ACTIVE` silently falls back to base `application.yml` defaults with no error.
- **Setting `spring.profiles.active=prod` inside `application.yml` itself as a permanent default.** This makes "prod" configuration active on every developer's laptop unless they remember to override it, which is the opposite of the intended safety direction.

---

## 11. Best Practices

- Never commit real secrets anywhere in the repository, including profile-specific files — always reference `${ENV_VAR}` placeholders and inject real values through the deployment platform's secret store.
- Default `spring.profiles.active` to `dev` in the base `application.yml` so a fresh clone runs safely out of the box; set every other environment's profile explicitly at deploy time.
- Prefer `@ConfigurationProperties` over `@Value` for any group of two or more related settings, and add `@Validated` with Bean Validation annotations so bad configuration fails fast at startup, not at 2am in production.
- Add `spring-boot-configuration-processor` to every project — the IDE metadata it generates prevents an entire category of "typo'd property key silently ignored" bugs.
- Use `@Profile("!prod")` / `@Profile("prod")` pairs to swap entire bean implementations (mock vs real integrations) rather than branching on an `if (environment.equals("prod"))` check inside business logic.
- Keep the precedence order in mind when debugging "why didn't my config change take effect" — check `/actuator/env` (from [Lesson 01](./01-Spring-Boot-Actuator.md)) to see exactly which `PropertySource` supplied the final value.

---

## 12. Hands-On Exercises

**Exercise 1:** Create `application.yml`, `application-dev.yml`, and `application-prod.yml` for a project. Give each a different `server.port`. Run the app with `--spring.profiles.active=dev` and confirm it starts on the dev port, then rerun with `--spring.profiles.active=prod` and confirm it starts on the prod port — with no code changes and no rebuild.

**Exercise 2:** Create two implementations of a `PaymentGateway` interface, one annotated `@Profile("prod")` calling a real (or simulated) external API, and one annotated `@Profile("!prod")` that logs a fake transaction. Confirm via a `@RestController` endpoint that the correct implementation is wired in for each profile.

**Exercise 3:** Add a `spring.datasource.password` property referencing `${DB_PASSWORD}` with no default value. Start the app without setting `DB_PASSWORD` and observe the startup failure. Then set the environment variable and confirm the app starts cleanly. Explain in your own words why a fallback default like `${DB_PASSWORD:admin}` would be a security mistake here.

**Exercise 4:** Build the `RateLimitProperties` class from [Section 8](#8-worked-example--type-safe-config-with-validation) in a scratch project, wire it up with `@EnableConfigurationProperties`, and set `app.rate-limit.requests-per-minute: 0` in `application.yml`. Confirm the application fails to start with a validation error naming the offending field. Fix the value and confirm it starts cleanly.

**Exercise 5:** Using the precedence order from [Section 9](#9-configuration-precedence-order), set `server.port: 8080` in `application.yml`, `SERVER_PORT=9000` as an environment variable, and pass `--server.port=9500` as a command-line argument, all in the same run. Predict which port the app will actually bind to before running it, then verify with `curl http://localhost:<port>/actuator/health` (requires Actuator from Lesson 01) which port actually answered.

---

## 13. Interview Q&A

**Q: What is the difference between `@Value` and `@ConfigurationProperties`, and when would you choose one over the other?**
Answer: `@Value` injects a single property expression into a single field with no structural grouping and no built-in validation — good for a genuinely standalone setting. `@ConfigurationProperties` binds an entire prefixed block of related configuration to a POJO in one step, supports nested objects, integrates with Bean Validation via `@Validated`, and (with the configuration-processor dependency) gets IDE autocomplete metadata. For any group of two or more related settings — which is the overwhelming majority of real configuration — `@ConfigurationProperties` is the better default because it centralizes the settings into one typed, validated object rather than scattering `@Value` injections across the codebase.

**Q: Walk through Spring Boot's configuration property precedence order.**
Answer: From highest to lowest priority: command-line arguments passed to the jar, JVM system properties (`-D` flags), OS environment variables, profile-specific configuration files (`application-{profile}.yml`), the base `application.yml`, `@PropertySource`-annotated classpath files, and finally any defaults set programmatically in code. This ordering is what allows the same built artifact to run correctly across dev, staging, and production — environment-specific overrides supplied at deploy time (env vars, command-line args) always win over whatever is baked into the packaged configuration files.

**Q: Why should secrets be injected via environment variables instead of stored in `application-prod.yml`?**
Answer: Anything committed to `application-prod.yml` lives permanently in git history and is visible to anyone with repository read access, regardless of later deletion. Environment variables are supplied at runtime by the deployment platform (typically itself backed by a secrets manager like Vault, AWS Secrets Manager, or Kubernetes Secrets), so the actual secret value never touches source control, and rotating a credential is a platform-level operation rather than a code change and redeploy. Placeholder syntax like `${DB_PASSWORD}` with no hardcoded fallback also ensures the application fails to start loudly if the real secret was never provided, rather than silently running with an insecure default.

**Q: How does `@Profile("!prod")` behave, and what problem does it solve?**
Answer: `@Profile` supports the `!` negation operator, so `@Profile("!prod")` means "register this bean whenever the `prod` profile is NOT active" — i.e., in dev, test, staging, or any other profile. This is the standard pattern for pairing a real production integration (`@Profile("prod")`) with a mock or lightweight substitute (`@Profile("!prod")`) that implements the same interface, so the rest of the application can depend purely on the interface without ever branching on which environment it's running in.

**Q: What happens if you forget `@Validated` on a `@ConfigurationProperties` class that has `@Min`/`@NotNull` annotations?**
Answer: Without `@Validated`, Spring Boot binds the properties as normal but never triggers Bean Validation on the resulting object — so annotations like `@Min(1)` or `@NotNull` are present in the code but silently have no effect. An invalid value (e.g. a negative rate limit) passes through unnoticed and the failure surfaces later as a confusing runtime bug, rather than as a clear, immediate `ConstraintViolationException` at application startup. `@Validated` is what actually wires the properties object into Spring's validation machinery.

**Q: How would you debug a configuration value that isn't taking effect the way you expect?**
Answer: Use `/actuator/env` (covered in Lesson 01) to inspect the fully resolved value along with which `PropertySource` supplied it — this immediately reveals whether an environment variable, command-line argument, or a stale profile file is winning. Combined with knowledge of the precedence order, you can identify whether the fix is renaming an environment variable to match Spring's relaxed binding rules, removing a competing definition from a higher-precedence source, or confirming the intended profile is actually active via `activeProfiles` in the same `/actuator/env` response.
