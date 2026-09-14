# Phase 6: Modules

## What You'll Learn

Stop copy-pasting infrastructure across environments. Package reusable, parameterized bundles of
Terraform configuration into modules — write a pattern once (a VPC, a database, a compute
cluster) and call it from dev, staging, and production with different inputs. Learn how to
design clean module interfaces, compose multiple modules together into a full stack, and consume
versioned modules from the public and private Terraform Registry.

## Learning Objectives

- Understand why modules exist and how they eliminate duplicated infrastructure code
- Write the `module` block syntax correctly: source, version, inputs, and meta-arguments
- Pass variables into modules and read outputs back out, including chaining modules together
- Follow the standard module file structure (`main.tf` / `variables.tf` / `outputs.tf` / `README.md`)
- Compose multiple modules into a complete stack (network → compute → database → DNS)
- Apply module design principles: single responsibility, sensible defaults, avoiding over-parameterization
- Understand nested modules and the visibility rules across module boundaries
- Use community modules from the public Terraform Registry (e.g. `terraform-aws-modules/vpc/aws`)
- Distinguish module source types (registry, Git, local path, HTTP archive) and choose correctly
- Apply semantic version constraints (`~>`, `>=`, exact pins) to keep module upgrades intentional

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Module-Basics.md](01-Module-Basics.md) | Why modules, root vs child modules, module block syntax, variables/outputs, standard file structure | 2 days |
| [02-Module-Composition-Best-Practices.md](02-Module-Composition-Best-Practices.md) | Composing multiple modules, design principles, nested modules, outputs as cross-module glue, anti-patterns | 2 days |
| [03-Module-Registry-Versioning.md](03-Module-Registry-Versioning.md) | Public/private registries, module source types, version constraints | 2 days |

## Estimated Time

1 week

## Prerequisites

Phases 1–5 (Fundamentals, Resources & Providers, Variables & Outputs, State Management, Data
Sources & Expressions)

## Next Phase

→ [Phase 7: Workspaces & Environments](../Phase-07-Workspaces-Environments/README.md)
