# Lesson 3: Chroma Collections and Persistence

Man, in Lesson 2 we learned the basics of adding and querying in Chroma. Now let's explore **production persistence**, how to run Chroma as a standalone microservice, and how to manage collections safely at scale.

---

### Step 1: Why Do We Need This?

When you graduate from a Jupyter notebook to a multi-container web application, running Chroma as an in-process Python object causes problems:
1. **Multi-Process Lock Conflicts:** If you run FastAPI with multiple worker processes (e.g. `uvicorn main:app --workers 4`), multiple processes trying to write to the same local SQLite file will lock the database and crash with `OperationalError: database is locked`.
2. **Container Restarts Wipe Local Files:** If your app runs inside Docker or Kubernetes, any local files stored in `/tmp` disappear when the container restarts or scales up.
3. **Wrong Distance Metric:** Chroma defaults to squared L2 distance. If your embedding model expects Cosine Similarity, your search results will be skewed unless you explicitly configure the collection space.

Understanding collections and Chroma's Client/Server architecture solves all of these concurrency and persistence challenges.

---

### Step 2: What Is It?

Chroma can run in two primary modes:

1. **Persistent Local Mode (`PersistentClient`):**
   - Saves SQLite and HNSW index files directly into a specific directory on your disk (e.g., `./chroma_data`).
   - Best for desktop applications, single-worker scripts, and development.

2. **Client/Server Mode (`HttpClient`):**
   - Chroma runs as its own standalone server (often inside a Docker container) on port 8000.
   - Your Python web application connects over HTTP using `chromadb.HttpClient(host="chroma-service", port=8000)`.
   - Multiple backend workers can read and write concurrently without SQLite file lock conflicts!

#### The Everyday Analogy: Personal Notebook vs Shared Office Whiteboard
- **Local Persistent Mode is your personal physical diary:** You can write in it whenever you want, and your notes remain when you close the book. But if two people try to write on the same page with two pens at the exact same second, your hands bump into each other.
- **Client/Server Mode is an office whiteboard with a receptionist:** Chroma acts as the receptionist. Ten different team members send messages to the receptionist, who writes the updates cleanly on the board one by one.

---

### Step 3: Real-World Example

Imagine deploying an enterprise RAG assistant with a FastAPI backend:

- You run Chroma as a Docker container:
  ```bash
  docker run -p 8000:8000 -v ./chroma_storage:/chroma/chroma chromadb/chroma
  ```
- Your FastAPI web server runs with 4 concurrent worker processes.
- All 4 workers connect via `chromadb.HttpClient(host="localhost", port=8000)`.
- If an admin uploads a new PDF, Worker 1 tells the Chroma server to index it.
- Meanwhile, Worker 3 can still answer customer questions without hitting a database lock.
- If the FastAPI container reboots, the Chroma container stays running and zero data is lost.

---

### Step 4: How Does It Work?

Here is how you configure collections, choose distance metrics, and manage persistence:

```
[CONFIGURE COLLECTION WITH COSINE SIMILARITY]
client = chromadb.PersistentClient(path="./production_db")
collection = client.create_collection(
    name="legal_contracts",
    metadata={"hnsw:space": "cosine"}   # <--- Tells HNSW to use Cosine distance!
)

[CLIENT / SERVER ARCHITECTURE]
FastAPI Worker 1 ──┐
FastAPI Worker 2 ──┼──► HTTP Requests ──► [Chroma Server (Port 8000)] ──► Mounted Docker Volume
FastAPI Worker 3 ──┘
```

#### Supported Distance Metrics in Chroma:
When creating a collection, set `metadata={"hnsw:space": "<metric>"}`:
- `"cosine"`: Cosine distance (1 - cosine similarity). Ranges from 0 (identical) to 2.
- `"l2"`: Squared L2 distance (Euclidean). Default if not specified.
- `"ip"`: Inner Product (Dot Product). Use when embeddings are pre-normalized to length 1.

---

### Step 5: Code Example

Here is a Python script showing collection management, custom distance metrics, updates, and deletions:

```python
"""
Chroma Collection Management, Metrics, and Deletion
"""

import chromadb

def manage_production_collections():
    # 1. Initialize persistent storage
    client = chromadb.PersistentClient(path="./my_production_db")

    # 2. Configure collection with explicit COSINE distance space
    collection_name = "customer_tickets"
    
    # Safely get or create
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )
    print(f"Collection '{collection_name}' ready with Cosine metric.")

    # 3. Upsert initial document
    collection.upsert(
        ids=["ticket_101"],
        documents=["Customer cannot connect to VPN on Windows 11."],
        metadatas=[{"status": "open", "priority": "high"}]
    )

    # 4. Update the document when the ticket is resolved
    collection.update(
        ids=["ticket_101"],
        documents=["Customer resolved VPN issue by updating network driver."],
        metadatas=[{"status": "resolved", "priority": "low"}]
    )
    print("Ticket 101 updated.")

    # 5. Query with metadata filter
    res = collection.query(
        query_texts=["network issues on Windows"],
        n_results=1,
        where={"status": "resolved"}
    )
    print(f"Retrieved resolved ticket: {res['documents'][0][0]}")

    # 6. Delete old documents when no longer needed
    collection.delete(where={"status": "resolved"})
    print("Deleted resolved tickets.")

    # 7. List all collections in the database
    all_collections = client.list_collections()
    print(f"Active collections in database: {[c.name for c in all_collections]}")

if __name__ == "__main__":
    manage_production_collections()
```

