# Phase 4: Data Access (Spring Data JPA)

## What You'll Learn
Spring Data JPA is how Spring Boot applications talk to relational databases without hand-writing boilerplate JDBC code. This phase covers how to model your domain as JPA entities, how relationships between entities are mapped and fetched, how Spring Data repositories eliminate CRUD boilerplate through derived queries and JPQL, and — critically — how transactions, the persistence context, and lazy loading interact to produce two of the most common production bugs in Spring applications: `LazyInitializationException` and the N+1 select problem. This is consistently the hardest topic for Spring learners because the abstractions (entity, persistence context, proxy, transaction boundary) all interact in ways that are invisible until something breaks.

## Learning Objectives
- Map Java classes to database tables using `@Entity`, `@Id`, `@GeneratedValue`, `@Column`, and `@Table`
- Model value objects with `@Embeddable`/`@Embedded` instead of always reaching for a separate entity
- Understand and correctly configure `@OneToMany`, `@ManyToOne`, `@ManyToMany`, and `@OneToOne` relationships
- Choose the right fetch type (`LAZY` vs `EAGER`) and cascade type for each relationship
- Distinguish bidirectional from unidirectional relationships and use `mappedBy` correctly
- Avoid the classic `equals()`/`hashCode()` traps that corrupt Sets of entities
- Use the Spring Data repository hierarchy (`CrudRepository`, `PagingAndSortingRepository`, `JpaRepository`) instead of writing DAOs by hand
- Write derived query methods from method names and fall back to `@Query` (JPQL/native SQL) when naming gets unwieldy
- Use `Pageable`, `Sort`, and `Optional<T>` correctly in repository signatures
- Understand why repository methods are transactional by default and what the persistence context (first-level cache) actually does
- Diagnose and fix `LazyInitializationException`
- Recognize, reproduce, and fix the N+1 select problem using `JOIN FETCH`, `@EntityGraph`, and batch fetching

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-JPA-Entities-and-Mapping.md](01-JPA-Entities-and-Mapping.md) | JPA Entities and Mapping — Entities, Relationships, Fetch/Cascade | 2 days |
| [02-Spring-Data-Repositories.md](02-Spring-Data-Repositories.md) | Spring Data Repositories — CrudRepository to JpaRepository, Derived Queries, JPQL | 1 day |
| [03-Transactions-and-N-Plus-One.md](03-Transactions-and-N-Plus-One.md) | Transactions and the N+1 Problem — Persistence Context, Lazy Loading, Fixes | 1 day |

## Estimated Time
4 days

## Previous Phase
→ [Phase 3: REST APIs (Spring Web)](../Phase-03-REST-APIs-Spring-Web/README.md)

## Next Phase
→ [Phase 5: Service and Transactions](../Phase-05-Service-and-Transactions/README.md)
