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
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        const props = child.props as any;
        if (props?.children) {
          textToCopy = String(props.children);
        }
      }
    });

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl border border-slate-800 bg-[#0b1120] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 inline-block" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
          <span className="ml-2 font-mono text-[11px] text-slate-400">code snippet</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors bg-slate-800/60 px-2 py-0.5 rounded"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-sm font-mono leading-relaxed">
        {children}
      </div>
    </div>
  );
}
