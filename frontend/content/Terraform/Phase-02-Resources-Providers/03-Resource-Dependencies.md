# 03 — Resource Dependencies

## Table of Contents

1. [Implicit Dependencies](#1-implicit-dependencies)
2. [Explicit Dependencies (depends_on)](#2-explicit-dependencies-depends_on)
3. [The Dependency Graph & terraform graph](#3-the-dependency-graph--terraform-graph)
4. [Parallelism During Apply](#4-parallelism-during-apply)
5. [Common Dependency Mistakes](#5-common-dependency-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Implicit Dependencies

Picture a configuration with a VPC, a subnet inside it, and an EC2 instance inside that subnet —
fifteen resources total, scattered across three files in no particular order. You never wrote
"first do the VPC, then the subnet, then the instance" anywhere. Yet `terraform apply` somehow
creates them in exactly the right order, every single time, without you ever specifying an
order at all. How? Terraform reads the *data*, not the *order you typed things in*.

### Analogy

Think of implicit dependencies like assembling IKEA furniture using only the picture on the
instruction card — no numbered steps, just a picture of the final shelf showing that leg C is
screwed into panel B before shelf A rests on top. You can figure out the required build order
just by looking at what physically connects to what. Terraform does the same thing: it looks at
which resources' arguments reference which other resources' attributes, and from that alone
derives a correct build order.

### How Terraform Detects Them

Whenever one resource's argument contains an expression like `resource_type.name.attribute`,
Terraform records an edge in its internal dependency graph: "this resource depends on that one."
No keyword, no annotation — it's detected purely from the reference itself.

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "app" {
  vpc_id     = aws_vpc.main.id        # ← reference detected: app depends on main
  cidr_block = "10.0.1.0/24"
}

resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.app.id   # ← reference detected: web depends on app
}
```

### The Dependency Graph This Produces

```
┌───────────────┐
│  aws_vpc.main  │
└───────┬────────┘
        │  (aws_subnet.app references aws_vpc.main.id)
        ▼
┌───────────────┐
│ aws_subnet.app │
└───────┬────────┘
        │  (aws_instance.web references aws_subnet.app.id)
        ▼
┌───────────────┐
│aws_instance.web│
└───────────────┘

Apply order: aws_vpc.main → aws_subnet.app → aws_instance.web
(strictly enforced — Terraform will NEVER attempt to create aws_instance.web
 before aws_subnet.app exists, because it needs app's real subnet ID)
```

### Where Implicit Dependencies Can Hide

Not every reference is as obvious as `vpc_id = aws_vpc.main.id`. They can also appear:
- Inside `for_each`/`count` expressions: `for_each = aws_subnet.app` (dependency on the whole set)
- Inside nested blocks: `ingress { security_groups = [aws_security_group.web.id] }`
- Inside string interpolation: `name = "app-${aws_vpc.main.id}"`
- Inside `local` values that are themselves referenced elsewhere (the dependency chains *through*
  the local)

### Common Confusion

A common misconception is that Terraform decides order based on the *position* of resource
blocks in your `.tf` files (top to bottom) or across files (alphabetical filenames). It does not —
file layout is purely cosmetic. You could write `aws_instance.web` at the very top of `main.tf`
and `aws_vpc.main` at the very bottom, and Terraform would still create the VPC first, because the
graph is built from *references*, not text position.

### Interview Answer

"Implicit dependencies are dependencies Terraform infers automatically by scanning resource
arguments for expressions referencing another resource's attribute, like `aws_vpc.main.id`.
Whenever it finds one, it adds a directed edge in its internal dependency graph, guaranteeing the
referenced resource is created (or updated) before the resource that depends on it. This detection
is based entirely on data references within the configuration, not on the textual order resources
appear in `.tf` files."

> **Memory hook:** Implicit dependencies are IKEA instructions with no numbered steps — the picture (the references) alone tells you what has to go together first.

---

## 2. Explicit Dependencies (depends_on)

Now the harder case: you provision an IAM role and a policy that grants an application permission
to read from an S3 bucket, and then an EC2 instance that runs code needing that permission at
boot. But your `aws_instance` resource never actually *references* the IAM policy's ID anywhere in
its arguments — it just needs the policy to exist and be attached *before* the instance boots and
tries to use it. Terraform has no attribute reference to detect here, so it has no way to know
this ordering matters — unless you tell it directly.

### Analogy

If implicit dependency is "the instructions show it," explicit dependency is a handwritten sticky
note the manufacturer includes: "Important: let the glue on part C dry for 10 minutes before
attaching part D — even though nothing in the diagram shows a connection, trust us, do this in
order." You have to be told this rule; you can't derive it just by looking at how the pieces
visually connect.

### Syntax

```hcl
resource "aws_iam_role_policy" "app_s3_read" {
  name = "app-s3-read"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "${aws_s3_bucket.data.arn}/*"
    }]
  })
}

resource "aws_instance" "app" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
  iam_instance_profile = aws_iam_instance_profile.app.name

  # No argument here references aws_iam_role_policy.app_s3_read directly —
  # the instance's user_data script reads from S3 at boot, but Terraform
  # can't see that runtime relationship. We state it explicitly:
  depends_on = [aws_iam_role_policy.app_s3_read]

  user_data = <<-EOF
    #!/bin/bash
    aws s3 cp s3://my-data-bucket/config.json /etc/app/config.json
  EOF
}
```

`depends_on` takes a list of resource (or module) addresses, and forces Terraform to fully create
(or update) every listed resource before starting this one — even though no data actually flows
between them through HCL references.

### Under the Hood

```
WITHOUT depends_on:                    WITH depends_on = [aws_iam_role_policy.app_s3_read]:

  No graph edge detected                 Explicit graph edge added:
  (no attribute reference exists)          aws_iam_role_policy.app_s3_read
                                                       │
  aws_instance.app and                                │ must finish first
  aws_iam_role_policy.app_s3_read                      ▼
  could be created IN PARALLEL,                aws_instance.app
  in ANY order
                                          Terraform now guarantees the policy is fully
  RISK: instance boots and runs           applied before the instance is created,
  user_data BEFORE the IAM policy         eliminating the race condition
  is attached → S3 access denied
  at boot (race condition)
