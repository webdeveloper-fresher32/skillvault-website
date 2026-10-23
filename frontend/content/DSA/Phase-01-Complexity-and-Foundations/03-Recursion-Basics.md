# Recursion Basics

## 1. Problem

Some problems are naturally defined in terms of smaller versions of themselves: "the height of a tree is 1 plus the height of its tallest subtree," "n! is n times (n-1)!," "to search a folder, search each of its subfolders." Writing these with explicit loops and manual stacks is possible but often awkward and hard to read. Recursion lets you express "solve this by solving a smaller version of the same problem" directly in code — but it comes with a hidden cost (stack memory) and a hidden danger (infinite recursion, or silently recomputing the same subproblem thousands of times) that trip up almost every learner at first.

This topic matters enormously for interviews because a huge fraction of tree, graph, backtracking, and divide-and-conquer problems are naturally recursive — if your mental model of "what actually happens when a function calls itself" is shaky, you'll write bugs that only show up on deep or unusual inputs.

## 2. Analogy

Picture a set of Russian nesting dolls (matryoshka). To find out what's inside the outermost doll, you open it and find a smaller doll — to know what's inside *that* one, you open it too, and so on, until you reach the smallest doll that doesn't open further (the **base case**). Then you close each doll back up, one at a time, from smallest to largest, possibly combining information as you go (e.g., "doll 3 contains what was in doll 4, plus this note").

Each doll you're currently holding is like a **stack frame** — it has its own contents (local variables) and doesn't know or care what's inside the dolls above or below it. The dolls literally stack up as you go deeper (the "call stack"), and unstack as you finish each one (the "return").

## 3. Internal Flow

Every recursive function needs exactly two parts:

1. **Base case** — the smallest version of the problem, solved directly without further recursion. This is what stops the recursion from going forever.
2. **Recursive case** — the function calls itself on a *smaller* input, and combines that result with some local work to produce the answer for the current input.

What actually happens in memory: every time a function calls itself, the program pushes a new **stack frame** onto the call stack. Each frame holds that call's own local variables, parameters, and "where to resume" information — completely separate from every other frame, even though they're all running "the same function." The frames pile up as recursive calls go deeper, and pop off one by one (in last-in-first-out order) as each call returns its result to its caller.

Step-by-step walkthrough for `factorial(4)`:

1. `factorial(4)` calls `factorial(3)` and waits (frame for n=4 pushed).
2. `factorial(3)` calls `factorial(2)` and waits (frame for n=3 pushed).
3. `factorial(2)` calls `factorial(1)` and waits (frame for n=2 pushed).
4. `factorial(1)` calls `factorial(0)` and waits (frame for n=1 pushed).
5. `factorial(0)` hits the base case, returns `1` immediately (no further push).
6. `factorial(1)` receives `1`, computes `1 * 1 = 1`, returns it, frame for n=1 pops.
7. `factorial(2)` receives `1`, computes `2 * 1 = 2`, returns it, frame for n=2 pops.
8. `factorial(3)` receives `2`, computes `3 * 2 = 6`, returns it, frame for n=3 pops.
9. `factorial(4)` receives `6`, computes `4 * 6 = 24`, returns it, frame for n=4 pops.

The stack grew to depth 4 and shrank back to depth 0 — this "grow then shrink" shape is the signature of recursion.

## 4. Example

First, factorial with an indented call trace so you can see the stack grow and shrink:

```python
def factorial(n, depth=0):
    indent = "  " * depth
    print(f"{indent}-> factorial({n}) called")
    if n == 0:
        print(f"{indent}<- factorial({n}) returns 1 (base case)")
        return 1
    result = n * factorial(n - 1, depth + 1)
    print(f"{indent}<- factorial({n}) returns {result}")
    return result

factorial(4)
```

Output:

```
-> factorial(4) called
  -> factorial(3) called
    -> factorial(2) called
      -> factorial(1) called
        -> factorial(0) called
        <- factorial(0) returns 1 (base case)
      <- factorial(1) returns 1
    <- factorial(2) returns 2
  <- factorial(3) returns 6
<- factorial(4) returns 24
```

Now naive recursive Fibonacci, which reveals exponential blowup because it recomputes the same subproblems repeatedly:

