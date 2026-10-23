# Request Body & ResponseEntity — Complete Guide

## Table of Contents
1. [Why Request/Response Shaping Matters](#1-why-requestresponse-shaping-matters)
2. [@RequestBody Deserialization Mechanics](#2-requestbody-deserialization-mechanics)
3. [DTOs vs Entities](#3-dtos-vs-entities)
4. [Validating Request Bodies with Bean Validation](#4-validating-request-bodies-with-bean-validation)
5. [ResponseEntity in Full Depth](#5-responseentity-in-full-depth)
6. [Content Negotiation Deep Dive](#6-content-negotiation-deep-dive)
7. [Raw Return Type vs ResponseEntity&lt;T&gt;](#7-raw-return-type-vs-responseentityt)
8. [HTTP Status Code Cheat Sheet](#8-http-status-code-cheat-sheet)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Request/Response Shaping Matters

A REST endpoint is a contract. The previous two lessons covered how Spring routes a request to the correct method and how it extracts identifiers and filters from the URL. This lesson covers the two remaining pieces of that contract: how structured data flows *into* your controller through the request body, and how you take precise, deliberate control over what flows *back out* — status code, headers, and body — via `ResponseEntity`.

```
  Client                                Spring Boot Controller
  ┌──────────────────────┐             ┌───────────────────────────┐
  │ POST /api/users        │           │                             │
  │ Content-Type: application/json     │ @PostMapping                │
  │ Accept: application/json           │ public ResponseEntity<UserDto> │
  │ {"name":"Alice",...}   │ ────────▶ │   createUser(@Valid @RequestBody│
  │                        │           │              UserCreateDto dto)│
  │                        │ ◀──────── │ return ResponseEntity          │
  │ HTTP/1.1 201 Created   │           │   .created(location)           │
  │ Location: /api/users/9 │           │   .body(savedUser);            │
  │ {"id":9,"name":...}    │           │                             │
  └──────────────────────┘             └───────────────────────────┘
```

---

## 2. @RequestBody Deserialization Mechanics

`@RequestBody` tells Spring to take the raw bytes of the incoming HTTP request body and deserialize them into a Java object, using the same `HttpMessageConverter` infrastructure introduced in Lesson 1 — but running in the opposite direction (reading instead of writing).

```java
public class UserCreateDto {
    private String name;
    private String email;

    // Jackson (via reflection) requires either a no-args constructor + setters,
    // OR a single all-args constructor annotated appropriately, OR a Java record.
    public UserCreateDto() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
```

```java
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @PostMapping
    public UserDto createUser(@RequestBody UserCreateDto dto) {
        // Spring already parsed the JSON into `dto` before this line runs.
        return userService.create(dto);
    }
}
```

```
  @RequestBody deserialization pipeline:
  ┌───────────────────────────────────────────────────────────────┐
  │ Raw request body bytes                                         │
  │                     │                                          │
  │                     ▼                                          │
  │ RequestResponseBodyMethodProcessor (an argument resolver)       │
  │ inspects Content-Type header + target parameter type            │
  │                     │                                          │
  │                     ▼                                          │
  │ Selects a matching HttpMessageConverter                        │
  │ (MappingJackson2HttpMessageConverter for application/json)      │
  │                     │                                          │
  │                     ▼                                          │
  │ Jackson's ObjectMapper.readValue(bytes, UserCreateDto.class)   │
  │  - reflectively finds a no-args constructor or matching         │
  │    all-args constructor / record components                    │
  │  - calls setters (or binds record components) for each          │
  │    matching JSON field name                                     │
  │                     │                                          │
  │                     ▼                                          │
  │ Fully populated Java object handed to the controller method    │
  └───────────────────────────────────────────────────────────────┘
```

Java records work seamlessly with Jackson as of Jackson 2.12+ (bundled by all current Spring Boot 3 versions) without any getters/setters at all, since Jackson recognizes record components directly:

```java
public record UserCreateDto(String name, String email) {}
```

If the incoming JSON contains a field with no matching property on the target class, Jackson silently ignores it by default (Spring Boot does not enable `FAIL_ON_UNKNOWN_PROPERTIES` out of the box). If the body is malformed JSON entirely, Spring throws `HttpMessageNotReadableException`, which by default surfaces as a `400 Bad Request`.

---

## 3. DTOs vs Entities

A **Data Transfer Object (DTO)** is a plain class shaped specifically for what an API endpoint needs to send or receive — it has no persistence behavior and no relationship to how data is stored. An **entity** (covered in depth in Phase 4, Spring Data JPA) is a class annotated with `@Entity` that maps directly to a database table and carries JPA-specific annotations (`@Id`, `@OneToMany`, `@Column`, lazy-loading proxies, etc.).

Exposing JPA entities directly as `@RequestBody`/return types is a well-known anti-pattern for several concrete reasons:

**Over-exposure of internal fields.** An entity might have an internal `passwordHash`, an `internalNotes` field, or audit columns (`createdBy`, `updatedAt`) that should never be visible to an API consumer, but Jackson will happily serialize every public getter unless you remember to annotate each sensitive field with `@JsonIgnore` — an easy thing to forget on a class whose primary purpose is persistence, not API shape.

**Lazy-loading serialization crashes.** JPA entities commonly use lazy-loaded associations (`@OneToMany(fetch = FetchType.LAZY)`). If Jackson tries to serialize such an entity outside of an active persistence session/transaction, it throws a `LazyInitializationException` — a notoriously confusing runtime error that has nothing to do with your controller code directly.

**Coupling your API contract to your database schema.** If your API returns entities directly, every database migration (renaming a column, splitting a table, adding a new relationship) becomes a potential breaking change to every API consumer. A DTO layer decouples "what the database looks like" from "what the API promises," letting each evolve independently.

**Accepting entities as input allows over-posting attacks.** If a client can `@RequestBody` directly into an entity with an `isAdmin` field, a malicious client could include `"isAdmin": true` in a user-registration payload and elevate their own privileges, simply because the entity happened to expose a settable field that was never meant to be client-controlled. A DTO with only the fields the endpoint actually intends to accept closes this door structurally.

```java
// DTO — shape for the API contract only
public record UserCreateDto(String name, String email) {}

// Entity — shape for persistence only (Phase 4 covers this fully)
// @Entity
// public class User {
//     @Id @GeneratedValue Long id;
//     String name;
//     String email;
//     String passwordHash;      // must NEVER be serialized to a client
//     Instant createdAt;
// }
```

The controller's job is to translate between the two — accept a DTO, map it to (or use it to construct/update) an entity inside the service layer, and map the saved entity back to a response DTO before returning it. This mapping is usually hand-written for a couple of fields, or done with a library like MapStruct once the number of fields grows.

---

## 4. Validating Request Bodies with Bean Validation

Bean Validation constraints on a DTO's fields, combined with `@Valid` on the controller parameter, give you declarative input validation with almost no boilerplate.

```java
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserCreateDto(
    @NotBlank(message = "name is required")
    @Size(min = 2, max = 50, message = "name must be between 2 and 50 characters")
    String name,

    @NotBlank(message = "email is required")
    @Email(message = "email must be a valid email address")
    String email
) {}
```

```java
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @PostMapping
    public UserDto createUser(@Valid @RequestBody UserCreateDto dto) {
        // If validation fails, this line never executes —
        // Spring throws MethodArgumentNotValidException BEFORE the method body runs.
        return userService.create(dto);
    }
}
```

When any constraint fails, Spring throws `MethodArgumentNotValidException` and, without any custom handling, produces a default `400 Bad Request` response containing Spring's built-in error structure (field errors, messages, rejected values). In a real application you almost always want a consistent, custom-shaped error body across the whole API — that is the job of a global `@ExceptionHandler` inside a `@ControllerAdvice` class, which intercepts `MethodArgumentNotValidException` (and other exception types) and maps them to your own JSON error format. That full mechanism is the subject of Phase 6 (Exception Handling); this lesson only needs you to recognize that `@Valid` failures raise this specific exception type, and that its handling is centralized rather than written per-controller.

```
  @Valid @RequestBody validation flow:
  ┌───────────────────────────────────────────────────────────────┐
  │ 1. Body deserialized into DTO (HttpMessageConverter/Jackson)   │
  │ 2. @Valid triggers Bean Validation against the DTO's           │
  │    constraint annotations (@NotBlank, @Email, @Size, ...)      │
  │ 3a. All constraints pass  → controller method body executes   │
  │ 3b. Any constraint fails  → MethodArgumentNotValidException    │
  │     thrown BEFORE the method body runs                         │
  │     → (Phase 6) @ControllerAdvice maps this to a 400 response │
  └───────────────────────────────────────────────────────────────┘
```

---

## 5. ResponseEntity in Full Depth

`ResponseEntity<T>` represents the complete HTTP response — status line, headers, and body — giving you explicit, fine-grained control that a raw return type cannot.

### Constructing directly

```java
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@GetMapping("/{id}")
public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
    UserDto user = userService.findByIdOrNull(id);
    if (user == null) {
        return new ResponseEntity<>(HttpStatus.NOT_FOUND); // 404, empty body
    }
    return new ResponseEntity<>(user, HttpStatus.OK); // 200, body = user
}
```

### The builder API (preferred in modern code)

```java
@GetMapping("/{id}")
public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
    return userService.findById(id)                       // Optional<UserDto>
            .map(ResponseEntity::ok)                        // 200 OK + body
            .orElseGet(() -> ResponseEntity.notFound().build()); // 404, no body
}
```

| Builder method | Result |
|---|---|
| `ResponseEntity.ok(body)` | `200 OK` with the given body |
| `ResponseEntity.ok().build()` | `200 OK` with no body |
| `ResponseEntity.notFound().build()` | `404 Not Found`, no body |
| `ResponseEntity.noContent().build()` | `204 No Content`, no body |
| `ResponseEntity.badRequest().body(errors)` | `400 Bad Request` with a body |
| `ResponseEntity.status(HttpStatus.CONFLICT).body(msg)` | Any explicit status with a body |
| `ResponseEntity.created(uri).body(saved)` | `201 Created` with a `Location` header set to `uri` and the created resource as body |

### Setting headers explicitly

```java
import org.springframework.http.HttpHeaders;
import java.net.URI;

@PostMapping
public ResponseEntity<UserDto> createUser(@Valid @RequestBody UserCreateDto dto) {
    UserDto saved = userService.create(dto);
    URI location = URI.create("/api/users/" + saved.id());

    return ResponseEntity
            .created(location)                       // sets status 201 + Location header
            .header("X-Resource-Version", "1")        // arbitrary custom header
            .body(saved);
}
```

Or building an `HttpHeaders` object manually for more complex cases:

```java
@GetMapping("/{id}/export")
public ResponseEntity<byte[]> exportUser(@PathVariable Long id) {
    byte[] csvBytes = userService.exportAsCsv(id);

    HttpHeaders headers = new HttpHeaders();
    headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=user-" + id + ".csv");

    return ResponseEntity
            .status(HttpStatus.OK)
            .headers(headers)
            .contentType(org.springframework.http.MediaType.parseMediaType("text/csv"))
            .body(csvBytes);
}
```

The builder API (`ResponseEntity.status(...)/.ok(...)/.created(...)` etc.) is generally preferred over the constructor forms in modern Spring code because it reads more fluently and makes the intended semantics (created vs ok vs notFound) explicit at the call site rather than requiring the reader to map an `HttpStatus` enum constant to its meaning.

---

## 6. Content Negotiation Deep Dive

Building on the basics from Lesson 1, content negotiation for request *and* response bodies hinges on four things working together: the client's `Content-Type` header (what format the request body is actually in), the client's `Accept` header (what format the client wants back), the handler's `consumes`/`produces` attributes (what the server declares it will accept/return), and the set of `HttpMessageConverter`s registered on the classpath.

```
  Full negotiation picture:
  ┌─────────────────────────────────────────────────────────────────┐
  │ Request arrives with:                                            │
  │   Content-Type: application/json     ← format of the BODY sent   │
  │   Accept: application/json           ← format client WANTS back  │
  │                                                                    │
  │ Handler declares (optional):                                     │
  │   consumes = "application/json"      ← what it accepts as input  │
  │   produces = "application/json"      ← what it promises to return│
  │                                                                    │
  │ HttpMessageConverters registered on classpath:                    │
  │   MappingJackson2HttpMessageConverter (JSON)                     │
  │   [MappingJackson2XmlHttpMessageConverter if XML dep present]    │
  │                                                                    │
  │ Spring intersects all of the above to pick a converter for        │
  │ BOTH reading the request body AND writing the response body      │
  └─────────────────────────────────────────────────────────────────┘
```

**When negotiation fails on the way in** — the client sends a `Content-Type` the handler's `consumes` (or the available converters) cannot read — Spring returns `415 Unsupported Media Type`. This happens, for example, if a client sends `Content-Type: text/plain` with a JSON-shaped body to an endpoint whose `@PostMapping` declares `consumes = "application/json"`, or omits `Content-Type` entirely against a strict server configuration.

**When negotiation fails on the way out** — the client's `Accept` header cannot be satisfied by any converter (intersected with the handler's `produces`) — Spring returns `406 Not Acceptable`. This happens, for example, if a client sends `Accept: application/xml` to a JSON-only API with no XML converter registered.

```java
@PostMapping(value = "/import", consumes = "application/json", produces = "application/json")
public ResponseEntity<ImportResultDto> importData(@RequestBody ImportPayload payload) {
    // Sending Content-Type: text/xml here → 415 Unsupported Media Type
    // Sending Accept: application/xml here → 406 Not Acceptable
    return ResponseEntity.ok(importService.process(payload));
}
```

Most APIs never see `415`/`406` in practice because virtually every client and server defaults to JSON, but understanding the mechanism is essential for diagnosing the rare cases where a client library sets an unexpected default `Accept` header (some HTTP client libraries default to `Accept: */*`, which is always satisfiable, while others default to something more specific).

---

## 7. Raw Return Type vs ResponseEntity&lt;T&gt;

```java
// Option A: raw return type
@GetMapping("/{id}")
public UserDto getUser(@PathVariable Long id) {
    return userService.findById(id); // Spring ALWAYS responds 200 OK, unless an exception is thrown
}

// Option B: ResponseEntity<T>
@GetMapping("/{id}")
public ResponseEntity<UserDto> getUser(@PathVariable Long id) {
    return userService.findByIdOptional(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build()); // explicit 404 possible
}
```

When a controller method returns a raw object (not wrapped in `ResponseEntity`), Spring MVC always responds with `200 OK` on success — there is no way to express "not found" or "created" through the return value itself; you would have to throw an exception and rely on exception-handling machinery (Phase 6) to translate that exception into a different status code. `ResponseEntity<T>` gives you that control directly, in the method body, without needing an exception at all.

| | Raw return type | `ResponseEntity<T>` |
|---|---|---|
| Default success status | Always `200 OK` (or `204` for `void`) | Whatever you explicitly set |
| Expressing "not found" | Must throw an exception, handled elsewhere | `return ResponseEntity.notFound().build()` directly |
| Setting custom headers | Not possible without a separate mechanism | `.header(...)`/`.headers(...)` |
| Code verbosity | Minimal | Slightly more verbose |
| Best suited for | Simple, always-succeeds endpoints (rare in real APIs) | Anything needing conditional status codes — the vast majority of real REST endpoints |

The practical guideline: use a raw return type only for the simplest of endpoints where a non-200 outcome would always be represented by a thrown exception anyway (and centrally handled by `@ControllerAdvice`). Use `ResponseEntity<T>` whenever a single method needs to express more than one possible success/failure shape directly in its own logic — most create/update/delete endpoints, and any read endpoint that can legitimately return "not found."

---

## 8. HTTP Status Code Cheat Sheet

| Status | Meaning | Typical REST scenario |
|---|---|---|
| `200 OK` | Generic success | Successful GET, successful PUT/PATCH returning the updated resource |
| `201 Created` | Resource created | Successful POST that creates a new resource; pair with a `Location` header |
| `204 No Content` | Success, nothing to return | Successful DELETE; sometimes PUT when you choose not to return the updated body |
| `400 Bad Request` | Malformed or unparseable request | Invalid JSON body, failed type conversion on a path/query param, failed Bean Validation |
| `404 Not Found` | Resource does not exist | GET/PUT/DELETE on an ID that isn't in the database |
| `409 Conflict` | Request conflicts with current state | Creating a resource that violates a uniqueness constraint (e.g., duplicate email), optimistic-locking version mismatch |
| `422 Unprocessable Entity` | Syntactically valid but semantically invalid | Body parses fine and passes basic validation, but violates a business rule (e.g., "end date before start date") — some teams use `400` for this instead; pick one convention and stay consistent |
| `406 Not Acceptable` | Can't satisfy the `Accept` header | Client asked for a representation format the server can't produce |
| `415 Unsupported Media Type` | Can't read the `Content-Type` | Client sent a body format the server can't parse |
| `500 Internal Server Error` | Unhandled server-side failure | An uncaught exception — should be rare in a well-designed API with centralized exception handling |

```java
// Illustrating several of these in one controller
@PostMapping
public ResponseEntity<UserDto> createUser(@Valid @RequestBody UserCreateDto dto) {
    if (userService.emailExists(dto.email())) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(null); // 409
    }
    UserDto saved = userService.create(dto);
    return ResponseEntity.created(URI.create("/api/users/" + saved.id())).body(saved); // 201
}

@DeleteMapping("/{id}")
public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
    if (!userService.exists(id)) {
        return ResponseEntity.notFound().build(); // 404
    }
    userService.delete(id);
    return ResponseEntity.noContent().build(); // 204
}
```

---

## 9. Common Pitfalls

**Exposing JPA entities directly as request/response types.** As covered in Section 3, this leaks internal fields, risks `LazyInitializationException`, couples the API contract to the schema, and opens the door to over-posting attacks. Always route through a dedicated DTO, even when it initially feels like duplicated boilerplate for a handful of fields.

**Forgetting `@Valid` and assuming Bean Validation annotations on a DTO "just work."** Constraint annotations (`@NotBlank`, `@Email`, etc.) on a DTO's fields are inert unless the controller parameter is also annotated with `@Valid` (or `@Validated`). Without it, an invalid payload sails straight through to your service layer with no validation having occurred at all.

**Returning `200 OK` for everything, including failures, by always using a raw return type.** If a method that returns a raw `UserDto` needs to signal "not found," developers sometimes resort to returning `null` — which Spring serializes as an empty body with status `200 OK`, actively misleading any client or monitoring tool that inspects the status code. Use `ResponseEntity` (or a properly handled exception) instead of ever returning `null` from a success-shaped method.

**Confusing `consumes` and `produces`.** `consumes` restricts what content types the endpoint will accept as *input* (affects `415`); `produces` restricts what it promises for *output* (affects `406`). Setting only one when you meant the other is a very easy mix-up, especially since both attributes accept the same MIME-type string syntax.

**Forgetting the `Location` header on `201 Created` responses.** The HTTP spec expects a `201` response to include a `Location` header pointing at the newly created resource's URL. `ResponseEntity.created(uri)` does this for you automatically — using `ResponseEntity.status(HttpStatus.CREATED).body(saved)` instead technically returns the right status code but omits this expected header unless you add it manually.

**Assuming Jackson will fail loudly on typos in JSON field names.** By default, Spring Boot's Jackson configuration does not fail on unknown JSON properties — a client typo like `"emial"` instead of `"email"` is silently dropped rather than causing a validation error, which means the corresponding DTO field simply stays `null` (and then, if `@NotBlank`/`@NotNull` is present, THAT constraint correctly catches the resulting null — but only if such a constraint exists on that field).

---

## 10. Best Practices

Always accept and return dedicated DTOs at the controller boundary — never let a `@RequestBody` or return type be an `@Entity`-annotated class, even in a small prototype, since the anti-pattern tends to calcify once other code starts depending on the entity shape being exposed.

Pair every `@RequestBody` parameter that needs input validation with `@Valid`, and put the actual constraint annotations (`@NotBlank`, `@Email`, `@Size`, etc.) on the DTO's fields rather than re-validating manually inside the controller or service.

Use `ResponseEntity<T>` as the default return type for any endpoint that can have more than one success/failure outcome — which in practice is most create, update, delete, and single-resource-read endpoints; reserve raw return types for the rare endpoint that truly always succeeds the same way.

Always set the `Location` header on `201 Created` responses using `ResponseEntity.created(uri)` rather than constructing the status manually, so API consumers get a spec-compliant response they can follow directly.

Pick one convention for "syntactically valid but business-rule-invalid" data (either `400` or `422`) and apply it consistently across the whole API rather than mixing both per-developer preference — inconsistency here is one of the most common complaints from API consumers integrating against a team's endpoints.

Keep the mapping between DTOs and entities in a well-defined place (a mapper class, or a small static factory method) rather than scattering manual field-by-field copying across every controller method, so the translation logic is easy to find and test in isolation.

---

## 11. Hands-On Exercises

**Exercise 1:** Create a `UserCreateDto` record with `name` and `email` fields, add `@NotBlank` and `@Email` constraints, and wire up a `POST /api/users` endpoint using `@Valid @RequestBody`. Test three cases with `curl -X POST -H "Content-Type: application/json" -d '...'`: a fully valid payload (expect `201`), a payload with a blank name (expect a `400` with Spring's default validation error body — inspect its structure), and a payload with an invalid email format like `"not-an-email"` (expect the same `400` shape, but for the email constraint).

**Exercise 2:** Implement `GET /api/users/{id}` using `ResponseEntity<UserDto>` and an in-memory `Map<Long, UserDto>` as your data store. Return `ResponseEntity.ok(user)` when found and `ResponseEntity.notFound().build()` when not. Verify with `curl -i` (to see status + headers) that an existing ID returns `200` with a JSON body, and a nonexistent ID returns `204`... — actually verify it correctly returns `404` with an empty body, and explicitly note in a comment why `204` would be the wrong choice here (hint: `204` implies success with intentionally no content, not "does not exist").

**Exercise 3:** Implement `POST /api/users` so that it returns `409 Conflict` when the submitted email already exists in your in-memory store, and `201 Created` with a `Location` header (via `ResponseEntity.created(uri)`) otherwise. Use `curl -i` to submit the same email twice and confirm the second attempt returns `409`, then inspect the `Location` header on the first (successful) response and confirm following it with a `GET` returns the same user you just created.

**Exercise 4:** Deliberately trigger and observe a `415 Unsupported Media Type`: declare a `POST` endpoint with `consumes = "application/json"`, then send a request with `curl -X POST -H "Content-Type: text/plain" -d 'hello'` and confirm the exact status code returned. Then deliberately trigger a `406 Not Acceptable`: on a `GET` endpoint with `produces = "application/json"` (and no other converters registered), send a request with `curl -H "Accept: application/xml"` and confirm the resulting status code. Record both raw HTTP responses.

**Exercise 5:** Build a small `User` "entity-like" class with a field that should never reach the client (e.g., `passwordHash`) alongside `name` and `email`. Write one endpoint that (incorrectly) returns this class directly, and confirm via `curl` that `passwordHash` appears in the JSON response. Then refactor to introduce a proper `UserResponseDto` (without `passwordHash`) that the controller maps to before returning, and confirm the field is no longer present. Write a one-paragraph comment in the code explaining, in your own words, why this matters beyond just this one field (over-posting, schema coupling, lazy-loading risk).

---

## 12. Interview Q&A

**Q: What is the mechanism behind `@RequestBody`, and what happens step by step when a request arrives?**
Answer: `@RequestBody` is resolved by `RequestResponseBodyMethodProcessor`, an argument resolver that inspects the request's `Content-Type` header and the target parameter's declared type to select a matching `HttpMessageConverter` — for JSON, this is `MappingJackson2HttpMessageConverter`, which delegates to Jackson's `ObjectMapper.readValue()`. Jackson reflectively locates a no-args constructor plus setters, a matching all-args constructor, or (for records) the record's canonical constructor, and populates the object field-by-field from matching JSON keys. If the body is malformed or unreadable, Spring throws `HttpMessageNotReadableException`, resulting in a `400 Bad Request` by default; if the `Content-Type` cannot be handled by any registered converter or the handler's `consumes` restriction, Spring instead returns `415 Unsupported Media Type` before deserialization is even attempted.

**Q: Why shouldn't you return a JPA `@Entity` directly from a REST controller?**
Answer: Doing so risks leaking internal/sensitive fields that were never meant for client consumption unless every one is manually annotated `@JsonIgnore`, and it risks a `LazyInitializationException` when Jackson tries to serialize a lazily-loaded association outside of an active persistence context. It also tightly couples your public API contract to your database schema, so an internal migration (renaming a column, restructuring a relationship) becomes a breaking API change for every consumer. Finally, accepting entities as `@RequestBody` input opens the door to over-posting attacks, where a client sets a field (like an internal `isAdmin` flag) that was never intended to be client-controllable; a purpose-built DTO structurally prevents this because it simply has no such field to bind into.

**Q: What is the practical difference between returning a raw object from a controller method and returning a `ResponseEntity<T>`?**
Answer: A raw return type always results in an HTTP `200 OK` (or `204` for `void`) on success, with no way to express alternate outcomes like "not found" or "created" through the return value itself — those would require throwing an exception and relying on separate exception-handling infrastructure. `ResponseEntity<T>` represents the entire response explicitly — status code, headers, and body — letting a single method express multiple possible outcomes (e.g., `200` when found, `404` when not) directly in its own control flow, and letting you set custom headers like `Location` or `X-Resource-Version` that a raw return type has no mechanism for at all.

**Q: What's the difference between `400`, `404`, `409`, and `422` and when would you use each in a REST API?**
Answer: `400 Bad Request` indicates the request itself is malformed or fails basic validation — bad JSON, a failed type conversion, or a Bean Validation constraint violation on a field. `404 Not Found` indicates the request was well-formed but the specific resource referenced (usually by a path variable ID) does not exist. `409 Conflict` indicates the request is well-formed and the resource may exist, but fulfilling it would conflict with the current state of the system — a classic example is attempting to create a resource that violates a uniqueness constraint, like a duplicate email address. `422 Unprocessable Entity` is used by some APIs for requests that are syntactically valid and pass basic field-level validation but violate a business rule (like an end date preceding a start date); other teams fold this case into `400` instead, and the important thing is picking one convention and applying it consistently across the whole API.

**Q: How does content negotiation differ for the request body versus the response body, and what status codes result from each type of failure?**
Answer: For the request body, negotiation is governed by the `Content-Type` header the client actually sends versus the handler's `consumes` attribute and the set of converters capable of reading that content type; a mismatch results in `415 Unsupported Media Type`. For the response body, negotiation is governed by the client's `Accept` header versus the handler's `produces` attribute and the set of converters capable of writing a matching representation; a mismatch results in `406 Not Acceptable`. Both directions rely on the same underlying `HttpMessageConverter` abstraction, just used for reading in one case and writing in the other, and Spring Boot autoconfigures a JSON converter for both directions by default as soon as Jackson is on the classpath.

**Q: Where should Bean Validation failures on a `@RequestBody` DTO ultimately be handled, and why not just check the fields manually in the controller?**
Answer: A `@Valid @RequestBody` failure throws `MethodArgumentNotValidException` before the controller method body ever executes, and the idiomatic place to translate that into a consistent, custom-shaped error response across the entire API is a centralized `@ExceptionHandler` inside a `@ControllerAdvice` class, covered fully in Phase 6. Manually checking fields inside each controller method would mean re-implementing the same validation logic (and its error formatting) in every single endpoint, producing inconsistent error shapes across the API and defeating the entire purpose of declarative Bean Validation constraints, whose value comes precisely from being checked automatically and uniformly before your business logic ever runs.
