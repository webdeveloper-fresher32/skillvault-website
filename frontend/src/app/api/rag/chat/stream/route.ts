import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendAiUrl = (
      process.env.BACKEND_AI_URL ||
      process.env.NEXT_PUBLIC_AI_API_URL ||
      'http://127.0.0.1:8000'
    ).replace(/\/$/, '');

    const targetUrl = `${backendAiUrl}/api/v1/rag/chat/stream`;

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (networkError: any) {
      // Backend service is unreachable / not running
      const encoder = new TextEncoder();
      const customReadable = new ReadableStream({
        start(controller) {
          const errMsg = `⚠️ Unable to connect to SkillVault AI Service at ${backendAiUrl}.\n\n` +
            `• If running locally: please ensure the Python AI backend is running:\n` +
            `\`\`\`bash\ncd backend-ai && source venv/bin/activate && uvicorn app.main:app --port 8000 --reload\n\`\`\`\n` +
            `• If deployed in production: please configure BACKEND_AI_URL in your Vercel project environment variables pointing to your deployed AI service (Render / Fly.io / Vercel).`;
          
          controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ token: errMsg })}\n\n`));
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
        }
      });

      return new Response(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const errText = await upstreamResponse.text().catch(() => '');
      return NextResponse.json(
        { error: `Upstream AI backend returned status ${upstreamResponse.status}`, detail: errText },
        { status: upstreamResponse.status }
      );
    }

    // Pipe upstream SSE stream directly to browser
    return new Response(upstreamResponse.body as any, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal Server Error while streaming RAG response', detail: err.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
