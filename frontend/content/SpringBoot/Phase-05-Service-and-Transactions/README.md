# Phase 5: Service Layer & Transactions

## What You'll Learn

The `@Service` layer is where business logic lives — the layer between your REST controllers and your data-access repositories. This phase covers how to design a clean service layer (interfaces vs concrete classes, DTOs vs entities, orchestration across multiple repositories), and then goes deep on Spring's `@Transactional` support: how the AOP proxy mechanism actually works, why calling a `@Transactional` method from another method in the *same* class silently does nothing, the full propagation and isolation model, and the rollback rules that decide whether your data survives an exception. This is one of the most misunderstood areas of the Spring framework, and this phase is intentionally deeper than a typical phase to make sure the mental model is airtight.

## Learning Objectives

- Structure an application into Controller → Service → Repository layers with clear responsibilities
- Decide when a service needs an interface and when a concrete class is enough
- Map between DTOs and entities cleanly (manually and with MapStruct)
- Explain how `@Transactional` is implemented via Spring AOP proxies (JDK dynamic proxy vs CGLIB)
- Diagnose and fix the self-invocation problem where `@Transactional` is silently ignored
- Choose the correct propagation type (`REQUIRED`, `REQUIRES_NEW`, `NESTED`, `MANDATORY`, etc.) for a given scenario
- Choose the correct isolation level and explain which read phenomena it prevents
- Configure rollback rules (`rollbackFor`, `noRollbackFor`), `readOnly`, and transaction timeouts correctly
- Avoid the classic bug of swallowing an exception inside a transactional method and silently losing the rollback

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Service-Layer-Design.md](01-Service-Layer-Design.md) | Service Layer Design — Layering, Interfaces, DTOs vs Entities | 1 day |
| [02-Transactional-Deep-Dive.md](02-Transactional-Deep-Dive.md) | @Transactional Deep Dive — Proxies, Self-Invocation, Propagation, Isolation | 1.5 days |
| [03-Rollback-Rules-and-Error-Handling.md](03-Rollback-Rules-and-Error-Handling.md) | Rollback Rules & Error Handling — rollbackFor, readOnly, Timeouts, Partial Failure | 1 day |

## Estimated Time
3–3.5 days

## Previous Phase
→ [Phase 4: Data Access (Spring Data JPA)](../Phase-04-Data-Access-JPA/README.md)

## Next Phase
→ [Phase 6: Exception Handling](../Phase-06-Exception-Handling/README.md)
