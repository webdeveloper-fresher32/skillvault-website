# Advanced AWS Projects

These projects require solid understanding of intermediate concepts. Each project mirrors real-world production architectures.

---

## Project 1: Dockerized App on ECS Fargate

**Goal:** Containerize a Node.js application and deploy it to ECS Fargate with ALB, ECR for image storage, and CloudWatch for logging.

**Services:** ECS, ECR, Fargate, ALB, CloudWatch, IAM
**Time:** 3–5 hours
**Cost:** ~$3–8

---

### Step 1: Application and Dockerfile

Create the application directory:

```bash
mkdir -p ecs-demo/src && cd ecs-demo
```

**`src/app.js`:**
```javascript
const express = require('express');
const os = require('os');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

app.get('/', (req, res) => {
    res.json({
        message: 'Running on ECS Fargate!',
        version: APP_VERSION,
        environment: ENVIRONMENT,
        hostname: os.hostname(),
        pid: process.pid,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

app.get('/env', (req, res) => {
    res.json({
        NODE_ENV: process.env.NODE_ENV,
        ENVIRONMENT: process.env.ENVIRONMENT,
        hostname: os.hostname()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({
        level: 'info',
        message: `Server started on port ${PORT}`,
        version: APP_VERSION,
        environment: ENVIRONMENT,
        timestamp: new Date().toISOString()
    }));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
```

**`package.json`:**
```json
{
  "name": "ecs-demo-app",
  "version": "1.0.0",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "test": "echo 'No tests yet' && exit 0"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**`Dockerfile`:**
```dockerfile
# Build stage: install dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# ────────────────────────────────────────
# Production stage: minimal final image
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodeuser:nodejs src/ ./src/
COPY --chown=nodeuser:nodejs package.json ./

# Switch to non-root user
USER nodeuser

# Expose application port
EXPOSE 3000

# Health check (Docker will mark container unhealthy if this fails)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Run the application
CMD ["node", "src/app.js"]
```

**`.dockerignore`:**
```
node_modules
.git
.gitignore
*.md
.env*
Dockerfile
.dockerignore
```

```bash
# Test Docker build locally
docker build -t ecs-demo:local .
docker run -p 3000:3000 -e ENVIRONMENT=local ecs-demo:local
curl http://localhost:3000/health
```

### Step 2: Create ECR Repository and Push Image

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
REPO_NAME=ecs-demo-app

# Create ECR repository
aws ecr create-repository \
  --repository-name $REPO_NAME \
  --region $REGION \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME"
echo "ECR URI: $ECR_URI"

# Authenticate Docker to ECR
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ECR_URI

# Build, tag, and push
docker build -t $REPO_NAME:latest .
docker tag $REPO_NAME:latest $ECR_URI:latest
docker tag $REPO_NAME:latest $ECR_URI:v1.0.0

docker push $ECR_URI:latest
docker push $ECR_URI:v1.0.0

echo "Image pushed to ECR: $ECR_URI:latest"

# Verify image is in ECR
aws ecr list-images --repository-name $REPO_NAME
```

### Step 3: Create ECS Infrastructure

```bash
# Create CloudWatch log group for ECS logs
aws logs create-log-group \
  --log-group-name /ecs/ecs-demo-app \
  --retention-in-days 7

# Create IAM role for ECS Task Execution (allows ECS to pull images and write logs)
cat > ecs-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

EXEC_ROLE_ARN=$(aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://ecs-trust.json \
  --query 'Role.Arn' \
  --output text)

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

echo "ECS Execution Role: $EXEC_ROLE_ARN"

# Create ECS Cluster
CLUSTER_ARN=$(aws ecs create-cluster \
  --cluster-name my-fargate-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1 \
  --query 'cluster.clusterArn' \
  --output text)

echo "ECS Cluster ARN: $CLUSTER_ARN"
```

### Step 4: Register Task Definition

