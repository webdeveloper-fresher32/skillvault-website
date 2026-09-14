# Project 1 — Single EC2 Instance with Security Group

**Level:** Beginner
**Time estimate:** 30 – 45 minutes
**Phase prerequisite:** Phase 1 – Fundamentals, Phase 2 – Resources & Providers

---

## Overview

You will write your first real Terraform configuration: a single AWS EC2 instance, a security group that allows inbound SSH (port 22) and HTTP (port 80), and an output that prints the instance's public IP address once `apply` finishes.

This project exercises the core Terraform loop you'll use for the rest of the course:

```
terraform init  →  terraform plan  →  terraform apply  →  terraform destroy
```

---

## Prerequisites

- Terraform >= 1.5 installed (`terraform version`)
- An AWS account with an IAM user/role that has EC2 permissions
- AWS CLI configured locally (`aws configure`) or equivalent environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`)
- An existing EC2 key pair in your target region (or create one — see Step 5)

---

## Project Structure

```
01-single-vm-instance/
├── main.tf
├── variables.tf
├── outputs.tf
└── terraform.tfvars
```

---

## Step-by-Step Instructions

### Step 1 — Create the directory

```bash
mkdir 01-single-vm-instance && cd 01-single-vm-instance
```

### Step 2 — `variables.tf`

```hcl
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the instance"
  type        = string
  default     = "0.0.0.0/0" # tighten this to your own IP/32 in real use
}

variable "project_name" {
  description = "Prefix used for resource naming and tags"
  type        = string
  default     = "single-vm-demo"
}
```

### Step 3 — `main.tf`

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

# ── Look up the latest Amazon Linux 2023 AMI ────────────────────────────────
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

# ── Use the default VPC so the project has zero networking prerequisites ───
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ── Security group: SSH + HTTP inbound, all outbound ────────────────────────
resource "aws_security_group" "web_sg" {
  name        = "${var.project_name}-sg"
  description = "Allow SSH and HTTP inbound"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.project_name}-sg"
    Project = var.project_name
  }
}

# ── EC2 instance ─────────────────────────────────────────────────────────────
resource "aws_instance" "web" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.web_sg.id]

  user_data = <<-EOF
    #!/bin/bash
    dnf install -y httpd
    systemctl enable httpd
    systemctl start httpd
    echo "<h1>Hello from $(hostname -f)</h1>" > /var/www/html/index.html
  EOF

  tags = {
    Name    = "${var.project_name}-instance"
    Project = var.project_name
  }
}
```

### Step 4 — `outputs.tf`

```hcl
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.web.id
}

output "public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.web.public_ip
}

output "public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.web.public_dns
}

output "ssh_command" {
  description = "Ready-to-use SSH command"
  value       = "ssh -i ${var.key_name}.pem ec2-user@${aws_instance.web.public_ip}"
}
```

### Step 5 — Create (or reuse) an EC2 key pair

If you don't already have one in your target region:

```bash
aws ec2 create-key-pair --key-name my-terraform-key \
  --query 'KeyMaterial' --output text > my-terraform-key.pem
chmod 400 my-terraform-key.pem
```

### Step 6 — `terraform.tfvars`

```hcl
aws_region       = "us-east-1"
instance_type    = "t3.micro"
key_name         = "my-terraform-key"
allowed_ssh_cidr = "203.0.113.10/32" # replace with your own public IP
project_name     = "single-vm-demo"
```

> Find your public IP with `curl -s ifconfig.me` and use `<ip>/32` — never leave SSH open to `0.0.0.0/0` outside of a scratch lab.

### Step 7 — Initialize, plan, apply

```bash
terraform init
terraform fmt
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

Terraform will print the outputs once the apply completes:

```
Outputs:

instance_id = "i-0abcd1234efgh5678"
public_dns  = "ec2-3-91-12-45.compute-1.amazonaws.com"
public_ip   = "3.91.12.45"
ssh_command = "ssh -i my-terraform-key.pem ec2-user@3.91.12.45"
```

---

## Expected Result

- `terraform apply` completes with `Apply complete! Resources: 3 added, 0 changed, 0 destroyed.`
- Visiting `http://<public_ip>` in a browser shows `Hello from ip-10-0-x-x.ec2.internal`.
- You can SSH into the box using the printed `ssh_command` (allow ~30–60 seconds after apply for the instance to finish booting and `user_data` to run).

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Instance running | `aws ec2 describe-instances --instance-ids $(terraform output -raw instance_id) --query "Reservations[0].Instances[0].State.Name"` | `"running"` |
| Web server responds | `curl -s http://$(terraform output -raw public_ip)` | `<h1>Hello from ...</h1>` |
| SSH access works | `ssh -i my-terraform-key.pem ec2-user@$(terraform output -raw public_ip) 'uptime'` | Prints uptime output |
| SG rules correct | `aws ec2 describe-security-groups --group-ids <sg-id> --query "SecurityGroups[0].IpPermissions"` | Shows ports 22 and 80 |

---

## Tear Down

```bash
terraform destroy
```

Confirm with `yes` when prompted. Always destroy lab resources you don't need running — EC2 instances (even `t3.micro`) and any attached Elastic IPs incur cost while they exist.

---

## Stretch Goals

1. **Elastic IP** — attach an `aws_eip` so the public IP survives a stop/start cycle, and update the outputs accordingly.
2. **Parameterize the AMI** — replace the `data "aws_ami"` filter with a variable so you can switch between Amazon Linux, Ubuntu, and Debian without editing code.
3. **Lifecycle protection** — add `lifecycle { prevent_destroy = true }` to the instance and observe what happens when you try to destroy it (then remove it again to clean up).
4. **Local-exec provisioner** — add a `local-exec` provisioner that curls the instance automatically after apply and prints the response, so you don't have to run a manual `curl`.
5. **Restrict egress** — replace the permissive `egress` block with rules that only allow outbound HTTPS (443) and DNS (53), and confirm `dnf install` still works during boot.
