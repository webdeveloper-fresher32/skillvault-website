# Terraform for AWS — Complete Guide

---

## 1. Why Terraform

### The Problem Terraform Solves

Manual AWS console clicks are not repeatable, auditable, or version-controlled. CloudFormation solves this for AWS only. Terraform solves it for every cloud, every provider.

### Terraform vs CloudFormation

| Feature | Terraform | CloudFormation |
|---|---|---|
| Multi-cloud | Yes (AWS, Azure, GCP, 1000+ providers) | AWS only |
| Language | HCL (HashiCorp Configuration Language) | JSON / YAML |
| State management | Explicit state file | Managed by AWS internally |
| Plan before apply | `terraform plan` shows exact diff | Change sets (less readable) |
| Rollback | Manual (re-apply previous code) | Automatic rollback on failure |
| Drift detection | `terraform plan` shows drift | Stack drift detection |
| Community modules | Terraform Registry (thousands) | Limited |
| Import existing infra | `terraform import` | `--import` flag (newer) |
| Destroy command | `terraform destroy` | Delete stack |
| Open source | Yes (MPL 2.0 / BSL 1.1) | Proprietary |

### Core Concepts

- **Provider**: Plugin that knows how to talk to an API (AWS, Azure, GitHub, etc.)
- **Resource**: An infrastructure object managed by Terraform (EC2, S3, VPC)
- **State**: JSON file tracking what Terraform thinks exists in the real world
- **Plan**: Diff between desired state (code) and actual state (state file / real world)
- **Module**: Reusable group of resources packaged together

---

## 2. Installation and AWS Provider Setup

### Install Terraform (macOS)

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verify
terraform version
# Terraform v1.9.x
```

### Install Terraform (Linux)

```bash
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

### providers.tf — AWS Provider with Version Constraints

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"   # allows 5.x, blocks 6.x
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state backend — see Section 12
  backend "s3" {
    bucket         = "my-terraform-state-bucket"
    key            = "prod/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  # Optional: assume a role for cross-account deployments
  # assume_role {
  #   role_arn = "arn:aws:iam::123456789012:role/TerraformDeployRole"
  # }

  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Environment = var.environment
      Project     = var.project_name
    }
  }
}

# Second provider alias for us-east-1 (e.g. ACM certs for CloudFront must be in us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
```

### Version Constraint Operators

| Operator | Meaning | Example |
|---|---|---|
| `= 5.0.0` | Exact version | `= 5.0.0` |
| `!= 5.1.0` | Exclude version | `!= 4.0.0` |
| `> 5.0` | Greater than | `> 5.0` |
| `>= 5.0` | Greater than or equal | `>= 5.0` |
| `~> 5.0` | Patch-level only (5.0.x) | `~> 5.0` |
| `~> 5` | Minor-level (5.x) | `~> 5` |

---

## 3. HCL Syntax Basics

### Blocks

```hcl
# Block syntax: block_type "type" "name" { ... }
resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
}

