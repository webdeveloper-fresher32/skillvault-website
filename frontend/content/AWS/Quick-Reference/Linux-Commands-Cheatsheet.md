# Linux Commands Cheatsheet for AWS Engineers

---

## Navigation Commands

| Command | Description | Common Options | Example |
|---|---|---|---|
| `pwd` | Print working directory — shows your current location | — | `pwd` → `/home/ubuntu` |
| `ls` | List directory contents | `-l` long format, `-a` all (including hidden), `-la` both, `-h` human-readable sizes, `-R` recursive, `-t` sort by time, `-S` sort by size | `ls -lah /var/log` |
| `cd` | Change directory | `cd ~` go home, `cd -` go to previous directory, `cd ..` go up one level, `cd /` go to root | `cd /etc/nginx/` |
| `find` | Search for files/directories by attributes | `-name` by name, `-type f` files only, `-type d` dirs only, `-mtime -7` modified last 7 days, `-size +100M` larger than 100MB, `-exec` execute command on results | `find /var/log -name "*.log" -mtime -1` |
| `locate` | Fast file search using pre-built database | `-i` case-insensitive | `locate nginx.conf` (run `sudo updatedb` first to refresh) |
| `tree` | Display directory tree structure | `-L 2` limit depth to 2 levels, `-d` directories only | `tree -L 2 /etc/nginx` |

**find examples:**
```bash
find . -name "*.py" -type f                    # All Python files recursively
find /home -user ubuntu                        # Files owned by ubuntu
find /tmp -type f -mtime +7 -delete            # Delete files in /tmp older than 7 days
find / -size +500M 2>/dev/null                 # Files larger than 500MB
find . -name "*.log" -exec gzip {} \;          # Gzip all .log files
find /var/log -name "*.log" -newer /etc/hosts  # Log files newer than /etc/hosts
```

---

## File Operations

| Command | Description | Key Flags | Example |
|---|---|---|---|
| `cat` | Display entire file content | `-n` show line numbers, `-A` show special characters | `cat /etc/hosts` |
| `less` | Page through file content (scrollable) | `q` quit, `/term` search, `n` next match, `G` end, `g` start | `less /var/log/syslog` |
| `more` | Page through file (forward only) | Space = next page, `q` = quit | `more /etc/services` |
| `head` | Show first N lines of file | `-n 20` show 20 lines (default: 10) | `head -n 50 /var/log/nginx/access.log` |
| `tail` | Show last N lines of file | `-n 20` last 20 lines, `-f` follow (live stream) | `tail -f /var/log/nginx/access.log` |
| `cp` | Copy files or directories | `-r` recursive (dirs), `-p` preserve permissions/timestamps, `-v` verbose output | `cp -rp /var/www /backup/www-$(date +%F)` |
| `mv` | Move or rename files | `-v` verbose, `-i` interactive (confirm overwrite) | `mv app.py app_old.py` |
| `rm` | Delete files or directories | `-r` recursive (dirs), `-f` force (no prompt), `-i` interactive | `rm -rf /tmp/build-artifacts/` |
| `mkdir` | Create directories | `-p` create parent directories as needed | `mkdir -p /var/app/logs/2024/01` |
| `touch` | Create empty file or update timestamp | — | `touch /var/lock/my-script.lock` |
| `ln` | Create links | `-s` symbolic link (soft link) | `ln -s /usr/local/bin/python3 /usr/bin/python` |
| `file` | Determine file type | — | `file /usr/bin/python3` → `ELF 64-bit LSB executable` |
| `stat` | Display detailed file metadata | — | `stat /etc/passwd` (shows inode, timestamps, permissions) |
| `diff` | Compare two files line by line | `-u` unified format, `-r` recursive for directories | `diff -u config.old config.new` |
| `wc` | Count lines, words, or characters | `-l` lines, `-w` words, `-c` bytes/characters | `wc -l /var/log/auth.log` |

**Practical combinations:**
```bash
tail -f /var/log/nginx/access.log | grep "ERROR"    # Live error monitoring
cat /etc/passwd | cut -d: -f1                        # List all usernames
ls -lah /var/log/*.log | sort -k5 -hr               # Log files sorted by size (largest first)
cp -p /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak  # Backup config before editing
```

---

## Text Processing

### grep — Search for Patterns

| Option | Description | Example |
|---|---|---|
| `grep "pattern" file` | Basic search | `grep "ERROR" /var/log/app.log` |
| `-i` | Case-insensitive match | `grep -i "error" app.log` |
| `-v` | Invert match (show non-matching lines) | `grep -v "DEBUG" app.log` |
| `-n` | Show line numbers | `grep -n "404" access.log` |
| `-r` | Recursive search in directories | `grep -r "database_host" /etc/` |
| `-A N` | Show N lines After match | `grep -A 5 "ERROR" app.log` |
| `-B N` | Show N lines Before match | `grep -B 3 "ERROR" app.log` |
| `-C N` | Show N lines Context (before + after) | `grep -C 5 "FATAL" app.log` |
| `-E` | Extended regex (alternation, quantifiers) | `grep -E "ERROR\|FATAL\|WARN" app.log` |
| `-l` | Show only filenames with matches | `grep -rl "password" /etc/` |
| `-c` | Count matching lines | `grep -c "200" access.log` |
| `-w` | Match whole word only | `grep -w "root" /etc/passwd` |
| `-o` | Show only the matching part | `grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" access.log` |

```bash
grep "POST /api" access.log | grep " 500 "              # POST requests that returned 500
grep -rn "TODO\|FIXME" /var/app/src/ --include="*.py"  # Find TODOs in Python files
grep -E "^(ERROR|FATAL)" application.log                # Lines starting with ERROR or FATAL
```

### awk — Field Processing and Pattern Matching

