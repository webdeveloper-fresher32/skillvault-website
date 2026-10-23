# Design Netflix

Netflix shares YouTube's "video is a huge binary blob served to millions" DNA, but the constraints are different in a way that changes the architecture: Netflix's content catalog is small and known in advance (thousands of titles, not billions of user uploads), which means it can be aggressively pre-positioned close to viewers *before* anyone asks for it — the opposite of YouTube's must-transcode-on-demand pipeline.

## 1. Requirements

**Functional requirements:**
- Users browse a catalog and stream a movie/show, choosing from a curated (not user-generated) library.
- Playback adapts automatically to the viewer's current network conditions without user intervention.
- Users get personalized recommendations on the home screen.

**Non-functional requirements:**
- **Playback smoothness over everything.** Netflix's core promise is "it never buffers" — this is the dominant non-functional requirement, more so than in almost any other case study in this phase.
- **Availability over strict consistency** for "continue watching" position and recommendations (both fine to be slightly stale).
- **Latency target:** playback start under ~1-2 seconds; zero perceptible rebuffering under normal conditions.
- **Scale target:** design for 250 million subscribers, with enormous concentration at peak evening hours (prime-time viewing is dramatically higher than daytime average, unlike more evenly-distributed traffic in earlier case studies).

## 2. Back-of-envelope estimation

- Subscribers: 250,000,000; assume 30% watch something during peak evening hours → **75 million concurrent streams at peak**.
- Average stream bitrate (mixed SD/HD/4K): ~5 Mbps → peak aggregate bandwidth ≈ 75M × 5 Mbps ≈ **375 Tbps** of simultaneous video delivery — a number far beyond what any centralized origin infrastructure could serve directly, which is the entire justification for the CDN pre-positioning strategy below.
- Catalog size: a few thousand to tens of thousands of titles, each pre-encoded into many resolution/bitrate variants (the same idea as YouTube's transcoding output, but done once per title upfront rather than continuously per upload) — total catalog storage is large (petabytes) but essentially static day to day, unlike YouTube's ever-growing user-upload firehose.
- **The estimation story here is bandwidth-bound, not storage-growth-bound or write-throughput-bound** — contrast this explicitly with YouTube's storage-per-day estimate and Twitter's writes/sec estimate; every case study's numbers point to a different bottleneck, which is the point of doing the estimation step at all.

## 3. High-level architecture

```
                     ┌───────────────┐
        Browse ───► │ API Gateway    │ ◄─── Play request
                     └──────┬────────┘
                            │
              ┌─────────────┴─────────────────┐
              ▼                                ▼
     ┌────────────────┐               ┌────────────────────┐
     │ Catalog/Metadata  │               │ Recommendation Service │  (high level only —
     │ Service            │               │                          │   see Section 4.3)
     └───────┬────────┘               └────────────────────┘
             │
     ┌───────▼────────┐
     │ Encoding Pipeline   │  (offline, per-title — same transcoding idea as YouTube,
     │ (per-title, one-time)│   run once when a title is added to the catalog)
     └───────┬────────┘
             │ writes all resolution/bitrate variants
             ▼
     ┌────────────────────────────────────────┐
     │ Content Delivery Network (own + partnered) │  ← pre-positioned before demand
     │  Regional caches → ISP-embedded edge caches  │
     └────────────────────────────────────────┘
                            │
                            ▼
                     Viewer's player (adaptive bitrate logic runs client-side)
```

- **Encoding Pipeline** runs offline, once per title, producing the full ladder of resolution/bitrate variants — structurally the same idea as YouTube's transcoding worker, but triggered by "a new title was licensed/produced," not by millions of independent user uploads, so it doesn't need to scale to a continuous high-volume queue the way YouTube's does.
- **CDN with pre-positioning** is the architectural centerpiece — because the catalog is known in advance, Netflix can push popular content into edge caches (including caches embedded directly inside ISP networks) *before* peak demand hits, rather than reactively caching on first request the way a cache-aside pattern normally would.

## 4. Deep dive

### 4.1 Adaptive bitrate streaming (ABR)

The player, not the server, drives quality decisions in real time:

```
Player starts playback ──► requests a manifest listing all available variants:
                              [ 240p@400kbps, 480p@1000kbps, 720p@2500kbps, 1080p@5000kbps, ... ]

Every few seconds, player measures recent download speed & buffer health:
    if measured_throughput comfortably > current_variant_bitrate and buffer healthy:
        request next chunk at a HIGHER bitrate variant
    elif buffer is draining (network got worse):
        request next chunk at a LOWER bitrate variant
    else:
        stay at current variant
```

- Video is chopped into short chunks (a few seconds each), each available pre-encoded at every bitrate in the ladder. The player requests chunk-by-chunk, potentially switching bitrate between chunks, which is why encoding must happen for every variant upfront rather than on demand — there's no time to transcode mid-playback.
- **This is a client-driven decision, not a server-side one** — the server (or CDN) doesn't need to know or care which bitrate a given viewer is currently pulling; it just serves whichever chunk/variant was requested. This keeps the server side stateless and simple, pushing the adaptive logic to where the relevant signal (the viewer's actual current network conditions) is directly observable.
- The pre-transcoded variant ladder is exactly the output of the encoding pipeline described above — ABR is the *consumer* of that pipeline's output, not a separate system.

