# Project 5 — Order Processing System (Caching, Async, Scheduled Jobs)

**Level:** Advanced
**Time estimate:** 3 – 4 hours
**Phase prerequisite:** Phase 10 – Caching and Async

---

## Overview

You will extend an Order Processing API with three cross-cutting performance and reliability patterns:

1. **Caching** — `@Cacheable` around product lookups so repeated reads during checkout skip the database; `@CacheEvict` invalidates the entry when stock changes.
2. **Async processing** — `@Async` fires an order-confirmation "email" (simulated) without blocking the HTTP response to the customer.
3. **Scheduled jobs** — a `@Scheduled` cron task compiles a nightly sales report from the day's orders.

You will configure a dedicated `TaskExecutor` for async work (never rely on the common `ForkJoinPool` for I/O-bound tasks) and reason about when a cache entry must be evicted.

---

## Prerequisites

- Completed Project 2 or 4 (JPA + service layer)
- JDK 17+, Maven

---

## Project Structure

```
05-order-processing/
├── pom.xml
└── src/
    └── main/
        ├── java/com/skillvault/orders/
        │   ├── OrderProcessingApplication.java
        │   ├── config/
        │   │   ├── CacheConfig.java
        │   │   ├── AsyncConfig.java
        │   │   └── SchedulingConfig.java
        │   ├── controller/
        │   │   └── OrderController.java
        │   ├── dto/
        │   │   ├── OrderRequest.java
        │   │   ├── OrderItemRequest.java
        │   │   └── OrderResponse.java
        │   ├── entity/
        │   │   ├── Product.java
        │   │   ├── Order.java
        │   │   ├── OrderItem.java
        │   │   └── OrderStatus.java
        │   ├── repository/
        │   │   ├── ProductRepository.java
        │   │   └── OrderRepository.java
        │   ├── service/
        │   │   ├── ProductLookupService.java
        │   │   ├── OrderService.java
        │   │   ├── EmailService.java
        │   │   └── NightlyReportService.java
        │   └── exception/
        │       └── ResourceNotFoundException.java
        └── resources/
            └── application.yml
```

---

## Step-by-Step Instructions

### Step 1 — Dependencies

```xml
<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
  <dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
  </dependency>
  <dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
```

### Step 2 — Enable caching, async, and scheduling

`OrderProcessingApplication.java`

```java
package com.skillvault.orders;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableCaching
@EnableAsync
@EnableScheduling
public class OrderProcessingApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderProcessingApplication.class, args);
    }
}
```

### Step 3 — Cache configuration (Caffeine, with a sensible TTL)

`config/CacheConfig.java`

```java
package com.skillvault.orders.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class CacheConfig {

    public static final String PRODUCTS_CACHE = "products";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(PRODUCTS_CACHE);
        manager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(500)
            .expireAfterWrite(10, TimeUnit.MINUTES)
            .recordStats());
        return manager;
    }
}
```

### Step 4 — Dedicated async executor (never use the common ForkJoinPool for I/O)

`config/AsyncConfig.java`

```java
package com.skillvault.orders.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
public class AsyncConfig {

    @Bean(name = "emailTaskExecutor")
    public Executor emailTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("email-async-");
        executor.initialize();
        return executor;
    }
}
```

`config/SchedulingConfig.java` (optional dedicated scheduler pool — keeps the single default scheduler thread from being a bottleneck if you add more jobs later)

```java
package com.skillvault.orders.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class SchedulingConfig {

    @Bean
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("scheduled-task-");
        return scheduler;
    }
}
```

### Step 5 — Entities

```java
package com.skillvault.orders.entity;

public enum OrderStatus {
    PLACED, CONFIRMED, CANCELLED
}
```

```java
package com.skillvault.orders.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private int stockQuantity;

    protected Product() {}

    public Product(String name, BigDecimal price, int stockQuantity) {
        this.name = name;
        this.price = price;
        this.stockQuantity = stockQuantity;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public BigDecimal getPrice() { return price; }
    public int getStockQuantity() { return stockQuantity; }
    public void setStockQuantity(int stockQuantity) { this.stockQuantity = stockQuantity; }
}
```

```java
package com.skillvault.orders.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String customerEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status = OrderStatus.PLACED;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false, updatable = false)
    private Instant placedAt = Instant.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    protected Order() {}

    public Order(String customerEmail, BigDecimal totalAmount) {
        this.customerEmail = customerEmail;
        this.totalAmount = totalAmount;
    }

    public Long getId() { return id; }
    public String getCustomerEmail() { return customerEmail; }
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus status) { this.status = status; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public Instant getPlacedAt() { return placedAt; }
    public List<OrderItem> getItems() { return items; }
    public void addItem(OrderItem item) { items.add(item); item.setOrder(this); }
}
```

