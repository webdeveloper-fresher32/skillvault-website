# 02 — Installation & Setup

## Table of Contents

1. [Installing Terraform](#1-installing-terraform)
2. [Verifying Installation](#2-verifying-installation)
3. [Setting Up a Cloud Provider (AWS)](#3-setting-up-a-cloud-provider-aws)
4. [Your First `terraform init`](#4-your-first-terraform-init)
5. [Editor Tooling](#5-editor-tooling)
6. [Common Setup Mistakes](#6-common-setup-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Installing Terraform

You've decided to actually try Terraform. You open a terminal... and now what? Unlike a database
server, Terraform isn't something you install once and leave running as a daemon — it's a single
CLI binary you invoke on demand, much like `git`. That single fact simplifies installation
enormously: there's no service to start, no port to open, no background process to babysit.

### Analogy

Installing Terraform is like installing a word processor, not like installing a mail server. You
don't "run" Terraform in the background waiting for requests — you open it, do a specific task
(write/plan/apply), and close it. Contrast this with something like a MySQL server, which starts
as a long-running process the moment you install it.

### Installation by Platform

**macOS (via Homebrew — recommended)**

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

**macOS/Linux (via tfenv — a Terraform version manager, recommended for teams)**

Just like `nvm` manages Node.js versions, `tfenv` manages Terraform versions — critical once
you're juggling multiple projects pinned to different Terraform versions.

```bash
brew install tfenv          # macOS
# or on Linux:
git clone https://github.com/tfutils/tfenv.git ~/.tfenv
echo 'export PATH="$HOME/.tfenv/bin:$PATH"' >> ~/.bashrc

tfenv install 1.9.0         # install a specific version
tfenv use 1.9.0             # switch to it
tfenv list                  # see installed versions
```

**Linux (Debian/Ubuntu via HashiCorp's official apt repo)**

```bash
wget -O- https://apt.releases.hashicorp.com/gpg | \
  sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
  https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/hashicorp.list

sudo apt update && sudo apt install terraform
```

**Linux (RHEL/CentOS/Fedora via yum)**

```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo
sudo yum -y install terraform
```

**Windows (via Chocolatey)**

```powershell
choco install terraform
```

**Windows (via winget)**

```powershell
winget install HashiCorp.Terraform
```

**Manual install (any OS)** — download the correct zip for your OS/architecture from
`releases.hashicorp.com/terraform`, unzip it, and place the single `terraform` binary somewhere
on your `PATH` (e.g. `/usr/local/bin` on macOS/Linux).

### Under the Hood

```
┌───────────────────────────────────────────────────────────┐
│  terraform (single compiled Go binary, ~80-100 MB)          │
│                                                               │
│  Contains: Terraform Core only.                              │
│  Does NOT contain: provider plugins (aws, google, azurerm)    │
│  Providers are downloaded SEPARATELY per-project by           │
│  `terraform init`, based on what your .tf files require.      │
└───────────────────────────────────────────────────────────┘
```

This is worth internalizing early: installing "Terraform" only gets you the engine. It does not
download the AWS provider, the GCP provider, or any others — those are fetched later, per project,
by `terraform init` (section 4).

### Comparison: Package Manager vs Version Manager

| Approach | Good for | Downside |
|----------|----------|----------|
| **Homebrew / apt / choco** | Quick single-version setup, personal machines | Upgrading system-wide can break an old project pinned to an older Terraform version |
| **tfenv / asdf** | Teams with multiple projects, each pinned to a specific Terraform version via `.terraform-version` | One extra tool to install first |

### Common Confusion

People sometimes expect `terraform install` or a service to start after installing, similar to
installing a database or web server. There is none — Terraform has no daemon and no persistent
process. Every command (`init`, `plan`, `apply`) is a single, self-contained invocation that
starts, does its work, and exits.

### Interview Answer

"Terraform ships as a single statically-compiled binary with no background daemon — you install
it the same way you'd install `git`, typically via a package manager like Homebrew, apt, or
Chocolatey, or a version manager like tfenv if you need to pin different Terraform versions per
project. The binary only contains Terraform Core; provider plugins for AWS, GCP, etc. are
downloaded separately per project when you run `terraform init`."

> **Memory hook:** Terraform installs like a word processor, not a mail server — no background service, just a tool you open, use, and close.

---

## 2. Verifying Installation

You just ran an install command. Before writing a single line of HCL, you want a fast sanity
check that it actually landed on your `PATH` and is a version you expect — because "command not
found" or a silently ancient cached version are two of the most common first-hour frustrations.

### Analogy

This is exactly like checking `git --version` right after installing Git — a five-second command
that either confirms you're ready to go, or immediately reveals a `PATH` problem before you waste
time debugging something unrelated.

### The Commands

```bash
terraform -version
```

```
Terraform v1.9.0
on darwin_arm64
```

If you have provider plugins already cached from a previous project, `-version` will also list
them:

```
Terraform v1.9.0
on darwin_arm64
+ provider registry.terraform.io/hashicorp/aws v5.55.0
```

Also useful immediately after install:

```bash
which terraform          # confirm which binary is being used (macOS/Linux)
terraform -help          # see all available subcommands
```

### Under the Hood

```
$ terraform -version
       │
       ▼
Shell looks up "terraform" in each directory listed in $PATH, in order,
and executes the FIRST match it finds.
       │
       ▼
If tfenv is installed, $PATH points to a tfenv shim first, which then
resolves to whichever version `tfenv use` last activated.
```

This matters because a common bug is: you `tfenv install 1.9.0` and `tfenv use 1.9.0`, but
`terraform -version` still reports an old Homebrew-installed version — because Homebrew's
`/usr/local/bin/terraform` appears earlier in `$PATH` than tfenv's shim.

### Common Mistakes

- **Installing via two different methods** (e.g. Homebrew *and* manual download) and then being
  confused about which one actually runs — `which terraform` resolves this instantly.
- **Forgetting to restart the shell** after adding `tfenv` to `PATH` in `.bashrc`/`.zshrc` — the
  current terminal session won't pick up the change until you open a new one or `source` the
  file.
- **Assuming a version mismatch is a bug in Terraform** when it's actually just an old cached
  binary earlier in `PATH`.

### Interview Answer

"After installing, `terraform -version` confirms both that the binary is correctly on your PATH
and which exact version you're running — important because Terraform configuration syntax and
behavior can change subtly between major versions, and CI pipelines should pin an exact version to
avoid surprises."

> **Memory hook:** `terraform -version` is your five-second "is the printer actually plugged in" check before you start printing anything important.

---

## 3. Setting Up a Cloud Provider (AWS)

You've got Terraform installed. Now you tell it: "go create things in AWS." But Terraform has no
built-in AWS account — it needs credentials, exactly the same way the AWS CLI or the AWS SDK does.
Without valid credentials sitting somewhere Terraform can find them, every `apply` will fail with
an authentication error before it even attempts to create anything.

### Analogy

Think of the AWS provider block in your `.tf` file as a delivery address ("send this to
us-east-1"), and your AWS credentials as the ID badge that proves you're allowed to walk into that
building at all. You need both: an address with no ID gets you turned away at the door, and an ID
with no address means the courier doesn't know where to go.

### Installing and Configuring the AWS CLI (recommended first step)

```bash
# macOS
brew install awscli

# verify
aws --version
```

```bash
aws configure
```

```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

This writes credentials to `~/.aws/credentials` and config to `~/.aws/config` — files Terraform's
AWS provider knows how to read automatically, with zero extra configuration.

### The Provider Block

```hcl
# providers.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5.0"
}

provider "aws" {
  region = "us-east-1"
}
```

### Under the Hood: Credential Resolution Order

When Terraform's AWS provider needs credentials, it checks several places, in a defined priority
order — understanding this order is essential for debugging "why is it using the wrong account?":

```
1. Explicit credentials in the provider block (access_key/secret_key — NOT recommended, never commit these)
                            │  not found? check next
                            ▼
2. Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
                            │
                            ▼
3. Shared credentials file: ~/.aws/credentials (written by `aws configure`)
                            │
                            ▼
4. Shared config file: ~/.aws/config (supports named profiles, SSO, assumed roles)
                            │
                            ▼
5. EC2/ECS/Lambda instance metadata / container credentials
   (when Terraform itself runs INSIDE AWS, e.g. in a CI runner on EC2)
```

### Example: Named Profiles

If you manage multiple AWS accounts (personal, staging, production), use named profiles instead
of overwriting default credentials:

```bash
aws configure --profile staging
```

```hcl
provider "aws" {
  region  = "us-east-1"
  profile = "staging"
}
```

### Common Mistakes

- **Hardcoding `access_key`/`secret_key` directly in a `.tf` file** — this is a serious security
  risk if that file is ever committed to a public (or even private) git repository; secrets
  leaked this way are routinely scraped by bots within minutes. Always use environment variables,
  the shared credentials file, or a secrets manager instead.
- **Forgetting to set a region** — some resources will fail with an unclear error if no region is
  resolvable from any source.
- **Using long-lived root account access keys** — best practice is an IAM user (or better, IAM
  role with temporary credentials via SSO/assume-role) with only the permissions Terraform
  actually needs, never the root account.

### Interview Answer

"Terraform's AWS provider doesn't store credentials itself — it resolves them at runtime from a
defined priority chain: explicit provider block values, environment variables, the shared
`~/.aws/credentials` file, the `~/.aws/config` file for named profiles or SSO, and finally
instance metadata if Terraform is running on an EC2 instance or in a CI runner with an attached
IAM role. Best practice is to never hardcode credentials in `.tf` files and to use short-lived
credentials via IAM roles wherever possible."

> **Memory hook:** The provider block is the delivery address; your AWS credentials are the ID badge — Terraform needs both before it's allowed through the door.

---

## 4. Your First `terraform init`

You've written a `providers.tf` declaring you need the AWS provider. But right now, that's just a
promise in a text file — Terraform hasn't actually gone and fetched the AWS provider plugin yet.
`terraform init` is the command that turns that promise into reality: it downloads everything a
project needs before it can plan or apply anything.

### Analogy

`terraform init` is like `npm install` for a Node.js project, or `pip install -r requirements.txt`
for Python. Your `package.json`/`requirements.txt` (here, your `.tf` files) *declares* what you
need; the install command actually goes and fetches those specific dependencies into a local
folder before anything can run.

### Running It

```
my-project/
├── main.tf
└── providers.tf
```

```bash
cd my-project
terraform init
```

```
Initializing the backend...

Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.55.0...
- Installed hashicorp/aws v5.55.0 (signed by HashiCorp)

Terraform has created a lock file .terraform.lock.hcl to record the provider
selections it made above. Include this file in your version control repository
so that Terraform can guarantee to make the same selections by default when
you run "terraform init" in the future.

Terraform has been successfully initialized!
```

### Under the Hood

```
┌────────────────────────────────────────────────────────────────┐
│  BEFORE terraform init                                           │
│  my-project/                                                      │
│  ├── main.tf                                                      │
│  └── providers.tf   (declares "I need hashicorp/aws ~> 5.0")      │
└────────────────────────────┬─────────────────────────────────────┘
                             │  terraform init
                             ▼
┌────────────────────────────────────────────────────────────────┐
│  AFTER terraform init                                             │
│  my-project/                                                      │
│  ├── main.tf                                                      │
│  ├── providers.tf                                                 │
│  ├── .terraform/                                                  │
│  │   └── providers/                                               │
│  │       └── registry.terraform.io/hashicorp/aws/5.55.0/...       │
│  │           (the actual downloaded provider binary)               │
│  └── .terraform.lock.hcl   (pins EXACT version + checksums)       │
└────────────────────────────────────────────────────────────────┘
```

What `init` actually does, in order:
1. **Backend initialization** — sets up where state will be stored (local file by default, or a
   remote backend like S3 if configured — covered in a later phase).
2. **Provider installation** — reads every `required_providers` block across your `.tf` files,
   resolves version constraints, downloads the matching plugin binaries from the Terraform
   Registry into `.terraform/providers/`.
3. **Lock file creation** — writes `.terraform.lock.hcl`, recording the *exact* provider version
   and cryptographic checksums selected, so future `init` runs (by you or a teammate, or in CI)
   install the identical version rather than silently drifting to a newer one.
4. **Module installation** — if your config references any Terraform modules, downloads those
   too.

### Comparison: When You Must Re-run `init`

| Situation | Re-run `init`? |
|-----------|---------------|
| First time running Terraform in this directory | Yes — required |
| Added or changed a `required_providers` block | Yes |
| Added a new module source | Yes |
| Just changed a resource's arguments (e.g. `instance_type`) | No — `plan`/`apply` alone is enough |
| Switched to a different backend configuration | Yes (`terraform init -reconfigure` or `-migrate-state`) |

### Common Mistakes

- **Deleting `.terraform.lock.hcl` and not committing it to git** — without the lock file, a
  teammate (or CI) running `init` later might resolve a newer provider version with subtly
  different behavior, breaking reproducibility. Always commit `.terraform.lock.hcl`.
- **Committing the `.terraform/` directory itself** — this holds large downloaded binaries and is
  meant to be regenerated by `init` on every machine; it should be in `.gitignore`, unlike the
  lock file.
- **Running `apply` without ever running `init`** — Terraform will immediately error, telling you
  no provider is installed; this is one of the first errors every beginner sees.

### Interview Answer

"`terraform init` prepares a working directory for use: it initializes the backend that will
store state, downloads the provider plugins referenced in `required_providers` blocks, downloads
any referenced modules, and writes a `.terraform.lock.hcl` file that pins exact provider versions
and checksums for reproducibility. It must be run once per project before `plan` or `apply`, and
again whenever provider requirements, modules, or the backend configuration change."

> **Memory hook:** `terraform init` is `npm install` for your infrastructure — it turns a wishlist of dependencies in your files into actual downloaded plugins on disk.

---

## 5. Editor Tooling

Writing HCL in a plain text editor with no syntax highlighting is like writing Python in
Notepad — technically possible, painfully error-prone. A misplaced brace or a typo in a resource
type won't be caught until you run `plan`, several seconds (and a network round-trip) later.
Editor tooling catches a huge class of mistakes instantly, as you type.

### Analogy

The Terraform VS Code extension is spellcheck-plus-autocomplete for your infrastructure code — it
underlines syntax errors in red before you even save, and suggests valid argument names for
`aws_instance` the same way your editor suggests valid method names on a Python object.

### Setup

**VS Code**

1. Install the official **HashiCorp Terraform** extension from the VS Code Marketplace
   (publisher: HashiCorp).
2. It provides: syntax highlighting, autocomplete for resource/provider schemas, inline
   validation, and hover documentation for arguments.
3. Enable format-on-save so every file is auto-normalized to canonical HCL style:

```json
// .vscode/settings.json
{
  "[terraform]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "hashicorp.terraform"
  },
  "[terraform-vars]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "hashicorp.terraform"
  }
}
```

**Command-line formatting (works regardless of editor)**

```bash
terraform fmt              # rewrites files in current directory to canonical style
terraform fmt -recursive   # rewrites files in all subdirectories too
terraform fmt -check       # exits non-zero if any file is NOT formatted (useful in CI)
```

### Under the Hood

```
You type:                          terraform fmt rewrites to:
resource "aws_instance"   "web" {   resource "aws_instance" "web" {
    ami= "ami-123"                    ami           = "ami-123"
  instance_type = "t3.micro"          instance_type = "t3.micro"
}                                   }
```

`terraform fmt` aligns `=` signs, fixes indentation, and normalizes spacing — purely cosmetic, but
it means every engineer's diffs look identical regardless of how they typed the file, which keeps
code review diffs focused on actual logic changes rather than whitespace noise.

### Common Mistakes

- **Skipping `terraform fmt` and letting inconsistent styles pile up** — this makes every pull
  request diff noisy with unrelated whitespace changes, obscuring the actual logic change a
  reviewer needs to see.
- **Relying only on `terraform plan` to catch typos** — this works, but costs a network round
  trip and API calls for what a linter would catch instantly and for free. Editor tooling (or
  `terraform validate`, which checks syntax and internal consistency without touching any cloud
  API) should be your first line of defense.
- **Not enabling format-on-save** — small manual `terraform fmt` runs are easy to forget before a
  commit; automating it removes the decision entirely.

### Interview Answer

"The official HashiCorp Terraform VS Code extension gives syntax highlighting, schema-aware
autocomplete, and inline validation. Beyond the editor, `terraform fmt` canonicalizes formatting
across a team so diffs stay focused on substantive changes, and `terraform validate` checks
configuration syntax and internal consistency without making any API calls — both are commonly
wired into pre-commit hooks or CI so style and basic correctness issues are caught before a
teammate ever has to review them."

> **Memory hook:** Editor tooling is spellcheck for infrastructure — it catches the typo before the API call does.

---

## 6. Common Setup Mistakes

A quick catalog of the mistakes that eat up the first hour for almost everyone new to Terraform —
recognizing them immediately saves real debugging time.

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Never ran `terraform init` | `Error: Inconsistent dependency lock file` or "no provider found" on first `plan` | Run `terraform init` before any other command |
| No AWS credentials configured | `Error: no valid credential sources found` on `plan`/`apply` | Run `aws configure` or set `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env vars |
| Wrong AWS region assumed | Resources created in an unexpected region, or "AMI not found" errors (AMI IDs are region-specific) | Set `region` explicitly in the `provider "aws"` block |
| Committed `.terraform.lock.hcl` to `.gitignore` by mistake | Teammates silently get different provider versions | Only ignore `.terraform/`, never the lock file |
| Multiple Terraform installs conflicting (Homebrew + tfenv + manual) | `terraform -version` shows an unexpected/old version | Use `which terraform` to find the active binary; standardize on one install method, preferably tfenv |
| Editing `.tf` files but expecting infra to change automatically | Nothing happens after saving a file | Terraform only acts when you explicitly run `plan`/`apply` — it is not a file watcher |
| Hardcoded secrets in `.tf` files, committed to git | Leaked AWS keys, sometimes exploited within minutes on public repos | Use env vars, shared credentials file, or a secrets manager; add a `.gitignore` for anything with credentials |

### Interview Answer

"The most common first-hour Terraform mistakes are forgetting to run `terraform init` before
anything else, not having AWS credentials configured anywhere Terraform can find them, and
accidentally excluding `.terraform.lock.hcl` from version control which lets teammates silently
drift onto different provider versions. All three produce clear, specific error messages, so
reading the actual error text — rather than guessing — resolves them quickly."

> **Memory hook:** Ninety percent of "Terraform isn't working" issues are really "I forgot init" or "I forgot credentials" — read the error message before assuming a deeper bug.

---

## 7. Hands-On Exercises

**Exercise 1 — Install and Verify**
Install Terraform using the method appropriate for your OS (prefer tfenv if you expect to work on
multiple projects). Run `terraform -version` and paste the output. Then run `which terraform` (or
`where terraform` on Windows) and confirm it points to the binary you expect.

**Exercise 2 — AWS Credential Setup**
Install the AWS CLI, run `aws configure`, and set up a named profile called `sandbox` instead of
overwriting your default profile. Write the `provider "aws"` block you'd use to point Terraform
at that `sandbox` profile.

**Exercise 3 — First Init**
Create a new directory with a `providers.tf` requiring `hashicorp/aws` version `~> 5.0`. Run
`terraform init` and inspect the resulting `.terraform/` directory and `.terraform.lock.hcl` file.
What provider version did it actually resolve to?

**Exercise 4 — Credential Resolution Order**
You have `AWS_ACCESS_KEY_ID` set as an environment variable AND a `~/.aws/credentials` file with
different keys. Which one wins when Terraform runs? Why does this ordering make sense for CI
pipelines?

**Exercise 5 — Formatting Discipline**
Deliberately write a `main.tf` with inconsistent spacing and misaligned `=` signs. Run
`terraform fmt` on it and diff the before/after. Then run `terraform fmt -check` and observe its
exit code — how would you wire this into a CI pipeline to enforce formatting on every pull
request?

---

## 8. Interview Q&A

---

**Q1: Does Terraform run as a background service after installation?**

A: No. Terraform is a single CLI binary with no daemon or persistent process. Every command —
`init`, `plan`, `apply`, `destroy` — is a standalone invocation that runs and exits; there is
nothing to "start" or "stop" after installation, unlike a database or web server.

---

**Q2: What does the Terraform binary itself actually contain?**

A: Only Terraform Core — the HCL parser, dependency graph engine, and plan/apply logic. It does
not contain any provider plugins (AWS, GCP, Azure, etc.). Those are separate binaries downloaded
per-project by `terraform init`, based on the `required_providers` block in your configuration.

---

**Q3: How does Terraform's AWS provider find credentials if you don't put them in the provider block?**

A: It checks, in priority order: explicit values in the provider block, environment variables
(`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`), the shared `~/.aws/credentials` file (populated by
`aws configure`), the `~/.aws/config` file for named profiles or SSO, and finally instance
metadata if Terraform itself is running on an EC2 instance, ECS task, or Lambda with an attached
IAM role.

---

**Q4: What does `terraform init` actually do?**

A: It initializes the backend (where state will be stored), downloads the provider plugins
referenced in `required_providers` blocks, downloads any referenced modules, and writes a
`.terraform.lock.hcl` file pinning the exact provider versions and checksums selected, so future
`init` runs reproduce the same versions rather than drifting.

---

**Q5: Why should `.terraform.lock.hcl` be committed to git but `.terraform/` should not?**

A: `.terraform.lock.hcl` is small, human-readable, and records exactly which provider versions
were selected — committing it ensures every teammate and every CI run resolves the identical
provider version. `.terraform/` contains the actual downloaded provider binaries, which are large,
platform-specific, and trivially regenerated by running `init` again; committing them bloats the
repo for no benefit.

---

**Q6: What's the risk of hardcoding AWS access keys directly in a `.tf` file?**

A: If that file is ever committed to git — even to a private repo that later becomes public, or
is exposed by a misconfigured CI log — the credentials are exposed and can be exploited within
minutes by automated scrapers. Best practice is to never write credentials directly into
configuration; use environment variables, the AWS shared credentials file, or a secrets manager,
and prefer short-lived credentials via IAM roles over long-lived access keys entirely.

---

**Q7: What is `terraform fmt` and why does it matter for teams?**

A: `terraform fmt` rewrites `.tf` files into Terraform's canonical formatting style — aligning
`=` signs, fixing indentation and spacing. It matters because it keeps every engineer's code
visually consistent regardless of how they typed it, which keeps pull request diffs focused on
actual logic changes instead of unrelated whitespace noise. `terraform fmt -check` (non-zero exit
if anything is unformatted) is commonly wired into CI to enforce this automatically.

---

**Q8: What's the difference between `terraform fmt` and `terraform validate`?**

A: `terraform fmt` only fixes cosmetic style (spacing, alignment) and never changes logic.
`terraform validate` checks that the configuration is syntactically valid HCL and internally
consistent (e.g., no reference to an undefined variable) without contacting any cloud provider's
API — it catches a class of errors instantly and for free, before you'd otherwise discover them
via a slower `terraform plan`.

---

**Q9: If you edit a `.tf` file and save it, does your real infrastructure change immediately?**

A: No. Terraform never watches files or reacts automatically — it only acts when you explicitly
run a command like `terraform plan` or `terraform apply`. Editing a file only changes the desired
state description; nothing happens to real infrastructure until you deliberately run a Terraform
command against it.

---

**Q10: When do you need to re-run `terraform init` after the first time?**

A: Whenever you add or change a `required_providers` entry, add a new module source, or change
backend configuration (in which case you typically also need `-reconfigure` or `-migrate-state`).
Simply changing a resource's argument values does not require re-running `init` — `plan` and
`apply` alone will pick those up.
