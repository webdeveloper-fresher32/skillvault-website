# Events and EventEmitter — Complete Guide

## Table of Contents
1. [Why Node's Architecture is Event-Driven](#1-why-nodes-architecture-is-event-driven)
2. [The EventEmitter Class](#2-the-eventemitter-class)
3. [on, once, emit, off](#3-on-once-emit-off)
4. [Passing Data with Events](#4-passing-data-with-events)
5. [Error Events — A Special Case](#5-error-events--a-special-case)
6. [Building a Custom Event-Driven Class](#6-building-a-custom-event-driven-class)
7. [Common Patterns](#7-common-patterns)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why Node's Architecture is Event-Driven

Node.js is built around a **single-threaded, non-blocking, event-driven** model. Instead of blocking and waiting for something to finish (a file read, a network request, a timer), Node registers a callback to run **when the event happens**, and moves on immediately to other work.

```
Traditional blocking model (e.g. classic synchronous Python script):

  doSomethingSlow() ──▶ [ BLOCKS HERE until done ] ──▶ next line runs


Node's event-driven model:

  startSomethingSlow(onDone)  ──▶ registers onDone, RETURNS IMMEDIATELY
  ...next line runs right away...
  ...event loop keeps spinning, handling other events...
  [ when the slow thing finishes ]  ──▶  onDone() callback fires
```

`EventEmitter` is the concrete mechanism Node uses to implement this pattern. It is the base class (or the underlying pattern) behind an enormous amount of Node's core API:

```
Built on EventEmitter (directly or via inheritance):
  - http.Server            (emits 'request', 'connection', 'close')
  - fs.ReadStream / WriteStream  (emits 'data', 'end', 'error', 'finish')
  - net.Socket / TCP sockets     (emits 'data', 'connect', 'close')
  - process                (emits 'exit', 'uncaughtException', 'SIGINT')
  - child_process.ChildProcess   (emits 'exit', 'message', 'error')
```

Once you understand `EventEmitter`, a huge portion of Node's API surface stops looking like separate things to memorize and starts looking like the same pattern applied everywhere.

---

## 2. The EventEmitter Class

```javascript
const EventEmitter = require('events');

const emitter = new EventEmitter();

// Register a listener for the 'greet' event
emitter.on('greet', (name) => {
  console.log(`Hello, ${name}!`);
});

// Trigger the event, synchronously calling all registered listeners
emitter.emit('greet', 'Ganesh');
// → "Hello, Ganesh!"
```

```
Mental model:

  emitter.on('eventName', listenerFn)   → "subscribe: call listenerFn whenever
                                            'eventName' is emitted"
  emitter.emit('eventName', ...args)    → "publish: run every listener
                                            registered for 'eventName', NOW,
                                            synchronously, in registration order"
```

Note: `emit()` calls listeners **synchronously**, in the same tick — it does not itself introduce asynchrony. Asynchronous behavior comes from *when* you choose to call `emit()` (e.g., after an I/O callback fires).

---

## 3. on, once, emit, off

```javascript
const EventEmitter = require('events');
const emitter = new EventEmitter();

// on: listener fires EVERY time the event is emitted
emitter.on('tick', () => console.log('tick!'));

// once: listener fires only the FIRST time, then auto-removes itself
emitter.once('start', () => console.log('Started! (only logs once)'));

emitter.emit('start'); // "Started! (only logs once)"
emitter.emit('start'); // (nothing — listener was already removed)

emitter.emit('tick'); // "tick!"
emitter.emit('tick'); // "tick!" (fires again — 'on' listeners persist)

// off (alias: removeListener): unsubscribe a specific listener
function onTick() {
  console.log('a single tick handler');
}
emitter.on('tick', onTick);
emitter.off('tick', onTick); // must pass the SAME function reference

// removeAllListeners: remove every listener for an event (use sparingly)
emitter.removeAllListeners('tick');

// listenerCount: introspect how many listeners are registered
console.log(emitter.listenerCount('tick')); // 0
```

| Method | Behavior |
|--------|----------|
| `.on(event, fn)` | Register a persistent listener (fires every emit) |
| `.once(event, fn)` | Register a listener that auto-removes after firing once |
| `.emit(event, ...args)` | Synchronously invoke all listeners for `event` with the given args |
| `.off(event, fn)` / `.removeListener(event, fn)` | Remove a specific listener (must be the same function reference) |
| `.removeAllListeners([event])` | Remove all listeners (for one event, or all events if omitted) |
| `.listenerCount(event)` | Number of listeners currently registered for an event |

**Important gotcha:** you cannot `.off()` an anonymous inline arrow function you passed to `.on()` — you need a named reference to the same function to remove it later.

---

## 4. Passing Data with Events

Any arguments passed to `.emit()` after the event name are forwarded to every listener.

```javascript
const EventEmitter = require('events');
const emitter = new EventEmitter();

emitter.on('order-placed', (order) => {
  console.log(`New order #${order.id} for $${order.total}`);
});

emitter.on('order-placed', (order) => {
  // multiple independent listeners can react to the SAME event
  sendConfirmationEmail(order);
});

function sendConfirmationEmail(order) {
  console.log(`Emailing confirmation for order #${order.id}`);
}

emitter.emit('order-placed', { id: 1024, total: 49.99 });
```

```
This is the classic "decoupling via events" benefit:

  Without events:                     With events:
  placeOrder() {                      placeOrder() {
    saveToDb();                         saveToDb();
    sendEmail();      ← tightly         emitter.emit('order-placed', order);
    updateInventory();  coupled       }
    logAnalytics();
  }                                    // Each concern subscribes independently —
                                       // placeOrder() doesn't need to know
                                       // about email, inventory, or analytics.
```

---

## 5. Error Events — A Special Case

`EventEmitter` treats the `'error'` event specially: **if an `'error'` event is emitted and there is no listener registered for it, Node throws the error and crashes the process.**

```javascript
const EventEmitter = require('events');
const emitter = new EventEmitter();

// DANGEROUS — no 'error' listener registered
// emitter.emit('error', new Error('Something broke'));
// → throws uncaught, crashes the process!

// SAFE — always register an 'error' listener on any EventEmitter
// that might emit one (streams, sockets, etc. commonly do)
emitter.on('error', (err) => {
  console.error('Handled error:', err.message);
});

emitter.emit('error', new Error('Something broke')); // now handled gracefully
```

This is why every stream example in the Streams lesson includes a `.on('error', ...)` handler — it's not optional boilerplate, it's preventing a crash.

---

## 6. Building a Custom Event-Driven Class

A common real-world pattern: model a domain object as an `EventEmitter` subclass so other parts of the app can react to its state changes without polling.

```javascript
const EventEmitter = require('events');

class OrderProcessor extends EventEmitter {
  constructor() {
    super(); // MUST call super() to initialize EventEmitter internals
    this.orders = [];
  }

  placeOrder(order) {
    this.orders.push(order);
    this.emit('order-placed', order);

    // Simulate async payment processing
    setTimeout(() => {
      const success = Math.random() > 0.1; // 90% success rate
      if (success) {
        this.emit('order-fulfilled', order);
      } else {
        this.emit('order-failed', order, new Error('Payment declined'));
      }
    }, 100);
  }
}

const processor = new OrderProcessor();

processor.on('order-placed', (order) => {
  console.log(`[LOG] Order #${order.id} placed`);
});

processor.on('order-fulfilled', (order) => {
  console.log(`[EMAIL] Sending receipt for order #${order.id}`);
});

processor.on('order-failed', (order, err) => {
  console.log(`[ALERT] Order #${order.id} failed: ${err.message}`);
});

processor.on('error', (err) => {
  console.error('[FATAL] Unhandled processor error:', err.message);
});

processor.placeOrder({ id: 1, total: 29.99 });
processor.placeOrder({ id: 2, total: 15.5 });
```

```
Why extend EventEmitter instead of accepting callback functions directly?

  Callback-based:                      EventEmitter-based:
  processor.placeOrder(order,          processor.on('order-fulfilled', ...);
    onFulfilled, onFailed);            processor.on('order-failed', ...);
                                       processor.placeOrder(order);

  - Only ONE handler per outcome       - Multiple independent listeners can
  - Caller must know all callbacks       subscribe to the SAME event
    up front                           - New listeners can be added LATER,
                                          from anywhere, without touching
                                          the emitting code
```

---

## 7. Common Patterns

**Pattern: Guard against memory leaks from too many listeners**

```javascript
const emitter = new (require('events'))();

// Node warns by default if more than 10 listeners are added for one event
// (usually indicates a leak — e.g., adding a listener inside a loop or on
// every request instead of once at startup)
emitter.setMaxListeners(20); // raise the limit if genuinely needed
```

**Pattern: Wait for an event with a Promise (useful with async/await)**

```javascript
const { once } = require('events');

async function waitForReady(emitter) {
  await once(emitter, 'ready'); // resolves when 'ready' is next emitted
  console.log('Emitter is ready!');
}
```

**Pattern: Use events to decouple modules in an Express-adjacent app**

```javascript
const EventEmitter = require('events');
const appEvents = new EventEmitter();

// In your route handler:
// appEvents.emit('user-registered', newUser);

// Elsewhere, completely decoupled modules react independently:
appEvents.on('user-registered', (user) => console.log(`Welcome email → ${user.email}`));
appEvents.on('user-registered', (user) => console.log(`Analytics: signup for ${user.id}`));
```

---

## 8. Hands-On Exercises

**Exercise 1:** Create an `EventEmitter`, register two separate `.on('greet', ...)` listeners that each log a different message, and call `.emit('greet', 'World')` — confirm both fire.

**Exercise 2:** Register a `.once('login', ...)` listener on an emitter, emit `'login'` twice, and confirm the listener only fires the first time.

**Exercise 3:** Build a `Timer` class extending `EventEmitter` that emits a `'tick'` event every second (via `setInterval`) with the current elapsed seconds as an argument, and emits a `'done'` event after 5 ticks, then stops itself.

**Exercise 4:** Demonstrate the crash behavior of an unhandled `'error'` event: emit `'error'` on an `EventEmitter` with no listener registered inside a `try/catch` — note that `try/catch` does NOT catch it (it's thrown asynchronously via the event system, not synchronously from `emit()` in a way try/catch expects... actually verify experimentally what happens and explain your observation in a comment).

**Exercise 5:** Build a small `TaskQueue` class extending `EventEmitter` with an `addTask(fn)` method that runs tasks one at a time, emitting `'task-start'`, `'task-complete'`, and `'queue-empty'` events at the appropriate points.

---

## 9. Interview Q&A

**Q: Why is Node.js described as "event-driven," and how does EventEmitter relate to that?**
Answer: Node uses a single-threaded, non-blocking I/O model — rather than blocking execution while waiting on an operation (file read, network call, timer), it registers a callback and continues executing other code, with the callback invoked later when the operation completes. `EventEmitter` is the concrete class Node uses to implement "notify me when X happens" throughout its core API — `http.Server`, streams, `process`, and sockets are all built on `EventEmitter` (or its pattern), so understanding it explains the shape of most of Node's built-in async APIs.

**Q: What's the difference between `.on()` and `.once()`?**
Answer: `.on(event, listener)` registers a listener that fires every single time the event is emitted, for the lifetime of the emitter (or until explicitly removed). `.once(event, listener)` registers a listener that fires only on the next emission of that event, then automatically removes itself — useful for one-time setup events like `'ready'` or `'connect'` where you don't want duplicate handling if the event somehow fires again.

**Q: Is `emitter.emit()` synchronous or asynchronous?**
Answer: `emit()` itself is synchronous — it calls every registered listener immediately, in registration order, in the same call stack/tick, and only returns after all listeners have run (or thrown). Any asynchronous behavior comes from where and when you choose to call `emit()` — e.g., calling it inside an I/O callback that itself fires asynchronously — not from `emit()` itself introducing a delay.

**Q: What happens if you emit an `'error'` event on an `EventEmitter` with no listener registered for it?**
Answer: Node treats `'error'` specially: if there's no listener for it, the error is thrown and, if uncaught elsewhere, crashes the Node process. This is different from every other event name, where emitting with no listeners is a silent no-op. Because of this, any code working with `EventEmitter`-based objects that can emit errors (streams, sockets, custom emitters) should always register an `'error'` listener defensively.

**Q: How would you build a custom class with event-emitting behavior, and what's the one crucial step people forget?**
Answer: Extend `EventEmitter` (`class MyClass extends EventEmitter`) and call `emit()` internally at meaningful points in the class's logic (e.g., `this.emit('done', result)`). The crucial, easy-to-forget step is calling `super()` in the constructor before using `this.emit`/`this.on` — without it, the internal state `EventEmitter` needs (its listener registry) is never initialized, and the emitter will not work correctly.

**Q: What's the benefit of using events to decouple modules compared to passing callback functions directly?**
Answer: With callbacks, the calling code must know about and explicitly invoke every interested party at the call site (tight coupling — e.g., `placeOrder(order, sendEmail, updateInventory, logAnalytics)`). With events, the emitting code only needs to call `emit('event-name', data)` once; any number of independent listeners can subscribe to that event from anywhere in the codebase, including code added later, without ever modifying the emitting function. This is especially useful for cross-cutting concerns like logging, notifications, and analytics that shouldn't be hardwired into core business logic.
