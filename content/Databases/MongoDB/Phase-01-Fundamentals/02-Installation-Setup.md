# 02 — Installation & Setup

> "Setting up your environment correctly is the foundation everything else is built on."

---

## Table of Contents

1. [Installing MongoDB](#1-installing-mongodb)
   - 1.1 [macOS — Homebrew](#11-macos--homebrew)
   - 1.2 [Ubuntu — apt](#12-ubuntu--apt)
   - 1.3 [Windows — MSI Installer](#13-windows--msi-installer)
2. [Managing the Service](#2-managing-the-service)
   - 2.1 [macOS Service Control](#21-macos-service-control)
   - 2.2 [Ubuntu / Linux Service Control](#22-ubuntu--linux-service-control)
   - 2.3 [Windows Service Control](#23-windows-service-control)
3. [mongosh Shell](#3-mongosh-shell)
   - 3.1 [Connecting](#31-connecting)
   - 3.2 [Navigation Commands](#32-navigation-commands)
   - 3.3 [.mongorc.js Customisation](#33-mongorcjs-customisation)
   - 3.4 [Tab Completion & Tips](#34-tab-completion--tips)
4. [MongoDB Compass GUI](#4-mongodb-compass-gui)
5. [Directory Structure](#5-directory-structure)
6. [mongod.conf Explained](#6-mongodconf-explained)
7. [Connection String Format](#7-connection-string-format)
8. [Connecting from Node.js](#8-connecting-from-nodejs)
9. [Connecting from Python](#9-connecting-from-python)
10. [Docker Setup](#10-docker-setup)
11. [Hands-On Exercises](#11-hands-on-exercises)
12. [Interview Q&A](#12-interview-qa)

---

## 1. Installing MongoDB

### The problem

You've read what MongoDB is. Now you actually need it running on your machine, and the honest truth is: "install MongoDB" means three different things depending on whether you're on macOS, Ubuntu, or Windows. Each OS has its own package manager, its own default paths, its own way of registering a background service. Get this step wrong and every later lesson — connecting, configuring, replicating — sits on shaky ground.

### Real-World Analogy

Installing MongoDB is like setting up a filing cabinet in an office. The installer places the cabinet (the `mongod` daemon), gives you the key (the `mongosh` shell), and registers it with building management (the OS service layer) so it starts automatically when the office opens.

---

### 1.1 macOS — Homebrew

Homebrew is the de-facto package manager for macOS. MongoDB maintains its own tap (a third-party Homebrew repository), so installing is four short steps.

```bash
# Step 1 — Add the official MongoDB tap
brew tap mongodb/brew

# Step 2 — Update Homebrew formulae
brew update

# Step 3 — Install the latest Community Edition
brew install mongodb-community@7.0

# Step 4 — Verify the installation
mongod --version
# Expected: db version v7.0.x
mongosh --version
# Expected: 2.x.x
```

What Homebrew installs, and where it puts it:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Homebrew MongoDB Install Locations (macOS)                              │
├──────────────────────────────────────────────┬───────────────────────────┤
│  Binary (mongod, mongos, mongosh)            │ /opt/homebrew/bin/        │
│  Configuration file (mongod.conf)            │ /opt/homebrew/etc/        │
│  Data directory                              │ /opt/homebrew/var/mongodb │
│  Log file                                    │ /opt/homebrew/var/log/    │
│                                              │   mongodb/mongo.log       │
└──────────────────────────────────────────────┴───────────────────────────┘
```

> Intel Macs use `/usr/local/` instead of `/opt/homebrew/`.

---

### 1.2 Ubuntu — apt

MongoDB provides an official `apt` repository for Debian-based distributions — you're not relying on whatever version Ubuntu's default repos happen to carry, you're pulling straight from MongoDB.

```bash
# Step 1 — Import the MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
  --dearmor

# Step 2 — Add the repository (Ubuntu 22.04 Jammy)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Step 3 — Reload the local package database
sudo apt-get update

# Step 4 — Install MongoDB Community Edition
sudo apt-get install -y mongodb-org

# Step 5 — Pin the version to prevent accidental upgrades
echo "mongodb-org hold"          | sudo dpkg --set-selections
echo "mongodb-org-database hold" | sudo dpkg --set-selections
echo "mongodb-org-server hold"   | sudo dpkg --set-selections
echo "mongodb-mongosh hold"      | sudo dpkg --set-selections
echo "mongodb-org-mongos hold"   | sudo dpkg --set-selections
echo "mongodb-org-tools hold"    | sudo dpkg --set-selections

# Step 6 — Verify
mongod --version
```

`mongodb-org` isn't a single package — it's a bundle. Here's what it actually pulls in:

```
┌──────────────────────────────────────────────────────┐
│  mongodb-org meta-package pulls in:                  │
├──────────────────────────────┬───────────────────────┤
│  mongodb-org-server          │ mongod daemon         │
│  mongodb-org-mongos          │ mongos router         │
│  mongodb-mongosh             │ modern shell          │
│  mongodb-org-database-tools  │ mongodump/restore     │
└──────────────────────────────┴───────────────────────┘
```

---

### 1.3 Windows — MSI Installer

On Windows there's no package manager step — you download a wizard and click through it.

```
Installation Flow:
┌──────────────┐    ┌────────────────────┐    ┌──────────────────────┐
│  Download    │───>│  Run MSI Wizard    │───>│  Choose "Complete    │
│  .msi from  │    │  (accepts EULA,    │    │  Setup" option       │
│  mongodb.com │    │  sets install dir) │    └──────────┬───────────┘
└──────────────┘    └────────────────────┘               │
                                                          v
                                               ┌──────────────────────┐
                                               │  Install as Windows  │
                                               │  Service (default)   │
                                               │  + MongoDB Compass   │
                                               └──────────────────────┘
```

Default install paths on Windows:

```
C:\Program Files\MongoDB\Server\7.0\
├── bin\
│   ├── mongod.exe
│   ├── mongos.exe
│   └── mongosh.exe
C:\Program Files\MongoDB\Server\7.0\data\   <- data directory
C:\Program Files\MongoDB\Server\7.0\log\    <- log directory
```

PowerShell verification:

```powershell
# Check mongod version
& "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --version

# Add to PATH permanently (run as Administrator)
[System.Environment]::SetEnvironmentVariable(
  "Path",
  $env:Path + ";C:\Program Files\MongoDB\Server\7.0\bin",
  [System.EnvironmentVariableTarget]::Machine
)
```

---

## 2. Managing the Service

### The problem

Installing MongoDB puts the binaries on disk — it doesn't mean the database is running, or that it'll still be running after you reboot your laptop. You need a way to start it, stop it, restart it after a config change, and check whether it's actually alive. Every OS handles this its own way.

### Real-World Analogy

Understanding service management is critical for database reliability. Think of the `mongod` process as a post-office worker: you can tell it to start its shift, take a break, or clock out.

---

### 2.1 macOS Service Control

```bash
# Start MongoDB (and register to start on boot)
brew services start mongodb-community@7.0

# Stop MongoDB
brew services stop mongodb-community@7.0

# Restart MongoDB (pick up config changes)
brew services restart mongodb-community@7.0

# Check status
brew services list | grep mongodb

# Run without registering as a background service (foreground, useful for debugging)
mongod --config /opt/homebrew/etc/mongod.conf

# Check what's running on the default port
lsof -i :27017
```

---

### 2.2 Ubuntu / Linux Service Control

MongoDB integrates with `systemd` on modern Ubuntu:

```bash
# Start the daemon
sudo systemctl start mongod

# Enable auto-start on boot
sudo systemctl enable mongod

# Stop the daemon
sudo systemctl stop mongod

# Restart (reload config without full stop)
sudo systemctl restart mongod

# Reload config (for changes that don't require restart)
sudo systemctl reload mongod

# Detailed status with last log lines
sudo systemctl status mongod

# View real-time logs
sudo journalctl -u mongod -f

# Check which user mongod runs as
ps aux | grep mongod
# Typically: mongodb  1234  0.1  ...
```

Systemd unit file location:

```
/lib/systemd/system/mongod.service
```

---

### 2.3 Windows Service Control

```powershell
# Start the MongoDB service
net start MongoDB

# Stop the MongoDB service
net stop MongoDB

# Restart (stop then start)
net stop MongoDB; net start MongoDB

# Check service status
Get-Service -Name MongoDB

# View service properties
sc qc MongoDB

# Start service via Services GUI
# Run -> services.msc -> find "MongoDB Server" -> Right-click
```

### Compare: Service Control Across OSes

Three different vocabularies, same five actions. Once you see them side by side, you stop having to look each one up separately.

```
┌─────────────┬──────────────────────────────────────┬─────────────────────────────┬─────────────────────┐
│  Action     │  macOS (Homebrew)                    │  Ubuntu (systemd)           │  Windows            │
├─────────────┼──────────────────────────────────────┼─────────────────────────────┼─────────────────────┤
│  Start      │  brew services start mongodb-...     │  sudo systemctl start mongod│  net start MongoDB  │
│  Stop       │  brew services stop mongodb-...      │  sudo systemctl stop mongod │  net stop MongoDB   │
│  Restart    │  brew services restart mongodb-...   │  sudo systemctl restart ... │  net stop + start   │
│  Status     │  brew services list                  │  sudo systemctl status ...  │  Get-Service MongoDB│
│  Logs       │  tail -f /opt/homebrew/var/log/...   │  journalctl -u mongod -f    │  Event Viewer       │
│  Auto-boot  │  brew services start (registers)     │  systemctl enable mongod    │  Default in MSI     │
└─────────────┴──────────────────────────────────────┴─────────────────────────────┴─────────────────────┘
```

---

## 3. mongosh Shell

### The problem

A running `mongod` is just a process quietly listening on a port — you need something to actually talk to it: run queries, inspect collections, poke at server state. That's `mongosh`.

`mongosh` (MongoDB Shell) is the modern replacement for the legacy `mongo` shell. It is a full JavaScript REPL with MongoDB-specific extensions — so everything you already know about JS syntax works, plus a set of `db.*` helpers layered on top.

---

### 3.1 Connecting

There's more than one way to connect, depending on where the server lives and how it's secured:

```bash
# Connect to localhost on default port 27017
mongosh

# Connect with explicit host and port
mongosh --host 127.0.0.1 --port 27017

# Connect using a connection string URI
mongosh "mongodb://localhost:27017"

# Connect to Atlas (cloud)
mongosh "mongodb+srv://username:password@cluster0.abc123.mongodb.net/mydb"

# Connect with authentication
mongosh --username admin --password secret --authenticationDatabase admin

# Connect to a specific database directly
mongosh "mongodb://localhost:27017/myDatabase"

# Connect with TLS enabled
mongosh "mongodb://localhost:27017" --tls --tlsCAFile /path/to/ca.pem
```

On successful connection you will see:

```
Current Mongosh Log ID: 64f3a2b1c0e1234567890abc
Connecting to: mongodb://127.0.0.1:27017/?directConnection=true
Using MongoDB: 7.0.3
Using Mongosh: 2.1.0

test>
```

That `test>` prompt is your confirmation everything worked — you're now sitting inside a live JavaScript session talking directly to `mongod`.

---

### 3.2 Navigation Commands

Once connected, these are the commands you'll reach for constantly — think of them as `ls`, `cd`, and `pwd` for a MongoDB server:

```javascript
// Show all databases
show dbs
// or
show databases

// Switch to (or create) a database
use myDatabase

// Show current database name
db

// Show all collections in current db
show collections
// or
show tables

// Drop current database
db.dropDatabase()

// Clear the screen
cls

// Exit the shell
exit
// or
quit()
// or Ctrl+D

// Show help
help

// Show methods on a collection
db.myCollection.help()

// Check server info
db.serverStatus()

// Check build info (version, OS, compiler)
db.serverBuildInfo()

// List all users
db.getUsers()

// Show running operations
db.currentOp()
```

---

### 3.3 .mongorc.js Customisation

**The problem:** every time you open the shell, you're typing the same helper snippets, the same "which database am I even in?" checks, the same telemetry-suppression flag. That's wasted keystrokes, every single session.

**Real-world analogy:** `.mongorc.js` (or `~/.mongoshrc.js` for mongosh) runs automatically every time the shell starts — exactly like `.bashrc` runs every time you open a terminal. You configure it once, and every future session inherits it for free.

**Internal working — what happens on shell startup:**

```
mongosh launches
      │
      v
Look for ~/.mongoshrc.js
      │
   ────────────
   │           │
 exists      missing
   │           │
   v           v
Execute it   Start with
 (custom     defaults only
 prompt,
 helpers,
 banner)
      │
      v
Interactive prompt appears
```

**Example:**

```javascript
// ~/.mongoshrc.js

// 1. Custom prompt: show db name + replication status
prompt = function() {
  const rsStatus = rs.status();
  const role = rsStatus.myState === 1 ? "PRIMARY" : "SECONDARY";
  return `[${role}] ${db.getName()} > `;
};

// 2. Shorthand helpers
const getCollections = () => db.getCollectionNames();
const dropAll = (dbName) => {
  use(dbName);
  db.dropDatabase();
  print(`Dropped database: ${dbName}`);
};

// 3. Suppress verbose startup warnings
disableTelemetry();

// 4. Banner message
print("=== Connected to MongoDB ===");
print(`Host: ${db.getMongo().host}`);
print(`DB:   ${db.getName()}`);
```

**Compare — which startup file, and how to skip it:**

```
┌─────────────────────────────────────────────────────┐
│  Shell Startup File Locations                       │
├────────────────────────────┬────────────────────────┤
│  mongosh (modern)          │ ~/.mongoshrc.js         │
│  mongo (legacy)            │ ~/.mongorc.js           │
│  Per-project override      │ mongosh --norc          │
└────────────────────────────┴────────────────────────┘
```

**Common mistake:** writing a `dropAll()` helper like the one above and forgetting it exists — then running it against the wrong database months later because muscle memory typed a shorthand you no longer consciously remember. Custom shell helpers are convenient, but they're also a foot-gun if they wrap destructive operations. Name them defensively (`dropAll_DANGEROUS`) or require a confirmation argument.

> **Memory hook:** ".mongorc.js is your shell's .bashrc — set it once, and every future session already knows your habits."

---

### 3.4 Tab Completion & Tips

mongosh supports rich tab completion powered by its JavaScript engine, plus a handful of ergonomics that make exploration faster:

```javascript
// Type "db." then press TAB -- lists all database methods
db.<TAB>

// Type "db.users." then press TAB -- lists all collection methods
db.users.<TAB>

// Bracket notation also works
db["my-collection"].<TAB>

// Multi-line editing: press ENTER mid-statement to continue
db.users.find({
  age: { $gt: 18 },   // ENTER here continues the expression
  active: true
})

// Load an external .js file into the shell
load("/path/to/script.js")

// Run a one-liner from the terminal without entering interactive mode
mongosh --eval "db.users.countDocuments()"

// Pretty-print a document
db.users.findOne()  // mongosh auto-formats JSON

// Use it() to iterate a cursor (like NEXT)
db.users.find()     // prints first 20 docs
it                  // prints next 20 docs
```

---

## 4. MongoDB Compass GUI

### The problem

Not every task is a scripting task. Sometimes you just want to browse a dataset visually, drag together an aggregation pipeline, or see a query's execution plan rendered as a diagram instead of squinting at JSON. That's what a GUI is for.

### Real-World Analogy

MongoDB Compass is the official graphical interface. Think of it as a flight cockpit compared to mongosh's command-line radio — same destination, different ergonomics.

**Installation:**

```bash
# macOS
brew install --cask mongodb-compass

# Ubuntu — download .deb from https://www.mongodb.com/try/download/compass
sudo dpkg -i mongodb-compass_1.x.x_amd64.deb

# Windows — bundled with MSI installer, or download standalone from website
```

**Connecting in Compass:**

```
Connection String: mongodb://localhost:27017
                   ─────┬──────  ──────┬──── ────┬────
                        │              │          │
                    Protocol        Host       Port
```

**Feature Overview:**

```
┌───────────────────────────────────────────────────────────────────┐
│  MongoDB Compass -- Feature Map                                   │
├──────────────────────────┬────────────────────────────────────────┤
│  Documents Tab           │  Browse, filter, edit, insert docs     │
│  Aggregation Tab         │  Visual pipeline builder with stages   │
│  Schema Tab              │  Infer data shapes from sample docs    │
│  Explain Plan Tab        │  Visualise query execution (IXSCAN etc)│
│  Indexes Tab             │  Create, inspect, drop indexes         │
│  Validation Tab          │  Set JSON Schema validation rules      │
│  Performance Tab         │  Real-time server metrics & slow ops   │
│  Shell Panel             │  Embedded mongosh for quick queries    │
└──────────────────────────┴────────────────────────────────────────┘
```

**Compare — when to reach for Compass vs mongosh:**

```
┌─────────────────────────────┬──────────────────────────────────────┐
│  Task                       │  Recommended Tool                    │
├─────────────────────────────┼──────────────────────────────────────┤
│  Explore unfamiliar dataset │  Compass (Schema tab)                │
│  Build complex aggregation  │  Compass (visual), then copy to code │
│  Debug slow queries         │  Compass (Explain Plan tab)          │
│  Scripting / automation     │  mongosh or driver                   │
│  CI/CD pipelines            │  mongosh --eval / driver             │
│  Index optimisation         │  Compass (Indexes + Explain)         │
└─────────────────────────────┴──────────────────────────────────────┘
```

---

## 5. Directory Structure

### The problem

If you don't know where MongoDB actually keeps its files, an upgrade, a disk-space cleanup, or a migration can turn into an accidental data-loss incident. Understanding where MongoDB stores its files prevents exactly that kind of surprise.

### Linux/Ubuntu Default Layout

```
/
├── var/
│   ├── lib/
│   │   └── mongodb/              <- DATA DIRECTORY (dbPath)
│   │       ├── WiredTiger        <- Storage engine metadata
│   │       ├── WiredTiger.wt     <- Root WiredTiger file
│   │       ├── WiredTigerHS.wt   <- History store
│   │       ├── mongod.lock       <- PID lock file (safety guard)
│   │       ├── sizeStorer.wt
│   │       ├── _mdb_catalog.wt   <- Collection/index catalogue
│   │       ├── admin/            <- admin database files
│   │       │   ├── collection-0-...wt
│   │       │   └── index-1-...wt
│   │       └── myDatabase/       <- user database files
│   │           └── collection-2-...wt
│   └── log/
│       └── mongodb/
│           └── mongod.log        <- LOG FILE (systemLog.path)
└── etc/
    └── mongod.conf               <- MAIN CONFIG FILE
```

### macOS Homebrew Layout

```
/opt/homebrew/
├── bin/
│   ├── mongod
│   ├── mongos
│   └── mongosh
├── etc/
│   └── mongod.conf
└── var/
    ├── mongodb/                  <- data files
    └── log/
        └── mongodb/
            └── mongo.log
```

### Key Files Explained

```
┌───────────────────────────┬──────────────────────────────────────────────┐
│  File / Directory         │  Purpose                                     │
├───────────────────────────┼──────────────────────────────────────────────┤
│  WiredTiger               │  Storage engine identifier & version file    │
│  mongod.lock              │  Contains PID; prevents double-start         │
│  _mdb_catalog.wt          │  Internal catalogue of all collections       │
│  *.wt files               │  Individual collection/index data pages      │
│  diagnostic.data/         │  FTDC -- time-series operational metrics     │
│  journal/                 │  Write-ahead log for crash recovery          │
└───────────────────────────┴──────────────────────────────────────────────┘
```

**Under the hood:** WiredTiger uses MVCC (Multi-Version Concurrency Control), storing data in B-trees. Each `.wt` file is a separate B-tree. The journal directory contains the WAL (Write-Ahead Log) that makes MongoDB durable even without `fsync` after every write.

> **Memory hook:** "The lock file is the 'occupied' sign on the door — MongoDB refuses to let a second process walk into a room that's already in use."

---

## 6. mongod.conf Explained

### The problem

Passing every setting as a `--flag` on the command line works fine for a quick local test, but it falls apart the moment you need a repeatable, version-controlled, production-grade setup. You can't easily diff two long command lines, and nobody wants to hand-type twenty flags every time the server restarts.

### Real-world analogy

`mongod.conf` is the equivalent of moving from remembering a long string of command-line arguments to keeping a settings file you can read top to bottom, check into git, and comment. It's the difference between configuring a router by memorising a sequence of button presses versus opening its settings page.

### Basic definition

`mongod.conf` uses YAML format. Every option maps to a command-line flag — `net.port` in the file is the same as `--port` on the CLI — but the file is far more readable and diffable for production setups.

### Example — a fully annotated config

```yaml
# /etc/mongod.conf  (Ubuntu)
# /opt/homebrew/etc/mongod.conf  (macOS)

# ──────────────────────────────────────────
# SYSTEM LOGGING
# ──────────────────────────────────────────
systemLog:
  destination: file          # 'file' or 'syslog'
  logAppend: true            # Append to existing log instead of overwriting
  path: /var/log/mongodb/mongod.log   # Must be writable by the mongodb user

# ──────────────────────────────────────────
# STORAGE
# ──────────────────────────────────────────
storage:
  dbPath: /var/lib/mongodb   # Where data files live (must be owned by mongodb)
  journal:
    enabled: true            # WAL for crash recovery -- always true in production
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1         # Default: 50% of (RAM - 1GB). Tune for your workload.
    collectionConfig:
      blockCompressor: snappy  # Options: none, snappy, zlib, zstd
    indexConfig:
      prefixCompression: true

# ──────────────────────────────────────────
# PROCESS MANAGEMENT
# ──────────────────────────────────────────
processManagement:
  fork: true                 # Run as background daemon (Linux only)
  pidFilePath: /var/run/mongodb/mongod.pid
  timeZoneInfo: /usr/share/zoneinfo

# ──────────────────────────────────────────
# NETWORK
# ──────────────────────────────────────────
net:
  port: 27017                # Default port; change for non-standard deployments
  bindIp: 127.0.0.1          # Comma-separated IPs to listen on
                             # Use 0.0.0.0 to listen on all interfaces (secure with firewall!)
  maxIncomingConnections: 1000000
  tls:
    mode: disabled           # Options: disabled, allowTLS, preferTLS, requireTLS
    # certificateKeyFile: /etc/ssl/mongodb.pem
    # CAFile: /etc/ssl/ca.pem

# ──────────────────────────────────────────
# SECURITY
# ──────────────────────────────────────────
security:
  authorization: disabled    # Change to 'enabled' in production!
  # keyFile: /etc/mongodb/keyfile  # For replica set internal auth

# ──────────────────────────────────────────
# OPERATION PROFILING
# ──────────────────────────────────────────
operationProfiling:
  mode: slowOp               # off | slowOp | all
  slowOpThresholdMs: 100     # Log operations slower than 100ms

# ──────────────────────────────────────────
# REPLICA SET (uncomment for replica set)
# ──────────────────────────────────────────
# replication:
#   replSetName: "rs0"
#   oplogSizeMB: 1024

# ──────────────────────────────────────────
# SHARDING (uncomment for shard member)
# ──────────────────────────────────────────
# sharding:
#   clusterRole: shardsvr    # or configsvr
```

### Internal working — applying a config change

```
Edit mongod.conf
      │
      v
sudo systemctl restart mongod   <- Most changes require restart
      │
      v                         <- Some changes (log rotation) use:
sudo systemctl reload mongod    <- SIGHUP (no downtime)
      │
      v
Check logs for startup errors:
sudo journalctl -u mongod -n 50
```

### Compare — config file vs CLI flags

| | Config file (`mongod.conf`) | CLI flags (`mongod --port ...`) |
|---|---|---|
| Version control | Easy to diff and check into git | Awkward — lives in a script or systemd unit |
| Readability | Grouped, commented, YAML-structured | A single long line, hard to scan |
| Comments | Supported | Not supported |
| Overrides | Can still be overridden by CLI flags at startup | Takes precedence over the file |
| Typical use | Production, any long-running deployment | Quick local test, one-off debugging run |

### Common mistakes

- Forgetting that `security.authorization: disabled` is the *default* — meaning a fresh install has no access control at all until you explicitly turn it on and create users first.
- Setting `bindIp: 0.0.0.0` without also locking things down with a firewall or authentication — that's an open door to the internet.
- Editing the file but restarting with `reload` when the change actually needed a full `restart` (network and storage settings need a restart; some logging settings can reload).

### Interview answer

"`mongod.conf` is a YAML file that mirrors every `mongod` command-line flag in a structured, commentable, version-controllable format. It's organized into blocks — `systemLog`, `storage`, `net`, `security`, `replication`, `sharding` — each controlling a different subsystem. Most changes require a full restart to take effect; a few, like log rotation, can be applied with `reload` (SIGHUP) without downtime. In production you always want `security.authorization: enabled` and a `bindIp` that's locked down to known hosts, backed by a firewall."

> **Memory hook:** "mongod.conf is the settings page you can read top-to-bottom — the CLI flags are the same settings, just scattered across one unreadable line."

---

## 7. Connection String Format

### The problem

Every driver, every shell, every GUI needs the same information to reach your database: which host, which credentials, which options. Instead of inventing a different format for each tool, MongoDB standardised all of it into one URI.

### Real-world analogy

The connection string is like a mailing address that also includes the door key and delivery instructions — host, port, username, password, and behavioural options, all packed into one line you can copy-paste anywhere.

### Full Anatomy

```
mongodb://username:password@host1:27017,host2:27017/authDB?options

─────┬──── ────┬──── ────┬──── ──┬───────────────── ───┬──── ─────┬────
     │         │         │       │                      │          │
  Scheme    User      Password  Hosts (comma list     Auth DB   Options
                                for replica sets)
```

### Scheme Types

```
┌──────────────────┬──────────────────────────────────────────────────────┐
│  mongodb://      │  Standard connection -- single node or replica set   │
│  mongodb+srv://  │  DNS SRV lookup -- Atlas and managed clusters        │
└──────────────────┴──────────────────────────────────────────────────────┘
```

The difference matters: `mongodb+srv://` doesn't hard-code hosts at all — it asks DNS for a list of servers at connection time, which is exactly why Atlas can add or remove nodes behind the scenes without ever handing you a new connection string.

### Common Connection String Examples

```bash
# 1. Local dev -- simplest form
mongodb://localhost:27017

# 2. With authentication
mongodb://myuser:mypassword@localhost:27017/mydb

# 3. Replica set -- list all members
mongodb://user:pass@host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0

# 4. Atlas SRV
mongodb+srv://user:pass@cluster0.abc12.mongodb.net/mydb?retryWrites=true&w=majority

# 5. TLS + auth source
mongodb://user:pass@prod.example.com:27017/mydb?tls=true&authSource=admin

# 6. Read preference (read from secondaries)
mongodb://user:pass@rs0.example.com/mydb?readPreference=secondaryPreferred

# 7. Connection pool size
mongodb://localhost:27017/mydb?maxPoolSize=50&minPoolSize=5
```

### Query Parameter Reference

```
┌──────────────────────────┬──────────────────────────────────────────────────┐
│  Parameter               │  Description                                     │
├──────────────────────────┼──────────────────────────────────────────────────┤
│  authSource=admin        │  Database where the user is defined              │
│  replicaSet=rs0          │  Replica set name (enables RS-aware behaviour)   │
│  tls=true                │  Enable TLS/SSL                                  │
│  readPreference=...      │  primary | secondary | nearest | etc.            │
│  w=majority              │  Write concern -- wait for majority ack          │
│  journal=true            │  Write concern -- wait for journal commit        │
│  maxPoolSize=100         │  Max connections in the connection pool          │
│  minPoolSize=5           │  Keep this many connections alive (warm pool)    │
│  connectTimeoutMS=10000  │  Time to wait for initial connection             │
│  socketTimeoutMS=0       │  Socket inactivity timeout (0 = never)          │
│  retryWrites=true        │  Retry eligible write operations on failure      │
│  retryReads=true         │  Retry eligible read operations on failure       │
│  directConnection=true   │  Skip RS topology discovery, connect directly    │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

### Common mistakes

Putting a plaintext password with special characters (like `@` or `:`) directly into the URI without URL-encoding it — the parser will misread where the password ends and the host begins. Always percent-encode credentials, or better, keep them out of the string entirely (see Q15 below).

> **Memory hook:** "The connection string is the whole mailing label — address, key, and delivery instructions in one line."

---

## 8. Connecting from Node.js

### Installing the Driver

```bash
npm install mongodb
# or
yarn add mongodb
```

### MongoClient Example (async/await)

```js
// db.js -- reusable connection module
import { MongoClient } from "mongodb";

// Connection string -- use environment variable in production
const URI = process.env.MONGO_URI || "mongodb://localhost:27017";

// Options
const CLIENT_OPTIONS = {
  maxPoolSize: 10,            // Max concurrent connections
  minPoolSize: 2,             // Keep alive minimum connections
  serverSelectionTimeoutMS: 5000,   // Fail fast if no server found
  socketTimeoutMS: 45000,     // Idle socket timeout
  connectTimeoutMS: 10000,    // Initial connection timeout
  retryWrites: true,
  retryReads: true,
};

// Singleton pattern -- create once, reuse across the app
let client;
let db;

export async function connectToDatabase(dbName = "myApp") {
  if (db) return db;  // Return cached connection

  client = new MongoClient(URI, CLIENT_OPTIONS);

  try {
    await client.connect();
    db = client.db(dbName);

    // Verify connection is live
    await db.command({ ping: 1 });
    console.log(`Connected to MongoDB -- database: ${dbName}`);

    return db;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    await client.close();
    throw error;
  }
}

export async function closeDatabaseConnection() {
  if (client) {
    await client.close();
    db = null;
    client = null;
    console.log("MongoDB connection closed.");
  }
}
```

```js
// app.js -- usage example
import { connectToDatabase, closeDatabaseConnection } from "./db.js";

async function main() {
  const db = await connectToDatabase("ecommerce");

  // Get a collection reference
  const users = db.collection("users");

  // INSERT a document
  const newUser = {
    name: "Alice",
    email: "alice@example.com",
    age: 30,
    createdAt: new Date(),
  };
  const insertResult = await users.insertOne(newUser);
  console.log("Inserted ID:", insertResult.insertedId);

  // FIND documents
  const activeUsers = await users
    .find({ age: { $gte: 18 } })
    .sort({ name: 1 })
    .limit(10)
    .toArray();
  console.log("Active users:", activeUsers.length);

  // UPDATE a document
  const updateResult = await users.updateOne(
    { email: "alice@example.com" },
    { $set: { lastLogin: new Date() } }
  );
  console.log("Modified count:", updateResult.modifiedCount);

  // DELETE a document
  const deleteResult = await users.deleteOne({ email: "alice@example.com" });
  console.log("Deleted count:", deleteResult.deletedCount);
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await closeDatabaseConnection();
  process.exit(0);
});

main().catch(console.error);
```

### Error Handling Pattern

Networks fail, duplicate keys happen — a production app needs to tell the difference between "MongoDB isn't running" and "this document already exists" instead of just crashing on both:

```js
// Wrap operations in try/catch with specific error types
import { MongoNetworkError, MongoServerError } from "mongodb";

async function safeInsert(collection, document) {
  try {
    return await collection.insertOne(document);
  } catch (error) {
    if (error instanceof MongoNetworkError) {
      console.error("Network error -- is MongoDB running?", error.message);
    } else if (error instanceof MongoServerError && error.code === 11000) {
      console.error("Duplicate key -- document already exists.");
    } else {
      throw error;  // Re-throw unexpected errors
    }
  }
}
```

---

## 9. Connecting from Python

### Installing the Driver

```bash
pip install pymongo
# For async support (Motor)
pip install motor
```

### pymongo Example

```python
# db.py -- synchronous pymongo connection
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, DuplicateKeyError
import os

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")

def get_client():
    """Create and return a MongoClient with recommended settings."""
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,   # Fail fast if no server
        maxPoolSize=10,
        minPoolSize=2,
        retryWrites=True,
        retryReads=True,
        connectTimeoutMS=10000,
        socketTimeoutMS=45000,
    )
    # Verify connection
    try:
        client.admin.command("ping")
        print("MongoDB connection: OK")
    except ConnectionFailure as e:
        print(f"MongoDB connection failed: {e}")
        raise
    return client

# Module-level singleton
client = get_client()
db = client["ecommerce"]

def main():
    users = db["users"]

    # INSERT
    new_user = {
        "name": "Bob",
        "email": "bob@example.com",
        "age": 25,
    }
    result = users.insert_one(new_user)
    print(f"Inserted ID: {result.inserted_id}")

    # FIND with filter
    for user in users.find({"age": {"$gte": 18}}).sort("name", 1).limit(5):
        print(user["name"], user["email"])

    # UPDATE
    update_result = users.update_one(
        {"email": "bob@example.com"},
        {"$set": {"verified": True}}
    )
    print(f"Modified: {update_result.modified_count}")

    # DELETE
    delete_result = users.delete_one({"email": "bob@example.com"})
    print(f"Deleted: {delete_result.deleted_count}")

    # COUNT
    total = users.count_documents({"age": {"$gte": 18}})
    print(f"Total adult users: {total}")

if __name__ == "__main__":
    main()
    client.close()
```

### Async with Motor

Synchronous pymongo blocks the calling thread on every database call — fine for scripts, a bottleneck for an async web framework like FastAPI. Motor wraps pymongo in an asyncio-friendly API so a single event loop can juggle many concurrent database calls without spinning up threads:

```python
# async_db.py -- Motor (async pymongo wrapper for asyncio/FastAPI)
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017"

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["ecommerce"]
    users = db["users"]

    # Async insert
    result = await users.insert_one({"name": "Carol", "age": 28})
    print(f"Inserted: {result.inserted_id}")

    # Async find -- cursor iteration
    async for user in users.find({"age": {"$gte": 21}}):
        print(user["name"])

    client.close()

asyncio.run(main())
```

---

## 10. Docker Setup

### The problem

Installing MongoDB directly on your OS means it's tangled up with your system — upgrading versions, running multiple versions side by side, or wiping everything clean all become fiddly. For local development, that's more friction than you need.

### Real-world analogy

Docker is ideal for local development — it keeps MongoDB isolated from your OS and makes version switching trivial. Think of it as a hermetically sealed filing cabinet you can spin up or throw away in seconds.

### Quick Start

```bash
# Pull and run MongoDB 7.0 with persistence
docker run -d \
  --name mongodb-dev \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=secret \
  -v mongodb-data:/data/db \
  -v mongodb-config:/data/configdb \
  mongo:7.0

# Verify the container is running
docker ps | grep mongodb-dev

# Connect with mongosh inside the container
docker exec -it mongodb-dev mongosh \
  --username admin --password secret --authenticationDatabase admin

# View logs
docker logs mongodb-dev -f
```

### docker-compose.yml (Recommended for projects)

For anything beyond a single throwaway container, `docker-compose.yml` lets you define the whole stack — MongoDB plus a GUI, plus the network wiring between them — as one file you check into your repo:

```yaml
# docker-compose.yml
version: "3.9"

services:
  mongodb:
    image: mongo:7.0
    container_name: mongodb-dev
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:-changeme}
      MONGO_INITDB_DATABASE: myApp
    volumes:
      - mongodb-data:/data/db
      - mongodb-config:/data/configdb
      - ./mongo-init.js:/docker-entrypoint-initdb.d/init.js:ro
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  mongo-express:
    image: mongo-express:latest
    container_name: mongo-express
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: admin
      ME_CONFIG_MONGODB_ADMINPASSWORD: ${MONGO_PASSWORD:-changeme}
      ME_CONFIG_MONGODB_URL: mongodb://admin:${MONGO_PASSWORD:-changeme}@mongodb:27017/
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - app-network

volumes:
  mongodb-data:
  mongodb-config:

networks:
  app-network:
    driver: bridge
```

```js
// mongo-init.js -- runs once on first container start
db = db.getSiblingDB("myApp");

db.createUser({
  user: "appUser",
  pwd: "appPassword",
  roles: [{ role: "readWrite", db: "myApp" }],
});

db.createCollection("users");
db.users.createIndex({ email: 1 }, { unique: true });

print("Database initialised.");
```

```bash
# Start the full stack
docker compose up -d

# Stop without removing data
docker compose stop

# Stop and remove containers (data preserved in named volumes)
docker compose down

# Remove containers AND volumes (full reset)
docker compose down -v

# Access Mongo Express GUI
open http://localhost:8081
```

Docker networking diagram — this is what `docker compose up` actually wires together:

```
┌─────────────────────────────────────────────────────────┐
│  Host Machine                                           │
│  ┌────────────────────┐    ┌────────────────────────┐  │
│  │  Your App          │    │  Mongo Express         │  │
│  │  localhost:3000    │    │  localhost:8081        │  │
│  └────────┬───────────┘    └──────────┬─────────────┘  │
│           │ app-network               │                 │
│  ┌────────v───────────────────────────v──────────────┐ │
│  │  Docker Bridge Network: app-network               │ │
│  │  ┌─────────────────────────────────────────────┐  │ │
│  │  │  mongodb container  (port 27017 exposed)    │  │ │
│  │  └─────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

> **Memory hook:** "docker compose down removes the furniture; docker compose down -v burns the building down — know which one you're running."

---

## 11. Hands-On Exercises

### Exercise 1 — Install and Verify

**Goal:** Get MongoDB running and confirm it is healthy.

**Steps:**
1. Install MongoDB using the method appropriate for your OS (see Section 1).
2. Start the service and confirm it is running.
3. Open mongosh and run the following:

```javascript
// Confirm server is alive
db.adminCommand({ ping: 1 })
// Expected: { ok: 1 }

// Check version
db.serverBuildInfo().version

// List databases (should show admin, config, local)
show dbs
```

**Success criteria:** `ping` returns `{ ok: 1 }` and you see the built-in system databases.

---

### Exercise 2 — Explore the Directory Structure

**Goal:** Understand where your data actually lives.

**Steps (Linux/macOS):**

```bash
# 1. Check the data directory
ls -la /var/lib/mongodb/           # Ubuntu
# or
ls -la /opt/homebrew/var/mongodb/  # macOS

# 2. View the log file in real time
sudo tail -f /var/log/mongodb/mongod.log  # Ubuntu

# 3. Back in mongosh, create a database and collection
use exerciseDB
db.testCollection.insertOne({ message: "Hello MongoDB" })

# 4. Back in bash -- observe the new .wt file appears
ls -la /var/lib/mongodb/
```

**Success criteria:** You can see new `.wt` files appear after inserting a document.

---

### Exercise 3 — Customise mongod.conf

**Goal:** Safely modify and apply a configuration change.

**Steps:**

```bash
# 1. Backup the original config
sudo cp /etc/mongod.conf /etc/mongod.conf.bak

# 2. Edit the config -- change the slow operation threshold
sudo nano /etc/mongod.conf
# Set: operationProfiling.slowOpThresholdMs: 50

# 3. Restart the service
sudo systemctl restart mongod

# 4. Verify the change took effect in mongosh
db.adminCommand({ profile: -1 })
# Should show slowms: 50
```

**Success criteria:** `profile` command shows your new `slowOpThresholdMs` value.

---

### Exercise 4 — Node.js Connection with Error Handling

**Goal:** Write a Node.js script that connects, inserts, finds, and handles errors gracefully.

```js
// exercise4.mjs
import { MongoClient, MongoServerError } from "mongodb";

const URI = "mongodb://localhost:27017";

async function run() {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 3000 });

  try {
    await client.connect();
    const db = client.db("exerciseDB");
    const col = db.collection("products");

    // Insert with unique index to test duplicate handling
    await col.createIndex({ sku: 1 }, { unique: true });

    await col.insertOne({ sku: "WIDGET-001", name: "Widget", price: 9.99 });
    console.log("First insert: OK");

    // This should throw DuplicateKeyError (code 11000)
    await col.insertOne({ sku: "WIDGET-001", name: "Duplicate Widget", price: 5.00 });
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) {
      console.log("Caught expected duplicate key error:", err.message);
    } else {
      throw err;
    }
  } finally {
    await client.close();
  }
}

run();
```

**Success criteria:** Script prints "First insert: OK" then "Caught expected duplicate key error" without crashing.

---

### Exercise 5 — Docker Compose Full Stack

**Goal:** Run MongoDB + Mongo Express in Docker and connect from the host.

**Steps:**

```bash
# 1. Create a project directory
mkdir mongo-docker-lab && cd mongo-docker-lab

# 2. Create docker-compose.yml (use the template from Section 10)

# 3. Start the stack
docker compose up -d

# 4. Connect from mongosh on the host
mongosh "mongodb://admin:changeme@localhost:27017" --authenticationDatabase admin

# 5. Create a test collection
use labDB
db.items.insertMany([
  { name: "Apple", qty: 100 },
  { name: "Banana", qty: 50 }
])
db.items.find()

# 6. Open Mongo Express in browser
open http://localhost:8081

# 7. Clean up
docker compose down -v
```

**Success criteria:** You can query MongoDB from both mongosh and the Mongo Express GUI.

---

## 12. Interview Q&A

**Q1. What is the default port MongoDB listens on, and how would you change it?**

The default port is `27017`. To change it, edit `net.port` in `mongod.conf` and restart the service. All clients connecting to that instance must then use the new port in their connection strings.

---

**Q2. What is the difference between `mongod` and `mongos`?**

`mongod` is the core database daemon — it stores data and handles queries for a single mongod instance. `mongos` is the query router for a sharded cluster; it receives client requests and routes them to the appropriate shards. In a sharded deployment, clients talk to `mongos`, not to individual `mongod` instances directly.

---

**Q3. Why should `security.authorization` be enabled in production?**

Without authorization, any client that can reach the network port can read, write, or drop any database. Enabling it enforces role-based access control (RBAC) so each user can only perform actions their role permits. You must create at least one admin user before enabling it, or you will lock yourself out.

---

**Q4. What is the purpose of `mongod.lock`?**

It contains the PID of the running `mongod` process. If the file exists when mongod starts, it refuses to start (to prevent two instances from corrupting the same data directory). If mongod crashed uncleanly, you may need to delete the lock file and run `mongod --repair` before starting normally.

---

**Q5. Explain the difference between `mongodb://` and `mongodb+srv://` connection strings.**

`mongodb://` specifies hosts directly in the URI. `mongodb+srv://` uses DNS SRV and TXT records to discover the cluster topology dynamically — you give one hostname and DNS returns the full replica set member list and connection options. Atlas exclusively uses `mongodb+srv://` because it abstracts away host-level details and supports failover without hardcoding IPs.

---

**Q6. What is WiredTiger and why does MongoDB use it?**

WiredTiger is MongoDB's default storage engine since version 3.2. It provides document-level concurrency control (multiple writers can operate on different documents simultaneously), compression (snappy by default), and a write-ahead log (journal) for durability. The alternative is the legacy MMAPv1 engine, which was removed in MongoDB 4.2.

---

**Q7. What does `bindIp: 127.0.0.1` in mongod.conf do, and when would you change it?**

It restricts mongod to accepting connections only from the local loopback interface (the same machine). You would change it to `0.0.0.0` or a specific IP when other machines need to connect (e.g., your app server is separate from the database server). Always pair this with firewall rules and enabled authentication when accepting remote connections.

---

**Q8. What is the WiredTiger cache and how do you size it?**

The WiredTiger cache is an in-memory buffer that holds frequently accessed data pages (similar to InnoDB buffer pool). By default it uses 50% of RAM minus 1 GB, with a minimum of 256 MB. You set it with `storage.wiredTiger.engineConfig.cacheSizeGB`. Undersizing causes excessive disk I/O; oversizing starves the OS page cache and other processes.

---

**Q9. How does the MongoDB journal provide durability?**

The journal is a write-ahead log (WAL). Before data is written to the main data files, it is written to the journal. If mongod crashes mid-write, on restart it replays the journal to bring the data files to a consistent state. With `journal.enabled: true`, MongoDB guarantees no data loss for committed writes (as long as the journal is on durable storage).

---

**Q10. What happens if you connect to a database name that does not exist?**

MongoDB creates it lazily — the database is not actually created on disk until you insert the first document into a collection within it. Running `use nonExistentDB` in mongosh is safe and will not create any files. Only `db.myCollection.insertOne({})` causes the database to materialise.

---

**Q11. How do connection pools work in MongoDB drivers, and why are they important?**

A connection pool maintains a set of pre-established TCP connections to MongoDB. When your application needs to perform an operation, it borrows a connection from the pool, uses it, and returns it. This avoids the latency cost of creating a new TCP connection for every query. `maxPoolSize` caps total concurrent connections per client instance; `minPoolSize` keeps warm connections alive to avoid cold-start latency.

---

**Q12. What is `operationProfiling` and when would you enable it?**

The profiler logs slow operations to the `system.profile` capped collection. `mode: slowOp` logs any operation exceeding `slowOpThresholdMs` milliseconds. `mode: all` logs everything (only for short-term debugging — it impacts performance). Use it to find queries that need indexes. Query with `db.system.profile.find().sort({ ts: -1 }).limit(10)`.

---

**Q13. How would you connect to a replica set from a Node.js application?**

Include all replica set members in the connection string and specify `replicaSet=rsName`:

```js
const URI = "mongodb://host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0&readPreference=secondaryPreferred";
const client = new MongoClient(URI);
```

The driver automatically handles primary election failover — if the primary goes down, it discovers the new primary and re-routes writes without application code changes.

---

**Q14. What is the diagnostic.data directory inside the MongoDB data path?**

It stores FTDC (Full-Time Diagnostic Data Capture) files — compact binary time-series data about server performance (memory, connections, operation counts, locks). MongoDB Support and tools like `mtools` use these files for post-incident analysis. They have minimal performance overhead and should never be deleted unless you need disk space urgently.

---

**Q15. Why is it recommended to use environment variables for the MongoDB connection URI rather than hardcoding it?**

Hardcoded credentials in source code are a critical security vulnerability — they get committed to git, appear in logs, and are leaked if the repository is compromised. Environment variables keep secrets out of code, allow different credentials per environment (dev/staging/prod) without code changes, and are compatible with secrets management systems like Vault, AWS Secrets Manager, and Kubernetes Secrets.

---

*End of 02 -- Installation & Setup*
