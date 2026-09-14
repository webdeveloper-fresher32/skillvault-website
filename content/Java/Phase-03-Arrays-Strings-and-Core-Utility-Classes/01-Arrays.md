# 01 — Arrays

> A comprehensive reference covering why arrays exist, how they're laid out and indexed, iterating over them safely, multi-dimensional arrays, and the off-by-one mistakes that trip up almost every newcomer.

---

## Table of Contents

1. [The Problem: Five Variables Don't Scale](#1-the-problem-five-variables-dont-scale)
2. [The Analogy: A Row of Numbered Mailboxes](#2-the-analogy-a-row-of-numbered-mailboxes)
3. [How Arrays Actually Work](#3-how-arrays-actually-work)
4. [Multi-Dimensional Arrays](#4-multi-dimensional-arrays)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. The Problem: Five Variables Don't Scale

Imagine you're writing a program to track 5 quiz scores. The obvious first move is to declare 5 separate variables:

```java
int score1 = 85;
int score2 = 92;
int score3 = 78;
int score4 = 90;
int score5 = 88;
```

This "works," but only barely. What happens when there are 50 scores, or 5,000? You can't write 5,000 variable declarations, and even if you could, there's no way to write a loop that says "do this for each score" — a loop needs something it can step through by index, and `score1`, `score2`, `score3` are just five unrelated names to the compiler, with no notion of "next." The core problem: **how do you store a variable-but-known number of related values under one name, so you can access any one of them by position and loop over all of them?**

---

## 2. The Analogy: A Row of Numbered Mailboxes

**Real-world analogy:** picture a wall of numbered mailboxes at an apartment building — mailbox 0, mailbox 1, mailbox 2, and so on. The building installs a *fixed* number of them when the wall is built; you can't add a 21st mailbox to a 20-slot wall without literally rebuilding the wall. But within that fixed layout, anyone can walk up and go directly to "mailbox 7" without checking every other box first — the numbering makes every box instantly and directly reachable.

**An array is that wall of mailboxes.** Its size is fixed the moment it's created, every "box" (element) holds the same fixed type of value, and every box is reached directly by its number — its **index** — rather than by searching.

---

## 3. How Arrays Actually Work

An array in Java is a fixed-size, ordered collection of elements, all of the same type, stored in one contiguous block of memory. You create one in two common ways:

```java
int[] scores = new int[5];       // an array of 5 ints, all defaulting to 0
int[] moreScores = {85, 92, 78}; // an array literal — size 3, values given directly
```

`new int[5]` allocates space for exactly 5 `int` values and fills every slot with the default value for `int` (`0`). You cannot resize this array later — "adding a 6th score" means creating an entirely new, bigger array and copying the old values into it (which is exactly what classes like `ArrayList`, covered in Phase 4, do automatically for you).

Every array uses **zero-based indexing** — the first element is at index `0`, not `1`. For an array of length 5, the valid indices are `0, 1, 2, 3, 4` — index `5` does not exist and accessing it is an error (covered below). Every array also carries a `.length` **field** — not a method, so it's `scores.length`, with no parentheses. This trips up almost everyone coming from a language where "length" is a method call, and it's especially confusing in Java because `String` (Phase 3, Lesson 2) *does* use a `.length()` method — the two are genuinely different mechanisms that happen to look almost identical.

```java
int[] scores = new int[5];
scores[0] = 85;
scores[1] = 92;
scores[2] = 78;
scores[3] = 90;
scores[4] = 88;

int total = 0;
for (int i = 0; i < scores.length; i++) {
    total += scores[i];
}
double average = (double) total / scores.length;
System.out.println("Average: " + average);
// Output: Average: 86.6
```

Trace through it: `total` accumulates `85 + 92 + 78 + 90 + 88 = 433`. Dividing `433 / scores.length` (`433 / 5`) as plain `int` division would truncate to `86` — so the code casts `total` to `double` first, forcing floating-point division, giving the correct `86.6`.

---

## 4. Multi-Dimensional Arrays

Java doesn't have true multi-dimensional arrays built into the language the way some languages do — instead, a "2D array" is really an **array of arrays**: an outer array where each element is itself an array. A simple 3×3 grid looks like this:

```java
int[][] grid = {
    {1, 2, 3},
    {4, 5, 6},
    {7, 8, 9}
};

System.out.println(grid[0][0]); // 1  (row 0, col 0)
System.out.println(grid[1][2]); // 6  (row 1, col 2)
System.out.println(grid[2][1]); // 8  (row 2, col 1)

for (int row = 0; row < grid.length; row++) {
    for (int col = 0; col < grid[row].length; col++) {
        System.out.print(grid[row][col] + " ");
    }
    System.out.println();
}
// Output:
// 1 2 3
// 4 5 6
// 7 8 9
```

`grid[row]` accesses the outer array's element at `row`, which is itself an `int[]` — so `grid[row][col]` first fetches that inner array, then indexes into it. This is also why `grid[row].length` (the inner array's own length) is used in the inner loop rather than assuming every row has the same length — Java technically allows "jagged" arrays where rows have different lengths, though a rectangular grid like this one keeps them uniform.

You can also loop with the enhanced **for-each loop**, which reads "for each element in this array" without manually tracking an index at all — useful when you don't need the index itself, only the value:

```java
for (int score : scores) {
    System.out.println(score);
}
```

---

**Comparison — classic `for` loop vs enhanced for-each loop:**

| | Classic `for` loop | Enhanced for-each loop |
|---|---|---|
| **Access to index** | Yes — you control `i` directly | No — only the value, not its position |
| **Can modify array elements** | Yes — `scores[i] = ...` | No — the loop variable is a copy, reassigning it doesn't touch the array |
| **Best for** | Needing the index (e.g. "print index 2 differently"), or modifying elements in place | Simply visiting every element to read it |

**Common mistakes:**
- Looping with `i <= scores.length` instead of `i < scores.length` — since valid indices only go up to `length - 1`, using `<=` reads one past the end and throws `ArrayIndexOutOfBoundsException` at runtime.
- Confusing `.length` (a field, used on arrays, no parentheses) with `.length()` (a method, used on `String`, Phase 3 Lesson 2) — mixing them up is a compile error, not a silent bug, but it's a constant early stumbling block.

**Interview angle:** Interviewers often probe whether you understand *why* arrays are fixed-size — the honest answer is that the JVM allocates one contiguous block of memory sized exactly for the declared length at creation time, so "resizing" fundamentally means allocating a brand-new block and copying everything over, which is precisely what `ArrayList` does under the hood (Phase 4). Being able to explain that connection — array as the fixed-size foundation collections are built on top of — signals real understanding, not memorized syntax.

---

## 5. Hands-On Exercises

### Exercise 1 — Find the maximum

Write a program that declares an `int[]` of at least 6 values, loops through it with a classic `for` loop, and prints the largest value found. Do not use any built-in "max" method — track the largest value seen so far manually as you loop.

### Exercise 2 — Reverse in place

Given an `int[]` of 5 values, write a loop that reverses the array's contents *in place* (without creating a second array) by swapping elements from the two ends toward the middle. Print the array before and after to confirm it worked.

### Exercise 3 — Build and sum a 2D grid

Create a `3x4` two-dimensional `int` array, fill it with any values using nested loops, then write a separate nested loop that computes and prints the sum of all elements in the grid.

---

## 6. Interview Q&A

### Q1. Why are arrays fixed in size in Java?

**Answer:** An array is allocated as one contiguous block of memory sized exactly for its declared length at creation time. There's no guaranteed free space reserved next to it to grow into, so "resizing" isn't something the JVM can do in place — you'd have to allocate an entirely new, larger block and copy the old elements into it, which is exactly what dynamic structures like `ArrayList` do automatically under the hood.

---

### Q2. What's the difference between `array.length` and `string.length()`?

**Answer:** `.length` on an array is a field — a piece of data baked into every array object recording how many elements it holds — accessed with no parentheses. `.length()` on a `String` is a method call that computes/returns the number of characters. They look similar but are different mechanisms on different types, and using the wrong one for a given type is a compile error.

---

### Q3. What happens if you access an index equal to or greater than an array's length?

**Answer:** Java throws an `ArrayIndexOutOfBoundsException` at runtime. Unlike some languages, Java always performs bounds checking on array access — it will never silently read garbage memory past the end of the array, it fails loudly and immediately instead.

---

### Q4. Is a Java 2D array truly two-dimensional, like a single rectangular memory block?

**Answer:** No — Java represents a "2D array" as an array of arrays: an outer array whose elements are themselves separate array objects. This means each "row" is technically an independent array, which is also why Java allows jagged arrays (rows of different lengths), even though most everyday uses keep every row the same length for a clean rectangular grid.

---

### Q5. When would you prefer a classic `for` loop over an enhanced for-each loop?

**Answer:** Whenever you need the index itself — to print it, to compare neighboring elements, or to modify the array's contents in place. A for-each loop only exposes each element's value as a read-only copy in the loop variable; reassigning that variable never changes the underlying array.

---

> 🧠 **Memory hook:** "Zero-based mailboxes, fixed at build time — `.length` is the field on the wall, not a phone call you make."
