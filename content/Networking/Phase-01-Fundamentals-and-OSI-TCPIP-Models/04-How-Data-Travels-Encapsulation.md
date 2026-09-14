# How Data Travels — Encapsulation — Complete Guide

## Table of Contents
1. [What is Encapsulation?](#1-what-is-encapsulation)
2. [Worked Example — Tracing an HTTP Request](#2-worked-example--tracing-an-http-request)
3. [The Growing Envelope — ASCII Diagram](#3-the-growing-envelope--ascii-diagram)
4. [De-encapsulation — The Reverse Journey](#4-de-encapsulation--the-reverse-journey)
5. [PDU Names at Each Layer](#5-pdu-names-at-each-layer)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. What is Encapsulation?

When an application on your machine sends data to an application on another machine, that data doesn't travel alone. As it moves **down** the protocol stack (Lesson 02/03), each layer wraps the data from the layer above it inside its own header (and sometimes a trailer), adding the information *that layer* needs to do its job — without needing to understand or modify what's already inside.

```
Encapsulation = wrapping data in a new header (like a letter,
                 then an envelope, then a mailbag, then a delivery truck)

Each layer adds ITS OWN header to what it received from the layer above.
It never looks inside the previous layer's payload — it treats it as
opaque data.
```

This is only possible *because* of layering (Lesson 02): each layer has a narrow, well-defined job, so it only needs to add the small piece of metadata relevant to that job — a port number, an IP address, a MAC address — and pass the whole thing down.

```
┌─────────────────────────────────────────────────────────┐
│ Analogy: Mailing a letter across the world                │
│                                                             │
│  Letter (your message)                                     │
│    → sealed in an envelope with recipient's street address │
│      → placed in a mailbag addressed to the destination city│
│        → loaded onto a truck/plane routed via a highway    │
│                                                             │
│  Each wrapping adds exactly what's needed for ITS job:      │
│  local delivery, city routing, or physical transport.       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Worked Example — Tracing an HTTP Request

Suppose your browser sends `GET /index.html` to a web server. Here's what happens as that request moves down the stack, layer by layer, before it ever touches the wire.

### Step 1 — Application Layer: HTTP Data

The browser builds the raw HTTP request text. This is just data at this point — no networking headers yet.

```
GET /index.html HTTP/1.1
Host: www.example.com
```

### Step 2 — Transport Layer: Add a TCP Header

The OS's TCP/IP stack hands this data to TCP, which wraps it in a **TCP header** containing (among other things) the source port (a random high port, e.g., 51342), the destination port (443 for HTTPS, or 80 for HTTP), and a sequence number for ordering.

```
[ TCP Header ] [ HTTP request data ]
     │
     └── Source Port: 51342   Destination Port: 80
```

This combination — TCP header + HTTP data — is now called a **TCP segment**.

### Step 3 — Network Layer: Add an IP Header

The TCP segment is handed to IP, which wraps it in an **IP header** containing the source IP address (your machine) and the destination IP address (the web server, already resolved via DNS — see Phase 04).

```
[ IP Header ] [ TCP Header ] [ HTTP request data ]
     │
     └── Source IP: 192.168.1.10   Destination IP: 93.184.216.34
```

This combination is now called an **IP packet**.

### Step 4 — Data Link Layer: Add an Ethernet Header and Trailer

The IP packet is handed to the network interface driver, which wraps it in an **Ethernet header** (containing the source and destination **MAC addresses** — for the very first hop only, usually your machine and your router) plus a small **trailer** (an FCS/checksum used to detect transmission errors).

```
[ Ethernet Header ] [ IP Header ] [ TCP Header ] [ HTTP data ] [ Ethernet Trailer ]
     │                                                                │
     └── Src MAC: aa:bb:cc:...   Dst MAC: router's MAC                └── FCS (error check)
```

This full package is now called an **Ethernet frame** — the actual bits transmitted onto the wire (Layer 1).

---

## 3. The Growing Envelope — ASCII Diagram

Each layer's header wraps everything handed down from above, so the data literally grows a new "envelope" at every step:

```
Application  │                         HTTP Data                              │
             └─────────────────────────────────────────────────────────────────┘

Transport    │  TCP Hdr  │             HTTP Data                              │
             └───────────┴─────────────────────────────────────────────────────┘

Network      │ IP Hdr │  TCP Hdr  │             HTTP Data                     │
             └────────┴───────────┴────────────────────────────────────────────┘

Data Link    │Eth Hdr│ IP Hdr │  TCP Hdr  │        HTTP Data        │Eth Trailer│
             └───────┴────────┴───────────┴─────────────────────────┴───────────┘
                                        ▼
                         Transmitted as raw bits (Layer 1)
```

Notice: nothing already wrapped is ever opened or modified by a lower layer — IP doesn't look inside the TCP header, and Ethernet doesn't look inside the IP header. Each layer only reads its **own peer layer's header** on the receiving end.

---

## 4. De-encapsulation — The Reverse Journey

When the frame arrives at the destination, the exact same process happens **in reverse** — each layer strips off its own header, checks it, and hands the remainder up to the layer above.

```
   Receiving host
┌────────────────────────────────────────────────────────────────┐
│ 1. NIC receives raw bits → reassembles the Ethernet frame       │
│ 2. Data Link layer reads Ethernet header, verifies trailer(FCS),│
│    strips both → hands IP packet up to Network layer            │
│ 3. Network layer reads IP header (checks destination IP is      │
│    this machine), strips it → hands TCP segment up to Transport │
│ 4. Transport layer reads TCP header (checks port, sequence,     │
│    reassembles/orders segments), strips it → hands raw data up  │
│    to Application layer                                          │
│ 5. Application layer (the web server) reads the HTTP request    │
│    text and processes it                                         │
└────────────────────────────────────────────────────────────────┘
```

```
[Eth Hdr][IP Hdr][TCP Hdr][ HTTP Data ][Eth Trailer]   ← arrives as one frame
    │
    ▼ strip Ethernet header + trailer
        [IP Hdr][TCP Hdr][ HTTP Data ]
            │
            ▼ strip IP header
                [TCP Hdr][ HTTP Data ]
                    │
                    ▼ strip TCP header
                        [ HTTP Data ]  ← delivered to the web server application
```

If the server needs to reply (e.g., with an HTML page), the exact same encapsulation process happens again in the opposite direction — the server's response gets its own new TCP/IP/Ethernet headers added as it travels back to your browser.

**Important nuance:** MAC addresses (Layer 2) change at every hop along the route — each router strips the incoming frame's Ethernet header and adds a brand new one addressed to the next hop's MAC address. IP addresses (Layer 3), by contrast, stay the same source/destination for the entire journey, end to end. This is exactly why routers ("Layer 3 devices") forward packets, while the frame around each packet gets rebuilt hop by hop.

---

## 5. PDU Names at Each Layer

Each layer's Protocol Data Unit (PDU) — the "unit" of data with that layer's header attached — has its own name. This vocabulary shows up constantly in interviews and documentation.

| Layer | PDU Name | What's Added |
|-------|----------|----------------|
| Application (L7) | Data / Message | The raw application content (HTTP request, DNS query, etc.) |
| Transport (L4) | Segment (TCP) / Datagram (UDP) | Source & destination port numbers, sequencing (TCP) |
| Network (L3) | Packet | Source & destination IP addresses |
| Data Link (L2) | Frame | Source & destination MAC addresses, trailer/FCS |
| Physical (L1) | Bits | Raw electrical/optical/radio signal — no header, just the transmitted bits |

```
Quick recall:
  "Segmentize, Packetize, Framize, Bit-ize" (informal, but memorable)
  Data → Segment → Packet → Frame → Bits
```

---

## 6. Hands-On Exercises

**Exercise 1:** Draw the growing "envelope" diagram from Section 3 from memory, labeling which header is added at which layer and what each header contains.

**Exercise 2:** Open Wireshark (or any packet capture tool) on your machine, capture traffic while loading a webpage, and open a single HTTP/TCP packet. Identify the Ethernet header, IP header, and TCP header sections in the packet details pane.

**Exercise 3:** Explain in your own words why a router needs to rewrite the Ethernet header (Layer 2) at every hop, but never needs to rewrite the IP header's source/destination addresses (Layer 3) along the way.

**Exercise 4:** For a UDP-based DNS query, list the PDU name at each layer (Application, Transport, Network, Data Link) — note how it differs from the TCP example in this lesson (datagram instead of segment).

**Exercise 5:** Sketch the de-encapsulation sequence (Section 4) for a packet arriving at your laptop, labeling which header is stripped at which layer and what gets checked before stripping it (e.g., destination IP match, port match).

---

## 7. Interview Q&A

**Q: What is encapsulation in networking?**
Answer: Encapsulation is the process of wrapping data with a new protocol header (and sometimes a trailer) as it moves down the protocol stack, with each layer adding only the metadata relevant to its own job — ports and sequencing at Transport, IP addresses at Network, MAC addresses at Data Link — without inspecting or altering the payload it received from the layer above.

**Q: Trace what happens to an HTTP request as it travels from the Application layer down to the wire.**
Answer: The HTTP request text starts as raw application data. The Transport layer wraps it in a TCP header (with source/destination ports) to form a TCP segment. The Network layer wraps that in an IP header (with source/destination IP addresses) to form an IP packet. The Data Link layer wraps that in an Ethernet header (with source/destination MAC addresses) plus a trailer (FCS/checksum) to form an Ethernet frame, which is finally transmitted as raw bits over the physical medium.

**Q: What is de-encapsulation, and how does it relate to encapsulation?**
Answer: De-encapsulation is the exact reverse process, happening at the receiving host: each layer strips off and processes its own header (and hands the remainder up to the layer above) as data moves up the stack — Data Link strips the Ethernet header/trailer, Network strips the IP header, Transport strips the TCP header, and finally the Application layer receives the original raw data.

**Q: Why do MAC addresses change at every hop, but IP addresses stay the same for the whole journey?**
Answer: IP addresses (Layer 3) identify the ultimate source and destination end-to-end and remain constant for the packet's entire trip across the network. MAC addresses (Layer 2) only identify devices on the same local network segment, so every router along the path strips the incoming Ethernet frame and builds a brand new one addressed to the next hop's MAC address — while leaving the IP header inside untouched.

**Q: What are the PDU (Protocol Data Unit) names at each layer, from Application down to Physical?**
Answer: Application layer data is called a Message (or just Data); Transport layer adds a header to form a Segment (TCP) or Datagram (UDP); Network layer adds a header to form a Packet; Data Link layer adds a header and trailer to form a Frame; Physical layer transmits raw Bits with no header at all.

**Q: Why doesn't a lower layer (e.g., Ethernet) need to understand what's inside the data it's wrapping?**
Answer: Because of strict layering, each layer treats the data handed down from above as an opaque payload — it only needs to add its own header for its own concern (like local delivery via MAC addresses) and doesn't need to parse or understand IP addresses, ports, or HTTP content. This separation is what allows layers to evolve independently (e.g., swapping Ethernet for Wi-Fi) without touching anything above them.
