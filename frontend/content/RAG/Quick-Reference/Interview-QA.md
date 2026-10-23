# RAG Interview Q&A

50 questions covering the full RAG course, organized by topic.

---

### Q1. What is RAG and what problem does it solve?

Retrieval-Augmented Generation (RAG) combines a retrieval step with an LLM generation step: instead of relying solely on what the model memorized during training, the system retrieves relevant documents from an external knowledge source at query time and includes them in the prompt. This solves two core LLM limitations — outdated/missing knowledge (the model's training cutoff) and hallucination (making up facts confidently). RAG grounds the answer in retrieved, verifiable text rather than the model's parametric memory alone.

### Q2. What are the four core stages of a RAG pipeline?

Index (load, chunk, and embed documents into a vector store), retrieve (embed the incoming query and find the most similar stored chunks), augment (insert the retrieved chunks into a prompt alongside the question), and generate (the LLM produces its answer using that augmented prompt). Every phase of a RAG course maps onto improving one of these four stages.

### Q3. Why not just fine-tune an LLM on your documents instead of using RAG?

Fine-tuning bakes knowledge into model weights, which is expensive to update, doesn't cite sources, and can still hallucinate confidently. RAG keeps the knowledge base external and swappable — updating a document just means re-indexing it, not retraining a model — and the retrieved chunks can be shown to the user as citations. RAG and fine-tuning aren't mutually exclusive; fine-tuning can teach behavior/style while RAG supplies fresh factual grounding.

### Q4. What is the difference between the "retrieve" and "augment" stages?

Retrieve is the search step: embed the query, run similarity search (and possibly hybrid/reranking) against the vector store, and return a ranked list of candidate chunks. Augment is the prompt-construction step: taking those retrieved chunks and inserting them into a structured prompt template alongside the user's question and any instructions, so the LLM has the context it needs before generating.

### Q5. What kinds of questions is RAG good at, and where does it struggle?

RAG excels at fact-lookup and grounding questions where the answer exists as text somewhere in the corpus — "what does section 4.2 of the policy say?" It struggles with questions requiring reasoning across many disconnected facts (multi-hop), questions about relationships between entities (a job better suited to GraphRAG), and questions with no answer present in the corpus at all (where a well-built system should say "I don't know" rather than hallucinate).

### Q6. Walk through what happens end-to-end when a user asks a RAG system a question.

The query is embedded using the same embedding model used at index time. That query vector is used for similarity search against the vector store, returning a top-k list of chunks (optionally combined with hybrid/BM25 search and reranked with a cross-encoder). The selected chunks are formatted into a prompt template with the original question. That prompt is sent to the LLM, which generates an answer grounded in the provided context, ideally with citations back to the source chunks.

### Q7. Why does the embedding model used for indexing have to match the one used for querying?

Different embedding models produce vectors in different, incompatible geometric spaces — even if both are "good" models, distances/similarities computed between a vector from model A and a vector from model B are meaningless. If you switch embedding models, every previously indexed document must be re-embedded and re-indexed with the new model; you cannot mix vectors from two different models in one similarity search.

### Q8. What are the most common overall failure modes across a RAG pipeline?

Bad chunking (splitting mid-sentence or losing context), retrieval missing the right chunks (wrong k, wrong embedding model, no hybrid search), retrieved chunks not being genuinely relevant (needing MMR or reranking), and generation being unfaithful to the retrieved context (hallucinating despite good retrieval). A systematic debugging approach traces the query through each stage individually rather than guessing at the whole pipeline.

---

### Q9. What is a text embedding?

A text embedding is a fixed-length numeric vector produced by an embedding model that represents the meaning of a piece of text, such that texts with similar meaning are positioned close together in vector space. It turns the unsolvable problem of comparing strings for semantic similarity ("dog" vs. "puppy" are different byte sequences) into a solvable geometry problem (comparing vectors).

### Q10. Explain cosine similarity, and why it's the default metric for text embeddings.

Cosine similarity measures the angle between two vectors — `dot(A,B) / (|A| * |B|)` — ranging from -1 to 1, where 1 means the vectors point in exactly the same direction. It ignores vector magnitude and only cares about direction, which suits text embeddings well because embedding magnitude often reflects things like text length rather than meaning; two chunks about the same topic should be "close" regardless of how long each one is.

### Q11. What is the difference between cosine similarity and dot product, and when are they equivalent?

Dot product is `sum(A_i * B_i)` — unbounded and sensitive to vector magnitude, unlike cosine similarity which normalizes by each vector's length. If vectors are pre-normalized to unit length (magnitude = 1) at index time, dot product and cosine similarity produce the same ranking, and dot product is cheaper to compute at query time since you skip the normalization step per comparison.

### Q12. What is Euclidean (L2) distance and how does it differ from cosine similarity?

Euclidean distance is the straight-line distance between two vectors — `sqrt(sum((A_i - B_i)^2))` — where 0 means identical and larger values mean less similar. Unlike cosine similarity, it's sensitive to vector magnitude, so two vectors pointing the same direction but with different lengths would appear "far apart" under L2 distance despite representing similar meaning; it's used when magnitude is actually meaningful to the comparison.

### Q13. Why can't you directly compare embeddings from two different embedding models?

Each embedding model learns its own internal geometry during training — dimensions don't correspond to the same concepts across models, and even the number of dimensions typically differs. A vector from model A and a vector from model B live in unrelated coordinate systems, so any similarity score computed between them is meaningless noise, not a real signal.

### Q14. What practical mistakes commonly happen with embeddings in a RAG system?

Using different embedding models for indexing vs. querying (vectors become incomparable), forgetting to normalize vectors when a metric like dot product assumes normalization, and choosing an embedding model dimension that doesn't match what the vector database index was created for (e.g., a Pinecone index created for 1536 dimensions can't store 768-dimension vectors without error).

