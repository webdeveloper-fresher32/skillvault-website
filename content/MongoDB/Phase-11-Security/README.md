# Phase 11: Security — Authentication & Authorization in MongoDB

## Overview

A MongoDB instance with no security configuration is an open door. Real-world deployments require you to control WHO can connect (authentication) and WHAT they can do once connected (authorization). This phase covers everything from enabling basic username/password auth to enterprise features like x.509 certificates, LDAP integration, and client-side field level encryption. Security is not optional in production — this phase prepares you for both day-to-day operations and security-focused interview questions.

---

## Table of Contents

1. [Objectives](#objectives)
2. [Topics Covered](#topics-covered)
3. [File Index](#file-index)
4. [Estimated Timeline](#estimated-timeline)
5. [Prerequisites](#prerequisites)
6. [Security Architecture Diagram](#security-architecture-diagram)
7. [Key Concepts at a Glance](#key-concepts-at-a-glance)
8. [Defense in Depth: MongoDB Security Layers](#defense-in-depth)
9. [Quick Reference Commands](#quick-reference-commands)

---

## Objectives

By the end of Phase 11, you will be able to:

- **Enable authentication** on a standalone mongod and replica set
- **Create the first admin user** before enabling auth (the bootstrapping process)
- **Explain SCRAM-SHA-256** mechanism and why it replaced MONGODB-CR
- **Set up x.509 certificate authentication** for both client and internal (inter-member) auth
- **Configure LDAP external authentication** for enterprise deployments
- **Apply the principle of least privilege** when creating application users
- **Understand built-in MongoDB roles** (read, readWrite, dbAdmin, userAdmin, clusterAdmin, etc.)
- **Create custom roles** with fine-grained privilege control
- **Configure keyFile authentication** for replica set internal security
- **Understand mongocryptd and Client-Side Field Level Encryption (CSFLE)**
- **Enable TLS/SSL** for in-transit encryption
- **Audit** database operations using the MongoDB audit log feature

---

## Topics Covered

### Module 1 — Authentication ([01-Authentication.md](./01-Authentication.md))

```
┌───────────────────────────────────────────────────────────┐
│               AUTHENTICATION TOPICS                        │
├───────────────────────────────────────────────────────────┤
│  Enabling Auth        │  security.authorization in conf   │
│  Bootstrap Admin      │  First user before auth is on     │
│  SCRAM-SHA-256        │  Default mechanism, how it works  │
│  x.509 Certificates   │  Client + internal auth           │
│  LDAP External Auth   │  Enterprise, AD integration       │
│  Application Users    │  Least privilege principle        │
│  keyFile Auth         │  Replica set internal auth        │
│  CSFLE                │  mongocryptd, field encryption    │
│  TLS/SSL              │  In-transit encryption            │
└───────────────────────────────────────────────────────────┘
```

### Module 2 — Authorization & RBAC ([02-Authorization-RBAC.md](./02-Authorization-RBAC.md))

```
┌───────────────────────────────────────────────────────────┐
│              AUTHORIZATION & RBAC TOPICS                   │
├───────────────────────────────────────────────────────────┤
│  Role-Based Access    │  Roles, privileges, resources      │
│  Built-in Roles       │  All database roles explained      │
│  Custom Roles         │  createRole() with specific actions│
│  Role Inheritance     │  Roles that inherit from roles     │
│  Admin Database       │  Global vs database-scoped roles   │
│  db.getUsers()        │  Inspecting user permissions       │
│  Revoking Access      │  revokeRolesFromUser()             │
│  Resource Types       │  Collection, database, cluster     │
│  Action Types         │  find, insert, update, drop, etc.  │
│  Audit Logging        │  Enterprise audit configuration    │
└───────────────────────────────────────────────────────────┘
```

---

## File Index

| File | Description | Approx Lines |
|------|-------------|--------------|
| [01-Authentication.md](./01-Authentication.md) | Auth mechanisms, SCRAM, x.509, keyFile, CSFLE | 500+ |
| [02-Authorization-RBAC.md](./02-Authorization-RBAC.md) | Role-based access control, custom roles, privileges | 500+ |

---

## Estimated Timeline

```
┌────────────────────────────────────────────────────────────┐
│                   PHASE 11 SCHEDULE                        │
│                        1 WEEK                              │
├──────────────┬─────────────────────────────────────────────┤
│  Days 1-3    │  01-Authentication.md                       │
│              │  - Enable auth on local MongoDB             │
│              │  - Create admin and application users       │
│              │  - Test SCRAM-SHA-256 login                 │
│              │  - Set up keyFile for replica set           │
├──────────────┼─────────────────────────────────────────────┤
│  Days 4-5    │  02-Authorization-RBAC.md                   │
│              │  - Explore built-in roles                   │
│              │  - Create a custom role with minimal privs  │
│              │  - Audit user permissions with db.getUsers()│
├──────────────┼─────────────────────────────────────────────┤
│  Days 6-7    │  Consolidation + Interview Prep             │
│              │  - Review all Q&A sections                  │
│              │  - Simulate a least-privilege user scenario │
│              │  - Practice explaining SCRAM flow verbally  │
└──────────────┴─────────────────────────────────────────────┘
```

---

## Prerequisites

Before starting Phase 11, you should be comfortable with:

- **Phase 9** — Replication: replica sets, because keyFile auth is a replication concept
- Basic Linux/macOS file permissions (for keyFile setup)
- General understanding of TLS certificates (helpful but not required for most of the phase)
- MongoDB shell: db.createUser(), db.grantRolesToUser(), mongod.conf syntax

---

## Security Architecture Diagram

```
                    MONGODB SECURITY LAYERS
                    =======================

  NETWORK LAYER
  ─────────────────────────────────────────────────────────
  [ Firewall ]  ── only allow trusted IPs to reach :27017
  [ VPC/VNet ]  ── private network, no public exposure
  [ TLS/SSL  ]  ── encrypt all data in transit

  AUTHENTICATION LAYER (Who are you?)
  ─────────────────────────────────────────────────────────
  ┌──────────────────────────────────────────────────────┐
  │  SCRAM-SHA-256  │  Username + password (default)     │
  │  x.509          │  TLS certificate as identity       │
  │  LDAP           │  Active Directory / LDAP server    │
  │  keyFile        │  Shared secret for RS members      │
  └──────────────────────────────────────────────────────┘

  AUTHORIZATION LAYER (What can you do?)
  ─────────────────────────────────────────────────────────
  ┌──────────────────────────────────────────────────────┐
  │  Roles         │  Collections of privileges          │
  │  Privileges    │  (action, resource) pairs           │
  │  Resources     │  database, collection, cluster      │
  │  Actions       │  find, insert, update, drop, ...    │
  └──────────────────────────────────────────────────────┘

  DATA LAYER (Protect data at rest and in transit)
  ─────────────────────────────────────────────────────────
  ┌──────────────────────────────────────────────────────┐
  │  Encryption at Rest  │  WiredTiger encryption (Ent.) │
  │  CSFLE               │  Field-level client encryption│
  │  Queryable Encryption│  MongoDB 6.0+ (Ent.)          │
  └──────────────────────────────────────────────────────┘

  AUDIT LAYER (What happened?)
  ─────────────────────────────────────────────────────────
  [ MongoDB Audit Log ]  ── records auth, DDL, DML events
```

---

## Key Concepts at a Glance

### Authentication vs Authorization

```
┌────────────────────────────────────────────────────────────┐
│  AUTHENTICATION:  "Who are you?"                           │
│  ─────────────────────────────────────────────────────     │
│  Verifying identity. Can this user prove they are          │
│  who they claim to be?                                     │
│  Tools: SCRAM password, x.509 cert, LDAP bind             │
│                                                            │
│  AUTHORIZATION:   "What are you allowed to do?"           │
│  ─────────────────────────────────────────────────────     │
│  Controlling access. Even if you ARE authenticated,        │
│  you can only perform actions your roles permit.           │
│  Tools: Roles, privileges, resource + action pairs        │
└────────────────────────────────────────────────────────────┘
```

### The Least Privilege Principle

```
Application user should have ONLY what it needs:

  Analytics service (read only):
    roles: [{ role: "read", db: "production" }]

  App backend (read + write, specific collections):
    Custom role: {
      actions: ["find", "insert", "update"],
      resource: { db: "myapp", collection: "orders" }
    }

  DBA (manage users, databases):
    roles: [{ role: "userAdminAnyDatabase", db: "admin" },
            { role: "dbAdminAnyDatabase", db: "admin" }]

  Never do this in production:
    roles: [{ role: "root", db: "admin" }]  ← unless absolutely necessary
```

### Built-in Role Hierarchy

```
  Cluster-level:
    clusterAdmin > clusterManager > clusterMonitor > hostManager

  All-databases:
    root (superuser)
    ├── readAnyDatabase
    ├── readWriteAnyDatabase
    ├── dbAdminAnyDatabase
    └── userAdminAnyDatabase

  Single-database:
    dbOwner (= readWrite + dbAdmin + userAdmin)
    ├── readWrite
    │   └── read
    ├── dbAdmin
    └── userAdmin
```

---

## Defense in Depth

```
Layer 1 — Network
  - Use a VPC/private network; never expose port 27017 to the internet
  - Use mongod.conf: net.bindIp to restrict which IPs mongod listens on
  - Use a firewall to whitelist application server IPs only

Layer 2 — Transport Encryption (TLS)
  - Enable TLS with net.tls.mode: requireTLS in mongod.conf
  - Use trusted certificates (Let's Encrypt or internal CA)
  - Reject connections that don't present a valid cert (optional)

Layer 3 — Authentication
  - Always enable security.authorization: enabled
  - Create a strong admin password before enabling auth
  - Use SCRAM-SHA-256 (default in MongoDB 4.0+)
  - Use x.509 for automated services / microservices

Layer 4 — Authorization
  - Create per-application users with minimum required roles
  - Never use the root role for application connections
  - Regularly audit user roles with db.getUsers()
  - Remove unused users promptly

Layer 5 — Encryption at Rest (Enterprise)
  - Enable WiredTiger encryption at rest
  - Use an external Key Management System (KMS)
  - Or use CSFLE for application-level field encryption

Layer 6 — Auditing
  - Enable MongoDB audit log for compliance
  - Audit at minimum: authCheck, createUser, dropUser, createCollection, dropDatabase
  - Ship audit logs to a SIEM (Splunk, Elastic, etc.)
```

---

## Quick Reference Commands

```js
// Create the first admin user (BEFORE enabling auth)
use admin
db.createUser({
  user: "adminUser",
  pwd: "strongPassword123!",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }]
})

// Create an application user with limited access
use myapp
db.createUser({
  user: "appService",
  pwd: "anotherStrongPassword!",
  roles: [{ role: "readWrite", db: "myapp" }]
})

// List all users in a database
db.getUsers()

// Grant additional roles
db.grantRolesToUser("appService", [{ role: "read", db: "analytics" }])

// Revoke a role
db.revokeRolesFromUser("appService", [{ role: "read", db: "analytics" }])

// Drop a user
db.dropUser("appService")

// Connect with auth from shell
mongosh "mongodb://adminUser:strongPassword123!@localhost:27017/admin"

// Check current user
db.runCommand({ connectionStatus: 1 })
```

```bash
# mongod.conf: enable authentication
# security:
#   authorization: enabled

# Restart mongod after config change
sudo systemctl restart mongod

# Connect with auth from CLI
mongosh --username adminUser --password --authenticationDatabase admin
```

---

*Phase 11 of the MongoDB & SQL Mastery Series — Security*
