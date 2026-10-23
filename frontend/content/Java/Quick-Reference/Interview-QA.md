# Java Interview Q&A

50 questions covering the full Java course, organized by topic.

---

## Java Fundamentals & OOP (Q1–Q10)

### Q1. What is the difference between the JDK, the JRE, and the JVM?

**Answer:** The JVM (Java Virtual Machine) is the engine that actually executes compiled bytecode, and is what makes a compiled `.class` file run identically on any platform with a compatible JVM. The JRE (Java Runtime Environment) bundles the JVM with the standard library — enough to *run* an already-compiled program. The JDK (Java Development Kit) bundles a full JRE plus development tools, most importantly the `javac` compiler, so you need the JDK to write and compile Java code, not just run it.

---

### Q2. What happens when you compile and run a simple `HelloWorld.java` program?

**Answer:** `javac HelloWorld.java` translates the human-readable source into a platform-independent `.class` bytecode file — it does not execute anything. Running `java HelloWorld` then hands that bytecode to the JVM, which loads the class and calls its `public static void main(String[] args)` method. Each keyword in that signature matters: `public` lets the JVM call it from outside the class, `static` means no instance is needed first, and `String[] args` receives command-line arguments.

---

### Q3. Why must a public class's name match its source file's name?

**Answer:** Java enforces this convention so the compiler and the class loader can always locate the file defining a given public class by name alone, without scanning file contents. `HelloWorld.java` must contain `public class HelloWorld`, or `javac` reports a compile error. This is part of the same predictability that lets tools resolve classes to files mechanically.

---

### Q4. What does it mean that Java is "statically and strongly typed," and how does that affect integer division?

**Answer:** Statically typed means every variable's type is fixed at declaration and checked by the compiler before the program runs. Strongly typed means the compiler won't let a value be used where its type doesn't fit without an explicit conversion. One concrete consequence: `7 / 2` evaluates to `3`, not `3.5`, because both operands are `int` literals and integer division truncates — getting `3.5` requires at least one operand to be a floating-point type, e.g. `7.0 / 2`.

---

### Q5. What is the difference between `=` and `==`, and why is confusing them dangerous?

**Answer:** `=` is the assignment operator — it stores a value into a variable. `==` is the equality operator — it compares two values and produces a `boolean`. Accidentally writing `if (isShipped = true)` inside a condition assigns `true` to `isShipped` and then uses that assignment's result as the condition, silently making the branch always true instead of comparing anything.

---

### Q6. What is the difference between a class and an object, and what does `new` actually do?

**Answer:** A class is a blueprint that defines what fields and methods its instances will have, but holds no data itself. An object is a concrete instance created from that blueprint via `new`, with its own independent copy of the class's fields — `new` allocates memory for that object, runs the matching constructor, and returns a reference to it. Two objects from the same class with the same constructor arguments are still fully independent; changing one never affects the other.

---

### Q7. What is encapsulation, and why make fields `private` instead of just `public`?

**Answer:** Encapsulation means hiding a class's internal fields (typically `private`) and exposing controlled access only through public methods like getters and setters. This lets the class enforce its own validity rules — for example, a setter rejecting a negative age — at the single point where the field can change, instead of trusting every piece of calling code across the program to behave correctly.

---

### Q8. What is the difference between method overloading and method overriding?

**Answer:** Overloading means multiple methods share a name but differ in parameter list (count and/or types); which one runs is resolved at compile time based on the arguments passed. Overriding means a subclass supplies a new implementation for a method with the exact same signature as its superclass; which version actually runs is resolved at runtime based on the object's real type — this is dynamic dispatch. `@Override` should always be used when overriding, since it turns an accidental signature mismatch (which would otherwise silently become an unrelated overload) into a compile error.

---

### Q9. Why can't you instantiate an abstract class, and what's the difference between an abstract class and an interface?

**Answer:** An abstract class can declare abstract methods with no body, so instantiating it directly would create an object where calling that method has nothing to run — the compiler forbids this; only a concrete subclass implementing every abstract method can be instantiated. An abstract class can hold real instance state and constructors and supports only single inheritance (`extends` one class), while an interface is a pure contract with no instance fields (besides constants), no constructors, but can be implemented by any number of classes at once — a class may `implements` many interfaces but `extends` only one class.

