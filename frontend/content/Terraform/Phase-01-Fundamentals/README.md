# Phase 1: Terraform Fundamentals

## What You'll Learn

Understand what Infrastructure as Code is, why it exists, and where Terraform fits among the
other IaC and configuration management tools. Get Terraform and AWS credentials set up, and run
the full create → inspect → destroy workflow against real AWS infrastructure for the first time.

## Learning Objectives

- Explain what Infrastructure as Code is and the ClickOps problem it solves
- Distinguish declarative from imperative IaC, and Terraform from Ansible, CloudFormation, and Pulumi
- Understand Terraform's architecture: Core, providers, and state
- Install Terraform and configure AWS credentials
- Run `terraform init`, `plan`, `apply`, and `destroy` against a real AWS resource
- Read and reason about `terraform plan` output, including forced replacements
- Read and write basic HCL: blocks, arguments, expressions, comments
- Understand idempotency and why it makes Terraform safe to re-run

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-What-is-Terraform-IaC.md](01-What-is-Terraform-IaC.md) | IaC concepts, declarative vs imperative, Terraform vs Ansible/CloudFormation/Pulumi, Terraform architecture | 1 day |
| [02-Installation-Setup.md](02-Installation-Setup.md) | Installing Terraform, AWS credentials, first `terraform init`, editor tooling | 1 day |
| [03-Terraform-Workflow-Core-Concepts.md](03-Terraform-Workflow-Core-Concepts.md) | Core workflow walkthrough, reading `plan` output, HCL syntax basics, file layout conventions, idempotency | 1 day |

## Estimated Time

3 days

## Next Phase

→ Phase 2: Providers & Resources
