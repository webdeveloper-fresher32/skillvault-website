# Project 3 — Blog API with Global Exception Handling and JWT Security

**Level:** Intermediate
**Time estimate:** 2.5 – 3.5 hours
**Phase prerequisites:** Phase 6 – Exception Handling, Phase 7 – Spring Security

---

## Overview

You will build a Blog API with two production-grade concerns layered on top of a `Post`/`Author` domain:

1. **Global exception handling** — a single `@RestControllerAdvice` that turns every exception into an RFC 7807 `ProblemDetail` response, plus Bean Validation on request DTOs.
2. **JWT-based Spring Security** — users register and log in to receive a signed JWT; a custom `OncePerRequestFilter` validates the token on every request; and a `@PreAuthorize` expression enforces that **only the author who owns a post may edit or delete it**.

---

## Prerequisites

- Completed Project 2 or equivalent JPA + service-layer experience
- Basic understanding of JWT structure (header.payload.signature)
- JDK 17+, Maven

---

## Project Structure

```
03-blog-api/
├── pom.xml
└── src/
    └── main/
        ├── java/com/skillvault/blog/
        │   ├── BlogApiApplication.java
        │   ├── config/
        │   │   └── SecurityConfig.java
        │   ├── security/
        │   │   ├── JwtService.java
        │   │   └── JwtAuthFilter.java
        │   ├── controller/
        │   │   ├── AuthController.java
        │   │   └── PostController.java
        │   ├── dto/
        │   │   ├── RegisterRequest.java
        │   │   ├── LoginRequest.java
        │   │   ├── AuthResponse.java
        │   │   ├── PostRequest.java
        │   │   └── PostResponse.java
        │   ├── entity/
        │   │   ├── Author.java
        │   │   └── Post.java
        │   ├── repository/
        │   │   ├── AuthorRepository.java
        │   │   └── PostRepository.java
        │   ├── service/
        │   │   ├── AuthService.java
        │   │   └── PostService.java
        │   └── exception/
        │       ├── ResourceNotFoundException.java
        │       ├── ForbiddenOperationException.java
        │       └── GlobalExceptionHandler.java
        └── resources/
            └── application.yml
```

---

## Step-by-Step Instructions

### Step 1 — Dependencies

```xml
<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
  <dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
  </dependency>
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
</dependencies>
```

### Step 2 — Entities

`entity/Author.java`

```java
package com.skillvault.blog.entity;

import jakarta.persistence.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

@Entity
@Table(name = "authors")
public class Author implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, length = 20)
    private String role = "ROLE_AUTHOR";

    protected Author() {}

    public Author(String email, String passwordHash) {
        this.email = email;
        this.passwordHash = passwordHash;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }

    @Override public String getUsername() { return email; }
    @Override public String getPassword() { return passwordHash; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority(role));
    }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
```

`entity/Post.java`

```java
package com.skillvault.blog.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Lob
    @Column(nullable = false)
    private String body;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private Author author;

    protected Post() {}

    public Post(String title, String body, Author author) {
        this.title = title;
        this.body = body;
        this.author = author;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Instant getCreatedAt() { return createdAt; }
    public Author getAuthor() { return author; }
}
```

### Step 3 — Repositories

```java
package com.skillvault.blog.repository;

import com.skillvault.blog.entity.Author;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AuthorRepository extends JpaRepository<Author, Long> {
    Optional<Author> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

```java
package com.skillvault.blog.repository;

import com.skillvault.blog.entity.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findAllByOrderByCreatedAtDesc();
}
```

### Step 4 — DTOs

```java
package com.skillvault.blog.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8, max = 72) String password
) {}
```

```java
package com.skillvault.blog.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
```

```java
package com.skillvault.blog.dto;

public record AuthResponse(String token, String tokenType) {
    public static AuthResponse bearer(String token) {
        return new AuthResponse(token, "Bearer");
    }
}
```

```java
package com.skillvault.blog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PostRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank String body
) {}
```

```java
package com.skillvault.blog.dto;

import com.skillvault.blog.entity.Post;
import java.time.Instant;

public record PostResponse(Long id, String title, String body, Instant createdAt, String authorEmail) {
    public static PostResponse from(Post post) {
        return new PostResponse(post.getId(), post.getTitle(), post.getBody(), post.getCreatedAt(), post.getAuthor().getEmail());
    }
}
```

### Step 5 — Exceptions and the global handler

```java
package com.skillvault.blog.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) { super(message); }
}
```

```java
package com.skillvault.blog.exception;

