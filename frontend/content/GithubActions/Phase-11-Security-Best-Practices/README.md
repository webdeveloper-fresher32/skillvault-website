# Phase 11: Security Best Practices

## What You'll Learn

Every prior phase built things that work. This phase asks the harder question: what happens when something in the pipeline is hostile — a malicious pull request, a compromised third-party action, a leaked credential? Phase 2 already flagged one crack (`pull_request_target` handing untrusted code a trusted token), Phase 8 flagged another (a moving version tag that can be silently repointed), and Phase 10 previewed a fix for a third (long-lived cloud credentials sitting in secrets). This phase closes all three: scoping the `GITHUB_TOKEN` itself down to least privilege, replacing long-lived cloud credentials with short-lived OIDC-issued tokens, pinning third-party actions to immutable commit SHAs with Dependabot keeping them current, and verifying — via signed provenance — that a built artifact actually came from the workflow run it claims to.

## Learning Objectives

- Scope the auto-generated `GITHUB_TOKEN` to least privilege with a `permissions:` block, understanding the difference between read/write per-resource permissions and why a broad default is dangerous specifically on `pull_request_target`-triggered workflows
- Authenticate to a cloud provider via OpenID Connect (OIDC) instead of storing long-lived access keys as secrets, including the `id-token: write` permission and the cloud-side trust policy that scopes which repo/branch may assume a role
- Pin third-party actions to a full commit SHA rather than a mutable tag, and configure Dependabot to keep those SHA pins current automatically via the `# vX.Y.Z` comment convention
- Understand SLSA provenance basics and use `actions/attest-build-provenance` to generate verifiable, signed attestation that an artifact came from a specific workflow run — and know what that attestation does and does not prove

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-GITHUB-TOKEN-Permission-Scoping.md](01-GITHUB-TOKEN-Permission-Scoping.md) | The `GITHUB_TOKEN`'s default permissions, scoping via `permissions:` at workflow or job level, read/write per-resource permissions (`contents`, `packages`, `pull-requests`, etc.), the `pull_request_target` privilege-escalation risk from Phase 2 | 1 day |
| [02-OIDC-for-Cloud-Authentication.md](02-OIDC-for-Cloud-Authentication.md) | OIDC token issuance for cloud authentication without stored long-lived credentials, the `id-token: write` permission, configuring a cloud-side trust policy scoped to a specific repo/branch, the OIDC pattern previewed in Phase 10 | 1 day |
| [03-Pinning-Actions-and-Dependabot.md](03-Pinning-Actions-and-Dependabot.md) | Pinning third-party actions to a full commit SHA instead of a mutable tag, the `# vX.Y.Z` comment convention Dependabot parses, configuring `dependabot.yml` for the `github-actions` ecosystem, the moving-tag trust trade-off from Phase 8 | 1 day |
| [04-SLSA-and-Supply-Chain-Attestation.md](04-SLSA-and-Supply-Chain-Attestation.md) | SLSA framework basics (provenance), generating and verifying signed build provenance with `actions/attest-build-provenance`, why post-build tamper detection is a distinct threat model from source review or dependency scanning | 1 day |

## Estimated Time

4 days

## Next Phase

→ [Phase 12: Self-Hosted Runners and Enterprise Governance](../Phase-12-Self-Hosted-Runners-and-Enterprise-Governance/README.md)
