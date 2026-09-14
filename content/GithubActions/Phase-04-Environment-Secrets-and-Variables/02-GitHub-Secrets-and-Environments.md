# GitHub Secrets and Environments

The previous lesson's `env:` block is fine for values safe to sit in plaintext in a YAML file — a deploy target name, a build flag. It is not fine for a database password, a cloud API key, or a signing certificate. GitHub Secrets solve storage: an encrypted value, set once, referenced via `${{ secrets.NAME }}`, never displayed back to anyone. GitHub Environments add an approval-and-scoping layer on top, for the credentials that need a human gate, not just workflow permission.

## 1. Repository, Organization, and Environment-Scoped Secrets

Secrets are created outside the workflow file — in repository Settings → Secrets and variables → Actions, an org's own Settings, or via API/CLI. The value is encrypted at rest and GitHub never displays it again after creation; only update or delete are possible, not view.

| Scope | Where it's created | Available to |
|---|---|---|
| Repository secret | Repo Settings | Any workflow in that one repo |
| Organization secret | Org Settings | Multiple repos, optionally restricted to a subset |
| Environment secret | Environment config (per repo) | Only jobs that declare `environment: <name>`, and only after that Environment's protection rules clear |

## 2. Referencing Secrets (`${{ secrets.NAME }}`)

A secret is read through the `secrets` context — `${{ secrets.NAME }}` — typically inside an `env:` block or an action's `with:` input, so it lands in the running step as a normal environment variable or input value without ever being printed in the workflow file itself.

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy using a secret
        env:
          DEPLOY_TOKEN: ${{ secrets.PROD_DEPLOY_TOKEN }}
        run: echo "Deploying with a token"
```

## 3. GitHub Environments as Approval Gates

A GitHub Environment is a named target (e.g. `production`, `staging`) configured under repository Settings → Environments. A job opts in by adding `environment: production` at the job level. Protection rules attach to the Environment itself, not to any individual secret — the two most common are **required reviewers** (specific people must approve before the job proceeds) and a **wait timer** (the job pauses a configured number of minutes before continuing).

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # ties this job to the "production" Environment and its gate
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Deploy using environment-scoped secret
        env:
          DEPLOY_TOKEN: ${{ secrets.PROD_DEPLOY_TOKEN }}   # only available because of environment: production
        run: echo "Deploying with a token scoped to production only"
```

```
Job declares: environment: production
        │
        ▼
GitHub checks production's protection rules
        │
        ├─ required reviewers configured? ── job PAUSES until approved
        ├─ wait timer configured?         ── job PAUSES until timer elapses
        │
        ▼ (only after gate clears)
Environment secrets fetched → merged into `secrets` context → job's steps run
```

When a job declares a protected Environment, GitHub Actions pauses that job right before it starts — the job's steps do not execute, and no Environment-scoped secret is fetched, until every required reviewer approves (or the wait timer elapses). Only after the gate clears does the runner receive the Environment's secrets, alongside repository and organization secrets, merged into the same `secrets` context for that job.

Validate the YAML is well-formed:

```bash
python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())" < workflow.yml
```

## 4. How Secret Masking Actually Works (and Its Limits)

Log masking happens as output streams back from the runner: GitHub Actions scans each line of log output for occurrences of the literal secret value and replaces exact matches with `***` before the log is stored or displayed. This is a straightforward substring match against every secret value currently in scope for the job — not a semantic understanding of "this output contains a credential."

```
Secret value: "sk_live_abc123"

echo "$DEPLOY_TOKEN"                     → ***                (exact match, masked)
echo "$DEPLOY_TOKEN" | base64             → c2tfbGl2ZV9hYmMxMjM=   (NOT masked — transformed)
echo "${DEPLOY_TOKEN:0:4}...${DEPLOY_TOKEN:8}"                 → sk_l...c123        (NOT masked — partial slices)
```

Masking is a display-layer courtesy, not encryption or access control — it only stops that one exact string from appearing verbatim in stored log text.

## Comparison

