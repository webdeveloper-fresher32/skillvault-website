# Java Collections Framework and Stream API in LLD

## Table of Contents
1. [The Collections Decision Matrix](#1-the-collections-decision-matrix)
2. [PriorityQueue & Deque in System Modeling](#2-priorityqueue--deque-in-system-modeling)
3. [Thread-Safe Collections at a Glance](#3-thread-safe-collections-at-a-glance)
4. [Functional Filtering with Stream API](#4-functional-filtering-with-stream-api)
5. [Real-World Example: Multi-Criteria Search & Ranking Engine](#5-real-world-example-multi-criteria-search--ranking-engine)
6. [Common Interview Pitfalls](#6-common-interview-pitfalls)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Collections Decision Matrix

Selecting the proper data structure is the first thing interviewers look at during Machine Coding.

| Requirement | Preferred Java Collection | Time Complexity | Typical LLD Use Case |
| :--- | :--- | :--- | :--- |
| **Fast index lookup, dynamic sizing** | `ArrayList<T>` | Read $O(1)$, Append amortized $O(1)$ | Storing floors, order history, inventory list |
| **Unique elements, fast existence check** | `HashSet<T>` | Add/Lookup $O(1)$ | Active session tokens, visited nodes |
| **Unique elements, sorted order** | `TreeSet<T>` | Add/Lookup $O(\log N)$ | Leaderboards, sorted price levels |
| **Key-Value lookup by ID** | `HashMap<K, V>` | Read/Write $O(1)$ average | User repository, parking slot registry |
| **Key-Value sorted by keys** | `TreeMap<K, V>` | Read/Write $O(\log N)$ | Time-series metrics, price ladders |
| **Insertion-order preservation** | `LinkedHashMap<K, V>` | Read/Write $O(1)$ | LRU Cache implementation |
| **Priority / Min-Max processing** | `PriorityQueue<T>` | Insert $O(\log N)$, Poll $O(\log N)$, Peek $O(1)$ | Task scheduler, cab matching, elevator dispatch |

---

## 2. PriorityQueue & Deque in System Modeling

```java
// Nearest Cab Matching based on distance (Min-Heap)
PriorityQueue<Driver> nearestDrivers = new PriorityQueue<>(
    Comparator.comparingDouble(driver -> driver.getDistanceTo(riderLocation))
);

// Double-Ended Queue (Deque) for Undo/Redo or Sliding Window rate limiters
Deque<Command> commandHistory = new ArrayDeque<>();
commandHistory.push(new MoveElevatorCommand());
Command lastAction = commandHistory.pop(); // Undo
```

---

## 3. Thread-Safe Collections at a Glance

When designing concurrent systems (Parking Lot, Movie Booking, Hotel Reservation):
- **Never use `Hashtable` or `Vector`** (legacy, synchronized bottle-neck).
- Prefer **`ConcurrentHashMap`**: Uses fine-grained bucket/segment locking and CAS for ultra-high throughput.
- Prefer **`CopyOnWriteArrayList`**: Ideal for read-heavy observer subscriber lists (zero-lock reads, copy on modification).
- Prefer **`BlockingQueue`** (`LinkedBlockingQueue`, `ArrayBlockingQueue`): Perfect for Producer-Consumer task worker pools.

---

## 4. Functional Filtering with Stream API

In LLD, business logic often requires filtering, mapping, and aggregating domain entities:

```java
public class BookingAnalytics {

    public List<String> getVipCustomerEmails(List<Booking> bookings) {
        return bookings.stream()
            .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
            .filter(b -> b.getTotalAmount() >= 500.0)
            .map(Booking::getCustomer)
            .filter(Customer::isVip)
            .map(Customer::getEmail)
            .distinct()
            .sorted()
            .toList();
    }

    public Map<PaymentMethod, Double> revenueByPaymentMethod(List<Payment> payments) {
        return payments.stream()
            .filter(Payment::isSuccessful)
            .collect(Collectors.groupingBy(
                Payment::getMethod,
                Collectors.summingDouble(Payment::getAmount)
            ));
    }
}
```

---

## 5. Real-World Example: Multi-Criteria Search & Ranking Engine

```java
import java.util.*;
import java.util.stream.Collectors;

public record Hotel(String id, String name, String city, double rating, double pricePerNight) {}

public class HotelSearchService {
    private final List<Hotel> hotelDatabase = new ArrayList<>();

    public void addHotel(Hotel hotel) {
        hotelDatabase.add(hotel);
    }

    public List<Hotel> searchHotels(String city, Double minRating, Double maxPrice, String sortBy) {
        return hotelDatabase.stream()
            .filter(h -> h.city().equalsIgnoreCase(city))
            .filter(h -> minRating == null || h.rating() >= minRating)
            .filter(h -> maxPrice == null || h.pricePerNight() <= maxPrice)
            .sorted(getComparator(sortBy))
            .collect(Collectors.toList());
    }

    private Comparator<Hotel> getComparator(String sortBy) {
        if ("price_asc".equalsIgnoreCase(sortBy)) {
            return Comparator.comparingDouble(Hotel::pricePerNight);
        } else if ("rating_desc".equalsIgnoreCase(sortBy)) {
            return Comparator.comparingDouble(Hotel::rating).reversed();
        }
        return Comparator.comparing(Hotel::name);
    }
}
```

---

## 6. Common Interview Pitfalls

1. **Mutating Key Objects in a `HashMap`**: If you mutate an object after inserting it as a key, its `hashCode()` changes and the entry becomes permanently unreachable! Ensure map keys are immutable (`record`, `String`, `UUID`).
2. **`ConcurrentModificationException`**: Modifying a standard `ArrayList` while iterating over it via `for (T item : list)`. Use an `Iterator.remove()` or Java 8 `list.removeIf(predicate)`.
3. **Using `peek()` for side-effects in Streams**: Stream operations are lazy; `peek()` is meant for debugging only and may not execute if the pipeline short-circuits.

---

## 7. Interview Q&A

**Q: How does `ConcurrentHashMap` achieve thread safety without locking the whole map?**  
*Answer:* In Java 8+, `ConcurrentHashMap` uses synchronized blocks on individual bucket tree nodes (or table bin heads) and Compare-And-Swap (CAS) instructions for inserts into empty bins. Multiple threads can read simultaneously without locks, and write to different buckets concurrently without contention.

**Q: When would you choose `TreeSet` over `HashSet`?**  
*Answer:* Choose `HashSet` when $O(1)$ fast lookup is required without caring about element order. Choose `TreeSet` ($O(\log N)$) when you need continuously sorted order, range queries (`subSet()`, `headSet()`), or floor/ceiling operations (e.g., finding the closest seat or time slot).
