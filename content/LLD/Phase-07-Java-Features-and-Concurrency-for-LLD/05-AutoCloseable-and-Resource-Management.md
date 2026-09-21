# AutoCloseable, Resource Management, and RAII in Java LLD

## Table of Contents
1. [The Resource Leak Danger in Systems Design](#1-the-resource-leak-danger-in-systems-design)
2. [Try-with-Resources & AutoCloseable Contract](#2-try-with-resources--autocloseable-contract)
3. [Custom AutoCloseable in LLD: Safe Lock Scope](#3-custom-autocloseable-in-lld-safe-lock-scope)
4. [Transaction & Unit of Work Lifecycle Management](#4-transaction--unit-of-work-lifecycle-management)
5. [Real-World Example: Connection Pool Lease Guardian](#5-real-world-example-connection-pool-lease-guardian)
6. [Suppressed Exceptions Handling](#6-suppressed-exceptions-handling)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Resource Leak Danger in Systems Design

In enterprise systems, failure to release external or shared resources (sockets, connection pools, filesystem descriptors, explicit locks) causes starvation, connection exhaustion, and deadlocks.

```
┌─────────────────────────────────────────────────────────────┐
│ ❌ Legacy Manual Cleanup (Prone to Leaks)                   │
│ Connection conn = pool.acquire();                           │
│ doWork(); // If an exception is thrown here...             │
│ pool.release(conn); // THIS NEVER RUNS! Resource is LEAKED! │
├─────────────────────────────────────────────────────────────┤
│ ✅ Try-With-Resources (Deterministic RAII Pattern)          │
│ try (ConnectionLease lease = pool.acquire()) {              │
│     doWork();                                               │
│ } // Guaranteed cleanup even on OutOfMemoryError or Exception│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Try-with-Resources & AutoCloseable Contract

Any class implementing `java.lang.AutoCloseable` can participate in the `try (...)` block.

```java
public interface AutoCloseable {
    void close() throws Exception;
}
```

When exiting the try block (normally or via exception), the JVM automatically calls `close()` in reverse order of resource acquisition.

---

## 3. Custom AutoCloseable in LLD: Safe Lock Scope

A classic machine coding technique: wrap a `Lock` or `ReentrantLock` in an `AutoCloseable` scope so you never forget `lock.unlock()` in a `finally` block:

```java
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public final class LockScope implements AutoCloseable {
    private final Lock lock;

    private LockScope(Lock lock) {
        this.lock = lock;
        this.lock.lock();
    }

    public static LockScope open(Lock lock) {
        return new LockScope(lock);
    }

    @Override
    public void close() {
        lock.unlock();
    }
}

// Clean usage in domain service:
public class SeatReservationService {
    private final Lock seatLock = new ReentrantLock();

    public boolean reserveSeat(String seatId) {
        try (LockScope scope = LockScope.open(seatLock)) {
            // Thread-safe critical section
            return executeReservation(seatId);
        } // Automatically and safely unlocks here!
    }

    private boolean executeReservation(String seatId) {
        return true;
    }
}
```

---

## 4. Transaction & Unit of Work Lifecycle Management

```java
public class InMemTransaction implements AutoCloseable {
    private boolean committed = false;

    public void commit() {
        System.out.println("Applying changes permanently to storage...");
        this.committed = true;
    }

    @Override
    public void close() {
        if (!committed) {
            System.err.println("Transaction was not committed! Rolling back changes automatically.");
            rollback();
        }
    }

    private void rollback() {
        // Revert temporary state mutations
    }
}
```

---

## 5. Real-World Example: Connection Pool Lease Guardian

```java
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

public class ConnectionPool {
    private final BlockingQueue<String> available = new ArrayBlockingQueue<>(10);

    public ConnectionPool() {
        for (int i = 1; i <= 5; i++) {
            available.offer("DB-Conn-" + i);
        }
    }

    public Lease acquire(long timeout, TimeUnit unit) throws InterruptedException {
        String conn = available.poll(timeout, unit);
        if (conn == null) {
            throw new IllegalStateException("Connection pool exhausted");
        }
        return new Lease(conn);
    }

    // Inner AutoCloseable Lease wrapper
    public class Lease implements AutoCloseable {
        private final String connection;
        private boolean returned = false;

        private Lease(String connection) {
            this.connection = connection;
        }

        public String get() {
            if (returned) throw new IllegalStateException("Lease already closed");
            return connection;
        }

        @Override
        public void close() {
            if (!returned) {
                returned = true;
                available.offer(connection);
                System.out.println("Returned " + connection + " safely back to pool.");
            }
        }
    }
}
```

---

## 6. Suppressed Exceptions Handling

If the `try` block throws an exception and the `close()` method also throws an exception, Java does **not** discard the primary error. The exception from `close()` is attached to the primary exception as a **suppressed exception** (`primaryException.getSuppressed()`), preserving full debug stack traces.

---

## 7. Interview Q&A

**Q: What is the difference between `Closeable` and `AutoCloseable`?**  
*Answer:* `Closeable` was introduced in Java 5 and is restricted to `java.io.IOException`. `AutoCloseable` was introduced in Java 7 as the parent of `Closeable` and its `close()` method throws `Exception`, making it applicable to non-IO resources (database pools, thread locks, transactions).

**Q: Is `close()` guaranteed to run if the JVM crashes with `System.exit(0)`?**  
*Answer:* No. If `System.exit()` is called or the OS kills the process (`kill -9`), the JVM terminates immediately without executing `finally` blocks or `close()` hooks.
