# 02 — Depends On & Lifecycle

## Table of Contents

1. [Explicit `depends_on` Revisited](#1-explicit-depends_on-revisited)
2. [The `lifecycle` Block](#2-the-lifecycle-block)
3. [create_before_destroy vs Default Destroy-Then-Create](#3-create_before_destroy-vs-default-destroy-then-create)
4. [Common Mistakes](#4-common-mistakes)
5. [Hands-On Exercises](#5-hands-on-exercises)
6. [Interview Q&A](#6-interview-qa)

---

## 1. Explicit `depends_on` Revisited

You've probably already relied on Terraform figuring out dependency order automatically — write
`vpc_id = aws_vpc.main.id` inside an `aws_subnet` block, and Terraform knows to create the VPC
first because your subnet's config literally *references* the VPC's attribute. But now imagine an
IAM role that must exist and have its policy fully attached before an EC2 instance boots and tries
to assume that role via an instance profile — except your instance's config doesn't reference any
attribute of the IAM policy at all (it only references the instance profile). Terraform has no
textual clue that a relationship exists, so it might create both in parallel, and your instance
could boot before the policy is attached, failing its first API call. This is exactly the gap
`depends_on` exists to close.

Terraform's dependency graph is normally built **implicitly**: whenever one resource's
configuration references another resource's attribute (`aws_subnet.public.id`,
`aws_security_group.web.id`), Terraform automatically knows resource B needs resource A to exist
first. `depends_on` is the **explicit**, manual escape hatch for the cases where a real-world
ordering requirement exists but isn't visible in any attribute reference.

### Analogy

Implicit dependency is like a recipe that says "add the whisked eggs" — the eggs *must* have been
whisked first because you're literally using the whisked result, so the ordering is obvious from
the instruction itself. `depends_on` is like a recipe note that says "let the oven finish
preheating before this step" — the step doesn't use any *output* of the preheating, but it still
genuinely has to happen after it. You have to write that ordering down explicitly, because nothing
in the ingredients list implies it.

### Under the Hood

```
Implicit dependency (default):
┌───────────────────┐        references         ┌───────────────────┐
│ aws_subnet.public  │ ───── attribute ────────▶ │ aws_vpc.main       │
│  vpc_id = aws_vpc  │        (vpc_id)            │  (created first)   │
│  .main.id          │                            └───────────────────┘
└───────────────────┘
Terraform's graph builder scans the config text, finds the reference,
and adds an edge: aws_vpc.main → aws_subnet.public

Explicit dependency (depends_on):
┌────────────────────┐                            ┌───────────────────┐
│ aws_instance.app    │ ── no attribute reference  │ aws_iam_role_policy│
│  depends_on = [     │       exists in config —   │ _attachment.app    │
│  aws_iam_role_policy│       you declare the       │  (created first)   │
│  _attachment.app]   │       edge manually         └───────────────────┘
└────────────────────┘
```

### Example

```hcl
resource "aws_iam_role" "app" {
  name = "app-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "app_s3" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}

resource "aws_iam_instance_profile" "app" {
  name = "app-profile"
  role = aws_iam_role.app.name
}

resource "aws_instance" "app" {
  ami                  = "ami-0c55b159cbfafe1f0"
  instance_type        = "t3.micro"
  iam_instance_profile = aws_iam_instance_profile.app.name

  # aws_instance already implicitly depends on aws_iam_instance_profile.app
  # via iam_instance_profile above. But the instance's user_data script
  # calls S3 on first boot, which requires the POLICY ATTACHMENT to be
  # fully propagated — and nothing in this config references that
  # attachment's attributes. So we add it explicitly:
  depends_on = [aws_iam_role_policy_attachment.app_s3]

  tags = { Name = "app-server" }
}
```

### Common Confusion

New users reach for `depends_on` far more often than necessary, usually because they don't trust
that referencing an attribute is "enough." In the vast majority of cases it *is* enough — if your
config already says `subnet_id = aws_subnet.public.id`, adding `depends_on = [aws_subnet.public]`
on top is pure redundancy (harmless, but noise). `depends_on` should be reserved for genuine
*side-effect* dependencies: things where the resource being created doesn't consume any output of
the other resource, but a real ordering requirement exists anyway (IAM eventual consistency,
application readiness, external systems).

### Interview Answer

"Terraform builds its dependency graph implicitly by scanning for attribute references between
resources — if resource B's config uses `resource_a.some_attribute`, Terraform knows A must be
created first. `depends_on` is the explicit override for cases where a real ordering requirement
exists but isn't visible as an attribute reference — commonly IAM policy propagation before an
EC2 instance boots and needs those permissions immediately. It should be used sparingly, only when
implicit dependency genuinely can't express the relationship."

> **Memory hook:** Implicit dependency is "the recipe says use the whisked eggs" — the order is obvious from what you're using. `depends_on` is "wait for the oven to preheat" — you have to state it, because nothing you're using proves it happened.

---

## 2. The `lifecycle` Block

Here's a scenario every infrastructure engineer eventually hits: you change the AMI on a
production web server's `aws_instance` resource, run `terraform apply`, and Terraform's default
behavior is to **destroy the old instance first, then create the new one**. For a few minutes,
you have *zero* running web servers — an outage, self-inflicted by your own deployment tool. Or
the opposite problem: you accidentally set `count = 0` on your production database and
`terraform apply` cheerfully destroys it with no complaint. The `lifecycle` block is Terraform's
way of letting you override these default behaviors, resource by resource, for exactly these kinds
of situations.

`lifecycle` is a nested block (a meta-argument, not tied to any provider) that every resource
supports, with four key settings:

| Setting | Purpose |
|---------|---------|
| `create_before_destroy` | Create the replacement resource *before* destroying the old one (avoids downtime) |
| `prevent_destroy` | Hard-blocks `terraform destroy`/`apply` from ever destroying this specific resource |
| `ignore_changes` | Tells Terraform to ignore drift on specific attributes (don't include them in diffs) |
| `replace_triggered_by` | Forces replacement of this resource whenever a referenced resource/attribute changes |

### Analogy

Think of `lifecycle` settings as sticky notes you attach to a specific piece of furniture before
movers (Terraform) show up: "build the new couch before removing the old one" (create_before_destroy),
"do not, under any circumstances, throw this away" (prevent_destroy), "ignore if this drawer looks
slightly rearranged, that's expected and fine" (ignore_changes), and "if the living room wallpaper
changes, replace this couch too, it won't match anymore" (replace_triggered_by).

### Example — All Four Settings

```hcl
resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = "t3.micro"

  lifecycle {
    create_before_destroy = true

    prevent_destroy = true

    ignore_changes = [
      tags["LastDeployedBy"],   # some external tool mutates this tag; don't fight it
      ami,                      # AMI is updated out-of-band by a patching pipeline
    ]

    replace_triggered_by = [
      aws_launch_template.web.id   # if the launch template changes, replace this instance too
    ]
  }
}
```

```hcl
resource "aws_db_instance" "prod" {
  identifier     = "prod-db"
  engine         = "postgres"
  instance_class = "db.t3.medium"
  allocated_storage = 100

  lifecycle {
    prevent_destroy = true   # a stray `terraform destroy` or count=0 mistake will hard-fail
  }
}
```

### `ignore_changes` in Detail

`ignore_changes` accepts either a list of specific attribute paths, or the literal keyword `all`:

```hcl
lifecycle {
  ignore_changes = all   # ignore ALL attribute drift on this resource — use sparingly!
}
```

Common legitimate use: an Auto Scaling Group's `desired_capacity` that a separate autoscaling
policy adjusts at runtime — if Terraform doesn't ignore it, every `apply` would try to reset it
back to whatever the `.tf` file says, fighting the autoscaler.

### `replace_triggered_by` in Detail

Available since Terraform 1.2, this forces a resource to be destroyed and recreated whenever a
*different* resource or attribute changes — useful when there's no natural attribute reference
that would make this happen implicitly (similar motivation to `depends_on`, but for forcing
*replacement* instead of just *ordering*):

```hcl
resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = "t3.micro"

  lifecycle {
    replace_triggered_by = [
      aws_security_group.web.id   # if the SG is replaced, force this instance to be replaced too
    ]
  }
}
```

### Common Confusion

People often think `ignore_changes` "locks" the attribute at its current value forever. It
doesn't lock anything — it simply tells Terraform's diff engine "don't show or act on drift for
this attribute," which means if you *do* need to intentionally change that attribute later, you
have to either remove it from `ignore_changes` temporarily or use `terraform apply -replace` to
force the issue. It's a "don't fight external changes" switch, not a permanent freeze.

### Interview Answer

"The `lifecycle` block lets you override Terraform's default create/update/destroy behavior per
resource. `create_before_destroy` avoids downtime by provisioning the replacement before removing
the original. `prevent_destroy` is a safety rail that hard-fails any plan that would destroy a
critical resource, like a production database. `ignore_changes` tells Terraform to stop treating
specific attributes as drift, which is essential when something outside Terraform — an
autoscaler, a patching pipeline — legitimately mutates that attribute. `replace_triggered_by`
forces replacement of a resource when a referenced resource changes, even without a direct
attribute dependency."

> **Memory hook:** `lifecycle` is sticky notes on the furniture before the movers arrive: build-first, never-throw-away, ignore-this-drawer, replace-if-the-wallpaper-changes.

---

## 3. create_before_destroy vs Default Destroy-Then-Create

Some changes to a resource can't be done as an in-place update — changing an EC2 instance's AMI,
for example, requires a brand new instance (AWS doesn't let you "hot-swap" the AMI under a running
instance). Terraform calls this a **replacement**, and by default, it replaces resources in the
safest order *for Terraform's own bookkeeping* — destroy the old one, then create the new one —
which is exactly backwards from what you usually want operationally: you want the new one up and
verified *before* the old one goes away.

### Diagram — Default (destroy-then-create)

```
Time ──────────────────────────────────────────────────────►

Old instance:  [ RUNNING ──────────]  X destroyed
New instance:                        [not yet created] ───▶ [ RUNNING ]
                                       ▲
                              GAP: zero instances running here — OUTAGE
```

### Diagram — create_before_destroy

```
Time ──────────────────────────────────────────────────────►

Old instance:  [ RUNNING ────────────────────]  X destroyed (after new one is up)
New instance:            [ created ] ── [ RUNNING ──────────────────────]
                          ▲
                No gap — both instances briefly coexist, then old one is removed.
```

### Example

```hcl
resource "aws_instance" "web" {
  ami           = var.ami_id
  instance_type = "t3.micro"

  # NOTE: an aws_instance's `ami` change forces replacement (not an in-place update)
  # because AWS has no API to swap the AMI under a running instance.

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "web" }
}
```

Because `create_before_destroy` creates the new resource first, any resource *referencing* this
one (e.g., a security group rule attached by ID, or a load balancer target group attachment) may
need `create_before_destroy` cascaded to it too, since the old and new instance will briefly
coexist and both can't hold onto uniquely-named dependent resources (like an Elastic IP with a
name collision) at the same time. This is why `create_before_destroy` sometimes requires adding
the same setting to related resources, or using `name_prefix` instead of a fixed `name` to avoid
naming collisions between the old and new resource that briefly coexist.

### Common Confusion

`create_before_destroy` doesn't make *all* changes zero-downtime — it only reorders the
destroy/create sequence for changes that require *replacement* in the first place. If the change
can be applied in-place (like updating a tag), there's no replacement happening at all, so this
setting is irrelevant. Also, `create_before_destroy` can fail outright if the resource has a
uniqueness constraint on a name/identifier that isn't parameterized — e.g., trying to create a
second `aws_iam_role` with the exact same fixed `name` before the old one is destroyed will error,
because IAM role names must be unique. Use `name_prefix` in that case.

### Interview Answer

"By default, when a resource requires replacement, Terraform destroys the existing resource and
then creates the new one — which causes a downtime gap for anything depending on that resource
being available. Setting `lifecycle { create_before_destroy = true }` reverses that order: the new
resource is created and becomes available first, and only then is the old one destroyed. This
avoids the outage but requires care around uniqueness constraints — like fixed names — since old
and new resources briefly coexist."

> **Memory hook:** Default replacement is "tear down the bridge, then build a new one" — traffic stops. `create_before_destroy` is "build the new bridge next to the old one, open it, then tear down the old one" — traffic never stops.

---

## 4. Common Mistakes

- **Overusing `ignore_changes` as a way to "make an annoying diff go away"** without understanding
  *why* the drift is happening — this masks real configuration drift that might indicate someone
  made a manual change in the console that Terraform should actually know about and reconcile.
  `ignore_changes` should be a deliberate, documented decision about a specific attribute managed
  by something else — not a blanket fix for plan noise.
- **Setting `ignore_changes = all` "just to be safe"** — this effectively removes the resource
  from Terraform's management entirely for update purposes; any future intentional change in the
  `.tf` file will silently have no effect, which is confusing for the next engineer who edits it.
- **Forgetting `prevent_destroy` blocks `count = 0` and `terraform destroy` alike** — teams
  sometimes add `prevent_destroy` expecting it to only stop `terraform destroy`, then are
  surprised when scaling a `count` down to remove one instance also hard-fails the whole apply.
- **Adding `create_before_destroy` without checking for naming collisions** — a fixed `name`
  attribute (IAM role name, security group name) will cause the *create* step to fail because the
  old resource with that name still exists at that moment.
- **Relying on `depends_on` where a real attribute reference would do the same job more clearly**
  — prefer implicit dependency (via attribute reference) whenever possible; reserve `depends_on`
  for true side-effect-only orderings.
- **Not realizing `replace_triggered_by` forces a full destroy/recreate**, not just an update —
  this can be far more disruptive than intended if the referenced resource changes frequently.

---

## 5. Hands-On Exercises

**Exercise 1 — Explicit Dependency**
Write two resources: an `aws_sqs_queue` named `orders` and an `aws_lambda_function` that processes
it. The Lambda's IAM role needs an attached policy granting `sqs:ReceiveMessage` before the Lambda
can be safely invoked, but the Lambda resource itself doesn't reference the policy attachment
directly. Add the correct `depends_on`.

**Exercise 2 — Prevent Destroy**
Add a `lifecycle` block to a `aws_db_instance` resource that prevents it from ever being destroyed
by Terraform. Then explain, in one sentence, what happens if a teammate sets `count = 0` on it.

**Exercise 3 — Zero-Downtime Replacement**
You have an `aws_launch_template` referenced by an `aws_instance`. Changing the AMI forces
replacement. Add the correct `lifecycle` setting so the new instance is created and healthy before
the old one is destroyed, and explain one risk of doing this if the instance has a fixed `Name`
tag used as a uniqueness key elsewhere.

**Exercise 4 — Ignore Changes**
An Auto Scaling Group's `desired_capacity` is adjusted at runtime by a scaling policy outside of
Terraform. Write the `lifecycle` block that stops Terraform from fighting the autoscaler on every
apply.

**Exercise 5 — Diagram It**
Draw (in ASCII, like the lesson) the timeline difference between default replacement and
`create_before_destroy` for an RDS instance change that requires replacement, labeling exactly
when each instance exists.

---

## 6. Interview Q&A

---

**Q1: What is the difference between implicit and explicit dependencies in Terraform?**

A: Implicit dependencies are inferred automatically when one resource's configuration references
another resource's attribute — Terraform adds a graph edge without you doing anything. Explicit
dependencies, declared with `depends_on`, are needed when a genuine ordering requirement exists
but no attribute reference exposes it, such as waiting for IAM policy propagation before an
instance that assumes that role boots.

---

**Q2: What does `prevent_destroy` do, and what triggers it?**

A: It's a `lifecycle` setting that causes Terraform to error out and refuse to proceed with any
plan or apply that would destroy that specific resource — including via `terraform destroy`, or
indirectly via reducing a `count`/`for_each` in a way that would remove that instance. It's a
safety rail for critical resources like production databases.

---

**Q3: What problem does `create_before_destroy` solve?**

A: When a change forces resource replacement, Terraform's default order is destroy-then-create,
which creates a window where the resource doesn't exist at all — an outage for anything depending
on it. `create_before_destroy` reverses the order: the replacement is created and available first,
then the old resource is destroyed, eliminating the downtime gap.

---

**Q4: What is a common pitfall when enabling `create_before_destroy`?**

A: Uniqueness constraints on fixed attributes like `name`. If the old and new resources briefly
coexist and both try to use the same fixed name (an IAM role name, a security group name), the
create step fails because the name is already taken by the not-yet-destroyed old resource. The
fix is typically to use `name_prefix` instead of a fixed `name`.

---

**Q5: When should you use `ignore_changes`?**

A: When an attribute is legitimately modified by something outside Terraform — an autoscaling
policy adjusting `desired_capacity`, a patching pipeline updating an AMI, or a external tool
tagging resources — and you don't want Terraform's plan to constantly show that as drift or try
to revert it. It should be scoped to specific attributes, not `all`, unless you deliberately want
to stop managing every attribute of that resource.

---

**Q6: What does `replace_triggered_by` do, and how is it different from `depends_on`?**

A: `replace_triggered_by` forces a resource to be destroyed and recreated whenever a referenced
resource or attribute changes, even without a direct configuration dependency. `depends_on`
only affects *ordering* — it doesn't force replacement. Use `replace_triggered_by` when a
resource logically becomes invalid or stale whenever something else changes (e.g., an instance
tied to a launch template that changed), and `depends_on` when you just need something to happen
before something else, without forcing recreation.

---

**Q7: Why might overusing `ignore_changes` be dangerous?**

A: It can mask real, unintentional drift — for example, someone manually changing a security
group rule in the AWS console. If that attribute is in `ignore_changes`, Terraform will never
flag or reconcile that drift, silently diverging from your source of truth. It should be a
deliberate, narrow, documented decision, not a general-purpose way to quiet noisy plans.
