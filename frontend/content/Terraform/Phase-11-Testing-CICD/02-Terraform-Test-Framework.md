# 02 — Terraform Test Framework

## Table of Contents

1. [Why Automated Tests for Infrastructure Code](#1-why-automated-tests-for-infrastructure-code)
2. [The Native terraform test Framework](#2-the-native-terraform-test-framework)
3. [A Full Example Test File for a Module](#3-a-full-example-test-file-for-a-module)
4. [Terratest as an Alternative](#4-terratest-as-an-alternative)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Automated Tests for Infrastructure Code

You maintain a shared Terraform module that provisions an S3 bucket for every team in the
company — forty teams, forty callers. Someone adds a new "compliance" requirement: every bucket
must have versioning enabled and public access blocked. They edit the module, refactor a variable
name while they're in there, and open a PR. It looks correct. It merges. Three weeks later, a
team in a completely different part of the org runs `terraform plan` and discovers their bucket
is about to lose an unrelated lifecycle rule, because the refactor silently changed a default
value nobody caught in review — forty callers, and nobody manually re-plans all forty on every
module change.

This is exactly the class of problem unit and integration tests solve in application code, and
it applies just as directly to infrastructure code: a module is a reusable unit of logic, its
behavior can regress just like a function's can, and "read the diff carefully" does not scale
once a module has more than a couple of callers. The historical excuse for skipping this in
Terraform was that there was no first-party way to write a test without actually provisioning
real cloud resources — expensive, slow, and requiring real credentials just to run a CI check.
That excuse mostly disappeared with the native `terraform test` framework (stable since
Terraform 1.6, 2023), which can validate module behavior using mocked providers with zero real
infrastructure created.

### Analogy

A Terraform module is like a recipe shared across forty restaurant kitchens. If the recipe author
changes "add 1 tsp salt" to "add 1 tbsp salt" while cleaning up formatting, every kitchen using
that recipe now makes an inedible dish — and nobody finds out until a customer complains. A test
suite is the head chef tasting a batch made strictly from the written recipe *before* it's sent
out to all forty locations, catching the regression at the source instead of at every customer's
table.

### What Changes With Tests in the Loop

```
WITHOUT TESTS                              WITH TESTS
──────────────                             ──────────

Module change                              Module change
     │                                          │
     ▼                                          ▼
Merge based on code review alone           terraform test runs in CI
     │                                          │
     ▼                                          ▼
40 callers re-plan independently           Assertions fail immediately if
(or don't, until next apply)               behavior regressed — BEFORE merge
     │                                          │
     ▼                                          ▼
Regression discovered in production        Regression caught in PR, fixed
plan, possibly mid-incident                 before any caller is affected
```

### Common Confusion

People sometimes assume "testing infrastructure" necessarily means spinning up real cloud
resources, running assertions, then tearing them down — which is slow (minutes per run),
expensive (real API calls, sometimes real billing), and flaky (subject to provider rate limits
and eventual consistency). That style of test — integration testing against a real provider —
does still have its place (Terratest is built around it), but it is not the only option, and for
most logic-level regressions a mocked, no-real-resources test is both faster and sufficient.

### Interview Answer

"Terraform modules are reusable, and reusable code can regress in ways that are invisible from a
code review alone — a variable rename or default-value change can silently alter behavior for
every caller of the module. Automated tests let you assert on a module's planned output
deterministically in CI, without needing real cloud credentials or provisioning real
infrastructure, catching regressions at the point of the change rather than at each caller's
next apply. This matters most for shared modules with many consumers, where the blast radius of
an unnoticed regression is large."

> **Memory hook:** A shared module is a recipe used by forty kitchens — taste it before it ships, not after the complaints come in.

---

## 2. The Native terraform test Framework

Terraform 1.6 (October 2023) shipped `terraform test` as a first-class, built-in testing
framework — no third-party binary, no separate language, just `.tftest.hcl` files sitting next to
your module. It runs `run` blocks in sequence, each one performing a `plan` or `apply` and then
checking `assert` conditions against the result.

### File Layout Convention

```
my-module/
├── main.tf
├── variables.tf
├── outputs.tf
└── tests/
    ├── defaults.tftest.hcl
    └── validation.tftest.hcl
```

### Anatomy of a .tftest.hcl File

```hcl
# tests/defaults.tftest.hcl

variables {
  bucket_name = "test-bucket-unit"
  environment = "dev"
}

run "plan_creates_bucket_with_defaults" {
  command = plan

  assert {
    condition     = aws_s3_bucket.this.bucket == "test-bucket-unit"
    error_message = "Bucket name did not match the input variable."
  }

  assert {
    condition     = aws_s3_bucket_versioning.this.versioning_configuration[0].status == "Enabled"
    error_message = "Versioning must be enabled by default."
  }
}
```

### Key Building Blocks

| Block | Purpose |
|-------|---------|
| `variables {}` (file-level) | Default input variables for every `run` block in the file, unless overridden |
| `run "<name>" {}` | One test case — executes a plan or apply against the module |
| `command = plan` | Fast, no real resources created — only computes the plan |
| `command = apply` | Actually provisions resources (against real or mocked provider) then destroys them at file end |
| `assert {}` | One condition per assertion, evaluated against planned/applied values |
| `variables {}` (inside `run`) | Override file-level variables for this specific test case |
| `expect_failures = [...]` | Assert that specific validation/precondition failures *should* occur |
| `providers = {}` | Wire in mock or aliased provider configurations |

### `plan` vs `apply` Command in Tests

```
run "plan" command:
┌────────────────────────────────────────────────────┐
│  Terraform computes a plan against the module       │
│  No API calls that create/modify real resources     │
│  Assertions run against PLANNED values               │
│  Fast — milliseconds to seconds                      │
└────────────────────────────────────────────────────┘

run "apply" command:
┌────────────────────────────────────────────────────┐
│  Terraform actually applies the module              │
│  Real API calls happen (or mock provider responses) │
│  Assertions run against APPLIED (real) values        │
│  Resources are destroyed automatically at end of     │
│  the .tftest.hcl file's execution                    │
│  Slower — real create/destroy round trip             │
└────────────────────────────────────────────────────┘
```

### Mocking Providers

Since Terraform 1.7, `mock_provider` blocks let you run `apply`-style tests without touching a
real cloud account at all — the provider returns synthetic values instead of making API calls.

```hcl
mock_provider "aws" {
  mock_resource "aws_s3_bucket" {
    defaults = {
      arn = "arn:aws:s3:::mock-bucket"
      id  = "mock-bucket"
    }
  }
}

run "apply_with_mocked_aws" {
  command = apply
  providers = {
    aws = aws
  }
  # No real S3 bucket is ever created — the mock provider
  # returns the "defaults" values for any aws_s3_bucket resource.
}
```

### Analogy

If a `run` block with `command = plan` is a dress rehearsal (you check the blocking and the
lines, nobody's actually performing for a paying audience), a `run` block with `command = apply`
against a mocked provider is a full technical rehearsal with all the lighting and sound cues
firing — but still with no audience in the seats and no real box-office risk. A real `apply`
against a live AWS account, without mocks, is opening night.

### Common Mistakes

- **Only ever using `command = plan`.** Plan-only tests can't catch bugs that only manifest when
  a real (or mocked) apply resolves computed values — e.g., an output that depends on an
  attribute only known after apply.
- **Running `command = apply` tests against a real account without mocks in every CI run.**
  This costs money, is slow, and can hit provider rate limits on every PR. Reserve real-apply
  tests for a smaller, slower "integration" test suite run less frequently (e.g., nightly),
  and use mocks for the fast PR-blocking suite.
- **Forgetting that later `run` blocks in the same file share state with earlier ones.** By
  default, `run` blocks in one file execute against a shared, accumulating state — a later block
  can reference resources created by an earlier `apply` block. Not resetting this intentionally
  between unrelated test cases can cause tests to pass or fail based on execution order.
- **Not cleaning up.** Terraform automatically destroys resources created by `apply`-command
  `run` blocks at the end of the test file, but only if the test file completes — a crashed test
  runner mid-suite can leave orphaned real resources if mocks weren't used.

### Interview Answer

"`terraform test` is HashiCorp's native testing framework, using `.tftest.hcl` files with `run`
blocks that execute either a `plan` or an `apply` against the module and then check `assert`
conditions against the resulting values. `command = plan` is fast and makes no real API calls,
so it's ideal for the majority of PR-blocking tests. `command = apply` actually provisions
resources — which you'd typically pair with `mock_provider` blocks, introduced in Terraform 1.7,
so you get apply-time behavior verification without touching a real cloud account or paying for
real infrastructure on every test run."

> **Memory hook:** `plan` command is the dress rehearsal, `apply` with mocks is the full tech rehearsal — neither one needs a paying audience.

---

## 3. A Full Example Test File for a Module

Here's a complete, realistic module and its accompanying test suite — an S3 bucket module used
across many teams, with the kind of compliance requirements (versioning, public access block)
that make regressions expensive if they slip through unnoticed.

### The Module

```hcl
# modules/secure-bucket/variables.tf
variable "bucket_name" {
  type = string
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, staging, prod."
  }
}

variable "enable_versioning" {
  type    = bool
  default = true
}
```

```hcl
# modules/secure-bucket/main.tf
resource "aws_s3_bucket" "this" {
  bucket = var.bucket_name

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

```hcl
# modules/secure-bucket/outputs.tf
output "bucket_arn" {
  value = aws_s3_bucket.this.arn
}

output "bucket_id" {
  value = aws_s3_bucket.this.id
}
```

### The Test File

```hcl
# modules/secure-bucket/tests/secure_bucket.tftest.hcl

variables {
  bucket_name = "acme-test-bucket"
  environment = "dev"
}

# --- Test 1: Defaults produce a compliant bucket ---
run "defaults_are_compliant" {
  command = plan

  assert {
    condition     = aws_s3_bucket.this.bucket == "acme-test-bucket"
    error_message = "Bucket name must match the bucket_name variable exactly."
  }

  assert {
    condition     = aws_s3_bucket_versioning.this.versioning_configuration[0].status == "Enabled"
    error_message = "Versioning must default to Enabled."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.this.block_public_acls == true
    error_message = "Public ACLs must be blocked by default for every bucket this module creates."
  }
}

# --- Test 2: Versioning can be explicitly disabled ---
run "versioning_can_be_disabled" {
  command = plan

  variables {
    enable_versioning = false
  }

  assert {
    condition     = aws_s3_bucket_versioning.this.versioning_configuration[0].status == "Suspended"
    error_message = "Setting enable_versioning = false should suspend versioning."
  }
}

# --- Test 3: Invalid environment value is rejected ---
run "rejects_invalid_environment" {
  command = plan

  variables {
    environment = "sandbox"   # not in the allowed list
  }

  expect_failures = [
    var.environment,
  ]
}

# --- Test 4: Public access block is NEVER optional, even if someone tries ---
run "public_access_block_cannot_be_bypassed" {
  command = plan

  assert {
    condition     = aws_s3_bucket_public_access_block.this.restrict_public_buckets == true
    error_message = "restrict_public_buckets must always be true — there is no variable to disable this."
  }
}
```

### Running the Suite

```bash
$ terraform test
tests/secure_bucket.tftest.hcl... in progress
  run "defaults_are_compliant"... pass
  run "versioning_can_be_disabled"... pass
  run "rejects_invalid_environment"... pass
  run "public_access_block_cannot_be_bypassed"... pass
tests/secure_bucket.tftest.hcl... tearing down
tests/secure_bucket.tftest.hcl... pass

Success! 4 passed, 0 failed.
```

If a teammate later tries to "simplify" the module by making `restrict_public_buckets`
conditional on a new variable defaulting to `false`, Test 4 fails immediately in CI, before the
PR can merge — exactly the class of silent regression described in Section 1.

### Analogy

This test file is the head chef's tasting checklist: not just "does it taste okay" (Test 1), but
"does turning off one ingredient behave as documented" (Test 2), "does the kitchen refuse an
order that violates health code" (Test 3), and "is there truly no way to skip the mandatory
allergen warning" (Test 4) — specific, falsifiable checks, not a vague vibe check.

### Common Mistakes

- **Writing only "happy path" tests.** Test 1 alone would miss the regression Test 4 catches —
  always test the constraints that must hold no matter what a caller passes in, not just the
  default behavior.
- **Testing implementation details instead of the public contract.** Asserting on outputs and
  observable resource attributes (what callers actually depend on) is more durable than asserting
  on internal resource names, which can change during refactors without being a real regression.
- **One giant test file with no logical grouping.** Splitting into `defaults.tftest.hcl`,
  `validation.tftest.hcl`, and `security.tftest.hcl` keeps failures easier to triage at a glance.

### Interview Answer

"A good module test suite asserts on the module's public contract — inputs and outputs and the
invariants that must hold regardless of what a caller passes — not on internal implementation
details. In the S3 module example, the critical test isn't that versioning defaults to enabled;
it's that `restrict_public_buckets` is `true` unconditionally, with no variable exposed to turn
it off, because that's the compliance guarantee every one of the module's forty callers is
relying on. Writing that as an explicit `assert` means a refactor that accidentally reintroduces
a bypass fails the build immediately, instead of shipping silently to every consumer."

> **Memory hook:** Test the invariant nobody's allowed to break, not just the default that looks nice in the demo.

---

## 4. Terratest as an Alternative

Native `terraform test` covers a huge amount of ground, but it has real limits: it can't easily
assert against actual runtime behavior of the infrastructure it creates — like "can I actually
SSH into this instance," "does this ALB return a 200 on `/health`," or "is this Lambda function
callable and does it return the expected payload." For that class of true end-to-end
verification, teams reach for **Terratest**, a Go testing library maintained by Gruntwork that
drives `terraform apply`/`destroy` and then makes real assertions against the live, running
infrastructure using arbitrary Go code — HTTP calls, SSH commands, cloud SDK calls, anything Go
can do.

### Example Terratest File

```go
// test/s3_bucket_test.go
package test

import (
	"testing"

	"github.com/gruntwork-io/terratest/modules/aws"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
)

func TestSecureBucketModule(t *testing.T) {
	t.Parallel()

	terraformOptions := &terraform.Options{
		TerraformDir: "../modules/secure-bucket",
		Vars: map[string]interface{}{
			"bucket_name": "terratest-real-bucket-12345",
			"environment": "dev",
		},
	}

	// Ensure `terraform destroy` runs at the end of the test, even on failure
	defer terraform.Destroy(t, terraformOptions)

	// terraform init && terraform apply -auto-approve
	terraform.InitAndApply(t, terraformOptions)

	bucketID := terraform.Output(t, terraformOptions, "bucket_id")

	// Real AWS SDK call against the REAL bucket that was just created
	actualStatus := aws.GetS3BucketVersioning(t, "us-east-1", bucketID)
	assert.Equal(t, "Enabled", actualStatus, "Bucket versioning should be enabled")

	// Confirm the bucket actually blocks public access via a live API call
	publicAccessBlocked := aws.GetS3BucketPublicAccessBlock(t, "us-east-1", bucketID)
	assert.True(t, publicAccessBlocked.BlockPublicAcls)
}
```

```bash
cd test
go test -v -timeout 30m -run TestSecureBucketModule
```

### Comparison Table

| Dimension | Native `terraform test` | Terratest |
|-----------|-------------------------|-----------|
| **Language** | HCL (`.tftest.hcl`) — same language as the module | Go — separate language, separate toolchain |
| **Setup cost** | Zero — built into the `terraform` binary | Requires Go toolchain, `go.mod`, dependency management |
| **Speed (plan-only)** | Milliseconds to seconds | N/A — Terratest is apply-based by design |
| **Speed (apply-based)** | Seconds with `mock_provider`; real time with real apply | Always real apply/destroy — minutes per test |
| **Can assert on live runtime behavior** (HTTP calls, SSH, live API queries) | No — only on Terraform-known attributes | Yes — arbitrary Go code, any assertion imaginable |
| **Mocking without real infra** | Yes (`mock_provider`, since 1.7) | No — always creates real resources |
| **Best for** | Fast, PR-blocking unit-style checks on module logic and constraints | Slower, thorough end-to-end integration tests validating actual deployed behavior |
| **Maintainer** | HashiCorp (first-party) | Gruntwork (third-party, widely adopted) |
| **Typical pipeline placement** | Every PR, fast feedback | Nightly / pre-release / merge-to-main only, due to cost and time |

### Analogy

Native `terraform test` is the head chef tasting the sauce in the kitchen before it goes out.
Terratest is a mystery diner who actually sits at a real table, orders the real dish from the
real menu, eats it, and reports back whether it was actually good — much more convincing, much
slower and more expensive to run for every single recipe tweak.

### Common Confusion

Teams sometimes think they must pick one framework exclusively. In practice, mature Terraform
codebases run both: native `terraform test` with mocked or plan-only checks on every single PR
for fast feedback on module contracts, and a smaller Terratest suite that runs real applies —
often gated to nightly runs or merges to `main` — to catch the class of bug that only appears
once real infrastructure is actually running.

### Interview Answer

"Native `terraform test` is fast, requires no extra toolchain, and — with mock providers — needs
no real cloud resources at all, which makes it ideal for PR-blocking checks on a module's logic
and invariants. Terratest is a Go library that actually applies real infrastructure and then
asserts against its live runtime behavior — an HTTP health check, an SSH command, a real API
response — which native `terraform test` simply cannot do, since it only has visibility into
Terraform-known plan and apply values. The trade-off is speed and cost: Terratest runs take
minutes per test because they provision real resources, so most teams reserve it for a slower
integration suite rather than running it on every PR."

> **Memory hook:** Native tests taste the sauce in the kitchen; Terratest sends a mystery diner to eat the real dish at a real table.

---

## 5. Common Mistakes

- **No tests at all on shared, widely-consumed modules.** The more callers a module has, the
  higher the payoff of a test suite — this is exactly backwards from how most teams prioritize,
  since they tend to test the "interesting" one-off configurations instead.
- **Writing tests that only check for `command = plan` "did not error."** A plan that succeeds
  without erroring is not the same as a plan that produced the *correct* resources — always
  assert on specific attribute values, not just successful execution.
- **Running real-apply tests (native `apply` command or Terratest) on every single commit in a
  fast-moving PR loop.** This is slow and costly; reserve real-apply suites for merge-to-main or
  nightly schedules, and use mocks/plan-only for the fast inner loop.
- **Not tearing down Terratest resources on failure.** Forgetting `defer terraform.Destroy(...)`
  (or placing it after code that can panic before it runs) leaves orphaned billable resources
  behind when an assertion fails partway through.
- **Testing provider behavior instead of your module's logic.** A test that just re-verifies
  "AWS creates an S3 bucket when you tell it to" adds no value — test the logic your module adds
  on top (defaults, validation rules, computed values), not the cloud provider's own behavior.

---

## 6. Hands-On Exercises

**Exercise 1 — Write Your First .tftest.hcl**
Take the `secure-bucket` module from Section 3 and write a new test case,
`run "tags_include_environment"`, asserting that `aws_s3_bucket.this.tags["Environment"]` equals
the `environment` variable passed in.

**Exercise 2 — Test a Validation Rule**
Add a `variable "bucket_name"` validation block requiring the name to be lowercase and between 3
and 63 characters. Write a test with `expect_failures` that confirms an uppercase name is
rejected.

**Exercise 3 — Mock a Provider**
Add a `mock_provider "aws"` block to the test file and convert one `command = plan` test case to
`command = apply`, confirming it passes without any real AWS credentials configured.

**Exercise 4 — Write a Terratest File**
Using the Go example in Section 4 as a template, write a Terratest test for a different module
(e.g., a VPC module) that applies it, reads a real output, and makes one live AWS SDK assertion.
Run it locally with `go test -v` (requires real AWS credentials and will incur minimal cost).

**Exercise 5 — Decide: Native Test or Terratest?**
For each of the following checks, decide whether native `terraform test` or Terratest is the
right tool, and justify why:
  a) "The module rejects an environment value outside dev/staging/prod."
  b) "The deployed load balancer actually returns HTTP 200 on `/health`."
  c) "Versioning is enabled on the bucket resource in the plan."
  d) "An IAM role created by the module can actually assume itself when tested from a Lambda."

**Exercise 6 — CI Integration**
Add a step to a GitHub Actions workflow that runs `terraform test` on every pull request touching
a `modules/**` path, and confirm the workflow fails the PR check when an assertion is broken
intentionally.

---

## 7. Interview Q&A

---

**Q1: What is `terraform test` and when was it introduced?**

A: `terraform test` is HashiCorp's native, first-party testing framework for Terraform modules,
using `.tftest.hcl` files. It became stable in Terraform 1.6 (October 2023). It defines `run`
blocks that execute a `plan` or `apply` against the module and then evaluate `assert` conditions
against the resulting values, without requiring any third-party tooling.

---

**Q2: What's the difference between `command = plan` and `command = apply` in a `run` block?**

A: `command = plan` only computes a Terraform plan — no real resources are created, and
assertions run against planned (sometimes not-yet-known) values. `command = apply` actually
provisions resources (against a real or mocked provider), asserts against the real applied
values, and then Terraform automatically destroys those resources at the end of the test file.
`plan` is faster and free; `apply` can validate behavior that's only resolvable post-creation but
costs real time and, without mocks, real money.

---

**Q3: What does `mock_provider` do and why does it matter?**

A: Introduced in Terraform 1.7, `mock_provider` lets a test use `command = apply` while the
provider returns synthetic, developer-defined values instead of making real cloud API calls. This
means you get apply-time behavior verification — testing things that only resolve after a
resource is "created" — without needing real credentials, without cost, and without the slowness
of real provisioning.

---

**Q4: Why would you choose Terratest over native `terraform test`?**

A: Terratest can assert against the actual runtime behavior of real, deployed infrastructure —
making a live HTTP request to a load balancer, SSHing into an instance, calling a cloud SDK
against resources that actually exist. Native `terraform test` only has visibility into
Terraform's own plan/apply values; it cannot verify that a deployed service is actually
responding correctly. Terratest is the right tool when the thing you need to verify is "does the
real infrastructure actually work," not just "did Terraform compute the configuration correctly."

---

**Q5: What are the downsides of Terratest compared to native tests?**

A: Terratest requires a separate Go toolchain and dependency management, always provisions real
infrastructure (no equivalent to `mock_provider`), and is consequently much slower — minutes per
test rather than seconds — and can incur real cloud cost. It's typically reserved for a slower
integration suite (nightly, pre-release, or merge-to-main) rather than run on every PR.

---

**Q6: If you maintain a widely-shared Terraform module, what's the highest-value test to write
first?**

A: A test asserting on the invariants that must hold regardless of caller input — for example, a
security control that has no variable exposing a way to disable it. These "cannot be bypassed"
assertions catch the most expensive class of regression: a refactor that silently reintroduces a
compliance or security gap across every consumer of the module, which is exactly the kind of bug
a manual code review is most likely to miss.

---

**Q7: Can native `terraform test` run tests that don't touch any real cloud provider at all?**

A: Yes — `command = plan` tests never make provider API calls at all (they only need provider
schema information from `terraform init`), and `command = apply` tests can avoid real API calls
entirely by using `mock_provider` blocks introduced in Terraform 1.7, which return synthetic
values in place of real cloud responses.
