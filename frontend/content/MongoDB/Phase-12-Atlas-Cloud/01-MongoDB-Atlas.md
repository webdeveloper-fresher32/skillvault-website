# MongoDB Atlas — Cloud Database Service

## Table of Contents

1. [Atlas DBaaS Overview](#1-atlas-dbaas-overview)
2. [Cluster Tier Table](#2-cluster-tier-table)
3. [Creating a Cluster Step-by-Step](#3-creating-a-cluster-step-by-step)
4. [Network Access](#4-network-access)
5. [Database Users and Authentication](#5-database-users-and-authentication)
6. [Atlas CLI](#6-atlas-cli)
7. [Data Explorer](#7-data-explorer)
8. [Atlas Data Federation](#8-atlas-data-federation)
9. [Architecture Diagram](#9-architecture-diagram)
10. [Hands-On Exercises](#10-hands-on-exercises)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Atlas DBaaS Overview

**The problem this solves:** run MongoDB yourself for a while and you'll eventually be the one on call at 3am because a disk filled up, a replica set lost its primary, or a security patch needed rolling out *right now*. Someone has to provision servers, apply OS patches, upgrade MongoDB versions, configure replication, watch disk usage, and take backups — and if that someone is you, it's time you're not spending on your actual application.

MongoDB Atlas exists so that "someone" doesn't have to be you.

**The analogy:** self-hosting MongoDB is like buying a house — you own everything, which means you're also responsible for the plumbing, the roof, and the electrics. Atlas is more like renting a fully-serviced apartment: you still decide how to arrange the furniture (your schema, your indexes, your queries), but the building manager (Atlas) handles the boiler, the security guard, and the fire alarm.

**Basic definition:** MongoDB Atlas is a **fully managed Database-as-a-Service (DBaaS)** that runs on AWS, Google Cloud, and Azure. Instead of you managing `mongod` processes, replica sets, storage, backups, and upgrades by hand, Atlas takes care of all of that infrastructure for you.

---

### 1.1 What Atlas Manages for You

Here's the actual division of labor — worth staring at for a second, because it's the whole value proposition of Atlas in one table:

```
┌────────────────────────────────────────────────────────────┐
│              What You Own vs. What Atlas Owns              │
│                                                            │
│  YOU OWN                    ATLAS OWNS                     │
│  ─────────────              ────────────────────────────   │
│  Schema design              Server provisioning            │
│  Application code           OS patching & upgrades         │
│  Indexes                    MongoDB version upgrades       │
│  Query optimization         Replica set management         │
│  Data modeling              Automated failover             │
│  Access control             Backup & restore               │
│  Cost monitoring            Monitoring & alerting          │
│                             Storage scaling                │
│                             TLS certificates               │
└────────────────────────────────────────────────────────────┘
```

Notice everything on the left is the interesting part of your job — the part that actually differentiates your product. Everything on the right is undifferentiated plumbing that every MongoDB user needs, and that Atlas has already solved once for everyone.

---

### 1.2 Atlas Hierarchy

Before you touch anything in the UI, it helps to know how Atlas organizes things — three nested levels:

```
Atlas Organization
└── Project (e.g., "Production", "Staging")
    ├── Cluster (replica set or sharded)
    │   ├── Database
    │   │   └── Collections
    ├── Network Access Rules
    ├── Database Users
    └── Integrations (Datadog, PagerDuty, Slack...)
```

- **Organization**: Top-level billing entity. Has members and billing settings.
- **Project**: Logical grouping of clusters sharing network access and users.
- **Cluster**: The actual MongoDB deployment (replica set by default).

Why does this matter in practice? Because network access rules and database users live at the *Project* level — so "Production" and "Staging" projects can have completely separate IP allowlists and credentials, even though they belong to the same organization and the same bill.

---

### 1.3 Cloud Providers and Regions

Atlas supports **AWS**, **GCP**, and **Azure** across 100+ regions. You choose the cloud provider and region when creating a cluster. Multi-cloud clusters can span all three providers simultaneously.

```
AWS Regions:      us-east-1, us-west-2, eu-west-1, ap-southeast-1, ...
GCP Regions:      us-central1, europe-west1, asia-east1, ...
Azure Regions:    eastus, westeurope, southeastasia, ...
```

A quick rule of thumb: pick the region closest to where most of your *application servers* run, not where most of your users live — every millisecond your app spends talking to the database adds up, and your app is usually the thing making the most round trips.

---

### 1.4 Self-hosted vs. Atlas — the tradeoff, stated plainly

| | Self-hosted MongoDB | MongoDB Atlas |
|---|---|---|
| Who patches the OS / MongoDB version | You | Atlas |
| Who handles failover | You (or your ops tooling) | Atlas, automatically |
| Backups | You configure and test them | Built in, PITR available |
| Cost | Cheaper at very large, steady scale, but you pay in engineering time | Pay-for-convenience, scales with tier |
| Control | Full control over every knob | Most knobs still exposed, but some infra decisions are Atlas's |
| Time to first cluster | Hours to days | Minutes |

**Common mistake:** assuming Atlas is only for "getting started" and self-hosting is the "real production" option. In practice most production MongoDB deployments — including MongoDB's own — run on Atlas. The tradeoff isn't beginner-vs-expert, it's engineering-time-vs-cash.

**Interview answer:** "Atlas is a fully managed Database-as-a-Service — MongoDB handles provisioning, patching, upgrades, backups, monitoring, and failover, while you focus on schema design, indexes, and application logic. Self-hosted MongoDB gives you full control over every infrastructure decision but requires your own operations expertise to run reliably at production quality. Atlas essentially trades some operational control for a large reduction in day-to-day operational burden."

> **Memory hook:** "Self-hosting is owning a house. Atlas is renting a serviced apartment — you still choose the furniture, but you're not the one fixing the boiler at 3am."

---

## 2. Cluster Tier Table

**The problem:** MongoDB needs to run *somewhere*, with *some* amount of CPU, RAM, and storage — but "how much" is different for a side project than for a production app with real traffic. Atlas solves this by letting you pick a tier, the same way a cloud VM provider lets you pick an instance size.

Atlas offers three deployment types:

| Deployment Type | Description | Use Case |
|----------------|-------------|----------|
| **Shared (M0/M2/M5)** | Multi-tenant, shared infrastructure | Dev, learning, hobby projects |
| **Dedicated (M10+)** | Dedicated instances, full feature set | Production workloads |
| **Serverless** | Pay-per-operation, auto-scales to zero | Sporadic/unpredictable workloads |

### 2.1 Detailed Tier Table

| Tier | RAM | Storage | vCPUs | Price (AWS us-east-1) | Notes |
|------|-----|---------|-------|----------------------|-------|
| **M0** | Shared | 512 MB | Shared | **Free** | No backups, shared IOPS, no VPC peering |
| **M2** | Shared | 2 GB | Shared | ~$9/mo | Low-volume dev |
| **M5** | Shared | 5 GB | Shared | ~$25/mo | Slightly more storage |
| **M10** | 2 GB | 10 GB NVMe | 2 | ~$0.08/hr (~$57/mo) | Smallest dedicated, backups available |
| **M20** | 4 GB | 20 GB NVMe | 2 | ~$0.20/hr (~$144/mo) | Small production |
| **M30** | 8 GB | 40 GB NVMe | 2 | ~$0.54/hr (~$389/mo) | Medium workloads |
| **M40** | 16 GB | 80 GB NVMe | 4 | ~$1.04/hr (~$749/mo) | Growing production |
| **M50** | 32 GB | 160 GB NVMe | 8 | ~$2.00/hr (~$1,440/mo) | High-throughput |
| **M60** | 64 GB | 320 GB NVMe | 16 | ~$3.95/hr | Heavy analytics |
| **M80** | 128 GB | 750 GB NVMe | 32 | ~$7.30/hr | Very large datasets |
| **M140** | 192 GB | 1 TB NVMe | 48 | ~$10.99/hr | Enterprise scale |
| **M200** | 256 GB | 3 TB NVMe | 64 | ~$14.59/hr | Massive workloads |
| **M300** | 384 GB | 4 TB NVMe | 96 | ~$21.85/hr | Extreme scale |

> Prices are approximate (2024). Actual pricing varies by cloud provider, region,
> and storage configuration. Storage can be scaled independently.

**Common mistake:** picking a tier based on "how big is my data" instead of "how much traffic hits my cluster." A 5 GB dataset with heavy concurrent reads can need an M30, while a 50 GB dataset that's rarely queried might be fine on an M10. RAM matters more than storage for most workloads, because MongoDB performs best when your working set fits in memory.

### 2.2 Tier Selection Guide

If you're not sure where to start, walk this decision tree:

```
┌───────────────────────────────────────────────────────────┐
│                  Tier Selection Decision Tree              │
│                                                            │
│  Is this for learning/development?                         │
│  └── YES ──► M0 (free) or M2/M5 (shared)                 │
│  └── NO  ──► Continue...                                  │
│                                                            │
│  Expected daily active users < 1,000?                      │
│  └── YES ──► M10 or M20                                   │
│  └── NO  ──► Continue...                                  │
│                                                            │
│  Dataset < 20 GB, moderate traffic?                        │
│  └── YES ──► M30                                          │
│  └── NO  ──► Continue...                                  │
│                                                            │
│  Dataset 20–100 GB, high throughput?                       │
│  └── YES ──► M40 or M50                                   │
│  └── NO  ──► M60, M80, M140, M200                         │
└───────────────────────────────────────────────────────────┘
```

None of this is a one-time decision, either — you can move a running cluster up or down tiers with a couple of clicks (Atlas handles the rolling upgrade for you), so it's fine to start small and grow into it.

---

## 3. Creating a Cluster Step-by-Step

This part is mercifully simple — a wizard, not a design decision.

### 3.1 Via the Atlas UI

**Step 1: Create or log in to an organization**

```
https://cloud.mongodb.com
→ Sign up / Log in
→ "Create an Organization" → enter name → Next
```

**Step 2: Create a Project**

```
Organization Dashboard
→ "New Project"
→ Enter project name (e.g., "MyApp-Production")
→ Add project members (optional)
→ "Create Project"
```

**Step 3: Build a Cluster**

```
Project Dashboard
→ "Build a Database"
→ Choose deployment type:
    ○ Serverless
    ○ Dedicated   ← for M10+
    ○ Shared      ← for M0/M2/M5 (Free Tier)
→ Select cloud provider: AWS / GCP / Azure
→ Select region: e.g., "N. Virginia (us-east-1)"
→ Select tier: M0 (free) or paid tier
→ Additional settings:
    - Cluster Name (e.g., "Cluster0")
    - MongoDB Version (7.0 recommended)
    - Backup: enable for M10+
    - Additional storage (optional)
→ "Create Cluster" (takes 1–3 minutes to provision)
```

**Step 4: Configure Security (prompted automatically)**

```
→ Create a database user (see Section 5)
→ Add your IP to the allowlist (see Section 4)
→ Choose connection method:
    - Drivers (Node.js, Python, Java, Go...)
    - mongosh
    - MongoDB Compass
→ Copy the connection string
```

Notice Atlas *forces* you through security setup before you can connect — you can't accidentally launch a cluster with no auth and no network rules. That's deliberate.

### 3.2 Cluster Configuration Options

```
┌──────────────────────────────────────────────────────────┐
│                 Cluster Configuration                    │
│                                                          │
│  ├── Cluster Tier        (M0 through M300)               │
│  ├── Cloud Provider      (AWS / GCP / Azure)             │
│  ├── Region              (data residency)                │
│  ├── MongoDB Version     (6.0 / 7.0 / 8.0)              │
│  ├── Backup              (Continuous / Scheduled)        │
│  ├── Encryption at Rest  (Atlas-managed or BYOK)         │
│  ├── Auto-scaling        (compute + storage auto-scale)  │
│  └── Termination Protection                              │
└──────────────────────────────────────────────────────────┘
```

### 3.3 Auto-Scaling

M10+ clusters support auto-scaling:

- **Compute auto-scale**: Cluster scales up/down between tiers automatically.
- **Storage auto-scale**: Storage increases when 90% utilized, never decreases.

```
Enable in: Cluster config → Additional Settings → Auto-scale Cluster Tier
```

Why would you want this instead of just picking a big tier upfront and forgetting about it? Because traffic isn't flat — a marketing campaign or a seasonal spike can 10x your load for a week, and you don't want to be paying for M50 capacity year-round just to survive one busy Tuesday.

### 3.4 Connection String Formats

```bash
# Standard connection string (DNS seedlist format)
mongodb+srv://username:password@cluster0.abc123.mongodb.net/myDatabase

# With options
mongodb+srv://username:password@cluster0.abc123.mongodb.net/myDatabase?retryWrites=true&w=majority

# Direct connection (for specific node — not recommended for Atlas)
mongodb://username:password@host:27017/database
```

```js
// Node.js driver
const { MongoClient } = require("mongodb");
const uri = "mongodb+srv://appUser:pass@cluster0.abc123.mongodb.net/orders?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db("orders");
  const result = await db.collection("transactions").findOne({});
  console.log(result);
  await client.close();
}
run().catch(console.error);
```

The `+srv` in the connection string is doing more work than it looks — it's a DNS trick that lets Atlas hand your driver the *current* list of replica set members without you ever hardcoding hostnames, so failovers and topology changes stay invisible to your app.

---

## 4. Network Access

**The problem this solves:** a database sitting on the open internet with just a username and password is one leaked credential away from disaster. Atlas's answer is blunt: by default, *nothing* can reach your cluster, not even you, until you explicitly say who's allowed in.

**The analogy:** think of your cluster like a building with a guest list at the door. IP Allowlisting is like giving security a list of approved addresses. VPC Peering is like building a private tunnel between your office and the building so nobody has to walk past the street at all. PrivateLink is the most extreme version — a dedicated elevator straight from your floor to theirs that never touches a public hallway.

### 4.1 IP Access List

The simplest method: whitelist specific IP addresses or CIDR ranges.

```
Atlas Dashboard → Security → Network Access → "Add IP Address"

Options:
  ○ Add Current IP Address      ← for development
  ○ Allow Access From Anywhere  ← 0.0.0.0/0 (NOT for production)
  ○ Custom IP/CIDR              ← e.g., "10.0.1.0/24"
```

```bash
# Atlas CLI
atlas accessLists create 203.0.113.45/32 --comment "Office IP"
atlas accessLists create 10.0.0.0/8 --comment "VPC CIDR"

# List current allowlist
atlas accessLists list
```

**Common mistake:** clicking "Allow Access From Anywhere" (`0.0.0.0/0`) to get unblocked during development, then forgetting to remove it before shipping to production. This is one of the most common real-world MongoDB security incidents — a database that's technically password-protected but reachable by literally any IP on the internet, which means it's only as safe as your weakest password. If you ever see `0.0.0.0/0` on a production project, treat it as an incident, not a config detail.

### 4.2 VPC Peering

Connect an Atlas cluster directly to your AWS VPC, GCP VPC, or Azure VNet
without traffic going over the public internet.

```
Your VPC (10.0.0.0/16)          Atlas VPC (192.168.240.0/21)
┌──────────────────┐             ┌──────────────────────┐
│  App Servers     │◄───Peer────►│  Atlas Cluster       │
│  10.0.1.0/24    │  (private)  │  192.168.240.x       │
└──────────────────┘             └──────────────────────┘
       No public internet traversal
```

**Setup:**

```
Atlas → Network Access → Peering → "Add Peering Connection"
→ Select cloud provider (AWS/GCP/Azure)
→ Enter VPC details: Account ID, VPC ID, CIDR, Region
→ Atlas generates a peering request
→ Accept the peering request in your cloud console
→ Update VPC route tables to include Atlas CIDR
```

### 4.3 AWS PrivateLink

Even more secure than VPC peering: creates a private endpoint in your VPC
that points to the Atlas cluster via AWS PrivateLink (traffic never leaves AWS).

```
Your VPC                              Atlas
┌────────────────────┐                ┌──────────────────┐
│  App Server        │                │  Atlas Cluster   │
│  ├── ENI           │                │                  │
│  │   (Private IP)  │◄──PrivateLink──│  NLB Endpoint    │
└────────────────────┘                └──────────────────┘
  Traffic stays entirely within AWS network fabric
```

**Setup (Atlas side):**

```
Network Access → Private Endpoint → "Add Private Endpoint"
→ Select: AWS
→ Select region
→ Atlas provides a VPC Endpoint Service name
→ In AWS Console: create VPC Endpoint using that service name
→ Back in Atlas: confirm the endpoint ID
```

### 4.4 Network Access Comparison

| Method | Security Level | Setup Complexity | Cost | Cross-Region |
|--------|---------------|-----------------|------|-------------|
| IP Allowlist | Medium | Low | Free | Yes |
| VPC Peering | High | Medium | Free | Limited |
| PrivateLink | Very High | High | Per-endpoint | No |

**Interview answer:** "Atlas clusters are unreachable by default — you must explicitly grant access. IP Allowlisting is the simplest option, whitelisting specific IPs or CIDR blocks, but `0.0.0.0/0` should never be used in production since it opens the cluster to the entire internet. VPC Peering privately connects your own VPC to Atlas's VPC without traversing the public internet. AWS PrivateLink goes further, exposing the cluster as a private endpoint inside your VPC so traffic never leaves the AWS network fabric at all — the tradeoff being it's the most complex to set up and doesn't work across regions."

> **Memory hook:** "IP allowlist is a guest list at the door. VPC peering is a private tunnel between two buildings. PrivateLink is a dedicated elevator that never touches a public hallway."

---

## 5. Database Users and Authentication

Database users are separate from Atlas UI users — worth repeating, because it trips people up. They authenticate to the *MongoDB database itself*, not to the Atlas website. You could have zero Atlas UI logins and still have a dozen application users connecting with driver credentials.

### 5.1 Password Authentication (SCRAM)

The default, and the one you'll use most often — a username and password, same as any database you've used before.

```
Atlas → Database Access → "Add New Database User"
→ Authentication Method: Password
→ Username: appUser
→ Password: auto-generate or enter
→ Database User Privileges:
    ○ Atlas Admin (full access)
    ○ Read and write to any database
    ○ Only read any database
    ○ Built-in Role: readWrite @ orders
    ○ Custom Role
→ "Add User"
```

```bash
# Atlas CLI
atlas dbusers create --username appUser \
  --password "S3cur3P@ss" \
  --role readWriteAnyDatabase
```

### 5.2 x.509 Certificate Authentication

No passwords — the client presents a certificate signed by a CA that Atlas
recognizes. Useful when you want to eliminate password rotation entirely and rely on certificate lifecycles instead.

```
Atlas → Database Access → "Add New Database User"
→ Authentication Method: Certificate
→ Enter the Common Name (CN) from your certificate
→ Assign roles

# Generate certificate:
openssl req -new -x509 -days 365 -key client.key -out client.crt \
  -subj "/CN=appUser"
```

```bash
# Connect with x.509
mongosh "mongodb+srv://cluster0.abc.mongodb.net/db" \
  --tls \
  --tlsCertificateKeyFile client.pem \
  --authenticationMechanism MONGODB-X509
```

### 5.3 AWS IAM Authentication

Atlas can authenticate using AWS IAM roles or users — no passwords required,
credentials rotate automatically via AWS STS. If your app already runs on AWS with an IAM role attached, this means one less secret to store anywhere.

```
Atlas → Database Access → "Add New Database User"
→ Authentication Method: AWS IAM
→ IAM Principal ARN: arn:aws:iam::123456789:role/MyAppRole
→ Assign roles
```

```js
// Node.js with AWS IAM auth
const { MongoClient } = require("mongodb");
const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");

const credentials = await fromNodeProviderChain()();
const client = new MongoClient(uri, {
  authMechanism: "MONGODB-AWS",
  authMechanismProperties: {
    AWS_SESSION_TOKEN: credentials.sessionToken
  }
});
```

### 5.4 LDAP / Federated Authentication

For enterprise SSO: Atlas integrates with Okta, Azure AD, and LDAP directories — so employees log in with the same corporate identity they use everywhere else, and access is revoked centrally the moment they leave the company.

```
Organization Settings → Security → Federated Authentication
→ Configure Identity Provider (Okta / Azure AD / others)
→ Map IdP groups to Atlas roles
```

---

## 6. Atlas CLI

Clicking through the UI is fine for a one-off cluster, but it doesn't scale to "spin up a fresh staging environment every time we open a PR." That's what the Atlas CLI (`atlas`) is for — every action you'd take in the UI, scriptable from a terminal or a CI pipeline.

### 6.1 Installation and Setup

```bash
# macOS
brew install mongodb-atlas-cli

# Linux
curl -fsSL https://www.mongodb.com/try/download/atlascli | sh

# Windows (Chocolatey)
choco install mongodb-atlas

# Authenticate
atlas auth login
# Opens browser for OAuth login

# Set default project
atlas config set project_id <projectId>

# Verify setup
atlas config list
```

### 6.2 Cluster Commands

```bash
# Create a new cluster (M10 on AWS us-east-1)
atlas clusters create MyCluster \
  --provider AWS \
  --region US_EAST_1 \
  --tier M10 \
  --mdbVersion 7.0

# List all clusters in project
atlas clusters list

# Describe a cluster
atlas clusters describe MyCluster

# Get connection string
atlas clusters connectionStrings describe MyCluster

# Pause a cluster (stops billing for compute, not storage)
atlas clusters pause MyCluster

# Resume a paused cluster
atlas clusters start MyCluster

# Delete a cluster
atlas clusters delete MyCluster --force
```

### 6.3 Database User Commands

```bash
# Create user with readWrite role
atlas dbusers create \
  --username appUser \
  --password "MyPass123!" \
  --role readWriteAnyDatabase

# List all database users
atlas dbusers list

# Update user roles
atlas dbusers update appUser \
  --role readAnyDatabase

# Delete a user
atlas dbusers delete appUser
```

### 6.4 Network Access Commands

```bash
# Add IP to allowlist
atlas accessLists create 1.2.3.4/32 --comment "My office"

# Add current machine's IP
atlas accessLists create --currentIp

# List allowlist entries
atlas accessLists list

# Delete an entry
atlas accessLists delete 1.2.3.4/32
```

### 6.5 Monitoring and Metrics

```bash
# View cluster metrics
atlas metrics clusters MyCluster --granularity PT1M --period PT1H

# View process metrics (specific node)
atlas metrics processes <hostAndPort> --granularity PT1M --period PT1H

# View slow query logs
atlas logs download MyCluster mongod --out mongod.gz --start <timestamp> --end <timestamp>

# List alerts
atlas alerts list
```

### 6.6 Atlas CLI in CI/CD

This is really the whole point of the CLI existing — a script like this can create an ephemeral database for every feature branch, then tear it down when the PR closes:

```bash
#!/bin/bash
# deploy-cluster.sh — create Atlas cluster in CI/CD pipeline

export MONGODB_ATLAS_PUBLIC_KEY="$ATLAS_PUB_KEY"
export MONGODB_ATLAS_PRIVATE_KEY="$ATLAS_PRIV_KEY"
export MONGODB_ATLAS_PROJECT_ID="$ATLAS_PROJECT_ID"

atlas clusters create staging-cluster \
  --provider AWS \
  --region US_EAST_1 \
  --tier M10 \
  --mdbVersion 7.0

# Wait for cluster to be ready
atlas clusters watch staging-cluster

# Get connection string for downstream steps
atlas clusters connectionStrings describe staging-cluster \
  --output json | jq -r '.standardSrv'
```

---

## 7. Data Explorer

Sometimes you just want to poke at your data without writing a script or opening `mongosh` — that's what the Data Explorer is for: a browser-based GUI for exploring and managing data, built directly into the Atlas console.

### 7.1 Features

```
Atlas → Clusters → Browse Collections (Data Explorer)

Features:
├── Browse Databases and Collections
├── View Documents (card/table/JSON view)
├── Insert Documents (single or bulk JSON)
├── Filter Documents (MQL query bar)
├── Update Documents (edit in-place)
├── Delete Documents
├── Manage Indexes (create, drop, view stats)
├── Run Aggregation Pipelines (visual builder)
├── View Collection Stats and Storage Size
└── Schema Analysis
```

### 7.2 Using the Query Bar

The query bar takes plain MQL — nothing new to learn if you already know `find()` filters:

```js
// Filter bar in Data Explorer — standard MQL syntax
{ status: "active", total: { $gt: 100 } }

// Sort by date descending
{ createdAt: -1 }

// Projection — show only name and email
{ name: 1, email: 1, _id: 0 }

// Aggregation example in the UI pipeline builder:
// Stage 1: $match
{ status: "shipped" }
// Stage 2: $group
{ _id: "$customerId", total: { $sum: "$amount" } }
// Stage 3: $sort
{ total: -1 }
```

---

## 8. Atlas Data Federation

**The problem:** not all your data belongs in a live, expensive database cluster forever. Old orders from three years ago, archived logs, exported analytics dumps — this stuff needs to be queryable occasionally, but paying for hot cluster storage and RAM to hold it 24/7 is wasteful.

**The fix:** Atlas Data Federation lets you run MQL queries across data stored in several places at once, as if they were all one database:
- Atlas clusters
- AWS S3 (Parquet, JSON, CSV, BSON, Avro)
- Atlas Data Lake
- HTTP/HTTPS sources (read-only)

### 8.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Atlas Data Federation                    │
│                                                         │
│  Query Engine (mongos-like interface)                   │
│       │                                                 │
│   ┌───┴────────────────────────────┐                    │
│   │  Virtual Namespace Mapping     │                    │
│   └───┬────────┬───────────┬───────┘                    │
│       │        │           │                            │
│  Atlas DB   AWS S3      HTTP source                     │
│  (live)  (Parquet/JSON) (REST API)                      │
└─────────────────────────────────────────────────────────┘
```

The query engine sits in front and presents a single "virtual" database — under the hood it's deciding, per query, whether to hit your live cluster, read Parquet files off S3, or call out to an HTTP source, and stitching the results together.

### 8.2 Creating a Federated Database

```
Atlas → Data Federation → "Create a Federated Database Instance"
→ Select data sources:
    ├── Atlas Cluster (select cluster, DB, collection)
    └── Amazon S3 (enter bucket, prefix, file format)
→ Map to virtual namespaces:
    virtualDB.virtualCollection → s3://my-bucket/data/*.json
→ Connect via standard MongoDB connection string
```

### 8.3 Querying Federated Data

The killer feature: you can `$lookup` between your live, hot data and your cold S3 archive in the same aggregation pipeline.

```js
// Connect to federated database endpoint
const client = new MongoClient("mongodb://federated-endpoint.mongodb.net");

// Query S3 data as if it were a collection
const db = client.db("federatedDB");
const results = await db.collection("s3Archives")
  .find({ year: 2023 })
  .limit(100)
  .toArray();

// Join S3 data with live Atlas data using $lookup
db.s3Archives.aggregate([
  {
    $lookup: {
      from: "liveOrders",        // from Atlas cluster
      localField: "orderId",
      foreignField: "_id",
      as: "currentStatus"
    }
  },
  { $match: { "currentStatus.status": "active" } }
])
```

> **Memory hook:** "Don't keep last year's tax receipts in your wallet — file them in the cabinet, and only pull them out when someone actually asks."

---

## 9. Architecture Diagram

Zooming all the way out, here's what actually sits behind a single Atlas cluster:

```
┌─────────────────────────────────────────────────────────────┐
│                       Atlas Cluster                         │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Primary  │───►│Secondary │───►│Secondary │  Replica Set │
│  │ (reads + │◄───│(replica) │    │(replica) │              │
│  │  writes) │    └──────────┘    └──────────┘              │
│  └──────────┘                                              │
│       │                                                     │
│  ┌────┴──────────────────────────────────┐                 │
│  │  Atlas Management Plane               │                 │
│  │  ├── Monitoring + Alerting            │                 │
│  │  ├── Automated Backups (PITR)         │                 │
│  │  ├── Auto-failover                    │                 │
│  │  ├── Version Upgrades                 │                 │
│  │  └── Performance Advisor             │                 │
│  └───────────────────────────────────────┘                 │
│                                                             │
│  Network Layer:                                             │
│  ├── IP Allowlist                                           │
│  ├── VPC Peering (AWS/GCP/Azure)                           │
│  └── PrivateLink (AWS)                                     │
└─────────────────────────────────────────────────────────────┘
            │                        │
     Your Application          Atlas UI / CLI
     (driver connection)       (management)
```

Every box in the "Management Plane" is something you'd otherwise have to build or script yourself on a self-hosted deployment — that's the whole pitch of Atlas in one picture.

---

## 10. Hands-On Exercises

### Exercise 1: Spin Up a Free Atlas Cluster

1. Create a free Atlas account at cloud.mongodb.com.
2. Create an organization "LearningMongoDB" and a project "Phase12Lab".
3. Deploy a free M0 cluster named "Phase12Cluster" on AWS us-east-1.
4. Add your IP to the allowlist and create a user `testUser` with `readWriteAnyDatabase`.
5. Connect via `mongosh` using the provided SRV connection string. Insert a document and verify.

### Exercise 2: Atlas CLI Automation

1. Install the Atlas CLI and authenticate.
2. Use `atlas clusters list` to confirm your cluster appears.
3. Create a second cluster `Phase12Dev` at M0 tier using only CLI commands.
4. Use `atlas dbusers create` to add a read-only user `analyticsUser`.
5. Use `atlas clusters connectionStrings describe` to extract the connection string.

### Exercise 3: Network Security Configuration

1. Remove the "Allow from Anywhere" (0.0.0.0/0) rule if present.
2. Add only your current IP via the Atlas UI and via CLI.
3. From a different IP (use a VPN or phone hotspot), attempt to connect — confirm it fails.
4. Add the CIDR block `192.168.0.0/24` via CLI and describe what scenario this represents.
5. Document the difference between VPC Peering and PrivateLink in your own words.

### Exercise 4: Data Explorer Exploration

1. Using the Data Explorer, insert 5 documents into a collection `products` in database `shop`.
2. Use the filter bar to find products with `price > 50`.
3. Open the Aggregation Pipeline builder and create a pipeline that groups by category and sums quantity.
4. Create an index on the `price` field through the Data Explorer Indexes tab.
5. Export the collection as JSON using Data Explorer.

### Exercise 5: Data Federation (S3 Integration)

1. Create an S3 bucket with test JSON files (simulate with 3 small files, each with 5 documents).
2. Set up an Atlas Federated Database instance pointing to that S3 bucket.
3. Map the bucket to a virtual namespace `federated.archive`.
4. Connect with mongosh to the federated endpoint and run a `find` query.
5. Write an aggregation that counts documents per status field across the S3 data.

---

## 11. Interview Q&A

**Q1: What is MongoDB Atlas and how does it differ from self-hosted MongoDB?**
A: Atlas is a fully managed DBaaS where MongoDB handles provisioning, patching, upgrades, backups, failover, and monitoring. With self-hosted MongoDB you manage all infrastructure. Atlas trades operational overhead for higher cost; self-hosted gives more control but requires DevOps expertise.

**Q2: What is the Atlas cluster hierarchy?**
A: Organization → Project → Cluster. Organizations own billing and members. Projects group clusters and share network access rules and database users. Clusters are the actual MongoDB deployments.

**Q3: What is the difference between M0 and M10?**
A: M0 is free, shared infrastructure (multi-tenant), limited to 512 MB storage, no VPC peering, no dedicated IOPS, no backups. M10 is a dedicated instance at ~$57/mo with 2 GB RAM, 10 GB NVMe SSD, backups, VPC peering, private endpoints, and the full Atlas feature set.

**Q4: How does Atlas handle high availability?**
A: Atlas deploys every cluster as a 3-node replica set (primary + 2 secondaries) by default. If the primary fails, Atlas automatically elects a new primary within seconds. Nodes are placed across different availability zones for fault tolerance.

**Q5: What network access options does Atlas provide and when would you use each?**
A: IP Allowlist (quick setup, for specific IPs), VPC Peering (private connectivity within a cloud provider, good for production apps running in the same cloud), AWS PrivateLink (highest security, traffic never leaves the AWS network fabric, used for compliance-sensitive workloads).

**Q6: What authentication methods does Atlas support for database users?**
A: SCRAM password authentication (default), x.509 certificate authentication (no passwords, PKI-based), AWS IAM authentication (automatic credential rotation, best for AWS-hosted apps), and LDAP/Federated SSO for enterprise directory integration.

**Q7: What is Atlas Data Federation and what data sources does it support?**
A: Data Federation is a query layer that maps Atlas collections, S3 objects (JSON, Parquet, CSV, BSON, Avro), and HTTP sources to virtual namespaces queryable with standard MQL. It enables analytics across hot Atlas data and cold S3 archival data without moving data.

**Q8: How does Atlas auto-scaling work?**
A: Compute auto-scaling monitors CPU and memory utilization and scales the cluster tier up or down within configured bounds. Storage auto-scaling increases storage when utilization exceeds 90% (never scales down automatically to avoid data loss). Both are available on M10+ clusters.

**Q9: What happens to a paused Atlas cluster?**
A: A paused cluster stops compute billing but continues to incur storage charges. The data is preserved. The cluster cannot accept connections while paused. M0 free clusters are automatically paused after 60 days of inactivity.

**Q10: How do you get the connection string for an Atlas cluster programmatically?**
A: Via Atlas CLI: `atlas clusters connectionStrings describe <clusterName>`. Via the Atlas Admin API: `GET /api/atlas/v1.0/groups/{groupId}/clusters/{clusterName}`. The `standardSrv` field contains the `mongodb+srv://` URI.
