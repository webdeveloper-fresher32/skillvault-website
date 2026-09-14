# Packaging, Observability, and Deployment — Complete Guide

## Table of Contents

1. [From Code to a Running Production Service](#1-from-code-to-a-running-production-service)
2. [Executable JAR vs WAR](#2-executable-jar-vs-war)
3. [Layered JARs and Docker Image Caching](#3-layered-jars-and-docker-image-caching)
4. [Buildpacks (spring-boot:build-image) vs a Manual Dockerfile](#4-buildpacks-spring-bootbuild-image-vs-a-manual-dockerfile)
5. [Worked Example — Multi-Stage Dockerfile](#5-worked-example--multi-stage-dockerfile)
6. [Structured JSON Logging](#6-structured-json-logging)
7. [Micrometer and Prometheus Metrics Export](#7-micrometer-and-prometheus-metrics-export)
8. [Graceful Shutdown](#8-graceful-shutdown)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. From Code to a Running Production Service

Everything in this course up to now has produced correct application logic. This lesson closes the loop: turning that logic into an artifact that can actually be deployed, observed, and safely restarted in a real environment. Three concerns dominate this step — how the application is packaged and containerized, how it reports what it's doing (logs and metrics) once running, and how it shuts down without dropping in-flight work during a rolling deployment.

```
  Source code  →  Build  →  Container image  →  Deployed instance
  ┌──────────┐   ┌───────┐   ┌───────────────┐   ┌──────────────────────┐
  │  *.java   │──▶│ JAR   │──▶│ layered image  │──▶│ logs: JSON to stdout │
  │  *.yml    │   │       │   │ (small, cached) │   │ metrics: /prometheus │
  └──────────┘   └───────┘   └───────────────┘   │ shutdown: graceful   │
                                                    └──────────────────────┘
```

---

## 2. Executable JAR vs WAR

Spring Boot's default packaging is an **executable ("fat") JAR** — a single file containing your compiled classes, all dependency JARs, and an embedded servlet container (Tomcat by default, or Jetty/Undertow). Running it requires nothing but a JVM: `java -jar app.jar` starts the embedded server and the application together.

```xml
<!-- pom.xml — default packaging, produces an executable jar -->
<packaging>jar</packaging>

<build>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
        </plugin>
    </plugins>
</build>
```

```bash
mvn clean package
java -jar target/order-service-1.4.2.jar
```

A **WAR** is still supported, but only matters when deploying into an *externally managed* servlet container (an existing Tomcat/WebSphere/WebLogic install that a platform team already runs and wants to keep controlling — common in legacy enterprise environments migrating gradually to Spring Boot). To produce one, switch packaging and extend `SpringBootServletInitializer` so the app can bootstrap correctly when launched by an external container instead of its own embedded one:

```xml
<packaging>war</packaging>
```

```java
package com.example.orders;

import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

public class OrderServiceApplication extends SpringBootServletInitializer {

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder application) {
        return application.sources(OrderServiceApplication.class);
    }
}
```

For any greenfield service, especially one being containerized, the executable JAR is the correct default: it is self-contained, requires no separately managed servlet container, and is exactly what makes a Spring Boot app trivially "just run this JAR in a container" rather than "deploy this artifact into a container someone else administers."

---

## 3. Layered JARs and Docker Image Caching

A naive Dockerfile that `COPY`s the whole fat JAR and runs it works, but it is inefficient to rebuild: every code change — even a one-line change deep in business logic — invalidates the Docker layer containing the entire JAR, forcing a full re-push of every dependency on every deploy, even though the dependencies themselves didn't change.

Spring Boot's **layered JAR** feature splits the fat JAR into logical layers that change at very different rates:

```
  Layered JAR structure (from fastest-changing to slowest-changing)
  ┌─────────────────────────────────────────────────────────┐
  │ application     ← your own compiled classes (changes    │
  │                    on every commit)                       │
  │ snapshot-deps    ← SNAPSHOT dependency jars (changes      │
  │                    occasionally)                          │
  │ dependencies     ← regular, released dependency jars      │
  │                    (rarely changes)                       │
  │ spring-boot-loader ← the loader bootstrap classes         │
  │                    (almost never changes)                 │
  └─────────────────────────────────────────────────────────┘
```

Layering is on by default in modern Spring Boot Maven/Gradle plugin versions. You can inspect or customize it:

```bash
# Extract the layers from a built jar to inspect them
java -Djarmode=layertools -jar target/order-service-1.4.2.jar list
# dependencies
# spring-boot-loader
# snapshot-dependencies
# application
```

When a Dockerfile `COPY`s each layer into the image as a *separate instruction*, Docker's build cache treats each layer independently. Since `dependencies` and `spring-boot-loader` almost never change between builds, Docker reuses the cached layers for them and only rebuilds (and re-pushes) the thin `application` layer that actually changed — turning most rebuilds from "push the whole fat JAR" into "push a few KB of your own classes."

```dockerfile
# Extraction stage — split the fat jar into layers
FROM eclipse-temurin:21-jre AS builder
WORKDIR /application
COPY target/order-service-*.jar application.jar
RUN java -Djarmode=layertools -jar application.jar extract

# Final image — copy each layer as its own instruction, slowest-changing first
FROM eclipse-temurin:21-jre
WORKDIR /application
COPY --from=builder /application/dependencies/ ./
COPY --from=builder /application/spring-boot-loader/ ./
COPY --from=builder /application/snapshot-dependencies/ ./
COPY --from=builder /application/application/ ./
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

---

## 4. Buildpacks (spring-boot:build-image) vs a Manual Dockerfile

Spring Boot ships built-in integration with Cloud Native Buildpacks, which can produce a production-grade, layered OCI image directly from source, with no hand-written Dockerfile at all.

```bash
# Maven
mvn spring-boot:build-image

# Gradle
./gradlew bootBuildImage
```

```xml
<!-- pom.xml — optional customization of the buildpacks-produced image -->
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
        <image>
            <name>registry.example.com/order-service:${project.version}</name>
        </image>
    </configuration>
</plugin>
```

| | Buildpacks (`build-image`) | Manual multi-stage Dockerfile |
|---|---|---|
| Setup effort | none — built into the Spring Boot plugin | you write and maintain the Dockerfile |
| Layering | automatic (dependencies/loader/app split out of the box) | manual, but full control over exactly which layers exist |
| Base image / JRE updates | handled by buildpack vendor, rebuild picks up patches | you own updating the base image tag yourself |
| Customization (extra OS packages, non-JVM steps) | limited | unlimited — it's a full Dockerfile |
| Best for | most standard Spring Boot services, teams wanting less Docker maintenance | services with unusual runtime requirements, or teams standardizing on a shared base image across many languages |

Neither is strictly superior — buildpacks reduce Dockerfile maintenance burden and keep base images patched automatically, while a hand-written Dockerfile gives full control when a service needs something buildpacks don't easily support (installing a native library, a non-standard entrypoint, an unusual multi-process container). Many organizations use buildpacks as the default and fall back to a manual Dockerfile only for services with special requirements.

---

## 5. Worked Example — Multi-Stage Dockerfile

A complete, production-oriented multi-stage Dockerfile: it builds the JAR inside the image (so no local Maven install is required to produce a deployable image), extracts layers, and assembles a minimal final image running as a non-root user.

```dockerfile
# ---- Stage 1: build the application with Maven ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# ---- Stage 2: extract layered jar contents ----
FROM eclipse-temurin:21-jre AS layers
WORKDIR /application
COPY --from=build /workspace/target/order-service-*.jar application.jar
RUN java -Djarmode=layertools -jar application.jar extract

# ---- Stage 3: final, minimal runtime image ----
FROM eclipse-temurin:21-jre
WORKDIR /application

# Run as a dedicated non-root user rather than the container default root
RUN addgroup --system spring && adduser --system --ingroup spring spring
USER spring:spring

# Copy layers slowest-changing first, so the cache is maximally reused
COPY --from=layers /application/dependencies/ ./
COPY --from=layers /application/spring-boot-loader/ ./
COPY --from=layers /application/snapshot-dependencies/ ./
COPY --from=layers /application/application/ ./

EXPOSE 8080

# Give the JVM sane container-aware defaults and honor SIGTERM for graceful shutdown
ENTRYPOINT ["java", \
            "-XX:+UseContainerSupport", \
            "-XX:MaxRAMPercentage=75.0", \
            "org.springframework.boot.loader.launch.JarLauncher"]
```

```bash
docker build -t registry.example.com/order-service:1.4.2 .
docker run -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DB_PASSWORD=... \
  registry.example.com/order-service:1.4.2
```

Key production details this Dockerfile captures: a separate build stage keeps the Maven distribution and full source tree out of the final image; layering keeps rebuild pushes small; running as a non-root `spring` user rather than `root` limits blast radius if the container is ever compromised; and `-XX:MaxRAMPercentage` lets the JVM correctly size its heap relative to the container's memory limit rather than the host's total memory (a very common source of OOM-killed containers when left at JVM defaults).

---

## 6. Structured JSON Logging

Plain-text log lines are fine for a developer tailing a terminal, but a production log aggregation pipeline (ELK, Loki, Datadog, CloudWatch Logs Insights) needs structured, parseable fields — timestamp, level, logger, message, and any contextual key/value pairs (request ID, user ID, trace ID) — without regex-scraping free text.

Spring Boot 3.4+ ships built-in structured logging support with zero extra dependencies:

```yaml
# application-prod.yml
logging:
  structured:
    format:
      console: ecs   # or "logstash", "gelf" — built-in structured formats
```

For full control (or on versions predating built-in structured logging support), configure Logback directly with the `logstash-logback-encoder` library:

```xml
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
    <version>7.4</version>
</dependency>
```

```xml
<!-- src/main/resources/logback-spring.xml -->
<configuration>
    <springProfile name="prod">
        <appender name="STDOUT_JSON" class="ch.qos.logback.core.ConsoleAppender">
            <encoder class="net.logstash.logback.encoder.LogstashEncoder">
                <includeMdcKeyName>traceId</includeMdcKeyName>
                <includeMdcKeyName>spanId</includeMdcKeyName>
                <customFields>{"service":"order-service"}</customFields>
            </encoder>
        </appender>
        <root level="INFO">
            <appender-ref ref="STDOUT_JSON" />
        </root>
    </springProfile>

    <springProfile name="dev">
        <appender name="STDOUT_PLAIN" class="ch.qos.logback.core.ConsoleAppender">
            <encoder>
                <pattern>%d{HH:mm:ss.SSS} %-5level %logger{36} - %msg%n</pattern>
            </encoder>
        </appender>
        <root level="DEBUG">
            <appender-ref ref="STDOUT_PLAIN" />
        </root>
    </springProfile>
</configuration>
```

This produces one JSON object per log line in production, human-readable text locally:

```json
{"@timestamp":"2026-07-13T10:22:41.512Z","level":"INFO","logger_name":"com.example.orders.service.OrderService","message":"Order 8842 created","service":"order-service","traceId":"a1b2c3d4e5f6"}
```

Logging to `stdout` (not to a file inside the container) is the correct target in a containerized deployment — the container runtime or a sidecar log collector is responsible for shipping stdout to the aggregation backend; the application itself should never manage log file rotation or local disk paths.

---

## 7. Micrometer and Prometheus Metrics Export

Micrometer is Spring Boot's vendor-neutral metrics facade — the same instrumentation code can export to Prometheus, Datadog, New Relic, CloudWatch, or others just by swapping the registry dependency, with no application code changes.

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, prometheus
  metrics:
    tags:
      application: ${spring.application.name}
    distribution:
      percentiles-histogram:
        http.server.requests: true
```

With this dependency present, `/actuator/prometheus` exposes the entire Micrometer registry in Prometheus's text exposition format, ready to be scraped:

```bash
curl http://localhost:8080/actuator/prometheus
```

```
# HELP http_server_requests_seconds Duration of HTTP server request handling
# TYPE http_server_requests_seconds summary
http_server_requests_seconds_count{application="order-service",method="GET",status="200",uri="/api/orders"} 1284
http_server_requests_seconds_sum{application="order-service",method="GET",status="200",uri="/api/orders"} 12.481
jvm_memory_used_bytes{application="order-service",area="heap"} 1.87342E8
```

A Prometheus server is pointed at this endpoint via a scrape config (owned by the platform/observability team, not the application):

```yaml
# prometheus.yml (operated outside the application repo)
scrape_configs:
  - job_name: order-service
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ["order-service:8080"]
```

Custom business metrics are added directly with Micrometer's `MeterRegistry`, no extra library needed:

```java
package com.example.orders.service;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    private final MeterRegistry meterRegistry;

    public OrderService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public void createOrder(/* ... */) {
        // ... business logic ...
        meterRegistry.counter("orders.created", "channel", "web").increment();
    }
}
```

`orders_created_total{channel="web"}` then shows up in `/actuator/prometheus` automatically, ready for a Grafana dashboard or a Prometheus alerting rule (e.g. "page on-call if `rate(orders_created_total[5m])` drops to zero for 10 minutes").

---

## 8. Graceful Shutdown

When an orchestrator (Kubernetes, ECS, a load balancer draining an instance) decides to terminate an application instance — during a rolling deployment, a scale-down, or an autoscaling event — it sends `SIGTERM` and then waits a grace period before forcibly killing the process (`SIGKILL`). If the JVM exits immediately on `SIGTERM` without finishing in-flight requests, callers see connection resets and dropped responses right in the middle of a routine deployment.

Spring Boot supports graceful shutdown out of the box:

```yaml
server:
  shutdown: graceful

spring:
  lifecycle:
    timeout-per-shutdown-phase: 25s
```

With `server.shutdown: graceful`, the embedded web server (Tomcat/Jetty/Undertow) stops accepting *new* requests the moment `SIGTERM` is received, but continues serving requests that are already in flight for up to `timeout-per-shutdown-phase` before the context actually closes. Any request still running past that window is cut off, so this value should be set comfortably below the orchestrator's own termination grace period.

```yaml
# Kubernetes Deployment — must give more time than Spring's own shutdown timeout,
# so Spring finishes gracefully before Kubernetes escalates to SIGKILL
spec:
  terminationGracePeriodSeconds: 30   # > server.lifecycle.timeout-per-shutdown-phase (25s)
```

For zero dropped requests during a rolling update, graceful shutdown must be paired with the orchestrator also stopping traffic to the terminating pod *before* it's actually killed — in Kubernetes this means the pod is first removed from the Service's endpoint list (readiness turns false, or a `preStop` hook adds a short delay) so no new connections arrive during the drain window, while Spring Boot finishes off whatever was already in progress.

```yaml
# A common pattern: a short preStop sleep to let the Service's endpoint list
# propagate the removal before SIGTERM is even sent
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 5"]
```

---

## 9. Common Pitfalls

- **Copying the entire fat JAR as one Docker layer** instead of extracting and layering it — every code change then invalidates and re-pushes the whole dependency set, making deploys unnecessarily slow.
- **Running the container process as root.** The default Docker user is root unless explicitly changed with `USER`, which unnecessarily widens the blast radius of a container compromise.
- **Leaving the JVM heap sizing at defaults inside a memory-limited container**, causing the JVM to size its heap against the host's total memory rather than the container's cgroup limit — a classic cause of OOM-killed pods. `-XX:MaxRAMPercentage` (or equivalent container-aware flags) fixes this.
- **Writing logs to a file inside the container** instead of stdout — this fights against how container log collection actually works and risks filling the container's writable layer.
- **Not exporting Prometheus metrics** and relying only on the human-readable `/actuator/metrics` JSON endpoint — that endpoint is not what a monitoring/alerting pipeline scrapes.
- **Setting `terminationGracePeriodSeconds` (or the equivalent on other orchestrators) shorter than Spring's own `timeout-per-shutdown-phase`.** This means the orchestrator's hard kill fires before Spring even finishes its graceful drain, defeating the purpose entirely.
- **Assuming graceful shutdown alone prevents dropped requests during a rolling deploy.** Without also removing the pod from load balancer/Service rotation before sending `SIGTERM`, new requests can still arrive during the shutdown window.

---

## 10. Best Practices

- Default to an executable JAR; only produce a WAR when an existing, externally managed servlet container genuinely requires it.
- Always build container images with layered JAR extraction so unrelated code changes don't force a full dependency re-push.
- Use `spring-boot:build-image` (buildpacks) as the default packaging path for standard services to minimize Dockerfile maintenance; reach for a hand-written multi-stage Dockerfile only when a service has requirements buildpacks can't easily express.
- Run the container process as a dedicated non-root user.
- Log structured JSON to stdout in every non-local environment; keep plain-text console logging only for local development, gated by profile.
- Export metrics via `/actuator/prometheus` (or the equivalent registry for your monitoring vendor) rather than relying on the JSON `/actuator/metrics` endpoint for anything beyond ad-hoc debugging.
- Always configure `server.shutdown: graceful` with a `timeout-per-shutdown-phase` set comfortably below the orchestrator's own termination grace period, and coordinate the two so traffic stops arriving before the process actually exits.

---

## 11. Hands-On Exercises

**Exercise 1:** Build an executable JAR for an existing Spring Boot project with `mvn clean package`. Run `java -Djarmode=layertools -jar target/*.jar list` and confirm you see the four standard layers (`dependencies`, `spring-boot-loader`, `snapshot-dependencies`, `application`).

**Exercise 2:** Write the multi-stage Dockerfile from [Section 5](#5-worked-example--multi-stage-dockerfile) for your project, build it, and run it. Then make a one-line change to a single Java class, rebuild, and use `docker history` to confirm that only the `application` layer changed size/hash while the `dependencies` layer's hash stayed identical.

**Exercise 3:** Run `mvn spring-boot:build-image` on the same project and compare the resulting image size and layer count (via `docker inspect` or `docker history`) against the manually built Dockerfile image from Exercise 2. Note any differences in base image, layering strategy, or total size.

**Exercise 4:** Add `micrometer-registry-prometheus`, hit `/actuator/prometheus`, and confirm you see `http_server_requests_seconds_count` after making a few requests to any endpoint. Then add a custom `Counter` via `MeterRegistry` in a service class, trigger it, and confirm your custom metric name appears in the same endpoint's output.

**Exercise 5:** Configure `server.shutdown: graceful` with `spring.lifecycle.timeout-per-shutdown-phase: 10s`. Start the app, fire a request to a deliberately slow endpoint (add a `Thread.sleep(8000)` to a test controller), and send `SIGTERM` to the process (`kill -TERM <pid>`) while the request is still in flight. Confirm the in-flight request completes successfully before the process exits, and that a *new* request sent immediately after `SIGTERM` is refused.

---

## 12. Interview Q&A

**Q: What problem do layered JARs solve, and how do they interact with Docker's build cache?**
Answer: A fat JAR bundles your own classes together with every dependency into one file; copying it as a single Docker `COPY` instruction means any code change — however small — invalidates that entire layer, forcing a full re-push of all dependencies on every deploy. Layered JARs split the fat JAR into separate layers (dependencies, the Spring Boot loader, snapshot dependencies, and your application classes) ordered from slowest-changing to fastest-changing. When each layer is copied into the Docker image with its own instruction, Docker's build cache can reuse the unchanged dependency layers and only rebuild the thin application layer, dramatically shrinking the incremental image size pushed on each deploy.

**Q: When would you choose Cloud Native Buildpacks (`spring-boot:build-image`) over a hand-written Dockerfile?**
Answer: Buildpacks are the right default for most standard Spring Boot services — they require no Dockerfile maintenance, automatically produce a correctly layered image, and the base image/JRE gets security patches picked up by rebuilding without any manual base-image-tag bumping. A hand-written multi-stage Dockerfile is preferable when a service needs something buildpacks don't easily support — installing extra OS packages, a non-standard entrypoint, unusual multi-process containers, or when an organization wants a single standardized base image shared across services written in multiple languages.

**Q: Why should a containerized Spring Boot application log JSON to stdout rather than to a file?**
Answer: Container platforms are built around capturing a process's stdout/stderr and shipping it to a centralized aggregation backend (via the container runtime's logging driver or a sidecar collector) — that's the integration point the whole ecosystem assumes. Logging to a file inside the container instead fights that model: it risks filling the container's writable layer, requires the application to own log rotation, and needs an extra step to get those logs out of the container at all. Structured JSON (rather than plain text) additionally lets the aggregation backend parse fields like level, logger, and trace ID without fragile regex scraping.

**Q: What is the relationship between Micrometer and `/actuator/prometheus`?**
Answer: Micrometer is Spring Boot's vendor-neutral metrics facade — application code (and Spring Boot's own auto-instrumentation, e.g. `http.server.requests`) records metrics against a `MeterRegistry` without knowing which monitoring backend will ultimately consume them. Adding the `micrometer-registry-prometheus` dependency registers a Prometheus-specific registry implementation and activates the `/actuator/prometheus` endpoint, which serializes the entire registry into the Prometheus text exposition format on demand — exactly what a Prometheus server's scrape config expects. Swapping to a different backend (Datadog, CloudWatch) means swapping the registry dependency, not rewriting instrumentation code.

**Q: How does graceful shutdown work in Spring Boot, and what must be true for it to actually prevent dropped requests during a deployment?**
Answer: With `server.shutdown: graceful`, the embedded web server stops accepting new connections the moment it receives `SIGTERM` but keeps serving already-in-flight requests until they complete or a configured timeout (`spring.lifecycle.timeout-per-shutdown-phase`) elapses. For this to actually eliminate dropped requests during a rolling deployment, two other conditions must hold: the orchestrator's hard-kill grace period (e.g. Kubernetes's `terminationGracePeriodSeconds`) must be longer than Spring's own shutdown timeout, and traffic must stop being routed to the terminating instance before or at the same time `SIGTERM` is sent — otherwise new requests can still arrive at an instance that is already draining.

**Q: Why is `-XX:MaxRAMPercentage` important when running a JVM inside a container with a memory limit?**
Answer: Without container-aware sizing, a JVM can default its heap sizing calculations to the host machine's total physical memory rather than the container's cgroup memory limit, especially on older JVMs or misconfigured setups — causing the JVM to believe it has far more memory available than the container will actually allow. This leads to the container's memory limit being exceeded and the container runtime issuing an OOM-kill, often with a confusing "the JVM had plenty of free heap" symptom right before the crash. Setting `-XX:MaxRAMPercentage` (alongside modern JVMs' built-in container awareness) ensures heap sizing is calculated as a percentage of the container's actual memory limit, not the host's.
