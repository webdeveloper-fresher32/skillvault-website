# 02 — Installation & Setup

## Table of Contents

1. [Overview](#1-overview)
2. [macOS — Homebrew Install](#2-macos--homebrew-install)
3. [Ubuntu / Debian — apt Install](#3-ubuntu--debian--apt-install)
4. [Windows — MSI Installer](#4-windows--msi-installer)
5. [Service Management (start/stop/status)](#5-service-management-startstopstatus)
6. [CLI Connection — mysql -u root -p](#6-cli-connection--mysql--u-root--p)
7. [MySQL Workbench — Install & Connect](#7-mysql-workbench--install--connect)
8. [Securing the Installation — mysql_secure_installation](#8-securing-the-installation--mysql_secure_installation)
9. [Create Database and User](#9-create-database-and-user)
10. [my.cnf Key Configuration Options](#10-mycnf-key-configuration-options)
11. [Docker Setup](#11-docker-setup)
12. [Connecting from Node.js (mysql2)](#12-connecting-from-nodejs-mysql2)
13. [Connecting from Python](#13-connecting-from-python)
14. [Hands-On Exercises](#14-hands-on-exercises)

---

## 1. Overview

You've just read what SQL and MySQL *are*. Great — but you can't run a single query until MySQL
is actually installed and listening on your machine. That's the gap this file closes.

Here's the thing nobody tells beginners: "installing MySQL" isn't one procedure. It's a
different procedure depending on your OS, and the differences trip people up constantly —
different default passwords, different service managers, different config file locations. So
before diving into any one path, look at the map of all four:

```
┌──────────────────────────────────────────────────────────────────┐
│               MYSQL INSTALLATION PATHS                           │
├──────────────────────────────────────────────────────────────────┤
│  macOS        │  brew install mysql@8.0                          │
│  Ubuntu       │  apt install mysql-server                        │
│  Windows      │  MySQL MSI Installer (GUI wizard)                │
│  Any OS       │  docker run mysql:8.0                            │
└──────────────────────────────────────────────────────────────────┘
```

Pick the one that matches your environment — there's no "best" one universally. If you just
want to experiment without touching your host OS at all, Docker is the path of least
resistance: it gives you a clean, disposable MySQL instance in one command, and you can throw
it away when you're done.

Target version for this curriculum: **MySQL 8.0 or 8.4 LTS**

---

## 2. macOS — Homebrew Install

**The problem:** downloading raw installers and manually placing binaries is exactly the kind
of manual busywork you want a package manager to handle for you — including future upgrades.

**The analogy:** think of Homebrew as the App Store for your terminal. You ask for "mysql," it
figures out where to put it, wires up the paths, and lets you update it later with one command.

If you don't have Homebrew yet, install it first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Install MySQL

```bash
# Install MySQL 8.0 (pinned major version)
brew install mysql@8.0

# Or install the latest stable
brew install mysql
```

Homebrew installs MySQL to `/opt/homebrew/opt/mysql@8.0` (Apple Silicon) or
`/usr/local/opt/mysql@8.0` (Intel).

### Add MySQL to PATH

```bash
# For Apple Silicon (M1/M2/M3)
echo 'export PATH="/opt/homebrew/opt/mysql@8.0/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# For Intel Mac
echo 'export PATH="/usr/local/opt/mysql@8.0/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Verify Installation

```bash
mysql --version
# Expected: mysql  Ver 8.0.xx Distrib 8.0.xx, for macos... (arm64)
```

### First-Time Start (macOS)

```bash
# Start MySQL (one-time or on-demand)
brew services start mysql@8.0

# Verify it is running
brew services list | grep mysql
# Expected: mysql@8.0  started  <username>  ~/Library/LaunchAgents/...
```

Here's a gotcha worth flagging early: after the first start on macOS, MySQL leaves the root
password **empty**. That's not "secure by default" — it's "secure once you run the next step."
Go run `mysql_secure_installation` immediately (Section 8 walks through it in detail).

---

## 3. Ubuntu / Debian — apt Install

On a Linux server, `apt` is the equivalent of Homebrew — the OS's own package manager, already
installed, already trusted by your system. No extra setup needed to get going.

### Install

```bash
# Update package index
sudo apt update

# Install MySQL Server
sudo apt install -y mysql-server

# The installer starts MySQL and enables it at boot automatically
```

On Ubuntu 22.04+ this installs MySQL 8.0 from the default Ubuntu repositories. For the latest
MySQL 8.4, add the official MySQL APT repository first:

```bash
# Download MySQL APT config package
wget https://dev.mysql.com/get/mysql-apt-config_0.8.29-1_all.deb

# Install the config package (opens an interactive menu — select MySQL 8.0 or 8.4)
sudo dpkg -i mysql-apt-config_0.8.29-1_all.deb

# Update and install
sudo apt update
sudo apt install -y mysql-server
```

### Verify

```bash
mysql --version
# mysql  Ver 8.0.xx Distrib 8.0.xx, for Linux (x86_64) ...

sudo systemctl status mysql
# Expected: active (running)
```

Here's another gotcha, different flavor from macOS: on Ubuntu, the installer doesn't leave root
with an empty password — it wires root up to the `auth_socket` authentication plugin instead.
In plain terms: if you're logged into the OS as the `root` (or sudo) user, MySQL lets you in
with no password prompt at all, because it trusts the OS-level identity. Convenient for local
admin work, confusing if you expected a normal password login. Section 8 shows how to switch
this to a regular password-based login.

---

## 4. Windows — MSI Installer

Windows doesn't have a universal package manager that everyone uses the way macOS has Homebrew,
so MySQL ships its own graphical installer instead — a wizard that walks you through every
decision instead of you typing flags into a terminal.

### Download

1. Go to: https://dev.mysql.com/downloads/installer/
2. Download **MySQL Installer for Windows** (the larger "full" installer includes Workbench).
3. Double-click the `.msi` file to launch the wizard.

### Wizard Steps

```
Setup Type:
  ┌─────────────────────────────────────────────────────────┐
  │  Developer Default  ← recommended for learning          │
  │  Server Only                                             │
  │  Client Only                                             │
  │  Full                                                    │
  │  Custom                                                  │
  └─────────────────────────────────────────────────────────┘

Products installed (Developer Default):
  ├── MySQL Server 8.0.xx
  ├── MySQL Workbench 8.0.xx
  ├── MySQL Shell
  ├── MySQL Router
  └── Connector/ODBC, Connector/NET, Connector/Python

Configuration:
  ├── Port:              3306  (leave default)
  ├── Root password:     Set a strong password NOW
  ├── Windows Service:   MySQL80  (starts at boot)
  └── Advanced:          leave defaults
```

### Verify (PowerShell)

```powershell
# Check MySQL is running
Get-Service -Name MySQL80

# Connect
mysql -u root -p
```

MySQL is installed to `C:\Program Files\MySQL\MySQL Server 8.0\` by default.
The data directory is `C:\ProgramData\MySQL\MySQL Server 8.0\Data\`.

One thing worth being deliberate about during the wizard: the "Configuration" step is where you
set the root password **once and only once, interactively**. Unlike macOS (empty password) or
Ubuntu (`auth_socket`), Windows makes you choose a real password up front — so don't rush past
that screen with a throwaway value you'll forget.

---

## 5. Service Management (start/stop/status)

Once MySQL is installed, it doesn't run itself forever — it's a background service (a
"daemon") that your OS starts, stops, and restarts on request. Every OS has its own manager for
that job. Here's the same three actions — start, stop, check status — across all three:

### macOS (Homebrew)

```bash
# Start
brew services start mysql@8.0

# Stop
brew services stop mysql@8.0

# Restart (after config changes)
brew services restart mysql@8.0

# Status (all services)
brew services list

# One-shot start (not as background service — useful for testing)
mysql.server start
mysql.server stop
mysql.server status
```

### Ubuntu / Debian (systemd)

```bash
# Start
sudo systemctl start mysql

# Stop
sudo systemctl stop mysql

# Restart
sudo systemctl restart mysql

# Status — shows PID, active time, recent log lines
sudo systemctl status mysql

# Enable at boot
sudo systemctl enable mysql

# Disable at boot
sudo systemctl disable mysql
```

### Windows (PowerShell / Command Prompt)

```powershell
# Start
net start MySQL80
# or
Start-Service -Name MySQL80

# Stop
net stop MySQL80
# or
Stop-Service -Name MySQL80

# Status
Get-Service -Name MySQL80

# In Services GUI: Win+R → services.msc → find MySQL80
```

---

## 6. CLI Connection — mysql -u root -p

**The problem:** MySQL is running as a background service — great, but how do you actually
*talk* to it? You need a client that opens a connection, sends your SQL, and prints the result.

**The analogy:** if MySQL Server is the kitchen, the `mysql` CLI is the waiter you hand your
order to. You never touch the kitchen directly — you always go through the waiter, and the
waiter always needs to know who you are (`-u`), whether you can prove it (`-p`), and which
table you're sitting at (which database).

The `mysql` command-line client is the primary way to interact with MySQL outside of GUIs — and
it's what every one of the driver libraries in Sections 12–13 is really doing under the hood.

### Basic Connection

```bash
# Connect as root, prompt for password
mysql -u root -p

# Connect as a specific user to a specific database
mysql -u app_user -p mydb

# Connect to a remote host
mysql -h 192.168.1.100 -P 3306 -u admin -p

# One-liner (password inline — NOT recommended, visible in shell history)
mysql -u root -pmysecretpassword

# Execute a single query and exit
mysql -u root -p -e "SHOW DATABASES;"

# Execute a SQL file
mysql -u root -p mydb < schema.sql
```

### CLI Prompt and Basic Navigation

```sql
-- Once connected you see:
mysql>

-- Show all databases
SHOW DATABASES;

-- Select a database to use
USE mydb;

-- Show current database
SELECT DATABASE();

-- Show current user
SELECT USER();

-- Show MySQL version
SELECT VERSION();

-- Show all tables in current database
SHOW TABLES;

-- Show table structure
DESCRIBE users;

-- Exit
EXIT;
-- or
QUIT;
-- or Ctrl+D
```

### Useful CLI Flags

| Flag | Meaning |
|------|---------|
| `-u username` | MySQL user to connect as |
| `-p` | Prompt for password |
| `-h host` | Hostname or IP (default: localhost) |
| `-P port` | Port (default: 3306) |
| `-D database` | Select database on connect |
| `-e "query"` | Execute query and exit |
| `--ssl-mode=REQUIRED` | Force SSL connection |
| `--verbose` | Print each statement before executing |
| `--column-names` | Show column headers (default: yes) |

**Common mistake:** typing the password directly after `-p` with no space (`-pmysecretpassword`)
feels convenient, but it lands in your shell's history file in plain text, and shows up in
`ps aux` output while the command runs. Use bare `-p` and let it prompt you instead — the
one-liner form exists mainly for scripts running in already-secured environments.

---

## 7. MySQL Workbench — Install & Connect

**The problem:** the CLI is great once you know exactly what you want to type, but browsing
schemas, sketching ER diagrams, and eyeballing result grids is painful in a terminal.

**The fix:** MySQL Workbench, the official graphical IDE for MySQL. Think of it as the GUI
counterpart to everything you just did on the command line — same connection, friendlier view.
It gives you an ER diagram designer, a query editor with syntax highlighting, server
administration screens, and performance dashboards, all in one app.

### Install

- **macOS**: `brew install --cask mysqlworkbench` or download from https://dev.mysql.com/downloads/workbench/
- **Ubuntu**: `sudo snap install mysql-workbench-community` or download the .deb from MySQL
- **Windows**: Included in the Developer Default MSI installer

### Create a Connection

```
Open MySQL Workbench
  └── Home screen → "+" next to "MySQL Connections"

Connection Name:    Local Development
Connection Method:  Standard (TCP/IP)
Hostname:           127.0.0.1
Port:               3306
Username:           root
Password:           (click "Store in Vault" → enter password)

Test Connection → "Successfully made the MySQL connection"
OK
```

### Key Workbench Features

```
┌─────────────────────────────────────────────────────────────────┐
│ MySQL Workbench Layout                                          │
├────────────┬──────────────────────────────┬────────────────────┤
│ Navigator  │        Query Editor          │  Information       │
│            │  ┌──────────────────────┐    │  Panel             │
│ Schemas    │  │ SELECT * FROM users; │    │                    │
│ ├── mydb   │  └──────────────────────┘    │  Column details,   │
│ │  ├─ Tables│  [Execute ▶] [Explain ⚡]  │  table info,       │
│ │  ├─ Views │                             │  FK relationships  │
│ │  └─ ...  │  ┌──────────────────────┐    │                    │
│            │  │   Result Grid         │    │                    │
│ Admin      │  │ id │ name │ email    │    │                    │
│ ├── Users  │  │ 1  │ Alice│ a@x.com  │    │                    │
│ └── Status │  └──────────────────────┘    │                    │
└────────────┴──────────────────────────────┴────────────────────┘
```

Useful Workbench shortcuts:
- `Ctrl+Enter` (or `Cmd+Enter`) — execute current query
- `Ctrl+Shift+Enter` — execute all statements in editor
- `Ctrl+/` — toggle comment on selected lines
- `Ctrl+B` — format/beautify SQL

---

## 8. Securing the Installation — mysql_secure_installation

**The problem:** you've now seen two different OSes leave MySQL in a genuinely insecure default
state — macOS with an empty root password, Ubuntu with a passwordless `auth_socket` login. On
top of that, a fresh install typically ships with anonymous user accounts (log in as *nobody*
and still get in) and a world-readable `test` database. None of that is safe to leave alone.

**The analogy:** it's exactly like a new apartment with a builder-grade lock, a spare key taped
under the mat, and a note on the door saying "please don't rob us." `mysql_secure_installation`
is you actually changing the locks before you move your furniture in.

**What it is:** an interactive script, included with every MySQL install, that walks you
through fixing all of the above in one sitting — no need to remember each fix individually.

```bash
sudo mysql_secure_installation
```

### Walkthrough

```
Securing the MySQL server deployment.

Enter password for user root: [blank on fresh macOS install, or current password]

VALIDATE PASSWORD COMPONENT can be used to test passwords
and improve security. It checks the strength of password
and allows the users to set only those passwords which are
secure enough.

Would you like to setup VALIDATE PASSWORD component? (Press y|Y for Yes, any other key for No): y

There are three levels of password validation policy:
LOW    Length >= 8
MEDIUM Length >= 8, numeric, mixed case, and special characters
STRONG Length >= 8, numeric, mixed case, special characters and dictionary file

Please enter 0 = LOW, 1 = MEDIUM and 2 = STRONG: 1

Please set the password for root here.
New password: [enter a strong password]
Re-enter new password: [confirm]

Estimated strength of the password: 100
Do you wish to continue with the password provided? y

Remove anonymous users? (Press y|Y for Yes): y
  → Removes accounts with empty username that let anyone log in

Disallow root login remotely? (Press y|Y for Yes): y
  → Root should only connect from localhost; use a named admin user for remote

Remove test database and access to it? (Press y|Y for Yes): y
  → Removes the 'test' database and privileges on 'test_%' patterns

Reload privilege tables now? (Press y|Y for Yes): y
  → Flushes privileges so changes take effect immediately

All done!
```

After this, always connect as root with a password:
```bash
mysql -u root -p
```

**Common mistakes people make around this step:**
- Running it *before* they've set any root password at all on Ubuntu, then getting confused
  when the "current password" prompt seems to expect something that doesn't exist yet — on a
  truly fresh Ubuntu install, just press Enter for a blank current password.
- Skipping the "disallow remote root login" prompt because "it's just my dev machine" — and
  then forgetting to undo that later when the same server gets exposed to a network.
- Assuming this script is a one-time global fix. It isn't tied to a specific database or user —
  it only hardens the server-wide defaults. You still need to create scoped, least-privilege
  users for your actual applications (that's Section 9, next).

**Interview answer:** "`mysql_secure_installation` is a setup script that hardens a fresh MySQL
install by setting or validating the root password, removing anonymous user accounts,
disallowing remote root login, and removing the default `test` database. It should be run
immediately after installation, before creating any application databases or users."

> **Memory hook:** "Change the locks before you move the furniture in."

---

## 9. Create Database and User

**The problem:** root can do *everything* — drop tables, create users, shut down the server.
If your web app connects as root and has a SQL injection bug, the attacker doesn't just read
one table, they own the whole server. That's an enormous blast radius for a bug in one form field.

**The analogy:** root is the master key to the building. You don't hand the master key to the
pizza delivery guy — you give him a buzzer code that only opens the lobby door. Every
application should connect with its own narrow, purpose-built "buzzer code," not the master key.

**The fix:** never use root for application connections. Create a dedicated database and a
least-privilege user instead.

```sql
-- Connect as root first
-- mysql -u root -p

-- Step 1: Create the database
CREATE DATABASE mydb
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Step 2: Create an application user
-- 'app'@'localhost' means this user can only connect from the same machine
CREATE USER 'app'@'localhost' IDENTIFIED BY 'StrongP@ssw0rd!';

-- Step 3: Grant privileges
-- ALL PRIVILEGES on mydb.* means: SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, etc.
-- Only on the mydb database, not all databases
GRANT ALL PRIVILEGES ON mydb.* TO 'app'@'localhost';

-- Step 4: Apply privilege changes
FLUSH PRIVILEGES;

-- Verify the user exists
SELECT user, host FROM mysql.user WHERE user = 'app';

-- Verify the grants
SHOW GRANTS FOR 'app'@'localhost';
```

### Fine-Grained Privilege Grants

For production, grant only what the app needs:

```sql
-- Read-only reporting user
CREATE USER 'reporter'@'%' IDENTIFIED BY 'ReporterPass123!';
GRANT SELECT ON mydb.* TO 'reporter'@'%';

-- Write-only ETL user (cannot read, only insert)
CREATE USER 'etl_loader'@'10.0.0.%' IDENTIFIED BY 'ETLPass123!';
GRANT INSERT ON mydb.raw_events TO 'etl_loader'@'10.0.0.%';

-- Admin user for remote management (NOT root, limited to one DB)
CREATE USER 'dbadmin'@'%' IDENTIFIED BY 'AdminPass123!';
GRANT ALL PRIVILEGES ON mydb.* TO 'dbadmin'@'%';
FLUSH PRIVILEGES;
```

### What `'user'@'host'` Means

Here's the part that trips up almost everyone coming from other databases: in MySQL, a
"user" isn't just a username — it's a **username + host combination**. `'app'@'localhost'` and
`'app'@'%'` are two entirely different accounts, with potentially different passwords and
different privileges, even though the username looks identical. This is why `SELECT user, host
FROM mysql.user` in Section 9's example checks *both* columns, not just the name.

- `'app'@'localhost'` — only from the same machine
- `'app'@'%'` — from any host (wildcard)
- `'app'@'10.0.0.%'` — from any IP in the 10.0.0.x subnet
- `'app'@'192.168.1.50'` — only from that specific IP

**Common mistake:** creating `'app'@'localhost'`, granting it privileges, and then wondering
why your app — connecting from a different container or a different server — gets "Access
denied for user." The account that exists doesn't match the host the connection is actually
coming from. Fix by creating the account with the right host pattern (often `'%'` for
containerized apps, or the specific subnet for a known network).

**Interview answer:** "MySQL identifies accounts by the pair `username@host`, not username
alone. This lets you grant different privileges to the same username depending on where the
connection originates — for example, `'app'@'localhost'` for local admin tasks and
`'app'@'10.0.0.%'` for the application servers on the internal network. It also means 'Access
denied' errors are often a host-matching problem, not a password problem."

> **Memory hook:** "Same name, different doors — MySQL checks which door you knocked on, not just your name tag."

---

## 10. my.cnf Key Configuration Options

**The problem:** the defaults MySQL ships with are tuned to run *anywhere*, on a laptop or a
16 GB production box — which means they're tuned optimally for *nowhere*. `max_connections`
capped at 151, a tiny buffer pool, no slow query log. Fine for a first `SELECT`, not fine once
real traffic shows up.

**The analogy:** think of `my.cnf` as the thermostat and circuit breaker panel for the whole
house. You don't touch it every day, but when the house is too cold (not enough connections
allowed) or a breaker keeps tripping (queries timing out), this is the file you go to.

**Basic definition:** the MySQL configuration file — it controls memory allocation, networking,
logging, and general server behaviour, all in one place.

### File Locations

Different OSes hide this file in different spots — this alone causes a lot of "I edited the
config but nothing changed" confusion, usually because the edit landed in the wrong file:

| OS | Path |
|----|------|
| macOS (Homebrew) | `/opt/homebrew/etc/my.cnf` or `~/.my.cnf` |
| Ubuntu | `/etc/mysql/mysql.conf.d/mysqld.cnf` or `/etc/my.cnf` |
| Windows | `C:\ProgramData\MySQL\MySQL Server 8.0\my.ini` |

MySQL reads multiple config files in order; later files override earlier ones. If you're
editing a setting and it seems to have no effect, check whether a later file in the load order
is quietly overriding you.

### Annotated Configuration File

Here's what a real, working config looks like, with the reasoning behind each value written
directly as a comment — read it top to bottom once, then treat it as a reference afterward:

```ini
[mysqld]
# ─── NETWORK ──────────────────────────────────────────────────────
# Port (default 3306)
port            = 3306

# Bind to all interfaces (use 127.0.0.1 to restrict to localhost only)
bind-address    = 0.0.0.0

# Maximum simultaneous client connections
# Default: 151. Increase for high-concurrency apps.
max_connections = 500

# ─── INNODB MEMORY ────────────────────────────────────────────────
# Buffer pool: caches table data and indexes in RAM.
# Rule of thumb: 70-80% of available RAM on a dedicated DB server.
# On a 16 GB server: set to 12G
innodb_buffer_pool_size    = 1G

# Number of buffer pool instances (improves concurrency on large pools)
# Set to 8 if buffer_pool_size >= 8G
innodb_buffer_pool_instances = 1

# InnoDB redo log size (MySQL 8.0.30+ uses innodb_redo_log_capacity)
# Larger = better write throughput, longer crash recovery
innodb_log_file_size = 256M

# ─── LOGGING ──────────────────────────────────────────────────────
# General query log — logs ALL queries (expensive, use only for debugging)
# general_log         = 1
# general_log_file    = /var/log/mysql/general.log

# Slow query log — logs queries exceeding the threshold
slow_query_log          = 1
slow_query_log_file     = /var/log/mysql/slow.log
long_query_time         = 1      # seconds; queries slower than this are logged
log_queries_not_using_indexes = 1  # also log full-table scans

# Binary log — required for replication and point-in-time recovery
log_bin             = /var/log/mysql/mysql-bin.log
binlog_format       = ROW         # ROW | STATEMENT | MIXED
expire_logs_days    = 7           # auto-purge old binlogs

# Error log
log_error           = /var/log/mysql/error.log

# ─── CHARACTER SET ────────────────────────────────────────────────
character-set-server  = utf8mb4
collation-server      = utf8mb4_unicode_ci

# ─── TIMEOUTS ─────────────────────────────────────────────────────
# Close idle connections after N seconds
wait_timeout        = 28800     # 8 hours (default)
interactive_timeout = 28800

# ─── MISC ─────────────────────────────────────────────────────────
# Temporary table size in memory before spilling to disk
tmp_table_size      = 64M
max_heap_table_size = 64M

# Sort buffer per connection (for ORDER BY)
sort_buffer_size    = 2M

[mysql]
# Default character set for the client
default-character-set = utf8mb4

[client]
port    = 3306
socket  = /var/run/mysqld/mysqld.sock
```

**Common mistakes with `my.cnf`:**
- Editing the file, but not restarting MySQL — most of these settings (like
  `innodb_buffer_pool_size` or `max_connections`) are read once at startup and won't apply until
  the server restarts. A handful of variables can be changed live with `SET GLOBAL`, but don't
  assume that's true for everything.
- Setting `innodb_buffer_pool_size` too close to total RAM, starving the OS itself and causing
  swapping — the 70-80% rule of thumb exists for a reason.
- Editing the wrong file — see the "File Locations" table above; on Ubuntu in particular, some
  installs split config across `/etc/mysql/mysql.conf.d/mysqld.cnf` and `/etc/mysql/my.cnf`,
  and it's easy to edit the one that gets overridden.

**Interview answer:** "`my.cnf` (or `my.ini` on Windows) is MySQL's main configuration file,
read at startup, controlling things like network port, max connections, InnoDB buffer pool
size, and logging. Most settings require a server restart to take effect. Key production
tuning knobs are `innodb_buffer_pool_size` (usually 70-80% of RAM on a dedicated DB server),
`max_connections`, and the slow query log settings for finding performance problems."

> **Memory hook:** "It's the thermostat for the whole house — you don't touch it daily, but when something's off, this is where you look."

After editing `my.cnf`, restart MySQL for changes to take effect:

```bash
# Ubuntu
sudo systemctl restart mysql

# macOS
brew services restart mysql@8.0
```

Check that a setting was applied:

```sql
SHOW VARIABLES LIKE 'max_connections';
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
SHOW VARIABLES LIKE 'slow_query_log';
```

---

## 11. Docker Setup

**The problem:** every install method above touches your actual OS — installs a service,
writes config files, occupies port 3306 permanently. What if you just want a throwaway MySQL
for an afternoon of practice, with zero cleanup afterward?

**The analogy:** a Docker container is like a fully furnished hotel room instead of buying a
house. You get everything you need, you use it, and when you check out, nothing about your own
home changed.

Docker is the fastest way to get a clean MySQL instance without affecting your host OS.

### Basic Run

```bash
# Pull and run MySQL 8.0
docker run \
  --name mysql-dev \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=mydb \
  -p 3306:3306 \
  -d \
  mysql:8.0
```

Flag breakdown:
- `--name mysql-dev` — container name for easy reference
- `-e MYSQL_ROOT_PASSWORD=root` — sets root password (required)
- `-e MYSQL_DATABASE=mydb` — creates this database on first start
- `-p 3306:3306` — maps host port 3306 to container port 3306
- `-d` — run in background (detached)

### Connect to the Running Container

```bash
# Via docker exec (directly into the container's mysql client)
docker exec -it mysql-dev mysql -u root -proot

# Via your local mysql client (if installed)
mysql -h 127.0.0.1 -P 3306 -u root -proot
```

### Docker Compose (recommended for projects)

```yaml
# docker-compose.yml
version: "3.9"

services:
  db:
    image: mysql:8.0
    container_name: mysql-dev
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: mydb
      MYSQL_USER: app
      MYSQL_PASSWORD: apppassword
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql          # persist data between restarts
      - ./sql/init:/docker-entrypoint-initdb.d  # run .sql files on first start
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

volumes:
  mysql_data:
```

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Stop and delete data (fresh start)
docker compose down -v

# View logs
docker compose logs -f db
```

**Common mistake:** forgetting the `volumes:` mount in Docker Compose, then running
`docker compose down` and being surprised the entire database vanished. Without a named volume
like `mysql_data:/var/lib/mysql`, container data lives only as long as the container does.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MYSQL_ROOT_PASSWORD` | Yes | Root password |
| `MYSQL_DATABASE` | No | Create this DB on first start |
| `MYSQL_USER` | No | Create this non-root user |
| `MYSQL_PASSWORD` | No | Password for MYSQL_USER |
| `MYSQL_ALLOW_EMPTY_PASSWORD` | No | Set `yes` to allow empty root password |
| `MYSQL_RANDOM_ROOT_PASSWORD` | No | Generate and print a random root password |

---

## 12. Connecting from Node.js (mysql2)

**The problem:** everything so far has been you, a terminal, and the `mysql` CLI. But a real
application isn't a human typing queries — it's code that needs to open connections, run
queries, and hand back rows, all programmatically. That's what a driver library is for.

`mysql2` is the recommended MySQL client for Node.js. It is faster than the older `mysql` package
and supports promises, async/await, and connection pools natively.

```bash
npm install mysql2
```

### Single Connection (simple scripts)

```js
// db.js
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host:     'localhost',
  port:     3306,
  user:     'app',
  password: 'StrongP@ssw0rd!',
  database: 'mydb',
});

// Execute a parameterised query (always use placeholders — never interpolate user input)
const [rows, fields] = await connection.execute(
  'SELECT id, name, email FROM users WHERE active = ?',
  [1]
);

console.log(rows);       // Array of row objects
await connection.end();  // Always close when done
```

### Connection Pool (production apps)

A single connection is fine for a script that runs once and exits. But imagine a web server
handling 500 requests a second, each opening a brand-new TCP connection to MySQL, doing a
handshake, running one query, then closing it — that overhead dwarfs the actual query time.

A pool solves this by keeping a set of connections open and handing them out on demand, reusing
them across requests instead of paying the connection-setup cost every single time.

```js
// pool.js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host:               'localhost',
  port:               3306,
  user:               'app',
  password:           'StrongP@ssw0rd!',
  database:           'mydb',
  waitForConnections: true,      // Queue requests when pool is exhausted
  connectionLimit:    10,        // Max simultaneous connections
  queueLimit:         0,         // 0 = unlimited queue
  enableKeepAlive:    true,      // Send keepalive packets to prevent timeout drops
  keepAliveInitialDelay: 0,
});

export async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Usage in another file:
// import { query } from './pool.js';
// const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
```

### Transaction Example

```js
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();

  await conn.execute(
    'UPDATE accounts SET balance = balance - ? WHERE id = ?',
    [500, 1]
  );
  await conn.execute(
    'UPDATE accounts SET balance = balance + ? WHERE id = ?',
    [500, 2]
  );

  await conn.commit();
  console.log('Transfer complete');
} catch (err) {
  await conn.rollback();
  console.error('Transfer failed, rolled back:', err);
  throw err;
} finally {
  conn.release();   // Return connection to pool
}
```

**Common mistake:** hardcoding `password: 'StrongP@ssw0rd!'` directly in source code, like the
examples above do for readability. In real projects, that value belongs in an environment
variable (`process.env.DB_PASSWORD`) loaded from a `.env` file that's git-ignored — never
committed alongside the code. The examples in this file inline credentials purely to keep the
snippets self-contained; treat that as a teaching shortcut, not a pattern to copy into production.

### mysql2 vs mysql vs Sequelize

| Package | Type | When to use |
|---------|------|-------------|
| `mysql2` | Low-level driver | Direct SQL, maximum control and performance |
| `mysql` | Older driver | Legacy codebases; no native promise support |
| `sequelize` | ORM | Rapid development, model-based approach, migrations |
| `knex` | Query builder | Middle ground — programmatic SQL, no full ORM |
| `drizzle` | Type-safe query builder | TypeScript-first, recent favourite |

---

## 13. Connecting from Python

Same story as Node.js in the last section — Python code needs its own driver to talk to MySQL
programmatically, rather than shelling out to the `mysql` CLI.

The `mysql-connector-python` package is the official MySQL driver maintained by Oracle.
`PyMySQL` is a pure-Python alternative; `mysqlclient` is a C-extension-based faster option.

```bash
pip install mysql-connector-python
```

### Simple Connection

```python
# db.py
import mysql.connector
from mysql.connector import Error

def get_connection():
    return mysql.connector.connect(
        host='localhost',
        port=3306,
        user='app',
        password='StrongP@ssw0rd!',
        database='mydb',
        charset='utf8mb4',
        collation='utf8mb4_unicode_ci',
        autocommit=False,   # Explicit transaction control
    )

def fetch_users(active: bool = True):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)  # rows as dicts, not tuples
    try:
        cursor.execute(
            "SELECT id, name, email FROM users WHERE active = %s",
            (int(active),)        # Always use parameterised queries
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    users = fetch_users()
    for u in users:
        print(u['name'], u['email'])
```

### Connection Pool with mysql.connector

```python
from mysql.connector import pooling

pool = pooling.MySQLConnectionPool(
    pool_name="myapp_pool",
    pool_size=5,
    host='localhost',
    user='app',
    password='StrongP@ssw0rd!',
    database='mydb',
    charset='utf8mb4',
)

def run_query(sql, params=None):
    conn = pool.get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, params or ())
        result = cursor.fetchall()
        cursor.close()
        return result
    finally:
        conn.close()   # Returns to pool, does not close TCP connection
```

### Transaction Example

```python
def transfer_funds(from_id: int, to_id: int, amount: float):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE accounts SET balance = balance - %s WHERE id = %s",
            (amount, from_id)
        )
        cursor.execute(
            "UPDATE accounts SET balance = balance + %s WHERE id = %s",
            (amount, to_id)
        )
        conn.commit()
        print("Transfer successful")
    except Exception as e:
        conn.rollback()
        print(f"Transfer failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()
```

### SQLAlchemy (ORM / higher-level)

```python
from sqlalchemy import create_engine, text

# Connection string format: mysql+mysqlconnector://user:pass@host:port/dbname
engine = create_engine(
    "mysql+mysqlconnector://app:StrongP%40ssw0rd%21@localhost:3306/mydb",
    pool_size=10,
    max_overflow=20,
    echo=False,   # Set True to log all SQL
)

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, name FROM users LIMIT 10"))
    for row in result:
        print(row.id, row.name)
```

---

## 14. Hands-On Exercises

Reading about installation and actually doing it are two different skills — the exercises
below make you do the second one.

**Exercise 1 — Install and Verify**
Install MySQL using the method appropriate for your OS. Run the following and paste the output:
```bash
mysql --version
mysql -u root -p -e "SELECT VERSION(), USER(), NOW();"
```

**Exercise 2 — Run mysql_secure_installation**
Run `mysql_secure_installation`, answer every prompt, and document what each step does. After
completion, try connecting as root without a password — what happens?

**Exercise 3 — Database and User Setup**
Create a database called `learning_db` with `utf8mb4` character set. Create a user called
`student` with password of your choice. Grant `SELECT`, `INSERT`, `UPDATE`, `DELETE` (but NOT
`DROP` or `CREATE`) on `learning_db.*` to `student`. Verify the grants with `SHOW GRANTS`.

**Exercise 4 — my.cnf Tuning**
Locate your `my.cnf` or `mysqld.cnf` file. Enable the slow query log with a threshold of 2
seconds. Restart MySQL. Run `SHOW VARIABLES LIKE 'slow_query_log%';` to confirm the setting
was applied.

**Exercise 5 — Docker MySQL**
Using Docker, start a MySQL 8.0 container named `mysql-practice` with root password `practice`,
and a pre-created database called `testdb`. Connect to it using your local `mysql` CLI client.
Run `SHOW DATABASES;` to confirm `testdb` exists. Stop and remove the container when done.
```bash
# Start container
docker run --name mysql-practice \
  -e MYSQL_ROOT_PASSWORD=practice \
  -e MYSQL_DATABASE=testdb \
  -p 3307:3306 \
  -d mysql:8.0

# Connect (using port 3307 to avoid conflict with local MySQL)
mysql -h 127.0.0.1 -P 3307 -u root -ppractice

# Cleanup
docker stop mysql-practice && docker rm mysql-practice
```
