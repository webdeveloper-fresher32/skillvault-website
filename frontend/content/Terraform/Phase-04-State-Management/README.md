# Phase 04 - State Management

## Overview

This phase covers Terraform state — the JSON record that maps your configuration's resource
blocks to the real objects they created in a provider. You'll learn why state exists, what's
inside `terraform.tfstate`, the risks of keeping it local, how to move it to a shared remote
backend with proper locking, and the safe toolkit (`terraform state`, `terraform import`,
`force-unlock`) for manipulating state without hand-editing JSON. By the end of this phase you
will be able to design and troubleshoot state management for a team working against shared AWS
infrastructure.

## Learning Objectives

By completing this phase you will be able to:

- Explain why Terraform needs state at all, and what breaks without it
- Read and interpret the JSON structure of `terraform.tfstate`
- Distinguish config (desired state), state (Terraform's cached belief), and real infrastructure,
  and explain how drift is detected between them
- Identify the risks of local state for a team and recognize why remote state is a day-one
  requirement, not an optional upgrade
- Configure an S3 backend with DynamoDB locking, including bucket/table bootstrapping and IAM
  hardening
- Migrate an existing project from local to remote state safely
- Use partial backend configuration to support multiple environments without hardcoding secrets
- Explain how DynamoDB's conditional writes implement state locking
- Use `terraform state list/show/mv/rm/pull/push` to manipulate state safely
- Import an existing, unmanaged AWS resource into Terraform with `terraform import`
- Recover from a stuck state lock safely using `terraform force-unlock`

## Topics

| File | Topic | Estimated Time |
|------|-------|----------------|
| [01-Terraform-State-Deep-Dive.md](./01-Terraform-State-Deep-Dive.md) | Why state exists, anatomy of `terraform.tfstate`, state vs. real infra and drift, local state risks, sensitive data in state | 2 days |
| [02-Remote-State-Backends.md](./02-Remote-State-Backends.md) | Why remote state, backend types compared, S3 + DynamoDB backend configuration, backend migration, partial configuration | 2 days |
| [03-State-Locking-Terraform-State-Commands.md](./03-State-Locking-Terraform-State-Commands.md) | Why state locking exists, how DynamoDB locking works, `terraform state` subcommands, `terraform import`, `force-unlock` | 2 days |

## Estimated Time

5 - 6 days

## Prerequisites

- Phase 01 - Fundamentals (Terraform workflow: init, plan, apply, destroy)
- Phase 02 - Resources & Providers (resource blocks, provider configuration)
- Phase 03 - Variables & Outputs (variables, outputs, `sensitive` flag)
- An AWS account (or sandbox) for hands-on backend and import exercises
- AWS CLI installed and configured, for inspecting S3/DynamoDB directly during exercises

## Key Concepts Covered

- **State file** - the JSON manifest mapping resource addresses to real-world object attributes
- **Drift** - divergence between state's cached belief and real infrastructure, detected via
  refresh
- **Local vs. remote state** - single point of failure vs. shared, lockable, durable storage
- **Backends** - `local`, `s3`, `azurerm`, `gcs`, and Terraform Cloud/Enterprise's `cloud` block
- **State locking** - preventing concurrent applies from corrupting state, via DynamoDB
  conditional writes or native backend locking
- **Partial backend configuration** - supplying environment-specific backend values at `init`
  time instead of hardcoding them in HCL
- **`terraform state` subcommands** - `list`, `show`, `mv`, `rm`, `pull`, `push`
- **`terraform import`** - bringing existing, unmanaged resources under Terraform's control
- **`force-unlock`** - safely recovering from a stuck lock left by a crashed operation

## What's Next

**Phase 05 - Data Sources & Expressions** - reading existing infrastructure with data sources,
and Terraform's expression language (conditionals, `for` expressions, functions) for building
dynamic configuration.
