# 30-Day LLD Study Plan

A day-by-day plan for software engineers preparing for Java Low-Level Design (LLD) interviews. Each day lists a goal and concrete actions. Phase folder names are fixed and used for mapping instead of exact lesson filenames.

---

## Week 1 (Days 1–7): Java OOP Foundations — Phase-01-OOP-Foundations

**Day 1**
Goal: Classes, objects, and constructors.
Do: Read the first 1–2 lessons of `Phase-01-OOP-Foundations`. Implement a `Book` and `Library` class from scratch without looking at the lesson, using constructors and access modifiers correctly. Explain out loud what happens in the JVM heap and stack when you instantiate an object.

**Day 2**
Goal: Encapsulation and access control conventions.
Do: Read the encapsulation lesson(s) in `Phase-01-OOP-Foundations`. Rewrite Day 1's `Book`/`Library` classes to use private fields with getter/setter methods and immutable records where appropriate. Explain encapsulation and data hiding out loud.

**Day 3**
Goal: Inheritance and the "is-a" relationship.
Do: Read the inheritance lesson(s). From scratch, model a small `Employee -> Manager, Engineer` hierarchy with shared and overridden behavior. Explain dynamic method dispatch and runtime polymorphism in the JVM out loud.

**Day 4**
Goal: Polymorphism and abstraction.
Do: Read the polymorphism/abstraction lesson(s). Implement an abstract `Shape` (or interface) with `Circle`, `Square`, `Triangle` subclasses, each with a working `area()`. Write a function that loops over a list of mixed shapes and calls `.area()` polymorphically. Explain out loud why this satisfies OCP.

**Day 5**
Goal: Static/class methods, magic methods.
Do: Read the remaining `Phase-01-OOP-Foundations` lessons covering static/class methods and dunder methods. From scratch, implement an immutable `Money` class or record with `equals()`, `hashCode()`, `toString()`, and static factory methods. Explain out loud why overriding equals/hashCode together is essential.

**Day 6**
Goal: Dataclasses and composition vs inheritance.
Do: Read any remaining `Phase-01-OOP-Foundations` material on dataclasses/composition. Refactor Day 3's hierarchy to use composition where appropriate (e.g. `Employee` has-a `Address`, has-a `Salary`). Rewrite one class as a Java `record`. Explain out loud the trade-off between inheritance and composition using this example.

**Day 7**
Goal: Consolidate Week 1.
Do: Without looking at any notes, implement a small end-to-end OOP mini-model (pick something new, e.g. a `Zoo` with `Animal` subclasses) covering encapsulation, inheritance, polymorphism, and proper `equals()` and `hashCode()` contracts. Explain the whole design out loud in under 5 minutes as if to an interviewer. Review the OOP section of `Quick-Reference/Cheatsheet.md` and confirm you can define every term without looking.

---

## Week 2 (Days 8–14): SOLID + UML + Creational Patterns

**Day 8**
Goal: Single Responsibility + Open/Closed Principles.
Do: Study Phase-02-SOLID-Principles (SRP and OCP lessons). Take a "God class" you write from scratch (e.g. a class that computes, formats, and saves a report) and refactor it to fix SRP violations. Explain out loud what "one reason to change" means using your own example.

**Day 9**
Goal: Liskov Substitution + Interface Segregation Principles.
Do: Continue Phase-02-SOLID-Principles (LSP and ISP lessons). From scratch, write the classic Rectangle/Square LSP counterexample, then fix it. Write an ISP violation (a fat interface) and split it into smaller interfaces. Explain both out loud.

**Day 10**
Goal: Dependency Inversion Principle.
Do: Finish Phase-02-SOLID-Principles (DIP lesson). Implement a `NotificationService` that depends on an abstract `MessageSender`, with `EmailSender`/`SMSSender` injected via constructor. Explain out loud how this differs from directly instantiating `EmailSender` inside the service.

**Day 11**
Goal: UML relationships and object modeling.
Do: Study Phase-03-UML-and-Object-Modeling (association, aggregation, composition lessons). Without looking, sketch a UML class diagram (on paper) for a `School` domain (`School`, `Classroom`, `Student`, `Teacher`) and label each relationship type. Implement the Java classes matching your diagram.

