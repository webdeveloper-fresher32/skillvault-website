# Local DynamoDB Tables and Queries — Complete Guide

> "A library's card catalog organizes books by author, subject, or title; you lookup the catalog card to find the exact shelf location of the book instead of scanning every shelf in the building."

---

## Table of Contents

1. [The Problem: Provisioned Throughput and Live NoSQL Prototyping](#1-the-problem-provisioned-throughput-and-live-nosql-prototyping)
2. [The Library Card Catalog Analogy](#2-the-library-card-catalog-analogy)
3. [The Mechanism: Single-Table Key Structures and Local Execution](#3-the-mechanism-single-table-key-structures-and-local-execution)
4. [Diagram: DynamoDB Partition Key and Sort Key Hierarchy](#4-diagram-dynamodb-partition-key-and-sort-key-hierarchy)
5. [Code Walkthrough: Node.js DynamoDB CRUD and GSI Queries](#5-code-walkthrough-node-js-dynamodb-crud-and-gsi-queries)
6. [Comparing Local DynamoDB to Live AWS DynamoDB](#6-comparing-local-dynamodb-to-live-aws-dynamodb)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Provisioned Throughput and Live NoSQL Prototyping

Designing database schemas in SQL relies on normalized tables and runtime JOIN operations. In contrast, DynamoDB requires pre-planned queries, denormalized data models, and specific key-value partitions.

### The Financial Risk of Scans

In public AWS DynamoDB, you pay for Read Capacity Units (RCUs) and Write Capacity Units (WCUs). Running inefficient operations (such as `Scan`) on a large table consumes massive RCUs, which can result in unexpected charges if your code triggers search queries in a loop.

### Slow Table Iteration

During development, schemas change frequently. In live AWS, deleting a table, recreating it, adding secondary indexes (GSIs), and waiting for active status takes several minutes. This latency disrupts the flow of developers who are prototyping APIs.

---

## 2. The Library Card Catalog Analogy

A library stores thousands of books. Searching every book shelf to find a specific title is a slow process that damages performance.

### Structured Keys

Instead of scanning shelves, you visit the card catalog cabinet. The cards are arranged by author name (the Partition Key) and then by title (the Sort Key). Finding "Stephen King" (PK) and looking up "The Shining" (SK) takes seconds.

### Alternate Indexes

If you only know the book's genre, the author-title cards are useless. You need a separate cabinet sorted by genre (a Global Secondary Index). This secondary cabinet references the author and title, letting you locate the book on the main shelf.

---

## 3. The Mechanism: Single-Table Key Structures and Local Execution

DynamoDB is a key-value and document database. Unlike MongoDB, which handles dynamic queries on any field, DynamoDB requires you to query data using the primary keys (PK/SK) or secondary indexes.

### Partitioning Mechanics

The Partition Key (PK) is hashed to determine which physical storage partition holds the item. The Sort Key (SK) determines the physical sorting order within that partition, enabling range queries (e.g. `begins_with` or `between`).

### Local Index Deployment

In local emulators like Floci, DynamoDB tables run on an embedded database engine (like SQLite or DynamoDB Local). You can create tables and indexes instantly via port `4566`. The engine parses the JSON schemas and runs Query and Scan commands without validating throughput capacity parameters (RCUs/WCUs), simplifying local testing.

---

## 4. Diagram: DynamoDB Partition Key and Sort Key Hierarchy

### Key-Value Data Layout

```text
Table Data Layout (Single-Table Design):
  PK (Partition Key)  │ SK (Sort Key)     │ Attributes (JSON Data)
  ────────────────────┼───────────────────┼───────────────────────────────
  USER#1002           │ PROFILE           │ { name: "Alice", email: "..." }
  USER#1002           │ ORDER#8821        │ { date: "2026-08-26", total: 45 }
  USER#1002           │ ORDER#9041        │ { date: "2026-08-27", total: 120 }
  PRODUCT#501         │ DETAILS           │ { name: "Macbook Pro M4", price: 1999 }

  (Querying PK="USER#1002" returns Alice's profile AND all her orders in one fetch)
```

### Strategic Advantage

By querying a single partition, you avoid expensive joins and retrieve related data in a single round-trip, optimizing speed and reducing cost.

---

## 5. Code Walkthrough: Node.js DynamoDB CRUD and GSI Queries

The following Node.js script initializes the `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` clients, creates a table, inserts a user profile, and queries it.

### Local Table Creation via AWS CLI

Before running the Node.js script, you must create the table using the AWS CLI:

```bash
# create-table.sh
aws dynamodb create-table \
    --table-name local-users-table \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url=http://localhost:4566
```

### Node.js DynamoDB CRUD Script

```js
// dynamodb-local-demo.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const rawClient = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "mock-key", secretAccessKey: "mock-secret" }
});

// Document client automatically marshals/unmarshals Javascript types to DynamoDB Attributes
const ddbDocClient = DynamoDBDocumentClient.from(rawClient);

async function runDynamoDemo() {
  const tableName = "local-users-table";

  try {
    // 1. Insert an Item (MERN style record)
    await ddbDocClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: "USER#Alice",
        SK: "METADATA",
        Email: "alice@example.com",
        CreatedDate: "2026-08-26",
        Role: "Developer"
      }
    }));
    console.log("Item inserted into local DynamoDB.");

    // 2. Query the partition
    const queryResponse = await ddbDocClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ":pk": "USER#Alice",
        ":sk": "METADATA"
      }
    }));
    console.log("Query Result:", queryResponse.Items);
  } catch (error) {
    console.error("DynamoDB Demo error:", error.message);
  }
}

runDynamoDemo();
```

---

## 6. Comparing Local DynamoDB to Live AWS DynamoDB

### DynamoDB Parity Matrix

| Feature | Live AWS DynamoDB | Local DynamoDB (Floci) |
|---|---|---|
| Billing | Pay-per-request / Provisioned | 100% Free |
| Client Marshalling | Required (or use DocumentClient) | Same (identical SDK client support) |
| Query Latency | 5ms - 15ms | <1ms (local loopback) |
| Read/Write Limits | Throttles on exceeding capacity | Ignores RCU/WCU limits |
| Global Secondary Indexes | Billing per GSI; provisioning lag | Instant creation; no charge |
| Stream Triggers | Triggers Lambda via event source | Supported locally via local events |

---

## 7. Common Mistakes

- **Using Scan instead of Query.** A `Scan` searches the entire database table sequentially, whereas a `Query` checks only the partition matching the key. Relying on scans in development masks performance issues that break production under load.
- **Forgetting to marshall data manually when not using DocumentClient.** The raw DynamoDB client expects attributes in the form of `{ Name: { S: "Alice" } }` instead of `{ Name: "Alice" }`, throwing type errors.
- **Mismatching PK/SK attribute types during table creation.** If the table schema defines `PK` as a String (`S`), attempting to query with a Number causes key-validation errors.

---

## 8. Hands-On Exercises

**Exercise 1:** Initialize a Node.js project, install `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`, and run the script from Section 5.

**Exercise 2:** Create the table locally using the CLI command `aws dynamodb create-table` with `PK` (String) as Partition Key and `SK` (String) as Sort Key.

**Exercise 3:** Write a script that inserts 5 mock order records for a user, then uses a `Query` command to retrieve only the orders matching a specific price range.

**Exercise 4:** Create a Global Secondary Index (GSI) named `EmailGSI` on your local table using the CLI, enabling search queries by email address instead of user ID.

**Exercise 5:** Set up a local test script that timing-benchmarks 1,000 writes to the local DynamoDB container and prints the average latency.

---

## 9. Interview Q&A

**Q: What is the difference between Query and Scan operations in DynamoDB?**
A `Query` finds items based on primary key values (PK and optionally SK), checking only the specific partition holding that data. A `Scan` reads every single item in the entire table sequentially. Queries are highly efficient and predictable, while Scans are slow, resource-heavy, and expensive on large datasets.

**Q: Why should you use the DynamoDBDocumentClient class instead of the raw DynamoDBClient in Node.js?**
The raw client requires you to format data using DynamoDB type descriptors (e.g. `{ name: { S: "Alice" } }`). The `DynamoDBDocumentClient` automatically marshals standard JavaScript objects to DynamoDB format during writes, and unmarshals them back to standard JS objects during reads, simplifying code.

**Q: What is Single-Table Design in DynamoDB, and why is it used?**
Single-Table Design is the practice of storing multiple different entity types (e.g. users, orders, products) in a single DynamoDB table. By using generic key names (like `PK` and `SK`) and structured prefix namespaces (like `USER#123` or `ORDER#456`), you can fetch related entities in a single Query request, avoiding the need for SQL-style joins.

**Q: What is a Global Secondary Index (GSI), and how does it differ from a Local Secondary Index (LSI)?**
A GSI allows you to query a table using an alternate partition key and sort key, and can be created or modified at any time. An LSI uses the same partition key as the parent table but a different sort key, and must be defined during table creation.

**Q: How does Time to Live (TTL) work in DynamoDB, and how is it useful?**
TTL automatically deletes items after a timestamp attribute has passed. The application sets an epoch timestamp on the item (e.g. session expiration), and DynamoDB deletes it in the background within a couple of days, optimizing storage space without code-level cron jobs.
