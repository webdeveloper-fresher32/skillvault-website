# Phase 8: Testing

## What You'll Learn

How to build a trustworthy automated test suite for a Spring Boot application. This phase covers the full testing pyramid: fast, isolated unit tests with JUnit 5 and Mockito; focused Spring Boot "test slices" (`@WebMvcTest`, `@DataJpaTest`, `@JsonTest`) that load only the parts of the application context you need; and full integration tests using `@SpringBootTest` with a real embedded server plus Testcontainers to run tests against real databases instead of in-memory fakes. By the end of this phase you will know which kind of test to reach for in any given situation, and how to write each kind correctly.

## Learning Objectives

- Write isolated unit tests for service classes using JUnit 5 (`@Test`, `@BeforeEach`, `@AfterEach`, `@ParameterizedTest`) and AssertJ assertions
- Mock dependencies with Mockito (`@Mock`, `@InjectMocks`, `when`/`thenReturn`, `verify`) to test business logic without a database or network
- Explain the test pyramid and why most tests should be fast unit tests, not slow integration tests
- Use `@WebMvcTest` and `MockMvc` to test REST controllers in isolation, asserting on JSON request/response bodies
- Use `@DataJpaTest` with an embedded database to test custom repository queries
- Use `@JsonTest` to verify JSON serialization/deserialization of DTOs
- Understand when a full `@SpringBootTest` is necessary versus a lighter test slice
- Explain why H2 in-memory databases can hide bugs that only appear against the real production database engine
- Use Testcontainers (`@Container`, `@DynamicPropertySource`) to run integration tests against a real, ephemeral Postgres or MySQL container

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-JUnit5-and-Mockito-Fundamentals.md](01-JUnit5-and-Mockito-Fundamentals.md) | JUnit 5 & Mockito Fundamentals — Unit Testing a Service Layer | 1 day |
| [02-Spring-Boot-Test-Slices.md](02-Spring-Boot-Test-Slices.md) | Spring Boot Test Slices — `@WebMvcTest`, `@DataJpaTest`, `@JsonTest` | 1 day |
| [03-Integration-Testing-and-Testcontainers.md](03-Integration-Testing-and-Testcontainers.md) | Integration Testing & Testcontainers — Full-Stack Confidence | 1 day |

## Estimated Time
3 days

## Previous Phase
→ [Phase 7: Spring Security](../Phase-07-Spring-Security/README.md)

## Next Phase
→ [Phase 9: Advanced Data](../Phase-09-Advanced-Data/README.md)