```bash
cat > task-definition.json << EOF
{
  "family": "ecs-demo-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$EXEC_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "ecs-demo-app",
      "image": "$ECR_URI:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "ENVIRONMENT", "value": "production" },
        { "name": "APP_VERSION", "value": "1.0.0" },
        { "name": "NODE_ENV", "value": "production" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ecs-demo-app",
          "awslogs-region": "$REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 10
      },
      "essential": true,
      "readonlyRootFilesystem": false,
      "stopTimeout": 30
    }
  ]
}
EOF

TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "Task Definition ARN: $TASK_DEF_ARN"
```

### Step 5: Create ALB and ECS Service

```bash
# Get VPC and subnet information (using default VPC for simplicity)
VPC_ID=$(aws ec2 describe-vpcs --filters 'Name=isDefault,Values=true' \
  --query 'Vpcs[0].VpcId' --output text)

SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=mapPublicIpOnLaunch,Values=true" \
  --query 'Subnets[*].SubnetId' --output text | tr '\t' ' ')

# Create security groups
ALB_SG=$(aws ec2 create-security-group \
  --group-name ecs-alb-sg \
  --description "ECS ALB Security Group" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $ALB_SG \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

ECS_SG=$(aws ec2 create-security-group \
  --group-name ecs-tasks-sg \
  --description "ECS Tasks Security Group" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $ECS_SG \
  --protocol tcp --port 3000 --source-group $ALB_SG

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name ecs-demo-alb \
  --subnets $SUBNETS \
  --security-groups $ALB_SG \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Create Target Group (IP target type for Fargate)
TG_ARN=$(aws elbv2 create-target-group \
  --name ecs-demo-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Create Listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# Create ECS Service
SUBNET_LIST=$(echo $SUBNETS | tr ' ' ',')

aws ecs create-service \
  --cluster my-fargate-cluster \
  --service-name ecs-demo-service \
  --task-definition ecs-demo-app \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_LIST],securityGroups=[$ECS_SG],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=ecs-demo-app,containerPort=3000" \
  --health-check-grace-period-seconds 60

echo "Service created! ALB DNS: $ALB_DNS"

# Wait for service to stabilize
aws ecs wait services-stable \
  --cluster my-fargate-cluster \
  --services ecs-demo-service

echo "Service is stable. Test: curl http://$ALB_DNS"
```

### Step 6: Update Deployment (New Image)

```bash
# Make a code change, then:

# Build new version
docker build -t $ECR_URI:v1.1.0 .
docker push $ECR_URI:v1.1.0

# Update task definition with new image
sed 's|:latest|:v1.1.0|g' task-definition.json > task-definition-v2.json

NEW_TASK_DEF=$(aws ecs register-task-definition \
  --cli-input-json file://task-definition-v2.json \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

# Update service to use new task definition (triggers rolling deployment)
aws ecs update-service \
  --cluster my-fargate-cluster \
  --service ecs-demo-service \
  --task-definition $NEW_TASK_DEF

# Monitor deployment
aws ecs wait services-stable \
  --cluster my-fargate-cluster \
  --services ecs-demo-service

echo "Update deployed successfully"

# View logs in CloudWatch
aws logs tail /ecs/ecs-demo-app --follow
```

---

## Project 2: Terraform Complete Infrastructure

**Goal:** Provision a complete AWS infrastructure using Terraform with remote state in S3 and DynamoDB state locking.

**Services:** Terraform, VPC, EC2, S3, DynamoDB, IAM
**Time:** 4–6 hours
**Cost:** ~$1–3

---

### Prerequisites

```bash
# Install Terraform
brew install terraform

# Or on Linux:
curl -fsSL https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip -o terraform.zip
unzip terraform.zip && sudo mv terraform /usr/local/bin/

terraform version
```

### Directory Structure

```
terraform-infra/
├── providers.tf
├── variables.tf
├── main.tf
├── outputs.tf
└── terraform.tfvars
```

### `providers.tf`

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state backend in S3
  # Create the S3 bucket and DynamoDB table manually before running terraform init
  backend "s3" {
    bucket         = "terraform-state-YOUR_ACCOUNT_ID"   # Change this
    key            = "projects/infra/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"   # For state locking
  }
}

