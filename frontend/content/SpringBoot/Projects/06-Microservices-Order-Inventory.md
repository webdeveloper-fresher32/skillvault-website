# Project 6 — Microservices: Order + Inventory (Capstone)

**Level:** Advanced (Capstone)
**Time estimate:** 5 – 7 hours
**Phase prerequisite:** Phase 11-12 – Microservices Basics & Production/Actuator

---

## Overview

You will split a single-service order system into two independently deployable Spring Boot services:

1. **`inventory-service`** — owns product stock data and exposes a REST endpoint to check/reserve stock.
2. **`order-service`** — accepts order requests, calls `inventory-service` over `WebClient` to check stock before confirming an order, and wraps that inter-service call in a Resilience4j `@CircuitBreaker` with a fallback method so an Inventory outage degrades gracefully instead of cascading into failed orders.

Both services expose Spring Boot Actuator `/actuator/health` and `/actuator/metrics`, and each ships with its own multi-stage `Dockerfile`, wired together with a `docker-compose.yml`. This capstone ties together REST, data access, resilience, and containerised deployment from across the whole course.

---

## Prerequisites

- Completed Project 2 or 5 (JPA + service layer)
- JDK 17+, Maven
- Docker and Docker Compose installed locally
- Basic familiarity with `WebClient` (Phase 11) and Resilience4j (Phase 9/11)

---

## Project Structure

```
06-microservices-order-inventory/
├── docker-compose.yml
├── inventory-service/
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/skillvault/inventory/
│       │   ├── InventoryServiceApplication.java
│       │   ├── controller/
│       │   │   └── InventoryController.java
│       │   ├── dto/
│       │   │   ├── StockCheckResponse.java
│       │   │   └── ReserveStockRequest.java
│       │   ├── entity/
│       │   │   └── InventoryItem.java
│       │   ├── repository/
│       │   │   └── InventoryItemRepository.java
│       │   ├── service/
│       │   │   └── InventoryService.java
│       │   └── exception/
│       │       └── InsufficientStockException.java
│       └── resources/
│           └── application.yml
└── order-service/
    ├── pom.xml
    ├── Dockerfile
    └── src/main/
        ├── java/com/skillvault/orders/
        │   ├── OrderServiceApplication.java
        │   ├── config/
        │   │   └── WebClientConfig.java
        │   ├── controller/
        │   │   └── OrderController.java
        │   ├── dto/
        │   │   ├── OrderRequest.java
        │   │   ├── OrderResponse.java
        │   │   └── StockCheckResponse.java
        │   ├── entity/
        │   │   ├── Order.java
        │   │   └── OrderStatus.java
        │   ├── repository/
        │   │   └── OrderRepository.java
        │   ├── service/
        │   │   ├── InventoryClient.java
        │   │   └── OrderService.java
        │   └── exception/
        │       └── OrderRejectedException.java
        └── resources/
            └── application.yml
```

---

## Step-by-Step Instructions

### Step 1 — Inventory Service dependencies

`inventory-service/pom.xml`

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
    <artifactId>spring-boot-starter-actuator</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
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

### Step 2 — Inventory entity, repository, and exception

`inventory-service/src/main/java/com/skillvault/inventory/entity/InventoryItem.java`

```java
package com.skillvault.inventory.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "inventory_items")
public class InventoryItem {

    @Id
    private Long productId;

    @Column(nullable = false, length = 200)
    private String productName;

    @Column(nullable = false)
    private int availableQuantity;

    protected InventoryItem() {}

    public InventoryItem(Long productId, String productName, int availableQuantity) {
        this.productId = productId;
        this.productName = productName;
        this.availableQuantity = availableQuantity;
    }

    public Long getProductId() { return productId; }
    public String getProductName() { return productName; }
    public int getAvailableQuantity() { return availableQuantity; }
    public void setAvailableQuantity(int availableQuantity) { this.availableQuantity = availableQuantity; }
}
```

`inventory-service/src/main/java/com/skillvault/inventory/repository/InventoryItemRepository.java`

```java
package com.skillvault.inventory.repository;

import com.skillvault.inventory.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {}
```

`inventory-service/src/main/java/com/skillvault/inventory/exception/InsufficientStockException.java`

```java
package com.skillvault.inventory.exception;

public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(String message) {
        super(message);
    }
}
```

### Step 3 — Inventory DTOs, service, and controller

`inventory-service/src/main/java/com/skillvault/inventory/dto/StockCheckResponse.java`

```java
package com.skillvault.inventory.dto;

public record StockCheckResponse(Long productId, String productName, int availableQuantity, boolean inStock) {}
```

`inventory-service/src/main/java/com/skillvault/inventory/dto/ReserveStockRequest.java`

