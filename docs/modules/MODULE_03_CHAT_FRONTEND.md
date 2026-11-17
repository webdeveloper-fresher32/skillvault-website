# Module 3: Next.js 16 Chat UI, Streaming Consumer & Context Detection

| Specification | Details |
| :--- | :--- |
| **Module Number** | 03 of 12 |
| **Topic** | React 19 Client Components, Custom SSE Stream Parser, Page Context Detector & UI Design System |
| **Target System** | Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons |
| **Engineering Level** | Staff Frontend & Design Systems Engineer |

---

## 1. Architectural Overview & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS 16 APPLICATION LAYOUT                             │
│                                                                                        │
│   ┌────────────────────────────────────────┐  ┌────────────────────────────────────┐   │
│   │ Floating Assistant Toggle Button       │  │ Dedicated Route (/assistant)       │   │
│   │ (Global trigger across all app pages)  │  │ (Full-screen power-user interface) │   │
│   └───────────────────┬────────────────────┘  └─────────────────┬──────────────────┘   │
│                       │                                         │                      │
│                       ▼                                         ▼                      │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ <TaskFlowChatProvider> (Context & Session Store)                                │   │
│   │                                                                                │   │
│   │  ├── activeConversationId: string                                              │   │
│   │  ├── pageContext: { currentUrl, entityType, entityId }                         │   │
│   │  ├── messages: Message[]                                                       │   │
│   │  ├── isGenerating: boolean                                                     │   │
│   │  └── abortController: AbortController                                          │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │                                            │
│                                           ▼                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ <MessageList> (Virtualized Scroll View)                                        │   │
│   │  ├── <UserMessageBubble />                                                     │   │
│   │  └── <AssistantMessageBubble>                                                  │   │
│   │        ├── <ThoughtAccordion /> (Visualized Reasoning Chain)                   │   │
│   │        ├── <MarkdownRenderer /> (Syntax Highlighting & Copy Code)              │   │
│   │        ├── <CitationTray /> (Clickable Document Reference Pills)               │   │
│   │        └── <ToolActionCard /> (Interactive HITL Confirmation Buttons)          │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ADR: Frontend Stream Consumption Protocol

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               STREAM CONSUMING CLIENT TECHNOLOGIES                                │
├──────────────────────────┬─────────────────────────────┬──────────────────────────────────────────┤
│ Technology               │ Mechanism                   │ Status in TaskFlow AI                    │
├──────────────────────────┼─────────────────────────────┼──────────────────────────────────────────┤
│ 1. `fetch` + ReadableStrm│ HTTP POST Chunked Reader    │ 🏆 SELECTED (Full header & body support) │
│ 2. Native `EventSource`  │ Browser Native API (GET)    │ ❌ REJECTED (Cannot send headers / POST) │
│ 3. WebSocket Client      │ RFC 6455 Socket Channel     │ ❌ REJECTED (Unnecessary duplex overhead)│
│ 4. Vercel AI SDK Client  │ Third-party React Hook      │ ❌ REJECTED (Vendor lock-in on protocols)│
└──────────────────────────┴─────────────────────────────┴──────────────────────────────────────────┘
```

### **🏆 1. `fetch` with `ReadableStream` & `TextDecoderStream` — SELECTED**
* **Why Selected:**
  1. **HTTP POST Body Support:** The browser native `EventSource` API *only* supports HTTP `GET`. Chat prompts, conversation history, and active page context cannot fit in URL query strings without exceeding HTTP URL length limits ($2,048$ chars). `fetch` allows sending arbitrary JSON payloads in an HTTP `POST` body.
  2. **Custom Authorization Headers:** Native `EventSource` does not support custom HTTP headers (such as `Authorization: Bearer <JWT>`), requiring authentication tokens to be leaked into URL query parameters or cookie workarounds. `fetch` supports standard headers natively.
  3. **Zero-Dependency Native Platform API:** Works across modern browsers without bloated external libraries.

---

## 3. Concrete Code Implementation

### 3.1 Custom SSE Streaming Hook (`src/hooks/useTaskFlowChat.ts`)
```typescript
'use client';