# Nested block
resource "aws_security_group" "example" {
  name = "example"

  ingress {           # nested block — no label
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Arguments and Expressions

```hcl
# String literal
name = "my-instance"

# Number
port = 8080

# Boolean
enable_dns = true

# List
availability_zones = ["ap-southeast-2a", "ap-southeast-2b"]

# Map
tags = {
  Name = "my-instance"
  Env  = "prod"
}

# String interpolation
name = "web-${var.environment}-${count.index}"

# Heredoc (multi-line string)
user_data = <<-EOF
  #!/bin/bash
  yum update -y
  yum install -y httpd
  systemctl start httpd
EOF

# Conditional expression (ternary)
instance_type = var.environment == "prod" ? "t3.large" : "t3.micro"

# Functions
ami_id = data.aws_ami.amazon_linux.id
upper_name = upper(var.project_name)         # "MYPROJECT"
joined = join(",", var.subnet_ids)           # "subnet-1,subnet-2"
merged = merge(var.common_tags, { Name = "web" })
```

### Comments

```hcl
# Single-line comment

// Also single-line (less common)

/*
  Multi-line
  comment
*/
```

---

## 4. Variables

### variables.tf — All Types with Validation

```hcl
# String variable
variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-southeast-2"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "Must be a valid AWS region name like ap-southeast-2."
  }
}

# Number variable
variable "instance_count" {
  description = "Number of EC2 instances to create"
  type        = number
  default     = 2

  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 10
    error_message = "Instance count must be between 1 and 10."
  }
}

# Boolean variable
variable "enable_nat_gateway" {
  description = "Enable NAT gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use a single NAT gateway (cost saving for non-prod)"
  type        = bool
  default     = false
}

# List of strings
variable "availability_zones" {
  description = "AZs to use for subnet deployment"
  type        = list(string)
  default     = ["ap-southeast-2a", "ap-southeast-2b", "ap-southeast-2c"]
}

# List of numbers
variable "ingress_ports" {
  description = "Ports to open on the web security group"
  type        = list(number)
  default     = [80, 443, 8080]
}

# Map of strings
variable "environment_config" {
  description = "Per-environment configuration values"
  type        = map(string)
  default = {
    dev  = "t3.micro"
    stag = "t3.small"
    prod = "t3.large"
  }
}

# Object variable — strongly typed structure
variable "db_config" {
  description = "RDS database configuration"
  type = object({
    instance_class    = string
    allocated_storage = number
    engine_version    = string
    multi_az          = bool
    username          = string
  })
  default = {
    instance_class    = "db.t3.micro"
    allocated_storage = 20
    engine_version    = "8.0"
    multi_az          = false
    username          = "admin"
  }
}

# Sensitive variable — value never shown in plan output
variable "db_password" {
  description = "Master password for RDS instance"
  type        = string
  sensitive   = true
  # No default — must be passed via TF_VAR_db_password or -var flag
}

# Environment name with enum-style validation
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name used as a prefix for all resources"
  type        = string
  default     = "myapp"
}
```

### Passing Variable Values

```bash
# Method 1: CLI flag
terraform apply -var="environment=prod" -var="instance_count=3"

# Method 2: .tfvars file
terraform apply -var-file="prod.tfvars"

# Method 3: Environment variables (TF_VAR_ prefix)
export TF_VAR_db_password="SuperSecret123!"
terraform apply

# Method 4: terraform.tfvars (auto-loaded)
# Just create a file named terraform.tfvars or *.auto.tfvars
```

### prod.tfvars Example

```hcl
aws_region         = "ap-southeast-2"
environment        = "prod"
instance_count     = 3
enable_nat_gateway = true
single_nat_gateway = false

db_config = {
  instance_class    = "db.r6g.large"
  allocated_storage = 100
  engine_version    = "8.0"
  multi_az          = true
  username          = "dbadmin"
}
```

---

## 5. Locals

Locals compute values once and reuse them. They cannot be overridden from outside (unlike variables).

```hcl
locals {
  # Common tags merged onto every resource
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
    Owner       = "platform-team"
    CostCenter  = "CC-${upper(var.environment)}"
  }

  # Name prefix to keep resource names consistent
  name_prefix = "${var.project_name}-${var.environment}"

  # Dynamic AZ count based on region
  az_count = length(data.aws_availability_zones.available.names)

  # Compute CIDR blocks for subnets
  public_subnet_cidrs  = [for i in range(3) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnet_cidrs = [for i in range(3) : cidrsubnet(var.vpc_cidr, 4, i + 3)]

  # Conditional flag
  is_prod = var.environment == "prod"

  # Instance type from map lookup
  instance_type = lookup(var.environment_config, var.environment, "t3.micro")

  # Account ID for ARN construction
  account_id = data.aws_caller_identity.current.account_id
}
```

Usage:

```hcl
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}
```

---

## 6. Outputs

```hcl
# outputs.tf

output "vpc_id" {
  description = "ID of the main VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "web_instance_public_ips" {
  description = "Public IP addresses of web instances"
  value       = aws_instance.web[*].public_ip
}

output "db_endpoint" {
  description = "RDS instance endpoint hostname"
  value       = aws_db_instance.main.endpoint
}

output "db_password" {
  description = "RDS master password"
  value       = var.db_password
  sensitive   = true   # Masked in plan/apply output, still in state file
}

output "load_balancer_dns" {
  description = "DNS name of the application load balancer"
  value       = aws_lb.main.dns_name
}

# Output from a module
output "module_vpc_id" {
  description = "VPC ID from the vpc module"
  value       = module.vpc.vpc_id
}
```

Accessing outputs:

```bash
terraform output                        # show all
terraform output vpc_id                 # show one
terraform output -json                  # JSON format for scripting
terraform output -raw db_endpoint       # raw string, no quotes
```

---

## 7. Data Sources

Data sources read existing infrastructure — they do not create anything.

```hcl
# data.tf

# Latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

# Available AZs in the current region
data "aws_availability_zones" "available" {
  state = "available"
}

# Current AWS account identity
data "aws_caller_identity" "current" {}

# Current region
data "aws_region" "current" {}

# Existing VPC (if you have one already)
data "aws_vpc" "existing" {
  tags = {
    Name = "existing-vpc"
  }
}

# Existing SSM parameter (e.g. stored secrets)
data "aws_ssm_parameter" "db_password" {
  name            = "/myapp/prod/db_password"
  with_decryption = true
}

# IAM policy document
data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}
```

Usage:

```hcl
resource "aws_instance" "web" {
  ami = data.aws_ami.amazon_linux.id   # always latest AL2023

  # Reference current region
  tags = {
    Region = data.aws_region.current.name
  }
}

# Outputs
output "current_account_id" {
  value = data.aws_caller_identity.current.account_id
}
```

---

## 8. Key Resources — Complete Code

### VPC and Networking

```hcl
# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(local.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${count.index + 1}"
    Type = "public"
  })
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(local.private_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-${count.index + 1}"
    Type = "private"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  count  = var.single_nat_gateway ? 1 : length(aws_subnet.public)
  domain = "vpc"

  depends_on = [aws_internet_gateway.main]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eip-nat-${count.index + 1}"
  })
}

# NAT Gateway (one per AZ for HA, or single for cost saving)
resource "aws_nat_gateway" "main" {
  count = var.single_nat_gateway ? 1 : length(aws_subnet.public)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rt-public"
  })
}

# Public Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private Route Tables (one per AZ for proper HA)
resource "aws_route_table" "private" {
  count  = var.single_nat_gateway ? 1 : length(aws_subnet.private)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.single_nat_gateway ? aws_nat_gateway.main[0].id : aws_nat_gateway.main[count.index].id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rt-private-${count.index + 1}"
  })
}

# Private Route Table Associations
resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = var.single_nat_gateway ? aws_route_table.private[0].id : aws_route_table.private[count.index].id
}
```

### Security Groups

```hcl
# Web tier security group — allows HTTP/HTTPS from internet
resource "aws_security_group" "web" {
  name        = "${local.name_prefix}-sg-web"
  description = "Security group for web tier EC2 instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH from bastion"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.bastion_cidr]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sg-web"
  })
}

# Database security group — allows MySQL only from web tier
resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-sg-db"
  description = "Security group for RDS database instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "MySQL from web tier"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sg-db"
  })
}
```

### EC2 Instance

```hcl
# IAM Role for EC2 (allows SSM access — no SSH key needed)
resource "aws_iam_role" "ec2" {
  name               = "${local.name_prefix}-role-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name_prefix}-profile-ec2"
  role = aws_iam_role.ec2.name
}

# EC2 Instance
resource "aws_instance" "web" {
  count = var.instance_count

  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = local.instance_type
  subnet_id              = aws_subnet.public[count.index % length(aws_subnet.public)].id
  vpc_security_group_ids = [aws_security_group.web.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = true
    encrypted             = true
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e

    # System updates
    dnf update -y

    # Install packages
    dnf install -y httpd aws-cli amazon-cloudwatch-agent

    # Start and enable Apache
    systemctl start httpd
    systemctl enable httpd

    # Simple health check page
    cat > /var/www/html/index.html <<HTML
    <html>
      <body>
        <h1>Hello from ${local.name_prefix} instance ${count.index + 1}</h1>
        <p>Environment: ${var.environment}</p>
      </body>
    </html>
    HTML

    # Tag the instance from inside (for runtime metadata)
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
    aws ec2 create-tags --resources $INSTANCE_ID \
      --tags Key=Name,Value="${local.name_prefix}-web-${count.index + 1}" \
      --region ${var.aws_region}
  EOF
  )

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-web-${count.index + 1}"
    Role = "webserver"
  })

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [ami]   # Don't replace instance when new AMI is released
  }
}
```

### S3 Bucket

```hcl
resource "aws_s3_bucket" "app" {
  bucket = "${local.name_prefix}-app-${data.aws_caller_identity.current.account_id}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app"
  })
}

resource "aws_s3_bucket_versioning" "app" {
  bucket = aws_s3_bucket.app.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "app" {
  bucket = aws_s3_bucket.app.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "app" {
  bucket = aws_s3_bucket.app.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "app" {
  bucket = aws_s3_bucket.app.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
```

### IAM Role and Policy Attachment

```hcl
# Custom inline policy
resource "aws_iam_role_policy" "s3_read" {
  name = "${local.name_prefix}-policy-s3-read"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.app.arn,
          "${aws_s3_bucket.app.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/${var.project_name}/${var.environment}/*"
      }
    ]
  })
}
```

### RDS Database

```hcl
# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier        = "${local.name_prefix}-db"
  engine            = "mysql"
  engine_version    = var.db_config.engine_version
  instance_class    = var.db_config.instance_class
  allocated_storage = var.db_config.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = replace(var.project_name, "-", "_")
  username = var.db_config.username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  multi_az               = var.db_config.multi_az
  publicly_accessible    = false
  deletion_protection    = local.is_prod
  skip_final_snapshot    = !local.is_prod
  final_snapshot_identifier = local.is_prod ? "${local.name_prefix}-db-final-snapshot" : null

  backup_retention_period = local.is_prod ? 7 : 1
  backup_window           = "02:00-04:00"
  maintenance_window      = "sun:04:00-sun:06:00"

  performance_insights_enabled          = local.is_prod
  performance_insights_retention_period = local.is_prod ? 7 : null

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db"
  })

  lifecycle {
    prevent_destroy = false  # Set to true in prod after initial deploy
    ignore_changes  = [password]  # Manage password rotation outside Terraform
  }
}
```

---

## 9. Count vs for_each

### count — Use for identical resources distinguished by index

```hcl
# Good use of count: N identical subnets
resource "aws_subnet" "public" {
  count = 3

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "public-subnet-${count.index + 1}"
  }
}

# Reference: aws_subnet.public[0], aws_subnet.public[1], aws_subnet.public[2]
# Or all: aws_subnet.public[*].id
```

### for_each — Use for resources distinguished by a meaningful key

```hcl
# Good use of for_each: users with different permissions
variable "iam_users" {
  default = {
    alice = { groups = ["developers"], force_destroy = false }
    bob   = { groups = ["developers", "ops"], force_destroy = false }
    carol = { groups = ["ops"], force_destroy = true }
  }
}

resource "aws_iam_user" "users" {
  for_each      = var.iam_users
  name          = each.key
  force_destroy = each.value.force_destroy

  tags = {
    Name = each.key
  }
}

# Reference: aws_iam_user.users["alice"], aws_iam_user.users["bob"]
```

```hcl
# for_each with a set of strings
variable "buckets" {
  default = ["raw-data", "processed-data", "archive"]
}

resource "aws_s3_bucket" "data" {
  for_each = toset(var.buckets)

  bucket = "${local.name_prefix}-${each.key}"

  tags = {
    Name    = each.key
    Purpose = each.key
  }
}
# Reference: aws_s3_bucket.data["raw-data"].id
```

### Why for_each is Usually Better than count

If you use `count = 3` to create 3 subnets and then remove the middle one, Terraform destroys and recreates `[1]` and `[2]` because the indexes shift. With `for_each`, each resource is identified by its stable key — removing one key only deletes that specific resource.

```hcl
# count problem — removing "subnet-b" destroys subnet-c and recreates it as subnet-b
variable "subnet_names" {
  default = ["subnet-a", "subnet-b", "subnet-c"]
}
resource "aws_subnet" "count_example" {
  count = length(var.subnet_names)
  # ...
}

# for_each solution — removing "subnet-b" only affects "subnet-b"
resource "aws_subnet" "foreach_example" {
  for_each = toset(var.subnet_names)
  # ...
}
```

---

## 10. Dynamic Blocks

Dynamic blocks generate repeated nested blocks from a variable or collection — eliminating copy-paste in security group rules, EBS volumes, listeners, etc.

```hcl
variable "sg_ingress_rules" {
  description = "Ingress rules for the application security group"
  type = list(object({
    description = string
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
  }))
  default = [
    {
      description = "HTTP"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    },
    {
      description = "HTTPS"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    },
    {
      description = "Custom app port"
      from_port   = 8443
      to_port     = 8443
      protocol    = "tcp"
      cidr_blocks = ["10.0.0.0/8"]
    }
  ]
}

resource "aws_security_group" "app" {
  name   = "${local.name_prefix}-sg-app"
  vpc_id = aws_vpc.main.id

  # Dynamic block replaces repeated ingress {} blocks
  dynamic "ingress" {
    for_each = var.sg_ingress_rules
    content {
      description = ingress.value.description
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}
```

Dynamic blocks in other resources:

```hcl
# Dynamic EBS volumes on EC2
resource "aws_instance" "data" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.large"

  dynamic "ebs_block_device" {
    for_each = var.ebs_volumes   # list of {device_name, size, type}
    content {
      device_name = ebs_block_device.value.device_name
      volume_size = ebs_block_device.value.size
      volume_type = ebs_block_device.value.type
      encrypted   = true
    }
  }
}
```

---

## 11. depends_on and lifecycle

### depends_on

Terraform automatically handles dependencies by tracking resource references. Use `depends_on` only when there is a hidden dependency that Terraform cannot detect (e.g., an IAM policy must exist before a resource uses the permission).

```hcl
resource "aws_s3_bucket_object" "config" {
  bucket = aws_s3_bucket.app.id
  key    = "config/app.json"
  source = "files/app.json"

  # Explicit dependency: IAM policy must be attached before instance accesses S3
  depends_on = [aws_iam_role_policy_attachment.ssm]
}

resource "aws_ecs_service" "app" {
  name            = "my-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn

  # The listener must exist before the service can register targets
  depends_on = [aws_lb_listener.http]
}
```

### lifecycle

```hcl
resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"

  lifecycle {
    # Create new instance before destroying old one (zero-downtime replacement)
    create_before_destroy = true

    # Block terraform destroy on this resource
    prevent_destroy = true

    # Do not replace instance when AMI ID changes (patching managed separately)
    ignore_changes = [ami, user_data, tags["LastUpdated"]]

    # Condition check before destroy (Terraform 1.2+)
    precondition {
      condition     = data.aws_ami.amazon_linux.architecture == "x86_64"
      error_message = "AMI must be x86_64 architecture."
    }
  }
}

resource "aws_db_instance" "main" {
  # ...

  lifecycle {
    prevent_destroy = true           # Protects prod database from accidental destroy
    ignore_changes  = [password]     # Password managed by Secrets Manager rotation
  }
}
```

---

## 12. Terraform State

### What Is State?

The state file (`terraform.tfstate`) is a JSON file that maps your Terraform resources to real-world infrastructure objects. It stores:
- Resource IDs (instance IDs, ARNs, etc.)
- Resource attributes (IP addresses, endpoints, etc.)
- Metadata needed to track what Terraform manages

Without state, Terraform cannot know which real resources correspond to which config blocks.

### Why Remote State?

Local state is dangerous for teams:
- Two engineers running `apply` simultaneously can corrupt state
- State contains sensitive values (passwords, keys) — should not be in git
- State must be accessible to CI/CD pipelines

**Solution**: S3 backend with DynamoDB locking

### Setting Up S3 + DynamoDB Backend

First, create the resources (once, manually or with a bootstrap script):

```bash
# Create the S3 bucket
aws s3api create-bucket \
  --bucket my-terraform-state-ap-southeast-2 \
  --region ap-southeast-2 \
  --create-bucket-configuration LocationConstraint=ap-southeast-2

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket my-terraform-state-ap-southeast-2 \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket my-terraform-state-ap-southeast-2 \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-2
```

Backend configuration in `providers.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-ap-southeast-2"
    key            = "myapp/prod/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

### How Locking Works

When `terraform apply` runs, it writes a lock entry to the DynamoDB table with the current user's info. Any concurrent `apply` sees the lock and fails with an error. On completion, the lock is released.

Force-unlock (use with extreme caution):

```bash
terraform force-unlock LOCK_ID
```

---

## 13. State Commands

```bash
# List all resources in state
terraform state list
# aws_vpc.main
# aws_subnet.public[0]
# aws_subnet.public[1]
# aws_instance.web[0]

# Show detailed state for one resource
terraform state show aws_instance.web[0]
# Outputs all attributes: id, ami, public_ip, private_ip, etc.

# Remove a resource from state (does NOT destroy real resource)
# Use when you want Terraform to "forget" a resource without deleting it
terraform state rm aws_instance.web[0]

# Move a resource within state (rename without destroy/recreate)
terraform state mv aws_instance.web[0] aws_instance.app[0]

# Move resource between state files (cross-project migration)
terraform state mv -state-out=../new-project/terraform.tfstate \
  aws_vpc.main aws_vpc.main

# Import an existing real resource into state
# Syntax: terraform import <resource_address> <real_resource_id>
terraform import aws_vpc.main vpc-0a1b2c3d4e5f67890
terraform import aws_instance.web[0] i-0abc123def456789
terraform import aws_s3_bucket.app my-existing-bucket-name

# Pull current remote state to stdout
terraform state pull

# Push local state to remote (dangerous — overwrites)
terraform state push terraform.tfstate

# Show full current state as JSON
terraform show -json | jq .
```

---

## 14. Core Workflow

### terraform init

```bash
# Initialize working directory: download providers, configure backend
terraform init

# Upgrade providers to latest allowed version
terraform init -upgrade

# Reconfigure backend
terraform init -reconfigure

# Migrate state to new backend
terraform init -migrate-state
```

### terraform fmt

```bash
# Format all .tf files in current directory
terraform fmt

# Format recursively
terraform fmt -recursive

# Check format without writing (useful in CI)
terraform fmt -check -recursive
```

### terraform validate

```bash
# Validate HCL syntax and schema (does NOT call AWS APIs)
terraform validate
```

### terraform plan

```bash
# Show what changes will be made
terraform plan

# Save plan to file (for apply in CI)
terraform plan -out=tfplan

# Plan with variable overrides
terraform plan -var="environment=prod" -var-file="prod.tfvars"

# Target specific resource
terraform plan -target=aws_instance.web

# Destroy plan (shows what would be destroyed)
terraform plan -destroy
```

### terraform apply

```bash
# Prompt for confirmation then apply
terraform apply

# Auto-approve (for CI/CD — no prompt)
terraform apply -auto-approve

# Apply saved plan file (no drift between plan and apply)
terraform apply tfplan

# Apply with variable file
terraform apply -var-file="prod.tfvars" -auto-approve

# Target specific resource
terraform apply -target=aws_instance.web[0]

# Limit concurrent operations (default: 10)
terraform apply -parallelism=5
```

### terraform destroy

```bash
# Destroy all resources in state
terraform destroy

# Auto-approve
terraform destroy -auto-approve

# Destroy specific resource
terraform destroy -target=aws_db_instance.main
```

### Recommended CI/CD Pipeline Order

```bash
terraform fmt -check -recursive      # fail if unformatted
terraform init -backend-config=...   # initialize
terraform validate                   # syntax check
terraform plan -out=tfplan           # generate plan
# (manual approval gate here in CD)
terraform apply tfplan               # apply saved plan
```

---

## 15. Modules

### What Is a Module?

Any directory containing `.tf` files is a module. The root module is your working directory. Child modules are called with `module` blocks.

### Module Directory Structure

```
modules/
  vpc/
    main.tf         # resources
    variables.tf    # input variables
    outputs.tf      # outputs
    README.md       # documentation
  ec2/
    main.tf
    variables.tf
    outputs.tf
```

### Writing a Simple Module

`modules/vpc/variables.tf`:

```hcl
variable "name_prefix" {
  type = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "environment" {
  type = string
}

variable "public_subnet_count" {
  type    = number
  default = 2
}
```

`modules/vpc/main.tf`:

```hcl
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true

  tags = {
    Name        = "${var.name_prefix}-vpc"
    Environment = var.environment
  }
}

resource "aws_subnet" "public" {
  count             = var.public_subnet_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.name_prefix}-public-${count.index + 1}"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}
```

`modules/vpc/outputs.tf`:

```hcl
output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}
```

### Calling a Local Module

```hcl
module "vpc" {
  source = "./modules/vpc"

  name_prefix         = local.name_prefix
  vpc_cidr            = var.vpc_cidr
  environment         = var.environment
  public_subnet_count = 3
}

# Access module outputs
resource "aws_instance" "app" {
  subnet_id = module.vpc.public_subnet_ids[0]
  # ...
}

output "vpc_id" {
  value = module.vpc.vpc_id
}
```

### Using the Official terraform-aws-modules/vpc Module

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${local.name_prefix}-vpc"
  cidr = var.vpc_cidr

  azs             = data.aws_availability_zones.available.names
  public_subnets  = [for i in range(3) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnets = [for i in range(3) : cidrsubnet(var.vpc_cidr, 4, i + 3)]

  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = var.single_nat_gateway
  enable_dns_hostnames   = true
  enable_dns_support     = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }

  tags = local.common_tags
}

# Outputs from the community module
output "vpc_id"             { value = module.vpc.vpc_id }
output "public_subnet_ids"  { value = module.vpc.public_subnets }
output "private_subnet_ids" { value = module.vpc.private_subnets }
```

---

## 16. Workspaces

Workspaces allow multiple state files from the same configuration — useful for managing dev/staging/prod from one codebase without duplicating code.

```bash
# List workspaces (default always exists)
terraform workspace list
# * default

# Create a new workspace
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# Switch to a workspace
terraform workspace select prod

# Show current workspace
terraform workspace show
# prod

# Delete a workspace (must have no resources, and not be selected)
terraform workspace select default
terraform workspace delete dev
```

### Using terraform.workspace in Code

```hcl
locals {
  # Map workspace name to configuration
  workspace_config = {
    default = {
      instance_type = "t3.micro"
      instance_count = 1
      multi_az = false
    }
    dev = {
      instance_type  = "t3.micro"
      instance_count = 1
      multi_az       = false
    }
    staging = {
      instance_type  = "t3.small"
      instance_count = 2
      multi_az       = false
    }
    prod = {
      instance_type  = "t3.large"
      instance_count = 3
      multi_az       = true
    }
  }

  # Look up current workspace config
  config = local.workspace_config[terraform.workspace]
}

resource "aws_instance" "web" {
  count         = local.config.instance_count
  instance_type = local.config.instance_type
  # ...

  tags = {
    Name        = "web-${terraform.workspace}-${count.index + 1}"
    Workspace   = terraform.workspace
  }
}
```

### State File Per Workspace

When using S3 backend, workspaces create keys like:

```
s3://my-state-bucket/
  myapp/prod/terraform.tfstate          # default or when key= path used
  env:/dev/myapp/prod/terraform.tfstate
  env:/staging/myapp/prod/terraform.tfstate
  env:/prod/myapp/prod/terraform.tfstate
```

### Workspace vs Separate State Files

| Approach | Workspaces | Separate Directories |
|---|---|---|
| Code reuse | Single codebase | Duplicated or modules |
| Isolation | Shared providers.tf | Fully isolated |
| State | env:/ prefix in S3 | Separate S3 keys |
| Risk | Easy to apply to wrong workspace | Must cd to correct directory |
| Recommended for | Simple differences | Complex per-env config |

---

## 17. Hands-On Project: Three-Tier Web App

Complete project deploying VPC + EC2 + RDS.

### File Structure

```
my-aws-project/
  providers.tf
  variables.tf
  main.tf
  outputs.tf
  terraform.tfvars
```

### providers.tf

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state-ap-southeast-2"
    key            = "myapp/dev/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Project     = var.project_name
      Environment = var.environment
    }
  }
}
```

### variables.tf

```hcl
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-2"
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "myapp"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Must be dev, staging, or prod."
  }
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "instance_count" {
  description = "Number of web instances"
  type        = number
  default     = 2
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "myappdb"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "dbadmin"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}
```

### main.tf

```hcl
# ─── Data Sources ─────────────────────────────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_caller_identity" "current" {}