```java
package com.skillvault.orders.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    protected OrderItem() {}

    public OrderItem(Product product, int quantity, BigDecimal unitPrice) {
        this.product = product;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    public Long getId() { return id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public Product getProduct() { return product; }
    public int getQuantity() { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
}
```

### Step 6 — Repositories

```java
package com.skillvault.orders.repository;

import com.skillvault.orders.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {}
```

```java
package com.skillvault.orders.repository;

import com.skillvault.orders.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByPlacedAtBetween(Instant start, Instant end);
}
```

### Step 7 — Cached product lookup service

`service/ProductLookupService.java`

```java
package com.skillvault.orders.service;

import com.skillvault.orders.config.CacheConfig;
import com.skillvault.orders.entity.Product;
import com.skillvault.orders.exception.ResourceNotFoundException;
import com.skillvault.orders.repository.ProductRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductLookupService {

    private final ProductRepository productRepository;

    public ProductLookupService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    /**
     * Cached — repeated lookups of the same product during checkout skip the database.
     * Key is the productId argument by default (Spring's SimpleKeyGenerator).
     */
    @Cacheable(cacheNames = CacheConfig.PRODUCTS_CACHE, key = "#productId")
    public Product findById(Long productId) {
        return productRepository.findById(productId)
            .orElseThrow(() -> new ResourceNotFoundException("Product " + productId + " not found"));
    }

    /**
     * Stock changed — evict so the next read reflects the true quantity.
     * Without this, a stale stockQuantity could stay cached for up to the TTL configured in CacheConfig.
     */
    @CacheEvict(cacheNames = CacheConfig.PRODUCTS_CACHE, key = "#productId")
    @Transactional
    public void decrementStock(Long productId, int quantity) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ResourceNotFoundException("Product " + productId + " not found"));
        product.setStockQuantity(product.getStockQuantity() - quantity);
    }
}
```

### Step 8 — Async email service

`service/EmailService.java`

```java
package com.skillvault.orders.service;

import com.skillvault.orders.entity.Order;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    // Runs on the "emailTaskExecutor" pool — the HTTP thread that placed the order
    // returns to the client immediately without waiting for this to finish.
    @Async("emailTaskExecutor")
    public void sendOrderConfirmation(Order order) {
        simulateSlowEmailProvider();
        log.info("Order confirmation email sent to {} for order #{} (total: {})",
            order.getCustomerEmail(), order.getId(), order.getTotalAmount());
    }

    private void simulateSlowEmailProvider() {
        try {
            Thread.sleep(1500); // simulate network latency to a third-party email API
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

### Step 9 — Order service tying it together

`dto/OrderItemRequest.java`, `dto/OrderRequest.java`, `dto/OrderResponse.java`:

```java
package com.skillvault.orders.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record OrderItemRequest(@NotNull Long productId, @Min(1) int quantity) {}
```

```java
package com.skillvault.orders.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record OrderRequest(
    @Email String customerEmail,
    @NotEmpty @Valid List<OrderItemRequest> items
) {}
```

```java
package com.skillvault.orders.dto;

import com.skillvault.orders.entity.Order;
import com.skillvault.orders.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record OrderResponse(Long id, String customerEmail, OrderStatus status, BigDecimal totalAmount, Instant placedAt) {
    public static OrderResponse from(Order order) {
        return new OrderResponse(order.getId(), order.getCustomerEmail(), order.getStatus(), order.getTotalAmount(), order.getPlacedAt());
    }
}
```

`service/OrderService.java`

```java
package com.skillvault.orders.service;