```

### Common Confusion

- **Reaching for `depends_on` as a first resort instead of a last resort.** If an attribute
  reference already exists anywhere between two resources, adding `depends_on` on top is
  redundant — Terraform already has the ordering from the implicit dependency.
- **Using `depends_on` to fix a genuinely different problem** — like eventual consistency delays
  in AWS itself (e.g. an IAM role that "exists" in the API but isn't yet usable everywhere). In
  those cases `depends_on` guarantees Terraform's *API call order*, but can't force AWS's own
  internal propagation delay to finish; sometimes a `time_sleep` resource or provider-specific
  wait logic is still needed on top.
- **Applying `depends_on` at the module level** (`depends_on = [module.network]`) forces
  Terraform to wait for the *entire* module's resources to complete, which can significantly
  reduce parallelism if only one resource inside that module was actually the real dependency.

### Interview Answer

"`depends_on` is a meta-argument you use when two resources have a real ordering requirement that
Terraform cannot detect from attribute references — usually because the dependency is a side
effect not exposed as a Terraform attribute, like an application needing an IAM policy to be
attached before it boots. It takes a list of resource or module addresses and forces those to be
fully applied before the resource declaring `depends_on` is processed. It should be used sparingly
— only when no implicit reference can express the same relationship — because it reduces
Terraform's ability to parallelize unrelated resources."

> **Memory hook:** `depends_on` is the sticky note the diagram doesn't show — "trust us, wait for this first," stated out loud because nothing in the data implies it.

---

## 3. The Dependency Graph & terraform graph

Every dependency you've seen so far — implicit and explicit — gets assembled into one single
structure before any `apply` happens: a directed acyclic graph (DAG) covering every resource,
data source, module, and output in your configuration. `terraform plan` and `terraform apply`
don't process resources in file order or alphabetical order — they walk this graph. You can
actually see it.

### Analogy

The dependency graph is like a project manager's Gantt chart dependency view — not the calendar
dates, just the arrows showing "task B can't start until task A finishes." Terraform builds
exactly this chart for your entire infrastructure automatically, then executes tasks in an order
that respects every arrow, running independent tasks side-by-side wherever no arrow connects them.

### Generating and Reading the Graph

```bash
terraform graph | dot -Tsvg > graph.svg
```

`terraform graph` outputs the DAG in DOT format (Graphviz). Piping it through `dot` renders a
visual diagram. Even without rendering, the raw DOT output is readable:

```
digraph {
  "aws_vpc.main" -> "provider[\"registry.terraform.io/hashicorp/aws\"]"
  "aws_subnet.app" -> "aws_vpc.main"
  "aws_instance.web" -> "aws_subnet.app"
  "aws_iam_role_policy.app_s3_read" -> "aws_iam_role.app"
  "aws_instance.web" -> "aws_iam_role_policy.app_s3_read"   # from depends_on
}
```

### ASCII View of a Small Real Graph

```
                         provider[aws]
                              │
                              ▼
                         aws_vpc.main
                        /            \
                       ▼              ▼
              aws_subnet.app    aws_iam_role.app
                       │                │
                       │                ▼
                       │      aws_iam_role_policy.app_s3_read
                       │                │
                       └───────┬────────┘
                                ▼
                        aws_instance.web
