# Installation & Setup — Complete Guide

## Table of Contents
1. [Local Kubernetes Options](#1-local-kubernetes-options)
2. [Installing kubectl](#2-installing-kubectl)
3. [Setting Up minikube](#3-setting-up-minikube)
4. [Setting Up kind](#4-setting-up-kind)
5. [kubeconfig and Contexts](#5-kubeconfig-and-contexts)
6. [Cloud Kubernetes Options](#6-cloud-kubernetes-options)
7. [Your First Deployment](#7-your-first-deployment)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Local Kubernetes Options

Running Kubernetes locally lets you learn and develop without cloud costs. Three main tools exist:

```
Local K8s Tools Comparison:

┌─────────────┬──────────────┬───────────────────────────────────────────┐
│  Tool       │  Best For    │  Notes                                    │
├─────────────┼──────────────┼───────────────────────────────────────────┤
│  minikube   │  Beginners   │  Most beginner-friendly; single or multi  │
│             │  learning    │  node; built-in addons (dashboard, ingress)│
├─────────────┼──────────────┼───────────────────────────────────────────┤
│  kind       │  CI/CD,      │  Kubernetes IN Docker; fast; multi-node   │
│             │  testing     │  clusters via config; no VM needed        │
├─────────────┼──────────────┼───────────────────────────────────────────┤
│  k3s        │  Production- │  Lightweight K8s; great for Raspberry Pi, │
│             │  like local  │  edge, IoT; single binary; full K8s API   │
└─────────────┴──────────────┴───────────────────────────────────────────┘
```

### Which Should You Choose?

```
Starting out?              → minikube (easiest, has built-in add-ons)
Writing CI pipelines?      → kind (fast, Docker-based, scriptable)
Low-resource machine?      → k3s (minimal footprint)
Production-like locally?   → k3s or kind with multi-node config
```

---

## 2. Installing kubectl

`kubectl` is the Kubernetes command-line tool. Install it first — it works with any cluster (local or cloud).

### macOS

```bash
# Using Homebrew (recommended)
brew install kubectl

# Verify installation
kubectl version --client
```

### Linux

```bash
# Download the latest stable release
curl -LO "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# Make it executable and move to PATH
chmod +x kubectl
sudo mv kubectl /usr/local/bin/kubectl

# Verify
kubectl version --client
```

### Windows

```powershell
# Using Chocolatey
choco install kubernetes-cli

# Using winget
winget install Kubernetes.kubectl

# Verify
kubectl version --client
```

### Useful kubectl Aliases (add to ~/.bashrc or ~/.zshrc)

```bash
alias k='kubectl'
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgn='kubectl get nodes'
alias kdp='kubectl describe pod'
alias kaf='kubectl apply -f'

# Enable kubectl autocompletion
source <(kubectl completion bash)   # bash
source <(kubectl completion zsh)    # zsh
```

---

## 3. Setting Up minikube

### Install minikube

```bash
# macOS
brew install minikube

# Linux
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Windows
winget install Kubernetes.minikube
```

### Start a Cluster

```bash
# Start with default driver (Docker recommended)
minikube start

# Start with specific resources
minikube start --cpus=4 --memory=8192 --disk-size=20g

# Start with a specific Kubernetes version
minikube start --kubernetes-version=v1.28.0

# Start a multi-node cluster
minikube start --nodes=3 --driver=docker
```

### minikube Common Commands

```bash
minikube status           # check cluster status
minikube stop             # stop the cluster (preserves state)
minikube delete           # delete the cluster
minikube dashboard        # open Kubernetes dashboard in browser
minikube ip               # get minikube node IP
minikube ssh              # SSH into the minikube VM/container

# Enable add-ons
minikube addons list
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable dashboard

# Expose a service using minikube tunnel
minikube tunnel           # creates routes to LoadBalancer services
minikube service <name>   # open a NodePort service in browser
```

### minikube Architecture

```
Your Machine
├── minikube (manages the cluster VM/container)
│   └── Docker driver: runs K8s inside a Docker container
│       or VM driver: runs K8s inside a VM (VirtualBox, hyperkit, etc.)
│
└── kubectl → talks to the minikube cluster via kubeconfig
```

---

## 4. Setting Up kind

kind (Kubernetes IN Docker) runs Kubernetes nodes as Docker containers — fast and scriptable.

### Install kind

```bash
# macOS
brew install kind

# Linux / macOS (direct binary)
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
chmod +x kind && sudo mv kind /usr/local/bin/kind

# Windows (PowerShell)
curl.exe -Lo kind-windows-amd64.exe https://kind.sigs.k8s.io/dl/v0.22.0/kind-windows-amd64.exe
Move-Item .\kind-windows-amd64.exe c:\windows\kind.exe
```

### Create a Cluster

```bash
# Single node (default)
kind create cluster

# Named cluster
kind create cluster --name my-cluster

# Multi-node cluster via config file
cat > kind-config.yaml << 'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
- role: worker
- role: worker
EOF

kind create cluster --config kind-config.yaml --name dev-cluster
```

### kind Common Commands

```bash
kind get clusters                    # list clusters
kind delete cluster --name my-cluster
kind load docker-image myapp:1.0     # load a local image into kind nodes
kubectl cluster-info --context kind-dev-cluster
```

---

## 5. kubeconfig and Contexts

`kubectl` knows which cluster to talk to via the **kubeconfig** file.

### Default Location

```bash
# Default kubeconfig file
~/.kube/config

# Override with environment variable
export KUBECONFIG=/path/to/my-kubeconfig

# Merge multiple kubeconfigs
export KUBECONFIG=~/.kube/config:~/.kube/work-cluster
```

### kubeconfig Structure

```yaml
apiVersion: v1
kind: Config
clusters:
- name: minikube
  cluster:
    server: https://192.168.49.2:8443
    certificate-authority: /path/to/ca.crt
- name: production
  cluster:
    server: https://my-eks-cluster.ap-southeast-2.amazonaws.com

users:
- name: minikube-user
  user:
    client-certificate: /path/to/client.crt
    client-key: /path/to/client.key
- name: aws-user
  user:
    exec:
      command: aws
      args: [eks, get-token, --cluster-name, production]

contexts:
- name: minikube
  context:
    cluster: minikube
    user: minikube-user
    namespace: default
- name: production
  context:
    cluster: production
    user: aws-user
    namespace: myapp

current-context: minikube
```

### Managing Contexts

```bash
# View current context
kubectl config current-context

# List all contexts
kubectl config get-contexts

# Switch context
kubectl config use-context minikube
kubectl config use-context production

# Set default namespace for a context
kubectl config set-context --current --namespace=myapp

# View full kubeconfig
kubectl config view
kubectl config view --minify   # only current context

# Delete a context
kubectl config delete-context old-cluster
```

### Context Switching Safety Tip

```
Always verify your context before destructive commands:

kubectl config current-context   ← run this first!

A common mistake: running kubectl delete on production
when you meant to run it on dev.

Tools like kubectx (brew install kubectx) make switching
faster and show the current context in your shell prompt.
```

---

## 6. Cloud Kubernetes Options

Once you outgrow local clusters, move to managed Kubernetes in the cloud.

```
Cloud Kubernetes Comparison:

┌──────────────┬──────────────┬──────────────────────────────────────┐
│  Provider    │  Service     │  Notes                               │
├──────────────┼──────────────┼──────────────────────────────────────┤
│  AWS         │  EKS         │  Elastic Kubernetes Service; integr. │
│              │              │  with IAM, ALB, EBS, ECR             │
├──────────────┼──────────────┼──────────────────────────────────────┤
│  Google      │  GKE         │  Google Kubernetes Engine; best K8s  │
│  Cloud       │              │  experience; Autopilot mode          │
├──────────────┼──────────────┼──────────────────────────────────────┤
│  Azure       │  AKS         │  Azure Kubernetes Service; Azure AD  │
│              │              │  integration; Windows node support   │
├──────────────┼──────────────┼──────────────────────────────────────┤
│  DigitalOcean│  DOKS        │  Simple, affordable; good for small  │
│              │              │  teams                               │
└──────────────┴──────────────┴──────────────────────────────────────┘
```

### Connecting to Cloud Clusters

```bash
# AWS EKS — update kubeconfig
aws eks update-kubeconfig --region ap-southeast-2 --name my-eks-cluster

# Google GKE — get credentials
gcloud container clusters get-credentials my-gke-cluster \
  --zone australia-southeast1-a \
  --project my-gcp-project

# Azure AKS — get credentials
az aks get-credentials --resource-group myRG --name my-aks-cluster

# Verify connection
kubectl get nodes
```

---

## 7. Your First Deployment

Once your cluster is running, deploy something real.

```bash
# Step 1: verify the cluster
kubectl get nodes
kubectl cluster-info

# Step 2: create a deployment
kubectl create deployment hello --image=nginx:1.25

# Step 3: verify pods are running
kubectl get pods
kubectl get pods -w   # -w watches for changes in real time

# Step 4: expose it as a service
kubectl expose deployment hello --port=80 --type=NodePort

# Step 5: access the app
minikube service hello   # opens in browser (minikube only)
# OR
kubectl port-forward svc/hello 8080:80
# visit http://localhost:8080

# Step 6: scale the deployment
kubectl scale deployment hello --replicas=3
kubectl get pods

# Step 7: update the image (rolling update)
kubectl set image deployment/hello nginx=nginx:1.26

# Step 8: check rollout status
kubectl rollout status deployment/hello

# Step 9: rollback if needed
kubectl rollout undo deployment/hello

# Step 10: clean up
kubectl delete deployment hello
kubectl delete svc hello
```

---

## 8. Hands-On Exercises

**Exercise 1:** Install minikube and kubectl on your machine. Start a cluster with `minikube start`. Run `kubectl get nodes` and confirm the node shows as Ready. Then run `minikube dashboard` to open the web UI.

**Exercise 2:** Explore the kubeconfig file. Run `kubectl config view` and identify the cluster, user, and context entries. Switch to viewing only the current context with `kubectl config view --minify`.

**Exercise 3:** Install `kubectx` and `kubens` (`brew install kubectx`). Run `kubectx` to list contexts. Run `kubens` to list namespaces. Set the default namespace to `kube-system` and run `kubectl get pods` — observe the system pods.

**Exercise 4:** Create a kind cluster with 1 control-plane and 2 worker nodes using a config file. Verify with `kubectl get nodes` that all 3 nodes are Ready. Load a local Docker image into the kind cluster with `kind load docker-image nginx:1.25`.

**Exercise 5:** Deploy nginx to your minikube cluster imperatively (kubectl create deployment). Then export the deployment as YAML with `kubectl get deployment nginx -o yaml > nginx-deployment.yaml`. Edit the file to change replicas to 3, then apply it with `kubectl apply -f nginx-deployment.yaml`. Observe the additional pods.

---

## 9. Interview Q&A

**Q: What is kubectl and how does it communicate with a cluster?**
Answer: kubectl is the Kubernetes command-line client. It reads connection details (API server URL, certificates, credentials) from the kubeconfig file (default at ~/.kube/config). kubectl sends HTTPS requests to the Kubernetes API Server. All cluster operations — creating resources, querying state, streaming logs — go through the API Server's REST API.

**Q: What is a kubeconfig context?**
Answer: A context in kubeconfig is a named combination of a cluster, a user, and a namespace. Switching contexts (kubectl config use-context) changes which cluster and credentials kubectl uses for subsequent commands. This is how you manage access to multiple clusters (dev, staging, production) from the same workstation without separate kubeconfig files.

**Q: What is the difference between minikube and kind?**
Answer: minikube runs Kubernetes inside a VM or Docker container on your machine, with a focus on developer experience — it has a dashboard, add-ons, and service tunneling built in. kind (Kubernetes IN Docker) runs each K8s node as a Docker container, making it faster to start and better suited for CI pipelines and testing where you need reproducible, scriptable cluster creation.

**Q: What is EKS / GKE / AKS?**
Answer: These are managed Kubernetes services from cloud providers — AWS EKS, Google GKE, and Azure AKS respectively. "Managed" means the cloud provider runs and maintains the control plane (API Server, etcd, Scheduler) for you. You only manage worker nodes (or even those are managed in serverless modes like GKE Autopilot or EKS Fargate). This reduces operational overhead significantly.

**Q: How do you safely manage multiple Kubernetes clusters?**
Answer: Use kubeconfig contexts — each cluster gets a named context. Tools like kubectx (faster context switching) and kubens (faster namespace switching) help. Always run `kubectl config current-context` before destructive commands. In production, use separate kubeconfig files per cluster and set KUBECONFIG environment variable, or use a tool like kubie that temporarily isolates context per shell session.
