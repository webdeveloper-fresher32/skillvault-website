# Spring Boot Test Slices — Complete Guide

## Table of Contents
1. [Why Not Just Use @SpringBootTest Everywhere](#1-why-not-just-use-springboottest-everywhere)
2. [What a Test Slice Actually Loads](#2-what-a-test-slice-actually-loads)
3. [@WebMvcTest — Testing the Web Layer](#3-webmvctest--testing-the-web-layer)
4. [Worked Example — MockMvc Controller Test](#4-worked-example--mockmvc-controller-test)
5. [@DataJpaTest — Testing the Repository Layer](#5-datajpatest--testing-the-repository-layer)
6. [Worked Example — Custom Repository Query Test](#6-worked-example--custom-repository-query-test)
7. [@JsonTest — Testing Serialization](#7-jsontest--testing-serialization)
8. [Choosing the Right Slice](#8-choosing-the-right-slice)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Not Just Use @SpringBootTest Everywhere

`@SpringBootTest` boots the **entire** Spring application context — every `@Component`, `@Service`, `@Repository`, `@Configuration`, security filter chain, and auto-configuration your application declares. That is exactly what you want for a true end-to-end integration test, but it is overkill and slow when all you want to verify is "does this one `@RestController` map this URL correctly and return this JSON shape?"

```
  @SpringBootTest (full context)
  ┌──────────────────────────────────────────────────────────┐
  │  Web layer │ Service layer │ Repository layer │ Security  │
  │  Data source │ Message queues │ Caches │ All @Configuration │
  └──────────────────────────────────────────────────────────┘
        Every bean is created. Every auto-configuration runs.
        Startup: hundreds of milliseconds to several seconds.
```

If your application has 200 controller tests and each one boots the full context, your test suite startup cost multiplies 200 times over (Spring's context caching helps, but only when configuration is identical across tests — any variation forces a new context). Test slices solve this by loading **only the beans relevant to one architectural layer**, using Spring Boot's `@...Test` slice annotations, each of which is itself a meta-annotation that pulls in a curated, minimal subset of auto-configuration.

---

## 2. What a Test Slice Actually Loads

Each slice annotation disables full auto-configuration and instead enables only the auto-configuration classes relevant to that slice.

```
  @WebMvcTest(UserController.class)
  ┌────────────────────────────────────────────────────┐
  │  Loads:  @Controller, @RestController,              │
  │          @ControllerAdvice, WebMvcConfigurer,        │
  │          Jackson message converters, MockMvc         │
  │  Does NOT load:  @Service, @Repository,               │
  │          @Component, DataSource, JPA                 │
  └────────────────────────────────────────────────────┘

  @DataJpaTest
  ┌────────────────────────────────────────────────────┐
  │  Loads:  @Entity classes, Spring Data repositories,   │
  │          an embedded/test DataSource, Hibernate,      │
  │          TestEntityManager                            │
  │  Does NOT load:  @Controller, @Service, web layer      │
  └────────────────────────────────────────────────────┘

  @JsonTest
  ┌────────────────────────────────────────────────────┐
  │  Loads:  Jackson ObjectMapper, JsonComponent beans,   │
  │          JacksonTester / GsonTester helpers            │
  │  Does NOT load:  Web layer, persistence layer          │
  └────────────────────────────────────────────────────┘
```

Any dependency the slice *doesn't* load — like a `@Service` a controller calls — must be provided as a mock, typically via `@MockBean` (or `@MockitoBean` in Spring Boot 3.4+), which registers a Mockito mock into the trimmed-down application context in place of the real bean.

This gives you three benefits over `@SpringBootTest`: **faster startup** (fewer beans to instantiate), **narrower failure surface** (a failing `@WebMvcTest` can only be a web-layer or serialization bug, never a hidden database issue), and **better isolation** (you are forced to explicitly declare which service/repository behavior the controller test depends on, via mocking).

---

## 3. @WebMvcTest — Testing the Web Layer

`@WebMvcTest` loads only the Spring MVC infrastructure needed to dispatch a request through your controller layer, and hands you a `MockMvc` instance to drive that dispatch without starting a real HTTP server or opening a real port.

```java
@WebMvcTest(ProductController.class)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProductService productService;

    @Autowired
    private ObjectMapper objectMapper;

    // test methods go here — see Section 4
}
```

`@Autowired MockMvc` gives you a fluent API to build and dispatch fake HTTP requests entirely in-process — no socket, no serialized bytes over the network, just the same `DispatcherServlet` machinery Spring uses in production, invoked directly. `@MockBean` (or its Spring Boot 3.4+ replacement `@MockitoBean`) tells Spring to substitute a Mockito mock for `ProductService` in the trimmed context, since `@WebMvcTest` does not scan or instantiate `@Service` beans.

---

## 4. Worked Example — MockMvc Controller Test

Given a REST controller for managing products:

```java
// ProductController.java — production code
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> getProduct(@PathVariable Long id) {
        ProductResponse product = productService.findById(id);
        return ResponseEntity.ok(product);
    }

    @PostMapping
    public ResponseEntity<ProductResponse> createProduct(@Valid @RequestBody CreateProductRequest request) {
        ProductResponse created = productService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
```

```java
// ProductControllerTest.java — test code
@WebMvcTest(ProductController.class)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ProductService productService;

    @Test
    void shouldReturnProductWhenFound() throws Exception {
        ProductResponse product = new ProductResponse(1L, "Wireless Mouse", new BigDecimal("29.99"));
        when(productService.findById(1L)).thenReturn(product);

        mockMvc.perform(get("/api/products/{id}", 1L))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.name").value("Wireless Mouse"))
            .andExpect(jsonPath("$.price").value(29.99));
    }

    @Test
    void shouldReturn404WhenProductNotFound() throws Exception {
        when(productService.findById(99L)).thenThrow(new ProductNotFoundException(99L));

        mockMvc.perform(get("/api/products/{id}", 99L))
            .andExpect(status().isNotFound());
    }

    @Test
    void shouldCreateProductAndReturn201() throws Exception {
        CreateProductRequest request = new CreateProductRequest("Keyboard", new BigDecimal("59.99"));
        ProductResponse created = new ProductResponse(2L, "Keyboard", new BigDecimal("59.99"));
        when(productService.create(any(CreateProductRequest.class))).thenReturn(created);

        mockMvc.perform(post("/api/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(2))
            .andExpect(jsonPath("$.name").value("Keyboard"));
    }

    @Test
    void shouldReturn400WhenRequestBodyIsInvalid() throws Exception {
        CreateProductRequest invalidRequest = new CreateProductRequest("", new BigDecimal("-10"));

        mockMvc.perform(post("/api/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
            .andExpect(status().isBadRequest());
    }
}
```

`mockMvc.perform(...)` builds and dispatches a fake request through the real `DispatcherServlet`, argument resolvers, `@Valid` validation, and Jackson message converters — everything a real request would go through — except the actual network transport. `jsonPath("$.field")` assertions parse the response body as JSON and let you assert on individual fields without manually deserializing into a Java object, which is faster to write and pinpoints exactly which field is wrong when a test fails.

---

## 5. @DataJpaTest — Testing the Repository Layer

`@DataJpaTest` loads only JPA-related configuration: your `@Entity` classes, Spring Data JPA repository interfaces, an embedded test `DataSource` (H2 by default, unless overridden), Hibernate, and a `TestEntityManager` helper for setting up test data directly.

```java
@DataJpaTest
class ProductRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private ProductRepository productRepository;

    // test methods go here — see Section 6
}
```

Two properties of `@DataJpaTest` matter in practice:

- **Each test method runs inside a transaction that is rolled back afterward.** This means test data you persist in one test never leaks into another — you get a clean slate per test without manually deleting rows.
- **By default, it replaces your configured production `DataSource` with an embedded, in-memory database** (H2, HSQLDB, or Derby, whichever is on the classpath) unless you explicitly disable that behavior with `@AutoConfigureTestDatabase(replace = Replace.NONE)` — a decision covered in the next lesson on Testcontainers.

`TestEntityManager` is a testing-focused version of JPA's `EntityManager` — it exposes convenience methods like `persistAndFlush(entity)` that immediately write to the test database and flush pending SQL, which is important because Spring Data repository methods normally query against whatever has actually been flushed, not just what is sitting in the persistence context.

---

## 6. Worked Example — Custom Repository Query Test

Given a repository with a derived query method and a custom `@Query`:

```java
// ProductRepository.java — production code
public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByCategoryAndPriceLessThan(String category, BigDecimal maxPrice);

    @Query("SELECT p FROM Product p WHERE p.stockQuantity < :threshold ORDER BY p.stockQuantity ASC")
    List<Product> findLowStockProducts(@Param("threshold") int threshold);
}
```

```java
// ProductRepositoryTest.java — test code
@DataJpaTest
class ProductRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private ProductRepository productRepository;

    @Test
    void shouldFindProductsByCategoryUnderMaxPrice() {
        entityManager.persistAndFlush(new Product("Mouse", "Electronics", new BigDecimal("25.00"), 50));
        entityManager.persistAndFlush(new Product("Monitor", "Electronics", new BigDecimal("199.00"), 20));
        entityManager.persistAndFlush(new Product("Desk", "Furniture", new BigDecimal("150.00"), 5));

        List<Product> results = productRepository.findByCategoryAndPriceLessThan("Electronics", new BigDecimal("100.00"));

        assertThat(results)
            .hasSize(1)
            .extracting(Product::getName)
            .containsExactly("Mouse");
    }

    @Test
    void shouldFindLowStockProductsOrderedAscending() {
        entityManager.persistAndFlush(new Product("Mouse", "Electronics", new BigDecimal("25.00"), 3));
        entityManager.persistAndFlush(new Product("Keyboard", "Electronics", new BigDecimal("45.00"), 1));
        entityManager.persistAndFlush(new Product("Monitor", "Electronics", new BigDecimal("199.00"), 20));

        List<Product> lowStock = productRepository.findLowStockProducts(5);

        assertThat(lowStock)
            .hasSize(2)
            .extracting(Product::getName)
            .containsExactly("Keyboard", "Mouse"); // ordered by stockQuantity ascending
    }

    @Test
    void shouldReturnEmptyListWhenNoProductsMatch() {
        entityManager.persistAndFlush(new Product("Desk", "Furniture", new BigDecimal("150.00"), 5));

        List<Product> results = productRepository.findByCategoryAndPriceLessThan("Electronics", new BigDecimal("50.00"));

        assertThat(results).isEmpty();
    }
}
```

This test verifies real behavior that a mocked repository test never could: whether the derived query method name (`findByCategoryAndPriceLessThan`) is parsed correctly by Spring Data into the SQL you expect, and whether the custom JPQL in `@Query` actually returns rows in the right order. A unit test that mocks `ProductRepository` (as in Lesson 1) can never catch a typo in a query method name or a wrong `ORDER BY` clause — only a real query execution against a real (or embedded) database can.

---

## 7. @JsonTest — Testing Serialization

`@JsonTest` loads only Jackson's `ObjectMapper` and any custom `JsonComponent`/`JsonSerializer`/`JsonDeserializer` beans you've declared, along with `JacksonTester` helpers for asserting on serialized JSON without spinning up any web or persistence infrastructure.

```java
@JsonTest
class ProductResponseJsonTest {

    @Autowired
    private JacksonTester<ProductResponse> json;

    @Test
    void shouldSerializeProductResponse() throws Exception {
        ProductResponse response = new ProductResponse(1L, "Wireless Mouse", new BigDecimal("29.99"));

        JsonContent<ProductResponse> result = json.write(response);

        assertThat(result).extractingJsonPathNumberValue("$.id").isEqualTo(1);
        assertThat(result).extractingJsonPathStringValue("$.name").isEqualTo("Wireless Mouse");
        assertThat(result).hasJsonPathValue("$.price");
    }

    @Test
    void shouldDeserializeProductResponse() throws Exception {
        String content = """
            {"id": 5, "name": "Keyboard", "price": 59.99}
            """;

        ProductResponse result = json.parseObject(content);

        assertThat(result.id()).isEqualTo(5L);
        assertThat(result.name()).isEqualTo("Keyboard");
        assertThat(result.price()).isEqualByComparingTo("59.99");
    }
}
```

`@JsonTest` is especially valuable when a DTO has custom `@JsonProperty`, `@JsonFormat`, or custom serializer/deserializer logic (e.g. formatting a `BigDecimal` as a currency string, or a `LocalDate` in a specific pattern) — bugs in that mapping logic are easy to introduce and easy to catch here without needing the full web layer or database.

---

## 8. Choosing the Right Slice

| Annotation | Layer under test | Key collaborators auto-configured | Typical mocks needed |
|------------|-------------------|-------------------------------------|------------------------|
| `@WebMvcTest(Controller.class)` | Controller / web | MockMvc, Jackson converters, `@ControllerAdvice` | `@MockBean` for services |
| `@DataJpaTest` | Repository / persistence | Embedded DB, Hibernate, `TestEntityManager` | Usually none |
| `@JsonTest` | Serialization | ObjectMapper, JsonComponents | None |
| `@RestClientTest` | Outbound HTTP client | `RestTemplate`/`RestClient`, `MockRestServiceServer` | None (mocks the remote server) |
| `@SpringBootTest` | Whole application | Everything | Rarely — defeats the purpose if overused |

A useful rule of thumb: reach for a slice whenever your test's *intent* is scoped to one layer. Reach for `@SpringBootTest` (covered in the next lesson) only when you specifically need to verify that layers are wired together correctly end to end — that is a different, complementary kind of confidence, not a superset that makes slice tests redundant.

---

## 9. Common Pitfalls

- **Using `@SpringBootTest` for everything "to be safe"** — this is the single biggest cause of slow CI pipelines in Spring Boot projects; a suite of 300 `@SpringBootTest` classes can take many minutes just in context startup overhead.
- **Forgetting `@MockBean` for a controller's service dependency** — `@WebMvcTest` does not scan `@Service` classes, so if the controller's constructor needs one and it isn't mocked, the context fails to start with a `NoSuchBeanDefinitionException`.
- **Asserting the full JSON body as a string** — comparing raw JSON strings is brittle against field ordering and whitespace; prefer `jsonPath(...)` assertions on individual fields instead.
- **Relying on `@DataJpaTest`'s default embedded database when your production database has different SQL dialect behavior** — a native query, a database-specific function, or subtle NULL-handling semantics can pass against H2 but fail against real PostgreSQL/MySQL in production (this is explored in depth in the next lesson).
- **Not calling `entityManager.persistAndFlush(...)`** — persisting without flushing can let a test pass even though the corresponding SQL was never actually executed against the test database, masking bugs that would surface once data really needs to be queried.
- **Testing business logic inside a `@WebMvcTest`** — a controller test should verify HTTP semantics (status codes, headers, JSON shape, validation error responses), not business rules; business logic belongs in a plain unit test on the service class, as shown in Lesson 1.
- **Context cache misses from inconsistent slice configuration** — Spring caches application contexts across test classes with *identical* configuration, but adding a stray `@MockBean` or profile to only some test classes in a slice can silently disable reuse and slow the whole suite down.

---

## 10. Best Practices

- **Match the slice to the layer you're testing** — `@WebMvcTest` for controllers, `@DataJpaTest` for repositories, `@JsonTest` for DTO serialization — and keep each test class focused on exactly one of those concerns.
- **Prefer `jsonPath` assertions over full-body string comparison** in MockMvc tests, so a test failure clearly names which field mismatched.
- **Use `@AutoConfigureTestDatabase(replace = Replace.NONE)`** on `@DataJpaTest` when you want it to run against a real (e.g. Testcontainers-backed) database instead of the default embedded one — critical once you care about dialect-specific correctness.
- **Keep slice test classes narrowly scoped** — `@WebMvcTest(ProductController.class)` rather than `@WebMvcTest` with no argument, so only the controller under test (plus shared `@ControllerAdvice`) is loaded, not every controller in the application.
- **Name slice tests by scenario, not by HTTP verb** — `shouldReturn404WhenProductNotFound` is more informative than `testGet2`.
- **Assert both the happy path and the validation/error paths** in `@WebMvcTest` — a controller test suite that only covers 200 responses is missing half its value.
- **Let repository tests exercise the actual query, never mock the repository itself** — mocking `ProductRepository` inside a `@DataJpaTest` defeats the entire purpose of the slice.
- **Run slice tests in your fast local feedback loop** and reserve full `@SpringBootTest` runs for pre-merge CI or a dedicated "integration" test suite/profile, so day-to-day development stays fast.

---

## 11. Hands-On Exercises

**Exercise 1:** Write a `@WebMvcTest` for a `UserController` with a `GET /api/users/{id}` endpoint. Mock the `UserService` dependency with `@MockBean`, stub it to return a `UserResponse`, and assert the response status is 200 and the JSON body's `email` field matches using `jsonPath`.

**Exercise 2:** Extend Exercise 1 with a test for the case where `userService.findById(id)` throws a `UserNotFoundException`. Add a `@RestControllerAdvice` (or verify an existing one) maps that exception to a 404 response, and assert `status().isNotFound()` in the test.

**Exercise 3:** Write a `@DataJpaTest` for an `OrderRepository` with a derived query method `findByCustomerEmailAndStatus(String email, OrderStatus status)`. Persist three orders with different emails/statuses using `TestEntityManager`, then assert the query returns exactly the matching subset.

**Exercise 4:** Write a `@JsonTest` for a `PaymentResponse` DTO that has a `LocalDateTime processedAt` field formatted with a custom `@JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")`. Assert that serializing a known instance produces the expected date string, and that deserializing that JSON string back reconstructs the same `LocalDateTime`.

**Exercise 5:** Take the `ProductController` from Section 4 and add a `PUT /api/products/{id}` endpoint plus a `DELETE /api/products/{id}` endpoint. Write `@WebMvcTest` cases for both: a successful update returning 200 with the updated JSON body, and a successful delete returning 204 with an empty body, verifying `productService.delete(id)` was called via Mockito's `verify`.

---

## 12. Interview Q&A

**Q: What is the difference between `@SpringBootTest` and a test slice like `@WebMvcTest`?**
Answer: `@SpringBootTest` boots the entire Spring application context, including all `@Service`, `@Repository`, `@Component` beans, security configuration, and every auto-configuration class — making it slow but giving the highest-fidelity integration confidence. A test slice like `@WebMvcTest` loads only the beans relevant to one architectural layer (in this case, the web/MVC layer plus Jackson converters) and disables the rest of Spring Boot's auto-configuration, which makes tests start faster and forces you to explicitly mock any dependency from an unloaded layer (typically with `@MockBean`). Slices trade full-stack realism for speed and isolation, which is exactly right for verifying one layer's behavior in isolation.

**Q: Why does `@DataJpaTest` replace your configured production database with an embedded one by default, and why can that be a problem?**
Answer: By default, `@DataJpaTest` applies `@AutoConfigureTestDatabase`, which swaps out whatever `DataSource` your application is configured to use in favor of an embedded, in-memory database (commonly H2) found on the classpath, so tests don't need a real database server running to execute. The problem is that embedded databases don't perfectly replicate the SQL dialect, functions, constraint enforcement, and NULL-handling semantics of a production database like PostgreSQL or MySQL — a native query or a database-specific feature can pass against H2 and still fail once deployed against the real engine. This is why teams increasingly disable the replacement (`@AutoConfigureTestDatabase(replace = Replace.NONE)`) and point `@DataJpaTest` at a real, ephemeral database via Testcontainers instead.

**Q: What does `@MockBean` do differently from a plain Mockito `@Mock` in a slice test?**
Answer: A plain `@Mock` (used with `@ExtendWith(MockitoExtension.class)`) creates a Mockito mock as a standalone Java object with no relationship to any Spring context — appropriate for pure unit tests with no Spring involved at all. `@MockBean` additionally registers that mock *into the Spring application context* as a bean, replacing any existing bean of the same type — this is required in slice tests like `@WebMvcTest` where the controller under test is a real Spring-managed bean that gets its service dependency injected by Spring itself, not by direct field assignment, so the mock must actually live inside the context for autowiring to pick it up.

**Q: What is `jsonPath()` used for in a MockMvc test, and why is it usually preferable to comparing the whole response body as a string?**
Answer: `jsonPath("$.field")` parses the actual JSON response body and lets you assert on the value of a single named field (or navigate nested structures/arrays), independent of field ordering, whitespace, or unrelated fields in the payload. Comparing the entire response body as a raw string is brittle — any unrelated formatting change, added field, or reordering breaks the test even though the actually-important data is unchanged — while `jsonPath` assertions stay focused on the specific values the test cares about and produce a much clearer failure message naming exactly which field was wrong.

**Q: When would you choose `@JsonTest` over just testing serialization implicitly through a `@WebMvcTest`?**
Answer: `@JsonTest` isolates serialization/deserialization logic itself — verifying a DTO's Jackson annotations, custom serializers, or date/number formatting — without needing to also stand up the web/MVC layer, MockMvc, or a controller at all. This is valuable when a DTO's mapping logic is complex enough to deserve its own focused tests (e.g. a custom `JsonSerializer` for money values, or a polymorphic type with `@JsonTypeInfo`), since a `@WebMvcTest` would only exercise that DTO indirectly through one particular endpoint and might miss edge cases in fields or paths that endpoint doesn't happen to touch.
