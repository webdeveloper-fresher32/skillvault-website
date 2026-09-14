# Domain-Driven Design and Microservices

The hardest part of building microservices is not the technology (Docker, Kubernetes, REST APIs). The hardest part is **finding the right boundaries**. 

If you cut your microservices incorrectly, you will end up with high coupling. Services will constantly need to talk to each other to do anything, resulting in terrible performance and the inability to deploy independently (the Distributed Monolith).

To find the right boundaries, engineers use a methodology called **Domain-Driven Design (DDD)**, popularized by Eric Evans in 2003.

## Ubiquitous Language

Before writing code, engineers and domain experts (business stakeholders) must agree on a shared vocabulary called the **Ubiquitous Language**. 

If the business team calls someone a "Shopper" and the engineering team calls them a "User" in the code, confusion ensues. The code must reflect the business reality exactly. A bug in translation is a bug in the software.

## The Problem with Enterprise Models

In a traditional Monolith, architects often try to create a single, massive data model to represent everything in the company. 

Consider a physical `Product` in an E-Commerce company:
- To the **Catalog** team, a `Product` is a title, description, and high-res images.
- To the **Inventory** team, a `Product` is just an ID, a warehouse location, and a quantity.
- To the **Shipping** team, a `Product` is a weight, dimensions, and fragility status.

If you try to create one single `Product` table in a monolith database, it becomes a massive, 100-column table that every team fights over. If the Shipping team wants to add a column, they might accidentally break the Catalog team's queries.

## Bounded Contexts (The Solution)

DDD solves this by dividing the large system into **Bounded Contexts**. 

A Bounded Context is a strict boundary within which a specific domain model applies. The meaning of a word is only valid *inside* its bounded context.

Instead of one massive `Product` table, DDD says:
1. Create a `Catalog` Bounded Context. Inside it, define a `Product` model containing only titles and images.
2. Create an `Inventory` Bounded Context. Inside it, define a `Product` model containing only ID and quantity.
3. Create a `Shipping` Bounded Context. Inside it, define a `Product` model containing only weight and dimensions.

### Technical Deep Dive: Data Models per Context

When translated into JSON for REST APIs, you can see how the exact same physical "iPhone" is represented entirely differently depending on which microservice you ask:

**1. Response from the `Catalog` Microservice:**
```json
{
  "productId": "iphn-15",
  "name": "iPhone 15 Pro",
  "description": "Titanium design with A17 Pro chip.",
  "images": ["https://cdn.example.com/img/iphone15.jpg"],
  "price": 999.00
}
```
*(Notice the Catalog service knows nothing about warehouse shelves or weights).*

**2. Response from the `Inventory` Microservice:**
```json
{
  "inventoryId": "iphn-15",
  "stockCount": 450,
  "warehouseLocation": "Aisle-4-Bin-B",
  "reserved": 12
}
```
*(Notice the Inventory service knows nothing about titles or images, saving massive amounts of memory).*

**3. Response from the `Shipping` Microservice:**
```json
{
  "shippingItemId": "iphn-15",
  "weightGrams": 187,
  "dimensionsMm": { "length": 146.6, "width": 70.6, "depth": 8.2 },
  "isFragile": true,
  "requiresLithiumBatteryWarning": true
}
```

### Mapping Bounded Contexts to Microservices

**A Bounded Context maps perfectly to a Microservice.**

When designing microservices:
1. Identify the Bounded Contexts in your business (e.g., Billing, Shipping, Catalog).
2. Create exactly *one* Microservice per Bounded Context.
3. Give each Microservice its own database, containing only the data models relevant to its specific context.

By aligning your microservices with Bounded Contexts, you ensure they are highly cohesive (everything inside belongs together) and loosely coupled (they don't need to know the inner workings of other services).

## Summary
- Finding the right boundaries is the hardest part of microservices.
- Domain-Driven Design (DDD) is the standard methodology for finding these boundaries.
- Divide your business into Bounded Contexts.
- Create one microservice per Bounded Context, ensuring each only owns the specific subset of data it strictly needs.
