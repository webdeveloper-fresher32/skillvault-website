# How a Program Actually Runs — Complete Guide

## Table of Contents
1. [From Source Code to Something the CPU Can Run](#1-from-source-code-to-something-the-cpu-can-run)
2. [Compiled vs Interpreted vs JIT — What's Actually Different](#2-compiled-vs-interpreted-vs-jit--whats-actually-different)
3. [What Machine Code Actually Looks Like](#3-what-machine-code-actually-looks-like)
4. [Worked Trace: Running `c = a + b` Instruction by Instruction](#4-worked-trace-running-c--a--b-instruction-by-instruction)
5. [Putting the Whole Course Together](#5-putting-the-whole-course-together)
6. [Where This Shows Up in Real Code](#6-where-this-shows-up-in-real-code)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. From Source Code to Something the CPU Can Run

The CPU (Lessons 01-02) only understands one thing: **binary machine instructions** made of opcodes and operands, sitting in memory. It has no idea what Python, JavaScript, or Java are. Every layer between the code you write and the CPU exists purely to translate your intent into that raw binary form.

```
  Source code (what you write)
        │
        │   e.g.  c = a + b
        ▼
  ┌─────────────────────────────────────────────┐
  │   Translation layer (varies by language)      │
  │   - Compiler  (C, Go, Rust, C++)              │
  │   - Interpreter (classic Python, Ruby, shell) │
  │   - Bytecode + VM/JIT (Java, C#, modern JS)   │
  └─────────────────────────────────────────────┘
        │
        │   e.g.  LOAD R1, a  /  LOAD R2, b  /  ADD R1, R2  /  STORE c, R1
        ▼
  Machine code (binary instructions the CPU understands)
        │
        ▼
  Fetch → Decode → Execute (Lesson 01-02) — the CPU actually runs it
```

---

## 2. Compiled vs Interpreted vs JIT — What's Actually Different

| Approach | How it works | Examples | Trade-off |
|----------|---------------|----------|-----------|
| **Compiled (ahead-of-time)** | A compiler translates the entire source file into native machine code *before* the program runs, producing an executable | C, C++, Go, Rust | Fast execution (already machine code); slower "compile" step; produces platform-specific binaries |
| **Interpreted** | An interpreter reads and executes source code (or a simple intermediate form) line by line, *while the program runs*, translating on the fly | Classic Python (CPython bytecode + interpreter loop), Ruby, Bash | Slower execution (translation overhead every run); no separate compile step; portable across platforms |
| **Bytecode + JIT (Just-In-Time)** | Source is compiled to an intermediate "bytecode," which a virtual machine interprets — and/or compiles hot code paths to native machine code *during* execution | Java (JVM), C# (.NET CLR), modern JavaScript engines (V8) | Balances portability and speed; JIT "warms up" over time as hot paths get compiled |

Regardless of which path is taken, the destination is identical: **binary machine instructions loaded into memory, ready for fetch-decode-execute.** The difference is only *when* and *how* that translation happens — ahead of time (compiled), continuously (interpreted), or adaptively (JIT).

```python
>>> # Peek at CPython's intermediate bytecode form for "c = a + b":
>>> # (exact opcode names vary slightly by Python version; shape is the same)
>>> import dis
>>> def add(a, b):
...     c = a + b
...     return c
...
>>> dis.dis(add)
  1           0 RESUME                   0
  2           2 LOAD_FAST                0 (a)
              4 LOAD_FAST                1 (b)
              6 BINARY_OP                0 (+)
             10 STORE_FAST               2 (c)
  3          12 LOAD_FAST                2 (c)
             14 RETURN_VALUE
```

Notice how similar this bytecode already looks to CPU-style instructions (`LOAD`, `BINARY_OP`/`ADD`, `STORE`) — it's an intermediate step, one layer above actual machine code, that CPython's own interpreter loop then executes.

---

## 3. What Machine Code Actually Looks Like

Machine code is just bytes — but each byte pattern is defined by the CPU's instruction set (Lesson 02, §6) to mean a specific operation. A simplified, human-readable stand-in for machine code is **assembly language** — a nearly 1-to-1 human-readable mnemonic for each raw binary instruction.

```
Machine code (raw bytes, x86-64, illustrative):
  B8 05 00 00 00      <- binary opcode + operand

Assembly (human-readable form of the exact same instruction):
  MOV EAX, 5          <- "move the value 5 into register EAX"
```

You will essentially never write raw machine code or even assembly by hand as a full-stack engineer — but recognizing that it exists, and that it's simply "instruction opcode + operand values, expressed as bytes, sitting in memory" demystifies everything above it.

---

## 4. Worked Trace: Running `c = a + b` Instruction by Instruction

Let's trace a toy, simplified instruction sequence through fetch-decode-execute, tying together Lessons 01 and 02. Assume `a = 5` and `b = 7` are already stored in memory, and we want to compute `c = a + b`.

**Simplified toy machine code in memory** (made-up mnemonic assembly for clarity — not a real ISA):

```
Address   Instruction
0x00      LOAD  R1, [0x10]      ; load value at memory address 0x10 into register R1
0x01      LOAD  R2, [0x11]      ; load value at memory address 0x11 into register R2
0x02      ADD   R1, R2          ; R1 = R1 + R2  (this is an ALU operation)
0x03      STORE [0x12], R1      ; store R1's value into memory address 0x12
0x04      HALT                  ; stop execution

Memory data:
0x10:  5     <- variable 'a'
0x11:  7     <- variable 'b'
0x12:  (empty, will hold 'c')
```

**Trace, cycle by cycle** (PC = Program Counter, from Lesson 02 §4):

```
Cycle 1:  PC = 0x00
  FETCH:   Control unit reads instruction at address in PC (0x00) → "LOAD R1, [0x10]"
  DECODE:  Control unit determines this is a memory-load into R1 from address 0x10
  EXECUTE: Memory address 0x10 is put on the address bus, value 5 comes back on the
           data bus, and is loaded into register R1.
  PC is incremented to 0x01.
  State:   R1 = 5,  R2 = ?

Cycle 2:  PC = 0x01
  FETCH:   Instruction at 0x01 → "LOAD R2, [0x11]"
  DECODE:  Memory-load into R2 from address 0x11
  EXECUTE: Value 7 is read from memory address 0x11 into register R2.
  PC incremented to 0x02.
  State:   R1 = 5,  R2 = 7

Cycle 3:  PC = 0x02
  FETCH:   Instruction at 0x02 → "ADD R1, R2"
  DECODE:  This is an ALU add operation, operands are R1 and R2, result goes back into R1
  EXECUTE: Control unit tells the ALU: add R1 and R2. ALU computes 5 + 7 = 12.
           Result 12 is written back into register R1.
  PC incremented to 0x03.
  State:   R1 = 12, R2 = 7

Cycle 4:  PC = 0x03
  FETCH:   Instruction at 0x03 → "STORE [0x12], R1"
  DECODE:  This is a memory-store: write R1's value to address 0x12
  EXECUTE: Address 0x12 is put on the address bus, value 12 (from R1) is put on the
           data bus, memory writes 12 into address 0x12.
  PC incremented to 0x04.
  State:   Memory[0x12] = 12   <- this is 'c'

Cycle 5:  PC = 0x04
  FETCH:   Instruction at 0x04 → "HALT"
  DECODE:  Stop execution
  EXECUTE: CPU stops fetching further instructions.
```

Five cycles, four real instructions, one straightforward Python line (`c = a + b`) fully explained from source code down to registers, ALU, buses, and memory — exactly the chain introduced across §1-3 and Phase 02 Lessons 01-02.

---

## 5. Putting the Whole Course Together

```
"c = a + b"                                     (Phase 2, Lesson 3, §1: source code)
     │
     ▼
Compiler/interpreter translates to instructions  (Phase 2, Lesson 3, §2)
     │
     ▼
Machine code sits in memory as bytes             (Phase 2, Lesson 1, §4: stored-program concept)
   - which are themselves just binary numbers     (Phase 1, Lesson 1: binary/hex)
     │
     ▼
CPU fetches instructions via the bus              (Phase 2, Lesson 1, §3: address/data/control bus)
     │
     ▼
Control unit decodes, ALU executes                (Phase 2, Lesson 2, §2-3: ALU, control unit)
   - numbers involved are represented as:
       - two's complement if signed integers       (Phase 1, Lesson 2)
       - IEEE-754 if floating point                 (Phase 1, Lesson 3)
       - a chosen encoding if text (ASCII/UTF-8)     (Phase 1, Lesson 4)
     │
     ▼
Result stored back in registers/memory            (Phase 2, Lesson 2, §4: registers)
     │
     ▼
Cycle repeats, driven by the clock                (Phase 2, Lesson 2, §5: clock speed/cycles)
```

Every concept in this course's two phases is a piece of this one pipeline. This is, quite literally, "how a computer works," compressed into two phases.

---

## 6. Where This Shows Up in Real Code

- **"Compiled languages are faster"**: now you can explain *why* — ahead-of-time compiled code skips the translation-at-runtime overhead that interpreted/JIT languages pay (at least until JIT-compiled hot paths kick in).
- **Startup time differences**: a compiled Go binary starts near-instantly; a JVM-based Java app has a "warm-up" period as the JIT compiler identifies and optimizes hot code paths — directly explained by §2.
- **Cross-compilation / Docker multi-arch builds**: compiling source into machine code for a *specific* CPU architecture (x86 vs ARM, Lesson 02 §6) is why binaries aren't universally portable the way source code or bytecode (Java `.class`/`.jar`, Python `.pyc`) can be.
- **Debugging with a debugger**: setting a breakpoint and "stepping" through code is, under the hood, pausing right before/after individual fetch-decode-execute cycles — which is why debuggers can show you register and memory values at each step.
- **Reading a stack trace**: understanding "the program counter," a call stack, and instruction-level execution demystifies what a debugger or crash report is actually showing you.

---

## 7. Hands-On Exercises

1. Run `dis.dis()` (from §2) on a small Python function of your own (e.g., one with an `if` statement or a loop) and try to map each bytecode instruction to what it's doing conceptually.
2. By hand, extend the worked trace in §4: add a fifth instruction, `MUL R1, R2` (multiply R1 by R2) after the `ADD`, and trace what values end up in R1, R2, and memory address `0x12` by the end.
3. In your own words, explain why a Go program (compiled) typically starts faster than a Java program (JIT/bytecode) — reference the translation step described in §2.
4. Research one real compiled language, one real interpreted language, and one real JIT language you've used or heard of, and categorize each according to §2's table.
5. Trace through, on paper, what would happen in the fetch-decode-execute loop if the CPU encountered an unrecognized/invalid opcode during the DECODE stage — what do you think a real CPU does in that situation (this is the origin of "illegal instruction" crashes)?

---

## 8. Interview Q&A

**Q: Walk me through what happens, at a hardware level, when a simple line of code like `c = a + b` runs.**
Answer: The compiler or interpreter first translates the line into one or more machine instructions (e.g., load `a` and `b` into registers, add them via the ALU, store the result). These instructions sit as binary in memory. The CPU's control unit then runs its fetch-decode-execute loop: it fetches each instruction from memory via the bus (using the address the Program Counter points to), decodes what operation it represents, and executes it — for the add, the control unit directs the ALU to add the two register values, then writes the result back to a register or memory. The Program Counter advances after each instruction until the sequence completes.

**Q: What's the practical difference between a compiled language and an interpreted language, and why does it matter for performance?**
Answer: A compiled language translates the entire program into native machine code ahead of time, so at run time the CPU executes already-optimized machine instructions directly — fast execution, slower build step, and the binary is tied to a specific CPU architecture/OS. An interpreted language translates and executes code on the fly, line by line (or via a simple bytecode loop), which adds translation overhead at run time but skips a separate build step and is more portable across platforms. This is why, for example, a CPU-bound task typically runs faster in compiled C++ than in plain interpreted Python.

**Q: What is JIT (Just-In-Time) compilation, and how does it try to get the best of both worlds?**
Answer: JIT compilation starts by running code via an interpreter or bytecode virtual machine (fast startup, portable), but monitors execution to detect "hot" code paths that run frequently, then compiles just those paths into native machine code during execution to speed up subsequent runs. This is how the JVM and modern JavaScript engines like V8 combine reasonably fast startup with near-compiled speed for frequently executed code, at the cost of a "warm-up" period before peak performance is reached.

**Q: What is the role of the Program Counter in the fetch-decode-execute cycle, concretely?**
Answer: The Program Counter (PC) is a register that always holds the memory address of the next instruction to execute. During fetch, the CPU reads the instruction at the address the PC points to; after fetching, the PC is incremented to the next instruction's address (or, for a jump/branch/function call instruction, set directly to a new target address). Without it, the CPU would have no mechanism for tracking sequential progress through a program or handling control flow like loops and function calls.

**Q: Why can't you take a compiled executable built for one CPU architecture (say, ARM) and run it directly on a different one (say, x86)?**
Answer: A compiled executable contains actual machine code — binary instructions specific to that CPU's instruction set architecture (Lesson 02 §6). Different architectures (x86/CISC vs ARM/RISC) define different opcodes and instruction encodings, so machine code for one is meaningless (or produces an "illegal instruction" error) on the other. This is exactly why Docker images are built per-architecture (`linux/amd64` vs `linux/arm64`) and why Apple's Rosetta 2 exists to translate/emulate x86 binaries on Apple Silicon ARM chips.

**Q: How does what you write in source code relate to what actually executes on the CPU?**
Answer: Source code is a human-readable abstraction; it must be transformed — by a compiler, interpreter, or bytecode+JIT pipeline — into raw binary machine instructions before the CPU can run it, since the CPU only understands opcodes and operands expressed as bits in memory (which is why Phase 1's binary/hex/two's-complement/floating-point/encoding topics matter: those are exactly the representations those instructions and their operands take). Regardless of the translation path, the CPU's job is always the same fetch-decode-execute loop operating on whatever machine code ends up in memory.
