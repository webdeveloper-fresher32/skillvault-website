# Computer Fundamentals Interview Q&A

50 questions covering the full Computer Fundamentals course, organized by topic.

---

## Number Systems & Data Representation (Q1–Q8)

**Q1. Why do computers use binary instead of decimal internally?**
Answer: Computer hardware is built from transistors that are most reliably operated as two-state switches — on (representing 1) or off (representing 0). Distinguishing only two voltage levels is far more noise-resistant and cheaper to manufacture at scale than trying to reliably distinguish ten distinct voltage levels for decimal digits. Every higher-level data type — integers, characters, floats, instructions — is ultimately encoded as sequences of these binary digits, and all arithmetic and logic circuits (adders, multiplexers, flip-flops) are designed around two-state Boolean logic.

**Q2. How do you convert a decimal number to binary and back?**
Answer: To convert decimal to binary, repeatedly divide the number by 2 and record the remainders; reading the remainders from last to first gives the binary representation (e.g. 13 → 13/2=6 r1, 6/2=3 r0, 3/2=1 r1, 1/2=0 r1 → `1101`). To convert binary back to decimal, sum the powers of 2 corresponding to each set bit, counting positions from the right starting at 0 (e.g. `1101` = 1×8 + 1×4 + 0×2 + 1×1 = 13). Hexadecimal is a common intermediate step since each hex digit maps exactly to a 4-bit binary nibble.

**Q3. What is two's complement and why is it used to represent negative numbers?**
Answer: Two's complement represents a negative number by inverting all bits of its positive counterpart and adding 1. It is the near-universal choice because it has a single, unambiguous representation of zero (unlike sign-magnitude or one's complement, which have both +0 and -0), and because addition/subtraction circuits work identically for signed and unsigned numbers — the ALU doesn't need separate logic to subtract. Overflow and carry behave predictably, and simply examining the most significant bit tells you the sign.