| Example | What It Does |
|---|---|
| `awk '{print $1}' file` | Print first field (default delimiter: whitespace) |
| `awk '{print $NF}' file` | Print last field ($NF = number of fields) |
| `awk -F: '{print $1, $3}' /etc/passwd` | Custom delimiter (colon), print fields 1 and 3 |
| `awk '/ERROR/ {print $0}' app.log` | Print lines containing ERROR |
| `awk '{sum += $5} END {print sum}' file` | Sum column 5 |
| `awk '$5 > 1000 {print}' file` | Print rows where column 5 > 1000 |
| `awk 'NR>=10 && NR<=20' file` | Print lines 10 through 20 |
| `awk 'END {print NR}' file` | Print total number of lines |
| `awk '{print $1}' access.log \| sort \| uniq -c \| sort -rn` | Count requests per IP, sort by frequency |

```bash
# Extract HTTP status codes and count occurrences
awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Sum bytes transferred in nginx log (field 10)
awk '{sum += $10} END {printf "Total: %.2f GB\n", sum/1024/1024/1024}' access.log

# Print lines where response time > 1 second
awk '$NF > 1.0 {print}' timed_requests.log
```

### sed — Stream Editor for Text Transformation

| Example | What It Does |
|---|---|
| `sed 's/old/new/g' file` | Replace all occurrences of "old" with "new" |
| `sed 's/old/new/' file` | Replace first occurrence per line only |
| `sed 's/old/new/gi' file` | Replace all, case-insensitive |
| `sed -i 's/old/new/g' file` | Edit file in-place (modifies the file directly) |
| `sed -i.bak 's/old/new/g' file` | In-place edit with backup (.bak file created) |
| `sed '/pattern/d' file` | Delete lines matching pattern |
| `sed '5d' file` | Delete line 5 |
| `sed '5,10d' file` | Delete lines 5 through 10 |
| `sed -n '5,10p' file` | Print only lines 5 through 10 |
| `sed -n '/ERROR/p' file` | Print only lines matching ERROR |
| `sed 'NR>=5 && NR<=10' file` | Print lines 5-10 (awk syntax in sed) |
| `sed 's/^/PREFIX: /' file` | Add prefix to every line |
| `sed '/^#/d' file` | Remove comment lines |
| `sed '/^$/d' file` | Remove blank lines |

```bash
# Update hostname in config file (in-place with backup)
sed -i.bak 's/localhost/prod-db.internal/g' /etc/app/config.ini

# Remove comment and blank lines from config
sed '/^#/d; /^$/d' /etc/nginx/nginx.conf

# Add a timestamp to each line of a log
sed "s/^/$(date '+%Y-%m-%d') /" events.txt
```

### sort, uniq, cut, wc

| Command | Option | Description | Example |
|---|---|---|---|
| `sort` | `-n` | Numeric sort (not lexicographic) | `sort -n sizes.txt` |
| `sort` | `-r` | Reverse sort | `sort -rn numbers.txt` |
| `sort` | `-k 2` | Sort by field 2 | `sort -k2,2n data.txt` |
| `sort` | `-u` | Sort and remove duplicates | `sort -u ips.txt` |
| `sort` | `-t:` | Set delimiter (for -k) | `sort -t: -k3,3n /etc/passwd` |
| `uniq` | `-c` | Count occurrences before each unique line | `sort access.log \| uniq -c` |
| `uniq` | `-d` | Show only duplicate lines | `sort file \| uniq -d` |
| `uniq` | `-u` | Show only unique (non-duplicate) lines | `sort file \| uniq -u` |
| `cut` | `-d: -f1` | Delimiter colon, extract field 1 | `cut -d: -f1 /etc/passwd` |
| `cut` | `-d" " -f1-3` | First 3 space-separated fields | `cut -d" " -f1-3 access.log` |
| `cut` | `-c1-10` | First 10 characters | `cut -c1-10 file.txt` |
| `wc` | `-l` | Count lines | `wc -l /etc/passwd` |
| `wc` | `-w` | Count words | `wc -w document.txt` |
| `wc` | `-c` | Count bytes | `wc -c binary.file` |

**Power combinations:**
```bash
# Top 10 IPs hitting your server
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

# Count unique HTTP status codes
awk '{print $9}' access.log | sort | uniq -c | sort -rn

# Find duplicate lines in a file
sort file.txt | uniq -d

# Word frequency count in a text file
tr ' ' '\n' < document.txt | sort | uniq -c | sort -rn | head -20
```

---

## File Permissions Reference

### chmod Numeric Table

| Number | Binary | Permissions | Symbol |
|---|---|---|---|
| **7** | 111 | Read + Write + Execute | `rwx` |
| **6** | 110 | Read + Write | `rw-` |
| **5** | 101 | Read + Execute | `r-x` |
| **4** | 100 | Read only | `r--` |
| **3** | 011 | Write + Execute | `-wx` |
| **2** | 010 | Write only | `-w-` |
| **1** | 001 | Execute only | `--x` |
| **0** | 000 | No permissions | `---` |

**Permission format:** `chmod [owner][group][other] file` — three digits, one for each class.

### Common Permission Combinations

| Mode | Permissions | Use Case |
|---|---|---|
| `644` | Owner: rw-, Group: r--, Other: r-- | Standard files (configs, HTML, CSS, JS) |
| `755` | Owner: rwx, Group: r-x, Other: r-x | Directories, shell scripts, executables |
| `700` | Owner: rwx, Group: ---, Other: --- | Private directories (e.g., `~/.ssh/`) |
| `600` | Owner: rw-, Group: ---, Other: --- | SSH private keys, `.env` files, secrets |
| `400` | Owner: r--, Group: ---, Other: --- | Downloaded AWS `.pem` key pairs (read-only) |
| `777` | Owner: rwx, Group: rwx, Other: rwx | Dangerous — everyone has full control. Never use in production. |
| `640` | Owner: rw-, Group: r--, Other: --- | Config files readable by group but not others |
| `664` | Owner: rw-, Group: rw-, Other: r-- | Files shared within a group |