```java
package com.skillvault.inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ReserveStockRequest(@NotNull Long productId, @Min(1) int quantity) {}
```

`inventory-service/src/main/java/com/skillvault/inventory/service/InventoryService.java`

```java
package com.skillvault.inventory.service;

import com.skillvault.inventory.dto.StockCheckResponse;
import com.skillvault.inventory.entity.InventoryItem;
import com.skillvault.inventory.exception.InsufficientStockException;
import com.skillvault.inventory.repository.InventoryItemRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {

    private final InventoryItemRepository repository;

    public InventoryService(InventoryItemRepository repository) {
        this.repository = repository;
    }

    public StockCheckResponse checkStock(Long productId, int requestedQuantity) {
        InventoryItem item = repository.findById(productId)
            .orElseThrow(() -> new EntityNotFoundException("Product " + productId + " not found in inventory"));
        boolean inStock = item.getAvailableQuantity() >= requestedQuantity;
        return new StockCheckResponse(item.getProductId(), item.getProductName(), item.getAvailableQuantity(), inStock);
    }

    @Transactional
    public void reserveStock(Long productId, int quantity) {
        InventoryItem item = repository.findById(productId)
            .orElseThrow(() -> new EntityNotFoundException("Product " + productId + " not found in inventory"));
        if (item.getAvailableQuantity() < quantity) {
            throw new InsufficientStockException(
                "Only " + item.getAvailableQuantity() + " units of product " + productId + " available");
        }
        item.setAvailableQuantity(item.getAvailableQuantity() - quantity);
    }
}
```

`inventory-service/src/main/java/com/skillvault/inventory/controller/InventoryController.java`

```java
package com.skillvault.inventory.controller;

import com.skillvault.inventory.dto.ReserveStockRequest;
import com.skillvault.inventory.dto.StockCheckResponse;
import com.skillvault.inventory.service.InventoryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping("/{productId}/check")
    public ResponseEntity<StockCheckResponse> checkStock(@PathVariable Long productId,
                                                           @RequestParam(defaultValue = "1") int quantity) {
        return ResponseEntity.ok(inventoryService.checkStock(productId, quantity));
    }

    @PostMapping("/reserve")
    public ResponseEntity<Void> reserveStock(@Valid @RequestBody ReserveStockRequest request) {
        inventoryService.reserveStock(request.productId(), request.quantity());
        return ResponseEntity.noContent().build();
    }
}
```

`inventory-service/src/main/resources/application.yml`

```yaml
server:
  port: 8081

spring:
  application:
    name: inventory-service
  datasource:
    url: jdbc:h2:mem:inventorydb;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
  sql:
    init:
      mode: always

management:
  endpoints:
    web:
      exposure:
        include: health,metrics,info
  endpoint:
    health:
      show-details: always
```

`inventory-service/src/main/resources/data.sql` (seed data so `/check` has something to return)

```sql
INSERT INTO inventory_items (product_id, product_name, available_quantity) VALUES (1, 'Wireless Mouse', 50);
INSERT INTO inventory_items (product_id, product_name, available_quantity) VALUES (2, 'Mechanical Keyboard', 5);
```

### Step 4 — Order Service dependencies

`order-service/pom.xml`

```xml
<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
    <!-- brings WebClient; the service itself still runs as a servlet MVC app -->
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
  <dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
    <version>2.2.0</version>
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

### Step 5 — Order entity, repository, and DTOs

`order-service/src/main/java/com/skillvault/orders/entity/OrderStatus.java`

```java
package com.skillvault.orders.entity;

public enum OrderStatus {
    CONFIRMED, REJECTED_OUT_OF_STOCK, REJECTED_INVENTORY_UNAVAILABLE
}
```

`order-service/src/main/java/com/skillvault/orders/entity/Order.java`

```java
package com.skillvault.orders.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long productId;

    @Column(nullable = false)
    private int quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private OrderStatus status;

    @Column(nullable = false, updatable = false)
    private Instant placedAt = Instant.now();

    protected Order() {}

    public Order(Long productId, int quantity, OrderStatus status) {
        this.productId = productId;
        this.quantity = quantity;
        this.status = status;
    }

    public Long getId() { return id; }
    public Long getProductId() { return productId; }
    public int getQuantity() { return quantity; }
    public OrderStatus getStatus() { return status; }
    public Instant getPlacedAt() { return placedAt; }
}
```

`order-service/src/main/java/com/skillvault/orders/repository/OrderRepository.java`

```java
package com.skillvault.orders.repository;

import com.skillvault.orders.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {}
```

`order-service/src/main/java/com/skillvault/orders/dto/OrderRequest.java`

```java
package com.skillvault.orders.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record OrderRequest(@NotNull Long productId, @Min(1) int quantity) {}
```

`order-service/src/main/java/com/skillvault/orders/dto/OrderResponse.java`

```java
package com.skillvault.orders.dto;

