# Project 5: Evaluated RAG Pipeline

## Goal

Take an existing RAG pipeline (reuse Project 1, 2, or 4) and add real, measured evaluation: RAGAS-style metrics and pipeline tracing, then use the measurements — not intuition — to decide how to tune chunk size and `k`.

## What You'll Build

An evaluation harness bolted onto an existing pipeline that scores a fixed test set of questions on faithfulness, answer relevance, context precision, and context recall, traces every stage of each query, and drives at least one measured iteration on chunk size or `k`.

## Phases Required

- Phase 10 — RAG Orchestration with LangChain
- Phase 11 — Evaluation & Observability

## Requirements

- Reuse an existing pipeline from an earlier project (ideally the LangChain one from Project 4) as the system under test.
- Build (or reuse from the phase lesson) a small set of at least 8-10 test questions with known expected answers, drawn from your own document set.
- Implement the four core RAGAS-style metrics: faithfulness, answer relevance, context precision, and context recall — a simplified LLM-as-judge implementation is acceptable, following the pattern from Phase 11.
- Implement a structured trace object per query that captures: the question, the retrieved chunks (with scores), the final assembled prompt, and the generated answer.
- Run the full test set once, record the baseline metric scores, then change exactly one variable (chunk size, `k`, or chunking strategy), re-run, and compare.
- Present the before/after comparison as a table, and state which change you'd keep and why, based on the measured metrics rather than a "looks right" judgment.

## Suggested Approach

1. Pick the pipeline from an earlier project you understand best, and write down its current chunk size/overlap and retrieval `k`.
2. Write 8-10 question/expected-answer pairs that specifically exercise different parts of your document set (some easy, some requiring multiple chunks, at least one edge case with no good answer available).
3. Implement the faithfulness check first (does the generated answer's claims trace back to the retrieved context?) using an LLM-as-judge prompt, following the grounded/ungrounded verdict pattern from Phase 11.
4. Implement answer relevance (does the answer actually address the question asked?), context precision (are the retrieved chunks actually relevant?), and context recall (did retrieval find everything needed?) using similar LLM-as-judge or simplified heuristic approaches.
5. Wrap every pipeline run in a trace-capturing function that records the question, retrieved chunk ids/scores, the assembled prompt sent to the LLM, and the final answer as one record per query.
6. Run all 8-10 test questions through the pipeline, score each with all four metrics, and compute average scores as your baseline.
7. Change one variable — e.g. increase chunk size, decrease `k`, or switch chunking strategy — re-run the same test set, and compute the new average scores.
8. Compare baseline vs. changed scores in a table and use the systematic debugging checklist from Phase 11 to explain *why* the scores moved the way they did, tying any regression back to a specific pipeline stage.

## Stretch Goals

- Add a lightweight dashboard or printed report that flags any individual test question scoring below a threshold on any metric, for fast triage.
- Run more than one variable change (e.g. chunk size AND `k`) as separate experiments and compare all three configurations (baseline + 2 changes) side by side.
- Wire in a real observability/tracing tool if you have access to one, instead of a hand-rolled trace object, and compare the experience.

## Evaluation Checklist

- [ ] All four RAGAS-style metrics produce a numeric or categorical score for every test question.
- [ ] Every query run produces a complete trace record (question, retrieved chunks, final prompt, answer).
- [ ] Baseline scores are recorded before any pipeline change is made.
- [ ] Exactly one variable changed between baseline and comparison runs (a controlled experiment, not multiple simultaneous changes).
- [ ] The before/after comparison table clearly shows which metrics improved, regressed, or stayed flat.
- [ ] You can state, with the trace data as evidence, which specific pipeline stage was responsible for any observed score change.
