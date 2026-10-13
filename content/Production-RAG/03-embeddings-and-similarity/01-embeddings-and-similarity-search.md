> 📚 **[Production RAG Curriculum](../README.md)** | ⬅️ [Module 2.2: macOS Python Environment & Dependencies Setup](../02-chunking-strategies/02-macos-python-environment-setup.md) | ➡️ [Module 4.1: PostgreSQL + pgvector Vector Database Architecture](../04-vector-databases-pgvector/01-postgresql-and-pgvector-guide.md)

---

# Module 3 — Embeddings and Similarity Search

Production RAG course · Lesson 3 · Python

Man, now we're getting into the core of RAG. In Module 1, we learned how to load documents. In Module 2, we learned how to split them into chunks. Now we're going to teach our system how to **find the chunks that are most relevant to a user's question**.

We'll use the same refund-policy assistant throughout the lesson, write executable Python, and build toward a real vector-search pipeline.

## 1. What are embeddings?

![Vector Embeddings Geometry, Vector Spaces & Cosine Distance](/images/production-rag/embedding-geometry-similarity.png)

An embedding is a list of numbers that represents text in a mathematical space. An embedding model learns to represent text so that useful semantic relationships can be captured by comparing the resulting vectors.

For example, imagine our documents contain these sentences:

DOCUMENT A
“Customers can request their money back within 30 days.”

DOCUMENT B
“The refund period is 30 days from purchase.”

DOCUMENT C
“Our office is located in Hyderabad.”

---

  If the embedding model captures these meanings well, A and B may have more similar vectors than A and C.

That lets us search by meaning instead of relying only on exact word matches.

For example, a user could ask:

> “When can I get my money back?”

The document might use the phrase “refund period.” A good embedding model can help match the question to that document even though the wording differs.

**Important:** Embeddings don't understand facts perfectly. They represent learned patterns in text. Similarity is a useful signal for retrieval, not proof that a passage answers a question.

## 2. How text becomes a vector

An embedding model converts a text string into a numerical vector.

```
[Input Raw Text]
("Refunds are processed within five business days.")
       │
       ▼
[Embedding Model]
(Tokenizer ──► Neural Transformer Network ──► Dense Vector Representation)
       │
       ▼
[Dense Embedding Vector]
([0.021, -0.184, 0.391, 0.057, -0.102, ...] · 384 to 1536 float dimensions)
```

These numbers aren't manually assigned meanings such as “refund = 0.8.” Meaning is distributed across the dimensions, and the model learns useful representations from training.

### Why do we need vectors?

Computers can compare vectors mathematically. Given a question vector and document vectors, we can rank the documents using a similarity or distance measure.

Our retrieval workflow becomes:

1. Load and chunk documents.
2. Generate an embedding for every chunk.
3. Store the embeddings alongside chunk text and metadata.
4. Generate an embedding for each incoming question.
5. Compare the question vector with stored vectors.
6. Retrieve the top relevant chunks.

A crucial optimization: **embed documents during ingestion, not every time a user asks a question.** At query time, we normally embed only the incoming question and search the precomputed document vectors.

---

## 3. Generate embeddings with Python

We'll start locally using `sentence-transformers`, so you can experiment without needing an API key.

### Step 1 — Install the package

Make sure your project's virtual environment is active. You should see `(.venv)` in your terminal.

```bash
python -m pip install sentence-transformers numpy
```

This library may download a model the first time you use it. That download requires an internet connection.

### Step 2 — Embed a few sentences

Create `app/embeddings_demo.py`.

```python

from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

sentences = [
    
1. Customers can request a refund within 30 days.
    
1. The refund period is 30 days from purchase.
    
1. Our office is located in Hyderabad.
]

vectors = model.encode(
    sentences,
    normalize_embeddings=True,
)

print("Number of sentences:", len(sentences))
print("Vector shape:", vectors.shape)
print("First vector dimensions:", vectors[0][:10])

```

Run it:

```bash
python -m app.embeddings_demo
```

You should get a vector shape similar to:

```text
Number of sentences: 3
Vector shape: (3, 384)
```

The model `all-MiniLM-L6-v2` produces 384-dimensional embeddings. The output has three rows because we supplied three sentences.

Each row represents one sentence.

If your machine downloads the model slowly or runs out of memory, we can troubleshoot that separately. You don't need a GPU for this basic experiment, although inference speed depends on your hardware.

