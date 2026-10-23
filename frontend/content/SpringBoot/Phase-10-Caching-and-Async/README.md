# Phase 10: Caching & Async

## What You'll Learn
How to make a Spring Boot application faster and more responsive by offloading expensive, repeatable work. This phase covers the Spring Cache abstraction (`@Cacheable`, `@CachePut`, `@CacheEvict`) with pluggable backends from an in-memory `ConcurrentMap` up to Caffeine and Redis, asynchronous method execution with `@Async` and `CompletableFuture`, and time-based background jobs with `@Scheduled`. All three features share the same underlying mechanism — a dynamic proxy wrapping your bean — so this phase also digs into proxy-based AOP and the self-invocation pitfall that trips up almost everyone the first time.

## Learning Objectives
- Enable and configure the Spring Cache abstraction with `@EnableCaching`
- Use `@Cacheable`, `@CachePut`, and `@CacheEvict` correctly, including conditional caching
- Control cache key generation with SpEL and custom `KeyGenerator` beans
- Understand why proxy-based caching fails on self-invocation (same root cause as `@Transactional`)
- Choose and configure a `CacheManager` — `ConcurrentMapCacheManager`, Caffeine, or Redis
- Run methods asynchronously with `@Async` and return `CompletableFuture<T>`
- Configure a custom `ThreadPoolTaskExecutor` and explain why the default executor is unsafe in production
- Handle exceptions thrown from `void` async methods with `AsyncUncaughtExceptionHandler`
- Schedule recurring jobs with `@Scheduled`, using `fixedRate`, `fixedDelay`, and cron expressions
- Configure a multi-threaded `TaskScheduler` and reason about distributed scheduling with tools like ShedLock

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Spring-Cache-Abstraction.md](01-Spring-Cache-Abstraction.md) | Spring Cache Abstraction — Annotations, Keys, and CacheManagers | 2 days |
| [02-Async-Processing.md](02-Async-Processing.md) | Async Processing — @Async, Executors, and CompletableFuture | 2 days |
| [03-Scheduled-Tasks.md](03-Scheduled-Tasks.md) | Scheduled Tasks — @Scheduled, Thread Pools, and Distributed Locking | 1 day |

## Estimated Time
5 days

## Previous Phase
→ [Phase 9: Advanced Data](../Phase-09-Advanced-Data/README.md)

## Next Phase
→ [Phase 11: Microservices Basics](../Phase-11-Microservices-Basics/README.md)
