# 01 — Heap, Stack, and the Object Lifecycle

> A comprehensive reference covering where Java variables and objects actually live in memory, how the stack and heap divide responsibilities, `StackOverflowError`, class loading, and the classic "why did modifying this object inside a method affect the caller's copy" confusion.

---

## Table of Contents

1. [The Problem: Where Does an Object Actually Live?](#1-the-problem-where-does-an-object-actually-live)
2. [The Analogy: Cafeteria Trays vs a Shared Warehouse](#2-the-analogy-cafeteria-trays-vs-a-shared-warehouse)
3. [The Stack: One Per Thread, Strictly Last-In, First-Out](#3-the-stack-one-per-thread-strictly-last-in-first-out)
4. [The Heap: The Shared Object Warehouse](#4-the-heap-the-shared-object-warehouse)
5. [Stack vs Heap at a Glance](#5-stack-vs-heap-at-a-glance)
6. [Class Loading, Briefly](#6-class-loading-briefly)
7. [Code Example: Recursion, StackOverflowError, and References Into the Heap](#7-code-example-recursion-stackoverflowerror-and-references-into-the-heap)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Where Does an Object Actually Live?

Java famously never makes you manually allocate or free memory the way C or C++ does — there's no `malloc`, no `free`, no explicit `delete`. You just write `new Person("Ana", 30)` and a usable object appears. That convenience hides a real question every Java developer eventually has to answer, usually while debugging something confusing: **when you create an object inside a method, where does it actually live, and how long does it stick around?**

The answer matters in practice. It explains why a `StackOverflowError` happens from "too much recursion" but never a "too many objects" error with the same name. It explains why passing an object into a method and modifying one of its fields is visible to the caller afterward, while reassigning a local primitive inside that same method is not. And it sets up the next lesson's topic — garbage collection — which only makes sense once you know *where* the things being collected actually sit.

---

## 2. The Analogy: Cafeteria Trays vs a Shared Warehouse

**Real-world analogy:** picture a busy cafeteria. Each customer gets their own **tray** the moment they walk in, stacked strictly one on top of the last — the newest tray is always the one currently in use, and the moment a customer finishes and leaves, their tray (and everything on it) is removed instantly. Nobody else can reach into someone else's tray.

Now picture a separate, shared **warehouse** behind the cafeteria, holding bulk ingredients that any cook, at any station, might need to reach for. An ingredient stays in the warehouse for as long as *at least one* cook still has a claim on it — it isn't tied to any single tray, and it doesn't disappear just because one particular customer finished their meal and left.

**The tray stack is your method call stack. The warehouse is the heap.** Local variables and method call frames live on a tray that appears when a method starts and vanishes the instant it returns. Objects created with `new` live in the shared warehouse (the heap), reachable from wherever something still holds a reference to them — potentially long after the method that created them has already returned.

---

## 3. The Stack: One Per Thread, Strictly Last-In, First-Out

Every thread in a running Java program gets its **own stack** — a region of memory used exclusively for that thread's method calls. Each time a method is invoked, a new **stack frame** is pushed onto that thread's stack, holding that method's local variables, its parameters, and bookkeeping for where execution should resume once the method returns. When the method returns, its frame is popped off — last in, first out, exactly like the cafeteria tray stack.

This has a concrete consequence: recursion that never terminates (or that recurses far too deeply before terminating) keeps pushing new frames without ever popping them off, until the stack runs out of space. At that point the JVM throws `StackOverflowError` — not because memory as a whole ran out, but because *this specific thread's* fixed-size stack region did. This is one of the classic causes of a missing recursive base case, and it's a separate failure mode from anything related to the heap.

Because each thread has its own independent stack, local variables are never shared between threads by default — Thread A can never accidentally see Thread B's local variables, since they simply live in different tray stacks. (Phase 8 covers what happens when threads *do* need to share state — that state lives on the heap, not the stack.)

---

## 4. The Heap: The Shared Object Warehouse

Every object you create with `new` — a `Person`, an `ArrayList`, an array — is allocated on the **heap**, a single shared memory region used by *all* threads in the JVM process. Unlike the stack, the heap isn't tied to any one method call or any one thread; an object placed on the heap stays there for as long as something, somewhere, can still reach it.

Here's the detail that trips up newcomers coming from languages with different rules: **a local variable that "holds" an object doesn't actually hold the object itself.** It holds a **reference** — conceptually just an address pointing into the heap — and that reference is what lives on the stack. The object's actual fields and data live on the heap, at the address the reference points to. Copy the reference into another variable, or pass it into a method as a parameter, and you now have two references pointing at the *same* heap object — not two independent copies of it.

This is exactly why modifying a field on an object passed into a method is visible to the caller after the method returns (both the caller's variable and the method's parameter are references pointing at the same heap object), while reassigning a local `int` parameter inside that method has no effect on the caller's variable at all (a primitive holds its value directly, with no separate object to share).

---

## 5. Stack vs Heap at a Glance

| | **Stack** | **Heap** |
|---|---|---|
| **What lives there** | Local variables, method parameters, references, call frames | Objects and arrays created with `new` |
| **Scope** | Per-thread — each thread has its own | Shared across the entire JVM process |
| **Lifetime** | Popped the instant the method returns | Lives as long as something can still reach it (until garbage collected — Lesson 2) |
| **Allocation speed** | Very fast — just moving a stack pointer | Slower, more bookkeeping involved |
| **Typical failure mode** | `StackOverflowError` (stack region exhausted, usually deep/infinite recursion) | `OutOfMemoryError: Java heap space` (heap region exhausted, usually a memory leak — Lesson 2) |

---

## 6. Class Loading, Briefly

Before any of this can happen for a given class, the JVM needs to actually load that class's compiled bytecode into memory. A **classloader** reads a class's `.class` file once, verifies it, and prepares it for use — this happens the first time the class is actually needed (for example, the first time it's instantiated or one of its static members is accessed), not all at once when the program starts. Once loaded, a class's metadata (its structure, static fields, method bytecode) is available to every thread in the JVM without needing to be reloaded again. This is a conceptual overview only — the full classloader hierarchy and delegation model is beyond the scope of this course.

---

## 7. Code Example: Recursion, StackOverflowError, and References Into the Heap

First, a method with no base case, showing conceptually why unbounded recursion exhausts the stack:

```java
public class RecursionDemo {

    // No base case — every call pushes another frame onto the stack
    // and none of them ever return, so frames are never popped.
    static void recurseForever(int depth) {
        recurseForever(depth + 1);
    }

    public static void main(String[] args) {
        recurseForever(0);
        // This line is never reached: recurseForever keeps calling itself,
        // pushing a new stack frame each time, until the thread's stack
        // is exhausted and the JVM throws java.lang.StackOverflowError.
    }
}
```

Running this program does not hang forever and does not silently consume all system memory — it terminates with a `StackOverflowError`, because the *stack* (not the heap) has a fixed, comparatively small size per thread.

Now, a diagram-style illustration (not runnable code) of a local primitive on the stack versus an object reference pointing into the heap:

```
main()'s stack frame:                     Heap:
┌─────────────────────────┐               ┌──────────────────────────┐
│ int age = 30;            │               │  Person object            │
│   → value 30 stored      │               │  name: "Ana"               │
│     directly in the frame│               │  age: 30                   │
│                           │               └──────────────────────────┘
│ Person p = new Person(); │                          ▲
│   → reference stored in  │──────────────────────────┘
│     the frame, POINTING  │   (the reference is the arrow;
│     at the heap object   │    the object itself lives on the heap)
└─────────────────────────┘
```

`age` holds its value directly — reassigning `age` inside a method has no effect anywhere else. `p` holds only a reference — pass `p` into another method, and that method's parameter points at the *same* heap object, so changes to `p`'s fields through that parameter are visible back in `main`.

**Common mistakes:**
- Assuming primitives and object references are stored the same way — a local primitive variable holds its actual value directly on the stack, while a local object reference holds only a pointer into the heap. This is the root cause of a lot of "I changed a field inside a method, why did the caller's object change too?" confusion (the object was shared via reference) versus "I reassigned a parameter inside a method, why didn't the caller's variable change?" confusion (the caller's own reference variable was never touched, only the method's local copy of it).
- Treating a `StackOverflowError` as a heap/memory problem and trying to fix it by increasing heap size — it's caused by the stack (usually via unbounded or too-deep recursion), and increasing the heap does nothing for it; the actual fix is adding or correcting a recursive base case, or, more rarely, explicitly increasing thread stack size.

**Interview angle:** "Where does an object live in Java, and what does a variable that refers to it actually hold?" is a very common warm-up question, often followed immediately by "what causes a `StackOverflowError`?" Interviewers want to hear the stack/heap split clearly — local variables and references live per-thread on the stack; the objects those references point to live in the shared heap — and that you understand `StackOverflowError` is a stack-exhaustion problem (usually recursion without a proper base case), not a heap or "out of memory" problem in the general sense.

---

## 8. Hands-On Exercises

### Exercise 1 — Trigger a real StackOverflowError

Write and run the `recurseForever` example above (or your own variant with no base case). Confirm it actually throws `java.lang.StackOverflowError` and look at the printed stack trace — notice how many repeated frames of the same method appear.

### Exercise 2 — Trace references by hand

Write a small `Counter` class with one `int` field and an `increment()` method. In `main`, create one `Counter`, assign it to a second variable (`Counter c2 = c1;`), call `c2.increment()`, and print `c1`'s field. Explain in your own words, in writing, why `c1` shows the incremented value even though you only called the method through `c2`.

### Exercise 3 — Diagram your own example

Pick any small method of your own that takes an `int` parameter and an object parameter, and modifies both inside the method body. Draw the same style of stack/heap diagram as the one in this lesson for your own example, showing exactly which values live directly on the stack and which are references pointing into the heap.

---

## 9. Interview Q&A

### Q1. Where do Java's local variables live, and where do objects live?

**Answer:** Local variables — including primitives and object references — live on the stack, inside the stack frame of the method call that declared them. The actual objects that references point to live on the heap, a memory region shared across the whole JVM process, not tied to any single method call.

---

### Q2. What causes a `StackOverflowError`, and how is it different from an out-of-memory error on the heap?

**Answer:** A `StackOverflowError` happens when a thread's stack — a fixed-size region used for method call frames — runs out of space, almost always from recursion that's either missing a base case or recurses far deeper than expected. It's unrelated to how much heap memory is available; increasing heap size does not fix it. A heap-related `OutOfMemoryError: Java heap space`, by contrast, happens when the shared heap can't allocate more objects, typically because too many objects are still reachable (often due to a memory leak — covered in Lesson 2).

---

### Q3. If I pass an object into a method and modify one of its fields, does the caller see the change?

**Answer:** Yes — the parameter is a reference to the same heap object the caller's variable refers to, not a separate copy of the object. Modifying a field through that reference modifies the one shared object, so the change is visible through the caller's own reference too.

---

### Q4. If I pass a primitive `int` into a method and reassign the parameter inside that method, does the caller's variable change?

**Answer:** No. A primitive parameter holds its own independent copy of the value, stored directly in that method's stack frame. Reassigning the parameter only changes that local copy; the caller's original variable, in its own stack frame, is untouched.

---

### Q5. Does every thread share one stack, or does each thread get its own?

**Answer:** Each thread gets its own separate stack. Local variables and call frames on one thread's stack are never visible to another thread. The heap, in contrast, is shared across all threads in the JVM process — which is exactly why shared mutable objects on the heap need coordination (covered in Phase 8) when multiple threads access them concurrently.

---

> 🧠 **Memory hook:** "Your tray disappears the moment you leave the cafeteria line; the warehouse ingredient stays as long as some cook can still reach it — stack frames pop on return, heap objects live on as long as they're reachable."
