# 02 — Garbage Collection and Common Memory Errors

> A comprehensive reference covering reachability-based garbage collection, the generational hypothesis, why `System.gc()` is only a hint, the JIT compiler's role, and the two most common JVM memory errors you'll actually hit in practice.

---

## Table of Contents

1. [The Problem: Who Cleans Up the Heap?](#1-the-problem-who-cleans-up-the-heap)
2. [The Analogy: An Automatic Decluttering Service](#2-the-analogy-an-automatic-decluttering-service)
3. [Reachability: When Is an Object Eligible for Collection?](#3-reachability-when-is-an-object-eligible-for-collection)
4. [The Generational Hypothesis](#4-the-generational-hypothesis)
5. [A Word on Collectors and the JIT Compiler](#5-a-word-on-collectors-and-the-jit-compiler)
6. [Code Example: Making an Object Eligible for Collection](#6-code-example-making-an-object-eligible-for-collection)
7. [Common Memory Errors](#7-common-memory-errors)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Who Cleans Up the Heap?

Lesson 1 established that objects live on the heap for as long as something can still reach them. But nothing lasts forever — a `Person` created inside a method that has long since returned, with no remaining reference pointing to it anywhere, is just wasted space unless *something* reclaims that memory. Languages that require manual memory management (explicit `free`/`delete` calls) are notorious for two related bug classes: forgetting to free memory that's no longer needed (a leak), and freeing memory that's still in use elsewhere (a dangling reference, often a crash waiting to happen).

Java sidesteps both of these by never asking you to free memory yourself. Instead, a background process called the **garbage collector (GC)** periodically finds heap objects nothing can reach anymore and reclaims their memory automatically. The problem this lesson answers: **how does the JVM decide an object is safe to reclaim, and what does that mean for your code in practice?**

---

## 2. The Analogy: An Automatic Decluttering Service

**Real-world analogy:** picture the warehouse from Lesson 1 employing an automatic decluttering service. Periodically, the service walks through every aisle and checks each item against the warehouse's claim tickets — proof that some active cook, order, or process still needs that item. Anything with no valid claim ticket anymore gets cleared out to make room. Anything still claimed, no matter how old it is, stays exactly where it is.

Crucially, the decluttering service runs on **its own schedule** — you don't personally decide the exact moment it sweeps through, and you can't force it to skip an item that still has a valid claim. **The garbage collector is that decluttering service, the heap is the warehouse, and a "claim ticket" is a live reference somewhere a running thread can still reach.**

---

## 3. Reachability: When Is an Object Eligible for Collection?

An object becomes **eligible for garbage collection** the moment it is no longer **reachable** from any *live* reference — meaning there is no chain of references, starting from something a running thread can currently access (a local variable still in scope, a static field, an object another reachable object points to), that leads to it. This is different from some other languages' simpler reference-counting schemes (where an object is freed the instant its reference count hits exactly zero): Java's garbage collector instead periodically traces *reachability* from a set of starting points (called **GC roots** — conceptually, things like local variables on active stack frames and static fields), and anything it can't reach during that trace is eligible for collection.

Reachability, not reference count, is also what correctly handles a cycle — two objects that reference each other but that nothing else in the program can reach are still both correctly identified as unreachable (and therefore collectible), which a naive reference-counting scheme can struggle with.

Being "eligible for collection" is not the same as "collected right now." The JVM makes no promise about exactly *when* an eligible object's memory is actually reclaimed — only that it's a legal candidate the next time the collector runs.

---

## 4. The Generational Hypothesis

Most production JVM garbage collectors are built around an observation, backed by decades of real-world measurement, called the **generational hypothesis**: *most objects die young*. A huge share of objects created during a program's run (temporary loop variables, short-lived request/response objects, intermediate calculation results) become unreachable almost immediately, while a much smaller share (long-lived caches, singleton-style service objects, application configuration) survive for the entire run of the program.

Rather than scanning the *entire* heap every single time, the heap is conceptually split into generations:

- **Young generation** — where new objects are allocated first. Collected frequently, and cheaply, because most of what's in it is already garbage by the time a collection runs (exactly as the hypothesis predicts). Objects that survive several young-generation collections are promoted further.
- **Old generation** (sometimes called tenured) — holds objects that have proven, by surviving repeated young-generation collections, that they're relatively long-lived. Collected far less often, since scanning it is more expensive and there's usually much less garbage to find there at any given moment.

This split is *why* garbage collection in practice tends to be cheap overall — the collector spends most of its effort in the young generation, exactly where most of the actual garbage is.

Modern JVMs ship with more than one garbage collector implementation, tuned for different priorities (overall throughput vs minimizing pause times). **G1** (Garbage-First) has been the widely-used default collector in recent mainstream JVM versions. Collector tuning and internals beyond this conceptual level are outside the scope of this course.

---

## 5. A Word on Collectors and the JIT Compiler

One more JVM internal worth knowing conceptually, since it's often mentioned alongside garbage collection: the **JIT (Just-In-Time) compiler**. The JVM starts out *interpreting* your compiled bytecode — executing it one instruction at a time, which is flexible but not maximally fast. As the JVM runs, it keeps track of which methods are executed especially frequently ("hot" methods). Once a method crosses a certain threshold of hotness, the JIT compiler compiles that specific bytecode down to native machine code for the actual CPU it's running on, so future calls to that method run at (or close to) native speed instead of being interpreted every time.

This is part of why a long-running Java program (like a server application) often gets measurably faster the longer it's been running — its hottest code paths have had time to be JIT-compiled — a phenomenon sometimes called "warm-up."

---

## 6. Code Example: Making an Object Eligible for Collection

```java
public class EligibilityDemo {

    public static void main(String[] args) {
        // 1. A Person object is created on the heap; "p" is a live
        //    reference to it, so the object is reachable.
        Person p = new Person("Ana");
        System.out.println(p.getName());

        // 2. Reassigning "p" to null removes the only reference this
        //    program had to that Person object. Nothing else in this
        //    program can reach it anymore.
        p = null;

        // 3. The Person object created in step 1 is now ELIGIBLE for
        //    garbage collection. This does NOT mean it has already
        //    been collected, and it does not say when (or even
        //    whether, before the program exits) collection will
        //    actually happen — Java makes no such guarantee. It only
        //    means the collector is now free to reclaim it on some
        //    future collection cycle, because nothing can reach it.
    }

    static class Person {
        private final String name;
        Person(String name) { this.name = name; }
        String getName() { return name; }
    }
}
```

The same thing happens, just as legitimately, if `p` had instead simply gone out of scope at the end of a method, rather than being explicitly set to `null` — reachability is what matters, not the specific way a reference stopped existing.

---

## 7. Common Memory Errors

| Error | Region involved | Typical real-world cause |
|---|---|---|
| `OutOfMemoryError: Java heap space` | Heap | Too many objects remain reachable at once for the configured heap size to hold — often an actual memory leak: references (e.g. entries added to a static `List` or `Map` and never removed) unintentionally keep otherwise-dead objects reachable forever. |
| `StackOverflowError` | Stack (per-thread) | Recursion with a missing or incorrect base case, or recursion that's simply far deeper than expected for the input size (covered in Lesson 1). |

**Common mistakes:**
- Assuming `System.gc()` forces an immediate garbage collection. It doesn't — it's only a **hint** to the JVM that now might be a good time to collect, not a command it's obligated to obey. The JVM is free to ignore the hint entirely, and relying on `System.gc()` for correctness (rather than treating collection timing as unpredictable) is a design smell.
- Calling something "a memory leak" in Java and assuming it means the same thing it does in a language with manual memory management (a block of memory nobody ever explicitly freed). In Java, a "leak" specifically means unintentionally-retained *references* — something (often a static collection, a listener never unregistered, or a cache with no eviction policy) keeps holding a reference to objects that are logically done being used, which keeps them reachable and therefore un-collectible, even though nobody meant for that to happen.
- Assuming an object is definitely still in memory (or definitely already gone) at some precise moment based on when its last reference was removed — reachability determines *eligibility*, not the exact collection timestamp, and Java deliberately gives no guarantee about the latter.

**Interview angle:** "How does garbage collection actually decide what to collect, and can you force it?" is a common follow-up once a candidate has shown they understand the heap conceptually. The answer interviewers are listening for: eligibility is based on reachability from GC roots, not a simple reference count; the generational hypothesis (most objects die young) is why collection is split into young/old generations and is cheap in practice; and `System.gc()` is only ever a hint, never a guarantee — a candidate who claims Java lets you force or predict exact GC timing is signaling a real gap.

---

## 8. Hands-On Exercises

### Exercise 1 — Observe eligibility, not collection

Write the `EligibilityDemo` example above (or your own variant). Add a comment at the line where the object becomes eligible for collection, and a separate comment explaining, in your own words, why the code cannot know or control exactly when (or if, before the program exits) that object's memory is actually reclaimed.

### Exercise 2 — Build an accidental "leak"

Write a small program with a `static List<byte[]>` field. In a loop, repeatedly add a large `byte[]` array to it without ever removing anything, and print the loop counter as it runs. Explain, in writing, why this is a legitimate Java "memory leak" even though the JVM's garbage collector is working correctly the entire time — the objects are being kept reachable on purpose (if accidentally), not lost track of.

### Exercise 3 — Distinguish the two classic errors

Write two tiny programs on purpose: one that triggers `StackOverflowError` (unbounded recursion) and one that triggers `OutOfMemoryError: Java heap space` (e.g. repeatedly appending to a growing `List` in an infinite loop with no way to stop). Run both, compare the two stack traces, and write one sentence explaining which JVM memory region each error actually comes from.

---

## 9. Interview Q&A

### Q1. How does the JVM decide an object is eligible for garbage collection?

**Answer:** An object becomes eligible once it is no longer reachable — there is no chain of live references, starting from a GC root (such as a local variable on an active stack frame or a static field), that leads to it. This is a reachability trace, not a simple reference count, which also correctly handles two objects that reference each other but that nothing else can reach.

---

### Q2. Does calling `System.gc()` force an immediate garbage collection?

**Answer:** No. `System.gc()` is only a hint suggesting to the JVM that now might be a good time to run garbage collection — the JVM is free to ignore it, delay it, or run a collection that doesn't even touch the objects you were hoping to see reclaimed. Java provides no API to force or precisely predict collection timing.

---

### Q3. What is the generational hypothesis, and why does it matter for GC performance?

**Answer:** It's the empirical observation that most objects become unreachable very shortly after creation, while a small minority live much longer. Because of this, the heap is split into a young generation (collected frequently and cheaply, since most of what's there is already garbage) and an old generation (collected less often, holding objects that have survived multiple young-generation collections). This split is why garbage collection is, in practice, much cheaper than scanning the entire heap every time.

---

### Q4. What's the difference between `OutOfMemoryError: Java heap space` and `StackOverflowError`?

**Answer:** They come from different memory regions. `OutOfMemoryError: Java heap space` happens when the shared heap can't allocate more objects because too many remain reachable (often due to unintentionally-retained references — a memory leak). `StackOverflowError` happens when one thread's separate, fixed-size call stack is exhausted, almost always from recursion with a missing or incorrect base case.

---

### Q5. What does "memory leak" mean in Java, given that there's no manual `free`?

**Answer:** It means references are unintentionally kept alive somewhere reachable — a static collection that's only ever added to, a listener that's registered but never unregistered, a cache with no eviction policy — which keeps the objects those references point to reachable, and therefore ineligible for garbage collection, even though the program logically no longer needs them. The garbage collector is working correctly the entire time; the "leak" is in the program's own reference graph, not in the collector failing to do its job.

---

> 🧠 **Memory hook:** "No claim ticket, no protection — the decluttering service only guarantees it *will* eventually clear unclaimed items, never exactly when; `System.gc()` is just knocking on its door, not giving it an order."
