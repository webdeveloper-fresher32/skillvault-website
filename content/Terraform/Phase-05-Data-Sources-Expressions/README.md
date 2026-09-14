# Phase 05 - Data Sources & Expressions

## Overview

This phase covers how Terraform reads infrastructure it doesn't manage, and how HCL computes
values from other values. You'll learn to query existing AWS infrastructure with `data` blocks,
write expressions and use Terraform's built-in function library, and express conditional and
repeated logic with ternaries, `for` expressions, `for_each`, and `count` — the building blocks
that make configurations dynamic instead of hard-coded. By the end of this phase you'll be able to
reference infrastructure owned by other teams, transform collections into the shapes resources
expect, and conditionally create resources based on variables.

## Learning Objectives

By completing this phase you will be able to:

- Explain why data sources exist and when to use them instead of resources
- Write `data` blocks to query AWS for AMIs, Availability Zones, VPCs, and subnets
- Understand when a data source is read during `plan` versus deferred to `apply`
- Write HCL expressions using references, operators, string interpolation, and conditionals
- Use Terraform's built-in functions across string, numeric, collection, encoding, and filesystem categories
- Use splat expressions to extract attributes from `count`-based resource instances
- Use `dynamic` blocks to generate a variable number of repeated nested blocks
- Write `for` expressions to transform lists and maps
- Choose correctly between `count` and `for_each` for resource iteration
- Combine conditionals with `for_each` to conditionally create resources or filter a collection

## Topics

| File | Topic | Estimated Time |
|------|-------|----------------|
| [01-Data-Sources.md](./01-Data-Sources.md) | Data sources - why they exist, `data` block syntax, data sources vs resources, common AWS data sources (`aws_ami`, `aws_availability_zones`, `aws_vpc`), dependency timing between plan and apply | 2 days |
| [02-Expressions-Functions.md](./02-Expressions-Functions.md) | Expression basics - references, operators, string interpolation; built-in function categories (string, numeric, collection, encoding, filesystem); splat expressions; dynamic blocks | 2 days |
| [03-Conditionals-For-Loops.md](./03-Conditionals-For-Loops.md) | Conditional (ternary) expressions; `for` expressions over lists and maps; `count` vs `for_each` for iteration; combining conditionals with `for_each` for optional resources | 2 days |

## Estimated Time

5 - 6 days

## Prerequisites

- Phase 02 - Resources & Providers (resource blocks, providers, the dependency graph)
- Phase 03 - Variables & Outputs (variable types, locals, outputs)
- Phase 04 - State Management (how Terraform tracks managed vs unmanaged infrastructure)

## Key Concepts Covered

- **Data source** - a read-only query against a provider's API for infrastructure this configuration doesn't own or manage
- **Dependency timing** - data sources with no in-flight resource dependency are read during `plan`; those depending on a resource created in the same apply are deferred until that resource exists
- **Expression** - any piece of HCL that resolves to a value: references, literals, operators, function calls, conditionals, `for` expressions
- **Built-in function** - part of Terraform's standard library (string, numeric, collection, encoding, filesystem, networking); HCL has no user-defined functions
- **Splat expression** - `resource[*].attribute`, shorthand for extracting one attribute from every instance of a `count`-based resource as a flat list
- **Dynamic block** - generates a variable number of repeated nested configuration blocks (like `ingress`) from a list or map
- **Conditional (ternary) expression** - `condition ? true_val : false_val`, HCL's only branching construct
- **`for` expression** - a declarative loop that produces a new list or map by transforming an input collection, optionally filtered with `if`
- **`count` vs `for_each`** - positional (index-based) versus keyed (name-based) resource iteration, and why keyed iteration avoids disruptive replacements when a middle item is removed

## What's Next

**Phase 06 - Modules** - packaging reusable Terraform configuration into modules, module inputs and outputs, versioning, and the module registry.
