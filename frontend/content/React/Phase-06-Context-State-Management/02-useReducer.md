# 02 — useReducer

> "When one event needs to change five pieces of state consistently, you don't need five `setState` calls scattered around your component — you need one function that knows all the rules."

---

## Table of Contents

1. [The Problem: State That Changes Together](#1-the-problem-state-that-changes-together)
2. [A Real-World Analogy: The Vending Machine](#2-a-real-world-analogy-the-vending-machine)
3. [Basic Definition](#3-basic-definition)
4. [Internal Working](#4-internal-working)
5. [Example: A Shopping Cart Reducer](#5-example-a-shopping-cart-reducer)
6. [useState vs useReducer — When to Reach for Each](#6-usestate-vs-usereducer--when-to-reach-for-each)
7. [Common Mistakes](#7-common-mistakes)
8. [useReducer and Context — Setting Up "Redux, But Built In"](#8-usereducer-and-context--setting-up-redux-but-built-in)
9. [Interview Answer](#9-interview-answer)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. The Problem: State That Changes Together

Let's start with a scenario, not a definition.

You're building a shopping cart. At first, it seems simple — just an array of items:

```jsx
const [items, setItems] = useState([]);
```

Then the requirements grow. A little.

```
Add an item to the cart
Remove an item from the cart
Change an item's quantity
Apply a discount code
Clear the whole cart on checkout
```

So now you write handler functions, one per action:

```jsx
function addItem(product) {
  setItems(prev => [...prev, { ...product, qty: 1 }]);
}

function removeItem(id) {
  setItems(prev => prev.filter(item => item.id !== id));
}

function updateQuantity(id, qty) {
  setItems(prev =>
    prev.map(item => (item.id === id ? { ...item, qty } : item))
  );
}

function applyDiscount(code) {
  setItems(prev => prev.map(item => ({ ...item, discount: code })));
}

function clearCart() {
  setItems([]);
}
```

This still *looks* manageable. But notice what's happening: the logic for "how does the cart change" is spread across five separate functions, each with its own `setItems` call, each reaching into the array shape by hand. Now imagine a sixth requirement: quantity can never go below 1, and going to 0 should remove the item instead. Where does that rule live? Probably duplicated, or bolted onto `updateQuantity`, and easy to forget the next time someone adds a seventh action.

And here's the part that really hurts: if this cart also needs a `total`, a `discountCode`, and an `appliedCoupon` flag, you'll be tempted to add three more `useState` calls:

```jsx
const [items, setItems] = useState([]);
const [total, setTotal] = useState(0);
const [discountCode, setDiscountCode] = useState(null);
const [appliedCoupon, setAppliedCoupon] = useState(false);
```

Now every action has to remember to update *multiple* pieces of state, in the right order, or you end up with a `total` that doesn't match `items` anymore. That's an inconsistent UI — the classic bug where the price shown on screen doesn't match what's actually in the cart.

This is exactly the problem `useReducer` was built for: **many related pieces of state, that all change together, through a well-defined set of actions.** Instead of scattering the "how do things change" logic across a dozen handler functions, you centralize it in one place.

---

## 2. A Real-World Analogy: The Vending Machine

Think about how a vending machine actually works.

You don't reach in and rearrange the snacks yourself. Instead:

```
You insert a specific coin/action  →  B4 button pressed
Machine looks at its current state →  (row B4 has 3 bags of chips left)
Machine applies its internal rules →  dispense one bag, decrement count
Machine produces the new state     →  (row B4 now has 2 bags left)
```

Same coin, same button, same starting stock — always the same result. That's the whole idea of a **reducer**: given the current state and an action, it deterministically computes the *next* state. No randomness, no surprises, no reaching in directly to fiddle with the internals.

Notice the machine has one "brain" — a single set of rules for what every button press does. It's not five independent robots, each responsible for a different row, each with their own idea of how counting works. That's the shift from "five separate `setState` calls" to "one reducer function."

---

## 3. Basic Definition

`useReducer` is a React hook for managing state through a **reducer function** — a pure function that takes the current state and an action, and returns the next state.

```jsx
const [state, dispatch] = useReducer(reducer, initialState);
```

- `state` — the current state value (just like the first item from `useState`).
- `dispatch` — a function you call to send an **action** describing what happened. Calling `dispatch` is how you trigger a state update (like calling the setter function from `useState`, but instead of handing it the *new value* directly, you hand it a description of *what happened*).
- `reducer` — a function you write, with the signature:

```jsx
function reducer(state, action) {
  // inspect action.type, decide what the new state should look like
  return newState;
}
```

- `initialState` — the value `state` starts out as, before any actions have been dispatched.

The action itself is just a plain object — by convention, it has a `type` field describing *what happened*, and often a `payload` field carrying whatever data is needed to process it:

```jsx
dispatch({ type: 'ADD_ITEM', payload: { id: 1, name: 'Keyboard', price: 49 } });
```

Why bother with this `type` + `payload` shape instead of just calling different functions? Because it centralizes *every possible way this state can change* into one switch statement, inside one function. Want to know everything that can happen to your cart? Don't go hunting through ten files for `setItems` calls — open the reducer and read the `switch`. Every action type is a case, every case is one clearly-named block of logic. That single file becomes the source of truth for "how does this state evolve," which makes it dramatically easier to reason about, debug, and test in isolation (a reducer is just a function — pass it a state and an action, check what comes out, no rendering required).

---

## 4. Internal Working

Let's compare the two cycles side by side — `useState`'s update cycle, and `useReducer`'s.

**The `useState` cycle:**

```text
Event handler calls setState(newValue)
        |
        v
React schedules a re-render with the new value
        |
        v
Component function re-runs, `state` is now newValue
        |
        v
UI reflects the new state
```

**The `useReducer` cycle:**

```text
Event handler calls dispatch({ type: 'ADD_ITEM', payload: {...} })
        |
        v
React calls reducer(currentState, action)
        |
        v
reducer looks at action.type, runs the matching case,
returns a brand-new state object (never mutates the old one)
        |
        v
React schedules a re-render with that returned value as the new state
        |
        v
Component function re-runs, `state` is now the reducer's return value
        |
        v
UI reflects the new state
```

Structurally these are the *same* re-render mechanism underneath — both end with "React schedules a re-render, component re-runs with new state." The only real difference is what sits between "something happened" and "here's the new state":

- With `useState`, *you* compute the new value right there in the event handler, and hand it directly to the setter.
- With `useReducer`, you hand `dispatch` a description of *what happened* (the action), and a single dedicated function — the reducer — is responsible for computing what the new state should be.

That indirection is exactly what buys you the centralization benefit from Section 1: all the "how does state change" logic lives in one function, not smeared across every event handler that happens to call a setter.

---

## 5. Example: A Shopping Cart Reducer

Let's rebuild the shopping cart from Section 1, this time with `useReducer`.

**Step 1 — Define the shape of your state and your actions.**

```jsx
// Initial state — notice ALL related pieces live in one object
const initialState = {
  items: [],       // [{ id, name, price, qty }]
  discountCode: null,
};
```

**Step 2 — Write the reducer. This is where every rule for "how does the cart change" lives.**

```jsx
function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(item => item.id === action.payload.id);

      if (existing) {
        // Item's already in the cart — bump its quantity instead of duplicating
        return {
          ...state,
          items: state.items.map(item =>
            item.id === action.payload.id
              ? { ...item, qty: item.qty + 1 }
              : item
          ),
        };
      }

      // Brand new item — append it with qty 1
      return {
        ...state,
        items: [...state.items, { ...action.payload, qty: 1 }],
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload.id),
      };

    case 'UPDATE_QUANTITY': {
      const { id, qty } = action.payload;

      if (qty <= 0) {
        // The "quantity can never go below 1" rule lives HERE, once,
        // instead of duplicated across every place that changes quantity
        return {
          ...state,
          items: state.items.filter(item => item.id !== id),
        };
      }

      return {
        ...state,
        items: state.items.map(item =>
          item.id === id ? { ...item, qty } : item
        ),
      };
    }

    case 'APPLY_DISCOUNT':
      return { ...state, discountCode: action.payload.code };

    case 'CLEAR_CART':
      return { ...state, items: [], discountCode: null };

    default:
      // Always handle the unknown case — see Section 7 for why this matters
      throw new Error(`Unhandled action type: ${action.type}`);
  }
}
```

**Step 3 — Wire it up in the component.**

```jsx
function ShoppingCart() {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const handleAdd = (product) => {
    dispatch({ type: 'ADD_ITEM', payload: product });
  };

  const handleRemove = (id) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  };

  const handleQuantityChange = (id, qty) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, qty } });
  };

  const total = state.items.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div>
      <ul>
        {state.items.map(item => (
          <li key={item.id}>
            {item.name} — qty: {item.qty}
            <button onClick={() => handleQuantityChange(item.id, item.qty + 1)}>+</button>
            <button onClick={() => handleQuantityChange(item.id, item.qty - 1)}>-</button>
            <button onClick={() => handleRemove(item.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <p>Total: ${total.toFixed(2)}</p>
      <button onClick={() => dispatch({ type: 'CLEAR_CART' })}>Clear Cart</button>
    </div>
  );
}
```

Look at how clean the component itself stays. It doesn't know *how* the cart updates internally — it just describes *what happened* ("an item was added," "the quantity changed") and hands that off to `dispatch`. All the actual logic — the merging, the filtering, the "qty 0 means remove" rule — lives in one place: `cartReducer`. Want to add a `REMOVE_ITEM` confirmation step, or log every action for analytics? You have exactly one function to touch.

**Notice the immutability throughout.** Every single case returns a brand-new object — `{ ...state, items: [...] }` — never `state.items.push(...)` or `item.qty = qty`. This is the same rule you already know from `useState` with objects and arrays; it just matters *even more* here, because React compares the reducer's return value to decide whether to re-render, and skipping that copy silently breaks re-renders (more on this in Section 7).

---

## 6. useState vs useReducer — When to Reach for Each

This is one of the most commonly tested distinctions in React interviews, so let's be precise about it.

| Situation | Reach for... | Why |
|---|---|---|
| A single, independent value (a toggle, an input string, a loading flag) | `useState` | No coordination needed — it's just one value with one setter. `useReducer` would be pure ceremony. |
| Several state values that always update **together**, in a coordinated way | `useReducer` | One `dispatch` call can update multiple fields consistently, in one atomic step (see the cart's `items` + `discountCode` together). |
| The next state depends on **complex logic involving the previous state** (not just "flip this boolean" but "look at the previous state, apply several rules, then decide") | `useReducer` | The reducer function is a dedicated home for that logic — easy to read, easy to unit test on its own, no rendering required. |
| You want every possible state transition centralized in one place, for debugging or logging | `useReducer` | Every change flows through the same function — log every `action` there and you have a full history of what happened and why. |
| A **deeply nested** update where one field's change should reset or recompute several others | `useReducer` | Otherwise you're chaining multiple `setState` calls and hoping React batches them correctly and consistently. |
| State that's genuinely simple, even if there are two or three `useState` calls, as long as they're truly *independent* of each other | `useState` (multiple calls are fine) | Don't reach for `useReducer` just because you have more than one `useState` call — independence is the deciding factor, not the *count*. |

The real question to ask yourself isn't "how many `useState` calls do I have?" — it's "**do these pieces of state change together, through well-defined transitions, or are they independent?**" A form with a `name` field and a `dark mode` toggle on the same page has two `useState` calls that have nothing to do with each other — keep them separate. A multi-step checkout wizard where `step`, `formData`, and `errors` all shift together based on "user clicked next" — that's a reducer's job.

---

## 7. Common Mistakes

**Mistake 1 — Mutating state directly inside the reducer.**

```jsx
// WRONG — mutates the existing array/object
function reducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM':
      state.items.push(action.payload); // mutating!
      return state; // same reference — React may not even re-render
  }
}
```

React decides whether to re-render partly by comparing the previous state reference to the new one. If you mutate `state.items` in place and then return the *same* `state` object, React can see no difference — and your UI silently fails to update, or updates inconsistently. Always build and return a brand-new object:

```jsx
// RIGHT
case 'ADD_ITEM':
  return { ...state, items: [...state.items, action.payload] };
```

**Mistake 2 — Forgetting the `default` case.**

```jsx
// WRONG — unknown actions are silently ignored
function reducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    // no default!
  }
}
```

If someone dispatches `{ type: 'AD_ITEM' }` (a typo!), this reducer falls through the switch, hits no case, and — because there's no `default` — implicitly returns `undefined`. Now your entire state has just become `undefined`, and every part of your UI that reads from it breaks, with no error message pointing you to the typo. Always add a `default`, and make it loud:

```jsx
// RIGHT
default:
  throw new Error(`Unhandled action type: ${action.type}`);
```

Throwing (or at minimum logging a clear warning) turns a silent, confusing bug into an immediate, obvious one at the exact moment it happens.

**Mistake 3 — Putting side effects (API calls, timers, logging) directly inside the reducer.**

```jsx
// WRONG — reducers must be pure functions
function reducer(state, action) {
  switch (action.type) {
    case 'SAVE_CART':
      fetch('/api/cart', { method: 'POST', body: JSON.stringify(state) }); // side effect!
      return state;
  }
}
```

A reducer is supposed to be a **pure function**: same `state` + same `action` in, same new state out, every single time, with no observable side effects. An API call breaks that contract completely — it makes the reducer's behavior depend on the network, timing, and the outside world, and (in React's Strict Mode, or with certain concurrent features) reducers can be invoked more than once for the same update, which would mean firing that API call multiple times. Side effects belong in an effect (`useEffect`), or in the code that calls `dispatch` — not inside the reducer itself:

```jsx
// RIGHT — the reducer stays pure...
case 'ADD_ITEM':
  return { ...state, items: [...state.items, action.payload] };

// ...and the side effect happens separately, in an effect
useEffect(() => {
  fetch('/api/cart', { method: 'POST', body: JSON.stringify(state) });
}, [state]);
```

This is one of the most tested rules around `useReducer` — remember it as: **reducers compute, they don't perform.**

---

## 8. useReducer and Context — Setting Up "Redux, But Built In"

If you've ever used Redux, the reducer function above should look extremely familiar — because it's the exact same idea. Redux popularized this pattern: a single reducer function, actions with a `type` field, dispatched to trigger predictable, centralized state transitions. `useReducer` is essentially **Redux's core idea, built directly into React**, without needing an external library.

What Redux adds on top (which plain `useReducer` doesn't give you by itself) is a way to make that `state` and `dispatch` pair available *anywhere* in the component tree, without manually passing them down as props through every level. That's exactly the gap the Context API fills. A very common pairing looks like this:

```jsx
const CartContext = createContext(null);

function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  return (
    <CartContext.Provider value={{ state, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}

// Anywhere deep in the tree:
function AddToCartButton({ product }) {
  const { dispatch } = useContext(CartContext);
  return (
    <button onClick={() => dispatch({ type: 'ADD_ITEM', payload: product })}>
      Add to Cart
    </button>
  );
}
```

`useReducer` gives you the *centralized state transition logic*. Context gives you the *distribution* — making `state` and `dispatch` reachable without prop drilling. Together, that's "Redux, hand-rolled with hooks that ship in React itself."

The next lesson in this phase picks up exactly here — comparing this hand-rolled `useReducer` + Context combo against dedicated state management libraries like Redux and Zustand, and looking at where the built-in approach starts to strain at scale (things like selector-based re-render optimization, middleware, and devtools time-travel debugging, which the raw hooks don't give you for free).

---

## 9. Interview Answer

If asked "when would you use `useReducer` instead of `useState`," here's a tight answer:

> "`useState` is best for simple, independent pieces of state — a toggle, a text input, a loading flag — where each value updates on its own with no coordination needed. `useReducer` is better when you have multiple related state values that need to update together consistently, or when the next state depends on complex logic involving the previous state. It centralizes all state transition logic into one pure reducer function, which takes the current state and an action and returns a new state — making the code easier to read, test in isolation, and debug, since every possible state change flows through one place instead of being scattered across many event handlers. The tradeoff is a bit more setup — defining action types and a switch statement — which isn't worth it for state that's genuinely simple."

---

> **Memory hook:** "One coin, one button, one predictable result — a reducer is a vending machine for your state, not a robot arm you reach in and mutate by hand."

---

## 10. Hands-On Exercises

**Exercise 1 — Basic Counter with Multiple Actions**

Build a counter using `useReducer` that supports `INCREMENT`, `DECREMENT`, `RESET`, and `SET` (set to an arbitrary number passed in the payload). Write the reducer and the component. Make sure `default` throws on an unknown action type.

**Exercise 2 — Shopping Cart, Extended**

Take the `cartReducer` from Section 5 and add two new actions: `APPLY_COUPON` (payload: `{ code, discountPercent }`, stores both on state) and `REMOVE_COUPON` (clears them). Then update the `total` calculation in the component to apply the discount percentage when a coupon is active.

**Exercise 3 — Multi-Step Form Wizard**

Build a 3-step signup form (`step 1`: email, `step 2`: password, `step 3`: confirm) using a single `useReducer`. Actions: `NEXT_STEP`, `PREV_STEP`, `UPDATE_FIELD` (payload: `{ field, value }`), and `RESET_FORM`. State should hold `{ step, formData, errors }`. `NEXT_STEP` should only advance if the current step's field is non-empty — otherwise it should set an error on that field instead of advancing.

**Exercise 4 — Find and Fix the Bug**

Here's a broken reducer:

```jsx
function todoReducer(state, action) {
  switch (action.type) {
    case 'ADD_TODO':
      state.todos.push({ id: Date.now(), text: action.payload, done: false });
      return state;
    case 'TOGGLE_TODO':
      const todo = state.todos.find(t => t.id === action.payload);
      todo.done = !todo.done;
      return state;
  }
}
```

Identify every mistake covered in Section 7 that appears in this code, and rewrite it correctly.

**Exercise 5 — useReducer + Context**

Wrap the todo reducer from Exercise 4 (once fixed) in a `TodoProvider` component using Context, exposing `state` and `dispatch` through a custom hook `useTodos()`. Then build two separate components — `TodoList` and `AddTodoForm` — that each consume `useTodos()` independently, with no props passed between them.

**Exercise 6 — Side Effect Refactor**

Take this reducer, which incorrectly performs a side effect:

```jsx
case 'DELETE_ITEM':
  api.deleteItem(action.payload.id); // side effect inside the reducer!
  return { ...state, items: state.items.filter(i => i.id !== action.payload.id) };
```

Refactor it so the reducer stays pure, and the API call happens in the correct place (either in the event handler that calls `dispatch`, or in a `useEffect`).

---

## 11. Interview Q&A

**Q1: What is `useReducer` and what problem does it solve?**

A: `useReducer` is a React hook for managing state via a reducer function — `(state, action) => newState`. It solves the problem of managing multiple related pieces of state that update together in complex, coordinated ways, by centralizing all the state transition logic into one function instead of scattering it across many `useState` calls and handler functions.

---

**Q2: What is the signature of `useReducer`, and what does each part return?**

A: `const [state, dispatch] = useReducer(reducer, initialState)`. `state` is the current state value. `dispatch` is a function used to send actions that trigger state updates. `reducer` is a function you provide with the signature `(state, action) => newState`. `initialState` is the value `state` holds before any action has been dispatched.

---

**Q3: What is the "action" object, and why does it typically have a `type` field?**

A: An action is a plain object describing what happened — conventionally `{ type: 'ACTION_NAME', payload: {...} }`. The `type` field lets the reducer's switch statement route to the correct logic for that specific kind of change. Centralizing every possible transition behind named `type`s makes the full set of ways state can change visible and auditable in one file, rather than implicit across scattered setter calls.

---

**Q4: Why must a reducer never mutate the existing state object?**

A: React determines whether to re-render partly by comparing the previous state reference to the newly returned one. If a reducer mutates the existing object/array in place and returns the same reference, React can't detect that anything changed, and the UI may fail to re-render or become inconsistent. Reducers must always return a brand-new object built with spreads or other non-mutating techniques.

---

**Q5: What happens if you forget the `default` case in a reducer's switch statement, and why is that dangerous?**

A: Without a `default` case, dispatching an action with an unrecognized `type` (often from a typo) falls through the switch with no matching case and implicitly returns `undefined` — silently wiping out the entire state with no error. Always add a `default` case, ideally one that throws or logs clearly, so unknown actions fail loudly instead of corrupting state silently.

---

**Q6: Why shouldn't reducers contain side effects like API calls?**

A: Reducers are expected to be pure functions: given the same state and action, they should always produce the same new state, with no observable effects on the outside world. Side effects like API calls make the reducer's behavior depend on timing and network conditions, break that purity guarantee, and can fire multiple times unexpectedly (for example, under React Strict Mode's intentional double-invocation of certain functions in development). Side effects belong in `useEffect` or in the code that calls `dispatch`, not inside the reducer.

---

**Q7: When would you choose `useReducer` over `useState`?**

A: When you have several state values that need to update together consistently (not independently), when the next state depends on complex logic involving the previous state, or when you want all state transition logic centralized in one place for easier reasoning, testing, and debugging. For simple, independent values, `useState` is simpler and sufficient.

---

**Q8: Is having multiple `useState` calls automatically a sign you should switch to `useReducer`?**

A: No. The deciding factor is whether the state values are independent or coordinated, not how many `useState` calls exist. Two unrelated `useState` calls (say, a form field and an unrelated UI toggle) are perfectly fine to keep separate. `useReducer` earns its keep when the values change *together*, through the same well-defined set of transitions.

---

**Q9: How does `useReducer` relate to Redux?**

A: `useReducer` implements the same core idea Redux popularized — a pure reducer function taking `(state, action)` and returning new state, with actions describing what happened via a `type` field. It's essentially Redux's central concept built directly into React. What Redux (or Zustand, etc.) adds on top is typically global distribution without prop drilling, middleware, devtools/time-travel debugging, and performance optimizations like selectors — none of which plain `useReducer` provides by itself.

---

**Q10: How do `useReducer` and Context typically work together?**

A: `useReducer` centralizes the state transition logic (the "how does state change" question). Context solves the separate problem of making that `state` and `dispatch` pair available anywhere in the component tree without manually passing them down as props through every intermediate component. Combining them — wrapping a `useReducer` in a Context Provider — gives you a lightweight, hand-rolled global store, without needing an external library.

---

**Q11: Compare the `useState` update cycle to the `useReducer` dispatch cycle.**

A: With `useState`, the event handler computes the new value directly and hands it to the setter, which schedules a re-render. With `useReducer`, the event handler dispatches an action (a description of what happened), React calls the reducer with the current state and that action, the reducer computes and returns the new state, and React schedules a re-render with that value. Both end in the same re-render mechanism — the difference is that `useReducer` inserts a dedicated, centralized function between "something happened" and "here is the new state."

---

**Q12: What's a good real-world use case for `useReducer` versus one where `useState` is clearly better?**

A: A multi-step checkout wizard where `step`, `formData`, and `validation errors` all change together based on user actions like "next" or "back" is a strong `useReducer` case — the transitions are numerous and interdependent. A single boolean for a modal's open/closed state, or a text input's current value, is clearly better served by `useState` — there's no coordination or complex prior-state logic involved.

---

**Q13: Can `dispatch` be called with any shape of object, or does it need to follow the action convention strictly?**

A: `dispatch` will literally accept anything — React just passes whatever you give it straight to the reducer as the `action` argument. The `{ type, payload }` shape is a widely followed convention (borrowed from Redux), not a hard requirement enforced by React itself. Following it consistently, though, is what makes the reducer's switch statement clean and makes the codebase's state transitions predictable and easy to read.

---

**Q14: Why is it important that reducers be easy to unit test, and what makes them easy to test?**

A: Because a reducer is just a plain function — `(state, action) => newState` — with no dependency on rendering, DOM, hooks, or timing, you can test it by simply calling it directly with sample state and actions and asserting on the return value. No component needs to be mounted, no side effects need to be mocked. This is only true, though, if the reducer stays pure — the moment a side effect sneaks in, testing requires mocking that side effect too.

---

**Q15: What's a subtle bug that can occur if a reducer conditionally returns the exact same state object without changes, versus building a new one?**

A: If a case in the reducer decides "nothing actually needs to change" and returns the same `state` reference unmodified, that's fine and expected — React will skip re-rendering, which is the correct, efficient behavior. The bug arises only when a case *does* intend to change something but mutates the existing object instead of returning a new one — in that scenario, React sees an unchanged reference despite an actual data change, and the UI silently fails to reflect the update.
