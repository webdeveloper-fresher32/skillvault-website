# Stack Implementation and Operations

## 1. Problem

Picture a text editor's undo button. You type a sentence, delete a word, paste a paragraph, and hit Ctrl+Z three times — each press has to undo the *most recent* action first, then the one before that, and so on, back in time in exact reverse order. You never undo the fifth-most-recent action before the most recent one. That "last thing in is the first thing out" behavior shows up everywhere: browser back buttons, function call stacks during recursion, compilers checking that every `{` has a matching `}`, and calculators evaluating expressions like `3 + 4 * 2`.

All of these need a data structure that only ever exposes one end — you add to it and remove from it at the exact same place, and whatever you added last is always the first thing you get back. That structure is the **stack**, and it's the simplest of the "restricted access" data structures: no random access, no peeking in the middle, just push and pop at one end. Because Python's built-in `list` already supports O(1) append and removal at its end, a stack is often just "a list, used a certain way" rather than a structure you build from scratch — but using it correctly (and knowing why the *other* end of a list is a trap) is the actual skill being tested.

## 2. Analogy

Think of a stack of clean plates at a buffet. You can only take a plate from the top, and when the dishwasher brings out more clean plates, they go on top too. You'd never try to pull a plate from the bottom of the stack — the whole pile would topple. Whichever plate was placed most recently is the one anyone reaches for next; the plate at the very bottom was the first one set down and it won't be touched until every plate above it is gone.

That's exactly what a software stack guarantees: the last element pushed is the first element popped (**LIFO — Last In, First Out**), and the only legal operations are "add to the top" and "take from the top."

## 3. Internal Flow

A stack supports a small, fixed set of operations, all defined relative to a single end called the **top**:

- **push(x)** — add `x` to the top.
- **pop()** — remove and return the top element.
- **peek() / top()** — look at the top element without removing it.
- **is_empty()** — check whether there's anything left.

In Python, a `list` implements this perfectly if you treat the *end* of the list as the top:

- `stack.append(x)` pushes — O(1) amortized, because Python lists over-allocate capacity so appending rarely triggers a resize/copy.
- `stack.pop()` (no argument) pops from the end — O(1), because removing the last element needs no shifting.
- `stack[-1]` peeks at the top without modifying anything.

Walking through balanced-parentheses checking (a canonical stack use case) step by step:

1. Scan the input left to right, one character at a time.
2. Every time you see an opening bracket (`(`, `[`, `{`), push it onto the stack — it's now "waiting" for its matching closer.
3. Every time you see a closing bracket, check the top of the stack: if it holds the matching opener, pop it (the pair is resolved); if the stack is empty or the top is the wrong opener, the string is unbalanced — stop immediately.
4. After the scan, the string is balanced only if the stack is empty — an empty stack means every opener found its closer in the right order.

This same "push on open, pop-and-check on close" flow is also how expression evaluators track operator precedence, and how "undo" stacks track actions: each new action pushes onto the undo stack, and each undo pops the most recent one and (often) pushes it onto a *redo* stack.

## 4. Example

Validating balanced brackets, with the stack's contents printed at every push and pop:

```python
def is_balanced(s):
    pairs = {')': '(', ']': '[', '}': '{'}
    stack = []
    for i, ch in enumerate(s):
        if ch in '([{':
            stack.append(ch)
            print(f"index {i} char {ch!r}: push -> stack={stack}")
        elif ch in ')]}':
            if not stack or stack[-1] != pairs[ch]:
                print(f"index {i} char {ch!r}: mismatch or empty stack -> stack={stack}")
                return False
            popped = stack.pop()
            print(f"index {i} char {ch!r}: pop {popped!r} -> stack={stack}")
    return len(stack) == 0

s = "{[a(b)c]}"
print("Input:", s)
result = is_balanced(s)
print("Balanced?", result)

print()
s2 = "([)]"
print("Input:", s2)
result2 = is_balanced(s2)
print("Balanced?", result2)
```

Traced output (executed exactly as shown):

