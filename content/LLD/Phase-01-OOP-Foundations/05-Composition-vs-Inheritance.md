# Composition vs Inheritance in Java — Complete Guide

## Table of Contents
1. [The Golden Rule: Favor Composition over Inheritance](#1-the-golden-rule-favor-composition-over-inheritance)
2. [IS-A vs HAS-A Mental Models](#2-is-a-vs-has-a-mental-models)
3. [The Pitfalls of Deep Inheritance Hierarchies](#3-the-pitfalls-of-deep-inheritance-hierarchies)
4. [Forwarding & Delegation Pattern](#4-forwarding--delegation-pattern)
5. [Real-World Example: Instrumented Set Refactoring](#5-real-world-example-instrumented-set-refactoring)
6. [Side-by-Side Comparison](#6-side-by-side-comparison)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Golden Rule: Favor Composition over Inheritance

In *Effective Java*, Joshua Bloch states: **"Favor composition over inheritance."**  
Inheritance breaks encapsulation because a subclass depends on the implementation details of its superclass. Composition achieves polymorphism and code reuse by combining simpler components dynamically.

---

## 2. IS-A vs HAS-A Mental Models

```
┌─────────────────────────────────────────────────────────────┐
│ Inheritance: IS-A Relationship (Rigid, Static Compile-Time) │
│ - Dog IS-A Animal                                           │
│ - Rigid: Cannot change parent behavior at runtime           │
├─────────────────────────────────────────────────────────────┤
│ Composition: HAS-A Relationship (Flexible, Dynamic Runtime) │
│ - Car HAS-A Engine                                          │
│ - Flexible: Can swap V8Engine with ElectricEngine anytime   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Pitfalls of Deep Inheritance Hierarchies

Inheriting for code reuse alone leads to class explosion:
```
Vehicle
 ├── LandVehicle
 │    ├── GasCar
 │    └── ElectricCar
 └── WaterVehicle
      ├── GasBoat
      └── ElectricBoat
// Adding Hybrid, Amphibious, or Autonomous explodes the matrix!
```

With Composition:
```java
public class Vehicle {
    private final PropulsionEngine engine;
    private final SteeringControl steering;
    private final NavigationSystem navigation;

    public Vehicle(PropulsionEngine engine, SteeringControl steering, NavigationSystem navigation) {
        this.engine = engine;
        this.steering = steering;
        this.navigation = navigation;
    }
}
// Any combination can be instantiated dynamically without subclass explosion!
```

---

## 4. Forwarding & Delegation Pattern

When you want to extend the behavior of an existing class (like a `Set` or `List`), wrap an instance of it and delegate methods to it:

```java
import java.util.Collection;
import java.util.Set;

public class ForwardingSet<E> implements Set<E> {
    private final Set<E> delegate;

    public ForwardingSet(Set<E> delegate) {
        this.delegate = delegate;
    }

    @Override public int size() { return delegate.size(); }
    @Override public boolean isEmpty() { return delegate.isEmpty(); }
    @Override public boolean contains(Object o) { return delegate.contains(o); }
    @Override public boolean add(E e) { return delegate.add(e); }
    @Override public boolean addAll(Collection<? extends E> c) { return delegate.addAll(c); }
    @Override public void clear() { delegate.clear(); }
    // ... forward remaining Set methods ...
}
```

---

## 5. Real-World Example: Instrumented Set Refactoring

```java
// Safe wrapper with counting capability:
public class InstrumentedSet<E> extends ForwardingSet<E> {
    private int addCount = 0;

    public InstrumentedSet(Set<E> set) {
        super(set);
    }

    @Override
    public boolean add(E e) {
        addCount++;
        return super.add(e);
    }

    @Override
    public boolean addAll(Collection<? extends E> c) {
        addCount += c.size();
        return super.addAll(c);
    }

    public int getAddCount() { return addCount; }
}

// Works safely with ANY Set (HashSet, TreeSet, ConcurrentSkipListSet)!
InstrumentedSet<String> tracked = new InstrumentedSet<>(new HashSet<>());
tracked.addAll(List.of("A", "B", "C"));
System.out.println(tracked.getAddCount()); // Exactly 3! No double counting!
```

---

## 6. Side-by-Side Comparison

```
❌ BAD: Subclassing HashSet directly
┌───────────────────────────────────────┐
│ public class BadCountSet<E>           │
│         extends HashSet<E> {          │ // Fragile! HashSet.addAll() calls
│     // Overriding add() and addAll() │ // this.add() internally, resulting
│     // causes double counting!       │ // in double count!
│ }                                     │
└───────────────────────────────────────┘

✅ GOOD: Composition Wrapper
┌───────────────────────────────────────┐
│ public class GoodCountSet<E> {        │
│     private final Set<E> target;      │ // Bulletproof! Zero reliance on
│     private int count = 0;            │ // internal private implementation
│     public GoodCountSet(Set<E> s) {..}│ // of the underlying Set!
│ }                                     │
└───────────────────────────────────────┘
```

---

## 7. Interview Q&A

**Q: When is inheritance actually appropriate in LLD?**  
*Answer:* Only when a genuine, unconditional IS-A relationship exists across the entire contract of the class (satisfying the Liskov Substitution Principle), and where both classes reside within the same package or the superclass was explicitly designed and documented for inheritance.
