# LLD Cheatsheet (Python)

Dense, scannable, last-minute-before-interview reference. Not a tutorial.

---

## OOP Concepts (one-liners)

| Concept | Definition |
|---|---|
| Class / Object | Class = blueprint (attributes + methods); Object = runtime instance of a class. |
| Inheritance | A class (child) reuses/extends fields & behavior of another class (parent): `class Dog(Animal): ...` |
| Polymorphism | Same interface/method name, different behavior depending on the runtime object (`shape.area()` differs per shape). |
| Abstraction | Expose *what* an object does via an interface, hide *how* (implementation details) — `abc.ABC` + `@abstractmethod`. |
| Encapsulation | Bundle data + behavior together and restrict direct access to internals (`_protected`, `__private`, properties). |
| Overriding vs Overloading | Overriding = subclass redefines a parent method (runtime, real in Python). Overloading = same method name, different signatures (Python has no native overloading; fake it with default args, `*args`, or `functools.singledispatch`). |
| Composition vs Inheritance | Composition = "has-a" (object holds reference to another object); Inheritance = "is-a" (subclassing). Prefer composition for flexibility, avoid deep/fragile hierarchies. |
| Static vs Class methods | `@staticmethod` = no `self`/`cls`, utility function namespaced in class. `@classmethod` = receives `cls`, used for alt constructors/factories. |
| Magic methods | Dunder methods (`__init__`, `__eq__`, `__repr__`, `__len__`, `__iter__`, `__enter__/__exit__`) that hook into Python's built-in protocols (operators, iteration, context managers). |
| Dataclasses | `@dataclass` auto-generates `__init__`, `__repr__`, `__eq__` from type-annotated fields — reduces boilerplate for data-holder classes. |

---

## SOLID Principles