---

### Q15. Why is chunking necessary at all — why not embed whole documents?

An entire long document is too large to embed meaningfully (embedding models compress arbitrarily long text into one fixed-length vector, losing fine-grained detail) and even if it fit, retrieving "the whole document" for every query defeats the purpose of precise retrieval. Chunking breaks documents into pieces small enough to embed with fidelity and specific enough that only the relevant piece — not the whole document — gets pulled into the prompt.

### Q16. What is fixed-size chunking with overlap, and why does the overlap matter?

Fixed-size chunking splits text every N characters or tokens into equal-sized pieces. Overlap (typically 10-20% of chunk size) means consecutive chunks share some text at the boundary, so a sentence or idea that falls right on a chunk boundary isn't completely lost to just one side — it appears at least partially in both neighboring chunks, reducing the chance that a key fact gets orphaned mid-cut.

### Q17. How does `RecursiveCharacterTextSplitter` improve on naive fixed-size chunking?

Instead of cutting at a hard character count regardless of what's there, it tries a priority list of separators — paragraph breaks first, then sentence breaks, then word breaks — falling back to a hard character cut only if none of those boundaries are available within the size limit. This means chunks are far more likely to end at a natural linguistic boundary instead of slicing a sentence in half.

### Q18. What is semantic chunking and when is it worth the extra cost?

Semantic chunking embeds individual sentences, then measures the similarity between adjacent sentence embeddings; a significant drop in similarity signals a topic shift, and that's where the chunk boundary is placed. It's worth the extra embedding calls for long-form, topic-shifting prose (articles, reports) where structural boundaries (paragraphs) don't reliably align with meaning shifts; it's wasted overhead for short, uniformly-structured documents like FAQs.

### Q19. Explain sentence-window retrieval.

Sentence-window retrieval indexes small, precise units (often single sentences) for accurate embedding matching, but at retrieval time returns a window of surrounding sentences (the matched sentence plus N sentences before/after) rather than just the single matched sentence. This gets the precision benefit of small chunks for the similarity search itself while still giving the LLM enough surrounding context to actually understand and use the match.

### Q20. Explain parent-document retrieval and why "one chunk size fits all" fails.

Parent-document retrieval embeds small child chunks (for precise similarity matching) but maps each child back to a larger parent chunk or section; when a child chunk matches the query, the system returns the parent for full context instead of just the small fragment. "One chunk size fits all" fails because different document types need different tradeoffs — an FAQ wants small self-contained chunks, a technical manual needs enough surrounding context to make instructions coherent, and code needs semantic (function/class) boundaries rather than character counts — so a single fixed strategy underperforms across a real, mixed document collection.

---

### Q21. Why doesn't brute-force similarity search scale, and what does an ANN index do about it?

Brute-force search computes similarity between the query vector and every single stored vector — fine for a few thousand vectors, but computationally prohibitive at hundreds of thousands or millions. An Approximate Nearest Neighbor (ANN) index (e.g., HNSW, IVFFlat) pre-organizes vectors into a searchable structure — a graph or clusters — so a query only needs to compare against a small, promising subset of vectors, trading a small amount of recall accuracy for a massive speed gain.

### Q22. Compare Chroma, Pinecone, and pgvector at a high level.

