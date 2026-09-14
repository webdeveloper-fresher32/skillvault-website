# Design Patterns — Python Code Examples

Hands-on Python implementations of every major LLD concept and design pattern.
Each folder has a `bad_example.py` (what NOT to do) and `good_example.py` (the pattern applied).

**For the full learning roadmap, see the top-level [`README.md`](../README.md).**

---

## Contents

### Foundations
| Folder | Topic |
|--------|-------|
| `1. OOPS Recap/` | Classes, objects, inheritance, encapsulation, abstraction, UML relationships |
| `2. SOLID Principles/` | SRP, OCP, LSP, ISP, DIP — bad and good examples for each |

### Behavioural Patterns
| Folder | Pattern | Real Example |
|--------|---------|--------------|
| `3. Memento Pattern/` | Memento | Text editor undo/redo |
| `4. Observer Pattern/` | Observer | Weather station broadcasting to mobile + TV |
| `5. Strategy Pattern/` | Strategy | Discount calculation (Diwali, Holi, flat rate) |
| `6. Command Pattern/` | Command | Restaurant order queue |
| `7. Template Pattern/` | Template Method | Game framework with fixed skeleton |
| `8. Iterator Pattern/` | Iterator | Custom collection + linked list traversal |
| `9. State Pattern/` | State | Transport app mode switching |
| `10. Mediator Pattern/` | Mediator | Decoupled component communication |
| `23. Chain of Responsibility Pattern/` | Chain of Responsibility | Expense approval chain |

### Creational Patterns
| Folder | Pattern | Real Example |
|--------|---------|--------------|
| `11. Singleton Pattern/` | Singleton | Single shared instance |
| `12. Factory Pattern/` | Factory | Object creation by type string |
| `13. Abstract Factory Pattern/` | Abstract Factory | Families of related objects |
| `14. Builder Design Pattern/` | Builder | Step-by-step complex object construction |
| `15. Prototype Pattern/` | Prototype | Deep vs shallow copy |

### Structural Patterns
| Folder | Pattern | Real Example |
|--------|---------|--------------|
| `16. Adapter Pattern/` | Adapter | Incompatible interface bridging |
| `17. Decorater Pattern/` | Decorator | Dynamically adding responsibilities |
| `18. Proxy Pattern/` | Proxy | Access control / lazy loading |
| `19. Composite Pattern/` | Composite | File system tree structure |
| `20. Facade Pattern/` | Facade | Simplified API over subsystem |

### Capstone Project
| Folder | Description |
|--------|-------------|
| `21. Ride Sharing Project - Bad Example/` | Tightly coupled, hard to extend — what NOT to build |
| `22. Ride Sharing Project - Good Example/` | Strategy + Factory + SOLID applied to a real system |

---

## Prerequisites
- Python 3.8+
- Basic understanding of classes and inheritance
