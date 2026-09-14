# Org-Level Reusable Workflow Governance

Phase 11 closed several supply-chain gaps, but every one of them was a per-repository practice: SHA-pinning an action only helps if the team that owns that specific workflow file remembered to do it. Nothing stops a different team, in a different repository in the same org, from using a mutable tag or adopting an unvetted third-party action. This lesson covers the org-level mechanisms that close that gap — and they are genuinely separate mechanisms solving separate problems, not different names for the same feature.

## 1. The Allow-List-of-Actions Feature

An organization or enterprise admin can configure a policy — outside any individual workflow file, in org/enterprise Actions settings — that restricts which actions and reusable workflows any repository in the org is even allowed to reference. This is enforced at the platform level for every repository in its scope, independent of what any individual workflow file says: a workflow referencing an action outside the allow-list simply fails to run, before the job ever executes.

**This is a settings-level policy, not YAML.** Described conceptually, a restrictive policy might look like:

- **Policy mode:** "Allow select actions and reusable workflows" (as opposed to "Allow all actions and reusable workflows," the permissive default).
- **Allowed:** actions created by GitHub (e.g., anything under `actions/*`), plus a specific list of verified third-party actions the security team has reviewed, pinned to specific SHAs.
- **Allowed reusable workflows:** the org's own internal reusable workflows (e.g., everything under `your-org/shared-workflows/.github/workflows/**`).
- **Everything else:** blocked at the platform level, before the job runs, regardless of what a repo's own maintainers intended.

```
Workflow references: uses: some-random-org/unvetted-action@v1
Org allow-list:        [actions/*, docker/build-push-action@<sha>, your-org/shared-workflows/**]
Result:                BLOCKED — not on the list, job fails before executing
```

## 2. Repository Rulesets for Required Workflows

Separately, an org can define a **repository ruleset** (Settings → Rules → Rulesets, applied to one repo or org-wide) with a "require workflows to pass" rule, which forces specific workflows to run and succeed before a branch can receive a push or a pull request can merge — mandatory, platform-enforced, and independent of whether the repo's own workflow file calls that check itself.

**This is also a settings-level policy, not YAML** — configured inside a repository ruleset, not checked into the repo. Described conceptually:

- **Ruleset target:** all repositories matching `*` (or a specific pattern) in the organization.
- **Rule type:** "Require workflows to pass before merging."
- **Required workflow:** `security-org/mandatory-checks/.github/workflows/dependency-scan.yml@main`, sourced from a central repo the security team owns.
- **Enforcement status:** "Active" — a pull request in any targeted repo cannot merge until that named workflow has run and reported success, regardless of whether the repo's own `.github/workflows/` even mentions it.

**Important — a standalone org/enterprise Actions setting called "required workflows" existed before, but GitHub deprecated it on October 18, 2023.** The equivalent capability now lives inside repository rulesets, as the "require workflows to pass" rule type — not on a separate Actions settings page. Documentation or habits pointing to the old settings location no longer apply.

```
Old (deprecated Oct 18, 2023): Org Actions settings → "Required workflows" (standalone feature)
Current mechanism:              Repository ruleset → rule type "Require workflows to pass before merging"
```

## 3. Allow-List vs. Required Workflows — Two Different Problems

These are two distinct mechanisms and must not be conflated: the allow-list is a **negative control** — it blocks what a repo is permitted to reference at all (which actions/reusable workflows are reachable). The required-workflow ruleset rule is a **positive control** — it adds something that must run and succeed, regardless of what the repo owner configured. An org typically uses both together: a ruleset to guarantee a baseline check runs everywhere, and an allow-list to guarantee nothing ungoverned can run alongside it.

```
Allow-list (org/enterprise Actions settings):
  Question answered: "What is this repo even PERMITTED to use?"
  Type of control:    Negative (blocks the unapproved)

Repository ruleset "require workflows to pass":
  Question answered: "What MUST run and succeed before merge?"
  Type of control:    Positive (inserts the mandatory)

These live on different settings surfaces and solve different problems —
neither substitutes for the other.
```

## 4. Centralizing Reusable Workflows

Separately again from both policy mechanisms above, an org can maintain one centrally-owned reusable workflow (the reusable-workflow mechanism from Phase 7) that many teams call into, so the actual CI/CD logic is written and reviewed once instead of being reinvented — and potentially misconfigured — by every team independently.

