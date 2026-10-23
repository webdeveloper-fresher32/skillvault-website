# Project 4 — E-commerce Product Catalog (Specifications, Pagination, Full Test Suite)

**Level:** Intermediate-Advanced
**Time estimate:** 3 – 4 hours
**Phase prerequisites:** Phase 8 – Testing, Phase 9 – Advanced Data

---

## Overview

You will build a `Product` catalog API with dynamic, composable search: any combination of category, price range, and in-stock filters, expressed as JPA `Specification`s so the query builds itself based on which parameters are present. Results are paginated and sortable via Spring Data's `Pageable`, and list views return a lightweight DTO **projection** instead of the full entity.

The centrepiece of this project is the **test pyramid**: unit tests for the service (Mockito), a slice test for the repository/specifications (`@DataJpaTest`), a slice test for the controller (`@WebMvcTest`), and a full integration test (`@SpringBootTest`) running against a real PostgreSQL container via **Testcontainers**.

---

## Prerequisites

- Completed Project 2 or 3 (JPA + service layer)
- Docker installed and running (required for Testcontainers)
- JDK 17+, Maven

---

## Project Structure

```
04-ecommerce-catalog/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/com/skillvault/catalog/
    │   │   ├── CatalogApplication.java
    │   │   ├── controller/
    │   │   │   └── ProductController.java
    │   │   ├── dto/
    │   │   │   ├── ProductRequest.java
    │   │   │   ├── ProductResponse.java
    │   │   │   └── ProductSummary.java
    │   │   ├── entity/
    │   │   │   ├── Product.java
    │   │   │   └── Category.java
    │   │   ├── repository/
    │   │   │   ├── ProductRepository.java
    │   │   │   └── ProductSpecifications.java
    │   │   ├── service/
    │   │   │   └── ProductService.java
    │   │   └── exception/
    │   │       └── ResourceNotFoundException.java
    │   └── resources/
    │       └── application.yml
    └── test/
        ├── java/com/skillvault/catalog/
        │   ├── service/ProductServiceTest.java
        │   ├── repository/ProductRepositoryTest.java
        │   ├── controller/ProductControllerTest.java
        │   └── integration/ProductCatalogIntegrationTest.java
        └── resources/
            └── application-test.yml
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
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
  <dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
  </dependency>
  <dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>test</scope>
  </dependency>

  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
  </dependency>
  <dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
```

### Step 2 — Entities

```java
package com.skillvault.catalog.entity;

public enum Category {
    ELECTRONICS, BOOKS, CLOTHING, HOME, TOYS
}
```

```java
package com.skillvault.catalog.entity;

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

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Category category;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private int stockQuantity;

    protected Product() {}

    public Product(String name, String description, Category category, BigDecimal price, int stockQuantity) {
        this.name = name;
        this.description = description;
        this.category = category;
        this.price = price;
        this.stockQuantity = stockQuantity;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public int getStockQuantity() { return stockQuantity; }
    public void setStockQuantity(int stockQuantity) { this.stockQuantity = stockQuantity; }
}
```

### Step 3 — Repository and Specifications

```java
package com.skillvault.catalog.repository;

import com.skillvault.catalog.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
}
```

`repository/ProductSpecifications.java` — each method returns a `Specification<Product>` (or `null`, which `Specification.where(null)` treats as "no filter") so callers can `.and()` them together conditionally.