## 4. Cosine similarity — comparing vectors

Cosine similarity is one of the most commonly used measures in embedding-based retrieval.

It compares the angle between two vectors. When their directions are similar, their cosine similarity is high.

The formula is:

\[
\operatorname{cosine}(A,B)=
\frac{A\cdot B}{\|A\|\|B\|}
\]

Where:

- \(A\) is the question embedding.
- \(B\) is a document embedding.
- \(A\cdot B\) is the dot product.
- \(\|A\|\) and \(\|B\|\) are the vector magnitudes.

For nonzero vectors, cosine similarity ranges from \(-1\) to \(1\). Higher values indicate greater directional similarity.

### A practical example

Let's compare the user's question against three document chunks.

```python

import numpy as np

query = np.array([1.0, 0.0])

documents = {
    "refund policy": np.array([0.9, 0.1]),
    "refund timeline": np.array([0.8, 0.2]),
    "office location": np.array([0.0, 1.0]),
}

def cosine_similarity(a, b):
    denominator = np.linalg.norm(a) * np.linalg.norm(b)

    if denominator == 0:
        raise ValueError("Cosine similarity is undefined for zero vectors")

    return float(np.dot(a, b) / denominator)

scores = {
    name: cosine_similarity(query, vector)
    for name, vector in documents.items()
}

for name, score in sorted(
    scores.items(),
    key=lambda item: item[1],
    reverse=True,
):
    print(f"{name}: {score:.4f}")

```

These are toy vectors, not real text embeddings. Their purpose is to demonstrate the calculation.

Expected ranking:

```text
refund policy:     0.9939
refund timeline:   0.9701
office location:   0.0000
```

The first two vectors point in similar directions to the query vector, while the office vector points in a perpendicular direction.

Real embedding vectors have many dimensions, and their similarity scores are model-dependent.

### What about normalized embeddings?

In our earlier code, we used:

```python
vectors = model.encode(
    sentences,
    normalize_embeddings=True,
)
```

This scales each nonzero vector to have a magnitude of 1.

For normalized vectors:

\[
\operatorname{cosine}(A,B)=A\cdot B
\]

That means we can use the dot product directly to calculate cosine similarity. This is computationally convenient, especially when comparing a query against many document vectors.

---

## 5. Distance metrics: cosine, Euclidean and dot product

Cosine similarity is not the only way to compare embeddings. Let's look at the three main options.

### A. Cosine similarity

Measures directional similarity. Higher is better.
Useful when the direction of an embedding matters more than its magnitude.

---

### B. Euclidean distance (L2)

Measures straight-line distance. Lower is better.
\[
d(A,B)=\sqrt{\sum_i(A_i-B_i)^2}
\]
Useful when your vector representation and index are configured for L2 distance.

---

### C. Dot product

Measures the sum of coordinate-wise products. Higher is better for maximum-inner-product search.
\[
A\cdot B=\sum_i A_iB_i
\]
Unlike cosine similarity, the raw dot product is affected by vector magnitudes.

### Interactive example

  Compare a unit query vector with a second vector

Second vector magnitude
### {vectorScale.toFixed(1)}

Angle between vectors
### {vectorAngle}°

---

Cosine
### {vectorCos.toFixed(3)}

Higher is better

Dot product
### {vectorDot.toFixed(3)}

Higher is better

L2 distance
### {vectorL2.toFixed(3)}

Lower is better

  Observe that changing the magnitude leaves cosine similarity unchanged when the angle stays fixed, but changes the dot product and Euclidean distance.

### Which metric should you use in production?

There is no universally best metric.

- Use cosine similarity when that aligns with your embedding model and retrieval design.
- Use dot product when the model and index are intended for maximum-inner-product search.
- Use Euclidean distance when appropriate for the model and index configuration.

For **unit-normalized vectors**, cosine similarity, dot-product ranking and Euclidean-distance ranking are equivalent in ordering: cosine and dot product are maximized, while L2 distance is minimized.

Always check your embedding model's recommendations and your vector database's distance configuration. A mismatch between indexing and query-time settings can silently degrade retrieval.

---

## 6. Similarity search: retrieve the most relevant chunks

Now we'll connect embeddings to actual RAG retrieval.

Suppose we've stored these chunks:

- Refund eligibility.
- Refund processing time.
- Office location.
- Support contact details.

A user asks: “How long does a refund take?”

