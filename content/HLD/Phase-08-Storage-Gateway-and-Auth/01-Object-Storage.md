# Object Storage

Imagine your Instagram-clone backend lets users upload a profile picture. The obvious first instinct is: "I have a `users` table, I'll just add a `profile_image` column and store the image bytes there." It works in a demo with three users. It falls apart the moment real traffic hits it — and almost every "design a system with media" interview question is quietly testing whether you know why.

## The Problem: Images Don't Belong in SQL

```
❌ Storing the image INSIDE the database

┌─────────────────────────────────────────────┐
│ users table                                  │
├────┬──────────────┬───────────────────────────┤
│ id │ email         │ profile_image (BLOB)      │
├────┼──────────────┼───────────────────────────┤
│ 1  │ asha@x.com    │ <2.3 MB of raw JPEG bytes> │
│ 2  │ ravi@x.com    │ <1.8 MB of raw JPEG bytes> │
└────┴──────────────┴───────────────────────────┘

- Every "SELECT * FROM users" now drags megabytes across the wire
- DB backups balloon in size and take longer
- DB replication (Phase 05) has to ship binary blobs to every replica
- Your database — the thing you scale most carefully — is doing a job
  a dumb file store would do better and cheaper
```

Relational databases are optimized for structured, queryable, relatively small rows. A JPEG or an MP4 is neither structured nor small, and you never run `WHERE` clauses against the bytes of an image. Storing it in Postgres or MySQL wastes the one resource (the database) that's hardest and most expensive to scale.

## The Fix: Object Storage + a URL in the Database

```
✅ Images → Cloud Storage → URL stored in Database

   Client                Backend                  Object Storage
     │                       │                     (S3 / GCS / Azure Blob)
     │  1. POST /upload      │                            │
     │──────────────────────▶│                            │
     │   (image bytes)       │  2. PUT the file           │
     │                       │───────────────────────────▶│
     │                       │                            │
     │                       │  3. storage returns a URL  │
     │                       │◀───────────────────────────│
     │                       │
     │                       │  4. save URL in DB row
     │                       │     users.profile_image =
     │                       │     "https://cdn.x.com/u/1/avatar.jpg"
     │                       │
     │  5. 200 OK + URL      │
     │◀──────────────────────│
```

The database now stores a tiny string (a URL), not megabytes of binary data. The schema looks exactly like the roadmap's example:

```
user.profile_image → "https://storage.example.com/avatars/user-1.jpg"
```

That's it — one `VARCHAR` column, indexed like any other, instead of a BLOB column that makes every table scan painful.

## What Object Storage Actually Is

Object storage systems — Amazon S3, Google Cloud Storage (GCS), Azure Blob Storage, or self-hosted options like MinIO — store arbitrary "objects" (files) under a flat key (like a path), and hand you back a URL to retrieve them. They are:

- **Not a filesystem** in the POSIX sense — no directories with permissions, just keys and values (though keys often *look* like paths: `avatars/user-1.jpg`).
- **Built for massive, cheap, durable storage** — S3 is designed for "eleven nines" (99.999999999%) of durability, something you'd never attempt to replicate yourself.
- **Served directly to clients**, often through a CDN in front of the bucket, so your backend never has to stream image bytes back out itself.

A minimal upload endpoint (pseudocode, provider-agnostic — swap in `boto3` for S3, the GCS client library, etc.):

```python
from fastapi import FastAPI, UploadFile
import uuid

app = FastAPI()

def upload_to_object_storage(file_bytes: bytes, key: str) -> str:
    """Uploads bytes to the configured bucket and returns a public URL."""
    bucket.put_object(Key=key, Body=file_bytes)          # e.g. boto3 S3 client
    return f"https://cdn.example.com/{key}"

@app.post("/users/{user_id}/avatar")
async def upload_avatar(user_id: int, file: UploadFile):
    contents = await file.read()
    key = f"avatars/{user_id}-{uuid.uuid4()}.jpg"
    url = upload_to_object_storage(contents, key)

    # Only the URL — never the bytes — gets written to the database
    db_update_user_profile_image(user_id, url)

    return {"profile_image": url}
```

## The Follow-Up Optimization: Presigned URLs

In the flow above, every uploaded byte still passes *through* your backend server on its way to storage — the backend is a middleman doing nothing but relaying data. At scale (users uploading videos, not 50KB avatars), that middleman becomes a bottleneck: it ties up backend connections and bandwidth for something it isn't actually doing any work on.

The fix is a **presigned URL**: your backend asks the object storage provider for a short-lived, signed URL that grants *temporary, direct* upload (or download) permission to one specific client, without exposing your storage credentials.

```
1. Client → Backend:      "I want to upload a file"
2. Backend → Storage:     "Give me a presigned PUT URL for key X" (using backend's credentials)
3. Storage → Backend:     signed URL, valid for e.g. 5 minutes
4. Backend → Client:      here's the signed URL
5. Client → Storage:      uploads the file bytes DIRECTLY (bypasses the backend entirely)
6. Client → Backend:      "done — here's the key/URL, save it to my profile"
```

The backend's bandwidth is no longer spent moving file bytes at all — it only issues a short-lived permission slip. This is the standard pattern for any system that expects large or frequent uploads (Phase 11's Google Drive case study leans on this directly).

## Interview Q&A

**Q: Why shouldn't you store images or videos directly in a relational database?**
Answer: Binary blobs are large, unstructured, and never queried by content, so storing them in SQL bloats table scans, slows backups, and forces replication (Phase 05) to ship megabytes of binary data to every replica for no benefit. Object storage is purpose-built for large binary objects at a much lower cost and higher durability, so the database should only ever store a small URL/key pointing at the object.

**Q: What's actually stored in the database when a user uploads a profile picture?**
Answer: Just a string — the URL (or storage key) returned by the object storage provider, e.g. `user.profile_image = "https://cdn.example.com/avatars/user-1.jpg"`. The actual image bytes live in S3/GCS/Azure Blob/MinIO, not in any database row.

**Q: What is a presigned URL and why would you use one?**
Answer: A presigned URL is a short-lived, signed URL issued by the object storage provider that grants a specific client temporary permission to upload or download a specific object directly, without needing storage credentials of their own. It's used to avoid routing large file bytes through your own backend server, which would otherwise burn backend bandwidth and connections acting as a pure middleman.

**Q: Would you use object storage for something like a user's JSON preferences blob, or just for media files?**
Answer: No — small structured data like JSON preferences belongs in the database (or a JSON column) where it can be queried, indexed, and updated atomically alongside other user data. Object storage is for large, opaque binary content (images, videos, PDFs, backups) that you never need to query by content and that would be expensive to keep in a relational table.

**Q: How does a CDN relate to object storage?**
Answer: A CDN sits in front of the object storage bucket and caches objects at edge locations close to users, so repeated reads of the same file (a profile picture viewed by thousands of followers) don't all hit the origin storage bucket directly. This is a caching layer conceptually similar to Phase 06's Redis caching, just applied to static files instead of database rows — and it's exactly what a system like YouTube or Netflix (Phase 10) relies on for video delivery.
