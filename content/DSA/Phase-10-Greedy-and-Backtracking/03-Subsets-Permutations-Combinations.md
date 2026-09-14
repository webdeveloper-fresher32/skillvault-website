# Subsets, Permutations, and Combinations

## 1. Problem

Three closely related enumeration problems come up constantly in interviews and real code, and they're often confused with each other despite having distinct structures and distinct backtracking templates:

- **Subsets (the power set)** — given a set of `n` distinct elements, generate *every* possible subset, including the empty set and the full set. There are `2^n` of them, because each element independently is either **in** or **out**.
- **Permutations** — given `n` distinct elements, generate every possible *ordering* of all `n` of them. There are `n!` of them, because each position in the output can be filled by any element not yet used.
- **Combinations of size k** — given `n` distinct elements, generate every possible *unordered* selection of exactly `k` of them. There are `C(n, k) = n! / (k!(n-k)!)` of them, and the tricky part is avoiding the same combination appearing multiple times just because its elements were chosen in a different order.

All three are solved with backtracking, but the *shape* of the recursion differs in a way that matters: subsets branch on **include/exclude** at every element, permutations branch on **which unused element to place next**, and combinations branch on **which element to pick next starting from a fixed point**, so as never to reconsider an element that's already been passed over.

## 2. Analogy

Imagine three different ways of raiding a fridge with distinct items in it: (1) walking past every item once and deciding "eat it or don't" — that's subsets, one independent yes/no per item, `2^n` outcomes. (2) Deciding the *exact order* in which you'll eat everything in the fridge — that's permutations, every arrangement of every item counts as different, `n!` outcomes. (3) Picking exactly `k` items to put on one plate, where a plate with (apple, banana) is the *same* plate as (banana, apple) — that's combinations; to avoid listing the same plate twice, you always fill the plate by scanning forward from where you last picked, never doubling back to reconsider an item you've already walked past.

## 3. Internal Flow

**Subsets via include/exclude recursion.** At each index `i` in the input, the recursion tree branches exactly two ways: include `nums[i]` in the current path and recurse to `i+1`, or exclude it and recurse to `i+1` — with no other decision at any node. After `n` such binary decisions, a leaf is reached and the accumulated path is a complete subset. Since there are `n` binary decisions, there are exactly `2^n` leaves, i.e. `2^n` subsets, matching the total count.

**Permutations via used-tracking recursion.** At each position in the output, the recursion tries *every element not yet used* (tracked via a `used[]` array or equivalent), placing it, recursing to fill the next position, and then un-marking it as used when that branch returns. The branching factor shrinks by one at each level (`n`, then `n-1`, then `n-2`, ...), which is exactly why the total leaf count is `n!`.

**Combinations via a start-index parameter.** At each step, the recursion tries every element from a `start` index onward (not from the beginning), and when it recurses to pick the *next* element of the combination, it passes `start = i + 1` — never `start = 0`. This guarantees each combination is only ever built in one strictly-increasing index order, so `{1, 2}` is generated once (as index 0 then index 1) and `{2, 1}` (index 1 then index 0) is never generated at all, because by the time index 1 is chosen first, `start` has already moved past index 0.

**The shared pattern underneath all three.** All three are the same choose-explore-unchoose loop from backtracking: append to a shared `path` list (choose), recurse deeper (explore), then `pop()` the path back to its prior state (unchoose) before trying the next option at that level. The only thing that differs is *what* varies across siblings at a given recursion level — include-vs-exclude for subsets, "which unused element" for permutations, "which next-index element" for combinations.

## 4. Example

**Example A — Subsets, coded and traced.** `subsets([1, 2, 3])` via include/exclude recursion:

```python
def subsets(nums):
    result = []
    path = []

    def backtrack(i):
        if i == len(nums):
            result.append(path[:])   # copy! not the same list reference
            print(f"depth={i}: leaf reached -> record {path[:]}")
            return
        # include nums[i]
        path.append(nums[i])
        print(f"depth={i}: INCLUDE {nums[i]} -> path={path}")
        backtrack(i + 1)
        path.pop()
        # exclude nums[i]
        print(f"depth={i}: EXCLUDE {nums[i]} -> path={path}")
        backtrack(i + 1)

    backtrack(0)
    return result


nums = [1, 2, 3]
result = subsets(nums)
print()
print(f"All subsets of {nums} ({len(result)} total, expect 2^{len(nums)}={2**len(nums)}):")
for s in result:
    print(s)
```

