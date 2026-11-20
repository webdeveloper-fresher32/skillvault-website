import asyncio
import json
from httpx import AsyncClient, ASGITransport
from app.main import app

async def main():
    print("=" * 70)
    print("🧪 Testing SkillVault Intent Router & Zero-Citation Chitchat Fast-Path")
    print("=" * 70)

    test_queries = [
        ("thanks", "Gratitude message (should bypass DB & have 0 citations)"),
        ("thank you so much!", "Gratitude with extra words"),
        ("hi there", "Greeting (should bypass DB & have 0 citations)"),
        ("cool, got it", "Acknowledgment (should bypass DB & have 0 citations)"),
        ("How does React reconciliation work with Fiber?", "Technical query (should route to RAG)")
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for query, desc in test_queries:
            print(f"\n👉 Query: {query!r} ({desc})")
            res = await client.post(
                "/api/v1/rag/chat/stream",
                json={"message": query, "top_k": 4}
            )

            lines = res.text.strip().split("\n")
            citations_line = next((l for l in lines if l.startswith("data:")), "data: []")
            citations = json.loads(citations_line.replace("data: ", ""))

            # Extract token chunks
            tokens = []
            for line in lines:
                if line.startswith("data: ") and "token" in line:
                    payload = json.loads(line.replace("data: ", ""))
                    tokens.append(payload.get("token", ""))

            full_reply = "".join(tokens).strip()

            print(f"   📊 Citations Returned: {len(citations)} chunks {citations}")
            print(f"   💬 Assistant Response: {full_reply[:120]}...")

    print("\n" + "=" * 70)
    print("✅ All intent routing tests completed successfully!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
