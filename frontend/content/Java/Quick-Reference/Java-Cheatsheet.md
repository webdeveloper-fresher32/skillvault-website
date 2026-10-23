# Java Cheatsheet

---

## OOP Syntax Quick Reference

```java
// Class, fields, constructor
public class Person {
    private String name;      // private field — encapsulated
    private int age;

    public Person(String name, int age) {   // constructor — same name as class, no return type
        this.name = name;      // "this" disambiguates field vs parameter
        this.age = age;
    }

    public String getName() { return name; }   // getter
    public void setAge(int age) {               // setter — can validate
        if (age < 0) throw new IllegalArgumentException("Age cannot be negative: " + age);
        this.age = age;
    }
}

// Object creation — "new" allocates, runs constructor, returns a reference
Person alice = new Person("Alice", 30);

// Inheritance — extends, super(...) must be first statement in subclass constructor
public class Employee extends Person {
    private double salary;
    public Employee(String name, int age, double salary) {
        super(name, age);      // calls Person's constructor first
        this.salary = salary;
    }
    @Override
    public String toString() { return getName() + ", salary: " + salary; }  // overriding
}

// Abstract class — cannot be instantiated, can mix abstract + concrete methods/state
public abstract class Animal {
    protected String name;
    public Animal(String name) { this.name = name; }
    public abstract String makeSound();     // no body — subclass must implement
}

// Interface — pure contract; a class can implement many
public interface Powerable {
    void powerOn();                          // abstract — implementer must supply
    default void restart() { powerOn(); }    // default method — real body, Java 8+
}
public class Dog extends Animal implements Powerable {
    public Dog(String name) { super(name); }
    @Override public String makeSound() { return name + " says Woof!"; }
    @Override public void powerOn() { /* ... */ }
}

// Polymorphism — parent-typed reference, runtime (dynamic) dispatch to the actual subtype
Animal a = new Dog("Rex");
a.makeSound();   // runs Dog's version, decided at runtime, not by the declared type
```

| Access Modifier | Same class | Same package | Subclass (other package) | Everywhere |
|---|---|---|---|---|
| `private` | Yes | No | No | No |
| *(none)* — package-private | Yes | Yes | No | No |
| `protected` | Yes | Yes | Yes | No |
| `public` | Yes | Yes | Yes | Yes |

| | Abstract Class | Interface |
|---|---|---|
| Instance fields (state) | Yes, real fields | No (only `static final` constants) |
| Constructors | Yes | No |
| Multiple inheritance | `extends` only one | `implements` many |
| Method bodies | Mix of abstract + concrete | Traditionally none; `default`/`static` now allowed |
| When to use | Subtypes share real state/behavior | Just need to guarantee a capability |

**Overloading vs Overriding:** overloading = same name, different parameter list, resolved at *compile time*. Overriding = identical signature in a subclass, resolved at *runtime* (dynamic dispatch); use `@Override` so a typo'd signature fails to compile instead of silently becoming an overload.

---

## Primitive Types Reference Table

| Type | Size | Approximate Range | Default Value | Wrapper Class |
|---|---|---|---|---|
| `byte` | 8 bits | -128 to 127 | `0` | `Byte` |
| `short` | 16 bits | -32,768 to 32,767 | `0` | `Short` |
| `int` | 32 bits | approx. -2.1B to 2.1B | `0` | `Integer` |
| `long` | 64 bits | approx. -9.2 quintillion to 9.2 quintillion | `0L` | `Long` |
| `float` | 32 bits | large decimal range, ~7 sig. digits | `0.0f` | `Float` |
| `double` | 64 bits | large decimal range, ~15-16 sig. digits | `0.0d` | `Double` |
| `char` | 16 bits | single Unicode character | `' '` | `Character` |
| `boolean` | conceptually 1 bit | `true`/`false` only | `false` | `Boolean` |

```java
int wholeDivision = 7 / 2;       // 3 — int/int truncates
double exactDivision = 7.0 / 2;  // 3.5 — one operand is floating-point

// = is assignment, == is comparison — do not confuse them
if (isShipped == true) { /* ... */ }   // correct
```

**Autoboxing/unboxing and the Integer cache:**

