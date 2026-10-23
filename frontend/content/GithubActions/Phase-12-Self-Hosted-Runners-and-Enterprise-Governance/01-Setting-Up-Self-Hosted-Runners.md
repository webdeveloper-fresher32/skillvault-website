# Setting Up Self-Hosted Runners

Every workflow so far has run on `runs-on: ubuntu-latest` (or `windows-latest` / `macos-latest`) — a fresh, GitHub-managed VM, provisioned clean for one job and destroyed the moment it finishes. A self-hosted runner is the opposite: a machine you provision yourself, running the GitHub Actions runner application, that polls GitHub for jobs targeted at a specific repository, organization, or enterprise. This lesson covers why teams reach for one, how registration actually works, and the security responsibility that comes with owning the machine.

## 1. Why Self-Hosted Runners Exist

A GitHub-hosted runner can't reach a service inside a private corporate network unless that service is exposed to the internet. It can't offer hardware GitHub doesn't sell time on — a specific GPU model, an ARM chip, a device attached over USB. Its CPU/RAM tier is fixed to whatever GitHub's hosted tiers offer, and at high build volume, paying per-minute for hosted compute gets expensive compared to running the same job on hardware the org already owns. A self-hosted runner solves all three, at the cost of GitHub no longer owning the machine's security.

```
GitHub-hosted runner                Self-hosted runner
---------------------                ------------------
Fresh VM per job                     Same machine, run after run
GitHub patches/isolates it           You patch/isolate it
Fixed hardware tiers                 Any hardware you provision
No reach into private network        Full reach into whatever network it sits on
Billed per minute                    Cost of owning/running the box
```

## 2. Registering a Runner

Registration happens from the repository, organization, or enterprise settings page (Settings → Actions → Runners → "New self-hosted runner"), which generates a short-lived registration token tied to that specific scope. The token authorizes one registration action and expires quickly — it is not a long-lived credential and is not the credential the runner uses afterward.

```bash
# 1. Create a directory and download the runner package
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.319.1.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-x64-2.319.1.tar.gz

# 2. Extract the installer
tar xzf ./actions-runner-linux-x64-2.319.1.tar.gz

# 3. Configure the runner (registers it against a specific repo, with a token from
#    Settings -> Actions -> Runners -> New self-hosted runner)
./config.sh --url https://github.com/your-org/your-repo --token AXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

`config.sh` uses the token to register the machine's identity for that specific scope, prompts interactively for a runner name, working directory, and any labels, and writes the resulting configuration — including a runner-specific credential it generates for ongoing communication — to local files on disk. Nothing here is executed against a live GitHub org in this course: the registration token is single-use and tied to a specific repository/org, so it can't be replayed from a lesson file. The sequence itself (download → extract → `config.sh` with a fresh token) is the real, current flow GitHub's own "New self-hosted runner" setup page generates, version number aside.

## 3. Starting the Runner

```bash
# Run in the foreground (for a one-off or testing) ...
./run.sh

