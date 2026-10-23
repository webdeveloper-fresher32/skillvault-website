# Runner Groups and Labels

Lesson 1 covered a single self-hosted runner, but a real org rarely has just one — a handful of GPU boxes, a fleet of ARM machines, a few beefy on-prem servers with a path into a private database. Labels solve the targeting problem (which runner has the right capability); runner groups solve a separate, org-level access-control problem (which repos are even allowed to use it). This lesson covers both mechanisms and how they combine.

## 1. The Targeting Problem

A workflow saying `runs-on: self-hosted` has no way to say which self-hosted machine it actually needs — `self-hosted` alone just means "some machine registered as self-hosted," with no guarantee it has a GPU, the right architecture, or network access to anything in particular.

```
runs-on: self-hosted
         └── matches ANY self-hosted runner in scope, capability unknown
```

## 2. Custom Labels for Targeting

A self-hosted runner is registered with one or more custom labels, in addition to the labels GitHub assigns automatically (`self-hosted`, plus its OS and architecture, e.g. `linux`, `x64`). Custom labels are supplied during `config.sh` (via a `--labels` flag) or added afterward from the runner's settings page.

```bash
./config.sh --url https://github.com/your-org/your-repo \
  --token AXXXXXXXXXXXXXXXXXXXXXXXXXXX \
  --labels gpu,cuda-12
```

A workflow's `runs-on` field then lists every label a candidate runner must have, all at once:

```yaml
name: Train Model

on:
  push:
    branches:
      - main

jobs:
  train:
    runs-on: [self-hosted, linux, gpu]
    steps:
      - uses: actions/checkout@v4
      - name: Verify GPU is visible
        run: nvidia-smi
      - name: Run training job
        run: python train.py --epochs 10
```

This YAML was parsed with `python3 -c "import yaml,sys; yaml.safe_load(sys.stdin.read())"` and loads cleanly as a single well-formed document.

GitHub's scheduler treats a `runs-on` label list as an AND, not an OR — it only assigns the job to a runner carrying every listed label. A self-hosted Linux runner without a GPU attached, even if otherwise idle, is not an eligible match here.

## 3. Runner Groups for Access Control

A GPU cluster or a runner with a path into a sensitive internal network shouldn't be schedulable by every repo in the org just because it happens to be self-hosted. An org or enterprise admin creates a runner group (Settings → Actions → Runner groups) and assigns specific self-hosted runners into it. A group is a container for access control, independent of labels — it restricts which repositories (and optionally which workflows) may schedule jobs on the runners inside it: "all repositories," a specific allow-list, or (at the enterprise level) a specific list of organizations.

```
Runner group: "gpu-cluster"
  Members:  gpu-runner-01, gpu-runner-02
  Allowed repositories: ml-team/training-pipeline, ml-team/inference-service
  Everyone else: cannot schedule jobs onto these runners, regardless of labels used
```

## 4. Combining Labels and Groups

When a job requests a label combination that resolves to a runner sitting inside a restricted group, GitHub checks the calling repository against that group's policy before the job is ever assigned. A job from a repo the group doesn't allow simply fails to find an eligible runner — labels alone can't override a group's access restriction, and a group's access restriction can't substitute for correct labels either; both checks have to pass.

```
Job requests: runs-on: [self-hosted, linux, gpu]
   Step 1 — label match:   does any runner carry all three labels?      (capability check)
   Step 2 — group policy:  is this job's repo allowed into that runner's group?  (access check)
   Both must pass, or the job finds no eligible runner.
```

## Comparison

| Aspect | Labels | Runner groups |
|---|---|---|
| What it answers | "What does this job need?" | "Who is allowed to use this runner?" |
| Set by | Whoever writes the workflow file | Org/enterprise admin |
| Configured in | `runs-on:` in the workflow YAML | Settings → Actions → Runner groups |
| Enforces security? | No — a capability filter only | Yes — an access-control boundary |
| Scope of a mismatch | Job fails to schedule / picks wrong runner | Job fails to schedule at all for that repo |
| Editable by | Anyone who can edit the workflow file | Only org/enterprise admins |

