# Installation and npm Basics — Complete Guide

## Table of Contents
1. [Installing Node.js](#1-installing-nodejs)
2. [node, npm, and npx](#2-node-npm-and-npx)
3. [package.json](#3-packagejson)
4. [npm install and npm Scripts](#4-npm-install-and-npm-scripts)
5. [Semantic Versioning (semver)](#5-semantic-versioning-semver)
6. [Dependencies vs devDependencies](#6-dependencies-vs-devdependencies)
7. [node_modules and package-lock.json](#7-node_modules-and-package-lockjson)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Installing Node.js

Node.js ships as an installable runtime for macOS, Windows, and Linux. There are three common ways to get it:

```
Option 1: Official installer
  Download from nodejs.org → run the installer → get one fixed version.

Option 2: Package manager (OS-level)
  macOS:   brew install node
  Windows: choco install nodejs / winget install OpenJS.NodeJS
  Linux:   apt install nodejs npm  (or use NodeSource repos for newer versions)

Option 3: Version manager (recommended for developers)
  nvm (Node Version Manager) — lets you install and switch between
  multiple Node versions on the same machine, per project.
```

A version manager (like `nvm` on macOS/Linux, or `nvm-windows` on Windows) is the professional default because different projects often require different Node major versions, and OS package managers usually only give you one global version.

```bash
# Example nvm workflow
nvm install 20        # install Node 20.x (the latest 20 release)
nvm install 18         # install Node 18.x as well
nvm use 20             # switch the current shell to Node 20
nvm alias default 20   # make Node 20 the default for new shells
node -v                # confirm: v20.x.x
```

**Node release types you'll see:**

| Term | Meaning |
|---|---|
| **LTS (Long-Term Support)** | Even-numbered major versions (18, 20, 22...). Stable, supported for ~30 months. Use this in production. |
| **Current** | Odd-numbered or newest release, gets new features first, shorter support window. Good for experimenting, riskier for production. |

Verify an installation with:

```bash
node -v      # e.g. v20.11.1  — the Node runtime version
npm -v       # e.g. 10.2.4    — the npm CLI version (ships bundled with Node)
```

---

## 2. node, npm, and npx

These three commands are easy to confuse when you're new — here's exactly what each one is for.

```
┌───────────────────────────────────────────────────────────────┐
│ node   → runs JavaScript files / starts a REPL                │
│          "execute this code"                                  │
│                                                                 │
│ npm    → Node Package Manager                                 │
│          "install/manage packages, run scripts defined in     │
│           package.json"                                       │
│                                                                 │
│ npx    → Node Package eXecute                                 │
│          "run a package's command-line tool without           │
│           permanently installing it globally"                 │
└───────────────────────────────────────────────────────────────┘
```

**`node`** — runs a JS file, or drops you into an interactive REPL:

```bash
node app.js          # runs the file
node                 # starts REPL — type JS and see results immediately
node -e "console.log(1+1)"   # runs an inline one-liner: prints 2
```

**`npm`** — installs packages and runs the scripts defined in `package.json`:

```bash
npm install express        # installs the express package into node_modules
npm install                # installs everything listed in package.json
npm run start               # runs the "start" script from package.json
npm uninstall express       # removes a package
```

**`npx`** — executes a package's binary without a permanent global install. Extremely common for one-off scaffolding tools:

```bash
npx create-react-app my-app     # runs create-react-app once, no global install needed
npx cowsay "hello"               # downloads cowsay temporarily, runs it, done
```

Why `npx` matters: before it existed, using a CLI tool required `npm install -g <tool>` first, which pollutes your global environment and can cause version mismatches between projects. `npx` fetches (or uses a local copy of) the tool just for that one invocation.

---

## 3. package.json

`package.json` is the manifest file at the root of every Node project — it describes the project's name, version, dependencies, and scripts. Think of it as the Node equivalent of Python's `requirements.txt` + `setup.py`/`pyproject.toml` combined.

Create one with:

```bash
npm init          # interactive — asks you questions
npm init -y       # non-interactive — accepts all defaults instantly
```

A typical `package.json`:

```json
{
  "name": "my-backend-app",
  "version": "1.0.0",
  "description": "A REST API built with Express",
  "main": "index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "echo \"no tests yet\" && exit 1"
  },
  "keywords": ["api", "express"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

Field-by-field:

| Field | Purpose |
|---|---|
| `name` | Package/project name (lowercase, hyphen-separated by convention) |
| `version` | Current version of your project, following semver (see Section 5) |
| `main` | Entry point file when your package is `require`d by something else |
| `type` | `"commonjs"` (default) or `"module"` — controls how `.js` files are interpreted (Lesson 3) |
| `scripts` | Named shortcuts you run via `npm run <name>` |
| `dependencies` | Packages needed to *run* the app in production |
| `devDependencies` | Packages needed only during *development* (testing, linting, bundling) |
| `engines` (optional) | Declares which Node versions the project supports, e.g. `{"node": ">=18"}` |

---

## 4. npm install and npm Scripts

### Installing packages

```bash
npm install express              # add express to dependencies, install it
npm install --save-dev jest      # add jest to devDependencies
npm install -D jest              # shorthand for --save-dev
npm install express@4.18.0       # install an exact version
npm install express@latest       # install the latest published version

npm install                      # install everything already listed in package.json
                                  # (this is what you run after `git clone`)

npm uninstall express            # remove a package and its package.json entry

npm list                         # show installed dependency tree
npm outdated                     # show which installed packages have newer versions available
npm update                       # update packages within the ranges allowed in package.json
```

### npm scripts

Scripts are named shell commands stored under `"scripts"` in `package.json`, run with `npm run <script-name>`. Two script names are special and don't need `run`: `start` and `test`.

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "lint": "eslint .",
    "build": "tsc",
    "test": "jest"
  }
}
```

```bash
npm start          # shorthand for `npm run start`
npm test           # shorthand for `npm run test`
npm run dev        # every other script name needs the explicit "run"
npm run lint
```

Scripts can call other scripts and pass arguments after `--`:

```bash
npm run test -- --watch     # passes --watch through to the underlying test command
```

```json
{
  "scripts": {
    "pretest": "echo running before test automatically",
    "test": "jest",
    "posttest": "echo running after test automatically"
  }
}
```

npm automatically runs `pre<script>` and `post<script>` hooks around a script named `<script>` — this is how `pretest`/`posttest` fire without being called explicitly.

---

## 5. Semantic Versioning (semver)

Every published npm package has a version number in the form **MAJOR.MINOR.PATCH**, e.g. `4.19.2`.

```
   4    .   19   .    2
   │        │         │
   │        │         └─ PATCH: bug fixes, no new features, fully backward compatible
   │        └─────────── MINOR: new features added, backward compatible
   └──────────────────── MAJOR: breaking changes — old code may need updates
```

```
Example history of a package:
  1.0.0  → initial stable release
  1.0.1  → bug fix (PATCH bump)
  1.1.0  → new feature added, old code still works (MINOR bump)
  2.0.0  → breaking API change, e.g. renamed a function (MAJOR bump)
```

Rule of thumb for consumers of a package: patch and minor bumps should be safe to accept automatically; major bumps require you to read the changelog before upgrading.

We'll cover the version *range* symbols (`^`, `~`) that go in front of these numbers in Lesson 5, since they're really an npm ecosystem topic — but the numbers themselves (MAJOR.MINOR.PATCH) are the semver specification, which npm builds on top of.

---

## 6. Dependencies vs devDependencies

```
dependencies:
  Packages required for the app to RUN in production.
  Example: express (the app can't handle HTTP requests without it)

devDependencies:
  Packages only needed while DEVELOPING/BUILDING/TESTING.
  Example: nodemon (auto-restarts your server during development —
  production doesn't need this, it just runs `node index.js` once)
```

| | `dependencies` | `devDependencies` |
|---|---|---|
| Installed by `npm install` (no flags) | Yes | Yes |
| Installed by `npm install --production` / `npm ci --omit=dev` | Yes | No |
| Typical contents | express, mongoose, dotenv, cors | jest, nodemon, eslint, typescript |
| Added with | `npm install <pkg>` | `npm install -D <pkg>` |

```bash
npm install express            # → goes into "dependencies"
npm install -D nodemon jest    # → goes into "devDependencies"
```

In production deployments (e.g., a Docker image for your API, covered in the Docker course in this repo), you typically run `npm ci --omit=dev` to skip installing devDependencies entirely, keeping the deployed image smaller and faster to build.

---

## 7. node_modules and package-lock.json

### node_modules

When you run `npm install`, packages are downloaded into a folder called `node_modules` at your project root. This folder:

- Can become very large (thousands of files, since each package can have its own dependencies, nested inside).
- Should **never** be committed to git — it's always listed in `.gitignore` and can be regenerated from `package.json` + `package-lock.json` at any time with `npm install`.
- Is where `require('express')` / `import express from 'express'` actually looks to find the code.

```
your-project/
├── node_modules/         ← installed packages live here (git-ignored)
│   ├── express/
│   ├── mongoose/
│   └── ... (hundreds of nested dependency folders)
├── package.json           ← what you declare you need
├── package-lock.json       ← exact versions actually installed
└── index.js
```

### package-lock.json

`package.json` often specifies version *ranges* (e.g. `^4.19.2`, meaning "4.19.2 or any compatible minor/patch update"). That's ambiguous over time — running `npm install` today vs. six months from now could resolve to different actual versions if new releases came out.

`package-lock.json` solves this by recording the **exact** version of every package (and every nested sub-dependency) that was actually installed, so that anyone else running `npm install` on your project gets byte-for-byte the same dependency tree.

```
package.json:        "express": "^4.19.2"     ← a range, flexible
package-lock.json:   "express": "4.19.2",      ← exact version, locked
                       "resolved": "https://registry.npmjs.org/express/-/express-4.19.2.tgz",
                       "integrity": "sha512-..."   ← checksum verifying the file wasn't tampered with
```

Key rules:
- **Always commit `package-lock.json` to git.** It's what makes builds reproducible across machines, CI, and teammates.
- Use `npm ci` (not `npm install`) in CI/CD pipelines and production builds — `npm ci` installs *exactly* what's in the lockfile and fails fast if `package.json` and `package-lock.json` are out of sync, rather than trying to resolve new versions.

```bash
npm install     # may update package-lock.json if ranges allow newer versions
npm ci           # strict, reproducible install straight from the lockfile — faster, used in CI
```

---

## 8. Hands-On Exercises

**Exercise 1:** Install Node.js using a version manager (`nvm` if on macOS/Linux). Install two versions (e.g., 18 and 20), switch between them with `nvm use`, and confirm `node -v` changes accordingly.

**Exercise 2:** Create a new empty folder, run `npm init -y` inside it, and open the generated `package.json`. Identify each field and, without looking back at this lesson, explain what each one does out loud.

**Exercise 3:** In that same project, run `npm install express` and `npm install -D nodemon`. Open `package.json` afterward and confirm express landed in `dependencies` and nodemon in `devDependencies`. Then open `package-lock.json` and find the exact resolved version of express.

**Exercise 4:** Add two scripts to `package.json`: `"start": "node index.js"` and `"dev": "node --watch index.js"`. Create a minimal `index.js` that logs `"Server running"`. Run both `npm start` and `npm run dev`, and note the difference (`--watch` restarts on file changes).

**Exercise 5:** Delete your `node_modules` folder entirely (`rm -rf node_modules`), then run `npm ci`. Confirm it reinstalls everything exactly as specified in `package-lock.json` and observe that it runs noticeably faster than a full `npm install` would on a fresh lockfile-mismatch scenario.

---

## 9. Interview Q&A

**Q: What is the difference between `node`, `npm`, and `npx`?**
Answer: `node` is the runtime that executes JavaScript files or opens an interactive REPL. `npm` is the package manager bundled with Node — it installs dependencies and runs scripts defined in `package.json`. `npx` executes a package's CLI binary on demand without installing it globally first, which is useful for one-off tools like project scaffolders (`npx create-react-app`).

**Q: What is the difference between `dependencies` and `devDependencies` in package.json?**
Answer: `dependencies` are packages required for the application to run in production, like `express` or a database driver. `devDependencies` are packages only needed during development or build/test, like `nodemon`, `jest`, or `eslint`. Both install with a plain `npm install`, but a production install (`npm ci --omit=dev`) skips `devDependencies` to keep the deployed footprint smaller.

**Q: Why should package-lock.json be committed to version control?**
Answer: `package.json` typically specifies flexible version ranges (like `^4.19.2`), which can resolve to different exact versions over time as new releases are published. `package-lock.json` pins the exact resolved version of every package and sub-dependency at install time, guaranteeing that every machine — developer laptops, CI, production — installs an identical dependency tree. Without committing it, "works on my machine" bugs can creep in from silently mismatched transitive dependency versions.

**Q: What's the difference between `npm install` and `npm ci`?**
Answer: `npm install` reads `package.json`, resolves version ranges (possibly updating `package-lock.json` if newer compatible versions exist), and can add/remove packages. `npm ci` (clean install) is stricter and faster: it installs exactly what's recorded in `package-lock.json`, deletes `node_modules` first, and fails immediately if `package.json` and the lockfile are out of sync. `npm ci` is the recommended command for CI/CD pipelines and production builds because it guarantees reproducibility.

**Q: Why is node_modules never committed to git?**
Answer: `node_modules` can contain thousands of files across nested dependencies and can be gigabytes in size, which would bloat the repository and slow down cloning. It's also entirely derivable — `npm install` (or `npm ci`) regenerates it exactly from `package.json` and `package-lock.json`. Committing generated, reproducible artifacts is generally avoided in version control; only the source of truth (the manifest and lockfile) needs to be tracked.

**Q: What does the "main" field in package.json do, and how does "type" affect a project?**
Answer: `main` specifies the entry-point file that gets loaded when another package or script does `require('your-package')` — it tells Node where the package's public API starts. `type` controls how `.js` files in the project are parsed: `"commonjs"` (the default if omitted) treats `.js` files as CommonJS modules using `require`/`module.exports`; `"module"` treats them as native ES Modules using `import`/`export`. This is covered in depth in Lesson 3.
