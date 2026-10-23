# 🧠 The Ultimate Guide to Composite Pattern (LLD)

> **Core Philosophy:** *Compose objects into tree structures to represent part-whole hierarchies. Composite lets clients treat individual objects and compositions of objects uniformly.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [Leaf vs Composite (The Tree Structure)](#2-leaf-vs-composite-the-tree-structure)
3. [The Core Architecture (The 3 Participants)](#3-the-core-architecture-the-3-participants)
4. [Step-by-Step Implementation (Java)](#4-step-by-step-implementation-java)
5. [UML Class Diagram & Relationships](#5-uml-class-diagram--relationships)
6. [Execution Flow: Recursive Tree Traversal](#6-execution-flow-recursive-tree-traversal)
7. [Side-by-Side Comparison: Type Checking vs Composite](#7-side-by-side-comparison-type-checking-vs-composite)
8. [When to Use & When NOT to Use](#8-when-to-use--when-not-to-use)
9. [Pros & Cons Trade-off Analysis](#9-pros--cons-trade-off-analysis)
10. [Real-World Everyday Examples](#10-real-world-everyday-examples)
11. [The Ultimate Checklist & Mental Formula](#11-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: Hierarchical File System (Files & Directories) 📁 📄
Imagine building a file system explorer (like macOS Finder or Windows Explorer). You have:
* **Files:** A single file has a name and a direct byte size (`photo.jpg` = 5MB).
* **Directories:** A directory can contain files **and** nested subdirectories! Its size is the sum of everything inside it.

```
                           Root Folder 📁
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
   resume.pdf (1 MB) 📄                          Projects Folder 📁
                                                        │
                                ┌───────────────────────┴───────────────────────┐
                                ▼                                               ▼
                         index.html (50 KB) 📄                           Assets Folder 📁
                                                                                │
                                                                                ▼
                                                                         logo.png (2 MB) 📄
```

### The Naive Antipattern: Treating Objects Differently
If `File` and `Directory` have completely different classes without a unified interface:
* ❌ The client needs messy `instanceof` checks:
  ```java
  if (item instanceof Directory) {
      // Loop through children and calculate recursively
  } else if (item instanceof File) {
      // Direct size
  }
  ```
* ❌ You cannot treat a folder and a file uniformly!

---

## 2. Leaf vs Composite (The Tree Structure)

* **Leaf:** Has no children. Implements the operation directly (e.g. `File.getSize()`).
* **Composite:** Contains a list of child components. Implements the operation by delegating recursively to all children and aggregating results (e.g. `Directory.getSize()`).

---

## 3. The Core Architecture (The 3 Participants)

```
┌──────────────────────────────────────────────┐
│        <<interface>> FileSystemItem          │
├──────────────────────────────────────────────┤
│ + getName() : String                         │
│ + getSizeInBytes() : long                    │
│ + printStructure(indent: String)             │
└──────────────────────▲───────────────────────┘
                       │ implements
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌──────────────────┐        ┌──────────────────────────────────────┐
│  File (Leaf)     │        │  Directory (Composite)               │
├──────────────────┤        ├──────────────────────────────────────┤
│ - size : long    │        │ - children : List<FileSystemItem>    │
└──────────────────┘        ├──────────────────────────────────────┤
                            │ + add(item: FileSystemItem)          │
                            │ + remove(item: FileSystemItem)       │
                            └──────────────────┬───────────────────┘
                                               │ HAS-MANY
                                               ▼
                                      FileSystemItem (Recursive!)
```

---

## 4. Step-by-Step Implementation (Java)

### Step 1: The Component Interface

```java
public interface FileSystemItem {
    String getName();
    long getSizeInBytes();
    void printStructure(String indent);
}
```

---

### Step 2: The Leaf (Individual File)

```java
public class File implements FileSystemItem {
    private final String name;
    private final long sizeInBytes;

    public File(String name, long sizeInBytes) {
        this.name = name;
        this.sizeInBytes = sizeInBytes;
    }

    @Override public String getName() { return name; }
    @Override public long getSizeInBytes() { return sizeInBytes; }

    @Override
    public void printStructure(String indent) {
        System.out.println(indent + "📄 " + name + " (" + (sizeInBytes / 1024) + " KB)");
    }
}
```

---

### Step 3: The Composite (Directory Containing Files or Subdirectories)

```java
import java.util.ArrayList;
import java.util.List;

public class Directory implements FileSystemItem {
    private final String name;
    private final List<FileSystemItem> children = new ArrayList<>();

    public Directory(String name) {
        this.name = name;
    }

    public void add(FileSystemItem item) {
        children.add(item);
    }

    public void remove(FileSystemItem item) {
        children.remove(item);
    }

    @Override
    public String getName() { return name; }

    @Override
    public long getSizeInBytes() {
        // Recursive aggregation!
        long totalSize = 0;
        for (FileSystemItem child : children) {
            totalSize += child.getSizeInBytes();
        }
        return totalSize;
    }

    @Override
    public void printStructure(String indent) {
        System.out.println(indent + "📁 " + name + "/ [Total: " + (getSizeInBytes() / 1024) + " KB]");
        for (FileSystemItem child : children) {
            child.printStructure(indent + "   "); // Recursive tree printing
        }
    }
}
```

---

### Step 4: Client Usage (Uniform Treatment!)

```java
public class Main {
    public static void main(String[] args) {
        // Create files (Leaves)
        FileSystemItem resume = new File("resume.pdf", 1024 * 500); // 500 KB
        FileSystemItem indexHtml = new File("index.html", 1024 * 50); // 50 KB
        FileSystemItem logo = new File("logo.png", 1024 * 1500); // 1.5 MB

        // Create nested composites
        Directory assets = new Directory("assets");
        assets.add(logo);

        Directory project = new Directory("my-web-app");
        project.add(indexHtml);
        project.add(assets);

        Directory root = new Directory("Home");
        root.add(resume);
        root.add(project);

        // Uniform invocation on root or any child!
        root.printStructure("");
        System.out.println("\nTotal Storage Used: " + (root.getSizeInBytes() / (1024 * 1024)) + " MB");
    }
}
```

---

## 5. UML Class Diagram & Relationships

```
┌──────────────────────────────────────────────┐
│        <<interface>> FileSystemItem          │
├──────────────────────────────────────────────┤
│ + getSizeInBytes() : long                    │
│ + printStructure(indent: String)             │
└──────────────────────▲───────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │ implements                │ implements
┌────────┴─────────┐        ┌────────┴─────────────────────────────┐
│       File       │        │              Directory               │
├──────────────────┤        ├──────────────────────────────────────┤
│ - sizeInBytes    │        │ - children : List<FileSystemItem>    │
└──────────────────┘        ├──────────────────────────────────────┤
                            │ + add(item: FileSystemItem)          │
                            │ + getSizeInBytes() : long            │
                            └──────────────────┬───────────────────┘
                                               │ HAS-MANY
                                               ▼
                                        FileSystemItem
```

---

## 6. Execution Flow: Recursive Tree Traversal

```
Client calls root.getSizeInBytes()
   │
   ├─► resume.getSizeInBytes() ──► 500 KB
   │
   └─► project.getSizeInBytes()
          │
          ├─► indexHtml.getSizeInBytes() ──► 50 KB
          │
          └─► assets.getSizeInBytes()
                 │
                 └─► logo.getSizeInBytes() ──► 1500 KB
   ▼
Returns total: 2050 KB cleanly!
```

---

## 7. Side-by-Side Comparison: Type Checking vs Composite

| Metric | ❌ Without Composite | ✅ With Composite Pattern |
| :--- | :--- | :--- |
| **Client Code** | Cluttered with `if (obj instanceof Folder)`. | 100% uniform; treat 1 item and 1000 items identically. |
| **Tree Traversal** | Manual loops and casting logic everywhere. | Native recursion built right into composite nodes. |
| **Extensibility** | Adding a new item type (e.g. `Symlink`) breaks all loops. | Just implement `FileSystemItem`. Zero existing code touched! |

---

## 8. When to Use & When NOT to Use

### ✅ When to USE
* You have a tree-structured part-whole hierarchy.
* You want client code to treat individual simple elements and complex compositions identically.
* Examples: UI Component Trees (Divs containing Buttons and Inputs), Organization Charts (Managers managing Employees).

### ❌ When NOT to USE
* When your domain objects don't share a natural tree structure.

---

## 9. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* Simplifies client code through uniform treatment of polymorphic trees.
* **Open/Closed Principle:** Add new element types easily.
* Clean recursive calculation handling.

### 🔴 Disadvantages
* Can make design overly general; hard to restrict what types of children can be added to a composite at compile time.

---

## 10. Real-World Everyday Examples

| Domain | Leaf (Single) | Composite (Group) | Common Operation |
| :--- | :--- | :--- | :--- |
| 🪟 **DOM / UI Trees** | `Button`, `Input` | `Div`, `Form` | `render()`, `draw()` |
| 🏢 **Org Chart** | `IndividualEngineer` | `EngineeringManager`, `Director` | `getSalaryBudget()` |
| 📦 **Packaging / Shipping** | `ProductItem` | `ShippingBox` (contains items + boxes) | `calculateWeight()`, `getCost()` |

---

## 11. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Component Interface} + \text{Leaf} + \text{Composite (List<Component> + delegates recursively)} = \mathbf{Composite\ Pattern}$$