# ─── Locals ───────────────────────────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  is_prod     = var.environment == "prod"

  public_subnet_cidrs  = [for i in range(2) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnet_cidrs = [for i in range(2) : cidrsubnet(var.vpc_cidr, 4, i + 4)]
}

# ─── VPC ──────────────────────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${local.name_prefix}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name_prefix}-igw" }
}

resource "aws_subnet" "public" {
  count = length(local.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${local.name_prefix}-public-${count.index + 1}" }
}

resource "aws_subnet" "private" {
  count = length(local.private_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "${local.name_prefix}-private-${count.index + 1}" }
}

resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]
  tags       = { Name = "${local.name_prefix}-eip-nat" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]
  tags          = { Name = "${local.name_prefix}-nat" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${local.name_prefix}-rt-public" }
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
  tags = { Name = "${local.name_prefix}-rt-private" }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ─── Security Groups ──────────────────────────────────────────────────────────

resource "aws_security_group" "web" {
  name   = "${local.name_prefix}-sg-web"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-sg-web" }
}

resource "aws_security_group" "db" {
  name   = "${local.name_prefix}-sg-db"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }

  tags = { Name = "${local.name_prefix}-sg-db" }
}

# ─── IAM ──────────────────────────────────────────────────────────────────────

resource "aws_iam_role" "ec2" {
  name = "${local.name_prefix}-role-ec2"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name_prefix}-profile-ec2"
  role = aws_iam_role.ec2.name
}

