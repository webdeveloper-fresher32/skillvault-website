# 03 — Provisioners

## Table of Contents

1. [What Provisioners Are and Why HashiCorp Calls Them "Last Resort"](#1-what-provisioners-are-and-why-hashicorp-calls-them-last-resort)
2. [When Provisioners Are Appropriate vs Anti-Pattern](#2-when-provisioners-are-appropriate-vs-anti-pattern)
3. [`on_failure` and `when = destroy` Provisioners](#3-on_failure-and-when--destroy-provisioners)
4. [A Full Example — Bootstrapping an EC2 Instance](#4-a-full-example--bootstrapping-an-ec2-instance)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What Provisioners Are and Why HashiCorp Calls Them "Last Resort"

Imagine you've just told Terraform to create an EC2 instance. Terraform's job — talking to the AWS
API to spin up a VM — is now done. But your application isn't actually running yet: nothing has
installed nginx, cloned your app's code, or started the service. Terraform's core competency is
declarative *infrastructure* provisioning (create this VM, this subnet, this bucket) — it was
never designed to be a configuration management tool that pushes files and runs shell commands
*inside* a machine after it exists. Yet sometimes you need exactly that, and Terraform gives you
an escape hatch called **provisioners**.

A **provisioner** is a block nested inside a `resource` that runs an action — a local shell
command, or a remote command over SSH/WinRM — at resource creation or destruction time. The two
most common are:

- **`local-exec`** — runs a command on the machine running Terraform itself (your laptop, your CI
  runner) — not on the remote resource.
- **`remote-exec`** — runs a command *inside* the remote resource (e.g., SSHes into the new EC2
  instance and runs shell commands there).

HashiCorp's own documentation is blunt about this: *"Provisioners should only be used as a last
resort."* Why? Because provisioners fall outside Terraform's state model — Terraform has no idea
what a provisioner script actually did, can't diff it, can't detect drift in it, and can't safely
re-run it if it partially fails. If a `remote-exec` script installs three packages and fails
installing the second one, Terraform just knows "the provisioner failed" — it has no fine-grained
understanding of what state the machine is now in.

### Analogy

A Terraform resource block is like ordering a fully-assembled desk from a furniture company —
they build it, deliver it, and you now own a working desk (a known, trackable object). A
provisioner is like telling the delivery driver, "hey, while you're here, can you also plug in my
lamp and rearrange my bookshelf?" The delivery company will do it as a favor, but it's not part of
their actual tracked inventory system — if the driver forgets to plug in the lamp, or plugs it
into the wrong outlet, the furniture company's records still just say "desk delivered." Nobody
downstream knows the lamp task even happened, let alone whether it succeeded.

### Under the Hood

```
terraform apply
      │
      ▼
┌────────────────────────────────────────────────────┐
│  1. AWS API call → EC2 instance created             │
│     (tracked precisely in Terraform state)          │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────┐
│  2. Provisioner runs (e.g. remote-exec over SSH)     │
│     - installs nginx, starts service                 │
│     - Terraform state has NO knowledge of what        │
│       specifically happened inside this step         │
│     - if it fails partway, Terraform only knows       │
│       "provisioner failed" — not which command,       │
│       not what state the machine is left in           │
└────────────────────────────────────────────────────┘
```

Because provisioners live outside the declarative resource model, `terraform plan` can never
preview what a provisioner will do, and re-running `terraform apply` after a provisioner failure
doesn't necessarily re-run the provisioner in a safe, idempotent way unless you've written the
script itself to be idempotent.

### Example

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  key_name      = aws_key_pair.deployer.key_name

  provisioner "local-exec" {
    command = "echo Instance ${self.id} created at $(date) >> deployments.log"
  }
}
```

Here, `local-exec` never touches the EC2 instance at all — it runs `echo` on whatever machine ran
`terraform apply` (your laptop or CI runner), simply logging that the apply happened.

### Common Confusion

Beginners assume `local-exec` runs *on* the resource it's attached to. It doesn't — `local-exec`
always runs on the machine executing Terraform. If you need to run a command *inside* the newly
created resource, that's `remote-exec`, which requires network connectivity (SSH/WinRM) from the
Terraform runner to the resource — something that often doesn't exist for private-subnet instances
without a bastion host or VPN, making `remote-exec` fail in exactly the environments where
security is taken seriously.

### Interview Answer

"A provisioner is a resource-nested block that runs a script either locally (on the machine
running Terraform) or remotely (inside the created resource, over SSH/WinRM), at create or
destroy time. HashiCorp calls them a last resort because they operate outside Terraform's
declarative state model — Terraform can't preview, diff, or safely retry what a provisioner does,
unlike a resource attribute change. They should only be used when there's genuinely no
provider-native or cloud-native alternative, like `user_data` or a dedicated configuration
management tool."

> **Memory hook:** A provisioner is asking the furniture delivery driver to also plug in your lamp — it might get done, but it's not tracked in anyone's real inventory system the way the desk is.

---

## 2. When Provisioners Are Appropriate vs Anti-Pattern

So if provisioners are discouraged, when — if ever — should you actually reach for one? The honest
answer: almost never for anything AWS-native, because AWS (and most major clouds) gives you
**`user_data`** — a cloud-init script that runs automatically on first boot, entirely inside the
provider's own tracked lifecycle, no SSH connectivity from your laptop required. Provisioners
exist mainly for edge cases: local tooling side-effects, on-premise resources with no cloud-native
bootstrap mechanism, or genuinely one-off debugging.

### Comparison Table

| Approach | Runs Where | Tracked by Terraform State? | Idempotent by Default? | Needs SSH/WinRM Connectivity? | Best For |
|----------|-----------|------------------------------|--------------------------|-------------------------------|----------|
| **`user_data`** (cloud-init) | On the instance, at first boot, via the cloud provider's own mechanism | Yes — it's a plain resource attribute (`user_data`), diffed and versioned like any other | Depends on script content, but no SSH round-trip needed | No | Bootstrapping cloud VMs — the default, correct choice on AWS/Azure/GCP |
| **`remote-exec` provisioner** | Inside the resource, over SSH/WinRM initiated by the Terraform runner | No — provisioner actions are invisible to state | No — Terraform can't verify or retry safely | Yes — runner needs network path to the instance | Rare: something `user_data` genuinely cannot do, e.g. reacting to output only known after another resource is created |
| **`local-exec` provisioner** | On the Terraform runner (laptop/CI) | No | No | No (runs locally) | Side-effects outside infra — writing a local file, calling an external API, triggering a non-Terraform pipeline step |
| **Configuration management (Ansible, Chef, Puppet)** | Runs against the instance, typically after Terraform hands off | No (separate tool, separate state/inventory) | Yes — these tools are explicitly built for idempotent convergence | Yes (Ansible: SSH; Chef/Puppet: agent) | Ongoing configuration drift management, complex multi-step software installs, environments that change frequently post-provisioning |

### The Core Trade-off

```
┌───────────────────────────────────────────────────────────────┐
│  "Day 1" provisioning              "Day 2" ongoing config      │
│  (get the box to a working          (keep the box converged    │
│   state on first boot)               over its whole lifetime)  │
├───────────────────────────────────────┬─────────────────────────┤
│  user_data / cloud-init                │  Ansible / Chef / Puppet │
│  → runs once, at boot, provider-native │  → runs repeatedly,      │
│                                        │    designed for drift    │
│                                        │    correction over time  │
└────────────────────────────────────────┴─────────────────────────┘
   Terraform provisioners awkwardly try to live in BOTH categories
   at once, and do neither one particularly well.
```

### Genuinely Legitimate Provisioner Use Cases

- Running a `local-exec` to trigger something entirely outside infrastructure — e.g., notifying a
  Slack webhook that a deploy happened, or writing an audit log entry to a local file.
- Bootstrapping something that has *no* cloud-native equivalent at all — e.g., an on-premises
  network appliance managed via a proprietary CLI reachable only over SSH.
- One-off local debugging during initial module development (not something you'd leave in
  production code).

### Common Confusion

People sometimes believe `remote-exec` is "more powerful" than `user_data` because it can react to
values only known after other resources are created (say, waiting on a database endpoint that's
only known post-creation). In reality, `user_data` can consume the exact same interpolated values
— `user_data = templatefile("bootstrap.sh.tpl", { db_endpoint = aws_db_instance.main.endpoint })`
— because `user_data` is just a regular resource attribute like any other, fully part of
Terraform's dependency graph. The "reactive" argument for `remote-exec` is almost always solvable
with `user_data` plus a template.

### Interview Answer

"Provisioners are appropriate only when there's genuinely no cloud-native or provider-native
alternative — mostly local side-effects like `local-exec` calling an external API, or bootstrapping
on-premises systems with no other automation path. For any AWS EC2 first-boot configuration,
`user_data` is almost always the correct tool: it's tracked in state as a normal attribute, needs
no SSH connectivity from the Terraform runner, and can consume the same interpolated values a
`remote-exec` provisioner could. For ongoing configuration management beyond first boot, a
dedicated tool like Ansible is the right layer — Terraform provisioners are not designed for
convergence over time."

> **Memory hook:** `user_data` is the factory pre-installing the software before shipping the box — provisioners are you personally showing up with a screwdriver after delivery. Use the factory whenever you can.

---

## 3. `on_failure` and `when = destroy` Provisioners

Given that provisioners are unreliable by nature — network blips, transient SSH timeouts, a
package mirror being briefly down — Terraform gives you two extra controls: what to do when a
provisioner *fails*, and how to run a provisioner at *destroy* time instead of create time.

### `on_failure`

By default, if a provisioner fails, `terraform apply` marks the entire resource as **tainted** and
the apply fails. `on_failure` lets you change that behavior:

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  provisioner "remote-exec" {
    inline = ["sudo apt-get update", "sudo apt-get install -y nginx"]

    on_failure = continue   # default is "fail" — this makes a failed provisioner non-fatal
  }
}
```

| Value | Behavior |
|-------|----------|
| `fail` (default) | Provisioner failure marks the resource tainted; `apply` halts with an error |
| `continue` | Provisioner failure is logged as a warning but ignored; `apply` proceeds |

Use `continue` only for genuinely optional steps (e.g., an analytics-reporting curl call that
shouldn't block the whole apply if it fails) — never for a step your application actually depends
on to function.

### `when = destroy` Provisioners

A provisioner normally runs when the resource is **created**. Setting `when = destroy` flips that
— it runs right *before* the resource is destroyed, useful for graceful deregistration:

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  provisioner "remote-exec" {
    when       = destroy
    inline     = ["sudo systemctl stop myapp", "curl -X POST https://lb.internal/deregister?id=${self.id}"]
    on_failure = continue
  }
}
```

A `when = destroy` provisioner has an important restriction: it can only reference `self` (its own
resource's attributes) — it cannot reference other resources or data sources, because by the time
Terraform runs it, the rest of your infrastructure graph may already be in the process of being
torn down and other resources' current values aren't guaranteed to be reliable or even to still
exist.

### Under the Hood

```
terraform destroy
      │
      ▼
┌──────────────────────────────────────────┐
│ 1. Run any `when = destroy` provisioners   │
│    (only `self.*` references allowed)      │
└───────────────────┬────────────────────────┘
                    ▼
┌──────────────────────────────────────────┐
│ 2. AWS API call → instance terminated      │
└──────────────────────────────────────────┘
```

### Common Mistakes

- Setting `on_failure = continue` on a provisioner that installs something the application
  actually needs — the apply "succeeds" but the app is broken, and nobody finds out until it's
  serving traffic (or not).
- Trying to reference another resource's attribute inside a `when = destroy` provisioner — this
  either errors at plan time or behaves unpredictably, since destroy-time provisioners are
  restricted to `self`.
- Assuming a `when = destroy` provisioner will reliably run during a `terraform destroy` triggered
  by something outside Terraform's control (e.g., someone manually terminating the instance in the
  AWS console) — it only runs when Terraform itself performs the destroy.

### Interview Answer

"`on_failure` controls what happens when a provisioner errors — `fail` (the default) taints the
resource and halts the apply, while `continue` logs a warning and proceeds, which should only be
used for genuinely optional steps. `when = destroy` provisioners run right before a resource is
destroyed rather than after it's created, useful for graceful shutdown or deregistration — but
they're restricted to referencing only `self`, since other resources in the graph may already be
mid-teardown by the time they run."

> **Memory hook:** `on_failure = continue` is "shrug it off and keep going" — use it only for things that truly don't matter if they fail. `when = destroy` is the exit interview, and it can only talk about itself.

---

## 4. A Full Example — Bootstrapping an EC2 Instance

Let's put it together: an EC2 instance that installs and starts nginx via `remote-exec` over SSH
(shown for illustration of provisioner mechanics), immediately followed by the honest, better-
practice alternative using `user_data` — so you can see both side by side and understand exactly
why the second one is preferred in real production code.

### Version A — `remote-exec` (illustrates the mechanics, not recommended for production)

```hcl
resource "aws_security_group" "web" {
  name = "web-sg"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["YOUR_IP/32"]   # never 0.0.0.0/0 for SSH in real usage
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_key_pair" "deployer" {
  key_name   = "deployer-key"
  public_key = file("~/.ssh/id_rsa.pub")
}

resource "aws_instance" "web" {
  ami                    = "ami-0c55b159cbfafe1f0"
  instance_type          = "t3.micro"
  key_name               = aws_key_pair.deployer.key_name
  vpc_security_group_ids = [aws_security_group.web.id]

  connection {
    type        = "ssh"
    user        = "ubuntu"
    private_key = file("~/.ssh/id_rsa")
    host        = self.public_ip
  }

  provisioner "remote-exec" {
    inline = [
      "sudo apt-get update -y",
      "sudo apt-get install -y nginx",
      "sudo systemctl enable nginx",
      "sudo systemctl start nginx",
    ]
    on_failure = fail
  }

  provisioner "remote-exec" {
    when       = destroy
    on_failure = continue
    inline     = ["sudo systemctl stop nginx"]
  }

  tags = { Name = "web-remote-exec" }
}
```

Notice the `connection` block — it's required for `remote-exec` to know how to reach the instance
(SSH user, private key, target host). This requires the Terraform runner to have network access
to `self.public_ip`, the correct key material available locally, and the security group to allow
inbound SSH from wherever `terraform apply` is running.

### Version B — `user_data` (the preferred, production-realistic approach)

```hcl
resource "aws_instance" "web" {
  ami                    = "ami-0c55b159cbfafe1f0"
  instance_type          = "t3.micro"
  vpc_security_group_ids = [aws_security_group.web.id]

  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    apt-get update -y
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
  EOF

  tags = { Name = "web-user-data" }
}
```

Version B needs no SSH connectivity from the Terraform runner, no `connection` block, no security
group hole for port 22 from your workstation, and `user_data` is a plain tracked attribute — if it
changes, `terraform plan` shows exactly that diff, and (depending on the `user_data_replace_on_change`
argument) can even trigger a controlled instance replacement.

### Common Mistakes

- Forgetting the `connection` block entirely when using `remote-exec` — Terraform has no default
  way to know how to SSH into the resource without it.
- Opening SSH (port 22) to `0.0.0.0/0` just to make a `remote-exec` provisioner work — a serious
  security regression compared to `user_data`, which needs no inbound access at all.
- Not setting `set -euo pipefail` (or equivalent) in `user_data`/`remote-exec` scripts — without
  it, a failed command partway through the script is silently ignored and the rest of the script
  keeps running against a half-configured machine.
- Using `remote-exec` when the only reason is "I need a value from another resource" — `user_data`
  can consume the exact same interpolated Terraform values via `templatefile()`.

---

## 5. Common Mistakes

- Treating provisioners as the default way to configure a new resource, rather than the last
  resort HashiCorp explicitly documents them as.
- Using `local-exec` for something that should be a `null_resource` with proper triggers, or
  better yet, a completely separate pipeline step outside Terraform altogether.
- Leaving `on_failure = continue` on provisioners that install functionally required software,
  masking real failures as successful applies.
- Assuming provisioner failures leave the infrastructure "as it was before" — a partially-run
  `remote-exec` script can leave a resource in an inconsistent state that Terraform state has no
  visibility into, since provisioner side effects aren't tracked.
- Forgetting that a failed provisioner (with default `on_failure = fail`) marks the resource
  **tainted**, meaning the next `apply` will destroy and recreate it — potentially disruptive if
  it's a production resource and the failure was actually a transient issue (e.g., a brief network
  blip during the SSH connection).
- Reaching for `remote-exec` in a private subnet with no bastion host, VPN, or Session Manager
  path — the provisioner will simply time out because the Terraform runner has no network route
  to the instance.

---

## 6. Hands-On Exercises

**Exercise 1 — Convert remote-exec to user_data**
Take a `remote-exec` provisioner that installs Docker and starts the Docker daemon on an EC2
instance, and rewrite it as an equivalent `user_data` script. List two concrete operational
benefits of the rewrite (connectivity, security group, state tracking).

**Exercise 2 — on_failure Reasoning**
You have a `remote-exec` provisioner that (a) installs a required application dependency, and (b)
sends an optional metrics ping to an internal dashboard. Write the two provisioner blocks with
the correct `on_failure` setting for each, and justify your choice for each one.

**Exercise 3 — Destroy-Time Provisioner**
Write a `when = destroy` provisioner that deregisters an EC2 instance from an internal service
registry via a `curl` call before it's terminated. Explain, in your own words, why this
provisioner block can only reference `self` and not another resource's attributes.

**Exercise 4 — Anti-Pattern Spotting**
Given a hypothetical config that opens SSH from `0.0.0.0/0` solely to run a `remote-exec`
provisioner that installs a package available via `user_data`, rewrite the whole resource to
remove the provisioner, the SSH security group rule, and the `connection` block entirely.

**Exercise 5 — Provisioner vs Config Management**
A team needs to install a web server on first boot (once) AND continuously enforce a specific
`nginx.conf` file even if someone manually edits it later (ongoing drift correction). Explain
which tool handles which half of this requirement and why Terraform provisioners are not suited
to the second half.

---

## 7. Interview Q&A

---

**Q1: What are the two most common Terraform provisioners, and where does each run?**

A: `local-exec` runs on the machine executing Terraform (your laptop or CI runner) — it never
touches the resource being created. `remote-exec` runs inside the remote resource itself, over
SSH or WinRM, requiring a `connection` block and network reachability from the Terraform runner to
the resource.

---

**Q2: Why does HashiCorp recommend provisioners only as a last resort?**

A: Provisioners operate outside Terraform's declarative state model. Terraform can't preview what
a provisioner will do during `plan`, can't detect drift in whatever the provisioner changed, and
can't safely and idempotently retry a partially-failed provisioner run. This breaks the core
guarantees that make the rest of Terraform predictable.

---

**Q3: What's the preferred alternative to `remote-exec` for bootstrapping an AWS EC2 instance?**

A: `user_data` — a cloud-init script that AWS runs automatically on first boot. It's a normal
resource attribute tracked in state, requires no SSH connectivity from the Terraform runner (so no
inbound security group rule for port 22 is needed), and can consume the same interpolated
Terraform values a `remote-exec` provisioner could, typically via `templatefile()`.

---

**Q4: What does `on_failure = continue` do, and when is it appropriate?**

A: It changes the default behavior (`fail`, which taints the resource and halts the apply) so that
a provisioner failure is logged as a warning but doesn't stop the apply. It's appropriate only for
genuinely optional steps whose failure shouldn't block deployment — never for a step the
application actually depends on.

---

**Q5: What is a `when = destroy` provisioner, and what's its key restriction?**

A: It's a provisioner that runs immediately before a resource is destroyed rather than after
creation — useful for graceful deregistration or shutdown steps. Its key restriction is that it
can only reference `self` (its own resource's attributes); it cannot reference other resources or
data sources, because by destroy time the rest of the dependency graph may already be tearing down.

---

**Q6: What happens if a create-time provisioner fails with the default settings?**

A: The resource is marked tainted, and the apply halts with an error. On the next `apply`, a
tainted resource is destroyed and recreated (its provisioners will run again on the new instance).

---

**Q7: How do provisioners compare to a configuration management tool like Ansible?**

A: Provisioners run once, at resource creation (or destruction), as a bolt-on step outside
Terraform's own state tracking — good at best for simple bootstrap actions with no cloud-native
alternative. Configuration management tools like Ansible are purpose-built for idempotent,
repeatable convergence — they can be re-run safely over a resource's entire lifetime to correct
drift, manage complex multi-step installs, and track their own state/inventory. For anything
beyond a one-time bootstrap, a dedicated configuration management tool is the right layer, not a
Terraform provisioner.
