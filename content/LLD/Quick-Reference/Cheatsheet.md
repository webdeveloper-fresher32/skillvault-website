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

| Relationship | Meaning | Python hint |
|---|---|---|
| Association | Objects know about each other, independent lifecycles, general "uses-a" | `class Driver: def __init__(self, car: Car): self.car = car` |
| Aggregation | "Has-a", weak ownership — part can outlive the whole | `class Team: def __init__(self): self.players: list[Player] = []` (players created outside, passed in) |
| Composition | "Owns-a", strong ownership — part's lifecycle bound to whole; deleting whole deletes part | `class Car: def __init__(self): self.engine = Engine()` (Engine created inside Car) |
| Inheritance (generalization) | "Is-a", subclass extends superclass | `class ElectricCar(Car): ...` |
| Realization/Implementation | Class implements an interface/abstract contract | `class FileLogger(LoggerInterface): ...` where `LoggerInterface(ABC)` |

---

## Creational Patterns

**Singleton** — Intent: ensure a class has exactly one instance, provide global access point.
Use when: shared config, connection pool, logger, cache registry.
```python
class Singleton:
    _instance = None
    def __new__(cls, *a, **kw):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

**Factory Method** — Intent: defer object creation to subclasses/a creator method instead of calling constructors directly.
Use when: caller shouldn't know the concrete class; many `if/elif` on type.
```python
class ShapeFactory:
    @staticmethod
    def create(kind: str) -> "Shape":
        return {"circle": Circle, "square": Square}[kind]()
```

**Abstract Factory** — Intent: create *families* of related objects without specifying concrete classes.
Use when: you need to swap an entire family of related products together (e.g. Light/Dark UI theme widgets).
```python
class UIFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: ...
    @abstractmethod
    def create_checkbox(self) -> Checkbox: ...
class DarkUIFactory(UIFactory):
    def create_button(self): return DarkButton()
    def create_checkbox(self): return DarkCheckbox()
```

**Builder** — Intent: separate construction of a complex object from its representation, build step-by-step.
Use when: object has many optional params/telescoping constructor problem.
```python
class PizzaBuilder:
    def __init__(self): self.pizza = Pizza()
    def add_cheese(self): self.pizza.toppings.append("cheese"); return self
    def add_olives(self): self.pizza.toppings.append("olives"); return self
    def build(self): return self.pizza
```

**Prototype** — Intent: create new objects by cloning an existing instance instead of building from scratch.
Use when: object creation is expensive, or you need copies with slight variations.
```python
import copy
class Prototype:
    def clone(self):
        return copy.deepcopy(self)
```

---

## Structural Patterns

**Adapter** — Intent: convert one interface into another interface clients expect.
Use when: integrating a third-party/legacy class whose interface doesn't match yours.
```python
class OldPrinter:
    def print_old(self, text): print(text)
class PrinterAdapter:
    def __init__(self, old): self.old = old
    def print(self, text): self.old.print_old(text)
```

**Decorator** — Intent: attach additional responsibilities to an object dynamically, without altering its class.
Use when: need optional/stackable behavior (e.g. add cheese/milk to coffee, add logging to a function).
```python
class CoffeeWithMilk:
    def __init__(self, coffee): self.coffee = coffee
    def cost(self): return self.coffee.cost() + 2
```

**Facade** — Intent: provide a single simplified interface to a complex subsystem.
Use when: hide complexity of multiple subsystem classes behind one entry point.
```python
class ComputerFacade:
    def start(self):
        self.cpu.freeze(); self.memory.load(); self.cpu.execute()
```

**Proxy** — Intent: provide a placeholder/surrogate that controls access to another object.
Use when: lazy loading, access control, caching, remote object stand-in.
```python
class ImageProxy:
    def __init__(self, path): self.path = path; self._real = None
    def display(self):
        if self._real is None: self._real = RealImage(self.path)
        self._real.display()
```

**Composite** — Intent: compose objects into tree structures and treat individual objects and compositions uniformly.
Use when: part-whole hierarchies (files/folders, UI widget trees, org charts).
```python
class Folder:
    def __init__(self): self.children = []
    def size(self): return sum(c.size() for c in self.children)
```

---

## Behavioral Patterns

**Strategy** — Intent: define a family of interchangeable algorithms, select one at runtime.
Use when: multiple ways to do the same task, chosen dynamically (payment method, sorting/compression algorithm).
```python
class PaymentStrategy(ABC):
    @abstractmethod
    def pay(self, amount): ...
class CreditCardPayment(PaymentStrategy):
    def pay(self, amount): print(f"Paid {amount} via card")
```

**Observer** — Intent: one-to-many dependency — when subject changes state, all dependents are notified.
Use when: event/notification systems, pub-sub, UI reacting to model changes.
```python
class Subject:
    def __init__(self): self._observers = []
    def notify(self):
        for o in self._observers: o.update(self)
```

**Command** — Intent: encapsulate a request as an object, enabling queuing, logging, and undo.
Use when: need undo/redo, transactional operations, request queues.
```python
class Command(ABC):
    @abstractmethod
    def execute(self): ...
    @abstractmethod
    def undo(self): ...
```

**State** — Intent: allow an object to alter its behavior when its internal state changes, appears to change class.
Use when: object behavior branches heavily on a "status" field (order states, TCP connection states, vending machine).
```python
class State(ABC):
    @abstractmethod
    def handle(self, context): ...
class IdleState(State):
    def handle(self, context): context.state = RunningState()
```

**Template Method** — Intent: define the skeleton of an algorithm in a base class, let subclasses override specific steps.
Use when: several classes share the same overall workflow but differ in some steps.
```python
class DataProcessor(ABC):
    def process(self):
        self.read(); self.transform(); self.write()
    @abstractmethod
    def transform(self): ...
```

**Iterator** — Intent: provide a way to sequentially access elements of a collection without exposing its internals.
Use when: custom traversal logic over a custom data structure.
```python
class Range:
    def __init__(self, n): self.n = n
    def __iter__(self):
        for i in range(self.n): yield i
```

**Mediator** — Intent: define an object that centralizes communication between a set of objects, reducing direct coupling.
Use when: many objects reference each other directly (chat room, air-traffic control, UI form components).
```python
class ChatRoom:
    def send(self, sender, message):
        print(f"[{sender}]: {message}")
```

**Chain of Responsibility** — Intent: pass a request along a chain of handlers until one handles it.
Use when: multiple handlers could process a request, order matters, decouple sender from receiver (middleware, approval workflows, logging levels).
```python
class Handler(ABC):
    def __init__(self): self.next = None
    def handle(self, req):
        if self.next: return self.next.handle(req)
```

**Memento** — Intent: capture and externalize an object's internal state so it can be restored later, without violating encapsulation.
Use when: need undo/checkpoint/rollback of an object's state (text editor undo, game save states).
```python
class Memento:
    def __init__(self, state): self._state = state
class Originator:
    def save(self): return Memento(self.state)
    def restore(self, memento): self.state = memento._state
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
