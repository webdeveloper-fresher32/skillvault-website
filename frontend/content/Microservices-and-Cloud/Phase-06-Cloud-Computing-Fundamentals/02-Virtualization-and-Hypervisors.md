# Virtualization and Hypervisors

Without virtualization, cloud computing as we know it would not exist. 

Historically, companies bought a physical server and installed a single Operating System (OS) on it (like Linux or Windows). If that server ran a web application that only used 10% of the CPU, the remaining 90% was wasted. You couldn't easily run a second, isolated application on the same OS without risk of them crashing each other.

**Virtualization** solves this problem by allowing a single physical machine to act as multiple independent machines.

## How Virtualization Works

Virtualization abstracts the physical hardware (CPU, RAM, Hard Drive) so that it can be divided into multiple, isolated execution environments called **Virtual Machines (VMs)**.

To the software running inside a VM, it appears as though it is running on its own dedicated physical hardware. It has its own isolated OS, its own file system, and its own IP address.

## The Hypervisor (VMM)

The software that makes virtualization possible is called the **Hypervisor** (or Virtual Machine Monitor - VMM). The hypervisor sits between the physical hardware and the VMs. Its job is to allocate CPU time and RAM to each VM and ensure they remain strictly isolated from each other.

### Type 1 Hypervisor (Bare Metal)
Type 1 hypervisors are installed directly on top of the physical server's hardware, replacing the traditional host operating system. 
- **Examples**: VMware ESXi, Microsoft Hyper-V, KVM, Xen (used heavily by AWS).
- **Use Case**: Data centers and enterprise cloud environments. They are incredibly fast and efficient because there is no middleman OS.

### Type 2 Hypervisor (Hosted)
Type 2 hypervisors run as an application on top of a traditional Host OS (like Windows or macOS).
- **Examples**: Oracle VirtualBox, VMware Workstation.
- **Use Case**: Developers running a Linux VM on their Windows laptop for testing. They are slower because traffic must pass through the Host OS.

## Why Virtualization Powers the Cloud (Resource Pooling)

Virtualization is the technology that enables **Resource Pooling** (one of the 5 NIST cloud characteristics).

AWS owns massive physical servers with hundreds of CPU cores and Terabytes of RAM. Using a Type 1 hypervisor (like Nitro/KVM), AWS can carve that single physical server into 50 different EC2 instances (Virtual Machines). 

- Customer A rents VM 1.
- Customer B rents VM 2.
They are on the exact same physical motherboard, but they are securely isolated. This maximizes hardware utilization, allowing cloud providers to offer services cheaply.

## Summary
- Virtualization allows one physical server to be split into multiple Virtual Machines (VMs).
- A **Hypervisor** is the software that manages and isolates these VMs.
- **Type 1** hypervisors run on bare metal (Cloud providers). **Type 2** run on a host OS (Laptops).
- Virtualization is the foundational technology enabling Cloud Resource Pooling.
