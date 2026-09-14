# From High-Level Code to Assembly — Complete Guide

## Table of Contents
1. [The Big Picture](#1-the-big-picture)
2. [Walking Through a Small Function](#2-walking-through-a-small-function)
3. [Step 1: Function Entry and the Stack Frame](#3-step-1-function-entry-and-the-stack-frame)
4. [Step 2: The Comparison](#4-step-2-the-comparison)
5. [Step 3: The Branches](#5-step-3-the-branches)
6. [Step 4: Returning a Value](#6-step-4-returning-a-value)
7. [Putting the Whole Function Together](#7-putting-the-whole-function-together)
8. [Why This Matters for the Rest of the Course](#8-why-this-matters-for-the-rest-of-the-course)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Big Picture

This lesson is deliberately **illustrative, not a literal reproduction of real compiler output**. Actual compiled assembly includes stack alignment padding, calling-convention boilerplate, and optimizations that would obscure the core idea. The goal is to build an accurate *mental model* of the translation process — a model that will make Phase 07 (Compilers vs Interpreters) far more concrete when you get there.

```
High-level function (C-like pseudocode)
        │
        │  1. Compiler parses syntax into an internal tree structure
        │  2. Compiler decides register allocation (Phase 03, Lesson 01)
        │  3. Compiler emits one or more assembly instructions per statement
        ▼
Assembly instructions (mov, cmp, jmp, call, ret, ...)
        │
        │  Assembler encodes each instruction into its opcode + operands
        ▼
Machine code (binary)
```

## 2. Walking Through a Small Function

Let's use this simple function as our running example:

```c
int max(int a, int b) {
    if (a > b) {
        return a;
    } else {
        return b;
    }
}
```

We'll build up its assembly translation piece by piece, so each part maps clearly back to a piece of the source.

## 3. Step 1: Function Entry and the Stack Frame

When `max` is called, its two arguments arrive in registers (per the x86-64 calling convention, the first two integer arguments go into `edi` and `esi`):

```asm
max:
    ; edi holds `a`, esi holds `b` — placed there by the caller before `call max`
```

(Real compiled code often also sets up a stack frame here using the Base Pointer, `push rbp` / `mov rbp, rsp`, to create a stable reference for local variables — omitted here for clarity since this function has no locals beyond its parameters.)

## 4. Step 2: The Comparison

The `if (a > b)` condition becomes a `cmp` followed by a conditional jump, exactly as covered in Lesson 02:

```asm
    cmp edi, esi        ; compare a (edi) to b (esi)
    jg  return_a        ; if a > b, jump to the "return a" branch
```

## 5. Step 3: The Branches

Each branch of the `if/else` becomes a small block of instructions, with labels marking where each one starts, and an unconditional jump to skip past the other branch:

```asm
    ; else branch: b is >= a, so return b
    mov eax, esi         ; put b into eax (the return value register)
    jmp end_max
return_a:
    ; if branch: a > b, so return a
    mov eax, edi         ; put a into eax (the return value register)
end_max:
```

## 6. Step 4: Returning a Value

Per the x86-64 calling convention, integer return values are placed in `eax` before returning:

```asm
    ret                  ; pop return address, jump back to caller
```

## 7. Putting the Whole Function Together

```asm
max:
    cmp edi, esi        ; compare a and b
    jg  return_a        ; if a > b, go set eax = a

    mov eax, esi        ; else: eax = b
    jmp end_max

return_a:
    mov eax, edi        ; eax = a

end_max:
    ret                 ; return eax to the caller
```

**Mapped back to the original C:**

```c
int max(int a, int b) {     // a → edi, b → esi (calling convention)
    if (a > b) {             // cmp edi, esi ; jg return_a
        return a;            // return_a: mov eax, edi
    } else {
        return b;            // mov eax, esi
    }
}                             // ret (returns whatever is in eax)
```

A real compiler with optimizations enabled (`-O2`) would likely collapse this entire function into something even shorter, using a conditional-move instruction (`cmovg`) instead of a branch — because branches can be expensive when the CPU mispredicts them (a topic beyond this lesson, but worth knowing exists). The unoptimized version shown here is deliberately closer to a literal, readable translation of the source.

## 8. Why This Matters for the Rest of the Course

This exact pipeline — parse, allocate registers, emit instructions, assemble, link — is what Phase 07 (Compilers vs Interpreters) will explore in much more depth, including:

- How a compiler differs fundamentally from an interpreter (which never produces a standalone assembly/machine-code artifact at all, and instead executes source or bytecode step-by-step).
- How optimization passes (like the `cmovg` branchless trick mentioned above) transform naive instruction sequences into faster ones.
- How this same translation process applies (with an extra bytecode layer) to languages like Java and Python, covered in Phase 08 (Bytecode and Virtual Machines).

Everything in this lesson — registers holding arguments, `cmp`/jump pairs implementing `if`, `mov eax` before `ret` implementing `return` — is the same machinery every compiled program relies on, just usually many orders of magnitude larger and heavily optimized.

---

## 9. Hands-On Exercises

**Exercise 1:** By hand, translate this function into assembly following the same style as the `max` example above:
```c
int is_positive(int x) {
    if (x > 0) {
        return 1;
    } else {
        return 0;
    }
}
```

**Exercise 2:** Compile the real `max` function from this lesson using `gcc -S -O0 max.c -o max.s` and compare the actual output to the illustrative version in this lesson. List two differences you notice (e.g., stack frame setup, register names used).

**Exercise 3:** Recompile the same function with `gcc -S -O2 max.c -o max_opt.s`. Look for a `cmov` instruction in the output (search for "cmov"). If you don't have gcc available, research what a conditional move instruction does and explain in one paragraph why it can be faster than a branch.

**Exercise 4:** Trace through the final assembled `max` function by hand with `a = 3, b = 7`. Write down the value of `eax` after each instruction executes, and confirm it ends up correctly holding `7`.

**Exercise 5:** Explain, in 3-4 sentences, why an interpreter (like CPython running a `.py` file) does NOT go through this same "emit assembly, assemble to machine code" pipeline for your source code directly. (Hint: preview Phase 07 and Phase 08 by researching what "interpretation" and "bytecode" mean.)

---

## 10. Interview Q&A

**Q: Walk through, at a high level, how a simple `if/else` returning a value gets compiled to assembly.**
Answer: The condition becomes a `cmp` instruction followed by a conditional jump (e.g., `jg`) that branches to one code path or the other based on the CPU's flags. Each branch is a small block of instructions, typically ending by moving the appropriate value into the return-value register (`eax` on x86-64) and either falling through or jumping to a shared exit point. The function ends with `ret`, which returns control to the caller using whatever value currently sits in `eax`.

**Q: How do function arguments and return values get passed at the assembly level?**
Answer: This is governed by a calling convention — an agreed-upon protocol between the compiler and CPU architecture. On x86-64 (System V ABI, used on Linux/macOS), the first several integer arguments go into specific registers (`edi`, `esi`, `edx`, ...) rather than the stack, and the return value is placed into `eax` (or `rax` for 64-bit values) before the function executes `ret`.

**Q: Why might optimized compiler output (`-O2`) look very different from unoptimized output (`-O0`) for the same source code?**
Answer: Unoptimized output tends to be a fairly literal, one-statement-at-a-time translation, useful for debugging because it maps cleanly back to source lines. Optimized output can restructure the logic significantly — eliminating redundant loads/stores, replacing branches with branchless instructions like conditional moves, inlining small functions, and reordering instructions — all while preserving the same observable behavior, in pursuit of faster execution.

**Q: What is a conditional move (`cmov`) and why would a compiler prefer it over a branch in some cases?**
Answer: A conditional move instruction sets a register's value based on a condition without actually jumping anywhere — both possible values are effectively computed and one is selected, or the destination is only written when the condition holds, but the CPU doesn't have to guess which path will be taken. This avoids the cost of a branch misprediction (when the CPU's branch predictor guesses wrong and has to discard speculatively executed instructions), which can be costly for short, unpredictable conditions.

**Q: How does this compilation process relate to what happens when you run a Python script, which has no separate "compile to assembly" step visible to the user?**
Answer: CPython compiles source to an intermediate bytecode representation first (not directly to machine code), and then a bytecode interpreter executes that bytecode step by step, translating each bytecode operation to machine operations on the fly, rather than producing a standalone assembly/machine-code file ahead of time. This bytecode + virtual machine approach is covered in depth in Phase 08 (Bytecode and Virtual Machines), and contrasts with ahead-of-time compiled languages like C, which do go through the full pipeline shown in this lesson before the program ever runs.