```java
Integer boxed = 42;              // autoboxing: int -> Integer (compiler-inserted)
int back = boxed;                // unboxing: Integer -> int

Integer a = 100, b = 100;
System.out.println(a == b);      // true — both in cached range (-128..127), same object

Integer x = 200, y = 200;
System.out.println(x == y);      // false — outside cache, two distinct objects
System.out.println(x.equals(y)); // true — always use .equals() for wrapper value comparison

int parsed = Integer.parseInt("42"); // throws NumberFormatException on invalid input
```

---

## Collections Comparison

```java
List<String> list = new ArrayList<>();   // program to the interface, swap impl later
list.add("Alice");
list.get(0);
list.remove("Bob");     // remove(Object) — removes by VALUE
list.remove(1);         // remove(int)    — removes by INDEX (different overload!)

Set<String> set = new HashSet<>(list);          // dedupe, no order guarantee
Map<String, Integer> counts = new HashMap<>();
counts.put("apple", counts.getOrDefault("apple", 0) + 1);   // classic counting pattern

Queue<String> queue = new ArrayDeque<>();
queue.offer("task1"); queue.poll(); queue.peek();  // FIFO, safe null-returning methods

PriorityQueue<Integer> pq = new PriorityQueue<>(); // always polls the smallest first
```

| List | Backed by | `get(i)` | Insert/remove ends | Insert/remove middle |
|---|---|---|---|---|
| `ArrayList` | Resizable array | O(1) | Fast at back, slow at front | O(n) — shifts elements |
| `LinkedList` | Doubly-linked nodes | O(n) | O(1) at either end | O(n) to find + O(1) to splice |

| Set / Map family | Ordering | Lookup/insert | When to use |
|---|---|---|---|
| `HashSet` / `HashMap` | Unspecified | O(1) average | Default — order doesn't matter |
| `LinkedHashSet` / `LinkedHashMap` | Insertion order | O(1) average | Need predictable iteration order |
| `TreeSet` / `TreeMap` | Sorted (natural or `Comparator`) | O(log n) | Need sorted iteration |

```java
Queue<T>       -> offer()/poll()/peek()   // null/false on empty instead of throwing
Deque<T>       -> offerFirst/Last, pollFirst/Last  // usable as queue or stack
```

`Comparable<T>` (intrinsic, one ordering, `compareTo`) vs `Comparator<T>` (external, many orderings, `compare`):

```java
class Person implements Comparable<Person> {
    public int compareTo(Person other) { return Integer.compare(this.age, other.age); }
}
Collections.sort(people);                                   // uses Person's natural ordering
people.sort(Comparator.comparing(Person::getName));          // external, different ordering
people.sort(Comparator.comparing(Person::getAge).reversed().thenComparing(Person::getName));
```

---

## Generics & Exceptions Quick Reference

```java
// Generic class — type parameter <T>
public class Box<T> {
    private T content;
    public void set(T content) { this.content = content; }
    public T get() { return content; }
}
Box<String> box = new Box<>();   // diamond operator — infers <String> from the left side

// Generic method — its own type parameter, independent of any class
public static <T> T firstElement(List<T> list) { return list.get(0); }

// Bounded type parameter — "any type, as long as it supports X"
public static <T extends Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}

// Wildcards — PECS: Producer Extends, Consumer Super
List<? extends Number> readOnlyProducer;   // safe to READ as Number, cannot add
List<? super Integer> writableConsumer;    // safe to WRITE Integer, reads only as Object

List raw = new ArrayList();      // raw type — no compile-time checking, avoid
```

| | Checked exception | Unchecked exception (`RuntimeException`) |
|---|---|---|
| Must declare/catch? | Yes — compiler-enforced `throws` or `catch` | No |
| Typical cause | Expected, recoverable failure (`IOException`) | Programming mistake (`NullPointerException`) |
| Custom exception | `extends Exception` | `extends RuntimeException` |

```java
try {
    checkFile("report.pdf");
} catch (IOException e) {
    System.out.println("Failed: " + e.getMessage());
} finally {
    System.out.println("Always runs.");   // runs no matter what
}

// try-with-resources — AutoCloseable.close() called automatically, even on exception
try (Connection conn = new Connection("db")) {
    conn.query("SELECT 1");
} catch (RuntimeException e) {
    System.out.println("Caught: " + e.getMessage());
}
// multiple resources close in REVERSE order of declaration

// custom exception
class InsufficientFundsException extends Exception {
    InsufficientFundsException(String message) { super(message); }
}
```

---

## Stream API Operations Cheat Sheet