# ─── EC2 ──────────────────────────────────────────────────────────────────────

resource "aws_instance" "web" {
  count = var.instance_count

  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public[count.index % length(aws_subnet.public)].id
  vpc_security_group_ids = [aws_security_group.web.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    dnf update -y
    dnf install -y httpd
    systemctl start httpd
    systemctl enable httpd
    echo "<h1>${local.name_prefix} web ${count.index + 1}</h1>" > /var/www/html/index.html
  EOF
  )

  tags = { Name = "${local.name_prefix}-web-${count.index + 1}" }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [ami]
  }
}

# ─── RDS ──────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${local.name_prefix}-db-subnet-group" }
}

resource "aws_db_instance" "main" {
  identifier        = "${local.name_prefix}-db"
  engine            = "mysql"
  engine_version    = "8.0"
  instance_class    = var.db_instance_class
  allocated_storage = 20
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  multi_az            = local.is_prod
  publicly_accessible = false
  skip_final_snapshot = true
  deletion_protection = local.is_prod

  tags = { Name = "${local.name_prefix}-db" }

  lifecycle {
    ignore_changes = [password]
  }
}
```

### outputs.tf

```hcl
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "web_instance_ids" {
  description = "EC2 instance IDs"
  value       = aws_instance.web[*].id
}

