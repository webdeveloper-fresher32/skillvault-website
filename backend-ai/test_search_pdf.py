import asyncio
from app.rag_langchain.hybrid_retriever import HybridRAGRetriever

async def test_pdf_retrieval():
    print("=" * 80)
    print("🔍 Testing PDF Retrieval Pipeline (LangChain Hybrid Retriever + FlashRank)")
    print("=" * 80)

    retriever = HybridRAGRetriever(top_k=3)

    test_queries = [
        "How does Multi-Tenant RAG work in SkillVault AI Assistant?",
        "Explain the SSE streaming protocol in SkillVault AI Assistant.",
        "How does AuthenticationManager work in Spring Security?",
        "How do Angular 19 signals improve reactivity?"
    ]

    for q in test_queries:
        print("\n" + "-" * 80)
        print(f"🔎 QUERY: '{q}'")
        print("-" * 80)

        docs = await retriever.ainvoke(q)

        if not docs:
            print("   ⚠️ No matching passages retrieved.")
            continue

        for i, doc in enumerate(docs, 1):
            meta = doc.metadata
            print(f"\n[{i}] FlashRank Score: {meta.get('score', 0.0):.4f} | RRF Score: {meta.get('rrf_score', 0.0):.5f}")
            print(f"    Document: {meta.get('document_title')} > {meta.get('section_header')}")
            print(f"    Page: {meta.get('metadata', {}).get('page', 'N/A')} | File Type: {meta.get('metadata', {}).get('file_type', 'markdown')}")
            print(f"    Dense Rank: {meta.get('dense_rank')} | Sparse Rank: {meta.get('sparse_rank')}")
            print("    Excerpt:")
            print("    " + doc.page_content[:250].replace("\n", " ") + "...")

    await retriever.close()

if __name__ == "__main__":
    asyncio.run(test_pdf_retrieval())
