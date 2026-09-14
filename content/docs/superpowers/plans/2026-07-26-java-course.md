# Java Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete "Java" course under `/Users/ganeshpirikirala/Desktop/SkillVault/Java/`, matching SkillVault's course conventions (12 phases, `Projects/`, `Quick-Reference/`) with one explicit deviation: **no `README.md` file anywhere in this course** — per `docs/superpowers/specs/2026-07-26-java-course-design.md`. Scope is pure core Java (language, JVM, standard library, tooling) — zero overlap with the existing SpringBoot course.

**Architecture:** This is a Markdown-only content repository — no code to test, no build system (see CLAUDE.md). "Tests" in this plan are verification steps: confirm each file exists at the right path, follows naming/numbering conventions, contains required structural sections, and — critically — that no `README.md` file exists anywhere under `Java/`. Each phase is one task creating only numbered lesson files. Content follows the established explanation style, mirroring the structural pattern already proven in `Redis/Phase-01-Redis-Fundamentals/01-What-is-Redis.md`.

**Tech Stack:** Markdown only. Code snippets inside lessons are Java (compilable/illustrative), targeting a modern LTS version (Java 17+) except where Phase 10 explicitly contrasts older syntax.

---

## Style Guide (apply to every lesson file in every task below)

Every lesson file (`NN-Topic.md`) must follow this structure, modeled on `Redis/Phase-01-Redis-Fundamentals/01-What-is-Redis.md` (a previously-reviewed and approved reference in this same repo):

1. **Title** — `# NN — Topic Name`
2. **One-line description blockquote** — `> A comprehensive reference covering ...`
3. **Table of Contents** — numbered links to every `##` section in the file, with entry TEXT matching each heading's text VERBATIM, including a final "Hands-On Exercises" and "Interview Q&A" section. Do NOT include any fenced-code-block sample heading in the ToC.
4. **Body sections**, each following: **problem** (why this matters, framed as a concrete pain point) → **analogy** (plain-language comparison) → **internal flow** (how it actually works, step by step) → **code example** (Java, runnable/illustrative) → **comparison table** (where relevant) → **common mistakes** (a bulleted "pitfalls" list) → **interview angle** (an inline bolded paragraph, e.g. `**Interview angle:** ...` — NOT its own heading — placed right after Common Mistakes, consistently in every lesson file).
5. **Hands-On Exercises** section — 2-3 small practical exercises the learner can do with just a JDK and a text editor.
6. **Interview Q&A** section — 3-5 short Q&A pairs specific to that lesson's topic.
7. **Memory hook** — a final one-line callout (e.g. `> 🧠 **Memory hook:** ...`).

Assume the reader knows basic programming logic (variables, loops, functions) from some other language, but has never written Java before. Explain any non-trivial Java construct (e.g. checked exceptions, generics wildcards, the diamond operator, static vs instance context, autoboxing) briefly inline the first time it's used.

**CRITICAL — code accuracy.** The RAG and Redis courses' review processes repeatedly caught prose that fabricated plausible-but-wrong claims about what code actually does/outputs, and code that read/used state before it was ever created. Apply the same rigor here:
- Every Java code snippet must be syntactically valid and reflect REAL language/API behavior — correct method names, signatures, and actual output. Trace through non-trivial examples by hand before claiming a specific printed value.
- Any code example that reads or uses a variable/object must ensure it was actually declared/initialized earlier in the same snippet.
- If uncertain of an exact API detail (e.g. an exact `java.util.concurrent` class method signature), describe it conceptually rather than fabricating a precise-but-wrong example.

**Cross-reference accuracy:** this is a 12-phase course. When referencing other phases by number, use EXACTLY this mapping: 1=Java Fundamentals & Setup, 2=Object-Oriented Programming, 3=Arrays-Strings-and-Core-Utility-Classes, 4=Collections Framework, 5=Generics-and-Exception-Handling, 6=Lambdas-and-Streams, 7=Java-IO-and-NIO, 8=Concurrency-and-Multithreading, 9=JVM-Internals-and-Memory-Management, 10=Modern-Java-Features, 11=Build-Tools-and-Testing, 12=Best-Practices-and-Production-Patterns.

---

## Task 1: Scaffold Course Skeleton

**Files:**
- Create: `Java/Phase-01-Java-Fundamentals-and-Setup/` through `Java/Phase-12-Best-Practices-and-Production-Patterns/` (empty directories)
- Create: `Java/Projects/` (empty directory)
- Create: `Java/Quick-Reference/` (empty directory)

- [ ] **Step 1: Create the directory structure**

Run:
```bash
cd /Users/ganeshpirikirala/Desktop/SkillVault
mkdir -p Java/Phase-01-Java-Fundamentals-and-Setup \
         Java/Phase-02-Object-Oriented-Programming \
         Java/Phase-03-Arrays-Strings-and-Core-Utility-Classes \
         Java/Phase-04-Collections-Framework \
         Java/Phase-05-Generics-and-Exception-Handling \
         Java/Phase-06-Lambdas-and-Streams \
         Java/Phase-07-Java-IO-and-NIO \
         Java/Phase-08-Concurrency-and-Multithreading \
         Java/Phase-09-JVM-Internals-and-Memory-Management \
         Java/Phase-10-Modern-Java-Features \
         Java/Phase-11-Build-Tools-and-Testing \
         Java/Phase-12-Best-Practices-and-Production-Patterns \
         Java/Projects \
         Java/Quick-Reference
```

- [ ] **Step 2: Verify structure**

Run: `find Java -maxdepth 1 -type d | sort`
Expected: 15 lines — `Java`, 12 `Phase-NN-*` dirs, `Projects`, `Quick-Reference`.

---

## Task 2: Phase 01 — Java Fundamentals & Setup

**Files:**
- Create: `Java/Phase-01-Java-Fundamentals-and-Setup/01-JDK-JRE-JVM-and-Your-First-Program.md`
- Create: `Java/Phase-01-Java-Fundamentals-and-Setup/02-Variables-Data-Types-and-Operators.md`
- Create: `Java/Phase-01-Java-Fundamentals-and-Setup/03-Control-Flow.md`

**No `README.md` in this phase folder — only these 3 numbered lesson files.**

- [ ] **Step 1: Write `01-JDK-JRE-JVM-and-Your-First-Program.md`**

