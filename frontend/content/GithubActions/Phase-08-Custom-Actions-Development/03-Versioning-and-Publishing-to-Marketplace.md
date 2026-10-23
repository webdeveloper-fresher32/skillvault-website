# Versioning and Publishing to Marketplace

Lessons 1 and 2 built two actions that work, but neither addressed what `uses: some-org/some-action@___` actually pins to, or what happens when the author ships a bug fix. Pinning to a branch (`@main`) silently gets whatever was most recently pushed; pinning to an exact commit SHA never gets anything, including fixes, without manually updating the reference. This lesson covers the tagging convention that gives consumers automatic patch/minor fixes without unreviewed breaking changes, plus the minimal `action.yml` metadata GitHub requires to list an action on the Marketplace.

## 1. Tagging Convention (`v1.0.0` + Moving `v1`)

An action's author cuts a full, immutable release tag for every version shipped — `v1.0.0`, `v1.1.0`, `v1.1.1` — following semantic versioning: patch (third number) for backward-compatible fixes, minor (second number) for backward-compatible new features, major (first number) for anything that could break a consumer. Alongside those, the author also maintains a short **moving tag** per major version — `v1`, `v2` — which does not stay attached to the commit it was first created on; every new `v1.x.y` release force-moves `v1` to point at that release's commit.

```bash
# Cut the first full release, from whatever commit is currently on main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Create the moving major-version tag, pointing at the same commit
git tag -a v1 -m "v1"
git push origin v1
```

Later, after a backward-compatible bug fix lands as a new commit on `main`:

```bash
# Cut the new patch release
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1

# Move the existing v1 tag to point at the new commit instead
git tag -fa v1 -m "v1"
git push origin v1 --force
```

`git tag -fa v1` re-creates the local `v1` tag pointing at the current commit, overwriting wherever it pointed before (`-f` forces the overwrite; without it, Git refuses to recreate an existing tag). `git push origin v1 --force` is required for the second push — a plain `git push origin v1` fails, because the remote already has a `v1` tag pointing somewhere else, and Git treats moving an existing tag as a non-fast-forward change by default, the same protection that guards a branch from being silently rewound.

## 2. What a Consumer's Pin Resolves To

A consumer's workflow references the action via one of these tags:

| Reference | Resolves to | Update behavior |
|---|---|---|
| `@v1` | Whatever commit the `v1` tag currently points to | Gets new `v1.x.y` releases automatically, no workflow change |
| `@v1.2.3` | Exactly that release's commit, forever | Never changes without a manual workflow edit |
| `@a1b2c3d...` (full 40-char SHA) | That exact commit, immutably (Git cannot force a SHA to mean something else) | Never changes — maximum reproducibility, previewed here and covered in Phase 11 |

Consumers who pin to `v1` get new patch and minor releases automatically, with no change to their own workflow file — that's the entire point of the moving tag's convenience. Consumers who pin to `v1.2.3` never get anything new without manually editing their workflow to bump the version.

## 3. Marketplace Metadata

For an action to be listed on GitHub Marketplace at all, its `action.yml` needs a `name`, a `description`, and a `branding` block (an `icon` from the Feather icon set and a `color`) — Marketplace uses `branding` to render the action's badge/icon in listings and search results. An `action.yml` missing `branding` can still be used directly via `uses:`; it just can't be published to the Marketplace.

```yaml
name: "Hello Greeting"
description: "Greets someone and reports the time"
branding:
  icon: "smile"
  color: "green"

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

Validating this parses as well-formed YAML:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < action.yml
```

The only addition versus Lesson 1's `action.yml` is `branding` — `name` and `description` were already required for `action.yml` to be valid at all, regardless of Marketplace publishing; `branding` is the one piece specifically about Marketplace listing rather than the action's own function. Publishing itself is done from the repository's GitHub UI ("Draft a release" flow, offering a "Publish this Action to the GitHub Marketplace" checkbox when `action.yml` is valid and sits at the repository root) — tied to creating a release, normally tied to one of the semantic-version tags from Section 1.

## 4. SHA-Pinning vs. Moving Tags (Preview)

