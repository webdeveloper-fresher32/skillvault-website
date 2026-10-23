# 03 — Conditionals & For Loops

## Table of Contents

1. [Conditional Expressions](#1-conditional-expressions)
2. [`for` Expressions](#2-for-expressions)
3. [`for_each` vs `count` for Iteration](#3-for_each-vs-count-for-iteration)
4. [Combining Conditionals with `for_each` for Optional Resources](#4-combining-conditionals-with-for_each-for-optional-resources)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Conditional Expressions

You need an EC2 instance type that's `t3.large` in production and `t3.micro` everywhere else. Or a
`monitoring_enabled` flag that should only be `true` when the environment is prod. You don't have
`if`/`else` statements in HCL — there's no imperative branching construct — so how do you make a
value depend on a condition? HCL borrows a pattern straight out of C-family languages: the
**ternary conditional expression**.

### Analogy

A conditional expression is like ordering at a fast-food counter with a single, fixed question:
"combo or à la carte?" There's no multi-step conversation — you answer one yes/no question, and
based on that single answer, you get exactly one of two possible outcomes. No branching tree of
follow-up questions, just: condition, then this-or-that.

### Syntax

```hcl
condition ? true_value : false_value
```

- `condition` must evaluate to a `bool`.
- `true_value` and `false_value` should be the same type (or Terraform will attempt to convert one
  to match the other — inconsistent types across the two branches trigger an error).

### Concrete Example

```hcl
variable "environment" {
  type    = string
  default = "staging"
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = var.environment == "prod" ? "t3.large" : "t3.micro"

  monitoring = var.environment == "prod" ? true : false

  tags = {
    Name = var.environment == "prod" ? "prod-app-server" : "${var.environment}-app-server"
  }
}

# Conditionals also commonly drive count, for a resource that only exists sometimes
resource "aws_eip" "nat" {
  count = var.environment == "prod" ? 1 : 0
  vpc   = true
}
```

### Under the Hood

```
var.environment == "prod"   ──►  evaluates to bool  ──►  true or false
                                        │
                     ┌──────────────────┴──────────────────┐
                     ▼                                      ▼
                  true                                    false
                     │                                      │
                     ▼                                      ▼
          instance_type = "t3.large"          instance_type = "t3.micro"
```

Terraform evaluates the condition once per resource instance at plan time (or defers it if the
condition itself depends on an unresolved resource attribute — same deferred-evaluation rule as
everything else in this phase). Only the *chosen* branch's value is used; the other branch is
simply discarded, not "evaluated and then rejected."

### Common Confusion

A very frequent gotcha: **type mismatch between the two branches**. Writing
`var.env == "prod" ? "yes" : 0` mixes a string and a number across branches, and Terraform will
either coerce them into a common type (sometimes silently, sometimes not) or raise an error,
depending on how incompatible the types are. Keep both branches the same type — if you need `null`
in one branch, that's fine (many arguments accept `null` to mean "unset"), but don't mix `string`
and `number`/`bool` across branches.

Another common trap: using `count = condition ? 1 : 0` for optional resources and then forgetting
that referencing the resource elsewhere (`aws_eip.nat[0].id`) breaks the moment the count becomes
`0`, since index `0` no longer exists. Guard downstream references with the same conditional, or
use `one(aws_eip.nat[*].id)` to get either the single value or `null` safely.

### Interview Answer

"HCL has no `if`/`else` statement — it's declarative, not imperative — so branching logic is
expressed with the ternary conditional expression, `condition ? true_val : false_val`. It's
commonly used to size resources differently per environment, or combined with `count` to make an
entire resource conditionally exist (`count = var.create_eip ? 1 : 0`). Both branches must resolve
to compatible types, or Terraform raises a type error."

> **Memory hook:** No `if`/`else` in HCL — just one fast-food-counter question: "combo or à la carte?"

---

## 2. `for` Expressions

You have a list of subnet objects and you need just their CIDR blocks as a new list. Or you have a
list of usernames and need a map from username to a computed ARN. Looping in a general-purpose
language is trivial (`for x in list: ...`), but HCL has no statements, only expressions — so how do
you "loop" and produce a *new* collection as a *value*? That's exactly what a **`for` expression**
does: it's a loop that is itself an expression, producing a list or a map as its result.

### Analogy

A `for` expression is like a factory assembly line with a single machine at the end: raw materials
(the input collection) go in one end, each item passes through the same transformation step, and a
new, transformed product (the output list or map) comes out the other end. Nothing is mutated in
place — the input collection is untouched; a brand-new collection is produced.

### Syntax — List Output

```hcl
[for <item> in <collection> : <expression>]
[for <item> in <collection> : <expression> if <condition>]   # with filter
```

### Syntax — Map Output

```hcl
{for <item> in <collection> : <key_expr> => <value_expr>}
```

### Concrete Examples

```hcl
variable "subnets" {
  type = list(object({
    name       = string
    cidr_block = string
  }))
  default = [
    { name = "public-a",  cidr_block = "10.0.1.0/24" },
    { name = "public-b",  cidr_block = "10.0.2.0/24" },
    { name = "private-a", cidr_block = "10.0.101.0/24" },
  ]
}

locals {
  # List output: just the CIDR blocks
  all_cidrs = [for s in var.subnets : s.cidr_block]
  # -> ["10.0.1.0/24", "10.0.2.0/24", "10.0.101.0/24"]

  # List output WITH a filter: only "public" subnets
  public_cidrs = [for s in var.subnets : s.cidr_block if startswith(s.name, "public")]
  # -> ["10.0.1.0/24", "10.0.2.0/24"]

  # Map output: name -> cidr_block
  subnet_map = {for s in var.subnets : s.name => s.cidr_block}
  # -> { "public-a" = "10.0.1.0/24", "public-b" = "10.0.2.0/24", "private-a" = "10.0.101.0/24" }

  # Map output with transformation on the value
  subnet_sizes = {for s in var.subnets : s.name => cidrnetmask(s.cidr_block)}
}

resource "aws_subnet" "this" {
  for_each          = local.subnet_map
  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value
  tags              = { Name = each.key }
}
```

### Under the Hood

```
var.subnets (a LIST of 3 objects)
   │
   ▼
for s in var.subnets : s.name => s.cidr_block
   │
   ├── iteration 1:  s = {name="public-a",  cidr_block="10.0.1.0/24"}  → key="public-a",  val="10.0.1.0/24"
   ├── iteration 2:  s = {name="public-b",  cidr_block="10.0.2.0/24"}  → key="public-b",  val="10.0.2.0/24"
   └── iteration 3:  s = {name="private-a", cidr_block="10.0.101.0/24"}→ key="private-a", val="10.0.101.0/24"
   │
   ▼
{ "public-a" = "10.0.1.0/24", "public-b" = "10.0.2.0/24", "private-a" = "10.0.101.0/24" }
   ← a brand new MAP value; var.subnets itself is never mutated
```

### Common Confusion

People sometimes try to put side effects or multiple statements inside a `for` expression, as if it
were a real loop body (`for x in list { do_a(); do_b() }`) — that's not what this is. A `for`
expression is a single, pure transformation from one input collection to one output collection; it
has no statements, no side effects, only one expression per iteration. If you need multiple derived
values, write multiple separate `for` expressions (or build an object per iteration and destructure
it later).

### Interview Answer

"A `for` expression iterates over a list or map and produces a *new* list (with `[...]`) or map
(with `{...}`) by applying one expression per element — optionally filtered with a trailing `if`
clause. It's HCL's declarative equivalent of a loop: since HCL has no imperative statements, `for`
expressions let you transform one collection into another as a pure value, commonly used to build
the map that feeds into a `for_each` meta-argument on a resource."

> **Memory hook:** A `for` expression is an assembly line — raw materials in one end, one transformation step, a brand-new product out the other end. Nothing in the input is touched.

---

## 3. `for_each` vs `count` for Iteration

You've now seen `count = condition ? 1 : 0` and `for_each = local.subnet_map` both used to create
multiple resource instances. Which should you reach for, by default? This is one of the most asked
practical questions in real Terraform code review, because picking wrong causes painful,
destructive re-creates down the line. (Deep operational trade-offs — like what happens during
`terraform state mv` after switching between them — are covered in Phase 8; here we cover the
foundational decision.)

### Analogy

`count` is like numbering theater seats 1, 2, 3, 4, 5 — purely positional. If seat 3 (the person in
the *middle* of the row) leaves, everyone from seat 4 onward shuffles down one seat to close the
gap, changing everyone's seat number. `for_each` is like assigning seats by *name* on a place card
— if the person named "Priya" leaves, only Priya's seat is removed; every other named seat stays
exactly where it was, undisturbed.

### Comparison Table

| Aspect | `count` | `for_each` |
|---|---|---|
| **Input type** | A number | A map or a set of strings |
| **Instance addressing** | `resource.name[0]`, `[1]`, `[2]` (index-based) | `resource.name["key"]` (key-based) |
| **Removing a middle item** | Shifts every subsequent index down by one → **replaces** every instance after the removed one | Removes only that one keyed instance → **all others untouched** |
| **Reference inside the block** | `count.index` | `each.key`, `each.value` |
| **Good for** | Identical N copies of a resource (e.g., "N EC2 instances, all the same") | A collection of distinct, named things (e.g., one subnet per named AZ, one IAM user per named person) |
| **Duplicate values allowed in input?** | N/A (just a count) | No — map keys / set elements must be unique |
| **Typical source data** | `var.instance_count` (a plain number) | `var.subnet_map` (a map), or `toset(var.subnet_names)` |

### Concrete Example — Same Goal, Two Approaches

```hcl
# APPROACH A: count — fine for identical, unnamed copies
resource "aws_instance" "worker" {
  count         = 3
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t3.micro"
  tags          = { Name = "worker-${count.index}" }
}
# Removing worker[1] (the middle one) causes worker[2] to be destroyed and
# recreated as the new worker[1] — even though nothing about it changed!


# APPROACH B: for_each — safer when instances are conceptually distinct
resource "aws_instance" "worker" {
  for_each      = toset(["alpha", "beta", "gamma"])
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t3.micro"
  tags          = { Name = "worker-${each.key}" }
}
# Removing "beta" from the set destroys ONLY aws_instance.worker["beta"].
# "alpha" and "gamma" are completely untouched — no unnecessary replacement.
```

### Under the Hood

```
count = 3                                for_each = {"alpha"=.., "beta"=.., "gamma"=..}

State addresses:                         State addresses:
  worker[0]                                worker["alpha"]
  worker[1]                                worker["beta"]
  worker[2]                                worker["gamma"]

Remove the middle element:               Remove "beta":
  worker[0]  (unchanged)                   worker["alpha"]  (unchanged)
  worker[1]  ← WAS worker[2],               worker["gamma"] (unchanged)
              Terraform sees this as
              "destroy old [1], create
              new [1] with [2]'s config"   worker["beta"] simply removed —
                                            nothing else shifts
  worker[2]  ← removed
```

### Common Mistakes

- **Defaulting to `count` out of habit** for a set of conceptually distinct resources (one per
  environment, one per team, one per AZ). This is the single most common cause of unnecessary,
  disruptive resource replacement during routine list edits.
- **Passing a list (not a set/map) to `for_each` directly.** `for_each` requires a map or a *set*
  of strings — a plain `list(string)` must be converted with `toset()` first, otherwise Terraform
  raises an error about the argument type.
- **Duplicate values breaking `toset()`.** If your source list has duplicate strings,
  `toset(list)` silently deduplicates them — which may create fewer resources than you expected.
- **Mixing `count` and `for_each` on the same resource.** Not allowed — a resource block can use at
  most one of them.

### Interview Answer

"`count` addresses resource instances by numeric index, so removing or reordering an item in the
middle of the list shifts every subsequent index, causing Terraform to destroy and recreate
resources that didn't actually change. `for_each` addresses instances by a stable map key or set
value, so removing one instance affects only that one — everything else stays untouched. As a
default rule: use `count` for truly identical, interchangeable copies of a resource; use
`for_each` whenever the instances are conceptually distinct and individually named or keyed."

> **Memory hook:** `count` is numbered theater seats — remove the middle one, everyone shuffles down. `for_each` is name-card seats — remove one name, nobody else moves.

---

## 4. Combining Conditionals with `for_each` for Optional Resources

Real configurations often need something more nuanced than "always create N things" — they need
"create this resource only for the items in this list that meet some condition," or "create this
resource entirely, or not at all, based on a single boolean flag." You already know `count = cond ?
1 : 0` handles the whole-resource on/off switch. But what about "one NAT gateway per AZ, but only
in prod"? Combining a `for` expression's `if` filter with `for_each` gives you exactly that kind of
selective, keyed creation.

### Analogy

Think of a bouncer at a club with a guest list (the collection) and a dress code (the condition).
The bouncer doesn't let everyone in (`for_each` over the full list) or nobody in (`count = 0`) —
they walk the *named* list and only admit the guests who pass the dress code, each judged
individually, each still recognizable by name once inside.

### Pattern 1 — Whole Resource On/Off (recap, via `for_each` instead of `count`)

```hcl
variable "create_bastion" {
  type    = bool
  default = false
}

resource "aws_instance" "bastion" {
  for_each      = var.create_bastion ? toset(["bastion"]) : toset([])
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t3.micro"
}

# Reference safely elsewhere — works whether it exists or not:
output "bastion_ip" {
  value = try(aws_instance.bastion["bastion"].public_ip, null)
}
```

### Pattern 2 — Filter a Collection Down to a Subset

```hcl
variable "environments" {
  type = map(object({
    instance_type    = string
    enable_nat_gateway = bool
  }))
  default = {
    dev  = { instance_type = "t3.micro", enable_nat_gateway = false }
    prod = { instance_type = "t3.large", enable_nat_gateway = true }
  }
}

locals {
  # Only keep the environments that actually want a NAT gateway
  nat_envs = {for name, cfg in var.environments : name => cfg if cfg.enable_nat_gateway}
  # -> { "prod" = { instance_type = "t3.large", enable_nat_gateway = true } }
}

resource "aws_nat_gateway" "this" {
  for_each      = local.nat_envs
  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public[each.key].id
  tags          = { Name = "${each.key}-nat" }
}
```

Here, `dev` never gets a NAT gateway at all — it's filtered out of the map entirely before
`for_each` even sees it — while `prod` does. Add a third environment to `var.environments` with
`enable_nat_gateway = true`, and a third NAT gateway appears automatically, keyed by name, with
zero changes to the resource block itself.

### Under the Hood

```
var.environments (map: dev, prod)
        │
        ▼
{for name, cfg in var.environments : name => cfg if cfg.enable_nat_gateway}
        │
        ├── dev:  enable_nat_gateway = false  → FILTERED OUT (not in result)
        └── prod: enable_nat_gateway = true   → KEPT
        │
        ▼
local.nat_envs = { "prod" = {...} }
        │
        ▼
resource "aws_nat_gateway" "this" { for_each = local.nat_envs ... }
        │
        ▼
Only ONE instance created: aws_nat_gateway.this["prod"]
```

### Common Mistakes

- **Using `count` with a conditional inside a `for` loop that also needs individual keys.** Mixing
  filtered selection with `count`'s positional indexing reintroduces the exact index-shift problem
  from Section 3 — filter with a `for` expression's `if` clause and feed the result into
  `for_each`, not `count`.
- **Forgetting `try()` or a default when referencing a possibly-absent `for_each` key.** If
  `aws_instance.bastion` might have zero instances, referencing `aws_instance.bastion["bastion"]`
  directly errors when it doesn't exist. Wrap it in `try(..., null)` for a safe fallback.
- **Filtering with `for` but then still using `count` on the consuming resource** — this
  reintroduces positional fragility even though the filtering step itself was done safely.

### Interview Answer

"You get selective, conditionally-created resources by filtering a map or set with a `for`
expression's trailing `if` clause, then feeding the filtered result into `for_each` — rather than
`count`. This lets you say 'create a NAT gateway only for environments where `enable_nat_gateway`
is true,' with each created instance still individually keyed and addressable by name, so adding or
removing one environment from the source map never disturbs the others. It's the combination of a
declarative filter and stable-key iteration, which avoids the index-shift replacement problem that
`count` has."

> **Memory hook:** It's a bouncer with a guest list and a dress code — walk the named list, admit only those who pass, and everyone admitted keeps their own name tag.

---

## 5. Common Mistakes

1. **Mixing types across a ternary's two branches** (`"yes" : 0`) — keep both branches the same
   type, or explicitly use `null` in one branch only when the target argument accepts it.
2. **Treating a `for` expression as an imperative loop with side effects** — it's a pure,
   single-expression-per-iteration transformation producing a new collection, not a loop body.
3. **Defaulting to `count` for conceptually distinct, individually named resources** — causes
   disruptive index-shift replacements when a middle item is removed; use `for_each` instead.
4. **Passing a `list` (not `toset()`'d or already a map) directly to `for_each`** — Terraform
   requires a map or a set of strings, not a bare list.
5. **Referencing a `for_each`/`count`-conditional resource without a safe fallback** (`try()`,
   or checking the key exists) when the resource might not have been created at all.
6. **Reintroducing `count`'s positional fragility downstream**, even after safely filtering with a
   `for` expression, by feeding the filtered result into a `count`-based resource instead of
   `for_each`.

> **Memory hook:** Conditionals answer one yes/no question; `for` expressions transform a whole collection; `for_each` keeps every created thing individually named so removing one never disturbs the rest.

---

## 6. Hands-On Exercises

**Exercise 1 — Environment-Sized Instance**
Write a `variable "environment"` and use a ternary conditional to set `instance_type` to
`"t3.large"` for `"prod"` and `"t3.micro"` for anything else, on an `aws_instance` resource.

**Exercise 2 — Conditional Resource Existence**
Using `count = var.enable_monitoring ? 1 : 0`, conditionally create a CloudWatch alarm resource.
Then rewrite the same logic using `for_each` with a `toset([...])` pattern instead, and write a
one-paragraph comparison of the two approaches for this specific "on/off" use case.

**Exercise 3 — `for` Expression Transformations**
Given `variable "users"` as a `list(object({ name = string, role = string }))`, write three `for`
expressions: (a) a list of just the names, (b) a map from name to role, and (c) a filtered list
containing only names where `role == "admin"`.

**Exercise 4 — `count` vs `for_each` Failure Demo**
Create three `aws_security_group` resources using `count = 3` with distinct `description`s baked
in via `count.index`. Remove the middle element's logic (simulate by changing the list feeding the
descriptions) and run `terraform plan`. Observe and explain which resources show as needing
replacement. Then rewrite using `for_each` over a map keyed by a stable name, remove the same
"middle" entry, and compare the plan output.

**Exercise 5 — Filtered `for_each` for Optional Per-Item Resources**
Given a `variable "environments"` map where each value has a `create_backup_vault` boolean, write a
`local` that filters the map down to only entries where that flag is true, and use the result as
the `for_each` for an `aws_backup_vault` resource. Add and remove an environment from the variable
and confirm only the expected vault is created/destroyed.

---

## 7. Interview Q&A

---

**Q1: Does HCL have `if`/`else` statements?**

A: No. HCL is declarative with no imperative statements. Conditional logic is expressed with the
ternary conditional expression, `condition ? true_val : false_val`, which is itself an expression
that resolves to one of two values.

---

**Q2: What is a `for` expression and what does it produce?**

A: A `for` expression iterates over a list or map and produces a brand-new list (`[for x in y :
expr]`) or map (`{for x in y : k => v}`), optionally filtered with a trailing `if` clause. It's
HCL's declarative equivalent of a loop — a pure transformation with no side effects, since HCL has
no loop statements.

---

**Q3: What's the core difference between `count` and `for_each`, and why does it matter
operationally?**

A: `count` creates resource instances addressed by numeric index (`resource[0]`, `[1]`, ...);
`for_each` creates instances addressed by a stable map key or set value (`resource["key"]`).
Removing a middle element from a `count`-based list shifts every subsequent index down by one,
causing Terraform to destroy and recreate every instance after the removed one — even though they
didn't actually change. `for_each` only affects the specific keyed instance being removed; all
others are untouched.

---

**Q4: When would you still prefer `count` over `for_each`?**

A: When you need N truly identical, interchangeable copies of a resource where there's no
meaningful individual identity to key by — e.g., "3 generic worker instances that are functionally
indistinguishable." If the instances are conceptually distinct (one per AZ, one per team, one per
named environment), `for_each` is almost always the better default.

---

**Q5: How do you conditionally create an entire resource (or not at all)?**

A: Either `count = condition ? 1 : 0` (list-style, addressed at `resource[0]` if created) or
`for_each = condition ? toset(["key"]) : toset([])` (map/set-style, addressed at
`resource["key"]`). Downstream references to a possibly-absent instance should be wrapped in
`try(..., null)` or otherwise guarded, since referencing a nonexistent index/key errors.

---

**Q6: How would you create a resource only for a filtered subset of a map variable, keeping each
created instance individually keyed?**

A: Build a `local` using a `for` expression with a trailing `if` filter over the map — e.g.
`{for k, v in var.environments : k => v if v.enable_x}` — and pass the filtered result as the
`for_each` value on the resource. Only entries passing the filter get created, and each remains
addressable by its original key.

---

**Q7: What input type does `for_each` require, and what's a common error people hit?**

A: `for_each` requires a map, or a set of strings — not a bare list and not a number. A common
error is passing a `list(string)` variable directly; it must be converted with `toset()` first, or
restructured into a map, otherwise Terraform raises a type error.

---

**Q8: What happens if you pass a list with duplicate values into `toset()` for use in `for_each`?**

A: `toset()` deduplicates the values, since sets cannot contain duplicates by definition. This can
silently create fewer resource instances than the original list's length suggested, which is a
common source of "why do I have fewer instances than expected" bugs.
