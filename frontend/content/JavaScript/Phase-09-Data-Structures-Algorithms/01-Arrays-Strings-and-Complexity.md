# Arrays, Strings, and Complexity Analysis — Complete Guide

## Table of Contents
1. [Why Complexity Analysis Matters](#1-why-complexity-analysis-matters)
2. [Big-O Notation](#2-big-o-notation)
3. [Complexity Comparison Table](#3-complexity-comparison-table)
4. [Space Complexity](#4-space-complexity)
5. [Array Fundamentals in JS](#5-array-fundamentals-in-js)
6. [The Two-Pointer Pattern](#6-the-two-pointer-pattern)
7. [The Sliding Window Pattern](#7-the-sliding-window-pattern)
8. [String Manipulation Patterns](#8-string-manipulation-patterns)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Why Complexity Analysis Matters

Every algorithm has a cost — how its running time and memory usage grow as the input grows. A solution that works instantly on 10 items can grind to a halt on 10 million. Complexity analysis gives you a language-independent way to predict that behavior *before* you run the code, so you can choose the right approach up front instead of discovering a performance problem in production.

```
Input size (n) = 10          Input size (n) = 1,000,000
┌─────────────┐              ┌─────────────────────────┐
│ O(n) algo:  │              │ O(n) algo:              │
│ 10 steps    │              │ 1,000,000 steps         │
│ ~instant    │              │ ~instant                │
└─────────────┘              └─────────────────────────┘

┌─────────────┐              ┌─────────────────────────┐
│ O(n²) algo: │              │ O(n²) algo:              │
│ 100 steps   │              │ 1,000,000,000,000 steps │
│ ~instant    │              │ minutes to hours         │
└─────────────┘              └─────────────────────────┘
```

At small `n`, an O(n) and an O(n²) algorithm can feel identical. At scale, the gap becomes the difference between a responsive app and a timeout.

---

## 2. Big-O Notation

Big-O describes the **upper bound** on how an algorithm's running time (or memory) grows relative to input size `n`. It deliberately ignores constants and lower-order terms because they become irrelevant at scale — `O(2n)` and `O(n + 100)` are both just `O(n)`.

### Reading Big-O From Code

```js
// O(1) — constant time. No loop, cost doesn't depend on n.
function firstElement(arr) {
  return arr[0];
}

// O(n) — linear time. One loop over the input.
function sum(arr) {
  let total = 0;
  for (const num of arr) {
    total += num; // n iterations
  }
  return total;
}

// O(n²) — quadratic time. Nested loop over the same input.
function hasDuplicatePair(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) return true; // n * n comparisons
    }
  }
  return false;
}

// O(log n) — logarithmic time. Input is halved each step.
function binarySearch(sortedArr, target) {
  let lo = 0, hi = sortedArr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sortedArr[mid] === target) return mid;
    if (sortedArr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

// O(n log n) — the cost of comparison-based sorting (merge sort, quick sort avg case)
// O(2^n) — exponential time. Naive recursive Fibonacci: each call spawns two more calls.
function fibNaive(n) {
  if (n <= 1) return n;
  return fibNaive(n - 1) + fibNaive(n - 2);
}
```

### Rules for Deriving Big-O

```
1. Drop constants:        O(2n)        → O(n)
2. Drop lower-order terms: O(n² + n)   → O(n²)
3. Different inputs get different variables:
     for a in A: for b in B: ...       → O(a * b), not O(n²)
4. Sequential blocks add, nested blocks multiply:
     for(...) {...}; for(...) {...}    → O(n) + O(n) = O(n)
     for(...) { for(...) {...} }       → O(n) * O(n) = O(n²)
```

---

## 3. Complexity Comparison Table

| Big-O | Name | Example | 10 items | 1,000 items | 1,000,000 items |
|-------|------|---------|----------|--------------|------------------|
| O(1) | Constant | Array index access, hash map get | 1 | 1 | 1 |
| O(log n) | Logarithmic | Binary search, balanced BST operations | 3 | 10 | 20 |
| O(n) | Linear | Single loop, `Array.find`, linear search | 10 | 1,000 | 1,000,000 |
| O(n log n) | Linearithmic | Merge sort, quick sort (avg), efficient sorting | 33 | 9,966 | ~20,000,000 |
| O(n²) | Quadratic | Nested loops, bubble sort, naive duplicate check | 100 | 1,000,000 | 10¹² |
| O(2^n) | Exponential | Naive recursive Fibonacci, subsets/power set | 1,024 | astronomically large | astronomically large |
| O(n!) | Factorial | Brute-force permutations, traveling salesman brute force | 3,628,800 | unusable | unusable |

Ranked from best to worst: `O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ) < O(n!)`.

---

## 4. Space Complexity

Space complexity measures **extra memory** an algorithm uses relative to input size — not counting the input itself.

```js
// O(1) space — a fixed number of variables, regardless of input size
function sum(arr) {
  let total = 0;          // one variable, no matter how big arr is
  for (const n of arr) total += n;
  return total;
}

// O(n) space — allocates a new structure proportional to input size
function double(arr) {
  const result = [];             // grows to size n
  for (const n of arr) result.push(n * 2);
  return result;
}

// O(n) space via the call stack — recursion depth counts as space
function sumRecursive(arr, i = 0) {
  if (i >= arr.length) return 0;
  return arr[i] + sumRecursive(arr, i + 1); // n stack frames at the deepest point
}
```

Recursive solutions often trade space (the call stack) for simpler code. When recursion depth can reach the tens of thousands, an iterative rewrite avoids `RangeError: Maximum call stack size exceeded`.

---

## 5. Array Fundamentals in JS

JavaScript arrays are dynamic, resizable, and can hold mixed types, but the operations you use most often have very different costs:

```
Operation                     Complexity     Why
──────────────────────────────────────────────────────────────────
arr[i]                        O(1)           Direct index into contiguous memory
arr.push(x)                   O(1) amortized Appends at the end; occasional resize
arr.pop()                     O(1)           Removes from the end
arr.unshift(x)                O(n)           Every existing element must shift right
arr.shift()                   O(n)           Every existing element must shift left
arr.splice(i, 1)              O(n)           Elements after index i must shift
arr.indexOf(x) / includes(x)  O(n)           Linear scan, no shortcuts
arr.sort()                    O(n log n)     V8 uses TimSort
```

`push`/`pop` operate at the end and are cheap. `unshift`/`shift` and `splice` operate at (or near) the front and are expensive because every subsequent element must be relocated. This single fact explains why a queue implemented with `Array.shift()` is a common (and costly) beginner mistake — covered in the next lesson.

---

## 6. The Two-Pointer Pattern

The two-pointer pattern uses two index variables that move through a data structure — often from opposite ends, or one ahead of the other — to solve problems in O(n) time that a naive nested-loop approach would solve in O(n²).

### Pattern 1: Opposite Ends (Converging Pointers)

```js
/**
 * Given a sorted array, find two numbers that add up to `target`.
 * Two-pointer approach: O(n) time, O(1) space.
 */
function twoSumSorted(sortedArr, target) {
  let left = 0;
  let right = sortedArr.length - 1;

  while (left < right) {
    const sum = sortedArr[left] + sortedArr[right];
    if (sum === target) {
      return [left, right];
    } else if (sum < target) {
      left++;   // sum too small — need a bigger number, move left pointer up
    } else {
      right--;  // sum too big — need a smaller number, move right pointer down
    }
  }
  return [-1, -1];
}

console.log(twoSumSorted([1, 2, 4, 7, 11, 15], 15)); // [2, 4] → 4 + 11 = 15
```

```
Array:  [1, 2, 4, 7, 11, 15]   target = 15
         L              R      sum = 1+15=16 > 15 → move R left
         L           R         sum = 1+11=12 < 15 → move L right
            L        R         sum = 2+11=13 < 15 → move L right
               L     R         sum = 4+11=15 ✓ found!
```

### Pattern 2: Fast/Slow Pointers (Same Direction)

```js
/**
 * Remove duplicates from a sorted array in-place, returning the new length.
 * `slow` marks the boundary of unique elements written so far.
 * `fast` scans ahead looking for the next distinct value.
 */
function removeDuplicates(arr) {
  if (arr.length === 0) return 0;
  let slow = 0;
  for (let fast = 1; fast < arr.length; fast++) {
    if (arr[fast] !== arr[slow]) {
      slow++;
      arr[slow] = arr[fast];
    }
  }
  return slow + 1; // number of unique elements
}

const nums = [1, 1, 2, 2, 3, 4, 4];
console.log(removeDuplicates(nums), nums.slice(0, 5)); // 4 [1, 2, 3, 4]
```

---

## 7. The Sliding Window Pattern

Sliding window maintains a subrange (`window`) of the array/string that expands and contracts as it scans, avoiding the need to recompute a sum or count from scratch for every subrange — turning an O(n²) or O(n·k) brute force into O(n).

### Fixed-Size Window

```js
/**
 * Find the maximum sum of any contiguous subarray of size k.
 * Brute force: for every starting index, sum k elements → O(n * k).
 * Sliding window: maintain a running sum, add the new element,
 * subtract the one that fell out of the window → O(n).
 */
function maxSubarraySum(arr, k) {
  let windowSum = 0;
  for (let i = 0; i < k; i++) windowSum += arr[i]; // build the first window

  let maxSum = windowSum;
  for (let end = k; end < arr.length; end++) {
    windowSum += arr[end] - arr[end - k]; // slide: add new, remove oldest
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}

console.log(maxSubarraySum([2, 1, 5, 1, 3, 2], 3)); // 9 → [5,1,3]
```

```
arr:  [2, 1, 5, 1, 3, 2]   k = 3

window [2,1,5] sum=8 ─┐
      [1,5,1] sum=7   │  slide right one step at a time:
        [5,1,3] sum=9 │  add arr[end], subtract arr[end-k]
          [1,3,2] sum=6┘
                          max = 9
```

### Variable-Size Window

```js
/**
 * Find the length of the smallest contiguous subarray whose sum is >= target.
 * The window grows by moving `end` forward; it shrinks by moving `start`
 * forward whenever the current window sum already satisfies the condition.
 */
function minSubarrayLen(target, arr) {
  let start = 0;
  let windowSum = 0;
  let minLen = Infinity;

  for (let end = 0; end < arr.length; end++) {
    windowSum += arr[end];
    while (windowSum >= target) {
      minLen = Math.min(minLen, end - start + 1);
      windowSum -= arr[start];
      start++; // shrink from the left
    }
  }
  return minLen === Infinity ? 0 : minLen;
}

console.log(minSubarrayLen(7, [2, 3, 1, 2, 4, 3])); // 2 → [4,3]
```

### Sliding Window on Strings

```js
/**
 * Length of the longest substring without repeating characters.
 * Uses a Map to track the last seen index of each character, and
 * jumps `start` past a repeated character in O(1) instead of
 * shrinking one character at a time.
 */
function lengthOfLongestSubstring(s) {
  const lastSeen = new Map();
  let start = 0;
  let maxLen = 0;

  for (let end = 0; end < s.length; end++) {
    const char = s[end];
    if (lastSeen.has(char) && lastSeen.get(char) >= start) {
      start = lastSeen.get(char) + 1; // jump window start past the duplicate
    }
    lastSeen.set(char, end);
    maxLen = Math.max(maxLen, end - start + 1);
  }
  return maxLen;
}

console.log(lengthOfLongestSubstring("abcabcbb")); // 3 → "abc"
```

---

## 8. String Manipulation Patterns

Strings in JS are immutable — every "modification" creates a new string, so an algorithm that repeatedly concatenates in a loop can silently become O(n²). Prefer arrays for building up output, then `join()` once.

```js
// Anti-pattern: O(n²) — each += creates a new string, copying everything before it
function buildStringSlow(words) {
  let result = "";
  for (const w of words) result += w + " "; // O(n) copy on every iteration
  return result;
}

// Better: O(n) — push is O(1) amortized, join happens once at the end
function buildStringFast(words) {
  const parts = [];
  for (const w of words) parts.push(w);
  return parts.join(" ");
}

/**
 * Check if two strings are anagrams using a frequency map.
 * O(n) time, O(1) space (bounded alphabet size, e.g. 26 letters).
 */
function isAnagram(a, b) {
  if (a.length !== b.length) return false;
  const counts = {};
  for (const ch of a) counts[ch] = (counts[ch] || 0) + 1;
  for (const ch of b) {
    if (!counts[ch]) return false; // missing or already used up
    counts[ch]--;
  }
  return true;
}

console.log(isAnagram("listen", "silent")); // true

/**
 * Reverse a string in place conceptually using two pointers on an array
 * (strings themselves can't be mutated, so we convert first).
 */
function reverseString(str) {
  const chars = str.split("");
  let left = 0, right = chars.length - 1;
  while (left < right) {
    [chars[left], chars[right]] = [chars[right], chars[left]];
    left++;
    right--;
  }
  return chars.join("");
}

console.log(reverseString("hello")); // "olleh"
```

---

## 9. Hands-On Exercises

**Exercise 1:** Write a function `bigOClassify(fn, inputs)` conceptually on paper (not code) — for each of these functions, state its time complexity and justify it in one sentence: (a) a function that returns `arr[arr.length - 1]`, (b) a function with one `for` loop over `arr`, (c) a function with two separate (not nested) `for` loops over `arr`, (d) a function with a `for` loop nested inside another `for` loop over the same array, (e) `binarySearch` from Section 2. Write your answers as comments above each function.

**Exercise 2:** Implement `twoSumUnsorted(arr, target)` for an **unsorted** array using a hash map to achieve O(n) time (you cannot use the two-pointer converging approach directly since the array isn't sorted). Compare it against a brute-force O(n²) nested-loop version — write both, and add a comment explaining the space/time trade-off between them.

**Exercise 3:** Implement `maxSubarraySumBruteForce(arr, k)` using nested loops (recompute the sum from scratch for every window), then implement the sliding-window version from Section 7 and time both with `console.time`/`console.timeEnd` on an array of 100,000 random numbers with `k = 1000`. Record the measured difference.

**Exercise 4:** Implement `longestUniqueSubstring` variants: extend `lengthOfLongestSubstring` from Section 7 to also return the actual substring (not just its length), by tracking the best `start`/`end` indices seen so far.

**Exercise 5:** Implement `isPalindrome(str)` using the two-pointer pattern, ignoring case and non-alphanumeric characters (e.g. `"A man, a plan, a canal: Panama"` should return `true`). Then write `isPalindromeSlow(str)` that reverses the string and compares it to the original, and explain in a comment why the two-pointer version uses O(1) extra space while the reverse-and-compare version uses O(n).

---

## 10. Interview Q&A

**Q: What is Big-O notation and why do we drop constants and lower-order terms?**
Answer: Big-O notation describes the upper-bound growth rate of an algorithm's running time or space usage as a function of input size `n`, ignoring machine-specific constants. We drop constants and lower-order terms because Big-O is meant to describe asymptotic behavior — how the algorithm scales as `n` gets arbitrarily large — and at that scale, a term like `2n` behaves the same as `n`, and `n² + n` behaves the same as `n²` because the `n²` term dominates. This abstraction lets us compare algorithms independent of hardware, language, or specific constant factors, focusing on the shape of the growth curve rather than a single measurement.

**Q: Why is `Array.prototype.unshift()` an O(n) operation, while `push()` is O(1) amortized?**
Answer: JavaScript arrays are typically implemented as contiguous (or contiguous-like) memory structures under the hood. `push()` adds an element after the last used slot — no other element needs to move, so it's O(1) on average (occasionally the engine needs to grow the backing storage, but this is amortized across many pushes). `unshift()` inserts at index 0, which means every existing element must be shifted one position to the right to make room, an O(n) operation. The same reasoning applies to `shift()` (O(n), shifts everything left) versus `pop()` (O(1), no shifting needed). This is why using an array as a queue with `push`/`shift` is a common performance mistake — `shift()` silently makes every dequeue O(n).

**Q: Walk through how the two-pointer pattern reduces a two-sum problem from O(n²) to O(n) on a sorted array.**
Answer: A brute-force solution checks every pair of indices with nested loops, giving O(n²) comparisons. On a *sorted* array, we can instead place one pointer at the start and one at the end. If the sum of the two pointed-at values is too small, we know we need a larger value, so we move the left pointer right (since the array is sorted, everything to the right is larger). If the sum is too large, we move the right pointer left. Each step eliminates at least one candidate pair permanently and moves a pointer forward, so the pointers can move at most `n` times combined before they meet — giving O(n) time and O(1) extra space, versus the O(n²) time (and typically O(n) extra space if you used a hash map instead) of the brute-force approach.

**Q: What's the difference between the sliding window pattern and the two-pointer pattern?**
Answer: Both use index variables that move through a structure without backtracking, and in fact sliding window is often implemented *with* two pointers (a `start` and an `end`). The distinction is conceptual: two-pointer problems are usually about finding a *pair* of elements satisfying some condition (often from opposite ends of a sorted structure), while sliding window problems are about finding an optimal *contiguous subrange* (subarray or substring) satisfying some condition, where the window expands by moving one pointer forward and contracts by moving the other pointer forward, maintaining some running aggregate (a sum, a character count map) incrementally rather than recomputing it from scratch for every window.

**Q: Why can naive string concatenation in a loop become an accidental performance bug?**
Answer: Strings in JavaScript are immutable — every `str += x` doesn't modify `str` in place, it allocates an entirely new string and copies the old contents plus the addition into it. If you do this inside a loop that runs `n` times, and each concatenation copies a string whose length is proportional to how much you've built so far, the total cost becomes 1 + 2 + 3 + ... + n, which is O(n²), not O(n) as it might look at a glance. The fix is to push each piece into an array (an O(1) amortized operation) and call `.join("")` once at the end, which builds the final string in a single O(n) pass instead of `n` incremental O(n) copies.
