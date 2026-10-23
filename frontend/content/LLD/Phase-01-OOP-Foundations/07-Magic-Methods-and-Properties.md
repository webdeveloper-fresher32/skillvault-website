# Object Methods and Properties in Java: equals, hashCode, and toString

## Table of Contents
1. [The Java Root Class: java.lang.Object](#1-the-java-root-class-javalangobject)
2. [The equals() and hashCode() Contract](#2-the-equals-and-hashcode-contract)
3. [Writing a Bulletproof equals() Implementation](#3-writing-a-bulletproof-equals-implementation)
4. [The toString() Contract for Clean Debugging](#4-the-tostring-contract-for-clean-debugging)
5. [Comparable<T> vs Comparator<T> in Sorting](#5-comparablet-vs-comparatort-in-sorting)
6. [Real-World Domain Model: Product Identity](#6-real-world-domain-model-product-identity)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Java Root Class: java.lang.Object

Every class in Java implicitly extends `java.lang.Object`. The three core methods you must master in LLD interviews are:
- `boolean equals(Object obj)`: Logical equality comparison.
- `int hashCode()`: Hash code generation for hash tables (`HashMap`, `HashSet`).
- `String toString()`: Human-readable textual representation.

---

## 2. The equals() and hashCode() Contract

> [!IMPORTANT]
> **The Golden Rule**: If two objects are equal according to `equals(Object)`, they **MUST** have the same `hashCode()`.  
> Failure to obey this breaks `HashMap` and `HashSet`, causing lost entries and silent bugs.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Reflexive: x.equals(x) must return true                  │
│ 2. Symmetric: x.equals(y) == y.equals(x)                     │
│ 3. Transitive: If x.equals(y) && y.equals(z) => x.equals(z) │
│ 4. Consistent: Multiple invocations return the same result  │
│ 5. Non-nullity: x.equals(null) must return false            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Writing a Bulletproof equals() Implementation

```java
import java.util.Objects;

public final class CustomerId {
    private final String id;

    public CustomerId(String id) {
        this.id = Objects.requireNonNull(id);
    }

    @Override
    public boolean equals(Object o) {
        // 1. Check identity (fastest path)
        if (this == o) return true;
        // 2. Check null and class equivalence
        if (o == null || getClass() != o.getClass()) return false;
        // 3. Cast and compare significant fields
        CustomerId that = (CustomerId) o;
        return Objects.equals(this.id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "CustomerId[" + id + "]";
    }
}
```

---

## 4. The toString() Contract for Clean Debugging

A concise, informative `toString()` aids log parsing, distributed tracing, and production diagnostics:

```java
@Override
public String toString() {
    return String.format("Order[id=%s, amount=%.2f, status=%s]", id, amount, status);
}
```

---

## 5. Comparable<T> vs Comparator<T> in Sorting

- **`Comparable<T>`**: Natural ordering defined inside the class (`int compareTo(T o)`).
- **`Comparator<T>`**: External, custom sort strategy passed to collections or stream pipelines.

```java
// Natural order by timestamp
public record Event(String id, long timestamp) implements Comparable<Event> {
    @Override
    public int compareTo(Event other) {
        return Long.compare(this.timestamp, other.timestamp);
    }
}

// Custom external order by ID
Comparator<Event> byId = Comparator.comparing(Event::id);
```

---

## 6. Real-World Domain Model: Product Identity

```java
public class Product implements Comparable<Product> {
    private final String sku;
    private final String name;
    private final double price;

    public Product(String sku, String name, double price) {
        this.sku = Objects.requireNonNull(sku);
        this.name = Objects.requireNonNull(name);
        this.price = price;
    }

    public String getSku() { return sku; }
    public String getName() { return name; }
    public double getPrice() { return price; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Product other)) return false;
        return Objects.equals(sku, other.sku); // Business entity equality based on SKU
    }

    @Override
    public int hashCode() {
        return Objects.hash(sku);
    }

    @Override
    public int compareTo(Product o) {
        return Double.compare(this.price, o.price); // Default sort by price
    }
}
```

---

## 7. Interview Q&A

**Q: What happens if you override `equals()` but forget to override `hashCode()`?**  
*Answer:* Two equal objects will have different hash codes. When you insert the first object into a `HashSet` or `HashMap` and search for it using an equal object, the lookup will hash to a different bucket and fail to find the entry.

**Q: Can you compare subclasses using `instanceof` inside `equals()`?**  
*Answer:* Using `instanceof` allows symmetry between a subclass and a superclass only if the subclass does not add new value attributes. If a subclass adds fields and overrides `equals()`, `instanceof` violates transitivity. Use `getClass() == o.getClass()` when subclasses introduce state.
