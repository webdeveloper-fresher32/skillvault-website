# 02 - Cloud Service Models

## Table of Contents
1. [The Stack: What Layers Exist?](#the-stack)
2. [IaaS - Infrastructure as a Service](#iaas)
3. [PaaS - Platform as a Service](#paas)
4. [SaaS - Software as a Service](#saas)
5. [The Pizza as a Service Analogy](#pizza-analogy)
6. [Comparison Table: Who Manages What](#comparison-table)
7. [AWS Services Mapped to Each Model](#aws-mapping)
8. [When to Use Which Model](#when-to-use)
9. [Decision Framework](#decision-framework)
10. [Interview Q&A](#interview-qa)

---

## 1. The Stack: What Layers Exist?

Before understanding IaaS/PaaS/SaaS, you need to understand the layers of an IT system. Every IT system has these layers:

```
Full IT Stack (bottom to top):

+----------------------------+
|  APPLICATION               | <- Your code, your business logic
+----------------------------+
|  DATA                      | <- Your databases, files
+----------------------------+
|  RUNTIME                   | <- Node.js, Python, Java runtime
+----------------------------+
|  MIDDLEWARE                | <- Web servers (nginx), message queues
+----------------------------+
|  OPERATING SYSTEM (OS)     | <- Ubuntu, Amazon Linux, Windows Server
+----------------------------+
|  VIRTUALIZATION            | <- VMware, Xen, AWS Nitro Hypervisor
+----------------------------+
|  SERVERS (Hardware)        | <- Physical CPU, RAM, disk
+----------------------------+
|  STORAGE                   | <- Physical hard drives, SSDs, SANs
+----------------------------+
|  NETWORKING                | <- Physical switches, routers, cables
+----------------------------+
|  FACILITIES                | <- Data center building, power, cooling
+----------------------------+

On-Premise: YOU manage ALL of these layers
IaaS:       Provider manages bottom 4, YOU manage top 6
PaaS:       Provider manages bottom 8, YOU manage top 2
SaaS:       Provider manages ALL layers, YOU just use the app
```

---

## 2. IaaS - Infrastructure as a Service

### Definition

IaaS provides virtualized computing infrastructure over the internet. The provider manages the physical hardware, virtualization layer, networking, and storage. You are responsible for everything above that: operating system, middleware, runtime, and application.

**Key principle:** You get virtual machines. You install and manage the OS yourself.

### What the Provider Manages (IaaS)

```
IaaS Responsibility:

Provider manages:                You manage:
+---------------------------+   +---------------------------+
| Facilities (data center)  |   | Application               |
| Networking (physical)     |   | Data                      |
| Servers (hardware)        |   | Runtime (Node.js/Python)  |
| Storage (physical)        |   | Middleware (nginx)        |
| Virtualization (hypervisor)|   | Operating System          |
+---------------------------+   +---------------------------+
```

### Detailed Breakdown of Your Responsibilities in IaaS

1. **Operating System:** You choose, install, configure, and patch the OS. Ubuntu 22.04? Amazon Linux 2023? Windows Server 2022? Your choice, your responsibility.

2. **Runtime:** If your app needs Node.js 20, Python 3.11, or Java 17 — you install it. You keep it updated.

3. **Middleware:** You set up nginx as a reverse proxy, Apache as a web server, RabbitMQ as a message queue. You configure and maintain these.

4. **Application:** You deploy your code.

5. **Data:** You manage your databases. You handle backups (though you can use managed database services as an add-on).

6. **Security:** OS-level security, firewall rules, patching for vulnerabilities.

### IaaS Examples

**AWS IaaS Services:**
- **EC2 (Elastic Compute Cloud):** Virtual machines. You get a bare VM, you decide what to install.
- **EBS (Elastic Block Store):** Virtual hard drives you attach to EC2 instances.
- **VPC (Virtual Private Cloud):** Your own virtual network within AWS.
- **Elastic Load Balancing (ELB):** Load balancers (though this is borderline PaaS).

**Other IaaS Providers:**
- Microsoft Azure: Azure Virtual Machines
- Google Cloud: Compute Engine
- DigitalOcean: Droplets
- Linode: Linode Instances

### IaaS Use Cases

1. **Full Control Required:** You need to customize the OS kernel, install specific software versions, or use configurations not available in managed services.

2. **Legacy Application Migration ("Lift and Shift"):** Move an existing application to cloud with minimal changes. If it runs on Windows Server 2016 with specific settings — just spin up a Windows Server 2016 EC2 instance.

3. **High-Performance Computing:** Running scientific simulations that need specific CPU architectures.

4. **Custom Database Configuration:** Running a database with very specific tuning parameters that a managed service (RDS) doesn't support.

5. **Cost Optimization at Scale:** At very large scale, running your own software on EC2 can be cheaper than managed services.

**Real Example:** A company running a legacy Java application with specific JVM settings and a customized Linux kernel. They can't use PaaS because PaaS doesn't support their specific configurations. They use EC2 (IaaS).

### IaaS Pros and Cons

**Pros:**
- Maximum flexibility and control
- Can run any software, any configuration
- Good for lift-and-shift migrations
- More customizable than PaaS/SaaS

**Cons:**
- You manage OS patching and security
- More operational overhead
- Need Linux/Windows admin skills
- You're responsible for availability at the OS level
- More time managing infrastructure, less time on application

---

## 3. PaaS - Platform as a Service

### Definition

PaaS provides a platform allowing customers to develop, run, and manage applications without dealing with infrastructure. The provider manages everything up to the runtime — you only write application code and manage your data.

**Key principle:** You provide the code. The platform runs it.

### What the Provider Manages (PaaS)

```
PaaS Responsibility:

Provider manages:                You manage:
+---------------------------+   +---------------------------+
| Facilities (data center)  |   | Application               |
| Networking (physical)     |   | Data                      |
| Servers (hardware)        |   +---------------------------+
| Storage (physical)        |   
| Virtualization            |   
| Operating System          |   
| Runtime (Node/Python/etc) |   
| Middleware                |   
+---------------------------+   
```

### The Paradigm Shift in PaaS

With IaaS, you think: "I have a server, what do I install on it?"
With PaaS, you think: "I have code, where do I run it?"

You don't manage servers. The platform handles:
- OS updates automatically
- Runtime updates (you choose the version, platform applies security patches)
- Horizontal scaling (often automatically)
- Load balancing (usually included)
- Infrastructure monitoring

### PaaS Examples

**AWS PaaS Services:**
- **Elastic Beanstalk:** Upload your code (Node.js, Python, Java, Ruby, .NET, PHP), Beanstalk provisions EC2, Load Balancer, Auto Scaling Group automatically. You just push code.
- **RDS (Relational Database Service):** Managed database. You get MySQL, PostgreSQL, etc. without managing the OS, installation, or failover configuration.
- **Lambda (Serverless — FaaS, a subset of PaaS):** Upload a function, it runs when triggered. No servers at all.
- **ECS/EKS (Container Services):** Run containers without managing the orchestration platform.

**Other PaaS Examples:**
- Heroku: git push heroku main — your app is deployed
- Google App Engine
- Azure App Service
- Salesforce Force.com (custom app development platform)

### PaaS Use Cases

1. **Rapid Development:** Focus on writing code, not configuring infrastructure. A startup can deploy in minutes.

2. **Standard Web Applications:** Node.js API, Python Django app, Ruby on Rails — standard frameworks deploy perfectly on PaaS.

3. **Managed Databases:** Use RDS instead of self-managing MySQL on EC2. AWS handles backups, patches, Multi-AZ failover.

4. **Teams Without DevOps Expertise:** If your team is developers without sysadmin skills, PaaS lets you deploy without learning infrastructure.

5. **Microservices:** Each service deployed independently on its own PaaS environment.

**Real Example:** A small startup building a web application. Developers use Elastic Beanstalk — they push code and the platform handles everything else. No sysadmin hired.

### PaaS Pros and Cons

**Pros:**
- Much faster to deploy
- Provider handles OS/runtime patching
- Built-in scaling options
- No infrastructure management
- Great for standard web applications

**Cons:**
- Less control (can't customize OS-level settings)
- Lock-in to provider's platform
- May be more expensive than IaaS for the same compute
- Limited runtime options (whatever the platform supports)
- Debugging infrastructure issues is harder (less visibility)

---

## 4. SaaS - Software as a Service

### Definition

SaaS delivers software applications over the internet, on demand, typically on a subscription basis. The provider manages everything — infrastructure, platform, application, and data (though your data is stored on their platform). You simply use the software through a web browser or thin client.

**Key principle:** You use the software, you manage nothing technical.

### What the Provider Manages (SaaS)

```
SaaS Responsibility:

Provider manages:                You manage:
+---------------------------+   +---------------------------+
| Facilities (data center)  |   | Your Business Process     |
| Networking (physical)     |   | (How you use the app)     |
| Servers (hardware)        |   | Your user accounts/data   |
| Storage (physical)        |   +---------------------------+
| Virtualization            |   
| Operating System          |   
| Runtime                   |   
| Middleware                |   
| Application               |   
| Data storage              |   
+---------------------------+   
```

### SaaS Examples

**Common SaaS Products:**
- **Gmail / Google Workspace:** Email, calendar, documents. Google manages all infrastructure.
- **Salesforce:** CRM platform. Salesforce manages everything; you manage your sales data.
- **Slack:** Team messaging. Slack manages the platform.
- **Zoom:** Video conferencing.
- **Dropbox / Google Drive:** File storage.
- **GitHub:** Code repository hosting.
- **Jira / Confluence:** Project management.
- **Shopify:** E-commerce platform.
- **HubSpot:** Marketing automation.

**AWS SaaS Services:**
- **Amazon WorkMail:** Managed business email
- **Amazon Chime:** Video conferencing and messaging
- **AWS Managed Microsoft AD:** Managed Active Directory

### SaaS Use Cases

1. **Email and Collaboration:** Gmail, Outlook 365 — no company should run their own email server.

2. **CRM:** Salesforce, HubSpot — instead of building customer relationship management software.

3. **HR Systems:** Workday, BambooHR — payroll, employee management.

4. **Accounting:** QuickBooks Online, Xero — financial management.

5. **Communication:** Slack, Teams, Zoom — team collaboration.

**Real Example:** A company replaces their on-premise Exchange email server with Office 365 (Microsoft 365). They no longer manage servers, backups, patches. They just log in and use email.

### SaaS Pros and Cons

**Pros:**
- No technical management required
- Access from any device, anywhere
- Automatic updates
- Subscription model — predictable cost
- No upfront investment
- Immediate availability

**Cons:**
- No customization of the underlying platform
- Data stored on third-party servers (security/compliance concern)
- Dependent on provider's uptime
- Ongoing subscription cost (vs one-time purchase)
- Limited ability to export all your data (vendor lock-in)
- Internet dependent

---

## 5. The Pizza as a Service Analogy

This analogy perfectly captures the difference between service models. It's used in interviews and on Microsoft/AWS certification exams.

```
Scenario: You want to eat pizza.

=====================================================================
TRADITIONAL IT           |  EQUIVALENT TO: Making pizza at home
(On-Premise)             |
---------------------------------------------------------
You manage:              |
  - Buying ingredients   |  -> Buying hardware, software licenses
  - Making the dough     |  -> Installing OS
  - Preparing toppings   |  -> Configuring middleware
  - Baking the pizza     |  -> Running the application
  - Serving it           |  -> Managing the application
  - Cleaning up          |  -> Ongoing maintenance
                         |
Full control, maximum    |  Full control, maximum effort
effort                   |
=====================================================================
IAAS                     |  EQUIVALENT TO: Cooking pizza in a
                         |  rented kitchen (e.g., commercial kitchen)
---------------------------------------------------------
Provider gives you:      |
  - Oven (virtualization)|  -> Hypervisor, physical servers
  - Kitchen space (data  |  -> Data center, networking
    center)              |
                         |
You still manage:        |
  - Buying ingredients   |  -> Installing OS, runtime
  - Making the pizza     |  -> Configuring and running application
  - Serving it           |  -> Application management
                         |
You get infrastructure   |  You get hardware/VM,
but you cook             |  you manage rest
=====================================================================
PAAS                     |  EQUIVALENT TO: Getting a pizza kit
                         |  (like Hello Fresh for pizza)
---------------------------------------------------------
Provider gives you:      |
  - Pre-made dough       |  -> OS, runtime, middleware pre-installed
  - Ingredients          |  -> Platform capabilities
  - Instructions         |  -> Documentation, tools
                         |
You manage:              |
  - Assembling/topping   |  -> Writing your application code
  - Baking (automated)   |  -> Deploying code (platform handles rest)
                         |
You focus on creativity  |  You focus on application code
(the toppings = app)     |  not infrastructure
=====================================================================
SAAS                     |  EQUIVALENT TO: Ordering pizza delivery
                         |  from a restaurant (Dominos/UberEats)
---------------------------------------------------------
Provider manages:        |
  - All ingredients      |  -> All infrastructure
  - All preparation      |  -> All software
  - Cooking              |  -> Running and maintaining
  - Delivery             |  -> Making available to you
                         |
You just:                |
  - Order via app/phone  |  -> Log in and use the software
  - Eat the pizza        |  -> Use the application
  - Pay per order        |  -> Pay subscription
                         |
Zero involvement in      |  Zero involvement in
making the pizza         |  technical implementation
=====================================================================

On-Premise -> IaaS -> PaaS -> SaaS
More Control             More Convenience
More Effort              Less Effort
```

---

## 6. Comparison Table: Who Manages What

This is the most important table for certifications and interviews.

| Layer | On-Premise | IaaS | PaaS | SaaS |
|-------|------------|------|------|------|
| **Application** | You | You | You | Provider |
| **Data** | You | You | You | Provider |
| **Runtime** | You | You | Provider | Provider |
| **Middleware** | You | You | Provider | Provider |
| **Operating System** | You | You | Provider | Provider |
| **Virtualization** | You | Provider | Provider | Provider |
| **Servers (Hardware)** | You | Provider | Provider | Provider |
| **Storage (Physical)** | You | Provider | Provider | Provider |
| **Networking (Physical)** | You | Provider | Provider | Provider |
| **Facilities (DC)** | You | Provider | Provider | Provider |

**Color coding:**
- Rows 1-2 (Application, Data): You always manage your own application and data (except SaaS where provider hosts the data)
- Rows 3-5 (Runtime, Middleware, OS): The "platform" layers — key differentiator
- Rows 6-10 (Physical): Always managed by provider in cloud

**Key insight for interviews:** The question "What does the customer manage?" is:
- IaaS: Everything from OS and above
- PaaS: Only application and data
- SaaS: Nothing (just configuration/usage)

---

## 7. AWS Services Mapped to Each Model

### AWS IaaS Services

| Service | What it is | You manage |
|---------|------------|------------|
| **EC2** | Virtual machines | OS, runtime, app |
| **EBS** | Virtual block storage | Filesystem, data |
| **VPC** | Virtual network | Subnets, routing, firewall rules |
| **S3** | Object storage | What you store in it |
| **Direct Connect** | Dedicated network to AWS | Your on-prem side |
| **Route 53** | DNS service | DNS records you create |

### AWS PaaS Services

| Service | What it is | You manage |
|---------|------------|------------|
| **Elastic Beanstalk** | App deployment platform | App code, config |
| **RDS** | Managed relational database | DB schema, queries, data |
| **ElastiCache** | Managed Redis/Memcached | Cache config, data |
| **Lambda** | Serverless functions (FaaS) | Function code |
| **ECS/EKS** | Container orchestration | Container images |
| **DynamoDB** | Managed NoSQL database | Tables, data |
| **SQS** | Managed message queue | Queue config, messages |
| **SNS** | Managed notification service | Topics, subscriptions |
| **CloudFront** | Managed CDN | Distribution config |
| **EMR** | Managed Hadoop/Spark | Data processing jobs |

### AWS SaaS Services

| Service | What it is |
|---------|------------|
| **WorkMail** | Managed business email |
| **Chime** | Video/voice/chat |
| **Connect** | Contact center service |
| **QuickSight** | Business intelligence and reporting |
| **Rekognition** | Image/video analysis (AI API) |
| **Translate** | Machine translation |

**Note:** Most AWS services fall into the "Managed Services" (PaaS) category. This is the core value of AWS — taking operational burden away from you.

---

## 8. When to Use Which Model

### Choose IaaS When:

```
Decision: Should I use IaaS (EC2)?

Is your application:
  - Running unusual OS or kernel configurations?  -> YES -> IaaS
  - A legacy app needing lift-and-shift?          -> YES -> IaaS
  - Requiring specific hardware (GPU, FPGA)?      -> YES -> IaaS
  - Using software not supported by PaaS?         -> YES -> IaaS
  - Running licensed software (SQL Server, etc)
    where you control the license?                -> YES -> IaaS
  
  Otherwise -> Consider PaaS
```

**Use IaaS:**
- Migrating legacy applications with minimal changes
- Needing OS-level customization
- Running specific software that PaaS doesn't support
- HPC workloads needing specific hardware
- When you need the lowest-level control

### Choose PaaS When:

```
Decision: Should I use PaaS (Beanstalk/RDS)?

Is your application:
  - A standard web app in Node/Python/Java/Ruby/PHP? -> YES -> PaaS
  - Using a standard database (MySQL/Postgres)?       -> YES -> PaaS (RDS)
  - Needing quick deployment with less ops work?      -> YES -> PaaS
  - Event-driven with unpredictable load?             -> YES -> Lambda (FaaS)
  - Running in containers?                            -> YES -> ECS/EKS
```

**Use PaaS:**
- New application development (greenfield)
- Standard web application frameworks
- Teams without dedicated ops/sysadmin
- Managed databases (almost always prefer RDS over self-managed DB on EC2)
- Serverless workloads (Lambda)

### Choose SaaS When:

**Use SaaS:**
- Standard business functions (email, CRM, HR, accounting)
- Tools where customization is not needed
- Functions that aren't core competencies of your business
- When you want zero operational overhead
- Small teams that can't manage infrastructure

---

## 9. Decision Framework

```
Cloud Service Model Decision Tree:

START: "I need to run something"
         |
         v
Is this a standard business function
(email, CRM, payroll, video conferencing)?
    |               |
   YES              NO
    |               |
    v               v
Use SaaS         Is my application
(Gmail,          packaged/code I write?
Salesforce,          |        |
Zoom, etc.)         YES       NO (custom hardware need?)
                     |        |
                     v        v
              Do I need     Use IaaS (EC2)
              to manage      or specialized
              the OS?        hardware
               |       |
              YES       NO
               |        |
               v        v
           Use IaaS   Use PaaS
           (EC2)      (Beanstalk,
                       Lambda,
                       RDS, ECS)
```

### Practical Scenarios and Answers

**Scenario 1:** A startup needs to deploy a Python Django web application with PostgreSQL database. They have 2 developers and no sysadmin.
- **Answer:** PaaS — Elastic Beanstalk for the Django app (or ECS with Docker), RDS for PostgreSQL. No OS management needed.

**Scenario 2:** A bank is migrating a 15-year-old Windows application that requires Windows Server 2008 R2 with specific registry settings.
- **Answer:** IaaS — EC2 with Windows Server AMI. They need OS-level control.

**Scenario 3:** A company needs business email for 50 employees.
- **Answer:** SaaS — Google Workspace or Microsoft 365. No reason to run your own email server.

**Scenario 4:** A data science team needs to run Spark jobs on large datasets.
- **Answer:** PaaS — AWS EMR (managed Spark/Hadoop). Or even more managed: AWS Glue.

**Scenario 5:** A game company needs to run GPU-accelerated simulations with custom CUDA kernel configurations.
- **Answer:** IaaS — EC2 P3/G4 GPU instances. They need OS-level GPU driver control.

---

## 10. Interview Q&A

### Q1: What is the difference between IaaS, PaaS, and SaaS?

**Answer:** These are three cloud service models defined by how much the provider manages:
- **IaaS** provides virtualized hardware. You manage OS and everything above. Example: EC2. Best for custom environments and lift-and-shift migrations.
- **PaaS** provides the platform, including OS and runtime. You manage only your application code and data. Example: Elastic Beanstalk, RDS. Best for standard web apps.
- **SaaS** delivers complete software. Provider manages everything. You just use the app. Example: Gmail, Salesforce. Best for standard business functions.

The key distinction is how many layers you manage vs the provider.

---

### Q2: Where does EC2 fit in the service model?

**Answer:** EC2 is IaaS. AWS provides the physical hardware, data center, networking, and hypervisor (Nitro). You are responsible for the OS, runtime, middleware, application, and data. When you launch an EC2 instance, you choose an AMI (OS image), and everything from the OS upward is your responsibility.

---

### Q3: Where does RDS fit in the service model?

**Answer:** RDS is PaaS. AWS manages the OS, database engine installation, patching, backups, replication, and failover. You manage only the database itself — creating schemas, tables, queries, and managing the data. You don't SSH into an RDS instance or patch it yourself.

---

### Q4: What is FaaS and how does it relate to PaaS?

**Answer:** FaaS (Function as a Service), sometimes called Serverless, is a subset of PaaS. Like PaaS, the provider manages all infrastructure and runtime. But FaaS goes further — you don't even think in terms of servers or containers. You write individual functions, upload them, and they run when triggered. AWS Lambda is the main FaaS offering. You pay per invocation rather than per hour. It's the most abstract service model — maximum managed, minimum control.

---

### Q5: What is the shared responsibility model?

**Answer:** The AWS Shared Responsibility Model defines what AWS secures vs what the customer secures. AWS is responsible for security "of the cloud" — physical infrastructure, hardware, hypervisor, managed service platforms. Customers are responsible for security "in the cloud" — their operating systems (in IaaS), application code, data, identity/access management, and network configuration. The model shifts based on service type: with IaaS (EC2), you're responsible for OS patching; with PaaS (RDS), AWS patches the database engine. With SaaS, AWS handles nearly everything security-related.

---

### Q6: Can you give a real-world example of when you'd choose IaaS over PaaS?

**Answer:** If a company is migrating a legacy Java EE application that requires WebSphere Application Server (IBM) with specific JVM settings and a custom security library that must be installed at the OS level — this doesn't fit into Elastic Beanstalk (PaaS) because PaaS only supports certain runtimes and doesn't allow OS-level customization. They'd use EC2 (IaaS), install the OS, install WebSphere, configure JVM settings, and deploy the app. This is a lift-and-shift migration where IaaS is appropriate.

---

### Q7: What are the pros and cons of SaaS?

**Answer:**
**Pros:** No infrastructure management, access from anywhere, automatic updates, immediate availability, subscription pricing (no upfront cost), provider handles security of the platform.

**Cons:** Limited customization, data stored on third-party servers (compliance risk), vendor lock-in, internet dependency, ongoing subscription costs, limited control over features and roadmap.

---

### Q8: Which cloud service model is most used in AWS for production workloads?

**Answer:** PaaS services are extremely common for production workloads because they strike the best balance of control and managed operations. RDS for databases (vs managing MySQL on EC2), Lambda for event-driven functions, ECS/EKS for containers, and Elastic Beanstalk or custom CI/CD pipelines for application deployment. Most AWS "Well-Architected" solutions heavily use managed PaaS services to reduce operational overhead. However, EC2 (IaaS) is still the foundational service that many architectures build on.

---

### Q9: What is the "pizza as a service" analogy?

**Answer:** It illustrates the different levels of responsibility:
- On-premise = making pizza at home (you do everything: buy ingredients, make dough, cook, serve)
- IaaS = renting a commercial kitchen (provider gives you the kitchen/oven, you still cook)
- PaaS = getting a pizza kit like Hello Fresh (ingredients provided, you assemble and cook)
- SaaS = ordering delivery from Dominos (someone else does everything, you just eat/pay)

The more "as a Service," the less you do yourself, but the less control you have.

---

### Q10: What does "vendor lock-in" mean in the context of PaaS?

**Answer:** Vendor lock-in means your application becomes dependent on a specific provider's platform, making it hard to migrate to another provider. For example, if you build heavily on AWS Lambda (using Lambda-specific event sources and Layers), migrating to GCP Cloud Functions requires significant changes. With IaaS, you install standard nginx on Ubuntu — that can run on any cloud, so less lock-in. With PaaS/SaaS, you're more dependent on the provider's specific implementation. Mitigation strategies include using open standards (containers, Kubernetes), open-source software, and avoiding proprietary services where alternatives exist.
