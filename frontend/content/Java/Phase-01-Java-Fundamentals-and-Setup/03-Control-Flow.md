# 03 — Control Flow

> A comprehensive reference covering `if`/`else`, the classic `switch` statement and its fallthrough behavior, `for`/`while`/`do-while` loops, and `break`/`continue`.

---

## Table of Contents

1. [The Problem: A Program That Never Branches Isn't Useful](#1-the-problem-a-program-that-never-branches-isnt-useful)
2. [The Analogy: A Flowchart Drawn in Code](#2-the-analogy-a-flowchart-drawn-in-code)
3. [Branching: if, else if, else, and switch](#3-branching-if-else-if-else-and-switch)
4. [Looping: for, while, and do-while](#4-looping-for-while-and-do-while)
5. [Code Example: Summing a Range and Switch Fallthrough](#5-code-example-summing-a-range-and-switch-fallthrough)
6. [for vs while vs do-while at a Glance](#6-for-vs-while-vs-do-while-at-a-glance)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: A Program That Never Branches Isn't Useful

A program that executes the exact same sequence of statements every single time, regardless of what input it receives, can't actually make decisions. It can't say "if this order total is over $100, apply free shipping" or "keep asking the user for input until they type something valid." Real logic requires the ability to **branch** (choose between different paths depending on a condition) and to **repeat** (run the same block of code multiple times without copy-pasting it).

Without control flow, every program would be a single straight-line list of instructions, incapable of reacting differently to different situations — which describes almost no software anyone actually wants to use. The problem this chapter answers: **how does a program branch and repeat, based on conditions it evaluates while running?**

---

## 2. The Analogy: A Flowchart Drawn in Code

**Real-world analogy:** picture a flowchart on a whiteboard — decision diamonds ("Is the total over $100?") with arrows branching to "Yes" and "No" paths, and loop-back arrows that send you back to an earlier step to repeat it ("Still have items left? Go back and process the next one.").

**Control flow statements are literally how you draw that flowchart in code.** An `if`/`else` is a decision diamond with two exits. A `switch` is a decision diamond with many exits, one per case. A `for` or `while` loop is a loop-back arrow, repeating a block of steps until some condition says to stop. Nothing about control flow is a new concept here — it's the exact same flowchart logic you'd sketch on paper, expressed in syntax the compiler understands.

---

## 3. Branching: if, else if, else, and switch

**`if` / `else if` / `else`** evaluates a `boolean` condition and runs one block or another:

```java
if (total > 100) {
    System.out.println("Free shipping");
} else if (total > 50) {
    System.out.println("Discounted shipping");
} else {
    System.out.println("Standard shipping");
}
```

Only one branch runs — Java checks each condition top to bottom and executes the first one that's `true`, skipping the rest entirely.

**`switch`** is an alternative to a long chain of `else if`s when you're comparing one value against several fixed possibilities (a day number, a menu choice). The classic `switch` statement executes the block matching the value of its selector expression, and then — this is the part that surprises newcomers — **keeps running the following case blocks too**, unless a `break` statement explicitly stops it. This is called **fallthrough**, and it's the classic `switch` statement's defining (and most error-prone) behavior. `break` exits the `switch` entirely; without it, execution just continues into the next case's code, whether or not that case's own value actually matched.

---

## 4. Looping: for, while, and do-while

- **`for`** — best when you know in advance how many times you want to loop, or you're iterating with a counter: `for (int i = 1; i <= 10; i++) { ... }` declares the counter, the continue-condition, and the increment step all in one place.
- **`while`** — best when the number of iterations isn't known ahead of time and depends entirely on a condition evaluated before each iteration: `while (hasNextLine()) { ... }` keeps looping only as long as the condition holds, checked *before* every iteration, including the very first one.
- **`do-while`** — like `while`, but the condition is checked *after* the loop body runs, guaranteeing the body executes **at least once** even if the condition is false from the very start: `do { ... } while (condition);`.

**`break`** immediately exits the nearest enclosing loop (or `switch`) entirely. **`continue`** skips the rest of the current iteration and jumps straight to the next one, without exiting the loop.

---

## 5. Code Example: Summing a Range and Switch Fallthrough

**Summing 1 to 10 with a running total:**

```java
public class SumDemo {
    public static void main(String[] args) {
        int sum = 0;
        for (int i = 1; i <= 10; i++) {
            sum += i;
            System.out.println("After adding " + i + ", sum = " + sum);
        }
    }
}
```

Tracing this by hand: `sum` starts at `0`. Each iteration adds `i` and prints the running total: after `i=1`, sum is `1`; after `i=2`, sum is `3`; after `i=3`, sum is `6`; after `i=4`, sum is `10`; after `i=5`, sum is `15`; after `i=6`, sum is `21`; after `i=7`, sum is `28`; after `i=8`, sum is `36`; after `i=9`, sum is `45`; after `i=10`, sum is `55`. The final printed line is `After adding 10, sum = 55`.

**Switch fallthrough, deliberately missing early `break`s:**

```java
public class SwitchDemo {
    public static void main(String[] args) {
        int day = 3;
        switch (day) {
            case 1:
                System.out.println("Monday");
            case 2:
                System.out.println("Tuesday");
            case 3:
                System.out.println("Wednesday");
            case 4:
                System.out.println("Thursday");
                break;
            case 5:
                System.out.println("Friday");
        }
    }
}
```

Tracing this: `day` is `3`, so execution jumps straight to `case 3` — the `case 1` and `case 2` blocks never run at all, because `switch` jumps directly to the matching case, it doesn't scan from the top. From `case 3` onward, though, there's no `break` after printing `"Wednesday"`, so execution **falls through** into `case 4`'s block too, printing `"Thursday"`, and only then hits the `break` in `case 4`, which stops it before reaching `case 5`. The printed output is:

```
Wednesday
Thursday
```

Note that `"Monday"` and `"Tuesday"` are never printed — fallthrough only continues *downward* from wherever the match started, it doesn't run every case in the whole `switch`.

---

## 6. for vs while vs do-while at a Glance

| | **`for`** | **`while`** | **`do-while`** |
|---|---|---|---|
| **Condition checked** | Before each iteration | Before each iteration | After each iteration |
| **Guaranteed at least one run?** | No | No | Yes |
| **Idiomatic when** | Iteration count is known or counter-based | Iteration depends on a condition evaluated up front | The body must run at least once regardless of the condition (e.g. "prompt the user, then keep re-prompting while invalid") |
| **Counter/condition/step location** | All three declared together in the `for(...)` header | Condition only; counter/step managed manually in the body | Condition only, checked at the end; counter/step managed manually in the body |

---

## 7. Common Mistakes

- Forgetting `break` in a classic `switch` statement and falling through into the next case unintentionally — as shown above, this can print far more than intended, or run logic meant only for a different case.
- Off-by-one errors in loop bounds — writing `i <= array.length` instead of `i < array.length` when looping over an array by index (Phase 3 covers arrays) runs one iteration too many and throws an `ArrayIndexOutOfBoundsException`; writing `i < 10` instead of `i <= 10` when you meant to include `10` runs one iteration too few.

**Interview angle:** Interviewers frequently ask you to predict the output of a `switch` statement with missing `break`s specifically to check whether you understand fallthrough is the *default* behavior of a classic `switch`, not an edge case — and separately, they use off-by-one loop questions to check whether you reflexively verify whether a boundary should be `<` or `<=` rather than guessing. Both are really testing the same underlying habit: tracing exactly what a boundary condition does before assuming it's correct.

---

## 8. Hands-On Exercises

### Exercise 1 — Trace before you run

Take the `SwitchDemo` example above, change `day` to `1`, and before running it, write down on paper exactly which lines you predict will print. Then run it and check your prediction against the actual output.

### Exercise 2 — Fix the fallthrough

Rewrite `SwitchDemo` so that every case prints only its own day name, with no fallthrough at all, by adding the missing `break` statements. Confirm that changing `day` to each value from `1` to `5` prints exactly one line.

### Exercise 3 — do-while with a real guarantee

Write a small program using a `do-while` loop that prints "Attempt 1" through a loop variable, where the loop's condition is already false before the loop starts (e.g. `int attempts = 5; do { ... } while (attempts < 5);`). Confirm the body still runs exactly once despite the condition being false from the start, and explain why a plain `while` loop with the same condition would never run at all.

---

## 9. Interview Q&A

### Q1. What is "fallthrough" in a classic Java `switch` statement?

**Answer:** Once a `case` matches and its block starts executing, execution continues into the following case blocks automatically, regardless of whether their values match, unless a `break` statement stops it. It's the default behavior of a classic `switch`, not a bug or edge case.

### Q2. What's the difference between `while` and `do-while`?

**Answer:** `while` checks its condition before every iteration, including the first, so the body may run zero times. `do-while` checks its condition after each iteration, so the body is guaranteed to run at least once even if the condition is false from the very start.

### Q3. What does `break` do inside a loop versus inside a `switch`?

**Answer:** In both cases, `break` immediately exits the nearest enclosing construct — a loop or a `switch` — and execution continues with the code right after it. Inside a `switch`, it's specifically what prevents fallthrough into the next case.

### Q4. What's the difference between `break` and `continue` inside a loop?

**Answer:** `break` exits the loop entirely, skipping all remaining iterations. `continue` skips only the rest of the current iteration's body and moves on to the loop's next iteration, without exiting the loop.

### Q5. Why would you choose a `for` loop over a `while` loop for the same task?

**Answer:** They're interchangeable in terms of what they can express, but a `for` loop is idiomatic when the counter, the stopping condition, and the increment step are all naturally known up front and related to each other — keeping all three together in the `for(...)` header makes that relationship obvious at a glance, whereas a `while` loop scatters the counter and increment logic elsewhere in the body.

---

> 🧠 **Memory hook:** "A `switch` without `break` doesn't stop at the matching case — it keeps falling down the stairs until something catches it."
