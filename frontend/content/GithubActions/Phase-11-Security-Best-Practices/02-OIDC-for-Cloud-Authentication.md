# OIDC for Cloud Authentication

Phase 10, Lesson 2 deployed to a Kubernetes cluster and flagged, without fully explaining, that "short-lived tokens obtained via OIDC federation avoid storing any long-lived cluster credential as a secret at all." That problem applies just as directly to any cloud provider a workflow needs to authenticate against — AWS, Azure, GCP, or a Kubernetes cluster's own identity provider. The conventional approach stores a cloud access key or service-account key as a repository secret and injects it into every run that needs cloud access; that key is valid indefinitely, works from anywhere it's presented, and is only as safe as every place it's ever been pasted, logged, or copied. OpenID Connect (OIDC) authentication solves this by never storing a cloud credential at all: the workflow requests a short-lived, cryptographically signed identity token from GitHub itself, and the cloud provider is configured to trust that token — scoped to a specific repository and branch — well enough to hand back temporary, expiring credentials of its own.

## 1. How OIDC Token Issuance Works

The job requests an OIDC token, which requires the `id-token: write` permission — off by default, the same as every non-`contents` permission (Lesson 1). GitHub's OIDC provider then issues a signed JSON Web Token (JWT) scoped to that specific run. The token's claims include the repository (`repo:my-org/my-repo`), the ref or branch, and — if the job runs under one — the GitHub Environment name. This token is minted fresh per job and expires shortly after.

```
Job requests OIDC token (needs id-token: write)
        │
        ▼
GitHub's OIDC provider signs a JWT
  claims: repo, ref/branch, environment
        │
        ▼
Workflow presents JWT to cloud provider's login action
        │
        ▼
Cloud-side trust policy checks the JWT's claims  ◄── enforcement happens HERE
        │
        ▼
Cloud provider issues short-lived, temporary credentials
```

## 2. Configuring Cloud-Side Trust

The workflow presents the JWT to the cloud provider, typically via a provider-specific action (`aws-actions/configure-aws-credentials`, Azure's `azure/login`, or GCP's `google-github-actions/auth`), naming which role or identity to assume — no access key or client secret is passed anywhere in this step. The cloud provider then validates the JWT against a trust relationship configured ahead of time on the cloud side — for AWS, an IAM role's trust policy naming GitHub's OIDC provider as a trusted issuer, with a condition restricting which `sub` claim (the repo/branch/environment string) is allowed to assume that role.

**This cloud-side trust policy is what actually enforces access restriction — not GitHub.** GitHub will sign a valid-looking token for *any* repository's workflow that requests one; it is entirely the cloud-side trust policy's job to reject every token except the ones matching the exact repo and branch (or Environment) it names. The cloud provider then hands back short-lived, temporary credentials (an AWS STS session token, for instance) scoped to whatever permissions the assumed role itself carries, expiring automatically at the end of their validity window.

## 3. The `id-token: write` Permission