---

### Q10. What is polymorphism, and what mechanism makes it work at runtime?

**Answer:** Polymorphism is the ability for a variable declared with a parent (or interface) type to hold a reference to any subtype object, with an overridden method call resolved based on the object's actual type rather than the variable's declared type. This runtime resolution is called dynamic dispatch — for example, `Animal a = new Dog("Rex"); a.makeSound();` runs `Dog`'s version of `makeSound`, decided when the call executes, not when the code was compiled.

---

## Collections Framework (Q11–Q18)

### Q11. What's the difference between `ArrayList` and `LinkedList`, and which should you default to?

**Answer:** `ArrayList` is backed by a resizable array, giving O(1) random access by index but O(n) insertion/removal in the middle since later elements must shift. `LinkedList` is a doubly-linked list of nodes, giving O(1) insertion/removal at either end but O(n) random access, since it must walk node-by-node to reach a position. `ArrayList` is usually the better default even for frequent insertions, because contiguous array memory is far more CPU-cache-friendly than scattered linked-list nodes.

---

### Q12. Why does `list.remove(1)` behave differently from `list.remove(Integer.valueOf(1))` on a `List<Integer>`?

**Answer:** `remove(1)` with an `int` literal resolves to the `remove(int index)` overload and removes whatever element sits at index 1. `remove(Integer.valueOf(1))` passes an `Integer` object, which resolves instead to the `remove(Object)` overload, removing the first element that is *equal to the value* 1 regardless of position. This overload ambiguity is a classic source of subtle bugs when working with `List<Integer>`.

---

### Q13. What's the core difference between a `Set` and a `List`, and between `HashSet`, `LinkedHashSet`, and `TreeSet`?

**Answer:** A `List` is an ordered sequence that allows duplicates and is accessed by index; a `Set` guarantees no duplicate elements and is accessed primarily by membership. Among `Set` implementations, `HashSet` gives O(1) average operations with no ordering guarantee, `LinkedHashSet` adds predictable insertion-order iteration on top of the same hashing, and `TreeSet` keeps elements sorted at all times at the cost of O(log n) operations.

---

### Q14. Why is `HashMap` lookup so much faster than scanning a `List` for a matching element?

**Answer:** `HashMap` computes a hash code for the key and uses it to jump almost directly to the bucket where a matching entry would live, making `get`/`put` O(1) on average. A `List` has no such structure, so finding an element means checking each one in sequence, which is O(n). This is why `Map` is the right structure whenever lookups are keyed rather than positional.

---

### Q15. What does `getOrDefault` do, and what classic pattern does it simplify?

**Answer:** `getOrDefault(key, default)` returns the value mapped to `key` if present, or the given default otherwise, in one expression. It collapses the classic counting pattern — checking `containsKey` or a `null` result before deciding whether to initialize or increment — into a single line, e.g. `counts.put("apple", counts.getOrDefault("apple", 0) + 1)`.

---

### Q16. Why can a mutable object make a bad `HashMap` or `HashSet` key?

**Answer:** A `HashMap`/`HashSet` places an entry into a bucket based on its `hashCode()` at the moment of insertion. If the object is later mutated in a way that changes its `hashCode()`, a subsequent lookup computes a different bucket than the one the entry actually lives in, so `get()`/`contains()` silently fails to find it — even though an `.equals()`-equal object exists somewhere in the structure.

---

### Q17. What's the difference between `poll()`/`peek()` and `remove()`/`element()` on a `Queue` when it's empty?

**Answer:** `poll()` and `peek()` return `null` if the queue is empty, making them the "safe" choice when an empty queue is a normal, expected case. `remove()` and `element()` throw `NoSuchElementException` instead. A `PriorityQueue` additionally always returns the smallest element (by natural ordering or a supplied `Comparator`) from `poll()`, not the earliest-added one — it is not FIFO, unlike `ArrayDeque` used as a queue.

---

### Q18. What's the difference between `Comparable` and `Comparator`, and why should `compareTo` stay consistent with `equals`?

