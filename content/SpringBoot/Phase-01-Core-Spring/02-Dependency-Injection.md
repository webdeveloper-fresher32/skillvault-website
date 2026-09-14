# Dependency Injection (DI) — Complete Guide

## Table of Contents
1. [DI as the Implementation of IoC](#1-di-as-the-implementation-of-ioc)
2. [The Three Injection Styles](#2-the-three-injection-styles)
3. [Injection Style Trade-Off Table](#3-injection-style-trade-off-table)
4. [The @Autowired Resolution Algorithm](#4-the-autowired-resolution-algorithm)
5. [Resolving Ambiguity — @Qualifier and @Primary](#5-resolving-ambiguity--qualifier-and-primary)
6. [The Circular Dependency Problem](#6-the-circular-dependency-problem)
7. [Optional Dependencies](#7-optional-dependencies)
8. [Injecting Collections of Beans](#8-injecting-collections-of-beans)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Best Practices](#10-best-practices)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. DI as the Implementation of IoC

Inversion of Control (covered in lesson 1) is the *principle* — object creation and wiring control moves outside the class. Dependency Injection is the concrete *pattern* Spring uses to realize that principle: a class declares its dependencies (as constructor parameters, setter parameters, or annotated fields), and the container supplies concrete instances at runtime rather than the class instantiating them itself.

```
  IoC (the principle)                    DI (the mechanism)
  ┌──────────────────────┐              ┌──────────────────────────┐
  │ "Someone else should  │   realized   │ Constructor parameters,   │
  │  control creation and │ ───────────▶ │ setter parameters, or     │
  │  wiring of my deps"   │     by       │ @Autowired fields — the   │
  │                       │              │ container supplies values │
  └──────────────────────┘              └──────────────────────────┘
```

Formally, Dependency Injection is the process whereby an object's dependencies (the other objects it collaborates with) are supplied to it from the outside, rather than the object looking them up or constructing them itself. Spring supports three mechanical ways to do this — constructor injection, setter injection, and field injection — described next.

---

## 2. The Three Injection Styles

### Constructor Injection (recommended default)

```java
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    private final PaymentProcessor paymentProcessor;
    private final InventoryClient inventoryClient;

    // As of Spring 4.3, @Autowired can be omitted entirely when there
    // is exactly one constructor — Spring infers it should be used for DI.
    public OrderService(PaymentProcessor paymentProcessor,
                         InventoryClient inventoryClient) {
        this.paymentProcessor = paymentProcessor;
        this.inventoryClient = inventoryClient;
    }
}
```

The container resolves every constructor parameter before calling the constructor, so the object exists in a fully-wired state the instant it comes into being — there is no window where `OrderService` exists with a `null` `paymentProcessor`.

### Setter Injection

```java
@Service
public class OrderService {

    private PaymentProcessor paymentProcessor;

    @Autowired
    public void setPaymentProcessor(PaymentProcessor paymentProcessor) {
        this.paymentProcessor = paymentProcessor;
    }
}
```

Setter injection allows a dependency to be set (or changed) after construction, which is useful for optional dependencies or dependencies that need to be reconfigured post-construction — but it means the object can transiently exist without that dependency set, and the field cannot be declared `final`.

### Field Injection (discouraged)

```java
@Service
public class OrderService {

    @Autowired
    private PaymentProcessor paymentProcessor;
}
```

Field injection uses reflection to set the field directly, bypassing both the constructor and any setter. It is the most concise to write but the worst for testability and design clarity, discussed in detail below.

---

## 3. Injection Style Trade-Off Table

| Dimension | Constructor Injection | Setter Injection | Field Injection |
|---|---|---|---|
| Immutability (`final` fields) | Yes — fields can be `final` | No | No |
| Testability without Spring | Excellent — plain `new OrderService(mock1, mock2)` | Good — `new OrderService(); setX(mock)` | Poor — requires reflection (`ReflectionTestUtils`) or a full Spring context to set the field |
| Dependencies visible in the public API | Yes — the constructor signature IS the dependency list | Partially — spread across setter methods | No — dependencies are hidden inside the class body |
| Null-safety | Strong — object cannot exist without dependencies | Weak — object can exist with unset dependencies until setters are called | Weak — same issue, worse because it's invisible from outside |
| Circular dependency behavior | Fails fast at startup with `BeanCurrentlyInCreationException` | Resolved by the container (setter injection happens after both beans exist as raw instances) | Resolved by the container, same as setter injection |
| Framework coupling | Low — the class itself has no Spring imports if `@Autowired` is omitted (single constructor) | Low-medium — needs `@Autowired` on the setter | High — the class cannot be instantiated correctly outside Spring at all |
| Encourages small, focused classes | Yes — a bloated constructor with 8 parameters is an obvious smell (violates SRP) | Not as obvious — setters can accumulate silently | Not obvious at all — fields can accumulate silently, hiding a class doing too much |
| Recommended for | Required dependencies (the overwhelming majority of real dependencies) | Genuinely optional dependencies, or dependencies needing post-construction reconfiguration | Nowhere in production code — acceptable only in throwaway tests/prototypes |

The "constructor bloat as a design smell" row deserves emphasis: because constructor injection makes every dependency an explicit, visible parameter, a class that needs 8+ constructor arguments makes its violation of the Single Responsibility Principle immediately obvious to any reader. Field injection hides this same problem — a class can silently accumulate a dozen `@Autowired` fields with no external signal that it has become a god object.

---

## 4. The @Autowired Resolution Algorithm

When Spring encounters an injection point (constructor parameter, setter parameter, or field) it must decide which bean from the container satisfies it. The resolution proceeds through a strict, ordered algorithm:

```
  ┌──────────────────────────────────────────────────────────────────┐
  │  STEP 1 — Resolve BY TYPE                                          │
  │  Find all beans in the context assignable to the declared type    │
  │                                                                     │
  │           0 matches ──────────▶ NoSuchBeanDefinitionException      │
  │                                  (unless @Autowired(required=false)│
  │                                  or Optional<T>/@Nullable used)    │
  │           1 match ───────────▶ inject it, DONE                    │
  │           2+ matches ─────────▶ proceed to STEP 2                  │
  └──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  STEP 2 — Resolve BY @Qualifier                                    │
  │  If any candidate's bean name / @Qualifier value matches the       │
  │  injection point's @Qualifier annotation, use that one, DONE       │
  │  If no @Qualifier annotation present at the injection point,       │
  │  proceed to STEP 3                                                 │
  └──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  STEP 3 — Resolve BY @Primary                                      │
  │  If exactly one candidate bean is annotated @Primary, use it, DONE │
  │  If zero or 2+ candidates are @Primary, proceed to STEP 4          │
  └──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  STEP 4 — Resolve BY FIELD/PARAMETER NAME                          │
  │  If a candidate bean's name matches the field or parameter name    │
  │  exactly, use it, DONE                                             │
  └──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  STEP 5 — STILL AMBIGUOUS                                          │
  │  NoUniqueBeanDefinitionException thrown at context startup         │
  └──────────────────────────────────────────────────────────────────┘
```

This means "by name" is genuinely the *last* resort, not the first — a common misconception is that Spring always matches by field name first. In reality, type match is always attempted first, and name-based matching only kicks in as a tiebreaker after `@Qualifier` and `@Primary` have both failed to disambiguate.

Concrete ambiguity example — two implementations of the same interface with no disambiguation:

```java
public interface NotificationChannel {
    void send(String message);
}

@Component
public class EmailChannel implements NotificationChannel {
    public void send(String message) { /* ... */ }
}

@Component
public class SmsChannel implements NotificationChannel {
    public void send(String message) { /* ... */ }
}

@Service
public class AlertService {
    // FAILS at context startup: NoUniqueBeanDefinitionException —
    // two beans (emailChannel, smsChannel) match NotificationChannel
    public AlertService(NotificationChannel channel) { }
}
```

---

## 5. Resolving Ambiguity — @Qualifier and @Primary

`@Qualifier` disambiguates at the injection point by referencing a specific bean name (or a custom qualifier value):

```java
@Service
public class AlertService {

    private final NotificationChannel channel;

    public AlertService(@Qualifier("emailChannel") NotificationChannel channel) {
        this.channel = channel;
    }
}
```

`@Primary` instead marks one implementation as the default candidate whenever ambiguity arises, without requiring every injection point to specify a qualifier:

```java
@Component
@Primary
public class EmailChannel implements NotificationChannel {
    public void send(String message) { /* ... */ }
}

@Component
public class SmsChannel implements NotificationChannel {
    public void send(String message) { /* ... */ }
}

@Service
public class AlertService {
    // Resolves to EmailChannel automatically — it is @Primary.
    // No @Qualifier needed here.
    public AlertService(NotificationChannel channel) { }
}

@Service
public class UrgentAlertService {
    // Explicitly overrides the @Primary default for this one injection point.
    public UrgentAlertService(@Qualifier("smsChannel") NotificationChannel channel) { }
}
```

Use `@Primary` when one implementation is genuinely the "default" across the whole application (e.g., a primary `DataSource` among several configured for different databases). Use `@Qualifier` when the correct choice is specific to each injection point and there is no sensible universal default (as in `AlertService` needing email but `UrgentAlertService` needing SMS).

---

## 6. The Circular Dependency Problem

A circular dependency exists when two (or more) beans depend on each other, directly or transitively. Constructor injection makes this fail immediately and loudly, because constructing either bean first requires the other to already exist:

```java
@Service
public class OrderService {
    private final ShippingService shippingService;

    public OrderService(ShippingService shippingService) {   // needs ShippingService
        this.shippingService = shippingService;
    }
}

@Service
public class ShippingService {
    private final OrderService orderService;

    public ShippingService(OrderService orderService) {      // needs OrderService
        this.orderService = orderService;
    }
}
```

Starting this application throws:

```
BeanCurrentlyInCreationException: Error creating bean with name 'orderService':
Requested bean is currently in creation: Is there an unresolvable circular reference?
```

The container tried to build `OrderService`, which required `ShippingService`, whose construction in turn required `OrderService` — but `OrderService` is still mid-construction (it hasn't returned from its own constructor yet), so there is nothing to hand back. Constructor injection has no mechanism to "come back to this later" because the constructor call is atomic.

**Workaround 1 — Setter injection.** Since setter injection happens *after* both beans exist as raw (constructed) instances, the container can construct both objects first (with no dependencies set yet) and then wire the setters in a second pass:

```java
@Service
public class OrderService {
    private ShippingService shippingService;

    @Autowired
    public void setShippingService(ShippingService shippingService) {
        this.shippingService = shippingService;
    }
}

@Service
public class ShippingService {
    private OrderService orderService;

    @Autowired
    public void setOrderService(OrderService orderService) {
        this.orderService = orderService;
    }
}
```

**Workaround 2 — `@Lazy`.** Keeping constructor injection but wrapping one side in a lazy proxy defers resolution of that dependency until it is actually used, breaking the cycle at construction time:

```java
@Service
public class OrderService {
    private final ShippingService shippingService;

    public OrderService(@Lazy ShippingService shippingService) {
        this.shippingService = shippingService;   // a proxy, resolved on first real use
    }
}
```

**Why this is usually a design smell.** Both workarounds are escape hatches, not solutions — a genuine circular dependency between two services almost always indicates that responsibilities are misallocated between them, or that a third component (a shared service, or an event published by one and consumed by the other) should sit between them and own the interaction. The idiomatic fix is to extract the shared logic into a third `@Service` that both `OrderService` and `ShippingService` depend on, or to replace the direct call with an application event (`ApplicationEventPublisher`) that the other side listens for asynchronously, eliminating the cycle entirely rather than papering over it.

---

## 7. Optional Dependencies

Not every dependency is mandatory. Spring supports two idiomatic ways to express "inject this if present, otherwise proceed without it":

```java
@Service
public class ReportService {

    private final AuditLogger auditLogger; // may be null if no AuditLogger bean exists

    // required = false: if no AuditLogger bean exists, this field/param stays null
    // instead of the context failing to start.
    @Autowired(required = false)
    public ReportService(AuditLogger auditLogger) {
        this.auditLogger = auditLogger;
    }

    public void generate() {
        if (auditLogger != null) {
            auditLogger.log("report generated");
        }
    }
}
```

The `Optional<T>` style is generally preferred in modern code because it forces the consuming code to explicitly handle the absent case rather than risking a silent `NullPointerException`:

```java
@Service
public class ReportService {

    private final Optional<AuditLogger> auditLogger;

    public ReportService(Optional<AuditLogger> auditLogger) {
        this.auditLogger = auditLogger;
    }

    public void generate() {
        auditLogger.ifPresent(logger -> logger.log("report generated"));
    }
}
```

`@Nullable` (from `org.springframework.lang.Nullable` or JSR-305) is a third, lighter-weight variant that documents intent via the type signature without changing runtime behavior beyond suppressing the "no bean found" failure — functionally similar to `required = false` but expressed at the parameter/field level.

---

## 8. Injecting Collections of Beans

When multiple beans implement the same interface, Spring can inject *all* of them at once as a `List<T>` or `Map<String, T>`, rather than requiring disambiguation via `@Qualifier`/`@Primary`. This is the standard pattern for strategy/plugin-style designs (e.g., a chain of validators, a set of export formats):

```java
public interface ExportFormat {
    String extension();
    byte[] export(Report report);
}

@Component
@Order(1)
public class CsvExportFormat implements ExportFormat {
    public String extension() { return "csv"; }
    public byte[] export(Report report) { /* ... */ return new byte[0]; }
}

@Component
@Order(2)
public class PdfExportFormat implements ExportFormat {
    public String extension() { return "pdf"; }
    public byte[] export(Report report) { /* ... */ return new byte[0]; }
}

@Service
public class ReportExportService {

    private final List<ExportFormat> formats;

    // Spring injects EVERY bean implementing ExportFormat, in @Order sequence
    public ReportExportService(List<ExportFormat> formats) {
        this.formats = formats;
    }

    public ExportFormat findByExtension(String extension) {
        return formats.stream()
                .filter(f -> f.extension().equals(extension))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported: " + extension));
    }
}
```

Injecting a `Map<String, ExportFormat>` instead gives you the beans keyed by their bean name, which is convenient when you need to look one up by a known identifier rather than iterating:

```java
@Service
public class ReportExportService {

    private final Map<String, ExportFormat> formatsByBeanName;

    public ReportExportService(Map<String, ExportFormat> formatsByBeanName) {
        this.formatsByBeanName = formatsByBeanName; // e.g. {"csvExportFormat": ..., "pdfExportFormat": ...}
    }
}
```

`@Order` (or implementing the `Ordered` interface) controls the iteration order of the injected `List<T>` — without it, order is undefined and should never be relied upon. This matters for validator chains or filter chains where execution order changes behavior.

---

## 9. Common Pitfalls

**Reaching for field injection because it is the shortest to type.** It is the least testable and most opaque option of the three; the small typing savings are almost never worth the loss of immutability, visible dependencies, and plain-`new()` testability. Field injection should be treated as a code smell in reviewed production code, reserved at most for quick throwaway test fixtures.

**Adding `@Qualifier("beanName")` referencing a string that silently drifts from the actual bean name after a rename.** Because `@Qualifier`'s string argument is not checked against the bean's actual name at compile time, renaming a class (which changes its default bean name) without updating every `@Qualifier` reference produces a runtime `NoSuchBeanDefinitionException` that is easy to miss during a refactor. Prefer defining an explicit `@Qualifier` custom annotation or bean name constant that both sides reference, rather than repeating raw strings.

**Treating `@Primary` as a permanent fix for what is really persistent ambiguity.** If nearly every injection point for an interface needs to override the `@Primary` default with its own `@Qualifier`, that is a sign the interface has two genuinely different roles being conflated — consider splitting it into two more specific interfaces instead of fighting the DI resolution mechanism at every call site.

**Not realizing setter/field injection "solves" circular dependencies by masking a design problem.** Making a circular dependency "work" via `@Lazy` or setter injection removes the loud failure that constructor injection gives you for free, but the underlying coupling between the two classes still exists — it is now just harder to see. Treat any circular dependency error as a prompt to reconsider the design, not merely an obstacle to work around.

**Forgetting that `Optional<T>` injection wraps the *type* being injected, not a collection of beans.** `Optional<AuditLogger>` means "zero or one `AuditLogger` bean might exist" — it still throws `NoUniqueBeanDefinitionException` if two `AuditLogger` beans exist without further disambiguation. Developers sometimes assume `Optional<T>` silently resolves ambiguity between multiple candidates the way a `List<T>` would; it does not.

**Relying on undefined ordering when injecting a `List<T>` of strategy beans.** Without `@Order` (or `Ordered`), the iteration order of an injected list is an implementation detail of classpath scanning and is not guaranteed to be stable across Spring versions or even across application restarts in some configurations. Any code whose correctness depends on which bean runs "first" in a `List<T>` injection must declare `@Order` explicitly.

---

## 10. Best Practices

Default to constructor injection for every dependency that is required for the object to be in a valid state — this should be the overwhelming majority of your dependencies, and it lets you mark fields `final`.

Reserve setter injection for dependencies that are genuinely optional or need to be reconfigurable after construction (rare in typical business services, more common in framework-adjacent code).

Never use field injection in production code; if you see it in legacy code you are touching, consider migrating it to constructor injection as part of the change, since it is a mechanical, low-risk refactor with real testability benefits.

When a constructor grows past 4-5 parameters, treat it as a signal to split the class rather than reaching for field injection to "hide" the growth — the pain constructor injection surfaces is valuable design feedback, not a friction to engineer around.

Prefer `@Primary` for a single, application-wide sensible default, and `@Qualifier` for call-site-specific choices; do not mix both approaches for the same interface without a clear reason, since it becomes hard to predict which one wins without re-reading the resolution algorithm.

When you discover a circular dependency, treat `@Lazy`/setter injection as a temporary unblock, not the fix — file it as a design debt item and look for the shared responsibility or event-based decoupling that removes the cycle.

Always add `@Order` to strategy/plugin beans injected as a `List<T>` whose execution order has any behavioral significance, even if the current order happens to work by accident today.

---

## 11. Hands-On Exercises

**Exercise 1:** Create two implementations of an interface `DiscountStrategy` (e.g., `PercentageDiscount` and `FlatAmountDiscount`), both annotated `@Component`. Create a `PricingService` with a constructor taking a `DiscountStrategy` parameter and confirm the application fails to start with `NoUniqueBeanDefinitionException`. Fix it first by adding `@Qualifier("percentageDiscount")` at the injection point, confirm it starts, then remove the qualifier and instead mark `PercentageDiscount` with `@Primary` and confirm the application starts and resolves to that implementation without any qualifier needed.

**Exercise 2:** Reproduce the circular dependency failure from Section 6 exactly: two `@Service` classes each requiring the other via constructor injection. Run the app and capture the full `BeanCurrentlyInCreationException` stack trace. Then fix it using setter injection on one side only, rerun, and confirm it starts. Finally, revert to constructor injection but add `@Lazy` on one constructor parameter, rerun, and confirm it also starts — compare the two fixes and write down (as a code comment) which one you would choose in a real codebase and why.

**Exercise 3:** Build a `NotificationService` with an optional `MetricsRecorder` dependency injected via `Optional<MetricsRecorder>`. Run the app with no `MetricsRecorder` bean registered and confirm no exception occurs, with `auditLogger.isPresent()` (or equivalent) returning false at runtime. Then add a `@Component` implementing `MetricsRecorder` and rerun, confirming the optional now resolves to `Optional.of(...)` and your fallback logic is skipped.

**Exercise 4:** Create three `@Component` implementations of an interface `Validator` (e.g., `NotNullValidator`, `LengthValidator`, `FormatValidator`), each annotated with a distinct `@Order` value. Inject `List<Validator> validators` into a `ValidationPipeline` service and iterate over them, printing each validator's class name. Confirm the print order matches your `@Order` values. Then remove all `@Order` annotations, rerun several times, and observe (and document) whether the order stays consistent — use this to justify why explicit ordering should never be skipped when order matters.

**Exercise 5:** Write a unit test (JUnit 5 + Mockito, no Spring context started) for a class using constructor injection versus a legacy class using field injection. For the constructor-injected class, show that `new ServiceUnderTest(mockDependency)` combined with `Mockito.mock(Dependency.class)` works with zero Spring involvement. For the field-injected class, attempt the same test and observe it is impossible without either `@ExtendWith(MockitoExtension.class)` combined with `@InjectMocks`/reflection tricks, or starting a full `@SpringBootTest` context — measure and note the difference in test execution time between the two approaches.

---

## 12. Interview Q&A

**Q: What are the three ways to perform dependency injection in Spring, and which is recommended?**
Answer: Spring supports constructor injection, setter injection, and field injection. Constructor injection is the recommended default because it allows dependencies to be declared `final` (enforcing immutability), guarantees the object is fully wired the instant it is constructed (no partially-initialized state), makes all dependencies visible in one place (the constructor signature), and allows trivial unit testing via plain `new ClassUnderTest(mocks...)` without needing Spring at all. Setter injection is reserved for genuinely optional dependencies, and field injection is discouraged across the board because it hides dependencies, prevents `final` fields, and makes testing without a full Spring context difficult.

**Q: Explain the order in which Spring resolves an @Autowired dependency when multiple beans match the required type.**
Answer: Spring first attempts to resolve strictly by type; if exactly one bean matches, it is injected immediately. If multiple beans match, Spring next checks for an `@Qualifier` annotation at the injection point and matches it against candidate bean names/qualifier values. If no qualifier is present, Spring checks whether exactly one of the candidates is marked `@Primary` and uses that one. If still ambiguous, Spring falls back to matching the candidate bean's name against the field or parameter name as a last resort. If none of these steps disambiguates the candidates, the context fails to start with `NoUniqueBeanDefinitionException`.

**Q: How would you resolve a scenario where two implementations of the same interface both need to be injectable, but at different call sites you need different ones?**
Answer: Use `@Qualifier` at each injection point to name the specific bean required — for example, `@Qualifier("emailChannel")` on one constructor parameter and `@Qualifier("smsChannel")` on another, referencing the default bean names (or an explicit `@Qualifier` value applied on the component itself). If one implementation is the sensible default across most of the application, mark it `@Primary` so injection points that do not care can omit the qualifier entirely, reserving explicit `@Qualifier` annotations only for the call sites that need the non-default implementation.

**Q: What causes a circular dependency error in Spring, and how can it be resolved?**
Answer: A circular dependency occurs when two or more beans require each other, directly or transitively, through constructor injection — since constructing either bean requires the other to already fully exist, and constructor calls are atomic, the container cannot satisfy either constructor first, producing a `BeanCurrentlyInCreationException`. It can be resolved mechanically by switching one side to setter injection (which runs after both raw instances already exist) or by injecting one dependency wrapped in `@Lazy` (deferring resolution to first use via a proxy). However, both are workarounds; the underlying issue is almost always a design smell indicating that responsibilities should be split into a third component or that the interaction should be event-driven rather than a direct bidirectional call.

**Q: How do you inject every implementation of an interface, and how do you control the order they are provided in?**
Answer: Declaring an injection point as `List<InterfaceType>` (or `Map<String, InterfaceType>` to get them keyed by bean name) causes Spring to gather every bean implementing that interface and inject them together, which is the standard pattern for strategy, validator-chain, or plugin-style designs. The iteration order of the injected `List<T>` is otherwise undefined and should never be assumed stable; controlling it requires each implementing bean to declare an explicit `@Order` annotation (or implement the `Ordered` interface), which Spring honors when constructing the list.

**Q: What is the difference between @Autowired(required = false) and injecting a dependency as Optional<T>?**
Answer: Both allow the application context to start successfully even when no matching bean exists, rather than failing with `NoSuchBeanDefinitionException`. `@Autowired(required = false)` leaves the field or parameter simply `null` if absent, which places the burden on the consuming code to remember to null-check it. `Optional<T>` is generally preferred in modern code because the type itself communicates that the dependency may be absent, and forces callers to explicitly handle the empty case (e.g., via `.ifPresent()` or `.orElse()`) rather than risking a silent `NullPointerException` from a forgotten null check.
