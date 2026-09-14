# 02 — Expressions & Functions

## Table of Contents

1. [Expression Basics](#1-expression-basics)
2. [Built-in Functions Overview](#2-built-in-functions-overview)
3. [Splat Expressions](#3-splat-expressions)
4. [Dynamic Blocks](#4-dynamic-blocks)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Expression Basics

Say you need a security group name that includes the environment (`prod`, `staging`), the region,
and the app name — all glued together, all computed from variables you already have, none of it
typed out by hand for every environment. Or you need to check "is this list non-empty?" before
deciding whether to create a resource. You're not writing a full programming language here — HCL
is deliberately *not* Turing-complete — but you still need a way to compute values from other
values. That's what **expressions** are: any piece of HCL that resolves to a value, rather than
declaring a block.

### Analogy

Think of an HCL expression like a cell formula in a spreadsheet. You don't type the literal number
`42` into cell C1 — you type `=A1+B1`, and the spreadsheet recalculates it live whenever A1 or B1
change. A Terraform expression is exactly that formula bar: `"${var.env}-${var.app}-sg"` recomputes
automatically whenever `var.env` or `var.app` change, without you ever retyping the final string.

### Categories of Expressions

| Category | Example | What it does |
|---|---|---|
| **References** | `var.instance_type`, `aws_vpc.main.id`, `local.name`, `data.aws_ami.x.id` | Pull a value from another block |
| **Literals** | `"hello"`, `42`, `true`, `["a", "b"]`, `{ key = "val" }` | A value written directly |
| **Operators** | `a + b`, `a == b`, `a && b`, `!a` | Arithmetic, comparison, logical |
| **String interpolation** | `"${var.env}-app"` | Embed an expression inside a string |
| **Conditionals** | `var.env == "prod" ? "large" : "small"` | Choose between two values |
| **Function calls** | `upper(var.name)`, `length(var.list)` | Transform a value via a built-in function |
| **For expressions** | `[for s in var.subnets : s.id]` | Transform a collection (covered in lesson 03) |

### Reference Expressions — the Most Common Kind

```hcl
variable "environment" {
  type    = string
  default = "staging"
}

resource "aws_instance" "web" {
  instance_type = var.environment == "prod" ? "t3.large" : "t3.micro"

  tags = {
    Name = "${var.environment}-web-server"   # string interpolation
  }
}
```

Since Terraform 0.12, when an entire expression is a single interpolation (nothing else in the
string), you should drop the `${...}` wrapper entirely — write `var.environment`, not
`"${var.environment}"`, when the value isn't being embedded inside other text. The wrapper is only
needed when you're gluing an expression *into* a larger string, like `"${var.environment}-web"`.

### Under the Hood

```
HCL Parser reads:  "${var.environment}-web-server"
                              │
                              ▼
                 Build expression AST:
                 StringConcat(
                   Reference(var.environment),
                   Literal("-web-server")
                 )
                              │
                              ▼
      Terraform's graph walker resolves var.environment's
      value (from -var, .tfvars, default, or env var)
                              │
                              ▼
             Final string: "staging-web-server"
```

Every expression becomes a node in Terraform's dependency graph. If `var.environment` were instead
`aws_instance.other.id` (a resource attribute), Terraform would know this expression can't be
resolved until `aws_instance.other` is created — exactly the same deferred-evaluation mechanic you
saw with data sources in the previous lesson.

### Common Confusion

A common early mistake is wrapping every reference in `${...}` out of habit from older Terraform
versions (pre-0.12) or from shell scripting. In modern Terraform, `${}` is *only* needed when an
expression is embedded inside a larger string literal. `resource_type = "${var.type}"` (whole
string is just the interpolation) triggers a linter warning; `resource_type = var.type` is the
idiomatic form. Reserve `${}` for cases like `"prefix-${var.type}-suffix"`.

### Interview Answer

"An expression in Terraform is anything that computes a value — a variable reference, a literal, an
operator expression, a function call, or a conditional. HCL is declarative and not
Turing-complete, so expressions are the mechanism for computing values from other values without
writing imperative logic. They're resolved as part of Terraform's dependency graph, so an
expression referencing an unresolved resource attribute is deferred to apply time just like a data
source would be."

> **Memory hook:** An HCL expression is a spreadsheet formula — you write `=A1+B1` once, and it recalculates itself forever.

---

## 2. Built-in Functions Overview

Once you can reference values, the next question is: how do you *transform* them? Turn a list into
a comma-separated string for a tag? Compute a subnet CIDR block from a parent VPC CIDR? Read a
JSON file from disk into a native HCL object? Terraform ships with a large standard library of
**built-in functions** for exactly this — and critically, you cannot write your *own* functions in
HCL (no user-defined functions exist), so knowing the built-in library well is the difference
between clean, expressive Terraform and configuration full of copy-pasted near-duplicate blocks.

### Analogy

Think of Terraform's built-in functions like the formula palette in a spreadsheet app —
`SUM()`, `VLOOKUP()`, `CONCATENATE()`. You don't write your own `SUM` from scratch; you memorize
the handful you use constantly (`SUM`, `IF`, `VLOOKUP`) and look up the rest when needed. Terraform
functions work the same way: a small "daily driver" set, and a big reference catalog behind it.

### Function Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                     TERRAFORM BUILT-IN FUNCTIONS                 │
├───────────────┬───────────────┬───────────────┬─────────────────┤
│    String     │    Numeric    │   Collection   │  Encoding /     │
│               │               │                │  Filesystem     │
├───────────────┼───────────────┼───────────────┼─────────────────┤
│ upper()       │ max()         │ length()       │ jsonencode()    │
│ lower()       │ min()         │ merge()        │ jsondecode()    │
│ trim()        │ ceil()        │ concat()       │ base64encode()  │
│ join()        │ floor()       │ contains()     │ file()          │
│ split()       │ abs()         │ keys() / values│ templatefile()  │
│ replace()     │ pow()         │ lookup()       │ yamlencode()    │
│ format()      │ parseint()    │ flatten()      │ filebase64()    │
└───────────────┴───────────────┴───────────────┴─────────────────┘
```

| Function | Category | Purpose | Example |
|---|---|---|---|
| `upper(str)` | String | Uppercase a string | `upper("prod")` → `"PROD"` |
| `format(fmt, ...)` | String | printf-style formatting | `format("%s-%03d", "web", 7)` → `"web-007"` |
| `join(sep, list)` | String | Join a list into one string | `join(",", ["a","b"])` → `"a,b"` |
| `split(sep, str)` | String | Split a string into a list | `split(",", "a,b")` → `["a","b"]` |
| `length(x)` | Collection | Count items/chars | `length(var.subnets)` → `3` |
| `merge(map1, map2)` | Collection | Merge maps (later keys win) | `merge({a=1}, {b=2})` → `{a=1, b=2}` |
| `lookup(map, key, default)` | Collection | Safe map access with fallback | `lookup(var.tags, "Owner", "unknown")` |
| `contains(list, val)` | Collection | Check membership | `contains(["a","b"], "a")` → `true` |
| `cidrsubnet(prefix, newbits, netnum)` | Numeric/Network | Compute a subnet CIDR | `cidrsubnet("10.0.0.0/16", 8, 2)` → `"10.0.2.0/24"` |
| `jsonencode(value)` | Encoding | HCL value → JSON string | Used for IAM policy documents |
| `jsondecode(str)` | Encoding | JSON string → HCL value | Parsing an API response file |
| `file(path)` | Filesystem | Read a file's raw contents | `file("${path.module}/user-data.sh")` |
| `templatefile(path, vars)` | Filesystem | Render a template file with variables | See below |

### Concrete Example — Combining Several

```hcl
locals {
  # String + numeric: build a padded, uppercase name
  instance_name = format("%s-%s-%03d", upper(var.project), var.environment, 1)

  # Collection: merge default tags with per-resource tags
  common_tags = merge(
    { ManagedBy = "Terraform", Project = var.project },
    var.extra_tags
  )

  # Encoding: build an IAM policy document as JSON from an HCL map
  policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "arn:aws:s3:::${var.bucket_name}/*"
    }]
  })
}

