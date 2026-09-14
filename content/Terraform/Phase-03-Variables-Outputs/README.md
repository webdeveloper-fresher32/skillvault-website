# Phase 3: Variables & Outputs

## What You'll Learn

Stop hardcoding values into your Terraform configurations. Learn how to parameterize
configurations with input variables (with type constraints, defaults, and validation), expose
data from a configuration with output values, and keep expressions DRY with locals. By the end
of this phase you'll be able to write a module that behaves differently per environment
(dev/staging/prod) without touching a single line of resource code.

## Learning Objectives

- Declare and use `variable` blocks with type constraints (string, number, bool, list, map,
  object, set) and sensible defaults
- Validate variable input with `validation` blocks and mark sensitive variables
- Set variable values via CLI flags, `.tfvars` files, and environment variables, and know the
  precedence order between them
- Declare `output` blocks to expose values to users, CI/CD pipelines, and other configurations
- Mark outputs as sensitive and consume outputs across configurations with
  `terraform_remote_state`
- Use `locals` to compute derived values once and reuse them everywhere, and know when a local
  beats a variable or a data source

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Input-Variables.md](01-Input-Variables.md) | variable blocks, type constraints, defaults, validation, sensitive variables, setting values (CLI/.tfvars/env), precedence | 2 days |
| [02-Output-Values.md](02-Output-Values.md) | output blocks, sensitive outputs, `-json` output, remote state outputs, common mistakes | 1 day |
| [03-Locals.md](03-Locals.md) | locals blocks, locals vs variables vs data sources, computed locals, organizing locals | 1 day |

## Estimated Time

4 days

## Prerequisites

- [Phase 1: Fundamentals](../Phase-01-Fundamentals/README.md)
- [Phase 2: Resources & Providers](../Phase-02-Resources-Providers/README.md)

## Next Phase

→ Phase 4: State Management