**Q4. What is the difference between signed and unsigned integer representations?**
Answer: An unsigned integer uses all N bits to represent magnitude, giving a range of 0 to 2^N-1. A signed integer reserves the most significant bit to indicate sign (via two's complement), giving a range of -2^(N-1) to 2^(N-1)-1 — half the positive range of the unsigned equivalent for the same bit width. Mixing signed and unsigned types in comparisons is a classic source of bugs in C/C++, because an implicit conversion can turn a negative signed value into a huge unsigned one.

**Q5. How is a floating-point number represented in memory (IEEE-754)?**
Answer: IEEE-754 splits a floating-point number into three fields: a sign bit, a biased exponent, and a mantissa (fraction). For a 32-bit float, this is 1 sign bit, 8 exponent bits, and 23 mantissa bits; for a 64-bit double, 1, 11, and 52 bits respectively. The value is computed as `(-1)^sign × 1.mantissa × 2^(exponent - bias)`, where the bias (127 for float, 1023 for double) allows the exponent field to represent both positive and negative powers without a separate sign. This format trades exact precision for an enormous dynamic range.

**Q6. Why does `0.1 + 0.2 !== 0.3` in most programming languages?**
Answer: 0.1 and 0.2 do not have exact finite representations in binary floating point, the same way 1/3 has no exact finite decimal representation. Each is stored as the closest representable binary fraction, introducing tiny rounding errors. When added, those rounding errors combine to produce a result that is extremely close to but not exactly 0.3, and since 0.3 also isn't exactly representable, the comparison fails. This is a hardware/format limitation, not a language bug, and the standard fix is comparing with an epsilon tolerance or using a fixed-point/decimal type for money.

**Q7. What is the difference between ASCII and Unicode/UTF-8?**
Answer: ASCII is a 7-bit character encoding covering 128 code points, enough for English letters, digits, and basic punctuation, but nothing else. Unicode is a much larger standard assigning a unique code point to over a million characters across virtually every writing system and symbol set in use. UTF-8 is a variable-length encoding of Unicode code points that uses 1 byte for ASCII-range characters (making it backward-compatible with ASCII) and up to 4 bytes for characters outside that range, which is why UTF-8 is the dominant encoding on the web.

**Q8. What is bit masking and where is it used in real systems?**
Answer: Bit masking uses bitwise operators (AND, OR, XOR, NOT, shifts) with a specific bit pattern (the mask) to read, set, clear, or toggle specific bits within a value without affecting the others. For example, `flags & (1 << 3)` checks whether bit 3 is set, and `flags |= (1 << 3)` sets it. Bit masking is used pervasively in low-level systems: Unix file permission bits, network subnet masks, feature flag bitfields, graphics color channel packing (RGBA), and hardware register configuration in embedded programming.

---

## Computer Architecture & CPU (Q9–Q14)

**Q9. What is the Von Neumann architecture and what is its main bottleneck?**
Answer: The Von Neumann architecture stores both program instructions and data in the same memory space, accessed over a single shared bus. The CPU repeatedly fetches an instruction, decodes it, and executes it (the fetch-decode-execute cycle). Its main limitation, known as the Von Neumann bottleneck, is that because instructions and data share one bus, the CPU cannot simultaneously fetch the next instruction and read/write data, which caps throughput regardless of how fast the CPU core itself runs — this is a major reason caching and pipelining exist.

**Q10. How does the Von Neumann architecture differ from the Harvard architecture?**
Answer: Harvard architecture uses physically separate memory spaces and buses for instructions and data, allowing the CPU to fetch an instruction and access data in the same clock cycle, improving throughput. Von Neumann's unified memory simplifies hardware design and allows more flexible memory usage (e.g., a program can be treated as data, enabling self-modifying code or dynamic loading) but suffers from the shared-bus bottleneck. In practice, most modern general-purpose CPUs use a "modified Harvard" design — separate L1 instruction and data caches feeding into a unified Von Neumann-style main memory.

**Q11. What is the fetch-decode-execute cycle?**
Answer: This is the fundamental loop every CPU runs: fetch reads the instruction located at the address held in the Program Counter (PC) from memory into the instruction register; decode interprets the instruction's opcode and operands, determining what operation and which registers/addresses are involved; execute performs the operation on the ALU or other functional units; and a final write-back stage stores the result and advances the PC to the next instruction (or jumps, for branches). This cycle repeats continuously, millions to billions of times per second depending on clock speed.

**Q12. What is pipelining and why does it improve CPU performance?**
Answer: Pipelining overlaps the fetch-decode-execute cycle for multiple instructions simultaneously, similar to an assembly line — while one instruction is being executed, the next is being decoded, and the one after that is being fetched. This means the CPU doesn't wait for one instruction to fully complete before starting the next, increasing instruction throughput even though the latency of any single instruction is unchanged. The tradeoff is pipeline hazards: branch mispredictions, data dependencies, and structural conflicts can force pipeline stalls or flushes, which is why modern CPUs invest heavily in branch prediction and out-of-order execution.

**Q13. What is the difference between clock speed and IPC (instructions per cycle), and why doesn't higher GHz always mean faster?**
Answer: Clock speed (measured in GHz) is how many cycles per second the CPU executes, while IPC is how many instructions the CPU can complete, on average, per cycle. Actual performance is roughly proportional to `clock speed × IPC`. A CPU with a lower clock speed but a wider pipeline, better branch prediction, or more execution units can outperform a higher-clock CPU with a shallower, less efficient pipeline. This is why CPU generational improvements often come from architectural changes (better IPC) rather than just cranking clock speed, which also hits power and heat dissipation limits.

**Q14. What are CISC and RISC, and which is more common today?**
Answer: CISC (Complex Instruction Set Computing, e.g. x86) provides many specialized, variable-length instructions that can each do more work per instruction, reducing the number of instructions per program at the cost of more complex decode logic. RISC (Reduced Instruction Set Computing, e.g. ARM, RISC-V) uses a small set of simple, fixed-length instructions that execute in a uniform number of cycles, simplifying pipelining and improving power efficiency. Modern x86 CPUs are internally CISC-to-RISC translators (decoding complex instructions into simpler internal micro-ops), and RISC-based ARM chips now dominate mobile and are increasingly common in laptops and servers due to power efficiency.

---

## Cache & Memory Hierarchy (Q15–Q20)

**Q15. What is the memory hierarchy and why does it exist?**
Answer: The memory hierarchy is a tiered arrangement of storage — registers, L1/L2/L3 cache, RAM, SSD/HDD, and network storage — ordered from fastest/smallest/most expensive to slowest/largest/cheapest. It exists because there is no single memory technology that is simultaneously fast, large, and cheap; instead, systems keep frequently accessed data in small fast tiers and bulk data in large slow tiers, relying on the principle of locality to keep the hot data close to the CPU. This gives the illusion of a memory system that is both as fast as registers and as large as disk, most of the time.

**Q16. What is the difference between temporal locality and spatial locality?**
Answer: Temporal locality is the tendency for a program to access the same memory location again soon (e.g. a loop counter or a variable reused across iterations), which caching exploits by keeping recently accessed data close to the CPU. Spatial locality is the tendency to access memory locations near ones that were recently accessed (e.g. iterating sequentially through an array), which caching exploits by fetching entire cache lines (typically 64 bytes) instead of single bytes, so nearby data is pre-loaded. Both principles are why cache-friendly code (sequential access patterns, data reuse) runs dramatically faster than cache-unfriendly code with the same algorithmic complexity.

**Q17. What is a cache miss, and what are the main types (compulsory, capacity, conflict)?**
Answer: A cache miss occurs when requested data is not found in the cache and must be fetched from a slower level of the memory hierarchy. A compulsory (cold) miss happens the first time data is ever accessed, since it can't already be cached. A capacity miss happens when the working set is larger than the cache can hold, forcing eviction of data that's still needed. A conflict miss happens in caches with limited associativity, where multiple memory addresses map to the same cache line/set and evict each other even though the cache overall has free space elsewhere.

**Q18. What is cache associativity (direct-mapped vs set-associative vs fully associative)?**
Answer: Associativity describes how many cache locations a given memory address is allowed to map to. In a direct-mapped cache, each address maps to exactly one line, which is simple and fast but prone to conflict misses. In a fully associative cache, an address can be placed in any line, minimizing conflict misses but requiring expensive parallel comparison logic to search all lines. Set-associative caches (e.g. 8-way set associative) are the common middle ground — each address maps to one of several lines within a specific set, balancing lookup cost against conflict-miss rate.

**Q19. What is cache coherence and why does it matter in multi-core systems?**
Answer: Cache coherence ensures that when multiple CPU cores each have their own private cache, all cores see a consistent view of shared memory — if one core writes to a memory address, other cores' cached copies of that address must be invalidated or updated rather than silently going stale. This is typically implemented with protocols like MESI (Modified, Exclusive, Shared, Invalid), which track the state of each cache line across cores. Without coherence, concurrent programs on multi-core CPUs could read outdated data from their local cache even after another core updated the "same" memory location.

**Q20. What is false sharing and how can it hurt multi-threaded performance?**
Answer: False sharing occurs when two threads on different cores modify unrelated variables that happen to reside on the same cache line, which is the smallest unit caches manage coherence for. Even though the threads aren't logically sharing data, the coherence protocol invalidates the entire cache line on each write, forcing the other core to reload it from a slower cache level or memory — causing severe, hard-to-diagnose slowdowns despite no real data dependency. The fix is typically padding or aligning hot variables so they land on separate cache lines.

---

## Assembly & Low-Level (Q21–Q24)

**Q21. What is assembly language and how does it relate to machine code?**
Answer: Assembly language is a thin, human-readable textual representation of a CPU's native instruction set, using mnemonics (like `MOV`, `ADD`, `JMP`) instead of raw binary opcodes. Each assembly instruction corresponds almost one-to-one with a single machine code instruction, translated by an assembler (not a compiler, since there's no complex transformation, just mnemonic-to-opcode substitution and address resolution). It is architecture-specific — x86 assembly and ARM assembly are entirely different instruction sets — unlike higher-level languages, which are largely portable across architectures.

