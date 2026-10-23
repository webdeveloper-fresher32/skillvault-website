# Project 1 — Notes REST API

**Level:** Beginner
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 3 – REST APIs (Spring Web)

---

## Overview

You will build a single-resource CRUD REST API for managing short text **Notes**. This is your first end-to-end Spring Boot application: a `@RestController` exposing `GET`, `POST`, `PUT`, and `DELETE` endpoints, request/response DTOs to keep your API contract separate from your internal model, and Bean Validation to reject malformed input before it reaches your business logic.

The store is in-memory (a `ConcurrentHashMap`) — no database yet. That comes in Project 2.

---

## Prerequisites

- JDK 17+ installed (`java -version`)
- Maven or Gradle (this guide uses Maven)
- An HTTP client: `curl`, HTTPie, or Postman
- Completed Phase 3 (REST APIs — Spring Web) or equivalent familiarity with `@RestController`

---

## Project Structure

```
01-notes-api/
├── pom.xml
└── src/
    └── main/
        ├── java/com/skillvault/notes/
        │   ├── NotesApiApplication.java
        │   ├── controller/
        │   │   └── NoteController.java
        │   ├── dto/
        │   │   ├── NoteRequest.java
        │   │   └── NoteResponse.java
        │   ├── model/
        │   │   └── Note.java
        │   ├── repository/
        │   │   └── NoteRepository.java
        │   └── exception/
        │       └── NoteNotFoundException.java
        └── resources/
            └── application.yml
```

---

## Step-by-Step Instructions

### Step 1 — Generate the project

Use [start.spring.io](https://start.spring.io) or the CLI equivalent with these settings:

- **Project:** Maven
- **Language:** Java
- **Spring Boot:** 3.3.x
- **Dependencies:** Spring Web, Validation

Or add directly to `pom.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.4</version>
    <relativePath/>
  </parent>

  <groupId>com.skillvault</groupId>
  <artifactId>notes-api</artifactId>
  <version>1.0.0</version>
  <name>notes-api</name>

  <properties>
    <java.version>17</java.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

### Step 2 — Application entry point

`src/main/java/com/skillvault/notes/NotesApiApplication.java`

```java
package com.skillvault.notes;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class NotesApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(NotesApiApplication.class, args);
    }
}
```

### Step 3 — Domain model

`src/main/java/com/skillvault/notes/model/Note.java`

```java
package com.skillvault.notes.model;

import java.time.Instant;

public class Note {

    private Long id;
    private String title;
    private String content;
    private boolean pinned;
    private Instant createdAt;
    private Instant updatedAt;

    public Note() {}

