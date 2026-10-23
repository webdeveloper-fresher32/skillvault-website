# Kubernetes Master Course — Projects

This section contains six hands-on projects that take you from a single-container deployment on minikube all the way to a production-grade CI/CD pipeline with GitOps. Complete them in order; each one builds on the skills introduced in earlier phases of the course.

## Project Overview

| # | Project | Level | Phase Prerequisites | Description |
|---|---------|-------|---------------------|-------------|
| 1 | Deploy Static App | Beginner | Phase 1-3 | Deploy nginx with Deployment + Service on minikube |
| 2 | Node.js Microservices | Beginner | Phase 1-5 | 2-service app (API + frontend) with ClusterIP Services |
| 3 | Stateful App with PVCs | Intermediate | Phase 6 | MySQL with StatefulSet, PVC, headless Service |
| 4 | Ingress + TLS App | Intermediate | Phase 7-8 | Full-stack app with Ingress, TLS cert-manager, ConfigMap |
| 5 | Helm Packaged App | Advanced | Phase 10 | Package and deploy an app as a Helm chart with values |
| 6 | Full CI/CD Pipeline | Advanced | Phase 11-12 | GitHub Actions → build → push → ArgoCD deploy to K8s |

---

## Project Summaries

### 1. Deploy Static App (Beginner)
Write a Kubernetes Deployment manifest that runs three replicas of Nginx and expose it with a NodePort Service on minikube. You will practise authoring YAML manifests, using kubectl apply, inspecting Pod state, and accessing a live service — the essential daily mechanics of working with Kubernetes.

### 2. Node.js Microservices (Beginner)
Model a two-tier application: a Node.js API backend and a lightweight frontend, each running as a separate Deployment with its own ClusterIP Service. You will wire inter-service communication via DNS names, manage container environment variables, and observe service discovery at work inside the cluster.

### 3. Stateful App with PVCs (Intermediate)
Run MySQL as a StatefulSet backed by a PersistentVolumeClaim so database state survives Pod restarts. A headless Service provides stable DNS entries for each Pod, and a Kubernetes Secret stores the root password. You will experience the difference between stateless Deployments and stateful workloads first-hand.

### 4. Ingress + TLS App (Intermediate)
Deploy a full-stack application behind an Nginx Ingress controller. cert-manager automatically provisions a TLS certificate from Let's Encrypt, a ConfigMap injects runtime configuration into the app, and a Horizontal Pod Autoscaler scales the backend under load. You will end up with a production-style ingress pattern.

### 5. Helm Packaged App (Advanced)
Convert a multi-manifest application into a Helm chart with parameterised values. You will create templates with conditional logic and loops, publish the chart to an OCI registry, and demonstrate how a single chart can deploy identically to dev, staging, and production with different values files.

### 6. Full CI/CD Pipeline (Advanced)
Build an end-to-end GitOps pipeline: GitHub Actions builds and pushes a Docker image on every merge to main, updates the Kubernetes manifest in a GitOps repo, and ArgoCD automatically synchronises the cluster to the desired state. You will verify zero-downtime rolling deployments and implement a rollback procedure.
