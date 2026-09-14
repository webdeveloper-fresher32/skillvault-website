# 02 — The Stream API

> A comprehensive reference covering how to build a Stream pipeline, the difference between lazy intermediate operations and triggering terminal operations, and how a filter → map → collect pipeline actually executes step by step.

---

## Table of Contents

1. [The Problem: Loops With Temporary Lists Everywhere](#1-the-problem-loops-with-temporary-lists-everywhere)
2. [The Analogy: A Factory Assembly Line](#2-the-analogy-a-factory-assembly-line)
3. [Creating a Stream](#3-creating-a-stream)
4. [Intermediate Operations: Lazy and Chainable](#4-intermediate-operations-lazy-and-chainable)
5. [Terminal Operations: Where Execution Actually Happens](#5-terminal-operations-where-execution-actually-happens)
6. [Code Example: A Filter → Map → Collect Pipeline, Traced Step by Step](#6-code-example-a-filter--map--collect-pipeline-traced-step-by-step)
7. [Imperative Loop vs Stream Pipeline](#7-imperative-loop-vs-stream-pipeline)
8. [Common Mistakes](#8-common-mistakes)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Problem: Loops With Temporary Lists Everywhere

Say you have a `List<String>` of names, and you need "every name longer than 3 characters, uppercased, as a new list." Before Streams, that's a manual loop with an intermediate result you build up by hand:

```java
List<String> result = new ArrayList<>();
for (String name : names) {
    if (name.length() > 3) {
        result.add(name.toUpperCase());
    }
}
```

That's not terrible for one step. But real data-processing logic is rarely just one step — filter, then transform, then sort, then group, then limit to the first 10. Each additional step in a manual loop usually means another temporary list and another loop (or cramming more logic into the same loop body, which quickly gets hard to read). The problem the Stream API solves: **how do you describe a multi-step "filter, transform, combine" pipeline declaratively, without hand-writing a new loop and a new temporary list for every single step?**

---

## 2. The Analogy: A Factory Assembly Line

**Real-world analogy:** picture a factory assembly line. Raw material goes in one end. Each station along the line does exactly one job — one station removes defective parts, the next reshapes the part, another paints it — and a finished product comes off the other end. Nobody is walking the half-finished product back and forth between stations by hand; the line itself carries each item forward through every station in sequence.

**A Stream pipeline is that assembly line.** You describe the *stations* (filter this, transform that) once, in order, and the Stream mechanism carries each element through all of them — you never manually manage the walking-back-and-forth or the temporary piles of half-processed items in between.

---

## 3. Creating a Stream

Most Streams in everyday code start from an existing collection, using the `.stream()` method that `Collection` (and therefore `List`, `Set`, and so on — Phase 4) provides:

```java
List<String> names = List.of("Al", "Bob", "Charlie", "Dave", "Eve");
Stream<String> stream = names.stream();
```

A Stream is **not** a data structure that stores elements — it's a description of a computation over a source of elements (here, the `names` list). Nothing has actually been filtered, transformed, or read yet just by calling `.stream()`.

---

## 4. Intermediate Operations: Lazy and Chainable

An **intermediate operation** — `filter`, `map`, `sorted`, and others — takes a Stream and returns a *new* Stream, describing one more step in the pipeline. Crucially, intermediate operations are **lazy**: calling `.filter(...)` doesn't actually loop over anything yet. It just records "when this pipeline eventually runs, apply this filter here."

```java
Stream<String> longNames = names.stream()
    .filter(name -> name.length() > 3)   // lazy — nothing has run yet
    .map(String::toUpperCase);           // still lazy — still nothing has run
```

At this point, not a single element has actually been filtered or uppercased. The pipeline is fully *described* but not yet *executed*.

---

## 5. Terminal Operations: Where Execution Actually Happens

A **terminal operation** — `collect`, `forEach`, `reduce`, `count`, and others — is what actually triggers the pipeline to run. Only once a terminal operation is called does the Stream walk the source elements through every intermediate operation, one element at a time, end to end.

```java
List<String> result = names.stream()
    .filter(name -> name.length() > 3)
    .map(String::toUpperCase)
    .collect(Collectors.toList()); // terminal — this is what actually executes the pipeline
```

`Collectors.toList()` is the most common way to gather a Stream's output back into a concrete `List`. Other terminal operations serve different purposes: `forEach` runs an action per element without collecting a result, `count` returns how many elements made it through, and `reduce` combines all elements into a single value (e.g. summing them).

A Stream can only be walked **once**. Once a terminal operation runs, that Stream is considered consumed — Section 8 covers what happens if you try to reuse it.

---

## 6. Code Example: A Filter → Map → Collect Pipeline, Traced Step by Step

```java
import java.util.*;
import java.util.stream.*;

public class StreamPipeline {
    public static void main(String[] args) {
        List<String> names = List.of("Al", "Bob", "Charlie", "Dave", "Eve");

        List<String> result = names.stream()
            .filter(name -> name.length() > 3)
            .map(String::toUpperCase)
            .collect(Collectors.toList());

        System.out.println(result); // [CHARLIE, DAVE]
    }
}
```

Tracing it by hand, element by element, against the source list `["Al", "Bob", "Charlie", "Dave", "Eve"]`:

| Name | Length | `filter(length > 3)` | `map(toUpperCase)` |
|---|---|---|---|
| `"Al"` | 2 | fails — dropped | — |
| `"Bob"` | 3 | fails — dropped (not `> 3`) | — |
| `"Charlie"` | 7 | passes | `"CHARLIE"` |
| `"Dave"` | 4 | passes | `"DAVE"` |
| `"Eve"` | 3 | fails — dropped (not `> 3`) | — |

Only `"Charlie"` and `"Dave"` survive the filter (both `"Bob"` and `"Eve"` have length exactly 3, which does not satisfy `> 3`), and both get uppercased. `collect(Collectors.toList())` gathers the surviving, transformed elements in encounter order, so the final printed result is `[CHARLIE, DAVE]`.

---

## 7. Imperative Loop vs Stream Pipeline

| | **Imperative `for` loop** | **Stream pipeline** |
|---|---|---|
| **Style** | Describes *how* — step-by-step instructions with an explicit temporary list | Describes *what* — a declarative sequence of transformations |
| **Execution timing** | Runs immediately, line by line | Intermediate operations are lazy; nothing runs until a terminal operation is called |
| **Chaining more steps** | Usually means adding more `if`s/temp variables inside (or another loop after) | Usually means adding one more chained method call |
| **Readability at scale** | Can get dense once several steps are combined in one loop body | Each step reads as its own named operation, in the order it happens |
| **Reusability of the source** | The loop can run over the same list any number of times | A single `Stream` instance can only be consumed (terminated) once |

Neither is universally "better" — Section 8 revisits when a plain loop is still the more readable choice.

---

## 8. Common Mistakes

- **Trying to reuse a Stream after a terminal operation has already run.** A Stream is single-use — once a terminal operation executes, that Stream object is considered closed:

```java
Stream<String> s = names.stream();
s.forEach(System.out::println); // terminal operation — Stream is now consumed
s.count(); // IllegalStateException: stream has already been operated upon or closed
```

If you need to run the "same" pipeline again, you have to build a fresh Stream from the source (e.g. call `names.stream()` again), not reuse the old `Stream` reference.

- **Overusing Streams for something a simple loop would express more clearly.** A three-step pipeline reads beautifully as chained method calls; cramming five conditional branches and side effects into one dense `.map(...)` lambda can end up *less* readable than a plain `for` loop with a couple of `if` statements. Streams are a readability tool, not a mandate — reach for a loop when it's genuinely clearer.

**Interview angle:** "Walk me through what happens when you call `.stream().filter(...).map(...).collect(...)`" is a very common Streams question. The key point interviewers listen for is the laziness distinction: `filter` and `map` don't do any actual work by themselves — they just build up a description of the pipeline — and it's only the terminal operation (`collect` here) that walks the source elements through every step, once, in a single pass.

---

## 9. Hands-On Exercises

### Exercise 1 — Trace a pipeline by hand before running it

Given `List<Integer> nums = List.of(1, 2, 3, 4, 5, 6);`, write out on paper what `nums.stream().filter(n -> n % 2 == 0).map(n -> n * n).collect(Collectors.toList())` should produce, tracing each element through `filter` and `map` individually, before checking your answer against a JDK if one is available.

### Exercise 2 — Rewrite a loop as a Stream pipeline

Take a `for` loop that computes the sum of all even numbers in a `List<Integer>`, and rewrite it using `.stream().filter(...).reduce(...)` (or `.mapToInt(...).sum()`). Compare the two versions for readability.

### Exercise 3 — Trigger `IllegalStateException` on purpose

Write a small program that stores a `Stream<String>` in a variable, calls a terminal operation on it, then calls a second terminal operation on the *same* variable. Confirm (by reasoning through the API, or running it if a JDK is available) that the second call throws `IllegalStateException`, and explain in one sentence why Streams are designed to be single-use.

---

## 10. Interview Q&A

### Q1. What's the difference between an intermediate and a terminal Stream operation?

**Answer:** An intermediate operation (`filter`, `map`, `sorted`, ...) returns a new Stream describing one more pipeline step, and is lazy — it doesn't execute anything by itself. A terminal operation (`collect`, `forEach`, `reduce`, `count`, ...) is what actually triggers the entire pipeline to run, walking every source element through all the intermediate steps in one pass.

---

### Q2. Can you reuse a Stream after calling a terminal operation on it?

**Answer:** No. Once a terminal operation runs, that Stream is considered consumed, and any further operation on the same Stream reference throws `IllegalStateException`. To run the same logic again, you need to create a brand-new Stream from the original source.

---

### Q3. Why are intermediate operations lazy instead of executing immediately?

**Answer:** Laziness lets the Stream implementation optimize the whole pipeline as a single pass over the data instead of materializing a full intermediate list after every step — for example, it can potentially short-circuit once enough elements are found rather than always processing every source element through every stage.

---

### Q4. What does `Collectors.toList()` do?

**Answer:** It's a terminal-operation helper passed to `.collect(...)` that gathers a Stream's remaining elements into a new `List`, in encounter order, after all intermediate operations have been applied.

---

### Q5. Is a Stream pipeline always better than a plain `for` loop?

**Answer:** Not always. Streams tend to read more clearly for straightforward filter/transform/combine pipelines, but forcing a lot of branching logic or side effects into Stream lambdas can hurt readability compared to a simple loop. Choose whichever expresses the intent more clearly for the specific case.

---

> 🧠 **Memory hook:** "A Stream is an assembly line, not a warehouse — nothing moves until you flip the switch (a terminal operation), and once a run finishes, that line is spent."