### Symbolic chmod

| Command | Description |
|---|---|
| `chmod +x script.sh` | Add execute for all (owner, group, other) |
| `chmod -w file.txt` | Remove write for all |
| `chmod u+x file` | Add execute for owner only |
| `chmod go-w file` | Remove write from group and other |
| `chmod a+r file` | Add read for all |
| `chmod u=rwx,g=rx,o=r file` | Set exact permissions symbolically |
| `chmod -R 755 /var/www` | Recursive: apply to all files/dirs within |

### File Ownership and Permission Commands

| Command | Description | Example |
|---|---|---|
| `chmod 755 file` | Change file permissions | `chmod 600 ~/.ssh/id_rsa` |
| `chown user file` | Change owner | `chown ubuntu /var/app/config.ini` |
| `chown user:group file` | Change owner and group | `chown www-data:www-data /var/www/html` |
| `chown -R user:group dir` | Recursive ownership change | `chown -R ec2-user:ec2-user /opt/app` |
| `chgrp group file` | Change group only | `chgrp developers /var/shared/` |
| `ls -la` | Long listing with permissions, owner, group, size, modified time | `ls -la /etc/nginx/` |
| `id` | Show current user's UID, GID, and group memberships | `id` |
| `whoami` | Print current username | `whoami` |
| `sudo command` | Run command as root | `sudo systemctl restart nginx` |
| `su - username` | Switch to another user (with their environment) | `su - postgres` |
| `sudo -u user command` | Run command as specific user | `sudo -u www-data php artisan migrate` |

**Reading `ls -la` output:**
```
-rw-r--r-- 1 ubuntu ubuntu 4096 Jan 15 10:30 config.txt
│││││││││  │   │       │     │      │            └── filename
│││││││││  │   │       │     │      └── last modified date
│││││││││  │   │       │     └── file size in bytes
│││││││││  │   │       └── group name
│││││││││  │   └── owner name
│││││││││  └── number of hard links
│││││││││
│└──────┴── permissions: owner(rw-) group(r--) other(r--)
└── file type: - = regular file, d = directory, l = symlink
```

**Fix common permission issues:**
```bash
chmod 400 ~/my-key.pem                   # Fix "Permissions too open" SSH key error
chmod -R 755 /var/www/html               # Fix web server can't read files
chown -R www-data:www-data /var/www      # Fix Nginx/Apache permission denied
chmod 600 ~/.ssh/authorized_keys         # Fix SSH authorized_keys permissions
```

---

## SSH Reference

### Basic Connection Examples

```bash
# Basic SSH to EC2 Ubuntu instance
ssh -i ~/my-key.pem ubuntu@52.12.34.56

# Basic SSH to EC2 Amazon Linux
ssh -i ~/my-key.pem ec2-user@52.12.34.56

# Connect to a specific port (if SSH is not on 22)
ssh -i ~/my-key.pem -p 2222 ubuntu@52.12.34.56

# Connect with verbose output (for troubleshooting)
ssh -v -i ~/my-key.pem ubuntu@52.12.34.56

# Extra verbose for deep debugging
ssh -vvv -i ~/my-key.pem ubuntu@52.12.34.56

# Keep connection alive (prevent timeout)
ssh -o ServerAliveInterval=60 -i ~/my-key.pem ubuntu@52.12.34.56
```

### SSH Jump Host (Bastion Host)

Access private EC2 instances by jumping through a bastion host in the public subnet.

```bash
# Method 1: ProxyJump (modern, recommended, OpenSSH 7.3+)
ssh -J ubuntu@54.12.34.56 ubuntu@10.0.10.100
# -J bastion_public_ip   private_instance_ip

# Method 2: ProxyCommand (older, more compatible)
ssh -o ProxyCommand="ssh -W %h:%p -i ~/key.pem ubuntu@54.12.34.56" \
    -i ~/key.pem ubuntu@10.0.10.100

# Method 3: Two-hop manually (not recommended — key stays on bastion)
ssh -i ~/key.pem ubuntu@54.12.34.56   # First: connect to bastion
ssh ubuntu@10.0.10.100                 # Then: connect to private instance from bastion
```

### SCP — Secure Copy

```bash
# Upload a single file to EC2
scp -i ~/my-key.pem ./app.tar.gz ubuntu@52.12.34.56:/home/ubuntu/

# Upload to specific remote directory
scp -i ~/my-key.pem ./config.ini ubuntu@52.12.34.56:/etc/app/config.ini

# Download a file from EC2 to local
scp -i ~/my-key.pem ubuntu@52.12.34.56:/var/log/app.log ./logs/

# Upload an entire directory recursively
scp -r -i ~/my-key.pem ./my-project/ ubuntu@52.12.34.56:/home/ubuntu/my-project/

# SCP through a bastion host
scp -o "ProxyJump ubuntu@54.12.34.56" -i ~/key.pem \
    ./file.txt ubuntu@10.0.10.100:/home/ubuntu/

# Specify custom port
scp -P 2222 -i ~/key.pem ./file.txt ubuntu@52.12.34.56:/home/ubuntu/
```

### SSH Config File (~/.ssh/config)

The SSH config file lets you define shortcuts for frequently used connections.

