# Zero Trust Architecture

Historically, corporate networks operated on a **Perimeter Security** model (often called "Castle and Moat"). 

If you were outside the corporate VPN, you were untrusted. If you were inside the VPN, you were fully trusted. 

**The Flaw**: If a hacker successfully breached one single computer inside the VPN (e.g., via a phishing email), they had free rein to move laterally across the entire network, accessing databases and internal applications because everything inside the moat was implicitly trusted.

## What is Zero Trust?

Zero Trust Architecture (ZTA) operates on a simple principle: **Never trust, always verify.**

In a Zero Trust network, there is no "safe" internal network. Every single user, device, and application is considered hostile by default, regardless of whether they are sitting in the corporate headquarters or at a coffee shop.

## Core Principles of Zero Trust

### 1. Verify Explicitly
Every single request to an application must be fully authenticated and authorized based on multiple data points:
- User identity (Passwords + MFA)
- Device health (Is the laptop running the latest antivirus?)
- Location and behavior anomalies (Is the user suddenly logging in from another country?)

### 2. Least Privilege Access
Users and services are granted only the absolute minimum level of access required to perform their job, and only for the duration they need it (Just-In-Time access). 

If a developer only needs to read from the staging database, their account should physically be incapable of writing to it or accessing the production database.

### 3. Assume Breach
You must architect the system assuming that hackers are already inside your network. 
- **Micro-segmentation**: The network is divided into tiny, isolated segments. If a hacker breaches the `Marketing` subnet, they cannot easily jump to the `Payments` subnet.
- **End-to-End Encryption**: Because the internal network is assumed to be compromised, all internal traffic between microservices must be encrypted (usually via mTLS provided by a Service Mesh). A hacker sniffing the internal network should only see encrypted gibberish.

## Zero Trust in Microservices

Zero Trust is the reason why microservices architectures rely so heavily on Service Meshes. The Service Mesh enforces mTLS between every single microservice, ensuring that even if `Service A` is breached, it cannot maliciously call `Service B` without explicit cryptographic authorization.

## Summary
- **Castle and Moat** security fails because once the perimeter is breached, the entire network is compromised.
- **Zero Trust** assumes the network is already hostile.
- Every request must be authenticated, authorized, and encrypted, even if it originates from inside the internal network.
