# Computer Fundamentals Cheatsheet

Dense, scannable last-minute review. Not a tutorial — a memory jog.

---

### Number Systems — Quick Conversion Table

| Decimal | Binary   | Hex | Octal |
|---------|----------|-----|-------|
| 0       | 0000     | 0   | 0     |
| 1       | 0001     | 1   | 1     |
| 2       | 0010     | 2   | 2     |
| 3       | 0011     | 3   | 3     |
| 4       | 0100     | 4   | 4     |
| 5       | 0101     | 5   | 5     |
| 6       | 0110     | 6   | 6     |
| 7       | 0111     | 7   | 7     |
| 8       | 1000     | 8   | 10    |
| 9       | 1001     | 9   | 11    |
| 10      | 1010     | A   | 12    |
| 11      | 1011     | B   | 13    |
| 12      | 1100     | C   | 14    |
| 13      | 1101     | D   | 15    |
| 14      | 1110     | E   | 16    |
| 15      | 1111     | F   | 17    |

**Fast binary → hex**: group binary into nibbles (4 bits) from the right, convert each nibble independently. `1011 0110` → `B6`.

**Fast decimal → binary**: repeated divide-by-2, read remainders bottom-up. Or subtract largest power of 2 ≤ n, repeat (e.g. 100 = 64+32+4 → `01100100`).

**Powers of 2 to memorize**: 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024 (1K), 4096 (4K), 65536 (64K), 1048576 (1M), 1073741824 (1G).

---

### Two's Complement — Quick Method

To negate a binary number: **invert all bits, then add 1.**

```
  0000 0101   ( 5 )
  1111 1010   (invert)
+ 0000 0001   (add 1)
  ----------
  1111 1011   ( -5 )
```

- N-bit signed range: `-2^(N-1)` to `2^(N-1) - 1`. For 8 bits: -128 to 127.
- MSB = sign bit (0 = positive, 1 = negative).
- Why two's complement: single representation of zero, addition/subtraction use the same hardware circuit as unsigned, no separate "subtract" logic needed.
- Overflow check: overflow occurs if two operands with the same sign produce a result with the opposite sign.

---

### IEEE-754 Floating Point Layout

**Single precision (32-bit float)**:

```
[ S ][   Exponent (8 bits)   ][        Mantissa (23 bits)        ]
  1              8                            23
bit31         bits30-23                   bits22-0
```

**Double precision (64-bit double)**: 1 sign bit, 11 exponent bits, 52 mantissa bits.

- Value = `(-1)^S × 1.Mantissa × 2^(Exponent - Bias)`
- Bias = 127 (single), 1023 (double) — lets exponent represent negative powers without a sign bit.
- Special cases: exponent all 0s + mantissa 0 = ±0; exponent all 1s + mantissa 0 = ±Infinity; exponent all 1s + mantissa ≠ 0 = NaN.
- Classic gotcha: `0.1 + 0.2 !== 0.3` because 0.1 and 0.2 have no exact finite binary fraction representation.

---

### Memory Hierarchy Pyramid (fastest/smallest at top)

```
                ┌─────────────┐
                │  Registers  │   ~0.5 ns        (bytes)
                ├─────────────┤
                │  L1 Cache   │   ~1 ns          (32-64 KB)
                ├─────────────┤
                │  L2 Cache   │   ~3-10 ns       (256KB-1MB)
                ├─────────────┤
                │  L3 Cache   │   ~10-20 ns      (a few MB, shared)
                ├─────────────┤
                │  RAM (DRAM) │   ~100 ns        (GBs)
                ├─────────────┤
                │  SSD        │   ~10-100 µs     (100s of GB - TBs)
                ├─────────────┤
                │  HDD        │   ~1-10 ms       (TBs)
                ├─────────────┤
                │  Network    │   ~10-100+ ms    (effectively unbounded)
                └─────────────┘
```

Rule of thumb: each level down is ~5-10x slower and ~10-100x larger. Locality of reference (temporal + spatial) is why caching works at all.

---

### Von Neumann Fetch-Decode-Execute Cycle (one-liner)

**Fetch** the instruction at the address in the Program Counter from memory → **Decode** it into an opcode + operands → **Execute** it on the ALU/registers → **Write back** the result and increment the PC → repeat.

Von Neumann bottleneck: a single shared bus for instructions and data means the CPU can't fetch an instruction and read/write data in the same cycle.

---

### Compiled vs Interpreted vs JIT

| Aspect | Compiled | Interpreted | JIT (Just-In-Time) |
|--------|----------|--------------|---------------------|
| Translation | Source → machine code ahead of time | Source read and executed line-by-line at runtime | Source/bytecode compiled to machine code during execution |
| Speed (runtime) | Fastest | Slowest | Fast after warm-up |
| Startup time | Instant (already native) | Instant (no build step) | Slower start (warm-up needed) |
| Portability | Tied to target platform (needs recompilation) | Runs anywhere the interpreter exists | Runs anywhere the runtime/VM exists |
| Examples | C, C++, Rust, Go | classic Python (CPython bytecode+interp), Bash, Ruby (MRI) | Java (HotSpot JVM), JavaScript (V8), C# (.NET CLR) |
| Error discovery | Compile time | Runtime, line by line | Mix — parse/compile errors early, some at runtime |

---

### Program Memory Segments (Layout of a Running Process)

```
High Address
┌─────────────────────────┐
│   Command-line args &   │
│   environment variables │
├─────────────────────────┤
│         Stack           │  ↓ grows downward
│  (local vars, return    │
│   addresses, frames)    │
├─────────────────────────┤
│                          │
│      (free space)        │
│                          │
├─────────────────────────┤
│         Heap             │  ↑ grows upward
│  (malloc/new, dynamic    │
│   allocations)           │
├─────────────────────────┤
│   BSS (uninitialized     │
│   global/static vars)    │
├─────────────────────────┤
│   Data (initialized      │
│   global/static vars)    │
├─────────────────────────┤
│   Text/Code (compiled    │
│   instructions, read-only)│
└─────────────────────────┘
Low Address
```

Stack: fast, fixed-size frames, LIFO, auto-freed on function return, causes stack overflow on deep recursion. Heap: slower (allocator bookkeeping), manually managed or GC'd, causes memory leaks/fragmentation if mismanaged.

---

### Big-O Complexity Classes

| Notation | Name | Example Operation |
|----------|------|--------------------|
| O(1) | Constant | Array index access, hash map get/set (average) |
| O(log n) | Logarithmic | Binary search, balanced BST lookup |
| O(n) | Linear | Single loop over array, linear search |
| O(n log n) | Linearithmic | Merge sort, quick sort (avg), heap sort |
| O(n²) | Quadratic | Nested loops, bubble/insertion sort, naive pair comparison |
| O(n³) | Cubic | Triple nested loops, naive matrix multiplication |
| O(2ⁿ) | Exponential | Recursive Fibonacci (no memo), subset generation |
| O(n!) | Factorial | Brute-force traveling salesman, generating all permutations |

Ordering (best to worst): `O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)`

---

### Amortized Analysis (one-liner)

Amortized cost spreads the occasional expensive operation over many cheap ones so the **average cost per operation over a sequence** stays low — e.g. dynamic array `push` is O(1) amortized even though occasional resizes cost O(n), because doubling capacity means resizes become exponentially rarer.