```

Reading this graph: `aws_subnet.app` and `aws_iam_role.app` have no dependency on each other, so
Terraform can create them **in parallel** once `aws_vpc.main` finishes. `aws_instance.web`,
however, must wait for *both* branches to complete, because it depends on the subnet (implicitly)
and on the IAM policy (explicitly, via `depends_on`).

### Under the Hood — What Core Actually Does With the Graph

```
1. Parse all .tf files → build in-memory resource/data/module/output nodes
2. Scan every argument for cross-references → add implicit edges
3. Read every depends_on list → add explicit edges
4. Validate the graph is acyclic (no circular dependencies) — ERROR if a cycle exists
5. Topologically sort the graph → determine a valid execution order
6. Walk the graph, executing nodes:
     - Nodes with no unmet dependencies are eligible to run NOW
     - Multiple eligible nodes run CONCURRENTLY (see section 4)
     - A node only becomes eligible once ALL of its dependency edges are satisfied
```

### Common Mistakes

- **Assuming `terraform graph` shows the same thing as `terraform plan`.** The graph shows
  structural relationships and execution order; `plan` shows what will actually change
  (create/update/destroy) for each resource. They answer different questions.
- **Not realizing destroy operations reverse the graph.** When you `terraform destroy`, resources
  are torn down in *reverse* dependency order — `aws_instance.web` is destroyed before
  `aws_subnet.app`, which is destroyed before `aws_vpc.main` — because you can't delete a VPC that
  still has a subnet in it.
- **Forgetting that `terraform graph` is a good debugging tool for "why is X waiting on Y?"**
  questions, especially in large configurations where an unexpected `depends_on` or module output
  reference has created a much longer critical path than expected.

### Interview Answer

"Terraform builds a directed acyclic graph of every resource, data source, module, and output in a
configuration, using implicit references and explicit `depends_on` declarations as edges. It
validates the graph has no cycles, then performs a topological walk, executing nodes whose
dependencies are already satisfied — running independent nodes concurrently. `terraform graph`
exposes this structure in Graphviz DOT format, which is useful for debugging unexpected ordering
or for understanding why an apply isn't parallelizing as much as expected. Destroys walk the same
graph in reverse."

> **Memory hook:** `terraform graph` is the Gantt chart behind the scenes — arrows only, no dates — and `apply` is the project manager executing every task whose arrows are all already checked off.

---

## 4. Parallelism During Apply

You have 40 independent S3 buckets in one configuration, none referencing each other at all. Does
`terraform apply` create them one at a time, waiting for each to finish before starting the next?
That would be painfully slow for something with zero real ordering constraint. It doesn't — by
default, Terraform aggressively parallelizes anything the dependency graph says is safe to run
concurrently.

### Analogy

Parallelism during apply is like a kitchen with several chefs and one dependency: the sauce chef
has to finish the sauce before the plating chef can plate it, but the salad chef, the bread chef,
and the dessert chef all have zero dependency on the sauce or on each other — so they all work
completely independently, in parallel, and the whole meal comes together faster than if one person
did every task in sequence.

### The `-parallelism` Flag

```bash
terraform apply -parallelism=10   # default is 10 concurrent graph-walk operations
```

`-parallelism` sets the maximum number of concurrent operations (creates, updates, deletes,
reads) Terraform will run at once while walking the graph. It does not change *what* runs in
parallel (that's determined by the graph) — only the *ceiling* on how many independent operations
run at the same time.

### Example — What Parallelizes and What Doesn't

```hcl
resource "aws_s3_bucket" "logs_a" { bucket = "app-logs-a-2026" }
resource "aws_s3_bucket" "logs_b" { bucket = "app-logs-b-2026" }
resource "aws_s3_bucket" "logs_c" { bucket = "app-logs-c-2026" }
# ↑ No dependencies between these three → all created CONCURRENTLY

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "a" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}

