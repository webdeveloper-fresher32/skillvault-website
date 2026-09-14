# Specifications and Dynamic Queries — Complete Guide

## Table of Contents
1. [Why Dynamic Queries Are Hard](#1-why-dynamic-queries-are-hard)
2. [The JPA Criteria API — Building Blocks](#2-the-jpa-criteria-api--building-blocks)
3. [Spring Data's Specification Interface](#3-spring-datas-specification-interface)
4. [JpaSpecificationExecutor](#4-jpaspecificationexecutor)
5. [Composing Specifications — and() / or() / not()](#5-composing-specifications--and--or--not)
6. [Worked Example — Dynamic Product Search](#6-worked-example--dynamic-product-search)
7. [Specifications with Joins](#7-specifications-with-joins)
8. [Specifications vs Querydsl vs JPQL @Query](#8-specifications-vs-querydsl-vs-jpql-query)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Dynamic Queries Are Hard

Most Spring Data JPA tutorials teach derived query methods like `findByNameAndCategory(String name, String category)`. That works fine until a search form has five optional filters and the client only fills in two of them. You cannot write one derived method per combination — five optional filters produce 2^5 = 32 possible combinations.

The naive fix is string-concatenated JPQL with manual null checks:

```java
// Don't do this — fragile, hard to test, SQL-injection-prone if not parameterized carefully
String jpql = "SELECT p FROM Product p WHERE 1=1";
if (name != null)     jpql += " AND p.name LIKE :name";
if (category != null) jpql += " AND p.category = :category";
if (minPrice != null) jpql += " AND p.price >= :minPrice";
// ...binding parameters conditionally becomes its own mess
```

This works but does not compose, is not type-safe (typos in field names surface at runtime), and turns into an unmaintainable pile as filters grow. Spring Data JPA solves this with the **Specification** pattern, which wraps the type-safe JPA Criteria API behind a small, composable functional interface.

```
  Problem: N optional filters → 2^N possible query shapes
  ┌──────────────────────────────────────────────────────────┐
  │  name?  category?  minPrice?  maxPrice?  inStock?         │
  │    │        │           │          │         │            │
  │    └────────┴───────────┴──────────┴─────────┘            │
  │                        │                                   │
  │              Specification<Product>                        │
  │        (each filter = one small, testable, reusable         │
  │         Specification, combined with .and())               │
  └──────────────────────────────────────────────────────────┘
```

---

## 2. The JPA Criteria API — Building Blocks

Specifications are a thin wrapper over the standard `jakarta.persistence.criteria` API. Understanding the three core types makes Specifications far less mysterious.

| Type | Role |
|------|------|
| `CriteriaBuilder` | Factory for predicates (`equal`, `like`, `greaterThan`, `and`, `or`, ...) and expressions |
| `CriteriaQuery<T>` | Represents the query being built — `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY` |
| `Root<T>` | Represents the entity being queried (the `FROM` clause) — used to reference columns |

A raw Criteria API query, without Spring Data, looks like this:

```java
public List<Product> findExpensiveElectronics(BigDecimal minPrice) {
    CriteriaBuilder cb = entityManager.getCriteriaBuilder();
    CriteriaQuery<Product> query = cb.createQuery(Product.class);
    Root<Product> product = query.from(Product.class);

    Predicate categoryPredicate = cb.equal(product.get("category"), "ELECTRONICS");
    Predicate pricePredicate = cb.greaterThanOrEqualTo(product.get("price"), minPrice);

    query.select(product).where(cb.and(categoryPredicate, pricePredicate));

    return entityManager.createQuery(query).getResultList();
}
```

This is verbose, and every filter combination needs its own method. Spring Data's `Specification<T>` interface exists to eliminate exactly this boilerplate while keeping the same underlying type-safe API.

---

## 3. Spring Data's Specification Interface

`Specification<T>` is a functional interface with a single method:

```java
package org.springframework.data.jpa.domain;

public interface Specification<T> {
    Predicate toPredicate(Root<T> root, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder);
}
```

Because it is a functional interface, each filter can be written as a lambda or a static factory method that returns one. The key insight: a `Specification` that filters on nothing (returns `null` from `toPredicate`, or is simply not added to the chain) contributes no restriction — this is how "optional" filters are modeled cleanly.

```java
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.*;

public class ProductSpecifications {

    public static Specification<Product> hasName(String name) {
        return (root, query, cb) ->
                name == null ? null : cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%");
    }

    public static Specification<Product> hasCategory(String category) {
        return (root, query, cb) ->
                category == null ? null : cb.equal(root.get("category"), category);
    }

    public static Specification<Product> priceGreaterThanOrEqual(BigDecimal minPrice) {
        return (root, query, cb) ->
                minPrice == null ? null : cb.greaterThanOrEqualTo(root.get("price"), minPrice);
    }

    public static Specification<Product> priceLessThanOrEqual(BigDecimal maxPrice) {
        return (root, query, cb) ->
                maxPrice == null ? null : cb.lessThanOrEqualTo(root.get("price"), maxPrice);
    }
}
```

Returning `null` from `toPredicate` is safe: Spring Data's internal `CompositePredicate` combination logic (in `Specification.and`/`.or`) filters out `null` predicates before combining, so an "empty" specification behaves as "no restriction" rather than throwing a `NullPointerException`.

---

## 4. JpaSpecificationExecutor

To actually run specifications against the database, a repository must extend `JpaSpecificationExecutor<T>` in addition to `JpaRepository<T, ID>`.

```java
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ProductRepository extends JpaRepository<Product, Long>,
                                            JpaSpecificationExecutor<Product> {
}
```

`JpaSpecificationExecutor<T>` adds a family of overloaded methods:

```java
public interface JpaSpecificationExecutor<T> {
    Optional<T> findOne(Specification<T> spec);
    List<T> findAll(Specification<T> spec);
    Page<T> findAll(Specification<T> spec, Pageable pageable);
    List<T> findAll(Specification<T> spec, Sort sort);
    long count(Specification<T> spec);
    boolean exists(Specification<T> spec);
    long delete(Specification<T> spec);
}
```

This gives every entity with a Specification-enabled repository dynamic filtering, counting, existence checks, pagination, and sorting — all without writing a single JPQL string.

---

## 5. Composing Specifications — and() / or() / not()

`Specification<T>` provides default and static composition methods so filters combine like building blocks:

```java
Specification<Product> spec = Specification
        .where(ProductSpecifications.hasCategory("ELECTRONICS"))
        .and(ProductSpecifications.priceGreaterThanOrEqual(new BigDecimal("100")))
        .and(ProductSpecifications.priceLessThanOrEqual(new BigDecimal("500")));

List<Product> results = productRepository.findAll(spec);
```

`Specification.where(spec)` is a null-safe static entry point — if `spec` itself is `null`, it still returns a usable Specification that matches everything, so the chain never breaks even when the very first filter is absent.

```
  Specification.where(hasCategory)   →  base predicate (or "match all" if null)
        .and(priceGreaterThanOrEqual) →  AND combined (or no-op if null)
        .and(priceLessThanOrEqual)    →  AND combined (or no-op if null)
                    │
                    ▼
        Single Predicate handed to JpaSpecificationExecutor
```

`or()` works identically for alternative-match logic, and `not()` negates a single Specification. Because each Specification is just an object, they can also be stored in a `List<Specification<T>>` and reduced with `stream().reduce(Specification.where(null), Specification::and)` when the number of filters is dynamic (e.g., built from a map of query parameters).

---

## 6. Worked Example — Dynamic Product Search

### Entity

```java
@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String category;
    private BigDecimal price;
    private boolean inStock;

    // getters and setters omitted for brevity
}
```

### Search Criteria DTO

A dedicated request object keeps the controller signature clean and makes the filter set self-documenting.

```java
public record ProductSearchCriteria(
        String name,
        String category,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        Boolean inStock
) {
}
```

### Specification Builder

```java
public class ProductSpecifications {

    public static Specification<Product> hasName(String name) {
        return (root, query, cb) ->
                (name == null || name.isBlank())
                        ? null
                        : cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%");
    }

    public static Specification<Product> hasCategory(String category) {
        return (root, query, cb) ->
                (category == null || category.isBlank()) ? null : cb.equal(root.get("category"), category);
    }

    public static Specification<Product> priceBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            if (min == null && max == null) return null;
            if (min != null && max != null) return cb.between(root.get("price"), min, max);
            if (min != null) return cb.greaterThanOrEqualTo(root.get("price"), min);
            return cb.lessThanOrEqualTo(root.get("price"), max);
        };
    }

    public static Specification<Product> isInStock(Boolean inStock) {
        return (root, query, cb) ->
                inStock == null ? null : cb.equal(root.get("inStock"), inStock);
    }

    public static Specification<Product> fromCriteria(ProductSearchCriteria criteria) {
        return Specification
                .where(hasName(criteria.name()))
                .and(hasCategory(criteria.category()))
                .and(priceBetween(criteria.minPrice(), criteria.maxPrice()))
                .and(isInStock(criteria.inStock()));
    }
}
```

### Service Layer

```java
@Service
public class ProductSearchService {

    private final ProductRepository productRepository;

    public ProductSearchService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<Product> search(ProductSearchCriteria criteria) {
        Specification<Product> spec = ProductSpecifications.fromCriteria(criteria);
        return productRepository.findAll(spec);
    }
}
```

### REST Controller

```java
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductSearchService productSearchService;

    public ProductController(ProductSearchService productSearchService) {
        this.productSearchService = productSearchService;
    }

    @GetMapping("/search")
    public List<Product> search(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Boolean inStock) {

        ProductSearchCriteria criteria =
                new ProductSearchCriteria(name, category, minPrice, maxPrice, inStock);
        return productSearchService.search(criteria);
    }
}
```

A request like `GET /api/products/search?category=ELECTRONICS&minPrice=100&inStock=true` builds a single composed Specification and issues one SQL query with exactly three WHERE conditions — no branching JPQL strings, no unused filter clauses.

---

## 7. Specifications with Joins

Specifications can traverse relationships using `Root.join()`, which returns a `Join` that behaves like a `Root` for the joined entity.

```java
public static Specification<Product> hasSupplierCountry(String country) {
    return (root, query, cb) -> {
        if (country == null) return null;
        Join<Product, Supplier> supplierJoin = root.join("supplier", JoinType.LEFT);
        return cb.equal(supplierJoin.get("country"), country);
    };
}
```

When combining a join-based Specification with `findAll(spec, pageable)`, call `query.distinct(true)` inside `toPredicate` if the join can produce duplicate rows (e.g., a one-to-many join), otherwise the same product may appear multiple times in a page.

```java
public static Specification<Product> hasReviewWithRating(int minRating) {
    return (root, query, cb) -> {
        query.distinct(true);
        Join<Product, Review> reviews = root.join("reviews", JoinType.LEFT);
        return cb.greaterThanOrEqualTo(reviews.get("rating"), minRating);
    };
}
```

---

## 8. Specifications vs Querydsl vs JPQL @Query

| Approach | Type Safety | Dynamic Composition | Verbosity | When to Use |
|----------|------------|---------------------|-----------|-------------|
| `@Query` (JPQL/native) | Low (strings) | Poor — needs multiple methods or SpEL hacks | Low for static queries | Fixed, well-known queries |
| Criteria API (raw) | High | Good, but very verbose | High | Rare — usually wrapped by Specification |
| `Specification<T>` | High | Excellent | Medium | Optional/combinable filters (search, admin screens) |
| Querydsl `Predicate` | Highest (generated Q-types) | Excellent | Low (with codegen) | Large codebases willing to add an annotation processor |

Specifications hit the sweet spot for most Spring Boot applications: no extra build-time code generation (unlike Querydsl's `Q`-classes), full type safety through the Criteria API underneath, and first-class Spring Data support via `JpaSpecificationExecutor`.

---

## 9. Common Pitfalls

- **Forgetting `JpaSpecificationExecutor`** — a repository that only extends `JpaRepository` has no `findAll(Specification)` overload; the compiler error is easy to misread as a Spring configuration issue.
- **String-based field names (`root.get("name")`)** — a typo is only caught at runtime (`IllegalArgumentException: Unable to locate Attribute`). Consider generating a static metamodel (`Product_.name`) via the `hibernate-jpamodelgen` annotation processor for compile-time safety on larger projects.
- **N+1 queries from joins inside loops** — a Specification that joins a collection and is reused per row (rather than composed once) can trigger repeated joins; always build one Specification and pass it once.
- **Duplicate rows from one-to-many joins without `distinct(true)`** — silently returns more rows than expected, and worse, `Page.getTotalElements()` becomes wrong because the count query duplicates rows too.
- **Mutating `CriteriaQuery` from multiple different Specifications inconsistently** — e.g., calling `query.distinct(true)` in one Specification but not being aware another already set an ORDER BY that conflicts with `distinct` and eager-fetched collections (`fetch()` with `distinct` and pagination is unreliable in JPA and should be avoided).
- **Returning `null` from `toPredicate` when the entity attribute name changed after a refactor** — silent no-op filters are hard to notice in tests that don't assert query counts.

---

## 10. Best Practices

- Keep each Specification method small, named after the business filter it represents (`hasCategory`, `priceBetween`), and unit-testable independently by asserting on the generated predicate or by running it against an in-memory/test database.
- Centralize all Specifications for an entity in one `XSpecifications` utility class (as shown above) rather than scattering lambdas through service methods.
- Always null-guard inside each Specification so it can be safely `.and()`-ed unconditionally regardless of whether the corresponding filter was supplied.
- Prefer the static metamodel (`Product_.category` from `hibernate-jpamodelgen`) over raw string attribute names once a project has more than a handful of Specifications, to get compile-time safety on refactors.
- Combine Specifications with `Pageable` (`findAll(spec, pageable)`) rather than fetching the whole list and paginating in memory.
- When a join could multiply rows, explicitly call `query.distinct(true)` and confirm the resulting count query still matches business expectations.
- Write integration tests (`@DataJpaTest`) asserting on the actual filtered result set for each meaningful combination of criteria, not just that the code compiles.

---

## 11. Hands-On Exercises

**Exercise 1:** Add an `Order` entity with fields `status`, `customerEmail`, `totalAmount`, and `createdAt`. Write Specifications `hasStatus(String)`, `hasCustomerEmail(String)`, and `totalAmountAtLeast(BigDecimal)`. Compose them with `Specification.where().and()` and confirm via a `@DataJpaTest` that supplying only two of the three filters still returns the correct subset.

**Exercise 2:** Extend the `ProductSearchCriteria` example with a `List<String> categories` field (multi-select category filter) using `CriteriaBuilder.in()` inside a new `Specification<Product> hasCategoryIn(List<String> categories)`. Verify that an empty or `null` list behaves as "no filter" rather than matching zero rows.

**Exercise 3:** Add a `supplier` many-to-one relationship to `Product`. Write a Specification that joins to `supplier` and filters by `supplier.country`. Confirm with a test that products are not duplicated when combined with a separate one-to-many `reviews` join and `distinct(true)`.

**Exercise 4:** Refactor the raw-string attribute references (`root.get("name")`) in `ProductSpecifications` to use a generated JPA static metamodel. Add the `hibernate-jpamodelgen` annotation processor to the build, regenerate `Product_.java`, and update each Specification to use `root.get(Product_.name)` instead of `root.get("name")`. Rename a field and confirm the build now fails at compile time instead of runtime.

**Exercise 5:** Add a `count(Specification)`-backed REST endpoint `/api/products/search/count` returning just the number of matches for a given `ProductSearchCriteria`, without fetching the actual rows. Compare the generated SQL (enable `spring.jpa.show-sql=true`) against the `findAll` variant and confirm the count query has no `ORDER BY`.

---

## 12. Interview Q&A

**Q: What problem does the Specification pattern solve that derived query methods (`findByXAndY`) cannot?**
Answer: Derived query methods require one method per fixed combination of filters, which does not scale when filters are optional — N optional filters imply up to 2^N possible query shapes. `Specification<T>` lets each filter be modeled as an independent, reusable predicate-producing function that can be composed at runtime with `.and()`/`.or()`, so only the filters that are actually present in a given request contribute to the final WHERE clause. This keeps the code linear in the number of filters rather than exponential.

**Q: What does a `Specification<T>` actually return, and how does Spring Data combine multiple specifications?**
Answer: `Specification<T>` is a functional interface with one method, `toPredicate(Root<T>, CriteriaQuery<?>, CriteriaBuilder)`, that returns a `jakarta.persistence.criteria.Predicate` (or `null` for "no restriction"). Spring Data's `Specification.and()`/`.or()` default methods wrap two Specifications in a composite that calls both `toPredicate` implementations and combines the results with `CriteriaBuilder.and`/`.or`, gracefully skipping any `null` predicate so an absent filter contributes nothing to the query.

**Q: What must a Spring Data repository do to support Specifications, and what methods does that add?**
Answer: The repository interface must extend `JpaSpecificationExecutor<T>` in addition to `JpaRepository<T, ID>`. This adds overloads such as `findOne(Specification)`, `findAll(Specification)`, `findAll(Specification, Pageable)`, `findAll(Specification, Sort)`, `count(Specification)`, `exists(Specification)`, and `delete(Specification)` — giving full dynamic-filtering, paging, counting, and existence-check capability without writing any JPQL.

**Q: How do you avoid duplicate rows when a Specification joins a one-to-many or many-to-many relationship?**
Answer: Call `query.distinct(true)` inside the `toPredicate` method of the Specification that performs the join. Without it, a product with three matching reviews would appear three times in the result set, and — more subtly — the count query used by `Page.getTotalElements()` would also over-count, producing an incorrect total. Note that combining `distinct` with pagination and an eager collection `fetch()` is unreliable in JPA/Hibernate and should generally be avoided; prefer a plain join for filtering and a separate query (or `@EntityGraph`) for eager loading the collection.

**Q: When would you choose Querydsl over Spring Data Specifications, or plain `@Query` over both?**
Answer: `@Query` with JPQL or native SQL is best for a small number of fixed, well-known queries where dynamic composition is not needed — it is the least code for the common case. `Specification<T>` is the right choice when a set of optional filters needs to compose at runtime (search screens, admin filters, report endpoints) without extra build tooling, since it uses the standard Criteria API under a thin, testable abstraction. Querydsl offers the same dynamic composition with better type safety (generated `Q`-classes eliminate all string-based attribute references) and often less boilerplate, but it requires an annotation-processing build step; teams already comfortable with a codegen step and needing very complex dynamic queries across many entities often prefer it over hand-written Specifications.
