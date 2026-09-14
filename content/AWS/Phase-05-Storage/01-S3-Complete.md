# S3 (Simple Storage Service) — The Ultimate Guide

## Table of Contents
1. [What is S3](#what-is-s3)
2. [Storage Types Comparison](#storage-types-comparison)
3. [Buckets and Objects](#buckets-and-objects)
4. [Bucket Configuration](#bucket-configuration)
5. [Storage Classes](#storage-classes)
6. [Lifecycle Rules](#lifecycle-rules)
7. [S3 Security](#s3-security)
8. [S3 Features](#s3-features)
9. [S3 Replication](#s3-replication)
10. [S3 Performance](#s3-performance)
11. [Hands-On Labs](#hands-on-labs)
12. [Interview Q&A](#interview-qa)

---

## What is S3

Amazon S3 (Simple Storage Service) is AWS's object storage service. Launched in 2006, it was one of AWS's first services and remains one of the most important.

**Core concept:**
- Store any amount of data
- Access from anywhere on the internet
- Pay only for what you use
- Industry-leading durability: **99.999999999% (11 nines)**

**What S3 is NOT:**
- NOT a file system (no hierarchy, no lock mechanisms)
- NOT a block device (cannot mount it like a hard drive directly)
- NOT a database (no querying by value without S3 Select)

---

## Storage Types Comparison

```
OBJECT STORAGE (S3)
+----------------------------------------+
|  Flat namespace, access via HTTP/REST  |
|  Key → Value pairs                     |
|  Each object up to 5 TB                |
|  Infinitely scalable                   |
|  Best for: images, videos, backups,    |
|  static assets, data lakes             |
+----------------------------------------+

BLOCK STORAGE (EBS, Instance Store)
+----------------------------------------+
|  Raw disk blocks                       |
|  Mounted as volume to OS               |
|  Formatted with filesystem (ext4, xfs) |
|  Fixed size (must provision upfront)   |
|  Best for: OS disks, databases,        |
|  applications needing low latency      |
+----------------------------------------+

FILE STORAGE (EFS, FSx)
+----------------------------------------+
|  Traditional hierarchical filesystem   |
|  Mounted via NFS / SMB protocol        |
|  Shared across multiple servers        |
|  Auto-scales                           |
|  Best for: shared configs, CMS,        |
|  home directories, container storage   |
+----------------------------------------+
```

**Analogy:**
- Block storage = blank hard drive
- File storage = shared network drive at work
- Object storage = Google Drive / Dropbox

---

## Buckets and Objects

### Buckets

A bucket is a container for objects. Think of it like a top-level folder.

**Key rules:**
- Bucket names are **globally unique** across all AWS accounts
- Bucket is **region-specific** — data stays in that region unless you replicate
- Bucket names must be 3-63 characters, lowercase, no underscores
- Unlimited number of objects per bucket
- Unlimited total storage per bucket
- Maximum 100 buckets per account (can request increase to 1000)

**Bucket naming examples:**
```
VALID:
  my-company-data-prod
  ganesh-website-assets-2024
  logs.myapp.com

INVALID:
  My-Bucket          (uppercase)
  my_bucket          (underscore)
  192.168.1.1        (IP address format)
  xn--bucket         (starts with xn--)
```

### Objects

An object is the fundamental entity stored in S3.

**Object components:**

```
+--------------------------------------------------+
|                    S3 OBJECT                     |
+--------------------------------------------------+
| KEY        | photos/vacation/beach.jpg            |
|            | (the "path" — unique within bucket)  |
+--------------------------------------------------+
| VALUE      | The actual data (bytes)              |
|            | Size: 0 bytes to 5 TB                |
+--------------------------------------------------+
| VERSION ID | abc123xyz (if versioning enabled)    |
+--------------------------------------------------+
| METADATA   | Content-Type: image/jpeg             |
|            | Last-Modified: 2024-01-15            |
|            | Custom: x-amz-meta-author: ganesh    |
+--------------------------------------------------+
| TAGS       | Environment: prod                    |
|            | Project: myapp                       |
+--------------------------------------------------+
| ACL        | (Legacy access control)              |
+--------------------------------------------------+
```

**Important facts about objects:**
- Max single object size: **5 TB**
- Max single PUT: **5 GB** (must use multipart upload for objects > 5 GB, recommended for > 100 MB)
- Object key is the full "path" — `photos/vacation/beach.jpg` — but S3 is actually flat; the "/" is just part of the key name

### S3 URL Formats

```
Virtual-hosted style (preferred):
https://bucket-name.s3.region.amazonaws.com/key

Example:
https://my-website.s3.ap-southeast-2.amazonaws.com/index.html

Path-style (deprecated, being retired):
https://s3.region.amazonaws.com/bucket-name/key

Example:
https://s3.ap-southeast-2.amazonaws.com/my-website/index.html

Static website URL:
http://bucket-name.s3-website.region.amazonaws.com
or
http://bucket-name.s3-website-region.amazonaws.com
```

---

## Bucket Configuration

### Bucket Policies

Bucket policies are **resource-based policies** written in JSON. They control who can access your bucket and objects.

**Structure:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StatementIdentifier",
      "Effect": "Allow",                    // or "Deny"
      "Principal": "*",                     // who (IAM user, role, account, or *)
      "Action": ["s3:GetObject"],           // what operations
      "Resource": "arn:aws:s3:::my-bucket/*" // which resources
    }
  ]
}
```

**Common bucket policy examples:**

1. Make all objects publicly readable:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-website-bucket/*"
    }
  ]
}
```

2. Allow only specific IAM role to upload:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/MyAppRole"
      },
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::my-bucket/*"
    }
  ]
}
```

3. Deny access from specific IP (security):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "NotIpAddress": {
          "aws:SourceIp": "203.0.113.0/24"
        }
      }
    }
  ]
}
```

4. Force HTTPS only:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

### ACLs (Access Control Lists)

ACLs are a legacy mechanism predating IAM. AWS recommends using bucket policies and IAM policies instead.

**States:**
- **Disabled (recommended)** — Object ownership is enforced, ACLs ignored
- **Bucket owner preferred** — New objects written by other accounts become bucket owner's objects
- **Object writer** — Object uploader becomes owner

**Predefined ACLs (Canned ACLs):**
```
private                — Owner has full control (default)
public-read            — Anyone can read
public-read-write      — Anyone can read and write (DANGEROUS)
bucket-owner-read      — Bucket owner can read
bucket-owner-full-control — Bucket owner has full control
aws-exec-read          — EC2 and S3 can read
authenticated-read     — Authenticated AWS users can read
```

### Block Public Access Settings

Four independent settings that provide a safety net:

```
+----------------------------------------------------------+
|           BLOCK PUBLIC ACCESS SETTINGS                    |
+----------------------------------------------------------+
| [x] Block all public access (master switch)              |
|     |                                                     |
|     +-> [x] BlockPublicAcls                              |
|     |       Block new public ACLs                        |
|     |                                                     |
|     +-> [x] IgnorePublicAcls                             |
|     |       Ignore existing public ACLs                  |
|     |                                                     |
|     +-> [x] BlockPublicPolicy                            |
|     |       Block new public bucket policies             |
|     |                                                     |
|     +-> [x] RestrictPublicBuckets                        |
|             Restrict existing public bucket policies     |
+----------------------------------------------------------+
```

**Rule of thumb:** Unless hosting a public website, leave all four ENABLED.

### Versioning

Versioning keeps multiple variants of an object in the same bucket.

**States:**
- **Unversioned** (default) — Objects have no version ID
- **Versioning-enabled** — All objects get a version ID
- **Versioning-suspended** — New objects get null version ID; existing versions preserved

**How it works:**

```
BEFORE VERSIONING:
bucket/
  └── photo.jpg (current)

AFTER ENABLING VERSIONING:
PUT photo.jpg (v1)  →  photo.jpg  version: 111aaa
PUT photo.jpg (v2)  →  photo.jpg  version: 222bbb  ← current
DELETE photo.jpg    →  photo.jpg  DELETE MARKER     ← current
                       photo.jpg  version: 222bbb
                       photo.jpg  version: 111aaa
```

**Important versioning facts:**
- Once enabled, versioning **cannot be disabled** — only suspended
- DELETE without specifying version ID adds a delete marker (soft delete)
- DELETE with version ID permanently deletes that version
- All versions incur storage costs
- Versioning is required for replication

**MFA Delete:**
- Adds extra layer of protection
- Requires MFA token to:
  - Change versioning state
  - Permanently delete a versioned object
- Only bucket owner (root account) can enable MFA Delete
- Enable via CLI: `aws s3api put-bucket-versioning --mfa "arn:aws:iam::123456789012:mfa/MyDevice 123456"`

### Object Lock

Implements **WORM** (Write Once Read Many) for compliance.

**Retention modes:**
- **Governance mode** — Users with special IAM permissions can override
- **Compliance mode** — Nobody (including root) can delete or modify until retention period expires

**Legal hold:**
- No expiration date
- Can be placed/removed by users with `s3:PutObjectLegalHold` permission

**Use cases:**
- Financial record retention (SEC, FINRA regulations)
- Healthcare data retention (HIPAA)
- Legal hold for litigation

---

## Storage Classes

This is one of the most important topics for AWS exams and cost optimization.

### Complete Storage Class Comparison

```
+---------------------------+----------+-------------+----------+-----------+----------------+
| Storage Class             | Min      | Retrieval   | First    | Storage   | Availability   |
|                           | Duration | Time        | Byte     | Cost      | Zones          |
+---------------------------+----------+-------------+----------+-----------+----------------+
| S3 Standard               | None     | Milliseconds| None     | $$$       | >= 3           |
| S3 Intelligent-Tiering    | None     | ms-hours    | None     | $$$+fee   | >= 3           |
| S3 Standard-IA            | 30 days  | Milliseconds| Per GB   | $$        | >= 3           |
| S3 One Zone-IA            | 30 days  | Milliseconds| Per GB   | $         | 1              |
| S3 Glacier Instant Ret.   | 90 days  | Milliseconds| Per GB   | $         | >= 3           |
| S3 Glacier Flexible Ret.  | 90 days  | 1-12 hours  | Per GB   | Very $    | >= 3           |
| S3 Glacier Deep Archive   | 180 days | 12-48 hours | Per GB   | Cheapest  | >= 3           |
+---------------------------+----------+-------------+----------+-----------+----------------+

Durability: ALL classes = 99.999999999% (11 nines)
```

### S3 Standard

```
+----------------------------------+
|         S3 STANDARD              |
+----------------------------------+
| Durability:   99.999999999%      |
| Availability: 99.99%             |
| AZs:          >= 3               |
| Min Storage:  None               |
| Retrieval:    None               |
| First Byte:   Milliseconds       |
+----------------------------------+
| USE WHEN:                        |
| - Frequently accessed data       |
| - Unknown access patterns        |
| - Active workloads               |
| - Serving website content        |
| - Big data analytics             |
+----------------------------------+
```

### S3 Intelligent-Tiering

Automatically moves objects between tiers based on access patterns. Ideal when access patterns are unpredictable.

```
+-----------------------------------------------+
|        S3 INTELLIGENT-TIERING                 |
+-----------------------------------------------+
| Tiers (automatic movement):                   |
|                                               |
| [Frequent Access Tier]                        |
|   └── 0-30 days without access               |
|           ↓ (automatic)                       |
| [Infrequent Access Tier]                      |
|   └── 30-90 days without access              |
|           ↓ (optional, requires opt-in)       |
| [Archive Instant Access Tier]                 |
|   └── 90+ days without access                |
|           ↓ (optional, requires opt-in)       |
| [Archive Access Tier]          90-270 days    |
| [Deep Archive Access Tier]     180+ days      |
+-----------------------------------------------+
| Monthly monitoring fee per object             |
| No retrieval fees                             |
| Good for: data lakes, user-generated content  |
+-----------------------------------------------+
```

### S3 Standard-IA (Infrequent Access)

```
+----------------------------------+
|      S3 STANDARD-IA              |
+----------------------------------+
| Durability:   99.999999999%      |
| Availability: 99.9%              |
| AZs:          >= 3               |
| Min Storage:  30 days            |
| Min Object:   128 KB             |
| Retrieval:    Per GB fee         |
| First Byte:   Milliseconds       |
+----------------------------------+
| USE WHEN:                        |
| - Data accessed monthly          |
| - Disaster recovery              |
| - Backups                        |
| - Long-term storage with         |
|   occasional access              |
+----------------------------------+
| AVOID WHEN:                      |
| - Small files (< 128 KB)        |
| - Frequently accessed           |
| - Short-lived data              |
+----------------------------------+
```

### S3 One Zone-IA

Same as Standard-IA but stored in a **single Availability Zone**.

```
+----------------------------------+
|      S3 ONE ZONE-IA              |
+----------------------------------+
| Durability:   99.999999999%      |
|   (within single AZ)            |
| Availability: 99.5%              |
| AZs:          1 (ONE ONLY)       |
| Min Storage:  30 days            |
| Cost:         ~20% less than IA  |
+----------------------------------+
| USE WHEN:                        |
| - Secondary backup copies        |
| - Re-creatable data              |
| - Cross-region replication       |
|   target (source exists)        |
| - Dev/test data                  |
+----------------------------------+
| RISK:                            |
| - AZ destruction = data loss     |
| - NOT for critical/primary data  |
+----------------------------------+
```

### S3 Glacier Instant Retrieval

```
+----------------------------------+
|   GLACIER INSTANT RETRIEVAL      |
+----------------------------------+
| Retrieval:    Milliseconds       |
| Min Storage:  90 days            |
| Cost:         ~68% less than IA  |
| Per-request:  Higher than IA     |
+----------------------------------+
| USE WHEN:                        |
| - Medical images (accessed       |
|   once per quarter)              |
| - News media assets              |
| - Genomics data                  |
+----------------------------------+
```

### S3 Glacier Flexible Retrieval (formerly S3 Glacier)

```
+----------------------------------+
|   GLACIER FLEXIBLE RETRIEVAL     |
+----------------------------------+
| Retrieval options:               |
|   Expedited:   1-5 minutes       |
|   Standard:    3-5 hours         |
|   Bulk:        5-12 hours (free) |
| Min Storage:  90 days            |
| Cost:         Very low           |
+----------------------------------+
| USE WHEN:                        |
| - Archival data                  |
| - Regulatory compliance          |
| - Annual access                  |
| - Tape replacement               |
+----------------------------------+
```

### S3 Glacier Deep Archive

```
+----------------------------------+
|   GLACIER DEEP ARCHIVE           |
+----------------------------------+
| Retrieval options:               |
|   Standard: 12 hours             |
|   Bulk:     48 hours             |
| Min Storage:  180 days           |
| Cost:         LOWEST in S3       |
+----------------------------------+
| USE WHEN:                        |
| - 7-10 year retention            |
| - Regulatory/legal archives      |
| - Financial records              |
| - Healthcare records             |
+----------------------------------+
```

### Storage Class Decision Tree

```
Is data accessed frequently?
         |
        YES → S3 Standard
         |
        NO
         |
    Is access pattern unknown?
         |
        YES → S3 Intelligent-Tiering
         |
        NO
         |
    Is millisecond retrieval required?
         |
        YES → Is data critical (multi-AZ needed)?
         |           |
         |          YES → S3 Standard-IA
         |           |
         |          NO → S3 One Zone-IA (if re-creatable)
         |
        NO
         |
    Is occasional rapid retrieval needed (quarterly)?
         |
        YES → S3 Glacier Instant Retrieval
         |
        NO
         |
    Is retrieval within hours acceptable?
         |
        YES → S3 Glacier Flexible Retrieval
         |
        NO (can wait 12-48 hrs, need cheapest)
         |
        YES → S3 Glacier Deep Archive
```

---

## Lifecycle Rules

Lifecycle rules automate the movement and deletion of objects to optimize costs.

### Types of Lifecycle Actions

**1. Transition Actions** — Move objects to a cheaper storage class after N days

```
S3 Standard
    |
    | (after 30 days)
    ↓
S3 Standard-IA
    |
    | (after 90 days)
    ↓
S3 Glacier Flexible Retrieval
    |
    | (after 365 days)
    ↓
S3 Glacier Deep Archive
```

**Transition constraints:**
```
Standard → Standard-IA: min 30 days
Standard → One Zone-IA: min 30 days
Standard-IA → Glacier:  min 30 days in IA
Cannot transition from Glacier back to Standard via lifecycle
```

**2. Expiration Actions** — Delete objects after N days

```json
{
  "Rules": [
    {
      "ID": "DeleteOldLogs",
      "Filter": {
        "Prefix": "logs/"
      },
      "Status": "Enabled",
      "Expiration": {
        "Days": 90
      }
    }
  ]
}
```

### Complete Lifecycle Policy Example

```json
{
  "Rules": [
    {
      "ID": "ArchiveAndDeleteRule",
      "Filter": {
        "Prefix": "documents/"
      },
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        },
        {
          "Days": 365,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ],
      "Expiration": {
        "Days": 2555
      },
      "NoncurrentVersionTransitions": [
        {
          "NoncurrentDays": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 90
      }
    }
  ]
}
```

### Common Lifecycle Scenarios

| Scenario | Rule |
|----------|------|
| Server logs | Delete after 90 days |
| User uploads | Move to IA after 30 days, Glacier after 90 days |
| Compliance data | Archive to Deep Archive after 1 year, delete after 7 years |
| Old versions | Delete noncurrent versions after 30 days |
| Incomplete multipart uploads | Delete after 7 days |

---

## S3 Security

### IAM Policies vs Bucket Policies

```
+------------------------------------------+
|          EVALUATION LOGIC                |
+------------------------------------------+
|                                          |
| Is there an explicit DENY?  →  YES → DENY|
|              ↓ NO                        |
| Is there an explicit ALLOW  →  YES →ALLOW|
| (in either IAM or bucket policy)?        |
|              ↓ NO                        |
|            IMPLICIT DENY                 |
+------------------------------------------+

IAM Policy: Attached to user/role, says "this principal CAN do X on any resource"
Bucket Policy: Attached to bucket, says "this resource ALLOWS X from any principal"

Use IAM policy when: You own both the account and bucket
Use bucket policy when: Granting cross-account access, or managing by resource
```

### Pre-Signed URLs

Pre-signed URLs grant **temporary access** to private S3 objects without making them public.

**How they work:**

```
+----------+                    +----------+                    +----------+
|  Client  |                    |  Backend |                    |    S3    |
+----------+                    +----------+                    +----------+
     |                               |                               |
     | 1. Request to download         |                               |
     |   "photo.jpg"                  |                               |
     |------------------------------>|                               |
     |                               |                               |
     |                               | 2. Generate pre-signed URL    |
     |                               |   (uses own credentials)      |
     |                               |   Expires: 15 minutes         |
     |                               |                               |
     | 3. Return pre-signed URL      |                               |
     |<------------------------------|                               |
     |                               |                               |
     | 4. GET pre-signed URL         |                               |
     |-------------------------------------------------------------->|
     |                               |                               |
     |                               |          5. Verify signature  |
     |                               |             Return object     |
     | 6. Receive object             |                               |
     |<--------------------------------------------------------------|
```

**Generating pre-signed URL (CLI):**
```bash
# Generate URL valid for 3600 seconds (1 hour)
aws s3 presign s3://my-bucket/secret-doc.pdf --expires-in 3600

# Output:
# https://my-bucket.s3.amazonaws.com/secret-doc.pdf?
#   X-Amz-Algorithm=AWS4-HMAC-SHA256&
#   X-Amz-Credential=...&
#   X-Amz-Date=...&
#   X-Amz-Expires=3600&
#   X-Amz-Signature=...
```

**Generating pre-signed URL (Python SDK):**
```python
import boto3

s3_client = boto3.client('s3')

url = s3_client.generate_presigned_url(
    'get_object',
    Params={
        'Bucket': 'my-bucket',
        'Key': 'secret-doc.pdf'
    },
    ExpiresIn=3600  # 1 hour
)
```

**Pre-signed URL use cases:**
- Allow users to download their own private files
- Allow uploads without giving full S3 access
- Share time-limited access to reports
- Secure file download links in email

**Important pre-signed URL facts:**
- Uses the credentials of whoever generates it
- If IAM role generates it, the URL is valid as long as the role session exists (max 12 hours for assumed roles)
- If IAM user generates it, can be up to 7 days
- Max expiry for console-generated: 12 hours

### CORS Configuration

CORS (Cross-Origin Resource Sharing) allows web browsers to make requests to S3 from a different domain.

**When you need CORS:**
- You host a website at `www.myapp.com`
- That website's JavaScript fetches assets from `assets.s3.amazonaws.com`
- Browser will block this unless CORS is configured

**CORS configuration example:**
```json
[
  {
    "AllowedHeaders": ["Authorization", "Content-Type"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://www.myapp.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## S3 Features

### Static Website Hosting

Host a fully static website directly from S3. No servers needed!

**Step-by-step setup:**

```
Step 1: Create bucket with website name
  Bucket name: www.mysite.com

Step 2: Enable static website hosting
  Console → Bucket → Properties → Static website hosting
  Index document: index.html
  Error document: error.html

Step 3: Disable "Block Public Access"
  All four settings must be unchecked

Step 4: Add bucket policy to allow public read
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::www.mysite.com/*"
  }]
}

Step 5: Upload index.html and other files

Step 6: Access via website endpoint
  http://www.mysite.com.s3-website-ap-southeast-2.amazonaws.com

Step 7 (optional): Configure Route 53 or CloudFront
  Point custom domain → S3 website endpoint
```

**S3 website limitations:**
- HTTP only (HTTPS requires CloudFront)
- Only GET and HEAD requests
- No server-side code

### S3 Transfer Acceleration

Uses CloudFront's edge locations to speed up uploads to S3.

```
WITHOUT TRANSFER ACCELERATION:
User in Tokyo -------- slow internet -------- S3 in us-east-1
                         (long distance)

WITH TRANSFER ACCELERATION:
User in Tokyo → CloudFront Edge → AWS backbone → S3 in us-east-1
                  (Tokyo)          (very fast)
```

**When to use:**
- Users uploading large files from around the world
- Uploads over long geographic distances
- Regularly transferring GBs+ across continents

**Enable:**
```bash
aws s3api put-bucket-accelerate-configuration \
  --bucket my-bucket \
  --accelerate-configuration Status=Enabled
```

**Transfer acceleration URL:**
```
https://bucket-name.s3-accelerate.amazonaws.com/key
```

### Multipart Upload

Required for objects > 5 GB. Recommended for objects > 100 MB.

```
MULTIPART UPLOAD PROCESS:

Large File (10 GB)
        |
   Split into parts
        |
+-------+-------+-------+-------+
| Part1 | Part2 | Part3 | Part4 |
| 2.5GB | 2.5GB | 2.5GB | 2.5GB |
+-------+-------+-------+-------+
    |       |       |       |
    |       |       |       |   (upload in parallel)
    ↓       ↓       ↓       ↓
+-----------------------------------+
|            S3 Bucket              |
|   Part1  Part2  Part3  Part4      |
|            ↓                      |
|       Complete Multipart          |
|       Upload API call             |
|            ↓                      |
|       Assembled Object (10 GB)    |
+-----------------------------------+
```

**Benefits:**
- Retry failed parts without restarting entire upload
- Parallel upload increases throughput
- Start upload before knowing final size

**Lifecycle rule tip:** Create a lifecycle rule to abort incomplete multipart uploads after N days to avoid paying for orphaned parts.

### S3 Select

Query S3 objects with SQL-like syntax. Reduces data transfer by returning only needed data.

```
WITHOUT S3 SELECT:
S3 Downloads entire CSV (1 GB) → Application filters for needed rows

WITH S3 SELECT:
S3 Filters rows server-side → Returns only matching rows (10 MB)

↑ Up to 400% faster, 80% less cost
```

**Example:**
```python
response = s3_client.select_object_content(
    Bucket='my-bucket',
    Key='sales-data.csv',
    ExpressionType='SQL',
    Expression="SELECT * FROM s3object WHERE sale_amount > 1000",
    InputSerialization={'CSV': {'FileHeaderInfo': 'Use'}},
    OutputSerialization={'CSV': {}}
)
```

**Supported formats:** CSV, JSON, Parquet (with compression: GZIP, BZIP2)

### Event Notifications

Trigger actions when objects are created, deleted, or modified.

```
+----------+     +----------+     +----------+
|          |     |          |     |          |
|    S3    |---->|  Lambda  |---->| Process  |
|  Bucket  |     | Function |     | Image    |
|          |     |          |     |          |
+----------+     +----------+     +----------+

+----------+     +----------+     +----------+
|          |     |          |     |          |
|    S3    |---->|   SQS    |---->|  Worker  |
|  Bucket  |     |  Queue   |     |  Service |
|          |     |          |     |          |
+----------+     +----------+     +----------+

+----------+     +----------+     +----------+
|          |     |          |     |          |
|    S3    |---->|   SNS    |---->|  Email/  |
|  Bucket  |     |  Topic   |     |  Webhook |
|          |     |          |     |          |
+----------+     +----------+     +----------+
```

**Event types:**
- `s3:ObjectCreated:*` — Any object creation
- `s3:ObjectCreated:Put` — Only PUTs
- `s3:ObjectRemoved:*` — Any deletion
- `s3:ObjectRestore:*` — Glacier restore
- `s3:Replication:*` — Replication events

**EventBridge integration:** Send all S3 events to EventBridge for more advanced routing, filtering, and integration.

---

## S3 Replication

Replicate objects between S3 buckets automatically and asynchronously.

### Cross-Region Replication (CRR)

```
+------------------+           +------------------+
|   Source Bucket  |           |   Dest Bucket    |
|   us-east-1      |  -------> |   ap-southeast-2 |
|                  | Replicate |                  |
+------------------+           +------------------+
```

**Use cases:**
- Compliance requirements (store data in multiple regions)
- Latency reduction (get data closer to users)
- Disaster recovery (cross-region redundancy)
- Data sovereignty requirements

### Same-Region Replication (SRR)

```
+------------------+           +------------------+
|   Source Bucket  |           |   Dest Bucket    |
|   us-east-1      |  -------> |   us-east-1      |
|   (prod account) | Replicate |   (log aggregate)|
+------------------+           +------------------+
```

**Use cases:**
- Aggregate logs from multiple source buckets
- Live replication between prod and test accounts
- Compliance (keep copy within same region)

### Replication Requirements and Details

```
REQUIREMENTS:
  ✓ Versioning must be enabled on BOTH source and destination
  ✓ IAM role must be created with replication permissions
  ✓ Destination bucket must exist

WHAT IS REPLICATED:
  ✓ New objects after replication is enabled
  ✓ Existing objects (using Batch Replication separately)
  ✓ Object metadata
  ✓ ACLs
  ✓ Tags

WHAT IS NOT REPLICATED:
  ✗ Delete markers (by default, configurable)
  ✗ Deletions of specific object versions
  ✗ Objects in Glacier/Deep Archive
  ✗ Objects encrypted with customer-managed CMK (requires extra config)

REPLICATION TIME CONTROL (RTC):
  - Optional add-on
  - 99.99% of objects replicated within 15 minutes
  - Provides replication metrics
  - Good for compliance requirements
```

---

## S3 Performance

### Request Rate Limits

```
Per prefix per second:
  3,500 PUT/COPY/POST/DELETE
  5,500 GET/HEAD

"Prefix" = everything before the last slash in the key

Example:
  Key: photos/2024/summer/beach.jpg
  Prefix: photos/2024/summer/

Multiple prefixes = multiple limits:
  photos/jan/  → 5,500 GET/s
  photos/feb/  → 5,500 GET/s
  photos/mar/  → 5,500 GET/s
  Total:       16,500 GET/s
```

### Prefix Design for Performance

**Bad prefix design (all objects in one prefix):**
```
bucket/images/img001.jpg   ←┐
bucket/images/img002.jpg   ← These all share the
bucket/images/img003.jpg   ← same prefix!
bucket/images/img004.jpg   ←┘
Limit: 5,500 GET/s total
```

**Good prefix design (spread across prefixes):**
```
bucket/images/a/img001.jpg  ← prefix: images/a/  → 5,500 GET/s
bucket/images/b/img002.jpg  ← prefix: images/b/  → 5,500 GET/s
bucket/images/c/img003.jpg  ← prefix: images/c/  → 5,500 GET/s
bucket/images/d/img004.jpg  ← prefix: images/d/  → 5,500 GET/s
Total: 22,000 GET/s
```

**Historical note:** Old guidance said to add random prefixes to key names (e.g., `abc123-photo.jpg`) to avoid hot spots. Since 2018, S3 automatically scales and this is no longer necessary.

### S3 Byte-Range Fetches

Download specific byte ranges of an object in parallel:

```
Object: large-video.mp4 (10 GB)

Request 1: bytes 0-2,499,999,999        (first 2.5 GB)
Request 2: bytes 2,500,000,000-4,999,999,999
Request 3: bytes 5,000,000,000-7,499,999,999
Request 4: bytes 7,500,000,000-9,999,999,999

All in parallel → faster download
```

Also useful for downloading just the header of a file (first N bytes).

---

## Hands-On Labs

### Lab 1: Create Bucket and Upload File

```bash
# Create bucket (use unique name)
aws s3 mb s3://my-unique-bucket-ganesh-2024 --region ap-southeast-2

# Upload a file
aws s3 cp localfile.txt s3://my-unique-bucket-ganesh-2024/

# Upload with storage class
aws s3 cp archive.zip s3://my-unique-bucket-ganesh-2024/ \
  --storage-class STANDARD_IA

# List objects
aws s3 ls s3://my-unique-bucket-ganesh-2024/

# Download file
aws s3 cp s3://my-unique-bucket-ganesh-2024/localfile.txt ./downloaded.txt

# Sync directory
aws s3 sync ./local-folder s3://my-unique-bucket-ganesh-2024/folder/
```

### Lab 2: Enable Static Website Hosting

```bash
# Enable website hosting
aws s3 website s3://my-unique-bucket-ganesh-2024 \
  --index-document index.html \
  --error-document error.html

# Create simple index.html
cat > index.html << 'EOF'
<html>
<body><h1>Hello from S3!</h1></body>
</html>
EOF

# Upload index.html
aws s3 cp index.html s3://my-unique-bucket-ganesh-2024/

# Set bucket policy for public access (first disable block public access in console)
aws s3api put-bucket-policy \
  --bucket my-unique-bucket-ganesh-2024 \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-unique-bucket-ganesh-2024/*"
    }]
  }'
```

### Lab 3: Generate Pre-Signed URL

```bash
# Upload a private file
aws s3 cp private-doc.pdf s3://my-unique-bucket-ganesh-2024/

# Generate pre-signed URL (valid 1 hour)
aws s3 presign s3://my-unique-bucket-ganesh-2024/private-doc.pdf \
  --expires-in 3600

# Test the URL
curl -o downloaded.pdf "PASTE_PRESIGNED_URL_HERE"
```

### Lab 4: Set Lifecycle Policy

```bash
# Create lifecycle policy file
cat > lifecycle.json << 'EOF'
{
  "Rules": [
    {
      "ID": "MoveToGlacier",
      "Filter": {"Prefix": "archive/"},
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
EOF

# Apply lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-unique-bucket-ganesh-2024 \
  --lifecycle-configuration file://lifecycle.json

# Verify
aws s3api get-bucket-lifecycle-configuration \
  --bucket my-unique-bucket-ganesh-2024
```

---

## Interview Q&A

### Q1: What is the difference between S3 Standard-IA and S3 One Zone-IA?

**Answer:** Both classes are for infrequently accessed data with identical durability (11 nines) and retrieval times (milliseconds). The key difference is that Standard-IA stores data redundantly across a minimum of 3 Availability Zones, while One Zone-IA stores data in only 1 AZ, making it about 20% cheaper but vulnerable to data loss if that AZ is destroyed. Use One Zone-IA only for data that can be easily recreated (like thumbnails or cross-region replication targets where the source data still exists in another region).

---

### Q2: A company needs to access archived data within minutes, not hours. They want the lowest cost option. Which Glacier tier should they use?

**Answer:** **S3 Glacier Instant Retrieval**. Despite being called "Glacier," it provides millisecond retrieval times — the same as S3 Standard or Standard-IA. It is the cheapest option that provides immediate access. Glacier Flexible Retrieval (1-12 hours) and Glacier Deep Archive (12-48 hours) are cheaper but have much longer retrieval times.

---

### Q3: What is the difference between a bucket policy and an IAM policy?

**Answer:**
- **IAM Policy** is an identity-based policy attached to a user, group, or role. It specifies what that identity CAN DO across AWS resources.
- **Bucket Policy** is a resource-based policy attached to an S3 bucket. It specifies who can access THAT bucket.

Both can grant or deny S3 access. Use an IAM policy when managing permissions centrally for your users. Use a bucket policy when granting cross-account access, or when you want to manage access by resource rather than by identity. Both are evaluated together — access is granted if either allows it (assuming no explicit deny).

---

### Q4: Can you disable versioning once enabled?

**Answer:** **No.** Once versioning is enabled on an S3 bucket, it cannot be disabled — it can only be **suspended**. When suspended, new objects receive a version ID of "null," but all existing versioned objects retain their version IDs. This is a deliberate design choice to prevent accidental data loss.

---

### Q5: How does S3 achieve 11 nines of durability?

**Answer:** S3 stores data redundantly across a minimum of 3 Availability Zones within a region (for Standard, IA, and Glacier classes). When you upload an object, S3 automatically stores multiple copies across different physical facilities. The 11 nines durability means if you store 10 million objects, you can expect to lose on average 1 object every 10,000 years. Note: One Zone-IA only replicates within one AZ but still has 11 nines durability within that AZ.

---

### Q6: What is the maximum size of an S3 object and how do you upload large files?

**Answer:** The maximum size of a single S3 object is **5 TB**. However, a single PUT operation can upload at most **5 GB**. For files larger than 5 GB, you MUST use **Multipart Upload**. AWS recommends multipart upload for files larger than 100 MB because it allows:
- Parallel upload of parts for better throughput
- Retry individual failed parts without restarting
- Begin uploading before knowing the final object size

---

### Q7: What is a pre-signed URL and when would you use it?

**Answer:** A pre-signed URL is a URL that grants temporary, time-limited access to a private S3 object. It's generated by an entity that has access to the object, and contains authentication parameters embedded in the URL. The URL is valid until the expiration time.

**Use cases:**
1. Allow authenticated users to download their private files (e.g., invoices)
2. Allow file uploads without giving uploader direct S3 access
3. Share temporary links to private content via email
4. Mobile apps uploading directly to S3 without going through your server

---

### Q8: What is S3 Transfer Acceleration and when should you use it?

**Answer:** S3 Transfer Acceleration speeds up uploads by routing data through CloudFront's globally distributed edge locations. Instead of uploading directly to S3 (which may be in a distant region), data goes to the nearest CloudFront edge location first, then travels over AWS's optimized global backbone network to S3.

**Use when:**
- Users are geographically distant from the S3 bucket's region
- Uploading large files (GB or more)
- Consistently slow upload speeds

**Cost:** You only pay the extra acceleration fee if Transfer Acceleration is actually faster than the direct route.

---

### Q9: What are the requirements for S3 Cross-Region Replication?

**Answer:**
1. **Versioning must be enabled** on both the source and destination buckets
2. **IAM role** must be created with permissions to replicate (read from source, write to destination)
3. **Destination bucket** must exist (in a different region for CRR)
4. The buckets can be in the same or different AWS accounts

Important: Replication only applies to objects uploaded AFTER replication is enabled. Existing objects require a separate **S3 Batch Replication** job. Also, delete markers are NOT replicated by default (configurable).

---

### Q10: How do S3 lifecycle rules work? Give an example.

**Answer:** S3 lifecycle rules automatically transition objects to cheaper storage classes or delete them based on their age. Rules have two action types:

**Transition actions:** Move objects to a cheaper storage class after N days
**Expiration actions:** Delete objects after N days

Example for application logs:
- After 0 days: S3 Standard (immediate access needed)
- After 30 days: S3 Standard-IA (accessed less frequently)
- After 90 days: S3 Glacier Flexible Retrieval (almost never accessed)
- After 365 days: Delete (logs older than a year aren't needed)

This can reduce storage costs by 70-90% for long-lived data.

---

### Q11: What is the difference between CRR and SRR?

**Answer:**
- **CRR (Cross-Region Replication):** Replicates objects to a bucket in a **different AWS region**. Used for compliance/data sovereignty requirements, disaster recovery, or reducing latency for global users.
- **SRR (Same-Region Replication):** Replicates objects to a bucket in the **same AWS region**. Used for log aggregation from multiple buckets, replication between production and test accounts, or maintaining a copy for compliance without geographic separation.

Both require versioning enabled on source and destination.

---

### Q12: What is S3 Object Lock and what is WORM compliance?

**Answer:** S3 Object Lock implements **WORM (Write Once Read Many)** compliance, preventing objects from being deleted or modified for a specified retention period or indefinitely.

Two retention modes:
- **Governance mode:** Users with special IAM permissions (`s3:BypassGovernanceRetention`) can override the lock
- **Compliance mode:** NOBODY — not even the root account — can delete or modify the object until the retention period expires

Use cases: Financial records (SEC requires 6 years), healthcare records (HIPAA), legal evidence preservation.

---

### Q13: A company has a website at myapp.com that fetches images from an S3 bucket. Users are getting CORS errors. How do you fix it?

**Answer:** Configure CORS on the S3 bucket to allow requests from `myapp.com`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedOrigins": ["https://myapp.com"],
    "MaxAgeSeconds": 3000
  }
]
```

CORS errors occur because the browser's same-origin policy blocks requests from `myapp.com` to a different origin (the S3 bucket URL). The S3 bucket must respond with the appropriate `Access-Control-Allow-Origin` header, which is configured via the CORS settings.

---

### Q14: What is the difference between S3 durability and availability?

**Answer:**
- **Durability (11 nines):** The probability that your data will not be lost. 99.999999999% means you'd expect to lose 1 object per 10,000 years if storing 10 million objects. This is about data integrity.
- **Availability:** The probability the service is accessible when you need it. S3 Standard offers 99.99% availability (~52 minutes downtime/year). Standard-IA is 99.9% (~8.7 hours/year).

You can have high durability and lower availability — your data is safe, but sometimes the service to access it is briefly unavailable.

---

### Q15: How does S3 Intelligent-Tiering work and when is it cost-effective?

**Answer:** S3 Intelligent-Tiering monitors access patterns and automatically moves objects between tiers:
- **Frequent Access tier:** Actively accessed objects
- **Infrequent Access tier:** Objects not accessed for 30 days
- **Archive Instant Access tier:** Objects not accessed for 90 days (opt-in)

Charges a monthly monitoring fee per object (~$0.0025 per 1,000 objects). This fee makes it **cost-effective for objects larger than 128 KB** with unpredictable access patterns. For very small objects or objects with predictable patterns, it may be cheaper to manually set the storage class.

---

### Q16: What happens when you delete an object in a versioning-enabled bucket?

**Answer:** S3 adds a **delete marker** — a special object version with no data. The delete marker becomes the "current" version, and the object appears deleted when you list the bucket normally. The previous versions are still there and can be restored by deleting the delete marker or specifying the old version ID.

To permanently delete an object, you must either:
1. Delete the specific version IDs (including the delete marker)
2. Use `aws s3api delete-object --bucket NAME --key KEY --version-id ID`

This is intentional — versioning protects against accidental deletion.

---

### Q17: What S3 storage class would you choose for disaster recovery backups that might need to be restored urgently but are accessed less than once per year?

**Answer:** **S3 Glacier Instant Retrieval** — because:
- It has millisecond retrieval (critical for urgent DR scenarios)
- Significantly cheaper than Standard-IA (about 68% cheaper)
- Designed for data accessed ~once per quarter or less
- Multi-AZ durability (11 nines)

If the budget is extremely tight and you can wait 1-5 minutes, S3 Glacier Flexible Retrieval with Expedited retrieval is another option, but for true disaster recovery you want instant access.

---

### Q18: How do you host a static website on S3 with HTTPS?

**Answer:** S3 static website hosting natively only supports HTTP. To enable HTTPS:

1. Enable static website hosting on S3
2. Create a CloudFront distribution pointing to the S3 bucket (use the S3 REST endpoint, not website endpoint, for Origin Access Control)
3. Configure an SSL certificate in AWS Certificate Manager (ACM) in us-east-1
4. Attach the ACM certificate to the CloudFront distribution
5. Configure CloudFront to redirect HTTP → HTTPS
6. Point your domain in Route 53 to the CloudFront distribution

This gives you HTTPS, better performance (CDN caching), and lower S3 costs.

---

### Q19: What are the performance limits of S3 and how do you design around them?

**Answer:** S3 supports **3,500 PUT/COPY/POST/DELETE** and **5,500 GET/HEAD** requests **per prefix per second**.

To design around these limits:
- Use multiple prefixes to multiply the effective throughput
- For 100,000 GET/s, you need at least 19 different prefixes
- Historical guidance was to use random prefixes (e.g., hash-based), but since 2018 S3 auto-scales and this is no longer required for most workloads

For download performance: use **S3 Byte-Range Fetches** to download different parts of large objects in parallel.

---

### Q20: What is the difference between S3 event notifications and S3 EventBridge integration?

**Answer:**
- **S3 Event Notifications (classic):** Sends events directly to Lambda, SQS, or SNS. Limited filtering (prefix/suffix). Less flexible.
- **S3 EventBridge:** All S3 events are sent to EventBridge, which provides advanced filtering, routing to 18+ AWS service destinations, event replay, and cross-account event delivery. Recommended for new implementations.

EventBridge is more powerful but S3 Event Notifications are simpler for basic Lambda triggers.

---

### Q21: What is S3 Select and when should you use it?

**Answer:** S3 Select allows you to run SQL queries on CSV, JSON, or Parquet files stored in S3, and only returns the matching data rather than the entire object.

**Use when:**
- You store large data files in S3 and only need a subset
- You want to filter data server-side to reduce data transfer costs
- Processing analytics on S3-stored data

**Example:** A 1 GB CSV of sales data — instead of downloading all 1 GB and filtering in your app, S3 Select returns only the rows matching your SQL WHERE clause, potentially saving 90%+ in data transfer costs and processing time.

**Alternatives:** Amazon Athena for more complex queries, AWS Glue for ETL.
