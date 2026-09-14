# 01 — Data Sources

## Table of Contents

1. [Why Data Sources](#1-why-data-sources)
2. [The `data` Block Syntax](#2-the-data-block-syntax)
3. [Data Sources vs Resources](#3-data-sources-vs-resources)
4. [Common AWS Data Sources](#4-common-aws-data-sources)
5. [Data Source Dependency Timing](#5-data-source-dependency-timing)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why Data Sources

Picture this: your team owns the Terraform code for a new application server, but the VPC,
subnets, and security groups it needs to sit inside were created two years ago by the networking
team, in a completely different Terraform project (maybe even a different tool — half of it might
have been clicked together in the AWS console before Terraform existed). You need your EC2
instance to land in the right subnet and use the right security group. Do you hard-code the
subnet ID `subnet-0a1b2c3d4e5f` into your `.tf` file and hope it never changes? Do you copy-paste
the networking team's entire VPC module into your own state, so Terraform thinks *you* own it too?

Neither. You *ask* AWS for the information, at plan time, without ever claiming ownership of it.
That's exactly what a **data source** is for.

A **data source** lets Terraform read information about infrastructure that already exists —
whether it was created by another Terraform configuration, another team, a CloudFormation stack,
a Console click, or is simply a built-in AWS-managed resource (like the current list of
Availability Zones). Terraform fetches this information every time you run `plan` or `apply`, but
it never tries to create, modify, or destroy it. It's a **read-only lookup**, not management.

### Analogy

Think of `resource` blocks as things *you* own and are responsible for — like an apartment you
lease, decorate, and can renovate or vacate. A `data` block is like looking up your neighbor's
apartment number in the building directory: you need the information (which floor, which unit) to
route a package correctly, but you have zero authority to repaint their walls or evict them. You
just read the directory and use what it tells you.

### The Core Idea

```
┌──────────────────────────────────────────────────────────────────┐
│                     YOUR TERRAFORM STATE                          │
│                                                                     │
│   resource "aws_instance" "app" { ... }   ◄── you own this        │
│   resource "aws_security_group" "app" {...} ◄── you own this      │
│                                                                     │
└───────────────────────────┬────────────────────────────────────────┘
                            │ reads (never writes)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    EXISTING AWS INFRASTRUCTURE                    │
│                                                                     │
│   VPC (created by networking team's Terraform, 2 years ago)       │
│   Subnets, Route Tables                                            │
│   AMIs (published by AWS / Canonical / your own AMI pipeline)     │
│                                                                     │
│   data "aws_vpc" "main"  { ... }  ◄── you only READ this          │
└──────────────────────────────────────────────────────────────────┘
```

Without data sources, teams end up either duplicating infrastructure (each team creates their own
VPC, causing sprawl and cost) or hard-coding IDs (which breaks the moment someone recreates the
referenced resource, since the ID changes). Data sources solve both problems by keeping the lookup
dynamic and centralized.

```hcl
# Look up the default VPC in the current region — don't create one
data "aws_vpc" "default" {
  default = true
}

# Use the looked-up ID in a resource you DO own
resource "aws_security_group" "app" {
  name   = "app-sg"
  vpc_id = data.aws_vpc.default.id
}
```

### Common Confusion

Beginners often assume a `data` block "creates" something if it doesn't already exist — it does
not. If the query behind a data source finds zero matches (or more than one match when exactly one
is expected), Terraform throws an error at plan time. A data source is a strict *lookup*, never a
fallback-create mechanism. If you need "create it if it doesn't exist," that's application logic
you'd handle outside Terraform (or with `count`/conditional resource creation), not something a
`data` block does for you.

### Interview Answer

"A data source is a read-only query against a provider's API that lets Terraform reference
existing infrastructure — resources it doesn't manage — without importing them into state. It's
used to look up things like AMI IDs, VPC IDs, or account details that were created outside the
current configuration, so that resources I *do* manage can reference real, current values instead
of hard-coded IDs."

> **Memory hook:** `resource` is your apartment — you can renovate it. `data` is the building directory — you only read it to find someone else's unit number.

---

## 2. The `data` Block Syntax

You've seen `resource "aws_instance" "web" { ... }` a hundred times by now. Data sources use an
almost identical shape, and that similarity is deliberate — Terraform wants reading and writing
infrastructure to *feel* the same in your code, even though what happens underneath is completely
different (an API `GET` call vs a `POST`/`PUT`/`DELETE`).

### Analogy

If a `resource` block is a work order form you submit to a contractor ("build me this, with these
exact specs"), a `data` block is a request form you submit to a records office ("tell me everything
you know about this existing thing"). Both forms have the same two blanks at the top — a *type*
and a *name* — but one results in construction, the other in a report.

### Syntax Breakdown

```hcl
data "<PROVIDER_TYPE>" "<LOCAL_NAME>" {
  # filter/query arguments — how to find the thing
  <argument> = <value>
}
```

- `data` — the keyword, always first.
- `"<PROVIDER_TYPE>"` — e.g. `"aws_ami"`, `"aws_vpc"` — which kind of object to query.
- `"<LOCAL_NAME>"` — your own local alias for referencing it elsewhere in this configuration.
- Body arguments — the *filter criteria* used to find the matching object(s). These are **not**
  the same as resource arguments (which configure a new object); here they narrow down a search.

You reference the result elsewhere using:

```
data.<PROVIDER_TYPE>.<LOCAL_NAME>.<ATTRIBUTE>
```

### Concrete Example

```hcl
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id      # <-- reference the lookup result
  instance_type = "t3.micro"
}

output "resolved_ami_id" {
  value = data.aws_ami.amazon_linux.id
}
```

Run `terraform plan` and Terraform will:
1. Call the AWS API with your `filter` blocks as the query.
2. Get back a list of matching AMIs, sorted implicitly by the API.
3. Because `most_recent = true`, pick the newest one if multiple match.
4. Populate every exported attribute (`id`, `name`, `creation_date`, `architecture`, ...) on
   `data.aws_ami.amazon_linux` so the rest of your config can use them.

### Common Confusion

A frequent mistake: treating the arguments inside a `data` block as if they configure the object
(like a resource does). They don't — they only describe *how to find* it. Passing
`instance_type = "t3.micro"` inside `data "aws_ami"` would be nonsensical; AMIs don't have an
"instance_type" filter field. Always check the provider docs for which arguments are valid
*filters* for that specific data source — they differ resource-by-resource.

### Interview Answer

"The `data` block syntax mirrors `resource` syntax — type, local name, and a body — but the body
arguments are search/filter criteria rather than desired-state configuration. Terraform sends
those filters to the provider's API as a query, and the returned attributes become readable via
`data.<type>.<name>.<attribute>` anywhere else in the configuration."

> **Memory hook:** Same two blanks as a `resource` block (type, name) — but you're filling out a "find it" form, not a "build it" form.

---

## 3. Data Sources vs Resources

New Terraform users often ask: "if both blocks look the same and both end up as an object in my
configuration graph, what's actually different?" The differences are small in syntax but huge in
behavior — and mixing them up is one of the most common sources of "wait, why did Terraform try to
destroy my VPC?!" panic moments.

| Aspect | `resource` | `data` |
|--------|-----------|--------|
| **Purpose** | Create, update, and destroy infrastructure | Read existing infrastructure |
| **Lifecycle ownership** | Terraform owns it — tracked in state, can be destroyed | Terraform never owns it — not created/destroyed by this config |
| **API calls made** | `Create`, `Read`, `Update`, `Delete` | `Read` (list/describe/get) only |
| **Appears in state file** | Yes, with full resource attributes | Yes, but only as a cached read result, not a managed object |
| **`terraform destroy` effect** | Destroys the real infrastructure | No effect — nothing to destroy |
| **`terraform plan` shows** | `+ create`, `~ update`, `- destroy` | Always a read (shown as a refresh, no create/destroy symbol) |
| **Fails if 0 matches?** | N/A (you define exact config) | Yes — errors immediately |
| **Fails if 2+ matches (when 1 expected)?** | N/A | Yes, unless the data source explicitly supports lists |
| **Example** | `resource "aws_instance" "web" {...}` | `data "aws_ami" "web" {...}` |

### Under the Hood

```
terraform plan
      │
      ├──► resource blocks  ──► compare desired config vs state ──► create/update/destroy plan
      │
      └──► data blocks      ──► call provider Read API RIGHT NOW ──► populate values for this run
```

Every `data` block is re-evaluated (usually) on every `plan`/`apply`, because its whole purpose is
to reflect the *current* real-world state of something you don't control. A `resource` block, in
contrast, is only re-read to detect drift against what Terraform itself created.

### Common Mistakes

- **Confusing `data.aws_vpc.main.id` with `aws_vpc.main.id`.** The first reads an existing VPC;
  the second references a VPC *this configuration creates*. Forgetting the `data.` prefix causes a
  "resource not found" error, because Terraform looks for a `resource` block with that name that
  doesn't exist.
- **Trying to "manage" something with a data source.** If you actually need Terraform to adopt an
  existing resource into state (so it can be updated/destroyed by this config), you need
  `terraform import` or an `import` block, not a `data` source. A `data` source is forever
  read-only.

### Interview Answer

"`resource` blocks declare infrastructure Terraform should create and manage across its full
lifecycle — create, update, destroy. `data` blocks only read information about something that
already exists, whether managed by this configuration's cousin project, another team, or the
cloud provider itself. Data sources never appear in a create/destroy plan; they're refreshed as
read-only lookups every run."

> **Memory hook:** `resource` = a rental you can renovate or vacate. `data` = a public record you can only read.

---

## 4. Common AWS Data Sources

Now that you know the shape, here are three data sources you will use constantly in real AWS
Terraform work — almost every non-trivial AWS module touches at least one of these.

### Analogy

Think of these three as answering three different everyday questions when you move into a new
city: "What's the newest model of the thing I need to buy?" (AMI), "Which neighborhoods
(sub-regions) actually exist here?" (Availability Zones), and "Which building am I supposed to move
into?" (VPC).

### `aws_ami` — Find the Right Machine Image

Hard-coding an AMI ID like `ami-0abcdef1234567890` is a landmine: AMI IDs are **region-specific**
and get replaced every time AWS or your AMI pipeline publishes a new patched image. `data
"aws_ami"` lets you always resolve to "the latest one matching this pattern," regardless of region
or how often it's rebuilt.

```hcl
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]   # restrict to AWS-published images (avoid random public AMIs)

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t3.micro"
}
```

### `aws_availability_zones` — Discover Where You Can Deploy

Not every AWS account/region combination has access to the same set of AZs (some are restricted,
some regions have 2, others have 6). Instead of hard-coding `us-east-1a`, `us-east-1b`, you ask AWS
what's actually available *for this account, right now*.

```hcl
data "aws_availability_zones" "available" {
  state = "available"   # exclude AZs that are impaired or unavailable
}

resource "aws_subnet" "public" {
  count             = length(data.aws_availability_zones.available.names)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
}
```

### `aws_vpc` — Reference an Existing Network

This is the classic "networking team already built the VPC" scenario from Section 1.

```hcl
data "aws_vpc" "main" {
  filter {
    name   = "tag:Name"
    values = ["prod-main-vpc"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  tags = {
    Tier = "private"
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t3.small"
  subnet_id     = data.aws_subnets.private.ids[0]
}
```

| Data Source | Typical Use | Key Filter Args |
|---|---|---|
| `aws_ami` | Resolve the latest AMI matching a naming pattern | `owners`, `filter`, `most_recent` |
| `aws_availability_zones` | Get the list of usable AZs in the current region | `state` |
| `aws_vpc` | Look up an existing VPC's ID/CIDR by tag or default flag | `filter`, `default`, `tags` |
| `aws_subnets` / `aws_subnet` | Look up subnet IDs within a VPC | `filter`, `vpc_id`, `tags` |
| `aws_caller_identity` | Get current AWS account ID / ARN / user ID | (no args — returns caller info) |
| `aws_region` | Get the currently configured region name | (no args) |

### Common Mistakes

- Forgetting `most_recent = true` on `aws_ami` — without it, and with multiple matches, Terraform
  errors out instead of silently picking one (which is a deliberate safety feature, not a bug).
- Using `owners = ["self"]` when you meant `["amazon"]` (or vice versa) — this silently returns
  zero results if your account never published an AMI matching the filter.
- Assuming AZ *names* (`us-east-1a`) map to the same physical location across different AWS
  accounts — they don't. AWS randomizes the mapping per account specifically to spread load, which
  is exactly why `data "aws_availability_zones"` exists instead of hard-coding names.

### Interview Answer

"`aws_ami` resolves a machine image ID dynamically using name/owner filters so you're never
pinned to a stale, hard-coded ID. `aws_availability_zones` returns the AZs actually usable in the
current account/region, since AZ-to-name mapping is randomized per account. `aws_vpc` (and its
sibling `aws_subnets`) let you reference networking infrastructure owned by another team or
Terraform state, typically filtered by tags, without importing it into your own state."

> **Memory hook:** AMI = "give me the newest model," AZs = "which neighborhoods exist here," VPC = "which building do I move into."

---

## 5. Data Source Dependency Timing

Here's a subtlety that catches people off guard: **when exactly** does a data source's query run?
If you write a data source that depends on a resource you're creating *in the same apply*, does
Terraform know to create the resource first, then query it? And if a data source is read at plan
time, does that mean its result could be stale by the time `apply` actually runs?

### Analogy

Think of `terraform plan` as sending a scout ahead of the main group to survey the terrain. If the
terrain the scout needs to survey is itself being built by the group *during this same trip* (a
brand-new bridge, say), the scout has to wait for the bridge crew to finish before crossing it and
reporting back. But if the terrain already exists (an old, established bridge — like an AMI
published by AWS), the scout can survey it immediately, before anyone in the group has taken a
single step.

### The Two Timing Modes

```
CASE A — Data source has NO dependency on resources in this config
──────────────────────────────────────────────────────────────────
terraform plan
   │
   ├─► data.aws_ami.x  ──► READ NOW (during plan)         ✅ known before apply
   └─► resource.aws_instance.web ──► planned using data.aws_ami.x.id (already known)

terraform apply
   │
   └─► creates aws_instance.web using the value resolved during plan


CASE B — Data source DEPENDS on a resource this config creates
──────────────────────────────────────────────────────────────────
data "aws_subnets" "app" {
  filter {
    name   = "vpc-id"
    values = [aws_vpc.new.id]     # <-- depends on a resource not yet created
  }
}

terraform plan
   │
   └─► data.aws_subnets.app shows as "(known after apply)" — cannot be read yet,
       because aws_vpc.new doesn't exist until apply runs

terraform apply
   │
   ├─► Step 1: create aws_vpc.new
   ├─► Step 2: create dependent subnets (if also managed here)
   ├─► Step 3: NOW read data.aws_subnets.app (its dependency now exists)
   └─► Step 4: create anything depending on data.aws_subnets.app
```

Terraform builds a dependency graph from every reference, exactly like it does for resources. If a
`data` block references a resource's attribute, Terraform knows it must defer that read until
*after* that resource is created/updated during `apply` — you'll see `(known after apply)` next to
that data source's attributes in the plan output, which is a completely normal and expected signal,
not an error.

### Common Confusion

People sometimes panic when a `plan` shows `(known after apply)` for a data source and assume
something is broken. It isn't — it just means this particular data source has a dependency on a
resource that doesn't exist yet, so Terraform correctly defers the read to `apply` time instead of
guessing. The plan is still valid; you just won't see the resolved value until `apply` runs.

Another common trap: assuming a data source is read *once* per state and cached forever. In
reality, independent data sources (no dependency on in-flight resources) are re-read on **every**
`plan`, which means the value can genuinely change between two runs — e.g. `data "aws_ami"` might
resolve to a newer AMI ID next week if AWS publishes an update, causing an unexpected instance
replacement if that AMI ID feeds into `ami = ...` on a resource that requires replacement on
change.

### Interview Answer

"Data sources with no dependency on resources managed in the same configuration are read
immediately during `terraform plan`, because there's nothing stopping Terraform from querying the
provider right away. If a data source references an attribute of a resource that this same
configuration will create or modify, Terraform defers that read until `apply`, after the
dependency has actually been created — shown in the plan as `(known after apply)`. This is the
same dependency-graph mechanism Terraform uses for resource-to-resource references."

> **Memory hook:** A scout can survey an old bridge immediately, but has to wait for a brand-new one to finish being built before crossing it.

---

## 6. Common Mistakes

A consolidated list of the traps that trip up almost everyone the first time they use data
sources in a real project:

1. **Zero matches → hard error.** If your `filter` blocks match nothing, Terraform fails the plan
   with "no matching X found" rather than silently returning null. Always sanity-check filters
   against the actual AWS console/CLI before trusting them in Terraform.

2. **Multiple matches on a singular data source.** `data "aws_ami"` without `most_recent = true`
   errors if more than one AMI matches. `data "aws_vpc"` errors if your tag filter matches two
   VPCs. Singular data sources expect exactly one result; use the plural form (`aws_subnets`,
   `aws_amis`) when you actually want a list back.

3. **Treating a data source as a way to "create-if-missing."** There is no such behavior. If the
   object doesn't exist, the plan fails — full stop.

4. **Forgetting the `data.` prefix when referencing.** `aws_vpc.main.id` (no `data.`) looks for a
   *resource* named `aws_vpc.main`; if you only declared a `data "aws_vpc" "main"`, this reference
   fails with "resource not found," which is confusing until you remember the prefix rule.

5. **Assuming values never change between runs.** Unconstrained lookups (like "most recent AMI")
   are a moving target. If you need pinned, reproducible builds, capture the resolved ID once
   (e.g., in a variable or a `.tfvars` file) rather than re-resolving on every apply.

6. **Circular dependency between data and resource.** A data source that filters on a resource's
   attribute, while that resource's config also depends on the data source's output, creates a
   cycle Terraform cannot resolve. Keep the dependency direction one-way.

> **Memory hook:** Data sources are strict librarians — no match, no book, no "let me print you a new one."

---

## 7. Hands-On Exercises

**Exercise 1 — Resolve the Latest Amazon Linux AMI**
Write a `data "aws_ami"` block that finds the most recent Amazon-owned AMI matching
`al2023-ami-*-x86_64` with an EBS root device. Reference it in an `aws_instance` resource and
confirm via `terraform plan` that the AMI ID is resolved (not left as a hard-coded string).

**Exercise 2 — Multi-AZ Subnet Creation**
Use `data "aws_availability_zones"` (filtered to `state = "available"`) combined with `count` to
create one public subnet per available AZ, each with a distinct `/24` CIDR block derived using
`cidrsubnet()`. Print the resulting AZ-to-subnet mapping with an `output` block.

**Exercise 3 — Reference an Existing VPC**
Assume a VPC tagged `Name = "shared-vpc"` already exists in your account (create one manually or
via a throwaway `resource` block first, then treat it as "existing" for this exercise). Write a
`data "aws_vpc"` block that finds it by tag, then a `data "aws_subnets"` block that finds its
private subnets by a `Tier = "private"` tag. Launch an EC2 instance into the first returned subnet.

**Exercise 4 — Diagnose a Broken Filter**
You're given this snippet:
```hcl
data "aws_ami" "broken" {
  owners = ["self"]
  filter {
    name   = "name"
    values = ["al2023-ami-*"]
  }
}
```
Explain, in one paragraph, the most likely reason this returns zero results in a fresh AWS
account, and what change would fix it.

**Exercise 5 — Timing Experiment**
Create a `aws_vpc` resource and a `data "aws_subnets"` block that filters on that resource's `id`.
Run `terraform plan` and observe the output for the data source's attributes. Explain, referencing
what you saw, why they show `(known after apply)`.

---

## 8. Interview Q&A

---

**Q1: What is a Terraform data source, in one sentence?**

A: A `data` block performs a read-only query against a provider's API to fetch information about
existing infrastructure, without creating, modifying, or destroying anything.

---

**Q2: How does a `data` block differ from a `resource` block syntactically and behaviorally?**

A: Syntactically they look almost identical (`type`, `name`, body arguments). Behaviorally,
`resource` arguments configure desired state and drive create/update/destroy actions; `data`
arguments are filter criteria used to find an existing object, and the block only ever performs a
`Read` — it never appears in a create/destroy plan and is unaffected by `terraform destroy`.

---

**Q3: What happens if a data source's filter matches zero results? What if it matches multiple,
for a data source expecting one?**

A: Both are hard errors at plan time. Zero matches raises "no matching resource found"; multiple
matches on a singular data source (like `aws_ami` without `most_recent`, or `aws_vpc` with an
ambiguous tag filter) raises a "multiple results found" error. Terraform refuses to silently guess.

---

**Q4: When is a data source evaluated — plan time or apply time?**

A: It depends on dependencies. If the data source has no reference to a resource managed in the
same configuration, it's read immediately during `plan`. If it references an attribute of a
resource this configuration will create/modify, Terraform defers the read until that resource
exists during `apply`, shown as `(known after apply)` in the plan.

---

**Q5: Why shouldn't you hard-code an AMI ID directly in a resource block?**

A: AMI IDs are region-specific and change every time a new patched image is published (by AWS or
your own AMI pipeline). A hard-coded ID silently goes stale, may not even exist in a different
region, and prevents automatically picking up security patches. `data "aws_ami"` with `most_recent
= true` and name/owner filters resolves to the current correct ID dynamically.

---

**Q6: Give an example of a real scenario where you'd need a data source instead of a resource.**

A: Referencing a VPC and subnets created by a separate networking team's Terraform state, so an
application team's EC2 instances land in the correct existing network without importing (and
thus taking ownership/risk of destroying) that shared infrastructure.

---

**Q7: What does `(known after apply)` mean next to a data source's attribute in a plan?**

A: It means this data source depends on a resource that hasn't been created/updated yet in this
same run, so Terraform cannot read the real value until `apply` actually creates that dependency.
It's expected behavior, not an error — the read is simply deferred to the correct point in the
apply sequence.

---

**Q8: Are data source values cached forever once resolved?**

A: No — independent data sources (with no in-flight resource dependency) are re-queried on every
`plan`/`apply`. This means values like "the most recent AMI" can change between runs, which is
useful for staying current but can also cause unexpected resource replacement if that value feeds
into an immutable resource argument. Pin the value explicitly (e.g., via a variable) if
reproducibility matters more than freshness.
