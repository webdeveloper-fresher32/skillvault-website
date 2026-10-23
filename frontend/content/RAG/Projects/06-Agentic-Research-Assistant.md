# Project 6: Agentic Research Assistant

## Goal

Build an agent that no longer retrieves on every single question by default — it decides whether to retrieve, whether to use a different tool (e.g. a calculator), and whether it needs more than one retrieval pass to answer comparison-style, multi-hop questions.

## What You'll Build

A tool-using research assistant with at least two tools (a document retriever and a calculator, or another non-retrieval tool of your choice) that reasons about which tool to invoke, can run a multi-step retrieve-reason-retrieve loop for comparison questions, and terminates safely instead of looping forever.

## Phases Required

- Phase 12 — Agentic RAG

## Requirements

- Define a retrieval tool using a real LLM tool-use API shape (e.g. Anthropic's tool-use format), backed by a vector store from an earlier project.
- Define at least one non-retrieval tool (a calculator is the simplest choice) so the agent has a genuine choice to make, not just one tool it always calls.
- Demonstrate at least one question where the agent correctly chooses *not* to call the retrieval tool (e.g. a pure arithmetic question, or a question answerable from general knowledge/conversation).
- Demonstrate at least one question where the agent correctly calls the retrieval tool.
- Implement a multi-step iterative retrieval loop for at least one comparison-style question that requires retrieving evidence about two or more distinct things before it can be answered (e.g. "which of X and Y is faster/cheaper/newer?").
- The iterative loop must have a sound termination condition: both a max-iteration cap and a model-decided "I have enough information now" exit path.
- Log each step of the agent's decision loop (decide → act → observe → decide again) so the reasoning trace is inspectable, not just the final answer.

## Suggested Approach

1. Pick a document set (reuse one from an earlier project) that supports at least one genuine comparison question — e.g. two products, two approaches, two time periods described in different chunks.
2. Define the retrieval tool's schema (name, description, input parameters) in the tool-use API's expected shape, and wire it to your existing retriever function.
3. Define a second tool — a calculator is easiest to reason about and verify — with its own schema.
4. Write the agent loop: send the user's question plus both tool definitions to the LLM, check whether it requested a tool call, execute the requested tool if any, feed the result back to the model, and repeat until it produces a final answer (with a max-iteration safety cap).
5. Test with a pure-arithmetic question and confirm the model calls the calculator (or answers directly) without touching retrieval.
6. Test with a single-hop factual question and confirm the model calls the retriever exactly once and answers correctly.
7. Test with your comparison question and trace what happens: does the model retrieve evidence about the first thing, reason that it also needs the second, retrieve again, and then compare? Add explicit logging around each decide/act/observe step to confirm this multi-hop behavior.
8. Add the "I have enough information" exit condition: after each retrieval, ask the model (or check via a simple heuristic) whether it can now answer, versus needing another retrieval pass — and enforce the max-iteration cap regardless of what the model claims.

## Stretch Goals

- Add a third tool (e.g. a "current date" tool, or a simple web-search stub) purely to test whether the model correctly ignores irrelevant tools.
- Build a self-querying layer in front of the retriever, so the agent can pass structured metadata filters (not just a raw query string) when it calls the retrieval tool.
- Instrument the agent to report, at the end of a run, how many tool calls were made and of which type — a simple efficiency metric for comparing prompt strategies.

## Evaluation Checklist

- [ ] At least one test question causes the agent to skip retrieval entirely and answer directly (or via the calculator).
- [ ] At least one test question causes exactly one retrieval call and a correct grounded answer.
- [ ] The comparison-style question triggers two or more retrieval calls before the final answer.
- [ ] The agent terminates on its own for a well-posed question — it does not hit the max-iteration cap in normal operation.
- [ ] Artificially forcing an unanswerable or open-ended question still terminates via the max-iteration cap rather than looping indefinitely.
- [ ] The logged decision trace clearly shows the decide → act → observe → decide again cycle for at least one multi-step run.
