# 03 — Sentinel & Policy as Code

## Table of Contents

1. [Why Policy as Code](#1-why-policy-as-code)
2. [Sentinel Basics](#2-sentinel-basics)
3. [A Simple Example Policy](#3-a-simple-example-policy)
4. [Open Policy Agent (OPA) as an Alternative](#4-open-policy-agent-opa-as-an-alternative)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Policy as Code

Picture your organization's security team writing a wiki page: "Please don't create S3 buckets
without encryption enabled. Please don't launch instances larger than `m5.xlarge` without director
approval. Please always tag resources with a cost center." Every engineer reads it once, nods, and
then six months later someone on a different team — who never saw that wiki page — provisions an
unencrypted, public S3 bucket holding customer data, and it ships straight to production because
nothing actually stopped the `terraform apply`. This is the fundamental limit of policy written as
*documentation*: it only works if every single person reads it, remembers it, and chooses to
follow it, every single time, forever.

**Policy as code** flips this: instead of writing the rule in a wiki, you write it as an actual
program that runs automatically as part of every Terraform run and can genuinely *block* an apply
that violates it. At scale — dozens of teams, hundreds of workspaces — this is the only way
governance rules actually hold, because it removes "did the engineer remember the rule" from the
equation entirely.

### Analogy

A wiki page of security rules is like a sign at a pool that says "no diving in the shallow end."
People can, and eventually will, ignore it. Policy as code is an actual physical barrier across the
shallow end that a diver simply cannot get past — it's not a request anymore, it's a mechanism.

### Under the Hood

```
┌─────────────────────────────────────────────────────────────────┐
│                    WITHOUT POLICY AS CODE                        │
│                                                                     │
│  Engineer writes .tf ──► terraform apply ──► Resource created     │
│                              (nothing checks it against org rules) │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     WITH POLICY AS CODE                           │
│                                                                     │
│  Engineer writes .tf ──► terraform plan                           │
│                              │                                     │
│                              ▼                                     │
│                     Plan converted to structured data              │
│                     (Sentinel's "mock" or OPA's plan JSON)         │
│                              │                                     │
│                              ▼                                     │
│                     Policy engine evaluates rules against it       │
│                     e.g. "every aws_s3_bucket must have             │
│                     server_side_encryption_configuration set"      │
│                              │                                     │
│                    ┌─────────┴─────────┐                          │
│                    ▼                   ▼                          │
│               PASS → continue    FAIL → run blocked                │
│               to apply           (if hard-mandatory)               │
└─────────────────────────────────────────────────────────────────┘
```

The key structural idea: the policy engine doesn't read your raw `.tf` files. It reads the
*computed plan* — the actual concrete set of resource attribute values Terraform is about to
create/change — so a policy checking "no unencrypted S3 buckets" catches the rule violation
regardless of whether the encryption setting came from a hardcoded value, a variable, a module
default, or a data source lookup. It evaluates the *result*, not the source code.

### Common Confusion

People sometimes assume policy as code is just a fancier `terraform validate`. It's not —
`validate` only checks HCL syntax and internal consistency; it has no concept of "this instance
type is too large" or "this bucket must be tagged." Policy as code evaluates business/security
rules against the actual planned resource values, which is a fundamentally different, much richer
job.

### Interview Answer

"Policy as code replaces documentation-based governance — rules written on a wiki that rely on
engineers remembering and following them — with an automated check that runs on every Terraform
plan and can genuinely block an apply that violates it. It matters at scale because manual review
doesn't survive dozens of teams and hundreds of workspaces; a machine-enforced gate does, and it
evaluates the actual computed plan output rather than raw source code, so it catches violations
regardless of how the offending value was derived."

> **Memory hook:** A wiki rule is a "no diving" sign; policy as code is the physical barrier across the shallow end.

---

## 2. Sentinel Basics

You've decided policy as code is the right approach, and since you're already on Terraform Cloud,
HashiCorp's own policy engine — **Sentinel** — is the natural first stop. Sentinel isn't a generic
scripting language bolted on as an afterthought; it's a purpose-built policy language designed
specifically to be embedded into pipelines like Terraform runs, with a deliberately restricted
feature set (no unbounded loops, no arbitrary I/O) so that a policy can be evaluated safely,
deterministically, and quickly on every single run.

### Analogy

Think of Sentinel policies as a graduated set of building inspectors. Some inspectors leave a
note ("this violates recommended practice, but proceed if you must") — that's **advisory**. Some
inspectors can block you, but a supervisor can override them with a documented reason — that's
**soft-mandatory**. And some inspectors can shut the entire job site down with no override
possible short of changing the plan — that's **hard-mandatory**.

### Core Concepts

```
┌─────────────────────────────────────────────────────────────┐
│  POLICY SET (a git repo or TFC-managed collection of         │
│  Sentinel .sentinel files, attached to workspaces or the     │
│  whole organization)                                          │
│                                                                 │
│    ┌───────────────────┐   ┌───────────────────┐             │
│    │ policy: require-   │   │ policy: restrict-  │             │
│    │  tags.sentinel      │   │  instance-type.sentinel│             │
│    │  enforcement:        │   │  enforcement:        │             │
│    │  hard-mandatory      │   │  soft-mandatory      │             │
│    └───────────────────┘   └───────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

| Enforcement Level | Behavior on failure | Typical use |
|--------------------|---------------------|-------------|
| **advisory** | Logs a warning; run proceeds regardless | New policies being tested before enforcement, informational nudges |
| **soft-mandatory** | Blocks the run, but an authorized user can override and proceed | Cost guidelines, best-practice recommendations with documented exceptions |
| **hard-mandatory** | Blocks the run with no override possible | Security-critical rules — no public S3 buckets, no unencrypted volumes, no disabling of MFA |

A **policy set** groups related `.sentinel` policy files together and is attached either to
specific workspaces or to the entire organization, so a security team can maintain one central
repository of rules that automatically applies everywhere, rather than copy-pasting policy files
into every workspace individually.

### Common Confusion

Newcomers sometimes think enforcement level is set once per policy set and applies uniformly.
In practice each *individual policy* inside a policy set can have its own enforcement level — you
might have twenty policies in one set, where fifteen are advisory (still being tuned) and five are
hard-mandatory (already proven and non-negotiable).

### Interview Answer

"Sentinel is HashiCorp's policy-as-code language, purpose-built for embedding into pipelines like
Terraform Cloud runs. Policies are grouped into policy sets attached to workspaces or the whole
organization. Each individual policy carries an enforcement level: advisory just warns, soft-
mandatory blocks the run but allows an authorized override, and hard-mandatory blocks the run with
no override at all. That gradient lets teams roll out new governance rules safely — start advisory,
watch what would fail, then promote to mandatory once confident."

> **Memory hook:** Sentinel's enforcement levels are three grades of building inspector: one leaves a note, one can be overruled by a supervisor, one shuts the site down with no appeal.

---

## 3. A Simple Example Policy

Theory is fine, but what does an actual Sentinel policy look like, and how does it hook into a
plan? Let's write two realistic, common rules: restrict allowed EC2 instance types, and require a
`CostCenter` tag on every resource that supports tagging.

### Example — Restricting Instance Types

```python
# restrict-instance-type.sentinel
import "tfplan/v2" as tfplan

allowed_types = ["t3.micro", "t3.small", "t3.medium", "m5.large"]

ec2_instances = filter tfplan.resource_changes as _, rc {
    rc.type is "aws_instance" and
    (rc.change.actions contains "create" or rc.change.actions contains "update")
}

violating_instances = filter ec2_instances as _, instance {
    instance.change.after.instance_type not in allowed_types
}

main = rule {
    length(violating_instances) is 0
}
```

```
# What this policy checks:
#
#   For every aws_instance being created or updated in the plan,
#   is its instance_type one of the approved sizes?
#
#   If even one instance uses, say, "m5.24xlarge", `violating_instances`
#   is non-empty, and `main` evaluates to false → the policy fails.
```

### Example — Requiring a Tag

```python
# require-cost-center-tag.sentinel
import "tfplan/v2" as tfplan

taggable_resources = filter tfplan.resource_changes as _, rc {
    rc.change.actions contains "create" and
    rc.type in ["aws_instance", "aws_s3_bucket", "aws_db_instance"]
}

untagged = filter taggable_resources as _, res {
    res.change.after.tags is not defined or
    res.change.after.tags.CostCenter is not defined
}

main = rule {
    length(untagged) is 0
}
```

### Attaching Enforcement Levels

```hcl
# sentinel.hcl — policy set manifest
policy "restrict-instance-type" {
  source            = "./restrict-instance-type.sentinel"
  enforcement_level = "soft-mandatory"
}

policy "require-cost-center-tag" {
  source            = "./require-cost-center-tag.sentinel"
  enforcement_level = "hard-mandatory"
}
```

```
Run against a plan that creates an untagged m5.24xlarge instance:

  restrict-instance-type   FAIL  (soft-mandatory — can be overridden by an authorized reviewer)
  require-cost-center-tag  FAIL  (hard-mandatory — run is blocked, no override)

  Result: Run is blocked. Even if a reviewer overrides the instance-type
  policy, the missing-tag policy still stops the apply completely.
```

### Common Mistakes

- **Writing a policy against raw HCL instead of the plan's resource changes.** Sentinel policies
  for Terraform operate on the `tfplan/v2` import — the *computed* plan data — not the source
  files. Trying to parse `.tf` text directly is the wrong mental model entirely.
- **Forgetting to filter by `change.actions`.** Without checking whether a resource is actually
  being created or updated, a policy might needlessly flag resources that are merely being read or
  are unchanged (`no-op`), causing noisy false failures.
- **Setting everything to hard-mandatory from day one.** New policies should typically start
  advisory, get observed for false positives across real runs, then get promoted — going straight
  to hard-mandatory risks blocking legitimate, unanticipated use cases the policy author didn't
  think of.

### Interview Answer

"A Sentinel policy imports `tfplan/v2` to get structured access to the plan's resource changes,
filters down to the resources and change types it cares about — for example, `aws_instance`
creates or updates — checks a condition against their planned attribute values, and expresses the
overall pass/fail as a `main` rule. The policy set manifest then assigns each policy an enforcement
level, so different rules in the same set can have different consequences on failure."

> **Memory hook:** A Sentinel policy is a filter-then-check pipeline: pull out the resources you care about from the plan, ask a yes/no question about their planned values, and let `main` report pass or fail.

---

## 4. Open Policy Agent (OPA) as an Alternative

Sentinel is powerful, but it's also a HashiCorp-proprietary language, and it's gated behind paid
Terraform Cloud/Enterprise tiers. If your organization is on the Free tier, or already has broader
policy-as-code investments across Kubernetes, APIs, and CI pipelines using a *different*, more
widely adopted engine, you have another well-established option: **Open Policy Agent (OPA)**,
using its **Rego** query language.

### Analogy

Sentinel is like a security system built specifically for one particular brand of house and sold
only by that brand's dealer — deeply integrated, but locked to that ecosystem. OPA is more like a
universal alarm system that can be wired into houses, offices, warehouses, and cars alike — it's
not purpose-built exclusively for Terraform, but its generality means the same skill and the same
policies (with some adaptation) can guard many different systems across your stack.

### Comparison Table

| Dimension | Sentinel | Open Policy Agent (OPA) |
|-----------|----------|---------------------------|
| **Vendor** | HashiCorp (proprietary) | CNCF open-source project |
| **Policy language** | Sentinel (HashiCorp's own DSL) | Rego (general-purpose query language) |
| **Native integration** | Deep, first-party in Terraform Cloud/Enterprise | Via `terraform plan -out` + JSON, or Terraform's run tasks / conftest |
| **Availability** | Gated to paid TFC/TFE tiers | Free and open-source; usable at any TFC tier via run tasks, or entirely outside TFC |
| **Ecosystem reach** | Terraform, and a few other HashiCorp products (Consul, Vault) | Kubernetes admission control, API gateways, CI pipelines, Terraform, and more |
| **Learning curve** | Sentinel-specific syntax to learn | Rego has its own learning curve, but transfers across many tools |
| **Typical invocation** | Built into the TFC run pipeline automatically | `terraform show -json plan.out \| opa eval` or wired via `conftest` in CI |

### Under the Hood — A Similar Check, in Rego

```rego
# restrict_instance_type.rego
package terraform.instance_types

allowed_types := {"t3.micro", "t3.small", "t3.medium", "m5.large"}

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_instance"
    action := resource.change.actions[_]
    action == "create"
    not allowed_types[resource.change.after.instance_type]
    msg := sprintf(
        "aws_instance %v uses disallowed instance_type %v",
        [resource.address, resource.change.after.instance_type],
    )
}
```

```bash
# Evaluated outside of TFC entirely, e.g. in a CI pipeline:
terraform show -json tfplan.binary > plan.json
opa eval --input plan.json --data restrict_instance_type.rego \
  "data.terraform.instance_types.deny"
```

The conceptual structure is nearly identical to the Sentinel example: pull the relevant resource
changes out of the plan JSON, check a condition, and produce a deny message if it fails. The
difference is largely *where* this check runs (natively inside TFC for Sentinel, versus typically
as a CI step or via TFC's "run tasks" integration for OPA) and *who* controls the tooling
(HashiCorp vs. an open, vendor-neutral CNCF project).

### Common Mistakes

- **Assuming OPA "just works" inside Terraform Cloud the same way Sentinel does.** OPA isn't a
  first-party TFC policy engine; it's typically wired in either via TFC's **run tasks** feature
  (available on paid tiers) calling out to an external OPA service, or run entirely outside TFC as
  a CI pipeline step (e.g., with `conftest`) — free-tier-friendly, but not embedded directly into
  the TFC run pipeline itself.
- **Picking Rego for a team with zero Kubernetes/OPA experience elsewhere**, when Sentinel (if
  already paying for TFC governance features) would have a gentler learning curve and tighter
  native integration.
- **Ignoring that Rego's declarative logic-programming style is quite different from Sentinel's
  more conventional imperative-feeling syntax** — engineers switching between the two should expect
  a real mental shift, not just a syntax reskin.

### Interview Answer

"Sentinel is HashiCorp's proprietary, first-party policy engine, deeply integrated into the
Terraform Cloud/Enterprise run pipeline but gated behind paid tiers. OPA, using the Rego language,
is a CNCF open-source alternative that isn't Terraform-specific — the same policy engine also
guards Kubernetes admission control and API gateways. In a Terraform context, OPA typically
evaluates the plan's JSON output either via TFC's run tasks feature or as a standalone CI step,
rather than being natively built into the run pipeline the way Sentinel is. Teams choose OPA when
they want a vendor-neutral, broadly reusable policy engine, or when they're on a TFC tier that
doesn't include Sentinel; they choose Sentinel when they want the tightest native integration and
are already paying for governance features."

> **Memory hook:** Sentinel is the alarm system sold only by one house-brand's dealer; OPA is the universal alarm system you can wire into the house, the office, and the car.

---

## 5. Common Mistakes

- **Treating policy as code as equivalent to `terraform validate`.** Validation checks syntax;
  policy engines check business and security rules against the actual planned resource values.
- **Jumping straight to hard-mandatory enforcement for brand-new policies** instead of rolling out
  as advisory first and observing real run data for false positives.
- **Writing policies against raw `.tf` source instead of the structured plan data** (`tfplan/v2` for
  Sentinel, plan JSON for OPA) — policies must reason about computed values, not source text.
- **Assuming OPA is a drop-in, natively embedded replacement for Sentinel inside TFC** without
  accounting for the different integration model (run tasks / external CI step vs. built-in).
- **Forgetting that different policies within the same policy set can carry different enforcement
  levels** — it's not an all-or-nothing setting per policy set.

> **Memory hook:** Policy as code only delivers on its promise if the rules are evaluated automatically against real planned values and can genuinely stop a bad apply — anything less is just a wiki page with extra steps.

---

## 6. Hands-On Exercises

**Exercise 1 — Write an Advisory Policy**
Write a Sentinel (or OPA/Rego) policy that flags any `aws_s3_bucket` resource in the plan that
does not have versioning enabled. Set its enforcement level to advisory and confirm a run with a
violating bucket still succeeds, but shows a warning.

**Exercise 2 — Promote to Hard-Mandatory**
Take the policy from Exercise 1 and change its enforcement level to hard-mandatory. Re-run the same
plan and confirm the run is now blocked with no override option.

**Exercise 3 — Multi-Policy Policy Set**
Create a policy set containing three policies: one restricting instance types (soft-mandatory), one
requiring a `CostCenter` tag (hard-mandatory), and one flagging public S3 bucket ACLs (hard-
mandatory). Attach it to a test workspace and run a plan that violates all three. Confirm the run
result reflects each policy's independent outcome.

**Exercise 4 — Sentinel vs OPA Research**
Look up your organization's (or a hypothetical company's) current Terraform Cloud plan tier. If
it's Free or Standard, would Sentinel even be available? Write a short recommendation: Sentinel,
OPA via run tasks, or OPA via CI, and justify the choice given the tier and any existing OPA usage
elsewhere in the org (e.g., for Kubernetes).

**Exercise 5 — Rewrite a Policy in the Other Language**
Take the "require CostCenter tag" Sentinel policy from Section 3 and rewrite the equivalent logic
in Rego (OPA), following the pattern from Section 4. Note which parts felt more natural in each
language.

---

## 7. Interview Q&A

---

**Q1: What is policy as code, and why is it preferred over documented guidelines?**

A: Policy as code expresses governance rules — security requirements, tagging standards, resource
size limits — as an automated check that runs on every Terraform run and can genuinely block a
violating apply. Documented guidelines rely on every engineer reading, remembering, and choosing
to follow the rule every time; policy as code removes that dependency by enforcing it
mechanically.

---

**Q2: What are Sentinel's three enforcement levels, and how do they differ?**

A: Advisory logs a warning but lets the run proceed regardless. Soft-mandatory blocks the run but
allows an authorized user to override and proceed. Hard-mandatory blocks the run with no override
possible. Different policies within the same policy set can each have their own enforcement level.

---

**Q3: Does a Sentinel policy evaluate the raw `.tf` files or something else?**

A: It evaluates the computed plan data, imported via `tfplan/v2`, which represents the actual
resource changes Terraform is about to make — not the source HCL text. This means the policy
catches violations regardless of whether the offending value came from a hardcoded literal, a
variable, or a module default.

---

**Q4: What is a policy set in Terraform Cloud?**

A: A collection of related Sentinel (or OPA, via run tasks) policy files, typically stored in a
version-controlled repository, that gets attached either to specific workspaces or to an entire
organization — allowing one central set of rules to be maintained and automatically applied
everywhere it's attached, rather than duplicated per workspace.

---

**Q5: How does OPA differ from Sentinel in a Terraform Cloud context?**

A: Sentinel is HashiCorp's proprietary policy engine, natively built into the TFC run pipeline but
gated behind paid tiers. OPA is a CNCF open-source, general-purpose policy engine using the Rego
language; in Terraform it typically evaluates the plan's JSON output via TFC's run tasks feature or
as an external CI step, rather than being built directly into the run pipeline. OPA is also usable
outside Terraform entirely — for example guarding Kubernetes admission control — making it a
better fit for teams standardizing on one policy engine across many systems.

---

**Q6: Why should a new policy typically start as advisory rather than hard-mandatory?**

A: Starting advisory lets the team observe how the policy behaves against real, in-flight runs
without blocking anyone, surfacing false positives or unanticipated edge cases. Once the policy has
been validated against real traffic, it can be promoted to soft- or hard-mandatory with much more
confidence that it won't incorrectly block legitimate infrastructure changes.

---

**Q7: Give an example of a rule that should be hard-mandatory versus one that should be soft-
mandatory.**

A: A rule like "no publicly readable S3 buckets containing customer data" is a strong candidate for
hard-mandatory — a genuine security risk that should never be overridden. A rule like "prefer
`t3.medium` or smaller unless otherwise justified" is a better fit for soft-mandatory, since there
are legitimate cases (a documented, approved larger workload) where an authorized reviewer should
be able to override it and proceed.
