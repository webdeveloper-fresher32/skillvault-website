# IaaS vs. PaaS

To understand Cloud Service Models, think of a traditional On-Premises data center. In that model, you manage **everything**: Networking, Storage, Servers, Virtualization, OS, Middleware, Runtime, Data, and Application Code.

Cloud models abstract these layers away, one by one.

## 1. Infrastructure as a Service (IaaS)

IaaS is the most basic cloud service model. The cloud provider gives you the raw infrastructure (a Virtual Machine over the network), but you are responsible for everything inside it.

**What the Provider Manages:**
- Networking, Storage, Servers, Virtualization (The Hypervisor).

**What You Manage:**
- Operating System (Windows/Linux), Middleware, Runtime (Java/Node), Data, and Application Code.

**Examples:**
- AWS EC2 (Elastic Compute Cloud)
- Google Compute Engine (GCE)
- Microsoft Azure Virtual Machines

### Pros and Cons of IaaS
- **Pros**: Maximum flexibility and control. You have root SSH access to the machine. You can install custom security patches, specific legacy software, and tweak kernel parameters.
- **Cons**: High operational overhead. You are responsible for upgrading the OS, patching security vulnerabilities, and setting up load balancers manually.

## 2. Platform as a Service (PaaS)

PaaS abstracts away the operating system and the runtime environment. It is designed specifically for software developers. You don't care about Linux or Windows; you just want a place to run your Node.js or Python code.

**What the Provider Manages:**
- Everything in IaaS + Operating System, Middleware, and Runtime.

**What You Manage:**
- Only your Data and Application Code.

**Examples:**
- Heroku
- AWS Elastic Beanstalk
- Google App Engine
- Vercel

### Pros and Cons of PaaS
- **Pros**: Developer speed. You just type `git push heroku main` or `vercel deploy`, and the platform builds your code, provisions the runtime, and scales it automatically. No servers to patch.
- **Cons**: Less control. You cannot SSH into the server to tweak the OS. You are constrained to the programming languages and versions the platform supports.

## Summary

- **IaaS**: "Here is a raw Linux server. Good luck." Best for legacy migrations and maximum control.
- **PaaS**: "Give me your code, I will run it." Best for developer velocity and modern web applications.