```
Input: {[a(b)c]}
index 0 char '{': push -> stack=['{']
index 1 char '[': push -> stack=['{', '[']
index 3 char '(': push -> stack=['{', '[', '(']
index 5 char ')': pop '(' -> stack=['{', '[']
index 7 char ']': pop '[' -> stack=['{']
index 8 char '}': pop '{' -> stack=[]
Balanced? True

Input: ([)]
index 0 char '(': push -> stack=['(']
index 1 char '[': push -> stack=['(', '[']
index 2 char ')': mismatch or empty stack -> stack=['(', '[']
Balanced? False
```

The second case shows exactly why "just count brackets" isn't enough: `([)]` has two opens and two closes of each type, but the *order* is wrong — `)` shows up while `[` (not `(`) is on top, which is caught immediately instead of only failing at the end.

## 5. Compare

A stack is the mirror image of the **queue** covered in the next lesson: a stack is LIFO (last in, first out), a queue is FIFO (first in, first out) — same two operations (add, remove) but from opposite ends conceptually. The **monotonic stack** (Lesson 3) is a plain stack with an extra invariant enforced on every push (values must stay increasing or decreasing), used for "next greater/smaller element" problems rather than simple LIFO undo/matching. The **min-stack** (Lesson 4) is a plain stack augmented with a second, parallel stack to answer a query (`getMin()`) that a bare stack can't answer in O(1). All three build directly on the push/pop mechanics introduced here — nothing about the underlying `append`/`pop` changes, only what you track alongside it.

## 6. Common Mistakes

- **Using `pop(0)` on a list for stack operations.** A stack only ever needs to touch one end, and that end should be the *end* of the Python list (`pop()`), not the front (`pop(0)`). Calling `pop(0)` removes the first element and shifts every remaining element left by one — O(n) — silently destroying the O(1) guarantee a stack is supposed to provide. If your "stack" code has `pop(0)` anywhere, it's actually behaving like a (slow) queue.
- **Popping without checking `is_empty()` first.** Calling `.pop()` on an empty list raises `IndexError`. Any pop that isn't preceded by (or guarded by) an emptiness check — like `if not stack or stack[-1] != pairs[ch]` in the example above — will crash on malformed input instead of correctly reporting "not balanced."
- **Confusing peek and pop.** Using `stack.pop()` when you only meant to *look* at the top (`stack[-1]`) destructively removes an element you may still need, corrupting later logic.
- **Assuming a fixed capacity.** Some interview prompts describe a "stack with max size" — if you don't explicitly check capacity before pushing, you'll silently accept pushes that should have been rejected (or, in a fixed-size array implementation, overwrite memory you don't own).
- **Forgetting the stack must end empty for balance-style checks.** It's easy to loop through the whole string, never hit a mismatch, and declare it balanced — but leftover unmatched openers (e.g. `"((("`) never trigger a pop-side failure, only an end-of-string emptiness check catches them.

## 7. Interview Angle

"Valid Parentheses" (this lesson's example) is one of the most commonly asked stack warm-ups — interviewers use it to check whether you reach for a stack automatically when you see "matching" or "nesting" language. Common variations: support multiple bracket types (shown above), allow other characters interspersed with the brackets, or ask you to find the *minimum number of insertions/removals* to make an unbalanced string balanced (still stack-based, just tracking counts of unmatched brackets instead of failing fast). Other classic stack framings: "evaluate Reverse Polish Notation," "implement a basic calculator with `+`/`-`/parentheses," and "design an undo/redo system." A frequent follow-up after you solve the base case: "can you do it with O(1) extra space?" — for balanced-parentheses-with-only-one-bracket-type, yes (a counter suffices); for multiple bracket types, no, you genuinely need the stack to know *which* opener is currently unmatched.

## 8. Memory Hook

**Stack = plates, not a queue at the deli.** Push and pop both happen at the *same* end (`append`/`pop()`), never at index 0 — the moment you write `pop(0)`, you've built a slow queue by accident, not a stack.