resource "aws_iam_policy" "read_only" {
  name   = "${var.project}-s3-read"
  policy = local.policy_json
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t3.micro"
  user_data     = templatefile("${path.module}/templates/init.sh.tpl", {
    environment = var.environment
    app_port    = 8080
  })

  tags = local.common_tags
}
```

Where `templates/init.sh.tpl` looks like:

```bash
#!/bin/bash
echo "Deploying to ${environment} on port ${app_port}"
```

### Common Mistakes

- **Trying to define a custom function.** HCL has no `function` keyword — everything must be
  composed from built-ins plus `local` values. If you find yourself wanting a reusable
  transformation, wrap it in a `locals` block or a child module instead.
- **Confusing `join`/`split` direction.** `join(separator, list)` takes the separator *first*;
  it's easy to accidentally swap the arguments coming from other languages' string methods.
- **Forgetting `jsonencode` for IAM policies.** Writing an IAM policy as a raw heredoc string is
  fragile and easy to break with a missing comma; `jsonencode({...})` on a native HCL map is
  validated by the HCL parser itself, catching structural mistakes before they ever reach AWS.
- **Using `file()` when you need variable substitution.** `file()` returns raw, unmodified
  content — no `${...}` in it gets substituted. If you need to inject variables into a file's
  content, you need `templatefile()`, not `file()`.

### Interview Answer

"Terraform ships a large standard library of built-in functions across categories — string,
numeric, collection, encoding, filesystem, date/time, and networking (like `cidrsubnet`) — because
HCL has no way to define custom functions. Common ones I use daily are `merge()` for combining tag
maps, `jsonencode()` for IAM policy documents, `templatefile()` for rendering user-data scripts
with variables, and `cidrsubnet()` for deriving subnet ranges from a VPC CIDR without hard-coding
them."

> **Memory hook:** Terraform functions are the spreadsheet's built-in formula palette — you can't write your own `SUM`, but you rarely need to.

---

## 3. Splat Expressions

Imagine you created five subnets with `count = 5`, and now you need just their IDs as a flat list
— to pass into a load balancer's `subnets` argument, say. Writing `[aws_subnet.public[0].id,
aws_subnet.public[1].id, aws_subnet.public[2].id, ...]` by hand doesn't scale, and it breaks the
moment `count` changes. You want a shorthand that says "give me this one attribute, from *every*
instance of this resource, as a list." That shorthand is the **splat expression**.

### Analogy

A splat expression is like asking a group of people "everyone, hold up your ID card" and taking a
single photo that captures all the ID numbers at once — instead of walking up to each person
individually and writing down their number one by one.

### Syntax

```hcl
# Splat: get the .id attribute from every element of a list/count/for_each resource
aws_subnet.public[*].id