```yaml
name: CI

on:
  pull_request:
    branches:
      - main

jobs:
  call-shared-ci:
    uses: your-org/shared-workflows/.github/workflows/standard-ci.yml@v2
    with:
      node-version: "20"
    secrets: inherit
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

This consuming team's workflow contains none of the actual test/build/lint logic — that lives once, in `your-org/shared-workflows`, with `@v2` naming a specific, deliberately-versioned release rather than an unpinned branch.

## 5. Change-Management for Shared Workflows

Centralizing carries a concentrated risk: a breaking or unreviewed change to the one shared workflow can silently affect every consuming team's pipeline at once. If every consuming team references the shared workflow by an unpinned branch (`@main`) instead of a tagged release, that risk has no mitigation. A version bump (`@v1` → `@v2`) with a documented compatibility policy turns a shared dependency into a manageable one — the same discipline SHA-pinning brings to a third-party action applies here to a shared internal workflow.

## Comparison

| Mechanism | Configured where | Type of control | Question it answers |
|---|---|---|---|
| Allow-list of actions/reusable workflows | Org/enterprise Actions settings | Negative (blocks) | What is a repo even permitted to reference? |
| Repository ruleset "require workflows to pass" | Settings → Rules → Rulesets | Positive (mandates) | What must run and succeed before merge? |
| Repo-level SHA-pinning (Phase 11) | Individual workflow file | Negative, opt-in | Is this one reference immutable? |
| Centrally-owned reusable workflow | A shared internal repo, called via `uses:` | Neither — shared implementation | Who writes/reviews the actual CI logic? |
| Deprecated "required workflows" setting (pre-Oct 18, 2023) | Old, standalone Actions setting | N/A — no longer exists | Superseded by repository rulesets |

## Common Mistakes

- **Assuming repo-level practices like SHA-pinning are sufficient without any org-level allow-list.** SHA-pinning only protects the specific action a workflow author already chose to pin — it says nothing about a different team adopting an entirely unreviewed action for the first time.
- **Centralizing a reusable workflow without any versioning or change-management process.** Referencing the shared workflow by an unpinned `@main` means a single breaking change can silently break every consuming team's CI at once.
- **Treating "allow all actions and reusable workflows" as a harmless default.** It's the permissive default, but it means the org has no platform-level check against any team adopting an unreviewed, potentially malicious action.
- **Making the allow-list so narrow it blocks legitimate work without a documented request process.** This tends to get worked around informally (vendored copies, unreviewed forks), defeating the point of centralizing the control.
- **Assuming a ruleset-required workflow and a reusable workflow are the same governance mechanism.** A ruleset-required workflow is imposed by the org regardless of what the repo's own YAML does; a reusable workflow (Phase 7) is opt-in via `uses:`. Conflating the two leads to assuming a shared workflow is enforced everywhere when it's only enforced where a ruleset specifically names it.
- **Looking for "required workflows" as a standalone org/enterprise Actions setting.** That setting was deprecated on October 18, 2023 — the current mechanism lives inside repository rulesets as the "require workflows to pass" rule type.

## Hands-On Exercises

1. As an org admin, set the org's Actions policy to "Allow select actions and reusable workflows," add `actions/checkout` and your org's shared-workflows repo to the allow-list, and confirm a test workflow referencing an action not on the list fails before its job executes.
2. Create a repository ruleset targeting all repos in a test org, add a "require workflows to pass" rule naming a simple internal workflow, and confirm a pull request in a targeted repo cannot merge until that workflow succeeds — even in a repo whose own `.github/workflows/` never references it.
3. Search your org's documentation or runbooks for any reference to a standalone "required workflows" Actions setting predating October 18, 2023, and confirm none of your active governance actually depends on that deprecated setting — migrate any that do to a repository ruleset instead.
4. Publish a centrally-owned reusable workflow at `your-org/shared-workflows/.github/workflows/standard-ci.yml`, tag it `v1`, and have a consuming repo call it with `uses: your-org/shared-workflows/.github/workflows/standard-ci.yml@v1`. Confirm the consuming repo's CI run executes the shared logic.
5. Cut a breaking change to the shared workflow from Exercise 4 as `v2` (leaving `v1` untouched), and confirm the consuming repo from Exercise 4 — still pinned to `@v1` — is unaffected by the `v2` change, demonstrating why a tagged release protects consumers from an unpinned `@main` reference.

## Interview Q&A

**Q: If every repo SHA-pins its actions, is the org's supply chain secure?**
A: No — SHA-pinning only protects the specific actions a given workflow author already decided to reference. It does nothing to stop a different team from adopting an entirely new, unreviewed action for the first time. Real supply-chain governance needs an org- or enterprise-level allow-list, enforced by the platform rather than by each team's individual diligence.

**Q: How do you force a security-scan workflow to run on every pull request across an entire org, even in repos whose maintainers never added it?**
A: Use a repository ruleset with a "require workflows to pass before merging" rule targeting those repos — this mandates the workflow at the platform level regardless of whether the repo's own YAML calls it.

**Q: Is the allow-list-of-actions feature the same thing as required workflows?**
A: No — they are two separate mechanisms. The allow-list is a negative control restricting which actions/reusable workflows a repo may reference at all. Required workflows (via a repository ruleset) is a positive control mandating a specific workflow run and succeed. An org typically needs both.

**Q: Where does "required workflows" live today, and why might someone look in the wrong place for it?**
A: It lives inside repository rulesets as the "require workflows to pass" rule type. Someone might look for a standalone org/enterprise Actions setting instead, because that setting existed before but was deprecated on October 18, 2023.

**Q: What's the risk of centralizing a shared CI/CD workflow across many teams?**
A: It avoids everyone reinventing (and potentially misconfiguring) the same logic, but concentrates risk — a breaking or unreviewed change to that one shared workflow can silently affect every consuming team's pipeline simultaneously, unless consumers pin to tagged releases rather than an unpinned branch.
