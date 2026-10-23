# Interview Strategy Capstone

An interview question about GitHub Actions is almost never "what does `runs-on` do" — that's a documentation lookup, not something worth a live conversation. What actually gets asked is scenario-based and open-ended: "design a CI/CD pipeline for this application," "how would you secure a workflow that deploys to production," "this pipeline takes 25 minutes — how would you speed it up." These are testing design judgment across the same axes this course covered phase by phase — triggers, jobs, secrets, caching, security, cost — and a candidate who answers only the literal question asked, without volunteering the security and cost reasoning an interviewer is specifically listening for, reads as someone who can write a workflow file but hasn't internalized why it's structured that way.

## 1. The Interview-Answer Framework

A strong answer to an open-ended pipeline-design question follows a fixed order, and the order itself is the signal an interviewer is grading for:

```
1. Clarify the app and deploy target   (before sketching anything)
2. Sketch triggers and jobs            (high level, no YAML yet)
3. Volunteer security considerations   (before being asked)
4. Volunteer cost considerations       (in the same breath as security)
5. YAML-level detail                   (only as much as asked for, last)
```

**Step 1 — clarify before sketching.** "Design a CI/CD pipeline" is underspecified until you know: what language/runtime is being tested (affects Phase 9's per-language CI setup and whether a matrix, per Phase 6, is warranted), whether the artifact is a container image (Phase 10's registry build-and-push) or something else, and where it deploys — Kubernetes, a VM fleet, a serverless target. Asking this out loud signals you're not going to guess your way into a wrong-shaped answer.

**Step 2 — sketch triggers and jobs before any YAML.** State which events kick off which jobs — a pull request triggers test/lint/build jobs (Phase 2's `pull_request` trigger, as in [Phase-02-Triggers-and-Events/01-Push-and-Pull-Request-Triggers.md](../Phase-02-Triggers-and-Events/01-Push-and-Pull-Request-Triggers.md)); a merge to `main` triggers build-and-push plus a gated deploy job. Name the jobs and their dependency order (test → build → deploy) before worrying about exact step syntax.

**Step 3 — volunteer security before being asked.** This is the single biggest differentiator between an answer that describes "what runs" and one that demonstrates judgment: default `GITHUB_TOKEN` permissions to read-only and grant only what a job needs (Phase 11, [Phase-11-Security-Best-Practices/01-GITHUB-TOKEN-Permission-Scoping.md](../Phase-11-Security-Best-Practices/01-GITHUB-TOKEN-Permission-Scoping.md)); scope secrets to the environment that actually needs them rather than exposing them repo-wide (Phase 4, [Phase-04-Environment-Secrets-and-Variables/02-GitHub-Secrets-and-Environments.md](../Phase-04-Environment-Secrets-and-Variables/02-GitHub-Secrets-and-Environments.md)); gate the production deploy job behind a required manual approval (Phase 10, [Phase-10-CD-Patterns/03-Environment-Gated-Approvals-for-Production.md](../Phase-10-CD-Patterns/03-Environment-Gated-Approvals-for-Production.md)).

**Step 4 — volunteer cost in the same breath.** Cache dependencies so repeated runs don't redo expensive setup work (Phase 5, [Phase-05-Artifacts-and-Caching/02-Actions-Cache-and-Dependency-Caching.md](../Phase-05-Artifacts-and-Caching/02-Actions-Cache-and-Dependency-Caching.md)), and add a `concurrency` group with `cancel-in-progress` so a superseded PR push doesn't burn minutes on a run nobody needs anymore (this phase, [02-Cost-Optimization-and-Concurrency.md](02-Cost-Optimization-and-Concurrency.md)).

**Step 5 — YAML only as much as asked for.** If the interviewer wants the actual trigger block, job dependency graph, or a matrix definition (Phase 6, [Phase-06-Matrix-Builds-and-Strategy/01-Matrix-Strategy-Basics.md](../Phase-06-Matrix-Builds-and-Strategy/01-Matrix-Strategy-Basics.md)), produce it — as an illustration of the design already agreed on, not as the starting point.

## 2. A Fully Worked Example (Test → Build → Deploy with Approval)

Worked question: *"Design a pipeline that tests, builds a Docker image, and deploys to production only after manual approval."*

**Clarify.** Confirm the runtime being tested (say, a Node.js service), that the deploy artifact is a container image, and the deploy target (a Kubernetes cluster, for this example) — matching Phase 9's test setup ([Phase-09-CI-Patterns/01-Multi-Language-Test-Pipelines.md](../Phase-09-CI-Patterns/01-Multi-Language-Test-Pipelines.md)) and Phase 10's build/deploy patterns ([Phase-10-CD-Patterns/01-Container-Registry-Build-and-Push.md](../Phase-10-CD-Patterns/01-Container-Registry-Build-and-Push.md)).

**Sketch triggers and jobs.** A `pull_request` trigger runs a `test` job. A push to `main` runs `test` → `build-and-push` → `deploy-production`, with each job depending on the previous one via `needs:`.

```
pull_request  ──▶ test
push (main)   ──▶ test ──▶ build-and-push ──▶ deploy-production (requires approval)
```

**Volunteer security.** State it before being asked: top-level `permissions: contents: read`, with `packages: write` added only on the job that pushes the image; registry and cluster credentials live in a `production` environment's secrets, not repo-level secrets, so only the deploy job can see them; the `production` environment has a required reviewer configured, so the deploy job pauses for a human approval regardless of who merged the PR.

**Volunteer cost.** Dependency install in the `test` job uses `actions/setup-node`'s built-in cache; a `concurrency` group keyed on the workflow name and branch/PR ref with `cancel-in-progress: true` avoids piling up redundant CI runs on a fast-moving PR. The goal is to keep that cancellation on the `test`/`build-and-push` path but off `deploy-production` — canceling a live deploy mid-flight is unsafe — but a single top-level `concurrency:` block (the simplest thing to reach for) actually cancels the *entire run*, `deploy-production` included, since cancellation is scoped to the whole run, not to individual jobs within it. The skeleton below starts with that simpler (and, as shown, flawed) top-level block; getting `deploy-production` genuinely out of the blast radius takes either a separate workflow file or job-level `concurrency:` blocks instead of a workflow-level one — worked through in the note right after the YAML, and demonstrated in the Hands-On Exercises (this phase's cost lesson covers the mechanism itself).

