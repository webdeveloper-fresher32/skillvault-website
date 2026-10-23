# Phase 12: MongoDB Atlas & Cloud

## Overview

Phase 12 covers MongoDB Atlas — the fully managed cloud database service built
and operated by MongoDB. After mastering self-hosted MongoDB (Phases 1–11), this
phase teaches you to deploy, configure, operate, and optimize MongoDB in the
cloud across AWS, GCP, and Azure.

---

## Topics in This Phase

```
Phase-12-Atlas-Cloud/
├── README.md                  ← This file
├── 01-MongoDB-Atlas.md        ← Atlas fundamentals, tiers, cluster creation,
│                                 network access, users, CLI, Data Federation
└── 02-Atlas-Features.md       ← Atlas Search, Vector Search, Data API,
                                  Triggers, Charts, App Services, Backup,
                                  Global Clusters
```

---

## Learning Objectives

After completing Phase 12, you will be able to:

- Understand the Atlas DBaaS model and its advantages over self-hosting
- Choose the correct Atlas cluster tier for a given workload and budget
- Create and configure Atlas clusters through the UI and Atlas CLI
- Manage network security: IP allowlists, VPC peering, PrivateLink
- Set up database users with password, x.509, and AWS IAM authentication
- Use Atlas Search to build full-text search powered by Lucene
- Implement semantic search and RAG pipelines with Atlas Vector Search
- Integrate serverless HTTP access via the Atlas Data API
- Automate workflows using Atlas Triggers (database, scheduled, auth)
- Build dashboards with Atlas Charts
- Configure backup policies with continuous backup and Point-in-Time Recovery
- Design globally distributed deployments with Global Clusters

---

## Prerequisites

- Completion of Phases 1–11 (CRUD, aggregation, indexes, replication, sharding,
  security)
- A free MongoDB Atlas account (cloud.mongodb.com)
- Atlas CLI installed (`brew install mongodb-atlas-cli` or equivalent)
- Node.js or Python for driver-based exercises

---

## Key Concepts Introduced

| Concept | Description |
|---------|-------------|
| DBaaS | Database-as-a-Service: fully managed, no ops overhead |
| M0 / M10 / M30+ | Atlas cluster tiers from free to dedicated |
| Atlas Search | Lucene-based full-text search engine built into Atlas |
| Vector Search | ANN search over embedding vectors for semantic/AI use cases |
| Atlas Triggers | Event-driven serverless functions tied to DB events |
| Data Federation | Query across S3, Atlas, HTTP sources with MQL |
| App Services | Serverless backend (Functions, GraphQL, Auth, Sync) |
| PITR | Point-in-Time Recovery for granular restore |
| Global Clusters | Zone-sharded multi-region deployments |

---

## Phase Structure

```
┌─────────────────────────────────────────────────────────┐
│                   Phase 12 Learning Path                │
│                                                         │
│  01-MongoDB-Atlas.md                                    │
│  ├── DBaaS model and tier selection                     │
│  ├── Cluster creation and configuration                 │
│  ├── Network access and private networking              │
│  ├── Database users and authentication methods          │
│  ├── Atlas CLI for automation                           │
│  └── Data Explorer and Data Federation                  │
│                                                         │
│  02-Atlas-Features.md                                   │
│  ├── Atlas Search (Lucene, $search)                     │
│  ├── Atlas Vector Search ($vectorSearch)                │
│  ├── Atlas Data API (HTTP REST)                         │
│  ├── Atlas Triggers (database, scheduled, auth)         │
│  ├── Atlas Charts                                       │
│  ├── Atlas App Services (Functions, GraphQL)            │
│  ├── Backup and PITR                                    │
│  └── Global Clusters                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

1. Create a free account at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Deploy a free M0 cluster
3. Add your IP to the network allowlist
4. Create a database user
5. Connect with mongosh or a driver using the provided connection string
6. Follow exercises in `01-MongoDB-Atlas.md`

---

*Phase 12 of the MongoDB Learning Series*
