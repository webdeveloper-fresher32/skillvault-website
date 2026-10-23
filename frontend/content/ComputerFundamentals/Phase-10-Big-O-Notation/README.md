# Phase 10: Big-O Notation

## Why This Phase Matters

"What's the time complexity of this?" is one of the most common interview questions, asked in nearly every technical interview regardless of language or stack. It's not just an academic exercise — Big-O is how engineers communicate, in one compact symbol, whether code will scale to a million users or fall over at a thousand. A full-stack engineer who can instantly spot that a nested loop over a database result set is O(n²) — and knows how to fix it — ships faster, more scalable code and passes interviews with more confidence.

This phase builds the intuition first (what does "growth rate" actually mean, and why do we ignore constants?), then drills the common complexity classes with real code, then teaches you to read arbitrary code and derive its complexity step by step — the exact skill interviewers are testing.

## What You'll Learn

| # | Lesson | Core Idea |
|---|--------|-----------|
| 01 | What is Big-O | Asymptotic notation, worst-case growth, Big-O vs Big-Theta vs Big-Omega, growth-curve comparison |
| 02 | Common Complexity Classes with Examples | Concrete Python code for O(1) through O(n!), and why each one has that complexity |
| 03 | Analyzing Code for Big-O | Step-by-step walkthroughs of loops, nested loops, early breaks, and recursion — plus common mistakes |

## Prerequisites

- Comfortable reading basic Python (loops, functions, recursion).
- No prior algorithms background required — this phase starts from first principles.

## How to Study This Phase

1. Read lesson 01 first — it defines the vocabulary (worst-case, growth rate, dominant term) that the rest of the phase relies on.
2. For lesson 02, actually run each Python snippet and try increasing the input size (`n`) to see the operation count grow as described.
3. For lesson 03, cover the answer and try to derive the complexity yourself before reading the walkthrough.
4. Do the Hands-On Exercises at the end of each lesson before moving on.
5. Use the Interview Q&A sections as flash cards during interview prep.

## Time Estimate

Roughly 2–3 hours total, including exercises.

---

Next phase: **Phase-11-Time-and-Space-Complexity-Analysis**
