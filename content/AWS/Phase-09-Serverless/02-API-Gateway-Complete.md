# AWS API Gateway - Complete Guide

## Table of Contents
1. [What is API Gateway and Why Use It](#1-what-is-api-gateway-and-why-use-it)
2. [API Types Comparison](#2-api-types-comparison)
3. [REST API Deep Dive](#3-rest-api-deep-dive)
4. [Lambda Proxy Integration](#4-lambda-proxy-integration)
5. [Stages, Deployments, and Stage Variables](#5-stages-deployments-and-stage-variables)
6. [API Keys and Usage Plans](#6-api-keys-and-usage-plans)
7. [Lambda Authorizers](#7-lambda-authorizers)
8. [Cognito User Pool Authorizer](#8-cognito-user-pool-authorizer)
9. [CORS Configuration](#9-cors-configuration)
10. [Request Validation and Models](#10-request-validation-and-models)
11. [Caching](#11-caching)
12. [Throttling](#12-throttling)
13. [Canary Deployments](#13-canary-deployments)
14. [Logging](#14-logging)
15. [HTTP API vs REST API Comparison](#15-http-api-vs-rest-api-comparison)
16. [WebSocket API](#16-websocket-api)
17. [VPC Link for Private Integrations](#17-vpc-link-for-private-integrations)
18. [Interview Q&A](#18-interview-qa)

---

## 1. What is API Gateway and Why Use It

### Definition
Amazon API Gateway is a fully managed service that enables developers to create, publish, maintain, monitor, and secure APIs at any scale. It acts as the "front door" for applications to access data, business logic, or functionality from backend services.

### Core Responsibilities
- **Routing**: Accepts API calls and routes them to the appropriate backend
- **Authentication/Authorization**: Validates who is calling and what they can do
- **Traffic Management**: Throttling, rate limiting, and quotas
- **Request/Response Transformation**: Modify headers, body, and query parameters
- **Monitoring**: Logs requests and provides metrics via CloudWatch
- **Caching**: Reduce backend load by caching responses

### Why Use API Gateway Instead of Building Your Own?

| Challenge | Without API Gateway | With API Gateway |
|-----------|---------------------|------------------|
| SSL/TLS | Manage certificates manually | Automatic HTTPS endpoints |
| Scaling | Provision servers | Automatically scales |
| Auth | Build auth logic in every service | Centralized authorizers |
| Rate limiting | Code in every service | Built-in throttling |
| Monitoring | Set up logging infrastructure | CloudWatch integration out of the box |
| Versioning | Custom URL routing | Built-in stage/version support |

### Key Use Cases
1. **Serverless APIs**: Expose Lambda functions as HTTP endpoints
2. **Microservices gateway**: Single entry point for multiple microservices
3. **Legacy modernization**: Wrap legacy systems with modern REST APIs
4. **Mobile/web backends**: Scalable API layer for frontend applications
5. **Third-party integrations**: Partner API exposure with usage plans and keys

### Pricing Model
- **REST API**: Pay per API call ($3.50 per million calls) + data transfer
- **HTTP API**: ~70% cheaper than REST API ($1.00 per million calls)
- **WebSocket API**: Pay per message and connection minutes
- Free tier: 1 million REST API calls per month for 12 months

---

## 2. API Types Comparison

### Overview Table

| Feature | REST API | HTTP API | WebSocket API |
|---------|----------|----------|---------------|
| Protocol | HTTP/HTTPS | HTTP/HTTPS | WebSocket |
| Use Case | Full-featured APIs | Simple proxy APIs | Real-time bidirectional |
| Cost | Higher (~$3.50/M) | Lower (~$1.00/M) | Per message + connection |
| Lambda Proxy | Yes | Yes | Yes |
| Lambda Authorizer | Yes | Yes (JWT only for HTTP native) | Yes |
| Cognito Authorizer | Yes | Yes (native JWT) | No |
| API Keys | Yes | No | No |
| Usage Plans | Yes | No | No |
| Request Validation | Yes | No | No |
| Response Mapping | Yes | No | No |
| Caching | Yes | No | No |
| WAF Integration | Yes | Yes | No |
| Private Integrations | Yes (NLB, ALB) | Yes (NLB, ALB, App Mesh) | Yes |
| CORS | Manual config | Automatic config | N/A |
| Canary Deployments | Yes | No | No |
| X-Ray Tracing | Yes | Yes | No |
| Mutual TLS | Yes | Yes | No |
| Custom Domain | Yes | Yes | Yes |
| Edge Optimized | Yes | No | No |
| Regional | Yes | Yes | Yes |
| Private | Yes | No | No |

### When to Choose Each

**Choose REST API when:**
- Need API keys and usage plans for monetization
- Require request/response transformation
- Need caching
- Require request validation
- Building for external partners with quotas

**Choose HTTP API when:**
- Building simple Lambda proxy integrations
- Cost is a concern
- Need OIDC/OAuth 2.0 JWT authorization natively
- Targeting lowest latency

**Choose WebSocket API when:**
- Real-time applications: chat, gaming, live dashboards
- Bidirectional communication needed
- Long-lived connections required

---

## 3. REST API Deep Dive

### Resources and Methods

The REST API is organized as a hierarchy of **Resources** (URL paths) and **Methods** (HTTP verbs).

```
API Root (/)
├── /users                    ← Resource
│   ├── GET /users           ← Method
│   ├── POST /users          ← Method
│   └── /{userId}            ← Child Resource (path parameter)
│       ├── GET /users/{userId}
│       ├── PUT /users/{userId}
│       └── DELETE /users/{userId}
└── /orders
    ├── GET /orders
    └── POST /orders
```

### Path Parameters vs Query Strings vs Headers

```
GET /users/{userId}?includeDeleted=true
     ↑                ↑
  Path param       Query string

Authorization: Bearer <token>
↑
Header
```

### Integration Types

#### 1. Lambda Proxy Integration (LAMBDA_PROXY)
The most common integration. API Gateway passes the entire request to Lambda and returns the Lambda response directly.
- No response mapping needed
- Lambda controls full response (status code, headers, body)
- See Section 4 for deep dive

#### 2. Lambda Non-Proxy Integration (LAMBDA)
API Gateway passes a transformed request to Lambda and can transform the Lambda response.
- Requires mapping templates (Velocity Template Language - VTL)
- More complex but allows full control over transformation
- Rarely used today (Lambda Proxy covers most cases)

**Example Mapping Template (request):**
```vtl
{
  "userId": "$input.params('userId')",
  "queryParams": {
    #foreach($param in $input.params().querystring.keySet())
    "$param": "$util.escapeJavaScript($input.params().querystring.get($param))"
    #if($foreach.hasNext),#end
    #end
  }
}
```

#### 3. Mock Integration
Returns a hardcoded response without calling any backend. Useful for:
- Prototyping APIs before backend is ready
- Returning CORS headers
- Testing

```json
// Integration Response Mapping (200 status)
{
  "statusCode": 200,
  "body": "{\"message\": \"This is a mock response\"}"
}
```

#### 4. HTTP Integration
Forwards requests to an external HTTP endpoint.
- **HTTP_PROXY**: Passes request as-is to HTTP endpoint
- **HTTP**: Allows request/response mapping with VTL templates

Use case: Legacy API behind API Gateway facade

#### 5. AWS Service Integration
Directly call AWS service APIs without Lambda.
- Call DynamoDB `PutItem`, `GetItem`
- Send message to SQS
- Put event to Kinesis
- Start Step Functions execution

**Example: Direct DynamoDB Integration**
```
POST /items → API Gateway → DynamoDB PutItem
```
Request mapping template:
```vtl
{
  "TableName": "Items",
  "Item": {
    "id": {"S": "$input.path('$.id')"},
    "name": {"S": "$input.path('$.name')"}
  }
}
```

### Method Request vs Integration Request vs Integration Response vs Method Response

```
Client Request
     ↓
[Method Request]      ← Validate: auth, API key, request params/body
     ↓
[Integration Request] ← Transform: map to backend format
     ↓
   Backend
     ↓
[Integration Response] ← Transform: map from backend format
     ↓
[Method Response]     ← Define: HTTP status codes, response headers
     ↓
Client Response
```

---

## 4. Lambda Proxy Integration

### How It Works

When Lambda Proxy integration is enabled, API Gateway:
1. Wraps the entire HTTP request into a JSON event object
2. Passes it to Lambda
3. Returns Lambda's response directly to the client (no mapping)

### Event Object Structure

```json
{
  "version": "1.0",
  "resource": "/users/{userId}",
  "path": "/users/123",
  "httpMethod": "GET",
  "headers": {
    "Accept": "application/json",
    "Authorization": "Bearer eyJhbGci...",
    "Host": "api.example.com",
    "User-Agent": "Mozilla/5.0",
    "X-Forwarded-For": "203.0.113.1",
    "X-Forwarded-Proto": "https"
  },
  "multiValueHeaders": {
    "Accept": ["application/json"],
    "Authorization": ["Bearer eyJhbGci..."]
  },
  "queryStringParameters": {
    "includeDeleted": "true",
    "page": "1"
  },
  "multiValueQueryStringParameters": {
    "tags": ["aws", "serverless"]
  },
  "pathParameters": {
    "userId": "123"
  },
  "stageVariables": {
    "environment": "prod",
    "lambdaAlias": "live"
  },
  "requestContext": {
    "accountId": "123456789012",
    "resourceId": "abc123",
    "stage": "prod",
    "requestId": "req-12345",
    "requestTime": "08/Jun/2026:10:00:00 +0000",
    "requestTimeEpoch": 1749373200000,
    "identity": {
      "sourceIp": "203.0.113.1",
      "userAgent": "Mozilla/5.0",
      "cognitoIdentityId": null,
      "cognitoAuthenticationType": null
    },
    "path": "/prod/users/123",
    "resourcePath": "/users/{userId}",
    "httpMethod": "GET",
    "apiId": "abc1234def",
    "protocol": "HTTP/1.1",
    "authorizer": {
      "principalId": "user-123",
      "claims": {
        "sub": "user-123",
        "email": "user@example.com"
      }
    }
  },
  "body": "{\"name\": \"John\"}",
  "isBase64Encoded": false
}
```

### Lambda Response Format

Lambda MUST return this exact structure for Lambda Proxy integration:

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "X-Custom-Header": "value"
  },
  "multiValueHeaders": {
    "Set-Cookie": ["cookie1=value1", "cookie2=value2"]
  },
  "body": "{\"userId\": \"123\", \"name\": \"John Doe\"}",
  "isBase64Encoded": false
}
```

**Important**: `body` MUST be a string. If you have a JSON object, stringify it:
```python
import json

def lambda_handler(event, context):
    user_id = event['pathParameters']['userId']
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'userId': user_id,
            'name': 'John Doe'
        })
    }
```

### Common Lambda Proxy Patterns

**Error handling:**
```python
def lambda_handler(event, context):
    try:
        result = process_request(event)
        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }
    except ValidationError as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }
    except NotFoundException as e:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Not Found'})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal Server Error'})
        }
```

---

## 5. Stages, Deployments, and Stage Variables

### Deployments

A **deployment** is a snapshot of your API configuration (resources, methods, integrations) at a point in time.

- Changes to API are NOT live until you deploy
- Each deployment is associated with a **stage**
- You can roll back by pointing a stage to an older deployment

```
API Changes → Create Deployment → Associate with Stage → Live
```

### Stages

A **stage** is a named reference to a deployment. Stages typically represent environments.

Common stage names: `dev`, `test`, `staging`, `prod`, `v1`, `v2`

Stage URL format:
```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage-name}
```

Example:
```
https://abc123.execute-api.us-east-1.amazonaws.com/prod/users
https://abc123.execute-api.us-east-1.amazonaws.com/dev/users
```

### Stage Settings

Each stage can independently configure:
- Logging level (OFF, ERROR, INFO)
- Metrics (detailed vs summary)
- Throttling (rate and burst limits)
- Caching (enable/disable, TTL, size)
- X-Ray tracing
- Stage variables

### Stage Variables

Stage variables are key-value pairs associated with a stage. They act like environment variables for your API.

**Configuration:**
```
Stage: prod
Stage Variables:
  lambdaAlias = live
  environment = production
  backendUrl = https://prod.internal.example.com
```

**Usage in integration URI:**
```
# Lambda function with alias from stage variable
arn:aws:lambda:us-east-1:123456789012:function:MyFunction:${stageVariables.lambdaAlias}
```

**Usage in Lambda event:**
```python
def lambda_handler(event, context):
    environment = event['stageVariables']['environment']
    # Use environment to connect to right database, etc.
```

**Use Case: One API, Multiple Backends**
```
prod stage → lambdaAlias = "live"    → Function:live alias
dev stage  → lambdaAlias = "latest"  → Function:$LATEST alias
```

This allows the same API configuration to route to different Lambda versions per environment.

---

## 6. API Keys and Usage Plans

### Purpose
Control API access for:
- Third-party developers monetizing API access
- Rate limiting specific clients
- Tracking usage per client

### API Keys
- A string (40-char alphanumeric) sent in the `x-api-key` header
- Do NOT use as the primary authentication mechanism (use Authorizers for that)
- Used for tracking and throttling only

```bash
curl -H "x-api-key: abcdefg1234567890" https://api.example.com/prod/users
```

### Usage Plans

A usage plan defines:
- **Throttle**: Rate (requests per second) and burst limits
- **Quota**: Maximum requests per day/week/month
- **Associated stages**: Which API stages this plan applies to
- **Associated API keys**: Which keys have access

**Example Usage Plans:**

| Plan | Rate (req/sec) | Burst | Quota |
|------|---------------|-------|-------|
| Free Tier | 10 | 20 | 1,000/day |
| Basic | 100 | 200 | 10,000/day |
| Premium | 1,000 | 2,000 | Unlimited |

### Setup Flow

```
1. Create API + methods (require API key on methods)
2. Deploy to a stage
3. Create Usage Plan
   - Set throttle limits
   - Set quota limits
   - Associate with stage
4. Create API Key
5. Associate API Key with Usage Plan
6. Client uses x-api-key header
```

### Requiring API Key on Method
When configuring a method, set "API Key Required" = true. Without a valid key in `x-api-key` header, API Gateway returns 403 Forbidden.

---

## 7. Lambda Authorizers

### What is a Lambda Authorizer?
A Lambda function that API Gateway calls before forwarding the request to the backend. The Lambda function validates the token/request and returns an IAM policy.

### Two Types

#### TOKEN Authorizer
- Receives a bearer token (JWT, OAuth, custom)
- Token passed in a specific header (default: `Authorization`)
- Simpler, cacheable

**Input to authorizer Lambda:**
```json
{
  "type": "TOKEN",
  "authorizationToken": "Bearer eyJhbGci...",
  "methodArn": "arn:aws:execute-api:us-east-1:123456789012:abc123/prod/GET/users"
}
```

**Required output (IAM policy):**
```json
{
  "principalId": "user-123",
  "policyDocument": {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Action": "execute-api:Invoke",
        "Effect": "Allow",
        "Resource": "arn:aws:execute-api:us-east-1:123456789012:abc123/prod/GET/users"
      }
    ]
  },
  "context": {
    "userId": "user-123",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

**Wildcard Resource (allow all methods):**
```
"Resource": "arn:aws:execute-api:us-east-1:123456789012:abc123/prod/*/*"
```

#### REQUEST Authorizer
- Receives the full request context (headers, query params, stage vars, path params)
- Used when authorization depends on multiple request attributes
- Required for WebSocket APIs

**Input to authorizer Lambda:**
```json
{
  "type": "REQUEST",
  "methodArn": "arn:aws:execute-api:...",
  "headers": {
    "Authorization": "Bearer token",
    "X-Tenant-ID": "tenant-123"
  },
  "queryStringParameters": {
    "action": "read"
  },
  "pathParameters": {
    "userId": "user-123"
  },
  "stageVariables": {},
  "requestContext": {
    "accountId": "123456789012",
    "stage": "prod",
    "requestId": "req-abc"
  }
}
```

### Authorizer Caching

- Results can be cached based on the token value
- TTL: 0 to 3600 seconds (default: 300 seconds)
- Cache key: the token value (for TOKEN type)
- Reduces Lambda invocations and latency

**Important**: With caching, the same IAM policy is returned for all requests with the same token within the TTL window, even if the policy would have changed.

### Lambda Authorizer Python Example

```python
import jwt
import json

def lambda_handler(event, context):
    token = event['authorizationToken'].replace('Bearer ', '')
    method_arn = event['methodArn']
    
    try:
        # Verify JWT token
        payload = jwt.decode(token, 'secret-key', algorithms=['HS256'])
        
        # Allow the request
        return generate_policy(payload['sub'], 'Allow', method_arn, {
            'userId': payload['sub'],
            'email': payload.get('email', '')
        })
    except jwt.ExpiredSignatureError:
        raise Exception('Unauthorized')  # Returns 401
    except jwt.InvalidTokenError:
        return generate_policy('user', 'Deny', method_arn)

def generate_policy(principal_id, effect, resource, context=None):
    policy = {
        'principalId': principal_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [{
                'Action': 'execute-api:Invoke',
                'Effect': effect,
                'Resource': resource
            }]
        }
    }
    if context:
        policy['context'] = context
    return policy
```

### Accessing Authorizer Context in Lambda

The `context` object from the authorizer is available in the backend Lambda's event:
```python
def lambda_handler(event, context):
    user_id = event['requestContext']['authorizer']['userId']
    email = event['requestContext']['authorizer']['email']
```

---

## 8. Cognito User Pool Authorizer

### What It Is
A built-in API Gateway authorizer that validates JWTs issued by Amazon Cognito User Pools. No custom Lambda needed.

### How It Works
```
1. User authenticates with Cognito → receives ID token (JWT)
2. Client includes JWT in Authorization header
3. API Gateway validates JWT signature with Cognito's JWKS endpoint
4. If valid and not expired → request proceeds
5. If invalid → 401 Unauthorized
```

### Setup
1. Create a Cognito User Pool
2. In API Gateway, create an Authorizer:
   - Type: Cognito User Pools
   - Select the User Pool
   - Token source: `Authorization` (header name)
   - Token validation: optional scopes
3. Apply authorizer to methods

### Cognito vs Lambda Authorizer Comparison

| Feature | Cognito Authorizer | Lambda Authorizer |
|---------|-------------------|-------------------|
| Managed | Yes (AWS handles JWT validation) | No (you write code) |
| Custom Logic | No | Yes (any logic you want) |
| Token Type | Cognito JWT only | Any token format |
| Cost | Free | Lambda invocation cost |
| External IdP | Via Cognito federation | Directly if JWT standard |
| Context Injection | Limited (Cognito claims) | Full custom context |

### Accessing Cognito Claims in Lambda

```python
def lambda_handler(event, context):
    # Cognito claims are in requestContext.authorizer.claims
    claims = event['requestContext']['authorizer']['claims']
    user_id = claims['sub']
    email = claims['email']
    groups = claims.get('cognito:groups', '').split(',')
```

---

## 9. CORS Configuration

### What is CORS?

Cross-Origin Resource Sharing (CORS) is a browser security mechanism that restricts web pages from making requests to a different domain than the one that served the page.

```
Browser on https://app.example.com
          ↓
   Makes request to https://api.example.com/users
          ↓
Browser sends OPTIONS preflight request first
          ↓
Server must respond with appropriate CORS headers
```

### CORS Flow

**Simple Request (GET, HEAD, POST with standard headers):**
```
GET /users HTTP/1.1
Origin: https://app.example.com
↓
Response must include:
Access-Control-Allow-Origin: https://app.example.com (or *)
```

**Preflight Request (PUT, DELETE, custom headers, etc.):**
```
OPTIONS /users HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Authorization, Content-Type
↓
Response must include:
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, PUT, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

### Configuring CORS in REST API

**Method 1: Enable CORS via Console**
API Gateway has a built-in "Enable CORS" button that:
- Creates OPTIONS method with Mock integration
- Adds required response headers
- Returns 200 for preflight requests

**Method 2: Manual Configuration**
For Lambda Proxy integration, add headers in your Lambda response:
```python
return {
    'statusCode': 200,
    'headers': {
        'Access-Control-Allow-Origin': 'https://app.example.com',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    },
    'body': json.dumps(response_data)
}
```

### CORS Common Issues
1. **Missing OPTIONS method**: Must create OPTIONS method separately
2. **Wildcard with credentials**: Cannot use `*` with `Access-Control-Allow-Credentials: true`
3. **Cached preflight**: Browser caches CORS responses; clear cache when debugging
4. **Multiple origins**: Cannot return multiple origins; use Lambda to echo back the request origin

---

## 10. Request Validation and Models

### Why Validate at API Gateway Level?
- Reject invalid requests before they reach Lambda (saves Lambda invocations)
- Return consistent 400 errors for missing/invalid parameters
- Document API structure

### Models

A **model** defines the structure of request/response bodies using JSON Schema.

```json
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "CreateUserRequest",
  "type": "object",
  "required": ["name", "email"],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "email": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    },
    "age": {
      "type": "integer",
      "minimum": 0,
      "maximum": 150
    }
  },
  "additionalProperties": false
}
```

### Request Validation

Can validate:
- **Request body**: Against a model
- **Query string parameters**: Required/not required
- **Headers**: Required/not required

**Validation options:**
- Validate body
- Validate query string parameters and headers
- Validate body, query string parameters, and headers

**When validation fails:** API Gateway returns `400 Bad Request` with error details without invoking backend.

### Validator Configuration
```
Method Request:
  Request Validator: Validate body, query string parameters, and headers
  Request Body: 
    Content-Type: application/json → Model: CreateUserRequest
  URL Query String Parameters:
    page → Required: No
    limit → Required: No
  HTTP Request Headers:
    Authorization → Required: Yes
```

---

## 11. Caching

### What is API Gateway Caching?

API Gateway can cache responses from backend integrations in an in-memory cache (based on ElastiCache Redis/Memcached infrastructure).

### Configuration

- **Enable caching**: Per stage
- **Cache capacity**: 0.5 GB to 237 GB
- **Default TTL**: 300 seconds (5 minutes)
- **TTL range**: 0 to 3600 seconds (1 hour)
- **Cost**: Charged per hour based on cache size

### Cache Key

By default, API Gateway uses the full URL path as the cache key. You can customize to include:
- Query string parameters
- Headers
- Stage variables
- Path parameters (always included)

**Example cache keys:**
```
GET /users           → cached as "/users"
GET /users?page=1    → cached as "/users?page=1" (if page is configured as cache key)
GET /users?page=2    → different cache entry
GET /users/{id}      → cached as "/users/123", "/users/456" (different entries)
```

### Per-Method Cache Override

You can override the stage-level cache TTL per method:
- Inherit from stage
- Override with specific TTL
- Override to disable (TTL = 0)

### Cache Invalidation

**Method 1: Client-controlled invalidation**
```
GET /users
Cache-Control: max-age=0
```
The client sends `Cache-Control: max-age=0` header. Requires proper IAM permissions or any client can invalidate (potential cache flooding attack).

**Method 2: Console/API**
Flush the entire cache from the stage settings console.

**Security**: Require `execute-api:InvalidateCache` permission for client-side invalidation.

---

## 12. Throttling

### Levels of Throttling

API Gateway throttling operates at multiple levels:

#### Account Level (Soft Limit)
- **Default**: 10,000 requests/second rate, 5,000 burst
- Applies across all APIs in a region
- Can be increased via AWS Support ticket

#### Stage/Method Level
- Override at stage level or individual method level
- Set rate and burst independently per stage or method
- Useful for protecting specific expensive endpoints

#### Usage Plan Level
- Applied per API key
- Overrides stage/method levels for that specific key

### Throttle vs Burst

| Concept | Description |
|---------|-------------|
| **Rate limit** | Steady-state requests per second (token bucket fill rate) |
| **Burst limit** | Maximum number of concurrent requests (token bucket size) |

**Token Bucket Algorithm:**
```
Bucket capacity = Burst limit (e.g., 5000 tokens)
Fill rate = Rate limit (e.g., 10000 tokens/second)

If bucket has tokens → request is served, 1 token consumed
If bucket is empty → request is throttled → 429 Too Many Requests
```

### When Throttled
API Gateway returns:
```
HTTP/1.1 429 Too Many Requests
{"message": "Too Many Requests"}
```

### Throttling Configuration Example

```
Account: 10,000 req/sec, burst 5,000
  └── prod stage: 5,000 req/sec, burst 2,000
       ├── POST /orders: 1,000 req/sec, burst 500
       └── GET /users: inherit from stage
  └── dev stage: 100 req/sec, burst 50
```

---

## 13. Canary Deployments

### What is a Canary Deployment?

A technique to gradually shift traffic to a new version of your API while keeping most traffic on the old version. Named after "canary in a coal mine."

### How It Works in API Gateway

```
Stage (prod)
├── Base deployment: 90% traffic → Old Lambda version
└── Canary deployment: 10% traffic → New Lambda version
         ↑
    Canary % is configurable (0-100%)
```

### Configuration

1. Deploy new API changes to a stage with canary settings:
   - **Canary %**: Percentage of traffic to canary (e.g., 10%)
   - **Use Stage Cache**: Whether canary uses its own cache
   - **Canary Stage Variables**: Override stage variables for canary

2. Monitor metrics, errors, latency in canary vs baseline

3. **Promote**: When satisfied, promote canary to make it the baseline (100% traffic)

4. **Rollback**: If issues found, remove canary (0% traffic)

### Canary vs Lambda Aliases

| Feature | API Gateway Canary | Lambda Aliases |
|---------|-------------------|----------------|
| Level | API deployment | Lambda function |
| Traffic split | Stage-based | Alias-based |
| Works without Lambda | Yes (any backend) | No |
| Rollback | Remove canary | Change alias |
| Metrics | API Gateway | Lambda |

---

## 14. Logging

### Two Types of Logs

#### Access Logs
- **What**: Information about each request (who called, when, response code, latency)
- **Where**: CloudWatch Logs (custom log group you specify)
- **Format**: Fully customizable using context variables
- **Use**: Audit trails, debugging client issues

**Custom Access Log Format Example:**
```json
{
  "requestId": "$context.requestId",
  "ip": "$context.identity.sourceIp",
  "caller": "$context.identity.caller",
  "user": "$context.identity.user",
  "requestTime": "$context.requestTime",
  "httpMethod": "$context.httpMethod",
  "resourcePath": "$context.resourcePath",
  "status": "$context.status",
  "protocol": "$context.protocol",
  "responseLength": "$context.responseLength",
  "errorMessage": "$context.error.message",
  "integrationLatency": "$context.integrationLatency",
  "responseLatency": "$context.responseLatency"
}
```

#### Execution Logs
- **What**: Detailed information about request/response processing steps
- **Where**: CloudWatch Logs (managed log group: `API-Gateway-Execution-Logs_{api-id}/{stage}`)
- **Levels**: ERROR or INFO
- **INFO level**: Logs every request detail (very verbose, use for debugging)
- **ERROR level**: Only logs failed requests
- **Use**: Debugging integration issues, mapping template errors

**Sample Execution Log Entry (INFO level):**
```
Execution log for request 12345
Wed Jun 08 10:00:00 UTC 2026 : Starting execution for request: 12345
Wed Jun 08 10:00:00 UTC 2026 : HTTP Method: GET, Resource Path: /users
Wed Jun 08 10:00:00 UTC 2026 : Method request path: {userId=123}
Wed Jun 08 10:00:00 UTC 2026 : Method request query string: {}
Wed Jun 08 10:00:00 UTC 2026 : Method request headers: {Authorization=Bearer eyJ...}
Wed Jun 08 10:00:00 UTC 2026 : Endpoint request URI: arn:aws:lambda:...
Wed Jun 08 10:00:00 UTC 2026 : Sending request to https://lambda.us-east-1.amazonaws.com/...
Wed Jun 08 10:00:00 UTC 2026 : Received response. Integration latency: 45 ms
Wed Jun 08 10:00:00 UTC 2026 : Method response body after transformations: {...}
Wed Jun 08 10:00:00 UTC 2026 : Method response headers: {Content-Type=application/json}
Wed Jun 08 10:00:00 UTC 2026 : Successfully completed execution
Wed Jun 08 10:00:00 UTC 2026 : Method completed with status: 200
```

### Required IAM Role for Logging

API Gateway needs an IAM role with CloudWatch Logs permissions. Configure in API Gateway Account Settings:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:PutLogEvents",
        "logs:GetLogEvents",
        "logs:FilterLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### CloudWatch Metrics
Key metrics to monitor:
- `Count`: Total API calls
- `4XXError`: Client-side errors
- `5XXError`: Server-side errors
- `Latency`: Total end-to-end latency
- `IntegrationLatency`: Backend processing time
- `CacheHitCount` / `CacheMissCount`: Cache effectiveness

---

## 15. HTTP API vs REST API Comparison

### Detailed Feature Comparison

| Feature | REST API | HTTP API |
|---------|----------|----------|
| **Pricing** | $3.50/million requests | $1.00/million requests |
| **Latency** | Higher (more features) | ~60% lower latency |
| **Lambda Proxy** | Yes | Yes |
| **Lambda Non-Proxy** | Yes | No |
| **HTTP Proxy** | Yes | Yes |
| **Private Integration** | Yes (NLB/ALB via VPC Link) | Yes (NLB/ALB/App Mesh) |
| **JWT Authorizer** | Via Lambda | Native (no Lambda needed) |
| **Lambda Authorizer** | Yes | Yes |
| **IAM Authorization** | Yes | Yes |
| **Cognito Authorizer** | Yes | Yes (via JWT with Cognito) |
| **API Keys + Usage Plans** | Yes | No |
| **Request Validation** | Yes | No |
| **Request/Response Transform** | Yes (VTL mapping templates) | No |
| **Response Mapping** | Yes | No |
| **Caching** | Yes | No |
| **WAF Integration** | Yes | Yes |
| **X-Ray Tracing** | Yes | Yes |
| **Mutual TLS** | Yes | Yes |
| **Custom Domain** | Yes | Yes |
| **Edge-optimized** | Yes | No (regional only) |
| **Private API** | Yes | No |
| **CORS** | Manual | Automatic (simple config) |
| **Canary Deployments** | Yes | No |
| **CloudWatch Metrics** | Yes | Yes |
| **Access Logging** | Yes | Yes |
| **Execution Logging** | Yes | No |

### HTTP API Native JWT Authorization

HTTP API supports JWT authorization natively (no Lambda function needed):
```
Issuer: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
Audience: {app-client-id}
```

Supports: Cognito User Pools, Auth0, Okta, any OIDC-compliant provider.

### When to Choose HTTP API
- Simple Lambda or HTTP proxy integrations
- Cost-sensitive applications
- Need low latency
- Using OIDC/OAuth 2.0 JWT tokens
- Don't need caching, request transformation, or usage plans

---

## 16. WebSocket API

### What is WebSocket API?

Enables real-time, bidirectional communication between clients and servers. The connection is persistent (unlike HTTP which is request-response).

### Use Cases
- Real-time chat applications
- Live sports scores / stock tickers
- Multiplayer gaming
- Live dashboards and monitoring
- Collaborative editing

### Connection Flow

```
Client                    API Gateway              Lambda / Backend
  |                           |                          |
  |-- WS Upgrade request --→ |                          |
  |  (WebSocket handshake)    |                          |
  |                           |-- $connect route ------→ |
  |                           |←-- 200 OK (or 401) ----- |
  |←-- WS connection open --- |                          |
  |                           |                          |
  |-- Send message ----------→|                          |
  |                           |-- $default route ------→ |
  |                           |    (or custom route)     |
  |                           |                          |
  |                           |←-- postToConnection() -- |  (backend sends message back)
  |←-- Receive message ------ |                          |
  |                           |                          |
  |-- Disconnect ----------→  |                          |
  |                           |-- $disconnect route ---→ |
```

### Three Built-in Routes

| Route | Trigger |
|-------|---------|
| `$connect` | Client establishes WebSocket connection |
| `$disconnect` | Client or server closes connection |
| `$default` | No other route matches the message |

### Custom Routes

Define routes based on message content:
```json
// Message from client:
{
  "action": "sendMessage",
  "data": "Hello World"
}
```
Configure route key: `$request.body.action`
Route: `sendMessage` → Lambda function

### Connection Management

Each connected client gets a unique `connectionId`. API Gateway stores this.

**Send message to a specific client from Lambda:**
```python
import boto3
import json

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    domain_name = event['requestContext']['domainName']
    stage = event['requestContext']['stage']
    
    # Create management API client
    api_client = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=f'https://{domain_name}/{stage}'
    )
    
    # Send message to specific connection
    api_client.post_to_connection(
        ConnectionId=connection_id,
        Data=json.dumps({'message': 'Hello from server!'})
    )
```

**Broadcast to all connections (requires storing connectionIds):**
```python
# Get all connection IDs from DynamoDB
connections = dynamodb_table.scan()['Items']
for conn in connections:
    try:
        api_client.post_to_connection(
            ConnectionId=conn['connectionId'],
            Data=json.dumps({'broadcast': 'message'})
        )
    except api_client.exceptions.GoneException:
        # Connection no longer exists, clean up
        dynamodb_table.delete_item(Key={'connectionId': conn['connectionId']})
```

### WebSocket URL Format
```
wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}
```

---

## 17. VPC Link for Private Integrations

### What is VPC Link?

VPC Link allows API Gateway to route requests to resources inside a VPC (private subnets) without exposing them to the public internet.

### Use Cases
- Private ALB (Application Load Balancer) hosting microservices
- Private NLB (Network Load Balancer) in front of ECS/EC2
- ECS Fargate services in private subnets
- RDS, ElastiCache, or other internal services

### Architecture

```
Internet
   ↓
API Gateway (public)
   ↓
VPC Link
   ↓
NLB (Network Load Balancer) ← private subnet
   ↓
ECS / EC2 / ALB ← private subnet
```

### REST API VPC Link
- Uses **Network Load Balancer** (NLB)
- NLB must be in the same region
- API Gateway becomes a VPC endpoint effectively

### HTTP API VPC Link
- More flexible: supports NLB, ALB, or App Mesh
- Cloud Map service discovery
- Simpler setup

### Setup Steps (REST API)
1. Create NLB in your VPC pointing to your backend
2. Create VPC Link in API Gateway (specify NLB ARN)
3. Wait for VPC Link to become AVAILABLE (can take 2-4 minutes)
4. Configure API Gateway integration to use VPC Link
5. Set integration URI to internal NLB DNS name

### Benefits
- Backend resources are never exposed to internet
- Traffic stays on AWS backbone (lower latency, no internet transit)
- Security: Backend security groups can deny all internet traffic

---

## 18. Interview Q&A

---

**Q1: What is the difference between REST API and HTTP API in API Gateway? When would you choose one over the other?**

**A:** REST API is the original, feature-rich offering with support for API keys/usage plans, request/response transformation via VTL mapping templates, response caching, request validation, canary deployments, and private endpoints. HTTP API is newer, simpler, ~70% cheaper, and has ~60% lower latency. HTTP API supports native JWT authorization (no Lambda needed), CORS auto-configuration, and private integrations with NLB/ALB/App Mesh.

Choose REST API when you need usage plans and API keys for monetization, request/response body transformation, response caching, request validation, canary deployments, or edge-optimized/private endpoints.

Choose HTTP API when building simple Lambda proxy or HTTP proxy integrations, when cost or latency is critical, when using standard JWT tokens (Cognito, Auth0, Okta), or when you want simpler CORS configuration.

---

**Q2: Explain Lambda Proxy integration. What must the Lambda function return?**

**A:** With Lambda Proxy integration, API Gateway passes the entire HTTP request as a JSON event object to Lambda, including method, path, headers, query parameters, path parameters, body, and request context. Lambda must return a specific JSON structure: a `statusCode` (integer), optional `headers` (object), optional `multiValueHeaders`, and a `body` (string — must be stringified JSON, not an object). API Gateway returns this response directly to the client without any transformation.

The key difference from non-proxy is that Lambda fully controls the HTTP response. There are no mapping templates needed. If Lambda returns something other than the required format, or throws an unhandled exception, API Gateway returns 502 Bad Gateway.

---

**Q3: What is the difference between a TOKEN and REQUEST Lambda Authorizer?**

**A:** A TOKEN authorizer receives a single bearer token (from a configurable header, typically Authorization) and the method ARN. It's simpler, purpose-built for token validation (JWTs, OAuth tokens), and supports caching based on the token value. A REQUEST authorizer receives the full request context including all headers, query parameters, path parameters, and stage variables. Use REQUEST when authorization logic depends on multiple request attributes — for example, when the combination of a tenant ID header, an API version header, and the requested resource all factor into the authorization decision. REQUEST authorizers are also required for WebSocket $connect route authorization.

Both must return an IAM policy document with `Allow` or `Deny` on `execute-api:Invoke`. The policy can include a `context` object with key-value pairs that are forwarded to the backend Lambda.

---

**Q4: How does API Gateway caching work and when would you invalidate it?**

**A:** API Gateway caching stores backend responses in an in-memory cache (per stage). You configure cache capacity (0.5 to 237 GB), TTL (0-3600 seconds, default 300), and cache key parameters. The default cache key is the request path; you can extend it with query string parameters, headers, or stage variables.

Cache invalidation can happen: (1) automatically when TTL expires, (2) by flushing the entire stage cache via console/API, or (3) by clients sending `Cache-Control: max-age=0` header. For client-initiated invalidation, you should require the `execute-api:InvalidateCache` IAM permission to prevent anyone from invalidating your cache (cache busting attacks). Methods with TTL=0 bypass cache entirely.

---

**Q5: Explain API Gateway throttling and the three levels at which it operates.**

**A:** API Gateway uses a token bucket algorithm. The bucket size is the burst limit (maximum concurrent requests) and the fill rate is the requests-per-second rate limit.

Three levels: (1) **Account level** — applies to all APIs in a region, default 10,000 req/sec rate and 5,000 burst, adjustable via Support. (2) **Stage/Method level** — you can override per stage or per individual method, useful for protecting expensive endpoints. (3) **Usage Plan level** — per API key throttling, overrides stage/method for that client.

When throttled, API Gateway returns 429 Too Many Requests. Clients should implement exponential backoff and retry logic.

---

**Q6: What is a canary deployment in API Gateway and how does it differ from Lambda aliases for traffic shifting?**

**A:** An API Gateway canary deployment splits traffic between two deployments at the stage level — a base deployment and a canary deployment. You configure a canary percentage (e.g., 10%), and that percentage of requests goes to the new deployment while the rest go to the base. This is useful when changes involve both Lambda and API configuration changes.

Lambda aliases traffic shifting works at the Lambda function level — you split traffic between two Lambda versions using an alias weighted routing. This only shifts Lambda traffic and doesn't account for API configuration changes (new resources, methods, integrations).

Use API Gateway canary when the API configuration itself changed (new endpoints, modified integrations). Use Lambda aliases for shifting traffic to new Lambda code when the API structure is unchanged.

---

**Q7: How do you enable CORS for a REST API with Lambda Proxy integration?**

**A:** With Lambda Proxy integration, there are two things needed: (1) Create an OPTIONS method on the resource with a Mock integration that returns the CORS preflight response headers, and (2) include CORS headers in your Lambda function's response for actual method responses.

For the OPTIONS method (Mock integration), configure the integration response to return:
- `Access-Control-Allow-Origin`: your origin or `*`
- `Access-Control-Allow-Methods`: allowed HTTP methods
- `Access-Control-Allow-Headers`: allowed headers

For the actual Lambda responses, your Lambda must include these same headers in the `headers` object of its return value. The common mistake is only configuring the OPTIONS method but forgetting to add CORS headers to the actual GET/POST/etc. Lambda responses.

---

**Q8: What are stage variables and how are they used?**

**A:** Stage variables are key-value pairs associated with a specific API Gateway stage, functioning like environment variables. They allow you to use the same API configuration across multiple stages while pointing to different backends.

Common uses: (1) Referencing different Lambda function aliases per stage — the integration URI can be `arn:aws:lambda:...:function:MyFunc:${stageVariables.lambdaAlias}`, where `lambdaAlias` is `live` in prod and `latest` in dev. (2) Referencing different HTTP endpoints. (3) Passing environment context to Lambda via the event object.

Stage variables are available in Lambda event as `event['stageVariables']`, in integration URIs as `${stageVariables.varName}`, and in mapping templates as `$stageVariables.varName`.

---

**Q9: What is a VPC Link and when do you need it?**

**A:** VPC Link is an API Gateway feature that allows routing requests to resources inside a private VPC without exposing them to the internet. REST APIs use VPC Links backed by Network Load Balancers; HTTP APIs support NLB, ALB, and App Mesh.

You need a VPC Link when: your backend (ECS, EC2, ALB) is in a private subnet with no public access, you want to keep backend traffic off the internet for security/compliance, or you have microservices behind an internal ALB that should not be publicly accessible. The traffic flows: Internet → API Gateway → VPC Link → NLB → private backend. Backend security groups can have rules that only allow traffic from the NLB.

---

**Q10: How does Lambda Authorizer caching work and what are its risks?**

**A:** When caching is enabled on a Lambda Authorizer, the IAM policy returned by the authorizer is cached with the token value as the cache key (for TOKEN type). Subsequent requests with the same token within the TTL window (up to 3600 seconds) reuse the cached policy without invoking the Lambda authorizer again.

Risk: If a user's permissions change (token revoked, account suspended, role changed), the cached policy will still allow or deny access until TTL expires. For security-sensitive applications, use short TTLs (or 0 to disable) at the cost of higher Lambda invocations and latency. For REQUEST type authorizers, the cache key is constructed from the configured identity sources.

---

**Q11: Explain the difference between access logs and execution logs in API Gateway.**

**A:** Access logs record information about each API request — who called, when, response code, latency. They go to a CloudWatch Log Group you specify and have a fully customizable format using `$context` variables. Access logs are like nginx access logs and are suitable for audit trails and usage analytics.

Execution logs are detailed internal API Gateway processing logs. They record every step of request processing: received request, auth check, mapping template input/output, backend call, response transformation, etc. They go to a managed log group (`API-Gateway-Execution-Logs_{apiId}/{stage}`). At INFO level they're very verbose; ERROR level logs only failures. Use execution logs to debug integration issues, mapping template errors, or authorization failures.

---

**Q12: What happens when a Lambda function throws an unhandled exception in Lambda Proxy integration?**

**A:** If Lambda throws an unhandled exception (i.e., it fails rather than returning the required response format), API Gateway returns `502 Bad Gateway` to the client with the message "Internal server error." The Lambda execution still counts as a failure.

To handle this properly, Lambda should catch all exceptions and return appropriate HTTP error responses (400, 404, 500) in the required format with `statusCode`, `headers`, and `body`. Never let a Lambda function with proxy integration throw unhandled exceptions — always wrap in try/catch and return structured error responses.

---

**Q13: How do you implement multi-tenancy with API Gateway?**

**A:** Several approaches: (1) **Usage Plans + API Keys** — create one API key per tenant with different usage plan tiers; tracks per-tenant usage and enforces quotas. (2) **Lambda Authorizer with tenant context** — authorizer validates the token and injects `tenantId` into the context, which Lambda uses to query the right tenant's data. (3) **Stage variables** — a stage per tenant for complete isolation (costly but maximum isolation). (4) **Custom headers** — pass `X-Tenant-ID` header, validated by REQUEST authorizer.

For most cases: JWT token contains tenant info → Lambda Authorizer validates and extracts tenant → context passed to Lambda → Lambda scopes all queries to that tenant's partition.

---

**Q14: What is the maximum integration timeout in API Gateway and how do you handle long-running operations?**

**A:** API Gateway has a maximum integration timeout of **29 seconds**. Lambda itself can run up to 15 minutes, but API Gateway will timeout and return 504 Gateway Timeout after 29 seconds.

For operations that take longer: (1) **Asynchronous pattern** — API Gateway → Lambda → SQS/Step Functions; Lambda returns 202 Accepted immediately with a job ID; client polls a separate `GET /jobs/{jobId}` endpoint for status. (2) **WebSocket API** — maintain connection and push result when ready. (3) **S3 presigned URL** — for file uploads/downloads. (4) **Lambda invoke async** — Lambda triggers background Lambda and returns immediately. The 29-second limit applies to REST and HTTP APIs; WebSocket messages also have a 29-second limit per frame.

---

**Q15: How do you secure an API Gateway endpoint? List all security mechanisms available.**

**A:** Multiple layers of security:

1. **HTTPS Only**: API Gateway only exposes HTTPS endpoints (no plain HTTP).
2. **Resource Policies**: JSON policies attached to the API controlling which AWS accounts, IP ranges, or VPCs can access it.
3. **IAM Authentication**: Clients sign requests with AWS Signature V4 using IAM credentials; API Gateway validates the signature.
4. **Lambda Authorizer**: Custom authorization logic (validate JWTs, API keys, LDAP, etc.).
5. **Cognito User Pool Authorizer**: Validates Cognito JWTs natively.
6. **HTTP API JWT Authorizer**: Native OIDC/OAuth 2.0 JWT validation.
7. **API Keys + Usage Plans**: Track and throttle per client (not authentication, but access control).
8. **WAF (Web Application Firewall)**: Protect against SQL injection, XSS, rate limiting by IP, geographic restrictions.
9. **Throttling**: Prevent DDoS/abuse at account, stage, method, and usage plan levels.
10. **VPC Endpoint (Private API)**: Make API accessible only within VPC via PrivateLink.
11. **Mutual TLS (mTLS)**: Require client certificates for machine-to-machine scenarios.
12. **Certificate Pinning**: Custom domain with ACM certificate.

For exam: Most common is Cognito Authorizer (managed) or Lambda Authorizer (custom logic). Resource policies combined with IAM for cross-account access.

---

*End of API Gateway Complete Guide*