# Equivalent, more verbose "for expression" form (see lesson 03):
[for s in aws_subnet.public : s.id]
```

### Concrete Example

```hcl
resource "aws_subnet" "public" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
}

resource "aws_lb" "app" {
  name               = "app-lb"
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id   # splat: all 3 subnet IDs as a list
}

output "subnet_ids" {
  value = aws_subnet.public[*].id
}
```

If instead you'd used `for_each` (producing a *map* of resource instances rather than a list),
splat syntax (`[*]`) doesn't directly apply the same way — you'd reach for a `for` expression over
`values(aws_subnet.public)` instead. Splat is specifically the shorthand for **list-like**
(`count`-based) resource references.

### Under the Hood

```
aws_subnet.public         (count = 3, so this is a LIST of 3 resource instances)
   │
   ├── [0] { id = "subnet-aaa", cidr_block = "10.0.0.0/24", ... }
   ├── [1] { id = "subnet-bbb", cidr_block = "10.0.1.0/24", ... }
   └── [2] { id = "subnet-ccc", cidr_block = "10.0.2.0/24", ... }

aws_subnet.public[*].id
   │
   ▼
["subnet-aaa", "subnet-bbb", "subnet-ccc"]     ← flat list of just the .id attribute
```

### Common Confusion

Splat expressions silently return an **empty list** if the resource has `count = 0`, rather than
erroring — this is usually the desired behavior (e.g., an optional resource block gracefully
resolves to `[]`), but it can mask a bug if you expected the resource to definitely exist. Also,
`[*]` only works on resources created with `count` (list-like); it is *not* the syntax for
attribute access on a single resource instance — `aws_instance.web.id` (no `count` used) needs no
splat at all.

### Interview Answer

"A splat expression, `resource[*].attribute`, extracts a single attribute from every instance of a
`count`-based resource and returns it as a flat list — shorthand for the equivalent `for`
expression `[for r in resource : r.attribute]`. It's commonly used to pass a list of IDs (subnets,
security groups) into an argument that expects a list, like an ALB's `subnets` argument."

> **Memory hook:** Splat is "everyone hold up your ID card" — one photo captures every instance's attribute in one flat list.

---

## 4. Dynamic Blocks

Security groups need a variable number of `ingress` rules — sometimes one port, sometimes five,
sometimes driven entirely by a list passed in from a variable. But `ingress { ... }` is a *nested
block*, not an argument — and you can't use `count` or `for_each` directly on a nested block the
way you can on a whole resource. So how do you generate a variable number of repeated nested
blocks from a list or map? That's exactly the gap `dynamic` blocks close.

### Analogy

A `dynamic` block is like a mail-merge template in a word processor: you have one paragraph shape
("Dear [NAME], your appointment is at [TIME]") and a spreadsheet of many rows — the mail-merge
tool stamps out one filled-in paragraph per row, without you writing the paragraph out N times by
hand.

### Syntax

```hcl
dynamic "<BLOCK_NAME>" {
  for_each = <collection>
  content {
    <argument> = <BLOCK_NAME>.value.<field>
  }
}
```

By default the iterator variable is named after the block (here, matching `<BLOCK_NAME>`), but you
can rename it with an `iterator` argument if it would otherwise shadow something.

### Concrete Example

```hcl
variable "ingress_rules" {
  type = list(object({
    description = string
    port        = number
    protocol    = string
    cidr_blocks = list(string)
  }))
  default = [
    {
      description = "HTTP"
      port        = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    },
    {
      description = "HTTPS"
      port        = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    },
    {
      description = "SSH from office"
      port        = 22
      protocol    = "tcp"
      cidr_blocks = ["203.0.113.0/24"]
    }
  ]
}

