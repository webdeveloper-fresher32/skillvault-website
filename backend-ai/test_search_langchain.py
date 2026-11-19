import asyncio
from app.rag_langchain.hybrid_retriever import HybridRAGRetriever

async def main():
    print("=" * 80)
    print("🧪 Testing LangChain Hybrid RAG Retriever (BaseRetriever + pgvector + FlashRank)")
    print("=" * 80)

    retriever = HybridRAGRetriever(top_k=3)

    test_queries = [
        "How does virtual DOM reconciliation work in React?",
        "When should I use useMemo vs useCallback?",
        "How do React custom hooks share stateful logic?"
    ]

    for q in test_queries:
        print("\n" + "-" * 80)
        print(f"🔎 QUERY: '{q}'")
        print("-" * 80)

        # Standard LangChain invocation returning List[Document]
        docs = await retriever.ainvoke(q)

        for i, doc in enumerate(docs, 1):
            meta = doc.metadata
            print(f"\n[{i}] FlashRank Score: {meta.get('score', 0.0):.4f} | RRF Score: {meta.get('rrf_score', 0.0):.5f}")
            print(f"    Source: {meta.get('document_title')} > {meta.get('section_header')}")
            print(f"    Dense Rank: {meta.get('dense_rank')} | Sparse (BM25) Rank: {meta.get('sparse_rank')}")
            print("    Excerpt:")
            print("    " + doc.page_content[:250].replace("\n", " ") + "...")

    await retriever.close()

if __name__ == "__main__":
    asyncio.run(main())
