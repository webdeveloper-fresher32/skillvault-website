# What is Cloud-Native?

The Cloud Native Computing Foundation (CNCF) defines Cloud-Native as:

> "Cloud native technologies empower organizations to build and run scalable applications in modern, dynamic environments such as public, private, and hybrid clouds. Containers, service meshes, microservices, immutable infrastructure, and declarative APIs exemplify this approach."

## Cloud-Ready vs. Cloud-Native

To understand the difference, consider a legacy application designed in 2005. It stores uploaded images on its local `C:\` drive. 

If you take this application and install it on an AWS EC2 instance, it is **Cloud-Ready** (or "Lift and Shift"). It runs in the cloud, but it is deeply flawed:
- If AWS auto-scales and adds a second EC2 instance to handle traffic, images uploaded to Server A cannot be seen by users routed to Server B. 
- If the EC2 instance crashes, all locally stored images are lost forever.

A **Cloud-Native** application is designed from day one assuming that servers are ephemeral (they will crash and be destroyed frequently). A cloud-native app would upload images directly to a distributed object store (like AWS S3) rather than the local disk.

## The 4 Pillars of Cloud-Native Architecture

### 1. Microservices
Instead of a monolithic application, cloud-native apps are broken down into loosely coupled, independently deployable microservices. This allows different parts of the application to scale independently based on demand.

### 2. Containerization
Cloud-native applications are packaged as lightweight, portable containers (like Docker). Containers bundle the application code with its exact dependencies, ensuring it runs identically on a developer's laptop, in a testing environment, and in the cloud.

### 3. CI/CD (Continuous Integration / Continuous Delivery)
Cloud-native organizations heavily automate their software delivery pipeline. Code changes are automatically tested, built into container images, and deployed to production, allowing for dozens of deployments per day.

### 4. DevOps and Declarative Infrastructure
Cloud-native infrastructure is managed using "Infrastructure as Code" (IaC) tools like Terraform or Kubernetes manifests. Instead of manually clicking through a web console to create a server, infrastructure is declared in code, version-controlled in Git, and deployed automatically. This ensures environments are reproducible and immutable.

## Summary
- "Lift and shift" puts legacy apps in the cloud, but they cannot utilize cloud elasticity.
- Cloud-Native applications are designed specifically for distributed, ephemeral cloud environments.
- The approach relies heavily on Microservices, Containers, CI/CD, and Infrastructure as Code.
