'use client';

import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import { Copy, Check } from 'lucide-react';
import { parseLessonContent, isAsciiDiagram } from '@/lib/interactiveParser';
import CodeToggle from './interactive/CodeToggle';
import FlipCardDeck from './interactive/FlipCardDeck';
import ExerciseChecklist from './interactive/ExerciseChecklist';
import DiagramCard from './interactive/DiagramCard';

interface MarkdownViewerProps {
  content: string;
  courseSlug?: string;
  lessonSlug?: string;
}

export default function MarkdownViewer({
  content,
  courseSlug = 'course',
  lessonSlug = 'lesson',
}: MarkdownViewerProps) {
  // Parse markdown into interactive sections and cleaned text
  const parsed = useMemo(() => {
    return parseLessonContent(content || '');
  }, [content]);

  // Storage key for checkable exercises
  const exerciseStorageKey = `exercises_${courseSlug}_${lessonSlug}`;

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{
          // Custom pre / code block handler
          pre({ children, ...props }: any) {
            let rawCode = '';
            const extractText = (node: any) => {
              if (!node) return;
              if (typeof node === 'string' || typeof node === 'number') {
                rawCode += node;
              } else if (Array.isArray(node)) {
                node.forEach(extractText);
              } else if (React.isValidElement(node)) {
                extractText((node.props as any)?.children);
              }
            };
            extractText(children);

            // If this code block is an ASCII flowchart or architecture diagram, render DiagramCard
            if (isAsciiDiagram(rawCode)) {
              return <DiagramCard diagramText={rawCode} />;
            }

            return (
              <CodeBlockContainer {...props}>
                {children}
              </CodeBlockContainer>
            );
          },

          // Custom paragraph handler to mount Bad-vs-Good code toggles
          p({ children, ...props }: any) {
            let textContent = '';
            if (typeof children === 'string') {
              textContent = children;
            } else if (Array.isArray(children) && typeof children[0] === 'string') {
              textContent = children.join('');
            }

            if (textContent.includes('__CODE_TOGGLE_PLACEHOLDER__')) {
              if (parsed.codeToggles.length > 0) {
                return (
                  <div className="my-6">
                    {parsed.codeToggles.map((toggle, idx) => (
                      <CodeToggle key={idx} {...toggle} />
                    ))}
                  </div>
                );
              }
              return null;
            }

            return <p {...props}>{children}</p>;
          },

          // Custom table wrapper for responsive scroll and sticky header
          table({ children, ...props }: any) {
            return (
              <div className="my-6 overflow-x-auto rounded-xl border border-[#30363d] bg-[#101726] shadow-md">
                <table className="w-full text-left text-sm border-collapse" {...props}>
                  {children}
                </table>
              </div>
            );
          },

          th({ children, ...props }: any) {
            return (
              <th
                className="bg-[#182238] px-4 py-3 text-slate-100 font-bold border-b border-[#30363d] text-xs uppercase tracking-wider"
                {...props}
              >
                {children}
              </th>
            );
          },

          td({ children, ...props }: any) {
            return (
              <td className="px-4 py-3 border-b border-[#30363d]/60 text-slate-300 text-xs sm:text-sm" {...props}>
                {children}
              </td>
            );
          },

          // Custom blockquote styling
          blockquote({ children, ...props }: any) {
            return (
              <blockquote
                className="border-l-4 border-indigo-500 bg-indigo-500/10 px-4 py-3 rounded-r-lg my-4 text-slate-200 italic"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
        }}
      >
        {parsed.mainMarkdown}
      </ReactMarkdown>

      {/* RENDER INTERACTIVE HANDS-ON EXERCISES IF EXTRACTED */}
      {parsed.exercises.length > 0 && (
        <ExerciseChecklist
          storageKey={exerciseStorageKey}
          items={parsed.exercises}
        />
      )}

      {/* RENDER INTERACTIVE 3D FLIPCARDS IF Q&A EXTRACTED */}
      {parsed.qaItems.length > 0 && (
        <FlipCardDeck items={parsed.qaItems} />
      )}
    </div>
  );
}

function CodeBlockContainer({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    let textToCopy = '';
    const extractText = (node: any) => {
      if (!node) return;
      if (typeof node === 'string' || typeof node === 'number') {
        textToCopy += node;
      } else if (Array.isArray(node)) {
        node.forEach(extractText);
      } else if (React.isValidElement(node)) {
        extractText((node.props as any)?.children);
      }
    };
    extractText(children);

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl border border-[#30363d] bg-[#101726] shadow-md overflow-hidden">
      {/* Copy button in top right corner */}
      <div className="absolute top-2.5 right-2.5 z-10 opacity-75 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 rounded-md border border-[#30363d] bg-[#182238] px-2.5 py-1 text-xs text-slate-300 hover:border-slate-400 hover:bg-[#21262d] transition-all shadow-sm"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400 font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Viewport */}
      <pre className="p-4 overflow-x-auto text-[13px] sm:text-sm font-mono leading-relaxed text-[#e6edf3] !bg-[#070a12] !border-0 !m-0">
        {children}
      </pre>
    </div>
  );
}