**S — Single Responsibility Principle**
What it means: A class should have exactly one reason to change — one responsibility, one axis of change (e.g. don't mix persistence logic with business logic in the same class).
Red flag: A class name contains "and"/"Manager"/"Helper" and does unrelated things; changing DB schema forces you to edit the same class that also formats reports.

**O — Open/Closed Principle**
What it means: Classes should be open for extension but closed for modification — add new behavior via new subclasses/strategies, not by editing existing tested code.
Red flag: A long `if/elif` chain on a `type` field that you must edit every time a new type is added (e.g. `if shape_type == "circle": ... elif shape_type == "square": ...`).

**L — Liskov Substitution Principle**
What it means: Subtypes must be substitutable for their base type without breaking correctness — a subclass should honor the parent's contract (pre/post-conditions), not weaken/violate it.
Red flag: A subclass overrides a method to `raise NotImplementedError` or silently does nothing (classic: `Square` extends `Rectangle` but breaks `set_width`/`set_height` independence).

**I — Interface Segregation Principle**
What it means: Prefer many small, client-specific interfaces over one fat interface — no client should be forced to depend on methods it doesn't use.
Red flag: An interface/ABC has 10 methods but each concrete implementer only meaningfully implements 2–3 and stubs the rest with `pass` or `raise NotImplementedError`.

**D — Dependency Inversion Principle**
What it means: High-level modules should depend on abstractions (interfaces), not concrete low-level modules; concrete implementations should also depend on the same abstraction — wire dependencies via injection.
Red flag: A high-level class directly instantiates a concrete low-level class internally (`self.db = MySQLDatabase()`) instead of accepting an injected abstraction (`self.db: Database`), making it impossible to swap/mock.

---

## UML Relationships

| Relationship | Meaning | Java hint |
|---|---|---|
| Association | Objects know about each other, independent lifecycles, general "uses-a" | `class Driver { private Car car; public Driver(Car car) { this.car = car; } }` |
| Aggregation | "Has-a", weak ownership — part can outlive the whole | `class Team { private List<Player> players; public Team(List<Player> p) { this.players = p; } }` |
| Composition | "Owns-a", strong ownership — part's lifecycle bound to whole | `class Car { private final Engine engine = new Engine(); }` (Engine created inside Car) |
| Inheritance (generalization) | "Is-a", subclass extends superclass | `class ElectricCar extends Car { ... }` |
| Realization/Implementation | Class implements an interface/abstract contract | `class FileLogger implements LoggerInterface { ... }` |

---

## Creational Patterns

**Singleton** — Intent: ensure a class has exactly one instance, provide global access point.
Use when: shared config, connection pool, logger, cache registry.
```java
public class Singleton {
    private Singleton() {}
    private static class Holder {
        private static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() {
        return Holder.INSTANCE;
    }
}
```

**Factory Method** — Intent: defer object creation to subclasses/a creator method instead of calling constructors directly.
Use when: caller shouldn't know the concrete class; many `if/elif` on type.
```java
public class ShapeFactory {
    public static Shape create(String kind) {
        return switch (kind.toLowerCase()) {
            case "circle" -> new Circle();
            case "square" -> new Square();
            default -> throw new IllegalArgumentException("Unknown kind: " + kind);
        };
    }
}
```

**Abstract Factory** — Intent: create *families* of related objects without specifying concrete classes.
Use when: you need to swap an entire family of related products together (e.g. Light/Dark UI theme widgets).
```java
public interface UIFactory {
    Button createButton();
    Checkbox createCheckbox();
}
public class DarkUIFactory implements UIFactory {
    public Button createButton() { return new DarkButton(); }
    public Checkbox createCheckbox() { return new DarkCheckbox(); }
}
```

**Builder** — Intent: separate construction of a complex object from its representation, build step-by-step.
Use when: object has many optional params/telescoping constructor problem.
```java
public class PizzaBuilder {
    private final Pizza pizza = new Pizza();
    public PizzaBuilder addCheese() { pizza.getToppings().add("cheese"); return this; }
    public PizzaBuilder addOlives() { pizza.getToppings().add("olives"); return this; }
    public Pizza build() { return pizza; }
}
```

**Prototype** — Intent: create new objects by cloning an existing instance instead of building from scratch.
Use when: object creation is expensive, or you need copies with slight variations.
```java
public class Prototype implements Cloneable {
    @Override
    public Prototype clone() {
        try {
            return (Prototype) super.clone();
        } catch (CloneNotSupportedException e) {
            throw new AssertionError();
        }
    }
}
```

---

## Structural Patterns

**Adapter** — Intent: convert one interface into another interface clients expect.
Use when: integrating a third-party/legacy class whose interface doesn't match yours.
```java
public class OldPrinter {
    public void printOld(String text) { System.out.println(text); }
}
public class PrinterAdapter implements Printer {
    private final OldPrinter old;
    public PrinterAdapter(OldPrinter old) { this.old = old; }
    public void print(String text) { old.printOld(text); }
}
```

**Decorator** — Intent: attach additional responsibilities to an object dynamically, without altering its class.
Use when: need optional/stackable behavior (e.g. add cheese/milk to coffee, add logging to a function).
```java
public class CoffeeWithMilk implements Coffee {
    private final Coffee coffee;
    public CoffeeWithMilk(Coffee coffee) { this.coffee = coffee; }
    public double cost() { return coffee.cost() + 2.0; }
}
```

**Facade** — Intent: provide a single simplified interface to a complex subsystem.
Use when: hide complexity of multiple subsystem classes behind one entry point.
```java
public class ComputerFacade {
    public void start() {
        cpu.freeze();
        memory.load();
        cpu.execute();
    }
}
```

**Proxy** — Intent: provide a placeholder/surrogate that controls access to another object.
Use when: lazy loading, access control, caching, remote object stand-in.
```java
public class ImageProxy implements Image {
    private final String path;
    private RealImage real;
    public ImageProxy(String path) { this.path = path; }
    public void display() {
        if (real == null) real = new RealImage(path);
        real.display();
    }
}
```

**Composite** — Intent: compose objects into tree structures and treat individual objects and compositions uniformly.
Use when: part-whole hierarchies (files/folders, UI widget trees, org charts).
```java
public class Folder implements FileSystemItem {
    private final List<FileSystemItem> children = new ArrayList<>();
    public int size() {
        return children.stream().mapToInt(FileSystemItem::size).sum();
    }
}
```

---

## Behavioral Patterns

**Strategy** — Intent: define a family of interchangeable algorithms, select one at runtime.
Use when: multiple ways to do the same task, chosen dynamically (payment method, sorting/compression algorithm).
```java
public interface PaymentStrategy {
    void pay(double amount);
}
public class CreditCardPayment implements PaymentStrategy {
    public void pay(double amount) { System.out.println("Paid " + amount + " via card"); }
}
```

**Observer** — Intent: one-to-many dependency — when subject changes state, all dependents are notified.
Use when: event/notification systems, pub-sub, UI reacting to model changes.
```java
public class Subject {
    private final List<Observer> observers = new CopyOnWriteArrayList<>();
    public void notifyObservers() {
        for (Observer o : observers) o.update(this);
    }
}
```

**Command** — Intent: encapsulate a request as an object, enabling queuing, logging, and undo.
Use when: need undo/redo, transactional operations, request queues.
```java
public interface Command {
    void execute();
    void undo();
}
```

**State** — Intent: allow an object to alter its behavior when its internal state changes, appears to change class.
Use when: object behavior branches heavily on a "status" field (order states, TCP connection states, vending machine).
```java
public interface State {
    void handle(Context context);
}
public class IdleState implements State {
    public void handle(Context context) { context.setState(new RunningState()); }
}
```

**Template Method** — Intent: define the skeleton of an algorithm in a base class, let subclasses override specific steps.
Use when: several classes share the same overall workflow but differ in some steps.
```java
public abstract class DataProcessor {
    public final void process() {
        read();
        transform();
        write();
    }
    protected abstract void transform();
}
```

**Iterator** — Intent: provide a way to sequentially access elements of a collection without exposing its internals.
Use when: custom traversal logic over a custom data structure.
```java
public class CustomCollection implements Iterable<String> {
    private final List<String> items = new ArrayList<>();
    @Override
    public Iterator<String> iterator() {
        return items.iterator();
    }
}
```

**Mediator** — Intent: define an object that centralizes communication between a set of objects, reducing direct coupling.
Use when: many objects reference each other directly (chat room, air-traffic control, UI form components).
```java
public class ChatRoom {
    public void send(User sender, String message) {
        System.out.println("[" + sender.getName() + "]: " + message);
    }
}
```

**Chain of Responsibility** — Intent: pass a request along a chain of handlers until one handles it.
Use when: multiple handlers could process a request, order matters, decouple sender from receiver (middleware, approval workflows, logging levels).
```java
public abstract class Handler {
    protected Handler next;
    public void setNext(Handler next) { this.next = next; }
    public void handle(Request req) {
        if (next != null) next.handle(req);
    }
}
```

**Memento** — Intent: capture and externalize an object's internal state so it can be restored later, without violating encapsulation.
Use when: need undo/checkpoint/rollback of an object's state (text editor undo, game save states).
```java
public record Memento(String state) {}
public class Originator {
    private String state;
    public Memento save() { return new Memento(state); }
    public void restore(Memento m) { this.state = m.state(); }
}
```

---

## Symptom -> Pattern Decision Table

| Symptom | Pattern |
|---|---|
| Many if/elif dispatching on a type | Factory Method |
| Need families of related objects created together | Abstract Factory |
| Object has many optional constructor params | Builder |
| Need cheap copies of expensive-to-create objects | Prototype |
| Need exactly one shared instance | Singleton |
| Need interchangeable algorithms | Strategy |
| One-to-many change notification | Observer |
| Object behavior changes by internal state | State |
| Need undo/redo | Command + Memento |
| Incompatible interfaces | Adapter |
| Simplify complex subsystem | Facade |
| Control/lazy access to object | Proxy |
| Uniform tree of objects (part-whole) | Composite |
| Fixed algorithm skeleton, varying steps | Template Method |
| Need to add optional behavior dynamically/stackable | Decorator |
| Custom traversal over a collection | Iterator |
| Many objects tightly coupled to each other | Mediator |
| Request should pass through multiple potential handlers | Chain of Responsibility |
