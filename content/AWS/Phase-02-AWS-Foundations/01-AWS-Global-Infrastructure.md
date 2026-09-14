# AWS Global Infrastructure

## Table of Contents

1. [What is AWS?](#what-is-aws)
2. [AWS at Scale](#aws-at-scale)
3. [Global Infrastructure Overview](#global-infrastructure-overview)
4. [Regions](#regions)
5. [Availability Zones](#availability-zones)
6. [Edge Locations and CloudFront PoPs](#edge-locations-and-cloudfront-pops)
7. [Local Zones](#local-zones)
8. [Infrastructure Hierarchy Diagram](#infrastructure-hierarchy-diagram)
9. [High Availability Concept](#high-availability-concept)
10. [Choosing a Region](#choosing-a-region)
11. [Region Latency Concept](#region-latency-concept)
12. [AWS Console — Navigating Regions](#aws-console--navigating-regions)
13. [Hands-On: Switching Regions](#hands-on-switching-regions)
14. [Interview Q&A](#interview-qa)

---

## What is AWS?

Amazon Web Services (AWS) is the world's most comprehensive and broadly adopted cloud platform. It is a subsidiary of Amazon.com that was officially launched in 2006 with two services: Amazon S3 (Simple Storage Service) and Amazon EC2 (Elastic Compute Cloud).

### Brief History

| Year | Event |
|------|-------|
| 2002 | Amazon began internal web services infrastructure |
| 2004 | SQS (Simple Queue Service) quietly launched for internal use |
| 2006 | AWS publicly launched with S3 and EC2 |
| 2010 | Amazon.com retail platform migrated entirely to AWS |
| 2013 | AWS GovCloud region launched for US government workloads |
| 2014 | Lambda launched — birth of serverless computing |
| 2016 | AWS revenue exceeded $12 billion annually |
| 2020 | AWS revenue exceeded $45 billion annually |
| 2023 | AWS revenue exceeded $90 billion annually |
| 2024 | Over 200+ services offered across 30+ geographic regions |

### What Problem Does AWS Solve?

Before cloud computing, companies had to:
- Buy physical servers (capital expenditure, 6-12 week lead time)
- Rent data center space and pay for cooling, power, and physical security
- Hire staff to maintain hardware
- Over-provision for peak capacity that sits idle 95% of the time
- Write off assets after 3-5 years

AWS flipped this model:
- Pay only for what you use (operational expenditure)
- Spin up servers in minutes, not weeks
- Scale up during peaks, scale down during quiet periods
- Let Amazon worry about hardware maintenance, physical security, and power

---

## AWS at Scale

Understanding the scale of AWS helps contextualise why the infrastructure concepts in this file matter.

- **200+ services** — ranging from compute, storage, databases, networking, ML/AI, IoT, satellite ground stations, and more
- **30+ geographic Regions** as of 2025, with more announced
- **96+ Availability Zones** globally
- **400+ Edge Locations** and regional edge caches
- **Millions of active customers** including Netflix, Airbnb, NASA, the CIA, and millions of startups
- **Petabytes of data stored** in Amazon S3 every day
- **Trillions of API calls** processed per day across services

AWS operates one of the largest global network backbones in the world — a private fiber network connecting its Regions and data centers that rivals the footprint of major telecommunications companies.

---

## Global Infrastructure Overview

AWS infrastructure is organised into three main tiers:

```
Tier 1: Regions
    └── Tier 2: Availability Zones (inside each Region)
            └── Tier 3: Data Centers (inside each AZ)

Separate concept: Edge Locations (CloudFront CDN nodes, globally distributed)
Separate concept: Local Zones (extensions of Regions for ultra-low latency)
Separate concept: Wavelength Zones (embedded in 5G networks)
```

Each tier serves a different purpose and operates at a different scale.

---

## Regions

### What is a Region?

An AWS Region is a **geographic area** that contains a cluster of AWS data centers. Each Region is completely independent from every other Region — it has its own power supply, network connectivity, and cooling infrastructure.

Key characteristics of a Region:
- Physically located in a specific part of the world (e.g., Northern Virginia, Ireland, Sydney)
- Contains a minimum of 2 Availability Zones (most have 3)
- Most AWS services are **regional** — meaning your resource (an EC2 instance, an S3 bucket, a VPC) lives in a specific Region
- Data stored in a Region **does not leave that Region** unless you explicitly move it
- Each Region has a short code identifier used in the console and CLI

### Complete List of AWS Regions (as of 2025)

#### Americas

| Region Code | Location | Notes |
|-------------|----------|-------|
| us-east-1 | N. Virginia, USA | Oldest, largest, most services, cheapest |
| us-east-2 | Ohio, USA | Secondary US East |
| us-west-1 | N. California, USA | US West Coast |
| us-west-2 | Oregon, USA | Popular US West, AI/ML hub |
| ca-central-1 | Montreal, Canada | Canadian data residency |
| ca-west-1 | Calgary, Canada | New, western Canada |
| sa-east-1 | Sao Paulo, Brazil | South America |

#### Europe / Middle East / Africa

| Region Code | Location | Notes |
|-------------|----------|-------|
| eu-west-1 | Ireland | Original European Region |
| eu-west-2 | London, UK | UK/British workloads |
| eu-west-3 | Paris, France | French data sovereignty |
| eu-central-1 | Frankfurt, Germany | German compliance (GDPR) |
| eu-central-2 | Zurich, Switzerland | Swiss banking compliance |
| eu-north-1 | Stockholm, Sweden | Nordics, renewable energy |
| eu-south-1 | Milan, Italy | Southern Europe |
| eu-south-2 | Spain | Iberian Peninsula |
| me-south-1 | Bahrain | Middle East |
| me-central-1 | UAE | UAE/Gulf workloads |
| af-south-1 | Cape Town, South Africa | Africa |
| il-central-1 | Tel Aviv, Israel | Israel |

#### Asia Pacific

| Region Code | Location | Notes |
|-------------|----------|-------|
| ap-southeast-1 | Singapore | SE Asia hub |
| ap-southeast-2 | Sydney, Australia | Australia/NZ, popular |
| ap-southeast-3 | Jakarta, Indonesia | Indonesia |
| ap-southeast-4 | Melbourne, Australia | Second Australian Region |
| ap-northeast-1 | Tokyo, Japan | Japan, East Asia |
| ap-northeast-2 | Seoul, South Korea | Korea |
| ap-northeast-3 | Osaka, Japan | Second Japanese Region |
| ap-south-1 | Mumbai, India | India, South Asia |
| ap-south-2 | Hyderabad, India | Second Indian Region |
| ap-east-1 | Hong Kong | Hong Kong |

#### China (Separate partition)

| Region Code | Location | Notes |
|-------------|----------|-------|
| cn-north-1 | Beijing, China | Operated by Sinnet |
| cn-northwest-1 | Ningxia, China | Operated by NWCD |

> Note: China Regions are a separate AWS partition and require a separate AWS China account. They are not accessible from the global partition.

#### AWS GovCloud (Separate partition)

| Region Code | Location | Notes |
|-------------|----------|-------|
| us-gov-east-1 | USA (classified) | US government, ITAR |
| us-gov-west-1 | USA (classified) | US government, FedRAMP High |

### How to Choose a Region

Choosing the right Region is one of the most important architectural decisions you will make. Four primary factors:

#### 1. Compliance and Data Sovereignty

Many industries and countries have regulations about where data can be stored:
- GDPR (EU): Personal data about EU citizens must stay in the EU — use `eu-*` Regions
- HIPAA (US Healthcare): Can use US Regions with a BAA signed with AWS
- Australian Privacy Act: Sensitive Australian data should stay in `ap-southeast-2`
- China MLPS: Data on Chinese citizens must stay in `cn-*` Regions

**This is the MOST important factor — compliance overrides everything else.**

#### 2. Latency

The closer the Region is to your end users, the lower the latency:
- A user in Sydney hitting `ap-southeast-2` will get ~10ms latency
- The same user hitting `us-east-1` will get ~200ms latency
- For real-time applications (video calls, gaming, trading), this difference is enormous

Tools for measuring Region latency:
- https://cloudpingtest.com
- https://www.awsspeedtest.com
- AWS Global Accelerator (for routing users to the nearest endpoint)

#### 3. Service Availability

Not all AWS services are available in all Regions. New services typically launch in `us-east-1` first, then expand to other Regions. If you need a specific cutting-edge service, check the Region table at:
https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/

Common services available everywhere: EC2, S3, RDS, VPC, IAM, CloudFormation
Services that may not be in newer/smaller Regions: Rekognition, Ground Station, Outposts

#### 4. Cost

Pricing varies by Region. `us-east-1` is generally the cheapest. The same EC2 instance type can cost:
- 20-30% more in Europe compared to `us-east-1`
- 10-20% more in Asia Pacific compared to `us-east-1`
- Significantly more in smaller Regions (South Africa, Middle East)

For cost-sensitive batch workloads with no user-facing latency requirements, `us-east-1` or `us-east-2` are often the cheapest choice.

#### Decision Framework

```
START: What region should I use?
    |
    v
Is there a legal/compliance requirement for data location?
    YES --> Use the required Region (no choice)
    NO  --> Continue
    |
    v
Where are most of your end users?
    --> Pick the Region geographically closest to them
    |
    v
Does the service you need exist in that Region?
    NO  --> Find nearest Region that has it
    YES --> Continue
    |
    v
Is cost a primary concern?
    YES --> Compare pricing across candidate Regions
    NO  --> Use the latency-optimised choice
```

---

## Availability Zones

### What is an Availability Zone?

An Availability Zone (AZ) is one or more **discrete data centers** within a Region, each with:
- Independent power supplies
- Independent cooling systems
- Independent network connectivity
- Physical separation from other AZs (typically tens of miles / kilometers apart)

Key characteristics:
- Each Region has **2-6 AZs** (most have 3)
- AZs within a Region are connected by **high-bandwidth, low-latency** private fiber links
- The physical separation ensures a flood, power outage, or fire in one AZ does not affect other AZs
- AZ names are Region-specific: `us-east-1a`, `us-east-1b`, `us-east-1c`
- AWS intentionally randomises which physical AZ maps to which letter (a, b, c) per account — your `us-east-1a` is NOT the same physical AZ as my `us-east-1a`

### Why Multiple Data Centers Per AZ?

Each AZ is typically composed of **2-8 physical data centers** that are located close together (a campus). This grouping gives AWS:
- Higher total capacity per AZ than any single building could provide
- Internal redundancy within the AZ

But from your perspective as a customer, **an AZ is the atomic unit of failure isolation within a Region**.

### AZ Naming

```
Region: us-east-1 (N. Virginia)
    AZs:
        us-east-1a  (Account A: Data Center Group 3)
        us-east-1b  (Account A: Data Center Group 1)
        us-east-1c  (Account A: Data Center Group 5)

        Note: For Account B:
        us-east-1a  (Data Center Group 1)  <-- different physical AZ!
        us-east-1b  (Data Center Group 5)
        us-east-1c  (Data Center Group 3)
```

This randomisation prevents everyone from always choosing "a" and overloading it.

### AZ IDs (Consistent Identifiers)

When you need to refer to the SAME physical AZ across accounts (e.g., for AWS PrivateLink or VPC sharing), use the **AZ ID** (not the letter name):
- `use1-az1`, `use1-az2`, `use1-az3` — these are consistent across all AWS accounts

---

## Edge Locations and CloudFront PoPs

### What is an Edge Location?

Edge Locations are **Points of Presence (PoPs)** for Amazon CloudFront (AWS's Content Delivery Network). They are NOT full Regions — they do not run EC2, RDS, or most other services. Their sole purpose is to cache content close to end users to reduce latency.

Key facts:
- **400+ Edge Locations** worldwide as of 2025
- Located in major cities and internet exchange points globally
- Used by: Amazon CloudFront, AWS Global Accelerator, Amazon Route 53, AWS Shield
- Content cached at an edge location is served from there instead of traveling all the way to the origin Region

### How Edge Locations Work

```
WITHOUT CloudFront:
User in Melbourne --> Request --> S3 bucket in us-east-1 (~200ms round trip)

WITH CloudFront:
First user in Melbourne:
    --> Request --> CloudFront Edge in Sydney --> Cache MISS --> Fetch from us-east-1
    --> Content stored in Sydney Edge Location cache

All subsequent users in Melbourne:
    --> Request --> CloudFront Edge in Sydney --> Cache HIT --> Served from Sydney (~5ms)
```

### Regional Edge Caches

Between Edge Locations and the origin, AWS also has **Regional Edge Caches** — larger caches at a regional level. If an Edge Location's cache expires, it checks the Regional Edge Cache before going all the way to the origin.

```
Origin (S3 in us-east-1)
    └── Regional Edge Cache (e.g., Singapore)
            └── Edge Location (e.g., Melbourne)
                    └── End User
```

---

## Local Zones

### What is a Local Zone?

A Local Zone is an **extension of a Region** placed in a specific metropolitan area to bring AWS services closer to large population centers. Unlike Edge Locations, Local Zones run actual AWS services like EC2, EBS, RDS, and VPC — but they are not full Regions.

Use cases for Local Zones:
- Applications requiring **single-digit millisecond latency** to a dense metropolitan population
- Media and entertainment workloads (live video production, rendering)
- Machine learning inference at the edge
- Real-time gaming

### Local Zones vs Regions vs Edge Locations

| Feature | Region | AZ | Edge Location | Local Zone |
|---------|--------|----|---------------|------------|
| Independent infrastructure | Yes | Yes | Partial | Partial |
| Runs EC2 | Yes | Yes | No | Yes |
| Runs S3 | Yes | Yes | No | No |
| Purpose | General workloads | HA within Region | CDN caching | Ultra-low latency |
| Management | Opt-in | Default | Auto (via CloudFront) | Opt-in |

### Example Local Zones

As of 2025, Local Zones exist in cities including:
- Los Angeles, CA (extension of us-west-2)
- Dallas, TX
- Denver, CO
- Miami, FL
- Atlanta, GA
- Chicago, IL
- Seattle, WA
- Boston, MA
- Minneapolis, MN
- Portland, OR

---

## Infrastructure Hierarchy Diagram

```
AWS GLOBAL INFRASTRUCTURE
=========================

PARTITION: aws (global)
    |
    |----REGION: us-east-1 (N. Virginia)
    |        |
    |        |----AZ: us-east-1a
    |        |        |-- Data Center 1 (EC2 servers, EBS storage)
    |        |        |-- Data Center 2
    |        |        |-- Data Center 3
    |        |
    |        |----AZ: us-east-1b
    |        |        |-- Data Center 4
    |        |        |-- Data Center 5
    |        |
    |        |----AZ: us-east-1c
    |                 |-- Data Center 6
    |                 |-- Data Center 7
    |
    |----REGION: eu-west-1 (Ireland)
    |        |
    |        |----AZ: eu-west-1a
    |        |----AZ: eu-west-1b
    |        |----AZ: eu-west-1c
    |
    |----REGION: ap-southeast-2 (Sydney)
             |
             |----AZ: ap-southeast-2a
             |----AZ: ap-southeast-2b
             |----AZ: ap-southeast-2c

EDGE LOCATIONS (separate from Region/AZ hierarchy)
    |
    |---- Sydney, Australia        (serves ap-southeast-2 users)
    |---- Melbourne, Australia
    |---- Singapore
    |---- Tokyo, Japan
    |---- London, UK
    |---- Frankfurt, Germany
    |---- ... 400+ total

LOCAL ZONES (opt-in, extension of nearest Region)
    |
    |---- Los Angeles (extends us-west-2)
    |---- Denver (extends us-west-2)
    |---- ... 30+ cities


CONNECTIVITY:
    Regions  <-----------> High-speed private AWS backbone fiber
    AZs within Region <--> Low-latency, high-bandwidth private links (< 2ms)
    Edge Locations <------> Public internet + AWS backbone


DATA ISOLATION:
    Data in a Region stays in that Region (unless YOU replicate it)
    AZs in the same Region can replicate data synchronously
    Cross-Region replication is always asynchronous and explicit
```

---

## High Availability Concept

### Why Deploy Across Multiple AZs?

High Availability (HA) means your system continues to operate even when a component fails. In AWS, the AZ is the primary unit of failure you design against.

**What can cause an AZ outage?**
- Power grid failure affecting a data center campus
- Severe weather (flooding, tornado)
- Network equipment failure
- Cooling system failure
- (Rarely) Natural disasters

**Single AZ Architecture (NOT HA):**

```
us-east-1a
    EC2 Instance (web server)
    RDS Database

If AZ "a" goes down --> Application is completely unavailable
```

**Multi-AZ Architecture (HA):**

```
us-east-1a                    us-east-1b                    us-east-1c
    EC2 (web) ----Load Balancer---- EC2 (web)
    RDS Primary <----sync repl----> RDS Standby

If AZ "a" goes down:
    - Load Balancer routes all traffic to EC2 in AZ "b" or "c"
    - RDS fails over to standby in AZ "b"
    - Application stays online (brief failover period ~60-120 seconds for RDS)
```

### The SLA Connection

AWS's SLA (Service Level Agreement) for services often REQUIRES multi-AZ deployment:
- EC2 SLA: 99.99% uptime requires deploying in multiple AZs
- RDS Multi-AZ: 99.95% uptime guarantee
- S3: 99.999999999% (11 nines) durability because it stores copies across multiple AZs automatically

### Multi-Region Architecture (Disaster Recovery)

For even higher availability (surviving a whole Region going offline), you deploy across multiple Regions:

```
us-east-1 (Primary)              us-west-2 (DR)
    Application Servers    <-->    Application Servers (warm standby)
    RDS Primary            <-->    RDS Read Replica (cross-region)
    S3 Bucket              <-->    S3 Cross-Region Replication

Route 53 health checks:
    Normally: All traffic --> us-east-1
    If us-east-1 is down: Traffic --> us-west-2
```

---

## Choosing a Region

(Detailed discussion above in the Regions section.) Summary decision tree:

```
1. Compliance/Legal requirement?  --> Must use compliant Region
2. User location?                 --> Use nearest Region
3. Service available there?       --> Check availability
4. Cost sensitivity?              --> Compare pricing tables
```

---

## Region Latency Concept

### What is Network Latency?

Latency is the time it takes for a packet of data to travel from Point A to Point B and back (round-trip time, RTT). It is measured in milliseconds (ms).

### Speed of Light Limit

Data travels through fiber optic cables at roughly **2/3 the speed of light** (~200,000 km/s). This is a hard physical limit.

Distance from Sydney to N. Virginia: ~16,000 km
Minimum round-trip time: 16,000 / 200,000 * 2 = ~160ms (theoretical minimum)
Actual internet RTT: ~200-220ms

### Why Latency Matters

| Latency | User Experience |
|---------|----------------|
| < 20ms | Imperceptible, feels instant |
| 20-100ms | Acceptable for most web apps |
| 100-200ms | Noticeable delay, acceptable for non-real-time |
| > 200ms | Frustrating for interactive apps |
| > 400ms | Unusable for voice/video |

### Intra-Region Latency

Between AZs in the same Region: **< 2ms** (AWS SLA commitment for some services)

This low latency is why synchronous database replication between AZs is feasible. You could not do synchronous replication between Regions because the latency would be too high and would slow every write operation.

---

## AWS Console — Navigating Regions

### What is the AWS Management Console?

The AWS Management Console is a web-based interface for managing all AWS services. You access it at: https://console.aws.amazon.com

### Console Structure

```
Top Navigation Bar:
    [AWS Logo] [Services dropdown] [Search bar] [Region selector] [Account menu]
                                                       ^
                                                       |
                                               THIS IS WHERE YOU
                                               SWITCH REGIONS
```

### Important Console Behaviors

1. **Region-specific services**: When you switch Regions, the console shows resources in THAT Region only
   - Example: EC2 instances in us-east-1 are NOT visible when you're viewing eu-west-1
   
2. **Global services**: Some services are not Region-specific and always show the same view regardless of selected Region:
   - IAM (Identity and Access Management)
   - Route 53 (DNS)
   - CloudFront
   - AWS Organizations
   - Billing and Cost Management

3. **Resource ARNs include Region**: `arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0`
   - The Region (`us-east-1`) is embedded in the resource identifier

---

## Hands-On: Switching Regions

### Task 1: View Your Current Region in the Console

1. Go to https://console.aws.amazon.com
2. Log in with your account credentials
3. Look at the top-right area of the navigation bar
4. You will see a Region name (e.g., "N. Virginia") or Region code (e.g., "us-east-1")
5. This is your currently selected Region

### Task 2: Switch Regions

1. Click on the Region name/code in the top-right navigation
2. A dropdown appears showing all available Regions grouped by geography
3. Click "Asia Pacific (Sydney)" or `ap-southeast-2`
4. The page reloads with the new Region selected
5. Notice: the URL changes to include the Region code
6. Navigate to EC2 — notice you may see different (or no) instances than before

### Task 3: Use the AWS CLI to List Regions

First, ensure AWS CLI is installed and configured (see `02-AWS-Account-Setup.md`).

```bash
# List all available Regions
aws ec2 describe-regions --output table

# Output example:
# -----------------------------------------------
# |              DescribeRegions                |
# +---------------------------------------------+
# ||             Regions                       ||
# |+-------------------+-----------------------+|
# ||   Endpoint        |   RegionName          ||
# |+-------------------+-----------------------+|
# ||  ec2.us-east-1... |  us-east-1            ||
# ||  ec2.eu-west-1... |  eu-west-1            ||
# ...

# Run a command against a specific Region using --region flag
aws ec2 describe-instances --region ap-southeast-2

# Or set the region via environment variable for a session
export AWS_DEFAULT_REGION=ap-southeast-2
aws ec2 describe-instances   # now runs in Sydney
```

### Task 4: List AZs in a Region

```bash
# List AZs in the current (default) Region
aws ec2 describe-availability-zones --output table

# List AZs in a specific Region
aws ec2 describe-availability-zones --region us-east-1 --output table

# Example output:
# ZoneName     | State     | RegionName
# us-east-1a   | available | us-east-1
# us-east-1b   | available | us-east-1
# us-east-1c   | available | us-east-1
# us-east-1d   | available | us-east-1
# us-east-1e   | available | us-east-1
# us-east-1f   | available | us-east-1
```

### Task 5: Identify Global vs Regional Services in the Console

Services to check:
- Navigate to **IAM** — notice the top-right says "Global" instead of a Region name
- Navigate to **EC2** — notice it shows a specific Region
- Navigate to **Route 53** — also shows "Global"
- Navigate to **S3** — technically global namespace but data is stored in specific Regions

---

## Interview Q&A

### Q1: What is an AWS Region?

**Answer:** An AWS Region is a physical geographic area containing a cluster of AWS data centers. Each Region is isolated from other Regions for fault tolerance and data sovereignty. Regions contain multiple Availability Zones. Most AWS services are deployed per-Region, and data stored in a Region does not leave that Region unless explicitly replicated.

### Q2: What is an Availability Zone and how does it differ from a Region?

**Answer:** An Availability Zone (AZ) is one or more discrete data centers within a Region, each with independent power, cooling, and networking. A Region is a geographic area containing multiple AZs. The AZ is the unit of fault isolation within a Region — deploying across multiple AZs protects against a single data center failure. AZs within a Region are connected via low-latency private fiber links (< 2ms), making synchronous replication feasible.

### Q3: How many AZs does a Region typically have?

**Answer:** Most Regions have 3 AZs, though some newer or smaller Regions have 2, and older large Regions (like us-east-1) have 6. AWS requires a minimum of 2 AZs per Region.

### Q4: What is an Edge Location? How is it different from an AZ?

**Answer:** An Edge Location is a Point of Presence for Amazon CloudFront (CDN) and other edge services like Route 53 and Global Accelerator. Edge Locations cache content close to end users. They do NOT run general-purpose compute services like EC2 or RDS. An AZ, by contrast, is a full data center campus running the complete range of AWS compute, storage, and database services. There are 400+ Edge Locations vs ~96 AZs globally.

### Q5: Why would you deploy a workload across multiple AZs?

**Answer:** To achieve High Availability (HA). Each AZ has independent power and cooling, so a failure in one AZ does not affect others. Deploying across multiple AZs means the application continues operating even if one AZ experiences an outage. This is fundamental to AWS Well-Architected design. Services like Elastic Load Balancing, RDS Multi-AZ, and ECS automatically distribute workloads across AZs.

### Q6: What factors should you consider when choosing an AWS Region?

**Answer:** Four main factors:
1. **Compliance/Legal**: Data residency requirements (GDPR, HIPAA, Australian Privacy Act) may mandate specific Regions
2. **Latency**: Deploy close to your end users for best performance
3. **Service availability**: Not all services are in all Regions; check the regional service table
4. **Cost**: Pricing varies by Region; us-east-1 is typically cheapest

### Q7: Is the letter "a" in us-east-1a always the same physical data center across all AWS accounts?

**Answer:** No. AWS intentionally randomises the mapping between AZ letter names (a, b, c) and physical locations per AWS account. This prevents all customers from always choosing "a" and overloading it. Your `us-east-1a` may be a different physical data center than my `us-east-1a`. To refer to the same physical AZ consistently across accounts, use the AZ ID (e.g., `use1-az1`), which is stable.

### Q8: What is a Local Zone?

**Answer:** A Local Zone is an extension of a Region placed in a large metropolitan area to provide single-digit millisecond latency for workloads requiring it. Unlike Edge Locations (which only serve CDN), Local Zones run actual AWS services like EC2, EBS, and VPC. They are opt-in and extend a parent Region (e.g., Los Angeles extends us-west-2).

### Q9: What is the minimum latency between AZs within a Region?

**Answer:** AWS guarantees that AZs within a Region are connected via high-bandwidth, low-latency private links. Round-trip latency between AZs in the same Region is typically less than 2ms. This enables synchronous database replication (e.g., RDS Multi-AZ) and other latency-sensitive cross-AZ operations.

### Q10: What is the difference between Region latency and AZ latency?

**Answer:**
- **AZ-to-AZ latency within a Region**: < 2ms (private AWS fiber, physically close)
- **Region-to-Region latency**: 10ms to 250ms+ depending on distance (governed by speed of light through fiber and routing hops)

Inter-Region latency is too high for synchronous replication (it would slow every database write). That is why cross-Region replication is always asynchronous.

### Q11: Can you synchronously replicate data between Regions?

**Answer:** Not practically. The latency between Regions (often 100ms+ round trip) would mean every write operation would have to wait 100ms+ for acknowledgment from the secondary Region. This is why all cross-Region replication in AWS (S3 Cross-Region Replication, RDS read replicas across Regions, DynamoDB Global Tables) uses **asynchronous** replication — writes complete locally, and are replicated to other Regions with a small lag (typically seconds).

### Q12: Which AWS services are global (not Region-specific)?

**Answer:**
- **IAM** (Identity and Access Management)
- **Route 53** (DNS)
- **CloudFront** (CDN, though it uses Edge Locations globally)
- **AWS Organizations**
- **Billing and Cost Management**
- **AWS Support**
- **AWS Trusted Advisor** (some features)

These services show "Global" in the console Region selector.

### Q13: How does CloudFront relate to Edge Locations?

**Answer:** CloudFront is AWS's CDN service. It uses the 400+ Edge Locations to cache content close to end users. When a user requests a file, CloudFront routes the request to the nearest Edge Location. If the content is cached there, it's served immediately (low latency). If not, the Edge Location fetches it from the origin (an S3 bucket, an EC2 server, etc.), caches it, and serves it. Subsequent requests from nearby users hit the cache and get fast responses.

### Q14: What is the AWS Global Accelerator and how does it relate to Edge Locations?

**Answer:** AWS Global Accelerator is a service that routes user traffic through the AWS global backbone network instead of the public internet. It uses Edge Locations as entry points — users connect to the nearest Edge Location, then their traffic travels over AWS's private fiber to the destination Region. This improves latency and reliability compared to public internet routing, especially for non-HTTP/HTTPS traffic and applications requiring static IP addresses.

### Q15: What is a Wavelength Zone?

**Answer:** A Wavelength Zone is AWS infrastructure embedded within telecommunications providers' 5G networks. It brings AWS compute and storage to the edge of the 5G network, enabling applications requiring ultra-low latency to mobile devices (1-5ms). Use cases include autonomous vehicles, AR/VR streaming, and real-time video analytics. Like Local Zones, they extend a parent Region.
