# Composite Pattern — Complete Guide

## Table of Contents
1. [The Problem Composite Solves](#1-the-problem-composite-solves)
2. [What is the Composite Pattern?](#2-what-is-the-composite-pattern)
3. [Bad Example: No Composite](#3-bad-example-no-composite)
4. [Good Example: File System (File/Folder)](#4-good-example-file-system-filefolder)
5. [Second Example: Org Chart](#5-second-example-org-chart)
6. [When to Use / Trade-offs](#6-when-to-use--trade-offs)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem Composite Solves

Many real domains are naturally tree-shaped: a file system (files inside folders inside folders), an org chart (individual contributors reporting up through managers to a CEO), a UI (widgets inside panels inside windows), a menu (items inside categories inside a menu).

The pain shows up when client code has to constantly distinguish "is this a single item or a group of items?" and branch accordingly:

```
def get_size(node):
    if isinstance(node, File):
        return node.size
    elif isinstance(node, Folder):
        total = 0
        for child in node.children:
            total += get_size(child)  # recursive, and this branching repeats
        return total                   # everywhere size/count/search is needed
```

Every operation (compute size, count items, search by name, print tree) needs its own `isinstance` branching duplicated across the codebase, and adding a third node type means updating every one of those functions.

---

## 2. What is the Composite Pattern?

Composite lets you treat individual objects (leaves) and compositions of objects (composites/containers) **uniformly**, through a shared interface. Both leaf and composite implement the same interface; a composite simply forwards/aggregates operations to its children — which may themselves be leaves or further composites.

```
                 ┌─────────────────────┐
                 │  Component (ABC)     │
                 │  + operation()        │
                 └──────────┬───────────┘
                             │ implements
              ┌──────────────┴───────────────┐
     ┌──────────────────┐          ┌──────────────────────┐
     │  Leaf              │          │  Composite             │
     │  (File)             │          │  (Folder)               │
     │  + operation()      │          │  + operation() {         │
     │    -> own logic     │          │      for child in         │
     └──────────────────┘          │        children:             │
                                     │        child.operation()      │
                                     │    }                            │
                                     │  + add(component)                │
                                     │  + remove(component)              │
                                     └──────────────────────┘
```

Client code calls `component.operation()` without caring whether `component` is a single `File` or an entire `Folder` subtree — recursion is handled *inside* the composite, not in client code.

---

## 3. Bad Example: No Composite

```python
class File:
    def __init__(self, name: str, size_kb: int) -> None:
        self.name = name
        self.size_kb = size_kb


class Folder:
    def __init__(self, name: str) -> None:
        self.name = name
        self.files: list[File] = []
        self.subfolders: list["Folder"] = []


def total_size(node: File | Folder) -> int:
    # Client is forced to know the difference between File and Folder,
    # and repeat this branching+recursion logic everywhere size is needed.
    if isinstance(node, File):
        return node.size_kb
    total = 0
    for f in node.files:
        total += total_size(f)
    for sub in node.subfolders:
        total += total_size(sub)
    return total


def count_items(node: File | Folder) -> int:
    # Same branching duplicated again for a DIFFERENT operation.
    if isinstance(node, File):
        return 1
    count = 0
    for f in node.files:
        count += count_items(f)
    for sub in node.subfolders:
        count += count_items(sub)
    return count
```

**Why this is painful:**
- Every new operation (size, count, search, print) reimplements the same "is it a File or a Folder" branching and recursion.
- Adding a third node type (e.g., a `Shortcut`) means touching every one of these free functions.
- `File` and `Folder` have no shared interface, so they can't be stored/passed around polymorphically.

---

## 4. Good Example: File System (File/Folder)

```python
from __future__ import annotations
from abc import ABC, abstractmethod


class FileSystemComponent(ABC):
    """Uniform interface for both leaves (File) and composites (Folder)."""

    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    def size(self) -> int:
        raise NotImplementedError

    @abstractmethod
    def print_tree(self, indent: int = 0) -> None:
        raise NotImplementedError


class File(FileSystemComponent):
    """Leaf — has no children, implements the operation directly."""

    def __init__(self, name: str, size_kb: int) -> None:
        super().__init__(name)
        self.size_kb = size_kb

    def size(self) -> int:
        return self.size_kb

    def print_tree(self, indent: int = 0) -> None:
        print(" " * indent + f"- {self.name} ({self.size_kb} KB)")


class Folder(FileSystemComponent):
    """Composite — holds children (Files or other Folders), forwards operations to them."""

    def __init__(self, name: str) -> None:
        super().__init__(name)
        self._children: list[FileSystemComponent] = []

    def add(self, component: FileSystemComponent) -> None:
        self._children.append(component)

    def remove(self, component: FileSystemComponent) -> None:
        self._children.remove(component)

    def size(self) -> int:
        # No isinstance checks — just delegate; each child knows how to compute its own size.
        return sum(child.size() for child in self._children)

    def print_tree(self, indent: int = 0) -> None:
        print(" " * indent + f"+ {self.name}/")
        for child in self._children:
            child.print_tree(indent + 2)


if __name__ == "__main__":
    root = Folder("project")
    src = Folder("src")
    src.add(File("main.py", 4))
    src.add(File("utils.py", 2))

    tests = Folder("tests")
    tests.add(File("test_main.py", 3))

    root.add(src)
    root.add(tests)
    root.add(File("README.md", 1))

    root.print_tree()
    print(f"\nTotal size: {root.size()} KB")

    # Client code never distinguishes File vs Folder — same interface either way:
    def describe(component: FileSystemComponent) -> str:
        return f"{component.name}: {component.size()} KB"

    print(describe(root))       # works on a whole tree
    print(describe(src))        # works on a subtree
    print(describe(File("x.txt", 5)))  # works on a single leaf
```

```
Output:
+ project/
  + src/
    - main.py (4 KB)
    - utils.py (2 KB)
  + tests/
    - test_main.py (3 KB)
  - README.md (1 KB)

Total size: 10 KB
project: 10 KB
src: 6 KB
x.txt: 5 KB
```

Adding a `size()` for a new node type just means implementing `FileSystemComponent` once — no existing code (`Folder.size`, `describe`) needs to change. That's Open/Closed in action, delivered by Composite.

---

## 5. Second Example: Org Chart

The same shape applies to an org chart: an `Employee` (leaf) and a `Manager` (composite, itself an `Employee` who also has reports).

```python
from __future__ import annotations
from abc import ABC, abstractmethod


class OrgUnit(ABC):
    def __init__(self, name: str, salary: float) -> None:
        self.name = name
        self.salary = salary

    @abstractmethod
    def total_headcount(self) -> int:
        raise NotImplementedError

    @abstractmethod
    def total_payroll(self) -> float:
        raise NotImplementedError


class Employee(OrgUnit):
    """Leaf — an individual contributor with no reports."""

    def total_headcount(self) -> int:
        return 1

    def total_payroll(self) -> float:
        return self.salary


class Manager(OrgUnit):
    """Composite — a manager IS an OrgUnit (has a salary) AND has reports."""

    def __init__(self, name: str, salary: float) -> None:
        super().__init__(name, salary)
        self._reports: list[OrgUnit] = []

    def add_report(self, unit: OrgUnit) -> None:
        self._reports.append(unit)

    def total_headcount(self) -> int:
        return 1 + sum(r.total_headcount() for r in self._reports)

    def total_payroll(self) -> float:
        return self.salary + sum(r.total_payroll() for r in self._reports)


if __name__ == "__main__":
    cto = Manager("Priya (CTO)", 220_000)

    backend_lead = Manager("Ravi (Backend Lead)", 160_000)
    backend_lead.add_report(Employee("Ana (Backend Eng)", 120_000))
    backend_lead.add_report(Employee("Sam (Backend Eng)", 118_000))

    frontend_lead = Manager("Wei (Frontend Lead)", 155_000)
    frontend_lead.add_report(Employee("Tom (Frontend Eng)", 115_000))

    cto.add_report(backend_lead)
    cto.add_report(frontend_lead)

    print(f"Total headcount under CTO: {cto.total_headcount()}")
    print(f"Total payroll under CTO: ${cto.total_payroll():,.2f}")
    print(f"Backend lead's team payroll alone: ${backend_lead.total_payroll():,.2f}")
```

```
Output:
Total headcount under CTO: 6
Total payroll under CTO: $888,000.00
Backend lead's team payroll alone: $398,000.00
```

`cto.total_payroll()` and `backend_lead.total_payroll()` use the exact same method — client code doesn't need to know it's asking a "top of the org" vs a "mid-level" node; both are just `OrgUnit`.

---

## 6. When to Use / Trade-offs

**Use Composite when:**
- Your domain is naturally a tree/hierarchy (file systems, UI widget trees, org charts, menu structures, category trees).
- You want client code to treat a single object and a group of objects through the same interface, especially when operations (sum, count, render) are naturally recursive.
- You want new node types to be added without changing existing traversal/aggregation code (Open/Closed).

**Trade-offs:**
- The shared `Component` interface can end up forcing leaf nodes to implement operations that don't naturally apply to them (e.g., should `File` have `add()`/`remove()`? Usually you either raise `NotImplementedError` in the leaf or split `add`/`remove` out of the shared interface — a known tension in Composite design, sometimes called "safety vs transparency").
- Can make the design overly general if the hierarchy has only one or two levels and doesn't really need polymorphic recursion.
- Debugging can require walking several levels of recursive delegation to find where a value actually comes from.

---

## 7. Hands-On Exercises

**Exercise 1:** Add a `search(name: str) -> FileSystemComponent | None` method to both `File` and `Folder` that returns the first component matching `name`, searching recursively through folders.

**Exercise 2:** In the org chart example, add a `find_by_name(name: str) -> OrgUnit | None` method, and a `average_salary()` method on `Manager` that computes the average salary across the whole reporting subtree (including itself).

**Exercise 3:** Decide and implement an answer to the "safety vs transparency" tension: should `add()`/`remove()` live on the shared `FileSystemComponent` interface (transparency — uniform interface, but `File.add()` must raise `NotImplementedError`) or only on `Folder` (safety — no interface pollution, but client code needs an `isinstance` check before calling `add`)? Implement the "safety" version and compare.

---

## 8. Interview Q&A

**Q: What problem does the Composite pattern solve?**
Answer: It lets client code treat individual objects (leaves) and groups of objects (composites) uniformly through one shared interface, so tree-shaped domains (file systems, org charts, UI trees) can be processed recursively without the client branching on "is this a single item or a container?" everywhere an operation is needed.

**Q: Walk through a Composite example using a file system.**
Answer: `FileSystemComponent` is the shared abstract interface with methods like `size()`. `File` is the leaf — it implements `size()` by returning its own size directly. `Folder` is the composite — it holds a list of child `FileSystemComponent`s (which can be `File`s or nested `Folder`s) and implements `size()` by summing `child.size()` over its children, recursing naturally. Client code calls `component.size()` on the root and gets the correct total regardless of how deep the tree is, without any `isinstance` checks.

**Q: How does Composite support the Open/Closed Principle?**
Answer: Adding a new node type (e.g., a `Shortcut` that points to another file) only requires implementing the shared `FileSystemComponent` interface once. Existing code — `Folder.size()`, any recursive traversal, any client function — doesn't need to change, because it already works polymorphically against the interface rather than against concrete types.

**Q: What is the "safety vs transparency" trade-off in Composite design?**
Answer: If `add()`/`remove()` are declared on the shared component interface (transparency), clients can call them uniformly on any component, but leaf classes like `File` must implement them as no-ops or raise exceptions since they have no children — that's a violation of Liskov Substitution if callers aren't careful. If `add()`/`remove()` live only on the composite class (`Folder`) (safety), the interface stays clean, but clients need an `isinstance`/type check before adding children, reintroducing some of the branching Composite is meant to eliminate. Real codebases pick based on which cost they'd rather pay.

**Q: How is Composite different from Decorator, since both involve recursive wrapping/nesting of the same interface?**
Answer: They look structurally similar (both nest objects behind a shared interface) but solve different problems. Composite models **part-whole hierarchies** — a composite has a *list* of children and aggregates over them (e.g., sum sizes of many files). Decorator wraps exactly **one** object to add behavior — it's a single-child chain, not a branching tree, and its purpose is enhancing one object's behavior rather than aggregating over many.

**Q: Implement the Composite pattern from scratch for a UI widget tree, where a `Panel` can contain `Button`s and other `Panel`s, and every widget supports `render(indent: int) -> None`.**
Answer:
```python
from __future__ import annotations
from abc import ABC, abstractmethod


class Widget(ABC):
    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    def render(self, indent: int = 0) -> None:
        raise NotImplementedError


class Button(Widget):
    def render(self, indent: int = 0) -> None:
        print(" " * indent + f"[Button: {self.name}]")


class Panel(Widget):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self._children: list[Widget] = []

    def add(self, widget: Widget) -> None:
        self._children.append(widget)

    def render(self, indent: int = 0) -> None:
        print(" " * indent + f"<Panel: {self.name}>")
        for child in self._children:
            child.render(indent + 2)


root = Panel("MainWindow")
toolbar = Panel("Toolbar")
toolbar.add(Button("Save"))
toolbar.add(Button("Open"))
root.add(toolbar)
root.add(Button("Submit"))
root.render()
```
