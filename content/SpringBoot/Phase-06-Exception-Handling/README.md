# Phase 6: Exception Handling & Validation

## What You'll Learn
How Spring Boot applications turn Java exceptions and invalid input into clean, consistent HTTP error responses. You'll learn Java's checked vs. unchecked exception model and why Spring favors unchecked exceptions, how to design a custom exception hierarchy for your domain, how the DispatcherServlet resolves exceptions by default, and how to take full control of error handling with `@ExceptionHandler` and `@ControllerAdvice`. You'll also learn Bean Validation (`jakarta.validation`) to reject bad input before it ever reaches your service layer, how to write custom validators, and how to shape structured, RFC 7807-compliant error payloads that API consumers can rely on.

## Learning Objectives
- Distinguish checked vs. unchecked exceptions and explain why Spring Boot favors unchecked exceptions for business errors
- Design a custom exception hierarchy (`ApiException`, `ResourceNotFoundException`, `ValidationException`, etc.)
- Explain how an uncaught exception becomes an HTTP 500 and how the DispatcherServlet's `HandlerExceptionResolver` chain works
- Use `@ExceptionHandler` at the controller level for local error handling
- Use `@ControllerAdvice` / `@RestControllerAdvice` to centralize exception handling across all controllers
- Build error responses using Spring Boot 3.x's `ProblemDetail` (RFC 7807)
- Apply Bean Validation annotations (`@NotNull`, `@Size`, `@Email`, `@Valid`) to request DTOs
- Handle `MethodArgumentNotValidException` and extract field-level validation errors into a structured response
- Write a custom constraint annotation with `@Constraint` and `ConstraintValidator`
- Validate nested objects inside a request DTO with cascading `@Valid`

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Exception-Handling-Fundamentals.md](01-Exception-Handling-Fundamentals.md) | Exception Handling Fundamentals — Checked vs. Unchecked, Custom Hierarchies, DispatcherServlet Resolution | 1 day |
| [02-ControllerAdvice-and-ExceptionHandler.md](02-ControllerAdvice-and-ExceptionHandler.md) | @ControllerAdvice & @ExceptionHandler — Global Error Handling and ProblemDetail | 1 day |
| [03-Validation-and-Error-Responses.md](03-Validation-and-Error-Responses.md) | Validation & Error Responses — Bean Validation, Custom Validators, Structured Errors | 1 day |

## Estimated Time
2 days

## Previous Phase
→ [Phase 5: Service and Transactions](../Phase-05-Service-and-Transactions/README.md)

## Next Phase
→ [Phase 7: Spring Security](../Phase-07-Spring-Security/README.md)