**Q22. What are CPU registers and why are they faster than RAM?**
Answer: Registers are small, extremely fast storage locations built directly into the CPU core itself, used to hold operands and intermediate results during instruction execution (e.g. general-purpose registers, the program counter, the stack pointer). They are faster than RAM because they require no bus transaction at all — they're wired directly into the ALU and control unit, with access times on the order of a fraction of a nanosecond, versus roughly 100 nanoseconds for a RAM access. The tradeoff is that there are only a handful of registers (commonly 16-32 general-purpose ones on modern architectures), so the compiler must carefully decide what to keep in registers versus spilling to the stack.

**Q23. What is the difference between the stack pointer and the program counter?**
Answer: The program counter (PC), also called the instruction pointer, holds the memory address of the next instruction to be fetched and executed — it advances automatically each cycle and is updated explicitly by jump/branch/call instructions. The stack pointer (SP) holds the memory address of the top of the current call stack, and is adjusted whenever data is pushed or popped, or when a function call/return allocates or deallocates a stack frame. Both are special-purpose registers, but the PC drives instruction flow while the SP manages the call stack's growth and shrinkage.

**Q24. What is a system call, and how does user-mode code invoke kernel functionality?**
Answer: A system call is a controlled entry point that lets a user-mode process request a privileged operation — reading a file, allocating memory, creating a process — from the kernel, which runs in a more privileged CPU mode. The typical mechanism is a special trap/interrupt instruction (e.g. `syscall` on x86-64) that switches the CPU from user mode to kernel mode, transfers control to a fixed kernel entry handler, and passes a system call number plus arguments (often in registers). The kernel validates the request, performs the privileged work, and returns control (and a result) back to user mode — this boundary is what prevents arbitrary user programs from directly manipulating hardware or other processes' memory.

