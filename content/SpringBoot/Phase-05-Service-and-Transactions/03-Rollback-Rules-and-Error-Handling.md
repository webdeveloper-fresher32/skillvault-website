# Rollback Rules & Error Handling — Complete Guide

## Table of Contents

1. [Default Rollback Behavior](#1-default-rollback-behavior)
2. [Why Checked Exceptions Don't Trigger Rollback by Default](#2-why-checked-exceptions-dont-trigger-rollback-by-default)
3. [rollbackFor and noRollbackFor](#3-rollbackfor-and-norollbackfor)
4. [readOnly=true — What It Actually Optimizes](#4-readonlytrue--what-it-actually-optimizes)
5. [Transaction Timeout](#5-transaction-timeout)
6. [The Swallowed-Exception Pitfall](#6-the-swallowed-exception-pitfall)
7. [Worked Example — Multi-Step Service with Partial-Failure Handling](#7-worked-example--multi-step-service-with-partial-failure-handling)
8. [Common Pitfalls](#8-common-pitfalls)
9. [Best Practices](#9-best-practices)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Default Rollback Behavior

Spring's default rollback rule, applied by `TransactionInterceptor` to every `@Transactional` method, is:

```text
Method completes normally             → COMMIT
Method throws a RuntimeException      → ROLLBACK
Method throws an Error                → ROLLBACK
Method throws a checked Exception     → COMMIT   (!)
```

That last line surprises almost everyone the first time they hit it. Spring's rule is inherited from the classic EJB convention: **unchecked exceptions (`RuntimeException` and its subclasses, plus `Error`) are treated as unexpected failures and trigger a rollback; checked exceptions (anything extending `Exception` but not `RuntimeException`) are treated as part of the expected business outcome and do NOT trigger a rollback by default.**

```java
@Transactional
public void archiveInvoice(Long invoiceId) throws InvoiceLockedException { // checked
    Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow();
    invoice.setStatus(InvoiceStatus.ARCHIVED);
    invoiceRepository.save(invoice);

    if (invoice.hasOpenDisputes()) {
        throw new InvoiceLockedException(invoiceId); // checked exception
        // Default behavior: the save() above STILL COMMITS even though
        // this method is signaling failure to its caller!
    }
}
```

If `InvoiceLockedException` extends `Exception` directly (a checked exception), the status change to `ARCHIVED` **commits** even though the method is reporting failure via a thrown exception — a very easy way to end up with committed half-work that the caller believes never happened.

## 2. Why Checked Exceptions Don't Trigger Rollback by Default

This is a deliberate, if now widely considered surprising, design decision inherited from the EJB specification that predates Spring: checked exceptions were conventionally treated as "expected, recoverable business outcomes" — like `InsufficientFundsException` in a banking API, which a caller is expected to catch and handle, not something the framework should assume invalidates the whole transaction. Unchecked exceptions, by contrast, were assumed to represent programming errors or unexpected infrastructure failures that make the transaction's state untrustworthy, hence the automatic rollback.

In modern Spring codebases this convention causes more bugs than it prevents, because most teams use unchecked exceptions almost universally (including for expected business failures like `InsufficientStockException extends RuntimeException`) and rarely design deliberate checked-exception hierarchies. The practical takeaway: **know this default exists, but don't rely on remembering "is this exception checked or unchecked?" during a code review — be explicit with `rollbackFor`/`noRollbackFor` wherever the default might not be obvious.**

## 3. rollbackFor and noRollbackFor

`@Transactional` accepts `rollbackFor` / `rollbackForClassName` and `noRollbackFor` / `noRollbackForClassName` attributes to override the default rule explicitly.

```java
// Force a rollback on this checked exception, overriding the default
@Transactional(rollbackFor = InvoiceLockedException.class)
public void archiveInvoice(Long invoiceId) throws InvoiceLockedException {
    Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow();
    invoice.setStatus(InvoiceStatus.ARCHIVED);
    invoiceRepository.save(invoice);

    if (invoice.hasOpenDisputes()) {
        throw new InvoiceLockedException(invoiceId);
        // Now correctly rolls back — the ARCHIVED status change never persists.
    }
}
```

```java
// Suppress rollback for a specific unchecked exception that IS expected
// business signaling, even though it's a RuntimeException
@Transactional(noRollbackFor = DuplicateNotificationException.class)
public void sendWelcomeEmail(Long customerId) {
    notificationLog.recordAttempt(customerId); // we want this to commit...
    emailGateway.send(customerId);
    if (alreadySentToday(customerId)) {
        throw new DuplicateNotificationException(customerId);
        // ...even though this unchecked exception is thrown, don't roll back
        // the attempt log — it's informational, not a data-integrity failure.
    }
}
```

Both attributes accept an array of exception classes (`rollbackFor = {A.class, B.class}`) and match subclasses too. When both a checked exception hierarchy and a mix of expected/unexpected outcomes exist in the same method, being explicit removes any ambiguity for the next engineer reading the code — you don't want anyone to have to recall the checked/unchecked default rule to understand what will happen.

| Attribute | Effect |
|-----------|--------|
| `rollbackFor = X.class` | Roll back even for checked exception `X` (or its subclasses) that would otherwise commit |
| `noRollbackFor = X.class` | Commit even for unchecked exception `X` (or its subclasses) that would otherwise roll back |
| (neither specified) | Default rule: unchecked/`Error` → rollback, checked → commit |

## 4. readOnly=true — What It Actually Optimizes

```java
@Transactional(readOnly = true)
public List<OrderSummary> listOrdersForCustomer(Long customerId) {
    return orderRepository.findSummariesByCustomerId(customerId);
}
```

`readOnly = true` is a **hint**, not an enforced restriction — Spring does not scan your method body to guarantee no writes happen. What it actually does, depending on the underlying persistence provider and driver:

- With **Hibernate/JPA**, the current session's flush mode can be adjusted so it doesn't attempt to auto-flush changes before queries, and Hibernate can skip "dirty checking" (the process of comparing loaded entities against their original snapshot to decide whether to issue `UPDATE`s) for entities loaded in that transaction — a real performance win for read-heavy methods that load a lot of entities.
- With many **JDBC drivers**, the driver can be told the connection is read-only, allowing database-side optimizations (e.g., routing to a read replica in some connection-pool/proxy setups, or skipping certain locking).
- It documents **intent** clearly for anyone reading the method signature — a strong signal that this method should never perform a write, which is valuable even independent of the performance angle.

If you do issue a write inside a `readOnly = true` transaction, behavior is provider-dependent: some configurations will throw at flush time, others may simply perform the write anyway (defeating the purpose and potentially causing confusing behavior). Treat `readOnly = true` as a contract you must honor yourself, not a safety net.

## 5. Transaction Timeout

```java
@Transactional(timeout = 5) // seconds
public void reconcileLedgerEntries(Long accountId) {
    // if this method (and any transactional work it triggers) takes longer
    // than 5 seconds, Spring's transaction manager will roll back and
    // throw a TransactionTimedOutException / TransactionSystemException
    ledgerRepository.lockAndReconcile(accountId);
}
```

`timeout` sets an upper bound, in seconds, on how long the transaction may remain open before Spring's transaction manager forces a rollback and surfaces a timeout exception. This is primarily a defensive measure against runaway queries or accidental long-held locks — e.g., a reconciliation job that should normally finish in milliseconds but could hang indefinitely against a locked row. It is **not** a per-statement timeout (that's a separate JDBC/query-level concern, e.g. `Statement.setQueryTimeout`); it bounds the whole transactional method's lifetime. The default, if unset, is provider-specific and generally means "no timeout" (bounded only by the database's own connection/lock timeout settings).

## 6. The Swallowed-Exception Pitfall

The single most common way developers accidentally defeat their own `@Transactional` rollback is by catching an exception *inside* the transactional method and not re-throwing it:

```java
// BROKEN — the try/catch prevents Spring from ever seeing the exception
@Transactional
public void processPayment(Long orderId, PaymentRequest request) {
    Order order = orderRepository.findById(orderId).orElseThrow();
    order.setStatus(OrderStatus.PROCESSING);
    orderRepository.save(order);

    try {
        paymentGateway.charge(request);
    } catch (PaymentDeclinedException ex) {
        log.warn("Payment declined for order {}", orderId, ex);
        // exception swallowed here — the method returns normally!
    }

    order.setStatus(OrderStatus.PAID); // this ALWAYS runs and commits,
    orderRepository.save(order);       // even though the charge failed!
}
```

From Spring's point of view, `processPayment` returned normally — no exception ever propagated out to the proxy, so `TransactionInterceptor` sees a clean completion and commits. The order ends up marked `PAID` even though the actual charge failed, because the method swallowed the exception with a log line and kept going, and Spring's rollback machinery only reacts to exceptions that **propagate out of the proxied method call**. Rollback decisions are made entirely based on what exits the method — a caught-and-logged exception is invisible to the transaction manager.

**The fix** is to either not catch it (let it propagate), or, if you must catch it to add context/translate it, re-throw something:

```java
// FIXED — catch only to translate/enrich, then re-throw
@Transactional
public void processPayment(Long orderId, PaymentRequest request) {
    Order order = orderRepository.findById(orderId).orElseThrow();
    order.setStatus(OrderStatus.PROCESSING);
    orderRepository.save(order);

    try {
        paymentGateway.charge(request);
    } catch (PaymentDeclinedException ex) {
        log.warn("Payment declined for order {}", orderId, ex);
        throw new OrderPaymentFailedException(orderId, ex); // propagates out
    }

    order.setStatus(OrderStatus.PAID);
    orderRepository.save(order);
}
```

Alternatively, if a caught exception must genuinely NOT roll back the transaction (a deliberate decision, not an oversight), make that explicit rather than accidental — either don't catch it and use `noRollbackFor`, or mark the transaction for rollback manually while still returning normally:

```java
@Transactional
public PaymentResult processPayment(Long orderId, PaymentRequest request) {
    Order order = orderRepository.findById(orderId).orElseThrow();

    try {
        paymentGateway.charge(request);
        order.setStatus(OrderStatus.PAID);
    } catch (PaymentDeclinedException ex) {
        log.warn("Payment declined for order {}", orderId, ex);
        order.setStatus(OrderStatus.PAYMENT_FAILED);
        // Explicitly force rollback of everything in this transaction,
        // while still returning a normal result object instead of throwing.
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        return PaymentResult.declined(orderId);
    }

    orderRepository.save(order);
    return PaymentResult.success(orderId);
}
```

`setRollbackOnly()` is the escape hatch for exactly this situation: you want to return normally (no exception to the caller) but still guarantee the transaction rolls back rather than commits.

## 7. Worked Example — Multi-Step Service with Partial-Failure Handling

A realistic scenario: submitting a batch of expense reports where each report is validated and processed independently, but the overall batch transaction should still commit the successes even if some entries fail — this requires deliberately combining `REQUIRES_NEW`/`NESTED`-style isolation of failures with explicit rollback control, not accidental exception swallowing.

```java
public record ExpenseSubmissionResult(
        List<Long> approvedIds,
        List<RejectedExpense> rejected
) {}

public record RejectedExpense(Long expenseId, String reason) {}

@Service
public class ExpenseReportService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseValidationService expenseValidationService; // separate bean, REQUIRES_NEW method

    public ExpenseReportService(ExpenseRepository expenseRepository,
                                 ExpenseValidationService expenseValidationService) {
        this.expenseRepository = expenseRepository;
        this.expenseValidationService = expenseValidationService;
    }

    @Transactional(readOnly = false, timeout = 30)
    public ExpenseSubmissionResult submitBatch(List<Long> expenseIds) {
        List<Long> approved = new ArrayList<>();
        List<RejectedExpense> rejected = new ArrayList<>();

        for (Long expenseId : expenseIds) {
            try {
                // Each call runs in its OWN transaction (REQUIRES_NEW) so a
                // validation failure for one expense can't taint the
                // surrounding batch transaction or roll back other approvals.
                expenseValidationService.validateAndApprove(expenseId);
                approved.add(expenseId);
            } catch (ExpenseValidationException ex) {
                // Deliberately caught and translated into a result entry —
                // this is an EXPECTED per-item outcome, not swallowed silently:
                // it is recorded, logged, and surfaced to the caller in the
                // returned result object.
                log.info("Expense {} rejected: {}", expenseId, ex.getMessage());
                rejected.add(new RejectedExpense(expenseId, ex.getMessage()));
            }
        }

        return new ExpenseSubmissionResult(approved, rejected);
    }
}

@Service
public class ExpenseValidationService {

    private final ExpenseRepository expenseRepository;
    private final PolicyEngine policyEngine;

    public ExpenseValidationService(ExpenseRepository expenseRepository, PolicyEngine policyEngine) {
        this.expenseRepository = expenseRepository;
        this.policyEngine = policyEngine;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = ExpenseValidationException.class)
    public void validateAndApprove(Long expenseId) throws ExpenseValidationException {
        Expense expense = expenseRepository.findById(expenseId).orElseThrow();

        if (!policyEngine.isWithinLimit(expense)) {
            throw new ExpenseValidationException(expenseId, "Exceeds policy limit");
            // rollbackFor ensures THIS expense's own transaction rolls back
            // cleanly (nothing partially written), while the outer batch
            // transaction in submitBatch is completely unaffected because
            // REQUIRES_NEW gave this its own independent transaction.
        }

        expense.setStatus(ExpenseStatus.APPROVED);
        expenseRepository.save(expense);
    }
}
```

This design deliberately combines several ideas from this phase: `REQUIRES_NEW` isolates each item's transaction from the batch and from each other; `ExpenseValidationException` is declared checked and paired with an explicit `rollbackFor` so there is zero ambiguity about whether a validation failure rolls back that item's own write; and the outer `submitBatch` method catches the exception **on purpose**, records it in a structured result, and does not swallow it silently — the difference between this and the broken pattern in Section 6 is that here the caught exception is deliberately translated into an explicit, visible outcome (`rejected` list) rather than just logged and forgotten while unrelated writes continue inside the *same* transaction.

## 8. Common Pitfalls

**Assuming all exceptions roll back a transaction.** Checked exceptions commit by default; only `RuntimeException`/`Error` roll back unless `rollbackFor` says otherwise. Fix: always check whether a domain exception is checked or unchecked, and set `rollbackFor` explicitly whenever it matters — don't rely on remembering the default.

**Catching an exception inside a `@Transactional` method and only logging it.** As shown in Section 6, this makes the method return normally from Spring's point of view, so it commits regardless of the failure. Fix: re-throw (possibly wrapped/translated), or explicitly call `setRollbackOnly()` if you need to return normally but still force a rollback.

**Marking a method `readOnly = true` and then performing a write inside it.** Behavior is provider-dependent and can range from a thrown exception to a silent, unexpected write — don't rely on it as an enforced guard. Fix: treat `readOnly` as a contract you must self-enforce through code review/tests, not a runtime safety mechanism.

**Setting an aggressive `timeout` without accounting for downstream calls.** A `timeout = 2` on a method that also calls a slow external service (which itself might be well within its own SLA) can cause spurious `TransactionTimedOutException`s unrelated to actual database contention. Fix: keep transactional methods focused on database work; move slow I/O outside the transaction boundary where possible (see Lesson 2's propagation guidance on `NOT_SUPPORTED` for non-transactional external calls).

**Using `noRollbackFor` to "make an error go away" instead of understanding why it's being thrown.** Silencing rollback for an exception without understanding whether the partial writes leading up to it are actually safe to commit can leave the database in a subtly inconsistent state. Fix: only use `noRollbackFor` when the partial state truly represents a valid outcome (e.g., an audit log entry that should persist regardless).

**Forgetting that `rollbackFor`/`noRollbackFor` match subclasses.** Declaring `rollbackFor = Exception.class` effectively forces rollback for everything, including exceptions you might have wanted to treat as expected outcomes elsewhere in the hierarchy. Fix: be as specific as possible with the exception classes named.

## 9. Best Practices

- Don't rely on remembering the checked/unchecked default — for any exception whose rollback behavior matters, state it explicitly with `rollbackFor`/`noRollbackFor`.
- Prefer unchecked, well-named business exceptions (`InsufficientStockException extends RuntimeException`) over checked exceptions for typical service-layer failures — it aligns with Spring's default and with how most modern Java codebases are written, minimizing surprises.
- Never catch an exception inside a `@Transactional` method purely to log it and continue — either let it propagate, wrap and re-throw it, or explicitly call `setRollbackOnly()` if you need to return normally.
- Use `readOnly = true` on every query-only service method — it's a useful signal and a real (if provider-dependent) optimization, and it costs nothing to add.
- Set a `timeout` on operations with real risk of hanging (batch jobs, external lock acquisition) but keep it generous enough to not misfire on normal downstream latency.
- Design multi-step batch operations so each independent unit's failure is isolated (via `REQUIRES_NEW` or `NESTED`) and explicitly surfaced in the result, rather than allowing one bad item to either roll back everything or silently vanish.
- Write a unit test per rollback rule you declare — assert that the exception you expect to roll back a transaction actually does, using an in-memory/test database and checking post-exception state.

## 10. Hands-On Exercises

1. Create a checked exception `SlotUnavailableException extends Exception` and a service method that throws it after already saving an entity. Run it without `rollbackFor` and observe (via a follow-up query) that the save committed anyway; then add `rollbackFor = SlotUnavailableException.class` and confirm the save is now rolled back.
2. Reproduce the swallowed-exception bug from Section 6 verbatim in a small test service, write a test asserting (incorrectly, at first) that the order should NOT be marked `PAID` after a declined payment, watch it fail, then apply the fix and watch it pass.
3. Write a method using `readOnly = true` that nonetheless performs a write, run it against your configured database, and document what actually happens (exception, silent write, or something else) — this varies by database/driver, so record your specific finding.
4. Configure `@Transactional(timeout = 1)` on a method that calls `Thread.sleep(2000)` before completing a repository save; confirm a timeout exception is thrown and that the save did not commit.
5. Extend the `ExpenseReportService` worked example to add a third outcome category — `pendingReview` — for expenses that fail validation with a specific `ExpenseValidationException` subtype, without breaking the isolation between per-item transactions.

## 11. Interview Q&A

**Q1: What is Spring's default rollback behavior, and why does it differ for checked vs. unchecked exceptions?**
By default, an unchecked exception (`RuntimeException` or `Error`) thrown out of a `@Transactional` method triggers a rollback, while a checked exception (extending `Exception` but not `RuntimeException`) allows the transaction to commit. This convention is inherited from the EJB specification, which treated checked exceptions as expected, recoverable business outcomes that shouldn't necessarily invalidate a unit of work, and unchecked exceptions as unexpected failures indicating the transaction's state can't be trusted. In practice this surprises many developers, so most teams either use unchecked exceptions for business failures or set `rollbackFor` explicitly rather than relying on the default.

**Q2: How would you force a rollback for a checked exception, or prevent one for an unchecked exception?**
Use the `rollbackFor` attribute (or `rollbackForClassName`) to name checked exception classes that should trigger a rollback despite the default, e.g. `@Transactional(rollbackFor = InvoiceLockedException.class)`. Conversely, `noRollbackFor` (or `noRollbackForClassName`) names exception classes — including unchecked ones — that should be allowed to commit even though they'd normally cause a rollback, useful for informational exceptions like a duplicate-notification signal that shouldn't undo an already-recorded attempt log.

**Q3: What does `readOnly = true` actually do, and is it enforced?**
It's a hint to the underlying transaction/persistence infrastructure, not an enforced restriction. With Hibernate/JPA it can disable dirty-checking and adjust flush behavior for a performance gain on read-heavy methods; with some JDBC drivers or connection-pool setups it can mark the connection read-only, occasionally enabling read-replica routing. If you perform a write inside a `readOnly = true` transaction, the outcome is provider-dependent — it might throw at flush time or might silently succeed — so it should be treated as a contract the developer must honor, not a runtime safety net.

**Q4: Explain the classic bug where catching an exception inside a `@Transactional` method prevents rollback, and how you'd fix it.**
Spring's rollback decision is based entirely on whether an exception propagates out of the proxied method call. If code inside the method catches an exception — for example, to log a failed payment gateway call — and then continues executing without re-throwing, the method appears to Spring to have completed normally, so the transaction commits, potentially persisting inconsistent state (like an order marked `PAID` despite a declined charge). The fix is to either not catch the exception, re-throw it (possibly wrapped in a more specific business exception), or, if the method must return normally, explicitly call `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()` before returning.

**Q5: What does the `timeout` attribute on `@Transactional` control, and what's a good use case for it?**
It sets a maximum number of seconds the transaction may remain open before Spring's transaction manager forces a rollback and throws a timeout-related exception. It's a defensive mechanism against runaway operations — for example, a reconciliation job that should normally complete quickly but could hang if it's waiting on a database lock held by another process. It bounds the whole transactional method's lifetime, not any single SQL statement, so it should be set generously enough to avoid misfiring on normal downstream latency unrelated to the database itself.

**Q6: In a batch operation where you want some items to fail without rolling back the whole batch, how do you combine propagation and rollback rules correctly?**
Give each item's processing its own transaction using `REQUIRES_NEW` (or `NESTED` if you want it to still share the outer physical transaction but be savepoint-isolated), so a failure in one item's transaction can't taint or roll back the others or the outer batch transaction. Pair that inner method with an explicit `rollbackFor` on the specific validation exception so there's no ambiguity about whether that item's own partial writes are undone. Then, critically, catch that exception in the outer batch loop deliberately — logging it and recording it in a structured result object — rather than swallowing it silently, so the caller gets an explicit accounting of which items succeeded and which failed and why.
