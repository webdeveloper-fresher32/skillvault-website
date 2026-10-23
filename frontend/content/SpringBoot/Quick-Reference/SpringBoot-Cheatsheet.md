# Spring Boot Cheatsheet

---

### Core Spring — Stereotypes & DI

```java
@Component                 // Generic Spring-managed bean
@Service                   // Semantic stereotype for the service/business layer
@Repository                // Semantic stereotype for persistence layer; enables exception translation (DataAccessException)
@Controller                // MVC controller, returns view names
@RestController            // @Controller + @ResponseBody on every method; returns serialized response bodies
@Configuration              // Class contains @Bean definitions, itself a component
@Bean                       // Method-level; registers the return value as a bean in the ApplicationContext

@Autowired                  // Injects a bean by type (constructor, field, or setter injection)
@Qualifier("beanName")      // Disambiguates when multiple beans of the same type exist
@Primary                    // Marks a bean as the default choice when multiple candidates exist
@Value("${some.property}")  // Injects a value from application.properties/yml or env
@Lazy                       // Defers bean creation until first use
@Scope("prototype")         // New instance per injection point (default is "singleton")
@PostConstruct              // Method runs after dependency injection completes
@PreDestroy                 // Method runs before bean destruction (container shutdown)
```

```java
// Constructor injection (preferred — enables immutability, testability, no circular-dependency ambiguity)
@Service
public class OrderService {
    private final PaymentClient paymentClient;

    public OrderService(PaymentClient paymentClient) {   // @Autowired optional on single-constructor classes
        this.paymentClient = paymentClient;
    }
}

// Explicit @Bean definition with multiple candidates resolved via @Primary/@Qualifier
@Configuration
public class AppConfig {
    @Bean
    @Primary
    public Clock systemClock() { return Clock.systemUTC(); }

    @Bean
    @Qualifier("fixedClock")
    public Clock testClock() { return Clock.fixed(Instant.EPOCH, ZoneOffset.UTC); }
}
```

---

### Bean Scopes & Lifecycle

| Scope | Description |
|---|---|
| `singleton` (default) | One instance per Spring container |
| `prototype` | New instance every time the bean is requested |
| `request` | One instance per HTTP request (web-aware contexts) |
| `session` | One instance per HTTP session |
| `application` | One instance per ServletContext |

**Bean lifecycle order:** Constructor → dependency injection → `@PostConstruct` → bean ready for use → `@PreDestroy` (singleton only, on context close).

---

### Spring Boot Bootstrapping

```java
@SpringBootApplication          // = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class MyApp {
    public static void main(String[] args) {
        SpringApplication.run(MyApp.class, args);
    }
}
```

```java
@ConditionalOnClass(DataSource.class)          // Auto-config applies only if class is on classpath
@ConditionalOnMissingBean(DataSource.class)    // Applies only if user hasn't defined their own bean
@ConditionalOnProperty(name = "feature.x.enabled", havingValue = "true")
@ConditionalOnWebApplication                    // Applies only in a web (servlet/reactive) context
@ConditionalOnExpression("${feature.enabled} and ${other.flag}")
@EnableConfigurationProperties(MyProps.class)
@ConfigurationProperties(prefix = "app")        // Binds a whole properties block to a POJO
```

**application.yml with profiles:**

```yaml
spring:
  application:
    name: order-service
  datasource:
    url: jdbc:postgresql://localhost:5432/orders
    username: app
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false

server:
  port: 8080

---
spring:
  config:
    activate:
      on-profile: dev
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true

---
spring:
  config:
    activate:
      on-profile: prod
logging:
  level:
    root: WARN
```

Activate a profile: `--spring.profiles.active=dev`, `SPRING_PROFILES_ACTIVE=dev` env var, or `spring.profiles.active=dev` in properties.

Common starters: `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-security`, `spring-boot-starter-validation`, `spring-boot-starter-test`, `spring-boot-starter-actuator`, `spring-boot-starter-cache`.

---

### REST Controllers & Request Mapping