Chroma is a lightweight, local/embedded vector store — no account, no server, ideal for prototyping and development. Pinecone is a fully managed cloud vector database — always-on, scalable independently of your app, suited to production workloads that need reliability without operating infrastructure yourself. pgvector is a PostgreSQL extension that adds a `vector` column type and similarity operators directly to a relational database you may already run, letting vector search live alongside ordinary SQL filters with no new database to provision.

### Q23. How do you create a Chroma collection and add documents to it?

Create a persistent client with `chromadb.PersistentClient(path=...)`, then call `.get_or_create_collection(name=...)` to get a collection object. Add documents with `.add(ids=..., documents=..., embeddings=..., metadatas=...)`, and query with `.query(query_embeddings=..., n_results=k)`. Using a `PersistentClient` (rather than the default in-memory client) is what makes the data survive process restarts.

### Q24. What is an "upsert" in the context of vector databases, and why does Pinecone rely on it?

An upsert is an insert-or-update operation: if a vector with a given id already exists, it's overwritten; if not, it's created. Pinecone (and similar managed stores) expose upserts as the primary write operation because production applications constantly need to add new vectors and update existing ones (e.g., a document was edited) without needing separate insert vs. update code paths or downtime.

### Q25. What are Pinecone namespaces and why do they matter for multi-tenant applications?

Namespaces let you logically partition vectors within a single Pinecone index — each namespace behaves like an isolated sub-index that queries can be scoped to. For multi-tenant apps, this means each tenant's data can live in its own namespace within one index rather than provisioning a separate (costly) index per tenant, while still allowing per-tenant query isolation.

### Q26. How do you combine metadata filtering with vector similarity search in Pinecone?

Pinecone's query call accepts both the query vector and a metadata filter expression using operators like `$eq`, `$in`, `$gte`, applied to a document's stored metadata fields. The filter narrows the candidate set (e.g., "only documents where `user_id` equals this user" or "only after this date") while the vector similarity search ranks within that filtered set — both happen as part of the same query call, not as separate sequential steps the client has to stitch together.

### Q27. Explain the three pgvector distance operators and what each computes.

`<->` computes L2 (Euclidean) distance — straight-line distance between two vectors. `<=>` computes cosine distance, defined as `1 - cosine_similarity`. `<#>` computes the negative inner product (negated dot product) — negated because Postgres `ORDER BY` sorts ascending and you want the "best" (highest raw dot product) match to sort first as the smallest (most negative) value.

### Q28. When would a team choose pgvector over Pinecone, and what indexing choice matters at scale?

A team already running PostgreSQL for its application data benefits from pgvector because it avoids operating a second database system, and it lets a single SQL query combine an ordinary relational `WHERE` filter with a vector `ORDER BY` similarity search in one statement — something that requires two round trips (filter, then vector query) in a separate vector-only store. At scale, an unindexed vector column forces a full table scan on every query, so choosing IVFFlat (cluster-based, faster to build, needs a tuned `lists` parameter) or HNSW (graph-based, better query-time recall/speed, slower to build) becomes necessary — HNSW when query latency matters most, IVFFlat for smaller/simpler datasets.

---

### Q29. What is "lost in the middle" and how does it affect choosing k in top-k retrieval?

"Lost in the middle" refers to LLMs paying less attention to information buried in the middle of a long prompt compared to information near the beginning or end. This means increasing k to "be safe" doesn't just add token cost — beyond a certain point it can actively hurt answer quality, because the truly relevant chunk risks getting position-buried among lower-relevance ones. k should be tuned empirically against a small evaluation set, not maximized blindly.

### Q30. Why does pure vector similarity search sometimes underperform plain keyword search?

Vector embeddings capture semantic meaning but can miss exact-match needs — a product SKU, an error code, or an acronym might not embed close to itself if paraphrased differently in the corpus, whereas a keyword search would find the exact string trivially. Vector search is good at "similar meaning," not guaranteed at "contains this exact token."

### Q31. Explain BM25 and how it differs fundamentally from embedding-based search.

BM25 is a classic term-frequency-based ranking function — it scores documents based on how often query terms appear in them, adjusted for document length and term rarity across the corpus (inverse document frequency). It has nothing to do with embeddings or meaning; it's a statistical keyword-matching approach, which is precisely why it's complementary to vector search rather than a competitor to it.

### Q32. Explain Reciprocal Rank Fusion and give its formula.

