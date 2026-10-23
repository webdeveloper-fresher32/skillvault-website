# ⚡ Concurrency & Multi-Threading in Low-Level Design (LLD)

> **Core Philosophy:** *In modern software systems and machine coding interviews, code that works in a single-threaded environment is only half the battle. If two concurrent requests can double-book a seat or corrupt an account balance, the design is fundamentally broken.*

---

## 📌 Table of Contents
1. [Why Concurrency is the #1 Rejection Reason in LLD Interviews](#1-why-concurrency-is-the-1-rejection-reason-in-lld-interviews)
2. [Thread Lifecycle & JVM Memory Model (JMM)](#2-thread-lifecycle--jvm-memory-model-jmm)
3. [Race Conditions & Critical Sections (The Double-Booking Problem)](#3-race-conditions--critical-sections-the-double-booking-problem)
4. [Volatile Keyword & CPU Instruction Reordering](#4-volatile-keyword--cpu-instruction-reordering)
5. [Locks & Synchronization Mechanisms](#5-locks--synchronization-mechanisms)
   * `synchronized` Blocks & Methods
   * `ReentrantLock` & Fairness
   * `ReadWriteLock` (Read-Heavy Systems)
   * Optimistic vs. Pessimistic Locking
6. [Atomic Variables & Compare-And-Swap (CAS)](#6-atomic-variables--compare-and-swap-cas)
7. [Thread-Safe Collections Deep Dive](#7-thread-safe-collections-deep-dive)
   * `ConcurrentHashMap` (Segment / Bucket Locking)
   * `CopyOnWriteArrayList`
   * `BlockingQueue`
8. [Classic Concurrency Design Patterns](#8-classic-concurrency-design-patterns)
   * Producer-Consumer Pattern
   * Thread Pool / Worker Pool Pattern
   * Read-Write Separation
9. [End-to-End Production Case Study: Thread-Safe Movie Ticket Seat Booking](#9-end-to-end-production-case-study-thread-safe-movie-ticket-seat-booking)
10. [Concurrency Anti-Patterns & Deadlock Prevention](#10-concurrency-anti-patterns--deadlock-prevention)
11. [The 5-Point Concurrency Checklist for LLD Interviews](#11-the-5-point-concurrency-checklist-for-lld-interviews)

---

## 1. Why Concurrency is the #1 Rejection Reason in LLD Interviews

Consider this scenario in a Machine Coding Round:
> *"Design a Movie Ticket Booking System (like BookMyShow) or an E-Commerce Flash Sale Checkout (like Amazon)."*

```
                           TICKET BOOKING SYSTEM
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
  User A (Mobile App)                                 User B (Web Browser)
  Clicks "Book Seat 12A"                              Clicks "Book Seat 12A"
  Timestamp: 10:00:00.001                             Timestamp: 10:00:00.001
           │                                                   │
           └─────────────────────────┬─────────────────────────┘
                                     ▼
                      ❌ WITHOUT CONCURRENCY CONTROL:
                      Both threads read: isAvailable = true
                      Thread A sets: bookedBy = UserA
                      Thread B sets: bookedBy = UserB
                      💥 Double-Booking Disaster! Immediate Interview Rejection!
```

In technical interviews, interviewers intentionally evaluate whether your in-memory models can safely handle **concurrent reads and writes** under high throughput without data corruption.

---

## 2. Thread Lifecycle & JVM Memory Model (JMM)

Understanding thread-safety requires understanding where variables live in memory:

```
┌─────────────────────────────────────────────────────────────┐
│                          MAIN MEMORY (RAM)                  │
│             Shared Heap (Objects, Instance Fields)          │
└──────────────────────────────▲──────────────────────────────┘
                               │ Read / Write Synchronization
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
┌──────────────────┐                        ┌──────────────────┐
│ CPU Core 1 Cache │                        │ CPU Core 2 Cache │
│ Local Working RAM│                        │ Local Working RAM│
└────────▲─────────┘                        └────────▲─────────┘
         │                                           │
┌────────┴─────────┐                        ┌────────┴─────────┐
│     Thread 1     │                        │     Thread 2     │
│ Private Stack    │                        │ Private Stack    │
│ (Local Variables)│                        │ (Local Variables)│
└──────────────────┘                        └──────────────────┘
```

### The Visibility Problem
When `Thread 1` modifies an object's field, it updates its **CPU L1/L2 Cache** first. `Thread 2` running on another CPU core might keep reading a stale value from its own local cache unless a **memory barrier (flush)** is triggered.

---

## 3. Race Conditions & Critical Sections (The Double-Booking Problem)

### ❌ The Broken Code: Check-Then-Act Antipattern
```java
public class Seat {
    private boolean isBooked = false;

    // 💥 DANGEROUS: Non-atomic Check-Then-Act!
    public boolean book(String user) {
        if (!isBooked) { // Check
            // Context switch can happen RIGHT HERE!
            isBooked = true; // Act
            System.out.println("Seat booked for " + user);
            return true;
        }
        return false;
    }
}
```

If `Thread A` and `Thread B` enter `if (!isBooked)` simultaneously before either sets `isBooked = true`, both succeed. This is a classic **Race Condition** within an unprotected **Critical Section**.

---

## 4. Volatile Keyword & CPU Instruction Reordering

### What `volatile` Guarantees:
1. **Visibility:** Guarantees that any write to a volatile variable is immediately flushed to Main Memory, and any read reads directly from Main Memory.
2. **Instruction Reordering Prevention:** Inserts a memory fence preventing the compiler and CPU from reordering instructions around it.

```java
public class WorkerFlag {
    // Guarantees other threads see termination immediately!
    private volatile boolean running = true;

    public void stop() { running = false; }

    public void runWork() {
        while (running) {
            // Do processing...
        }
    }
}
```

> ⚠️ **What `volatile` DOES NOT Guarantee:** **Atomicity!**  
> `volatile count++` is **NOT thread-safe** because `count++` consists of 3 distinct operations: read, increment, write. For compound operations, use Locks or Atomic classes.

---

## 5. Locks & Synchronization Mechanisms

### A. Intrinsic Locks (`synchronized`)
Every Java object has an internal monitor lock.

```java
public class BankAccount {
    private double balance = 1000.0;

    // Synchronized Method: Locks the entire 'this' instance
    public synchronized void withdraw(double amount) {
        if (balance >= amount) {
            balance -= amount;
        }
    }

    // Synchronized Block: Finer-grained critical section
    public void deposit(double amount) {
        synchronized (this) {
            balance += amount;
        }
    }
}
```

---

### B. Explicit Locks: `ReentrantLock`
Provides advanced capabilities beyond intrinsic `synchronized`:
* `tryLock()` with timeout (avoids deadlocks).
* Fairness option (grants lock to longest-waiting thread).
* Multiple wait-conditions via `Condition`.

```java
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

public class InventoryService {
    private final ReentrantLock lock = new ReentrantLock(true); // Fair lock
    private int stock = 100;

    public boolean purchaseItem(int quantity) {
        try {
            // Try acquiring lock within 500ms instead of blocking forever!
            if (lock.tryLock(500, TimeUnit.MILLISECONDS)) {
                try {
                    if (stock >= quantity) {
                        stock -= quantity;
                        return true;
                    }
                    return false;
                } finally {
                    lock.unlock(); // Always release in finally block!
                }
            } else {
                System.out.println("System busy; could not acquire lock.");
                return false;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
```

---

### C. Read-Heavy Systems: `ReentrantReadWriteLock`
In systems like Movie Ticket displays or Stock Tickers, **99% of requests are reads** (`viewAvailableSeats()`), and only **1% are writes** (`bookSeat()`).
* **Read Lock:** Multiple threads can acquire the read lock concurrently as long as no thread is writing.
* **Write Lock:** Exclusive. Blocks all readers and writers.

```java
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public class SeatCatalog {
    private final Map<String, Boolean> seatAvailability = new HashMap<>();
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();

    // Multiple users can read simultaneously without blocking each other!
    public boolean checkAvailability(String seatId) {
        rwLock.readLock().lock();
        try {
            return seatAvailability.getOrDefault(seatId, false);
        } finally {
            rwLock.readLock().unlock();
        }
    }

    // Exclusive write lock for booking
    public void markSeatBooked(String seatId) {
        rwLock.writeLock().lock();
        try {
            seatAvailability.put(seatId, false);
        } finally {
            rwLock.writeLock().unlock();
        }
    }
}
```

---

### D. Optimistic vs Pessimistic Locking
| Dimension | Pessimistic Locking | Optimistic Locking |
| :--- | :--- | :--- |
| **Philosophy** | "Conflicts happen often; lock everything upfront." | "Conflicts are rare; validate on commit." |
| **Mechanism** | `synchronized`, `ReentrantLock`, `SELECT FOR UPDATE` | Version numbers, Atomic CAS (`AtomicInteger`) |
| **Best For** | High-contention flash sales with frequent conflicting writes. | Read-heavy systems with rare write collisions. |
| **Overhead** | Thread blocking and context-switch cost. | CPU spin loops / retry overhead on conflict. |

---

## 6. Atomic Variables & Compare-And-Swap (CAS)

Atomic classes (`AtomicInteger`, `AtomicBoolean`, `AtomicReference`) eliminate lock overhead using hardware-level CPU instructions called **Compare-And-Swap (CAS)**:

```
                    CAS ALGORITHM IN HARDWARE
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
Current Value == Expected?            Current Value != Expected?
Update to New Value atomically!       Reject update & retry loop (No lock!)
```

```java
import java.util.concurrent.atomic.AtomicInteger;

public class OrderCounter {
    private final AtomicInteger orderIdSequence = new AtomicInteger(1000);

    public int getNextOrderId() {
        // Lock-free, thread-safe, high throughput increment!
        return orderIdSequence.incrementAndGet();
    }
}
```

---

## 7. Thread-Safe Collections Deep Dive

| Collection | Thread-Safe? | Locking Strategy | Performance Profile |
| :--- | :---: | :--- | :--- |
| `HashMap` | ❌ No | None (Causes infinite loop or corrupted bins) | Fast (Single-threaded only) |
| `Hashtable` | ✅ Yes | Method-level `synchronized` (Coarse-grained) | ❌ Slow (All threads bottleneck on 1 lock) |
| `ConcurrentHashMap` | ✅ Yes | Bucket-level locks + CAS on first node insertion | ⚡ Blazing fast; scales across CPU cores |
| `ArrayList` | ❌ No | None | Fast |
| `CopyOnWriteArrayList`| ✅ Yes | Creates a clone copy on write; read lock-free | ⚡ Great for read-heavy observer listener lists |
| `ArrayBlockingQueue` | ✅ Yes | Two separate locks (`putLock` and `takeLock`) | ⚡ Standard for Producer-Consumer pipelines |

### Why `ConcurrentHashMap` Dominates LLD
Instead of locking the entire table, Java's `ConcurrentHashMap` locks only the specific hash bucket chain being modified, allowing multiple threads to write to different buckets simultaneously.

```java
import java.util.concurrent.ConcurrentHashMap;

public class ActiveSessionManager {
    // Highly scalable concurrent in-memory store
    private final ConcurrentHashMap<String, String> userTokens = new ConcurrentHashMap<>();

    public void registerUser(String userId, String token) {
        // Atomic put if absent
        userTokens.putIfAbsent(userId, token);
    }
}
```

---

## 8. Classic Concurrency Design Patterns

### Pattern 1: Producer-Consumer (Work Queue)
Used in Notification Services, Order Processing, and Event Pipelines:

```
[ Producer 1 ] ──┐
                 ├──► [ BlockingQueue (Buffer) ] ──► [ Worker Consumer 1 ]
[ Producer 2 ] ──┘                               └──► [ Worker Consumer 2 ]
```

```java
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

public class NotificationSystem {
    // Fixed buffer of 1000 pending alerts
    private final BlockingQueue<String> alertQueue = new ArrayBlockingQueue<>(1000);

    // Producer thread puts items into the queue
    public void sendAlert(String alertMessage) throws InterruptedException {
        alertQueue.put(alertMessage); // Blocks automatically if queue is full
    }

    // Consumer thread pulls items
    public void startWorker() {
        new Thread(() -> {
            while (true) {
                try {
                    String alert = alertQueue.take(); // Blocks automatically if queue is empty
                    System.out.println("Processing SMS Alert: " + alert);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }).start();
    }
}
```

---

## 9. End-to-End Production Case Study: Thread-Safe Movie Ticket Seat Booking

Here is a complete, runnable, production-grade implementation of a concurrent seat reservation manager with **temporary seat locks, timeouts, and race condition prevention**:

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

public class CinemaBookingManager {

    public enum SeatStatus { AVAILABLE, LOCKED, BOOKED }

    public static class Seat {
        private final String seatId;
        private SeatStatus status = SeatStatus.AVAILABLE;
        private String lockedByUserId;
        private long lockExpiryTimestamp;
        private final ReentrantLock seatLock = new ReentrantLock();

        public Seat(String seatId) { this.seatId = seatId; }

        public String getSeatId() { return seatId; }
        public SeatStatus getStatus() { return status; }
    }

    private final ConcurrentHashMap<String, Seat> seats = new ConcurrentHashMap<>();

    public void addSeat(String seatId) {
        seats.put(seatId, new Seat(seatId));
    }

    /**
     * Atomically locks a seat for 10 minutes so user can complete payment.
     */
    public boolean lockSeat(String seatId, String userId, long timeoutMillis) {
        Seat seat = seats.get(seatId);
        if (seat == null) return false;

        seat.seatLock.lock(); // Protect this specific seat!
        try {
            long now = System.currentTimeMillis();

            // Check if available OR previously expired lock
            if (seat.status == SeatStatus.AVAILABLE || 
               (seat.status == SeatStatus.LOCKED && now > seat.lockExpiryTimestamp)) {
                
                seat.status = SeatStatus.LOCKED;
                seat.lockedByUserId = userId;
                seat.lockExpiryTimestamp = now + timeoutMillis;
                System.out.println("🔒 Seat " + seatId + " successfully locked by @" + userId);
                return true;
            }
            System.out.println("❌ Seat " + seatId + " lock failed for @" + userId + " (Already held)");
            return false;
        } finally {
            seat.seatLock.unlock(); // Always release lock
        }
    }

    /**
     * Confirms booking after successful payment.
     */
    public boolean confirmBooking(String seatId, String userId) {
        Seat seat = seats.get(seatId);
        if (seat == null) return false;

        seat.seatLock.lock();
        try {
            long now = System.currentTimeMillis();
            if (seat.status == SeatStatus.LOCKED && 
                userId.equals(seat.lockedByUserId) && 
                now <= seat.lockExpiryTimestamp) {

                seat.status = SeatStatus.BOOKED;
                System.out.println("🎉 Seat " + seatId + " BOOKED confirmed for @" + userId);
                return true;
            }
            return false;
        } finally {
            seat.seatLock.unlock();
        }
    }

    public static void main(String[] args) throws InterruptedException {
        CinemaBookingManager cinema = new CinemaBookingManager();
        cinema.addSeat("A1");

        // Simulate 2 users clicking "Book Seat A1" concurrently at the exact same millisecond!
        Thread user1 = new Thread(() -> cinema.lockSeat("A1", "Alice", 5000));
        Thread user2 = new Thread(() -> cinema.lockSeat("A1", "Bob", 5000));

        user1.start();
        user2.start();

        user1.join();
        user2.join();

        // Alice completes checkout
        cinema.confirmBooking("A1", "Alice");
    }
}
```

---

## 10. Concurrency Anti-Patterns & Deadlock Prevention

### The 4 Coffman Conditions for Deadlock:
1. **Mutual Exclusion:** Resources cannot be shared.
2. **Hold and Wait:** A thread holds resource A while waiting for resource B.
3. **No Preemption:** Resources cannot be forcibly confiscated.
4. **Circular Wait:** Thread 1 waits for Thread 2, which waits for Thread 1.

### ❌ The Classic Deadlock Trap
```java
// Transfer funds between two bank accounts
public void transfer(Account from, Account to, double amount) {
    synchronized (from) {
        synchronized (to) { // 💥 DEADLOCK if another thread transfers from `to` to `from`!
            from.withdraw(amount);
            to.deposit(amount);
        }
    }
}
```

### ✅ Solution: Global Lock Ordering
Always acquire locks in a globally deterministic order (e.g. sorted by unique Account ID):

```java
public void transferSafe(Account from, Account to, double amount) {
    Account firstLock = from.getId() < to.getId() ? from : to;
    Account secondLock = from.getId() < to.getId() ? to : from;

    synchronized (firstLock) {
        synchronized (secondLock) {
            from.withdraw(amount);
            to.deposit(amount);
        }
    }
}
```

---

## 11. The 5-Point Concurrency Checklist for LLD Interviews

Whenever designing in-memory stores or state transitions in an interview:

* [ ] **Identify Critical Sections:** Are there compound operations (`check-then-act`, `count++`) that can be interleaved?
* [ ] **Choose the Minimal Lock Scope:** Synchronize a small block, not the entire method. Lock individual entities (e.g. `seat.lock()`), not the entire service.
* [ ] **Pick the Right Collection:** Use `ConcurrentHashMap` for maps and `ArrayBlockingQueue` for asynchronous worker buffers.
* [ ] **Prevent Deadlocks:** If acquiring multiple locks, enforce a strict global acquisition order (e.g. by sorting IDs).
* [ ] **Handle Thread Interruption:** Always catch `InterruptedException` properly and restore the interrupt flag (`Thread.currentThread().interrupt()`).