```java
List<String> names = List.of("Al", "Bob", "Charlie", "Dave", "Eve");

List<String> result = names.stream()
    .filter(n -> n.length() > 3)     // intermediate — lazy, returns a new Stream
    .map(String::toUpperCase)        // intermediate — lazy
    .sorted()                        // intermediate — lazy
    .collect(Collectors.toList());   // terminal — actually runs the pipeline
```

| Operation | Type | What it does |
|---|---|---|
| `filter(Predicate)` | Intermediate | Keeps elements that satisfy the predicate |
| `map(Function)` | Intermediate | Transforms each element |
| `sorted()` / `sorted(Comparator)` | Intermediate | Sorts the stream |
| `distinct()` | Intermediate | Removes duplicates |
| `limit(n)` / `skip(n)` | Intermediate | Truncates / skips elements |
| `collect(Collectors.toList())` | Terminal | Gathers results into a `List` |
| `forEach(Consumer)` | Terminal | Runs an action per element, no result |
| `reduce(identity, BinaryOperator)` | Terminal | Combines elements into one value |
| `count()` | Terminal | Number of elements that survived the pipeline |
| `anyMatch`/`allMatch`/`noneMatch(Predicate)` | Terminal | Boolean short-circuit checks |

```java
// Streams are single-use — reusing after a terminal op throws IllegalStateException
Stream<String> s = names.stream();
s.forEach(System.out::println);
s.count();   // IllegalStateException: stream has already been operated upon or closed

// Functional interfaces (java.util.function)
Function<T,R>   R apply(T t)     // transform
Predicate<T>     boolean test(T t)  // yes/no check
Supplier<T>      T get()          // produce a value, no input
Consumer<T>      void accept(T t) // do something with a value, no return

// Lambda syntax
(a, b) -> a.compareTo(b)          // expression body
(a, b) -> { return a.compareTo(b); }  // block body — explicit return needed
name -> name.length()             // single param, no parens required

// Method references
ClassName::staticMethod    // Integer::parseInt
ClassName::instanceMethod  // String::compareTo (first arg becomes the instance)
object::instanceMethod     // System.out::println
ClassName::new             // constructor reference, e.g. ArrayList::new

// Optional — explicit "might be empty" instead of relying on null
Optional<String> maybe = Optional.ofNullable(lookup());
maybe.orElse("default");
maybe.orElseGet(() -> computeFallback());
maybe.orElseThrow(() -> new NoSuchElementException("no value"));
maybe.map(String::toUpperCase).filter(s -> s.length() > 3);
// AVOID: maybe.get() without checking presence first -> NoSuchElementException
```

---

## Concurrency Primitives Quick Reference

```java
// Creating and starting a thread
class PrintTask implements Runnable {
    public void run() { System.out.println(Thread.currentThread().getName()); }
}
Thread worker = new Thread(new PrintTask(), "Worker");
worker.start();   // spawns a NEW thread — runs concurrently
worker.join();    // caller blocks until worker finishes

// worker.run();   // DOES NOT start a new thread — just a normal synchronous call

// Race condition fix #1: synchronized (blocking intrinsic lock)
synchronized (lock) {
    counter++;   // only one thread at a time can be in this block
}

// Race condition fix #2: AtomicInteger (lock-free, CPU-level atomic op)
AtomicInteger counter = new AtomicInteger(0);
counter.incrementAndGet();

// Thread pool via ExecutorService
ExecutorService executor = Executors.newFixedThreadPool(3);
Callable<Integer> task = () -> 42;
Future<Integer> future = executor.submit(task);
future.get();          // blocks until the task completes, returns the result
executor.shutdown();   // ALWAYS call this — otherwise the JVM won't exit

// ConcurrentHashMap — thread-safe Map, no manual synchronized needed
ConcurrentHashMap<String, Integer> safeMap = new ConcurrentHashMap<>();

// CountDownLatch — wait for N other threads to finish
CountDownLatch latch = new CountDownLatch(3);
latch.countDown();   // called by each worker when done
latch.await();       // caller blocks until count reaches zero
```

| | `.start()` | `.run()` |
|---|---|---|
| Creates a new thread? | Yes | No |
| Runs concurrently? | Yes | No — synchronous, blocks caller |

| | `synchronized` | `AtomicInteger` |
|---|---|---|
| Mechanism | Intrinsic lock, blocking | Lock-free CPU atomic op |
| Good for | Multi-step coordinated state | A single independent counter/flag |

