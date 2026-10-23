# 01 — Count & For-Each

## Table of Contents

1. [Why Iteration Meta-Arguments](#1-why-iteration-meta-arguments)
2. [`count` Syntax & count.index](#2-count-syntax--countindex)
3. [`for_each` with Sets and Maps](#3-for_each-with-sets-and-maps)
4. [`count` vs `for_each`](#4-count-vs-for_each)
5. [Refactoring count to for_each Safely](#5-refactoring-count-to-for_each-safely)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Iteration Meta-Arguments

Picture this: your team needs three identical EC2 instances for a web tier — same AMI, same
instance type, same security group. The "obvious" approach is to copy-paste the `resource "aws_instance" "web"` block three times and rename each one `web_1`, `web_2`, `web_3`. It works... until
someone asks for a fourth instance next sprint, and now you're copy-pasting again, and if you
forget to update one block when the AMI changes, your instances silently drift apart. Terraform
noticed this pain early and gave every resource and module block two optional "meta-arguments" —
`count` and `for_each` — that let *one* block produce *many* resources.

A **meta-argument** is a special argument that Terraform itself understands and processes,
regardless of which resource type you're using — it's not part of the AWS provider's schema at
all. `count`, `for_each`, `depends_on`, `provider`, and `lifecycle` are all meta-arguments; they
work the same way whether the resource is `aws_instance`, `aws_s3_bucket`, or `google_compute_instance`.

### Analogy

Think of a resource block without `count`/`for_each` as a *custom, one-off order form* — you fill
it out once, and one item gets made. Adding `count = 3` to that form is like writing "make me 3
copies of this exact order" at the top — the factory (Terraform) stamps out three identical
(or near-identical, via `count.index`) items from the same template, instead of you photocopying
the form yourself and handing in three separate submissions.

### Under the Hood

Without a meta-argument, one `resource` block maps to exactly one object in Terraform's state,
addressed as `aws_instance.web`. Add `count` or `for_each`, and Terraform expands that single
configuration block into a **list or map of resource instances** inside the state file, each with
its own unique address.

```
resource "aws_instance" "web" {          resource "aws_instance" "web" {
  ami = "ami-123"                          for_each = var.instances
}                                          ami      = each.value.ami
                                         }
        │                                         │
        ▼                                         ▼
┌─────────────────────┐             ┌──────────────────────────────┐
│  STATE (no count)    │             │   STATE (for_each expanded)  │
│  aws_instance.web    │             │  aws_instance.web["app"]     │
│  (single object)      │             │  aws_instance.web["worker"] │
└─────────────────────┘             │  aws_instance.web["cache"]   │
                                     └──────────────────────────────┘
```

During `terraform plan`, the core engine evaluates `count`/`for_each` *before* it builds the
resource graph — it needs to know how many instances exist so it can create one graph node per
instance, each independently created, updated, or destroyed.

### Example

```hcl
# Without count — one resource, one instance
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
}

# With count — one block, three instances
resource "aws_instance" "web" {
  count         = 3
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  tags = {
    Name = "web-${count.index}"
  }
}
```

```
$ terraform state list
aws_instance.web[0]
aws_instance.web[1]
aws_instance.web[2]
```

### Common Confusion

Beginners often think `count` or `for_each` "loops" the way a `for` loop does in Python — running
top to bottom, one iteration at a time. It doesn't. Terraform evaluates the whole set of instances
up front, builds a dependency graph across *all* of them, and then creates/updates/destroys as
many as possible **in parallel** (bounded by `-parallelism`, default 10). There is no sequential
"instance 0 finishes, then instance 1 starts" guarantee unless you add explicit dependencies.

### Interview Answer

"`count` and `for_each` are meta-arguments that tell Terraform to expand a single resource or
module block into multiple instances, each tracked separately in state. Terraform evaluates the
count/for_each value during graph construction, creates one graph node per instance, and can then
create, update, or destroy each instance independently and in parallel."

> **Memory hook:** One resource block + `count`/`for_each` is one order form stamped into a whole batch — not a hand loop you write yourself.

---

## 2. `count` Syntax & count.index

Say you need three subnets, each in a different availability zone, with a slightly different CIDR
block per subnet. `count` lets you write the block once and vary each instance using
`count.index` — a zero-based integer available *only inside* a block that has `count` set,
representing "which copy is this."

### Analogy

`count.index` is like a numbered ticket at a bakery counter. Every customer (resource instance)
gets served from the same menu (the resource block), but ticket #0, #1, #2 let the baker
personalize each order slightly — engrave a different name on each cake — while using one recipe.

### Syntax

```hcl
resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "public-subnet-${count.index}"
  }
}
```

`count.index` runs from `0` to `count - 1`. It can be used anywhere inside the block: in tags, in
`cidrsubnet()` to carve out non-overlapping ranges, or to index into another list
(`data.aws_availability_zones.available.names[count.index]`).

### Referencing count Resources Elsewhere

Because `count` produces a *list* of instances, referencing the whole resource from outside gives
you a list too:

```hcl
output "subnet_ids" {
  value = aws_subnet.public[*].id   # splat expression — list of all subnet IDs
}

resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
```

### Under the Hood

```
count = 3
   │
   ▼
┌───────────────────────────────────────────────────────────┐
│  Terraform builds 3 graph nodes:                          │
│  aws_subnet.public[0]  cidr=10.0.0.0/24  az=us-east-1a    │
│  aws_subnet.public[1]  cidr=10.0.1.0/24  az=us-east-1b    │
│  aws_subnet.public[2]  cidr=10.0.2.0/24  az=us-east-1c    │
└───────────────────────────────────────────────────────────┘
```

### Common Confusion

People assume `count.index` is stable and tied to the *identity* of the resource. It isn't — it's
tied to *position in the list*. If you remove `aws_subnet.public[1]` from the middle (say, by
changing `count = 3` to `count = 2` when it was the AZ you no longer want), Terraform doesn't
"delete index 1 and shift the rest down" — it destroys `[2]` (since only indices 0 and 1 now
exist) and Terraform must diff every subsequent index because the *entire* list shifted. This
means a single removal in the middle can cascade into re-creating every resource after it in the
list — the entire reason `for_each` exists (see section 4).

### Interview Answer

"`count.index` is a zero-based counter available inside a resource block that has `count` set. It
lets each instance customize itself — different CIDR block, different AZ, different name tag —
from a single resource definition. But because it's positional, removing an item from the middle
of the list shifts every subsequent index, which can trigger unwanted destroy/recreate operations
on unrelated resources."

> **Memory hook:** `count.index` is a bakery ticket number — great for identical cakes with a name written on each, risky if you want to cancel ticket #1 without reshuffling everyone behind it.

---

## 3. `for_each` with Sets and Maps

Now imagine the opposite problem: instead of "make me 3 of these," you have a *named* set of
things — three S3 buckets called `logs`, `backups`, and `assets`, each needing a different
lifecycle policy. Indexing them `[0]`, `[1]`, `[2]` throws away meaning that already exists in
your data. `for_each` lets you iterate over a **map** or a **set of strings**, using each key (or
each set member) as a stable, human-readable identifier instead of a fragile numeric position.

### Analogy

If `count` is a bakery ticket number, `for_each` is a nametag. Instead of "customer #2," you get
"Priya's order." If Priya cancels, nobody else's ticket changes — the bakery just has one fewer
nametag on the counter. Everyone else's order is completely undisturbed.

### Syntax — Set of Strings

```hcl
resource "aws_iam_user" "team" {
  for_each = toset(["alice", "bob", "carol"])
  name     = each.value
}
```

Inside a `for_each` block, Terraform exposes `each.key` and `each.value`. For a set, `each.key` and
`each.value` are identical (the string itself).

### Syntax — Map

```hcl
variable "buckets" {
  type = map(object({
    versioning_enabled = bool
    expiration_days    = number
  }))
  default = {
    logs = {
      versioning_enabled = false
      expiration_days    = 30
    }
    backups = {
      versioning_enabled = true
      expiration_days    = 365
    }
  }
}

resource "aws_s3_bucket" "this" {
  for_each = var.buckets
  bucket   = "myapp-${each.key}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = var.buckets
  bucket   = aws_s3_bucket.this[each.key].id

  rule {
    id     = "expire"
    status = "Enabled"
    expiration {
      days = each.value.expiration_days
    }
  }
}
```

Referencing instances uses the key, not a number: `aws_s3_bucket.this["logs"].id`.

### Under the Hood

```
for_each = { logs = {...}, backups = {...}, assets = {...} }
   │
   ▼
┌────────────────────────────────────────────────────────────┐
│  State keyed by string, not position:                      │
│  aws_s3_bucket.this["logs"]                                 │
│  aws_s3_bucket.this["backups"]                               │
│  aws_s3_bucket.this["assets"]                                │
│                                                              │
│  Remove "backups" from var.buckets → Terraform destroys      │
│  ONLY aws_s3_bucket.this["backups"]. "logs" and "assets"      │
│  are untouched — no cascading diff.                           │
└────────────────────────────────────────────────────────────┘
```

### Common Confusion

`for_each` cannot take a plain `list` of strings directly if the list has any duplicate values,
and it cannot accept a value that isn't known until apply time (e.g., an ID generated by another
resource you haven't created yet) unless you're on Terraform 1.x with certain allowances for
`for_each` over resources that support it experimentally. In practice: wrap lists with `toset()`
to dedupe, and avoid feeding `for_each` a value that depends on a computed attribute of a resource
not yet created — Terraform needs to know the *keys* before `apply`, even if the *values* can be
computed later.

### Interview Answer

"`for_each` iterates over a map or a set of strings, using `each.key`/`each.value` inside the
block. Unlike `count`, resource instances are addressed by a stable string key
(`aws_s3_bucket.this["logs"]`), so adding or removing one entry only affects that specific
instance in state — nothing else shifts. This makes `for_each` the safer default whenever your
items have natural, meaningful names rather than being truly identical and interchangeable."

> **Memory hook:** `for_each` gives every resource a nametag, not a ticket number — remove one nametag and nobody else's identity changes.

---

## 4. `count` vs `for_each`

You now have two tools that both "make more than one resource from one block." The decision of
which to reach for comes down to one question: **will items ever be removed from the middle of the
collection, or does every item have a natural unique name?** Get this wrong and you'll find out
the hard way — during a `terraform apply` that wants to destroy and recreate resources you never
touched.

| Dimension | `count` | `for_each` |
|-----------|---------|------------|
| **Input type** | Number | Map or set of strings |
| **Addressing** | Positional index — `resource[0]`, `resource[1]` | Stable key — `resource["name"]` |
| **Removing from the middle** | Shifts every subsequent index → cascading recreate/destroy | Only the removed key is destroyed; others untouched |
| **Best for** | Truly identical, interchangeable resources (e.g., N identical worker nodes with no individual identity) | Resources with natural distinct identity (buckets by name, users by username, per-environment config) |
| **Referencing in `each`/`count`** | `count.index` (integer) | `each.key`, `each.value` |
| **Splat expression** | `resource[*].attr` works naturally | `values(resource)[*].attr` needed (map, not list) |
| **Conditional creation (0 or 1)** | `count = var.enabled ? 1 : 0` (very common pattern) | `for_each = var.enabled ? toset(["x"]) : toset([])` (more awkward) |
| **Duplicate values allowed** | N/A (just a count) | Set values must be unique; map keys are always unique |
| **State stability under reorder** | Fragile — reordering a source *list* reorders indices | Stable — reordering a map has no effect (maps are unordered by key) |

### Under the Hood — Why the Middle Matters

```
count = 3, list = ["a", "b", "c"]        for_each over set {"a","b","c"}
Remove "b" → list = ["a", "c"]           Remove "b" → set {"a","c"}

State before:        State after:        State before:         State after:
[0] = "a"    →        [0] = "a"  (ok)     ["a"] = a     →       ["a"] = a  (untouched)
[1] = "b"    →        [1] = "c"  (!!)     ["b"] = b     →       (destroyed)
[2] = "c"    →        (destroyed)         ["c"] = c     →       ["c"] = c  (untouched)

[1] used to be "b", now Terraform sees "c" should be at [1] —
it DESTROYS the old [1] (b) and [2] (c), then CREATES a new [1] (c).
Net result: "c" gets destroyed and recreated even though logically
nothing about "c" changed — only its position in the list did.
```

### When to Use Which

- Use **`count`** when: creating a fixed, truly interchangeable number of identical resources
  (e.g., `count = var.enabled ? 1 : 0` to conditionally create a single resource), or when the
  resources genuinely have no independent identity and are always added/removed from the *end*.
- Use **`for_each`** when: each resource has a natural distinguishing name (environment name,
  team member, bucket purpose), or when items can be added/removed from anywhere in the
  collection without wanting to disturb unrelated instances — which, in practice, is most
  real-world infrastructure.

### Common Mistakes

- Using `count` for a list of named things ("web", "api", "worker") just because it's the first
  meta-argument people learn — then being surprised when adding a fourth item recreates unrelated
  resources.
- Forgetting that `for_each` requires the **keys** to be known at plan time — you can't
  `for_each` over something whose *set of keys* depends on a resource attribute not yet created.
- Mixing `count` and `for_each` on the same resource block — Terraform explicitly forbids this;
  a block may use at most one of them.

### Interview Answer

"Use `count` for a fixed number of truly interchangeable resources, and `for_each` whenever items
have a natural unique identity. The core risk with `count` is that it addresses instances
positionally — removing an item from the middle of the underlying list shifts every following
index, causing Terraform to destroy and recreate resources that didn't logically change. `for_each`
addresses instances by a stable string key, so removing one item only affects that item."

> **Memory hook:** `count` numbers seats in a row — pull one out and everyone behind shuffles forward. `for_each` gives everyone a nametag — pull one person out and nobody else's badge changes.

---

## 5. Refactoring count to for_each Safely

You inherited a Terraform config that provisions five EC2 instances with `count = 5`, and now you
need to remove instance #2 specifically (it's being decommissioned) without touching the other
four. If you just change `count = 5` to `count = 4`, Terraform will shift indices 3 and 4 down to
2 and 3 — meaning it destroys and recreates real running instances that should have stayed
untouched. The safe fix is migrating to `for_each` — but you have to do it carefully, because
naively editing the HCL will make Terraform think all five instances are "new" (different address)
and all five old ones need destroying.

### Analogy

This is like renumbering a hotel's rooms from numbers to guest names *while guests are still
staying in them*. If you just swap the sign on the door, the hotel's booking system thinks Room
204 checked out and a brand-new guest named "Priya" checked into a different room — even though
Priya never left Room 204. You need to explicitly tell the booking system "Room 204's guest is now
tracked as 'Priya', same guest, same room" — that's what `terraform state mv` does for Terraform's
state file.

### The Problem in Practice

```hcl
# BEFORE — count-based
resource "aws_instance" "web" {
  count         = 5
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  tags          = { Name = "web-${count.index}" }
}
```

```hcl
# AFTER — naively switched to for_each, WITHOUT state mv
resource "aws_instance" "web" {
  for_each      = toset(["a", "b", "c", "d", "e"])
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  tags          = { Name = "web-${each.value}" }
}
```

If you `terraform apply` this directly, Terraform sees `aws_instance.web[0]` through `[4]` in
state, but the new config wants `aws_instance.web["a"]` through `["e"]` — completely different
addresses. Plan will show **5 destroys and 5 creates**, which means real downtime and real data
loss for anything stateful (like an EBS volume with unique data).

### The Safe Migration

```bash
# Move each old index to its new key, one at a time, BEFORE applying the new config
terraform state mv 'aws_instance.web[0]' 'aws_instance.web["a"]'
terraform state mv 'aws_instance.web[1]' 'aws_instance.web["b"]'
terraform state mv 'aws_instance.web[2]' 'aws_instance.web["c"]'
terraform state mv 'aws_instance.web[3]' 'aws_instance.web["d"]'
terraform state mv 'aws_instance.web[4]' 'aws_instance.web["e"]'

# Now run plan — it should show NO changes (or only benign metadata diffs)
terraform plan
```

Since Terraform 1.1, you can also do this declaratively and repeatably with a `moved` block
instead of manual CLI commands:

```hcl
moved {
  from = aws_instance.web[0]
  to   = aws_instance.web["a"]
}
moved {
  from = aws_instance.web[1]
  to   = aws_instance.web["b"]
}
# ... one moved block per index → key mapping
```

The `moved` block is preferred in team settings because it's version-controlled and applies
automatically for anyone running `terraform apply` — no one has to remember to run manual
`state mv` commands.

### Under the Hood

```
Old state                  moved block / state mv           New state
┌────────────────┐         maps old address to new           ┌──────────────────┐
│ web[0] → i-abc │  ─────────────────────────────────────▶  │ web["a"] → i-abc │
│ web[1] → i-def │                                            │ web["b"] → i-def │
└────────────────┘                                            └──────────────────┘
No destroy/create — Terraform just renames the state entry.
The real AWS instance (i-abc) is never touched.
```

### Common Mistakes

- Applying the new `for_each` config *before* moving state — causes full destroy/recreate.
- Mismatching the mapping (e.g., moving `[0]` to `"b"` instead of `"a"`) — silently swaps which
  real resource is tracked under which key; always double check with `terraform plan` (expect
  zero changes) before applying.
- Forgetting that `moved` blocks are one-directional and should stay in the code for anyone else
  who applies from an older state — don't delete them immediately after your own apply if
  teammates haven't caught up yet.

### Interview Answer

"Refactoring `count` to `for_each` changes every resource's address in state — from a numeric
index to a string key — even if the underlying infrastructure hasn't changed. Applying the new
config directly would destroy and recreate every instance. The safe approach is to either run
`terraform state mv` for each old-address-to-new-address pair, or — since Terraform 1.1 — declare
`moved` blocks in the configuration, which Terraform applies automatically during planning so the
migration is version-controlled and repeatable for the whole team."

> **Memory hook:** Switching count to for_each is renaming hotel guests while they're still in their rooms — use `state mv` or a `moved` block so nobody actually has to check out and back in.

---

## 6. Common Mistakes

- **Using `count` on resources with unique per-instance state** (like an EBS volume holding
  irreplaceable data) where a middle-removal would trigger destroy/recreate — should be
  `for_each` from the start.
- **Forgetting `for_each` set values must be unique** — `toset(["a", "a", "b"])` collapses to two
  elements, silently changing your resource count from what you expected.
- **Referencing `count.index` or `each.key` outside the block it belongs to** — these symbols only
  exist *inside* the resource/module block where the meta-argument is declared; they can't be used
  in outputs directly without going through the resource reference (e.g., `aws_subnet.public[*].id`).
- **Mixing `count` and `for_each` on the same block** — Terraform raises a hard error; pick one.
- **Assuming splat (`[*]`) works on `for_each` resources the same way as `count` resources** — for
  `for_each`, you need `values(aws_instance.web)[*].id`, since the resource is a map, not a list.
- **Using `count = length(var.list)` with a list that can reorder** — same middle-removal problem
  as any `count` usage; if the *order* of `var.list` can change between applies (e.g., it comes
  from an unordered data source), indices become unstable even without adding/removing elements.

---

## 7. Hands-On Exercises

**Exercise 1 — Basic count**
Write a resource block that creates 4 `aws_instance` resources named `app-0` through `app-3`
using `count` and `count.index` in the `Name` tag.

**Exercise 2 — for_each over a map**
Given this variable:
```hcl
variable "environments" {
  type = map(string)
  default = {
    dev     = "t3.micro"
    staging = "t3.small"
    prod    = "t3.large"
  }
}
```
Write an `aws_instance` resource using `for_each` that creates one instance per environment, using
the map value as `instance_type` and the map key in the `Name` tag.

**Exercise 3 — Predict the Diff**
You have `count = 4` creating `aws_subnet.public[0..3]` from a list
`["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]`. You remove the second CIDR from
the middle of the list (now 3 entries). Write out, instance by instance, which subnets Terraform
will destroy, update, or leave alone, and why.

**Exercise 4 — Migration Practice**
Starting from a `count = 3` `aws_iam_user` resource for users `["alice", "bob", "carol"]`, write
the three `moved` blocks needed to safely convert it to a `for_each = toset(["alice","bob","carol"])`
version without destroying any IAM user.

**Exercise 5 — Conditional Creation**
Write a resource block for an `aws_eip` that is only created when `var.enable_eip = true`, using
`count` with a ternary expression. Then rewrite it using `for_each` to achieve the same effect.

---

## 8. Interview Q&A

---

**Q1: What is the difference between `count` and `for_each` in Terraform?**

A: `count` takes a number and produces resource instances addressed by numeric index
(`resource[0]`, `resource[1]`); `for_each` takes a map or set of strings and produces instances
addressed by a stable string key (`resource["name"]`). The key practical difference is behavior
when an item is removed from the middle: `count` shifts every following index, causing cascading
destroy/recreate; `for_each` only affects the removed key.

---

**Q2: When would you choose `count` over `for_each`?**

A: When resources are truly interchangeable and identical, with no meaningful individual identity
— for example, a fixed number of stateless worker nodes — or for the common `count = var.enabled
? 1 : 0` conditional-creation pattern, which is more concise than the `for_each` equivalent.

---

**Q3: What is `count.index` and where can you use it?**

A: `count.index` is a zero-based integer, available only inside a resource or module block that
has `count` set, representing the position of the current instance. It's commonly used to derive
per-instance values like tags, CIDR blocks (via `cidrsubnet`), or to index into a parallel list.

---

**Q4: Why can removing an item from the middle of a `count`-based list be dangerous?**

A: Because `count` addresses instances by position, not identity. If you have `count = 3` sourced
from a list and remove the middle element, Terraform sees that the list now has different values
at indices that used to hold something else — it destroys instances whose index no longer matches
and creates new ones, even though logically only one item should have been removed. This can
cause real infrastructure (and its data) to be destroyed unnecessarily.

---

**Q5: How do you safely migrate a resource from `count` to `for_each`?**

A: Either run `terraform state mv 'resource[N]' 'resource["key"]'` for each instance before
applying the new configuration, or — since Terraform 1.1 — add `moved` blocks to the
configuration mapping each old index to its new key. Both approaches rename the state entry
without destroying and recreating the underlying infrastructure. Always verify with
`terraform plan` that it shows no changes before finalizing.

---

**Q6: Can you use both `count` and `for_each` on the same resource block?**

A: No. Terraform raises an error if both are set on the same block — you must pick exactly one
meta-argument per resource or module block.

---

**Q7: What types of values can `for_each` accept?**

A: A map, or a set of strings (often produced with `toset()` from a list). It cannot accept a
list directly (lists can have duplicates and are positionally ordered, which defeats the purpose
of stable keys), and the set of keys must be known before apply — you can't derive the keys from
an attribute that's only known after a resource is created.

---

**Q8: How do you reference all instances of a `for_each` resource, e.g., to get all IDs?**

A: Use `values(aws_instance.web)[*].id` (or a `for` expression like
`[for k, v in aws_instance.web : v.id]`), since a `for_each` resource is represented as a map, not
a list — the `[*]` splat operator alone works on lists (which is what `count` produces), not maps.
