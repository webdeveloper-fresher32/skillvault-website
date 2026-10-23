# RxJS & Observables Basics

Angular relies on **RxJS** (Reactive Extensions for JavaScript) for handling asynchronous operations. In standard JS, you use Promises. In Angular, you will primarily use **Observables**. 

## 1. What is an Observable?

An Observable is like a stream of data that arrives over time. A Promise yields a single value and then completes. An Observable can yield multiple values over time, can be cancelled, and provides operators to transform the data stream.

```typescript
import { Observable } from 'rxjs';

// Creating a simple observable manually
const myObservable = new Observable(subscriber => {
  subscriber.next('Hello');
  subscriber.next('World');
  setTimeout(() => {
    subscriber.next('Async Value');
    subscriber.complete();
  }, 1000);
});

// An Observable does nothing until it is subscribed to!
myObservable.subscribe({
  next: (val) => console.log(val),
  error: (err) => console.error(err),
  complete: () => console.log('Done!')
});
```

## 2. Common Creation Functions

You rarely create Observables from scratch. You usually use RxJS functions:

```typescript
import { of, from, interval } from 'rxjs';

// of: emits specific values and completes
const of$ = of(1, 2, 3); 

// from: converts arrays/promises into observables
const from$ = from(['Apple', 'Banana']);

// interval: emits a number every X milliseconds (never completes)
const tick$ = interval(1000);
```

*(Note: We often append a `$` to variable names that hold observables as a convention).*

## 3. RxJS Operators

Operators allow you to manipulate streams. You use the `pipe()` method to apply them.

```typescript
import { of } from 'rxjs';
import { map, filter, tap } from 'rxjs/operators';

of(1, 2, 3, 4, 5).pipe(
  // tap: side-effects, doesn't modify data
  tap(val => console.log('Before filter:', val)),
  
  // filter: only let values pass that meet condition
  filter(val => val % 2 === 0),
  
  // map: transform the value
  map(val => val * 10)
).subscribe(console.log); 
// Output: 20, 40
```

## 4. Subjects

A Subject is a special type of Observable that allows values to be multicasted to many Observers. It acts as both an Observable and an Observer (you can call `next()` on it).

```typescript
import { Subject, BehaviorSubject } from 'rxjs';

// 1. Regular Subject (no initial value)
const subject = new Subject<string>();
subject.subscribe(val => console.log('Sub A:', val));
subject.next('Event 1'); 

// 2. BehaviorSubject (has initial value, remembers last value)
const behaviorSubject = new BehaviorSubject<number>(0);
console.log('Current value:', behaviorSubject.getValue()); // 0

behaviorSubject.subscribe(val => console.log('Sub B:', val));
behaviorSubject.next(42); 
```

You will use `BehaviorSubject` frequently when building custom state management in Angular services.

---
**Summary**: Observables are powerful, but they require cleanup. In Angular components, you must unsubscribe from long-lived observables (like `interval`) to avoid memory leaks, unless you use Angular's `AsyncPipe` (or the modern `toSignal()`), which handles this automatically!
