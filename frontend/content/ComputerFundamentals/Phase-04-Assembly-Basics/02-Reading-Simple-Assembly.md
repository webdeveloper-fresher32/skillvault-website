# Reading Simple Assembly — Complete Guide

## Table of Contents
1. [Goal of This Lesson](#1-goal-of-this-lesson)
2. [The Core Instructions](#2-the-core-instructions)
3. [Snippet 1: mov and add](#3-snippet-1-mov-and-add)
4. [Snippet 2: cmp and conditional jmp (an if statement)](#4-snippet-2-cmp-and-conditional-jmp-an-if-statement)
5. [Snippet 3: A Loop Using cmp and jmp](#5-snippet-3-a-loop-using-cmp-and-jmp)
6. [Snippet 4: A Function Call](#6-snippet-4-a-function-call)
7. [Quick Reference Table](#7-quick-reference-table)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Goal of This Lesson

The goal here is **reading comprehension**, not writing fluency. You should come away from this lesson able to look at a small, annotated assembly snippet and describe what it does in plain English or equivalent pseudocode — the same skill you'd use to read a stack trace or a disassembler's output.

All examples use simplified x86-64-style syntax (Intel syntax: `instruction destination, source`). Real compiler output has more noise (stack alignment, calling convention boilerplate) — these snippets are trimmed down to the essential pattern.

## 2. The Core Instructions

| Instruction | Meaning | Pseudocode Equivalent |
|-------------|---------|------------------------|
| `mov dst, src` | Copy `src` into `dst` | `dst = src` |
| `add dst, src` | Add `src` to `dst`, store in `dst` | `dst = dst + src` |
| `sub dst, src` | Subtract `src` from `dst` | `dst = dst - src` |
| `cmp a, b` | Compare `a` and `b` (sets flags, doesn't store result) | (like evaluating `a - b` just to set flags) |
| `jmp label` | Unconditionally jump to `label` | `goto label` |
| `je label` / `jz label` | Jump if the last `cmp` found equality / zero | `if (a == b): goto label` |
| `jne label` / `jnz label` | Jump if the last `cmp` found inequality / non-zero | `if (a != b): goto label` |
| `jl label` | Jump if last `cmp` found "less than" | `if (a < b): goto label` |
| `jg label` | Jump if last `cmp` found "greater than" | `if (a > b): goto label` |
| `call label` | Push return address, jump to `label` (function call) | `label()` |
| `ret` | Pop return address, jump back to caller | `return` |

Note: `cmp a, b` never stores a result anywhere. It computes `a - b` internally purely to set the CPU's flags register (zero flag, sign flag, etc.), and the *next* conditional jump instruction reads those flags to decide whether to branch. This two-instruction pattern (`cmp` then a conditional jump) is how every `if`, `while`, and `for` in a high-level language eventually gets expressed.

## 3. Snippet 1: mov and add

```asm
mov eax, 5        ; eax = 5
mov ebx, 3        ; ebx = 3
add eax, ebx      ; eax = eax + ebx  →  eax = 8
```

**Equivalent pseudocode:**

```python
eax = 5
ebx = 3
eax = eax + ebx
# eax is now 8
```

This is the assembly-level view of `z = x + y` — see Phase 03, Lesson 01 for the exact same example from the registers perspective.

## 4. Snippet 2: cmp and conditional jmp (an if statement)

```asm
mov eax, 10          ; eax = 10
cmp eax, 5           ; compare eax to 5  (computes 10 - 5 = 5, sets flags: not zero, positive)
jg  greater_label     ; if eax > 5 (from the cmp above), jump to greater_label
mov ebx, 0           ; (only runs if eax <= 5) ebx = 0
jmp end_label
greater_label:
mov ebx, 1           ; (only runs if eax > 5)  ebx = 1
end_label:
; ebx is now 1
```

**Equivalent pseudocode:**

```python
eax = 10
if eax > 5:
    ebx = 1
else:
    ebx = 0
# ebx is now 1
```

Notice how an `if/else` in a high-level language becomes: a comparison (`cmp`), a conditional jump to skip the "else" branch (`jg`), the "else" code, an unconditional jump to skip past the "if" branch (`jmp end_label`), a label marking where the "if" branch begins, and finally a label marking where both paths reconverge.

## 5. Snippet 3: A Loop Using cmp and jmp

```asm
mov ecx, 0            ; ecx = 0   (this is our loop counter, i)
loop_start:
cmp ecx, 5            ; compare i to 5
jge loop_end          ; if i >= 5, jump out of the loop
; --- loop body would go here, e.g. printing ecx ---
add ecx, 1            ; i = i + 1
jmp loop_start         ; go back and check the condition again
loop_end:
; loop has finished, ecx == 5
```

**Equivalent pseudocode:**

```python
i = 0
while i < 5:
    # loop body would go here
    i = i + 1
# loop has finished, i == 5
```

Every `for` and `while` loop in a high-level language compiles down to this same shape: a comparison, a conditional jump that exits the loop, a body, an increment, and an unconditional jump back to re-check the condition. This is also exactly why the Program Counter (Phase 03, Lesson 01) matters — `jmp loop_start` is nothing more than overwriting the Program Counter with the address of the `loop_start` label.

## 6. Snippet 4: A Function Call

```asm
; caller:
mov edi, 7          ; put argument (7) into edi (x86-64 calling convention: first int arg goes in edi)
call square         ; push return address, jump to `square`
; eax now holds the return value
mov [result], eax   ; store the returned value into a variable

; the function itself:
square:
mov eax, edi        ; eax = edi (the argument)
imul eax, eax       ; eax = eax * eax
ret                 ; pop return address, jump back to the caller
```

**Equivalent pseudocode:**

```python
def square(x):
    return x * x

result = square(7)
```

`call` and `ret` are the assembly-level mechanics behind every function call: `call` pushes the current Program Counter (the address right after the `call` instruction) onto the stack and jumps to the function; `ret` pops that saved address back off the stack and jumps to it, resuming exactly where the caller left off. This is also where the Stack Pointer (Phase 03, Lesson 01) does its work — every `call`/`ret` pair pushes and pops the call stack.

## 7. Quick Reference Table

| High-Level Construct | Assembly Pattern |
|-----------------------|-------------------|
| `x = a + b` | `mov`, `add` |
| `if (a > b) { ... }` | `cmp`, conditional `jmp` (`jg`, `jl`, `je`, etc.) |
| `while (condition) { ... }` | `cmp` + conditional `jmp` at loop top, unconditional `jmp` at loop bottom |
| `for (i = 0; i < n; i++)` | same as `while`, plus an `add`/`inc` for the increment |
| `function(args)` | `mov` args into registers per calling convention, `call` |
| `return value` | `mov` value into `eax`/`rax`, then `ret` |

---

## 8. Hands-On Exercises

**Exercise 1:** Read Snippet 2 (the `if/else` example) and, without looking at the pseudocode provided, write out in your own words what value `ebx` ends up holding and why.

**Exercise 2:** Modify Snippet 3 (the loop) on paper so that it counts from 10 down to 0 instead of counting up from 0 to 5. Write the new assembly and its pseudocode equivalent.

**Exercise 3:** Trace through Snippet 4 (the function call) step by step, and explain in your own words what the CPU's Stack Pointer is doing at the moment `call square` executes, and again at the moment `ret` executes.

**Exercise 4:** Compile a small C function containing an `if/else` (e.g., `int max(int a, int b) { return a > b ? a : b; }`) with `gcc -S -O0`, and try to identify the `cmp` and conditional jump instructions in the output.

**Exercise 5:** Write pseudocode for this snippet, then check your understanding by explaining what condition causes the loop to exit:
```asm
mov ecx, 20
loop_top:
cmp ecx, 0
jle loop_done
sub ecx, 2
jmp loop_top
loop_done:
```

---

## 9. Interview Q&A

**Q: What does the `cmp` instruction actually do, and why doesn't it store a result anywhere?**
Answer: `cmp a, b` computes `a - b` internally purely to update the CPU's flags register (zero flag, sign flag, carry flag, etc.) — it discards the actual subtraction result. It doesn't store a result because its only purpose is to set flags that a following conditional jump instruction (like `je`, `jg`, `jl`) will read to decide whether to branch.

**Q: How does a high-level `while` loop get translated into assembly?**
Answer: It becomes a label marking the top of the loop, a `cmp` comparing the loop condition, a conditional jump that exits the loop when the condition becomes false, the loop body, and an unconditional `jmp` back to the comparison at the top. This same shape underlies `for`, `while`, and even recursive constructs once compiled.

**Q: What is the difference between `jmp` and a conditional jump like `je` or `jg`?**
Answer: `jmp` unconditionally transfers control to the target label every time it executes — equivalent to `goto`. Conditional jumps (`je`, `jne`, `jg`, `jl`, etc.) only transfer control if the flags set by the preceding `cmp` (or arithmetic instruction) satisfy the specified condition; otherwise execution just continues to the next instruction.

**Q: What happens at the assembly level when a function is called?**
Answer: The caller typically places arguments into designated registers (per the calling convention) and executes `call`, which pushes the return address (the instruction right after the `call`) onto the stack and jumps to the function's first instruction. When the function finishes, `ret` pops that saved address off the stack and jumps back to it, resuming the caller exactly where it left off — this is why a corrupted stack can cause a program to jump to garbage addresses and crash.

**Q: Why do you think reading assembly matters for debugging, even if you never write it by hand?**
Answer: Crash dumps, stack traces, and disassemblers frequently show assembly-level detail, especially in optimized release builds where source-level debug information may be missing or misleading. Being able to recognize patterns like a `cmp`/conditional-jump pair as an `if` statement, or a `call`/`ret` pair as a function boundary, lets you reconstruct what the original high-level code was likely doing even without the source in front of you.
