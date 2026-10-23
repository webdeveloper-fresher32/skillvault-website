# Custom Docker Action — Published and Consumed

## Problem Statement

Build a small custom Docker container action that lints a commit message against the Conventional Commits format (`type(scope): description`, e.g. `feat(auth): add OAuth login flow`), publish it under a semantic-version tag with a moving major-version tag, and write a separate example workflow that actually consumes it — the way a real team would depend on a published action, not just define one and stop.

Phase 8 built the pieces separately: Lesson 2 built a Docker container action's mechanics (an `action.yml` with `runs.using: docker`, a `Dockerfile`, an `ENTRYPOINT` script) without publishing it anywhere. Lesson 3 built the `v1.0.0` + moving-`v1` tagging convention and the Marketplace-listing metadata, using Lesson 1's JavaScript action as its running example — never Lesson 2's Docker action. This project is the one place those two Phase 8 lessons meet: a Docker container action, actually tagged, actually consumed by a `uses: <owner>/<repo>@v1` reference in a different workflow.

## Approach Discussion

Three things have to come together, and each is doing a job the others can't:

- **The Docker container action itself (Phase 8, Lesson 2).** A "lint a commit message" tool needs to run a shell/`grep`-based pattern match — trivially expressible as a shell script, which is exactly what a Docker container action's `ENTRYPOINT` is built to run, reading its input as an `INPUT_<NAME>` environment variable and writing its result to `$GITHUB_OUTPUT`. A JavaScript action (Phase 8, Lesson 1) could do the same job, but wouldn't demonstrate the Docker-specific mechanics this project is about — and Phase 8, Lesson 2's own hyphenated-input trap (`$INPUT_COMMIT-MESSAGE` parsing as `$INPUT_COMMIT` followed by literal `-MESSAGE`) is exactly the kind of bug this project's entrypoint has to actually avoid, with `printenv` rather than direct variable interpolation.
- **Tagging discipline (Phase 8, Lesson 3).** A consumer needs something stable to pin to. Cutting `v1.0.0` as an immutable release tag and `v1` as a moving tag re-pointed at every new `v1.x.y` release gives consumers of this action the same choice Phase 8, Lesson 3 describes: pin to `v1` for automatic compatible updates, or to `v1.0.0` for a reference that never changes without an explicit workflow edit.
- **A separate consuming workflow.** Phase 8's own lessons never write the "other side" — a workflow in a different file (standing in for a different repository) that actually references the published action via `uses: <owner>/<repo>@v1` and uses its output. Without this half, "published" is just a tag sitting on a repository nobody has proven actually works when referenced the way a real consumer would reference it.

## Solution

`action.yml`:

```yaml
name: "Conventional Commit Linter"
description: "Checks a commit message against the Conventional Commits format"
branding:
  icon: "check-circle"
  color: "blue"

inputs:
  commit-message:
    description: "The commit message to lint"
    required: true

outputs:
  lint-result:
    description: "'pass' if the message follows Conventional Commits, 'fail' otherwise"

runs:
  using: docker
  image: Dockerfile
```

`Dockerfile`:

```dockerfile
FROM alpine:3.19

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

`entrypoint.sh`:

```bash
#!/bin/sh
set -e

COMMIT_MESSAGE="$(printenv 'INPUT_COMMIT-MESSAGE' || true)"

if [ -z "$COMMIT_MESSAGE" ]; then
  echo "::error::Missing required input 'commit-message'"
  exit 1
fi

PATTERN='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9_-]+\))?: .+'

if echo "$COMMIT_MESSAGE" | grep -qE "$PATTERN"; then
  echo "Commit message follows Conventional Commits: $COMMIT_MESSAGE"
  echo "lint-result=pass" >> "$GITHUB_OUTPUT"
else
  echo "::error::Commit message does not follow Conventional Commits format: $COMMIT_MESSAGE"
  echo "lint-result=fail" >> "$GITHUB_OUTPUT"
  exit 1
fi
```

As in Phase 8, Lesson 2, building and running this inside an actual container is out of this course's scope, but the shell logic itself was run for real, directly, against the same `INPUT_COMMIT-MESSAGE`/`GITHUB_OUTPUT` environment-variable contract a container would receive.

A passing, correctly-formatted message:

```bash
env "INPUT_COMMIT-MESSAGE=feat(auth): add OAuth login flow" GITHUB_OUTPUT="$PWD/gh_output.txt" sh ./entrypoint.sh
```

Actual stdout:

```
Commit message follows Conventional Commits: feat(auth): add OAuth login flow
```

Actual exit code: `0`. Actual contents of the `GITHUB_OUTPUT` file afterward:

```
lint-result=pass
```

A failing, non-conforming message:

```bash
env "INPUT_COMMIT-MESSAGE=fixed a bug" GITHUB_OUTPUT="$PWD/gh_output.txt" sh ./entrypoint.sh
```

Actual stderr:

```
::error::Commit message does not follow Conventional Commits format: fixed a bug
```

Actual exit code: `1` — which, inside a real container, is exactly the non-zero exit code that would fail the step. Actual contents of the `GITHUB_OUTPUT` file afterward:

```
lint-result=fail
```

Running with the input omitted entirely confirms the missing-input path, also for real:

```bash
GITHUB_OUTPUT="$PWD/gh_output.txt" sh ./entrypoint.sh
```

Actual stderr: `::error::Missing required input 'commit-message'`. Actual exit code: `1`. All three runs match the entrypoint's three branches exactly, and — per Phase 8, Lesson 2's discipline — `printenv 'INPUT_COMMIT-MESSAGE'` is used rather than `$INPUT_COMMIT-MESSAGE`, because the latter would parse as `$INPUT_COMMIT` (empty) followed by the literal text `-MESSAGE`, silently producing an empty match instead of an error.

Tagging this action for publishing, following Phase 8, Lesson 3's convention exactly:

```bash
# Cut the first full release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Create the moving major-version tag, pointing at the same commit
git tag -a v1 -m "v1"
git push origin v1
```

Consuming workflow, in a separate repository (or a separate workflow file standing in for one), referencing the published action:

```yaml
name: Lint PR Commit Message