```python
call_count = 0

def fib(n, depth=0):
    global call_count
    call_count += 1
    indent = "  " * depth
    print(f"{indent}fib({n})")
    if n <= 1:
        return n
    return fib(n - 1, depth + 1) + fib(n - 2, depth + 1)

call_count = 0
print(f"fib(5) = {fib(5)}")
print(f"\nTotal calls for fib(5): {call_count}")


def fib_count_only(n):
    """Same recursion, no printing -- just to measure blowup for larger n."""
    global call_count
    call_count += 1
    if n <= 1:
        return n
    return fib_count_only(n - 1) + fib_count_only(n - 2)

call_count = 0
_ = fib_count_only(20)
print(f"Total calls for fib(20): {call_count}")
```

Output (trace excerpt for `fib(5)`, then the call counts):

```
fib(5)
  fib(4)
    fib(3)
      fib(2)
        fib(1)
        fib(0)
      fib(1)
    fib(2)
      fib(1)
      fib(0)
  fib(3)
    fib(2)
      fib(1)
      fib(0)
    fib(1)
fib(5) = 5

Total calls for fib(5): 15
Total calls for fib(20): 21891
```

Notice `fib(2)` gets computed three separate times just within `fib(5)` — the tree of calls duplicates work exponentially. Going from `fib(5)` (15 calls) to `fib(20)` (21,891 calls) shows how fast this blows up: this recomputation of overlapping subproblems is precisely the pain point that motivates **memoization and Dynamic Programming**, covered in a later phase of this course.

## 5. Compare

- Recursion vs iteration: any recursive algorithm can be rewritten iteratively using an explicit stack data structure — recursion just lets the *language's own call stack* do that bookkeeping for you, at the cost of stack space and (in Python) a recursion-depth limit.
- This lesson's call-stack model is the same mental model used in **02-Time-and-Space-Complexity-Analysis** to justify why recursive space complexity is O(depth) — this lesson makes that abstract claim concrete by actually printing the stack growing and shrinking.
- The `fib` blowup here is the direct motivating example for **04-Recurrence-Relations-and-Master-Theorem** (expressing `T(n) = T(n-1) + T(n-2) + O(1)` as a recurrence) and for the later Dynamic Programming phase (fixing the blowup with memoization).

## 6. Common Mistakes

- **Missing or wrong base case, causing infinite recursion.** Forgetting the base case entirely, or writing a base case that the recursive case can never actually reach (e.g., decrementing by 2 but checking `n == 0` when `n` starts odd), causes the stack to grow until Python raises `RecursionError: maximum recursion depth exceeded`.
- **Off-by-one errors in the base case boundary.** Using `if n == 1` when the true smallest valid input is `n == 0` (or vice versa) — this can produce a wrong answer for the smallest cases while working fine for larger ones, making the bug easy to miss in casual testing.
- **Recomputing overlapping subproblems.** As shown by naive Fibonacci, failing to notice that the same sub-call happens repeatedly turns what could be a linear-time algorithm into an exponential one.
- **Mutating shared state across recursive calls without care.** Passing a mutable list or dict into recursive calls and forgetting that changes in a deeper call are visible to a sibling call unless explicitly copied or undone (common bug in backtracking).
- **Assuming recursion is "free."** Every recursive call has real memory and function-call overhead — deeply recursive solutions (e.g., recursing over 100,000 elements) can hit Python's default recursion limit (~1000) even when the *logic* is correct.

## 7. Interview Angle

Interviewers use recursion both as a topic itself and as a lens to test whether you understand what's happening "under the hood," not just whether you can write recursive-looking code. Typical framings:

- "Can you identify the base case and recursive case here?" — a direct sanity check before you even start coding.
- "What's the space complexity of this recursive solution?" — tests whether you remember call-stack depth counts as space (see previous lesson).
- "Can you convert this recursion to an iterative solution?" — tests whether you understand recursion as "the language managing a stack for you," by asking you to manage that stack yourself.
- "What happens if the input is huge — will this stack overflow?" — tests awareness of recursion depth limits, often nudging toward an iterative or tail-recursive-style rewrite (note: Python does not optimize tail calls).
- Common variation: "How would you avoid recomputing the same subproblem?" — a direct lead-in to memoization/DP.

## 8. Memory Hook

**Recursion is "trust and reduce": trust that the function correctly solves a smaller version of the problem, and your only job is to reduce the current problem to that smaller version plus a little extra work — the base case is where you stop trusting and just answer directly.**