RRF is a method for merging multiple ranked lists (e.g., a BM25 ranked list and a vector-similarity ranked list) into one combined ranking without needing the lists' raw scores to be on the same scale. For each document, sum `1 / (k + rank(d))` across every list it appears in, using a constant `k` (default 60) to dampen the impact of very high ranks; documents appearing near the top of multiple lists get boosted, giving a hybrid ranking that reflects both keyword and semantic relevance.

### Q33. Explain Maximal Marginal Relevance (MMR) and its formula.

MMR selects retrieved chunks by balancing relevance to the query against diversity from chunks already selected, preventing a result set of five near-identical near-duplicate chunks. Its formula is `MMR = λ * sim(doc, query) − (1 − λ) * max_sim(doc, selected)`: the first term rewards relevance to the query, the second term penalizes similarity to documents already chosen. A `λ` near 1 favors pure relevance (closer to plain top-k); a `λ` near 0 favors maximizing diversity.

### Q34. When would you filter-then-rank vs. rank-then-filter when combining metadata filters with retrieval?

Filter-then-rank (apply the metadata filter first, then run similarity search only within the filtered subset) is preferable when the filter is highly selective (e.g., "only this tenant's 200 documents out of 2 million") because it keeps the similarity search fast and scoped. Rank-then-filter (run similarity search broadly, then filter results afterward) risks returning too few or zero results if the filter is applied after truncating to top-k, since relevant filtered matches might have been cut before the filter was even applied.

### Q35. What's the difference between pure vector search, pure keyword search, and hybrid search, and when does each win?

Pure vector search wins on paraphrased/semantic queries ("how do I reset my password" matching a doc titled "account recovery steps"). Pure keyword (BM25) search wins on exact-token queries (error codes, SKUs, acronyms, proper nouns). Hybrid search — combining both via RRF — wins in the general case where you don't know in advance which type of match a given query needs, at the cost of running two retrieval passes instead of one.

---

### Q36. Why does a fast retriever's top-k results need reranking at all?

Fast retrievers (vector similarity, hybrid search) are optimized for speed across potentially millions of candidates, which means they use cheaper, less precise scoring (independently embedding query and document, i.e. a bi-encoder). This produces a reasonable but imperfect ordering. Reranking applies a slower, more accurate model to just the shortlist to fix the fine-grained ordering before the results ever reach the LLM.

### Q37. What is the difference between a bi-encoder and a cross-encoder?

A bi-encoder embeds the query and each document independently into vectors, then compares them with a similarity metric — fast because document embeddings can be precomputed and compared with simple math at query time. A cross-encoder feeds the query and a document together into the model in one forward pass, letting it directly attend to the interaction between them — much more accurate but far slower, since it can't precompute anything and must run a full model pass per (query, document) pair. This is why cross-encoders are only ever run over a small shortlist, never the full corpus.

### Q38. Explain HyDE (Hypothetical Document Embeddings) and why it helps.

HyDE addresses the mismatch between short queries and long documents in embedding space: instead of embedding the raw user query, an LLM first generates a hypothetical answer to that query, and that hypothetical answer's embedding is used for retrieval instead. Because the hypothetical answer is structurally and stylistically closer to what real matching documents look like (both are "answer-shaped" prose), it often embeds closer to the true relevant documents than the short original question would.

### Q39. Does HyDE require the hypothetical answer to be factually correct?

No — HyDE swaps the query embedding, it does not use the hypothetical answer's content as a fact source for generation. Even a hallucinated hypothetical answer can be useful for retrieval purposes as long as it's stylistically/structurally similar to real answers, since only its embedding position matters, not its truth. The actual generation step afterward still relies on the retrieved real documents, not the hypothetical.

### Q40. Explain query expansion / multi-query retrieval and its cost tradeoff.

An LLM generates several reworded variants of the original query, each variant is used to retrieve independently, and the resulting ranked lists are merged (typically with RRF) into one combined result set. This catches relevant documents that use different wording than the original phrasing, at the cost of extra LLM calls to generate variants and extra retrieval passes — over-generating too many variants adds latency and cost for diminishing accuracy gains.

---

### Q41. Name and define the four core RAG evaluation metrics.

Faithfulness measures whether the generated answer is actually grounded in the retrieved context rather than hallucinated. Answer relevance measures whether the answer actually addresses the question asked (a faithful-but-irrelevant answer still fails this). Context precision measures how much of the retrieved context is actually relevant/useful (vs. noise). Context recall measures how much of the truly relevant information available in the corpus was actually surfaced by retrieval.

### Q42. What does a low context recall score indicate is broken, versus a low faithfulness score?