resource "aws_subnet" "b" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.2.0/24"
}
# ↑ subnet.a and subnet.b BOTH depend only on aws_vpc.main, not on each other
#   → created CONCURRENTLY with each other, but only AFTER aws_vpc.main finishes
```

### Under the Hood

```
Time ──────────────────────────────────────────────────────►

  aws_vpc.main    [████████ creating... ████████]
  aws_s3_bucket.a [████ creating ████]  (fully independent, starts immediately)
  aws_s3_bucket.b [████ creating ████]  (fully independent, starts immediately)
  aws_s3_bucket.c [████ creating ████]  (fully independent, starts immediately)
                                       │
                                       ▼ (vpc.main now done)
                   aws_subnet.a         [████ creating ████]
                   aws_subnet.b         [████ creating ████]  (concurrent with subnet.a)

  Up to `-parallelism` operations run concurrently at any given moment; more
  eligible nodes than the parallelism limit simply queue until a slot frees up.
```

### Common Mistakes

- **Lowering `-parallelism` to "fix" apply errors that are actually rate-limiting from the cloud
  provider.** AWS API throttling (`Rate exceeded` errors) is a legitimate reason to reduce
  parallelism, but the root fix is often requesting a service quota increase or adding retry
  logic, not permanently crippling apply speed.
- **Assuming higher parallelism always means faster applies.** If your graph is mostly one long
  dependency chain (A → B → C → D...), raising `-parallelism` does nothing, because there's no
  independent work to run concurrently — the critical path length is what dominates apply time.
- **Forgetting that state locking still serializes writes to the state file itself**, even though
  resource *operations* run in parallel — Terraform safely merges concurrent results into a single
  state file using internal locking, so parallelism does not risk state corruption.

### Interview Answer

"Terraform's apply walks the dependency graph and runs any operations whose dependencies are
already satisfied concurrently, up to the `-parallelism` limit (default 10). This means truly
independent resources — like unrelated S3 buckets — are created simultaneously rather than one at
a time, which is a major performance benefit of the graph-based execution model. Parallelism is
bounded by the graph's actual structure though — a long chain of dependent resources gains nothing
from raising the parallelism limit, because the critical path has to run sequentially regardless."

> **Memory hook:** Parallelism during apply is a kitchen with several independent chefs — they all work at once, but the plating chef still has to wait on the sauce chef.

---

## 5. Common Dependency Mistakes

Dependency graphs are powerful precisely because they're automatic — but "automatic" also means
mistakes here tend to be silent until `terraform plan` or `terraform apply` surfaces them, often
with an error message that's more confusing than the mistake itself. This section collects the
mistakes that show up most often in real configurations.

### Mistake 1 — Dependency Cycles

```hcl
resource "aws_security_group" "app" {
  name = "app-sg"
  # app-sg allows traffic FROM db-sg
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.db.id]   # depends on db
  }
}