### 4.2 CDN pre-positioning

Rather than waiting for a cache miss the way a typical cache-aside pattern does (Phase 06 Lesson 01), Netflix's CDN strategy is predictive:

```
Content ranking/popularity forecast (per region)
        │
        ▼
Push popular titles' variant files into regional/ISP edge caches
BEFORE peak viewing hours, based on:
  - historical popularity per region
  - new-release schedule (a big new season dropping is a known, schedulable spike)
        │
        ▼
At peak time, the overwhelming majority of requests are edge cache hits —
origin infrastructure barely participates in serving actual peak traffic
```

- This works *because* the catalog is small and mostly known in advance, unlike YouTube's ever-growing, unpredictable user-upload catalog — you can't pre-position content nobody has uploaded yet, but you absolutely can pre-position "the new season everyone will watch on Friday night."
- Combined with ABR, this means peak-hour playback is served almost entirely from nearby caches at whatever bitrate the local network can sustain, rather than depending on origin infrastructure surviving 75 million concurrent streams directly.
- ISP-embedded caches (hardware Netflix places directly inside ISP networks) push the "edge" even closer than a typical third-party CDN would reach, trimming the last, often most congested, network hop.

### 4.3 Recommendation system (high level only)

Recommendations personalize the home screen based on viewing history, ratings, and similarity to other viewers' behavior. The actual ranking/ML models are explicitly out of scope for an HLD interview — deriving a recommendation algorithm is a machine-learning systems topic, not a system-design one. What is worth saying in an interview: recommendations are computed **offline/asynchronously** (batch or near-real-time pipelines, not synchronously on every home-screen load), the results are cached per user (the same cache-aside idea as everywhere else in this course), and staleness of a few hours is generally acceptable — naming this shape is a sufficient answer.

## 5. Trade-offs / what breaks at 10x scale

- **Pre-positioning accuracy** — pre-positioning is a bet on a popularity forecast; at 10x subscriber count spread across more regions, a wrong forecast (an unexpectedly viral title in a region it wasn't pushed to) causes a much larger wave of cache misses hitting origin than at today's scale, so the forecasting/ranking system itself becomes a scaling bottleneck, not just the CDN infrastructure.
- **Peak concentration gets worse, not just bigger** — 10x subscribers doesn't spread evenly across the day; prime-time concentration likely gets more extreme (more people on similar regional schedules), meaning peak-to-average bandwidth ratio grows, straining CDN capacity provisioning specifically around a few hours a day.
- **Encoding pipeline throughput for new releases** — a bigger catalog and more simultaneous new releases (e.g. many regional originals launching in the same week) strain the offline encoding pipeline's turnaround time; the fix mirrors YouTube's transcoding scaling answer — more parallel encoding workers — but the trigger here is "content calendar," a schedulable, predictable load rather than YouTube's continuous unpredictable upload firehose.

## Interview Q&A

**Q: How is Netflix's CDN strategy different from a typical cache-aside pattern?**
Answer: Cache-aside is reactive — content is cached only after the first request misses. Netflix pre-positions popular content into edge/ISP caches *before* demand arrives, using popularity forecasts and release schedules, because the catalog is small and largely known in advance, unlike a typical cache-aside workload where you can't predict what will be requested.

**Q: How does adaptive bitrate streaming decide which quality to play?**
Answer: The player itself measures its recent download throughput and buffer health, then requests the next video chunk at a higher, lower, or the same bitrate variant accordingly. All bitrate variants are pre-encoded ahead of time, so switching is just requesting a different pre-existing chunk — no server-side transcoding happens during playback.

**Q: Why doesn't Netflix need a transcoding pipeline as large/continuous as YouTube's?**
Answer: Netflix's catalog grows by a relatively small, curated number of titles, each encoded once when added. YouTube's catalog grows continuously from millions of independent user uploads per day, requiring a much larger, always-on transcoding worker fleet to keep up.

**Q: What happens if a title unexpectedly goes viral in a region where it wasn't pre-positioned?**
Answer: Requests fall back to a cache-miss path similar to a normal CDN — nearby edge/regional caches fetch from origin (or a further-upstream cache) on the first requests, then serve subsequent requests from cache. It's slower than a properly pre-positioned hit, which is exactly why accurate popularity forecasting matters at scale.

**Q: Why is the recommendation system not part of the deep dive in an HLD interview?**
Answer: Recommendations are fundamentally a machine-learning ranking problem, not a distributed-systems/infrastructure problem — the interesting complexity is in the model and data, not in load balancers, caches, or queues. A strong HLD answer names that recommendations run asynchronously and are cached per user, then moves on to the infrastructure problems that are actually in scope.
