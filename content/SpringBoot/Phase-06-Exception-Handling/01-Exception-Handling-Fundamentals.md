# Exception Handling Fundamentals — Complete Guide

## Table of Contents
1. [Why Exception Handling Matters in APIs](#1-why-exception-handling-matters-in-apis)
2. [Checked vs. Unchecked Exceptions in Java](#2-checked-vs-unchecked-exceptions-in-java)
3. [Why Spring Favors Unchecked Exceptions](#3-why-spring-favors-unchecked-exceptions)
4. [Designing a Custom Exception Hierarchy](#4-designing-a-custom-exception-hierarchy)
5. [What Happens When an Exception Goes Uncaught](#5-what-happens-when-an-exception-goes-uncaught)
6. [The DispatcherServlet Exception Resolution Chain](#6-the-dispatcherservlet-exception-resolution-chain)
7. [Throwing Custom Exceptions From a Service Layer](#7-throwing-custom-exceptions-from-a-service-layer)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why Exception Handling Matters in APIs

A REST API is a contract. When something goes wrong — a missing resource, invalid input, a downstream timeout — the client needs a **predictable, machine-readable** response, not a stack trace leaked into a browser tab or a generic `500 Internal Server Error` with no explanation.

Without deliberate exception handling, a Spring Boot application defaults to Whitelabel Error Pages or bare JSON blobs that reveal internal class names, expose stack traces in production, and give every single error the same HTTP status code (500), regardless of whether the real problem was "you sent bad data" (client's fault, 4xx) or "our database is down" (server's fault, 5xx).

Good exception handling in a Spring Boot application means:

- Every error path maps to the **correct HTTP status code**.
- Every error response has a **consistent JSON shape** the client can parse without guessing.
- **Domain-specific** errors (a customer not found, insufficient balance) are distinguishable from **infrastructure** errors (database down, network timeout).
- No implementation details (SQL, package names, line numbers) leak into a response body that leaves your process.

This phase builds that pipeline: exceptions in Java → custom domain exceptions → Spring's resolution chain → `@ControllerAdvice` → a clean JSON error body.

## 2. Checked vs. Unchecked Exceptions in Java

Java's exception model splits into two families under `Throwable`:

```text
                     Throwable
                    /         \
               Error           Exception
             (JVM-level,      /          \
              unrecoverable) RuntimeException  (everything else)
                              |                  = "checked"
                          (unchecked)             e.g. IOException,
                                                   SQLException
```

**Checked exceptions** (`Exception` minus `RuntimeException`) must be declared with `throws` or caught — the compiler enforces this. Examples: `IOException`, `SQLException`, `java.text.ParseException`.

```java
public void readConfig(String path) throws IOException {
    Files.readAllLines(Path.of(path)); // IOException must be declared or caught
}
```

**Unchecked exceptions** (`RuntimeException` and its subclasses) are *not* checked by the compiler. You can throw them without declaring them, and callers are not forced to catch them. Examples: `NullPointerException`, `IllegalArgumentException`, `IllegalStateException`.

```java
public void withdraw(BigDecimal amount) {
    if (amount.compareTo(balance) > 0) {
        throw new IllegalStateException("Insufficient funds"); // no throws clause needed
    }
    balance = balance.subtract(amount);
}
```

| Aspect | Checked | Unchecked |
|---|---|---|
| Compiler enforcement | Must declare or catch | No enforcement |
| Typical use | Recoverable conditions external to program logic (file missing, network down) | Programming errors or business-rule violations |
| Extends | `Exception` | `RuntimeException` |
| Propagation through layers | Pollutes every method signature (`throws IOException`) | Propagates silently, cleanly |
| Spring/JPA/Web layer usage | Rare (mostly wrapped) | Preferred throughout |

## 3. Why Spring Favors Unchecked Exceptions

Spring's own APIs are built almost entirely around unchecked exceptions, and this is a deliberate design choice, not an accident. The classic justification (echoed by Rod Johnson in *Expert One-on-One J2EE*) is:

1. **Checked exceptions don't scale through layers.** If your DAO method throws `SQLException`, every method up the call chain — repository, service, controller — must either catch it or re-declare `throws SQLException`. Add a second checked exception type and every signature in the chain grows again. This couples unrelated layers to low-level implementation details.
2. **Most exceptions are not recoverable at the call site.** A controller catching `SQLException` usually can't "fix" a broken connection — it can only log it and return an error. Forcing a `try/catch` at every layer that can't do anything useful with the exception is boilerplate, not safety.
3. **Unchecked exceptions still document intent.** You don't lose information — Javadoc and exception hierarchies still communicate what can go wrong. You just don't force the compiler to police it.

This is why Spring wraps almost every checked exception it encounters into an unchecked one:

- JDBC's checked `SQLException` → Spring's unchecked `DataAccessException` hierarchy.
- Jakarta Validation errors → Spring MVC's unchecked `MethodArgumentNotValidException`.
- JSON parsing errors → unchecked `HttpMessageNotReadableException`.

**The rule of thumb for your own code:** business/domain exceptions (resource not found, validation failed, insufficient balance, duplicate email) should be **unchecked**, extending `RuntimeException`. This lets them propagate cleanly from the repository through the service to the controller, where a single centralized handler (Phase 6, lesson 2) catches them — without every method signature in between needing a `throws` clause.

## 4. Designing a Custom Exception Hierarchy

A well-designed exception hierarchy gives you a single base type to catch generically (for logging, metrics) while still allowing fine-grained handling per concrete type.

```text
                     RuntimeException
                            |
                       ApiException                (abstract base — carries HttpStatus + error code)
                     /      |       \
   ResourceNotFoundException  ValidationException   DuplicateResourceException
        (404)                    (400)                    (409)
```

```java
// ApiException.java — abstract base for every domain exception in the app
package com.skillvault.orders.exception;

import org.springframework.http.HttpStatus;

public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    protected ApiException(String message, HttpStatus status, String errorCode) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
```

```java
// ResourceNotFoundException.java
package com.skillvault.orders.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends ApiException {

    public ResourceNotFoundException(String resourceName, Object identifier) {
        super(
            "%s not found with identifier '%s'".formatted(resourceName, identifier),
            HttpStatus.NOT_FOUND,
            "RESOURCE_NOT_FOUND"
        );
    }
}
```

```java
// ValidationException.java — for business-rule validation, distinct from Bean Validation
package com.skillvault.orders.exception;

import org.springframework.http.HttpStatus;

public class ValidationException extends ApiException {

    public ValidationException(String message) {
        super(message, HttpStatus.BAD_REQUEST, "VALIDATION_ERROR");
    }
}
```

```java
// DuplicateResourceException.java
package com.skillvault.orders.exception;

import org.springframework.http.HttpStatus;

public class DuplicateResourceException extends ApiException {

    public DuplicateResourceException(String message) {
        super(message, HttpStatus.CONFLICT, "DUPLICATE_RESOURCE");
    }
}
```

Because every concrete exception carries its own `HttpStatus` and `errorCode`, a single `@ExceptionHandler(ApiException.class)` in a global handler (next lesson) can build a correct, consistent response for *all* of them without a giant `if/else` chain of `instanceof` checks.

## 5. What Happens When an Exception Goes Uncaught

If a controller method (or anything it calls) throws an exception and nothing along the way catches it, Spring Boot's default `BasicErrorController` intercepts it at the servlet container boundary and returns:

```json
{
  "timestamp": "2026-07-13T09:15:32.101+00:00",
  "status": 500,
  "error": "Internal Server Error",
  "path": "/api/orders/999"
}
```

Every uncaught exception — whether it's a `NullPointerException`, your own `ResourceNotFoundException`, or a database timeout — collapses to **HTTP 500**. This is the single biggest reason to build centralized exception handling: without it, a client requesting an order that doesn't exist gets the same status code as a client that crashed the server with a null pointer bug. Both are technically "errors," but only one is the client's fault (a 404), and treating them identically breaks API semantics that clients rely on (e.g., retry logic that only retries 5xx).

```text
Request → Controller throws ResourceNotFoundException
                     │
                     ▼
        No @ExceptionHandler matches
                     │
                     ▼
   Falls through to servlet container's error page
                     │
                     ▼
        BasicErrorController → generic 500 response
```

## 6. The DispatcherServlet Exception Resolution Chain

Spring MVC's `DispatcherServlet` is the front controller for every request. When a handler method (your `@RestController` method) throws an exception, the `DispatcherServlet` doesn't immediately give up — it consults an ordered chain of `HandlerExceptionResolver` beans, each given a chance to convert the exception into a response.

```text
DispatcherServlet.processHandlerException(...)
        │
        ▼
1. ExceptionHandlerExceptionResolver
   → looks for a matching @ExceptionHandler method
     (in the throwing controller, or in any @ControllerAdvice)
        │  (no match found)
        ▼
2. ResponseStatusExceptionResolver
   → handles exceptions annotated with @ResponseStatus,
     or thrown as ResponseStatusException
        │  (no match found)
        ▼
3. DefaultHandlerExceptionResolver
   → handles Spring MVC's own built-in exceptions
     (e.g. HttpRequestMethodNotSupportedException → 405,
      HttpMediaTypeNotSupportedException → 415)
        │  (no match found)
        ▼
   Exception re-thrown → servlet container → BasicErrorController → 500
```

This ordering explains a lot of "why didn't my handler run?" bugs:

- `ExceptionHandlerExceptionResolver` runs **first**, so any `@ExceptionHandler` you define (locally or in a `@ControllerAdvice`) takes priority over everything else.
- If you don't define one, Spring checks for `@ResponseStatus` on the exception class itself:

```java
@ResponseStatus(HttpStatus.NOT_FOUND)
public class LegacyNotFoundException extends RuntimeException {
    public LegacyNotFoundException(String message) { super(message); }
}
```

  This is a lightweight, pre-`@ControllerAdvice` way to map an exception to a status — still valid, but far less flexible than a centralized handler since it can't build a custom response body.
- Only if *nothing* matches does the exception propagate out of Spring MVC entirely and get handled generically by the servlet container's error page mechanism (the 500 shown in section 5).

Understanding this chain is what makes `@ControllerAdvice` (next lesson) make sense: it works by registering into step 1 of this chain, intercepting exceptions *before* they ever reach steps 2 or 3.

## 7. Throwing Custom Exceptions From a Service Layer

Exceptions should be thrown from the layer that detects the problem — almost always the service layer, since that's where business rules and repository lookups live. Controllers should stay thin and never contain `try/catch` for domain exceptions; they let the exception propagate up to the centralized handler.

```java
// OrderService.java
package com.skillvault.orders.service;

import com.skillvault.orders.exception.DuplicateResourceException;
import com.skillvault.orders.exception.ResourceNotFoundException;
import com.skillvault.orders.model.Order;
import com.skillvault.orders.repository.OrderRepository;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public Order getOrderById(Long id) {
        return orderRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Order", id));
    }

    public Order createOrder(Order order) {
        if (orderRepository.existsByReferenceCode(order.getReferenceCode())) {
            throw new DuplicateResourceException(
                "An order with reference code '%s' already exists".formatted(order.getReferenceCode())
            );
        }
        return orderRepository.save(order);
    }
}
```

```java
// OrderController.java — deliberately has zero try/catch blocks
package com.skillvault.orders.controller;

import com.skillvault.orders.model.Order;
import com.skillvault.orders.service.OrderService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping("/{id}")
    public Order getOrder(@PathVariable Long id) {
        return orderService.getOrderById(id); // exception, if any, bubbles up untouched
    }

    @PostMapping
    public Order createOrder(@RequestBody Order order) {
        return orderService.createOrder(order);
    }
}
```

If `getOrderById` throws `ResourceNotFoundException`, it travels: repository → service → controller → `DispatcherServlet` → `ExceptionHandlerExceptionResolver` → the global handler defined in the next lesson. No layer in between needs to know or care.

## 8. Common Pitfalls

- **Catching exceptions in the controller "just in case."** This defeats the purpose of centralized handling, duplicates logic across controllers, and is easy to forget in new endpoints.
- **Throwing checked exceptions from service methods.** This forces every calling layer to add `throws` clauses or wrap them, re-introducing the exact coupling Spring's design avoids.
- **Using generic exceptions like `RuntimeException` or `Exception` directly.** This makes it impossible for a handler to distinguish a 404 from a 400 from a 409 — always throw a specific, purpose-built subclass.
- **Swallowing exceptions with an empty `catch` block.** This hides bugs and produces a "successful" response for a request that actually failed.
- **Leaking stack traces or exception messages containing SQL/internal details into the HTTP response body.** Log the full detail server-side; return a sanitized message to the client.
- **Forgetting that `@ResponseStatus` on an exception class doesn't let you customize the response body** — it only sets the status code. For a structured body (error code, timestamp, field errors), you need `@ExceptionHandler`.
- **Assuming all exceptions eventually reach your `@ControllerAdvice`.** Exceptions thrown outside the Spring MVC request-handling flow (e.g., in a `@Scheduled` method, a Kafka listener, or a filter before `DispatcherServlet`) are *not* caught by `@ControllerAdvice` — they need their own handling.

## 9. Best Practices

- Make every domain exception extend a common abstract base (`ApiException`) that carries an `HttpStatus` and an `errorCode`, so a generic handler can process all of them uniformly.
- Keep exceptions **unchecked** (`extends RuntimeException`) for anything representing a business rule violation or expected failure mode (not found, invalid state, conflict).
- Name exceptions after the *condition*, not the *layer* — `ResourceNotFoundException`, not `RepositoryException`.
- Throw exceptions as early as possible, in the service layer, right where the invalid condition is detected — don't let bad state travel further down the call stack.
- Never let a controller method contain `try/catch` for expected domain errors; that's what centralized handling is for.
- Include enough context in the exception message to debug it (`"Order not found with id: 42"`) without leaking sensitive internals (never include SQL, credentials, or stack details in the message itself).
- Reserve checked exceptions for genuinely exceptional, unrecoverable-at-this-layer conditions when integrating with legacy or third-party APIs that force them on you — and wrap them into an unchecked exception at the boundary rather than propagating the checked type upward.

## 10. Hands-On Exercises

1. Create an abstract `ApiException` class carrying `HttpStatus` and `errorCode`, then create three concrete subclasses: `ResourceNotFoundException` (404), `ValidationException` (400), and `DuplicateResourceException` (409).
2. Build a `ProductService` with an in-memory `Map<Long, Product>` and a `getProductById` method that throws `ResourceNotFoundException` when the id is missing. Call it from a controller with no try/catch and confirm (via Postman/curl) that an uncaught exception currently returns a generic 500.
3. Add `@ResponseStatus(HttpStatus.NOT_FOUND)` directly to a test exception class and confirm the HTTP status changes to 404 — then inspect the response body and note that it still lacks a custom error code or structured shape.
4. Write a short program (outside Spring) demonstrating the compiler difference between checked and unchecked exceptions: write two methods, one throwing a checked `IOException` (which won't compile without `throws` or a try/catch) and one throwing an unchecked `IllegalStateException` (which compiles either way).
5. Trace through your own log output: throw an exception from a service method and use a debugger or log statements to confirm the exact order in which it propagates: repository → service → controller → `DispatcherServlet`.

## 11. Interview Q&A

**Q1: What is the difference between a checked and an unchecked exception in Java, and why does it matter for API design?**
A checked exception (any subclass of `Exception` other than `RuntimeException`) is enforced by the compiler — a method that can throw one must either catch it or declare it with `throws`. An unchecked exception (`RuntimeException` and its subclasses) has no such compiler enforcement. It matters for API design because checked exceptions force every intermediate layer between where the exception occurs and where it's finally handled to know about and declare that exception type, which tightly couples unrelated layers (e.g., a controller having to declare `throws SQLException` because of something a repository three layers down does). Unchecked exceptions propagate silently through layers that can't do anything useful with them, and are only caught where there's actually a meaningful recovery or reporting action to take.

**Q2: Why does Spring favor unchecked exceptions over checked ones, even though the JDK itself uses checked exceptions extensively (e.g., `SQLException`)?**
Spring's philosophy, articulated early in its design, is that most exceptions in a typical application are not recoverable at the immediate call site — a service method calling a repository can't meaningfully "fix" a `SQLException`, it can only log it and fail the request. Forcing every method in the call chain to declare or catch it produces boilerplate without adding safety. Spring demonstrates this by wrapping JDBC's checked `SQLException` into its own unchecked `DataAccessException` hierarchy, so application code can choose to catch specific subtypes where it matters, without every DAO method signature being polluted with `throws SQLException`.

**Q3: What HTTP status code does Spring Boot return by default for an uncaught exception, and why is that a problem?**
By default, any uncaught exception — regardless of its actual cause — results in an HTTP 500 Internal Server Error via the `BasicErrorController`. This is a problem because it conflates genuinely different situations: a client requesting a resource that doesn't exist (which should be a 404, a client error) looks identical, from the client's perspective, to the server crashing due to a bug or infrastructure failure (which should be a 500, a server error). Clients that implement retry logic based on status code (retrying 5xx but not 4xx) will behave incorrectly, and monitoring/alerting systems lose the ability to distinguish "our bug" from "user sent bad input."

**Q4: Describe the order in which Spring MVC's `HandlerExceptionResolver` chain attempts to resolve an exception thrown by a controller.**
The `DispatcherServlet` delegates to an ordered list of resolvers. First, `ExceptionHandlerExceptionResolver` checks for a matching `@ExceptionHandler` method, either defined locally in the throwing controller or globally in a `@ControllerAdvice`. If none matches, `ResponseStatusExceptionResolver` checks whether the exception is annotated with `@ResponseStatus` or is a `ResponseStatusException`. If that also doesn't match, `DefaultHandlerExceptionResolver` handles Spring MVC's own built-in exceptions (like unsupported HTTP methods). If none of the three resolves it, the exception propagates out of Spring MVC to the servlet container, which produces the generic 500 response.

**Q5: Why should exceptions be designed as a hierarchy rooted in a common abstract base like `ApiException`, rather than as unrelated standalone classes?**
A common base class lets a single `@ExceptionHandler(ApiException.class)` (or similar) build a correct, consistent HTTP response for every concrete exception type without needing an `instanceof` chain, because each subclass already carries its own `HttpStatus` and error code as constructor arguments. It also allows logging, metrics, and monitoring code to catch and instrument `ApiException` generically while still letting more specific handlers (if needed) catch a particular subtype for special-case behavior — the hierarchy gives you both broad and narrow handling from the same design.

**Q6: If a controller method throws a checked exception, what must the method signature look like, and how does that differ from an unchecked exception in the same position?**
If a method body can throw a checked exception (say, `IOException`), the method's signature must either declare `throws IOException` or the method body must catch it internally — the Java compiler will refuse to compile otherwise. If the method throws an unchecked exception like `IllegalStateException` instead, no `throws` clause is required and the code compiles regardless of whether any caller catches it. In a layered Spring application, this means checked exceptions require every intermediate method signature between the throw site and the eventual catch site to either declare or handle them, while unchecked exceptions can pass silently through as many layers as needed with zero signature changes — which is exactly why Spring's own exceptions, and idiomatic custom domain exceptions, are unchecked.
