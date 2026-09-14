# Phase 8: Meta-Arguments & Provisioners

## What You'll Learn

Go beyond single, static resource blocks. Master Terraform's iteration meta-arguments (`count`,
`for_each`), explicit dependency and lifecycle control, and the last-resort escape hatch of
provisioners — including when to avoid them entirely in favor of cloud-native alternatives.

## Learning Objectives

- Create multiple similar resources from one block using `count` and `for_each`, and choose the
  right one based on whether items can be removed from the middle of the collection
- Safely refactor a `count`-based resource to `for_each` using `terraform state mv` or `moved` blocks
- Use explicit `depends_on` for real ordering requirements that aren't visible as attribute references
- Control resource replacement and drift behavior with the `lifecycle` block
  (`create_before_destroy`, `prevent_destroy`, `ignore_changes`, `replace_triggered_by`)
- Understand what provisioners (`local-exec`, `remote-exec`) are, why HashiCorp calls them a last
  resort, and when `user_data` or a configuration management tool is the better choice

## Prerequisites

- [Phase 2: Resources & Providers](../Phase-02-Resources-Providers/README.md)
- [Phase 4: State Management](../Phase-04-State-Management/README.md)

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Count-For-Each.md](01-Count-For-Each.md) | `count` and `count.index`, `for_each` over sets/maps, `count` vs `for_each`, safe migration with `state mv`/`moved` blocks | 1.5 days |
| [02-Depends-On-Lifecycle.md](02-Depends-On-Lifecycle.md) | Explicit `depends_on`, the `lifecycle` block, `create_before_destroy` vs default destroy-then-create | 1 day |
| [03-Provisioners.md](03-Provisioners.md) | `local-exec`/`remote-exec`, provisioners vs `user_data` vs config management, `on_failure`, `when = destroy` | 0.5 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 9: Terraform Cloud & Remote Backends](../Phase-09-Terraform-Cloud-Remote-Backends/README.md)