```java
package com.skillvault.catalog.repository;

import com.skillvault.catalog.entity.Category;
import com.skillvault.catalog.entity.Product;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;

public final class ProductSpecifications {

    private ProductSpecifications() {}

    public static Specification<Product> hasCategory(Category category) {
        if (category == null) return null;
        return (root, query, cb) -> cb.equal(root.get("category"), category);
    }

    public static Specification<Product> priceGreaterThanOrEqual(BigDecimal min) {
        if (min == null) return null;
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("price"), min);
    }

    public static Specification<Product> priceLessThanOrEqual(BigDecimal max) {
        if (max == null) return null;
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("price"), max);
    }

    public static Specification<Product> inStockOnly(Boolean inStockOnly) {
        if (inStockOnly == null || !inStockOnly) return null;
        return (root, query, cb) -> cb.greaterThan(root.get("stockQuantity"), 0);
    }

    public static Specification<Product> nameContains(String term) {
        if (term == null || term.isBlank()) return null;
        return (root, query, cb) -> cb.like(cb.lower(root.get("name")), "%" + term.toLowerCase() + "%");
    }

    /** Combines every filter, skipping nulls, into a single AND-composed Specification. */
    public static Specification<Product> build(Category category, BigDecimal minPrice, BigDecimal maxPrice,
                                                 Boolean inStockOnly, String nameTerm) {
        return Specification.where(hasCategory(category))
            .and(priceGreaterThanOrEqual(minPrice))
            .and(priceLessThanOrEqual(maxPrice))
            .and(inStockOnly(inStockOnly))
            .and(nameContains(nameTerm));
    }
}
```

### Step 4 — DTOs (note the `ProductSummary` projection for list views)

```java
package com.skillvault.catalog.dto;

import com.skillvault.catalog.entity.Category;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record ProductRequest(
    @NotBlank @Size(max = 200) String name,
    @Size(max = 2000) String description,
    @NotNull Category category,
    @NotNull @DecimalMin("0.01") BigDecimal price,
    @NotNull @Min(0) Integer stockQuantity
) {}
```

```java
package com.skillvault.catalog.dto;

import com.skillvault.catalog.entity.Category;
import com.skillvault.catalog.entity.Product;
import java.math.BigDecimal;

public record ProductResponse(Long id, String name, String description, Category category,
                               BigDecimal price, int stockQuantity) {
    public static ProductResponse from(Product p) {
        return new ProductResponse(p.getId(), p.getName(), p.getDescription(), p.getCategory(), p.getPrice(), p.getStockQuantity());
    }
}
```

```java
package com.skillvault.catalog.dto;

import com.skillvault.catalog.entity.Category;
import com.skillvault.catalog.entity.Product;
import java.math.BigDecimal;

// Lightweight projection for list/search results — omits description to reduce payload size
public record ProductSummary(Long id, String name, Category category, BigDecimal price, boolean inStock) {
    public static ProductSummary from(Product p) {
        return new ProductSummary(p.getId(), p.getName(), p.getCategory(), p.getPrice(), p.getStockQuantity() > 0);
    }
}
```

### Step 5 — Service layer

```java
package com.skillvault.catalog.service;

import com.skillvault.catalog.dto.ProductRequest;
import com.skillvault.catalog.entity.Category;
import com.skillvault.catalog.entity.Product;
import com.skillvault.catalog.exception.ResourceNotFoundException;
import com.skillvault.catalog.repository.ProductRepository;
import com.skillvault.catalog.repository.ProductSpecifications;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public Product getById(Long id) {
        return productRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Product " + id + " not found"));
    }

    public Page<Product> search(Category category, BigDecimal minPrice, BigDecimal maxPrice,
                                 Boolean inStockOnly, String nameTerm, Pageable pageable) {
        var spec = ProductSpecifications.build(category, minPrice, maxPrice, inStockOnly, nameTerm);
        return productRepository.findAll(spec, pageable);
    }

    @Transactional
    public Product create(ProductRequest request) {
        return productRepository.save(new Product(
            request.name(), request.description(), request.category(),
            request.price(), request.stockQuantity()));
    }

    @Transactional
    public Product update(Long id, ProductRequest request) {
        Product product = getById(id);
        product.setName(request.name());
        product.setDescription(request.description());
        product.setCategory(request.category());
        product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity());
        return product;
    }

    @Transactional
    public void delete(Long id) {
        productRepository.delete(getById(id));
    }
}
```

### Step 6 — Exception and Controller

```java
package com.skillvault.catalog.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) { super(message); }
}
```