provider "aws" {
  region = var.region

  # Default tags applied to all resources
  default_tags {
    tags = {
      Project     = "TerraformInfra"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
```

### `variables.tf`

```hcl
variable "region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"

  validation {
    condition     = contains(["t3.micro", "t3.small", "t3.medium", "t3.large"], var.instance_type)
    error_message = "Instance type must be a t3 family type."
  }
}

variable "key_pair_name" {
  description = "Name of the EC2 key pair for SSH access"
  type        = string
  default     = "my-ec2-key"
}
```

### `main.tf`

```hcl
# ─────────────────────────────────────────────
# DATA SOURCES
# ─────────────────────────────────────────────

# Get available AZs in the region
data "aws_availability_zones" "available" {
  state = "available"
}

# Get the latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
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

# ─────────────────────────────────────────────
# VPC
# ─────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.environment}-vpc"
  }
}

# ─────────────────────────────────────────────
# SUBNETS
# ─────────────────────────────────────────────

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.environment}-public-subnet-${count.index + 1}"
    Tier = "Public"
  }
}

resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.environment}-private-subnet-${count.index + 1}"
    Tier = "Private"
  }
}

# ─────────────────────────────────────────────
# INTERNET GATEWAY
# ─────────────────────────────────────────────

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.environment}-igw"
  }
}

# ─────────────────────────────────────────────
# NAT GATEWAY
# ─────────────────────────────────────────────

resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name = "${var.environment}-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]

  tags = {
    Name = "${var.environment}-nat-gw"
  }
}

# ─────────────────────────────────────────────
# ROUTE TABLES
# ─────────────────────────────────────────────

# Public route table (routes to IGW)
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.environment}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private route table (routes to NAT GW)
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.environment}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ─────────────────────────────────────────────
# SECURITY GROUPS
# ─────────────────────────────────────────────

resource "aws_security_group" "bastion" {
  name        = "${var.environment}-bastion-sg"
  description = "Security group for bastion host"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH from anywhere (restrict to your IP in production)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Tighten this to your IP in production
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.environment}-bastion-sg"
  }
}

resource "aws_security_group" "app" {
  name        = "${var.environment}-app-sg"
  description = "Security group for application servers"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "SSH from bastion"
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  ingress {
    description = "HTTP from VPC"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.environment}-app-sg"
  }
}

# ─────────────────────────────────────────────
# EC2 INSTANCES
# ─────────────────────────────────────────────

resource "aws_instance" "bastion" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.bastion.id]

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 8
    delete_on_termination = true
    encrypted             = true
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    yum update -y
    echo "Bastion host is ready" > /home/ec2-user/ready.txt
  EOF
  )

  tags = {
    Name = "${var.environment}-bastion"
    Role = "Bastion"
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.app.id]

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = true
    encrypted             = true
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    yum update -y
    yum install -y nginx
    systemctl start nginx
    systemctl enable nginx
    echo "<h1>Deployed by Terraform - ${var.environment}</h1>" > /usr/share/nginx/html/index.html
  EOF
  )

  tags = {
    Name = "${var.environment}-app-server"
    Role = "Application"
  }
}
```

### `outputs.tf`

```hcl
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "bastion_public_ip" {
  description = "Public IP of the bastion host"
  value       = aws_instance.bastion.public_ip
}

output "app_private_ip" {
  description = "Private IP of the application server"
  value       = aws_instance.app.private_ip
}

output "nat_gateway_ip" {
  description = "Elastic IP of the NAT Gateway"
  value       = aws_eip.nat.public_ip
}

output "ami_id" {
  description = "AMI ID used for EC2 instances"
  value       = data.aws_ami.amazon_linux_2023.id
}

output "ssh_command" {
  description = "SSH command to connect to bastion"
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${aws_instance.bastion.public_ip}"
}
```

### `terraform.tfvars`

```hcl
region               = "us-east-1"
environment          = "dev"
vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.20.0/24"]
instance_type        = "t3.micro"
key_pair_name        = "my-ec2-key"
```

### Setup Backend and Deploy

```bash
# First, create the S3 bucket and DynamoDB table for Terraform state
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create S3 bucket for state
aws s3 mb s3://terraform-state-$ACCOUNT_ID --region us-east-1
aws s3api put-bucket-versioning \
  --bucket terraform-state-$ACCOUNT_ID \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption \
  --bucket terraform-state-$ACCOUNT_ID \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Update providers.tf with your account ID
