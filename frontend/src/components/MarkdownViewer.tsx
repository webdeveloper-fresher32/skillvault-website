'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import { Copy, Check } from 'lucide-react';
import { parseLessonContent, isAsciiDiagram } from '@/lib/interactiveParser';
import CodeToggle from './interactive/CodeToggle';
import FlipCardDeck from './interactive/FlipCardDeck';
import ExerciseChecklist from './interactive/ExerciseChecklist';
import DiagramCard, { parsePipelineSteps } from './interactive/DiagramCard';

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
          // Custom link handler to navigate internal .md links within SkillVault!
          a({ href, children, ...props }: any) {
            if (!href) return <a {...props}>{children}</a>;
            
            // External links
            if (href.startsWith('http://') || href.startsWith('https://')) {
              return (
                <a 
                  href={href} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors" 
                  {...props}
                >
                  {children}
                </a>
              );
            }
            
            // Relative markdown links
            if (href.endsWith('.md') || href.includes('.md')) {
              const cleanHref = href.split('#')[0].split('?')[0];
              const parts = cleanHref.split('/');
              const filePart = parts[parts.length - 1];
              
              if (filePart.toLowerCase() === 'readme.md') {
                return (
                  <Link 
                    href={`/courses/${courseSlug}`} 
                    className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2 transition-colors"
                  >
                    {children}
                  </Link>
                );
              }
              
              const targetLessonSlug = filePart.replace(/\.md$/i, '').toLowerCase();
              return (
                <Link 
                  href={`/courses/${courseSlug}/${targetLessonSlug}`} 
                  className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2 transition-colors"
                >
                  {children}
                </Link>
              );
            }
            
            return (
              <a 
                href={href} 
                className="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors" 
                {...props}
              >
                {children}
              </a>
            );
          },

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

            // If this code block is an ASCII flowchart, pipeline steps, or architecture diagram, render DiagramCard
            if (isAsciiDiagram(rawCode) || parsePipelineSteps(rawCode) !== null) {
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
            const extractText = (node: any) => {
              let text = '';
              const extract = (n: any) => {
                if (!n) return;
                if (typeof n === 'string' || typeof n === 'number') {
                  text += n;
                } else if (Array.isArray(n)) {
                  n.forEach(extract);
                } else if (React.isValidElement(n)) {
                  extract((n.props as any)?.children);
                }
              };
              extract(node);
              return text;
            };
            const textContent = extractText(children);

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

            if (textContent.includes('EXERCISES_PLACEHOLDER')) {
              if (parsed.exercises.length > 0) {
                return (
                  <ExerciseChecklist
                    storageKey={exerciseStorageKey}
                    title={parsed.exerciseTitle || 'Hands-On Exercises'}
                    items={parsed.exercises}
                  />
                );
              }
              return null;
            }

            return <p {...props}>{children}</p>;
          },

          h2({ children, ...props }: any) {
            const extractText = (node: any) => {
              let text = '';
              const extract = (n: any) => {
                if (!n) return;
                if (typeof n === 'string' || typeof n === 'number') {
                  text += n;
                } else if (Array.isArray(n)) {
                  n.forEach(extract);
                } else if (React.isValidElement(n)) {
                  extract((n.props as any)?.children);
                }
              };
              extract(node);
              return text;
            };
            const textContent = extractText(children);
            
            if (/(Hands-On.*Exercises?|Interview-Style.*Exercise|Practice.*Exercise)/i.test(textContent) && parsed.exercises.length === 0) {
              return null;
            }
            
            return <h2 {...props}>{children}</h2>;
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

          // Custom image renderer with modern dark card styling
          img({ src, alt, ...props }: any) {
            if (!src) return null;
            return (
              <span className="my-8 flex flex-col items-center">
                <span className="relative group overflow-hidden rounded-xl border border-slate-700/60 bg-[#0a0e17] p-2 shadow-2xl transition-all duration-300 hover:border-sky-500/50 block">
                  <img
                    src={src}
                    alt={alt || 'Technical Architecture Diagram'}
                    className="max-h-[580px] w-auto rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.01]"
                    loading="lazy"
                    {...props}
                  />
                </span>
                {alt && (
                  <span className="mt-3 text-center text-xs font-mono text-sky-400/80 block">
                    ▲ {alt}
                  </span>
                )}
              </span>
            );
          },
        }}
      >
        {parsed.mainMarkdown}
      </ReactMarkdown>

      {/* RENDER INTERACTIVE HANDS-ON EXERCISES IF EXTRACTED BUT NOT IN-PLACE */}
      {parsed.exercises.length > 0 && !parsed.mainMarkdown.includes('__EXERCISES_PLACEHOLDER__') && (
        <ExerciseChecklist
          storageKey={exerciseStorageKey}
          title={parsed.exerciseTitle || 'Hands-On Exercises'}
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
