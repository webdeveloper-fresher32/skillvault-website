# VPC (Virtual Private Cloud) — Complete Deep Dive

> The single most important AWS networking topic. Master this and everything else becomes easier.

---

## Table of Contents

1. [What is a VPC?](#1-what-is-a-vpc)
2. [Why VPC Exists](#2-why-vpc-exists)
3. [Default VPC vs Custom VPC](#3-default-vpc-vs-custom-vpc)
4. [CIDR Blocks](#4-cidr-blocks)
5. [Subnets](#5-subnets)
6. [Internet Gateway (IGW)](#6-internet-gateway-igw)
7. [NAT Gateway](#7-nat-gateway)
8. [Route Tables](#8-route-tables)
9. [Security Groups](#9-security-groups)
10. [Network ACLs (NACLs)](#10-network-acls-nacls)
11. [Security Groups vs NACLs Comparison](#11-security-groups-vs-nacls-comparison)
12. [VPC Flow Logs](#12-vpc-flow-logs)
13. [VPC Peering](#13-vpc-peering)
14. [VPC Endpoints](#14-vpc-endpoints)
15. [Bastion Host](#15-bastion-host)
16. [Complete Architecture Example](#16-complete-architecture-example)
17. [Hands-on Lab](#17-hands-on-lab)
18. [Interview Q&A](#18-interview-qa)

---

## 1. What is a VPC?

A **Virtual Private Cloud (VPC)** is a logically isolated section of the AWS cloud where you can launch AWS resources in a virtual network that you define.

Think of it as your own **private data center inside AWS**, where:
- You control the IP address range
- You control which resources are public-facing vs private
- You control all network traffic flow
- You define firewall rules at multiple levels

```
AWS Cloud
+--------------------------------------------------+
|                                                  |
|  Your VPC (10.0.0.0/16)                         |
|  +--------------------------------------------+ |
|  |                                            | |
|  |  [EC2]  [RDS]  [Lambda]  [ALB]            | |
|  |                                            | |
|  +--------------------------------------------+ |
|                                                  |
|  Another Customer's VPC (172.31.0.0/16)         |
|  +--------------------------------------------+ |
|  |  [EC2]  [RDS]                              | |
|  +--------------------------------------------+ |
|                                                  |
+--------------------------------------------------+
```

The two VPCs are **completely isolated** by default — customers cannot see each other's resources.

### Key Properties of a VPC
- Spans a single **AWS Region** (but multiple Availability Zones within that region)
- Has a **CIDR block** (IP address range) you define
- Has **subnets** that you create in specific AZs
- Has **route tables** that control traffic flow
- Has **security controls** (Security Groups + NACLs)
- Can be connected to other VPCs, on-premises networks, and the internet

---

## 2. Why VPC Exists

### The Problem Without VPC
Before VPCs, AWS had EC2-Classic where:
- All EC2 instances shared a flat network
- No isolation between customers
- Limited security control
- No ability to customize IP ranges

### What VPC Solves

| Problem | VPC Solution |
|---------|-------------|
| Security isolation | Each VPC is private by default |
| IP address control | You define your own CIDR range |
| Traffic separation | Public and private subnets |
| Compliance | Resources never exposed to internet unless you want |
| Hybrid connectivity | Connect on-premises to AWS securely |
| Cost control | Fine-grained network routing |

### Real-World Use Cases
1. **Web application**: Public subnet for load balancers, private subnet for app servers and databases
2. **Regulatory compliance**: Keep sensitive data in private subnets that never touch the internet
3. **Multi-tier architecture**: Separate network tiers with different security rules
4. **Hybrid cloud**: Extend on-premises network into AWS securely

---

## 3. Default VPC vs Custom VPC

### Default VPC

AWS creates a **Default VPC** in every region when you create an AWS account.

**Default VPC characteristics:**
- CIDR block: `172.31.0.0/16`
- One **public subnet** per Availability Zone
- An **Internet Gateway** already attached
- A **route table** with a route to the IGW
- Default security group
- Default NACL (allows all traffic)
- DNS hostnames enabled

```
Default VPC (172.31.0.0/16)
+---------------------------------------------+
|                                             |
|  AZ-a: 172.31.0.0/20  (public)            |
|  AZ-b: 172.31.16.0/20 (public)            |
|  AZ-c: 172.31.32.0/20 (public)            |
|                                             |
|  [Internet Gateway attached]                |
|  [Route: 0.0.0.0/0 -> igw]                |
|                                             |
+---------------------------------------------+
```

**When to use Default VPC:**
- Quick testing and learning
- Development environments
- Single-instance applications with no strict security requirements

**When NOT to use Default VPC:**
- Production workloads
- Any application handling sensitive data
- Multi-tier architectures
- Anything requiring private subnets

### Custom VPC

You create a Custom VPC with your own specifications.

**Custom VPC characteristics:**
- You choose the CIDR block
- No subnets by default (you create them)
- No Internet Gateway (you attach one if needed)
- Route tables start with only the local route
- DNS hostnames disabled by default (can enable)

**Best practice:** Always create a custom VPC for production workloads.

---

## 4. CIDR Blocks

**CIDR** = Classless Inter-Domain Routing. It defines the IP address range for your VPC.

### CIDR Notation Explained

```
10.0.0.0/16

10.0.0.0   = Starting IP address
/16        = Subnet mask (how many bits are fixed)

Fixed bits:  10.0  (16 bits fixed)
Variable bits:  x.x  (16 bits variable)
Total IPs = 2^16 = 65,536 IP addresses
```

### Common VPC CIDR Sizes

| CIDR | Number of IPs | Use Case |
|------|--------------|----------|
| /16 | 65,536 | Large enterprise VPC (recommended) |
| /17 | 32,768 | Medium VPC |
| /18 | 16,384 | Smaller VPC |
| /20 | 4,096 | Small VPC |
| /24 | 256 | Single subnet |
| /28 | 16 | Smallest allowed subnet |

### AWS VPC CIDR Rules
- Minimum: /28 (16 IPs)
- Maximum: /16 (65,536 IPs)
- Must be from private IP ranges:
  - `10.0.0.0/8` — Class A private
  - `172.16.0.0/12` — Class B private
  - `192.168.0.0/16` — Class C private
- Cannot overlap with other VPCs you want to peer with

### How to Choose Your CIDR

**Rule of thumb:** Start with `/16` unless you have a specific reason not to.

```
VPC: 10.0.0.0/16  (65,536 IPs total)
|
+-- Production VPC
|
+-- Subnets carved from this range:
    10.0.1.0/24   (256 IPs)
    10.0.2.0/24   (256 IPs)
    10.0.10.0/24  (256 IPs)
    10.0.20.0/24  (256 IPs)
    ... (room for many more subnets)
```

**Consider future growth:** If you might peer VPCs, make sure CIDR ranges don't overlap.

```
Environment   VPC CIDR
-----------   ---------
Production    10.0.0.0/16
Staging       10.1.0.0/16
Development   10.2.0.0/16
```

These can all be peered because they don't overlap.

---

## 5. Subnets

A **subnet** is a range of IP addresses within your VPC. You associate subnets with a specific **Availability Zone**.

### Why Subnets Exist
- Divide your VPC into segments
- Separate public-facing resources from private resources
- Place resources in specific AZs for high availability
- Apply different routing rules to different groups of resources

### Public Subnet vs Private Subnet

This is the **most important distinction** in VPC networking.

```
What makes a subnet PUBLIC:
  1. Has a route table entry: 0.0.0.0/0 -> Internet Gateway
  2. Resources get public IP addresses (or Elastic IPs)

What makes a subnet PRIVATE:
  1. NO route to Internet Gateway
  2. Resources have only private IP addresses
  3. Can optionally route through NAT Gateway for outbound internet access
```

#### Public Subnet
```
[Public Subnet 10.0.1.0/24]
      |
      | Route: 0.0.0.0/0 -> igw-xxxxx
      |
[Internet Gateway]
      |
[Internet]
```

Resources in a public subnet:
- Can receive incoming traffic from the internet (if security group allows)
- Can initiate outbound traffic to the internet
- Examples: Load Balancers, Bastion Hosts, NAT Gateways

#### Private Subnet
```
[Private Subnet 10.0.10.0/24]
      |
      | Route: 0.0.0.0/0 -> nat-xxxxx (optional)
      |
[NAT Gateway] (in public subnet)
      |
[Internet Gateway]
      |
[Internet] (outbound only!)
```

Resources in a private subnet:
- CANNOT receive incoming traffic from the internet
- CAN initiate outbound traffic (if NAT Gateway configured)
- Examples: App servers, Databases, Internal services

### Subnet CIDR Sizing

When you create a subnet with a `/24` CIDR, you get 256 IPs but only **251 usable**. AWS reserves 5:

```
Subnet: 10.0.1.0/24 (256 total IPs)

10.0.1.0   - Network address (reserved)
10.0.1.1   - VPC Router (reserved by AWS)
10.0.1.2   - DNS server (reserved by AWS)
10.0.1.3   - Reserved for future use (reserved by AWS)
10.0.1.4   - 10.0.1.254: Usable (251 IPs)
10.0.1.255 - Broadcast address (reserved)
```

### Common Subnet Sizes

| CIDR | Total IPs | Usable IPs | Good for |
|------|-----------|------------|----------|
| /24 | 256 | 251 | Standard subnet |
| /25 | 128 | 123 | Smaller subnet |
| /26 | 64 | 59 | Small subnet |
| /27 | 32 | 27 | Tiny subnet |
| /28 | 16 | 11 | Minimum subnet |

### Multi-AZ Subnet Design

**Always deploy subnets in at least 2 AZs** for high availability.

```
VPC: 10.0.0.0/16
|
+-- AZ us-east-1a
|   +-- Public Subnet:  10.0.1.0/24
|   +-- Private Subnet: 10.0.10.0/24
|
+-- AZ us-east-1b
|   +-- Public Subnet:  10.0.2.0/24
|   +-- Private Subnet: 10.0.20.0/24
|
+-- AZ us-east-1c (optional 3rd AZ)
    +-- Public Subnet:  10.0.3.0/24
    +-- Private Subnet: 10.0.30.0/24
```

### The Standard 4-Subnet Design

```
VPC: 10.0.0.0/16

Public Subnets (for ALB, NAT Gateway, Bastion):
  10.0.1.0/24  - us-east-1a
  10.0.2.0/24  - us-east-1b

Private Subnets (for EC2 app servers):
  10.0.10.0/24 - us-east-1a
  10.0.20.0/24 - us-east-1b

Database Subnets (isolated, often no outbound either):
  10.0.100.0/24 - us-east-1a
  10.0.200.0/24 - us-east-1b
```

---

## 6. Internet Gateway (IGW)

An **Internet Gateway** is a horizontally scaled, redundant, and highly available VPC component that allows communication between your VPC and the internet.

### What IGW Does
- Provides a target in your VPC route tables for internet-routable traffic
- Performs network address translation (NAT) for instances with public IPv4 addresses

### IGW Properties
- One IGW per VPC (1:1 mapping)
- Highly available and scalable (AWS manages this)
- No bandwidth constraints
- No availability risk
- Free to use (you pay for data transfer, not the IGW itself)

### IGW vs NAT Gateway

```
Internet Gateway:
  - Allows BOTH inbound AND outbound traffic
  - Used by PUBLIC subnets
  - Resources need a public IP to communicate

NAT Gateway:
  - Allows ONLY outbound traffic
  - Used by PRIVATE subnets
  - Translates private IPs to NAT's public IP
```

### How to Attach IGW

```
Step 1: Create IGW
  VPC Console -> Internet Gateways -> Create

Step 2: Attach to VPC
  Select IGW -> Actions -> Attach to VPC -> Select your VPC

Step 3: Add route to public subnet route table
  Route Tables -> Select public RT -> Routes -> Edit
  Add: 0.0.0.0/0 -> igw-xxxxxxxx
```

### Traffic Flow: EC2 in Public Subnet Accessing Internet

```
EC2 (10.0.1.10, public IP: 54.23.45.67)
  |
  | "Send packet to 8.8.8.8"
  v
Route Table: 0.0.0.0/0 -> igw-xxx
  |
  v
Internet Gateway
  - Receives packet from 10.0.1.10
  - Translates source to 54.23.45.67 (EC2's public IP)
  - Forwards to internet
  |
  v
8.8.8.8 (Google DNS)
  |
  v (response)
Internet Gateway
  - Receives packet destined for 54.23.45.67
  - Translates to 10.0.1.10 (private IP)
  - Forwards to EC2
```

---

## 7. NAT Gateway

**NAT (Network Address Translation) Gateway** allows instances in a **private subnet** to initiate outbound connections to the internet while preventing the internet from initiating connections with those instances.

### Why Private Subnets Need NAT

Private subnets cannot directly access the internet. But your app servers often need outbound internet access for:
- Software updates (`yum update`, `apt-get update`)
- Downloading packages
- Calling external APIs
- Sending data to SaaS services

NAT Gateway solves this without exposing your private instances to inbound internet traffic.

### How NAT Gateway Works

```
Private EC2 (10.0.10.5) wants to reach api.example.com
  |
  | Route: 0.0.0.0/0 -> nat-xxxxx
  v
NAT Gateway (in public subnet, has elastic IP: 52.10.20.30)
  |
  | Translates source: 10.0.10.5 -> 52.10.20.30
  | Records translation in NAT table
  v
Route Table: 0.0.0.0/0 -> igw-xxxxx
  |
  v
Internet Gateway -> api.example.com

Response:
api.example.com -> 52.10.20.30
  |
  v
NAT Gateway (looks up NAT table)
  - Translates destination: 52.10.20.30 -> 10.0.10.5
  v
Private EC2 receives the response
```

### NAT Gateway Placement

CRITICAL: NAT Gateway must be in a **PUBLIC subnet**. Private subnet resources route to it.

```
PUBLIC Subnet (AZ-a)        PRIVATE Subnet (AZ-a)
+-------------------+        +---------------------+
|                   |        |                     |
|  [NAT Gateway]  <---------  [EC2 App Server]    |
|  52.10.20.30      |        |  10.0.10.5          |
|                   |        |                     |
+-------------------+        +---------------------+
        |
        v
[Internet Gateway]
        |
        v
[Internet]
```

### NAT Gateway for High Availability

Create **one NAT Gateway per AZ** to avoid cross-AZ traffic charges and single points of failure.

```
AZ-a:
  Public Subnet:  NAT-GW-a (Elastic IP: 52.10.20.30)
  Private Subnet: Route 0.0.0.0/0 -> NAT-GW-a

AZ-b:
  Public Subnet:  NAT-GW-b (Elastic IP: 52.10.20.31)
  Private Subnet: Route 0.0.0.0/0 -> NAT-GW-b
```

### NAT Gateway Costs

| Cost Type | Amount |
|-----------|--------|
| Hourly charge | ~$0.045/hour (~$32/month) |
| Data processing | $0.045/GB |
| Data transfer | Standard EC2 rates |

**Note:** NAT Gateway is often one of the largest unexpected AWS costs. Monitor usage.

### NAT Gateway vs NAT Instance

| Feature | NAT Gateway | NAT Instance |
|---------|------------|--------------|
| Availability | Highly available within AZ | Single instance, can fail |
| Bandwidth | Up to 100 Gbps | Limited by instance type |
| Management | Fully managed by AWS | You manage OS, patches |
| Cost | Per hour + per GB | EC2 instance cost only |
| Security Groups | Not supported | Supported |
| Bastion host | Cannot be used as | Can be used as |
| Recommendation | Preferred for production | Legacy, avoid in new designs |

---

## 8. Route Tables

A **route table** contains a set of rules (routes) that determine where network traffic from your subnet or gateway is directed.

### How Routes Work

Each route has two components:
- **Destination**: The CIDR block you want to match
- **Target**: Where to send the traffic

```
Route Table Example:

Destination      Target
-----------      ------
10.0.0.0/16      local          (traffic within the VPC)
0.0.0.0/0        igw-xxxxxxxx   (all other traffic to internet)
```

**Most specific route wins.** If traffic matches multiple routes, the longest prefix (most specific) takes precedence.

```
Destination      Target
-----------      ------
10.0.0.0/16      local
10.0.5.0/24      vpc-peer-xxxxx    <- More specific
0.0.0.0/0        igw-xxxxxxxx
```

Traffic to `10.0.5.10` matches BOTH `10.0.0.0/16` and `10.0.5.0/24`, but the `/24` is more specific, so it goes to the VPC peer.

### Local Route

Every route table has a local route that **cannot be deleted**:

```
Destination      Target
-----------      ------
10.0.0.0/16      local
```

This route allows all resources within the VPC to communicate with each other, regardless of which subnet they're in.

### Main Route Table vs Custom Route Table

**Main Route Table:**
- Created automatically with the VPC
- Applied to any subnet that doesn't have an explicit association
- Best practice: Keep main route table restrictive (private) and create custom public route tables

**Custom Route Tables:**
- You create these for specific purposes
- Explicitly associated with specific subnets

```
VPC Main Route Table (default, conservative):
  10.0.0.0/16  local
  (no internet route)

Public Route Table (custom, for public subnets):
  10.0.0.0/16  local
  0.0.0.0/0    igw-xxxxx

Private Route Table AZ-a (custom, for private subnets in AZ-a):
  10.0.0.0/16  local
  0.0.0.0/0    nat-xxxxx-a

Private Route Table AZ-b (custom, for private subnets in AZ-b):
  10.0.0.0/16  local
  0.0.0.0/0    nat-xxxxx-b
```

### Subnet Associations

Each subnet is associated with exactly **one route table**.

```
Subnet 10.0.1.0/24 (Public AZ-a)  --> Public Route Table
Subnet 10.0.2.0/24 (Public AZ-b)  --> Public Route Table
Subnet 10.0.10.0/24 (Private AZ-a) --> Private RT AZ-a
Subnet 10.0.20.0/24 (Private AZ-b) --> Private RT AZ-b
```

### Route Table for Gateway

You can also attach a route table to a gateway (like an Internet Gateway) to route traffic entering through the gateway. This is used for advanced scenarios like security appliances.

### Complete Route Table Diagram

```
+------------------------------------------------------------------+
|  VPC 10.0.0.0/16                                                |
|                                                                  |
|  +-----------------------+   +--------------------------+        |
|  | Public Route Table    |   | Private Route Table AZ-a |       |
|  |                       |   |                          |        |
|  | 10.0.0.0/16 -> local  |   | 10.0.0.0/16 -> local    |       |
|  | 0.0.0.0/0   -> IGW    |   | 0.0.0.0/0   -> NAT-a    |       |
|  |                       |   |                          |        |
|  | Associated subnets:   |   | Associated subnets:      |       |
|  |   10.0.1.0/24         |   |   10.0.10.0/24           |       |
|  |   10.0.2.0/24         |   |                          |        |
|  +-----------------------+   +--------------------------+        |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 9. Security Groups

A **Security Group** acts as a virtual firewall for your EC2 instances (and other resources like RDS, Lambda, etc.) to control inbound and outbound traffic.

### Key Characteristics

- **Instance-level firewall** (not subnet-level)
- **Stateful**: If you allow inbound traffic, the return traffic is automatically allowed
- Rules are **allow only** — you cannot create deny rules
- All **inbound traffic is denied by default**
- All **outbound traffic is allowed by default**
- You can assign multiple security groups to one instance
- Changes take effect immediately

### Stateful Explained

```
STATEFUL means:
  If you allow SSH inbound (port 22),
  the response packets are AUTOMATICALLY allowed outbound.
  You don't need a separate outbound rule for SSH responses.

Example:
  Inbound rule: Allow TCP port 22 from 0.0.0.0/0
  
  When someone SSHes in:
  -> Inbound packet (port 22): ALLOWED by rule
  <- Response packets: AUTOMATICALLY ALLOWED (stateful)
  
  Without stateful: you'd need outbound rule too
  With stateful: only inbound rule needed
```

### Rule Components

| Component | Description | Example |
|-----------|-------------|---------|
| Type | Protocol type | SSH, HTTP, Custom TCP |
| Protocol | TCP, UDP, ICMP | TCP |
| Port Range | Port or port range | 22, 80, 443, 3306 |
| Source (inbound) | Where traffic comes from | 0.0.0.0/0, 10.0.0.0/16, sg-xxxxx |
| Destination (outbound) | Where traffic goes | 0.0.0.0/0, specific IP |

### Referencing Another Security Group

This is a **powerful feature** that allows you to say "allow traffic from any instance that has this security group."

```
Instead of: Allow port 80 from 10.0.1.0/24 (IP-based)

Use:        Allow port 80 from sg-ALB-SG (SG reference)

Benefit: Works even as instances scale in/out with different IPs
         The rule is based on identity, not IP address
```

### Common Security Group Patterns

#### Pattern 1: Three-Tier Web Application

```
ALB Security Group (sg-alb):
  Inbound:
    - HTTP  (80)  from 0.0.0.0/0    (public internet)
    - HTTPS (443) from 0.0.0.0/0    (public internet)
  Outbound:
    - All traffic to 0.0.0.0/0      (or restrict to EC2 SG)

EC2 App Server Security Group (sg-app):
  Inbound:
    - HTTP (80)   from sg-alb        (only from ALB)
    - SSH  (22)   from sg-bastion    (only from bastion)
  Outbound:
    - All traffic to 0.0.0.0/0      (or restrict to RDS SG + 443)

RDS Security Group (sg-rds):
  Inbound:
    - MySQL (3306) from sg-app       (only from app servers)
  Outbound:
    - (Usually not needed for RDS)

Bastion Security Group (sg-bastion):
  Inbound:
    - SSH (22) from your-office-IP/32  (restrict to known IPs!)
  Outbound:
    - SSH (22) to sg-app              (to reach app servers)
```

#### Visual Diagram

```
Internet
   |
   | (80/443)
   v
[ALB]  sg-alb: 80/443 from 0.0.0.0/0
   |
   | (80)
   v
[EC2]  sg-app: 80 from sg-alb
   |
   | (3306)
   v
[RDS]  sg-rds: 3306 from sg-app


Bastion:
[Admin] --(22)--> [Bastion] --(22)--> [EC2]
         sg-bastion: 22 from admin IP
                       sg-app: 22 from sg-bastion
```

### Default Security Group

- Created with every VPC
- Allows all inbound from the **same security group**
- Allows all outbound traffic
- Should not be used for production (too permissive)

---

## 10. Network ACLs (NACLs)

**Network Access Control Lists (NACLs)** are subnet-level firewalls. They control traffic in and out of one or more subnets.

### Key Characteristics

- **Subnet-level firewall** (not instance-level)
- **Stateless**: Must define both inbound AND outbound rules explicitly
- Rules are numbered and evaluated **in order from lowest to highest**
- First matching rule wins (stops evaluation)
- Rules can **allow OR deny**
- Default NACL: allows all inbound and outbound
- Custom NACL: denies all inbound and outbound by default

### Stateless Explained

```
STATELESS means:
  If you allow inbound HTTP (port 80),
  you MUST ALSO explicitly allow outbound ephemeral ports
  for the response to get back to the client.

Example HTTP web server:
  Inbound rule:  Allow TCP 80 from 0.0.0.0/0  (HTTP requests)
  Outbound rule: Allow TCP 1024-65535 to 0.0.0.0/0  (responses!)
                 ^^ ephemeral ports used for responses

Without the outbound rule, responses are DROPPED.
```

### Ephemeral Ports

When a client connects to your server on port 80, the client uses a random high port (1024-65535) as the source. Responses go to this ephemeral port.

```
Client (random port 52341) --> Server (port 80)
Server (port 80)           --> Client (port 52341)

NACL on server subnet needs:
  Inbound:  Allow TCP 80 from 0.0.0.0/0
  Outbound: Allow TCP 1024-65535 to 0.0.0.0/0  (ephemeral)
```

### NACL Rule Numbering

Rules are evaluated in ascending order. The first match wins.

```
Rule  Type        Protocol  Port Range  Source         Allow/Deny
----  ----        --------  ----------  ------         ----------
100   HTTP (80)   TCP       80          0.0.0.0/0      ALLOW
200   HTTPS (443) TCP       443         0.0.0.0/0      ALLOW
300   SSH (22)    TCP       22          203.0.113.0/24 ALLOW
*     All traffic All       All         0.0.0.0/0      DENY   <- implicit deny
```

**The `*` rule** is always present and denies everything not matched.

**Best practice:** Number rules in increments of 100 (100, 200, 300...) to leave room for inserting rules later.

### Blocking a Specific IP

NACLs are useful for blocking specific IPs — something Security Groups cannot do.

```
Rule 50:  DENY all TCP from 198.51.100.0/24  (block bad IP range)
Rule 100: ALLOW HTTP from 0.0.0.0/0

Traffic from 198.51.100.x hits Rule 50 first -> DENIED
Other traffic hits Rule 100 -> ALLOWED
```

### Default NACL

```
Inbound:
  Rule 100: ALLOW all from 0.0.0.0/0
  Rule *:   DENY all

Outbound:
  Rule 100: ALLOW all to 0.0.0.0/0
  Rule *:   DENY all
```

This allows all traffic — effectively no restriction.

### Custom NACL (from scratch)

```
Inbound:
  Rule *: DENY all    <- only rule, denies everything

Outbound:
  Rule *: DENY all    <- only rule, denies everything
```

You must explicitly add allow rules for any traffic you want.

---

## 11. Security Groups vs NACLs Comparison

This comparison is **heavily tested in interviews and exams**.

| Feature | Security Group | NACL |
|---------|---------------|------|
| Level | Instance level | Subnet level |
| State | **Stateful** | **Stateless** |
| Rule types | Allow only | Allow AND Deny |
| Rule evaluation | All rules evaluated | Rules in order (first match) |
| Default inbound | Deny all | Allow all (default NACL) |
| Default outbound | Allow all | Allow all (default NACL) |
| Return traffic | Automatically allowed | Must be explicitly allowed |
| Scope | Attached to ENI/instance | Attached to subnet |
| Multiple | One instance, many SGs | One subnet, one NACL |
| Response traffic | Automatic (stateful) | Need ephemeral port rules |

### When to Use Each

**Use Security Groups for:**
- Most use cases (preferred)
- Controlling which instances can talk to each other
- Application-level rules
- Referencing other security groups

**Use NACLs for:**
- **Blocking specific IP addresses** (you cannot deny in SGs)
- Adding an extra layer of security at subnet level
- Quick lockdown of entire subnets
- Compliance requirements for subnet-level firewall

### Combined Defense in Depth

```
Internet
   |
[NACL on public subnet]    <-- blocks known bad IPs/ranges
   |
[Security Group on ALB]    <-- allows 80/443 from internet
   |
[NACL on private subnet]   <-- allows only from public subnet range
   |
[Security Group on EC2]    <-- allows only from ALB SG
   |
[NACL on DB subnet]        <-- allows only from private subnet range
   |
[Security Group on RDS]    <-- allows only from EC2 SG
```

---

## 12. VPC Flow Logs

**VPC Flow Logs** capture information about IP traffic going to and from network interfaces in your VPC.

### What Flow Logs Capture

```
Sample flow log record:
2 123456789012 eni-abc123 10.0.1.5 10.0.2.8 80 52341 6 10 840 1620000000 1620000060 ACCEPT OK

Fields:
version  account-id  interface-id  srcaddr   dstaddr   srcport dstport protocol packets bytes  start      end        action  log-status
2        123456789   eni-abc123    10.0.1.5  10.0.2.8  80      52341   6(TCP)   10      840    1620000000 1620000060 ACCEPT  OK
```

### Flow Log Levels

- **VPC level**: Captures all traffic in the VPC
- **Subnet level**: Captures all traffic for that subnet
- **ENI level**: Captures traffic for a specific network interface

### Where to Send Flow Logs

- **Amazon S3**: For long-term storage and analysis with Athena
- **CloudWatch Logs**: For real-time analysis and alarms
- **Kinesis Data Firehose**: For streaming to third-party tools

### Log Format Options

- Default format (as shown above)
- Custom format (choose specific fields)
- Parquet format (for Athena performance)

### Analyzing Flow Logs

**With CloudWatch Logs Insights:**
```sql
-- Find rejected traffic
fields @timestamp, srcAddr, dstAddr, srcPort, dstPort, action
| filter action = "REJECT"
| sort @timestamp desc
| limit 100

-- Top talkers
stats sum(bytes) as totalBytes by srcAddr
| sort totalBytes desc
| limit 10

-- Find traffic to specific port
fields @timestamp, srcAddr, dstPort, action
| filter dstPort = 22
| sort @timestamp desc
```

**With Athena (flow logs in S3):**
```sql
SELECT srcaddr, dstaddr, srcport, dstport, action, protocol
FROM vpc_flow_logs
WHERE action = 'REJECT'
  AND start BETWEEN 1620000000 AND 1620086400
ORDER BY start DESC
LIMIT 100;
```

### Flow Logs Do NOT Capture

- Traffic to/from 169.254.169.254 (instance metadata)
- Traffic to/from 169.254.169.123 (time sync)
- DHCP traffic
- Traffic to the default VPC router
- DNS traffic to Route53

---

## 13. VPC Peering

**VPC Peering** allows you to route traffic between two VPCs using private IPv4 or IPv6 addresses. Instances in either VPC can communicate as if they are in the same network.

### Use Cases
- Connect dev, staging, and production VPCs
- Share services between teams in different VPCs
- Connect VPCs across accounts (e.g., shared services)
- Cross-region connectivity

### How Peering Works

```
VPC-A (10.0.0.0/16)         VPC-B (172.16.0.0/16)
+-------------------+         +-------------------+
| EC2: 10.0.1.5     | <-----> | EC2: 172.16.1.5   |
+-------------------+         +-------------------+
     Peering Connection

Route tables must be updated on BOTH sides:
VPC-A route table: 172.16.0.0/16 -> pcx-xxxxx
VPC-B route table: 10.0.0.0/16   -> pcx-xxxxx
```

### Key Properties

**NOT Transitive:**
```
A <--peered--> B <--peered--> C

Does A have access to C? NO!

You must create a direct peering between A and C:
A <--peered--> B
A <--peered--> C  (needed explicitly)
B <--peered--> C
```

This is a critical exam topic. VPC Peering is NOT transitive.

**No IP Overlap:**
VPC CIDRs cannot overlap for peering.

```
VPC-A: 10.0.0.0/16
VPC-B: 10.0.0.0/16  <- CANNOT PEER (overlapping CIDRs)

VPC-A: 10.0.0.0/16
VPC-B: 10.1.0.0/16  <- CAN PEER (no overlap)
```

### Peering Across Accounts and Regions

**Cross-Account:**
1. Account A creates peering request with Account B's VPC ID
2. Account B accepts the peering request
3. Both accounts update route tables

**Cross-Region:**
- Works the same as same-region peering
- Traffic travels over AWS backbone (encrypted in transit)
- Higher latency than same-region
- Data transfer costs apply

### Peering Limitations

- Maximum 125 peering connections per VPC
- DNS resolution across peers must be explicitly enabled
- Security groups cannot reference SGs in peered VPCs (across regions)
- Not transitive (must be full mesh for all-to-all communication)

**Full Mesh Example (3 VPCs):**
```
VPC-A -------- VPC-B
  \              /
   \            /
    \          /
     VPC-C----
     
Requires 3 peering connections.
For N VPCs: N*(N-1)/2 connections needed.
For 10 VPCs: 45 peering connections!
(Consider Transit Gateway for many VPCs)
```

---

## 14. VPC Endpoints

**VPC Endpoints** allow you to connect your VPC to AWS services without requiring internet gateway, NAT gateway, VPN, or Direct Connect.

Traffic flows entirely within the AWS network.

### Why Use VPC Endpoints

Without endpoint:
```
Private EC2 -> NAT Gateway -> Internet -> S3
(Internet traffic, data transfer costs, security exposure)
```

With endpoint:
```
Private EC2 -> VPC Endpoint -> S3
(Stays within AWS network, often free for Gateway endpoints)
```

### Types of VPC Endpoints

#### Gateway Endpoints

- Available for: **S3** and **DynamoDB** only
- Free of charge
- Added to route table as a route target
- Regional service (cannot use for cross-region)

```
Route Table with Gateway Endpoint:
Destination                 Target
-----------                 ------
10.0.0.0/16                 local
pl-xxxxxxxx (S3 prefix list) vpce-xxxxx   <- S3 gateway endpoint
0.0.0.0/0                   nat-xxxxx
```

**Creating S3 Gateway Endpoint:**
```
VPC Console -> Endpoints -> Create Endpoint
Type: Gateway
Service: com.amazonaws.us-east-1.s3
VPC: your-vpc
Route Tables: select private route tables
```

#### Interface Endpoints (PrivateLink)

- Available for: most AWS services (EC2 API, SNS, SQS, CloudWatch, etc.)
- Creates an ENI (Elastic Network Interface) in your subnet with a private IP
- Costs: ~$0.01/hour per AZ + $0.01/GB data processed
- Supports both same-region and cross-region (some services)

```
Private Subnet
+----------------------------------+
| EC2 Instance                     |
| Private IP: 10.0.10.5            |
|    |                             |
|    | (to SNS endpoint)           |
|    v                             |
| Interface Endpoint ENI           |
| Private IP: 10.0.10.100          |
|    |                             |
+----|---------------------------------+
     |
     | (AWS PrivateLink — stays in AWS network)
     v
[SNS Service]
```

### Gateway vs Interface Endpoints

| Feature | Gateway Endpoint | Interface Endpoint |
|---------|-----------------|-------------------|
| Services | S3, DynamoDB | Most AWS services |
| Cost | Free | ~$0.01/hr/AZ + data |
| Implementation | Route table entry | ENI in subnet |
| DNS | No change | Private DNS name |
| Cross-region | No | Some services |
| Availability | Regional | Per AZ |

### Endpoint Policies

You can attach policies to endpoints to control access:

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bucket/*"
    }
  ]
}
```

This restricts what can be done through the endpoint — useful for compliance.

---

## 15. Bastion Host

A **Bastion Host** (also called a Jump Server) is an EC2 instance in a public subnet that acts as a secure entry point into your private network.

### Why You Need a Bastion

Your app servers are in private subnets — no direct internet access.
How do you SSH into them for debugging?

**Answer:** SSH into the bastion first, then SSH from bastion to the private instance.

```
[Your Laptop]
      |
      | SSH (port 22) over internet
      v
[Bastion Host]          <- in public subnet, has public IP
      |
      | SSH (port 22) over private VPC network
      v
[Private EC2]           <- in private subnet, no public IP
```

### Bastion Security Best Practices

```
Bastion Security Group:
  Inbound:
    SSH (22) from YOUR_OFFICE_IP/32    <- ONLY your IP, not 0.0.0.0/0!
    SSH (22) from VPN_IP/32            <- also VPN if you use one
  Outbound:
    SSH (22) to private subnet CIDR     <- only where you need to go

Private EC2 Security Group:
  Inbound:
    SSH (22) from sg-bastion            <- only from bastion SG
```

### SSH Agent Forwarding (Best Practice)

Instead of storing private keys on the bastion:

```bash
# On your laptop:
ssh-add ~/.ssh/your-key.pem          # Add key to SSH agent
ssh -A ec2-user@bastion-public-ip    # -A enables agent forwarding
# Now on bastion:
ssh ec2-user@private-ec2-ip         # Uses forwarded key!
```

This means the private key **never leaves your laptop**.

### Alternatives to Bastion Hosts

Modern alternatives that are often more secure:

| Option | Description | Benefit |
|--------|-------------|---------|
| AWS Systems Manager Session Manager | Browser/CLI access, no port 22, no public IP needed | No bastion cost, full audit log |
| EC2 Instance Connect | Temporary SSH keys pushed by AWS | No persistent key management |
| VPN + Direct Access | VPN to VPC, then direct SSH | Better for teams |

**Best practice for 2024+:** Use **AWS Systems Manager Session Manager** instead of bastions for most use cases.

---

## 16. Complete Architecture Example

### 3-Tier Web Application

This is the canonical AWS architecture. Memorize it.

```
                          INTERNET
                             |
                      +-----------+
                      |   Route53 |
                      +-----------+
                             |
                      +-----------+
                      | CloudFront|
                      +-----------+
                             |
        +--------------------+--------------------+
        |           VPC 10.0.0.0/16               |
        |                                         |
        |   PUBLIC SUBNETS                        |
        |   +------------------+  +-------------+ |
        |   | AZ-a 10.0.1.0/24 |  |AZ-b         | |
        |   |                  |  |10.0.2.0/24  | |
        |   |  [NAT-GW-a]      |  |[NAT-GW-b]  | |
        |   |  [Bastion]       |  |             | |
        |   +------------------+  +-------------+ |
        |           |                    |        |
        |   +--------+------------------++        |
        |   |          ALB (spans both)  |        |
        |   +----------------------------+        |
        |           |                            |
        |   PRIVATE SUBNETS (App Tier)            |
        |   +------------------+  +-------------+ |
        |   | AZ-a 10.0.10.0/24|  |AZ-b         | |
        |   |                  |  |10.0.20.0/24 | |
        |   |  [EC2 App 1]     |  |[EC2 App 2]  | |
        |   |  [EC2 App 2]     |  |[EC2 App 3]  | |
        |   +------------------+  +-------------+ |
        |           |                    |        |
        |   PRIVATE SUBNETS (DB Tier)             |
        |   +------------------+  +-------------+ |
        |   | AZ-a10.0.100.0/24|  |AZ-b         | |
        |   |                  |  |10.0.200.0/24| |
        |   |  [RDS Primary]   |  |[RDS Standby]| |
        |   +------------------+  +-------------+ |
        |                                         |
        +-----------------------------------------+
```

### Security Group Rules for This Architecture

```
sg-alb (Application Load Balancer):
  Inbound:  TCP 80  from 0.0.0.0/0
            TCP 443 from 0.0.0.0/0
  Outbound: TCP 80  to sg-app

sg-app (EC2 Application Servers):
  Inbound:  TCP 80  from sg-alb
            TCP 22  from sg-bastion
  Outbound: TCP 3306 to sg-rds
            TCP 443 to 0.0.0.0/0 (external API calls via NAT)

sg-rds (RDS Database):
  Inbound:  TCP 3306 from sg-app
  Outbound: (none needed for RDS typically)

sg-bastion (Bastion Host):
  Inbound:  TCP 22 from your-corporate-ip/32
  Outbound: TCP 22 to sg-app
```

### Route Tables for This Architecture

```
Public Route Table:
  10.0.0.0/16  -> local
  0.0.0.0/0    -> igw-xxxxx
  Subnets: 10.0.1.0/24, 10.0.2.0/24

Private RT AZ-a:
  10.0.0.0/16  -> local
  0.0.0.0/0    -> nat-a-xxxxx
  Subnets: 10.0.10.0/24, 10.0.100.0/24

Private RT AZ-b:
  10.0.0.0/16  -> local
  0.0.0.0/0    -> nat-b-xxxxx
  Subnets: 10.0.20.0/24, 10.0.200.0/24
```

---

## 17. Hands-on Lab

### Complete VPC Setup from Scratch

**Step 1: Create the VPC**
```
VPC Console -> Your VPCs -> Create VPC
Name: prod-vpc
IPv4 CIDR: 10.0.0.0/16
IPv6: No IPv6 CIDR block
Tenancy: Default
-> Create
```

**Step 2: Enable DNS Hostnames**
```
Select prod-vpc -> Actions -> Edit DNS hostnames
Enable DNS hostnames: checked
-> Save
```

**Step 3: Create Subnets**

Public Subnet AZ-a:
```
Subnets -> Create subnet
VPC: prod-vpc
Subnet name: public-subnet-1a
AZ: us-east-1a
CIDR: 10.0.1.0/24
-> Create
```

Repeat for:
- `public-subnet-1b` in us-east-1b: 10.0.2.0/24
- `private-subnet-1a` in us-east-1a: 10.0.10.0/24
- `private-subnet-1b` in us-east-1b: 10.0.20.0/24

**Step 4: Enable Auto-assign Public IPs for Public Subnets**
```
Select public-subnet-1a -> Actions -> Edit subnet settings
Auto-assign public IPv4 address: checked
-> Save
Repeat for public-subnet-1b
```

**Step 5: Create Internet Gateway**
```
Internet Gateways -> Create internet gateway
Name: prod-igw
-> Create
-> Actions -> Attach to VPC -> prod-vpc -> Attach
```

**Step 6: Create NAT Gateways**

First, allocate Elastic IPs:
```
Elastic IPs -> Allocate Elastic IP address -> Allocate
(Do this twice, for two NAT gateways)
```

Create NAT Gateway AZ-a:
```
NAT Gateways -> Create NAT gateway
Name: nat-gw-1a
Subnet: public-subnet-1a
Elastic IP: [first EIP]
-> Create
```

Create NAT Gateway AZ-b:
```
NAT Gateways -> Create NAT gateway
Name: nat-gw-1b
Subnet: public-subnet-1b
Elastic IP: [second EIP]
-> Create
```

Wait for both to show "Available" state (~1-2 minutes).

**Step 7: Create and Configure Route Tables**

Public Route Table:
```
Route Tables -> Create route table
Name: public-rt
VPC: prod-vpc
-> Create

Edit routes:
  Add route: 0.0.0.0/0 -> igw-xxxxx
  -> Save

Edit subnet associations:
  Add: public-subnet-1a, public-subnet-1b
  -> Save
```

Private Route Table AZ-a:
```
Route Tables -> Create route table
Name: private-rt-1a
VPC: prod-vpc
-> Create

Edit routes:
  Add route: 0.0.0.0/0 -> nat-gw-1a
  -> Save

Edit subnet associations:
  Add: private-subnet-1a
  -> Save
```

Private Route Table AZ-b:
```
Route Tables -> Create route table
Name: private-rt-1b
VPC: prod-vpc
-> Create

Edit routes:
  Add route: 0.0.0.0/0 -> nat-gw-1b
  -> Save

Edit subnet associations:
  Add: private-subnet-1b
  -> Save
```

**Step 8: Create Security Groups**

Bastion SG:
```
Security Groups -> Create security group
Name: bastion-sg
VPC: prod-vpc
Inbound: SSH (22) from My IP
Outbound: All traffic
-> Create
```

App Server SG:
```
Name: app-sg
VPC: prod-vpc
Inbound:
  SSH (22) from Custom: bastion-sg
Outbound: All traffic
-> Create
```

**Step 9: Launch Bastion in Public Subnet**
```
EC2 -> Launch instance
AMI: Amazon Linux 2
Instance type: t2.micro
Network: prod-vpc
Subnet: public-subnet-1a
Auto-assign public IP: Enable
Security group: bastion-sg
Key pair: your-key-pair
-> Launch
```

**Step 10: Launch App Server in Private Subnet**
```
EC2 -> Launch instance
AMI: Amazon Linux 2
Instance type: t2.micro
Network: prod-vpc
Subnet: private-subnet-1a
Auto-assign public IP: Disable
Security group: app-sg
Key pair: your-key-pair
-> Launch
```

**Step 11: Test Access via Bastion**
```bash
# From your laptop:
ssh-add ~/.ssh/your-key.pem
ssh -A ec2-user@<bastion-public-ip>

# From bastion:
ssh ec2-user@<private-ec2-private-ip>

# Test internet from private instance:
curl https://checkip.amazonaws.com
# Should show NAT Gateway's Elastic IP
```

**Step 12: Verify NAT Gateway Working**
```bash
# On private EC2:
sudo yum update -y   # Should work (goes through NAT)
curl -I https://google.com  # Should return headers
```

### Cleanup (to avoid charges)
```
1. Terminate EC2 instances
2. Delete NAT Gateways (takes a few minutes)
3. Release Elastic IPs (after NAT GW deleted)
4. Detach and delete Internet Gateway
5. Delete subnets
6. Delete route tables
7. Delete security groups
8. Delete VPC
```

---

## 18. Interview Q&A

### Basic Level

**Q1: What is the difference between a public and private subnet?**

A: A public subnet has a route in its route table pointing `0.0.0.0/0` to an Internet Gateway, and instances typically have public IP addresses. A private subnet has no route to an Internet Gateway, so instances are not directly reachable from the internet. Private subnets can have a route to a NAT Gateway for outbound-only internet access.

---

**Q2: What is the difference between a Security Group and a NACL?**

A:
- Security Groups are **stateful** and operate at the **instance level**. They only support allow rules.
- NACLs are **stateless** and operate at the **subnet level**. They support both allow and deny rules. Rules are evaluated in numbered order.
- Stateful means return traffic is automatically allowed (SGs). Stateless means you must explicitly allow return traffic with ephemeral port rules (NACLs).

---

**Q3: Can you change a VPC CIDR block after creation?**

A: Yes, you can **associate additional CIDR blocks** to an existing VPC. However, you cannot change the original CIDR block. You can add up to 5 CIDRs per VPC. The new CIDRs cannot overlap with existing ones.

---

**Q4: Why is a NAT Gateway placed in a public subnet?**

A: Because NAT Gateway needs to route traffic to the Internet Gateway for outbound internet access. The public subnet has the route `0.0.0.0/0 -> IGW`, enabling the NAT Gateway to reach the internet. Private subnet instances route their outbound traffic to the NAT Gateway, which then forwards it through the IGW.

---

**Q5: How many Elastic IPs does a NAT Gateway need?**

A: One Elastic IP per NAT Gateway. All traffic from private subnet instances going through that NAT Gateway appears to originate from that Elastic IP.

---

### Intermediate Level

**Q6: An EC2 instance in a private subnet cannot reach the internet. What would you check?**

A:
1. Does the private subnet's route table have a route `0.0.0.0/0 -> nat-xxxxx`?
2. Is the NAT Gateway in a **public** subnet (not private)?
3. Does the public subnet's route table have `0.0.0.0/0 -> igw-xxxxx`?
4. Is the NAT Gateway in "Available" state?
5. Does the EC2 security group allow the outbound traffic?
6. Does the NACL allow the outbound traffic and inbound return traffic?

---

**Q7: What is VPC Peering and what are its limitations?**

A: VPC Peering connects two VPCs so resources can communicate using private IPs. Limitations:
1. **Not transitive** — if A peers with B and B peers with C, A cannot reach C through B
2. **No overlapping CIDRs** — peered VPCs must have non-overlapping IP ranges
3. Does not support edge-to-edge routing (VPN, Direct Connect, IGW from one VPC to another)
4. Maximum 125 peering connections per VPC

---

**Q8: What is the difference between a Gateway Endpoint and an Interface Endpoint?**

A:
- **Gateway Endpoints**: Only for S3 and DynamoDB. Free. Works by adding an entry to the route table. Does not use DNS.
- **Interface Endpoints (PrivateLink)**: For most AWS services. Costs per hour and per GB. Creates an ENI in your subnet with a private IP. Uses private DNS for name resolution.

---

**Q9: A security group only has an inbound rule allowing port 80. Can instances respond to HTTP requests?**

A: Yes. Security Groups are **stateful**, so once an inbound connection is established (HTTP request in on port 80), the response traffic is automatically allowed out, even without an explicit outbound rule.

---

**Q10: What happens to traffic in a NACL if no rule matches?**

A: Every NACL has a final implicit rule denoted as `*` that **denies all traffic** that hasn't matched any previous rule. This applies to both inbound and outbound traffic.

---

### Advanced Level

**Q11: You have 10 VPCs that all need to communicate with each other. Would you use VPC Peering or Transit Gateway? Why?**

A: **Transit Gateway**. With 10 VPCs and full mesh peering, you'd need `10*(10-1)/2 = 45` peering connections. Each VPC's route table would need entries for 9 other VPCs. Transit Gateway acts as a hub — each VPC connects to TGW once, and TGW handles routing between all VPCs. Much simpler to manage, especially as VPC count grows.

---

**Q12: How do you allow a private subnet to access S3 without going through NAT Gateway?**

A: Create a **VPC Gateway Endpoint** for S3. This:
1. Adds a route to the private subnet's route table pointing S3 traffic to the endpoint
2. Traffic flows directly from the VPC to S3 within the AWS network
3. Saves NAT Gateway data processing costs
4. Removes internet exposure for S3 traffic

---

**Q13: Your application's private EC2 instances need to call the AWS CloudWatch API. How do you enable this without internet access?**

A: Two options:
1. **Interface VPC Endpoint for CloudWatch** (`com.amazonaws.region.monitoring`) — creates private connectivity to CloudWatch without internet
2. **Via NAT Gateway** — allows outbound internet access, CloudWatch calls go through NAT then internet

Interface Endpoint is preferred for security-sensitive environments.

---

**Q14: Explain VPC Flow Log record for this scenario: REJECT action**

A:
```
REJECT in a flow log means the traffic was blocked by either:
1. A Security Group denied it (inbound rule missing)
2. A NACL denied it (explicit deny rule or caught by * deny)

To investigate:
- Check Security Group rules for the destination instance
- Check NACL rules for the source and destination subnets
- Note: Security Groups only have ALLOW rules, so REJECT from SG means
  no matching allow rule was found
- Flow logs show REJECT for both SG and NACL drops
```

---

**Q15: How does the VPC router handle traffic?**

A: The VPC router is an invisible, implicit component at the first IP of each subnet (`x.x.x.1` — reserved by AWS). It:
1. Routes traffic within the VPC based on route tables
2. Is the first hop for any traffic leaving a subnet
3. Evaluates the route table to determine next hop
4. The `local` route in route tables points to the VPC router for intra-VPC traffic

---

**Q16: Can you explain the full packet journey from a browser to an app on a private EC2?**

A:
```
1. Browser sends request to ALB public DNS name
2. DNS resolves to ALB's public IP (in public subnet)
3. Packet hits Internet Gateway
4. IGW routes to ALB (in public subnet)
5. ALB terminates the TLS connection
6. ALB checks target group, selects healthy EC2 in private subnet
7. ALB forwards request to EC2 private IP (within VPC, local route)
8. NACLs checked at both public and private subnet boundaries
9. Security Groups checked on ALB (outbound) and EC2 (inbound)
10. EC2 processes request, sends response
11. Response goes directly to ALB (local route)
12. ALB sends response to browser via IGW
```

---

**Q17: What is a VPC Endpoint Policy and when would you use it?**

A: An endpoint policy controls which AWS principals can use the VPC endpoint and which actions/resources they can access. Use cases:
- Restrict S3 access to only your company's buckets (prevent data exfiltration)
- Allow only read operations through the endpoint
- Restrict DynamoDB access to specific tables

Example: Prevent EC2s from writing to S3 buckets outside your organization using an endpoint policy that restricts to your org's bucket names.

---

**Q18: What is the difference between a Network Interface (ENI) and a Security Group?**

A:
- **ENI (Elastic Network Interface)**: Virtual network card. Has MAC address, private IP, public IP. Can be moved between instances.
- **Security Group**: Firewall rules. Attached to ENIs. Controls what traffic is allowed.

You attach a Security Group TO an ENI. An instance can have multiple ENIs, each with different security groups.

---

**Q19: How would you set up a highly available NAT solution?**

A:
1. Create one NAT Gateway per AZ (e.g., NAT-a in AZ-a, NAT-b in AZ-b)
2. Create a separate private route table per AZ
3. Route AZ-a private subnets to NAT-a
4. Route AZ-b private subnets to NAT-b

This ensures:
- If AZ-a goes down, AZ-b's NAT still works
- No cross-AZ data transfer charges
- NAT Gateway itself is AWS-managed (HA within one AZ)

---

**Q20: Can Security Groups span VPCs?**

A: No. Security Groups are VPC-specific. You cannot reference a Security Group in VPC-A when creating rules in VPC-B's Security Group (with the exception of same-region VPC peering where the SG can be referenced by ID, but NOT cross-region).

---

**Q21: What is the difference between a VPC and a subnet CIDR?**

A:
- VPC CIDR: Defines the entire IP address space for the VPC (e.g., 10.0.0.0/16)
- Subnet CIDR: A subset of the VPC CIDR allocated to a specific subnet in a specific AZ (e.g., 10.0.1.0/24)

The subnet CIDR must be within the VPC CIDR range. All subnets in a VPC collectively use portions of the VPC CIDR space.

---

**Q22: How do you restrict access to an S3 bucket to only resources within your VPC?**

A: Use an **S3 bucket policy** with a condition:

```json
{
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::my-bucket", "arn:aws:s3:::my-bucket/*"],
      "Condition": {
        "StringNotEquals": {
          "aws:SourceVpce": "vpce-xxxxx"
        }
      }
    }
  ]
}
```

Combined with a VPC Gateway Endpoint, this ensures S3 is only accessible from within your VPC.

---

**Q23: What is "split tunnel" in the context of VPC networking?**

A: Split tunneling in AWS context often refers to Client VPN behavior where:
- **With split tunnel**: Only traffic destined for VPC CIDR goes through VPN. Other internet traffic goes directly from client to internet.
- **Without split tunnel**: ALL traffic routes through VPN first.

For VPC design, split-horizon DNS is more relevant — returning private IPs to DNS queries from within the VPC.

---

**Q24: If you delete the main route table, what happens?**

A: You cannot delete the main route table — AWS prevents this. You can replace the main route table by promoting a custom route table to be the main one. The old main RT then becomes a custom RT that can be deleted (if no subnets are associated).

---

**Q25: What are VPC Sharing and Resource Access Manager (RAM) in relation to VPCs?**

A: VPC Sharing allows you to share subnets from a VPC in one AWS account with other accounts within the same AWS Organization. Using AWS RAM:
- The owner account creates and owns the VPC and subnets
- Participant accounts launch resources into the shared subnets
- Benefits: Centralized networking team manages one VPC, application teams deploy into shared subnets
- Fewer VPCs to manage compared to one VPC per account

---

*End of VPC Complete Guide — This is the most comprehensive VPC reference for AWS interviews and certification exams.*
