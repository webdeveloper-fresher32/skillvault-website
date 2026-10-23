# 02 — JUnit 5 and Mockito Basics

> A comprehensive reference covering why automated tests replace manual "run it and eyeball the output" verification, JUnit 5's core annotations and assertions, and Mockito's role in isolating a class under test from its real dependencies.

---

## Table of Contents

1. [The Problem: Verifying Code by Hand Doesn't Scale](#1-the-problem-verifying-code-by-hand-doesnt-scale)
2. [The Analogy: A Pilot's Pre-Flight Checklist](#2-the-analogy-a-pilots-pre-flight-checklist)
3. [JUnit 5 Fundamentals](#3-junit-5-fundamentals)
4. [Code Example: Testing a Calculator](#4-code-example-testing-a-calculator)
5. [Isolating Dependencies with Mockito](#5-isolating-dependencies-with-mockito)
6. [JUnit Assertions vs Mockito Stubbing](#6-junit-assertions-vs-mockito-stubbing)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: Verifying Code by Hand Doesn't Scale

Early on, "testing" a method often means: run the program, look at the console output, and decide by eye whether it looks right. That works for a five-line script. It falls apart the moment a project has dozens of methods and multiple contributors, for a simple reason: **every manual check has to be re-run, by a human, after every single change** — and humans get tired, skip steps, and forget which edge cases matter.

The real cost shows up later: someone changes a method that ten other things depend on, doesn't personally think to re-check all ten, and ships a silent regression. Nothing crashed during manual testing because nobody thought to manually re-test the thing that broke.

The core problem: **how do you catch "this used to work and now it doesn't" automatically, in seconds, every time code changes — without a human having to remember what to check?**

---

## 2. The Analogy: A Pilot's Pre-Flight Checklist

**Real-world analogy:** a pilot doesn't rely on that morning's gut feeling that the plane "looks fine." Before every single flight, they run through a fixed, fast, non-negotiable checklist — flaps, fuel, instruments, controls — checking each item in the same order, every time, regardless of how many times they've flown this exact plane before. The checklist doesn't get bored or skip a step because "it was fine yesterday."

**An automated test suite is that checklist for code.** A fixed set of checks (tests) runs before every flight (every code change, every commit, every deploy), catching a problem on the ground — in seconds, on your own machine or in CI — instead of discovering it mid-flight, in production, in front of users.

---

## 3. JUnit 5 Fundamentals

JUnit 5 is the standard testing framework for Java. A test is just a regular method, marked so JUnit knows to run it and check its result automatically.

**`@Test`** marks a method as a test case. JUnit discovers every `@Test`-annotated method in a test class and runs each one independently.

**Assertion methods** are how a test states "this should be true, and if it isn't, fail the test and report exactly what was expected vs what actually happened":

- `assertEquals(expected, actual)` — fails if the two values aren't equal.
- `assertTrue(condition)` / `assertFalse(condition)` — fails if the boolean condition doesn't hold.
- `assertThrows(ExceptionType.class, () -> { ... })` — runs the given block and fails unless it throws exactly the specified exception type; this is how you test that code *correctly* fails when it should.

**Lifecycle annotations** let you share setup/teardown logic across multiple test methods instead of repeating it in each one:

- `@BeforeEach` — a method run before *every* individual `@Test` method in the class, typically used to create a fresh object under test so tests don't accidentally share state with each other.
- `@AfterEach` — a method run after every `@Test` method, typically used for cleanup.

Each `@Test` method should be independent — able to pass or fail on its own, in any order, without depending on another test having run first.

---

## 4. Code Example: Testing a Calculator

A small class under test:

```java
public class Calculator {

    public int add(int a, int b) {
        return a + b;
    }

    public int divide(int a, int b) {
        if (b == 0) {
            throw new ArithmeticException("Cannot divide by zero");
        }
        return a / b;
    }
}
```

A corresponding JUnit 5 test class:

```java
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class CalculatorTest {

    private Calculator calculator;

    @BeforeEach
    void setUp() {
        calculator = new Calculator();
    }

    @Test
    void addsTwoPositiveNumbers() {
        int result = calculator.add(2, 3);
        assertEquals(5, result);
    }

    @Test
    void divideByZeroThrowsArithmeticException() {
        assertThrows(ArithmeticException.class, () -> calculator.divide(10, 0));
    }
}
```

`setUp()` runs before each `@Test` method, so `calculator` is a fresh `Calculator` instance every time — one test's use of the object can't leak into another. `addsTwoPositiveNumbers` checks a normal case: `add(2, 3)` returns `5`. `divideByZeroThrowsArithmeticException` checks the *failure* case: it asserts that calling `calculator.divide(10, 0)` throws an `ArithmeticException`, exactly as `Calculator.divide` is written to do — if `divide` were changed to no longer throw, or to throw a different exception type, this test would fail and flag the regression immediately.

---

## 5. Isolating Dependencies with Mockito

Real classes rarely stand alone — a class under test often depends on something slower or less predictable: a database call, a network request, the current time. Testing the class *and* its real dependency together makes the test slow, and it can fail for reasons that have nothing to do with a bug in the class you actually care about (the database was down, the network hiccuped).

**Mockito** lets you replace a real dependency with a **mock** — a fake, fully controllable stand-in object — for the duration of a test. You tell the mock exactly what to return when a particular method is called, and the class under test never knows the difference.

At a conceptual level:

```java
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

public class OrderServiceTest {

    @Test
    void appliesDiscountFromPricingService() {
        // Create a mock stand-in for a real, possibly slow/external dependency
        PricingService mockPricing = Mockito.mock(PricingService.class);

        // Configure the mock: when this specific method is called, return a fixed value
        when(mockPricing.getDiscountPercentage("SUMMER10")).thenReturn(10);

        OrderService orderService = new OrderService(mockPricing);
        int finalPrice = orderService.calculatePrice(100, "SUMMER10");

        assertEquals(90, finalPrice);
    }
}
```

`Mockito.mock(PricingService.class)` creates a fake `PricingService` with no real behavior at all — calling any method on it does nothing useful until configured. `when(mockPricing.getDiscountPercentage("SUMMER10")).thenReturn(10)` configures exactly one scenario: when that specific method is called with that specific argument, return `10`, deterministically, every time, with no real database or network call involved. The test then verifies that `OrderService` — the actual class under test — correctly used that discount to compute `90` from an original price of `100`. If `OrderService.calculatePrice` has a bug in how it applies the discount, this test fails; if `PricingService`'s real implementation has a bug, this test is unaffected, because the real implementation was never called.

This lesson introduces mocking conceptually, not Mockito's full API — the core idea to take away is: **a mock lets you test one class's logic in isolation, by replacing what it depends on with something predictable you control.**

---

## 6. JUnit Assertions vs Mockito Stubbing

| | **JUnit assertion** | **Mockito stubbing** |
|---|---|---|
| **Purpose** | Checks that the *actual* result matches the *expected* result | Configures what a fake dependency returns when called |
| **Example** | `assertEquals(5, calculator.add(2, 3))` | `when(mockPricing.getDiscountPercentage("SUMMER10")).thenReturn(10)` |
| **Runs against** | The real class under test | A fake stand-in for a dependency of the class under test |
| **Failure means** | The code under test produced the wrong result | N/A — stubbing doesn't "fail"; it just defines mock behavior for the test to rely on |

**Common mistakes:**
- Writing a test that depends on a real external resource — a live database, a real network call — instead of mocking it. This makes the test slow, and "flaky": it can fail intermittently for reasons unrelated to any actual bug (a timeout, a down service), eroding trust in the whole test suite over time.
- Testing implementation details (e.g. asserting a private helper method was called a specific number of times) rather than observable behavior (the actual return value or externally visible effect). Tests written this way break on harmless refactors that didn't change what the code actually does, training developers to ignore failing tests instead of trusting them.

**Interview angle:** "Why mock a dependency instead of just testing against the real thing?" is a frequent follow-up once a candidate mentions unit testing. The strong answer names two distinct benefits: **speed** (no real database/network round-trip) and **determinism/isolation** (the test's pass/fail result depends only on the class under test's own logic, not on an external system's current state or availability) — and recognizes that mocking is for unit tests isolating one class, while integration tests (deliberately using real dependencies) still have their place for verifying things actually connect correctly end to end.

---

## 7. Hands-On Exercises

### Exercise 1 — Write your own `Calculator` tests

Add a `multiply` method to the `Calculator` class from Lesson 4, then write a JUnit 5 test for it using `assertEquals`, plus a second test using `assertThrows` for one deliberately invalid case you design (e.g. an operation you decide should throw for a specific input).

### Exercise 2 — Add a `@BeforeEach` you can observe

Add a `System.out.println` inside `setUp()` in `CalculatorTest`, then add a third `@Test` method. Run the test class (any IDE or `mvn test` from Phase 11 Lesson 1 works) and count how many times the print statement runs, confirming it fires once per test method, not once per class.

### Exercise 3 — Mock a dependency by hand

Design a tiny `NotificationService` interface with one method, `send(String message)`. Write a class `AlertService` that depends on a `NotificationService` and calls `send(...)` when some condition is met. Write a test using `Mockito.mock(NotificationService.class)` to verify `AlertService` behaves correctly without a real notification ever being sent.

---

## 8. Interview Q&A

### Q1. What does the `@Test` annotation do in JUnit 5?

**Answer:** It marks a method as a test case that JUnit should discover and run automatically. JUnit executes every `@Test`-annotated method in a test class independently and reports which passed or failed based on the assertions inside each one.

### Q2. What's the difference between `@BeforeEach` and `@AfterEach`?

**Answer:** `@BeforeEach` runs before every individual `@Test` method in the class — commonly used to set up a fresh object under test so tests don't share state. `@AfterEach` runs after every `@Test` method, commonly used for cleanup (like closing a resource opened during the test).

### Q3. How would you test that a method correctly throws an exception?

**Answer:** Use `assertThrows(ExceptionType.class, () -> { ... })`, passing the exact exception type expected and a lambda that calls the code under test. The assertion passes only if that exact exception type is thrown from inside the lambda; if no exception is thrown, or a different type is thrown, the assertion fails.

### Q4. What problem does Mockito solve, and why not just test against the real dependency?

**Answer:** Mockito replaces a real, possibly slow or unpredictable dependency (a database call, a network request) with a fake, fully controllable mock object during a test. This isolates the class under test — the test's result depends only on that class's own logic, not on an external system's current availability or state — and it's dramatically faster since no real I/O happens.

### Q5. What's a downside of testing implementation details instead of observable behavior?

**Answer:** Tests that assert on internal details (e.g. that a specific private method was called, or that data is stored in a particular internal structure) break whenever the internals are refactored, even if the refactor didn't change what the code actually produces from the outside. This trains developers to treat failing tests as noise rather than a genuine signal, undermining the whole point of having the test suite.

---

> 🧠 **Memory hook:** "A test suite is a pre-flight checklist, not a gut check — and a Mockito mock is the flight simulator that lets you rehearse the one system you're testing without waiting on every other system to be real."
