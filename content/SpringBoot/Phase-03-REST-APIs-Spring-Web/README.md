# Phase 3: REST APIs (Spring Web)

## What You'll Learn
This phase covers building HTTP APIs with Spring MVC, from the moment a request hits the embedded servlet container to the moment a response leaves it. You'll learn how `@RestController` and `@RequestMapping` (and its verb-specific shortcuts) route requests, how `@PathVariable` and `@RequestParam` extract data from different parts of a URL, and how `@RequestBody` and `ResponseEntity` give you precise control over deserializing incoming JSON and shaping outgoing status codes, headers, and bodies. By the end you'll be able to design a RESTful controller layer that follows HTTP conventions correctly — proper resource naming, status codes, content negotiation, and validation — rather than one that merely happens to work.

## Learning Objectives
- Trace the HTTP request lifecycle through the embedded servlet container, filters, `DispatcherServlet`, and handler methods
- Distinguish `@Controller` from `@RestController` and know when each is appropriate
- Use `@RequestMapping` and its HTTP-verb shortcuts (`@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`)
- Compose class-level and method-level paths, and apply basic content negotiation (`produces`/`consumes`)
- Follow RESTful resource naming conventions and choose correct HTTP status codes
- Enable cross-origin requests with `@CrossOrigin`
- Extract dynamic URL segments with `@PathVariable`, including type conversion, regex constraints, and optional variables
- Extract query-string data with `@RequestParam`, including repeated params and binding whole query objects
- Apply Bean Validation to path/query parameters
- Choose correctly between `@PathVariable`, `@RequestParam`, and `@RequestBody` for a given piece of data
- Deserialize request bodies with `@RequestBody` and understand the underlying `HttpMessageConverter` mechanics
- Separate DTOs from JPA entities instead of exposing entities directly over the wire
- Validate request bodies with Bean Validation (`@Valid`, `@NotNull`, etc.)
- Use `ResponseEntity<T>` to control status code, headers, and body explicitly, and know when a raw return type is sufficient

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Rest-Controllers-and-Routing.md](01-Rest-Controllers-and-Routing.md) | REST Controllers and Routing — Request Lifecycle, `@RestController`, `@RequestMapping`, CORS | 1 day |
| [02-Path-Variables-and-Request-Params.md](02-Path-Variables-and-Request-Params.md) | Path Variables and Request Params — `@PathVariable`, `@RequestParam`, Type Conversion, Validation | 1 day |
| [03-Request-Body-and-Response-Entity.md](03-Request-Body-and-Response-Entity.md) | Request Body and ResponseEntity — Deserialization, DTOs vs Entities, Content Negotiation, Status Codes | 1 day |

## Estimated Time
3 days

## Previous Phase
→ [Phase 2: Spring Boot Fundamentals](../Phase-02-Boot-Fundamentals/README.md)

## Next Phase
→ [Phase 4: Data Access (Spring Data JPA)](../Phase-04-Data-Access-JPA/README.md)