---

### Step 6: How Is It Used in Production?

| Architecture Concern | What Breaks | Production Fix | Impact |
| :--- | :--- | :--- | :--- |
| **SQLite Lock Contention** | Multiple web worker processes trying to write to the same directory crash with lock errors | Run Chroma in Client/Server mode (via Docker) and connect via `HttpClient` | Supports high concurrency |
| **Silent Metric Mismatch** | Using OpenAI embeddings with default `"l2"` metric distorts nearest neighbor rankings | Always set `metadata={"hnsw:space": "cosine"}` when creating collections | 100% accurate mathematical rankings |
| **Collection Sprawl** | Creating a separate collection for every user (e.g. 10,000 collections) exhausts OS file handles | Use a single shared collection and filter by `tenant_id` in metadata | Scalable to millions of users |
| **Database Backups** | Backing up Chroma while active writes are occurring corrupts SQLite | Pause writes or take volume snapshots of the underlying storage directory | Reliable disaster recovery |

---

### Step 7: Quick Revision

- **Persistent vs Client/Server:** Use `PersistentClient` for single scripts; use `HttpClient` + Docker for multi-worker web apps.
- **Explicit Metric Configuration:** Set `metadata={"hnsw:space": "cosine"}` during `create_collection()`.
- **Full CRUD Support:** Chroma supports `add()`, `upsert()`, `update()`, `get()`, and `delete()`.
- **Filtered Deletions:** You can delete documents by ID list or by metadata criteria (`collection.delete(where={...})`).
- **Interview Answer:** *"In production environments, Chroma is deployed in Client/Server mode via Docker to eliminate SQLite concurrency locks across web workers. Setting the HNSW space metadata to 'cosine' ensures the vector index matches the semantic orientation of modern embedding models."*

---

### Step 8: Final Flow Diagram

```mermaid
flowchart TD
    classDef startEnd fill:#2563eb,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;
    classDef decision fill:#f59e0b,stroke:#d97706,color:#ffffff,stroke-width:2px;
    classDef success fill:#10b981,stroke:#059669,color:#ffffff,stroke-width:2px;
    classDef process fill:#3b82f6,stroke:#1d4ed8,color:#ffffff,stroke-width:2px;

    A([Determine Deployment Architecture]) --> B{Are you running multiple web workers or microservices?}:::decision

    B -- Yes --> C[Run Chroma Server in Docker on port 8000]:::process
    C --> D[Connect via chromadb.HttpClient host='chroma' port=8000]:::success

    B -- No: Desktop or Notebook --> E[Use chromadb.PersistentClient path='./data']

    D --> F[Call get_or_create_collection]
    E --> F

    F --> G{Specify HNSW Distance Space?}:::decision
    G -- Yes --> H[metadata={'hnsw:space': 'cosine'}]:::success
    G -- No --> I[Defaults to L2 squared distance]

    H --> J([Execute Concurrent Reads & Writes]):::startEnd
    I --> J
```

---

### Step 9: Quiz

Test your understanding of Chroma collections and persistence. Submit your answers as `1-A, 2-B, 3-C, 4-D`:

**1. Why does running a local `chromadb.PersistentClient` directly inside a multi-worker FastAPI server risk crashing?**
- A) Chroma cannot run on Linux servers.
- B) Multiple worker processes competing to write to the same local SQLite file can cause database lock contention errors.
- C) FastAPI does not allow vector databases.
- D) SQLite only supports 10 lines of code.

**2. How do you instruct a Chroma collection to use Cosine Distance instead of Euclidean Distance?**
- A) By passing `metadata={"hnsw:space": "cosine"}` when creating the collection.
- B) By renaming the collection to start with the letter 'C'.
- C) By setting the computer clock to UTC.
- D) Chroma only supports Euclidean distance.

**3. In a multi-tenant SaaS application, what is the best practice for isolating tenant data in Chroma?**
- A) Create 50,000 separate collections until the server runs out of file handles.
- B) Store all vectors in a shared collection and filter by `tenant_id` in the `where` metadata query.
- C) Give all tenants the exact same documents.
- D) Delete tenant data after 10 minutes.

**4. What method allows you to delete all documents matching a specific metadata tag in Chroma?**
- A) `collection.clear_all()`
- B) `collection.delete(where={"status": "deprecated"})`
- C) `client.destroy()`
- D) `collection.truncate()`

*(Submit your answers to check your progress!)*
