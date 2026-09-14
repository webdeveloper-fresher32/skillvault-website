# Phase 11: Time and Space Complexity Analysis

## Why This Phase Matters

Time complexity gets most of the interview attention, but space complexity — how much extra memory an algorithm needs — is just as often the deciding factor in a real system, and just as often asked as a follow-up question ("can you do this in-place?" / "what's the space complexity of your recursive solution?"). Understanding the *tradeoff* between the two — spending memory to save time, or vice versa — is what separates an engineer who can write correct code from one who can write code that scales.

This phase covers how to measure space the same rigorous way you measure time, walks through the classic time-space tradeoff with runnable, timed Python code (naive vs. memoized Fibonacci), and finishes with amortized analysis — the subtle reasoning behind why an operation that's "occasionally slow" (like Python list `append`) is still correctly described as O(1).

## What You'll Learn

| # | Lesson | Core Idea |
|---|--------|-----------|
| 01 | Space Complexity | Auxiliary vs input space, in-place vs new-array-returning functions, recursive call stack space |
| 02 | Time-Space Tradeoffs | Trading memory for speed via memoization/hashmaps — naive vs. memoized Fibonacci, timed and compared |
| 03 | Amortized Analysis | Why Python's list `append` is O(1) amortized despite occasional O(n) resizes |

## Prerequisites

- Phase 10 (Big-O Notation) — this phase builds directly on Big-O vocabulary and worst-case reasoning.
- Comfortable reading basic Python (loops, recursion, lists, dictionaries).

## How to Study This Phase

1. Read lesson 01 first to build a precise vocabulary for space (auxiliary space vs total space).
2. Run every code example in lesson 02 yourself — the timing numbers are the whole point; seeing exponential blowup and then a memoized fix side by side is far more convincing than reading about it.
3. For lesson 03, work through the doubling-array arithmetic on paper before reading the conclusion.
4. Do the Hands-On Exercises at the end of each lesson before moving on.
5. Use the Interview Q&A sections as flash cards during interview prep.

## Time Estimate

Roughly 2–3 hours total, including exercises.

---

Next phase: **Phase-12-Interview-Prep**
