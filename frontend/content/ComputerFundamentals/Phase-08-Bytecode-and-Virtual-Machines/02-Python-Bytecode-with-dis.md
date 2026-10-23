# Python Bytecode with `dis` — Complete Guide

## Table of Contents
1. [What `dis` Does](#1-what-dis-does)
2. [Disassembling a Simple Function](#2-disassembling-a-simple-function)
3. [Reading the Output Line by Line](#3-reading-the-output-line-by-line)
4. [Seeing Constant Folding in Action](#4-seeing-constant-folding-in-action)
5. [A Loop Example: Why Bytecode Reveals Real Cost](#5-a-loop-example-why-bytecode-reveals-real-cost)
6. [How This Ties Back to CPython Execution](#6-how-this-ties-back-to-cpython-execution)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What `dis` Does

`dis` (short for "disassembler") is a module in Python's standard library that takes compiled bytecode and prints it in a human-readable form — the same bytecode the CPython virtual machine actually executes. No installation needed; it ships with every Python 3 installation.

```python
import dis

def add_numbers(a, b):
    return a + b

dis.dis(add_numbers)
```

Running this requires nothing beyond a standard Python 3 interpreter — no external packages, no special setup.

---

## 2. Disassembling a Simple Function

Let's disassemble a function that mirrors the worked example from Phase 07: computing `2 + 3 * 4`.

```python
import dis

def compute():
    x = 2 + 3 * 4
    return x

dis.dis(compute)
```

**Actual output (Python 3.11-style; exact opcode names/numbers can vary slightly by Python version):**

```
  4           0 LOAD_CONST               1 (14)
              2 STORE_FAST               0 (x)

  5           4 LOAD_FAST                0 (x)
              6 RETURN_VALUE
```

Notice something important immediately: there is no `LOAD_CONST 2`, no `LOAD_CONST 3`, no `LOAD_CONST 4`, no `BINARY_MULTIPLY`, no `BINARY_ADD`. CPython's compiler already folded `2 + 3 * 4` into the constant `14` at **compile time** — exactly the optimization described in Phase 07, Lesson 01, Section 6. The bytecode just loads the precomputed constant `14` directly.

To see the individual operations (unfolded), we need an expression the compiler *can't* fold at compile time — one involving a variable whose value isn't known until runtime:

```python
import dis

def compute(a, b, c):
    x = a + b * c
    return x

dis.dis(compute)
```

**Output:**

```
  4           0 LOAD_FAST                1 (b)
              2 LOAD_FAST                2 (c)
              4 BINARY_MULTIPLY
              6 LOAD_FAST                0 (a)
              8 BINARY_ADD
             10 STORE_FAST               3 (x)

  5          12 LOAD_FAST                3 (x)
             14 RETURN_VALUE
```

(Note: in Python 3.11+, `BINARY_MULTIPLY`/`BINARY_ADD` were consolidated into a single generic `BINARY_OP` instruction with an operator argument — you may see `BINARY_OP 5 (*)` instead, depending on your exact Python version. The concept is identical either way.)

---

## 3. Reading the Output Line by Line

Let's annotate the unfolded version instruction by instruction:

```
  4           0 LOAD_FAST                1 (b)
```
Column meanings, left to right: `4` = the source line number this instruction corresponds to. `0` = the byte offset of this instruction within the function's bytecode. `LOAD_FAST` = the opcode name — push the value of local variable slot `1` onto the VM's operand stack. `1 (b)` = the operand: local variable index `1`, which is named `b`.

```
              2 LOAD_FAST                2 (c)
```
Offset `2` (each `LOAD_FAST` here takes 2 bytes in this Python version). Pushes local variable `c` (slot `2`) onto the stack. Stack now conceptually holds: `[b, c]`.

```
              4 BINARY_MULTIPLY
```
Pops the top two stack values (`c`, then `b`), multiplies them, pushes the result. Stack: `[b*c]`. This is a **stack machine** operation — CPython's VM is stack-based, not register-based: instructions operate on an implicit operand stack rather than named registers.

```
              6 LOAD_FAST                0 (a)
```
Pushes local variable `a` (slot `0`). Stack: `[b*c, a]`.

```
              8 BINARY_ADD
```
Pops top two values (`a`, then `b*c`), adds them, pushes result. Stack: `[a + b*c]`.

```
             10 STORE_FAST               3 (x)
```
Pops the top stack value and stores it into local variable slot `3`, named `x`. Stack is now empty.

```
  5          12 LOAD_FAST                3 (x)
```
New source line (`5`, the `return x` line). Pushes `x` back onto the stack.

```
             14 RETURN_VALUE
```
Pops the top stack value and returns it as the function's result to the caller.

This traces exactly the AST from Phase 07's pipeline (`Assign(x, Add(a, Mul(b, c)))`) into concrete stack-machine bytecode — one instruction per AST operation, evaluated in the order a post-order tree traversal would visit them (children before parents).

---

## 4. Seeing Constant Folding in Action

You can directly inspect what the compiler folds using `compile()` and `.co_consts`:

```python
code = compile("x = 2 + 3 * 4", "<string>", "exec")
print(code.co_consts)
```

**Output:**

```
(14, None)
```

The tuple of constants embedded in the compiled code object contains `14` (the folded result) and `None` (the implicit return value of a module-level `exec`-compiled statement) — never `2`, `3`, or `4` individually. This is hard proof that CPython's compiler performs constant folding before the bytecode is even generated, exactly as described conceptually in Phase 07.

---

## 5. A Loop Example: Why Bytecode Reveals Real Cost

```python
import dis

def sum_loop(n):
    total = 0
    for i in range(n):
        total += i
    return total

dis.dis(sum_loop)
```

**Output (abridged/annotated; exact offsets vary by Python version):**

```
  4           0 LOAD_CONST               1 (0)
              2 STORE_FAST               1 (total)

  5           4 LOAD_GLOBAL              0 (range)
              ...
             10 CALL_FUNCTION            1
             12 GET_ITER
        >>   14 FOR_ITER                 8 (to 32)
             16 STORE_FAST               2 (i)

  6          18 LOAD_FAST                1 (total)
             20 LOAD_FAST                2 (i)
             22 BINARY_ADD
             24 STORE_FAST               1 (total)
             26 JUMP_ABSOLUTE            7 (to 14)

  7     >>   32 LOAD_FAST                1 (total)
             34 RETURN_VALUE
```

The key teaching point: `FOR_ITER` and `JUMP_ABSOLUTE` reveal the loop structure directly in the bytecode — the `>>` markers indicate jump targets. Every single iteration of this loop re-executes `LOAD_FAST`, `LOAD_FAST`, `BINARY_ADD`, `STORE_FAST`, `JUMP_ABSOLUTE` — the CPython interpreter has no built-in fast path for "this loop body never changes," which is exactly why pure interpretation (Phase 07, Lesson 02) is slower than JIT'd or compiled equivalents: those five instructions get dispatched and executed fresh on every single pass, for however many iterations `n` specifies.

---

## 6. How This Ties Back to CPython Execution

```
your_script.py
      │
      ▼  CPython's compiler (lexer → parser → AST → bytecode compiler,
      │  the exact pipeline from Phase 07)
  code object (contains bytecode + co_consts + co_names + ...)
      │
      ▼  CPython Virtual Machine ("ceval.c" — the C source file implementing
      │  the core bytecode evaluation loop)
      │
      ▼  A giant loop, conceptually:
      │    while True:
      │        opcode = fetch_next_instruction()
      │        dispatch on opcode:
      │            case LOAD_FAST: push local variable onto stack
      │            case BINARY_ADD: pop two, add, push result
      │            case STORE_FAST: pop, store into local variable
      │            ... (100+ opcodes total)
      ▼
   Program behavior (side effects, return values, etc.)
```

Everything `dis.dis()` shows you is literally what CPython's `ceval.c` main interpreter loop dispatches on, instruction by instruction. There is no hidden extra translation step — the bytecode `dis` prints IS what gets executed (modulo the `.pyc` caching layer, which just persists this same bytecode to disk so it doesn't have to be recompiled from source on every run, in `__pycache__/`).

This is also precisely why standard CPython has no JIT (as discussed in Phase 07, Lesson 03) — this dispatch loop interprets bytecode directly, instruction by instruction, with no step that compiles hot bytecode down to native machine code. PyPy's tracing JIT is a fundamentally different execution engine that replaces this loop for hot code paths.

---

## 7. Hands-On Exercises

**Exercise 1:** Run `dis.dis()` on a function containing an `if/else` statement, e.g. `def f(x): return 1 if x > 0 else -1`. Identify the conditional jump opcode (e.g. `POP_JUMP_IF_FALSE` or similar) and explain what it does.

**Exercise 2:** Compare `dis.dis()` output for `def f(): return 2 ** 10` versus `def f(x): return x ** 10`. Confirm the first is constant-folded (or note if it isn't — not all operations fold the same way; explain what you observe).

**Exercise 3:** Write a function with a `while` loop and disassemble it. Identify which opcode(s) implement the loop's back-edge (the jump back to the top of the loop).

**Exercise 4:** Use `compile("your_expression", "<string>", "eval").co_consts` on three different expressions of your choosing to explore what CPython does and doesn't fold at compile time (try a string concatenation, a list literal, and a function call).

**Exercise 5:** Find the `__pycache__` directory for any multi-file Python project on your machine, locate a `.pyc` file, and explain (referencing this lesson) what's inside it and why it exists.

---

## 8. Interview Q&A

**Q: What does Python's `dis` module do?**
Answer: `dis` disassembles compiled Python bytecode into a human-readable listing of the actual instructions the CPython virtual machine executes — showing opcode names, their operands, source line numbers, and byte offsets. It's a standard library module, requiring no installation, and it reveals exactly what CPython's interpreter loop dispatches on when running a function.

**Q: Is CPython's bytecode VM a stack machine or a register machine?**
Answer: CPython's VM is a stack machine — instructions like `LOAD_FAST` and `BINARY_ADD` operate on an implicit operand stack (push values on, pop values off, push results) rather than named registers. This is visible directly in `dis` output: operations don't specify destination registers, they just push/pop from the stack.

**Q: How does `dis` output prove that CPython performs constant folding?**
Answer: Disassembling a function like `def f(): return 2 + 3 * 4` shows a single `LOAD_CONST 14` instruction with no `BINARY_ADD`/`BINARY_MULTIPLY` at all — proving the compiler computed the arithmetic at compile time and only the final result is embedded in the bytecode, never the intermediate operands or operators.

**Q: What is `LOAD_FAST` versus `LOAD_CONST`, and why does the distinction matter?**
Answer: `LOAD_FAST` pushes the value of a local variable (referenced by a fast, array-indexed slot number) onto the stack; `LOAD_CONST` pushes a literal constant embedded directly in the code object's constant pool. The distinction matters because it shows the compiler resolving names to fixed slots at compile time (fast, O(1) access) rather than looking them up by string name at runtime, which is part of why local variable access in CPython is faster than global variable access (which uses `LOAD_GLOBAL`, a dictionary lookup by name).

**Q: What's the relationship between the `.pyc` files in `__pycache__` and what `dis` shows?**
Answer: `.pyc` files are the on-disk cached serialization of exactly the same bytecode that `dis.dis()` prints — CPython compiles source to bytecode once, writes it to `__pycache__` so it doesn't have to recompile unchanged source on every run, and the CPython VM loads and executes that cached bytecode directly. `dis` just exposes that same bytecode in human-readable form.

**Q: Why doesn't disassembling a loop body show any speed-up mechanism for repeated iterations?**
Answer: Because standard CPython has no JIT — it's a pure bytecode interpreter. Every iteration of a `for`/`while` loop re-executes the exact same sequence of bytecode instructions via the interpreter's fetch-decode-dispatch loop, with no mechanism to recognize "this loop body is hot" and compile it to native code, unlike PyPy or V8's JIT compilers (Phase 07, Lesson 03).
