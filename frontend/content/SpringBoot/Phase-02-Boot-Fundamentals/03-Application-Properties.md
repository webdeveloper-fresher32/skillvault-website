# Application Properties and Configuration — Complete Guide

## Table of Contents
1. [Properties vs YAML](#1-properties-vs-yaml)
2. [External Configuration Precedence Order](#2-external-configuration-precedence-order)
3. [Profiles](#3-profiles)
4. [Relaxed Binding](#4-relaxed-binding)
5. [@Value and SpEL Expressions](#5-value-and-spel-expressions)
6. [Type-Safe Configuration with @ConfigurationProperties](#6-type-safe-configuration-with-configurationproperties)
7. [Validating Configuration Properties](#7-validating-configuration-properties)
8. [Common Properties Reference Table](#8-common-properties-reference-table)
9. [Externalizing Secrets](#9-externalizing-secrets)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Properties vs YAML

Spring Boot externalizes configuration into either `application.properties` or `application.yml`, both placed by convention in `src/main/resources/`. Only one format is typically used per project — Spring Boot detects and loads whichever is present (or both, with `.properties` taking a small precedence edge if both exist for the same profile, which is itself a reason not to mix them).

`.properties` uses flat `key=value` pairs, with dots indicating logical nesting:

```properties
server.port=8081
server.servlet.context-path=/api/v1
spring.datasource.url=jdbc:postgresql://localhost:5432/orders
spring.datasource.username=orders_app
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=true
logging.level.com.example.orders=DEBUG
logging.level.org.hibernate.SQL=DEBUG
```

`.yml` (YAML) expresses the same configuration hierarchically, which becomes noticeably easier to read once a project accumulates dozens of properties sharing common prefixes:

```yaml
server:
  port: 8081
  servlet:
    context-path: /api/v1

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/orders
    username: orders_app
  jpa:
    show-sql: true
    hibernate:
      ddl-auto: validate

logging:
  level:
    com.example.orders: DEBUG
    org.hibernate.SQL: DEBUG
```

```
  Properties                          YAML
  ──────────                          ────
  + Simpler mental model              + Reads better with deep nesting
  + Slightly faster to parse          + No repeated prefixes
  + No indentation-sensitivity bugs   + Supports lists naturally
  - Repeats prefixes on every line    - Indentation errors are silent
  - No native list syntax                (a misplaced space breaks
    (needs prop[0]=, prop[1]=)          nesting without an obvious error)
```

YAML supports lists directly, which `.properties` can only approximate with an ugly indexed syntax:

```yaml
app:
  allowed-origins:
    - https://app.example.com
    - https://admin.example.com
```

```properties
app.allowed-origins[0]=https://app.example.com
app.allowed-origins[1]=https://admin.example.com
```

One important YAML-specific caveat: YAML does not support the `@PropertySource` annotation for custom, non-default-location property files (`@PropertySource` only understands `.properties` format) — a common surprise for teams that adopt YAML everywhere and then try to `@PropertySource`-load an extra custom YAML file.

---

## 2. External Configuration Precedence Order

Spring Boot allows the same property to be set in many different places simultaneously, and resolves conflicts using a strict, well-defined precedence order — higher items in the list win over lower ones. This is one of the most frequently tested and frequently misunderstood aspects of Spring Boot configuration.

```
  Highest precedence (wins)
  ┌─────────────────────────────────────────────────────────────┐
  │ 1.  Command-line arguments                                  │
  │     (--server.port=9090)                                     │
  ├─────────────────────────────────────────────────────────────┤
  │ 2.  JNDI attributes from java:comp/env                      │
  ├─────────────────────────────────────────────────────────────┤
  │ 3.  Java System properties (-Dserver.port=9090)              │
  ├─────────────────────────────────────────────────────────────┤
  │ 4.  OS environment variables (SERVER_PORT=9090)              │
  ├─────────────────────────────────────────────────────────────┤
  │ 5.  SPRING_APPLICATION_JSON (inline JSON in an env var       │
  │     or system property)                                      │
  ├─────────────────────────────────────────────────────────────┤
  │ 6.  application-{profile}.properties/.yml                    │
  │     OUTSIDE the packaged jar                                 │
  ├─────────────────────────────────────────────────────────────┤
  │ 7.  application.properties/.yml OUTSIDE the packaged jar     │
  ├─────────────────────────────────────────────────────────────┤
  │ 8.  application-{profile}.properties/.yml                    │
  │     INSIDE the packaged jar                                  │
  ├─────────────────────────────────────────────────────────────┤
  │ 9.  application.properties/.yml INSIDE the packaged jar      │
  ├─────────────────────────────────────────────────────────────┤
  │ 10. @PropertySource-annotated classes                        │
  ├─────────────────────────────────────────────────────────────┤
  │ 11. Default properties (SpringApplication.setDefaultProperties)│
  └─────────────────────────────────────────────────────────────┘
  Lowest precedence (loses to everything above it)
```

The intuition behind this ordering is deliberate: **the closer a setting is to the moment and environment of deployment, the higher its precedence.** A command-line flag passed at the instant you start the process should always win over a value baked into the jar at build time; an external config file sitting next to the jar on a specific server should win over the same file packaged inside the jar (which is identical across every environment); environment variables set by the deployment platform (Kubernetes ConfigMaps/Secrets, systemd unit files, Docker `-e` flags) should win over anything baked into the artifact itself.

```bash
# Command-line argument — highest of the commonly-used options,
# overrides everything below it including env vars
java -jar orders-service.jar --server.port=9090

# OS environment variable — very commonly used in containers
export SERVER_PORT=9090
java -jar orders-service.jar

# External application.properties placed next to the jar
# (outside the jar) — beats the one packaged inside the jar
./orders-service.jar
./application.properties    # this file, sitting alongside the jar,
                             # overrides the one bundled inside it
```

`SPRING_APPLICATION_JSON` is a lesser-known but occasionally useful mechanism for injecting a whole block of properties as one JSON blob via a single environment variable or system property — handy for platforms that only let you set a small number of env vars but need to pass a nested structure:

```bash
export SPRING_APPLICATION_JSON='{"server":{"port":9090},"spring":{"datasource":{"url":"jdbc:postgresql://db:5432/orders"}}}'
java -jar orders-service.jar
```

---

## 3. Profiles

Profiles let a single codebase carry multiple sets of configuration — typically `dev`, `test`, `staging`, and `prod` — and activate exactly one (or a combination) at runtime without changing code or rebuilding the artifact.

```
  application.yml            (always loaded — shared/base config)
  application-dev.yml        (loaded only when profile "dev" is active)
  application-prod.yml       (loaded only when profile "prod" is active)
  application-test.yml       (loaded only when profile "test" is active,
                               automatically active during @SpringBootTest
                               unless overridden)
```

```yaml
# application.yml — shared base configuration
spring:
  application:
    name: orders-service
logging:
  level:
    root: INFO
```

```yaml
# application-dev.yml — loaded only when 'dev' is active
spring:
  datasource:
    url: jdbc:h2:mem:orders
  jpa:
    hibernate:
      ddl-auto: create-drop
    show-sql: true
logging:
  level:
    com.example.orders: DEBUG
```

```yaml
# application-prod.yml — loaded only when 'prod' is active
spring:
  datasource:
    url: jdbc:postgresql://prod-db.internal:5432/orders
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
logging:
  level:
    com.example.orders: WARN
```

Profile-specific files are merged on top of the base `application.yml` — they only need to declare the properties that differ, not repeat everything.

### Activating a profile

There are several equivalent ways to activate a profile, and they follow the same general precedence rules from Section 2 (command-line and environment variable methods win over property-file-based activation):

```bash
# Command-line argument
java -jar orders-service.jar --spring.profiles.active=prod

# Environment variable (common in containers/Kubernetes)
export SPRING_PROFILES_ACTIVE=prod
java -jar orders-service.jar

# Inside application.properties (least flexible — hardcodes the
# default profile into the artifact itself)
spring.profiles.active=dev

# Multiple profiles at once (comma-separated, all are merged)
java -jar orders-service.jar --spring.profiles.active=prod,metrics
```

### Profile-specific beans

`@Profile` restricts a `@Bean` or `@Component` to only be registered when a matching profile is active — commonly used to swap an implementation entirely between environments, such as a fake email sender in `dev` versus a real SMTP-backed one in `prod`:

```java
@Configuration
public class MailConfig {

    @Bean
    @Profile("dev")
    public MailSender devMailSender() {
        return new LoggingMailSender(); // logs to console instead of sending
    }

    @Bean
    @Profile("prod")
    public MailSender prodMailSender() {
        return new SmtpMailSender();    // sends real email via SMTP
    }
}
```

`@Profile` also accepts negation and logical expressions using `!`:

```java
@Component
@Profile("!test")   // active in every profile EXCEPT "test"
public class StartupBannerLogger { /* ... */ }
```

---

## 4. Relaxed Binding

Spring Boot's relaxed binding rules allow the same logical property to be written in whichever casing convention is natural for its source — this exists primarily because environment variables cannot contain dots or hyphens on most operating systems, but `.properties`/`.yml` files conventionally use kebab-case.

```
  All four of these bind to the exact same property:

  Kebab-case (recommended in .properties/.yml)
      spring.datasource.connection-timeout

  camelCase (also works in .properties/.yml)
      spring.datasource.connectionTimeout

  UPPER_SNAKE_CASE (required style for OS environment variables)
      SPRING_DATASOURCE_CONNECTIONTIMEOUT

  lowercase, no separators (least readable, still works)
      spring.datasource.connectiontimeout
```

This is why a property declared as `app.jwt-secret` in `application.yml` can be overridden in a container by setting the environment variable `APP_JWTSECRET` (or, for a nested property like `app.jwt.secret`, `APP_JWT_SECRET`) — the environment variable naming convention is dots and hyphens replaced by underscores, all uppercased. When binding to `@ConfigurationProperties` classes, this relaxed binding applies consistently to record/getter-setter field names as well, so a Java field named `connectionTimeout` binds correctly from `connection-timeout` in YAML without any extra annotation.

---

## 5. @Value and SpEL Expressions

`@Value` injects a single property (or a Spring Expression Language expression) directly into a field, constructor parameter, or method parameter. It is best suited to small, one-off values rather than a whole related group of configuration.

```java
@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    // Default value syntax: if app.jwt.expiration-ms is not set
    // anywhere, this falls back to 86400000 instead of failing startup
    @Value("${app.jwt.expiration-ms:86400000}")
    private long jwtExpirationMs;

    // SpEL expression — computed at startup, here reading a system
    // property with its own fallback
    @Value("#{systemProperties['app.region'] ?: 'us-east-1'}")
    private String region;

    // SpEL referencing another bean's property
    @Value("#{appConfig.maxRetries}")
    private int maxRetries;
}
```

The `${...:default}` syntax is the simplest and most commonly needed feature — it prevents a missing property from causing a startup failure (`@Value` without a default throws an `IllegalArgumentException` during bean creation if the placeholder cannot be resolved and no property source provides it). The `#{...}` syntax invokes full SpEL, capable of referencing other beans, calling methods, and performing arithmetic — powerful, but easy to overuse to the point of making configuration hard to follow; it should be reserved for genuinely dynamic expressions, not used as a substitute for plain property lookups.

---

## 6. Type-Safe Configuration with @ConfigurationProperties

`@Value` becomes unwieldy once a related group of properties grows beyond two or three fields — every field needs its own annotation, there is no compile-time structure, and IDE autocomplete for property keys is limited. `@ConfigurationProperties` solves this by binding an entire prefixed group of properties onto a dedicated, strongly-typed class in one step.

```yaml
app:
  jwt:
    secret: ${JWT_SECRET}
    expiration-ms: 86400000
    issuer: orders-service
  cors:
    allowed-origins:
      - https://app.example.com
      - https://admin.example.com
    allow-credentials: true
```

```java
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.NestedConfigurationProperty;

import java.util.List;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Jwt jwt = new Jwt();
    private final Cors cors = new Cors();

    public Jwt getJwt() { return jwt; }
    public Cors getCors() { return cors; }

    public static class Jwt {
        private String secret;
        private long expirationMs;
        private String issuer;

        public String getSecret() { return secret; }
        public void setSecret(String secret) { this.secret = secret; }
        public long getExpirationMs() { return expirationMs; }
        public void setExpirationMs(long expirationMs) { this.expirationMs = expirationMs; }
        public String getIssuer() { return issuer; }
        public void setIssuer(String issuer) { this.issuer = issuer; }
    }

    public static class Cors {
        private List<String> allowedOrigins;
        private boolean allowCredentials;

        public List<String> getAllowedOrigins() { return allowedOrigins; }
        public void setAllowedOrigins(List<String> allowedOrigins) { this.allowedOrigins = allowedOrigins; }
        public boolean isAllowCredentials() { return allowCredentials; }
        public void setAllowCredentials(boolean allowCredentials) { this.allowCredentials = allowCredentials; }
    }
}
```

Java 17's `record` types make this dramatically shorter for immutable configuration, and are the preferred style in new Spring Boot 3.x code:

```java
@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Cors cors) {
    public record Jwt(String secret, long expirationMs, String issuer) {}
    public record Cors(List<String> allowedOrigins, boolean allowCredentials) {}
}
```

The class must be registered so Spring picks it up — either by annotating it `@Component` directly (making it a regular bean discovered by component scanning), or, more commonly in modern Spring Boot, by explicitly enabling it from a `@Configuration` class with `@EnableConfigurationProperties(AppProperties.class)`, which is preferred because it keeps configuration-holder classes out of component scanning and makes the dependency explicit:

```java
@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class AppConfig {
}
```

Once bound, it is injected like any other bean:

```java
@Service
public class JwtService {

    private final AppProperties appProperties;

    public JwtService(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    public String issuer() {
        return appProperties.jwt().issuer();
    }
}
```

| Aspect | `@Value` | `@ConfigurationProperties` |
|---|---|---|
| Best for | One or two standalone values | A cohesive group of related properties |
| SpEL support | Yes | No |
| Relaxed binding | Yes | Yes |
| Type-safe nested objects/lists | No (manual per field) | Yes, natively |
| Validation support (`@Validated`) | Limited | Full JSR-380 (Jakarta Bean Validation) support |
| IDE metadata/autocomplete | No | Yes, via `spring-boot-configuration-processor` |

---

## 7. Validating Configuration Properties

Adding `@Validated` to a `@ConfigurationProperties` class (alongside Jakarta Bean Validation annotations like `@NotBlank`, `@NotNull`, `@Min`, `@Max`, `@Pattern`) causes Spring Boot to **fail fast at startup** if the bound configuration is invalid — far preferable to discovering a missing or malformed property only when a request first exercises that code path in production.

```java
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    @NotBlank(message = "app.jwt.secret must not be blank")
    private String secret;

    @Min(value = 60_000, message = "app.jwt.expiration-ms must be at least 60000 (1 minute)")
    private long expirationMs;

    @NotBlank
    private String issuer;

    // getters and setters omitted for brevity
}
```

If `app.jwt.secret` is missing or blank when the application starts, Spring Boot throws a `ConfigurationPropertiesBindException` wrapping a `BindValidationException` that clearly names the offending property and the violated constraint, and the application refuses to start — this is exactly the desired behavior for a value like a JWT signing secret, where silently starting with a blank or default secret would be a serious security defect rather than a mere inconvenience.

You must also add the `spring-boot-configuration-processor` dependency (typically `optional`/annotation-processor scoped) to get IDE autocomplete and inline documentation for your custom properties when typing them into `application.yml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-configuration-processor</artifactId>
    <optional>true</optional>
</dependency>
```

---

## 8. Common Properties Reference Table

| Property | Purpose |
|---|---|
| `server.port` | HTTP port the embedded server listens on (default `8080`) |
| `server.servlet.context-path` | Base path prefixed to every controller mapping |
| `server.error.include-stacktrace` | Controls whether stack traces appear in error responses (`never`/`always`/`on_param`) |
| `spring.datasource.url` | JDBC connection URL |
| `spring.datasource.username` / `.password` | Database credentials |
| `spring.datasource.hikari.maximum-pool-size` | Max connections in the HikariCP pool |
| `spring.jpa.hibernate.ddl-auto` | Schema management strategy: `none`, `validate`, `update`, `create`, `create-drop` |
| `spring.jpa.show-sql` | Logs generated SQL statements to the console |
| `spring.jpa.properties.hibernate.format_sql` | Pretty-prints logged SQL |
| `spring.profiles.active` | Which profile(s) are active |
| `spring.application.name` | Logical application name (used in logs, Actuator, service discovery) |
| `logging.level.<package>` | Sets the log level for a specific package or class |
| `logging.file.name` | Redirects log output to a file in addition to console |
| `management.endpoints.web.exposure.include` | Which Actuator endpoints are exposed over HTTP |

`spring.jpa.hibernate.ddl-auto=update` deserves a specific callout because it is convenient in local development (Hibernate automatically evolves the schema to match your entities) but actively dangerous in production, where an unreviewed schema change triggered by a code deploy can silently alter a live database; production environments should use `validate` (fail if the schema doesn't match) paired with a proper migration tool such as Flyway or Liquibase.

---

## 9. Externalizing Secrets

Database passwords, JWT signing secrets, API keys, and any other credential must never be committed to `application.properties`/`.yml` in version control. The standard approaches, in increasing order of operational maturity:

**1. Environment variables**, referenced from the properties file using placeholder syntax so the file itself contains no secret, only a variable name:

```properties
spring.datasource.password=${DB_PASSWORD}
app.jwt.secret=${JWT_SECRET}
```

```bash
export DB_PASSWORD=$(vault kv get -field=password secret/orders-db)
export JWT_SECRET=$(vault kv get -field=secret secret/orders-jwt)
java -jar orders-service.jar
```

**2. Platform-native secret injection** — Kubernetes Secrets mounted as environment variables or files, Docker Compose `secrets:`, or a cloud provider's secret manager (AWS Secrets Manager, Azure Key Vault) injected into the container's environment at deploy time, so the secret never touches the application's own configuration files or image layers.

**3. A centralized configuration/secret server**, such as Spring Cloud Config Server backed by a Vault secret backend, which serves configuration (including secrets) to applications over HTTP at startup, centralizing rotation and access control instead of scattering secrets across every service's deployment manifest. This is covered in more depth in the Microservices phase.

A `.gitignore` entry for any local override file containing real secrets (commonly `application-local.yml` or `.env`) is a minimal but essential safeguard, and secret-scanning pre-commit hooks (e.g., `gitleaks`, `truffleHog`) catch the case where a developer forgets and commits a real credential anyway.

---

## 10. Common Pitfalls

**Committing real secrets in `application.properties` "temporarily."** This is the single most common and most damaging mistake — once a secret is committed, it exists in git history permanently unless the history itself is rewritten, and rotating the leaked credential becomes mandatory the moment it's discovered, regardless of whether the repository is later fixed.

**Mixing `.properties` and `.yml` in the same project.** Both formats loading simultaneously (especially across profile-specific and base files) creates a confusing situation where it's unclear which file "wins" for a given key, especially since `.properties` has a slight precedence edge for the exact same profile — pick one format per project and stay consistent.

**Setting `spring.jpa.hibernate.ddl-auto=update` (or worse, `create`) in a production profile.** This is convenient in development but risks Hibernate silently altering a live production schema based on entity class changes shipped in a deploy, with no review step — production should use `validate` alongside an explicit migration tool.

**Assuming `application-{profile}.yml` files replace the base `application.yml` entirely.** They are merged on top of the base file, not a full replacement — properties not repeated in the profile-specific file still come from the base file, which is by design but frequently misunderstood by developers expecting profile files to be self-contained.

**Forgetting that YAML indentation errors fail silently.** A YAML property nested one level too deep (or too shallow) due to a stray space does not throw a parse error in many cases — it simply binds to a different, unintended property path, and the application starts successfully with the wrong configuration silently in effect.

**Using `@Value` for a large, related group of properties instead of `@ConfigurationProperties`.** This leads to dozens of scattered `@Value` fields across multiple classes, no validation, no IDE autocomplete, and no single place to see the full shape of a configuration concern — exactly the maintenance problem `@ConfigurationProperties` exists to solve.

---

## 11. Best Practices

- Pick one configuration format (`.properties` or `.yml`) per project and use it consistently; do not let both accumulate over time.
- Use `@ConfigurationProperties` (ideally backed by an immutable Java `record`) for any related group of three or more properties; reserve `@Value` for single, standalone values.
- Add `@Validated` with Jakarta Bean Validation annotations to configuration property classes holding anything security- or correctness-critical, so misconfiguration fails at startup rather than at request time.
- Never commit real secrets; reference them via `${ENV_VAR}` placeholders and inject the actual values through environment variables, a container orchestrator's secret mechanism, or a config/secret server.
- Keep `application.yml` limited to shared, environment-agnostic defaults; put everything environment-specific in `application-{profile}.yml` files.
- Use `spring.jpa.hibernate.ddl-auto=validate` (never `update`/`create`) outside local development, paired with an explicit schema migration tool like Flyway or Liquibase.
- Add `spring-boot-configuration-processor` to any project defining custom `@ConfigurationProperties` classes so IDEs offer autocomplete and inline documentation for the custom keys.
- Prefer setting the active profile via an environment variable (`SPRING_PROFILES_ACTIVE`) at deploy time over hardcoding `spring.profiles.active` inside a committed properties file, so the same artifact can be promoted unchanged from staging to production.

---

## 12. Hands-On Exercises

**Exercise 1:** Create `application.yml` with a shared `spring.application.name`, then create `application-dev.yml` and `application-prod.yml`, each setting a different `spring.datasource.url` (an H2 in-memory URL for dev, a placeholder PostgreSQL URL for prod) and a different `logging.level.root`. Start the application with `--spring.profiles.active=dev` and confirm (via a log line or an injected `Environment` bean printed at startup) that the dev datasource URL and log level are in effect; repeat with `--spring.profiles.active=prod` and confirm the values switch accordingly.

**Exercise 2:** Demonstrate the precedence order concretely. Set `server.port=8080` in `application.properties`. Then run the application with the environment variable `SERVER_PORT=8081` set and confirm (via the startup log line reporting the Tomcat port) it starts on 8081, not 8080. Then run again adding the command-line argument `--server.port=8082` while the environment variable is still set to 8081, and confirm the application starts on 8082 — proving command-line arguments outrank environment variables, which outrank properties files.

**Exercise 3:** Build a `@ConfigurationProperties` class named `AppProperties` (using a Java record) bound to prefix `app`, with a nested `Jwt` record containing `secret` (String) and `expirationMs` (long) fields. Annotate it `@Validated` with `@NotBlank` on `secret` and `@Min(60000)` on `expirationMs`. Deliberately leave `app.jwt.secret` unset in `application.yml` and start the application — confirm it fails to start with a `BindValidationException` naming `secret` specifically. Then set the property and confirm normal startup.

**Exercise 4:** Write a small `@RestController` endpoint `/config/jwt-issuer` that returns the `issuer` field from your injected `AppProperties` bean. Set `app.jwt.issuer=orders-service` in `application.yml`. Override it at runtime with the environment variable `APP_JWT_ISSUER=orders-service-staging` and confirm the endpoint's response changes accordingly without any code change or rebuild — demonstrating relaxed binding converting the env var's `APP_JWT_ISSUER` naming into the nested `app.jwt.issuer` property path.

**Exercise 5:** Simulate secret externalization end to end. Remove any hardcoded database password from `application.yml`, replacing it with `spring.datasource.password=${DB_PASSWORD}`. Attempt to start the application with `DB_PASSWORD` unset and observe the connection failure. Then export `DB_PASSWORD` with the correct value and confirm successful startup and a working database connection. Finally, run `git log -p -- application.yml` (or `git grep` across the repository) to confirm the real password string never appears anywhere in the committed history — only the `${DB_PASSWORD}` placeholder does.

---

## 13. Interview Q&A

**Q: What is Spring Boot's external configuration precedence order, and why is it designed the way it is?**
Answer: From highest to lowest precedence: command-line arguments, JNDI attributes, Java system properties, OS environment variables, `SPRING_APPLICATION_JSON`, profile-specific and base `application.properties`/`.yml` files located outside the jar, then the same files packaged inside the jar, then `@PropertySource`-declared files, then default properties set programmatically. The ordering intentionally favors configuration closer to the actual deployment moment and environment — a command-line flag or environment variable set by the platform at runtime should always be able to override a value baked into the artifact at build time, which is what makes the same built jar promotable unchanged across dev, staging, and production.

**Q: What is the difference between `@Value` and `@ConfigurationProperties`, and when would you choose one over the other?**
Answer: `@Value("${key}")` injects a single property (optionally a SpEL expression) directly into a field or parameter, and is best suited to one or two standalone values. `@ConfigurationProperties(prefix = "...")` binds an entire prefixed group of related properties — including nested objects and lists — onto a dedicated, strongly-typed class in one step, and additionally supports Jakarta Bean Validation via `@Validated` and IDE autocomplete via the configuration-processor annotation processor. Once a related group of properties grows past two or three fields, `@ConfigurationProperties` is preferred because it centralizes the shape of that configuration concern, validates it at startup, and avoids scattering `@Value` fields with no structural relationship visible in code.

**Q: How do Spring profiles work, and how would you structure configuration for dev, staging, and prod environments?**
Answer: A profile is a named label that Spring Boot activates via `spring.profiles.active` (set through any of the precedence-ordered sources, most commonly an environment variable at deploy time). Configuration in `application-{profile}.properties`/`.yml` is merged on top of the shared base `application.properties`/`.yml`, so profile files only need to declare what differs from the shared defaults. Beans can be restricted to specific profiles with `@Profile("dev")` (or negated with `@Profile("!prod")`), which is the standard way to swap an entire implementation — such as a fake mail sender in dev versus a real SMTP sender in prod — without conditional logic scattered through business code.

**Q: What does "relaxed binding" mean in Spring Boot, and why does it exist?**
Answer: Relaxed binding lets the same logical property be expressed in kebab-case, camelCase, or UPPER_SNAKE_CASE and still bind to the same underlying configuration value — for example, `spring.datasource.connection-timeout` in a YAML file and `SPRING_DATASOURCE_CONNECTIONTIMEOUT` as an environment variable refer to the same property. It exists primarily because most operating systems do not allow dots or hyphens in environment variable names, yet environment variables are the standard mechanism for injecting configuration in containerized deployments — relaxed binding lets the same property be overridden from an environment variable without requiring a special naming convention to be hardcoded into the application's `@ConfigurationProperties` classes.

**Q: How would you make a Spring Boot application fail fast if a required configuration property is missing or invalid, rather than fail later at request time?**
Answer: Bind the required properties into a `@ConfigurationProperties` class annotated with `@Validated`, and add Jakarta Bean Validation annotations like `@NotBlank`, `@NotNull`, or `@Min` to the individual fields. Spring Boot validates the bound object during application startup as part of context refresh, and if validation fails it throws a binding exception that prevents the application from starting at all, rather than allowing it to start with an incomplete or invalid configuration that only surfaces as a failure the first time that code path executes in production. This is strongly preferred for anything correctness- or security-critical, such as a JWT signing secret or a required external service URL.

**Q: How should secrets like database passwords be handled in Spring Boot configuration, and what should never be done?**
Answer: Secrets should never be hardcoded or committed into `application.properties`/`.yml` in version control; instead, the properties file should reference a placeholder like `spring.datasource.password=${DB_PASSWORD}`, with the actual value supplied through an environment variable, a container orchestrator's native secret mechanism (Kubernetes Secrets, Docker secrets), or a centralized secret/config server such as Spring Cloud Config backed by Vault. If a secret is ever accidentally committed, the fix is not just removing it from the latest commit — the credential must be treated as compromised and rotated, since it remains recoverable from git history until the history itself is rewritten. Secret-scanning pre-commit hooks are a practical safeguard against this class of mistake.
