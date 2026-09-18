# MongoDB Authentication — Complete Guide

## Table of Contents
1. [Why Authentication Matters](#1-why-authentication-matters)
2. [Enabling Authentication](#2-enabling-authentication)
3. [Creating the First Admin User](#3-creating-the-first-admin-user)
4. [SCRAM-SHA-256 — Default Mechanism](#4-scram-sha-256--default-mechanism)
5. [x.509 Certificate Authentication](#5-x509-certificate-authentication)
6. [LDAP External Authentication](#6-ldap-external-authentication)
7. [Creating Application Users](#7-creating-application-users)
8. [KeyFile for Replica Set Internal Auth](#8-keyfile-for-replica-set-internal-auth)
9. [Client-Side Field Level Encryption](#9-client-side-field-level-encryption)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Why Authentication Matters

Here's an uncomfortable fact: fire up MongoDB with default settings and it will happily accept a connection from *anyone* who can reach the port. No username, no password, no ID check at the door. They can read every document, drop every collection, and walk away — and MongoDB won't ask a single question.

```
Without Auth:                    With Auth:
mongo → connect → do anything    mongo → connect → authenticate → authorized actions only
```

Think of a database with no authentication like an office building with no receptionist and no badge reader — the front door just swings open for whoever pushes it. That's fine when it's your own laptop and nobody else is on the network. It's a disaster the moment that same server is reachable from the internet, which is exactly what happened to thousands of exposed MongoDB instances that got wiped by ransomware bots scanning for open ports.

**The basic definition:** authentication is the process of verifying *who* is connecting — a username and a proof (password, certificate, external identity) that they are who they claim to be.

It helps to keep two questions completely separate in your head:

- Authentication answers: **Who are you?**
- Authorization answers: **What are you allowed to do?** (that's the subject of the next file, `02-Authorization-RBAC.md`)

A bouncer checking ID at the door is authentication. Deciding whether your ID lets you into the VIP section is authorization. This file is entirely about the bouncer.

> **Memory hook:** No bouncer at the door means anyone off the street walks straight to the VIP room.

---

## 2. Enabling Authentication

Knowing authentication *exists* doesn't help if it's switched off. By default MongoDB starts with `authorization` disabled — so step one, always, is turning it on.

### Method 1: mongod.conf (recommended)

```yaml
# /etc/mongod.conf
security:
  authorization: enabled
```

Restart MongoDB:
```bash
sudo systemctl restart mongod
# or macOS:
brew services restart mongodb-community
```

### Method 2: Command Line Flag

```bash
mongod --auth --dbpath /var/lib/mongodb
```

### Verify Auth is On

The quickest sanity check — try to do *anything* without logging in, and MongoDB should refuse:

```bash
mongosh
# Try any command without logging in:
show dbs
# Error: MongoServerError: Command listDatabases requires authentication
```

If that error shows up, the bouncer is now at the door.

---

## 3. Creating the First Admin User

Here's the chicken-and-egg problem: you just turned on authentication, which means *nobody* can log in anymore — including you. So there's a strict ordering to get right.

**⚠️ Do this BEFORE enabling auth, or start mongod without --auth temporarily.**

```js
// Connect to mongosh without auth
use admin

db.createUser({
  user: "adminUser",
  pwd: "StrongPassword123!",   // or use passwordPrompt()
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" },
    { role: "clusterAdmin", db: "admin" }
  ]
})

// Output: { ok: 1 }
```

### Connecting as Admin

```bash
mongosh -u adminUser -p StrongPassword123! --authenticationDatabase admin
# or via connection string:
mongosh "mongodb://adminUser:StrongPassword123!@localhost:27017/admin"
```

**Common mistake:** flipping `authorization: enabled` on first, then trying to create the admin user. At that point nothing can connect, including you — you're locked out of your own database. Always create the admin user *while auth is still off* (or use the temporary no-auth restart), then lock the door behind you.

---

## 4. SCRAM-SHA-256 — Default Mechanism

So how does MongoDB actually check a password without ever seeing it travel across the network in plain text? This is where SCRAM comes in.

SCRAM = **Salted Challenge Response Authentication Mechanism**

Think of it less like handing your password to a guard, and more like a secret-handshake challenge: the server throws you a random puzzle piece (a nonce), and you prove you know the password by combining it with that puzzle piece in a way only someone who knows the real password could produce. The password itself never leaves your side of the conversation.

```
How SCRAM-SHA-256 works:
┌────────────────────────────────────────────────────────┐
│  1. Client sends username                              │
│  2. Server sends random nonce + salt                   │
│  3. Client hashes password+salt+nonce (SHA-256)        │
│  4. Client sends hash (never the plain password)       │
│  5. Server verifies hash matches stored hash           │
│  6. Mutual auth: server also proves it knows the secret│
└────────────────────────────────────────────────────────┘
```

The password is **never transmitted in plain text**. Even if someone captures the traffic, all they get is a one-time hash tied to that specific nonce — useless for a replay attack.

### Authentication Mechanisms Comparison

| Mechanism       | Security | Use Case                        |
|----------------|----------|---------------------------------|
| SCRAM-SHA-256   | High     | Default, most deployments       |
| SCRAM-SHA-1     | Medium   | Legacy compatibility only       |
| x.509           | Very High| Certificates, internal services |
| LDAP/Kerberos   | High     | Enterprise SSO                  |

### Specifying Mechanism in Connection String

```
mongodb://user:pass@host/db?authMechanism=SCRAM-SHA-256
```

**Interview answer:** "SCRAM-SHA-256 is a challenge-response authentication protocol — the client never sends the plaintext password. Instead, the server sends a random nonce and salt, the client hashes the password together with those values using SHA-256, and only that hash crosses the wire. The server independently verifies the hash matches, and also proves back to the client that it knows the secret, making it mutual authentication."

---

## 5. x.509 Certificate Authentication

Passwords aren't the only way to prove identity — sometimes it makes more sense to hand someone a signed certificate instead of a password, especially when it's not a human logging in but one internal service talking to another.

Uses TLS certificates instead of username/password. Common for internal service-to-service auth.

### Setup Overview

```bash
# 1. Generate CA and client certificate (simplified)
openssl genrsa -out ca.key 4096
openssl req -new -x509 -key ca.key -out ca.crt -days 3650 -subj "/CN=MyCA"

openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr -subj "/CN=myUser,OU=myOrg,O=myCompany,L=City,ST=State,C=AU"
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 365
```

```yaml
# mongod.conf — enable TLS + x.509
net:
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/ssl/mongodb.pem
    CAFile: /etc/ssl/ca.crt
security:
  authorization: enabled
  clusterAuthMode: x509
```

```js
// Create user matching certificate subject
use $external
db.createUser({
  user: "CN=myUser,OU=myOrg,O=myCompany,L=City,ST=State,C=AU",
  roles: [{ role: "readWrite", db: "mydb" }]
})
```

Notice the username here is the certificate's subject line, not a made-up name — MongoDB is trusting whatever your CA already vouched for.

---

## 6. LDAP External Authentication

If your company already has an Active Directory or OpenLDAP server managing everyone's corporate login, why make MongoDB maintain its own separate password list too? That's the case LDAP auth solves.

Enterprise feature — authenticate via Active Directory / OpenLDAP.

```yaml
# mongod.conf
security:
  authorization: enabled
  ldap:
    servers: "ldap.company.com"
    transportSecurity: tls
    authz:
      queryTemplate: "ou=groups,dc=company,dc=com??sub?(&(objectClass=group)(member={PROVIDED_USER}))"
```

Users authenticate with their LDAP credentials — no need to manage passwords in MongoDB.

---

## 7. Creating Application Users

Once auth is on and you have an admin account, the next question is: what should the *application itself* be allowed to do? The answer should almost always be "as little as possible."

Follow **least privilege** — give only what the app needs. Why would you hand a reporting dashboard write access it will never use? If that reporting service ever gets compromised, a read-only account limits the blast radius to "an attacker can look at data" instead of "an attacker can delete your production database."

```js
use myAppDB

// Read-only user (for reporting service)
db.createUser({
  user: "reportingService",
  pwd: passwordPrompt(),
  roles: [{ role: "read", db: "myAppDB" }]
})

// Read-write user (for application)
db.createUser({
  user: "appService",
  pwd: passwordPrompt(),
  roles: [{ role: "readWrite", db: "myAppDB" }]
})

// Admin for this DB only
db.createUser({
  user: "dbAdmin",
  pwd: passwordPrompt(),
  roles: [{ role: "dbAdmin", db: "myAppDB" }]
})
```

### Managing Users

Users aren't set in stone once created — passwords rotate, roles change, accounts get retired:

```js
// List users
db.getUsers()

// Update password
db.changeUserPassword("appService", passwordPrompt())

// Add role to existing user
db.grantRolesToUser("appService", [{ role: "dbAdmin", db: "myAppDB" }])

// Revoke role
db.revokeRolesFromUser("appService", [{ role: "dbAdmin", db: "myAppDB" }])

// Delete user
db.dropUser("reportingService")
```

---

## 8. KeyFile for Replica Set Internal Auth

Turning on auth doesn't just gate client connections — it also raises a question you might not expect: how do the *members of a replica set* trust each other? A primary and its secondaries are constantly talking to each other (replicating data, running elections). If a client can't connect without a password, why should a rogue server be able to just join the replica set and start receiving your data?

Replica set members authenticate to each other using a shared keyfile.

```bash
# Generate keyfile
openssl rand -base64 756 > /etc/mongodb/keyfile
chmod 400 /etc/mongodb/keyfile
chown mongodb:mongodb /etc/mongodb/keyfile
```

```yaml
# mongod.conf on ALL replica set members
security:
  authorization: enabled
  keyFile: /etc/mongodb/keyfile
```

All members must have the **same keyfile content** — think of it as a shared internal password that only legitimate members of the club know. This enables internal cluster auth without needing certificate infrastructure.

> **Memory hook:** the keyfile is the secret handshake between replica set members, not something a client ever needs to know.

---

## 9. Client-Side Field Level Encryption

Here's a scenario worth sitting with: what if you don't trust *anyone* — not an attacker, not even your own database administrators — to see certain fields, like a social security number? Role-based access control still means a `root` user, or whoever manages the server, can technically read the raw data. CSFLE closes that gap entirely.

CSFLE encrypts specific fields **in the client** before sending to MongoDB — even MongoDB admins can't see the plaintext.

```js
// Node.js example — encrypt SSN field
const { ClientEncryption } = require('mongodb-client-encryption')

const encryption = new ClientEncryption(unencryptedClient, {
  keyVaultNamespace: 'encryption.__keyVault',
  kmsProviders: { local: { key: localMasterKey } }
})

// Insert encrypted document
const encryptedSSN = await encryption.encrypt("123-45-6789", {
  algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
  keyId: dataKeyId
})

await collection.insertOne({ name: "John", ssn: encryptedSSN })
// Stored in MongoDB as: { name: "John", ssn: Binary(BinData(6,...)) }
```

Use cases: PII (SSN, credit cards), HIPAA data, PCI-DSS compliance.

> **Memory hook:** encryption at the client is like sealing a letter before it leaves your house — even the postal worker carrying it can't read what's inside.

---

## 10. Hands-On Exercises

**Exercise 1:** Start a local MongoDB without auth. Create an admin user, then restart with `--auth`. Verify you can't connect without credentials.

**Exercise 2:** Create three users on `testDB`: one read-only, one readWrite, one dbAdmin. Test each user's permissions.

**Exercise 3:** Change a user's password and verify the old password no longer works.

**Exercise 4:** Revoke the `readWrite` role from a user and verify they can no longer insert documents.

**Exercise 5:** Using mongosh, list all users on the `admin` database with `db.getUsers()` and understand each field.

---

## 11. Interview Q&A

**Q: Why does MongoDB not enable authentication by default?**
Answer: MongoDB is designed for developer convenience in local development. The assumption is the developer is the only one with access. In production, auth must always be enabled — MongoDB Atlas enforces auth by default.

**Q: What is SCRAM-SHA-256 and why is it secure?**
Answer: SCRAM is a challenge-response protocol where the password is never transmitted. The client proves knowledge of the password by computing a hash using a server-sent nonce and salt. SHA-256 makes brute-force attacks computationally expensive.

**Q: What is the difference between authentication and authorization?**
Answer: Authentication verifies identity (who you are — username/password). Authorization determines permissions (what you can do — RBAC roles). MongoDB handles both — auth first, then RBAC checks every operation.

**Q: What happens if you enable auth without creating an admin user first?**
Answer: You get locked out — nobody can connect to manage the database. You'd need to restart without `--auth`, create the admin user, then re-enable auth.

**Q: When would you use x.509 instead of SCRAM?**
Answer: x.509 is preferred for microservice-to-database connections in enterprise environments with existing PKI infrastructure. Certificates can be issued and revoked centrally, and there's no password management. SCRAM is simpler for most applications.

**Q: What is a keyFile and when is it required?**
Answer: A keyFile is a shared secret used for internal authentication between replica set members or shards. It's required when you enable auth on a replica set — without it, members can't authenticate to each other and the set won't function.

**Q: What is Client-Side Field Level Encryption and what problem does it solve?**
Answer: CSFLE encrypts sensitive fields in the application driver before data is sent to MongoDB. Even if someone gains admin access to MongoDB or the server, they cannot read the plaintext values. It solves the insider threat and database-level breach scenarios.

**Q: How do you rotate passwords for application users without downtime?**
Answer: Use `db.changeUserPassword()` and update the connection string in the application. For zero-downtime rotation: create a new user, update app config, then drop the old user once all connections have cycled.

**Q: What is the `$external` database used for?**
Answer: The `$external` database is where you create users who authenticate via external mechanisms (x.509 certificates, LDAP/Kerberos). These users don't have a MongoDB-stored password — their identity is verified externally.

**Q: How do you audit login attempts in MongoDB?**
Answer: MongoDB Enterprise provides an audit log feature. Configure `security.auditLog.destination` in mongod.conf to log authentication events, including failed attempts. Atlas provides built-in activity logs accessible from the UI.
