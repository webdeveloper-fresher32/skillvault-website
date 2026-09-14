# Compiled vs Interpreted Languages — Complete Guide

## Table of Contents
1. [The Core Distinction](#1-the-core-distinction)
2. [Compiled Languages](#2-compiled-languages)
3. [Interpreted Languages](#3-interpreted-languages)
4. [Hybrid Languages (Bytecode + JIT)](#4-hybrid-languages-bytecode--jit)
5. [Comparison Table](#5-comparison-table)
6. [Which Category Does "Interpreted" Python/JS Really Belong To?](#6-which-category-does-interpreted-pythonjs-really-belong-to)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Core Distinction

The difference between "compiled" and "interpreted" is really about **when** and **how** source code gets turned into something the CPU can execute.

```
COMPILED:
  source code ──(compiler, ahead of time)──▶ native machine code ──▶ CPU runs it directly

INTERPRETED:
  source code ──(interpreter, at run time)──▶ interpreter reads it line-by-line and
                                                executes the corresponding behavior itself

HYBRID (bytecode + JIT):
  source code ──(compiler, ahead of time)──▶ bytecode ──(VM, at run time)──▶
                    interpreted OR JIT-compiled to native machine code, on the fly
```

In practice, almost no modern language is "purely" one or the other — the labels describe the *dominant* strategy, not an absolute rule.

---

## 2. Compiled Languages

**Examples:** C, C++, Go, Rust.

A compiler translates the entire program to native machine code **ahead of time**, producing an executable binary specific to a CPU architecture and OS (e.g., an x86-64 Linux ELF binary). Running the program means the OS loads that binary and the CPU executes it directly — there is no translation step at runtime.

```
$ gcc main.c -o main       # compile once, ahead of time
$ ./main                   # run: CPU executes native instructions directly, no translation
```

**Trade-offs:**
- Fast execution — no runtime translation overhead, the CPU runs real machine instructions.
- Slower "edit-compile-run" iteration loop — every code change requires a full recompile.
- The binary is tied to a specific OS/CPU architecture — a Linux x86-64 binary won't run on macOS ARM without recompiling (or cross-compiling) for that target.

---

## 3. Interpreted Languages

**Examples (in their simplest form):** shell scripts (bash), classic Perl one-liners, a naive tree-walking Python implementation.

A pure interpreter reads source code (or a lightly parsed form of it) and executes it directly, statement by statement, translating and running in the same step, every single time the program runs.

```
$ bash script.sh
  interpreter reads line 1, executes it
  interpreter reads line 2, executes it
  ... (repeated every single run, every single time through a loop)
```

**Trade-offs:**
- Fast startup — no separate compilation step, just start reading and running.
- Highly portable — the same source runs anywhere the interpreter is installed, regardless of OS/CPU.
- Slower execution — the same line inside a loop gets re-parsed/re-interpreted conceptually every iteration (real-world interpreters mitigate this, but pure interpretation pays a repeated translation cost that compiled code doesn't).

---

## 4. Hybrid Languages (Bytecode + JIT)

**Examples:** Java, C#, modern Python (CPython), modern JavaScript (V8, SpiderMonkey).

These languages compile source code ahead of time (or on first load) into an intermediate form called **bytecode** — not native machine code, but not raw source text either. A **virtual machine** then executes that bytecode, either by interpreting it directly or by using a **JIT (Just-In-Time) compiler** to translate hot portions of it into native machine code while the program runs (see Lesson 03).

```
Java:        MyClass.java ──javac──▶ MyClass.class (bytecode) ──JVM──▶ interpreted / JIT-compiled
C#:          Program.cs   ──csc───▶  Program.dll  (CIL bytecode) ──CLR──▶ interpreted / JIT-compiled
Python:      script.py    ──CPython compiler──▶ .pyc bytecode  ──CPython VM──▶ interpreted
JavaScript:  script.js    ──V8 parser──▶ bytecode (Ignition) ──▶ interpreted, hot code JIT-compiled (TurboFan)
```

**Trade-offs:**
- Portability of bytecode (write once, run on any machine with the right VM installed) combined with much better execution speed than pure interpretation, especially once JIT warms up.
- Startup is slower than pure interpretation (must produce bytecode first) but faster than full ahead-of-time native compilation of the whole program.
- Adds a runtime dependency: you need the VM (JVM, CLR, CPython, V8) installed to run the bytecode at all.

---

## 5. Comparison Table

| Dimension | Compiled (C/C++/Go) | Interpreted (pure, e.g. bash) | Hybrid: bytecode + JIT (Java/C#/Python/JS) |
|---|---|---|---|
| **Startup time** | Fast — binary runs immediately, but compile step is separate and can be slow | Fastest — no separate compile step at all | Medium — must produce/load bytecode first, JIT warm-up adds further delay before peak speed |
| **Execution speed (steady state)** | Fastest — native machine code, heavily optimized ahead of time | Slowest — repeated translation overhead on every execution | Fast — bytecode interpretation is quick, and JIT-compiled hot paths approach native speed |
| **Portability** | Low — binary tied to specific OS/CPU architecture; must recompile per target | High — same source runs anywhere the interpreter exists | High — same bytecode runs anywhere the VM exists ("write once, run anywhere") |
| **Development iteration speed** | Slower — edit-compile-run cycle | Fastest — edit-run cycle, no build step | Fast — edit-run cycle (Python/JS) or edit-compile-run with a quick compiler (Java/C#) |
| **Error detection timing** | Compile time (types, many logic errors caught before running) | Run time only | Mixed — some errors at compile-to-bytecode time, many still deferred to runtime |
| **Runtime dependency** | None — self-contained binary | Requires interpreter installed | Requires VM/runtime installed (JVM, CLR, CPython, browser engine) |
| **Typical use case** | OS kernels, embedded systems, performance-critical services, CLI tools | Quick scripts, glue code, config automation | Enterprise applications, web backends, general-purpose application development |

---

## 6. Which Category Does "Interpreted" Python/JS Really Belong To?

This trips people up in interviews. Colloquially we call Python and JavaScript "interpreted languages," but that's a simplification:

```
"Python is interpreted" — colloquially true, technically incomplete:

  script.py
     │
     ▼ CPython compiler (this IS a compiler — it lexes, parses, generates bytecode)
  bytecode (.pyc, in-memory)
     │
     ▼ CPython Virtual Machine (this is the "interpreter" people mean)
  executed, statement by statement, no JIT in standard CPython

So: Python IS compiled (to bytecode) AND THEN interpreted (by the CPython VM).
"Interpreted language" really means "no separate ahead-of-time step producing a
native OS executable that you distribute and run standalone."
```

JavaScript in V8 goes a step further — it also has a JIT compiler (TurboFan) that promotes hot bytecode to native machine code at runtime, which is why V8-run JavaScript can rival compiled-language speed on hot loops despite being called "interpreted." PyPy does the same for Python (see Lesson 03), while standard CPython does not JIT by default.

The precise, interview-safe statement: **"compiled" vs "interpreted" is a spectrum describing when/how translation to executable form happens, not a strict binary category** — most modern "interpreted" languages are actually compiled to bytecode and then interpreted or JIT-compiled by a virtual machine.

---

## 7. Hands-On Exercises

**Exercise 1:** Compile a trivial C program (`int main(){return 0;}`) with `gcc main.c -o main`, then run `file main` to see the OS/architecture-specific binary format. Try running that binary on a different architecture (or explain why it wouldn't run without a VM/emulator).

**Exercise 2:** Run `python3 -c "import py_compile; py_compile.compile('script.py')"` on any `.py` file and locate the generated `.pyc` file in `__pycache__/`. This is proof Python compiles before it "interprets."

**Exercise 3:** Time the same CPU-heavy loop (e.g., summing 10 million numbers) in Python, in Node.js, and in compiled C. Compare wall-clock times and relate the differences to this lesson's comparison table.

**Exercise 4:** Explain, in your own words, why a Java `.class` file can run unmodified on Windows, macOS, and Linux, while a C binary compiled on one of those cannot.

**Exercise 5:** Research (or recall) what `node --print-bytecode script.js` or a similar V8 flag reveals. Relate it to the idea that JavaScript is compiled to bytecode before execution.

---

## 8. Interview Q&A

**Q: What's the fundamental difference between a compiled and an interpreted language?**
Answer: It's about when translation to executable form happens. Compiled languages translate the entire program to native machine code ahead of time, producing a standalone binary the CPU runs directly. Interpreted languages translate and execute in the same step, at run time, without producing a separate native executable. In practice most "interpreted" languages actually compile to an intermediate bytecode first and then interpret or JIT-compile that.

**Q: Why do compiled languages like C generally run faster than interpreted ones?**
Answer: Compiled languages do all the translation and optimization work once, ahead of time, producing native CPU instructions with no runtime translation overhead. Interpreted execution re-examines and translates code as it runs (which is expensive if it happens repeatedly, e.g. inside a loop), so it pays a repeated cost that compiled code paid only once during the build step.

**Q: If Python is "interpreted," why does it produce `.pyc` files?**
Answer: Because CPython isn't a pure interpreter — it first compiles Python source into bytecode (cached as `.pyc` files in `__pycache__`), then the CPython virtual machine interprets that bytecode. The "compile" step here targets a portable bytecode format, not native machine code, which is why people still call Python "interpreted" — there's no ahead-of-time step producing an OS-specific executable.

**Q: What does "portability" mean in this context, and why do Java/C# have an edge here over C/C++?**
Answer: Portability means the same distributed artifact runs unmodified across different operating systems and CPU architectures. Java and C# compile to bytecode (JVM bytecode / CIL) that any machine with the correct VM installed can run, regardless of underlying OS/CPU — "write once, run anywhere." C/C++ compile directly to native machine code tied to a specific OS/architecture, so the same source must be recompiled per target platform.

**Q: Give an example of a hybrid language and explain what makes it hybrid.**
Answer: Java is hybrid: `javac` compiles Java source ahead of time into JVM bytecode (an intermediate representation, not native code), and then at run time the JVM either interprets that bytecode directly or uses its JIT compiler to translate frequently executed ("hot") bytecode into native machine code for near-native speed. It combines the portability of bytecode with execution speed closer to fully compiled languages.

**Q: Is "interpreted" always slower than "compiled"? Are there exceptions?**
Answer: Generally yes for pure interpretation, but modern hybrid runtimes blur this significantly. V8's JIT compiler can make hot JavaScript loops run close to native C speed once warmed up, sometimes faster than naively-written, unoptimized C. So "compiled is always faster" is an oversimplification — steady-state, JIT-optimized hot code can rival ahead-of-time compiled code, though startup and worst-case/cold-path performance still typically favor compiled languages.