```java
package com.skillvault.catalog.controller;

import com.skillvault.catalog.dto.ProductRequest;
import com.skillvault.catalog.dto.ProductResponse;
import com.skillvault.catalog.dto.ProductSummary;
import com.skillvault.catalog.entity.Category;
import com.skillvault.catalog.service.ProductService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public Page<ProductSummary> search(
            @RequestParam(required = false) Category category,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Boolean inStockOnly,
            @RequestParam(required = false) String name,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {

        return productService.search(category, minPrice, maxPrice, inStockOnly, name, pageable)
            .map(ProductSummary::from);
    }

    @GetMapping("/{id}")
    public ProductResponse getProduct(@PathVariable Long id) {
        return ProductResponse.from(productService.getById(id));
    }

    @PostMapping
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        var saved = productService.create(request);
        return ResponseEntity.status(201).body(ProductResponse.from(saved));
    }

    @PutMapping("/{id}")
    public ProductResponse update(@PathVariable Long id, @Valid @RequestBody ProductRequest request) {
        return ProductResponse.from(productService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        productService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

### Step 7 — Application configuration

`src/main/resources/application.yml`

```yaml
server:
  port: 8080

spring:
  application:
    name: ecommerce-catalog
  datasource:
    url: jdbc:postgresql://localhost:5432/catalogdb
    username: catalog
    password: catalog
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
```

### Step 8 — Unit test (Mockito, no Spring context)

`src/test/java/com/skillvault/catalog/service/ProductServiceTest.java`

```java
package com.skillvault.catalog.service;

import com.skillvault.catalog.dto.ProductRequest;
import com.skillvault.catalog.entity.Category;
import com.skillvault.catalog.entity.Product;
import com.skillvault.catalog.exception.ResourceNotFoundException;
import com.skillvault.catalog.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private ProductService productService;

    @Test
    void getById_returnsProduct_whenFound() {
        Product product = new Product("Kindle", "E-reader", Category.ELECTRONICS, new BigDecimal("99.99"), 5);
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        Product result = productService.getById(1L);

        assertThat(result.getName()).isEqualTo("Kindle");
    }

    @Test
    void getById_throws_whenNotFound() {
        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.getById(99L))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("99");
    }

    @Test
    void create_savesAndReturnsProduct() {
        var request = new ProductRequest("Mug", "Ceramic mug", Category.HOME, new BigDecimal("9.99"), 100);
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));

        Product result = productService.create(request);

        assertThat(result.getName()).isEqualTo("Mug");
        assertThat(result.getStockQuantity()).isEqualTo(100);
        verify(productRepository).save(any(Product.class));
    }
}
```

### Step 9 — Repository/Specification slice test

`src/test/java/com/skillvault/catalog/repository/ProductRepositoryTest.java`

```java
package com.skillvault.catalog.repository;

import com.skillvault.catalog.entity.Category;
import com.skillvault.catalog.entity.Product;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest // loads only the JPA slice — an in-memory H2 database backs this test
class ProductRepositoryTest {

    @Autowired
    private ProductRepository productRepository;

    @BeforeEach
    void seed() {
        productRepository.save(new Product("Laptop", "15-inch", Category.ELECTRONICS, new BigDecimal("1200.00"), 3));
        productRepository.save(new Product("Novel", "Fiction", Category.BOOKS, new BigDecimal("15.00"), 0));
        productRepository.save(new Product("Headphones", "Wireless", Category.ELECTRONICS, new BigDecimal("80.00"), 10));
    }

    @Test
    void build_filtersByCategoryAndInStock() {
        var spec = ProductSpecifications.build(Category.ELECTRONICS, null, null, true, null);

        var page = productRepository.findAll(spec, PageRequest.of(0, 10));

        assertThat(page.getContent()).hasSize(2)
            .extracting(Product::getName)
            .containsExactlyInAnyOrder("Laptop", "Headphones");
    }

    @Test
    void build_filtersByPriceRange() {
        var spec = ProductSpecifications.build(null, new BigDecimal("50"), new BigDecimal("500"), null, null);

        var page = productRepository.findAll(spec, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(Product::getName).containsExactly("Headphones");
    }

    @Test
    void build_filtersByNameTerm_caseInsensitive() {
        var spec = ProductSpecifications.build(null, null, null, null, "NOVEL");

        var page = productRepository.findAll(spec, PageRequest.of(0, 10));

        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).getName()).isEqualTo("Novel");
    }
}
```

### Step 10 — Controller slice test

`src/test/java/com/skillvault/catalog/controller/ProductControllerTest.java`

```java
package com.skillvault.catalog.controller;

