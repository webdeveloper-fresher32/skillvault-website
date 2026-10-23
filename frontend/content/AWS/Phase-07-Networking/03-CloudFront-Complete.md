# CloudFront — Complete CDN Guide

> Amazon CloudFront is AWS's globally distributed Content Delivery Network (CDN). It accelerates delivery of static and dynamic content by caching copies close to your users.

---

## Table of Contents

1. [What is CloudFront?](#1-what-is-cloudfront)
2. [Edge Locations and Points of Presence](#2-edge-locations-and-points-of-presence)
3. [How CloudFront Works](#3-how-cloudfront-works)
4. [Distributions](#4-distributions)
5. [Origins](#5-origins)
6. [Cache Behaviors](#6-cache-behaviors)
7. [CloudFront + S3 (O05-AI/OAC)](#7-cloudfront--s3-oaioac)
8. [Viewer Protocol Policy](#8-viewer-protocol-policy)
9. [Geo Restriction](#9-geo-restriction)
10. [Lambda@Edge and CloudFront Functions](#10-lambdaedge-and-cloudfront-functions)
11. [Signed URLs and Signed Cookies](#11-signed-urls-and-signed-cookies)
12. [Price Classes](#12-price-classes)
13. [CloudFront Security](#13-cloudfront-security)
14. [Invalidations](#14-invalidations)
15. [Real-World Architectures](#15-real-world-architectures)
16. [Interview Q&A](#16-interview-qa)

---

## 1. What is CloudFront?

**Amazon CloudFront** is a fast, highly secure, and programmable Content Delivery Network (CDN) service.

### The Problem CloudFront Solves

Without CDN:
```
User in Tokyo             Server in us-east-1 (Virginia)
+----------+    ~180ms    +------------------+
|  Browser | <----------> | Origin Server    |
+----------+   (across    +------------------+
                Pacific)

Problem: High latency for users far from your origin server
```

With CloudFront:
```
User in Tokyo             Edge Location in Tokyo
+----------+     ~5ms     +------------------+
|  Browser | <----------> | CloudFront Edge  |
+----------+   (local!)   | (cached content) |
                          +------------------+
                                   |
                            (only on cache miss)
                                   |
                               ~180ms
                                   |
                          +------------------+
                          | Origin Server    |
                          | (us-east-1)      |
                          +------------------+

Benefit: Users get content from nearby edge location
         Much lower latency for cached content
         Origin only hit for cache misses
```

### What CloudFront Does

1. **Caches content** at edge locations worldwide
2. **Reduces latency** by serving content from nearby locations
3. **Reduces origin load** — most requests served from cache
4. **Security**: DDoS protection, AWS WAF integration, HTTPS
5. **Dynamic content acceleration** even for uncached content (better routing)

---

## 2. Edge Locations and Points of Presence

### Edge Locations

CloudFront has **400+ edge locations** across **90+ cities** in **45+ countries**.

```
Americas:
  - New York, Los Angeles, Miami, Chicago, Dallas, Seattle
  - Toronto, Montreal, São Paulo, Buenos Aires, Bogotá

Europe:
  - London, Paris, Frankfurt, Amsterdam, Madrid, Milan
  - Stockholm, Warsaw, Dublin, Zurich

Asia Pacific:
  - Tokyo, Osaka, Seoul, Singapore, Mumbai, Sydney
  - Hong Kong, Taipei, Bangkok, Jakarta, Kuala Lumpur

Middle East & Africa:
  - Dubai, Cape Town, Johannesburg, Tel Aviv
```

### Regional Edge Caches

Between edge locations and origins are **13 Regional Edge Caches**:

```
Origin (us-east-1)
     |
     | (long-lived cache)
     v
Regional Edge Cache (us-east-1 region)
     |
     | (medium-lived cache)
     v
Edge Location (New York, Boston, Philadelphia...)
     |
     | (short TTL or dynamic)
     v
End User
```

Regional Edge Caches:
- Cache items that aren't popular enough to stay at every edge location
- Reduce origin load by centralizing less-popular content
- Better cache hit ratio overall

### Points of Presence (PoP)

A "Point of Presence" refers collectively to edge locations + regional edge caches. CloudFront has 600+ PoPs.

---

## 3. How CloudFront Works

### Request Flow

```
Step 1: User requests https://cdn.example.com/image.jpg

Step 2: DNS resolves cdn.example.com to CloudFront edge location
        (nearest edge based on DNS routing/anycast)

Step 3: Request arrives at edge location

Step 4: Edge checks cache
  CACHE HIT:
    - Return cached response immediately
    - User gets fast response
    - Origin not contacted
    
  CACHE MISS:
    - Edge forwards request to Regional Edge Cache
    - Regional Cache checks its cache
    - If still miss, forwards to Origin
    - Origin returns content
    - Edge caches the response
    - Edge returns response to user
```

### Cache Key

CloudFront uses a **cache key** to identify unique cache entries. Default cache key: URL + headers you specify.

```
URL: https://cdn.example.com/image.jpg

Default cache key: /image.jpg
With headers:      /image.jpg + Accept-Encoding: gzip
With query strings: /image.jpg?version=2
```

Better cache keys = more cache hits.
More variables in cache key = more unique entries = fewer cache hits.

### Cache Hit Ratio

```
Cache Hit Ratio = Cache Hits / (Cache Hits + Cache Misses) * 100

Improve cache hit ratio:
1. Longer TTLs (if content changes infrequently)
2. Fewer variables in cache key
3. Normalize headers/query strings before caching
4. Use separate distributions for static vs dynamic
```

---

## 4. Distributions

A **CloudFront Distribution** is the configuration that tells CloudFront how to deliver your content.

### Distribution Types

**Web Distribution** (current standard):
- HTTP and HTTPS
- Static files, APIs, dynamic content
- Supports custom origins
- This is what you use for everything

**RTMP Distribution** (legacy, deprecated):
- Real-Time Messaging Protocol
- Video streaming
- Being phased out — use MediaStore or IVS instead

### Creating a Distribution

```
CloudFront Console -> Create Distribution

Origin Settings:
  Origin domain: my-bucket.s3.amazonaws.com (or ALB DNS)
  Protocol: HTTPS only
  Origin path: /production (optional, path prefix on origin)
  
Default Cache Behavior:
  Viewer protocol: Redirect HTTP to HTTPS
  Allowed methods: GET, HEAD (or GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE)
  Cache settings: Managed-CachingOptimized (or custom)
  
Distribution Settings:
  Alternate domain names: cdn.example.com
  SSL certificate: ACM certificate for cdn.example.com
  Default root object: index.html
  Price class: Use all edge locations
  
-> Create distribution (takes 5-10 minutes to deploy globally)
```

### Distribution Domain Name

CloudFront assigns a domain name like:
```
d1234567890abc.cloudfront.net
```

You typically add a CNAME (or Alias) record in Route53:
```
cdn.example.com CNAME d1234567890abc.cloudfront.net
```

---

## 5. Origins

An **Origin** is the server where CloudFront fetches content when it's not in cache.

### S3 Bucket Origin

```
Use case: Static website, images, files, videos

Origin domain: my-bucket.s3.amazonaws.com

Options:
- Use OAC (Origin Access Control) to restrict direct S3 access
- Can use S3 bucket as website endpoint
- Regional endpoint recommended for better performance
```

### Application Load Balancer Origin

```
Use case: Dynamic content, APIs, web applications

Origin domain: my-alb-1234567.us-east-1.elb.amazonaws.com

Options:
- HTTPS between CloudFront and ALB
- Custom headers for origin verification
- ALB can handle multiple targets (EC2, containers)
```

### Custom HTTP Origin

```
Use case: EC2 instances, on-premises servers, other CDNs

Origin domain: api.backend.example.com (any public hostname)
Port: 443
Protocol: HTTPS

Important: Origin must be publicly accessible from CloudFront
(CloudFront IPs must be in origin's security group/firewall)
```

### S3 Origin as Website Endpoint vs REST API Endpoint

| Feature | REST API (bucket.s3.amazonaws.com) | Website (bucket.s3-website.amazonaws.com) |
|---------|-----------------------------------|------------------------------------------|
| Redirect support | No | Yes (index.html, 404.html) |
| HTTPS | Yes | No (HTTP only) |
| OAC support | Yes | No |
| Hosting SPA | No (needs CloudFront redirect) | Yes |

### Multiple Origins (Origin Groups)

Configure multiple origins with failover:

```
Origin Group: prod-group
  Primary origin: primary-s3-bucket
  Secondary origin: backup-s3-bucket (in different region)
  Failover criteria: 5xx errors from primary
```

---

## 6. Cache Behaviors

**Cache Behaviors** define how CloudFront handles requests for specific URL patterns.

### What Cache Behaviors Control

- Which origin to use
- Caching rules (TTL, what headers to forward)
- Viewer protocol
- Allowed HTTP methods
- Lambda@Edge functions
- Access restrictions

### Default Cache Behavior

The `*` behavior — matches ALL requests not matched by other behaviors.

### Path Pattern Matching

```
Distribution with multiple behaviors:

Path Pattern: /api/*
  -> Origin: ALB (api.backend.com)
  -> Cache: Do NOT cache (API responses)
  -> TTL: 0

Path Pattern: /images/*
  -> Origin: S3 bucket
  -> Cache: YES, 86400 seconds (1 day)
  -> Compress: Yes

Path Pattern: *.html
  -> Origin: S3 bucket
  -> Cache: 300 seconds (5 minutes)
  -> Compress: Yes

Path Pattern: * (default)
  -> Origin: S3 bucket
  -> Cache: 86400 seconds
```

### TTL Settings

```
Cache Control headers from origin:
  Cache-Control: max-age=86400     -> CloudFront respects this
  Cache-Control: no-cache          -> CloudFront won't cache
  Cache-Control: s-maxage=3600     -> For shared caches (CloudFront)

CloudFront TTL settings:
  Minimum TTL: 0 (default)         -> Minimum cache time
  Maximum TTL: 31536000 (1 year)   -> Maximum cache time
  Default TTL: 86400 (1 day)       -> Used when no Cache-Control header
```

**Priority**: `s-maxage` > `max-age` > Default TTL, capped by Minimum and Maximum TTL.

### Headers, Cookies, Query Strings

Control what CloudFront includes in the cache key and forwards to origin:

```
Query Strings:
  None: Don't include in cache key, don't forward
    Good for: Static files (ignores ?v=123 variations)
  All: Include all in cache key, forward all
    Good for: APIs where all params matter
  Specific: Include only named params
    Good for: Whitelist important params

Headers:
  None: Don't forward any headers
    Good for: Static content (max caching)
  All: Forward all headers
    Bad for caching: Every header = unique cache entry
  Specific: Forward only named headers
    Good for: Authorization, Accept-Language

Cookies:
  None: Don't forward cookies
    Good for: Unauthenticated static content
  All: Forward all cookies
    Bad for caching: Session-specific responses
  Specific: Forward only named cookies
    Good for: Selective session handling
```

---

## 7. CloudFront + S3 (O05-AI/OAC)

When using S3 as a CloudFront origin, you want to:
- Serve content through CloudFront only (not direct S3 URL)
- Prevent users from bypassing CloudFront and hitting S3 directly

### Origin Access Identity (OAI) — Legacy

The older method for restricting S3 access:

```
1. Create an OAI (a special CloudFront identity)
2. Attach it to your CloudFront distribution
3. Update S3 bucket policy to only allow the OAI

S3 Bucket Policy with OAI:
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity XXXXX"
    },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-bucket/*"
  }]
}

Result: Direct S3 URL returns 403 Forbidden
        CloudFront URL works normally
```

### Origin Access Control (OAC) — Current Best Practice

Newer, more secure method:

```
1. Create OAC in CloudFront console
2. Assign to origin in distribution
3. Update S3 bucket policy

S3 Bucket Policy with OAC:
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "cloudfront.amazonaws.com"
    },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-bucket/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::123456789:distribution/DIST_ID"
      }
    }
  }]
}
```

OAC advantages over OAI:
- Supports SSE-KMS encrypted buckets
- Supports all S3 buckets including those in any region
- More secure (tied to specific distribution, not just any CloudFront)
- Supports POST, PUT, DELETE (for upload scenarios)

### Complete Architecture: CloudFront + Private S3

```
User
  |
  | (HTTPS request)
  v
CloudFront Edge Location
  |
  | Cache miss: forward to origin
  v
S3 Bucket (private, bucket policy only allows OAC)
  |
  v
Content returned to CloudFront -> cached -> returned to user

User trying to access S3 directly:
  https://my-bucket.s3.amazonaws.com/file.jpg
  -> 403 Forbidden (blocked by bucket policy)

User through CloudFront:
  https://d123.cloudfront.net/file.jpg
  -> 200 OK (CloudFront authorized via OAC)
```

---

## 8. Viewer Protocol Policy

Controls how CloudFront handles HTTP vs HTTPS requests from viewers.

### Options

**HTTP and HTTPS**:
```
Both allowed
CloudFront serves content over whatever protocol the viewer requests
Use when: Legacy HTTP support needed (not recommended)
```

**Redirect HTTP to HTTPS**:
```
HTTP requests -> 301 redirect to HTTPS
HTTPS requests -> served normally
Use when: Want HTTPS but need backward compatibility
This is the most common setting
```

**HTTPS Only**:
```
HTTP requests -> 403 Forbidden
HTTPS requests -> served normally
Use when: Strict security requirements, only HTTPS
```

### SSL/TLS Certificates

For custom domains (cdn.example.com), you need an SSL certificate:

```
Options:
1. Default CloudFront certificate (*.cloudfront.net)
   - No cost, works for .cloudfront.net domains
   - Cannot use with custom domains

2. Custom certificate from ACM (AWS Certificate Manager)
   - MUST be in us-east-1 region (CloudFront requirement!)
   - Free from ACM
   - Required for custom domain names

Creating ACM certificate:
  Certificate Manager (us-east-1) -> Request certificate
  Domain: cdn.example.com (or *.example.com)
  Validation: DNS (add CNAME to Route53) or Email
  -> Validate -> Certificate issued

Then in CloudFront distribution settings:
  Alternate domain names: cdn.example.com
  Custom SSL certificate: your-acm-cert
```

---

## 9. Geo Restriction

CloudFront can allow or block access based on the viewer's country.

### Allowlist (Whitelist)

```
Only allow access from these countries:
  United States
  Canada
  United Kingdom

Users in other countries receive 403 Forbidden
```

### Blocklist (Blacklist)

```
Block access from these countries:
  [list specific countries]

All other countries allowed
```

### Configuration

```
CloudFront Console -> Distribution -> Security -> Geo restriction
Type: Allowlist or Blocklist
Countries: Select from list
```

### CloudFront vs AWS WAF for Geo Restrictions

| Feature | CloudFront Geo Restriction | AWS WAF Geo Match |
|---------|--------------------------|------------------|
| Granularity | Country only | Country, IP, headers |
| Cost | Free | WAF costs (~$5/month) |
| Custom error | 403 only | Custom |
| Combine with other rules | No | Yes (complex rules) |

For simple country blocking, use CloudFront's built-in. For complex rules, use WAF.

---

## 10. Lambda@Edge and CloudFront Functions

### The Concept: Edge Computing

Execute code at CloudFront edge locations, close to users, without managing servers.

```
Four trigger points:

[Viewer]                           [Origin]
   |                                   |
   | Viewer Request                    | Origin Request
   |   (before cache check)            |   (cache miss, before origin)
   v                                   v
[CloudFront Edge]              [CloudFront Edge]
   ^                                   ^
   | Viewer Response                   | Origin Response
   |   (before returning to viewer)    |   (after origin responds)
   |                                   |
```

### Lambda@Edge

Full AWS Lambda functions deployed at edge locations.

**Capabilities:**
- Node.js and Python
- Up to 128 MB memory (viewer) / 10 GB (origin)
- Execution timeout: 5 sec (viewer) / 30 sec (origin)
- Access to request/response body
- Network access, file system access
- Can make external HTTP calls

**Use cases:**

```
1. A/B Testing (Viewer Request):
   - Check user's cookie
   - Route to different origin based on cookie
   - Set experiment cookie for new users

2. Authentication (Viewer Request):
   - Validate JWT token
   - Return 401 if invalid
   - Before content is served

3. URL Rewriting (Origin Request):
   - /users/123 -> /users?id=123
   - Map old URLs to new API format

4. Adding Security Headers (Viewer Response):
   - Strict-Transport-Security
   - Content-Security-Policy
   - X-Frame-Options

5. Dynamic Resizing (Origin Response):
   - Detect device type from User-Agent
   - Resize images on the fly
   - Return appropriate size
```

**Lambda@Edge Example — Add Security Headers:**
```javascript
exports.handler = async (event) => {
    const response = event.Records[0].cf.response;
    const headers = response.headers;
    
    headers['strict-transport-security'] = [{
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubdomains; preload'
    }];
    
    headers['content-security-policy'] = [{
        key: 'Content-Security-Policy',
        value: "default-src 'self'; img-src 'self' data:;"
    }];
    
    headers['x-frame-options'] = [{
        key: 'X-Frame-Options',
        value: 'DENY'
    }];
    
    return response;
};
```

### CloudFront Functions

Lightweight JavaScript functions for simple transformations. Faster and cheaper than Lambda@Edge.

**Capabilities:**
- JavaScript only
- 2 MB memory
- Execution time < 1ms
- Only Viewer Request and Viewer Response triggers
- Cannot access network (no HTTP calls)
- Cannot access file system

**Use cases:**

```
1. URL redirects and rewrites
2. HTTP header manipulation  
3. Cache key normalization
4. Request authorization (simple token check)
```

**CloudFront Functions Example — URL Normalization:**
```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // Normalize URL: remove trailing slash
    if (uri.endsWith('/') && uri.length > 1) {
        request.uri = uri.slice(0, -1);
    }
    
    // Add index.html for directory requests
    if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
    }
    
    return request;
}
```

### Lambda@Edge vs CloudFront Functions

| Feature | CloudFront Functions | Lambda@Edge |
|---------|---------------------|------------|
| Runtime | JavaScript (ES5.1) | Node.js, Python |
| Scale | Millions/sec | Thousands/sec |
| Execution time | < 1ms | 5-30 seconds |
| Memory | 2 MB | 128 MB - 10 GB |
| Network access | No | Yes |
| File system | No | Yes |
| Triggers | Viewer only | All 4 triggers |
| Cost | $0.10/million | $0.60/million + duration |
| Use case | Simple transforms | Complex processing |

---

## 11. Signed URLs and Signed Cookies

Used to restrict access to **private content** — only authorized users can access.

### When to Use

```
Public content:   Anyone can access (default)
Private content:  Only users with valid signed URL or cookie

Use cases:
- Premium video content (only paying subscribers)
- Downloaded files (only authenticated users)
- Time-limited access (download link expires in 1 hour)
- IP-restricted access
```

### Signed URLs

One signed URL per file. Good for:
- Single file downloads
- RTMP streaming
- Sharing a specific file

```
Signed URL contains:
  - URL to the file
  - Expiration time
  - Allowed IP (optional)
  - Digital signature (RSA SHA-1)

Example signed URL:
https://d1234.cloudfront.net/private/video.mp4
  ?Policy=eyJTdGF0...
  &Signature=ZSuv7...
  &Key-Pair-Id=APKAJKG...
```

**Creating Signed URLs:**
```python
import boto3
from botocore.signers import CloudFrontSigner
from datetime import datetime, timedelta
import rsa

def create_signed_url(url, expiration_hours=1):
    key_id = 'APKAJKG...'  # CloudFront key pair ID
    
    with open('private_key.pem', 'rb') as f:
        private_key = rsa.PrivateKey.load_pkcs1(f.read())
    
    def rsa_signer(message):
        return rsa.sign(message, private_key, 'SHA-1')
    
    signer = CloudFrontSigner(key_id, rsa_signer)
    expiration = datetime.utcnow() + timedelta(hours=expiration_hours)
    
    return signer.generate_presigned_url(url, date_less_than=expiration)

signed_url = create_signed_url('https://d1234.cloudfront.net/private/video.mp4')
```

### Signed Cookies

Same as signed URLs but use cookies instead. Good for:
- Multiple files (entire section of content)
- Maintaining user experience (URL doesn't change)

```
Cookies set in browser:
  CloudFront-Policy: [base64 encoded policy]
  CloudFront-Signature: [digital signature]
  CloudFront-Key-Pair-Id: [key pair ID]

All requests to CloudFront include these cookies
CloudFront validates on every request
```

### Trusted Key Groups

The modern way to manage signing keys:

```
Old method: Root AWS account key pairs (avoid!)
New method: Key groups with IAM-managed public keys

1. Generate RSA key pair
2. Upload public key to CloudFront
3. Create key group with the public key
4. Associate key group with distribution behavior

This allows key rotation without IAM root credentials
```

### Signed URL vs Signed Cookie

| Feature | Signed URL | Signed Cookie |
|---------|-----------|---------------|
| Scope | Single file | Multiple files |
| URL changed | Yes (long URL) | No (clean URL) |
| Browser support | All | Requires cookie support |
| RTMP | Supported | Not supported |
| Use case | Single download | Premium content section |

---

## 12. Price Classes

CloudFront charges vary by edge location used. Price Classes let you control costs.

### Regions and Pricing

Approximate pricing tiers (higher = more expensive):
```
Price Class 100 (cheapest):
  United States, Canada, Europe, Israel
  ~$0.0085/10k HTTPS requests from US

Price Class 200 (medium):
  Includes PC100 + South Africa, Kenya, South Korea,
  Japan, Singapore, India

Price Class All (most expensive, best performance):
  All edge locations globally including
  South America, Australia, South Africa
```

### Cost Comparison

| Price Class | Edge Locations | Cost | Best For |
|-------------|---------------|------|---------|
| 100 | US + Europe | Lowest | US/EU audience |
| 200 | + Asia, Africa | Medium | Global minus South America/Oceania |
| All | Everywhere | Highest | Truly global |

### Choosing Price Class

```
Audience mostly in US/Europe:
  -> Price Class 100 (saves ~30-40% vs All)

Audience in US, Europe, Asia:
  -> Price Class 200

Global audience, latency critical:
  -> Price Class All
```

---

## 13. CloudFront Security

### AWS WAF Integration

Attach AWS Web Application Firewall to CloudFront:

```
WAF Rules on CloudFront:
- SQL injection protection
- XSS (Cross-Site Scripting) protection
- Rate limiting (throttle per IP)
- IP allowlist/blocklist
- Geographic restrictions
- Bot Control (managed rule group)

Traffic flow:
User -> CloudFront Edge -> WAF Rules -> [Allow/Block] -> Origin
```

### DDoS Protection

CloudFront provides built-in DDoS protection:
- **AWS Shield Standard** (free): Protection against common DDoS attacks
- **AWS Shield Advanced** (paid): Enhanced protection, 24/7 DRT support

### Origin Shield

An additional caching layer between CloudFront edge locations and your origin:

```
Without Origin Shield:
  Edge Location 1 (cache miss) -> Origin
  Edge Location 2 (cache miss) -> Origin
  Edge Location 3 (cache miss) -> Origin
  Result: 3 requests to origin

With Origin Shield (in optimal region):
  Edge Location 1 (cache miss) -> Origin Shield (cache miss) -> Origin
  Edge Location 2 (cache miss) -> Origin Shield (cache HIT!)
  Edge Location 3 (cache miss) -> Origin Shield (cache HIT!)
  Result: 1 request to origin
```

Origin Shield:
- Reduces origin load (fewer cache misses reach origin)
- Reduces origin bandwidth costs
- Adds ~$0.01/GB cost for Origin Shield processing

### HTTPS Between CloudFront and Origin (SSL Termination)

```
Three possible configurations:

1. Viewer HTTPS only + Origin HTTP:
   Viewer <--HTTPS--> CloudFront <--HTTP--> Origin
   CloudFront terminates SSL, backend unencrypted
   OK for trusted private networks

2. Viewer HTTPS + Origin HTTPS:
   Viewer <--HTTPS--> CloudFront <--HTTPS--> Origin
   End-to-end encryption (recommended for sensitive data)

3. Match Viewer:
   Viewer protocol matches what's used to origin
   If viewer uses HTTPS, CloudFront uses HTTPS to origin
```

---

## 14. Invalidations

When you update content in your origin, CloudFront may continue serving the old cached version until TTL expires.

**Invalidation** forces CloudFront to remove cached content and fetch fresh content from origin.

### Creating Invalidations

```
CloudFront Console -> Distribution -> Invalidations -> Create

Invalidation paths:
  /images/logo.png        <- specific file
  /css/*                  <- all CSS files
  /*                      <- everything (expensive!)

Via CLI:
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/images/logo.png" "/css/*"
```

### Invalidation Costs

- First 1,000 invalidation paths per month: **free**
- Beyond 1,000: $0.005 per path per distribution

**`/*` counts as 1 path** but invalidates all cached files.

### Better Alternatives to Invalidations

1. **Versioned filenames**: `app.v2.js` instead of `app.js`
2. **Query string versioning**: `app.js?v=20240101`
3. **Short TTL**: Set appropriate TTL per content type
4. **Atomic deployments**: Replace entire distribution

---

## 15. Real-World Architectures

### Architecture 1: Static Website with CloudFront + S3

```
                    Internet Users
                          |
                 [Route53: cdn.example.com]
                          |
                    [CloudFront]
                    d1234.cloudfront.net
                          |
               +----------+-----------+
               |                      |
        Cache Hit               Cache Miss
               |                      |
        Return cached           [S3 Origin]
        content                 (private bucket)
                                via OAC
                                      |
                               Return content
                               to CloudFront
                               -> cache -> user

Security:
  - S3 bucket: private (only OAC can read)
  - CloudFront: HTTPS only
  - WAF: basic protection
  - ACM certificate for cdn.example.com
```

### Architecture 2: API + Static Frontend

```
example.com          -> CloudFront (static React app in S3)
api.example.com      -> CloudFront -> ALB -> EC2/ECS (API)

Single CloudFront distribution, multiple origins:
  /api/*    -> ALB origin (no caching, TTL 0)
  /*        -> S3 origin  (cached, TTL 86400)

Benefits:
  - Same domain for frontend and API (no CORS issues)
  - Both paths benefit from CloudFront edge network
  - API gets DDoS protection
```

### Architecture 3: Multi-Region Active-Active

```
Route53: latency-based routing
  example.com
    -> CloudFront-US (us-east-1 origin)
    -> CloudFront-EU (eu-west-1 origin)
    -> CloudFront-AP (ap-southeast-1 origin)

User in London -> Route53 sends to CloudFront-EU
  -> EU edge location (likely London) checks cache
  -> Cache miss -> eu-west-1 origin

Benefits:
  - Data sovereignty (EU users served from EU)
  - Low latency globally
  - Independent scaling per region
```

---

## 16. Interview Q&A

**Q1: What is the difference between CloudFront and an S3 Transfer Acceleration?**

A: Both improve content delivery, but differently:
- **CloudFront**: CDN that caches content at edge locations globally. Best for content that is read many times (static files, media).
- **S3 Transfer Acceleration**: Uses CloudFront's edge network to accelerate uploads TO S3. Uses optimized network paths but doesn't cache content. Best for large file uploads from distant locations.

---

**Q2: How do you ensure users only access S3 content through CloudFront (not directly)?**

A: Use **Origin Access Control (OAC)**:
1. Create OAC and attach it to the CloudFront distribution
2. Update the S3 bucket policy to only allow the CloudFront service principal with the OAC condition
3. Keep the S3 bucket private (no public access)

With this setup, direct S3 URLs return 403 Forbidden. Only CloudFront can fetch the content.

---

**Q3: What is Lambda@Edge and when would you use it instead of CloudFront Functions?**

A:
- **CloudFront Functions**: Lightweight JavaScript, < 1ms, only viewer request/response triggers. For simple URL rewrites, header manipulation, cache key normalization.
- **Lambda@Edge**: Full Lambda (Node.js/Python), up to 30 seconds, all 4 triggers, network access. For complex logic: authentication, image resizing, dynamic routing, external API calls.

Use CloudFront Functions for simple, fast transforms. Use Lambda@Edge when you need compute, network, or complex logic.

---

**Q4: How would you implement authentication with CloudFront?**

A: Several approaches:
1. **Lambda@Edge (Viewer Request)**: Validate JWT tokens at the edge. Reject unauthorized requests before they reach origin.
2. **Signed URLs/Signed Cookies**: Pre-authorize content access with time-limited signed tokens.
3. **CloudFront + Cognito**: Lambda@Edge validates Cognito JWT tokens.
4. **AWS WAF + CloudFront**: Block requests without specific headers.

---

**Q5: ACM certificate for CloudFront must be in which region?**

A: **us-east-1 (N. Virginia)**. This is because CloudFront is a global service that distributes certificates globally from its us-east-1 control plane. If you request a certificate in any other region, it won't appear as an option in CloudFront distribution settings.

---

**Q6: How does a CloudFront cache miss work?**

A: When a cache miss occurs at an edge location:
1. Edge forwards request to the **Regional Edge Cache** for that region
2. If Regional Edge Cache has it, returns it and edge caches it
3. If Regional Edge Cache also misses, it forwards to the **origin**
4. Origin returns content, Regional Edge Cache caches it, Edge caches it
5. Returns to viewer

This two-tier caching reduces origin load significantly.

---

**Q7: What is CloudFront Origin Shield and when should you use it?**

A: Origin Shield is an additional caching layer in one AWS region that sits between all CloudFront edge locations and your origin. It consolidates origin fetches: instead of 50 edge locations all missing cache and hitting origin, they all check Origin Shield first. If Origin Shield has it, origin gets only 1 request.

Use when:
- Your origin has limited capacity
- You want to minimize origin bandwidth costs
- Your content is accessed from many global edge locations

---

**Q8: Explain the difference between TTL settings in CloudFront.**

A:
- **Minimum TTL**: CloudFront never serves cached content older than this, even if Cache-Control says longer
- **Maximum TTL**: CloudFront never serves cached content older than this, even if Cache-Control says longer
- **Default TTL**: Used when origin response has no Cache-Control header

Priority: Origin Cache-Control header is respected within the min/max boundaries. If no Cache-Control from origin, Default TTL is used.

---

**Q9: How would you handle a SPA (Single Page Application) 404 error routing in CloudFront?**

A: For React Router, Vue Router, etc., direct URL access to routes like `/about` returns 404 from S3 (file doesn't exist). Solution:

Create a custom error page:
```
CloudFront Distribution -> Error Pages -> Create custom error response
HTTP Error Code: 404
Response Page Path: /index.html
HTTP Response Code: 200
```

This returns `index.html` for all 404s, letting the SPA router handle routing client-side.

---

**Q10: What are the costs associated with CloudFront?**

A:
- **Data transfer out** (to internet): varies by region, ~$0.0085/GB (US), higher for Asia/South America
- **HTTP requests**: ~$0.0075/10,000 requests (HTTPS)
- **Invalidations**: First 1,000 paths/month free, then $0.005/path
- **Lambda@Edge**: $0.60/million requests + $0.00005001/GB-second
- **CloudFront Functions**: $0.10/million invocations
- **Origin Shield**: Additional per-GB charge
- **WAF**: Separate charges

Free tier: 1 TB data transfer + 10M HTTP requests per month for first 12 months.

---

*End of CloudFront Complete Guide*
