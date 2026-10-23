# Stack vs Heap and Program Memory Basics — Complete Guide

## Table of Contents
1. [Why Memory Layout Matters](#1-why-memory-layout-matters)
2. [The Process Address Space, End to End](#2-the-process-address-space-end-to-end)
3. [Text and Data Segments](#3-text-and-data-segments)
4. [The Heap](#4-the-heap)
5. [The Stack](#5-the-stack)
6. [Stack vs Heap Side by Side](#6-stack-vs-heap-side-by-side)
7. [A Worked Example](#7-a-worked-example)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Memory Layout Matters

Every running process gets its own private view of memory, organized into distinct regions with different lifetimes, growth patterns, and rules. Understanding this layout explains some of the most common interview questions and real bugs full-stack engineers hit: stack overflows from deep/infinite recursion, memory leaks from unfreed heap allocations, "segmentation fault" errors, and why local variables disappear the moment a function returns but heap-allocated objects don't. This lesson previews the memory model; later phases (Memory Management) go much deeper into paging and virtual memory.

---

## 2. The Process Address Space, End to End

Every process is given the illusion of its own private, contiguous address space (this illusion is called **virtual memory** — covered in depth later). A simplified layout on a typical 64-bit system looks like this:

```
High addresses
┌───────────────────────────────┐
│           Stack                │  ← grows DOWNWARD
│  (function calls, local vars,  │
│   return addresses)             │
│              │                  │
│              ▼                  │
│                                 │
│         (free space)            │
│                                 │
│              ▲                  │
│              │                  │
│           Heap                 │  ← grows UPWARD
│  (dynamically allocated memory: │
│   malloc/new/dict()/objects)    │
├───────────────────────────────┤
│      BSS segment                │  (uninitialized global/static vars,
│                                 │   zero-initialized by the OS)
├───────────────────────────────┤
│      Data segment               │  (initialized global/static vars)
├───────────────────────────────┤
│      Text (Code) segment        │  (your compiled instructions,
│                                 │   read-only, shared across
│                                 │   processes running the same binary)
└───────────────────────────────┘
Low addresses
```

The stack and heap deliberately grow toward each other from opposite ends of the address space — this maximizes how large either one can get without a rigid, wasteful split. If they ever collide, you get a stack overflow or heap allocation failure.

---

## 3. Text and Data Segments

| Segment | Contents | Writable? | Size |
|---------|----------|-----------|------|
| **Text (Code)** | Compiled machine instructions of your program | No (read-only, to catch bugs/prevent code injection) | Fixed at compile time |
| **Data** | Global/static variables that have an initial value (e.g., `int counter = 5;`) | Yes | Fixed at compile time |
| **BSS** | Global/static variables with no explicit initializer (e.g., `int total;`) — OS zero-fills this at load time | Yes | Fixed at compile time |

```c
int global_initialized = 42;   // lives in Data segment
int global_uninitialized;      // lives in BSS segment

int main() {                   // main()'s instructions live in Text segment
    return 0;
}
```

Because the Text segment is read-only and identical for every process running the same program, the OS can share a single physical copy of it in RAM across many processes (e.g., 50 Chrome tabs share one copy of Chrome's code) — a memory-saving trick made possible directly by this segment separation.

---

## 4. The Heap

The heap is a pool of memory a program requests **explicitly, at runtime**, for data whose size or lifetime isn't known at compile time.

```
Python:                          C:
d = {}                           int *arr = malloc(100 * sizeof(int));
d["key"] = "value"               ...
obj = MyClass()                  free(arr);   // must free manually!

(garbage collector reclaims      (memory leak if you forget free() —
 heap memory automatically)       the memory stays allocated forever)
```

Key traits:
- **Growth**: Requested manually (`malloc`/`new`) or implicitly by the language runtime (Python's object allocator, JS engine's object heap) — ultimately backed by syscalls like `brk()`/`mmap()` (from Lesson 03).
- **Lifetime**: Data persists until explicitly freed (C/C++) or until no references remain and a garbage collector reclaims it (Python, Java, JavaScript, Go).
- **Speed**: Slower to allocate than stack memory — the allocator has to find a suitably-sized free block, and fragmentation can occur over time.
- **Danger zones**: Memory leaks (forgetting to free), use-after-free, dangling pointers, double-free bugs (mostly in unmanaged languages like C/C++).

---

## 5. The Stack

The stack is where each function call gets its own **stack frame** — holding local variables, function parameters, and the return address to jump back to when the function finishes.

```
Call sequence:  main() calls foo() calls bar()

┌─────────────────────┐  ← Stack pointer (grows down as calls nest)
│  bar()'s frame        │
│   - local vars         │
│   - return addr → foo  │
├─────────────────────┤
│  foo()'s frame        │
│   - local vars         │
│   - return addr → main │
├─────────────────────┤
│  main()'s frame       │
│   - local vars         │
│   - return addr → OS   │
└─────────────────────┘

When bar() returns: its entire frame is POPPED (deallocated) instantly.
No manual cleanup needed — this is why stack allocation is so fast.
```

Key traits:
- **Growth**: Automatic — pushed on function call, popped on return. No explicit request needed.
- **Lifetime**: Strictly tied to the function call — a local variable's memory is invalid the instant its function returns (never return a pointer/reference to a local stack variable in C!).
- **Speed**: Extremely fast — allocation is just moving a pointer (the stack pointer register).
- **Danger zones**: **Stack overflow** — if functions call each other too deeply (often via uncontrolled/infinite recursion), the stack grows until it collides with the heap or hits its size limit, crashing the program.

```python
def infinite_recursion(n):
    return infinite_recursion(n + 1)   # never returns -> stack keeps growing

infinite_recursion(0)
# RecursionError: maximum recursion depth exceeded
# (Python's own guard against a raw stack overflow / segfault)
```

---

## 6. Stack vs Heap Side by Side

| | Stack | Heap |
|---|-------|------|
| **Allocation** | Automatic (function call/return) | Manual (`malloc`/`new`) or via runtime (object creation) |
| **Deallocation** | Automatic (function return) | Manual (`free`/`delete`) or garbage collected |
| **Speed** | Very fast (pointer bump) | Slower (allocator search, bookkeeping) |
| **Size limit** | Small, fixed per-thread (e.g., 1-8 MB default) | Large, limited mainly by available RAM/virtual memory |
| **Lifetime** | Tied to the function call | Until freed / no longer referenced |
| **Typical contents** | Local variables, function parameters, return addresses | Objects, dynamic arrays/lists, anything outliving its creating function |
| **Common failure** | Stack overflow (deep/infinite recursion) | Memory leak, out-of-memory |
| **Thread safety** | Each thread has its own stack — no sharing | Shared across threads in the same process — needs synchronization |

---

## 7. A Worked Example

```c
#include <stdlib.h>

int global_count = 0;              // Data segment (initialized global)

int add(int a, int b) {            // add()'s code lives in Text segment
    int result = a + b;            // 'result', 'a', 'b' live on the STACK
    return result;                 // stack frame popped after this returns
}

int* make_array(int size) {
    int* arr = malloc(size * sizeof(int));  // 'arr' pointer is on the stack,
                                             // but the array data it points
                                             // to lives on the HEAP
    return arr;   // safe: we're returning a heap pointer, not stack data
}

int main() {
    int x = add(3, 4);             // x is on the stack; add()'s internal
                                    // 'result' no longer exists once add() returns
    int* nums = make_array(10);    // nums (the pointer) is on the stack;
                                    // the 10 ints it points to are on the heap
    global_count++;                // modifies the Data segment
    free(nums);                    // manually release the heap memory
    return 0;
}
```

Trace through it once more:
- `add()`'s local variables (`a`, `b`, `result`) live on the stack and vanish the instant `add()` returns — this is why returning `&result` from `add()` would be a dangling-pointer bug.
- `make_array()`'s `arr` variable (the pointer itself) is on the stack, but the memory it points to is on the heap, so it safely outlives the function call — this is exactly why we allocate on the heap when data needs to survive beyond the function that created it.
- `global_count` lives in the Data segment and persists for the entire life of the program.

---

## 8. Hands-On Exercises

**Exercise 1:** Write a recursive Python function with no base case and call it. Observe the `RecursionError: maximum recursion depth exceeded` — this is Python's managed stand-in for a raw stack overflow. Then run `import sys; print(sys.getrecursionlimit())` to see the default frame limit.

**Exercise 2:** Write a small C program (or read one) with a global initialized variable, a global uninitialized variable, a local variable, and a `malloc()`'d block. Compile with `gcc -c file.c` and run `size file.o` (Linux/macOS) to see the actual `text`, `data`, and `bss` segment sizes reported.

**Exercise 3:** In Python, create a large list inside a function and return it: `def make(): return [0]*1000000`. Explain in your own words why the list survives after `make()` returns, tying it to heap vs stack lifetime.

**Exercise 4:** Draw (on paper or in a text file) the stack frames that would exist at the deepest point of a 3-level call chain `main() -> f() -> g() -> h()`, labeling each frame's return address.

**Exercise 5:** Research the default stack size on your OS (`ulimit -s` on Linux/macOS) and calculate roughly how many stack frames of ~100 bytes each you could fit before overflowing.

---

## 9. Interview Q&A

**Q: What is the difference between stack memory and heap memory?**
Answer: Stack memory is automatically allocated and deallocated as functions are called and return — it holds local variables and is very fast because allocation is just moving a stack pointer. Heap memory is explicitly (or runtime-)allocated and persists until freed or garbage collected — it's used for data whose size or lifetime isn't tied to a single function call, and allocation is slower due to bookkeeping.

**Q: What causes a stack overflow, and why does deep recursion trigger one?**
Answer: A stack overflow happens when the stack grows beyond its allocated size limit, typically because functions keep calling other functions (or themselves, in recursion) without returning, pushing a new stack frame each time. Each recursive call adds a frame with its own local variables and return address; without a base case to stop the recursion, frames pile up until the stack collides with another memory region or hits the OS-imposed limit, crashing the program.

**Q: Why can't you safely return a pointer to a local variable from a function in C?**
Answer: A local variable lives in that function's stack frame, which is popped (deallocated) the moment the function returns. The memory address is still technically valid bytes in RAM, but nothing protects it from being overwritten by the next function call's stack frame — reading through that pointer afterward is undefined behavior, commonly called a dangling pointer bug.

**Q: What are the text, data, and BSS segments, and how do they differ?**
Answer: The text (code) segment holds the compiled, read-only machine instructions. The data segment holds global/static variables that have an explicit initial value. The BSS segment holds global/static variables with no explicit initializer, which the OS zero-fills at load time. All three are fixed in size at compile/link time, unlike the stack and heap which grow at runtime.

**Q: Why is stack allocation faster than heap allocation?**
Answer: Stack allocation is just incrementing or decrementing a single pointer (the stack pointer register) to carve out space for a new frame — a constant-time operation with no searching involved. Heap allocation requires the memory allocator to search for a free block of sufficient size, update internal bookkeeping structures, and potentially deal with fragmentation, all of which is considerably more work.

**Q: In a garbage-collected language like Python or Java, do you still need to think about stack vs heap?**
Answer: Yes — the concepts still apply even though you don't manually free heap memory. Local primitive variables and object references still live on the stack per function call, while the actual objects they point to live on the heap and are reclaimed automatically once unreachable. Understanding this still matters for reasoning about recursion depth limits, object lifetime, and why mutating an object inside a function affects the caller (since both stack frames hold references to the same heap object).
