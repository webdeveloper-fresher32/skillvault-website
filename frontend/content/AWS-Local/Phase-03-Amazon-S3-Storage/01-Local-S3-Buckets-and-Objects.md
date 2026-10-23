# Local S3 Buckets and Objects — Complete Guide

> "A safe deposit box in a bank vault stores valuable documents and items; each box is identified by a unique number, and you must present a key to retrieve the contents."

---

## Table of Contents

1. [The Problem: Latency and Cost of Cloud Asset Pipelines](#1-the-problem-latency-and-cost-of-cloud-asset-pipelines)
2. [The Safe Deposit Box Analogy](#2-the-safe-deposit-box-analogy)
3. [The Mechanism: Local Path-Style Addressing](#3-the-mechanism-local-path-style-addressing)
4. [Diagram: Path-Style vs. Virtual-Hosted-Style Routing](#4-diagram-path-style-vs-virtual-hosted-style-routing)
5. [Code Walkthrough: Node.js S3 CRUD and Pre-signed URLs](#5-code-walkthrough-node-js-s3-crud-and-pre-signed-urls)
6. [Comparing Local S3 to Live AWS S3](#6-comparing-local-s3-to-live-aws-s3)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Latency and Cost of Cloud Asset Pipelines

When building modern web applications (like MERN stack apps), managing and testing media uploads (avatars, PDFs, image attachments) is a core requirement.

### Live Storage Cost Boundaries

Testing these upload flows directly on AWS S3 creates real billing costs. Every read, write, and list operation adds up. Additionally, developers can easily run up bandwidth costs if they upload large binary files during load testing.

### Latency in Development Loops

Uploading a 5MB image to an S3 bucket in a remote region (e.g. `ap-south-1`) during debugging can take several seconds depending on internet speed. This slows down the hot-reload developer cycle, making rapid UI and backend testing frustrating.

---

## 2. The Safe Deposit Box Analogy

A bank vault houses rows of safe deposit boxes. Each box is assigned a unique box number (the key) and holds folders, papers, or valuables (the value).

### Key-Value Storage

To retrieve an item, you go to the bank, request box `1042`, and present your key. You do not search the bank room; you pull the exact box directly. This matches the S3 flat key-value object model.

### Pre-signed Access Passes

If you want a courier to pick up a document from your box, you don't give them your master key. Instead, you sign a temporary access ticket that is only valid for 1 hour. This matches the concept of S3 pre-signed URLs.

---

## 3. The Mechanism: Local Path-Style Addressing

In live AWS, S3 uses virtual-hosted-style URLs by default: `https://my-bucket.s3.amazonaws.com/image.png`. The bucket name is part of the domain name itself.

### The Host Resolution Obstacle

On your local machine, pointing a DNS domain like `my-bucket.localhost` to port `4566` is difficult to automate because DNS resolvers do not support wildcards for localhost out of the box.

### Path-Style Fallback

To bypass this DNS resolution issue, local emulators like Floci route S3 buckets using path-style addressing: `http://localhost:4566/my-bucket/image.png`. The bucket name becomes a path segment. The S3 client must be configured with `forcePathStyle: true` so the SDK correctly constructs the URLs for local execution.

---

## 4. Diagram: Path-Style vs. Virtual-Hosted-Style Routing

### The Routing Decision

```text
Virtual-Hosted-Style Routing (Default AWS):
  URL: https://my-bucket.s3.us-east-1.amazonaws.com/image.png
       ├───────┘                                    └───────┤
      Subdomain (Bucket)                           Object Key
  (Requires DNS server lookup for the dynamic subdomain)

Path-Style Routing (Used Locally for Floci):
  URL: http://localhost:4566/my-bucket/image.png
       ├───────────────────┘ ├───────┘ └───────┤
             Host             Bucket   Object Key
  (Resolves instantly to localhost; Floci parses bucket name from path)
```

### Strategic Settings

By forcing path style in your development environment, you allow local S3 libraries to bypass DNS lookups and resolve routes instantly.

---

## 5. Code Walkthrough: Node.js S3 CRUD and Pre-signed URLs

The following script initializes the S3 client using path-style addressing, creates a bucket, uploads a text object, reads it, and generates a temporary pre-signed URL.

### Node.js S3 Operations Script

```js
// s3-crud-demo.js
import { S3Client, CreateBucketCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  forcePathStyle: true, // Crucial setting for local emulation to bypass subdomain DNS
  credentials: { accessKeyId: "mock-key", secretAccessKey: "mock-secret" }
});

async function runS3Demo() {
  const bucketName = "local-media-bucket";
  const keyName = "documents/test.txt";

  try {
    // 1. Create a Bucket
    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log(`Bucket '${bucketName}' created.`);

    // 2. Put an Object
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: keyName,
      Body: "Hello from local AWS storage!",
      ContentType: "text/plain"
    }));
    console.log("Object uploaded successfully.");

    // 3. Generate a Pre-signed URL for downloads (valid for 60 seconds)
    const command = new GetObjectCommand({ Bucket: bucketName, Key: keyName });
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    console.log("Generated Pre-signed URL:\n", presignedUrl);
  } catch (error) {
    console.error("S3 Demo error:", error);
  }
}

runS3Demo();
```

### Pre-signed Upload URL Pattern

In production, you often want users to upload files directly to S3 without routing the file binaries through your Node.js backend. This can be accomplished using a PUT pre-signed URL:

```js
// s3-upload-presigned.js
async function generateUploadUrl(bucket, key) {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "image/png" });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  console.log(`Upload URL (Use PUT request with binary image body): ${uploadUrl}`);
  return uploadUrl;
}
```

---

## 6. Comparing Local S3 to Live AWS S3

### S3 Parity Matrix

| Feature | Live AWS S3 | Local S3 (Floci) |
|---|---|---|
| Addressing Mode | Virtual-Hosted (default) | Path-style (forcePathStyle: true) |
| Read/Write Cost | Charged per request (GET/PUT) | 100% Free |
| Object Versioning | Supported (durable history) | Supported (in-memory mock metadata) |
| Pre-signed URLs | Generates authentic HTTPS links | Generates local HTTP loopback links |
| Storage Classes | Standard, Intelligent, Glacier | Mapped to local storage (no tier features) |
| Lifecycle Rules | Moves to Glacier / Deletes | Simulates API calls (no background cleanup) |

---

## 7. Common Mistakes

- **Forgetting `forcePathStyle: true` in the SDK.** The SDK will construct URLs like `http://my-bucket.localhost:4566/image.png`, which will fail to resolve in the browser or code, throwing connection timeout errors.
- **Using localhost URLs in external web pages.** Sharing a local S3 pre-signed URL (e.g. `http://localhost:4566/...`) with external users won't work, because `localhost` refers to their own computer, not your development server.
- **Neglecting to configure CORS for frontend uploads.** If your React app uploads directly to S3 via pre-signed URLs, you must configure a local S3 CORS policy, or the browser will block the request.

---

## 8. Hands-On Exercises

**Exercise 1:** Initialize a Node.js project, install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`, and execute the script from Section 5.

**Exercise 2:** Create a local S3 bucket, upload a simple HTML page as `index.html`, and configure static website hosting using the CLI command `aws s3 website`.

**Exercise 3:** Write a script that lists all objects in a bucket and deletes any objects older than a specific date threshold (simulating a basic lifecycle policy).

**Exercise 4:** Enable versioning on a local bucket (`aws s3api put-bucket-versioning`), upload two different versions of the same key, and retrieve both.

**Exercise 5:** Verify the generated pre-signed URL from Exercise 1 using `curl -i "<url>"` in your terminal. Check the status code and text response output.

---

## 9. Interview Q&A

**Q: Why is `forcePathStyle: true` required when configuring an S3 client for local emulators?**
By default, the AWS SDK constructs URLs using virtual-hosted style (e.g. `http://bucket.s3.amazonaws.com`). Locally, DNS engines cannot resolve wildcards like `*.localhost` to your Floci container out of the box. Setting `forcePathStyle: true` changes the URL format to `http://localhost:4566/bucket`, allowing requests to resolve correctly.

**Q: What is an S3 pre-signed URL, and how does it work?**
A pre-signed URL is a temporary URL that grants access to an S3 object (read or write) using the credentials of the user who generated it. It includes security query parameters (signature, expiration, key). This allows clients (like web browsers) to upload or download files directly to/from S3 securely without exposing master credentials.

**Q: How does object versioning work in S3, and how can it prevent accidental data loss?**
When versioning is enabled, S3 retains all versions of an object (including overwrite and delete actions). A deletion creates a "Delete Marker" as the current version; you can still retrieve earlier versions using their unique version ID, preventing permanent accidental deletion.

**Q: What are S3 Lifecycle Policies, and why are they used?**
Lifecycle Policies automate the management of objects over time. They define rules to transition objects to cheaper storage classes (like Glacier) or delete them permanently after a specific number of days, helping optimize storage costs without manual script execution.

**Q: How do you enable public read access on a specific folder in S3 while keeping the rest private?**
You apply an S3 Bucket Policy (a JSON policy document) that allows the `s3:GetObject` action for the Principal `*` on the specific resource path prefix (e.g., `arn:aws:s3:::my-bucket/public/*`), while keeping no policy or explicit denies on private folders.