# ...or install and start it as a persistent background service
sudo ./svc.sh install
sudo ./svc.sh start
```

`./run.sh` starts the runner listening for jobs — it polls GitHub for work targeted at its repository/org and labels, picks up a job when one matches, and executes it directly on this machine's filesystem and OS, with whatever tools, credentials, and network access this specific machine happens to have. Running it this way ties the runner's lifetime to that terminal session — closing it stops the runner. `svc.sh install` registers it as an OS-level service that survives logout and reboot, which is what a runner meant to stay available actually needs.

## 4. The Public-Repo Security Risk

On a private repo, only people the org has already granted access to can trigger jobs on the runner — the "who can execute code here" question stays bounded to a trusted set. On a public repo, anyone who can open a pull request can potentially get a workflow to run on that self-hosted machine, because public repos accept forks and PRs from strangers by default. A stranger's PR can craft a workflow change that executes arbitrary code on infrastructure the org controls, unless the org has deliberately restricted which workflows can even reach the runner.

```
Private repo:  trusted org members  ──▶  can trigger jobs  ──▶  runner
Public repo:   any stranger with a PR ──▶  can potentially trigger jobs ──▶ runner
```

Phase 11 covers the closely related `pull_request_target`-with-untrusted-code risk; this is the self-hosted-runner version of the same underlying problem — untrusted code getting more trust (here, a real machine) than it should.

## 5. Runner Machine as NOT Ephemeral (Your Responsibility)

A GitHub-hosted job gets a brand-new VM every time; a self-hosted job runs on the same machine, same filesystem, same installed tooling as the job before it. Unless you've deliberately rebuilt that guarantee — re-imaging between jobs, running each job in a fresh container — a file, credential, or artifact left behind by one workflow can silently be visible to a completely unrelated workflow's job later. Nothing about the runner application resets the machine for you between runs.

## Comparison

| Aspect | GitHub-hosted runner | Self-hosted runner |
|---|---|---|
| Provisioning | GitHub-managed, on demand | You provision the machine |
| Isolation between jobs | Fresh VM every run | Same machine reused unless you rebuild it yourself |
| Hardware/OS | Fixed hosted tiers | Any hardware/OS you choose |
| Private network access | None unless exposed publicly | Full access to whatever network the box sits on |
| Patching/security | GitHub's responsibility | Your responsibility entirely |
| Cost model | Per-minute hosted billing | Cost of owning/operating the machine |
| Risk on a public repo | Low — ephemeral, isolated VM | High — any PR author can potentially execute code on it |

## Common Mistakes

- **Registering a self-hosted runner against a public repository without understanding the risk.** GitHub explicitly warns against this: on a public repo, anyone who can open a pull request can craft a workflow change that runs on that runner, unless workflows reaching it are deliberately restricted.
- **Treating the runner machine as ephemeral when it isn't.** Unless you've rebuilt that guarantee yourself, a self-hosted runner reuses the same filesystem, cache, and installed state across unrelated runs.
- **Never rotating or patching the runner's host OS.** Because GitHub isn't provisioning this machine, nothing patches it automatically — an unpatched self-hosted runner is a long-lived, network-connected machine running arbitrary CI-triggered code.
- **Storing the registration token or reusing it across multiple machines.** The token is meant to be generated per-registration and used immediately, not treated like a durable shared secret.
- **Assuming a self-hosted runner needs an inbound network port open.** The runner only needs outbound HTTPS access to poll GitHub for jobs — no inbound port is needed or should be opened.

## Hands-On Exercises

1. On a spare Linux VM (or a disposable container/VM you control), download the current runner package from a repo's Settings → Actions → Runners → "New self-hosted runner" page, extract it, and run `./config.sh` with the generated URL and token. Confirm the runner shows as "Idle" on the repo's Runners settings page.
2. Trigger a workflow with `runs-on: self-hosted` against that repo and watch it execute on your registered machine instead of a GitHub-hosted VM. Confirm the job log shows the runner's own hostname/OS details.
3. Stop the foreground `./run.sh` process (Ctrl+C), then install it as a service with `sudo ./svc.sh install && sudo ./svc.sh start`. Reboot the machine and confirm the runner comes back online automatically without you running anything by hand.
4. Run one workflow that writes a file one directory above its own checkout (e.g., `echo "leftover" > ../leftover.txt`, landing it in the runner's shared `_work` tree rather than inside that job's own checkout), then run a second, unrelated workflow on the same runner that checks whether `../leftover.txt` exists. Confirm it does — demonstrating the non-ephemeral state directly rather than just taking the claim on faith.
5. Attempt to register the same runner a second time using the original registration token from Exercise 1. Confirm it fails (token already used/expired), illustrating why the token can't be treated as a reusable credential.

## Interview Q&A

**Q: When would you choose a self-hosted runner over a GitHub-hosted one?**
A: When the job needs something hosted runners can't provide — access to resources on a private network, hardware GitHub doesn't offer (a specific GPU, specialized architecture), or lower cost at high enough build volume that per-minute hosted pricing stops being competitive with owned hardware.

**Q: What's the security trade-off of self-hosted runners?**
A: GitHub-hosted runners give you a fresh, isolated, disposable VM per job for free. A self-hosted runner gives that up — you now own patching, network isolation, and ensuring one job's leftovers can't affect the next job's run.

**Q: Why is it risky to register a self-hosted runner against a public repository?**
A: Anyone who can open a pull request against a public repo can potentially get a workflow to execute on that runner, since public repos accept PRs from strangers by default — a stranger's PR can run arbitrary code on infrastructure the org controls.

**Q: Does a self-hosted runner need any inbound network access?**
A: No — it only needs outbound HTTPS access to poll GitHub for jobs. Opening inbound ports is unnecessary and adds risk.

**Q: Is a self-hosted runner's filesystem reset between jobs the way a hosted runner's is?**
A: No — unless you deliberately rebuild that guarantee (re-imaging, running each job in a fresh container), the same filesystem, cache, and installed state persist across unrelated jobs.
