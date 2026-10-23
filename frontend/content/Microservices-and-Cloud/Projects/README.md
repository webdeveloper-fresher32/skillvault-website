# Microservices and Cloud Projects

These projects are designed to take the theoretical concepts of Microservices and Cloud Computing and apply them in practical, hands-on scenarios.

## Project List

1. **[Dockerizing a Monolith](./01-Dockerizing-a-Monolith.md)**
   - **Goal:** Take a basic local web application (Node.js or Python) and write a Dockerfile to containerize it.
   - **Skills:** Docker, Containers, 12-Factor App (Dependencies, Port Binding).

2. **[Deploying to AWS](./02-Deploying-to-AWS.md)**
   - **Goal:** Take your Dockerized application and deploy it to the cloud using AWS Elastic Beanstalk (PaaS) or AWS EC2 (IaaS).
   - **Skills:** Cloud Deployment Models, IaaS vs PaaS, Public Cloud.

3. **[Strangler Fig Migration](./03-Strangler-Fig-Migration.md)**
   - **Goal:** Use an API Gateway to slowly route traffic away from a Monolith to a newly extracted Microservice.
   - **Skills:** API Gateways, Routing, Domain-Driven Design boundaries.

4. **[Building a Saga](./04-Building-a-Saga.md)**
   - **Goal:** Build two separate microservices (e.g., Order and Inventory) that communicate asynchronously via a Message Broker (RabbitMQ) to simulate a checkout flow.
   - **Skills:** Asynchronous Communication, Message Brokers, Event-Driven Architecture, Saga Pattern.
