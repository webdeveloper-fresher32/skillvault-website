# Phase 9: Terraform IaC Local

## What You'll Learn

How Infrastructure as Code (IaC) allows you to define cloud resources declaratively, and how to write Terraform configuration files, configure providers to redirect API requests to local Floci endpoints, manage local state files, and verify deployments without cloud spend.

## Learning Objectives

- Explain the benefits of Infrastructure as Code and the purpose of Terraform.
- Configure the Terraform AWS provider to redirect endpoints to `localhost:4566`.
- Declare local S3 buckets and DynamoDB tables using HCL (HashiCorp Configuration Language).
- Run and interpret `terraform init`, `terraform plan`, and `terraform apply` locally.
- Understand the role of the state file (`terraform.tfstate`) and how to inspect it locally.

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Terraform-with-Local-Endpoints.md](01-Terraform-with-Local-Endpoints.md) | Terraform provider endpoints override, HCL templates, state files, and local apply. | 3 days |

## Estimated Time

3 days

## Next Phase

→ [Phase 10: Containers ECS & ECR](../Phase-10-Containers-ECS-and-ECR/README.md)