The system embeds the question and compares it against the stored chunk embeddings. It then ranks the chunks and returns the top results.

The number of returned results is often called **top-k**.

For example, `top_k=3` requests the three highest-ranked chunks.

### Python: implement top-k retrieval

Create `app/retrieval_demo.py`.

```python

import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

chunks = [
    {
        "text": 
1. Customers can request a refund within 30 days.
        "source": 
1. refund_policy.pdf
        "page": 1,
    },
    {
        "text": 
1. Approved refunds are processed within five business days.
        "source": 
1. refund_policy.pdf
        "page": 2,
    },
    {
        "text": 
1. Our office is located in Hyderabad.
        "source": 
1. company_profile.pdf
        "page": 1,
    },
    {
        "text": 
1. Contact support for help with your refund request.
        "source": 
1. support_guide.pdf
        "page": 3,
    },
]

# Offline ingestion step: compute chunk embeddings once.
chunk_texts = [chunk["text"] for chunk in chunks]

document_vectors = model.encode(
    chunk_texts,
    normalize_embeddings=True,
)

# Query-time step: embed the incoming question.
question = 
1. How long does it take to receive a refund?
query_vector = model.encode(
    [question],
    normalize_embeddings=True,
)[0]

# Cosine similarity equals dot product for normalized vectors.
scores = document_vectors @ query_vector

top_k = 3
indices = np.argsort(scores)[::-1][:top_k]

for index in indices:
    print(f"Score: {scores[index]:.4f}")
    print(f"Text: {chunks[index]['text']}")
    print(
        f
1. Source: {chunks[index]['source']}, 
        f
1. page {chunks[index]['page']}
    )
    print("-" * 40)

```

Run:

```bash
python -m app.retrieval_demo
```

The exact scores and ranking depend on the model. The refund processing chunk should be a strong candidate for the question.

### Why do we embed the chunks only once?

This is a critical production optimization.

Imagine you have 100,000 chunks. Re-embedding all of them whenever a user asks a question would be expensive and slow.

Instead:

**During ingestion**
- Generate document embeddings.
- Store vectors and associated metadata.
- Index the vectors for retrieval.

**During a user query**
- Generate one query embedding.
- Search the existing index.
- Retrieve relevant chunk text and metadata.

If the embedding model changes, however, you generally need to re-embed the documents with the new model. Vectors from incompatible models shouldn't simply be mixed in the same embedding space.

---

## 7. What is vector indexing?

Our previous example calculates similarity against every document vector. This is called **brute-force search**.

It works well for small collections, but becomes expensive as the dataset grows.

Imagine you have 1 million chunks. If every query compares against every vector, the system performs a huge number of vector comparisons for each request.

A vector index makes retrieval more efficient.

There are two broad approaches:

**Exact nearest-neighbor search**

Compare the query against all vectors and return the true top-k according to the configured metric. Simple and useful as a baseline, but potentially expensive at scale.

**Approximate nearest-neighbor (ANN) search**

Use an index to find likely nearest neighbors without comparing against every vector. Usually much faster at scale, but can miss some true nearest neighbors.

### Common indexing algorithms

| Index | How it works | Trade-off |
|---|---|---|
| Flat / exact | Scans every vector | Exact results, potentially slower |
| HNSW | Builds a navigable graph of nearby vectors | Fast queries, additional memory and build cost |
| IVF | Partitions vectors into clusters and searches selected clusters | Lower search work, needs tuning |
| Quantization | Compresses vector representations | Lower memory use, possible accuracy loss |

These approaches are not mutually exclusive in every system. For example, IVF can be combined with product quantization.

### A simple indexing example with scikit-learn

Before moving to specialized vector databases, you can experiment with nearest-neighbor search locally.

Install:

```bash
python -m pip install scikit-learn
```

```python
import numpy as np
from sklearn.neighbors import NearestNeighbors

# Example normalized vectors; replace these with real embeddings.
document_vectors = np.array([
    [1.0, 0.0],
    [0.9, 0.1],
    [0.0, 1.0],
], dtype=np.float32)

query_vector = np.array([[1.0, 0.05]], dtype=np.float32)

index = NearestNeighbors(
    n_neighbors=2,
    metric=
1. cosine
    algorithm=
1. brute
)

index.fit(document_vectors)

distances, indices = index.kneighbors(query_vector)

for idx, distance in zip(indices[0], distances[0]):
    print(
        f
1. Document index: {idx}, 
        f
1. cosine similarity: {1 - distance:.4f}
    )
```

