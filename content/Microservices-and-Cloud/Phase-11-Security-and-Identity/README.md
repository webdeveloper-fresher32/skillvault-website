# Phase 11: Security and Identity

In a monolithic architecture, security is often handled at the perimeter. Once a user logs in, the application implicitly trusts all internal method calls.

In a microservices architecture, this "castle and moat" approach is extremely dangerous. An attacker who breaches one microservice can easily pivot and destroy the entire network.

Security must be implemented at every layer, and Identity must be securely propagated across the network.

## Learning Objectives

By the end of this phase, you will understand:
- The principles of Zero Trust Architecture.
- How OAuth 2.0 and OpenID Connect (OIDC) govern authorization and authentication.
- How JSON Web Tokens (JWTs) are used to propagate identity across multiple microservices without hitting a centralized database.

## Files in this Phase

1. `01-Zero-Trust-Architecture.md`: Why the network is inherently hostile.
2. `02-OAuth2-and-OIDC.md`: Delegated access and identity federation.
3. `03-JWTs-in-Microservices.md`: Stateless authentication across distributed systems.