Actual output:

```text
depth=0: INCLUDE 1 -> path=[1]
depth=1: INCLUDE 2 -> path=[1, 2]
depth=2: INCLUDE 3 -> path=[1, 2, 3]
depth=3: leaf reached -> record [1, 2, 3]
depth=2: EXCLUDE 3 -> path=[1, 2]
depth=3: leaf reached -> record [1, 2]
depth=1: EXCLUDE 2 -> path=[1]
depth=2: INCLUDE 3 -> path=[1, 3]
depth=3: leaf reached -> record [1, 3]
depth=2: EXCLUDE 3 -> path=[1]
depth=3: leaf reached -> record [1]
depth=0: EXCLUDE 1 -> path=[]
depth=1: INCLUDE 2 -> path=[2]
depth=2: INCLUDE 3 -> path=[2, 3]
depth=3: leaf reached -> record [2, 3]
depth=2: EXCLUDE 3 -> path=[2]
depth=3: leaf reached -> record [2]
depth=1: EXCLUDE 2 -> path=[]
depth=2: INCLUDE 3 -> path=[3]
depth=3: leaf reached -> record [3]
depth=2: EXCLUDE 3 -> path=[]
depth=3: leaf reached -> record []

All subsets of [1, 2, 3] (8 total, expect 2^3=8):
[1, 2, 3]
[1, 2]
[1, 3]
[1]
[2, 3]
[2]
[3]
[]
```

The recursion tree is exactly 3 levels deep (one per element) and always reaches a leaf — there's no pruning here, since every include/exclude choice is always "valid"; the tree's shape *is* the answer.

**Example B — Permutations, coded and traced.** `permutations([1, 2, 3])` via used-tracking recursion:

```python
def permutations(nums):
    result = []
    path = []
    used = [False] * len(nums)

    def backtrack():
        if len(path) == len(nums):
            result.append(path[:])
            print(f"depth={len(path)}: leaf reached -> record {path[:]}")
            return
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True
            path.append(nums[i])
            print(f"depth={len(path)-1}: CHOOSE {nums[i]} -> path={path}")
            backtrack()
            path.pop()
            used[i] = False
            print(f"depth={len(path)}: UNCHOOSE {nums[i]} -> path={path}")

    backtrack()
    return result


nums = [1, 2, 3]
result = permutations(nums)
print()
print(f"All permutations of {nums} ({len(result)} total, expect {len(nums)}!={1*2*3}):")
for p in result:
    print(p)
```

Actual output (first branch shown in full; the pattern repeats for the other two starting elements):

```text
depth=0: CHOOSE 1 -> path=[1]
depth=1: CHOOSE 2 -> path=[1, 2]
depth=2: CHOOSE 3 -> path=[1, 2, 3]
depth=3: leaf reached -> record [1, 2, 3]
depth=2: UNCHOOSE 3 -> path=[1, 2]
depth=1: UNCHOOSE 2 -> path=[1]
depth=1: CHOOSE 3 -> path=[1, 3]
depth=2: CHOOSE 2 -> path=[1, 3, 2]
depth=3: leaf reached -> record [1, 3, 2]
depth=2: UNCHOOSE 2 -> path=[1, 3]
depth=1: UNCHOOSE 3 -> path=[1]
depth=0: UNCHOOSE 1 -> path=[]
...

All permutations of [1, 2, 3] (6 total, expect 3!=6):
[1, 2, 3]
[1, 3, 2]
[2, 1, 3]
[2, 3, 1]
[3, 1, 2]
[3, 2, 1]
```

Notice the branching factor at depth 0 is 3 (any of 1, 2, 3 can go first), but at depth 1 it's only 2 (whichever two elements are still unused) — that shrinking branching factor (3, then 2, then 1) is exactly `3! = 6`.

**Combinations of size k, via start-index (verified by direct execution):**

