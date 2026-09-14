# Local AWS Projects

Apply the patterns learned throughout the 12 phases to build and deploy production-grade cloud architectures locally on your machine. Each project includes complete requirements, architectural guidelines, and evaluation checklists.

---

## Projects Catalog

| Project | Description | Key Services Used | Difficulty |
|---------|-------------|-------------------|------------|
| [Project 1: S3 Resume Storage API](01-S3-Resume-Storage-API.md) | Node/Express API to upload, download, and delete resumes from a private local S3 bucket. | S3, Express, AWS SDK | Beginner |
| [Project 2: Serverless URL Shortener](02-Serverless-URL-Shortener.md) | Serverless application that routes short codes to original URLs using API Gateway, Lambda, and DynamoDB. | Lambda, API Gateway, DynamoDB | Intermediate |
| [Project 3: Image Processing Lambda](03-Image-Processing-Lambda.md) | S3 event listener that automatically triggers a Lambda function to resize images and store thumbnails. | S3, Lambda, Event Triggers | Intermediate |
| [Project 4: Queue-Based Email Service](04-Queue-Based-Email-Service.md) | Asynchronous task processor queue distributing emails to background workers. | SQS, SNS, Lambda, Express | Advanced |
| [Project 5: DevOS Cloud Architecture](05-DevOS-Cloud-Architecture.md) | Complete multi-service system deployment using Terraform to provision ECS services, ECR registries, and RDS. | Terraform, ECS, ECR, PostgreSQL | Advanced |

---

## Recommended Approach

1. Complete the corresponding phase lessons before attempting each project.
2. Build each application using Docker containerized setups.
3. Test all API endpoints locally using `curl` or browser clients.
4. Verify your resource states in the local Floci container.
