# 🧠 The Ultimate Guide to Command Pattern (LLD)

> **Core Philosophy:** *Encapsulate a request as an object, thereby letting you parameterize clients with different requests, queue or log requests, and support undoable operations.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [The Core Architecture (The 4 Participants)](#2-the-core-architecture-the-4-participants)
3. [Step-by-Step Implementation (Java)](#3-step-by-step-implementation-java)
4. [UML Class Diagram & Relationships](#4-uml-class-diagram--relationships)
5. [Execution Flow: Undo/Redo Operations](#5-execution-flow-undoredo-operations)
6. [Side-by-Side Comparison: Direct Execution vs Command](#6-side-by-side-comparison-direct-execution-vs-command)
7. [When to Use & When NOT to Use](#7-when-to-use--when-not-to-use)
8. [Pros & Cons Trade-off Analysis](#8-pros--cons-trade-off-analysis)
9. [Real-World Everyday Examples](#9-real-world-everyday-examples)
10. [The Ultimate Checklist & Mental Formula](#10-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: Rich Text Editor with Multi-Level Undo / Redo (Ctrl+Z / Ctrl+Y) 📝
Imagine building a modern text editor (like Google Docs or Notion). Users type text, bold words, cut/paste sections, and expect **Undo / Redo** functionality for every action:

```
                            USER KEYSTROKES
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    ▼                             ▼                             ▼
Type "Hello"                 Bold Selected                 Delete Paragraph
    │                             │                             │
    └─────────────────────────────┼─────────────────────────────┘
                                  ▼
                   How do we reliably Undo / Redo?
```

### The Naive Approach
Hardcoding text manipulation logic directly into UI Buttons (`BoldButton`, `DeleteButton`):
* ❌ **Coupled UI & Logic:** The button class is bloated with document buffer manipulation code.
* ❌ **Impossible Undo History:** To undo a change, you need to store previous state snapshots or know how to reverse that specific action. Without an encapsulated object, maintaining an undo history stack is messy.

---

## 2. The Core Architecture (The 4 Participants)

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│ Invoker (Editor History / Shortcut)  │       │ Receiver (Document Buffer)           │
│ Holds history stack and triggers run │       │ Knows how to actually perform work   │
└──────────────────┬───────────────────┘       └──────────────────▲───────────────────┘
                   │ invokes                                      │ acts upon
                   ▼                                              │
┌──────────────────────────────────────┐                          │
│     <<interface>> Command            │                          │
├──────────────────────────────────────┤                          │
│ + execute()                          │                          │
│ + undo()                             │                          │
└──────────────────▲───────────────────┘                          │
                   │ implements                                   │
┌──────────────────┴──────────────────────────────────────────────┴───────────────────┐
│ Concrete Commands (InsertTextCommand, DeleteTextCommand)                            │
│ Packages the request parameters and calls receiver's methods                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Step-by-Step Implementation (Java)

### Step 1: The Receiver (Actual Business Logic)

```java
public class TextDocument {
    private final StringBuilder content = new StringBuilder();

    public void insert(int position, String text) {
        content.insert(position, text);
    }

    public void delete(int position, int length) {
        content.delete(position, position + length);
    }

    public String read() {
        return content.toString();
    }
}
```

---

### Step 2: The Command Interface

```java
public interface Command {
    void execute();
    void undo();
}
```

---

### Step 3: Concrete Commands

```java
// Insert Text Command
public class InsertTextCommand implements Command {
    private final TextDocument document;
    private final int position;
    private final String insertedText;

    public InsertTextCommand(TextDocument document, int position, String insertedText) {
        this.document = document;
        this.position = position;
        this.insertedText = insertedText;
    }

    @Override
    public void execute() {
        document.insert(position, insertedText);
    }

    @Override
    public void undo() {
        // Reverse operation: Delete what was inserted!
        document.delete(position, insertedText.length());
    }
}
```

---

### Step 4: The Invoker (History Stack Manager)

```java
import java.util.Stack;

public class EditorInvoker {
    private final Stack<Command> undoStack = new Stack<>();
    private final Stack<Command> redoStack = new Stack<>();

    public void executeCommand(Command command) {
        command.execute();
        undoStack.push(command);
        redoStack.clear(); // Clear redo on new action
    }

    public void undo() {
        if (!undoStack.isEmpty()) {
            Command command = undoStack.pop();
            command.undo();
            redoStack.push(command);
            System.out.println("⏪ Action Undone!");
        } else {
            System.out.println("⚠️ Nothing to undo.");
        }
    }

    public void redo() {
        if (!redoStack.isEmpty()) {
            Command command = redoStack.pop();
            command.execute();
            undoStack.push(command);
            System.out.println("⏩ Action Redone!");
        } else {
            System.out.println("⚠️ Nothing to redo.");
        }
    }
}
```

---

### Step 5: Client Usage

```java
public class Main {
    public static void main(String[] args) {
        TextDocument doc = new TextDocument();
        EditorInvoker invoker = new EditorInvoker();

        // Type "Hello "
        invoker.executeCommand(new InsertTextCommand(doc, 0, "Hello "));
        System.out.println("Document: " + doc.read());

        // Type "World!"
        invoker.executeCommand(new InsertTextCommand(doc, 6, "World!"));
        System.out.println("Document: " + doc.read());

        // User hits Ctrl+Z (Undo)
        invoker.undo();
        System.out.println("Document after Undo: " + doc.read());

        // User hits Ctrl+Y (Redo)
        invoker.redo();
        System.out.println("Document after Redo: " + doc.read());
    }
}
```

---

## 4. UML Class Diagram & Relationships

```
┌──────────────────────────────────────────────┐
│                 EditorInvoker                │
├──────────────────────────────────────────────┤
│ - undoStack : Stack<Command>                 │
│ - redoStack : Stack<Command>                 │
├──────────────────────────────────────────────┤
│ + executeCommand(cmd: Command)               │
│ + undo()                                     │
│ + redo()                                     │
└──────────────────────┬───────────────────────┘
                       │ HAS-A
                       ▼
┌──────────────────────────────────────────────┐
│             <<interface>> Command            │
├──────────────────────────────────────────────┤
│ + execute()                                  │
│ + undo()                                     │
└──────────────────────▲───────────────────────┘
                       │ implements
┌──────────────────────┴───────────────────────┐
│              InsertTextCommand               │
├──────────────────────────────────────────────┤
│ - document : TextDocument                    │
│ - position : int                             │
│ - text : String                              │
├──────────────────────────────────────────────┤
│ + execute()                                  │
│ + undo()                                     │
└──────────────────────┬───────────────────────┘
                       │ delegates to
                       ▼
┌──────────────────────────────────────────────┐
│                  TextDocument                │
├──────────────────────────────────────────────┤
│ + insert(pos: int, str: String)              │
│ + delete(pos: int, len: int)                 │
└──────────────────────────────────────────────┘
```

---

## 5. Execution Flow: Undo/Redo Operations

```
1. Client creates InsertTextCommand("World!")
2. Invoker executes command ──► updates document text
3. Invoker pushes command onto UndoStack
4. Client calls invoker.undo()
   └─► Pops command from UndoStack
   └─► Calls command.undo() (reverses change)
   └─► Pushes command onto RedoStack
```

---

## 6. Side-by-Side Comparison: Direct Execution vs Command

| Metric | ❌ Direct Method Invocation | ✅ Command Pattern |
| :--- | :--- | :--- |
| **Undo/Redo** | Nearly impossible without snapshotting whole RAM. | Native; each command encapsulates its own inverse operation. |
| **Queueing / Scheduling**| Cannot store calls in databases or message queues. | Commands are self-contained objects that can be serialized. |
| **Decoupling** | UI button hardcoded to concrete backend methods. | UI button triggers generic `command.execute()`. |

---

## 7. When to Use & When NOT to Use

### ✅ When to USE
* You want to parameterize UI objects with operations (e.g. menu items, toolbar buttons, hotkeys).
* You want to queue operations, schedule their execution, or execute them remotely.
* You need to support reversible operations (**Undo / Redo**).

### ❌ When NOT to USE
* Simple CRUD operations where requests never need history, queueing, or reversibility.

---

## 8. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* **Single Responsibility Principle:** Classes invoking operations are decoupled from classes performing them.
* **Open/Closed Principle:** Introduce new commands without breaking existing code.
* Easy implementation of multi-level Undo and Redo.

### 🔴 Disadvantages
* Increases number of classes since every single action requires its own command class.

---

## 9. Real-World Everyday Examples

| Domain | Receiver | Command Object | Invoker |
| :--- | :--- | :--- | :--- |
| 🪟 **GUI Desktop Apps** | `Clipboard` | `CopyCommand`, `PasteCommand` | `MenuItem`, `KeyboardShortcut` |
| 🎮 **Game Input** | `PlayerCharacter` | `JumpCommand`, `FireWeaponCommand` | Game Controller buttons |
| 🏦 **Banking Transactions**| `BankAccount` | `DepositCommand`, `TransferFundsCommand`| Transaction Queue |

---

## 10. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Receiver (Worker)} + \text{Command (execute + undo)} + \text{Invoker (History Stack)} = \mathbf{Command\ Pattern}$$