A moving tag is convenient but means the actual code a consumer runs can change without their workflow file changing at all. Pinning to `v1` gets automatic fixes with zero workflow changes, at the cost of trusting the author (and the author's GitHub account security) never to move that tag onto something malicious or broken. A full commit SHA is immutable by Git's own design — no one can force it to mean something else later — at the cost of never getting an update without a human editing the workflow file to bump it. Phase 11 covers this trade-off in depth, including real verified commit SHAs for pinning production actions.

## Comparison

| | `v1` (moving tag) | `v1.2.3` (full-version tag) | Full commit SHA |
|---|---|---|---|
| Enforcement | None — pure author convention | None — created once, never touched | Git-enforced immutability |
| Gets automatic fixes | Yes, silently | No — needs a manual workflow edit | No — needs a manual workflow edit |
| Trust required | Author never force-moves it onto something broken/malicious | None beyond the one release being sound | None — cannot be redirected after the fact |
| Best for | Most consumers, low-risk internal tooling | Consumers who want a frozen, known-good version | Security-sensitive / supply-chain-conscious pipelines |

| | Valid `action.yml` (usable via `uses:`) | Marketplace-listable `action.yml` |
|---|---|---|
| Required fields | `name`, `description`, `runs` | Everything to the left, plus `branding` (`icon` + `color`) |
| Functional impact of missing `branding` | None | Cannot be published to Marketplace |

## Common Mistakes

- **Publishing an action with only full-version tags (`v1.0.0`, `v1.1.0`, ...) and no moving major-version tag.** Every consumer is forced to pin to an exact patch version and manually bump their workflow file for every fix, including ones that would have been automatic and safe under a `v1` convention.
- **Cutting a new `v1.x.y` release and forgetting to move the `v1` tag to point at it.** Consumers who trusted `v1` to always track the latest compatible release stay silently stuck on whatever commit `v1` last pointed to — no error, no warning, since their workflow file never changed.
- **Force-moving `v1` onto a commit that actually contains a breaking change.** The major-version number is a promise that everything under `v1` is backward-compatible; moving `v1` onto a `v2`-shaped breaking change silently breaks every consumer who trusted that promise, with no error at pin-time.
- **Assuming `git push origin v1` alone moves an existing remote tag.** It doesn't — Git refuses non-fast-forward tag pushes by default, so re-pointing an already-pushed tag requires both `git tag -fa v1 ...` locally and `git push origin v1 --force` remotely.
- **Treating `branding` as required for the action to function.** It isn't — an action with no `branding` block works identically via `uses:`; the only thing it loses is Marketplace eligibility.

## Hands-On Exercises

1. In a scratch git repository, run the Section 1 tag sequence (`git tag -a v1.0.0`, `git tag -a v1`) and confirm both tags point at the same commit with `git show-ref --tags`.
2. Set up a scratch remote for the next two exercises to push against: `git init --bare /tmp/scratch-remote.git` creates a bare repository standing in for "GitHub" with no real network access required, then `git remote add origin /tmp/scratch-remote.git` and `git push origin --tags` register it as `origin` and publish the two tags from Exercise 1 to it.
3. Add a new commit and run `git tag -fa v1 -m "v1"` locally to re-point `v1` at it. Before pushing, confirm the non-fast-forward protection from the Common Mistakes section: run a plain `git push origin v1` (no `--force`) against the scratch remote from Exercise 2 and observe it rejected, since the remote's `v1` still points at the original commit.
4. Now run the Section 1 "move `v1`" push (`git push origin v1 --force`) against the same scratch remote, and confirm `git rev-parse v1` matches the new commit while `git rev-parse v1.0.0` still matches the original.
5. Validate the Marketplace-ready `action.yml` from Section 3 is well-formed YAML: `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < action.yml`.
6. Diff the Section 3 `action.yml` against Lesson 1's version and confirm `branding` is the only structural addition.

## Interview Q&A

**Q: If a consumer pins to `@v1`, what commit does that actually run?**
A: Whatever commit the `v1` tag currently points to, which the author may have force-moved since the consumer's workflow was last touched — `v1` is not an immutable reference the way a full-version tag or a SHA is.

**Q: Why might a security-conscious team pin to a full commit SHA instead of `v1`?**
A: A SHA can't be redirected after the fact by anyone, including a compromised maintainer account, while `v1` can be repointed to different code at any time without the consumer's workflow file changing. The convenience of automatic updates and the risk of trusting a mutable pointer are the same trade-off, weighted differently depending on how much the team trusts the action's supply chain.

**Q: Does `git push origin v1` move an already-pushed remote tag?**
A: No — Git treats re-pointing an existing tag as a non-fast-forward change and rejects a plain push. It requires `git tag -fa v1` locally followed by `git push origin v1 --force`.

**Q: What's the minimum `action.yml` needs to be listed on GitHub Marketplace, beyond what's already required to function?**
A: A `branding` block with an `icon` (from the Feather icon set) and a `color`. `name`, `description`, and `runs` are already mandatory for the action to work at all via `uses:`; `branding` is the one addition specific to Marketplace listing.
