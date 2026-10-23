# REST Clients — RestTemplate, RestClient, and WebClient — Complete Guide

## Table of Contents
1. [Why This Matters](#1-why-this-matters)
2. [The Three Clients at a Glance](#2-the-three-clients-at-a-glance)
3. [RestTemplate — The Legacy Blocking Client](#3-resttemplate--the-legacy-blocking-client)
4. [RestClient — The Modern Fluent Blocking Client](#4-restclient--the-modern-fluent-blocking-client)
5. [WebClient — The Reactive Non-Blocking Client](#5-webclient--the-reactive-non-blocking-client)
6. [Timeouts and Retry Configuration](#6-timeouts-and-retry-configuration)
7. [Blocking vs Reactive — When To Use Which](#7-blocking-vs-reactive--when-to-use-which)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why This Matters

Once an application is split into multiple services, "calling another service" replaces "calling another method." A monolith's `OrderService.getCustomer(id)` becomes an HTTP call across the network to a `customer-service` that might be slow, down, or overloaded. Every microservice that calls another microservice needs an HTTP client, and the client's behavior — timeouts, retries, connection pooling, error handling — directly determines whether one slow downstream service takes down the whole system.

```
  order-service                      customer-service
  ┌─────────────────┐   HTTP GET     ┌──────────────────┐
  │ OrderController │ ─────────────▶ │ CustomerController│
  │       │         │  /customers/42 │        │          │
  │       ▼         │                │        ▼          │
  │  HTTP Client     │ ◀───────────── │   Customer JSON   │
  │ (RestTemplate /  │   200 OK        └──────────────────┘
  │  RestClient /     │
  │  WebClient)       │
  └─────────────────┘
```

Spring Boot has offered three generations of HTTP client for exactly this job. Understanding all three — and knowing which one a given codebase is using and why — is a baseline skill for anyone working on Spring-based microservices.

---

## 2. The Three Clients at a Glance

| Client | Introduced | Style | Status | Underlying Engine |
|--------|-----------|-------|--------|--------------------|
| `RestTemplate` | Spring 3.0 (2009) | Blocking, imperative | Maintenance mode since Spring 5 (no new features) | `ClientHttpRequestFactory` (JDK `HttpURLConnection`, Apache HttpClient, etc.) |
| `RestClient` | Spring Framework 6.1 / Boot 3.2 (2023) | Blocking, fluent builder | Actively developed, recommended for new blocking code | Same `ClientHttpRequestFactory` SPI as `RestTemplate` |
| `WebClient` | Spring 5.0 (2017, WebFlux) | Reactive, non-blocking | Actively developed, required in reactive stacks | Reactor Netty (or other reactive HTTP connectors) |

The Spring team's own guidance (as of Spring Framework 6.1 documentation) is blunt: **`RestTemplate` is in maintenance mode and will receive only minor bug fixes; new code should use `RestClient`.** `WebClient` remains the right choice specifically when the surrounding code is already reactive (returns `Mono`/`Flux`) or must handle high-concurrency I/O without blocking a thread per request.

```
  Decision at a glance
  ┌─────────────────────────────────────────────────────────┐
  │ Is the calling code already reactive (WebFlux)?         │
  │   YES → use WebClient                                   │
  │   NO  → is this legacy code already using RestTemplate? │
  │           YES → leave it, or migrate to RestClient      │
  │                 opportunistically                        │
  │           NO  → use RestClient (new code, Boot 3.2+)     │
  └─────────────────────────────────────────────────────────┘
```

---

## 3. RestTemplate — The Legacy Blocking Client

`RestTemplate` has been the default synchronous HTTP client in Spring since 2009. It is still present in a huge number of production codebases, so reading and maintaining it is a required skill even though you shouldn't start new projects with it.

### Bean Configuration

```java
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import java.time.Duration;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate customerRestTemplate(RestTemplateBuilder builder) {
        return builder
                .rootUri("http://localhost:8081")
                .connectTimeout(Duration.ofSeconds(2))
                .readTimeout(Duration.ofSeconds(3))
                .build();
    }
}
```

`RestTemplateBuilder` is the Spring Boot–provided way to construct a `RestTemplate` — it applies Boot's default message converters and lets you set timeouts declaratively instead of wiring a `ClientHttpRequestFactory` by hand.

### Calling a Downstream Service

```java
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class CustomerClient {

    private final RestTemplate restTemplate;

    public CustomerClient(RestTemplate customerRestTemplate) {
        this.restTemplate = customerRestTemplate;
    }

    public CustomerResponse getCustomer(Long id) {
        // Simple GET with automatic JSON -> record deserialization
        return restTemplate.getForObject("/customers/{id}", CustomerResponse.class, id);
    }

    public CustomerResponse getCustomerWithHeaders(Long id, String authToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(authToken);
        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

        ResponseEntity<CustomerResponse> response = restTemplate.exchange(
                "/customers/{id}",
                HttpMethod.GET,
                requestEntity,
                CustomerResponse.class,
                id
        );
        return response.getBody();
    }

    public CustomerResponse createCustomer(CustomerRequest request) {
        return restTemplate.postForObject("/customers", request, CustomerResponse.class);
    }
}

record CustomerRequest(String name, String email) {}
record CustomerResponse(Long id, String name, String email) {}
```

`getForObject` and `postForObject` cover the common cases. `exchange` is the escape hatch when you need custom headers, a specific `HttpMethod`, or access to the full `ResponseEntity` (status code, headers, body).

### Error Handling

By default, `RestTemplate` throws `HttpClientErrorException` for 4xx responses and `HttpServerErrorException` for 5xx responses:

```java
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;

public CustomerResponse getCustomerSafely(Long id) {
    try {
        return restTemplate.getForObject("/customers/{id}", CustomerResponse.class, id);
    } catch (HttpClientErrorException.NotFound ex) {
        throw new CustomerNotFoundException(id);
    } catch (HttpServerErrorException ex) {
        throw new DownstreamServiceException("customer-service", ex);
    }
}
```

---

## 4. RestClient — The Modern Fluent Blocking Client

`RestClient`, added in Spring Framework 6.1 (Spring Boot 3.2, November 2023), gives `RestTemplate`'s synchronous, thread-per-request model a modern fluent API modeled after `WebClient`'s builder style — without requiring the reactive/Reactor Netty stack.

### Bean Configuration

```java
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient customerRestClient(RestClient.Builder builder) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2_000);
        factory.setReadTimeout(3_000);

        return builder
                .baseUrl("http://localhost:8081")
                .requestFactory(factory)
                .defaultHeader("X-Client", "order-service")
                .build();
    }
}
```

`RestClient.Builder` is auto-configured by Spring Boot (respecting `spring.http.client` timeout properties too — see Section 6), so in the simplest case you can just inject `RestClient.Builder` and call `.baseUrl(...).build()`.

### Calling a Downstream Service

```java
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.HttpClientErrorException;

@Service
public class CustomerRestClientService {

    private final RestClient restClient;

    public CustomerRestClientService(RestClient customerRestClient) {
        this.restClient = customerRestClient;
    }

    public CustomerResponse getCustomer(Long id) {
        return restClient.get()
                .uri("/customers/{id}", id)
                .retrieve()
                .body(CustomerResponse.class);
    }

    public CustomerResponse getCustomerWithErrorHandling(Long id) {
        return restClient.get()
                .uri("/customers/{id}", id)
                .retrieve()
                .onStatus(status -> status.value() == 404,
                        (request, response) -> {
                            throw new CustomerNotFoundException(id);
                        })
                .onStatus(status -> status.is5xxServerError(),
                        (request, response) -> {
                            throw new DownstreamServiceException("customer-service",
                                    response.getStatusCode());
                        })
                .body(CustomerResponse.class);
    }

    public CustomerResponse createCustomer(CustomerRequest request) {
        return restClient.post()
                .uri("/customers")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(CustomerResponse.class);
    }

    public ResponseEntity<CustomerResponse> getCustomerFullResponse(Long id) {
        return restClient.get()
                .uri("/customers/{id}", id)
                .retrieve()
                .toEntity(CustomerResponse.class);
    }
}
```

The fluent chain (`.get().uri(...).retrieve().body(...)`) reads top-to-bottom like the request itself: method, URI, execute, extract body. This is the same mental model `WebClient` uses, which makes migrating between the two straightforward if a service later needs to go reactive.

### RestClient Built From an Existing RestTemplate

If a legacy codebase already has a configured `RestTemplate` (custom interceptors, message converters), `RestClient` can wrap it directly instead of reconfiguring everything from scratch:

```java
RestClient restClient = RestClient.create(existingRestTemplate);
```

---

## 5. WebClient — The Reactive Non-Blocking Client

`WebClient` is part of Spring WebFlux. It never blocks the calling thread waiting for a response — the HTTP call returns a `Mono<T>` (0 or 1 result) or `Flux<T>` (0..N results) immediately, and the actual response is delivered asynchronously to whatever subscribes to it.

### Bean Configuration

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.channel.ChannelOption;
import io.netty.channel.ChannelOption.*;
import java.time.Duration;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient customerWebClient(WebClient.Builder builder) {
        HttpClient httpClient = HttpClient.create()
                .option(io.netty.channel.ChannelOption.CONNECT_TIMEOUT_MILLIS, 2_000)
                .responseTimeout(Duration.ofSeconds(3));

        return builder
                .baseUrl("http://localhost:8081")
                .clientConnector(new org.springframework.http.client.reactive.ReactorClientHttpConnector(httpClient))
                .build();
    }
}
```

### Calling a Downstream Service

```java
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

@Service
public class CustomerWebClientService {

    private final WebClient webClient;

    public CustomerWebClientService(WebClient customerWebClient) {
        this.webClient = customerWebClient;
    }

    public Mono<CustomerResponse> getCustomer(Long id) {
        return webClient.get()
                .uri("/customers/{id}", id)
                .retrieve()
                .onStatus(status -> status.value() == 404,
                        response -> Mono.error(new CustomerNotFoundException(id)))
                .bodyToMono(CustomerResponse.class);
    }

    public Mono<CustomerResponse> createCustomer(CustomerRequest request) {
        return webClient.post()
                .uri("/customers")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(CustomerResponse.class);
    }

    // If a caller is in a traditional (non-reactive) MVC controller and
    // truly needs a synchronous result, block() converts Mono -> value.
    // This is an anti-pattern most of the time — see Section 7.
    public CustomerResponse getCustomerBlocking(Long id) {
        return getCustomer(id)
                .timeout(Duration.ofSeconds(3))
                .block();
    }
}
```

### Composing Multiple Reactive Calls

The real payoff of `WebClient` shows up when combining calls concurrently instead of sequentially:

```java
import reactor.core.publisher.Mono;

public Mono<OrderSummary> getOrderSummary(Long orderId, Long customerId) {
    Mono<Order> orderMono = orderWebClient.get()
            .uri("/orders/{id}", orderId)
            .retrieve()
            .bodyToMono(Order.class);

    Mono<CustomerResponse> customerMono = customerWebClient.get()
            .uri("/customers/{id}", customerId)
            .retrieve()
            .bodyToMono(CustomerResponse.class);

    // Both HTTP calls fire concurrently; total latency ~= max(order, customer)
    // instead of sum(order, customer) as with sequential blocking calls.
    return Mono.zip(orderMono, customerMono)
            .map(tuple -> new OrderSummary(tuple.getT1(), tuple.getT2()));
}

record OrderSummary(Object order, CustomerResponse customer) {}
```

---

## 6. Timeouts and Retry Configuration

Every downstream call must have an explicit timeout. Without one, a hung downstream service will hold your thread (or, for `WebClient`, an event loop resource) indefinitely, and under load this exhausts the thread pool or connection pool and takes down the calling service too — this is exactly how cascading failures start.

| Client | Connect Timeout | Read/Response Timeout |
|--------|-----------------|------------------------|
| `RestTemplate` | `RestTemplateBuilder.connectTimeout(Duration)` | `RestTemplateBuilder.readTimeout(Duration)` |
| `RestClient` | Configured on the underlying `ClientHttpRequestFactory` (e.g. `SimpleClientHttpRequestFactory`, or Boot's `spring.http.client.connect-timeout` property) | Same factory, `setReadTimeout(...)` / `spring.http.client.read-timeout` |
| `WebClient` | `HttpClient.option(CONNECT_TIMEOUT_MILLIS, ...)` | `HttpClient.responseTimeout(Duration)` |

Application-level configuration for Boot 3.2+'s unified `spring.http.client` properties (used by both `RestTemplate` and `RestClient` auto-configuration):

```yaml
spring:
  http:
    client:
      connect-timeout: 2s
      read-timeout: 3s
```

### Retry with Spring Retry (blocking clients)

```java
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.stereotype.Service;

@Service
public class ResilientCustomerClient {

    private final RestClient restClient;

    public ResilientCustomerClient(RestClient customerRestClient) {
        this.restClient = customerRestClient;
    }

    @Retryable(
            retryFor = { java.net.SocketTimeoutException.class, HttpServerErrorException.class },
            maxAttempts = 3,
            backoff = @Backoff(delay = 200, multiplier = 2)
    )
    public CustomerResponse getCustomerWithRetry(Long id) {
        return restClient.get()
                .uri("/customers/{id}", id)
                .retrieve()
                .body(CustomerResponse.class);
    }
}
```

`@Retryable` requires `@EnableRetry` on a configuration class and the `spring-retry` dependency. Backoff with a multiplier avoids hammering an already-struggling downstream service (200ms, then 400ms, then 800ms). Retry is covered in more depth as a Resilience4j annotation in Lesson 2 — Spring Retry and Resilience4j's `@Retry` solve the same problem; most new projects standardize on Resilience4j since it also provides circuit breakers in the same library.

### Retry with WebClient (reactive)

```java
import reactor.util.retry.Retry;
import java.time.Duration;

public Mono<CustomerResponse> getCustomerWithRetry(Long id) {
    return webClient.get()
            .uri("/customers/{id}", id)
            .retrieve()
            .bodyToMono(CustomerResponse.class)
            .retryWhen(Retry.backoff(3, Duration.ofMillis(200))
                    .filter(ex -> ex instanceof WebClientResponseException.ServiceUnavailable));
}
```

---

## 7. Blocking vs Reactive — When To Use Which

```
  Traditional Spring MVC app (Tomcat, thread-per-request)
  ┌───────────────────────────────────────────────────────┐
  │  Incoming request → thread from pool assigned          │
  │       │                                                │
  │       ▼                                                │
  │  Controller calls RestClient.get()....body(...)        │
  │       │  (thread BLOCKS waiting for downstream reply)  │
  │       ▼                                                │
  │  Response returned, thread released back to pool       │
  └───────────────────────────────────────────────────────┘
  Fine as long as thread pool size covers peak concurrent
  in-flight downstream calls (with margin + timeouts).

  Reactive WebFlux app (Netty, event-loop)
  ┌───────────────────────────────────────────────────────┐
  │  Incoming request → handled on small event-loop pool   │
  │       │                                                │
  │       ▼                                                │
  │  Controller calls WebClient.get()....bodyToMono(...)   │
  │       │  (event loop thread is FREED immediately;       │
  │       │   callback resumes when response arrives)      │
  │       ▼                                                │
  │  Response delivered to subscriber, event loop reused    │
  └───────────────────────────────────────────────────────┘
  Scales to far more concurrent in-flight I/O with far
  fewer threads — but only pays off if the ENTIRE call
  chain is reactive (controller, service, repository).
```

**In a traditional (non-reactive) Spring MVC application, use `RestClient` for new code and leave existing `RestTemplate` usages alone unless you're actively refactoring them.** Do not introduce `WebClient` purely to make one outbound call inside an otherwise-blocking MVC controller — calling `.block()` on a `Mono` inside a servlet thread gives you all the complexity of reactive programming with none of its benefits, and worse, it risks deadlocking if done on a Netty event-loop thread (blocking is only safe there when explicitly scheduled off the event loop).

**Use `WebClient` when:**
- The application is already built on Spring WebFlux (reactive controllers returning `Mono`/`Flux`).
- You need to fire off several independent downstream calls concurrently and combine results (`Mono.zip`), rather than one at a time.
- The service is I/O-bound and needs to handle very high concurrent connection counts with a small, fixed thread pool (e.g., a gateway/BFF fanning out to many backend services).

**Use `RestClient` (or legacy `RestTemplate`) when:**
- The application is a traditional Spring MVC service (the overwhelming majority of Spring Boot microservices).
- Downstream calls are made one at a time as part of a synchronous request/response flow.
- The team has no reactive expertise on staff — reactive stack traces, backpressure, and schedulers have a real learning curve, and misusing them (e.g., blocking on an event loop) causes subtle production incidents.

---

## 8. Common Pitfalls

- **No timeout configured at all.** The JDK's default `HttpURLConnection` has no timeout, meaning a default-constructed `RestTemplate` can hang forever on a stalled connection. Always set connect and read timeouts explicitly.
- **Calling `.block()` inside a WebFlux request-handling thread.** This can deadlock the Netty event loop under load because the very thread waiting for a result is the one meant to deliver it. If you must bridge reactive to blocking, use `Schedulers.boundedElastic()` or restructure the call to stay reactive end-to-end.
- **Reusing a single `RestTemplate`/`RestClient`/`WebClient` instance without connection pooling limits.** The default `SimpleClientHttpRequestFactory` opens a new connection per request; under load, configure Apache HttpClient or Reactor Netty's connection pool explicitly.
- **Swallowing exceptions instead of distinguishing error types.** Catching a blanket `Exception` around an HTTP call hides whether the failure was a 404 (client shouldn't retry), a 503 (client should retry/circuit-break), or a timeout (different remediation again).
- **Forgetting that `RestTemplate` is not thread-safe to reconfigure at runtime**, but the shared bean itself is safe to call concurrently — the pitfall is mutating its `MessageConverters` or interceptors after startup from multiple threads.
- **Using `WebClient` "because it's newer" for a plain blocking MVC app.** This adds reactive complexity with no performance win when the rest of the call stack is synchronous anyway; `RestClient` gives the same fluent ergonomics without the reactive learning curve.

---

## 9. Best Practices

- Default to **`RestClient` for all new blocking-style Spring Boot 3.2+ code**; only reach for `WebClient` when the surrounding stack is genuinely reactive.
- Always set **both a connect timeout and a read/response timeout** on every HTTP client bean — never rely on defaults.
- Create **one client bean per downstream service** (e.g., `customerRestClient`, `inventoryRestClient`) with its own `baseUrl` and timeout profile, rather than one shared generic client — different downstream services have different latency/SLA characteristics.
- Centralize error translation (mapping HTTP status codes to domain exceptions) in the client class, not scattered across every caller.
- Pair every outbound call with the resilience patterns from Lesson 2 (`@CircuitBreaker`, `@Retry`) rather than hand-rolling retry loops.
- Log the downstream service name, URI, and duration on every call (or rely on Micrometer's automatic HTTP client instrumentation) so latency regressions are visible before they cause outages.
- When migrating from `RestTemplate`, do it incrementally per-client-bean rather than as one large rewrite — the fluent API shapes are similar enough that this is low-risk.

---

## 10. Hands-On Exercises

**Exercise 1:** Build two Spring Boot applications: `customer-service` (exposes `GET /customers/{id}` returning a JSON body) and `order-service` (calls `customer-service`). In `order-service`, implement the client three ways in three separate classes — one using `RestTemplate`, one using `RestClient`, and one using `WebClient` (with `.block()` for a simple synchronous test). Confirm all three return the same result.

**Exercise 2:** Configure a 500ms read timeout on your `RestClient` bean. In `customer-service`, add a `Thread.sleep(2000)` to the `GET /customers/{id}` handler to simulate a slow downstream call. Call it from `order-service` and confirm you get a timeout exception rather than hanging indefinitely.

**Exercise 3:** Using `WebClient`, write a method that concurrently calls two different downstream endpoints (e.g., `/customers/{id}` and `/orders/{id}`) using `Mono.zip`, and measure the total latency. Compare it against calling the same two endpoints sequentially with blocking `RestClient` calls, and confirm the reactive version's total latency is close to `max(latencyA, latencyB)` rather than `latencyA + latencyB`.

**Exercise 4:** Add `@Retryable` (from `spring-retry`) to a `RestClient`-based method with `maxAttempts = 3` and exponential backoff. Make `customer-service` fail with a 503 on the first two calls and succeed on the third (e.g., using a request counter), and confirm the retry logic recovers without the caller seeing an error.

**Exercise 5:** Deliberately call `.block()` on a `Mono` from inside a `@RestController` method annotated to run on a WebFlux Netty event loop, under a small concurrent load test (e.g., 50 concurrent requests with a tool like `hey` or `wrk`), and observe request latency/thread starvation behavior. Then refactor the same endpoint to return the `Mono` directly instead of blocking, and compare throughput.

---

## 11. Interview Q&A

**Q: What's the difference between RestTemplate, RestClient, and WebClient?**
Answer: `RestTemplate` is the original blocking, synchronous HTTP client from Spring 3.0 — it's in maintenance mode as of Spring Framework 5+ and only receives bug fixes. `RestClient`, added in Spring Framework 6.1 / Boot 3.2, is a modern fluent-API blocking client that is the recommended replacement for `RestTemplate` in new synchronous code — same blocking thread-per-request model, nicer API. `WebClient` is the reactive, non-blocking client from Spring WebFlux; calls return `Mono`/`Flux` and never block the calling thread, which matters for high-concurrency I/O-bound services but adds real complexity that isn't worth it for a plain blocking MVC application.

**Q: Why is RestTemplate considered "legacy" if it still works fine?**
Answer: It still functions correctly and is safe to keep in existing codebases, but the Spring team has explicitly frozen its feature set — no new capabilities will be added, only critical bug fixes. `RestClient` provides the same synchronous, blocking execution model with a more ergonomic fluent builder API (closer to `WebClient`'s style), better default error handling hooks via `onStatus`, and ongoing active development, so new code should use it instead.

**Q: When would you choose WebClient over RestClient in a Spring Boot application?**
Answer: Choose `WebClient` when the application is built on Spring WebFlux and the call chain is reactive end-to-end (controller returns `Mono`/`Flux`, repository is reactive), or when you specifically need to fire multiple downstream calls concurrently and combine results without blocking threads (e.g., an API gateway fanning out to several backend services). If the surrounding application is a traditional Spring MVC app making one downstream call at a time synchronously, `RestClient` is the better choice — introducing `WebClient` there just to call `.block()` adds reactive complexity for no benefit.

**Q: Why is it dangerous to configure an HTTP client without a timeout?**
Answer: Without an explicit connect and read timeout, a client thread can hang indefinitely waiting on a stalled or unresponsive downstream service. Under load, many such hung calls exhaust the calling service's thread pool (in MVC) or block critical event-loop resources (in WebFlux), which prevents the service from handling any other requests — including ones unrelated to the failing downstream dependency. This is one of the most common root causes of cascading failures in microservice architectures, which is why timeouts are considered non-negotiable, not just an optimization.

**Q: What happens if you call .block() on a Mono inside a WebFlux request handler running on the Netty event loop, and why is it dangerous?**
Answer: Calling `.block()` synchronously waits for the `Mono` to complete on the same thread that is meant to be freed to process other requests. In a WebFlux application, that thread is one of a small, fixed-size pool of event-loop threads; blocking one of them reduces the pool's effective capacity and, in the worst case (e.g., the response depends on work scheduled back onto that same event loop), can deadlock. The safe pattern is to keep the entire chain reactive, or if bridging to blocking code is unavoidable, explicitly move the blocking call onto a separate scheduler such as `Schedulers.boundedElastic()`.

**Q: How would you add retry behavior to an outbound HTTP call, and what's the difference between doing it for RestClient vs WebClient?**
Answer: For blocking clients like `RestTemplate`/`RestClient`, retries are typically added declaratively with Spring Retry's `@Retryable` annotation (requires `@EnableRetry`), specifying which exceptions trigger a retry, `maxAttempts`, and a `@Backoff` policy — ideally exponential backoff so retries don't hammer an already-struggling service. For `WebClient`, retries are composed reactively using `Mono#retryWhen(Retry.backoff(...))` from Reactor's `reactor.util.retry.Retry` class, filtered to only retry on specific exception types (e.g., 503 responses), since blindly retrying every error (including 4xx client errors) is both wasteful and can mask real bugs.