Cover: the problem (Java code needs to run identically across different operating systems and hardware — how does that actually work?); analogy (a stage play performed in translation: the JVM is like a universal interpreter standing between the script (your `.class` bytecode) and whatever "language" the local machine actually speaks); internal flow (JDK = tools to write and compile Java (includes `javac`), JRE = what's needed to run Java (JVM + standard library), JVM = the actual bytecode-executing engine — `.java` source → `javac` compiles to `.class` bytecode → `java` launches the JVM which interprets/JIT-compiles that bytecode); code example: a minimal `HelloWorld.java` with `public class HelloWorld { public static void main(String[] args) { System.out.println("Hello, Java!"); } }`, explaining every keyword (`public`, `class`, `static`, `void`, `String[] args`) plainly, then the exact terminal commands `javac HelloWorld.java` followed by `java HelloWorld` and the real expected output; a table (JDK vs JRE vs JVM: what each contains, when you need which); common mistakes (forgetting the public class name must exactly match the filename, forgetting `public static void main` is the required, exact entry-point signature); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Variables-Data-Types-and-Operators.md`**

Cover: the problem (a program needs to hold and manipulate different kinds of data — a program with no way to store an age vs a name vs a price would be useless); analogy (labeled storage boxes of different fixed shapes — an `int` box physically can't hold a decimal, just like you can't fit a football in a shoebox); internal flow (primitive types: `int`, `double`, `boolean`, `char`, `long`, and their fixed sizes/ranges at a conceptual level; variable declaration and initialization syntax; arithmetic/relational/logical operators; the crucial distinction that Java is statically and strongly typed — a variable's type is fixed at declaration and checked at compile time); code example: declaring several primitives, printing them, and a worked arithmetic expression showing integer division truncation (`7 / 2` → `3`, not `3.5`) versus `7.0 / 2` → `3.5`; a table of primitive types (name, size, range, default value); common mistakes (integer division silently truncating instead of erroring, confusing `=` (assignment) with `==` (comparison)); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `03-Control-Flow.md`**

Cover: the problem (a program that always does the exact same thing regardless of input isn't useful — real logic needs to branch and repeat); analogy (a flowchart with decision diamonds and loop-back arrows — control flow statements are literally how you draw that flowchart in code); internal flow (`if`/`else if`/`else`, the classic `switch` statement (with fallthrough behavior and why `break` matters), `for`, `while`, `do-while` loops, `break`/`continue`); code example: a `for` loop summing numbers 1 to 10 with the running total printed, and a `switch` statement demonstrating fallthrough by deliberately omitting a `break` and showing the (surprising) resulting output; a comparison table (`for` vs `while` vs `do-while`: when each is idiomatic); common mistakes (forgetting `break` in a classic `switch` and falling through unintentionally, off-by-one errors in loop bounds); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Verify structure**

Run: `for f in Java/Phase-01-Java-Fundamentals-and-Setup/*.md; do echo "== $f =="; grep -c "^## " "$f"; grep -l "Interview Q&A" "$f"; grep -l "Memory hook" "$f"; done`
Expected: each of the 3 files reports at least 5 `##` sections and matches on both `Interview Q&A` and `Memory hook`.

Run: `ls Java/Phase-01-Java-Fundamentals-and-Setup/README.md 2>&1`
Expected: `No such file or directory`.

- [ ] **Step 5: Commit**

```bash
git add Java/Phase-01-Java-Fundamentals-and-Setup
git commit -m "Add Java Phase 01: Java Fundamentals and Setup"
```

---

## Task 3: Phase 02 — Object-Oriented Programming

**Files:**
- Create: `Java/Phase-02-Object-Oriented-Programming/01-Classes-Objects-and-Constructors.md`
- Create: `Java/Phase-02-Object-Oriented-Programming/02-Encapsulation-and-Inheritance.md`
- Create: `Java/Phase-02-Object-Oriented-Programming/03-Polymorphism-Abstract-Classes-and-Interfaces.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Classes-Objects-and-Constructors.md`**

Cover: the problem (once a program has more than a handful of related variables — a person's name, age, email — passing them around individually as separate parameters everywhere gets unwieldy and error-prone); analogy (a class as a cookie cutter, an object as an actual cookie — the cutter defines the shape once, and you can stamp out as many cookies from it as you want, each independent); internal flow (`class` declaration, fields, constructors (including the implicit no-arg constructor and what happens when you define your own), the `new` keyword and object creation, `this` referring to the current instance); code example: a `Person` class with `name`/`age` fields, a constructor taking both, and a `main` method creating two distinct `Person` objects and printing their fields to show they're independent; common mistakes (forgetting that defining any constructor removes the implicit no-arg one, confusing a class (the blueprint) with an object (an instance of it)); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Encapsulation-and-Inheritance.md`**

Cover: the problem (if every field is directly editable from anywhere, nothing stops other code from setting a `Person`'s age to `-5` — there's no way to enforce that data stays valid); analogy (encapsulation is a car's dashboard vs its engine bay — you interact through controlled interfaces (steering wheel, pedals), not by reaching in and rewiring the engine directly; inheritance is a species hierarchy — a `Dog` "is-a" `Animal` and automatically has everything an `Animal` has, plus its own specifics); internal flow (access modifiers `private`/`protected`/`public`/package-private, getters/setters as the controlled-access pattern, validation inside a setter, `extends` for inheritance, the `super` keyword to call a parent constructor/method, method overriding with `@Override`); code example: a `Person` class with a `private int age` field and a `setAge` method that rejects negative values, then an `Employee extends Person` class adding a `salary` field and calling `super(name, age)` in its constructor; common mistakes (making fields `public` "just to make it easier," forgetting `@Override` and accidentally overloading instead of overriding due to a typo'd method signature); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `03-Polymorphism-Abstract-Classes-and-Interfaces.md`**

Cover: the problem (you often want to write code that works with "any kind of Animal" without knowing or caring whether it's specifically a `Dog` or a `Cat` at compile time); analogy (a universal remote control — pressing "power" works the same way regardless of which brand of TV it's actually pointed at, because every TV implements the same `power()` behavior in its own way); internal flow (polymorphism: a parent-type reference can point to a child-type object, and calling an overridden method invokes the child's version at runtime (dynamic dispatch); abstract classes (`abstract class`, abstract methods with no body, can't be instantiated directly, can still hold shared state/concrete methods); interfaces (pure contracts — historically no state, `default` methods as a modern addition); when to choose an abstract class vs an interface); code example: an abstract `Animal` class with an abstract `makeSound()` method, two subclasses `Dog`/`Cat` each implementing it differently, and a loop over an `Animal[]` array calling `makeSound()` on each, showing each one's own version runs; a comparison table (abstract class vs interface: state, constructors, multiple inheritance, when to use each); common mistakes (trying to instantiate an abstract class directly — a compile error, confusing method overloading (same name, different parameters, resolved at compile time) with overriding (same signature, resolved at runtime)); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Verify structure**

Run: `for f in Java/Phase-02-Object-Oriented-Programming/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-02-Object-Oriented-Programming/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 5: Commit**

```bash
git add Java/Phase-02-Object-Oriented-Programming
git commit -m "Add Java Phase 02: Object-Oriented Programming"
```

---

## Task 4: Phase 03 — Arrays, Strings & Core Utility Classes

**Files:**
- Create: `Java/Phase-03-Arrays-Strings-and-Core-Utility-Classes/01-Arrays.md`
- Create: `Java/Phase-03-Arrays-Strings-and-Core-Utility-Classes/02-Strings-and-StringBuilder.md`
- Create: `Java/Phase-03-Arrays-Strings-and-Core-Utility-Classes/03-Wrapper-Classes-and-Autoboxing.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Arrays.md`**

Cover: the problem (storing 5 related values as 5 separate variables (`score1`, `score2`, ...) doesn't scale and can't be looped over); analogy (a row of numbered mailboxes — fixed in count once installed, each accessed directly by its box number (index)); internal flow (array declaration/creation syntax (`int[] scores = new int[5];` and array literals), zero-based indexing, `.length` (a field, not a method — a common trip-up), iterating with a classic `for` loop vs an enhanced `for-each` loop, multi-dimensional arrays as "arrays of arrays"); code example: creating an `int[]` of 5 scores, filling it in a loop, then computing and printing the average; a 2D array example (a simple 3x3 grid) accessed via `grid[row][col]`; common mistakes (off-by-one `ArrayIndexOutOfBoundsException` from looping `<= length` instead of `< length`, confusing `.length` on arrays with `.length()` on Strings); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Strings-and-StringBuilder.md`**

Cover: the problem (text manipulation is everywhere, but naively concatenating strings in a loop can be surprisingly slow — why?); analogy (a `String` is like a sealed, published book — once printed, its content can't change; want a different sentence, you print an entirely new book. A `StringBuilder` is a whiteboard — you can erase and rewrite freely without creating a new one each time); internal flow (`String` immutability and what that actually means (every "modifying" method returns a new `String` instead of changing the original), common `String` methods (`substring`, `indexOf`, `equals` vs `==` for content vs reference comparison, `split`, `trim`), `StringBuilder` for efficient repeated concatenation (`.append()`, `.toString()`)); code example: demonstrating `String` immutability (`String s = "a"; s.concat("b"); System.out.println(s);` printing `"a"`, not `"ab"`, because the return value was discarded), then the `==` vs `.equals()` trap comparing two separately-constructed equal-content Strings, then a `StringBuilder` loop building a long string efficiently; a comparison table (`String` vs `StringBuilder` vs `StringBuffer`: mutability, thread safety, performance); common mistakes (using `==` to compare String content instead of `.equals()`, building strings with `+` inside a large loop instead of `StringBuilder`); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `03-Wrapper-Classes-and-Autoboxing.md`**

Cover: the problem (Java's collections (covered next phase) can only hold objects, not primitives — so how do you put an `int` into a `List`?); analogy (a wrapper class is a gift box around a primitive value — the value itself doesn't change, but now it's "packaged" as an object that can go where only objects are allowed); internal flow (wrapper classes `Integer`, `Double`, `Boolean`, `Character`, etc., one per primitive; autoboxing (automatic primitive-to-wrapper conversion) and unboxing (the reverse) that the compiler inserts for you; the classic `Integer` caching gotcha for small values (`-128` to `127` are cached, so `==` can appear to "work" for small numbers and then mysteriously fail for larger ones) as a reason to always use `.equals()` for wrapper comparison, not `==`; parsing strings to numbers (`Integer.parseInt`)); code example: autoboxing an `int` into an `Integer` implicitly, then the caching gotcha demonstrated explicitly (`Integer a = 100, b = 100;` → `a == b` true due to caching; `Integer a = 200, b = 200;` → `a == b` false, since 200 falls outside the cached range and each is a distinct object) with the correct fix (`.equals()`) shown working consistently in both cases; common mistakes (relying on `==` for wrapper comparison because it "worked" once with small numbers, unboxing a `null` wrapper causing an unexpected `NullPointerException`); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Verify structure**

Run: `for f in Java/Phase-03-Arrays-Strings-and-Core-Utility-Classes/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-03-Arrays-Strings-and-Core-Utility-Classes/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 5: Commit**

```bash
git add Java/Phase-03-Arrays-Strings-and-Core-Utility-Classes
git commit -m "Add Java Phase 03: Arrays, Strings and Core Utility Classes"
```

---

## Task 5: Phase 04 — Collections Framework

**Files:**
- Create: `Java/Phase-04-Collections-Framework/01-Lists.md`
- Create: `Java/Phase-04-Collections-Framework/02-Sets-and-Maps.md`
- Create: `Java/Phase-04-Collections-Framework/03-Queues-Comparable-and-Comparator.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Lists.md`**

Cover: the problem (a plain array has a fixed size decided at creation — what if you don't know in advance how many items you'll need to store, or need to insert/remove in the middle?); analogy (a plain array is a fixed row of lockers; an `ArrayList` is an expandable row that automatically adds more lockers behind the scenes when it runs out, so callers never have to think about resizing); internal flow (the `List` interface, `ArrayList` (backed by a resizable array, fast random access) vs `LinkedList` (a doubly-linked list, fast insertion/removal at the ends, slower random access), core methods `add`/`get`/`remove`/`size`/`contains`, the enhanced for-loop over a `List`); code example: building an `ArrayList<String>` of names, adding/removing elements, iterating with a for-each loop; a comparison table (`ArrayList` vs `LinkedList`: random access speed, insertion/removal speed, memory overhead, when to pick each); common mistakes (removing an element by index while iterating with a plain for-loop and skipping an element due to the shifted indices, choosing `LinkedList` "for performance" without actually needing frequent middle-insertion, where `ArrayList` is usually faster in practice); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Sets-and-Maps.md`**

Cover: the problem (sometimes you need "no duplicates allowed" (a Set), or "look this value up instantly by a key" instead of by position (a Map) — a `List` models neither of these well); analogy (a `Set` is a guest list where a name is either on it or not, never twice; a `Map` is a dictionary — you look up a definition (value) by its word (key), not by flipping to page number N); internal flow (`HashSet` (no order guarantee, O(1) average lookup) vs `TreeSet` (sorted order) vs `LinkedHashSet` (insertion order preserved); `HashMap` (key→value, no order guarantee) vs `TreeMap` (sorted by key) vs `LinkedHashMap` (insertion order preserved); core `Map` methods `put`/`get`/`containsKey`/`getOrDefault`; iterating a `Map`'s `entrySet()`); code example: a `HashSet<String>` deduplicating a list of names, and a `HashMap<String, Integer>` counting word frequency in a small array of words using `getOrDefault`; a comparison table (`HashMap` vs `TreeMap` vs `LinkedHashMap`: ordering, lookup speed); common mistakes (assuming `HashMap`/`HashSet` iteration order is predictable or insertion-ordered — it isn't, unlike the `LinkedHash*` variants, forgetting that using a mutable custom object as a `HashMap` key can break lookups if the object's `hashCode()` changes after insertion); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `03-Queues-Comparable-and-Comparator.md`**

Cover: the problem (some workflows are inherently "process in a specific order" — first-in-first-out for a task queue, or "always process the highest-priority item next" — and you also often need to sort custom objects, not just numbers/strings, in more than one way); analogy (a `Queue` is a line at a coffee shop (first come, first served) or, with a `PriorityQueue`, an ER waiting room (most urgent case goes first, regardless of arrival order); `Comparable` is an object's own built-in "how do I rank myself" rule, while a `Comparator` is an outside referee who can apply a completely different ranking rule without changing the object at all); internal flow (`Queue`/`Deque` interfaces, `LinkedList` and `ArrayDeque` as implementations, `offer`/`poll`/`peek`; `PriorityQueue` and natural ordering; implementing `Comparable<T>`'s `compareTo` method on a custom class; writing a separate `Comparator<T>` (including the modern `Comparator.comparing(...)` lambda-friendly style) for an alternative ordering); code example: a `Person` class implementing `Comparable<Person>` to sort by age naturally, then sorting the same list of `Person` objects by name instead using a `Comparator`, printing both results to show the different orderings; a comparison table (`Comparable` vs `Comparator`: where the ordering logic lives, how many orderings you can define, syntax); common mistakes (implementing `compareTo` inconsistently with `equals` (violating the general contract that sorted-order equality should usually agree with `.equals()`), forgetting `Comparator.comparing(...).reversed()` exists instead of manually inverting comparison logic); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Verify structure**

Run: `for f in Java/Phase-04-Collections-Framework/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-04-Collections-Framework/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 5: Commit**

```bash
git add Java/Phase-04-Collections-Framework
git commit -m "Add Java Phase 04: Collections Framework"
```

---

## Task 6: Phase 05 — Generics & Exception Handling

**Files:**
- Create: `Java/Phase-05-Generics-and-Exception-Handling/01-Generics.md`
- Create: `Java/Phase-05-Generics-and-Exception-Handling/02-Exception-Handling-Fundamentals.md`
- Create: `Java/Phase-05-Generics-and-Exception-Handling/03-Try-With-Resources-and-Custom-Exceptions.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Generics.md`**

Cover: the problem (before generics, a `List` could hold literally anything, meaning `list.get(0)` returned a plain `Object` you had to manually cast, risking a runtime `ClassCastException` if you cast to the wrong type); analogy (generics are a labeled shipping container — the label ("Fragile: Glassware Only") is checked before anything is loaded, so you can trust what's inside without opening every box to check); internal flow (generic classes/methods with a type parameter `<T>`, why this moves type errors from runtime to compile time, bounded type parameters (`<T extends Comparable<T>>`) for "any type, as long as it supports X", wildcards `? extends`/`? super` for flexible method parameters at a conceptual level); code example: a simple generic `Box<T>` class with a `set`/`get` method, instantiated as both `Box<String>` and `Box<Integer>` to show the same class working safely with different types, then a generic method `<T> T firstElement(List<T> list)`; common mistakes (using raw types (`List` instead of `List<String>`) and losing all compile-time type safety, confusing a bounded type parameter with a wildcard when only reading vs also writing to a generic collection); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Exception-Handling-Fundamentals.md`**

Cover: the problem (things go wrong at runtime — a file might not exist, a network call might fail, user input might be malformed — and a program that just crashes with no explanation is a bad experience); analogy (an exception is a fire alarm — when triggered, normal execution stops immediately and control jumps straight to whoever is listening for that alarm (a `catch` block), skipping everything in between); internal flow (the `Throwable` hierarchy at a conceptual level (`Error` vs `Exception`), checked exceptions (must be declared with `throws` or caught — checked at compile time) vs unchecked/`RuntimeException` (not required to be declared or caught), `try`/`catch`/`finally` and the guarantee that `finally` always runs, catching multiple exception types, exception propagation up the call stack when uncaught); code example: a method that throws a checked `IOException` (declared with `throws`), called from a `try`/`catch` block that catches it and prints a friendly message, plus a demonstration that `finally` runs even when an exception is thrown; common mistakes (catching `Exception` (or worse, `Throwable`) broadly to "make the error go away" instead of catching the specific exception type that can actually occur, swallowing an exception silently with an empty `catch` block); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `03-Try-With-Resources-and-Custom-Exceptions.md`**

Cover: the problem (resources like file handles or network connections must be explicitly closed when you're done with them, and manually closing them correctly in every possible exit path (including when an exception is thrown) with a `finally` block is verbose and easy to get wrong); analogy (try-with-resources is like a hotel room key that automatically deactivates and locks the door the moment you leave, whether you left through the front door calmly or scrambled out through a fire exit — either way, the room gets properly closed up); internal flow (the `AutoCloseable` interface, try-with-resources syntax (`try (Resource r = new Resource()) { ... }`) and the guarantee that `.close()` is called automatically even if an exception occurs inside the block; creating custom exception classes by extending `Exception` (checked) or `RuntimeException` (unchecked), and when a domain-specific exception (e.g. `InsufficientFundsException`) communicates intent better than a generic one); code example: a simple class implementing `AutoCloseable` with a `close()` method that prints a message, used in a try-with-resources block to show `close()` runs automatically even when the block throws; then a custom `InsufficientFundsException extends Exception` thrown from a small `withdraw` method and caught by name; common mistakes (implementing `AutoCloseable` but forgetting it does nothing unless used inside a try-with-resources statement, making every custom exception extend `RuntimeException` "to avoid dealing with checked exceptions" without considering whether callers should be forced to handle the failure); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Verify structure**

Run: `for f in Java/Phase-05-Generics-and-Exception-Handling/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-05-Generics-and-Exception-Handling/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 5: Commit**

```bash
git add Java/Phase-05-Generics-and-Exception-Handling
git commit -m "Add Java Phase 05: Generics and Exception Handling"
```

---

## Task 7: Phase 06 — Lambdas & Streams

**Files:**
- Create: `Java/Phase-06-Lambdas-and-Streams/01-Functional-Interfaces-and-Lambda-Expressions.md`
- Create: `Java/Phase-06-Lambdas-and-Streams/02-The-Stream-API.md`
- Create: `Java/Phase-06-Lambdas-and-Streams/03-Optional.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Functional-Interfaces-and-Lambda-Expressions.md`**

Cover: the problem (pre-Java 8, passing "a piece of behavior" as a parameter — e.g. "sort using this comparison logic" — required writing a whole anonymous inner class just to wrap one small method, which was verbose for something conceptually simple); analogy (a lambda is a sticky note with instructions instead of a full formal memo — same information conveyed, far less ceremony); internal flow (a functional interface = an interface with exactly one abstract method, e.g. `Runnable`, `Comparator<T>`, and the built-in `java.util.function` interfaces `Function<T,R>`, `Predicate<T>`, `Supplier<T>`, `Consumer<T>`; lambda expression syntax `(params) -> expression` or `(params) -> { block }`; method references (`ClassName::methodName`) as an even shorter form when a lambda just calls one existing method); code example: sorting a `List<String>` with an old-style anonymous `Comparator` class, then the identical behavior as a lambda, then as a method reference (`String::compareTo`-based), showing all three side by side to make the progression concrete; common mistakes (trying to use a lambda where the target type isn't actually a functional interface (more than one abstract method) and getting a compile error, capturing a local variable in a lambda that isn't effectively final); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-The-Stream-API.md`**

Cover: the problem (processing a collection — filter some items, transform each one, then combine them into a result — used to mean writing a manual loop with intermediate temporary lists for every single step); analogy (a stream pipeline is a factory assembly line: raw material goes in one end, each station does one transformation (filter out defects, reshape the part, ...), and a finished product comes out the other end — you describe the stations, not the walking-back-and-forth); internal flow (creating a stream from a collection (`.stream()`), intermediate operations (`filter`, `map`, `sorted`) which are lazy and return a new stream, terminal operations (`collect`, `forEach`, `reduce`, `count`) which actually trigger execution, `Collectors.toList()`); code example: given a `List<String>` of names, a stream pipeline filtering names longer than 3 characters, uppercasing each, and collecting the result into a new `List<String>`, with the exact resulting list printed and traced step by step; a comparison table (imperative for-loop vs Stream pipeline: readability, laziness, chaining); common mistakes (trying to reuse a stream after a terminal operation has already run — streams are single-use and this throws `IllegalStateException`, overusing streams for something a simple loop would express more clearly, at the cost of readability); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Write `03-Optional.md`**

Cover: the problem (a method that might legitimately have "no result" — e.g. "find a user by email" when no such user exists — historically just returned `null`, and every caller had to remember to check for `null` or risk a `NullPointerException`, with nothing in the method signature warning them); analogy (`Optional` is a gift box that's explicitly labeled either "contains a gift" or "empty" — you can't accidentally reach in and grab nothing while thinking there's something there, the way you can with an unlabeled `null`); internal flow (`Optional.of`/`Optional.empty`/`Optional.ofNullable`, checking presence with `isPresent()`/`isEmpty()`, safely extracting a value with `orElse`/`orElseGet`/`orElseThrow`, chaining with `map`/`filter` on an `Optional` itself); code example: a `findUserByEmail` method returning `Optional<String>` instead of a raw `String`, called once with a match (using `.orElse("not found")`) and once without a match, showing both outcomes without ever risking a `NullPointerException`; common mistakes (calling `.get()` directly on an `Optional` without checking presence first — this can throw `NoSuchElementException`, exactly the kind of unchecked failure `Optional` was meant to help avoid; using `Optional` as a field type or method parameter, which is generally discouraged — it's intended primarily as a return type); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 4: Verify structure**

Run: `for f in Java/Phase-06-Lambdas-and-Streams/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-06-Lambdas-and-Streams/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 5: Commit**

```bash
git add Java/Phase-06-Lambdas-and-Streams
git commit -m "Add Java Phase 06: Lambdas and Streams"
```

---

## Task 8: Phase 07 — Java I/O and NIO

**Files:**
- Create: `Java/Phase-07-Java-IO-and-NIO/01-Classic-IO-Streams-and-Readers.md`
- Create: `Java/Phase-07-Java-IO-and-NIO/02-Modern-NIO-with-Path-and-Files.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Classic-IO-Streams-and-Readers.md`**

Cover: the problem (a program often needs to read from or write to something outside itself — a file, the console, a network socket — and raw byte-by-byte access is both slow and error-prone to work with directly for text); analogy (`InputStream`/`OutputStream` are a garden hose delivering raw water (bytes); a `Reader`/`Writer` wrapped around them is a filter attached to that hose that gives you clean drinking water (characters/text) instead of raw bytes you'd have to interpret yourself); internal flow (byte streams (`InputStream`/`OutputStream`) vs character streams (`Reader`/`Writer`), `FileReader`/`FileWriter`, wrapping with `BufferedReader`/`BufferedWriter` for efficient line-by-line reading (`.readLine()`) instead of one slow unbuffered character at a time, the importance of closing streams (forward reference to try-with-resources from Phase 5)); code example: writing a few lines of text to a file with a `BufferedWriter` inside a try-with-resources block, then reading them back line by line with a `BufferedReader`, printing each line as it's read; common mistakes (reading a file character-by-character or line-by-line without a `BufferedReader`/`BufferedWriter` wrapper, which is dramatically slower for anything beyond a trivial file size, forgetting to close a stream — or not using try-with-resources — leaving a file handle open); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Modern-NIO-with-Path-and-Files.md`**

Cover: the problem (the classic `java.io.File` API from Phase 7 Lesson 1's era is clunky — checking whether an operation succeeded often meant inspecting a returned `boolean`, with poor error messages when something went wrong); analogy (`java.io.File` is an old paper map with no explanation for a dead end; the modern `java.nio.file` API (`Path`/`Files`) is GPS navigation that tells you exactly why a route failed, with clear exceptions instead of ambiguous `false` return values); internal flow (`Path` as the modern replacement for representing a file/directory location, `Paths.get(...)` (or `Path.of(...)` in modern Java) to construct one, the `Files` utility class's static methods — `Files.readAllLines`, `Files.write`, `Files.exists`, `Files.createDirectories`, `Files.copy` — each throwing a real, informative `IOException` on failure instead of returning an ambiguous boolean); code example: using `Files.writeString(path, content)` to write a small file (modern one-line convenience method), then `Files.readAllLines(path)` to read it back as a `List<String>` and print it, wrapped in a `try`/`catch` for `IOException`; a comparison table (`java.io.File` vs `java.nio.file.Path`/`Files`: error reporting, convenience methods, when classic I/O from Lesson 1 is still relevant (line-by-line streaming of very large files) vs when `Files` convenience methods are the better default for smaller files); common mistakes (calling a `Files` convenience method that loads an entire file into memory (like `readAllLines`) on a file too large to comfortably fit in memory, instead of streaming it line-by-line); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Java/Phase-07-Java-IO-and-NIO/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-07-Java-IO-and-NIO/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Java/Phase-07-Java-IO-and-NIO
git commit -m "Add Java Phase 07: Java IO and NIO"
```

---

## Task 9: Phase 08 — Concurrency & Multithreading

**Files:**
- Create: `Java/Phase-08-Concurrency-and-Multithreading/01-Threads-and-Race-Conditions.md`
- Create: `Java/Phase-08-Concurrency-and-Multithreading/02-ExecutorService-and-java-util-concurrent.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Threads-and-Race-Conditions.md`**

Cover: the problem (a program that only ever does one thing at a time wastes available CPU cores and blocks entirely while waiting on slow operations like file/network I/O — sometimes you genuinely need multiple things happening concurrently); analogy (a single-threaded program is one cashier serving a whole line of customers one at a time; multithreading is opening several checkout lanes — faster overall, but now you need rules so two cashiers don't both try to grab the last item off the same shelf at the same instant and cause chaos); internal flow (creating a thread via implementing `Runnable` and passing it to a `Thread`, `.start()` vs calling `.run()` directly (the critical difference — `.start()` actually spawns a new thread, `.run()` just calls the method normally on the current thread), race conditions (two threads incrementing a shared counter without coordination, losing updates), the `synchronized` keyword and intrinsic locks as the classic fix); code example: two threads both incrementing a shared, unsynchronized `int` counter a large number of times, showing the final result is *less* than expected due to a real race condition, then the same code with the increment wrapped in a `synchronized` block, showing the correct final count; common mistakes (calling `.run()` instead of `.start()` and being confused why "the thread" didn't actually run concurrently, assuming a race condition is rare/unlikely to show up in practice just because it doesn't reproduce every single run); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-ExecutorService-and-java-util-concurrent.md`**

Cover: the problem (manually creating and managing raw `Thread` objects for every concurrent task doesn't scale — creating a thread has real overhead, and nothing manages how many run at once or collects their results cleanly); analogy (raw threads are hiring and personally training a brand-new employee for every single task, then firing them when it's done; an `ExecutorService`-backed thread pool is a standing team of employees who pick up new tasks from a shared queue as they finish their current one — far less overhead, and someone else manages the roster); internal flow (`ExecutorService` and `Executors.newFixedThreadPool(n)`, submitting tasks with `.submit(...)` and getting back a `Future<T>` to retrieve the result later (`.get()`), the importance of calling `.shutdown()` when done; a survey of key `java.util.concurrent` building blocks: `ConcurrentHashMap` (a thread-safe `Map` without needing manual `synchronized` blocks), `AtomicInteger` (lock-free atomic increment, revisiting Lesson 1's race-condition problem with a cleaner fix), `CountDownLatch` (letting one or more threads wait until a set of operations in other threads completes)); code example: submitting several tasks to a fixed thread pool, collecting their `Future` results, and printing them once all are done; a rewrite of Lesson 1's race-condition counter using `AtomicInteger` instead of `synchronized`, showing the same correct result with a different mechanism; common mistakes (forgetting to call `.shutdown()` on an `ExecutorService`, leaving application threads that prevent the JVM from exiting; calling `.get()` on a `Future` immediately after `.submit()` in a way that defeats the purpose of concurrency by blocking right away instead of doing other work first); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Java/Phase-08-Concurrency-and-Multithreading/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-08-Concurrency-and-Multithreading/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Java/Phase-08-Concurrency-and-Multithreading
git commit -m "Add Java Phase 08: Concurrency and Multithreading"
```

---

## Task 10: Phase 09 — JVM Internals & Memory Management

**Files:**
- Create: `Java/Phase-09-JVM-Internals-and-Memory-Management/01-Heap-Stack-and-the-Object-Lifecycle.md`
- Create: `Java/Phase-09-JVM-Internals-and-Memory-Management/02-Garbage-Collection-and-Common-Memory-Errors.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Heap-Stack-and-the-Object-Lifecycle.md`**

Cover: the problem (Java code never manually allocates or frees memory the way some other languages require — so where does a created object actually live, and how does the JVM know when it's safe to reclaim that memory?); analogy (the stack is a stack of trays in a cafeteria — strictly last-in-first-out, one tray (a method call's local variables) added or removed at a time, and it disappears the instant that method returns; the heap is a shared warehouse where objects actually live, reachable from multiple places, staying around for as long as something can still find them); internal flow (each thread gets its own stack, storing local variables and method call frames — a `StackOverflowError` happens when this fills up, classically from infinite/too-deep recursion; all objects (created with `new`) live on the shared heap, and a local variable holding an object is really just a stack-stored reference pointing into the heap; class loading at a conceptual level — a class's bytecode is loaded once by the classloader before it can be used); code example: a small recursive method with no base case, showing conceptually why it eventually throws `StackOverflowError`, alongside a diagram (in a code fence) illustrating a method call's local `int` living on the stack while an object it creates lives on the heap, with the stack variable holding just a reference/arrow pointing to it; common mistakes (assuming primitives and objects are stored identically — a local primitive variable holds its value directly on the stack, while a local object reference holds only a pointer to heap memory, an important root cause of many "why did modifying this object inside a method affect the caller's copy" confusions); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Garbage-Collection-and-Common-Memory-Errors.md`**

Cover: the problem (once nothing on the stack can reach a heap object anymore, that memory is wasted unless something reclaims it — and doing this reclaiming manually and correctly, the way older languages require, is a notorious source of bugs); analogy (garbage collection is an automatic decluttering service that periodically walks through the warehouse (heap) and removes anything nobody has a claim ticket (a live reference) to anymore — you never have to remember to throw things out yourself, and you can't accidentally throw out something still in use); internal flow (an object becomes eligible for garbage collection once it's unreachable from any live reference — this is different from most other languages' simple reference-counting; the generational hypothesis at a conceptual level (most objects die young, so the heap is split into a young generation collected frequently/cheaply and an old generation collected less often), a brief, non-exhaustive naming of common collectors (e.g. G1 as a widely-used modern default) without deep tuning detail; the JIT compiler's role — frequently-executed ("hot") bytecode gets compiled to native machine code at runtime for speed, rather than being interpreted every time); code example: a conceptual code snippet showing an object being created, referenced, then having its only reference reassigned to `null` (or going out of scope), narrating that this makes it eligible for collection on some future GC cycle — deliberately not claiming an exact, guaranteed collection timing, since Java gives no such guarantee; a table of common memory-related errors (`OutOfMemoryError: Java heap space` — too many long-lived objects/a memory leak via lingering references, `StackOverflowError` — revisiting Lesson 1's runaway recursion) with their typical real-world cause; common mistakes (assuming `System.gc()` forces an immediate garbage collection — it's only a hint to the JVM, not a command, calling something "a memory leak" in Java and assuming it means the same thing as in a language with manual memory management, when in Java it specifically means unintentionally-retained references keeping otherwise-dead objects reachable); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Java/Phase-09-JVM-Internals-and-Memory-Management/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-09-JVM-Internals-and-Memory-Management/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Java/Phase-09-JVM-Internals-and-Memory-Management
git commit -m "Add Java Phase 09: JVM Internals and Memory Management"
```

---

## Task 11: Phase 10 — Modern Java Features

**Files:**
- Create: `Java/Phase-10-Modern-Java-Features/01-var-Records-and-Sealed-Classes.md`
- Create: `Java/Phase-10-Modern-Java-Features/02-Pattern-Matching-Switch-Expressions-and-Text-Blocks.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-var-Records-and-Sealed-Classes.md`**

Cover: the problem (a lot of Java tutorials and existing codebases predate several genuinely useful modern additions to the language — a learner should know what changed recently and why, so older code doesn't look like "the only way" to write Java); analogy (`var` is like ordering "the usual" at a familiar coffee shop — the barista (compiler) already knows exactly what that resolves to, so you don't have to spell it out every time; a `record` is a pre-printed form with fixed fields — you fill in the blanks once and get a complete, correctly-behaving object for free, instead of hand-writing the same boilerplate paperwork (constructor, `equals`, `hashCode`, `toString`, getters) every time); internal flow (`var` for local variable type inference — the type is still fixed at compile time, `var` just saves you from typing it explicitly when it's already obvious from the right-hand side; `record` as a concise way to declare an immutable data-carrier class, automatically generating a constructor, accessor methods, `equals`/`hashCode`/`toString`; `sealed` classes/interfaces restricting exactly which classes are allowed to extend/implement them, enabling the compiler to know a hierarchy is "closed" and complete); code example: rewriting a traditional hand-written immutable `Point` class (with explicit fields, constructor, getters, `equals`, `hashCode`, `toString`) as a one-line `record Point(int x, int y) {}`, printing an instance to show the automatically-generated `toString()` output, then a small `sealed interface Shape permits Circle, Square` example; common mistakes (using `var` where the inferred type genuinely isn't obvious to a reader, hurting readability rather than helping it, assuming a `record`'s fields are mutable — they're implicitly `final`, matching the immutable-data-carrier intent); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Pattern-Matching-Switch-Expressions-and-Text-Blocks.md`**

Cover: the problem (older Java required a verbose, repetitive `instanceof` check immediately followed by an explicit cast before you could use a variable as its narrower type, and the classic `switch` statement's fallthrough behavior — covered as a common mistake back in Phase 1 — was a long-standing source of bugs); analogy (pattern matching for `instanceof` is like a security checkpoint that not only confirms your ID matches a category but hands you a properly-labeled badge for that category in the same motion, instead of confirming your category and then making you separately go get badged; a switch expression is the classic `switch` statement with the fall-through footgun removed and an actual result value handed back, rather than being used only for its side effects); internal flow (pattern matching for `instanceof` (`if (obj instanceof String s)` binds `s` directly, no separate cast needed), switch expressions using `->` (no fallthrough by default, and the switch itself can produce and return a value directly), pattern matching for `switch` combining both ideas, text blocks (`"""..."""`) for multi-line string literals without escaping every newline/quote); code example: the old cast-after-`instanceof` pattern side by side with the modern pattern-matching version doing the same job in less code; a classic fallthrough-prone `switch` statement from Phase 1 rewritten as a modern arrow-style switch expression that returns a value directly, with no `break` statements needed; a small multi-line text block literal (e.g. a short JSON-like snippet) shown next to the equivalent traditional string built with `\n` and escaped quotes; common mistakes (mixing old-style `switch` statement syntax and new-style switch expression syntax inconsistently within the same codebase, assuming pattern matching for `switch` is available identically all the way back to old Java versions — it's a newer addition, and code relying on it needs a sufficiently modern JDK); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Java/Phase-10-Modern-Java-Features/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-10-Modern-Java-Features/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Java/Phase-10-Modern-Java-Features
git commit -m "Add Java Phase 10: Modern Java Features"
```

---

## Task 12: Phase 11 — Build Tools & Testing

**Files:**
- Create: `Java/Phase-11-Build-Tools-and-Testing/01-Maven-and-Gradle-Fundamentals.md`
- Create: `Java/Phase-11-Build-Tools-and-Testing/02-JUnit-5-and-Mockito-Basics.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Maven-and-Gradle-Fundamentals.md`**

Cover: the problem (a real Java project depends on external libraries, needs a repeatable, one-command way to compile/test/package itself, and manually tracking every dependency's `.jar` file by hand doesn't scale past a toy project); analogy (a build tool is a recipe card for a professional kitchen — list the ingredients (dependencies) and the exact steps (build lifecycle phases) once, and anyone (or any machine) can reproduce the exact same dish (build artifact) without guessing); internal flow (Maven: the standard project layout (`src/main/java`, `src/test/java`), `pom.xml` declaring dependencies and their coordinates (`groupId`/`artifactId`/`version`), the build lifecycle (`compile` → `test` → `package`), running `mvn test`/`mvn package`; Gradle: a `build.gradle`(`.kts`) file, generally more concise/programmable dependency declarations, running `gradle build`; framed as "the same underlying problem, two popular tools" rather than a full tutorial on either); code example: a minimal `pom.xml` snippet declaring a single test dependency (e.g. JUnit) with its coordinates explained field by field, and the equivalent minimal `build.gradle` dependency declaration shown side by side; a comparison table (Maven vs Gradle: configuration style (XML vs a Groovy/Kotlin DSL), build performance characteristics, ecosystem maturity); common mistakes (manually downloading and referencing `.jar` files instead of declaring a proper dependency, letting a build tool manage that consistently, mismatching a declared dependency's version with what the code actually needs, causing confusing runtime errors instead of a clear build-time failure); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-JUnit-5-and-Mockito-Basics.md`**

Cover: the problem (manually re-running a program and eyeballing whether the output "looks right" after every change doesn't scale, and it's easy to silently break something that used to work); analogy (an automated test suite is a pre-flight checklist for a pilot — a fixed, fast, repeatable set of checks run before every flight (every code change), catching a problem before it's airborne rather than discovering it mid-flight); internal flow (JUnit 5 basics: the `@Test` annotation, assertion methods (`assertEquals`, `assertTrue`, `assertThrows`), lifecycle annotations (`@BeforeEach`/`@AfterEach`) for shared setup/teardown; the general idea of mocking with Mockito — replacing a real, possibly slow/unpredictable dependency (e.g. a database call) with a fake, controllable stand-in object during a test, at a conceptual/introductory level rather than deep API coverage); code example: a simple `Calculator` class with an `add` method, a corresponding JUnit 5 test class asserting `add(2, 3)` equals `5` using `@Test` and `assertEquals`, plus one `assertThrows` example testing that dividing by zero throws the expected exception; a small conceptual Mockito example showing a mocked dependency (`Mockito.mock(SomeDependency.class)`) configured to return a fixed value with `when(...).thenReturn(...)`, used inside a test to isolate the class under test from that dependency's real behavior; common mistakes (writing a test that depends on a real external resource (a live database/network call) instead of mocking it, making the test slow and flaky; testing implementation details rather than observable behavior, causing tests to break on harmless refactors that didn't actually change what the code does); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Java/Phase-11-Build-Tools-and-Testing/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-11-Build-Tools-and-Testing/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Java/Phase-11-Build-Tools-and-Testing
git commit -m "Add Java Phase 11: Build Tools and Testing"
```

---

## Task 13: Phase 12 — Best Practices & Production Patterns

**Files:**
- Create: `Java/Phase-12-Best-Practices-and-Production-Patterns/01-Design-Principles-and-Common-Pitfalls.md`
- Create: `Java/Phase-12-Best-Practices-and-Production-Patterns/02-Packaging-a-JAR-and-Logging.md`

**No `README.md` in this phase folder.**

- [ ] **Step 1: Write `01-Design-Principles-and-Common-Pitfalls.md`**

Cover: the problem (code that merely compiles and runs correctly once isn't the same as code that's actually maintainable months later by someone else, or by you after you've forgotten the details); analogy (favoring composition over inheritance is like assembling furniture from separate, swappable modules (a modular shelving system) instead of carving one rigid piece from a single block of wood — far easier to adapt later without cracking the whole thing); internal flow (favor composition over inheritance (a "has-a" relationship via a field referencing another object, versus forcing an "is-a" inheritance relationship where it doesn't naturally fit) revisited from Phase 2's inheritance coverage; program to an interface, not a concrete implementation (declaring a variable's type as `List<String>` rather than `ArrayList<String>`, so the concrete implementation can be swapped later without touching calling code); preferring immutability where practical (revisiting `String`'s and `record`'s immutability from earlier phases as a deliberate design choice, not just a language quirk) — fewer ways for shared state to be modified unexpectedly, especially relevant given Phase 8's race-condition coverage); code example: a small before/after refactor — a class tightly coupled to a concrete `ArrayList` field and a forced inheritance relationship, rewritten to depend on the `List` interface and use composition instead, with a brief note on why the rewritten version is easier to test and extend; common mistakes (extending a class purely to reuse its methods when there's no genuine "is-a" relationship, creating a fragile hierarchy; exposing mutable internal state directly (e.g. returning a direct reference to an internal `List` field) letting external code silently corrupt an object's invariants); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 2: Write `02-Packaging-a-JAR-and-Logging.md`**

Cover: the problem (a finished Java project needs to actually be handed off and run somewhere else — as a single distributable file, not a folder of loose `.class` files — and real applications need a proper way to record what's happening while running, since scattering `System.out.println` calls throughout production code doesn't scale or give any control over verbosity); analogy (a JAR file is a shipping container — everything the application needs, packed into one standardized, portable unit that can be handed off and run anywhere a compatible JVM exists; a logging framework is a ship's black box flight recorder, continuously recording events at different severity levels, versus shouting updates out a porthole that nobody may be listening to and that can't be turned up or down); internal flow (a JAR file as a `.zip`-based archive bundling compiled `.class` files (and a manifest identifying the entry-point main class), building one via Maven/Gradle (revisiting Phase 11) or the `jar` command directly, running it with `java -jar`; why a real logging framework (mentioned conceptually — the built-in `java.util.logging`, or more commonly a library like SLF4J/Logback in real projects) is preferred over `System.out.println` in production code: configurable severity levels (debug/info/warn/error), the ability to redirect output to files, and turning verbosity up or down without changing code); code example: the exact `mvn package` (revisiting Phase 11) command producing a runnable JAR with a specified main class in its manifest, followed by `java -jar app.jar` actually running it; a short conceptual logging example contrasting scattered `System.out.println` debug statements with equivalent calls at named severity levels (`logger.info(...)`, `logger.error(...)`), explaining that the levels let you filter output without touching the code that produces it; common mistakes (leaving debug-only `System.out.println` statements scattered throughout code that ships to production, with no way to turn them off without editing and redeploying, forgetting to specify the correct main class in a JAR's manifest, producing a JAR that builds successfully but fails immediately with "no main manifest attribute" when run); interview angle; hands-on exercises; interview Q&A; memory hook.

- [ ] **Step 3: Verify structure**

Run: `for f in Java/Phase-12-Best-Practices-and-Production-Patterns/*.md; do grep -c "^## " "$f"; done` — confirm each file has ≥5 sections.
Run: `ls Java/Phase-12-Best-Practices-and-Production-Patterns/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 4: Commit**

```bash
git add Java/Phase-12-Best-Practices-and-Production-Patterns
git commit -m "Add Java Phase 12: Best Practices and Production Patterns"
```

---

## Task 14: Projects

**Files:**
- Create: `Java/Projects/01-Command-Line-Utility.md`
- Create: `Java/Projects/02-Collections-Based-Inventory-System.md`
- Create: `Java/Projects/03-Generic-Data-Structure-with-Custom-Exceptions.md`
- Create: `Java/Projects/04-Multithreaded-Task-Processor.md`
- Create: `Java/Projects/05-File-Processing-Utility-Using-Streams-and-NIO.md`
- Create: `Java/Projects/06-Tested-Packaged-Capstone-Library.md`

**No `README.md` in `Java/Projects/` — just these 6 numbered project files.**

- [ ] **Step 1: Write each of the 6 project files** using this per-file structure: **Goal** (1-2 sentences), **What You'll Build** (short description), **Phases Required** (list), **Requirements** (bulleted functional requirements), **Suggested Approach** (numbered high-level steps, NOT full solution code — this is a project brief, not a lesson), **Stretch Goals** (2-3 optional extensions), **Evaluation Checklist** (how the learner knows they succeeded). Content per project:

  1. **Command-Line Utility** (`01-Command-Line-Utility.md`) — a small text-processing CLI tool (e.g. reads lines from console input, counts words, reports the longest line) using only fundamentals, control flow, and String methods. Phases 1-3.
  2. **Collections-Based Inventory System** (`02-Collections-Based-Inventory-System.md`) — model a small store's inventory using a `Map<String, Integer>` (item name → quantity) or a `List` of a custom `Item` class, supporting add/remove/search, and sorting items by a custom `Comparator` (e.g. by quantity or name). Phase 4.
  3. **Generic Data Structure with Custom Exceptions** (`03-Generic-Data-Structure-with-Custom-Exceptions.md`) — a small generic container class (e.g. a generic fixed-capacity `Stack<T>` or `Box<T>`) that throws a custom checked exception (e.g. `CapacityExceededException`) on invalid operations. Phase 5.
  4. **Multithreaded Task Processor** (`04-Multithreaded-Task-Processor.md`) — submit a batch of independent "tasks" (e.g. simulated work via `Thread.sleep`) to an `ExecutorService`-backed thread pool, collect results via `Future`, and safely aggregate a shared counter/result using a thread-safe mechanism (`AtomicInteger` or `synchronized`). Phase 8.
  5. **File-Processing Utility Using Streams and NIO** (`05-File-Processing-Utility-Using-Streams-and-NIO.md`) — read a text file with `Files.readAllLines`, use a Stream pipeline to filter/transform/aggregate its contents (e.g. word frequency count, or filtering lines matching a pattern), and write the result back out with `Files.write`. Phases 6, 7.
  6. **Tested, Packaged Capstone Library** (`06-Tested-Packaged-Capstone-Library.md`) — a small utility library (e.g. a simple validation/formatting helper library) using at least one modern feature (a `record` or pattern matching), with a JUnit 5 test suite covering its public methods, built and packaged into a runnable/distributable JAR via Maven or Gradle. Phases 9-12.

- [ ] **Step 2: Verify structure**

Run: `ls Java/Projects/*.md | wc -l` — expected `6`.
Run: `grep -L "Evaluation Checklist" Java/Projects/0*.md` — expected empty output (every numbered project file has this section).
Run: `ls Java/Projects/README.md 2>&1` — expect `No such file or directory`.

- [ ] **Step 3: Commit**

```bash
git add Java/Projects
git commit -m "Add Java course Projects"
```

---

## Task 15: Quick-Reference

**Files:**
- Create: `Java/Quick-Reference/Java-Cheatsheet.md`
- Create: `Java/Quick-Reference/Interview-QA.md`

**Note:** these are named files, not `README.md`, so they are exempt from the "no README" rule and should be created as normal.

- [ ] **Step 1: Write `Java-Cheatsheet.md`**

Following the `Docker/Quick-Reference/Docker-Cheatsheet.md` pattern: a dense, scannable quick-lookup document organized by topic, each as a `##` section with tables/bullet lists (no long prose). Sections required: OOP Syntax Quick Reference (class/constructor/inheritance/interface syntax), Primitive Types Reference Table, Collections Comparison (List/Set/Map implementations, when to use each), Generics & Exceptions Quick Reference, Stream API Operations Cheat Sheet (common intermediate/terminal operations with one-line examples), Concurrency Primitives Quick Reference (`Thread`/`ExecutorService`/`java.util.concurrent` basics), Modern Java Features Syntax (records/sealed/pattern matching/switch expressions/text blocks), Build Tools & Testing Commands (Maven/Gradle/JUnit essentials).

- [ ] **Step 2: Write `Interview-QA.md`**

Following the `Docker/Quick-Reference/Interview-QA.md` numbering pattern (`### Q1`, `### Q2`, ... `### Q50`), write exactly 50 interview Q&A pairs covering: Java fundamentals & OOP (Q1-10), collections framework (Q11-18), generics & exceptions (Q19-24), lambdas & streams (Q25-31), Java I/O and NIO (Q32-34), concurrency & multithreading (Q35-40), JVM internals & memory management (Q41-44), modern Java features (Q45-47), build tools & testing (Q48-50). Each Q&A is a `### QN. Question text?` heading followed by a 2-5 sentence answer.

- [ ] **Step 3: Verify structure**

Run: `grep -c "^### Q" Java/Quick-Reference/Interview-QA.md` — expected `50`.
Run: `grep -c "^## " Java/Quick-Reference/Java-Cheatsheet.md` — expected ≥8.

- [ ] **Step 4: Commit**

```bash
git add Java/Quick-Reference
git commit -m "Add Java course Quick-Reference (Cheatsheet + Interview Q&A)"
```

---

## Task 16: Final Cross-Check

- [ ] **Step 1: Verify NO README.md exists anywhere in the course**

Run: `find Java -iname "README.md"`
Expected: empty output (zero matches). This is the single most important check for this course, given the explicit "no README" requirement.

- [ ] **Step 2: Verify full course structure matches the spec**

Run: `find Java -name "*.md" | wc -l` — expected around `12 phases × ~2.4 files average (28 lesson files total: 3+3+3+3+3+3+2+2+2+2+2+2) + 6 projects + 2 quick-reference = 36`. Confirm actual count is in that neighborhood.

- [ ] **Step 3: Spot-check style compliance**

Run: `grep -L "Memory hook" Java/Phase-*/0*.md` — expected empty output (every lesson file has a memory hook).
Run: `grep -L "Interview Q&A" Java/Phase-*/0*.md` — expected empty output.

- [ ] **Step 4: Final commit (if any cleanup was needed)**

```bash
git status
```
(Only commit if Step 1-3 required fixes — otherwise nothing to commit, this task is verification-only.)
