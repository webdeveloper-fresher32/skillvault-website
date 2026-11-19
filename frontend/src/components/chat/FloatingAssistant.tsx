'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAIAssistant, Citation } from '@/lib/useAIAssistant';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import {
  Sparkles,
  X,
  Send,
  Square,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Maximize2,
  Minimize2,
  Copy,
  Check,
} from 'lucide-react';

function CodeBlockContainer({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  let language = 'code';
  let rawCode = '';

  const extractInfo = (node: any) => {
    if (!node) return;
    if (typeof node === 'string' || typeof node === 'number') {
      rawCode += node;
    } else if (Array.isArray(node)) {
      node.forEach(extractInfo);
    } else if (React.isValidElement(node)) {
      const cls = (node.props as any)?.className || '';
      const match = cls.match(/language-(\w+)/);
      if (match) {
        language = match[1];
      }
      extractInfo((node.props as any)?.children);
    }
  };

  extractInfo(children);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLanguageLabel = (lang: string) => {
    const map: Record<string, string> = {
      js: 'JavaScript',
      javascript: 'JavaScript',
      ts: 'TypeScript',
      typescript: 'TypeScript',
      jsx: 'React (JSX)',
      tsx: 'React (TSX)',
      py: 'Python',
      python: 'Python',
      sql: 'SQL',
      html: 'HTML',
      css: 'CSS',
      json: 'JSON',
      bash: 'Bash',
      sh: 'Shell',
    };
    return map[lang.toLowerCase()] || (lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : 'Code');
  };

  return (
    <div className="relative group my-3.5 rounded-2xl border border-slate-700/60 bg-[#121622] shadow-xl overflow-hidden">
      {/* Code Header Bar matching SkillVault course styling */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#181e2e] border-b border-slate-800/80 text-xs select-none">
        <div className="flex items-center gap-2 font-mono text-[12px]">
          <span className="text-sky-400 font-bold">&lt;/&gt;</span>
          <span className="font-semibold text-slate-200">{getLanguageLabel(language)}</span>
        </div>
        <button
          onClick={handleCopy}
          type="button"
          aria-label="Copy code"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-all text-[11px] cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Viewport with horizontal scrolling */}
      <pre className="p-4 overflow-x-auto text-[13px] sm:text-sm font-mono leading-relaxed text-[#e6edf3] !bg-transparent !m-0 selection:bg-sky-500/30">
        {children}
      </pre>
    </div>
  );
}

export default function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [input, setInput] = useState('');
  const [showCitations, setShowCitations] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  const { messages, sendMessage, isGenerating, stopGeneration } = useAIAssistant();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    sendMessage(input);
    setInput('');
  };

  const toggleCitations = (msgId: string) => {
    setShowCitations((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const getContextName = () => {
    if (pathname.includes('/courses/react') || pathname.includes('/React')) {
      return 'React Deep-Dive Course';
    } else if (pathname.includes('/courses/')) {
      const parts = pathname.split('/');
      return `Course: ${parts[2] || 'Engineering'}`;
    }
    return 'SkillVault Knowledge Base';
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-xl shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 cursor-pointer"
        >
          <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
          <span className="font-semibold text-sm">Ask SkillVault AI</span>
        </button>
      )}

      {/* Responsive Chat Window (Floating or Fullscreen) */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-[#0c101c]/95 border border-slate-800 shadow-2xl shadow-black/90 backdrop-blur-2xl transition-all duration-300 ${
            isFullscreen
              ? 'inset-2 sm:inset-4 md:inset-6 rounded-2xl'
              : 'bottom-4 sm:bottom-6 right-2 sm:right-6 w-[calc(100vw-1rem)] sm:w-[500px] md:w-[560px] h-[calc(100vh-2rem)] sm:h-[680px] max-h-[820px] rounded-2xl'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800/90 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">SkillVault Assistant</h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Cpu className="w-2.5 h-2.5" /> Local RAG
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <Layers className="w-3 h-3 text-sky-400" />
                  <span>{getContextName()}</span>
                </p>
              </div>
            </div>

            {/* Header Actions: Maximize/Minimize & Close */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                title={isFullscreen ? 'Restore small window' : 'Full-screen mode'}
                type="button"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close chat"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-sm">
            <div className={`space-y-5 ${isFullscreen ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
              {messages.length === 0 && (
                <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-3">
                    <BookOpen className="w-6 h-6 text-sky-400" />
                  </div>
                  <p className="font-semibold text-slate-200 text-sm">Grounded Technical Assistant</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[340px]">
                    Responses are verified against your local course documentation with AST-aware chunking and FlashRank cross-encoder reranking.
                  </p>
                  <div className="mt-5 grid grid-cols-1 gap-2 w-full max-w-md text-xs">
                    <button
                      onClick={() => sendMessage('How does React reconciliation work with Fiber?')}
                      className="p-3 text-left rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800/80 text-slate-300 transition-colors cursor-pointer flex items-center justify-between group"
                    >
                      <span>💡 How does React reconciliation work with Fiber?</span>
                      <span className="text-slate-500 group-hover:text-sky-400 transition-colors">→</span>
                    </button>
                    <button
                      onClick={() => sendMessage('When should I use useMemo vs useCallback? Give sample code.')}
                      className="p-3 text-left rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800/80 text-slate-300 transition-colors cursor-pointer flex items-center justify-between group"
                    >
                      <span>⚡ When should I use useMemo vs useCallback? (with code)</span>
                      <span className="text-slate-500 group-hover:text-sky-400 transition-colors">→</span>
                    </button>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {/* User Bubble */}
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl bg-sky-600 text-white text-sm shadow-md rounded-tr-sm">
                      {msg.content}
                    </div>
                  ) : (
                    /* Assistant Bubble */
                    <div className="max-w-full w-full bg-slate-900/80 border border-slate-800/80 rounded-2xl rounded-tl-sm p-4 text-slate-200 shadow-sm">
                      {/* Citations Pill Bar */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mb-3.5">
                          <button
                            onClick={() => toggleCitations(msg.id)}
                            className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium bg-sky-950/40 border border-sky-800/40 px-3 py-1 rounded-full transition-colors cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{msg.citations.length} Verified Sources</span>
                            {showCitations[msg.id] ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Collapsible Citation Cards */}
                          {showCitations[msg.id] && (
                            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1 border-l-2 border-sky-500/30">
                              {msg.citations.map((c: Citation) => (
                                <div
                                  key={c.chunk_id}
                                  className="text-[11px] bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 flex flex-col justify-between"
                                >
                                  <div>
                                    <span className="font-semibold text-slate-200 block truncate">
                                      [{c.citation_index}] {c.document_title}
                                    </span>
                                    <span className="text-slate-400 block truncate mt-0.5">
                                      {c.section_header}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-emerald-400 mt-1 font-mono">
                                    Relevance: {(c.score * 100).toFixed(1)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Markdown Body with Custom Code Blocks */}
                      <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight, rehypeSlug]}
                          components={{
                            pre({ children, ...props }: any) {
                              return <CodeBlockContainer {...props}>{children}</CodeBlockContainer>;
                            },
                            code({ node, inline, className, children, ...props }: any) {
                              const isInline = !className && typeof children === 'string' && !children.includes('\n');
                              if (isInline) {
                                return (
                                  <code
                                    className="px-1.5 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 font-mono text-sky-300 text-[12px]"
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              }
                              return (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {msg.content || (msg.isStreaming ? 'Thinking and retrieving verified context...' : '')}
                        </ReactMarkdown>
                      </div>

                      {msg.isStreaming && (
                        <span className="inline-block w-2 h-3.5 bg-sky-400 animate-pulse ml-1 align-middle" />
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Bar */}
          <div className="p-3.5 bg-slate-900/90 border-t border-slate-800">
            <form
              onSubmit={handleSubmit}
              className={`flex items-center gap-2 ${isFullscreen ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about React, hooks, state, or architecture..."
                disabled={isGenerating}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:border-sky-500/50 transition-colors disabled:opacity-50"
              />
              {isGenerating ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="p-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                  title="Stop generation"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 disabled:hover:bg-sky-600 transition-colors cursor-pointer shadow-md shadow-sky-600/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
