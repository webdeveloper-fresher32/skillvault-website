# Integration Testing and Testcontainers — Complete Guide

## Table of Contents
1. [Recap — Unit, Slice, and Integration Tests](#1-recap--unit-slice-and-integration-tests)
2. [@SpringBootTest with a Real Embedded Server](#2-springboottest-with-a-real-embedded-server)
3. [TestRestTemplate vs WebTestClient](#3-testresttemplate-vs-webtestclient)
4. [Worked Example — Full-Stack Integration Test](#4-worked-example--full-stack-integration-test)
5. [Why H2 Can Hide Production-Only Bugs](#5-why-h2-can-hide-production-only-bugs)
6. [Introducing Testcontainers](#6-introducing-testcontainers)
7. [Worked Example — Testcontainers with Postgres](#7-worked-example--testcontainers-with-postgres)
8. [Reusing Containers Across Test Classes](#8-reusing-containers-across-test-classes)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Recap — Unit, Slice, and Integration Tests

The previous two lessons covered the bottom two tiers of the test pyramid: plain JUnit + Mockito unit tests that isolate a single class, and Spring Boot test slices (`@WebMvcTest`, `@DataJpaTest`, `@JsonTest`) that load only one architectural layer. This lesson covers the top of the pyramid for a typical Spring Boot service: **integration tests** that boot the real, complete application — web layer, service layer, repository layer, security, and a real database — and drive it through actual HTTP calls or a real embedded server.

```
  Unit test           →  AccountService logic, AccountRepository mocked
  Slice test           →  AccountController + MockMvc, AccountService mocked
  Integration test      →  Full app + real embedded HTTP server + real database
                            (Testcontainers-backed, not H2)
```

Integration tests answer a different question than the layers below them: not "is this one class correct?" but "do all these real, wired-together pieces actually work when combined?" — catching bugs in bean wiring, transaction boundaries, security filter chains, and database dialect quirks that no amount of mocking can surface.

---

## 2. @SpringBootTest with a Real Embedded Server

By default, `@SpringBootTest` loads the full application context but does **not** start a real HTTP server — it runs in a mock servlet environment unless you tell it otherwise. To actually exercise your application over real HTTP, set `webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT`, which starts a real embedded Tomcat/Netty server on a randomly chosen free port.

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OrderApiIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    // test methods go here — see Section 4
}
```

| `webEnvironment` value | Behavior |
|--------------------------|-----------|
| `MOCK` (default) | No real server; requests are dispatched via a mock servlet environment (used with `MockMvc`, similar in spirit to `@WebMvcTest` but with the *full* context) |
| `RANDOM_PORT` | Starts a real embedded server on a free random port; injects it into `@LocalServerPort` |
| `DEFINED_PORT` | Starts a real embedded server on the port from your application properties (risk of port conflicts in CI) |
| `NONE` | No servlet environment at all — used for non-web integration tests |

`RANDOM_PORT` is the standard choice for full-stack integration tests because it exercises real network I/O, real serialization over the wire, and real HTTP semantics (status codes, headers, content negotiation) — behavior a mock servlet environment only approximates.

---

## 3. TestRestTemplate vs WebTestClient

Spring Boot auto-configures a `TestRestTemplate` bean whenever `@SpringBootTest` uses `RANDOM_PORT` or `DEFINED_PORT`. It is a thin wrapper around the classic, synchronous `RestTemplate`, purpose-built for tests — it handles relative URLs against the running server automatically and tolerates error status codes without throwing exceptions by default.

```java
ResponseEntity<OrderResponse> response = restTemplate.getForEntity("/api/orders/{id}", OrderResponse.class, 1L);
assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
assertThat(response.getBody().getStatus()).isEqualTo("CONFIRMED");
```

`WebTestClient` is the modern, reactive alternative — originally built for WebFlux, but usable against any Spring Boot app (including traditional Spring MVC apps) for a more fluent, chainable assertion style, and it is the required choice if your application actually is reactive (WebFlux-based).

```java
webTestClient.get().uri("/api/orders/{id}", 1L)
    .exchange()
    .expectStatus().isOk()
    .expectBody()
    .jsonPath("$.status").isEqualTo("CONFIRMED");
```

For a traditional Spring MVC (servlet-based) Spring Boot application, `TestRestTemplate` remains the more common and simpler choice; reach for `WebTestClient` when your app is WebFlux-based or when you specifically want its more fluent assertion chaining.

---

## 4. Worked Example — Full-Stack Integration Test

Given a small order-placement flow spanning a controller, a service, and a repository, a full integration test exercises the real chain end to end:

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class OrderApiIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void shouldPlaceOrderAndPersistItToDatabase() {
        CreateOrderRequest request = new CreateOrderRequest("SKU-123", 2);

        ResponseEntity<OrderResponse> response =
            restTemplate.postForEntity("/api/orders", request, OrderResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().status()).isEqualTo("CONFIRMED");

        // Verify it actually landed in the real database, not just in the HTTP response
        Order persisted = orderRepository.findById(response.getBody().id()).orElseThrow();
        assertThat(persisted.getSku()).isEqualTo("SKU-123");
        assertThat(persisted.getQuantity()).isEqualTo(2);
    }

    @Test
    void shouldReturn404WhenOrderDoesNotExist() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/orders/{id}", String.class, 99999L);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void shouldRejectOrderWithZeroQuantity() {
        CreateOrderRequest invalidRequest = new CreateOrderRequest("SKU-123", 0);

        ResponseEntity<String> response =
            restTemplate.postForEntity("/api/orders", invalidRequest, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
```

Notice this test goes further than a `@WebMvcTest`: it asserts that the order was genuinely persisted by querying the real `OrderRepository` afterward, proving the controller, service, transaction boundary, and repository all actually cooperated correctly — something no mocked slice test can demonstrate.

---

## 5. Why H2 Can Hide Production-Only Bugs

`@AutoConfigureTestDatabase(replace = Replace.NONE)` was used above deliberately, to keep whatever real datasource is configured rather than let Spring Boot silently substitute an embedded H2 database. This matters because H2 (or HSQLDB/Derby) is not the same database engine as production PostgreSQL or MySQL, and the differences are not cosmetic:

```
  Category                 H2 behavior              Real PostgreSQL/MySQL behavior
  ────────────────────────────────────────────────────────────────────────────────
  SQL dialect functions    Approximates dialects     Has its own function set,
                           via "compatibility        e.g. JSONB operators, window
                           modes" — imperfect         functions, full-text search
  ────────────────────────────────────────────────────────────────────────────────
  Case sensitivity         Case-insensitive by       PostgreSQL identifiers are
                           default for identifiers   case-sensitive when quoted
  ────────────────────────────────────────────────────────────────────────────────
  Constraint enforcement   Some constraints/         Foreign keys, check
                           triggers behave           constraints enforced exactly
                           differently or not at     as declared
                           all
  ────────────────────────────────────────────────────────────────────────────────
  Native/vendor queries    Native SQL syntax for     A native query written for
                           Postgres/MySQL often       Postgres (e.g. RETURNING,
                           fails outright on H2       ON CONFLICT) has no H2
                                                       equivalent at all
  ────────────────────────────────────────────────────────────────────────────────
  Locking & concurrency    Simplified locking model  Real MVCC/locking semantics,
                                                       important for concurrent
                                                       writes and isolation levels
```

A test suite that passes entirely against H2 can still ship a query that throws a syntax error in production the moment it hits real PostgreSQL — this is precisely the gap Testcontainers closes: it lets your tests run against the *exact* database engine and version you deploy to production, as a real, ephemeral, disposable container, with no behavioral approximation involved.

---

## 6. Introducing Testcontainers

Testcontainers is a Java library that programmatically starts real Docker containers — a real PostgreSQL server, a real MySQL server, a real Kafka broker, a real Redis instance — for the lifetime of a test class, and tears them down afterward. Your test code talks to the actual database engine over a real JDBC connection, with zero behavioral approximation.

```xml
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
</dependency>
```

```
  Test class starts
        │
        ▼
  Testcontainers pulls (if needed) and starts a
  real "postgres:16" Docker container on a random host port
        │
        ▼
  @DynamicPropertySource injects that container's
  actual JDBC URL/username/password into the Spring context
        │
        ▼
  Spring Boot connects its DataSource to the REAL
  Postgres container — not H2, not a mock
        │
        ▼
  Tests run against real Postgres behavior
        │
        ▼
  Container is destroyed when the test class finishes
```

Requirements: Docker (or a compatible container runtime) must be available on the machine running the tests — this is normally true on developer laptops and CI runners, but is the one infrastructural dependency Testcontainers-based tests add over plain H2-based tests.

---

## 7. Worked Example — Testcontainers with Postgres

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class OrderApiTestcontainersIntegrationTest {

    @Container
    @ServiceConnection // Spring Boot 3.1+ auto-wires connection properties for you
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void shouldPlaceOrderAgainstRealPostgres() {
        CreateOrderRequest request = new CreateOrderRequest("SKU-123", 2);

        ResponseEntity<OrderResponse> response =
            restTemplate.postForEntity("/api/orders", request, OrderResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        Order persisted = orderRepository.findById(response.getBody().id()).orElseThrow();
        assertThat(persisted.getSku()).isEqualTo("SKU-123");
    }
}
```

`@ServiceConnection` (Spring Boot 3.1+) is the simplest wiring approach — it auto-detects the container type and configures `spring.datasource.*` properties for you. On older Spring Boot versions, or when you need explicit control, wire the container manually with `@DynamicPropertySource`:

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class OrderApiTestcontainersIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("orders_test")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void shouldPlaceOrderAgainstRealPostgres() {
        CreateOrderRequest request = new CreateOrderRequest("SKU-123", 2);

        ResponseEntity<OrderResponse> response =
            restTemplate.postForEntity("/api/orders", request, OrderResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }
}
```

`@Container` marks the field for Testcontainers' JUnit 5 extension (activated by `@Testcontainers`) to manage the container's start/stop lifecycle. Because the field is `static`, by default one container instance is shared across all test methods in the class (started once in a `@BeforeAll`-equivalent hook, stopped once after all tests finish) — much cheaper than starting a fresh container per test method. `@DynamicPropertySource` runs *after* the container has started but *before* the Spring context is created, which is exactly when you need to know the container's actual randomly assigned port and inject it into `spring.datasource.url`.

The same pattern applies to MySQL by swapping the dependency and container class:

```java
@Container
@ServiceConnection
static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0");
```

---

## 8. Reusing Containers Across Test Classes

Starting a fresh container per test *class* is already far cheaper than per test *method*, but a large suite with many integration test classes can still pay real container-startup cost (typically a few seconds) many times over. Testcontainers supports two strategies to reduce this further:

- **A shared base class** — define an abstract base test class that starts the container once as a `static` field, and have every integration test class extend it. Because the field is static and JUnit's Testcontainers extension detects it is already running, the same container instance can be reused across multiple test classes within one JVM/test run instead of one per class.

```java
@Testcontainers
abstract class AbstractIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
}

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OrderApiIntegrationTest extends AbstractIntegrationTest {
    // inherits the running postgres container
}
```

- **Testcontainers' "reuse" feature** — enabling `testcontainers.reuse.enable=true` in `~/.testcontainers.properties` and calling `.withReuse(true)` on the container definition keeps a single container alive *across separate test runs* (even across different JVM processes), which speeds up local development loops significantly. This is opt-in and not typically enabled in CI, since CI runners are usually ephemeral anyway.

---

## 9. Common Pitfalls

- **Running full `@SpringBootTest` + Testcontainers integration tests for every scenario** — these are the slowest tests in your suite; reserve them for genuinely cross-layer concerns and push logic-level coverage down to unit and slice tests.
- **Forgetting `@AutoConfigureTestDatabase(replace = Replace.NONE)` alongside Testcontainers on a class also annotated `@DataJpaTest`** — without it, Spring Boot's default behavior silently replaces your Testcontainers-backed datasource with an embedded H2 database, quietly defeating the entire purpose.
- **Assuming Docker is always available in every environment** — some CI runners or corporate sandboxes disallow Docker-in-Docker; Testcontainers-based tests need an explicit fallback strategy or an environment guarantee before they'll run there.
- **Starting a new container per test method instead of per class** — putting `@Container` on a non-static field starts and stops a fresh container before/after every single `@Test`, multiplying total suite runtime dramatically for no added correctness benefit in most cases.
- **Hardcoding a container's JDBC port** instead of asking the container object for its actual mapped port — Testcontainers deliberately binds containers to random host ports to avoid conflicts between parallel test runs, so `@DynamicPropertySource` (or `@ServiceConnection`) must be used rather than a fixed `application-test.properties` URL.
- **Testing exhaustive business-rule permutations at the integration level** — every edge case of a discount calculation or validation rule belongs in a fast unit test; the integration test only needs one or two representative happy-path and error-path scenarios to prove the layers are wired correctly.
- **Ignoring container image version pinning** — using a floating tag like `postgres:latest` means your test environment can silently drift to a new major version and start failing for reasons unrelated to your code; pin to a specific version (`postgres:16-alpine`) that matches your production database version.

---

## 10. Best Practices

- **Reserve `@SpringBootTest` for cases that genuinely need the whole wired application** — verifying an end-to-end request flow, a security filter chain, or a real database round-trip. Push everything else down to unit tests or slice tests.
- **Pin your Testcontainers image version to match production** — if production runs PostgreSQL 16, your test container should be `postgres:16-alpine`, not `latest`, so dialect and behavior match exactly.
- **Use `@ServiceConnection` (Spring Boot 3.1+)** instead of manual `@DynamicPropertySource` wiring wherever possible — it is less code and self-documents the container's role.
- **Share containers across a test class (or a whole suite via a base class)** rather than restarting per test method, to keep integration suite runtime manageable.
- **Keep the number of full integration tests deliberately small** relative to unit and slice tests — a handful of representative end-to-end scenarios per major feature is usually enough; exhaustive edge-case coverage belongs at lower pyramid levels.
- **Run integration tests in a separate Maven/Gradle phase or profile** (e.g. Failsafe's `verify` phase, or a Gradle `integrationTest` source set) so fast unit/slice tests can run on every save while slower container-backed tests run less frequently (e.g. pre-merge CI).
- **Verify real side effects, not just HTTP status codes** — as shown in Section 4, query the repository after an API call to confirm data was genuinely persisted, not just that the endpoint returned 201.
- **Treat Testcontainers as your default for any test needing real database semantics** — don't default to H2 "because it's already there"; explicitly decide whether dialect-accurate behavior matters for the query or feature under test.

---

## 11. Hands-On Exercises

**Exercise 1:** Take the `OrderApiIntegrationTest` from Section 4 and convert it to use `webEnvironment = RANDOM_PORT` with `TestRestTemplate` if it isn't already, and add a test asserting that a `GET /api/orders/{id}` for a freshly created order returns the same data that was originally submitted.

**Exercise 2:** Add the `org.testcontainers:postgresql` and `org.testcontainers:junit-jupiter` dependencies to a sample Spring Boot project. Write a `@Testcontainers` + `@SpringBootTest` test class using `@Container` and `@ServiceConnection` to start a real `postgres:16-alpine` container, and verify the application successfully persists and retrieves an entity against it.

**Exercise 3:** Deliberately write a native SQL query using a Postgres-specific feature (for example `ON CONFLICT (id) DO UPDATE` for an upsert) in a repository method annotated `@Query(nativeQuery = true)`. Run it first against the default `@DataJpaTest` embedded H2 database and observe the failure, then rerun the same test with `@AutoConfigureTestDatabase(replace = Replace.NONE)` plus a Testcontainers Postgres instance and observe it pass — documenting the exact error message H2 produced.

**Exercise 4:** Create an `AbstractIntegrationTest` base class that starts a shared, static `PostgreSQLContainer` with `@ServiceConnection`, and refactor two or three separate integration test classes to extend it instead of each declaring their own container. Measure and compare total suite runtime before and after.

**Exercise 5:** Write an integration test using `WebTestClient` instead of `TestRestTemplate` against the same `RANDOM_PORT` server, replicating one of the scenarios from Exercise 1. Compare the fluency and readability of the assertion chain (`.expectStatus().isOk().expectBody().jsonPath(...)`) against the equivalent `TestRestTemplate` + AssertJ version, and note when you'd prefer one over the other.

---

## 12. Interview Q&A

**Q: What does `webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT` do, and why would you choose it over the default `MOCK` environment?**
Answer: It tells `@SpringBootTest` to start a real embedded servlet container (Tomcat, Jetty, or Netty depending on your stack) on a randomly assigned free port, rather than dispatching requests through a mock servlet environment with no real network layer involved. This is the right choice for genuine end-to-end integration tests because it exercises real HTTP semantics — actual serialization over the wire, real status codes and headers, and real client/server round trips — catching classes of bugs (like content-negotiation or connection-level issues) that a mock servlet environment can't surface. `RANDOM_PORT` also avoids port collisions when tests run in parallel or in CI, unlike `DEFINED_PORT`, which uses a fixed port that could already be in use.

**Q: Why might a test suite pass entirely against an H2 in-memory database but still fail in production against PostgreSQL or MySQL?**
Answer: H2 approximates other databases' SQL dialects through "compatibility modes," but it is not a byte-for-byte replica of PostgreSQL or MySQL — differences show up in native/vendor-specific SQL syntax (like PostgreSQL's `ON CONFLICT` or `RETURNING` clauses), case-sensitivity rules for identifiers, constraint and trigger enforcement, and locking/concurrency semantics under real MVCC. A query or migration that works fine against H2's simplified engine can throw a syntax error or produce subtly different results against the real production database, which is exactly the risk Testcontainers eliminates by running tests against the actual database engine and version used in production.

**Q: What problem does Testcontainers solve, and how does `@DynamicPropertySource` fit into that solution?**
Answer: Testcontainers programmatically starts a real, ephemeral Docker container (a real PostgreSQL server, Kafka broker, Redis instance, etc.) for the duration of a test class, giving tests a genuine instance of the exact technology used in production instead of an in-memory approximation. Because the container is assigned a random host port at startup to avoid conflicts between parallel test runs, the application under test needs to be told that actual port (and credentials) at runtime; `@DynamicPropertySource` is a static method that runs after the container has started but before the Spring context is created, letting you register properties like `spring.datasource.url` dynamically based on the container's real, just-assigned connection details. Spring Boot 3.1+'s `@ServiceConnection` annotation automates this same wiring for common container types without needing to write the property-registration method by hand.

**Q: How do `TestRestTemplate` and `WebTestClient` differ, and when would you pick one over the other?**
Answer: `TestRestTemplate` is a synchronous, blocking HTTP client purpose-built for tests, auto-configured whenever `@SpringBootTest` uses `RANDOM_PORT`/`DEFINED_PORT`; it is the natural fit for traditional, servlet-based Spring MVC applications. `WebTestClient` is a fluent, chainable client originally designed for reactive WebFlux applications, but it works against any Spring Boot app and offers a more expressive assertion syntax (`.expectStatus().isOk().expectBody().jsonPath(...)`). You'd choose `WebTestClient` when your application is actually WebFlux-based (where it is closer to mandatory) or when your team prefers its fluent chaining style; `TestRestTemplate` remains the simpler, more common default for classic Spring MVC services.

**Q: Why start a Testcontainers container once per test class (static field) rather than once per test method?**
Answer: Starting a Docker container has real, non-trivial overhead — typically a few seconds to pull the image (if not cached) and boot the database engine — so restarting it before every single test method would multiply total suite runtime substantially with no correctness benefit for most tests. Declaring the `@Container` field `static` means Testcontainers' JUnit 5 extension starts it once before any test in the class runs and tears it down once after the last test finishes, similar in spirit to `@BeforeAll`/`@AfterAll`; test isolation between methods is instead achieved through other means (transactional rollback, explicit cleanup, or unique test data per method) rather than through full container restarts.

**Q: Why shouldn't integration tests be used to exhaustively cover every business-logic edge case?**
Answer: Integration tests are the slowest and most expensive tier of the test pyramid — each one may involve starting a real embedded server and a real containerized database — so using them to enumerate every validation rule or discount-calculation permutation multiplies suite runtime for coverage that a millisecond-fast unit test could provide just as reliably. The correct division of labor is to push exhaustive logic-level edge cases down into unit tests (isolated, mocked, fast) and slice tests (one layer, fast), and reserve integration tests for a small number of representative scenarios that specifically verify the real layers are wired together and cooperate correctly end to end.
