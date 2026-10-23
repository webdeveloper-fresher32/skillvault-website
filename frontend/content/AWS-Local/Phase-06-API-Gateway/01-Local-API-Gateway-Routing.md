# Local API Gateway Routing — Complete Guide

> "A shopping mall directory maps store categories to specific floor locations, helping shoppers find the clothing section, food court, or electronics store directly from the lobby entrance."

---

## Table of Contents

1. [The Problem: Connecting HTTP Clients to Private Serverless Logic](#1-the-problem-connecting-http-clients-to-private-serverless-logic)
2. [The Mall Directory Analogy](#2-the-mall-directory-analogy)
3. [The Mechanism: REST/HTTP Proxies and Local Edge Endpoints](#3-the-mechanism-rest-http-proxies-and-local-edge-endpoints)
4. [Diagram: API Gateway Routing to Sibling Lambda Containers](#4-diagram-api-gateway-routing-to-sibling-lambda-containers)
5. [Code Walkthrough: Setting up Local Routing and Proxy Integrations](#5-code-walkthrough-setting-up-local-routing-and-proxy-integrations)
6. [Comparing REST APIs to HTTP APIs](#6-comparing-rest-apis-to-http-apis)
7. [Common Mistakes](#7-common-mistakes)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. The Problem: Connecting HTTP Clients to Private Serverless Logic

AWS Lambda functions are private by default. They can only be invoked by internal AWS triggers or through authenticated IAM API calls.

### Client-to-Lambda Exposure Obstacles

When building user-facing web applications, browsers need to make standard HTTP calls (like `GET` or `POST`) to retrieve or submit data. Bypassing security boundaries by letting browsers call the Lambda SDK directly requires storing access keys on the client, which is unsafe.

### Deployment Delay for Routing Changes

Creating endpoints, mapping routes (e.g. `/users` to UserLambda), configuring query string validation, and managing custom domain names on live AWS is slow. The deployment configuration pipelines for REST APIs introduce lag, which interrupts developer feedback loops.

---

## 2. The Mall Directory Analogy

A shopping mall houses dozens of independent shops. Shoppers outside the mall don't know the exact physical coordinate or aisle number of each store inside.

### Unified Entryway

Shoppers enter through a main lobby. In the center sits the mall directory board. The directory lists stores by category (e.g. `/apparel` routes to Floor 2, `/food` routes to Floor 3). Shoppers interact only with the lobby path, and the directory handles navigation.

### Request Transformation

If a shopper asks the information desk for directions, the host translates their query ("Where is coffee?") and points them to a specific shop ("Aisle B, Star Cafe"). This represents the proxy integration translation.

---

## 3. The Mechanism: REST/HTTP Proxies and Local Edge Endpoints

API Gateway sits between the client and backend services (like Lambda). In local emulators, API Gateway executes on port `4566`.

### Integration Mapping

When an HTTP client makes a request to `http://localhost:4566/restapis/abc123xyz/local/_user_request_/users`, Floci parses the API ID (`abc123xyz`) and the route (`/users`). It matches this path against the configured integration rules.

### Lambda Proxy Integration

Under the `AWS_PROXY` integration model, API Gateway does not modify the incoming request. Instead, it packages the entire HTTP request (method, headers, query params, body) into a single JSON event object. It passes this object directly to the linked Lambda container, and translates the returned JSON response back to HTTP.

---

## 4. Diagram: API Gateway Routing to Sibling Lambda Containers

### The Network Flow

```text
HTTP Client (Browser / curl)
        │
        ▼ (Sends HTTP request: POST /items)
  [Floci API Gateway (Port 4566)]
        │
        ▼ (Checks routes table, generates event payload JSON)
  [Host Docker Daemon] ──► Spawns sibling container
                                │
                                ▼
                     [Lambda Sibling Container]
                       (Executes handler logic)
                                │
                                ▼ (Returns: { statusCode: 201, body: "..." })
  [Floci API Gateway]
        │
        ▼ (Formats response back to standard HTTP/JSON)
  HTTP Client receives response
```

### Critical Requirement

All network complexity is abstracted. The client makes a standard HTTP request, and the emulator coordinates sibling container routing under the hood.

---

## 5. Code Walkthrough: Setting up Local Routing and Proxy Integrations

The following shell script builds a complete REST API gateway locally, creates a resource endpoint, attaches a Lambda proxy integration, and deploys a stage.

### local-api-gateway-provision.sh script

```bash
#!/bin/bash
# local-api-gateway-provision.sh
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_PROFILE=local

# 1. Create a REST API
API_ID=$(aws apigateway create-rest-api --name "LocalApi" --query 'id' --output text)
echo "REST API created. ID: $API_ID"

# 2. Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[0].id' --output text)

# 3. Create a resource path (/hello)
RES_ID=$(aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part "hello" --query 'id' --output text)
echo "Resource /hello created. ID: $RES_ID"

# 4. Create HTTP method (GET) on resource
aws apigateway put-method --rest-api-id $API_ID --resource-id $RES_ID --http-method GET --authorization-type "NONE"

# 5. Link method to a Lambda function (created in Phase 5)
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RES_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:hello-world-fn/invocations

# 6. Deploy the API to a stage named 'dev'
aws apigateway create-deployment --rest-api-id $API_ID --stage-name dev
echo "API Deployed! Access URL:"
echo "http://localhost:4566/restapis/$API_ID/dev/_user_request_/hello"
```

### Client-Side Frontend Integration

Here is how a React or vanilla JS frontend application makes a fetch query to our local API Gateway endpoint:

```js
// frontend-fetch.js
async function fetchGreetingFromLocalCloud(apiId) {
  const url = `http://localhost:4566/restapis/${apiId}/dev/_user_request_/hello`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) throw new Error(`Network response error: ${response.status}`);
    const result = await response.json();
    console.log("Data received from local S3/Lambda API:", result);
    return result;
  } catch (error) {
    console.error("Local fetch operation failed:", error.message);
  }
}
```

---

## 6. Comparing REST APIs to HTTP APIs

### API Types Matrix

| Feature | REST API | HTTP API |
|---|---|---|
| Latency | Moderate (highly configurable) | Low (designed for speed) |
| Feature Set | Rich (mapping templates, cache) | Lean (simple routing, CORS) |
| CORS Configuration | Manual method configuration | Built-in simple settings |
| Cost (Live Cloud) | Billed per request (more expensive) | Billed per request (70% cheaper) |
| Authorization | Cognito, Custom Authorizer, IAM | JWT (OAuth2), IAM, Lambda |
| Emulator Parity | Simulated (handles basic methods) | Simulated (fast HTTP mapping) |

---

## 7. Common Mistakes

- **Forgetting to configure CORS headers in the Lambda response.** When using `AWS_PROXY` integration, the browser will block requests due to CORS policies unless your Lambda code explicitly returns `Access-Control-Allow-Origin` in the headers block.
- **Using incorrect Integration Http Method.** When linking a resource to a Lambda function, the integration type method must always be `POST`, even if the frontend client method is `GET` or `DELETE`, because Lambda invokes expect a POST payload.
- **Missing Deployment creation.** Tweaking resources and integration settings in API Gateway does not publish updates. You must create a new deployment stage for updates to take effect.

---

## 8. Hands-On Exercises

**Exercise 1:** Write the deployment script from Section 5 to configure a local API Gateway resource path.

**Exercise 2:** Deploy the Lambda function from Phase 5, run the provision script, and invoke the generated endpoint URL using `curl -i`.

**Exercise 3:** Modify the Lambda function to return custom CORS headers, redeploy it, and confirm the headers appear in the curl response.

**Exercise 4:** Explain why the API Gateway integration URI uses `POST` as the integration method even when mapping a client `GET` route.

**Exercise 5:** Verify your local routing by creating an HTTP POST resource endpoint that accepts a query string parameter, and output it in the logs.

---

## 9. Interview Q&A

**Q: What is Lambda Proxy Integration (AWS_PROXY) in API Gateway, and why is it preferred?**
It is a simple integration model where API Gateway passes the raw HTTP request directly to the Lambda function as a JSON object, without modifying headers, paths, or bodies. The Lambda function handles all routing and validation, returning a structured JSON response that API Gateway converts back to HTTP, minimizing Gateway configuration.

**Q: How does CORS affect web applications calling API Gateway, and how is it resolved?**
CORS is a browser security feature that restricts web apps from requesting resources from a different domain. It is resolved by configuring API Gateway to respond to preflight `OPTIONS` requests, and ensuring the backend Lambda function includes appropriate `Access-Control-Allow-Origin` headers in its response.

**Q: What is the difference between REST APIs and HTTP APIs in API Gateway?**
REST APIs are full-featured gateways offering request transformation, response caching, schema validation, and extensive auth integrations. HTTP APIs are lightweight, low-latency, and cost-effective alternatives optimized for proxying requests directly to Lambda functions or private HTTP backends.

**Q: Why does API Gateway require a "Deployment" and a "Stage" to make API changes active?**
Because API Gateway decouples configuration from the active runtime environment. Creating routes modifies the metadata, but doesn't affect active clients. Deploying pushes a snapshot of the current configuration to a specific Stage (e.g. `dev`, `prod`), making it public.

**Q: What is an API Gateway Custom Authorizer, and how does it secure endpoints?**
A Custom Authorizer is a Lambda function that validates incoming authorization credentials (such as JWT tokens or API keys). If the credentials are valid, the authorizer returns an IAM policy allowing the request to proceed; if invalid, it returns a `401 Unauthorized` status.
