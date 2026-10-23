# Project 02 — Serverless URL Shortener

## Goal

Create an entirely serverless URL shortener application that generates short codes for long URLs, stores the mapping in a NoSQL database, and performs HTTP redirects, running entirely on a local emulated stack.

## What You'll Build

A serverless application composed of a local DynamoDB table `url-mapping-table`, two Node.js Lambda functions (`createShortCode` and `redirectUrl`), and an API Gateway mapping the routes:
- `POST /shorten`: Accepts `{ "longUrl": "..." }` and returns a generated short code (e.g. `xyz123`).
- `GET /{shortCode}`: Performs a `302 Found` HTTP redirect to the mapped long URL.

## Phases Required

- Phase 4 — DynamoDB Database
- Phase 5 — AWS Lambda
- Phase 6 — API Gateway

## Requirements

- **DynamoDB Schema:** Create a table with `shortCode` (String) as Partition Key.
- **Shorten Lambda (`createShortCode`):** Generates a random 6-character short code, inserts the item `{ shortCode, longUrl, createdAt }` into DynamoDB, and returns the short URL.
- **Redirect Lambda (`redirectUrl`):** Reads `shortCode` from path parameters, queries DynamoDB, and returns an HTTP redirect response (statusCode: 302, Location: longUrl).
- **API Gateway integration:** REST API configured with AWS proxy integrations mapping routes to the correct Lambda functions.

## Suggested Approach

1. Create the `url-mapping-table` in local DynamoDB using the AWS CLI.
2. Write the two Lambda function handlers (`index.mjs` files) inside separate subdirectories.
3. Use the Document Client inside your Lambdas to query DynamoDB.
4. Package and deploy both Lambda functions to the local Floci container.
5. Provision a local REST API Gateway mapping the `/shorten` and `/{shortCode}` endpoints.
6. Link the endpoints to the Lambda functions using proxy integrations.
7. Test the system using `curl -i` and verify the redirect routing.

## Stretch Goals

- Add a validation regex to the shorten function to reject malformed URLs.
- Implement an expiration timestamp (TTL) on shortened URLs, and automatically purge expired links.
- Add a click counter attribute in DynamoDB and increment it atomically using `UpdateItem` during redirects.

## Evaluation Checklist

- [ ] DynamoDB table is active with appropriate Partition Keys.
- [ ] Shorten endpoint generates a 6-character short code and saves it to the database.
- [ ] Database contains the mapped entry matching the generated code.
- [ ] Redirect endpoint returns a `302 Found` status with the correct `Location` header.
- [ ] Accessing a non-existent short code returns a clean `404 Not Found` response.
