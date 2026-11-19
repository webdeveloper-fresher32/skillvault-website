'use client';

import { useState, useRef, useCallback } from 'react';

export interface Citation {
  citation_index: number;
  chunk_id: string;
  document_title: string;
  section_header: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000';

export function useAIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isGenerating) return;

    const userMessageId = `user_${Date.now()}`;
    const assistantMessageId = `asst_${Date.now()}`;

    const newUserMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: userText,
    };

    const initialAsstMsg: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      citations: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, newUserMsg, initialAsstMsg]);
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${AI_API_URL}/api/v1/rag/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText,
          top_k: 4,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`AI Service returned ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          if (!block.trim()) continue;
          const lines = block.split('\n');
          let eventType = '';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.replace('data: ', '').trim();
            }
          }

          if (!eventType || !dataStr) continue;

          try {
            const parsedData = JSON.parse(dataStr);

            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantMessageId) return msg;

                if (eventType === 'citations') {
                  return {
                    ...msg,
                    citations: parsedData,
                  };
                } else if (eventType === 'token') {
                  return {
                    ...msg,
                    content: msg.content + (parsedData.token || ''),
                  };
                } else if (eventType === 'done') {
                  return {
                    ...msg,
                    isStreaming: false,
                  };
                }
                return msg;
              })
            );
          } catch {
            // Ignore malformed chunks
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Generation cancelled by user.');
      } else {
        console.error('SSE Stream Error:', err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    msg.content +
                    '\n\n*(Error connecting to AI service. Ensure `backend-ai` is running on port 8000)*',
                  isStreaming: false,
                }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [isGenerating]);

  return {
    messages,
    sendMessage,
    isGenerating,
    stopGeneration,
  };
}