import com.skillvault.orders.entity.Order;
import com.skillvault.orders.entity.OrderStatus;

import java.time.Instant;

public record OrderResponse(Long id, Long productId, int quantity, OrderStatus status, Instant placedAt) {
    public static OrderResponse from(Order order) {
        return new OrderResponse(order.getId(), order.getProductId(), order.getQuantity(),
            order.getStatus(), order.getPlacedAt());
    }
}
```

`order-service/src/main/java/com/skillvault/orders/dto/StockCheckResponse.java` (mirrors the Inventory Service's response shape — kept as a local DTO so the two services stay independently deployable)

```java
package com.skillvault.orders.dto;

public record StockCheckResponse(Long productId, String productName, int availableQuantity, boolean inStock) {}
```

### Step 6 — WebClient configuration

`order-service/src/main/java/com/skillvault/orders/config/WebClientConfig.java`

```java
package com.skillvault.orders.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient inventoryWebClient(@Value("${inventory.service.base-url}") String baseUrl) {
        return WebClient.builder()
            .baseUrl(baseUrl)
            .build();
    }
}
```

### Step 7 — Inventory client with circuit breaker and fallback

`order-service/src/main/java/com/skillvault/orders/service/InventoryClient.java`

```java
package com.skillvault.orders.service;

import com.skillvault.orders.dto.StockCheckResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class InventoryClient {

    private static final Logger log = LoggerFactory.getLogger(InventoryClient.class);

    private final WebClient inventoryWebClient;

    public InventoryClient(WebClient inventoryWebClient) {
        this.inventoryWebClient = inventoryWebClient;
    }

    // "inventoryService" is the Resilience4j instance name — its rules live in application.yml.
    // Any exception the WebClient call throws (timeout, connection refused, 5xx) trips the
    // breaker and, once it opens, short-circuits straight to the fallback without calling out.
    @CircuitBreaker(name = "inventoryService", fallbackMethod = "checkStockFallback")
    public StockCheckResponse checkStock(Long productId, int quantity) {
        return inventoryWebClient.get()
            .uri(uriBuilder -> uriBuilder
                .path("/api/inventory/{productId}/check")
                .queryParam("quantity", quantity)
                .build(productId))
            .retrieve()
            .bodyToMono(StockCheckResponse.class)
            .block();
    }

    // Fallback signature must match the original method's params plus a Throwable.
    // We fail closed: treat an unreachable Inventory Service as "not in stock" rather
    // than blindly confirming an order we can't actually verify.
    private StockCheckResponse checkStockFallback(Long productId, int quantity, Throwable throwable) {
        log.warn("Inventory Service unavailable for product {} — failing closed. Cause: {}",
            productId, throwable.toString());
        return new StockCheckResponse(productId, "unknown", 0, false);
    }
}
```

### Step 8 — Order service and controller

`order-service/src/main/java/com/skillvault/orders/exception/OrderRejectedException.java`

```java
package com.skillvault.orders.exception;

public class OrderRejectedException extends RuntimeException {
    public OrderRejectedException(String message) {
        super(message);
    }
}
```

`order-service/src/main/java/com/skillvault/orders/service/OrderService.java`

```java
package com.skillvault.orders.service;

import com.skillvault.orders.dto.OrderRequest;
import com.skillvault.orders.dto.StockCheckResponse;
import com.skillvault.orders.entity.Order;
import com.skillvault.orders.entity.OrderStatus;
import com.skillvault.orders.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final InventoryClient inventoryClient;

    public OrderService(OrderRepository orderRepository, InventoryClient inventoryClient) {
        this.orderRepository = orderRepository;
        this.inventoryClient = inventoryClient;
    }

    @Transactional
    public Order placeOrder(OrderRequest request) {
        StockCheckResponse stock = inventoryClient.checkStock(request.productId(), request.quantity());

        OrderStatus status = stock.inStock() ? OrderStatus.CONFIRMED : OrderStatus.REJECTED_OUT_OF_STOCK;
        Order order = new Order(request.productId(), request.quantity(), status);
        return orderRepository.save(order);
    }
}
```

`order-service/src/main/java/com/skillvault/orders/controller/OrderController.java`

```java
package com.skillvault.orders.controller;

import com.skillvault.orders.dto.OrderRequest;
import com.skillvault.orders.dto.OrderResponse;
import com.skillvault.orders.entity.OrderStatus;
import com.skillvault.orders.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public ResponseEntity<OrderResponse> placeOrder(@Valid @RequestBody OrderRequest request) {
        var order = orderService.placeOrder(request);
        var response = OrderResponse.from(order);
        var httpStatus = order.getStatus() == OrderStatus.CONFIRMED ? HttpStatus.CREATED : HttpStatus.CONFLICT;
        return ResponseEntity.status(httpStatus).body(response);
    }
}
```

`order-service/src/main/resources/application.yml`

```yaml
server:
  port: 8080