    public Note(Long id, String title, String content, boolean pinned, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.pinned = pinned;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public boolean isPinned() { return pinned; }
    public void setPinned(boolean pinned) { this.pinned = pinned; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
```

### Step 4 — Request/response DTOs

`src/main/java/com/skillvault/notes/dto/NoteRequest.java`

```java
package com.skillvault.notes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Record used as an immutable request DTO — keeps the API contract separate from the domain model
public record NoteRequest(

    @NotBlank(message = "title must not be blank")
    @Size(max = 120, message = "title must be at most 120 characters")
    String title,

    @Size(max = 5_000, message = "content must be at most 5000 characters")
    String content,

    boolean pinned
) {}
```

`src/main/java/com/skillvault/notes/dto/NoteResponse.java`

```java
package com.skillvault.notes.dto;

import com.skillvault.notes.model.Note;
import java.time.Instant;

public record NoteResponse(
    Long id,
    String title,
    String content,
    boolean pinned,
    Instant createdAt,
    Instant updatedAt
) {
    public static NoteResponse from(Note note) {
        return new NoteResponse(
            note.getId(), note.getTitle(), note.getContent(),
            note.isPinned(), note.getCreatedAt(), note.getUpdatedAt()
        );
    }
}
```

### Step 5 — In-memory repository

`src/main/java/com/skillvault/notes/repository/NoteRepository.java`

```java
package com.skillvault.notes.repository;

import com.skillvault.notes.model.Note;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class NoteRepository {

    private final Map<Long, Note> store = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong(0);

    public Note save(Note note) {
        if (note.getId() == null) {
            note.setId(sequence.incrementAndGet());
        }
        store.put(note.getId(), note);
        return note;
    }

    public Optional<Note> findById(Long id) {
        return Optional.ofNullable(store.get(id));
    }

    public Collection<Note> findAll() {
        return store.values();
    }

    public boolean existsById(Long id) {
        return store.containsKey(id);
    }

    public void deleteById(Long id) {
        store.remove(id);
    }
}
```

### Step 6 — Custom exception

`src/main/java/com/skillvault/notes/exception/NoteNotFoundException.java`

```java
package com.skillvault.notes.exception;

public class NoteNotFoundException extends RuntimeException {
    public NoteNotFoundException(Long id) {
        super("Note with id " + id + " was not found");
    }
}
```

### Step 7 — Controller

`src/main/java/com/skillvault/notes/controller/NoteController.java`

```java
package com.skillvault.notes.controller;

import com.skillvault.notes.dto.NoteRequest;
import com.skillvault.notes.dto.NoteResponse;
import com.skillvault.notes.exception.NoteNotFoundException;
import com.skillvault.notes.model.Note;
import com.skillvault.notes.repository.NoteRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteRepository repository;

    public NoteController(NoteRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<NoteResponse> listNotes() {
        return repository.findAll().stream()
            .map(NoteResponse::from)
            .toList();
    }

    @GetMapping("/{id}")
    public NoteResponse getNote(@PathVariable Long id) {
        Note note = repository.findById(id)
            .orElseThrow(() -> new NoteNotFoundException(id));
        return NoteResponse.from(note);
    }

    @PostMapping
    public ResponseEntity<NoteResponse> createNote(@Valid @RequestBody NoteRequest request) {
        Instant now = Instant.now();
        Note note = new Note(null, request.title(), request.content(), request.pinned(), now, now);
        Note saved = repository.save(note);

        URI location = URI.create("/api/notes/" + saved.getId());
        return ResponseEntity.created(location).body(NoteResponse.from(saved));
    }

    @PutMapping("/{id}")
    public NoteResponse updateNote(@PathVariable Long id, @Valid @RequestBody NoteRequest request) {
        Note existing = repository.findById(id)
            .orElseThrow(() -> new NoteNotFoundException(id));

        existing.setTitle(request.title());
        existing.setContent(request.content());
        existing.setPinned(request.pinned());
        existing.setUpdatedAt(Instant.now());

        return NoteResponse.from(repository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            throw new NoteNotFoundException(id);
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(NoteNotFoundException.class)
    public ResponseEntity<String> handleNotFound(NoteNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
    }
}
```

> Note: this project's exception handling is intentionally minimal — a single `@ExceptionHandler` inside the controller. Project 3 upgrades this to a global `@RestControllerAdvice` with RFC 7807 `ProblemDetail` responses.

### Step 8 — Application configuration

`src/main/resources/application.yml`

```yaml
server:
  port: 8080

spring:
  application:
    name: notes-api

logging:
  level:
    com.skillvault.notes: DEBUG
```

### Step 9 — Run the application

```bash
./mvnw spring-boot:run
```

The API is now listening on `http://localhost:8080`.

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Create a note | `curl -i -X POST http://localhost:8080/api/notes -H "Content-Type: application/json" -d '{"title":"Groceries","content":"Milk, eggs","pinned":false}'` | `201 Created` with `Location` header and JSON body including `id` |
| List notes | `curl -s http://localhost:8080/api/notes \| jq length` | `1` (or more) |
| Get one note | `curl -s http://localhost:8080/api/notes/1 \| jq .title` | `"Groceries"` |
| Update a note | `curl -i -X PUT http://localhost:8080/api/notes/1 -H "Content-Type: application/json" -d '{"title":"Groceries v2","content":"Milk","pinned":true}'` | `200 OK`, `pinned` is `true` |
| Validation rejects blank title | `curl -i -X POST http://localhost:8080/api/notes -H "Content-Type: application/json" -d '{"title":"","content":"x"}'` | `400 Bad Request` |
| Delete a note | `curl -i -X DELETE http://localhost:8080/api/notes/1` | `204 No Content` |
| 404 on missing note | `curl -i http://localhost:8080/api/notes/999` | `404 Not Found` |

---

## Stretch Goals

1. **Search endpoint** — add `GET /api/notes?query=milk` that filters notes whose title or content contains the query string (case-insensitive).
2. **Optimistic concurrency** — add a `version` field to `Note` and reject an update whose incoming `version` doesn't match the stored one with `409 Conflict`.
3. **Pinning shortcut** — add `PATCH /api/notes/{id}/pin` and `PATCH /api/notes/{id}/unpin` endpoints that toggle `pinned` without requiring a full `PUT` body.
4. **OpenAPI docs** — add `springdoc-openapi-starter-webmvc-ui` and expose Swagger UI at `/swagger-ui.html`.
5. **Swap in JPA** — replace `NoteRepository`'s `ConcurrentHashMap` with a real `JpaRepository` backed by H2, previewing Project 2's persistence layer.
