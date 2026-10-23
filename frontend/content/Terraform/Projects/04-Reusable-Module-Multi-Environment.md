# Project 4 — Reusable Module Across Dev/Staging/Prod

**Level:** Intermediate
**Time estimate:** 90 – 120 minutes
**Phase prerequisite:** Phase 6 – Modules, Phase 7 – Workspaces & Environments

---

## Overview

You will take the web-tier + RDS infrastructure from Project 3 and extract it into a **local reusable module**, then instantiate that module three times — once each for `dev`, `staging`, and `prod` — with:

- Environment-specific `.tfvars` files (different instance sizes, different subnet CIDRs)
- **Separate remote state files per environment**, using distinct S3 backend keys, so a mistake in `dev` can never touch `prod` state
- A single source of truth for the infrastructure pattern itself, so a bug fix or improvement in the module benefits all three environments the next time they run `terraform apply`

This is the pattern that lets a small team safely manage many environments from one codebase.

```
terraform-multi-env/
├── modules/
│   └── app-infra/            ← the reusable module (network + web + db)
└── environments/
    ├── dev/       → backend key: env/dev/terraform.tfstate
    ├── staging/   → backend key: env/staging/terraform.tfstate
    └── prod/      → backend key: env/prod/terraform.tfstate
```

---

## Prerequisites

- Terraform >= 1.5 and AWS credentials configured
- Completed Project 3, or equivalent familiarity with the VPC/web/RDS resources being modularized
- An S3 bucket for remote state and a DynamoDB table for state locking (create these once, outside Terraform — see Step 1)
- An existing EC2 key pair

---

## Step-by-Step Instructions

### Step 1 — Create the state backend resources (one-time, outside Terraform)

State-storage infrastructure is usually created manually or via a separate "bootstrap" configuration, since your environments' own Terraform can't create the bucket it depends on to store its own state.

```bash
aws s3api create-bucket --bucket my-terraform-state-demo --region us-east-1
aws s3api put-bucket-versioning --bucket my-terraform-state-demo \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### Step 2 — Create the directory tree

```bash
mkdir -p terraform-multi-env/modules/app-infra
mkdir -p terraform-multi-env/environments/{dev,staging,prod}
cd terraform-multi-env
```

### Step 3 — Build the module: `modules/app-infra/variables.tf`

```hcl
variable "project_name" {
  type = string
}

variable "environment" {
  description = "dev | staging | prod — used for naming and tagging"
  type        = string
}

variable "vpc_cidr" {
  type = string
}

variable "public_subnet_cidrs" {
  type = list(string)
}

variable "private_subnet_cidrs" {
  type = list(string)
}

variable "availability_zones" {
  type = list(string)
}

variable "instance_type" {
  type = string
}

variable "web_instance_count" {
  type    = number
  default = 2
}

variable "db_instance_class" {
  type = string
}

variable "key_name" {
  type = string
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
  type      = string
  sensitive = true
}
```

### Step 4 — Module: `modules/app-infra/main.tf`

```hcl
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-vpc"
    Environment = var.environment
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-${var.environment}-igw" }
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-${var.environment}-public-${count.index}" }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "${var.project_name}-${var.environment}-private-${count.index}" }
}

resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]

  tags = { Name = "${var.project_name}-${var.environment}-nat" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-${var.environment}-public-rt" }
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

  tags = { Name = "${var.project_name}-${var.environment}-private-rt" }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "web_sg" {
  name        = "${var.project_name}-${var.environment}-web-sg"
  description = "Web tier"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-${var.environment}-web-sg" }
}

resource "aws_instance" "web" {
  count                  = var.web_instance_count
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = aws_subnet.public[count.index % length(aws_subnet.public)].id
  vpc_security_group_ids = [aws_security_group.web_sg.id]

  user_data = <<-EOF
    #!/bin/bash
    dnf install -y httpd
    systemctl enable httpd
    systemctl start httpd
    echo "<h1>${var.environment} web-${count.index}</h1>" > /var/www/html/index.html
  EOF

  tags = {
    Name        = "${var.project_name}-${var.environment}-web-${count.index}"
    Environment = var.environment
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "db_sg" {
  name        = "${var.project_name}-${var.environment}-db-sg"
  description = "Database tier"
  vpc_id      = aws_vpc.main.id

  ingress {
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

  tags = { Name = "${var.project_name}-${var.environment}-db-sg" }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-${var.environment}-mysql"
  engine         = "mysql"
  engine_version = "8.0"
  instance_class = var.db_instance_class

  allocated_storage   = 20
  storage_type        = "gp3"
  storage_encrypted   = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]

  multi_az            = var.environment == "prod" ? true : false
  publicly_accessible = false
  skip_final_snapshot = var.environment == "prod" ? false : true
  final_snapshot_identifier = var.environment == "prod" ? "${var.project_name}-prod-final-snapshot" : null
  deletion_protection = var.environment == "prod" ? true : false

  tags = { Name = "${var.project_name}-${var.environment}-mysql", Environment = var.environment }
}
```

> Notice the `var.environment == "prod" ? ... : ...` conditionals — a single module definition safely produces a hardened Multi-AZ, snapshot-protected database in `prod` and a cheap, disposable one in `dev`, purely from input variables.

### Step 5 — Module: `modules/app-infra/outputs.tf`

```hcl
output "web_public_ips" {
  value = aws_instance.web[*].public_ip
}

output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "vpc_id" {
  value = aws_vpc.main.id
}
```

### Step 6 — Environment root: `environments/dev/main.tf`

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state-demo"
    key            = "env/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"
}

module "app_infra" {
  source = "../../modules/app-infra"

  project_name          = var.project_name
  environment           = "dev"
  vpc_cidr              = var.vpc_cidr
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  availability_zones    = var.availability_zones
  instance_type         = var.instance_type
  web_instance_count    = var.web_instance_count
  db_instance_class     = var.db_instance_class
  key_name              = var.key_name
  db_password           = var.db_password
}
```

`environments/dev/variables.tf` (identical file is copied into `staging/` and `prod/` — only the `.tfvars` values differ):

```hcl
variable "project_name"          { type = string }
variable "vpc_cidr"              { type = string }
variable "public_subnet_cidrs"   { type = list(string) }
variable "private_subnet_cidrs" { type = list(string) }
variable "availability_zones"    { type = list(string) }
variable "instance_type"         { type = string }
variable "web_instance_count"    { type = number }
variable "db_instance_class"     { type = string }
variable "key_name"              { type = string }

variable "db_password" {
  type      = string
  sensitive = true
}
```

`environments/dev/outputs.tf`:

```hcl
output "web_public_ips" { value = module.app_infra.web_public_ips }
output "db_endpoint"    { value = module.app_infra.db_endpoint }
```

### Step 7 — Per-environment `.tfvars` files

`environments/dev/dev.tfvars`:

```hcl
project_name          = "myapp"
vpc_cidr              = "10.10.0.0/16"
public_subnet_cidrs   = ["10.10.1.0/24", "10.10.2.0/24"]
private_subnet_cidrs  = ["10.10.11.0/24", "10.10.12.0/24"]
availability_zones    = ["us-east-1a", "us-east-1b"]
instance_type         = "t3.micro"
web_instance_count    = 1
db_instance_class     = "db.t3.micro"
key_name              = "my-terraform-key"
```

`environments/staging/staging.tfvars`:

```hcl
project_name          = "myapp"
vpc_cidr              = "10.20.0.0/16"
public_subnet_cidrs   = ["10.20.1.0/24", "10.20.2.0/24"]
private_subnet_cidrs  = ["10.20.11.0/24", "10.20.12.0/24"]
availability_zones    = ["us-east-1a", "us-east-1b"]
instance_type         = "t3.small"
web_instance_count    = 2
db_instance_class     = "db.t3.small"
key_name              = "my-terraform-key"
```

`environments/prod/prod.tfvars`:

```hcl
project_name          = "myapp"
vpc_cidr              = "10.30.0.0/16"
public_subnet_cidrs   = ["10.30.1.0/24", "10.30.2.0/24"]
private_subnet_cidrs  = ["10.30.11.0/24", "10.30.12.0/24"]
availability_zones    = ["us-east-1a", "us-east-1b"]
instance_type         = "t3.medium"
web_instance_count    = 3
db_instance_class     = "db.t3.medium"
key_name              = "my-terraform-key-prod"
```

Copy `main.tf`, `variables.tf`, and `outputs.tf` from `environments/dev/` into `environments/staging/` and `environments/prod/`, updating only:
- the backend `key` (`env/staging/...`, `env/prod/...`)
- the `environment = "staging"` / `"prod"` literal inside the `module "app_infra"` block

### Step 8 — Apply each environment independently

Each environment is a **separate root module with its own state file** — this is the key safety property. Apply `dev` first to validate the module works before touching `prod`:

```bash
export TF_VAR_db_password='DevPassword123!'
cd environments/dev
terraform init
terraform plan -var-file="dev.tfvars" -out=tfplan
terraform apply tfplan
```

```bash
export TF_VAR_db_password='StagingPassword123!'
cd ../staging
terraform init
terraform plan -var-file="staging.tfvars" -out=tfplan
terraform apply tfplan
```

```bash
export TF_VAR_db_password='ProdPassword123!VeryStrong'
cd ../prod
terraform init
terraform plan -var-file="prod.tfvars" -out=tfplan
terraform apply tfplan
```

---

## Expected Result

- Three fully independent stacks — `dev`, `staging`, `prod` — each with its own VPC, web tier, and RDS instance, all built from the exact same `modules/app-infra` source.
- Three separate state files in S3: `env/dev/terraform.tfstate`, `env/staging/terraform.tfstate`, `env/prod/terraform.tfstate` — running `terraform destroy` in `dev` has zero effect on `staging` or `prod` state.
- `prod`'s database has `multi_az = true`, `deletion_protection = true`, and `skip_final_snapshot = false` — all derived automatically from the module's `environment == "prod"` conditionals, with no copy-pasted, drifted logic.

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Separate state files exist | `aws s3 ls s3://my-terraform-state-demo/env/ --recursive` | Three `.tfstate` objects, one per environment |
| Dev and prod VPCs don't overlap | `terraform output -raw` in each env, compare `vpc_id`/CIDR | Different VPC IDs and non-overlapping CIDRs |
| Prod DB is Multi-AZ | `aws rds describe-db-instances --db-instance-identifier myapp-prod-mysql --query "DBInstances[0].MultiAZ"` | `true` |
| Dev DB is single-AZ | `aws rds describe-db-instances --db-instance-identifier myapp-dev-mysql --query "DBInstances[0].MultiAZ"` | `false` |
| State isolation | `cd environments/dev && terraform destroy`, then check staging/prod | Staging and prod resources still running, unaffected |

---

## Tear Down

Destroy environments in reverse order of importance — `dev` and `staging` first, `prod` last (and only if you truly want to delete it, given `deletion_protection = true`):

```bash
cd environments/dev     && terraform destroy -var-file="dev.tfvars"
cd ../staging            && terraform destroy -var-file="staging.tfvars"
cd ../prod
terraform apply -var-file="prod.tfvars" \
  -var="db_password=$TF_VAR_db_password" # first flip deletion_protection off if needed
terraform destroy -var-file="prod.tfvars"
```

Finally, clean up the bootstrap resources if you no longer need them:

```bash
aws dynamodb delete-table --table-name terraform-locks
aws s3 rb s3://my-terraform-state-demo --force
```

---

## Stretch Goals

1. **Terraform Workspaces instead of directories** — refactor to use `terraform workspace new dev/staging/prod` with a single root module and `terraform.workspace` interpolated into resource names, and compare the trade-offs against the directory-per-environment approach used here.
2. **Module versioning** — move `modules/app-infra` into its own git repository and reference it with a `source = "git::https://.../app-infra.git?ref=v1.0.0"` so environments can upgrade the module deliberately rather than always tracking `main`.
3. **`for_each` over a map of environments** — in a single root module, replace three separate environment directories with one root that uses `for_each` over a map of environment configs (careful: this reintroduces shared state, so discuss why the exercise in this project deliberately avoided it).
4. **Remote state data source** — in a hypothetical fourth "shared services" environment, use `terraform_remote_state` to read the `prod` VPC ID output without duplicating it as a variable.
5. **Policy as code** — add a `variable validation` block on `environment` restricting it to `["dev", "staging", "prod"]`, and add an Open Policy Agent / Sentinel-style check (described conceptually) that blocks `terraform apply` in `prod` outside business hours.