Low context recall means the retriever failed to surface relevant information that existed somewhere in the corpus — the fix is upstream, in embedding model choice, chunking, or `k`/retrieval strategy. Low faithfulness means the retrieved context may have been fine, but the LLM generated content not actually supported by that context — the fix is in prompting (e.g., "answer only using the provided context") or model choice, not retrieval.

### Q43. How would you implement a simplified LLM-as-judge faithfulness check?

Send the LLM the generated answer alongside the retrieved context chunks, and ask it to output a grounded/ungrounded verdict — essentially, "is every claim in this answer supported by this context, yes or no (and which claims aren't)?" This mirrors a teacher grading an essay against a source text rather than grading it in isolation; it's a lightweight, repeatable proxy for faithfulness without needing human annotation for every query.

### Q44. Why is it a mistake to evaluate only the final generated answer's quality?

Judging only the final answer conflates two independent things: whether retrieval found the right information, and whether generation used it correctly. A wrong answer could stem from bad retrieval (right answer wasn't even in context) or bad generation (right context was there but the LLM ignored or misused it) — without tracing the pipeline stage-by-stage (structured tracing) and measuring retrieval-specific metrics (context precision/recall) separately from generation metrics (faithfulness/relevance), you can't tell which stage to fix, and a retrieval problem can masquerade as a prompting problem.

---

### Q45. What is Agentic RAG and how does it differ from a fixed RAG pipeline?

A fixed RAG pipeline always retrieves the same way for every query — same k, same single retrieval pass, unconditionally. Agentic RAG lets an LLM decide whether, what, and how many times to retrieve, following a decide → act → observe → decide-again loop. This handles cases a fixed pipeline can't: queries that need no retrieval at all, queries needing a different tool (calculator, live database, web search), and queries needing multiple sequential retrieval passes to answer.

### Q46. Explain a self-querying retriever.

A self-querying retriever uses an LLM to parse a natural-language question into two parts: a semantic search string (for vector similarity search) and a structured metadata filter (e.g., date range, category) extracted from the same sentence — for example, "pricing articles from last month" becomes a semantic query for "pricing" plus a metadata filter on publish date. The extracted filter must still be validated/sanitized before being applied, since blindly trusting a model-generated filter is a known failure mode.

### Q47. What is multi-step/iterative retrieval and what termination conditions does it need?

Multi-step retrieval handles multi-hop questions that can't be answered by a single retrieval pass — the system retrieves, reasons about what it found, decides what to look for next based on that, and retrieves again, repeating until it has enough information. It needs a sound termination condition combining both a hard max-iteration cap (to bound cost/latency even if the model gets stuck) and a model-decided "I have enough information now" exit signal (so it doesn't always run to the cap unnecessarily).

---

### Q48. Why does plain vector search struggle with relationship-style questions, and how does GraphRAG address this?

Plain vector search finds chunks that are semantically *similar* to a query, but a relationship between two entities ("who reports to the person who manages the Sydney office?") isn't necessarily something you can embed into one retrievable chunk — it may require connecting facts that live in entirely separate documents. GraphRAG addresses this by extracting a knowledge graph — entities as nodes, relationships as edges (extracted from text via an LLM as entity-relation-entity triples) — and at query time, traversing outward 1-2 hops from matched entities to gather connected context, which is then combined with standard vector-retrieved chunks in the same prompt.

### Q49. What are the three introductory approaches to multimodal RAG?

Image captioning: use a multimodal LLM to generate a text caption/description of an image, then store and retrieve that caption as ordinary searchable text alongside a reference to the original image. Multimodal embeddings: embed images and text into a shared vector space so both can be compared directly by similarity. Structured table extraction: extract tables into structured markdown or JSON representations that preserve row/column relationships better than flattened plain text would. Each targets the blind spot of a text-only embedding pipeline, which cannot "see" charts, screenshots, or tabular data.

### Q50. What are the key production concerns for a RAG system beyond making it work in a notebook, and how do they map to caching, security, and monitoring?

Caching: a layered strategy of embedding caches (avoid re-embedding identical text), semantic caches (cosine-similarity match against recent queries to catch near-duplicate questions, with a staleness/invalidation tradeoff), and response caches (TTL-based caching of full answers) to cut cost and latency on repeated query patterns. Security: per-user/per-tenant metadata filters must be enforced server-side — never trusted from client input — plus PII redaction before indexing and audit logging of what was retrieved. Monitoring: track per-stage latency (not just end-to-end), watch for retrieval-quality drift and vector index drift as the underlying document set evolves, and monitor cost-per-query along with upstream LLM API rate limits or outages, since these production-specific failure modes don't show up during development.
