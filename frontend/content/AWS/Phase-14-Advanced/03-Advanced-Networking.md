# AWS Advanced Networking — Complete Guide

---

## Table of Contents

1. [AWS Transit Gateway](#aws-transit-gateway)
2. [VPC Peering Deep Dive](#vpc-peering-deep-dive)
3. [AWS PrivateLink (VPC Interface Endpoints)](#aws-privatelink-vpc-interface-endpoints)
4. [AWS Direct Connect](#aws-direct-connect)
5. [Site-to-Site VPN](#site-to-site-vpn)
6. [AWS Client VPN](#aws-client-vpn)
7. [AWS Network Firewall](#aws-network-firewall)
8. [AWS Global Accelerator](#aws-global-accelerator)
9. [Interview Q&A](#interview-qa)

---

## AWS Transit Gateway

### The Problem: VPC Peering Mesh Does Not Scale

VPC Peering creates a direct, non-transitive network connection between exactly two VPCs. In small environments (2-4 VPCs) this is perfectly fine. But as organizations grow, peering becomes a mesh nightmare:

- **5 VPCs** require **10 peering connections** to achieve full connectivity
- **10 VPCs** require **45 peering connections**
- **N VPCs** require **N × (N-1) / 2** peering connections

Each peering connection requires:
- A peering request and acceptance
- Route table updates in **both** VPCs
- Security group updates to allow traffic from the peered VPC CIDR

With 50 VPCs, you'd have 1,225 peering connections, each requiring route table entries across all VPCs. This is operationally infeasible and does not support transitive routing (traffic from VPC A cannot traverse VPC B to reach VPC C).

### Hub-and-Spoke Model: Transit Gateway as Central Hub

AWS Transit Gateway (TGW) solves the mesh problem with a hub-and-spoke model. Every VPC, VPN connection, and Direct Connect Gateway attaches to a single TGW. All inter-VPC traffic routes through the TGW.

```
ASCII Diagram: Transit Gateway Hub-and-Spoke

                          ┌─────────────────────────────┐
  On-Premises DC          │                             │
  192.168.0.0/16  ───────►│    AWS Transit Gateway      │◄─── DX Gateway
                          │    (Central Hub)            │     (Direct Connect)
  Branch Office           │                             │
  10.50.0.0/16   ───────►│    TGW Route Tables:        │
  (via VPN)               │    - Default RT             │
                          │    - Shared Services RT     │
  Internet                │    - Isolated RT            │
  (via VPN or TGW         │                             │
   attachment)            └──────────────┬──────────────┘
                                         │
             ┌───────────────────────────┼───────────────────────────┐
             │                           │                           │
             ▼                           ▼                           ▼
    ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
    │   VPC A         │        │   VPC B          │        │   VPC C         │
    │   10.0.0.0/16   │        │   10.1.0.0/16    │        │   10.2.0.0/16   │
    │   (Production)  │        │   (Dev/Test)      │        │   (Shared Svcs) │
    │                 │        │                  │        │   - AD          │
    │  TGW Attachment │        │  TGW Attachment  │        │  - Monitoring   │
    └─────────────────┘        └─────────────────┘        └─────────────────┘
```

Now: **N VPCs need only N attachments** to the TGW, not N×(N-1)/2 peering connections.

### TGW Attachments

A Transit Gateway attachment is a logical connection between the TGW and a resource:

| Attachment Type           | Description                                                          |
|---------------------------|----------------------------------------------------------------------|
| VPC Attachment            | Connect a VPC to the TGW; specify subnets in each AZ               |
| VPN Attachment            | Site-to-Site VPN connection with on-premises via Customer Gateway    |
| Direct Connect Gateway    | Connect TGW to on-premises via a Direct Connect circuit              |
| TGW Peering               | Connect two Transit Gateways in the same or different AWS regions    |
| Connect Attachment        | SD-WAN integration via GRE tunnel over existing VPC/Direct Connect  |

**VPC Attachment specifics:**
- Choose one subnet per AZ in the VPC — TGW creates an ENI in each chosen subnet
- Traffic entering the VPC from TGW enters via the TGW ENI in that AZ's subnet
- ENIs are assigned private IPs from the chosen subnets
- The VPC's route tables must have routes pointing to the TGW attachment for destination CIDRs

### TGW Route Tables

Route tables control which attachments can communicate through the TGW. Every TGW has a **default route table**; you can create additional custom route tables.

**Key operations:**

**Association:** Each attachment is associated with exactly one TGW route table. Association determines which route table the attachment uses for routing decisions when it sends traffic **into** the TGW.

**Propagation:** When enabled, an attachment automatically advertises its CIDR ranges into a route table. For VPC attachments, the VPC CIDR is propagated. For VPN attachments, BGP-learned routes are propagated.

**Static routes:** Manually add routes to a TGW route table (e.g., a default route `0.0.0.0/0` pointing to a security VPC).

**Example — Segmented routing (Production isolated from Dev):**

```
TGW Route Table: "Production RT"
  Routes:
    10.0.0.0/16  → VPC-A (Production)      [propagated]
    10.2.0.0/16  → VPC-C (Shared Services) [propagated]
    192.168.0.0/16 → VPN-Attachment         [propagated]
  
  Associations:
    VPC-A (Production) → associated here
  
  Result: Production VPC can reach Shared Services and On-Premises, but NOT Dev VPC.

TGW Route Table: "Dev RT"
  Routes:
    10.1.0.0/16  → VPC-B (Dev)             [propagated]
    10.2.0.0/16  → VPC-C (Shared Services) [propagated]
    (No on-premises routes)
  
  Associations:
    VPC-B (Dev) → associated here
  
  Result: Dev VPC can reach Shared Services, but NOT Production and NOT On-Premises.
```

### Default Route Table vs Custom Route Tables

**Default route table behavior (if not customized):**
- All new attachments are automatically associated with the default route table
- All new attachments automatically propagate their routes into the default route table
- Result: all attachments can reach all other attachments — a flat, fully-connected network

This is convenient for simple setups but insufficient when you need network segmentation (e.g., prevent Dev from reaching Production).

**Custom route tables:** Create separate route tables, associate specific attachments, control propagation selectively. This enables fine-grained traffic segmentation without Security Group rules.

### Centralized Inspection Architecture

Route all inter-VPC and VPC-to-internet traffic through a centralized security VPC hosting firewall appliances (AWS Network Firewall, Palo Alto, Fortinet, etc.):

```
TGW Route Table: "Spoke VPCs RT"
  Routes:
    0.0.0.0/0  → Security VPC attachment  (all traffic goes to firewall first)
  
  Associations: all spoke VPCs (Production, Dev, Staging)

TGW Route Table: "Security VPC RT"
  Routes:
    10.0.0.0/8   → all spoke VPC attachments  (return traffic)
    0.0.0.0/0    → Internet attachment (for outbound internet from inspected traffic)
  
  Associations: Security VPC

Result: Traffic from VPC-A to VPC-B goes: VPC-A → TGW → Security VPC (inspected by firewall) → TGW → VPC-B
```

This is the **"bump in the wire"** pattern — central enforcement of security policy on all east-west (VPC-to-VPC) and north-south (VPC-to-internet) traffic.

### TGW Network Manager

A global network management feature for Transit Gateway:
- Visualize the entire global network topology: all TGWs, VPCs, VPN connections, on-premises networks
- Register on-premises devices (routers, SD-WAN devices) to include them in the topology view
- CloudWatch Events integration for network change notifications
- Network performance metrics: latency, packet loss between sites
- Route Analyzer: troubleshoot routing issues by simulating traffic paths

### Cross-Region TGW Peering

Connect Transit Gateways in different AWS regions:
- Create a TGW peering attachment between two TGWs in different regions
- Traffic between regions travels over the **AWS global backbone network** (not the public internet)
- Static routes required in TGW route tables for inter-region routing (BGP not supported for TGW peering)
- Use cases: global multi-region architectures, disaster recovery across regions

### Cross-Account Sharing with AWS RAM

Share a TGW with other AWS accounts using AWS Resource Access Manager (RAM):
- TGW owner creates a RAM resource share for the TGW
- Invited accounts accept the share and can create attachments to the shared TGW
- Attachments in different accounts appear in the TGW owner's attachment list
- Route table associations and propagations are managed by the TGW owner
- Use cases: multi-account AWS Organizations with centralized networking; central network team managing TGW for all business unit accounts

### TGW vs VPC Peering Comparison

| Dimension                | Transit Gateway                                  | VPC Peering                                      |
|--------------------------|--------------------------------------------------|--------------------------------------------------|
| Topology                 | Hub-and-spoke (star)                             | Mesh (point-to-point)                            |
| Transitive routing       | Yes — all attachments route through TGW          | No — strictly non-transitive                     |
| Number of VPCs           | Scales to thousands of attachments               | Practical limit ~5-10 VPCs                       |
| On-premises connectivity | Yes — VPN and Direct Connect attachments         | No — VPC peering is VPC-to-VPC only              |
| Cross-region             | Yes — TGW peering                                | Yes — cross-region peering                       |
| Cross-account            | Yes — via RAM                                    | Yes — peering request to other account           |
| Route table complexity   | Managed in TGW route tables                      | Must update route tables in both VPCs            |
| Cost                     | Per attachment-hour + per GB processed           | No hourly cost; same/different-region data rates |
| Bandwidth                | Up to 50 Gbps per VPC attachment (burst)         | Up to 10 Gbps (same region burst)                |
| Traffic inspection       | Can route through centralized firewall           | Cannot insert a firewall in a peering path       |
| Overlapping CIDRs        | Not supported (same constraint)                  | Not supported                                    |
| Best for                 | >5 VPCs, hybrid connectivity, centralized mgmt   | Simple, few-VPC, low-cost connectivity           |

### When to Use TGW

- More than 5 VPCs that need to communicate with each other
- Any requirement for transitive routing
- Hybrid connectivity (VPN/Direct Connect) to multiple VPCs simultaneously
- Centralized firewall/inspection for all traffic
- Multi-account AWS Organizations networking
- Cross-region connectivity via AWS backbone
- Consistent routing policy across many VPCs (easier to manage in TGW route tables than dozens of VPC route tables)

---

## VPC Peering Deep Dive

### What Is VPC Peering?

VPC Peering creates a **direct, private network connection between exactly two VPCs**. Traffic routes through AWS's internal network — it never traverses the public internet, NAT devices, VPN gateways, or AWS Transit Gateway. From the routing perspective, the two VPCs appear as one flat network where instances can communicate using private IP addresses.

### Non-Transitive Routing — The Critical Constraint

VPC Peering is fundamentally **non-transitive**. If VPC A peers with VPC B, and VPC B peers with VPC C:

```
VPC A ──── peering ────► VPC B ──── peering ────► VPC C
  ▲
  |
  Can A reach C through B?  NO — traffic does not flow through B
```

Even if VPC B has routes to both A and C, traffic from A destined for C is dropped. To connect A and C, you must create a direct peering between A and C. This is why peering doesn't scale — it becomes a full mesh.

**Why is peering non-transitive?** By design. AWS intentionally prevents transitive routing in VPC peering to ensure you can't accidentally create a path from one VPC to another that you didn't explicitly approve. Each peering is a deliberate bilateral trust decision.

### Same-Region vs Cross-Region Peering

**Same-region peering:**
- Traffic stays within the same AWS region
- Data transfer cost: $0.01/GB (lower than cross-region)
- Lower latency than cross-region
- Security groups can reference peered VPC security group IDs (not just CIDRs) — powerful for least-privilege rules

**Cross-region peering:**
- Traffic traverses AWS's global backbone (encrypted in transit)
- Data transfer cost: standard inter-region rates (~$0.02-0.09/GB depending on regions)
- Higher latency than same-region
- Security groups cannot reference peered VPC SGs in cross-region — must use CIDR ranges

### Cross-Account Peering

1. Account A (requester) initiates the peering request specifying Account B's VPC ID and account ID
2. Account B (accepter) must log in and explicitly accept the peering request
3. Both accounts must update their respective route tables
4. IAM policies in both accounts must permit the necessary actions

The explicit accept requirement is a security control — Account B cannot be peered with without an active human approval.

### No Overlapping CIDR Blocks

VPC Peering requires the two VPCs to have **non-overlapping CIDR ranges**. If VPC A is `10.0.0.0/16` and VPC B is also `10.0.0.0/16`, the peering request is rejected — AWS cannot route traffic because the destination CIDRs are ambiguous.

This is a common pain point in organizations that didn't plan VPC CIDR allocation in advance. All VPCs that may ever need to communicate should be planned with unique, non-overlapping CIDRs from a central IPAM (IP Address Management) plan.

### Route Table Updates in BOTH VPCs

Creating a peering connection does not automatically add routes. You must manually update route tables in **both** VPCs:

**In VPC A's route table:**
```
Destination: 10.1.0.0/16 (VPC B's CIDR)
Target: pcx-0abc123def456789  (the peering connection ID)
```

**In VPC B's route table:**
```
Destination: 10.0.0.0/16 (VPC A's CIDR)
Target: pcx-0abc123def456789  (the same peering connection ID)
```

If either route table entry is missing, traffic flows only one way (or not at all). A common troubleshooting step when peering isn't working: verify both sides have the correct route table entries.

### Security Group Cross-Reference (Same Region Only)

In the same region, you can write Security Group rules that reference the peered VPC's security group ID instead of a CIDR range:

```
Inbound rule on EC2 in VPC B:
  Type: HTTPS (443)
  Source: sg-0abc1234 (security group from VPC A)
```

This is more precise than allowing a CIDR range — only instances in VPC A that belong to that specific security group can connect. Cross-region peering does not support this; you must use CIDR-based rules.

### When to Use VPC Peering

- Simple, **low-cost** connectivity between 2-5 VPCs
- You don't need transitive routing
- VPCs don't need connectivity to on-premises
- No central inspection requirement
- Same account or simple cross-account setups
- Short setup time with minimal networking expertise

---

## AWS PrivateLink (VPC Interface Endpoints)

### What Is PrivateLink?

AWS PrivateLink allows you to expose a service (yours or an AWS-managed one) to other VPCs **privately, without peering, without internet access, and without exposing the service's VPC to the consumer's network**. Traffic between consumer and service stays entirely within the AWS network.

The key differentiation from VPC Peering: PrivateLink provides **one-way service access**, not full network connectivity. Consumer VPCs get access to a specific service endpoint, not a route into the entire producer network.

### How PrivateLink Works: Step by Step

**Service Provider side:**
1. Deploy your service on EC2 or containers, fronted by a **Network Load Balancer (NLB)**
2. Create a **VPC Endpoint Service** in the PrivateLink console, associating it with the NLB
3. Optionally configure acceptance settings: manual accept (you approve each consumer) or auto-accept
4. Note the service name (e.g., `com.amazonaws.vpce.us-east-1.vpce-svc-0abc123`)

**Service Consumer side:**
1. Create an **Interface VPC Endpoint** specifying the service name
2. Choose the VPC and subnets where the endpoint ENIs should be created
3. Choose or create a Security Group controlling inbound traffic to the endpoint ENIs
4. AWS creates an **Elastic Network Interface (ENI)** in each chosen subnet with a private IP address from your VPC's subnet range
5. A DNS name is created (e.g., `vpce-0abc123-xyz.us-east-1.vpce.amazonaws.com`) that resolves to the ENI's private IP

**Traffic flow:**
```
Consumer EC2 Instance → Consumer VPC ENI (PrivateLink ENI) → AWS PrivateLink backbone → Provider NLB → Provider Service
```

No traffic leaves the AWS network. No public IPs involved. The consumer's VPC only has an ENI pointing to the PrivateLink endpoint — it does not gain any access to the rest of the provider's VPC.

### Why PrivateLink vs VPC Peering for Service Exposure

**VPC Peering:** If you want consumers to access your service, you'd peer their VPC with yours. But now the consumer has a route to your **entire VPC CIDR** — they could potentially reach any resource in your VPC, not just your service. You must rely entirely on Security Groups to prevent unwanted access.

**PrivateLink:** Consumer gets a single ENI that resolves only to your NLB. They cannot route to any other resource in your VPC. Network-level isolation is built in — no misconfigured Security Group can inadvertently expose other services.

### DNS Resolution for PrivateLink

When you create an Interface Endpoint with **Private DNS enabled** (default for AWS service endpoints):

- The endpoint creates a private DNS name that overrides the public service DNS within your VPC
- For example: `ec2.us-east-1.amazonaws.com` resolves to the endpoint's private IP (ENI) instead of EC2's public IP
- AWS services like EC2, S3, KMS, SSM, ECR all have PrivateLink endpoints with private DNS override
- Within the VPC: `aws ssm` resolves to the private endpoint → traffic never leaves VPC
- Outside the VPC: `aws ssm` resolves to the public IP (unless connected via VPN/DX with proper DNS forwarding)

For custom endpoint services (your own service), the DNS name is service-specific and doesn't override anything — consumers explicitly use the endpoint DNS name.

### Traffic Never Leaves AWS Network

PrivateLink uses AWS's private fiber network backbone. Unlike internet-routed traffic:
- No exposure to DDoS attacks on the public internet
- No need for NAT Gateway, Internet Gateway, or public IPs on consumer instances
- Data transfer costs are lower than going over the internet
- Meets compliance requirements for private data transmission (financial, healthcare)

### Cross-Account and Cross-Region

**Cross-account:** PrivateLink natively supports cross-account. The endpoint service and the interface endpoint can be in different AWS accounts. The provider grants permissions at the account or IAM principal level.

**Cross-region:** Interface endpoints and endpoint services must be in the same region. For cross-region, you can pair with inter-region VPC Peering: consumer VPC in us-west-2 peers with a transit VPC in us-east-1 that has the PrivateLink endpoint — but this adds complexity and is not a native PrivateLink feature.

### Gateway Endpoints vs Interface Endpoints

There are two types of VPC Endpoints:

**Gateway Endpoints:**
- Available for: **Amazon S3** and **Amazon DynamoDB** only
- Implementation: a logical gateway target added to VPC route tables (not an ENI)
- **Free** (no hourly cost, no per-GB charge for endpoint itself)
- Traffic from instances in the VPC is routed to S3/DynamoDB without leaving the VPC
- Route entry in the VPC route table: `pl-xxxxx (com.amazonaws.us-east-1.s3) → vpce-xxxxx`
- Does not use private DNS; uses route table-based routing
- Works only within the same region
- Cannot be accessed from on-premises via VPN/Direct Connect (gateway endpoints are VPC-local only)

**Interface Endpoints (PrivateLink):**
- Available for: 100+ AWS services (EC2, SSM, KMS, STS, ECR, ECS, CloudWatch, SNS, SQS, Kinesis, SageMaker, etc.) and custom services
- Implementation: ENI in your subnet with a private IP address
- **Cost**: ~$7.50/month per AZ per endpoint + $0.01/GB data processed
- Uses private DNS to override public service endpoints within the VPC
- Accessible from on-premises connected via Direct Connect or VPN (DNS resolution must be forwarded)
- Works cross-account and can be shared via AWS PrivateLink

**Gateway vs Interface Endpoint Comparison:**

| Feature                        | Gateway Endpoint                        | Interface Endpoint (PrivateLink)         |
|--------------------------------|-----------------------------------------|------------------------------------------|
| Supported services             | S3 and DynamoDB only                    | 100+ AWS services + custom services      |
| Implementation                 | Route table entry (no ENI)              | ENI in subnet with private IP            |
| Cost                           | Free                                    | ~$7.50/AZ/month + $0.01/GB              |
| On-premises access             | No — VPC-local only                     | Yes — via DX/VPN with DNS forwarding     |
| DNS override                   | No                                      | Yes (private DNS feature)               |
| Cross-region                   | No                                      | No (same region only)                   |
| Security Group                 | Not applicable                          | Applies to endpoint ENI                 |
| Access from peered VPC         | No                                      | Yes (if DNS configured correctly)        |

### Common Use Case: Private Subnet to AWS Services

A common architecture pattern:

```
EC2 Instance (private subnet, no internet access)
    │
    ▼
Interface VPC Endpoints (one per service needed):
    - com.amazonaws.region.ssm       → SSM Parameter Store, Session Manager
    - com.amazonaws.region.kms       → AWS KMS for encryption
    - com.amazonaws.region.ecr.api   → ECR API for container images
    - com.amazonaws.region.ecr.dkr   → ECR Docker image pulls
    - com.amazonaws.region.s3        → S3 (or use Gateway Endpoint for free)
    - com.amazonaws.region.logs      → CloudWatch Logs
    - com.amazonaws.region.monitoring → CloudWatch Metrics
    - com.amazonaws.region.sts       → IAM role assumption
```

Without these endpoints, private subnet EC2 instances need NAT Gateway ($0.045/hour + $0.045/GB) to reach AWS services. With Interface Endpoints, no NAT Gateway needed — traffic stays on private AWS network and costs less at high volumes.

---

## AWS Direct Connect

### What Is Direct Connect?

AWS Direct Connect (DX) is a **dedicated, private, physical network connection** between your on-premises data center and an AWS Direct Connect location (AWS-partnered colocation facility). It is not the public internet — it is a leased fiber circuit between your premises and AWS, providing:

- **Consistent, predictable bandwidth** (no internet congestion or jitter)
- **Lower latency** than internet-routed traffic
- **Reduced data transfer costs** for large data volumes (lower than internet egress)
- **Private connectivity** for compliance and regulatory requirements
- **Higher aggregate throughput** than VPN (up to 100 Gbps)

### Why Use It?

Organizations choose Direct Connect when:
1. They have strict latency requirements (real-time financial transactions, real-time manufacturing control)
2. They transfer terabytes of data to/from AWS regularly (DX data transfer rates are lower)
3. Compliance mandates that traffic must not traverse the public internet (HIPAA, PCI-DSS, financial regulations)
4. They need reliable, stable bandwidth for mission-critical hybrid applications
5. Internet bandwidth is expensive in their region (DX can be cheaper per GB at scale)

### Connection Speeds and Types

**Dedicated Connections** (ordered directly from AWS):
- 1 Gbps, 10 Gbps, 100 Gbps
- Physical port at the Direct Connect location allocated exclusively to you
- Setup time: weeks to months (requires physical fiber installation and cross-connect)
- Letter of Authorization / Connecting Facility Assignment (LOA-CFA): AWS issues this document authorizing the colocation facility to connect your equipment to AWS's router

**Hosted Connections** (ordered through AWS Direct Connect Partners):
- Speeds from 50 Mbps, 100 Mbps, 200 Mbps, 300 Mbps, 400 Mbps, 500 Mbps, 1 Gbps, 2 Gbps, 5 Gbps, 10 Gbps
- Partners share a dedicated connection and carve out a sub-port for you
- Lower entry cost; useful when you need less than 1 Gbps or want a partner to manage the connectivity
- Setup time: faster than dedicated connections (partner manages the cross-connect)

### Virtual Interfaces (VIFs)

A Direct Connect connection is a single physical link; Virtual Interfaces are logical divisions of that link for different purposes:

**Private VIF:**
- Connect to a specific VPC via a **Virtual Private Gateway (VGW)** attached to that VPC
- Enables access to resources in the VPC using private IP addresses
- BGP session established between your router and the VGW
- You can have multiple Private VIFs on one DX connection, each going to a different VPC's VGW
- Use case: securely access EC2 instances, RDS, internal services in a VPC from on-premises

**Public VIF:**
- Connect to **AWS public services** (S3, DynamoDB, CloudFront, etc.) using their public IP addresses
- Traffic goes directly from your premises to AWS public services, bypassing the internet
- Receives all AWS public IP prefixes via BGP (large routing table)
- Use case: large-scale data transfer to S3, accessing AWS APIs without internet

**Transit VIF:**
- Connect to a **Transit Gateway** via a **Direct Connect Gateway**
- Enables one DX connection to access multiple VPCs through a single TGW
- Supports up to 5,000 VPC attachments via the TGW
- Use case: enterprise with many VPCs that all need on-premises connectivity

### Direct Connect Gateway

A Direct Connect Gateway (DXGW) is a globally available, AWS-managed router that allows a single Direct Connect connection to access VPCs across **multiple AWS regions**:

```
On-Premises ─── DX Connection ─── DX Gateway ─── VGW (VPC us-east-1)
                                               └── VGW (VPC eu-west-1)
                                               └── VGW (VPC ap-southeast-1)
```

Without DXGW: need a separate DX connection (or VIF) to reach each region.
With DXGW: one DX connection can reach VPCs in multiple regions. DXGW handles the routing between regions within the AWS network.

DXGW also connects to Transit Gateways (via Transit VIF), enabling: one DX connection → DXGW → TGW → hundreds of VPCs.

### Redundancy Options

A single Direct Connect connection is a single point of failure (physical cable, port, or DX location could fail). Production deployments require redundancy:

**Option 1 — Two Direct Connect connections (same location):**
- Two physical circuits from two separate DX ports
- Protects against port failure, link failure
- Does not protect against DX location outage

**Option 2 — Two Direct Connect connections (different locations):**
- Two circuits from two different DX locations in the same region
- Protects against port failure, link failure, and DX location failure
- Maximum resilience for DX-only connectivity
- AWS recommends this for production critical workloads

**Option 3 — Direct Connect + Site-to-Site VPN backup:**
- DX as primary (high performance, private)
- IPsec VPN over internet as backup (lower performance but more resilient to DX failure)
- BGP routing: set DX route as preferred (higher BGP local preference); VPN route used when DX is down
- Cost-effective fallback

### DX + VPN: Encrypted Traffic Over Direct Connect

By default, Direct Connect traffic is **not encrypted** — the physical connection provides privacy but not encryption. For encrypted-in-transit over DX:
- Create a VPN connection using the Direct Connect Public VIF as the transport
- IPsec/IKE negotiated between on-premises VPN device and AWS VGW
- Traffic is encrypted AND travels on the private DX link
- Use when: compliance requires encryption in transit even on private circuits (some standards require encryption regardless of network type)

### LOA-CFA (Letter of Authorization — Connecting Facility Assignment)

After ordering a Dedicated Connection:
1. AWS sends you the LOA-CFA (PDF document)
2. LOA-CFA authorizes the colocation facility (e.g., Equinix, Coresite) to physically cross-connect your equipment (router, MUX) to AWS's router port
3. You provide the LOA-CFA to the colocation facility's technical operations team
4. They install the cross-connect cable (typically 10 business days)
5. Once connected, establish BGP session on the Direct Connect virtual interface

### BGP Protocol

BGP (Border Gateway Protocol) is the mandatory routing protocol for Direct Connect:
- External BGP (eBGP) session established over the Direct Connect VIF
- BGP AS numbers: your on-premises router uses your AS number (or a private AS 64512-65535); AWS uses its AS number
- BGP route advertisement: your router advertises your on-premises prefixes; AWS advertises VPC CIDRs (Private VIF) or AWS public IP ranges (Public VIF)
- BGP attributes (AS Path, MED, Local Preference) are used to influence routing when multiple paths exist (e.g., DX primary, VPN backup)
- DX failover: if DX BGP session drops, VPN BGP route (with lower preference) takes over automatically

---

## Site-to-Site VPN

### What Is Site-to-Site VPN?

AWS Site-to-Site VPN creates an **encrypted IPsec VPN tunnel over the public internet** between your on-premises network and your AWS VPC. Unlike Direct Connect (weeks to provision, physical infrastructure), a VPN connection can be set up in **minutes** via the AWS console.

### Components

**Customer Gateway (CGW):**
- Represents your on-premises VPN device in AWS (logical resource)
- Specify the public IP address of your on-premises VPN device (router, firewall, dedicated VPN appliance)
- Supported devices: Cisco ASA, Cisco IOS, Juniper SRX, Palo Alto, Fortinet, pfSense, strongSwan (Linux), and hundreds more
- AWS provides downloadable configuration templates for common devices

**Virtual Private Gateway (VGW):**
- AWS-managed VPN endpoint attached to your VPC
- Highly available: redundant endpoints in two AZs within the region
- Attach one VGW to one VPC
- Supports both BGP (dynamic routing) and static routes

**Transit Gateway VPN Attachment:**
- Instead of VGW, attach VPN to a TGW
- Enables one VPN connection to provide access to multiple VPCs through the TGW
- Preferred for multi-VPC architectures

### Tunnel Redundancy

Each VPN connection creates **two IPsec tunnels** for redundancy:
- Two tunnels terminate in two different AWS availability zones (VGW endpoints)
- Both tunnels can be active simultaneously (active/active with BGP ECMP) or one active/one standby (active/passive)
- If one tunnel fails (AZ issue, endpoint maintenance), the second takes over automatically
- BGP active/active: traffic load-balanced across both tunnels; failover is ~30 seconds
- Static routing: only one tunnel is active at a time; switchover when the active tunnel fails

### Routing Modes

**BGP (Dynamic Routing):**
- Your on-premises router runs eBGP with the VPN endpoint
- Routes are dynamically learned and propagated — no manual route management
- Supports automatic failover (BGP route withdrawal triggers fast re-convergence)
- Required for active/active dual-tunnel setups
- Recommended for production use

**Static Routing:**
- You manually specify the CIDR ranges of your on-premises network in the VPN connection configuration
- AWS propagates these static routes to the VPC route table
- Simpler to set up (no BGP configuration on your router)
- No automatic detection of on-premises network changes
- Suitable for simple, small environments

### Bandwidth and Limitations

- Each VPN tunnel supports up to **1.25 Gbps** throughput
- Two tunnels per connection = 2.5 Gbps with ECMP (if both active simultaneously)
- **ECMP (Equal-Cost Multi-Path):** attach multiple VPN connections to a TGW; TGW can ECMP across multiple tunnels for higher aggregate bandwidth (up to 50 Gbps aggregate with many VPN connections)
- Latency: depends on internet path (unpredictable, typically 10-100ms) — much higher variance than Direct Connect
- Packet loss: depends on internet path (occasional drops under internet congestion)

### Setup Time

VPN can be configured in **15-30 minutes**:
1. Create Customer Gateway (on-premises IP)
2. Create Virtual Private Gateway and attach to VPC
3. Create VPN Connection (CGW + VGW + routing type)
4. Download the VPN device configuration from AWS console
5. Apply configuration to your on-premises router
6. VPN tunnels come up; routes are exchanged via BGP or static routing

### VPN vs Direct Connect Comparison

| Dimension              | Site-to-Site VPN                             | AWS Direct Connect                            |
|------------------------|----------------------------------------------|-----------------------------------------------|
| Setup time             | Minutes to hours                             | Weeks to months                               |
| Cost                   | Low (~$0.05/hour per connection + data)      | Higher (port fee + partner fee + data)        |
| Bandwidth              | Up to 1.25 Gbps per tunnel                   | Up to 100 Gbps per dedicated connection       |
| Latency                | Variable (internet-dependent)                | Consistent, low (dedicated private fiber)     |
| Reliability            | Subject to internet fluctuations             | Highly consistent, SLA-backed                |
| Encryption             | Always encrypted (IPsec)                     | Not encrypted by default (add VPN for encr.)  |
| Transport              | Public internet                              | Private dedicated fiber                       |
| Use cases              | Branch offices, backup, quick connectivity   | Enterprise hybrid, large data transfer, compliance |
| Redundancy             | Two tunnels built-in; add backup DX          | Two DX connections recommended                |

---

## AWS Client VPN

### What Is Client VPN?

AWS Client VPN is a **fully managed, elastic VPN service** based on **OpenVPN** that enables individual users (not sites) to securely access AWS resources and on-premises networks from anywhere. Unlike Site-to-Site VPN (network-to-network), Client VPN is **user-to-network** — each user's device establishes their own VPN session.

### Authentication Methods

| Method                       | Description                                                           |
|------------------------------|-----------------------------------------------------------------------|
| Certificate-based (mutual TLS) | Client and server authenticate with X.509 certificates; managed via AWS Certificate Manager |
| Active Directory (AD)        | Authenticate against AWS Managed Microsoft AD or on-premises AD via AD Connector |
| SAML 2.0 / SSO               | Federated identity via Okta, Azure AD, Ping, OneLogin                |
| Multi-factor (MFA)           | Combine certificate + AD/SAML for MFA                                |

### Client CIDR

A dedicated IP address range assigned to connecting VPN clients:
- Each connected user receives a private IP from this range
- Must not overlap with VPC subnets or on-premises CIDRs
- Minimum /22 (1,022 usable IPs per AZ); recommended /20 for larger deployments
- IP allocation is per session (DHCP-like from the client pool)

### Split Tunnel vs Full Tunnel

**Split Tunnel (recommended):**
- Only traffic destined for AWS VPC subnets (or specified routes) is sent through the VPN tunnel
- Internet-bound traffic (YouTube, Slack, general browsing) goes directly from the user's device to the internet — NOT through the VPN
- Benefits: lower bandwidth on VPN endpoint, better performance for users, reduced AWS data transfer costs
- Configure by specifying specific CIDR routes to push through the tunnel

**Full Tunnel:**
- ALL traffic from the user's device is routed through the VPN tunnel, including internet traffic
- Internet access goes: User → AWS Client VPN → VPC → NAT Gateway / Internet Gateway → Internet
- Use when: corporate policy requires all traffic to be inspected (security appliance in VPC)
- Higher cost (all internet traffic billable through AWS); lower user experience (internet traffic takes longer path)

### Authorization Rules

Authorization rules control which VPN users can access which subnets:
- Example: Grant "developers" Active Directory group access to `10.0.1.0/24` (dev subnet) but not `10.0.2.0/24` (prod subnet)
- Example: Grant "admins" group access to all subnets `0.0.0.0/0`
- Rules evaluated per connection attempt — users see only the networks they're authorized for
- Works with AD group membership (users inherit rules based on their AD group)

### Use Cases

- **Remote work**: developers working from home securely access private VPC resources (EC2, RDS, internal tools) as if on the corporate network
- **Privileged access**: admins connect via Client VPN to perform maintenance on private instances (instead of exposing SSH/RDP to internet)
- **Contractor access**: grant temporary VPN access with scoped authorization rules, revoke by removing AD group membership
- **Hybrid access**: Client VPN endpoint associated with VPC that connects via Direct Connect to on-premises — users reach both cloud and on-premises via VPN

---

## AWS Network Firewall

### What Is Network Firewall?

AWS Network Firewall is a managed, stateful network firewall and IDS/IPS (Intrusion Detection and Prevention System) service for Amazon VPCs. It provides deep packet inspection, domain filtering, and Suricata-compatible rule-based traffic filtering — capabilities that Security Groups and NACLs cannot provide (they only filter by IP, port, and protocol, not content or domain).

### Deployment Architecture

Network Firewall is deployed in **dedicated firewall subnets** within one or more AZs of your VPC:

```
Spoke VPCs  ──►  TGW  ──►  Firewall VPC (Inspection VPC)
                            ├── AZ-1: Firewall Subnet (Network Firewall endpoint)
                            │         ├── Inbound: stateless → stateful rules
                            │         └── Outbound: filtered + inspected
                            └── AZ-2: Firewall Subnet (Network Firewall endpoint)

Route table manipulation:
  Spoke VPC route: 0.0.0.0/0 → TGW
  TGW route: all spoke CIDRs → Firewall VPC
  Firewall VPC ingress route: spoke CIDRs → Firewall endpoint
  Firewall VPC egress route: 0.0.0.0/0 → Internet Gateway (or back to TGW)
```

The key is asymmetric route injection: traffic is redirected to the firewall endpoint by routing policy; the firewall acts as a transparent inline device.

### Inspection Modes

**Stateless Rule Groups:**
- Evaluated first, at wire speed
- Match on: source/destination IP, source/destination port, protocol
- Actions: pass (send to stateful engine), drop, or forward to stateful rules
- Evaluated in priority order (lower priority number = higher priority)
- No connection tracking — each packet evaluated independently
- Good for: quick allow/deny decisions on well-defined traffic, DDoS mitigation rules

**Stateful Rule Groups:**
- Track connection state (TCP handshake, flow tracking)
- More sophisticated matching: protocol decoding, connection state (established vs new), application layer inspection
- Evaluated after stateless rules that forwarded to stateful
- Can use Suricata-compatible rules or AWS-managed rules
- Actions: pass, drop, alert

### Suricata-Compatible Rules

AWS Network Firewall uses the **Suricata** open-source IDS/IPS rule format:

```suricata
# Block all outbound SMB traffic (potential ransomware exfiltration)
drop tcp any any -> any [445,139] (msg:"Block SMB Outbound"; sid:1000001; rev:1;)

# Alert on HTTP traffic to a known malware domain
alert dns any any -> any any (msg:"Malware Domain Query"; dns.query; content:"malware-c2.example.com"; nocase; sid:1000002; rev:1;)

# Block TLS traffic to suspicious IPs
drop tls 10.0.0.0/8 any -> $EXTERNAL_NET any (tls.sni; content:"badactor.com"; nocase; sid:1000003; rev:1;)
```

AWS also provides **managed rule groups** (threat intelligence feeds updated by AWS): botnet C2 detection, exploit kit signatures, malware signatures, anonymous IP blocking. Subscribe and AWS handles rule updates.

### Deep Packet Inspection (DPI)

Network Firewall inspects the content of packets beyond just headers:
- **TLS inspection**: decrypt TLS traffic to inspect HTTPS content, then re-encrypt (requires certificate setup)
- **HTTP inspection**: parse HTTP headers, inspect URL paths, Host headers
- **DNS inspection**: parse DNS queries, match on queried domain names
- **Application protocol detection**: identify application-layer protocols (SMB, FTP, etc.) regardless of port

### Domain List Filtering

A simpler alternative to Suricata rules for domain-based filtering:
- **Allowlist**: permit outbound traffic only to specified domains; deny all others
- **Denylist**: block outbound traffic to specified domains; permit others
- Supports wildcard domains: `*.malware-domain.com`
- Applied at DNS query level and HTTP Host header level
- Use case: prevent EC2 instances from communicating with unknown internet destinations (data exfiltration prevention)

### Centralized Deployment with TGW

The most scalable pattern: one Network Firewall instance in a dedicated security VPC inspects traffic for all other VPCs:

```
VPC-A (Production) ─────►┐
VPC-B (Dev) ─────────────►│  Transit Gateway  ──►  Security VPC
VPC-C (Analytics) ───────►│                        ├── Network Firewall
On-Premises ─────────────►┘                        └── All traffic inspected here
```

TGW routing pushes all inter-VPC and egress traffic through the Security VPC firewall before delivery. Only one firewall to manage, monitor, and update — not one per VPC.

### Logging

Network Firewall generates three log types, delivered to:
- **Alert logs**: triggered by alert rules (matching traffic that was flagged but may not be blocked)
- **Flow logs**: all TCP/UDP flows (similar to VPC Flow Logs but at firewall level)
- **Drop logs**: traffic that was explicitly blocked by rules

Log destinations: Amazon S3, Amazon CloudWatch Logs, Amazon Kinesis Data Firehose

### When to Use Network Firewall

- Compliance requirements mandating IDS/IPS (PCI-DSS, HIPAA, NIST)
- Advanced threat detection beyond Security Groups (which can't do content inspection)
- Prevent data exfiltration (restrict allowed outbound domains)
- Centralized security enforcement across many VPCs (with TGW)
- Need to apply Suricata/Snort signatures for known threat detection
- Block specific malicious IP ranges or domains at scale

---

## AWS Global Accelerator

### What Is Global Accelerator?

AWS Global Accelerator is a networking service that uses AWS's global network backbone to route user traffic to your application, dramatically reducing latency and improving reliability compared to routing over the public internet.

It provides **two static anycast IP addresses** that serve as fixed entry points to your application globally. Users connect to the nearest AWS edge location (PoP — Point of Presence), then traffic traverses AWS's private global network to reach your application endpoint — instead of bouncing through unpredictable public internet routers.

### How It Works

```
User in Tokyo ──► (public internet, ~5ms to nearest AWS PoP) ──► AWS Tokyo Edge PoP
                                                                      │
                                                             AWS Private Backbone
                                                           (optimized, <3ms variance)
                                                                      │
                                                              AWS us-east-1 ALB
                                                                      │
                                                             Your Application
```

**vs. Without Global Accelerator:**
```
User in Tokyo ──► (public internet, 180ms, unpredictable routing) ──► AWS us-east-1 ALB
```

The improvement comes from two factors:
1. **Shorter public internet hop**: users only traverse the public internet to the nearest AWS edge (often <10ms), not all the way to the origin region
2. **AWS backbone quality**: the inter-edge routing uses AWS's dedicated, monitored, congestion-controlled fiber — not the best-effort public internet

### Two Static Anycast IP Addresses

Global Accelerator assigns your application **two static IP addresses** (anycast — the same IPs are announced from all AWS edge locations globally):
- Users connect to these IPs; network routing directs them to the nearest edge
- The IPs never change — no DNS TTL issues, no IP address change management
- Both IPs are always active — redundancy built in
- Whitelist these IPs in corporate firewalls or partner integrations once; they never change even if you update your endpoints behind Global Accelerator

### TCP and UDP Support

Unlike CloudFront (HTTP/HTTPS only), Global Accelerator supports **any TCP or UDP application**:
- Game servers (UDP, low-latency requirements)
- VoIP applications (UDP/RTP)
- IoT device communication (TCP/UDP)
- Any non-HTTP application needing global routing optimization

### Supported Endpoint Types

| Endpoint Type          | Notes                                                                 |
|------------------------|-----------------------------------------------------------------------|
| Application Load Balancer | Most common; can route to ALBs in multiple regions                |
| Network Load Balancer  | For TCP/UDP with NLB                                                  |
| EC2 Instances          | With Elastic IP or automatically allocated                           |
| Elastic IP addresses   | Static IPs attached to any EC2                                       |

One Global Accelerator can have endpoints in **multiple AWS regions**. Traffic health checks run continuously; unhealthy endpoints are removed from routing automatically.

### Health Checks and Automatic Failover

- Global Accelerator performs health checks against your endpoints (configurable: TCP, HTTP/S, interval)
- If an endpoint (e.g., ALB in us-east-1) fails health checks, Global Accelerator automatically routes all traffic to a healthy endpoint in another region (e.g., eu-west-1) within **30 seconds**
- No DNS TTL delay (unlike Route 53 failover, which depends on DNS TTL expiry)
- Failover is handled at the IP routing layer — the static IP stays the same, the backend changes

### Use Cases

- **Gaming**: real-time multiplayer games need UDP with consistent sub-100ms latency globally; Global Accelerator routes players to the nearest game server region
- **IoT**: devices connecting from all over the world; Global Accelerator provides fast, reliable TCP/UDP to the processing region
- **VoIP**: voice quality is extremely latency-sensitive; reducing latency from 200ms to 50ms makes a significant quality difference
- **Multi-region active-active**: application deployed in multiple regions; Global Accelerator routes each user to the nearest healthy region, with automatic failover
- **Non-HTTP applications**: anything that doesn't fit CloudFront's HTTP model (CloudFront is content-focused; Global Accelerator is transport-focused)

### Global Accelerator vs CloudFront

| Feature                    | AWS Global Accelerator                         | Amazon CloudFront                              |
|----------------------------|------------------------------------------------|------------------------------------------------|
| Primary purpose            | Network performance optimization               | Content Delivery Network (CDN)                 |
| Protocols                  | TCP and UDP (any port)                         | HTTP, HTTPS, WebSocket only                    |
| Caching                    | No — pure routing, no content caching          | Yes — caches static/dynamic content at edge   |
| Edge processing            | No — routes to origin                          | Yes — Lambda@Edge, CloudFront Functions        |
| Static IPs                 | Yes — 2 static anycast IPs                     | No — dynamic IP, DNS-based (CloudFront domain) |
| DDoS protection            | AWS Shield Standard (included)                 | AWS Shield Standard (included)                 |
| Content type               | Any TCP/UDP application                        | Web content, API responses, video streaming    |
| Origin types               | ALB, NLB, EC2, Elastic IP                      | ALB, EC2, S3, Lambda URL, custom origin        |
| Latency reduction          | Reduces path to origin                         | Reduces latency by serving cached copies       |
| Use case                   | Gaming, IoT, VoIP, multi-region failover       | Websites, APIs, video, software distribution  |
| IP addresses               | 2 fixed static IPs globally                    | CloudFront domain resolves to regional IPs     |

**They are complementary, not competing:**
- Use CloudFront for HTTP content caching (reduces origin load + latency for cacheable content)
- Use Global Accelerator for non-HTTP traffic or for routing to origins where caching isn't applicable

For maximum optimization: put Global Accelerator in front of your ALB, and use CloudFront for your static assets separately. Both can coexist for different traffic types.

---

## Interview Q&A

### 20 Comprehensive Questions with Detailed Answers

**Q1: When would you choose Transit Gateway over VPC Peering, and vice versa?**

A: Choose Transit Gateway when: (1) You have more than 5 VPCs that need to communicate — peering requires N×(N-1)/2 connections and becomes unmanageable at scale; TGW needs only N attachments. (2) You need transitive routing — VPC A to communicate with VPC C via VPC B is impossible with peering; TGW routes transitively through its route tables. (3) You need to connect on-premises to multiple VPCs — a single Direct Connect or VPN attachment to TGW reaches all VPCs; with peering, you'd need separate VPN/DX connections to each VPC. (4) You need centralized traffic inspection — route all traffic through a security VPC firewall using TGW routing; this can't be done with peering. (5) You need cross-region connectivity over the AWS backbone. Choose VPC Peering when: (1) You have 2-5 VPCs with simple connectivity needs. (2) You want the lowest possible cost — no per-hour attachment cost, lower data transfer rates. (3) You just need two VPCs to communicate with no transitive routing needs. (4) Latency is critical — peering is direct, single-hop; TGW adds a small processing hop.

**Q2: Explain what transitive routing is and why VPC Peering doesn't support it.**

A: Transitive routing means traffic can pass through an intermediate network node to reach a destination. For example: if A is connected to B, and B is connected to C, transitive routing would allow A to reach C by sending traffic through B. VPC Peering explicitly does not support this by design. When AWS built VPC Peering, they made a deliberate security decision: peering is a bilateral trust agreement between exactly two VPC owners. If A and B peer, B did not consent to act as a transit point for third-party traffic. Allowing transit routing would mean B could inadvertently expose its network as a conduit to C, or C could reach resources in A that A never agreed to share with C. Transit routing via peering would effectively break the isolation model that makes peering safe. Transit Gateway explicitly provides transitive routing as a feature — all attachments accept that TGW is the central routing authority and can relay traffic.

**Q3: How do you connect an on-premises network to AWS? What options exist and when do you use each?**

A: There are four main options:
(1) **Site-to-Site VPN**: encrypted IPsec tunnel over the public internet. Best for: quick setup (minutes), branch offices, disaster recovery backup path, small/medium bandwidth needs (<1.25 Gbps per tunnel). Cost-effective. Variable latency and reliability.
(2) **Direct Connect**: dedicated private fiber circuit, up to 100 Gbps. Best for: mission-critical hybrid applications needing consistent low latency; large data transfer volumes; compliance requiring private connectivity; long-term stable connectivity. Takes weeks to provision.
(3) **Direct Connect + VPN**: add IPsec encryption on top of Direct Connect. Best for: compliance requiring encryption in transit on private circuits. Rare; typically DX's physical isolation is sufficient.
(4) **VPN over Direct Connect Public VIF**: use DX Public VIF as transport for VPN. Best for: routing VPN traffic without going over the internet while keeping encryption.
Decision matrix: need it in hours → VPN. Need it reliably and at high bandwidth long-term → Direct Connect. Need both quick start and future scale → VPN now, Direct Connect later, keep VPN as backup. Need multiple VPCs → attach VPN or DX to a Transit Gateway.

**Q4: What is the difference between a Gateway Endpoint and an Interface Endpoint? When do you use each?**

A: Gateway Endpoints work only for S3 and DynamoDB. They add a route table entry that directs traffic to the AWS service without an ENI. They're completely free (no hourly cost, no per-GB endpoint charge). However, they only work within the VPC — you can't access them from on-premises via Direct Connect/VPN, and they can't be accessed from peered VPCs. Interface Endpoints (PrivateLink) create ENIs in your subnets with private IPs. They support 100+ AWS services and custom services. They cost ~$7.50/AZ/month plus $0.01/GB. They support private DNS (overrides public endpoint DNS within VPC). Critically, they can be accessed from on-premises (if DNS resolution is properly forwarded via Route 53 Resolver) and from peered VPCs. Use Gateway Endpoints for S3 and DynamoDB — they're free and cover the vast majority of data transfer volume. Use Interface Endpoints for all other AWS services (SSM, KMS, ECR, CloudWatch, etc.) that private-subnet instances need, and for any compliance requirement to keep all traffic off the internet.

**Q5: Explain how AWS PrivateLink works at a technical level — from creating the service to consuming it.**

A: On the provider side: deploy your service on EC2/containers/ECS and put a Network Load Balancer in front. Create a VPC Endpoint Service in the PrivateLink console, pointing to the NLB. Configure acceptance settings (auto or manual per consumer) and optionally whitelist specific consumer AWS accounts. The NLB registers targets and health-checks them. On the consumer side: create an Interface VPC Endpoint, specifying the provider's service name. Choose subnets (one per AZ). AWS creates an Elastic Network Interface in each chosen subnet — this ENI gets a private IP from your subnet's CIDR. AWS generates DNS names for the endpoint. If Private DNS is enabled, AWS creates a Route 53 private hosted zone that overrides the service's public DNS name to resolve to the endpoint's ENI IP within your VPC. Traffic flow: Consumer instance → resolves DNS → gets ENI private IP → sends packet to ENI → packet enters AWS PrivateLink backbone → exits at provider NLB → reaches provider target → response returns same path. The consumer's EC2 never sends a packet outside the AWS network. The provider's VPC is never peered — only the specific NLB endpoint is reachable, not any other provider VPC resource.

**Q6: Direct Connect vs VPN — which would you recommend for a financial services company migrating to AWS?**

A: For a financial services company: Direct Connect is the clear choice for production workloads, with VPN as backup. Reasons: (1) **Compliance**: financial regulations (SOX, PCI-DSS, MiFID II) often require private network connections where traffic doesn't traverse public internet. Direct Connect provides a private, dedicated circuit meeting this requirement. (2) **Latency consistency**: financial applications (trading systems, payment processing) cannot tolerate the variable latency of the public internet. DX provides consistent, predictable latency. (3) **Bandwidth**: large-scale data transfer (end-of-day reconciliation, regulatory reporting) needs sustained high bandwidth that VPN (1.25 Gbps max) may not support. (4) **Reliability**: internet-based VPN is subject to BGP rerouting, packet loss during congestion, DDoS on shared infrastructure. DX has AWS SLA-backed reliability. Architecture recommendation: two Direct Connect connections from different DX locations (resiliency against DX location failure) + Site-to-Site VPN as tertiary backup, all connected to Transit Gateway for multi-VPC access. Add IPsec encryption over DX if the specific compliance framework requires encryption even on private circuits.

**Q7: How do you achieve high availability with Direct Connect? What are the failure scenarios?**

A: Failure scenarios in order of probability: (1) BGP session failure (software/config issue) — redundant BGP sessions per VIF, plus VPN backup. (2) Physical fiber break — single DX connection is a single fiber path. (3) DX port failure — AWS DX device port. (4) DX location failure — power, cooling, or physical access at the colocation. HA strategies: (1) **Two connections, same DX location**: protects against fiber break and port failure; not against location failure. (2) **Two connections, different DX locations**: protects against all above including location failure. Highest HA. (3) **DX + S2S VPN**: DX as primary (BGP preferred route via local preference); VPN as backup (lower preference). When DX BGP fails, traffic automatically fails over to VPN. VPN is cheaper than second DX but lower bandwidth. AWS SLA for DX requires diverse connections for the 99.99% SLA (vs 99.9% for single connection). For truly critical workloads: two DX connections (different locations) + VPN backup = three-path redundancy.

**Q8: What is BGP and why is it used with Direct Connect and Transit Gateway?**

A: BGP (Border Gateway Protocol) is the routing protocol that "holds the internet together" — it's how Autonomous Systems (networks with a single routing policy) exchange reachability information. Every ISP, major network, and AWS runs BGP. With Direct Connect, BGP serves as the dynamic routing protocol between your on-premises router and AWS's VGW or TGW: (1) Your router advertises your on-premises prefixes to AWS ("I can reach 192.168.0.0/16"). (2) AWS advertises VPC CIDRs back ("I can reach 10.0.0.0/16"). Both sides automatically learn each other's routes without manual configuration. When a route disappears (e.g., on-premises network goes down), BGP withdraws the route, and AWS stops sending traffic there. BGP attributes (Local Preference, AS Path, MED) control which path is preferred when multiple paths exist (e.g., DX vs VPN backup). With TGW peering, BGP is NOT used (static routes required between TGWs). BGP IS used for VPN attachments to TGW and for TGW Connect attachments (GRE). Understanding BGP is essential for troubleshooting routing in hybrid architectures.

**Q9: How does Network Firewall integrate with Transit Gateway for centralized inspection?**

A: The pattern is: all spoke VPCs route their traffic through a dedicated Security/Inspection VPC that hosts Network Firewall. Configuration steps: (1) Deploy Network Firewall endpoints in firewall subnets within the Security VPC (one per AZ). (2) Attach all spoke VPCs and the Security VPC to Transit Gateway. (3) Create a TGW route table for spoke VPCs: default route (0.0.0.0/0) → Security VPC attachment; spoke CIDR routes → Security VPC attachment. (4) Create a TGW route table for Security VPC: spoke CIDR routes → respective spoke VPC attachments; 0.0.0.0/0 → Internet attachment. (5) In Security VPC: ingress route table for traffic arriving from TGW → points to firewall endpoint. Egress route table for traffic leaving firewall → points to TGW. This creates a "bump in the wire" where all inter-VPC traffic goes: Source VPC → TGW → Security VPC ingress → Network Firewall → Security VPC egress → TGW → Destination VPC. The firewall applies stateful rules, IDS/IPS, domain filtering on all east-west and north-south traffic centrally.

**Q10: Global Accelerator vs CloudFront — explain when you'd use each and when you'd use both.**

A: CloudFront is a CDN — it caches copies of content at 400+ edge locations globally. When a user in Tokyo requests a static file, they get it from the Tokyo edge, not the US-East origin. CloudFront is HTTP/HTTPS only; it works at the application layer and understands HTTP caching semantics (Cache-Control headers, ETags). It also supports Lambda@Edge and CloudFront Functions for edge compute. Global Accelerator is a network-layer routing optimization service. It does NOT cache anything — it just routes TCP/UDP packets more efficiently from edge to origin. It works for any TCP/UDP application, including non-HTTP ones. When to use each: CloudFront for cacheable web content (images, JS, CSS, API responses), video streaming, websites with global users. Global Accelerator for UDP gaming, VoIP/RTP, IoT MQTT, any non-HTTP protocol, multi-region active-active with fast IP-layer failover. Use both when: your application has both cacheable web content (CloudFront) AND real-time non-HTTP communication (Global Accelerator). Example: a mobile game uses CloudFront for game asset downloads and Global Accelerator for real-time multiplayer UDP. Another example: a SaaS product uses CloudFront for the web dashboard and Global Accelerator for a low-latency API that requires consistent performance from all global regions.

**Q11: You have 20 VPCs across 3 AWS accounts and need them all to communicate securely with your on-premises data center and with each other. How do you architect this?**

A: Use a **centralized networking account** with Transit Gateway as the hub: (1) Create a TGW in the central networking account. (2) Share the TGW with all 3 AWS accounts via AWS Resource Access Manager (RAM). (3) Each account creates VPC attachments to the shared TGW — 20 attachments total. (4) Attach the Direct Connect (via Direct Connect Gateway → Transit VIF) to the TGW for on-premises connectivity. (5) Design TGW route tables for segmentation: a "Shared Services RT" allows all VPCs to reach a shared services VPC (Active Directory, monitoring). A "Prod RT" allows production VPCs to reach each other and on-premises but not dev. A "Dev RT" allows dev VPCs to reach each other and shared services but not production and not on-premises. (6) Deploy Network Firewall in a security VPC, with a TGW route table routing all egress traffic through it. (7) Use AWS Organizations + AWS RAM for centralized resource sharing and SCPs to enforce networking controls. This scales to hundreds of VPCs without adding complexity — just more attachments and route table entries.

**Q12: A developer's EC2 instance in a private subnet cannot connect to SSM Parameter Store, resulting in failed application deployments. How do you troubleshoot and fix this?**

A: SSM Parameter Store is accessed via the SSM endpoint. Troubleshoot: (1) Check if the VPC has an Interface Endpoint for SSM (`com.amazonaws.region.ssm`). If no endpoint exists, private subnet instances need internet access via NAT Gateway to reach `ssm.us-east-1.amazonaws.com`. (2) If endpoint exists: check the endpoint's Security Group — does it allow HTTPS (443) inbound from the EC2 instance's security group or subnet CIDR? (3) Check Private DNS: is it enabled on the endpoint? If not, the DNS name resolves to the public IP and traffic tries to go to internet (fails without NAT). (4) Check the EC2 instance's security group: does it allow HTTPS (443) outbound to the endpoint? (5) Check VPC DNS settings: `enableDnsHostnames` and `enableDnsSupport` must be true for Private DNS to work. Fix: create Interface Endpoints for all required SSM-related services: `com.amazonaws.region.ssm`, `com.amazonaws.region.ssmmessages`, `com.amazonaws.region.ec2messages` — all three are required for full SSM functionality (Session Manager + Parameter Store). Attach a security group allowing port 443 from the VPC CIDR. Enable Private DNS. The EC2 instance will now resolve SSM DNS names to private IPs and communicate without internet.

**Q13: What happens to Direct Connect traffic if the DX link fails and you have a VPN backup? Walk through the failover.**

A: Setup: on-premises router runs BGP with both the Direct Connect VIF (advertising routes with high Local Preference = 200) and the VPN connection (advertising same routes with lower Local Preference = 100). The VGW or TGW prefers the DX path due to higher local preference. Failover sequence: (1) Physical DX failure occurs (fiber cut, hardware failure). (2) BGP on DX VIF detects keepalive failure (BGP hold timer, typically 90 seconds unless using BFD). (3) With BFD (Bidirectional Forwarding Detection): sub-second detection (300ms typical) — immediately triggers BGP session teardown. (4) BGP withdraws all DX-learned routes from the routing table. (5) VPN BGP routes (previously installed with lower preference but valid) become the active path. (6) Route convergence: traffic starts flowing over VPN (public internet, encrypted). (7) When DX recovers: BGP re-establishes over DX; DX routes re-advertised with higher preference; traffic migrates back to DX. Total failover time with BFD: ~1-5 seconds. Without BFD (standard BGP timers): ~90 seconds. Best practice: always enable BFD on Direct Connect for fast failure detection.

**Q14: Explain how you would design a VPC architecture for a three-tier web application with compliance requirements (no direct internet access to database tier).**

A: Three-tier architecture (Web → App → DB) with strict isolation: (1) **VPC CIDR**: e.g., `10.0.0.0/16` — reserve plenty of space. (2) **Public subnets** (Web tier, 2 AZs): `10.0.0.0/24`, `10.0.1.0/24`. Route table: `0.0.0.0/0 → Internet Gateway`. Deploy ALB here. Allow inbound 80/443 from internet via Security Group. (3) **Private App subnets** (App tier, 2 AZs): `10.0.10.0/24`, `10.0.11.0/24`. Route table: `0.0.0.0/0 → NAT Gateway` (for outbound-only internet, e.g., OS updates). EC2 app servers here. Security Group: allow inbound only from ALB's security group on app port. (4) **Private DB subnets** (DB tier, 2 AZs): `10.0.20.0/24`, `10.0.21.0/24`. Route table: **no internet route** — no NAT Gateway, no IGW. RDS/Aurora here. Security Group: allow inbound only from App tier security group on DB port (3306, 5432). (5) **Interface VPC Endpoints**: for DB tier to reach AWS services (SSM, Secrets Manager for credentials rotation) without internet. (6) **Network Firewall** (optional, for compliance): in dedicated firewall subnets; inspect all inter-tier traffic. (7) **VPC Flow Logs**: log all traffic for audit trail. Database tier never has internet route — even if Security Groups were misconfigured, there's no internet path. Defense in depth: routing isolation + security group isolation.

**Q15: What is the purpose of TGW route table associations and propagations? Give a concrete example.**

A: In Transit Gateway, every attachment is associated with exactly one route table, and routes from attachments can be propagated into any number of route tables. **Association** determines which route table an attachment uses to look up the next-hop when it sends traffic INTO the TGW. **Propagation** determines which route tables receive an attachment's CIDR as a route. Concrete example: You have 3 VPCs (Production `10.0.0.0/16`, Dev `10.1.0.0/16`, Shared `10.2.0.0/16`) and 1 VPN (on-premises `192.168.0.0/16`). Goal: Prod can talk to Shared and On-Premises. Dev can talk to Shared only. Shared can talk to everyone. Configure: Create two route tables: "Prod-RT" and "Dev-RT". Associate Production VPC and VPN attachment → Prod-RT. Associate Dev VPC → Dev-RT. Associate Shared VPC → both (or create a third RT). Propagate Shared VPC (`10.2.0.0/16`) → into both Prod-RT and Dev-RT. Propagate Production VPC (`10.0.0.0/16`) → into Prod-RT only. Propagate VPN (`192.168.0.0/16`) → into Prod-RT only. Do NOT propagate Production or VPN into Dev-RT. Result: Production traffic routed via Prod-RT sees routes to Shared and On-Premises; Dev traffic routed via Dev-RT sees only the route to Shared.

**Q16: How does Client VPN differ from Site-to-Site VPN? When would you use each?**

A: Site-to-Site VPN connects two networks (your entire on-premises network to your entire VPC network) — all machines in both networks can communicate via the tunnel. It uses IPsec protocol, connects via a Customer Gateway device (router/firewall), and is always-on. Client VPN connects individual user devices to the VPC network — each user runs an OpenVPN client that authenticates and establishes a session. It uses TLS/OpenVPN protocol. Use Site-to-Site VPN for: connecting a branch office, a data center, or any fixed site where all machines need VPC access; always-on connectivity. Use Client VPN for: individual remote workers (developers, admins) who need to access VPC resources from their laptops; contractor access; anyone accessing from a mobile/variable location. They can coexist: S2S for office connectivity, Client VPN for remote workers.

**Q17: A company wants to allow a partner company to access a specific internal API without giving them access to the VPC. How would you architect this using PrivateLink?**

A: Use PrivateLink endpoint service: (1) Deploy the internal API on EC2/ECS in your VPC. (2) Put a Network Load Balancer (NLB) in front of the API service. (3) Create a VPC Endpoint Service, associating it with the NLB. (4) Configure whitelist: add the partner's AWS account ID to the allowed principals list. (5) Set acceptance = manual (you must approve each new endpoint request). (6) Share the service name with the partner. Partner setup: (1) In their AWS account, create an Interface VPC Endpoint in their VPC, specifying your service name. (2) A request is sent to you; you approve it in the console. (3) AWS creates an ENI in their chosen subnet. (4) They use the endpoint DNS name to call your API. Result: the partner has a private ENI that connects only to your NLB, which connects only to your API. They cannot route to any other resource in your VPC. You didn't create a peering (which would expose your whole CIDR) — just a single-service endpoint. You can revoke access by denying their account from the endpoint service principals.

**Q18: How do you reduce the number of Interface Endpoints (and their cost) while allowing multiple VPCs to use them?**

A: Interface Endpoints are created per-VPC by default. For 20 VPCs needing SSM access: 20 × 3 endpoints × 2 AZs × $7.50/month = $900/month just for SSM endpoints. Solution: **Centralized endpoint VPC** with Transit Gateway. (1) Create one "Shared Services VPC" with all Interface Endpoints (SSM, KMS, ECR, CloudWatch, etc.) for all services. (2) Enable Private DNS on the endpoints. (3) Attach all spoke VPCs to Transit Gateway. (4) Attach Shared Services VPC to TGW. (5) Route AWS service traffic from spoke VPCs to TGW → Shared Services VPC → Interface Endpoints. Challenge: Private DNS endpoint names only resolve to the ENI private IP within the Shared Services VPC itself. Spoke VPCs must use Route 53 Resolver forwarding rules to forward DNS queries for `ssm.us-east-1.amazonaws.com` to a Route 53 Resolver inbound endpoint in the Shared Services VPC, which then resolves to the endpoint ENI. This is more complex to configure but can reduce endpoint costs by ~90% at scale.

**Q19: What is a BGP community and how is it used with Direct Connect?**

A: BGP communities are tags applied to BGP routes (32-bit values formatted as AS:value) that communicate routing policy preferences between BGP peers. With Direct Connect, AWS supports specific BGP communities to control route advertisement and traffic preferences: **For Public VIFs**: `7224:9100` — advertise to all AWS regions; `7224:9200` — advertise to all AZs in the home region; `7224:9300` — advertise only to local AZ. Control scope of which AWS regions receive your advertised routes. **For Private VIFs**: `7224:7100` (low preference), `7224:7200` (medium preference), `7224:7300` (high preference) — tell AWS which path to prefer when multiple DX connections exist. Use case: you have DX in us-east-1 and us-west-2. Advertise your on-premises prefixes from us-east-1 with `7224:7300` (high preference) and from us-west-2 with `7224:7100` (low preference). AWS will use us-east-1 DX as primary path to your on-premises network and us-west-2 as backup.

**Q20: Your application serves 50 million global users with real-time requirements. How would you combine Global Accelerator, multi-region deployment, and Route 53 to achieve both performance and high availability?**

A: Architecture for global real-time application: (1) **Multi-region deployment**: deploy your application in 3+ regions (us-east-1, eu-west-1, ap-southeast-1). Each region has an ALB + Auto Scaling ECS cluster + Aurora Global Database (one primary writer, read replicas in each region). (2) **Global Accelerator**: attach ALBs from all three regions as endpoint groups in Global Accelerator. Configure traffic dials per region (how much traffic to send, 0-100%). Configure health checks per endpoint — Global Accelerator monitors ALB health and removes failed regions from routing automatically within 30 seconds. Users anywhere in the world connect to the two static anycast IPs and are routed to the nearest healthy region over the AWS backbone. (3) **Latency-based or geolocation routing (Route 53)**: for the DNS name (if not using Global Accelerator's static IP), use Route 53 latency-based routing pointing to Global Accelerator's anycast IPs. Actually, with Global Accelerator, you point users to the static IPs directly — no DNS-based geographic routing needed (the anycast mechanism handles regional routing). (4) **Failover**: if us-east-1 ALB health checks fail (e.g., zone impact), Global Accelerator immediately shifts that traffic to eu-west-1 or ap-southeast-1. Failover happens at the IP routing layer — the user's TCP connection may reset, but reconnection is fast and routes to the healthy region. Result: 50 million global users get consistently low latency (routed to nearest AWS edge, then AWS backbone), high availability (automatic sub-30-second regional failover), and consistent performance regardless of internet conditions.
