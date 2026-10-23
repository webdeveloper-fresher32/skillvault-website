# Terraform Cheatsheet

---

### Core CLI Workflow

```bash
terraform init                                       # Initialize working dir, download providers/modules
terraform init -upgrade                             # Re-download providers, allow newer versions
terraform init -reconfigure                         # Reinitialize backend, ignore existing config
terraform init -backend-config=backend.hcl          # Pass backend settings from a file
terraform init -migrate-state                       # Migrate state to a newly configured backend

terraform plan                                       # Show proposed changes (no apply)
terraform plan -out=tfplan                          # Save the plan to a file for later apply
terraform plan -var="region=us-east-1"              # Override a variable inline
terraform plan -var-file="prod.tfvars"              # Load variables from a file
terraform plan -target=aws_instance.web             # Plan only a specific resource
terraform plan -destroy                             # Preview a destroy operation
terraform plan -refresh=false                        # Skip refreshing state before planning

terraform apply                                      # Apply changes (prompts for confirmation)
terraform apply -auto-approve                       # Apply without confirmation prompt
terraform apply tfplan                              # Apply a previously saved plan file
terraform apply -target=aws_instance.web            # Apply only a specific resource
terraform apply -var-file="prod.tfvars"             # Apply using a variable file
terraform apply -replace=aws_instance.web           # Force recreation of a resource

terraform destroy                                    # Destroy all managed infrastructure
terraform destroy -auto-approve                     # Destroy without confirmation
terraform destroy -target=aws_instance.web          # Destroy a specific resource only

terraform fmt                                        # Rewrite files to canonical HCL style
terraform fmt -recursive                            # Format all .tf files in subdirectories
terraform fmt -check                                # Exit non-zero if files aren't formatted (CI use)
terraform fmt -diff                                 # Show formatting diff without writing

terraform validate                                   # Check config syntax and internal consistency
terraform console                                    # Interactive REPL to test expressions
terraform graph                                      # Output dependency graph in DOT format
terraform graph | dot -Tpng > graph.png             # Render the dependency graph as an image

terraform show                                       # Human-readable output of current state
terraform show -json                                # Machine-readable JSON of current state
terraform show tfplan                               # Inspect a saved plan file

terraform output                                     # Show all root module output values
terraform output web_ip                             # Show a single output value
terraform output -json                              # Output values as JSON (for scripting)

terraform version                                    # Show Terraform CLI and provider versions
terraform providers                                  # Show provider requirements for the config
terraform providers lock                            # Update the dependency lock file
terraform get                                        # Download/update modules referenced by config
```

---

### Workspace Commands

```bash
terraform workspace list                             # List all workspaces (* marks current)
terraform workspace show                            # Show the current workspace name
terraform workspace new staging                     # Create and switch to a new workspace
terraform workspace select prod                     # Switch to an existing workspace
terraform workspace delete staging                  # Delete a workspace (must not be current)
```

---

### State Commands

```bash
terraform state list                                 # List all resources tracked in state
terraform state list aws_instance.web                # List a specific resource's state entries
terraform state show aws_instance.web                # Show attributes of a resource in state
terraform state mv aws_instance.web aws_instance.app # Rename/move a resource within state
terraform state mv 'module.old' 'module.new'        # Move a resource between modules
terraform state rm aws_instance.web                 # Remove a resource from state (not destroyed)
terraform state pull                                 # Print raw state file to stdout
terraform state push updated.tfstate                # Overwrite remote state with local file
terraform state replace-provider old/aws new/aws    # Change the provider source for state entries

terraform import aws_instance.web i-0123456789      # Bring an existing resource into state
terraform import 'module.app.aws_instance.web' i-0123456789  # Import into a module's resource

terraform refresh                                    # Sync state with real infrastructure (deprecated, use plan -refresh-only)
terraform apply -refresh-only                       # Update state to match real infra without changes
terraform force-unlock LOCK_ID                      # Manually release a stuck state lock
```

---

### Variable Precedence (highest to lowest)

| Order | Source |
|-------|--------|
| 1 | `-var` or `-var-file` flags on the command line |
| 2 | `*.auto.tfvars` / `*.auto.tfvars.json` (alphabetical) |
| 3 | `terraform.tfvars.json` |
| 4 | `terraform.tfvars` |
| 5 | `TF_VAR_<name>` environment variables |
| 6 | `default` value in the variable block |

Later command-line `-var`/`-var-file` flags override earlier ones; within a given source, last-defined value for the same variable wins.

---

### Common HCL Blocks

```hcl
# Resource block
resource "aws_instance" "web" {
  ami           = "ami-0123456789"
  instance_type = "t3.micro"

  tags = {
    Name = "web-server"
  }
}

# Data source block (read-only lookup)
data "aws_ami" "latest_amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# Variable block
variable "instance_type" {
  type        = string
  default     = "t3.micro"
  description = "EC2 instance size"

  validation {
    condition     = can(regex("^t3\\.", var.instance_type))
    error_message = "Instance type must be a t3 family."
  }
}

# Output block
output "web_public_ip" {
  value       = aws_instance.web.public_ip
  description = "Public IP of the web server"
  sensitive   = false
}

# Locals block
locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  full_name = "${var.project}-${var.environment}"
}

# Module block
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "my-vpc"
  cidr = "10.0.0.0/16"
}

# Provider block
provider "aws" {
  region  = "us-east-1"
  alias   = "east"
}

# Terraform settings block
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "my-tf-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}
```

---

### Built-in Functions by Category

**String**

