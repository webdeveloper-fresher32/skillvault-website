# JUnit 5 and Mockito Fundamentals — Complete Guide

## Table of Contents
1. [Why Automated Testing Matters](#1-why-automated-testing-matters)
2. [The Test Pyramid](#2-the-test-pyramid)
3. [JUnit 5 Basics — Lifecycle and Assertions](#3-junit-5-basics--lifecycle-and-assertions)
4. [AssertJ Fluent Assertions](#4-assertj-fluent-assertions)
5. [Parameterized Tests](#5-parameterized-tests)
6. [Mockito Basics — Mocks, Stubs, and Verification](#6-mockito-basics--mocks-stubs-and-verification)
7. [Worked Example — Unit Testing a Service Class](#7-worked-example--unit-testing-a-service-class)
8. [Argument Matchers and Captors](#8-argument-matchers-and-captors)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Why Automated Testing Matters

In a Spring Boot codebase, business logic lives mostly in `@Service` classes, request/response mapping lives in `@RestController` classes, and persistence lives in `@Repository` interfaces backed by Spring Data JPA. Without automated tests, verifying that this logic still works after a change means manually starting the application, hitting endpoints with Postman, and eyeballing the response — a process that is slow, error-prone, and impossible to run on every commit.

Automated tests turn that manual process into code that runs in milliseconds and reports pass/fail unambiguously. They give you three things a manual check cannot:

- **Regression safety** — a test written today catches a bug introduced next month, long after you've forgotten how the original code worked.
- **Executable documentation** — a well-named test method (`shouldThrowWhenAccountBalanceIsInsufficient`) tells the next developer what the code is supposed to do, without them reading the implementation.
- **Design feedback** — code that is hard to unit test (because it has too many hidden dependencies, static calls, or mixed responsibilities) is usually a sign the design itself needs improvement.

Spring Boot ships with the `spring-boot-starter-test` dependency, which transitively pulls in JUnit 5 (the test execution engine), Mockito (for mocking dependencies), AssertJ (for fluent assertions), and Spring Test utilities — everything needed for this phase, with zero extra configuration.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
```

---

## 2. The Test Pyramid

The test pyramid is a model for how your test suite's tests should be distributed across granularity levels. It argues that you should have *many* fast, cheap, isolated tests at the bottom, and progressively *fewer* slow, expensive, broad tests as you move up.

```
                    ▲
                   /  \
                  / E2E \          Few — full app + browser/API,
                 /--------\        slow, brittle, high confidence
                /          \
               / Integration \     Some — real DB/HTTP via
              /----------------\   @SpringBootTest, Testcontainers
             /                  \
            /    Slice Tests      \  More — @WebMvcTest, @DataJpaTest
           /------------------------\ (partial Spring context)
          /                          \
         /        Unit Tests           \  Most — plain JUnit + Mockito,
        /----------------------------------\ no Spring context, milliseconds
```

Why this shape matters:

| Level | Speed | What it loads | What it catches |
|-------|-------|----------------|------------------|
| Unit | Milliseconds | Nothing — plain objects and mocks | Logic bugs in a single class |
| Slice | ~1 second | Part of the Spring context (e.g. only web layer) | Wiring bugs in one layer |
| Integration | Seconds | Full Spring context, maybe a real DB | Cross-layer/config bugs |
| End-to-end | Seconds–minutes | The whole running system | Environment/deployment bugs |

A suite with 500 unit tests and 20 integration tests gives you fast feedback (seconds) on every save, and confidence (minutes) before every merge. A suite inverted — 500 integration tests and 20 unit tests — takes forever to run, is flaky, and makes it painful to pinpoint which class actually broke. This lesson focuses on the base of the pyramid: unit testing with JUnit 5 and Mockito, with no Spring context involved at all.

---

## 3. JUnit 5 Basics — Lifecycle and Assertions

JUnit 5 (Jupiter) is the default test engine in a Spring Boot 3 project. A test class is a plain Java class; test methods are annotated `@Test` and must return `void`.

```java
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

class CalculatorTest {

    private Calculator calculator;

    @BeforeAll
    static void setUpAll() {
        // runs once before all tests in this class — must be static
        System.out.println("Starting CalculatorTest suite");
    }

    @BeforeEach
    void setUp() {
        // runs before every single test method — fresh instance each time
        calculator = new Calculator();
    }

    @Test
    @DisplayName("adding two positive numbers returns their sum")
    void shouldAddTwoPositiveNumbers() {
        int result = calculator.add(2, 3);
        assertEquals(5, result);
    }

    @Test
    void shouldThrowWhenDividingByZero() {
        assertThrows(ArithmeticException.class, () -> calculator.divide(10, 0));
    }

    @AfterEach
    void tearDown() {
        // runs after every test method — good place to reset shared state
        calculator = null;
    }

    @AfterAll
    static void tearDownAll() {
        // runs once after all tests — must be static
        System.out.println("Finished CalculatorTest suite");
    }
}
```

Key lifecycle annotations:

| Annotation | When it runs | Must be static? |
|------------|---------------|------------------|
| `@BeforeAll` | Once, before any test in the class | Yes |
| `@BeforeEach` | Before every `@Test` method | No |
| `@Test` | The test itself | No |
| `@AfterEach` | After every `@Test` method | No |
| `@AfterAll` | Once, after all tests finish | Yes |

Core built-in assertions from `org.junit.jupiter.api.Assertions`:

```java
assertEquals(expected, actual);
assertNotEquals(unexpected, actual);
assertTrue(condition);
assertFalse(condition);
assertNull(value);
assertNotNull(value);
assertThrows(SomeException.class, () -> methodThatThrows());
assertAll(
    () -> assertEquals(1, list.size()),
    () -> assertTrue(list.contains("x"))
);
```

`assertAll` is useful when you want to check multiple related assertions and see *all* failures at once, instead of JUnit stopping at the first failed assertion.

---

## 4. AssertJ Fluent Assertions

AssertJ, included transitively via `spring-boot-starter-test`, provides a fluent, chainable assertion API that reads closer to natural language and gives far more descriptive failure messages than the plain JUnit assertions. Most Spring Boot teams prefer AssertJ's `assertThat(...)` over JUnit's `assertEquals(...)`.

```java
import static org.assertj.core.api.Assertions.assertThat;

@Test
void shouldReturnActiveUsersOnly() {
    List<User> users = userService.findActiveUsers();

    assertThat(users)
        .isNotEmpty()
        .hasSize(2)
        .extracting(User::getUsername)
        .containsExactlyInAnyOrder("alice", "bob");
}

@Test
void shouldBuildFullName() {
    Customer customer = new Customer("Jane", "Doe");

    assertThat(customer.getFullName())
        .isEqualTo("Jane Doe")
        .startsWith("Jane")
        .doesNotContain("Mr.");
}

@Test
void shouldThrowIllegalArgumentExceptionForNegativeAmount() {
    assertThatThrownBy(() -> paymentService.charge(-50))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("amount must be positive");
}
```

The chained style — `assertThat(x).isNotEmpty().hasSize(2)...` — means a single failing assertion clearly states which condition in the chain failed, with the actual and expected values printed side by side. This is a major readability win over a long sequence of separate `assertEquals` calls.

---

## 5. Parameterized Tests

`@ParameterizedTest` lets you run the same test logic against multiple sets of inputs, avoiding copy-pasted test methods that differ only in their literal values.

```java
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.MethodSource;

class DiscountCalculatorTest {

    private final DiscountCalculator calculator = new DiscountCalculator();

    @ParameterizedTest
    @ValueSource(ints = { -1, -10, -100 })
    void shouldRejectNegativeAmounts(int amount) {
        assertThrows(IllegalArgumentException.class,
            () -> calculator.applyDiscount(amount, 10));
    }

    @ParameterizedTest
    @CsvSource({
        "100, 10, 90.0",
        "200, 25, 150.0",
        "50,  0,  50.0"
    })
    void shouldApplyPercentageDiscount(double price, int percentOff, double expected) {
        double result = calculator.applyDiscount(price, percentOff);
        assertThat(result).isEqualTo(expected);
    }

    @ParameterizedTest
    @MethodSource("provideOrderScenarios")
    void shouldCalculateOrderTotal(Order order, double expectedTotal) {
        assertThat(order.calculateTotal()).isEqualTo(expectedTotal);
    }

    static Stream<Arguments> provideOrderScenarios() {
        return Stream.of(
            Arguments.of(new Order(List.of(new Item("A", 10.0)), 0), 10.0),
            Arguments.of(new Order(List.of(new Item("A", 10.0), new Item("B", 5.0)), 10), 13.5)
        );
    }
}
```

`@ValueSource` covers a single simple parameter type, `@CsvSource` handles multiple primitive/string parameters inline, and `@MethodSource` is used when you need to construct complex objects as arguments — as shown with `Order` in the example above.

---

## 6. Mockito Basics — Mocks, Stubs, and Verification

A **unit test** should test one class in complete isolation — it should not touch a database, make an HTTP call, or depend on any other real collaborator. Mockito lets you replace a class's real dependencies with fake ("mock") objects whose behavior you control entirely.

```java
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private InventoryClient inventoryClient;

    @InjectMocks
    private OrderService orderService;

    @Test
    void shouldSaveOrderWhenStockIsAvailable() {
        // Arrange: stub the mock's behavior
        when(inventoryClient.hasStock("SKU-1", 2)).thenReturn(true);
        when(orderRepository.save(any(Order.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        Order result = orderService.placeOrder("SKU-1", 2);

        // Assert
        assertThat(result.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        verify(orderRepository).save(any(Order.class));
        verify(inventoryClient).hasStock("SKU-1", 2);
    }
}
```

Key building blocks:

- **`@Mock`** creates a fake instance of a dependency (`OrderRepository`, `InventoryClient`). Calling any method on it does nothing and returns a default value (`null`, `0`, `false`) unless you stub it.
- **`@InjectMocks`** creates a real instance of the class under test (`OrderService`) and automatically injects the `@Mock` fields into its constructor or setters.
- **`when(...).thenReturn(...)`** stubs a mock's method to return a specific value when called with matching arguments.
- **`verify(...)`** asserts that a specific method was actually called on the mock — useful for testing side effects (like "was `save` called?") when there's no return value to assert on directly.
- **`@ExtendWith(MockitoExtension.class)`** wires Mockito's annotation processing into the JUnit 5 lifecycle — without it, `@Mock` and `@InjectMocks` fields are never initialized.

```
  Unit test isolation:
  ┌───────────────────────────────────────────────────────┐
  │  OrderServiceTest                                     │
  │                                                       │
  │   OrderService (REAL — the class under test)          │
  │       │              │                               │
  │       ▼              ▼                               │
  │   OrderRepository   InventoryClient                   │
  │   (MOCK — fake)     (MOCK — fake)                      │
  │                                                       │
  │   No database. No network call. No Spring context.   │
  │   Runs in milliseconds.                               │
  └───────────────────────────────────────────────────────┘
```

---

## 7. Worked Example — Unit Testing a Service Class

Consider a typical layered Spring Boot service: `AccountService` depends on `AccountRepository` (Spring Data JPA) to persist state, and applies business rules around withdrawals.

```java
// AccountService.java — production code
@Service
public class AccountService {

    private final AccountRepository accountRepository;

    public AccountService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    public Account withdraw(Long accountId, BigDecimal amount) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Withdrawal amount must be positive");
        }

        Account account = accountRepository.findById(accountId)
            .orElseThrow(() -> new AccountNotFoundException(accountId));

        if (account.getBalance().compareTo(amount) < 0) {
            throw new InsufficientFundsException(accountId, amount);
        }

        account.setBalance(account.getBalance().subtract(amount));
        return accountRepository.save(account);
    }
}
```

The unit test isolates `AccountService` entirely by mocking `AccountRepository` — no real database is touched:

```java
// AccountServiceTest.java — test code
@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @InjectMocks
    private AccountService accountService;

    private Account existingAccount;

    @BeforeEach
    void setUp() {
        existingAccount = new Account(1L, "Jane Doe", new BigDecimal("500.00"));
    }

    @Test
    void shouldWithdrawWhenBalanceIsSufficient() {
        when(accountRepository.findById(1L)).thenReturn(Optional.of(existingAccount));
        when(accountRepository.save(any(Account.class))).thenAnswer(inv -> inv.getArgument(0));

        Account result = accountService.withdraw(1L, new BigDecimal("200.00"));

        assertThat(result.getBalance()).isEqualByComparingTo("300.00");
        verify(accountRepository).save(existingAccount);
    }

    @Test
    void shouldThrowInsufficientFundsWhenBalanceTooLow() {
        when(accountRepository.findById(1L)).thenReturn(Optional.of(existingAccount));

        assertThatThrownBy(() -> accountService.withdraw(1L, new BigDecimal("1000.00")))
            .isInstanceOf(InsufficientFundsException.class);

        // save must never be called if the withdrawal is rejected
        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    void shouldThrowAccountNotFoundWhenAccountDoesNotExist() {
        when(accountRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> accountService.withdraw(99L, new BigDecimal("10.00")))
            .isInstanceOf(AccountNotFoundException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = { "0", "-5.00", "-100.50" })
    void shouldRejectNonPositiveWithdrawalAmounts(String amount) {
        assertThatThrownBy(() -> accountService.withdraw(1L, new BigDecimal(amount)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("must be positive");

        verifyNoInteractions(accountRepository);
    }
}
```

Notice this test suite runs in milliseconds because `AccountRepository` never touches a real database — Mockito's `@Mock` intercepts every call and returns exactly what the test tells it to. `verifyNoInteractions(accountRepository)` in the last test additionally proves the validation check short-circuits *before* any repository call is made, which is an important business-rule guarantee to lock in with a test.

---

## 8. Argument Matchers and Captors

Sometimes you need to assert on the *exact* argument passed into a mocked method, not just that the method was called. `ArgumentCaptor` captures the actual value passed at call time so you can make assertions on it afterward.

```java
@Test
void shouldSaveAccountWithUpdatedBalance() {
    when(accountRepository.findById(1L)).thenReturn(Optional.of(existingAccount));
    when(accountRepository.save(any())).thenReturn(existingAccount);

    accountService.withdraw(1L, new BigDecimal("50.00"));

    ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
    verify(accountRepository).save(captor.capture());

    Account savedAccount = captor.getValue();
    assertThat(savedAccount.getBalance()).isEqualByComparingTo("450.00");
}
```

Argument matchers like `any()`, `anyString()`, `eq(value)`, and `argThat(predicate)` control which stubbed calls match which invocation. A common rule: **once you use a matcher for one argument in a call, you must use matchers for all arguments in that same call** — mixing raw values and matchers in the same method call throws an `InvalidUseOfMatchersException`.

```java
// Wrong — mixes a raw value with a matcher in the same call
when(orderRepository.findByCustomerAndStatus("alice", any())).thenReturn(...);

// Correct — use eq() alongside any()
when(orderRepository.findByCustomerAndStatus(eq("alice"), any())).thenReturn(...);
```

---

## 9. Common Pitfalls

- **Forgetting `@ExtendWith(MockitoExtension.class)`** — without it, `@Mock` and `@InjectMocks` fields stay `null`, and tests fail with a confusing `NullPointerException` instead of a clear setup error.
- **Over-mocking value objects** — mocking simple data classes (DTOs, entities with no behavior) instead of just constructing real instances adds noise and brittleness. Only mock genuine collaborators — repositories, external clients, gateways.
- **Testing Mockito instead of your code** — writing a test that only checks `verify(mock).someMethod()` without asserting any actual outcome tests that a call happened, not that the business logic is correct.
- **Unnecessary stubbing errors** — Mockito's strict stubbing (default since Mockito 2) fails a test if you stub a method that is never actually called during that test, which is a useful signal that the test is stubbing more than it needs.
- **Sharing mutable mock state across tests** — reusing a `@Mock` field's configured behavior between test methods without resetting it in `@BeforeEach` causes one test's stubbing to bleed into another, producing order-dependent test failures.
- **Asserting on mock interactions instead of on real return values** — for methods with return values, prefer asserting the returned result over relying purely on `verify` calls; `verify` should be reserved for real side effects (writes, external calls) that have no return value to check.
- **Not resetting `@InjectMocks` state between parameterized runs** — because JUnit 5 creates a fresh test instance per `@Test`/parameterized invocation by default (`PER_METHOD` lifecycle), this is rarely an issue, but be aware if you ever switch to `@TestInstance(Lifecycle.PER_CLASS)`.

---

## 10. Best Practices

- **Follow Arrange-Act-Assert (AAA)** in every test: set up inputs and stubs, invoke the method under test, then assert the outcome — keeping these three phases visually separated makes tests easy to scan.
- **Name tests for behavior, not for the method under test** — prefer `shouldThrowWhenBalanceIsInsufficient` over `testWithdraw2`. `@DisplayName` can add a human-readable sentence on top of the method name for reporting.
- **One logical assertion focus per test** — a test can have multiple `assertThat` calls, but they should all verify the same scenario/outcome; don't combine unrelated scenarios in one test method.
- **Keep unit tests free of Spring** — no `@SpringBootTest`, no `@Autowired`, no application context. Plain JUnit + Mockito is enough for testing a service class's logic and should run in well under a second per test.
- **Prefer constructor injection** in production classes — it makes `@InjectMocks` work reliably and makes dependencies explicit and immutable, versus field injection which is harder to test.
- **Use AssertJ over raw JUnit assertions** for anything beyond a trivial equality check — the fluent API and better failure messages pay for themselves quickly.
- **Verify negative paths, not just happy paths** — for every business rule ("insufficient funds", "invalid input", "not found"), write a dedicated test asserting the correct exception or rejection behavior.
- **Keep test data realistic** — favor small, purpose-built fixtures over enormous shared "god objects" reused across every test in the class.

---

## 11. Hands-On Exercises

**Exercise 1:** Create a `Calculator` class with `add`, `subtract`, `multiply`, and `divide` methods, where `divide` throws `ArithmeticException` on division by zero. Write a `CalculatorTest` using `@BeforeEach` to instantiate a fresh `Calculator` before each test, and cover all four operations plus the divide-by-zero exception path using `assertThrows`.

**Exercise 2:** Rewrite the assertions in Exercise 1 using AssertJ's `assertThat(...)` fluent style instead of JUnit's `assertEquals`/`assertThrows`, including `assertThatThrownBy(...).isInstanceOf(...)` for the exception case.

**Exercise 3:** Write a `@ParameterizedTest` using `@CsvSource` for a `TaxCalculator.calculateTax(double income, double rate)` method, covering at least four income/rate/expected-tax combinations in one test method instead of four separate test methods.

**Exercise 4:** Given a `NotificationService` that depends on an `EmailClient` interface with a method `send(String to, String subject, String body)`, write a Mockito-based unit test that verifies `NotificationService.notifyUserOfShipment(...)` calls `emailClient.send(...)` with the correct recipient and a subject containing the word "Shipped". Use `ArgumentCaptor` to capture and assert on the exact arguments passed to `send`.

**Exercise 5:** Extend the `AccountServiceTest` from Section 7 with a new test for a hypothetical `transfer(Long fromId, Long toId, BigDecimal amount)` method that withdraws from one account and deposits into another. Mock both `findById` calls with different accounts, and verify that `accountRepository.save(...)` is called exactly twice — once for each account — using `verify(accountRepository, times(2)).save(any(Account.class))`.

---

## 12. Interview Q&A

**Q: What is the difference between a unit test and an integration test, and why should unit tests dominate your test suite?**
Answer: A unit test exercises a single class in complete isolation, with all of its collaborators replaced by mocks or stubs — no database, no network call, no Spring context — so it runs in milliseconds and pinpoints failures to one class. An integration test exercises multiple real components together (e.g. a service, a repository, and a real or containerized database), which is slower and can fail for reasons unrelated to the class you actually intended to test. The test pyramid recommends many unit tests at the base because they are fast and precise, with progressively fewer integration and end-to-end tests, since a suite dominated by slow integration tests becomes painful to run frequently and hard to debug when something breaks.

**Q: What do `@Mock` and `@InjectMocks` do, and what happens if you forget `@ExtendWith(MockitoExtension.class)`?**
Answer: `@Mock` creates a fake implementation of a dependency whose method behavior you control via `when(...).thenReturn(...)`; calling an unstubbed method returns a Java default value (null, 0, false) rather than throwing. `@InjectMocks` instantiates the real class under test and injects the `@Mock` fields into its constructor (or setters/fields) automatically. Without `@ExtendWith(MockitoExtension.class)` on the test class, JUnit never triggers Mockito's annotation processing, so both fields remain null and the test typically fails with a `NullPointerException` on first use rather than a clear configuration error — which is why this annotation is one of the first things to check when a Mockito test misbehaves unexpectedly.

**Q: What is the purpose of `verify()` in Mockito, and when should you use it versus asserting a return value?**
Answer: `verify(mock).someMethod(args)` confirms that a specific method was actually invoked on a mock with the given arguments — it is essential for testing side effects that produce no return value, such as confirming a repository's `save` was called or an email client's `send` was invoked. When a method under test *does* return a value, prefer asserting directly on that returned value with `assertThat(...)`, since verifying mock interactions alone can pass even if the actual computed result is wrong; `verify` and return-value assertions are complementary, not interchangeable.

**Q: Why would a test using `@ParameterizedTest` with `@CsvSource` be preferable to writing four nearly-identical `@Test` methods?**
Answer: `@ParameterizedTest` with `@CsvSource` runs the same test body against multiple sets of input/expected-output pairs defined declaratively, eliminating copy-pasted test methods that differ only in literal values. This reduces maintenance burden — a bug fix or refactor in the test logic only needs to happen once — and makes it trivial to add new cases by adding a new CSV row rather than duplicating a whole method. It also produces a cleaner test report, since each parameter set shows up as its own named test invocation, making it easy to see exactly which input combination failed.

**Q: What does `@InjectMocks` do when the class under test has multiple constructors or no matching constructor for the declared mocks?**
Answer: Mockito attempts constructor injection first: it looks for a constructor whose parameter types match the declared `@Mock` fields and uses it to instantiate the class under test. If no matching constructor is found, it falls back to property/setter injection, and finally to field injection via reflection. This is why production code should favor a single, explicit constructor with all dependencies as parameters (constructor injection) — it is the most reliable and unambiguous form for Mockito to inject into, and it also makes the class's dependencies visible without needing to read the implementation.

**Q: What is "strict stubbing" in Mockito and why might a test fail with an `UnnecessaryStubbingException`?**
Answer: Since Mockito 2, the default `MockitoExtension` runs in strict stubbing mode, which tracks every `when(...).thenReturn(...)` stub declared in a test and fails the test if a stub is never actually invoked during that test's execution. This catches copy-paste mistakes where a stub was left over from a previous test or is simply irrelevant to the current scenario, keeping tests lean and making it obvious exactly which mock interactions the test actually depends on. The fix is either to remove the unused stub or, if it is intentionally shared setup that not every test uses, move it to a `@BeforeEach` using `lenient().when(...)` to opt that particular stub out of strict checking.