```
# ~/.ssh/config

# Bastion Host (Public EC2 in public subnet)
Host bastion
    HostName 54.12.34.56
    User ubuntu
    IdentityFile ~/.ssh/my-key.pem
    ServerAliveInterval 60

# Production App Server (Private EC2 - jump through bastion)
Host prod-app
    HostName 10.0.10.100
    User ubuntu
    IdentityFile ~/.ssh/my-key.pem
    ProxyJump bastion

# Development Server
Host dev-server
    HostName 52.99.88.77
    User ubuntu
    IdentityFile ~/.ssh/dev-key.pem
    Port 2222

# All AWS EC2 instances in 10.0.x.x range
Host 10.0.*
    User ubuntu
    IdentityFile ~/.ssh/my-key.pem
    ProxyJump bastion
    StrictHostKeyChecking no
```

**With the config above:**
```bash
ssh bastion              # Connect to bastion host
ssh prod-app             # Connect directly to private EC2 (jumps through bastion automatically)
scp ./file.txt prod-app:/home/ubuntu/  # SCP to private EC2 via bastion
```

### Key Generation

```bash
# Generate RSA key (4096-bit for maximum security)
ssh-keygen -t rsa -b 4096 -C "your-email@example.com" -f ~/.ssh/my-key

# Generate Ed25519 key (modern, smaller, equally secure)
ssh-keygen -t ed25519 -C "your-email@example.com" -f ~/.ssh/my-key-ed25519

# Generate without passphrase (for automation, CI/CD)
ssh-keygen -t ed25519 -f ~/.ssh/deploy-key -N ""

# View public key
cat ~/.ssh/my-key.pub

# Copy public key to a server (adds to ~/.ssh/authorized_keys)
ssh-copy-id -i ~/.ssh/my-key.pub ubuntu@52.12.34.56
ssh-copy-id -i ~/.ssh/my-key.pub -p 2222 ubuntu@52.12.34.56  # Custom port
```

### SSH Port Forwarding (Tunneling)

```bash
# LOCAL port forwarding: access remote service via local port
# Use case: access RDS (port 5432) that's in a private subnet, via bastion
ssh -L 5432:rds-endpoint.rds.amazonaws.com:5432 -N -i ~/key.pem ubuntu@bastion-ip
# Now connect to localhost:5432 in your DB client → goes to RDS through SSH tunnel

# LOCAL forwarding to private EC2 web server on port 8080
ssh -L 8080:10.0.10.100:8080 -N -i ~/key.pem ubuntu@bastion-ip
# Visit http://localhost:8080 in your browser

# REMOTE port forwarding: expose local port on remote server
# Use case: let remote server access a service running on your local machine
ssh -R 8080:localhost:3000 -N ubuntu@remote-server
# Requests to remote-server:8080 → forwarded to your local machine:3000

# DYNAMIC port forwarding: create a SOCKS proxy
# Use case: route all browser traffic through a remote server
ssh -D 1080 -N -i ~/key.pem ubuntu@52.12.34.56
# Configure browser to use SOCKS5 proxy: localhost:1080
# All browser traffic now routes through the EC2 instance

# Flags: -N = don't execute remote command (just tunnel), -f = run in background
ssh -L 5432:db.internal:5432 -N -f -i ~/key.pem ubuntu@bastion-ip
```

### Troubleshooting SSH Issues

```bash
# Problem: "WARNING: UNPROTECTED PRIVATE KEY FILE!"
chmod 400 ~/my-key.pem
chmod 600 ~/.ssh/id_rsa

# Problem: "Permission denied (publickey)"
# Check 1: Are you using the correct username?
# Ubuntu: ubuntu, Amazon Linux: ec2-user, CentOS: centos, RHEL: ec2-user, Debian: admin
# Check 2: Is the correct public key in ~/.ssh/authorized_keys on the remote?
# Check 3: Verbose mode to see which keys are being tried:
ssh -vvv -i ~/my-key.pem ubuntu@52.12.34.56

# Problem: Connection times out (no response)
# Check Security Group: allow port 22 from your IP
# Check NACL: allow port 22 inbound AND ephemeral ports outbound
# Check if instance is running: EC2 console
# Check instance reachability: EC2 > Actions > Monitor and troubleshoot

# Problem: Host key changed (MITM warning)
ssh-keygen -R 52.12.34.56   # Remove old host key and reconnect

# Check SSH service on remote (run from EC2 console/SSM):
sudo systemctl status sshd
sudo tail -f /var/log/auth.log        # Ubuntu
sudo tail -f /var/log/secure          # Amazon Linux/CentOS
```

---

## Process Management

| Command | Description | Example |
|---|---|---|
| `ps aux` | Show all running processes (all users, detailed) | `ps aux \| grep nginx` |
| `ps -ef` | Full format process list with PPID | `ps -ef \| grep java` |
| `top` | Real-time process monitor (interactive) | `top` then `k` to kill, `r` to renice, `M` sort by memory, `P` sort by CPU, `q` quit |
| `htop` | Enhanced interactive process viewer (color, tree view) | `htop` (install: `sudo apt install htop`) |
| `kill PID` | Send signal to process by PID | `kill 1234` (sends SIGTERM, graceful stop) |
| `kill -9 PID` | Force kill process (SIGKILL, cannot be caught) | `kill -9 1234` |
| `kill -15 PID` | Send SIGTERM explicitly (same as default kill) | `kill -15 1234` |
| `kill -1 PID` | Send SIGHUP (reload config for many daemons) | `kill -1 $(cat /var/run/nginx.pid)` |
| `killall nginx` | Kill all processes named nginx | `killall nginx` |
| `pkill -f "python app"` | Kill processes matching pattern | `pkill -f "gunicorn"` |
| `pgrep nginx` | Find PID of process by name | `pgrep -l nginx` (-l shows names) |
| `nice -n 10 command` | Start process with lower priority (+19 to -20, higher = lower priority) | `nice -n 15 tar -czf backup.tar.gz /data` |
| `renice 10 -p PID` | Change priority of running process | `renice 5 -p 1234` |
| `jobs` | List background jobs in current shell | `jobs` |
| `bg %1` | Resume job 1 in background | `bg %1` |
| `fg %1` | Bring job 1 to foreground | `fg %1` |
| `nohup command &` | Run command that survives shell exit, in background | `nohup python3 app.py > app.log 2>&1 &` |
| `Ctrl+Z` | Suspend current foreground process | (keyboard shortcut) |
| `Ctrl+C` | Kill current foreground process (SIGINT) | (keyboard shortcut) |
| `lsof -i :8080` | List processes using port 8080 | `lsof -i :443` |
| `lsof -p PID` | List all files open by a process | `lsof -p 1234` |

