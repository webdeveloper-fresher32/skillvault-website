# JSON Web Tokens (JWTs) in Microservices

In a monolithic application, when a user logs in, the server creates a Session ID, stores it in the central database, and sends it to the user's browser as a cookie. On every subsequent request, the server looks up the Session ID in the database to see who the user is.

This stateful approach is terrible for microservices.
If you have 50 microservices, and every single network call requires a service to query a centralized `Session` database to verify the user, that database will instantly become a massive bottleneck and a single point of failure (destroying independent deployability and scalability).

Microservices require **Stateless Authentication**. The industry standard for this is the **JSON Web Token (JWT)**.

## How JWTs Work

A JWT (pronounced "jot") is a compact, self-contained string that securely transmits information between parties as a JSON object. 

It consists of three parts separated by dots (`.`):
`header.payload.signature`

1. **Header**: Contains the algorithm used to sign the token (e.g., RS256).
2. **Payload**: The actual JSON data (Claims). This contains the user's ID, their role (e.g., `admin`), and the token expiration time.
3. **Signature**: This is the magic. The Identity Provider (Auth0/Google) creates a cryptographic signature using their private key.

## Stateless Verification

When a user logs in via the API Gateway, the Gateway talks to the Identity Provider and receives a JWT. The user's browser sends this JWT in the `Authorization` header on every request.

**Here is why it is stateless:**
1. The API Gateway forwards the request (with the JWT) to the `Order` service.
2. The `Order` service needs to know if the user is an `admin`.
3. The `Order` service does **not** query a database. 
4. The `Order` service simply looks at the JWT signature. Using the Identity Provider's Public Key, the `Order` service performs a mathematical operation to verify the signature. 
5. If the signature is valid, the `Order` service trusts the data in the payload 100%. It knows the user is an `admin` without ever making a network call to an authentication server.

## JWT Propagation

In a Zero Trust Architecture, when the `Order` service needs to call the `Billing` service, it simply passes the exact same JWT along in the HTTP headers. 

The `Billing` service performs the exact same mathematical signature verification locally, ensuring that every service in the chain knows exactly who the user is, securely and statelessly.

## The Drawback: Revocation

Because JWTs are stateless, they cannot be easily revoked. 
If a user clicks "Log Out", or if an administrator bans a user, the JWT they possess remains mathematically valid until its `exp` (expiration) timestamp is reached.

To mitigate this:
1. JWT lifespans must be kept very short (e.g., 15 minutes).
2. Applications use **Refresh Tokens** (long-lived, stateful tokens stored securely in a database) to obtain new short-lived JWTs. If a user is banned, the Refresh Token is deleted, preventing them from getting a new JWT when their current 15-minute token expires.

## Summary
- Stateful session cookies require central database lookups, creating bottlenecks in microservices.
- **JWTs** contain user data and a cryptographic signature.
- Any microservice can verify a JWT statelessly using a public key, eliminating the need for a central auth database.
