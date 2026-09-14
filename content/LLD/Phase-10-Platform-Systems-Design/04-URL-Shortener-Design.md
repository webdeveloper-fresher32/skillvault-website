# URL Shortener — Design Walkthrough

## Table of Contents
1. [Step 1: Clarify Requirements](#1-step-1-clarify-requirements)
2. [Step 2: Identify Entities](#2-step-2-identify-entities)
3. [Step 3: Define Relationships](#3-step-3-define-relationships)
4. [Step 4: Assign Responsibilities](#4-step-4-assign-responsibilities)
5. [Step 5: Apply SOLID](#5-step-5-apply-solid)
6. [Step 6: Apply Design Patterns](#6-step-6-apply-design-patterns)
7. [Step 7: Explain Extensibility](#7-step-7-explain-extensibility)
8. [Class Diagram](#8-class-diagram)
9. [Key Decisions](#9-key-decisions)
10. [Interview Follow-ups](#10-interview-follow-ups)
11. [Interview Q&A](#11-interview-qa)

---

## 1. Step 1: Clarify Requirements

### Functional Requirements (in scope)
- Given a long URL, generate a **short URL** that redirects to it.
- Support **custom aliases** (user picks `myapp.co/sale2026`) as an alternative to
  auto-generated codes.
- Short URLs can have an **expiry** date, after which they stop redirecting.
- **Redirect** a short URL to its original long URL (the hot path — must be fast).
- Track basic **analytics**: click count, and optionally timestamp/referrer per click.

### Out of Scope
- User authentication / account dashboards (assume a `User` exists as a simple owner
  reference).
- Geo/device-based analytics breakdowns beyond raw counts — mention as an extension.
- Malicious-URL / spam filtering.

### Non-Functional Requirements
- **Reads (redirects) vastly outnumber writes (shortens)** — often 100:1 or more; the
  design should make the redirect path as simple/cacheable as possible.
- Short codes must be **collision-free** and, ideally, **not sequentially guessable**
  (so users can't enumerate other people's links) — this directly shapes the
  code-generation approach chosen in step 6.
- Given URL volume, codes should stay short (6–8 characters) while supporting billions of
  URLs — this is a base/encoding math question, not just a hashing question.

---

## 2. Step 2: Identify Entities

| Entity | Represents |
|--------|-----------|
| `Url` | One shortening record: short code, original long URL, owner, expiry, creation time |
| `ShortCodeGenerator` | Produces the short code for a new `Url` (the pluggable piece) |
| `UrlRepository` | Storage abstraction: save/find a `Url` by its short code |
| `AnalyticsService` | Records and aggregates click events per `Url` |
| `ClickEvent` | One redirect event: timestamp, referrer, (optionally) IP/device |
| `User` | The owner of a shortened URL (kept minimal — id + name) |
| `UrlShortenerService` | Orchestrates shorten/redirect/expiry-check flows — the façade clients call |

---

## 3. Step 3: Define Relationships

```
User              "1" ────── "*" Url             (association — a user owns many URLs)
Url               "1" ────── "*" ClickEvent       (composition — clicks belong to exactly this Url)
UrlShortenerService "1" ──── "1" ShortCodeGenerator (association — injected dependency)
UrlShortenerService "1" ──── "1" UrlRepository      (association — injected dependency)
UrlShortenerService "1" ──── "1" AnalyticsService   (association — injected dependency)
```

`Url` is the aggregate root here — everything else either produces it (`ShortCodeGenerator`),
stores it (`UrlRepository`), or records activity against it (`AnalyticsService`).

---

## 4. Step 4: Assign Responsibilities

| Class | Responsibilities |
|-------|-------------------|
| `Url` | Hold short code, long URL, owner, `created_at`, `expires_at`; expose `is_expired()` |
| `ShortCodeGenerator` | Generate a new, unused short code — encapsulates the *algorithm* choice |
| `UrlRepository` | Persist/retrieve `Url` by short code; check existence (for collision avoidance) |
| `AnalyticsService` | Record a `ClickEvent`; return click counts/summaries for a `Url` |
| `UrlShortenerService` | `shorten(long_url, custom_alias=None, expiry=None)`; `resolve(short_code)` — validates expiry, delegates to repository and analytics |

---

## 5. Step 5: Apply SOLID

| Principle | Applied how |
|-----------|-------------|
| **SRP** | `Url` is a plain data holder with expiry logic; it does NOT know how codes are generated or how clicks are stored — those are `ShortCodeGenerator` and `AnalyticsService`'s jobs |
| **OCP** | Swapping base62-counter generation for hash-based or random-with-retry generation means adding a new `ShortCodeGenerator` subclass — `UrlShortenerService.shorten()` is unchanged |
| **LSP** | Every `ShortCodeGenerator` implementation returns a valid, URL-safe `str` code of expected length — none of them return `None` or raise on the happy path, so callers can treat them interchangeably |
| **ISP** | `UrlRepository` exposes only `save`, `find_by_code`, `exists` — analytics storage is a separate `AnalyticsService`/repository, so callers needing just URL lookups aren't coupled to click-tracking storage |
| **DIP** | `UrlShortenerService` depends on `UrlRepository` and `ShortCodeGenerator` interfaces, injected at construction — the concrete storage (in-memory dict, Redis, Postgres) is swappable without touching the service |

---

## 6. Step 6: Apply Design Patterns

### Strategy — Short-Code Generation

This is the heart of the problem. Three real approaches, each with genuine trade-offs —
naming all three and picking one with justification is what separates a strong answer
from a shallow one.

```python
from abc import ABC, abstractmethod
import hashlib
import random
import string


BASE62_ALPHABET = string.digits + string.ascii_lowercase + string.ascii_uppercase  # 62 chars


class ShortCodeGenerator(ABC):
    @abstractmethod
    def generate(self, long_url: str, repository: "UrlRepository") -> str: ...


class Base62CounterGenerator(ShortCodeGenerator):
    """Maintains a global auto-incrementing counter and encodes it in base62.
    Guaranteed unique with zero collision checks. Downside: sequential and
    guessable (code N+1 is trivially derivable from code N), and requires a
    centrally coordinated counter (a single point of contention at very high
    write throughput, though writes are the rare path here)."""

    def __init__(self, start: int = 1):
        self._counter = start

    def generate(self, long_url: str, repository: "UrlRepository") -> str:
        code = self._encode(self._counter)
        self._counter += 1
        return code

    @staticmethod
    def _encode(number: int) -> str:
        if number == 0:
            return BASE62_ALPHABET[0]
        digits = []
        base = len(BASE62_ALPHABET)
        while number > 0:
            number, remainder = divmod(number, base)
            digits.append(BASE62_ALPHABET[remainder])
        return "".join(reversed(digits))


class HashBasedGenerator(ShortCodeGenerator):
    """Hashes the long URL (+ a salt/timestamp to allow the same URL to be
    shortened multiple times) and takes the first N base62 characters.
    Deterministic-ish and doesn't need a shared counter, but hash collisions
    on a truncated hash ARE possible at scale, so it must retry on collision."""

    def __init__(self, code_length: int = 7, max_retries: int = 5):
        self.code_length = code_length
        self.max_retries = max_retries

    def generate(self, long_url: str, repository: "UrlRepository") -> str:
        salt = ""
        for attempt in range(self.max_retries):
            digest = hashlib.sha256((long_url + salt).encode()).hexdigest()
            code = self._to_base62_prefix(digest, self.code_length)
            if not repository.exists(code):
                return code
            salt = f"retry-{attempt}"   # perturb the input and rehash
        raise RuntimeError("Failed to generate a unique code after retries")

    @staticmethod
    def _to_base62_prefix(hex_digest: str, length: int) -> str:
        number = int(hex_digest, 16)
        chars = []
        base = len(BASE62_ALPHABET)
        for _ in range(length):
            number, remainder = divmod(number, base)
            chars.append(BASE62_ALPHABET[remainder])
        return "".join(chars)


class RandomWithCollisionCheckGenerator(ShortCodeGenerator):
    """Generates a random base62 string and checks the repository for a
    collision, retrying if needed. Not guessable/sequential (good for
    privacy), but requires a repository round-trip per attempt, and at very
    high fill-rates collision probability rises (birthday paradox)."""

    def __init__(self, code_length: int = 7, max_retries: int = 5):
        self.code_length = code_length
        self.max_retries = max_retries

    def generate(self, long_url: str, repository: "UrlRepository") -> str:
        for _ in range(self.max_retries):
            code = "".join(random.choices(BASE62_ALPHABET, k=self.code_length))
            if not repository.exists(code):
                return code
        raise RuntimeError("Failed to generate a unique code after retries")
```

### Trade-off Comparison

| Approach | Uniqueness guarantee | Guessable? | Needs collision check? | Scaling concern |
|----------|----------------------|------------|--------------------------|-------------------|
| Base62 counter | Guaranteed (monotonic) | Yes — sequential | No | Centralized counter is a coordination point (mitigated with ID ranges per server/Snowflake-style IDs) |
| Hash-based (truncated) | Probabilistic | Mostly no | Yes (retry on collision) | Hash computation is cheap; collision retries are rare at 7+ chars |
| Random + collision check | Probabilistic | No | Yes (retry on collision) | Extra repository round-trip per generation; degrades as namespace fills up |

**Chosen default for this design:** `Base62CounterGenerator` for guaranteed uniqueness and
simplicity, paired with **optional obfuscation** (e.g., XOR/permute the counter bits before
encoding) if non-guessability is a hard requirement — called out explicitly as a follow-up
rather than baked in, to keep the core design simple.

### Custom Aliases as a Special Case

```python
class UrlShortenerService:
    def __init__(
        self,
        generator: ShortCodeGenerator,
        repository: "UrlRepository",
        analytics: "AnalyticsService",
    ):
        self.generator = generator
        self.repository = repository
        self.analytics = analytics

    def shorten(
        self,
        long_url: str,
        owner: "User",
        custom_alias: str | None = None,
        expires_at: "datetime | None" = None,
    ) -> "Url":
        if custom_alias:
            if self.repository.exists(custom_alias):
                raise ValueError(f"Alias '{custom_alias}' is already taken")
            code = custom_alias
        else:
            code = self.generator.generate(long_url, self.repository)

        url = Url(code=code, long_url=long_url, owner=owner, expires_at=expires_at)
        self.repository.save(url)
        return url

    def resolve(self, code: str) -> str:
        url = self.repository.find_by_code(code)
        if url is None:
            raise KeyError(f"No URL found for code '{code}'")
        if url.is_expired():
            raise ValueError(f"Short URL '{code}' has expired")
        self.analytics.record_click(url)
        return url.long_url
```

Custom alias handling deliberately bypasses `ShortCodeGenerator` entirely — it's a
different code *path*, not a different *generator* — since the code is user-supplied, not
generated.

---

## 7. Step 7: Explain Extensibility

| New requirement | How the design absorbs it |
|------------------|----------------------------|
| Rate-limit shortening per user | Add a `RateLimiter` collaborator checked at the top of `shorten()` — doesn't touch `ShortCodeGenerator` or `UrlRepository` |
| QR code generation for each short URL | Add a `QrCodeService.generate(url.code)` called optionally after `shorten()` returns — new collaborator, no change to existing classes |
| Per-click detailed analytics (device, geo, referrer) | `ClickEvent` gains fields; `AnalyticsService.record_click()` signature grows, but `UrlShortenerService.resolve()` still just calls it the same way |
| Bulk shortening (CSV upload) | A new `BulkShortenerService` that loops and calls `UrlShortenerService.shorten()` per row — reuses the existing service, no core changes |
| Switch storage from in-memory dict to Redis/Postgres | Write a new `UrlRepository` implementation — `UrlShortenerService` is untouched because it only depends on the `UrlRepository` interface (DIP) |

---

## 8. Class Diagram

```
┌──────────┐        ┌────────────┐        ┌─────────────┐
│   User   │1──────*│    Url     │1──────*│ ClickEvent  │
└──────────┘        │ code       │        └─────────────┘
                     │ long_url   │
                     │ expires_at │
                     └─────┬──────┘
                           │
        ┌──────────────────┼───────────────────┐
        │                  │                    │
        ▼                  ▼                    ▼
┌───────────────┐  ┌────────────────┐  ┌───────────────────┐
│ UrlRepository │  │ ShortCodeGen(ABC)│  │ AnalyticsService   │
│ + save         │  │ + generate(...)  │  │ + record_click     │
│ + find_by_code │  └────────▲─────────┘  │ + click_count       │
│ + exists       │           │            └────────────────────┘
└───────────────┘   ┌────────┼────────────────┐
                     │        │                 │
            Base62CounterGenerator  HashBasedGenerator  RandomWithCollisionCheckGenerator

┌────────────────────────────────────────────┐
│           UrlShortenerService                │
│  - generator: ShortCodeGenerator              │
│  - repository: UrlRepository                  │
│  - analytics: AnalyticsService                │
│  + shorten(long_url, owner, alias?, expiry?)  │
│  + resolve(code) -> long_url                  │
└────────────────────────────────────────────┘
```

---

## 9. Key Decisions

- **Why base62 instead of base64?** Base64 includes `+` and `/`, which aren't URL-safe
  without encoding — base62 (digits + lowercase + uppercase letters) is safe to place
  directly in a URL path with no escaping.
- **Why prefer a counter-based generator as the default over random generation?** It has
  zero collision probability and zero repository round-trips during generation — random
  approaches must check-and-retry, which adds latency and gets worse as the namespace
  fills. The guessability downside is solvable separately (bit-scrambling) without
  sacrificing the uniqueness guarantee.
- **Why is custom alias handling in `UrlShortenerService.shorten()` rather than inside
  `ShortCodeGenerator`?** A custom alias is user-supplied, not generated — forcing it
  through a "generator" interface whose contract is "produce a code" would be a
  conceptual mismatch (and would violate LSP, since this "generator" wouldn't actually
  generate anything).
- **Why does `resolve()` check expiry before recording a click?** Recording a click for a
  dead link would pollute analytics with meaningless data and mask the fact that the
  redirect never actually happened — the expiry check is a guard clause, not an
  afterthought.

---

## 10. Interview Follow-ups

- "How do you handle the redirect path being read-heavy?" → Discuss caching
  `find_by_code()` lookups (e.g., Redis in front of the primary datastore, or a CDN edge
  cache keyed by short code), since redirects vastly outnumber shortens.
- "What happens if two servers generate a code from the counter concurrently?" → Discuss
  either a centralized ID-generation service (a database sequence, or Twitter
  Snowflake-style IDs), or partitioning counter ranges per server to avoid contention
  while preserving uniqueness.
- "How would you support link analytics dashboards efficiently without slowing down
  redirects?" → Record clicks asynchronously (fire-and-forget to a queue/log) rather than
  synchronously inside the redirect's critical path, so analytics writes never add
  latency to `resolve()`.
- "How do you pick the right short-code length?" → Frame it as a capacity math question:
  62^6 ≈ 56.8 billion codes, 62^7 ≈ 3.5 trillion — pick length based on expected total
  URL volume with headroom, not arbitrarily.

---

## 11. Interview Q&A

**Q: Compare the three short-code generation strategies — counter-based, hash-based, and random-with-collision-check. Which would you pick and why?**
Answer: A base62 counter guarantees uniqueness with no collision checks but produces sequential, guessable codes and needs centrally coordinated ID assignment. Hash-based truncates a hash of the URL, avoiding central coordination but requiring collision retries since truncated hashes can collide. Random generation avoids guessability entirely but needs a repository round-trip per attempt and its collision probability rises as the namespace fills (birthday paradox). I'd default to counter-based for its uniqueness guarantee and generation speed, adding a bit-scrambling/obfuscation step over the counter value if non-guessability is a hard requirement, rather than switching to a probabilistic scheme.

**Q: Why is base62 chosen over base64 or plain hexadecimal for encoding?**
Answer: Base64 includes `+` and `/`, which have special meaning in URLs and would require percent-encoding, making short codes less "short" and more error-prone to share. Hexadecimal is URL-safe but only uses 16 symbols, so codes need roughly 1.5x more characters for the same ID space. Base62 (0-9, a-z, A-Z) is both fully URL-safe with no escaping needed and maximizes information density per character, keeping codes compact.

**Q: The redirect path is described as read-heavy. How does that shape the class design, not just the infrastructure?**
Answer: It keeps `UrlShortenerService.resolve()` deliberately minimal — a repository lookup, an expiry check, and a fire-off to analytics — with no heavy computation in the critical path. It also justifies keeping `UrlRepository` as a clean interface: the concrete implementation used in production (a cache-backed repository, e.g., check Redis then fall back to Postgres) can change without `resolve()`'s logic changing at all, because the read-heavy optimization lives entirely behind the `UrlRepository` abstraction (DIP).

**Q: How do you avoid recording a click for a URL that's expired?**
Answer: `UrlShortenerService.resolve()` calls `url.is_expired()` immediately after fetching the `Url` from the repository and raises before ever calling `analytics.record_click()`. This ordering is deliberate — it treats expiry as a guard clause at the top of the method, ensuring bad state (accessing a dead link) never reaches the side-effecting analytics call.

**Q: Why does custom-alias handling live in `UrlShortenerService.shorten()` instead of being implemented as another `ShortCodeGenerator` subclass, say `CustomAliasGenerator`?**
Answer: A `ShortCodeGenerator`'s contract is "produce a new code given a long URL," but a custom alias is supplied by the caller, not generated — there's nothing to generate. Forcing it into the `ShortCodeGenerator` interface would mean writing a "generator" that mostly just validates and echoes back its input, which is a conceptual mismatch and would also complicate the interface's contract (does `generate()` ever need extra caller-supplied arguments now?). Keeping the branch in `shorten()` keeps `ShortCodeGenerator` focused solely on algorithmic generation.

**Q: How would you extend this design to rate-limit how many URLs a single user can shorten per day, without touching `ShortCodeGenerator` or `UrlRepository`?**
Answer: Introduce a `RateLimiter` collaborator (e.g., checking a per-user counter with a time window) injected into `UrlShortenerService`, and call `rate_limiter.check(owner)` as the first line of `shorten()`, raising if the limit is exceeded. Because `ShortCodeGenerator` and `UrlRepository` are only invoked later in the method, they remain completely unaware of and unaffected by the new rate-limiting concern — it's an orthogonal cross-cutting check layered on top of the existing orchestration.
