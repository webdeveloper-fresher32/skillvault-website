# Design YouTube

YouTube's hard problem isn't storing videos — it's the gap between "a video was just uploaded" and "a video is watchable, at the right quality, on a phone with a weak connection, anywhere in the world." That gap is a whole async pipeline, and it's the centerpiece of this lesson.

## 1. Requirements

**Functional requirements:**
- Users can upload a video with a title/description.
- Uploaded videos become available for streaming in multiple quality levels (resolutions/bitrates).
- Viewers can watch videos with playback that adapts to their connection speed.
- View counts are tracked and shown per video.

**Non-functional requirements:**
- **Upload can be slow; playback must not be.** Users tolerate a video "processing" for a while after upload, but will not tolerate buffering during playback — this asymmetry drives the entire architecture.
- **Availability over strict consistency** for view counts (approximate, eventually-consistent counting is fine — nobody needs an exact real-time count).
- **Latency target:** video start (time to first frame) under ~1-2 seconds; adaptive playback with no rebuffering under normal network conditions.
- **Scale target:** design for 500 hours of video uploaded per minute, 2 billion logged-in users watching regularly.

## 2. Back-of-envelope estimation

- Uploads: 500 hours of video/minute → 500 × 60 = 30,000 hours/day of raw footage uploaded.
- Assume average bitrate of raw upload ~5 Mbps → storage for raw uploads alone: 30,000 hours × 3600s × 5 Mbps / 8 ≈ **67 TB/day** of raw video, before any transcoded variants are stored (transcoding into 5-6 resolution/bitrate variants roughly doubles-to-triples total stored bytes per video).
- Views: assume 2 billion users, 10% watch something on a given day, averaging 5 videos/session → 200M × 5 = **1 billion views/day** ≈ 11,600 views/sec average, several times that at peak (evenings, viral spikes).
- **Storage dwarfs compute here** — this is the opposite profile from Twitter's case study, where storage was trivial and fan-out/counting were the hard problems. Every architectural decision below optimizes for "serve enormous binary blobs cheaply and fast," not for transactional correctness.
- View-count writes: 1 billion/day ≈ 11,600 writes/sec if counted naively per view — this is exactly the same "don't hit the DB on every event" problem as Twitter's trending counters, solved the same way (batched, approximate counting).

## 3. High-level architecture

```
        Upload  ───► ┌───────────────┐
                     │ API Gateway    │ ◄─── Watch request
                     └──────┬────────┘
                            │
              ┌─────────────┴─────────────────┐
              ▼                                ▼
     ┌────────────────┐               ┌────────────────────┐
     │ Upload Service    │               │ Video Metadata Service│
     └───────┬────────┘               └──────────┬──────────┘
             │ raw file                             │
     ┌───────▼────────┐               ┌───────────▼───────────┐
     │ Object Storage    │               │ Metadata DB              │
     │ (raw + all variants)│◄──────────────│ (sharded — title,          │
     └───────┬────────┘               │  status, variant URLs)     │
             │                        └────────────────────────┘
     ┌───────▼────────┐
     │ Transcoding Queue  │  (Phase 07 — async, this IS the deep dive below)
     │ + Worker Fleet      │
     └───────┬────────┘
             │ writes transcoded variants back to Object Storage,
             │ updates Metadata DB status → "ready"
             ▼
     ┌────────────────┐
     │ CDN                │  ◄── all playback requests served from here, not origin storage
     └────────────────┘
```

- **Upload Service** accepts the raw file (often via a presigned URL straight to object storage, Phase 08 Lesson 01, so the raw upload bytes never pass through application servers at all).
- **Transcoding Queue + Worker Fleet** is Phase 07's async processing pattern, doing the heaviest lifting in the whole system — this is the deep dive.
- **CDN** is non-negotiable at this scale: origin object storage could never serve billions of daily views directly; it serves the CDN's cache misses, and the CDN serves everyone else.

## 4. Deep dive

### 4.1 Video upload/transcoding pipeline

Nobody watches the raw uploaded file — it's the wrong format, the wrong resolution for most devices, and can't adapt to a viewer's changing network speed mid-playback. The pipeline's job is to turn one raw upload into many ready-to-stream variants, off the request path.

```
1. Client uploads raw video → Object Storage (via presigned URL, bypassing app servers)
2. Upload Service records a Metadata DB row: status = "processing"
3. Upload Service enqueues a transcoding job:

     @app.post("/videos")
     def upload_video(video_id: str):
         process_video.delay(video_id)          # Celery task, Phase 07 L2 pattern
         return {"status": "processing", "video_id": video_id}

4. A Transcoding Worker (one of many, horizontally scaled) picks up the job:

     @celery.task
     def process_video(video_id):
         raw = fetch_from_object_storage(video_id)
         for resolution in ["240p", "480p", "720p", "1080p"]:
             variant = transcode(raw, resolution)          # CPU-heavy step
             upload_to_object_storage(variant, video_id, resolution)
         generate_thumbnail(raw, video_id)
         update_metadata_status(video_id, status="ready")

5. Metadata DB flips to "ready"; the video now appears in search/recommendations and is watchable.
```

