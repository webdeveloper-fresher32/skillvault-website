# Microtasks vs Macrotasks — Complete Guide

## Table of Contents
1. [The Queues Involved](#1-the-queues-involved)
2. [Priority Order — the Exact Rule](#2-priority-order--the-exact-rule)
3. [Worked Example 1 — Basic Ordering](#3-worked-example-1--basic-ordering)
4. [Worked Example 2 — nextTick Starvation](#4-worked-example-2--nexttick-starvation)
5. [Worked Example 3 — setInterval and Microtasks](#5-worked-example-3--setinterval-and-microtasks)
6. [Predict the Output — Challenge](#6-predict-the-output--challenge)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Queues Involved

Node.js has **four** distinct queues/mechanisms competing for the main thread, each with different priority:

| Queue | Populated by | Priority |
|-------|--------------|----------|
| **`process.nextTick` queue** | `process.nextTick(fn)` | Highest — drains fully before anything else, even before Promise microtasks |
| **Microtask queue** | `Promise.then/catch/finally`, `queueMicrotask()` | Second — drains fully after nextTick queue, before any macrotask |
| **Timers phase (macrotask)** | `setTimeout(fn, ms)`, `setInterval(fn, ms)` | Runs one phase's worth of due callbacks per loop iteration |
| **Check phase (macrotask)** | `setImmediate(fn)` | Runs after the poll phase, in the same iteration |

`process.nextTick` is technically NOT part of the "microtask queue" per the ECMAScript spec — it's a Node-specific mechanism that runs even before Promise microtasks — but conceptually it behaves like a microtask that jumps the queue.

---

## 2. Priority Order — the Exact Rule

After **every** synchronous operation completes (whether that's the initial script, or a single callback from any queue), Node runs this exact sequence before touching the next macrotask:

```
┌──────────────────────────────────────────────────────────────┐
│  1. Run current synchronous code until the call stack empties │
└────────────────────────────┬───────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  2. Drain process.nextTick queue COMPLETELY                    │
│     (including any nextTick callbacks added DURING this drain) │
└────────────────────────────┬───────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  3. Drain microtask queue COMPLETELY (Promise callbacks)        │
│     (including any microtasks added DURING this drain —        │
│      AND if a microtask calls process.nextTick, go back to      │
│      step 2 before continuing step 3!)                          │
└────────────────────────────┬───────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  4. Run ONE macrotask (e.g. one timer callback due, or move    │
│     into the next event loop phase)                             │
└────────────────────────────┬───────────────────────────────────┘
                             ▼
                    repeat from step 2
```

**Key insight:** steps 2 and 3 run between **every single macrotask**, not just once per "round." This is why microtasks can "starve" macrotasks if they keep scheduling more microtasks (see Worked Example 2).

---

## 3. Worked Example 1 — Basic Ordering

```javascript
console.log('A: sync start');

setTimeout(() => console.log('B: setTimeout'), 0);

setImmediate(() => console.log('C: setImmediate'));

Promise.resolve()
  .then(() => console.log('D: promise 1'))
  .then(() => console.log('E: promise 2'));

process.nextTick(() => console.log('F: nextTick 1'));
process.nextTick(() => console.log('G: nextTick 2'));

console.log('H: sync end');

/*
Output:
A: sync start
H: sync end
F: nextTick 1
G: nextTick 2
D: promise 1
E: promise 2
B: setTimeout        (order vs C is non-deterministic at top level)
C: setImmediate

Step by step:
1. Synchronous code runs top to bottom: 'A', 'H' (all setTimeout/setImmediate/
   Promise/nextTick calls just SCHEDULE work, they don't run yet).
2. Call stack empties → nextTick queue drains fully: 'F', then 'G'.
3. Microtask queue drains fully: 'D' logs, its .then() schedules a NEW
   microtask ('E'), which ALSO runs before we leave step 3 (fully drains,
   including newly-added ones): 'E'.
4. Only now does the loop enter its phases: timers phase → 'B',
   check phase → 'C'. Order between B/C at the top level is not guaranteed.
*/
```

---

## 4. Worked Example 2 — nextTick Starvation

```javascript
let count = 0;

function recursiveNextTick() {
  count++;
  if (count <= 3) {
    console.log('nextTick call #' + count);
    process.nextTick(recursiveNextTick); // schedules ANOTHER nextTick
  }
}

process.nextTick(recursiveNextTick);
setTimeout(() => console.log('setTimeout finally runs'), 0);

console.log('sync code');

/*
Output:
sync code
nextTick call #1
nextTick call #2
nextTick call #3
setTimeout finally runs

Explanation: the nextTick queue must drain COMPLETELY — including tasks
ADDED during the drain — before the event loop is allowed to proceed to
timers. Each call to recursiveNextTick schedules another nextTick callback,
so the queue never appears "empty" until count > 3. In real production
code, recursively calling process.nextTick without a base case will starve
ALL I/O and timers forever — this is a well-known Node foot-gun.
*/
```

---

## 5. Worked Example 3 — setInterval and Microtasks

```javascript
let ticks = 0;

const intervalId = setInterval(() => {
  ticks++;
  console.log('interval tick', ticks);

  // Schedule a microtask INSIDE the macrotask callback
  Promise.resolve().then(() => console.log('  microtask during tick', ticks));

  if (ticks === 3) clearInterval(intervalId);
}, 50);

/*
Output:
interval tick 1
  microtask during tick 1
interval tick 2
  microtask during tick 2
interval tick 3
  microtask during tick 3

Explanation: setInterval callbacks are macrotasks — only ONE runs per
event loop iteration (this "iteration" is really the timers phase
executing due callbacks). After EACH interval callback (a macrotask)
finishes, Node drains the microtask queue COMPLETELY before doing
anything else — including before running the NEXT interval tick, even
if 50ms have already elapsed. This is why the microtask always prints
immediately after its corresponding tick, never batched at the end.
*/
```

---

## 6. Predict the Output — Challenge

Try to predict the exact output of this snippet **before** running it. Answer and explanation follow.

```javascript
console.log('1');

setTimeout(() => {
  console.log('2');
  Promise.resolve().then(() => console.log('3'));
}, 0);

Promise.resolve().then(() => {
  console.log('4');
  process.nextTick(() => console.log('5'));
});

process.nextTick(() => {
  console.log('6');
  Promise.resolve().then(() => console.log('7'));
});

console.log('8');
```

<details>
<summary>Click to reveal the answer and explanation</summary>

```
Output:
1
8
6
4
7
5
2
3
```

**Step by step:**
1. Sync code runs: `1`, `8` print. `setTimeout`, the first `.then`, and the first `nextTick` are all scheduled.
2. Call stack empties → drain `nextTick` queue: the callback logging `6` runs. Inside it, `Promise.resolve().then(...)` schedules a NEW microtask (will log `7`). nextTick queue is now empty (nothing else was queued directly to nextTick) → move to microtask queue.
3. Drain microtask queue fully: first the original `.then` scheduled in step 1 runs, logging `4`; inside it, `process.nextTick(...)` schedules a callback (will log `5`) — but since we're mid-microtask-drain, does nextTick jump back in immediately? **Yes** — Node checks the nextTick queue between every microtask (and drains it before continuing the microtask queue), so `5` prints next. Then the microtask queue continues draining: the `7` microtask (scheduled in step 2) runs, logging `7`.
   Actual fine-grained order in step 3: after `4` logs and queues nextTick(`5`), Node drains nextTick immediately → `5` logs → then returns to draining remaining microtasks → `7` logs.
4. All nextTick + microtasks are now empty → event loop proceeds to the timers phase: the `setTimeout` callback runs, logging `2`, and schedules a new microtask (will log `3`).
5. That macrotask callback (`2`) finishes → drain microtasks again → `3` logs.

Final order: `1, 8, 6, 4, 5, 7, 2, 3`

**Note:** exact interleaving of nextTick vs. microtask when both add to each other's queues is a genuinely advanced edge case — the reliable, always-tested rule for interviews is simpler: "nextTick queue fully drains before microtasks, microtasks fully drain before the next macrotask, and this repeats before every single macrotask."
</details>

---

## 7. Hands-On Exercises

**Exercise 1:** Run Worked Example 1 verbatim. Confirm the nextTick/microtask/macrotask ordering matches the explanation.

**Exercise 2:** Run Worked Example 2 (nextTick starvation). Then modify it to recurse 100,000 times instead of 3, with a `setImmediate` scheduled before the recursive nextTick chain starts. Observe how long the `setImmediate` callback is delayed — this demonstrates real starvation risk.

**Exercise 3:** Rewrite Worked Example 3 using `setImmediate` recursively instead of `setInterval`, keeping the same "schedule a microtask inside each tick" pattern. Confirm the same immediate-microtask-after-each-macrotask behavior holds.

**Exercise 4:** Attempt the "Predict the Output" challenge on paper without running it, comparing against a partner's or your own prediction. Then run it in Node and reconcile any differences with the step-by-step trace.

**Exercise 5:** Write your own "predict the output" snippet using at least 2 `process.nextTick`, 2 `Promise.then`, 1 `setTimeout`, and 1 `setImmediate`, deliberately nesting some inside others. Trade with a study partner (or re-attempt after a day) to test retention.

---

## 8. Interview Q&A

**Q: What's the priority order between `process.nextTick`, Promise microtasks, and macrotasks like `setTimeout`?**
Answer: `process.nextTick` has the highest priority — its queue drains completely (including tasks added during the drain) before Node touches the Promise microtask queue. The microtask queue then drains completely before the event loop proceeds to run even one macrotask (a `setTimeout`/`setInterval`/`setImmediate`/I/O callback). This nextTick-then-microtask-then-one-macrotask sequence repeats before every single macrotask, not just once at the start.

**Q: Why is `process.nextTick` considered dangerous if used recursively?**
Answer: Because the nextTick queue must fully drain — including any new callbacks scheduled during the drain — before the event loop can proceed to timers, I/O, or any other phase. If a `process.nextTick` callback keeps scheduling more `process.nextTick` callbacks (e.g., in a recursive loop without a base case), the event loop can never move past that queue, starving all timers, I/O callbacks, and `setImmediate` callbacks indefinitely — effectively freezing the application's async progress even though it appears "not blocked" in the traditional CPU sense.

**Q: Is `process.nextTick` part of the microtask queue as defined by the ECMAScript spec?**
Answer: No — `process.nextTick` is a Node.js-specific API, not part of the ECMAScript Promise/microtask specification. It has its own separate, even-higher-priority queue than Promise microtasks. Conceptually it behaves like a microtask (draining before the next macrotask), but Node processes it before the actual Promise microtask queue.

**Q: If a Promise `.then()` callback schedules a `process.nextTick`, does it run before other pending microtasks?**
Answer: Yes. Node checks and drains the `process.nextTick` queue between processing individual microtasks, not just once before the whole microtask queue starts. So a `nextTick` scheduled from inside a microtask jumps ahead of any other microtasks still waiting in the queue.

**Q: How many `setTimeout`/`setInterval` callbacks run per event loop iteration, and how does that interact with microtasks?**
Answer: In each pass through the timers phase, Node runs all currently-due timer callbacks it finds — but after each individual callback, it drains the nextTick and microtask queues fully before running the next one. So if two timers become due, their callbacks don't run back-to-back without a microtask checkpoint in between; any microtasks scheduled by the first timer's callback resolve before the second timer's callback executes.

**Q: What's the practical performance risk of scheduling too many microtasks (e.g., long Promise chains) inside a hot code path?**
Answer: Because the microtask queue must fully drain before the event loop can proceed to timers, I/O, or any macrotask phase, an application that continuously schedules new microtasks (e.g., a recursive `.then()` chain with no natural end) can delay timer callbacks, `setImmediate` callbacks, and incoming I/O event processing — similar to (though generally less severe than) `process.nextTick` starvation, since the event loop never gets a chance to check for new I/O events.

**Q: Why might `setTimeout(fn, 0)` and `setImmediate(fn)` fire in a different, non-deterministic order when called at the top level of a script, but in a guaranteed order inside an I/O callback?**
Answer: At the top level, both timers are "due immediately" and the event loop hasn't yet entered any particular phase — whichever phase (timers or check) the loop happens to reach first at process startup determines which fires first, and this can vary based on system performance and process initialization overhead. Inside an I/O callback, execution is already inside the poll phase; when poll completes, the loop deterministically transitions straight into the check phase (running `setImmediate`) before ever cycling back around to the timers phase (running `setTimeout`), making the order fixed and predictable.
