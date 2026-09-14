# Authorization and Method Security — Complete Guide

## Table of Contents
1. [Authentication vs Authorization Recap](#1-authentication-vs-authorization-recap)
2. [URL-Based Authorization with authorizeHttpRequests](#2-url-based-authorization-with-authorizehttprequests)
3. [Request Matcher Precedence and Ordering](#3-request-matcher-precedence-and-ordering)
4. [Roles vs Authorities — The Real Difference](#4-roles-vs-authorities--the-real-difference)
5. [Enabling Method Security — @EnableMethodSecurity](#5-enabling-method-security--enablemethodsecurity)
6. [@PreAuthorize, @PostAuthorize, and @Secured](#6-preauthorize-postauthorize-and-secured)
7. [SpEL Expressions in Security Annotations](#7-spel-expressions-in-security-annotations)
8. [Worked Example: Securing a REST API End to End](#8-worked-example-securing-a-rest-api-end-to-end)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Authentication vs Authorization Recap

Authentication answers "who are you?" — it is handled by the filters covered in Lesson 01 (`UsernamePasswordAuthenticationFilter`, `BasicAuthenticationFilter`, or a custom JWT filter), which populate the `SecurityContext` with an `Authentication` object once credentials are verified.

Authorization answers "are you allowed to do this?" — it happens strictly *after* authentication, and it happens at two distinct layers in a Spring Boot application:

```
  Layer 1: URL-based authorization (perimeter, coarse-grained)
  ┌──────────────────────────────────────────────────────────┐
  │  AuthorizationFilter (last filter in the security chain) │
  │  Evaluates authorizeHttpRequests() rules against the      │
  │  request path + HTTP method BEFORE the controller runs   │
  └──────────────────────────────────────────────────────────┘
                            │
                            ▼  request reaches the controller
  Layer 2: Method-level authorization (fine-grained, business rules)
  ┌──────────────────────────────────────────────────────────┐
  │  AOP proxy wraps @Service / @Component beans              │
  │  @PreAuthorize / @PostAuthorize / @Secured evaluated       │
  │  around the actual method invocation                      │
  └──────────────────────────────────────────────────────────┘
```

URL-based rules are a perimeter defense — cheap to evaluate, good for "only admins can hit `/api/admin/**`" style rules. Method-level security is finer-grained and can express business rules that depend on the *data itself* — for example, "a user may update an order only if they are the order's owner," which cannot be expressed purely from a URL pattern. Production applications typically use both together: coarse URL rules to keep unauthenticated or wrong-role traffic out entirely, and method-level rules to enforce ownership and data-dependent policies deeper in the call stack.

---

## 2. URL-Based Authorization with authorizeHttpRequests

`authorizeHttpRequests` (the replacement for the deprecated `authorizeRequests`) is configured inside the `SecurityFilterChain` bean. Rules are a list of matcher → authorization-rule pairs.

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/products/**").hasRole("ADMIN")
            .requestMatchers(HttpMethod.DELETE, "/api/products/**").hasRole("ADMIN")
            .requestMatchers("/api/orders/**").hasAnyRole("USER", "ADMIN")
            .requestMatchers("/actuator/health").permitAll()
            .requestMatchers("/actuator/**").hasRole("ADMIN")
            .anyRequest().denyAll()
        );

    return http.build();
}
```

Available authorization rules include:

| Rule | Meaning |
|------|---------|
| `permitAll()` | No authentication required |
| `denyAll()` | Always rejected, regardless of authentication |
| `authenticated()` | Any authenticated user, any role |
| `hasRole("X")` | User must have authority `ROLE_X` |
| `hasAnyRole("X", "Y")` | User must have `ROLE_X` or `ROLE_Y` |
| `hasAuthority("X")` | User must have the exact authority string `X` (no prefix added) |
| `hasAnyAuthority("X", "Y")` | User must have at least one of the exact authority strings |
| `access(AuthorizationManager)` | Fully custom authorization logic, including SpEL via `access(new WebExpressionAuthorizationManager(...))` |

`requestMatchers` can be scoped by HTTP method (`HttpMethod.GET`, `HttpMethod.POST`, ...) as well as by path pattern, which lets you express "anyone can read products, only admins can create/delete them" without needing separate controllers.

---

## 3. Request Matcher Precedence and Ordering

This is the single most important operational fact about `authorizeHttpRequests`: **rules are evaluated top to bottom, and the first matching rule wins.** There is no "most specific match" resolution like Spring MVC's `@RequestMapping` — it is a linear scan.

```
  authorizeHttpRequests(auth -> auth
      .requestMatchers("/api/admin/**").hasRole("ADMIN")   // rule 1
      .requestMatchers("/api/**").authenticated()           // rule 2
      .anyRequest().denyAll()                                // rule 3 (catch-all)
  )

  Request: GET /api/admin/users
    → rule 1 matches first → hasRole("ADMIN") is enforced. Correct.

  If rules were reversed:
  authorizeHttpRequests(auth -> auth
      .requestMatchers("/api/**").authenticated()           // now rule 1
      .requestMatchers("/api/admin/**").hasRole("ADMIN")    // now rule 2 — DEAD CODE
      .anyRequest().denyAll()
  )

  Request: GET /api/admin/users
    → rule 1 (authenticated()) matches first and wins.
    → rule 2 never evaluated for this request — any authenticated user,
      not just admins, can reach /api/admin/**.
```

Always order matchers from most specific to least specific, and always finish with a deliberate catch-all — either `.anyRequest().authenticated()` (safer default: unknown paths require login) or `.anyRequest().denyAll()` (safest: unknown paths are always rejected). Never leave the catch-all as `permitAll()`.

---

## 4. Roles vs Authorities — The Real Difference

This distinction confuses almost every learner, and it is purely a **naming convention**, not a separate mechanism. Under the hood, Spring Security has exactly one concept: `GrantedAuthority` — a simple string wrapped in `SimpleGrantedAuthority`. There is no separate `Role` type in the core authorization model.

"Roles" are simply authorities that follow the convention of being prefixed with `ROLE_`. The `hasRole("ADMIN")` helper is pure sugar: it automatically prepends `ROLE_` and calls the same underlying authority-check logic as `hasAuthority("ROLE_ADMIN")`.

```
  GrantedAuthority (the only real concept)
        │
        ├── "ROLE_ADMIN"     ─── conventionally a "role" ─── checked via hasRole("ADMIN")
        ├── "ROLE_USER"      ─── conventionally a "role" ─── checked via hasRole("USER")
        ├── "perm:order:approve"  ─── a fine-grained "authority" ─── checked via hasAuthority("perm:order:approve")
        └── "perm:invoice:read"   ─── a fine-grained "authority" ─── checked via hasAuthority("perm:invoice:read")
```

Practically:

- Use **roles** (`ROLE_*` convention, checked with `hasRole`/`hasAnyRole`) for coarse-grained job functions: `ADMIN`, `USER`, `MANAGER`. A user typically has one or two roles.
- Use **authorities** (checked with `hasAuthority`/`hasAnyAuthority`) for fine-grained permissions: `order:approve`, `invoice:read`, `report:export`. A user might accumulate many authorities across different roles, and this model supports systems where permissions are assembled dynamically (e.g., role → permission mapping tables).

```java
// Granting both a role and fine-grained authorities to the same user
UserDetails user = User.withUsername("manager1")
        .password(encodedPassword)
        .authorities(
            new SimpleGrantedAuthority("ROLE_MANAGER"),
            new SimpleGrantedAuthority("perm:order:approve"),
            new SimpleGrantedAuthority("perm:report:export")
        )
        .build();
```

```java
.requestMatchers("/api/manager/**").hasRole("MANAGER")              // coarse gate
// ... and deeper in the method layer ...
@PreAuthorize("hasAuthority('perm:order:approve')")                  // fine-grained check
public void approveOrder(Long orderId) { ... }
```

---

## 5. Enabling Method Security — @EnableMethodSecurity

Method-level annotations do nothing on their own — they are inert until method security is explicitly enabled on a configuration class:

```java
package com.example.security.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@Configuration
@EnableMethodSecurity // enables @PreAuthorize, @PostAuthorize, @PreFilter, @PostFilter
public class MethodSecurityConfig {
}
```

`@EnableMethodSecurity` is the Spring Security 6.x replacement for the older `@EnableGlobalMethodSecurity`. By default it enables `@PreAuthorize`/`@PostAuthorize` support (Spring Security's own SpEL-based annotations). To additionally support the legacy `@Secured` annotation or JSR-250 (`@RolesAllowed`), enable them explicitly:

```java
@EnableMethodSecurity(securedEnabled = true, jsr250Enabled = true)
```

Method security is implemented via Spring AOP: `@EnableMethodSecurity` registers advisors that wrap annotated beans in a dynamic proxy (or CGLIB subclass). This has a direct, often-missed consequence: **annotations only take effect on calls that go through the Spring-managed proxy** — a method calling another `@PreAuthorize`-annotated method on `this` (self-invocation) bypasses the proxy entirely and the check is silently skipped.

---

## 6. @PreAuthorize, @PostAuthorize, and @Secured

Three annotation styles exist, with different evaluation timing and expressiveness:

| Annotation | Evaluated | Expression Language | Typical Use |
|------------|-----------|----------------------|--------------|
| `@PreAuthorize` | Before method execution | Full SpEL, including method arguments | Block a call before it happens — the standard choice |
| `@PostAuthorize` | After method execution, before the return value reaches the caller | Full SpEL, including `returnObject` | Check ownership/attributes of the *result*, e.g., "you may view this order only if it's yours" |
| `@Secured` | Before method execution | Simple role list only (`{"ROLE_ADMIN"}`), no SpEL | Legacy annotation, kept mostly for backward compatibility |
| `@PreFilter` / `@PostFilter` | Before/after, on collection arguments/results | SpEL over collection elements | Filter a collection down to only the elements the caller may see |

```java
@PreAuthorize("hasRole('ADMIN')")
public void deleteUser(Long userId) { ... }

@PostAuthorize("returnObject.owner == authentication.name")
public Order getOrder(Long orderId) { ... } // throws AccessDeniedException if the check fails after loading the Order

@Secured("ROLE_ADMIN")
public void legacyAdminOnlyMethod() { ... }

@PreFilter("filterObject.owner == authentication.name")
public void batchUpdate(List<Order> orders) { ... } // strips out orders not owned by the caller before the method runs
```

`@PostAuthorize` is powerful but has a real cost: the method body **always executes first**, even if the caller ultimately turns out to be unauthorized. This is acceptable for a read (loading an entity and then checking ownership) but dangerous for a write or an operation with side effects — never use `@PostAuthorize` to gate a method that mutates state or calls an external system, since the mutation/call already happened by the time the check fails.

---

## 7. SpEL Expressions in Security Annotations

`@PreAuthorize` and `@PostAuthorize` expressions have access to a rich set of built-in variables and functions beyond simple role checks:

| Expression element | Meaning |
|---------------------|---------|
| `authentication` | The current `Authentication` object |
| `principal` | The current principal (often a `UserDetails`) |
| `hasRole('X')` / `hasAuthority('X')` | Standard authority checks, usable inside SpEL |
| `#paramName` | References a method parameter by name (requires `-parameters` compiler flag or explicit `@P("paramName")`) |
| `returnObject` | (in `@PostAuthorize` only) the method's return value |
| `filterObject` | (in `@PreFilter`/`@PostFilter` only) the current collection element being evaluated |
| a call to a `@Component` bean | `@myBean.someCheck(#id, authentication)` — delegate complex logic to a Spring bean |

```java
// Referencing a method parameter directly
@PreAuthorize("#username == authentication.name or hasRole('ADMIN')")
public UserProfile getProfile(String username) { ... }

// Delegating complex ownership logic to a bean, referenced with @beanName
@PreAuthorize("@orderSecurity.isOwner(#orderId, authentication.name)")
public void cancelOrder(Long orderId) { ... }

@Component("orderSecurity")
public class OrderSecurityService {
    private final OrderRepository orderRepository;

    public OrderSecurityService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public boolean isOwner(Long orderId, String username) {
        return orderRepository.findById(orderId)
                .map(order -> order.getOwnerUsername().equals(username))
                .orElse(false);
    }
}
```

Delegating to a `@Component` bean (as shown with `@orderSecurity`) is the recommended pattern once an expression grows beyond a simple role or ownership comparison — it keeps the SpEL string short, keeps the logic unit-testable as plain Java, and avoids embedding business rules as strings scattered across annotations.

---

## 8. Worked Example: Securing a REST API End to End

A complete example combining URL-based authorization, role vs authority checks, and method-level ownership checks for a simple order management API.

```java
package com.example.orders.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class ApiSecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/orders/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/orders/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/orders/**").hasRole("ADMIN")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().denyAll()
            );

        return http.build();
    }
}
```

```java
package com.example.orders.web;

import com.example.orders.model.Order;
import com.example.orders.service.OrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    // URL rule already requires ROLE_USER or ROLE_ADMIN — this handles "any order I own"
    @GetMapping("/{orderId}")
    public ResponseEntity<Order> getOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(orderService.getOrderForCaller(orderId));
    }

    @GetMapping
    public ResponseEntity<List<Order>> listMyOrders() {
        return ResponseEntity.ok(orderService.listOrdersForCaller());
    }

    // Fine-grained: only an ADMIN, or the order's own owner, may cancel it
    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<Void> cancelOrder(@PathVariable Long orderId) {
        orderService.cancelOrder(orderId);
        return ResponseEntity.noContent().build();
    }
}
```

```java
package com.example.orders.service;

import com.example.orders.model.Order;
import com.example.orders.repository.OrderRepository;
import org.springframework.security.access.prepost.PostAuthorize;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    // Return-value ownership check: only the owner or an admin may see this order
    @PostAuthorize("returnObject.ownerUsername == authentication.name or hasRole('ADMIN')")
    public Order getOrderForCaller(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    public List<Order> listOrdersForCaller() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return orderRepository.findByOwnerUsername(username);
    }

    // Pre-execution check: delegate ownership logic to a dedicated bean
    @PreAuthorize("@orderSecurity.isOwner(#orderId, authentication.name) or hasRole('ADMIN')")
    public void cancelOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException(orderId));
        order.setStatus("CANCELLED");
        orderRepository.save(order);
    }
}
```

Notice the layering: the `SecurityFilterChain` keeps unauthenticated and wrong-role traffic out entirely at the perimeter, while `@PreAuthorize`/`@PostAuthorize` enforce data-dependent ownership rules that no URL pattern could express (a regular `USER` may only act on *their own* orders, not just any order under `/api/orders/**`).

---

## 9. Common Pitfalls

- **Relying only on URL rules for data ownership.** `.hasAnyRole("USER", "ADMIN")` on `/api/orders/**` lets any authenticated user hit any order ID — without a method-level ownership check, user A can view or cancel user B's order simply by changing the path variable (an IDOR — Insecure Direct Object Reference — vulnerability).
- **Forgetting `@EnableMethodSecurity`.** `@PreAuthorize` and `@PostAuthorize` are silently no-ops without it — no error is thrown, the annotations are simply never evaluated, which can create a false sense of security.
- **Self-invocation bypassing the proxy.** Calling an `@PreAuthorize`-annotated method from another method in the *same class* (`this.someSecuredMethod()`) does not go through the Spring AOP proxy, so the check is skipped entirely. Move the secured method to a separate bean if it must be called internally.
- **Using `@PostAuthorize` on a method with side effects.** The method body runs to completion *before* the check — a `@PostAuthorize`-guarded method that deletes a record or sends an email will still do so even if the authorization check subsequently fails.
- **Confusing `hasRole` and `hasAuthority`.** `hasRole("ADMIN")` checks for `"ROLE_ADMIN"`; if authorities were granted without the `ROLE_` prefix, this silently never matches. Always be explicit about which convention your `GrantedAuthority` values follow.
- **Ordering `authorizeHttpRequests` rules incorrectly.** As covered in Section 3, the first matching matcher wins — a broad rule placed before a narrow one silently swallows it.
- **Forgetting parameter names are needed for `#paramName` SpEL references.** Without compiling with `-parameters` (or annotating with `@P("name")`), Spring Security cannot resolve `#orderId` by name at runtime and throws a `SpelEvaluationException`.

---

## 10. Best Practices

- Treat URL-based authorization as the perimeter (keep out wrong roles entirely) and method-level security as the place to enforce data ownership and business rules — use both, not one or the other.
- Delegate any SpEL expression more complex than a single role/authority check to a named `@Component` bean (`@orderSecurity.isOwner(...)`) so the logic is unit-testable and not duplicated across annotations.
- Default to `@PreAuthorize` over `@PostAuthorize` whenever the check can be expressed on the input arguments alone — it avoids executing side-effecting code before the authorization decision.
- Always end `authorizeHttpRequests` chains with an explicit, deliberate catch-all (`anyRequest().denyAll()` or `.authenticated()`) — never let it fall through to an implicit default.
- Use fine-grained authorities (`perm:resource:action`) for permission systems that need to evolve independently of a small, fixed set of roles; reserve roles for coarse job functions.
- Write integration tests (`@SpringBootTest` with `@WithMockUser`) specifically for negative cases — verify that a `USER` gets a 403 on admin-only endpoints and cannot access another user's data, not just that the happy path works.
- Compile with `-parameters` (standard in modern Spring Boot Maven/Gradle archetypes) so `#paramName` SpEL references resolve reliably without needing `@P` annotations everywhere.

---

## 11. Hands-On Exercises

**Exercise 1:** Build a `SecurityFilterChain` with three rule tiers: `GET /api/products/**` open to everyone, `POST`/`DELETE /api/products/**` restricted to `ROLE_ADMIN`, and everything else requiring authentication. Verify with three curl requests (no auth, `USER` role, `ADMIN` role) that each tier behaves as expected.

**Exercise 2:** Deliberately swap the order of two `authorizeHttpRequests` rules so a broad `anyRequest().authenticated()` precedes a narrow admin-only rule. Confirm via a test request that the admin restriction is silently bypassed. Then fix the ordering and re-verify.

**Exercise 3:** Enable `@EnableMethodSecurity` and write a service method annotated `@PreAuthorize("hasAuthority('perm:report:export'))")`. Grant one test user the `ROLE_MANAGER` role but no `perm:report:export` authority, and another user both. Verify the first gets `AccessDeniedException` and the second succeeds — demonstrating that roles and authorities are independently checkable.

**Exercise 4:** Implement the `OrderService.cancelOrder` ownership pattern from Section 8: a `@Component("orderSecurity")` bean with an `isOwner(Long orderId, String username)` method, referenced from `@PreAuthorize("@orderSecurity.isOwner(#orderId, authentication.name) or hasRole('ADMIN')")`. Write a test proving a non-owner `USER` gets denied, the owner succeeds, and an `ADMIN` can cancel any order regardless of ownership.

**Exercise 5:** Create a method annotated `@PostAuthorize("returnObject.ownerUsername == authentication.name")` that also has a deliberate side effect (e.g., increments a "times viewed" counter and saves it) before returning. Call it as a non-owner and observe, via a database check or log, that the side effect occurred even though the call ultimately throws `AccessDeniedException`. Use this to explain in your own words why `@PostAuthorize` is unsafe for state-mutating operations.

---

## 12. Interview Q&A

**Q: What is the practical difference between a "role" and an "authority" in Spring Security?**
Answer: There is no separate data type for roles in Spring Security's core model — both are represented as `GrantedAuthority` strings. "Role" is purely a naming convention: an authority prefixed with `ROLE_`. `hasRole("ADMIN")` is sugar that automatically prepends the prefix and checks for `"ROLE_ADMIN"`, while `hasAuthority("ADMIN")` checks for the exact string with no prefix added. In practice, teams use the `ROLE_` convention for coarse job functions (`ROLE_ADMIN`, `ROLE_USER`) and unprefixed authority strings for fine-grained permissions (`perm:order:approve`), checking the former with `hasRole`/`hasAnyRole` and the latter with `hasAuthority`/`hasAnyAuthority`.

**Q: How does `authorizeHttpRequests` decide which rule applies when a request matches multiple matchers?**
Answer: It does not do "most specific match" resolution like Spring MVC routing — rules are evaluated strictly top to bottom in the order they're declared, and the first matcher that matches the request wins; all subsequent rules are never even evaluated for that request. This means a broad rule (like `anyRequest().authenticated()`) placed before a narrower, more restrictive rule will silently swallow it, making the narrower rule dead code. The correct pattern is always most-specific-first, ending with a deliberate catch-all.

**Q: What's the difference between `@PreAuthorize` and `@PostAuthorize`, and when would you choose one over the other?**
Answer: `@PreAuthorize` evaluates its SpEL expression before the method body runs, using only the method's arguments and the current authentication — if it fails, the method never executes at all. `@PostAuthorize` evaluates after the method has already returned, giving the expression access to `returnObject`, which lets you express checks that depend on data only available after a lookup (e.g., "the loaded order's owner must match the caller"). The key tradeoff is that `@PostAuthorize`'s method body always runs first, so it must never be used to guard methods with side effects — a denied `@PostAuthorize` call still executed any writes or external calls the method made before returning.

**Q: Why might a `@PreAuthorize` annotation silently have no effect at all?**
Answer: The most common reason is a missing `@EnableMethodSecurity` on a configuration class — without it, Spring never registers the AOP advisors that intercept annotated method calls, and the annotation is a complete no-op with no error raised. The second most common reason is self-invocation: method security works through a dynamic proxy wrapping the bean, so calling an annotated method from another method within the same class (via `this.method()`) bypasses the proxy entirely, and the check never runs. The fix for self-invocation is to move the secured method into a separate injected bean so external callers always go through the proxy.

**Q: How would you enforce that a regular user can only cancel their own orders, not any order in the system?**
Answer: URL-based rules alone cannot express this — `hasAnyRole("USER", "ADMIN")` on `/api/orders/**` only checks the caller's role, not which specific order they're targeting, so any authenticated user could cancel any order ID (an IDOR vulnerability). The fix is method-level security with a data-dependent SpEL expression, typically delegated to a bean: `@PreAuthorize("@orderSecurity.isOwner(#orderId, authentication.name) or hasRole('ADMIN')")`, where `isOwner` looks up the order and compares its owner against the current principal. This combines the coarse URL-level role gate with a fine-grained, data-aware ownership check at the method layer.

**Q: What SpEL variables are available inside `@PreAuthorize` and `@PostAuthorize`, and how do you access method parameters?**
Answer: Both give access to `authentication` (the current `Authentication` object), `principal`, and the standard `hasRole`/`hasAuthority` functions. `@PostAuthorize` additionally exposes `returnObject`, the method's return value, letting you check attributes of the result. Method parameters are accessed with `#parameterName`, which requires the code to be compiled with parameter name information retained (the `-parameters` javac flag, standard in modern Spring Boot build setups) or an explicit `@P("name")` annotation on the parameter if names aren't preserved. For logic more complex than a simple comparison, expressions typically delegate to a named Spring bean, e.g., `@myBean.check(#id, authentication)`.
