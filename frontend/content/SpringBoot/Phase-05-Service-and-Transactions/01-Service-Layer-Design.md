# Service Layer Design — Complete Guide

## Table of Contents

1. [Why a Service Layer Exists](#1-why-a-service-layer-exists)
2. [The Three-Layer Architecture](#2-the-three-layer-architecture)
3. [What Belongs in the Controller vs the Service](#3-what-belongs-in-the-controller-vs-the-service)
4. [Interface-Based Service Design](#4-interface-based-service-design)
5. [DTOs vs Entities](#5-dtos-vs-entities)
6. [Mapping Between DTOs and Entities](#6-mapping-between-dtos-and-entities)
7. [Worked Example — Order Service Orchestrating Multiple Repositories](#7-worked-example--order-service-orchestrating-multiple-repositories)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why a Service Layer Exists

A Spring Boot application built with only `@RestController` and `@Repository` beans compiles fine and even works for a demo. The problem shows up later: business rules end up scattered across controller methods, duplicated between the REST API and a batch job, and impossible to unit test without spinning up MockMvc and a web context.

The `@Service` layer exists to give business logic **one home** — a place that is:

- **Framework-agnostic on the inbound side** — it doesn't know about `HttpServletRequest`, `@RequestBody`, or status codes.
- **Persistence-agnostic on the outbound side** — it depends on repository *abstractions*, not JDBC or Hibernate details.
- **Easy to unit test** — a plain object graph (service + mocked repositories), no Spring context required for pure logic tests.
- **Reusable** — the same "place an order" logic can be invoked from a REST controller, a scheduled job, a message listener, or a CLI command.

```text
┌───────────────────────────────────────────────────────────┐
│                        Presentation                       │
│   @RestController — HTTP concerns, request/response DTOs  │
└───────────────────────────┬─────────────────────────────-─┘
                             │ calls
┌───────────────────────────▼─────────────────────────────-─┐
│                          Service                           │
│   @Service — business rules, validation, orchestration,    │
│   transaction boundaries                                    │
└───────────────────────────┬─────────────────────────────-─┘
                             │ calls
┌───────────────────────────▼─────────────────────────────-─┐
│                        Persistence                         │
│   @Repository — Spring Data JPA, JPQL, native queries       │
└───────────────────────────┬─────────────────────────────-─┘
                             │ talks to
┌───────────────────────────▼─────────────────────────────-─┐
│                          Database                          │
└─────────────────────────────────────────────────────────-─┘
```

## 2. The Three-Layer Architecture

| Layer | Annotation | Responsibility | Should NOT contain |
|-------|-----------|-----------------|---------------------|
| Controller | `@RestController` | Parse HTTP request, delegate to service, translate result to HTTP response | Business rules, direct repository calls, transaction annotations |
| Service | `@Service` | Business logic, validation, orchestration across repositories, transaction boundaries (`@Transactional`) | HTTP-specific types (`ResponseEntity`, `HttpServletRequest`), SQL/JPQL |
| Repository | `@Repository` | Data access — CRUD, derived queries, JPQL/native SQL | Business rules, validation logic |

The dependency direction only ever points *downward*: Controller → Service → Repository. A repository must never call back up into a service, and a service must never reach into another service's repository directly — it should go through that service's public API (or, for tightly related aggregates, share the repository deliberately and document why).

## 3. What Belongs in the Controller vs the Service

A controller that looks like this is doing the service layer's job:

```java
// ANTI-PATTERN — business logic leaking into the controller
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;

    public OrderController(OrderRepository orderRepository, ProductRepository productRepository) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
    }

    @PostMapping
    public ResponseEntity<?> createOrder(@RequestBody OrderRequest request) {
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        if (product.getStock() < request.getQuantity()) {
            return ResponseEntity.badRequest().body("Insufficient stock");
        }

        product.setStock(product.getStock() - request.getQuantity());
        productRepository.save(product);

        Order order = new Order();
        order.setProduct(product);
        order.setQuantity(request.getQuantity());
        order.setStatus("PLACED");
        orderRepository.save(order);

        return ResponseEntity.ok(order);
    }
}
```

Problems: stock-checking and deduction logic can't be reused by a batch reconciliation job; it can't be unit tested without MockMvc; there's no transaction boundary around the two saves (a crash between them leaves stock decremented with no order — or worse, depending on flush order); and error handling returns raw strings instead of a consistent error contract.

The fix — push everything below "parse request / call service / shape response" into a `@Service`:

```java
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(@Valid @RequestBody OrderRequest request) {
        OrderResponse response = orderService.placeOrder(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
```

Now the controller is a thin adapter: 3 lines of real logic, easy to read, and the interesting behavior — including the transaction boundary — lives in `OrderService` where it can be unit tested and reused.

## 4. Interface-Based Service Design

A common early-career habit is to write an interface for every service:

```java
public interface OrderService {
    OrderResponse placeOrder(OrderRequest request);
}

@Service
public class OrderServiceImpl implements OrderService {
    // ...
}
```

This is **not automatically a best practice** in a Spring Boot application, and it's worth understanding why the pattern exists before applying it reflexively.

**When an interface is NOT worth it:**
- There is exactly one implementation and no plan for a second.
- You're not writing tests that need a hand-rolled fake (Mockito can mock a concrete class just fine, as long as it isn't `final`).
- The extra file is pure ceremony — every change means touching two files instead of one.

**When an interface earns its keep:**
- **Multiple real implementations** — e.g. `PaymentService` backed by Stripe in production and a `NoOpPaymentService` in a sandbox profile, selected via `@Profile` or a `@Qualifier`.
- **Module boundaries** — in a multi-module Gradle/Maven build, an `api` module exposes interfaces and DTOs; an `impl` module (or a separate microservice) provides the implementation, so consumers depend only on the abstraction.
- **AOP-proxying with JDK dynamic proxies** — if you rely on interface-based proxies (see Lesson 2) rather than CGLIB, the service *must* implement an interface.
- **Deliberate testability at a seam** — for a service whose real implementation is expensive to construct in tests (e.g. wraps a legacy SOAP client), an interface lets you inject a lightweight test double without a mocking framework.

Rule of thumb for this course's projects: **default to a concrete `@Service` class.** Introduce an interface only when you can name the second implementation, the module boundary, or the specific testing seam it serves.

## 5. DTOs vs Entities

An **entity** (`@Entity`) is a persistence-layer concern: it mirrors a database table, carries JPA annotations (`@Id`, `@OneToMany`, `@Column`), and its shape is dictated by schema and ORM concerns (lazy proxies, bidirectional relationships, cascade rules).

A **DTO** (Data Transfer Object) is an API-layer concern: it mirrors what a client should see or send, and its shape is dictated by the contract you want to expose.

```text
        HTTP boundary                          Persistence boundary
             │                                          │
  OrderRequest (DTO)  ──▶  OrderService  ──▶   Order (Entity)  ──▶  orders table
             │                  │                        │
  OrderResponse (DTO) ◀──   (mapping)    ◀──   Order (Entity)  ◀──  orders table
```

Returning entities directly from a controller is a well-known anti-pattern:

- **Leaks internal schema** — renaming a database column or JPA field breaks the public API contract.
- **Lazy-loading serialization failures** — Jackson trying to serialize a lazy `@OneToMany` outside a transaction throws `LazyInitializationException`.
- **Over-exposure** — a `User` entity with a `passwordHash` field will get serialized to JSON unless you remember `@JsonIgnore` on every sensitive field, every time.
- **Bidirectional cycles** — `Order → Customer → List<Order>` serializes infinitely without careful `@JsonManagedReference`/`@JsonBackReference` wiring, which is fragile.

DTOs decouple the two: the API contract can stay stable even as the entity model evolves, and you control precisely which fields are exposed, in which shape, with which validation annotations (`@NotBlank`, `@Positive`, etc. — these belong on the *request* DTO, not the entity).

## 6. Mapping Between DTOs and Entities

**Manual mapping** — a small static method or a dedicated `*Mapper` component:

```java
@Component
public class OrderMapper {

    public OrderResponse toResponse(Order order) {
        return new OrderResponse(
                order.getId(),
                order.getProduct().getName(),
                order.getQuantity(),
                order.getStatus(),
                order.getCreatedAt()
        );
    }

    public Order toEntity(OrderRequest request, Product product) {
        Order order = new Order();
        order.setProduct(product);
        order.setQuantity(request.getQuantity());
        order.setStatus(OrderStatus.PLACED);
        return order;
    }
}
```

Manual mapping is explicit, easy to debug, and has zero dependencies — perfectly fine for a handful of DTOs.

**MapStruct** removes the boilerplate once you have dozens of DTO/entity pairs. It generates the mapping implementation at compile time (no reflection at runtime, so it's fast and type-safe):

```java
@Mapper(componentModel = "spring")
public interface OrderMapper {

    @Mapping(target = "productName", source = "product.name")
    OrderResponse toResponse(Order order);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", constant = "PLACED")
    Order toEntity(OrderRequest request);
}
```

With `componentModel = "spring"`, MapStruct generates an `@Component`-annotated implementation (`OrderMapperImpl`) that Spring picks up and you can `@Autowired`/constructor-inject like any other bean. Add the dependency (`org.mapstruct:mapstruct` + the annotation processor `mapstruct-processor`) and run a build to see the generated class under `target/generated-sources`.

Use manual mapping while a project is small; switch to MapStruct once you're maintaining more than roughly 5–10 mapping methods, or once mappings involve enough field renaming/derivation that hand-written code becomes error-prone to keep in sync with entity changes.

## 7. Worked Example — Order Service Orchestrating Multiple Repositories

A realistic service method validates input, reads from one repository, writes to two others, and returns a DTO — this is the shape of most real business operations.

```java
public record OrderRequest(
        @NotNull Long productId,
        @Positive int quantity,
        @NotNull Long customerId
) {}

public record OrderResponse(
        Long orderId,
        String productName,
        int quantity,
        String status,
        BigDecimal totalPrice
) {}

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final OrderMapper orderMapper;

    public OrderService(OrderRepository orderRepository,
                         ProductRepository productRepository,
                         CustomerRepository customerRepository,
                         OrderMapper orderMapper) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.customerRepository = customerRepository;
        this.orderMapper = orderMapper;
    }

    @Transactional
    public OrderResponse placeOrder(OrderRequest request) {
        Customer customer = customerRepository.findById(request.customerId())
                .orElseThrow(() -> new CustomerNotFoundException(request.customerId()));

        if (!customer.isActive()) {
            throw new InactiveCustomerException(customer.getId());
        }

        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ProductNotFoundException(request.productId()));

        if (product.getStock() < request.quantity()) {
            throw new InsufficientStockException(product.getId(), request.quantity(), product.getStock());
        }

        // Orchestration: mutate product stock and create the order
        // as a single atomic unit of work.
        product.decreaseStock(request.quantity());
        productRepository.save(product);

        BigDecimal totalPrice = product.getPrice().multiply(BigDecimal.valueOf(request.quantity()));

        Order order = orderMapper.toEntity(request);
        order.setProduct(product);
        order.setCustomer(customer);
        order.setTotalPrice(totalPrice);
        Order saved = orderRepository.save(order);

        return orderMapper.toResponse(saved);
    }
}
```

Notice what the service is doing that a controller should never do directly: enforcing business invariants (`isActive`, stock availability), coordinating three repositories inside a single transaction boundary, and computing derived values (`totalPrice`). Lesson 2 explains exactly what that `@Transactional` annotation does under the hood and why its placement here (on the service method, not the controller) matters.

## 8. Common Pitfalls

**Fat controllers.** As shown in Section 3 — validation, stock math, and multi-repository writes directly in `@PostMapping` methods. Fix: push everything past request parsing into a service method.

**Anemic services that just forward to a repository.** A service method that is literally `return repository.findById(id)` with no added value is sometimes fine (thin CRUD), but if *every* method in the service looks like this, ask whether the layer is adding anything besides indirection — it might just need the repository injected directly into the controller for pure read-only lookups, or (more often) it's a sign business rules were mistakenly left in the controller instead.

**Entities returned straight from `@RestController` methods.** Causes lazy-loading serialization crashes and leaks internal schema. Fix: always return a DTO, mapped inside the service or a dedicated mapper.

**One interface per service "because that's how Java is done."** Adds a file and a rename-in-two-places tax with no corresponding benefit when there is only one implementation and no seam that needs it. Fix: apply the criteria in Section 4 before reaching for an interface.

**Validation split between DTO and entity.** Putting `@NotBlank`/`@Positive` on the entity as well as the DTO leads to confusing dual sources of truth (and JPA validation can fire at flush time with a stale error path). Fix: validate at the boundary — Bean Validation annotations belong on request DTOs, checked via `@Valid` in the controller; entity-level constraints (`nullable = false`, `@Column(length = ...)`) express database-level, not request-level, rules.

**Mapper logic embedded directly inside the service method, duplicated across services.** Copy-pasted `new OrderResponse(...)` construction in five different service methods drifts out of sync when a field is added. Fix: extract a `Mapper` component (manual or MapStruct) once the same mapping appears more than once or twice.

## 9. Best Practices

- Keep controllers to three responsibilities: bind/validate the request, call exactly one service method, translate the result to an HTTP response.
- Default to concrete `@Service` classes; add an interface only for a named reason (multiple implementations, module boundary, JDK-proxy requirement, or a specific test seam).
- Never let an entity cross the controller boundary in either direction — always DTO in, DTO out.
- Put the transaction boundary at the service method that represents a single business operation, not at the repository or the controller.
- Prefer constructor injection (final fields) for services and repositories — it makes dependencies explicit and enables plain `new` in unit tests without a Spring context.
- Once a domain has more than a handful of DTO/entity mappings, move to MapStruct rather than hand-maintaining growing mapper classes.
- Name service methods after the business operation (`placeOrder`, `cancelSubscription`), not after the CRUD verb (`create`, `save`) — it documents intent and makes orchestration logic discoverable.
- Throw specific, meaningful exceptions (`InsufficientStockException`) from the service rather than generic `RuntimeException`; Phase 6 covers translating these into consistent HTTP error responses via `@ControllerAdvice`.

## 10. Hands-On Exercises

1. Take a controller method you've written that directly calls a repository and validates input inline. Refactor it into a thin controller + a `@Service` method, moving all business rules and validation into the service.
2. Design a `SubscriptionService` that orchestrates three repositories (`SubscriptionRepository`, `CustomerRepository`, `PlanRepository`) to handle an "upgrade plan" operation, including a business rule that blocks the upgrade if the customer has an unpaid invoice.
3. Write a manual mapper class for an `Invoice` entity with a nested `LineItem` collection, converting to/from an `InvoiceResponse` DTO that flattens totals. Then rewrite the same mapping using MapStruct and compare the generated implementation.
4. Identify a service in a hypothetical codebase that has an interface with only one implementation and no tests using a hand-written fake. Argue, using the criteria in Section 4, whether the interface should be kept or removed.
5. Write a unit test (JUnit 5 + Mockito) for `OrderService.placeOrder` that mocks all three repositories and asserts `InsufficientStockException` is thrown when requested quantity exceeds stock — without starting a Spring context.

## 11. Interview Q&A

**Q1: Why shouldn't business logic live in the controller layer?**
Controllers are meant to be a thin translation layer between HTTP and the application's domain logic — parsing requests, delegating to a service, and shaping the response. If business rules live there instead, they can't be reused by non-HTTP entry points (schedulers, message listeners, CLI tools), they're harder to unit test because they require a web context (or MockMvc) to exercise, and the transaction boundary becomes muddled since `@Transactional` is meant to wrap a service-level business operation, not an HTTP request/response cycle.

**Q2: When would you introduce a service interface instead of just using a concrete `@Service` class?**
An interface earns its place when there's a genuine second implementation (e.g., a Stripe-backed `PaymentService` vs. a no-op sandbox implementation selected by profile), when it defines a module boundary in a multi-module build so consumers depend only on an abstraction, when the AOP proxy strategy specifically requires interface-based JDK dynamic proxies, or when a test needs a lightweight hand-written fake instead of a mock. Absent one of those reasons, a plain concrete class is simpler to maintain and just as testable with Mockito.

**Q3: Why shouldn't entities be returned directly from REST endpoints?**
Entities are shaped by persistence concerns — lazy associations, bidirectional relationships, JPA proxies — none of which are appropriate for an API contract. Serializing a lazy-loaded collection outside a transaction throws `LazyInitializationException`; bidirectional relationships can cause infinite serialization loops; and any internal schema change (renaming a column, adding an internal-only field) becomes a breaking API change. DTOs decouple the public contract from the internal data model.

**Q4: What's the difference between where you'd put Bean Validation annotations on a DTO versus constraints on a JPA entity?**
Bean Validation annotations (`@NotBlank`, `@Positive`, `@Email`) on a request DTO validate what the *client* is allowed to send, and are checked eagerly via `@Valid` in the controller before any business logic runs. JPA-level constraints on the entity (`nullable = false`, `@Column(length=100)`, `@Table(uniqueConstraints=...)`) express database-schema-level rules and are enforced (or at least reflected) at the persistence layer, sometimes only surfacing at flush/commit time. Conflating the two — e.g., only validating on the entity — means invalid requests reach the service layer and fail late, with a less useful error message.

**Q5: How does MapStruct differ from writing mapping code by hand, and when is it worth adopting?**
MapStruct is an annotation processor that generates mapping implementation classes at compile time based on an interface you declare with `@Mapper` — there's no runtime reflection overhead, and type mismatches are caught at build time rather than at runtime. It's worth adopting once a project has enough DTO/entity pairs (or complex field renaming/derivation) that hand-written mappers become tedious to keep in sync; for a handful of simple mappings, a manual mapper class is simpler and has zero extra tooling to learn.

**Q6: A service method calls three repositories to complete one business operation. Where should the transaction boundary go, and why not at the controller?**
The transaction boundary belongs on the service method that represents the atomic business operation — annotate that method with `@Transactional` so all three repository calls commit or roll back together. Putting it at the controller would tie the transaction's lifetime to the HTTP request/response cycle and could accidentally wrap unrelated concerns (e.g., response serialization) inside the same database transaction; it also means a plain HTTP-layer test can't verify transactional behavior in isolation from the web stack, whereas a service-level boundary can be tested directly against a persistence layer or mocked repositories.