**YAML, only if asked to go deeper** — a skeleton showing the job graph and the environment gate:

```yaml
name: Build, Push, and Deploy

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: pipeline-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm test

  build-and-push:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - run: echo "build and push image steps go here"

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "deploy to the cluster; environment 'production' requires manual approval before this job starts"
```

*(Validated as well-formed YAML.)* Note the top-level `concurrency` group applies to the whole *workflow run* — every job in it, `test`, `build-and-push`, and `deploy-production` alike, is cancelled together the moment a newer run supersedes this one under that same group key. Giving `deploy-production` its own job-level `concurrency:` block on top of this would **not** fix that: the job is still part of the same run the top-level group governs, so when that run is superseded and cancelled, `deploy-production` is cancelled with it regardless of any job-level setting layered on top — a job-level group doesn't opt a job out of its run's cancellation. The two things that actually protect it are: (1) move `deploy-production` into a genuinely separate workflow file, so it's no longer part of the run the top-level group cancels, or (2) remove this top-level `concurrency:` block entirely and apply `concurrency:` at the job level instead — one shared, canceling group for `test` and `build-and-push` (so a newer push still cancels their redundant in-progress work), and a separate, non-canceling group (or no `concurrency:` at all) for `deploy-production` specifically, so it's never a candidate for cancellation.

**Depth-probes.** "What if this needs to support three languages?" → a `strategy: matrix` across the `test` job (Phase 6). "Why hosted runners here and not self-hosted?" → Phase 12's trade-off ([Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/01-Setting-Up-Self-Hosted-Runners.md](../Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/01-Setting-Up-Self-Hosted-Runners.md)) — hardware/network access/cost-at-scale versus giving up the clean, disposable VM guarantee.

## Comparison

| Approach | What it signals to an interviewer | Risk if used alone |
|---|---|---|
| Design-first (clarify → sketch → security/cost → YAML) | Reasons about tradeoffs, not just syntax | None — this is the target pattern |
| Syntax-first (jump straight to YAML steps) | Can transcribe a pipeline but may not understand why it's shaped that way | Looks competent but risks answering the wrong-shaped question |
| Volunteering security/cost unprompted | These considerations are load-bearing in the design, not an afterthought | None |
| Waiting to be asked about security/cost | Reads as bolted-on only once prompted | Weaker signal, same eventual content |
| Generic tool-agnostic answer ("test stage, build stage, deploy stage") | Content-free for a GitHub-Actions-specific question | Doesn't demonstrate platform knowledge (environments, `concurrency`, OIDC) |

## Common Mistakes

