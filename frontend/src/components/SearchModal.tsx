'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, BookOpen, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { globalSearch } from '@/lib/api';

interface SearchModalProps {
  onClose: () => void;
}

export default function SearchModal({ onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ courses: any[]; lessons: any[] }>({ courses: [], lessons: [] });

  useEffect(() => {
    if (!query.trim()) {
      setResults({ courses: [], lessons: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await globalSearch(query);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (url: string) => {
    onClose();
    router.push(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-xl border border-white/[0.12] bg-[#0c1019] shadow-2xl overflow-hidden">
        <div className="flex items-center border-b border-white/[0.08] px-4 py-3 bg-[#0e1320]">
          <Search className="h-4 w-4 text-slate-400 mr-3" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, lessons, code guides..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-sky-400 mr-2" />}
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {query.trim() === '' ? (
            <div className="py-8 text-center text-xs font-mono text-slate-500">
              Type to search courses (AWS, Spring Boot, DSA, HLD...) or lessons.
            </div>
          ) : results.courses.length === 0 && results.lessons.length === 0 && !loading ? (
            <div className="py-8 text-center text-xs font-mono text-slate-400">
              No results found for <span className="text-white font-medium">"{query}"</span>
            </div>
          ) : (
            <>
              {results.courses.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">Courses</h4>
                  <div className="space-y-1">
                    {results.courses.map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => handleSelect(`/courses/${c.slug}`)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg text-left hover:bg-white/[0.04] text-slate-200 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen className="h-4 w-4 text-sky-400" />
                          <div>
                            <div className="text-sm font-medium text-white group-hover:text-sky-400">{c.title}</div>
                            <div className="text-xs text-slate-400 font-mono">{c.category} • {c.totalLessons} lessons</div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-sky-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.lessons.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">Lessons & Notes</h4>
                  <div className="space-y-1">
                    {results.lessons.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => handleSelect(`/courses/${l.courseSlug}/${l.slug}`)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg text-left hover:bg-white/[0.04] text-slate-200 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-emerald-400" />
                          <div>
                            <div className="text-sm font-medium text-white group-hover:text-sky-400">{l.title}</div>
                            <div className="text-xs text-slate-400 font-mono">{l.courseTitle || l.courseSlug}</div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-sky-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
