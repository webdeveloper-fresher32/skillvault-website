# Phase 1: Core Spring Framework

## What You'll Learn
The Spring Framework's core principle, Inversion of Control (IoC), and how Spring implements it through Dependency Injection (DI). You'll learn what the Spring IoC Container actually does, the full bean lifecycle from instantiation to destruction, the distinction between `BeanFactory` and `ApplicationContext`, how `@Autowired` resolves ambiguous dependencies, how circular dependencies arise and get resolved, and how bean scopes, the scoped-proxy pattern, and `ApplicationContext`'s enterprise features (events, environment abstraction, internationalization) fit together. This phase is foundational — every later phase in this course (auto-configuration, REST controllers, Spring Data JPA, Spring Security) is built on top of these mechanics.

## Learning Objectives
- Explain Inversion of Control and contrast traditional vs inverted control flow with concrete code
- Describe the Spring IoC Container's responsibilities and the difference between `BeanFactory` and `ApplicationContext`
- Trace the full Spring bean lifecycle end-to-end, including Aware callbacks, `BeanPostProcessor` hooks, and init/destroy callbacks
- Choose the correct dependency injection style (constructor, setter, field) and justify the choice with trade-offs
- Predict how `@Autowired` resolves ambiguous candidates using type, `@Qualifier`, `@Primary`, and name matching
- Diagnose and resolve circular dependency errors, and recognize them as a design smell
- Inject optional dependencies and collections of beans (`List<T>`/`Map<String,T>`) with predictable ordering
- Choose the correct bean scope for a given use case and apply the scoped-proxy pattern correctly
- Use `ApplicationContext`'s event publishing, environment abstraction, and internationalization features
- Distinguish `BeanFactoryPostProcessor` from `BeanPostProcessor` and avoid manual bean lookup as an anti-pattern

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Inversion-of-Control.md](01-Inversion-of-Control.md) | Inversion of Control — IoC Container, BeanFactory vs ApplicationContext, the Full Bean Lifecycle | 1 day |
| [02-Dependency-Injection.md](02-Dependency-Injection.md) | Dependency Injection — Injection Styles, @Autowired Resolution, Circular Dependencies, Optional & Collection Injection | 1 day |
| [03-Spring-Beans-and-ApplicationContext.md](03-Spring-Beans-and-ApplicationContext.md) | Spring Beans and ApplicationContext — Bean Scopes, Scoped Proxies, Events, Environment, i18n | 1 day |

## Estimated Time
3 days

## Next Phase
→ [Phase 2: Boot Fundamentals](../Phase-02-Boot-Fundamentals/README.md)
