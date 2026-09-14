# Phase 07 — Workspaces & Environments

> Terraform workspaces, multi-environment strategies, and environment-specific variable files.

**Estimated time:** 3–4 days &nbsp;|&nbsp; **Prerequisites:** Phase 3, Phase 4, Phase 6 &nbsp;|&nbsp; **Next:** Phase 8 — Meta-Arguments & Provisioners

---

## Topics

| File | Topic | Estimated Time |
|------|-------|---------------|
| `01-Terraform-Workspaces.md` | Terraform Workspaces — isolating state per environment within one configuration, `terraform workspace` commands, `terraform.workspace` interpolation, limitations | 1–2 days |
| `02-Multi-Environment-Strategies.md` | Multi-Environment Strategies — workspaces vs directory-per-environment vs separate repos, layout patterns, promoting changes across dev/staging/prod | 1–2 days |
| `03-Variable-Files-tfvars.md` | Variable Files (`.tfvars`) — auto-loaded files, explicit `-var-file` per environment, variable precedence order, keeping secrets out of tfvars | 1 day |

---

## Overview

This phase covers how to safely and repeatably manage the same Terraform configuration across
multiple environments — dev, staging, and prod — without duplicating code or applying the wrong
change to the wrong place. You'll learn Terraform's built-in workspace mechanism for isolating
state, the trade-offs between workspaces, directory-per-environment layouts, and separate
repositories, and how `.tfvars` files parameterize a configuration per environment while keeping
real secrets out of version control.

### 01 — Terraform Workspaces

Workspaces let one set of `.tf` files be applied multiple times against separate, independent
state files. This file covers:

- Why workspaces exist and the problem they solve (same config, isolated state)
- The `terraform workspace` command family: `new`, `list`, `select`, `show`, `delete`
- How workspaces map to state storage on the local backend and on S3
- Using the built-in `terraform.workspace` expression to vary resource arguments per environment
- The real limitations of workspaces — shared provider/backend config, no access control, no
  structural differences between environments

### 02 — Multi-Environment Strategies

Workspaces are only one of three common approaches to managing multiple environments. This file
covers:

- A full comparison of workspaces vs directory-per-environment vs separate repositories
- A concrete directory-per-environment layout with a shared module and per-environment backend
  configuration
- How to choose a strategy based on team size, compliance needs, and how different environments
  really are
- Promoting a validated change through dev → staging → prod in a controlled order
- The recurring mistakes that cause multi-environment incidents (wrong workspace/directory,
  staging drift, shared credentials across environments)

### 03 — Variable Files (`.tfvars`)

Environment-specific configuration values need a reliable place to live outside the reusable
`.tf` code. This file covers:

- Why `.tfvars` files exist and how they replace long chains of `-var` flags
- `.tfvars` (HCL) vs `.tfvars.json`, and when the JSON variant is appropriate
- Auto-loaded files — `terraform.tfvars` and `*.auto.tfvars` — versus files that require an
  explicit `-var-file` flag
- The full variable precedence order, from `default` values up through CLI `-var` flags
- Why real secrets must never live in a `.tfvars` file, even with `sensitive = true`, and where
  they belong instead (previewed here, covered fully in Phase 10)

---

## Prerequisites

Before starting this phase, you should be comfortable with:

- Declaring and setting input variables, including `.tfvars`-style values and precedence basics
  (Phase 3 — Variables & Outputs)
- How Terraform state works, what it stores, and local vs remote backends (Phase 4 — State
  Management)
- Writing and calling reusable modules (Phase 6 — Modules)

---

## Next Phase

**Phase 8 — Meta-Arguments & Provisioners** builds on this phase's environment-parameterization
patterns to cover `count`, `for_each`, `depends_on`, lifecycle rules, and provisioners for
bootstrapping resources at create time.