on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  lint-commit-message:
    runs-on: ubuntu-latest
    steps:
      - name: Lint commit message
        id: lint
        uses: your-org/commit-lint-action@v1
        with:
          commit-message: ${{ github.event.pull_request.title }}

      - name: Show lint result
        run: |
          echo "Lint result: ${{ steps.lint.outputs.lint-result }}"
```

Both YAML files (`action.yml` and the consuming workflow) were validated with:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < action.yml
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < lint-pr-commit-message.yml
```

and each loads cleanly as a single well-formed document.

Walking through the consuming workflow: `uses: your-org/commit-lint-action@v1` pulls (or, absent a pre-built registry image, builds) the Docker image from whatever commit `v1` currently points to — per Phase 8, Lesson 3's tagging convention, that's the latest `v1.x.y` release the action's maintainer has cut. `with: commit-message: ${{ github.event.pull_request.title }}` supplies the action's one required input; the runner sets that value as the `INPUT_COMMIT-MESSAGE` environment variable inside the container, exactly matching what `entrypoint.sh` reads via `printenv`. `steps.lint.outputs.lint-result` reads the `lint-result` value the entrypoint wrote to `$GITHUB_OUTPUT` — `pass` or `fail` — and if the entrypoint exited non-zero (a non-conforming title), the `lint-commit-message` job itself fails before `Show lint result` even runs, since a Docker action's container exit code becomes the step's own outcome (Phase 8, Lesson 2).

## Trade-offs and Considerations

- **Pinning the consumer's reference to the moving `v1` tag vs. a full commit SHA (Phase 11, Lesson 3) is the central security trade-off here.** `uses: your-org/commit-lint-action@v1` gets automatic patch and minor fixes with zero changes to the consuming workflow file, but it trusts the action's maintainer (and that maintainer's account security) never to force-move `v1` onto something malicious or broken — nothing in Git or GitHub stops that. A security-conscious consumer would instead pin `uses: your-org/commit-lint-action@a1b2c3d... # v1.0.0` — a full 40-character SHA, immutable by Git's own design, with Dependabot (Phase 11, Lesson 3) configured for the `github-actions` ecosystem to propose the bump as a reviewable PR whenever a new release ships. The `v1` version in this project's solution is the convenience choice; a production-grade consumer should weigh it against that SHA-pinned alternative rather than defaulting to it unexamined.
- **A Docker container action's startup cost is a real, ongoing tax this action pays on every single invocation, unlike a JavaScript action.** `runs.image: Dockerfile` (as used here) means the runner builds the image from scratch on every run with no cross-run cache by default (Phase 8, Lesson 2) — for a tool this small, that build cost can dominate the actual linting work, which itself completes in milliseconds. A JavaScript-action rewrite of the identical logic would start as fast as launching a Node.js process, with no image build or pull at all. The Docker approach is justified here mainly as a demonstration of the mechanics Phase 8, Lesson 2 covers; a team optimizing a real, frequently-invoked commit-message linter for speed would have a genuine reason to prefer a JavaScript action instead, reserving Docker actions for tools that actually need a non-Node.js runtime or system dependency.
- **Publishing a pre-built, versioned image (`docker://ghcr.io/your-org/commit-lint-action:1.0.0`) instead of `Dockerfile` would trade a one-time publish step for a faster pull on every consumer's run** — Phase 8, Lesson 2 names this as the standard practice once an action's image is stable enough to build ahead of time, and it would meaningfully reduce this action's per-run cost without changing anything about the entrypoint logic itself.
- **Restricting the linter to the PR title (`github.event.pull_request.title`) rather than every commit message in the PR is a maintainability and scope trade-off, not a limitation of the action.** It keeps the consuming workflow's example simple and keeps the action's own contract to exactly one string input, at the cost of not catching a non-conforming message on an individual commit that gets squash-merged under a conforming PR title — a real adopter would need to decide whether title-only linting is sufficient or whether the workflow should instead iterate over `git log` for the PR's full commit range.