import com.skillvault.orders.dto.OrderRequest;
import com.skillvault.orders.entity.Order;
import com.skillvault.orders.entity.OrderItem;
import com.skillvault.orders.entity.Product;
import com.skillvault.orders.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductLookupService productLookupService;
    private final EmailService emailService;

    public OrderService(OrderRepository orderRepository, ProductLookupService productLookupService,
                         EmailService emailService) {
        this.orderRepository = orderRepository;
        this.productLookupService = productLookupService;
        this.emailService = emailService;
    }

    @Transactional
    public Order placeOrder(OrderRequest request) {
        BigDecimal total = BigDecimal.ZERO;
        Order order = new Order(request.customerEmail(), BigDecimal.ZERO);

        for (var itemRequest : request.items()) {
            // Cached read — the first lookup per product hits the DB, subsequent ones in
            // the same TTL window are served from Caffeine.
            Product product = productLookupService.findById(itemRequest.productId());
            BigDecimal lineTotal = product.getPrice().multiply(BigDecimal.valueOf(itemRequest.quantity()));
            total = total.add(lineTotal);

            order.addItem(new OrderItem(product, itemRequest.quantity(), product.getPrice()));
            productLookupService.decrementStock(product.getId(), itemRequest.quantity());
        }

        setTotal(order, total);
        Order saved = orderRepository.save(order);

        // Fire-and-forget: the customer gets their 201 response immediately;
        // the email goes out on the emailTaskExecutor pool in the background.
        emailService.sendOrderConfirmation(saved);

        return saved;
    }

    private void setTotal(Order order, BigDecimal total) {
        // Order's totalAmount field is set via reflection-free approach in real code you'd
        // add a setter; kept minimal here for brevity.
        try {
            var field = Order.class.getDeclaredField("totalAmount");
            field.setAccessible(true);
            field.set(order, total);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
```

> In real code, add a proper `setTotalAmount` setter to `Order` instead of the reflection shown above — it's included here only to keep the entity listing short. Prefer explicit setters or a builder in your own implementation.

### Step 10 — Nightly scheduled report

`service/NightlyReportService.java`

```java
package com.skillvault.orders.service;

import com.skillvault.orders.entity.Order;
import com.skillvault.orders.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class NightlyReportService {

    private static final Logger log = LoggerFactory.getLogger(NightlyReportService.class);

    private final OrderRepository orderRepository;

    public NightlyReportService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    // Runs every day at 23:55 server time. Cron: sec min hour day month weekday.
    @Scheduled(cron = "0 55 23 * * *")
    public void generateNightlyReport() {
        LocalDate today = LocalDate.now();
        Instant start = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Order> todaysOrders = orderRepository.findByPlacedAtBetween(start, end);
        BigDecimal totalRevenue = todaysOrders.stream()
            .map(Order::getTotalAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        log.info("=== Nightly Sales Report for {} ===", today);
        log.info("Orders placed: {}", todaysOrders.size());
        log.info("Total revenue: {}", totalRevenue);
    }
}
```

### Step 11 — Controller and configuration

```java
package com.skillvault.orders.controller;

import com.skillvault.orders.dto.OrderRequest;
import com.skillvault.orders.dto.OrderResponse;
import com.skillvault.orders.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<OrderResponse> placeOrder(@Valid @RequestBody OrderRequest request) {
        var saved = orderService.placeOrder(request);
        return ResponseEntity.status(201).body(OrderResponse.from(saved));
    }
}
```

`src/main/resources/application.yml`

```yaml
server:
  port: 8080

spring:
  application:
    name: order-processing
  datasource:
    url: jdbc:h2:mem:ordersdb;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
  cache:
    type: caffeine
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Place an order | `curl -i -X POST http://localhost:8080/api/orders -H "Content-Type: application/json" -d '{"customerEmail":"a@b.com","items":[{"productId":1,"quantity":2}]}'` | `201 Created`, HTTP response returns before the 1.5s simulated email send completes |
| Async confirms in background | Check application logs a moment after the response returns | `email-async-N` thread logs "Order confirmation email sent" |
| Caching reduces DB hits | Enable `show-sql: true`, place two orders for the same `productId` within 10 minutes | Second order's product lookup shows no new `SELECT` for that product |
| Cache eviction on stock change | Place an order, then immediately re-check the product's stock via a debug endpoint or H2 console | Stock reflects the decrement, not a stale cached value |
| Scheduled job fires | Temporarily set cron to `"*/10 * * * * *"` (every 10s) for local testing, then watch logs | "Nightly Sales Report" logged every 10 seconds |
| Executor thread name | Inspect log output during order placement | Thread name prefix `email-async-`, not `ForkJoinPool` |

---

## Stretch Goals

1. **Cache statistics endpoint** — expose Caffeine's `recordStats()` hit/miss ratio via a custom Actuator endpoint or a debug REST endpoint.
2. **Retry on email failure** — wrap `EmailService` with Spring Retry (`@Retryable`) so a transient failure retries up to 3 times with backoff before giving up.
3. **CompletableFuture return type** — change `sendOrderConfirmation` to return `CompletableFuture<Void>` and have the controller optionally wait on it via a `?sync=true` query parameter for testing.
4. **Weekly report** — add a second `@Scheduled` job with `cron = "0 0 6 * * MON"` that aggregates the past 7 days and emails it to an admin address.
5. **Cache warm-up** — add an `ApplicationRunner` that pre-populates the products cache with the top 20 best-selling items at startup.