**Day 12**
Goal: UML for full systems + review.
Do: Finish Phase-03-UML-and-Object-Modeling. Pick one real-world problem name from Week 4's list (e.g. Parking Lot) and, without looking at any reference, sketch its full class diagram from memory. Explain each relationship choice out loud.

**Day 13**
Goal: Creational patterns part 1 — Singleton, Factory Method.
Do: Study the Singleton and Factory Method lessons in Phase-04-Creational-Patterns. Implement both from scratch (including the Bill Pugh / Enum thread-safe Singleton). Explain out loud when each is appropriate and the "many if/elif" smell that Factory Method fixes.

**Day 14**
Goal: Creational patterns part 2 — Abstract Factory, Builder, Prototype.
Do: Finish Phase-04-Creational-Patterns. Implement all three from scratch with your own example (e.g. a UI theme Abstract Factory, a `PizzaBuilder`, and a copy-constructor or Cloneable Prototype). Explain the Factory Method vs Abstract Factory distinction out loud. Review the Creational section of the Cheatsheet without looking at your code.

---

## Week 3 (Days 15–21): Structural + Behavioral Patterns + Java Concurrency

**Day 15**
Goal: Structural patterns part 1 — Adapter, Facade.
Do: Study Adapter and Facade lessons in Phase-05-Structural-Patterns. Implement both from scratch with a concrete example (e.g. adapting a legacy payment API, a `ComputerFacade`). Explain out loud the difference between them (compatibility vs simplification).

**Day 16**
Goal: Structural patterns part 2 — Decorator, Proxy, Composite.
Do: Finish Phase-05-Structural-Patterns. Implement all three from scratch (a stackable `CoffeeDecorator`, a lazy-loading `ImageProxy`, a `Folder`/`File` Composite). Explain the Proxy vs Decorator distinction and the Composite recursion out loud.

**Day 17**
Goal: Behavioral patterns part 1 — Strategy, Observer, Command.
Do: Study Strategy, Observer, and Command lessons in Phase-06-Behavioral-Patterns. Implement all three from scratch (a payment `Strategy`, a stock-price `Observer`, an undoable `Command` remote control). Explain out loud how Command enables undo.

**Day 18**
Goal: Behavioral patterns part 2 — State, Template Method, Iterator.
Do: Continue Phase-06-Behavioral-Patterns. Implement a `State`-based traffic light or ATM stub, a Template Method for processing 2 file formats, and a custom `Iterator`/generator over a data structure. Explain the Strategy vs State distinction out loud.

**Day 19**
Goal: Behavioral patterns part 3 — Mediator, Chain of Responsibility, Memento.
Do: Finish Phase-06-Behavioral-Patterns. Implement a chat-room Mediator, a support-ticket Chain of Responsibility, and a text-editor Memento/undo stack. Explain out loud when you'd combine Command + Memento for undo.

**Day 20**
Goal: Python features for LLD — ABCs, enums, dataclasses recap, context managers.
Do: Study Phase-07-Java-Features-and-Concurrency-for-LLD. From scratch, implement an abstract base class enforcing a contract, an `Enum`-backed status field, and a custom context manager (`__enter__`/`__exit__`) for a resource-hold scenario (e.g. acquiring a parking spot). Explain out loud why each is idiomatic Python for LLD.

**Day 21**
Goal: Python features for LLD — singledispatch, operator overloading, consolidation.
Do: Finish Phase-07-Java-Features-and-Concurrency-for-LLD. Implement `functools.singledispatch` for a `render()` function over multiple shape types, and add `__lt__`/`__eq__` to a `Task` class so it works in a `heapq`. Review the full Structural/Behavioral/Decision-table sections of the Cheatsheet without looking at your own code, and quiz yourself on the "Symptom -> Pattern" table.

---

## Week 4 (Days 22–30): Real-World LLD Problems (one per day)

**Day 22**
Goal: Parking Lot design.
Do: Study Phase-09-Booking-Systems-Design (Parking Lot lesson) + `Projects/` Parking Lot project. Without looking, run the full 7-step process (clarify -> entities -> relationships -> interfaces -> patterns -> code -> trade-offs) and implement the core classes from scratch in 45–60 minutes. Explain the design out loud, focusing on spot allocation and fee strategy.