This example uses exact brute-force search; it demonstrates the nearest-neighbor API, not an ANN speedup. Later, we'll use a real vector database and explore its indexing options.

**Production rule:** Measure both retrieval quality and latency. A fast index that misses the relevant refund policy is not useful. Compare ANN results against exact-search results on a representative evaluation set.

---

## 8. Production embedding best practices

These decisions have a big impact on reliability.

**1. Use the same embedding model consistently**

Document and query embeddings must belong to compatible vector spaces. Record the model name and version alongside your ingestion configuration.

---

**2. Validate vector dimensions**

If the database expects 384 dimensions and your new model generates 768, the insertion may fail. Use a separate collection or index for incompatible embedding configurations.

---

**3. Batch embedding requests**

Process multiple chunks in a batch instead of making one model call per chunk. Choose batch sizes based on available memory, model limits and throughput.

---

**4. Store metadata with each vector**

Keep the chunk ID, document ID, source, page, version and access-control metadata. Retrieval should return the text and metadata needed for downstream grounding and citations.

---

**5. Don't assume a similarity threshold**

A cosine score of 0.75 is not a universal confidence score. Score distributions vary across models, data and queries. Tune thresholds using labeled examples and measure how often relevant evidence is retrieved.

---

**6. Apply authorization before exposing results**

For multi-tenant applications, enforce tenant and document permissions during retrieval. Don't retrieve private chunks and rely on the LLM to avoid revealing them.

## 9. Common mistakes to avoid

- **Embedding the full document instead of its chunks:** this often reduces retrieval precision for long documents.
- **Using a different model for queries and documents:** their vectors may not be comparable.
- **Mixing up distance and similarity:** for cosine similarity, higher is better; for cosine distance and L2 distance, lower is better.
- **Assuming the nearest chunk is always correct:** vector search returns the closest available candidates, even when none actually answers the question.
- **Ignoring exact keyword matching:** semantic search can struggle with product codes, error IDs, exact names and unusual identifiers. This is one reason we'll study hybrid search later.
- **Treating retrieval scores as factual confidence:** the LLM must still ground its answer in the retrieved evidence.

## 10. Your Module 3 mini-project

Let's connect the lesson to your existing `production-rag` project.

### Implementation checklist


  Complete these tasks locally before moving to the next module.
- [ ] Install `sentence-transformers` and generate embeddings for three sample sentences.
- [ ] Calculate cosine similarities and inspect the ranked results.
- [ ] Run the retrieval demo using a refund-period question and a refund-processing question.
- [ ] Confirm that retrieved results include the correct source and page metadata.
All four tasks marked complete. You're ready to move on to vector databases.

## 11. Quick knowledge check

  Question 1: What does an embedding represent?

- [ ] A numerical representation of text in a vector space
- [ ] A copy of the original PDF
- [ ] The final answer generated by the LLM

---

  Question 2: With cosine similarity, which result is generally preferred?

- [ ] The lowest score
- [ ] The highest score
- [ ] Always a score of exactly 0.5

---

  Question 3: Why use an ANN index?

- [ ] To guarantee that every result is factually correct
- [ ] To eliminate the need for embeddings
- [ ] To improve search efficiency, potentially sacrificing some recall

---

  Question 4: When should document chunks be embedded?

- [ ] Again for every user query
- [ ] During ingestion, with query embeddings generated at search time
- [ ] Only after the LLM generates its answer


> **Key takeaway:** Embeddings represent text numerically.

> **Key takeaway:** Higher cosine similarity is generally preferred.

> **Key takeaway:** ANN improves efficiency but may miss true neighbors.

> **Key takeaway:** Precompute document embeddings and embed incoming questions at query time.

**Next module:** Vector databases — we'll move beyond in-memory arrays and build persistent vector storage with PostgreSQL + pgvector, then compare it with Pinecone, Qdrant and Weaviate.

---

> 📚 **[Return to Curriculum Index](../README.md)** | ⬅️ [Previous: Module 2.2: macOS Python Environment & Dependencies Setup](../02-chunking-strategies/02-macos-python-environment-setup.md) | ➡️ [Next: Module 4.1: PostgreSQL + pgvector Vector Database Architecture](../04-vector-databases-pgvector/01-postgresql-and-pgvector-guide.md)