```java
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    @GetMapping                                 // GET /api/v1/orders
    public List<OrderDto> findAll() { ... }

    @GetMapping("/{id}")                        // GET /api/v1/orders/{id}
    public ResponseEntity<OrderDto> findById(@PathVariable Long id) {
        return orderService.find(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping(params = "status")              // GET /api/v1/orders?status=SHIPPED
    public List<OrderDto> findByStatus(@RequestParam String status,
                                        @RequestParam(defaultValue = "0") int page) { ... }

    @PostMapping                                 // POST /api/v1/orders
    public ResponseEntity<OrderDto> create(@Valid @RequestBody OrderRequest request) {
        OrderDto created = orderService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public OrderDto update(@PathVariable Long id, @Valid @RequestBody OrderRequest request) { ... }

    @PatchMapping("/{id}")
    public OrderDto partialUpdate(@PathVariable Long id, @RequestBody Map<String, Object> updates) { ... }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        orderService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @RequestMapping(value = "/{id}/cancel", method = RequestMethod.POST)  // explicit method form
    public void cancel(@PathVariable Long id, @RequestHeader("X-User-Id") String userId) { ... }
}
```

`@RequestMapping` family: `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping` are all shortcuts for `@RequestMapping(method = ...)`.

`ResponseEntity` gives full control over status code, headers, and body — prefer it over returning raw objects when the status code varies.

---

### JPA Entities

```java
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, unique = true)
    private String orderNumber;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    @OneToOne(mappedBy = "order", cascade = CascadeType.ALL)
    private Invoice invoice;

    @ManyToMany
    @JoinTable(name = "order_tags",
        joinColumns = @JoinColumn(name = "order_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id"))
    private Set<Tag> tags = new HashSet<>();

    @Version
    private Long version;                 // optimistic locking

    @CreatedDate
    private Instant createdAt;             // requires @EnableJpaAuditing

    @LastModifiedDate
    private Instant updatedAt;
}
```

| Relationship | Default fetch | Notes |
|---|---|---|
| `@ManyToOne` | EAGER | Almost always override to `LAZY` |
| `@OneToOne` | EAGER | Override to `LAZY`; requires bytecode enhancement for true laziness |
| `@OneToMany` | LAZY | Default is already correct; keep it |
| `@ManyToMany` | LAZY | Prefer a join entity for extra columns instead of raw `@ManyToMany` |

### Repository Method Naming Cheatsheet

```java
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByStatus(OrderStatus status);
    List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);
    List<Order> findByCreatedAtBetween(Instant start, Instant end);
    List<Order> findByOrderNumberContainingIgnoreCase(String fragment);
    List<Order> findTop10ByOrderByCreatedAtDesc();
    Optional<Order> findFirstByCustomerIdOrderByCreatedAtDesc(Long customerId);
    boolean existsByOrderNumber(String orderNumber);
    long countByStatus(OrderStatus status);
    void deleteByStatus(OrderStatus status);

    @Query("SELECT o FROM Order o WHERE o.status = :status")
    List<Order> customJpql(@Param("status") OrderStatus status);

    @Query(value = "SELECT * FROM orders WHERE status = :status", nativeQuery = true)
    List<Order> customNative(@Param("status") String status);

    @Modifying
    @Query("UPDATE Order o SET o.status = :status WHERE o.id = :id")
    int updateStatus(@Param("id") Long id, @Param("status") OrderStatus status);
}
```

| Keyword | Example |
|---|---|
| `And` / `Or` | `findByStatusAndCustomerId` |
| `Between` | `findByCreatedAtBetween(start, end)` |
| `LessThan` / `GreaterThanEqual` | `findByAmountGreaterThanEqual(x)` |
| `Like` / `Containing` / `StartingWith` | `findByNameContaining("foo")` |
| `In` / `NotIn` | `findByStatusIn(List<OrderStatus>)` |
| `OrderBy...Asc/Desc` | `findByStatusOrderByCreatedAtDesc` |
| `IgnoreCase` | `findByEmailIgnoreCase` |
| `First` / `Top` | `findFirst5ByStatus` |
| `Distinct` | `findDistinctByStatus` |

---

### Transactions

