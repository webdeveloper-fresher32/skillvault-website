# Your First Script

## Table of Contents
1. [The Shebang Line](#1-the-shebang-line)
2. [Creating and Running a Script](#2-creating-and-running-a-script)
3. [File Permissions](#3-file-permissions)
4. [Script Best Practices](#4-script-best-practices)

---

## 1. The Shebang Line

The first line tells the OS which interpreter to use:

```bash
#!/bin/bash
```

Without it, the script runs in the current shell — which may not be bash. Always include it.

---

## 2. Creating and Running a Script

```bash
# Create the file
nano hello.sh

# Contents:
#!/bin/bash
echo "Hello, AWS learner!"
echo "Today is: $(date)"
echo "You are: $(whoami)"

# Make it executable
chmod +x hello.sh

# Run it
./hello.sh
# or
bash hello.sh
```

Output:
```
Hello, AWS learner!
Today is: Thu Jun 26 10:00:00 UTC 2025
You are: ec2-user
```

---

## 3. File Permissions

```bash
chmod +x script.sh      # add execute for all
chmod 755 script.sh     # rwxr-xr-x  (owner: rwx, group: rx, others: rx)
chmod 700 script.sh     # rwx------  (only owner can read/execute — good for scripts with secrets)

ls -la script.sh
# -rwxr-xr-x  1 ec2-user ec2-user  245 Jun 26 10:00 script.sh
```

For AWS scripts that contain credentials or do destructive operations, use `chmod 700`.

---

## 4. Script Best Practices

```bash
#!/bin/bash
set -euo pipefail    # exit on error, undefined vars, pipe failures

# -e  : exit immediately if any command fails
# -u  : treat unset variables as errors
# -o pipefail : catch errors in pipes (grep | awk — grep failure won't be hidden)
```

This one line prevents an entire class of silent bugs in production scripts.

---

## Hands-On Exercise

Write a script `system-info.sh` that prints:
- Hostname
- Current user
- OS version (`cat /etc/os-release`)
- Disk usage (`df -h /`)
- Memory usage (`free -h`)

This is the foundation of the System Health Check project in Phase 12.