public class ForbiddenOperationException extends RuntimeException {
    public ForbiddenOperationException(String message) { super(message); }
}
```

`exception/GlobalExceptionHandler.java`

```java
package com.skillvault.blog.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Resource Not Found");
        return problem;
    }

    @ExceptionHandler({ForbiddenOperationException.class, AccessDeniedException.class})
    public ProblemDetail handleForbidden(RuntimeException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, ex.getMessage());
        problem.setTitle("Forbidden");
        return problem;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleIllegalArgument(IllegalArgumentException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setTitle("Conflict");
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(err ->
            fieldErrors.put(err.getField(), err.getDefaultMessage()));

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Validation failed");
        problem.setTitle("Bad Request");
        problem.setProperty("errors", fieldErrors);
        return problem;
    }
}
```

### Step 6 — JWT service and filter

`security/JwtService.java`

```java
package com.skillvault.blog.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${security.jwt.secret}")
    private String secret;

    @Value("${security.jwt.expiration-ms}")
    private long expirationMs;

    private SecretKey key() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    public String generateToken(String subjectEmail) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
            .subject(subjectEmail)
            .issuedAt(now)
            .expiration(expiry)
            .signWith(key())
            .compact();
    }

    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public boolean isTokenValid(String token, String expectedEmail) {
        String email = extractEmail(token);
        return email.equals(expectedEmail) && !isExpired(token);
    }

    private boolean isExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        Claims claims = Jwts.parser().verifyWith(key()).build()
            .parseSignedClaims(token).getPayload();
        return resolver.apply(claims);
    }
}
```

`security/JwtAuthFilter.java`

```java
package com.skillvault.blog.security;

import com.skillvault.blog.repository.AuthorRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AuthorRepository authorRepository;

    public JwtAuthFilter(JwtService jwtService, AuthorRepository authorRepository) {
        this.jwtService = jwtService;
        this.authorRepository = authorRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);
        String email = jwtService.extractEmail(token);

        if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            authorRepository.findByEmail(email).ifPresent(author -> {
                if (jwtService.isTokenValid(token, email)) {
                    var authToken = new UsernamePasswordAuthenticationToken(
                        author, null, author.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            });
        }
        chain.doFilter(request, response);
    }
}
```

### Step 7 — Security configuration

`config/SecurityConfig.java`

```java
package com.skillvault.blog.config;

import com.skillvault.blog.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationProviderConfig authProviderConfig(UserDetailsService uds, PasswordEncoder encoder) {
        return new AuthenticationProviderConfig(uds, encoder);
    }

    // Small inline helper to keep the DaoAuthenticationProvider wiring explicit
    public static class AuthenticationProviderConfig {
        private final DaoAuthenticationProvider provider;

        public AuthenticationProviderConfig(UserDetailsService uds, PasswordEncoder encoder) {
            this.provider = new DaoAuthenticationProvider();
            this.provider.setUserDetailsService(uds);
            this.provider.setPasswordEncoder(encoder);
        }

        public DaoAuthenticationProvider get() { return provider; }
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("GET", "/api/posts/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
```

### Step 8 — Auth and Post services

`service/AuthService.java`

```java
package com.skillvault.blog.service;

import com.skillvault.blog.dto.AuthResponse;
import com.skillvault.blog.dto.LoginRequest;
import com.skillvault.blog.dto.RegisterRequest;
import com.skillvault.blog.entity.Author;
import com.skillvault.blog.repository.AuthorRepository;
import com.skillvault.blog.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AuthorRepository authorRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(AuthorRepository authorRepository, PasswordEncoder passwordEncoder,
                        AuthenticationManager authenticationManager, JwtService jwtService) {
        this.authorRepository = authorRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (authorRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already registered: " + request.email());
        }
        Author author = new Author(request.email(), passwordEncoder.encode(request.password()));
        authorRepository.save(author);
        return AuthResponse.bearer(jwtService.generateToken(author.getEmail()));
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password()));
        return AuthResponse.bearer(jwtService.generateToken(request.email()));
    }
}
```

`service/PostService.java`

```java
package com.skillvault.blog.service;

