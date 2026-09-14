# Computer Fundamentals — Rapid-Fire Q&A (Final Review)

## Table of Contents
1. [How to Use This](#1-how-to-use-this)
2. [Rapid-Fire Questions](#2-rapid-fire-questions)

---

## 1. How to Use This

Cover the answer column (or scroll slowly), say your answer out loud, then check it. This is the last thing to review before an interview — it assumes you've already read Phases 01-11. Questions are grouped loosely by topic but presented rapid-fire, the way an interviewer might jump between them.

---

## 2. Rapid-Fire Questions

**Q1: Convert decimal 156 to binary and hex.**
A: Binary: `10011100`. Hex: `0x9C` (9 = 1001, C = 1100).

**Q2: What is two's complement and why do computers use it?**
A: A way to represent signed integers where the negative of a number is formed by inverting all bits and adding 1. Computers use it because addition/subtraction hardware works identically for positive and negative numbers — no separate circuitry needed, and there's only one representation of zero (unlike sign-magnitude or one's complement).

**Q3: Represent -5 as an 8-bit two's complement number.**
A: 5 = `00000101`. Invert: `11111010`. Add 1: `11111011`.

**Q4: Why can't floating point represent 0.1 exactly?**
A: IEEE-754 stores numbers in binary fractions (powers of 2). 0.1 in binary is a repeating fraction (like 1/3 in decimal), so it gets truncated/rounded to the nearest representable value — introducing a tiny representation error.

**Q5: What are the three parts of an IEEE-754 float?**
A: Sign bit (1 bit), exponent (8 bits for single precision), mantissa/fraction (23 bits for single precision). Value ≈ (-1)^sign × 1.mantissa × 2^(exponent - bias).

**Q6: What is the von Neumann architecture, in one sentence?**
A: A computer architecture where instructions and data share the same memory and bus, fetched and executed sequentially by the CPU (fetch-decode-execute cycle).

**Q7: What is the "von Neumann bottleneck"?**
A: Because instructions and data share one bus, the CPU can be limited by how fast it can move data to/from memory, rather than by how fast it can compute — the CPU often waits on memory bandwidth.

**Q8: What are registers, and why are they faster than RAM?**
A: Small storage locations built directly into the CPU. They're faster than RAM because they require no bus transaction — they're physically on-die, accessed in a single clock cycle, versus tens to hundreds of cycles for RAM.

**Q9: Why does cache locality matter for performance?**
A: The CPU cache loads data in fixed-size cache lines, assuming programs exhibit spatial locality (nearby memory is used soon) and temporal locality (recently used memory is reused soon). Code/data access patterns that respect this (e.g., iterating an array sequentially) get many cache hits; patterns that don't (e.g., pointer-chasing linked structures) cause cache misses, which cost 100x+ more than a cache hit.

**Q10: What's the difference between L1, L2, and L3 cache?**
A: L1 is smallest and fastest, private per core (split into instruction and data caches). L2 is larger, slower, usually private per core. L3 is largest, slowest of the three, typically shared across all cores. Each level trades size for speed.

**Q11: What does a line of assembly like `MOV EAX, [EBX]` do?**
A: Moves (copies) the value stored at the memory address held in register EBX into register EAX — a load from memory into a register.

**Q12: What's the difference between a register and a memory address in assembly?**
A: A register is a named, fixed, on-CPU storage location (e.g., EAX); a memory address refers to a location in RAM that must be fetched over the memory bus. Assembly instructions often move data between the two.

**Q13: What happens in the boot process, at a high level?**
A: Power on → firmware (BIOS/UEFI) runs power-on self-test and initializes hardware → firmware locates and loads the bootloader from disk → bootloader loads the OS kernel into memory → kernel initializes drivers/subsystems and starts the init process → OS is ready for user login.

**Q14: What's the difference between BIOS and UEFI?**
A: BIOS is older, 16-bit, uses MBR partitioning, boots from a fixed location. UEFI is newer, supports GPT partitioning, larger disks, faster boot, secure boot, and a richer pre-OS environment.

**Q15: What is the role of the kernel?**
A: The kernel is the core of the OS — it manages hardware resources (CPU scheduling, memory management, device drivers) and mediates access between user-space programs and hardware, enforcing isolation and security (user mode vs kernel mode).

**Q16: What's the difference between user mode and kernel mode?**
A: User mode is restricted — programs can't directly access hardware or arbitrary memory. Kernel mode has full hardware access. Programs use system calls to ask the kernel to perform privileged operations on their behalf.

**Q17: What's the difference between a compiled and an interpreted language?**
A: A compiled language (e.g., C) is translated ahead-of-time into native machine code by a compiler, producing a standalone executable. An interpreted language (e.g., classic Python/Ruby execution) is read and executed line-by-line (or via bytecode) by an interpreter at runtime, with no separate native-executable step.

**Q18: Where does Python actually fit — compiled or interpreted?**
A: Both, sort of: Python source is first compiled to bytecode (.pyc), then that bytecode is executed by the CPython virtual machine — an interpreter for the bytecode. So it's "compiled to an intermediate form, then interpreted," similar to Java.

**Q19: What is bytecode?**
A: A low-level, platform-independent set of instructions that sits between source code and native machine code. It's generated by a compiler front-end and executed by a virtual machine (interpreter), rather than run directly by the CPU.

**Q20: Why use bytecode + a VM instead of compiling straight to machine code?**
A: Portability (the same bytecode runs on any platform with the VM installed), a simpler/safer execution model (the VM can sandbox operations, do bounds checking, manage memory), and faster development iteration (no full native compile step per run).

**Q21: What's the difference between the stack and the heap?**
A: The stack stores function call frames, local variables, and return addresses — fixed-size, LIFO, automatically managed, fast to allocate/deallocate. The heap stores dynamically-allocated memory with a lifetime not tied to a function call — manually or garbage-collector managed, slower to allocate, more flexible in size.

**Q22: Why does deep recursion cause a stack overflow but not a heap overflow?**
A: Each recursive call pushes a new stack frame; the stack has a fixed, relatively small size (often 1-8MB). Enough nested calls exhaust that space and crash with a stack overflow. The heap is much larger (bounded mainly by available memory) and isn't consumed by call frames, so recursion doesn't touch it directly.

**Q23: What's the time complexity of common operations: array index access, array insertion at the end, array insertion at the front, hash map lookup, and binary search?**
A: Array index access: O(1). Array append at the end (amortized): O(1). Array insertion at the front: O(n) (must shift all elements). Hash map average-case lookup: O(1). Binary search on a sorted array: O(log n).

**Q24: What is amortized analysis, and give an example.**
A: A technique for analyzing the average cost of an operation over a sequence of operations, even if some individual operations are expensive. Example: dynamic array (e.g., Python list) `append` is O(1) amortized — most appends are O(1), but occasionally the array must be resized and all elements copied (O(n)); because resizing happens exponentially less often as the array grows, the cost averages out to O(1) per append over many operations.

**Q25: Why is O(n log n) considered the practical lower bound for comparison-based sorting?**
A: A comparison sort can be modeled as a decision tree where each comparison has 2 outcomes; sorting n elements requires distinguishing n! possible orderings, and a binary tree needs at least log2(n!) ≈ n log n levels to have n! leaves — so no comparison-based sort can beat O(n log n) in the worst case (this is why algorithms like merge sort and heap sort are considered optimal for general comparison-based sorting).
