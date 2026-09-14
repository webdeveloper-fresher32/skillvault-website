# Phase 10: Security & Secrets

Terraform security fundamentals covering sensitive variable handling, state file exposure risks,
state encryption and access control, secrets manager integration (Vault, AWS Secrets Manager, SSM
Parameter Store), and IAM least-privilege design for the Terraform execution role.

## Topics

| File | Topic | Estimated Time |
|------|-------|---------------|
| 01-Sensitive-Variables-State-Security.md | `sensitive = true`, why state still holds plaintext secrets, encrypting state at rest, restricting state access | 2 days |
| 02-Secrets-Management-Vault-Integration.md | Vault provider, AWS Secrets Manager / SSM Parameter Store, full worked example | 2 days |
| 03-IAM-Least-Privilege.md | Scoped IAM policies for Terraform CI, per-environment roles, OIDC federation for CI/CD | 2 days |

## Estimated Time

5-6 days

## Key Concepts

- **Sensitive Value Redaction** - Marking variables/outputs `sensitive = true` to hide them from CLI plan/apply output
- **State File Exposure** - Understanding why Terraform state always contains plaintext secrets, regardless of variable sensitivity
- **State Encryption & Access Control** - S3 SSE/KMS, Terraform Cloud encryption, bucket policies, and team permissions
- **Secrets Management** - Fetching secrets at apply time from Vault, AWS Secrets Manager, or SSM Parameter Store instead of hardcoding them
- **IAM Least Privilege** - Scoping the Terraform execution role's permissions to exactly what its configurations manage
- **OIDC Federation** - Replacing long-lived CI access keys with short-lived, auto-expiring credentials

## Next Phase

Phase 11: Testing & CI/CD
