# What is a Shell?

## Table of Contents
1. [Shell vs Terminal vs Bash](#1-shell-vs-terminal-vs-bash)
2. [How the Shell Works](#2-how-the-shell-works)
3. [Common Shells](#3-common-shells)
4. [Why Bash for AWS](#4-why-bash-for-aws)

---

## 1. Shell vs Terminal vs Bash

```
Terminal  →  the window/app you type in (iTerm2, GNOME Terminal)
Shell     →  the program that interprets your commands (bash, zsh, sh)
Bash      →  the most common shell; default on most Linux servers (including EC2)
```

When you SSH into an EC2 instance, you get a Bash shell. AWS Lambda runtime scripts run in Bash. UserData scripts in EC2 run as Bash.

---

## 2. How the Shell Works

```
You type: ls -la /etc

1. Shell reads the input
2. Shell parses: command=ls, flags=-la, arg=/etc
3. Shell finds ls binary in $PATH (/bin/ls)
4. Shell forks a child process, runs /bin/ls -la /etc
5. Output is printed to your terminal
```

---

## 3. Common Shells

| Shell | Notes |
|-------|-------|
| `bash` | Bourne Again Shell — default on Ubuntu, Amazon Linux, most EC2 AMIs |
| `sh` | POSIX shell — minimal, used in portable scripts |
| `zsh` | Default on macOS — mostly bash-compatible |
| `fish` | User-friendly but not POSIX; avoid for AWS scripts |

Always use `#!/bin/bash` for AWS scripts unless you have a specific reason not to.

---

## 4. Why Bash for AWS

- AWS EC2 UserData runs as root Bash
- AWS CLI outputs text/JSON that bash pipelines parse
- Lambda custom runtimes, ECS task scripts, CodeBuild buildspecs all use bash
- CloudFormation `cfn-init` runs bash commands

---

## Interview Q&A

**Q: What is the difference between `sh` and `bash`?**
`sh` is the POSIX-standard shell with minimal features. `bash` is a superset of `sh` with arrays, `[[ ]]` conditionals, process substitution, and more. On many systems, `/bin/sh` is actually dash (not bash) — writing `#!/bin/sh` and using bash-isms will silently break.

**Q: What does the shell do with your command before executing it?**
It performs: alias expansion → parameter/variable expansion → command substitution → word splitting → pathname expansion (globbing) → then executes.
