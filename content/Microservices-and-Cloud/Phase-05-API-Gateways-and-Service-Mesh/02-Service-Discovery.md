# Service Discovery

In a monolithic architecture, a web application connects to a database using a static IP address or hostname defined in a config file. 

In a modern microservices architecture (especially in cloud environments like Kubernetes or AWS), services are highly dynamic. 
- If traffic spikes, an autoscaler might spin up 10 new instances of the `Order` service.
- If a server crashes, instances die and are recreated on entirely different IP addresses.

If the `Payment` service needs to call the `Order` service, it cannot use a hardcoded IP address in its configuration, because that IP address might be dead 5 minutes from now. 

This is the problem **Service Discovery** solves.

## How Service Discovery Works

Service Discovery is a dynamic registry—a phonebook for microservices.

### 1. Service Registration
When an instance of the `Order` service boots up, the first thing it does is contact the Service Registry (e.g., HashiCorp Consul or Netflix Eureka). It says: *"Hello, I am an Order Service instance, and I am located at IP 10.0.5.21."* 

The Registry adds this instance to its list of healthy `Order` services.

### 2. Service Discovery (Client-Side)
When the `Payment` service wants to call the `Order` service, it does not use a hardcoded IP.
Instead, it asks the Service Registry: *"Give me the IP address of an Order Service."*

The Registry looks at its list, picks a healthy instance (often using Round-Robin load balancing), and returns `10.0.5.21`. The `Payment` service then makes the actual HTTP call to that IP.

## Health Checking

A critical feature of the Service Registry is Health Checking.
The Registry constantly pings every registered service instance every few seconds. 
- If instance `10.0.5.21` stops responding to the health check, the Registry removes it from the phonebook.
- The next time the `Payment` service asks for an IP, the Registry will return a different, healthy instance.

## Modern Platforms (Kubernetes)

If you are using a modern orchestrator like Kubernetes, Service Discovery is built-in.
You do not need to run a standalone tool like Consul or Eureka.

In Kubernetes, you create a `Service` object. Kubernetes automatically gives it an internal DNS name (e.g., `http://order-service.default.svc.cluster.local`). 
Kubernetes manages the dynamic mapping of that DNS name to the underlying, constantly changing Pod IP addresses seamlessly.

## Summary
- Hardcoding IP addresses in microservices is impossible due to dynamic scaling and cloud ephemerality.
- **Service Registration**: Services announce their location to a central registry when they boot up.
- **Service Discovery**: Services query the registry to find the location of other services.
- **Health Checks**: Ensure dead instances are removed from the registry.
