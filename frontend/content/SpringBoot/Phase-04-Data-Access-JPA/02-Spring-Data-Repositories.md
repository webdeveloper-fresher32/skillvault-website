# Spring Data Repositories — Complete Guide

## Table of Contents
1. [What Spring Data JPA Solves](#1-what-spring-data-jpa-solves)
2. [The Repository Hierarchy](#2-the-repository-hierarchy)
3. [Declaring a Repository](#3-declaring-a-repository)
4. [Derived Query Methods — findBy Naming Conventions](#4-derived-query-methods--findby-naming-conventions)
5. [@Query with JPQL](#5-query-with-jpql)
6. [@Query with Native SQL](#6-query-with-native-sql)
7. [@Modifying Queries](#7-modifying-queries)
8. [Pageable and Sort](#8-pageable-and-sort)
9. [Optional&lt;T&gt; Return Types](#9-optionalt-return-types)
10. [Worked Example — A Full OrderRepository](#10-worked-example--a-full-orderrepository)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Best Practices](#12-best-practices)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. What Spring Data JPA Solves

Before Spring Data, a typical DAO (Data Access Object) required hand-writing a class implementing basic CRUD operations for every entity — a `save()`, a `findById()`, a `findAll()`, a `deleteById()` — each wrapping an `EntityManager` call in boilerplate that barely differed between entities.

```
  Without Spring Data                    With Spring Data JPA
  ────────────────────                   ─────────────────────
  interface CustomerDao {                interface CustomerRepository
    Customer findById(Long id);            extends JpaRepository<Customer, Long> {
    List<Customer> findAll();              // — nothing else needed for CRUD —
    Customer save(Customer c);              List<Customer> findByEmail(String email);
    void deleteById(Long id);             }
  }
  class CustomerDaoImpl implements       Spring generates the implementation
    CustomerDao {                        at runtime via a dynamic proxy —
      @PersistenceContext                you never write CustomerRepositoryImpl
      EntityManager em;                  for the standard CRUD/derived methods.
      // ~40 lines of boilerplate
      // repeated per entity
  }
```

Spring Data JPA generates a working implementation of a repository **interface** at application startup, using a dynamic proxy. You declare an interface; Spring inspects its method signatures (including method *names*, which it parses as query specifications) and produces the implementation for you. You write zero implementation code for the vast majority of data-access needs.

---

## 2. The Repository Hierarchy

```
  Repository<T, ID>                       (marker interface, Spring Data Commons)
        │
        ▼
  CrudRepository<T, ID>                   save, findById, findAll, delete, count, existsById
        │
        ▼
  PagingAndSortingRepository<T, ID>       findAll(Pageable), findAll(Sort)
        │
        ▼
  JpaRepository<T, ID>                   flush, saveAndFlush, deleteInBatch,
                                          getReferenceById, batch variants returning List
                                          instead of Iterable
```

| Interface                     | Adds                                                                          | When to Use |
|--------------------------------|--------------------------------------------------------------------------------|-------------|
| `CrudRepository<T, ID>`       | Basic CRUD: `save`, `saveAll`, `findById`, `findAll`, `count`, `deleteById`, `existsById` | Minimal surface area; good for read-mostly or very simple modules |
| `PagingAndSortingRepository<T, ID>` | `findAll(Pageable pageable)`, `findAll(Sort sort)`                       | Adds pagination/sorting on top of CRUD |
| `JpaRepository<T, ID>`        | JPA-specific batch operations (`saveAndFlush`, `deleteAllInBatch`, `deleteAllByIdInBatch`), and returns `List<T>` instead of `Iterable<T>` from `findAll()` | The default choice for essentially all Spring Boot + JPA projects |

**In practice, almost every repository in a Spring Boot + JPA application extends `JpaRepository<T, ID>` directly** — it's a strict superset of the other two, and its `List<T>`-returning methods are more convenient than `CrudRepository`'s `Iterable<T>`. There is rarely a compelling reason to extend the narrower interfaces instead, except when writing a library intended to work across multiple Spring Data modules (JPA, MongoDB, etc.) where `CrudRepository` is the lowest common denominator.

---

## 3. Declaring a Repository

A repository is a plain interface — no implementation, no `@Repository` annotation required (though it is harmless to add and documents intent), no boilerplate.

```java
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findByFullNameContainingIgnoreCase(String namePart);

    boolean existsByEmail(String email);
}
```

Spring Boot's auto-configuration (`@EnableJpaRepositories`, implicitly activated by `spring-boot-starter-data-jpa` when a `DataSource` is on the classpath) scans for interfaces extending Spring Data's repository marker interfaces and registers a proxy bean for each — injectable anywhere via constructor injection, exactly like any other Spring bean.

```java
@Service
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public Customer register(String fullName, String email) {
        if (customerRepository.existsByEmail(email)) {
            throw new IllegalStateException("Email already registered: " + email);
        }
        return customerRepository.save(new Customer(fullName, email));
    }
}
```

---

## 4. Derived Query Methods — findBy Naming Conventions

Spring Data parses repository method names against a defined grammar and translates them into JPQL automatically — no query is written at all. The method name **is** the query.

```
  findBy / getBy / queryBy / readBy   <PropertyExpression>   [<Comparison>]   [And/Or ...]   [OrderBy...]
```

| Method Signature                                                     | Generated Intent (JPQL-equivalent)                                  |
|------------------------------------------------------------------------|------------------------------------------------------------------------|
| `findByEmail(String email)`                                          | `WHERE email = :email`                                                 |
| `findByFullNameAndEmail(String name, String email)`                   | `WHERE fullName = :name AND email = :email`                            |
| `findByStatusOrderByOrderDateDesc(OrderStatus status)`                 | `WHERE status = :status ORDER BY orderDate DESC`                       |
| `findByOrderDateBetween(LocalDateTime start, LocalDateTime end)`       | `WHERE orderDate BETWEEN :start AND :end`                               |
| `findByFullNameContainingIgnoreCase(String part)`                     | `WHERE LOWER(fullName) LIKE LOWER('%'+ :part +'%')`                     |
| `findByTotalAmountGreaterThan(BigDecimal amount)`                      | `WHERE totalAmount > :amount`                                           |
| `findByCustomerIdIn(List<Long> ids)`                                   | `WHERE customer.id IN :ids`                                             |
| `countByStatus(OrderStatus status)`                                    | `SELECT COUNT(*) WHERE status = :status`                                |
| `deleteByStatus(OrderStatus status)`                                   | Deletes all matching rows (executes as a bulk delete)                  |
| `existsByEmail(String email)`                                          | Returns `boolean` — true if any row matches                            |
| `findFirstByOrderByOrderDateDesc()`                                    | `ORDER BY orderDate DESC` limited to first result                       |
| `findTop5ByStatus(OrderStatus status)`                                 | Limits results to 5 rows matching the status                           |

Navigating a relationship's nested property works too: `findByCustomer_Email(String email)` (underscore disambiguates nested-property traversal when the property name itself contains an underscore that could be ambiguous) or simply `findByCustomerEmail(String email)` when unambiguous — both translate to a join on `customer.email`.

Supported keyword operators include `Is`, `Equals`, `Between`, `LessThan`, `GreaterThanEqual`, `IsNull`, `IsNotNull`, `In`, `NotIn`, `True`, `False`, `IgnoreCase`, `Containing`, `StartingWith`, `EndingWith`, `Not`, and logical `And`/`Or` chaining.

**When to stop using derived query names**: once a method name needs more than roughly two or three conditions, or involves aggregation/joins/subqueries that don't map cleanly to the naming grammar, switch to `@Query` — a method name like `findByStatusAndCustomer_EmailAndOrderDateBetweenOrderByTotalAmountDesc` is technically legal but unreadable and fragile to refactor.

---

## 5. @Query with JPQL

JPQL (Jakarta Persistence Query Language) is an object-oriented query language: it queries against entity names and field names, not table and column names, and it is database-portable.

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("SELECT o FROM Order o WHERE o.status = :status AND o.customer.id = :customerId")
    List<Order> findByStatusAndCustomerId(@Param("status") OrderStatus status,
                                           @Param("customerId") Long customerId);

    @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") Long id);

    @Query("""
        SELECT new com.example.orders.dto.OrderSummary(o.id, o.orderNumber, o.status, SUM(oi.quantity * oi.unitPrice))
        FROM Order o JOIN o.items oi
        WHERE o.customer.id = :customerId
        GROUP BY o.id, o.orderNumber, o.status
        """)
    List<OrderSummary> summarizeOrdersForCustomer(@Param("customerId") Long customerId);
}
```

Key points:
- `@Param("status")` binds the named parameter `:status` in the JPQL string to the method argument — the parameter name must match (or you can use positional `?1` binding, though named parameters are far more readable and less error-prone under refactoring).
- The **constructor expression** (`SELECT new com.example.orders.dto.OrderSummary(...)`) lets JPQL project directly into a DTO instead of returning a full managed entity — extremely useful for read-only, aggregate, or multi-entity result sets where you don't need change tracking or lazy proxies at all.
- JPQL entity/field names (`Order`, `o.customer.id`) refer to the **Java class and field names**, not the database table/column names — this is the key distinguishing feature versus native SQL.
- Text blocks (`"""..."""`, Java 15+) make multi-line JPQL far more readable than one giant string literal.

---

## 6. @Query with Native SQL

Sometimes JPQL cannot express what you need — database-specific functions, window functions, complex CTEs, or an existing hand-tuned SQL query. `nativeQuery = true` switches to raw SQL against actual table/column names.

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query(value = """
        SELECT * FROM orders o
        WHERE o.customer_id = :customerId
        ORDER BY o.order_date DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Order> findRecentOrdersNative(@Param("customerId") Long customerId, @Param("limit") int limit);

    @Query(value = """
        SELECT o.status, COUNT(*) as cnt
        FROM orders o
        GROUP BY o.status
        """, nativeQuery = true)
    List<Object[]> countOrdersByStatusNative();
}
```

Trade-offs of native SQL versus JPQL:

| Aspect                  | JPQL                                       | Native SQL                                    |
|--------------------------|---------------------------------------------|------------------------------------------------|
| Portability              | Database-agnostic                           | Tied to the specific database dialect           |
| Vocabulary                | Entity/field names                          | Table/column names                              |
| Feature reach            | Limited to what JPA providers implement     | Full power of the underlying database (window functions, CTEs, hints) |
| Result mapping           | Can construct DTOs directly (`SELECT new ...`) | Requires `Object[]` mapping, a `@SqlResultSetMapping`, or a Spring Data **interface projection** |
| Pageable support          | Full, automatic                             | Supported, but Spring Data must be able to derive a count query — can require an explicit `countQuery` |

For native queries used with `Pageable`, provide an explicit count query when Spring Data cannot derive one automatically:

```java
@Query(value = "SELECT * FROM orders WHERE status = :status",
       countQuery = "SELECT COUNT(*) FROM orders WHERE status = :status",
       nativeQuery = true)
Page<Order> findByStatusNative(@Param("status") String status, Pageable pageable);
```

**Default rule of thumb: prefer JPQL** for its portability and DTO projection support; reach for native SQL only when you need a database-specific feature JPQL cannot express.

---

## 7. @Modifying Queries

By default, `@Query` methods are read-only `SELECT`s. To run an `UPDATE` or `DELETE` directly against the database (bypassing entity loading and the persistence context entirely), add `@Modifying`.

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Modifying
    @Query("UPDATE Order o SET o.status = :newStatus WHERE o.status = :oldStatus")
    int bulkUpdateStatus(@Param("oldStatus") OrderStatus oldStatus,
                          @Param("newStatus") OrderStatus newStatus);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Order o WHERE o.orderDate < :cutoff")
    int deleteOrdersOlderThan(@Param("cutoff") LocalDateTime cutoff);
}
```

Critical details:
- **`@Modifying` methods must run inside a transaction.** Spring Data's own repository methods are transactional by default (see lesson 3), but a custom `@Modifying @Query` method inherits that only if called from within an existing transactional context, or if you add `@Transactional` at the call site/service method. Calling it outside any transaction throws `InvalidDataAccessApiUsageException` ("Executing an update/delete query").
- **The return type is the number of affected rows** (`int` or `long`), not the updated entities.
- **Bulk updates/deletes bypass the persistence context entirely** — they execute directly against the database via a single `UPDATE`/`DELETE` statement, meaning any already-loaded entity instances in the current persistence context are **not** automatically updated to reflect the new database state. This is the source of a subtle but serious bug class: you run a bulk update, then read a previously-loaded entity from the same persistence context, and see stale data.
- `clearAutomatically = true` tells Spring Data to call `EntityManager.clear()` immediately after the bulk operation, detaching all currently-managed entities so that subsequent reads go back to the database instead of returning stale cached instances. `flushAutomatically = true` ensures any pending (unflushed) changes are written before the bulk operation runs, so it doesn't miss or conflict with changes made earlier in the same transaction.

---

## 8. Pageable and Sort

`Pageable` and `Sort` let you request paginated, sorted results without writing any query logic yourself — Spring Data appends the correct `ORDER BY`/`LIMIT`/`OFFSET` clauses (or their dialect-specific equivalents) automatically.

```java
public interface OrderRepository extends JpaRepository<Order, Long> {

    Page<Order> findByCustomerId(Long customerId, Pageable pageable);

    List<Order> findByStatus(OrderStatus status, Sort sort);
}
```

```java
// Requesting page 0 (first page), 20 items per page, sorted by orderDate descending
Pageable pageable = PageRequest.of(0, 20, Sort.by("orderDate").descending());
Page<Order> page = orderRepository.findByCustomerId(customerId, pageable);

page.getContent();         // the List<Order> for this page
page.getTotalElements();   // total matching rows across ALL pages (extra COUNT query)
page.getTotalPages();
page.hasNext();
page.getNumber();          // current page index (0-based)
```

```
  Page<T> vs Slice<T> vs List<T>
  ────────────────────────────────
  Page<T>   → runs an extra COUNT query to know total elements/pages (getTotalElements(), getTotalPages())
  Slice<T>  → only knows if there is a next page (hasNext()) — no COUNT query, cheaper for infinite-scroll UIs
  List<T>   → with a Pageable argument, just returns that page's content, no metadata at all
```

Choose `Page<T>` when the UI needs "page 3 of 12" style pagination controls (requires the total count). Choose `Slice<T>` for infinite-scroll / "load more" patterns where you only need to know whether more data exists, avoiding the cost of an extra `COUNT(*)` query on a potentially large table.

`Sort` can also be combined with multiple properties and directions:

```java
Sort sort = Sort.by(Sort.Order.desc("orderDate"), Sort.Order.asc("orderNumber"));
```

---

## 9. Optional&lt;T&gt; Return Types

Modern Spring Data repository methods that return at most one result should return `Optional<T>` rather than a raw, possibly-null `T`. This makes "might not exist" an explicit, compiler-checked part of the method's contract instead of an implicit null-pointer risk.

```java
public interface CustomerRepository extends JpaRepository<Customer, Long> {

    Optional<Customer> findByEmail(String email);

    // JpaRepository's own findById already returns Optional<T>
    // Optional<Customer> findById(Long id);  — inherited, not redeclared
}
```

```java
Customer customer = customerRepository.findByEmail(email)
        .orElseThrow(() -> new CustomerNotFoundException(email));

// or, transforming safely without ever risking a NullPointerException:
String displayName = customerRepository.findByEmail(email)
        .map(Customer::getFullName)
        .orElse("Unknown Customer");
```

`JpaRepository`'s own `findById(ID id)` already returns `Optional<T>` — you never need to redeclare it. This is a deliberate, well-known API design distinguishing Spring Data JPA's `findById` from the historical, null-returning DAO-style `findById` many learners expect from other frameworks.

A common mistake: calling `.get()` on the `Optional` unconditionally, which just moves the null-handling problem from a `NullPointerException` to a `NoSuchElementException` without adding any real safety. Always use `.orElseThrow(...)`, `.orElse(...)`, `.orElseGet(...)`, or `.map(...)` to handle the empty case explicitly and meaningfully (e.g., a domain-specific exception that a `@ControllerAdvice` can translate into a proper 404 response).

---

## 10. Worked Example — A Full OrderRepository

Combining derived queries, JPQL, native SQL, `@Modifying`, paging, and `Optional` in one realistic repository:

```java
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    // --- Derived query methods ---

    Optional<Order> findByOrderNumber(String orderNumber);

    List<Order> findByStatus(OrderStatus status);

    List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);

    boolean existsByOrderNumber(String orderNumber);

    long countByStatus(OrderStatus status);

    // --- Paged / sorted queries ---

    Page<Order> findByCustomerId(Long customerId, Pageable pageable);

    // --- JPQL with JOIN FETCH to avoid N+1 (see lesson 3) ---

    @Query("SELECT DISTINCT o FROM Order o JOIN FETCH o.items WHERE o.status = :status")
    List<Order> findByStatusWithItems(@Param("status") OrderStatus status);

    // --- JPQL aggregate with DTO projection ---

    @Query("""
        SELECT o.status AS status, COUNT(o) AS orderCount, SUM(o.totalAmount) AS totalRevenue
        FROM Order o
        WHERE o.orderDate BETWEEN :start AND :end
        GROUP BY o.status
        """)
    List<OrderStatusSummary> summarizeByStatus(@Param("start") LocalDateTime start,
                                                @Param("end") LocalDateTime end);

    // --- Native SQL for a database-specific need ---

    @Query(value = """
        SELECT * FROM orders
        WHERE total_amount > :threshold
        ORDER BY total_amount DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Order> findTopOrdersByAmountNative(@Param("threshold") BigDecimal threshold,
                                             @Param("limit") int limit);

    // --- Bulk modifying query ---

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Order o SET o.status = :newStatus WHERE o.orderDate < :cutoff AND o.status = :oldStatus")
    int expireStaleOrders(@Param("cutoff") LocalDateTime cutoff,
                          @Param("oldStatus") OrderStatus oldStatus,
                          @Param("newStatus") OrderStatus newStatus);
}
```

A projection interface used by `summarizeByStatus` — Spring Data supports **interface-based projections**, which it populates automatically by matching getter names to result column aliases:

```java
public interface OrderStatusSummary {
    OrderStatus getStatus();
    long getOrderCount();
    BigDecimal getTotalRevenue();
}
```

---

## 11. Common Pitfalls

**Calling an `@Modifying` query outside a transaction.** Spring Data repository methods generated from derived-query or `@Query` `SELECT`s are read-only, but `@Modifying` methods require an active write transaction. Calling one directly from a controller, or from a service method not annotated `@Transactional`, throws `InvalidDataAccessApiUsageException`. Fix: wrap the call in a `@Transactional` service method (repository proxies alone are transactional for their own generated CRUD methods, but a custom `@Modifying @Query` still needs a transaction context established by the caller in many configurations — always be explicit with `@Transactional` at the service layer).

**Forgetting that `@Modifying` bulk operations bypass the persistence context.** After a bulk `UPDATE`/`DELETE`, entities already loaded into the current persistence context are not automatically refreshed or evicted — reading them again (without `clearAutomatically = true` or a fresh transaction) returns stale in-memory state, not what's now in the database. Fix: use `clearAutomatically = true` on the `@Modifying` annotation, or ensure the bulk operation and any subsequent reads happen in separate transactions.

**Overly long derived method names that become unreadable and error-prone.** A name like `findByStatusAndCustomer_EmailAndOrderDateBetweenAndTotalAmountGreaterThanOrderByOrderDateDesc` compiles and works, but is nearly impossible to review for correctness and painful to refactor. Fix: once a derived query exceeds two or three conditions, switch to an explicit `@Query` with named parameters — it is more maintainable even though it's a few more characters to write initially.

**Returning `List<Object[]>` from a native aggregate query and manually indexing into the array.** This works but is fragile — a change in column order silently breaks the code with no compiler warning, and the array indices convey no meaning at the call site. Fix: define an interface projection (or a DTO with a constructor expression, for JPQL) so field access is named and type-checked.

**Using `Page<T>` when `Slice<T>` would do, on a very large table.** `Page<T>` always issues an additional `COUNT(*)` query to compute `getTotalElements()`/`getTotalPages()`, which can be expensive on large or heavily filtered tables even when the UI never displays a total page count. Fix: use `Slice<T>` for infinite-scroll or "load more" UI patterns that only need `hasNext()`.

**Treating `Optional<T>` as equivalent to a null-check you can skip.** Some developers call `.get()` unconditionally on an `Optional`, which merely swaps a `NullPointerException` for a `NoSuchElementException` — no safety is gained. Fix: always resolve the `Optional` explicitly via `.orElseThrow(...)` with a meaningful domain exception, `.orElse(...)`, or `.map(...)`.

---

## 12. Best Practices

- Extend `JpaRepository<T, ID>` directly for application repositories — it's a strict superset of `CrudRepository`/`PagingAndSortingRepository` and there's rarely a reason to use the narrower interfaces in a Spring Boot + JPA app.
- Prefer derived query method names for simple, 1-3 condition lookups; switch to `@Query` with named parameters once the method name becomes hard to read at a glance.
- Prefer JPQL over native SQL by default; use native SQL only for database-specific features JPQL cannot express, and provide an explicit `countQuery` when pairing native SQL with `Pageable`.
- Always annotate bulk `UPDATE`/`DELETE` `@Query` methods with `@Modifying`, and strongly consider `clearAutomatically = true` to avoid stale entities lingering in the persistence context afterward.
- Return `Optional<T>` for single-result lookups that may legitimately not find a match, and resolve every `Optional` explicitly with `.orElseThrow(...)`, never with an unconditional `.get()`.
- Use `Page<T>` only when the UI genuinely needs total counts/page numbers; use `Slice<T>` for "load more"/infinite-scroll to skip the extra `COUNT(*)` query.
- Use interface or DTO/constructor-expression projections for read-only aggregate or multi-entity queries instead of returning full managed entities (cheaper — no persistence-context tracking, no proxies, no risk of accidental lazy-loading exceptions).
- Keep query logic in the repository layer — don't leak JPQL/SQL string construction into services or controllers.

---

## 13. Hands-On Exercises

**Exercise 1:** Given the `Order`/`Customer`/`OrderItem` entities from lesson 1, write an `OrderRepository extends JpaRepository<Order, Long>` with three derived query methods: `findByStatus(OrderStatus status)`, `findByCustomerIdAndStatus(Long customerId, OrderStatus status)`, and `countByStatus(OrderStatus status)`. Enable SQL logging and verify the generated `WHERE` clauses match your expectations for each.

**Exercise 2:** Write a `@Query` JPQL method that returns an `OrderSummary` DTO (via constructor expression) containing `orderNumber`, `status`, and the sum of `quantity * unitPrice` across all of an order's items, grouped by order. Confirm it returns plain DTOs, not managed `Order` entities (attempting to call a lazy getter on the returned DTO should not be possible — it has no such method).

**Exercise 3:** Add a `@Modifying @Query` method `expireStaleOrders` that bulk-updates all `PENDING` orders older than a given cutoff to `EXPIRED`. Call it once with `clearAutomatically = true` and once without. In both cases, load one of the affected orders into the persistence context *before* calling the bulk update, then read it again afterward in the same transaction — observe the stale-data difference between the two configurations.

**Exercise 4:** Implement paginated retrieval of a customer's orders using both `Page<Order>` and `Slice<Order>` return types on two separate repository methods. Add SQL logging and compare the generated SQL — confirm that only the `Page<Order>` version issues an extra `COUNT(*)` query.

**Exercise 5:** Write a native SQL query that computes revenue per day using a database-specific date-truncation function (e.g., `DATE_TRUNC('day', order_date)` on PostgreSQL, or `DATE(order_date)` on MySQL), returning results via an interface projection with `getDay()` and `getTotalRevenue()`. Explain in your own words one thing this native query can do that a JPQL equivalent could not.

---

## 14. Interview Q&A

**Q: What is the Spring Data repository hierarchy, and which interface should you extend in a typical Spring Boot + JPA application?**
Answer: The hierarchy is `Repository` (marker) → `CrudRepository` (basic CRUD) → `PagingAndSortingRepository` (adds `findAll(Pageable)`/`findAll(Sort)`) → `JpaRepository` (adds JPA-specific batch operations and returns `List<T>` instead of `Iterable<T>`). In practice, virtually every application repository should extend `JpaRepository<T, ID>` directly, since it's a strict superset of the other two and its `List`-returning methods are more convenient — there's rarely a reason to use the narrower interfaces unless you're writing store-agnostic library code targeting multiple Spring Data modules.

**Q: How does Spring Data translate a method name like `findByStatusAndOrderDateBetween` into a query, and when should you stop using this approach?**
Answer: Spring Data parses the method name against a defined grammar at startup — prefixes like `findBy`/`countBy`/`existsBy`, property names matching entity fields, and keywords like `And`, `Or`, `Between`, `GreaterThan`, `OrderBy` — and generates the equivalent JPQL automatically, with zero runtime reflection cost after startup since the query is built once and cached. You should stop relying on derived names once they exceed roughly two or three conditions, since long derived names become hard to read, hard to review for correctness, and fragile under refactoring (a typo in a property name inside the method name fails at startup with a mapping exception, not at compile time) — at that point, an explicit `@Query` with named parameters is more maintainable.

**Q: What does `@Modifying` do, and what is the most important caveat when using it for bulk updates or deletes?**
Answer: `@Modifying` marks a `@Query` method as an `UPDATE` or `DELETE` rather than a `SELECT`, which is required for Spring Data to execute it correctly (attempting to run a modifying query without it throws an exception). The critical caveat is that bulk `UPDATE`/`DELETE` queries execute directly against the database, completely bypassing the persistence context — any entity instances already loaded and managed in the current session are not automatically refreshed to reflect the change, so subsequent reads of those same instances can return stale data unless you use `clearAutomatically = true` to detach them or ensure the bulk operation and later reads happen in separate transactions.

**Q: Why should repository methods that may return zero results use `Optional<T>` instead of returning a nullable `T`?**
Answer: `Optional<T>` makes the possibility of "no result found" an explicit, compiler-visible part of the method's contract, forcing callers to handle the empty case deliberately via `.orElseThrow(...)`, `.orElse(...)`, or `.map(...)` rather than risking an unchecked `NullPointerException` deep in unrelated code. It's a documentation benefit as much as a safety one — `Optional<Customer> findByEmail(String email)` immediately signals to any caller that not finding a match is an expected, normal outcome, whereas a bare `Customer findByEmail(...)` gives no such signal.

**Q: What is the difference between `Page<T>` and `Slice<T>`, and when would you choose one over the other?**
Answer: `Page<T>` provides full pagination metadata — total element count and total page count — which requires Spring Data to run an additional `COUNT(*)` query alongside the main query. `Slice<T>` only knows whether a next page exists (`hasNext()`), avoiding that extra count query entirely. Choose `Page<T>` when the UI needs classic "page 3 of 12" navigation controls that require knowing the total; choose `Slice<T>` for infinite-scroll or "load more" interaction patterns, especially over large or heavily filtered tables where the count query would be expensive and the total is never actually displayed.

**Q: When would you choose a native SQL query over JPQL in a Spring Data repository, and what extra step is needed to paginate a native query?**
Answer: Choose native SQL when you need a database-specific feature JPQL cannot express — window functions, common table expressions, database-specific date/string functions, or query hints — accepting the trade-off that the query is now tied to a specific database dialect and works against table/column names rather than entity/field names. To paginate a native query with `Pageable`, you typically must supply an explicit `countQuery` alongside the native `@Query`, since Spring Data cannot always reliably derive a count query automatically from arbitrary native SQL the way it can from JPQL.