sed -i "s/YOUR_ACCOUNT_ID/$ACCOUNT_ID/g" providers.tf

# Initialize Terraform (downloads providers, sets up backend)
terraform init

# Review the execution plan
terraform plan -var-file=terraform.tfvars

# Apply the infrastructure
terraform apply -var-file=terraform.tfvars
# Type 'yes' when prompted

# View outputs
terraform output

# Destroy everything when done
terraform destroy -var-file=terraform.tfvars
```

---

## Project 3: GitHub Actions CI/CD to ECS

**Goal:** Fully automated CI/CD pipeline that builds a Docker image, pushes it to ECR, and deploys it to ECS on every push to main.

**Services:** ECS, ECR, GitHub Actions, IAM (OIDC)
**Time:** 4–5 hours

---

### IAM Setup

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
GITHUB_ORG=your-github-username
REPO_NAME=your-repo-name

# Create OIDC provider (if not already created)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 2>/dev/null || echo "OIDC provider already exists"

# Trust policy — only your specific repo can assume this role
cat > github-oidc-trust.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:$GITHUB_ORG/$REPO_NAME:ref:refs/heads/main"
        }
      }
    }
  ]
}
EOF

# Permissions policy — what this role can do
cat > github-ecs-permissions.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "ECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "arn:aws:ecr:$REGION:$ACCOUNT_ID:repository/ecs-demo-app"
    },
    {
      "Sid": "ECSDeployment",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "ecs-tasks.amazonaws.com"
        }
      }
    }
  ]
}
EOF

# Create the role
GH_ROLE_ARN=$(aws iam create-role \
  --role-name GitHubActionsECSRole \
  --assume-role-policy-document file://github-oidc-trust.json \
  --query 'Role.Arn' \
  --output text)

aws iam put-role-policy \
  --role-name GitHubActionsECSRole \
  --policy-name ECSDeployPolicy \
  --policy-document file://github-ecs-permissions.json

echo "GitHub Actions Role ARN: $GH_ROLE_ARN"
```

### `.github/workflows/deploy.yml`

```yaml
name: CI/CD to ECS

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: ecs-demo-app
  ECS_CLUSTER: my-fargate-cluster
  ECS_SERVICE: ecs-demo-service
  CONTAINER_NAME: ecs-demo-app
  TASK_DEFINITION_FAMILY: ecs-demo-app

jobs:
  # ─────────────────────────────────────────
  # TEST JOB
  # ─────────────────────────────────────────
  test:
    name: Run Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint --if-present

      - name: Run tests
        run: npm test --if-present

  # ─────────────────────────────────────────
  # BUILD & DEPLOY JOB (main branch only)
  # ─────────────────────────────────────────
  deploy:
    name: Build and Deploy
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    permissions:
      id-token: write    # Required for OIDC token
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsECSRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Set image tag
        id: image-tag
        run: |
          TIMESTAMP=$(date +%Y%m%d%H%M%S)
          SHORT_SHA=${GITHUB_SHA:0:8}
          IMAGE_TAG="${TIMESTAMP}-${SHORT_SHA}"
          echo "IMAGE_TAG=$IMAGE_TAG" >> $GITHUB_ENV
          echo "tag=$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Build Docker image
        run: |
          docker build \
            --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
            --build-arg VERSION=${{ env.IMAGE_TAG }} \
            -t ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ env.IMAGE_TAG }} \
            -t ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest \
            .

      - name: Run Trivy security scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ env.IMAGE_TAG }}
          format: 'table'
          exit-code: '0'   # Set to '1' to fail on vulnerabilities
          severity: 'CRITICAL,HIGH'

      - name: Push image to ECR
        run: |
          docker push ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ env.IMAGE_TAG }}
          docker push ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest
          echo "IMAGE=${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ env.IMAGE_TAG }}" >> $GITHUB_ENV

      - name: Download current task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition ${{ env.TASK_DEFINITION_FAMILY }} \
            --query taskDefinition \
            > task-definition.json

      - name: Render updated task definition with new image
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ env.IMAGE }}

      - name: Deploy updated task definition to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
          wait-for-minutes: 10

      - name: Notify Slack on success
        if: success()
        uses: slackapi/slack-github-action@v1.26.0
        with:
          payload: |
            {
              "text": ":white_check_mark: *Deployment Succeeded*",
              "attachments": [{
                "color": "good",
                "fields": [
                  { "title": "Repository", "value": "${{ github.repository }}", "short": true },
                  { "title": "Branch", "value": "${{ github.ref_name }}", "short": true },
                  { "title": "Commit", "value": "<https://github.com/${{ github.repository }}/commit/${{ github.sha }}|${{ github.sha }}>" },
                  { "title": "Image Tag", "value": "${{ env.IMAGE_TAG }}", "short": true },
                  { "title": "Deployed By", "value": "${{ github.actor }}", "short": true }
                ]
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK

      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1.26.0
        with:
          payload: |
            {
              "text": ":x: *Deployment FAILED*",
              "attachments": [{
                "color": "danger",
                "fields": [
                  { "title": "Repository", "value": "${{ github.repository }}", "short": true },
                  { "title": "Branch", "value": "${{ github.ref_name }}", "short": true },
                  { "title": "Workflow Run", "value": "<https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Logs>" }
                ]
              }]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
```

