# Project 05 — DevOS Cloud Architecture

## Goal

Write a complete Infrastructure as Code (IaC) template in Terraform to provision, deploy, and connect a multi-service web architecture containing a React frontend, Node.js API container, and a PostgreSQL database locally.

## What You'll Build

A simulated production architecture representing a full-stack cloud deployment:
- A private local ECR registry hosting your Node.js application image.
- An ECS Cluster containing an ECS Service that runs your API container.
- An RDS instance mock (simulated using a Dockerized PostgreSQL container).
- An S3 bucket for storing static assets.
- A local Terraform module provisioning all endpoints on Floci.

## Phases Required

- Phase 8 — Docker & EC2 Simulation
- Phase 9 — Terraform IaC Local
- Phase 10 — Containers ECS & ECR

## Requirements

- **IaC Provisioning:** All infrastructure (ECS Cluster, task definitions, S3 buckets, local networking) must be declared inside Terraform files.
- **Unified Providers:** The Terraform configuration must override S3, ECS, ECR, and IAM endpoints to target port 4566.
- **Database Link:** The Node.js application container must read its database connection strings (user, host, password) via task environment variables linked to the PostgreSQL container.
- **Statics CDN:** The React web assets must be uploaded to an S3 bucket configured for static web hosting.

## Suggested Approach

1. Create a `devos-infra` folder and write your `main.tf` configuration.
2. Direct your Terraform providers to target `http://localhost:4566`.
3. Set up the local ECR container registry on port 5001.
4. Dockerize your Node.js backend app, build the image, and push it to the registry.
5. In Terraform, define the ECS Task Definition JSON structure referencing the local ECR image.
6. Launch a PostgreSQL container locally to act as the RDS database.
7. Run `terraform apply` to provision the ECS Service and S3 buckets.
8. Verify that the ECS task starts successfully and connects to the PostgreSQL database.

## Stretch Goals

- Add a Redis cache container to the architecture, and configure task variables to route cache lookups.
- Implement an Application Load Balancer (ALB) mock in Terraform to route host port 80 to port 5000 of the ECS task.
- Package your React application assets, configure S3 static hosting in Terraform, and upload the build folder to the bucket.

## Evaluation Checklist

- [ ] Terraform files compile without syntax errors during initialization.
- [ ] ECS Cluster and Service are provisioned via `terraform apply`.
- [ ] Running tasks retrieve application images from the local ECR registry.
- [ ] Backend container establishes connection to the database.
- [ ] React frontend is successfully hosted via S3 static website endpoints.
