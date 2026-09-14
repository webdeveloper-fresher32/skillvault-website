# Stage 6: Object Storage for Media

**Pairs with:** [`Phase-08-Storage-Gateway-and-Auth/01-Object-Storage.md`](../Phase-08-Storage-Gateway-and-Auth/01-Object-Storage.md)

## Where We Left Off

By Stage 5 the backend has: JWT-protected FastAPI routes, a Postgres `User`/`Post` schema via SQLAlchemy, a Redis cache-aside layer in front of `GET /posts`, and a Celery worker generating post thumbnails in the background. The one thing still wrong: when a user uploads an image, we've been treating it as a file saved next to the app (or worse, base64-stuffed into a Postgres column). That doesn't scale, doesn't survive a redeploy, and can't be served efficiently to millions of readers.

## Why Now

Phase 08 Lesson 01 makes the point directly: **images don't belong inside your primary database**. A `Post.image_url` column should hold a URL, not bytes. The actual bytes belong in object storage — S3 in production, and for a fully local, runnable stage, **MinIO** (an S3-compatible server you can run in Docker). This stage swaps local-disk/DB-blob storage for MinIO, exactly mirroring the `user.profile_image → https://...` pattern from that lesson.

## Step 1: Run MinIO Locally

```bash
docker run -d \
  --name minio \
  -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

- Port `9000` is the S3-compatible API endpoint.
- Port `9001` is the web console (open `http://localhost:9001` and log in with `minioadmin` / `minioadmin` to see uploaded files).

Create the bucket once (via the console, or the `mc` CLI):

```bash
docker run --rm --network host \
  minio/mc alias set local http://localhost:9000 minioadmin minioadmin
docker run --rm --network host \
  minio/mc mb local/instagram-clone-media
```

## Step 2: Install the S3 Client

```bash
pip install boto3
```

## Step 3: Wire Up a Storage Module

Create `storage.py`:

```python
import uuid
import boto3
from botocore.client import Config

MINIO_ENDPOINT = "http://localhost:9000"
MINIO_ACCESS_KEY = "minioadmin"
MINIO_SECRET_KEY = "minioadmin"
BUCKET_NAME = "instagram-clone-media"

s3 = boto3.client(
    "s3",
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    config=Config(signature_version="s3v4"),
    region_name="us-east-1",
)


def upload_image(file_bytes: bytes, content_type: str) -> str:
    """Uploads raw image bytes and returns a public URL for the object."""
    key = f"posts/{uuid.uuid4()}.jpg"
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    # MinIO served locally — in production this would be the S3/CloudFront URL.
    return f"{MINIO_ENDPOINT}/{BUCKET_NAME}/{key}"
```

Make the bucket publicly readable for this local demo (production would use presigned URLs or a CDN in front instead — see Phase 08 Lesson 01's note on presigned URLs):

```bash
docker run --rm --network host \
  minio/mc anonymous set download local/instagram-clone-media
```

## Step 4: Update `main.py` — Accept a File Upload

```python
from fastapi import FastAPI, Depends, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from models import Post
from auth import get_current_user
from storage import upload_image
from tasks import generate_thumbnail

app = FastAPI()


@app.post("/posts")
def create_post(
    caption: str,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    image_bytes = image.file.read()
    image_url = upload_image(image_bytes, image.content_type)

    post = Post(user_id=current_user.id, caption=caption, image_url=image_url)
    db.add(post)
    db.commit()
    db.refresh(post)

    generate_thumbnail.delay(post.id, image_url)  # Stage 5's Celery task

    return {"id": post.id, "caption": post.caption, "image_url": post.image_url}
```

Note what changed from Stage 5: `image_url` is no longer a client-supplied string — it's produced by `upload_image()` after the bytes actually land in MinIO. The `Post` row only ever stores a URL, never image bytes.

## Run It

```bash
pip install fastapi uvicorn sqlalchemy psycopg2-binary redis celery boto3 python-multipart
uvicorn main:app --reload
```

## Verify

```bash
# 1. Log in (from Stage 2) to get a token
TOKEN=$(curl -s -X POST http://localhost:8000/login \
  -d "username=alice@example.com&password=hunter2" | jq -r .access_token)

# 2. Upload a post with an image file
curl -X POST http://localhost:8000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -F "caption=Sunset from the rooftop" \
  -F "image=@./sunset.jpg"

# Response:
# {"id": 1, "caption": "Sunset from the rooftop",
#  "image_url": "http://localhost:9000/instagram-clone-media/posts/<uuid>.jpg"}

# 3. Fetch the returned URL directly — it should return the raw image bytes
curl -I "http://localhost:9000/instagram-clone-media/posts/<uuid>.jpg"
# HTTP/1.1 200 OK
# Content-Type: image/jpeg
```

If the `HEAD` request in step 3 returns `200 OK` with an image `Content-Type`, the object is genuinely stored in MinIO and reachable by URL — exactly the `Images → Cloud Storage → URL stored in Database` flow from Phase 08 Lesson 01.

## What's Still Missing

The app still runs as a single process on a single port with a single Postgres/Redis. Stage 7 puts a load balancer in front of multiple copies of this app.