### Required GitHub Secrets

In your repo: Settings → Secrets and variables → Actions → New repository secret:
- `AWS_ACCOUNT_ID` — your 12-digit AWS account ID
- `SLACK_WEBHOOK_URL` — from Slack → Incoming Webhooks app (optional)

---

## Project 4: EKS Kubernetes Deployment

**Goal:** Deploy a Node.js application to Kubernetes on EKS with auto-scaling, ingress, config management, and CloudWatch monitoring.

**Services:** EKS, ALB Controller, CloudWatch, HPA, IAM
**Time:** 5–8 hours
**Cost:** ~$5–15 (EKS control plane = $0.10/hr)

---

### Step 1: Create EKS Cluster

```bash
# Install eksctl
curl --silent --location \
  "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | \
  tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Create EKS cluster (takes ~15 minutes)
eksctl create cluster \
  --name my-eks-cluster \
  --region us-east-1 \
  --version 1.29 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed \
  --with-oidc \
  --ssh-access \
  --ssh-public-key my-ec2-key \
  --full-ecr-access \
  --alb-ingress-access

# Verify cluster
kubectl get nodes
kubectl get nodes -o wide
kubectl cluster-info
```

### Step 2: Install AWS Load Balancer Controller

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CLUSTER_NAME=my-eks-cluster
REGION=us-east-1

# Download IAM policy for ALB controller
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.1/docs/install/iam_policy.json

# Create IAM policy
aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json

# Create service account with IAM role
eksctl create iamserviceaccount \
  --cluster=$CLUSTER_NAME \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::$ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install ALB controller with Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=$CLUSTER_NAME \
  --set serviceAccountName=aws-load-balancer-controller \
  --set region=$REGION \
  --set vpcId=$(aws eks describe-cluster --name $CLUSTER_NAME \
    --query 'cluster.resourcesVpcConfig.vpcId' --output text)

# Verify controller is running
kubectl get deployment -n kube-system aws-load-balancer-controller
```

### Kubernetes YAML Files

**`k8s/configmap.yaml`** — Application configuration:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  APP_NAME: "eks-demo"
```

**`k8s/secret.yaml`** — Sensitive data:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: default
type: Opaque
data:
  # Values must be base64 encoded: echo -n "myvalue" | base64
  DB_PASSWORD: bXlzZWN1cmVwYXNzd29yZA==   # mysecurepassword
  API_KEY: bXlhcGlrZXkxMjM=               # myapikey123
