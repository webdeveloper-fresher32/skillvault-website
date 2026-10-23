# Environment-Gated Approvals for Production

Phase 10's first two lessons built the mechanics of getting a new image into a running Kubernetes Deployment. Neither addressed a separate question: who decides, and when, that a given build is actually ready to go to production? A staging deploy can reasonably run the instant CI passes — the cost of a bad staging deploy is a broken test environment. A production deploy carries a different cost, and most teams want a human to look at *this specific* deployment before it touches real users, not just a green checkmark from CI.

## 1. GitHub Environments as Approval Gates (Recap from Phase 4)

Phase 4, Lesson 2 introduced GitHub Environments as a scoping-plus-approval layer sitting on top of plain secrets: a job that declares `environment: production` pauses before its steps run if that Environment has required reviewers configured, and only receives that Environment's scoped secrets once the gate clears. Phase 10 applies that same mechanism specifically to production deploy jobs — the pattern of gating *is* Phase 4's Environments; what's new here is using it deliberately to separate an ungated `deploy-staging` job from a gated `deploy-production` job.

```
deploy-staging   → environment: staging    → no protection rules → runs immediately
deploy-production → environment: production → required reviewers → pauses until approved
```

## 2. Environment-Scoped Secrets

Two Environments exist: `staging` and `production`, configured under repository Settings → Environments (Phase 4, Lesson 2), each with its own scoped secrets and variables — a `staging` job's `${{ secrets.DEPLOY_TOKEN }}` and a `production` job's `${{ secrets.DEPLOY_TOKEN }}` can share the same secret *name* while holding entirely different values, because each is scoped to its own Environment rather than the repository as a whole.

```yaml
# staging job
environment: staging
env:
  DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}   # staging's own scoped value

# production job
environment: production
env:
  DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}   # production's own scoped value, distinct from staging's
```

The gate is enforced by the job declaring the Environment, not by the secret's name or content. A secret being named `PROD_DEPLOY_TOKEN` implies nothing about access control on its own — what actually restricts it to approved runs is that the secret is *created inside* the `production` Environment's own secret store, making it fetchable only by jobs that declare `environment: production`, rather than being created as a repository-level secret any job in the repository (gated or not) could read. A workflow-level or repository-level secret bypasses the gate entirely, because those scopes have no Environment attached to check protection rules against — any job, whether or not it declares an Environment, can read a repository secret the instant it runs.

## 3. Ungated Staging vs. Gated Production

A `deploy-staging` job declares `environment: staging` (or skips the `environment:` key entirely) and runs the moment its `needs` are satisfied — no pause, no approval step, matching the lower stakes of a staging deploy. A `deploy-production` job declares `environment: production`; the instant that job would otherwise start, GitHub Actions checks `production`'s protection rules and, if required reviewers are configured, pauses the job — its steps do not execute and its Environment-scoped secrets are not fetched — until enough of the listed reviewers approve. Only after approval does `production`'s job proceed, at which point it receives `production`'s Environment-scoped secrets (merged with repository and organization secrets into the same `secrets` context, exactly as Phase 4, Lesson 2 described) and runs its deploy steps.

| | `staging` | `production` |
|---|---|---|
| `environment:` declared | `staging` | `production` |
| Protection rules | None (or looser) | Required reviewers (must have write access) |
| Job start | Immediate, once `needs` satisfied | Paused until approval |
| Secrets fetched before approval | N/A — no gate | Not fetched until gate clears |
| Typical deploy steps | `kubectl set image` / `kubectl rollout status` | Same steps, pointed at production cluster credentials |

## 4. Full Example: Staging and Production Deploy Jobs

A workflow with an ungated `deploy-staging` job and a gated `deploy-production` job, each drawing credentials from its own Environment:

```yaml
name: Deploy

on:
  workflow_dispatch:
    inputs:
      target:
        description: "Deploy target"
        required: true
        default: staging

jobs:
  deploy-staging:
    if: github.event.inputs.target == 'staging'
    runs-on: ubuntu-latest
    environment: staging   # no required reviewers configured — runs immediately
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Deploy to staging
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}   # staging's own scoped value
        run: |
          kubectl set image deployment/my-app my-app=ghcr.io/${{ github.repository }}:${{ github.sha }}
          kubectl rollout status deployment/my-app --timeout=120s

  deploy-production:
    if: github.event.inputs.target == 'production'
    runs-on: ubuntu-latest
    environment: production   # required reviewers configured — pauses for approval
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Deploy to production
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}   # production's own scoped value, distinct from staging's
        run: |
          kubectl set image deployment/my-app my-app=ghcr.io/${{ github.repository }}:${{ github.sha }}
          kubectl rollout status deployment/my-app --timeout=120s
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

Both jobs run the identical `kubectl set image` / `kubectl rollout status` sequence and both reference a secret named `DEPLOY_TOKEN` — but because each job declares a different `environment:`, `${{ secrets.DEPLOY_TOKEN }}` resolves to whichever value was created inside *that specific Environment's* secret store, so `deploy-staging` can never accidentally receive production's token or vice versa. `deploy-staging`'s `staging` Environment has no required reviewers configured, so the job starts the moment the workflow is dispatched with `target: staging`. `deploy-production`'s `production` Environment does have required reviewers configured (set under Settings → Environments, not visible in this YAML), so before `deploy-production`'s steps run — before `DEPLOY_TOKEN` is even fetched — GitHub Actions pauses the job and waits for one of the listed reviewers to approve.

## Comparison

| | Ungated staging deploy | Gated production deploy |
|---|---|---|
| YAML shape | Nearly identical to production's | Nearly identical to staging's |
| Where the difference lives | Environment's own protection-rule config, not the workflow file | Same — required reviewers configured on the `production` Environment |
| Environment-scoped secret vs. same-named repo secret | An Environment-scoped `DEPLOY_TOKEN` is only fetched by a job declaring that exact `environment:`, after the gate clears | A repository-level `DEPLOY_TOKEN` is available to any job the instant it runs, gated or not — same name does not mean same access control |
| Required reviewers vs. a wait timer | A wait timer just pauses for a fixed duration, no explicit approval needed | Required reviewers demand an explicit human approval from someone on a specific list — the two can be configured together, neither substitutes for the other |
| Gating mechanism | Property of the job's `environment:` declaration | A secret's own configuration cannot enforce an approval requirement independent of which Environment it lives in |

## Common Mistakes

- **Putting production credentials in a workflow-level or repository-level secret instead of `production`'s Environment-scoped secret store.** Any job in the repository can read a repository-level secret regardless of whether it declares `environment: production` — this doesn't just weaken the gate, it removes it entirely, since a job never needs to pass through the approval step to obtain the credential in the first place.
- **Assuming a required-reviewers rule is enforced just because the workflow file references `environment: production`.** The gate lives in the Environment's own protection-rule configuration (Settings → Environments), not in the YAML; a `production` Environment created with no reviewers configured lets a job declaring it run immediately, identically to an ungated job, even though the workflow file looks like it should be gated.
- **Forgetting that required reviewers must themselves have write access to the repository to be eligible approvers.** Someone added as a required reviewer without at least write access is not a valid approver for that Environment — a team can configure a reviewer list that, on paper, looks like it enforces sign-off, while in practice no one on it is actually eligible to approve, silently disabling the gate.
- **Reusing the exact same secret name across `staging` and `production` Environments and assuming that alone prevents cross-environment mixups**, without verifying each Environment's copy actually holds the correct value — the name matching is what makes workflow YAML reusable across environments; it says nothing about whether someone pasted staging's value into production's store by mistake.
- **Treating a wait timer as equivalent to required reviewers.** A wait timer only delays the job by a fixed duration; it doesn't require anyone to look at the deployment at all before it proceeds — a team wanting an actual human decision, not just a pause, needs required reviewers, not (or not only) a wait timer.

## Hands-On Exercises

1. Save the full example workflow from Section 4 as `.github/workflows/deploy.yml` and validate it with `actionlint .github/workflows/deploy.yml`, confirming no errors.
2. Run `python3 -c "import yaml; print(yaml.safe_load(open('.github/workflows/deploy.yml')))"` to confirm the file parses as valid YAML.
3. In a test repository, create `staging` and `production` Environments under Settings → Environments, add a `DEPLOY_TOKEN` secret with a different value in each, configure `production` with yourself as a required reviewer, then run `gh workflow run deploy.yml -f target=production` and confirm via `gh run view` that the job pauses awaiting approval before any step executes.
4. With the same setup, run `gh workflow run deploy.yml -f target=staging` and confirm via `gh run view` that the job starts immediately with no approval prompt.
5. Add a required reviewer to `production` who only has read access to the repository, attempt to approve the pending run as that user via the GitHub UI, and confirm they are not offered as an eligible approver — demonstrating the write-access requirement for reviewers.

## Interview Q&A

**Q: Your production deploy job declares `environment: production` with required reviewers configured, but a teammate says they were able to deploy to production without any approval prompt — how is that possible?**
A: Check where the production credential actually lives. If it's a repository-level (or workflow-level) secret rather than one scoped to the `production` Environment, any job — including one that never even declares `environment: production` — can read it and deploy without ever passing through the approval gate. The Environment declaration on one job doesn't retroactively protect a secret that's also readable elsewhere.

**Q: What two things does a GitHub Environment add on top of a plain secret?**
A: Scoping (a secret with the same name can hold different values per Environment) and gating (protection rules like required reviewers or a wait timer that pause a job before it runs) — both from Phase 4, Lesson 2, applied here specifically to separate an ungated staging deploy from a gated production one.

**Q: Is a wait timer a substitute for required reviewers?**
A: No. A wait timer only delays the job by a fixed duration and doesn't require anyone to actively review anything; required reviewers demand an explicit approval from someone on a specific list. They can be configured together, but neither replaces the other.

**Q: Why can `staging` and `production` jobs both reference `${{ secrets.DEPLOY_TOKEN }}` in identical YAML and still get different, correctly-scoped values?**
A: Because the secret is resolved against whichever Environment the job declares — the same secret *name* can hold independent values in each Environment's own secret store, so the value returned depends on the job's `environment:`, not on anything in the expression itself.
