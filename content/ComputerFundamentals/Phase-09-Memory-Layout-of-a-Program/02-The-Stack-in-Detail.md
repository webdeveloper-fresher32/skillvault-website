# The Stack in Detail — Complete Guide

## Table of Contents
1. [What Lives in a Stack Frame](#1-what-lives-in-a-stack-frame)
2. [Pushing and Popping During a Function Call](#2-pushing-and-popping-during-a-function-call)
3. [A Multi-Call Walkthrough](#3-a-multi-call-walkthrough)
4. [Why Recursion Can Overflow the Stack](#4-why-recursion-can-overflow-the-stack)
5. [Concrete Python Example: RecursionError](#5-concrete-python-example-recursionerror)
6. [The Analogous C Stack Overflow](#6-the-analogous-c-stack-overflow)
7. [Fixing Runaway Recursion](#7-fixing-runaway-recursion)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. What Lives in a Stack Frame

Every time a function is called, the program sets up a **stack frame** (also called an "activation record") for that call. A stack frame typically contains:

- **Function arguments/parameters** passed into the call
- **Local variables** declared inside the function
- **The return address** — where execution should resume in the *calling* function once this one finishes
- **Saved register values** — so the calling function's register state can be restored after this call returns

```
┌───────────────────────────────┐
│      Stack Frame for f()       │
├───────────────────────────────┤
│ Return address (back to caller)│
│ Saved base pointer (caller's)  │
│ Local variable: x              │
│ Local variable: y              │
│ Parameter: a                   │
│ Parameter: b                   │
└───────────────────────────────┘
```

Each active function call — meaning it has been called but hasn't returned yet — has exactly one frame on the stack. The set of all currently active frames, stacked on top of each other, is literally what a debugger's "call stack" or "stack trace" is showing you.

---

## 2. Pushing and Popping During a Function Call

Calling a function **pushes** a new frame onto the top of the stack. Returning from a function **pops** that frame off, discarding its contents (the memory isn't explicitly erased — it's just no longer considered valid, and will be overwritten by the next push).

```
BEFORE calling f():
┌─────────────┐
│  main()     │   ← stack pointer points here
│  frame      │
└─────────────┘

DURING call to f() — a new frame is PUSHED:
┌─────────────┐
│  main()     │
│  frame      │
├─────────────┤
│  f()        │   ← stack pointer now points here
│  frame      │
└─────────────┘

AFTER f() returns — its frame is POPPED:
┌─────────────┐
│  main()     │   ← stack pointer back here
│  frame      │
└─────────────┘
```

This push/pop discipline is exactly why it's called a "stack" — Last In, First Out (LIFO), same as the stack data structure you already know from algorithms.

---

## 3. A Multi-Call Walkthrough

Consider:

```python
def c():
    return "done"

def b():
    result = c()
    return result

def a():
    return b()

a()
```

Here's how the stack evolves:

```
Step 1 — a() is called from top-level:
┌───────────┐
│  a() frame │
└───────────┘

Step 2 — a() calls b():
┌───────────┐
│  a() frame │
├───────────┤
│  b() frame │
└───────────┘

Step 3 — b() calls c():
┌───────────┐
│  a() frame │
├───────────┤
│  b() frame │
├───────────┤
│  c() frame │
└───────────┘

Step 4 — c() returns "done", its frame is POPPED:
┌───────────┐
│  a() frame │
├───────────┤
│  b() frame │  ← now has result = "done", about to return it
└───────────┘

Step 5 — b() returns, its frame is POPPED:
┌───────────┐
│  a() frame │  ← about to return b()'s result
└───────────┘

Step 6 — a() returns, its frame is POPPED:
(stack is empty — back to top level)
```

At the deepest point (Step 3), there are three frames stacked up — this is the "call depth." If you ran a debugger and hit a breakpoint inside `c()`, the stack trace shown would be exactly `a → b → c`, top to bottom (or bottom to top, depending on convention).

---

## 4. Why Recursion Can Overflow the Stack

Recursion means a function calls itself (directly, or indirectly through other functions). Each recursive call pushes another frame onto the stack — **and the stack has a fixed maximum size**, set by the OS (often around 1MB–8MB, depending on the system and language runtime).

If a recursive function doesn't have a base case that stops the recursion (or the base case is never reached, or is simply too deep), it keeps pushing frames until it runs out of stack space. This is a **stack overflow**.

```
Recursive calls with no proper base case:

┌───────────┐
│ f() frame  │  call depth 1
├───────────┤
│ f() frame  │  call depth 2
├───────────┤
│ f() frame  │  call depth 3
├───────────┤
│    ...     │  ... thousands more ...
├───────────┤
│ f() frame  │  call depth N
└───────────┘
      ▼
  Stack pointer runs past the reserved stack
  memory region → CRASH (segfault in C,
  RecursionError in Python)
```

Every recursive call, no matter how simple, costs real memory — one frame's worth. Deep enough recursion, without an escape hatch, *will* exhaust that memory.

---

## 5. Concrete Python Example: RecursionError

Python protects you from this crashing the whole interpreter (unlike raw C) by tracking recursion depth and raising a catchable `RecursionError` before you actually smash into the real OS stack limit.

```python
def count_down(n):
    print(f"n = {n}")
    return count_down(n + 1)   # BUG: no base case — this never stops

try:
    count_down(0)
except RecursionError as e:
    print("Caught it! Error message:", e)
```

Running this produces (abbreviated — you'll see thousands of `n = ...` lines):

```
n = 0
n = 1
n = 2
...
n = 995
n = 996
n = 997
Caught it! Error message: maximum recursion depth exceeded
```

Python's default recursion limit is 1000 (check with `sys.getrecursionlimit()`). Once the call stack of Python "frame objects" hits that depth, Python raises `RecursionError` rather than letting the process actually crash — a deliberate safety net that raw C does not have.

A cleaner example that demonstrates the exact same failure with a "forgotten base case" bug, which is the most common real-world cause of this error:

```python
def factorial(n):
    # BUG: missing "if n == 0: return 1" base case
    return n * factorial(n - 1)

try:
    factorial(5)
except RecursionError as e:
    print("factorial() blew the stack:", e)
```

```
factorial() blew the stack: maximum recursion depth exceeded
```

Fixed version, for contrast:

```python
def factorial(n):
    if n == 0:          # base case — stops the recursion
        return 1
    return n * factorial(n - 1)

print(factorial(5))   # 120 — no error, because recursion terminates
```

---

## 6. The Analogous C Stack Overflow

C has no built-in safety net like Python's `RecursionError`. If you write the equivalent unbounded recursion in C, the program simply crashes with a **segmentation fault** once it writes past the memory the OS reserved for the stack — there's no clean exception to catch.

```c
#include <stdio.h>

void count_down(int n) {
    printf("n = %d\n", n);
    count_down(n + 1);   // no base case — recurses forever
}

int main() {
    count_down(0);
    return 0;
}
```

Running this compiled binary prints thousands of lines rapidly, then terminates abruptly with something like:

```
n = 999982
n = 999983
n = 999984
Segmentation fault (core dumped)
```

There is no `try/except` equivalent that cleanly recovers from this in standard C — the OS kills the process outright because it detected the stack pointer moving into memory the process doesn't own. This is precisely why languages like Python add their own recursion-depth tracking: it turns an unrecoverable crash into a catchable, debuggable exception.

| | Python | C |
|---|--------|---|
| Detection | Interpreter tracks call depth, checks against `sys.getrecursionlimit()` | No built-in tracking — relies on the OS catching the actual memory violation |
| Result | Catchable `RecursionError` | Uncatchable crash — `Segmentation fault (core dumped)` |
| Recoverable? | Yes, with `try/except` | No — the process is terminated by the OS |

---

## 7. Fixing Runaway Recursion

Two general fixes:

1. **Add/fix the base case** — the most common real fix, as shown above with `factorial`.
2. **Convert to iteration** — when recursion depth could legitimately be very large (e.g., processing a huge linked list), an iterative loop avoids stack growth entirely, since a loop reuses the same stack frame on every iteration instead of pushing a new one.

```python
# Iterative factorial — no recursion, no stack growth per iteration
def factorial_iterative(n):
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

print(factorial_iterative(5))  # 120
```

---

## 8. Hands-On Exercises

**Exercise 1:** Run the buggy `count_down` Python example yourself. Note the approximate `n` value where it fails, and compare it to `sys.getrecursionlimit()`.

**Exercise 2:** Modify `sys.setrecursionlimit(3000)` before running `count_down(0)` again. Does it fail later? Why doesn't raising the limit "fix" the underlying bug?

**Exercise 3:** Write a correctly base-cased recursive Fibonacci function in Python, then trace through (on paper) how many stack frames exist at the deepest point when computing `fib(4)`.

**Exercise 4:** Convert the correct recursive `factorial` function into an iterative version yourself (without looking at Section 7), then compare.

**Exercise 5:** If you have a C compiler available, compile and run the C `count_down` example. Observe how the crash differs from Python's catchable exception (no traceback with a clean error message — just a segfault).

---

## 9. Interview Q&A

**Q: What is a stack frame and what does it typically contain?**
Answer: A stack frame (activation record) is the memory pushed onto the stack for each active function call. It typically holds the function's arguments, local variables, the return address (where to resume execution in the caller), and saved register values needed to restore the caller's state after the call returns.

**Q: Why does deep recursion cause a stack overflow?**
Answer: Each recursive call pushes a new stack frame, and the stack has a fixed maximum size set by the OS/runtime. Without a base case that stops the recursion (or if the required depth simply exceeds the limit), frames keep getting pushed until the stack's reserved memory is exhausted, causing a crash (C) or a catchable error (Python's RecursionError).

**Q: How does Python's RecursionError differ from a C stack overflow / segfault?**
Answer: Python's interpreter proactively tracks call depth and compares it against a configurable limit (default 1000), raising a catchable RecursionError before the actual process stack is exhausted. C has no such built-in tracking — recursion keeps pushing frames until it writes past memory the OS reserved for the stack, at which point the OS terminates the process with an uncatchable segmentation fault.

**Q: Why is recursion without a base case a common bug, and how do you fix it?**
Answer: It's common because it's easy to forget or mis-order the base-case check relative to the recursive call (e.g., writing `return n * factorial(n-1)` without first checking `if n == 0: return 1`). The fix is to ensure every recursive path eventually reaches a base case that returns without recursing further; alternatively, rewriting the logic iteratively avoids the risk of stack growth entirely.

**Q: Why is converting recursion to iteration sometimes preferred, from a memory standpoint?**
Answer: An iterative loop reuses the same stack frame across all iterations, so its stack usage stays constant (O(1)) regardless of how many iterations run. Recursive calls, in contrast, use O(depth) stack space, one frame per active call, which can exhaust the stack for sufficiently large inputs even when the algorithm's logic is otherwise correct.

**Q: What determines the maximum depth of recursion in Python, and can it be changed?**
Answer: Python's `sys.getrecursionlimit()` (default 1000) sets the maximum tracked call depth, and `sys.setrecursionlimit()` can raise or lower it. However, raising it doesn't fix a bug that causes truly unbounded recursion — it only delays the failure, and setting it too high risks hitting the real OS-level stack limit, which crashes the interpreter itself rather than raising a catchable exception.
