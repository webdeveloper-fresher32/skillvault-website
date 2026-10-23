# Security Filter Chain and Authentication — Complete Guide

## Table of Contents
1. [Why Spring Security Feels Hard](#1-why-spring-security-feels-hard)
2. [The Servlet Filter Chain — DelegatingFilterProxy and FilterChainProxy](#2-the-servlet-filter-chain--delegatingfilterproxy-and-filterchainproxy)
3. [The Standard Security Filter Order](#3-the-standard-security-filter-order)
4. [The SecurityFilterChain Bean — Modern Lambda DSL](#4-the-securityfilterchain-bean--modern-lambda-dsl)
5. [AuthenticationManager and AuthenticationProvider](#5-authenticationmanager-and-authenticationprovider)
6. [UserDetailsService and UserDetails](#6-userdetailsservice-and-userdetails)
7. [Password Encoding with BCryptPasswordEncoder](#7-password-encoding-with-bcryptpasswordencoder)
8. [Worked Example: Form Login with In-Memory Authentication](#8-worked-example-form-login-with-in-memory-authentication)
9. [Worked Example: Database-Backed Authentication](#9-worked-example-database-backed-authentication)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Spring Security Feels Hard

Most Spring modules follow a simple pattern: annotate a class, Spring Boot auto-configures the rest. Spring Security is different — authentication and authorization happen through a **chain of servlet filters** that run before your controller code is ever reached. If you don't understand the filter chain, the framework looks like magic: requests get rejected with 403s for reasons that aren't visible anywhere in your `@RestController`.

The good news is that the model, once seen clearly, is mechanical and predictable:

```
  1. A request arrives at the servlet container (Tomcat)
  2. It passes through a chain of servlet Filters before reaching your DispatcherServlet
  3. Spring Security inserts itself into that chain as ONE filter: DelegatingFilterProxy
  4. That one filter delegates to a whole internal chain of security-specific filters
  5. Those filters authenticate the request, then authorize it
  6. Only if both succeed does the request reach your @RestController
```

This lesson walks through that pipeline end to end: how the filter chain is wired, how `SecurityFilterChain` beans are configured in Spring Security 6.x, and how authentication actually happens via `AuthenticationManager`, `AuthenticationProvider`, and `UserDetailsService`.

---

## 2. The Servlet Filter Chain — DelegatingFilterProxy and FilterChainProxy

Spring Security does not hook into Spring MVC directly. It hooks into the **servlet container's filter chain**, which runs before Spring MVC's `DispatcherServlet` is invoked at all. This is a deliberate design choice: it means security filtering happens regardless of which web framework sits behind it.

Spring Boot auto-registers a single servlet `Filter` called `DelegatingFilterProxy` under the name `springSecurityFilterChain`. Its only job is to delegate every request to a Spring-managed bean — `FilterChainProxy` — which is where the real work happens.

```
  Servlet Container (Tomcat)
  ┌──────────────────────────────────────────────────────────────┐
  │  Filter 1  →  Filter 2  →  DelegatingFilterProxy  →  ...      │
  │                                    │                          │
  │                                    │ delegates to             │
  │                                    ▼                          │
  │                       FilterChainProxy (Spring bean)          │
  │                     ┌───────────────────────────────┐         │
  │                     │  SecurityFilterChain #1        │         │
  │                     │    (matches /api/**)           │         │
  │                     │  SecurityFilterChain #2        │         │
  │                     │    (matches /admin/**)         │         │
  │                     │  SecurityFilterChain #3        │         │
  │                     │    (matches /**, catch-all)    │         │
  │                     └───────────────────────────────┘         │
  │                                    │                          │
  │                                    ▼                          │
  │                    DispatcherServlet → @RestController        │
  └──────────────────────────────────────────────────────────────┘
```

**Why the indirection?** `DelegatingFilterProxy` is a plain servlet API concept — it is registered directly with the container at startup, before the Spring `ApplicationContext` may even be fully initialized. `FilterChainProxy`, by contrast, is a genuine Spring bean, so it can be wired with dependency injection, configured via `@Configuration` classes, and — critically — hot-swapped in tests. `DelegatingFilterProxy` simply looks up the `FilterChainProxy` bean by name at request time and forwards to it.

`FilterChainProxy` itself holds an ordered list of `SecurityFilterChain` objects. For each incoming request, it walks the list and picks the **first** chain whose request matcher matches the request path. Only that one chain's filters run — chains are mutually exclusive per request, not layered. This is why multiple `SecurityFilterChain` beans (each with a `securityMatcher(...)`) let you apply completely different security rules to `/api/**` versus `/admin/**` versus everything else.

---

## 3. The Standard Security Filter Order

Inside a single matched `SecurityFilterChain`, Spring Security runs a fixed, ordered sequence of filters. Not all of them are always active — they are added or removed based on what your configuration enables (form login, CSRF, HTTP Basic, etc.) — but when present, they always run in this relative order:

| Order | Filter | Responsibility |
|-------|--------|-----------------|
| 1 | `DisableEncodeUrlFilter` | Prevents session IDs from being encoded into URLs |
| 2 | `SecurityContextHolderFilter` | Loads `SecurityContext` from the `SecurityContextRepository` (session or stateless) for this request |
| 3 | `CsrfFilter` | Validates the CSRF token on state-changing requests |
| 4 | `LogoutFilter` | Handles logout requests, clears authentication |
| 5 | `UsernamePasswordAuthenticationFilter` | Processes form-login POST submissions |
| 6 | `BasicAuthenticationFilter` | Processes `Authorization: Basic` headers |
| 7 | *(your custom JWT filter goes here)* | e.g., a `OncePerRequestFilter` validating bearer tokens (see Lesson 03) |
| 8 | `RequestCacheAwareFilter` | Replays the originally requested URL after a successful login redirect |
| 9 | `SecurityContextHolderAwareRequestFilter` | Wraps the request so `HttpServletRequest.getUserPrincipal()` etc. work |
| 10 | `ExceptionTranslationFilter` | Catches `AuthenticationException` / `AccessDeniedException` and triggers entry points |
| 11 | `AuthorizationFilter` | The final gate — evaluates `authorizeHttpRequests` rules; denies with 403 if unauthorized |

`ExceptionTranslationFilter` deserves special attention: it sits just before `AuthorizationFilter` and acts as a try/catch around everything downstream. If `AuthorizationFilter` throws `AccessDeniedException` (user authenticated but lacks permission), it delegates to an `AccessDeniedHandler` (typically a 403 response). If any filter throws `AuthenticationException` (user not authenticated at all), it delegates to an `AuthenticationEntryPoint` (typically a redirect to `/login` for browsers, or a 401 for APIs).

```
  Request comes in
        │
        ▼
  SecurityContextHolderFilter  (load existing auth, if any)
        │
        ▼
  CsrfFilter
        │
        ▼
  UsernamePasswordAuthenticationFilter / BasicAuthenticationFilter / your JWT filter
        │   (attempts authentication, populates SecurityContext on success)
        ▼
  ExceptionTranslationFilter  ── catches exceptions thrown below ──┐
        │                                                          │
        ▼                                                          │
  AuthorizationFilter  (checks authorizeHttpRequests rules)        │
        │                                                          │
        ├─ allowed ──▶ DispatcherServlet ──▶ @RestController       │
        │                                                          │
        └─ AuthenticationException / AccessDeniedException ────────┘
                          │
                          ▼
              AuthenticationEntryPoint (401) or AccessDeniedHandler (403)
```

A custom JWT authentication filter is almost always inserted **before** `UsernamePasswordAuthenticationFilter` using `.addFilterBefore(...)`, so that a valid bearer token can populate the `SecurityContext` before Spring Security's own form-login/basic-auth filters get a chance to run (and typically fail, since there's no session or Basic header on a JWT-only API). This is covered in depth in Lesson 03.

---

## 4. The SecurityFilterChain Bean — Modern Lambda DSL

Since Spring Security 5.7 (and mandatory since 6.0), `WebSecurityConfigurerAdapter` is **removed**. The extension-based model is replaced entirely by exposing one or more `SecurityFilterChain` beans built with a component-based lambda DSL. This is a fundamental shift: instead of overriding methods on a base class, you compose configuration as data.

```java
package com.example.security.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**", "/actuator/health").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .formLogin(withDefaults())
            .httpBasic(withDefaults());

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

Key points about this DSL:

- Every configuration aspect (`csrf`, `authorizeHttpRequests`, `formLogin`, `sessionManagement`, etc.) takes a `Customizer<T>` lambda. `Customizer.withDefaults()` applies Spring Security's default behavior for that feature without any customization.
- `HttpSecurity` is a builder. Calling `.build()` at the end produces the immutable `SecurityFilterChain`.
- Method chaining returns the *same* `HttpSecurity` instance, so you can keep calling `.andThen`-style configuration in one fluent expression.
- Rules inside `authorizeHttpRequests` are evaluated **top to bottom, first match wins** — just like `SecurityFilterChain` matching itself. Always put the most specific matchers first and `anyRequest()` last.

### Multiple SecurityFilterChain Beans

You can register more than one `SecurityFilterChain` bean, each scoped with `.securityMatcher(...)`, to apply entirely different rules to different parts of your application (e.g., stateless JWT rules for `/api/**` and stateful form-login rules for everything else). When multiple beans exist, give each an explicit `@Order` — `FilterChainProxy` evaluates them in that order and uses the first matching one.

```java
@Bean
@Order(1)
public SecurityFilterChain apiFilterChain(HttpSecurity http) throws Exception {
    http
        .securityMatcher("/api/**")
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.STATELESS));
    return http.build();
}

@Bean
@Order(2)
public SecurityFilterChain webFilterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .formLogin(withDefaults());
    return http.build();
}
```

---

## 5. AuthenticationManager and AuthenticationProvider

Authentication in Spring Security is deliberately split into two roles:

- **`AuthenticationManager`** is the entry point. Filters call `authenticationManager.authenticate(authenticationRequest)` and get back either a fully populated `Authentication` (success) or an `AuthenticationException` (failure). Its default implementation, `ProviderManager`, does not itself know *how* to check credentials — it delegates.
- **`AuthenticationProvider`** does the actual work. `ProviderManager` holds a list of them and tries each in turn until one supports the given `Authentication` type and successfully authenticates it (or all of them fail/abstain).

```
  UsernamePasswordAuthenticationFilter
          │  builds an unauthenticated
          │  UsernamePasswordAuthenticationToken(username, password)
          ▼
  AuthenticationManager (ProviderManager)
          │
          │  tries each provider in order:
          ▼
  ┌─────────────────────────────┐   ┌─────────────────────────────┐
  │ DaoAuthenticationProvider   │   │ LdapAuthenticationProvider  │  ...
  │  - loads UserDetails        │   │  (not used in this example) │
  │  - checks password via      │   └─────────────────────────────┘
  │    PasswordEncoder          │
  └─────────────────────────────┘
          │  success
          ▼
  Fully populated Authentication (principal, authorities, authenticated=true)
          │
          ▼
  Stored in SecurityContextHolder for the rest of the request
```

The built-in `DaoAuthenticationProvider` is the one used for username/password login. It delegates to a `UserDetailsService` to load the user, and a `PasswordEncoder` to verify the submitted password against the stored hash. You rarely need to write a custom `AuthenticationProvider` for standard username/password flows — supplying a `UserDetailsService` and `PasswordEncoder` bean is enough, and Spring Boot auto-configures `DaoAuthenticationProvider` and wraps it in a `ProviderManager` for you.

You would write a **custom** `AuthenticationProvider` for non-standard credential types — for example, authenticating against a third-party SSO token, or verifying a one-time code alongside the password:

```java
package com.example.security.auth;

import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class CustomAuthenticationProvider implements AuthenticationProvider {

    private final UserDetailsService userDetailsService;
    private final PasswordEncoder passwordEncoder;

    public CustomAuthenticationProvider(UserDetailsService userDetailsService,
                                         PasswordEncoder passwordEncoder) {
        this.userDetailsService = userDetailsService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        String username = authentication.getName();
        String rawPassword = authentication.getCredentials().toString();

        UserDetails user = userDetailsService.loadUserByUsername(username);

        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new BadCredentialsException("Invalid username or password");
        }

        return new UsernamePasswordAuthenticationToken(
                user, user.getPassword(), user.getAuthorities());
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
```

Registering it explicitly (instead of relying on the auto-configured `DaoAuthenticationProvider`) requires exposing an `AuthenticationManager` bean built from an `AuthenticationManagerBuilder`, or — in modern Spring Security — simply declaring the `AuthenticationProvider` as a `@Component`/`@Bean`; Spring Boot picks it up automatically when building the default `ProviderManager`.

---

## 6. UserDetailsService and UserDetails

`UserDetailsService` is the single-method contract that connects Spring Security to *your* user store, whatever it is (a database, LDAP, an in-memory map, a remote API):

```java
public interface UserDetailsService {
    UserDetails loadUserByUsername(String username) throws UsernameNotFoundException;
}
```

`UserDetails` is the corresponding contract describing an authenticated principal:

```java
public interface UserDetails extends Serializable {
    Collection<? extends GrantedAuthority> getAuthorities();
    String getPassword();
    String getUsername();
    boolean isAccountNonExpired();
    boolean isAccountNonLocked();
    boolean isCredentialsNonExpired();
    boolean isEnabled();
}
```

Spring Security ships a convenient builder and default implementation, `org.springframework.security.core.userdetails.User`, so you rarely implement `UserDetails` from scratch for simple cases:

```java
UserDetails user = org.springframework.security.core.userdetails.User
        .withUsername("alice")
        .password(encodedPassword)
        .roles("USER")            // becomes authority "ROLE_USER"
        .build();
```

For a real application backed by a JPA entity, you typically wrap your own `User` entity in a custom `UserDetails` implementation (or adapt it) and implement `UserDetailsService` against your repository — shown in full in Section 9.

---

## 7. Password Encoding with BCryptPasswordEncoder

Spring Security never stores or compares plaintext passwords. The `PasswordEncoder` interface has two methods:

```java
public interface PasswordEncoder {
    String encode(CharSequence rawPassword);
    boolean matches(CharSequence rawPassword, String encodedPassword);
}
```

`BCryptPasswordEncoder` is the standard choice. BCrypt is a deliberately slow, adaptive hashing algorithm (based on the Blowfish cipher) designed to resist brute-force and rainbow-table attacks — its cost factor can be tuned upward as hardware gets faster, unlike a fast general-purpose hash like SHA-256.

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12); // strength/cost factor, default is 10
}
```

Two properties of BCrypt output matter for understanding it:

- **The salt is embedded in the output hash itself** — you never manage salts separately. Two calls to `encode("password123")` produce two *different* strings, both of which `matches()` will correctly validate against the original raw password.
- **Never compare encoded hashes with `.equals()`.** Always use `passwordEncoder.matches(raw, encoded)` — this is precisely why `matches()` exists instead of just re-encoding and comparing strings.

```java
PasswordEncoder encoder = new BCryptPasswordEncoder();

String hash1 = encoder.encode("password123");
String hash2 = encoder.encode("password123");
// hash1 != hash2 (different salts), but both are valid:
encoder.matches("password123", hash1); // true
encoder.matches("password123", hash2); // true
```

---

## 8. Worked Example: Form Login with In-Memory Authentication

A minimal but complete configuration using in-memory users — useful for prototyping, demos, or as a baseline before wiring up a database:

```java
package com.example.security.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
public class InMemorySecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(PasswordEncoder passwordEncoder) {
        UserDetails user = User.withUsername("user")
                .password(passwordEncoder.encode("user-pass"))
                .roles("USER")
                .build();

        UserDetails admin = User.withUsername("admin")
                .password(passwordEncoder.encode("admin-pass"))
                .roles("USER", "ADMIN")
                .build();

        return new InMemoryUserDetailsManager(user, admin);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/login", "/css/**").permitAll()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .defaultSuccessUrl("/dashboard", true)
                .permitAll()
            )
            .logout(withDefaults());

        return http.build();
    }
}
```

Note that `UserDetailsService` here is registered as a `@Bean`. Spring Boot's auto-configuration detects it, wires it into a `DaoAuthenticationProvider`, and builds the `AuthenticationManager` automatically — you do not need to manually construct an `AuthenticationManagerBuilder` for this simple case.

---

## 9. Worked Example: Database-Backed Authentication

The production-realistic version replaces `InMemoryUserDetailsManager` with a JPA-backed `UserDetailsService`.

### The Entity

```java
package com.example.security.model;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password; // BCrypt-encoded, never plaintext

    private boolean enabled = true;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "app_user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role")
    private Set<String> roles = new HashSet<>(); // e.g. "ROLE_USER", "ROLE_ADMIN"

    // getters and setters omitted for brevity
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public boolean isEnabled() { return enabled; }
    public Set<String> getRoles() { return roles; }
}
```

### The Repository

```java
package com.example.security.repository;

import com.example.security.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsername(String username);
}
```

### The UserDetailsService Implementation

```java
package com.example.security.security;

import com.example.security.model.AppUser;
import com.example.security.repository.AppUserRepository;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DatabaseUserDetailsService implements UserDetailsService {

    private final AppUserRepository userRepository;

    public DatabaseUserDetailsService(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        AppUser appUser = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "No user found with username: " + username));

        List<GrantedAuthority> authorities = appUser.getRoles().stream()
                .map(SimpleGrantedAuthority::new) // roles already stored as "ROLE_XXX"
                .toList();

        return User.withUsername(appUser.getUsername())
                .password(appUser.getPassword())
                .authorities(authorities)
                .disabled(!appUser.isEnabled())
                .build();
    }
}
```

### The Security Configuration

```java
package com.example.security.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
public class DatabaseSecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // DatabaseUserDetailsService is already a @Service bean — Spring Boot's
    // auto-configuration wires it, together with the PasswordEncoder bean,
    // into a DaoAuthenticationProvider automatically. No manual
    // AuthenticationManagerBuilder wiring needed.

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .formLogin(withDefaults())
            .httpBasic(withDefaults());

        return http.build();
    }
}
```

Registering a new user must always go through the `PasswordEncoder`, never store raw input:

```java
@Service
public class RegistrationService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public RegistrationService(AppUserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public AppUser register(String username, String rawPassword) {
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(rawPassword)); // encode before saving
        user.getRoles().add("ROLE_USER");
        return userRepository.save(user);
    }
}
```

---

## 10. Common Pitfalls

- **Using `WebSecurityConfigurerAdapter`.** It was deprecated in Spring Security 5.7 and fully removed in 6.0. Any tutorial or Stack Overflow answer that extends it targets an obsolete API — use `SecurityFilterChain` beans instead.
- **Comparing password hashes with `.equals()`.** BCrypt hashes embed a random salt, so re-encoding and string-comparing will never match even for the correct password. Always call `passwordEncoder.matches(raw, encoded)`.
- **Forgetting that `authorizeHttpRequests` rules are order-sensitive.** The first matching rule wins. Placing `.anyRequest().authenticated()` before a more specific `.requestMatchers("/api/admin/**").hasRole("ADMIN")` means the admin-only rule never gets evaluated.
- **Disabling CSRF globally without understanding why.** CSRF protection matters for browser-based, cookie/session-authenticated apps. It is safe (and standard) to disable for stateless, token-authenticated REST APIs — but disabling it on a session-based app with a login form reopens a real vulnerability.
- **Forgetting `ROLE_` prefix confusion.** `.hasRole("ADMIN")` implicitly checks for the authority string `"ROLE_ADMIN"`. If you store or grant a raw authority `"ADMIN"` without the prefix, `hasRole("ADMIN")` will never match — you'd need `.hasAuthority("ADMIN")` instead.
- **Assuming `UserDetailsService` beans are enough without a `PasswordEncoder` bean.** If no `PasswordEncoder` bean is present, Spring Boot falls back to a `DelegatingPasswordEncoder` with a deprecated default, and you'll see confusing runtime warnings about unmapped password prefixes (`{noop}`, `{bcrypt}`).
- **Exposing full stack traces or `UsernameNotFoundException` messages to clients.** Distinguishing "user not found" from "bad password" in an error response leaks which usernames exist in the system (a user enumeration vulnerability).

---

## 11. Best Practices

- Always define an explicit `PasswordEncoder` bean (`BCryptPasswordEncoder`) rather than relying on defaults — make the encoding strategy visible and intentional in your configuration.
- Keep `SecurityFilterChain` rules ordered from most-specific to least-specific, ending in a catch-all `anyRequest().authenticated()` (never `permitAll()` as a catch-all in production).
- Prefer `hasRole`/`hasAnyRole` for role-based checks and reserve `hasAuthority` for fine-grained permissions that are not simple roles (e.g., `"perm:invoice:approve"`).
- Separate `SecurityFilterChain` beans by concern (`@Order(1)` for `/api/**` stateless rules, a later `@Order` for browser/session-based rules) rather than cramming every rule into one chain with complex matcher logic.
- Never log raw passwords, even at DEBUG level, and never include them in exception messages.
- Return generic authentication failure messages ("Invalid username or password") regardless of whether the username exists or the password was wrong, to prevent user enumeration.
- Increase the BCrypt cost factor (e.g., 12) as hardware improves, and re-hash-on-login is a reasonable migration strategy when raising the cost factor for existing users.

---

## 12. Hands-On Exercises

**Exercise 1:** Create a fresh Spring Boot 3 project with the `spring-boot-starter-security` and `spring-boot-starter-web` dependencies. Without writing any configuration, start the app and observe the auto-generated login page and the randomly generated password printed in the console log. Explain, referencing `FilterChainProxy` and the default `SecurityFilterChain`, why every endpoint is protected out of the box.

**Exercise 2:** Write a `SecurityFilterChain` bean that permits unauthenticated access to `GET /api/public/**` and requires authentication for everything else, using HTTP Basic auth (`.httpBasic(withDefaults())`). Configure an in-memory `UserDetailsService` with one user. Use `curl -u user:password http://localhost:8080/api/private` to verify a 401 without credentials and a 200 with correct credentials.

**Exercise 3:** Implement `DatabaseUserDetailsService` against a real `AppUser` JPA entity and an H2 in-memory database. Seed two users at startup via a `CommandLineRunner` bean, using `PasswordEncoder.encode(...)` for their passwords. Verify form login against both users, and verify that an incorrect password produces a generic "Bad credentials" error rather than leaking whether the username existed.

**Exercise 4:** Add a second `SecurityFilterChain` bean scoped to `/actuator/**` with `@Order(1)`, permitting only `/actuator/health` and requiring `ROLE_ADMIN` for all other actuator endpoints. Give your main application chain `@Order(2)`. Verify with two different users (one plain `USER`, one `ADMIN`) that only the admin can reach `/actuator/beans`.

**Exercise 5:** Deliberately misconfigure `authorizeHttpRequests` by placing `.anyRequest().authenticated()` before a `.requestMatchers("/api/admin/**").hasRole("ADMIN")` rule. Confirm (by testing as a non-admin authenticated user) that the admin-only rule is silently ignored because the earlier `anyRequest()` rule already matched. Fix the ordering and re-verify the admin rule is enforced.

---

## 13. Interview Q&A

**Q: What is the role of `DelegatingFilterProxy` versus `FilterChainProxy` in Spring Security?**
Answer: `DelegatingFilterProxy` is a plain servlet `Filter` registered directly with the servlet container under the name `springSecurityFilterChain`; its only job is to look up and delegate to a Spring-managed bean. `FilterChainProxy` is that bean — a genuine Spring-managed component holding an ordered list of `SecurityFilterChain` objects, each scoped by a request matcher. `FilterChainProxy` picks the first matching chain for each request and runs only its filters. The indirection exists because `DelegatingFilterProxy` must be registered before the Spring `ApplicationContext` is necessarily ready, while `FilterChainProxy` can be fully wired with dependency injection and reconfigured in tests.

**Q: Why was `WebSecurityConfigurerAdapter` removed, and what replaced it?**
Answer: `WebSecurityConfigurerAdapter` encouraged an inheritance-based configuration style — overriding `configure(HttpSecurity)` — that made composition difficult and encouraged large monolithic configuration classes. Since Spring Security 5.7 it was deprecated, and 6.0 removed it entirely in favor of a component-based model: you expose one or more `SecurityFilterChain` beans built with `HttpSecurity` and the lambda DSL. This model composes cleanly (multiple filter chains scoped to different paths), is easier to test, and avoids the fragile-base-class problem inherent in extending a large configurer class.

**Q: What is the difference between `AuthenticationManager` and `AuthenticationProvider`?**
Answer: `AuthenticationManager` is the interface filters call to authenticate a request — it has a single method, `authenticate(Authentication)`. Its standard implementation, `ProviderManager`, does not itself validate credentials; instead it holds an ordered list of `AuthenticationProvider` instances and delegates to whichever one supports the given `Authentication` type. `DaoAuthenticationProvider` is the built-in provider used for username/password login — it loads a `UserDetails` via `UserDetailsService` and checks the password with a `PasswordEncoder`. You write a custom `AuthenticationProvider` when authenticating against non-standard credential types; you rarely need a custom `AuthenticationManager`.

**Q: Why does Spring Security use `BCryptPasswordEncoder` instead of a fast hash like SHA-256?**
Answer: BCrypt is deliberately slow and has a tunable cost factor, which makes brute-force and rainbow-table attacks computationally expensive even as hardware improves — you simply raise the cost factor over time. It also embeds a random salt directly in its output, so identical passwords produce different hashes and you never need to manage salts separately. A fast, unsalted hash like raw SHA-256 can be brute-forced at billions of attempts per second on commodity GPUs, which makes it unsuitable for password storage even though it is fine for data-integrity checksums.

**Q: What happens, step by step, when a user submits a login form?**
Answer: The POST to `/login` is intercepted by `UsernamePasswordAuthenticationFilter`, which builds an unauthenticated `UsernamePasswordAuthenticationToken` from the submitted username and password and passes it to the `AuthenticationManager`. The `ProviderManager` tries its registered `AuthenticationProvider`s; `DaoAuthenticationProvider` calls `UserDetailsService.loadUserByUsername(...)` to fetch the stored `UserDetails`, then uses `PasswordEncoder.matches(...)` to verify the submitted password against the stored hash. On success, a fully populated, authenticated `Authentication` object is returned and stored in the `SecurityContextHolder` (and persisted to the HTTP session by `SecurityContextRepository`); on failure, an `AuthenticationException` propagates up to `ExceptionTranslationFilter`, which redirects back to the login page with an error.

**Q: Why does `hasRole("ADMIN")` sometimes fail even though the user clearly has an "ADMIN" authority?**
Answer: `hasRole("X")` is sugar for `hasAuthority("ROLE_X")` — Spring Security automatically prepends the `ROLE_` prefix. If the authority was granted or stored as the bare string `"ADMIN"` (for example, via `SimpleGrantedAuthority("ADMIN")` without the prefix), `hasRole("ADMIN")` will never match it because it is actually checking for `"ROLE_ADMIN"`. The fix is either to store authorities with the `ROLE_` prefix consistently, or use `hasAuthority("ADMIN")` directly when the granted authority genuinely has no prefix. This mismatch is one of the most common causes of unexplained 403s in Spring Security configurations.