---

## Boot Process & Kernel (Q25–Q28)

**Q25. Walk through what happens when a computer boots, from power-on to a running OS.**
Answer: On power-on, the CPU begins executing firmware (BIOS or UEFI) stored in non-volatile memory, which performs a Power-On Self-Test (POST) to check hardware. The firmware then locates a bootable device and loads the first-stage bootloader (e.g. GRUB) into memory, which in turn loads the OS kernel image (and an initial RAM disk, if used) into memory and transfers execution to it. The kernel initializes core subsystems — memory management, device drivers, scheduler — mounts the root filesystem, and finally starts the first user-space process (`init`/`systemd` on Linux), which spawns the rest of the system services and eventually a login prompt or GUI.

**Q26. What is the difference between BIOS and UEFI?**
Answer: BIOS (Basic Input/Output System) is the older firmware standard, running in 16-bit real mode, using the Master Boot Record (MBR) partitioning scheme limited to 2TB disks and 4 primary partitions, with no built-in security verification of what it boots. UEFI (Unified Extensible Firmware Interface) is the modern replacement, running in 32/64-bit mode, supporting the GPT partitioning scheme (larger disks, more partitions), faster boot times, a richer pre-OS environment, network booting, and Secure Boot, which cryptographically verifies the bootloader hasn't been tampered with before executing it.

**Q27. What is the role of the kernel, and what are the main kernel responsibilities?**
Answer: The kernel is the core of the operating system, running in the most privileged CPU mode and mediating all access between user-space programs and hardware. Its core responsibilities are process management (scheduling, creating/terminating processes), memory management (virtual memory, paging, protection between processes), device management (drivers, abstracting hardware behind a uniform interface), and providing the system call interface that lets user programs request these services safely. Everything a user-space application does — reading a file, opening a socket, allocating memory — ultimately routes through kernel-mediated system calls.

**Q28. What is the difference between a monolithic kernel and a microkernel?**
Answer: A monolithic kernel (Linux, traditional Unix) runs nearly all OS services — device drivers, filesystem, networking — in a single privileged address space, which is fast because components communicate via simple function calls, but a bug in any driver can crash the entire kernel. A microkernel (Minix, QNX) keeps only the bare essentials (IPC, basic scheduling, minimal memory management) in privileged mode, running drivers and filesystems as separate user-space processes that communicate via message passing, which is more fault-tolerant and secure but incurs message-passing overhead. Most production general-purpose OSes (Linux, Windows NT hybrid) lean monolithic or hybrid for performance reasons.

---

## Compilers, Interpreters & Bytecode (Q29–Q36)

**Q29. What is the difference between a compiler and an interpreter?**
Answer: A compiler translates the entire source program into another form (typically native machine code, or an intermediate representation) ahead of time, producing an artifact that can be executed independently and repeatedly without the compiler present. An interpreter reads and executes source code (or an intermediate form) directly, statement by statement, at runtime, without producing a standalone executable. Compiled programs generally run faster since translation overhead is paid once upfront, while interpreted programs are typically easier to run interactively and debug, since there's no separate build step.