- **Describing a pipeline only in terms of "what steps run" and never proactively mentioning permissions, secrets scoping, or cost/concurrency.** A description that stops at "test, then build, then deploy" without volunteering how secrets are scoped (Phase 4) or how `GITHUB_TOKEN` permissions are minimized (Phase 11) reads as incomplete to an interviewer specifically listening for that reasoning.
- **Jumping straight into YAML syntax before the design is agreed on.** Writing full step-level YAML before confirming the deploy target or the trigger/job shape risks designing the wrong thing in convincing-looking detail, and signals syntax recall standing in for design thinking.
- **Treating "how would you speed up a slow pipeline" as purely a caching question.** A strong answer checks trigger scope (Phase 2 — is the workflow running on changes it doesn't need to react to), matrix parallelism (Phase 6), and concurrency (Phase 13) alongside caching (Phase 5) — caching alone is only one of several levers.
- **Not having an answer ready for the standard depth-probes** — matrix builds across languages/versions, how secrets are scoped per-environment versus repo-wide, and the self-hosted-vs-hosted-runner trade-off — these come up often enough in follow-ups that having the one-sentence version ready (rather than reasoning it out live for the first time) noticeably changes how the answer lands.
- **Giving a generic, tool-agnostic CI/CD answer that never mentions GitHub Actions concepts** (environments, reusable workflows, `concurrency` groups, OIDC) when the question is specifically about this platform — an interviewer asking a GitHub Actions question wants GitHub Actions vocabulary, not a content-free "you'd have a test stage, then a build stage, then a deploy stage" that could describe any CI tool.

## Hands-On Exercises

1. **Practice the framework verbally on a new scenario.** Without writing any YAML, talk through the five-step framework for: "design a pipeline for a Python library that publishes to PyPI on a tagged release." Identify the trigger (a tag push, not `main` push), the job graph (test → build package → publish), and state the security consideration out loud (a trusted-publishing/OIDC token scoped only to the publish job, not repo-wide).
2. **Build the worked example end to end.** Starting from this lesson's skeleton YAML, add a real `Dockerfile` and a `docker build`/`docker push` step to `build-and-push`, and confirm (via `on.push.branches` and the `if: github.ref == 'refs/heads/main'` guards) that a pull-request run only executes `test` and never reaches `build-and-push` or `deploy-production`.
3. **Add the environment gate for real and verify it blocks.** Configure a `production` GitHub environment with a required reviewer. Push to `main` and confirm `deploy-production` pauses in "Waiting" status until the review is approved — and confirm a `pull_request` run never reaches that job at all (since it never satisfies `needs: build-and-push`, which itself is gated by the `main`-only `if:`).
4. **Remove the top-level concurrency group and apply job-level groups instead, to protect the deploy path.** First, using the worked example's YAML as-is (single top-level `concurrency` group covering the whole workflow), push to `main`, and once `deploy-production` is sitting in "Waiting" on its required approval, push to `main` a second time. Confirm the second push cancels the *entire first run* — by this point `test` and `build-and-push` have already succeeded and finished, so there's nothing left in them to cancel; what actually gets cancelled is the still-`Waiting` `deploy-production` job (and the run as a whole flips to "Cancelled"), because `cancel-in-progress` operates on the whole workflow run sharing that group key, not on individually named jobs.

   Then apply the fix from the note under the worked example: delete the top-level `concurrency:` block (the one keyed on `pipeline-${{ github.workflow }}-...`) entirely, and instead give `test` and `build-and-push` each their own job-level `concurrency:` block pointing at the *same* canceling group key, while leaving `deploy-production` with no `concurrency:` block at all:

   ```yaml
   jobs:
     test:
       runs-on: ubuntu-latest
       concurrency:
         group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
         cancel-in-progress: true
       steps:
         # ...unchanged

     build-and-push:
       if: github.ref == 'refs/heads/main'
       needs: test
       runs-on: ubuntu-latest
       concurrency:
         group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
         cancel-in-progress: true
       permissions:
         contents: read
         packages: write
       steps:
         # ...unchanged

     deploy-production:
       if: github.ref == 'refs/heads/main'
       needs: build-and-push
       runs-on: ubuntu-latest
       environment: production
       steps:
         # ...unchanged, and no concurrency: block here
   ```

   Repeat the same push/wait/push sequence. This time, a second push that lands while `test` (or `build-and-push`) is still running does cancel that in-progress job, because both share the same canceling group key — the "cancel a superseded run's CI work" behavior is preserved. But once `deploy-production` is sitting in "Waiting," it is untouched by any further push: it has no `concurrency:` block of its own, so it is never a candidate for cancellation, and it stays in "Waiting" until its approval is granted regardless of how many more pushes land on `main` in the meantime.
5. **Answer a depth-probe and cite the source.** Given the prompt "why hosted runners here and not self-hosted," write a two-sentence answer, then confirm it lines up with the trade-off actually described in [Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/01-Setting-Up-Self-Hosted-Runners.md](../Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/01-Setting-Up-Self-Hosted-Runners.md) rather than a guess.

## Interview Q&A

**Q: How would you handle "what if this pipeline needs to test against three language versions"?**
A: Add a `strategy: matrix` to the `test` job (Phase 6) so it runs once per version in parallel, rather than serially chaining three separate test steps.

**Q: How should secrets be scoped in a pipeline that only deploys to production after approval?**
A: Store deploy credentials in the `production` environment's secrets, not repo-level secrets, so only jobs that declare `environment: production` — and have passed its required-reviewer gate — can see them. A `test` or `build` job should never have access to production credentials at all.

**Q: When would you choose self-hosted runners over GitHub-hosted ones?**
A: When the job needs something a hosted runner can't provide — reach into a private network, specific hardware, or high enough volume that per-minute hosted billing becomes more expensive than owning the machine — accepting in exchange that you now own patching, isolation, and security for that machine instead of GitHub.
