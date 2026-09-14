# Async Processing — Complete Guide

## Table of Contents
1. [Why Go Asynchronous](#1-why-go-asynchronous)
2. [Enabling Async Support](#2-enabling-async-support)
3. [@Async — Fire-and-Forget Methods](#3-async--fire-and-forget-methods)
4. [The Proxy Mechanism Behind @Async](#4-the-proxy-mechanism-behind-async)
5. [Returning CompletableFuture<T>](#5-returning-completablefuturet)
6. [Configuring a Custom Executor](#6-configuring-a-custom-executor)
7. [Why SimpleAsyncTaskExecutor Is Dangerous in Production](#7-why-simpleasynctaskexecutor-is-dangerous-in-production)
8. [Exception Handling in Async Methods](#8-exception-handling-in-async-methods)
9. [Worked Example — Fire-and-Forget Notification Service](#9-worked-example--fire-and-forget-notification-service)
10. [Worked Example — Combining Multiple CompletableFutures](#10-worked-example--combining-multiple-completablefutures)
11. [Common Pitfalls](#11-common-pitfalls)
12. [Best Practices](#12-best-practices)
13. [Hands-On Exercises](#13-hands-on-exercises)
14. [Interview Q&A](#14-interview-qa)

---

## 1. Why Go Asynchronous

A typical request thread in Spring MVC is occupied for the entire duration of a request, including any slow work it triggers — sending an email, writing an audit log entry, calling a third-party API that the caller doesn't actually need to wait for. If a "place order" endpoint spends 2 of its 2.1 seconds sending a confirmation email, the caller is stuck waiting for an email they don't care about the timing of.

`@Async` lets you push that slow, non-critical work onto a separate thread pool, so the calling thread returns immediately and the work happens in the background.

```
  Synchronous                              Asynchronous (@Async)
  ┌──────────┐                             ┌──────────┐
  │ Caller   │                             │ Caller   │
  └────┬─────┘                             └────┬─────┘
       │ call placeOrder()                      │ call placeOrder()
       ▼                                         ▼
  ┌──────────┐                             ┌──────────┐        submits task
  │ save     │  200ms                      │ save     │  200ms ┌─────────────┐
  │ order    │                             │ order    │───────▶│ TaskExecutor│
  └────┬─────┘                             └────┬─────┘        │ thread pool │
       │                                        │ returns      └──────┬──────┘
       ▼                                        │ immediately         │
  ┌──────────┐                                  ▼                     ▼
  │ send     │  2000ms                    ┌──────────┐          ┌───────────┐
  │ email    │                            │ Caller   │          │ send email│
  └────┬─────┘                            │ gets 200ms response│ (2000ms,  │
       ▼                                  └──────────┘          │ background)│
  ┌──────────┐                                                  └───────────┘
  │ Caller   │
  │ 2200ms   │
  └──────────┘
```

`@Async` is Spring's declarative wrapper around submitting a `Runnable`/`Callable` to an `Executor`. It's built on the same proxy-based AOP mechanism as `@Transactional` and `@Cacheable`.

---

## 2. Enabling Async Support

Add `@EnableAsync` to a configuration class:

```java
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class OrderServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

Like `@EnableCaching`, forgetting this annotation means `@Async` methods run synchronously on the calling thread with no error or warning — the method still executes correctly, it just doesn't get the async behavior you expected.

---

## 3. @Async — Fire-and-Forget Methods

The simplest form: a `void` method annotated `@Async`. The caller's thread returns as soon as the method call is dispatched to the executor; it does not wait for the method body to finish.

```java
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Async
    public void sendOrderConfirmation(String email, Long orderId) {
        System.out.println("Sending confirmation for order " + orderId
                + " on thread " + Thread.currentThread().getName());
        // simulate slow SMTP call
        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        System.out.println("Confirmation sent for order " + orderId);
    }
}
```

```java
@Service
public class OrderService {

    private final EmailService emailService;

    public OrderService(EmailService emailService) {
        this.emailService = emailService;
    }

    public void placeOrder(Order order) {
        // ... save order, charge payment ...
        emailService.sendOrderConfirmation(order.getCustomerEmail(), order.getId());
        System.out.println("placeOrder() returned on thread " + Thread.currentThread().getName());
    }
}
```

Calling `placeOrder` prints "placeOrder() returned ..." almost immediately, while "Confirmation sent ..." appears roughly two seconds later, from a different thread name — proof the email work ran on a separate executor thread without blocking the caller.

---

## 4. The Proxy Mechanism Behind @Async

`@Async`, like `@Cacheable` and `@Transactional`, is implemented via a CGLIB or JDK dynamic proxy wrapping the bean. When a caller invokes an `@Async` method through the proxy, the `AsyncExecutionInterceptor` intercepts the call, submits the actual method invocation as a task to a configured `Executor`, and immediately returns control to the caller (either `void`, or a `Future`/`CompletableFuture` handle representing the pending result).

```
  Caller
    │  orderService.placeOrder() → emailService.sendOrderConfirmation(...)
    ▼
  EmailService$$SpringCGLIB$$0  (proxy)
    │
    ▼
  AsyncExecutionInterceptor
    │  submit(() -> target.sendOrderConfirmation(...)) to Executor
    │  return immediately (void, or a pending Future)
    ▼
  Executor thread pool
    └── runs target.sendOrderConfirmation(...) on a worker thread
```

Because this is proxy-based, the exact same **self-invocation pitfall** from caching and transactions applies here: calling an `@Async` method on `this` from within the same bean bypasses the proxy and runs synchronously on the caller's thread, with no error.

```java
@Service
public class OrderService {

    @Async
    public void sendAsyncNotification(Long orderId) { /* ... */ }

    public void placeOrder(Order order) {
        // BUG: bypasses the proxy — runs synchronously, blocking this thread
        this.sendAsyncNotification(order.getId());
    }
}
```

The fix is identical to the caching case: move `sendAsyncNotification` into a separate bean (as `EmailService` is above) and call it through an injected reference.

---

## 5. Returning CompletableFuture<T>

A `void` `@Async` method is genuinely fire-and-forget — the caller has no way to know when it finishes or whether it succeeded. When the caller needs a result, or needs to know when the work completes, the async method should return `CompletableFuture<T>` (Spring also supports the older `ListenableFuture` and plain `Future`, but `CompletableFuture` is the modern standard and composes with the rest of `java.util.concurrent`).

```java
import java.util.concurrent.CompletableFuture;

@Service
public class InventoryService {

    @Async
    public CompletableFuture<Integer> checkStockLevel(Long productId) {
        System.out.println("Checking stock for " + productId
                + " on " + Thread.currentThread().getName());
        int stock = queryWarehouseSystem(productId); // slow external call
        return CompletableFuture.completedFuture(stock);
    }

    private int queryWarehouseSystem(Long productId) {
        try {
            Thread.sleep(1500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return 42;
    }
}
```

The caller gets a `CompletableFuture<Integer>` back immediately (the method returns as soon as the task is submitted, not when it completes) and can choose to block on it with `.get()`, register a callback with `.thenApply()`/`.thenAccept()`, or combine it with other futures:

```java
@Service
public class ProductPageService {

    private final InventoryService inventoryService;

    public ProductPageService(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    public void printStock(Long productId) throws Exception {
        CompletableFuture<Integer> future = inventoryService.checkStockLevel(productId);
        System.out.println("Called checkStockLevel, doing other work...");
        int stock = future.get(); // blocks here until the async method completes
        System.out.println("Stock level: " + stock);
    }
}
```

Important detail: inside an `@Async` method, you must construct and return the `CompletableFuture` yourself (typically via `CompletableFuture.completedFuture(...)` for a synchronous computation already finished by the time you return, or by chaining `supplyAsync` if you want finer control). Spring does not automatically wrap a plain return value into a future for you — the method signature itself must declare `CompletableFuture<T>`.

---

## 6. Configuring a Custom Executor

By default, `@Async` methods run on Spring's `SimpleAsyncTaskExecutor`, which — despite the name — does not pool threads at all. To use a real, bounded thread pool, define a `ThreadPoolTaskExecutor` bean and either name it `"taskExecutor"` (the default bean name Spring looks for) or reference it explicitly.

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("async-exec-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
```

Or, without implementing `AsyncConfigurer`, simply expose a `ThreadPoolTaskExecutor` bean named `taskExecutor` and reference it per-method for finer control:

```java
@Bean(name = "emailExecutor")
public Executor emailExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);
    executor.setMaxPoolSize(8);
    executor.setQueueCapacity(100);
    executor.setThreadNamePrefix("email-exec-");
    executor.initialize();
    return executor;
}
```

```java
@Async("emailExecutor")
public void sendOrderConfirmation(String email, Long orderId) { /* ... */ }
```

Naming the executor in `@Async("emailExecutor")` is useful when different async workloads have different resource profiles — CPU-bound work vs. I/O-bound external calls, for example — and you want isolation so a burst of slow email sends can't starve time-sensitive background tasks.

| Property | Meaning |
|---|---|
| `corePoolSize` | Threads kept alive even when idle |
| `maxPoolSize` | Hard ceiling on threads under load |
| `queueCapacity` | Tasks queued once `corePoolSize` threads are busy, before spinning up more (up to `maxPoolSize`) |
| `rejectedExecutionHandler` | What happens when the queue is full *and* `maxPoolSize` is reached (e.g., `CallerRunsPolicy` runs the task on the caller's thread as backpressure, instead of throwing) |

---

## 7. Why SimpleAsyncTaskExecutor Is Dangerous in Production

`SimpleAsyncTaskExecutor` is Spring's fallback executor when no `Executor` bean is configured. Its defining, dangerous characteristic: **it spawns a brand-new thread for every single task and never reuses or pools them.**

```
  SimpleAsyncTaskExecutor under load
  ┌───────────────────────────────────────────┐
  │ Task 1 → new Thread("SimpleAsyncTaskExec-1")│
  │ Task 2 → new Thread("SimpleAsyncTaskExec-2")│
  │ Task 3 → new Thread("SimpleAsyncTaskExec-3")│
  │ ...                                          │
  │ Task N → new Thread("SimpleAsyncTaskExec-N")│  ← no upper bound
  └───────────────────────────────────────────┘
  A traffic spike of 10,000 async calls = 10,000 OS threads
```

Consequences in production:

- **No upper bound on concurrent threads.** A traffic spike or a slow downstream dependency (e.g., a stalled third-party API) causes unbounded thread creation, since there's no pool size limiting how many tasks run concurrently.
- **Thread creation/teardown overhead.** Creating an OS thread is expensive relative to reusing a pooled one; under sustained load this becomes measurable overhead per request.
- **Memory pressure.** Every thread reserves stack memory (commonly ~512KB–1MB by default); tens of thousands of concurrent threads can exhaust available memory well before CPU becomes the bottleneck.
- **No backpressure.** There's no queue and no rejection policy — it will keep accepting and spawning threads for new tasks until the JVM or OS simply cannot create more, typically manifesting as an `OutOfMemoryError: unable to create new native thread`.

This is why Section 6's custom `ThreadPoolTaskExecutor` — with a bounded `maxPoolSize`, a finite `queueCapacity`, and an explicit `RejectedExecutionHandler` — is considered mandatory for any production `@Async` usage. `SimpleAsyncTaskExecutor` is acceptable only for quick prototypes or tests where load is trivial and controlled.

---

## 8. Exception Handling in Async Methods

Exceptions thrown from `@Async` methods behave differently depending on the return type:

- **`CompletableFuture<T>` return type** — an exception thrown inside the method is captured into the future itself. Callers see it when they call `.get()` (wrapped in `ExecutionException`) or via `.exceptionally()`/`.handle()` callbacks. This is the same behavior as any `CompletableFuture`-based code.
- **`void` return type** — there is no future for the exception to attach to, and by default Spring just logs it. Since the caller already moved on, it has no way to observe the failure through a normal try/catch.

To customize how `void` async method exceptions are handled — sending an alert, writing to a dead-letter table, incrementing a metric — implement `AsyncUncaughtExceptionHandler` and wire it in via `AsyncConfigurer`:

```java
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import java.lang.reflect.Method;

public class LoggingAsyncExceptionHandler implements AsyncUncaughtExceptionHandler {

    @Override
    public void handleUncaughtException(Throwable ex, Method method, Object... params) {
        System.err.println("Async method '" + method.getName()
                + "' threw exception with args " + java.util.Arrays.toString(params)
                + ": " + ex.getMessage());
        // e.g., publish to a metrics/alerting system here
    }
}
```

```java
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        // ... ThreadPoolTaskExecutor as before ...
        return buildExecutor();
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return new LoggingAsyncExceptionHandler();
    }

    private Executor buildExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("async-exec-");
        executor.initialize();
        return executor;
    }
}
```

`AsyncUncaughtExceptionHandler` only applies to `void`-returning `@Async` methods. `CompletableFuture`-returning methods should always handle their own exceptions with `.exceptionally()` or by inspecting `ExecutionException` at the `.get()` call site — `getAsyncUncaughtExceptionHandler()` is never consulted for those.

---

## 9. Worked Example — Fire-and-Forget Notification Service

A user-registration flow that must not block on sending a welcome email or a Slack alert to the ops channel.

```java
@Service
public class NotificationService {

    @Async("emailExecutor")
    public void sendWelcomeEmail(String email) {
        simulateSlowIo(1500);
        System.out.println("Welcome email sent to " + email
                + " [" + Thread.currentThread().getName() + "]");
    }

    @Async("emailExecutor")
    public void notifyOpsChannel(String message) {
        simulateSlowIo(500);
        System.out.println("Ops notified: " + message
                + " [" + Thread.currentThread().getName() + "]");
    }

    private void simulateSlowIo(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

```java
@Service
public class UserRegistrationService {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public UserRegistrationService(NotificationService notificationService,
                                    UserRepository userRepository) {
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    public User register(String email, String name) {
        User user = userRepository.save(new User(email, name));

        // Fire-and-forget: registration completes without waiting on either call
        notificationService.sendWelcomeEmail(email);
        notificationService.notifyOpsChannel("New user registered: " + email);

        return user; // returned to the caller well before the emails finish sending
    }
}
```

`register()` returns as soon as the database save completes; both notification calls are dispatched to `emailExecutor` and run concurrently in the background, with no coupling between registration latency and notification latency.

---

## 10. Worked Example — Combining Multiple CompletableFutures

A product detail page that needs pricing, inventory, and review-summary data from three independent, slow services. Fetching them sequentially would sum their latencies; fetching them concurrently and joining the results takes only as long as the slowest one.

```java
@Service
public class ProductDetailService {

    private final PricingService pricingService;
    private final InventoryService inventoryService;
    private final ReviewService reviewService;

    public ProductDetailService(PricingService pricingService,
                                 InventoryService inventoryService,
                                 ReviewService reviewService) {
        this.pricingService = pricingService;
        this.inventoryService = inventoryService;
        this.reviewService = reviewService;
    }

    public ProductDetail getProductDetail(Long productId) throws Exception {
        CompletableFuture<BigDecimal> priceFuture = pricingService.getPrice(productId);
        CompletableFuture<Integer> stockFuture = inventoryService.checkStockLevel(productId);
        CompletableFuture<Double> ratingFuture = reviewService.getAverageRating(productId);

        // All three run concurrently on the executor; join waits for the slowest.
        CompletableFuture<ProductDetail> combined = CompletableFuture.allOf(
                        priceFuture, stockFuture, ratingFuture)
                .thenApply(v -> new ProductDetail(
                        productId,
                        priceFuture.join(),
                        stockFuture.join(),
                        ratingFuture.join()));

        return combined.get(); // blocks once, for the max of the three latencies
    }
}
```

```java
@Service
public class PricingService {
    @Async
    public CompletableFuture<BigDecimal> getPrice(Long productId) {
        sleep(800);
        return CompletableFuture.completedFuture(new BigDecimal("29.99"));
    }
    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
```

If pricing takes 800ms, inventory takes 1500ms, and reviews take 300ms, calling them sequentially would take roughly 2600ms total. Dispatched concurrently via `@Async` and joined with `CompletableFuture.allOf`, the whole operation takes roughly 1500ms — bounded by the slowest individual call rather than their sum. If any of the three futures completes exceptionally, `.join()` on that future rethrows a `CompletionException` wrapping the original cause, which propagates out of `getProductDetail`.

---

## 11. Common Pitfalls

- **Forgetting `@EnableAsync`** — methods run synchronously with no error, silently defeating the purpose.
- **Self-invocation** — calling an `@Async` method from within the same bean bypasses the proxy and runs synchronously (see Section 4).
- **Relying on the default `SimpleAsyncTaskExecutor`** in production — unbounded thread creation under load (see Section 7).
- **Swallowing exceptions from `void` async methods** — without a custom `AsyncUncaughtExceptionHandler`, failures are just logged and easy to miss; nothing surfaces to the caller or to monitoring.
- **Blocking immediately on `.get()`** right after calling an async method, without doing any other work in between — this defeats the purpose of going async at all; if you must block immediately, a synchronous call would have been simpler.
- **Not propagating request-scoped context** (e.g., `SecurityContext`, MDC/trace IDs for logging) into the async thread — by default, async tasks run on a different thread that doesn't automatically inherit `ThreadLocal`-based context like the security principal or logging correlation ID, causing confusing gaps in security or trace continuity.
- **Marking a method `@Async` and `@Transactional` on the same call without understanding ordering** — the transaction started in the async method is independent of the caller's transaction (if any), since it runs on a separate thread; you cannot span a single transaction across the caller and the async method.

---

## 12. Best Practices

- Always configure a bounded `ThreadPoolTaskExecutor` (with `corePoolSize`, `maxPoolSize`, `queueCapacity`, and a `RejectedExecutionHandler`) — never rely on the default `SimpleAsyncTaskExecutor` in production.
- Use named executors (`@Async("emailExecutor")`) to isolate different workloads (I/O-bound vs. CPU-bound, critical vs. best-effort) so one noisy workload can't starve another.
- Return `CompletableFuture<T>` whenever the caller needs the result or needs to know completion/failure; use `void` only for genuine fire-and-forget work where the caller truly does not care about the outcome.
- Always register an `AsyncUncaughtExceptionHandler` for `void` async methods — silent failures are hard to debug in production.
- Keep `@Async` methods on separate beans from their callers to avoid the self-invocation trap.
- Size thread pools based on the nature of the work: I/O-bound tasks (waiting on network calls) can support a larger pool than CPU-bound tasks (bounded roughly by core count).
- Monitor executor queue depth and active thread count in production (Spring Boot Actuator exposes `ThreadPoolTaskExecutor` metrics) so pool exhaustion is visible before it causes timeouts.

---

## 13. Hands-On Exercises

1. Build a `ReportService` with an `@Async` `void` method that sleeps for 2 seconds then prints a message. Call it from a controller and confirm the HTTP response returns before the message is printed. Add `@EnableAsync` after first confirming it doesn't work without it.
2. Reproduce the self-invocation bug: call an `@Async` method from another method on the same bean, confirm (via thread name logging) that it runs on the caller's thread instead of an executor thread, then fix it by moving the method to a separate bean.
3. Configure a `ThreadPoolTaskExecutor` with `corePoolSize=2`, `maxPoolSize=2`, `queueCapacity=1`, and `ThreadPoolExecutor.AbortPolicy`. Fire off 5 concurrent async calls at once and observe the `RejectedExecutionException` once the pool and queue are both full.
4. Write two `@Async` methods returning `CompletableFuture<String>` that each sleep for a different duration, then combine their results with `CompletableFuture.allOf(...).thenApply(...)`. Measure and print the total elapsed time to confirm it's close to the slower of the two, not their sum.
5. Implement a custom `AsyncUncaughtExceptionHandler` that logs the failing method name and arguments. Add a `void` `@Async` method that deliberately throws a `RuntimeException`, call it, and confirm your handler fires instead of the exception silently disappearing.

---

## 14. Interview Q&A

**Q1: What's the difference between a `void` `@Async` method and one returning `CompletableFuture<T>`?**
A `void` async method is genuinely fire-and-forget: the caller has no handle to check completion, retrieve a result, or catch an exception — any thrown exception only reaches an `AsyncUncaughtExceptionHandler`, never the caller. A method returning `CompletableFuture<T>` gives the caller a handle they can block on with `.get()`, chain callbacks onto with `.thenApply()`/`.thenAccept()`, or handle failures on with `.exceptionally()` — exceptions thrown inside the method are captured into the future rather than just logged.

**Q2: Why is `SimpleAsyncTaskExecutor` considered dangerous in production?**
It creates a brand-new OS thread for every task submitted and never reuses or pools them, with no maximum thread count and no task queue. Under load — a traffic spike, or a slow downstream dependency causing tasks to pile up — this leads to unbounded thread creation, exhausting memory (each thread reserves stack space) or hitting OS thread limits, typically surfacing as `OutOfMemoryError: unable to create new native thread`. Production code should always configure a `ThreadPoolTaskExecutor` with bounded `corePoolSize`/`maxPoolSize`/`queueCapacity` and an explicit rejection policy instead.

**Q3: Why does self-invocation break `@Async`, and how do you fix it?**
`@Async` is implemented via a proxy wrapping the bean; only calls that arrive through that proxy get intercepted and dispatched to an executor. A method calling another `@Async` method on `this` calls the real object directly, bypassing the proxy, so the method runs synchronously on the caller's thread with no warning. The fix is to move the `@Async` method to a separate Spring-managed bean and call it through an injected reference, ensuring the call passes through a genuine proxy.

**Q4: How would you run three independent slow operations concurrently and combine their results?**
Have each operation exposed as its own `@Async` method returning `CompletableFuture<T>`. Call all three without blocking in between so they're all submitted to the executor and start running concurrently, then combine them with `CompletableFuture.allOf(f1, f2, f3).thenApply(v -> ...)`, calling `.join()` on each individual future inside the combiner to extract results once all are done. The overall wall-clock time is bounded by the slowest of the three rather than their sum, provided the executor's thread pool has enough capacity to run all three at once.

**Q5: How do you handle an exception thrown inside a `void` `@Async` method?**
Since there's no `Future` for the exception to propagate through, Spring by default just logs it via a default handler, and the caller never sees it. To customize this — send an alert, write to a dead-letter store, increment a failure metric — implement `AsyncUncaughtExceptionHandler` and return it from `AsyncConfigurer.getAsyncUncaughtExceptionHandler()`. This only applies to `void`-returning async methods; `CompletableFuture`-returning methods should handle exceptions themselves via `.exceptionally()` or by catching `ExecutionException` at the `.get()` call site.

**Q6: If a caller has an active transaction and calls an `@Async` method, does the async method run in the same transaction?**
No. The async method executes on a different thread from a thread pool, and Spring's `@Transactional` support is thread-bound (backed by `ThreadLocal` transaction synchronization), so the async method starts with no transaction context by default — it either runs without a transaction or opens its own new one if it's separately annotated `@Transactional`. You cannot span a single database transaction across the caller's thread and an asynchronously executed method; anything that must be transactionally consistent with the caller's work needs to happen before the async call is made, or the async method needs its own self-contained transaction boundary.