| Comparison | Detail |
|---|---|
| Repository vs. organization vs. environment secrets | Repository is narrowest and simplest; organization trades blast-radius for convenience across many repos; environment is the only one tied to an approval gate |
| `env:` (plain values) vs. `secrets` context | `env:` values are plaintext in the YAML to anyone with read access; `secrets.NAME` values are never shown again and are masked in logs |
| Plain job vs. job with `environment:` | A plain job runs the instant its `needs` are satisfied; a job with `environment:` set to a protected Environment pauses for reviewer approval or a wait timer first — an Environment can exist with no secrets at all, purely to gate a deployment |
| Masking vs. actual protection | Masking hides an exact string from logs read later; it is not encryption, not access control, and no guarantee the value never left the runner |

## Common Mistakes

- **Assuming secret masking in logs is foolproof.** It only matches the literal secret string — base64-encoded, reversed, split across multiple `echo` calls, uppercased, or otherwise transformed, and it prints in full, defeating the masking entirely.
- **Putting a sensitive credential directly in a workflow-level `env:` block** instead of scoping it to the specific job or step that needs it — every job and step then has that value in its environment, widening the blast radius far beyond what's necessary.
- **Using a plain repository secret for a production credential when an Environment secret with required reviewers was the point** — a repository secret is available the moment conditions are met, with no human getting a chance to look at *this specific* deployment first.
- **Echoing a secret (or a value derived from it) to stdout "just to debug it"** — even accounting for masking's best-effort nature, this is the single most common way a secret ends up in a log; `secrets` context values can be validated (e.g., checked for non-empty) without ever printing them.
- **Assuming an organization secret is automatically available to every repository** without checking its repository-access restriction — org secrets can be scoped to "all repositories" or a specific list, and an unlisted repo simply sees the secret as unset, with no error naming the problem.

## Hands-On Exercises

1. **(Requires a GitHub repo)** Create a repository secret `PROD_DEPLOY_TOKEN`, build the Section 3 example exactly as written (no Environment configured yet), and confirm the job runs immediately and the value is masked if echoed directly.
2. **(Requires a GitHub repo)** Create a `production` Environment under repo Settings → Environments, add yourself as a required reviewer, and add `environment: production` to the job from Exercise 1. Push a run and confirm the job pauses waiting for approval before any steps execute.
3. **(Requires a GitHub repo)** Move `PROD_DEPLOY_TOKEN` from a repository secret to an Environment secret scoped to `production` only. Confirm a workflow run for a job that does *not* declare `environment: production` sees the secret as unset.
4. **(Paper exercise)** A step runs `echo "$DEPLOY_TOKEN" | rev`. Will the reversed output be masked in the log? Explain why, referencing how masking actually matches.
5. **(Requires a GitHub repo)** Configure a wait timer (e.g., 1 minute) instead of required reviewers on the `production` Environment. Trigger a run and confirm the job pauses for the configured duration even with no reviewer action needed.

## Interview Q&A

**Q: Your team wants production deploys to require a manager's sign-off before any credentials are touched. How do you set that up?**
A: A GitHub Environment named `production` with required reviewers configured, a job that sets `environment: production`, and the production credentials stored as secrets scoped to that Environment specifically — so the approval gate and the credential access are the same event, not two controls that could drift apart.

**Q: Is it safe to log a secret as long as GitHub Actions masks secrets in logs?**
A: No. Masking is a literal string match; anything that transforms the secret before printing (base64, reversal, splitting) bypasses the mask entirely.

**Q: What's the difference between a repository secret and an environment secret, beyond just scope?**
A: An environment secret is the only one of the three tied to an approval gate (required reviewers, wait timer) — it's the right choice when a credential's exposure should require human sign-off, not just workflow permission.

**Q: A job declares `environment: production` with required reviewers. When are the Environment's secrets actually fetched?**
A: Only after the gate clears — no environment-scoped secret is fetched until every required reviewer approves or the wait timer elapses.

**Q: Can an organization secret be restricted to specific repositories?**
A: Yes — it can be scoped to "all repositories" or a specific selected list; a workflow in an unlisted repo sees it as unset, not as an error.
