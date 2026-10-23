# Pagination, Sorting and Projections — Complete Guide

## Table of Contents
1. [Why Pagination Matters](#1-why-pagination-matters)
2. [Pageable, PageRequest, and Sort](#2-pageable-pagerequest-and-sort)
3. [Page<T> vs Slice<T>](#3-paget-vs-slicet)
4. [Exposing Pagination Through REST APIs](#4-exposing-pagination-through-rest-apis)
5. [Structuring the JSON Response — PagedModel and Custom DTOs](#5-structuring-the-json-response--pagedmodel-and-custom-dtos)
6. [Projections — Why They Matter](#6-projections--why-they-matter)
7. [Interface-Based Projections](#7-interface-based-projections)
8. [Class-Based (DTO) Projections](#8-class-based-dto-projections)
9. [Worked Example — Paginated, Sorted, Projected Product API](#9-worked-example--paginated-sorted-projected-product-api)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Pagination Matters

Returning `List<Product> findAll()` against a table with a million rows is a production incident waiting to happen — it loads every row into memory, serializes all of it to JSON, and sends a multi-megabyte response over the wire for a client that likely only wants to render 20 rows on a screen. Pagination bounds the amount of work the database, the application, and the network do per request, and sorting lets the client control the order of the bounded result set without fetching everything and sorting client-side.

```
  Without pagination                    With pagination
  ┌──────────────────────┐              ┌──────────────────────┐
  │ SELECT * FROM product │              │ SELECT * FROM product │
  │ (1,000,000 rows)      │              │ ORDER BY price        │
  │        │              │              │ LIMIT 20 OFFSET 40    │
  │        ▼              │              │        │              │
  │  Full table in memory │              │        ▼              │
  │  Huge JSON response   │              │  20 rows, small JSON  │
  └──────────────────────┘              └──────────────────────┘
```

Spring Data JPA builds pagination and sorting into the repository abstraction itself — every `JpaRepository<T, ID>` method that returns a collection has a `Pageable`-accepting overload for free.

---

## 2. Pageable, PageRequest, and Sort

`Pageable` is the interface describing "which page, how big, and in what order." `PageRequest` is its standard implementation.

```java
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

// Page 0 (first page), 20 items per page, no sort
Pageable firstPage = PageRequest.of(0, 20);

// Page 2 (third page, 0-indexed), 10 items per page, sorted by price ascending
Pageable sortedPage = PageRequest.of(2, 10, Sort.by("price").ascending());

// Multi-property sort: category ascending, then price descending
Pageable multiSort = PageRequest.of(0, 20,
        Sort.by(Sort.Order.asc("category"), Sort.Order.desc("price")));
```

Passing a `Pageable` (or `Sort`) into any repository method triggers Spring Data to append `ORDER BY` and `LIMIT`/`OFFSET` (or the equivalent for the configured dialect) automatically:

```java
public interface ProductRepository extends JpaRepository<Product, Long> {
    Page<Product> findByCategory(String category, Pageable pageable);
    List<Product> findByInStockTrue(Sort sort);
}
```

`Pageable.unpaged()` explicitly opts out of pagination and returns everything — useful for small reference tables, but it should never be the default for anything backed by user-facing growth.

---

## 3. Page<T> vs Slice<T>

Both `Page<T>` and `Slice<T>` extend the base `Slice<T>`-like windowing contract, but they differ in one crucial way: whether a `COUNT` query is executed.

| Feature | `Page<T>` | `Slice<T>` |
|---------|-----------|------------|
| Extra `COUNT(*)` query | Yes — always runs one | No |
| `getTotalElements()` / `getTotalPages()` | Available | Not available (throws/unsupported) |
| `hasNext()` | Available (derived from total count) | Available (checked by fetching one extra row) |
| Cost | Higher — two queries per page | Lower — one query per page |
| Best for | "Page 1 of 47", jump-to-page UIs | Infinite scroll, "load more" UIs |

```java
public interface ProductRepository extends JpaRepository<Product, Long> {
    Page<Product> findByCategory(String category, Pageable pageable);   // runs COUNT too
    Slice<Product> findSliceByCategory(String category, Pageable pageable); // no COUNT
}
```

Under the hood, `Slice` implementations typically request `pageSize + 1` rows and use the presence of that extra row to compute `hasNext()`, avoiding the separate count query entirely. On a large, frequently-scanned table, skipping the `COUNT(*)` can be a meaningful performance win — a `COUNT(*)` over a huge filtered table is not free just because the page itself is small.

---

## 4. Exposing Pagination Through REST APIs

Spring MVC can resolve `Pageable` directly from query parameters when the controller method parameter is typed `Pageable` and `@EnableSpringDataWebSupport` is active (auto-configured in Spring Boot):

```java
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping
    public Page<Product> list(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return productRepository.findAll(pageable);
    }
}
```

A request like:

```
GET /api/products?page=1&size=10&sort=price,desc&sort=name,asc
```

is parsed automatically into `PageRequest.of(1, 10, Sort.by(desc("price"), asc("name")))`. `@PageableDefault` supplies fallback values when the client omits `page`/`size`/`sort` entirely. It is common to also cap `size` server-side (e.g., via a custom `PageableHandlerMethodArgumentResolverCustomizer` bean) so a client cannot request `size=1000000` and defeat the purpose of pagination.

```java
@Bean
public PageableHandlerMethodArgumentResolverCustomizer pageableCustomizer() {
    return resolver -> resolver.setMaxPageSize(100);
}
```

---

## 5. Structuring the JSON Response — PagedModel and Custom DTOs

Returning `Page<Product>` directly serializes reasonably well with Jackson, but Spring Data's own `Page` JSON shape has changed between versions and leaks pageable/sort internals that many teams don't want to expose in a stable public API contract. Two common approaches:

### Option A — Spring Data's `PagedModel`

`PagedModel<T>` (from `org.springframework.data.web`) provides a stable, HATEOAS-style structure independent of the internal `Page` implementation:

```java
import org.springframework.data.web.PagedModel;

@GetMapping
public PagedModel<Product> list(@PageableDefault(size = 20) Pageable pageable) {
    Page<Product> page = productRepository.findAll(pageable);
    return new PagedModel<>(page);
}
```

This serializes to a `content` array plus a `page` metadata object (`size`, `totalElements`, `totalPages`, `number`).

### Option B — A Custom, Explicit Response DTO

For full control over the wire format (recommended for public APIs that must stay stable regardless of Spring Data version upgrades):

```java
public record PagedResponse<T>(
        List<T> content,
        int pageNumber,
        int pageSize,
        long totalElements,
        int totalPages,
        boolean last
) {
    public static <T> PagedResponse<T> from(Page<T> page) {
        return new PagedResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isLast()
        );
    }
}
```

```java
@GetMapping
public PagedResponse<ProductSummary> list(@PageableDefault(size = 20) Pageable pageable) {
    Page<ProductSummary> page = productRepository.findAllProjectedBy(pageable);
    return PagedResponse.from(page);
}
```

A custom DTO decouples the public contract from Spring Data internals — a library upgrade that changes `Page`'s serialized shape will not silently break API consumers.

---

## 6. Projections — Why They Matter

By default, `findAll()` and derived query methods return full entities — every mapped column, every eagerly-fetched association. If a screen only needs `id`, `name`, and `price` out of a `Product` entity with fifteen columns and two relationships, fetching the whole entity wastes bandwidth, memory, and — for lazily-fetched associations accessed later (e.g., inside a serializer) — risks `LazyInitializationException` or accidental N+1 queries.

**Projections** let a repository return only a subset of an entity's data, computed directly by the SQL `SELECT` clause rather than by fetching the full entity and discarding fields in Java.

```
  Without projection                      With projection
  ┌───────────────────────────┐          ┌───────────────────────────┐
  │ SELECT * FROM products     │          │ SELECT id, name, price     │
  │ (all 15 columns)           │          │ FROM products              │
  │        │                   │          │        │                   │
  │        ▼                   │          │        ▼                   │
  │ Full Product entity built  │          │ Lightweight projection     │
  │ in memory, 12 fields       │          │ built directly — no        │
  │ discarded before response  │          │ wasted column fetch         │
  └───────────────────────────┘          └───────────────────────────┘
```

Spring Data supports two projection styles: **interface-based** (simplest, works well for flat field subsets) and **class-based/DTO** (more flexible, supports constructor logic and works cleanly with JPQL constructor expressions).

---

## 7. Interface-Based Projections

Define an interface with getter methods matching the property names you want to expose; Spring Data generates a proxy at runtime that reads only the requested columns.

```java
public interface ProductSummary {
    Long getId();
    String getName();
    BigDecimal getPrice();
}
```

```java
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<ProductSummary> findByCategory(String category);
    Page<ProductSummary> findAllProjectedBy(Pageable pageable);
}
```

Spring Data inspects the interface's getters and generates a query that selects exactly those columns — Hibernate does not hydrate a full `Product` entity at all. This is called a **closed projection** (every accessor maps directly to an entity property).

**Open projections** use `@Value` with a SpEL expression to combine properties, at the cost of falling back to fetching the full entity first (defeating the fetch optimization):

```java
public interface ProductDisplayName {
    @Value("#{target.name + ' (' + target.category + ')'}")
    String getDisplayName();
}
```

Prefer closed projections whenever possible — they are the only style that gets the actual SQL-level column-selection benefit.

---

## 8. Class-Based (DTO) Projections

A class (often a Java `record`) with a constructor matching a JPQL constructor expression gives full control, including computed fields and type conversions, at the cost of writing the query explicitly.

```java
public record ProductCardDto(Long id, String name, BigDecimal price, String category) {
}
```

```java
public interface ProductRepository extends JpaRepository<Product, Long> {

    @Query("""
           SELECT new com.example.shop.dto.ProductCardDto(p.id, p.name, p.price, p.category)
           FROM Product p
           WHERE p.category = :category
           """)
    Page<ProductCardDto> findCardsByCategory(@Param("category") String category, Pageable pageable);
}
```

Spring Data JPA also supports **dynamic projections** — a repository method generic over the return type lets the caller choose the projection at call time:

```java
public interface ProductRepository extends JpaRepository<Product, Long> {
    <T> Page<T> findByCategory(String category, Pageable pageable, Class<T> type);
}
```

```java
Page<ProductSummary> summaries =
        productRepository.findByCategory("ELECTRONICS", pageable, ProductSummary.class);

Page<Product> fullEntities =
        productRepository.findByCategory("ELECTRONICS", pageable, Product.class);
```

---

## 9. Worked Example — Paginated, Sorted, Projected Product API

### Projection Interface

```java
public interface ProductSummary {
    Long getId();
    String getName();
    String getCategory();
    BigDecimal getPrice();
}
```

### Repository

```java
public interface ProductRepository extends JpaRepository<Product, Long> {
    Page<ProductSummary> findByCategory(String category, Pageable pageable);
    Page<ProductSummary> findByPriceBetween(BigDecimal min, BigDecimal max, Pageable pageable);
    Page<ProductSummary> findAllProjectedBy(Pageable pageable);
}
```

### REST Controller

```java
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping
    public PagedResponse<ProductSummary> list(
            @RequestParam(required = false) String category,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {

        Page<ProductSummary> page = (category != null)
                ? productRepository.findByCategory(category, pageable)
                : productRepository.findAllProjectedBy(pageable);

        return PagedResponse.from(page);
    }
}
```

### Example Request/Response

```
GET /api/products?category=ELECTRONICS&page=0&size=2&sort=price,asc
```

```json
{
  "content": [
    { "id": 12, "name": "USB-C Hub", "category": "ELECTRONICS", "price": 19.99 },
    { "id": 8,  "name": "Wireless Mouse", "category": "ELECTRONICS", "price": 24.99 }
  ],
  "pageNumber": 0,
  "pageSize": 2,
  "totalElements": 47,
  "totalPages": 24,
  "last": false
}
```

Only four columns per row are ever selected from the database, sorting and pagination happen at the SQL level, and the response contract is a stable, explicit DTO independent of Spring Data's internal `Page` serialization.

---

## 10. Common Pitfalls

- **Using `Page<T>` when `Slice<T>` would suffice** — paying for a `COUNT(*)` query on every "load more" request when the UI never displays a total is wasted database work.
- **Unbounded page size from the client** — without a server-side max (`setMaxPageSize`), a client can request `size=1000000` and negate all benefits of pagination.
- **Serializing Spring Data's `Page` directly in a public API** — its JSON shape has changed across Spring Data versions; an unrelated dependency bump can silently change a client-facing contract.
- **Open (`@Value`/SpEL) projections mistaken for column-level optimization** — they still fetch the full entity first, so they save bandwidth on the response but not database load.
- **Sorting by a property that does not exist on the entity** — throws `PropertyReferenceException` at request time; always validate or whitelist sortable fields when they come from client input.
- **N+1 queries hiding behind a "projection"** — a DTO/interface projection that includes a nested association's field (e.g., `getSupplierName()`) can still trigger a join or a lazy load per row if not written as a proper JPQL constructor expression with an explicit join.

---

## 11. Best Practices

- Default to `Slice<T>` for infinite-scroll/"load more" UIs and reserve `Page<T>` for UIs that genuinely need `totalPages`/"jump to page N" (e.g., admin tables).
- Always set a server-side maximum page size; never trust a client-supplied `size` unconditionally.
- Prefer interface-based **closed** projections for simple flat field subsets — they get genuine SQL-level column selection with minimal code.
- Use class-based (record) projections with explicit JPQL constructor expressions when the result needs to combine data from a join or perform any computation the interface style cannot express.
- Wrap `Page<T>`/`Slice<T>` in an explicit response DTO for any API contract clients depend on, rather than serializing Spring Data types directly.
- Whitelist sortable/filterable fields explicitly rather than passing client-supplied sort property names straight into `Sort.by(...)` unchecked.
- Always specify a default sort (`@PageableDefault(sort = "...")`) — an unsorted `LIMIT`/`OFFSET` query has no guaranteed row order across pages on most databases.

---

## 12. Hands-On Exercises

**Exercise 1:** Add a `Slice<Product> findByInStockTrue(Pageable pageable)` method next to an equivalent `Page<Product>` version. Enable `spring.jpa.show-sql=true` and confirm in the logs that the `Slice` variant issues one fewer SQL statement per request (no `COUNT` query).

**Exercise 2:** Build a `PageableHandlerMethodArgumentResolverCustomizer` bean capping the maximum page size at 50. Confirm via an integration test that requesting `?size=500` is clamped to 50 items rather than returning 500.

**Exercise 3:** Create both an interface-based projection (`ProductSummary`) and a record-based DTO projection (`ProductCardDto`) for the same `Product` entity. Enable SQL logging and confirm both generate a `SELECT` with only the projected columns (not `SELECT *`).

**Exercise 4:** Implement the dynamic projection method `<T> Page<T> findByCategory(String category, Pageable pageable, Class<T> type)` on `ProductRepository`. Call it once with `ProductSummary.class` and once with `Product.class` from the same controller action based on a `?fields=summary|full` query parameter, and verify both work correctly.

**Exercise 5:** Wrap the paginated response in the `PagedResponse<T>` DTO shown in this lesson. Write a test asserting the JSON body contains exactly the fields `content`, `pageNumber`, `pageSize`, `totalElements`, `totalPages`, and `last` — and does not leak Spring Data's internal `pageable`/`sort` object structure.

---

## 13. Interview Q&A

**Q: What is the practical difference between `Page<T>` and `Slice<T>`, and when would you choose one over the other?**
Answer: `Page<T>` executes an additional `COUNT(*)` query so it can report `getTotalElements()` and `getTotalPages()`, while `Slice<T>` avoids that count entirely and instead determines `hasNext()` by fetching one extra row beyond the requested page size. `Page` is appropriate when the UI needs a total count or "jump to page N" navigation (e.g., an admin table with page numbers). `Slice` is the better default for infinite-scroll or "load more" interfaces where only "is there more data" matters, since it saves a potentially expensive count query on large, heavily filtered tables.

**Q: How does Spring MVC resolve a `Pageable` parameter from an incoming request, and how do you cap the page size a client can request?**
Answer: With Spring Data's web support enabled (auto-configured in Spring Boot), a controller method parameter typed `Pageable` is populated automatically from `page`, `size`, and `sort` query parameters, with `@PageableDefault` supplying fallback values when they are omitted. To prevent a client from requesting an excessively large page (e.g., `size=1000000`), register a `PageableHandlerMethodArgumentResolverCustomizer` bean and call `resolver.setMaxPageSize(...)` — any request exceeding that maximum is silently clamped.

**Q: What is the difference between an interface-based projection and a class-based (DTO) projection in Spring Data JPA?**
Answer: An interface-based projection defines getter methods matching the desired property subset; Spring Data generates a proxy at runtime and — for a "closed" projection where every getter maps directly to an entity property — issues a SQL query selecting only those columns. A class-based (DTO) projection is typically a Java class or record populated via an explicit JPQL constructor expression (`SELECT new com.example.Dto(p.id, p.name)`), giving full control over combining fields, applying joins, or performing simple transformations, at the cost of writing the query by hand rather than relying on Spring Data's method-name derivation.

**Q: What is the difference between an "open" and a "closed" interface projection, and why does it matter for performance?**
Answer: A closed projection's getters map one-to-one to entity properties with no additional logic, which lets Spring Data generate a SQL query that selects only those specific columns — the true performance win. An open projection uses `@Value` with a SpEL expression (e.g., combining two fields into a display string), which requires Hibernate to first fetch the full entity so the SpEL expression has something to evaluate against; it saves bandwidth on the JSON response but not database load, since the full row is still read.

**Q: Why is it risky to return Spring Data's `Page<T>` directly as a REST response body for a public API?**
Answer: `Page<T>`'s JSON serialization shape is controlled by Spring Data's internal implementation and has changed in past versions (for example, the introduction of `PagedModel` as a more stable alternative), so a routine dependency upgrade can silently alter a client-facing contract without any application code changes. Wrapping the page in an explicit, application-owned DTO (with fields like `content`, `pageNumber`, `totalElements`) decouples the public API contract from the library's internal representation and keeps the response shape stable regardless of framework version changes.

**Q: When would you deliberately avoid pagination and use `Pageable.unpaged()`?**
Answer: `Pageable.unpaged()` is reasonable for small, bounded reference data — lookup/enum-like tables such as a list of countries or product categories — where the total row count is small and fixed regardless of application growth, so fetching everything at once is cheap and simpler than paginating. It should not be used as a default or fallback for any endpoint backed by a table whose size grows with user activity, since that turns an initially small unpaginated response into an unbounded one over time.