**Answer:** `Comparable<T>` is implemented by the class itself to define one intrinsic natural ordering via `compareTo`, used automatically by `Collections.sort(list)` with no arguments. `Comparator<T>` is an external, standalone object passed in to define an arbitrary ordering via `compare`, and any number of them can exist for the same class without modifying it. `compareTo` should stay consistent with `equals` because sorted structures like `TreeSet`/`TreeMap` use `compareTo` (not `equals`) to detect duplicates — if it returns `0` for two objects that aren't actually `.equals()`, one gets silently dropped.

---

## Generics & Exception Handling (Q19–Q24)

### Q19. Why were generics added to Java, and what problem did they remove?

**Answer:** Before generics, a collection like `List` held plain `Object`s, so retrieving an element required an unchecked manual cast that could fail with a `ClassCastException` far from where the wrong type was actually inserted. Generics let the compiler verify type usage at the point of insertion and retrieval, catching that mismatch at compile time and eliminating the manual cast entirely.

---

### Q20. What is a bounded type parameter, and what do the wildcards `? extends T` and `? super T` mean?

**Answer:** A bounded type parameter like `<T extends Comparable<T>>` restricts a generic type to types supporting a specific capability, needed whenever a generic method must call a method (like `compareTo`) that an unbounded `<T>` wouldn't guarantee. `? extends T` means "some unknown subtype of `T`," safe to read from but not to add to; `? super T` means "some unknown supertype of `T`," safe to write `T` values into but only readable as `Object`. The mnemonic is PECS: Producer Extends, Consumer Super.

---

### Q21. Do generics exist at runtime in the JVM?

**Answer:** Not directly — Java generics use type erasure, where the compiler checks generic type usage at compile time and then strips the type parameter from the compiled bytecode, replacing it with `Object` (or the bound, if one exists) and inserting the necessary casts automatically. This is why `List<String>` and a raw `List` are represented by the exact same class at runtime.

---

### Q22. What's the difference between a checked and an unchecked exception?