import com.skillvault.catalog.entity.Category;
import com.skillvault.catalog.entity.Product;
import com.skillvault.catalog.service.ProductService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProductController.class) // loads only the web slice — no real database
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProductService productService;

    @Test
    void search_returnsPagedSummaries() throws Exception {
        var product = new Product("Tablet", "10-inch", Category.ELECTRONICS, new BigDecimal("300.00"), 5);
        var page = new PageImpl<>(List.of(product), PageRequest.of(0, 20), 1);

        when(productService.search(any(), any(), any(), any(), any(), any())).thenReturn(page);

        mockMvc.perform(get("/api/products").param("category", "ELECTRONICS"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].name").value("Tablet"))
            .andExpect(jsonPath("$.content[0].inStock").value(true));
    }
}
```

### Step 11 — Full integration test with Testcontainers

`src/test/java/com/skillvault/catalog/integration/ProductCatalogIntegrationTest.java`

```java
package com.skillvault.catalog.integration;

import com.skillvault.catalog.dto.ProductRequest;
import com.skillvault.catalog.entity.Category;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProductCatalogIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
        .withDatabaseName("catalogdb_test")
        .withUsername("test")
        .withPassword("test");

    @DynamicPropertySource
    static void registerPgProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void createThenSearchProduct_endToEndAgainstRealPostgres() {
        var request = new ProductRequest("Camera", "Mirrorless", Category.ELECTRONICS, new BigDecimal("650.00"), 4);

        var createResponse = restTemplate.postForEntity("/api/products", request, Object.class);
        assertThat(createResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        var searchResponse = restTemplate.getForEntity(
            "/api/products?category=ELECTRONICS&inStockOnly=true", Object.class);
        assertThat(searchResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
```

### Step 12 — Run the test pyramid

```bash
# Unit + slice tests (fast, no Docker needed for these three)
./mvnw test -Dtest=ProductServiceTest,ProductRepositoryTest,ProductControllerTest

# Full integration test (spins up a real Postgres container — requires Docker running)
./mvnw test -Dtest=ProductCatalogIntegrationTest

# Everything
./mvnw test
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| App starts against Postgres | `./mvnw spring-boot:run` (with local Postgres running) | Starts on port 8080 |
| Create a product | `curl -i -X POST http://localhost:8080/api/products -H "Content-Type: application/json" -d '{"name":"Kettle","category":"HOME","price":25.00,"stockQuantity":10}'` | `201 Created` |
| Search by category + price range | `curl -s "http://localhost:8080/api/products?category=HOME&minPrice=10&maxPrice=50"` | JSON page containing "Kettle" |
| Search with no filters returns all | `curl -s "http://localhost:8080/api/products" \| jq .totalElements` | Count of all products |
| Pagination works | `curl -s "http://localhost:8080/api/products?size=1&page=0" \| jq '.content \| length'` | `1` |
| Unit tests pass | `./mvnw test -Dtest=ProductServiceTest` | `BUILD SUCCESS` |
| Repository slice tests pass | `./mvnw test -Dtest=ProductRepositoryTest` | `BUILD SUCCESS`, 3 tests green |
| Testcontainers integration test passes | `./mvnw test -Dtest=ProductCatalogIntegrationTest` | Docker container starts, `BUILD SUCCESS` |

---

## Stretch Goals

1. **Full-text search** — add a Postgres `tsvector` column and a native query for relevance-ranked name/description search.
2. **Sort whitelisting** — validate the `sort` query parameter against an allow-list of fields to prevent clients from sorting on unindexed or sensitive columns.
3. **ETags for caching** — return an `ETag` header on `GET /api/products/{id}` and honor `If-None-Match` with `304 Not Modified`.
4. **Bulk import** — add `POST /api/products/bulk` accepting a CSV/JSON array, validating each row, and reporting per-row success/failure.
5. **Contract test with Testcontainers + Flyway** — add Flyway migrations and assert the integration test runs schema migrations automatically against the containerised Postgres instance.
