# @Transactional Deep Dive — Complete Guide

## Table of Contents

1. [What @Transactional Actually Does](#1-what-transactional-actually-does)
2. [Spring AOP Proxies — JDK Dynamic Proxy vs CGLIB](#2-spring-aop-proxies--jdk-dynamic-proxy-vs-cglib)
3. [The Self-Invocation Problem](#3-the-self-invocation-problem)
4. [Fixing Self-Invocation](#4-fixing-self-invocation)
5. [Propagation Types](#5-propagation-types)
6. [Worked Scenarios — REQUIRED, REQUIRES_NEW, NESTED](#6-worked-scenarios--required-requires_new-nested)
7. [Isolation Levels](#7-isolation-levels)
8. [Read Phenomena Prevented by Each Isolation Level](#8-read-phenomena-prevented-by-each-isolation-level)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. What @Transactional Actually Does

`@Transactional` is not magic bytecode woven directly into your method. It is a **declarative marker** that Spring's transaction infrastructure reads at startup to decide which beans need to be wrapped in a proxy that manages a database transaction around the annotated method call.

At a high level, when a `@Transactional` method is invoked through the proxy:

```text
Caller
  │
  ▼
┌─────────────────────────────────────────────┐
│              Transactional Proxy             │
│                                               │
│  1. Begin transaction (or join existing one) │
│  2. Invoke the real target method            │
│  3. Method returns normally  → commit         │
│     Method throws unchecked  → rollback       │
│  4. Restore prior transaction context         │
└───────────────────┬───────────────────────────┘
                     │
                     ▼
            Real target object
           (your @Service bean)
```

The proxy is created by Spring's AOP infrastructure, driven by `PlatformTransactionManager` (or `TransactionManager` for reactive/JTA setups) and the interceptor `TransactionInterceptor`. This is why understanding transactions requires understanding proxies first — everything about propagation, isolation, and rollback rules is implemented as behavior of that interceptor, not the method itself.

## 2. Spring AOP Proxies — JDK Dynamic Proxy vs CGLIB

Spring AOP (the mechanism behind `@Transactional`, `@Async`, `@Cacheable`, and custom aspects) works by generating a **proxy object** at runtime that sits between the caller and your real bean. There are two proxy strategies:

| Strategy | How it works | Requirement | Can proxy... |
|----------|--------------|-------------|---------------|
| JDK dynamic proxy | Generates a proxy implementing the same **interfaces** as the target bean, using `java.lang.reflect.Proxy` | Target bean must implement at least one interface | Only methods declared on an implemented interface |
| CGLIB proxy | Generates a **subclass** of the target's concrete class at runtime, overriding methods | Target class (and the method) must not be `final` | Public and protected methods of the class itself |

Since Spring Boot 2.x, **CGLIB is the default** for `@Configuration`-managed proxying and Spring Boot autoconfigures `spring.aop.proxy-target-class=true` by default — meaning even if your service implements an interface, Spring will still generate a CGLIB subclass proxy unless you explicitly set that property to `false`.

```text
   JDK Dynamic Proxy                      CGLIB Proxy
 ┌───────────────────┐               ┌───────────────────┐
 │ OrderServiceProxy  │               │ OrderService$$SpringCGLIB │
 │ implements         │               │ extends OrderService      │
 │ OrderService        │               │ (concrete subclass)       │
 └─────────┬──────────┘               └──────────┬────────────┘
           │ delegates to                          │ delegates to
           ▼                                       ▼
   OrderServiceImpl                         OrderService (real bean)
   (real target, behind                    (real target, itself
    the interface)                          the subclassed object)
```

Practical implications:
- A class marked `final`, or a method marked `final`/`private`/`static`, **cannot** be proxied by CGLIB — Spring will either fail to apply the aspect silently (for non-annotated cases) or throw at startup for misconfigured proxy scenarios.
- A `@Transactional` method must be **public** — Spring's proxy-based AOP only intercepts calls that go through the proxy's public API; `protected`/`private`/package-private methods are invisible to the JDK dynamic proxy strategy and, even under CGLIB where they're technically overridable, Spring's transaction advisor by design only applies to public methods.
- The proxy is a **separate object** registered in the application context in place of your raw bean. Any code that gets the bean via dependency injection receives the *proxy*, never the raw target — this fact is the entire reason the self-invocation problem exists (Section 3).

## 3. The Self-Invocation Problem

Because the proxy wraps the *target* object and is a different object from it, transactional behavior is only applied when a call arrives **from outside**, through the proxy. A method calling another method *on `this`*, from within the same class, bypasses the proxy entirely — it's a plain Java method call on the raw target object.

```java
@Service
public class ReportService {

    private final ReportRepository reportRepository;

    public ReportService(ReportRepository reportRepository) {
        this.reportRepository = reportRepository;
    }

    // Public, no @Transactional — called from the controller
    public void generateMonthlyReport(Long accountId) {
        // ... build report data ...
        saveReport(accountId);   // <-- plain "this.saveReport(...)" call!
    }

    @Transactional
    public void saveReport(Long accountId) {
        reportRepository.save(new Report(accountId));
        // if this throws, callers expect a rollback... but it won't happen
        // for anything else the transaction was supposed to protect,
        // because there was never a proxy-managed transaction to begin with.
    }
}
```

When `generateMonthlyReport` calls `saveReport(accountId)`, it calls it as `this.saveReport(...)` — a direct JVM method invocation on the raw `ReportService` instance, not a call through the CGLIB/JDK proxy that Spring registered in the context. The `TransactionInterceptor` that would normally open a transaction, catch exceptions, and decide to commit or roll back **never runs**. `@Transactional` on `saveReport` here is silently ignored whenever it's called this way — no exception, no warning by default, just quietly non-transactional behavior. This is one of the most common causes of "why isn't my rollback working?" bugs in real Spring codebases.

```text
   External caller (e.g. Controller)
            │
            ▼
   ┌─────────────────────┐
   │  ReportService Proxy │   ← proxy intercepts external calls
   └──────────┬───────────┘
              │ delegates to
              ▼
   ┌─────────────────────┐
   │   ReportService      │
   │   (raw target)        │
   │                       │
   │  generateMonthlyReport│
   │        │              │
   │        ▼              │
   │   this.saveReport()   │  ← bypasses proxy entirely!
   │        (no proxy,     │
   │         no @Transactional
   │         behavior)     │
   └───────────────────────┘
```

## 4. Fixing Self-Invocation

There are three standard fixes, in order of how commonly they're used:

**Option A — Move the transactional method to a separate bean.** This is the cleanest fix architecturally, because it also tends to separate concerns correctly (report *building* vs report *persisting*):

```java
@Service
public class ReportService {

    private final ReportPersistenceService reportPersistenceService;

    public ReportService(ReportPersistenceService reportPersistenceService) {
        this.reportPersistenceService = reportPersistenceService;
    }

    public void generateMonthlyReport(Long accountId) {
        // ... build report data ...
        reportPersistenceService.saveReport(accountId); // call through a real proxy
    }
}

@Service
public class ReportPersistenceService {

    private final ReportRepository reportRepository;

    public ReportPersistenceService(ReportRepository reportRepository) {
        this.reportRepository = reportRepository;
    }

    @Transactional
    public void saveReport(Long accountId) {
        reportRepository.save(new Report(accountId));
    }
}
```

**Option B — Self-injection.** Inject the bean's own proxy into itself and call through it. Slightly unusual-looking, but works and avoids introducing a new class when one doesn't naturally fit:

```java
@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final ReportService self; // the proxy, injected into itself

    public ReportService(ReportRepository reportRepository,
                          @Lazy ReportService self) {
        this.reportRepository = reportRepository;
        this.self = self; // @Lazy breaks the circular-dependency chicken-and-egg problem
    }

    public void generateMonthlyReport(Long accountId) {
        // ... build report data ...
        self.saveReport(accountId); // goes through the proxy this time
    }

    @Transactional
    public void saveReport(Long accountId) {
        reportRepository.save(new Report(accountId));
    }
}
```

`@Lazy` is required on the injected self-reference because otherwise Spring tries to fully construct `ReportService` while it's still constructing `ReportService` (a circular dependency on itself) — `@Lazy` defers resolution to a proxy that's only initialized on first use.

**Option C — Programmatic transaction management** using `TransactionTemplate`, sidestepping AOP proxying entirely:

```java
@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final TransactionTemplate transactionTemplate;

    public ReportService(ReportRepository reportRepository, PlatformTransactionManager txManager) {
        this.reportRepository = reportRepository;
        this.transactionTemplate = new TransactionTemplate(txManager);
    }

    public void generateMonthlyReport(Long accountId) {
        // ... build report data ...
        transactionTemplate.executeWithoutResult(status ->
                reportRepository.save(new Report(accountId)));
    }
}
```

This is more verbose and rarely necessary, but it's useful for fine-grained control (e.g. a transaction that spans only part of a loop body) or in code that must remain proxy-free for other reasons.

## 5. Propagation Types

Propagation defines how a `@Transactional` method behaves when it's called while a transaction is **already active** (or, in some cases, when one is not).

| Propagation | Existing transaction present | No existing transaction | Typical use case |
|-------------|-------------------------------|--------------------------|-------------------|
| `REQUIRED` (default) | Joins the existing transaction | Starts a new one | The overwhelming default — most service methods |
| `REQUIRES_NEW` | Suspends the existing transaction, starts a fresh independent one | Starts a new one | Audit logging that must persist even if the outer operation rolls back |
| `NESTED` | Starts a savepoint within the existing transaction | Starts a new one (behaves like `REQUIRED`) | Partial rollback of a sub-step without aborting the whole operation |
| `MANDATORY` | Joins the existing transaction | **Throws** `IllegalTransactionStateException` | Enforcing that a method is only ever called within an existing transaction |
| `SUPPORTS` | Joins the existing transaction | Runs non-transactionally | Methods that work either way (e.g. shared read helpers) |
| `NOT_SUPPORTED` | Suspends the existing transaction, runs without one | Runs without one | Long-running non-transactional work (e.g. external HTTP calls) that shouldn't hold a DB connection open |
| `NEVER` | **Throws** `IllegalTransactionStateException` | Runs without one | Enforcing that a method must never run inside a transaction |

## 6. Worked Scenarios — REQUIRED, REQUIRES_NEW, NESTED

**REQUIRED — the default, "join or create."** A typical order-placement flow where the inventory update and the order creation must succeed or fail as one unit:

```java
@Service
public class OrderService {

    private final InventoryService inventoryService; // REQUIRED method
    private final OrderRepository orderRepository;

    public OrderService(InventoryService inventoryService, OrderRepository orderRepository) {
        this.inventoryService = inventoryService;
        this.orderRepository = orderRepository;
    }

    @Transactional // starts TX-A
    public void placeOrder(OrderRequest request) {
        inventoryService.reserveStock(request.productId(), request.quantity()); // joins TX-A
        orderRepository.save(new Order(request));
        // if reserveStock threw, this line never runs, and TX-A rolls back entirely
    }
}

@Service
public class InventoryService {

    @Transactional // REQUIRED (default) — joins the caller's transaction if one exists
    public void reserveStock(Long productId, int quantity) {
        // ... decrement stock ...
    }
}
```

Because both methods use `REQUIRED`, they share a single physical database transaction (`TX-A`). If `reserveStock` throws, the *entire* transaction — including the not-yet-executed `orderRepository.save` — rolls back. This is what you want for operations that are logically one atomic unit.

**REQUIRES_NEW — "always start fresh, independent of the caller."** Audit logging that must survive even if the business operation that triggered it later fails:

```java
@Service
public class OrderService {

    private final AuditService auditService;
    private final PaymentGateway paymentGateway;

    public OrderService(AuditService auditService, PaymentGateway paymentGateway) {
        this.auditService = auditService;
        this.paymentGateway = paymentGateway;
    }

    @Transactional // TX-A
    public void chargeCustomer(Order order) {
        auditService.logAttempt(order.getId()); // runs in its own TX-B, commits immediately
        paymentGateway.charge(order.getTotalPrice()); // if this throws, TX-A rolls back...
        // ...but the audit log entry from TX-B already committed and survives.
    }
}

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAttempt(Long orderId) {
        auditLogRepository.save(new AuditLog(orderId, "PAYMENT_ATTEMPT"));
    }
}
```

`TX-A` (the caller) is **suspended** while `TX-B` runs to completion and commits independently. Even if `paymentGateway.charge` later throws and rolls back `TX-A`, the audit record from `TX-B` is already durably committed — exactly the desired behavior for audit trails, which must reflect that an attempt was made regardless of the outcome.

**NESTED — "a rollback-able checkpoint inside the same transaction."** Processing a batch of items where one failing item shouldn't abort the whole batch:

```java
@Service
public class BatchImportService {

    private final ItemService itemService;
    private final ImportLogRepository importLogRepository;

    public BatchImportService(ItemService itemService, ImportLogRepository importLogRepository) {
        this.itemService = itemService;
        this.importLogRepository = importLogRepository;
    }

    @Transactional // TX-A, the overall batch
    public void importBatch(List<ItemDto> items) {
        for (ItemDto item : items) {
            try {
                itemService.importOne(item); // runs in a savepoint within TX-A
            } catch (ItemValidationException ex) {
                // roll back only to the savepoint, not the whole TX-A
                importLogRepository.save(new ImportLog(item.getSku(), "FAILED: " + ex.getMessage()));
            }
        }
    }
}

@Service
public class ItemService {

    @Transactional(propagation = Propagation.NESTED)
    public void importOne(ItemDto item) {
        // validate + save; if this throws, only this savepoint is rolled back
    }
}
```

`NESTED` relies on JDBC **savepoints**, so it requires a driver/database that supports them (most do — PostgreSQL, MySQL/InnoDB, Oracle) and it must run through Spring's `DataSourceTransactionManager` (it is **not** supported by JPA's own transaction manager when using certain JPA providers without a JDBC-based delegate — verify support before relying on it in a JPA-heavy stack). When `importOne` throws, only the work since its savepoint is undone; the surrounding `TX-A` batch transaction is still healthy and can continue and eventually commit everything that succeeded.

## 7. Isolation Levels

Isolation controls how much one transaction can "see" of another transaction's in-progress (uncommitted) or concurrently committed changes.

```java
@Transactional(isolation = Isolation.REPEATABLE_READ)
public BigDecimal getAccountBalance(Long accountId) {
    return accountRepository.findById(accountId)
            .orElseThrow()
            .getBalance();
}
```

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Relative Cost |
|-----------------|:----------:|:--------------------:|:-------------:|:--------------:|
| `READ_UNCOMMITTED` | Possible | Possible | Possible | Lowest |
| `READ_COMMITTED` | Prevented | Possible | Possible | Low (most DBs' default) |
| `REPEATABLE_READ` | Prevented | Prevented | Possible* | Medium (MySQL/InnoDB default) |
| `SERIALIZABLE` | Prevented | Prevented | Prevented | Highest |

\* MySQL's InnoDB `REPEATABLE_READ` actually prevents most phantom reads too, via next-key locking — this is a well-known deviation from the strict SQL standard definition, where `REPEATABLE_READ` alone does not guarantee phantom-read prevention on other databases like PostgreSQL.

`Isolation.DEFAULT` (Spring's default) simply defers to whatever the underlying database's default isolation level is — for PostgreSQL and Oracle that's `READ_COMMITTED`; for MySQL/InnoDB it's `REPEATABLE_READ`.

## 8. Read Phenomena Prevented by Each Isolation Level

```text
Dirty Read
──────────
TX1: UPDATE balance = 500 WHERE id = 1;         (not committed yet)
TX2:                                    SELECT balance WHERE id = 1;  → reads 500 (uncommitted!)
TX1: ROLLBACK;                                   (500 never actually happened)
TX2 acted on data that never existed.

Non-Repeatable Read
────────────────────
TX2: SELECT balance WHERE id = 1;   → reads 300
TX1: UPDATE balance = 500 WHERE id = 1; COMMIT;
TX2: SELECT balance WHERE id = 1;   → reads 500 (different value, same transaction!)

Phantom Read
────────────
TX2: SELECT * FROM orders WHERE status = 'PENDING';   → returns 5 rows
TX1: INSERT INTO orders (status) VALUES ('PENDING'); COMMIT;
TX2: SELECT * FROM orders WHERE status = 'PENDING';   → returns 6 rows (a "phantom" appeared!)
```

- **Dirty read** — reading uncommitted changes from another transaction that might later be rolled back. Prevented starting at `READ_COMMITTED`.
- **Non-repeatable read** — re-reading the *same row* within one transaction and getting a different value because another transaction committed an update in between. Prevented starting at `REPEATABLE_READ`.
- **Phantom read** — re-running the *same query* within one transaction and getting a different **set of rows** because another transaction inserted/deleted matching rows in between. Only `SERIALIZABLE` guarantees prevention per the SQL standard (though, as noted, InnoDB's `REPEATABLE_READ` closes most of this gap in practice via next-key locks).

Choosing an isolation level is a trade-off between correctness guarantees and concurrency/throughput: `SERIALIZABLE` gives the strongest guarantees but forces more locking/blocking (or transaction retries, in optimistic implementations) and is rarely used outside of financial reconciliation or other correctness-critical batch jobs; `READ_COMMITTED` is the pragmatic default for most CRUD-style web applications.

## 9. Common Pitfalls

**Calling a `@Transactional` method from another method in the same class.** As detailed in Section 3 — silently non-transactional. Fix: separate bean, self-injection with `@Lazy`, or `TransactionTemplate`.

**Assuming `@Transactional` on a `private` method works.** Spring's proxy-based AOP can only intercept calls that arrive through the proxy's public surface; annotating a `private` method does nothing (Spring won't even warn you in some versions) because the proxy can never see or override it.

**Marking a class or method `final` and expecting CGLIB proxying to still apply.** CGLIB works by subclassing; a `final` class can't be subclassed and a `final` method can't be overridden, so the transactional advice silently never wires in. Fix: remove `final`, or ensure the bean implements an interface and rely on JDK dynamic proxies instead.

**Using `REQUIRES_NEW` for "just in case" isolation without understanding the cost.** Each `REQUIRES_NEW` call suspends the outer transaction and opens a brand-new physical database connection/transaction — under load this multiplies connection pool usage and can create surprising deadlocks between the suspended and nested transactions competing for the same rows. Reserve it for genuinely independent units of work (audit logs, notification dispatch), not as a default choice.

**Expecting `NESTED` to behave like `REQUIRES_NEW`.** They look similar (both handle "an inner unit that can fail independently") but `NESTED` shares the same physical connection/transaction and rolls back only to a savepoint — it commits together with the outer transaction, and is not supported by every transaction manager/database combination. Verify savepoint support before depending on it.

**Choosing `SERIALIZABLE` everywhere for "safety."** Leads to excessive lock contention or transaction-retry storms under concurrent load, often without commensurate business benefit — many apparent race conditions are better solved with optimistic locking (`@Version`) or narrower pessimistic locks, not a blanket isolation escalation.

## 10. Best Practices

- Default to `Propagation.REQUIRED` (Spring's default — you rarely need to state it explicitly) unless you have a specific, nameable reason for something else.
- Reserve `REQUIRES_NEW` for operations that must commit independently of the surrounding transaction's outcome (audit trails, fire-and-forget notifications) — and be conscious of the extra connection it consumes.
- Reach for `NESTED` when you need partial-failure tolerance within a single larger unit of work (batch item processing) and confirm your database/driver supports savepoints first.
- Never call a `@Transactional` method via `this.` from inside the same class — always route through the Spring-managed proxy (a separate bean, or a `@Lazy` self-injected reference).
- Keep `@Transactional` methods `public`; don't rely on AOP to intercept `protected`/`private`/package-private methods.
- Avoid `final` on classes/methods you intend to be proxied unless you've deliberately switched to interface-based JDK proxies.
- Pick isolation levels based on the specific phenomena your business logic cannot tolerate, not out of blanket caution — `READ_COMMITTED` is the right default for the vast majority of CRUD operations.
- Keep transactions short — avoid making external HTTP calls, sending emails, or doing slow I/O inside a `@Transactional` method, since it holds a database connection (and possibly locks) open for the duration.

## 11. Hands-On Exercises

1. Write two classes, `ServiceA` (public method, no `@Transactional`) calling its own `saveInternal()` (annotated `@Transactional`) via `this.`. Add a debug breakpoint or logging inside `TransactionSynchronizationManager.isActualTransactionActive()` at the start of `saveInternal` and confirm it prints `false`, proving the transaction never started.
2. Fix the class from Exercise 1 using the `@Lazy` self-injection pattern and confirm `isActualTransactionActive()` now prints `true`.
3. Build a two-service scenario using `REQUIRES_NEW` (an audit log write) nested inside a `REQUIRED` outer transaction; force the outer transaction to throw after the audit call and verify (via a fresh query) that the audit record persisted despite the outer rollback.
4. Configure a `NESTED` propagation scenario processing a list of 5 items where item 3 intentionally throws; verify items 1, 2, 4, and 5 commit while item 3's changes alone are rolled back.
5. Using two database sessions (e.g., two terminal `psql`/`mysql` clients) manually simulate a non-repeatable read at `READ_COMMITTED` isolation, then repeat the same experiment at `REPEATABLE_READ` and observe the difference in what the second read returns.

## 12. Interview Q&A

**Q1: How does `@Transactional` actually work under the hood?**
It is implemented via Spring AOP: at context startup, Spring detects `@Transactional`-annotated beans and wraps them in a proxy (CGLIB subclass or JDK dynamic proxy) instead of registering the raw object. Every external call to the bean goes through that proxy, which is backed by a `TransactionInterceptor` — it begins or joins a transaction using the configured `PlatformTransactionManager` before invoking the real method, and on return decides whether to commit (normal return) or roll back (matching exception thrown), based on the propagation, isolation, and rollback-rule attributes on the annotation.

**Q2: Why does calling a `@Transactional` method from another method in the same class not work?**
Because the proxy is a distinct object wrapping the target bean — Spring registers the *proxy* in the application context, and dependency injection anywhere else in the app receives that proxy. But a call from one method to another *within the same class* is a direct `this.method()` JVM call on the raw, unproxied target instance; it never passes through the proxy, so the `TransactionInterceptor` never runs and the transactional behavior is silently skipped, with no exception or warning by default.

**Q3: What are the practical differences between JDK dynamic proxies and CGLIB proxies in Spring AOP?**
JDK dynamic proxies implement the same interfaces as the target and can only intercept methods declared on an implemented interface, requiring the bean to implement at least one interface. CGLIB proxies instead generate a runtime subclass of the target's concrete class, which means the target class and the specific methods must not be `final`, but it works even without an interface. Since Spring Boot 2.x, CGLIB is the default (`proxy-target-class=true`) even for beans that do implement interfaces, unless explicitly configured otherwise.

**Q4: Explain the difference between `REQUIRED`, `REQUIRES_NEW`, and `NESTED` propagation with an example of when you'd choose each.**
`REQUIRED` (the default) joins an existing transaction if one is active, or starts a new one — appropriate for the common case where an inner method call is logically part of the same atomic operation as its caller, such as decrementing stock and creating an order together. `REQUIRES_NEW` always suspends any existing transaction and starts a completely independent one that commits or rolls back on its own — appropriate for audit logging that must persist even if the surrounding business operation later fails. `NESTED` starts a savepoint within the existing transaction, so a failure in the nested unit can be rolled back to that savepoint without aborting the entire outer transaction — appropriate for batch processing where one bad item shouldn't cancel the whole batch, though it requires database/driver savepoint support.

**Q5: What's the difference between a dirty read, a non-repeatable read, and a phantom read, and which isolation levels prevent each?**
A dirty read is seeing another transaction's uncommitted changes, which might later be rolled back — prevented starting at `READ_COMMITTED`. A non-repeatable read is re-reading the same row twice within one transaction and getting different values because another transaction committed an update in between — prevented starting at `REPEATABLE_READ`. A phantom read is re-running the same query and getting a different set of matching rows because another transaction inserted or deleted rows in between — only `SERIALIZABLE` guarantees prevention per the SQL standard, though MySQL's InnoDB `REPEATABLE_READ` closes most of that gap in practice via next-key locking.

**Q6: If self-invocation breaks `@Transactional`, what are the standard ways to fix it, and which would you choose?**
The three standard fixes are: extracting the transactional method into a separate `@Service` bean and calling it through normal dependency injection (usually the cleanest, since it often also improves separation of concerns); injecting a `@Lazy` self-reference into the same bean and calling the transactional method through that proxy reference; or bypassing declarative transactions altogether with programmatic `TransactionTemplate` usage. In most real codebases the first option is preferable because it forces you to name and separate the two responsibilities involved, whereas self-injection, while valid, tends to read as a workaround and can obscure why the extra field exists to someone unfamiliar with the pattern.
