# Project 2 — VPC with Public/Private Subnets and NAT Gateway

**Level:** Beginner
**Time estimate:** 45 – 60 minutes
**Phase prerequisite:** Phase 2 – Resources & Providers, Phase 3 – Variables & Outputs

---

## Overview

You will build a production-shaped network foundation from scratch: a custom VPC spanning two Availability Zones, with one public and one private subnet per AZ, an Internet Gateway for the public subnets, a NAT Gateway so private-subnet resources can reach the internet outbound (e.g. for package updates) without being reachable from it, and the route tables that tie it all together.

This is the networking layer every later project (multi-tier app, modules, CI/CD) builds on top of.

```
                        ┌─────────────────────────────────────────┐
                        │                  VPC                     │
                        │           10.0.0.0/16                    │
                        │                                          │
   Internet ──IGW────── │  AZ-a                    AZ-b            │
                        │  ┌────────────┐          ┌────────────┐  │
                        │  │ Public      │          │ Public      │  │
                        │  │ 10.0.1.0/24 │          │ 10.0.2.0/24 │  │
                        │  │  [NAT GW]   │          │             │  │
                        │  └─────┬──────┘          └────────────┘  │
                        │        │ private route → NAT             │
                        │  ┌─────▼──────┐          ┌────────────┐  │
                        │  │ Private     │          │ Private     │  │
                        │  │10.0.11.0/24 │          │10.0.12.0/24 │  │
                        │  └────────────┘          └────────────┘  │
                        └─────────────────────────────────────────┘
```

---

## Prerequisites

- Terraform >= 1.5 and AWS credentials configured (same as Project 1)
- Completed Project 1, or equivalent comfort with `provider`, `resource`, and `variable` blocks
- Awareness that a NAT Gateway has an **hourly cost plus data-processing charges** — this is not a free-tier resource; destroy it when you're done experimenting

---

## Project Structure

```
02-vpc-networking-setup/
├── main.tf
├── variables.tf
├── outputs.tf
└── terraform.tfvars
```

---

## Step-by-Step Instructions

### Step 1 — Create the directory

```bash
mkdir 02-vpc-networking-setup && cd 02-vpc-networking-setup
```

### Step 2 — `variables.tf`

```hcl
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefix used for resource naming and tags"
  type        = string
  default     = "vpc-demo"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AZs to spread subnets across"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets, one per AZ"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets, one per AZ"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}
```

### Step 3 — `main.tf` (providers, VPC, IGW)

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}
```

### Step 4 — Public and private subnets (one per AZ)

```hcl
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${var.availability_zones[count.index]}"
    Tier = "public"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-private-${var.availability_zones[count.index]}"
    Tier = "private"
  }
}
```

### Step 5 — NAT Gateway (in the first public subnet)

A NAT Gateway needs an Elastic IP and must live in a public subnet so it can reach the Internet Gateway.

```hcl
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-nat-eip"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${var.project_name}-nat"
  }

  depends_on = [aws_internet_gateway.main]
}
```

> This project uses a **single** NAT Gateway shared by both private subnets to keep cost down. In production you'd typically run one NAT Gateway per AZ for high availability — see Stretch Goal 1.

### Step 6 — Route tables

```hcl
# ── Public route table: 0.0.0.0/0 → Internet Gateway ────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── Private route table: 0.0.0.0/0 → NAT Gateway ────────────────────────────
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
```

### Step 7 — `outputs.tf`

```hcl
output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "nat_gateway_public_ip" {
  description = "Elastic IP address attached to the NAT Gateway"
  value       = aws_eip.nat.public_ip
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}
```

### Step 8 — `terraform.tfvars`

```hcl
aws_region   = "us-east-1"
project_name = "vpc-demo"
```

(Leave the CIDR/AZ variables at their defaults, or override them here.)

### Step 9 — Apply

```bash
terraform init
terraform fmt
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

Expect roughly 11 resources: 1 VPC, 1 IGW, 4 subnets, 1 EIP, 1 NAT Gateway, 2 route tables, 4 route table associations.

---

## Expected Result

- A VPC with 4 subnets (2 public, 2 private) spread across 2 AZs.
- Public subnets auto-assign public IPs and route to the Internet Gateway.
- Private subnets have **no** public IPs and route outbound traffic through the single NAT Gateway.
- All resources are tagged consistently with `project_name` for easy identification in the AWS console.

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| VPC exists | `aws ec2 describe-vpcs --vpc-ids $(terraform output -raw vpc_id)` | State `available` |
| Public subnets auto-assign IPs | `aws ec2 describe-subnets --subnet-ids $(terraform output -json public_subnet_ids \| jq -r '.[]') --query "Subnets[].MapPublicIpOnLaunch"` | `[true, true]` |
| NAT Gateway available | `aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=$(terraform output -raw vpc_id)" --query "NatGateways[0].State"` | `"available"` |
| Private route via NAT | `aws ec2 describe-route-tables --route-table-ids <private-rt-id> --query "RouteTables[0].Routes"` | Contains a route with `NatGatewayId` set |

---

## Tear Down

```bash
terraform destroy
```

NAT Gateways can take a minute or two to delete — Terraform will wait for it. Confirm the Elastic IP is released afterward (`aws ec2 describe-addresses`) since an unattached EIP also incurs a small hourly charge.

---

## Stretch Goals

1. **One NAT Gateway per AZ** — replace the single shared NAT Gateway with one per public subnet (using `count`), and update each private route table to point at the NAT Gateway in its own AZ for true multi-AZ resilience.
2. **VPC Flow Logs** — add an `aws_flow_log` resource that ships VPC traffic metadata to a CloudWatch Log Group.
3. **Network ACLs** — add explicit `aws_network_acl` rules for the private subnets instead of relying solely on the default ACL.
4. **S3 Gateway endpoint** — add an `aws_vpc_endpoint` of type `Gateway` for S3 so private-subnet instances can reach S3 without traversing the NAT Gateway (saves NAT data-processing cost).
5. **Third AZ** — extend the `availability_zones`, `public_subnet_cidrs`, and `private_subnet_cidrs` lists to cover a third AZ and confirm Terraform scales all `count`-based resources automatically.
