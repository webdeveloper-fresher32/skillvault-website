# Push Force With Lease and SSH Authentication — Complete Guide

> "A biometric bank vault requires a private physical keycard that stays in your pocket and a public lock receptor embedded on the vault door, while the teller verifies that nobody else has deposited gold bars into the safe deposit box before permitting you to update your balance statement."

---

## Table of Contents

1. [The Problem: Secure Network Authentication and Safe Remote State Updates](#1-the-problem-secure-network-authentication-and-safe-remote-state-updates)
2. [The Biometric Bank Vault Keycard Analogy](#2-the-biometric-bank-vault-keycard-analogy)
3. [The Mechanism: Asymmetric Cryptography (SSH Ed25519) and Push Leases](#3-the-mechanism-asymmetric-cryptography-ssh-ed25519-and-push-leases)
4. [Diagram: SSH Handshake and git push --force-with-lease Verification](#4-diagram-ssh-handshake-and-git-push---force-with-lease-verification)
5. [CLI Walkthrough: Generating Ed25519 SSH Keys, SSH Config, and Safe Force-Pushing](#5-cli-walkthrough-generating-ed25519-ssh-keys-ssh-config-and-safe-force-pushing)
6. [Comparing SSH vs HTTPS vs Personal Access Tokens (PAT)](#6-comparing-ssh-vs-https-vs-personal-access-tokens-pat)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Secure Network Authentication and Safe Remote State Updates

Developers interact with remote servers daily. Two persistent issues cause severe disruption:
1. Entering passwords or managing expired Personal Access Tokens (PATs) over HTTPS.
2. Force-pushing rewritten branches (`git push -f`) and accidentally wiping out a colleague's commits that were pushed seconds earlier.

### The Security & Concurrency Challenge

```text
Challenge 1: Password-based Git over HTTPS was deprecated by GitHub; developers need zero-password secure SSH keys.
Challenge 2: `git push -f` is a blind overwrite (destructive race condition).
Solution: Modern Ed25519 SSH keys with `~/.ssh/config` + Atomic CAS leases with `--force-with-lease`.
```

### The Solution: SSH Ed25519 Keypairs and `--force-with-lease`

Elliptic Curve cryptography (Ed25519) provides high-performance, tamper-proof authentication without passwords. `--force-with-lease` ensures remote updates succeed only if the remote branch matches your expected local tracking reference.

---

## 2. The Biometric Bank Vault Keycard Analogy

A bank customer accesses a high-security safe deposit box.

### Private Keycard vs Bank Door Lock

```text
Private Key (`id_ed25519`)     → Stays securely in your wallet at all times; never revealed to the bank.
Public Key (`id_ed25519.pub`) → Installed inside the bank vault lock mechanism (GitHub).
The Transaction Lease         → The teller checks the vault ledger: "If the current balance is $100,
                                allow update to $120; if someone else deposited money, abort!"
```

### Mapping to Git Architecture

Your local private key signs the cryptographic challenge; GitHub checks your uploaded public key; `--force-with-lease` is the bank ledger balance check.

---

## 3. The Mechanism: Asymmetric Cryptography (SSH Ed25519) and Push Leases

How SSH authentication and push leases operate under the hood:

### SSH Public-Key Cryptography

1. **Key Generation**: Generates a 256-bit elliptic curve keypair (`Ed25519`).
2. **Challenge-Response**: During connection, GitHub encrypts a random challenge string with your public key; your local SSH agent signs it with your private key to prove identity without sending credentials across the wire.
3. **Multi-Account Host Routing**: Managed via `~/.ssh/config` using distinct Host aliases.

### Atomic Compare-and-Swap (`--force-with-lease`)

When you run `git push --force-with-lease origin feature`:
1. Git inspects your local `refs/remotes/origin/feature` commit SHA (e.g. `c1a2b3`).
2. Git queries the remote server's `refs/heads/feature` commit SHA over the network.
3. **If Remote SHA == Expected Local Tracking SHA (`c1a2b3`)**: Push succeeds!
4. **If Remote SHA != `c1a2b3` (Teammate pushed new commit `d4e5f6`)**: Push is rejected with `[rejected] (stale info)`.

---

## 4. Diagram: SSH Handshake and git push --force-with-lease Verification

### Secure Handshake and Lease Validation

```text
[Developer Machine]                                          [GitHub Server]
  ├── Private Key: `~/.ssh/id_ed25519`                         ├── Authorized Keys (`id_ed25519.pub`)
  └── Local `origin/feature` = `c1a2b3`                        └── Remote `feature` = `c1a2b3`
            │                                                             │
            │ 1. SSH Challenge Handshake (Cryptographically Verified!)    │
            │ ──────────────────────────────────────────────────────────▶ │
            │                                                             │
            │ 2. Push with Lease: "Update feature ONLY IF current is c1a2b3"
            │ ──────────────────────────────────────────────────────────▶ │
            │                                                             │
            │ 3. Remote evaluates: Is remote == c1a2b3? YES! ──▶ Updated! │
            │ ◀────────────────────────────────────────────────────────── │
```

---

## 5. CLI Walkthrough: Generating Ed25519 SSH Keys, SSH Config, and Safe Force-Pushing

A complete hands-on terminal guide to configuring enterprise SSH and lease workflows:

```bash
# 1. Generate modern high-security Ed25519 SSH keypair
ssh-keygen -t ed25519 -C "developer@company.com" -f ~/.ssh/id_ed25519_work -N ""

# 2. Start SSH agent and register the private key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519_work

# 3. Print the public key to add into GitHub Settings -> SSH Keys:
cat ~/.ssh/id_ed25519_work.pub
# Output: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... developer@company.com

# 4. Configure ~/.ssh/config for seamless multi-account management
cat << 'EOF' >> ~/.ssh/config
Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes

Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes
EOF

# 5. Test authentication with GitHub
ssh -T git@github.com
# Output: Hi username! You've successfully authenticated, but GitHub does not provide shell access.

# 6. Clone or update repository using SSH URL:
# git clone git@github.com:company/repo.git
# (Or with alias): git clone git@github-work:company/repo.git

# 7. Practice safe force-push with lease after rebasing:
git push --force-with-lease origin feature-branch
# Output: To github.com:company/repo.git
#         + 5f91a2b...8c91a0f feature-branch -> feature-branch (forced update)
```

---

## 6. Comparing SSH vs HTTPS vs Personal Access Tokens (PAT)

| Dimension | SSH (Ed25519) | HTTPS with PAT | HTTPS with Password |
|---|---|---|---|
| Security Level | **Highest (Elliptic Curve)** | High | Deprecated / Banned |
| Credential Expiration | Never expires (Managed locally) | Requires periodic renewal (30–90 days)| Banned |
| 2FA Compatibility | 100% Compatible | Requires PAT generation | Incompatible |
| Multi-Account Routing | Configured via `~/.ssh/config` | Complex credential managers | Incompatible |
| Firewall Friendliness | Uses Port 22 (Can use 443) | Standard Port 443 | Port 443 |

---

## 7. Common Mistakes

- **Using deprecated RSA 1024/2048 keys.** Always use modern `ed25519` keys (`ssh-keygen -t ed25519`).
- **Sharing the private key (`id_ed25519`).** The private key must never leave your local machine or be committed to Git.
- **Incorrect file permissions on `~/.ssh`.** SSH strictly requires `chmod 700 ~/.ssh` and `chmod 600 ~/.ssh/id_ed25519`.
- **Using `git push -f` instead of `--force-with-lease`.** Erases teammate commits during push race conditions.
- **Forgetting that `git fetch` before `--force-with-lease` neutralizes the check.** Running `fetch` updates your tracking ref to match remote, bypassing the lease check.

---

## 8. Hands-On Exercises

**Exercise 1:** Generate an Ed25519 SSH keypair and verify its fingerprint using `ssh-keygen -l -f ~/.ssh/id_ed25519`.

**Exercise 2:** Create a `~/.ssh/config` file configuring SSH multiplexing and identity routing.

**Exercise 3:** Test SSH authentication against GitHub using `ssh -Tv git@github.com`.

**Exercise 4:** Switch a repository remote URL from HTTPS to SSH using `git remote set-url origin git@github.com:org/repo.git`.

**Exercise 5:** Practice executing `git push --force-with-lease` on a rebased feature branch.

---

## 9. Interview Q&A

**Q: Why is Ed25519 preferred over RSA for Git SSH keypairs?**
Ed25519 uses Twisted Edwards Curve elliptic cryptography. It offers superior cryptographic security equivalent to a 3072-bit RSA key while using only a compact 256-bit key length, provides faster signature generation and verification times, and is naturally immune to side-channel timing attacks.

**Q: What is the exact mechanical difference between `git push --force` and `git push --force-with-lease`?**
`git push --force` (`-f`) forcefully overwrites the remote reference unconditionally, destroying any commits pushed by teammates. `git push --force-with-lease` performs an atomic compare-and-swap: it checks that the remote branch still points to the exact commit SHA recorded in your local remote-tracking reference (`origin/<branch>`). If a teammate has pushed new commits in the interim, Git aborts the push safely.

**Q: What permissions are required for the `~/.ssh` directory and private keys?**
SSH enforces strict Unix permission checks:
- `~/.ssh` directory: `700` (`drwx------`)
- Private key files (e.g. `~/.ssh/id_ed25519`): `600` (`-rw-------`)
- Public key files (`~/.ssh/id_ed25519.pub`): `644` (`-rw-r--r--`)
- `~/.ssh/config`: `600` or `644`

**Q: How do you configure Git to connect to multiple different GitHub accounts (e.g. Work and Personal) from the same laptop?**
In `~/.ssh/config`, create two distinct host aliases (`Host github-work` and `Host github-personal`) pointing to `HostName github.com`, each referencing its respective `IdentityFile`. In your repository remotes, use the custom alias (e.g. `git remote set-url origin git@github-work:company/repo.git`).

**Q: Why does GitHub reject HTTPS password authentication and require SSH or Personal Access Tokens?**
Passwords are vulnerable to brute-force attacks, phishing, credential stuffing, and cannot be scoped with granular permissions or automatic expiration dates. SSH keys and Personal Access Tokens provide cryptographic verification and fine-grained access control compatible with multi-factor authentication (2FA).
