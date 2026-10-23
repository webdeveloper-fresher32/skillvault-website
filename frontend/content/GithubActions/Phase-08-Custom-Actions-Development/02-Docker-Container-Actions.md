# Docker Container Actions

A JavaScript action (Lesson 1) starts fast but only ever runs Node.js. Some tools an action needs to wrap are already a compiled binary, a Python script with system-level dependencies, or a shell pipeline calling `dig`/`openssl`/some CLI outside any JavaScript runtime — neither a composite action's `run:` steps nor a JavaScript action's Node.js process can bring along an arbitrary Linux userland. A **Docker container action** packages the action's logic *and* its entire runtime into a container image, described by an `action.yml` with `runs.using: docker`.

## 1. A Docker Action's `action.yml` and `Dockerfile`

`runs.image` is either the literal string `Dockerfile` (build from a `Dockerfile` sitting alongside `action.yml`) or a fully-qualified pre-built image reference (`docker://ghcr.io/some-org/some-action:1.2.3`).

```yaml
name: "Docker Greeting Action"
description: "Greets someone and reports the time, running inside a container"

inputs:
  who-to-greet:
    description: "Who to greet"
    required: true

outputs:
  greeting-time:
    description: "The time the greeting was generated"

runs:
  using: docker
  image: Dockerfile
```

```dockerfile
FROM alpine:3.19

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

If `runs.image: Dockerfile`, the runner builds the image on the runner itself, from scratch, on every single run — there is no built-in cross-run image cache. If `runs.image` is a registry reference instead, the runner just pulls that tag, typically far faster for a stable action whose image rarely changes. The `Dockerfile`'s `ENTRYPOINT` is the entire action's behavior; there's no separate "main" concept the way `runs.main` names one for a JavaScript action.

## 2. Passing Inputs as Env Vars

The runner starts a container from the built or pulled image, mounting the action's working directory and passing declared `inputs` in as environment variables — named `INPUT_<NAME>` with the same uppercase/space-to-underscore transformation from Lesson 1 — *unless* `action.yml` declares an `args:` list under `runs`, in which case those `${{ inputs.name }}`-templated values are passed as command-line arguments to the container's entrypoint instead, in the order listed.

```bash
#!/bin/sh
set -e

WHO_TO_GREET="$(printenv 'INPUT_WHO-TO-GREET' || true)"

if [ -z "$WHO_TO_GREET" ]; then
  echo "::error::Missing required input 'who-to-greet'"
  exit 1
fi

echo "Hello, $WHO_TO_GREET!"

echo "greeting-time=$(date -u +%T)" >> "$GITHUB_OUTPUT"
```

Building and running this inside an actual container is out of this course's scope, but the shell logic itself was re-run for this rewrite, directly, against the same `INPUT_WHO-TO-GREET`/`GITHUB_OUTPUT` contract a container would receive:

```bash
env "INPUT_WHO-TO-GREET=Mona the Octocat" GITHUB_OUTPUT="$PWD/gh_output.txt" sh ./entrypoint.sh
```

Actual stdout:

```
Hello, Mona the Octocat!
```

Actual exit code: `0`. Actual contents of the `GITHUB_OUTPUT` file afterward:

```
greeting-time=06:28:01
```

Note the plain `name=value` line here, unlike Lesson 1's delimiter-wrapped `@actions/core` output — both are valid formats the runner's `$GITHUB_OUTPUT` parser accepts, but a hand-written shell script has no equivalent of `@actions/core`'s automatic delimiter generation, so the plain form is only safe when the value is guaranteed single-line (a timestamp qualifies; arbitrary multi-line text would not).

Re-running the same script with the input missing confirms the failure path, also for real:

```bash
GITHUB_OUTPUT="$PWD/gh_output.txt" sh ./entrypoint.sh
```

Actual stderr: `::error::Missing required input 'who-to-greet'`. Actual exit code: `1` — which, inside a real container, is exactly the non-zero exit that fails the step.

## 3. The Hyphenated-Variable-Name Shell Gotcha

A POSIX shell cannot reference a variable named with a literal hyphen as `$INPUT_WHO-TO-GREET` — that syntax parses as `$INPUT_WHO` (a different, unset variable) followed by the literal text `-TO-GREET`, silently producing garbage instead of an error. Re-running this exact broken form confirms it:

```bash
env "INPUT_WHO-TO-GREET=Mona the Octocat" sh -c 'echo "broken: [$INPUT_WHO-TO-GREET]"'
```

Actual output: `broken: [-TO-GREET]` — `$INPUT_WHO` resolved to empty (it was never set; only the hyphenated name was), and the literal `-TO-GREET` text was appended as-is. `printenv 'INPUT_WHO-TO-GREET'` (or `env`/`eval` in a loop) is how a shell script gets at an environment variable whose name isn't a valid shell identifier — this bites Docker action authors specifically because the runner names input env vars after `action.yml`'s input names verbatim, and plenty of real-world input names use hyphens.

## 4. Docker Actions Are Linux-Only

The container's exit code becomes the step's outcome — exit `0` succeeds, non-zero fails, exactly like any other step; there's no `core.setFailed`-equivalent call needed. The runner tears the container down after it exits; only what was written to `$GITHUB_OUTPUT`, plus files the container wrote into the mounted workspace, survives.

```
ubuntu-latest   → Docker container runtime present → Docker actions run
windows-latest  → no Linux container runtime        → step fails outright
macos-latest    → no Linux container runtime        → step fails outright
```

## Comparison

| | JavaScript action | Docker container action |
|---|---|---|
| Startup cost | Fast — just launches a Node.js process on files already checked out | Slow — full image build (`Dockerfile`) or at minimum a pull (registry reference) before the container even starts |
| Runner OS support | Linux, Windows, macOS (any hosted runner with Node.js) | Linux only (`ubuntu-*`) — Windows/macOS jobs fail outright |
| Runtime flexibility | Node.js and the npm ecosystem only | Any language, any system package, any binary |
| Input delivery | Always env vars (`INPUT_<NAME>`) | Env vars (`INPUT_<NAME>`), or positional args if `runs.args` is set |
| Output mechanism | `core.setOutput` (delimiter-wrapped) | Manual `echo "name=value" >> $GITHUB_OUTPUT` |

| | `runs.image: Dockerfile` | Pre-built registry image reference |
|---|---|---|
| Guarantees | Image always reflects what's currently in the repo | Image is whatever was published, whenever it was published |
| Cost | Rebuilds — potentially from scratch — on every single run | Pull only, normally much faster |
| Typical use | Actively-developed action | Stable, versioned action ready to publish ahead of time |

## Common Mistakes

- **Leaving `runs.image: Dockerfile` in place for an action whose image rarely changes, instead of publishing a pre-built, versioned image.** Every consumer's run pays the full build cost from scratch (no cross-run cache by default), when a `docker://ghcr.io/org/action:1.2.3`-style reference would let them just pull an already-built image — usually far faster.
- **Using a Docker container action in a job whose `runs-on` isn't a Linux runner.** `windows-latest` and `macos-latest` jobs cannot run Docker container actions at all — an easy mistake in a matrix build (Phase 6) that fans a job out across multiple OSes without realizing one step is Docker-only.
- **Referencing a hyphenated input's environment variable directly as `$INPUT_SOME-NAME` inside a shell entrypoint.** POSIX shell can't parse a hyphen as part of a variable reference; it silently evaluates to `$INPUT_SOME` (empty) concatenated with the literal text `-NAME`, not an error — `printenv 'INPUT_SOME-NAME'` is the fix.
- **Forgetting `RUN chmod +x` on the entrypoint script before `COPY`-ing it in and setting it as `ENTRYPOINT`.** A non-executable entrypoint fails the container immediately with a permissions error, distinct from any logic bug in the script itself.
- **Assuming `args:` and environment-variable-based inputs are interchangeable without checking which one `action.yml` actually declares.** Whether an input arrives as `$INPUT_NAME` or as a positional argument depends entirely on whether `runs.args` is present — an entrypoint written assuming one delivery mechanism silently reads nothing (or the wrong thing) if `runs` actually uses the other.

