# JavaScript Actions

Phase 7's composite actions bundle existing `run:`/`uses:` steps into one reusable unit, but every one of those steps is still limited to whatever a shell command or another action can already do — real JSON parsing, HTTP calls with retries, non-trivial string/date logic all run out of road fast. A **JavaScript action** is backed by a real language runtime instead: an `action.yml` with `runs.using: node20` and `runs.main` pointing at an entry-point `.js` file, executed directly by Node.js on the runner, with no container and no image pull.

## 1. A JavaScript Action's `action.yml`

`runs.using` names a supported Node.js version (`node16`, `node20`, or `node24` as of this course — GitHub deprecates older versions over time, so `node20` is the safe modern default) and `runs.main` names the entry-point file the runner executes directly.

```yaml
name: "Hello Greeting"
description: "Greets someone and reports the time"

inputs:
  who-to-greet:
    description: "Who to greet"
    required: true

outputs:
  greeting-time:
    description: "The time the greeting was generated"

runs:
  using: node20
  main: index.js
```

The runner checks out the action's repository at the pinned ref (e.g. `@v1`) into a temporary location — there is no build step and no install step, just files present on disk that Node.js then executes directly.

## 2. Reading Inputs with `@actions/core`

Inside the entry-point file, `core.getInput(name)` reads the caller's `with:` values back out. `core.getInput('who-to-greet')` reads `process.env['INPUT_WHO-TO-GREET']` — the toolkit performs the same env-var name transformation internally, so calling code always uses the original `action.yml`-style name and never computes the env var name by hand.

```javascript
const core = require('@actions/core');

try {
  const nameToGreet = core.getInput('who-to-greet');
  console.log(`Hello, ${nameToGreet}!`);
  const time = new Date().toTimeString();
  core.setOutput('greeting-time', time);
} catch (error) {
  core.setFailed(error.message);
}
```

This was actually re-run for this rewrite: `@actions/core@1.10.1` installed with a real `npm install`, then executed directly with Node, passing the exact environment variables the Actions runner would set:

```bash
touch /tmp/gh_output_test.txt
env "INPUT_WHO-TO-GREET=Mona the Octocat" GITHUB_OUTPUT=/tmp/gh_output_test.txt node index.js
```

Actual stdout:

```
Hello, Mona the Octocat!
```

Actual exit code: `0`. Note that `@actions/core`'s file-command writer requires `GITHUB_OUTPUT` to already point at an existing file — a workflow run always has this pre-created; a local repro needs a `touch` first or the run fails with `Missing file at path`.

## 3. Setting Outputs and Failing

`core.setOutput(name, value)` writes the output to the file path in `GITHUB_OUTPUT` (a file the runner creates and points at for every step) rather than printing anything the runner parses from stdout. Actual contents written to that file by the run above:

```
greeting-time<<ghadelimiter_348156da-a430-4c2b-a873-fe6dcf1bff22
00:27:26 GMT+0530 (India Standard Time)
ghadelimiter_348156da-a430-4c2b-a873-fe6dcf1bff22
```

That delimiter-wrapped block, not a plain `greeting-time=<value>` line, is what a real, current `@actions/core.setOutput` actually writes — it generates a random `ghadelimiter_<uuid>` per call and wraps the value between two lines carrying that delimiter, specifically so a value containing its own newlines can't be mistaken for the start of the next output. (The `GITHUB_OUTPUT` file format also accepts the simpler `name=value` line for values guaranteed single-line and delimiter-free — the form a hand-written shell script typically uses, seen in Lesson 2 — but `@actions/core` itself always uses the safer delimiter form.) The runner parses either form identically into `steps.<id>.outputs.greeting-time`.

If the script throws or explicitly calls `core.setFailed(message)`, the toolkit records an error annotation and sets the process's exit code to `1`. Re-running a script that throws before ever calling `setOutput`, caught with `core.setFailed(e.message)`, produces this actual stderr line and exit code:

```
::error::boom: something went wrong
```

Actual exit code: `1`. `::error::...` is a workflow command — GitHub's Actions UI renders any line in this format as a red annotation on the step, which is how a JavaScript action's failure gets surfaced without the runner inspecting the exception object itself. Nothing here differs from a composite action's contract at the calling job's boundary: the caller still writes `uses: some-org/some-action@v1` with a `with:` block and reads `steps.<id>.outputs.<name>` afterward — everything above happens *inside* that one step.

## 4. Bundling `node_modules` (or Using `ncc`)

Unlike a normal Node.js project, an action's repository is *used directly* by `uses: some-org/some-action@v1` — nothing ever runs `npm install` inside it. Whatever `require()`/`import` calls the entry-point file makes have to already be satisfiable the moment the runner checks out the repository, which forces a packaging decision:

| Approach | What ships in the repo | Trade-off |
|---|---|---|
| Commit `node_modules` directly | The entire dependency tree, checked in | Zero build step, but bloats the repository |
| Bundle with `@vercel/ncc` | One compiled file (`ncc build index.js -o dist`, `runs.main: dist/index.js`) | One build step before each release, but only one generated file to commit |

## 5. The `INPUT_<NAME>` Transformation Rule

The runner passes an action's declared `inputs` in as environment variables named `INPUT_<NAME>`, where `<NAME>` is the input's name from `action.yml`, **uppercased, with spaces converted to underscores** — hyphens are *not* converted to underscores, they stay as literal hyphens. An input declared as `who-to-greet` therefore arrives as `INPUT_WHO-TO-GREET`, not `INPUT_WHO_TO_GREET`.