**Answer:** A checked exception (any `Exception` subclass that isn't a `RuntimeException`, e.g. `IOException`) must be either caught or declared with `throws` — enforced by the compiler. An unchecked exception (`RuntimeException` and its subclasses, e.g. `NullPointerException`) has no such requirement, and typically represents a programming mistake rather than an expected, recoverable external failure. A custom exception should `extends Exception` when callers must consciously handle it, or `extends RuntimeException` when it represents a bug not realistically expected to be recovered from.

---

### Q23. Does a `finally` block always run, and what does try-with-resources add on top of it?

**Answer:** `finally` runs whether the `try` block completes normally, throws a caught exception, or throws an exception that propagates uncaught — with only rare exceptions like a forced JVM exit. Try-with-resources builds on this by automatically calling `close()` on any `AutoCloseable` resource declared in the `try(...)` parentheses, in this case handling the resource cleanup itself instead of requiring a manual `close()` call inside a `finally` block; with multiple resources, they close in the reverse order they were declared.

---

### Q24. Why is broadly catching `Exception` generally discouraged?

**Answer:** Catching `Exception` broadly catches every possible exception type a call might throw, including ones you didn't anticipate and don't actually know how to handle — including genuine bugs like a stray `NullPointerException`. This can silently mask real problems instead of surfacing them, and it obscures the `catch` block's actual intent from future readers, so catching the most specific exception type that's actually expected is preferred.

---

## Lambdas & Streams (Q25–Q31)

### Q25. What problem do lambda expressions solve compared to anonymous inner classes?

**Answer:** Before Java 8, passing a small piece of behavior as a parameter required writing a whole anonymous inner class implementing some functional interface just to override one method — several lines of ceremony to express one idea. A lambda expresses the same logic in one line, e.g. `(a, b) -> a.compareTo(b)` instead of a multi-line `new Comparator<String>() { ... }` block, because the compiler infers the target functional interface from context.

---

### Q26. What are `Function`, `Predicate`, `Supplier`, and `Consumer`?

**Answer:** These are the core `java.util.function` functional interfaces. `Function<T,R>` transforms a `T` into an `R` via `apply`. `Predicate<T>` performs a yes/no check via `test`, returning `boolean`. `Supplier<T>` produces a value with no input via `get`. `Consumer<T>` accepts a value and does something with it via `accept`, returning nothing.

---

### Q27. What's the difference between an intermediate and a terminal Stream operation?

**Answer:** An intermediate operation (`filter`, `map`, `sorted`, `distinct`, ...) returns a new Stream describing one more pipeline step and is lazy — it does nothing by itself. A terminal operation (`collect`, `forEach`, `reduce`, `count`, ...) is what actually triggers the entire pipeline to run, walking every source element through all intermediate steps in one pass. Laziness lets the pipeline be optimized as a single pass rather than materializing a full list after every step.

---

### Q28. Can a Stream be reused after a terminal operation runs on it?

**Answer:** No. Once a terminal operation executes, that Stream is considered consumed, and any further operation on the same Stream reference throws `IllegalStateException`. To repeat the same logic, a brand-new Stream must be created from the original source.

---

### Q29. What problem does `Optional` solve, and why is calling `.get()` without checking presence a mistake?

**Answer:** `Optional` makes "this method might legitimately have no result" an explicit, visible part of the return type, instead of relying on every caller remembering to check for `null`. Calling `.get()` without checking presence reintroduces the exact failure mode `Optional` was meant to prevent — if the `Optional` is empty, `.get()` throws `NoSuchElementException` just as unpredictably as an unchecked `null` dereference would have thrown `NullPointerException`; `orElse`, `orElseGet`, and `orElseThrow` are the safer alternatives.

---

### Q30. What's the difference between `Optional.of`, `Optional.empty`, and `Optional.ofNullable`?

**Answer:** `Optional.of(value)` wraps a known non-null value and throws `NullPointerException` immediately if given `null`. `Optional.empty()` explicitly creates an empty `Optional` with no value. `Optional.ofNullable(value)` is the flexible option, producing an empty `Optional` if `value` is `null` and a present one otherwise — the right choice when wrapping something that might or might not be `null`.

---

### Q31. What does a method reference like `String::compareTo` or `ArrayList::new` actually represent?

**Answer:** A method reference is shorthand for a lambda that does nothing but call an existing method or constructor. `ClassName::staticMethod` (e.g. `Integer::parseInt`) calls a static method with the lambda's arguments; `ClassName::instanceMethod` (e.g. `String::compareTo`) calls an instance method where the first lambda argument becomes the instance the method is called on; `object::instanceMethod` calls a method on a specific existing object; and `ClassName::new` (e.g. `ArrayList::new`) references a constructor.

---

## Java I/O and NIO (Q32–Q34)

### Q32. What's the difference between `InputStream`/`OutputStream` and `Reader`/`Writer`, and why wrap a `FileReader` in a `BufferedReader`?

**Answer:** `InputStream`/`OutputStream` work with raw bytes and suit arbitrary binary data (images, audio); `Reader`/`Writer` work with characters and suit text — a `FileReader` is really a byte stream with a character-decoding layer already applied. A plain `FileReader` can be inefficient read a small amount at a time since each read can carry real overhead; `BufferedReader` wraps it, reads in larger internal chunks, and adds the convenient `readLine()` method that a plain `Reader` lacks — this is why `BufferedReader.readLine()` returning `null` exactly once at end-of-file is the idiomatic loop condition: `while ((line = reader.readLine()) != null)`.

---

### Q33. What problem does `java.nio.file` (`Path`/`Files`) solve that `java.io.File` didn't?

**Answer:** `java.io.File` frequently reports failure as a bare `boolean` (e.g. `file.delete()` returning `false`) with no indication of why. The `Path`/`Files` API throws specific, informative exceptions (typically `IOException` or a subclass) instead, giving callers an actual reason for failure. `Path.of(...)` (Java 11+, preferred) or the older `Paths.get(...)` build a `Path`, and `Files` supplies convenience methods like `writeString`, `readAllLines`, and `copy` that operate on it directly.

---

### Q34. What's the risk of using `Files.readAllLines` carelessly, and what's the alternative for large files?

**Answer:** `Files.readAllLines` reads the entire file into memory in one call as a `List<String>`, which is exactly the problem for a file too large to comfortably fit in memory. For that case, streaming line-by-line with `BufferedReader.readLine()` or the lazily-read `Files.lines(path)` (itself closed via try-with-resources) keeps memory usage bounded regardless of file size, instead of materializing the whole file at once.

---

## Concurrency & Multithreading (Q35–Q40)

### Q35. What is the difference between calling `thread.start()` and `thread.run()`?

**Answer:** `start()` asks the JVM to create a genuinely new, concurrent thread of execution and run the task's `run()` method on it. `run()` called directly is just an ordinary synchronous method invocation on whatever thread called it — no new thread is created at all, and the call blocks the caller just like any normal method call.

---

### Q36. What is a race condition, and why isn't `counter++` atomic?

**Answer:** A race condition occurs when two or more threads access shared, mutable data at the same time without coordination, and the outcome depends on unpredictable timing. `counter++` isn't atomic because it compiles down to three separate steps — read, increment, write — and if two threads' steps interleave, one thread's write can silently overwrite the other's before it's ever used, producing a final count lower than expected even though both threads executed the increment.

---

### Q37. How does `synchronized` fix a race condition, and how does `AtomicInteger` fix the same problem without locks?

**Answer:** `synchronized` uses an object's intrinsic lock so only one thread can execute a guarded block at a time, forcing one thread to fully complete its read-increment-write sequence before another can start. `AtomicInteger` achieves the same correctness via a CPU-level atomic compare-and-swap operation instead of a lock — it reads, computes, and writes back only if nothing changed in between, retrying otherwise — without ever making a thread block and wait.

---

### Q38. Why use an `ExecutorService` instead of creating `Thread` objects directly?

**Answer:** Creating a raw thread per task has real overhead (native thread allocation, its own stack, OS scheduling) and gives no control over how many run concurrently. An `ExecutorService`-backed thread pool reuses a bounded set of worker threads pulling from a shared task queue, avoiding per-task creation overhead, capping concurrency, and returning `Future` objects for clean result retrieval. `.shutdown()` must always be called, or the pool's threads keep running indefinitely and can prevent the JVM from exiting.

---

### Q39. What is a `Future`, and what does calling `.get()` on it do?

**Answer:** A `Future<T>` is a placeholder for a result that a submitted `Callable<T>` task will eventually produce, returned immediately by `ExecutorService.submit(...)` even while the task is still running. Calling `.get()` blocks the calling thread until the task completes, then returns its result, or throws `ExecutionException` if the task itself threw an exception.

---

### Q40. What does `CountDownLatch` let you do that plain `Thread.join()` doesn't as naturally, and what is `ConcurrentHashMap` for?

**Answer:** `CountDownLatch` lets any number of threads signal completion via `.countDown()`, while one or more separate threads wait for all of them via `.await()` — useful when the waiting thread doesn't hold direct `Thread` references to `.join()` on, or when waiting on a count of events rather than specific thread objects. `ConcurrentHashMap` is a thread-safe `Map` implementation that can be shared across threads without manual `synchronized` blocks, unlike a plain `HashMap`.

---

## JVM Internals & Memory Management (Q41–Q44)

### Q41. What's the difference between the stack and the heap in the JVM's memory model?

**Answer:** Each thread has its own stack, holding local variables and method call frames in strict last-in-first-out order — a frame is pushed on method entry and popped on return. The heap is a single shared area holding all objects (created via `new`), reachable from any thread that has a reference to them, and is what the garbage collector manages. A variable on the stack holding an object only stores a reference into the heap, not the object itself.

---

### Q42. How does the JVM decide an object is eligible for garbage collection, and does `System.gc()` force it to happen?

**Answer:** An object becomes eligible once it's no longer reachable — no chain of live references, starting from a GC root such as a local variable on an active stack frame or a static field, leads to it. This reachability trace correctly handles two objects referencing each other that nothing else can reach. `System.gc()` is only a hint; the JVM is free to ignore it, delay it, or run a collection that doesn't reclaim the objects you were hoping for — Java provides no API to force or precisely predict collection timing.

---

### Q43. What is the generational hypothesis, and why does it make garbage collection cheaper?

**Answer:** It's the empirical observation that most objects become unreachable very shortly after creation, while a small minority live much longer. The heap is split accordingly into a young generation (collected frequently and cheaply, since most of what's there is already garbage) and an old generation (collected less often, holding objects that survived multiple young-generation collections) — this split is why garbage collection is, in practice, far cheaper than scanning the entire heap every time.

