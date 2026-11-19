import asyncio
from app.rag.hybrid_retriever import HybridRAGRetriever

async def main():
    retriever = HybridRAGRetriever()

    test_queries = [
        "How does virtual DOM reconciliation work in React?",
        "When should I use useMemo vs useCallback?",
        "How do React custom hooks share stateful logic?"
    ]

    for q in test_queries:
        print("\n" + "=" * 80)
        print(f"🔎 QUERY: '{q}'")
        print("=" * 80)

        results = await retriever.search(q, top_k=3)

        for i, item in enumerate(results, 1):
            meta = item.get("meta", {})
            doc_meta = meta.get("metadata", {})
            score = item.get("score", 0.0)
            rrf_score = meta.get("rrf_score", 0.0)

            print(f"\n[{i}] FlashRank Score: {score:.4f} | RRF Score: {rrf_score:.5f}")
            print(f"    Source: {doc_meta.get('document_title')} > {doc_meta.get('section_header')}")
            print(f"    Dense Rank: {meta.get('dense_rank')} | Sparse (BM25) Rank: {meta.get('sparse_rank')}")
            print("    Excerpt:")
            print("    " + item["text"][:250].replace("\n", " ") + "...")

    await retriever.close()

if __name__ == "__main__":
    asyncio.run(main())