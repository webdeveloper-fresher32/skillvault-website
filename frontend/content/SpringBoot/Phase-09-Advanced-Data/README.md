# Phase 9: Advanced Data

## What You'll Learn

How to move beyond simple derived queries and `findBy...` methods into production-grade data access patterns with Spring Data JPA. This phase covers building type-safe, composable dynamic queries with the Specification API, exposing efficient paginated and sorted REST endpoints backed by projections that avoid over-fetching entity data, and protecting concurrent writes with JPA auditing and optimistic locking. These are the patterns that separate a toy CRUD app from a data layer that survives real traffic and real concurrent users.

## Learning Objectives

- Build dynamic, composable WHERE clauses using the JPA Criteria API and Spring Data's `Specification<T>` interface
- Use `JpaSpecificationExecutor<T>` to run specifications against a repository without hand-writing JPQL
- Combine optional search criteria safely with `Specification.where().and()/.or()` without null-check spaghetti
- Use `Pageable`, `PageRequest`, and `Sort` to paginate and sort query results
- Understand the trade-offs between `Page<T>` (with total count) and `Slice<T>` (cheaper, no count query)
- Expose pagination and sorting through REST query parameters and structure paginated JSON responses
- Use interface-based and class-based (DTO) projections to fetch only the columns a client needs
- Add automatic auditing metadata (`@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`, `@LastModifiedBy`) with `@EnableJpaAuditing` and a custom `AuditorAware`
- Use `@Version` to implement optimistic locking and prevent lost updates in concurrent modification scenarios
- Detect and handle `OptimisticLockException` gracefully in a service and REST layer

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Specifications-and-Dynamic-Queries.md](01-Specifications-and-Dynamic-Queries.md) | Specifications & Dynamic Queries — Criteria API, `Specification<T>`, `JpaSpecificationExecutor` | 1 day |
| [02-Pagination-Sorting-and-Projections.md](02-Pagination-Sorting-and-Projections.md) | Pagination, Sorting & Projections — `Pageable`, `Page` vs `Slice`, interface/DTO projections | 1 day |
| [03-Auditing-and-Optimistic-Locking.md](03-Auditing-and-Optimistic-Locking.md) | Auditing & Optimistic Locking — `@CreatedDate`/`@LastModifiedDate`, `AuditorAware`, `@Version` | 1 day |

## Estimated Time

3 days

## Previous Phase

→ [Phase 8: Testing](../Phase-08-Testing/README.md)

## Next Phase

→ [Phase 10: Caching and Async](../Phase-10-Caching-and-Async/README.md)