```

**`k8s/deployment.yaml`** — App deployment:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodejs-app
  namespace: default
  labels:
    app: nodejs-app
    version: "1.0.0"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nodejs-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0    # Zero-downtime rolling update
  template:
    metadata:
      labels:
        app: nodejs-app
        version: "1.0.0"
    spec:
      containers:
        - name: nodejs-app
          image: YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ecs-demo-app:latest
          ports:
            - containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets
          resources:
            requests:
              cpu: "100m"        # 0.1 vCPU
              memory: "128Mi"
            limits:
              cpu: "500m"        # 0.5 vCPU
              memory: "256Mi"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 5"]   # Graceful shutdown
      terminationGracePeriodSeconds: 30
```

**`k8s/service.yaml`** — Service (internal load balancing):
```yaml
apiVersion: v1
kind: Service
metadata:
  name: nodejs-app-service
  namespace: default
  labels:
    app: nodejs-app
spec:
  type: ClusterIP    # Internal only — Ingress handles external access
  selector:
    app: nodejs-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
```

**`k8s/hpa.yaml`** — Horizontal Pod Autoscaler:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nodejs-app-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nodejs-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60    # Scale when average CPU > 60%
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80    # Scale when average memory > 80%
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300    # Wait 5 min before scaling down
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0      # Scale up immediately
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
```

**`k8s/ingress.yaml`** — ALB Ingress:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nodejs-app-ingress
  namespace: default
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}]'
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: "30"
    alb.ingress.kubernetes.io/healthy-threshold-count: "2"
    alb.ingress.kubernetes.io/unhealthy-threshold-count: "3"
spec:
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nodejs-app-service
                port:
                  number: 80
```

### Deploy to Kubernetes

```bash
# Apply all manifests in order
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml

# Watch the deployment roll out
kubectl rollout status deployment/nodejs-app

# Check everything is running
kubectl get pods -o wide
kubectl get services
kubectl get hpa
kubectl get ingress

# Wait for ALB to be provisioned
kubectl get ingress nodejs-app-ingress --watch

# Get the ALB DNS name
ALB_DNS=$(kubectl get ingress nodejs-app-ingress \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "App URL: http://$ALB_DNS"

curl http://$ALB_DNS/health
```

### CloudWatch Container Insights

```bash
# Install CloudWatch agent and Fluent Bit
ClusterName=my-eks-cluster
RegionName=us-east-1

# Create namespace
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cloudwatch-namespace.yaml

# Create service account
eksctl create iamserviceaccount \
  --name cloudwatch-agent \
  --namespace amazon-cloudwatch \
  --cluster $ClusterName \
  --attach-policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy \
  --approve

# Deploy Container Insights
curl https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluentd-quickstart.yaml | \
  sed "s/{{cluster_name}}/$ClusterName/;s/{{region_name}}/$RegionName/" | \
  kubectl apply -f -

# Verify
kubectl get pods -n amazon-cloudwatch
```

### Useful kubectl Commands

```bash
# Check pod logs
kubectl logs -l app=nodejs-app --tail=50
kubectl logs -f deployment/nodejs-app   # Follow logs

# Describe a pod (shows events, resource usage)
kubectl describe pod $(kubectl get pod -l app=nodejs-app -o jsonpath='{.items[0].metadata.name}')

# Execute into a running container
kubectl exec -it $(kubectl get pod -l app=nodejs-app -o jsonpath='{.items[0].metadata.name}') -- sh

# Rolling update to a new image
kubectl set image deployment/nodejs-app nodejs-app=NEW_IMAGE:TAG

# Rollback a deployment
kubectl rollout history deployment/nodejs-app
kubectl rollout undo deployment/nodejs-app
kubectl rollout undo deployment/nodejs-app --to-revision=2

# Scale manually
kubectl scale deployment nodejs-app --replicas=5

# Port-forward for local testing
kubectl port-forward deployment/nodejs-app 8080:3000
curl http://localhost:8080/health

# View resource usage
kubectl top nodes
kubectl top pods

# Delete resources
kubectl delete -f k8s/

# Delete the entire cluster when done
eksctl delete cluster --name my-eks-cluster --region us-east-1
```