**Signals reference:**
| Signal | Number | Description |
|---|---|---|
| SIGTERM | 15 | Graceful termination request. Process can catch and clean up. |
| SIGKILL | 9 | Forced immediate kill. Cannot be caught, ignored, or blocked. |
| SIGHUP | 1 | Hang up. Many daemons reload their configuration on SIGHUP. |
| SIGINT | 2 | Interrupt (Ctrl+C). Graceful stop request. |

**screen and tmux basics:**
```bash
# screen
screen                  # Start new screen session
screen -S mysession     # Start named session
screen -ls              # List sessions
screen -r mysession     # Reattach to session
# Inside screen: Ctrl+A D = detach, Ctrl+A C = new window, Ctrl+A N = next window

# tmux
tmux                    # Start new session
tmux new -s mysession   # Start named session
tmux ls                 # List sessions
tmux attach -t mysession # Attach to session
# Inside tmux: Ctrl+B D = detach, Ctrl+B C = new window, Ctrl+B N = next window, Ctrl+B % = split vertical
```

---

## Systemctl Service Management

| Command | Description |
|---|---|
| `sudo systemctl start nginx` | Start the nginx service |
| `sudo systemctl stop nginx` | Stop the nginx service |
| `sudo systemctl restart nginx` | Stop then start (brief downtime) |
| `sudo systemctl reload nginx` | Reload config without stopping (when supported) |
| `sudo systemctl status nginx` | Show service status, last logs, PID, memory |
| `sudo systemctl enable nginx` | Enable service to start on boot |
| `sudo systemctl disable nginx` | Disable service from starting on boot |
| `systemctl is-active nginx` | Check if active (returns "active" or "inactive") |
| `systemctl is-enabled nginx` | Check if enabled on boot |
| `systemctl list-units --type=service` | List all loaded services |
| `systemctl list-units --type=service --state=running` | List only running services |
| `systemctl list-units --type=service --state=failed` | List failed services |
| `sudo systemctl daemon-reload` | Reload systemd unit files (after editing service files) |

### Journalctl — Reading System Logs

| Command | Description |
|---|---|
| `journalctl -u nginx` | All logs for nginx service |
| `journalctl -u nginx -f` | Follow (live stream) nginx logs |
| `journalctl -u nginx -n 100` | Last 100 log lines for nginx |
| `journalctl -u nginx --since "1 hour ago"` | Logs from last hour |
| `journalctl -u nginx --since "2024-01-15 10:00:00"` | Logs since specific time |
| `journalctl -u nginx --since "today"` | Today's logs |
| `journalctl -u nginx -p err` | Only error-level and above |
| `journalctl -xe` | Recent logs with explanations (useful after service failures) |
| `journalctl --since "10 minutes ago"` | All system logs from last 10 minutes |
| `journalctl -b` | Logs since last boot |
| `journalctl -b -1` | Logs from previous boot |
| `journalctl --disk-usage` | Show how much disk space journals use |
| `sudo journalctl --vacuum-time=7d` | Delete journal logs older than 7 days |

---

## Networking Commands Reference

### IP Address and Routing

```bash
# Show all network interfaces and IP addresses
ip addr show
ip addr show eth0          # Show specific interface

# Show routing table
ip route show
ip route show default      # Show default gateway only

# Show ARP table
ip neigh show

# Bring interface up/down
sudo ip link set eth0 up
sudo ip link set eth0 down
```

### ping — Test Connectivity

```bash
ping google.com               # Continuous ping (Ctrl+C to stop)
ping -c 5 google.com          # Send exactly 5 packets
ping -c 10 -i 0.5 google.com  # 10 packets, 0.5 second interval
ping -c 4 10.0.10.100         # Ping private EC2 IP
ping6 ::1                     # IPv6 ping to localhost
```

### traceroute — Trace Network Path

```bash
traceroute google.com          # Trace path to Google
traceroute -n google.com       # No hostname resolution (faster)
tracepath google.com           # Similar to traceroute, no root needed
mtr google.com                 # Combined ping+traceroute, real-time (install: apt install mtr)
```

### curl — HTTP Client (Essential for AWS)

```bash
# Basic GET request
curl https://api.example.com/users

# GET with headers
curl -H "Authorization: Bearer token123" -H "Content-Type: application/json" https://api.example.com/

# POST request with JSON body
curl -X POST https://api.example.com/users \
     -H "Content-Type: application/json" \
     -d '{"name": "John", "email": "john@example.com"}'

# POST with data from file
curl -X POST https://api.example.com/upload \
     -H "Content-Type: application/json" \
     -d @payload.json

# Download a file (save to same filename)
curl -O https://example.com/file.tar.gz

# Download and save with custom name
curl -o myfile.tar.gz https://example.com/file.tar.gz

# Follow redirects
curl -L https://short.url/abc

# Show response headers only
curl -I https://example.com

# Show verbose output (headers + body)
curl -v https://example.com

# Set maximum request time (timeout)
curl --max-time 30 https://api.example.com

# Basic auth
curl -u username:password https://api.example.com

# Ignore SSL certificate errors (testing only)
curl -k https://self-signed.example.com

# Save cookies and send them
curl -c cookies.txt https://example.com/login -d "user=admin&pass=secret"
curl -b cookies.txt https://example.com/protected

# POST multipart form data (file upload)
curl -F "file=@/path/to/file.txt" https://upload.example.com/

# Test endpoint with all response info
curl -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" -o /dev/null https://api.example.com
```

