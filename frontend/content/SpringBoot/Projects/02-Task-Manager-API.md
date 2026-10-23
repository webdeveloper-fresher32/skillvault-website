# Project 2 — Task Manager API (JPA + Service Layer)

**Level:** Beginner-Intermediate
**Time estimate:** 90 – 120 minutes
**Phase prerequisites:** Phase 4 – Data Access (JPA), Phase 5 – Services and Transactions

---

## Overview

You will build a Task Manager backed by a real relational database using Spring Data JPA. The domain has two entities in a **one-to-many** relationship: a `User` has many `Task`s. Instead of putting logic in the controller, you will introduce a `@Service` layer that owns business rules — e.g. "a user cannot have more than 20 open tasks" — and wraps multi-step operations in `@Transactional` boundaries so partial writes never leak into the database.

The project uses H2 in-memory for local development, with notes on switching to PostgreSQL/MySQL.

---

## Prerequisites

- Completed Project 1 or equivalent familiarity with `@RestController`
- Basic SQL (tables, foreign keys)
- JDK 17+, Maven

---

## Project Structure

```
02-task-manager-api/
├── pom.xml
└── src/
    └── main/
        ├── java/com/skillvault/taskmanager/
        │   ├── TaskManagerApplication.java
        │   ├── controller/
        │   │   ├── UserController.java
        │   │   └── TaskController.java
        │   ├── dto/
        │   │   ├── UserRequest.java
        │   │   ├── UserResponse.java
        │   │   ├── TaskRequest.java
        │   │   └── TaskResponse.java
        │   ├── entity/
        │   │   ├── User.java
        │   │   ├── Task.java
        │   │   └── TaskStatus.java
        │   ├── repository/
        │   │   ├── UserRepository.java
        │   │   └── TaskRepository.java
        │   ├── service/
        │   │   ├── UserService.java
        │   │   └── TaskService.java
        │   └── exception/
        │       ├── ResourceNotFoundException.java
        │       └── TaskLimitExceededException.java
        └── resources/
            └── application.yml
```

---

## Step-by-Step Instructions

### Step 1 — Dependencies

`pom.xml` (add to the Project 1 starter):

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
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
  <dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
```

### Step 2 — Entities

`entity/TaskStatus.java`

```java
package com.skillvault.taskmanager.entity;

public enum TaskStatus {
    OPEN, IN_PROGRESS, DONE
}
```

`entity/User.java`

```java
package com.skillvault.taskmanager.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false, length = 100)
    private String displayName;

    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Task> tasks = new ArrayList<>();

    protected User() {}

    public User(String email, String displayName) {
        this.email = email;
        this.displayName = displayName;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public List<Task> getTasks() { return tasks; }
}
```

`entity/Task.java`

```java
package com.skillvault.taskmanager.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status = TaskStatus.OPEN;

    private LocalDate dueDate;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    protected Task() {}

    public Task(String title, String description, LocalDate dueDate, User owner) {
        this.title = title;
        this.description = description;
        this.dueDate = dueDate;
        this.owner = owner;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public Instant getCreatedAt() { return createdAt; }
    public User getOwner() { return owner; }
}
```

### Step 3 — Repositories

`repository/UserRepository.java`

```java
package com.skillvault.taskmanager.repository;

import com.skillvault.taskmanager.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

`repository/TaskRepository.java`

```java
package com.skillvault.taskmanager.repository;

import com.skillvault.taskmanager.entity.Task;
import com.skillvault.taskmanager.entity.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByOwnerId(Long ownerId);

    long countByOwnerIdAndStatusNot(Long ownerId, TaskStatus status);
}
```

### Step 4 — DTOs

`dto/UserRequest.java`

```java
package com.skillvault.taskmanager.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UserRequest(
    @NotBlank @Email String email,
    @NotBlank String displayName
) {}
```

`dto/UserResponse.java`

```java
package com.skillvault.taskmanager.dto;

import com.skillvault.taskmanager.entity.User;

public record UserResponse(Long id, String email, String displayName, int taskCount) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getTasks().size());
    }
}
```

`dto/TaskRequest.java`

```java
package com.skillvault.taskmanager.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record TaskRequest(
    @NotBlank @Size(max = 200) String title,
    @Size(max = 2000) String description,
    @FutureOrPresent LocalDate dueDate
) {}
```