resource "aws_security_group" "db" {
  name = "db-sg"
  # db-sg allows traffic FROM app-sg
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]   # depends on app
  }
}
```

```
aws_security_group.app  ──depends on──▶  aws_security_group.db
        ▲                                        │
        └───────────depends on───────────────────┘
                  CYCLE — Terraform errors:
       "Error: Cycle: aws_security_group.app, aws_security_group.db"
```

**Fix:** Break the cycle by creating the security groups without inline `ingress` rules referencing
each other, then attach rules afterward using separate `aws_security_group_rule` (or
`aws_vpc_security_group_ingress_rule`) resources — each rule resource can reference the *other*
group's ID without the group resources needing to reference each other directly.

### Mistake 2 — Missing depends_on for Side-Effect-Only Relationships

Covered in section 2: if resource B needs resource A to be *fully ready* before B starts, but B's
arguments never reference any attribute of A, Terraform sees no relationship at all and may create
them in parallel or in the wrong order — leading to intermittent, hard-to-reproduce failures
(classic symptom: "it worked when I ran apply again").

### Mistake 3 — Depending on a Whole Module When Only One Resource Matters

```hcl
# Overly broad — waits for EVERY resource inside module.network to finish
resource "aws_instance" "app" {
  depends_on = [module.network]
}
```

If `module.network` provisions ten resources but `aws_instance.app` genuinely only needs the
subnet, this forces unnecessary serialization. Prefer passing the specific value as an argument
(`subnet_id = module.network.subnet_id`), which creates a precise implicit dependency on just that
resource — not the entire module.

### Mistake 4 — Assuming terraform.io: Order Is Guaranteed for count/for_each Siblings

```hcl
resource "aws_instance" "worker" {
  count         = 5
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
}
```

There is no implicit ordering between `aws_instance.worker[0]` through `[4]` — they have no
dependency on each other, so Terraform may create them in any order, concurrently. If instance
`[2]` genuinely needs `[0]` and `[1]` to exist first, that relationship must be expressed
explicitly (rare, and usually a sign the resources shouldn't be a single `count`/`for_each` group
in the first place).

### Comparison — Symptom to Root Cause

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Error: Cycle: ...` | Two resources reference each other's attributes | Break the cycle — decouple via a separate rule/attachment resource |
| Intermittent failure ("worked on retry") | Missing `depends_on` for a side-effect-only dependency | Add explicit `depends_on` |
| Apply slower than expected | Overly broad `depends_on = [module.x]` | Reference the specific output/attribute instead |
| Resources created in unexpected order within `count`/`for_each` | Assuming implicit sibling ordering that doesn't exist | Don't rely on index order; add explicit dependency if truly required |

### Interview Answer

"The most common dependency mistakes are: circular references between two resources that each
depend on the other's attribute, which Terraform rejects outright as a cycle error; missing
`depends_on` for relationships that are real but invisible to Terraform, like an IAM policy an
application needs at boot but never references in HCL, which causes intermittent race-condition
failures; and over-broad `depends_on` targeting an entire module when only one specific output is
actually needed, which needlessly serializes otherwise-independent work. The general fix pattern
is to prefer precise attribute references over `depends_on` wherever possible, and reserve
`depends_on` only for genuinely invisible relationships."

> **Memory hook:** A cycle is two people each waiting for the other to go first through a doorway — nobody moves until you redesign the doorway.

---

## 6. Hands-On Exercises

**Exercise 1 — Trace an Implicit Graph**
Given these resources, draw the dependency graph by hand and state the guaranteed creation order:

```hcl
resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }
resource "aws_internet_gateway" "gw" { vpc_id = aws_vpc.main.id }
resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }
}
```

**Exercise 2 — Find the Cycle**
Identify why this configuration produces a cycle error, and rewrite it to avoid one:

```hcl
resource "aws_iam_role" "a" {
  assume_role_policy = data.aws_iam_policy_document.trust.json
}
resource "aws_iam_role_policy" "b" {
  role   = aws_iam_role.a.id
  policy = jsonencode({ Statement = [{ Resource = aws_iam_role.a.arn }] })
}
```
(This one is actually fine — but modify it so `aws_iam_role.a`'s `assume_role_policy` also somehow
referenced `aws_iam_role_policy.b`, and explain why that would break.)

