# 03 — Cost Management, Multi-Cloud & Disaster Recovery

## Table of Contents

1. [Cost Estimation Tools](#1-cost-estimation-tools)
2. [Multi-Cloud & Multi-Region Considerations](#2-multi-cloud--multi-region-considerations)
3. [Disaster Recovery Patterns with Terraform](#3-disaster-recovery-patterns-with-terraform)
4. [Final Production Readiness Checklist](#4-final-production-readiness-checklist)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Cost Estimation Tools

Picture this: a PR adds what looks like an innocent change — switching an RDS instance from
`db.t3.medium` to `db.r6g.4xlarge` "to fix a performance issue," and enabling Multi-AZ "for safety."
The `terraform plan` output shows attribute changes, but it does not show a dollar sign anywhere.
Nobody on the review notices the instance class jumped roughly 15x in size until the AWS bill
arrives three weeks later, $4,000 higher than budgeted. Terraform is extremely good at telling you
*what infrastructure will change* — it says nothing, by default, about *what that will cost*. Cost
estimation tools close that gap by turning a plan into a priced-out estimate, right in the PR, before
anyone clicks apply.

### Analogy

`terraform plan` without cost estimation is like a shopping cart that shows you the list of items
you're about to buy but hides the total until after checkout. A cost estimation tool is the running
total at the top of the cart — you see "$4,127/month" update in real time as you add or remove
items, so you can put something back *before* you pay.

### How It Works Under the Hood

```
┌──────────────────────────────────────────────────────────────┐
│  terraform plan -out=tfplan                                    │
│  (produces a plan file: resources to add/change/destroy,       │
│   with all their final attribute values)                       │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Cost estimation tool (Infracost CLI / TFC cost estimation)     │
│                                                                  │
│  1. Parses the plan JSON (terraform show -json tfplan)          │
│  2. For each resource, looks up its "priceable" attributes       │
│     (instance type, storage size, provisioned IOPS, ...)         │
│  3. Queries a pricing catalog (cloud provider's public pricing   │
│     API / a cached pricing database)                             │
│  4. Multiplies unit price × quantity × hours-per-month           │
│  5. Outputs a diff: cost BEFORE this plan vs. cost AFTER          │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
              Posted as a PR comment / CI check
              "Monthly cost estimate: +$4,127.40 (+38%)"
```

### Example — Infracost in a PR

```bash
# Locally, or in CI
infracost breakdown --path . --format table
```

Example output:

```
 Name                                    Monthly Qty  Unit    Monthly Cost

 aws_db_instance.orders
 ├─ Database instance (db.r6g.4xlarge)           730  hours       $1,468.60
 ├─ Storage (gp3, 500 GB)                        500  GB             $57.50
 └─ Multi-AZ standby                             730  hours       $1,468.60

 aws_instance.app[0]
 └─ Instance usage (m6i.large, on-demand)        730  hours          $70.08

 aws_instance.app[1]
 └─ Instance usage (m6i.large, on-demand)        730  hours          $70.08

 OVERALL TOTAL                                                    $3,134.86
```

Wiring this into CI so it comments on every PR:

```yaml
# .github/workflows/infracost.yml
name: Infracost

on: [pull_request]

jobs:
  infracost:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: infracost/actions/setup@v3
        with:
          api-key: ${{ secrets.INFRACOST_API_KEY }}

      - name: Generate Infracost diff
        run: |
          infracost diff --path=environments/prod \
            --format=json --out-file=infracost.json

      - name: Post PR comment
        run: |
          infracost comment github --path=infracost.json \
            --repo=$GITHUB_REPOSITORY --pull-request=${{ github.event.pull_request.number }} \
            --github-token=${{ secrets.GITHUB_TOKEN }} --behavior=update
```

Terraform Cloud/Enterprise offers an equivalent built-in **cost estimation** feature on runs (paid
tiers), showing the monthly cost delta directly in the run UI without a separate tool.

### Comparison Table — Cost Estimation Options

| Tool | Integration point | Pricing source | Notes |
|---|---|---|---|
| Infracost (CLI/Cloud) | CI (GitHub Actions, GitLab CI), PR comments | Cached cloud pricing catalogs | Open-source CLI, free tier for cost diffs |
| Terraform Cloud/Enterprise cost estimation | Native in TFC/TFE run UI | Provider pricing APIs | Requires Team & Governance tier or above |
| Cloud-native calculators (AWS Pricing Calculator) | Manual, standalone | Provider's own pricing | Not tied to your actual `.tf`/plan — manual and easy to get stale |
| `terraform plan` alone | N/A | None | Shows resource changes only, no cost information at all |

### Common Confusion

Cost estimation tools price the **plan**, not historical usage — they can't account for
usage-based costs that depend on runtime behavior (data transfer volume, request counts, S3
storage that grows over time). A `t3.micro` EC2 instance has a fixed, accurately-estimable monthly
cost; an API Gateway or Lambda function's cost depends on traffic the plan has no way to know in
advance. Treat these tools as accurate for provisioned/fixed-capacity resources and as a rough floor
for usage-based ones.

### Interview Answer

"Cost estimation tools like Infracost parse the JSON output of a `terraform plan`, match each
resource's priceable attributes (instance type, storage size, provisioned throughput) against a
cloud pricing catalog, and produce a monthly cost delta — before versus after the plan — posted
directly as a PR comment. This turns a silent infrastructure diff into a priced-out diff, so a
reviewer catches a costly change (like an oversized instance type) before it's ever applied, not
after the bill arrives."

> **Memory hook:** `terraform plan` shows the cart; a cost estimation tool shows the running total before you check out.

---

## 2. Multi-Cloud & Multi-Region Considerations

A team migrating off a single AWS region often reaches for the same instinct twice: "let's also
run on GCP, just in case AWS has an outage" and "let's put everything in three regions, just in
case." Both instincts are reasonable *fears* — vendor lock-in, regional outages — but both come
with a real, ongoing cost in complexity that's easy to underestimate until you're the one on-call
debugging a provider-specific quirk in a Terraform module that has to work identically on two
clouds.

### Analogy

Multi-region within one cloud is like a restaurant chain opening a second location across town —
same recipes, same suppliers, same staff training, just a different building. Multi-cloud is like
that same chain also opening a restaurant that has to use a completely different oven brand, a
different supplier network, and a different staff scheduling system, in a country with different
food safety regulations — because their *menu* has to look identical to customers, all of the
complexity of making that true is hidden behind the scenes, permanently, for every future dish they
add.

### Recap: Provider Aliasing for Multi-Region

Within a single cloud, multi-region is comparatively cheap using **provider aliases** (from Phase
2/8):

```hcl
provider "aws" {
  alias  = "primary"
  region = "us-east-1"
}

provider "aws" {
  alias  = "secondary"
  region = "us-west-2"
}

resource "aws_db_instance" "primary" {
  provider           = aws.primary
  identifier         = "orders-db-primary"
  engine             = "postgres"
  instance_class     = "db.r6g.large"
  allocated_storage  = 100
}

resource "aws_db_instance" "read_replica" {
  provider            = aws.secondary
  identifier          = "orders-db-replica-west"
  replicate_source_db = aws_db_instance.primary.arn
  instance_class      = "db.r6g.large"
}
```

This works because it's the *same* API surface, the *same* IAM model, the *same* provider plugin —
you're just pointing different resource blocks at different regions of one provider.

### Multi-Cloud Is a Different Problem Entirely

Multi-cloud (AWS + GCP + Azure for the *same* workload) means:

- Different provider blocks, different resource types, different naming for equivalent concepts
  (`aws_instance` vs `google_compute_instance` vs `azurerm_linux_virtual_machine`).
- Modules cannot be shared as-is between clouds — you either write cloud-specific modules with a
  shared *interface*, or you accept significant duplication.
- IAM, networking, and observability are conceptually similar but operationally distinct — VPC
  peering vs VPC Network Peering vs VNet Peering, IAM roles vs GCP service accounts vs Azure managed
  identities.
- Your CI/CD, secrets management, and cost tooling all need to understand multiple providers.

```
┌─────────────────────────────────────────────────────────────────┐
│                    "One workload, one interface"                  │
│                                                                     │
│   modules/database/                                                │
│   ├── aws/       (aws_db_instance, aws_db_subnet_group, ...)       │
│   ├── gcp/       (google_sql_database_instance, ...)               │
│   └── azure/     (azurerm_postgresql_flexible_server, ...)         │
│                                                                     │
│   Root module picks the right implementation per environment:      │
│   module "database" {                                               │
│     source = var.cloud == "aws" ? "./modules/database/aws"          │
│                                  : "./modules/database/gcp"          │
│   }                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### When Multi-Cloud Is (and Isn't) Worth It

| Scenario | Multi-cloud worth it? | Why |
|---|---|---|
| Regulatory requirement to use a specific sovereign/government cloud region | Yes | Non-negotiable compliance constraint |
| Genuine fear of single-vendor pricing leverage at massive scale | Sometimes | Real cost leverage, but only pays off past significant scale |
| "Just in case AWS has an outage" for a mid-size product | Usually not | AWS regional outages are rare; multi-*region* within AWS solves this far more cheaply |
| Acquired a company already running on a different cloud | Often unavoidable | Migration cost may exceed the cost of running both for a transition period |
| Using a best-of-breed service only available on one cloud (e.g., a specific ML platform) | Selectively | Multi-cloud *for that one service*, not the whole stack |
| Small team, early-stage startup | No | The operational tax (double the provider expertise, double the tooling) usually isn't worth it before you have real scale problems |

### Common Confusion

Multi-region and multi-cloud are often conflated, but they solve different failure modes at very
different costs. Multi-region protects against a *regional* outage or disaster (a data center
losing power, a natural disaster) and is comparatively cheap because it's the same provider APIs.
Multi-cloud protects against a *provider-wide* outage or a business risk like vendor lock-in, and
it is dramatically more expensive in engineering time. Most teams that think they need multi-cloud
actually need multi-region, which solves 90% of the realistic disaster scenarios at a fraction of
the cost.

### Interview Answer

"Multi-region within a single cloud is achieved cheaply with Terraform provider aliases — same
resource types, same provider plugin, just different region arguments — and it's the right
default answer for surviving a regional outage or disaster. Multi-cloud means genuinely different
provider blocks, resource types, and operational models per cloud, and it's a much bigger
ongoing engineering cost that's only worth paying for specific reasons — regulatory requirements,
a best-of-breed service only available elsewhere, or leverage at a scale where vendor negotiating
power matters. I'd default to multi-region and only reach for multi-cloud with a concrete,
named justification, not general risk-aversion."

> **Memory hook:** Multi-region is a second restaurant location with the same kitchen equipment. Multi-cloud is a second restaurant with a different oven brand, different suppliers, and different regulations — same menu on the outside, permanent extra complexity on the inside.

---

## 3. Disaster Recovery Patterns with Terraform

Imagine your primary AWS region goes dark — not a single service, the whole region. Your
application is down, and every minute matters. The question that decides how bad this day gets was
actually answered months ago, during calm, boring planning time: do you have a **tested** way to
stand the whole stack back up somewhere else, and do you know how long that actually takes? DR
planning is precisely the discipline of answering that question *before* the emergency, because
during the emergency there's no time to discover the answer is "we don't actually know."

### Analogy

Disaster recovery planning is a fire escape plan, not a fire extinguisher. A fire extinguisher
(monitoring, alerting, redundancy) handles small problems in place. A fire escape plan is what you
do when the building itself is the problem — and a fire escape plan you've never actually walked
is not a plan, it's a guess. The equivalent guess in infrastructure is a DR runbook nobody has ever
actually executed against a real (or realistically simulated) region failure.

### Pattern 1 — State File Backups

Your Terraform state file is the map of your entire infrastructure. If it's lost or corrupted
*during* a disaster, you lose your ability to safely recover with Terraform at all — you'd be stuck
reverse-engineering `import` blocks for everything under time pressure.

```hcl
terraform {
  backend "s3" {
    bucket         = "acme-tfstate-prod"
    key            = "app-layer/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "acme-tf-locks"
    encrypt        = true
  }
}

resource "aws_s3_bucket" "tfstate" {
  bucket = "acme-tfstate-prod"
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"        # every state write keeps prior versions
  }
}

resource "aws_s3_bucket_replication_configuration" "tfstate_dr" {
  bucket = aws_s3_bucket.tfstate.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "replicate-state-to-dr-region"
    status = "Enabled"
    destination {
      bucket        = "arn:aws:s3:::acme-tfstate-prod-dr-west"
      storage_class = "STANDARD"
    }
  }

  depends_on = [aws_s3_bucket_versioning.tfstate]
}
```

Versioning means an accidental `terraform state rm` or corrupted write can be rolled back to a
prior version. Cross-region replication means the state bucket itself survives a regional outage.

### Pattern 2 — Multi-Region Failover Configuration

Design the *application* layer so failover is a matter of promoting standing infrastructure, not
building it from scratch during the incident:

```hcl
module "app_primary" {
  source  = "./modules/app-stack"
  region  = "us-east-1"
  is_primary = true
  min_capacity = 4
}

module "app_standby" {
  source  = "./modules/app-stack"
  region  = "us-west-2"
  is_primary = false
  min_capacity = 1     # warm standby: minimal capacity, scales up on failover
}

resource "aws_route53_health_check" "primary" {
  fqdn              = module.app_primary.alb_dns_name
  port              = 443
  type              = "HTTPS"
  request_interval  = 30
  failure_threshold = 3
}

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "app.acme.com"
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }
  set_identifier  = "primary"
  health_check_id = aws_route53_health_check.primary.id
  alias {
    name                   = module.app_primary.alb_dns_name
    zone_id                = module.app_primary.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "app_failover" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "app.acme.com"
  type    = "A"

  failover_routing_policy {
    type = "SECONDARY"
  }
  set_identifier = "secondary"
  alias {
    name                   = module.app_standby.alb_dns_name
    zone_id                = module.app_standby.alb_zone_id
    evaluate_target_health = true
  }
}
```

### Pattern 3 — Re-Provisioning Speed as a DR Strategy

Not every workload justifies the ongoing cost of a warm standby. For less critical systems, the DR
strategy can simply be "we can re-provision this entire environment from scratch, fast, because
it's 100% defined in Terraform" — this is a legitimate strategy *only if it's been measured and
tested*, not assumed.

```
┌───────────────────────────────────────────────────────────────┐
│              DR STRATEGY SPECTRUM (cost vs. recovery time)       │
│                                                                    │
│  Cold (re-provision)   Warm standby        Hot (active-active)   │
│  ├──────────────────┼───────────────────┼─────────────────────┤ │
│  Cost:     $         Cost:     $$          Cost:      $$$        │
│  RTO:  30-90+ min    RTO:  2-10 min        RTO:  seconds          │
│                                                                    │
│  DR = "terraform     DR = standby stack    DR = both regions      │
│   apply in DR        already running at    serving live traffic   │
│   region from        low capacity,         simultaneously,        │
│   scratch"           promoted on failover  no failover needed     │
└───────────────────────────────────────────────────────────────┘
```

```bash
# The "cold" strategy in practice — measure this, don't assume it
time (
  terraform -chdir=environments/dr init &&
  terraform -chdir=environments/dr apply -auto-approve
)
# real  0m47m12s   <- THIS number is your actual RTO. Write it down. Test it quarterly.
```

### Comparison Table — DR Strategies

| Strategy | RTO (recovery time) | RPO (data loss window) | Ongoing cost | Good for |
|---|---|---|---|---|
| Backup + re-provision (cold) | Tens of minutes to hours | Since last backup | Lowest | Non-critical internal tools, dev/staging |
| Pilot light (minimal standby, e.g., DB replica only) | Minutes to tens of minutes | Near-zero (replicated data) | Low-medium | Most production services |
| Warm standby (scaled-down full stack running) | Minutes | Near-zero | Medium-high | Customer-facing production, revenue-generating |
| Active-active (both regions live) | Seconds (no failover needed) | Zero | Highest | Mission-critical, SLA-bound systems |

### Common Confusion

"We have backups" is not the same as "we have tested disaster recovery." A DR plan that has never
been executed end-to-end is a hypothesis, not a capability — the first time you find out your
`terraform apply -auto-approve` for the DR region actually fails on a stale provider version, or a
hardcoded AMI ID that was deprecated, should not be during a real regional outage. Schedule DR
drills (quarterly is common) that actually run the recovery steps against a real or sandboxed
environment and time them.

### Interview Answer

"Terraform supports disaster recovery through a few concrete patterns: versioned and
cross-region-replicated state file backups so the map of your infrastructure survives a regional
outage; multi-region failover configurations using provider aliases plus something like Route 53
health-check-based failover routing; and, for less critical systems, treating fast re-provisioning
from code as the DR strategy itself. The key discipline across all of them is measuring actual
recovery time with real drills — a DR plan that's never been executed is just an assumption, and
regional outages are exactly the wrong time to discover it doesn't work."

> **Memory hook:** A DR plan you've never run is a fire escape you've never walked — don't find out it's blocked during the actual fire.

---

## 4. Final Production Readiness Checklist

Before this course's final module closes, here is the checklist that ties every phase together —
the questions a production readiness review should ask before a Terraform-managed system takes
real traffic.

```
┌─ STATE & BACKEND ──────────────────────────────────────────────┐
│ [ ] Remote backend configured (S3+DynamoDB, TFC, etc.)          │
│ [ ] State versioning enabled                                     │
│ [ ] State bucket encrypted at rest                               │
│ [ ] Cross-region state replication for critical environments     │
│ [ ] State locking verified (concurrent applies actually block)   │
└──────────────────────────────────────────────────────────────--┘
┌─ MODULE DESIGN ─────────────────────────────────────────────────┐
│ [ ] Layers separated (network/data/compute/app) with own state   │
│ [ ] Internal modules versioned (Git tags or private registry)    │
│ [ ] No god modules — each module has one responsibility          │
│ [ ] All variables/outputs documented                             │
└──────────────────────────────────────────────────────────────--┘
┌─ SECURITY & SECRETS ────────────────────────────────────────────┐
│ [ ] No secrets committed in .tf or .tfvars                       │
│ [ ] Secrets sourced from Vault/SSM/Secrets Manager                │
│ [ ] Least-privilege IAM for CI/CD execution role                 │
│ [ ] Console write access restricted for shared environments       │
└──────────────────────────────────────────────────────────────--┘
┌─ CI/CD & TESTING ───────────────────────────────────────────────┐
│ [ ] terraform fmt/validate/plan run in CI on every PR             │
│ [ ] terraform test / Terratest coverage for critical modules      │
│ [ ] Manual approval gate before apply to production               │
│ [ ] Cost estimation (Infracost/TFC) posted on PRs                 │
└──────────────────────────────────────────────────────────────--┘
┌─ DRIFT & CHANGE MANAGEMENT ─────────────────────────────────────┐
│ [ ] Scheduled drift detection (nightly plan, alerting)            │
│ [ ] Break-glass process defined with codification SLA             │
│ [ ] Every managed resource tagged (ManagedBy=terraform)            │
└──────────────────────────────────────────────────────────────--┘
┌─ DISASTER RECOVERY ─────────────────────────────────────────────┐
│ [ ] DR strategy chosen deliberately (cold/pilot/warm/active-active)│
│ [ ] RTO/RPO targets written down and agreed with stakeholders      │
│ [ ] DR drill executed and timed at least once, repeated on a cadence│
└──────────────────────────────────────────────────────────────--┘
```

> **Memory hook:** If you can't check every box above, you don't have a production system yet — you have a demo that hasn't failed loudly enough.

---

## 5. Common Mistakes

- **Reviewing infrastructure PRs without ever seeing a cost delta**, letting expensive instance-size
  or Multi-AZ changes slip through unnoticed until the bill arrives.
- **Reaching for multi-cloud out of general risk-aversion** rather than a specific, named
  requirement — paying a permanent complexity tax for a rarely-realized benefit.
- **Confusing "we have backups" with "we have tested DR"** — an untested plan is a hypothesis.
- **Choosing a DR strategy (cold/warm/active-active) without writing down RTO/RPO targets first** —
  without a target, there's no way to know if the chosen strategy is even adequate.
- **Skipping the production readiness checklist for "just this one exception"** — exceptions are
  exactly where drift, cost overruns, and failed DR drills come from later.

---

## 6. Hands-On Exercises

**Exercise 1 — Wire Up Cost Estimation**
Add an Infracost (or equivalent) step to a CI pipeline for a Terraform project that provisions an
RDS instance and two EC2 instances. Simulate a change from `db.t3.medium` to `db.r6g.2xlarge` and
write down the cost delta the tool would report.

**Exercise 2 — Multi-Region vs Multi-Cloud Decision Memo**
Your company runs a customer-facing SaaS product on AWS in `us-east-1`, doing $2M ARR, currently
single-region. Leadership asks whether to go multi-region or multi-cloud for resilience. Write a
one-page decision memo (bullet points) recommending one, with a comparison table of cost and
complexity for both options, citing the actual failure modes each solves.

**Exercise 3 — Design a DR Runbook**
For a three-tier app (ALB, ECS Fargate, RDS Postgres) in `us-east-1`, design a pilot-light DR
strategy in `us-west-2`: what's kept warm (e.g., an RDS read replica), what's provisioned on
failover (ECS services, ALB), and what the Route 53 failover configuration looks like. State your
target RTO and RPO.

**Exercise 4 — Run a Production Readiness Review**
Using the checklist in Section 4, audit a real or hypothetical Terraform project you've worked
with in this course (or from Phases 9-11). For each unchecked box, write one sentence describing
the concrete next step to check it off.

---

## 7. Interview Q&A

---

**Q1: How do cost estimation tools like Infracost integrate into a Terraform workflow?**

A: They parse the JSON output of `terraform plan` (or `terraform show -json`), map each resource's
priceable attributes to a cloud pricing catalog, and compute a monthly cost delta between the
current and proposed state. This is typically wired into CI to post a cost comment on every pull
request, so reviewers see the dollar impact of an infrastructure change before approving it.

---

**Q2: What's the practical difference between multi-region and multi-cloud, and when is each
justified?**

A: Multi-region uses provider aliases within a single cloud — same resource types, same API,
different region argument — and cheaply protects against a regional outage. Multi-cloud means
genuinely different providers, resource types, and operational models, and carries a much larger
permanent engineering cost. Multi-region is the default answer for resilience; multi-cloud needs
a specific justification like a regulatory requirement, a best-of-breed service unique to one
cloud, or vendor leverage at significant scale.

---

**Q3: What are RTO and RPO, and how do they shape a DR strategy choice?**

A: RTO (Recovery Time Objective) is how long you can be down before it's unacceptable; RPO
(Recovery Point Objective) is how much data loss (measured in time) is acceptable. A cold
re-provisioning strategy might have an RTO of an hour and an RPO equal to your last backup
interval; a warm standby cuts RTO to minutes; active-active drives both close to zero at the
highest ongoing cost. You choose the strategy that meets the business's actual RTO/RPO
requirements at the lowest cost, not the fanciest option available.

---

**Q4: How does Terraform support state file disaster recovery specifically?**

A: By enabling versioning on the state backend (e.g., S3 bucket versioning) so accidental or
corrupted writes can be rolled back, and enabling cross-region replication of the state bucket so
the state itself survives a regional outage. Since the state file is the map connecting your code
to real resource IDs, losing it during a disaster would force manual `import` reconstruction under
time pressure — exactly what you want to avoid.

---

**Q5: Why is "we can re-provision everything from Terraform" not automatically a valid DR
strategy?**

A: Because it's only valid if the actual re-provisioning time has been measured and meets the
required RTO — an untested assumption about how long `terraform apply` would take in a fresh
region, run for the first time during a real disaster, can be wildly wrong (stale provider
versions, deprecated AMI IDs, missing prerequisite resources). It becomes a valid strategy only
after a timed DR drill confirms it actually works within the target RTO.

---

**Q6: What does a production readiness review check for a Terraform-managed system?**

A: Backend/state health (remote backend, versioning, locking, replication), module design
(layered state, versioned internal modules, no god modules), security (no committed secrets,
least-privilege CI/CD IAM, restricted console access), CI/CD rigor (fmt/validate/plan/test in CI,
approval gates, cost estimation on PRs), drift management (scheduled detection, tagging,
break-glass SLA), and disaster recovery (a deliberately chosen strategy with written RTO/RPO
targets, tested via drills).

---

**Q7: A stakeholder says "let's just go multi-cloud to avoid vendor lock-in." How do you respond in
an interview-style answer?**

A: I'd ask what specific risk we're trying to mitigate — true vendor lock-in risk (pricing
leverage, contract terms) is usually a business/procurement lever, not primarily solved by running
duplicate infrastructure. If the concern is really "what if AWS goes down," multi-region within
AWS solves that at a fraction of the engineering cost. I'd only recommend multi-cloud if there's a
concrete, named driver — a regulatory requirement, a best-of-breed service only available on
another cloud, or genuine leverage at a scale where it's been shown to matter — because the
ongoing complexity tax (duplicated modules, duplicated expertise, duplicated tooling) is permanent
and substantial.
