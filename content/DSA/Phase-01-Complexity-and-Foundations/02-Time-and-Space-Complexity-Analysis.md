# Time and Space Complexity Analysis

## 1. Problem

Knowing the names of complexity classes (O(1), O(n), O(n²)...) is useless if you can't look at a piece of *your own code* and figure out which class it belongs to. In an interview, you'll write a solution with a few nested loops or a recursive call, and the very next question is "what's the time and space complexity?" — you need a repeatable, mechanical method to derive this from the code itself, not just recognize it from a textbook list.

There's a second, sneakier problem: some operations that *look* expensive in isolation (like resizing an array) are actually cheap *on average* over a long sequence of operations. If you analyze each operation in isolation, you'll wrongly conclude Python's `list.append()` is O(n) instead of its true O(1) amortized cost — a mistake that can lead you to "optimize" code that was already optimal, or worse, misjudge a real bottleneck.

## 2. Analogy

Think of time complexity analysis like counting steps in a recipe: if a recipe says "for each of the n eggs, whisk it 3 times," that's `3n` whisks — linear in eggs. If it says "for each egg, compare it against every other egg for freshness," that's `n × n` comparisons — quadratic. Counting complexity from code is the same: loops are "for each X, do Y," and nested loops multiply.

Space complexity is like asking "how much counter space does this recipe need *beyond* the ingredients themselves?" — a recipe that needs one extra bowl no matter how many eggs you have is O(1) *auxiliary* space; a recipe that needs one bowl per egg is O(n) auxiliary space.

Amortized analysis is like a gym membership billed annually but paid monthly: some months you use the gym heavily, but averaged over the year, the cost per visit is small and predictable — even though a few individual "visits" (resize operations) look expensive up close.

## 3. Internal Flow

**Deriving time complexity from code:**

1. Find every loop and recursive call — these are the only places "work" can repeat.
2. For a single loop that runs `n` times doing O(1) work per iteration → O(n).
3. For nested loops, multiply the iteration counts — but check whether the inner loop's range depends on the outer loop's variable. A loop like `for j in range(i)` inside `for i in range(n)` does NOT run `n` iterations every time; it runs `0, 1, 2, ..., n-1` iterations across the full outer loop, summing to `n(n-1)/2`, which is still O(n²) *in total*, not O(n) per call.
4. For recursive calls, express the number of "unit operations" as a recurrence (covered fully in **04-Recurrence-Relations-and-Master-Theorem**) — e.g., a function that recurses once on `n-1` does O(n) total calls; a function that recurses twice on `n-1` does O(2ⁿ) total calls.
5. Add complexities for sequential blocks of code (e.g., a loop followed by another loop is O(n) + O(n) = O(n), not O(n²)); multiply for nested ones.

**Deriving space complexity:**

1. **Input space** — the memory used to store the input itself. Usually excluded from complexity discussions since you don't control it.
2. **Auxiliary space** — extra memory your algorithm allocates: new arrays, hash maps, or (critically) the **call stack** for recursive functions. Each recursive call pushes a new stack frame holding its own local variables — a recursion that goes `n` levels deep uses O(n) auxiliary space, even if it doesn't allocate a single explicit variable.
3. Total space complexity = input space + auxiliary space, but interviewers almost always want auxiliary space when they ask "what's the space complexity?"

**Amortized analysis** answers: "what is the *average* cost per operation across a whole sequence of operations, even though individual operations vary wildly in cost?" The classic example is a dynamic array's `append`: most appends are O(1) (just place the item in existing free space), but occasionally the array is full and must be resized — copying all `n` existing elements to a new, larger array, an O(n) operation. Because resizes happen less and less frequently as the array grows (if you double the capacity each time), the *total* cost of `n` appends is still O(n), making the *amortized* cost per append O(1).

## 4. Example

Here's a manual, from-scratch dynamic array that doubles its capacity on resize, with instrumentation to trace the amortized cost:

```python
class DynamicArray:
    def __init__(self):
        self.capacity = 1
        self.size = 0
        self.data = [None] * self.capacity
        self.total_copies = 0  # tracks total "expensive" work done

    def append(self, value):
        if self.size == self.capacity:
            self._resize()
        self.data[self.size] = value
        self.size += 1

    def _resize(self):
        old_capacity = self.capacity
        self.capacity *= 2
        new_data = [None] * self.capacity
        for i in range(self.size):
            new_data[i] = self.data[i]
            self.total_copies += 1  # each copy is one unit of "expensive" work
        self.data = new_data
        print(f"  [resize] capacity {old_capacity} -> {self.capacity}, copied {self.size} elements")


arr = DynamicArray()
n = 16
for i in range(n):
    arr.append(i)

print(f"\nAppended {n} items")
print(f"Total copy operations across all resizes: {arr.total_copies}")
print(f"Amortized cost per append: {arr.total_copies / n:.2f} copy-operations/append")
```

Output:

```
  [resize] capacity 1 -> 2, copied 1 elements
  [resize] capacity 2 -> 4, copied 2 elements
  [resize] capacity 4 -> 8, copied 4 elements
  [resize] capacity 8 -> 16, copied 8 elements

Appended 16 items
Total copy operations across all resizes: 15
Amortized cost per append: 0.94 copy-operations/append
```

Trace the math: resizes happen at sizes 1, 2, 4, 8 — copying `1 + 2 + 4 + 8 = 15` elements total across all 16 appends. This is a geometric series that sums to roughly `2n`, so the *total* work for `n` appends is O(n), and dividing by `n` appends gives O(1) amortized cost per append — even though the individual resize operations themselves are each O(n) in isolation. This is why you can trust `list.append()` in Python to behave like O(1) in almost all practical scenarios.

## 5. Compare

- This lesson builds directly on **01-Big-O-Big-Theta-Big-Omega** — here you learn *how to derive* the bound that lesson taught you to *name and compare*.
- Recursive space analysis here (call stack = O(depth) space) is expanded fully in **03-Recursion-Basics**, where you'll see the stack grow and shrink frame by frame.
- The nested-loop counting technique here (summing `0 + 1 + ... + (n-1)`) is the same summation formula covered in **05-Math-Prerequisites-for-DSA** — that lesson gives you the algebraic tool (`n(n-1)/2`) this lesson uses informally.
- Amortized analysis reappears later in the course whenever you meet data structures with occasional expensive rebalancing operations (e.g., certain hash table resizes, some balanced-tree rotations).

## 6. Common Mistakes

- **Forgetting that recursive call stacks count as space.** A recursive function with no explicit arrays or lists can still be O(n) space purely because of stack depth — people often report "O(1) space" for a recursive solution just because they didn't allocate anything themselves.
- **Miscounting nested loops that don't run the full range.** Seeing `for j in range(i)` nested inside `for i in range(n)` and reading it as "the inner loop is O(n) per call, and the outer loop runs n times, so it must be O(n) total" — this is wrong. The inner loop's iteration count *changes* with `i`, so you must sum `0 + 1 + 2 + ... + (n-1) = n(n-1)/2`, which is O(n²) total, not O(n).
- **Analyzing amortized operations by their single worst-case cost.** Concluding `append` is O(n) because you saw one resize happen is analyzing in isolation instead of across the whole sequence — the correct question is "what's the total cost of `n` operations, divided by `n`?"
- **Confusing input space with auxiliary space.** Reporting "O(n) space" for an in-place sorting algorithm because the input array itself is size `n` — when the interviewer is asking about *extra* space beyond the input, which for an in-place sort is O(1).
- **Adding complexities where you should multiply, or vice versa.** Two sequential loops over the same input add (O(n) + O(n) = O(n)); two nested loops multiply (O(n) × O(n) = O(n²)). Mixing these up is one of the most common code-reading errors.

## 7. Interview Angle

Interviewers expect you to narrate your complexity derivation out loud as you write code, not bolt it on at the end. Typical prompts:

- "Walk me through why this is O(n log n)" — they want the loop/recursion-counting process, not just the final label.
- "What's the space complexity, including the call stack?" — a direct test of whether you remember that recursion has a memory cost.
- "You said `append` is O(1) — is that always true?" — a direct test of amortized analysis; the expected answer is "O(1) amortized, though any single call can be O(n) during a resize."
- Follow-up variation: "Can you reduce the space complexity from O(n) to O(1)?" — often pushes you toward in-place techniques (two pointers, swapping) instead of allocating auxiliary structures.

## 8. Memory Hook

**Loops add when sequential, multiply when nested — recursion spends memory on the way down and time on the way up. And "amortized" just means: total cost of everything, divided by number of operations — not the cost of the one expensive operation you happened to notice.**