`dto/TaskResponse.java`

```java
package com.skillvault.taskmanager.dto;

import com.skillvault.taskmanager.entity.Task;
import com.skillvault.taskmanager.entity.TaskStatus;

import java.time.Instant;
import java.time.LocalDate;

public record TaskResponse(
    Long id, String title, String description, TaskStatus status,
    LocalDate dueDate, Instant createdAt, Long ownerId
) {
    public static TaskResponse from(Task task) {
        return new TaskResponse(
            task.getId(), task.getTitle(), task.getDescription(), task.getStatus(),
            task.getDueDate(), task.getCreatedAt(), task.getOwner().getId()
        );
    }
}
```

### Step 5 — Exceptions

`exception/ResourceNotFoundException.java`

```java
package com.skillvault.taskmanager.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
```

`exception/TaskLimitExceededException.java`

```java
package com.skillvault.taskmanager.exception;

public class TaskLimitExceededException extends RuntimeException {
    public TaskLimitExceededException(Long userId, long limit) {
        super("User " + userId + " already has " + limit + " open tasks — limit reached");
    }
}
```

### Step 6 — Service layer (business rules live here, not in the controller)

`service/UserService.java`

```java
package com.skillvault.taskmanager.service;

import com.skillvault.taskmanager.dto.UserRequest;
import com.skillvault.taskmanager.entity.User;
import com.skillvault.taskmanager.exception.ResourceNotFoundException;
import com.skillvault.taskmanager.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getById(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User " + id + " not found"));
    }

    public java.util.List<User> getAll() {
        return userRepository.findAll();
    }

    @Transactional
    public User create(UserRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already registered: " + request.email());
        }
        return userRepository.save(new User(request.email(), request.displayName()));
    }
}
```

`service/TaskService.java`

```java
package com.skillvault.taskmanager.service;

import com.skillvault.taskmanager.dto.TaskRequest;
import com.skillvault.taskmanager.entity.Task;
import com.skillvault.taskmanager.entity.TaskStatus;
import com.skillvault.taskmanager.entity.User;
import com.skillvault.taskmanager.exception.ResourceNotFoundException;
import com.skillvault.taskmanager.exception.TaskLimitExceededException;
import com.skillvault.taskmanager.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class TaskService {

    private static final long MAX_OPEN_TASKS_PER_USER = 20;

    private final TaskRepository taskRepository;
    private final UserService userService;

    public TaskService(TaskRepository taskRepository, UserService userService) {
        this.taskRepository = taskRepository;
        this.userService = userService;
    }

    public List<Task> getTasksForUser(Long userId) {
        userService.getById(userId); // 404s if the user doesn't exist
        return taskRepository.findByOwnerId(userId);
    }

    public Task getById(Long taskId) {
        return taskRepository.findById(taskId)
            .orElseThrow(() -> new ResourceNotFoundException("Task " + taskId + " not found"));
    }

    /**
     * Creates a task for the given user, enforcing the business rule that a user
     * may not have more than MAX_OPEN_TASKS_PER_USER tasks that are not DONE.
     * The count check and the insert happen inside the same transaction boundary.
     */
    @Transactional
    public Task createForUser(Long userId, TaskRequest request) {
        User owner = userService.getById(userId);

        long openCount = taskRepository.countByOwnerIdAndStatusNot(userId, TaskStatus.DONE);
        if (openCount >= MAX_OPEN_TASKS_PER_USER) {
            throw new TaskLimitExceededException(userId, MAX_OPEN_TASKS_PER_USER);
        }

        Task task = new Task(request.title(), request.description(), request.dueDate(), owner);
        return taskRepository.save(task);
    }

    @Transactional
    public Task updateStatus(Long taskId, TaskStatus newStatus) {
        Task task = getById(taskId);
        task.setStatus(newStatus);
        return task; // managed entity — flushed automatically at transaction commit (dirty checking)
    }

    @Transactional
    public void delete(Long taskId) {
        Task task = getById(taskId);
        taskRepository.delete(task);
    }
}
```

### Step 7 — Controllers

`controller/UserController.java`

