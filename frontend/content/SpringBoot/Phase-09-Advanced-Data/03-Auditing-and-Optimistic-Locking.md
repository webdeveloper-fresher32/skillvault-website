# Auditing and Optimistic Locking — Complete Guide

## Table of Contents
1. [Why Auditing and Concurrency Control Belong Together](#1-why-auditing-and-concurrency-control-belong-together)
2. [Spring Data JPA Auditing — Overview](#2-spring-data-jpa-auditing--overview)
3. [Enabling Auditing — @EnableJpaAuditing](#3-enabling-auditing--enablejpaauditing)
4. [Auditing Annotations — @CreatedDate, @LastModifiedDate, @CreatedBy, @LastModifiedBy](#4-auditing-annotations--createddate-lastmodifieddate-createdby-lastmodifiedby)
5. [AuditorAware — Wiring "Who" Into Auditing](#5-auditoraware--wiring-who-into-auditing)
6. [The Lost Update Problem](#6-the-lost-update-problem)
7. [Optimistic Locking with @Version](#7-optimistic-locking-with-version)
8. [Handling OptimisticLockException](#8-handling-optimisticlockexception)
9. [Optimistic vs Pessimistic Locking](#9-optimistic-vs-pessimistic-locking)
10. [Worked Example — Reproducing and Fixing a Lost Update](#10-worked-example--reproducing-and-fixing-a-lost-update)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Best Practices](#12-best-practices)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. Why Auditing and Concurrency Control Belong Together

Both auditing and optimistic locking answer questions about the same underlying concern: **what happened to this row, and can I trust the data I'm about to write on top of it?** Auditing answers "who changed this, and when?" — essential for debugging, compliance, and support. Optimistic locking answers "has someone else changed this since I last read it?" — essential for correctness under concurrent access. Spring Data JPA implements both through lightweight, declarative annotations rather than manual bookkeeping code, which is why they are covered together: they are two sides of the same "protect and explain data changes" problem.

```
  Every UPDATE in a multi-user system raises two questions:
  ┌──────────────────────────────────────────────────────────┐
  │  1. WHO changed this row, and WHEN?      → Auditing        │
  │  2. Is the row STILL what I last read?   → Optimistic Lock │
  └──────────────────────────────────────────────────────────┘
```

---

## 2. Spring Data JPA Auditing — Overview

Spring Data JPA auditing automatically populates creation and modification metadata on entities whenever they are persisted or updated, without the application code ever setting those fields manually. It relies on a JPA entity listener (`AuditingEntityListener`) hooked into the standard JPA lifecycle callbacks `@PrePersist` and `@PreUpdate`.

```
  Entity save/update lifecycle
  ┌────────────────────────────────────────────────────────┐
  │  repository.save(entity)                                 │
  │        │                                                 │
  │        ▼                                                 │
  │  @PrePersist / @PreUpdate JPA callback fires              │
  │        │                                                 │
  │        ▼                                                 │
  │  AuditingEntityListener sets:                             │
  │    @CreatedDate     (only on insert)                     │
  │    @CreatedBy       (only on insert)                     │
  │    @LastModifiedDate (insert AND every update)            │
  │    @LastModifiedBy   (insert AND every update)            │
  └────────────────────────────────────────────────────────┘
```

---

## 3. Enabling Auditing — @EnableJpaAuditing

Auditing is opt-in. It is activated by annotating a `@Configuration` class with `@EnableJpaAuditing`:

```java
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaAuditingConfig {
}
```

`auditorAwareRef` names the Spring bean (implementing `AuditorAware<T>`) that supplies the "current user" for `@CreatedBy`/`@LastModifiedBy`. If your entities only need timestamps (`@CreatedDate`/`@LastModifiedDate`) and not a "who," `auditorAwareRef` can be omitted entirely.

Every auditable entity also needs `AuditingEntityListener` registered, either directly on the entity or on a shared `@MappedSuperclass` (the recommended approach to avoid repeating four annotations on every entity):

```java
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class Auditable {

    @CreatedDate
    private Instant createdDate;

    @LastModifiedDate
    private Instant lastModifiedDate;

    @CreatedBy
    private String createdBy;

    @LastModifiedBy
    private String lastModifiedBy;

    // getters only — these fields should not be settable by application code
    public Instant getCreatedDate() { return createdDate; }
    public Instant getLastModifiedDate() { return lastModifiedDate; }
    public String getCreatedBy() { return createdBy; }
    public String getLastModifiedBy() { return lastModifiedBy; }
}
```

---

## 4. Auditing Annotations — @CreatedDate, @LastModifiedDate, @CreatedBy, @LastModifiedBy

| Annotation | Populated On | Typical Field Type |
|------------|--------------|---------------------|
| `@CreatedDate` | Insert only | `Instant`, `LocalDateTime`, `Date` |
| `@LastModifiedDate` | Insert and every subsequent update | `Instant`, `LocalDateTime`, `Date` |
| `@CreatedBy` | Insert only | `String`, a `User` entity reference, or any type `AuditorAware<T>` supplies |
| `@LastModifiedBy` | Insert and every subsequent update | Same as `@CreatedBy` |

Any entity that needs auditing simply extends the shared base class:

```java
@Entity
@Table(name = "products")
public class Product extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private BigDecimal price;

    // getters and setters
}
```

No service-layer code ever sets `createdDate` or `lastModifiedBy` directly — Spring Data populates them transparently on `save()`.

---

## 5. AuditorAware — Wiring "Who" Into Auditing

`@CreatedBy`/`@LastModifiedBy` need a source of "who is the current user." That source is any Spring bean implementing `AuditorAware<T>`, typically backed by Spring Security's `SecurityContextHolder`.

```java
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component("auditorProvider")
public class SpringSecurityAuditorAware implements AuditorAware<String> {

    @Override
    public Optional<String> getCurrentAuditor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return Optional.of("SYSTEM");
        }

        return Optional.of(authentication.getName());
    }
}
```

For batch jobs, scheduled tasks, or system-initiated changes with no authenticated `Authentication` present, returning a sentinel value like `"SYSTEM"` (rather than `Optional.empty()`, which leaves the field `null`) keeps audit trails complete and queryable.

---

## 6. The Lost Update Problem

A **lost update** happens when two concurrent transactions read the same row, both make changes based on that stale read, and the second write silently overwrites the first — without either transaction ever seeing an error.

```
  Time  Transaction A                Transaction B                Database (stock)
  ────  ──────────────────────────   ──────────────────────────   ─────────────────
  t0    SELECT stock → 10                                          stock = 10
  t1                                 SELECT stock → 10              stock = 10
  t2    stock = 10 - 3 = 7
        UPDATE stock = 7                                           stock = 7
  t3                                 stock = 10 - 5 = 5
                                     UPDATE stock = 5               stock = 5   ← BUG

  Expected final stock: 10 - 3 - 5 = 2
  Actual final stock:   5   (Transaction A's decrement of 3 was silently lost)
```

This happens because plain JPA/JDBC updates, by default, simply issue `UPDATE products SET stock = ? WHERE id = ?` — the WHERE clause only checks the primary key, not whether the row still matches what was originally read. Transaction B's write has no idea Transaction A already modified the row.

---

## 7. Optimistic Locking with @Version

Optimistic locking fixes the lost update problem by adding a version column that is checked — and incremented — atomically as part of every update's WHERE clause.

```java
@Entity
@Table(name = "inventory")
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sku;
    private int stock;

    @Version
    private Long version;

    // getters and setters
}
```

With `@Version` present, Hibernate rewrites every `UPDATE` to include the version in the `WHERE` clause and increments it:

```sql
UPDATE inventory
SET stock = ?, version = version + 1
WHERE id = ? AND version = ?
```

```
  Time  Transaction A (version read: 1)   Transaction B (version read: 1)   DB row
  ────  ────────────────────────────────  ────────────────────────────────  ──────────────
  t0    SELECT stock, version → 10, 1                                       stock=10 v=1
  t1                                      SELECT stock, version → 10, 1     stock=10 v=1
  t2    UPDATE ... WHERE id=1 AND version=1
        → 1 row affected, version becomes 2                                stock=7  v=2
  t3                                      UPDATE ... WHERE id=1 AND version=1
                                          → 0 rows affected!
                                          → Hibernate throws
                                            OptimisticLockException
```

Because Transaction B's `WHERE version = 1` no longer matches (the row is now at version 2), the `UPDATE` affects zero rows. Hibernate detects this zero-row result and raises `org.springframework.orm.ObjectOptimisticLockingFailureException` (wrapping JPA's `jakarta.persistence.OptimisticLockException`), rather than silently proceeding. The lost update is converted from a silent data-corruption bug into a detectable, handleable exception.

---

## 8. Handling OptimisticLockException

The exception should be caught close to the transaction boundary and translated into a meaningful response — typically an HTTP `409 Conflict` — rather than leaking a stack trace to the client.

```java
@Service
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    public InventoryService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    @Transactional
    public void decreaseStock(Long inventoryId, int quantity) {
        Inventory inventory = inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new EntityNotFoundException("Inventory not found: " + inventoryId));

        if (inventory.getStock() < quantity) {
            throw new InsufficientStockException(inventoryId);
        }

        inventory.setStock(inventory.getStock() - quantity);
        inventoryRepository.save(inventory);
        // flush happens at transaction commit — version check occurs here
    }
}
```

```java
@RestControllerAdvice
public class InventoryExceptionHandler {

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        ErrorResponse body = new ErrorResponse(
                "CONFLICT",
                "This record was updated by someone else. Please refresh and try again.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }
}
```

A common and often better strategy is to **retry** the whole operation from scratch (re-read the latest version, reapply the business logic, attempt the update again) a small, bounded number of times before surfacing a conflict to the user — this works well for operations where re-reading and reapplying is cheap and safe, like stock decrements.

```java
@Service
public class RetryingInventoryService {

    private static final int MAX_RETRIES = 3;

    private final InventoryRepository inventoryRepository;

    public RetryingInventoryService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    public void decreaseStockWithRetry(Long inventoryId, int quantity) {
        int attempts = 0;
        while (true) {
            try {
                doDecrease(inventoryId, quantity);
                return;
            } catch (ObjectOptimisticLockingFailureException ex) {
                attempts++;
                if (attempts >= MAX_RETRIES) {
                    throw ex;
                }
            }
        }
    }

    @Transactional
    public void doDecrease(Long inventoryId, int quantity) {
        Inventory inventory = inventoryRepository.findById(inventoryId).orElseThrow();
        inventory.setStock(inventory.getStock() - quantity);
        inventoryRepository.save(inventory);
    }
}
```

---

## 9. Optimistic vs Pessimistic Locking

| Aspect | Optimistic (`@Version`) | Pessimistic (`SELECT ... FOR UPDATE`) |
|--------|--------------------------|------------------------------------------|
| When conflict is detected | At write time (commit) | At read time — row is locked immediately |
| Database lock held | None while "thinking" | Row lock held for duration of transaction |
| Throughput under low contention | High — no blocking | Lower — every reader/writer serializes on the lock |
| Throughput under high contention | Lower — many retries/conflicts | Can be higher — no wasted work from conflicting writes |
| Failure mode | Exception, must retry or reject | Waiting readers/writers block until lock released |
| Typical use case | Web requests, low-contention updates (e.g., editing a product) | Short, high-contention critical sections (e.g., decrementing the last unit of limited stock at a flash sale) |

```java
// Pessimistic locking example, for contrast
public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Inventory i WHERE i.id = :id")
    Optional<Inventory> findByIdForUpdate(@Param("id") Long id);
}
```

Optimistic locking is the right default for most CRUD-style web applications — conflicts are rare, and paying the cost of a retry only when they actually happen is cheaper than serializing every read/write behind a database lock.

---

## 10. Worked Example — Reproducing and Fixing a Lost Update

### Step 1 — Entity Without @Version (the bug)

```java
@Entity
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sku;
    private int stock;

    // no @Version — vulnerable to lost updates
    // getters/setters
}
```

### Step 2 — Demonstrating the Lost Update in a Test

```java
@SpringBootTest
class InventoryLostUpdateTest {

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void concurrentDecrementsLoseAnUpdate() throws Exception {
        Inventory saved = inventoryRepository.save(new Inventory("SKU-1", 10));
        Long id = saved.getId();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch bothRead = new CountDownLatch(2);

        Runnable decrementBy3 = () -> runInNewTransaction(() -> {
            Inventory inv = inventoryRepository.findById(id).orElseThrow();
            await(bothRead); // ensure both transactions read stock=10 before either writes
            inv.setStock(inv.getStock() - 3);
            inventoryRepository.saveAndFlush(inv);
        });

        Runnable decrementBy5 = () -> runInNewTransaction(() -> {
            Inventory inv = inventoryRepository.findById(id).orElseThrow();
            await(bothRead);
            inv.setStock(inv.getStock() - 5);
            inventoryRepository.saveAndFlush(inv);
        });

        executor.submit(decrementBy3);
        executor.submit(decrementBy5);
        executor.shutdown();
        executor.awaitTermination(5, TimeUnit.SECONDS);

        Inventory result = inventoryRepository.findById(id).orElseThrow();
        // Without @Version: stock ends up as 5 or 7 (one decrement lost), not the expected 2
        assertThat(result.getStock()).isEqualTo(2); // FAILS without @Version
    }
}
```

Without `@Version`, this test fails intermittently (or consistently, depending on thread timing) because one of the two decrements is silently overwritten.

### Step 3 — The Fix: Add @Version

```java
@Entity
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sku;
    private int stock;

    @Version
    private Long version;

    // getters/setters
}
```

### Step 4 — Re-Running with @Version

With `@Version` in place, the same test now sees one of the two transactions throw `ObjectOptimisticLockingFailureException` at its `saveAndFlush()` call instead of silently succeeding. The service layer catches that exception and retries the losing transaction (as shown in Section 8), re-reading the now-current `stock = 7` and applying its own `-5` on top, correctly landing on `stock = 2`. The bug is not "fixed" by `@Version` alone — `@Version` converts a silent data-corruption bug into a detectable, retryable exception; the retry logic is what actually restores correctness.

---

## 11. Common Pitfalls

- **Assuming `@Version` alone fixes the business logic** — it only detects the conflict; without retry or conflict-resolution logic, the losing transaction's operation is simply abandoned (an exception replaces silent corruption, but the work still needs to happen).
- **Forgetting `@EnableJpaAuditing`** — annotating fields with `@CreatedDate`/`@LastModifiedDate` does nothing if the entity listener is never registered or the configuration class is never picked up by component scanning.
- **`AuditorAware` returning `Optional.empty()` for unauthenticated/system contexts** — leaves `createdBy` as `null` for batch jobs or scheduled tasks, breaking audit trail completeness; return a sentinel like `"SYSTEM"` instead.
- **Manually setting `version` in application code** — the field should only ever be managed by Hibernate; assigning it manually (e.g., during a DTO-to-entity mapping that copies every field) breaks the locking mechanism entirely and can trigger spurious `StaleObjectStateException`.
- **Using `@Version` with detached entities incorrectly** — merging a detached entity whose `version` is stale (e.g., held in a client-side cache/form across multiple page views) will correctly throw an optimistic lock exception on save, but this is often mistaken for a bug rather than the intended behavior — treat it as a "someone else changed this since you last loaded it" case for the end user.
- **Not flushing before assertions in tests** — `saveAndFlush()` (or an explicit `entityManager.flush()`) is required to force the `UPDATE` to hit the database immediately inside a test; otherwise the exception surfaces later than expected, at a confusing point in the test.

---

## 12. Best Practices

- Put all four auditing fields (`@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`, `@LastModifiedBy`) on a shared `@MappedSuperclass` and have every auditable entity extend it, rather than repeating the annotations everywhere.
- Back `AuditorAware` with Spring Security's `SecurityContextHolder` in production, and return an explicit "SYSTEM" or "ANONYMOUS" sentinel rather than `Optional.empty()` for unauthenticated/background contexts.
- Add `@Version` to any entity that is both mutable and reachable by concurrent writers — shopping carts, inventory counts, account balances, and any "read-modify-write" business object are prime candidates.
- Never expose the `version` field as writable in a REST DTO for the client to modify freely, but do consider round-tripping it (read-only) so a client can detect staleness before submitting an edit (e.g., an ETag-style pattern).
- Translate `ObjectOptimisticLockingFailureException` into an HTTP `409 Conflict` at the API boundary — never let it leak as a raw `500` stack trace.
- For operations where retry is safe and cheap (simple counters, stock decrements), implement a small bounded retry loop around the transactional method rather than immediately surfacing the conflict to the user.
- Reserve pessimistic locking for short, well-understood critical sections with genuinely high contention; defaulting to it everywhere sacrifices throughput for a problem optimistic locking usually handles just as correctly and more cheaply.

---

## 13. Hands-On Exercises

**Exercise 1:** Create an `Order` entity extending a shared `Auditable` `@MappedSuperclass` with `@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`, and `@LastModifiedBy`. Wire up `@EnableJpaAuditing` with a simple `AuditorAware<String>` returning a hardcoded `"test-user"`. Save an `Order`, then update it, and assert that `createdDate` stays constant while `lastModifiedDate` changes.

**Exercise 2:** Implement `SpringSecurityAuditorAware` backed by `SecurityContextHolder`, wire it into an authenticated Spring Security context in a `@SpringBootTest`, and verify `createdBy` is populated with the authenticated username. Then run the same save with no authentication present and confirm your fallback sentinel (e.g., `"SYSTEM"`) is used instead of `null`.

**Exercise 3:** Add `@Version` to an `Account` entity with a `balance` field. Write a concurrent test (two threads, both reading the same starting balance and applying a withdrawal) and confirm one thread's `saveAndFlush()` throws `ObjectOptimisticLockingFailureException` while the other succeeds.

**Exercise 4:** Wrap the withdrawal operation from Exercise 3 in a bounded retry loop (max 3 attempts) that re-reads the account, reapplies the withdrawal, and retries on `ObjectOptimisticLockingFailureException`. Confirm that after both threads complete, the final balance reflects both withdrawals correctly rather than losing one.

**Exercise 5:** Add a `@RestControllerAdvice` handler that converts `ObjectOptimisticLockingFailureException` into an HTTP `409 Conflict` with a JSON body describing the conflict. Write a `@WebMvcTest` (mocking the service to throw the exception) asserting the controller returns status 409 with the expected error payload.

---

## 14. Interview Q&A

**Q: What is a "lost update" and how does `@Version` prevent it?**
Answer: A lost update occurs when two transactions read the same row, both compute a new value from that stale read, and the second `UPDATE` silently overwrites the first transaction's change without either side seeing an error — the first transaction's work is lost with no indication anything went wrong. `@Version` prevents this by adding a version column that Hibernate includes in every `UPDATE`'s `WHERE` clause and increments on every successful write. If a second transaction's `UPDATE ... WHERE id = ? AND version = ?` finds the version has already moved on (because the first transaction committed first), zero rows are affected, and Hibernate raises `ObjectOptimisticLockingFailureException` — converting a silent bug into a detectable, handleable exception.

**Q: Does adding `@Version` alone fix a lost-update bug?**
Answer: No — `@Version` only detects that a conflicting concurrent write happened; it does not resolve the conflict on its own. Without additional handling, the losing transaction's operation is simply abandoned when the exception propagates. The actual fix requires the application to catch `ObjectOptimisticLockingFailureException` and either retry the operation (re-reading the current state and reapplying the business logic) or surface a meaningful conflict response (HTTP 409) so the user or caller can decide how to proceed.

**Q: What is the difference between optimistic and pessimistic locking, and when would you choose each?**
Answer: Optimistic locking (`@Version`) assumes conflicts are rare — it lets all transactions read and compute freely, and only detects a conflict at write time via a version check, at the cost of needing a retry when a conflict does occur. Pessimistic locking (`SELECT ... FOR UPDATE` / `@Lock(LockModeType.PESSIMISTIC_WRITE)`) acquires a database row lock at read time, blocking other transactions from reading or writing that row until the lock is released, trading throughput for the guarantee that no conflict can occur mid-transaction. Optimistic locking is the right default for typical web application CRUD operations with low contention (editing a product, updating a profile); pessimistic locking suits short, high-contention critical sections where retries under optimistic locking would be frequent and costly, such as decrementing the very last unit of limited stock during a flash sale.

**Q: How do `@CreatedDate` and `@LastModifiedDate` differ in when they are populated, and what has to be configured for them to work at all?**
Answer: `@CreatedDate` is populated exactly once, on the initial insert (`@PrePersist`), and never changes afterward. `@LastModifiedDate` is populated both on insert and on every subsequent update (`@PrePersist` and `@PreUpdate`). For either to work, the application must enable `@EnableJpaAuditing` on a configuration class, and the entity (or a shared `@MappedSuperclass`) must be annotated with `@EntityListeners(AuditingEntityListener.class)` — without both pieces, the annotations are inert and the fields remain `null`.

**Q: What role does `AuditorAware<T>` play, and what should it return when there is no authenticated user (e.g., a scheduled batch job)?**
Answer: `AuditorAware<T>` is the bean Spring Data JPA auditing consults to determine "who" performed the current change, feeding `@CreatedBy` and `@LastModifiedBy`; in a typical application it is backed by Spring Security's `SecurityContextHolder` to extract the current authenticated username. For contexts with no authenticated user — scheduled jobs, batch imports, system-initiated changes — it is better practice to return a defined sentinel value such as `"SYSTEM"` rather than `Optional.empty()`, since an empty result leaves the audit field `null`, which weakens the completeness and queryability of the audit trail (e.g., "show me all changes made by the nightly job" becomes impossible if those rows have `null` instead of a consistent marker).

**Q: If a client submits an update to an entity whose `version` no longer matches the current database row, what should the API do, and why is that the correct behavior rather than a bug?**
Answer: The API should reject the update with an HTTP `409 Conflict`, translated from the caught `ObjectOptimisticLockingFailureException`, rather than silently applying the client's stale change. This is correct — not a bug — because it means another actor modified the row after the client last read it; blindly applying the client's update would itself reintroduce the lost-update problem the version check exists to prevent. The client is expected to re-fetch the current state, reconcile any conflicting changes (or simply reapply its intent against the fresh data), and resubmit.
