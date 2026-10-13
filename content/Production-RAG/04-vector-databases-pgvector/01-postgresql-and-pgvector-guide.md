> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 3: Embeddings, Vector Spaces & Similarity Search](../03-embeddings-and-similarity/01-embeddings-and-similarity-search.md) | ➡️ [Module 4.2: Vector Database Quiz & Core Concepts](02-quiz-and-core-concepts.md)

---

# Production RAG — Module 4: Vector Databases

In Module 3, you learned how to convert documents and queries into embeddings and calculate similarity scores. Now we’ll connect those embeddings to real vector databases and build retrieval code inside your existing `production-rag` project.

By the end of this module, you’ll be able to store document chunks, search them by semantic similarity, filter results using metadata, and understand when to choose PostgreSQL + pgvector, Pinecone, Qdrant, or Weaviate.

## 1. Understand where the vector database fits

```
[Your Documents]
(PDFs, text files, internal documentation)
       │
       ▼
[Chunking + Embeddings Engine]
(Text chunks ──► Dense 384d numerical vectors)
       │
       ▼
[Vector Database Storage]
(Vectors + Raw Text + Metadata + HNSW Index · pgvector / Pinecone / Qdrant)
       │
       ▼
[Production Retriever]
(Cosine similarity search + Metadata filtering ──► Top-k relevant chunks)
```

A vector database does more than store vectors. A production system also needs stable chunk IDs, source metadata, access controls, deletion and update handling, and an efficient way to search.

For our examples, we’ll reuse the embedding model from Module 3: `sentence-transformers/all-MiniLM-L6-v2`, which produces **384-dimensional embeddings**. Your stored vectors and query vectors must use compatible dimensions and the same embedding model.

## 2. What we’ll build

  **PostgreSQL + pgvector:** create a table, insert embeddings, run cosine-similarity queries, and filter by metadata.
  **Pinecone:** configure a managed vector index and upsert/query vectors with metadata.
  **Qdrant:** create a collection, upsert points, search, and apply payload filters.
  **Weaviate:** define a collection, store vectors and properties, search, and filter properties.
  **Integration:** connect the adapters to the same chunk and embedding pipeline in your project.
  **Production considerations:** indexes, batch ingestion, updates, deletion, security, and choosing a database.

We'll start with PostgreSQL + pgvector because it lets you combine ordinary relational data and vector search in one database. The same application-level interface will then work with the other three systems.

## 3. Prepare your existing project

Your current project structure is `production-rag`, with an `app/` directory, a `documents/` directory, and a `requirements.txt` file. Keep those; we'll add a small vector-store layer rather than rewriting your ingestion pipeline.

Open Terminal and enter the project:

```bash
cd production-rag
source .venv/bin/activate
```

Install the shared dependencies and the four database clients:

```bash
python -m pip install -U \
  sentence-transformers numpy \
  "psycopg[binary]" pgvector \
  pinecone \
  qdrant-client \
  weaviate-client \
  python-dotenv
```

Save your dependencies:

```bash
python -m pip freeze > requirements.txt
```

For learning, we'll use the same embedding model throughout. That makes the results comparable across databases and avoids accidentally mixing vectors from different models.

### Add the configuration file

Create `.env` in your project root:

```dotenv
# PostgreSQL
DATABASE_URL=postgresql://rag_user:change_me@localhost:5432/ragdb

# Pinecone
PINECONE_API_KEY=

# Qdrant: local Docker server
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Weaviate Cloud
WEAVIATE_URL=
WEAVIATE_API_KEY=
```

Add `.env` to `.gitignore` so your API keys and database credentials aren't committed to Git:

```gitignore
.env
.venv/
__pycache__/
```

The code below uses environment variables rather than hardcoding secrets.

## 4. Create a shared embedding helper

We'll use a single helper to convert text into vectors. This lets all four database adapters receive exactly the same kind of input.

Create `app/embedding_service.py`:

```python

from functools import lru_cache

from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384

@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    """Load the embedding model once per Python process."""
    return SentenceTransformer(MODEL_NAME)

def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed multiple document chunks in one batch."""
    if not texts:
        return []

    model = get_model()

    vectors = model.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )

    if vectors.shape[1] != EMBEDDING_DIMENSION:
        raise ValueError(
            f"Expected {EMBEDDING_DIMENSION} dimensions, "
            f"got {vectors.shape[1]}"
        )

    return vectors.tolist()

def embed_query(query: str) -> list[float]:
    """Embed one search query."""
    return embed_texts([query])[0]

```

Test it:

```bash
python -c "from app.embedding_service import embed_query; v = embed_query('How does subscription billing work?'); print('Dimensions:', len(v)); print('First 5 values:', v[:5])"
```

You should see `Dimensions: 384`. The actual floating-point values may differ slightly across environments or library versions.

### Our common chunk format

The database adapters will expect each chunk to look like this:

```python
chunk = {
    "id": "stable-chunk-id-001",
    "text": "Stripe webhooks notify an application about events.",
    "metadata": {
        "source": "payments.pdf",
        "page": 4,
        "tenant_id": "tenant-1",
        "document_version": "v1",
    },
}
```

This is an interface for the adapter examples, not a claim that your existing chunks already have precisely this shape. Map the output of your Module 2 chunker into these fields. Preserve the stable chunk IDs you already generate, and don't generate a new ID each time you re-index unchanged content.

---

# Part A — PostgreSQL + pgvector

## 5. What is pgvector?

PostgreSQL is a relational database. `pgvector` is an extension that adds vector data types, similarity operations, and vector indexes to PostgreSQL. You can keep ordinary application records and your RAG chunks in the same database. 

  **Think of it as a normal SQL table with a vector column.**

|
**id**

|
**text**

|
**metadata**

|
**embedding**

|
`chunk-001`

|
Billing uses events…

|
`page: 4`

|
`[0.12, -0.03, ...]`

  The real embedding has 384 values for our selected model, not just the two shown in the illustration.

### Step 5.1 — Start PostgreSQL with pgvector

If you have Docker installed, this is a straightforward local development setup:

```bash
docker run --name production-rag-db \
  -e POSTGRES_USER=rag_user \
  -e POSTGRES_PASSWORD=change_me \
  -e POSTGRES_DB=ragdb \
  -p 5432:5432 \
  -d pgvector/pgvector:pg16
```

This uses a PostgreSQL 16 image with pgvector included. If the container already exists, start it with `docker start production-rag-db` rather than creating it again.

For this local learning environment, `change_me` is a placeholder password; replace it before using the setup beyond local development.

Connect to PostgreSQL:

```bash
docker exec -it production-rag-db psql -U rag_user -d ragdb
```

Enable the extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The extension must be installed in the PostgreSQL server and enabled in the database where you'll use it. 

### Step 5.2 — Design the schema

Create a table for your RAG chunks:

```sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_chunks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(384) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rag_chunks_metadata_idx
    ON rag_chunks USING GIN (metadata);

CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
    ON rag_chunks USING hnsw (embedding vector_cosine_ops);

```

Understand each column:

- `id`: stable unique ID for each chunk.
- `content`: the text we want to retrieve and eventually pass to the LLM.
- `embedding VECTOR(384)`: the vector produced by our embedding model.
- `metadata JSONB`: flexible fields such as source, page, tenant and document version.
- `created_at`: useful for monitoring ingestion and debugging.

The HNSW index is an approximate nearest-neighbor index. It can improve search speed on larger datasets, trading some search accuracy for performance. For small datasets, an exact scan can be sufficient. 

### Step 5.3 — Insert embeddings using Python

Create `app/pgvector_store.py`:

