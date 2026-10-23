# Program Memory Segments — Complete Guide

## Table of Contents
1. [What is a Process's Address Space?](#1-what-is-a-processs-address-space)
2. [The Full Layout, Top to Bottom](#2-the-full-layout-top-to-bottom)
3. [The Text (Code) Segment](#3-the-text-code-segment)
4. [The Data Segment](#4-the-data-segment)
5. [The BSS Segment](#5-the-bss-segment)
6. [The Heap](#6-the-heap)
7. [The Stack](#7-the-stack)
8. [Why Stack Grows Down and Heap Grows Up](#8-why-stack-grows-down-and-heap-grows-up)
9. [Seeing This in Python](#9-seeing-this-in-python)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. What is a Process's Address Space?

When your operating system starts a program, it doesn't just hand it a random blob of RAM. It sets up a structured **virtual address space** — a private, organized range of memory addresses that only this process can see (thanks to virtual memory, which Phase 06 touches on).

Think of it like an apartment building where every tenant (process) believes they own the entire building, floor to floor, even though the building's real physical location is managed by someone else (the OS + hardware memory management unit).

This address space is divided into **segments** — contiguous regions, each with a specific purpose. Every running program, whether it's a tiny C binary or the Python interpreter running your script, has this same basic shape.

```
"Address space" = the range of memory addresses a process is allowed to use.
It does NOT mean physical RAM addresses directly — the OS translates
these virtual addresses to real RAM (or disk, via swap) behind the scenes.
```

---

## 2. The Full Layout, Top to Bottom

Here is the classic layout of a process's virtual address space (this is the standard model taught for Unix-like systems; addresses shown are illustrative, not literal):

```
High Memory Addresses (e.g. 0x7FFFFFFF on a 32-bit system)
┌────────────────────────────────────────────────────────┐
│                    Command-line args,                  │
│                    environment variables                │
├────────────────────────────────────────────────────────┤
│                         STACK                           │
│                           │                              │
│                           ▼  grows DOWNWARD              │
│                  (function calls, local variables,       │
│                   return addresses, stack frames)         │
│                                                          │
│                     ... unused gap ...                  │
│                                                          │
│                  (free space between stack & heap)       │
│                                                          │
│                           ▲  grows UPWARD                │
│                           │                              │
│                          HEAP                            │
│              (malloc'd memory, dynamically               │
│               allocated objects, Python objects)          │
├────────────────────────────────────────────────────────┤
│                          BSS                             │
│         (uninitialized global/static variables)          │
├────────────────────────────────────────────────────────┤
│                    DATA (initialized)                    │
│         (global/static variables WITH initial values)     │
├────────────────────────────────────────────────────────┤
│                    TEXT / CODE segment                   │
│              (compiled machine instructions,              │
│                    read-only, shared)                    │
└────────────────────────────────────────────────────────┘
Low Memory Addresses (e.g. 0x00000000)
```

Key takeaway before we go segment by segment: **the stack and heap grow toward each other**, from opposite ends of the address space, sharing the same "middle" free region. This is a deliberate design — it lets each grow as needed without a fixed boundary, until they eventually collide (more on that in Lesson 02).

---

## 3. The Text (Code) Segment

Also called the **code segment**. This holds the actual compiled machine instructions of your program — the CPU opcodes that get fetched and executed.

Characteristics:
- **Read-only** — the OS marks this memory as non-writable. If a bug tries to write to it (e.g., a corrupted function pointer), the OS kills the process with a segmentation fault. This is a security feature — it stops "self-modifying code" style attacks.
- **Shared** — if you run the same program (e.g., `python3`) in 10 different processes, the OS can share one physical copy of the text segment across all of them, since it never changes. This saves RAM.
- **Fixed size** — determined at compile time; it doesn't grow while the program runs.

```c
// This function's compiled machine code lives in the text segment
int add(int a, int b) {
    return a + b;
}
```

---

## 4. The Data Segment

Holds **global and static variables that have an explicit initial value** set in the source code.

```c
int global_counter = 42;        // lives in DATA segment (initialized)
static double pi_approx = 3.14; // also DATA (initialized + static)
```

- Writable (unlike text).
- Size is known at compile time because the initial values are baked into the executable file itself — the OS just loads them from disk into memory when the process starts.

---

## 5. The BSS Segment

**BSS** stands for "Block Started by Symbol" (a historical assembler term — don't worry about memorizing why it's called that). It holds **global and static variables that are declared but NOT explicitly initialized** (or explicitly initialized to zero).

```c
int global_array[1000];      // lives in BSS — no initial value given
static int retry_count;      // lives in BSS — defaults to 0
```

- The OS just needs to reserve the space and zero it out — it doesn't need to store any initial values in the executable file, because "all zeros" is cheap to represent. This is why BSS variables don't bloat your compiled binary size, even if the array is huge.
- Writable.

**Data vs BSS — the practical difference:**

| Segment | Example | Stored in binary file? |
|---------|---------|------------------------|
| DATA | `int x = 5;` | Yes — the value `5` is in the executable |
| BSS | `int x;` | No — just "reserve N bytes, zero them" |

---

## 6. The Heap

The heap is the region for **dynamically allocated memory** — memory you request at *runtime*, not memory whose size is known at compile time.

- In C: you explicitly request heap memory with `malloc()` and give it back with `free()`.
- In Python/Java/JS: essentially all objects (lists, dicts, class instances, strings) live on the heap, and a garbage collector reclaims them automatically. We cover this in depth in Lesson 03.
- Grows **upward** (toward higher addresses) as your program allocates more.
- Managed manually (C) or automatically (garbage-collected languages) — but either way, it's the segment for data whose lifetime and size aren't known until the program actually runs.

---

## 7. The Stack

The stack holds **function call frames** — local variables, function parameters, and return addresses, one frame per active function call.

- Grows **downward** (toward lower addresses) as functions call other functions.
- Shrinks automatically when a function returns — its frame is simply "popped."
- Fixed maximum size (set by the OS, often a few MB) — exceed it and you get a **stack overflow**. This is the entire subject of Lesson 02.
- Extremely fast to allocate/deallocate from — it's just moving a pointer (the stack pointer register), not searching for free memory like the heap sometimes must.

---

## 8. Why Stack Grows Down and Heap Grows Up

This is a deliberate, historical design choice, not an accident:

```
   Heap and Stack start at opposite ends of the "middle" free region
   and grow toward each other:

   Low addr                                          High addr
   [DATA][BSS][    HEAP ---->        <---- STACK    ][args/env]
                    growing up          growing down
```

By starting them at opposite ends and letting them grow toward each other, **neither one needs a fixed, pre-allocated size**. The heap can keep growing as long as there's free space, and so can the stack — the only hard limit is when they'd collide, which the OS detects and treats as an out-of-memory condition (or, for the stack specifically, a stack overflow, since the OS typically enforces a stack size cap well before an actual collision).

The direction (up vs down) is really just convention — some architectures do it differently — but "stack grows down" is the overwhelmingly common convention on x86, ARM, and most modern systems, largely for historical reasons dating back to early computer architectures.

---

## 9. Seeing This in Python

Python runs inside the CPython interpreter, which is itself a C program — so all of the above still applies, just one layer removed. The Python interpreter's own executable has text/data/BSS segments; **your Python objects live on the heap**, managed by CPython's memory allocator and garbage collector; and **your Python function calls use the stack**, in the form of "frame objects" (which we'll explore in Lesson 02).

```python
import sys

def show_stack_depth():
    # sys.getrecursionlimit() tells you the maximum stack "depth" Python allows
    print("Max recursion depth allowed:", sys.getrecursionlimit())

    x = [1, 2, 3]  # the list object itself lives on the HEAP
                   # the variable name 'x' is a reference stored in
                   # this function's STACK frame, pointing at the heap object

    print("id(x) — a stand-in for x's memory address:", id(x))

show_stack_depth()
```

Running this will print something like:

```
Max recursion depth allowed: 1000
id(x) — a stand-in for x's memory address: 140234516678912
```

`id(x)` in CPython actually *is* the object's memory address (on most implementations) — a very concrete link between the abstract Python variable and the physical memory layout we just discussed.

---

## 10. Hands-On Exercises

**Exercise 1:** Run the `show_stack_depth()` example above on your machine. What recursion limit does your Python installation print? Try `sys.setrecursionlimit(2000)` and re-check.

**Exercise 2:** Write a small C snippet with a global initialized variable (`int x = 10;`), a global uninitialized variable (`int y;`), and a local variable inside `main()`. Mentally (or in comments) label which segment each lives in.

**Exercise 3:** In Python, create two variables pointing to the same list (`a = [1,2,3]; b = a`) and print `id(a)` and `id(b)`. What does the result tell you about where the list object lives vs where the variable names live?

**Exercise 4:** Research (or recall from Phase 06) what a "segmentation fault" is, and explain in your own words why writing to the text segment causes one.

**Exercise 5:** Draw the full address space diagram from memory (pen and paper), labeling all five segments and the direction each of the stack/heap grows. Compare it against the diagram in Section 2.

---

## 11. Interview Q&A

**Q: What are the main segments of a process's memory layout?**
Answer: Text (code) — read-only compiled instructions; Data — initialized global/static variables; BSS — uninitialized global/static variables (zeroed at load time); Heap — dynamically allocated memory that grows upward; Stack — function call frames that grow downward. Heap and stack grow toward each other from opposite ends of the address space.

**Q: What's the difference between the Data segment and the BSS segment?**
Answer: Both hold global/static variables, but Data holds ones with an explicit non-zero initial value (so the value must be stored in the executable file itself), while BSS holds ones that are uninitialized or initialized to zero (the OS just reserves and zeroes the space at load time, without needing to store anything in the file). This keeps binaries small even with huge zero-initialized arrays.

**Q: Why does the stack grow downward while the heap grows upward?**
Answer: It's a design convention that lets both regions share the same free "middle" space of the address space without pre-committing a fixed size to either. Starting from opposite ends and growing toward each other means each can grow as needed until they would collide, which the OS detects (stack overflow or out-of-memory) rather than corrupting the other's memory.

**Q: Why is the text segment marked read-only?**
Answer: To prevent a running program from accidentally or maliciously modifying its own compiled instructions. If a bug (e.g., writing through a bad pointer) tries to write into the text segment, the OS's memory protection immediately raises a segmentation fault, catching the bug early instead of allowing corrupted code to execute — this is also an important security mitigation against certain code-injection attacks.

**Q: Where do Python objects actually live in memory?**
Answer: On the heap, just like dynamically allocated memory in C. A Python variable name is really just a reference (pointer) stored in the current stack frame or in another object, pointing to the actual object on the heap. `id(obj)` in CPython typically returns that object's real memory address.

**Q: Can the text segment be shared between multiple running instances of the same program?**
Answer: Yes. Since the text segment is read-only and identical across every process running the same executable, the OS can map one physical copy of it into multiple processes' virtual address spaces, saving memory — this is one reason running many instances of the same program is cheaper than running many different programs.
