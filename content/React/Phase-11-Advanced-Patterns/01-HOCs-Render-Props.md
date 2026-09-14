# 01 — Higher-Order Components & Render Props

> "Before hooks, sharing behavior meant sharing structure — you couldn't hand someone your logic without also handing them a wrapper, a nested function, or both."

---

## Table of Contents

1. [The Problem: Reusing Stateful Logic Before Hooks Existed](#1-the-problem-reusing-stateful-logic-before-hooks-existed)
2. [Higher-Order Components (HOCs)](#2-higher-order-components-hocs)
   - 2.1 [The Analogy: A Gift-Wrapping Service](#21-the-analogy-a-gift-wrapping-service)
   - 2.2 [Basic Definition](#22-basic-definition)
   - 2.3 [Building `withLoading` Step by Step](#23-building-withloading-step-by-step)
3. [Internal Working: Wrapper Hell in DevTools](#3-internal-working-wrapper-hell-in-devtools)
4. [The Three Real HOC Pain Points](#4-the-three-real-hoc-pain-points)
   - 4.1 [Wrapper Hell](#41-wrapper-hell)
   - 4.2 [Prop Name Collisions](#42-prop-name-collisions)
   - 4.3 [Broken Ref Forwarding](#43-broken-ref-forwarding)
5. [Render Props](#5-render-props)
   - 5.1 [The Analogy: Hiring a Tour Guide](#51-the-analogy-hiring-a-tour-guide)
   - 5.2 [Basic Definition](#52-basic-definition)
   - 5.3 [Building `MouseTracker` Step by Step](#53-building-mousetracker-step-by-step)
6. [Internal Working: The Callback Pyramid](#6-internal-working-the-callback-pyramid)
7. [Side by Side: HOC vs Render Props vs Custom Hook](#7-side-by-side-hoc-vs-render-props-vs-custom-hook)
8. [Compare With Related Concepts](#8-compare-with-related-concepts)
9. [Common Mistakes](#9-common-mistakes)
10. [Interview Answer: Why Did Hooks Replace HOCs and Render Props?](#10-interview-answer-why-did-hooks-replace-hocs-and-render-props)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem: Reusing Stateful Logic Before Hooks Existed

Let's set the scene properly, because this file only makes sense once you feel the problem it's answering.

Imagine it's a few years before Hooks existed. React only has class components. You've built `UserProfile`, and it needs to show a spinner while data loads:

```jsx
class UserProfile extends React.Component {
  state = { user: null, loading: true };

  componentDidMount() {
    fetchUser(this.props.userId).then((user) => {
      this.setState({ user, loading: false });
    });
  }

  render() {
    if (this.state.loading) return <Spinner />;
    return <div>{this.state.user.name}</div>;
  }
}
```

Fine. Ships.

Now `ProductDetails` needs the exact same "fetch something, show a spinner while it's loading" behavior:

```jsx
class ProductDetails extends React.Component {
  state = { product: null, loading: true };

  componentDidMount() {
    fetchProduct(this.props.productId).then((product) => {
      this.setState({ product, loading: false });
    });
  }

  render() {
    if (this.state.loading) return <Spinner />;
    return <div>{this.state.product.title}</div>;
  }
}
```

You've now written `state = { ..., loading: true }`, a `componentDidMount` that fetches and flips `loading`, and an `if (this.state.loading) return <Spinner />` check — twice, nearly word for word. A third component needs the same thing tomorrow.

Here's the part that matters: **if you already know Custom Hooks from Phase 4, your instinct right now is "just write `useLoading()` and call it from both components."** That instinct is exactly correct — but it's also anachronistic. Hooks didn't exist yet. `useState` and `useEffect` weren't invented until React 16.8, in February 2019. Before that release, there was no function you could call from inside a component to borrow a piece of stateful behavior. Classes couldn't do that — a class's internal state and lifecycle methods belong to that class; you can't "call" `componentDidMount` from a different, unrelated class and have its `setState` calls land on your instance.

So if plain functions and shared logic-through-calling weren't an option, what were people left with? Only one lever: **component composition.** If you can't share logic by calling a function, you can still share logic by wrapping a component in another component, or by handing a component a function that it calls back with data.

Two patterns grew out of exactly that constraint:

- **Higher-Order Components (HOCs)** — write the shared logic once, as a function that takes a component and hands back a new, wrapped component with the extra behavior baked in.
- **Render Props** — write the shared logic once, inside a component that doesn't render its own fixed UI, but instead calls a function you hand it, passing along whatever data it computed.

Both were clever, both were widely used (Redux's `connect()`, React Router's `<Route render={...}>`, plenty of production codebases still have them), and both come with real, well-documented downsides that we're about to walk through in full. Understanding those downsides is exactly what makes you appreciate why Hooks were such a genuine relief when they arrived — not just a stylistic preference, but a structural fix.

**Why learn this at all, in 2026, when nobody would design new code this way?** Two honest reasons. First, legacy literacy: you will run into these patterns in older codebases, in library source code, and occasionally in interview questions that test whether you understand *why* React evolved the way it did. Second, seeing the problems these patterns caused is the fastest way to actually understand what Hooks fixed — reading "hooks avoid wrapper hell" as a bullet point is forgettable; watching wrapper hell happen with your own eyes is not.

---

## 2. Higher-Order Components (HOCs)

### 2.1 The Analogy: A Gift-Wrapping Service

Picture a gift-wrapping counter at a department store. You hand them a plain box — your component. They don't touch what's inside the box at all. They wrap it in paper, add a bow, maybe tuck in a little care instructions card, and hand you back... a *new* box. Same gift inside, but now it's wrapped, and it has extra stuff attached to the outside.

```
   Your plain component            The wrapping service              What you get back
   ┌───────────────┐                                              ┌─────────────────────┐
   │  UserProfile   │   ──── handed to withLoading() ────►        │  Wrapped component   │
   │  (the "gift")  │                                              │  (adds a spinner,    │
   └───────────────┘                                              │   a loading prop)    │
                                                                    │  ┌───────────────┐   │
                                                                    │  │  UserProfile   │   │
                                                                    │  └───────────────┘   │
                                                                    └─────────────────────┘
```

That's the whole idea of a HOC: **you don't modify the original component at all.** You hand it to a function, and that function gives you back a *different*, wrapping component that renders your original component inside itself, with something extra added.

---

### 2.2 Basic Definition

A **Higher-Order Component** is a function that takes a component as an argument and returns a new component.

```js
const EnhancedComponent = higherOrderComponent(WrappedComponent);
```

That's the entire shape. Nothing React-specific about the *concept* — it's the exact same idea as a higher-order function in plain JavaScript (a function that takes or returns another function, like `Array.prototype.map`). React just applies that idea to components instead of ordinary functions.

The naming convention you'll see everywhere is `withSomething`:

```
withAuth(Component)
withLoading(Component)
withRouter(Component)
withTheme(Component)
connect(mapState, mapDispatch)(Component)   // Redux's HOC, just with an extra layer
```

---

### 2.3 Building `withLoading` Step by Step

Let's actually build one, rather than just describing it.

**Step 1 — notice the duplication.** Both `UserProfile` and `ProductDetails` from Section 1 have the identical shape: track a `loading` flag, show `<Spinner />` while it's true, otherwise render the real content.

**Step 2 — write a function that takes a component and returns a new one.**

```jsx
function withLoading(WrappedComponent) {
  return function WithLoadingComponent(props) {
    if (props.loading) {
      return <Spinner />;
    }
    return <WrappedComponent {...props} />;
  };
}
```

Notice the shape here: `withLoading` doesn't render anything by itself in the interesting case — it just decides, based on a `loading` prop, whether to render a spinner or hand every prop straight through to the real component using `{...props}`.

**Step 3 — use it to wrap your presentational components.** Strip the loading logic out of `UserProfile` entirely — it becomes a simple, "dumb" component that just displays data:

```jsx
function UserProfile({ user }) {
  return <div>{user.name}</div>;
}

const UserProfileWithLoading = withLoading(UserProfile);
```

**Step 4 — the parent component supplies the `loading` prop**, usually from its own data-fetching logic:

```jsx
function UserProfilePage({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, [userId]);

  return <UserProfileWithLoading user={user} loading={loading} />;
}
```

Notice `UserProfileWithLoading` is a totally different, wrapping component — it isn't `UserProfile` with some new methods bolted on. It's a brand-new function component that happens to render `UserProfile` inside itself when `loading` is false.

Now reuse `withLoading` for `ProductDetails` with zero duplicated spinner logic:

```jsx
function ProductDetails({ product }) {
  return <div>{product.title}</div>;
}

const ProductDetailsWithLoading = withLoading(ProductDetails);
```

That's a real, working HOC. Small, but it demonstrates the entire pattern: a function, taking a component, returning a wrapping component, injecting behavior (here, a loading-gate) via props.

> **Memory hook:** A HOC is gift-wrapping — you never touch the gift, you just add another box around it, and every extra box is another layer someone has to unwrap to find what's actually inside.

---

## 3. Internal Working: Wrapper Hell in DevTools

Here's where the pattern starts to show its cracks, and the best way to see it is to imagine composing several HOCs together — which is extremely common in real codebases, because no single cross-cutting concern (auth, theming, loading, routing, analytics) is usually enough on its own.

```jsx
const Enhanced = withAuth(withTheme(withLoading(withRouter(UserProfile))));
```

Every one of those `with*` calls returns a *new* wrapping component. When React actually renders `<Enhanced />`, here's the component tree it has to build, layer by layer:

```text
<Enhanced />
  └── WithAuth(props)                     ← withAuth's wrapper component
        └── WithTheme(props)              ← withTheme's wrapper component
              └── WithLoading(props)      ← withLoading's wrapper component
                    └── WithRouter(props) ← withRouter's wrapper component
                          └── UserProfile(props)   ← finally, your actual component
```

Five layers deep, and only the bottom one is the component you actually wrote. Now open React DevTools' Components panel on a tree like this in a real app — where this kind of stacking happens on *many* different components, not just one — and you get long, repetitive chains like:

```text
▾ WithAuth
  ▾ WithTheme
    ▾ WithLoading
      ▾ WithRouter
        ▾ Connect(withStyles(UserProfile))
          ▾ UserProfile
```

This is what the community nicknamed **"wrapper hell."** It's not a crash, not a bug — the app works fine — but every debugging session now involves scrolling through a stack of generic wrapper names before you even reach the component whose actual code you wrote and want to inspect. Worse, several of these wrapper names default to unhelpful things like `WithLoadingComponent` or even anonymous, unless the HOC author explicitly bothers to set `.displayName` on the returned component — which many don't.

---

## 4. The Three Real HOC Pain Points

Let's go through the three concrete, well-documented problems in full depth — these are exactly the reasons the React team designed Hooks as a replacement, and they show up constantly in interview questions asking "why did React move away from HOCs?"

### 4.1 Wrapper Hell

Covered in mechanism above (Section 3) — but it's worth stating the cost plainly: every layer of wrapping is a real extra component in the tree. That means:

- Extra entries in React DevTools you have to click through to find your actual component.
- Extra render calls — each wrapper is a real component that re-renders as part of the tree, even though it usually renders nothing itself besides its child.
- Harder stack traces — an error thrown inside `UserProfile` shows a component stack five names long, most of which tell you nothing about *your* code.

None of this is fatal. It's friction, paid on every single debugging session, for the entire lifetime of the codebase.

---

### 4.2 Prop Name Collisions

This one is subtler, and much more dangerous, because it fails *silently*.

Say `withLoading` injects a prop called `loading`:

```jsx
function withLoading(WrappedComponent) {
  return function (props) {
    return props.loading ? <Spinner /> : <WrappedComponent {...props} />;
  };
}
```

And separately, `withNetworkStatus` — written by a different developer, in a different file, with no knowledge of `withLoading`'s existence — *also* decides to inject a prop called `loading` (meaning "the network request is loading," a genuinely different concept from "the loading spinner gate"):

```jsx
function withNetworkStatus(WrappedComponent) {
  return function (props) {
    const isOnline = useNetworkStatus();
    return <WrappedComponent {...props} loading={!isOnline} />;
  };
}
```

Now compose them:

```jsx
const Enhanced = withLoading(withNetworkStatus(UserProfile));
```

Trace what actually happens to the `loading` prop as it flows down:

```text
Enhanced receives props from its parent, e.g. { loading: true, userId: 5 }
        |
        v
withLoading's wrapper runs first (outermost).
It reads props.loading (= true) to decide: show Spinner, or render child?
It spreads {...props} down to the next layer — including loading: true.
        |
        v
withNetworkStatus's wrapper receives { loading: true, userId: 5 }.
It spreads {...props} down too, THEN adds its OWN loading prop last:
  <WrappedComponent {...props} loading={!isOnline} />
This OVERWRITES the incoming loading value with its own meaning.
        |
        v
UserProfile receives props.loading — but whose "loading" is this now?
It's whichever wrapper applied its prop LAST in the JSX spread order —
not necessarily the one anyone intended, and nothing warns you about it.
```

Notice there's no error, no warning, no crash. JSX prop spreading just does what object spreading always does in JavaScript — the last value assigned to a given key wins. If two independently-written HOCs both happen to pick the same prop name, one of them's value silently disappears, and you find out only when the UI behaves strangely and you go hunting for why `loading` doesn't mean what you expect.

This is genuinely hard to guard against, because HOC authors can't see each other's code. `withAuth` doesn't know `withTheme` exists, and vice versa — there's no compiler check, no lint rule, nothing that flags "hey, these two things you're composing both use the prop name `data`."

---

### 4.3 Broken Ref Forwarding

Here's the third pain point, and it's the most mechanical of the three.

Say `UserProfile` needs to expose a focus method via a ref — a common need for form inputs, custom widgets, anything imperative. Normally:

```jsx
const ref = useRef();
<UserProfile ref={ref} />;
// ref.current would point at UserProfile's instance/DOM node
```

Now wrap it:

```jsx
const EnhancedProfile = withLoading(UserProfile);
<EnhancedProfile ref={ref} />;
```

**This does not do what you'd hope.** `ref` is not treated like a normal prop in React — it's handled specially by React itself, and it never appears inside the `props` object you access as `props.ref`. When `withLoading`'s wrapper function does `<WrappedComponent {...props} />`, the `ref` you passed to `EnhancedProfile` is *not* part of `props`, so it never even reaches `WrappedComponent`. Instead, `ref` attaches to whatever `withLoading`'s own wrapper component is — the wrapper function itself, not the `UserProfile` you actually care about.

```text
<EnhancedProfile ref={myRef} />
        |
        v
React attaches myRef to the WithLoadingComponent wrapper function itself
        |
        v
The {...props} spread inside WithLoadingComponent does NOT include ref
        |
        v
UserProfile never receives any ref at all
        |
        v
myRef.current now points at... nothing useful for a plain function
component (function components have no instance) — or, in older
class-based HOCs, it points at the WRAPPER's instance, not UserProfile's
```

**The fix** is `React.forwardRef` — a built-in API specifically for this situation. The HOC has to explicitly opt in to passing the ref through:

```jsx
function withLoading(WrappedComponent) {
  function WithLoadingComponent(props, ref) {
    if (props.loading) {
      return <Spinner />;
    }
    return <WrappedComponent {...props} ref={ref} />;
  }
  return React.forwardRef(WithLoadingComponent);
}
```

Notice this isn't automatic — the HOC author has to *remember* to do this, every single time, for every HOC that might ever be composed with a component someone wants to attach a ref to. Forget it once, and refs silently stop working through that layer, with no error message pointing you at the cause.

---

## 5. Render Props

### 5.1 The Analogy: Hiring a Tour Guide

A HOC is like gift-wrapping — the wrapper decides what the final package looks like, and you just receive it. Render props flip that relationship.

Picture hiring a tour guide in a new city. The guide knows the streets, knows where the good viewpoints are, knows the history — that's their expertise, their "internal state." But the guide doesn't decide what photos end up in your vacation album. At each stop, the guide says "here we are, this is what's around" and then hands the moment to *you*: you decide what to point your camera at, what to skip, what to caption.

That's a render prop. The component with the useful internal data (the guide) doesn't dictate the UI. Instead, at the moment it has something to share, it calls a function *you* provided, handing over the data, and lets you decide what to render with it.

---

### 5.2 Basic Definition

A **render prop** is a prop whose value is a function, which a component calls during its own render, passing along some data, and using the function's return value as (all or part of) what it actually renders.

```jsx
<DataProvider render={(data) => <SomeUI data={data} />} />
```

You'll also very commonly see this exact idea expressed using `children` as the function, instead of a differently-named `render` prop:

```jsx
<DataProvider>
  {(data) => <SomeUI data={data} />}
</DataProvider>
```

Both are "the render props pattern" — the name refers to the *technique* (passing a function that renders something), not to a prop that must literally be spelled `render`.

---

### 5.3 Building `MouseTracker` Step by Step

Let's build the textbook example, since it's the clearest possible demonstration of the pattern.

**Step 1 — identify the reusable stateful logic.** Tracking the mouse's current `x`/`y` position on every `mousemove` event. Multiple components might want this (a custom cursor, a tooltip that follows the pointer, a drawing canvas).

**Step 2 — build a component that owns that state, but doesn't hardcode what to render with it.**

```jsx
class MouseTracker extends React.Component {
  state = { x: 0, y: 0 };

  handleMouseMove = (event) => {
    this.setState({
      x: event.clientX,
      y: event.clientY,
    });
  };

  render() {
    return (
      <div style={{ height: "100vh" }} onMouseMove={this.handleMouseMove}>
        {this.props.render(this.state)}
      </div>
    );
  }
}
```

Notice the crucial line: `{this.props.render(this.state)}`. `MouseTracker` doesn't know or care what actually gets displayed — it just tracks `x`/`y`, and at render time, calls whatever function was handed to it via the `render` prop, passing the current position.

**Step 3 — consumers decide what to do with the position, however they like.**

```jsx
function App() {
  return (
    <MouseTracker
      render={({ x, y }) => (
        <p>The mouse is currently at ({x}, {y})</p>
      )}
    />
  );
}
```

Or, a completely different consumer, reusing the exact same `MouseTracker`, rendering something entirely different:

```jsx
function CustomCursorDemo() {
  return (
    <MouseTracker
      render={({ x, y }) => (
        <img
          src="/cursor.png"
          style={{ position: "absolute", left: x, top: y }}
        />
      )}
    />
  );
}
```

Same tracking logic, two totally different results — because `MouseTracker` never dictated the UI. It just handed over the data and let each caller decide.

You'll also see this written with `children` instead of `render`, which reads slightly more naturally in JSX:

```jsx
<MouseTracker>
  {({ x, y }) => <p>({x}, {y})</p>}
</MouseTracker>
```

which just requires `MouseTracker`'s render method to call `this.props.children(this.state)` instead of `this.props.render(this.state)` — functionally identical, different naming choice.

---

## 6. Internal Working: The Callback Pyramid

Render props solve the prop-collision problem HOCs have — there's no prop being silently overwritten, because the data is handed directly as a function argument, not merged via spreading. But they introduce their own, very visible problem the moment you need *more than one* piece of shared data.

Suppose you need mouse position, window size, *and* network status, all inside one component, and all three happen to be built as render-prop components:

```jsx
<MouseTracker>
  {(mouse) => (
    <WindowSizeProvider>
      {(size) => (
        <NetworkStatusProvider>
          {(isOnline) => (
            <MyComponent mouse={mouse} size={size} isOnline={isOnline} />
          )}
        </NetworkStatusProvider>
      )}
    </WindowSizeProvider>
  )}
</MouseTracker>
```

Lay that indentation out and the shape becomes obvious:

```text
<MouseTracker>
  {(mouse) => (
    <WindowSizeProvider>
      {(size) => (
        <NetworkStatusProvider>
          {(isOnline) => (
            <MyComponent ... />
          )}
        </NetworkStatusProvider>              ← 3 levels deep
      )}
    </WindowSizeProvider>                     ← 2 levels deep
  )}
</MouseTracker>                                ← 1 level deep
```

Every additional shared piece of data adds another level of rightward indentation, another nested function, another closing `)}` you have to match up correctly. Long-time JavaScript developers will recognize the shape immediately — it's structurally identical to the "callback hell" pyramid from pre-Promise, pre-`async`/`await` asynchronous code:

```js
getUser(id, (user) => {
  getPosts(user.id, (posts) => {
    getComments(posts[0].id, (comments) => {
      // three levels deep just to get here
    });
  });
});
```

Same shape, same readability problem, just wearing JSX instead of plain callbacks. Each new dependency doesn't compose flatly — it nests one level deeper, and reading the *actual* leaf component that finally uses all this data means mentally unwinding several layers of "okay, this function's argument is `mouse`, which came from here, which is inside this other function whose argument is `size`..."

> **Memory hook:** A render prop hands you the paintbrush instead of painting for you — freeing, until you're holding three paintbrushes at once and your JSX turns into a staircase.

---

## 7. Side by Side: HOC vs Render Props vs Custom Hook

This is the single most useful comparison in this entire file, so let's actually build it out concretely. Same reusable logic — **track the browser window's size** — implemented three different ways.

**As a HOC:**

```jsx
function withWindowSize(WrappedComponent) {
  return function WithWindowSize(props) {
    const [size, setSize] = useState({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    useEffect(() => {
      function handleResize() {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    return <WrappedComponent {...props} windowSize={size} />;
  };
}

// Usage — adds a wrapping layer, risks colliding with any other HOC
// that also happens to inject a `windowSize` prop
const ResponsiveLayout = withWindowSize(Layout);
<ResponsiveLayout />;
```

**As a render prop:**

```jsx
function WindowSize({ render }) {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    function handleResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return render(size);
}

// Usage — no prop collision, but nests one level for every render-prop
// component you need to combine with others
<WindowSize render={(size) => <Layout windowSize={size} />} />;
```

**As a custom hook (the modern, recommended approach — see Phase 4):**

```jsx
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    function handleResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

// Usage — one line, no wrapper, no nesting, no prop-name risk
function Layout() {
  const windowSize = useWindowSize();
  return <div>{windowSize.width}px wide</div>;
}
```

Notice something important: **the actual stateful logic inside all three — the `useState`, the `useEffect`, the resize listener — is identical.** Nothing about the underlying behavior changed. What changed is purely the *packaging*: a HOC wraps a component and risks prop collisions and broken refs; a render prop avoids collisions but nests calling code inside callbacks; a custom hook is just a function call, sitting flatly inside whatever component needs it, with no wrapping component and no nesting at all.

| Aspect | HOC | Render Props | Custom Hook |
|---|---|---|---|
| Reuse mechanism | Wraps a component, returns a new component | Component calls a function prop during its render | Plain function call inside a component body |
| Adds a wrapper to the tree? | Yes — one extra component per HOC applied | Yes — the provider component itself | No — no extra component at all |
| Prop collision risk | Yes — two HOCs can inject the same prop name and silently overwrite each other | No — data arrives as a function argument, not merged props | No — you name the returned value yourself at the call site |
| Nesting cost | "Wrapper hell" — deep, repetitive chains in the component tree/DevTools | "Callback pyramid" — one extra nested function per combined render prop | None — hooks compose by calling one after another, flatly |
| Ref forwarding | Broken by default; needs manual `React.forwardRef` | Not applicable in the same way — no wrapping component intercepting the ref | Not applicable — no component wrapping happens |
| Current industry recommendation | Legacy — expect to encounter it, avoid for new code | Legacy — expect to encounter it, avoid for new code | Recommended default for sharing stateful logic since React 16.8 |

> **Memory hook:** HOCs wrap, render props hand you a paintbrush, hooks just... work — same logic underneath, three very different receipts for how you pay to reuse it.

---

## 8. Compare With Related Concepts

| Tool | Shares stateful logic? | Adds a wrapper/extra nesting? | Prop collision risk? | Ref handling |
|---|---|---|---|---|
| **Higher-Order Component** | Yes | Yes — one wrapper component per HOC | Yes — merged via prop spreading | Broken by default, needs `forwardRef` |
| **Render Props** | Yes | Yes — one nested function per render-prop component | No — data passed as function args | N/A — no wrapping component intercepts refs |
| **Custom Hook** (Phase 4) | Yes | No | No | N/A — no component wrapping at all |
| **Context** (Phase 6) | Shares *data*, not exactly reusable logic in the HOC/hook sense | No extra component wrapper in the render tree beyond the Provider | No — consumed by name via `useContext` | N/A |

The short version, and the theme of this whole file: HOCs and render props both existed to solve the same problem custom hooks solve today — reusing stateful logic across components — but both had to route that reuse *through the component tree itself* (wrapping, or nested function calls), because before Hooks, there was no other channel available. Hooks gave logic reuse a channel that bypasses the component tree entirely: a plain function call.

---

## 9. Common Mistakes

**Mistake 1 — forgetting `forwardRef` in a HOC.**

```jsx
// ❌ Wrong — ref never reaches WrappedComponent
function withLoading(WrappedComponent) {
  return function (props) {
    return props.loading ? <Spinner /> : <WrappedComponent {...props} />;
  };
}

// ✅ Right — ref is explicitly threaded through
function withLoading(WrappedComponent) {
  function Wrapper(props, ref) {
    return props.loading ? <Spinner /> : <WrappedComponent {...props} ref={ref} />;
  }
  return React.forwardRef(Wrapper);
}
```

If you skip this, `<Enhanced ref={myRef} />` silently attaches to the wrong thing (or nothing usable), and there's no error message pointing you at the missing `forwardRef` — you just find out later when `myRef.current` isn't what you expected.

**Mistake 2 — prop name collisions between multiple HOCs.**

```jsx
// ❌ Two HOCs both injecting `data` — one silently overwrites the other
const Enhanced = withUser(withProduct(Component));
// withUser injects props.data = user
// withProduct injects props.data = product
// whichever is applied closer to Component in the spread order wins;
// the other's `data` is gone, with no warning
```

The fix is discipline, not a language feature: namespace injected props distinctively (`userData`, `productData`), or better, migrate to custom hooks where each returned value gets its own explicit variable name at the call site, so there's no merging step where collisions can even occur.

**Mistake 3 — deeply nesting render props into an unreadable pyramid.**

```jsx
// ❌ Three levels deep just to combine three pieces of shared state
<MouseTracker>
  {(mouse) => (
    <WindowSizeProvider>
      {(size) => (
        <NetworkStatusProvider>
          {(isOnline) => <MyComponent mouse={mouse} size={size} isOnline={isOnline} />}
        </NetworkStatusProvider>
      )}
    </WindowSizeProvider>
  )}
</MouseTracker>
```

If you're stuck maintaining code like this, the practical fix (short of a full rewrite) is often a small custom "combiner" component that flattens the nesting by one level, or — the real fix, if you have the ability to touch the underlying implementations — replacing each provider with an equivalent custom hook, and combining them with three flat lines instead of three nested JSX layers.

---

## 10. Interview Answer: Why Did Hooks Replace HOCs and Render Props?

If you're asked to explain this history in an interview, here's a tight, complete answer:

"Before React 16.8, there was no way to extract stateful logic — logic depending on state and lifecycle methods — into a reusable unit other than through component composition, because plain functions couldn't hook into a class's internal state. That constraint produced two patterns: Higher-Order Components, which wrap a component and return a new one with extra props injected, and render props, where a component calls a function prop with its internal data and lets the caller decide what to render. Both worked, but both had real costs. HOCs caused 'wrapper hell' — deeply nested chains of generic wrapper components cluttering the tree and DevTools — plus two sharper problems: prop name collisions, where two independently-written HOCs injecting the same prop name silently overwrite each other with no warning, and broken ref forwarding, since refs don't pass through prop spreading by default and require the HOC author to remember `React.forwardRef` every time. Render props avoided the prop-collision problem, since data arrives as a function argument rather than merged props, but combining more than one of them nests JSX one level deeper per provider, creating a callback-pyramid shape reminiscent of pre-Promise callback hell. Custom hooks fix all of this at once: they're plain function calls, so there's no wrapper component added to the tree, no prop merging so no collision risk, and no ref-forwarding concern since there's no wrapping component intercepting anything. That's why, since Hooks landed, they became the default way to share stateful logic, and HOCs/render props are now considered legacy patterns you maintain in older code rather than reach for in new code."

---

## 11. Hands-On Exercises

**Exercise 1 — Build `withAuth`.**

Write a HOC `withAuth(WrappedComponent)` that checks a (mocked) `isLoggedIn()` function. If the user isn't logged in, render a `<LoginPrompt />` instead of `WrappedComponent`. If they are, render `WrappedComponent` with all props passed through. Wrap a `Dashboard` component with it and show both the logged-in and logged-out render paths.

**Exercise 2 — Fix the missing `forwardRef`.**

Given this broken HOC:

```jsx
function withHighlight(WrappedComponent) {
  return function (props) {
    return <WrappedComponent {...props} highlighted={props.isActive} />;
  };
}
```

A parent does `<HighlightedInput ref={inputRef} />` and expects `inputRef.current.focus()` to work on the underlying `<input>`. Explain, step by step, why it currently doesn't, then rewrite `withHighlight` using `React.forwardRef` to fix it.

**Exercise 3 — Reproduce the prop collision bug.**

Write two small HOCs, `withStatus` and `withVisibility`, that both inject a prop named `active` (with genuinely different meanings — one means "actively fetching," the other means "currently visible on screen"). Compose them as `withStatus(withVisibility(MyComponent))`, log `props.active` inside `MyComponent`, and explain in your own words which HOC's value wins and why, referencing the spread-order mechanism from Section 4.2.

**Exercise 4 — Build `MouseTracker` and a second consumer.**

Using the `MouseTracker` render-props component from Section 5.3, build two different consumers: one that renders the raw `(x, y)` coordinates as text, and one that positions a small `<div>` styled as a dot at the current mouse position. Confirm both work from the same `MouseTracker` with no changes to it.

**Exercise 5 — Flatten a callback pyramid.**

Take the three-level-deep nested render-props example from Section 6 (`MouseTracker` → `WindowSizeProvider` → `NetworkStatusProvider`). Rewrite `MouseTracker` and `WindowSizeProvider` as custom hooks (`useMouseTracker`, `useWindowSize`), assume `NetworkStatusProvider` becomes `useNetworkStatus`, and rewrite the consuming component to call all three hooks flatly, with no nesting. Compare the line count and readability to the original.

**Exercise 6 — Three-way rebuild.**

Pick a small stateful behavior of your choice (e.g., "track whether the user has scrolled past 200px," or "track online/offline status"). Implement it three times: as a HOC, as a render-props component, and as a custom hook, following the pattern from Section 7. Write one sentence for each explaining its specific tradeoff versus the custom hook version.

---

## 12. Interview Q&A

**Q1: What is a Higher-Order Component?**

A: A function that takes a component as an argument and returns a new component, typically injecting extra props or behavior (like `withAuth(Component)` or `withLoading(Component)`). The original component is never modified — the HOC hands back a different, wrapping component that renders the original one inside itself.

---

**Q2: What is the render props pattern?**

A: A component accepts a function as a prop — often literally named `render`, or passed via `children` — and calls that function during its own render, passing along internal state or data. The caller's function decides what to actually render with that data, so the component providing the data never dictates the UI.

---

**Q3: What problem did HOCs and render props both exist to solve, before Hooks?**

A: Reusing stateful logic (state plus lifecycle-driven behavior) across multiple components. Before React 16.8, there was no way to extract logic that depends on component state into a plain, callable function — classes couldn't share internal state that way. Both patterns solved this through component composition instead: HOCs by wrapping, render props by handing data through a function argument.

---

**Q4: What is "wrapper hell" and why does it happen?**

A: It's the deeply nested chain of generic wrapper components that builds up when multiple HOCs are composed together, e.g. `withAuth(withTheme(withLoading(Component)))`. Each `with*` call adds one more real component to the render tree, so React DevTools shows a long chain of wrapper names before reaching the actual component you wrote, making the tree harder to navigate and debug.

---

**Q5: Explain the HOC prop name collision problem with a concrete example.**

A: If two independently-written HOCs both inject a prop with the same name — say both call it `data` — composing them means one HOC's `{...props}` spread happens after the other's, so whichever value is spread last silently overwrites the other, with no warning or error. For example, `withUser` injecting `props.data = user` and `withProduct` injecting `props.data = product`, composed together, means the final component only ever sees one of the two, depending purely on the order the HOCs were nested in.

---

**Q6: Why does wrapping a component in a HOC break ref forwarding, and how do you fix it?**

A: `ref` is handled specially by React — it's never part of the `props` object a component receives, so a HOC's `{...props}` spread never includes it. Without extra work, a `ref` attached to the wrapped/enhanced component ends up attached to the HOC's own wrapper function instead of the component you actually wanted a ref to. The fix is `React.forwardRef`, which gives the HOC's function a second `ref` argument that it can explicitly pass down to the wrapped component.

---

**Q7: What problem do render props avoid that HOCs suffer from?**

A: Prop name collisions. Since data is passed as an argument to a function you control (`(data) => <UI data={data} />`), there's no automatic merging of props from multiple sources, so there's nothing for two independent pieces of shared logic to silently collide over.

---

**Q8: What new problem do render props introduce that HOCs don't have in the same way?**

A: A nesting/readability problem sometimes called the "callback pyramid" or compared to callback hell — combining multiple render-prop components (say, mouse position, window size, and network status) requires nesting one function inside another for each one, producing deeply indented JSX that's hard to read and hard to trace back to which value came from where.

---

**Q9: Walk through the same "track window size" logic implemented as a HOC, a render prop, and a custom hook.**

A: As a HOC, `withWindowSize(Component)` returns a wrapper that holds the `useState`/`useEffect` for window size and injects it as a `windowSize` prop, adding a wrapper component and risking prop collisions. As a render prop, a `<WindowSize render={(size) => ...} />` component holds the same state and calls the `render` function with it, avoiding collisions but requiring nested JSX to combine with other render-prop providers. As a custom hook, `useWindowSize()` holds the identical `useState`/`useEffect` logic and is simply called inside any component that needs it — no wrapper, no nesting, no collision risk, because it's just a function call.

---

**Q10: Are HOCs or render props still used in modern React code?**

A: They're considered legacy patterns for new code — custom hooks are the recommended way to share stateful logic today. However, you'll still encounter both in older codebases and in some library internals or APIs that predate widespread hook adoption, so recognizing them and understanding their tradeoffs remains useful, even though you generally wouldn't choose either for new code.

---

**Q11: If a HOC injects a prop, and the wrapped component also receives that same prop name from its actual parent, what happens?**

A: It depends entirely on the order of the JSX prop spread inside the HOC's wrapper function. If the HOC does `<WrappedComponent {...props} injectedProp={value} />`, its injected value wins over whatever was in `props`, because it's spread last. If it instead did `<WrappedComponent injectedProp={value} {...props} />`, the incoming prop would win instead, since `props` is spread after. This ordering is easy to get backwards and easy to overlook during review.

---

**Q12: Why is `displayName` sometimes set explicitly on a HOC's returned component?**

A: Without it, React DevTools shows a HOC-generated wrapper using its plain function name (or `Anonymous`, if it's an inline function expression), which makes wrapper-hell chains in the tree even harder to read. Explicitly setting something like `Wrapper.displayName = \`WithLoading(${WrappedComponent.displayName || WrappedComponent.name})\`` makes each layer in the chain identifiable in DevTools, though it doesn't reduce the actual nesting.

---

**Q13: Can a HOC use hooks internally?**

A: Yes — a HOC is still just a function component under the hood (the wrapper it returns), so it can use `useState`, `useEffect`, `useContext`, and so on inside itself. Using hooks inside a HOC's wrapper doesn't remove the HOC's own downsides (wrapper hell, prop collisions, ref forwarding), since those come from the wrapping structure itself, not from how the wrapper manages its internal state.

---

**Q14: What's the practical difference in how you'd combine three shared pieces of logic using HOCs versus custom hooks?**

A: With HOCs, you compose by nesting function calls around the component: `withA(withB(withC(Component)))`, which creates three wrapper components in the tree and three chances for injected prop names to collide. With custom hooks, you call each hook as a separate, flat statement inside the component's body: `const a = useA(); const b = useB(); const c = useC();` — no wrapping components, no nesting, and each hook's return value gets an explicit name you choose yourself, so there's no possibility of an implicit collision.

---

**Q15: A teammate says "render props are basically the same idea as children as a function." Are they right?**

A: Yes — using `children` as a function (`<Provider>{(data) => <UI data={data} />}</Provider>`) is the exact same render-props pattern, just using the `children` prop instead of a custom-named prop like `render`. The mechanism is identical: the providing component calls whatever function it was handed, passing along its internal data, and the caller decides what to render with it. The only difference is stylistic — which prop slot carries the function.
