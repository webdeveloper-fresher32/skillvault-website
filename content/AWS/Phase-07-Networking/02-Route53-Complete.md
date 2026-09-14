# Route53 — Complete DNS and Routing Guide

> Amazon Route53 is AWS's scalable DNS web service and domain registrar. Named after port 53, the standard DNS port.

---

## Table of Contents

1. [What is Route53?](#1-what-is-route53)
2. [DNS Fundamentals](#2-dns-fundamentals)
3. [DNS Record Types](#3-dns-record-types)
4. [Hosted Zones](#4-hosted-zones)
5. [Creating DNS Records](#5-creating-dns-records)
6. [Routing Policies](#6-routing-policies)
7. [Health Checks](#7-health-checks)
8. [Alias Records vs CNAME](#8-alias-records-vs-cname)
9. [Route53 as Domain Registrar](#9-route53-as-domain-registrar)
10. [Private DNS](#10-private-dns)
11. [DNSSEC](#11-dnssec)
12. [Hands-on Lab](#12-hands-on-lab)
13. [Interview Q&A](#13-interview-qa)

---

## 1. What is Route53?

**Amazon Route53** is a highly available and scalable Domain Name System (DNS) web service. It has three main functions:

```
Route53 Functions:
1. Domain Registration   - Buy/manage domain names
2. DNS Resolution        - Translate domain names to IP addresses
3. Health Checking       - Monitor endpoint health, route accordingly
```

### Why "Route53"?
Named after TCP/UDP port 53, which is the standard port for DNS queries.

### Key Features
- **100% SLA**: Route53 is the only AWS service with a 100% uptime SLA
- **Globally distributed**: Anycast routing network of DNS servers worldwide
- **Integration**: Deep integration with AWS services (ALB, CloudFront, S3, etc.)
- **Programmable**: Full API support for DNS management
- **Health checks**: Route traffic based on endpoint health

### How DNS Works (Overview)

```
User types: www.example.com
                |
                v
[Browser Cache] -> [OS Cache] -> [Local DNS Resolver (ISP)]
                                        |
                                        v (if not cached)
                              [Root DNS Servers (.)]
                                        |
                                        v
                              [TLD DNS Servers (.com)]
                                        |
                                        v
                              [Authoritative DNS (Route53)]
                                        |
                                        v
                              Returns: 93.184.216.34
                                        |
                                        v
                              Browser connects to 93.184.216.34
```

**TTL (Time to Live)**: DNS responses include a TTL value. Resolvers cache the answer for this duration and don't query again until TTL expires.

---

## 2. DNS Fundamentals

### Domain Name Hierarchy

```
.                           <- Root
com.                        <- Top-Level Domain (TLD)
example.com.                <- Second-Level Domain (Registered domain)
www.example.com.            <- Subdomain (fully qualified)
mail.example.com.           <- Another subdomain
api.v2.example.com.         <- Third-level subdomain
```

### DNS Resolution Process (Detailed)

```
1. User queries: api.example.com

2. Recursive Resolver (your ISP or 8.8.8.8):
   - Checks its cache -> not found
   - Queries Root servers

3. Root servers (.):
   - "I don't know api.example.com, but for .com, ask these servers"
   - Returns TLD nameservers for .com

4. TLD servers (.com):
   - "I don't know api.example.com, but example.com is managed by these NS:"
   - ns1.awsdns-01.com, ns2.awsdns-01.net (Route53 NS records)

5. Route53 (Authoritative):
   - "api.example.com = 1.2.3.4"
   - Returns A record with TTL

6. Recursive resolver caches the answer for TTL duration
   Returns 1.2.3.4 to the user
```

### Key DNS Concepts

| Term | Definition |
|------|-----------|
| Authoritative DNS | The DNS server that holds the actual DNS records for a domain |
| Recursive Resolver | DNS server that queries on behalf of the client |
| Root Servers | 13 root server groups (a-m.root-servers.net) at top of DNS hierarchy |
| TLD | Top-level domains: .com, .org, .io, .au, etc. |
| FQDN | Fully Qualified Domain Name: includes all labels to the root (www.example.com.) |
| TTL | Time to Live: how long DNS answer is cached (seconds) |
| Propagation | Time for DNS changes to spread globally (can take up to 48hrs due to TTL) |

---

## 3. DNS Record Types

### A Record (Address)

Maps a hostname to an **IPv4 address**.

```
Type: A
Name: www.example.com
Value: 93.184.216.34
TTL: 300

Result: www.example.com -> 93.184.216.34
```

Multiple A records = simple load balancing (DNS round-robin):
```
www.example.com A 1.2.3.4
www.example.com A 5.6.7.8
www.example.com A 9.10.11.12
```

### AAAA Record (IPv6 Address)

Maps a hostname to an **IPv6 address**.

```
Type: AAAA
Name: www.example.com
Value: 2606:2800:220:1:248:1893:25c8:1946
TTL: 300
```

### CNAME Record (Canonical Name)

Maps a hostname to **another hostname** (alias).

```
Type: CNAME
Name: blog.example.com
Value: www.example.com

Result: blog.example.com -> www.example.com -> [IP of www.example.com]

Important rules:
- Cannot use CNAME for zone apex (root domain): example.com
- Can only point to another hostname, NOT an IP
- Only one level of CNAME typically (avoid chaining)
```

**When to use CNAME:**
- Map blog.example.com to www.example.com
- Map your domain to a CDN or load balancer hostname
- Map subdomain to an external service

### MX Record (Mail Exchange)

Specifies **mail servers** for the domain.

```
Type: MX
Name: example.com
Priority: 10
Value: mail1.example.com

Priority: 20
Value: mail2.example.com

Lower priority number = higher preference
```

### TXT Record (Text)

Stores **arbitrary text** — used for verification and configuration.

```
Type: TXT
Name: example.com
Value: "v=spf1 include:_spf.google.com ~all"   <- SPF for email
Value: "google-site-verification=xxxxxxxxxx"    <- Domain ownership verification
Value: "v=DMARC1; p=reject; rua=mailto:..."    <- DMARC policy
```

Common TXT record uses:
- **SPF**: Email sender policy framework (prevent spam)
- **DKIM**: DomainKeys Identified Mail (email signing)
- **DMARC**: Domain-based Message Authentication
- **Domain verification**: Prove ownership to Google, AWS, etc.

### NS Record (Name Server)

Specifies the **authoritative name servers** for a domain.

```
Type: NS
Name: example.com
Value: ns-123.awsdns-45.com
Value: ns-456.awsdns-67.net
Value: ns-789.awsdns-89.org
Value: ns-012.awsdns-34.co.uk
```

Route53 provides 4 NS records when you create a hosted zone. These tell the internet "Route53 is authoritative for this domain."

### SOA Record (Start of Authority)

Contains **administrative information** about the zone.

```
Type: SOA
Name: example.com
Value: ns-123.awsdns-45.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400

Fields:
- Primary NS server
- Admin email (. replaces @)
- Serial number
- Refresh interval
- Retry interval
- Expire time
- Minimum TTL
```

Every zone has exactly one SOA record. Route53 manages this automatically.

### PTR Record (Pointer)

Used for **reverse DNS lookups** (IP -> hostname).

```
Type: PTR
Name: 34.216.184.93.in-addr.arpa
Value: www.example.com

Result: Looking up 93.184.216.34 -> www.example.com
```

Mainly used for email server reputation and logging.

### SRV Record (Service)

Specifies **location of services** (port, priority, weight).

```
Type: SRV
Name: _service._proto.example.com
Priority: 10
Weight: 5
Port: 8080
Value: host.example.com
```

Used by applications like SIP, XMPP, gaming, Kubernetes.

### CAA Record (Certification Authority Authorization)

Specifies which **Certificate Authorities** can issue SSL/TLS certificates.

```
Type: CAA
Name: example.com
Flag: 0
Tag: issue
Value: "letsencrypt.org"
```

---

## 4. Hosted Zones

A **Hosted Zone** is a container for DNS records for a specific domain.

### Public Hosted Zone

- Contains records for a **publicly accessible domain** (accessible from the internet)
- Created automatically when you register a domain with Route53
- Or created manually when you transfer DNS management to Route53

```
Public Hosted Zone: example.com
+----------------------------------+
| www.example.com  A  1.2.3.4     |
| api.example.com  A  5.6.7.8     |
| mail.example.com MX mail1...     |
| example.com      SOA ...        |
| example.com      NS  ns-123...  |
+----------------------------------+
Accessible from: Anywhere on the internet
Cost: $0.50/month per hosted zone
```

### Private Hosted Zone

- Contains records **only resolvable within one or more VPCs**
- Instances outside the associated VPCs cannot resolve these records
- Enables custom DNS for internal services

```
Private Hosted Zone: internal.company.com
+------------------------------------------+
| db.internal.company.com  A  10.0.10.50  |
| cache.internal.company.com A 10.0.10.51 |
| api.internal.company.com A  10.0.10.52  |
+------------------------------------------+
Accessible from: Only associated VPCs
Cost: $0.50/month per hosted zone
```

**Use case for Private Hosted Zones:**
- Internal service discovery
- Database connection strings use hostname instead of IP
- Environment-specific DNS (same hostname, different IPs in different VPCs)
- Microservices communication

### Hosted Zone Costs

- $0.50 per hosted zone per month (first 25)
- $0.10 per hosted zone per month (over 25)
- Plus query charges:
  - $0.40 per million queries (first 1 billion)
  - $0.20 per million queries (over 1 billion)

---

## 5. Creating DNS Records

### Via AWS Console

```
Route53 Console
-> Hosted Zones
-> Select your zone
-> Create Record

Name: www
Type: A
Value: 1.2.3.4
TTL: 300
-> Create records
```

### Via AWS CLI

```bash
# Create A record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.example.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "1.2.3.4"}]
      }
    }]
  }'

# List records
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234567890
```

### TTL Recommendations

| Record Type | Recommended TTL | Why |
|-------------|----------------|-----|
| Root/Apex | 3600 (1 hour) | Stable, rarely changes |
| Subdomains | 300 (5 min) | Can change for deployments |
| During migration | 60 (1 min) | Low TTL before change |
| After migration | 3600 (1 hour) | Back to normal |
| Health-checked records | 30-60 seconds | Quick failover |

---

## 6. Routing Policies

This is the most important section for AWS exams. Route53 has 7 routing policies.

### Simple Routing

**Use case**: Single resource serving all traffic. No health checks.

```
www.example.com -> 1.2.3.4

Or multiple values (DNS round-robin):
www.example.com -> [1.2.3.4, 5.6.7.8, 9.10.11.12]
Client gets all IPs, picks randomly
```

```
Route53 Console:
  Routing Policy: Simple
  Name: www
  Type: A
  Value: 1.2.3.4
```

**When to use**: Single server, static websites, no failover needed.
**Limitation**: No health checks for simple routing with single value.

---

### Weighted Routing

**Use case**: Send a percentage of traffic to different resources.

```
Blue-Green Deployment:
  www.example.com (weight 90) -> Blue environment 1.2.3.4  (90% of traffic)
  www.example.com (weight 10) -> Green environment 5.6.7.8 (10% of traffic)

Traffic split = weight / sum of all weights
90 / (90+10) = 90%
10 / (90+10) = 10%
```

```
Route53 Console:
  Routing Policy: Weighted
  Name: www
  Type: A
  Value: 1.2.3.4
  Weight: 90
  Record ID: blue-record

  Routing Policy: Weighted
  Name: www
  Type: A
  Value: 5.6.7.8
  Weight: 10
  Record ID: green-record
```

**Special case**: Weight 0 = send no traffic to this resource (but it still exists).
**All weights 0**: Traffic distributed equally.

**Use cases:**
- A/B testing new features
- Canary deployments
- Gradually shifting traffic during migration
- Load distribution

---

### Latency-Based Routing

**Use case**: Route users to the AWS region with the lowest latency.

```
User in Japan:
  www.example.com
    -> us-east-1 (1.2.3.4)    latency: 180ms
    -> ap-northeast-1 (5.6.7.8) latency: 15ms  <- Route here!
    
User in New York:
  www.example.com
    -> us-east-1 (1.2.3.4)    latency: 10ms   <- Route here!
    -> ap-northeast-1 (5.6.7.8) latency: 185ms
```

```
Route53 Console:
  Routing Policy: Latency
  Name: www
  Type: A
  Value: 1.2.3.4
  Region: us-east-1
  
  Routing Policy: Latency
  Name: www
  Type: A
  Value: 5.6.7.8
  Region: ap-northeast-1
```

**Important**: Latency is measured from the AWS edge to AWS region, not from user to your server. AWS maintains latency tables based on historical data.

---

### Failover Routing

**Use case**: Active-passive high availability. Route to secondary if primary fails.

```
Normal:
  www.example.com -> Primary (1.2.3.4) [Health check: HEALTHY]

Failover:
  www.example.com -> Secondary (5.6.7.8) [Primary health check: UNHEALTHY]
```

```
Route53 Console:
  Routing Policy: Failover
  Name: www
  Type: A
  Value: 1.2.3.4
  Failover Record Type: Primary
  Health Check: hc-xxxxx (must attach health check to primary)

  Routing Policy: Failover
  Name: www
  Type: A
  Value: 5.6.7.8
  Failover Record Type: Secondary
  (No health check required on secondary)
```

**Important**: Primary record MUST have a health check. Secondary is used only when primary is unhealthy.

**Use cases:**
- DR (Disaster Recovery) — primary active region, secondary DR region
- Active-passive architectures
- Static error page as secondary (S3 bucket)

---

### Geolocation Routing

**Use case**: Route based on user's **geographic location** (country or continent).

```
US users -> us-east-1 servers
EU users -> eu-west-1 servers
Asia users -> ap-southeast-1 servers
Default -> us-east-1 (for locations not matched)
```

```
Route53 Console:
  Routing Policy: Geolocation
  Name: www
  Type: A
  Value: 1.2.3.4
  Location: United States

  Routing Policy: Geolocation
  Name: www
  Type: A
  Value: 5.6.7.8
  Location: Europe

  Routing Policy: Geolocation
  Name: www
  Type: A
  Value: 9.10.11.12
  Location: Default  <- IMPORTANT: always create a default
```

**Always create a Default location** — otherwise users from unmatched locations get NXDOMAIN.

**Granularity options:**
- Continent (Africa, Antarctica, Asia, Europe, Oceania, North America, South America)
- Country (any country code)
- US State (US subdivisions)

**Use cases:**
- Content localization (different content for different countries)
- Legal compliance (restrict access in certain countries)
- Latency optimization by approximate location
- Multi-language applications

---

### Geoproximity Routing (Traffic Flow only)

**Use case**: Route traffic based on geographic location with configurable **bias** values.

```
Standard:
  Users near us-east-1 -> us-east-1
  Users near eu-west-1 -> eu-west-1

With Bias +50 on us-east-1:
  us-east-1 "expands" its coverage area
  More users (even some European) are routed to us-east-1
  
With Bias -50 on us-east-1:
  us-east-1 "shrinks" its coverage area
  More users routed to other regions
```

**Bias values**: -99 to +99
- Positive bias: expand coverage (attract more traffic)
- Negative bias: shrink coverage (route more traffic away)

**Requires Route53 Traffic Flow** — cannot be configured directly, must use Traffic Flow visual editor ($50/month per policy).

**Use cases:**
- Shift traffic gradually between regions
- Handle data residency requirements with flexibility
- Optimize costs (prefer cheaper region if close enough)

---

### Multivalue Answer Routing

**Use case**: Returns multiple healthy records (like Simple with health checks).

```
www.example.com -> [1.2.3.4, 5.6.7.8, 9.10.11.12]

With health checks:
  1.2.3.4   HEALTHY  -> included in response
  5.6.7.8   UNHEALTHY -> excluded from response
  9.10.11.12 HEALTHY -> included in response

Response: [1.2.3.4, 9.10.11.12]
Client randomly picks one
```

Route53 returns up to **8 healthy records** per query.

```
Route53 Console:
  Create multiple records with same name:
  
  Routing Policy: Multivalue Answer
  Name: www
  Type: A
  Value: 1.2.3.4
  Health Check: hc-1

  Routing Policy: Multivalue Answer
  Name: www
  Type: A
  Value: 5.6.7.8
  Health Check: hc-2
```

**Important distinction from Simple**: Multivalue with health checks only returns healthy IPs. Simple routing (with multiple values) returns all values regardless of health.

**Multivalue is NOT a load balancer** — it's client-side load balancing via DNS. Use ALB/NLB for true load balancing.

---

### Routing Policy Summary

| Policy | Use Case | Key Feature |
|--------|---------|-------------|
| Simple | One resource, basic | Single value or round-robin |
| Weighted | A/B test, canary | % based traffic split |
| Latency | Global app, low latency | AWS region latency-based |
| Failover | Active-passive HA | Health-check driven failover |
| Geolocation | Localization, compliance | Country/continent routing |
| Geoproximity | Traffic shaping | Adjustable coverage areas |
| Multivalue | Client-side LB | Multiple healthy records |

---

## 7. Health Checks

Route53 Health Checks monitor the health of your resources and influence routing decisions.

### Types of Health Checks

**1. Endpoint Health Checks**
Monitors a specific IP address or hostname:
```
Type: HTTP/HTTPS/TCP
Protocol: HTTPS
Domain/IP: api.example.com
Port: 443
Path: /health
String matching: "OK" (optional)
Interval: 30 seconds (or 10 seconds = fast health check)
Failure threshold: 3 (mark unhealthy after 3 consecutive failures)
```

**2. CloudWatch Alarm Health Checks**
Mark unhealthy based on a CloudWatch alarm state:
```
Monitor: CloudWatch Alarm
Alarm: high-5xx-error-rate
When alarm is: In ALARM state -> health check is unhealthy
```

Useful when your health endpoint returns 200 but the service is actually degraded.

**3. Calculated Health Checks**
Combines results from multiple health checks:
```
Child health checks: hc-server1, hc-server2, hc-server3
Healthy if: At least 2 of 3 are healthy
```

### Health Check Configuration

```
Monitoring Locations: Route53 uses 15+ global health check locations
Response time: < 4 seconds for HTTP, < 10 seconds for HTTPS
Failure threshold: 1-10 (how many failures before marking unhealthy)
Success threshold: 1-10 (how many successes before marking healthy again)
```

### Health Check Costs

- $0.50/month per endpoint (basic)
- $1.00/month per endpoint (fast, 10-second interval)
- $1.00/month per CloudWatch alarm health check
- $0.50/month per calculated health check

### Private Endpoint Health Checks

Health checkers are on the public internet — they cannot check private resources directly.

**Solution:**
```
1. Install CloudWatch Agent on private EC2
2. Push custom metric to CloudWatch (e.g., "is_healthy" = 1 or 0)
3. Create CloudWatch Alarm on this metric
4. Create Route53 health check of type "CloudWatch Alarm"
```

---

## 8. Alias Records vs CNAME

This is a **critical distinction** for AWS exams.

### The Problem with CNAME

A CNAME cannot be used at the **zone apex** (root domain).

```
INVALID:
  example.com CNAME alb-1234567.us-east-1.elb.amazonaws.com.
  
  Why invalid? example.com is the zone apex. RFC prohibits CNAME at zone apex
  because the zone apex holds NS and SOA records, which cannot coexist with CNAME.

VALID:
  www.example.com CNAME alb-1234567.us-east-1.elb.amazonaws.com.
```

But what if you want `example.com` (no www) to point to your ALB?

### The Solution: Alias Records

Route53 Alias records are a Route53-specific extension to DNS that solve the zone apex problem.

```
VALID Alias:
  example.com A ALIAS alb-1234567.us-east-1.elb.amazonaws.com.
  
Behavior:
  Route53 resolves the ALB hostname to its current IPs
  Returns those IPs as A records
  Transparent to the DNS client
```

### Alias Record Targets (supported)

- Elastic Load Balancers (ALB, NLB, CLB)
- CloudFront distributions
- API Gateway
- Elastic Beanstalk environments
- S3 websites (not S3 buckets)
- VPC Interface Endpoints
- Other Route53 records in the same hosted zone
- Global Accelerator

### CNAME vs Alias Comparison

| Feature | CNAME | Alias |
|---------|-------|-------|
| Zone apex | NOT allowed | Allowed |
| AWS resources | Works but not optimal | Works and recommended |
| DNS query count | Costs: extra queries to resolve CNAME chain | Free: Route53 resolves internally |
| TTL | You set TTL | Automatically managed by AWS |
| Health check | Can attach | Can attach |
| Target | Any hostname | Only specific AWS resources |
| Works outside AWS | Yes | Route53 only |

### When to Use Each

**Use CNAME when:**
- Pointing a subdomain to a non-AWS service (e.g., blog.example.com -> myshopify.com)
- Pointing between subdomains

**Use Alias when:**
- Pointing any domain (including apex) to AWS resources
- Pointing to ALB, CloudFront, API Gateway
- Reduces DNS query costs (Alias queries within Route53 are free)

---

## 9. Route53 as Domain Registrar

Route53 can be used as a **domain registrar** to buy and manage domain names.

### Registering a Domain

```
Route53 Console
-> Registered Domains
-> Register Domain
-> Search for domain name (e.g., myawsdemo.com)
-> Add to cart: $13/year for .com
-> Fill in contact information
-> Complete purchase
```

After registration:
- Route53 automatically creates a hosted zone
- Provides 4 NS records
- Domain is automatically configured to use Route53 for DNS

### Transferring Domain to Route53

If you have a domain at another registrar (GoDaddy, Namecheap):

```
1. At current registrar: Unlock domain, get transfer authorization code (EPP code)
2. In Route53: Registered Domains -> Transfer Domain
3. Enter domain name and authorization code
4. Route53 verifies and initiates transfer
5. Current registrar sends confirmation email
6. Approve the transfer
7. Transfer takes 5-7 days
8. Route53 becomes both registrar and DNS provider
```

### Using Route53 for DNS with Domain at Another Registrar

You don't have to transfer the domain to use Route53 for DNS:

```
1. Create hosted zone in Route53 for your domain
2. Note the 4 NS records Route53 provides
3. At your registrar (GoDaddy, etc.), update nameservers to Route53's NS records
4. DNS queries now resolved by Route53
```

This is common — many use Cloudflare or external registrar but Route53 for DNS.

### Domain Prices

- .com: $13/year
- .io: $39/year
- .org: $12/year
- .net: $11/year
- See full list: https://d32ze2gidvkk54.cloudfront.net/Amazon_Route_53_Domain_Registration_Pricing_20140731.pdf

---

## 10. Private DNS

Private Hosted Zones allow internal DNS resolution within your VPCs.

### Setting Up Private DNS

```
Route53 Console
-> Hosted Zones -> Create Hosted Zone
Name: internal.company.com
Type: Private Hosted Zone
VPCs: Select VPCs to associate

Create records:
db.internal.company.com     A  10.0.10.50
cache.internal.company.com  A  10.0.10.51
api.internal.company.com    A  10.0.10.52
```

### Requirements

1. **DNS Resolution** must be enabled in the VPC (VPC settings -> Enable DNS resolution)
2. **DNS Hostnames** must be enabled in the VPC
3. The VPC must be associated with the hosted zone

### Split-View DNS

Use the same domain name but return different IPs depending on whether the query comes from inside or outside your VPC.

```
Public Hosted Zone: example.com
  www.example.com  A  54.23.45.67 (ALB public IP)

Private Hosted Zone: example.com (associated with your VPC)
  www.example.com  A  10.0.1.50 (internal ALB IP)

Queries from inside VPC -> Private HZ -> 10.0.1.50 (internal)
Queries from internet   -> Public HZ  -> 54.23.45.67 (external)
```

---

## 11. DNSSEC

**DNS Security Extensions (DNSSEC)** adds cryptographic signing to DNS responses to prevent DNS spoofing/cache poisoning.

### What DNSSEC Prevents

```
Without DNSSEC (DNS Spoofing attack):
  Attacker intercepts DNS query for bank.com
  Returns fake IP pointing to attacker's server
  User unknowingly connects to fake bank

With DNSSEC:
  DNS response is digitally signed
  Client verifies signature using public key
  If signature invalid -> response rejected
  Attacker cannot forge signed responses
```

### Route53 DNSSEC Support

- Supported for public hosted zones
- Route53 signs zone records with a key
- Requires KSK (Key Signing Key) management
- Supported for domains registered with Route53

### Enable DNSSEC

```
Route53 Console -> Hosted Zone -> DNSSEC signing -> Enable
Create KSK -> Associate with CloudHSM key
Enable signing
-> Update DS record at registrar (or Route53 does it automatically)
```

---

## 12. Hands-on Lab

### Lab: Set Up DNS for a Web Application

**Prerequisites:**
- A domain name (registered with Route53 or another registrar)
- An EC2 instance or ALB

**Step 1: Create Hosted Zone**
```
Route53 -> Hosted Zones -> Create Hosted Zone
Domain name: yourdomain.com
Type: Public Hosted Zone
-> Create
```

**Step 2: Create A Record for Root Domain**
```
Create Record
Name: (leave blank for root domain)
Type: A - IPv4 address
Routing Policy: Simple
Alias: Yes
  Route traffic to: Application and Classic Load Balancer
  Region: us-east-1
  Load balancer: your-alb-name
-> Create
```

**Step 3: Create CNAME for www**
```
Create Record
Name: www
Type: CNAME
Value: yourdomain.com
TTL: 300
-> Create
```

**Step 4: Set Up Weighted Routing for Canary Deployment**
```
Create Record (Production - 95%)
Name: api
Type: A
Routing Policy: Weighted
Weight: 95
Value: production-alb-dns
Record ID: production

Create Record (Canary - 5%)
Name: api
Type: A
Routing Policy: Weighted
Weight: 5
Value: canary-alb-dns
Record ID: canary
```

**Step 5: Create Health Check**
```
Route53 -> Health Checks -> Create
Monitor: Endpoint
Protocol: HTTPS
Domain: api.yourdomain.com
Port: 443
Path: /health
-> Create
```

**Step 6: Set Up Failover**
```
Create Record (Primary)
Name: app
Type: A
Routing Policy: Failover
Failover record type: Primary
Value: primary-server-ip
Health check: your-health-check
Record ID: primary

Create Record (Secondary)
Name: app
Type: A
Routing Policy: Failover
Failover record type: Secondary
Value: backup-server-ip
Record ID: secondary
```

**Step 7: Test DNS Resolution**
```bash
# Test basic resolution
dig yourdomain.com +short
nslookup yourdomain.com

# Test with specific DNS server
dig @8.8.8.8 yourdomain.com

# Test routing from different locations
# Use: https://www.whatsmydns.net/

# Check TTL
dig yourdomain.com | grep TTL
```

---

## 13. Interview Q&A

**Q1: What is the difference between CNAME and Alias records in Route53?**

A: CNAME records map one hostname to another and cannot be used at the zone apex (root domain like example.com). Alias records are Route53-specific and can be used at the zone apex. Alias records also have no additional charge for queries to AWS resources (CloudFront, ALB, etc.), while CNAME resolution incurs query charges. Alias records also automatically track the IP changes of the target AWS resource.

---

**Q2: Explain Route53 routing policies and when you'd use each.**

A:
- **Simple**: One resource, no health checks needed
- **Weighted**: A/B testing or canary deployments (split traffic by percentage)
- **Latency**: Global applications — route users to lowest-latency AWS region
- **Failover**: Active-passive HA — primary fails, switch to secondary
- **Geolocation**: Route by country/continent for localization or compliance
- **Geoproximity**: Route by location with adjustable bias — requires Traffic Flow
- **Multivalue**: Return multiple healthy IPs for client-side load balancing

---

**Q3: You need example.com (not www) to point to an ALB. What do you do?**

A: Create an **Alias A record** at the zone apex (example.com) pointing to the ALB DNS name. CNAME cannot be used at the zone apex. Route53 Alias records solve this — they behave like CNAMEs but are allowed at the zone apex and are specific to Route53.

---

**Q4: How does Route53 health check work with private resources (in private subnets)?**

A: Route53 health checkers are on the public internet and cannot reach private resources directly. The solution is to use a **CloudWatch Alarm health check**:
1. Create a CloudWatch alarm based on a metric from the private resource
2. Create a Route53 health check linked to that CloudWatch alarm
3. Route53 marks the endpoint healthy/unhealthy based on the alarm state

---

**Q5: What is the TTL and why does it matter for DNS changes?**

A: TTL (Time to Live) is the number of seconds DNS resolvers cache a DNS record before querying again. If your TTL is 3600 (1 hour), DNS changes can take up to 1 hour to fully propagate globally because resolvers serve cached responses. Best practice before a DNS change: reduce TTL to 60 seconds several hours in advance, make the change, then restore TTL after propagation.

---

**Q6: How is geolocation different from latency routing?**

A: 
- **Geolocation**: Routes based on the user's **actual geographic location** (country/continent/state). Deterministic — a user in France always goes to the EU record.
- **Latency**: Routes based on which AWS region has the **lowest measured latency** for the user. A user in France might route to us-east-1 if the latency there is somehow lower (unusual but possible).

---

**Q7: What happens if a user's location doesn't match any geolocation rule?**

A: If no matching rule is found and there's no **Default** record, Route53 returns NXDOMAIN (no answer). This is why you should always create a Default location record as a catch-all fallback.

---

**Q8: What is Route53 Traffic Flow?**

A: Traffic Flow is Route53's visual editor for creating complex routing configurations. It allows you to combine multiple routing policies in a tree structure. It supports geoproximity routing (not available in standard UI) and lets you version your routing configurations. Costs $50/month per traffic policy record.

---

**Q9: Can Route53 route traffic to on-premises resources?**

A: Yes. Route53 can return any IP address, including on-premises IPs. For private hosted zones, you can use Route53 Resolver to forward queries to/from on-premises DNS servers, enabling hybrid cloud DNS resolution.

---

**Q10: What is the difference between Route53 weighted routing weight 0 and deleting the record?**

A: Setting weight to **0** means no traffic is sent to that resource, but the record still exists. This is useful for temporarily taking a server out of rotation without deleting the record. Deleting the record removes it entirely. Weight 0 is better for temporary removal since you can easily restore it by changing the weight back.

---

*End of Route53 Complete Guide*