resource "aws_security_group" "app" {
  name   = "app-sg"
  vpc_id = aws_vpc.main.id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      description = ingress.value.description
      from_port   = ingress.value.port
      to_port     = ingress.value.port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

This single `dynamic "ingress"` block expands, at plan time, into exactly three real `ingress`
blocks — one per element in `var.ingress_rules` — without you writing any of them out literally.
Add a fourth rule to the variable and a fourth `ingress` block appears automatically, with zero
changes to the resource's HCL.

### Under the Hood

```
dynamic "ingress" { for_each = var.ingress_rules ... }
                    │
                    ▼
   Terraform iterates var.ingress_rules (3 items)
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
  ingress {}   ingress {}    ingress {}     ← 3 real nested blocks,
  (HTTP)       (HTTPS)       (SSH office)      generated before the
                                                provider plugin ever sees them
```

### Common Mistakes

- **Overusing dynamic blocks for a fixed, known set of nested blocks.** If you always have exactly
  one `ingress` and one `egress` rule and they never vary, a plain static nested block is more
  readable than a `dynamic` block with a single-element list. Reserve `dynamic` for genuinely
  variable-length repetition.
- **Iterator name collisions.** If you nest a `dynamic "ingress"` inside another `dynamic` block
  that also happens to be named `ingress` (or you reuse the same variable name elsewhere in
  scope), the inner iterator can shadow the outer one confusingly. Use the `iterator` argument to
  rename it when nesting.
- **Forgetting that `dynamic` only works on nested blocks, not top-level arguments.** You cannot
  wrap `ami = ...` in a `dynamic` block — dynamic blocks only generate repeated *nested blocks*
  like `ingress {}`, `tag {}`, `setting {}`. For repeating whole resources, use `count`/`for_each`
  on the resource itself instead (covered in depth in Phase 8).

### Interview Answer

"A `dynamic` block generates a variable number of repeated nested configuration blocks — like
`ingress` rules inside a security group — from a list or map, when the number of blocks isn't
known until the variable's value is known. It's HCL's answer to the fact that `count`/`for_each`
work at the resource level but nested blocks aren't resources; `dynamic` fills that gap by
iterating the collection and stamping out one nested block per element."

> **Memory hook:** A dynamic block is mail-merge for HCL — one paragraph template, one spreadsheet of rows, N filled-in copies stamped out automatically.

---

## 5. Common Mistakes

1. **Wrapping every reference in unnecessary `${}`.** Legacy habit; drop the wrapper unless
   embedding inside a larger string literal.
2. **Assuming Terraform has user-defined functions.** It doesn't — compose built-ins via `locals`
   or child modules instead.
3. **Using `file()` expecting variable substitution.** Use `templatefile()` for that; `file()` is
   verbatim content only.
4. **Using splat (`[*]`) on a `for_each`-based (map) resource.** Splat syntax targets list-like
   (`count`) resource references; for `for_each` maps, iterate with `values(...)` and a `for`
   expression instead.
5. **Reaching for `dynamic` blocks for a fixed, small, unchanging set of nested blocks.** Adds
   indirection with no benefit — plain static blocks are more readable when the count truly never
   varies.
6. **Forgetting `dynamic` only applies to nested blocks, not resource-level repetition or
   top-level arguments.**

> **Memory hook:** Expressions and functions are the "compute" layer of HCL — powerful, but deliberately not a general-purpose programming language.

---

## 6. Hands-On Exercises

**Exercise 1 — String Function Chain**
Using `local` values only, build a resource name of the shape `PROJECT-ENV-web-001` where
`PROJECT` is always uppercase and `001` is a zero-padded number from a variable, using `format()`
and `upper()`.

**Exercise 2 — Tag Merging**
Define a `local.default_tags` map with `ManagedBy = "Terraform"` and `Team = "platform"`. Accept a
`variable "extra_tags"` (map of string). Use `merge()` to combine them so `extra_tags` values win
on key conflicts, and apply the result to an `aws_instance` resource's `tags` argument.

**Exercise 3 — IAM Policy via `jsonencode`**
Write an `aws_iam_policy` resource whose `policy` argument is built with `jsonencode()` from a
native HCL map, granting `s3:GetObject` and `s3:ListBucket` on a bucket ARN taken from a variable.
Explain in a comment why this is safer than a raw JSON heredoc string.

**Exercise 4 — Splat for a Load Balancer**
Create 3 subnets with `count`, then use a splat expression to feed all three subnet IDs into an
`aws_lb` resource's `subnets` argument. Then rewrite the same thing using an explicit `for`
expression and confirm both produce identical plans.

**Exercise 5 — Dynamic Security Group Rules**
Define a `variable "ingress_rules"` as a list of objects (`port`, `protocol`, `cidr_blocks`,
`description`). Build an `aws_security_group` resource that uses a `dynamic "ingress"` block to
generate one rule per list element. Add a fourth rule to your variable's default and confirm
`terraform plan` shows a fourth `ingress` block with no changes to the resource's HCL.

---

## 7. Interview Q&A

---

**Q1: What is an expression in Terraform/HCL?**

A: Anything that resolves to a value rather than declaring a block — variable/resource references,
literals, operators, function calls, conditionals, and `for` expressions. HCL is declarative and
not Turing-complete, so expressions are how values get computed from other values.

---

**Q2: When do you need `${}` interpolation syntax versus a bare reference?**

A: Only when embedding an expression inside a larger string literal, e.g. `"${var.env}-web"`. If
the entire value is a single expression with nothing else around it, write the bare reference —
`var.env`, not `"${var.env}"` — which is the idiomatic post-0.12 style.

---

**Q3: Can you define your own custom functions in Terraform?**

A: No. HCL has no user-defined function syntax. You compose the built-in function library via
`locals` blocks, or extract reusable logic into a child module, instead of writing a custom
function.

---

**Q4: What's the difference between `file()` and `templatefile()`?**

A: `file(path)` reads a file's contents verbatim with no substitution. `templatefile(path, vars)`
renders the file as an HCL template, substituting `${...}` expressions using the variables passed
in the second argument — commonly used for EC2 `user_data` scripts that need dynamic values baked
in at plan time.

---

**Q5: What does a splat expression (`resource[*].attribute`) do?**

A: It extracts one attribute from every instance of a `count`-based resource and returns it as a
flat list — shorthand for `[for r in resource : r.attribute]`. Commonly used to gather a list of
IDs (subnet IDs, security group IDs) for an argument expecting a list.

---

**Q6: Why can't you use `count` or `for_each` directly on a nested block like `ingress` inside a
security group resource?**

A: `count`/`for_each` are meta-arguments that operate at the *resource* level, producing multiple
instances of the whole resource. A nested block like `ingress {}` isn't a resource — it's part of
one resource's configuration — so Terraform provides a separate construct, `dynamic`, specifically
for generating a variable number of nested blocks from a collection.

---

**Q7: What's a realistic scenario for `jsonencode()`?**

A: Building an IAM policy document. Writing the policy as a native HCL map and passing it through
`jsonencode()` lets HCL's own parser validate structure (matching braces, correct types) before
the string ever reaches AWS, versus a raw JSON heredoc where a missing comma silently produces a
malformed policy string that only fails at apply time.

---

**Q8: What happens if you splat an attribute off a resource with `count = 0`?**

A: It returns an empty list (`[]`) rather than erroring — useful for optional-resource patterns
where a downstream argument gracefully receives an empty list when the resource wasn't created,
but worth double-checking if you expected the resource to exist and instead silently get nothing.
