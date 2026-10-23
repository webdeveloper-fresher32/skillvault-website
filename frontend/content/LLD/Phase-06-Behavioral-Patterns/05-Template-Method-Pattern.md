# 🧠 The Ultimate Guide to Template Method Pattern (LLD)

> **Core Philosophy:** *Define the skeleton of an algorithm in an operation, deferring some steps to subclasses. Template Method lets subclasses redefine certain steps of an algorithm without changing the algorithm's structure.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [The Hollywood Principle: "Don't Call Us, We'll Call You"](#2-the-hollywood-principle-dont-call-us-well-call-you)
3. [The Core Architecture (Abstract Class & Subclasses)](#3-the-core-architecture-abstract-class--subclasses)
4. [Step-by-Step Implementation (Java)](#4-step-by-step-implementation-java)
5. [UML Class Diagram & Relationships](#5-uml-class-diagram--relationships)
6. [Execution Flow: The Fixed Pipeline](#6-execution-flow-the-fixed-pipeline)
7. [Side-by-Side Comparison: Code Duplication vs Template Method](#7-side-by-side-comparison-code-duplication-vs-template-method)
8. [When to Use & When NOT to Use](#8-when-to-use--when-not-to-use)
9. [Pros & Cons Trade-off Analysis](#9-pros--cons-trade-off-analysis)
10. [Real-World Everyday Examples](#10-real-world-everyday-examples)
11. [The Ultimate Checklist & Mental Formula](#11-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: Automated CI/CD Build & Deployment Pipeline 🚀 🛠️
Imagine building an automated CI/CD DevOps engine (like GitHub Actions or Jenkins). Every software build pipeline strictly follows the **exact same invariant algorithm steps**:
1. Checkout source code from Git
2. Run automated unit tests
3. Compile / Package binary artifact
4. Deploy to target environment

However, **Java builds** (`mvn clean package`) compile bytecode differently from **Node.js builds** (`npm run build`) or **Docker microservice builds** (`docker build -t app .`):

```
                        INVARIANT CI/CD PIPELINE SKELETON
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
      Java Pipeline              Node.js Pipeline             Docker Pipeline
   • Git Checkout (Common)     • Git Checkout (Common)      • Git Checkout (Common)
   • JUnit Tests               • Jest Tests                 • Container Smoke Tests
   • Maven Package (.jar)      • Webpack Bundle (.js)       • Docker Image Build
   • Deploy to K8s             • Deploy to Vercel           • Deploy to AWS ECS
```

### The Duplication Antipattern
Without Template Method, developers copy-paste the entire multi-step orchestrator loop across 10 different builder classes. If someone introduces a security audit step, they have to manually update 10 different classes!

---

## 2. The Hollywood Principle: "Don't Call Us, We'll Call You"

In traditional programming, client code calls library methods.
In the **Template Method Pattern**, the **base class algorithm calls the subclass methods** when it needs them! The high-level pipeline dictates the execution flow.

---

## 3. The Core Architecture (Abstract Class & Subclasses)

```
┌─────────────────────────────────────────────────────────────┐
│ AbstractBuilder (Base Algorithm Skeleton)                   │
├─────────────────────────────────────────────────────────────┤
│ + buildPipeline() : final (CANNOT be overridden!)           │
│   ├── 1. checkoutCode() [Concrete base step]                │
│   ├── 2. runTests()     [Abstract step]                     │
│   ├── 3. packageCode()  [Abstract step]                     │
│   └── 4. deploy()       [Abstract step / Hook]              │
└──────────────────────────────▲──────────────────────────────┘
                               │ extends
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
┌──────────────────┐                        ┌──────────────────┐
│   JavaBuilder    │                        │  NodeJsBuilder   │
├──────────────────┤                        ├──────────────────┤
│ + runTests()     │                        │ + runTests()     │
│ + packageCode()  │                        │ + packageCode()  │
│ + deploy()       │                        │ + deploy()       │
└──────────────────┘                        └──────────────────┘
```

---

## 4. Step-by-Step Implementation (Java)

### Step 1: The Base Abstract Class with `final` Template Method

```java
public abstract class CicdPipeline {

    // THE TEMPLATE METHOD: Marked final so subclasses cannot break the invariant flow!
    public final void runPipeline() {
        checkoutCode();
        runTests();
        packageArtifact();
        deploy();
        sendSuccessNotification();
    }

    // Step 1: Invariant shared step
    private void checkoutCode() {
        System.out.println("📦 [Step 1] Pulling latest git commit from repository...");
    }

    // Step 2 & 3: Primitive operations deferred to subclasses
    protected abstract void runTests();
    protected abstract void packageArtifact();
    protected abstract void deploy();

    // Step 5: Optional hook or common step
    protected void sendSuccessNotification() {
        System.out.println("✅ [Step 5] Pipeline succeeded! Slack alert posted to #devops\n");
    }
}
```

---

### Step 2: Concrete Implementation for Java Microservice

```java
public class JavaMavenPipeline extends CicdPipeline {
    @Override
    protected void runTests() {
        System.out.println("🧪 [Step 2] Executing JUnit 5 tests via Maven Surefire...");
    }

    @Override
    protected void packageArtifact() {
        System.out.println("🔨 [Step 3] Compiling bytecode & building fat JAR: 'target/service.jar'...");
    }

    @Override
    protected void deploy() {
        System.out.println("🚀 [Step 4] Deploying JAR to Kubernetes cluster via Helm...");
    }
}
```

---

### Step 3: Concrete Implementation for Frontend React/Node.js App

```java
public class NodeJsPipeline extends CicdPipeline {
    @Override
    protected void runTests() {
        System.out.println("🧪 [Step 2] Running Jest tests & ESLint checks...");
    }

    @Override
    protected void packageArtifact() {
        System.out.println("🔨 [Step 3] Running Webpack/Vite production minification...");
    }

    @Override
    protected void deploy() {
        System.out.println("🚀 [Step 4] Pushing static assets to Cloudflare Pages CDN...");
    }
}
```

---

### Step 4: Client Usage

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("=== RUNNING JAVA PIPELINE ===");
        CicdPipeline javaPipeline = new JavaMavenPipeline();
        javaPipeline.runPipeline();

        System.out.println("=== RUNNING FRONTEND PIPELINE ===");
        CicdPipeline frontendPipeline = new NodeJsPipeline();
        frontendPipeline.runPipeline();
    }
}
```

---

## 5. UML Class Diagram & Relationships

```
┌──────────────────────────────────────────────┐
│           <<abstract>> CicdPipeline          │
├──────────────────────────────────────────────┤
│ + runPipeline() : final                      │◄── Template Method (Fixed Skeleton)
│ - checkoutCode()                             │
│ # runTests() : abstract                      │
│ # packageArtifact() : abstract               │
│ # deploy() : abstract                        │
│ # sendSuccessNotification()                  │
└──────────────────────▲───────────────────────┘
                       │ extends
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌───────────────────────┐   ┌───────────────────────┐
│   JavaMavenPipeline   │   │     NodeJsPipeline    │
├───────────────────────┤   ├───────────────────────┤
│ + runTests()          │   │ + runTests()          │
│ + packageArtifact()   │   │ + packageArtifact()   │
│ + deploy()            │   │ + deploy()            │
└───────────────────────┘   └───────────────────────┘
```

---

## 6. Execution Flow: The Fixed Pipeline

```
Client calls pipeline.runPipeline()
   │
   ├─► 1. Base class executes checkoutCode()
   │
   ├─► 2. Base class calls this.runTests()
   │      └─► Subclass executes JavaMavenPipeline.runTests()
   │
   ├─► 3. Base class calls this.packageArtifact()
   │      └─► Subclass executes JavaMavenPipeline.packageArtifact()
   │
   ├─► 4. Base class calls this.deploy()
   │      └─► Subclass executes JavaMavenPipeline.deploy()
   │
   └─► 5. Base class executes sendSuccessNotification()
```

---

## 7. Side-by-Side Comparison: Code Duplication vs Template Method

| Metric | ❌ Copy-Pasting Algorithm | ✅ Template Method Pattern |
| :--- | :--- | :--- |
| **Pipeline Invariance** | Anyone can accidentally skip unit tests. | `final` template method strictly enforces tests run before deploy. |
| **Code Duplication** | High; git checkout and logging duplicated everywhere. | Zero; shared steps live once in the base class. |
| **Maintenance** | Adding security check requires editing 10 classes. | Edit the base class once; instantly updates all pipelines! |

---

## 8. When to Use & When NOT to Use

### ✅ When to USE
* You have an invariant multi-step algorithm where only specific individual steps vary between implementations.
* When you want to let clients extend only particular steps of an algorithm, but not the algorithm itself or its structure.
* Standard frameworks: Web frameworks (request lifecycle), Data parsing pipelines (ETL).

### ❌ When NOT to USE
* When the steps themselves or their execution order change drastically between implementations (use **Strategy Pattern** instead).

---

## 9. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* Eliminates boilerplate and code duplication.
* Lets subclasses override only certain parts of a large algorithm.
* Enforces structural integrity of mission-critical processes.

### 🔴 Disadvantages
* Subclasses might violate the *Liskov Substitution Principle* by changing expected step semantics.
* Maintenance can become difficult if the template method grows too many steps.

---

## 10. Real-World Everyday Examples

| Domain | Algorithm Skeleton (Template) | Steps Customized by Subclasses |
| :--- | :--- | :--- |
| 📊 **Data Mining (ETL)** | `readData() ──► process() ──► writeReport()` | `CsvParser`, `JsonParser`, `XmlParser` |
| 🌐 **Java Servlets** | `HttpServlet.service()` | `doGet()`, `doPost()`, `doDelete()` |
| 🎮 **Turn-Based Game** | `start() ──► takeTurn() ──► checkGameOver()` | `ChessGame`, `CheckersGame` |

---

## 11. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Abstract Base Class} + \text{final Invariant Skeleton Method} + \text{Abstract Step Hooks} = \mathbf{Template\ Method\ Pattern}$$