| Function | Description |
|----------|-------------|
| `format("%s-%d", "web", 1)` | Printf-style string formatting |
| `join(",", list)` | Join list elements into a string |
| `split(",", str)` | Split a string into a list |
| `lower(str)` / `upper(str)` | Case conversion |
| `trim(str, " ")` | Remove leading/trailing characters |
| `replace(str, "a", "b")` | Replace substring occurrences |
| `substr(str, 0, 5)` | Extract a substring |

**Collection**

| Function | Description |
|----------|-------------|
| `length(list)` | Number of elements in a list/map/string |
| `merge(map1, map2)` | Shallow-merge two or more maps |
| `concat(list1, list2)` | Combine lists into one |
| `contains(list, val)` | Check if a list contains a value |
| `keys(map)` / `values(map)` | Extract keys or values from a map |
| `lookup(map, key, default)` | Safe map lookup with a fallback |
| `flatten(list_of_lists)` | Flatten nested lists into one |
| `distinct(list)` | Remove duplicate elements |
| `element(list, index)` | Get element at index (wraps around) |
| `slice(list, 0, 2)` | Extract a sub-range of a list |

**Numeric**

| Function | Description |
|----------|-------------|
| `min(a, b, ...)` / `max(a, b, ...)` | Smallest/largest of given numbers |
| `ceil(x)` / `floor(x)` | Round up/down to nearest integer |
| `abs(x)` | Absolute value |

**Type Conversion & Encoding**

| Function | Description |
|----------|-------------|
| `tostring(x)` / `tonumber(x)` / `tolist(x)` / `tomap(x)` | Explicit type conversion |
| `jsonencode(value)` / `jsondecode(str)` | Convert to/from a JSON string |
| `yamlencode(value)` / `yamldecode(str)` | Convert to/from a YAML string |
| `base64encode(str)` / `base64decode(str)` | Base64 encode/decode |

**Filesystem**

| Function | Description |
|----------|-------------|
| `file("path.txt")` | Read a file's contents as a string |
| `templatefile("tpl.tpl", vars)` | Render a template file with variables |
| `fileexists("path")` | Check if a file exists |

**Date/Time & Hashing**

| Function | Description |
|----------|-------------|
| `timestamp()` | Current UTC timestamp (RFC 3339) |
| `formatdate("YYYY-MM-DD", timestamp())` | Format a timestamp |
| `uuid()` | Generate a random UUID (changes every apply) |
| `md5(str)` / `sha256(str)` | Hash a string |

**Conditional/Type-checking**

| Function | Description |
|----------|-------------|
| `can(expr)` | Returns `true`/`false` instead of erroring |
| `try(expr1, expr2, ...)` | Return first expression that doesn't error |
| `coalesce(a, b, ...)` | First non-null argument |
| `coalescelist(list1, list2)` | First non-empty list argument |

---

### Meta-Arguments

```hcl
# count — create N near-identical instances (indexed 0..N-1)
resource "aws_instance" "web" {
  count         = 3
  ami           = "ami-0123456789"
  instance_type = "t3.micro"
  tags = {
    Name = "web-${count.index}"
  }
}
# Reference: aws_instance.web[0], aws_instance.web[*].id

# for_each — create one instance per map/set entry, keyed by string
resource "aws_instance" "web" {
  for_each      = toset(["a", "b", "c"])
  ami           = "ami-0123456789"
  instance_type = "t3.micro"
  tags = {
    Name = "web-${each.key}"
  }
}
# Reference: aws_instance.web["a"], each.key / each.value

# depends_on — explicit dependency not inferable from references
resource "aws_instance" "app" {
  depends_on = [aws_iam_role_policy.app_policy]
  # ...
}

# lifecycle — control create/update/destroy behavior
resource "aws_instance" "web" {
  lifecycle {
    create_before_destroy = true            # Create replacement before destroying old
    prevent_destroy        = true            # Block terraform destroy on this resource
    ignore_changes          = [tags, ami]    # Ignore drift on listed attributes
    replace_triggered_by    = [aws_ami.app]  # Force replace when referenced resource changes
  }
}

# provider — pin a resource to a specific provider alias
resource "aws_instance" "east_web" {
  provider = aws.east
  # ...
}
```

---

### Common AWS Provider Resource Types

| Resource Type | Purpose |
|---------------|---------|
| `aws_instance` | EC2 virtual machine |
| `aws_vpc` | Virtual Private Cloud |
| `aws_subnet` | Subnet within a VPC |
| `aws_security_group` | Firewall rules for resources |
| `aws_internet_gateway` | Internet access for a VPC |
| `aws_nat_gateway` | Outbound internet for private subnets |
| `aws_route_table` / `aws_route` | Routing rules for a VPC |
| `aws_s3_bucket` | Object storage bucket |
| `aws_s3_bucket_policy` | Access policy for an S3 bucket |
| `aws_iam_role` | IAM role for permission delegation |
| `aws_iam_policy` | Standalone IAM policy document |
| `aws_iam_role_policy_attachment` | Attach a policy to a role |
| `aws_db_instance` | RDS relational database instance |
| `aws_dynamodb_table` | DynamoDB NoSQL table |
| `aws_lambda_function` | Serverless function |
| `aws_ecs_cluster` / `aws_ecs_service` | ECS container orchestration |
| `aws_eks_cluster` | Managed Kubernetes cluster |
| `aws_lb` / `aws_lb_target_group` / `aws_lb_listener` | Application/Network Load Balancer |
| `aws_autoscaling_group` | EC2 Auto Scaling group |
| `aws_cloudwatch_log_group` | Log storage and retention |
| `aws_route53_record` | DNS record management |
| `aws_acm_certificate` | TLS certificate via ACM |
| `aws_kms_key` | Encryption key management |
| `aws_secretsmanager_secret` | Secrets storage |
