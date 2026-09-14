# Phase 11: Testing & CI/CD

Validation tooling, automated testing frameworks, and GitOps-style CI/CD pipelines for
Terraform — turning infrastructure changes from ad hoc laptop applies into a reviewed,
auditable, automated process.

## Topics

| File | Topic | Estimated Time |
|------|-------|---------------|
| 01-Validate-Plan-Review.md | `terraform fmt`/`validate`, static analysis (tflint, tfsec, checkov), reading and reviewing a `terraform plan` in a PR | 2 days |
| 02-Terraform-Test-Framework.md | Native `terraform test` framework (`.tftest.hcl`, run blocks, mock providers), Terratest as an alternative | 2 days |
| 03-CICD-Integration-GitOps.md | GitOps model, full GitHub Actions plan/apply workflows, manual approval gates, scheduled drift detection | 2 days |

## Estimated Time

6 days

## Key Concepts

- **Validation Pipeline** — `terraform fmt` and `terraform validate` as the fast, offline first
  line of defense before anything touches a cloud API
- **Static Analysis** — tflint for Terraform/provider correctness, tfsec and checkov for security
  and compliance scanning against known-risky patterns
- **Plan Review** — reading plan symbols (`+`, `~`, `-`, `-/+`), spotting forced replacements, and
  posting plan output directly into pull requests so reviewers see the concrete effect of a change
- **Native Testing** — `.tftest.hcl` files, `run` blocks with `plan`/`apply` commands, `assert`
  conditions, and `mock_provider` for apply-time verification without real cloud resources
- **Terratest** — Go-based integration testing against real, deployed infrastructure for
  end-to-end runtime verification native tests can't provide
- **GitOps Model** — Git as the single source of truth, PR triggers plan, merge triggers apply,
  with separate IAM roles per pipeline stage
- **Manual Approval Gates** — GitHub Environments requiring human sign-off on the exact reviewed
  plan before a production apply runs
- **Drift Detection** — scheduled, plan-only CI jobs that catch out-of-band manual changes before
  they cause a confusing surprise during the next real apply

## Next Phase

Phase 12: Production Best Practices
