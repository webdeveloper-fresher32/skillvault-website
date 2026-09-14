# Validation & Error Responses — Complete Guide

## Table of Contents
1. [Why Validate at the Boundary](#1-why-validate-at-the-boundary)
2. [Bean Validation and jakarta.validation](#2-bean-validation-and-jakartavalidation)
3. [Common Validation Annotations](#3-common-validation-annotations)
4. [Triggering Validation with @Valid](#4-triggering-validation-with-valid)
5. [MethodArgumentNotValidException and Field-Level Errors](#5-methodargumentnotvalidexception-and-field-level-errors)
6. [Nested Object Validation](#6-nested-object-validation)
7. [Custom Validators with @Constraint](#7-custom-validators-with-constraint)
8. [Worked Example: Validating a Nested Request DTO](#8-worked-example-validating-a-nested-request-dto)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Validate at the Boundary

Every field in an incoming request body is, from the server's point of view, untrusted input. A `null` email, a negative price, a 500-character username, a malformed phone number — none of these should ever reach a service method, a repository, or a database constraint. If they do, you either get a confusing downstream failure (a `DataIntegrityViolationException` from a database `NOT NULL` constraint, three layers away from where the bad data entered) or, worse, silently corrupted data.

```text
   Bad Input                          Good Input
       │                                   │
       ▼                                   ▼
┌─────────────┐                    ┌─────────────┐
│  Controller  │◄── @Valid rejects │  Controller  │
│  boundary    │    invalid DTOs   │  boundary    │
└─────────────┘    before this     └──────┬──────┘
       │           point is reached        │
       ▼                                   ▼
   400 response                     Service / Repository
   (no further                      (only ever sees
   processing)                       validated data)
```

Bean Validation lets you declare these rules **directly on the DTO** as annotations, and have Spring MVC enforce them automatically at the controller boundary — before a single line of your business logic runs.

## 2. Bean Validation and jakarta.validation

**Bean Validation** is a Java specification (JSR 380, now under the Jakarta EE umbrella as `jakarta.validation`) that defines a standard set of annotations and an API for validating Java objects. Spring Boot auto-configures this whenever you include the `spring-boot-starter-validation` dependency, which pulls in Hibernate Validator (the reference implementation) as the actual constraint-checking engine.

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

Note: `spring-boot-starter-web` alone does **not** include Bean Validation in Spring Boot 3.x — the validation starter must be added explicitly. This trips up many teams migrating from Spring Boot 2.x setups where it was sometimes bundled transitively.

## 3. Common Validation Annotations

| Annotation | Applies To | Effect |
|---|---|---|
| `@NotNull` | Any type | Value must not be `null` |
| `@NotEmpty` | String, Collection, Map, Array | Must not be `null` and must not be empty |
| `@NotBlank` | String | Must not be `null`, and trimmed length must be > 0 |
| `@Size(min=, max=)` | String, Collection, Array | Length/size must fall within bounds |
| `@Min` / `@Max` | Numeric types | Numeric value must be ≥ / ≤ given bound |
| `@Positive` / `@PositiveOrZero` | Numeric types | Value must be strictly positive / non-negative |
| `@Email` | String | Must match a valid email address pattern |
| `@Pattern(regexp=)` | String | Must match the given regular expression |
| `@Past` / `@Future` | Date/time types | Must be in the past / future |
| `@Valid` | Object references, collections | Cascades validation into a nested object |

```java
package com.skillvault.orders.dto;

import jakarta.validation.constraints.*;

public record CreateCustomerRequest(
    @NotBlank(message = "Full name is required")
    @Size(max = 100, message = "Full name must not exceed 100 characters")
    String fullName,

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be a valid email address")
    String email,

    @NotNull(message = "Age is required")
    @Min(value = 18, message = "Customer must be at least 18 years old")
    Integer age,

    @Pattern(regexp = "^\\+?[0-9]{7,15}$", message = "Phone number must be 7-15 digits, optionally prefixed with +")
    String phoneNumber
) {}
```

## 4. Triggering Validation with @Valid

Annotations alone don't do anything — Spring MVC only runs the validator when a controller method parameter is marked with `@Valid` (or `@Validated`, Spring's variant that additionally supports validation groups).

```java
package com.skillvault.orders.controller;

import com.skillvault.orders.dto.CreateCustomerRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    @PostMapping
    public ResponseEntity<String> createCustomer(@Valid @RequestBody CreateCustomerRequest request) {
        // If we reach this line, `request` has ALREADY passed every constraint above.
        // No manual null-checks or if-statements needed here.
        return ResponseEntity.status(HttpStatus.CREATED).body("Customer created: " + request.fullName());
    }
}
```

The mechanism: Spring MVC's `RequestResponseBodyMethodProcessor` sees the `@Valid` annotation on the parameter, runs the object through the configured `jakarta.validation.Validator` (Hibernate Validator), and — if any constraint fails — throws `MethodArgumentNotValidException` **before the controller method body ever executes**. Your `createCustomer` method body only ever runs with a fully valid `request`.

## 5. MethodArgumentNotValidException and Field-Level Errors

`MethodArgumentNotValidException` carries a `BindingResult` (accessible via `getBindingResult()`) containing one `FieldError` per failed constraint, including the field name, the rejected value, and the violation message. Left unhandled, this exception — like any other — collapses to a generic response; Spring Boot's default handling actually maps it to a 400, but with a raw, deeply-nested body that's inconvenient for clients to parse. A dedicated handler in the global `@ControllerAdvice` extracts it into a clean, field-keyed structure.

```java
package com.skillvault.orders.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ValidationExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidationErrors(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, "One or more fields failed validation"
        );
        problem.setTitle("Validation Failed");
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("errorCode", "VALIDATION_FAILED");
        problem.setProperty("timestamp", Instant.now());
        problem.setProperty("fieldErrors", fieldErrors);
        return problem;
    }
}
```

Given the `CreateCustomerRequest` from section 3, POSTing `{"fullName": "", "email": "not-an-email", "age": 15}` now produces:

```json
{
  "type": "about:blank",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more fields failed validation",
  "instance": "/api/customers",
  "errorCode": "VALIDATION_FAILED",
  "timestamp": "2026-07-13T09:30:02.774Z",
  "fieldErrors": {
    "fullName": "Full name is required",
    "email": "Email must be a valid email address",
    "age": "Customer must be at least 18 years old"
  }
}
```

This is dramatically more useful to a frontend than a generic message — the client can highlight the exact form fields that failed and display the exact reason next to each one.

## 6. Nested Object Validation

`@Valid` **cascades**: when placed on a field whose type is itself an object with its own Bean Validation annotations, the nested object's constraints are validated too. Without cascading, only the top-level object's own annotations would be checked; a nested object's `@NotBlank` fields would be silently ignored.

```java
package com.skillvault.orders.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateOrderRequest(
    @NotBlank(message = "Reference code is required")
    String referenceCode,

    @NotNull(message = "Shipping address is required")
    @Valid                       // <-- cascades validation into ShippingAddress
    ShippingAddress shippingAddress
) {}
```

```java
package com.skillvault.orders.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ShippingAddress(
    @NotBlank(message = "Street is required")
    String street,

    @NotBlank(message = "City is required")
    String city,

    @Pattern(regexp = "^[0-9]{5,6}$", message = "Postal code must be 5-6 digits")
    String postalCode
) {}
```

Without `@Valid` on the `shippingAddress` field, an empty `street` or malformed `postalCode` inside it would pass validation silently — Bean Validation never descends into a nested object unless explicitly told to.

## 7. Custom Validators with @Constraint

Built-in annotations cover most cases, but business-specific rules (a SKU format, a currency code from an allowed set, a password meeting several combined rules) need a **custom constraint**. This requires two pieces: the annotation itself, and a `ConstraintValidator` implementing the checking logic.

```java
// ValidCurrencyCode.java — the custom annotation
package com.skillvault.orders.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = CurrencyCodeValidator.class)
public @interface ValidCurrencyCode {

    String message() default "must be a supported ISO 4217 currency code (USD, EUR, GBP, AUD)";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
```

```java
// CurrencyCodeValidator.java — the checking logic
package com.skillvault.orders.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.Set;

public class CurrencyCodeValidator implements ConstraintValidator<ValidCurrencyCode, String> {

    private static final Set<String> SUPPORTED_CURRENCIES = Set.of("USD", "EUR", "GBP", "AUD");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return true; // let @NotNull handle nullability separately
        }
        return SUPPORTED_CURRENCIES.contains(value.toUpperCase());
    }
}
```

```java
// Usage on a DTO field
public record CreateOrderRequest(
    @NotBlank String referenceCode,

    @NotBlank
    @ValidCurrencyCode
    String currencyCode,

    @Valid @NotNull ShippingAddress shippingAddress
) {}
```

Custom validators integrate seamlessly with everything already built: a failed `@ValidCurrencyCode` produces a normal `FieldError` inside `MethodArgumentNotValidException`, which the same `ValidationExceptionHandler` from section 5 extracts into the `fieldErrors` map with no additional handler code required.

## 8. Worked Example: Validating a Nested Request DTO

Bringing sections 3, 4, 6, and 7 together — a complete `CreateOrderRequest` with top-level constraints, a custom validator, and cascading nested validation:

```java
// CreateOrderRequest.java
package com.skillvault.orders.dto;

import com.skillvault.orders.validation.ValidCurrencyCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateOrderRequest(
    @NotBlank(message = "Reference code is required")
    String referenceCode,

    @NotNull(message = "Total amount is required")
    @Positive(message = "Total amount must be greater than zero")
    Double totalAmount,

    @NotBlank(message = "Currency code is required")
    @ValidCurrencyCode
    String currencyCode,

    @NotNull(message = "Shipping address is required")
    @Valid
    ShippingAddress shippingAddress
) {}
```

```java
// OrderController.java
package com.skillvault.orders.controller;

import com.skillvault.orders.dto.CreateOrderRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @PostMapping
    public ResponseEntity<String> createOrder(@Valid @RequestBody CreateOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body("Order created: " + request.referenceCode());
    }
}
```

Submitting this invalid payload:

```json
{
  "referenceCode": "",
  "totalAmount": -50.0,
  "currencyCode": "XYZ",
  "shippingAddress": {
    "street": "",
    "city": "Sydney",
    "postalCode": "AB123"
  }
}
```

produces one combined response with errors from **both** the top-level DTO and the nested `ShippingAddress`, because `@Valid` on `shippingAddress` cascaded:

```json
{
  "type": "about:blank",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more fields failed validation",
  "instance": "/api/orders",
  "errorCode": "VALIDATION_FAILED",
  "timestamp": "2026-07-13T09:35:47.220Z",
  "fieldErrors": {
    "referenceCode": "Reference code is required",
    "totalAmount": "Total amount must be greater than zero",
    "currencyCode": "must be a supported ISO 4217 currency code (USD, EUR, GBP, AUD)",
    "shippingAddress.street": "Street is required",
    "shippingAddress.postalCode": "Postal code must be 5-6 digits"
  }
}
```

Note the `shippingAddress.street` key — `FieldError.getField()` reports nested paths using dot notation, so clients can map errors straight back to nested form sections.

## 9. Common Pitfalls

- **Forgetting `spring-boot-starter-validation`.** Without it, `@Valid` annotations are silently ignored — no exception, no validation, invalid data flows straight through, which is a dangerous silent failure.
- **Forgetting `@Valid` on a nested object field.** The nested object's own constraints (however correctly annotated) are never checked without cascading — a very common source of "why isn't this validation firing?" confusion.
- **Forgetting `@Valid` on the controller method parameter itself.** Annotating the DTO fields is not enough; validation only runs when the parameter using the DTO is marked `@Valid` (or `@Validated`).
- **Confusing `@NotNull`, `@NotEmpty`, and `@NotBlank`.** `@NotBlank` also rejects whitespace-only strings, `@NotEmpty` rejects empty-but-not-null collections/strings, and `@NotNull` only rejects `null` — using `@NotNull` on a `String` still allows an empty string `""` through.
- **Letting `MethodArgumentNotValidException` go unhandled**, relying on Spring Boot's default 400 response, which nests errors inside a verbose, inconsistent shape that's harder for clients to parse than a purpose-built handler's output.
- **Putting business-rule checks (uniqueness, cross-field consistency, external lookups) into a `ConstraintValidator`.** Bean Validation constraints should be fast, self-contained, structural checks — logic like "does this email already exist in the database" belongs in the service layer as an `ApiException`, not stuffed into a validator that now needs a repository dependency.
- **Using `@Valid` on a `List<SomeDto>` request body without confirming cascading works as expected** — Bean Validation does cascade into list elements when combined with the container object's own field annotations, but it's a frequent point of confusion in interviews and in practice.

## 10. Best Practices

- Add `spring-boot-starter-validation` explicitly in every Spring Boot 3.x project that uses `@Valid` — never assume it's transitively included.
- Put validation annotations directly on request DTOs (not domain/entity classes) so validation rules can evolve independently of persistence concerns.
- Always cascade with `@Valid` on any nested object or collection field that itself carries validation annotations.
- Give every constraint annotation an explicit, user-facing `message` — the default messages are generic and rarely appropriate to show end users directly.
- Centralize `MethodArgumentNotValidException` handling in the same global `@ControllerAdvice` used for domain exceptions, so the whole API has one consistent error response shape.
- Reserve custom `ConstraintValidator` implementations for stateless, structural checks; push anything requiring a database lookup or cross-service call into the service layer, throwing a domain exception (e.g., `DuplicateResourceException`) instead.
- Use `record` types for request DTOs where possible — they pair naturally with Bean Validation annotations on constructor components and enforce immutability once validated.
- Write a unit test for every custom `ConstraintValidator` directly (instantiate it, call `isValid` with a range of inputs) in addition to integration tests that exercise it through the full HTTP request path.

## 11. Hands-On Exercises

1. Add `spring-boot-starter-validation` to a Spring Boot 3.x project, create a `RegisterUserRequest` DTO with `@NotBlank`, `@Email`, and `@Size(min=8)` (for a password field), and wire it into a `POST /api/users` endpoint using `@Valid @RequestBody`.
2. Add a `ValidationExceptionHandler` with an `@ExceptionHandler(MethodArgumentNotValidException.class)` method that returns a `ProblemDetail` containing a `fieldErrors` map, then POST invalid data and confirm each invalid field appears with its correct message.
3. Create a nested `Address` DTO and embed it (with `@Valid`) inside a `RegisterUserRequest`. Deliberately omit the `@Valid` cascade annotation first, confirm invalid nested fields are NOT caught, then add `@Valid` back and confirm they now are.
4. Write a custom `@ValidCurrencyCode` (or similar) constraint annotation and `ConstraintValidator`, apply it to a field, and write a focused unit test that instantiates the validator directly and asserts `isValid` returns `true`/`false` for a range of inputs.
5. Submit a request with multiple simultaneous validation failures across a top-level field, a custom-constraint field, and a nested object field, and confirm the resulting response contains all of them together in one `fieldErrors` map, with the nested field reported using dot notation (e.g., `address.postalCode`).

## 12. Interview Q&A

**Q1: What is Bean Validation, and how does Spring Boot use it?**
Bean Validation is a Java specification (JSR 380, now `jakarta.validation`) defining a standard set of annotations (`@NotNull`, `@Size`, `@Email`, etc.) and an API for declaratively validating Java objects. Spring Boot integrates it via the `spring-boot-starter-validation` dependency, which brings in Hibernate Validator as the reference implementation, and Spring MVC automatically triggers validation on any controller method parameter annotated with `@Valid`, throwing `MethodArgumentNotValidException` if any constraint fails before the controller method body executes.

**Q2: What is the difference between `@NotNull`, `@NotEmpty`, and `@NotBlank`?**
`@NotNull` only rejects a `null` value — an empty string `""` or an empty collection still passes. `@NotEmpty` rejects both `null` and an empty value (empty string, empty collection, empty array), but a whitespace-only string like `"   "` would still pass since it isn't technically empty. `@NotBlank` is the strictest of the three for strings: it rejects `null`, empty strings, and strings containing only whitespace, since it checks the trimmed length is greater than zero — it's the correct choice for most human-entered text fields like names or reference codes.

**Q3: What happens if a nested object field inside a request DTO isn't annotated with `@Valid`, even though the nested object itself has Bean Validation annotations on its own fields?**
Bean Validation does not cascade into nested objects by default — it only validates the annotations declared directly on the top-level object's fields. If the field referencing the nested object lacks `@Valid`, the nested object's own constraints are silently skipped entirely; invalid data inside it (an empty required string, an out-of-range number) passes through undetected. Adding `@Valid` on that field tells the validator to recursively validate the nested object using its own annotations, and this cascading also applies to elements inside validated collections.

**Q4: How do you build a custom validation constraint, and when should you use one instead of combining existing annotations?**
A custom constraint requires two pieces: an annotation meta-annotated with `@Constraint(validatedBy = SomeValidator.class)` declaring `message()`, `groups()`, and `payload()` elements, and a class implementing `ConstraintValidator<YourAnnotation, TargetType>` with an `isValid` method containing the actual checking logic. You reach for a custom validator when a rule is domain-specific and can't be expressed by composing built-in annotations — for example, checking a value against an allowed set of currency codes, validating a checksum format, or enforcing a combination of rules that built-in annotations don't cover. Custom validators should remain fast and stateless; checks requiring a database call or external service (like uniqueness) belong in the service layer as a domain exception instead.

**Q5: What is `MethodArgumentNotValidException`, and why would you write a dedicated handler for it rather than relying on Spring Boot's default behavior?**
`MethodArgumentNotValidException` is thrown automatically by Spring MVC when an `@Valid`-annotated argument fails one or more Bean Validation constraints; it carries a `BindingResult` with a `FieldError` per failed constraint, including the field name and violation message. Spring Boot's default handling does map it to a 400 status, but the default body is a deeply nested, verbose structure not well-suited for client consumption. A dedicated `@ExceptionHandler` extracts the field errors into a clean `Map<String, String>` (or similar structure) embedded in a `ProblemDetail`, giving the client a consistent, easily parsed shape that pairs field names directly with human-readable messages — the same response contract used for every other error in the API.

**Q6: In a DTO like `CreateOrderRequest` containing a nested `ShippingAddress` with its own invalid fields, how does a `FieldError`'s field name distinguish a top-level violation from a nested one?**
Spring's `BindingResult`/`FieldError` reports nested object paths using dot notation relative to the top-level object — a violation on the `street` field inside a `shippingAddress` field is reported as `"shippingAddress.street"`, not just `"street"`. This lets a client precisely map each validation error back to the correct nested form section or object without any ambiguity, which is only possible because the validator recursively walked the object graph (via the cascading `@Valid` annotation) while still tracking the full property path from the root object.
