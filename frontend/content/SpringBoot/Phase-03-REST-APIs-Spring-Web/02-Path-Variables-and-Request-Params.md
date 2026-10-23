# Path Variables & Request Params — Complete Guide

## Table of Contents
1. [Extracting Data from the URL — the Big Picture](#1-extracting-data-from-the-url--the-big-picture)
2. [@PathVariable in Depth](#2-pathvariable-in-depth)
3. [Type Conversion for Path Variables](#3-type-conversion-for-path-variables)
4. [Regex Constraints in Path Templates](#4-regex-constraints-in-path-templates)
5. [Optional Path Variables](#5-optional-path-variables)
6. [@RequestParam in Depth](#6-requestparam-in-depth)
7. [Binding Repeated Params and Whole Query Objects](#7-binding-repeated-params-and-whole-query-objects)
8. [Bean Validation on Parameters](#8-bean-validation-on-parameters)
9. [Matrix Variables — a Brief Mention](#9-matrix-variables--a-brief-mention)
10. [PathVariable vs RequestParam vs RequestBody](#10-pathvariable-vs-requestparam-vs-requestbody)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Best Practices](#12-best-practices)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. Extracting Data from the URL — the Big Picture

Every RESTful endpoint needs to pull dynamic data out of the incoming request, and the URL is where most of that data initially lives — either baked into the path itself, or appended as a query string. Spring MVC gives you three distinct annotations for pulling data from three distinct parts of an HTTP request, and choosing the right one is a design decision, not just a syntax choice.

```
  GET /api/orders/42/items?status=SHIPPED&sort=date&page=0
      └──────┬──────┘└┬┘  └───────────────┬───────────────┘
             │         │                  │
        path segment   │             query string
        (@PathVariable)│             (@RequestParam)
                  path segment
                  (@PathVariable)

  POST /api/orders                 Body: {"customerId": 7, "items": [...]}
       └────┬────┘                       └──────────────┬──────────────┘
      path (no variable here)                    request body
                                                (@RequestBody — next lesson)
```

`@PathVariable` binds values embedded directly in the URL's path template — these values typically identify *which* resource you are operating on. `@RequestParam` binds values from the query string — these typically filter, sort, or paginate a collection, or supply optional parameters to an action. This lesson covers both in depth, along with the validation and type-conversion machinery Spring applies to them.

---

## 2. @PathVariable in Depth

`@PathVariable` extracts a named segment from the URI template declared in the method's (or class's) `@RequestMapping`/verb-shortcut annotation.

```java
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/{id}")
    public UserDto getUserById(@PathVariable("id") Long userId) {
        // GET /api/users/123 → userId = 123L
        return userService.findById(userId);
    }

    @GetMapping("/{userId}/posts/{postId}")
    public PostDto getUserPost(@PathVariable Long userId, @PathVariable Long postId) {
        // When the method parameter name matches the {placeholder} name exactly,
        // the explicit "id" string inside @PathVariable can be omitted —
        // Spring uses reflection (compiled with -parameters, which Spring Boot's
        // Maven/Gradle plugin enables by default) to match them by name.
        return postService.find(userId, postId);
    }
}
```

If the method parameter name does not match the path template variable name, you must specify it explicitly — `@PathVariable("userId") Long id` — otherwise Spring throws `IllegalArgumentException: Name for argument of type [Long] not specified` at startup, because it has no way to know which placeholder to bind without either a matching name or an explicit value.

You can also bind the entire set of path variables into a `Map<String, String>` in one shot, which is occasionally useful for generic or highly dynamic routing:

```java
@GetMapping("/{userId}/posts/{postId}")
public String getBoth(@PathVariable Map<String, String> pathVars) {
    // pathVars = { "userId" -> "123", "postId" -> "456" }
    return pathVars.toString();
}
```

---

## 3. Type Conversion for Path Variables

Path variables arrive as raw strings from the URL; Spring converts them to your declared parameter type using its built-in `Converter`/`PropertyEditor` infrastructure (the same conversion service used for `@RequestParam` and form binding).

```java
@GetMapping("/{id}")
public UserDto getUser(@PathVariable Long id) { ... }              // "123" → 123L

@GetMapping("/by-uuid/{uuid}")
public UserDto getByUuid(@PathVariable UUID uuid) { ... }          // "550e8400-e29b-..." → UUID

@GetMapping("/status/{status}")
public List<OrderDto> byStatus(@PathVariable OrderStatus status) { ... } // "SHIPPED" → OrderStatus.SHIPPED

@GetMapping("/on/{date}")
public List<EventDto> onDate(@PathVariable LocalDate date) { ... } // "2026-07-13" → LocalDate (ISO-8601 by default)
```

```java
public enum OrderStatus { PENDING, SHIPPED, DELIVERED, CANCELLED }
```

Spring's default enum conversion is case-sensitive and matches the enum constant's exact name — `SHIPPED` works, `shipped` throws a `MethodArgumentTypeMismatchException` unless you register a custom `Converter<String, OrderStatus>` bean that normalizes case. `LocalDate`, `LocalDateTime`, and `UUID` are converted out of the box by Spring's built-in formatters without any extra configuration, as long as the string in the URL follows their default parse format (ISO-8601 for dates).

When conversion fails — for example, a request to `GET /api/users/abc` where `abc` cannot become a `Long` — Spring throws `MethodArgumentTypeMismatchException`, which by default results in an HTTP `400 Bad Request` response (the exact JSON shape of that error response is controlled by `@ControllerAdvice` error handling, covered in Phase 6).

```
  Type conversion pipeline for @PathVariable:
  ┌───────────────────────────────────────────────────────────┐
  │ Raw URL segment (String)  e.g. "123"                       │
  │                    │                                       │
  │                    ▼                                       │
  │ ConversionService looks up a registered Converter<String,T>│
  │ for the target parameter type T                            │
  │                    │                                       │
  │              found?│not found or conversion throws          │
  │           ┌────────┴────────┐                              │
  │           ▼                 ▼                              │
  │  Bound value (T)     MethodArgumentTypeMismatchException    │
  │                      → 400 Bad Request                     │
  └───────────────────────────────────────────────────────────┘
```

You can register a custom converter for domain types Spring does not know about natively:

```java
import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

@Component
public class ProductCodeConverter implements Converter<String, ProductCode> {
    @Override
    public ProductCode convert(String source) {
        return ProductCode.parse(source); // e.g. validates a "SKU-XXXX" format
    }
}
```

Once registered as a bean, Spring automatically picks it up and applies it wherever a `@PathVariable ProductCode` or `@RequestParam ProductCode` parameter appears.

---

## 4. Regex Constraints in Path Templates

Path templates support inline regular-expression constraints using the `{variable:regex}` syntax. This lets you disambiguate two mappings that would otherwise collide on the same path shape, and it lets invalid path shapes fail with a plain `404` rather than reaching your controller and failing type conversion with a `400`.

```java
@RestController
@RequestMapping("/api/items")
public class ItemController {

    // Only matches when the segment is purely numeric, e.g. /api/items/42
    @GetMapping("/{id:[0-9]+}")
    public ItemDto getById(@PathVariable Long id) {
        return itemService.findById(id);
    }

    // Only matches when the segment is NOT purely numeric, e.g. /api/items/featured
    @GetMapping("/{slug:[a-zA-Z-]+}")
    public List<ItemDto> getBySlug(@PathVariable String slug) {
        return itemService.findByCategorySlug(slug);
    }
}
```

Without the regex constraint, both `/api/items/42` and `/api/items/featured` would match a single `@GetMapping("/{value}")`, and you would have to inspect the string inside the method body to decide which branch of logic to run. The regex constraint pushes that disambiguation into the routing layer itself, letting `HandlerMapping` choose the correct handler before your code ever executes.

```
  /api/items/42        →  matches {id:[0-9]+}       →  getById(42L)
  /api/items/featured  →  matches {slug:[a-zA-Z-]+} →  getBySlug("featured")
  /api/items/42abc     →  matches NEITHER pattern    →  404 Not Found
```

Regex constraints are also useful for guarding against accidental path collisions with static sub-paths, e.g. ensuring `/api/items/search` (a static endpoint) is never accidentally captured by a loosely-defined `/api/items/{id}`.

---

## 5. Optional Path Variables

Marking a `@PathVariable` as `required = false` is legal but rarely useful in practice, and it comes with sharp limitations worth understanding before reaching for it.

```java
// Two separate mappings — the more idiomatic way to handle "optional" path segments
@GetMapping({"/reports", "/reports/{year}"})
public List<ReportDto> getReports(@PathVariable(required = false) Integer year) {
    if (year == null) {
        return reportService.findAll();
    }
    return reportService.findByYear(year);
}
```

The catch: `@PathVariable(required = false)` only works when the *placeholder itself* is genuinely absent from the matched template for that request — which in practice means you must declare **multiple path patterns** (as in the array above) so that one pattern omits the variable entirely. You cannot make a single `/{year}` segment "optional" the way you can make a query parameter optional, because the URL either contains that path segment or it structurally does not match the template at all. This is why, in the vast majority of real APIs, an "optional filter" is modeled as a `@RequestParam`, not an optional `@PathVariable` — path segments identify resources, and a resource identifier that might-or-might-not-be-there is usually a sign the parameter belongs in the query string instead.

---

## 6. @RequestParam in Depth

`@RequestParam` binds a value from the query string (`?key=value` pairs after the `?`), and is the standard tool for filtering, sorting, pagination, and optional modifiers on a collection endpoint.

```java
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    // GET /api/products?category=electronics&sort=desc&page=0&size=20
    @GetMapping
    public Page<ProductDto> search(
            @RequestParam String category,                              // required, no default
            @RequestParam(defaultValue = "asc") String sort,             // optional, falls back to "asc"
            @RequestParam(required = false) Integer page,                // optional, null if absent
            @RequestParam(name = "size", defaultValue = "20") int size) {// renamed + defaulted
        return productService.search(category, sort, page, size);
    }
}
```

| Attribute | Effect |
|---|---|
| `name` / `value` | The actual query string key to bind (useful when it differs from the Java parameter name, e.g. reserved words) |
| `required` | Defaults to `true`; when `true` and the parameter is absent, Spring throws `MissingServletRequestParameterException` → `400 Bad Request` |
| `defaultValue` | Supplying this implicitly sets `required = false` — if the param is absent, this literal string value is used and converted to the target type |

A subtlety worth memorizing: setting `defaultValue` makes the parameter optional automatically — you do not need `required = false` as well, though it is harmless to add both. If neither `required = false` nor `defaultValue` is set, an absent query parameter is a client error (`400`), not a `null` value silently passed into your method.

---

## 7. Binding Repeated Params and Whole Query Objects

### Repeated query parameters into a `List` or array

A query string can legally repeat the same key multiple times (`?tag=urgent&tag=backend&tag=bug`), and Spring will collect all of them into a `List<String>` or `String[]` parameter automatically — no special annotation attribute is needed beyond the type itself.

```java
// GET /api/tickets?tag=urgent&tag=backend&tag=bug
@GetMapping("/tickets")
public List<TicketDto> byTags(@RequestParam List<String> tag) {
    // tag = ["urgent", "backend", "bug"]
    return ticketService.findByAnyTag(tag);
}
```

If the client instead sends a single comma-separated value (`?tag=urgent,backend,bug`), Spring's default `StringToCollectionConverter` will also split on commas for a `List<String>` target — so both `?tag=a&tag=b` and `?tag=a,b` end up producing the same bound list. Be aware of this dual behavior when documenting your API's expected query format.

### Binding an entire query object without `@RequestParam`

When a collection endpoint accepts many optional filters, repeating `@RequestParam` for every field becomes noisy. Spring MVC supports implicit binding of query parameters directly onto a plain POJO's fields (matched by setter/field name) when the parameter has no annotation at all and is not a simple type, not `@RequestBody`, and not otherwise resolvable by a more specific argument resolver:

```java
public class ProductSearchFilter {
    private String category;
    private String sort = "asc";
    private Integer minPrice;
    private Integer maxPrice;

    // Getters and setters required for Spring's data binder to populate the fields
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getSort() { return sort; }
    public void setSort(String sort) { this.sort = sort; }
    public Integer getMinPrice() { return minPrice; }
    public void setMinPrice(Integer minPrice) { this.minPrice = minPrice; }
    public Integer getMaxPrice() { return maxPrice; }
    public void setMaxPrice(Integer maxPrice) { this.maxPrice = maxPrice; }
}

@GetMapping("/api/products/search")
public List<ProductDto> search(ProductSearchFilter filter) {
    // GET /api/products/search?category=electronics&minPrice=100&maxPrice=500
    // Spring populates filter.category, filter.minPrice, filter.maxPrice automatically
    return productService.search(filter);
}
```

This implicit binding is powered by the same `WebDataBinder`/`ServletModelAttributeMethodProcessor` machinery behind the (optional, and today rarely written explicitly) `@ModelAttribute` annotation — writing `@ModelAttribute ProductSearchFilter filter` is equivalent and makes the intent more explicit for readers, though many teams omit it since it is the default resolution behavior for non-simple, unannotated parameters.

---

## 8. Bean Validation on Parameters

Bean Validation (JSR 380 / Jakarta Validation, implemented by Hibernate Validator) is not limited to `@RequestBody` DTOs — it can validate individual `@PathVariable` and `@RequestParam` values directly, provided the containing controller class is annotated with `@Validated` (from `org.springframework.validation.annotation.Validated`, not the plain `@Valid`).

```java
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@Validated   // REQUIRED at the class level for method-parameter constraints to be enforced
public class ProductController {

    @GetMapping
    public List<ProductDto> search(
            @RequestParam @Min(0) int page,
            @RequestParam @Min(1) @Max(100) int size,
            @RequestParam @Pattern(regexp = "asc|desc") String sort) {
        return productService.search(page, size, sort);
    }

    @GetMapping("/{id}")
    public ProductDto getById(@PathVariable @Min(1) Long id) {
        return productService.findById(id);
    }
}
```

When a constraint fails, Spring throws `ConstraintViolationException` (from method-parameter-level validation), which is distinct from `MethodArgumentNotValidException` (thrown for `@Valid @RequestBody` failures on a whole object, covered in the next lesson). Both ultimately should be translated to a `400 Bad Request` with a structured error body, which in a real application is done centrally with `@ControllerAdvice` — introduced properly in Phase 6, so it is only mentioned here as a forward reference.

```
  Without @Validated:  @Min/@Max/@Pattern on parameters are SILENTLY IGNORED
  With @Validated:     constraint violations throw ConstraintViolationException
```

This is one of the most common silent-bug sources in Spring Web APIs: adding `@Min(1)` to a `@PathVariable` and expecting validation to kick in, without realizing the enclosing class also needs `@Validated` for that annotation to have any effect at all.

---

## 9. Matrix Variables — a Brief Mention

Matrix variables are a rarely-used alternative way to pack multiple named values into a single path segment, using semicolons: `/api/cars;color=red;year=2024`. Spring supports them via `@MatrixVariable`, but they require explicitly enabling `removeSemicolonContent(false)` on the path matching configuration (since semicolons are stripped from paths by default for security and simplicity reasons), and virtually no public REST APIs use this style — query parameters accomplish the same thing far more conventionally and are universally supported by HTTP tooling.

```java
// GET /api/cars/red;year=2024   (matrix variable style — uncommon)
@GetMapping("/cars/{color}")
public List<CarDto> byColorAndYear(
        @PathVariable String color,
        @MatrixVariable(pathVar = "color") Integer year) {
    return carService.find(color, year);
}
```

It is worth recognizing this annotation if you encounter it in legacy code or in an interview question, but you should not reach for it in new API designs — prefer `@RequestParam` for anything resembling optional filtering.

---

## 10. PathVariable vs RequestParam vs RequestBody

| Aspect | `@PathVariable` | `@RequestParam` | `@RequestBody` |
|---|---|---|---|
| Located in | URL path segment | Query string | Request body |
| Typical purpose | Identify a specific resource | Filter/sort/paginate a collection, optional modifiers | Send structured data for create/update |
| Required by default? | Yes (path must match template) | Yes, unless `required=false`/`defaultValue` set | Yes, unless `required=false` |
| Idempotency implication | Identifies the same resource on every call — safe to cache/bookmark | Same query = same logical request; safe for GET | N/A — bodies are for non-idempotent-by-default verbs (POST) or explicit full replaces (PUT) |
| Caching implication | Full URL (path+query) is the cache key for GET; stable path variables cache well | Query params are part of the cache key too — inconsistent param ordering across clients can fragment cache entries | Bodies are not part of the URL, so GET-with-body is non-standard and poorly supported by caches/proxies — this is exactly why GET never uses `@RequestBody` |
| Example | `/api/users/{id}` | `/api/users?active=true` | `POST /api/users` with a JSON body |

The rule of thumb: if removing the value changes *which resource* you're talking about, it's a path variable. If removing the value just changes *how you view/filter* the same collection, it's a query parameter. If the value is structured data describing a resource to create or fully replace, it belongs in the request body — never encoded into the URL, both because URLs have practical length limits and because query strings and paths are logged by proxies, browsers, and servers far more often than request bodies (a real concern for anything sensitive).

---

## 11. Common Pitfalls

**Forgetting `@Validated` at the class level.** As covered above, `@Min`/`@Max`/`@Pattern` annotations directly on `@PathVariable`/`@RequestParam` parameters do absolutely nothing unless the controller class itself carries `@Validated`. This produces the worst kind of bug — no error at all, just silently-accepted invalid input — rather than a loud failure.

**Mismatched parameter and placeholder names without an explicit binding key.** Renaming a Java method parameter (e.g., during a refactor) without updating the matching `{placeholder}` name in the path template, or vice versa, causes a startup-time `IllegalArgumentException` for `@PathVariable`, but for `@RequestParam` it instead silently expects a *different* query key than what you intended — always double check both sides after a rename.

**Assuming `@RequestParam` without `required=false` returns `null` when absent.** By default an absent required `@RequestParam` throws `MissingServletRequestParameterException` (→ `400`) — it does not quietly bind `null`. Beginners are frequently surprised that their "it'll just be null and I'll handle it" defensive code path never even executes because the request never reaches the method body.

**Relying on optional `@PathVariable` for a single mapping.** As explained in section 5, `required = false` on a `@PathVariable` only meaningfully works when paired with multiple `@RequestMapping`/verb-shortcut path patterns; a single `/{id}` template cannot "optionally" match a request with no `id` segment at all, because the URL structurally would not match that template in the first place.

**Trusting numeric IDs blindly without checking ownership.** Type conversion for `@PathVariable Long id` only confirms the value is a valid `Long` — it says nothing about whether the currently authenticated user is allowed to access that particular ID. This is an authorization concern (covered in the Spring Security phase), not a routing/binding concern, but it is an extremely common real-world vulnerability (IDOR — Insecure Direct Object Reference) that stems from conflating "the ID parses" with "the ID is authorized."

**Query parameter list binding surprises with commas.** Because Spring's default converter splits comma-separated strings into list elements for collection-typed `@RequestParam`s, a tag value that legitimately contains a comma (e.g., `tag=cost,benefit`) will be unintentionally split into two tags — document and test this edge case if your domain data can contain commas.

---

## 12. Best Practices

Use `@PathVariable` exclusively for resource identifiers, and `@RequestParam` for everything that filters, sorts, paginates, or optionally modifies behavior on a collection endpoint — this keeps URLs predictable and RESTful.

Apply regex constraints (`{id:[0-9]+}`) whenever two mappings could otherwise collide on the same path shape, so that ambiguous requests fail fast with a `404` at the routing layer instead of reaching your handler and failing type conversion.

Put `@Validated` on every controller class where you use Bean Validation annotations directly on method parameters — make it a habit alongside adding the class itself, so the two are never separated.

Prefer binding a dedicated filter POJO (`ProductSearchFilter`) over accumulating five or more individual `@RequestParam` arguments on a single method signature — it keeps the method readable and gives you a single place to add cross-field validation later.

Give every optional `@RequestParam` a sensible `defaultValue` rather than leaving it `required = false` and null-checking in the method body, wherever a reasonable default exists (e.g., default sort order, default page size) — this pushes the "what if it's absent" decision to the routing layer where it is declarative and self-documenting.

Never use `@RequestBody` on a `GET` mapping to work around wanting to send "complex" filter data — GET requests with bodies are non-standard, poorly supported by caching layers and HTTP client libraries, and violate the semantics of a safe, cacheable request; use `@RequestParam`/a filter POJO, or switch the endpoint to `POST` with a `/search` suffix if the filter genuinely cannot be expressed as query parameters.

---

## 13. Hands-On Exercises

**Exercise 1:** Build a `TicketController` with `GET /api/tickets/{id:[0-9]+}` returning a single ticket and a separate `GET /api/tickets/{slug:[a-zA-Z-]+}` returning a ticket looked up by a human-readable slug. Verify with `curl` that `/api/tickets/42` and `/api/tickets/urgent-fix` route to the two different methods correctly, and that `/api/tickets/42abc` (which matches neither pattern) returns a `404`.

**Exercise 2:** Implement `GET /api/events/on/{date}` accepting a `@PathVariable LocalDate date`. Call it with a valid ISO date (`/api/events/on/2026-07-13`) and confirm it parses correctly, then call it with an invalid format (`/api/events/on/13-07-2026`) and capture the exact exception type and HTTP status Spring returns in the response/logs. Then add an `OrderStatus` enum `@PathVariable` to a second endpoint and repeat the experiment with an invalid enum value (e.g., `notarealstatus`) to see the same class of error for enum conversion.

**Exercise 3:** Create a `ProductSearchFilter` POJO with `category`, `sort` (default `"asc"`), `minPrice`, and `maxPrice` fields plus getters/setters, and bind it as an unannotated method parameter on `GET /api/products/search`. Verify with `curl` that `?category=electronics&minPrice=100` correctly populates only those two fields, leaving `maxPrice` null and `sort` at its default. Then add class-level `@Validated` and `@Min(0)` on `minPrice`'s getter-backed field access is not directly supported this way — instead add `@Min`/`@Max` directly to a plain `@RequestParam` version of the same endpoint and confirm `ConstraintViolationException` is thrown for a negative `minPrice` only after you've added `@Validated` to the controller class (and confirm it is silently ignored before you add it).

**Exercise 4:** Implement `GET /api/tickets?tag=...` accepting `@RequestParam List<String> tag`. Test it three ways with `curl`: repeated keys (`?tag=urgent&tag=backend`), a single comma-separated value (`?tag=urgent,backend`), and no `tag` parameter at all (expect a `400` unless you add `required = false`, in which case verify you get an empty list instead). Document which of the three behaviors surprised you most and why.

**Exercise 5:** Deliberately reproduce the "silent ignore" pitfall: create a controller class WITHOUT `@Validated`, add `@Min(1)` to a `@PathVariable Long id` parameter, and call the endpoint with `id=-5`. Confirm the request succeeds and reaches your method body despite the invalid value. Then add `@Validated` to the class and repeat the exact same request, confirming it now fails with `ConstraintViolationException` and a `400` (or `500`, depending on whether a `@ControllerAdvice` handler is present — note which you observe and why, as a preview of Phase 6).

---

## 14. Interview Q&A

**Q: What is the fundamental difference in when you would use `@PathVariable` versus `@RequestParam`?**
Answer: `@PathVariable` is for values that identify *which* resource the request is about — removing or changing the value changes the resource itself, such as `/api/users/{id}`. `@RequestParam` is for values that filter, sort, paginate, or optionally modify how a collection is returned or how an action behaves, such as `?sort=desc&page=0`, without changing which underlying resource collection is being addressed. A useful test is idempotency and cacheability: path variables typically identify a stable, bookmarkable resource URL, while query parameters compose the full cache key alongside the path for GET requests.

**Q: How does Spring convert a `@PathVariable` string into a typed Java parameter like `Long` or `LocalDate`, and what happens when conversion fails?**
Answer: Spring MVC uses its `ConversionService` (backed by registered `Converter<String, T>` implementations, including several built-in ones for common types like `Long`, `UUID`, `LocalDate`, and enums) to convert the raw path string. When conversion fails — for example, passing a non-numeric string where a `Long` is expected — Spring throws `MethodArgumentTypeMismatchException`, which results in an HTTP `400 Bad Request` by default. You can also register custom `Converter` beans for domain-specific types, and Spring will automatically apply them to matching `@PathVariable` and `@RequestParam` parameters without further controller code.

**Q: Why doesn't `@Min`/`@Max` on a `@RequestParam` do anything unless you add another annotation?**
Answer: Bean Validation constraints on individual method parameters (as opposed to on a whole `@Valid @RequestBody` object) are only evaluated if the enclosing controller class is annotated with Spring's `@Validated` (from `org.springframework.validation.annotation.Validated`). Without it, Spring never invokes the parameter-level validation interceptor (`MethodValidationInterceptor`), so annotations like `@Min`/`@Max`/`@Pattern` are present in the bytecode but are simply never checked — the request succeeds regardless of the parameter's value. This is a well-known silent-bug trap, and a common interview question specifically because the failure mode (no error at all) makes it easy to miss in code review.

**Q: How would you accept a repeated query parameter like `?tag=a&tag=b` in Spring MVC, and what alternate client format does Spring also support for the same target type?**
Answer: Declaring the `@RequestParam` as `List<String> tag` (or `String[] tag`) causes Spring to automatically collect every occurrence of the `tag` key from the query string into that collection — no special attribute is required. Spring's default `StringToCollectionConverter` will also split a single comma-separated value (`?tag=a,b`) into the same list shape, so both client conventions produce an equivalent bound list; this dual behavior is worth documenting explicitly in API docs since it can cause confusion if a legitimate tag value itself contains a comma.

**Q: What's the difference between `MethodArgumentTypeMismatchException`, `MethodArgumentNotValidException`, and `ConstraintViolationException`, and when does each occur?**
Answer: `MethodArgumentTypeMismatchException` occurs when Spring cannot convert a raw path/query string into the declared parameter's Java type at all — e.g., `abc` where a `Long` is expected. `ConstraintViolationException` occurs when a value converts successfully but then fails a Bean Validation constraint applied directly to an individual method parameter (requires `@Validated` on the class). `MethodArgumentNotValidException` occurs specifically when a `@Valid`-annotated `@RequestBody` object's fields fail Bean Validation constraints defined on the DTO class itself, which is covered fully in the next lesson. All three typically map to a `400 Bad Request`, but they are distinct exception types with distinct triggers, and a `@ControllerAdvice` (Phase 6) commonly handles all three to produce a consistent error response shape.

**Q: Why would implicit POJO binding of query parameters (an unannotated method parameter) be preferable to five separate `@RequestParam` arguments?**
Answer: As a collection endpoint accumulates filters, sort options, and pagination controls, a long parameter list becomes hard to read, hard to extend, and awkward to pass around or reuse (e.g., you cannot easily pass "the current search filter" to a helper method without bundling the individual params yourself). Binding a dedicated filter class lets Spring's data binder populate all matching fields automatically from the query string by name, keeps the controller method signature short and stable as new optional filters are added, and gives you one natural place to add getters, defaults, or (with `@Validated`) cross-field validation logic without touching the controller signature again.
