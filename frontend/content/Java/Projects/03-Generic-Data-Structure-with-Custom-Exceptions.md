# Project 03 — Generic Data Structure with Custom Exceptions

## Goal

Design a small generic, fixed-capacity container class that fails predictably and informatively — via a custom checked exception — when misused, practicing the generics and exception-handling techniques from Phase 5.

## What You'll Build

A generic fixed-capacity `Stack<T>` (push/pop/peek, backed internally by a plain array or an `ArrayList<T>`) that throws a custom checked exception, `CapacityExceededException`, when a caller tries to push past its declared capacity, and a separate custom exception for popping from an empty stack.

## Phases Required

- Phase 5 — Generics and Exception Handling
- Phase 4 — Collections Framework (if you back the stack with an `ArrayList<T>` internally)

## Requirements

- Declare the container as a generic class, `Stack<T>`, with a constructor that takes a fixed `int capacity`.
- Implement `push(T item)`, `pop()`, `peek()`, `isEmpty()`, and `size()`.
- `push` must throw a custom checked exception, `CapacityExceededException extends Exception`, when called on a full stack — declared with `throws` on the method signature, per Phase 5's checked-exception rules.
- `pop` (and `peek`) must throw a second custom exception, `EmptyStackException` (your own class extending `Exception`, not to be confused with `java.util.EmptyStackException` — pick a distinct package/class name or note the collision explicitly), when called on an empty stack.
- Both custom exception classes must provide a constructor that forwards a descriptive message to `super(message)`, so callers get a clear reason for the failure, not just a generic type name.
- Write a small `main` method (or a separate demo class) exercising the stack with both a normal, entirely successful sequence of operations, and at least one deliberate failure of each kind (push past capacity, pop from empty), each caught and reported by name in its own `catch` block.
- Use the generic container with at least two different type arguments (e.g. `Stack<Integer>` and `Stack<String>`) to demonstrate genuine reuse across types with no casting anywhere in client code.

## Suggested Approach

1. Write the two custom exception classes first, each with a message-forwarding constructor, exactly as the course's `InsufficientFundsException` example does.
2. Write `Stack<T>` backed by an `Object[]` array cast internally, or more simply by a private `ArrayList<T>` (avoiding the generic-array-creation restriction entirely) — decide which and note your reasoning in a comment.
3. Implement `push`, checking current size against capacity before adding, throwing `CapacityExceededException` with a message naming both the attempted size and the configured capacity.
4. Implement `pop`/`peek`, checking emptiness first and throwing your `EmptyStackException` with a clear message if the stack has nothing in it.
5. Write a demo `main` that: pushes up to capacity successfully, then attempts one more push and catches the resulting exception by name; separately, pops everything off an empty stack and catches that exception too.
6. Re-run the same demo logic with a `Stack<String>` instead of `Stack<Integer>` to confirm the class behaves identically regardless of type argument, with the compiler — not a runtime cast — enforcing type safety throughout.

## Stretch Goals

- Add a bounded type parameter version, `Stack<T extends Comparable<T>>`, with a `max()` method that scans the stack's current contents and returns the largest element using `compareTo`.
- Make `EmptyStackException` unchecked (extending `RuntimeException` instead) as an experiment, and write a one-paragraph comment justifying which choice — checked or unchecked — is actually more appropriate here, per Phase 5 Lesson 3's checked-vs-unchecked design guidance.
- Add a `toArray()` or simple `toString()` method that prints the current contents from top to bottom without mutating the stack.

## Evaluation Checklist

- [ ] `Stack<T>` compiles and works correctly with at least two different type arguments, with zero manual casts in client code.
- [ ] Pushing past capacity throws `CapacityExceededException` with a message that names the actual capacity involved.
- [ ] Popping or peeking an empty stack throws your custom `EmptyStackException`, not a built-in exception type.
- [ ] Both custom exceptions are checked (`extends Exception`) and are declared with `throws` on every method that can throw them.
- [ ] The demo `main` method catches each custom exception by its specific type, not a generic `catch (Exception e)`.