output "web_instance_public_ips" {
  description = "Public IPs of web instances"
  value       = aws_instance.web[*].public_ip
}

output "db_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.main.endpoint
}

output "db_port" {
  description = "RDS port"
  value       = aws_db_instance.main.port
}
```

### terraform.tfvars

```hcl
aws_region     = "ap-southeast-2"
project_name   = "myapp"
environment    = "dev"
vpc_cidr       = "10.0.0.0/16"
instance_type  = "t3.micro"
instance_count = 2
db_instance_class = "db.t3.micro"
db_name        = "myappdb"
db_username    = "dbadmin"
# db_password passed via TF_VAR_db_password environment variable
```

### Deploy Commands

```bash
export TF_VAR_db_password="YourSecurePassword123!"
terraform init
terraform fmt -recursive
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
terraform output web_instance_public_ips
```

---

## 18. Best Practices

### Code Organisation

- One `.tf` file per concern: `providers.tf`, `variables.tf`, `main.tf`, `outputs.tf`, `data.tf`, `locals.tf`
- Use modules for anything you deploy more than once
- Keep root module lean — delegate to child modules
- Name resources consistently: `${local.name_prefix}-<type>-<role>`

### State Management

- Always use remote state (S3 + DynamoDB) for any team or CI/CD work
- Never commit `terraform.tfstate` or `*.tfstate.backup` to git (add to `.gitignore`)
- Enable S3 versioning on the state bucket — it is your only undo
- Use separate state files per environment, not workspaces, for high-stakes prod

### Variables and Secrets

- Never put secrets in `.tfvars` files committed to git
- Use `sensitive = true` on all secret variables and outputs
- Source secrets from SSM Parameter Store or AWS Secrets Manager via data sources
- Use `TF_VAR_` environment variables for CI/CD pipelines

### Drift and Safety

- Run `terraform plan` before every `apply` — review every change
- Use `lifecycle { prevent_destroy = true }` on stateful resources in prod (RDS, S3)
- Use `lifecycle { ignore_changes = [ami] }` for resources managed with separate patching
- Set `deletion_protection = true` on RDS and other critical resources

### Modules and Reuse

- Pin module versions: `version = "~> 5.0"` not `version = ">= 5.0"`
- Use official `terraform-aws-modules` community modules where possible
- Output every ID and ARN a consumer might need
- Document modules with `description` on every variable and output

### CI/CD

```bash
# Typical pipeline
terraform fmt -check          # gate: fail if not formatted
terraform init                # download providers
terraform validate            # syntax gate
terraform plan -out=tfplan    # create plan artifact
# manual approval step
terraform apply tfplan        # apply exact plan
```

### Naming Conventions

```
<project>-<env>-<resource-type>-<role>
myapp-prod-sg-web
myapp-prod-ec2-web-1
myapp-prod-rds-main
myapp-prod-s3-assets
```

---

## 19. Interview Q&A

**Q1: What is Terraform state and why is it needed?**

State is a JSON file that maps your Terraform resource blocks to real infrastructure objects. Terraform needs it to know what already exists so it can compute the diff between desired (code) and actual (reality). Without state, Terraform would try to create everything on every run. State also stores computed attributes (IP addresses, endpoint hostnames) that are needed by dependent resources.

---

**Q2: What is the difference between count and for_each? When would you use each?**

`count` creates N identical resources identified by integer indexes (0, 1, 2). `for_each` creates resources identified by stable string keys from a map or set.

Use `count` for simple N-of-a-thing scenarios (3 EC2 instances). Use `for_each` when resources have different configurations or stable identities (users with different permissions). The critical difference: if you remove index 1 from a `count = 3` list, Terraform destroys resources [1] and [2] and recreates [2] as [1]. With `for_each`, removing a key only deletes that specific resource.

---

**Q3: How do you manage secrets in Terraform? What should you NOT do?**

You should NOT: hardcode secrets in `.tf` files, store them in `.tfvars` files committed to git, or echo them in `user_data`.

You SHOULD: use `sensitive = true` on variables, pass secrets via `TF_VAR_` environment variables in CI/CD, reference AWS Secrets Manager or SSM Parameter Store via data sources, and use OIDC-based IAM role assumption in CI/CD instead of static access keys.

---

**Q4: What is a Terraform module and why use them?**

A module is any directory containing `.tf` files. Root module is your working directory. Child modules are called with `module {}` blocks. You use modules to: (1) avoid code duplication, (2) enforce standards (every VPC gets the same security defaults), (3) abstract complexity (caller only needs to know inputs/outputs, not internal resources), (4) enable team sharing via the Terraform Registry.

---

**Q5: How does remote state with S3 + DynamoDB work?**

S3 stores the state file (versioned, encrypted). DynamoDB provides distributed locking — when `terraform apply` starts it writes a lock record to DynamoDB; any concurrent run sees the lock and aborts. When the apply finishes, the lock is deleted. S3 versioning enables rollback to any previous state version.

---

**Q6: What is the difference between terraform.tfvars and variables.tf?**

`variables.tf` declares variables — their name, type, description, and optional default. `terraform.tfvars` provides values for those variables. Think of `variables.tf` as the function signature and `terraform.tfvars` as the function call arguments. The `terraform.tfvars` file is auto-loaded; any `*.auto.tfvars` file is also auto-loaded.

---

**Q7: What does terraform import do? What are its limitations?**

`terraform import <resource_address> <real_id>` reads an existing real-world resource and adds it to your state file so Terraform can manage it. Limitation: import only writes to state — it does NOT generate the corresponding HCL configuration. You must write the config manually to match the real resource, or use `terraform plan` after import to find drift. In Terraform 1.5+, there is an `import` block that can generate config automatically.

---

**Q8: What is terraform taint and is it still used?**

`terraform taint` (deprecated in v0.15.2) marked a resource for forced recreation on the next apply. The replacement is `terraform apply -replace=aws_instance.web[0]`, which shows the replacement in the plan and requires confirmation before destroying and recreating.

---

**Q9: Explain the lifecycle meta-argument. When would you use each option?**

- `create_before_destroy = true`: Create replacement before destroying old (zero-downtime for EC2, RDS). Required when other resources depend on this one.
- `prevent_destroy = true`: Block any `terraform destroy` or config change that would destroy this resource. Use on prod RDS, S3 buckets.
- `ignore_changes = [field]`: Do not replace the resource when this field changes in code. Use `ignore_changes = [ami]` when patching EC2 outside Terraform, `ignore_changes = [password]` for DB credentials rotated by Secrets Manager.

---

**Q10: What is the difference between a resource and a data source?**

A resource (`resource` block) creates, updates, and destroys infrastructure managed by Terraform. A data source (`data` block) only reads existing infrastructure — it is read-only and never creates or changes anything. Data sources are used to reference pre-existing resources (an existing VPC), dynamic values (latest AMI ID), or external information (current AWS account ID).

---

**Q11: How do Terraform workspaces work? What are their limitations?**

Workspaces create isolated state files from a single configuration. The state file is stored at `env:/<workspace-name>/<key>` in S3. You switch with `terraform workspace select <name>` and reference in code via `terraform.workspace`.

Limitations: all workspaces share the same backend configuration and provider credentials; it is easy to accidentally apply to the wrong workspace; complex per-environment differences become hard to manage. Many teams prefer separate directories with separate state files for prod vs non-prod.

---

**Q12: What happens if two engineers run terraform apply simultaneously?**

With local state: state file corruption — both writes race to overwrite the same file. This is why local state is unacceptable for teams.

With S3 + DynamoDB: the first `apply` acquires the DynamoDB lock. The second `apply` reads the lock and immediately fails with a "state locked" error showing who holds the lock. Engineers must wait or use `terraform force-unlock` if the lock is stale (e.g., apply was killed mid-run).

---

**Q13: How do you structure Terraform for multiple environments (dev/staging/prod)?**

Option 1 — Workspaces: single directory, `terraform workspace select prod`, use `terraform.workspace` in locals to vary config. Simple but risky (easy wrong-workspace apply).

Option 2 — Separate directories with shared modules (recommended for prod isolation):
```
environments/
  dev/
    main.tf   # calls module "../modules/app" with dev vars
  prod/
    main.tf   # calls module "../modules/app" with prod vars
modules/
  app/
    main.tf   # actual resources
```

---

**Q14: What is the depends_on meta-argument and when should you use it?**

`depends_on` forces Terraform to create or destroy resources in a specific order, beyond what it can infer from resource references. Use it only for hidden dependencies that are not expressed through resource attribute references — for example, an IAM policy must be created and propagated before a Lambda can invoke another service, even though the Lambda resource block does not directly reference the IAM policy resource.

Overusing `depends_on` slows plans and applies (breaks parallelism) and indicates the dependency should probably be an explicit reference instead.

---

**Q15: How would you refactor existing manually-created AWS infrastructure to be managed by Terraform?**

1. Write the Terraform configuration that describes the existing resources
2. Run `terraform import <address> <id>` for each resource to pull it into state
3. Run `terraform plan` — ideally it shows "No changes" meaning code matches reality
4. Fix any drift identified by plan (differences between code and real config)
5. Add `lifecycle { prevent_destroy = true }` on critical resources before considering the import complete
6. For large estates, use tools like `terraformer` or the AWS `tf-codegen` tool to generate initial HCL from existing resources, then refine

---

*End of Terraform Complete Guide*