**Day 23**
Goal: Movie/Ticket Booking design.
Do: Study Phase-09-Booking-Systems-Design (booking/seat lesson) + the matching `Projects/` file. Implement from scratch, focusing on preventing double-booking (seat locking) and the checkout hold-expiry flow. Explain the concurrency-safety approach out loud.

**Day 24**
Goal: Splitwise / Expense Sharing design.
Do: Study Phase-08-Transactional-Systems-Design (expense-splitting lesson) + the matching `Projects/` file. Implement the balance-tracking model and the debt-simplification greedy algorithm from scratch. Explain the algorithm's time complexity out loud.

**Day 25**
Goal: Cab/Ride Booking design.
Do: Study Phase-09-Booking-Systems-Design (ride-matching lesson) + the matching `Projects/` file. Implement the `Trip` state machine and a simple nearest-driver matching Strategy from scratch. Explain how you'd avoid matching two riders to one driver out loud.

**Day 26**
Goal: ATM + Vending Machine design (two State-pattern problems, one day).
Do: Study Phase-08-Transactional-Systems-Design (ATM/vending lessons) + matching `Projects/` files. Implement one of the two fully from scratch as a State machine; sketch the other's states/transitions on paper only. Explain the State-pattern transitions out loud for both.

**Day 27**
Goal: Elevator System design.
Do: Study Phase-09-Booking-Systems-Design or Phase-10-Platform-Systems-Design (whichever contains the Elevator lesson) + the matching `Projects/` file. Implement the request-scheduling core (SCAN/LOOK algorithm) from scratch. Explain out loud how you'd extend it to multiple elevators with a dispatcher.

**Day 28**
Goal: Library Management + URL Shortener design (two lighter problems, one day).
Do: Study Phase-10-Platform-Systems-Design (library/URL shortener lessons) + matching `Projects/` files. Implement the URL Shortener's counter-based base-62 encoder fully from scratch; sketch the Library hold-queue logic on paper. Explain both trade-off discussions out loud (collision handling; reservation queues).

**Day 29**
Goal: WhatsApp + Spotify design (two Observer/Strategy-heavy problems, one day).
Do: Study Phase-11-Social-Media-Systems-Design (messaging lesson) and Phase-10-Platform-Systems-Design (media/playback lesson if present) + matching `Projects/` files. Implement the Spotify playback `Strategy` (sequential/shuffle/repeat) fully from scratch; sketch WhatsApp's group-chat + delivery-status model on paper. Explain both out loud.

**Day 30**
Goal: Amazon Cart design + full-course review.
Do: Study Phase-11-Social-Media-Systems-Design or Phase-10-Platform-Systems-Design (whichever contains the cart/e-commerce lesson) + the matching `Projects/` file, and skim Phase-12-Interview-Process-and-Advanced for interview-process tips. Implement the cart + stacked-discount pricing model from scratch. Do a final pass over the full `Quick-Reference/Cheatsheet.md` and `Interview-QA.md`, marking anything you can't answer confidently for a last review tomorrow.

---

## Final 2 Days: Mock Interview Self-Practice

**Day 31 (or "Day 2 before interview")**
Do: Pick 2 random problems from the full list below (use a random picker, don't cherry-pick easy ones):
Parking Lot, Movie Booking, Splitwise, Cab Booking, ATM, Vending Machine, Elevator, Library, URL Shortener, WhatsApp, Spotify, Amazon Cart.
For each, set a 45-minute timer and run the full 7-step process out loud (or on paper, narrating as if an interviewer is listening): clarify requirements, identify entities, identify relationships, define interfaces, pick patterns, write class skeletons, discuss trade-offs/extensibility. No notes, no lesson files open. Afterward, compare against the corresponding `Projects/` file and Phase lesson, and note gaps.

**Day 32 (interview day − 1)**
Do: Pick 2 more random problems from the same list (excluding ones already drilled twice) and repeat the same 45-minute full 7-step process for each. Spend the remaining time reviewing only the gaps you logged on Day 31, plus one final skim of `Quick-Reference/Cheatsheet.md`'s "Symptom -> Pattern" decision table until you can map every symptom instantly.
