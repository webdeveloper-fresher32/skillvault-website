# 03 — Try-With-Resources and Custom Exceptions

> A comprehensive reference covering the `AutoCloseable` interface, try-with-resources syntax and guarantees, and writing custom checked and unchecked exception classes.

---

## Table of Contents

1. [The Problem: Cleanup Code Is Verbose and Easy to Get Wrong](#1-the-problem-cleanup-code-is-verbose-and-easy-to-get-wrong)
2. [The Analogy: The Self-Locking Hotel Room Key](#2-the-analogy-the-self-locking-hotel-room-key)
3. [AutoCloseable and Try-With-Resources](#3-autocloseable-and-try-with-resources)
4. [Writing Custom Exceptions](#4-writing-custom-exceptions)
5. [Checked vs Unchecked Custom Exceptions](#5-checked-vs-unchecked-custom-exceptions)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Cleanup Code Is Verbose and Easy to Get Wrong

Resources like open files, network sockets, and database connections don't clean themselves up. If you open one and forget to close it — or close it only on the "happy path" and skip closing it when an exception happens partway through — you leak it. In a long-running program, leaked file handles or connections pile up until the operating system or database refuses to hand out any more.

Before Java 7, closing a resource correctly in *every* possible exit path (normal completion, an exception thrown partway through, an early `return`) meant hand-writing a `finally` block that itself had to defensively check whether the resource was even successfully opened before trying to close it:

```java
FileWriter writer = null;
try {
    writer = new FileWriter("out.txt");
    writer.write("data");
} finally {
    if (writer != null) {
        try {
            writer.close();
        } catch (IOException e) {
            // now what? closing itself can also throw...
        }
    }
}
```

That's a lot of ceremony to reliably do one simple thing: **always close what you opened, no matter how the block exits.**

---

## 2. The Analogy: The Self-Locking Hotel Room Key

**Real-world analogy:** think of a hotel room key that automatically deactivates and locks the door the moment you leave the room — whether you left calmly through the front door after your stay, or scrambled out through the fire exit because the alarm went off. Either way, you don't have to remember a separate step to "lock up properly" — leaving the room *is* the cleanup, built in, regardless of which way you left.

**Try-with-resources is that self-locking key.** Whatever resource you open inside its parentheses gets closed automatically the moment the block exits — whether the block finished normally or an exception blew through it — without you writing a single explicit `close()` call or a defensive `finally`.

---

## 3. AutoCloseable and Try-With-Resources

Any class that implements the `AutoCloseable` interface (a single method, `close()`) can be used in a **try-with-resources** statement: `try (Resource r = new Resource()) { ... }`. Java guarantees `r.close()` is called automatically when the block exits — normally or via an exception — without any explicit `finally` needed.

```java
class Connection implements AutoCloseable {
    private final String name;

    Connection(String name) {
        this.name = name;
        System.out.println("Opening connection: " + name);
    }

    void query(String sql) {
        System.out.println("Running query on " + name + ": " + sql);
        if (sql.isEmpty()) {
            throw new RuntimeException("Empty query!");
        }
    }

    @Override
    public void close() {
        System.out.println("Closing connection: " + name);
    }
}

public class ConnectionDemo {
    public static void main(String[] args) {
        try (Connection conn = new Connection("db-primary")) {
            conn.query("");
        } catch (RuntimeException e) {
            System.out.println("Caught: " + e.getMessage());
        }
    }
}
```

Tracing through: the try-with-resources statement constructs `Connection("db-primary")`, printing the opening message. Inside the block, `conn.query("")` prints its own message and then throws a `RuntimeException` because the SQL string is empty. At that point, before the exception is allowed to reach the `catch` clause attached to this same `try` statement, Java calls `conn.close()` automatically — printing the closing message — and only *then* does the exception continue propagating to the `catch` block. Output:

```
Opening connection: db-primary
Running query on db-primary: 
Closing connection: db-primary
Caught: Empty query!
```

Notice the order: `close()` runs *before* `catch`, even though `catch` is written textually after the resource declaration — the resource is guaranteed to be closed as the `try` block unwinds, regardless of whether it unwound normally or because of an exception. You can also declare more than one resource in the parentheses, separated by semicolons; they're closed automatically in the reverse order they were opened.

---

## 4. Writing Custom Exceptions

Java's built-in exceptions (`IllegalArgumentException`, `IOException`, and so on) are intentionally generic. Sometimes a domain-specific exception communicates the actual problem far more clearly than a generic one would — `InsufficientFundsException` tells a caller immediately and unambiguously what went wrong, whereas a generic `IllegalStateException` would leave them to go read the message string (or the source) to find out.

Creating one just means extending `Exception` (to make it checked) or `RuntimeException` (to make it unchecked), and typically providing a constructor that forwards a message to the parent class via `super(message)`:

```java
class InsufficientFundsException extends Exception {
    InsufficientFundsException(String message) {
        super(message);
    }
}

class Account {
    private double balance;

    Account(double balance) {
        this.balance = balance;
    }

    void withdraw(double amount) throws InsufficientFundsException {
        if (amount > balance) {
            throw new InsufficientFundsException(
                "Cannot withdraw " + amount + "; balance is only " + balance);
        }
        balance -= amount;
        System.out.println("Withdrew " + amount + ". Remaining balance: " + balance);
    }
}

public class AccountDemo {
    public static void main(String[] args) {
        Account acc = new Account(100.0);
        try {
            acc.withdraw(150.0);
        } catch (InsufficientFundsException e) {
            System.out.println("Transaction failed: " + e.getMessage());
        }
    }
}
```

Tracing through: `acc.withdraw(150.0)` checks whether `150.0` (the requested amount) exceeds the current `balance` of `100.0` — it does, so it throws a new `InsufficientFundsException` built with a message describing exactly why. Because `InsufficientFundsException extends Exception`, it's checked, so `withdraw` must declare `throws InsufficientFundsException`, and `main` must either catch it or declare it too — here it's caught directly. Output:

```
Transaction failed: Cannot withdraw 150.0; balance is only 100.0
```

Since the exception is caught by name (`catch (InsufficientFundsException e)`), calling code can react specifically to *this* failure — for example, prompting the user to enter a smaller amount — rather than reacting generically to "some exception happened."

---

## 5. Checked vs Unchecked Custom Exceptions

| | **Extends `Exception`** | **Extends `RuntimeException`** |
|---|---|---|
| **Checked or unchecked?** | Checked | Unchecked |
| **Must callers declare/catch it?** | Yes, enforced by the compiler | No, entirely optional |
| **Good fit for** | A failure the caller can reasonably be expected to recover from (insufficient funds, invalid input from an external source) | A failure that generally signals a programming mistake, where forcing every caller to handle it everywhere would just be noise |
| **Risk of overusing** | Forces boilerplate `try`/`catch` or `throws` even where recovery genuinely isn't meaningful | Callers can easily forget it exists entirely, since nothing forces acknowledgment |

The choice isn't arbitrary — it's a design decision about whether you *want* the compiler to force every caller to consciously deal with this failure, or whether that would just be unnecessary ceremony for something that's rarely recoverable anyway.

---

**Common mistakes:**
- Implementing `AutoCloseable` on a class but then using it with a plain variable declaration and a manual `.close()` call instead of a try-with-resources block — the interface itself does nothing automatically; the guarantee only exists because of the try-with-resources syntax, not because the class merely implements the interface.
- Making every custom exception extend `RuntimeException` "to avoid dealing with checked exceptions," without considering whether the failure is actually something callers should be forced to explicitly handle — this can hide genuinely recoverable failures (like insufficient funds) behind an exception type nobody is required to notice or catch.

**Interview angle:** A common follow-up question after covering custom exceptions is "when would you make a custom exception checked vs unchecked?" The strong answer ties back to the checked/unchecked distinction from the previous lesson: make it checked when you want to force callers to consciously acknowledge and handle a recoverable failure (like insufficient funds, or a business-rule violation), and unchecked when it represents a programming error or a failure so severe that forcing a `try`/`catch` everywhere would add noise without adding value.

---

## 6. Hands-On Exercises

### Exercise 1 — Implement `AutoCloseable` and observe the close order

Write a small class implementing `AutoCloseable` whose `close()` method prints a message. Open two instances in a single try-with-resources statement (`try (A a = new A(); B b = new B()) { ... }`), and confirm — by observing the printed output — that they're closed in the reverse order they were opened.

### Exercise 2 — Force `close()` to run despite an exception

Inside a try-with-resources block using your class from Exercise 1, deliberately throw a `RuntimeException` partway through the block, with a `catch` clause after it. Confirm from the printed output that `close()` still ran before the `catch` block's message printed.

### Exercise 3 — Design a custom checked exception

Write a `InvalidAgeException extends Exception` thrown by a method that rejects a negative age, and a separate `main` method that calls it inside a `try`/`catch`, printing a clear message on failure. Then consider (and write a one-sentence justification for) whether this exception should really be checked or unchecked.

---

## 7. Interview Q&A

### Q1. What is `AutoCloseable`, and what does it actually guarantee?

**Answer:** `AutoCloseable` is a single-method interface (`close()`) that marks a class as safe to use in a try-with-resources statement. By itself, implementing the interface guarantees nothing — the actual guarantee (that `close()` is called automatically, even if the block throws) only comes from using the class inside a try-with-resources statement's parentheses.

---

### Q2. What order are multiple resources closed in, in a single try-with-resources statement?

**Answer:** The reverse of the order they were declared/opened in — the last resource opened is the first one closed, similar to how you'd close things in a stack-like fashion.

---

### Q3. Does try-with-resources still call `close()` if an exception is thrown inside the block?

**Answer:** Yes — that's the entire point. The resource's `close()` method is called automatically as the block unwinds, whether it exits normally or because an exception propagated out of it, and this happens before the exception reaches any `catch` clause attached to that same `try` statement.

---

### Q4. When should a custom exception extend `Exception` vs `RuntimeException`?

**Answer:** Extend `Exception` (making it checked) when the failure is something you want to force callers to consciously handle, because it's a recoverable, expected-in-some-cases condition (like insufficient funds). Extend `RuntimeException` (making it unchecked) when the failure generally represents a programming error, or recovery isn't realistically expected, so forcing every caller up the chain to declare or catch it would just be unnecessary boilerplate.

---

### Q5. Why is try-with-resources generally preferred over a manual `try`/`finally` with an explicit `close()` call?

**Answer:** It's far less verbose (no manual null-checking of the resource, no nested `try`/`catch` around the `close()` call itself), and it correctly handles edge cases like the `close()` call itself throwing an exception, which a hand-written `finally` block often gets subtly wrong.

---

> 🧠 **Memory hook:** "Try-with-resources is the self-locking hotel key — however you leave the room, calmly or through the fire exit, the door locks itself; `AutoCloseable` alone is just the lock mechanism, try-with-resources is what actually triggers it."
