# Java Course — Design Spec

## Purpose

Add a new "Java" course to SkillVault, matching the existing course structure (Docker, Kubernetes, MongoDB, MySQL, HLD, AWS, RAG, Redis) with the same deviation as the Redis course: **no `README.md` files anywhere** (not top-level, not per-phase, not in `Projects/`), per explicit user request. Scope is deliberately **pure core Java** — language, JVM, standard library, and tooling — with zero overlap with the existing SpringBoot course, which already owns the framework layer (dependency injection, REST, JPA, Spring Security). Audience: a learner who knows basic programming logic but has no prior Java experience — beginner-to-advanced learning pace, ending at practitioner-level. Every lesson follows the established explanation style: problem → analogy → internal flow → code example → comparison table → common mistakes → interview angle → hands-on exercises → interview Q&A → memory hook (same style used in the RAG and Redis courses).

## Structure

```
Java/
├── Phase-01-Java-Fundamentals-and-Setup/
├── Phase-02-Object-Oriented-Programming/
├── Phase-03-Arrays-Strings-and-Core-Utility-Classes/
├── Phase-04-Collections-Framework/
├── Phase-05-Generics-and-Exception-Handling/
├── Phase-06-Lambdas-and-Streams/
├── Phase-07-Java-IO-and-NIO/
├── Phase-08-Concurrency-and-Multithreading/
├── Phase-09-JVM-Internals-and-Memory-Management/
├── Phase-10-Modern-Java-Features/
├── Phase-11-Build-Tools-and-Testing/
├── Phase-12-Best-Practices-and-Production-Patterns/
├── Projects/
└── Quick-Reference/
```

12 phases, matching the standard SkillVault course length. **No `README.md` file exists anywhere in this course** — each phase folder contains only numbered lesson files (`01-Topic.md`, `02-Topic.md`, ...), `Projects/` contains only numbered project files, and there is no top-level course overview file.

## Phase Contents

1. **Java Fundamentals & Setup** — JDK vs JRE vs JVM, installing a JDK, `javac`/`java` compile-and-run cycle, variables and primitive types, operators, control flow (`if`/`switch`/loops), the `public static void main` entry point explained.
2. **Object-Oriented Programming** — classes and objects, constructors, encapsulation (access modifiers), inheritance (`extends`), polymorphism (overriding/overloading), abstract classes vs interfaces, the `this`/`super` keywords.
3. **Arrays, Strings & Core Utility Classes** — arrays (declaration, multi-dimensional), `String` immutability, `StringBuilder`/`StringBuffer`, wrapper classes and autoboxing/unboxing, `Objects`/`Arrays` utility methods.
4. **Collections Framework** — the `Collection`/`Map` hierarchy, `List` (`ArrayList`/`LinkedList`), `Set` (`HashSet`/`TreeSet`/`LinkedHashSet`), `Map` (`HashMap`/`TreeMap`/`LinkedHashMap`), `Queue`/`Deque`, `Comparable` vs `Comparator`, iteration and the `Iterator` interface.
5. **Generics & Exception Handling** — generic classes/methods, bounded type parameters (`<T extends ...>`), wildcards (`? extends`/`? super`), checked vs unchecked exceptions, `try`/`catch`/`finally`, try-with-resources and `AutoCloseable`, custom exception classes.
6. **Lambdas & Streams** — functional interfaces (`Runnable`, `Comparator`, `Function`, `Predicate`, `Supplier`, `Consumer`), lambda expression syntax, method references, the `Stream` API (`map`/`filter`/`reduce`/`collect`), `Optional`.
7. **Java I/O and NIO** — `File`, byte streams vs character streams, `BufferedReader`/`BufferedWriter`, the modern `java.nio.file` API (`Path`/`Files`), reading/writing files the recommended modern way, basic object serialization.
8. **Concurrency & Multithreading** — creating threads (`Thread`, `Runnable`), the `synchronized` keyword and intrinsic locks, race conditions and thread safety, `ExecutorService` and thread pools, key `java.util.concurrent` types (`ConcurrentHashMap`, `CountDownLatch`, `AtomicInteger`).
9. **JVM Internals & Memory Management** — class loading at a conceptual level, the heap vs the stack, object lifecycle and garbage collection (generational GC concepts, common collectors named at a survey level), the JIT compiler's role, common `OutOfMemoryError`/`StackOverflowError` causes.
10. **Modern Java Features** — `var` (local variable type inference), records, sealed classes/interfaces, pattern matching for `instanceof` and `switch`, switch expressions, text blocks — framed as "what changed and why" for a learner coming from older Java tutorials/material.
11. **Build Tools & Testing** — Maven vs Gradle at a conceptual and practical level (project structure, dependency declaration, running a build), JUnit 5 (`@Test`, assertions, lifecycle annotations), a basic introduction to Mockito for mocking dependencies in a unit test.
12. **Best Practices & Production Patterns** — core design principles (favor composition over inheritance, program to an interface, immutability where practical), common beginner-to-intermediate pitfalls, basic performance considerations, packaging a runnable JAR, and an introduction to logging (`java.util.logging` conceptually, why a logging framework is preferred over `System.out.println` in real applications).

Each phase folder contains numbered lesson files (`01-Topic.md`, `02-Topic.md`, ...) — no `README.md`. All code examples are Java. Every non-trivial Java or general-programming construct is explained inline on first use, consistent with the RAG/Redis courses' established pattern, since the audience knows basic programming logic but not Java specifically.

## Projects/ (6, beginner → advanced)

1. Command-Line Utility (Phases 1-3: fundamentals, control flow, String handling — e.g. a simple text-processing CLI tool)
2. Collections-Based Inventory System (Phase 4: modeling an inventory with `List`/`Map`, custom `Comparator` sorting)
3. Generic Data Structure with Custom Exceptions (Phase 5: a small generic container class with proper exception handling)
4. Multithreaded Task Processor (Phase 8: `ExecutorService`-based concurrent task processing with shared state handled safely)
5. File-Processing Utility Using Streams and NIO (Phases 6, 7: reading/transforming files with the Stream API and `java.nio.file`)
6. Tested, Packaged Capstone Library (Phases 9-12: a small utility library combining modern Java features, JUnit tests, and Maven/Gradle packaging into a runnable JAR)

No `README.md` index file in `Projects/` — just the 6 numbered project files.

## Quick-Reference/

- `Java-Cheatsheet.md` — quick lookup across all phases (OOP syntax reference, collections comparison, generics/exceptions syntax, Stream API operations, concurrency primitives, modern Java feature syntax, build tool commands).
- `Interview-QA.md` — 50 interview questions covering Java fundamentals/OOP, collections, generics/exceptions, streams/lambdas, concurrency, JVM/memory management, modern Java features, and build tools/testing.

These are named files, not `README.md`, so they remain per the "no README" constraint.

## Out of Scope

- Spring / Spring Boot / any DI framework — fully covered by the existing SpringBoot course; this course stays at the core-language level.
- Web frameworks, servlets, JSP — out of scope for a core-Java course.
- Deep JVM tuning (GC flag tuning, bytecode-level analysis) — Phase 9 covers JVM internals conceptually, not at a performance-engineering depth.
- Android development — a distinct platform-specific topic, not covered here.