---

## Modern Java Features Syntax

```java
// var — local type inference (compile-time only, type still fixed)
var name = "Ganesh";                 // inferred String
var list = new ArrayList<>();        // WARNING: infers ArrayList<Object>, not <String>!
List<String> typed = new ArrayList<>();  // target type on the left fixes the diamond's inference

// record — auto-generates constructor, accessors, equals/hashCode, toString
public record Point(int x, int y) {}
Point p = new Point(3, 4);
p.x();                 // 3 — accessor named after component, NOT getX()
p.toString();           // "Point[x=3, y=4]"
// components are implicitly final — no setters, no mutation

// record with a compact canonical constructor for validation
// NOTE: no parameter list is written — it's implied by the record header
public record Range(int low, int high) {
    public Range {
        if (low > high) throw new IllegalArgumentException("low > high");
    }
}

// sealed interface/class — closed, known set of subtypes
public sealed interface Shape permits Circle, Square {}
public record Circle(double radius) implements Shape {}
public record Square(double side) implements Shape {}
// each permitted subtype must be final, sealed, or non-sealed

// pattern matching for instanceof — check + cast in one step
if (obj instanceof String s) {
    System.out.println(s.length());   // "s" already typed as String, no manual cast
}

// switch expression — "->" arm, no fallthrough, produces a value directly
String dayType = switch (day) {
    case MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY -> "Weekday";
    case SATURDAY, SUNDAY -> "Weekend";
};

// pattern matching for switch (Java 21) — matches on runtime type, binds per case
String describe(Object obj) {
    return switch (obj) {
        case Integer i -> "an int: " + i;
        case String s  -> "a string of length " + s.length();
        case null      -> "it's null";
        default        -> "something else: " + obj;
    };
}

// text block — multi-line string, no manual escaping/concatenation
String json = """
        {
          "name": "Ganesh"
        }
        """;
```

| | Traditional class | `record` |
|---|---|---|
| Fields | Hand-declared | Auto-declared, implicitly `private final` |
| `equals`/`hashCode`/`toString` | Hand-written | Auto-generated |
| Mutability | Whatever you write | Implicitly immutable |
| Can extend a class? | Yes | No (implicitly `final`, extends `java.lang.Record`) |

---

## Build Tools & Testing Commands

```bash
# Maven — standard layout: src/main/java, src/test/java
mvn compile     # compiles src/main/java
mvn test        # compiles + runs everything under src/test/java
mvn package     # compile -> test -> bundle into target/app-1.0.jar

# Gradle — same layout convention, Groovy/Kotlin DSL instead of XML
gradle test     # compiles and runs all tests
gradle build    # compile -> test -> build/libs/app-1.0.jar

# Running a packaged JAR
java -jar app.jar
```

```xml
<!-- pom.xml dependency: groupId + artifactId + version coordinates -->
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.10.2</version>
    <scope>test</scope>
</dependency>
```

```groovy
// build.gradle — same coordinates as one colon-separated string
dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.10.2'
}
```

```java
import static org.junit.jupiter.api.Assertions.*;

public class CalculatorTest {

    private Calculator calculator;

    @BeforeEach
    void setUp() { calculator = new Calculator(); }   // fresh instance before every @Test

    @Test
    void addsTwoPositiveNumbers() {
        assertEquals(5, calculator.add(2, 3));
    }

    @Test
    void divideByZeroThrows() {
        assertThrows(ArithmeticException.class, () -> calculator.divide(10, 0));
    }
}

// Mockito — replace a real dependency with a controllable fake
PricingService mockPricing = Mockito.mock(PricingService.class);
when(mockPricing.getDiscountPercentage("SUMMER10")).thenReturn(10);
```

| Maven | Gradle |
|---|---|
| `pom.xml` (XML) | `build.gradle`/`.kts` (Groovy/Kotlin DSL) |
| `mvn test` / `mvn package` | `gradle test` / `gradle build` |
| Full lifecycle every run by default | Incremental builds, often faster repeat builds |

| JUnit 5 annotation | Purpose |
|---|---|
| `@Test` | Marks a method as a test case |
| `@BeforeEach` | Runs before every `@Test` — fresh setup |
| `@AfterEach` | Runs after every `@Test` — cleanup |
| `assertEquals(expected, actual)` | Fails if not equal |
| `assertThrows(Type.class, () -> ...)` | Passes only if the exact exception type is thrown |
