# 01 — Context API

> "Props are for handing something to your children. Context is for making an announcement the whole building can hear."

---

## Table of Contents

1. [The Problem: Prop Drilling](#1-the-problem-prop-drilling)
2. [The Real-World Analogy](#2-the-real-world-analogy)
3. [What Context Actually Is](#3-what-context-actually-is)
4. [Internal Working — Two Trees, Side by Side](#4-internal-working--two-trees-side-by-side)
5. [A Complete Example — Theme Toggling](#5-a-complete-example--theme-toggling)
6. [Compare With Related Concepts](#6-compare-with-related-concepts)
7. [The Re-Render Trap — Full Depth](#7-the-re-render-trap--full-depth)
8. [Splitting Contexts](#8-splitting-contexts)
9. [Context + useReducer — A Preview](#9-context--usereducer--a-preview)
10. [Common Mistakes](#10-common-mistakes)
11. [Interview Answer](#11-interview-answer)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. The Problem: Prop Drilling

Let's not start with a definition. Let's start with a component tree that's gone slightly wrong, because you've almost certainly written this exact code before without realizing it had a name.

Say you're building a dashboard. The logged-in user's name needs to show up in a little avatar badge, buried five components deep:

```
<App>
  └── <Dashboard user={user}>
        └── <Sidebar user={user}>
              └── <SidebarFooter user={user}>
                    └── <UserMenu user={user}>
                          └── <Avatar user={user} />   ← the ONLY component that actually uses `user`
```

Look at that chain again. `Dashboard`, `Sidebar`, `SidebarFooter`, and `UserMenu` don't care about `user` at all. They never read `user.name`, never render it, never touch it. They just... hold it. And pass it along. Because `Avatar`, sitting at the bottom, needs it.

```jsx
function Dashboard({ user }) {
  return <Sidebar user={user} />;
}

function Sidebar({ user }) {
  return <SidebarFooter user={user} />;
}

function SidebarFooter({ user }) {
  return <UserMenu user={user} />;
}

function UserMenu({ user }) {
  return <Avatar user={user} />;
}

function Avatar({ user }) {
  return <img src={user.avatarUrl} alt={user.name} />;
}
```

This is **prop drilling** — a prop being threaded through layer after layer of components that have zero interest in it, purely so it can reach the one component at the bottom that does.

Now imagine this isn't just `user`. Real apps drill `theme`, `locale`, `currentUser`, `permissions`, feature flags — often several of these at once, through the same middle layers. Every one of those intermediate components (`Dashboard`, `Sidebar`, `SidebarFooter`) ends up with a prop list that has nothing to do with what it renders, purely acting as a relay.

And the pain compounds the moment you need to change anything:

- Want to rename `user` to `currentUser`? You're editing five files, not one.
- Want to add a new deeply-nested consumer of `theme`? Another five-component chain to drill through.
- A new engineer opens `Sidebar.jsx` and sees a `user` prop — do they use it? Do they not? They have to trace the whole chain to find out.

This is exactly the itch React's Context API was built to scratch.

---

## 2. The Real-World Analogy

Think about how a piece of information travels through an office building.

**Option A — pass it hand to hand.** The CEO on floor 10 wants everyone to know the building is closing early on Friday. So she tells her assistant, who tells the floor 10 manager, who tells the floor 9 manager on the way down, who tells the floor 8 manager, and so on, all the way to the mailroom on floor 1. Every single manager in between has to stop, receive the message, and pass it on — even though *they* don't care about the early closing, they just live between the CEO and the mailroom.

That's prop drilling. Every intermediate manager (component) is forced to carry a message meant for someone else.

**Option B — a building-wide announcement.** The CEO picks up the PA system and says "we're closing early on Friday" once. Every floor hears it directly, simultaneously, with no manager in between needing to relay anything. The mailroom on floor 1 hears it exactly as clearly as the office on floor 9, and none of the floors in between had to do any work at all.

That's Context. Someone "broadcasts" a value up at the top of a tree, and any component anywhere underneath — no matter how deep — can "tune in" and read it directly, skipping every layer in between entirely.

> **Memory hook:** "Don't pass the memo hand to hand through five managers — put it on the PA system."

---

## 3. What Context Actually Is

Now that the problem and the analogy are in your head, the formal definition should feel almost obvious.

**React Context lets you share a value across a component tree without passing it down manually through every level of props.**

There are exactly three moving pieces, and each one maps directly onto the analogy above:

| Piece | What it does | Analogy |
|---|---|---|
| `createContext()` | Creates the "channel" — an object that holds a default value and lets components subscribe to it | Setting up the PA system |
| `<Context.Provider value={...}>` | Wraps part of the tree and broadcasts a specific value down it | The CEO speaking into the PA mic |
| `useContext(Context)` | Reads the current broadcast value, from anywhere inside the Provider | An employee's ear, tuned to the PA speaker |

Here's the shape, stripped down to its bones:

```jsx
import { createContext, useContext } from 'react';

// 1. Create the channel
const UserContext = createContext(null);

// 2. Broadcast a value from somewhere near the top
function App() {
  const user = { name: 'Priya', avatarUrl: '/priya.png' };
  return (
    <UserContext.Provider value={user}>
      <Dashboard />
    </UserContext.Provider>
  );
}

// 3. Tune in from anywhere underneath — no props needed at all
function Avatar() {
  const user = useContext(UserContext);
  return <img src={user.avatarUrl} alt={user.name} />;
}
```

Notice what's missing: `Dashboard`, `Sidebar`, `SidebarFooter`, and `UserMenu` don't appear in this snippet at all. They don't need to know `user` exists. `Avatar` reaches straight into the `UserContext` and pulls the value out itself. That's the entire point.

---

## 4. Internal Working — Two Trees, Side by Side

Let's actually draw both trees, because seeing the difference visually is what makes this stick.

**Tree A — prop drilling (the problem):**

```
                    ┌─────────┐
                    │   App   │  creates `user`
                    └────┬────┘
                         │ user={user}
                         v
                    ┌─────────┐
                    │Dashboard│  doesn't use `user`, just relays it
                    └────┬────┘
                         │ user={user}
                         v
                    ┌─────────┐
                    │ Sidebar │  doesn't use `user`, just relays it
                    └────┬────┘
                         │ user={user}
                         v
                    ┌──────────────┐
                    │SidebarFooter │  doesn't use `user`, just relays it
                    └──────┬───────┘
                           │ user={user}
                           v
                    ┌─────────┐
                    │UserMenu │  doesn't use `user`, just relays it
                    └────┬────┘
                         │ user={user}
                         v
                    ┌─────────┐
                    │ Avatar  │  ← FINALLY uses `user`
                    └─────────┘
```

Every arrow in that chain is a prop being handed down, whether the receiving component cares or not.

**Tree B — Context (the fix):**

```
                    ┌──────────────────────────┐
                    │  App                      │
                    │  <UserContext.Provider    │
                    │     value={user}>         │
                    └───────────┬───────────────┘
                                │
              ┌─────────────────┼──────────────────────┐
              │                 │                       │
              v                 v                       v
        ┌─────────┐       ┌─────────┐            ┌──────────────┐
        │Dashboard│       │ Sidebar │            │  (any other   │
        │ (no user│       │(no user │            │   descendant) │
        │  prop!) │       │  prop!) │            └──────────────┘
        └────┬────┘       └────┬────┘
             │                 │
             v                 v
        ┌─────────┐       ┌──────────────┐
        │  ...    │       │SidebarFooter │
        └─────────┘       └──────┬───────┘
                                  │
                                  v
                             ┌─────────┐
                             │UserMenu │
                             └────┬────┘
                                  │
                                  v
                             ┌─────────┐
                             │ Avatar  │◄── useContext(UserContext)
                             └─────────┘      reaches straight up to
                                               the Provider, skipping
                                               every component in between
```

`Avatar`'s connection to the Provider is direct — drawn as that dotted line straight up — regardless of how many components sit physically between them in the tree. None of those middle components hold, see, or forward the value. They're structurally in the tree, but functionally invisible to this particular piece of data.

**Now, the second diagram — the one you actually need to internalize for interviews and for real performance debugging:**

```
        Context value changes
              │
              v
   ┌─────────────────────────────────────────────┐
   │  React re-renders EVERY component that       │
   │  calls useContext(ThisContext) —             │
   │  regardless of which part of the value       │
   │  each one actually reads                     │
   └─────────────────────────────────────────────┘
              │
   ┌──────────┼───────────┬─────────────┬───────────┐
   v          v            v             v            v
Consumer A  Consumer B  Consumer C   Consumer D   Consumer E
(reads      (reads       (reads       (reads       (reads
 value.user) value.theme) value.cart) value.user)  value.locale)

    ALL FIVE RE-RENDER — even Consumer C, which only
    ever reads `value.cart` and doesn't care that
    `value.user` was the thing that actually changed.
```

This is not a bug. It's simply how Context works: a Provider holds *one* value, and when that value changes (by reference), React re-renders *every* component subscribed to that Provider via `useContext`, full stop. React has no way to know that Consumer C only reads `.cart` — from React's point of view, the context value is a single opaque blob, and if the blob changed, everyone downstream re-renders to be safe.

Keep this diagram in your head. We're coming back to it in Section 7 with real numbers.

---

## 5. A Complete Example — Theme Toggling

Let's build something real: a dark/light theme toggle that any component in the app can read and flip, without a single prop being passed.

```jsx
import { createContext, useContext, useState } from 'react';

// 1. Create the context, with a sensible default
//    (used only if a component reads it with NO Provider above it —
//    more on why that matters in Section 10)
const ThemeContext = createContext('light');

// 2. A Provider component that owns the actual state
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// 3. Any descendant, at any depth, reads it with useContext
function ThemedButton() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <button
      onClick={toggleTheme}
      style={{
        background: theme === 'light' ? '#fff' : '#222',
        color: theme === 'light' ? '#222' : '#fff'
      }}
    >
      Current theme: {theme} (click to toggle)
    </button>
  );
}

// 4. Wire it up at the top
function App() {
  return (
    <ThemeProvider>
      <Dashboard />
    </ThemeProvider>
  );
}

function Dashboard() {
  // Dashboard never touches theme at all — it just renders
  // whatever needs it, wherever it happens to live in the tree
  return (
    <div>
      <h1>Dashboard</h1>
      <ThemedButton />
    </div>
  );
}
```

Walk through what happens when you click the button:

1. `toggleTheme` runs, calling `setTheme` inside `ThemeProvider`.
2. `ThemeProvider` re-renders with the new `theme` value.
3. It creates a *new* `value` object (`{ theme, toggleTheme }`) and passes it into `ThemeContext.Provider`.
4. React sees the Provider's value changed, and re-renders every component that calls `useContext(ThemeContext)` — in this tiny example, just `ThemedButton`.
5. `Dashboard` does **not** re-render because of this — it never called `useContext(ThemeContext)` in the first place. It only re-renders if its own props or state change.

That last point is worth sitting with: Context re-renders don't ripple through every component in the tree — only through the ones that actually subscribed with `useContext`. `Dashboard` here is just a pass-through in the JSX tree, and it's untouched.

---

## 6. Compare With Related Concepts

You now have three real tools for moving data around a React app. When do you reach for which one?

| Approach | Best for | Re-render cost | Boilerplate |
|---|---|---|---|
| **Prop drilling** | 1-2 levels deep, or data only a couple of components need | Only the components in the actual chain re-render, each with fresh props | None — just pass the prop |
| **Context API** | Genuinely global/wide-reaching data: theme, current user, locale, authentication status | Every consumer of that context re-renders on any value change (see Section 7) | Small — createContext + Provider + useContext |
| **External state library (Redux, Zustand, Jotai...)** | App-wide state that changes often, with many independent slices, or complex update logic | Fine-grained — most libraries let components subscribe to only the slice of state they use, so unrelated updates don't re-render them | Larger — store setup, actions/selectors, sometimes middleware |

Here's the mental shortcut worth keeping:

- If the data barely changes and is needed almost everywhere → **Context** is a great, lightweight fit. Theme, locale, and "who is currently logged in" are the textbook examples.
- If the data changes constantly and only specific components need specific slices of it → reach for a dedicated state library instead. It's built from the ground up to avoid the "everyone re-renders" problem that plain Context has.
- If it's just a prop or two, one or two levels down → don't reach for either. Just pass the prop. Prop drilling gets a bad reputation, but two levels of drilling is completely fine and often clearer than a Context indirection.

**Context is not a general-purpose state management replacement.** It was designed to solve prop drilling for widely-shared, relatively stable values — not to be the one place all of your application's ever-changing state lives. Treating it that way is exactly what leads to the performance trap in the next section. (File 03 of this phase goes deeper into exactly when to reach past Context into a full state library.)

---

## 7. The Re-Render Trap — Full Depth

This is the single most important, most interview-tested fact about Context, so let's slow all the way down.

### The rule, stated precisely

> When the value passed to a `Context.Provider` changes, **every** component that calls `useContext()` on that context re-renders — even if that component only reads a small, unchanged part of the value.

React doesn't do partial subscriptions to a context value. It doesn't know (or care) that your component destructures just `{ user }` out of a bigger object. It only knows: "this component called `useContext(SomeContext)`, and `SomeContext`'s Provider value just changed, by reference — so this component re-renders."

### A concrete example of the trap

Imagine one big context holding everything "global" about the app:

```jsx
const AppContext = createContext();

function AppProvider({ children }) {
  const [user, setUser] = useState({ name: 'Priya' });
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);

  // one giant value, holding all three pieces of state
  const value = {
    user, setUser,
    theme, setTheme,
    notifications, setNotifications
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
```

Now say you have three consumers, each caring about a different slice:

```jsx
function UserBadge() {
  const { user } = useContext(AppContext);
  return <span>{user.name}</span>;
}

function ThemeToggle() {
  const { theme, setTheme } = useContext(AppContext);
  return <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>{theme}</button>;
}

function NotificationBell() {
  const { notifications } = useContext(AppContext);
  return <span>{notifications.length} new</span>;
}
```

Here's the trap: a new notification arrives every few seconds (a very plausible real-world scenario — a live chat badge, a stock ticker, a "new comment" counter). Every time `setNotifications` runs:

1. `AppProvider` re-renders.
2. It builds a **new** `value` object — `{ user, setUser, theme, setTheme, notifications, setNotifications }` — because object literals are recreated fresh on every render.
3. React compares this new `value` to the previous one and sees it's a different reference, so it re-renders every consumer.
4. `UserBadge` re-renders — even though `user` never changed.
5. `ThemeToggle` re-renders — even though `theme` never changed.
6. `NotificationBell` re-renders — which is the *only* one that actually needed to.

In a small demo, this is invisible. In a real app with hundreds of components subscribed to one bloated "app context," a single notification ticking in every few seconds can quietly cause a wave of unnecessary re-renders across your entire UI, several times a minute. This is one of the most common real-world React performance complaints — and it almost always traces back to exactly this pattern: one giant context, holding fast-changing and slow-changing values together.

### Why this happens, mechanically

React's context subscription model works at the level of "did the Provider's `value` prop change by reference (`Object.is` comparison)." It has no built-in mechanism to ask "did the specific field this component reads change?" That fine-grained tracking is precisely the feature that dedicated state libraries like Redux (with selectors) or Zustand add on top — they let a component subscribe to a derived slice and skip re-rendering when only unrelated state changes. Context, by itself, doesn't have that.

### The takeaway

Fast-changing values (a live counter, a form's every-keystroke state, real-time notification counts) are usually a bad fit for a Context that many components read — unless you either isolate that fast-changing value in its own narrowly-scoped context, or move it to something with fine-grained subscriptions instead.

> **Memory hook:** "One PA announcement wakes the whole building — even the floors that weren't listening for it."

---

## 8. Splitting Contexts

The most direct, practical fix for the trap above: **stop putting everything in one context.** Split by how often each piece changes and by who actually needs it.

```jsx
// Instead of one giant AppContext holding user + theme + notifications...

const UserContext = createContext();
const ThemeContext = createContext();
const NotificationContext = createContext();

function AppProviders({ children }) {
  return (
    <UserContext.Provider value={useUserState()}>
      <ThemeContext.Provider value={useThemeState()}>
        <NotificationContext.Provider value={useNotificationState()}>
          {children}
        </NotificationContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

Now trace through the same scenario as before: a new notification arrives.

- Only `NotificationContext`'s value changes.
- Only components calling `useContext(NotificationContext)` re-render.
- `UserBadge` (reading `UserContext`) and `ThemeToggle` (reading `ThemeContext`) are completely unaffected — they never subscribed to `NotificationContext` in the first place, so React doesn't even consider re-rendering them for this update.

This is the same "building announcement" analogy from Section 2, just refined: instead of one PA system broadcasting everything to everyone, you now have three separate channels — a "notifications" channel, a "theme" channel, a "user" channel — and each employee only tunes in to the ones relevant to them. A message on the notifications channel never makes the theme-channel listeners so much as twitch.

**The practical rule of thumb:** group values into a context by how often they change *together*, not just by "these are all kind of global." `user` and `theme` might both be "app-wide," but they change at wildly different rates and for different reasons — so they belong in separate contexts.

One more small but important detail from Section 7's trap: even after splitting contexts, remember to memoize each Provider's `value` (with `useMemo`) if it's an object or array, so a parent re-render alone doesn't manufacture a "new" value by reference when nothing inside it actually changed. We'll come back to this in Section 10's mistakes list.

> **Memory hook:** "One PA system for everything means one false alarm wakes the whole building — give notifications, theme, and user their own separate channels."

---

## 9. Context + useReducer — A Preview

There's a very common real-world pairing you'll see in almost every non-trivial React codebase: **Context for the "channel," `useReducer` for the "logic."**

The idea in a nutshell: instead of a Provider holding a bunch of separate `useState` calls, it holds one `useReducer`, and exposes both the current `state` and a `dispatch` function through context.

```jsx
const CartContext = createContext();

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.payload) };
    case 'CLEAR':
      return { ...state, items: [] };
    default:
      return state;
  }
}

function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  return (
    <CartContext.Provider value={{ state, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}

// Anywhere in the tree:
function AddToCartButton({ product }) {
  const { dispatch } = useContext(CartContext);
  return (
    <button onClick={() => dispatch({ type: 'ADD_ITEM', payload: product })}>
      Add to cart
    </button>
  );
}

function CartSummary() {
  const { state } = useContext(CartContext);
  return <span>{state.items.length} items in cart</span>;
}
```

Why this combo is so popular: `useReducer` centralizes *how* state changes (all the update logic lives in one `cartReducer` function, easy to test in isolation), and Context centralizes *where* that state is reachable from (anywhere in the tree, no prop drilling). Together, this is often called a "mini Redux" — you get a single store-like object and a dispatch function, without pulling in an actual external library.

It's still subject to everything from Section 7, though — if `CartContext`'s value changes on every dispatch (which it will, since `state` changes), every component reading `CartContext` re-renders. The mitigation techniques are the same: split contexts by concern, and memoize the value.

We're only scratching the surface here on purpose — `useReducer` gets its own full treatment in the next file of this phase, including when a reducer is genuinely better than several `useState` calls, and the details of actions, dispatch, and reducer function design.

> **Memory hook:** "useReducer writes the rulebook for how state changes; Context builds the hallway so anyone can walk in and read it."

---

## 10. Common Mistakes

**Mistake 1 — putting a fast-changing value in a widely-consumed context.**

We covered this at full depth in Section 7. The short version: if a value changes often (a live counter, every keystroke, a websocket feed) and many components subscribe to its context, you'll get a wave of re-renders across the app on every change. Isolate fast-changing values into their own narrow context, or move them out of Context entirely.

**Mistake 2 — forgetting the Provider wrapper.**

```jsx
const ThemeContext = createContext('light'); // default value: 'light'

function SomeDeeplyNestedComponent() {
  const theme = useContext(ThemeContext);
  return <div>{theme}</div>; // renders "light" — always, no matter what
}

function App() {
  return (
    // Oops — forgot to wrap with <ThemeContext.Provider value="dark">
    <SomeDeeplyNestedComponent />
  );
}
```

If a component calls `useContext(ThemeContext)` and there's no matching `<ThemeContext.Provider>` anywhere above it in the tree, it **silently** falls back to whatever default value you passed into `createContext(...)` — here, `'light'`. There's no error, no warning. Your component just quietly reads the default forever, and you'll spend twenty confused minutes wondering why your Provider's state updates aren't reaching it, when the real bug is that the Provider was never actually wrapped around this part of the tree at all (maybe it's in a different route, a portal, or was simply left out).

The fix is always the same: trace the JSX tree upward from the confused component and confirm a `<Context.Provider>` genuinely wraps it.

> **Memory hook:** "No PA speaker wired up on that floor? The room just hears silence — dead default — and nobody's told."

**Mistake 3 — creating a new object literal as the value on every render.**

```jsx
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  return (
    // BAD: { theme, toggleTheme } is a brand-new object on every render
    // of ThemeProvider, even if theme itself didn't change this time
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

Every time `ThemeProvider` re-renders — even for a reason that has nothing to do with theme — this creates a fresh object literal. React compares Provider values by reference, so a "new" object (even with identical contents) counts as "the value changed," and every consumer re-renders regardless of whether anything meaningful actually changed. This also defeats `React.memo` on any consumer component further down, since a memoized component still re-renders when the context it reads reports a "new" value.

The fix is to memoize the value so it only changes when its actual contents change:

```jsx
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
```

Now the object reference only changes when `theme` (or `toggleTheme`, which is itself stabilized with `useCallback`) actually changes — not on every unrelated re-render of `ThemeProvider`.

> **Memory hook:** "A fresh envelope every time, even with the same letter inside, still looks like new mail — memoize the envelope, not just the letter."

**Mistake 4 — using Context as a substitute for all state management.**

If you find yourself reaching for `createContext` every time two components need to share any piece of state, even state that's local to one small feature, stop and ask whether a shared parent component with regular props (or lifting state up just one or two levels) would be simpler. Context shines for genuinely wide, cross-cutting concerns. For a form with five fields that only two sibling components need, plain props or lifting state up is usually clearer and has no re-render surprises to reason about.

**Mistake 5 — assuming `useContext` "subscribes to a slice."**

It's tempting to think `const { user } = useContext(AppContext)` means "only re-render me when `user` changes." It doesn't. It means "re-render me whenever `AppContext`'s Provider value changes, for any reason at all, and then let me destructure whatever I want from the new value." The destructuring happens *after* the re-render decision has already been made, not before.

---

## 11. Interview Answer

"React's Context API solves prop drilling — the need to pass a prop through many intermediate components that don't use it themselves, just so it can reach a deeply nested descendant that does. It has three parts: `createContext()` creates the context object, `<Context.Provider value={...}>` supplies a value to everything beneath it in the tree, and `useContext(Context)` lets any descendant read that value directly, regardless of depth, without any component in between needing to know it exists. The major caveat is performance: whenever a Provider's value changes, React re-renders every component that calls `useContext` on it, even if that component only reads a part of the value that didn't change. Because of this, Context is best used for genuinely global, relatively stable data — theme, authenticated user, locale — rather than as a general-purpose state management tool. Fast-changing state, or state that's only relevant to a small subtree, is usually better served by keeping it local, splitting it into a narrower context, or moving to a dedicated state library with fine-grained subscriptions."

---

## 12. Hands-On Exercises

**Exercise 1 — Spot and fix the prop drilling**

Given this component chain, rewrite it using Context so that only `App` and `Avatar` need to know about `currentUser` — `Layout`, `Sidebar`, and `Profile` should not receive it as a prop at all:

```jsx
function App() {
  const currentUser = { name: 'Wei', role: 'admin' };
  return <Layout currentUser={currentUser} />;
}
function Layout({ currentUser }) { return <Sidebar currentUser={currentUser} />; }
function Sidebar({ currentUser }) { return <Profile currentUser={currentUser} />; }
function Profile({ currentUser }) { return <Avatar currentUser={currentUser} />; }
function Avatar({ currentUser }) { return <span>{currentUser.name} ({currentUser.role})</span>; }
```

**Exercise 2 — Reproduce the re-render trap**

Build one `AppContext` holding both `count` (incremented by a button every second via `setInterval`) and `username` (a static string). Add a `UsernameDisplay` component that only reads `username`, and add a `console.log` inside its render body. Run it and observe: does `UsernameDisplay` log on every tick, even though `username` never changes? Explain why, referencing Section 7.

**Exercise 3 — Fix it by splitting contexts**

Take your Exercise 2 code and split it into `CountContext` and `UsernameContext`, each with its own Provider. Confirm via your `console.log` that `UsernameDisplay` (now reading only `UsernameContext`) no longer re-renders on every tick.

**Exercise 4 — Forgotten Provider bug hunt**

You're handed a bug report: "the dark mode toggle button lives on a settings page reached via a modal, and it always shows 'light' no matter what I click." Given that `ThemeContext.Provider` wraps `<App>` but the modal is rendered via `ReactDOM.createPortal` outside of `<App>`'s DOM node, explain why the modal's contents might not actually be nested inside the Provider in the JSX tree (portals render to a different DOM node, but their JSX position/ancestry is what determines context — dig into whether this bug is really about the Provider location, or something else, and describe how you'd confirm it).

**Exercise 5 — Context + useReducer mini cart**

Implement the `CartProvider` / `cartReducer` example from Section 9 in full, plus a `RemoveFromCartButton` component and a `ClearCartButton`. Wire up a small page that lists cart items with a remove button next to each, and a clear-all button at the bottom.

**Exercise 6 — Memoize the value**

Take the `ThemeProvider` example from Mistake 3 in Section 10. Add an unrelated piece of state to `ThemeProvider` (say, a `debugMode` boolean toggled by a button) that has nothing to do with theme. Before adding `useMemo`/`useCallback`, add a `console.log` inside a memoized child component that reads `ThemeContext`, and confirm it logs every time `debugMode` is toggled — even though `theme` never changed. Then add the `useMemo`/`useCallback` fix and confirm the log stops firing on unrelated `debugMode` toggles.

---

## 13. Interview Q&A

**Q1: What problem does the Context API solve?**

A: It solves prop drilling — the need to pass a prop down through many components that don't use it, purely to reach a deeply nested component that does. Context lets any descendant read a shared value directly, without every intermediate component needing to receive and forward it as a prop.

---

**Q2: What are the three core pieces of the Context API, and how do they connect?**

A: `createContext()` creates the context object (the "channel"). `<Context.Provider value={...}>` wraps a subtree and supplies a value to it (the "broadcast"). `useContext(Context)` is called inside any descendant component to read the nearest Provider's current value (the "receiver"). If there's no Provider above a component that calls `useContext`, it receives the default value passed to `createContext`.

---

**Q3: What happens, performance-wise, when a context's value changes?**

A: Every component that calls `useContext()` on that context re-renders — even if the component only reads a portion of the value that didn't actually change. React compares the Provider's `value` by reference; if it's a new reference, every subscriber re-renders, regardless of which fields inside it changed.

---

**Q4: Why is putting frequently-changing state (like a live counter or every keystroke of a form) into a widely-consumed context a common mistake?**

A: Because any update to that fast-changing value forces every component subscribed to that context to re-render, even components that only care about unrelated, unchanged parts of the value. In a large app with many consumers on one bloated context, this can cause frequent, unnecessary re-renders across large parts of the UI.

---

**Q5: How do you mitigate the "everyone re-renders" problem?**

A: Split one large context into several smaller, more narrowly-scoped contexts, grouped by how often their values change together (not just by "this feels global"). Also memoize the Provider's `value` with `useMemo` (and any functions inside it with `useCallback`) so a new object reference isn't created on every render when nothing inside actually changed.

---

**Q6: When should you NOT use Context?**

A: When the data is only needed by one or two nearby components (plain props are simpler), when the state changes very frequently and is consumed broadly (better isolated or handled by a state library with fine-grained subscriptions), or when you're using it as a blanket replacement for all application state rather than for genuinely global, slow-changing concerns like theme, authenticated user, or locale.

---

**Q7: What happens if you call `useContext` without a matching Provider above the component in the tree?**

A: The component silently receives the default value that was passed to `createContext()`, with no error or warning. This is a common source of confusing bugs — a Provider might be missing due to being in the wrong part of the tree, a mis-scoped route, or simply forgotten, and the component will keep quietly returning the default forever.

---

**Q8: Why does creating a new object literal as a Provider's value on every render cause problems?**

A: React determines whether a context's value "changed" by reference comparison. A freshly created object literal (`{ theme, toggleTheme }`) is a new reference on every render of the Provider component, even if its contents are identical to last time. This causes every consumer to re-render unnecessarily, and it also defeats `React.memo` on consumer components further down the tree, since they still see a "new" context value.

---

**Q9: How do you fix the "new object every render" problem?**

A: Wrap the value object in `useMemo`, with its actual dependencies (like `theme`) in the dependency array, and wrap any functions included in the value (like `toggleTheme`) in `useCallback`. This way the value object only gets a new reference when something inside it genuinely changed.

---

**Q10: Compare Context to an external state library like Redux or Zustand.**

A: Context re-renders every subscribed component whenever its Provider value changes by reference, with no built-in way to subscribe to just a slice. Libraries like Redux (with selectors) or Zustand offer fine-grained subscriptions — a component can subscribe to a derived slice of the store and skip re-rendering when unrelated state changes. Context is lighter-weight and requires no extra dependency, which makes it great for simple, slow-changing, widely-read values; a dedicated library earns its complexity when state changes often, is large, or needs middleware, devtools, or fine-grained performance control.

---

**Q11: Why is Context and `useReducer` a common pairing?**

A: `useReducer` centralizes how state updates happen (all transition logic lives in one reducer function, easy to reason about and test), and Context centralizes where that state and its dispatch function are reachable from (anywhere in the subtree, without prop drilling). Combined, they form a lightweight "mini Redux" pattern without an external library, commonly used for things like shopping carts or multi-step form state.

---

**Q12: Does using Context + useReducer avoid the re-render trap from Section 7?**

A: No — the same rules still apply. If a context's value includes a reducer's `state`, then any dispatched action that changes that state creates a new value, and every component reading that context re-renders. The same mitigations apply: splitting contexts by concern, and memoizing the Provider's value where reasonable.

---

**Q13: Give an example of good Context usage versus bad Context usage.**

A: Good: a `ThemeContext` holding the current theme and a toggle function, read by many components across the app, changing rarely (only when the user actually switches themes). Bad: an `AppContext` holding a rapidly-updating notification count alongside slow-changing user/theme data, read broadly across the app — this causes many unrelated components to re-render every time a notification arrives.

---

**Q14: What is the newer `use()` hook, and how does it relate to `useContext`?**

A: `use()` is a newer React API that can read context (and also resolve promises) and, unlike `useContext`, can be called conditionally — inside `if` statements or after early returns — rather than always at the top level of a component. For straightforward context-reading in components written to the classic Hooks rules, `useContext` remains the direct, well-established way to read a context value, and is what you'll see in the overwhelming majority of existing React code.

---

**Q15: If two contexts are both read by the same component, and only one of them changes, does the component re-render?**

A: Yes. If a component calls `useContext` on two different contexts, it re-renders whenever *either* Provider's value changes — React doesn't skip the re-render just because the other context happens to be unaffected. The component simply re-renders and, on that render, sees the updated value from the context that changed and the same value as before from the one that didn't.
