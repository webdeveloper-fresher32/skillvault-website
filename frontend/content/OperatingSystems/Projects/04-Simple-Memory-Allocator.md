# Project 4 — Simple Memory Allocator

**Level:** Advanced
**Time estimate:** 60 – 90 minutes
**Phase prerequisite:** Phase 06 – Memory Management

---

## Requirements / What You're Building

A simulator of a fixed-size memory pool (think of it as a simplified model of what `malloc`/`free` or an OS's contiguous memory allocator does) that supports three classic placement strategies:

- **First-Fit** — scan free blocks from the start, allocate in the first block big enough.
- **Best-Fit** — scan all free blocks, allocate in the smallest block that's still big enough (minimizes leftover space per allocation).
- **Worst-Fit** — scan all free blocks, allocate in the largest available block (tries to leave a large usable remainder).

The simulator will model memory as a list of blocks (each either `free` or `allocated`, with a start offset and a size), support `allocate(process_id, size)` and `free(process_id)` operations, and run a scripted demo workload that deliberately creates **external fragmentation** — memory has enough total free space to satisfy a request, but no single contiguous block is large enough — so you can watch each strategy handle (or fail to handle) it differently.

---

## Complete Runnable Python Code

Save this as `memory_allocator.py`.

```python
"""
Simple Memory Allocator Simulation
=====================================
Simulates a fixed-size contiguous memory pool with three placement
strategies: First-Fit, Best-Fit, Worst-Fit. Demonstrates how each
strategy handles the same allocation/free workload differently, and
how external fragmentation emerges.

Run: python3 memory_allocator.py
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Block:
    start: int
    size: int
    allocated: bool = False
    owner: Optional[str] = None  # process id, if allocated

    def end(self) -> int:
        return self.start + self.size


class MemoryAllocator:
    """Simulates a contiguous memory pool of `total_size` units, managed
    as a list of Block objects (allocated + free), using the given
    placement strategy: 'first_fit', 'best_fit', or 'worst_fit'.
    """

    def __init__(self, total_size: int, strategy: str = "first_fit"):
        assert strategy in ("first_fit", "best_fit", "worst_fit")
        self.total_size = total_size
        self.strategy = strategy
        self.blocks: list[Block] = [Block(start=0, size=total_size, allocated=False)]

    # -- allocation ---------------------------------------------------

    def _find_candidate_index(self, size: int) -> Optional[int]:
        """Return the index of the free block to use, or None if no
        single free block is large enough (even though total free space
        might be plenty — this is exactly what external fragmentation
        looks like)."""
        candidates = [
            (i, b) for i, b in enumerate(self.blocks)
            if not b.allocated and b.size >= size
        ]
        if not candidates:
            return None

        if self.strategy == "first_fit":
            return candidates[0][0]
        elif self.strategy == "best_fit":
            return min(candidates, key=lambda ib: ib[1].size)[0]
        elif self.strategy == "worst_fit":
            return max(candidates, key=lambda ib: ib[1].size)[0]
        raise AssertionError("unreachable")

    def allocate(self, owner: str, size: int) -> bool:
        """Attempt to allocate `size` units for `owner`. Returns True on
        success, False if allocation failed (no big-enough block)."""
        idx = self._find_candidate_index(size)
        if idx is None:
            print(f"  [ALLOC FAIL] {owner} requested {size} units — "
                  f"no single free block big enough (fragmentation: "
                  f"{self.total_free()} total free, but split across "
                  f"{self.num_free_blocks()} blocks).")
            return False

        block = self.blocks[idx]
        if block.size == size:
            # Exact fit: just mark it allocated.
            block.allocated = True
            block.owner = owner
        else:
            # Split the block: [allocated part][remaining free part]
            allocated_block = Block(start=block.start, size=size, allocated=True, owner=owner)
            remainder_block = Block(start=block.start + size, size=block.size - size, allocated=False)
            self.blocks[idx:idx + 1] = [allocated_block, remainder_block]

        print(f"  [ALLOC OK]   {owner} <- {size} units "
              f"(strategy={self.strategy})")
        return True

    def free(self, owner: str) -> bool:
        """Free the block(s) owned by `owner`, then merge with any
        adjacent free blocks (coalescing) to reduce fragmentation."""
        found = False
        for block in self.blocks:
            if block.allocated and block.owner == owner:
                block.allocated = False
                block.owner = None
                found = True

        if not found:
            print(f"  [FREE FAIL]  No allocation found for {owner}")
            return False

        self._coalesce()
        print(f"  [FREE OK]    Released memory owned by {owner}")
        return True

    def _coalesce(self):
        """Merge adjacent free blocks into a single larger free block."""
        merged: list[Block] = []
        for block in self.blocks:
            if merged and not merged[-1].allocated and not block.allocated:
                merged[-1] = Block(
                    start=merged[-1].start,
                    size=merged[-1].size + block.size,
                    allocated=False,
                )
            else:
                merged.append(block)
        self.blocks = merged

    # -- introspection --------------------------------------------------

    def total_free(self) -> int:
        return sum(b.size for b in self.blocks if not b.allocated)

    def num_free_blocks(self) -> int:
        return sum(1 for b in self.blocks if not b.allocated)

    def largest_free_block(self) -> int:
        free_sizes = [b.size for b in self.blocks if not b.allocated]
        return max(free_sizes) if free_sizes else 0

    def render(self) -> str:
        """Render the memory pool as an ASCII bar, one character group
        per block, scaled to a fixed display width."""
        display_width = 60
        scale = display_width / self.total_size
        bar = ""
        legend = []
        for block in self.blocks:
            width = max(1, round(block.size * scale))
            if block.allocated:
                label = block.owner[0] if block.owner else "?"
                bar += label * width
                legend.append(f"{block.owner}={block.size}")
            else:
                bar += "." * width
        return f"[{bar}]"

    def print_state(self, label: str = ""):
        free_total = self.total_free()
        largest = self.largest_free_block()
        frag_pct = 0.0
        if free_total > 0:
            frag_pct = 100.0 * (1 - largest / free_total)
        print(f"{label}")
        print(f"  Memory: {self.render()}")
        print(f"  Free: {free_total}/{self.total_size} units across "
              f"{self.num_free_blocks()} block(s) | "
              f"largest free block: {largest} | "
              f"external fragmentation: {frag_pct:.0f}%")
        blocks_desc = ", ".join(
            f"[{b.start}-{b.end()}) {'ALLOC:' + b.owner if b.allocated else 'FREE'} "
            f"size={b.size}"
            for b in self.blocks
        )
        print(f"  Blocks: {blocks_desc}")


def run_demo(strategy: str):
    print("=" * 78)
    print(f"Strategy: {strategy.upper()}")
    print("=" * 78)

    mem = MemoryAllocator(total_size=105, strategy=strategy)
    mem.print_state("Initial state:")
    print()

    # A scripted workload designed to make the three strategies diverge
    # visibly: after freeing P2, P4, and P6 there are three holes of
    # different sizes (25, 20, 30) at different positions. Requesting 18
    # units — which fits in all three holes — makes each strategy pick a
    # DIFFERENT hole:
    #   First-Fit  -> leftmost qualifying hole  (P2's old hole, size 25)
    #   Best-Fit   -> smallest qualifying hole  (P4's old hole, size 20)
    #   Worst-Fit  -> largest qualifying hole   (P6's old hole, size 30)
    workload = [
        ("alloc", "P1", 10),
        ("alloc", "P2", 25),
        ("alloc", "P3", 8),
        ("alloc", "P4", 20),
        ("alloc", "P5", 12),
        ("alloc", "P6", 30),
        ("free", "P2", None),
        ("free", "P4", None),
        ("free", "P6", None),
        ("alloc", "P7", 18),   # lands in a DIFFERENT hole depending on strategy
    ]

    for op, owner, size in workload:
        if op == "alloc":
            mem.allocate(owner, size)
        else:
            mem.free(owner)
        mem.print_state(f"After {op}({owner}{', ' + str(size) if size else ''}):")
        print()


if __name__ == "__main__":
    for strategy in ("first_fit", "best_fit", "worst_fit"):
        run_demo(strategy)
```

---

## How to Run

```bash
python3 memory_allocator.py
```

No external dependencies — only `dataclasses` and `typing` from the standard library. The same scripted workload runs against all three strategies back-to-back so you can compare them directly in one output.

---

## Sample Output

This is the actual, verified final state after running the full workload (`python3 memory_allocator.py`) under each strategy — intermediate alloc/free steps are identical across all three (they only diverge at the final `P7` allocation), so only the final state is shown for each:

```
==============================================================================
Strategy: FIRST_FIT   (final state after the full workload)
==============================================================================
  Memory: [PPPPPPPPPPPPPPPP....PPPPP...........PPPPPPP.................]
  Free: 57/105 units across 3 block(s) | largest free block: 30 | external fragmentation: 47%
  Blocks: [0-10) ALLOC:P1 size=10, [10-28) ALLOC:P7 size=18, [28-35) FREE size=7,
          [35-43) ALLOC:P3 size=8, [43-63) FREE size=20,
          [63-75) ALLOC:P5 size=12, [75-105) FREE size=30

==============================================================================
Strategy: BEST_FIT   (final state after the full workload)
==============================================================================
  Memory: [PPPPPP..............PPPPPPPPPPPPPPP.PPPPPPP.................]
  Free: 57/105 units across 3 block(s) | largest free block: 30 | external fragmentation: 47%
  Blocks: [0-10) ALLOC:P1 size=10, [10-35) FREE size=25,
          [35-43) ALLOC:P3 size=8, [43-61) ALLOC:P7 size=18, [61-63) FREE size=2,
          [63-75) ALLOC:P5 size=12, [75-105) FREE size=30

==============================================================================
Strategy: WORST_FIT   (final state after the full workload)
==============================================================================
  Memory: [PPPPPP..............PPPPP...........PPPPPPPPPPPPPPPPP.......]
  Free: 57/105 units across 3 block(s) | largest free block: 25 | external fragmentation: 56%
  Blocks: [0-10) ALLOC:P1 size=10, [10-35) FREE size=25,
          [35-43) ALLOC:P3 size=8, [43-63) FREE size=20,
          [63-75) ALLOC:P5 size=12, [75-93) ALLOC:P7 size=18, [93-105) FREE size=12
```

After freeing P2, P4, and P6, three holes of different sizes exist: 25 units (P2's old spot, leftmost), 20 units (P4's old spot, smallest), and 30 units (P6's old spot, largest/rightmost). All three qualify for the 18-unit `P7` request, and each strategy makes a genuinely different choice:

- **First-Fit** scans left to right and takes the **first** qualifying hole — P2's old 25-unit hole — leaving a 7-unit sliver behind.
- **Best-Fit** scans everything and takes the **smallest** qualifying hole — P4's old 20-unit hole — leaving only a 2-unit sliver (tight fit, minimal waste for this allocation, but a nearly useless leftover).
- **Worst-Fit** scans everything and takes the **largest** qualifying hole — P6's old 30-unit hole — leaving a still-substantial 12-unit remainder.

All three end up with the same total free space (57 units, since the same allocations/frees happened) but a different largest-free-block and different fragmentation percentage — this is the core insight: the choice of placement strategy doesn't change *how much* memory is free, only *how usable* the free memory is for the next request.

---

## Design Notes

- **Blocks are the unit of bookkeeping**, not individual bytes — this mirrors how real allocators (and OS-level contiguous memory allocation) track free/used regions as a list (or tree) of extents rather than a per-byte bitmap, because that's dramatically cheaper for large memory pools.
- **Coalescing (`_coalesce`)** merges adjacent free blocks after every `free()` call — this is what real allocators do to fight fragmentation over time. Comment it out and re-run to see fragmentation get dramatically worse, faster.
- **External vs. internal fragmentation**: this simulator demonstrates **external fragmentation** (enough total free memory, but not contiguous). It does not model **internal fragmentation** (wasted space inside an allocated block due to fixed-size allocation units, e.g., page-based systems) — that's a good extension exercise using fixed-size pages instead of variable-size blocks.
- **Why the three strategies behave differently**: First-Fit is fast (stops at the first candidate) and tends to leave small fragments early in memory. Best-Fit minimizes wasted space per allocation but tends to produce many unusably small slivers over time. Worst-Fit deliberately avoids tight fits, which counter-intuitively can *preserve* one large usable block for longer, at the cost of wasting more space per individual allocation. None of the three is universally best — this is precisely why real allocators (e.g., glibc's `malloc`) use more sophisticated approaches like segregated free lists and buddy allocation.
- **`render()`** gives a rough visual bar so you can eyeball fragmentation without reading the raw block list — useful for building intuition quickly, but the `Blocks:` line is the ground truth since the bar is scaled/rounded for display.

---

## Possible Extensions

1. Implement a **buddy allocator** (power-of-two block sizes, splitting/merging in pairs) and compare its fragmentation behavior against the three strategies here.
2. Add an internal-fragmentation model: allocate memory in fixed-size **pages** (e.g., 4 units each) and round every request up to the nearest page boundary — measure how much space is wasted this way versus the variable-size approach above.
3. Run a long random workload (hundreds of random alloc/free operations with random sizes) and plot (or print, as a table) the fragmentation percentage over time for each strategy.
4. Add a **compaction** operation that shifts all allocated blocks to one end of memory to eliminate external fragmentation entirely — measure the "cost" as the number of bytes moved.
5. Extend `MemoryAllocator` to reject allocations above a configurable per-process quota, simulating a simple memory limit / cgroup-style constraint.