---

### Q44. What's the difference between `OutOfMemoryError: Java heap space` and `StackOverflowError`, and what typically causes a Java "memory leak" given there's no manual `free`?

**Answer:** `OutOfMemoryError: Java heap space` happens when the shared heap can't allocate more objects because too many remain reachable, often from unintentionally-retained references. `StackOverflowError` happens when one thread's fixed-size call stack is exhausted, almost always from recursion missing a base case. A Java "memory leak" means references are unintentionally kept alive somewhere reachable (a static collection only ever added to, an unregistered listener, an unbounded cache) — the collector is working correctly the whole time; the leak is in the program's own reference graph.

---

## Modern Java Features (Q45–Q47)

### Q45. What does declaring `public record Point(int x, int y) {}` generate, and what does a compact canonical constructor look like for validation?

**Answer:** It generates a canonical constructor `Point(int x, int y)`, accessor methods `x()` and `y()` named after the components (not `getX()`), an `equals()`/`hashCode()` pair based on all components, and a `toString()` like `Point[x=..., y=...]` — components are implicitly `private final`. A compact canonical constructor for validation is written with **no parameter list**, since it's implied by the record header, e.g.:
```java
public record Range(int low, int high) {
    public Range {
        if (low > high) throw new IllegalArgumentException("low > high");
    }
}
```

