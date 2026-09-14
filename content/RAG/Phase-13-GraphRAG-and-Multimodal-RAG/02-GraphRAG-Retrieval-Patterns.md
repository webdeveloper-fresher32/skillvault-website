# 02 — GraphRAG Retrieval Patterns

> How to actually use a knowledge graph at query time — walking outward from matched entities and combining that context with standard vector retrieval.

---

## Table of Contents

1. [The Problem: A Graph Is Useless Until You Query It](#1-the-problem-a-graph-is-useless-until-you-query-it)
2. [The Analogy: Following a Trail vs. Checking the Nearest Dot](#2-the-analogy-following-a-trail-vs-checking-the-nearest-dot)
3. [Graph Traversal Retrieval, Step by Step](#3-graph-traversal-retrieval-step-by-step)
4. [Implementing Graph Traversal in networkx](#4-implementing-graph-traversal-in-networkx)
5. [Pure Vector RAG vs. GraphRAG](#5-pure-vector-rag-vs-graphrag)
6. [Common Mistakes](#6-common-mistakes)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. The Problem: A Graph Is Useless Until You Query It

Lesson 01 built a knowledge graph — entities as nodes, relationships as labeled edges, extracted from text via an LLM. But a graph sitting in memory (or in a graph database) doesn't answer any questions by itself. Given a user's question at query time, you need a concrete procedure for turning that question into a walk through the graph, and turning that walk into text you can hand to an LLM alongside — or instead of — the usual vector-retrieved chunks.

This is a genuinely different problem from anything in Phases 5 through 9. Vector retrieval is a single step: embed the query, run a similarity search, get back the top-k chunks. Graph-based retrieval is inherently multi-step: first figure out *which entities* the query is even talking about, then decide *how far to walk* from those entities and *along which relationships*, then turn whatever you collected along the way back into text. Get any of those steps wrong — match the wrong entity, walk too few hops, or walk in every direction indiscriminately — and you either miss the answer entirely or drown the LLM in irrelevant graph context.

---

## 2. The Analogy: Following a Trail vs. Checking the Nearest Dot

**Real-world analogy:** imagine you're looking at a subway map (not a straight-line geographic map — the kind where stations are dots and lines connect them).

Plain vector search is like being handed a list of all stations sorted by how close their *names* sound to the one you asked about — useful if you're trying to find "Kings Cross" and there are three similarly-named stations, but useless if what you actually need is "how do I get from here to Kings Cross." GraphRAG is like actually looking at the map and tracing the connected line from your current station to the destination, stop by stop. You're not asking "which single dot is closest to what I said" — you're asking "which dots are *reachable* from here, and by which route."

That's the essential shift graph traversal retrieval makes: instead of scoring every chunk independently against the query and taking the top few, you anchor on the entity or entities the query is actually about, and then follow the graph's edges outward from there, collecting whatever is *connected* rather than whatever is merely *similar*.

> 🧠 Use this analogy when explaining GraphRAG's retrieval step specifically (as opposed to Lesson 01's "why build a graph at all"): *"Vector search checks which dot is closest. GraphRAG follows the trail of connected dots from where you are to where the answer lives."*

---

## 3. Graph Traversal Retrieval, Step by Step

A GraphRAG query-time retrieval pass, at the introductory level this course covers, has three stages:

**Stage 1 — Entity matching.** Given the user's question, identify which node(s) in the graph it refers to. In a simple system, this can be done with a case-insensitive substring or fuzzy match against node names (e.g., does the question mention "Priya" or "Sydney office"?). More sophisticated systems use an LLM call, or the same embedding techniques from Phase 2, to map ambiguous or partial mentions in the question to the correct graph node.

**Stage 2 — Bounded traversal.** Starting from the matched node(s), walk outward along the graph's edges for a small, fixed number of hops — typically 1 or 2. Each hop visits the neighboring nodes connected to the current node and collects the relationship (edge) that connects them. Two hops is usually the practical ceiling for an introductory system: each additional hop multiplies how many nodes you might touch, and a graph is exactly as "connected" as a real social network — three or four hops away, you can often reach almost the entire graph, at which point "traversal" degenerates into "everything," and the result is no more useful than dumping the whole graph into the prompt.

**Stage 3 — Combine with vector retrieval.** The text you collected from the graph walk (the entities and relationships encountered) is not a replacement for vector-retrieved chunks — it's additional structured context. In practice, most GraphRAG systems run *both* a standard vector similarity search (Phase 8) and a graph traversal, and include the results of both in the final prompt sent to the LLM. The graph context answers "how are these things connected"; the vector-retrieved chunks answer "what does the source text actually say about them."

---

## 4. Implementing Graph Traversal in networkx

The following function takes a query entity name and a `networkx.DiGraph` (built the way Lesson 01 built one), and returns the connected context found by walking outward 1-2 hops.

```python
import networkx as nx

def walk_graph_context(graph: nx.DiGraph, start_entity: str, max_hops: int = 2) -> list[str]:
    """Walk outward from start_entity up to max_hops edges, collecting a
    human-readable sentence for every relationship encountered.

    Returns a list of strings like "Priya Anand manages Sydney office", ready
    to be joined into a block of text alongside vector-retrieved chunks.
    """
    if start_entity not in graph:
        return []

    collected: list[str] = []
    # `visited` tracks nodes we've already expanded from, so a cycle in the
    # graph (A connects to B connects back to A) doesn't loop forever.
    visited = {start_entity}
    frontier = [start_entity]  # nodes to expand on this hop

    for _ in range(max_hops):
        next_frontier = []
        for node in frontier:
            # graph.edges(node, data=True) returns every OUTGOING edge from
            # `node` as a (source, target, attributes_dict) tuple -- for a
            # DiGraph this only follows edges in their stored direction.
            for source, target, attrs in graph.edges(node, data=True):
                relation = attrs.get("relation", "is related to")
                collected.append(f"{source} {relation} {target}")
                if target not in visited:
                    visited.add(target)
                    next_frontier.append(target)
        frontier = next_frontier
        if not frontier:
            break  # nothing new to expand -- stop early

    return collected


def graphrag_retrieve(graph: nx.DiGraph, query_entity: str, vector_retrieve_fn, query: str) -> str:
    """Combine graph-walk context with standard vector retrieval into one
    context block, ready to insert into the augment step of the RAG prompt
    (Phase 1, Stage 3).
    """
    graph_facts = walk_graph_context(graph, query_entity, max_hops=2)
    # `vector_retrieve_fn` stands in for whatever Phase 8 retriever you're
    # already using (e.g. a populated Chroma collection's .query() call) --
    # it's passed in here so this function stays independent of any one
    # vector store implementation.
    vector_chunks = vector_retrieve_fn(query)

    # "x or y": if graph_facts is empty, "\n".join(graph_facts) produces an
    # empty string, which Python treats as falsy — so the expression falls
    # through to the fallback message on the right instead of returning "".
    graph_section = "\n".join(graph_facts) or "No connected graph facts found."
    vector_section = "\n\n".join(vector_chunks) or "No matching text chunks found."

    return f"Known relationships:\n{graph_section}\n\nRelevant passages:\n{vector_section}"
```

`graph.edges(node, data=True)` is the key `networkx` call here: for a `DiGraph`, it returns only the edges *going out from* `node`, each as a `(source, target, attrs)` tuple, where `attrs` is the dictionary of keyword arguments you passed to `add_edge` (in Lesson 01's case, `{"relation": "manages"}`). This is different from `graph.neighbors(node)`, which returns just the target node names with no edge data — useful when you only care *which* nodes are reachable, not *how* they're connected, but for building a readable context string you need the relationship label too, so `edges(node, data=True)` is the right call here.

Note that `graphrag_retrieve` takes `vector_retrieve_fn` as a parameter rather than hard-coding a specific vector store call — this keeps the function decoupled from whichever vector database you're using (Chroma, Pinecone, or pgvector from Phases 5-7), as long as that store has already been populated with your document chunks before this function runs (an empty, unpopulated collection would return nothing to combine with the graph facts, defeating the whole point of Stage 3).

---

## 5. Pure Vector RAG vs. GraphRAG

| Question type | Pure vector RAG | GraphRAG |
|---|---|---|
| "What is our refund policy?" (topic lookup) | Handles well — one chunk is directly about this | Unnecessary — no relationship to traverse |
| "Summarize the onboarding process" (topic lookup) | Handles well | Unnecessary |
| "Who reports to the person who manages the Sydney office?" (multi-hop relationship) | Struggles — no single chunk connects these two facts | Handles well — two hops from "Sydney office" |
| "Which projects does Priya's team own?" (entity-to-entity) | Struggles unless one document happens to state this directly | Handles well — traverse from "Priya" through "team" to "projects" |
| "What's the average latency mentioned across our incident reports?" (aggregation across many chunks) | Partial — depends on retrieving enough of the right chunks | Doesn't help — this isn't a relationship question at all |

The pattern in this table is the whole point: GraphRAG doesn't make retrieval better in general — it makes a *specific class* of relationship-shaped question answerable at all, at the cost of being irrelevant (or actively unhelpful — see Common Mistakes) for the topic-lookup questions that plain vector search already handles well.

---

## 6. Common Mistakes

**Mistake 1: Reaching for GraphRAG on simple lookup questions plain vector search already handles.** If most of your actual query traffic is "what does policy X say" or "summarize document Y," running a graph traversal on top of vector retrieval adds latency (Stage 1's entity-matching step alone is extra work) and complexity without improving any of those answers — the graph facts collected will typically be empty or irrelevant for a question that was never about relationships in the first place. Reserve the graph traversal path for questions your entity-matching step actually recognizes as being anchored on a specific entity.

**Mistake 2: Letting `max_hops` grow unchecked.** Because real-world graphs tend to be densely connected, 3+ hops from a starting node often reaches a very large fraction of the entire graph. At that point the "connected context" you collect stops being a targeted answer to the question and starts being nearly the whole knowledge base restated as sentences — exactly the "more context is always better" misconception Phase 1 already warned against, just arrived at via a different mechanism. Keep `max_hops` small (1-2) and let Stage 1's entity matching do the work of narrowing scope, rather than compensating for a poor starting point with a wider walk.

**Interview angle:** A frequent follow-up after "what is GraphRAG" is "how do you decide when to actually use it in a real system?" The strong answer names both halves of the tradeoff from the comparison table: GraphRAG earns its complexity specifically on relationship/multi-hop questions, and for everything else it's pure overhead layered on top of a vector search path that was already sufficient. Naming a concrete signal for the decision — e.g., "look at real user query logs and check what fraction of questions require chaining facts about named entities together" — shows you'd validate the need rather than add GraphRAG because it sounds sophisticated.

---

## 7. Hands-On Exercises

### Exercise 1 — Trace a 1-hop and a 2-hop walk by hand

**Goal:** Build intuition for what `max_hops` actually controls before trusting the code to do it.

Using the graph you built in Lesson 01's Exercise 2, pick a starting entity and manually write down (on paper or in a comment) every fact reachable at exactly 1 hop, then every *additional* fact reachable at exactly 2 hops. Then run `walk_graph_context` with `max_hops=1` and `max_hops=2` and confirm your hand-traced answer matches the function's output.

### Exercise 2 — Combine graph and vector context

**Goal:** See Stage 3 actually working end to end, not just in isolation.

Using a populated Chroma collection from Phase 5 (a handful of short text chunks is enough — don't query an empty collection) and the graph from Exercise 1, write a small `vector_retrieve_fn` wrapper around `collection.query(...)` that returns a list of chunk text strings. Call `graphrag_retrieve` with a query that has a clear entity anchor, and print the combined context block. Confirm both sections (graph facts and vector chunks) are populated.

### Exercise 3 — Decide: graph, vector, or both?

**Goal:** Practice the judgment call from Mistake 1, on realistic-sounding queries.

For each of the following, decide whether you'd route it through graph traversal, plain vector retrieval, or both, and justify your answer in one sentence: (a) "What's our PTO policy?" (b) "Who are all the people on teams managed by someone who reports directly to the CTO?" (c) "Does the onboarding doc mention who the Sydney office manager is?"

---

## 8. Interview Q&A

### Q1. What are the three stages of graph traversal retrieval?

**Answer:** Entity matching — figuring out which graph node(s) the query refers to; bounded traversal — walking a small, fixed number of hops (typically 1-2) outward from the matched node(s), collecting the relationships encountered; and combining that graph-derived context with standard vector-retrieved chunks in the final prompt, since the graph answers "how are these connected" while the chunks answer "what does the source text say."

---

### Q2. In `networkx`, what's the difference between `graph.neighbors(node)` and `graph.edges(node, data=True)`?

**Answer:** `graph.neighbors(node)` returns just the names of nodes reachable via an outgoing edge from `node`, with no information about the relationship itself. `graph.edges(node, data=True)` returns each outgoing edge as a `(source, target, attributes_dict)` tuple, including whatever attributes were passed to `add_edge` (such as a `relation` label) — which is what you need to build a human-readable "X relation Y" sentence rather than just a list of reachable node names.

---

### Q3. Why cap graph traversal at 1-2 hops instead of walking until there's nothing left to explore?

**Answer:** Real-world graphs tend to be densely connected, so each additional hop can reach a much larger fraction of the whole graph — at 3+ hops the "connected context" collected often approaches the entire knowledge base, which stops being a targeted answer and starts being an unfiltered dump of everything, burning context-window budget and potentially confusing the LLM the same way excessive vector-retrieved context does.

---

### Q4. When would you skip GraphRAG and just use plain vector retrieval?

**Answer:** When the query is a topic-lookup question rather than a relationship question — "what is our refund policy," "summarize the onboarding doc" — plain vector search already finds the relevant chunk directly, and running a graph traversal on top adds latency and complexity without improving the answer, since there's no meaningful relationship for the traversal to surface.

---

### Q5. How does GraphRAG's Stage 3 (combining graph and vector context) actually improve the final answer?

**Answer:** The graph-walk context supplies facts about how specific named entities connect to each other — information a single retrieved chunk typically can't express on its own. The vector-retrieved chunks supply the actual source text and nuance around those entities. Combined in the same prompt, the LLM can both follow the relationship chain the graph surfaced and ground its answer in the specific wording of the source documents, rather than having to do one without the other.

---

> 🧠 **Memory hook:** "Vector search checks the nearest dot. GraphRAG follows the trail of connected dots — and it's worth following only when the question is actually about the trail."
