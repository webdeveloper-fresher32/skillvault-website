# Phase 2: Resources & Providers

## What You'll Learn

Move past "hello world" and start describing real infrastructure. Learn the anatomy of a resource
block, how to address resources and their attributes from elsewhere in your configuration, how
providers work as plugins and how to configure and authenticate them (including multi-region and
multi-account setups), and how Terraform figures out the correct order to create, update, and
destroy resources through its dependency graph.

## Learning Objectives

- Write correct `resource` blocks and understand resource type, local name, and arguments
- Address resources and their attributes (`resource_type.name.attribute`) to pass real,
  only-known-at-apply-time values between resources
- Tell the difference between an argument (input) and an attribute (output), and read Terraform
  Registry documentation efficiently
- Understand the provider plugin architecture and configure `required_providers` and version
  constraints (`~>`, `>=`, exact pins)
- Configure multiple provider instances with aliases for multi-region and multi-account setups
- Understand the AWS credential resolution chain and use the provider plugin cache
- Understand implicit vs explicit (`depends_on`) dependencies, read `terraform graph` output, and
  reason about parallelism and common dependency mistakes (cycles, missing `depends_on`)

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Resource-Blocks.md](01-Resource-Blocks.md) | Resource block anatomy, resource addressing, implicit/explicit dependency preview, reading Registry docs, argument vs attribute | 2 days |
| [02-Providers-Provider-Configuration.md](02-Providers-Provider-Configuration.md) | Provider plugin architecture, `required_providers`, version constraints, aliases (multi-region/multi-account), authentication methods, plugin cache | 2 days |
| [03-Resource-Dependencies.md](03-Resource-Dependencies.md) | Implicit dependencies, `depends_on`, the dependency graph, `terraform graph`, parallelism during apply, common dependency mistakes | 1-2 days |

## Estimated Time

5-6 days

## Prerequisites

- [Phase 1: Fundamentals](../Phase-01-Fundamentals/README.md)

## Next Phase

→ [Phase 3: Variables & Outputs](../Phase-03-Variables-Outputs/README.md)
