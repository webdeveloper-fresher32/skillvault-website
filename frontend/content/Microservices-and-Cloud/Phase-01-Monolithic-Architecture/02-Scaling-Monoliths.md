# Scaling Monoliths

When a monolithic application experiences increased traffic, it will eventually hit a performance bottleneck. Understanding how monoliths scale is crucial for understanding why microservices exist.

There are two primary ways to scale an application: **Vertical Scaling (Scale Up)** and **Horizontal Scaling (Scale Out)**.

## 1. Vertical Scaling (Scale Up)

Vertical scaling involves adding more resources (CPU, RAM, Disk) to the existing server hosting the monolith.

### How it works
If your server has 16GB of RAM and is struggling, you power it down, upgrade it to an instance with 64GB of RAM, and turn it back on. In AWS, this is as simple as changing an EC2 instance type from `t3.medium` to `t3.2xlarge`.

### Advantages
- **Zero code changes**: The application doesn't need to be modified. It just runs faster because it has more hardware.
- **Easy administration**: You are still managing a single machine and a single database.

### Disadvantages
- **Hard Limits**: There is a physical limit to how large a single server can be. You cannot buy a server with infinite CPU.
- **Cost**: High-end servers grow exponentially in cost. A server with 128GB of RAM costs much more than four servers with 32GB of RAM.
- **Single Point of Failure**: If the single massive server crashes (hardware failure), the entire application goes down.

## 2. Horizontal Scaling (Scale Out)

Horizontal scaling involves adding *more servers* and distributing the traffic across them using a Load Balancer.

### How it works
Instead of one massive server, you run 5 smaller servers, all running identical copies of the monolith. A Load Balancer (like Nginx, AWS ALB, or HAProxy) sits in front of them and routes incoming user requests to the least busy server.

### Technical Deep Dive: Nginx Load Balancer Config
To distribute traffic horizontally, you configure a load balancer. Here is a basic Nginx configuration that routes traffic round-robin to three monolithic servers:

```nginx
http {
    upstream my_monolith {
        server 10.0.0.1:8080; # Server A
        server 10.0.0.2:8080; # Server B
        server 10.0.0.3:8080; # Server C
    }

    server {
        listen 80;
        
        location / {
            proxy_pass http://my_monolith;
        }
    }
}
```

### The Challenge of State
To scale horizontally as shown above, the application must be **Stateless**.

Imagine a user logs in, and the application saves their session data in the server's local RAM (Server A). 
If their next request is routed by the Load Balancer to Server B, Server B does not have their session data. The user is unexpectedly logged out.

**The Solution:**
To scale a monolith horizontally, you must move all state *out* of the application servers.
- **Session Data**: Move to a centralized in-memory cache (like Redis or Memcached).
- **Uploaded Files**: Move to an external object store (like Amazon S3) rather than the local file system.
- **Database**: All nodes must connect to the same centralized database.

*(Note: An anti-pattern to solve this is "Sticky Sessions", where the load balancer forces a specific user to always route to Server A. This is highly discouraged as it leads to uneven load distribution and fails completely if Server A crashes).*

### The Database Bottleneck
While you can easily spin up 50 copies of your web server (Stateless), they all eventually hit the same central database (Stateful).

In a monolith, the database almost always becomes the ultimate bottleneck. Scaling a relational database horizontally (sharding) is incredibly complex and risky, often requiring changes to application logic to determine which database shard holds the correct data.

## Summary
- **Vertical Scaling**: Buy a bigger server. Easy, but has hard limits and creates a single point of failure.
- **Horizontal Scaling**: Buy more servers and use a Load Balancer. Requires the app to be stateless (using Redis/S3).
- **The Ultimate Bottleneck**: Even when horizontally scaled, all instances of a monolith hammer the same centralized database.