### wget — Download Files

```bash
# Basic download
wget https://example.com/file.tar.gz

# Download and save with different name
wget -O myapp.tar.gz https://example.com/file.tar.gz

# Resume interrupted download
wget -c https://example.com/largefile.tar.gz

# Download in background
wget -b https://example.com/file.tar.gz

# Download recursively (mirror a website)
wget -r -np https://example.com/docs/

# Quiet mode (no output)
wget -q https://example.com/file.tar.gz
```

### DNS Lookup Commands

```bash
# nslookup
nslookup example.com                      # Basic DNS lookup
nslookup -type=MX example.com            # Look up MX records
nslookup -type=A example.com             # Look up A records
nslookup example.com 8.8.8.8             # Use specific DNS server (Google)
nslookup example.com 169.254.169.253     # Use AWS Route53 Resolver (from inside VPC)

# dig (more powerful, preferred for troubleshooting)
dig example.com                           # Basic A record lookup
dig example.com +short                    # Just the IP, no extra output
dig example.com MX                        # MX records
dig example.com NS                        # Name server records
dig example.com TXT                       # TXT records (SPF, DKIM)
dig example.com ANY                       # All record types
dig @8.8.8.8 example.com                 # Query specific DNS server
dig @169.254.169.253 example.com         # Query Route53 resolver from EC2
dig +trace example.com                   # Trace full DNS resolution chain
dig -x 1.2.3.4                           # Reverse DNS lookup

# host (simple DNS tool)
host example.com
host -t MX example.com
host 1.2.3.4                             # Reverse DNS
```

### Checking Ports and Connections

```bash
# netstat (may need: apt install net-tools)
netstat -tuln          # Listening TCP and UDP ports (no hostname resolution)
netstat -tulnp         # Same but include process name/PID (requires root)
netstat -an            # All connections, numeric addresses
netstat -anp | grep nginx  # Connections involving nginx

# ss (modern replacement for netstat)
ss -tuln               # Listening ports
ss -tulnp              # Listening ports with process info
ss -an                 # All connections
ss -tnp state ESTABLISHED  # Established TCP connections with process info
ss -s                  # Summary statistics

# lsof — List open files/sockets
lsof -i :80            # What's using port 80
lsof -i :3306          # What's using MySQL port
lsof -i tcp            # All TCP connections
lsof -i tcp:443        # Processes using TCP port 443
lsof -p 1234           # All files/sockets opened by PID 1234
lsof -u ubuntu         # All open files by user ubuntu
lsof -i @52.12.34.56   # Connections to/from specific IP

# Testing connectivity
telnet 10.0.30.50 5432          # Test if PostgreSQL port is reachable
nc -zv 10.0.30.50 5432          # Test port with netcat (better than telnet)
nc -zv 10.0.30.50 5432-5440     # Test a range of ports
nc -w 3 -zv google.com 443      # 3-second timeout TCP test
nc -zvu 10.0.0.1 53             # Test UDP port

# Check if specific service port is open from EC2
curl -s -o /dev/null -w "%{http_code}" http://10.0.10.100:8080/health
```

---

## Package Management

### apt (Ubuntu/Debian) vs yum/dnf (Amazon Linux/RHEL/CentOS)

| Operation | apt (Ubuntu/Debian) | yum / dnf (Amazon Linux/RHEL) |
|---|---|---|
| Update package list | `apt update` | `yum check-update` / `dnf check-update` |
| Upgrade all packages | `apt upgrade -y` | `yum update -y` / `dnf update -y` |
| Install a package | `apt install package -y` | `yum install package -y` |
| Remove a package | `apt remove package` | `yum remove package` |
| Purge (remove + config files) | `apt purge package` | `yum erase package` |
| Search for package | `apt search keyword` | `yum search keyword` |
| Show package info | `apt show package` | `yum info package` |
| List installed packages | `dpkg -l` | `rpm -qa` |
| Check if specific pkg installed | `dpkg -l \| grep nginx` | `rpm -qa \| grep nginx` |
| Show package files | `dpkg -L nginx` | `rpm -ql nginx` |
| Find which package owns file | `dpkg -S /etc/nginx/nginx.conf` | `rpm -qf /etc/nginx/nginx.conf` |
| Clean package cache | `apt clean` or `apt autoclean` | `yum clean all` |
| Remove unused dependencies | `apt autoremove` | `yum autoremove` |
| Install from .deb file | `dpkg -i package.deb` | — |
| Install from .rpm file | — | `rpm -ivh package.rpm` |

### Common Software Installations on EC2

**Ubuntu (apt):**
```bash
sudo apt update -y && sudo apt upgrade -y

# Essential tools
sudo apt install -y git curl wget unzip jq tree

# Web server
sudo apt install -y nginx

# Node.js (via NodeSource for newer versions)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Docker
sudo apt install -y docker.io
sudo systemctl start docker && sudo systemctl enable docker
sudo usermod -aG docker ubuntu  # Add ubuntu user to docker group

# Python
sudo apt install -y python3-pip python3-venv

# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# PostgreSQL client
sudo apt install -y postgresql-client

# MySQL client
sudo apt install -y mysql-client
```

**Amazon Linux 2023 (dnf):**
```bash
sudo dnf update -y

# Essential tools
sudo dnf install -y git curl wget unzip jq

# Web server
sudo dnf install -y nginx

# Node.js
sudo dnf install -y nodejs npm

# Docker
sudo dnf install -y docker
sudo systemctl start docker && sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Python (already installed, add pip)
sudo dnf install -y python3-pip

# AWS CLI (usually pre-installed on Amazon Linux)
aws --version
```