```java
@Transactional(
    propagation = Propagation.REQUIRED,
    isolation = Isolation.READ_COMMITTED,
    rollbackFor = { CustomBusinessException.class },
    noRollbackFor = { NotificationFailedException.class },
    readOnly = false,
    timeout = 5
)
public void placeOrder(OrderRequest request) { ... }
```

**Propagation quick-reference:**

| Propagation | Behavior |
|---|---|
| `REQUIRED` (default) | Join existing transaction, or create one if none exists |
| `REQUIRES_NEW` | Suspend current transaction, always start a new independent one |
| `NESTED` | Run within a savepoint of the outer transaction; rollback of nested doesn't roll back outer |
| `SUPPORTS` | Join if a transaction exists; otherwise run non-transactionally |
| `NOT_SUPPORTED` | Suspend current transaction; run non-transactionally |
| `MANDATORY` | Must run within an existing transaction; throws if none exists |
| `NEVER` | Must run without a transaction; throws if one exists |

**Isolation quick-reference:**

| Isolation | Dirty Read | Non-repeatable Read | Phantom Read |
|---|---|---|---|
| `READ_UNCOMMITTED` | Possible | Possible | Possible |
| `READ_COMMITTED` (most DB default) | Prevented | Possible | Possible |
| `REPEATABLE_READ` | Prevented | Prevented | Possible |
| `SERIALIZABLE` | Prevented | Prevented | Prevented |

`@Transactional` is proxy-based: it only takes effect on calls that arrive **through the Spring proxy** — internal self-invocation (`this.method()`) bypasses the proxy and silently skips the transaction advice.

---

### Exception Handling

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ProblemDetail> handleNotFound(ResourceNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setTitle("Resource Not Found");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(pd);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
          .forEach(err -> errors.put(err.getField(), err.getDefaultMessage()));
        return ResponseEntity.badRequest().body(errors);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGeneric(Exception ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error");
        return ResponseEntity.internalServerError().body(pd);
    }
}
```

```java
// Bean Validation on a request DTO
public record OrderRequest(
    @NotBlank String customerName,
    @Email String email,
    @Positive @NotNull BigDecimal amount,
    @Size(min = 1, max = 50) List<@Valid OrderItemRequest> items
) {}
```

`@ControllerAdvice` centralizes exception handling across all `@Controller`/`@RestController` classes; `@RestControllerAdvice` = `@ControllerAdvice` + `@ResponseBody`. `ProblemDetail` (RFC 7807) is the modern Spring Boot 3 standard for structured error responses.

---

### Spring Security

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity   // enables @PreAuthorize / @PostAuthorize / @Secured
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())                       // typical for stateless JWT APIs
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) -> res.sendError(401))
                .accessDeniedHandler((req, res, e) -> res.sendError(403))
            );
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

```java
@Service
public class OrderAdminService {

    @PreAuthorize("hasRole('ADMIN')")
    public void deleteAllOrders() { ... }

    @PreAuthorize("#customerId == authentication.principal.id or hasRole('ADMIN')")
    public List<Order> ordersFor(Long customerId) { ... }

    @PostAuthorize("returnObject.customerId == authentication.principal.id")
    public Order getOrder(Long id) { ... }

    @Secured("ROLE_ADMIN")   // older, coarser alternative to @PreAuthorize
    public void purge() { ... }
}
```

Like `@Transactional`, method security annotations rely on Spring AOP proxies — self-invocation bypasses them.

---

### Testing

| Annotation | Loads | Use for |
|---|---|---|
| `@SpringBootTest` | Full `ApplicationContext` | End-to-end integration tests |
| `@SpringBootTest(webEnvironment = RANDOM_PORT)` | Full context + running server | Tests using `TestRestTemplate`/`WebTestClient` |
| `@WebMvcTest(OrderController.class)` | Web layer only (controllers, filters, `@ControllerAdvice`) | Controller unit tests |
| `@DataJpaTest` | JPA repositories + embedded/test DB, rolled back per test | Repository tests |
| `@JsonTest` | Jackson `ObjectMapper` + `@JsonComponent` beans | Serialization tests |
| `@MockBean` | Replaces a bean in the context with a Mockito mock | Isolating a collaborator inside a Spring test context |
| `@SpyBean` | Wraps a real bean with a Mockito spy | Partial mocking inside a Spring test context |
| `@ExtendWith(MockitoExtension.class)` | No Spring context | Pure unit tests with `@Mock`/`@InjectMocks` |

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean OrderService orderService;

    @Test
    void returnsOrder() throws Exception {
        given(orderService.find(1L)).willReturn(Optional.of(sampleOrder()));
        mockMvc.perform(get("/api/v1/orders/1"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.id").value(1));
    }
}
```

