# MongoDB Authorization & RBAC (Role-Based Access Control)

## Table of Contents

1. [Authorization Overview](#1-authorization-overview)
2. [Built-In Roles Reference Table](#2-built-in-roles-reference-table)
3. [Creating Custom Roles](#3-creating-custom-roles)
4. [Field-Level Redaction with $redact](#4-field-level-redaction-with-redact)
5. [TLS/SSL Setup](#5-tlsssl-setup)
6. [Encryption at Rest](#6-encryption-at-rest)
7. [Auditing (Enterprise)](#7-auditing-enterprise)
8. [Role Hierarchy Diagram](#8-role-hierarchy-diagram)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Authorization Overview

The previous file (`01-Authentication.md`) was all about the bouncer at the door — checking ID, confirming you are who you say you are. But here's the thing: once the bouncer waves you in, what stops you from walking into the server room, the finance office, and the CEO's desk?

That's the problem authorization solves. Every company has employees who've been let in the front door but absolutely should not have equal access to every room. An intern's badge should open the break room, not the server room. A junior engineer's login shouldn't be able to `dropDatabase()` on production. Authentication answers "who are you?" — authorization answers **"now that I know who you are, what are you actually allowed to do?"**

**The analogy:** think of MongoDB roles like a company's job-title-based building access badges. Every employee gets a badge (that's authentication — the badge itself proves identity). But the badge is also programmed with a job title, and that title determines which doors it opens. Marketing's badge opens the marketing floor. IT's badge opens the server room. The intern's badge opens... the break room, and maybe the open-plan desks. Nobody hands an intern the master key just because it's convenient.

**The basic definition:** MongoDB uses **Role-Based Access Control (RBAC)**. Every user is assigned one or more roles, and each role is really just a bundle of privileges, where a privilege is an (action, resource) pair — "you may `find` on the `orders` collection," "you may `insert` into the `events` collection," and so on.

```
┌─────────────────────────────────────────────────────────┐
│                  Authorization Model                    │
│                                                         │
│  User ──► Role(s) ──► Privilege(s) ──► Resource+Action │
│                                                         │
│  Resource = database, collection, cluster, or anyDB     │
│  Action   = find, insert, update, remove, createIndex…  │
└─────────────────────────────────────────────────────────┘
```

A few ideas worth keeping in your head as you go through this file:

- **Least-privilege principle**: give a role only what its job actually requires — nothing extra "just in case."
- **Role inheritance**: a role can include other roles, the same way a "senior manager" badge might inherit everything a "manager" badge already has, plus more.
- **Scope**: most roles are granted per-database; a few span the whole cluster (more on this in Section 2).
- **None of this matters until auth is switched on** — start `mongod` with `--auth`, or set `security.authorization: enabled` in `mongod.conf`.

```yaml
# mongod.conf — enable authorization
security:
  authorization: enabled
```

```bash
# Or via CLI flag
mongod --auth --port 27017 --dbpath /data/db
```

---

## 2. Built-In Roles Reference Table

Before reaching for custom roles, check whether MongoDB already ships something that fits. It provides two flavors: **database roles** (badges that open one specific floor) and **all-databases roles** (badges that open that same kind of door on every floor in the building).

### 2.1 Database-Scoped Roles

| Role | Scope | What It Grants |
|------|-------|----------------|
| `read` | single DB | find, listCollections, listIndexes, dbStats, collStats |
| `readWrite` | single DB | read + insert, update, delete, createIndex, dropIndex, renameCollection |
| `dbAdmin` | single DB | schema, indexing, stats (no data read/write) — createCollection, dropCollection, reIndex, collMod, validate |
| `userAdmin` | single DB | create/modify/drop users and roles on that DB |
| `dbOwner` | single DB | combination of readWrite + dbAdmin + userAdmin (full ownership) |
| `enableSharding` | single DB | enable sharding on a database |

### 2.2 All-Databases Roles (admin DB)

| Role | What It Grants |
|------|----------------|
| `readAnyDatabase` | `read` on every database including system |
| `readWriteAnyDatabase` | `readWrite` on every database |
| `userAdminAnyDatabase` | `userAdmin` on every database — effectively a user-management superuser |
| `dbAdminAnyDatabase` | `dbAdmin` on every database |
| `clusterMonitor` | read cluster monitoring data (rs.status, connPoolStats, top) |
| `clusterManager` | manage and monitor cluster (add/remove shards, setParameter) |
| `clusterAdmin` | all cluster actions: clusterManager + clusterMonitor + hostManager |
| `backup` | mongodump, copyDatabase, fsync |
| `restore` | mongorestore |
| `root` | **superuser** — combines readWriteAnyDatabase + dbAdminAnyDatabase + userAdminAnyDatabase + clusterAdmin + restore + backup |

### 2.3 Role Comparison: Common Pairings

A quick gut-check table for "which badge does this job actually need?":

```
┌─────────────────┬──────────────┬──────────────┬──────────────┐
│ Scenario        │ Recommended  │ Can Read?    │ Can Write?   │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ Analytics user  │ read         │ Yes          │ No           │
│ App service     │ readWrite    │ Yes          │ Yes          │
│ DBA (schema)    │ dbAdmin      │ No data      │ No data      │
│ DBA (full)      │ dbOwner      │ Yes          │ Yes          │
│ Ops monitoring  │ clusterMonitor│ Cluster only │ No           │
│ Superuser admin │ root         │ All          │ All          │
└─────────────────┴──────────────┴──────────────┴──────────────┘
```

### 2.4 Creating a User with a Built-In Role

Enough theory — here's what it looks like to actually hand out a badge:

```js
// Connect to admin database first
use admin

// Create an application user with readWrite on "orders" database
db.createUser({
  user: "appUser",
  pwd:  "S3cur3P@ss!",
  roles: [
    { role: "readWrite", db: "orders" },
    { role: "read",      db: "reporting" }
  ]
})

// Create a DBA user
db.createUser({
  user: "dbaUser",
  pwd:  "DBA$ecure99",
  roles: [
    { role: "dbOwner",      db: "orders" },
    { role: "clusterMonitor", db: "admin" }
  ]
})

// Verify the user
db.getUser("appUser")
```

Notice `appUser` doesn't get one blanket role — it gets `readWrite` on `orders` and only `read` on `reporting`. That's least-privilege in action: this user's job doesn't include writing to the reporting database, so it simply can't.

---

## 3. Creating Custom Roles

Built-in roles are convenient, but they're also blunt instruments. What if your ingest service should *only* be allowed to `insert` into one collection — never read it back, never update it, never touch any other collection? None of the built-in roles are that narrow. `readWrite` gives it far more than it needs.

This is the same problem real companies solve with custom badge profiles: "Warehouse Staff" isn't the same badge as "Warehouse Manager," even though both are warehouse roles. Someone had to sit down and define, precisely, which doors each profile opens. That's exactly what `createRole` lets you do in MongoDB — define exact (action, resource) pairs instead of settling for one of the pre-made bundles.

### 3.1 createRole Syntax

```js
db.createRole({
  role: "<roleName>",
  privileges: [
    {
      resource: { db: "<database>", collection: "<collection>" },
      actions: ["<action1>", "<action2>"]
    }
  ],
  roles: [ { role: "<inheritedRole>", db: "<db>" } ]  // optional role inheritance
})
```

**Resource types** — this is the part people get wrong most often, so look closely at what each shape actually scopes:

| Resource Object | Meaning |
|----------------|---------|
| `{ db: "myDB", collection: "orders" }` | Specific collection |
| `{ db: "myDB", collection: "" }` | All collections in myDB |
| `{ db: "", collection: "" }` | All collections in all databases |
| `{ cluster: true }` | Cluster-level resource |
| `{ anyResource: true }` | Every resource (use carefully) |

### How a role actually resolves to a permitted action

It's worth seeing the full path from "user connects" to "MongoDB allows or rejects one specific operation," because this is exactly what's happening under the hood every time a query runs:

```
User "analyst1" runs: db.sales.find({ region: "APAC" })
        │
        ▼
MongoDB looks up analyst1's assigned roles
        │
        ▼
   analyticsReader (on db: reporting)
        │
        ▼
Role's privilege list:
  { resource: { db: "reporting", collection: "sales" }, actions: ["find", ...] }
        │
        ▼
Does the requested (db, collection, action) match any privilege?
  db: reporting == reporting   ✓
  collection: sales == sales   ✓
  action: find ∈ [find, listIndexes, collStats]  ✓
        │
        ▼
      ALLOWED
```

If `analyst1` instead tried `db.sales.insertOne(...)`, the same lookup would happen — but `insert` isn't in the role's actions list, so the match fails and MongoDB rejects the operation. No privilege, no access. That's the whole engine, every single time.

### 3.2 Example: Read-Only Analytics Role

```js
use reporting

db.createRole({
  role: "analyticsReader",
  privileges: [
    {
      resource: { db: "reporting", collection: "sales" },
      actions: ["find", "listIndexes", "collStats"]
    },
    {
      resource: { db: "reporting", collection: "products" },
      actions: ["find"]
    }
  ],
  roles: []  // no inherited roles
})

// Assign to user
db.createUser({
  user: "analyst1",
  pwd:  "Analyt!cs23",
  roles: [{ role: "analyticsReader", db: "reporting" }]
})
```

### 3.3 Example: Insert-Only Ingest Role (append-only log)

This is exactly the "warehouse staff can only drop off packages, not read the inventory list" scenario:

```js
use logs

db.createRole({
  role: "logIngestor",
  privileges: [
    {
      resource: { db: "logs", collection: "events" },
      actions: ["insert"]
    }
  ],
  roles: []
})

db.createUser({
  user: "kafkaConnector",
  pwd:  "K@fk@2024",
  roles: [{ role: "logIngestor", db: "logs" }]
})
```

### 3.4 Example: Custom Admin Role (no user management)

Sometimes you want someone who can manage schema and indexes — but absolutely should not be able to create or drop user accounts. That's a "facilities manager" badge, not a "building owner" badge:

```js
use admin

db.createRole({
  role: "schemaAdmin",
  privileges: [
    {
      resource: { db: "orders", collection: "" },
      actions: [
        "createCollection", "dropCollection",
        "createIndex",      "dropIndex",
        "collMod",          "validate",
        "reIndex",          "compact"
      ]
    }
  ],
  roles: [
    { role: "read", db: "orders" }  // also inherits read
  ]
})
```

Notice the `roles: [...]` line at the bottom — this is role inheritance in action. `schemaAdmin` doesn't need to redeclare `find` privileges by hand; it simply inherits everything `read` already grants, on top of its own schema-management privileges.

### 3.5 Managing Custom Roles

Roles aren't a one-time decision — they get audited, updated, and revoked just like real badge profiles do:

```js
// View all roles on current DB
db.getRoles({ showPrivileges: true, showBuiltinRoles: false })

// Update a role — add action
db.updateRole("analyticsReader", {
  privileges: [
    {
      resource: { db: "reporting", collection: "sales" },
      actions: ["find", "listIndexes", "collStats", "dbStats"]
    }
  ]
})

// Revoke a role from a user
db.revokeRolesFromUser("analyst1", [
  { role: "analyticsReader", db: "reporting" }
])

// Grant a role to an existing user
db.grantRolesToUser("analyst1", [
  { role: "read", db: "archive" }
])

// Drop a custom role
db.dropRole("analyticsReader")
```

**Common mistakes to watch for:**

- **Granting overly broad roles "just to be safe."** Handing an ingest service `readWrite` when it only ever calls `insert` is the RBAC equivalent of giving the mailroom clerk a master key because "it might come in handy." It won't — until someone breaks in.
- **Confusing database-level vs. collection-level scoping.** `{ db: "myDB", collection: "" }` covers every collection in `myDB` — including ones created tomorrow. If you meant to scope a role to just `orders`, but wrote `collection: ""`, you've quietly granted access to every other collection in that database too.
- **Forgetting that role changes don't retroactively fix already-open connections** — more on this in the Interview Q&A section below.

**Interview answer:** "Custom roles let you define exact (action, resource) privilege pairs instead of relying on coarse built-in roles like `readWrite`. You create them with `db.createRole()`, specifying a `privileges` array — each with a `resource` (a database, collection, or cluster-level target) and a list of `actions` — plus an optional `roles` array for inheriting other roles. This lets you enforce least privilege precisely, e.g., an insert-only role for a log ingestion service that can never read or delete data."

> **Memory hook:** An intern's badge opens the break room. It doesn't open the server room — no matter how nicely they ask. Custom roles are how you decide, door by door, exactly what each badge opens.

---

## 4. Field-Level Redaction with $redact

Roles and privileges control access at the collection level — but what if two users need to query the *same collection*, and see *different subsets of the same documents* based on a security label baked into the data itself? RBAC alone can't do that; it doesn't look inside your documents.

That's the gap `$redact` fills. It's an aggregation pipeline stage that prunes documents — or parts of documents — based on conditions evaluated against each document's own fields. Think of it as a badge reader built into the document itself: the document carries its own clearance-level sticker, and `$redact` checks that sticker against the reader before deciding what to show.

### 4.1 System Variables

| Variable | Meaning |
|----------|---------|
| `$$DESCEND` | Include this level, recurse into subdocuments |
| `$$PRUNE` | Exclude this document/subdocument entirely |
| `$$KEEP` | Include this document/subdocument and all children (no recursion) |

### 4.2 Anatomy of $redact

```
Aggregation pipeline
       │
       ▼
┌─────────────┐    $$KEEP   ──► include entire sub-doc, stop recursing
│   $redact   │──► $$PRUNE  ──► exclude entire sub-doc
│  (per node) │──► $$DESCEND──► include this level, recurse into children
└─────────────┘
```

### 4.3 Example: Redact by Security Label

```js
// Documents have a "securityLevel" field: 1 (public), 2 (internal), 3 (confidential)
// User's clearance level is stored in application variable `userClearance`

db.reports.aggregate([
  {
    $redact: {
      $cond: {
        if:   { $lte: ["$securityLevel", 2] },  // user can see level 1 and 2
        then: "$$DESCEND",
        else: "$$PRUNE"
      }
    }
  }
])
```

### 4.4 Example: Redact Fields with Access Tags

```js
// Document structure:
// { name: "Report Q1", data: { revenue: 500000, access: ["finance", "exec"] } }

const userGroups = ["finance"];

db.reports.aggregate([
  {
    $redact: {
      $cond: {
        if: {
          $or: [
            { $not: { $isArray: "$access" } },          // no tag = public
            { $gt: [
                { $size: {
                    $setIntersection: ["$access", userGroups]
                }},
                0
              ]
            }
          ]
        },
        then: "$$DESCEND",
        else: "$$PRUNE"
      }
    }
  }
])
```

### 4.5 Field-Level Encryption (Client-Side)

`$redact` hides fields based on rules at query time — but the server still holds the plaintext. If you need a field that even a database admin with full `root` access can never read, that's a different problem. MongoDB 4.2+ addresses it with **Client-Side Field Level Encryption (CSFLE)**, which encrypts fields before they ever leave the driver. The server only ever sees ciphertext.

```js
// Node.js example — auto-encryption config
const { MongoClient } = require("mongodb");
const { ClientEncryption } = require("mongodb-client-encryption");

const autoEncryptionOpts = {
  keyVaultNamespace:  "encryption.__keyVault",
  kmsProviders: {
    local: { key: Buffer.alloc(96) }  // 96-byte master key
  },
  schemaMap: {
    "medicalDB.patients": {
      bsonType: "object",
      properties: {
        ssn: {
          encrypt: {
            bsonType: "string",
            algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic"
          }
        },
        bloodType: {
          encrypt: {
            bsonType: "string",
            algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random"
          }
        }
      }
    }
  }
};

const client = new MongoClient(uri, { autoEncryption: autoEncryptionOpts });
```

> **Memory hook:** RBAC decides who gets into the room. `$redact` decides which paragraphs of the document on the table they're allowed to read once they're in.

---

## 5. TLS/SSL Setup

Everything so far has been about controlling access *once a connection exists*. But there's an earlier question: what stops someone from just listening in on the network cable between your app and `mongod`, and reading every query and every document as it flies past in plain text? Roles and passwords don't help if the traffic itself is wide open. That's what TLS is for — it encrypts data **in transit**.

### 5.1 TLS Modes

| Mode | Server Cert | Client Cert | Description |
|------|------------|-------------|-------------|
| `disabled` | No | No | No TLS (development only) |
| `allowTLS` | Yes | Optional | Accepts both TLS and non-TLS connections |
| `preferTLS` | Yes | Optional | Prefers TLS; accepts non-TLS |
| `requireTLS` | Yes | Optional | All connections must use TLS |

```
Client ──────TLS Handshake──────► mongod
         1. Client Hello
         2. Server Certificate
         3. Client verifies cert against CA
         4. Session keys exchanged
         5. Encrypted channel established
```

### 5.2 Generating Test Certificates (Self-Signed)

```bash
# Generate CA key and cert
openssl req -x509 -newkey rsa:4096 -keyout ca.key -out ca.crt \
  -days 365 -nodes -subj "/CN=MyCA"

# Generate server key and CSR
openssl req -newkey rsa:4096 -keyout server.key -out server.csr \
  -nodes -subj "/CN=localhost"

# Sign server cert with CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt -days 365

# Combine key and cert into PEM
cat server.key server.crt > server.pem
```

### 5.3 mongod.conf TLS Configuration

```yaml
net:
  port: 27017
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/mongodb/server.pem
    CAFile: /etc/mongodb/ca.crt
    allowConnectionsWithoutCertificates: true   # clients don't need client cert
    # For mutual TLS (mTLS), set allowConnectionsWithoutCertificates: false
    # and provide client certificates
```

### 5.4 Connecting with TLS

```bash
# mongosh with TLS
mongosh --tls \
  --tlsCAFile /etc/mongodb/ca.crt \
  --tlsCertificateKeyFile /etc/mongodb/client.pem \
  "mongodb://appUser:S3cur3P%40ss@host:27017/orders"

# Connection string with TLS options
mongodb://user:pass@host:27017/db?tls=true&tlsCAFile=/path/to/ca.crt
```

```js
// Node.js driver with TLS
const { MongoClient } = require("mongodb");
const fs = require("fs");

const client = new MongoClient("mongodb://host:27017", {
  tls: true,
  tlsCAFile: "/etc/mongodb/ca.crt",
  tlsCertificateKeyFile: "/etc/mongodb/client.pem",
  tlsCertificateKeyFilePassword: "certpassword"
});
```

### 5.5 Verifying TLS

```bash
# Check if mongod is listening with TLS
openssl s_client -connect localhost:27017 -CAfile /etc/mongodb/ca.crt

# mongod logs will show:
# "Listening on" ... with SSL mode
```

> **Memory hook:** RBAC and authentication guard the *doors*. TLS guards the *hallway* — it stops someone from tapping the wire and reading the conversation as it passes between rooms.

---

## 6. Encryption at Rest

TLS protects data while it's moving across the network. But what happens after it lands on disk? If someone steals a drive, or a decommissioned server ends up on eBay with the data still sitting on it, TLS is irrelevant — the data was never "in transit" at that point. Encryption at rest is the answer: MongoDB Enterprise's **WiredTiger Encryption Engine** encrypts the actual data files on disk.

### 6.1 How It Works

```
┌──────────────────────────────────────────────────┐
│               Encryption at Rest                 │
│                                                  │
│  Data ──► WiredTiger Encryption Layer ──► Disk   │
│                    │                             │
│             Master Key (KMIP/local)              │
│                    │                             │
│         Database Keys (per-database)             │
│                    │                             │
│      Page-level AES-256-CBC encryption           │
└──────────────────────────────────────────────────┘
```

### 6.2 mongod.conf Encryption Configuration

```yaml
# Enterprise only
security:
  enableEncryption: true
  encryptionKeyIdentifier: "myKey"
  kmip:
    serverName: kmip.example.com
    port: 5696
    clientCertificateFile: /etc/mongodb/kmip-client.pem
    serverCAFile: /etc/mongodb/kmip-ca.crt

# For local key management (development/testing only)
# security:
#   enableEncryption: true
#   encryptionCipherMode: AES256-CBC
```

### 6.3 Local Key Management (Non-Enterprise Alternative)

For Community Edition, use filesystem-level encryption:

```bash
# Linux LUKS (dm-crypt)
cryptsetup luksFormat /dev/sdb
cryptsetup open /dev/sdb mongo_data
mkfs.ext4 /dev/mapper/mongo_data
mount /dev/mapper/mongo_data /data/db

# Or use encrypted filesystem (eCryptfs, ZFS encryption, etc.)
```

### 6.4 Key Rotation

```bash
# Rotate the master key (Enterprise)
mongod --enableEncryption \
       --kmipRotateMasterKey \
       --kmipServerName kmip.example.com \
       --kmipClientCertificateFile /etc/mongodb/client.pem
```

> **Memory hook:** TLS locks the delivery truck in transit. Encryption at rest locks the warehouse once the truck arrives — steal the building, and the boxes are still sealed.

---

## 7. Auditing (Enterprise)

Even with tight RBAC, TLS, and encryption at rest, there's one more question a security team will always ask: **prove it.** Prove who accessed what and when. Prove nobody deleted a record they shouldn't have. That's what auditing is for — it's the building's security-camera footage: every badge swipe, every door opened, logged and timestamped, ready to be pulled up for a compliance review (PCI-DSS, HIPAA, SOX).

### 7.1 Auditable Event Categories

| Category | Examples |
|----------|---------|
| Authentication | login success/failure |
| Authorization | privilege checks |
| CRUD operations | find, insert, update, delete |
| DDL operations | createCollection, dropDatabase |
| User management | createUser, dropUser, grantRolesToUser |
| Role management | createRole, dropRole |
| Replication | replSetReconfig, heartbeat |
| Sharding | addShard, removeShard, shardCollection |

### 7.2 mongod.conf Audit Configuration

```yaml
# Enterprise only
auditLog:
  destination: file          # file | syslog | console
  format: JSON               # JSON | BSON
  path: /var/log/mongodb/audit.json
  filter: '{ atype: { $in: ["authenticate", "createUser", "dropUser", "insert", "remove", "update"] } }'
```

### 7.3 Audit Filter Examples

```js
// Audit only authentication events
{ "atype": "authenticate" }

// Audit CRUD on a specific collection
{
  "atype": { "$in": ["insert", "update", "delete", "find"] },
  "param.ns": "orders.transactions"
}

// Audit user management events by specific user
{
  "atype": { "$in": ["createUser", "dropUser", "grantRolesToUser"] }
}

// Audit all failed authentication attempts
{
  "atype": "authenticate",
  "result": { "$ne": 0 }
}
```

### 7.4 Sample Audit Log Entry (JSON)

```json
{
  "atype": "authenticate",
  "ts":    { "$date": "2024-03-15T10:23:45.123Z" },
  "local": { "ip": "127.0.0.1", "port": 27017 },
  "remote":{ "ip": "192.168.1.50", "port": 54321 },
  "users": [{ "user": "appUser", "db": "orders" }],
  "roles": [{ "role": "readWrite", "db": "orders" }],
  "param": {
    "user":      "appUser",
    "db":        "orders",
    "mechanism": "SCRAM-SHA-256"
  },
  "result": 0
}
```

### 7.5 Querying Audit Logs

```bash
# Filter audit log for failed logins
grep '"result":' /var/log/mongodb/audit.json | grep -v '"result": 0'

# Using jq for structured queries
cat /var/log/mongodb/audit.json | \
  jq 'select(.atype == "authenticate" and .result != 0) | {ts, user: .users[0].user, result}'
```

### 7.6 Runtime Audit Filter (4.0+)

```js
// Change audit filter without restarting mongod
db.adminCommand({
  setAuditConfig: 1,
  filter: {
    atype: { $in: ["authenticate", "createUser"] }
  }
})

// View current audit configuration
db.adminCommand({ getAuditConfig: 1 })
```

> **Memory hook:** Auditing doesn't stop anyone at the door — it's the camera footage you pull up afterward to answer "who was here, and what did they do?"

---

## 8. Role Hierarchy Diagram

Pulling everything from Sections 2 and 3 together, here's how the built-in roles actually stack on top of each other:

```
                        root
                          │
          ┌───────────────┼───────────────┐
          │               │               │
  readWriteAnyDatabase  dbAdminAnyDB  userAdminAnyDB
          │               │               │
       readWrite        dbAdmin        userAdmin
          │
        read
                        clusterAdmin
                          │
            ┌─────────────┼─────────────┐
            │             │             │
     clusterManager  clusterMonitor  hostManager

                        dbOwner
                          │
            ┌─────────────┼─────────────┐
            │             │             │
         readWrite      dbAdmin      userAdmin
```

**Back to the badge analogy** — this diagram is really just an org chart of badge levels:

- `read` = visitor badge (enter, look around, no touching)
- `readWrite` = employee badge (enter, use equipment)
- `dbAdmin` = facilities badge (fix equipment, no data access)
- `dbOwner` = department head badge (full control of your floor)
- `root` = master key card (every door, every floor)
- `clusterAdmin` = building manager (controls the entire building's infrastructure)

The higher you go up this chart, the closer you get to "master key" — which is exactly why least-privilege thinking says: start everyone as low on this chart as their job allows, and only climb when there's a genuine need.

---

## 9. Hands-On Exercises

### Exercise 1: Set Up RBAC from Scratch

1. Start `mongod` with `--auth`.
2. Connect as the localhost exception user and create an admin user with `root` role.
3. Reconnect as the admin user.
4. Create a database `ecommerce` and add these users:
   - `apiService` with `readWrite` on `ecommerce`
   - `reportUser` with `read` on `ecommerce`
   - `schemaManager` with `dbAdmin` on `ecommerce`
5. Verify each user can only perform actions appropriate to their role.

### Exercise 2: Create and Test a Custom Role

1. Create a custom role `orderFulfillment` on `ecommerce` database with:
   - `find` on `orders` collection
   - `update` on `orders` collection (status field updates only — note: MongoDB doesn't restrict by field at role level; use $redact or schema validation)
   - `insert` on `fulfillments` collection
2. Create user `warehouseApp` assigned this role.
3. Test that `warehouseApp` cannot `insert` into `orders` or `drop` any collection.

### Exercise 3: Implement $redact for Multi-Tenant Data

1. Insert 10 documents into `reports.salesData` with a `clearance` field: values `["public"]`, `["internal"]`, `["confidential"]`.
2. Write an aggregation with `$redact` that returns only `public` and `internal` documents.
3. Extend the redact to work on nested subdocuments that also have a `clearance` array field.
4. Verify that `$$PRUNE` at the top level removes entire documents.

### Exercise 4: Configure TLS (Local Testing)

1. Generate a self-signed CA and server certificate using OpenSSL.
2. Update `mongod.conf` to set `tls.mode: requireTLS` with your certificate.
3. Restart `mongod` and verify the old non-TLS connection is rejected.
4. Connect with `mongosh --tls --tlsCAFile ca.crt` and confirm success.
5. Check `db.adminCommand({ getParameter: 1, tlsMode: 1 })` for confirmation.

### Exercise 5: Enable and Query Audit Logs (Enterprise)

1. Configure `auditLog.destination: file` with format `JSON` in `mongod.conf`.
2. Set a filter to capture: `authenticate`, `createUser`, `insert`, `remove`.
3. Perform a mix of operations: successful login, failed login, insert document, delete document.
4. Parse the audit log with `jq` to extract all failed authentication attempts.
5. Use `setAuditConfig` to add `update` to the filter at runtime without restarting.

---

## 10. Interview Q&A

**Q1: What is the difference between authentication and authorization in MongoDB?**
A: Authentication verifies identity (who you are) using mechanisms like SCRAM-SHA-256, x.509, or LDAP. Authorization determines what an authenticated user can do, controlled by RBAC — roles grant specific action+resource privilege pairs.

**Q2: What is the least-privilege principle and how does MongoDB enforce it?**
A: Least privilege means granting only the minimum permissions needed. MongoDB enforces it through fine-grained RBAC: you can create custom roles with specific collections and specific actions (e.g., `insert`-only on one collection), ensuring users cannot perform unintended operations.

**Q3: What is the difference between `dbAdmin` and `dbOwner`?**
A: `dbAdmin` covers schema and administrative tasks (createIndex, dropCollection, validate) but cannot read or write data. `dbOwner` combines `readWrite + dbAdmin + userAdmin`, giving full ownership of the database including data access and user management.

**Q4: How does `$redact` differ from field-level projection?**
A: Projection (`{ field: 0 }`) statically hides fields for all users. `$redact` dynamically evaluates conditions per document and per subdocument node, returning `$$KEEP`, `$$PRUNE`, or `$$DESCEND` based on the document's own fields (like security labels), enabling data-driven access control within a single collection.

**Q5: What are the three system variables used in $redact and when would you use each?**
A: `$$KEEP` includes the node and all its children without recursion (used for fully authorized subtrees). `$$PRUNE` excludes the node and all children (used to remove unauthorized subtrees). `$$DESCEND` includes the current level and recurses into subdocuments (used to evaluate each nested level individually).

**Q6: Explain the difference between TLS modes `requireTLS` and `preferTLS`.**
A: `preferTLS` accepts both TLS and non-TLS connections, making it a transition mode. `requireTLS` enforces that all connections must use TLS and rejects plaintext connections — the mode for production environments where encryption in transit is mandatory.

**Q7: What is the difference between `requireTLS` and mutual TLS (mTLS)?**
A: `requireTLS` requires the server to present a certificate (one-way TLS). mTLS requires both the server AND client to present and verify certificates (`allowConnectionsWithoutCertificates: false`), providing mutual identity verification.

**Q8: How does MongoDB encryption at rest work under WiredTiger (Enterprise)?**
A: MongoDB Enterprise uses AES-256-CBC page-level encryption. A master key (stored in KMIP or local keyfile) encrypts per-database keys, which encrypt the actual data pages on disk. The encryption is transparent to queries — data is decrypted on read into memory.

**Q9: What is the `root` role and when should it be used?**
A: `root` is a superuser role combining readWriteAnyDatabase, dbAdminAnyDatabase, userAdminAnyDatabase, clusterAdmin, restore, and backup. It should only be used for initial setup and emergency administration. Regular operations should use scoped roles following least privilege.

**Q10: How do you revoke a role from a user without dropping the user?**
A: Use `db.revokeRolesFromUser("username", [{ role: "roleName", db: "dbName" }])`. The user remains but loses the specified role's privileges immediately.

**Q11: What compliance frameworks does MongoDB auditing support?**
A: MongoDB Enterprise auditing supports PCI-DSS (track access to cardholder data), HIPAA (track access to PHI), SOX (track financial data changes), and GDPR (track data access and modifications). The audit log captures authentication, authorization, CRUD, DDL, and user management events.

**Q12: Can you restrict a custom role to only insert operations (no reads)?**
A: Yes. Create a role with only `insert` in the actions array for the target collection:
```js
db.createRole({ role: "insertOnly", privileges: [{ resource: { db: "logs", collection: "events" }, actions: ["insert"] }], roles: [] })
```
This prevents the user from reading, updating, or deleting documents.

**Q13: What is Client-Side Field Level Encryption (CSFLE) and how does it differ from encryption at rest?**
A: Encryption at rest protects data on disk (the server decrypts on read). CSFLE encrypts specific fields in the driver before sending to the server — the server stores and queries encrypted bytes and never sees plaintext. CSFLE protects against a compromised database server.

**Q14: How do you change the audit filter at runtime without restarting mongod?**
A: Use `db.adminCommand({ setAuditConfig: 1, filter: { ... } })` (MongoDB 5.0+ Enterprise). This updates the filter dynamically so new events are captured/excluded immediately.

**Q15: What happens to an existing connection if you change a user's roles?**
A: Role changes take effect on the next authentication. Existing authenticated connections retain the old privileges for their session lifetime. In practice, application connection pooling means the change may not fully propagate until connections are recycled or the app reconnects.