---

## Environment Variables Reference

```bash
# Set a variable for the current session only
export VAR_NAME="value"
export DB_HOST="prod-db.internal"
export AWS_DEFAULT_REGION="us-east-1"

# Set variable for a single command only (does not persist)
DATABASE_URL="postgres://localhost/mydb" python3 migrate.py

# View all environment variables
env
printenv

# View a specific variable
echo $AWS_DEFAULT_REGION
printenv AWS_DEFAULT_REGION

# View PATH variable (formatted)
echo $PATH | tr ':' '\n'

# Unset a variable
unset VAR_NAME

# Persist variables — where to put them:
# ~/.bashrc           Interactive non-login shells (most terminal sessions)
# ~/.bash_profile     Login shells (SSH connections)
# ~/.profile          POSIX-compatible (also read by bash login shells if .bash_profile absent)
# /etc/environment    System-wide for all users (no 'export' keyword needed)
# /etc/profile.d/*.sh System-wide scripts (run for all users on login)

# Add to ~/.bashrc (persists across sessions)
echo 'export DB_HOST="prod-db.internal"' >> ~/.bashrc
echo 'export PATH="$PATH:/opt/myapp/bin"' >> ~/.bashrc

# Reload without logging out
source ~/.bashrc
. ~/.bashrc          # Same thing, shorthand

# Common AWS environment variables
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_DEFAULT_REGION="us-east-1"
export AWS_PROFILE="my-profile"   # Use named profile from ~/.aws/credentials

# Tip: For AWS, prefer named profiles (aws configure --profile myprofile) over env vars
# Env var AWS_PROFILE selects which profile to use
```

---

## Redirection and Pipes

| Operator | Description | Example |
|---|---|---|
| `>` | Redirect stdout, overwrite file | `ls -la > filelist.txt` |
| `>>` | Redirect stdout, append to file | `echo "new line" >> log.txt` |
| `<` | Redirect file to stdin | `mysql mydb < schema.sql` |
| `2>` | Redirect stderr to file | `command 2> errors.log` |
| `2>&1` | Redirect stderr to same destination as stdout | `command > all.log 2>&1` |
| `&>` | Redirect both stdout and stderr to file | `command &> output.log` |
| `/dev/null` | Discard output (black hole) | `command > /dev/null 2>&1` (suppress all output) |
| `\|` | Pipe stdout of one command to stdin of next | `ls -la \| grep ".py"` |
| `tee` | Write to both stdout and a file simultaneously | `command \| tee output.log` |
| `tee -a` | Append to file while also showing on stdout | `command \| tee -a output.log` |

**Practical examples:**
```bash
# Run command and save output + errors to file, also see on screen
deploy.sh 2>&1 | tee deploy-$(date +%Y%m%d-%H%M%S).log

# Suppress all output (for cron jobs)
/opt/scripts/cleanup.sh > /dev/null 2>&1

# Run command, send stderr to log, stdout to another command
python3 app.py 2>> error.log | grep "SUCCESS"

# Multiple pipes
cat /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# Here-doc: pass multi-line input to a command
cat << EOF > config.txt
host=localhost
port=5432
name=mydb
EOF
```

---

## Disk and System Commands

```bash
# Disk usage by filesystem
df -h                          # Human-readable sizes
df -h /                        # Just the root filesystem
df -iH                         # Show inode usage

# Directory sizes
du -sh /var/log                # Size of /var/log directory
du -sh /var/log/*              # Size of each item inside /var/log
du -sh * | sort -hr            # All items in current dir, sorted largest first
du -h --max-depth=2 /var       # Two levels deep

# Memory usage
free -h                        # Human-readable RAM and swap usage
free -m                        # In megabytes

# CPU and system info
uname -a                       # Kernel version, hostname, architecture
cat /etc/os-release            # Distribution name and version
cat /proc/cpuinfo | grep "model name" | head -1  # CPU model
nproc                          # Number of CPU cores available
cat /proc/loadavg              # Load average (same as uptime output)

# System uptime and load
uptime                         # Uptime, users logged in, load average (1, 5, 15 min)
# Load average: 1.00 per core = 100% CPU utilization. Good target: < 0.7 per core.

# Who is logged in
w                              # Who is logged in and what they are running
who                            # Simpler: who is logged in
last                           # History of logins, reboots, logouts
last ubuntu                    # Login history for ubuntu user
lastb                          # Failed login attempts (root required)

# Command history
history                        # Show numbered command history
history 50                     # Last 50 commands
!453                           # Run command number 453 from history
!!                             # Repeat the last command
!curl                          # Repeat last command starting with "curl"

# Find command locations
which nginx                    # Find executable location in PATH
whereis nginx                  # Find binary, source, and manual page locations
type nginx                     # Tells if it's alias, function, or external command

# Kernel messages
dmesg                          # Kernel ring buffer messages
dmesg | tail -20               # Last 20 kernel messages
dmesg -T | grep -i error       # Timestamped kernel errors
```

---

## Bash Keyboard Shortcuts Reference

