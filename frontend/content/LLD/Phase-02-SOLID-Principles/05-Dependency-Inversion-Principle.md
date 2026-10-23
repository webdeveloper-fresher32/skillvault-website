# Dependency Inversion Principle (DIP) in Java — Complete Guide

## Table of Contents
1. [Core Definition: High-Level vs Low-Level Modules](#1-core-definition-high-level-vs-low-level-modules)
2. [The Inversion Mental Shift: Who Owns the Abstraction?](#2-the-inversion-mental-shift-who-owns-the-abstraction)
3. [The Anti-Pattern: Concrete Database Coupling](#3-the-anti-pattern-concrete-database-coupling)
4. [The Fix: Abstract Repository & Inversion of Control](#4-the-fix-abstract-repository--inversion-of-control)
5. [Real-World Example: Notification Dispatch Architecture](#5-real-world-example-notification-dispatch-architecture)
6. [DIP vs DI vs IoC: Demystifying the Terminology](#6-dip-vs-di-vs-ioc-demystifying-the-terminology)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Core Definition: High-Level vs Low-Level Modules

> *"High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details. Details should depend on abstractions."* — Robert C. Martin

- **High-level module**: Contains core business logic and domain rules (e.g., `OrderService`, `PricingEngine`).
- **Low-level module**: Handles infrastructure details (e.g., `PostgresSqlDriver`, `SmtpClient`, `KafkaProducer`).

---

## 2. The Inversion Mental Shift: Who Owns the Abstraction?

```
TRADITIONAL COUPLING (No Inversion):
┌──────────────────────────┐
│  OrderService (Domain)   │ ──depends on──▶ ┌──────────────────────────┐
└──────────────────────────┘                 │  MySqlDatabase (Infra)   │
                                             └──────────────────────────┘

DEPENDENCY INVERSION (Inverted Flow):
┌──────────────────────────┐
│  OrderService (Domain)   │ ──depends on──▶ ┌──────────────────────────┐
└──────────────────────────┘                 │  OrderRepository (Contract)
                                             └─────────────▲────────────┘
                                                           │ implements
                                             ┌─────────────┴────────────┐
                                             │  MySqlOrderRepository    │
                                             └──────────────────────────┘
```

The domain layer owns the repository contract interface. The infrastructure layer depends inward on the domain contract!

---

## 3. The Anti-Pattern: Concrete Database Coupling

```java
// ❌ BAD: High-level business class directly instantiates low-level driver!
public class PasswordResetService {
    private final MySqlDatabase database; // Concrete dependency!

    public PasswordResetService() {
        this.database = new MySqlDatabase("jdbc:mysql://localhost:3306/db");
    }

    public void reset(String email) {
        database.updateUserPassword(email, "hashedPassword");
    }
}
```

---

## 4. The Fix: Abstract Repository & Inversion of Control

```java
// 1. Contract Abstraction (Belongs to domain)
public interface UserRepository {
    void updatePassword(String email, String newPasswordHash);
}

// 2. High-level module depends ONLY on abstraction
public class PasswordResetService {
    private final UserRepository userRepository;

    // Dependency injected from outside!
    public PasswordResetService(UserRepository userRepository) {
        this.userRepository = Objects.requireNonNull(userRepository);
    }

    public void reset(String email, String rawPassword) {
        String hash = hashPassword(rawPassword);
        userRepository.updatePassword(email, hash);
    }

    private String hashPassword(String pass) { return "hash_" + pass; }
}

// 3. Low-level concrete implementation
public class MySqlUserRepository implements UserRepository {
    @Override
    public void updatePassword(String email, String newPasswordHash) {
        System.out.println("Executing SQL UPDATE for: " + email);
    }
}
```

---

## 5. Real-World Example: Notification Dispatch Architecture

```java
public interface NotificationSender {
    void sendNotification(String to, String message);
}

public class OrderNotificationManager {
    private final NotificationSender sender;

    public OrderNotificationManager(NotificationSender sender) {
        this.sender = sender;
    }

    public void alertUser(String to, String orderId) {
        sender.sendNotification(to, "Order " + orderId + " is confirmed!");
    }
}

// Swappable without changing a single line in OrderNotificationManager:
NotificationSender emailSender = (to, msg) -> System.out.println("Email: " + msg);
NotificationSender smsSender = (to, msg) -> System.out.println("SMS: " + msg);
NotificationSender slackSender = (to, msg) -> System.out.println("Slack: " + msg);
```

---

## 6. DIP vs DI vs IoC: Demystifying the Terminology

```
┌─────────────────────────────────────────────────────────────┐
│ Dependency Inversion Principle (DIP): High-level guideline │
│ High-level policy decoupled from low-level detail.          │
├─────────────────────────────────────────────────────────────┤
│ Inversion of Control (IoC): Architectural pattern           │
│ The framework controls execution flow, not your program.    │
├─────────────────────────────────────────────────────────────┤
│ Dependency Injection (DI): Specific implementation design   │
│ Passing dependencies in constructor / setter.               │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Interview Q&A

**Q: Does DIP require using a Dependency Injection framework like Spring?**  
*Answer:* No. DIP is a design principle. It can be implemented cleanly using standard Java constructors (pure DI) by instantiating dependencies in your application entry point (`main()` method or composition root) and passing them into dependent services.
