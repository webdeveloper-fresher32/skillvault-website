# JWT and Stateless Auth — Complete Guide

## Table of Contents
1. [Why Stateless Auth for REST APIs](#1-why-stateless-auth-for-rest-apis)
2. [JWT Structure — Header, Payload, Signature](#2-jwt-structure--header-payload-signature)
3. [The Stateless Authentication Flow](#3-the-stateless-authentication-flow)
4. [Generating Tokens with jjwt](#4-generating-tokens-with-jjwt)
5. [Validating Tokens with jjwt](#5-validating-tokens-with-jjwt)
6. [Building a Custom JWT Authentication Filter](#6-building-a-custom-jwt-authentication-filter)
7. [Configuring SecurityFilterChain for Stateless Sessions](#7-configuring-securityfilterchain-for-stateless-sessions)
8. [Worked Example: Full Login and Protected Endpoint Flow](#8-worked-example-full-login-and-protected-endpoint-flow)
9. [Common Security Pitfalls](#9-common-security-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Stateless Auth for REST APIs

Lessons 01 and 02 used form login and HTTP Basic, both of which rely on the servlet container's `HttpSession` (form login) or resend credentials on every request (Basic). Sessions work well for traditional server-rendered web apps but create real friction for REST APIs consumed by mobile apps, single-page applications, and other backend services:

```
  Session-based auth                          Token-based (JWT) auth
  ───────────────────                         ───────────────────────
  Client logs in                              Client logs in
    → server creates session,                   → server issues a signed JWT
      stores it server-side                       (server stores NOTHING)
    → server sends session ID                   → client stores the JWT
      as a cookie                                  and sends it on every
                                                     request (Authorization header)
  Every request:                               Every request:
    server looks up session ID                   server verifies the JWT's
    in memory / Redis / DB                       signature — no lookup needed
  ──────────────────────────                   ──────────────────────────
  Scaling a cluster requires                   Any server instance can verify
  sticky sessions or a shared                  any token independently — the
  session store                                token itself carries all state
```

The core tradeoff: **sessions are stateful** (the server must remember who's logged in), while **JWTs are stateless** (the server verifies a cryptographic signature and trusts the claims embedded in the token itself, with nothing to look up). Stateless auth scales horizontally without shared session storage, which is exactly what a REST API backing mobile/SPA clients and running behind a load balancer needs. The tradeoff is that a JWT, once issued, cannot easily be revoked before its expiry — there is no server-side session to simply delete (addressed further in Section 9).

---

## 2. JWT Structure — Header, Payload, Signature

A JSON Web Token is a compact string made of three Base64URL-encoded parts separated by dots: `header.payload.signature`.

```
  eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbGljZSIsInJvbGVzIjpbIlVTRVIiXSwiaWF0IjoxNzUyNDAwMDAwLCJleHAiOjE3NTI0MDM2MDB9.4f8a2b...

  ┌──────────────────────┐ . ┌──────────────────────────────────────┐ . ┌───────────┐
  │       HEADER         │   │              PAYLOAD                 │   │ SIGNATURE │
  │  (Base64URL JSON)     │   │        (Base64URL JSON)              │   │           │
  └──────────────────────┘   └──────────────────────────────────────┘   └───────────┘
```

**Header** — declares the signing algorithm and token type:
```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload** — the "claims", arbitrary key/value data about the subject and the token itself. Standard registered claims include `sub` (subject/username), `iat` (issued-at, epoch seconds), `exp` (expiry, epoch seconds), `iss` (issuer). Custom claims (e.g., `roles`) can be added freely:
```json
{ "sub": "alice", "roles": ["USER"], "iat": 1752400000, "exp": 1752403600 }
```

**Signature** — computed over the encoded header and payload using a secret key (HMAC, e.g., `HS256`) or a private key (asymmetric, e.g., `RS256`):
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secretKey
)
```

Two critical properties learners frequently misunderstand:

- **The header and payload are encoded, not encrypted.** Anyone who intercepts the token can decode and read the claims — Base64URL is trivially reversible. Never put secrets (passwords, credit card numbers) in a JWT payload.
- **The signature does not hide the payload — it only proves the payload wasn't tampered with.** If an attacker changes even one character of the payload, re-encodes it, and doesn't have the secret key, the signature verification on the server will fail and the token will be rejected.

---

## 3. The Stateless Authentication Flow

```
  1. POST /api/auth/login  { username, password }
          │
          ▼
     AuthenticationManager verifies credentials
     (DaoAuthenticationProvider + UserDetailsService + PasswordEncoder,
      exactly as in Lesson 01)
          │
          ▼ success
     JwtService generates a signed JWT containing sub, roles, iat, exp
          │
          ▼
     Server responds: { "token": "eyJhbGc..." }
          (no session created, nothing stored server-side)

  2. Client stores the token and sends it on every subsequent request:
          GET /api/orders
          Authorization: Bearer eyJhbGc...
          │
          ▼
     Custom JwtAuthenticationFilter (a OncePerRequestFilter) intercepts
     the request BEFORE UsernamePasswordAuthenticationFilter:
       - extracts the token from the Authorization header
       - validates signature + expiry
       - loads UserDetails for the subject claim
       - builds an authenticated Authentication object
       - stores it in SecurityContextHolder for this request only
          │
          ▼
     AuthorizationFilter evaluates authorizeHttpRequests as normal
          │
          ▼
     Request reaches the controller, fully authenticated
          │
          ▼ (end of request)
     SecurityContext is discarded — nothing persists between requests
```

The critical architectural point: because `SessionCreationPolicy.STATELESS` is configured (Section 7), Spring Security never creates or reads an `HttpSession`. The `SecurityContext` is rebuilt from scratch, from the token, on every single request. This is what makes horizontal scaling trivial — any server instance holding the same signing secret can validate any token independently.

---

## 4. Generating Tokens with jjwt

The `jjwt` library (`io.jsonwebtoken`) is the most common choice for JWT handling in Spring Boot. Add the dependencies (API, implementation, and Jackson support are split into separate artifacts since jjwt 0.11+):

```xml
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
```

```java
package com.example.security.jwt;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMillis;

    public JwtService(@Value("${jwt.secret}") String base64Secret,
                       @Value("${jwt.expiration-ms:3600000}") long expirationMillis) {
        // secret must be a Base64-encoded key of sufficient length for the algorithm
        // (>= 256 bits / 32 bytes for HS256) - never a short, guessable string
        this.signingKey = Keys.hmacShaKeyFor(java.util.Base64.getDecoder().decode(base64Secret));
        this.expirationMillis = expirationMillis;
    }

    public String generateToken(String username, List<String> roles) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMillis);

        return Jwts.builder()
                .subject(username)
                .claims(Map.of("roles", roles))
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey) // algorithm is inferred from the key type (HS256 for a 256-bit HMAC key)
                .compact();
    }
}
```

```properties
# application.properties
# Generate with: openssl rand -base64 32
jwt.secret=Zm9vYmFyYmF6cXV1eGNvcnJlY3Rob3JzZWJhdHRlcnlzdGFwbGU=
jwt.expiration-ms=3600000
```

Never hardcode the signing secret in source code. Load it from configuration (environment variable, secrets manager, or externalized `application.properties` excluded from version control) and generate it with a cryptographically secure random generator — `openssl rand -base64 32` produces a suitable 256-bit key for `HS256`.

---

## 5. Validating Tokens with jjwt

Validation must check the signature, the expiry, and gracefully handle every failure mode as "invalid token" rather than leaking internal detail:

```java
package com.example.security.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.List;

@Service
public class JwtValidator {

    private final SecretKey signingKey;

    public JwtValidator(@Value("${jwt.secret}") String base64Secret) {
        this.signingKey = Keys.hmacShaKeyFor(java.util.Base64.getDecoder().decode(base64Secret));
    }

    /** Returns the parsed claims if the token is valid, or empty if invalid/expired/tampered. */
    public java.util.Optional<Claims> validateAndParse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)   // explicitly pins the expected key/algorithm family
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return java.util.Optional.of(claims);
        } catch (ExpiredJwtException e) {
            return java.util.Optional.empty(); // token expired
        } catch (JwtException | IllegalArgumentException e) {
            return java.util.Optional.empty(); // malformed, bad signature, or unsupported token
        }
    }

    public String extractUsername(Claims claims) {
        return claims.getSubject();
    }

    @SuppressWarnings("unchecked")
    public List<String> extractRoles(Claims claims) {
        return claims.get("roles", List.class);
    }
}
```

Calling `.verifyWith(signingKey)` before `.build()` is what makes `parseSignedClaims` throw for a tampered payload, an unsigned token, or a signature produced with a different key — jjwt recomputes the expected signature over the received header+payload and compares it to the one embedded in the token, character for character.

---

## 6. Building a Custom JWT Authentication Filter

The filter runs once per request, extracts the bearer token, validates it, and — if valid — populates the `SecurityContext` so downstream filters and the controller see an authenticated user. Extending `OncePerRequestFilter` (rather than plain `Filter`) guarantees it executes exactly once per request even in forward/include scenarios.

```java
package com.example.security.jwt;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String HEADER_NAME = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtValidator jwtValidator;

    public JwtAuthenticationFilter(JwtValidator jwtValidator) {
        this.jwtValidator = jwtValidator;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader(HEADER_NAME);

        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response); // no token — let it fall through
            return;                                  // (will be rejected downstream if the endpoint requires auth)
        }

        String token = header.substring(BEARER_PREFIX.length());

        Optional<Claims> maybeClaims = jwtValidator.validateAndParse(token);

        if (maybeClaims.isPresent() && SecurityContextHolder.getContext().getAuthentication() == null) {
            Claims claims = maybeClaims.get();
            String username = jwtValidator.extractUsername(claims);
            List<String> roles = jwtValidator.extractRoles(claims);

            List<GrantedAuthority> authorities = roles.stream()
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                    .toList();

            var authToken = new UsernamePasswordAuthenticationToken(
                    username, null, authorities); // no credentials needed post-validation
            authToken.setDetails(
                    new org.springframework.security.web.authentication.WebAuthenticationDetailsSource()
                            .buildDetails(request));

            SecurityContextHolder.getContext().setAuthentication(authToken);
        }
        // an invalid/expired token is simply ignored here — the request proceeds
        // unauthenticated, and AuthorizationFilter will reject it later with 401/403
        // if the endpoint requires authentication. We do NOT throw here, so that
        // public endpoints on the same filter chain remain reachable.

        filterChain.doFilter(request, response);
    }
}
```

Two design decisions in this filter are worth calling out explicitly:

- It never throws on an invalid token — it simply leaves the `SecurityContext` empty and lets the request continue. `AuthorizationFilter`, later in the chain, is what actually rejects the request if the target endpoint requires authentication. This keeps public endpoints (e.g., `/api/auth/login`) reachable through the same filter chain even without a valid token.
- It checks `SecurityContextHolder.getContext().getAuthentication() == null` before overwriting — defensive against being run twice or after another mechanism already authenticated the request.

---

## 7. Configuring SecurityFilterChain for Stateless Sessions

Registering the filter and disabling session creation entirely:

```java
package com.example.security.config;

import com.example.security.jwt.JwtAuthenticationFilter;
import com.example.security.jwt.JwtValidator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class JwtSecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtValidator jwtValidator) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // safe to disable: no cookies/session, so no CSRF surface
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // never create or use HttpSession
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(
                new JwtAuthenticationFilter(jwtValidator),
                UsernamePasswordAuthenticationFilter.class // run our filter before form-login's filter
            );

        return http.build();
    }
}
```

`SessionCreationPolicy.STATELESS` is what tells Spring Security's `SecurityContextHolderFilter` never to look up or create an `HttpSession` at all — combined with never issuing a `JSESSIONID` cookie, this makes the API genuinely stateless end to end. `.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)` places the JWT filter at the correct position in the ordered chain described in Lesson 01, Section 3 — early enough to populate the `SecurityContext` before any authentication-dependent filter runs.

---

## 8. Worked Example: Full Login and Protected Endpoint Flow

The login endpoint that issues a token, using the same `AuthenticationManager`/`UserDetailsService` machinery from Lesson 01:

```java
package com.example.security.web;

import com.example.security.jwt.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

record LoginRequest(String username, String password) {}
record LoginResponse(String token) {}

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        // Delegates to DaoAuthenticationProvider -> UserDetailsService -> PasswordEncoder,
        // exactly the same chain as Lesson 01. Throws BadCredentialsException on failure,
        // which a @ControllerAdvice maps to a 401 response.
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(a -> a.replace("ROLE_", ""))
                .toList();

        String token = jwtService.generateToken(authentication.getName(), roles);
        return new LoginResponse(token);
    }
}
```

A protected controller needs no special code at all — the `JwtAuthenticationFilter` has already populated the `SecurityContext` by the time the request arrives:

```java
package com.example.security.web;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    @GetMapping("/me")
    public String whoAmI(Authentication authentication) {
        return "Authenticated as: " + authentication.getName();
    }
}
```

End-to-end verification with curl:

```bash
# 1. Log in and capture the token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"alice-pass"}' | jq -r .token)

# 2. Use the token on a protected endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/profile/me
# => Authenticated as: alice

# 3. Without a token — rejected
curl -i http://localhost:8080/api/profile/me
# => HTTP/1.1 401/403 (no session, no valid token, request denied)
```

---

## 9. Common Security Pitfalls

- **Storing JWTs in `localStorage` instead of an httpOnly cookie.** JavaScript running on the page can read `localStorage`, so any XSS vulnerability anywhere on the site immediately exposes every stored token to the attacker for exfiltration. An httpOnly, `Secure`, `SameSite=Strict` cookie is inaccessible to JavaScript entirely, closing that exfiltration path — at the cost of needing CSRF protection again, since cookies are sent automatically by the browser.
- **Missing or unchecked token expiry.** A JWT validator that only checks the signature but not `exp` will happily accept a token forever. Always let the library enforce `exp` (as `jjwt`'s `parseSignedClaims` does automatically, throwing `ExpiredJwtException`) and never silently swallow that exception as "valid."
- **Algorithm confusion attacks.** If a server accepts whatever `alg` the incoming token's header claims and blindly uses it, an attacker can craft a token with `"alg": "none"` (no signature required by the parser) or switch an asymmetric `RS256`-signed system to `HS256` and sign it using the *public* key (which is, well, public) as an HMAC secret. The fix is to never let the token dictate the algorithm — pin the expected algorithm/key explicitly on the parser side, exactly as `.verifyWith(signingKey)` does in Section 5, and reject any token whose header doesn't match the expected algorithm.
- **No revocation strategy.** Unlike a session, a JWT cannot be deleted from server-side storage — once issued, it's valid until it expires. Compromised tokens, logged-out users, or terminated employees all remain "valid" per the token's own claims. Mitigate with short expiry times (minutes to low hours) plus a refresh-token flow, or maintain a small server-side denylist (a Redis set of revoked token IDs, checked before honoring an otherwise-valid token).
- **Weak or hardcoded signing secrets.** A short, guessable, or committed-to-source-control HMAC secret can be brute-forced offline, letting an attacker forge arbitrary valid tokens. Use a properly random 256-bit+ secret, injected via environment variable or secrets manager, never checked into version control.
- **Putting sensitive data in the payload.** JWT payloads are Base64URL-encoded, not encrypted — anyone holding the token can decode and read every claim. Never include passwords, full card numbers, or other sensitive PII directly in the token.
- **Reusing the same secret across environments.** Sharing one signing secret between staging and production means a token issued (or leaked) in a lower, less-hardened environment is valid in production too.

---

## 10. Best Practices

- Prefer httpOnly, `Secure`, `SameSite=Strict` cookies over `localStorage` for browser-based clients; reserve raw `Authorization: Bearer` headers for server-to-server or native/mobile clients where XSS via the browser DOM isn't a factor.
- Keep access-token lifetimes short (minutes to a couple of hours) and pair them with a longer-lived, securely stored refresh token that can be revoked independently.
- Always pin the expected signing algorithm and key on the verifying side (`.verifyWith(signingKey)`); never trust the `alg` header from the incoming token to select verification behavior.
- Generate signing secrets with a cryptographically secure random generator (`openssl rand -base64 32` or equivalent) sized appropriately for the algorithm (256 bits minimum for HS256), and load them from environment/secrets management, never source code.
- Set `SessionCreationPolicy.STATELESS` explicitly and disable CSRF only after confirming the API is genuinely cookie-free — don't disable CSRF out of habit on an app that still uses session cookies elsewhere.
- Return generic 401 responses for any authentication failure (missing token, expired token, bad signature) — don't leak which specific validation step failed.
- Log token validation failures (rate-limited, without logging the token itself) for anomaly detection, since a spike in invalid-signature failures can indicate an active attack.

---

## 11. Hands-On Exercises

**Exercise 1:** Add the `jjwt` dependencies to a Spring Boot 3 project, implement `JwtService.generateToken` and `JwtValidator.validateAndParse` from Sections 4–5, and write a plain JUnit test (no Spring context needed) that generates a token, validates it successfully, then mutates one character of the payload segment and confirms validation now fails.

**Exercise 2:** Implement `JwtAuthenticationFilter` and wire it into a `SecurityFilterChain` with `SessionCreationPolicy.STATELESS`, as in Sections 6–7. Build the `/api/auth/login` and a protected `/api/profile/me` endpoint from Section 8. Verify with curl that a valid token succeeds, an expired token (set a 5-second expiry for the test) is rejected after waiting 6 seconds, and a request with no `Authorization` header at all is rejected.

**Exercise 3:** Deliberately shorten `jwt.expiration-ms` to 10000 (10 seconds) and confirm via curl that a token issued at login is rejected exactly once it passes the 10-second mark, demonstrating that `ExpiredJwtException` is being correctly enforced rather than silently ignored.

**Exercise 4:** Simulate an algorithm confusion attempt: construct a JWT by hand with header `{"alg":"none","typ":"JWT"}` and no signature segment, using a payload claiming `sub: "admin"`. Attempt to submit it to your protected endpoint and confirm `jjwt`'s parser rejects it outright (it does not honor `"alg": "none"` by default). Explain in your own words why a naive, hand-rolled JWT parser that trusted the header's `alg` field would be vulnerable here.

**Exercise 5:** Add a minimal token revocation mechanism: an in-memory (or Redis-backed) `Set<String>` of revoked token IDs (`jti` claim), a `/api/auth/logout` endpoint that adds the current token's `jti` to the set, and a check in `JwtAuthenticationFilter` that rejects any token whose `jti` is present in the revoked set even if the signature and expiry are otherwise valid. Verify that a token still passes signature/expiry checks but is now rejected after logout.

---

## 12. Interview Q&A

**Q: Why is JWT-based authentication called "stateless," and why does that matter for REST APIs?**
Answer: It's stateless because the server stores nothing about the authenticated session between requests — every request carries a self-contained, signed token with all the claims (subject, roles, expiry) needed to authenticate it, and the server merely verifies the signature and reads the claims. This contrasts with session-based auth, where the server must persist session state (in memory, a database, or a distributed cache like Redis) and look it up on every request. For REST APIs behind a load balancer or scaled across many instances, statelessness means any instance holding the same signing key can independently validate any request without shared session storage or sticky sessions.

**Q: What are the three parts of a JWT, and what does the signature actually protect against?**
Answer: A JWT has a header (declares the algorithm and token type), a payload (the claims — subject, roles, issued-at, expiry, and any custom data), and a signature, all Base64URL-encoded and joined with dots. The signature is computed over the encoded header and payload using a secret (HMAC) or private key (asymmetric signing), and it protects against tampering, not disclosure — anyone can decode and read the header and payload since Base64URL is trivially reversible, but they cannot modify the claims without invalidating the signature, since recomputing a valid signature requires the secret/private key.

**Q: What is an algorithm confusion attack against JWTs, and how do you prevent it?**
Answer: It exploits a validator that trusts the `alg` field in the token's own header to decide how to verify it. One variant: an attacker sets `"alg": "none"` and strips the signature, hoping a lenient parser accepts an unsigned token as valid. Another: in a system using asymmetric `RS256` (public key verifies, private key signs), an attacker resigns a forged token with `HS256`, using the (publicly known) RSA public key as the HMAC secret — if the validator blindly follows the token's declared `alg` and tries HMAC verification with that same public key string, the forged signature checks out. The fix is to never let the incoming token dictate verification behavior: pin the expected algorithm and key explicitly on the verifying side, exactly as calling `.verifyWith(signingKey)` on a parser configured for one known key/algorithm does, and reject anything that doesn't match.

**Q: Why is storing a JWT in `localStorage` risky, and what's the safer alternative?**
Answer: `localStorage` is readable by any JavaScript executing on the page, so a single XSS vulnerability anywhere on the site (a compromised third-party script, an unsanitized user input rendered as HTML) lets an attacker's injected script read and exfiltrate every token stored there. An httpOnly cookie is inaccessible to JavaScript entirely — the browser attaches it automatically to requests but scripts cannot read or steal it — which closes that specific exfiltration path. The tradeoff is that cookie-based storage reopens CSRF as a concern (since the browser sends the cookie automatically on cross-site requests too), so it needs to be paired with `SameSite=Strict`/`Lax` and, if needed, CSRF tokens.

**Q: How do you handle logging a user out, or revoking access, when using stateless JWTs?**
Answer: Because there's no server-side session to delete, a JWT remains cryptographically valid until its `exp` claim passes, regardless of a "logout" request. The standard mitigation combines short-lived access tokens (minutes to a couple hours) with a separate, longer-lived refresh token that the server *can* revoke (since refresh tokens are typically tracked server-side, e.g., in a database or Redis). For immediate revocation needs (compromised token, terminated employee), maintain a lightweight denylist of revoked token IDs (using the `jti` claim) checked on every request alongside the signature/expiry check — this reintroduces a small amount of state but keeps it minimal compared to full session storage.

**Q: Where does a custom JWT authentication filter need to sit in the Spring Security filter chain, and why?**
Answer: It must run before any filter that would otherwise try (and fail) to authenticate the request through a different mechanism — typically registered with `.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)`. This ensures that by the time `UsernamePasswordAuthenticationFilter`, `BasicAuthenticationFilter`, and ultimately `AuthorizationFilter` run, the `SecurityContext` already holds a valid, authenticated principal if a valid bearer token was present. The filter itself should never throw on an invalid or missing token — it should silently leave the request unauthenticated and let `AuthorizationFilter` reject it downstream if the target endpoint requires authentication, which keeps public endpoints on the same chain (like `/api/auth/login`) reachable.
