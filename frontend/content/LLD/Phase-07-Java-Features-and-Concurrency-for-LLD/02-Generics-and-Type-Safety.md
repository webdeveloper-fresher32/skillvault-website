# Generics, Type Safety, and the PECS Rule in Java LLD

## Table of Contents
1. [Why Generics Matter in LLD](#1-why-generics-matter-in-lld)
2. [Generic Classes & Interfaces: Repository Pattern](#2-generic-classes--interfaces-repository-pattern)
3. [The PECS Principle: Producer Extends, Consumer Super](#3-the-pecs-principle-producer-extends-consumer-super)
4. [Bounded Type Parameters in Domain Modeling](#4-bounded-type-parameters-in-domain-modeling)
5. [Real-World Example: Type-Safe Generic Event Bus](#5-real-world-example-type-safe-generic-event-bus)
6. [Interview Pitfalls: Type Erasure & Arrays](#6-interview-pitfalls-type-erasure--arrays)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Generics Matter in LLD

In machine coding interviews, using raw types (`Object`, `List`) causes runtime `ClassCastException` and defeats compile-time guarantees. Generics enable **reusable**, **type-safe** domain abstractions.

```
┌─────────────────────────────────────────────────────────────┐
│ ❌ Raw Types: Object / Weak Typing                           │
│ Object data = cache.get("key");                             │
│ User u = (User) data; // Runtime Crash if data is Order!    │
├─────────────────────────────────────────────────────────────┤
│ ✅ Generic Type Safety: Compile-Time Verifiability          │
│ Cache<String, User> userCache = new InMemoryCache<>();      │
│ User u = userCache.get("key"); // 100% Type-Safe!           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Generic Classes & Interfaces: Repository Pattern

The Generic Repository pattern is one of the most widely evaluated patterns in backend machine coding:

```java
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

// Generic Entity marker interface
public interface Identifiable<ID> {
    ID getId();
}

// Generic Repository contract
public interface CrudRepository<T extends Identifiable<ID>, ID> {
    T save(T entity);
    Optional<T> findById(ID id);
    List<T> findAll();
    boolean deleteById(ID id);
}

// Generic In-Memory Thread-Safe Implementation
public class InMemoryRepository<T extends Identifiable<ID>, ID> implements CrudRepository<T, ID> {
    private final Map<ID, T> storage = new ConcurrentHashMap<>();

    @Override
    public T save(T entity) {
        Objects.requireNonNull(entity, "Entity cannot be null");
        storage.put(entity.getId(), entity);
        return entity;
    }

    @Override
    public Optional<T> findById(ID id) {
        return Optional.ofNullable(storage.get(id));
    }

    @Override
    public List<T> findAll() {
        return new ArrayList<>(storage.values());
    }

    @Override
    public boolean deleteById(ID id) {
        return storage.remove(id) != null;
    }
}
```

---

## 3. The PECS Principle: Producer Extends, Consumer Super

When designing API signatures that accept generic collections, follow Joshua Bloch's golden rule:
- **Producer Extends (`? extends T`)**: If your method *reads* items from the collection (it produces values of type `T`), use `? extends T`.
- **Consumer Super (`? super T`)**: If your method *writes* items into the collection (it consumes values of type `T`), use `? super T`.

```java
public class BatchProcessor {

    // Reading elements: source is a PRODUCER of Numbers
    public static double sumOfList(List<? extends Number> list) {
        double sum = 0.0;
        for (Number n : list) {
            sum += n.doubleValue(); // Safe to read as Number
        }
        return sum;
    }

    // Writing elements: target is a CONSUMER of Integers
    public static void populateEvens(List<? super Integer> target, int count) {
        for (int i = 0; i < count; i++) {
            target.add(i * 2); // Safe to insert Integer into List of Integer, Number, or Object
        }
    }
}
```

---

## 4. Bounded Type Parameters in Domain Modeling

Use bounds (`<T extends Comparable<T>>` or `<T extends BaseEntity & Serializable>`) to declare capabilities:

```java
public class PriorityRouter<T extends Comparable<T>> {
    private final PriorityQueue<T> queue = new PriorityQueue<>();

    public void enqueue(T item) {
        queue.offer(item);
    }

    public T pollHighestPriority() {
        return queue.poll();
    }
}
```

---

## 5. Real-World Example: Type-Safe Generic Event Bus

```java
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

// Event base marker
public interface DomainEvent {}

public class EventBus {
    private final Map<Class<? extends DomainEvent>, List<Consumer<? extends DomainEvent>>> subscribers 
            = new ConcurrentHashMap<>();

    // Subscribe with type safety
    @SuppressWarnings("unchecked")
    public <T extends DomainEvent> void register(Class<T> eventType, Consumer<T> subscriber) {
        subscribers.computeIfAbsent(eventType, k -> new CopyOnWriteArrayList<>())
                   .add((Consumer<? extends DomainEvent>) subscriber);
    }

    // Publish dispatch
    @SuppressWarnings("unchecked")
    public <T extends DomainEvent> void publish(T event) {
        List<Consumer<? extends DomainEvent>> handlers = subscribers.get(event.getClass());
        if (handlers != null) {
            for (Consumer<? extends DomainEvent> handler : handlers) {
                ((Consumer<T>) handler).accept(event);
            }
        }
    }
}

// Domain usage:
record OrderPlacedEvent(String orderId, double amount) implements DomainEvent {}

// Usage demo:
// EventBus bus = new EventBus();
// bus.register(OrderPlacedEvent.class, e -> System.out.println("Processing order: " + e.orderId()));
// bus.publish(new OrderPlacedEvent("ORD-101", 249.99));
```

---

## 6. Interview Pitfalls: Type Erasure & Arrays

1. **Type Erasure**: Generics exist strictly at compile time. At runtime, `List<String>` and `List<Integer>` both become raw `List`.
2. **Cannot Instantiate Generics Directly**: `new T()` is illegal in Java because `T` is erased to `Object`. Pass a `Supplier<T>` or `Class<T>` factory instead.
3. **Cannot Create Generic Arrays**: `new T[10]` or `new List<String>[10]` causes compiler errors. Prefer `List<T>` or reflectively construct via `Array.newInstance(clazz, size)`.

---

## 7. Interview Q&A

**Q: Why does `List<String>` not inherit from `List<Object>` in Java?**  
*Answer:* Generics in Java are **invariant**. If `List<String>` were a subtype of `List<Object>`, you could write `List<Object> objList = strList; objList.add(Integer.valueOf(42));`, which would silently insert an integer into a list of strings, breaking type safety upon read.

**Q: Explain how PECS prevents compiler errors when designing extensible libraries.**  
*Answer:* Without wildcards, an API accepting `List<Animal>` cannot accept a `List<Dog>`. By declaring `List<? extends Animal>`, the method can safely read Dogs, Cats, etc. Conversely, `List<? super Dog>` allows feeding Dogs into any destination list capable of holding Animals or Objects.
