# Phase 09 — Terraform Cloud & Remote Backends

> Moving from local-only Terraform to a managed control plane — remote execution, team collaboration, and policy-as-code governance with Terraform Cloud.

---

## Overview

This phase covers Terraform Cloud (and its self-hosted sibling, Terraform Enterprise) — HashiCorp's managed platform for running Terraform as a team rather than as a collection of individuals with their own state files and credentials. It walks through the organization/workspace/run hierarchy, remote execution mode and the `cloud` block, the full run lifecycle (plan, cost estimate, policy check, approval, apply), team-based access control, and cross-workspace collaboration via notifications and run triggers. It closes with Sentinel and Open Policy Agent (OPA), the two policy-as-code engines used to make governance rules machine-enforced instead of documentation-based.

By the end of this phase you will be able to migrate a local or S3-backed configuration to Terraform Cloud, connect a workspace to a VCS repository for PR-driven plans, design a team permission model for a multi-workspace organization, wire dependent workspaces together with run triggers, and write and attach a basic Sentinel or OPA policy to block non-compliant infrastructure changes before they apply.

---

## Topics

| # | File | Topic | Estimated Time |
|---|------|-------|---------------|
| 1 | `01-Terraform-Cloud-Overview.md` | Why Terraform Cloud, core concepts (Organizations/Workspaces/Runs), tiers, VCS integration | 1 day |
| 2 | `02-Remote-Execution-Collaboration.md` | Remote execution mode, the `cloud` block, run lifecycle, team permissions, run triggers | 1.5 days |
| 3 | `03-Sentinel-Policy-as-Code.md` | Policy as code, Sentinel basics and enforcement levels, example policies, OPA as an alternative | 0.5 day |

---

## What You Will Learn

### 01 — Terraform Cloud Overview
- The collaboration problems Terraform Cloud solves: state locking, run history, access control
- The Organization → Workspace → Run hierarchy
- Free vs. paid tier feature gating
- Connecting a VCS repository (GitHub/GitLab/Bitbucket) to a workspace for PR-driven plans

### 02 — Remote Execution & Collaboration
- Local execution vs. remote execution mode, and what actually moves to TFC's infrastructure
- Configuring the `cloud` block (replacing the traditional `backend` block)
- The full run lifecycle: plan → cost estimate → policy check → approval → apply
- Team-based RBAC (Read/Plan/Write/Admin) assigned per team, per workspace
- Notifications (Slack, email, webhooks) and run triggers between dependent workspaces

### 03 — Sentinel & Policy as Code
- Why policy as code replaces documentation-based governance at scale
- Sentinel policy sets and the three enforcement levels: advisory, soft-mandatory, hard-mandatory
- Writing example policies against `tfplan/v2` (restricting instance types, requiring tags)
- Open Policy Agent (OPA) and Rego as a vendor-neutral alternative, and how it integrates via run tasks or CI

---

## Estimated Time

**3 days**

---

## Prerequisites

Complete the following phases before starting:

- Phase 01 — Fundamentals
- Phase 02 — Resources & Providers
- Phase 03 — Variables & Outputs
- Phase 04 — State Management
- Phase 07 — Workspaces & Environments

A free Terraform Cloud account (app.terraform.io) is required for the hands-on exercises in this phase.

---

## Up Next

**Phase 10 — Security & Secrets**

Covers sensitive variable handling, HashiCorp Vault integration, IAM least-privilege patterns, and state file security.

---

## Quick Reference

```hcl
# Bind a configuration to Terraform Cloud
terraform {
  cloud {
    organization = "acme-platform-team"

    workspaces {
      name = "app-prod"
    }
  }
}
```

```bash
# Authenticate the CLI against Terraform Cloud
terraform login

# Plan/apply now execute remotely once the cloud block is configured
terraform init
terraform plan
terraform apply
```

```python
# Minimal Sentinel policy skeleton
import "tfplan/v2" as tfplan

violations = filter tfplan.resource_changes as _, rc {
    rc.type is "aws_instance" and
    rc.change.after.instance_type not in ["t3.micro", "t3.small"]
}

main = rule {
    length(violations) is 0
}
```

---

*Terraform Learning Path — Phase 09 of 12*