```python
def combinations(nums, k):
    result = []
    path = []

    def backtrack(start):
        if len(path) == k:
            result.append(path[:])
            return
        for i in range(start, len(nums)):
            path.append(nums[i])
            backtrack(i + 1)   # next call starts AFTER i, avoiding duplicate orders
            path.pop()

    backtrack(0)
    return result


nums = [1, 2, 3, 4]
print(f"combinations({nums}, 2):")
for c in combinations(nums, 2):
    print(c)
```

Actual output:

```text
combinations([1, 2, 3, 4], 2):
[1, 2]
[1, 3]
[1, 4]
[2, 3]
[2, 4]
[3, 4]
```

Exactly `C(4, 2) = 6` combinations, each in strictly increasing index order — `[2, 1]` never appears, because once index 0 is skipped in favor of starting at index 1, the recursion can never go back for it.

## 5. Compare

| | Subsets | Permutations | Combinations (size k) |
|---|---|---|---|
| **Branch on** | include / exclude each element | which unused element goes next | which next element (from `start` onward) |
| **Recursion depth** | always `n` | always `n` | always `k` |
| **Order matters?** | no (a subset is a set) | yes (order defines distinct outputs) | no (must be de-duplicated via `start`) |
| **Total count** | `2^n` | `n!` | `C(n, k)` |
| **Extra state needed** | none beyond the path | a `used[]` tracker | just the `start` index |

The confusion candidates run into is treating all three as "the same kind of backtracking with a different base case" — the base case is similar, but *what varies between sibling branches* is genuinely different in each, and getting that wrong (e.g. using a `used[]` tracker for combinations instead of a start index) produces duplicate combinations in different orders instead of the deduplicated set expected.

## 6. Common Mistakes

- **Not passing a start-index for combinations.** If the combinations recursion iterates from `0` every time instead of from `start`, the same combination gets generated once per ordering of its elements — `[1, 2]` and `[2, 1]` both appear as "different" results when they should count as one. The fix is always to recurse with `start = i + 1`, never `start = 0`.
- **Mutating a shared list without copying before appending to results.** `result.append(path)` (no `[:]` or `list(path)`) stores a *reference* to the same list object that the recursion keeps mutating with further `append`/`pop` calls. By the time the recursion finishes, every entry in `result` points at the *same* now-empty (or wrongly-populated) list — a classic bug where the output looks like a list of empty lists (or all-identical lists) instead of distinct subsets/permutations/combinations. Verified directly: a buggy version of the subsets code that does `result.append(path)` instead of `result.append(path[:])` produces `[[], [], [], [], [], [], [], []]` — eight entries, all correctly *counted*, but every single one is the same corrupted empty list instead of eight distinct subsets.
- **Reusing the same `used[]` array across independent top-level calls** without resetting it, leaking "used" state from a previous run into a new one.
- **Confusing combinations with permutations of a subset** — e.g. writing a `used[]`-based recursion (permutation-style) when the problem actually wants combinations, which silently produces `k!` times too many results (every ordering of every valid combination) instead of the deduplicated set.

## 7. Interview Angle

These three are often chained together in a single interview ("now generate all permutations," "now what if I only want combinations of size k") specifically to see whether a candidate treats backtracking as one flexible template rather than three memorized snippets. The mutation-without-copying bug (`result.append(path)` vs `result.append(path[:])`) is one of the most common silent-failure bugs interviewers watch for — code that "runs" and returns the right *count* of results while every result is actually the same wrong list is a classic trap that separates candidates who deeply understand Python's reference semantics from those who don't. A common escalation is "subsets/combinations with duplicate elements in the input" (e.g. `[1, 2, 2]`), which requires sorting first and skipping over a duplicate value at the same recursion depth to avoid duplicate *subsets* — a different (and commonly confused) concern from the start-index technique that prevents duplicate *combinations* of distinct elements.

## 8. Memory Hook

**"Include/exclude for subsets, used-tracking for permutations, start-index for combinations — and always copy the path before you keep it."** Three different branching rules produce three different counts (`2^n`, `n!`, `C(n,k)`), but all three backtrack the same way: choose, recurse, unchoose — and never hand out a live reference to the list you're still mutating.
