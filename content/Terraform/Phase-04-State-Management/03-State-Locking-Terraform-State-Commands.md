# 03 — State Locking & Terraform State Commands

## Table of Contents

1. [Why State Locking](#1-why-state-locking)
2. [How DynamoDB Locking Works](#2-how-dynamodb-locking-works)
3. [Key `terraform state` Subcommands](#3-key-terraform-state-subcommands)
4. [`terraform import` Walkthrough](#4-terraform-import-walkthrough)
5. [Force-Unlock](#5-force-unlock)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Why State Locking

Imagine two engineers, both convinced they're "just doing a quick apply," kick off `terraform
apply` on the same production config within seconds of each other. Both read the same starting
state (`serial=40`). Both compute their own plan. Both start applying. Whichever one's `apply`
finishes writing state *last* wins — and it overwrites the other's changes in the state file
entirely, even though both sets of real-world API calls actually executed against AWS. Now your
state file no longer reflects everything that's really been created or changed. This is exactly
the failure mode **state locking** exists to prevent: it turns "two people racing to write the
same file" into "the second person gets a clear error and simply waits or retries," instead of a
silent, hard-to-detect corruption.

### Analogy

State locking is the "occupied" sign on an airplane bathroom. Multiple passengers might want to
use it at once, but the door mechanism physically only allows one person in at a time and shows a
clear, unambiguous signal to everyone else: wait. Without that sign (i.e., without locking),
you'd get two passengers trying to open the same door simultaneously — a mess, and potentially
unsafe, for everyone.

### Under the Hood

```
Time ───────────────────────────────────────────────────────────►

Engineer A:  terraform apply
             ├─ acquire lock ─────────────┐
             │                            │ (holds lock)
             ├─ read state (serial=40)    │
             ├─ compute plan               │
             ├─ apply changes to AWS       │
             ├─ write new state (serial=41)│
             └─ release lock ──────────────┘

Engineer B:  terraform apply (starts 2 seconds after A)
             ├─ attempt to acquire lock ──► DENIED (A holds it)
             └─ ERROR: "Error acquiring the state lock" — STOPS HERE,
                never reads, plans, or applies against the shared state

             (B can safely retry once A's apply finishes and releases
              the lock — B will then read the FRESH serial=41 state)
```

Without locking, both A and B would proceed past "acquire lock" simultaneously, both computing
plans against the *same stale* `serial=40` state, both applying real changes to AWS, and both
racing to write state afterward — with the loser's real changes never getting recorded anywhere.

### Example

```bash
$ terraform apply

Acquiring state lock. This may take a few moments...
```

If someone else already holds the lock:

```
Error: Error acquiring the state lock

Error message: ConditionalCheckFailedException: The conditional request failed
Lock Info:
  ID:        8f3a1c2d-6b21-4e77-9a13-2b6f5e9d1a90
  Path:      my-org-tfstate/prod/network/terraform.tfstate
  Operation: OperationTypeApply
  Who:       raj@platform-team
  Version:   1.7.5
  Created:   2026-07-20 10:03:12.443921 UTC
  Info:

Terraform acquires a state lock to protect the state from being written
by multiple users at the same time. Please resolve the issue above and try
again.
```

### Comparison Table

| Scenario | Without Locking | With Locking |
|----------|-------------------|-----------------|
| Two concurrent `apply` runs | Both proceed; last write silently wins, first apply's real changes may be lost from state | Second run errors out immediately with a clear message; first run completes safely |
| CI pipeline + a manual `apply` at the same time | Race condition, unpredictable outcome | Whichever acquires the lock first proceeds; the other retries later |
| Long-running `apply` (e.g., waiting on an RDS instance) | Someone else could start a conflicting apply mid-wait | Lock is held for the ENTIRE operation, not just the write, so nobody else can start until it finishes or fails |

### Common Confusion

People sometimes assume the lock only protects the final "write state to disk" step. It actually
protects the *entire* operation, start to finish — from the moment `apply` begins reading state,
through planning, through every real API call, until the final state write and lock release. This
matters because a plan can be stale by the time apply finishes (e.g., an RDS instance taking 10
minutes to provision) — the lock ensures nobody else's Terraform can jump in and start a
conflicting operation during that window.

### Interview Answer

"State locking prevents two Terraform operations from reading, modifying, and writing the same
state file concurrently. Without it, two people (or a person and a CI job) applying at the same
time could both compute plans against the same stale state, both make real changes to
infrastructure, and then race to write state afterward — with whichever write happens last
silently discarding the other's recorded changes, even though both sets of real infrastructure
changes actually happened. With locking, the backend acquires an exclusive lock for the entire
duration of the operation; if another Terraform process tries to acquire the same lock, it fails
fast with a clear 'lock held by X since Y' error instead of racing."

> **Memory hook:** State locking is the occupied sign on the airplane bathroom door — it turns a physical collision into a clear, safe "please wait."

---

## 2. How DynamoDB Locking Works

You know locking exists conceptually — but *mechanically*, how does a DynamoDB table stop two
Terraform processes from writing at once? There's no traditional "mutex" object in DynamoDB.
Instead, Terraform leans on one specific DynamoDB feature: **conditional writes**, which let you
say "only write this item if it does NOT already exist."

### Analogy

Think of the DynamoDB table as a coat-check counter with exactly one hook per state file, labeled
with that file's unique ID. To "lock," you try to hang your ticket on that hook — but only if
it's empty. If it's already occupied by someone else's ticket, your hang attempt fails outright;
you don't get to force your ticket on top of theirs. When you're done, you take your ticket back
off the hook, freeing it for the next person.

### Under the Hood

```
DynamoDB table "terraform-locks"  (hash key: LockID)

  ┌────────────────────────────────────────────────────────────┐
  │ LockID (primary key)              │ Info (JSON)              │
  ├────────────────────────────────────┼───────────────────────────┤
  │ my-org-tfstate/prod/network/...    │ {ID, Operation, Who,      │
  │  terraform.tfstate                 │  Version, Created, Path}  │
  └────────────────────────────────────┴───────────────────────────┘

STEP 1 — Acquire (Terraform issues a conditional PutItem):

  PutItem(
    TableName = "terraform-locks",
    Item = { LockID: "<bucket>/<key>", Info: {...} },
    ConditionExpression = "attribute_not_exists(LockID)"
  )

  ├─ If NO existing item with that LockID  → PutItem SUCCEEDS → lock acquired
  └─ If an item ALREADY exists             → ConditionalCheckFailedException
                                              → Terraform reports "Error
                                                acquiring the state lock"
                                                and reads the existing item's
                                                Info to tell you WHO holds it

STEP 2 — Hold: Terraform proceeds through read/plan/apply/write-state
          while this DynamoDB item still exists.

STEP 3 — Release (Terraform issues a DeleteItem for that LockID)

  DeleteItem(TableName = "terraform-locks", Key = { LockID: "<bucket>/<key>" })

  └─ Lock item removed → next Terraform process's PutItem will succeed
```

The `LockID` value is deterministic — it's derived from the backend's bucket and key (e.g.,
`my-org-tfstate/prod/network/terraform.tfstate`). This is exactly why two different projects using
distinct `key` values never contend for the same lock, even sharing one DynamoDB table: each gets
its own row.

### Example — Watching a Lock Live

```bash
# Terminal 1: start an apply and pause at the confirmation prompt
$ terraform apply
...
Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value: _
```

```bash
# Terminal 2: inspect the DynamoDB table directly while Terminal 1 is paused
$ aws dynamodb get-item \
    --table-name terraform-locks \
    --key '{"LockID": {"S": "my-org-tfstate/prod/network/terraform.tfstate"}}'

{
    "Item": {
        "LockID": {"S": "my-org-tfstate/prod/network/terraform.tfstate"},
        "Info": {"S": "{\"ID\":\"8f3a1c2d-...\",\"Operation\":\"OperationTypeApply\",\"Who\":\"priya@platform-team\",\"Version\":\"1.7.5\",\"Created\":\"2026-07-20T10:03:12Z\"}"}
    }
}
```

```bash
# Terminal 2: try your own apply while the lock item exists
$ terraform apply
Error: Error acquiring the state lock
  Lock Info:
    Who: priya@platform-team
    ...
```

### Comparison: DynamoDB Conditional Write vs a "Naive" Lock Flag

| Approach | Race-Safe? | Why |
|----------|------------|------|
| A naive "check if locked, then write lock" (two separate operations) | No | Between the check and the write, another process could slip in — classic time-of-check/time-of-use race |
| DynamoDB conditional `PutItem` with `attribute_not_exists` | Yes | The check-and-write happen as a single atomic operation at the database layer — DynamoDB itself guarantees no other write can interleave |

### Common Mistakes

- **Assuming the DynamoDB table needs a complex schema.** It needs exactly one attribute as the
  hash key: `LockID` (type String). Nothing else is required for Terraform's use of it.
- **Manually deleting a lock item "just to unblock myself."** This bypasses Terraform's own
  bookkeeping and safety checks — always prefer `terraform force-unlock <LOCK_ID>` (Section 5),
  which at least requires you to explicitly confirm the specific lock ID you intend to break.
- **Not granting `dynamodb:DescribeTable` to the CI role.** Terraform checks the table's schema on
  init/first use; missing this specific permission produces a confusing "table not found"-style
  error even when the table exists and other permissions are correct.

### Interview Answer

"Terraform's DynamoDB locking relies on DynamoDB's conditional write support. To acquire a lock,
Terraform issues a `PutItem` with a condition expression `attribute_not_exists(LockID)` — this
succeeds only if no item with that key currently exists, and DynamoDB guarantees this check-and-
write happens atomically, so two concurrent `PutItem` calls can never both succeed for the same
key. The `LockID` is derived from the backend's bucket and state key, so different projects
sharing one lock table never collide. Releasing the lock is a simple `DeleteItem` once the
operation completes, whether it succeeds or fails."

> **Memory hook:** DynamoDB locking is a coat-check hook that can only ever hold one ticket — hanging your ticket (conditional PutItem) fails outright if the hook's already occupied, no race condition possible.

---

## 3. Key `terraform state` Subcommands

Sooner or later you'll need to *change* what's recorded in state without changing real
infrastructure at all — renaming a resource in your `.tf` file, splitting a module, or removing a
resource from Terraform's management without destroying it. Hand-editing the JSON is explicitly
off-limits (lesson 01, Section 2). Instead, Terraform gives you a small, safe toolkit:
`terraform state <subcommand>`.

### Analogy

`terraform state` subcommands are the warehouse manager's official forms for updating the
inventory spreadsheet — a "relabel this bin" form (`mv`), a "this item left the building, remove
it from our books, but leave it on the shelf" form (`rm`), a "print the current sheet" form
(`pull`), a "replace the sheet with this one" form (`push`), and so on. You never grab a pen and
scribble directly into the ledger.

### Under the Hood — Subcommand Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         terraform state <cmd>                        │
├───────────┬───────────────────────────────────────────────────────────┤
│  list      │  Print resource addresses currently tracked in state       │
│  show      │  Print full attributes for ONE resource address             │
│  mv        │  Rename/move a resource's address WITHIN state (no infra    │
│            │  change) — e.g., after renaming a resource block             │
│  rm        │  Remove a resource from state WITHOUT destroying real       │
│            │  infra — Terraform "forgets" it, infra keeps existing        │
│  pull      │  Download and print the current remote state as raw JSON    │
│  push      │  Upload a local state file to overwrite the remote one      │
│            │  (rare, dangerous — mostly for recovery scenarios)           │
└───────────┴───────────────────────────────────────────────────────────┘
```

### Example — `list` and `show`

```bash
$ terraform state list
aws_instance.web
aws_security_group.web_sg
module.vpc.aws_vpc.main

$ terraform state show aws_instance.web
# aws_instance.web:
resource "aws_instance" "web" {
    ami                    = "ami-0c101f26f147fa7fd"
    id                     = "i-0abc123def456"
    instance_type          = "t3.micro"
    private_ip             = "10.0.1.23"
    public_ip              = "54.203.10.44"
    tags                   = {
        "Name" = "web-server"
    }
    # ... (many more computed attributes)
}
```

### Example — `mv` (Renaming Without Destroying)

You renamed `aws_instance.web` to `aws_instance.app_server` in your `.tf` file. Without `mv`,
Terraform would see "no resource named `aws_instance.web` in config anymore → destroy it" and
"a brand-new `aws_instance.app_server` in config → create it" — a destructive, unnecessary
recreate. `mv` fixes the state's address without touching real infrastructure at all:

```bash
$ terraform state mv aws_instance.web aws_instance.app_server

Move "aws_instance.web" to "aws_instance.app_server"
Successfully moved 1 object(s).

$ terraform plan
# No changes. Your infrastructure matches the configuration.
```

`mv` also works for moving a resource into or out of a module:

```bash
$ terraform state mv aws_instance.web module.compute.aws_instance.web
```

### Example — `rm` (Forgetting Without Destroying)

Say you're splitting one giant Terraform config into two smaller ones, and `aws_s3_bucket.logs`
needs to move to the *other* config's management. You don't want to destroy the bucket — you want
THIS config to stop tracking it, so you can `import` it into the other config afterward:

```bash
$ terraform state rm aws_s3_bucket.logs

Removed aws_s3_bucket.logs
Successfully removed 1 resource instance(s).

$ terraform plan
# Terraform now proposes creating aws_s3_bucket.logs again (because it
# still exists in THIS config's .tf files but no longer in state) —
# you must ALSO delete the resource block from this config's HCL, then
# `import` it into the destination config.
```

### Example — `pull` and `push`

```bash
# Download current remote state as JSON, e.g. to inspect or back up manually
$ terraform state pull > backup-before-risky-change.json

# (Rare) Upload a modified/restored state file to overwrite remote state.
# Extremely dangerous if the local file is stale — always `pull` immediately
# before any manual edit-then-push workflow, and prefer state subcommands
# over hand-editing whenever possible.
$ terraform state push backup-before-risky-change.json
```

### Comparison Table

| Subcommand | Changes Real Infra? | Changes State? | Typical Use Case |
|------------|------------------------|------------------|---------------------|
| `list` | No | No (read-only) | Quick audit of what's tracked |
| `show` | No | No (read-only) | Inspect one resource's full attributes |
| `mv` | No | Yes — renames/relocates an address | Refactoring `.tf` code (renaming, moving into a module) without a destroy/recreate |
| `rm` | No | Yes — removes an entry entirely | Splitting configs, handing a resource off elsewhere, deliberately un-managing something |
| `pull` | No | No (just reads) | Manual backup, scripting, inspection |
| `push` | No | Yes — overwrites entire remote state | Disaster recovery, restoring from backup (rare, risky) |
| `import` (next section) | No | Yes — adds a new entry | Bringing an existing, unmanaged resource under Terraform |

### Common Mistakes

- **Using `rm` when you meant `mv`.** If you just want to rename a resource address, `mv` is
  almost always correct and preserves the "no changes" plan outcome. `rm` followed by re-`import`
  is more error-prone and only appropriate when a resource is genuinely leaving this
  config's management.
- **Forgetting to also update the `.tf` file after `mv`.** `mv` only changes the *state* address —
  if your config still says `aws_instance.web` while state now says `aws_instance.app_server`,
  you've just created a fresh mismatch. Rename in both places together.
- **Running `push` casually.** It fully overwrites remote state — a stale local file pushed by
  mistake can erase everyone else's more recent changes. Always `pull` a fresh copy immediately
  before any edit-then-push sequence, and prefer targeted subcommands (`mv`, `rm`, `import`) over
  a full `push` whenever possible.

### Interview Answer

"`terraform state` subcommands let you manipulate state safely without hand-editing JSON.
`list`/`show` are read-only inspection tools. `mv` renames or relocates a resource's address
within state — essential after renaming a resource block or moving it into a module, since
without it Terraform would plan a destructive destroy-and-recreate. `rm` removes a resource from
state without touching the real infrastructure, useful when splitting configs or handing a
resource to another Terraform root to manage. `pull`/`push` read or overwrite the entire remote
state as raw JSON, which is powerful but risky — `push` in particular can clobber teammates' more
recent state if you push a stale local copy."

> **Memory hook:** `terraform state` subcommands are the warehouse manager's official relabeling forms — `mv` reprints a shelf label, `rm` strikes an item off the books without touching the shelf, and you never grab a pen to scribble in the ledger directly.

---

## 4. `terraform import` Walkthrough

Your teammate manually created a security group in the AWS console last month, before your team
adopted Terraform. It's real, it's in use, and it's completely invisible to Terraform — there's no
entry for it anywhere in state. You now want Terraform to manage it going forward, *without*
destroying and recreating it (which would likely cause an outage for anything depending on it).
`terraform import` is exactly this bridge: it takes an existing real-world object and creates a
state entry for it, pointed at a resource block you write in your config.

### Analogy

Import is like discovering a shipping container sitting in your warehouse that was never logged
onto the manifest — maybe a supplier dropped it off directly. You don't unload and re-load the
container (that would be destroy-and-recreate); you simply walk over, write its container ID onto
the manifest under the correct line item, and now it's officially tracked going forward.

### Under the Hood

```
BEFORE IMPORT:

  Real AWS:  sg-0a1b2c3d4e5f6  (exists, created manually)
  Config:    (no resource block yet, OR a block with no matching state)
  State:     (no entry for this security group at all)

STEP 1 — Write a resource block in config that will "receive" the import:

  resource "aws_security_group" "web_sg" {
    name = "web-sg"
    # ... other required arguments matching the real object's config ...
  }

STEP 2 — Run import, pointing at the real object's ID:

  $ terraform import aws_security_group.web_sg sg-0a1b2c3d4e5f6

STEP 3 — Terraform:
  a) Calls the AWS API to read the CURRENT full attribute set of sg-0a1b2c3d4e5f6
  b) Writes a new entry into state: aws_security_group.web_sg -> those attributes
  c) Does NOT touch the real resource at all — read-only against the AWS API

AFTER IMPORT:

  Real AWS:  sg-0a1b2c3d4e5f6  (unchanged)
  Config:    resource "aws_security_group" "web_sg" { ... }
  State:     aws_security_group.web_sg -> id = "sg-0a1b2c3d4e5f6", + all
             other real attributes now recorded

STEP 4 — Run plan to check your config matches reality:

  $ terraform plan
  # If your resource block's arguments don't exactly match the real
  # object's current settings, Terraform will show a DIFF here — you
  # must edit your .tf block until plan shows "No changes."
```

### Example — Importing an Existing S3 Bucket

```hcl
# main.tf — write this block FIRST, matching what you believe the real
# bucket looks like (you'll refine it after import + plan)
resource "aws_s3_bucket" "existing_logs" {
  bucket = "my-app-logs-bucket"
}
```

```bash
$ terraform import aws_s3_bucket.existing_logs my-app-logs-bucket

aws_s3_bucket.existing_logs: Importing from ID "my-app-logs-bucket"...
aws_s3_bucket.existing_logs: Import prepared!
  Prepared aws_s3_bucket for import
aws_s3_bucket.existing_logs: Refreshing state... [id=my-app-logs-bucket]

Import successful!

The resources that were imported are shown above. These resources are now in
your Terraform state and will henceforth be managed by Terraform.
```

```bash
$ terraform plan

# aws_s3_bucket.existing_logs will be updated in-place
~ resource "aws_s3_bucket" "existing_logs" {
      id     = "my-app-logs-bucket"
    ~ versioning { ... }   # real bucket has versioning enabled, config didn't declare it
  }

Plan: 0 to add, 1 to change, 0 to destroy.

# ^ This diff means your .tf block is INCOMPLETE relative to the real
#   object. Add the missing arguments/blocks until `plan` shows
#   "No changes." — that's how you confirm your config now accurately
#   describes the imported resource.
```

Modern Terraform (1.5+) also supports declarative import via an `import` block, which is
plannable and reviewable like any other change:

```hcl
import {
  to = aws_s3_bucket.existing_logs
  id = "my-app-logs-bucket"
}

resource "aws_s3_bucket" "existing_logs" {
  bucket = "my-app-logs-bucket"
}
```

```bash
$ terraform plan
# Shows the planned import as part of the normal plan output, reviewable
# before you run `terraform apply` to actually execute it — safer than
# the older CLI `terraform import` command, which applies immediately.
```

### Comparison: `terraform import` (CLI command) vs `import` Block

| Aspect | `terraform import <addr> <id>` (CLI) | `import { ... }` Block (1.5+) |
|--------|------------------------------------------|-----------------------------------|
| Reviewable before executing? | No — runs immediately | Yes — shows in `terraform plan` before `apply` |
| Can import multiple resources at once? | One at a time, one command per resource | Yes, multiple `import` blocks, all planned together |
| Works with `for_each`/`count` addresses | Clunky (must specify full index in address) | Cleaner, supports `for_each` via `id` expressions |
| Version support | All Terraform versions | Terraform 1.5+ |
| Generates config automatically? | No | Yes, with `terraform plan -generate-config-out=generated.tf` |

### Common Mistakes

- **Forgetting to write the `.tf` resource block first (for the CLI command).** `terraform
  import` needs a destination resource address that already exists in your config — it doesn't
  create the HCL block for you (the older CLI form). Attempting to import into a nonexistent
  address errors immediately.
- **Assuming import also copies the resource's config into your `.tf` file.** The classic
  `terraform import` command only writes to *state* — you still must hand-write (or use
  `-generate-config-out`) a matching resource block, then iterate against `terraform plan` until
  the diff disappears.
- **Importing without a follow-up `plan`.** A successful import message does not mean your config
  matches reality — it only means state now has an entry. Always run `plan` immediately after and
  treat any non-empty diff as configuration you still need to fill in.
- **Importing a resource, then applying before double-checking `plan` is empty.** If your config
  is missing arguments, `apply` right after import can silently *change* the real resource to
  match your incomplete config, which might not be what you intended for a system that's been
  running fine for months.

### Interview Answer

"`terraform import` brings an already-existing real-world resource under Terraform's management by
creating a state entry for it, without making any changes to the real resource itself. You first
write a resource block in your config to serve as the destination address, then run `terraform
import <address> <real-id>`, which calls the provider's read API and records the resource's
current attributes into state. Crucially, this doesn't write your `.tf` file's arguments for you —
you must run `terraform plan` afterward and keep adjusting the resource block until the plan shows
no changes, confirming your configuration now accurately describes the imported object. Terraform
1.5+ also supports a declarative `import` block, which is safer because it shows up in a normal
plan for review before it's actually executed, and can even generate the starting HCL via
`-generate-config-out`."

> **Memory hook:** Import is discovering an unlogged shipping container already sitting in your warehouse — you don't unload and reload it, you just write its ID onto the manifest where it belongs.

---

## 5. Force-Unlock

Picture this: a CI job was mid-`apply` when the runner got OOM-killed. It never got the chance to
release its DynamoDB lock item before dying. Now every subsequent `plan`/`apply` — from anyone —
fails with "Error acquiring the state lock," pointing at a lock that's held by a process that no
longer exists and never will finish. Terraform has no automatic timeout for this (by design —
it can't safely guess whether a slow apply is "stuck" or just legitimately taking 20 minutes to
provision an RDS instance). The escape hatch is `terraform force-unlock`.

### Analogy

Force-unlock is the master key a building superintendent keeps for exactly this situation: a
tenant who left their apartment mid-move, wedged the door, and is now unreachable, with an
"occupied" sign still hanging that nobody will ever come take down. The super doesn't use the
master key casually — they verify first that the tenant is truly gone (not just quiet), because
using it while someone is genuinely still inside would be a real problem.

### Under the Hood

```
Normal lock lifecycle:
  acquire lock → do work → release lock  (all one continuous operation)

Broken lock scenario (process died mid-operation):
  acquire lock → do work → [PROCESS KILLED — crash, OOM, network partition,
                             Ctrl+C during a network call, spot instance
                             reclaimed] → lock is NEVER released

  Everyone else's Terraform now sees:
    Error: Error acquiring the state lock
      Lock Info:
        ID:      8f3a1c2d-6b21-4e77-9a13-2b6f5e9d1a90
        Who:     ci-runner-047
        Created: 2026-07-20 09:12:04 UTC   <-- hours ago, clearly stale

  YOU must verify:
    1. Is that process DEFINITELY not still running/finishing up?
    2. Did the previous operation likely complete its real infra changes,
       or fail partway through?
  ONLY THEN:
    $ terraform force-unlock 8f3a1c2d-6b21-4e77-9a13-2b6f5e9d1a90
```

Force-unlock does exactly one thing: it deletes the lock record (the DynamoDB item, or equivalent
for other backends) so that future operations can acquire the lock again. It does **not** inspect,
repair, or validate the state file's contents — if the crashed operation left state in a
half-applied condition, force-unlock does nothing to fix that; you may still need to run `plan`
carefully afterward and reconcile drift manually.

### Example

```bash
$ terraform plan

Error: Error acquiring the state lock

Lock Info:
  ID:        8f3a1c2d-6b21-4e77-9a13-2b6f5e9d1a90
  Path:      my-org-tfstate/prod/network/terraform.tfstate
  Operation: OperationTypeApply
  Who:       ci-runner-047
  Version:   1.7.5
  Created:   2026-07-20 09:12:04 UTC
```

```bash
# After confirming ci-runner-047's job is genuinely dead (checked the CI
# dashboard — the job shows "cancelled/killed", not "running"):

$ terraform force-unlock 8f3a1c2d-6b21-4e77-9a13-2b6f5e9d1a90

Do you really want to force-unlock?
  Terraform will remove the lock on the remote state.
  This will remove the lock on the state, but not the state itself,
  and could cause the state to become out of sync if it's already
  been modified.

  Enter a value: yes

Terraform state has been successfully unlocked!

$ terraform plan
# Now proceeds normally. CAREFULLY review the plan output — if the
# dead process partially applied changes before dying, this plan may
# show unexpected diffs reflecting that partial work.
```

### Comparison: Safe Recovery Paths vs Risky Shortcuts

| Action | Risk Level | When Appropriate |
|--------|------------|--------------------|
| `terraform force-unlock <id>` after confirming the holding process is truly dead | Low-Medium | Standard, supported recovery path — Terraform explicitly built this command for exactly this situation |
| Manually deleting the DynamoDB lock item via AWS CLI/console | Medium | Works, but bypasses Terraform's own confirmation prompt and audit trail; prefer `force-unlock` |
| Deleting and recreating the entire DynamoDB table | High | Destroys ALL projects' locks sharing that table, not just yours — almost never the right move |
| Ignoring the lock and hand-editing `terraform.tfstate` directly | Very High | Never appropriate — doesn't even address the actual lock record, and risks corrupting state separately |

### Common Mistakes

- **Force-unlocking without confirming the original process is actually gone.** If that CI job or
  teammate's `apply` is merely slow (not dead), force-unlocking mid-operation and then running a
  second `apply` can produce two genuinely concurrent writes to state — the exact corruption
  locking exists to prevent in the first place.
- **Treating force-unlock as "fixing" the state.** It only removes the lock record. Any real
  inconsistency left behind by the interrupted operation (partially-applied resources, stale
  attribute values) still needs a `terraform plan`/`refresh` review and possibly manual `state`
  subcommand cleanup afterward.
- **Not investigating *why* the lock got stuck.** A recurring pattern of stuck locks (e.g., CI
  runners routinely getting OOM-killed mid-apply) is a signal to fix the underlying reliability
  issue — increase CI resource limits, add graceful shutdown handling — not just repeatedly
  force-unlock as a workaround.

### Interview Answer

"`force-unlock` removes a stuck state lock record — for example, one left behind by a CI job that
crashed mid-apply and never got to release it — without touching the state file's actual contents.
You should only run it after confirming the process that originally acquired the lock is truly no
longer running, because if it's still active and you force-unlock prematurely, a second
concurrent operation could start and race with the first, causing exactly the corruption locking
is meant to prevent. It's a recovery mechanism for a genuinely stuck lock, not a general-purpose
'skip the lock' shortcut, and it doesn't repair any inconsistency the interrupted operation might
have left in the state data itself."

> **Memory hook:** Force-unlock is the superintendent's master key for an apartment with a wedged door and an unreachable tenant — necessary sometimes, but only after you're truly sure nobody's still inside.

---

## 6. Common Mistakes

A consolidated list of the highest-impact state-locking and state-command mistakes from this
lesson, worth reviewing together:

1. **Skipping locking entirely** (covered in lesson 02) and only discovering the gap after a
   corrupted state incident.
2. **Manually editing the DynamoDB lock item or the state file** instead of using `force-unlock`
   or `terraform state` subcommands.
3. **Using `rm` when `mv` was the correct tool** for a simple rename/relocation, causing an
   unnecessary destroy-and-recreate cycle.
4. **Running `terraform import` and stopping there**, without following up with `plan` until the
   diff is empty — leaving a false sense that the resource is now "fully managed" when the config
   doesn't actually match reality yet.
5. **Force-unlocking reflexively** without confirming the original holder is actually gone.
6. **Casual use of `state push`**, overwriting remote state with a stale local copy.

> **Memory hook:** Nearly every state-locking incident comes down to skipping a confirmation step that Terraform explicitly built in for safety — read the prompt before typing "yes."

---

## 7. Hands-On Exercises

**Exercise 1 — Observe Locking Live**
Using a project with a properly configured S3 + DynamoDB backend, start a `terraform apply` in one
terminal and pause at the yes/no prompt. In a second terminal (same directory), run `terraform
plan` and capture the exact "Error acquiring the state lock" message, including the `Who` and
`Created` fields.

**Exercise 2 — `mv` a Renamed Resource**
Create a config with one resource, `apply` it. Rename the resource in your `.tf` file (e.g.,
`aws_instance.web` -> `aws_instance.app`). Run `terraform plan` first WITHOUT using `state mv` and
observe the destroy+create plan. Then run `terraform state mv aws_instance.web aws_instance.app`
and re-run `plan`, confirming it now shows no changes.

**Exercise 3 — Import an Unmanaged Resource**
Manually create a small resource via the AWS CLI or console (e.g., an S3 bucket) outside of any
Terraform config. Write a matching `resource` block, then run `terraform import`. Run `plan`
afterward and iteratively adjust your `.tf` block until the diff is empty.

**Exercise 4 — Simulate and Recover From a Stuck Lock**
Manually create a DynamoDB lock item using the AWS CLI with a `LockID` matching your project's
backend key, to simulate a crashed process holding a lock. Run `terraform plan`, observe the
error, note the lock `ID` from the error message, then run `terraform force-unlock <ID>` to
recover.

**Exercise 5 — `rm` and Re-Import Across Two Configs**
Set up two separate Terraform root configs. Create a resource in config A. Use `terraform state
rm` to remove it from A's state (and delete the corresponding block from A's `.tf` files), then
write a matching resource block in config B and `terraform import` it there. Confirm the resource
was never destroyed throughout, only its "ownership" moved between configs.

---

## 8. Interview Q&A

---

**Q1: What's the difference between state locking and state itself?**

A: State is the data — a JSON record mapping config addresses to real resource attributes.
Locking is a coordination mechanism layered on top of wherever state is stored, ensuring only one
Terraform operation can read-modify-write that data at a time. You can have state without locking
(risky under concurrency) but locking without any state to protect wouldn't make sense — they're
complementary, not the same feature.

---

**Q2: Walk through exactly how DynamoDB prevents two concurrent applies from corrupting state.**

A: Terraform issues a conditional `PutItem` with `ConditionExpression =
"attribute_not_exists(LockID)"`. DynamoDB guarantees this check-and-write happens as a single
atomic operation, so if two processes attempt it at nearly the same instant, only one `PutItem`
can succeed — the other gets a `ConditionalCheckFailedException`, which Terraform surfaces as
"Error acquiring the state lock." The winning process holds the lock until it finishes (success or
failure) and issues a `DeleteItem` to release it.

---

**Q3: When would you use `terraform state mv` instead of just editing the resource name in your
`.tf` file?**

A: You'd use both together. Editing only the `.tf` file's resource name, without `state mv`, makes
Terraform think the old address was deleted from config (destroy it) and a new address appeared
(create it) — a destructive, unnecessary recreate for something that's really just a rename.
`state mv` updates the state's address to match your renamed `.tf` block, so `plan` shows no
changes at all.

---

**Q4: Does `terraform import` create the `.tf` configuration for you?**

A: The classic `terraform import` CLI command does not — you must write the destination resource
block yourself before running it, and it only populates the *state* entry, not your HCL. You then
run `terraform plan` and adjust the resource block's arguments until the plan shows no diff,
confirming your config now matches the imported object's real settings. Terraform 1.5+'s
declarative `import` block can pair with `-generate-config-out` to auto-generate a starting HCL
block, reducing this manual step.

---

**Q5: What does `force-unlock` actually do, and what does it NOT do?**

A: It removes the lock record (e.g., deletes the DynamoDB item for that `LockID`) so future
operations can acquire the lock again. It does not inspect, validate, or repair the state file's
contents — if the process that held the lock died mid-apply and left infrastructure in a
partially-applied condition, force-unlock does nothing to detect or fix that; you still need to
carefully review a subsequent `plan` for unexpected drift.

---

**Q6: What's the danger of force-unlocking too eagerly?**

A: If the process that originally acquired the lock is actually still running (just slow, not
dead), force-unlocking and then starting a new operation creates exactly the concurrent-write race
that locking exists to prevent — you could end up with two operations modifying the same state
and real infrastructure at once. Always confirm the original holder is truly gone before force-
unlocking.

---

**Q7: What is the difference between `terraform state rm` and `terraform destroy` for a single
resource?**

A: `terraform state rm` removes the resource's entry from state only — the real infrastructure
object is left completely untouched and now unmanaged by this Terraform config. `terraform
destroy` (or a targeted destroy) actually calls the provider's delete API to remove the real
resource. They're near-opposites in intent: `state rm` is for handing a resource off (e.g., to
another config, via a subsequent `import`), while `destroy` is for actually tearing infrastructure
down.

---

**Q8: Why can't Terraform automatically time out a stuck lock?**

A: Terraform has no reliable way to distinguish "this apply is stuck/crashed" from "this apply is
legitimately still running a slow operation" (e.g., waiting on an RDS instance that takes 15+
minutes to become available). An automatic timeout risks releasing a lock while a healthy
operation is still in progress, reintroducing the exact race condition locking prevents. Instead,
Terraform requires a human to explicitly confirm the lock is stale via `force-unlock`, after
manually verifying the original process is truly no longer running.
