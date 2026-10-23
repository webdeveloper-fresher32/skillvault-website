# Project 2: Deploying to AWS

In this project, you will experience the difference between an IaaS deployment and a PaaS deployment by putting your Docker container in the Public Cloud.

## The Goal
Expose your Dockerized application to the public internet using AWS.

## Option A: The PaaS Approach (AWS Elastic Beanstalk or App Runner)
1. Create a free-tier AWS account.
2. Use AWS App Runner (or Elastic Beanstalk).
3. Connect it to a container registry (like Docker Hub or AWS ECR) where you uploaded your image from Project 1.
4. Let AWS automatically provision the load balancer, HTTPS certificates, and auto-scaling rules.
5. Verify your app is accessible via a public URL.

## Option B: The IaaS Approach (AWS EC2)
1. Provision a raw Linux EC2 instance (e.g., Ubuntu `t2.micro`).
2. Configure the Security Group to open port 22 (SSH) and port 80 (HTTP).
3. SSH into the raw server.
4. Manually install Docker via the command line.
5. Pull your image from Docker Hub and run it, mapping port 80 to 3000.
6. Verify your app is accessible via the EC2 instance's public IP address.

## Why this matters
This highlights the fundamental trade-off in cloud service models. Option A (PaaS) is fast and requires no server maintenance. Option B (IaaS) requires manual effort (installing Docker) but gives you total control over the server.
