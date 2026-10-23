# 01 — What is Terraform & Infrastructure as Code?

## Table of Contents

1. [What is Infrastructure as Code?](#1-what-is-infrastructure-as-code)
2. [Declarative vs Imperative IaC](#2-declarative-vs-imperative-iac)
3. [Terraform vs Ansible vs CloudFormation vs Pulumi](#3-terraform-vs-ansible-vs-cloudformation-vs-pulumi)
4. [How Terraform Works](#4-how-terraform-works)
5. [Real-World Terraform Usage](#5-real-world-terraform-usage)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is Infrastructure as Code?

Picture a new engineer joining your team. They need a VPC, three subnets, a security group, an
EC2 instance, an RDS database, and an S3 bucket — all wired together exactly like production.
Today, that means logging into the AWS Console and clicking through a dozen screens, hoping you
remember every checkbox the senior engineer ticked eight months ago. Two weeks later, someone
"quickly fixes" a security group rule directly in the console to unblock a demo. Nobody documents
it. Six months later staging and production have quietly drifted apart, and nobody can say
exactly *why* they're different anymore. This is the world of **ClickOps** — infrastructure built
by hand, one click at a time, with no record of what was done or why.

**Infrastructure as Code (IaC)** is the practice of defining your infrastructure — servers,
networks, databases, load balancers, DNS records, IAM policies — in text files that a tool reads
and turns into real, running infrastructure. Instead of clicking buttons, you write a file that
says "I want a t3.micro EC2 instance in this subnet with this security group," commit it to git,
and run a command. The infrastructure that gets created is a direct, reproducible consequence of
that file.

### Analogy

ClickOps is building a house by verbally telling a construction crew what to do, room by room,
with no blueprint — and hoping everyone remembers the plan the next time the house needs a repair
or a duplicate needs to be built next door. Infrastructure as Code is handing the crew an actual
architectural blueprint: precise, versioned, reviewable by other architects before a single brick
is laid, and re-usable to build the exact same house again in a different city.

### Under the Hood: Why Files Matter

The real power isn't just "typing instead of clicking" — it's what a text file *enables* that a
console click never can:

```
┌────────────────────────────────────────────────────────────────┐
│                         main.tf (text file)                     │
│  resource "aws_instance" "web" {                                 │
│    ami           = "ami-0c55b159cbfafe1f0"                       │
│    instance_type = "t3.micro"                                    │
│  }                                                                │
└───────────────────────────┬──────────────────────────────────────┘
                            │  git commit, git diff, code review,
                            │  pull request, rollback via git revert
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                       Terraform CLI                              │
│   Reads the file → talks to AWS API → creates the real instance │
└───────────────────────────┬──────────────────────────────────────┘
                            ▼
                  Real EC2 instance running in AWS
```

Because the "source of truth" is a file, you get things that ClickOps can never give you:
- **Version control** — every change to infrastructure is a git commit with an author and a diff.
- **Code review** — a teammate can review a planned infrastructure change *before* it happens.
- **Reproducibility** — spin up an identical staging environment from the same files.
- **Disaster recovery** — if a region disappears, re-run the same files elsewhere.
- **Documentation that can't go stale** — the file *is* the infrastructure; it cannot lie about what exists (as long as it's applied).

### Common Confusion

A lot of newcomers think "Infrastructure as Code" just means "a script that runs AWS CLI commands
in order" — e.g., a bash script full of `aws ec2 run-instances`. That's **automation**, not IaC.
The defining trait of real IaC tools (Terraform, CloudFormation, Pulumi) is that they are
**idempotent and state-aware**: running the same file twice doesn't create two instances — the
tool checks what already exists and only makes the changes needed to match the file. A bash
script of CLI calls has no memory of what it already did; a Terraform config does (via its state
file, covered in section 4).

### Interview Answer

"Infrastructure as Code is the practice of defining infrastructure — compute, networking,
storage, IAM, DNS — in versioned, declarative configuration files instead of manually clicking
through a cloud console. A tool like Terraform reads those files and reconciles real
infrastructure to match them. The key benefits are version control, peer review of infrastructure
changes, reproducibility across environments, and eliminating configuration drift, because the
file — not someone's memory of what they clicked — is the single source of truth."

> **Memory hook:** ClickOps is verbal instructions to a construction crew with no blueprint. IaC is handing them a blueprint that a second crew, in a second city, can build from identically.

---

## 2. Declarative vs Imperative IaC

Say you need 5 EC2 instances. An imperative approach says: "run this API call 5 times." That
works fine — until you need to *change* something. Now you need 7 instances instead of 5. Do you
add 2 more calls? What if 2 of the original 5 were already deleted manually last week? An
imperative script has no idea what currently exists — it just blindly executes steps, which means
*you* have to track state in your head. Terraform takes the opposite approach: you say "I want 7
of these," it looks at what's actually running, and figures out the difference itself.

### Analogy

Imperative is telling a stock clerk "add 2 more boxes to the shelf" — but that only works if you
know exactly how many boxes are already there. Declarative is telling the clerk "make sure there
are always 7 boxes on this shelf" — the clerk checks the shelf themselves, counts what's there,
and adds or removes boxes to match, regardless of what happened yesterday.

### The Core Difference

| Approach | You describe... | Tool tracks state? | Example tool |
|----------|-----------------|---------------------|--------------|
| **Imperative** | The exact sequence of API calls to run | No — you must track it yourself | Bash + AWS CLI, boto3 scripts |
| **Declarative** | The desired end state | Yes — compares desired vs. actual | Terraform, CloudFormation, Kubernetes manifests |

### Under the Hood

```hcl
# main.tf — declarative: "I want 7 instances of this shape to exist"
resource "aws_instance" "app" {
  count         = 7
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  tags = {
    Name = "app-server"
  }
}
```

When you run `terraform apply`:

1. Terraform reads this file — the **desired state**.
2. Terraform reads its **state file** — what it believes currently exists.
3. Terraform (optionally) refreshes state against the real AWS API — the **actual state**.
4. It computes a **diff**: desired vs. actual.
5. It performs only the operations needed to close that gap — create 2 more instances, or destroy
   1 that shouldn't exist, or change nothing if desired already equals actual.

You never wrote "create," "update," or "delete" yourself. You wrote the target, and Terraform's
engine computed the verbs.

### Common Confusion

Newcomers sometimes think "declarative" means "there's no logic, just static config." In reality
HCL (Terraform's language) supports loops (`count`, `for_each`), conditionals, and functions — you
can express fairly complex logic. The declarative property isn't "no logic allowed"; it's that
the *output* of all that logic is always a description of a desired end state, never a sequence
of imperative commands like "call CreateInstance, then call AttachVolume."

### Interview Answer

"Declarative IaC means you describe the desired end state of your infrastructure, and the tool
figures out the sequence of API calls needed to get there by diffing desired state against
current state. Imperative IaC means you write the exact steps yourself. Terraform is declarative:
you say 'I want 7 instances,' and whether there are currently 0, 5, or 10, Terraform computes
the create/destroy operations needed to reach exactly 7."

> **Memory hook:** Imperative counts boxes and tells the clerk what to add. Declarative just says "keep 7 boxes here" and lets the clerk do the counting.

---

## 3. Terraform vs Ansible vs CloudFormation vs Pulumi

Every cloud team eventually asks: "why Terraform, and not [some other tool]?" The honest answer
is that these tools solve overlapping but distinct problems, and picking the right one (or
combining them) is a real architectural decision, not a popularity contest.

### Analogy

Think of building and running a restaurant. **Terraform** is the general contractor who builds
the building, plumbing, and electrical — the infrastructure itself. **Ansible** is the staff
trainer who shows up *after* the building exists and configures how the kitchen actually runs
(installing software, tuning configs, applying patches). **CloudFormation** is like hiring the
landlord's own in-house contractor — only works for that landlord's buildings (AWS-only), but
deeply integrated with their systems. **Pulumi** is a contractor who lets you write the blueprint
in a general-purpose programming language (Python, TypeScript) instead of a blueprint-specific
notation.

### Comparison Table

| Tool | Category | Language | Cloud scope | State management | Best for |
|------|----------|----------|-------------|-------------------|----------|
| **Terraform** | Provisioning (IaC) | HCL (declarative DSL) | Multi-cloud (AWS, GCP, Azure, 3000+ providers) | Explicit state file (local or remote backend) | Provisioning cloud resources across one or many providers |
| **Ansible** | Configuration management | YAML (playbooks) | Agentless, works on any host (cloud or on-prem) | No state file — re-runs are idempotent via checks | Installing packages, configuring OS-level settings, app deployment on existing servers |
| **CloudFormation** | Provisioning (IaC) | JSON/YAML | AWS only | Managed by AWS itself (stacks) | Teams fully committed to AWS wanting no third-party state to manage |
| **Pulumi** | Provisioning (IaC) | Real languages (TypeScript, Python, Go, C#) | Multi-cloud | State file (Pulumi Cloud or self-managed) | Teams who want loops/functions/tests in a language they already know |

### Under the Hood: Provisioning vs Configuration

This is the distinction that trips people up most: Terraform and Ansible are often described as
"competitors" but they usually work at different layers of the stack.

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PROVISIONING (does the server exist?)                │
│  Terraform / CloudFormation / Pulumi                             │
│  "Create a VPC, a subnet, and an EC2 instance"                   │
└───────────────────────────┬───────────────────────────────────────┘
                            │  instance now exists, but is a bare OS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2 — CONFIGURATION (what's installed and configured?)      │
│  Ansible / Chef / Puppet                                          │
│  "Install nginx, copy this config, start the service"             │
└─────────────────────────────────────────────────────────────────┘
```

Many real pipelines use **both**: Terraform provisions the EC2 instance, then hands off to
Ansible (or a Terraform `provisioner`, or user-data / cloud-init) to install and configure
software on it.

### Common Mistakes

- **"Terraform replaces Ansible"** — not quite. Terraform *can* run shell scripts via
  `provisioner "remote-exec"`, but that's discouraged as a primary configuration strategy —
  Terraform's provisioners are a last resort, not a design pattern. Use Ansible, cloud-init, or
  container images for configuration; use Terraform for provisioning.
- **"CloudFormation and Terraform do the same thing so it doesn't matter which you pick"** —
  CloudFormation locks you into AWS. If there's any chance of multi-cloud, or of using
  third-party SaaS providers (Datadog, GitHub, Cloudflare — all of which have Terraform
  providers), Terraform's provider ecosystem is a major advantage.
- **"Declarative languages can't have real logic, so Pulumi is strictly more powerful"** — Pulumi
  gives you loops and conditionals in a real language, which is powerful, but it also means your
  infrastructure code can have side effects, non-determinism, and bugs that a constrained DSL like
  HCL structurally prevents.

### Interview Answer

"Terraform and CloudFormation are both provisioning tools — they create and manage cloud
resources — while Ansible is a configuration management tool that installs and configures
software on servers that already exist. Terraform is cloud-agnostic with a huge provider
ecosystem; CloudFormation is AWS-native and tightly integrated but AWS-only. Pulumi occupies the
same niche as Terraform but lets you write infrastructure in general-purpose languages instead of
a domain-specific language. In practice, teams often use Terraform to provision servers and
Ansible (or cloud-init) to configure them afterward."

> **Memory hook:** Terraform builds the building. Ansible trains the staff who work inside it. CloudFormation only builds buildings for one landlord. Pulumi lets you write the blueprint in a language you already speak.

---

## 4. How Terraform Works

You've written a `.tf` file describing an S3 bucket. You run `terraform apply`. Thirty seconds
later, a real S3 bucket exists in your AWS account. What actually happened between those two
moments? Understanding this pipeline — core, providers, and state — is what separates people who
can copy-paste Terraform examples from people who can actually debug it when something goes
wrong.

### Analogy

Think of Terraform Core as a **universal remote control**, and providers as the **infrared
codes** for a specific brand of TV. The remote itself doesn't know how to talk to a Samsung TV or
an LG TV directly — it loads the right code set (provider) for the brand you're pointing at, and
that code set knows the actual signals (API calls) to send. The state file is the remote's memory
of which channel the TV is currently on, so it doesn't have to guess.

### Under the Hood

```
┌────────────────────────────────────────────────────────────────────┐
│                        YOUR .tf FILES                               │
│  provider "aws" { region = "us-east-1" }                            │
│  resource "aws_s3_bucket" "data" { bucket = "my-app-data" }          │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│                       TERRAFORM CORE                                 │
│  - Parses HCL into an internal graph of resources                   │
│  - Builds a dependency graph (what depends on what)                  │
│  - Walks the graph to plan creates/updates/deletes                   │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  calls out via plugin protocol (gRPC)
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│                    PROVIDER PLUGIN (e.g. aws)                       │
│  A separate binary, downloaded into .terraform/providers/            │
│  Translates "resource aws_s3_bucket" into actual AWS API calls:      │
│    CreateBucket, PutBucketPolicy, PutBucketVersioning, ...           │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  HTTPS API calls (signed w/ AWS creds)
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│                          AWS API                                     │
│                (the real S3 service, in a real region)               │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  API response (bucket ARN, etc.)
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│                   terraform.tfstate (JSON file)                     │
│  Terraform's record of what it believes exists right now:            │
│  { "aws_s3_bucket.data": { "id": "my-app-data", "arn": "arn:..." } } │
└────────────────────────────────────────────────────────────────────┘
```

The three pieces, in plain terms:

- **Terraform Core** — the engine. Reads your `.tf` files, builds a dependency graph (so it knows
  a subnet must exist before an instance placed in it), and figures out create/update/destroy
  operations. It is cloud-agnostic — it has no idea what "S3" is.
- **Providers** — plugins that translate generic Terraform resource blocks into specific API
  calls for a specific system: AWS, GCP, Azure, Kubernetes, Datadog, GitHub, and thousands more.
  This is *why* Terraform is multi-cloud: swap the provider block, keep writing similar HCL.
- **State** (`terraform.tfstate`) — a JSON file that is Terraform's memory of what it created and
  what its real-world IDs are (an S3 bucket's ARN, an instance's ID). Without state, Terraform
  would have no way to know an `aws_instance` resource in your file already corresponds to a real
  running instance — it would try to create a duplicate every time.

### Example

```hcl
# providers.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# main.tf
resource "aws_s3_bucket" "data" {
  bucket = "my-app-data-bucket-2026"

  tags = {
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

Running `terraform apply` on this file: Core parses it, sees one resource with no dependencies,
calls the `aws` provider plugin, which calls AWS's `CreateBucket` and `TagResource` APIs, then
Core writes the resulting bucket ARN into `terraform.tfstate`.

### Common Confusion

A very common misconception: "if I delete my `.tf` files, my infrastructure disappears." False —
your `.tf` files are just a description; deleting them does *nothing* to real infrastructure.
Conversely: "if I delete `terraform.tfstate`, Terraform will notice my infrastructure still
exists." Also false — deleting state makes Terraform forget everything it created, and it will
try to create duplicate resources (or error on naming conflicts) next time you run `apply`. State
is precious; treat it like a database, not a scratch file (this is why remote state backends with
locking exist — covered in a later phase).

### Interview Answer

"Terraform has three main parts. Terraform Core is the engine that parses your HCL configuration,
builds a dependency graph, and computes what needs to change. Providers are plugins — separate
binaries — that translate generic resource blocks into actual API calls for a specific system
like AWS or GCP; this plugin architecture is what makes Terraform multi-cloud. And the state file
is Terraform's record of what real-world resources correspond to which blocks in your
configuration, which is what allows it to compute a diff between desired and actual state instead
of blindly re-creating everything on every run."

> **Memory hook:** Terraform Core is the universal remote, providers are the brand-specific infrared codes, and the state file is the remote's memory of what channel the TV is already on.

---

## 5. Real-World Terraform Usage

Terraform isn't a toy — it's the de facto standard for cloud provisioning at companies ranging
from five-person startups to the largest tech companies in the world.

```
┌────────────────┬──────────────────────────────────────────────────────────┐
│ Company        │ Terraform Usage                                          │
├────────────────┼──────────────────────────────────────────────────────────┤
│ HashiCorp      │ Creator of Terraform; dogfoods it internally for all      │
│                │ HashiCorp Cloud Platform (HCP) infrastructure              │
├────────────────┼──────────────────────────────────────────────────────────┤
│ Slack          │ Manages thousands of AWS resources — VPCs, ECS services,  │
│                │ RDS — through Terraform modules with strict code review   │
├────────────────┼──────────────────────────────────────────────────────────┤
│ Uber           │ Multi-cloud provisioning across AWS and GCP for different │
│                │ services; heavy internal module library                   │
├────────────────┼──────────────────────────────────────────────────────────┤
│ GitHub         │ Uses Terraform to manage its own GitHub organization      │
│                │ settings, teams, and repo configs via the GitHub provider │
├────────────────┼──────────────────────────────────────────────────────────┤
│ Coinbase       │ Provisions and audits highly regulated financial          │
│                │ infrastructure with mandatory plan review before apply    │
├────────────────┼──────────────────────────────────────────────────────────┤
│ Starbucks      │ Manages global cloud infrastructure for its mobile        │
│                │ ordering and loyalty platform via Terraform + Atlantis    │
└────────────────┴──────────────────────────────────────────────────────────┘
```

### Common Patterns in Production

- **Modules**: shared, versioned Terraform packages (e.g., "standard VPC module") reused across
  dozens of teams so every team's network follows the same security baseline.
- **Remote state with locking**: state stored in S3 + DynamoDB (or Terraform Cloud) so multiple
  engineers can't corrupt state by applying simultaneously.
- **CI/CD-driven applies**: `terraform plan` runs automatically on every pull request (often via
  Atlantis or GitHub Actions); a human reviews the plan output before anyone runs `apply`.
- **Multi-account, multi-environment**: separate state per environment (dev/staging/prod), often
  per AWS account, using the same module code with different variable values.

> **Memory hook:** If Slack, Uber, and Coinbase trust Terraform to safely provision their production infrastructure with a paper trail, it's a solid bet you can trust it with yours.

---

## 6. Hands-On Exercises

You do not need Terraform installed yet to do exercises 1–3 (installation is covered in the next
lesson). Just read, reason, and write your answers.

**Exercise 1 — Spot the ClickOps Risk**
Describe two concrete problems that could occur at your (real or imagined) workplace if someone
manually changed a security group rule in the AWS Console instead of through Terraform. Be
specific about what would go wrong and when it would be discovered.

**Exercise 2 — Declarative Thinking**
You currently have 3 EC2 instances tagged `Name = "worker"`. Write the `count` value you'd change
in the HCL below to scale to 10, and describe — in plain English, no HCL — exactly what Terraform
will do when you run `apply` after that change (how many creates, how many destroys, if any).

```hcl
resource "aws_instance" "worker" {
  count         = 3
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
}
```

**Exercise 3 — Tool Selection**
For each scenario below, say whether you'd reach for Terraform, Ansible, or both, and justify it
in one sentence:
a) Provisioning a new VPC, subnets, and an RDS instance for a new microservice.
b) Installing a new version of nginx and updating its config on 200 already-running servers.
c) Standing up a brand-new EC2 fleet and then installing your company's monitoring agent on it.

**Exercise 4 — State File Reasoning**
Explain, in your own words, what would go wrong if you ran `terraform apply` on a fresh laptop
with the same `.tf` files as production, but without ever copying over the existing
`terraform.tfstate` file (or connecting to the remote state backend).

**Exercise 5 — Provider Research**
Go to the Terraform Registry (registry.terraform.io) and find three providers that are *not* one
of the big three clouds (AWS/GCP/Azure). Name them and one resource type each one manages.

---

## 7. Interview Q&A

---

**Q1: What is Infrastructure as Code?**

A: Infrastructure as Code is managing and provisioning infrastructure through machine-readable
configuration files rather than manual processes or interactive console clicks. Tools like
Terraform read these files and reconcile real cloud resources to match the described state,
which enables version control, code review, and reproducibility that manual "ClickOps"
provisioning cannot offer.

---

**Q2: What's the difference between declarative and imperative IaC?**

A: Declarative IaC describes the desired end state and lets the tool compute the steps to get
there (Terraform, CloudFormation). Imperative IaC is a sequence of explicit commands you write
yourself (a bash script calling the AWS CLI). Declarative tools track current state and compute a
diff; imperative scripts have no memory of what already exists unless you build that tracking
yourself.

---

**Q3: How is Terraform different from Ansible?**

A: Terraform is a provisioning tool — it creates and destroys infrastructure resources like VPCs,
EC2 instances, and databases. Ansible is a configuration management tool — it installs packages,
manages files, and configures software on servers that already exist. They operate at different
layers and are frequently used together: Terraform provisions the server, Ansible configures what
runs on it.

---

**Q4: How is Terraform different from CloudFormation?**

A: CloudFormation is AWS's native IaC service — it only manages AWS resources and its state is
managed entirely by AWS. Terraform is cloud-agnostic with providers for AWS, GCP, Azure, and
thousands of other systems (GitHub, Datadog, Cloudflare, Kubernetes), and its state is a file you
control (locally or in a remote backend). Terraform is the better choice when there's any chance
of multi-cloud or third-party SaaS provisioning needs.

---

**Q5: What are the three core building blocks of how Terraform works?**

A: Terraform Core (the engine that parses HCL, builds a dependency graph, and computes
create/update/destroy operations), providers (plugins that translate generic resource blocks
into actual API calls for a specific system like AWS), and the state file (Terraform's record of
what real resources correspond to which configuration blocks, enabling diffing between desired
and actual state).

---

**Q6: Why does Terraform need a state file at all — why can't it just query the cloud provider directly every time?**

A: Two reasons. First, performance — querying every possible resource type in an account on every
plan would be extremely slow at scale. Second, and more importantly, mapping — a resource block in
your HCL like `aws_instance.web` has no inherent connection to a specific real-world instance ID;
the state file is what links "this block in my code" to "this specific instance i-0abc123 in
AWS." Without that link, Terraform can't tell the difference between an instance it manages and
one that happens to look similar.

---

**Q7: What problem does Infrastructure as Code solve that manual provisioning doesn't?**

A: Configuration drift and lack of auditability. When infrastructure is built by hand, there's no
record of what was clicked, when, or by whom, so environments silently diverge over time and
disaster recovery becomes guesswork. IaC makes the configuration file the single source of truth,
version-controlled and reviewable, so infrastructure changes go through the same rigor as
application code changes.

---

**Q8: Is Terraform only for creating new infrastructure, or can it also manage existing infrastructure?**

A: Both. Terraform can create new resources from scratch, and it can also `import` existing,
manually-created resources into its state so they become managed going forward. This is a common
migration path for teams moving off ClickOps: they write HCL matching what already exists, import
it into state, and then all future changes go through Terraform.

---

**Q9: What is a Terraform provider?**

A: A provider is a plugin — a separate executable — that Terraform Core downloads and
communicates with over a gRPC-based plugin protocol. It knows how to translate generic
Terraform resource and data source blocks into the actual API calls for a specific system (AWS,
GCP, Kubernetes, GitHub, etc.). This plugin architecture is what makes Terraform Core itself
cloud-agnostic and lets the community publish thousands of providers for arbitrary systems.

---

**Q10: When would you NOT use Terraform?**

A: For pure configuration management of long-lived servers (installing packages, managing config
files, rolling restarts) a tool like Ansible is a better fit than Terraform's `provisioner`
blocks. For very simple, single-account, AWS-only shops with no interest in other tools,
CloudFormation avoids needing to manage a separate state backend. And for truly one-off,
throwaway resources, manual creation is sometimes pragmatically faster than writing HCL — though
that decision should be deliberate, not a habit.