```python

import json
import os

import psycopg
from pgvector.psycopg import register_vector

from app.embedding_service import embed_texts, embed_query

DATABASE_URL = os.environ["DATABASE_URL"]

def get_connection():
    conn = psycopg.connect(DATABASE_URL)
    register_vector(conn)
    return conn

def upsert_chunks(chunks: list[dict]) -> None:
    """Insert chunks or update them when their stable IDs already exist."""
    if not chunks:
        return

    vectors = embed_texts([chunk["text"] for chunk in chunks])

    with get_connection() as conn:
        with conn.cursor() as cur:
            for chunk, vector in zip(chunks, vectors):
                cur.execute(
                    """
                    INSERT INTO rag_chunks
                        (id, content, embedding, metadata)
                    VALUES (%s, %s, %s, %s::jsonb)
                    ON CONFLICT (id) DO UPDATE SET
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        metadata = EXCLUDED.metadata
                    """,
                    (
                        chunk["id"],
                        chunk["text"],
                        vector,
                        json.dumps(chunk.get("metadata", {})),
                    ),
                )

def search_chunks(
    query: str,
    top_k: int = 5,
    tenant_id: str | None = None,
) -> list[dict]:
    """Return nearest chunks, optionally scoped to one tenant."""
    query_vector = embed_query(query)

    sql = """
        SELECT
            id,
            content,
            metadata,
            embedding <=> %s AS distance
        FROM rag_chunks
    """
    params = [query_vector]

    if tenant_id is not None:
        sql += " WHERE metadata->>'tenant_id' = %s"
        params.append(tenant_id)

    sql += " ORDER BY embedding <=> %s LIMIT %s"
    params.extend([query_vector, top_k])

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    return [
        {
            "id": row[0],
            "text": row[1],
            "metadata": row[2],
            "distance": float(row[3]),
        }
        for row in rows
    ]

```

Here, `pgvector`'s psycopg integration handles converting Python vectors into PostgreSQL vector values. The `ON CONFLICT` clause makes repeat ingestion update the existing chunk rather than creating duplicate rows. The SQL parameters also avoid building SQL by interpolating user-provided text.

### Step 5.4 — Run an end-to-end test

Create `app/test_pgvector_store.py`:

```python

from dotenv import load_dotenv

load_dotenv()

from app.pgvector_store import upsert_chunks, search_chunks

chunks = [
    {
        "id": "billing-001",
        "text": (
            "Stripe sends webhook events when a subscription "
            "is created, updated, or cancelled."
        ),
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 2,
            "tenant_id": "tenant-1",
        },
    },
    {
        "id": "billing-002",
        "text": (
            "Idempotency prevents the same payment event "
            "from being processed more than once."
        ),
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 3,
            "tenant_id": "tenant-1",
        },
    },
    {
        "id": "python-001",
        "text": "Python lists store ordered collections of values.",
        "metadata": {
            "source": "python-guide.pdf",
            "page": 1,
            "tenant_id": "tenant-2",
        },
    },
]

upsert_chunks(chunks)

results = search_chunks(
    "How do I avoid processing a webhook twice?",
    top_k=3,
    tenant_id="tenant-1",
)

for result in results:
    print(result["id"], result["distance"])
    print(result["text"])
    print(result["metadata"])
    print("---")

```

Run it from the project root:

```bash
python -m app.test_pgvector_store
```

If your table was created successfully, you should see the relevant billing chunks rather than chunks belonging to `tenant-2`.

**Important:** the distance returned by `<=>` is cosine distance, not similarity. With cosine distance, smaller is better. For normalized vectors, cosine similarity can be calculated as `1 - distance`.

### Step 5.5 — Metadata filtering

You can filter by the source document, page, version, or tenant. For example, add this condition to a query:

```sql
WHERE metadata->>'tenant_id' = 'tenant-1'
  AND metadata->>'source' = 'billing-guide.pdf'
```

In the Python implementation, we use a parameterized tenant filter:

```python
results = search_chunks(
    "subscription cancellation",
    top_k=5,
    tenant_id="tenant-1",
)
```

For multi-tenant production systems, don't trust a tenant ID supplied directly by the end user. Derive the authorized tenant from your authenticated server-side request context and enforce access controls consistently. Metadata filtering is a search condition, not a substitute for authorization.

### Step 5.6 — When to use pgvector

Choose PostgreSQL + pgvector when your application already uses PostgreSQL, you need SQL joins and transactions, or you want relational and vector data together. If your workload grows, benchmark HNSW settings, filtering selectivity, and query plans before making performance decisions. 

