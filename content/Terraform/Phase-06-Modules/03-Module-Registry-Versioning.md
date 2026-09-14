# 03 — Module Registry & Versioning

## Table of Contents

1. [Public Terraform Registry](#1-public-terraform-registry)
2. [Private Module Registries](#2-private-module-registries)
3. [Module Source Types](#3-module-source-types)
4. [Version Constraints for Modules](#4-version-constraints-for-modules)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Public Terraform Registry

Imagine you need a production-grade AWS VPC — not just a VPC with a couple of subnets, but one
with proper NAT gateway high-availability, VPC flow logs, multiple availability zones, database
subnet groups, and every edge case AWS networking throws at you after years of real-world use.
You *could* write all of that yourself over several days of trial and error. Or you could use a
module that thousands of companies have already battle-tested, fixed bugs in, and kept updated
for years — for free. That's exactly what the **public Terraform Registry** gives you.

The registry at `registry.terraform.io` hosts community and HashiCorp-verified modules for every
major cloud provider. The most widely used AWS networking module,
`terraform-aws-modules/vpc/aws`, is maintained by a dedicated open-source team and used in
production by an enormous number of companies — reusing it means you inherit years of accumulated
fixes instead of rediscovering the same edge cases yourself.

### Analogy

Using a registry module is like buying a well-reviewed appliance from a well-known brand instead
of building one from raw parts in your garage. Someone else has already dealt with the recalls,
the safety certifications, the edge cases where the thing catches fire if you plug it in wrong.
You still have to plug it in correctly and read the manual (the module's documented inputs/
outputs) — but you're not reinventing the toaster from a spool of nichrome wire.

### Under the Hood

```
                     registry.terraform.io
   ┌───────────────────────────────────────────────────────────────┐
   │  namespace/name/provider   (e.g. terraform-aws-modules/vpc/aws) │
   │                                                                   │
   │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
   │  │  v5.8.1     │   │  v5.7.0     │   │  v5.5.3     │  ← versions │
   │  │  (latest)   │   │             │   │             │    (tags)  │
   │  └─────────────┘   └─────────────┘   └─────────────┘            │
   │                                                                   │
   │  Backed by a GitHub repo tagged with semantic version releases   │
   └───────────────────────────────────────────────────────────────┘
                              │
                              │  terraform init  downloads the module
                              │  into .terraform/modules/
                              ▼
                     your local working directory
                     .terraform/modules/vpc/  (cached, gitignored)
```

When you run `terraform init` with a registry `source`, Terraform contacts the registry API,
resolves the version constraint you specified against the available tagged releases, downloads
the matching version's source into `.terraform/modules/<name>/`, and locks the exact resolved
version in `.terraform.lock.hcl` (for providers) — module version resolution itself is recorded
implicitly by what's cached, and explicitly if you commit the `version` constraint in your
`module` block.

### Example

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"

  name = "prod-vpc"
  cidr = "10.2.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
  public_subnets  = ["10.2.101.0/24", "10.2.102.0/24", "10.2.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = false      # one NAT gateway per AZ for high availability
  enable_dns_hostnames = true

  tags = {
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

# The community module exposes rich outputs you can compose with your own resources
output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnet_ids" {
  value = module.vpc.private_subnets
}
```

Notice the `source` address format: `<NAMESPACE>/<NAME>/<PROVIDER>` — three slash-separated
segments, no leading `github.com` or URL. This shorthand format is exclusive to registry sources;
Terraform recognizes it and resolves it against `registry.terraform.io` automatically.

### Common Confusion

People sometimes assume every module on the registry is officially supported by HashiCorp. Most
are community-maintained (like `terraform-aws-modules/*`, maintained by a community team, not
HashiCorp itself). The registry does mark certain modules "Partner" or "Verified" with a badge,
but the vast majority are community contributions — always check the module's GitHub repo,
open issues, and last-updated date before depending on it in production, exactly as you would with
any open-source dependency.

### Interview Answer

"The public Terraform Registry at registry.terraform.io hosts reusable, versioned modules that
anyone can consume with a `source` address in the shorthand `namespace/name/provider` format —
for example `terraform-aws-modules/vpc/aws`. It saves teams from reimplementing common,
well-tested infrastructure patterns like a production-grade VPC, and modules are versioned via
Git tags so you can pin to a specific, tested release with a `version` constraint. Most registry
modules are community-maintained rather than officially supported by HashiCorp, so the same
due-diligence you'd apply to any open-source dependency still applies."

> **Memory hook:** The public registry is the appliance store — buy the well-reviewed toaster instead of hand-winding your own nichrome coil.

---

## 2. Private Module Registries

The public registry is great for generic patterns like "a VPC" — but what about your company's
*specific* patterns, like "our standard internal microservice, wired to our specific logging
pipeline, our specific IAM boundary policy, our specific service mesh sidecar"? You don't want
that published to the entire internet on the public registry, but you still want the same
benefits: versioning, a searchable catalog, and a clean `source` address that teams across the
company can consume consistently. That's what a **private module registry** provides.

### Analogy

If the public registry is the public appliance store, a private registry is your company's
internal supply closet — stocked with parts built specifically for how *your* company operates,
accessible only to your own teams, but organized with the same shelving system (versions,
catalog, search) as the public store so nobody has to learn a different way of finding things.

### Under the Hood

```
                Terraform Cloud / Terraform Enterprise
   ┌───────────────────────────────────────────────────────────────┐
   │  Private Module Registry                                       │
   │  app.terraform.io/<org>/<module-name>/<provider>                │
   │                                                                   │
   │  Backed by a connected VCS repo (GitHub/GitLab/Bitbucket)         │
   │  New Git tag pushed  ──►  new module version appears automatically│
   └───────────────────────────────────────────────────────────────┘

                         OR — a lighter-weight alternative:

                Direct Git source, no registry catalog at all
   ┌───────────────────────────────────────────────────────────────┐
   │  module "internal_service" {                                    │
   │    source = "git::https://github.com/acme-corp/tf-modules.git   │
   │              //modules/microservice?ref=v2.3.0"                  │
   │  }                                                                │
   │  No catalog UI, no searchable index — just a pinned Git ref.     │
   └───────────────────────────────────────────────────────────────┘
```

Terraform Cloud's private registry connects directly to your VCS provider. Every time your module
repo gets a new semantic-version Git tag (e.g. `v1.4.0`), Terraform Cloud automatically detects it
and adds it as a new selectable version in the catalog — no separate publish step, unlike some
package registries (npm, PyPI) that require an explicit `publish` command.

### Example

```hcl
# Consuming a module from Terraform Cloud's private registry
module "internal_microservice" {
  source  = "app.terraform.io/acme-corp/microservice/aws"
  version = "~> 2.3"

  service_name = "checkout-api"
  cpu          = 512
  memory       = 1024
}
```

```hcl
# Alternative: a Git source, used when there's no TFC private registry set up,
# or for a quick internal module not worth cataloging formally
module "internal_microservice" {
  source = "git::https://github.com/acme-corp/tf-modules.git//modules/microservice?ref=v2.3.0"

  service_name = "checkout-api"
  cpu          = 512
  memory       = 1024
}
```

### Common Mistakes

- Treating a bare Git source (no registry) as equivalent to a registry source for version
  discovery — Git sources have no "browse available versions" catalog UI; you have to already
  know the tag you want (or go look at the repo's tags on GitHub yourself).
- Forgetting that a private registry's `source` address format still follows
  `<HOSTNAME>/<NAMESPACE>/<NAME>/<PROVIDER>` — omitting the hostname (`app.terraform.io`) makes
  Terraform assume you mean the *public* registry, which will fail to find your private module.
- Not setting up authentication (`terraform login`, or a stored API token) before referencing a
  private registry module — `terraform init` fails with an auth error if credentials aren't
  configured.

### Interview Answer

"A private module registry — offered by Terraform Cloud/Enterprise, or approximated with direct
Git sources — lets an organization publish and version internal modules the same way the public
registry does, but restricted to the org's own teams. Terraform Cloud's private registry connects
to your VCS provider directly, so pushing a new semantic-version Git tag automatically makes a new
module version available, with no separate publish step. The source address format includes the
registry hostname, e.g. `app.terraform.io/acme-corp/microservice/aws`, distinguishing it from the
public registry's shorthand `namespace/name/provider` format."

> **Memory hook:** Private registry is the company's internal supply closet — same shelving system as the public store, but stocked with parts built just for you.

---

## 3. Module Source Types

The `source` argument on a `module` block is the single most important line in that block — it
tells Terraform *where* to fetch the module's code from, and Terraform supports several different
kinds of source addresses, each suited to a different situation. Getting this line wrong (a bad
relative path, a missing `ref`, a malformed registry address) is one of the most common
`terraform init` failures beginners hit.

### Analogy

Think of `source` like the address field on a shipping label. You can ship something from right
next door (local path), from a well-known catalog warehouse (registry), from a specific supplier's
own address who ships whatever's currently on their shelf unless you specify a lot/batch number
(Git source with an optional `ref`), or from a generic online storefront (an HTTP/S3 archive URL).
Each requires slightly different information to get the package to actually arrive.

### Under the Hood

```
source = "./modules/vpc"                          ← LOCAL PATH
         (must start with ./ or ../, no versioning, no init download — used as-is)

source = "terraform-aws-modules/vpc/aws"          ← REGISTRY (public)
         version = "~> 5.8"
         (namespace/name/provider, versioned via Git tags behind the scenes)

source = "app.terraform.io/acme/vpc/aws"           ← REGISTRY (private, TFC/TFE)
         version = "~> 1.0"
         (hostname/namespace/name/provider)

source = "git::https://github.com/acme/tf-modules.git//modules/vpc?ref=v1.2.0"  ← GIT
         (git:: prefix, // separates repo root from subdirectory, ?ref= pins a
          branch/tag/commit)

source = "github.com/acme/tf-modules//modules/vpc"  ← GITHUB SHORTHAND
         (Terraform recognizes github.com URLs without needing the git:: prefix)

source = "https://example.com/modules/vpc.zip"       ← HTTP ARCHIVE
         (downloads and unpacks a zip/tar archive)

source = "s3::https://s3.amazonaws.com/bucket/vpc.zip"  ← S3 ARCHIVE
         (private, credential-gated archive storage)
```

### Comparison Table

| Source Type | Example | Versioned? | Requires `terraform init` download? | Typical Use |
|--------------|---------|------------|--------------------------------------|--------------|
| Local path | `./modules/vpc` | No (whatever's on disk right now) | No — used in place | Modules within the same repo |
| Public registry | `terraform-aws-modules/vpc/aws` | Yes — via `version` constraint | Yes — cached under `.terraform/modules/` | Community/HashiCorp modules |
| Private registry | `app.terraform.io/acme/vpc/aws` | Yes — via `version` constraint | Yes | Internal org-wide reusable modules |
| Git (generic) | `git::https://.../repo.git?ref=v1.2.0` | Only if you pin a tag via `?ref=` | Yes | Internal modules without a registry set up |
| GitHub shorthand | `github.com/acme/tf-modules` | Only via `?ref=` | Yes | Same as Git, slightly shorter syntax |
| HTTP/S3 archive | `https://.../vpc.zip` | Only if the URL itself is versioned | Yes | Vendored artifacts, air-gapped environments |

### Example

```hcl
# Local module — same repo, no versioning, always uses current working tree
module "vpc_local" {
  source = "../../modules/vpc"
  cidr_block = "10.0.0.0/16"
}

# Public registry module — versioned, cached, resolved via registry API
module "vpc_registry" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"
  name    = "prod-vpc"
  cidr    = "10.2.0.0/16"
}

# Git source pinned to an exact tag — reproducible across every team that uses it
module "internal_lib" {
  source = "git::https://github.com/acme-corp/tf-modules.git//modules/microservice?ref=v2.3.0"
  service_name = "checkout-api"
}

# Git source pinned to a specific commit SHA — maximally reproducible, no tag needed
module "internal_lib_pinned" {
  source = "git::https://github.com/acme-corp/tf-modules.git//modules/microservice?ref=a1b2c3d"
  service_name = "checkout-api"
}
```

### Common Mistakes

- **Forgetting `?ref=` on a Git source.** Without it, Terraform defaults to the repository's
  default branch (often `main`) — every `terraform init -upgrade` could silently pull in whatever
  the latest commit on `main` happens to be, breaking reproducibility.
- **Using a local path outside the current module tree without `../` prefixes matching reality.**
  Local sources are resolved relative to the calling module's own directory, not the root module's
  directory or the current working directory Terraform was invoked from — a common source of
  "module not found" errors after moving files around.
- **Mixing up the double-slash (`//`) subdirectory separator in Git sources.** The part before
  `//` is the repository URL; the part after is the path *within* that repo to the module. Leaving
  it out when the module isn't at the repo root causes Terraform to try to load the whole repo as
  one module.

### Interview Answer

"Terraform module sources fall into a few categories: local paths (`./` or `../`, unversioned,
used directly from disk), registry sources (public or private, in `namespace/name/provider` or
`hostname/namespace/name/provider` format, versioned via a `version` constraint resolved against
Git tags), Git sources (`git::` prefix or `github.com` shorthand, with an optional `?ref=` to pin
a branch, tag, or commit), and generic archive sources (HTTP or S3 URLs pointing to a zip/tar
file). Local paths are used for modules within the same repository; registry and Git sources are
used for modules shared across repositories or teams, and only Git/registry sources support
proper version pinning."

> **Memory hook:** Source is the shipping address — next door (local), catalog warehouse (registry), a supplier's exact batch number (`?ref=` on Git), or a generic parcel URL (archive).

---

## 4. Version Constraints for Modules

You've pinned module versions in every example so far with something like `version = "~> 5.8"` —
but what does that actually mean, and why not just always use the latest version? Picture this:
your team pins nothing, runs `terraform init` on a Friday, gets version 5.8.1 of a community VPC
module. Three weeks later a new hire runs `terraform init` fresh and silently gets version 6.0.0
— which changed a default and now wants to destroy and recreate half your NAT gateways. Version
constraints exist entirely to prevent this exact scenario: an *unintentional* upgrade sneaking
into someone's `terraform init`.

### Analogy

A version constraint is like specifying "any bus in the 40-series, but nothing above 42" instead
of just "any bus that goes roughly downtown." You still get some flexibility (bug-fix and
minor-update buses are fine to hop on), but you rule out being swept onto a completely different
route (a major version) that happens to also stop nearby.

### Under the Hood

Terraform module versions follow **semantic versioning**: `MAJOR.MINOR.PATCH`.

```
   5    .   8    .   1
   │        │        │
   │        │        └── PATCH: bug fixes only, safe to always take
   │        └─────────── MINOR: new features, backward compatible
   └──────────────────── MAJOR: breaking changes — inputs/outputs may change shape

Constraint syntax:
   version = "5.8.1"     → EXACTLY this version, nothing else
   version = "= 5.8.1"    → same as above, explicit equals form
   version = ">= 5.8.0"   → this version or newer, no upper bound (risky — allows majors)
   version = "<= 5.8.1"   → this version or older
   version = "~> 5.8"     → allows 5.8.x (patch upgrades only), NOT 5.9.0
   version = "~> 5.8.0"   → allows 5.8.x, functionally same as above for this format
   version = "~> 5.0"     → allows 5.x.x (any minor/patch within major version 5), NOT 6.0.0
   version = ">= 5.0, < 6.0.0"  → explicit range, equivalent in spirit to "~> 5.0"
```

The `~>` operator (the "pessimistic constraint operator," sometimes called the "twiddle-wakka")
is by far the most common choice in real projects — it locks the *last specified segment* as the
upper bound, so `~> 5.8` allows any `5.8.x` patch release but refuses `5.9.0`, while `~> 5.0`
allows any `5.x.x` minor/patch release but refuses `6.0.0`.

### Example

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"          # accepts 5.8.0, 5.8.1, 5.8.9 ... but NOT 5.9.0 or 6.0.0

  name = "prod-vpc"
  cidr = "10.2.0.0/16"
}
```

```hcl
# A more permissive constraint — accepts any 5.x release, useful when you trust
# the module's minor-version backward compatibility and want new features automatically
module "vpc_wider" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "staging-vpc"
  cidr = "10.1.0.0/16"
}
```

```hcl
# Exact pin — used when you need maximum reproducibility, e.g. compliance-sensitive
# environments where every apply must use byte-identical module code
module "vpc_exact" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"

  name = "prod-vpc"
  cidr = "10.2.0.0/16"
}
```

Once resolved, run `terraform init -upgrade` to deliberately re-resolve to the newest version
matching your constraint (e.g. picking up 5.8.9 if you were on 5.8.1 and both satisfy `~> 5.8`).
Without `-upgrade`, a plain `terraform init` reuses whatever version was already selected/cached
unless nothing has been initialized yet.

### Common Mistakes

- **No version constraint at all.** Omitting `version` entirely on a registry source means
  Terraform grabs the latest version satisfying no constraint whatsoever — the riskiest possible
  setup, since literally any future release (including breaking major versions) gets picked up on
  a fresh `init`.
- **Using `>=` with no upper bound.** `version = ">= 5.0"` looks like it's pinning something, but
  it allows unlimited future major versions too — functionally almost as risky as no constraint.
- **Confusing module version constraints with provider version constraints.** They use the same
  syntax (`~>`, `>=`, etc.) but are declared in different places — module versions go on the
  `module` block itself; provider versions go in the `required_providers` block inside a
  `terraform` block. They are resolved independently.
- **Assuming a two-segment and three-segment `~>` constraint are always interchangeable.**
  `~> 5.8` and `~> 5.8.0` both restrict to the `5.8.x` patch series here, but the general rule is
  that `~>` locks everything except the rightmost segment you provide — dropping a segment widens
  the allowed range. The safest habit is to always check what a constraint actually resolves to by
  reading the version `terraform init` reports.

### Interview Answer

"Terraform module versions follow semantic versioning — MAJOR.MINOR.PATCH — where major versions
may introduce breaking changes, minor versions add backward-compatible features, and patch
versions are bug fixes only. Version constraints control which releases `terraform init` is
allowed to select: the pessimistic constraint operator `~>` is the most common in practice,
because `~> 5.8` allows patch-level upgrades within 5.8.x while blocking a jump to 5.9.0 or 6.0.0,
protecting you from unintentionally picking up breaking changes on a routine `terraform init`.
Omitting a version constraint entirely, or using an unbounded `>=`, removes that protection and
risks pulling in a breaking major version without warning."

> **Memory hook:** `~>` is "any bus in the 40s, but not 41 or higher" — enough flexibility for bug fixes, not enough to get swept onto a whole new route.

---

## 5. Common Mistakes

A consolidated list of registry- and versioning-related pitfalls to watch for.

| Mistake | Consequence | Fix |
|---------|--------------|-----|
| No `version` constraint on a registry module | Fresh `terraform init` can silently pull in a breaking major version | Always set a `version` constraint, typically `~> X.Y` |
| Git source with no `?ref=` | Defaults to the repo's default branch; reproducibility depends on what's currently on `main` | Always pin `?ref=` to a tag or commit SHA |
| Assuming every registry module is HashiCorp-official | Blind trust in unmaintained or low-quality community modules | Check maintenance activity, open issues, and "Verified"/"Partner" badges before adopting |
| Treating a Git source like a registry source for version discovery | No catalog UI to browse available tags | Check the repo's own release/tags page on GitHub/GitLab directly |
| Forgetting the registry hostname on a private registry source | Terraform assumes the public registry and fails to find the module | Always include the hostname, e.g. `app.terraform.io/org/name/provider` |
| Not running `terraform init -upgrade` after loosening/changing a version constraint | Stale cached module version keeps being used even though the constraint now allows newer ones | Run `terraform init -upgrade` deliberately when you want to move forward |

> **Memory hook:** Registry and versioning mistakes are almost always "I didn't pin something I should have" — pin the version, pin the ref, pin the hostname.

---

## 6. Hands-On Exercises

**Exercise 1 — Use a Public Registry Module**
Add a `module "vpc"` block sourced from `terraform-aws-modules/vpc/aws` with a `~>` version
constraint. Run `terraform init` and inspect `.terraform/modules/` to see what got downloaded.
Note the exact version Terraform resolved to.

**Exercise 2 — Compare Version Constraint Behaviors**
Starting from version `4.2.1`, write down which of these versions each constraint would allow:
`4.2.5`, `4.3.0`, `5.0.0`.
- `version = "~> 4.2"`
- `version = "~> 4.2.1"`
- `version = ">= 4.2.1"`
- `version = "4.2.1"`

**Exercise 3 — Git Source With and Without a Ref**
Write two `module` blocks pointing at the same hypothetical Git repository, one with `?ref=v1.0.0`
and one without any `ref` at all. Explain in your own words what could go wrong with the second
one six months from now.

**Exercise 4 — Source Type Identification**
For each source string below, identify the source type (local, public registry, private registry,
Git, HTTP archive) and whether it supports version pinning natively:
```
a) "../modules/vpc"
b) "terraform-aws-modules/security-group/aws"
c) "git::https://github.com/acme/tf-modules.git//modules/db?ref=v3.1.0"
d) "app.terraform.io/acme-corp/eks/aws"
e) "https://artifacts.example.com/modules/vpc-v2.zip"
```

**Exercise 5 — Upgrade Safely**
Given a module pinned at `version = "~> 3.4"`, describe the exact sequence of commands and checks
you'd run to safely move to the `4.x` major version, assuming the module's changelog documents
breaking changes.

---

## 7. Interview Q&A

---

**Q1: What is the Terraform public registry, and what format does its module source address use?**

A: It's a public catalog at registry.terraform.io hosting community and partner-maintained
modules, addressed in the shorthand format `namespace/name/provider` (e.g.
`terraform-aws-modules/vpc/aws`), with versions resolved via a `version` constraint against the
module's tagged Git releases.

---

**Q2: How does a private module registry differ from the public one?**

A: A private registry (offered by Terraform Cloud/Enterprise) works the same way but is scoped to
an organization and requires authentication. Its source address includes the registry hostname,
e.g. `app.terraform.io/acme-corp/vpc/aws`, distinguishing it from the public registry's shorthand
form. It connects directly to your VCS provider, so pushing a new Git tag automatically publishes
a new module version with no separate publish step.

---

**Q3: What are the main types of module `source` addresses Terraform supports?**

A: Local paths (`./` or `../`, unversioned), registry sources (public or private, versioned via
`version` constraints), Git sources (`git::` prefix or GitHub shorthand, optionally pinned with
`?ref=`), and generic HTTP/S3 archive URLs. Only registry and Git sources support meaningful
version pinning; local paths always reflect whatever is currently on disk.

---

**Q4: Why should you always pin a `?ref=` on a Git module source?**

A: Without `?ref=`, Terraform defaults to the repository's default branch (often `main`), so every
fresh `terraform init` could pull in whatever the latest commit happens to be at that moment —
breaking reproducibility between team members or between environments. Pinning `?ref=` to a
specific tag or commit SHA guarantees everyone gets the exact same module code.

---

**Q5: What does the `~>` version constraint operator do?**

A: It's the pessimistic constraint operator: it allows upgrades only within the last specified
version segment. `~> 5.8` allows any `5.8.x` patch release but blocks `5.9.0`; `~> 5.0` allows any
`5.x.x` minor/patch release but blocks `6.0.0`. It's the most common real-world choice because it
allows safe bug-fix (and optionally minor-feature) upgrades while protecting against unintentional
breaking major-version upgrades.

---

**Q6: What happens if you omit the `version` argument on a registry module source entirely?**

A: Terraform will resolve to the latest available version with no upper bound whatsoever on a
fresh `init` — the riskiest possible configuration, since any future release, including a
breaking major version, could be silently adopted the next time someone (or CI) runs
`terraform init` from scratch.

---

**Q7: How do you deliberately move a module to a newer version once you've changed its `version`
constraint?**

A: Update the `version` argument on the `module` block to the new constraint, then run
`terraform init -upgrade`. Without the `-upgrade` flag, Terraform reuses whatever module version
is already cached/selected rather than re-resolving against the (now wider or shifted) constraint.
