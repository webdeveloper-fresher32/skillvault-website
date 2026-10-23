# Spring Boot — Complete Backend Learning Course

Master Java backend development using **Spring Boot 3**. This course is designed to take you from core Spring framework fundamentals (IoC, Dependency Injection) to building production-grade, secure, and scalable REST APIs with Spring Data JPA and Spring Security.

This course assumes a basic understanding of Java (up to Java 17 features like records and text blocks), but does not assume any prior backend or Spring experience.

---

## Course Structure

```text
SpringBoot/
├── Phase-01-Core-Spring/                  → Inversion of Control (IoC), Dependency Injection, Beans, ApplicationContext
├── Phase-02-Boot-Fundamentals/            → Spring Initializr, Auto-configuration, Starters, application.properties/yml
├── Phase-03-REST-APIs-Spring-Web/         → @RestController, routing, RequestBody, PathVariable, ResponseEntity
├── Phase-04-Data-Access-JPA/              → Spring Data JPA, Entities, Repositories, derived queries, JPQL
├── Phase-05-Service-and-Transactions/     → @Service layer, @Transactional, business logic separation
├── Phase-06-Exception-Handling/           → @ControllerAdvice, @ExceptionHandler, custom error responses, Bean Validation
├── Phase-07-Spring-Security/              → Basic Auth, JWT token generation/validation, role-based access control
├── Phase-08-Testing/                      → JUnit 5, Mockito, @WebMvcTest, @DataJpaTest, @SpringBootTest
├── Phase-09-Advanced-Data/                → Pagination, sorting, database migrations (Flyway/Liquibase)
├── Phase-10-Caching-and-Async/            → Spring Cache, @Async, @Scheduled tasks
├── Phase-11-Microservices-Basics/         → Intro to Spring Cloud (Config, Service Discovery, API Gateway)
├── Phase-12-Production-and-Actuator/      → Spring Boot Actuator, health checks, Dockerizing, GraalVM basics
├── Quick-Reference/                       → Cheatsheet + 50 interview Q&A
└── Projects/                              → Hands-on projects (Blog API, E-commerce backend)
```

---

## Learning Path

| Phase | Topic | Difficulty | Time |
|-------|-------|-----------|------|
| 01 | Core Spring Framework | Beginner | 2 days |
| 02 | Spring Boot Fundamentals | Beginner | 2 days |
| 03 | REST APIs (Spring Web) | Beginner | 3 days |
| 04 | Data Access (Spring Data JPA)| Intermediate | 4 days |
| 05 | Services & Transactions | Intermediate | 2 days |
| 06 | Exception Handling & Validation| Intermediate | 2 days |
| 07 | Spring Security | Advanced | 4 days |
| 08 | Testing | Intermediate | 3 days |
| 09 | Advanced Data | Intermediate | 2 days |
| 10 | Caching & Async | Advanced | 2 days |
| 11 | Microservices Basics | Advanced | 3 days |
| 12 | Production & Actuator | Advanced | 2 days |

**Total estimated time: 5-7 weeks**

---

## Prerequisites

- Solid Java fundamentals (Classes, Interfaces, Collections, Streams, Exceptions).
- Familiarity with basic SQL and relational databases (MySQL or PostgreSQL).
- Basic understanding of HTTP methods (GET, POST, PUT, DELETE).

## How to Use This Course

1. **Do not skip Phase 01.** Understanding Inversion of Control and Dependency Injection is crucial for understanding how Spring "magic" actually works under the hood.
2. Build the hands-on projects alongside the curriculum. Spring Boot heavily relies on annotations; the only way to build muscle memory is by writing the code yourself.
3. We focus on modern **Spring Boot 3** (requiring Java 17+).
4. For Phase 04 (Data Access), we assume you know basic SQL. If you need a refresher on databases, refer to the `MySQL` or `PostgreSQL` courses in the SkillVault.
