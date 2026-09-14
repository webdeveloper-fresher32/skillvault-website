# Phase 2: Spring Boot Fundamentals

## What You'll Learn
Phase 1 covered the core Spring container — IoC, dependency injection, beans, and `ApplicationContext`. Phase 2 shows how Spring Boot builds on top of that container to eliminate the manual wiring that raw Spring requires. You'll learn how `@SpringBootApplication` and conditional annotations drive auto-configuration, how starters and the `spring-boot-starter-parent`/BOM resolve compatible dependency versions without you having to guess them, and how `application.properties`/`application.yml` externalize configuration across environments through profiles, relaxed binding, and type-safe `@ConfigurationProperties` classes. Together these three lessons explain what actually happens between running `main()` and having a fully configured, runnable application.

## Learning Objectives
- Explain what `@SpringBootApplication` actually composes (`@Configuration`, `@ComponentScan`, `@EnableAutoConfiguration`)
- Understand how auto-configuration classes are discovered and conditionally applied via `@Conditional*` annotations (`@ConditionalOnClass`, `@ConditionalOnMissingBean`, etc.)
- Debug auto-configuration decisions using the `--debug` flag and the auto-configuration report
- Back out of unwanted auto-configuration with exclusions
- Use Spring Initializr (web UI, CLI, or IDE integration) to scaffold a correctly structured project
- Understand what a "starter" is — a dependency descriptor with no code of its own — and how it differs from a regular library
- Explain how `spring-boot-starter-parent` (or the `spring-boot-dependencies` BOM) pins compatible versions across the Spring ecosystem, and how to override a single dependency version safely
- Choose between `application.properties` and `application.yml`, and know the precedence order when both exist
- Use Spring profiles (`application-{profile}.properties`) to vary configuration by environment
- Understand the full external configuration precedence order (command-line args, env vars, config files, defaults)
- Bind configuration to type-safe Java classes with `@ConfigurationProperties`, including relaxed binding and validation
- Distinguish `@Value`/SpEL expressions from `@ConfigurationProperties` and know when to use each
- Externalize secrets instead of hardcoding them in properties files

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Spring-Boot-Auto-Configuration.md](01-Spring-Boot-Auto-Configuration.md) | Spring Boot Auto-Configuration — `@SpringBootApplication`, Conditional Annotations, Startup Pipeline, Debugging | 1 day |
| [02-Spring-Initializr-and-Starters.md](02-Spring-Initializr-and-Starters.md) | Spring Initializr and Starters — Project Generation, Starter Dependencies, Parent POM/BOM, Version Resolution | 0.5 day |
| [03-Application-Properties.md](03-Application-Properties.md) | Application Properties and Configuration — Properties vs YAML, Profiles, Relaxed Binding, `@ConfigurationProperties` | 0.5 day |

## Estimated Time
2 days

## Previous Phase
→ [Phase 1: Core Spring](../Phase-01-Core-Spring/README.md)

## Next Phase
→ [Phase 3: REST APIs (Spring Web)](../Phase-03-REST-APIs-Spring-Web/README.md)
