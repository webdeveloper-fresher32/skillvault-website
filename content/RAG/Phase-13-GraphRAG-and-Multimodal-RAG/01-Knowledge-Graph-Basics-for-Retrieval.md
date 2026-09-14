# 01 — Knowledge Graph Basics for Retrieval

> Why vector search struggles with relationship-style questions, and how to extract a simple knowledge graph from text using an LLM.

---

## Table of Contents

1. [The Problem: Similarity Isn't Relationship](#1-the-problem-similarity-isnt-relationship)
2. [The Analogy: Index Cards vs. a Family Tree](#2-the-analogy-index-cards-vs-a-family-tree)
3. [Entities and Relationships as Nodes and Edges](#3-entities-and-relationships-as-nodes-and-edges)
4. [Extracting a Knowledge Graph from Text with an LLM](#4-extracting-a-knowledge-graph-from-text-with-an-llm)
5. [Common Mistakes](#5-common-mistakes)
6. [Hands-On Exercises](#6-hands-on-exercises)
7. [Interview Q&A](#7-interview-qa)

---

## 1. The Problem: Similarity Isn't Relationship

Every retrieval technique in Phases 5 through 9 works the same way at its core: embed the query, embed the documents, find the documents whose vectors are closest to the query's vector. This is powerful for one very specific kind of question — "find me the passage that's *about the same thing* as this question." For most support tickets, product docs, and knowledge-base lookups, that's exactly what you need.

But consider a question like: *"Who reports to the person who manages the Sydney office?"*

There is no single chunk of text that is "about" this question in the way vector search understands "about." Answering it requires two separate facts, chained together: (1) *someone* manages the Sydney office, and (2) *someone else* reports to that person. Even if both facts exist somewhere in your document store — maybe in an org chart PDF and a separate HR wiki page — vector similarity has no mechanism for connecting them. It can retrieve a chunk that mentions "Sydney office manager" and a chunk that mentions "reports to," but it has no way to know that the *specific person* named in the first chunk is the *same specific person* referenced in the second. Similarity search finds topically related text; it does not follow a chain of facts from one entity to another.

This is a structural gap, not a tuning problem. No amount of better chunking (Phase 4) or better embeddings (Phase 2) fixes it, because the underlying representation — a chunk of text scored by how similar it is to the query — was never designed to represent *relationships between specific entities*. You need a different data structure for that: one built explicitly around entities and the connections between them.

---

## 2. The Analogy: Index Cards vs. a Family Tree

**Real-world analogy:** imagine two different ways of organizing information about a large extended family.

The first is a shoebox full of index cards, one per person, sorted by topic — cards about "people who live in Sydney," cards about "people who work in sales," cards about "people born in the 1980s." If you want to know who lives in Sydney, you flip to that pile and you're done in seconds. This is a **vector store**: everything is organized by *what it's about*, and finding things that are about the same topic is fast and easy.

The second is an actual family tree drawn on a wall — each person is a labeled box, and lines connect parents to children, spouses to each other, siblings to siblings. There's no "pile of Sydney people" here at all. But if someone asks "who is my grandmother's brother's daughter?", you don't need a pile for that question — you just trace the lines: grandmother → her brother → his daughter. This is a **knowledge graph**: everything is organized by *how it connects to everything else*, and answering multi-hop relationship questions is a matter of following edges, not searching piles.

Neither organization is strictly better — they're built for different questions. A shoebox of topic-sorted cards is useless for "trace this family lineage," and a family tree is a slow, clumsy way to find "everyone who lives in Sydney" (you'd have to walk every single box on the wall). RAG systems, similarly, reach for a knowledge graph specifically when the questions being asked are relationship-shaped, not topic-shaped.

> 🧠 Reach for this analogy whenever you need a one-line answer to "why not just use the vector store for everything?": *"A vector store is a shoebox of cards sorted by topic; a knowledge graph is a family tree — one finds what's similar, the other finds what's connected."*

---

## 3. Entities and Relationships as Nodes and Edges

A knowledge graph represents information as two things:

- **Entities** — the "things" being talked about: people, companies, products, offices, projects. These become **nodes** in the graph.
- **Relationships** — how two entities are connected: "manages," "reports to," "works at," "is located in." These become **edges** connecting nodes.

The atomic unit of a knowledge graph is the **triple**: `(entity, relation, entity)`. For example, the sentence *"Priya manages the Sydney office"* becomes the triple `("Priya", "manages", "Sydney office")`. A whole knowledge graph is just a large collection of these triples, layered on top of each other so that the same entity can appear in many triples — which is exactly what makes multi-hop traversal possible (Lesson 02 covers the traversal itself; this lesson is about building the graph in the first place).

In Python, the standard tool for representing and working with this kind of node-and-edge structure is `networkx`, a general-purpose graph library. A **directed graph** (`networkx.DiGraph`) is the right choice here, because relationships usually have a direction that matters — "Priya manages the Sydney office" is not the same statement as "the Sydney office manages Priya."

```python
import networkx as nx

# A directed graph: edges have a "from" and a "to."
graph = nx.DiGraph()

# add_edge(source, target, **attributes) creates both nodes automatically if
# they don't already exist, and stores any keyword arguments as edge data --
# here we use `relation` to label what kind of connection this edge represents.
graph.add_edge("Priya", "Sydney office", relation="manages")
graph.add_edge("Marcus", "Priya", relation="reports to")

print(graph.number_of_nodes())  # 3: Priya, Sydney office, Marcus
print(graph.number_of_edges())  # 2
```

Notice that `add_edge` is doing double duty: it creates the two nodes ("Priya", "Sydney office") the first time they're mentioned, and it creates the edge between them, tagged with a `relation` attribute so you know *what kind* of connection it is (as opposed to just *that* a connection exists). This is the entire mechanical foundation of a knowledge graph — everything else in this phase is built out of `add_edge` calls like this one, extracted automatically from text instead of typed by hand.

---

## 4. Extracting a Knowledge Graph from Text with an LLM

Building a knowledge graph by hand — reading every document and manually typing `add_edge` calls — doesn't scale past a toy example. In practice, you use an LLM to read a passage of text and extract the triples for you, the same way earlier phases used an LLM to generate answers from retrieved context.

The prompting pattern is straightforward: ask the model to read a passage and return a **JSON list of `[subject, relation, object]` triples**, then parse that JSON and load it into a graph. Asking for JSON specifically (rather than free-form prose) makes the output mechanically parseable — you don't want to be regex-matching sentences like "Priya manages the Sydney office" back out of a paragraph of the model's own commentary.

```python
import json
import networkx as nx
from anthropic import Anthropic

client = Anthropic()

paragraph = """
Priya Anand manages the Sydney office. Marcus Chen reports to Priya.
The Sydney office is part of the APAC division, which Sarah Lin leads.
"""

extraction_prompt = f"""Read the passage below and extract every factual
relationship as a (subject, relation, object) triple.

Rules:
- Return ONLY a JSON array of arrays, each inner array exactly
  [subject, relation, object].
- Use short, consistent entity names (e.g. "Priya Anand", not "she" or "Priya").
- Use a short lowercase verb phrase for relation (e.g. "manages", "reports to").
- Do not include any text outside the JSON array.

Passage:
{paragraph}
"""

response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1024,
    messages=[{"role": "user", "content": extraction_prompt}],
)

# response.content is a list of content blocks; a plain-text response has one
# "text" block, so response.content[0].text is the raw string the model wrote.
raw_output = response.content[0].text
triples = json.loads(raw_output)  # -> [["Priya Anand", "manages", "Sydney office"], ...]

graph = nx.DiGraph()
for subject, relation, obj in triples:  # tuple unpacking: each 3-item list becomes 3 named variables
    graph.add_edge(subject, obj, relation=relation)

print(list(graph.edges(data=True)))
# [('Priya Anand', 'Sydney office', {'relation': 'manages'}),
#  ('Marcus Chen', 'Priya Anand', {'relation': 'reports to'}),
#  ('Sydney office', 'APAC division', {'relation': 'is part of'}),
#  ('Sarah Lin', 'APAC division', {'relation': 'leads'})]
```

A few things worth calling out about this code. `json.loads(raw_output)` will raise a `json.JSONDecodeError` if the model's response contains anything other than the JSON array — in a production system you'd wrap this call in error handling and possibly retry the request, but for a first working version, assume well-behaved output and add robustness once you've seen how the model actually responds to your prompt. The `for subject, relation, obj in triples:` line is **tuple unpacking**: each element of `triples` is a 3-item list like `["Priya Anand", "manages", "Sydney office"]`, and Python assigns each of its three items to the three loop variables in one step, rather than you indexing `triple[0]`, `triple[1]`, `triple[2]` manually.

The result is a small, queryable graph built automatically from unstructured prose — the same kind of extraction, run across an entire document set, is what produces the knowledge graph that Lesson 02's retrieval patterns traverse at query time.

---

## 5. Common Mistakes

**Mistake 1: Building a knowledge graph for every RAG use case.** A knowledge graph is real, ongoing engineering work — an extraction pipeline to run and re-run as documents change, a graph store to maintain, and a whole additional retrieval path (Lesson 02) to build and test. It is worth that cost specifically when relationship-style questions ("who manages X's team," "which projects depend on Y") are a *common, expected* part of your workload. If your system mostly answers "what is our refund policy" style lookup questions, plain vector search (Phases 5-9) already handles them well, and adding a knowledge graph on top is unnecessary complexity that adds a maintenance burden without improving the answers users actually ask for.

**Mistake 2: Trusting extracted entity names to be consistent without normalization.** An LLM extracting triples from many different documents may write "Priya Anand," "Priya," and "P. Anand" as three different node names for the same person, silently fragmenting your graph into disconnected pieces that should have been one connected structure. Production extraction pipelines add an entity-resolution step — matching and merging variant names for the same real-world entity — before trusting the graph's connectivity.

**Interview angle:** A common interview question here is "when would you use a knowledge graph instead of a vector store?" — the answer the interviewer is listening for is not "knowledge graphs are more powerful" (they aren't, for most questions) but a precise statement of the *shape* of question each is built for: vector search for "find text similar to this," knowledge graphs for "find entities connected to this one, possibly several hops away." Naming the added engineering cost of building and maintaining an extraction pipeline, and being explicit that you'd only pay it when relationship questions are a real, recurring part of the workload, signals that you understand this as an engineering tradeoff rather than a strictly-better upgrade.

---

## 6. Hands-On Exercises

### Exercise 1 — Extract triples from your own paragraph

**Goal:** See the extraction prompt work on text you wrote yourself, not just the example above.

Write a short paragraph (4-6 sentences) describing a small fictional organization — people, teams, and who reports to or works with whom. Run it through the extraction prompt in Section 4, parse the JSON, and print the resulting triples. Check by hand: did the model miss any relationship that's clearly stated in your paragraph? Did it invent one that isn't there?

### Exercise 2 — Build the graph and inspect it

**Goal:** Get comfortable with the basic `networkx` API before Lesson 02 builds traversal on top of it.

Using the triples from Exercise 1, build a `nx.DiGraph()` and answer, using only `networkx` calls (not by re-reading your paragraph): How many nodes does the graph have? How many edges? Pick one person in your graph and list all of their outgoing edges using `graph.edges(person_name, data=True)`.

### Exercise 3 — Diagnose a graph-vs-vector mismatch

**Goal:** Practice recognizing when a question needs graph traversal and when it doesn't, since that judgment call is what Mistake 1 above is about.

For each of these three questions, decide whether a plain vector store or a knowledge graph is the better fit, and write one sentence explaining why: (a) "What is our policy on expense reports over $500?" (b) "Which of Sarah Lin's direct reports also worked on the APAC migration project?" (c) "Summarize the onboarding steps for new hires."

---

## 7. Interview Q&A

### Q1. What is a knowledge graph, in one sentence?

**Answer:** A knowledge graph represents information as entities (nodes) connected by labeled relationships (edges), typically built from a collection of `(entity, relation, entity)` triples, so that questions about how specific things are connected can be answered by following edges rather than by comparing text similarity.

---

### Q2. Why can't vector search answer relationship-style questions well?

**Answer:** Vector search finds chunks whose embeddings are semantically similar to the query's embedding — it's built to answer "what is this text about," not "how are these two specific entities connected." A question like "who reports to the person who manages the Sydney office" requires chaining two separate facts about specific entities together, and there's no single chunk of text whose *topic* is that chained fact, so similarity scoring has nothing to latch onto.

---

### Q3. What does `add_edge(a, b, relation="manages")` actually do in `networkx`?

**Answer:** It creates nodes `a` and `b` in the graph if they don't already exist, creates a directed edge from `a` to `b`, and stores `relation="manages"` as a data attribute on that edge, so you can later inspect what kind of relationship the edge represents (via `graph.edges(a, data=True)`, for example) rather than just knowing that some connection exists.

---

### Q4. Why ask the LLM for JSON output when extracting triples, instead of letting it write a free-text description?

**Answer:** JSON output is mechanically parseable with `json.loads()` — you get back exact, structured `[subject, relation, object]` triples you can load directly into `add_edge()` calls. Free-text output would require additional, fragile parsing (regex or another LLM call) to pull the same structured facts back out, adding failure points for no benefit.

---

### Q5. Should every RAG system build a knowledge graph?

**Answer:** No. A knowledge graph adds real ongoing engineering cost — an extraction pipeline, entity-name normalization, a graph store, and a separate traversal-based retrieval path. It's worth that cost when relationship-style, multi-hop questions ("who manages the team that owns X") are a common part of the workload. For systems that mostly answer topic-lookup questions, plain vector search already performs well and a knowledge graph is unnecessary complexity.

---

> 🧠 **Memory hook:** "A vector store is a shoebox of index cards sorted by topic; a knowledge graph is a family tree — one finds what's similar, the other finds what's connected."
