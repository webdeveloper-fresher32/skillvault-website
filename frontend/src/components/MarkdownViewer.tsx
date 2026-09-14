'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import { Copy, Check } from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{
          pre({ children, ...props }: any) {
            return (
              <CodeBlockContainer {...props}>
                {children}
              </CodeBlockContainer>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
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
    <div className="relative group my-4 rounded-md border border-[#30363d] bg-[#161b22]">
      {/* GitHub-style Copy button in the top right corner */}
      <div className="absolute top-2 right-2 z-10 opacity-70 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 rounded-md border border-[#30363d] bg-[#21262d] px-2 py-1 text-xs text-slate-300 hover:border-[#8b949e] hover:bg-[#30363d] transition-all shadow-sm"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-sans">Copied!</span>
            </>
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>
      </div>

      {/* GitHub-style pre code viewport */}
      <pre className="p-4 overflow-x-auto text-[13px] sm:text-sm font-mono leading-[1.45] text-[#e6edf3] !bg-transparent !border-0 !m-0">
        {children}
      </pre>
    </div>
  );
}
