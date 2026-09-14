# 03 — Mocking & Integration Tests

> "A test that mocks everything proves nothing except that your mocks agree with each other."

---

## Table of Contents

1. [The Problem: You Can't Test Against the Real Internet](#1-the-problem-you-cant-test-against-the-real-internet)
2. [Unit Tests vs Integration Tests](#2-unit-tests-vs-integration-tests)
3. [Mocking a Module Directly with jest.mock() / vi.mock()](#3-mocking-a-module-directly-with-jestmock--vimock)
4. [Mock Service Worker (MSW): Mocking at the Network Level](#4-mock-service-worker-msw-mocking-at-the-network-level)
5. [Testing Loading, Success, and Error States](#5-testing-loading-success-and-error-states)
6. [Comparing Approaches](#6-comparing-approaches)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: You Can't Test Against the Real Internet

Let's say you've built a `UserProfile` component. It mounts, calls `fetch("/api/users/1")`, and renders the user's name once the response comes back. Simple enough. Now — how do you write a test for it?

Your first instinct might be: just... let it call the real API. Run the test, see what happens.

Here's why that instinct gets you fired from CI within a week:

```
Problem 1 — The network might be down.
            Your CI runner has no idea your API even exists.

Problem 2 — The API might return different data tomorrow.
            Yesterday user 1 was "Alice". Today someone renamed
            them to "Alicia". Your test's assertion just broke —
            and you changed nothing.

Problem 3 — Real network calls are SLOW.
            A unit test should run in milliseconds. A real HTTP
            round trip is 100-500ms. Multiply that by 2,000 tests
            and your CI pipeline takes an hour instead of 90 seconds.

Problem 4 — You can't test the bad paths.
            How do you make the real API return a 500 error on
            command, just for this one test? You can't — not
            without asking someone to break production for you.
```

So real network calls are out. But you still need to test that your component:

- shows a loading spinner while the request is in flight
- renders the user's name once data arrives
- shows an error message if the request fails

That's the core tension this entire lesson is about: **you want to test real component behavior, without depending on a real, unpredictable, slow network.**

The answer is to fake the network — but *where* you fake it matters a lot more than you'd expect. That's what the rest of this file is about.

---

## 2. Unit Tests vs Integration Tests

Before we touch a single mocking API, we need to get one distinction straight, because it decides *how much* you mock, and that decision is honestly the most important judgment call in this entire topic.

### The core idea

```
UNIT TEST
  Isolate ONE thing. Fake everything it talks to.

INTEGRATION TEST
  Let several REAL things work together. Fake only the
  stuff that's genuinely outside your control (the network,
  the clock, a third-party payment SDK).
```

Say you have a login form built from three pieces:

```
LoginForm component
   |
   uses -> validateEmail() function
   |
   uses -> apiClient.login() function
```

**A unit test** for `validateEmail()` looks at that function alone:

```js
test('rejects an email with no @ symbol', () => {
  expect(validateEmail('not-an-email')).toBe(false);
});
```

No component, no API, no rendering. Just a function and its output. Fast, precise, tells you exactly what broke if it fails.

**A unit test** for `LoginForm` in isolation would mock *both* `validateEmail` and `apiClient.login`, so you're purely testing "does the component call the right functions with the right arguments when I click submit?"

**An integration test** for the same form uses the *real* `validateEmail` function, the *real* form state logic, and only fakes the one thing that's genuinely external — the network call:

```js
test('shows an error and does not call the API when email is invalid', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);

  await user.type(screen.getByLabelText(/email/i), 'not-an-email');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
});
```

Notice what's real here: the actual `<input>`, the actual button click, the actual `validateEmail` logic wired up inside the real form state, the actual conditional rendering of the error message. Only the network is ever going to be faked — and in this particular test, the network never even gets called, because validation should stop it first. That's exactly the kind of bug this test is designed to catch.

### Why this distinction actually matters

Here's the thing a lot of teams get wrong: they write dozens of unit tests where every single collaborator is mocked, and they *feel* well-tested. But bugs don't usually live inside one function. They live at the **seams** — the exact spots where two pieces of code hand off to each other.

```
        Unit tests catch bugs HERE                 Integration tests
        (inside each box)                          also catch bugs HERE
                                                     (at the connections)

   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
   │ validateEmail│───────▶│  LoginForm   │───────▶│ apiClient    │
   │              │        │  component   │        │  .login()    │
   └──────────────┘        └──────────────┘        └──────────────┘
        ▲                        ▲                        ▲
        │                        │                        │
   "does this func          "does the form           "did we call it
   return the right         actually CALL             with the right
   boolean?"                validateEmail              shape of data,
                             at the right              at the right
                             moment, and wire           moment?"
                             its result into
                             the right UI state?"
```

A classic bug that only integration tests catch: `validateEmail` works perfectly on its own (unit test passes), and `LoginForm` calls it correctly in isolation (mocked unit test passes) — but somebody swapped the argument order when wiring them together, so the form actually passes the *password* into `validateEmail` instead of the email. Every unit test is green. The app is broken. Only a test that lets the real pieces talk to each other would ever catch that.

### So which one should you write?

Not "which one is better" — both matter, but in different quantities.

| | Unit tests | Integration tests |
|---|---|---|
| **How many should you have** | Many (they're cheap and fast) | Fewer, but strategically placed |
| **What they're great at** | Pinning down exact logic in isolated functions/components (edge cases, boundary conditions) | Catching bugs where pieces are wired together wrong |
| **What they miss** | Wiring/integration bugs between collaborators | Fine-grained edge cases in every helper function (too slow/noisy to enumerate all of them here) |
| **Speed** | Very fast | Slower, but still fast if the network is mocked (not truly hitting the internet) |

The practical rule of thumb: write unit tests for tricky, pure logic (validation rules, formatting functions, reducers) where you want to enumerate lots of edge cases cheaply. Write integration tests for your key user flows (submit a form, load a page of data, add an item to a cart) where the real value is in proving the pieces cooperate correctly. This lesson focuses on that second category, because that's where mocking the network correctly makes or breaks the test's usefulness.

> **Memory hook:** "Unit tests check each musician can play their instrument. Integration tests check the band can actually play a song together."

---

## 3. Mocking a Module Directly with jest.mock() / vi.mock()

Let's start with the most direct way to fake a dependency: replacing an entire module with a fake version.

### The problem it solves

Say your component imports an API client module:

```js
// api/userClient.js
export async function getUser(id) {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}
```

```jsx
// UserProfile.jsx
import { getUser } from './api/userClient';
import { useEffect, useState } from 'react';

export function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    getUser(userId)
      .then((data) => {
        setUser(data);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [userId]);

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p>Something went wrong.</p>;
  return <h1>{user.name}</h1>;
}
```

You want to test `UserProfile` without ever calling real `fetch`. `jest.mock()` (or `vi.mock()` if you're on Vitest) lets you swap the entire `userClient` module for a fake one, just for this test file.

### How it works

```js
// UserProfile.test.jsx
import { render, screen } from '@testing-library/react';
import { UserProfile } from './UserProfile';
import { getUser } from './api/userClient';

// Replace the whole module with an auto-mocked version.
// Every exported function becomes a jest.fn() that returns undefined
// until you tell it what to do.
jest.mock('./api/userClient');

test('renders the user name once loaded', async () => {
  // Tell the mocked function what to resolve with, for THIS test.
  getUser.mockResolvedValue({ id: 1, name: 'Alice' });

  render(<UserProfile userId={1} />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  const heading = await screen.findByRole('heading', { name: 'Alice' });
  expect(heading).toBeInTheDocument();
});

test('shows an error message when the request fails', async () => {
  getUser.mockRejectedValue(new Error('network down'));

  render(<UserProfile userId={1} />);

  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
});
```

A few things worth spelling out:

- `jest.mock('./api/userClient')` is **hoisted** to the top of the file by Jest automatically — even though you wrote it after the imports, it runs before them. This trips people up constantly, so just remember: mock calls always execute first, no matter where you physically type them in the file.
- `getUser.mockResolvedValue(...)` configures the *already-mocked* function. It's shorthand for `getUser.mockImplementation(() => Promise.resolve(...))`.
- On Vitest, the equivalent is `vi.mock('./api/userClient')` and `vi.mocked(getUser).mockResolvedValue(...)` — same idea, different function names.

### The internal picture

```
Without jest.mock()                    With jest.mock()

UserProfile.jsx                        UserProfile.jsx
     |                                      |
     | imports getUser                      | imports getUser
     v                                      v
api/userClient.js (REAL)               api/userClient.js
     |                                 (Jest swaps this import
     | calls real fetch()               for an auto-generated
     v                                   fake module behind the
  actual network                        scenes — your component
                                         code has NO idDEA this
                                         happened; it just calls
                                         getUser() as usual)
                                              |
                                              v
                                       jest.fn() you configured
                                       with .mockResolvedValue()
```

This works, and it's the right tool for many situations — especially when you're deliberately writing a **unit test** for `UserProfile` and want `userClient` completely out of the picture. But notice the catch: your component's *entire data layer* has been swapped out. You're no longer testing anything about how `getUser` actually talks to `fetch`, how it parses JSON, or how it handles a non-200 response — because `getUser` itself doesn't run at all anymore. That's fine for a pure unit test. It becomes a problem the moment you want an *integration* test that proves your real data-fetching logic works end to end. That's where the next section comes in.

---

## 4. Mock Service Worker (MSW): Mocking at the Network Level

### The problem with mocking the module

Go back to the `jest.mock('./api/userClient')` example. It works, but think about what it actually proved: it proved that `UserProfile` correctly calls `getUser` and correctly reacts to whatever `getUser` returns. It did **not** prove that `getUser` itself correctly builds the URL, correctly checks `res.ok`, or correctly parses the JSON body. If someone introduces a typo in the URL inside `getUser` tomorrow, this test will still pass, because `getUser` never actually ran.

That's the seam integration tests are supposed to cover — and mocking the module papers right over it.

### The analogy: a flight simulator

Think about how airline pilots train. You don't hand a trainee pilot a real Boeing 747 loaded with passengers for their very first flight. But you also don't just have them read a manual. You put them in a **flight simulator**.

Here's the important part: inside that simulator, the pilot genuinely believes they're flying. They pull the real yoke, they read the real instruments, they hear real engine sounds, they react to real turbulence. The pilot's own actions, reflexes, and decision-making are 100% real and unmodified. The only thing that's fake is the world *outside the cockpit window* — there's no real sky, no real airport, no real fuel being burned. The simulation happens at the boundary between the plane and the outside world, not inside the pilot's head.

**Mock Service Worker (MSW) does exactly this for your component's network calls.** Instead of replacing your `getUser` function (the "pilot"), MSW intercepts requests at the actual network layer — the same layer where `fetch` or `axios` would normally reach out to the internet. Your component code, your `getUser` function, your URL-building logic, your JSON parsing, your `res.ok` check — all of it runs completely for real, exactly as it would in production. The only thing that's fake is what sits on the other side of the network boundary: there's no real server, just MSW quietly intercepting the request and handing back a response you defined.

### Why this is considered more robust than mocking fetch/axios directly

If you mock `fetch` itself (`global.fetch = jest.fn()`), you have to manually recreate a fake `Response`-like object, remember to implement `.json()`, `.ok`, `.status`, and keep that fake in sync with how the real Fetch API behaves. Get any of those details slightly wrong, and your test lies to you — it passes even though the real `fetch` in production would behave differently.

MSW sidesteps the entire problem. Because it intercepts at the network level, your component is *not aware it's being tested at all*. It calls real `fetch()`, gets back a real `Response` object with real headers and a real `.json()` method — MSW just controlled what data sat behind that response. There is zero test-specific branching anywhere in your component or API-client code. If it works against MSW, there's a much stronger guarantee it'll work against the real server too, because the only thing that changed is *what's listening on the other end* — not *how your code talks to it*.

### The internal picture, side by side

```
APPROACH A: Mocking the fetch/module call directly
────────────────────────────────────────────────────
  UserProfile.jsx
       |
       | imports getUser
       v
  api/userClient.js  <-- entirely REPLACED by a jest.fn()
       |                  your real fetch-calling code
       X                  never runs
  (real code never
   reached)

  Component must rely on test infrastructure swapping an
  import — the "seam" between getUser and fetch is UNTESTED.


APPROACH B: MSW intercepting at the network layer
────────────────────────────────────────────────────
  UserProfile.jsx
       |
       | imports getUser
       v
  api/userClient.js (REAL — runs exactly as in production)
       |
       | calls real fetch("/api/users/1")
       v
  ┌─────────────────────────────────────────────┐
  │   MSW intercepts the OUTGOING REQUEST here   │
  │   — below fetch, above the actual network    │
  │   — component & getUser have NO IDEA         │
  └─────────────────────────────────────────────┘
       |
       v
  MSW returns a fake Response you configured,
  but it LOOKS and BEHAVES like a real HTTP response
  (status code, headers, real res.json() etc.)
```

Approach B is why MSW is the modern recommended default for testing anything that fetches data: it tests the *real* seam (component → API client → fetch) while only faking the one thing you have no business depending on in a test (the actual remote server).

### Setting it up: request handlers + a server

MSW works in two layers: you define **handlers** (which requests to intercept and what to respond with), and you spin up a **server** (for Node-based tests) that actually does the intercepting.

```js
// mocks/handlers.js
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users/:id', ({ params }) => {
    const { id } = params;

    if (id === '404') {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({ id: Number(id), name: 'Alice' });
  }),
];
```

```js
// mocks/server.js
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

Then wire the server's lifecycle into your test setup file (this is the piece that's easy to get wrong — more on that in Section 7):

```js
// setupTests.js
import { server } from './mocks/server';

// Start intercepting before any test runs.
beforeAll(() => server.listen());

// Reset any per-test handler overrides after EVERY test, so
// one test's custom response can never leak into the next test.
afterEach(() => server.resetHandlers());

// Stop intercepting once the whole suite is done.
afterAll(() => server.close());
```

Now any test in your suite gets realistic network responses for free, with the option to override a specific handler for a specific test (say, to simulate an error):

```js
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

test('shows an error message when the server returns a 500', async () => {
  // Override just for this one test.
  server.use(
    http.get('/api/users/:id', () => {
      return new HttpResponse(null, { status: 500 });
    })
  );

  render(<UserProfile userId={1} />);

  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
});
```

Because `afterEach(() => server.resetHandlers())` runs after this test, the next test goes right back to the default handlers defined in `handlers.js` — it never sees the 500 override.

> **Memory hook:** "Don't hand the pilot a fake yoke — build a fake sky and let them fly the real plane through it."

---

## 5. Testing Loading, Success, and Error States

A data-fetching component almost always has (at minimum) three distinct states. It's tempting to only test the one that's easiest to picture — success — and call it done. Don't. All three deserve explicit coverage, because they're each backed by real branching logic in your component, and each one is a place a bug can hide.

Let's write a complete, three-state test suite for the `UserProfile` component from Section 3, this time backed by MSW instead of `jest.mock()`.

```jsx
// UserProfile.jsx  (same component as before, for reference)
import { getUser } from './api/userClient';
import { useEffect, useState } from 'react';

export function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    setStatus('loading');
    getUser(userId)
      .then((data) => {
        setUser(data);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [userId]);

  if (status === 'loading') return <p role="status">Loading...</p>;
  if (status === 'error') return <p role="alert">Something went wrong.</p>;
  return <h1>{user.name}</h1>;
}
```

```js
// UserProfile.test.jsx
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  test('shows a loading indicator immediately on mount', () => {
    render(<UserProfile userId={1} />);

    // This assertion has to happen SYNCHRONOUSLY, before the mocked
    // network response has a chance to resolve — that's the whole
    // point of testing the loading state.
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  test('renders the user name once the request succeeds', async () => {
    // Default handler (set up in mocks/handlers.js) already returns
    // { id: 1, name: 'Alice' } for /api/users/1 — nothing to override.
    render(<UserProfile userId={1} />);

    // findBy* combines getBy* with waitFor — it retries until the
    // element appears (or times out), which is exactly what you need
    // for anything that shows up after an async state update.
    const heading = await screen.findByRole('heading', { name: 'Alice' });
    expect(heading).toBeInTheDocument();

    // The loading indicator should be gone by now.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('shows an error message when the server responds with an error', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    render(<UserProfile userId={1} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
  });

  test('shows an error message when the network request itself fails', async () => {
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.error(); // simulates a network-level failure
      })
    );

    render(<UserProfile userId={1} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
```

Notice the shape of this suite — it deliberately has one test per state, not one giant test trying to check everything:

```
loading  -> asserted synchronously, right after render, before any
            network response could possibly have arrived yet

success  -> asserted with findBy*, which waits for the async state
            update triggered by the resolved promise

error    -> asserted twice, for two DIFFERENT kinds of failure:
            (a) the server responds, but with a bad status code
            (b) the request never reaches a server at all
```

That last distinction matters more than it looks. A component that only handles "the server said no" (a 404 or 500) can still crash or hang forever if the *network itself* drops the request — those are genuinely different code paths in most fetch wrappers (a rejected `fetch()` promise vs. a resolved promise with `res.ok === false`), and a thorough integration test checks both.

### A note on waitFor

`findByRole(...)` is really `waitFor(() => getByRole(...))` under the hood, and it's usually all you need. Reach for the lower-level `waitFor` directly only when you're waiting on something that *isn't* a DOM query — for example, asserting that a mock function was eventually called a certain number of times:

```js
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(trackAnalytics).toHaveBeenCalledWith('profile_viewed');
});
```

---

## 6. Comparing Approaches

Pulling everything in this file into one table — this is the cheat sheet to glance at when you're deciding what to write next.

| | Unit test (deep mock) | Integration test (MSW) |
|---|---|---|
| **What's real** | Just the one function/component under test | Component + API client + real `fetch` call logic, all wired together |
| **What's mocked/fake** | Every collaborator (API module, child components, etc.) | Only the actual remote server, intercepted at the network layer |
| **Bugs it catches** | Logic errors inside the isolated unit | Wiring bugs at the seams — wrong argument order, wrong URL, mishandled response shape, forgotten error branch |
| **Bugs it misses** | Anything that only shows up when pieces are connected | Fine-grained edge cases better enumerated with many small unit tests |
| **Speed** | Very fast (no async network simulation needed) | Fast, but slightly heavier (promise resolution, MSW interception) — still nowhere near a real network call |
| **Confidence level** | High confidence in the one unit, none about integration | High confidence that the real flow works end to end |
| **Where it breaks down** | Over-used, gives false confidence that "everything is tested" when only pieces are | Impractical to use for every tiny helper function — too heavy for that |

Neither column "wins." A healthy test suite has a lot of the left column (cheap, fast, precise) and a deliberately smaller, well-chosen set from the right column covering your most important user-facing flows.

---

## 7. Common Mistakes

### Mistake 1 — Only testing the happy path

This is, by far, the most common gap. It's easy to write:

```js
test('renders the user profile', async () => {
  render(<UserProfile userId={1} />);
  expect(await screen.findByText('Alice')).toBeInTheDocument();
});
```

...and call the component "tested." But think about what actually ships to production: a loading state your users will see on every single page load, and an error state your users will see the moment your API has a bad day. If neither of those is covered, you've tested the *least* important state and skipped the two states most likely to contain a real bug (a stuck spinner, a blank white screen on error, an uncaught promise rejection). Section 5's three-test pattern — one test per state — is the fix. Make it a habit: whenever you see a `status` or `isLoading`/`isError` flag in a component, that's your signal there are at least three tests to write, not one.

### Mistake 2 — Over-mocking

This is the subtler trap. It happens when you mock so much of the surrounding code that the test barely exercises anything real anymore.

```js
// Over-mocked: everything the component touches is faked.
jest.mock('./api/userClient');
jest.mock('./hooks/useAnalytics');
jest.mock('./components/Avatar');
jest.mock('./utils/formatName');

test('renders profile', () => {
  // At this point... what is this test actually verifying?
  // Almost the entire component tree has been replaced with fakes.
});
```

A test like this can stay green through a real regression, because so little of the actual production code path is still running. This is what "false confidence" means in practice — the test suite is green, the CI badge is green, and the bug ships anyway. The fix isn't "never mock" — it's being deliberate about *which* boundary you're mocking. Mock the one genuinely external thing (the network, a third-party SDK, `Date.now()`), and let everything your own team owns run for real.

### Mistake 3 — Forgetting to reset or restore mocks between tests

This one is nasty because it doesn't fail loudly — it fails *mysteriously*, and usually only when tests run in a particular order.

```js
test('shows Alice for user 1', () => {
  getUser.mockResolvedValue({ id: 1, name: 'Alice' });
  // ...
});

test('shows Bob for user 2', () => {
  // Oops — forgot to set up getUser for THIS test.
  // Because the previous test's mockResolvedValue is still active,
  // this test silently gets "Alice" back instead of failing loudly
  // with an obvious "getUser is not a function" error.
});
```

The mock's configured behavior *bleeds* from one test into the next, because `jest.fn()` mocks don't reset themselves automatically. The fix is to make resetting the default, not something you remember on a case-by-case basis:

```js
// jest.config.js
module.exports = {
  clearMocks: true,   // clears mock.calls and mock.instances before each test
  restoreMocks: true, // restores original (non-mocked) implementation where possible
};
```

Or, if you're not touching global config, do it explicitly in a `beforeEach`:

```js
beforeEach(() => {
  jest.clearAllMocks();
});
```

The same category of bug shows up with MSW if you forget the `afterEach(() => server.resetHandlers())` line from Section 4 — a `server.use(...)` override from one test would otherwise silently apply to every test that runs after it, in file order. Always pair a per-test override with a reset, whether that's a Jest config flag or an MSW lifecycle hook.

---

## 8. Hands-On Exercises

**Exercise 1 — Module mock for a unit test**

Write `api/postClient.js` with a function `getPosts()` that fetches `/api/posts` and returns parsed JSON. Write a `PostList` component that renders a loading message, then a `<ul>` of post titles. Write a unit test using `jest.mock('./api/postClient')` that verifies `PostList` renders three list items when `getPosts` resolves with three posts.

**Exercise 2 — Convert it to an MSW integration test**

Take the same `PostList` component from Exercise 1. This time, do NOT mock `postClient` — instead, set up an MSW handler for `GET /api/posts` that returns a fixed array of posts, and write the test against that. Compare: what does this version prove that the `jest.mock()` version in Exercise 1 didn't?

**Exercise 3 — All three states, one component**

Build a `WeatherWidget` component that fetches `/api/weather?city=London` on mount and shows: a loading message, the temperature on success, or an error message on failure. Write four tests: (a) loading state renders immediately, (b) success state renders the temperature, (c) a 500 response renders the error message, (d) a simulated network failure (`HttpResponse.error()`) also renders the error message.

**Exercise 4 — Find the over-mocking**

Below is a test file. Identify what's being over-mocked, explain what bug this test would fail to catch, and rewrite it so at least the real component logic is exercised:

```js
jest.mock('./CommentForm');
jest.mock('./api/commentClient');
jest.mock('./utils/validateComment');

test('submits a comment', () => {
  render(<CommentSection postId={1} />);
  // asserts a mocked CommentForm called a mocked onSubmit prop
});
```

**Exercise 5 — Fix the mock-bleeding bug**

You're given a test file where test 2 unexpectedly fails only when run after test 1, but passes when run alone. The file uses `jest.mock('./api/userClient')` and configures `getUser.mockResolvedValue(...)` inside test 1, but never resets it. Fix the file two different ways: once using a `beforeEach` with `jest.clearAllMocks()`, and once using the `clearMocks` Jest config option instead.

**Exercise 6 — Unit vs integration judgment call**

For each of the following, decide whether you'd reach for a unit test (deep mock) or an integration test (MSW), and justify it in one sentence: (a) a `formatCurrency(cents)` utility function with 12 edge cases (negative numbers, zero, rounding); (b) a checkout form that validates a promo code locally before calling an API to apply it; (c) a `Tooltip` component that shows/hides on hover with no data fetching at all.

---

## 9. Interview Q&A

**Q1: What's the difference between a unit test and an integration test in a React codebase?**

A: A unit test isolates one function or component and mocks every collaborator it depends on, so a failure points to exactly one place. An integration test lets several real pieces — a component, its internal logic, other functions it calls — work together, mocking only the parts genuinely outside your control, like the network. Integration tests catch bugs at the seams where pieces are wired together incorrectly, which unit tests, by design, cannot see because those collaborators are faked out.

---

**Q2: Why would you choose MSW over directly mocking `fetch` or an API client module?**

A: Mocking a module or `fetch` directly replaces your own code — the component never actually exercises its real data-fetching logic (URL building, response parsing, error-status handling). MSW instead intercepts the request at the network layer, below `fetch`, so all of your real code runs exactly as it would in production; only the remote server is faked. This gives much stronger evidence that the real integration works, since nothing about how your code talks to the network was altered for the test.

---

**Q3: What are the three states you should always test for a data-fetching component, and why is one commonly skipped?**

A: Loading, success, and error. The success state is the one everyone writes a test for because it's the easiest to picture; loading and error are frequently skipped even though they're states real users hit constantly (loading on every page view, error whenever the API has any kind of bad day). Skipping them means the code paths most likely to contain a bug — a stuck spinner, an uncaught rejection, a blank screen on failure — are exactly the ones with zero test coverage.

---

**Q4: What does it mean for `jest.mock()` calls to be "hoisted," and why does it matter?**

A: Jest automatically moves `jest.mock()` calls to the very top of the test file, before any `import` statements are evaluated, regardless of where you physically wrote them in the file. This matters because it guarantees the mock is in place before the module under test ever imports the real dependency — but it also means you can't rely on values defined earlier in the file inside the mock factory unless they're specifically allowed (e.g., variables prefixed with `mock` in some setups), which is a common source of confusing "cannot access before initialization" errors.

---

**Q5: What is "over-mocking," and what's a concrete symptom of it?**

A: Over-mocking is faking so many of a test's dependencies that the test no longer exercises meaningful real code, even though it still passes. A concrete symptom: a real regression ships to production, yet every related test stayed green, because the components or functions involved were all replaced with mocks that don't reflect the actual bug. The fix is to mock only the genuinely external boundary (network, third-party SDK, system clock) and let code your team owns run for real.

---

**Q6: How do you prevent mock state from leaking between tests in Jest?**

A: Configure `clearMocks: true` (and often `restoreMocks: true`) in the Jest config so every mock's recorded calls and configured return values are cleared before each test automatically, or call `jest.clearAllMocks()` inside a `beforeEach` if you're not touching global config. Without this, a `mockResolvedValue` or `mockReturnValue` set up in one test silently persists into the next test that touches the same mock, causing order-dependent, hard-to-debug failures.

---

**Q7: In MSW, what's the purpose of `server.resetHandlers()` inside `afterEach`?**

A: Individual tests can override the default request handlers using `server.use(...)`, for example to simulate a 500 error for one specific test. `afterEach(() => server.resetHandlers())` discards those per-test overrides after each test finishes, restoring the default handler set defined in your shared `handlers.js`. Without it, an override from one test would keep intercepting requests in every subsequent test in the file, because MSW's server persists across tests within a run.

---

**Q8: Why is `findByRole` (or `findByText`) usually preferred over `getByRole` when testing a component that fetches data?**

A: `getByRole` throws immediately if the element isn't in the DOM yet, which fails instantly for anything rendered after an async state update — like data arriving from a mocked network call. `findByRole` is `waitFor` combined with `getByRole`; it polls and retries until the element appears or a timeout is reached, which matches how the UI actually updates: not synchronously, but after a promise resolves and React re-renders.

---

**Q9: Give an example of a bug that a unit test would miss but an integration test would catch.**

A: A `LoginForm` component that calls `validateEmail(email)` internally. If a unit test for `validateEmail` passes, and a separate unit test for `LoginForm` mocks `validateEmail` entirely (just checking it gets called), both tests can be green even if someone accidentally wires the *password* field into `validateEmail` instead of the email field when connecting the two pieces. Only a test that renders the real form and lets the real `validateEmail` function run against real user input — an integration test — would catch that the wrong value is actually being validated.

---

**Q10: What's the "flight simulator" analogy for MSW, and what does it explain?**

A: A trainee pilot in a flight simulator genuinely believes they're flying — their actions, reflexes, and the instruments they read are all real; only the world outside the cockpit window is simulated. MSW works the same way for a component: your component's real code (the API client, the `fetch` call, the response parsing) runs exactly as in production, completely unaware it's in a test. Only what sits beyond the network boundary — an actual remote server — is faked. This explains why MSW-based tests give higher confidence than tests that replace your own code with mocks: the "pilot" (your component) never had to be told it was in a simulator.

---

**Q11: When should you prefer many small unit tests over a single integration test, and vice versa?**

A: Prefer unit tests when you need to cheaply enumerate many edge cases in pure, isolated logic — a validation function, a formatter, a reducer — where mocking collaborators lets you test each boundary condition in a couple of lines. Prefer integration tests for your key user-facing flows — submitting a form, loading a data-backed page — where the real value is proving the pieces work correctly once wired together, not enumerating every internal edge case. Most healthy suites have far more of the former and a smaller, deliberately chosen set of the latter.

---

**Q12: What is the difference between simulating a "500 response" and simulating a "network failure" in MSW, and why test both?**

A: A 500 response means the request actually reached a server and got a response back, just an unsuccessful one — in MSW, `new HttpResponse(null, { status: 500 })`. A network failure means the request never got a response at all — in MSW, `HttpResponse.error()` simulates this. Many fetch wrappers handle these through genuinely different code paths: a resolved promise with `res.ok === false` versus a rejected promise from `fetch()` itself. A component that only handles one of the two can crash or hang on the other, so a thorough integration test checks both.

---

**Q13: Why can testing the loading state require special care with `waitFor`-style queries?**

A: The loading state, by definition, exists only in the brief window before the mocked async response resolves. If you `await` anything before asserting on it — even `findByRole` — you risk the promise already resolving and the component moving past loading before your assertion runs. That's why loading-state assertions are typically written synchronously right after `render()`, using `getByRole`/`getByText`, not `findBy*` — you want to catch the DOM in that instant, not wait for it to settle into a later state.

---

**Q14: What's a practical middle ground when a component depends on both a pure utility function and a network call?**

A: Keep the utility function's unit tests focused purely on it, mocking nothing internal (it has no dependencies to fake). For the component that uses both the utility and the network call, write an integration test that uses the *real* utility function but mocks only the network boundary with MSW. That way the cheap, exhaustive edge-case testing happens at the utility level, and the integration test is reserved for proving the component correctly wires the utility's output into its rendering and correctly handles the network's three states.

---

**Q15: A teammate says "we don't need integration tests, our unit test coverage is at 95%." How would you respond?**

A: High unit test coverage tells you each isolated piece behaves correctly on its own — it says nothing about whether those pieces are correctly connected to each other. Coverage percentage measures lines executed, not seams verified; a wrong argument passed between two fully-covered functions, or a mismatched response shape between an API client and the component consuming it, can hide behind 95% coverage indefinitely. A smaller, well-placed set of integration tests around key user flows catches exactly that class of bug, which coverage numbers structurally cannot reveal.

> **Memory hook:** "Mock the wall between you and the outside world — never mock the room you're standing in."
