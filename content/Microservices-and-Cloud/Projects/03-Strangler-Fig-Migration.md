# Project 3: Strangler Fig Migration

The "Strangler Fig" pattern is the industry standard for migrating a monolithic application to microservices without experiencing downtime. You slowly "strangle" the monolith by routing specific API paths to newly built microservices.

## The Goal
Use an API Gateway (like Nginx) to route traffic between a legacy Monolith and a new Microservice.

## Requirements

1. **The Legacy Monolith**: 
   - Create a simple web server running on port `8080`.
   - It should have two endpoints: `/api/users` (returns `{ "users": ["Alice", "Bob"] }`) and `/api/products` (returns `{ "products": ["Laptop", "Mouse"] }`).
2. **The New Microservice**:
   - Create a brand new web server running on port `8081`.
   - This service will take over the Products domain. 
   - It should have one endpoint: `/api/products` (returns `{ "products": ["Laptop", "Mouse", "Keyboard (NEW!)"] }`).
3. **The API Gateway (Nginx)**:
   - Run an Nginx server (usually via Docker) on port `80`.
   - Configure the `nginx.conf` routing rules:
     - Route all traffic going to `/api/users` to the Monolith on `8080`.
     - Route all traffic going to `/api/products` to the new Microservice on `8081`.
4. **Testing**:
   - Make a `curl` request to `localhost:80/api/users`. It should hit the monolith.
   - Make a `curl` request to `localhost:80/api/products`. It should hit the new microservice and return the "Keyboard (NEW!)" data.

## Why this matters
You have successfully decoupled the Products domain from the monolith without the client (the user) ever knowing the underlying architecture changed. This is how massive enterprises migrate to microservices over a period of years safely.