**Exercise 3 — When Would You Use depends_on**
Give two realistic AWS scenarios where two resources have a genuine ordering requirement but no
attribute reference exists between them, requiring explicit `depends_on`.

**Exercise 4 — Read a terraform graph Output**
Run `terraform graph` on a small configuration of your choosing (or the one from Exercise 1),
pipe it into a `.dot` file, and if you have Graphviz installed, render it to SVG. If not, manually
trace the DOT text output and describe the graph in your own words.

**Exercise 5 — Parallelism Reasoning**
You have a configuration with 3 independent VPCs, each containing 2 subnets. With default
`-parallelism=10`, roughly how many resources could be "in flight" (creating simultaneously) at
the busiest point of the apply, and why? What happens if you set `-parallelism=1`?

---

## 7. Interview Q&A

---

**Q1: What is the difference between an implicit and explicit dependency in Terraform?**

A: An implicit dependency is automatically detected when one resource's argument references
another resource's attribute (e.g. `vpc_id = aws_vpc.main.id`). An explicit dependency is
declared manually with the `depends_on` meta-argument, used when a real ordering requirement
exists but no attribute reference expresses it — usually because the dependency is a side effect
outside what the provider exposes as an attribute.

---

**Q2: How does Terraform decide the order to create, update, or destroy resources?**

A: It builds a directed acyclic graph from all implicit references and explicit `depends_on`
declarations, then performs a topological walk — executing any node whose dependencies are
already satisfied, running independent nodes concurrently. Destroy operations walk the same graph
in reverse order.

---

**Q3: What causes a "Cycle" error in Terraform, and how do you fix it?**

A: A cycle occurs when two or more resources depend on each other, directly or through a chain —
for example, two security groups whose inline ingress rules each reference the other group's ID.
Terraform refuses to proceed since there's no valid order. The fix is usually to decouple the
resources by extracting the interdependent piece (like security group rules) into separate
resources that can each depend on one group without the groups depending on each other.

---

**Q4: When should you use `depends_on` instead of relying on implicit dependencies?**

A: Only when a real ordering constraint exists that cannot be expressed through an attribute
reference — for example, an EC2 instance whose boot script needs an IAM policy attached first,
but the instance resource never references the policy's ID directly. If an attribute reference
already exists, adding `depends_on` on top is redundant and shouldn't be done, since it can
obscure the real reason for the dependency and reduce clarity.

---

**Q5: How does Terraform decide what can run in parallel during apply?**

A: Any two resources with no dependency edge between them in the graph — neither depends on the
other, directly or transitively — are eligible to run concurrently, up to the `-parallelism` limit
(default 10). Resources connected by an edge must wait for their dependency to finish first,
regardless of the parallelism setting.

---

**Q6: What does `terraform graph` output, and what format is it in?**

A: It outputs the full dependency graph — including implicit and explicit dependencies across
resources, data sources, modules, and outputs — in Graphviz DOT format. It's typically piped
through the `dot` command to render an SVG/PNG, and is useful for debugging unexpected apply
ordering or understanding why parallelism is lower than expected.

---

**Q7: Why does Terraform destroy resources in reverse dependency order?**

A: Because dependencies represent real-world requirements — a subnet cannot exist without its VPC,
so the VPC can't be deleted while the subnet still references it. Reversing the graph on destroy
ensures dependents are torn down before the resources they depend on, mirroring the same
correctness the graph enforces on create.

---

**Q8: What's a downside of using `depends_on = [module.network]` instead of referencing a
specific output?**

A: It forces the resource to wait for every single resource inside `module.network` to finish,
even if only one specific value (like a subnet ID) was actually needed. This unnecessarily reduces
parallelism. Referencing the specific output (`subnet_id = module.network.subnet_id`) creates a
precise implicit dependency on just the resource(s) that actually produce that output.