---

### Q46. What problem does a `sealed` interface solve, and how does pattern matching for `switch` handle it?

**Answer:** A plain interface can be implemented by any class anywhere, so consuming code can never assume it has seen every implementation. A `sealed` interface's `permits` clause names the complete, closed set of allowed implementers, letting both readers and the compiler treat the hierarchy as fully known. This enables exhaustive pattern matching in a `switch` expression over that sealed type with no `default` branch required, since the compiler can verify every permitted case is handled.

---

### Q47. What does pattern matching for `instanceof` save you from doing, and what problem do text blocks solve?

**Answer:** `if (obj instanceof String s)` both confirms the type and binds a correctly-typed variable `s` in one step, removing the separate explicit cast that used to be required after a successful `instanceof` check. Text blocks (`"""..."""`) remove the need to escape embedded quotes and manually join lines with `\n` and `+` for multi-line string literals, with incidental common leading whitespace automatically stripped so the block can be indented to match surrounding code.

---

## Build Tools & Testing (Q48–Q50)

### Q48. What problem does a build tool like Maven or Gradle solve, and what are Maven coordinates?

**Answer:** A build tool gives a project a repeatable, one-command way to resolve declared dependencies (including transitive ones) and to compile, test, and package code in a fixed order, so the same project produces the same artifact on any machine. Maven coordinates are the three-part identifier used to uniquely locate a dependency: `groupId` (publishing organization/namespace), `artifactId` (the library's name), and `version` — Gradle uses the same three parts, typically as one colon-separated string.

---

### Q49. What is Maven's standard project layout, and what do `mvn compile`, `mvn test`, and `mvn package` each do?

**Answer:** Application source lives under `src/main/java`, and test source lives under `src/test/java` — a fixed convention that lets Maven and IDEs locate files without explicit configuration. `mvn compile` compiles `src/main/java`; `mvn test` compiles and runs everything under `src/test/java`; `mvn package` bundles the compiled code into a distributable `.jar`, and running a later phase always runs the earlier ones first.

---

### Q50. What do `@Test`, `@BeforeEach`, and `assertThrows` do in JUnit 5, and what problem does Mockito solve?

**Answer:** `@Test` marks a method as a test case JUnit discovers and runs independently, reporting pass/fail per method. `@BeforeEach` runs before every `@Test` in the class, commonly used to set up a fresh object under test so tests don't share state. `assertThrows(ExceptionType.class, () -> ...)` passes only if the lambda throws exactly that exception type. Mockito replaces a real, possibly slow or unpredictable dependency with a fully controllable mock object during a test, isolating the class under test so the result depends only on its own logic, not on an external system's current state.
