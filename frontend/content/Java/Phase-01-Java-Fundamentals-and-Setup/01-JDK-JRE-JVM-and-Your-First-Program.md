# 01 — JDK, JRE, JVM, and Your First Program

> A comprehensive reference covering why Java code runs identically across operating systems, what the JDK, JRE, and JVM each actually are, and how to compile and run your very first Java program from the command line.

---

## Table of Contents

1. [The Problem: One Program, Many Machines](#1-the-problem-one-program-many-machines)
2. [The Analogy: A Play Translated for Every Audience](#2-the-analogy-a-play-translated-for-every-audience)
3. [JDK, JRE, and JVM: What Each Actually Contains](#3-jdk-jre-and-jvm-what-each-actually-contains)
4. [Your First Program: From Source to Output](#4-your-first-program-from-source-to-output)
5. [JDK vs JRE vs JVM at a Glance](#5-jdk-vs-jre-vs-jvm-at-a-glance)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: One Program, Many Machines

Imagine you write a program on a MacBook, and a colleague needs to run the exact same program on a Windows laptop, while it also needs to run unmodified on a Linux server in a data center. Those three machines have completely different processors, instruction sets, and operating systems. A program compiled directly to native machine code for macOS won't run on Windows at all — the underlying CPU instructions and OS-level calls simply don't match up.

Most compiled languages solve this by requiring you to recompile your source code separately for every target platform. Java's core promise — famously summarized as **"write once, run anywhere"** — is that you compile *once*, and the same compiled output runs unmodified on any machine that has a compatible Java installation, regardless of its OS or hardware. The problem this chapter answers: **how does identical compiled code actually behave identically across completely different machines?**

---

## 2. The Analogy: A Play Translated for Every Audience

**Real-world analogy:** imagine a play script written once, in a single neutral form, that needs to be performed for audiences who each speak a different language — English, French, Japanese. Instead of rewriting the entire script for every audience, you hire a skilled interpreter who stands on stage with each performance and translates the neutral script into whatever language that particular audience actually understands, live, as the play unfolds.

**The script is your compiled `.class` bytecode. The interpreter is the JVM.** You write and compile your Java source exactly once, producing bytecode that isn't tied to any specific machine. Every machine that wants to run it just needs its own interpreter — a JVM build for that specific OS and CPU — which reads the same universal bytecode and translates it into whatever native instructions *that* machine actually understands. The script never changes; only the interpreter standing between the script and the audience does.

---

## 3. JDK, JRE, and JVM: What Each Actually Contains

These three acronyms are introduced together so often that beginners frequently can't explain how they differ. Each one is a strictly larger box containing the previous one:

- **JVM (Java Virtual Machine)** — the actual engine that executes bytecode. It loads `.class` files, verifies them, and either interprets the bytecode instruction-by-instruction or compiles "hot" (frequently executed) sections into native machine code on the fly via the **JIT (Just-In-Time) compiler** for speed (Phase 9 covers this in depth). The JVM is platform-specific under the hood — there's a different JVM build for Windows, macOS, and Linux — but it exposes the exact same bytecode-execution behavior on all of them.
- **JRE (Java Runtime Environment)** — everything needed to *run* an already-compiled Java program: the JVM itself, plus the standard library classes (`java.lang`, `java.util`, and so on) that compiled programs call into at runtime. If you only ever run Java applications and never compile Java source yourself, a JRE alone used to be sufficient (modern JDK distributions bundle both together, so a standalone JRE-only install is rarely offered separately anymore).
- **JDK (Java Development Kit)** — everything needed to *develop* Java software: the full JRE, plus development tools — most importantly `javac`, the Java compiler that turns your `.java` source files into `.class` bytecode files. If you intend to write or compile Java code at all, you need the JDK, not just a JRE.

The end-to-end flow looks like this:

```
YourProgram.java  --(javac compiles)-->  YourProgram.class (bytecode)
                                               |
                                               v
                                   java launches the JVM,
                                   which loads and executes
                                   that bytecode on this machine
```

You write `.java` source once. `javac` (part of the JDK) compiles it into `.class` bytecode — a format no specific CPU understands natively, but every JVM understands identically. Running `java YourProgram` starts a JVM instance, which loads that bytecode and executes it, translating it into whatever this particular machine's CPU actually needs, on the fly.

---

## 4. Your First Program: From Source to Output

Here is the smallest complete Java program that prints text to the console:

```java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
```

Every keyword here does real work:

- **`public`** (on the class) — this class is visible/accessible from outside its own package (Phase 2 covers access modifiers in depth). A `public` top-level class must live in a file whose name exactly matches the class name.
- **`class HelloWorld`** — declares a class named `HelloWorld`. In Java, essentially all code lives inside a class; there's no such thing as a loose top-level function.
- **`public static void main(String[] args)`** — this exact method signature is the required entry point the JVM looks for when you run a class directly:
  - `public` — the JVM (from outside this class) must be able to call it.
  - `static` — the method belongs to the class itself, not to any particular object instance; the JVM calls it without first constructing a `HelloWorld` object (Phase 2 covers static vs. instance context).
  - `void` — the method returns no value.
  - `main` — the specific method name the JVM looks for as the starting point.
  - `String[] args` — an array of command-line arguments passed in when the program is launched; empty if none were supplied.
- **`System.out.println("Hello, Java!")`** — calls the `println` method on `System.out` (a pre-existing `PrintStream` object representing standard output), printing the given text followed by a newline.

To actually run this, save the file as exactly `HelloWorld.java`, then from a terminal in that directory:

```bash
javac HelloWorld.java
java HelloWorld
```

The first command compiles the source into `HelloWorld.class` (you won't see console output from a successful compile — no output means it worked). The second command launches the JVM, which loads `HelloWorld.class` and calls its `main` method. The exact printed output is:

```
Hello, Java!
```

---

## 5. JDK vs JRE vs JVM at a Glance

| | **JVM** | **JRE** | **JDK** |
|---|---|---|---|
| **Contains** | The bytecode-execution engine only (interpreter + JIT compiler) | JVM + standard library classes | Full JRE + development tools (`javac`, debugger, etc.) |
| **Can you compile `.java` files?** | No | No | Yes |
| **Can you run `.class` files?** | Yes (it's what actually executes them) | Yes | Yes (bundles a JRE) |
| **Who needs it** | Conceptually the core of both JRE and JDK | End users who only run Java apps | Developers writing/compiling Java code |
| **Platform-specific?** | Yes — a different build per OS/CPU | Yes (bundles a platform-specific JVM) | Yes (bundles a platform-specific JRE) |

---

## 6. Common Mistakes
- Forgetting that a `public` top-level class's name must **exactly** match its filename (case-sensitive) — `public class HelloWorld` must live in a file named `HelloWorld.java`, or `javac` fails to compile it.
- Writing the entry-point method with any deviation from the required exact signature — `public static void main(String[] args)` — such as forgetting `static`, misspelling `main`, or using a different parameter type; the JVM won't recognize it as a valid entry point and will refuse to run the class directly.

**Interview angle:** "What's the difference between the JDK, JRE, and JVM?" is one of the most common Java warm-up questions. Interviewers are checking that you understand the containment relationship (JDK ⊇ JRE ⊇ JVM) and specifically that you know `javac` — the compiler — is a JDK-only tool, not something the JRE or JVM alone provide. A strong answer also mentions that the JVM is what makes Java's "write once, run anywhere" promise possible, since it's the platform-specific piece that lets identical bytecode run correctly everywhere.

---

## 7. Hands-On Exercises

### Exercise 1 — Compile and run `HelloWorld` yourself

Type out the `HelloWorld` program from this lesson exactly as shown, save it as `HelloWorld.java`, and run `javac HelloWorld.java` followed by `java HelloWorld` from your terminal. Confirm you see `Hello, Java!` printed.

### Exercise 2 — Break it on purpose

Rename the file to `Hello.java` without changing the class name inside it, and try to compile it. Read the exact compiler error message `javac` produces, and explain in your own words why it happens.

### Exercise 3 — Inspect the bytecode file

After compiling `HelloWorld.java` successfully, look at the directory listing (`ls` or `dir`). Note that a new `HelloWorld.class` file now exists alongside your `.java` file. Try opening it in a plain text editor and observe that it's not human-readable — it's bytecode, not source code or plain text.

---

## 8. Interview Q&A

### Q1. What is the JVM, and why does Java need one?

**Answer:** The JVM (Java Virtual Machine) is the engine that actually executes compiled Java bytecode. It's platform-specific under the hood (a different build per OS/CPU) but presents identical execution behavior everywhere, which is what lets the same compiled `.class` file run unmodified on any machine that has a compatible JVM.

### Q2. What's the difference between the JDK and the JRE?

**Answer:** The JRE (Java Runtime Environment) contains everything needed to *run* already-compiled Java programs — the JVM plus the standard library. The JDK (Java Development Kit) contains a full JRE plus development tools, most importantly `javac`, the compiler. You need the JDK to write and compile Java code; the JRE alone is only enough to run it.

### Q3. What happens when you run `javac HelloWorld.java`?

**Answer:** `javac` compiles the Java source file into a `.class` file containing platform-independent bytecode. It doesn't run the program — it only translates human-readable source into the bytecode format the JVM knows how to execute.

### Q4. Why must the public class name match the filename?

**Answer:** The Java compiler enforces this so that the compiler and the JVM's class loader can always find the file containing a given public class by name alone, without scanning file contents — `HelloWorld.java` must contain `public class HelloWorld`, or `javac` reports a compile error.

### Q5. What is the required signature for a Java program's entry point, and why does each keyword matter?

**Answer:** `public static void main(String[] args)` — `public` so the JVM can call it from outside the class, `static` so it can be invoked without creating an instance of the class first, `void` because it returns nothing, `main` as the exact name the JVM looks for, and `String[] args` to receive command-line arguments. Deviating from this exact signature means the JVM won't recognize it as a runnable entry point.

---

> 🧠 **Memory hook:** "The script (bytecode) never changes — only the interpreter (JVM) standing between it and the machine does."
