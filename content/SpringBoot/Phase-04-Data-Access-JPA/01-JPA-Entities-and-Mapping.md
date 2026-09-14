# JPA Entities and Mapping — Complete Guide

## Table of Contents
1. [What JPA and Hibernate Actually Are](#1-what-jpa-and-hibernate-actually-are)
2. [Declaring an Entity — @Entity, @Table, @Id, @GeneratedValue](#2-declaring-an-entity--entity-table-id-generatedvalue)
3. [Mapping Columns — @Column and Basic Types](#3-mapping-columns--column-and-basic-types)
4. [Embeddables — @Embeddable and @Embedded](#4-embeddables--embeddable-and-embedded)
5. [Relationship Mappings Overview](#5-relationship-mappings-overview)
6. [@ManyToOne and @OneToMany](#6-manytoone-and-onetomany)
7. [@OneToOne](#7-onetoone)
8. [@ManyToMany](#8-manytomany)
9. [Fetch Types — LAZY vs EAGER](#9-fetch-types--lazy-vs-eager)
10. [Cascade Types](#10-cascade-types)
11. [Bidirectional vs Unidirectional Relationships and mappedBy](#11-bidirectional-vs-unidirectional-relationships-and-mappedby)
12. [equals() and hashCode() Pitfalls](#12-equals-and-hashcode-pitfalls)
13. [Worked Example — Customer / Order / OrderItem](#13-worked-example--customer--order--orderitem)
14. [Common Pitfalls](#14-common-pitfalls)
15. [Best Practices](#15-best-practices)
16. [Hands-On Exercises](#16-hands-on-exercises)
17. [Interview Q&A](#17-interview-qa)

---

## 1. What JPA and Hibernate Actually Are

JPA (Jakarta Persistence API, formerly Java Persistence API) is a **specification** — a set of interfaces and annotations (`jakarta.persistence.*`) that describe how Java objects map to relational database rows. JPA itself contains no implementation. Hibernate is the most common **implementation** of that specification, and it is what Spring Boot pulls in by default via the `spring-boot-starter-data-jpa` dependency.

```
  Your Code (annotated entities, repositories)
          │
          ▼
  JPA Specification (jakarta.persistence.* — the contract)
          │
          ▼
  Hibernate (the implementation that does the actual work)
          │
          ▼
  JDBC Driver
          │
          ▼
  Database (MySQL, PostgreSQL, etc.)
```

Spring Data JPA sits on top of both: it is a Spring project that generates repository implementations at runtime, using JPA/Hibernate underneath to talk to the database. Understanding this layering matters because error messages sometimes come from Hibernate directly (e.g., `org.hibernate.LazyInitializationException`) rather than from Spring.

An **entity** is a plain Java class annotated with `@Entity` whose instances correspond to rows in a database table. The **persistence context** (covered in depth in lesson 3) is the in-memory area, managed per-transaction, where Hibernate tracks entity instances and their state.

---

## 2. Declaring an Entity — @Entity, @Table, @Id, @GeneratedValue

Every JPA entity needs:
- `@Entity` on the class
- A no-argument constructor (JPA/Hibernate creates instances via reflection)
- A field annotated `@Id` that maps to the primary key
- The class must not be `final`, and the `@Id` field's getter/setter must not be `final` either (Hibernate builds runtime proxies by subclassing)

```java
import jakarta.persistence.*;

@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(unique = true, nullable = false)
    private String email;

    protected Customer() {
        // required no-arg constructor for JPA
    }

    public Customer(String fullName, String email) {
        this.fullName = fullName;
        this.email = email;
    }

    // getters and setters omitted for brevity
}
```

`@Table(name = "customers")` is optional — if omitted, Hibernate derives the table name from the class name (`Customer` → `customer` by default, though the exact naming strategy is configurable). Being explicit is good practice once a project has more than a handful of entities.

### @GeneratedValue Strategies

| Strategy    | Behavior                                                                                     | Typical Use |
|-------------|-----------------------------------------------------------------------------------------------|-------------|
| `IDENTITY`  | Delegates to the database's auto-increment column (`AUTO_INCREMENT` in MySQL, `SERIAL` in Postgres). Simple, but disables JDBC batch inserts because Hibernate must execute the INSERT to learn the generated id. | MySQL-backed apps, simplicity over batch-insert performance |
| `SEQUENCE`  | Uses a database sequence object to pre-allocate ids. Hibernate can fetch ids in the JVM before the INSERT, enabling batching. Requires database support for sequences (PostgreSQL, Oracle). | PostgreSQL/Oracle, high-throughput batch inserts |
| `TABLE`     | Simulates a sequence using a dedicated database table. Portable across databases but slower due to extra locking/row updates. | Rare — only when neither IDENTITY nor SEQUENCE is viable |
| `AUTO`      | Lets the JPA provider pick a strategy based on the database dialect. Convenient but less predictable across databases. | Prototypes, database-agnostic code |

```java
// SEQUENCE strategy with explicit sequence generator (PostgreSQL)
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "customer_seq")
@SequenceGenerator(name = "customer_seq", sequenceName = "customer_id_seq", allocationSize = 50)
private Long id;
```

`allocationSize = 50` tells Hibernate to grab a block of 50 ids from the sequence at once and hand them out in memory, drastically reducing round trips to the database under high insert volume — as long as your actual DB sequence increment matches (or you accept gaps).

---

## 3. Mapping Columns — @Column and Basic Types

`@Column` controls how a field maps to its database column. All attributes are optional; without `@Column`, Hibernate uses the field name and infers sensible defaults.

```java
@Column(name = "created_at", nullable = false, updatable = false)
private LocalDateTime createdAt;

@Column(precision = 10, scale = 2, nullable = false)
private BigDecimal price;

@Column(length = 500)
private String description;

@Lob
@Column(columnDefinition = "TEXT")
private String notes;

@Enumerated(EnumType.STRING)
@Column(nullable = false)
private OrderStatus status;
```

Key attributes:

| Attribute     | Purpose                                                              |
|---------------|-----------------------------------------------------------------------|
| `name`        | Explicit column name, overriding the default (field name)             |
| `nullable`    | Adds a `NOT NULL` constraint at schema-generation time                |
| `unique`      | Adds a unique constraint                                               |
| `length`      | Column length for `VARCHAR` (default 255)                             |
| `precision`/`scale` | Numeric precision for `BigDecimal`/`DECIMAL` columns              |
| `updatable`   | If `false`, the column is excluded from UPDATE statements (useful for `createdAt`) |
| `insertable`  | If `false`, the column is excluded from INSERT statements             |

**Always use `@Enumerated(EnumType.STRING)`** for enum fields. The default, `EnumType.ORDINAL`, stores the enum's integer position — if someone reorders or inserts a new constant in the enum later, every existing row silently maps to the wrong value. `STRING` stores the readable name (`"SHIPPED"`) and is immune to reordering, at the cost of a few extra bytes per row.

`java.time` types (`LocalDate`, `LocalDateTime`, `Instant`) are mapped automatically since JPA 2.2 / Hibernate 5+ — no converter needed in modern Spring Boot 3.

---

## 4. Embeddables — @Embeddable and @Embedded

Not every concept in your domain needs to be its own entity with its own table and identity. A value object — like an address, a monetary amount, or a name — that has no independent identity and always belongs to exactly one owner is a good candidate for `@Embeddable`.

```java
@Embeddable
public class Address {

    @Column(name = "street")
    private String street;

    @Column(name = "city")
    private String city;

    @Column(name = "postal_code")
    private String postalCode;

    @Column(name = "country")
    private String country;

    protected Address() {}

    public Address(String street, String city, String postalCode, String country) {
        this.street = street;
        this.city = city;
        this.postalCode = postalCode;
        this.country = country;
    }

    // getters, equals, hashCode
}
```

```java
@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fullName;

    @Embedded
    private Address shippingAddress;

    // ...
}
```

An `@Embeddable` has no `@Id` and no table of its own — its columns (`street`, `city`, `postal_code`, `country`) are folded directly into the `customers` table. This avoids an unnecessary join for data that is always accessed together with its owner and never queried independently. If you need the *same* embeddable type twice on one entity (e.g. both `billingAddress` and `shippingAddress`), use `@AttributeOverrides` to avoid column name collisions:

```java
@Embedded
@AttributeOverrides({
    @AttributeOverride(name = "street", column = @Column(name = "billing_street")),
    @AttributeOverride(name = "city", column = @Column(name = "billing_city"))
})
private Address billingAddress;
```

Use an `@Embeddable` when the object has no identity of its own and is never fetched independently. Use a separate `@Entity` (with a relationship) when the object needs its own identity, its own lifecycle, or must be queried directly.

---

## 5. Relationship Mappings Overview

JPA models the four classic relational cardinalities:

```
  @ManyToOne     Many Orders  ───────▶  One Customer     (owning side — has the FK)
  @OneToMany     One Customer ───────▶  Many Orders       (inverse side — mappedBy)
  @OneToOne      One Order    ───────▶  One Invoice       (either side can own the FK)
  @ManyToMany    Many Students ◀─────▶ Many Courses       (needs a join table)
```

The single most important rule in JPA relationship mapping: **the side that owns the foreign key is the "owning side."** In a bidirectional relationship, exactly one side owns the FK column and the other side is the "inverse" (or "mappedBy") side that merely mirrors it for convenience. Getting this backwards is the single most common source of confusing bugs in JPA — updates made only on the inverse side are silently not persisted.

---

## 6. @ManyToOne and @OneToMany

The most common relationship in any business domain: many child rows referencing one parent row. Each `Order` belongs to one `Customer`; a `Customer` has many `Order`s.

```java
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Owning side: this entity's table holds the foreign key column "customer_id"
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "order_date", nullable = false)
    private LocalDateTime orderDate;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    // getters/setters
}
```

```java
@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fullName;

    // Inverse side: mirrors the relationship, no FK column here
    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Order> orders = new ArrayList<>();

    // getters/setters
}
```

`@ManyToOne` is virtually always the owning side because the "many" table is the one that physically has the foreign key column (`orders.customer_id`). `@OneToMany(mappedBy = "customer")` tells Hibernate: "don't create a join table or a column here — go look at the `customer` field on the `Order` entity to find the FK." The string `"customer"` must exactly match the field name on the other side; it is not type-checked at compile time, so a rename on one side without updating the other fails silently at runtime (or throws a mapping exception at startup, depending on Hibernate version).

`@JoinColumn(name = "customer_id")` on the owning side is optional but recommended for explicitness — without it, Hibernate derives a default column name from the field and the target entity's `@Id`.

---

## 7. @OneToOne

`@OneToOne` models a one-to-one relationship, such as an `Order` and its `Invoice`. Either side can hold the foreign key, but one must be chosen as the owner.

```java
@Entity
@Table(name = "invoices")
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Owning side — invoices table has the "order_id" FK column, and it is unique
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", unique = true, nullable = false)
    private Order order;

    private BigDecimal totalAmount;
}
```

```java
@Entity
@Table(name = "orders")
public class Order {

    // ... other fields ...

    // Inverse side
    @OneToOne(mappedBy = "order", cascade = CascadeType.ALL)
    private Invoice invoice;
}
```

A frequent gotcha: **`@OneToOne` is EAGER by default** in the JPA spec (unlike `@OneToMany`/`@ManyToMany`, which default to LAZY). On the owning side, Hibernate *can* make it lazy via bytecode enhancement, but on the inverse (`mappedBy`) side, true lazy loading is often impossible without extra configuration — Hibernate cannot know whether the related row exists without querying, so it eagerly fetches to populate the reference (or `null`). If you see an unexpected extra `SELECT` per `Order` fetched, a `@OneToOne(mappedBy = ...)` is frequently the cause. Always specify `fetch = FetchType.LAZY` explicitly and verify with SQL logging that it is actually respected for your Hibernate version.

---

## 8. @ManyToMany

`@ManyToMany` requires a join table since neither side can hold a single-valued foreign key.

```java
@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @ManyToMany
    @JoinTable(
        name = "product_tags",
        joinColumns = @JoinColumn(name = "product_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();
}
```

```java
@Entity
@Table(name = "tags")
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @ManyToMany(mappedBy = "tags")
    private Set<Product> products = new HashSet<>();
}
```

`@JoinTable` declares the physical join table `product_tags(product_id, tag_id)`. Only the owning side (`Product` here) declares `@JoinTable`; the inverse side uses `mappedBy`.

If the join table needs extra columns (e.g. `addedAt`, `addedBy`), a plain `@ManyToMany` can no longer represent it — a join table with extra columns needs its own identity, so model it as a separate `@Entity` with two `@ManyToOne` relationships instead (this is the standard "association entity" pattern, e.g. `ProductTagAssignment`).

`Set` is generally preferred over `List` for `@ManyToMany` and `@OneToMany` collections to avoid Hibernate's expensive "delete-all-and-reinsert" behavior that can occur with indexed `List` collections lacking an `@OrderColumn`.

---

## 9. Fetch Types — LAZY vs EAGER

Fetch type controls *when* Hibernate loads the related entity/collection relative to when the owning entity is loaded.

```
  FetchType.EAGER
  ────────────────
  SELECT * FROM orders WHERE id = ?
  → immediately followed by:
  SELECT * FROM customers WHERE id = ?     (even if you never touch order.getCustomer())

  FetchType.LAZY
  ───────────────
  SELECT * FROM orders WHERE id = ?
  → customer field holds an uninitialized proxy
  → SELECT * FROM customers WHERE id = ?   (only fires when order.getCustomer().getName() is called)
```

| Relationship  | JPA Spec Default | Recommended |
|---------------|-------------------|-------------|
| `@ManyToOne`  | EAGER             | **LAZY** (override explicitly) |
| `@OneToOne`   | EAGER             | **LAZY** (override explicitly, verify it works) |
| `@OneToMany`  | LAZY              | LAZY (keep default) |
| `@ManyToMany` | LAZY              | LAZY (keep default) |

The JPA specification's defaults for `@ManyToOne` and `@OneToOne` (EAGER) are widely considered a historical mistake — almost every production Spring Data JPA codebase overrides them to `LAZY` explicitly. EAGER fetching means Hibernate cannot control when the extra query happens; it always happens, whether you need the data or not, and EAGER associations chain — if `Order` eagerly loads `Customer`, and `Customer` eagerly loads `LoyaltyAccount`, one `Order` fetch silently cascades into a chain of joins or queries you didn't ask for.

**The rule of thumb: mark every relationship `FetchType.LAZY` and load what you need explicitly** (via `JOIN FETCH`, `@EntityGraph`, or a DTO projection — covered in lesson 3). This gives you full control over query shape instead of letting the object graph dictate it implicitly.

---

## 10. Cascade Types

Cascade types control which operations performed on the parent entity propagate to related entities.

| Cascade Type | Propagates              | Typical Use |
|--------------|--------------------------|-------------|
| `PERSIST`    | `save()`/insert          | Parent-owned children created together with the parent |
| `MERGE`      | update of detached state | Syncing changes made off-session |
| `REMOVE`     | delete                   | Children with no independent lifecycle (e.g. OrderItems die with the Order) |
| `REFRESH`    | reload from DB           | Rarely used directly |
| `DETACH`     | removal from persistence context | Rarely used directly |
| `ALL`        | all of the above         | Strong parent-owns-child relationships only |

```java
@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
private List<OrderItem> items = new ArrayList<>();
```

`orphanRemoval = true` is a separate, related concept: it means that if an `OrderItem` is *removed from the `items` collection* (not just deleted via `repository.delete()`), Hibernate issues a DELETE for it. This is what makes `order.getItems().remove(item)` actually delete the row from the database. `orphanRemoval` only makes sense on the "one" side of a one-to-many, parent-owns-child relationship — never put it on a `@ManyToMany`, since removing a `Tag` from one `Product`'s tag set should not delete the `Tag` entity (other products may still reference it).

**Never use `CascadeType.ALL` or `CascadeType.REMOVE` on a `@ManyToOne`.** Cascading a remove from `Order` to `Customer` would delete the customer when an order is deleted — almost never the intended behavior. Cascade should flow from the "owning parent" (Customer/Order) down to its exclusively-owned children (OrderItem), not upward or sideways to shared/independent entities.

---

## 11. Bidirectional vs Unidirectional Relationships and mappedBy

A **unidirectional** relationship is navigable in only one direction — e.g., `Order` has a reference to `Customer`, but `Customer` has no `orders` field at all. This is simpler and sufficient when you never need to query "give me all orders for this customer" by navigating the object graph (you'd instead use a repository query).

A **bidirectional** relationship is navigable from both sides — `Order.getCustomer()` and `Customer.getOrders()` both work. Bidirectional relationships require:
1. One owning side (holds the physical FK / join table) and one inverse side (`mappedBy`).
2. **Both sides of the in-memory object graph must be kept in sync manually** — JPA does not do this for you. Setting `order.setCustomer(customer)` alone does *not* add `order` to `customer.getOrders()`. If you forget the other half, the in-memory object graph is inconsistent (even though the database, once flushed, is correct) — this causes bugs in code that reads the collection before a flush/refetch.

The standard fix is a pair of *helper methods* on the owning parent that maintain both sides atomically:

```java
public class Customer {

    private List<Order> orders = new ArrayList<>();

    public void addOrder(Order order) {
        orders.add(order);
        order.setCustomer(this);
    }

    public void removeOrder(Order order) {
        orders.remove(order);
        order.setCustomer(null);
    }
}
```

Callers use `customer.addOrder(order)` instead of manipulating either collection or FK field directly, guaranteeing both sides of the relationship stay consistent in memory, independent of when (or whether) a flush occurs.

---

## 12. equals() and hashCode() Pitfalls

JPA entities are mutable, get their `@Id` assigned only after being persisted (for `IDENTITY`/`SEQUENCE` strategies), and are frequently wrapped in Hibernate proxies — all three facts combine to make `equals()`/`hashCode()` a genuine minefield.

**Pitfall 1: Default Object identity (no override).** Works fine as long as you never compare a "detached-then-reattached" instance to a freshly loaded one representing the same row — but that's a common scenario (e.g., comparing an entity from a `Set` after a round trip through a service layer).

**Pitfall 2: Using all fields (IDE-generated equals/hashCode).** Breaks whenever any field is mutated after the entity is put into a `HashSet`/`HashMap` — the object's hash bucket becomes wrong, and `contains()`/`remove()` silently fail to find it.

**Pitfall 3: Using the `@Id` field, naively.** This looks correct but has a critical trap: **before the entity is persisted, its `id` is `null`.** Two different new (transient) entities both have `id == null`, so a naive `Objects.equals(this.id, other.id)` makes every new entity "equal" to every other new entity — and worse, `hashCode()` returns the same value before and after persistence for the same object, which sounds fine until you realize inserting an entity into a `HashSet` *before* it has an id, then persisting it (which sets the id), leaves the object in the wrong hash bucket for its now-changed hash code.

**The recommended pattern** — business/natural key equality, or a stable constant hash code:

```java
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String orderNumber;  // a stable natural/business key, assigned at creation time

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Order)) return false;
        Order other = (Order) o;
        return orderNumber != null && orderNumber.equals(other.orderNumber);
    }

    @Override
    public int hashCode() {
        // Constant hash code: always correct, just means all Orders land in one bucket
        // (acceptable trade-off — correctness over collection lookup performance)
        return getClass().hashCode();
    }
}
```

If there is truly no natural key available, using a `UUID` field assigned in the constructor (not the DB-generated `@Id`) as the equality key is a common alternative — it is stable across the entity's entire lifecycle, unlike a DB-generated numeric id.

Also beware: **`o instanceof Order` can fail across Hibernate proxy boundaries.** A lazy-loaded reference is often a Hibernate-generated proxy subclass, not literally `Order.class`. Prefer `Hibernate.getClass(o) == Hibernate.getClass(this)` or check `o instanceof Order` (which works fine since proxies extend the entity class) rather than `getClass() == o.getClass()` (which breaks, since the proxy's `getClass()` is the subclass, not `Order.class`).

---

## 13. Worked Example — Customer / Order / OrderItem

A complete, realistic domain model tying together everything above: a `Customer` places `Order`s, each `Order` has many `OrderItem`s, and each `OrderItem` references a `Product`.

```java
@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    @Embedded
    private Address address;

    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Order> orders = new ArrayList<>();

    protected Customer() {}

    public Customer(String fullName, Address address) {
        this.fullName = fullName;
        this.address = address;
    }

    public void addOrder(Order order) {
        orders.add(order);
        order.setCustomer(this);
    }

    public Long getId() { return id; }
    public List<Order> getOrders() { return orders; }
}
```

```java
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    @Column(nullable = false)
    private LocalDateTime orderDate = LocalDateTime.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    protected Order() {}

    public Order(String orderNumber) {
        this.orderNumber = orderNumber;
    }

    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }

    void setCustomer(Customer customer) { this.customer = customer; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Order)) return false;
        return orderNumber.equals(((Order) o).orderNumber);
    }

    @Override
    public int hashCode() { return getClass().hashCode(); }
}
```

```java
@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
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

    void setOrder(Order order) { this.order = order; }
}
```

```java
@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;
}
```

Building the graph in application code, keeping both sides consistent via helper methods:

```java
Customer customer = new Customer("Priya Sharma", new Address("221B Baker St", "London", "NW1", "UK"));

Order order = new Order("ORD-2026-0001");
customer.addOrder(order);   // keeps both sides of Customer<->Order in sync

Product laptop = productRepository.findById(1L).orElseThrow();
order.addItem(new OrderItem(laptop, 1, new BigDecimal("1499.00")));

customerRepository.save(customer);  // cascades PERSIST down to Order and OrderItem
```

Because `Order` and `OrderItem` are cascaded with `CascadeType.ALL` from their respective parents, a single `customerRepository.save(customer)` call is enough to insert all three rows in one transaction — Hibernate walks the object graph and cascades the persist operation.

---

## 14. Common Pitfalls

**Missing or non-public no-arg constructor.** JPA providers instantiate entities via reflection, and Hibernate generates proxy subclasses that need to call `super()`. A missing no-arg constructor (only a parameterized one exists) fails at startup or on first load with an `InstantiationException`. Fix: always declare a `protected` (or `public`) no-arg constructor, even if it's never called directly by your own code.

**Forgetting `mappedBy`, causing a duplicate join table.** If both sides of a `@OneToMany`/`@ManyToOne` declare their own `@JoinColumn` without one side using `mappedBy`, Hibernate may interpret it as two independent, unrelated relationships and generate an unwanted extra join table or column. Fix: exactly one side (the "many" side, holding the physical FK) owns the mapping; the other side always uses `mappedBy` pointing at the owning side's field name.

**Using `List` with `@ManyToMany`/`@OneToMany` and expecting index-stable removals.** Without `@OrderColumn`, a `List` has no persisted ordering, so Hibernate may need to delete and reinsert several rows to remove one element from the middle. Fix: prefer `Set` unless you have added an explicit `@OrderColumn`, or you specifically need positional/duplicate-tolerant semantics.

**EAGER fetch chains blowing up query cost.** A chain of EAGER `@ManyToOne`/`@OneToOne` relationships (Order → Customer → LoyaltyAccount → LoyaltyTier) means loading one Order silently joins/queries three additional tables every single time, even when nothing beyond the Order itself is needed. Fix: default every relationship to `LAZY` and fetch extra data deliberately (see lesson 3).

**IDE-generated `equals()`/`hashCode()` using all fields, including mutable ones.** Putting such an entity into a `HashSet`, then changing a field, corrupts the set's internal bucket — `contains()` returns `false` for an object that is logically still in the set. Fix: base equality on an immutable natural/business key, or a constant hash code with identity-based equals for transient objects.

**Comparing `getClass()` across Hibernate proxies.** `order.getClass() == Order.class` is `false` for a lazily-loaded proxy (its runtime class is a generated subclass like `Order$HibernateProxy$xyz`). Fix: use `instanceof` checks, or `Hibernate.getClass(entity)` for exact type comparisons across proxies.

**Setting only one side of a bidirectional relationship.** Calling `order.setCustomer(customer)` without also adding `order` to `customer.getOrders()` leaves the in-memory graph inconsistent until the next fetch from the database. Fix: use paired helper methods (`addOrder`/`removeOrder`) on the parent that update both sides atomically, and make raw setters package-private or reserve them for JPA/Hibernate's internal use only.

---

## 15. Best Practices

- Default every `@ManyToOne` and `@OneToOne` to `fetch = FetchType.LAZY` explicitly — never rely on the JPA spec's EAGER defaults.
- Use `CascadeType.ALL` + `orphanRemoval = true` only for true parent-owns-child relationships (Order → OrderItem), never for shared/independent entities (Order → Customer, Product → Tag).
- Prefer `@Embeddable` for value objects with no independent identity (Address, Money) instead of promoting everything to a full `@Entity`.
- Always use `@Enumerated(EnumType.STRING)`, never the ordinal default, for any enum-backed column.
- Base `equals()`/`hashCode()` on a stable natural/business key or a constant hash code — never on the auto-generated `@Id` alone or on all mutable fields.
- Keep bidirectional relationships in sync with helper methods on the parent (`addOrder`/`removeOrder`), and make the child-side setter package-private to discourage bypassing them.
- Prefer `Set` over `List` for collection-valued relationships unless you have an explicit ordering requirement backed by `@OrderColumn`.
- Choose `@GeneratedValue` strategy based on your database and batching needs — `IDENTITY` is simplest but disables JDBC insert batching; `SEQUENCE` with a tuned `allocationSize` supports true batch inserts on PostgreSQL/Oracle.
- Keep entities focused on persistence mapping; put domain/business logic in the service layer rather than large method bodies inside entities, unless the logic is a true invariant of the entity itself (e.g., `addItem()` maintaining a bidirectional link).

---

## 16. Hands-On Exercises

**Exercise 1:** Create `Customer`, `Order`, and `OrderItem` entities exactly as shown in section 13, backed by an H2 or PostgreSQL database. Enable SQL logging (`spring.jpa.show-sql=true` and `spring.jpa.properties.hibernate.format_sql=true`). Persist a `Customer` with one `Order` containing two `OrderItem`s using a single `save()` call on the customer repository, relying on cascade. Confirm in the logs that three INSERTs are issued in a single transaction.

**Exercise 2:** Change the `@ManyToOne` on `Order.customer` from `LAZY` to `EAGER` and re-run a `findAll()` on the order repository. Compare the generated SQL before and after — observe the extra join or extra SELECT that EAGER introduces even when you never call `getCustomer()`. Revert to `LAZY`.

**Exercise 3:** Deliberately break `mappedBy` — set both sides of the `Customer`/`Order` relationship to each declare their own `@JoinColumn` (removing `mappedBy` from the `Customer.orders` field). Start the application and observe the schema Hibernate generates (an unexpected extra join table or column). Revert the change and explain in your own words why this happened.

**Exercise 4:** Implement `equals()`/`hashCode()` for `Product` two different ways: (a) using all fields via your IDE's generator, and (b) using a constant hash code with natural-key-based equals. Write a small test that adds a `Product` to a `HashSet`, mutates its `price` field, and then checks `set.contains(product)`. Confirm that approach (a) returns `false` (bug) while approach (b) returns `true` (correct).

**Exercise 5:** Add a `@ManyToMany` relationship between `Product` and a new `Tag` entity, with a `product_tags` join table. Then extend it: give the join table an extra `addedAt` timestamp column, and refactor the `@ManyToMany` into an explicit association entity (`ProductTagAssignment`) with two `@ManyToOne`s, demonstrating why plain `@ManyToMany` cannot carry extra join-table data.

---

## 17. Interview Q&A

**Q: What is the difference between `FetchType.LAZY` and `FetchType.EAGER`, and what are the JPA spec's defaults?**
Answer: `LAZY` defers loading the related entity or collection until it is actually accessed in code, at which point Hibernate issues an additional query (or, for a `@ManyToOne`, initializes a proxy). `EAGER` loads the related data immediately, in the same query (via a join) or via an immediate follow-up query, regardless of whether the code ever uses it. The JPA specification defaults `@OneToMany` and `@ManyToMany` to `LAZY`, but defaults `@ManyToOne` and `@OneToOne` to `EAGER` — a default nearly every production codebase overrides explicitly to `LAZY` on every relationship, because EAGER defaults can silently chain into unnecessary joins across multiple entities.

**Q: What does `mappedBy` do, and which side of a relationship should use it?**
Answer: `mappedBy` marks an entity as the *inverse* (non-owning) side of a bidirectional relationship, pointing at the field name on the *owning* side that actually holds the foreign key or join table. The owning side is the one whose table physically stores the FK column — for `@OneToMany`/`@ManyToOne` pairs, that's always the "many" side (e.g., `Order` owns the `customer_id` column, so `Order.customer` is the owning `@ManyToOne`, and `Customer.orders` is the inverse `@OneToMany(mappedBy = "customer")`). Only the inverse side uses `mappedBy`; forgetting it, or putting it on the wrong side, causes Hibernate to treat both sides as independent relationships and generate an unintended extra join table or column.

**Q: Why is overriding `equals()` and `hashCode()` on JPA entities tricky, and what's the recommended approach?**
Answer: Entities are mutable and their `@Id` is often `null` until the entity is actually persisted (for `IDENTITY`/`SEQUENCE` generation strategies), so id-based or all-field-based equality breaks in common scenarios: two new (transient) entities compare as equal before either has an id, and mutating any field used in an all-fields `hashCode()` after inserting the entity into a `HashSet` corrupts that set's internal bucketing. The recommended approach is to base equality on an immutable natural/business key (like an `orderNumber` or a manually-assigned `UUID`) that is stable for the object's entire lifecycle, paired with a constant `hashCode()` (e.g., `getClass().hashCode()`) — trading some hash-bucket distribution efficiency for guaranteed correctness.

**Q: What is `orphanRemoval`, and how is it different from `CascadeType.REMOVE`?**
Answer: `CascadeType.REMOVE` propagates an explicit `delete()`/`remove()` call on the parent down to its children — deleting the `Order` also deletes its `OrderItem`s. `orphanRemoval = true` is a separate, stronger behavior: it deletes a child *the moment it is removed from the parent's collection*, even if the parent itself is never deleted (e.g., `order.getItems().remove(item)` triggers a DELETE for that `OrderItem` on the next flush). `orphanRemoval` only makes sense for exclusive parent-owns-child relationships and should never be applied to `@ManyToMany`, where a child (like a shared `Tag`) may legitimately still be referenced by other parents.

**Q: When should you use `@Embeddable` instead of a separate `@Entity` with a relationship?**
Answer: Use `@Embeddable` when the object represents a value with no independent identity, is always owned by exactly one parent, and is never fetched or queried on its own — a classic example is an `Address` or a `Money` amount. Its fields are folded directly into the owning entity's table (no separate table, no join, no FK), which is simpler and more efficient than a full entity relationship for data that has no lifecycle of its own. If the object needs its own identity, must be shared across multiple owners, or needs to be queried independently, it should be a full `@Entity` connected via a relationship annotation instead.

**Q: Why does the JPA spec's default `@ManyToOne` EAGER fetch matter in practice, even for a single relationship?**
Answer: Because EAGER fetch types compose: if `Order.customer` is EAGER and `Customer.loyaltyAccount` is also EAGER, then loading a single `Order` transitively triggers loading of the `Customer` and the `LoyaltyAccount`, whether or not the calling code ever needs that data — and this cost is paid on every single fetch of an `Order`, including bulk operations like `findAll()`, where it multiplies across every row. Explicitly setting `fetch = FetchType.LAZY` everywhere puts the decision of what extra data to load in the hands of the query author (via `JOIN FETCH` or `@EntityGraph`), rather than letting the entity's static mapping dictate it implicitly and uniformly for every access path.
