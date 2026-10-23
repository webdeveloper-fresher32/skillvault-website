# Project 2 — Simple Stack Machine Interpreter

**Level:** Intermediate
**Time estimate:** 45 – 60 minutes
**Phase prerequisite:** Phase 08 — Bytecode and Virtual Machines

---

## Overview

Phase 08 explains that languages like Python and Java don't run source code directly on the CPU — they compile to an intermediate **bytecode**, which a **virtual machine** then interprets, instruction by instruction, using an internal **stack** to hold operands. This project makes that idea concrete: you'll build a tiny stack-based virtual machine in Python that executes its own toy bytecode language, supporting `PUSH`, `POP`, `ADD`, `SUB`, `MUL`, and `PRINT`.

This is a simplified but structurally accurate model of how real stack-based VMs (the JVM, CPython's eval loop, WebAssembly) evaluate expressions: push operands onto a stack, pop them off when an operation needs them, push the result back.

---

## Prerequisites

- Python 3.8+ installed
- Phase 08 read (bytecode concept, stack-based execution model)
- Comfortable with Python classes and list `append`/`pop`

---

## Project Structure

```
02-stack-machine/
└── stack_vm.py
```

---

## How the VM Works

Each instruction is one line of text. The VM reads a program (a list of instruction strings) top to bottom, maintaining an internal `stack` (a Python list used as a LIFO stack — same data structure covered in Phase 09's stack vs. heap discussion, just implemented here in software rather than by the CPU/OS).

| Instruction | Effect |
|-------------|--------|
| `PUSH n` | Push the integer `n` onto the stack |
| `POP` | Remove and discard the top value of the stack |
| `ADD` | Pop two values `b` then `a`; push `a + b` |
| `SUB` | Pop two values `b` then `a`; push `a - b` |
| `MUL` | Pop two values `b` then `a`; push `a * b` |
| `PRINT` | Print the top value of the stack (without removing it) |

Order matters for `SUB`: the second-popped value (`a`, pushed earlier) is the operand pushed first, so `PUSH 10 / PUSH 3 / SUB` computes `10 - 3 = 7`, matching the intuitive left-to-right reading of the program.

---

## Full Source Code

Create `stack_vm.py`:

```python
#!/usr/bin/env python3
"""
Simple Stack Machine Interpreter
-----------------------------------
A tiny stack-based virtual machine that executes a toy bytecode language.

Supported instructions:
    PUSH n   - push integer n onto the stack
    POP      - discard the top of the stack
    ADD      - pop b, pop a, push a + b
    SUB      - pop b, pop a, push a - b
    MUL      - pop b, pop a, push a * b
    PRINT    - print (without removing) the top of the stack

This mirrors, in miniature, how real bytecode interpreters (CPython's eval
loop, the JVM, WebAssembly) execute stack-based instruction sets — see
Phase 08: Bytecode and Virtual Machines.
"""


class StackMachine:
    def __init__(self):
        self.stack = []
        self.output = []  # records everything PRINT has emitted, for testing

    def run(self, program):
        """Execute a program: a list of instruction strings, one per line."""
        for line_no, raw_instruction in enumerate(program, start=1):
            instruction = raw_instruction.strip()

            # Skip blank lines and comments (lines starting with '#') —
            # a small usability nicety, similar to how real assemblers work.
            if not instruction or instruction.startswith("#"):
                continue

            parts = instruction.split()
            op = parts[0].upper()

            if op == "PUSH":
                if len(parts) != 2:
                    raise SyntaxError(f"Line {line_no}: PUSH requires exactly one operand")
                self.stack.append(int(parts[1]))

            elif op == "POP":
                self._require_operands(op, line_no, 1)
                self.stack.pop()

            elif op == "ADD":
                self._require_operands(op, line_no, 2)
                b = self.stack.pop()
                a = self.stack.pop()
                self.stack.append(a + b)

            elif op == "SUB":
                self._require_operands(op, line_no, 2)
                b = self.stack.pop()
                a = self.stack.pop()
                self.stack.append(a - b)

            elif op == "MUL":
                self._require_operands(op, line_no, 2)
                b = self.stack.pop()
                a = self.stack.pop()
                self.stack.append(a * b)

            elif op == "PRINT":
                self._require_operands(op, line_no, 1)
                self.output.append(self.stack[-1])
                print(self.stack[-1])

            else:
                raise SyntaxError(f"Line {line_no}: unknown instruction '{op}'")

        return self.output

    def _require_operands(self, op, line_no, count):
        """Guard against stack underflow — the VM equivalent of a segfault."""
        if len(self.stack) < count:
            raise RuntimeError(
                f"Line {line_no}: '{op}' requires {count} value(s) on the stack, "
                f"but only {len(self.stack)} present"
            )


# A sample "program" written in our toy bytecode.
# Computes: (5 + 3), then * 10, then - 100
SAMPLE_PROGRAM = [
    "# Step 1: 5 + 3 = 8",
    "PUSH 5",
    "PUSH 3",
    "ADD",
    "PRINT",       # expected: 8
    "",
    "# Step 2: 8 * 10 = 80",
    "PUSH 10",
    "MUL",
    "PRINT",       # expected: 80
    "",
    "# Step 3: 80 - 100 = -20",
    "PUSH 100",
    "SUB",
    "PRINT",       # expected: -20
]


if __name__ == "__main__":
    vm = StackMachine()
    print("Executing sample program:\n")
    vm.run(SAMPLE_PROGRAM)
    print(f"\nFinal stack state: {vm.stack}")
    print(f"All PRINT outputs: {vm.output}")
```

---

## Sample Program and Output

The `SAMPLE_PROGRAM` above computes `((5 + 3) * 10) - 100` using only stack operations — no variables, no named registers, exactly the model Phase 08 describes for stack-based VMs.

Running it:

```bash
python3 stack_vm.py
```

Produces:

```
Executing sample program:

8
80
-20

Final stack state: [-20]
All PRINT outputs: [8, 80, -20]
```

### Tracing the stack, step by step

| Instruction | Stack before | Stack after | Notes |
|-------------|--------------|-------------|-------|
| `PUSH 5` | `[]` | `[5]` | |
| `PUSH 3` | `[5]` | `[5, 3]` | |
| `ADD` | `[5, 3]` | `[8]` | pop 3, pop 5, push 5+3 |
| `PRINT` | `[8]` | `[8]` | prints `8`, stack unchanged |
| `PUSH 10` | `[8]` | `[8, 10]` | |
| `MUL` | `[8, 10]` | `[80]` | pop 10, pop 8, push 8*10 |
| `PRINT` | `[80]` | `[80]` | prints `80` |
| `PUSH 100` | `[80]` | `[80, 100]` | |
| `SUB` | `[80, 100]` | `[-20]` | pop 100, pop 80, push 80-100 |
| `PRINT` | `[-20]` | `[-20]` | prints `-20` |

This table is exactly the kind of trace an interviewer might ask you to draw on a whiteboard when discussing how stack-based evaluation works — practicing it here builds the same mental model used to reason about compiler-generated bytecode.

---

## How to Verify It Works

| Check | Command | Expected Result |
|-------|---------|------------------|
| Sample program runs | `python3 stack_vm.py` | Prints `8`, `80`, `-20` in order |
| Final stack | (inspect `vm.stack` after run) | `[-20]` |
| Stack underflow is caught | Run a program with `ADD` before two `PUSH`es | Raises `RuntimeError` with a clear message, not an unhandled `IndexError` |
| Unknown instruction is caught | Add `"FOO"` to a program | Raises `SyntaxError: ... unknown instruction 'FOO'` |

---

## Stretch Goals

1. Add `DIV` (integer division) and handle division by zero with a clear VM-level error instead of letting Python's `ZeroDivisionError` leak through.
2. Add variables: a `STORE name` instruction that pops the top of the stack into a named slot, and `LOAD name` that pushes it back — introduces the concept of a symbol table alongside the stack.
3. Add `JMP` and conditional `JZ` (jump if zero) instructions with line labels, turning this into a minimal Turing-complete toy language — this is how real bytecode interpreters implement loops and branches.
4. Write a tiny "compiler" that takes an infix expression like `(5 + 3) * 10 - 100` and emits the equivalent stack-machine program automatically.
