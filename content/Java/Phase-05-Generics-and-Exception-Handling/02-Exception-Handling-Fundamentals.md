# 02 — Exception Handling Fundamentals

> A comprehensive reference covering the `Throwable` hierarchy, checked vs unchecked exceptions, `try`/`catch`/`finally`, and how exceptions propagate up the call stack when left uncaught.

---

## Table of Contents

1. [The Problem: Things Go Wrong at Runtime](#1-the-problem-things-go-wrong-at-runtime)
2. [The Analogy: The Fire Alarm](#2-the-analogy-the-fire-alarm)
3. [The Throwable Hierarchy: Errors, Exceptions, Checked vs Unchecked](#3-the-throwable-hierarchy-errors-exceptions-checked-vs-unchecked)
4. [try, catch, finally, and Exception Propagation](#4-try-catch-finally-and-exception-propagation)
5. [Checked vs Unchecked Exceptions](#5-checked-vs-unchecked-exceptions)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Things Go Wrong at Runtime

No program runs in a perfect world. A file the user pointed to might not exist. A network call might time out. A string the user typed in as "a number" might actually contain letters. None of these are bugs in your logic — they're normal, expected failure modes of interacting with the outside world (disks, networks, humans).

If your code has no structured way to handle that, the alternative is ugly: either the program crashes immediately with a raw stack trace and no context, or — worse — you scatter `if (somethingWentWrong)` checks after every single risky operation and hope you didn't forget one. Neither approach scales past a toy program.

The core problem: **how do you detect that something went wrong, stop the operation that was in trouble, and hand control to code that actually knows what to do about it — without littering every line with manual error checks?**

---

## 2. The Analogy: The Fire Alarm

**Real-world analogy:** think of an exception as a fire alarm going off in a building. The moment it triggers, whatever everyone was doing stops immediately — nobody keeps typing at their desk or finishing their coffee. Control doesn't return to "normal business" until someone who's actually listening for that alarm (the fire warden — your `catch` block) responds to it.

Critically, the alarm doesn't get handled by whoever happens to be standing nearest — it propagates through the building (up the call stack) until it reaches someone assigned to respond to it. If literally nobody is listening anywhere in the building, the fire department (the JVM itself) eventually gets involved by default — and for an uncaught exception, that "default response" is printing a stack trace and terminating the program (or just that thread).

**A `throw` is pulling the fire alarm. A `catch` block is the fire warden who's been assigned to respond to it.** Everything between where the alarm was pulled and where it's caught is skipped entirely — execution doesn't limp through the rest of the risky code hoping for the best.

---

## 3. The Throwable Hierarchy: Errors, Exceptions, Checked vs Unchecked

Every "alarm" object in Java — anything you can `throw` and `catch` — is an instance of `Throwable` or one of its subclasses. At a conceptual level, the hierarchy splits into two major branches:

- **`Error`** — represents serious problems your code generally isn't expected to recover from, like `OutOfMemoryError` (the JVM ran out of heap space, covered in Phase 9) or `StackOverflowError` (runaway recursion). You almost never catch these.
- **`Exception`** — represents conditions a well-written program *can* reasonably anticipate and recover from. This branch is what you'll work with directly, and it splits further:
  - **Checked exceptions** — subclasses of `Exception` that are *not* also subclasses of `RuntimeException` (e.g. `IOException`). The compiler forces you to either catch them or declare them with `throws` on the method signature — the compiler is checking, at compile time, that you've at least acknowledged the possibility of failure.
  - **Unchecked exceptions** — subclasses of `RuntimeException` (e.g. `NullPointerException`, `IllegalArgumentException`, `ArithmeticException`). The compiler does *not* require you to catch or declare these. They typically represent programming mistakes (a null you should have checked for, an invalid argument) rather than expected environmental failures.

```
Throwable
├── Error                     (serious, usually unrecoverable — rarely caught)
└── Exception
    ├── RuntimeException      (unchecked — NullPointerException, ArithmeticException, ...)
    └── (everything else)     (checked — IOException, SQLException, ...)
```

---

## 4. try, catch, finally, and Exception Propagation

The three building blocks:

- **`try`** — wraps code that might throw an exception.
- **`catch`** — declares what type of exception it's willing to handle, and runs if that (or a subtype) is thrown inside the matching `try` block.
- **`finally`** — runs **no matter what** — whether the `try` block completed normally, threw an exception that was caught, or even threw an exception that wasn't caught at all. It's the one guarantee exception handling gives you: cleanup code here always executes.

```java
import java.io.IOException;

public class FileChecker {

    static void checkFile(String path) throws IOException {
        if (!path.endsWith(".txt")) {
            throw new IOException("Unsupported file type: " + path);
        }
        System.out.println("File type OK: " + path);
    }

    public static void main(String[] args) {
        try {
            checkFile("report.pdf");
        } catch (IOException e) {
            System.out.println("Could not process file: " + e.getMessage());
        } finally {
            System.out.println("Finished checking file.");
        }
    }
}
```

Tracing through: `checkFile("report.pdf")` checks whether `"report.pdf"` ends with `.txt` — it doesn't, so it throws a new `IOException` with that message. Because `checkFile` is declared `throws IOException` (required, since `IOException` is checked), the exception propagates immediately out of `checkFile` and into `main`'s `try` block, where the matching `catch (IOException e)` runs. The `finally` block then runs afterward regardless. Output:

```
Could not process file: Unsupported file type: report.pdf
Finished checking file.
```

If no `catch` block anywhere up the call stack matches the exception's type, it keeps propagating outward — through the method that called this one, and the method that called *that* one — until either something catches it, or it reaches the very top (the thread that started execution), at which point the JVM prints a stack trace and terminates that thread.

---

## 5. Checked vs Unchecked Exceptions

| | **Checked exception** | **Unchecked exception (`RuntimeException`)** |
|---|---|---|
| **Must be declared or caught?** | Yes — compiler enforces it via `throws` or a `catch` | No — compiler doesn't require anything |
| **When checked** | Compile time | Not checked by the compiler at all |
| **Typical cause** | An expected, recoverable environmental failure (file missing, network down) | A programming mistake (null dereference, invalid argument, bad array index) |
| **Common examples** | `IOException`, `SQLException` | `NullPointerException`, `IllegalArgumentException`, `ArithmeticException` |
| **Typical response** | Catch it and do something meaningful (retry, fall back, inform the user) | Usually indicates a bug to fix in the code, not something to routinely catch |

---

**Common mistakes:**
- Catching `Exception` (or worse, `Throwable`) broadly just to "make the error go away," instead of catching the specific exception type that the code can actually throw — this silently swallows unrelated bugs (like a `NullPointerException` from a real mistake) right alongside the expected failure you meant to handle.
- Writing an empty `catch` block that swallows an exception without logging or handling it at all — the program limps forward as if nothing happened, and whoever debugs it later has zero information about what actually went wrong.

**Interview angle:** "What's the difference between a checked and an unchecked exception, and when would you create one vs the other?" is a near-universal Java interview question. The strong answer isn't just reciting the rule (checked = must declare/catch, unchecked = `RuntimeException` and subclasses) — it's explaining the *intent* behind the split: checked exceptions model conditions a caller can reasonably be expected to recover from (so the compiler forces acknowledgment), while unchecked exceptions generally model programmer errors that shouldn't force every single caller up the chain to add boilerplate handling for a bug that should just be fixed.

---

## 6. Hands-On Exercises

### Exercise 1 — Trigger and catch an unchecked exception

Write a small program that divides two integers where the divisor is `0`, wrapped in a `try`/`catch` catching `ArithmeticException`. Print a friendly message instead of letting the program crash, and confirm `ArithmeticException` is unchecked (no `throws` declaration is required for it to compile).

### Exercise 2 — Prove `finally` always runs

Write a method with a `try` block that throws an exception, a `catch` block that catches it, and a `finally` block that prints a message. Then modify the code so the `try` block does *not* throw anything, and confirm the `finally` message still prints either way.

### Exercise 3 — Declare and propagate a checked exception

Write a method that declares `throws Exception` (or a more specific checked type) and actually throws it under some condition, called from another method that does *not* catch it but also declares `throws`. Call that from a `main` method wrapped in a `try`/`catch` and observe the exception being caught only at the outermost level.

---

## 7. Interview Q&A

### Q1. What is the difference between an `Error` and an `Exception`?

**Answer:** Both are subclasses of `Throwable`. An `Error` represents a serious problem, typically outside the application's control (like running out of heap memory), that code generally isn't expected to recover from and rarely catches. An `Exception` represents a condition the program can reasonably anticipate and potentially recover from, and is what application code is expected to catch and handle.

---

### Q2. What's the difference between a checked and unchecked exception?

**Answer:** A checked exception (any `Exception` subclass that isn't a `RuntimeException`) must be either caught or declared with `throws` on the method signature — enforced by the compiler at compile time. An unchecked exception (`RuntimeException` and its subclasses) has no such requirement; the compiler doesn't force you to catch or declare it, and it typically represents a programming mistake rather than an expected external failure.

---

### Q3. Does the `finally` block always run?

**Answer:** Yes, with very few exceptions (such as the JVM itself being forcibly terminated, e.g. via `System.exit()` inside the `try` block, or a hard crash of the JVM process). It runs whether the `try` block completes normally, throws an exception that gets caught, or throws an exception that doesn't get caught at all — `finally` runs before the exception continues propagating.

---

### Q4. What happens if an exception is thrown and nothing catches it?

**Answer:** It propagates up through each calling method on the call stack, skipping the remaining code in each one, until it either reaches a matching `catch` block somewhere in the chain, or reaches the top of the call stack (the thread's entry point) uncaught — at which point the JVM prints the exception's stack trace to the console and terminates that thread.

---

### Q5. Why shouldn't you routinely catch `Exception` broadly instead of a specific exception type?

**Answer:** Catching `Exception` broadly catches every possible exception type that code might throw, including ones you didn't anticipate and don't actually know how to handle correctly — including genuine bugs like a stray `NullPointerException`. This can silently mask real problems instead of surfacing them, and it makes the `catch` block's actual intent unclear to future readers.

---

> 🧠 **Memory hook:** "A `throw` pulls the fire alarm — execution stops instantly and skips straight to whoever's `catch`ing, and `finally` is the one thing that always runs no matter how the alarm played out."