spring:
  application:
    name: order-service
  datasource:
    url: jdbc:h2:mem:ordersdb;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true

inventory:
  service:
    base-url: http://localhost:8081

management:
  endpoints:
    web:
      exposure:
        include: health,metrics,info
  endpoint:
    health:
      show-details: always

resilience4j:
  circuitbreaker:
    instances:
      inventoryService:
        registerHealthIndicator: true
        sliding-window-type: COUNT_BASED
        sliding-window-size: 10
        minimum-number-of-calls: 5
        failure-rate-threshold: 50
        wait-duration-in-open-state: 10s
        permitted-number-of-calls-in-half-open-state: 3
        automatic-transition-from-open-to-half-open-enabled: true
    instances-timeout:
      inventoryService:
        timeout-duration: 3s
```

> In Docker Compose, `inventory.service.base-url` is overridden to `http://inventory-service:8081` (Compose's internal DNS) via an environment variable — see Step 10.

### Step 9 — Multi-stage Dockerfiles

`inventory-service/Dockerfile`

```dockerfile
# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# ---- Run stage ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
```

`order-service/Dockerfile`

```dockerfile
# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# ---- Run stage ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Step 10 — Wire both services together with Docker Compose

`docker-compose.yml`

```yaml
services:
  inventory-service:
    build: ./inventory-service
    ports:
      - "8081:8081"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8081/actuator/health"]
      interval: 10s
      timeout: 3s
      retries: 5

  order-service:
    build: ./order-service
    ports:
      - "8080:8080"
    environment:
      - INVENTORY_SERVICE_BASE-URL=http://inventory-service:8081
    depends_on:
      inventory-service:
        condition: service_healthy
```

> Spring's relaxed environment-variable binding maps `INVENTORY_SERVICE_BASE-URL` to the `inventory.service.base-url` property — double-check the exact env var name against your Spring Boot version's binding rules, or override with `SPRING_APPLICATION_JSON` if you hit binding issues.

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Both services start | `docker compose up --build` | Both containers report healthy; logs show `Started InventoryServiceApplication` and `Started OrderServiceApplication` |
| Inventory health | `curl http://localhost:8081/actuator/health` | `{"status":"UP"}` |
| Order health | `curl http://localhost:8080/actuator/health` | `{"status":"UP"}`, includes a `circuitBreakers` health indicator for `inventoryService` |
| Stock check | `curl "http://localhost:8081/api/inventory/1/check?quantity=2"` | `{"productId":1,"productName":"Wireless Mouse","availableQuantity":50,"inStock":true}` |
| Confirmed order | `curl -i -X POST http://localhost:8080/api/orders -H "Content-Type: application/json" -d '{"productId":1,"quantity":2}'` | `201 Created`, `status: CONFIRMED` |
| Rejected — out of stock | Same request with `{"productId":2,"quantity":50}` (only 5 available) | `409 Conflict`, `status: REJECTED_OUT_OF_STOCK` |
| Circuit breaker opens | `docker compose stop inventory-service`, then place 5+ orders in a row | After the failure-rate threshold is hit, calls short-circuit instantly (no 3s WebClient timeout wait) and log the fallback warning |
| Metrics show breaker state | `curl http://localhost:8080/actuator/metrics/resilience4j.circuitbreaker.state` | Metric present with a `CLOSED`/`OPEN`/`HALF_OPEN` tag reflecting current state |

---

## Stretch Goals

1. **Reserve stock after confirmation** — after a `CONFIRMED` order, call Inventory's `POST /api/inventory/reserve` (also via the circuit-breaker-wrapped client) to actually decrement stock, and compensate (mark the order `REJECTED_INVENTORY_UNAVAILABLE`) if the reserve call fails after the check succeeded.
2. **Bulkhead + retry** — add a Resilience4j `@Retry` (2 attempts, exponential backoff) in front of the `@CircuitBreaker`, and a `@Bulkhead` to cap concurrent in-flight calls to Inventory Service.
3. **Service discovery** — replace the hardcoded `inventory.service.base-url` with Eureka or Spring Cloud Kubernetes service discovery so Order Service resolves Inventory Service by logical name.
4. **Distributed tracing** — add Micrometer Tracing + a Zipkin/OTel exporter so a single order's trace shows both the Order Service span and the downstream Inventory Service span.
5. **Contract testing** — add a Spring Cloud Contract or Pact test between the two services so a breaking change to Inventory's `/check` response shape fails CI before it ever reaches production.
