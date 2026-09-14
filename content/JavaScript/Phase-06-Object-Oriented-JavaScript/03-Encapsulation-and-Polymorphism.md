# Encapsulation and Polymorphism — Complete Guide

## Table of Contents
1. [Why Encapsulation Matters](#1-why-encapsulation-matters)
2. [True Private Fields with #](#2-true-private-fields-with-)
3. [Closures for Privacy (Pre-ES2022 Pattern)](#3-closures-for-privacy-pre-es2022-pattern)
4. [Polymorphism](#4-polymorphism)
5. [Mixins](#5-mixins)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Encapsulation Matters

Encapsulation means bundling data with the methods that operate on it, and restricting direct outside access to that data so it can only be changed through a controlled interface. Without it, any code anywhere can reach in and set an object's internal state to something invalid — a bank account balance to a negative number, an internal cache to a corrupted shape — bypassing whatever validation or invariants the class was designed to enforce.

```js
class BankAccountUnsafe {
  constructor(balance) {
    this.balance = balance; // fully public — ANYONE can do this:
  }
  withdraw(amount) {
    if (amount > this.balance) throw new Error("Insufficient funds");
    this.balance -= amount;
  }
}

const acct = new BankAccountUnsafe(100);
acct.balance = -999999; // completely bypasses withdraw()'s validation!
console.log(acct.balance); // -999999 — the class's own invariant is broken
```

JavaScript historically had no true private state at all — only conventions (like a leading underscore, `_balance`, meaning "please don't touch this, even though you technically can"). Modern JavaScript (ES2022) finally added real enforced privacy with `#` fields.

---

## 2. True Private Fields with #

Fields prefixed with `#` are truly private — inaccessible and even invisible from outside the class, enforced by the JavaScript engine itself, not just a naming convention.

```js
class BankAccount {
  #balance; // private field declaration — must be declared, cannot be added dynamically later

  constructor(initialBalance) {
    this.#balance = initialBalance;
  }

  deposit(amount) {
    if (amount <= 0) throw new Error("Deposit must be positive");
    this.#balance += amount;
  }

  withdraw(amount) {
    if (amount > this.#balance) throw new Error("Insufficient funds");
    this.#balance -= amount;
  }

  get balance() { // controlled READ access via a public getter
    return this.#balance;
  }

  #logTransaction(type, amount) { // private METHODS are also supported
    console.log(`[log] ${type}: ${amount}`);
  }
}

const acct = new BankAccount(100);
acct.deposit(50);
console.log(acct.balance); // 150 — read via the public getter

acct.balance = -999999; // silently does NOTHING — there's no public setter,
                          // so this just creates an unrelated own property
                          // called "balance" that shadows the getter... actually
                          // it throws, because a getter-only accessor property
                          // cannot be assigned to in strict mode:
// TypeError: Cannot set property balance of #<BankAccount> which has only a getter

console.log(acct.#balance); // SyntaxError — cannot even be REFERENCED outside the class
```

### Field-by-Field Breakdown

```
#balance;
  ↳ MUST be declared in the class body (unlike normal properties,
    which can be added dynamically anywhere). Declaring it up front
    is what makes it a recognized private field.

this.#balance = initialBalance;
  ↳ Only code INSIDE the class body can reference #balance at all.
  ↳ Even trying to type acct.#balance from OUTSIDE the class is a
    SyntaxError at parse time — not just "returns undefined," but
    a hard parse error, because # names are only valid inside the
    class that declared them.

#logTransaction(type, amount) { ... }
  ↳ Private methods work the same way — callable only from other
    code inside the same class.

get balance() { return this.#balance; }
  ↳ The standard pattern: expose a CONTROLLED, read-only (or
    validated read/write) view of private state through a public
    getter/setter, so external code interacts with a safe interface
    instead of the raw private field.
```

Private fields are also useful for static private state (`static #count`) and are respected across inheritance — a subclass cannot access a parent class's `#field` directly either, only through public/protected-by-convention methods the parent exposes.

---

## 3. Closures for Privacy (Pre-ES2022 Pattern)

Before `#` fields existed (and still useful to know, since it appears constantly in older codebases and interview questions), privacy was achieved through **closures** — variables captured inside a factory function's scope are invisible from outside, because there's simply no syntax to reach into another function's local variables.

```js
function createBankAccount(initialBalance) {
  let balance = initialBalance; // a plain local variable — NOT a property on anything

  return {
    deposit(amount) {
      if (amount <= 0) throw new Error("Deposit must be positive");
      balance += amount;
    },
    withdraw(amount) {
      if (amount > balance) throw new Error("Insufficient funds");
      balance -= amount;
    },
    getBalance() {
      return balance;
    },
  };
}

const acct = createBankAccount(100);
acct.deposit(50);
console.log(acct.getBalance()); // 150

console.log(acct.balance);  // undefined — "balance" was never a property, just a closed-over variable
acct.balance = -999999;     // creates an unrelated, harmless own property; doesn't touch the real `balance`
console.log(acct.getBalance()); // still 150 — completely unaffected
```

```
Why this works:

  createBankAccount(100) runs ONCE, creating a local variable
  `balance` that lives in that function call's execution context.

  The returned object's methods (deposit, withdraw, getBalance) are
  CLOSURES — they keep a live reference to that execution context's
  variables even after createBankAccount() itself has finished running.

  There is NO property called "balance" anywhere on the returned
  object — so there is nothing for outside code to reach into.
  The only way to read or change `balance` is through the three
  methods that were defined inside the same closure.
```

This pattern predates `#` fields by years and is still common in functional-style JavaScript (factory functions instead of classes) and in code that must support very old JavaScript engines. The tradeoff versus `#` fields: every instance created this way gets its own fresh copies of `deposit`/`withdraw`/`getBalance` (since they're defined inside the factory function each call), losing the memory-sharing benefit of prototype methods — `#` fields on a class don't have this downside, since class methods still live on the shared prototype.

---

## 4. Polymorphism

Polymorphism means objects of different types can be used through the same interface, each responding to the same method call in its own way. Section 5 of the previous lesson already demonstrated this with `Shape`/`Circle`/`Square` — this section makes the concept explicit and shows a second, non-inheritance flavor of polymorphism: duck typing.

```js
class PaymentMethod {
  pay(amount) {
    throw new Error("pay() must be implemented by a subclass");
  }
}

class CreditCard extends PaymentMethod {
  pay(amount) {
    console.log(`Charged $${amount} to credit card.`);
  }
}

class PayPal extends PaymentMethod {
  pay(amount) {
    console.log(`Sent $${amount} via PayPal.`);
  }
}

class Crypto extends PaymentMethod {
  pay(amount) {
    console.log(`Transferred $${amount} in crypto.`);
  }
}

function checkout(paymentMethod, amount) {
  // checkout() has NO idea which concrete class it received —
  // it just trusts that .pay() exists and does the right thing.
  paymentMethod.pay(amount);
}

const methods = [new CreditCard(), new PayPal(), new Crypto()];
methods.forEach((method) => checkout(method, 100));
// Charged $100 to credit card.
// Sent $100 via PayPal.
// Transferred $100 in crypto.
```

```
This is polymorphism: `checkout()` is written against a single,
abstract interface — "anything with a .pay(amount) method" — and
works correctly no matter which concrete subclass is passed in,
without a single if/else or switch statement checking the type.

Duck typing (a looser form, no inheritance required at all):
  JavaScript doesn't actually require paymentMethod to be an
  instanceof PaymentMethod for checkout() to work — ANY object
  with a .pay(amount) method works, because JavaScript doesn't
  check types, only whether the method exists and is callable.
  "If it walks like a duck and quacks like a duck, it's a duck."
```

---

## 5. Mixins

JavaScript classes support only **single inheritance** — a class can `extends` exactly one parent. Mixins are a pattern for sharing behavior across multiple, unrelated classes without needing a shared inheritance chain, by copying (or dynamically composing) methods from a plain object or a function that returns a class.

```js
// A mixin is just a function that takes a base class and returns a
// new class extending it with additional methods.
const Serializable = (BaseClass) =>
  class extends BaseClass {
    serialize() {
      return JSON.stringify(this);
    }
  };

const Loggable = (BaseClass) =>
  class extends BaseClass {
    log(message) {
      console.log(`[${this.constructor.name}] ${message}`);
    }
  };

class Product {
  constructor(name, price) {
    this.name = name;
    this.price = price;
  }
}

// Compose multiple mixins by wrapping Product in both:
class SerializableLoggableProduct extends Loggable(Serializable(Product)) {}

const item = new SerializableLoggableProduct("Keyboard", 49.99);
console.log(item.serialize());       // '{"name":"Keyboard","price":49.99}'
item.log("Product created");          // "[SerializableLoggableProduct] Product created"
```

```
Why mixins instead of deeper inheritance:

  Serializable and Loggable are UNRELATED capabilities — a Product
  needing both doesn't mean "a Loggable IS-A Serializable" or vice
  versa, so jamming them into a single inheritance chain
  (Product extends Serializable extends Loggable) would misrepresent
  the actual relationship between these concepts.

  Mixins let you compose independent, reusable pieces of behavior
  onto ANY base class, as many as you need, without being limited
  to JavaScript's single-parent `extends` chain.
```

---

## 6. Hands-On Exercises

**Exercise 1:** Convert the unsafe `BankAccountUnsafe` class from Section 1 into a properly encapsulated class using `#balance`, a public `deposit()`/`withdraw()` pair with validation, and a read-only `get balance()`. Confirm that `acct.#balance` from outside the class is a `SyntaxError` (comment out the line and note the error you saw), and that assigning `acct.balance = 999` throws because there's no setter.

**Exercise 2:** Implement the same bank account using the closure-based factory function pattern from Section 3, from memory. Add a `transactionHistory` local array (also closed over, not exposed) that records every deposit/withdrawal, and a `getHistory()` method that returns a *copy* of the array (not the original reference — explain in a comment why returning the original reference would be a privacy leak).

**Exercise 3:** Build the `PaymentMethod`/`CreditCard`/`PayPal`/`Crypto` polymorphism example yourself, then add a fourth payment method class `GiftCard` without modifying `checkout()` at all — confirm it works purely by matching the `.pay(amount)` interface. Then write a plain object literal (no class, no `extends`, no `instanceof PaymentMethod` relationship at all) with just a `.pay(amount)` method, and pass it to `checkout()` to demonstrate duck typing.

**Exercise 4:** Write two mixins of your own — `Timestamped` (adds a `createdAt` field set in a wrapped constructor, plus an `age()` method) and `Comparable` (adds a `compareTo(other)` method comparing some numeric field you choose). Apply both mixins to a `Task` base class and confirm an instance has all of Task's own behavior plus both mixins' methods.

**Exercise 5:** Write a `Shape` base class whose `area()` throws `"area() must be implemented"` if called directly (this is called an "abstract method" pattern, since JavaScript has no built-in `abstract` keyword). Create `Circle` and `Rectangle` subclasses that override `area()` properly, and a broken `BrokenShape` subclass that does NOT override `area()`. Confirm `Circle`/`Rectangle` work, and that instantiating `BrokenShape` and calling `.area()` on it throws the expected error, demonstrating how polymorphism can be combined with an enforced base contract.

---

## 7. Interview Q&A

**Q: What problem does encapsulation solve, and how does JavaScript's `#` private field syntax actually enforce it (versus a convention like `_balance`)?**
Answer: Encapsulation prevents external code from directly manipulating an object's internal state in ways that bypass the validation and invariants the class was designed to enforce — without it, any code anywhere could set a bank account's balance to a negative number or otherwise corrupt internal data that should only ever change through controlled methods like `deposit()` or `withdraw()`. A leading-underscore convention like `_balance` is purely a social contract; the property is still fully public, still directly readable and writable from any external code, and nothing in the language stops a mistake or a malicious actor from doing so. The `#` syntax, introduced in ES2022, is enforced by the JavaScript engine itself at the syntax level — `#balance` must be declared inside the class body, and referencing `instance.#balance` from any code outside that exact class is a `SyntaxError` caught at parse time, not a runtime check that could be worked around; there is no way to reach a `#` field from outside the class, period, which is a fundamentally different (and much stronger) guarantee than a naming convention provides.

**Q: How did JavaScript achieve private state before `#` fields existed, and what's the tradeoff of that approach?**
Answer: The pre-ES2022 approach used closures: a factory function (not a class) declares local variables — like `let balance = initialBalance` — and returns an object containing methods that reference those variables directly. Because those methods are defined inside the factory function's scope, they retain access to its local variables even after the factory function itself has returned, but there is no property on the returned object corresponding to those variables at all, so external code has no way to reach in and read or modify them — the only access is through the methods the factory chose to expose. The tradeoff is memory: because the closure-returning methods are recreated fresh inside every call to the factory function, each object built this way gets its own separate copies of every method, unlike class-based methods which live once on a shared prototype and are reused across all instances — so the closure pattern trades true privacy (before `#` fields existed) for higher per-instance memory overhead.

**Q: What is polymorphism in JavaScript, and how does "duck typing" relate to it?**
Answer: Polymorphism means that objects of different concrete types can be used interchangeably through a shared interface, with each type providing its own specific implementation of the same method call — for example, a `checkout(paymentMethod, amount)` function that calls `paymentMethod.pay(amount)` works correctly whether it's handed a `CreditCard`, a `PayPal`, or a `Crypto` instance, because each overrides `pay()` with its own behavior, and `checkout()` itself contains no type-checking logic at all. Duck typing is JavaScript's looser, more dynamic flavor of this same idea: because JavaScript doesn't enforce static types or require an object to formally implement an interface or extend a particular base class, `checkout()` will happily accept literally any object that merely has a callable `.pay(amount)` method, regardless of its prototype chain or whether it's an `instanceof` any particular class — "if it walks like a duck and quacks like a duck, treat it as a duck." This makes JavaScript's polymorphism more flexible than classical inheritance-based polymorphism, at the cost of losing compile-time guarantees that the object actually has the method you expect.

**Q: Why would you use a mixin instead of just extending a base class further, and how does a mixin function actually work?**
Answer: JavaScript classes only support single inheritance — a class can `extends` exactly one parent — so if you need to share two or more unrelated capabilities (say, being serializable to JSON and being loggable) across several otherwise-unrelated classes, you cannot cleanly express that with a single inheritance chain without creating a misleading "is-a" relationship between concepts that aren't actually hierarchically related. A mixin sidesteps this by being a function that accepts a base class as its argument and returns a brand-new class extending that base with additional methods — so `Loggable(Serializable(Product))` produces a class that has `Product`'s own behavior, plus everything `Serializable` adds, plus everything `Loggable` adds, all composed together at the moment you define your final class, without needing `Serializable` and `Loggable` to be related to each other or to `Product` through any single inheritance chain. This composition pattern lets you mix in as many independent capabilities as needed, each implemented and tested once, and reused across any class that needs them.

**Q: How would you implement an "abstract method" pattern in JavaScript, given that the language has no `abstract` keyword?**
Answer: Since JavaScript has no built-in concept of an abstract class or abstract method, the common pattern is to define the method on the base class with a body that simply throws an error, such as `area() { throw new Error("area() must be implemented"); }` on a `Shape` base class. Any subclass that properly overrides `area()` — like `Circle` or `Rectangle` — never triggers that error because their own version, found earlier in the prototype chain lookup, takes precedence over the base class's throwing version. If a subclass forgets to override `area()`, calling `.area()` on an instance of that subclass falls through to the base class's implementation via the prototype chain and throws immediately, giving a clear, fail-fast signal that the subclass is incomplete rather than silently returning `undefined` or some default that could mask a real bug. This pattern combines the encapsulation and polymorphism ideas from this lesson: it enforces a contract (every concrete subclass must supply its own `area()`) purely through prototype chain lookup and a deliberately thrown error, without needing any special language-level "abstract" support.