```java
@Testcontainers
@SpringBootTest
class OrderRepositoryIT {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
    }
}
```

---

### Caching, Async & Scheduling

```java
@EnableCaching
@Configuration
public class CacheConfig { }

@Service
public class ProductService {

    @Cacheable(value = "products", key = "#id")
    public Product findById(Long id) { ... }

    @CachePut(value = "products", key = "#product.id")
    public Product update(Product product) { ... }

    @CacheEvict(value = "products", key = "#id")
    public void delete(Long id) { ... }

    @CacheEvict(value = "products", allEntries = true)
    public void clearAll() { ... }

    @Caching(evict = { @CacheEvict("products"), @CacheEvict("productLists") })
    public void bulkUpdate() { ... }
}
```

```java
@EnableAsync
@Configuration
public class AsyncConfig { }

@Service
public class NotificationService {

    @Async
    public CompletableFuture<Void> sendEmail(String to) {
        // runs on a separate thread from Spring's task executor
        return CompletableFuture.completedFuture(null);
    }
}
```

```java
@EnableScheduling
@Configuration
public class SchedulingConfig { }

@Component
public class CleanupJob {

    @Scheduled(fixedRate = 60000)          // every 60s, measured from start of previous execution
    public void everyMinute() { ... }

    @Scheduled(fixedDelay = 60000)         // every 60s, measured from end of previous execution
    public void afterPreviousCompletes() { ... }

    @Scheduled(initialDelay = 5000, fixedRate = 60000)
    public void delayedThenRepeating() { ... }

    @Scheduled(cron = "0 0 2 * * *")       // 2:00 AM every day
    public void nightlyJob() { ... }

    @Scheduled(cron = "0 */15 * * * *")    // every 15 minutes
    public void quarterHourly() { ... }
}
```

**Cron syntax reference:** `second minute hour day-of-month month day-of-week`

| Field | Allowed values |
|---|---|
| second | 0-59 |
| minute | 0-59 |
| hour | 0-23 |
| day of month | 1-31 |
| month | 1-12 or JAN-DEC |
| day of week | 0-7 or SUN-SAT (0 and 7 = Sunday) |

Both `@Cacheable`/`@CachePut`/`@CacheEvict` and `@Async` are AOP-proxy based — calling an `@Async` or `@Cacheable` method from another method in the *same class* bypasses the proxy and runs synchronously/uncached.

---

### Actuator Endpoints

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,env,prometheus
  endpoint:
    health:
      show-details: always
```

| Endpoint | Path | Purpose |
|---|---|---|
| Health | `/actuator/health` | Overall app + dependency health (DB, disk, custom `HealthIndicator`s) |
| Info | `/actuator/info` | Arbitrary build/app metadata |
| Metrics | `/actuator/metrics` | Micrometer metrics (JVM, HTTP, custom counters/timers) |
| Env | `/actuator/env` | Active environment properties (sensitive values sanitized) |
| Beans | `/actuator/beans` | All beans in the `ApplicationContext` |
| Mappings | `/actuator/mappings` | All `@RequestMapping` routes |
| Loggers | `/actuator/loggers` | View/change log levels at runtime |
| Threaddump | `/actuator/threaddump` | JVM thread dump snapshot |
| Heapdump | `/actuator/heapdump` | Downloadable heap dump |
| Prometheus | `/actuator/prometheus` | Metrics in Prometheus scrape format |
| Shutdown | `/actuator/shutdown` | Graceful shutdown (disabled by default) |
