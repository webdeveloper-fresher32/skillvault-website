# Ports and Sockets Recap — Complete Guide

## Table of Contents
1. [Why Ports Exist](#1-why-ports-exist)
2. [Well-Known Ports Table](#2-well-known-ports-table)
3. [Port Ranges](#3-port-ranges)
4. [Ephemeral Ports](#4-ephemeral-ports)
5. [What Uniquely Identifies a Socket](#5-what-uniquely-identifies-a-socket)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. Why Ports Exist

An IP address gets a packet to the right **machine**. A port number gets it to the right **process/application** running on that machine. Without ports, a single server could only run one network service at a time — no running a web server, a database, and an SSH daemon on the same box.

```
Server at 192.168.1.50 runs multiple services simultaneously:

  192.168.1.50:22    → SSH daemon
  192.168.1.50:80    → nginx (web server)
  192.168.1.50:443   → nginx (HTTPS)
  192.168.1.50:5432  → PostgreSQL
  192.168.1.50:6379  → Redis

Same IP, different ports → OS routes each incoming packet to the
process that's listening on that specific port.
```

Ports are 16-bit numbers, so they range from 0 to 65535 (2^16 = 65,536 total).

---

## 2. Well-Known Ports Table

These are the ports you'll actually see day to day working with the tools and databases already covered elsewhere in this repo.

| Port | Protocol/Service | Notes |
|---|---|---|
| 22 | SSH | Secure remote shell access |
| 25 | SMTP | Sending email between mail servers |
| 53 | DNS | Domain name resolution (covered in Phase 04) |
| 80 | HTTP | Unencrypted web traffic |
| 443 | HTTPS | Encrypted web traffic (TLS, covered in Phase 06) |
| 3306 | MySQL | MySQL/MariaDB database default port (see MySQL course) |
| 5432 | PostgreSQL | PostgreSQL database default port |
| 6379 | Redis | Redis in-memory data store default port |
| 27017 | MongoDB | MongoDB database default port (see MongoDB course) |
| 5672 | RabbitMQ | AMQP message broker default port |
| 9092 | Kafka | Kafka broker default port |
| 2375/2376 | Docker daemon | Docker API (2376 with TLS) — see Docker course |
| 6443 | Kubernetes API server | Control plane API endpoint — see Kubernetes course |

Ports 0–1023 are the **well-known ports**, officially registered with IANA and traditionally requiring administrator/root privileges to bind to on Unix systems.

---

## 3. Port Ranges

| Range | Name | Notes |
|---|---|---|
| 0 – 1023 | Well-known ports | Reserved for standard services (HTTP, SSH, DNS, etc.), require elevated privileges to bind |
| 1024 – 49151 | Registered ports | Assigned to specific applications by IANA on request (e.g. 3306 MySQL, 5432 PostgreSQL, 27017 MongoDB) but don't require root to bind |
| 49152 – 65535 | Dynamic/private ports | Never assigned to a specific service — used for ephemeral, short-lived client connections |

---

## 4. Ephemeral Ports

When your browser or app initiates an outbound connection (say, to a web server on port 443), it doesn't use port 443 as its own source port — it needs a temporary port to receive the response on. The OS picks a free port from the **ephemeral range** (typically 32768–60999 on Linux, or 49152–65535 per IANA) and uses it as the source port for that one connection.

```
Your laptop making an HTTPS request to google.com:

  Source:      192.168.1.10 : 51342    ← ephemeral port, picked by OS
  Destination: 142.250.183.14 : 443    ← well-known port, google's web server

  When the response comes back, the OS knows to deliver it to
  whichever local process opened port 51342 (your browser tab).
```

Every new outbound connection typically gets a fresh ephemeral port, which is why you can open dozens of browser tabs to the same website simultaneously — each connection is a distinct (local IP, ephemeral port, remote IP, remote port) combination.

---

## 5. What Uniquely Identifies a Socket

A **socket** is one endpoint of a network connection, and it's uniquely identified by a 3-tuple (often described alongside a 4th field for the full picture):

```
Socket = (Local IP, Local Port, Protocol)

A full TCP CONNECTION is uniquely identified by the 5-tuple:
  (Source IP, Source Port, Destination IP, Destination Port, Protocol)
```

This 5-tuple is why a server can handle thousands of simultaneous connections on the same port (e.g. port 443) without confusion — each individual client connection has a different source IP and/or source port, so the OS and the server application can distinguish them even though the destination IP:port is identical for all of them.

```
Server listening on 203.0.113.10:443, handling 3 clients at once:

  Connection 1: (198.51.100.5:51001,  203.0.113.10:443, TCP)
  Connection 2: (198.51.100.9:52200,  203.0.113.10:443, TCP)
  Connection 3: (198.51.100.5:51050,  203.0.113.10:443, TCP)  ← same client
                                                                 IP as #1,
                                                                 different
                                                                 port = a
                                                                 distinct
                                                                 connection
```

Note that connections 1 and 3 come from the same client IP but different source ports — that's enough to make them entirely separate sockets/connections from the server's point of view (e.g. two tabs open to the same site).

---

## 6. Hands-On Exercises

1. Run `netstat -an` (or `ss -tuln` on Linux, `lsof -i -P` on Mac) and list 5 ports currently in LISTEN state on your machine. Identify which service owns each using the well-known ports table.
2. Open your browser, visit a website, then immediately run a socket-listing command and find the ephemeral port your browser is using for that connection.
3. Start a local MongoDB or Redis instance (if installed) and verify it's listening on its default port (27017 or 6379) using `lsof -i :27017` or similar.
4. Explain why running two Docker containers that both want to bind to port 80 on the host will fail, and how you'd fix it using port mapping (e.g. `-p 8081:80` and `-p 8082:80`).
5. Open 3 browser tabs to the same website and use `netstat`/`ss` to find all 3 connections — note that they share the same destination IP:port but differ in source port.

---

## 7. Interview Q&A

**Q: What is the difference between an IP address and a port?**
Answer: An IP address identifies a specific machine on a network. A port identifies a specific process or application running on that machine. Together, IP:port uniquely identifies where to deliver data on a specific host — this is why one server can run a web server, database, and SSH daemon simultaneously on different ports of the same IP.

**Q: What is an ephemeral port and why is it needed?**
Answer: An ephemeral port is a short-lived port number, dynamically assigned by the OS (typically from a high range like 49152-65535) as the source port for outbound client connections. It's needed because the client needs some local port to receive the response on, and using a fixed port would prevent opening multiple simultaneous connections from the same machine.

**Q: What uniquely identifies a network socket/connection?**
Answer: A TCP connection is uniquely identified by the 5-tuple: source IP, source port, destination IP, destination port, and protocol. This is why a server can serve thousands of clients on the same destination port (e.g. 443) simultaneously — each client connection differs in source IP and/or source port.

**Q: Why do ports 0-1023 require elevated/root privileges to bind on Unix systems?**
Answer: They're the "well-known ports" reserved for standard, trusted system services (HTTP, SSH, DNS, etc.). Requiring root to bind them prevents a regular unprivileged user or process from impersonating a well-known service (e.g. spinning up a fake SSH server on port 22) on a shared machine.

**Q: If two browser tabs are open to the same website, how does the OS tell their traffic apart?**
Answer: Each tab's connection uses a different ephemeral source port even though both connect to the same destination IP and port (e.g. 443). Since the full 5-tuple differs (source port is unique per connection), the OS and TCP stack treat them as entirely separate connections and route each response to the correct tab.

**Q: Name the default ports for MySQL, PostgreSQL, MongoDB, and Redis.**
Answer: MySQL defaults to port 3306, PostgreSQL to 5432, MongoDB to 27017, and Redis to 6379. These fall in the "registered ports" range (1024-49151), officially associated with these services but not requiring root privileges to bind.