import { useState, useRef, useCallback } from 'react';

export interface Citation {
  documentId: string;
  title: string;
  chunkId: string;
  url?: string;
}

export interface ToolCallState {
  toolName: string;
  parameters: Record<string, any>;
  status: 'PENDING_APPROVAL' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  result?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thought?: string;
  citations?: Citation[];
  toolCall?: ToolCallState;
  isStreaming?: boolean;
}

export function useTaskFlowChat(conversationId: string, initialMessages: ChatMessage[] = []) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }, []);

  const sendMessage = useCallback(async (userText: string, pageContext?: Record<string, any>) => {
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
      thought: '',
      citations: [],
      isStreaming: true,
    };

    setMessages((prev) => [...prev, newUserMsg, initialAsstMsg]);
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = localStorage.getItem('taskflow_token');
      const response = await fetch('/api/v1/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: userText,
          page_context: pageContext,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep partial line

        for (const block of lines) {
          if (!block.trim()) continue;
          const [eventLine, dataLine] = block.split('\n');
          const eventType = eventLine.replace('event: ', '').trim();
          const eventData = JSON.parse(dataLine.replace('data: ', '').trim());

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg;

              switch (eventType) {
                case 'thought':
                  return { ...msg, thought: (msg.thought || '') + eventData.step + '\n' };
                case 'chunk':
                  return { ...msg, content: msg.content + eventData.delta };
                case 'citation':
                  return { ...msg, citations: [...(msg.citations || []), ...eventData.citations] };
                case 'confirmation_required':
                  return {
                    ...msg,
                    toolCall: {
                      toolName: eventData.action,
                      parameters: eventData.params,
                      status: 'PENDING_APPROVAL',
                    },
                  };
                case 'done':
                  return { ...msg, isStreaming: false };
                default:
                  return msg;
              }
            })
          );
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream generation aborted by user.');
      } else {
        console.error('Streaming failure:', err);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [conversationId, isGenerating]);

  return {
    messages,
    sendMessage,
    isGenerating,
    stopGeneration,
  };
}
```

### 3.2 Active Route Context Detector (`src/components/chat/ActiveContextBadge.tsx`)
```tsx
'use client';

import { usePathname } from 'next/navigation';
import { BookOpen, CheckSquare, Layers } from 'lucide-react';

export function ActiveContextBadge() {
  const pathname = usePathname();

  // Parse path to automatically prime assistant context
  let contextName = 'TaskFlow Global Workspace';
  let Icon = Layers;

  if (pathname.startsWith('/courses/')) {
    const parts = pathname.split('/');
    const course = parts[2] || 'Engineering';
    const lesson = parts[4] || parts[3] || 'Overview';
    contextName = `Course: ${course} > ${lesson}`;
    Icon = BookOpen;
  } else if (pathname.startsWith('/projects/')) {
    contextName = `Project Context: ${pathname.split('/')[2]}`;
    Icon = CheckSquare;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
      <Icon className="w-3.5 h-3.5 text-blue-400" />
      <span className="font-medium truncate max-w-[280px]">{contextName}</span>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-auto" />
    </div>
  );
}
```

---

## 4. Production Frontend Verification Checklist

| Edge Case | UI Behavior Requirement |
| :--- | :--- |
| **Rapid User Clicks on "Stop"** | `AbortController.abort()` immediately cancels fetch stream; cursor freezes; "Stop" button reverts to "Send". |
| **Code Block Overflow** | Code blocks render with horizontal scroll (`overflow-x-auto`), rounded border, and copy button. |
| **Action Confirmation Rejection** | User clicks "Cancel" on tool modal; emits user cancellation; tool state changes to `FAILED: REJECTED_BY_USER`. |
