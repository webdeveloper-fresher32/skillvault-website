# Project 3 — Multi-Tier App: VPC + EC2 Web Tier + RDS MySQL

**Level:** Intermediate
**Time estimate:** 75 – 90 minutes
**Phase prerequisite:** Phase 4 – State Management, Phase 5 – Data Sources & Expressions

---

## Overview

You will wire together a full two-tier application topology on AWS:

- **Networking** — a VPC with public subnets (web tier) and private subnets (database tier) across 2 AZs, reusing the pattern from Project 2.
- **Web tier** — EC2 instances in the public subnets running a simple app, sitting behind a security group that allows HTTP/SSH from the internet.
- **Database tier** — an RDS MySQL instance in the private subnets, reachable **only** from the web tier's security group — never directly from the internet.

This is the classic "two security groups referencing each other" pattern that shows up in almost every real-world AWS architecture.

```
Internet
   │
   ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│  Public Subnets (2 AZs)  │        │  Private Subnets (2 AZs)  │
│  ┌────────────────────┐  │        │  ┌─────────────────────┐  │
│  │  EC2 Web Instance   │──┼───────▶│  │  RDS MySQL (Multi-AZ)│  │
│  │  SG: web-sg          │  │  3306  │  │  SG: db-sg           │  │
│  │  (80, 22 from 0/0)   │  │        │  │  (3306 from web-sg)  │  │
│  └────────────────────┘  │        │  └─────────────────────┘  │
└─────────────────────────┘        └──────────────────────────┘
```

---

## Prerequisites

- Terraform >= 1.5 and AWS credentials configured
- Completed Projects 1 and 2, or equivalent familiarity with EC2, security groups, and subnets
- An existing EC2 key pair (see Project 1, Step 5)
- Awareness that `db.t3.micro` RDS and a NAT Gateway both carry ongoing cost — destroy this stack when done

---

## Project Structure

```
03-multi-tier-app-infra/
├── main.tf
├── network.tf
├── web.tf
├── database.tf
├── variables.tf
├── outputs.tf
└── terraform.tfvars
```

Splitting a single-root configuration into multiple `.tf` files is purely organizational — Terraform loads every `*.tf` file in the directory and merges them into one configuration. This is a good habit before you graduate to real modules in Project 4.

---

## Step-by-Step Instructions

### Step 1 — Create the directory

```bash
mkdir 03-multi-tier-app-infra && cd 03-multi-tier-app-infra
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
  default     = "multitier-demo"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "key_name" {
  description = "Existing EC2 key pair name for SSH access"
  type        = string
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}

variable "db_name" {
  type    = string
  default = "appdb"
}

variable "db_username" {
  type    = string
  default = "appadmin"
}

variable "db_password" {
  description = "Master password for RDS (sensitive — pass via TF_VAR_db_password or a .tfvars file excluded from git)"
  type        = string
  sensitive   = true
}
```

### Step 3 — `main.tf` (provider only)

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
```

### Step 4 — `network.tf` (VPC, subnets, IGW, NAT — same pattern as Project 2)

```hcl
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public-${count.index}", Tier = "public" }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "${var.project_name}-private-${count.index}", Tier = "private" }
}

resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]

  tags = { Name = "${var.project_name}-nat" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = { Name = "${var.project_name}-private-rt" }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
```

### Step 5 — `web.tf` (web tier security group + EC2 instances)

```hcl
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_security_group" "web_sg" {
  name        = "${var.project_name}-web-sg"
  description = "Web tier: HTTP + SSH from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # tighten to your own IP in real use
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-web-sg" }
}

resource "aws_instance" "web" {
  count                  = length(aws_subnet.public)
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = aws_subnet.public[count.index].id
  vpc_security_group_ids = [aws_security_group.web_sg.id]

  user_data = <<-EOF
    #!/bin/bash
    dnf install -y httpd mariadb105
    systemctl enable httpd
    systemctl start httpd
    echo "<h1>Web tier instance ${count.index} — DB host: ${aws_db_instance.main.address}</h1>" > /var/www/html/index.html
  EOF

  tags = { Name = "${var.project_name}-web-${count.index}" }

  depends_on = [aws_db_instance.main]
}
```

> The `user_data` script references `aws_db_instance.main.address`, which creates an implicit dependency — Terraform will provision the database before rendering the web tier's boot script.

### Step 6 — `database.tf` (DB subnet group, security group, RDS instance)

```hcl
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${var.project_name}-db-subnet-group" }
}

