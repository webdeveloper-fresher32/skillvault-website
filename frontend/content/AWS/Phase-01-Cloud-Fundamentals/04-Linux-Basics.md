# 04 - Linux Basics

## Table of Contents
1. [What is Linux and Why Cloud Uses It](#what-is-linux)
2. [Linux Architecture](#linux-architecture)
3. [Linux File System](#linux-file-system)
4. [Essential Commands](#essential-commands)
5. [File Permissions](#file-permissions)
6. [SSH - Secure Shell](#ssh)
7. [Process Management](#process-management)
8. [Networking Commands](#networking-commands)
9. [Package Managers](#package-managers)
10. [Text Editors](#text-editors)
11. [File Operations and I/O Redirection](#file-operations)
12. [Environment Variables](#environment-variables)
13. [Cron Jobs](#cron-jobs)
14. [Interview Q&A](#interview-qa)

---

## 1. What is Linux and Why Cloud Uses It

### What is Linux?

Linux is a free, open-source operating system kernel created by Linus Torvalds in 1991. Combined with GNU utilities and tools, it forms complete operating systems called "Linux distributions" or "distros."

**Popular Linux Distributions:**
```
Ubuntu      - Most popular for servers and beginners
             Default EC2 AMI option. LTS versions (20.04, 22.04, 24.04)

Amazon Linux - AWS's own distribution, based on Red Hat/CentOS
             Optimized for AWS, includes AWS tools pre-installed
             Amazon Linux 2023 is current

CentOS/RHEL  - Red Hat Enterprise Linux family
             Common in enterprise environments

Debian       - Stable, conservative, Ubuntu is based on it

Alpine       - Tiny (5MB), used in Docker containers

Arch Linux   - Bleeding-edge, DIY philosophy
```

### Why Does Cloud Use Linux?

```
1. FREE: No licensing cost. Windows Server = $1,000s/year.
         Linux = $0. At cloud scale (millions of servers), this matters.

2. OPEN SOURCE: Full code visibility, customizable, community-maintained.
                AWS modified Linux kernel for Nitro hypervisor.

3. STABILITY: Linux servers routinely run for years without rebooting.
              Critical for services with 99.99% uptime requirements.

4. PERFORMANCE: Efficient resource usage. Linux overhead < Windows overhead.
                More CPU/RAM for your application.

5. CLI-FIRST: Linux was designed for automation. Everything is scriptable.
              AWS automation (Ansible, Terraform, Shell scripts) = Linux.

6. SECURITY: Open-source = faster vulnerability discovery and patching.
             Fine-grained permissions system.
             No GUI by default = smaller attack surface.

7. MARKET DOMINANCE: ~96% of the world's top 1 million web servers run Linux.
                     AWS, Google, Facebook, Netflix, Amazon all use Linux.
```

---

## 2. Linux Architecture

```
Linux Architecture Diagram:

+-----------------------------------------------------------------------+
|                        USER SPACE                                      |
|                                                                        |
|  User Applications                                                     |
|  +----------+  +----------+  +----------+  +----------+               |
|  | Browser  |  |  nginx   |  |  Python  |  |  MySQL   |               |
|  +----------+  +----------+  +----------+  +----------+               |
|                                                                        |
|  System Libraries (glibc - provides C standard library)               |
|  +------------------------------------------------------------------+  |
|  | printf(), malloc(), open(), read(), write(), fork(), exec()...   |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
|  Shell (bash, zsh, sh)                                                 |
|  +------------------------------------------------------------------+  |
|  | Command interpreter: ls, cd, grep, pipes, redirection            |  |
|  | Your interface to the system                                      |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
+-----------------------------------------------------------------------+
|                                                                        |
|                    KERNEL SPACE                                        |
|                                                                        |
|  Linux Kernel (runs in privileged mode)                               |
|  +------------------------------------------------------------------+  |
|  | System Call Interface                                             |  |
|  | (open, read, write, fork, execve, mmap, socket...)               |  |
|  +------------------------------------------------------------------+  |
|  | Process Management   | Memory Management  | File Systems         |  |
|  | (scheduling, PIDs)   | (virtual memory)   | (ext4, xfs, tmpfs)   |  |
|  +------------------+---+-----------------+--+---------------------+  |
|  | Network Stack (TCP/IP)                 | Device Drivers           |  |
|  | (socket, bind, listen, accept, send)   | (disk, NIC, GPU)         |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
+-----------------------------------------------------------------------+
|                        HARDWARE                                        |
|  +----------+  +----------+  +----------+  +----------+               |
|  |   CPU    |  |   RAM    |  |  Disk    |  |  NIC     |               |
|  +----------+  +----------+  +----------+  +----------+               |
+-----------------------------------------------------------------------+

You interact with the Shell.
Shell calls programs.
Programs call kernel via system calls.
Kernel talks to hardware.
```

### The Shell

The shell is your command-line interface to Linux. When you SSH into an EC2 instance, you're in a shell.

```
Common shells:
bash  - Bourne Again Shell (most common, default on most Linux)
zsh   - Z Shell (macOS default, more features)
sh    - POSIX shell (minimal, used for scripts)
fish  - Friendly Interactive Shell (beginner-friendly)

Check your shell:
echo $SHELL       # /bin/bash
bash --version    # bash version 5.x.x
```

---

## 3. Linux File System

### Everything is a File

In Linux, everything is represented as a file: regular files, directories, devices, sockets, processes. This unified model simplifies the system.

```
Linux File System Hierarchy (important directories):

/                    <- Root of everything (the top-level directory)
|
+-- /bin/            <- Essential binaries (ls, cp, mv, cat, echo, bash)
|                       Available to all users, needed for single-user mode
|
+-- /sbin/           <- System binaries (root only: fdisk, ifconfig, reboot)
|
+-- /etc/            <- Configuration files for the system
|   |
|   +-- /etc/passwd      <- User accounts list (not passwords, that's shadow)
|   +-- /etc/shadow      <- Hashed passwords (root read only)
|   +-- /etc/hosts       <- Static hostname to IP mappings
|   +-- /etc/fstab       <- Filesystem mount table (auto-mounts on boot)
|   +-- /etc/ssh/        <- SSH server configuration
|   +-- /etc/nginx/      <- nginx configuration
|   +-- /etc/crontab     <- System cron jobs
|   +-- /etc/environment <- System-wide environment variables
|
+-- /home/           <- Home directories for users
|   +-- /home/ubuntu/    <- ubuntu user's home dir (on Ubuntu EC2)
|   +-- /home/ec2-user/  <- ec2-user's home dir (on Amazon Linux)
|
+-- /root/           <- Home directory for the root user
|                       (NOT /home/root — root is special)
|
+-- /var/            <- Variable data (changes during operation)
|   +-- /var/log/        <- System and application logs
|   |   +-- syslog       <- General system messages
|   |   +-- auth.log     <- Authentication logs (SSH logins)
|   |   +-- nginx/       <- nginx access and error logs
|   +-- /var/www/        <- Web server document root (nginx/apache)
|   +-- /var/lib/        <- Application state data (MySQL data files)
|   +-- /var/spool/      <- Print queues, mail spools
|
+-- /tmp/            <- Temporary files (cleared on reboot)
|                       World-writable, any user can create files here
|
+-- /usr/            <- User programs and data
|   +-- /usr/bin/        <- Most user commands (not essential like /bin)
|   |                       python3, git, wget, curl live here
|   +-- /usr/local/      <- Software compiled/installed by admin
|   |   +-- /usr/local/bin/
|   +-- /usr/lib/        <- Libraries for /usr/bin programs
|   +-- /usr/share/      <- Architecture-independent data (docs, icons)
|
+-- /opt/            <- Optional/third-party software
|                       (AWS CLI, custom apps often install here)
|
+-- /proc/           <- Virtual filesystem showing kernel/process info
|                       Not real files — kernel exposes info here
|   +-- /proc/cpuinfo    <- CPU information
|   +-- /proc/meminfo    <- Memory usage
|   +-- /proc/1234/      <- Info about process 1234
|
+-- /sys/            <- Virtual filesystem for device and kernel info
|
+-- /dev/            <- Device files
|   +-- /dev/sda         <- First hard disk
|   +-- /dev/sda1        <- First partition of first hard disk
|   +-- /dev/null        <- Discard all input, returns nothing
|   +-- /dev/zero        <- Returns null bytes continuously
|   +-- /dev/random      <- Cryptographically secure random numbers
|
+-- /mnt/            <- Temporary mount point for external filesystems
+-- /media/          <- Auto-mounted media (USB drives, CDs)
+-- /boot/           <- Bootloader and kernel files (don't touch)
+-- /lib/            <- Shared libraries needed by /bin and /sbin
```

---

## 4. Essential Commands

### pwd — Print Working Directory

**What it does:** Shows you where you currently are in the file system.

```bash
# Syntax: pwd

$ pwd
/home/ubuntu

# AWS use case: Always know where you are before running scripts
# After SSH into EC2:
$ pwd
/home/ec2-user

# Useful in scripts to verify context:
$ echo "Running from: $(pwd)"
Running from: /home/ubuntu/myapp
```

### ls — List Directory Contents

**What it does:** Lists files and directories.

```bash
# Syntax: ls [options] [path]

# Basic list
$ ls
Desktop  Documents  Downloads  Pictures

# -l : Long format (permissions, owner, size, date)
$ ls -l
total 48
drwxr-xr-x 2 ubuntu ubuntu 4096 Jun  8 10:00 Desktop
-rw-r--r-- 1 ubuntu ubuntu 1024 Jun  7 15:30 config.txt
-rwxr-xr-x 1 ubuntu ubuntu 8192 Jun  6 09:00 deploy.sh

# What each column means:
# drwxr-xr-x  2  ubuntu  ubuntu  4096  Jun 8 10:00  Desktop
# |           |  |       |       |     |             |
# permissions links owner  group  size  modified      name

# -a : Show ALL files including hidden (start with .)
$ ls -a
.  ..  .bash_history  .bashrc  .profile  Desktop

# -la or -l -a : Long format + hidden files
$ ls -la
total 48
drwxr-xr-x 8 ubuntu ubuntu 4096 Jun  8 10:00 .
drwxr-xr-x 3 root   root   4096 Jun  1 00:00 ..
-rw------- 1 ubuntu ubuntu  200 Jun  8 09:45 .bash_history
-rw-r--r-- 1 ubuntu ubuntu  220 Jun  1 00:00 .bash_logout
-rw-r--r-- 1 ubuntu ubuntu 3771 Jun  1 00:00 .bashrc

# -lh : Human-readable sizes
$ ls -lh
-rw-r--r-- 1 ubuntu ubuntu 1.5M Jun  7 application.log
-rw-r--r-- 1 ubuntu ubuntu 3.2G Jun  7 database-backup.sql.gz

# List specific directory
$ ls -la /etc/nginx/
$ ls -la /var/log/

# AWS use case: Check what's in your home dir after SSH
$ ls -la ~
# Check deployment files:
$ ls -la /var/www/html/
# Check log files:
$ ls -lh /var/log/nginx/
```

### cd — Change Directory

**What it does:** Navigate between directories.

```bash
# Syntax: cd [path]

# Go to a specific path
$ cd /var/log

# . means current directory
$ cd .          # Does nothing, stays in current dir
$ ls .          # Lists current directory

# .. means parent directory (go up one level)
$ cd ..         # Go up one level
$ pwd
/var

$ cd ../..      # Go up two levels
$ pwd
/

# ~ means home directory
$ cd ~          # Go to your home directory
$ cd            # Also goes to home (cd with no args)

# - means previous directory (go back)
$ cd /var/log
$ cd /etc/nginx
$ cd -          # Goes back to /var/log
/var/log

# Absolute path (starts with /)
$ cd /etc/ssh

# Relative path (from current location)
$ cd ../nginx   # From /etc/ssh, go to /etc/nginx

# AWS use case: Navigate to app directory
$ cd /var/www/html
$ cd ~/myapp
$ ls -la
```

### mkdir — Make Directory

**What it does:** Create new directories.

```bash
# Syntax: mkdir [options] directory_name

# Create a directory
$ mkdir myproject
$ ls
myproject

# Create nested directories (use -p to create parents too)
$ mkdir logs/2026/june
# Error! 'logs' doesn't exist yet

$ mkdir -p logs/2026/june
# Creates logs/, logs/2026/, logs/2026/june/ all at once

# Create multiple directories at once
$ mkdir -p src/{controllers,models,routes,middleware}
$ ls src/
controllers  middleware  models  routes

# AWS use case: Set up application directory structure
$ sudo mkdir -p /var/www/myapp/{public,logs,config}
$ mkdir -p /home/ec2-user/scripts/deploy

# Create with specific permissions
$ mkdir -m 755 mydir
```

### rm — Remove Files and Directories

**What it does:** Delete files and directories. WARNING: No recycle bin. Deletion is permanent.

```bash
# Syntax: rm [options] file_or_directory

# Remove a file
$ rm oldfile.txt

# Remove multiple files
$ rm file1.txt file2.txt file3.txt

# -r or -R : Recursive (required for directories)
$ rm -r olddirectory/

# -f : Force (no confirmation prompts, ignore non-existent files)
$ rm -f possibly-nonexistent-file.txt

# -rf : Recursive + Force (DANGEROUS — commonly used but be careful)
$ rm -rf /tmp/build-artifacts/
$ rm -rf node_modules/            # Remove node_modules folder

# WARNING: Never run this (will destroy your entire system)
# rm -rf /         <- The most dangerous command in Linux
# rm -rf /*        <- Same thing

# -i : Interactive (ask before each deletion) - safer
$ rm -i *.log

# AWS use case: Clean up old log files on EC2
$ rm -f /var/log/myapp/app.log.old
$ rm -rf /tmp/deploy-artifacts/

# Clean up old builds
$ rm -rf /home/ec2-user/builds/build-*-old/
```

### cp — Copy Files and Directories

**What it does:** Copy files or directories to a new location.

```bash
# Syntax: cp [options] source destination

# Copy a file
$ cp config.txt config.txt.backup

# Copy to a different directory
$ cp deploy.sh /home/ubuntu/scripts/

# -r : Recursive (required to copy directories)
$ cp -r myapp/ myapp-backup/

# -p : Preserve permissions, timestamps, ownership
$ cp -p important.conf important.conf.bak

# -v : Verbose (show what's being copied)
$ cp -rv myapp/ /var/www/html/

# Copy multiple files to a directory
$ cp file1.txt file2.txt file3.txt /tmp/

# AWS use case: Backup config before editing
$ sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
# Deploy new version of app
$ cp -r /home/ec2-user/myapp/dist/* /var/www/html/
```

### mv — Move (Rename) Files

**What it does:** Move files to a new location OR rename them.

```bash
# Syntax: mv [options] source destination

# Rename a file (same directory, different name)
$ mv oldname.txt newname.txt

# Move a file to a different directory
$ mv deploy.sh /home/ubuntu/scripts/

# Move and rename
$ mv /tmp/config.tmp /etc/myapp/config.conf

# Move directory
$ mv myapp-v1/ myapp/

# Move multiple files
$ mv *.log /var/log/myapp/

# -v : Verbose
$ mv -v *.conf /etc/nginx/conf.d/

# AWS use case: Deploy new app version
$ mv /home/ec2-user/app-v2.tar.gz /opt/myapp/
# Rename config after editing
$ mv config.conf.new config.conf
```

### cat — Display File Contents

**What it does:** Concatenate and display file contents. Prints the full file to terminal.

```bash
# Syntax: cat [options] file

# Display file contents
$ cat /etc/hostname
ip-10-0-1-45

# Display with line numbers (-n)
$ cat -n /etc/hosts
     1  127.0.0.1  localhost
     2  127.0.1.1  ip-10-0-1-45
     3  10.0.1.1   database.internal

# Concatenate multiple files
$ cat file1.txt file2.txt > combined.txt

# View config files (common AWS use case)
$ cat /etc/nginx/nginx.conf
$ cat ~/.ssh/authorized_keys
$ cat /var/log/cloud-init-output.log   # EC2 user data script output

# Create a small file with cat (Ctrl+D to finish)
$ cat > newfile.txt
Type content here
Press Ctrl+D when done

# AWS use case:
$ cat /etc/os-release              # What Linux distro is this?
$ cat /proc/cpuinfo | head -20     # CPU info
$ cat /var/log/syslog | tail -50   # Last 50 lines of syslog
```

### head and tail — View Beginning or End of Files

**What they do:** Show the first (head) or last (tail) lines of a file. Essential for log analysis.

```bash
# Syntax: head/tail [options] file

# head: first 10 lines (default)
$ head /var/log/nginx/access.log

# -n : Specify number of lines
$ head -n 20 /var/log/nginx/access.log
$ head -5 config.txt      # First 5 lines

# tail: last 10 lines (default)
$ tail /var/log/nginx/error.log

# -n : Last N lines
$ tail -n 100 /var/log/nginx/access.log

# -f : FOLLOW — show new lines as they're added (realtime monitoring)
$ tail -f /var/log/nginx/access.log
# Output updates in real-time as new requests come in
# Press Ctrl+C to stop

# Very common: follow multiple files
$ tail -f /var/log/nginx/access.log /var/log/nginx/error.log

# AWS use case: Monitor your application logs in real-time
$ tail -f /var/log/myapp/app.log
# Check if deployment script ran correctly
$ tail -n 50 /var/log/cloud-init-output.log
# Quick check of last 100 error log lines
$ tail -n 100 /var/log/nginx/error.log | grep "500"
```

### less — View Files Page by Page

**What it does:** View large files one screen at a time. Unlike cat, it doesn't dump everything at once.

```bash
# Syntax: less file

$ less /var/log/syslog

# Navigation in less:
# Space or PageDown  -> Next page
# b or PageUp        -> Previous page
# j or Arrow Down    -> Next line
# k or Arrow Up      -> Previous line
# G                  -> Go to end of file
# g                  -> Go to beginning of file
# /search_term       -> Search forward for text
# n                  -> Next search result
# N                  -> Previous search result
# q                  -> Quit

# AWS use case:
$ less /etc/nginx/nginx.conf
$ less /var/log/cloud-init-output.log
$ less /etc/ssh/sshd_config
```

### grep — Search for Patterns

**What it does:** Search for lines matching a pattern. One of the most powerful Linux commands.

```bash
# Syntax: grep [options] pattern file

# Basic search
$ grep "error" /var/log/nginx/error.log

# Case-insensitive search (-i)
$ grep -i "ERROR" /var/log/nginx/error.log

# Show line numbers (-n)
$ grep -n "404" /var/log/nginx/access.log

# Count matching lines (-c)
$ grep -c "GET /api" /var/log/nginx/access.log
1247

# Show context: N lines before (-B) and after (-A) match
$ grep -B2 -A3 "critical error" app.log

# Invert match (-v): lines NOT matching
$ grep -v "127.0.0.1" /var/log/nginx/access.log  # Exclude localhost

# Recursive search in directory (-r)
$ grep -r "database_url" /etc/myapp/

# Extended regex (-E) for complex patterns
$ grep -E "ERROR|WARN|FATAL" /var/log/app.log

# Search for whole words (-w)
$ grep -w "fail" /var/log/auth.log   # Won't match "failure"

# Most powerful: pipe grep to filter other commands
$ cat /var/log/nginx/access.log | grep "404"
$ ps aux | grep nginx
$ ls -la | grep ".conf"

# AWS use case:
$ grep "Failed password" /var/log/auth.log          # Failed SSH attempts
$ grep "error" /var/log/nginx/error.log | tail -20  # Recent errors
$ grep -r "AWS_ACCESS_KEY" /home/ec2-user/           # Find exposed keys (security check)
$ journalctl | grep "OOM" | tail -5                  # Out of memory errors
```

### find — Find Files and Directories

**What it does:** Search for files and directories based on various criteria.

```bash
# Syntax: find [path] [criteria] [action]

# Find by name
$ find /var/log -name "*.log"
$ find /home -name "*.py"

# Find by name (case-insensitive)
$ find / -iname "nginx.conf"

# Find by type (f=file, d=directory, l=link)
$ find /var/log -type f -name "*.log"
$ find /etc -type d

# Find by size
$ find /var/log -size +100M     # Files larger than 100MB
$ find /tmp -size -1k           # Files smaller than 1KB
$ find / -size +1G              # Files larger than 1GB

# Find modified in last N days (-mtime)
$ find /var/log -mtime -7 -name "*.log"   # Modified in last 7 days
$ find /tmp -mtime +30                     # Not modified in 30+ days (old temp files)

# Find and execute a command (-exec)
$ find /tmp -mtime +7 -exec rm {} \;      # Delete files older than 7 days
$ find . -name "*.py" -exec grep -l "import boto3" {} \;  # Python files using boto3

# Find by permissions
$ find /etc -perm 777    # World-writable files (security concern)
$ find /usr/bin -perm -4000  # SUID files (run as owner)

# AWS use case:
$ find /var/log -name "*.log" -size +100M    # Find large log files filling disk
$ find /home/ec2-user -name "*.pem"          # Find any key files
$ find /etc -name "*.conf" -mtime -1         # Config files modified today
```

---

## 5. File Permissions

### Reading Permission Strings

Every file in Linux has permissions. Let's dissect them:

```bash
$ ls -la
-rwxr-xr-x  1  ubuntu  ubuntu  4096  Jun 8  deploy.sh
drwxr-xr-x  2  ubuntu  ubuntu  4096  Jun 8  mydir/
-rw-r--r--  1  ubuntu  ubuntu   512  Jun 8  config.txt
lrwxrwxrwx  1  ubuntu  ubuntu     9  Jun 8  link -> /etc/nginx

Position 1 - File Type:
  -  = regular file
  d  = directory
  l  = symbolic link
  c  = character device (e.g., /dev/null)
  b  = block device (e.g., /dev/sda)

Positions 2-4: Owner permissions
Positions 5-7: Group permissions
Positions 8-10: Other (world) permissions

Permission characters:
  r = read    (value: 4)
  w = write   (value: 2)
  x = execute (value: 1)
  - = no permission (value: 0)
```

```
Example: rwxr-xr-x

Position: 1 2 3 4 5 6 7 8 9 10
Value:    - r w x r - x r - x
          |  \   /   \   /  \ /
        type  owner  group  others
```

**Breaking down each triplet:**

```
Owner (ubuntu):  rwx = read + write + execute = can read, modify, run
Group (ubuntu):  r-x = read + execute = can read and run, but NOT write
Others:          r-x = read + execute = same as group (world can read/run)

For a directory:
  r = can list directory contents (ls)
  w = can create/delete files in directory
  x = can enter (cd into) the directory
```

### Numeric (Octal) Permissions

Each permission has a numeric value: r=4, w=2, x=1

```
Calculate by adding values for each triplet:

Owner:  rwx = 4+2+1 = 7
Group:  r-x = 4+0+1 = 5
Others: r-x = 4+0+1 = 5
Permission: 755

Owner:  rw- = 4+2+0 = 6
Group:  r-- = 4+0+0 = 4
Others: r-- = 4+0+0 = 4
Permission: 644

Owner:  rwx = 7
Group:  rwx = 7
Others: rwx = 7
Permission: 777 (everyone can do everything - usually bad)

Owner:  rw- = 6
Group:  --- = 0
Others: --- = 0
Permission: 600 (only owner can read/write - SSH key permissions)
```

### Common Permission Setups

```
644 (-rw-r--r--):
  Owner: read, write
  Group: read only
  Others: read only
  Use case: Regular files, config files, web content (HTML/CSS/JS)
  "I can edit it, others can read it"

755 (-rwxr-xr-x):
  Owner: read, write, execute
  Group: read, execute
  Others: read, execute
  Use case: Scripts, executables, directories
  "I can modify and run it, others can run it"
  Most common permission for directories

700 (-rwx------):
  Owner: full permissions
  Group: none
  Others: none
  Use case: Private scripts, sensitive directories
  "Only I can do anything with this"

600 (-rw-------):
  Owner: read, write
  Group: none
  Others: none
  Use case: SSH private keys (REQUIRED), sensitive config files
  "Only I can read/write this, not even execute"
  SSH will refuse to use a key that is not 600!

777 (-rwxrwxrwx):
  Everyone: full permissions
  Use case: Rarely appropriate in production
  Security risk: Any user can modify/delete this file
  Sometimes used in /tmp, writable shared directories

000 (----------):
  Nobody can access
  Unusual, but sometimes used to temporarily block access
```

### chmod — Change Permissions

```bash
# Syntax: chmod [options] permissions file

# Numeric mode:
$ chmod 755 deploy.sh      # rwxr-xr-x
$ chmod 644 config.txt     # rw-r--r--
$ chmod 600 ~/.ssh/id_rsa  # rw------- (required for SSH keys!)
$ chmod 777 /tmp/shared    # rwxrwxrwx (use sparingly)

# Symbolic mode:
# u=user(owner), g=group, o=others, a=all
# +=add, -=remove, ==set exactly

$ chmod +x deploy.sh         # Add execute for all (u, g, o)
$ chmod u+x deploy.sh        # Add execute for owner only
$ chmod o-x deploy.sh        # Remove execute from others
$ chmod go-w myfile.txt      # Remove write from group and others
$ chmod u=rwx,go=rx file     # Owner rwx, group and others r-x = 755

# Recursive (-R): Change permissions for directory and all contents
$ chmod -R 755 /var/www/html/
$ chmod -R 644 /etc/nginx/

# AWS use case:
# After creating deploy script:
$ chmod +x deploy.sh

# Before using SSH key pair:
$ chmod 600 mykey.pem

# Set web server directory permissions:
$ sudo chmod -R 755 /var/www/html
$ sudo chmod -R 644 /var/www/html/*.html
```

### chown — Change Owner

```bash
# Syntax: chown [user][:group] file

# Change owner
$ sudo chown ubuntu myfile.txt

# Change owner and group
$ sudo chown ubuntu:ubuntu myfile.txt
$ sudo chown www-data:www-data /var/www/html/

# Recursive change
$ sudo chown -R ubuntu:ubuntu /home/ubuntu/myapp/
$ sudo chown -R www-data:www-data /var/www/html/

# AWS use case:
# After copying files as root, give ownership to app user
$ sudo chown -R ec2-user:ec2-user /home/ec2-user/myapp/
# Give nginx ownership of web files
$ sudo chown -R www-data:www-data /var/www/html/
```

### chgrp — Change Group

```bash
# Syntax: chgrp group file

$ sudo chgrp developers deploy.sh
$ sudo chgrp -R www-data /var/www/html/
```

---

## 6. SSH - Secure Shell

### How SSH Works

SSH (Secure Shell) provides encrypted remote access to servers. It uses asymmetric cryptography:

```
How SSH Key Authentication Works:

1. Key Pair Generation (on your laptop):
   Generate two mathematically linked keys:
   
   Private Key (id_rsa):         Public Key (id_rsa.pub):
   -----BEGIN RSA PRIVATE KEY-----  ssh-rsa AAAAB3Nza...ubuntu@laptop
   MIIEowIBAAKCAQEA...              
   -----END RSA PRIVATE KEY-----    
   
   KEEP PRIVATE. NEVER SHARE.      Share this with servers.

2. Server Setup:
   Your public key goes into the server's ~/.ssh/authorized_keys
   "This laptop is allowed to connect"

3. Connection Process:
   Client (laptop)                    Server (EC2)
        |                                  |
        | SSH connection request           |
        | -------------------------------->|
        |                                  | Checks authorized_keys
        |                                  | Generates random challenge
        |   Random challenge               |
        | <--------------------------------|
        |                                  |
        | Sign challenge with private key  |
        | -------------------------------->|
        |                                  | Verify signature with public key
        |                                  | If valid: grant access
        |   Access granted                 |
        | <--------------------------------|
        |                                  |
        | Encrypted session established    |
        | ================================>|
        
The private key NEVER leaves your machine.
The server verifies you have the matching private key without seeing it.
This is public-key cryptography (RSA).
```

### ssh Command

```bash
# Syntax: ssh [options] [user@]hostname

# Basic connection (assumes same username as local user)
$ ssh server.example.com

# Specify user
$ ssh ubuntu@54.239.28.85
$ ssh ec2-user@ec2-54-239-28-85.compute-1.amazonaws.com

# Specify identity file (private key)
$ ssh -i ~/.ssh/mykey.pem ubuntu@54.239.28.85
$ ssh -i mykey.pem ec2-user@54.239.28.85

# Specify port (if not default 22)
$ ssh -p 2222 ubuntu@server.example.com

# SSH with verbose output (for debugging)
$ ssh -v ubuntu@server.example.com    # Verbose
$ ssh -vvv ubuntu@server.example.com  # Very verbose

# Execute a single command without entering interactive shell
$ ssh ubuntu@server.example.com "ls -la /var/www/html"
$ ssh ubuntu@server.example.com "sudo systemctl restart nginx"
$ ssh ubuntu@server.example.com "tail -50 /var/log/nginx/error.log"

# Port forwarding (tunnel local port to remote):
$ ssh -L 5432:localhost:5432 ubuntu@server.com
# Now localhost:5432 on your machine connects to server's PostgreSQL

# Keep connection alive:
$ ssh -o ServerAliveInterval=60 ubuntu@server.example.com

# AWS use case: SSH into EC2
$ ssh -i ~/Downloads/my-key-pair.pem ubuntu@54.239.28.85
$ ssh -i ~/.ssh/ec2-key.pem ec2-user@ec2-54-239-28-85.compute-1.amazonaws.com
```

### SSH Config File (~/.ssh/config)

Instead of typing `ssh -i ~/.ssh/mykey.pem ubuntu@54.239.28.85` every time, create an SSH config file:

```bash
$ nano ~/.ssh/config
```

```
# ~/.ssh/config
Host myec2
    HostName 54.239.28.85
    User ubuntu
    IdentityFile ~/.ssh/my-key-pair.pem
    Port 22

Host dev-server
    HostName dev.example.com
    User deployer
    IdentityFile ~/.ssh/dev-key.pem

Host bastion
    HostName bastion.example.com
    User ec2-user
    IdentityFile ~/.ssh/bastion-key.pem
```

Now you can just type:
```bash
$ ssh myec2
# Instead of: ssh -i ~/.ssh/my-key-pair.pem ubuntu@54.239.28.85
```

### ssh-keygen — Generate Key Pairs

```bash
# Generate RSA key pair
$ ssh-keygen -t rsa -b 4096 -C "yourname@company.com"

# -t rsa    : Key type (RSA)
# -b 4096   : Key size in bits (4096 is strong)
# -C "..."  : Comment (helps identify the key)

# Generates two files:
# ~/.ssh/id_rsa       <- PRIVATE KEY (protect this!)
# ~/.ssh/id_rsa.pub   <- PUBLIC KEY (share this)

# Generate with custom filename
$ ssh-keygen -t rsa -b 4096 -f ~/.ssh/my-ec2-key

# Generate ED25519 key (newer, faster, equally secure)
$ ssh-keygen -t ed25519 -C "yourname@company.com"

# View your public key (to copy to server)
$ cat ~/.ssh/id_rsa.pub
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC... yourname@company.com

# Set correct permissions on keys
$ chmod 700 ~/.ssh
$ chmod 600 ~/.ssh/id_rsa
$ chmod 644 ~/.ssh/id_rsa.pub
```

### authorized_keys

```bash
# File location: ~/.ssh/authorized_keys
# Contains public keys of users allowed to SSH as this user

# View current authorized keys
$ cat ~/.ssh/authorized_keys

# Add a public key manually
$ echo "ssh-rsa AAAAB3Nza... yourpublickey" >> ~/.ssh/authorized_keys

# Or copy your local public key to a server (when you have password access)
$ ssh-copy-id -i ~/.ssh/id_rsa.pub ubuntu@server.com

# Create from scratch with correct permissions
$ mkdir -p ~/.ssh
$ chmod 700 ~/.ssh
$ touch ~/.ssh/authorized_keys
$ chmod 600 ~/.ssh/authorized_keys
```

### SSH into AWS EC2 — Step by Step

```
Step 1: Create a Key Pair in AWS Console
  - EC2 -> Key Pairs -> Create Key Pair
  - Name: my-key-pair
  - Format: .pem (for Linux/Mac) or .ppk (for PuTTY/Windows)
  - Click Create -> .pem file auto-downloads

Step 2: Set Correct Permissions
$ chmod 400 ~/Downloads/my-key-pair.pem
# 400 = owner read only (SSH requires this)

Step 3: Find EC2 Public IP or DNS
  - EC2 Console -> Instances -> Your instance
  - Public IPv4 address: 54.239.28.85
  - OR
  - Public IPv4 DNS: ec2-54-239-28-85.compute-1.amazonaws.com

Step 4: Know the Default Username
  - Amazon Linux 2 / Amazon Linux 2023: ec2-user
  - Ubuntu: ubuntu
  - CentOS: centos
  - RHEL: ec2-user
  - Debian: admin

Step 5: Ensure Security Group Allows SSH
  - Security Group -> Inbound rules
  - Port 22, TCP, from your IP (My IP) or 0.0.0.0/0

Step 6: Connect
$ ssh -i ~/Downloads/my-key-pair.pem ubuntu@54.239.28.85
OR
$ ssh -i ~/Downloads/my-key-pair.pem ec2-user@54.239.28.85

Expected output:
The authenticity of host '54.239.28.85 (54.239.28.85)' can't be established.
ECDSA key fingerprint is SHA256:abcdef...
Are you sure you want to continue connecting (yes/no)? yes
Warning: Permanently added '54.239.28.85' (ECDSA) to the list of known hosts.

   ___________ 
  |    AWS    |
  |  EC2      |
  |___________|
ubuntu@ip-10-0-1-45:~$    <- You're in!
```

### SCP — Secure Copy

```bash
# Syntax: scp [options] source destination
# Works like cp but over SSH

# Copy file FROM local TO remote
$ scp -i ~/mykey.pem myfile.txt ubuntu@54.239.28.85:/home/ubuntu/
$ scp -i ~/mykey.pem deploy.sh ubuntu@54.239.28.85:/home/ubuntu/scripts/

# Copy file FROM remote TO local
$ scp -i ~/mykey.pem ubuntu@54.239.28.85:/var/log/nginx/error.log ./

# Copy entire directory (-r for recursive)
$ scp -r -i ~/mykey.pem ./myapp ubuntu@54.239.28.85:/home/ubuntu/

# AWS use case:
# Upload application files to EC2:
$ scp -i ec2-key.pem -r ./dist/ ubuntu@54.x.x.x:/var/www/html/

# Download logs from EC2:
$ scp -i ec2-key.pem ubuntu@54.x.x.x:/var/log/app/app.log ./logs/
```

---

## 7. Process Management

### ps — List Running Processes

```bash
# Syntax: ps [options]

# Current shell's processes only
$ ps

# a = all users, u = user-oriented format, x = include non-terminal
$ ps aux
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1  77956  8748 ?        Ss   08:00   0:01 /sbin/init
root       350  0.0  0.0  14432   876 ?        Ss   08:00   0:00 /usr/sbin/sshd
ubuntu    1234  0.0  0.0  21752  3496 pts/0    Ss   10:00   0:00 bash
nginx      890  0.0  0.2 140696 10856 ?        S    08:00   0:00 nginx: worker

# Column meanings:
# USER  = Owner of the process
# PID   = Process ID (unique identifier)
# %CPU  = CPU usage
# %MEM  = Memory usage percentage
# VSZ   = Virtual memory size (KB)
# RSS   = Resident set size (actual RAM used, KB)
# STAT  = Process state (S=sleeping, R=running, Z=zombie, T=stopped)
# START = When it started
# TIME  = Total CPU time consumed
# COMMAND = The command

# Find specific process
$ ps aux | grep nginx
$ ps aux | grep python
$ ps aux | grep -v grep | grep nginx  # Exclude grep itself from results

# AWS use case:
$ ps aux | grep nginx     # Is nginx running?
$ ps aux | grep java      # Check Java app process
$ ps aux --sort=-%mem | head -10  # Top 10 memory consumers
$ ps aux --sort=-%cpu | head -10  # Top 10 CPU consumers
```

### top — Dynamic Process Viewer

```bash
# Interactive real-time process monitor
$ top

# Output header:
# top - 10:30:15 up 2 days, 1:23, 1 user, load average: 0.10, 0.15, 0.20
# Tasks: 89 total, 1 running, 88 sleeping, 0 stopped
# %Cpu(s): 5.0 us, 2.0 sy, 0.0 ni, 92.0 id, 0.0 wa
# MiB Mem : 7838.8 total, 5012.3 free, 1234.5 used, 1592.0 buff/cache
# MiB Swap:  0.0 total, 0.0 free, 0.0 used. 6234.5 avail Mem

# Interactive keys:
# q         -> Quit
# k         -> Kill a process (enter PID)
# M         -> Sort by memory usage
# P         -> Sort by CPU usage (default)
# 1         -> Show per-CPU stats
# h         -> Help

# AWS use case: Check if EC2 instance is under load
$ top
# Watch CPU usage. If consistently >90%, scale up or scale out.
```

### htop (Install if not present)

```bash
# More visual, interactive than top
$ sudo apt install htop -y   # Ubuntu
$ sudo yum install htop -y   # Amazon Linux

$ htop

# Color-coded CPU bars, scrollable process list
# F5 = tree view, F9 = kill, F6 = sort
# Arrow keys to navigate, F10 to quit
```

### kill — Terminate Processes

```bash
# Syntax: kill [signal] PID

# Get PID from ps:
$ ps aux | grep nginx
root   890  nginx: master process

# Send SIGTERM (15) - graceful termination (default)
$ kill 890           # Asks process to shut down gracefully
$ kill -15 890       # Same as above (explicit)

# Send SIGKILL (9) - force kill (cannot be ignored)
$ kill -9 890        # Immediately kills the process
                     # Use when graceful kill doesn't work
                     # Data may be lost if process was writing

# Kill by name (kills ALL processes with that name)
$ killall nginx
$ killall -9 nginx   # Force kill all nginx processes

# Kill by pattern
$ pkill nginx        # Kill processes matching pattern
$ pkill -9 python    # Force kill all python processes

# AWS use case:
# App server hung, need to restart:
$ ps aux | grep node
ubuntu  4521  node app.js
$ kill 4521          # Try graceful first
$ kill -9 4521       # If graceful doesn't work

# Restart nginx after config change:
$ sudo systemctl reload nginx   # Better way (graceful config reload)
```

### Background and Job Control

```bash
# Run command in background with &
$ python3 app.py &
[1] 5678            <- Job number [1], PID 5678

# List background jobs
$ jobs
[1]+  Running    python3 app.py &

# Bring job to foreground
$ fg 1
$ fg %1             # Same thing

# Send running foreground job to background
# First: Ctrl+Z to suspend it
^Z
[1]+  Stopped    python3 app.py

# Resume it in background
$ bg 1
[1]+ python3 app.py &

# Run command that survives shell logout (nohup)
$ nohup python3 app.py &         # Won't die when you logout
$ nohup python3 app.py > app.log 2>&1 &  # Redirect output

# AWS use case: Start app server that persists after SSH disconnect
$ nohup node server.js > /var/log/myapp/app.log 2>&1 &
```

### systemctl — Manage System Services

```bash
# Syntax: systemctl [command] [service]

# Start a service
$ sudo systemctl start nginx
$ sudo systemctl start mysql

# Stop a service
$ sudo systemctl stop nginx

# Restart (stop then start)
$ sudo systemctl restart nginx

# Reload (reload config without restart, zero downtime)
$ sudo systemctl reload nginx

# Check status
$ sudo systemctl status nginx
$ sudo systemctl status mysql

# Example status output:
# ● nginx.service - A high performance web server
#    Loaded: loaded (/lib/systemd/system/nginx.service; enabled)
#    Active: active (running) since Mon 2026-06-08 10:00:00 UTC; 2h ago
#   Process: 890 ExecStart=/usr/sbin/nginx -g daemon on; ...
#  Main PID: 890 (nginx)
#    CGroup: /system.slice/nginx.service
#            ├─890 nginx: master process
#            └─891 nginx: worker process

# Enable service to auto-start on boot
$ sudo systemctl enable nginx

# Disable auto-start
$ sudo systemctl disable nginx

# Check if enabled
$ sudo systemctl is-enabled nginx

# Check if active
$ sudo systemctl is-active nginx

# List all services
$ systemctl list-units --type=service

# AWS use case:
# After installing nginx:
$ sudo systemctl start nginx
$ sudo systemctl enable nginx   # Auto-start after EC2 reboot
$ sudo systemctl status nginx   # Verify it's running
```

### service vs systemctl

```bash
# service (older, works on SysV init systems)
$ sudo service nginx start
$ sudo service nginx stop
$ sudo service nginx restart
$ sudo service nginx status

# systemctl (newer, systemd systems - most modern Linux)
$ sudo systemctl start nginx

# On modern Linux (Ubuntu 20.04+, Amazon Linux 2+):
# 'service' commands actually call systemctl under the hood
# Prefer systemctl - it has more features and is the modern standard
```

---

## 8. Networking Commands

### ip addr — Show Network Interfaces and IPs

```bash
# Modern replacement for ifconfig
$ ip addr
$ ip addr show

# Output:
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
    link/loopback 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo        <- Loopback (localhost)

2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9001
    link/ether 06:ab:cd:ef:12:34          <- MAC address
    inet 10.0.1.45/24 scope global eth0   <- Your private IP in AWS!
    inet6 fe80::4ab:cdff:feef:1234/64     <- IPv6 link-local

# AWS: Your private IP is on eth0, format 10.x.x.x
```

### ip route — Show Routing Table

```bash
$ ip route
default via 10.0.1.1 dev eth0    <- Default route (all non-local traffic goes to 10.0.1.1)
10.0.1.0/24 dev eth0 proto kernel <- Local subnet, direct communication

# "default via 10.0.1.1" means: send unknown traffic to the gateway 10.0.1.1
# That gateway (in AWS) is the VPC router, which checks the VPC route table
```

### ping — Test Connectivity

```bash
# Syntax: ping [options] hostname_or_ip

# Basic ping
$ ping google.com
PING google.com (142.250.80.46): 56 data bytes
64 bytes from 142.250.80.46: icmp_seq=0 ttl=113 time=1.234 ms

# Ping N times (-c)
$ ping -c 4 google.com

# Ping with interval (-i) in seconds
$ ping -i 0.5 -c 10 google.com

# AWS use cases:
$ ping 10.0.1.50          # Test if another EC2 in VPC is reachable
$ ping google.com         # Test if EC2 has internet access
$ ping rds.internal        # Test database connectivity
# Note: ICMP (ping) must be allowed in security groups to work
```

### curl — Transfer Data with URLs

```bash
# Syntax: curl [options] URL

# Basic GET request
$ curl https://api.example.com/users
$ curl http://localhost:3000/health

# -X : Specify HTTP method
$ curl -X GET https://api.example.com/users
$ curl -X POST https://api.example.com/users
$ curl -X DELETE https://api.example.com/users/123

# -H : Add headers
$ curl -H "Authorization: Bearer eyJhbGc..." https://api.example.com/profile
$ curl -H "Content-Type: application/json" https://api.example.com/data

# -d : Send data (body) - automatically uses POST
$ curl -X POST -H "Content-Type: application/json" \
  -d '{"name": "John", "email": "john@example.com"}' \
  https://api.example.com/users

# -o : Save output to file
$ curl -o response.json https://api.example.com/data

# -s : Silent mode (no progress bar)
$ curl -s https://api.example.com/health

# -i : Include response headers
$ curl -i https://example.com

# -I : Only response headers (HEAD request)
$ curl -I https://example.com

# -v : Verbose (show request and response details)
$ curl -v https://example.com

# -L : Follow redirects
$ curl -L http://example.com   # Will follow to https://

# Test with response code
$ curl -o /dev/null -s -w "%{http_code}" https://example.com
200                    <- Just the status code

# AWS use cases:
# Test if your web app is running:
$ curl http://localhost:80
$ curl http://localhost:3000/health

# Hit EC2 metadata service (get instance info):
$ curl http://169.254.169.254/latest/meta-data/instance-id
$ curl http://169.254.169.254/latest/meta-data/public-ipv4
$ curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Test ALB endpoint:
$ curl -I https://myapp.example.com

# POST to API:
$ curl -X POST -H "Content-Type: application/json" \
  -d '{"key": "value"}' \
  https://api.example.com/endpoint
```

### wget — Download Files

```bash
# Syntax: wget [options] URL

# Download a file
$ wget https://example.com/file.zip

# Download with custom name (-O)
$ wget -O myapp.tar.gz https://github.com/org/app/releases/latest.tar.gz

# Download in background (-b)
$ wget -b https://large-file.example.com/bigfile.iso

# Download multiple files from a list
$ wget -i urls.txt

# Resume interrupted download (-c)
$ wget -c https://example.com/bigfile.zip

# AWS use case:
# Download AWS CLI installer:
$ wget https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip

# Download application from S3 (with pre-signed URL):
$ wget "https://mybucket.s3.amazonaws.com/app.tar.gz?X-Amz-..."
```

### nslookup and dig — DNS Lookup

```bash
# nslookup: Basic DNS query
$ nslookup google.com
Server:  8.8.8.8
Address: 8.8.8.8#53

Non-authoritative answer:
Name: google.com
Address: 142.250.80.46

$ nslookup -type=MX gmail.com   # Check mail servers

# dig: More powerful DNS debugging tool
$ dig google.com
; ANSWER SECTION:
google.com.    300    IN    A    142.250.80.46

$ dig +short google.com         # Just the IP
142.250.80.46

$ dig MX gmail.com              # Mail exchange records
$ dig NS amazon.com             # Nameserver records
$ dig CNAME www.amazon.com      # CNAME record

# Reverse DNS (IP to hostname)
$ dig -x 8.8.8.8

# AWS use case:
# Verify Route 53 changes propagated:
$ dig myapp.example.com
$ dig +short myapp.example.com

# Check RDS endpoint resolves correctly:
$ nslookup mydb.abc123.us-east-1.rds.amazonaws.com
```

### netstat and ss — Network Connections

```bash
# ss (modern replacement for netstat)
# -t = TCP, -u = UDP, -l = listening, -n = numeric, -p = show process

# Show all listening ports
$ ss -tuln
Netid  State   Recv-Q  Send-Q  Local Address:Port
tcp    LISTEN  0       128     0.0.0.0:22          <- SSH
tcp    LISTEN  0       511     0.0.0.0:80          <- HTTP
tcp    LISTEN  0       511     0.0.0.0:443         <- HTTPS
tcp    LISTEN  0       128     127.0.0.1:3306      <- MySQL (local only)

# With process info (-p, needs sudo)
$ sudo ss -tulnp

# netstat (older, same concept)
$ netstat -tuln
$ sudo netstat -tulnp

# Show established connections
$ ss -tn       # TCP connections
$ ss -un       # UDP connections

# AWS use case:
# Check which ports are open on EC2:
$ sudo ss -tulnp
# Verify nginx is listening on 80 and 443:
$ ss -tuln | grep -E ':80|:443'
# Check if MySQL is only listening locally (should be):
$ ss -tuln | grep 3306
```

### lsof — List Open Files (including network sockets)

```bash
# Show what's using a specific port
$ sudo lsof -i :80
$ sudo lsof -i :3000
$ sudo lsof -i :443

COMMAND  PID     USER   FD   TYPE DEVICE  NODE NAME
nginx    890     root   9u   IPv4  12345  TCP  *:80 (LISTEN)
nginx    891     nginx  9u   IPv4  12345  TCP  *:80 (LISTEN)

# Show all network connections
$ sudo lsof -i

# Show what's open by a specific process
$ sudo lsof -p 890

# AWS use case:
# Find what's using port 3000:
$ sudo lsof -i :3000
# Quick check of what ports an app is listening on:
$ sudo lsof -i -P -n | grep LISTEN
```

### traceroute — Trace Network Path

```bash
# Shows each hop between you and destination
$ traceroute google.com
traceroute to google.com (142.250.80.46)
 1  10.0.1.1        0.5 ms  <- VPC router
 2  10.20.0.1       1.2 ms  <- AWS backbone
 3  ...
 8  142.250.80.46   5.0 ms  <- Google

# If a hop shows ***, it's blocking ICMP
# AWS use case: Debug why EC2 can't reach external service
$ traceroute api.external-service.com
```

### telnet — Test TCP Port Connectivity

```bash
# Test if you can reach a specific port (TCP)
$ telnet database.example.com 5432
Trying 10.0.20.5...
Connected to database.example.com.
Escape character is '^]'.
# If you see "Connected" - the port is open and reachable
# Press Ctrl+] then quit to exit

# If connection refused:
$ telnet 10.0.20.5 5432
Trying 10.0.20.5...
telnet: connect to address 10.0.20.5: Connection refused
# Port 5432 is not open (DB not running or security group blocking)

# AWS use case: Test if RDS is reachable from EC2
$ telnet mydb.abc123.us-east-1.rds.amazonaws.com 5432
```

---

## 9. Package Managers

### apt (Ubuntu/Debian)

```bash
# Update package list (get latest available versions)
$ sudo apt update

# Upgrade all installed packages to latest versions
$ sudo apt upgrade -y
$ sudo apt full-upgrade -y   # Includes dependency changes

# Install a package
$ sudo apt install nginx -y
$ sudo apt install python3 python3-pip -y
$ sudo apt install git curl wget -y

# Install multiple packages
$ sudo apt install -y nginx git curl wget python3 python3-pip nodejs npm

# Remove a package (keep config files)
$ sudo apt remove nginx

# Purge a package (remove package AND config files)
$ sudo apt purge nginx

# Auto-remove unused packages
$ sudo apt autoremove -y

# Search for a package
$ apt search nginx
$ apt-cache search redis

# Show package info
$ apt show nginx

# List installed packages
$ dpkg -l | grep nginx

# Common installations on Ubuntu EC2:

# Web server:
$ sudo apt update && sudo apt install -y nginx

# Node.js (via NodeSource):
$ curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
$ sudo apt install -y nodejs

# Docker:
$ curl -fsSL https://get.docker.com | sh
$ sudo usermod -aG docker ubuntu

# AWS CLI v2:
$ sudo apt install -y unzip
$ curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
$ unzip awscliv2.zip
$ sudo ./aws/install

# Python and pip:
$ sudo apt install -y python3 python3-pip python3-venv

# Git:
$ sudo apt install -y git
```

### yum (Amazon Linux / RHEL / CentOS)

```bash
# Update package list and upgrade packages
$ sudo yum update -y

# Install a package
$ sudo yum install nginx -y
$ sudo yum install git -y

# Install multiple packages
$ sudo yum install -y nginx git curl wget python3 python3-pip

# Remove a package
$ sudo yum remove nginx

# Search for a package
$ yum search nginx
$ yum list | grep nginx

# Show package info
$ yum info nginx

# List installed packages
$ yum list installed

# Amazon Linux extras (Amazon Linux 2 specific)
$ amazon-linux-extras list
$ sudo amazon-linux-extras install nginx1 -y
$ sudo amazon-linux-extras install python3 -y

# Common installations on Amazon Linux 2023:

# Web server:
$ sudo yum install -y nginx

# Node.js (Amazon Linux 2023 includes it):
$ sudo yum install -y nodejs npm

# Docker:
$ sudo yum install -y docker
$ sudo systemctl start docker
$ sudo systemctl enable docker
$ sudo usermod -aG docker ec2-user

# Python 3 and pip:
$ sudo yum install -y python3 python3-pip

# Git:
$ sudo yum install -y git
```

### dnf (Fedora / RHEL 8+ / Amazon Linux 2023)

```bash
# dnf is the modern replacement for yum on RHEL 8+ systems
# Amazon Linux 2023 uses dnf

$ sudo dnf update -y
$ sudo dnf install nginx -y
$ sudo dnf remove nginx
$ sudo dnf search python
# Syntax is nearly identical to yum
```

---

## 10. Text Editors

### nano — Beginner-Friendly Editor

```bash
# Open/create a file
$ nano config.txt
$ sudo nano /etc/nginx/nginx.conf

# In nano interface:
^G  Get Help     ^O  Write Out    ^W  Where Is     ^K  Cut Line
^X  Exit         ^R  Read File    ^\ Replace        ^U  Paste

# ^ means Ctrl key
# So ^X = Ctrl+X to exit

# Workflow:
# 1. Open file: nano myfile.txt
# 2. Edit content (arrow keys to navigate)
# 3. Save: Ctrl+O, then Enter (to confirm filename)
# 4. Exit: Ctrl+X
# Or: Ctrl+X -> Y (yes save) -> Enter

# Search: Ctrl+W, type search term, Enter
# Go to line: Ctrl+_, enter line number
```

### vim — Powerful Editor (Steep Learning Curve)

```bash
# Open file
$ vim myfile.txt
$ sudo vim /etc/nginx/nginx.conf

# vim has MODES:
# Normal mode (default on open) - for navigation and commands
# Insert mode - for typing text
# Visual mode - for selecting text
# Command mode - for running commands (:wq, :q!, etc.)

# MOST IMPORTANT vim commands:

# Entering modes:
i     <- Insert mode BEFORE cursor (start typing)
I     <- Insert at beginning of line
a     <- Insert AFTER cursor
A     <- Insert at end of line
o     <- Open new line BELOW and enter insert mode
O     <- Open new line ABOVE and enter insert mode

# Returning to Normal mode:
Esc   <- Return to Normal mode (press whenever confused)

# SAVING and QUITTING (most asked in interviews):
:w    <- Save (write) without quitting
:q    <- Quit (fails if unsaved changes)
:wq   <- Save and quit (most common)
:q!   <- Quit WITHOUT saving (discard changes - the "I messed up" command)
:x    <- Save and quit (same as :wq)

# Navigation in Normal mode:
h     <- Move left
j     <- Move down
k     <- Move up
l     <- Move right
gg    <- Go to beginning of file
G     <- Go to end of file
:50   <- Go to line 50
0     <- Go to beginning of line
$     <- Go to end of line
w     <- Move forward one word
b     <- Move backward one word

# Editing in Normal mode:
dd    <- Delete (cut) entire line
d5d or 5dd  <- Delete 5 lines
yy    <- Copy (yank) current line
5yy   <- Copy 5 lines
p     <- Paste below cursor
P     <- Paste above cursor
u     <- Undo
Ctrl+r <- Redo
x     <- Delete character under cursor
dw    <- Delete word

# Search:
/pattern   <- Search forward for pattern
n          <- Next match
N          <- Previous match
:%s/old/new/g  <- Replace all occurrences of "old" with "new"

# AWS use case:
$ sudo vim /etc/nginx/sites-available/myapp
$ vim ~/.bashrc
$ vim /home/ec2-user/setup.sh

# Practical vim session:
$ vim test.txt
# You see empty file
i                          # Enter insert mode
Hello World                # Type your text
Esc                        # Return to normal mode
:wq                        # Save and quit
```

---

## 11. File Operations and I/O Redirection

### Redirection

```bash
# > : Redirect stdout to file (OVERWRITE)
$ ls -la > filelist.txt
$ echo "Hello" > greeting.txt

# >> : Redirect stdout to file (APPEND)
$ echo "New line" >> greeting.txt
$ date >> /var/log/myscript.log    # Append timestamp to log

# < : Redirect stdin from file
$ mysql -u root -p mydb < backup.sql    # Run SQL from file
$ sort < unsorted.txt

# 2> : Redirect stderr to file
$ command-that-might-fail 2> error.log

# 2>&1 : Redirect stderr to same place as stdout
$ command > output.log 2>&1            # Both stdout and stderr to file
$ command > /dev/null 2>&1             # Discard ALL output (silent)

# |& : Pipe both stdout and stderr
$ command |& grep "error"

# Examples:
# Run command and save all output (success and errors):
$ ./deploy.sh > /var/log/deploy.log 2>&1

# Silent execution (cron jobs often use this):
$ python3 cleanup.py > /dev/null 2>&1

# Capture output in variable:
$ output=$(ls -la)
$ echo "$output"

# AWS use case:
# User Data script logging:
$ exec > >(tee /var/log/user-data.log) 2>&1
# Everything after this line is logged

# Capture AWS CLI output:
$ aws ec2 describe-instances --query "..." > instances.json 2>&1
```

### Pipes

```bash
# | : Pipe output of one command as input to another

# Filter ls output with grep
$ ls -la | grep ".conf"
$ ls -lh | sort -k5 -h | tail   # Largest files

# Count lines matching a pattern
$ grep "ERROR" app.log | wc -l

# Chain multiple commands
$ ps aux | grep nginx | grep -v grep | awk '{print $2}'

# View long output page by page
$ cat /etc/nginx/nginx.conf | less
$ ls -la /var/log/ | less

# Sort and unique:
$ cat ips.txt | sort | uniq -c | sort -rn | head -20

# AWS use case: Count 404 errors per hour
$ grep "404" /var/log/nginx/access.log | awk '{print $4}' | \
  cut -c2-14 | sort | uniq -c | sort -rn

# Get instance IDs from AWS CLI
$ aws ec2 describe-instances | jq '.Reservations[].Instances[].InstanceId'
```

---

## 12. Environment Variables

### What are Environment Variables?

Environment variables are key-value pairs stored in the shell's environment. They configure behavior of programs, store settings, and pass information between processes.

```bash
# View all environment variables
$ env
$ printenv

# View specific variable
$ echo $HOME
/home/ubuntu

$ echo $USER
ubuntu

$ echo $PATH
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Common built-in variables:
echo $HOME      # /home/ubuntu (home directory)
echo $USER      # ubuntu (current user)
echo $SHELL     # /bin/bash (current shell)
echo $PWD       # /home/ubuntu (current directory)
echo $PATH      # Search path for executables
echo $HOSTNAME  # ip-10-0-1-45 (EC2 private hostname)
echo $LANG      # en_US.UTF-8 (locale)

# Set a temporary variable (only in current session)
$ export MY_VAR="hello"
$ echo $MY_VAR
hello
$ export DB_HOST="10.0.20.5"
$ export DB_PORT="5432"
$ export APP_ENV="production"

# Use in commands
$ echo "Connecting to $DB_HOST:$DB_PORT"
Connecting to 10.0.20.5:5432

# Unset a variable
$ unset MY_VAR
```

### Making Variables Permanent

```bash
# ~/.bashrc: Executed for interactive non-login shells
# (When you open a new terminal)
$ nano ~/.bashrc

# Add at the bottom:
export AWS_DEFAULT_REGION="us-east-1"
export NODE_ENV="production"
export DB_HOST="10.0.20.5"

# Apply changes without reopening terminal
$ source ~/.bashrc
# or
$ . ~/.bashrc

# ~/.bash_profile or ~/.profile: Executed for login shells
# (When you SSH in)
$ nano ~/.bash_profile

# For system-wide variables (all users):
$ sudo nano /etc/environment
PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
AWS_DEFAULT_REGION="us-east-1"

# AWS use case: Set AWS credentials (not recommended, but for dev):
$ export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
$ export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
$ export AWS_DEFAULT_REGION="us-east-1"

# Better: Use ~/.aws/credentials file or IAM roles
```

---

## 13. Cron Jobs

### What is Cron?

Cron is a time-based job scheduler in Linux. It runs commands or scripts automatically at specified intervals.

```bash
# Edit cron jobs for current user
$ crontab -e

# List current cron jobs
$ crontab -l

# Remove all cron jobs
$ crontab -r

# Edit system-wide cron
$ sudo crontab -e
$ sudo nano /etc/crontab
```

### Cron Expression Format

```
Cron expression format:
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6, Sunday=0)
│ │ │ │ │
│ │ │ │ │
* * * * * command_to_execute

Special characters:
* = any value (wildcard)
, = list separator (0,15,30,45 = every 15 min)
- = range (1-5 = Monday through Friday)
/ = step (*/5 = every 5 units)
```

### Cron Examples

```bash
# Every minute
* * * * * /path/to/script.sh

# Every 5 minutes
*/5 * * * * /path/to/script.sh

# Every hour at minute 0
0 * * * * /path/to/script.sh

# Every day at 2am
0 2 * * * /path/to/backup.sh

# Every Monday at 9am
0 9 * * 1 /path/to/weekly-report.sh

# Every weekday (Monday-Friday) at 8:30am
30 8 * * 1-5 /path/to/script.sh

# Every day at midnight
0 0 * * * /path/to/cleanup.sh

# 1st of every month at 6am
0 6 1 * * /path/to/monthly-report.sh

# Every 15 minutes
*/15 * * * * /path/to/health-check.sh

# Every day at 2:30am
30 2 * * * /home/ubuntu/backup.sh >> /var/log/backup.log 2>&1

# AWS use cases:
# Daily backup to S3:
0 2 * * * aws s3 sync /var/backups/ s3://mybucket/backups/ >> /var/log/backup.log 2>&1

# Rotate logs every hour:
0 * * * * /usr/sbin/logrotate /etc/logrotate.conf

# Check disk space every 5 minutes and alert:
*/5 * * * * /home/ubuntu/scripts/check-disk.sh >> /var/log/disk-check.log 2>&1

# Set up a cron job:
$ crontab -e
# Opens vim or nano
# Add line:
0 2 * * * /home/ubuntu/backup.sh >> /var/log/backup.log 2>&1
# Save and exit
```

---

## 14. Interview Q&A

### Q1: How do you check if a process is running?

**Answer:** Several ways:
```bash
ps aux | grep nginx           # Look for the process
systemctl status nginx        # If it's a system service
pgrep nginx                   # Returns PID if running
```

---

### Q2: What does chmod 755 mean?

**Answer:** 755 in numeric permissions means:
- Owner (user): 7 = read(4) + write(2) + execute(1) = rwx
- Group: 5 = read(4) + execute(1) = r-x
- Others: 5 = read(4) + execute(1) = r-x
String representation: -rwxr-xr-x
Typically used for scripts and executables — owner can modify and run, others can only run.

---

### Q3: What is the difference between kill and kill -9?

**Answer:** `kill PID` sends SIGTERM (signal 15) — a polite request to terminate. The process can handle this signal, do cleanup (close files, finish current work), and exit gracefully. `kill -9 PID` sends SIGKILL (signal 9) — an immediate, forced termination. The OS kills the process instantly. SIGKILL cannot be caught or ignored by the process. Use SIGTERM first; use SIGKILL only if the process doesn't respond.

---

### Q4: How do you SSH into an EC2 instance?

**Answer:**
1. Set correct permissions on key: `chmod 400 mykey.pem`
2. Ensure security group allows port 22 from your IP
3. Run: `ssh -i mykey.pem ubuntu@<public-ip>` (or ec2-user for Amazon Linux)

---

### Q5: What does tail -f do?

**Answer:** `tail -f` (follow) displays the last 10 lines of a file and then continues to monitor the file, printing new lines as they're added. It's used for real-time log monitoring — you can watch application logs update live. Press Ctrl+C to stop.

---

### Q6: What is the difference between > and >> in shell?

**Answer:** `>` redirects output to a file and overwrites it (if file exists, content is replaced). `>>` appends to the file (existing content is preserved, new output added at the end). For log files, always use >> so you don't lose history.

---

### Q7: Explain the Linux file permission string -rwxr-xr-x

**Answer:** Breaking it down character by character:
- `-` = regular file (d=directory, l=link)
- `rwx` = owner permissions: read, write, execute (7)
- `r-x` = group permissions: read, no write, execute (5)
- `r-x` = others permissions: read, no write, execute (5)
Numeric: 755. The owner can read, write, and execute; everyone else can only read and execute.

---

### Q8: How do you find files larger than 100MB on a Linux system?

**Answer:** `find / -size +100M -type f` — this recursively searches from root for regular files larger than 100MB. In production, you'd narrow it: `find /var/log -size +100M -type f` to look for large log files that might be filling the disk. Add `-ls` to see details or `-exec rm {} \;` to delete them.

---

### Q9: What is the difference between apt and yum?

**Answer:** Both are package managers, but for different Linux families:
- `apt` is used on Debian-based systems: Ubuntu, Debian, Raspbian
- `yum` (or `dnf`) is used on Red Hat-based systems: Amazon Linux, CentOS, RHEL, Fedora

AWS Amazon Linux 2023 uses `dnf`. Ubuntu EC2s use `apt`. The commands are very similar: `apt install nginx` vs `yum install nginx`. The underlying package formats differ (.deb for apt, .rpm for yum).

---

### Q10: How do you make a cron job run every 5 minutes?

**Answer:** The cron expression `*/5 * * * * /path/to/script.sh` runs the script every 5 minutes. The `*/5` means "every 5th minute" (0, 5, 10, 15... 55). You add this with `crontab -e`. To ensure output is logged: `*/5 * * * * /path/to/script.sh >> /var/log/script.log 2>&1`

---

### Q11: What is the difference between systemctl enable and systemctl start?

**Answer:** `systemctl start nginx` starts the service immediately for the current session. If the server reboots, nginx won't start automatically. `systemctl enable nginx` configures nginx to start automatically on every boot (creates symlinks in systemd startup directories). For a production server, you almost always want both: `sudo systemctl start nginx && sudo systemctl enable nginx`.

---

### Q12: What does 2>&1 mean in shell redirection?

**Answer:** `2>&1` redirects file descriptor 2 (stderr, error output) to wherever file descriptor 1 (stdout, standard output) is currently pointing. Used with `> file.log 2>&1`, it means "send both stdout and stderr to file.log." Useful for capturing all output from a command, including error messages. Example: `./deploy.sh > deploy.log 2>&1` captures all output including any errors.
