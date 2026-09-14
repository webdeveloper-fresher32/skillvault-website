# REST Controllers & Routing — Complete Guide

## Table of Contents
1. [The HTTP Request Lifecycle in Spring MVC](#1-the-http-request-lifecycle-in-spring-mvc)
2. [@Controller vs @RestController](#2-controller-vs-restcontroller)
3. [@RequestMapping — Full Attribute Set](#3-requestmapping--full-attribute-set)
4. [HTTP-Verb Shortcut Annotations](#4-http-verb-shortcut-annotations)
5. [Class-Level and Method-Level Path Composition](#5-class-level-and-method-level-path-composition)
6. [Content Negotiation Basics](#6-content-negotiation-basics)
7. [RESTful Resource Naming and Status Codes](#7-restful-resource-naming-and-status-codes)
8. [CORS with @CrossOrigin](#8-cors-with-crossorigin)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The HTTP Request Lifecycle in Spring MVC

Every request that hits a Spring Boot application travels through a well-defined pipeline before your controller method ever runs, and continues through another pipeline on the way out. Understanding this pipeline is the single most useful mental model for debugging routing problems, serialization issues, and "why is my endpoint returning 404/406/415" questions.

```
  Client (browser / Postman / curl)
          │
          │ HTTP request: GET /api/users/42
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Embedded Servlet Container (Tomcat, by default)             │
  │    - Accepts the TCP connection                              │
  │    - Parses the raw HTTP request into a Servlet request      │
  └─────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Filters (Servlet Filters, e.g. CharacterEncodingFilter,     │
  │  Spring Security's FilterChain, CORS filter, logging filter) │
  │    - Run BEFORE and AFTER the servlet, wrapping the request  │
  └─────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  DispatcherServlet  (the "Front Controller")                 │
  │    - The single servlet that receives ALL incoming requests  │
  │    - Registered automatically by Spring Boot autoconfig      │
  │    - Delegates the real work to a pipeline of collaborators  │
  └─────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  HandlerMapping                                              │
  │    - Inspects the request URI + HTTP method                 │
  │    - Finds the @RequestMapping-annotated method that matches │
  │    - Returns a HandlerExecutionChain (handler + interceptors)│
  └─────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  HandlerAdapter (RequestMappingHandlerAdapter)               │
  │    - Knows HOW to invoke the specific handler type           │
  │    - Delegates argument binding to HandlerMethodArgument-    │
  │      Resolvers (one per annotation type: @PathVariable,      │
  │      @RequestParam, @RequestBody, @RequestHeader, ...)       │
  └─────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Your @RestController method executes                       │
  │    - Business logic runs                                     │
  │    - Method returns a Java object (or ResponseEntity<T>)     │
  └─────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  HandlerMethodReturnValueHandler                             │
  │    - Because @ResponseBody is present (directly or via       │
  │      @RestController), the RequestResponseBodyMethodProcessor│
  │      takes over instead of resolving a view name             │
  └─────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  HttpMessageConverter negotiation (Jackson by default)       │
  │    - Selected based on the Accept header + produces          │
  │      attribute + the runtime type of the return value        │
  │    - MappingJackson2HttpMessageConverter serializes the      │
  │      Java object to JSON                                     │
  └─────────────────────────────────────────────────────────────┘
          │
          ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Response written to the Servlet response                   │
  │    - Status line, headers (Content-Type: application/json), │
  │      and body bytes flushed back through Tomcat to the       │
  │      client                                                  │
  └─────────────────────────────────────────────────────────────┘
```

A few things worth internalizing about this pipeline:

**There is exactly one DispatcherServlet per Spring MVC application context** (unless you explicitly configure more, which is rare). It is the "front controller" pattern — a single entry point that all requests funnel through, rather than each controller registering its own servlet. Spring Boot's auto-configuration (`DispatcherServletAutoConfiguration`) registers and maps it to `/` automatically when `spring-boot-starter-web` is on the classpath.

**HandlerMapping and HandlerAdapter are separated on purpose.** `HandlerMapping` only answers "which handler matches this request?" — it does not know how to call it. `HandlerAdapter` only knows how to invoke a specific *kind* of handler (annotated `@Controller` methods, in our case) once it has been found. This separation is what lets Spring MVC support multiple handler styles (annotated controllers, `HttpRequestHandler`, and functional endpoints in WebFlux) through the same DispatcherServlet.

**Argument resolvers are pluggable and composable.** Each parameter in your controller method (a `@PathVariable Long id`, a `@RequestParam String sort`, a `@RequestBody UserDto dto`) is bound by a different `HandlerMethodArgumentResolver` implementation. Spring iterates through the registered resolvers and asks each "can you handle this parameter?" until one says yes. This is why you can freely mix and match these annotations in a single method signature.

**The return-value path mirrors the argument path.** Just as arguments are resolved by `HandlerMethodArgumentResolver`s, return values are processed by `HandlerMethodReturnValueHandler`s. When `@ResponseBody` is present, `RequestResponseBodyMethodProcessor` intercepts the return value before it can be treated as a view name, and hands it to the `HttpMessageConverter` chain instead.

---

## 2. @Controller vs @RestController

Spring MVC was originally built to serve full HTML pages using a Model-View-Controller pattern, and `@Controller` is the original annotation for that use case. `@RestController` was added later as a convenience for building JSON/XML APIs, and it is built directly on top of `@Controller`.

```java
// Meta-annotation relationship (simplified):
//
// @RestController
//   = @Controller + @ResponseBody (applied to every method in the class)

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Controller
@ResponseBody
public @interface RestController {
}
```

### @Controller — view-resolution mode

When a method in an `@Controller`-annotated class returns a `String`, Spring MVC treats that string as a **logical view name**, not as response content. The `ViewResolver` (commonly `ThymeleafViewResolver` when the Thymeleaf starter is present) maps that logical name to an actual template file, renders it — usually by injecting values from a `Model` — and writes the resulting HTML to the response.

```java
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ProductPageController {

    @GetMapping("/products/{id}")
    public String showProduct(@PathVariable Long id, Model model) {
        model.addAttribute("productId", id);
        model.addAttribute("productName", "Wireless Mouse");
        // Returns a VIEW NAME, not the response body.
        // Spring resolves this to templates/products/detail.html
        return "products/detail";
    }
}
```

If you need a single JSON endpoint inside an otherwise HTML-rendering `@Controller`, you can annotate just that one method with `@ResponseBody` instead of converting the whole class to `@RestController`:

```java
@Controller
public class DashboardController {

    @GetMapping("/dashboard")
    public String dashboardPage(Model model) {
        return "dashboard"; // renders dashboard.html
    }

    @GetMapping("/dashboard/stats")
    @ResponseBody
    public StatsDto dashboardStatsJson() {
        // This ONE method bypasses view resolution and is serialized as JSON
        return new StatsDto(120, 45, 8);
    }
}
```

### @RestController — API mode

`@RestController` applies `@ResponseBody` to every method automatically, so every return value is treated as the response body to be converted (by default, to JSON via Jackson) rather than as a view name. This is the annotation you will use for essentially every endpoint in a pure REST API backend.

```java
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public UserDto getUser(@PathVariable Long id) {
        // Returned object is serialized directly to the response body as JSON.
        // There is no view resolution attempt at all.
        return new UserDto(id, "Alice", "alice@example.com");
    }
}
```

| Aspect | `@Controller` | `@RestController` |
|---|---|---|
| Return value meaning | Logical view name (unless `@ResponseBody` is added) | Response body content |
| Typical use case | Server-rendered HTML pages (Thymeleaf, JSP) | JSON/XML REST APIs |
| Needs `@ResponseBody`? | Yes, per method, to return raw data | No — implied on every method |
| Requires a `ViewResolver`? | Yes | No |
| Common in Spring Boot 3 APIs? | Rare (only for hybrid apps) | Yes — the default for API work |

A project can legally mix both: a handful of `@Controller` classes serving server-rendered admin pages alongside a majority of `@RestController` classes serving the JSON API — they simply coexist under the same `DispatcherServlet`, and the return-value handling differs per class based on the annotation and per-method `@ResponseBody` presence.

---

## 3. @RequestMapping — Full Attribute Set

`@RequestMapping` is the general-purpose routing annotation that all the HTTP-verb shortcuts (`@GetMapping`, `@PostMapping`, etc.) are themselves built from. Knowing its full attribute set lets you express routing rules the shortcuts cannot.

```java
@RequestMapping(
    value    = "/api/orders",              // or "path" — the URL pattern(s) to match
    method   = RequestMethod.POST,         // HTTP method(s); omit to match ALL methods
    consumes = "application/json",         // required Content-Type of the request body
    produces = "application/json",         // Content-Type Spring will respond with
    params   = "source=web",               // request must contain this query param/value
    headers  = "X-Api-Version=2"           // request must contain this header/value
)
public ResponseEntity<OrderDto> createOrder(@RequestBody OrderDto order) {
    // ...
}
```

| Attribute | Purpose | Example |
|---|---|---|
| `value` / `path` | URL pattern(s) to match; can be an array for multiple aliases | `{"/orders", "/orders/"}` |
| `method` | Restricts to one or more `RequestMethod` values | `RequestMethod.GET` |
| `consumes` | Restricts to requests whose `Content-Type` matches | `"application/json"` |
| `produces` | Restricts to requests whose `Accept` header matches; also sets the response `Content-Type` | `"application/json"` |
| `params` | Requires specific query parameters (with optional values) to be present | `"active=true"`, `"!archived"` |
| `headers` | Requires specific request headers (with optional values) to be present | `"X-Api-Version=2"` |

`consumes` and `produces` are especially important in real APIs because they let two methods share the exact same path and HTTP verb but be routed differently based on content type — for example, an endpoint that accepts both JSON and XML bodies via two separate handler methods.

```java
@PostMapping(value = "/import", consumes = "application/json")
public ResponseEntity<Void> importJson(@RequestBody ImportPayload payload) { /* ... */ }

@PostMapping(value = "/import", consumes = "application/xml")
public ResponseEntity<Void> importXml(@RequestBody ImportPayload payload) { /* ... */ }
```

The `params` and `headers` attributes accept simple expressions: `"myParam"` (must be present), `"!myParam"` (must be absent), `"myParam=value"` (must equal value), and `"myParam!=value"` (must not equal value).

Omitting `method` entirely means the mapping matches **every** HTTP method on that path — this is almost always a mistake in a REST API, since it means a `DELETE /api/users/42` would silently be routed to a handler you intended only for `GET`. Always constrain the method, either through `method =` or, far more commonly, through one of the verb shortcuts described next.

---

## 4. HTTP-Verb Shortcut Annotations

Since Spring 4.3, dedicated meta-annotations exist for each common HTTP verb, and they are strongly preferred over raw `@RequestMapping` in day-to-day controller code because they are shorter and communicate intent immediately.

```java
// Each of these is itself annotated with @RequestMapping(method = ...)
// e.g. @GetMapping is literally:
//
// @RequestMapping(method = RequestMethod.GET)
// public @interface GetMapping { ... }
```

| Shortcut annotation | Equivalent `@RequestMapping` | Typical semantics |
|---|---|---|
| `@GetMapping` | `method = RequestMethod.GET` | Read a resource; safe and idempotent |
| `@PostMapping` | `method = RequestMethod.POST` | Create a resource, or trigger a non-idempotent action |
| `@PutMapping` | `method = RequestMethod.PUT` | Replace a resource entirely; idempotent |
| `@PatchMapping` | `method = RequestMethod.PATCH` | Partially update a resource; not guaranteed idempotent |
| `@DeleteMapping` | `method = RequestMethod.DELETE` | Delete a resource; idempotent |

```java
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/books")
public class BookController {

    @GetMapping
    public List<BookDto> listBooks() { /* GET /api/books */ return List.of(); }

    @GetMapping("/{id}")
    public BookDto getBook(@PathVariable Long id) { /* GET /api/books/{id} */ return null; }

    @PostMapping
    public ResponseEntity<BookDto> createBook(@RequestBody BookDto book) { /* POST /api/books */ return null; }

    @PutMapping("/{id}")
    public BookDto replaceBook(@PathVariable Long id, @RequestBody BookDto book) { /* PUT /api/books/{id} */ return null; }

    @PatchMapping("/{id}")
    public BookDto updateBook(@PathVariable Long id, @RequestBody BookDto partial) { /* PATCH /api/books/{id} */ return null; }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBook(@PathVariable Long id) { /* DELETE /api/books/{id} */ return null; }
}
```

Idempotency matters beyond semantics — it drives real infrastructure decisions. GET, PUT, and DELETE are expected to be idempotent (calling them N times has the same effect as calling them once), which is why browsers, proxies, and HTTP clients feel free to retry them automatically on network failure. POST is not idempotent, so clients and intermediaries must not blindly retry a failed POST without an idempotency key, or they risk creating duplicate resources (e.g., double-charging a payment).

---

## 5. Class-Level and Method-Level Path Composition

Spring concatenates the class-level `@RequestMapping` path with each method-level mapping to produce the final route. This is the standard way to avoid repeating a resource's base path on every single method.

```java
@RestController
@RequestMapping("/api/v1/customers")     // class-level base path
public class CustomerController {

    @GetMapping                          // final path: GET /api/v1/customers
    public List<CustomerDto> listAll() { return List.of(); }

    @GetMapping("/{id}")                 // final path: GET /api/v1/customers/{id}
    public CustomerDto getOne(@PathVariable Long id) { return null; }

    @GetMapping("/{id}/orders")          // final path: GET /api/v1/customers/{id}/orders
    public List<OrderDto> getOrders(@PathVariable Long id) { return List.of(); }

    @PostMapping("/{id}/orders")         // final path: POST /api/v1/customers/{id}/orders
    public OrderDto placeOrder(@PathVariable Long id, @RequestBody OrderDto order) { return null; }
}
```

```
  Path composition:
  ┌────────────────────────────┐   ┌──────────────────┐   ┌──────────────────────────────┐
  │ Class-level @RequestMapping│ + │ Method-level path │ = │ Final matched route           │
  │ "/api/v1/customers"        │   │ "/{id}/orders"     │   │ "/api/v1/customers/{id}/orders"│
  └────────────────────────────┘   └──────────────────┘   └──────────────────────────────┘
```

You can also compose `consumes`/`produces`/`headers` at the class level, and method-level attributes narrow (never widen) what was declared on the class. A common pattern is fixing `produces = "application/json"` at the class level once, rather than repeating it on every method:

```java
@RestController
@RequestMapping(value = "/api/v1/customers", produces = "application/json")
public class CustomerController {
    // every method here defaults to producing application/json
}
```

Multiple base paths per class are also legal (`@RequestMapping({"/api/v1/customers", "/api/customers"})`), which is occasionally used to support a legacy path alongside a versioned one during a migration window.

---

## 6. Content Negotiation Basics

Content negotiation is the process by which the client and server agree on the representation format (JSON, XML, plain text, etc.) of a resource. Spring MVC negotiates this primarily through the `Accept` request header and the `produces` attribute on `@RequestMapping`.

```
  Content negotiation flow (simplified):
  ┌────────────────────────────────────────────────────────────────┐
  │ Client sends:  Accept: application/json                        │
  │                        │                                       │
  │                        ▼                                       │
  │ DispatcherServlet asks: "which HttpMessageConverter can produce │
  │ a representation of type X that also satisfies the client's    │
  │ Accept header (and, if set, the handler's produces attribute)?" │
  │                        │                                       │
  │                        ▼                                       │
  │ MappingJackson2HttpMessageConverter registered by Spring Boot   │
  │ autoconfiguration (because Jackson is on the classpath via      │
  │ spring-boot-starter-web) is selected by default                 │
  │                        │                                       │
  │                        ▼                                       │
  │ Response:  Content-Type: application/json                       │
  └────────────────────────────────────────────────────────────────┘
```

Spring Boot's `spring-boot-starter-web` transitively pulls in `jackson-databind`, and `JacksonAutoConfiguration` registers `MappingJackson2HttpMessageConverter` into the `HttpMessageConverters` list automatically — this is why JSON "just works" out of the box without any manual configuration. If you add `jackson-dataformat-xml` to the classpath, Spring will also register an XML converter, and a client sending `Accept: application/xml` will get an XML representation of the exact same returned object with zero controller code changes.

The `produces` attribute lets a handler explicitly restrict (or, when the mapping key includes multiple values, restrict-and-prioritize) which content types it is willing to serve, regardless of what other converters happen to be on the classpath:

```java
@GetMapping(value = "/{id}", produces = "application/json")
public BookDto getBook(@PathVariable Long id) {
    // Even if an XML converter is registered elsewhere in the app,
    // THIS endpoint only ever produces application/json.
    return bookService.find(id);
}
```

If a client sends an `Accept` header that no registered converter (intersected with any `produces` restriction) can satisfy, Spring MVC responds with `406 Not Acceptable`. This is one of the most confusing errors for beginners because the endpoint "exists" and the path matches — it's purely a negotiation failure, discussed further with `415 Unsupported Media Type` in the ResponseEntity lesson.

---

## 7. RESTful Resource Naming and Status Codes

A REST API's URL design should model **resources** (nouns), not actions (verbs) — the HTTP method itself already communicates the action. Consistent naming makes an API predictable and easy for consumers to guess correctly.

```
  Good:   GET    /api/orders           (collection)
          GET    /api/orders/42        (single resource)
          POST   /api/orders           (create)
          PUT    /api/orders/42        (replace)
          PATCH  /api/orders/42        (partial update)
          DELETE /api/orders/42        (delete)
          GET    /api/orders/42/items  (nested sub-collection)

  Avoid:  GET    /api/getOrder?id=42
          POST   /api/createOrder
          POST   /api/deleteOrder/42
```

| Operation | HTTP Verb | Path pattern | Typical success status |
|---|---|---|---|
| List resources | GET | `/api/resources` | `200 OK` |
| Read one resource | GET | `/api/resources/{id}` | `200 OK` |
| Create a resource | POST | `/api/resources` | `201 Created` |
| Replace a resource | PUT | `/api/resources/{id}` | `200 OK` (or `204 No Content`) |
| Partially update | PATCH | `/api/resources/{id}` | `200 OK` |
| Delete a resource | DELETE | `/api/resources/{id}` | `204 No Content` |

Plural nouns (`/orders` rather than `/order`) are the near-universal convention for collections, and nesting reflects ownership (`/customers/{id}/orders` for the orders belonging to a specific customer). Query parameters are reserved for filtering, sorting, and pagination of a collection (`/api/orders?status=SHIPPED&sort=createdAt,desc`), never for identifying a specific resource — that is what path variables are for, covered in depth in the next lesson.

Status codes deserve the same rigor as the URLs. Returning `200 OK` for a failed lookup, or `200 OK` with a manually-embedded `"success": false` JSON field, defeats the purpose of HTTP as a protocol — clients, proxies, caches, and monitoring tools all key off the actual status code. A deeper cheat sheet covering error status codes (400/404/409/422) is given in the ResponseEntity lesson, once `ResponseEntity` itself has been introduced.

---

## 8. CORS with @CrossOrigin

Cross-Origin Resource Sharing (CORS) is a browser security mechanism that blocks JavaScript running on one origin (e.g., `https://app.example.com`) from calling an API on a different origin (e.g., `https://api.example.com`) unless the server explicitly allows it via response headers. This is purely a browser-enforced restriction — it does not affect server-to-server calls, curl, or Postman.

```java
import org.springframework.web.bind.annotation.CrossOrigin;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "https://app.example.com")   // allow only this origin
public class ProductController {

    @GetMapping
    public List<ProductDto> listProducts() { return List.of(); }
}
```

`@CrossOrigin` can be applied at the class level (applies to every method) or the method level (applies to just that endpoint), and method-level settings override class-level ones for that method. Key attributes include `origins` (allowed origins), `methods` (allowed HTTP verbs), `allowedHeaders`, and `allowCredentials`.

```
  Browser CORS preflight (for non-simple requests, e.g. with a custom header):
  ┌───────────────────────────────────────────────────────────┐
  │ Browser sends OPTIONS /api/products                        │
  │   Origin: https://app.example.com                          │
  │   Access-Control-Request-Method: POST                      │
  │                       │                                    │
  │                       ▼                                    │
  │ Server (via @CrossOrigin config) responds:                 │
  │   Access-Control-Allow-Origin: https://app.example.com     │
  │   Access-Control-Allow-Methods: GET, POST                  │
  │                       │                                    │
  │                       ▼                                    │
  │ Browser only THEN sends the real POST request              │
  └───────────────────────────────────────────────────────────┘
```

For a whole application, a global `WebMvcConfigurer` bean is usually preferred over sprinkling `@CrossOrigin` across every controller, since it centralizes the policy in one place — this is covered in more depth in the Spring Security phase, where CORS interacts with authentication filters.

---

## 9. Common Pitfalls

**Forgetting `@RestController` and getting a `Whitelabel Error Page` or a `TemplateProcessingException`.** If you accidentally use `@Controller` instead of `@RestController` (or forget `@ResponseBody`), Spring interprets your returned `String` or object as a view name and tries to resolve a template for it. Without Thymeleaf configured, you get a `Whitelabel Error Page`; with Thymeleaf on the classpath, you get a confusing template-not-found exception instead of your JSON. The fix is simply using `@RestController`, or adding `@ResponseBody` to the specific method if the class is intentionally view-rendering.

**Ambiguous mapping errors from duplicate routes.** Declaring two methods with the exact same path, verb, `consumes`, and `produces` combination causes Spring to throw `IllegalStateException: Ambiguous mapping` at startup. This commonly happens when copy-pasting a method and forgetting to change its path, or when two different controllers accidentally claim the same class-level base path plus method-level path.

**Omitting the HTTP method on `@RequestMapping`.** Writing `@RequestMapping("/api/orders")` with no `method` attribute matches *every* verb — GET, POST, PUT, DELETE all route to the same method. This is rarely intended and usually surfaces as a bug where a client's `DELETE` request unexpectedly triggers "read" logic. Always use the verb shortcuts, or set `method` explicitly.

**Trailing-slash confusion.** By default Spring Boot 3 (via `PathPatternParser`) treats `/api/orders` and `/api/orders/` as different paths unless you explicitly configure otherwise, which is a change from earlier Spring Boot versions that used `AntPathMatcher` with implicit trailing-slash matching. Clients hard-coding a trailing slash can get unexpected `404`s after an upgrade; standardize on one form and document it.

**Assuming `produces` alone restricts incoming request bodies.** `produces` governs what the server sends *back*; it has nothing to do with what the server accepts as input. Developers sometimes set only `produces = "application/json"` and are surprised an XML request body still gets processed — that is `consumes`'s job, not `produces`'s.

**Returning `@ResponseBody` objects from a `@Controller` and forgetting the view side effects.** In a hybrid application with some HTML pages and some JSON endpoints, forgetting `@ResponseBody` on a JSON-returning method inside an `@Controller` class is a very common bug, because the class-level annotation alone does not add it automatically the way `@RestController` would.

---

## 10. Best Practices

Version your API from day one, even if the version is always `v1` at first — baking `/api/v1/...` into the base path from the start avoids a painful breaking migration later when you need a `v2`.

Prefer the HTTP-verb shortcut annotations (`@GetMapping`, `@PostMapping`, etc.) over raw `@RequestMapping(method = ...)` for readability, and reserve `@RequestMapping` for class-level base paths or genuinely multi-verb use cases.

Keep controllers thin — a controller method's job is to accept input, delegate to a service layer, and shape the HTTP response; business logic belongs in `@Service` classes (covered in Phase 5), not scattered across `@RestController` methods.

Set `produces` explicitly at the class level for API controllers rather than relying purely on classpath defaults — it documents intent and protects the endpoint if XML or another converter is added to the classpath later for unrelated reasons.

Use plural, noun-based resource paths and let the HTTP verb express the action; avoid verbs baked into the URL such as `/getUser` or `/deleteOrder`.

Centralize CORS configuration through a single `WebMvcConfigurer` bean for anything beyond a single-controller prototype, rather than repeating `@CrossOrigin` attributes across many classes, so the allowed-origins policy lives in exactly one place.

---

## 11. Hands-On Exercises

**Exercise 1:** Create a new Spring Boot project (or use an existing one) with the `spring-boot-starter-web` dependency. Write a `@RestController` named `PingController` mapped to `/api/ping` with a single `@GetMapping` method that returns a `Map<String, String>` containing `{"status": "ok"}`. Start the application, hit the endpoint with `curl -v http://localhost:8080/api/ping`, and inspect the response headers in the verbose output — confirm `Content-Type: application/json` was set automatically with no manual configuration, and note the exact JSON body Jackson produced.

**Exercise 2:** Write two controllers for the same conceptual resource: a `PageController` annotated with `@Controller` that returns the literal string `"home"` from a method mapped to `GET /home` (this will fail to resolve to a template unless you add a `templates/home.html` — intentionally trigger and read the resulting error), and a `PageApiController` annotated with `@RestController` that returns the same literal string `"home"` from a method mapped to `GET /api/home`. Compare the raw HTTP response bodies for both endpoints using `curl` and explain in your own words, in a code comment, exactly why they differ.

**Exercise 3:** Build a `BookController` with class-level `@RequestMapping("/api/books")` and implement all five CRUD-shortcut methods (`@GetMapping` list, `@GetMapping("/{id}")`, `@PostMapping`, `@PutMapping("/{id}")`, `@DeleteMapping("/{id}")`) backed by an in-memory `List<BookDto>` (no database needed yet). Use `curl` with the `-X` flag to exercise all five verbs against the same base path and confirm each routes to the correct method by having each method return a distinguishable message.

**Exercise 4:** Deliberately create an ambiguous mapping bug: add a second method to `BookController` mapped to the exact same path and verb as an existing method (e.g., a second `@GetMapping("/{id}")`). Start the application and capture the exact startup exception message Spring throws. Then fix it by differentiating the two mappings using the `params` attribute (e.g., one requires `?detailed=true`) and verify with `curl` that both variants now route correctly based on the query parameter's presence.

**Exercise 5:** Add `@CrossOrigin(origins = "http://localhost:3000")` to one of your controllers. Using a browser's developer console (or a small HTML file served from a different port, e.g. via `python -m http.server 3000`), attempt a `fetch()` call to your API from that origin, and confirm in the Network tab that the browser either succeeds (allowed origin) or blocks the request with a CORS error (when you change the port to something not in the allow-list). Document the `Access-Control-Allow-Origin` response header you observe in each case.

---

## 12. Interview Q&A

**Q: Walk through what happens between a client sending an HTTP request and a Spring Boot `@RestController` method returning JSON.**
Answer: The embedded Tomcat container accepts the TCP connection and hands the parsed request to the single `DispatcherServlet`, which acts as the front controller for the whole application. The `DispatcherServlet` asks a `HandlerMapping` to find the `@RequestMapping`-annotated method matching the request's path and verb, then delegates to a `HandlerAdapter`, which uses `HandlerMethodArgumentResolver`s to bind path variables, query parameters, and request bodies into method parameters. After the controller method executes and returns a value, because `@ResponseBody` (or `@RestController`) is present, a `HandlerMethodReturnValueHandler` hands the object to an `HttpMessageConverter` — typically Jackson — which serializes it to JSON and writes it to the response.

**Q: What is the actual difference between `@Controller` and `@RestController`?**
Answer: `@RestController` is a composed annotation that is literally `@Controller` plus `@ResponseBody` applied to every method in the class. In a plain `@Controller`, a method's return value (usually a `String`) is treated as a logical view name that gets resolved to a template (e.g., a Thymeleaf HTML page) by a `ViewResolver`. In an `@RestController`, the `@ResponseBody` behavior means the returned object is instead handed directly to an `HttpMessageConverter` and written as the response body — there is no view resolution step at all. You can still get REST behavior from a single method in an `@Controller` class by adding `@ResponseBody` to just that method.

**Q: How does Spring decide whether to send back JSON or XML for the same endpoint?**
Answer: This is content negotiation, driven primarily by the client's `Accept` header intersected with the handler's `produces` attribute (if set) and whichever `HttpMessageConverter`s are registered on the classpath. Spring Boot autoconfigures a Jackson-based JSON converter by default whenever `jackson-databind` is present, which it is transitively via `spring-boot-starter-web`; adding an XML data-format dependency registers an XML converter as well, without any controller code changes. If no registered converter can satisfy the `Accept` header (given any `produces` restriction), Spring responds with `406 Not Acceptable`.

**Q: Why does Spring recommend the HTTP-verb shortcut annotations over `@RequestMapping` with a `method` attribute?**
Answer: The shortcuts (`@GetMapping`, `@PostMapping`, etc.) are simply meta-annotations that internally set `@RequestMapping(method = ...)`, so functionally they are identical — the benefit is purely readability and safety. Writing raw `@RequestMapping` without an explicit `method` attribute matches every HTTP verb on that path, which is rarely the intended behavior and is a common source of subtle routing bugs (e.g., a `DELETE` request accidentally hitting logic meant only for `GET`). The shortcuts make the intended verb visually obvious at a glance and prevent that class of mistake by requiring you to opt out explicitly rather than in.

**Q: What is the purpose of `HandlerMapping` versus `HandlerAdapter`, and why are they two separate concepts?**
Answer: `HandlerMapping` is responsible only for locating which handler (controller method) matches an incoming request's URL and HTTP method; it returns a `HandlerExecutionChain` bundling the handler with any applicable interceptors. `HandlerAdapter` is responsible for actually invoking that handler once found, and different adapters know how to invoke different kinds of handlers — `RequestMappingHandlerAdapter` for annotated `@Controller` methods being the one used almost universally in Spring MVC REST APIs. Separating "find the handler" from "invoke the handler" lets the same `DispatcherServlet` front-controller support multiple handler programming models without hardcoding invocation logic into the mapping layer.

**Q: How would you version an API path, and what real problems does versioning avoid?**
Answer: The simplest and most common approach in Spring MVC is baking the version into the URL path itself, e.g. `@RequestMapping("/api/v1/customers")`, so that a future breaking change can be introduced as a parallel `/api/v2/customers` controller without touching the v1 code. Alternative approaches include a custom `Accept` header value (media-type versioning) or a request header/parameter, both achievable via the `headers`/`params` attributes on `@RequestMapping`, though path versioning is by far the most discoverable and cache-friendly for consumers. Versioning matters because REST APIs are contracts with external or cross-team consumers; without it, any change to a field's type or a removed endpoint silently breaks every existing client with no migration window.
