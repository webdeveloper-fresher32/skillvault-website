> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 7.1: Build a Production RAG API with FastAPI](01-fastapi-service.md) | ➡️ [Module 7.3: Rate Limiting, Timeouts, Retries & Error Handling](03-rate-limiting-timeouts-and-retries.md)

---

# Module 7 — Lesson 2: Authentication, Tenant Isolation, and API Security

Let's secure the RAG API we built in the previous lesson.

Imagine you're building a RAG platform for multiple companies:

- Company A uploads confidential HR documents.
- Company B uploads its own HR documents.
- Both companies ask questions using the same API.

**The most important rule: Company B must never retrieve Company A's documents—even if the documents are semantically relevant to the question.**

This is called **tenant isolation**.

## 1. Understand the security architecture

**Client sends a request**
Question + authentication token

**Authentication**
Verify the token and identify the user

**Authorization**
Determine which tenant the user may access

**Tenant-scoped retrieval**
Apply tenant filters in the database query

**Generate and validate the answer**
Use only authorized evidence

Authentication and authorization are different:

- **Authentication:** Who are you?
- **Authorization:** What are you allowed to access?

A valid token alone does not mean the user can read every document.

## 2. Never trust a tenant ID sent by the client

Consider this request:

```json
{
  "question": 
1. Show me the salary policy
  "tenant_id": 
1. company-a
}
```

If the server blindly trusts `tenant_id`, a user from Company B could change it to `"company-a"` and attempt to retrieve Company A's data.

Instead, the client sends an authentication token:

```http
Authorization: Bearer <access_token>
```

The server verifies the token and derives the user's tenant from trusted identity claims. The client does not get to choose its own tenant identity.

## 3. Add authentication to FastAPI

For a real application, use your identity provider—such as an OIDC-compatible provider—and validate its access tokens using the provider's supported library or verified JWT configuration. Don't decode a JWT and trust its contents without validating its signature, issuer, audience, and expiry.

For this lesson, we'll create a small **local development example** using a preconfigured trusted-token lookup. It demonstrates the API boundary without pretending that a hardcoded token is production authentication.

Create `app/auth.py`:

```python

import os
from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False)

@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str
    roles: frozenset[str]

def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
) -> Principal:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail=
1. Authentication required
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # DEMO ONLY: map a test token to a fixed identity.
    # Replace this lookup with real access-token verification.
    demo_token = os.getenv("DEMO_ACCESS_TOKEN")

    if not demo_token or token != demo_token:
        raise HTTPException(
            status_code=401,
            detail=
1. Invalid access token
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Principal(
        user_id=
1. demo-user
        tenant_id=
1. demo-tenant
        roles=frozenset({"user"}),
    )

def require_admin(
    principal: Principal = Depends(get_current_principal),
) -> Principal:
    if "admin" not in principal.roles:
        raise HTTPException(
            status_code=403,
            detail=
1. Administrator permission required
        )

    return principal

```

Add a temporary token to your local `.env` file:

```dotenv
DEMO_ACCESS_TOKEN=replace-with-a-long-random-development-token
```

Load `.env` when starting the app—for example, using `python-dotenv` and `load_dotenv()` near the start of your application entry point. Ensure `.env` is in `.gitignore` and never commit it.

This token lookup is **not suitable for production**: it represents one fixed user and tenant, has no expiry or revocation, and doesn't verify a real identity provider's claims. Its purpose is to help you understand where authentication belongs.

## 4. Connect the authenticated identity to your RAG endpoint

Update the relevant parts of `app/api.py`. Replace the previous `get_current_tenant()` placeholder with the authenticated principal:

```python

from fastapi import Depends, FastAPI, HTTPException

from app.auth import Principal, get_current_principal
from app.monitored_rag import ask_monitored

@app.post("/ask", response_model=AskResponse)
def ask(
    request: AskRequest,
    principal: Principal = Depends(get_current_principal),
) -> AskResponse:
    try:
        result = ask_monitored(
            question=request.question,
            tenant_id=principal.tenant_id,
            source=request.source,
        )

        return AskResponse(
            answer=result["answer"],
            sources=result.get("sources", []),
        )

    except Exception:
        logger.exception("RAG request failed")
        raise HTTPException(
            status_code=500,
            detail=
1. Unable to process the question right now.
        )

```

Keep your existing `app`, `AskRequest`, `AskResponse`, logger, and `/health` definitions. Add the imports and replace the old `/ask` handler rather than creating a second route with the same path.

Now the flow is:

1. FastAPI verifies the demo token lookup.
2. The server constructs a `Principal`.
3. The route passes the trusted `principal.tenant_id` to the RAG pipeline.
4. Retrieval must enforce that tenant ID at the database layer.

The fourth step is essential. Passing a tenant ID around is not isolation by itself.

## 5. Enforce tenant isolation in PostgreSQL

Your `rag_chunks` table already has a JSONB `metadata` field. If tenant IDs are stored inside it, your retrieval query must filter by that metadata.

For example, the semantic search query should contain a condition equivalent to:

```sql
SELECT
    id,
    content,
    metadata,
    embedding <=> %s AS distance
FROM rag_chunks
WHERE metadata->>'tenant_id' = %s
ORDER BY embedding <=> %s
LIMIT %s;
```

The parameters must be supplied using your database driver's parameterized-query mechanism, not string concatenation.

For hybrid search, **both** the semantic branch and the full-text branch need the same tenant restriction before their results are combined. Apply the restriction to reranking and compression inputs too by ensuring those stages only receive authorized candidates.

Also verify that your ingestion process writes the correct `tenant_id` into every chunk's metadata. A missing or incorrectly assigned tenant is an ingestion security problem, not merely a retrieval-quality issue.

## 6. Test the secured endpoint

Restart your API after configuring the local demo token.

Set the same token in your terminal that you set in `.env`:

```bash
export DEMO_ACCESS_TOKEN='replace-with-a-long-random-development-token'
```

If your app loads `.env` using `load_dotenv()`, you can use the same value there instead.

Send a request with the token:

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Authorization: Bearer $DEMO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"How does hybrid search work?"}'
```

Test without a token:

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How does hybrid search work?"}'
```

The second request should receive `401 Unauthorized`. A valid demo token should pass authentication, although the request can still fail if the database or LLM configuration is not ready.

## 7. Production security checklist

["Authentication", "Verify tokens using a trusted identity provider; validate signature, issuer, audience and expiry."],
["Tenant isolation", "Filter every retrieval query by the authenticated tenant, including hybrid search."],
["Ingestion", "Assign tenant ownership on the server and prevent clients from forging document metadata."],
["Authorization", "Check permissions for document uploads, deletion, administration and retrieval."],
["Input protection", "Limit request sizes, validate filters, and rate-limit expensive requests."],
["Data protection", "Keep credentials out of source control and avoid logging sensitive document contents."],
["Testing", "Add tests proving that a tenant cannot retrieve another tenant's chunks."]

**{item[0]}**
{item[1]}

## 8. Your practical exercise


1. Create app/auth.py and configure the development token.
2. Update /ask to derive tenant_id from the authenticated principal.
3. Confirm a request without a token receives HTTP 401.
4. Verify in the database that retrieval filters by tenant_id in both semantic and lexical search.
- [ ] setChecks(prev=>prev.map((x,j)=>i===j?v:x))} lineThrough={false}>{task}

**Next lesson: Rate limiting, timeouts, retries, and error handling.** We'll make the RAG API more resilient when users send too many requests, PostgreSQL becomes slow, or the LLM provider experiences temporary failures.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 7.1: Build a Production RAG API with FastAPI](01-fastapi-service.md) | ➡️ [Next: Module 7.3: Rate Limiting, Timeouts, Retries & Error Handling](03-rate-limiting-timeouts-and-retries.md)