```java
package com.skillvault.taskmanager.controller;

import com.skillvault.taskmanager.dto.UserRequest;
import com.skillvault.taskmanager.dto.UserResponse;
import com.skillvault.taskmanager.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<UserResponse> listUsers() {
        return userService.getAll().stream().map(UserResponse::from).toList();
    }

    @GetMapping("/{id}")
    public UserResponse getUser(@PathVariable Long id) {
        return UserResponse.from(userService.getById(id));
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserRequest request) {
        var saved = userService.create(request);
        return ResponseEntity.status(201).body(UserResponse.from(saved));
    }
}
```

`controller/TaskController.java`

```java
package com.skillvault.taskmanager.controller;

import com.skillvault.taskmanager.dto.TaskRequest;
import com.skillvault.taskmanager.dto.TaskResponse;
import com.skillvault.taskmanager.entity.TaskStatus;
import com.skillvault.taskmanager.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users/{userId}/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<TaskResponse> listTasks(@PathVariable Long userId) {
        return taskService.getTasksForUser(userId).stream().map(TaskResponse::from).toList();
    }

    @PostMapping
    public ResponseEntity<TaskResponse> createTask(@PathVariable Long userId, @Valid @RequestBody TaskRequest request) {
        var saved = taskService.createForUser(userId, request);
        return ResponseEntity.status(201).body(TaskResponse.from(saved));
    }

    @PatchMapping("/{taskId}/status")
    public TaskResponse updateStatus(@PathVariable Long userId, @PathVariable Long taskId,
                                      @RequestParam TaskStatus status) {
        return TaskResponse.from(taskService.updateStatus(taskId, status));
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long userId, @PathVariable Long taskId) {
        taskService.delete(taskId);
        return ResponseEntity.noContent().build();
    }
}
```

### Step 8 — Application configuration

`src/main/resources/application.yml`

```yaml
server:
  port: 8080

spring:
  application:
    name: task-manager-api
  datasource:
    url: jdbc:h2:mem:taskdb;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        format_sql: true
  h2:
    console:
      enabled: true
      path: /h2-console
```

> **Switching to PostgreSQL:** replace the `datasource` block with `url: jdbc:postgresql://localhost:5432/taskdb`, add the `postgresql` JDBC driver dependency, and set `ddl-auto: validate` once you introduce Flyway/Liquibase migrations in Phase 9.

### Step 9 — Run and seed data

```bash
./mvnw spring-boot:run
```

```bash
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","displayName":"Ada Lovelace"}'
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Create a user | `curl -i -X POST http://localhost:8080/api/users -H "Content-Type: application/json" -d '{"email":"ada@example.com","displayName":"Ada"}'` | `201 Created` |
| Create a task for that user | `curl -i -X POST http://localhost:8080/api/users/1/tasks -H "Content-Type: application/json" -d '{"title":"Write paper"}'` | `201 Created`, `ownerId: 1` |
| List tasks for user | `curl -s http://localhost:8080/api/users/1/tasks \| jq length` | `1` |
| Update task status | `curl -i -X PATCH "http://localhost:8080/api/users/1/tasks/1/status?status=DONE"` | `200 OK`, `status: "DONE"` |
| Task limit enforced | Create 20 `OPEN` tasks then a 21st | 21st request fails with `500`/`400` and message "limit reached" (wire up `@ExceptionHandler` in Project 3 for a clean `409`) |
| Relationship persists | `docker` not needed — inspect via `http://localhost:8080/h2-console`, run `SELECT * FROM tasks WHERE owner_id = 1;` | Rows returned |

---

## Stretch Goals

1. **Cascade delete verification** — delete a `User` and confirm (via the H2 console) that all their `Task` rows are removed too, proving `orphanRemoval = true` and `CascadeType.ALL` work as configured.
2. **Derived query methods** — add `findByOwnerIdAndDueDateBefore(Long ownerId, LocalDate date)` to surface overdue tasks.
3. **DTO-level validation groups** — add a `@Validated` group so `POST` requires `title` but `PATCH` allows partial updates without re-validating unrelated fields.
4. **Switch to PostgreSQL with Testcontainers** — run the app against a real Postgres container locally instead of H2, previewing Project 4's integration-testing approach.
5. **Optimistic locking** — add `@Version` to `Task` and demonstrate a `409 Conflict` when two clients update the same task concurrently.
