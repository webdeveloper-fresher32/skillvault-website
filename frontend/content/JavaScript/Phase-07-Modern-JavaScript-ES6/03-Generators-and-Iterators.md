# Generators and Iterators — Complete Guide

## Table of Contents
1. [The Iterator Protocol](#1-the-iterator-protocol)
2. [Symbol.iterator and Iterables](#2-symboliterator-and-iterables)
3. [Building a Custom Iterable](#3-building-a-custom-iterable)
4. [Generator Functions](#4-generator-functions)
5. [Generators as Iterables](#5-generators-as-iterables)
6. [Lazy Evaluation and Infinite Sequences](#6-lazy-evaluation-and-infinite-sequences)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Iterator Protocol

The **iterator protocol** is the formal contract that makes `for...of`, the spread operator (`...`), and destructuring work on a value. An object is an **iterator** if it has a `.next()` method that returns an object shaped exactly like `{ value: any, done: boolean }`.

```
The Iterator Protocol contract:

  An object IS an iterator if it has a method:

    next() → { value: <anything>, done: <true|false> }

  Calling .next() repeatedly must:
    - Return { value: X, done: false } for each item produced
    - Return { value: undefined, done: true } once exhausted
      (value MAY be omitted or provided as a final "return value")

That's the ENTIRE contract. No inheritance, no specific class needed —
just an object with a next() method matching this exact shape.
```

```js
// A hand-written iterator over a fixed range — no built-in helpers used at all
function createRangeIterator(start, end) {
  let current = start;
  return {
    next() {
      if (current <= end) {
        return { value: current++, done: false };
      }
      return { value: undefined, done: true };
    },
  };
}

const it = createRangeIterator(1, 3);
console.log(it.next()); // { value: 1, done: false }
console.log(it.next()); // { value: 2, done: false }
console.log(it.next()); // { value: 3, done: false }
console.log(it.next()); // { value: undefined, done: true }
console.log(it.next()); // { value: undefined, done: true } — stays done forever
```

---

## 2. Symbol.iterator and Iterables

An **iterator** (Section 1) produces values one at a time. An **iterable** is a different, related concept: an object with a method at the special key `Symbol.iterator` that, when called, **returns an iterator**. This is what `for...of` actually looks for.

```
Iterator             vs           Iterable
─────────────────────────────────────────────────────────
Has a .next() method              Has a [Symbol.iterator]()
                                    method that RETURNS an iterator

Produces values one at a time      Is the thing you loop over
via repeated .next() calls          with for...of

Example: the object returned       Example: arrays, strings, Maps,
by createRangeIterator() above      Sets — all built-in iterables

  for (const x of someIterable) { ... }

  is roughly equivalent, under the hood, to:

  const iterator = someIterable[Symbol.iterator]();
  let result = iterator.next();
  while (!result.done) {
    const x = result.value;
    // ...loop body...
    result = iterator.next();
  }
```

```js
const arr = [10, 20, 30];
const arrIterator = arr[Symbol.iterator](); // arrays are iterables — they HAVE this method
console.log(arrIterator.next()); // { value: 10, done: false }
console.log(arrIterator.next()); // { value: 20, done: false }

console.log(typeof arr[Symbol.iterator]);       // "function" — arrays are iterable
console.log(typeof arr.next);                    // "undefined" — the ARRAY itself is not an iterator,
                                                    // only what [Symbol.iterator]() RETURNS is
```

Plain objects are **not** iterable by default — `for (const x of plainObject)` throws `TypeError: plainObject is not iterable`, which is precisely why `for...in` (which loops over keys of any object) and `for...of` (which requires `Symbol.iterator`) are different constructs.

---

## 3. Building a Custom Iterable

To make your own object work with `for...of`, spread syntax, and destructuring, implement `[Symbol.iterator]` so it returns an iterator (an object with `.next()`).

```js
class NumberRange {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }
}

const range = new NumberRange(1, 5);

for (const num of range) {
  console.log(num); // 1, 2, 3, 4, 5
}

console.log([...range]);           // [1, 2, 3, 4, 5] — spread works because it's iterable
const [first, second] = range;      // destructuring works too
console.log(first, second);          // 1 2
```

Because `NumberRange` now implements `Symbol.iterator`, it automatically works with every language construct built on the iterable protocol — `for...of`, spread, destructuring, `Array.from(range)` — without any of them needing to know anything specific about `NumberRange` itself.

---

## 4. Generator Functions

Writing the `next()`/`done` bookkeeping by hand, as in Sections 1 and 3, is tedious and error-prone for anything non-trivial. **Generator functions** (`function*`) let the JavaScript engine handle that bookkeeping for you — you write what looks like ordinary imperative code with pause points marked by `yield`, and the engine automatically produces a correctly-shaped iterator.

```js
function* numberGenerator() {
  console.log("Generator started");
  yield 1;
  console.log("Resumed after first yield");
  yield 2;
  console.log("Resumed after second yield");
  yield 3;
  console.log("Generator finishing");
}

const gen = numberGenerator(); // calling it does NOT run any code yet — see below
console.log("Generator created, nothing logged yet");

console.log(gen.next()); // "Generator started"          → { value: 1, done: false }
console.log(gen.next()); // "Resumed after first yield"   → { value: 2, done: false }
console.log(gen.next()); // "Resumed after second yield"  → { value: 3, done: false }
console.log(gen.next()); // "Generator finishing"         → { value: undefined, done: true }
```

```
Execution model of a generator:

  Calling numberGenerator() does NOT execute the function body at all —
  it immediately returns a generator object (which is BOTH an iterator
  AND an iterable — see Section 5).

  Each call to .next() runs the function body starting from wherever
  it last paused, UP TO the next `yield` statement, then PAUSES
  execution again right there — the entire local state (variables,
  loop position, everything) is preserved between calls.

  This is fundamentally different from a normal function, which
  always runs start-to-finish in one go and cannot pause partway
  through and later resume exactly where it left off.
```

### `yield` Can Also Receive Values

```js
function* echoGenerator() {
  const first = yield "What's your name?";
  const second = yield `Nice to meet you, ${first}!`;
  return `Conversation with ${first} ended after: ${second}`;
}

const convo = echoGenerator();
console.log(convo.next());           // { value: "What's your name?", done: false }
console.log(convo.next("Ganesh"));   // "Ganesh" becomes the value of the FIRST yield expression
                                       // → { value: "Nice to meet you, Ganesh!", done: false }
console.log(convo.next("goodbye"));  // → { value: "Conversation with Ganesh ended after: goodbye", done: true }
```

---

## 5. Generators as Iterables

A generator object satisfies the iterable protocol too (it has its own `[Symbol.iterator]` method, which just returns itself), so generators plug directly into `for...of`, spread, and destructuring — you never need to manually call `.next()` unless you specifically need that level of control.

```js
function* numberGenerator() {
  yield 1;
  yield 2;
  yield 3;
}

for (const num of numberGenerator()) {
  console.log(num); // 1, 2, 3
}

console.log([...numberGenerator()]); // [1, 2, 3]

// Rewriting the NumberRange class from Section 3 using a generator —
// dramatically shorter than the manual next()/done bookkeeping version:
class NumberRange {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  *[Symbol.iterator]() { // a generator METHOD — note the * before the method name
    for (let i = this.start; i <= this.end; i++) {
      yield i;
    }
  }
}

console.log([...new NumberRange(1, 5)]); // [1, 2, 3, 4, 5] — same result, far less code
```

---

## 6. Lazy Evaluation and Infinite Sequences

Because a generator only computes the next value when `.next()` is actually called, it can represent **infinite sequences** safely — something a plain array or eagerly-computed list could never do without exhausting memory.

```js
function* infiniteCounter() {
  let n = 1;
  while (true) { // an infinite loop — perfectly safe INSIDE a generator
    yield n++;
  }
}

const counter = infiniteCounter();
console.log(counter.next().value); // 1
console.log(counter.next().value); // 2
console.log(counter.next().value); // 3
// The while(true) never actually "runs forever" in the blocking sense —
// it only advances one step per .next() call, then pauses again.

// A practical use: take only the first N values from an infinite generator
function take(iterable, n) {
  const result = [];
  const iterator = iterable[Symbol.iterator]();
  for (let i = 0; i < n; i++) {
    const { value, done } = iterator.next();
    if (done) break;
    result.push(value);
  }
  return result;
}

console.log(take(infiniteCounter(), 5)); // [1, 2, 3, 4, 5]

// Lazy Fibonacci sequence — computes each value ONLY when requested
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
console.log(take(fibonacci(), 8)); // [0, 1, 1, 2, 3, 5, 8, 13]
```

```
Why "lazy evaluation" matters here:

  An eagerly-computed alternative — say, a function that BUILDS an
  array of the first N Fibonacci numbers and returns it — has to
  decide N up front, and recomputes everything from scratch if you
  later want a few more values.

  A generator computes ONE value at a time, ONLY when asked (via
  .next()), and REMEMBERS where it left off between calls. You can
  ask for 5 values, then later ask for 5 more, without redoing any
  earlier work, and without ever needing to decide a hard upper
  limit in advance — the sequence can be conceptually infinite while
  using a constant, tiny amount of memory at any given moment.
```

---

## 7. Hands-On Exercises

**Exercise 1:** Without using a generator, hand-write a plain iterator object (like `createRangeIterator` in Section 1) that produces the powers of 2 up to a given maximum exponent (e.g., up to 2^10). Verify it behaves correctly by calling `.next()` manually multiple times and checking the `{ value, done }` shape at each step, including after exhaustion.

**Exercise 2:** Build a custom `LinkedList` class with `add(value)` and implement `[Symbol.iterator]` on it (using a hand-written iterator, not a generator) so that `for...of`, spread, and array destructuring all work correctly over its elements in insertion order.

**Exercise 3:** Rewrite the `LinkedList` iterator from Exercise 2 using a generator method (`*[Symbol.iterator]() { ... }`) instead, and confirm it produces identical behavior with significantly less code.

**Exercise 4:** Write a generator function `naturalNumbers()` that yields 1, 2, 3, 4, ... forever, and a separate generator function `evenNumbers()` that yields only even numbers forever. Then write a generic `takeWhile(generator, predicate)` helper that pulls values from any infinite generator only while a given predicate holds true, and use it to collect all even numbers below 20 from `naturalNumbers()` (by filtering), and separately, the first 10 values from `evenNumbers()` directly.

**Exercise 5:** Implement the "conversation" pattern from Section 4 (a generator that both yields prompts and receives answers via `.next(value)`) to build a simple interactive quiz generator that asks 3 questions one at a time, collects the answers passed into subsequent `.next()` calls, and finally yields/returns a summary object containing all three question-answer pairs.

---

## 8. Interview Q&A

**Q: What is the iterator protocol, and what is the minimum requirement for an object to be considered an iterator?**
Answer: The iterator protocol is a formal, minimal contract: an object qualifies as an iterator if it has a `.next()` method that, each time it's called, returns an object of the exact shape `{ value, done }`, where `value` is the produced item and `done` is a boolean indicating whether the sequence has been exhausted. There is no inheritance requirement, no specific class or built-in type needed — any plain object with a correctly-shaped `.next()` method satisfies the protocol and can be manually driven by repeatedly calling `.next()`. This is deliberately minimal and duck-typed, consistent with JavaScript's general preference for structural contracts over nominal ones, and it's the foundation that both hand-written iterators and generator-produced iterators equally satisfy.

**Q: What is the difference between an iterator and an iterable, and how does `for...of` use that distinction?**
Answer: An iterator is an object that produces values on demand via repeated `.next()` calls, following the `{ value, done }` shape. An iterable is a distinct, related concept — an object that has a method at the special key `Symbol.iterator` which, when invoked, returns an iterator; being iterable is what qualifies an object to be looped over directly with `for...of`, spread into an array, or destructured. When you write `for (const x of someValue)`, the engine calls `someValue[Symbol.iterator]()` to obtain an iterator, then repeatedly calls `.next()` on that iterator, extracting `.value` on each iteration and stopping once `.done` is `true`. Built-ins like arrays, strings, `Map`, and `Set` are all iterables because they each implement `Symbol.iterator`; a plain object literal is not, which is exactly why `for (const x of plainObject)` throws a `TypeError` while `for...in` (a different, older construct that loops over enumerable keys rather than requiring the iterable protocol) works fine on the same object.

**Q: How do generator functions simplify building custom iterators, and what does the `yield` keyword actually do?**
Answer: Writing a manual iterator requires you to maintain state (like a current index) yourself across separate `.next()` calls and construct the `{ value, done }` object by hand every time, which becomes unwieldy for anything beyond a simple counter. A generator function, declared with `function*`, lets you instead write what looks like ordinary sequential, imperative code — loops, conditionals, local variables — and mark pause points with `yield`; the JavaScript engine automatically produces a conforming iterator (and iterable) object for you, handling all the `{ value, done }` bookkeeping internally. `yield` pauses the generator's execution at that exact point, returning the yielded value wrapped in `{ value, done: false }` to whoever called `.next()`, and preserving every bit of the function's local state — variables, loop counters, the exact point of execution — until the next `.next()` call resumes it precisely where it left off, running until the next `yield` or until the function returns, at which point `done` becomes `true`.

**Q: How can generators represent an infinite sequence, like all natural numbers, without ever running out of memory or hanging the program?**
Answer: A generator's body only actually executes up to the next `yield` each time `.next()` is called — it does not run to completion in one blocking pass, even if its logic contains a `while (true)` loop, because execution pauses at each `yield` and waits for the next `.next()` call to resume. This means an infinite generator like `function* infiniteCounter() { let n = 1; while (true) { yield n++; } }` never actually "runs forever" in a blocking sense; it advances exactly one step per `.next()` call and then suspends again, using a small, constant amount of memory to track its current state (just the value of `n` in this example) rather than materializing an ever-growing list of values. This is what "lazy evaluation" means in this context: values are computed one at a time, strictly on demand, which lets you safely represent conceptually infinite or very large sequences and consume only as many values as you actually need — for example using a `take(iterable, n)` helper to pull just the first N values — without ever attempting to compute or store the whole sequence at once.

**Q: Besides producing values via `yield`, can a generator also receive values back from the caller? How does that work?**
Answer: Yes — `yield` is actually an expression, not just a statement, and the value passed into the *next* call to `.next(value)` becomes the result of the `yield` expression that's currently paused, letting values flow both directions between the generator and its caller across separate calls. For example, `const answer = yield "What's your name?"` pauses the generator, returning the prompt string to the caller via `{ value: "What's your name?", done: false }`; whatever the caller then passes into the following `.next("Ganesh")` call becomes the value assigned to `answer` when the generator resumes. This bidirectional communication pattern is the basis for more advanced generator use cases, such as implementing coroutine-like interactive flows (a step-by-step quiz or wizard) or, historically, was one of the mechanisms used to hand-roll async control flow before native `async`/`await` existed, by pairing generators with a driver function that fed resolved Promise values back in via `.next()`.
