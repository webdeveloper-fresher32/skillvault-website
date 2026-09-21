# Dependency Injection and Inversion of Control in Java LLD

## Table of Contents
1. [The Problem: Hardcoded Concrete Instantiation](#1-the-problem-hardcoded-concrete-instantiation)
2. [Constructor vs Setter vs Field Injection](#2-constructor-vs-setter-vs-field-injection)
3. [Building a Pure Java IoC Container From Scratch](#3-building-a-pure-java-ioc-container-from-scratch)
4. [Testability: Swapping Mocks & Fakes Effortlessly](#4-testability-swapping-mocks--fakes-effortlessly)
5. [Real-World Example: Order Checkout Architecture](#5-real-world-example-order-checkout-architecture)
6. [Design Trade-offs Matrix](#6-design-trade-offs-matrix)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Hardcoded Concrete Instantiation

When classes instantiate their own dependencies using `new ConcreteService()`, they violate the **Dependency Inversion Principle (DIP)**. The high-level module is tightly coupled to low-level implementation details.

```
❌ Tight Coupling (Hardcoded new):
┌───────────────────────────────────────┐
│ public class OrderService {           │
│     private PaymentGateway gateway =  │
│         new StripePaymentGateway();   │ // Can NEVER test with a mock!
│ }                                     │ // Can NEVER switch to PayPal!
└───────────────────────────────────────┘

✅ Inversion of Control (Constructor DI):
┌───────────────────────────────────────┐
│ public class OrderService {           │
│     private final PaymentGateway      │
│             gateway;                  │
│     public OrderService(              │ // High-level module depends on
│         PaymentGateway gateway) {     │ // abstraction, injected from outside!
│         this.gateway = gateway;       │
│     }                                 │
│ }                                     │
└───────────────────────────────────────┘
```

---

## 2. Constructor vs Setter vs Field Injection

| Injection Type | Thread-Safety & Immutability | Testability | Recommended? |
| :--- | :--- | :--- | :--- |
| **Constructor Injection** | ✅ **Guaranteed** (fields are `final`) | ✅ **Trivial** (pass mocks in `new`) | ⭐ **Industry Standard** |
| **Setter Injection** | ❌ Mutable after construction | ⚠️ Possible, but prone to `NullPointerException` if setter forgotten | ⚠️ Use only for optional dependencies |
| **Field Injection** (`@Autowired`) | ❌ Requires reflection framework | ❌ Painful to test without Spring context | 🛑 **Anti-pattern** in modern design |

---

## 3. Building a Pure Java IoC Container From Scratch

In machine coding rounds, you cannot rely on Spring Boot. Showing the interviewer how a lightweight DI container works in 30 lines of pure Java is an immediate hire signal:

```java
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

public class SimpleContainer {
    private final Map<Class<?>, Supplier<?>> registry = new ConcurrentHashMap<>();
    private final Map<Class<?>, Object> singletons = new ConcurrentHashMap<>();

    // Register a transient component provider
    public <T> void registerTransient(Class<T> type, Supplier<T> supplier) {
        registry.put(type, supplier);
    }

    // Register a singleton component
    public <T> void registerSingleton(Class<T> type, Supplier<T> supplier) {
        registry.put(type, () -> singletons.computeIfAbsent(type, k -> supplier.get()));
    }

    // Resolve dependency
    @SuppressWarnings("unchecked")
    public <T> T resolve(Class<T> type) {
        Supplier<?> supplier = registry.get(type);
        if (supplier == null) {
            throw new IllegalArgumentException("No registration found for: " + type.getName());
        }
        return (T) supplier.get();
    }
}
```

---

## 4. Testability: Swapping Mocks & Fakes Effortlessly

With constructor injection, writing unit tests requires zero mock frameworks:

```java
// Testing with a simple Fake:
class FakePaymentGateway implements PaymentGateway {
    public boolean processPaymentCalled = false;

    @Override
    public boolean processPayment(double amount) {
        this.processPaymentCalled = true;
        return true; // Simulate 100% success for test
    }
}

// Unit test:
void testOrderCheckout() {
    FakePaymentGateway fakeGateway = new FakePaymentGateway();
    OrderService service = new OrderService(fakeGateway);
    service.checkout("ORD-1", 100.0);
    assert fakeGateway.processPaymentCalled == true;
}
```

---

## 5. Real-World Example: Order Checkout Architecture

```java
public interface PaymentGateway {
    boolean charge(String customerId, double amount);
}

public interface InventoryService {
    boolean reserveStock(String sku, int quantity);
}

public interface NotificationGateway {
    void sendReceipt(String email, String orderId);
}

// Concrete Service with pure constructor DI
public class CheckoutService {
    private final PaymentGateway paymentGateway;
    private final InventoryService inventoryService;
    private final NotificationGateway notificationGateway;

    public CheckoutService(
        PaymentGateway paymentGateway,
        InventoryService inventoryService,
        NotificationGateway notificationGateway
    ) {
        this.paymentGateway = Objects.requireNonNull(paymentGateway);
        this.inventoryService = Objects.requireNonNull(inventoryService);
        this.notificationGateway = Objects.requireNonNull(notificationGateway);
    }

    public boolean processCheckout(String orderId, String customerId, String sku, int qty, double amount, String email) {
        if (!inventoryService.reserveStock(sku, qty)) {
            System.err.println("Stock unavailable for: " + sku);
            return false;
        }

        if (!paymentGateway.charge(customerId, amount)) {
            System.err.println("Payment failed for customer: " + customerId);
            return false;
        }

        notificationGateway.sendReceipt(email, orderId);
        return true;
    }
}
```

---

## 6. Design Trade-offs Matrix

```
                      DEPENDENCY INJECTION
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
  PROS:                                           CONS:
  • Decoupled modular classes                    • Boilerplate parameter passing
  • 100% Mockable in unit tests                  • Assembly root required
  • Single Responsibility Principle              • Slight startup configuration overhead
```

---

## 7. Interview Q&A

**Q: What is the difference between Inversion of Control (IoC) and Dependency Injection (DI)?**  
*Answer:* IoC is the broad architectural principle where the control flow of a program is inverted (the framework or runtime calls your code, e.g., the Hollywood Principle: "Don't call us, we'll call you"). Dependency Injection is a specific design pattern implementing IoC for dependency resolution, where an external entity injects dependencies into a class rather than the class creating them itself.

**Q: Why should field injection (`@Autowired private MyService myService;`) be avoided?**  
*Answer:* Field injection bypasses constructors, making fields non-final (mutability risk), hides dependencies from class consumers, and makes unit testing impossible without starting a heavy reflection container or mocking framework.