- **Why a queue, not synchronous processing?** Transcoding a video into 5-6 resolutions is CPU-intensive and can take minutes for a long video — making the uploader's HTTP request wait for that would time out the connection and tie up a web server thread for minutes per upload. This is the exact video-upload example from Phase 07 Lesson 01, applied literally.
- **Horizontally scaled worker fleet.** Transcoding is embarrassingly parallel across videos (and even across chunks of the same video, in real systems) — more workers directly means more throughput, with no shared state to coordinate, so this scales the way Phase 03 Lesson 01 describes horizontal scaling working best: stateless, parallelizable units of work.
- **Partial availability.** A well-designed pipeline can make lower resolutions available for playback before the highest resolution finishes transcoding, so a viewer isn't blocked on the slowest variant.
- **Failure handling.** If a transcoding job crashes partway (e.g. worker OOMs on a huge file), the job is retried (Phase 07's retry/failure handling) rather than left stuck in "processing" forever — a dead-letter queue with alerting (Phase 09 Lesson 01) catches jobs that fail repeatedly for manual triage.

### 4.2 CDN video delivery

Once variants exist in object storage, playback never talks to origin storage directly for popular content:

```
Viewer requests video ──► CDN edge node (nearest geographically)
                              ├─ cache hit  → serve directly from edge, no origin call
                              └─ cache miss → fetch from origin object storage once,
                                                cache at this edge, serve to viewer
```

- **Adaptive bitrate streaming** (covered in depth in the Netflix lesson next) relies on this same CDN layer serving multiple pre-transcoded quality variants — the player switches between them based on measured network conditions, and every variant it might request is already sitting at the edge.
- **Popular videos get cached at nearly every edge location** (extremely high hit rate); unpopular/old videos may only be cached where someone actually requests them, falling back to origin more often — this is a natural consequence of cache-aside style behavior (Phase 06 Lesson 01) applied geographically.

### 4.3 View-count counting at scale

Incrementing a view counter in the primary Metadata DB on every single view (potentially tens of thousands of writes/sec at peak) would make that database the bottleneck for something that doesn't need to be exact in real time.

```
View event ──► published to a stream/queue (not a direct DB write)
                         │
                         ▼
              Batching Aggregator (accumulates counts in memory/Redis
                                     for a short window, e.g. 1 minute)
                         │
                         ▼
              Periodic flush: UPDATE videos SET view_count = view_count + batched_delta
```

- This is the same pattern as Twitter's trending counters (Phase 10 Lesson 03) applied to a single counter per video instead of per hashtag: don't write to the source of truth on every event, batch and flush periodically.
- The displayed view count can lag reality by seconds to a minute — an acceptable, deliberate trade-off, not an oversight.

## 5. Trade-offs / what breaks at 10x scale

- **Transcoding worker fleet capacity** — at 10x upload volume, the queue backlog grows unless the worker fleet scales proportionally; because transcoding is CPU-bound and parallelizable, this is a straightforward (if expensive) horizontal-scaling fix, but it's the first thing to monitor (Phase 09 Lesson 01's "watch the queue depth, not just CPU" principle).
- **Origin storage egress and CDN cache misses** — at 10x traffic, a larger long-tail of less-popular videos means more cache misses hitting origin storage more often; the fix is a larger/multi-tier CDN cache (regional caches behind edge caches) rather than assuming edge caching alone scales indefinitely.
- **Metadata DB as a single write path for status updates** — at 10x upload volume, even batched status/metadata writes can start to contend; this is where Phase 05 Lesson 03's sharding (by video ID) becomes necessary rather than optional.

## Interview Q&A

**Q: Why can't video transcoding happen synchronously during the upload request?**
Answer: Transcoding into multiple resolutions is CPU-intensive and can take minutes; holding an HTTP connection open that long risks client/gateway timeouts and ties up server resources for the entire duration. Instead, the upload request returns immediately after the raw file is stored and a job is queued, and transcoding happens asynchronously on a separate worker fleet.

**Q: How does adaptive bitrate streaming relate to the transcoding pipeline?**
Answer: The transcoding pipeline is what produces the multiple resolution/bitrate variants that adaptive streaming needs in the first place — without pre-transcoded variants sitting in the CDN, there would be nothing for the player to switch between as network conditions change.

**Q: Why serve videos through a CDN instead of directly from object storage?**
Answer: Object storage in one (or a few) regions can't serve billions of daily views with low latency worldwide, and would need to handle massive egress traffic directly. A CDN caches variants at edge locations near viewers, so most requests never reach origin storage at all, cutting both latency and origin load dramatically.

**Q: How would you track view counts without overwhelming the database?**
Answer: Don't write to the primary database on every view. Publish view events to a stream, aggregate/batch them (in memory or Redis) over a short window, and periodically flush the batched delta as a single update — trading a few seconds to a minute of staleness for a massive reduction in write volume.

**Q: What happens if a transcoding job fails partway through?**
Answer: The job is retried by the worker queue's built-in retry mechanism rather than the video getting stuck in "processing" forever; if it fails repeatedly, it lands in a dead-letter queue that triggers an alert for manual investigation, rather than silently failing.