resource "aws_security_group" "db_sg" {
  name        = "${var.project_name}-db-sg"
  description = "Database tier: MySQL from web tier only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "MySQL from web tier"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.web_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-db-sg" }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-mysql"
  engine         = "mysql"
  engine_version = "8.0"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]

  multi_az               = false
  publicly_accessible    = false
  skip_final_snapshot    = true
  backup_retention_period = 1
  deletion_protection    = false

  tags = { Name = "${var.project_name}-mysql" }
}
```

> `skip_final_snapshot = true` and `deletion_protection = false` are set here purely so `terraform destroy` completes cleanly for a lab. Flip both in any environment that holds real data.

### Step 7 — `outputs.tf`

```hcl
output "web_public_ips" {
  description = "Public IPs of the web tier instances"
  value       = aws_instance.web[*].public_ip
}

output "db_endpoint" {
  description = "RDS connection endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  description = "RDS hostname only"
  value       = aws_db_instance.main.address
  sensitive   = false
}

output "vpc_id" {
  value = aws_vpc.main.id
}
```

### Step 8 — `terraform.tfvars`

```hcl
aws_region   = "us-east-1"
project_name = "multitier-demo"
key_name     = "my-terraform-key"
```

Set the sensitive DB password as an environment variable instead of committing it to a file:

```bash
export TF_VAR_db_password='ChangeMe123!StrongPassword'
```

### Step 9 — Apply

```bash
terraform init
terraform fmt
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

RDS provisioning typically takes 5–10 minutes — Terraform will wait for the instance to reach `available` before finishing the apply.

---

## Expected Result

- Two EC2 web instances (one per AZ) serving a page that shows the RDS hostname, proving the web tier resolved the database endpoint at boot time.
- An RDS MySQL instance living entirely in private subnets with `publicly_accessible = false` — it has no route to the internet and no path from outside the VPC.
- The database security group's only ingress rule references the **web security group by ID**, not a CIDR block — meaning only instances wearing `web_sg` can reach port 3306, regardless of what subnet they're in.

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Web tier responds | `curl -s http://$(terraform output -json web_public_ips \| jq -r '.[0]')` | Shows the DB host in the HTML |
| DB not publicly accessible | `aws rds describe-db-instances --db-instance-identifier multitier-demo-mysql --query "DBInstances[0].PubliclyAccessible"` | `false` |
| DB security group scoped to web SG | `aws ec2 describe-security-groups --group-ids <db-sg-id> --query "SecurityGroups[0].IpPermissions[0].UserIdGroupPairs"` | Contains the `web-sg` ID, no `0.0.0.0/0` |
| App can reach DB | SSH into a web instance and run `mysql -h $(terraform output -raw db_address) -u appadmin -p` | Connects successfully |
| Direct internet access to DB fails | From your laptop: `mysql -h <db_address> -u appadmin -p` (with correct SG temporarily opened only for this test) | Times out — no route from the internet |

---

## Tear Down

```bash
terraform destroy
```

RDS deletion can take several minutes. If you set `deletion_protection = true` for practice, disable it first with `terraform apply` before destroying.

---

## Stretch Goals

1. **Application Load Balancer** — put an ALB in front of the two web instances instead of exposing their public IPs directly, and point the ALB's target group health check at `/`.
2. **Auto Scaling Group** — replace the fixed `count = 2` web instances with an `aws_launch_template` + `aws_autoscaling_group` that scales based on CPU utilization.
3. **Secrets Manager** — store `db_password` in AWS Secrets Manager and reference it via `data "aws_secretsmanager_secret_version"` instead of a plain Terraform variable.
4. **Multi-AZ RDS** — flip `multi_az = true` and observe the additional standby instance Terraform provisions; compare cost and failover behavior.
5. **Private-only web tier** — move the web tier behind the ALB into private subnets too, so only the load balancer sits in public subnets — the "three-tier with no direct internet-facing compute" pattern used in stricter production environments.