---

# Part B — Pinecone

## 6. What is Pinecone?

 is a managed vector database. You don't need to maintain your own vector database server; you create an index in Pinecone and connect to it using its Python SDK. 

**Your Python application**
Chunking and embedding model

**Pinecone index**
Vector ID + embedding + metadata

The key concepts are:

- **Index:** holds vectors with a defined dimension and similarity metric.
- **Vector ID:** identifies a stored vector.
- **Metadata:** stores information such as source, page and tenant ID.
- **Namespace:** partitions vectors inside an index, useful for separating logical datasets.

We'll use the standard vector API, where your application creates embeddings and sends vectors to Pinecone. Pinecone also supports other interfaces, so use the one appropriate to how your index was created. 

## Step 6.1 — Create a Pinecone index

1. Open the [Pinecone Console](https://app.pinecone.io/).
2. Create an index named `production-rag`.
3. Set the dimension to **384**.
4. Select **cosine** as the similarity metric.
5. Choose an available cloud and region.
6. Create an API key and set it in your `.env` file.

For this module, create a standard vector index with a top-level dimension and metric.

Add the index name to `.env`:

```dotenv
PINECONE_INDEX=production-rag
```

## Step 6.2 — Insert vectors and search

Create `app/pinecone_store.py`:

```python

import os

from pinecone import Pinecone

from app.embedding_service import embed_texts, embed_query

def get_index():
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    return pc.Index(os.getenv("PINECONE_INDEX", "production-rag"))

def upsert_chunks(chunks: list[dict]) -> None:
    if not chunks:
        return

    vectors = embed_texts([chunk["text"] for chunk in chunks])
    records = []

    for chunk, vector in zip(chunks, vectors):
        metadata = {
            "text": chunk["text"],
            **chunk.get("metadata", {}),
        }

        records.append(
            {
                "id": chunk["id"],
                "values": vector,
                "metadata": metadata,
            }
        )

    index = get_index()
    index.upsert(vectors=records)

def search_chunks(
    query: str,
    top_k: int = 5,
    tenant_id: str | None = None,
) -> list[dict]:
    index = get_index()
    query_vector = embed_query(query)

    kwargs = {
        "vector": query_vector,
        "top_k": top_k,
        "include_metadata": True,
    }

    if tenant_id is not None:
        kwargs["filter"] = {
            "tenant_id": {"$eq": tenant_id}
        }

    response = index.query(**kwargs)

    results = []

    for match in response.matches:
        metadata = match.metadata or {}

        results.append(
            {
                "id": match.id,
                "text": metadata.get("text", ""),
                "metadata": {
                    key: value
                    for key, value in metadata.items()
                    if key != "text"
                },
                "score": float(match.score),
            }
        )

    return results

```

Notice that the text is stored in metadata. Pinecone's vector query returns metadata only when `include_metadata=True` is supplied. 

## Step 6.3 — Test Pinecone

Create `app/test_pinecone_store.py`:

```python
from dotenv import load_dotenv

load_dotenv()

from app.pinecone_store import upsert_chunks, search_chunks

chunks = [
    {
        "id": "billing-001",
        "text": "Stripe sends webhook events for subscription changes.",
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 2,
            "tenant_id": "tenant-1",
        },
    },
    {
        "id": "billing-002",
        "text": "Idempotency prevents duplicate event processing.",
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 3,
            "tenant_id": "tenant-1",
        },
    },
]

upsert_chunks(chunks)

for result in search_chunks(
    "How can I prevent duplicate webhooks?",
    top_k=3,
    tenant_id="tenant-1",
):
    print(result)
```

Run:

```bash
python -m app.test_pinecone_store
```

**What to know:** Pinecone's similarity score is not the same as pgvector's cosine distance. With a cosine index, higher similarity scores are generally better.

For a larger corpus, upsert in batches instead of sending every chunk in one enormous request. Use stable IDs so re-ingestion overwrites existing records instead of creating duplicates.

---

# Part C — Qdrant

## 7. What is Qdrant?

 is a vector database that stores vectors as **points**. Each point has an ID, a vector, and an optional payload containing text and metadata. It supports vector similarity search and filtering on payload fields. 

The vocabulary is slightly different:

| Concept | Meaning |
|---|---|
| Collection | Group of points with a vector configuration |
| Point | Vector plus ID and payload |
| Payload | Text and metadata |
| Distance | Similarity metric, such as cosine |
| Filter | Restricts which points can match |

## Step 7.1 — Start Qdrant locally

Run:

```bash
docker run --name production-rag-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -d qdrant/qdrant
```

Set the local URL in `.env`:

```dotenv
QDRANT_URL=http://localhost:6333
```

For a persistent local environment, configure a mounted data volume before using it for important data. The command above is a quick development setup, not a production deployment.

## Step 7.2 — Create a collection and insert points

Create `app/qdrant_store.py`:

```python

import os
import uuid

from qdrant_client import QdrantClient, models

from app.embedding_service import embed_texts, embed_query

COLLECTION = "production_rag"

def get_client():
    api_key = os.getenv("QDRANT_API_KEY") or None
    return QdrantClient(
        url=os.getenv("QDRANT_URL", "http://localhost:6333"),
        api_key=api_key,
    )

def stable_point_id(chunk_id: str) -> str:
    """Convert an arbitrary stable chunk ID into a deterministic UUID."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))

def ensure_collection(client):
    if not client.collection_exists(COLLECTION):
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=models.VectorParams(
                size=384,
                distance=models.Distance.COSINE,
            ),
        )

def upsert_chunks(chunks: list[dict]) -> None:
    if not chunks:
        return

    client = get_client()
    ensure_collection(client)

    vectors = embed_texts([chunk["text"] for chunk in chunks])
    points = []

    for chunk, vector in zip(chunks, vectors):
        payload = {
            "text": chunk["text"],
            **chunk.get("metadata", {}),
        }

        points.append(
            models.PointStruct(
                id=stable_point_id(chunk["id"]),
                vector=vector,
                payload=payload,
            )
        )

    client.upsert(
        collection_name=COLLECTION,
        points=points,
        wait=True,
    )

def search_chunks(
    query: str,
    top_k: int = 5,
    tenant_id: str | None = None,
) -> list[dict]:
    client = get_client()
    query_vector = embed_query(query)

    query_filter = None

    if tenant_id is not None:
        query_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="tenant_id",
                    match=models.MatchValue(value=tenant_id),
                )
            ]
        )

    response = client.query_points(
        collection_name=COLLECTION,
        query=query_vector,
        query_filter=query_filter,
        limit=top_k,
        with_payload=True,
    )

    results = []

    for point in response.points:
        payload = point.payload or {}

        results.append(
            {
                "id": str(point.id),
                "text": payload.get("text", ""),
                "metadata": {
                    key: value
                    for key, value in payload.items()
                    if key != "text"
                },
                "score": float(point.score),
            }
        )

    return results

```

The UUID conversion matters: Qdrant point IDs are numeric IDs or UUIDs. A stable UUID derived from your original chunk ID lets you keep the same logical ID across repeated ingestion runs.

The collection's vector size must match the embedding dimension. `Distance.COSINE` configures cosine similarity. The Python client supports local and server-backed connections; here we're using a local server. 

## Step 7.3 — Search with metadata filtering

```python
from dotenv import load_dotenv

load_dotenv()

from app.qdrant_store import upsert_chunks, search_chunks

chunks = [
    {
        "id": "billing-001",
        "text": "Subscription updates arrive through webhook events.",
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 2,
            "tenant_id": "tenant-1",
        },
    },
    {
        "id": "billing-002",
        "text": "Idempotency protects against processing an event twice.",
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 3,
            "tenant_id": "tenant-1",
        },
    },
]

upsert_chunks(chunks)

results = search_chunks(
    "How can I safely process repeated webhook events?",
    top_k=5,
    tenant_id="tenant-1",
)

for result in results:
    print(result["score"], result["text"])
```

Run:

```bash
python -m app.test_qdrant_store
```

Save the snippet above as `app/test_qdrant_store.py` first.

Qdrant filters can also combine multiple conditions. For example, you could require `tenant_id` to match and `source` to equal `billing-guide.pdf`. Its payload filtering is a first-class part of the query API. 

---

# Part D — Weaviate

## 8. What is Weaviate?

 organizes data into **collections**. Objects in a collection have properties and vectors. Weaviate supports similarity search with supplied vectors, which is what we'll use because our application already generates embeddings. 

Weaviate also supports configurations where the database generates embeddings itself. Avoid mixing those two approaches without planning how the vectors will be generated: for this course, we want the same 384-dimensional vectors in all four databases.

## Step 8.1 — Set up Weaviate

For the simplest learning setup, create a free cluster in [Weaviate Cloud](https://console.weaviate.cloud/).

Add the cluster endpoint and API key to `.env`:

```dotenv
WEAVIATE_URL=https://your-cluster-endpoint
WEAVIATE_API_KEY=your-api-key
```

Keep the actual values private. The client needs the cluster endpoint and authentication credentials to connect. 

## Step 8.2 — Create a collection and insert objects

Create `app/weaviate_store.py`:

```python

import os
import uuid

import weaviate
from weaviate.classes.init import Auth
from weaviate.classes.config import Configure, DataType, Property
from weaviate.classes.query import Filter

from app.embedding_service import embed_texts, embed_query

COLLECTION = "RagChunk"

def stable_object_id(chunk_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))

def upsert_chunks(chunks: list[dict]) -> None:
    if not chunks:
        return

    vectors = embed_texts([chunk["text"] for chunk in chunks])

    with weaviate.connect_to_weaviate_cloud(
        cluster_url=os.environ["WEAVIATE_URL"],
        auth_credentials=Auth.api_key(
            os.environ["WEAVIATE_API_KEY"]
        ),
    ) as client:

        if not client.collections.exists(COLLECTION):
            client.collections.create(
                name=COLLECTION,
                vector_config=Configure.Vectors.self_provided(),
                properties=[
                    Property(
                        name="text",
                        data_type=DataType.TEXT,
                    ),
                    Property(
                        name="source",
                        data_type=DataType.TEXT,
                    ),
                    Property(
                        name="page",
                        data_type=DataType.INT,
                    ),
                    Property(
                        name="tenant_id",
                        data_type=DataType.TEXT,
                    ),
                    Property(
                        name="document_version",
                        data_type=DataType.TEXT,
                    ),
                ],
            )

        collection = client.collections.get(COLLECTION)

        for chunk, vector in zip(chunks, vectors):
            metadata = chunk.get("metadata", {})

            properties = {
                "text": chunk["text"],
                "source": metadata.get("source", ""),
                "page": int(metadata.get("page", 0)),
                "tenant_id": metadata.get("tenant_id", ""),
                "document_version": metadata.get(
                    "document_version", ""
                ),
            }

            # Replace an existing object with the same stable UUID.
            collection.data.replace(
                uuid=stable_object_id(chunk["id"]),
                properties=properties,
                vector=vector,
            )

def search_chunks(
    query: str,
    top_k: int = 5,
    tenant_id: str | None = None,
) -> list[dict]:
    query_vector = embed_query(query)

    with weaviate.connect_to_weaviate_cloud(
        cluster_url=os.environ["WEAVIATE_URL"],
        auth_credentials=Auth.api_key(
            os.environ["WEAVIATE_API_KEY"]
        ),
    ) as client:

        collection = client.collections.get(COLLECTION)

        filters = None

        if tenant_id is not None:
            filters = Filter.by_property(
                "tenant_id"
            ).equal(tenant_id)

        response = collection.query.near_vector(
            near_vector=query_vector,
            limit=top_k,
            filters=filters,
        )

        results = []

        for obj in response.objects:
            props = obj.properties

            results.append(
                {
                    "id": str(obj.uuid),
                    "text": props.get("text", ""),
                    "metadata": {
                        "source": props.get("source"),
                        "page": props.get("page"),
                        "tenant_id": props.get("tenant_id"),
                        "document_version": props.get(
                            "document_version"
                        ),
                    },
                    "distance": (
                        float(obj.metadata.distance)
                        if obj.metadata.distance is not None
                        else None
                    ),
                }
            )

        return results

```

A few important details:

- `Configure.Vectors.self_provided()` tells Weaviate that your application supplies vectors.
- The collection properties define the metadata fields that we want to query.
- `collection.data.replace()` uses a stable UUID, so rerunning ingestion replaces that object's properties and vector instead of creating another object.
- `near_vector()` searches using the query embedding you generated in Python.

The example uses the Weaviate Python client's v4-style API. If you're using a different server/client version, check its compatibility and the current client documentation. 

## Step 8.3 — Test Weaviate

Create `app/test_weaviate_store.py`:

```python
from dotenv import load_dotenv

load_dotenv()

from app.weaviate_store import upsert_chunks, search_chunks

chunks = [
    {
        "id": "billing-001",
        "text": "Subscription lifecycle events are delivered by webhooks.",
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 2,
            "tenant_id": "tenant-1",
            "document_version": "v1",
        },
    },
    {
        "id": "billing-002",
        "text": "Idempotency prevents duplicate processing.",
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 3,
            "tenant_id": "tenant-1",
            "document_version": "v1",
        },
    },
]

upsert_chunks(chunks)

for result in search_chunks(
    "How do I handle a webhook arriving twice?",
    top_k=3,
    tenant_id="tenant-1",
):
    print(result)
```

Run:

```bash
python -m app.test_weaviate_store
```

The Weaviate example uses a schema with a fixed set of properties. If you want arbitrary metadata keys, you should define and maintain the schema deliberately instead of assuming every field in a Python dictionary will be queryable automatically.

---

# 9. Integrate a vector store with your existing RAG pipeline

You now have four implementations of the same basic operations:

- `upsert_chunks(chunks)`
- `search_chunks(query, top_k, tenant_id)`

Each database has different internal concepts and response formats, but your ingestion pipeline should not need to know all those details.

Your project can grow toward this structure:

```text
production-rag/
├── app/
│   ├── embedding_service.py
│   ├── pgvector_store.py
│   ├── pinecone_store.py
│   ├── qdrant_store.py
│   ├── weaviate_store.py
│   ├── ingest.py
│   ├── retrieve.py
│   └── ...
├── documents/
├── .env
├── .gitignore
└── requirements.txt
```

### Step 9.1 — Build the ingestion entry point

Create `app/ingest.py`. For now, use the sample chunks; later, replace them with the output of your actual Module 1 loader and Module 2 chunker.

```python
from dotenv import load_dotenv

load_dotenv()

from app.pgvector_store import upsert_chunks

chunks = [
    {
        "id": "billing-001",
        "text": (
            "A webhook is an HTTP callback sent when an event occurs."
        ),
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 1,
            "tenant_id": "tenant-1",
            "document_version": "v1",
        },
    },
    {
        "id": "billing-002",
        "text": (
            "Idempotency ensures an event is not processed twice."
        ),
        "metadata": {
            "source": "billing-guide.pdf",
            "page": 2,
            "tenant_id": "tenant-1",
            "document_version": "v1",
        },
    },
]

upsert_chunks(chunks)
print(f"Indexed {len(chunks)} chunks")
```

This particular entry point uses PostgreSQL. To test another provider, change the import to the corresponding store module and configure its connection.

The production version should pass chunks from your actual loader/chunker, batch embeddings, record ingestion status, and handle document updates or deletions. It should not hardcode document content in the ingestion script.

### Step 9.2 — Build the retrieval entry point

Create `app/retrieve.py`:

```python
from dotenv import load_dotenv

load_dotenv()

from app.pgvector_store import search_chunks

question = "How can I prevent a webhook from being processed twice?"

results = search_chunks(
    question,
    top_k=5,
    tenant_id="tenant-1",
)

for index, result in enumerate(results, start=1):
    print(f"\nResult {index}")
    print("Text:", result["text"])
    print("Metadata:", result["metadata"])
    print("Distance:", result.get("distance"))
    print("Score:", result.get("score"))
```

Run the pipeline:

```bash
python -m app.ingest
python -m app.retrieve
```

This retrieves context but does not yet generate an answer with an LLM. That's intentional: first verify that retrieval returns the right chunks. Module 5 can build on this foundation for stronger retrieval strategies.

---

# 10. Compare all four databases

![Vector Database Architecture & Indexing Patterns](/images/production-rag/vector-database-architecture.png)

### 1. PostgreSQL + pgvector
**Best when:** You already use PostgreSQL, need ACID transactions, relational joins, and want to consolidate operational data with embeddings under one unified database engine.

### 2. Pinecone
**Best when:** You want a fully managed cloud SaaS vector database and prefer not to self-host or tune index memory. You manage API keys, cloud latency, index sizing, and costs.

---

### 3. Qdrant
**Best when:** You need high-speed vector search with rich JSON payload filtering and the versatility to run embedded locally for prototyping or containerized in Kubernetes.

---

### 4. Weaviate
**Best when:** You want modular schema collections with custom cross-modal properties and flexible vectorizer integrations.

These are starting points, not universal rankings. Actual performance depends on corpus size, filters, indexing configuration, concurrency, latency requirements, and operational constraints.

## 11. Production checklist

Before using any of these databases in a real RAG application, verify the following:

- [ ] **Dimensions:** every stored vector and query vector uses the expected dimension.
- [ ] **Embedding consistency:** document and query vectors use a compatible model and preprocessing.
- [ ] **Stable IDs:** repeated ingestion updates existing chunks.
- [ ] **Metadata:** source, page, document version and other required fields are preserved.
- [ ] **Tenant isolation:** authorized users can retrieve only their permitted documents.
- [ ] **Batching:** embeddings and writes are batched for efficiency.
- [ ] **Deletion and updates:** changing or deleting a source document also updates or removes its old chunks.
- [ ] **Retrieval quality:** test whether the correct chunk appears in the top results, not just whether the query succeeds.
- [ ] **Index tuning:** measure latency and retrieval recall before changing index parameters.
- [ ] **Secrets:** API keys and database credentials stay out of Git and client-side code.

One particularly important point: **a successful database insert doesn't prove your RAG retrieval is good.** You must evaluate whether the right chunks are returned for realistic questions.

## 12. Practice exercise

  ### Module 4 checkpoint

  Select your answers, then check your understanding.
  1. Your app already stores users and subscriptions in PostgreSQL. Which vector store is a natural first choice?

- [ ] PostgreSQL + pgvector
- [ ] Pinecone only
- [ ] Weaviate only

---

  2. Which filter is most important for separating private documents between customers?

- [ ] Filter on similarity distance alone
- [ ] A tenant/authorization filter enforced by the server
- [ ] Increase top-k to return more chunks

---

  3. What should happen when the same unchanged chunk is ingested twice?

- [ ] Reuse its stable ID and update or replace the existing record
- [ ] Generate a new random ID each time
- [ ] Always skip all future ingestion runs

## What's next?

**Module 5: Advanced Retrieval** — we'll build on these database adapters to cover metadata filtering in depth, hybrid search (keyword + vector), query rewriting, reranking, and context compression. Those techniques are what turn a basic vector search into a stronger production RAG retriever.

Official references for this module: [pgvector](https://github.com/pgvector/pgvector), [Pinecone Python SDK](https://sdk.pinecone.io/python/how-to/vectors/upsert-and-query.html), [Qdrant quickstart](https://qdrant.tech/documentation/quickstart/), and [Weaviate Python client](https://docs.weaviate.io/weaviate/client-libraries/python).

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 3: Embeddings, Vector Spaces & Similarity Search](../03-embeddings-and-similarity/01-embeddings-and-similarity-search.md) | ➡️ [Next: Module 4.2: Vector Database Quiz & Core Concepts](02-quiz-and-core-concepts.md)