## Common Mistakes

- **Relying only on the generic `self-hosted` label without adding capability-specific labels.** A job that just says `runs-on: self-hosted` can land on any self-hosted runner in scope, including one with none of the tooling the job actually needs.
- **Assuming labels alone provide security or access control.** Labels are a capability filter, not a permission system — anyone who can edit a workflow file in an eligible repository can write `runs-on: [self-hosted, gpu]` and, if that repo isn't restricted at the group level, reach a sensitive runner just by asking for its labels.
- **Leaving a sensitive runner group open to "all repositories."** A runner group holding infrastructure with elevated access (a database-adjacent network, expensive GPU hardware) that isn't scoped down to an allow-list of repositories can be scheduled against by any repo in the org.
- **Forgetting that runner-group membership is configured separately from workflow-level `permissions:` (Phase 11).** Scoping a `GITHUB_TOKEN` down doesn't restrict which runner group a job can land on — these are two independent controls.
- **Reusing the same label across genuinely different hardware.** Tagging both a small on-prem test box and a large GPU cluster with just `linux` and nothing more distinguishing means a job that needed the cluster can silently land on the underpowered box instead.

## Hands-On Exercises

1. Register two self-hosted runners against the same repository: one with `--labels linux,gpu` and one with just default labels. Trigger the `Train Model` workflow above and confirm it always lands on the GPU-labeled runner, never the other one.
2. As an org admin, create a runner group, move the GPU runner from Exercise 1 into it, and restrict the group's allowed repositories to a single repo other than the one used in Exercise 1. Re-run the workflow from the original repo and confirm it now fails to find an eligible runner, even though the label match is still correct.
3. From the repo the group in Exercise 2 does allow, run the same workflow and confirm it schedules successfully — demonstrating that a correct label match plus an allowed group membership together are what let the job run.
4. Register a second GPU-labeled runner (`--labels linux,gpu,cuda-12`) alongside the one from Exercise 1, so two runners now carry the `gpu` label but only the new one also carries `cuda-12`. Leave this new runner ungrouped, and run this exercise from the repo the group in Exercise 2 allows (the same repo used in Exercise 3), so the Exercise-1 runner's group restriction doesn't come into play here — the only thing distinguishing the two runners in this exercise is labels. Write a workflow requesting `runs-on: [self-hosted, gpu, cuda-12]` and confirm it lands only on the runner carrying all three labels, not the Exercise-1 runner missing `cuda-12`.
5. Write a workflow with `runs-on: [self-hosted, gpu]` from a repo not on any restrictive group's allow-list, aimed at an org where every GPU runner sits inside a restricted group. Confirm the job fails to schedule, and explain in your own words why fixing the labels wouldn't help.

## Interview Q&A

**Q: How do you make sure a CI job only runs on a runner that actually has a GPU?**
A: Attach a custom label like `gpu` to the qualifying runners at registration, then include it in the job's `runs-on` list alongside `self-hosted` — GitHub schedules the job only onto a runner matching every listed label.

**Q: How do you stop an unrelated team's repo from using a GPU runner even if they know the label?**
A: Labels alone provide no access control. Put the runner into an org- or enterprise-level runner group whose access policy is explicitly restricted to the repositories that should be allowed to use it.

**Q: If a job's labels match a runner but the job's repo isn't in that runner's group, what happens?**
A: The job fails to find an eligible runner — the group's access policy is checked in addition to the label match, and either check failing blocks scheduling.

**Q: Are labels an AND or an OR match against a runner's labels?**
A: AND — a job is only scheduled onto a runner that carries every label listed in `runs-on`, not one that matches merely at least one.

**Q: Does tightening a workflow's `permissions:` block also restrict which runner group it can use?**
A: No — `permissions:` scopes the `GITHUB_TOKEN`'s API access, while runner-group membership is a completely separate, admin-controlled access boundary. Tightening one doesn't affect the other.