**Q30. What are the typical phases of a compiler?**
Answer: A compiler typically proceeds through lexical analysis (tokenizing raw source text into a stream of tokens), syntax analysis/parsing (building an abstract syntax tree that reflects the language's grammar), semantic analysis (type checking, scope resolution, catching semantic errors), intermediate code generation (producing a machine-independent intermediate representation), optimization (improving the intermediate code — dead code elimination, constant folding, loop optimizations), and finally code generation (emitting target machine code or bytecode), often followed by a separate linking step that resolves references across compiled units.

**Q31. What is JIT (Just-In-Time) compilation and how does it combine benefits of both compiled and interpreted execution?**
Answer: JIT compilation starts by interpreting or running code in a simple, low-overhead mode, while a background profiler identifies "hot" code paths — functions or loops executed frequently. Those hot paths are then compiled to optimized native machine code at runtime, informed by actual runtime type and branch information that an ahead-of-time compiler wouldn't have. This gives JIT-compiled runtimes (JVM HotSpot, V8, .NET CLR) fast startup like an interpreter (no upfront compile wait) combined with near-native peak performance for the code that matters most, at the cost of a warm-up period before that optimization kicks in.

**Q32. What is bytecode, and how does it differ from native machine code?**
Answer: Bytecode is a compact, platform-independent intermediate instruction format that sits between source code and native machine code — it's designed to be executed by a virtual machine rather than directly by physical CPU hardware. Native machine code is tied to a specific CPU's instruction set (x86-64, ARM) and can only run on that architecture. Bytecode (e.g. JVM bytecode, Python's `.pyc` bytecode, CPython bytecode) allows "compile once, run anywhere" — the same bytecode file runs unmodified on any platform that has the corresponding virtual machine installed.

**Q33. What is a virtual machine (in the process-VM sense, like the JVM) and what problem does it solve?**
Answer: A process virtual machine is a software layer that provides a platform-independent runtime environment, executing bytecode by interpreting it or JIT-compiling it to the host machine's native instructions, and provides services like automatic memory management (garbage collection), a standard library, and a security sandbox. It solves the portability problem — code compiled once to bytecode (e.g. a `.class` file) runs unmodified on Windows, Linux, or macOS, as long as each platform has a compatible VM implementation, decoupling the language/compiler from the underlying hardware and OS.

**Q34. Give an example of a language that is typically compiled, one interpreted, and one that uses JIT — explain the mechanism for each.**
Answer: C is typically ahead-of-time compiled directly to native machine code by a compiler like GCC or Clang, producing a standalone binary with no runtime translation needed. Classic shell scripting (Bash) is interpreted — the shell reads and executes each line directly against the underlying OS with no separate compile step. Java uses JIT — source is first compiled to platform-independent JVM bytecode ahead of time, then that bytecode is interpreted initially and progressively JIT-compiled to native code by the JVM's HotSpot compiler as hot methods are detected at runtime, blending portability with near-native performance.

**Q35. What is the difference between static typing/checking and dynamic typing, and how does it relate to compilation?**
Answer: Static typing means variable types are known and checked at compile time — the compiler rejects a program that tries to add a string to an integer before it ever runs. Dynamic typing means types are only known and checked at runtime, so a type error surfaces only when the offending line actually executes, which can hide bugs until a rarely-hit code path runs in production. This is related to but distinct from compiled vs. interpreted: TypeScript is statically typed but compiles down to dynamically-typed interpreted JavaScript, while Python is dynamically typed but its interpreter internally compiles source to bytecode first.

**Q36. What is transpilation, and how does it differ from traditional compilation?**
Answer: Transpilation (source-to-source compilation) converts code from one high-level language (or one version/dialect of a language) into another high-level language of roughly equivalent abstraction level, such as converting modern JavaScript (ES2022) to an older ES5 dialect with Babel, or TypeScript to JavaScript. Traditional compilation typically lowers abstraction significantly, translating high-level source into a much lower-level target like machine code or bytecode. Transpilers exist primarily for compatibility (supporting older runtimes/browsers) or convenience (writing in a nicer syntax that compiles to a widely-supported target), not for performance gains from lowering abstraction.

---

## Memory Layout — Stack & Heap (Q37–Q42)

**Q37. What is the difference between the stack and the heap?**
Answer: The stack is a region of memory that grows and shrinks automatically as functions are called and return, storing local variables, function parameters, and return addresses in fixed-size frames managed in strict last-in-first-out order — allocation and deallocation are extremely fast (just moving a pointer) and fully automatic. The heap is a region used for dynamic memory allocation (`malloc`/`new`) whose lifetime isn't tied to any particular function scope; allocation requires the allocator to search for suitably sized free space, and deallocation is either manual (`free`/`delete`, risking leaks/dangling pointers) or handled by a garbage collector.

**Q38. What causes a stack overflow, and how does it typically manifest?**
Answer: A stack overflow happens when the call stack grows beyond its allocated memory region, most commonly from uncontrolled or excessively deep recursion (e.g. a recursive function missing or never reaching its base case), or from allocating an enormous local array on the stack. Because the stack has a fixed, relatively small size (often 1-8MB per thread by default), each nested function call frame pushed onto it eventually exhausts that space, and the program crashes with a stack overflow error/segfault rather than gracefully running out of memory like a heap exhaustion would.

**Q39. What is a memory leak, and how do they typically occur in languages with manual memory management vs. garbage-collected languages?**
Answer: A memory leak occurs when memory is allocated on the heap but never released, even though the program no longer needs or can reach it, causing memory usage to grow unbounded over the program's lifetime. In manually-managed languages like C, this typically happens when a programmer allocates memory with `malloc` but forgets the matching `free` call, especially along error-handling paths. In garbage-collected languages like Java or JavaScript, leaks still occur, usually via unintentionally retained references — a global collection that's only ever appended to, forgotten event listeners, or closures capturing large objects — since the GC can't reclaim memory that's technically still reachable.

**Q40. What is the difference between a dangling pointer and a memory leak?**
Answer: A dangling pointer is a pointer that still refers to a memory address after the memory it pointed to has been freed or gone out of scope, so dereferencing it produces undefined behavior — reading garbage data, corrupting unrelated memory, or crashing. A memory leak is the opposite problem: memory that is still allocated but has become unreachable, so it's never freed and just wastes space over time. Both stem from manual memory management errors, but a dangling pointer is an immediate correctness/safety bug, while a leak is a resource-exhaustion problem that typically only matters at scale or over long uptimes.

**Q41. What are the main garbage collection strategies (reference counting vs. tracing/mark-and-sweep)?**
Answer: Reference counting attaches a live-reference counter to each heap object, incrementing it when a new reference is created and decrementing it when one goes out of scope; when the count hits zero, the object is freed immediately. It's simple and has predictable, incremental overhead, but cannot reclaim cyclic references (two objects referencing each other) without extra cycle-detection logic. Tracing garbage collection (mark-and-sweep, generational GC) instead periodically walks the object graph from a set of known "roots" (globals, stack variables), marks everything reachable, and sweeps/reclaims everything unmarked — this correctly handles cycles but introduces periodic pause times, which generational and concurrent GC designs try to minimize.

**Q42. Why are stack allocations generally much faster than heap allocations?**
Answer: Stack allocation is just a pointer bump — the stack pointer is decremented by the size needed for the new frame, and deallocation on function return is simply incrementing it back, an O(1) operation with no bookkeeping. Heap allocation requires the memory allocator to search its internal free-list or arena structures for a suitably sized free block, potentially split or coalesce blocks, and update metadata to track what's allocated — all of which takes measurably longer and can also be slowed by lock contention in multi-threaded allocators. This performance gap is why performance-sensitive code prefers stack allocation (or arena/pool allocators) wherever object lifetime permits it.

---

## Big-O & Complexity Analysis (Q43–Q50)

**Q43. What is Big-O notation and what does it actually describe?**
Answer: Big-O notation describes the upper bound on how an algorithm's running time (or space usage) grows as the input size n grows toward infinity, focusing on the dominant term and ignoring constant factors and lower-order terms. It answers "in the worst case, how does cost scale?" rather than giving an exact runtime — an O(n) algorithm might be slower than an O(n²) algorithm for small n due to constants, but O(n) will always win as n grows large enough. It's a tool for reasoning about scalability and comparing algorithms independent of hardware speed or implementation details.

**Q44. What is the difference between Big-O, Big-Omega, and Big-Theta?**
Answer: Big-O (O) describes the upper bound — the worst-case growth rate, i.e., the algorithm never does worse than this. Big-Omega (Ω) describes the lower bound — the best-case growth rate, i.e., the algorithm never does better than this. Big-Theta (Θ) describes a tight bound — when the upper and lower bounds match (up to constant factors), meaning the algorithm's growth rate is precisely characterized in both best and worst cases. In casual interview usage, "Big-O" is often used loosely to mean "the typical/worst-case complexity," but rigorously, Theta is the tightest and most informative of the three.

**Q45. What is the difference between time complexity and space complexity, and how do they trade off against each other?**
Answer: Time complexity measures how the number of operations an algorithm performs grows with input size, while space complexity measures how the memory it consumes grows with input size. They frequently trade off — memoization/dynamic programming reduces time complexity (e.g. from exponential to polynomial) by caching previously computed results, at the cost of extra memory to store that cache; conversely, an in-place sort like heapsort uses O(1) extra space but can't achieve the same practical speed as an out-of-place algorithm using auxiliary buffers. Choosing between them depends on whether the system is CPU-bound or memory-constrained.

**Q46. Explain why binary search is O(log n) and why that matters at scale.**
Answer: Binary search works on a sorted array by repeatedly comparing the target to the middle element and discarding the half of the search space that cannot contain it, so each comparison halves the remaining problem size. The number of times you can halve n before reaching 1 element is log₂(n), so the algorithm performs at most ~log₂(n) comparisons. This matters enormously at scale: searching a sorted array of 1 billion elements linearly takes up to 1 billion comparisons, while binary search takes only about 30 — the logarithmic curve is nearly flat compared to linear growth once n gets large.

**Q47. What is amortized time complexity, and give an example.**
Answer: Amortized complexity averages the cost of an operation over a long sequence of operations, rather than analyzing any single operation in isolation, which is useful when an algorithm has occasional expensive operations that are rare enough not to dominate overall cost. The classic example is a dynamic array's `push`/`append`: most pushes are O(1) because there's spare capacity, but occasionally the array must resize (typically by doubling), copying all existing elements — an O(n) operation. Because doubling means resizes happen exponentially less often as the array grows, the total cost of n pushes is O(n), making each push O(1) amortized even though worst-case any single push is O(n).

**Q48. Why is quicksort O(n log n) on average but O(n²) in the worst case?**
Answer: Quicksort partitions the array around a chosen pivot, recursively sorting the elements smaller and larger than it. On average, a reasonably chosen pivot splits the array into two roughly equal halves, giving a recursion depth of O(log n) with O(n) work per level, for O(n log n) total. In the worst case — such as when the pivot is always the smallest or largest element (which can happen with a naive "always pick the first element" strategy on already-sorted input) — each partition only removes one element, giving O(n) recursion depth with O(n) work per level, resulting in O(n²). Randomized or median-of-three pivot selection mitigates this worst case in practice.

**Q49. How do you determine the time complexity of a piece of code with nested loops or recursion?**
Answer: For loops, multiply the number of iterations of each nested loop together if they're independent (a loop of n inside a loop of n gives O(n²)), or sum them if they're sequential (a loop of n followed by a separate loop of m gives O(n+m)). Pay attention to what the loop bound actually depends on — a loop that halves its range each iteration is O(log n), not O(n). For recursion, express the runtime as a recurrence relation (e.g. T(n) = 2T(n/2) + O(n) for merge sort) and solve it, often using the Master Theorem, which gives a direct formula for recurrences of the form T(n) = aT(n/b) + O(n^d) based on comparing a, b, and d.

**Q50. What is the difference between O(1) and O(log n) in practice, and why do interviewers care about this distinction?**
Answer: O(1) constant time means the operation takes the same number of steps regardless of input size — a hash map lookup or array index access. O(log n) means the number of steps grows, but extremely slowly — doubling the input only adds one more step. In practice, for most realistic input sizes the two can look similar in wall-clock time (log of even a billion is only ~30), but interviewers care about the distinction because it reveals whether a candidate actually understands why an algorithm scales the way it does — e.g., recognizing that a hash map (O(1) average) beats a balanced BST (O(log n)) for pure lookup speed, but the BST offers ordered traversal that a hash map cannot.
