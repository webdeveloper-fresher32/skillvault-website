# Commit Signing with GPG and SSH Keys — Complete Guide

> "A medieval royal decree bears the king's unique wax signet ring pressed into warm red wax; any messenger carrying a decree without the genuine unbroken wax seal is recognized instantly as an imposter delivering counterfeit orders."

---

## Table of Contents

1. [The Problem: Identity Spoofing and Unauthenticated Git Commits](#1-the-problem-identity-spoofing-and-unauthenticated-git-commits)
2. [The Royal Wax Signet Seal Analogy](#2-the-royal-wax-signet-seal-analogy)
3. [The Mechanism: Asymmetric Commit Signature Embedding and GitHub Verification](#3-the-mechanism-asymmetric-commit-signature-embedding-and-github-verification)
4. [Diagram: Commit Signing and Verification Architecture](#4-diagram-commit-signing-and-verification-architecture)
5. [CLI Walkthrough: Configuring SSH / GPG Commit Signing and Verifying Signatures](#5-cli-walkthrough-configuring-ssh--gpg-commit-signing-and-verifying-signatures)
6. [Comparing SSH Key Signing vs GPG Key Signing vs S/MIME](#6-comparing-ssh-key-signing-vs-gpg-key-signing-vs-smime)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Identity Spoofing and Unauthenticated Git Commits

By default, Git provides zero cryptographic authentication for the author field. Anyone can run:
`git -c user.name="Linus Torvalds" -c user.email="torvalds@linux-foundation.org" commit -m "malicious backdoor"`
When pushed to GitHub, GitHub displays Linus Torvalds' face and profile link next to the malicious commit!

### The Commit Spoofing Vulnerability

```text
Attacker Terminal:
  `git -c user.email="ceo@company.com" commit -m "Delete security audits"`
GitHub UI View:
  Shows CEO's avatar and verified profile link beside the commit! (Tainted trust!)
```

### The Solution: Cryptographic Commit Signing (SSH & GPG)

Git allows developers to cryptographically sign every commit using private GPG or SSH keys. GitHub verifies the signature against the developer's registered public key, awarding the green **Verified** badge.

---

## 2. The Royal Wax Signet Seal Analogy

A king issues binding land ownership charters to provincial dukes.

### Forged Signature vs Wax Signet Impression

```text
Unsigned Commit (Forged Document) → Anyone with a fountain pen can write "From: King Edward" at the bottom.
Signed Commit (Embossed Seal)     → The king stamps his custom engraved gold signet ring into melted wax.
                                    The wax contains microscopic unique fissures that cannot be replicated.
GitHub Verification Badge         → The duke compares the wax impression with the official royal seal stamp.
```

### Mapping to Git Architecture

The king's signet ring is your private signing key; the royal registry is GitHub's public key database; the green Verified badge is the validated seal.

---

## 3. The Mechanism: Asymmetric Commit Signature Embedding and GitHub Verification

How Git stores cryptographic signatures inside commit objects:

### Inside the Signed Commit Object

When you commit with `-S`:
1. Git formats the commit object header, tree SHA, parent SHA, author timestamp, and message.
2. Computes the SHA-256 hash of this payload.
3. Encrypts/signs the hash using your **Private Signing Key**.
4. Appends a multi-line `gpgsig` header directly inside the raw commit object!

### Format of `gpgsig` in Raw Commit

```text
tree 8a192fc3b4...
parent 5f91a2b8c...
author Alice <alice@dev.com> 1700000000 +0000
committer Alice <alice@dev.com> 1700000000 +0000
gpgsig -----BEGIN SSH SIGNATURE-----
 U1NIU0lHAAAA...
 -----END SSH SIGNATURE-----

feat: secure core authentication module
```

---

## 4. Diagram: Commit Signing and Verification Architecture

### Cryptographic Verification Flow

```text
[Developer Machine]
  1. Commit Payload (Tree + Parents + Message)
            │
            ▼ (Sign with Private Key `~/.ssh/id_ed25519.pub`)
  2. Embed `gpgsig` inside Commit Object
            │
            ▼ `git push origin main`
[GitHub Remote Server]
  3. Extract `gpgsig` from Commit Object
            │
            ▼ (Validate signature against Developer's Uploaded Public Key)
  4. Signature Valid & Email Matches?
       ├── YES ──▶ [Green "Verified" Badge Rendered] ✅
       └── NO  ──▶ [Unverified or Spoofed Warning] ⚠️
```

---

## 5. CLI Walkthrough: Configuring SSH / GPG Commit Signing and Verifying Signatures

A complete terminal walkthrough configuring modern SSH key commit signing (Git 2.34+):

```bash
# 1. Initialize playground repository
mkdir signing_lab && cd signing_lab
git init

# 2. Modern Approach: Use existing Ed25519 SSH key for commit signing!
# (No need for complex GPG tools; Git 2.34+ natively supports SSH signing!)
ssh-keygen -t ed25519 -C "developer@company.com" -f ~/.ssh/id_signing_key -N ""

# 3. Configure Git to use SSH signing format globally
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_signing_key.pub
git config --global commit.gpgsign true # Auto-sign every commit!
git config --global tag.gpgsign true    # Auto-sign every tag!

# 4. Create and automatically sign a commit
echo "Secure System Architecture" > security.txt
git add security.txt
git commit -m "feat(sec): implement zero-trust authentication"
# Git prompts SSH agent and embeds cryptographic signature!

# 5. Verify commit signature locally using git log --show-signature
git log --show-signature -n 1
# Output:
# Good "ssh" signature for developer@company.com with ED25519 key ...
# commit 5f91a2b...
# Author: developer@company.com

# 6. Configure allowed signers file for local team signature verification
echo "developer@company.com $(cat ~/.ssh/id_signing_key.pub)" > ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers

# 7. Upload the signing key to GitHub:
# Go to GitHub -> Settings -> SSH and GPG keys -> New SSH Key -> Key type: "Signing Key"!
```

---

## 6. Comparing SSH Key Signing vs GPG Key Signing vs S/MIME

| Dimension | SSH Key Signing (Modern Git 2.34+) | GPG Key Signing (Legacy/Classic) | S/MIME |
|---|---|---|---|
| Setup Simplicity | **Extremely Simple (Uses SSH keys)**| Complex (`gpg`, `gpg-agent`, pinentry)| Complex (X.509 PKI) |
| Tooling Overhead | Zero extra software required | Requires GnuPG suite | Requires Certificate Authority |
| GitHub Support | **100% Native (Green Badge)** | 100% Native (Green Badge) | 100% Native |
| Key Expiration Management| Managed via local SSH keys | Complex key renewal & web-of-trust| X.509 Certificate validity |
| Industry Adoption | Rapidly becoming modern standard | Longtime enterprise standard | Enterprise corporate PKI |

---

## 7. Common Mistakes

- **Assuming unsigned commits cannot be spoofed.** Unsigned commits have zero cryptographic verification; anyone can forge any email address in Git.
- **Using an Authentication SSH Key as a Signing Key without setting key type on GitHub.** You must select Key Type: "Signing Key" in GitHub settings.
- **Forgetting `commit.gpgsign true`.** Without auto-sign enabled, you must remember to pass `-S` on every commit.
- **Commit email not matching the signing key email.** GitHub only awards the "Verified" badge if the commit author email matches an email registered to the key on GitHub.
- **Rebasing without preserving signatures.** Rebasing generates new commit objects; ensure your Git config auto-signs rebased commits.

---

## 8. Hands-On Exercises

**Exercise 1:** Configure SSH commit signing using your local Ed25519 SSH key.

**Exercise 2:** Enable automatic commit and tag signing via `git config --global commit.gpgsign true`.

**Exercise 3:** Make a signed commit and inspect the cryptographic signature with `git log --show-signature`.

**Exercise 4:** Inspect the raw commit object containing the `gpgsig` header using `git cat-file -p HEAD`.

**Exercise 5:** Set up `allowed_signers` file to verify signed commits locally from colleagues.

---

## 9. Interview Q&A

**Q: Why is commit signing critical in modern enterprise software security?**
Because Git's author and committer metadata headers can be arbitrarily spoofed by any user via `git config user.email`. Cryptographic commit signing (via SSH or GPG) embeds a tamper-proof digital signature into the commit object, proving mathematically that the commit was authored by the owner of the private key and that the code contents have not been modified since signing.

**Q: How does GitHub determine whether to display the green "Verified" badge on a commit?**
GitHub checks three requirements:
1. The commit object contains a valid cryptographic signature (`gpgsig`).
2. The public key corresponding to the signature is registered under a GitHub account.
3. The email address of the commit author matches a verified email address associated with that GitHub account.

**Q: What is the advantage of using SSH keys for commit signing over GPG keys in modern Git?**
Since Git 2.34, Git natively supports signing commits with SSH keys (`gpg.format = ssh`). This eliminates the need to install and configure complex third-party tools like GnuPG (`gpg`), manage GPG keyrings, or deal with `pinentry` daemon timeouts, allowing developers to use their existing, well-secured SSH keys for both network transport and commit verification.

**Q: Where in the Git repository is the cryptographic signature stored?**
The digital signature is stored directly inside the text body of the **Commit Object** itself, in a dedicated multi-line header field called `gpgsig`. It is not stored in an external file or separate database.

**Q: What is "Vigilant Mode" on GitHub?**
Vigilant Mode is an optional GitHub security setting that flags all unsigned commits made with your email address with an **"Unverified"** warning badge, alerting project maintainers that the commit lacks cryptographic provenance and may have been spoofed.
