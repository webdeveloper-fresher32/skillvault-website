# @ControllerAdvice & @ExceptionHandler — Complete Guide

## Table of Contents
1. [From Scattered Handling to Centralized Handling](#1-from-scattered-handling-to-centralized-handling)
2. [@ExceptionHandler at the Controller Level](#2-exceptionhandler-at-the-controller-level)
3. [@ControllerAdvice and @RestControllerAdvice](#3-controlleradvice-and-restcontrolleradvice)
4. [Handling Multiple Exception Types](#4-handling-multiple-exception-types)
5. [Resolution Order: Local vs. Global Handlers](#5-resolution-order-local-vs-global-handlers)
6. [ProblemDetail (RFC 7807) — The Modern Standard](#6-problemdetail-rfc-7807--the-modern-standard)
7. [Worked Example: A Complete Global Exception Handler](#7-worked-example-a-complete-global-exception-handler)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. From Scattered Handling to Centralized Handling

Lesson 1 established that uncaught exceptions collapse into a generic 500, and that domain exceptions should be unchecked so they can propagate cleanly through layers. This lesson closes the loop: **where and how do you actually catch them?**

There are two mechanisms, and they compose:

```text
┌─────────────────────────────────────────────────────────┐
│  @ExceptionHandler on a method inside ONE @Controller    │
│  → handles exceptions only for that controller           │
└─────────────────────────────────────────────────────────┘
                          +
┌─────────────────────────────────────────────────────────┐
│  @ExceptionHandler on a method inside a @ControllerAdvice │
│  → handles exceptions for EVERY controller in the app     │
└─────────────────────────────────────────────────────────┘
```

Almost every production Spring Boot application uses a single global `@RestControllerAdvice` class as the backbone of its error handling, with local `@ExceptionHandler` methods reserved for genuinely controller-specific edge cases.

## 2. @ExceptionHandler at the Controller Level

`@ExceptionHandler` marks a method as the recovery path for a specific exception type thrown by any handler method in the *same* controller class.

```java
package com.skillvault.orders.controller;

import com.skillvault.orders.exception.ResourceNotFoundException;
import com.skillvault.orders.model.Order;
import com.skillvault.orders.service.OrderService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
        return orderService.getOrderById(id);
    }

    // Only handles ResourceNotFoundException thrown from methods in THIS controller
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<String> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
    }
}
```

This works, but it doesn't scale: a `ProductController`, `CustomerController`, and `PaymentController` would each need to redefine an identical `handleNotFound` method, and any inconsistency between them (different JSON shape, different status code) becomes a real API bug. Local `@ExceptionHandler` methods are best reserved for exceptions that are truly unique to one controller's behavior — everything shared belongs in a global advice.

## 3. @ControllerAdvice and @RestControllerAdvice

`@ControllerAdvice` is a specialization of `@Component` that lets a class's `@ExceptionHandler` (and `@InitBinder`, `@ModelAttribute`) methods apply **across every controller** in the application, not just one.

`@RestControllerAdvice` is `@ControllerAdvice` + `@ResponseBody` combined — every handler method's return value is serialized directly to the HTTP response body (typically JSON), exactly like `@RestController` combines `@Controller` + `@ResponseBody`. For a JSON REST API, you almost always want `@RestControllerAdvice`.

```java
package com.skillvault.orders.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice   // applies to ALL @RestController classes in the app
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        ErrorResponse body = new ErrorResponse(
            ex.getErrorCode(), ex.getMessage(), ex.getStatus().value()
        );
        return ResponseEntity.status(ex.getStatus()).body(body);
    }
}
```

You can scope a `@ControllerAdvice` to a subset of controllers, which is useful in large modular monoliths:

```java
// Only applies to controllers within the admin package
@RestControllerAdvice(basePackages = "com.skillvault.orders.admin")
public class AdminExceptionHandler { /* ... */ }

// Only applies to controllers annotated with a specific marker annotation
@RestControllerAdvice(annotations = PublicApi.class)
public class PublicApiExceptionHandler { /* ... */ }
```

## 4. Handling Multiple Exception Types

A single `@ExceptionHandler` method can handle several unrelated exception types by listing them in the annotation, as long as the method signature is compatible with all of them (usually accepting the common `Exception` supertype or nothing at all).

```java
@ExceptionHandler({ IllegalArgumentException.class, IllegalStateException.class })
public ResponseEntity<ErrorResponse> handleBadRequestFamily(RuntimeException ex) {
    ErrorResponse body = new ErrorResponse("BAD_REQUEST", ex.getMessage(), 400);
    return ResponseEntity.badRequest().body(body);
}
```

More commonly, because our custom hierarchy shares a common `ApiException` base carrying its own status and error code, **one handler method covers every domain exception**:

```java
@ExceptionHandler(ApiException.class)
public ResponseEntity<ErrorResponse> handleApiException(ApiException ex) {
    ErrorResponse body = new ErrorResponse(ex.getErrorCode(), ex.getMessage(), ex.getStatus().value());
    return ResponseEntity.status(ex.getStatus()).body(body);
}
```

This is the payoff of the hierarchy design from lesson 1: `ResourceNotFoundException`, `ValidationException`, and `DuplicateResourceException` all flow through this single method, each producing the correct status because the status lives on the exception instance, not in the handler's logic.

## 5. Resolution Order: Local vs. Global Handlers

When both a controller-local `@ExceptionHandler` and a global `@ControllerAdvice` handler could match the same exception, Spring always prefers the **most specific match**:

```text
Exception thrown in Controller X
        │
        ▼
1. Does Controller X have a local @ExceptionHandler
   matching this exception type (or a supertype)?
        │ yes ──────────────► use it, STOP
        │ no
        ▼
2. Does any applicable @ControllerAdvice have a
   matching @ExceptionHandler?
        │ yes ──────────────► use it, STOP
        │ no
        ▼
3. Falls through to ResponseStatusExceptionResolver,
   then DefaultHandlerExceptionResolver, then 500
```

Within a single class (local or advice), if multiple `@ExceptionHandler` methods could match because of a type hierarchy (e.g., one for `ApiException`, one for `ResourceNotFoundException`), Spring picks the **most specific** exception type — a handler for the exact thrown class wins over a handler for its superclass.

## 6. ProblemDetail (RFC 7807) — The Modern Standard

Hand-rolled error DTOs like the `ErrorResponse` above work, but every team invents a slightly different shape. Spring Framework 6 / Spring Boot 3 ships a built-in implementation of **RFC 7807 "Problem Details for HTTP APIs"**: the `org.springframework.http.ProblemDetail` class. It standardizes the fields every error response should have:

```json
{
  "type": "https://api.skillvault.com/errors/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Order not found with identifier '999'",
  "instance": "/api/orders/999",
  "timestamp": "2026-07-13T09:20:11.552Z",
  "errorCode": "RESOURCE_NOT_FOUND"
}
```

| Field | Meaning |
|---|---|
| `type` | A URI identifying the error category (can be a documentation link) |
| `title` | Short, human-readable summary of the error category |
| `status` | The HTTP status code, duplicated in the body for clients that don't inspect headers |
| `detail` | A human-readable explanation specific to this occurrence |
| `instance` | The URI path of the request that triggered the error |
| *(extension members)* | Any additional properties you add, like `timestamp` or `errorCode` |

`ProblemDetail` is a **standard**, not just a Spring convenience — the same shape is produced by other frameworks (ASP.NET Core, various Node frameworks) that implement RFC 7807, which matters if your API is consumed by external teams or partners expecting a well-known error contract.

Spring MVC controller advice methods can return `ProblemDetail` directly, and Spring provides a convenience factory via `ErrorResponse.builder(...)` or the static helpers on `ProblemDetail`:

```java
@ExceptionHandler(ResourceNotFoundException.class)
public ProblemDetail handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
    problem.setTitle("Resource Not Found");
    problem.setInstance(URI.create(request.getRequestURI()));
    problem.setProperty("errorCode", ex.getErrorCode());
    problem.setProperty("timestamp", Instant.now());
    return problem;
}
```

## 7. Worked Example: A Complete Global Exception Handler

This example ties together the custom exception hierarchy from lesson 1 with `@RestControllerAdvice` and `ProblemDetail`, producing a single consistent error contract for the whole application.

```java
// ErrorResponse.java — a lean, explicit alternative to ProblemDetail
// (some teams prefer this when they don't need full RFC 7807 compliance)
package com.skillvault.orders.exception;

import java.time.Instant;

public record ErrorResponse(
    String errorCode,
    String message,
    int status,
    Instant timestamp
) {
    public ErrorResponse(String errorCode, String message, int status) {
        this(errorCode, message, status, Instant.now());
    }
}
```

```java
// GlobalExceptionHandler.java — the single source of truth for error responses
package com.skillvault.orders.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // Covers ResourceNotFoundException, ValidationException, DuplicateResourceException, etc.
    // in ONE method, because each carries its own HttpStatus + errorCode.
    @ExceptionHandler(ApiException.class)
    public ProblemDetail handleApiException(ApiException ex, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
        problem.setTitle(ex.getClass().getSimpleName());
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("errorCode", ex.getErrorCode());
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    // Client sent a malformed request body Spring couldn't even deserialize
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ProblemDetail handleUnreadableBody(
            org.springframework.http.converter.HttpMessageNotReadableException ex,
            HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, "Malformed JSON request body"
        );
        problem.setTitle("Malformed Request");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("errorCode", "MALFORMED_REQUEST");
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    // Absolute last resort — catches anything not already handled above.
    // Logs full detail server-side; returns a sanitized message to the client.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGeneric(Exception ex, HttpServletRequest request) {
        // log.error("Unhandled exception on {}", request.getRequestURI(), ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred"
        );
        problem.setTitle("Internal Server Error");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("errorCode", "INTERNAL_ERROR");
        problem.setProperty("timestamp", Instant.now());
        return ResponseEntity.internalServerError().body(problem);
    }
}
```

With this in place, `GET /api/orders/999` for a nonexistent order now returns:

```json
{
  "type": "about:blank",
  "title": "ResourceNotFoundException",
  "status": 404,
  "detail": "Order not found with identifier '999'",
  "instance": "/api/orders/999",
  "errorCode": "RESOURCE_NOT_FOUND",
  "timestamp": "2026-07-13T09:22:04.118Z"
}
```

...while a genuine bug (say, a `NullPointerException` deep in a service) is caught by the fallback `Exception.class` handler, logged in full server-side, and still returns a clean, non-leaking 500 body to the client.

## 8. Common Pitfalls

- **Defining the same `@ExceptionHandler` logic in multiple controllers** instead of once in a `@ControllerAdvice` — leads to drift and inconsistent error shapes across the API.
- **Using `@ControllerAdvice` when you actually need JSON responses** — without `@ResponseBody` (or using `@RestControllerAdvice` instead), Spring may try to resolve a view name from the returned object, which fails or produces unexpected output for a REST API.
- **Catching `Exception.class` too early in the handler search order (unintentionally) or forgetting it entirely.** Without a catch-all, unexpected exceptions (NPEs, library bugs) fall through to the framework default and leak a generic response with less context than your own fallback would provide.
- **Returning different JSON field names from different handler methods** (`error` vs. `message` vs. `detail`) — pick one shape (ideally `ProblemDetail`) and use it everywhere.
- **Forgetting that `@ExceptionHandler` methods themselves can throw exceptions** — if a handler method has a bug, that new exception propagates and can produce a confusing secondary error.
- **Overusing `@ExceptionHandler({A.class, B.class, C.class, ...})` with a huge unrelated exception list** in one method — if the exceptions don't share meaningful common handling logic, split them into separate, clearer methods.
- **Not testing the global handler.** It's easy to add a new exception type to your hierarchy and forget it's still correctly caught by the generic `ApiException` handler — write a test that asserts the status code and body shape for each.

## 9. Best Practices

- Default to `@RestControllerAdvice` for JSON APIs; reserve local `@ExceptionHandler` methods for truly controller-specific behavior that shouldn't apply anywhere else.
- Adopt `ProblemDetail` (RFC 7807) as your response shape unless you have a strong reason not to — it's a recognized standard, not a proprietary format, which helps API consumers and tooling (like OpenAPI generators) that already understand it.
- Keep one handler method per logical *category* of error, using the exception hierarchy to collapse related exceptions into a single method rather than one method per concrete class.
- Always include a catch-all `@ExceptionHandler(Exception.class)` as a safety net, logging full details server-side while returning a sanitized message to the client.
- Add `setProperty(...)` extensions to `ProblemDetail` for anything your clients need beyond the RFC 7807 baseline (error codes, trace IDs, timestamps) rather than inventing a parallel custom DTO.
- Write a lightweight integration test (`@WebMvcTest` or `@SpringBootTest`) per exception type to lock in the status code and body shape as a contract.
- Log exceptions with enough context (request path, correlation/trace ID) at the point they're handled in the advice, not scattered throughout business logic.

## 10. Hands-On Exercises

1. Convert the `OrderController`'s local `@ExceptionHandler(ResourceNotFoundException.class)` method into a global `@RestControllerAdvice`, and confirm a second controller (e.g., `ProductController`) automatically benefits from the same handling with no code duplication.
2. Add a `@RestControllerAdvice`-based handler for `ApiException` that builds a `ProblemDetail` response, including `errorCode` and `timestamp` as extension properties.
3. Trigger a `HttpMessageNotReadableException` by POSTing malformed JSON to an endpoint, and add a dedicated handler for it that returns a 400 with a clear `"Malformed JSON request body"` message.
4. Add a catch-all `@ExceptionHandler(Exception.class)` that logs the exception and returns a generic sanitized 500 `ProblemDetail`, then deliberately throw a `NullPointerException` in a service method to confirm it's caught cleanly instead of producing a Whitelabel Error Page.
5. Write a `@WebMvcTest` for your `GlobalExceptionHandler` that mocks the service layer to throw `ResourceNotFoundException`, then asserts the response status is 404 and the body contains the expected `errorCode`.

## 11. Interview Q&A

**Q1: What is the difference between `@ExceptionHandler` defined in a controller versus one defined in a `@ControllerAdvice`?**
An `@ExceptionHandler` method defined directly inside a `@Controller`/`@RestController` class only handles exceptions thrown by handler methods within that same controller class — it has local scope. An `@ExceptionHandler` method defined inside a `@ControllerAdvice` (or `@RestControllerAdvice`) class applies globally, across every controller in the application (or a scoped subset, if `basePackages` or `annotations` attributes are used), which is why centralizing error handling logic in a `@ControllerAdvice` avoids duplicating identical handler methods across many controllers.

**Q2: What's the difference between `@ControllerAdvice` and `@RestControllerAdvice`?**
`@RestControllerAdvice` is exactly equivalent to `@ControllerAdvice` combined with `@ResponseBody`, mirroring the relationship between `@Controller`+`@ResponseBody` and `@RestController`. With plain `@ControllerAdvice`, a handler method's return value is treated as a view name or model attribute unless you add `@ResponseBody` on the method; with `@RestControllerAdvice`, every handler method's return value is automatically serialized directly into the HTTP response body (typically as JSON), which is what virtually every REST API wants.

**Q3: If a `ResourceNotFoundException` is thrown, and both the throwing controller and a global `@ControllerAdvice` define an `@ExceptionHandler` for it, which one runs?**
The controller-local handler takes precedence. Spring's `ExceptionHandlerExceptionResolver` first checks whether the specific controller that threw the exception has a matching local `@ExceptionHandler` method; only if it doesn't does Spring fall back to searching applicable `@ControllerAdvice` classes. This lets you override global handling for a specific controller when it genuinely needs different behavior, while keeping the default centralized everywhere else.

**Q4: What is `ProblemDetail` and why was it introduced in Spring Framework 6 / Spring Boot 3?**
`ProblemDetail` is Spring's implementation of RFC 7807, "Problem Details for HTTP APIs," a standardized JSON (or XML) shape for error responses with fields like `type`, `title`, `status`, `detail`, and `instance`, plus support for custom extension properties. It was introduced so that Spring Boot applications didn't each need to invent their own bespoke error DTO — using a recognized IETF standard means API consumers, client SDKs, and tooling like OpenAPI generators can reason about error responses generically, and it integrates directly with `@ExceptionHandler` methods by simply returning a `ProblemDetail` object.

**Q5: Why should a global exception handler include a catch-all `@ExceptionHandler(Exception.class)` method?**
Without a catch-all, any exception not specifically anticipated by a more specific handler (a bug causing a `NullPointerException`, an unexpected `ArithmeticException`, a third-party library's unchecked exception) falls through the entire `@ControllerAdvice` chain and is handled generically by the servlet container's default error page mechanism, producing a response with less consistency and potentially leaking more internal detail than a deliberately sanitized fallback would. A catch-all handler ensures every single error path — anticipated or not — produces the same consistent response shape, while still letting you log the full exception detail server-side for debugging.

**Q6: How does having a common `ApiException` base class simplify writing `@ExceptionHandler` methods for a large domain exception hierarchy?**
Because every concrete subclass (`ResourceNotFoundException`, `ValidationException`, `DuplicateResourceException`, etc.) already carries its own `HttpStatus` and error code set in its constructor, a single `@ExceptionHandler(ApiException.class)` method can read `ex.getStatus()` and `ex.getErrorCode()` generically and build the correct response for any of them — there's no need for a chain of `instanceof` checks or one handler method per concrete exception type. Adding a brand-new domain exception later requires zero changes to the handler at all, as long as the new exception extends `ApiException` and supplies the right status/code in its own constructor.
