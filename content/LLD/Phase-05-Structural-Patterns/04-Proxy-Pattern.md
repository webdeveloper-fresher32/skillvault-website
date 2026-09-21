# 🧠 The Ultimate Guide to Proxy Pattern (LLD)

> **Core Philosophy:** *Provide a surrogate or placeholder for another object to control access to it.*

---

## 📌 Table of Contents
1. [The Problem: Why Do We Need It?](#1-the-problem-why-do-we-need-it)
2. [The 4 Flavors of Proxies (Virtual, Remote, Protection, Logging)](#2-the-4-flavors-of-proxies-virtual-remote-protection-logging)
3. [The Core Architecture (The 3 Participants)](#3-the-core-architecture-the-3-participants)
4. [Step-by-Step Implementation (Java)](#4-step-by-step-implementation-java)
5. [UML Class Diagram & Relationships](#5-uml-class-diagram--relationships)
6. [Execution Flow: Lazy Loading & Access Control](#6-execution-flow-lazy-loading--access-control)
7. [Side-by-Side Comparison: Direct Access vs Proxy](#7-side-by-side-comparison-direct-access-vs-proxy)
8. [When to Use & When NOT to Use](#8-when-to-use--when-not-to-use)
9. [Pros & Cons Trade-off Analysis](#9-pros--cons-trade-off-analysis)
10. [Real-World Everyday Examples](#10-real-world-everyday-examples)
11. [The Ultimate Checklist & Mental Formula](#11-the-ultimate-checklist--mental-formula)

---

## 1. The Problem: Why Do We Need It?

### Real-World Domain Example: High-Resolution 4K Video Streaming & Access Control 🎬 🔒
Imagine building a media portal (like Netflix or YouTube Premium).
* **Heavy Initialization:** Downloading a 4K movie video stream buffer from AWS S3 consumes 2GB of bandwidth and takes 10 seconds. You shouldn't load this until the user actually hits "Play".
* **Security & Entitlements:** Only paid Premium subscribers are allowed to play the video; guest users should be rejected before downloading starts.
* **Caching:** Multiple users re-watching the same video shouldn't re-download it from S3 every single time.

```
                          CLIENT REQUESTS VIDEO
                                    │
                                    ▼
                          ┌──────────────────┐
                          │    VideoProxy    │
                          └─────────┬────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
1. Is User Premium?        2. Is Cached in RAM?       3. Lazy Initialize
   (Protection Proxy)         (Caching Proxy)            (Virtual Proxy)
```

---

## 2. The 4 Flavors of Proxies

1. **Virtual Proxy (Lazy Loading):** Delays instantiating a heavy object until it's genuinely needed.
2. **Protection Proxy (Access Control):** Checks security permissions before forwarding calls.
3. **Caching Proxy:** Stores previous results and returns cached copies for repeated requests.
4. **Remote Proxy:** Represents an object located on a remote server/network (e.g. gRPC stub).

---

## 3. The Core Architecture (The 3 Participants)

```
┌──────────────────────────────────────────────┐
│        <<interface>> VideoStreamer           │
├──────────────────────────────────────────────┤
│ + playVideo(user: User, videoId: String)     │
└──────────────────────▲───────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │ implements                │ implements
┌────────┴─────────┐        ┌────────┴─────────────────────────────┐
│ RealVideoStreamer│        │               ProxyVideoStreamer     │
├──────────────────┤        ├──────────────────────────────────────┤
│ Heavy S3 loader  │◄───────┤ - realStreamer : RealVideoStreamer   │
└──────────────────┘ HAS-A  ├──────────────────────────────────────┤
                            │ 1. Checks user access level          │
                            │ 2. Lazy loads RealVideoStreamer      │
                            │ 3. Delegates execution               │
                            └──────────────────────────────────────┘
```

---

## 4. Step-by-Step Implementation (Java)

### Step 1: User Context

```java
public class User {
    private final String username;
    private final boolean isPremium;

    public User(String username, boolean isPremium) {
        this.username = username;
        this.isPremium = isPremium;
    }

    public String getUsername() { return username; }
    public boolean isPremium() { return isPremium; }
}
```

---

### Step 2: The Service Interface

```java
public interface VideoStreamer {
    void playVideo(User user, String videoId);
}
```

---

### Step 3: The Real Heavy Service (Real Subject)

```java
public class RealVideoStreamer implements VideoStreamer {
    public RealVideoStreamer() {
        // Simulating heavy initialization: Connecting to CDN, decrypting DRM keys
        System.out.println("⏳ [HEAVY RESOURCE] Initializing CDN pipeline and decrypting DRM keys... (Took 3 seconds)");
    }

    @Override
    public void playVideo(User user, String videoId) {
        System.out.println("▶️ Streaming 4K Ultra HD video [" + videoId + "] to @" + user.getUsername());
    }
}
```

---

### Step 4: The Proxy (Protection + Virtual Lazy Loading + Cache)

```java
import java.util.HashSet;
import java.util.Set;

public class VideoStreamerProxy implements VideoStreamer {
    // Virtual Proxy: Real subject is null until genuinely needed!
    private RealVideoStreamer realStreamer;
    private final Set<String> cachedVideos = new HashSet<>();

    @Override
    public void playVideo(User user, String videoId) {
        // 1. Protection Proxy: Security check
        if (!user.isPremium()) {
            System.out.println("🔒 ACCESS DENIED: @" + user.getUsername() + " must upgrade to Premium to stream 4K!");
            return;
        }

        // 2. Virtual Proxy: Lazy loading the heavy service only on first authorized call
        if (realStreamer == null) {
            System.out.println("⚡ Lazy loading RealVideoStreamer instance...");
            realStreamer = new RealVideoStreamer();
        }

        // 3. Caching check
        if (cachedVideos.contains(videoId)) {
            System.out.println("💾 Serving [" + videoId + "] instantly from Edge Cache CDN!");
        } else {
            cachedVideos.add(videoId);
        }

        // 4. Delegate to real service
        realStreamer.playVideo(user, videoId);
    }
}
```

---

### Step 5: Client Usage

```java
public class Main {
    public static void main(String[] args) {
        // Client only interacts with the interface
        VideoStreamer streamer = new VideoStreamerProxy();

        User freeUser = new User("BobFree", false);
        User premiumUser = new User("AliceVIP", true);

        System.out.println("--- Action 1: Free User Attempts Play ---");
        streamer.playVideo(freeUser, "Inception_4K.mkv"); // Blocked by proxy!

        System.out.println("\n--- Action 2: Premium User Plays (Triggers Lazy Load) ---");
        streamer.playVideo(premiumUser, "Inception_4K.mkv"); // Lazy initialized & played

        System.out.println("\n--- Action 3: Premium User Plays Again (Cache Hit) ---");
        streamer.playVideo(premiumUser, "Inception_4K.mkv"); // Served with cache hit!
    }
}
```

---

## 5. UML Class Diagram & Relationships

```
┌────────────────────────────────────────────────────────┐
│             <<interface>> VideoStreamer                │
├────────────────────────────────────────────────────────┤
│ + playVideo(user: User, videoId: String)               │
└───────────────────────────▲────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │ implements                            │ implements
┌───────┴───────────────┐       ┌───────────────┴────────────────────────┐
│   RealVideoStreamer   │       │          VideoStreamerProxy            │
├───────────────────────┤       ├────────────────────────────────────────┤
│ - cdnConnected : bool │◄──────┤ - realStreamer : RealVideoStreamer     │
├───────────────────────┤ HAS-A │ - cachedVideos : Set<String>           │
│ + playVideo(...)      │       ├────────────────────────────────────────┤
└───────────────────────┘       │ + playVideo(...)                       │
                                └────────────────────────────────────────┘
```

---

## 6. Execution Flow: Lazy Loading & Access Control

```
Client calls streamer.playVideo(AliceVIP, "movie.mp4")
   │
   ▼
VideoStreamerProxy
   │
   ├─► Checks AliceVIP.isPremium() ──► TRUE!
   │
   ├─► Checks realStreamer == null ──► TRUE!
   │      └─► Instantiates new RealVideoStreamer() (3s lazy setup)
   │
   ├─► Checks cache & marks video as cached
   │
   └─► Delegates: realStreamer.playVideo(...)
          │
          ▼
       Streams 4K video!
```

---

## 7. Side-by-Side Comparison: Direct Access vs Proxy

| Metric | ❌ Direct Calling Real Service | ✅ With Proxy Pattern |
| :--- | :--- | :--- |
| **Startup Time** | Application takes forever to boot; loads all heavy dependencies. | Instant startup; objects load on-demand when requested. |
| **Security Checks** | Scattered across UI and business layers. | Centralized transparently inside the protection proxy. |
| **Network / CDN Cost** | Re-downloads heavy data every single invocation. | Caches repeated calls at the proxy barrier. |

---

## 8. When to Use & When NOT to Use

### ✅ When to USE
* **Lazy Initialization (Virtual Proxy):** When you have a heavyweight service object that wastes system resources by being kept always up.
* **Access Control (Protection Proxy):** When you want only specific clients to be able to use the service object.
* **Local Execution of a Remote Service (Remote Proxy):** When the service object is located on a remote server (e.g., RMI, RPC, Spring `@FeignClient`).

### ❌ When NOT to USE
* When direct access introduces no performance penalty or security risk (adds an unnecessary abstraction layer).

---

## 9. Pros & Cons Trade-off Analysis

### 🟢 Advantages
* Controls the service object without clients knowing about it.
* Manages lifecycle of the service object when clients don't care about it.
* The proxy works even if the service object isn't ready or isn't available.

### 🔴 Disadvantages
* The response from the service might get delayed by additional middleware layers.
* Code may become more complicated since you need to introduce multiple new classes.

---

## 10. Real-World Everyday Examples

| Domain | Proxy Purpose | Real-World Implementation |
| :--- | :--- | :--- |
| 🗄️ **Hibernate / JPA** | Lazy loading relationships (`@ManyToOne(fetch = LAZY)`) | CGLIB / ByteBuddy dynamic proxy stubs |
| 🛡️ **Spring Security** | Method authorization (`@PreAuthorize("hasRole('ADMIN')")`)| Spring AOP dynamic proxy |
| 🌐 **Web Infrastructure** | Reverse Proxy, Rate Limiter, Load Balancer | NGINX, Cloudflare CDN |

---

## 11. The Ultimate Checklist & Mental Formula

### The Mental Formula
$$\text{Common Service Interface} + \text{Real Heavy Service} + \text{Proxy (Implements Interface + Has-A Real Service)} = \mathbf{Proxy\ Pattern}$$