```yaml
name: Deploy to AWS via OIDC

on:
  push:
    branches:
      - main

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: us-east-1

      - name: Deploy
        run: aws s3 sync ./dist s3://my-app-bucket --delete
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

`permissions: id-token: write` is what allows this job to request an OIDC token at all — it follows the exact same deny-by-default model as `contents` or `packages` from Lesson 1. No `aws-access-key-id` or `aws-secret-access-key` appears anywhere — `role-to-assume` names an IAM role whose trust policy (configured separately, on the AWS side) is what actually decides whether *this* repository, on *this* branch, running under the `production` Environment, is allowed to assume it. A job that never declares `id-token: write` simply cannot request a token, and the failure surfaces as an authentication error at the credential-configuration step, not at workflow-parse time.

## Comparison

| Aspect | Long-lived stored secret | OIDC-issued credential |
|---|---|---|
| Lifetime | Indefinite, until manually rotated | Minted per run, expires in minutes-to-an-hour |
| What enforces access scope | Whatever policy is attached to the stored key | The cloud-side trust policy's claim-matching |
| Leak exposure window | Potentially unlimited | Narrow, self-closing |
| Where it's stored | GitHub Actions secret | Nowhere — requested fresh each run |
| Trust policy scoped to specific repo+branch | N/A (key works from anywhere it's presented) | Restricts which workflow runs can assume the role |
| Trust policy scoped to entire org / wildcard branch | N/A | Any repo/branch in that org can assume the role — defeats the benefit |

## Common Mistakes

- **Forgetting the `id-token: write` permission.** Without it, the OIDC token request fails outright — usually the first error a team hits when trying OIDC for the first time, and it's a permissions problem, not a cloud-side configuration problem.
- **Configuring the cloud-side trust policy too broadly** — trusting an entire GitHub organization, a wildcard repository pattern, or any branch, instead of the specific repository and branch (or Environment) that should be allowed to assume the role. This defeats the main security benefit of OIDC.
- **Scoping the trust policy to a branch but not an Environment, on a workflow with both staging and production jobs.** A `main`-branch condition alone doesn't distinguish which job on that branch is asking — pairing the trust condition with a specific GitHub Environment name (and gating that Environment per Phase 10, Lesson 3) narrows the match further.
- **Treating OIDC as eliminating the need for least-privilege IAM roles.** OIDC changes how a credential is obtained, not how much that credential can do once obtained — a role assumed via OIDC still needs its own permissions scoped down to exactly what the job requires.

## Hands-On Exercises

1. In a scratch AWS account, create an IAM OIDC identity provider for `token.actions.githubusercontent.com` and an IAM role whose trust policy's `sub` condition matches `repo:<your-org>/<your-repo>:ref:refs/heads/main`.
2. Add the example workflow from Section 3 to that repository, run it on `main`, and confirm `aws-actions/configure-aws-credentials` succeeds without any `aws-access-key-id` secret configured.
3. Remove `id-token: write` from the `permissions:` block, re-run the workflow, and confirm the credential-configuration step now fails with an authentication error rather than at workflow-parse time. Restore the permission afterward.
4. With `id-token: write` restored, push the same workflow to a different branch (not `main`) and confirm the role assumption still fails — this time with a trust-policy rejection rather than a missing-permission error, demonstrating that the trust policy's `sub` condition — not GitHub — is what rejected it.
5. (Prerequisite: Phase 10, Lesson 3) Widen the trust policy's condition to match the entire GitHub organization instead of one repo, and confirm a second, unrelated repository in the same org can now assume the same role — then narrow it back and reconfirm the second repository is rejected.

## Interview Q&A

**Q: Why is OIDC considered more secure than storing an AWS access key as a GitHub secret?**
A: No long-lived credential exists to leak in the first place, and the token GitHub issues is scoped per-run and short-lived — even if a run's token were somehow exposed, it's only useful for a narrow window and only for whatever a correctly-scoped trust policy already permits.

**Q: What actually stops a different repository in the same GitHub organization from assuming a role via OIDC?**
A: Nothing on GitHub's side stops it. The enforcement is entirely the cloud-side trust policy's `sub`-claim condition — which is why writing that condition precisely (specific repo, specific branch or Environment) matters as much as enabling OIDC in the first place.

**Q: Does GitHub restrict which repositories can obtain a valid-looking OIDC token for a given role?**
A: No — GitHub will sign a token for any repository's workflow that requests one. Restriction is the cloud provider's job, enforced by the trust policy attached to the role being assumed.

**Q: A team enables OIDC for AWS but still leaves the assumed IAM role with `AdministratorAccess`. What's still wrong?**
A: OIDC only changes how the credential is obtained, not what it can do once obtained. The role itself needs least-privilege permissions scoped to exactly what the deploy job requires — OIDC and IAM scoping are separate, both-required controls.