import com.skillvault.blog.dto.PostRequest;
import com.skillvault.blog.entity.Author;
import com.skillvault.blog.entity.Post;
import com.skillvault.blog.exception.ForbiddenOperationException;
import com.skillvault.blog.exception.ResourceNotFoundException;
import com.skillvault.blog.repository.PostRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class PostService {

    private final PostRepository postRepository;

    public PostService(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    public List<Post> getAll() {
        return postRepository.findAllByOrderByCreatedAtDesc();
    }

    public Post getById(Long id) {
        return postRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Post " + id + " not found"));
    }

    @Transactional
    public Post create(PostRequest request, Author author) {
        return postRepository.save(new Post(request.title(), request.body(), author));
    }

    @Transactional
    public Post update(Long id, PostRequest request, Author currentUser) {
        Post post = getById(id);
        assertOwnership(post, currentUser);
        post.setTitle(request.title());
        post.setBody(request.body());
        return post;
    }

    @Transactional
    public void delete(Long id, Author currentUser) {
        Post post = getById(id);
        assertOwnership(post, currentUser);
        postRepository.delete(post);
    }

    private void assertOwnership(Post post, Author currentUser) {
        if (!post.getAuthor().getId().equals(currentUser.getId())) {
            throw new ForbiddenOperationException("You may only edit or delete your own posts");
        }
    }
}
```

### Step 9 — Controllers

`controller/AuthController.java`

```java
package com.skillvault.blog.controller;

import com.skillvault.blog.dto.AuthResponse;
import com.skillvault.blog.dto.LoginRequest;
import com.skillvault.blog.dto.RegisterRequest;
import com.skillvault.blog.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }
}
```

`controller/PostController.java`

```java
package com.skillvault.blog.controller;

import com.skillvault.blog.dto.PostRequest;
import com.skillvault.blog.dto.PostResponse;
import com.skillvault.blog.entity.Author;
import com.skillvault.blog.service.PostService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping
    public List<PostResponse> listPosts() {
        return postService.getAll().stream().map(PostResponse::from).toList();
    }

    @GetMapping("/{id}")
    public PostResponse getPost(@PathVariable Long id) {
        return PostResponse.from(postService.getById(id));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PostResponse> createPost(@Valid @RequestBody PostRequest request,
                                                    @AuthenticationPrincipal Author currentUser) {
        var saved = postService.create(request, currentUser);
        return ResponseEntity.status(201).body(PostResponse.from(saved));
    }

    // Ownership is enforced in the service layer (assertOwnership), which throws
    // ForbiddenOperationException -> mapped to 403 by GlobalExceptionHandler.
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public PostResponse updatePost(@PathVariable Long id, @Valid @RequestBody PostRequest request,
                                    @AuthenticationPrincipal Author currentUser) {
        return PostResponse.from(postService.update(id, request, currentUser));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deletePost(@PathVariable Long id, @AuthenticationPrincipal Author currentUser) {
        postService.delete(id, currentUser);
        return ResponseEntity.noContent().build();
    }
}
```

### Step 10 — Application configuration

`src/main/resources/application.yml`

```yaml
server:
  port: 8080

spring:
  application:
    name: blog-api
  datasource:
    url: jdbc:h2:mem:blogdb;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true

security:
  jwt:
    secret: "change-this-to-a-256-bit-secret-before-deploying-to-production"
    expiration-ms: 3600000   # 1 hour
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Register author A | `curl -s -X POST http://localhost:8080/api/auth/register -H "Content-Type: application/json" -d '{"email":"alice@example.com","password":"password123"}'` | JSON with `token` |
| Register author B | Same with `bob@example.com` | JSON with `token` |
| Public read (no token) | `curl -s http://localhost:8080/api/posts` | `200 OK`, `[]` |
| A creates a post | `curl -i -X POST http://localhost:8080/api/posts -H "Authorization: Bearer <A_TOKEN>" -H "Content-Type: application/json" -d '{"title":"Hello","body":"World"}'` | `201 Created` |
| B tries to edit A's post | `curl -i -X PUT http://localhost:8080/api/posts/1 -H "Authorization: Bearer <B_TOKEN>" -H "Content-Type: application/json" -d '{"title":"Hijack","body":"x"}'` | `403 Forbidden` with `ProblemDetail` JSON body |
| A edits their own post | Same request with `A_TOKEN` | `200 OK` |
| No token on write | `curl -i -X POST http://localhost:8080/api/posts -d '{}'` | `403 Forbidden` (unauthenticated) |
| Validation error shape | `curl -i -X POST http://localhost:8080/api/auth/register -d '{"email":"not-an-email","password":"x"}'` | `400 Bad Request`, `ProblemDetail` with `errors` map |

---

## Stretch Goals

1. **Refresh tokens** — issue a short-lived access token (15 min) plus a long-lived refresh token, with a `/api/auth/refresh` endpoint.
2. **Role-based moderation** — add a `ROLE_ADMIN` that can delete any post regardless of ownership, using a combined `@PreAuthorize("hasRole('ADMIN') or #currentUser.id == @postService.getById(#id).author.id")`.
3. **Rate limit login attempts** — track failed logins per email and lock the account for 5 minutes after 5 consecutive failures.
4. **Comment sub-resource** — add `Comment` entities under `Post`, with the same author-only edit/delete rule.
5. **Token blacklist on logout** — store revoked JTIs in a cache (Project 5's caching phase) and reject requests bearing a blacklisted token even if it hasn't expired.
