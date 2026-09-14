# 03 — Installation & Setup

> "The best build tool is the one you stop noticing. Your job is to write components — not to hand-wire a bundler at 11pm."

---

## Table of Contents

1. [The Problem: Why Setup Used to Hurt](#1-the-problem-why-setup-used-to-hurt)
2. [Prerequisites — Node.js and npm](#2-prerequisites--nodejs-and-npm)
3. [Scaffolding a Project with Vite](#3-scaffolding-a-project-with-vite)
4. [Anatomy of a Freshly Scaffolded Project](#4-anatomy-of-a-freshly-scaffolded-project)
5. [Dev Server vs. Production Build — What Actually Happens](#5-dev-server-vs-production-build--what-actually-happens)
6. [Create React App — Where It Fits Historically](#6-create-react-app--where-it-fits-historically)
7. [Comparing Your Starting Options](#7-comparing-your-starting-options)
8. [React DevTools](#8-react-devtools)
9. [ESLint and Prettier Basics](#9-eslint-and-prettier-basics)
10. [Common Setup Mistakes](#10-common-setup-mistakes)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. The Problem: Why Setup Used to Hurt

Let's start with a scenario.

It's 2016. You want to try React. You open the docs, and here's roughly what "getting started" looked like:

```
Install webpack
Configure webpack.config.js (entry, output, loaders...)
Install Babel
Configure .babelrc (presets for JSX, ES6...)
Wire Babel into webpack as a loader
Install babel-preset-react, babel-preset-env
Set up a dev server (webpack-dev-server)
Configure hot reloading
Set up source maps
...and only THEN write your first <App />
```

None of that is React. It's plumbing *around* React. And if you got even one config option wrong — a missing loader, a mismatched preset version — you'd spend your evening reading webpack error stacks instead of learning components.

This was such a common pain point that the React team eventually said: enough. Nobody should have to hand-assemble a build pipeline just to render `<h1>Hello</h1>` on a screen.

**The fix:** build tools and starter kits that hide all of that config behind a single command. You run one line in your terminal, and a working project — bundler, dev server, hot reload, production build script, all pre-wired — lands in a folder.

That's what this lesson is about: how to go from "empty folder" to "React app running in the browser" in under two minutes, using the tool the ecosystem has now converged on: **Vite**.

---

## 2. Prerequisites — Node.js and npm

**The problem this solves:** React tooling (Vite, the bundler, the dev server) is itself a JavaScript program. It needs a JavaScript *runtime* to execute — your browser can't run it, because none of this exists in the browser yet. That runtime is **Node.js**.

**Analogy:** think of Node.js as the engine, and **npm** (Node Package Manager, installed alongside Node) as the parts warehouse. The engine runs your build scripts; the warehouse fetches and stores every library your project depends on (React itself, Vite, ESLint, all of it) inside a `node_modules` folder.

**Checking what you have:**

```bash
node -v
# v20.11.0

npm -v
# 10.2.4
```

**Why the version actually matters:** modern tooling (Vite, and current React itself) drops support for old Node versions over time, because newer JavaScript engine features get relied upon internally. Running a several-years-old Node version against a fresh Vite scaffold is one of the single most common "it doesn't even start" support questions online. If in doubt, install the current **LTS** (Long-Term Support) release rather than the newest bleeding-edge one — LTS is the stable, recommended-for-most-people track.

> **Memory hook:** "Node is the engine, npm is the parts warehouse — check both before you try to start the car."

---

## 3. Scaffolding a Project with Vite

**What problem does this solve?** You don't want to create `package.json`, `vite.config.js`, an `index.html`, a folder structure, and your first component by hand. You want all of that generated correctly, instantly, from one command.

**The command:**

```bash
npm create vite@latest my-react-app -- --template react
```

Let's actually read that command instead of just pasting it:

```
npm create vite@latest     → run the latest scaffolding tool called "create-vite"
my-react-app               → the folder name for your new project
-- --template react        → tell it: "give me the React template, not Vue/Svelte/etc."
```

Vite supports multiple frameworks from the same scaffolding tool (React, Vue, Svelte, vanilla JS...) — the `--template react` flag is what picks React specifically. There's also a `react-swc` template variant, which swaps in a faster Rust-based compiler for JSX instead of Babel; functionally equivalent for learning purposes, just faster on large codebases.

If you skip the flags entirely and just run `npm create vite@latest`, it drops you into an interactive prompt instead — asking for a project name, then a framework, then a variant, one question at a time. Either route ends at the same place.

**Then, standard next steps:**

```bash
cd my-react-app
npm install
npm run dev
```

After `npm run dev`, your terminal prints a local URL — typically `http://localhost:5173` — and your app is live in the browser, with hot reload already wired up. That's it. No webpack config touched.

---

## 4. Anatomy of a Freshly Scaffolded Project

Open the folder Vite just generated. Here's what's actually sitting inside it, and — more importantly — *why* each piece exists.

```
my-react-app/
├── node_modules/       ← installed dependencies (npm install put these here)
├── public/             ← static assets copied as-is (favicon, robots.txt...)
├── src/
│   ├── App.jsx         ← your root/top-level component
│   ├── App.css         ← styles for App
│   ├── main.jsx        ← the actual entry point — mounts App into the DOM
│   ├── index.css       ← global styles
│   └── assets/         ← images/icons imported by components
├── index.html          ← the ONE real HTML page — a shell, basically
├── vite.config.js      ← Vite's configuration
├── package.json         ← project metadata + dependencies + scripts
└── package-lock.json    ← exact locked dependency versions
```

Let's walk through the four files that actually matter conceptually.

**`index.html`** — this is deliberately close to empty:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Notice `<div id="root"></div>`. That's the *only* thing this page has, content-wise. Everything you'll ever see on screen gets injected into that single div by React. This is the essence of a **single-page application (SPA)**: one real HTML file, and JavaScript takes over from there.

Also notice `<script type="module" src="/src/main.jsx">` — that line hands control straight to your JavaScript entry point.

**`main.jsx`** — the entry point, where React actually attaches itself to that `<div id="root">`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Read this like a sentence: "find the DOM element with id `root`, create a React root there, and render `<App />` inside it." Everything downstream — every component you'll ever write — is a child of `App`, which is a child of that one `root` div.

**`App.jsx`** — your first real component, and the one you'll spend most of your time editing as a beginner:

```jsx
function App() {
  return (
    <>
      <h1>Vite + React</h1>
    </>
  )
}

export default App
```

This is just a JavaScript function that returns JSX (markup that looks like HTML but is actually compiled into JavaScript calls). We'll dig into JSX itself properly in the next lesson — for now, just recognize: this is where "your app" begins.

**`vite.config.js`** — the one config file you actually have, and it's tiny by comparison to old webpack configs:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

That `react()` plugin is what teaches Vite how to handle `.jsx` files and enables the fast-refresh (hot reload) behavior. You'll rarely need to touch this file as a beginner — it's there for when you eventually need custom aliases, proxies, or plugins.

**`package.json`** — the scripts section is the part you'll use daily:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

Each of those is a named shortcut you invoke as `npm run <script-name>` (`dev` and `start` are common exceptions that don't need the word `run`, but with Vite you'll type `npm run dev`).

> **Memory hook:** "One HTML shell, one entry point, one root component — everything else is just components inside components."

---

## 5. Dev Server vs. Production Build — What Actually Happens

This is the part worth understanding properly, because it explains *why* two different commands exist at all.

### `npm run dev`

**The problem it solves:** while you're actively coding, you want to see changes the instant you save a file — no waiting, no manual refresh, and ideally without losing component state (like text you'd typed into a form).

When you run `npm run dev`, Vite starts a local development server. Here's the sequence of what happens:

```text
You save a file (e.g., App.jsx)
        |
        v
Vite's dev server detects the file changed
        |
        v
Vite compiles JUST that file (not the whole app)
        |
        v
The new code is pushed to the browser over
a live connection (no full page reload)
        |
        v
React swaps in the updated component,
preserving as much state as it can
        |
        v
Browser updates in milliseconds
```

The key word is **just that file**. Vite serves your source files individually over native ES modules in development — it doesn't bundle everything into one giant file first. That's *why* it starts up and reacts to changes so fast, even on projects with hundreds of components: there's no big bundling step happening on every keystroke.

### `npm run build`

**The problem it solves:** the thing that makes development fast (serving hundreds of small individual files) is exactly the thing you do NOT want in production. A real user's browser would have to make hundreds of small network requests just to load your app. That's slow.

So for production, Vite switches strategy entirely and does real bundling:

```text
npm run build
        |
        v
Read every file reachable from main.jsx
        |
        v
Bundle them together into a small number
of optimized files (using Rollup under the hood)
        |
        v
Minify the code (strip whitespace, shorten
variable names, remove dead/unused code)
        |
        v
Add a content hash to filenames
(e.g., index-a1b2c3.js) for cache-busting
        |
        v
Write everything into a dist/ folder
        |
        v
dist/ is now ready to be uploaded to any
static file host (Vercel, Netlify, S3, nginx...)
```

Run it:

```bash
npm run build
```

You'll get a `dist/` folder containing a handful of `.js` and `.css` files, plus a rewritten `index.html` that points at them.

Want to actually check what production will look and behave like, locally, before deploying? That's what `preview` is for:

```bash
npm run preview
```

This serves the `dist/` folder exactly as a real static host would — it is **not** a dev server, and it does **not** hot-reload. It's a sanity check, nothing more.

| Command | Purpose | Speed priority | Output |
|---|---|---|---|
| `npm run dev` | Local development | Instant feedback | Nothing written to disk — served in-memory |
| `npm run build` | Production packaging | Small, optimized bundle | `dist/` folder |
| `npm run preview` | Sanity-check the build | N/A | Serves `dist/` as-is |

**Common confusion:** beginners sometimes deploy their project by literally copying the `src/` folder, or by trying to point a web server at `npm run dev`. Neither works for production. Production deployment always means: run `npm run build`, then serve the resulting `dist/` folder.

**Interview answer:** "The dev server and the production build solve two different problems. In development, Vite serves source files individually as native ES modules and recompiles only the changed file, which makes hot reload near-instant. For production, it switches to a bundler (Rollup) that combines everything into a minimal set of minified, cache-busted files in a `dist/` folder — because shipping hundreds of small unbundled files to a real user's browser would be slow. `npm run dev` is for you; `npm run build` output is for your users."

> **Memory hook:** "Dev mode serves you a thousand small snacks fast — build mode packs one efficient lunchbox for the user."

---

## 6. Create React App — Where It Fits Historically

Before Vite, the standard answer to "how do I start a React project" was **Create React App (CRA)**:

```bash
npx create-react-app my-app
```

For years, this was *the* recommended path — it did the exact same job Vite does now (hide webpack/Babel config behind one command), just using webpack under the hood instead of Vite's native-ES-modules approach.

Here's the factual, current status: CRA is no longer actively maintained the way it once was, and it is **no longer the recommended way to start a new React project** — the official React documentation itself now points people toward Vite (or a framework like Next.js) instead. If you inherit an older codebase, don't be surprised to find it was built with CRA — that's completely normal and it still runs. But for anything new, reach for Vite.

This isn't CRA being "bad" — it did its job well for years and taught a whole generation of developers React. It's simply that the ecosystem moved to faster tooling, and CRA's maintenance slowed down as a result.

---

## 7. Comparing Your Starting Options

You'll typically see three names thrown around when people talk about "starting a React project." Here's how they actually differ:

| Tool | What it is | Best for | Note |
|---|---|---|---|
| **Vite** | A fast build tool + dev server, framework-agnostic | Learning React, SPAs, most new projects today | Current standard starting point |
| **Create React App** | The original official scaffolding tool, webpack-based | Legacy projects already built on it | Deprecated / not recommended for new projects |
| **Next.js** | A full React *framework* (routing, server rendering, API routes built in) | Production apps needing SEO, server-side rendering, file-based routing | A bigger commitment than plain Vite — more decisions made for you |

The way to think about the difference between Vite and Next.js: Vite gives you React plus a fast bundler and stops there — you're building a client-rendered SPA and you bring your own routing, data-fetching, etc. Next.js gives you all of that *plus* an opinionated structure for routing and rendering strategy. Neither is "better" in the abstract — it depends on whether you want that structure decided for you yet. For learning core React concepts (this course), Vite is the right amount of tooling: enough to get out of your way, not so much that it hides how React actually works.

---

## 8. React DevTools

**The problem it solves:** your browser's normal DevTools show you the *rendered HTML* — but React apps are built from a tree of components, props, and state, none of which is visible in raw HTML. If a component isn't re-rendering when you expect, or a prop value looks wrong, plain browser DevTools can't tell you why.

**The fix:** install the **React Developer Tools** browser extension (available for Chrome, Firefox, and Edge, published by the React team). Once installed, open your browser's DevTools on any page running React, and you'll see two new panels:

- **Components** — shows the actual component tree (not the raw DOM), lets you click any component and inspect its current props and state live, and even edit them on the fly to see the UI react.
- **Profiler** — records a session of interactions and shows you which components re-rendered and how long each render took, which is invaluable once you start caring about performance.

**How you'll know it's working:** open DevTools on any page built with Vite + React's dev server, and if the extension is installed and active, you'll see "Components" and "Profiler" tabs appear alongside "Elements," "Console," etc. If those tabs don't show up, either the extension isn't installed, or the page genuinely isn't running React.

> **Memory hook:** "Regular DevTools shows you the house; React DevTools shows you the blueprint — props, state, and which rooms just got repainted."

---

## 9. ESLint and Prettier Basics

Two different jobs, often confused:

- **ESLint** catches *problems* in your code — an unused variable, a missing dependency in a hook, a typo that would cause a runtime bug. It's about correctness and best practices.
- **Prettier** enforces *formatting* — spacing, quote style, line length, semicolons. It's about consistency, not correctness. Prettier doesn't care if your code is buggy; it only cares if it's tidy.

A freshly scaffolded Vite React project already includes ESLint, pre-configured with React-aware rules (via `@vitejs/plugin-react` and the React ESLint plugins). You run it with the script already sitting in `package.json`:

```bash
npm run lint
```

Adding Prettier is a common next step, typically installed alongside an ESLint/Prettier compatibility package so the two tools don't fight each other over formatting rules:

```bash
npm install --save-dev prettier
```

Then a small `.prettierrc` file at the project root defines your formatting preferences:

```json
{
  "semi": false,
  "singleQuote": true
}
```

Most editors (VS Code included) can be configured to run Prettier automatically on save, so formatting stops being something you think about at all.

**Common mistake:** treating ESLint warnings as noise to be silenced rather than read. A surprising number of real React bugs — like a `useEffect` missing a dependency — are exactly the kind of thing the React-specific ESLint rules are designed to catch *before* you ship them.

---

## 10. Common Setup Mistakes

A few things that trip up almost everyone at least once:

**1. Wrong / outdated Node version.**
Symptom: `npm install` or `npm run dev` fails with a cryptic engine or syntax error. Fix: run `node -v`, compare against what the tool expects, and update to the current LTS if you're behind.

**2. Port already in use.**
Symptom: `npm run dev` complains that port `5173` (Vite's default) is already taken — usually because another dev server (maybe a previous run you forgot to stop) is still occupying it. Vite will typically auto-increment to the next free port (`5174`, and so on) and tell you in the terminal output — read that line rather than assuming it failed.

**3. Forgetting to import React — a leftover habit from the old JSX transform.**
For years, every file using JSX needed `import React from 'react'` at the top, even if you never explicitly wrote `React.something` in that file. Why? Because JSX like `<h1>Hi</h1>` used to compile down to `React.createElement('h1', null, 'Hi')` — and that `React.createElement` call needed `React` to be in scope, even though your source code never mentioned it.

Modern tooling (Vite included) uses the **automatic JSX runtime**, introduced in React 17, which compiles JSX to calls that import what they need automatically behind the scenes — you no longer need that manual `import React from 'react'` line just to use JSX. You'll still `import { useState } from 'react'` when you actually use a specific hook, of course — that import is for the hook, not for JSX support.

Confusion happens both ways: people copy old tutorial code that still has the now-unnecessary `import React from 'react'` (harmless, just redundant with a fresh Vite setup) — or people coming from an older or differently-configured setup wonder why their JSX breaks without it (which would only happen if that project isn't using the automatic runtime).

**4. Editing the wrong file and wondering why nothing changes.**
Especially confusing the very similar-looking `App.jsx` and `main.jsx`. Remember the division of labor: `main.jsx` mounts the app once and you'll rarely touch it again; `App.jsx` (and everything you build under it) is where your actual UI work happens.

**5. Trying to open `index.html` directly by double-clicking it.**
It'll load, technically, but relative module paths and Vite's dev features won't behave correctly outside of the dev server. Always go through `npm run dev` (or `npm run preview` for the build) rather than opening the HTML file straight from the filesystem.

> **Memory hook:** "Old JSX needed `React` imported to build the house; modern JSX brings its own tools."

---

## 11. Hands-On Exercises

**Exercise 1 — Scaffold and Run**

From scratch, scaffold a new Vite + React project named `practice-app`, install dependencies, and start the dev server. Confirm in your terminal which local URL it's running on, and open it in your browser.

**Exercise 2 — Trace the Mount**

Starting from `index.html`, trace the exact path React takes to get `<h1>Vite + React</h1>` onto the screen — name each file involved, in order, and what each one hands off to the next.

**Exercise 3 — Dev vs. Build, Observed**

Run `npm run build` on your scaffolded project. Open the generated `dist/` folder and note: how many `.js` files are there compared to your `src/` folder? Then run `npm run preview` and compare what you see to `npm run dev`. Write down one concrete difference you notice.

**Exercise 4 — Break It, Then Explain It**

Temporarily rename `src/main.jsx` to something else (don't delete it) and run `npm run dev` again. Read the error Vite gives you. Explain, in your own words, why this specific file's absence breaks everything, referencing what you learned in Section 4.

**Exercise 5 — React DevTools Investigation**

Install the React Developer Tools browser extension. Open your running dev app, switch to the Components panel, click on `App`, and identify where in the panel you'd see its props and state (even if `App` currently has none).

**Exercise 6 — JSX Runtime Check**

Open `App.jsx` in your scaffolded project and confirm whether `import React from 'react'` is present. If it isn't, and the app still runs and renders JSX correctly, explain why — referencing Section 10's coverage of the automatic JSX runtime.

---

## 12. Interview Q&A

**Q1: Why did the React ecosystem move toward tools like Vite instead of manually configuring webpack and Babel?**

A: Manually wiring webpack and Babel required understanding entry points, loaders, presets, and dev-server config before writing a single component — a high barrier with a high chance of misconfiguration. Vite (and earlier, Create React App) collapsed all of that into a single scaffolding command, so developers could focus on components instead of build tooling.

---

**Q2: What is the difference between `npm run dev` and `npm run build` in a Vite React project?**

A: `npm run dev` starts a local development server that serves source files individually as native ES modules and recompiles only changed files for near-instant hot reload — nothing is written to disk. `npm run build` bundles the entire app into a minimal set of minified, cache-busted files using Rollup, writing the result to a `dist/` folder meant to be deployed to a static host.

---

**Q3: What is Create React App's status today, and would you recommend it for a new project?**

A: Create React App was the original official scaffolding tool for React, built on webpack. It is no longer actively maintained the way it once was, and the official React documentation no longer recommends it for new projects — Vite (or a framework like Next.js) is the current recommendation. Existing CRA projects continue to work; it's simply not the right choice to start something new with today.

---

**Q4: What role does `index.html` play in a Vite React project?**

A: It's a minimal HTML shell containing essentially one meaningful element, `<div id="root">`, plus a `<script type="module">` tag pointing at the JavaScript entry point (`main.jsx`). React injects the entire rendered application into that single div — everything visible on screen after the initial load is generated and updated by React, not written as static HTML.

---

**Q5: What does `main.jsx` do, and how is it different from `App.jsx`?**

A: `main.jsx` is the application's entry point — it locates the `root` DOM element and calls `createRoot(...).render(<App />)` to mount the component tree exactly once. `App.jsx` is the actual root *component* of your application and is where ongoing UI development happens; `main.jsx` is rarely touched again after initial setup.

---

**Q6: Why don't you need to write `import React from 'react'` at the top of every JSX file anymore?**

A: Older JSX compiled to `React.createElement(...)` calls, which required `React` to be in scope even if never referenced explicitly, so every file needed the manual import. Since React 17's automatic JSX runtime, the compiler (used by default in Vite's React plugin) generates the necessary imports automatically behind the scenes, making that manual import unnecessary for JSX to work. You still import specific hooks like `useState` directly when you use them.

---

**Q7: What is the purpose of `npm run preview` if `npm run dev` already lets you see your app?**

A: `npm run dev` runs an unbundled development server with hot reload — it does not represent what a real user will receive. `npm run preview` serves the actual production `dist/` output (created by `npm run build`) as a static host would, letting you sanity-check the real bundled, minified build before deploying it.

---

**Q8: A teammate's `npm run dev` fails immediately after cloning the repo. What are the first two things you'd check?**

A: First, their Node.js version (`node -v`) against what the project expects — an outdated Node is one of the most common causes of install/start failures. Second, whether `npm install` was actually run after cloning, since `node_modules` isn't committed to the repository and must be installed locally.

---

**Q9: What's the practical difference between ESLint and Prettier in a React project?**

A: ESLint analyzes code for actual problems — bugs, anti-patterns, React-specific mistakes like a missing hook dependency — it's about correctness. Prettier only reformats code style — spacing, quotes, line breaks — it's about consistency, not correctness. They're commonly used together, with a compatibility package ensuring they don't conflict over formatting rules.

---

**Q10: Why does Vite's development server stay fast even as a project grows to hundreds of components?**

A: Because in development, Vite serves source files individually over native ES modules and only recompiles the file that actually changed, rather than re-bundling the entire application on every save. The expensive full-bundle step is deferred to `npm run build`, which only needs to run once for production, not on every keystroke during development.

---

**Q11: What would you tell a beginner who tried to deploy their app by uploading their `src/` folder to a web host?**

A: That won't work as intended — `src/` contains unbundled, unoptimized source files (including JSX, which browsers can't run natively) meant for the dev server, not end users. They need to run `npm run build` first, which produces a `dist/` folder containing the actual bundled, minified, browser-ready files, and deploy that folder instead.

---

**Q12: What is React DevTools, and what can you see in it that regular browser DevTools can't show you?**

A: React DevTools is a browser extension that adds "Components" and "Profiler" panels to your browser's developer tools. The Components panel shows the actual React component tree along with each component's live props and state — information that doesn't exist in the rendered HTML at all. The Profiler panel records renders over time, showing which components re-rendered and how long each took, which regular DevTools has no concept of.

---

**Q13: How does Vite differ from Next.js as a starting point for a new project?**

A: Vite is a fast, framework-agnostic build tool and dev server — it gives you React plus tooling and stops there, leaving routing, data fetching, and rendering strategy up to you. Next.js is a full React framework built on top of these ideas, providing built-in routing, server-side rendering, and API routes. Vite is a lighter starting point suited to learning and client-rendered SPAs; Next.js is a bigger, more opinionated commitment suited to production apps needing SEO or server rendering out of the box.

---

**Q14: Why might a fresh `npm run dev` start on port 5174 instead of the expected 5173?**

A: Vite's default dev server port is 5173. If that port is already occupied — commonly by a previous dev server instance you forgot to stop — Vite automatically falls back to the next available port and prints the actual port it bound to in the terminal output, rather than failing outright.

---

**Q15: What is `vite.config.js` for, and why is it much smaller than a typical old webpack config?**

A: It's Vite's project-level configuration file, and in a freshly scaffolded React project it mainly just registers the `@vitejs/plugin-react` plugin, which teaches Vite how to handle `.jsx` files and enables fast refresh. It's small because Vite makes sensible decisions by default for common cases; you only add configuration (aliases, proxies, extra plugins) once your project's needs go beyond the defaults — unlike older webpack setups, which required explicit configuration just to get JSX and a dev server working at all.
