# Phase 11: Infrastructure as Code (IaC)

## What is Infrastructure as Code?

Infrastructure as Code (IaC) is the practice of managing and provisioning cloud infrastructure through machine-readable configuration files rather than manual processes or interactive UI consoles. Instead of clicking through the AWS console to create a VPC, EC2 instance, or RDS database, you write code that describes what you want, and a tool creates it for you.

### Why IaC Matters

**Without IaC:**
- Infrastructure is created manually through the console
- Configuration is tribal knowledge — only the person who built it knows how it works
- Replicating environments (dev, staging, prod) is error-prone and time-consuming
- No version history of infrastructure changes
- Disaster recovery means manually recreating everything from memory
- Environments drift apart over time (snowflake servers)

**With IaC:**
- Infrastructure is defined in version-controlled code — it lives in git alongside application code
- Anyone on the team can understand and reproduce the infrastructure
- Creating new environments takes minutes, not days
- Changes are reviewed as code (pull requests, approvals)
- Infrastructure changes have history and can be rolled back
- Identical, reproducible environments eliminate "works on staging but not prod" issues

### Core IaC Benefits

| Benefit | Description |
|---|---|
| **Consistency** | Same code produces identical infrastructure every time |
| **Reproducibility** | Recreate any environment from scratch in minutes |
| **Version Control** | Track every infrastructure change in git |
| **Collaboration** | Code reviews for infrastructure changes |
| **Automation** | Integrate with CI/CD pipelines |
| **Documentation** | The code IS the documentation |
| **Cost Control** | Easily see and audit all resources, destroy when not needed |
| **Disaster Recovery** | Recreate entire infrastructure from code after failure |

---

## What's in This Phase

### Files

| File | Tool | Description |
|---|---|---|
| `01-CloudFormation-Complete.md` | AWS CloudFormation | Deep dive into AWS's native IaC service — templates, stacks, intrinsic functions, StackSets, drift detection, and complete working examples |
| `02-Terraform-Complete.md` | HashiCorp Terraform | Comprehensive Terraform guide for AWS — HCL syntax, state management, modules, workspaces, and a full hands-on project |

---

## What You Will Learn

### CloudFormation (File 01)

- How CloudFormation works: the template-to-stack relationship and the CloudFormation service acting as an intermediary between your code and AWS APIs
- Complete template structure: every section from AWSTemplateFormatVersion through Outputs
- Parameters: accepting inputs at deploy time, including SSM Parameter Store integration
- Mappings: embedding lookup tables (e.g., AMI IDs per region)
- Conditions: creating resources conditionally (e.g., only in production)
- All intrinsic functions: `Ref`, `Fn::GetAtt`, `Fn::Sub`, `Fn::If`, `Fn::Join`, `Fn::Select`, `Fn::ImportValue`, and more — with real examples for each
- Pseudo parameters: `AWS::Region`, `AWS::AccountId`, `AWS::StackName`
- Change Sets: safely previewing infrastructure changes before applying them
- DeletionPolicy and UpdateReplacePolicy: protecting data when stacks are deleted or updated
- Stack Policies: preventing accidental modification of critical resources
- Nested Stacks: breaking large templates into reusable modules
- StackSets: deploying the same stack to multiple accounts and regions simultaneously
- Drift Detection: identifying manual changes that deviate from your templates
- Complete working example: a production-ready template creating a VPC, EC2 instance, and Security Group

### Terraform (File 02)

- Why Terraform: when to use it over CloudFormation, especially for multi-cloud environments
- HCL syntax: the language of Terraform — blocks, arguments, expressions, string interpolation
- Provider configuration: connecting Terraform to AWS with version constraints and multi-region setups
- The complete variable system: strings, numbers, booleans, lists, maps, objects, and validation rules
- Locals: computing values once and reusing them to keep code DRY
- Data Sources: querying existing AWS infrastructure from Terraform
- Resources: defining every type of AWS resource with proper configuration
- `count` vs `for_each`: creating multiple similar resources with real examples
- Dynamic blocks: generating repeated nested configuration blocks
- `depends_on`, `lifecycle` rules: controlling resource creation order and update behavior
- Terraform state: what it is, why it's critical, and why remote state is mandatory for teams
- S3 + DynamoDB backend: the production-standard remote state configuration with locking
- State manipulation commands: `terraform state list`, `show`, `rm`, `mv`, `import`
- Modules: reusing infrastructure patterns, structure, and calling public registry modules
- Workspaces: managing multiple environments (dev/staging/prod) with one codebase
- All core Terraform commands: `init`, `fmt`, `validate`, `plan`, `apply`, `destroy`
- Complete hands-on project: a full VPC + EC2 + RDS setup with all five Terraform files (`providers.tf`, `main.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars`)
- Best practices for production Terraform codebases

---

## Recommended Learning Order

1. Start with **CloudFormation** — it is AWS-native and requires no additional tooling. Understanding it deeply helps you understand AWS resources at the API level.
2. Move to **Terraform** — once you understand how cloud resources work via CloudFormation, Terraform's abstractions will make more sense, and the added complexity of state management will be clearer.

---

## Prerequisites

Before starting Phase 11, you should be comfortable with:
- Core AWS services: VPC, EC2, S3, IAM, RDS
- AWS CLI configured with appropriate credentials
- Basic YAML and JSON syntax
- Command-line usage

---

## Tools Setup

### CloudFormation
No additional installation required. CloudFormation is an AWS service accessible via the console, CLI, or SDK.

```bash
# Verify AWS CLI is configured
aws sts get-caller-identity

# CloudFormation CLI (built into AWS CLI)
aws cloudformation help
```

### Terraform
```bash
# macOS
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Verify installation
terraform version

# Linux (via tfenv for version management)
git clone https://github.com/tfutils/tfenv.git ~/.tfenv
echo 'export PATH="$HOME/.tfenv/bin:$PATH"' >> ~/.bashrc
tfenv install latest
tfenv use latest
```