```
action.yml input name        →  env var name (verified)
who-to-greet                 →  INPUT_WHO-TO-GREET   (hyphen preserved)
node-version                 →  INPUT_NODE-VERSION   (hyphen preserved)
max retries                  →  INPUT_MAX_RETRIES    (space → underscore)
```

Confirming what a naive uppercase-everything assumption would wrongly expect — reading `process.env.INPUT_WHO_TO_GREET` (underscore) when only `INPUT_WHO-TO-GREET` (hyphen) was actually set — returns `undefined`, silently:

```bash
node -e "console.log(JSON.stringify(process.env.INPUT_WHO_TO_GREET))"
# undefined
```

## Comparison

| | JavaScript action | Composite action (Phase 7, Lesson 2) |
|---|---|---|
| Runtime | Real Node.js process, full npm ecosystem (modulo bundling) | Only sequences existing `run:`/`uses:` steps |
| Real branching/JSON/API logic | Native | Has to shell out to whatever the runner's shell provides |
| Dependency delivery | Must be pre-bundled (`node_modules` or `ncc` output) — no `npm install` at consume-time | N/A — no dependencies of its own |
| Output mechanism | `core.setOutput` → delimiter-wrapped `GITHUB_OUTPUT` line | Whatever its steps individually write |

| | Current `GITHUB_OUTPUT` file mechanism | Deprecated `::set-output::` |
|---|---|---|
| How it works | Runner-provided file path; action appends `name=value` or delimiter-wrapped lines | Action printed `::set-output name=x::value` to stdout; runner parsed the log |
| Risk | None specific to log-parsing | A value resembling a workflow command could corrupt log parsing |
| Status | Current, supported | Deprecated by GitHub |

## Common Mistakes

- **Committing a JavaScript action that depends on `npm install` running before it works.** It never will — `uses: org/action@v1` only checks out files, it never runs a package manager. Commit `node_modules` directly, or compile into one bundled file with `@vercel/ncc` and commit only the bundle.
- **Assuming an input's YAML name and its runtime env var name are always identical after uppercasing.** `who-to-greet` becomes `INPUT_WHO-TO-GREET`, keeping the hyphen — reading `process.env.INPUT_WHO_TO_GREET` by hand instead of calling `core.getInput('who-to-greet')` gets `undefined` every time, silently, because the two names don't match.
- **Forgetting that `core.getInput` returns an empty string, not `undefined`, when an optional input isn't set.** Code checking `if (!value)` works; code checking `if (value === undefined)` never fires, because the toolkit always returns a string.
- **Writing to `process.stdout` with a hand-rolled `::set-output::` line instead of calling `core.setOutput`.** That workflow command is deprecated; `@actions/core`'s file-based `setOutput` is both the supported mechanism and the one documented to keep working.
- **Bundling `node_modules` for a large dependency tree while also shipping an unbundled `@vercel/ncc` `dist/` without clarity on which one `runs.main` points at.** Someone edits `index.js`, forgets to re-run `ncc build`, and the shipped `dist/index.js` silently keeps running the old logic.

## Hands-On Exercises

1. Create the `action.yml` and `index.js` from Sections 1-2 in a local directory, `npm install @actions/core@1.10.1`, then run `env "INPUT_WHO-TO-GREET=Mona the Octocat" GITHUB_OUTPUT=/tmp/out.txt node index.js` (touch `/tmp/out.txt` first) and confirm the stdout and `GITHUB_OUTPUT` contents match Section 2-3 exactly.
2. Modify `index.js` to throw an unconditional error before calling `core.setOutput`, re-run it, and confirm you get an `::error::` line on stderr and exit code `1`, matching Section 3's failure path.
3. Run `node -e "console.log(process.env.INPUT_WHO_TO_GREET)"` (underscore, not hyphen) with only `INPUT_WHO-TO-GREET` set in the environment, and confirm it prints `undefined` — direct proof of the Section 5 transformation rule.
4. (Prerequisite: `@vercel/ncc` installed globally or via `npx`) Run `npx @vercel/ncc build index.js -o dist` against the example action and inspect `dist/index.js` — confirm it is a single file with `@actions/core` inlined, requiring no `node_modules` at all.
5. Validate `action.yml` from Section 1 is well-formed YAML: `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < action.yml`.

## Interview Q&A

**Q: An action's `index.js` does `require('some-npm-package')`. Why doesn't a consumer's workflow need to run `npm install` first?**
A: It still needs the dependency present, just not via `npm install` — the action's repository has to already contain it, either as a committed `node_modules` folder or as a single file compiled with a bundler like `@vercel/ncc`, because `uses:` only checks out files and never runs a package manager.

**Q: An input is declared as `who-to-greet`. What environment variable does `core.getInput` actually read?**
A: `INPUT_WHO-TO-GREET` — uppercased, hyphen preserved, no underscore substitution for the hyphen. Assuming every non-alphanumeric character gets normalized to an underscore produces a silent `undefined`-reads-as-empty-string bug.

**Q: What does `core.getInput('optional-thing')` return if that input was never set?**
A: An empty string, never `undefined` or `null` — code that tests for missing input must check for falsiness/emptiness, not `=== undefined`.

**Q: Why does `@actions/core.setOutput` write a delimiter-wrapped block instead of a plain `name=value` line?**
A: So a value containing its own newlines can't be mistaken for the start of the next output line — it generates a random `ghadelimiter_<uuid>` per call and wraps the value between two lines carrying that delimiter. The runner parses both the delimiter form and the plain `name=value` form identically.

**Q: What happens on the runner if `runs.main`'s script throws an uncaught exception without calling `core.setFailed`?**
A: The Node process exits non-zero regardless, which the runner still treats as a failed step — `core.setFailed` is the *recommended* way to fail cleanly with an annotation, not the only way to fail at all.
