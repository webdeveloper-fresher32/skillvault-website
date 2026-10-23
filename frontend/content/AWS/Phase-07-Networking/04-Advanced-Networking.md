# Advanced AWS Networking

> Enterprise connectivity: Transit Gateway, Direct Connect, VPN, and Network Firewall.

---

## Table of Contents

1. [Transit Gateway](#1-transit-gateway)
2. [AWS Direct Connect](#2-aws-direct-connect)
3. [Site-to-Site VPN](#3-site-to-site-vpn)
4. [Client VPN](#4-client-vpn)
5. [VPN vs Direct Connect Comparison](#5-vpn-vs-direct-connect-comparison)
6. [AWS Network Firewall](#6-aws-network-firewall)
7. [Architecture Patterns](#7-architecture-patterns)
8. [Interview Q&A](#8-interview-qa)

---

## 1. Transit Gateway

**AWS Transit Gateway (TGW)** acts as a **network transit hub** that you can use to interconnect your VPCs and on-premises networks. Think of it as a giant router in the cloud.

### The Problem Transit Gateway Solves

Without Transit Gateway (VPC Peering mesh):
```
VPC-A <-> VPC-B
VPC-A <-> VPC-C
VPC-A <-> VPC-D
VPC-B <-> VPC-C
VPC-B <-> VPC-D
VPC-C <-> VPC-D

4 VPCs = 6 peering connections
10 VPCs = 45 peering connections
N VPCs = N*(N-1)/2 connections

Problems:
- Complexity grows quadratically
- Each VPC must have routes to all others
- Hard to manage, error-prone
```

With Transit Gateway:
```
VPC-A ------+
VPC-B ------+
VPC-C ------+--> [Transit Gateway] <-- VPN/Direct Connect
VPC-D ------+
VPC-E ------+

N VPCs = N connections (one per VPC)

Benefits:
- Hub-and-spoke model
- Centralized routing
- On-premises connected once to TGW, reaches all VPCs
```

### How Transit Gateway Works

```
Transit Gateway Components:

1. Transit Gateway (the hub)
2. Attachments (connections to VPCs, VPNs, Direct Connect)
3. Route Tables (TGW-level routing)
4. Associations (attachment -> route table)
5. Propagations (automatically add routes from attachments)
```

### TGW Routing

Transit Gateway has its own route tables (separate from VPC route tables):

```
TGW Route Table:
  10.0.0.0/16  -> VPC-A attachment
  10.1.0.0/16  -> VPC-B attachment
  10.2.0.0/16  -> VPC-C attachment
  0.0.0.0/0    -> VPN attachment (default to on-prem)
```

VPC route tables still need entries pointing to TGW:
```
VPC-A route table:
  10.0.0.0/16  local
  10.1.0.0/16  -> tgw-xxxxx (to VPC-B)
  10.2.0.0/16  -> tgw-xxxxx (to VPC-C)
  0.0.0.0/0    -> tgw-xxxxx (to on-premises via TGW)
```

### Transit Gateway Features

**Inter-Region Peering:**
```
TGW us-east-1 <--peering--> TGW eu-west-1 <--peering--> TGW ap-southeast-1

All VPCs in all regions can communicate through TGW peering
Traffic stays on AWS backbone (not internet)
```

**Multicast:**
```
TGW supports IP multicast
One-to-many traffic distribution
Used for: media distribution, financial data feeds
```

**Transit Gateway Network Manager:**
```
Centralized monitoring of your global network
Visual topology map
Route analysis
Network performance monitoring
```

**Blackhole Routes:**
```
TGW Route Table:
  10.0.0.0/16  -> VPC-A
  10.1.0.0/16  -> BLACKHOLE  <- Drop all traffic to this CIDR!
  
Use case: Isolate specific VPCs or block certain traffic
```

### Centralized Inspection Architecture

```
Security VPC (central inspection)
  +----------------------------------+
  | [AWS Network Firewall] or [NVA]  |
  +----------------------------------+
         |
    [Transit Gateway]
    /     |     \     \
VPC-A  VPC-B  VPC-C  On-Prem

TGW Route Table: send ALL traffic through Security VPC first
Security VPC inspects traffic, then routes to destination
```

### Transit Gateway Costs

- Attachment: $0.05/hour per attachment (~$36/month)
- Data processing: $0.02/GB processed
- Inter-region peering: additional data transfer costs

**Example:** 5 VPCs + 1 VPN attachment = 6 attachments = $0.30/hour = ~$216/month (before data transfer)

---

## 2. AWS Direct Connect

**AWS Direct Connect (DX)** provides a **dedicated private network connection** from your on-premises datacenter to AWS. Traffic never goes over the public internet.

### The Problem Direct Connect Solves

```
Problem with VPN over internet:
  Office ----[Internet]---- AWS
  - Variable latency (internet congestion)
  - Lower bandwidth
  - Security concerns (even encrypted VPN over internet)
  - Unreliable for production workloads

Direct Connect Solution:
  Office ----[Dedicated fiber]---- AWS Direct Connect Location ---- AWS
  - Consistent, low latency
  - High bandwidth (1Gbps, 10Gbps, 100Gbps)
  - Private connection (not over internet)
  - Predictable performance
```

### Direct Connect Architecture

```
Your Data Center (Chicago)
         |
         | (your physical fiber to DX location)
         v
+----------------------------+
| Direct Connect Location    |
| (e.g., Equinix CH2)        |
|                            |
| +------------------------+ |
| | Customer/Partner Router| |
| +------------------------+ |
|           |                |
| +------------------------+ |
| | AWS Direct Connect     | |
| | Router (AWS cage)      | |
| +------------------------+ |
+----------------------------+
         |
         | (AWS backbone)
         v
    AWS Region (us-east-1)
    +------------------+
    | Direct Connect   |
    | Gateway          |
    +------------------+
           |
    +------+------+
    |             |
   VPC-1         VPC-2
```

### Types of Direct Connect Connections

**Dedicated Connection:**
```
Bandwidth: 1 Gbps, 10 Gbps, 100 Gbps
Provision: Order from AWS, physical fiber to DX location
Lead time: Weeks to months (physical provisioning)
Use when: Large bandwidth requirements, committed long-term
```

**Hosted Connection (via AWS Partners):**
```
Bandwidth: 50 Mbps to 10 Gbps (flexible)
Provision: Order through APN partner (faster)
Lead time: Days to weeks
Use when: Smaller bandwidth, faster setup, flexible
```

### Virtual Interfaces (VIFs)

A Virtual Interface is the logical connection through Direct Connect:

**Private VIF:**
```
Connects to a VPC (via Virtual Private Gateway or Direct Connect Gateway)
Traffic reaches private IP resources in VPC
BGP sessions for routing exchange
```

**Public VIF:**
```
Connects to AWS public endpoints (S3, DynamoDB, public AWS services)
Access AWS public services without internet
Uses AWS public IP ranges
```

**Transit VIF:**
```
Connects to a Transit Gateway
Allows reaching multiple VPCs and VPNs through one DX connection
Requires Transit Gateway attachment
```

### Direct Connect Gateway

Connects a Direct Connect connection to multiple VPCs across regions:

```
Direct Connect Location
       |
  [Direct Connect Gateway]  <- AWS global private network
  /    |    \    \
VPC-1  VPC-2  VPC-3  VPC-4
(us-east-1)  (eu-west-1)  <- Multiple regions!
```

One Direct Connect Gateway can connect to up to 10 VGWs (Virtual Private Gateways) or TGW.

### Direct Connect Resiliency

Single connection is a single point of failure:

```
Basic (no redundancy):
  DC ----DX Location 1---- AWS
  
  Risk: DX location failure, physical fiber cut

High Resiliency:
  DC ----DX Location 1----+
                          +---- AWS
  DC ----DX Location 2----+
  
  Same location, different connections
  Handles: connection failure, device failure

Maximum Resiliency:
  DC-1 --DX Location 1-+
                        +-- AWS
  DC-2 --DX Location 2-+
  
  Different locations, different DCs
  Handles: complete location failure, datacenter failure
```

### Direct Connect + VPN Backup

For hybrid environments with DX:

```
Normal:
  On-prem ----[Direct Connect]---- AWS

If Direct Connect fails:
  On-prem ----[Site-to-Site VPN over internet]---- AWS

Configuration:
  BGP path: DX preferred (better path metrics)
  VPN as backup (higher BGP cost)
  Automatic failover when DX BGP session drops
```

### Direct Connect Costs

- Port hour: $0.30/hr for 1G dedicated (~$216/month)
- Data transfer out: $0.02/GB (varies by region)
- Data transfer IN: Free
- Partnership/colocation fees at DX location (not AWS)

Direct Connect is expensive — justified for high-volume, latency-sensitive workloads.

---

## 3. Site-to-Site VPN

**AWS Site-to-Site VPN** creates an **encrypted IPsec tunnel** over the public internet between your on-premises network and your AWS VPC.

### How Site-to-Site VPN Works

```
Your Data Center                    AWS VPC
+------------------+                +------------------+
|                  |                |                  |
| Customer Gateway |                | Virtual Private  |
| (your VPN device)|<====IPsec=====>| Gateway (VGW)    |
| 203.0.113.1      |                |                  |
|                  |                | Private resources|
+------------------+                +------------------+
       |
       | (Public Internet, but encrypted)
       |
  [AWS backbone for routing]
```

### Components

**Customer Gateway (CGW):**
```
Represents your on-premises VPN device in AWS
Contains:
  - IP address of your VPN device (public IP)
  - Routing type (static or dynamic/BGP)
  - BGP ASN (if using dynamic routing)
```

**Virtual Private Gateway (VGW) or Transit Gateway:**
```
VGW: Attached to a single VPC
TGW: Can connect to multiple VPCs (preferred for multi-VPC)
```

**VPN Connection:**
```
Connects CGW to VGW/TGW
Creates 2 tunnels for redundancy
Each tunnel has:
  - Outside IP (AWS side)
  - Pre-shared key or certificates
  - Routing configuration
```

### Creating a VPN Connection

```
Step 1: Create Customer Gateway
  Name: office-cgw
  IP address: 203.0.113.1 (your router's public IP)
  Routing: Dynamic (BGP) or Static
  BGP ASN: 65000 (your ASN)

Step 2: Create/use Virtual Private Gateway
  Attach VGW to your VPC

Step 3: Create VPN Connection
  Customer gateway: office-cgw
  Virtual private gateway: your-vgw
  Routing: Dynamic or Static
  
  If static: add your on-prem CIDR (192.168.0.0/24)
  If dynamic: BGP will exchange routes

Step 4: Download Configuration
  Download config file for your specific VPN device
  (Cisco, Juniper, Palo Alto, etc.)

Step 5: Configure your VPN device
  Apply the downloaded config
  Tunnels should come UP

Step 6: Enable route propagation (for dynamic routing)
  VPC Route Table -> Route Propagation -> Enable
  Routes from on-prem appear automatically

Step 7: Test
  Ping from EC2 to on-prem device
  Ping from on-prem to EC2
```

### VPN Redundancy

Each VPN connection has **2 tunnels** automatically:

```
Your Router ----Tunnel 1 (endpoint: 169.254.12.1)---- AWS
              ----Tunnel 2 (endpoint: 169.254.12.2)---- AWS

If Tunnel 1 fails, Tunnel 2 continues
AWS keeps both tunnels in different AZs
```

For higher availability with BGP:
```
Configure BGP on your router to prefer Tunnel 1
Tunnel 2 is standby with higher BGP cost
Automatic failover when Tunnel 1 drops BGP session
```

### VPN Limitations

- **Bandwidth**: Up to 1.25 Gbps per VPN connection
- **Latency**: Variable (over internet)
- **Encryption overhead**: IPsec adds processing overhead
- **Cost**: $0.05/hour per connection + data transfer

For higher bandwidth, use Direct Connect.

### VPN Monitoring

```
CloudWatch Metrics for VPN:
  TunnelState (0 = DOWN, 1 = UP)
  TunnelDataIn (bytes received)
  TunnelDataOut (bytes sent)

Set alarm on TunnelState = 0 for notification
```

---

## 4. Client VPN

**AWS Client VPN** provides secure remote access for **individual users** to AWS or on-premises networks.

### Use Case

```
Remote workers connecting to AWS resources:

Employee's Laptop ----[Client VPN over internet]---- AWS VPC
                  (encrypted, authenticated)

Gains access to:
  - Private EC2 instances
  - RDS databases
  - On-premises (split tunneling or full tunnel)
```

### Architecture

```
Client VPN Endpoint
  - Associated with VPC subnet
  - Has a DNS name for clients to connect to
  - Authentication: Active Directory, SAML, or certificates

Client device:
  - AWS VPN Client application
  - OpenVPN-compatible client
  - Downloads .ovpn configuration file
```

### Authentication Methods

**Mutual Authentication (Certificate-based):**
```
- Client certificate + server certificate
- Most secure
- Manual certificate management
- Good for: small teams, high security
```

**Active Directory Authentication:**
```
- Uses Microsoft AD (self-managed or AWS Managed AD)
- Username + password
- Good for: enterprises with existing AD
```

**SAML-Based Federation:**
```
- Okta, Azure AD, AWS SSO
- Single Sign-On integration
- Good for: organizations with SSO
```

### Client VPN Features

- **Split tunneling**: Only VPC-destined traffic through VPN, other internet traffic direct
- **VPC peering support**: Access peered VPCs through Client VPN
- **Authorization rules**: Control which users/groups access which CIDR ranges
- **Connection logging**: CloudWatch Logs for audit

### Client VPN Costs

- Client VPN endpoint association: $0.10/hour
- Client VPN connection: $0.05/hour per connection

---

## 5. VPN vs Direct Connect Comparison

| Feature | Site-to-Site VPN | Direct Connect |
|---------|-----------------|----------------|
| Connection | Over internet (encrypted) | Private dedicated line |
| Setup time | Minutes to hours | Weeks to months |
| Bandwidth | Up to 1.25 Gbps | 1, 10, 100 Gbps |
| Latency | Variable (internet) | Consistent, low |
| Reliability | Internet dependent | Dedicated, SLA-backed |
| Cost | Low (~$36-72/month) | High (~$216+/month) |
| Encryption | IPsec (always) | Optional (not automatic) |
| Good for | Dev, backup, smaller workloads | Production, large data transfer |
| HA setup | 2 tunnels per connection | Multiple connections/locations |
| BGP | Supported | Supported (required for private VIF) |

### When to Use Which

**Use Site-to-Site VPN when:**
- Setting up quickly (proof of concept, development)
- Bandwidth requirements are under 1 Gbps
- Budget is limited
- Using as a backup to Direct Connect
- Intermittent connectivity needs

**Use Direct Connect when:**
- Consistent, low-latency requirements
- Large data transfer (Terabytes regularly)
- Regulatory requirements for private connectivity
- Real-time applications (voice, video, trading)
- Long-term commitment with predictable costs

**Use Both (recommended for production):**
```
Normal operation:  Data Center ----[Direct Connect]---- AWS
Failover:          Data Center ----[VPN backup]-------- AWS

Configure BGP so DX is preferred, VPN is backup
Provides resilience if DX fails
```

---

## 6. AWS Network Firewall

**AWS Network Firewall** is a managed firewall service that provides fine-grained network traffic filtering at the VPC level.

### What Network Firewall Provides

```
Traditional firewalls:
  Port/protocol filtering
  IP-based rules

Network Firewall adds:
  - Stateful packet inspection
  - IDS/IPS (Intrusion Detection/Prevention)
  - Deep packet inspection
  - Domain name filtering (FQDN rules)
  - Protocol detection
  - Managed threat intelligence
```

### Network Firewall vs Security Groups vs NACLs

| Feature | Security Group | NACL | Network Firewall |
|---------|---------------|------|-----------------|
| Level | Instance | Subnet | VPC/Network |
| Stateful | Yes | No | Yes |
| Deep inspection | No | No | Yes |
| IDS/IPS | No | No | Yes |
| Domain filtering | No | No | Yes |
| Managed rules | No | No | Yes (AWS managed) |
| Cost | Free | Free | $0.395/hr + data |

### Network Firewall Architecture

Network Firewall must be in a dedicated subnet:

```
                    Internet
                       |
                  [Internet Gateway]
                       |
              [Firewall Subnet 10.0.0.0/24]
              [AWS Network Firewall endpoint]
                       |
              [Private Subnet 10.0.10.0/24]
              [Your EC2 instances]

Route tables:
  IGW route table: 10.0.10.0/24 -> firewall-endpoint
  Firewall subnet RT: 0.0.0.0/0 -> igw
  Private subnet RT: 0.0.0.0/0 -> firewall-endpoint
```

### Firewall Policies and Rules

**Rule types:**

Stateless rules (processed first):
```
- Fast, simple matching
- Protocol, source/dest IP, port
- Actions: Pass, Drop, Forward to stateful
```

Stateful rules (deeper inspection):
```
Suricata-compatible rules:
  alert tcp any any -> any 443 (msg:"Suspicious TLS"; sid:1;)
  
Domain list rules:
  Block: *.malware-site.com
  Allow: *.example.com

IPS rules:
  AWS managed threat intelligence
  EMERGING_THREATS ruleset
```

---

## 7. Architecture Patterns

### Pattern 1: Hub-and-Spoke with Transit Gateway

```
          [On-Premises DC]
               |
          [Direct Connect]
               |
    [Transit Gateway] (hub)
    /    |    \    \
VPC-1  VPC-2  VPC-3  VPC-4
(prod) (staging)(dev) (shared-services)

Shared Services VPC contains:
  - AD Domain Controllers
  - Monitoring (Splunk, Datadog)
  - Patch management
  - DNS resolvers
```

### Pattern 2: Centralized Egress

```
All VPCs route internet traffic through a central egress VPC:

VPC-A (10.0.0.0/16)
VPC-B (10.1.0.0/16)  --> Transit Gateway --> Egress VPC --> Internet
VPC-C (10.2.0.0/16)                          (NAT Gateway
                                             + Firewall)

Benefits:
- Single NAT Gateway (cost savings)
- Centralized firewall inspection
- Single set of IP addresses for allowlisting at external services
- Unified logging
```

### Pattern 3: Hybrid Cloud with Redundancy

```
Primary Data Center
  |
  +--[Direct Connect 1Gbps]--+
                              +--[Direct Connect Gateway]--+
Secondary Data Center          |                            |
  |                           +--[Direct Connect 1Gbps]---+|
  +--[Site-to-Site VPN]--------------------------+         |
                                                 |         |
                                           [Transit Gateway]
                                           /    |    \
                                         VPC-1  VPC-2  VPC-3
```

---

## 8. Interview Q&A

**Q1: What is the difference between a VPN and Direct Connect?**

A: Both connect on-premises to AWS, but:
- **VPN** is encrypted IPsec over the public internet. Quick to set up (hours), lower cost (~$36-72/month), bandwidth limited to ~1.25 Gbps, variable latency.
- **Direct Connect** is a dedicated private fiber connection from your DC to an AWS DX location. Takes weeks to provision, expensive (hundreds/month), bandwidths up to 100 Gbps, consistent low latency, no encryption by default.

Use VPN for dev/backup or when setup speed matters. Use Direct Connect for production, large data transfer, or latency-sensitive workloads.

---

**Q2: Why use Transit Gateway instead of VPC Peering?**

A: VPC Peering is non-transitive, so with N VPCs you need N*(N-1)/2 peering connections. Transit Gateway is a hub-and-spoke model where each VPC connects once to TGW. At 10 VPCs: Peering = 45 connections, TGW = 10 connections. TGW also supports VPN and Direct Connect attachments, making it ideal for hybrid architectures.

---

**Q3: What is a Direct Connect Gateway and why is it needed?**

A: A Direct Connect Gateway allows you to connect a single Direct Connect connection to multiple VPCs across different AWS regions. Without it, you would need a separate Direct Connect connection per region. The DX Gateway connects to a Virtual Private Gateway or Transit Gateway in each region, routing traffic appropriately.

---

**Q4: How do you achieve high availability with Direct Connect?**

A: Multiple approaches:
1. **High Resiliency**: Two DX connections at the same DX location (different devices)
2. **Maximum Resiliency**: DX connections at two different DX locations
3. **DX + VPN Backup**: Primary DX connection, Site-to-Site VPN as failover (using BGP to prefer DX)

For maximum resiliency (production), use two DX locations with VPN backup.

---

**Q5: What is the difference between a Virtual Private Gateway (VGW) and Transit Gateway?**

A:
- **VGW**: Attached to a single VPC. Supports VPN and Direct Connect private VIF. Simple, lower cost.
- **Transit Gateway**: Acts as a regional network hub. Connects multiple VPCs, VPNs, Direct Connect, and peers with other TGWs. More complex but essential for multi-VPC architectures.

Use VGW for single-VPC VPN/DX. Use TGW when you have multiple VPCs or need centralized routing.

---

**Q6: Can you describe how Site-to-Site VPN achieves redundancy?**

A: Each VPN connection automatically creates two IPsec tunnels, each in a different AWS Availability Zone. If one tunnel endpoint fails, traffic automatically fails over to the second tunnel. For additional redundancy, you can create two VPN connections from two separate customer gateway devices. Using BGP, you can configure one as primary and the other as backup using routing policies.

---

**Q7: What is split tunneling in Client VPN and when would you disable it?**

A: Split tunneling means only traffic destined for the VPC CIDR goes through the VPN tunnel; other internet traffic goes directly from the client to the internet. Disable split tunneling (full tunnel) when: security policy requires all traffic to route through corporate inspection, compliance mandates network monitoring of all traffic, or preventing data exfiltration through the internet.

---

**Q8: What is a Transit VIF in Direct Connect?**

A: A Transit Virtual Interface is a type of Direct Connect virtual interface that connects to an AWS Transit Gateway (rather than a Virtual Private Gateway). It's required when you want to connect your Direct Connect to multiple VPCs via Transit Gateway. You can have one Transit VIF per Direct Connect connection per account in a region.

---

*End of Advanced Networking Guide*
