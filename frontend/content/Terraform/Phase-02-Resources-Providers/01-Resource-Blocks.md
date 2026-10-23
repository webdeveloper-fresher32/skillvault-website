# 01 — Resource Blocks

## Table of Contents

1. [Anatomy of a Resource Block](#1-anatomy-of-a-resource-block)
2. [Resource Addressing](#2-resource-addressing)
3. [Implicit vs Explicit Dependencies (Preview)](#3-implicit-vs-explicit-dependencies-preview)
4. [Reading Resource Documentation](#4-reading-resource-documentation)
5. [Attribute Reference vs Argument](#5-attribute-reference-vs-argument)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Anatomy of a Resource Block

Imagine you've just written your first line of Terraform: you want one S3 bucket to exist in
AWS. You didn't SSH into a server, you didn't click through the AWS console, you didn't call an
SDK method — you wrote a block of text describing the bucket you want, ran one command, and it
appeared. That block of text is a **resource block**, and it's the single most important building
block in the entire language. Every other Terraform concept — state, providers, modules,
dependencies — exists to support resource blocks doing their job well.

A resource block always has the same three-part skeleton:

```hcl
resource "aws_s3_bucket" "reports" {
  bucket = "my-company-quarterly-reports"

  tags = {
    Environment = "production"
    Team        = "finance"
  }
}
```

### Analogy

Think of a resource block like an order form at a custom furniture shop. The **resource type**
(`aws_s3_bucket`) is which catalogue page you're ordering from — "bookshelves," not "chairs." The
**local name** (`reports`) is the label *you* write on the order slip so you (and the shop) can
refer to "that specific order" later, even though the shop makes thousands of bookshelves. The
**arguments** inside the `{ }` (bucket name, tags, versioning settings) are the customization
options on the form — wood type, dimensions, finish. The shop (the provider) reads your form and
builds exactly what you specified.

### The Three Parts

```
resource "aws_s3_bucket" "reports" {
    │           │            │        │
    │           │            │        └── Arguments: the configuration you're setting
    │           │            └─────────── Local name: YOUR reference name (not sent to AWS)
    │           └──────────────────────── Resource type: tells Terraform which provider +
    │                                     which AWS API this maps to
    └──────────────────────────────────── Keyword: always literally "resource"
```

Breaking down `aws_s3_bucket`:
- The prefix `aws_` tells Terraform which **provider** owns this resource type (the AWS provider).
- The rest, `s3_bucket`, tells the provider which specific AWS API/resource to manage (the S3
  `CreateBucket`/`PutBucket*` family of calls).

The **local name** (`reports`) lives only inside your Terraform configuration and state — it is
never sent to AWS and never appears in the AWS console. AWS only ever sees the *arguments* you
provide (the actual bucket name `"my-company-quarterly-reports"`, the tags, etc).

### Under the Hood

When you run `terraform apply`, Terraform doesn't talk to AWS directly. It talks to the **AWS
provider plugin**, a separate binary that Terraform downloaded during `terraform init`. The
provider translates your HCL arguments into actual AWS API calls.

```
┌────────────────────────────────────────────────────────────────┐
│                     YOUR .tf FILES (HCL)                        │
│  resource "aws_s3_bucket" "reports" { bucket = "..." }           │
└────────────────────────────┬─────────────────────────────────────┘
                             │  terraform apply
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    TERRAFORM CORE                                │
│  Parses HCL → builds dependency graph → walks graph in order    │
│  Diffs desired state vs current state → decides create/update/  │
│  destroy for each resource                                       │
└────────────────────────────┬─────────────────────────────────────┘
                             │  gRPC calls (plugin protocol)
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                 AWS PROVIDER PLUGIN (terraform-provider-aws)     │
│  Translates HCL arguments → AWS SDK calls                        │
│  aws_s3_bucket → s3.CreateBucket(), s3.PutBucketTagging(), ...   │
└────────────────────────────┬─────────────────────────────────────┘
                             │  HTTPS (AWS API, SigV4 signed)
                             ▼
                        AWS S3 SERVICE
```

Terraform Core itself has zero knowledge of what an S3 bucket is — it only knows how to walk a
dependency graph and call "create," "read," "update," or "delete" on whatever plugin is
registered for a resource type. All the AWS-specific knowledge lives in the provider plugin.

### Example

A slightly more realistic resource block, showing several argument types at once:

```hcl
resource "aws_instance" "web_server" {
  ami           = "ami-0c94855ba95c71c99"   # Amazon Linux 2 (region-specific)
  instance_type = "t3.micro"
  subnet_id     = "subnet-0123456789abcdef0"

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name        = "web-server-1"
    Environment = "staging"
  }
}
```

Notice `root_block_device` is a **nested block** inside the resource, not a top-level argument —
some resource types group related settings this way. You'll learn to tell blocks from arguments
by reading the provider docs (section 4).

### Common Mistakes

- **Confusing the local name with the real-world name.** `resource "aws_s3_bucket" "reports"`
  does *not* create a bucket named "reports" — the actual bucket name comes from the `bucket`
  argument. Beginners often assume the local name is sent to the cloud provider; it never is.
- **Reusing a local name within the same resource type.** `aws_instance.web_server` must be
  unique among all `aws_instance` resources in the same module — Terraform will error with
  "resource already declared" if you duplicate it.
- **Forgetting required arguments.** Some arguments are optional (Terraform will use a provider
  default), others are required, and running `terraform plan` will immediately fail with a clear
  "argument is required" error if you miss one — this is not a runtime AWS error, it's caught
  before any API call is made.

### Interview Answer

"A resource block is Terraform's fundamental unit of infrastructure declaration. It has a
resource type that tells Terraform which provider and which underlying API to use, a local name
that's only used for referencing the resource within Terraform configuration and state, and a
body of arguments that map to the real configuration of the cloud object. Terraform Core reads
the block, builds a dependency graph, and delegates the actual create/read/update/delete calls to
the provider plugin that owns that resource type."

> **Memory hook:** `resource "TYPE" "NAME" { ARGS }` is an order form — the type is the catalogue page, the name is your reference label, and the arguments are what actually gets built.

---

## 2. Resource Addressing

Say you provision a VPC, and now you need a subnet inside that VPC — but you don't know the VPC's
ID yet, because AWS assigns it only *after* the VPC is created. Do you run `terraform apply`,
copy the ID from the output, and paste it into the subnet's config by hand? That would defeat the
entire purpose of "infrastructure as code." Instead, Terraform lets you write a reference — an
**address** — that points at another resource's attribute, and Terraform resolves it
automatically once that resource exists.

### Analogy

Resource addressing is like using a cell reference in a spreadsheet (`=A1+B2`) instead of typing
in a hardcoded number. You don't type "10" into a formula cell — you type `=A1`, and if A1's value
changes, your formula updates automatically. `aws_vpc.main.id` is Terraform's version of `=A1`: a
live pointer to a value that doesn't exist yet when you write the reference.

### The Address Format

Every resource in Terraform has a unique address made of `<resource_type>.<local_name>`, and you
can drill into any of its exported attributes with a dot:

```
aws_vpc.main.id
   │      │   │
   │      │   └── Attribute: an exported value from THIS resource (its VPC ID, assigned by AWS)
   │      └──────  Local name
   └───────────── Resource type
```

### Example

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id          # ← addressing aws_vpc.main's "id" attribute
  cidr_block = "10.0.1.0/24"

  tags = {
    Name = "public-subnet"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id              # ← same address, reused elsewhere
}

output "vpc_id" {
  value = aws_vpc.main.id               # ← addresses can be used outside resource blocks too
}
```

`aws_vpc.main.id` appears in the subnet, the internet gateway, and the output block. It always
resolves to the same value: the real AWS-assigned VPC ID, once `aws_vpc.main` has been created.

### Under the Hood

```
Configuration time (you write this):
    aws_subnet.public.vpc_id = aws_vpc.main.id     ← an unresolved reference

Graph-build time (terraform plan):
    Terraform sees the reference → adds an edge:
        aws_vpc.main  ──must come before──▶  aws_subnet.public

Apply time:
    1. Terraform creates aws_vpc.main first (graph order)
    2. AWS returns vpc-0abc123... as the real ID
    3. Terraform substitutes that literal string wherever aws_vpc.main.id was referenced
    4. Terraform creates aws_subnet.public using vpc_id = "vpc-0abc123..."
```

The reference isn't just convenient syntax — it's the mechanism that tells Terraform *which order*
to create things in. This is the same mechanism covered in depth in lesson 3 as "implicit
dependencies."

### Common Confusion

- **Addressing a resource's local name is not the same as its real ID.** `aws_vpc.main` is a
  Terraform-internal handle; `aws_vpc.main.id` is the actual `vpc-xxxxxxxx` string AWS assigned.
  You almost always want the latter when passing values between resources.
- **Not every argument is available as an attribute.** You can only reference values the provider
  *exports* — usually a mix of arguments you set (like `cidr_block`, echoed back) and
  computed-only values assigned by the API (like `id`, `arn`). Check the "Attribute Reference"
  section of the docs (lesson section 4) to know what's available.
- **Addresses used in `terraform state` commands look similar but aren't quite the same syntax**
  as HCL references — e.g. `terraform state show aws_vpc.main` uses the same dotted address, but
  `terraform import aws_vpc.main vpc-0abc123` takes the *real* AWS ID as its second argument, not
  another Terraform address.

### Interview Answer

"Resource addressing is `resource_type.local_name`, optionally followed by `.attribute_name` to
pull a specific value out of that resource — either an argument you set or a value computed by
the provider, like an AWS-assigned ID or ARN. Referencing another resource's attribute is how
Terraform passes real, only-known-at-apply-time values (like a VPC ID) between resources without
you hardcoding them, and it's also exactly how Terraform infers the order resources must be
created in."

> **Memory hook:** `aws_vpc.main.id` is a spreadsheet cell reference, not a hardcoded value — it updates itself once the real thing exists.

---

## 3. Implicit vs Explicit Dependencies (Preview)

You've just seen that writing `aws_vpc.main.id` inside a subnet block makes Terraform create the
VPC first. But what if two resources need to happen in a specific order and *neither* one
references the other's attributes at all — say, an IAM policy that must exist before an
application starts reading from it, even though the app resource never mentions the policy's ID?
Terraform has no way to see that relationship on its own. This section is a short preview;
lesson 3 covers dependency graphs and `depends_on` in full depth.

### The Two Kinds of Dependency

| Kind | How Terraform learns about it | Example |
|------|-------------------------------|---------|
| **Implicit** | Automatically, by scanning for `resource_type.name.attribute` references in your HCL | `vpc_id = aws_vpc.main.id` |
| **Explicit** | You tell it directly with the `depends_on` meta-argument | `depends_on = [aws_iam_role_policy.app]` |

### Quick Example

```hcl
# Implicit — Terraform sees the reference and infers order automatically
resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}

# Explicit — no attribute reference exists, so you must state the order yourself
resource "aws_instance" "app" {
  ami           = "ami-0c94855ba95c71c99"
  instance_type = "t3.micro"

  depends_on = [aws_iam_role_policy.app_permissions]
}
```

### Analogy

Implicit dependency is like a recipe step that says "add the sauce you made in step 2" — the
order is obvious from the ingredients listed. Explicit dependency is a chef's note that says "wait
for the oven to preheat before this step" even though preheating isn't an ingredient in the dish —
you have to say it out loud because nothing in the recipe's data implies it.

### Common Confusion

Beginners often reach for `depends_on` far too early — as a blanket "just in case" safety net.
Overusing it removes Terraform's ability to parallelize unrelated resources and can hide real bugs
in your configuration. The rule of thumb: if an attribute reference already exists between two
resources, you never need `depends_on` for that relationship — it's redundant. Save `depends_on`
for the rare cases with no attribute link, like IAM eventual-consistency issues or resources that
affect each other only through side effects outside Terraform's view.

### Interview Answer

"Terraform infers most dependencies implicitly by scanning resource arguments for references to
other resources' attributes — if resource B's config contains `resource_a.foo.id`, Terraform
knows A must be created first. When no such reference exists but an ordering requirement still
does — usually because of a side effect the provider API doesn't expose as an attribute —
you declare it explicitly with `depends_on`."

> **Memory hook:** Implicit = "the recipe says so" (visible in the ingredients). Explicit = "the chef says so" (a rule you had to state out loud). Full depth on this in lesson 3.

---

## 4. Reading Resource Documentation

You will never memorize every argument of every resource type across every cloud provider — nobody
does. What separates a productive Terraform user from a stuck one is knowing *where* to look and
*how* to read what's there quickly. That place is the Terraform Registry.

### Analogy

The Terraform Registry is like the datasheet for an electronic component. You don't guess which
pins do what on a microcontroller — you pull up its datasheet, find the pinout diagram, and read
which pins are inputs, which are outputs, and which are optional. Resource documentation pages
work the same way: a fixed structure you learn to scan quickly instead of reading top to bottom
every time.

### Where to Look

Every resource type's docs live at:

```
https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/<resource_name_without_prefix>
```

For example, `aws_s3_bucket` docs are at:
`.../docs/resources/s3_bucket`

### Anatomy of a Docs Page

```
┌─────────────────────────────────────────────────────────────┐
│  Resource: aws_s3_bucket                                     │
├─────────────────────────────────────────────────────────────┤
│  Example Usage        ← copy-pasteable starter HCL block     │
├─────────────────────────────────────────────────────────────┤
│  Argument Reference    ← everything YOU can set              │
│    - bucket (Optional) String                                 │
│    - force_destroy (Optional) Bool, default false              │
│    - tags (Optional) Map of String                             │
├─────────────────────────────────────────────────────────────┤
│  Attribute Reference   ← everything the PROVIDER exports      │
│    - id           - The name of the bucket                    │
│    - arn           - The ARN of the bucket                    │
│    - bucket_domain_name                                       │
├─────────────────────────────────────────────────────────────┤
│  Import                ← the `terraform import` command syntax│
│  Timeouts               ← create/update/delete timeout config │
└─────────────────────────────────────────────────────────────┘
```

### Example — Using the Docs to Write Config

Say you look up `aws_security_group` and see this in the Argument Reference:

```
- name (Optional) - Name of the security group. If omitted, Terraform will
  assign a random, unique name.
- vpc_id (Optional, Forces new resource) - VPC ID.
- ingress (Optional) - Configuration block for ingress rules (can be
  specified multiple times).
```

That directly tells you how to write:

```hcl
resource "aws_security_group" "web" {
  name   = "web-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

The phrase **"Forces new resource"** next to `vpc_id` is a critical detail: it means changing that
argument after creation doesn't update the security group in place — Terraform will destroy and
recreate it. Docs flag this explicitly so you're never surprised by an unexpected destroy/recreate
during `terraform plan`.

### Common Mistakes

- **Reading a different provider version's docs than the one you're pinned to.** The Registry
  defaults to "latest" — use the version dropdown to match your `required_providers` constraint
  (covered in lesson 2), since arguments are added, renamed, and deprecated across versions.
- **Skipping the "Forces new resource" annotations**, then being surprised when `terraform plan`
  shows a destroy+recreate instead of an in-place update.
- **Not checking the Import section** before trying to bring an existing, manually-created AWS
  resource under Terraform management.

### Interview Answer

"The Terraform Registry documents every resource with a consistent structure: example usage,
an Argument Reference for what you can configure, an Attribute Reference for what the provider
exposes back to you, and an Import section for adopting existing infrastructure. Reading the
'Forces new resource' annotations is especially important — they tell you which argument changes
will trigger a destroy-and-recreate instead of an in-place update, which matters a lot for
anything stateful, like a database."

> **Memory hook:** The Registry page is a datasheet — Argument Reference is the input pins, Attribute Reference is the output pins.

---

## 5. Attribute Reference vs Argument

Here's a subtle trap: you write `resource "aws_instance" "web" { instance_type = "t3.micro" }`
and later try to reference `aws_instance.web.public_ip`. That works — but if you try to *set*
`public_ip` as an argument yourself, Terraform will error, because `public_ip` isn't something you
configure, it's something AWS decides and hands back to you. Understanding which values are
inputs you control versus outputs you can only read is essential to not fighting the provider.

### Analogy

Think of a resource block like a car's dashboard. **Arguments** are the controls you touch — the
steering wheel, the pedals, the climate dial. **Attributes** are the gauges — speed, fuel level,
engine temperature. You can turn the steering wheel (an argument), but you cannot "set" the
speedometer to 80 mph by touching it (that's a computed attribute reporting reality back to you).

### Comparison Table

| | Argument | Attribute |
|---|---|---|
| **Direction** | You → provider (input) | Provider → you (output) |
| **Where it appears in docs** | "Argument Reference" | "Attribute Reference" |
| **Can you set it in the resource block?** | Yes | Usually no — some values are both (e.g. `cidr_block` is an argument you set AND an attribute you can read back) |
| **When is the value known?** | You know it at write time (mostly) | Often unknown until after `apply` (e.g. AWS-assigned IDs) |
| **Example** | `instance_type = "t3.micro"` | `aws_instance.web.public_ip` |
| **Editable after creation?** | Depends — some force recreation, some update in place | Never directly — it just reflects current real-world state |

### Example

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c94855ba95c71c99"   # argument — you set this
  instance_type = "t3.micro"                # argument — you set this

  # public_ip is NOT set here — it doesn't exist yet, AWS assigns it
}

output "web_public_ip" {
  value = aws_instance.web.public_ip        # attribute — reading a computed value
}

output "web_ami_echoed_back" {
  value = aws_instance.web.ami              # some fields are BOTH argument and attribute
}
```

### Under the Hood

```
BEFORE apply:                          AFTER apply:
┌─────────────────────────┐            ┌─────────────────────────┐
│ ami            = "ami-.." │  ──apply─▶ │ ami            = "ami-.." │  (argument, echoed)
│ instance_type  = "t3.micro"│           │ instance_type  = "t3.micro"│  (argument, echoed)
│ public_ip      = (unknown) │           │ public_ip      = "3.91.x.x"│  (attribute, now known)
│ id             = (unknown) │           │ id             = "i-0abc.."│  (attribute, now known)
└─────────────────────────┘            └─────────────────────────┘
```

Before you run `apply`, `terraform plan` shows computed attributes as `(known after apply)` —
that literal phrase in plan output is Terraform telling you "this is an attribute, not an
argument, and I can't know it until the provider creates the real object."

### Common Confusion

- **Trying to set a computed-only attribute as if it were an argument** — Terraform's schema
  validation rejects this immediately (e.g. you cannot set `aws_instance.web.id = "..."`; `id`
  is always computed).
- **Assuming `(known after apply)` means an error** — it's completely normal for any attribute
  whose real value only exists once the cloud provider creates the resource.
- **Confusing "Optional" arguments with attributes.** An optional argument is still something
  *you* can choose to set (with a provider-supplied default if you don't); an attribute is never
  something you set at all.

### Interview Answer

"Arguments are the inputs you configure in a resource block; attributes are outputs the provider
exposes, some computed only after the real infrastructure is created — like an AWS-assigned ID or
public IP. Some fields, like `ami` or `cidr_block`, function as both: you provide them as an
argument, and the provider echoes them back as a readable attribute. `terraform plan` shows
attributes it can't yet resolve as `(known after apply)`, which just means the value depends on
the provider actually creating the resource."

> **Memory hook:** Arguments are the steering wheel — you touch them. Attributes are the speedometer — you read them, you don't turn them.

---

## 6. Hands-On Exercises

**Exercise 1 — Write Your First Resource Block**
Write a resource block for an `aws_s3_bucket` named `assets` with a real bucket name of your
choosing, plus two tags: `Environment = "dev"` and `Owner` set to your own name.

**Exercise 2 — Resource Addressing Chain**
Write three resource blocks: an `aws_vpc`, an `aws_subnet` that uses the VPC's `id`, and an
`aws_instance` that uses the subnet's `id`. Draw (in comments or on paper) the dependency chain
this creates.

**Exercise 3 — Argument vs Attribute Audit**
Open the Terraform Registry page for `aws_db_instance` (an RDS instance). List three fields from
the Argument Reference and three fields from the Attribute Reference. Which fields are marked
"Forces new resource"?

**Exercise 4 — Spot the Bug**
What's wrong with this configuration? Explain the error you'd get from `terraform plan`.

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c94855ba95c71c99"
  instance_type = "t3.micro"
  id            = "i-0123456789abcdef0"
}
```

**Exercise 5 — Local Name Collision**
Two teammates each write a `resource "aws_instance" "server"` block in the same root module,
each with different AMIs. What happens when both are merged into the same `.tf` directory? How
would you fix it?

---

## 7. Interview Q&A

---

**Q1: What are the three parts of a resource block?**

A: The resource type (which provider and API it maps to, e.g. `aws_s3_bucket`), the local name
(a Terraform-only reference label, never sent to the cloud provider), and the body of arguments
that configure the actual infrastructure.

---

**Q2: Does the local name in a resource block affect the real infrastructure?**

A: No. The local name exists only within your Terraform configuration and state file, purely so
you and Terraform can refer to that specific resource elsewhere. The real-world name (e.g. an S3
bucket's name) comes entirely from the arguments you set, such as the `bucket` argument.

---

**Q3: How do you reference one resource's value from another resource?**

A: Using its address: `resource_type.local_name.attribute_name`, e.g. `aws_vpc.main.id`. This
pulls a value — either an argument you set or an attribute computed by the provider — and
Terraform substitutes the real value once that resource is created.

---

**Q4: What does `(known after apply)` mean in a `terraform plan` output?**

A: It means the value of that attribute cannot be determined until the resource is actually
created or updated by the provider — typically because the cloud API assigns it, like an
instance ID or a public IP address. It is expected behavior, not an error.

---

**Q5: What's the difference between an argument and an attribute?**

A: Arguments are inputs you configure inside a resource block. Attributes are outputs the
provider exposes about that resource, some of which are only known after `apply`. Some fields
(like `cidr_block`) act as both — you set them as an argument and can also read them back as an
attribute.

---

**Q6: Where would you look up which arguments a resource type supports?**

A: The Terraform Registry, at
`registry.terraform.io/providers/<namespace>/<provider>/latest/docs/resources/<resource_name>`.
Each page has an Argument Reference (what you can configure), an Attribute Reference (what you
can read), and an Import section.

---

**Q7: What does "Forces new resource" mean in the documentation?**

A: It flags an argument that cannot be updated in place — changing it causes Terraform to destroy
the existing resource and create a new one. This is critical to check before changing arguments on
stateful resources like databases, since it can imply data loss.

---

**Q8: How does Terraform decide the order to create two resources in, without you specifying it?**

A: If one resource's arguments reference another resource's attribute (e.g.
`vpc_id = aws_vpc.main.id`), Terraform automatically infers an implicit dependency and creates the
referenced resource first. This is detailed further in lesson 3 on dependency graphs.
