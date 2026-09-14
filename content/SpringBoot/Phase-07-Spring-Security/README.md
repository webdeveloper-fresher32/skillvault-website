# Phase 7: Spring Security

## What You'll Learn

Spring Security is widely considered the hardest part of the Spring ecosystem to learn because it works through layers of servlet filters, delegating proxies, and provider chains that are largely invisible unless you know where to look. This phase builds a mental model of that machinery from the ground up — how a raw HTTP request becomes an authenticated `Authentication` object, how authorization decisions are made at both the URL and method level, and how to build fully stateless, token-based authentication for REST APIs using JWT. By the end of this phase you will be able to configure Spring Security 6.x applications using the modern lambda DSL (no deprecated `WebSecurityConfigurerAdapter`), secure endpoints with fine-grained role and authority rules, protect service-layer methods with `@PreAuthorize`/`@PostAuthorize`, and implement a production-style JWT filter for stateless APIs.

## Learning Objectives

- Trace a request through `DelegatingFilterProxy` → `FilterChainProxy` → the ordered security filter chain
- Configure security using a `SecurityFilterChain` bean and the Spring Security 6.x lambda DSL
- Understand `AuthenticationManager`, `AuthenticationProvider`, `UserDetailsService`, and `UserDetails`
- Hash and verify passwords correctly using `BCryptPasswordEncoder`
- Configure both in-memory and database-backed authentication
- Write URL-based authorization rules with `authorizeHttpRequests`
- Distinguish roles from authorities and apply the correct SpEL expressions
- Enable and use method-level security (`@PreAuthorize`, `@PostAuthorize`, `@Secured`, `@EnableMethodSecurity`)
- Understand JWT structure and why stateless auth suits REST APIs better than sessions
- Build a custom `OncePerRequestFilter` to validate JWTs on every request
- Generate and validate JWTs using `jjwt`, and configure `SessionCreationPolicy.STATELESS`
- Recognize and avoid common JWT security pitfalls (storage, expiry, algorithm confusion)

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Security-Filter-Chain-and-Authentication.md](01-Security-Filter-Chain-and-Authentication.md) | Security Filter Chain & Authentication — DelegatingFilterProxy, SecurityFilterChain, UserDetailsService, password encoding | 2 days |
| [02-Authorization-and-Method-Security.md](02-Authorization-and-Method-Security.md) | Authorization & Method Security — authorizeHttpRequests, roles vs authorities, @PreAuthorize/@PostAuthorize | 1 day |
| [03-JWT-and-Stateless-Auth.md](03-JWT-and-Stateless-Auth.md) | JWT & Stateless Auth — token structure, custom filters, jjwt, SessionCreationPolicy.STATELESS | 1 day |

## Estimated Time
4 days

## Previous Phase
→ [Phase 6: Exception Handling](../Phase-06-Exception-Handling/README.md)

## Next Phase
→ [Phase 8: Testing](../Phase-08-Testing/README.md)