| Shortcut | Description |
|---|---|
| `Ctrl+C` | Kill current foreground process (send SIGINT) |
| `Ctrl+Z` | Suspend current foreground process (send SIGTSTP), resume with `fg` |
| `Ctrl+D` | Send EOF / exit current shell or REPL |
| `Ctrl+A` | Move cursor to beginning of line |
| `Ctrl+E` | Move cursor to end of line |
| `Ctrl+K` | Delete from cursor to end of line (kill forward) |
| `Ctrl+U` | Delete from cursor to beginning of line (kill backward) |
| `Ctrl+W` | Delete the word before the cursor |
| `Ctrl+Y` | Paste (yank) previously killed text |
| `Ctrl+R` | Reverse search through command history (type to search, Enter to select) |
| `Ctrl+G` | Exit reverse search without running command |
| `Ctrl+L` | Clear the terminal screen (same as `clear`) |
| `Ctrl+P` | Previous command (same as Up arrow) |
| `Ctrl+N` | Next command (same as Down arrow) |
| `Alt+.` | Insert last argument of previous command |
| `Alt+B` | Move backward one word |
| `Alt+F` | Move forward one word |
| `!!` | Repeat last command |
| `!$` | Last argument of previous command |
| `!^` | First argument of previous command |
| `!command` | Run most recent command starting with "command" |
| `^old^new` | Repeat last command replacing "old" with "new" |

---

## AWS-Specific Linux Commands

Essential commands when managing EC2 instances:

### User Data and Cloud-Init

```bash
# Check if user data script ran successfully
cat /var/log/cloud-init-output.log

# Show cloud-init status (did it finish?)
cloud-init status

# Check cloud-init configuration details
cat /var/log/cloud-init.log

# Re-run user data on next boot (for debugging)
sudo cloud-init clean
sudo cloud-init init
```

### System Logs

```bash
# System journal (most comprehensive)
sudo journalctl -xe           # Recent logs with explanations
sudo journalctl -xe --since "5 minutes ago"  # Recent critical log entries
sudo journalctl -b 0          # This boot
sudo journalctl -b -1         # Previous boot (useful after crashes)

# Traditional syslog
sudo tail -f /var/log/syslog  # Ubuntu general system log
sudo tail -f /var/log/messages  # Amazon Linux general system log
sudo tail -f /var/log/auth.log  # Authentication log (SSH logins, sudo)
sudo tail -f /var/log/secure    # Amazon Linux auth log
```

### EC2 Instance Metadata Service (IMDS)

```bash
# Instance metadata base URL (only accessible from within the EC2 instance)
curl http://169.254.169.254/latest/meta-data/

# Get instance ID
curl http://169.254.169.254/latest/meta-data/instance-id

# Get instance type
curl http://169.254.169.254/latest/meta-data/instance-type

# Get public IPv4 address
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Get private IPv4 address
curl http://169.254.169.254/latest/meta-data/local-ipv4

# Get availability zone
curl http://169.254.169.254/latest/meta-data/placement/availability-zone

# Get region (from AZ)
curl http://169.254.169.254/latest/meta-data/placement/region

# Get AMI ID used to launch this instance
curl http://169.254.169.254/latest/meta-data/ami-id

# Get security groups attached
curl http://169.254.169.254/latest/meta-data/security-groups

# Get IAM role name (if instance has an IAM role)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Get temporary credentials from IAM instance role (replace ROLE_NAME)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME

# Get user data (the startup script)
curl http://169.254.169.254/latest/user-data

# IMDSv2 (more secure — requires token)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s)
curl -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/instance-id

# Check if Spot instance is being reclaimed (2-minute warning)
curl -s http://169.254.169.254/latest/meta-data/spot/termination-time
# Returns empty if not being reclaimed; returns timestamp if reclamation notice sent
```

### Resource Monitoring on EC2

```bash
# Disk usage — find what's eating your disk
df -h                          # Show all filesystems
du -sh /var/log                # How big is /var/log?
du -sh /var/log/* | sort -hr   # What's biggest inside /var/log?
sudo du -sh /* 2>/dev/null | sort -hr | head -20  # Top disk consumers from root

# Memory
free -h                        # RAM usage summary
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable"  # Detailed memory

# CPU
top -bn1 | grep "Cpu(s)"      # Single snapshot of CPU usage (for scripts)
vmstat 1 5                     # CPU, memory, disk I/O stats (5 samples, 1 sec apart)
mpstat -P ALL 1                # CPU usage per core (install: sysstat)
iostat -x 1 3                  # Disk I/O statistics

# Find what's using a port
lsof -i :80                   # What's on port 80?
ss -tulnp | grep :80           # Alternative using ss
fuser 80/tcp                   # Show PIDs using port 80

# Network connections count (useful to spot connection leaks)
ss -an | grep ESTABLISHED | wc -l  # Count established connections
ss -an | grep TIME_WAIT | wc -l    # Count TIME_WAIT connections (high = potential leak)
```

### Web Server Management

```bash
# Nginx
sudo systemctl status nginx
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl reload nginx    # Reload config without downtime
sudo nginx -t                  # Test nginx configuration syntax
sudo nginx -T                  # Test + print full configuration

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log | grep " 500 "   # Live 500 errors only
sudo awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn  # Status code summary

# Apache2 (Ubuntu)
sudo systemctl status apache2
sudo apachectl configtest      # Test Apache config
sudo tail -f /var/log/apache2/access.log
sudo tail -f /var/log/apache2/error.log
```

### AWS CLI Quick Commands on EC2

```bash
# Verify CLI is configured (uses instance role if no keys configured)
aws sts get-caller-identity

# List S3 buckets accessible to this EC2
aws s3 ls

# Copy a file to S3 from EC2
aws s3 cp /var/log/app.log s3://my-log-bucket/ec2-logs/

# Sync directory to S3
aws s3 sync /var/app/data/ s3://my-data-bucket/app-data/

# Get a secret from Secrets Manager
aws secretsmanager get-secret-value --secret-id prod/db/password \
    --query 'SecretString' --output text

# Get a parameter from SSM Parameter Store
aws ssm get-parameter --name "/prod/app/db_host" --with-decryption \
    --query 'Parameter.Value' --output text

# Describe this instance (from within the instance)
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
aws ec2 describe-instances --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].Tags'
```