## Hands-On Exercises

1. Create `entrypoint.sh` from Section 2 locally, `chmod +x` it, then run `env "INPUT_WHO-TO-GREET=Mona the Octocat" GITHUB_OUTPUT="$PWD/gh_output.txt" sh ./entrypoint.sh` and confirm the stdout and `GITHUB_OUTPUT` contents match Section 2 exactly.
2. Re-run the same script with `INPUT_WHO-TO-GREET` unset and confirm you get the `::error::Missing required input 'who-to-greet'` stderr line and exit code `1`.
3. Run `env "INPUT_WHO-TO-GREET=Mona the Octocat" sh -c 'echo "broken: [$INPUT_WHO-TO-GREET]"'` and confirm it prints `broken: [-TO-GREET]`, not the greeting — direct proof of the Section 3 shell gotcha.
4. (Prerequisite: Docker installed locally) Build the `Dockerfile`/`entrypoint.sh` pair from Section 1 with `docker build -t hello-action .`, then run `docker run --rm -e "INPUT_WHO-TO-GREET=Mona" -e GITHUB_OUTPUT=/tmp/out -v /tmp:/tmp hello-action` and confirm the container prints the same greeting.
5. Validate `action.yml` from Section 1 is well-formed YAML: `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < action.yml`.

## Interview Q&A

**Q: Why would you choose a Docker container action over a JavaScript action, given it's slower to start?**
A: Language- and system-dependency-agnosticism — a Docker action can wrap any binary, any Python/Go/Rust tool, any Linux package, none of which a JavaScript action's Node.js-only runtime can touch. The extra build/pull latency is worth it when the tool being wrapped genuinely isn't JavaScript-shaped.

**Q: What happens if a matrix build (Phase 6) tries to run a Docker container action on `windows-latest`?**
A: The step fails outright — Docker container actions require a Linux container runtime that Windows and macOS hosted runners don't provide. This is a real, easy-to-hit failure mode when a Docker-based step is added without checking every OS in the matrix can actually run it.

**Q: An entrypoint script does `echo "$INPUT_WHO-TO-GREET"` and gets garbage instead of the expected value. Why?**
A: POSIX shell parses `$INPUT_WHO-TO-GREET` as `$INPUT_WHO` (unset, empty) followed by the literal text `-TO-GREET` — a hyphen can't be part of a shell variable reference. `printenv 'INPUT_WHO-TO-GREET'` reads the actual variable correctly.

**Q: Does `runs.image: Dockerfile` rebuild the image on every workflow run, or is it cached?**
A: It rebuilds from scratch on every run by default — there is no built-in cross-run Docker layer cache the runner applies automatically. A pre-built, versioned registry image (`docker://ghcr.io/org/action:1.2.3`) avoids that cost by pulling instead.
