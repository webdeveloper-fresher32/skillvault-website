# Atlas Features — Deep Dive
## MongoDB Atlas Cloud Platform

Renting a serviced apartment (as the previous file put it) gets you a working home — but a *good* building also has amenities: a gym, a package room, maybe a rooftop. Atlas's core database service is the apartment. The features in this file are the amenities: a built-in search engine, an AI-ready vector store, an HTTP front door, automated jobs, dashboards, backups, and a way to spread your data across the globe. None of them are required to run MongoDB — but each one exists because plenty of teams, sooner or later, hit the exact problem it solves.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MongoDB Atlas Platform                           │
├──────────────┬──────────────┬──────────────┬──────────────┬────────────┤
│ Atlas Search │ Vector Search│  Data API    │  Triggers    │   Charts   │
│  (Lucene)    │ (embeddings) │ (REST/HTTP)  │ (DB/Cron)    │  (Viz)     │
├──────────────┴──────────────┴──────────────┴──────────────┴────────────┤
│              App Services · Backup · Global Clusters                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Atlas Search — Lucene Engine](#1-atlas-search)
2. [Atlas Vector Search](#2-atlas-vector-search)
3. [Atlas Data API](#3-atlas-data-api)
4. [Atlas Triggers](#4-atlas-triggers)
5. [Atlas Charts](#5-atlas-charts)
6. [Atlas App Services](#6-atlas-app-services)
7. [Backup & Point-in-Time Recovery](#7-backup)
8. [Global Clusters & Zone Sharding](#8-global-clusters)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. Atlas Search

### The problem it solves

You've got a `products` collection and a search box in your app. A user types "wireless headphones noise cancelling." A regular MongoDB query with `$regex` or a text index can find documents containing those words, but it has no real concept of relevance ranking, fuzzy matching for typos, autocomplete, or faceted counts like "Electronics (42)." That's a whole category of features — full-text search — that MongoDB's core query engine was never built for.

The obvious fix is bolting on a separate Elasticsearch cluster. But now you're running two databases, writing sync logic to keep them consistent, and paging two different on-call rotations.

**The analogy:** Atlas Search is a built-in Google search bar for your collection. `mongod` stores your documents like a filing cabinet; a sidecar process called `mongot` maintains an index of every word so search feels instant, the same way Google doesn't scan the whole internet on every query — it consults a pre-built index.

**Basic definition:** Atlas Search embeds a full **Apache Lucene** engine directly inside each Atlas node. Unlike a standalone Elasticsearch cluster, there's no separate infrastructure to run — the search index lives right alongside your data, on the same replica set members.

**How it works internally:**

```
┌────────────────────────────────────────────────────────┐
│                   Atlas Replica Set Node               │
│                                                        │
│  ┌──────────────┐      ┌──────────────────────────┐   │
│  │  mongod      │ sync │  mongot (Lucene process) │   │
│  │  (WiredTiger)│─────>│  inverted index segments │   │
│  └──────────────┘      └──────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

`mongod` keeps writing documents the normal way. In the background, `mongot` watches those changes (via change streams) and keeps its own Lucene inverted index up to date — so search queries never touch `mongod`'s storage engine at all; they go straight to the index.

---

### Creating a Search Index

You define one via the Atlas UI or the Atlas CLI, as a JSON mapping:

```json
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "title": {
        "type": "string",
        "analyzer": "lucene.english"
      },
      "price": {
        "type": "number"
      },
      "category": {
        "type": "stringFacet"
      },
      "description": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "tags": {
        "type": "string",
        "multi": {
          "keywordAnalyzer": {
            "type": "string",
            "analyzer": "lucene.keyword"
          }
        }
      }
    }
  }
}
```

**Index mapping types:**

| Type          | Use Case                                   |
|---------------|--------------------------------------------|
| `string`      | Full-text search with analyzer             |
| `stringFacet` | Faceted navigation (counts per category)   |
| `number`      | Numeric range filtering                    |
| `date`        | Date range filtering                       |
| `boolean`     | Boolean facets                             |
| `document`    | Nested object indexing                     |
| `embeddedDocuments` | Arrays of subdocuments               |
| `autocomplete`| Prefix/infix autocomplete                 |

---

### The `$search` Aggregation Stage

`$search` has one hard rule: it must be the **first** stage in an aggregation pipeline. It hands a scored set of documents downstream to whatever stages follow.

#### Text Search (basic)

```js
db.products.aggregate([
  {
    $search: {
      index: "default",
      text: {
        query: "wireless headphones noise cancelling",
        path: ["title", "description"],
        fuzzy: { maxEdits: 1, prefixLength: 3 }
      }
    }
  },
  {
    $project: {
      title: 1,
      price: 1,
      score: { $meta: "searchScore" }
    }
  },
  { $limit: 10 }
]);
```

#### Compound Operator

Real search queries are rarely just "match this text" — you usually need to combine required matches, boosts, exclusions, and hard filters all at once. That's what `compound` is for:

| Clause     | Semantics                                         |
|------------|---------------------------------------------------|
| `must`     | Document MUST match — contributes to score        |
| `mustNot`  | Document MUST NOT match                           |
| `should`   | Boosts score if matched (optional match)          |
| `filter`   | Must match but does NOT contribute to score       |

```js
db.listings.aggregate([
  {
    $search: {
      index: "listingsIndex",
      compound: {
        must: [
          {
            text: {
              query: "ocean view apartment",
              path: "description",
              score: { boost: { value: 2.5 } }
            }
          }
        ],
        mustNot: [
          {
            text: { query: "shared bathroom", path: "description" }
          }
        ],
        should: [
          {
            range: {
              path: "rating",
              gte: 4.5,
              score: { boost: { value: 1.5 } }
            }
          }
        ],
        filter: [
          {
            range: {
              path: "price",
              gte: 50,
              lte: 300
            }
          },
          {
            text: {
              query: "Miami",
              path: "city"
            }
          }
        ]
      }
    }
  },
  {
    $project: {
      name: 1,
      price: 1,
      rating: 1,
      score: { $meta: "searchScore" }
    }
  }
]);
```

#### Range Operator

```js
db.orders.aggregate([
  {
    $search: {
      index: "ordersIndex",
      compound: {
        filter: [
          {
            range: {
              path: "createdAt",
              gte: ISODate("2024-01-01"),
              lte: ISODate("2024-12-31")
            }
          },
          {
            range: {
              path: "totalAmount",
              gte: 100
            }
          }
        ],
        must: [
          {
            text: {
              query: "electronics",
              path: "category"
            }
          }
        ]
      }
    }
  }
]);
```

#### Autocomplete

```js
db.products.aggregate([
  {
    $search: {
      index: "autocompleteIndex",
      autocomplete: {
        query: "wire",
        path: "title",
        tokenOrder: "sequential",
        fuzzy: { maxEdits: 1 }
      }
    }
  },
  { $limit: 5 },
  { $project: { title: 1 } }
]);
```

---

### `$searchMeta` — Facets and Counts

Notice that `$search` above always returns *documents*. But what about the sidebar filter panel that shows "Electronics (42), Laptops (18), Phones (24)"? You don't want the documents for that — you want counts. That's the job of `$searchMeta`: it returns **metadata** (counts, facet buckets) instead of the matching documents themselves.

```js
db.products.aggregate([
  {
    $searchMeta: {
      index: "default",
      facet: {
        operator: {
          compound: {
            must: [
              { text: { query: "laptop", path: "title" } }
            ],
            filter: [
              { range: { path: "price", gte: 500, lte: 2000 } }
            ]
          }
        },
        facets: {
          categoryFacet: {
            type: "string",
            path: "category",
            numBuckets: 10
          },
          priceFacet: {
            type: "number",
            path: "price",
            boundaries: [0, 500, 1000, 1500, 2000],
            default: "other"
          },
          brandFacet: {
            type: "string",
            path: "brand",
            numBuckets: 20
          }
        }
      }
    }
  }
]);

// Output shape:
// {
//   count: { lowerBound: 142 },
//   facet: {
//     categoryFacet: { buckets: [ { _id: "Laptops", count: 80 }, ... ] },
//     priceFacet:    { buckets: [ { _id: 0, count: 5 }, ... ] },
//     brandFacet:    { buckets: [ { _id: "Dell", count: 34 }, ... ] }
//   }
// }
```

---

### Search Score Explanation

Ever wonder *why* one result ranked above another? `scoreDetails` breaks the score down field-by-field:

```js
db.articles.aggregate([
  {
    $search: {
      text: { query: "machine learning", path: "body" },
      scoreDetails: true
    }
  },
  {
    $project: {
      title: 1,
      score: { $meta: "searchScore" },
      scoreDetails: { $meta: "searchScoreDetails" }
    }
  },
  { $limit: 3 }
]);
```

**Interview answer:** Atlas Search embeds the Lucene engine as a sidecar process (`mongot`) directly on Atlas nodes, so there's no separate infrastructure to provision, scale, or keep in sync — change streams automatically propagate document changes from `mongod` to `mongot`. A standalone Elasticsearch cluster requires its own infrastructure, custom connectors, and manual sync logic, which adds real operational complexity.

> **Memory hook:** "mongod is the filing cabinet, mongot is the librarian who already memorized where every word is."

---

## 2. Atlas Vector Search

### The problem it solves

Regular text search — even Atlas Search — matches **keywords**. Search for "comfortable shoes for long walks" and it looks for those literal words (or close typos of them). But what if the best-matching product is described as "cushioned running sneakers ideal for daily jogging"? No shared keywords, yet clearly the same intent. Keyword search is blind to meaning.

**The analogy:** keyword search is like finding a book by matching words in the title. Vector search is like asking a librarian who's actually read every book and can recommend one based on what it's *about*, even if the words don't overlap.

**Basic definition:** Vector search matches **meaning** by comparing high-dimensional float arrays (embeddings) using similarity metrics like cosine or dot-product, instead of comparing literal text tokens.

**How it works internally:**

```
Query: "comfortable shoes for long walks"
                    │
              Embedding Model
           (OpenAI / Cohere / local)
                    │
        [ 0.12, -0.87, 0.43, ... ] (1536-dim)
                    │
          $vectorSearch ──> ANN (HNSW graph)
                    │
        Nearest neighbor documents returned
```

An embedding model turns your query into a long list of numbers that captures its meaning. `$vectorSearch` then walks an HNSW graph (a data structure built for fast approximate nearest-neighbor lookup) to find the stored vectors that sit closest to your query vector in that high-dimensional space.

### Creating a Vector Search Index

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "category"
    },
    {
      "type": "filter",
      "path": "price"
    }
  ]
}
```

**Similarity metrics:**

| Metric          | Best For                                    |
|-----------------|---------------------------------------------|
| `cosine`        | Normalized embeddings (OpenAI, Cohere)      |
| `euclidean`     | Raw vectors where magnitude matters         |
| `dotProduct`    | Pre-normalized unit vectors (fastest)       |

---

### `$vectorSearch` Stage

```js
// Generate embedding for the user's query first (outside MongoDB)
const queryEmbedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: "comfortable walking shoes for plantar fasciitis"
});

db.products.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding.data[0].embedding,
      numCandidates: 150,   // HNSW candidates to examine
      limit: 10,            // final results to return
      filter: {             // pre-filter on scalar fields
        category: "footwear",
        price: { $lte: 200 }
      }
    }
  },
  {
    $project: {
      name: 1,
      description: 1,
      price: 1,
      vectorSearchScore: { $meta: "vectorSearchScore" }
    }
  }
]);
```

**Common confusion — `numCandidates` vs `limit`:** these look similar but control different things. `numCandidates` is how deep into the HNSW graph the search examines before narrowing down (this affects *recall* — how likely you are to actually find the truly closest matches). `limit` is simply how many final results come back. A higher `numCandidates`-to-`limit` ratio improves recall at the cost of latency — for production, 10–15x `numCandidates` vs `limit` is a common starting point.

---

### RAG (Retrieval-Augmented Generation) Pattern

Here's the pattern vector search is most often used for: instead of asking an LLM a question and hoping it "knows" the answer from training data, you first retrieve relevant chunks of your own documents, then hand those chunks to the LLM as context. The LLM answers grounded in facts you actually control.

```
User Question
      │
      ▼
┌─────────────┐    embedding     ┌──────────────────┐
│ Embed query │ ──────────────> │  $vectorSearch   │
│ (LLM API)   │                  │  (MongoDB Atlas) │
└─────────────┘                  └────────┬─────────┘
                                          │ top-k docs
                                          ▼
                                 ┌─────────────────┐
                                 │ Build prompt:   │
                                 │ context + query │
                                 └────────┬────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │   LLM (Claude/  │
                                 │   GPT) generates│
                                 │   grounded answer│
                                 └─────────────────┘
```

```js
// Full RAG pipeline example
async function ragQuery(userQuestion) {
  // Step 1: Embed the question
  const embedding = await embedText(userQuestion);

  // Step 2: Retrieve relevant chunks from Atlas
  const chunks = await db.knowledgeBase.aggregate([
    {
      $vectorSearch: {
        index: "kb_vector_index",
        path: "embedding",
        queryVector: embedding,
        numCandidates: 100,
        limit: 5
      }
    },
    { $project: { text: 1, source: 1, _id: 0 } }
  ]).toArray();

  // Step 3: Build augmented prompt
  const context = chunks.map(c => c.text).join("\n\n---\n\n");
  const prompt = `Context:\n${context}\n\nQuestion: ${userQuestion}\nAnswer:`;

  // Step 4: Generate answer
  return await llm.complete(prompt);
}
```

**Interview answer:** Documents are chunked (e.g., 500-token paragraphs), embedded via an embedding model, and stored with their vectors in Atlas. A vector search index (HNSW) is built on the embedding field. At query time, the user's question is embedded, `$vectorSearch` retrieves the top-k semantically similar chunks with optional scalar pre-filters, and those chunks are injected into an LLM prompt as context — so the LLM answers grounded in retrieved facts rather than hallucinating.

> **Memory hook:** "Keyword search finds matching words. Vector search finds matching *meaning* — like asking a librarian instead of grepping a table of contents."

---

## 3. Atlas Data API

### The problem it solves

Say you're building a mobile app or a browser extension. You want it to read and write MongoDB documents, but you really don't want to embed a full database connection string (and its credentials) inside client-side code that anyone can decompile. A native driver also assumes a persistent, pooled connection — awkward for a webhook handler that spins up, does one thing, and dies.

**Basic definition:** the Atlas Data API exposes your collections as a **REST HTTP endpoint** — no MongoDB driver required. Any HTTP client (curl, `fetch`, Postman) can read and write documents over plain HTTPS.

```
┌─────────────────────────────────────────────────┐
│  Client (mobile app, serverless fn, webhook)    │
│                                                 │
│  POST https://<region>.data.mongodb-api.com/... │
│  Headers: api-key: <key>                        │
│  Body: { collection, database, document }       │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
                     ▼
           ┌──────────────────┐
           │  Atlas Data API  │
           │  (serverless)    │
           └────────┬─────────┘
                    │ driver protocol
                    ▼
           ┌──────────────────┐
           │  Atlas Cluster   │
           └──────────────────┘
```

**Base URL:** `https://data.mongodb-api.com/app/<App-ID>/endpoint/data/v1`

---

### Endpoints Reference

| Action        | Method | Endpoint                  |
|---------------|--------|---------------------------|
| Find one      | POST   | `/action/findOne`         |
| Find many     | POST   | `/action/find`            |
| Insert one    | POST   | `/action/insertOne`       |
| Insert many   | POST   | `/action/insertMany`      |
| Update one    | POST   | `/action/updateOne`       |
| Update many   | POST   | `/action/updateMany`      |
| Delete one    | POST   | `/action/deleteOne`       |
| Delete many   | POST   | `/action/deleteMany`      |
| Aggregate     | POST   | `/action/aggregate`       |

---

### curl Examples

```bash
# Find one document
curl -X POST \
  "https://data.mongodb-api.com/app/myapp-abc/endpoint/data/v1/action/findOne" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "dataSource": "Cluster0",
    "database": "ecommerce",
    "collection": "products",
    "filter": { "sku": "WIDGET-42" }
  }'

# Insert a document
curl -X POST \
  "https://data.mongodb-api.com/app/myapp-abc/endpoint/data/v1/action/insertOne" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "dataSource": "Cluster0",
    "database": "ecommerce",
    "collection": "orders",
    "document": {
      "userId": "u123",
      "items": [{ "sku": "WIDGET-42", "qty": 2 }],
      "total": 49.98,
      "createdAt": { "$date": "2024-06-01T00:00:00Z" }
    }
  }'

# Run an aggregation
curl -X POST \
  "https://data.mongodb-api.com/app/myapp-abc/endpoint/data/v1/action/aggregate" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_API_KEY" \
  -d '{
    "dataSource": "Cluster0",
    "database": "ecommerce",
    "collection": "orders",
    "pipeline": [
      { "$match": { "status": "shipped" } },
      { "$group": { "_id": "$userId", "totalSpent": { "$sum": "$total" } } },
      { "$sort": { "totalSpent": -1 } },
      { "$limit": 5 }
    ]
  }'
```

---

### JavaScript (fetch) Example

```js
const BASE_URL = "https://data.mongodb-api.com/app/myapp-abc/endpoint/data/v1";
const API_KEY  = process.env.ATLAS_API_KEY;

async function findProducts(query) {
  const res = await fetch(`${BASE_URL}/action/find`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": API_KEY
    },
    body: JSON.stringify({
      dataSource: "Cluster0",
      database: "ecommerce",
      collection: "products",
      filter: query,
      sort: { createdAt: -1 },
      limit: 20
    })
  });
  const data = await res.json();
  return data.documents;
}
```

**When to use the Data API vs a driver:**

| Scenario                                  | Recommendation            |
|--------------------------------------------|---------------------------|
| Node/Python/Java backend                  | Use driver — lower latency|
| Serverless functions (cold start concern) | Data API is fine           |
| Mobile app without backend                | Data API (avoid exposing driver URI) |
| Webhooks / third-party integrations       | Data API                  |
| High-throughput writes                    | Driver (batching, sessions)|

**Interview answer:** the Data API is best when a native driver is impractical — mobile clients that shouldn't expose a connection string, third-party no-code tools, or serverless webhook handlers where a driver's connection pooling adds cold-start overhead. For high-throughput applications, native drivers still win on latency, batching, and session support.

> **Memory hook:** "The Data API is a hotel room-service menu — you don't need a key to the kitchen, just an order form."

---

## 4. Atlas Triggers

### What problem they solve

You want "send a welcome email whenever a user signs up" or "email a revenue report every Monday at 9am" — but you don't want to stand up a cron server or a message queue just to run a few lines of logic on an event or a schedule.

**Basic definition:** Atlas Triggers run JavaScript logic **automatically** in response to database events or on a schedule — serverless, with no infrastructure to manage.

```
┌─────────────────────────────────────────────────────────┐
│                    Atlas Triggers                       │
│                                                         │
│  ┌─────────────────────┐   ┌────────────────────────┐  │
│  │   Database Trigger  │   │   Scheduled Trigger    │  │
│  │                     │   │                        │  │
│  │  insert / update /  │   │  Cron expression       │  │
│  │  delete / replace   │   │  0 9 * * 1 (Mon 9am)   │  │
│  └──────────┬──────────┘   └───────────┬────────────┘  │
│             │                          │                │
│             ▼                          ▼                │
│       ┌─────────────────────────────────────┐          │
│       │  Atlas Function (JS / Node.js)      │          │
│       │  context.services / http / AWS SDK  │          │
│       └─────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

There are two flavors, and the diagram above draws the line clearly: **database triggers** fire off change stream events (insert/update/delete/replace); **scheduled triggers** fire off a cron expression, independent of whether any data changed at all. Both hand off to the same thing underneath — a serverless JavaScript function.

---

### Database Trigger

```js
// Trigger: send welcome email when a new user is inserted
exports = async function(changeEvent) {
  const fullDocument = changeEvent.fullDocument;
  const operationType = changeEvent.operationType; // "insert"

  if (operationType !== "insert") return;

  const { email, firstName } = fullDocument;

  // Call an HTTP service (e.g., SendGrid)
  const response = await context.http.post({
    url: "https://api.sendgrid.com/v3/mail/send",
    headers: {
      "Authorization": [`Bearer ${context.values.get("SENDGRID_API_KEY")}`],
      "Content-Type": ["application/json"]
    },
    body: JSON.stringify({
      to: [{ email }],
      from: { email: "noreply@myapp.com" },
      subject: `Welcome, ${firstName}!`,
      content: [{ type: "text/plain", value: "Thanks for signing up." }]
    })
  });

  console.log(`Welcome email sent to ${email}, status: ${response.statusCode}`);
};
```

**Trigger configuration options:**

| Option              | Description                                           |
|---------------------|-------------------------------------------------------|
| `Operation Types`   | Insert, Update, Delete, Replace (select any combo)    |
| `Full Document`     | Include full post-image of updated document           |
| `Document Preimage` | Include pre-update snapshot (extra storage cost)      |
| `Match Expression`  | Filter which documents fire the trigger               |
| `Project Expression`| Limit which fields are passed to the function         |
| `Auto-Resume`       | Automatically resume after error using resume token   |

---

### Trigger with Pre-image (Audit Log)

A common use for the "Document Preimage" option above: you need to know not just *that* something changed, but what it changed *from*.

```js
// Trigger: log all price changes to an audit collection
exports = async function(changeEvent) {
  const { operationType, fullDocument, fullDocumentBeforeChange, documentKey } = changeEvent;

  if (operationType !== "update") return;

  const beforePrice = fullDocumentBeforeChange?.price;
  const afterPrice  = fullDocument?.price;

  if (beforePrice === afterPrice) return; // price did not change

  const audit = context.services.get("mongodb-atlas").db("ecommerce").collection("priceAudit");

  await audit.insertOne({
    productId: documentKey._id,
    beforePrice,
    afterPrice,
    changedAt: new Date(),
    changedBy: fullDocument.lastModifiedBy
  });
};
```

---

### Scheduled Trigger

```js
// Scheduled trigger: run every day at midnight UTC
// Cron: 0 0 * * *
exports = async function() {
  const db = context.services.get("mongodb-atlas").db("ecommerce");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Aggregate yesterday's revenue
  const result = await db.collection("orders").aggregate([
    {
      $match: {
        createdAt: { $gte: yesterday, $lt: today },
        status: "completed"
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        orderCount:   { $sum: 1 }
      }
    }
  ]).toArray();

  const summary = result[0] || { totalRevenue: 0, orderCount: 0 };

  await db.collection("dailyRevenueSnapshots").insertOne({
    date:         yesterday,
    totalRevenue: summary.totalRevenue,
    orderCount:   summary.orderCount,
    createdAt:    new Date()
  });

  console.log(`Daily snapshot recorded: $${summary.totalRevenue} from ${summary.orderCount} orders`);
};
```

**Common cron expressions:**

| Cron            | Schedule                    |
|-----------------|-----------------------------|
| `0 * * * *`     | Every hour                  |
| `0 9 * * 1`     | Every Monday 9am UTC        |
| `*/15 * * * *`  | Every 15 minutes            |
| `0 0 1 * *`     | First day of every month    |
| `0 0 * * *`     | Every midnight UTC          |

**Common mistake / limitation:** Atlas Functions time out after 120 seconds and run single-threaded JavaScript, with no persistent state between invocations. If your change stream fires faster than your function can process each event, triggers can back up — the fix is usually tighter `Match Expression` filters, or moving the logic to a dedicated application service once volume outgrows what a trigger comfortably handles.

**Interview answer:** database triggers fire in response to change stream events on a specific collection; scheduled triggers fire on a cron schedule regardless of data changes, useful for periodic jobs like daily reports. Both execute serverless Atlas Functions written in JavaScript.

> **Memory hook:** "Database triggers are a doorbell — they ring when something happens. Scheduled triggers are an alarm clock — they ring no matter what."

---

## 5. Atlas Charts

### Overview

Atlas Charts is a hosted BI/visualization tool that connects directly to your Atlas cluster — no ETL pipeline needed to get from "data in MongoDB" to "chart on a dashboard."

```
Atlas Cluster ──> Charts Data Source ──> Dashboard ──> Embeddable iframe
```

### Chart Types Available

| Category    | Charts                                             |
|-------------|-----------------------------------------------------|
| Categorical | Bar, Grouped Bar, Stacked Bar, Column             |
| Time Series | Line, Area, Combo (line + bar)                    |
| Geospatial  | Choropleth, Scatter map, Heatmap                  |
| Part-whole  | Donut, Pie, Treemap                               |
| Statistical | Scatter, Bubble, Box plot                         |
| Lookup      | Table, Number (KPI metric)                        |

---

### Embedding Charts

```html
<!-- Embedding an Atlas Chart in a web app -->
<div id="chart"></div>

<script src="https://charts.mongodb.com/js/embedded-charts.umd.production.min.js"></script>
<script>
  const sdk = ChartsEmbedSDK({
    baseUrl: "https://charts.mongodb.com/charts-myapp-abc"
  });

  const chart = sdk.createChart({
    chartId: "chart-uuid-here",
    height: "400px",
    width: "100%",
    // Optional: filter the chart at render time
    filter: { category: "electronics" },
    // Optional: authentication
    getUserToken: async () => getJWT()
  });

  chart.render(document.getElementById("chart"));
</script>
```

**Interview answer:** Charts queries the Atlas cluster on demand when a dashboard is loaded or refreshed, so data is always current. You can configure a refresh interval (minimum 1 minute for hosted dashboards); for sub-minute freshness, embed the Charts SDK and call `chart.setRefreshInterval()`, or build a custom dashboard on direct driver queries instead.

---

## 6. Atlas App Services

### GraphQL API

Some clients (mobile apps, frontend teams that live in GraphQL) don't want raw MongoDB queries — they want a typed schema and a single `/graphql` endpoint. Atlas App Services auto-generates one from your collections.

```graphql
# Auto-generated schema (simplified)
type Product {
  _id: ObjectId
  name: String
  price: Float
  category: String
  tags: [String]
}

type Query {
  product(query: ProductQueryInput): Product
  products(query: ProductQueryInput, limit: Int, sortBy: ProductSortByInput): [Product]!
}

type Mutation {
  insertOneProduct(data: ProductInsertInput!): Product
  updateOneProduct(query: ProductQueryInput, set: ProductUpdateInput!): Product
  deleteOneProduct(query: ProductQueryInput): Product
}
```

```js
// GraphQL query from a client
const { data } = await apolloClient.query({
  query: gql`
    query GetExpensiveProducts($minPrice: Float!) {
      products(query: { price_gt: $minPrice }, sortBy: PRICE_DESC, limit: 5) {
        _id
        name
        price
        category
      }
    }
  `,
  variables: { minPrice: 500 }
});
```

---

### Serverless Functions

Beyond auto-generated GraphQL, App Services also lets you write your own custom HTTP endpoint logic as a function — handy for pagination, custom validation, or anything the auto-generated CRUD API doesn't cover out of the box.

```js
// Atlas Function: custom HTTP endpoint logic
exports = async function({ query, headers, body }) {
  const db = context.services.get("mongodb-atlas").db("ecommerce");

  const { category, page = 1, pageSize = 20 } = query;

  const filter = category ? { category } : {};

  const [products, total] = await Promise.all([
    db.collection("products")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    db.collection("products").countDocuments(filter)
  ]);

  return {
    products,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
};
```

---

## 7. Backup

### The problem it solves

Things go wrong: a bad deploy runs an unintended `deleteMany`, a migration script has a bug, someone fat-fingers a bulk update. When it happens, "restore to how things looked five minutes before the mistake" is exactly what you need — and that's a much more specific ask than "restore to last night's snapshot."

### Backup Options Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                   Atlas Backup Tiers                            │
│                                                                 │
│  Basic Backup (M10+)            Continuous Backup (M10+)       │
│  ┌───────────────────────┐      ┌──────────────────────────┐   │
│  │ Daily snapshots        │      │ Oplog streaming          │   │
│  │ Weekly snapshots       │      │ Restore to any second    │   │
│  │ Monthly snapshots      │      │ (PITR)                   │   │
│  │ Restore to snapshot    │      │ Last 24 hours default    │   │
│  └───────────────────────┘      └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

Basic backup only gets you back to a snapshot boundary — the start of a day, a week, a month. If your incident happened at 14:37:22 and the last snapshot was taken at midnight, you'd lose everything in between. That gap is exactly what Point-in-Time Recovery closes.

### Point-in-Time Recovery (PITR)

**How it works internally:** PITR works by replaying the **oplog** (the same replication log secondaries use to stay in sync) on top of the nearest preceding snapshot:

```
Snapshot (00:00)  ──> oplog replay ──> Restore to 14:37:22
      │                                         │
      └───────── 14h 37m 22s of ops ────────────┘
```

Atlas continuously streams oplog entries to cloud storage in the background. To restore to a specific second, Atlas takes the nearest snapshot *before* that moment and replays every operation from the oplog up to your target timestamp — conceptually the same idea as PostgreSQL's WAL-based recovery.

### Snapshot Retention Policy

```json
{
  "snapshotRetentionPolicy": {
    "dailySnapshotRetentionDays": 7,
    "weeklySnapshotRetentionWeeks": 4,
    "monthlySnapshotRetentionMonths": 12,
    "pointInTimeWindowHours": 24
  }
}
```

### On-Demand Snapshots

Sometimes you want a snapshot right now — say, right before running a risky migration — rather than waiting for the next scheduled one:

```bash
# Via Atlas CLI
atlas backups snapshots create myCluster \
  --desc "Pre-migration snapshot" \
  --retention 30
```

**Interview answer:** PITR allows restoring a cluster to any second within the configured window (default 24 hours). Atlas continuously streams oplog entries to cloud storage; to restore, it first restores the nearest preceding snapshot, then replays oplog operations up to the target timestamp — similar to how PostgreSQL WAL-based recovery works.

> **Memory hook:** "A snapshot is a photo album from last night. PITR is rewinding the security-camera footage to the exact second before the mistake."

---

## 8. Global Clusters

### The problem it solves

Say you have users in the US, the EU, and APAC. If your only cluster lives in `us-east-1`, every EU user's query has to cross the Atlantic and back — adding real, user-visible latency. Worse, some regulations (GDPR being the obvious one) require that EU citizens' data physically stay within the EU. A single-region cluster can't satisfy both "fast for everyone" and "data stays local" at once.

**Basic definition:** Global Clusters let you pin data to geographic regions using zone sharding — critical for GDPR, data sovereignty, and latency.

### Zone Sharding for Geo-Distribution

```
┌─────────────────────────────────────────────────────────────────┐
│                    Global Cluster Zones                         │
│                                                                 │
│   ┌────────────────┐    ┌───────────────┐   ┌────────────────┐ │
│   │  US-EAST Zone  │    │ EU-WEST Zone  │   │ APAC Zone      │ │
│   │                │    │               │   │                │ │
│   │ tenantRegion:  │    │ tenantRegion: │   │ tenantRegion:  │ │
│   │  "us-east"     │    │  "eu-west"    │   │  "ap-south"    │ │
│   │                │    │               │   │                │ │
│   │  3 nodes       │    │  3 nodes      │   │  3 nodes       │ │
│   └────────────────┘    └───────────────┘   └────────────────┘ │
│                                                                 │
│  Shard key: { tenantRegion: 1, _id: 1 }                        │
└─────────────────────────────────────────────────────────────────┘
```

### Zone Mapping

The shard key includes a `tenantRegion` field, and every document's value for that field determines which zone it physically lives in:

```js
// Documents with tenantRegion: "us-east" only live in US-East zone
// Documents with tenantRegion: "eu-west" only live in EU-West zone

// Insert routes automatically based on shard key
db.userProfiles.insertOne({
  _id: new ObjectId(),
  tenantRegion: "eu-west",   // determines which zone stores this doc
  userId: "user-789",
  name: "Ingrid Larsson",
  country: "SE"
});
```

### Managed Namespaces

```js
// Configure compound shard key with location prefix
sh.shardCollection("myapp.userProfiles", { tenantRegion: 1, _id: 1 });

// Add zone ranges
sh.addTagRange(
  "myapp.userProfiles",
  { tenantRegion: "us-east", _id: MinKey },
  { tenantRegion: "us-east", _id: MaxKey },
  "US_EAST_ZONE"
);

sh.addTagRange(
  "myapp.userProfiles",
  { tenantRegion: "eu-west", _id: MinKey },
  { tenantRegion: "eu-west", _id: MaxKey },
  "EU_WEST_ZONE"
);
```

### Latency Benefits

| Without Global Clusters        | With Global Clusters             |
|---------------------------------|----------------------------------|
| EU user hits US primary        | EU user hits EU-local primary    |
| ~120ms cross-Atlantic latency  | ~10ms local latency              |
| GDPR: EU data stored in US     | GDPR: EU data stays in EU        |

**Interview answer:** each zone corresponds to a cloud region (e.g., `eu-west-1`). Shard key ranges are mapped to zones using `sh.addTagRange`. When a document is inserted or updated, the balancer ensures it lives only on shards tagged for its zone, and reads are routed to the local zone's primary for low latency — satisfying both performance and GDPR data-residency requirements at once.

> **Memory hook:** "Global Clusters are a chain of local branch offices, not one headquarters everyone has to call long-distance."

---

## 9. Hands-On Exercises

### Exercise 1 — Atlas Search with Compound + Facets

Set up a product search endpoint that:
- Searches `title` and `description` with English analyzer
- Boosts documents where `rating >= 4.5`
- Filters out `outOfStock: true` documents
- Returns `$searchMeta` facets for `category` and price buckets `[0,50,100,200,500]`

```js
// Your solution here
db.products.aggregate([
  {
    $search: {
      index: "productsIndex",
      compound: {
        must: [
          { text: { query: "<USER_QUERY>", path: ["title", "description"] } }
        ],
        mustNot: [
          { equals: { path: "outOfStock", value: true } }
        ],
        should: [
          { range: { path: "rating", gte: 4.5, score: { boost: { value: 2 } } } }
        ]
      }
    }
  },
  { $project: { title: 1, price: 1, rating: 1, score: { $meta: "searchScore" } } },
  { $limit: 20 }
]);
```

---

### Exercise 2 — Vector Search RAG Pipeline

1. Create a `knowledgeBase` collection with documents: `{ text: "...", embedding: [...] }`
2. Generate embeddings with any LLM API and store them
3. Create a vector search index on `embedding` with `numDimensions: 1536`, `similarity: cosine`
4. Write a function `semanticSearch(question)` that embeds the query and returns the top 3 most relevant chunks

---

### Exercise 3 — Database Trigger: Real-Time Inventory Alert

Write a database trigger on `products` collection that fires on `update`. When `stock` drops below 10:
- Inserts a document into `lowStockAlerts` collection
- Calls a webhook URL via `context.http.post`

---

### Exercise 4 — Scheduled Trigger: Weekly Report

Write a scheduled trigger (cron: `0 8 * * 1` — Monday 8am UTC) that:
- Aggregates the past week's orders by `status`
- Calculates total revenue for `status: "completed"`
- Inserts a weekly summary into `weeklyReports`

---

### Exercise 5 — Global Cluster Simulation

Design a shard key and zone mapping for a multi-region SaaS application where:
- US customers' data must stay in `us-east-1`
- EU customers' data must stay in `eu-west-1`
- APAC customers' data must stay in `ap-southeast-1`
- Each document has a `region` field

Write the `sh.shardCollection`, `sh.addTagRange` commands, and explain how reads and writes are routed.

---

## 10. Interview Q&A

**Q1: How does Atlas Search differ from a standalone Elasticsearch cluster?**
Answer: Atlas Search embeds the Lucene engine as a sidecar process (`mongot`) directly on Atlas nodes, so there is no separate infrastructure to provision, scale, or keep in sync. Change streams automatically propagate document changes from `mongod` to `mongot`. Elasticsearch requires a separate cluster, custom connectors, and manual sync logic, adding operational complexity.

**Q2: What is the difference between `$search` and `$searchMeta`?**
Answer: `$search` returns matching documents scored by relevance and is used for full-text query results. `$searchMeta` returns only metadata — counts and facet distributions — without returning documents themselves. Use `$searchMeta` for sidebar filter panels that show "Electronics (42)" style counts.

**Q3: Explain the `compound` operator's clause types.**
Answer: `must` requires a match and contributes to score. `mustNot` requires non-match and does not score. `should` is optional but boosts score if matched. `filter` requires a match (like a pre-filter) but contributes zero to score, making it ideal for hard constraints like price range or availability.

**Q4: What are vector embeddings and why store them in MongoDB?**
Answer: Embeddings are dense float arrays (e.g., 1536-dimensional) that capture semantic meaning of text, images, or other data. Storing them alongside the source documents in MongoDB lets you perform hybrid search — combining vector ANN (approximate nearest-neighbor) results with traditional MongoDB filters in a single pipeline, avoiding the need for a separate vector database.

**Q5: What is `numCandidates` in `$vectorSearch` and how does it affect recall vs. latency?**
Answer: `numCandidates` controls how many candidate vectors the HNSW graph traversal examines before selecting the top `limit` results. A higher ratio of `numCandidates` to `limit` improves recall (finds more truly similar results) at the cost of longer query time. For production, 10-15x `numCandidates` vs `limit` is a common starting point.

**Q6: When would you use the Atlas Data API instead of a native driver?**
Answer: The Data API is best when a native driver is impractical — for example in mobile clients where you want to avoid exposing a connection string, in third-party no-code tools, or in serverless webhook handlers where a driver's connection pooling adds cold-start overhead. For high-throughput applications, native drivers offer lower latency, batching, and session support.

**Q7: What types of Atlas Triggers exist and how do they differ?**
Answer: Database triggers fire in response to change stream events (insert, update, delete, replace) on a specific collection. Scheduled triggers fire on a cron schedule regardless of data changes, useful for periodic jobs like daily reports or cleanup tasks. Both execute serverless Atlas Functions written in JavaScript.

**Q8: What is PITR (Point-in-Time Recovery) and how does it work in Atlas?**
Answer: PITR allows restoring a cluster to any second within the configured window (default 24 hours). Atlas continuously streams oplog entries to cloud storage. To restore, Atlas first restores the nearest preceding snapshot, then replays oplog operations up to the target timestamp — similar to how PostgreSQL WAL-based recovery works.

**Q9: How does Global Cluster zone sharding enforce data residency?**
Answer: Each zone corresponds to a cloud region (e.g., `eu-west-1`). Shard key ranges are mapped to zones using `sh.addTagRange`. When a document is inserted or updated, the balancer ensures it lives only on shards tagged for its zone. Reading is routed to the local zone's primary for low latency, satisfying both performance and GDPR data-residency requirements.

**Q10: What are the limitations of Atlas Triggers?**
Answer: Atlas Functions have a 120-second execution timeout and are single-threaded JavaScript. They cannot maintain persistent state between invocations (use Atlas App Services Values/Secrets for config). High-frequency change streams can cause trigger backlog if function execution is slower than the event rate — in that case, consider batching with `$match` filters or migrating logic to a dedicated application service.

**Q11: How do you secure the Atlas Data API?**
Answer: The Data API supports API Key authentication (server-to-server), Email/Password (user-facing), and JWT (custom auth providers). API keys can be scoped to read-only or read-write roles, and IP access lists restrict which IPs can call the endpoint. Always use HTTPS; the Data API does not support plaintext HTTP.

**Q12: Can Atlas Vector Search be combined with Atlas Search in one pipeline?**
Answer: Not directly in a single `$search` or `$vectorSearch` stage, but you can combine them using `$unionWith` or by running both queries and merging results in the application. Alternatively, the `$vectorSearch` filter parameter handles pre-filtering on scalar fields, and `$search` handles full-text. Hybrid search (combining BM25 + vector) is an emerging pattern typically handled at the application layer with Reciprocal Rank Fusion (RRF).

**Q13: What is the difference between Atlas Search `filter` and `mustNot`?**
Answer: `filter` is a positive constraint — the document must match the filter clause, but the match contributes zero to the relevance score. `mustNot` is a negative constraint — documents matching the mustNot clause are excluded entirely. Use `filter` for hard constraints like "in-stock only" and `mustNot` for exclusions like "not discontinued."

**Q14: How do Atlas Charts handle real-time data?**
Answer: Charts queries the Atlas cluster on demand when a dashboard is loaded or refreshed, so data is always current. You can configure a refresh interval on charts (minimum 1 minute for hosted dashboards). For sub-minute freshness you would embed the Charts SDK and call `chart.setRefreshInterval()`, or use a custom application dashboard with direct driver queries.

**Q15: Describe a production RAG architecture using Atlas Vector Search.**
Answer: Documents are chunked (e.g., 500-token paragraphs), embedded via an embedding model (OpenAI, Cohere, or local), and stored with their vectors in Atlas. A vector search index (HNSW) is created on the embedding field. At query time, the user's question is embedded, `$vectorSearch` retrieves the top-k semantically similar chunks with optional scalar pre-filters (date range, category), and the chunks are injected into an LLM prompt as context. The LLM generates a grounded answer citing the retrieved chunks, reducing hallucinations.
