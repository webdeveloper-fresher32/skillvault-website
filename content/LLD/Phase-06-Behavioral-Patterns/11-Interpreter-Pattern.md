# 🧠 The Ultimate Guide to Interpreter Pattern (LLD)

> **Core Philosophy:** *Given a language, define a representation for its grammar along with an interpreter that uses the representation to interpret sentences in the language.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [Terminal vs Non-Terminal Expressions (Grammar Trees)](#2-terminal-vs-non-terminal-expressions-grammar-trees)
3. [The Core Architecture (The 4 Participants)](#3-the-core-architecture-the-4-participants)
4. [Step-by-Step Implementation (Java)](#4-step-by-step-implementation-java)
5. [UML Class Diagram & Relationships](#5-uml-class-diagram--relationships)
6. [Execution Flow: Recursive Abstract Syntax Tree Evaluation](#6-execution-flow-recursive-abstract-syntax-tree-evaluation)
7. [Side-by-Side Comparison: Regex/Regex String Parsing vs AST Interpreter](#7-side-by-side-comparison-regexregex-string-parsing-vs-ast-interpreter)
8. [When to Use & When NOT to Use](#8-when-to-use--when-not-to-use)
9. [Pros & Cons Trade-off Analysis](#9-pros--cons-trade-off-analysis)
10. [Real-World Everyday Examples](#10-real-world-everyday-examples)
11. [The Ultimate Checklist & Mental Formula](#11-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: Dynamic SQL-like / Filter Rule Engine for FinTech Fraud Detection 💳 🔍
Imagine building a rule engine for a fraud prevention platform (like Stripe Radar or PayPal). Risk analysts need to write dynamic boolean rule expressions like:
$$\text{"(amount > 10000 AND isForeignTransaction) OR isCardStolen"}$$

```
                                  RULE EXPRESSION
            "(amount > 10000 AND isForeignTransaction) OR isCardStolen"
                                         │
                                         ▼
                                   [ OR Expression ]
                                    ╱             ╲
                                   ╱               ╲
                         [ AND Expression ]     [ Terminal: isCardStolen ]
                          ╱              ╲
                         ╱                ╲
             [ amount > 10000 ]    [ isForeignTransaction ]
```

### The String Parsing Antipattern
Writing complex nested string manipulation, loops, and regexes to parse conditions:
* ❌ Fragile and breaks when parentheses or conditions get nested.
* ❌ Hard to extend with new keywords (`NOT`, `IN`, `BETWEEN`).

---

## 2. Terminal vs Non-Terminal Expressions (Grammar Trees)

* **Terminal Expression:** The leaf nodes that do not contain sub-expressions. They evaluate directly against the context (e.g. `Number(5)`, `Variable("isForeign")`).
* **Non-Terminal Expression:** Branch nodes that combine other expressions according to grammar rules (e.g. `AndExpression(left, right)`, `OrExpression(left, right)`).

---

## 3. The Core Architecture (The 4 Participants)

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│ Context (TransactionContext)         │       │ <<interface>> BooleanExpression      │
│ Holds input variables and data       │       ├──────────────────────────────────────┤
│ (amount=15000, isForeign=true)       │       │ + interpret(c: Context) : boolean    │
└──────────────────────────────────────┘       └──────────────────▲───────────────────┘
                                                                  │ implements
                                 ┌────────────────────────────────┴────────────────────────────────┐
                                 ▼                                                                 ▼
┌──────────────────────────────────────────────┐                  ┌──────────────────────────────────────────────┐
│ TerminalExpression (ContainsPropertyCheck)   │                  │ NonTerminalExpression (AndExpression)        │
├──────────────────────────────────────────────┤                  ├──────────────────────────────────────────────┤
│ + interpret(context) : boolean               │                  │ - expr1 : BooleanExpression                  │
└──────────────────────────────────────────────┘                  │ - expr2 : BooleanExpression                  │
                                                                  ├──────────────────────────────────────────────┤
                                                                  │ + interpret(context) : boolean               │
                                                                  └──────────────────────────────────────────────┘
```

---

## 4. Step-by-Step Implementation (Java)

### Step 1: The Context (Data Environment)

```java
import java.util.HashMap;
import java.util.Map;

public class TransactionContext {
    private final Map<String, Object> data = new HashMap<>();

    public void set(String key, Object value) {
        data.put(key, value);
    }

    public Object get(String key) {
        return data.get(key);
    }
}
```

---

### Step 2: The Abstract Expression Interface

```java
public interface Expression {
    boolean interpret(TransactionContext context);
}
```

---

### Step 3: Terminal Expressions (Leaves)

#### 1. Terminal Check: Boolean Flag
```java
public class BooleanVariableExpression implements Expression {
    private final String key;

    public BooleanVariableExpression(String key) {
        this.key = key;
    }

    @Override
    public boolean interpret(TransactionContext context) {
        Object val = context.get(key);
        return val instanceof Boolean && (Boolean) val;
    }
}
```

#### 2. Terminal Check: Greater Than Comparison
```java
public class GreaterThanExpression implements Expression {
    private final String key;
    private final double threshold;

    public GreaterThanExpression(String key, double threshold) {
        this.key = key;
        this.threshold = threshold;
    }

    @Override
    public boolean interpret(TransactionContext context) {
        Object val = context.get(key);
        if (val instanceof Number) {
            return ((Number) val).doubleValue() > threshold;
        }
        return false;
    }
}
```

---

### Step 4: Non-Terminal Expressions (Operators)

#### 1. AND Expression
```java
public class AndExpression implements Expression {
    private final Expression expr1;
    private final Expression expr2;

    public AndExpression(Expression expr1, Expression expr2) {
        this.expr1 = expr1;
        this.expr2 = expr2;
    }

    @Override
    public boolean interpret(TransactionContext context) {
        return expr1.interpret(context) && expr2.interpret(context);
    }
}
```

#### 2. OR Expression
```java
public class OrExpression implements Expression {
    private final Expression expr1;
    private final Expression expr2;

    public OrExpression(Expression expr1, Expression expr2) {
        this.expr1 = expr1;
        this.expr2 = expr2;
    }

    @Override
    public boolean interpret(TransactionContext context) {
        return expr1.interpret(context) || expr2.interpret(context);
    }
}
```

---

### Step 5: Client Usage (Building the Grammar Tree & Evaluating)

```java
public class Main {
    public static void main(String[] args) {
        // Grammar Rule: (amount > 10000 AND isForeign) OR isCardStolen
        Expression amountCheck = new GreaterThanExpression("amount", 10000);
        Expression foreignCheck = new BooleanVariableExpression("isForeign");
        Expression stolenCheck = new BooleanVariableExpression("isCardStolen");

        // Compose the AST Tree
        Expression andCondition = new AndExpression(amountCheck, foreignCheck);
        Expression fraudRule = new OrExpression(andCondition, stolenCheck);

        // Scenario 1: Normal transaction ($5,000 domestic)
        TransactionContext tx1 = new TransactionContext();
        tx1.set("amount", 5000.0);
        tx1.set("isForeign", false);
        tx1.set("isCardStolen", false);
        System.out.println("Tx1 Flagged as Fraud? " + fraudRule.interpret(tx1)); // false

        // Scenario 2: High value international ($15,000 foreign)
        TransactionContext tx2 = new TransactionContext();
        tx2.set("amount", 15000.0);
        tx2.set("isForeign", true);
        tx2.set("isCardStolen", false);
        System.out.println("Tx2 Flagged as Fraud? " + fraudRule.interpret(tx2)); // true!

        // Scenario 3: Stolen card purchase ($20)
        TransactionContext tx3 = new TransactionContext();
        tx3.set("amount", 20.0);
        tx3.set("isForeign", false);
        tx3.set("isCardStolen", true);
        System.out.println("Tx3 Flagged as Fraud? " + fraudRule.interpret(tx3)); // true!
    }
}
```

---

## 5. UML Class Diagram & Relationships

```
┌──────────────────────────────────────────────┐
│           <<interface>> Expression           │
├──────────────────────────────────────────────┤
│ + interpret(context: TransactionContext):bool│
└──────────────────────▲───────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │ implements                │ implements
┌────────┴──────────────┐   ┌────────┴─────────────────────────────┐
│ GreaterThanExpression │   │             AndExpression            │
├───────────────────────┤   ├──────────────────────────────────────┤
│ - key : String        │   │ - expr1 : Expression                 │
│ - threshold : double  │   │ - expr2 : Expression                 │
└───────────────────────┘   ├──────────────────────────────────────┤
                            │ + interpret(context)                 │
                            └──────────────────┬───────────────────┘
                                               │ HAS-A (Recursive)
                                               ▼
                                           Expression
```

---

## 6. Execution Flow: Recursive Abstract Syntax Tree Evaluation

```
Client calls fraudRule.interpret(tx2) [OrExpression]
   │
   ├─► Left Branch: andCondition.interpret(tx2)
   │      │
   │      ├─► amountCheck.interpret(tx2) ──► 15000 > 10000 = TRUE
   │      │
   │      └─► foreignCheck.interpret(tx2) ──► isForeign = TRUE
   │      │
   │      └─► TRUE && TRUE = TRUE
   │
   └─► Short-circuit OR returns TRUE! (Fraud detected!)
```

---

## 7. Side-by-Side Comparison: Regex/Regex String Parsing vs AST Interpreter

| Metric | ❌ Regex / String Splitting | ✅ Interpreter Pattern (AST) |
| :--- | :--- | :--- |
| **Nesting Support** | Fails with nested parentheses and tree hierarchies. | Seamless recursion handles infinite nested levels. |
| **Extensibility** | Adding `NOT` or `LIKE` requires editing complex regexes.| Just add `NotExpression` class. Clean OCP! |
| **Readability** | Massive regex strings are unreadable. | Clear, typed object hierarchy. |

---

## 8. When to Use & When NOT to Use

### ✅ When to USE
* When you have a simple language or grammar that can be represented as an Abstract Syntax Tree (AST).
* Creating dynamic domain-specific rule engines (e.g. search filters, custom math formulas, boolean expressions).

### ❌ When NOT to USE
* When the grammar is complex with thousands of rules (e.g. parsing full C++ or Python; use tools like ANTLR or Lex/Yacc instead).

---

## 9. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* Easy to change and extend the grammar by adding new expression classes.
* Implementing the grammar is straightforward because classes map directly to grammar rules.

### 🔴 Disadvantages
* Complex grammars produce massive, hard-to-maintain class hierarchies.
* Slower evaluation compared to compiled bytecode.

---

## 10. Real-World Everyday Examples

| Domain | Grammar / Domain Language | Terminal / Non-Terminal |
| :--- | :--- | :--- |
| 🔍 **Search Engines** | `"apple AND (iphone OR ipad)"` | Words (Terminal), AND/OR (Non-Terminal) |
| 🧮 **Calculators** | `"3 + 5 * (2 - 1)"` | Numbers (Terminal), Operators (+, -, *) |
| 📜 **Regex Matchers** | `"[A-Z]+[0-9]*"` | Char classes (Terminal), Quantifiers (*, +) |

---

## 11. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Expression Interface} + \text{Terminal Leaves (Values)} + \text{Non-Terminal Nodes (Operators)} + \text{Context} = \mathbf{Interpreter\ Pattern}$$
