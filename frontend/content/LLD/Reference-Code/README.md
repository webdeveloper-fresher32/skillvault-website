# Design Patterns — Java Code Examples

Hands-on Java implementations of every major Low-Level Design (LLD) concept and design pattern.
Each folder provides standalone, runnable code illustrating anti-patterns (`BadExample.java`) and clean design pattern implementations (`GoodExample.java`).

**For the full learning roadmap, see the top-level [`README.md`](../README.md).**

---

## Contents

### Foundations
| Folder | Topic |
|--------|-------|
| `1. OOPS Recap/` | Classes, objects, inheritance, encapsulation, abstraction, and UML relationships |
| `2. SOLID Principles/` | SRP, OCP, LSP, ISP, DIP — bad and good examples for each principle |

### Behavioural Patterns
| Folder | Pattern | Real-World Example |
|--------|---------|-------------------|
| `3. Memento Pattern/` | Memento | Text editor undo/redo history |
| `4. Observer Pattern/` | Observer | Weather station broadcasting to mobile + TV displays |
| `5. Strategy Pattern/` | Strategy | Dynamic discount calculation (Diwali, Holi, standard) |
| `6. Command Pattern/` | Command | Restaurant kitchen order queue and execution |
| `7. Template Pattern/` | Template Method | Data parser framework with invariant workflow skeleton |
| `8. Iterator Pattern/` | Iterator | Custom collection traversal (Array-based and Linked List) |
| `9. State Pattern/` | State | Transport app navigation mode switching |
| `10. Mediator Pattern/` | Mediator | Decoupled air traffic control tower communication |
| `23. Chain of Responsibility Pattern/` | Chain of Responsibility | Hierarchical expense approval chain (Lead -> Manager -> Director -> CFO) |

### Creational Patterns
| Folder | Pattern | Real-World Example |
|--------|---------|-------------------|
| `11. Singleton Pattern/` | Singleton | Thread-safe logging instance |
| `12. Factory Pattern/` | Factory | Restaurant order food creation by type |
| `13. Abstract Factory Pattern/` | Abstract Factory | Cuisine families (North Indian, Chinese) with starters, main courses, and desserts |
| `14. Builder Design Pattern/` | Builder | Step-by-step custom laptop hardware construction |
| `15. Prototype Pattern/` | Prototype | Chess board deep cloning vs shallow copy |

### Structural Patterns
| Folder | Pattern | Real-World Example |
|--------|---------|-------------------|
| `16. Adapter Pattern/` | Adapter | Incompatible 3rd-party email service (SendGrid) adapter |
| `17. Decorater Pattern/` | Decorator | Beverage customizers (Milk, Whip Cream, Sugar) |
| `18. Proxy Pattern/` | Proxy | High-resolution image virtual proxy with lazy loading |
| `19. Composite Pattern/` | Composite | Hierarchical file system tree (Files and Folders) |
| `20. Facade Pattern/` | Facade | Unified API Gateway facade over UserService and OrderService |

### Capstone Project
| Folder | Description |
|--------|-------------|
| `21. Ride Sharing Project - Bad Example/` | Tightly coupled, hard to extend monolith — what NOT to build |
| `22. Ride Sharing Project - Good Example/` | Strategy + Clean Architecture + SOLID applied to a scalable ride sharing service |

---

## Prerequisites & Running Instructions

### Prerequisites
- Java 17+ (or Java 21+)
- Any standard terminal or IDE (IntelliJ IDEA, Eclipse, VS Code)

### Running Examples
With Java 11+, you can run single-file examples directly without explicit compilation:
```bash
# Example 1: Run single-file example
java GoodExample.java

# Example 2: Run multi-file package
javac *.java
java Main
# or for Ride Sharing capstone:
java Client
```
