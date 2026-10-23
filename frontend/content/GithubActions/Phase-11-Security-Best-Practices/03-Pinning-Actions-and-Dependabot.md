# Pinning Actions and Dependabot

Phase 8, Lesson 3 built the moving-tag convention (`v1` re-pointed to whatever the latest compatible release is) and previewed the question this lesson answers: why might a security-conscious team pin to a full commit SHA instead of `v1`? The answer is that a tag — moving or not — is just a mutable Git ref. Nothing in Git or GitHub stops an action's maintainer (or an attacker who compromises that maintainer's account) from force-moving `v1`, or even a full-version tag like `v1.2.3`, onto a completely different commit. A workflow pinning `uses: some-org/some-action@v1` is trusting that the code behind that ref today is the same code that runs tomorrow — a trust a full commit SHA doesn't require, because Git makes a SHA fundamentally immutable. The trade-off Phase 8 flagged is real: a SHA pin alone never updates itself, so it never receives a legitimate security fix unless a human notices and bumps it. Dependabot closes that gap, automatically proposing the bump as a reviewable pull request instead of leaving the SHA frozen indefinitely.

## 1. Why Tags Are Mutable (the Supply-Chain Risk)

A tag is a nickname, not an identity — it can be force-moved by anyone with push access to that repository, including a full-version tag like `v1.2.3`, even though doing so violates convention. A commit SHA is a fingerprint: a hash of the commit's own content and history, so no tag-force-move or repository-side trick can make that SHA resolve to different code — the action that runs is exactly the commit that SHA names, permanently.

```
uses: actions/checkout@v4        ← mutable ref, maintainer (or attacker) can repoint it
uses: actions/checkout@b4ffde6…  ← immutable, always resolves to this exact commit
```

## 2. Pinning to a Full Commit SHA

A workflow step references a third-party action by its full 40-character commit SHA instead of a tag, with a trailing comment stating the human-readable version the SHA corresponds to — purely for the benefit of anyone reading the workflow file, since a raw SHA alone is unreadable as a version number.

```yaml
name: Build and Test

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
        with:
          node-version: "20"
      - run: npm ci
      - run: npm test
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

The workflow pins both actions to full commit SHAs with trailing `# vX.Y.Z` comments: `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1` and `actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2`. Because a Git SHA is a hash of the commit's own content, the action that runs is exactly that commit — permanently.

## 3. Dependabot for SHA-Pinned Actions

Dependabot, configured for the `github-actions` ecosystem in `dependabot.yml`, scans workflow files on its configured schedule. It specifically recognizes the `uses: owner/action@<sha> # vX.Y.Z` pattern — parsing the trailing version comment to know what version is currently pinned, then checking the action's repository for newer tagged releases. When a newer release exists, Dependabot opens a pull request that updates both halves together: the SHA is replaced with the new release's commit SHA, and the trailing comment is updated to match the new version number. A human then reviews and merges that PR like any other dependency bump — the SHA is the security control, and Dependabot plus code review is the process that keeps the SHA from silently going stale.

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

`directory: "/"` — Dependabot discovers `.github/workflows/*.yml` automatically for the `github-actions` ecosystem — and `interval: "weekly"` sets the scan cadence for opening update PRs whenever `actions/checkout` or `actions/setup-node` cut a new release.

## Comparison

| Approach | Update mechanism | Trust required |
|---|---|---|
| Moving tag (`@v1`) | Automatic, zero workflow-file changes | Trusts maintainer never force-moves the tag onto malicious/broken code |
| Full-version tag (`@v1.2.3`) | Manual bump when a new version ships | Same as `@v1` — still a mutable ref by Git's design, despite convention |
| Full commit SHA, no Dependabot | Never — frozen at the pinned commit forever | None (immutable), but forfeits every future security fix |
| Full commit SHA + Dependabot | Automatic PR proposed on new release, human-reviewed merge | None for identity; human review still needed for the new code itself |

## Common Mistakes

- **Pinning to a SHA once and never updating it.** This trades the moving-tag risk for a different one: the action never receives a legitimate patch or security fix again unless a human manually notices and re-pins it — exactly the gap Dependabot automation exists to close.
- **Pinning some actions in a workflow to SHAs while leaving others on `@v1` or `@main`.** This leaves inconsistent trust levels within the same job — a single compromised or re-tagged action among the un-pinned ones undermines the security benefit the pinned ones were meant to provide.
- **Pinning to a SHA but dropping the version comment.** Without `# vX.Y.Z`, Dependabot has no human-readable version to report in its update PRs, and anyone reading the workflow has to look up what a 40-character hash actually corresponds to by hand.
- **Assuming Dependabot's update PR is automatically safe to merge without review.** Dependabot verifies the new SHA matches a real tagged release from that action's repository; it does not verify the new release's code is itself safe.
- **Forgetting that `dependabot.yml` needs a separate `package-ecosystem: "github-actions"` entry** distinct from any application-dependency ecosystems (`npm`, `pip`, etc.) already configured — workflow-file pins aren't picked up by an `npm`-only Dependabot configuration.

## Hands-On Exercises

1. In a scratch workflow, replace `actions/checkout@v4` with `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1`, validate it with `actionlint`, and confirm the run succeeds identically to the tag-based version.
2. Add the `dependabot.yml` from Section 3 to `.github/dependabot.yml`, then check the repository's Insights → Dependency graph → Dependabot to confirm the `github-actions` ecosystem is now tracked.
3. Intentionally pin to a slightly older SHA of `actions/setup-node` (an earlier release's commit), wait for Dependabot's next scheduled scan (or trigger it manually via the "Check for updates" button in the UI), and confirm a PR appears bumping both the SHA and the version comment.
4. In a workflow with two steps, pin one to a SHA and leave the other on `@v1`; run `git tag -f v1 <some-other-commit>` (on a throwaway fork you control) and observe that only the un-pinned step's resolved code changes.
5. Remove the trailing `# v4.1.1` comment from a SHA-pinned `actions/checkout` line and confirm Dependabot's next update PR description no longer states a human-readable "from version" in its summary.

## Interview Q&A

**Q: Why pin a third-party action to a commit SHA instead of a version tag?**
A: A tag, including a full-version tag, can be force-moved by the action's maintainer or by anyone who compromises that maintainer's account, silently changing what code runs without any change to the consuming workflow file. A SHA cannot be redirected, full stop.

**Q: Doesn't pinning to a SHA mean the action never gets security updates?**
A: The SHA pin alone is static by design, but Dependabot (recognizing the `@<sha> # vX.Y.Z` convention) automates noticing new releases and proposing the bump as a reviewable PR — updates still happen, just through an explicit, auditable step rather than silently.

**Q: How does Dependabot know what version a SHA-pinned action currently is?**
A: It parses the trailing `# vX.Y.Z` comment next to the SHA — without that comment, Dependabot (and any human reader) has no human-readable version to compare against newer releases.

**Q: Is a merged Dependabot PR that bumps an action's SHA automatically safe?**
A: No — Dependabot only verifies the new SHA matches a real tagged release from that action's repository. It does not evaluate whether that release's code itself is safe, so the PR still needs the same review as any other dependency bump.
