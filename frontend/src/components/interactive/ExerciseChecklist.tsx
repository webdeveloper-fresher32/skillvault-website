'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Terminal, Dumbbell } from 'lucide-react';

export interface ExerciseItem {
  id: string;
  title: string;
  problem: string;
  promptCode?: string;
  solutionCode?: string;
  talkingPoints?: string;
}

export interface ExerciseChecklistProps {
  storageKey?: string;
  title?: string;
  items: ExerciseItem[];
}

export default function ExerciseChecklist({
  storageKey = 'course_exercises_state',
  title = 'Hands-On Refactoring Exercises',
  items,
}: ExerciseChecklistProps) {
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});
  const [openSolutionMap, setOpenSolutionMap] = useState<Record<string, boolean>>({});

  // Restore from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setCompletedMap(JSON.parse(raw));
      }
    } catch (e) {
      console.warn('Could not read exercise state:', e);
    }
  }, [storageKey]);

  // Save to localStorage
  const toggleComplete = (id: string) => {
    setCompletedMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Could not save exercise state:', e);
      }
      return next;
    });
  };

  const toggleSolution = (id: string) => {
    setOpenSolutionMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!items || items.length === 0) return null;

  const completedCount = items.filter((item) => !!completedMap[item.id]).length;

  return (
    <div className="my-8 rounded-xl border border-[#30363d] bg-[#101726] p-5 shadow-xl">
      {/* Header with counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Dumbbell className="h-4 w-4" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-100">{title}</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {completedCount} of {items.length} Completed
          </span>
        </div>
      </div>

      {/* Exercises List */}
      <div className="divide-y divide-[#30363d]/60 mt-2">
        {items.map((item, idx) => {
          const isDone = !!completedMap[item.id];
          const isSolOpen = !!openSolutionMap[item.id];

          return (
            <div key={item.id || idx} className="py-4 first:pt-3 last:pb-0">
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  id={`ex-${item.id}`}
                  checked={isDone}
                  onChange={() => toggleComplete(item.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer shrink-0 accent-emerald-500"
                />

                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={`ex-${item.id}`}
                    className={`block text-sm font-semibold cursor-pointer transition-all ${
                      isDone ? 'line-through text-slate-500' : 'text-slate-100 hover:text-white'
                    }`}
                  >
                    {item.title}
                  </label>

                  <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed mt-1">
                    {item.problem}
                  </p>

                  {/* Problem prompt code if available */}
                  {item.promptCode && (
                    <div className="my-2.5 rounded-lg border border-[#30363d] bg-[#070a12] p-3 text-xs font-mono text-slate-300 overflow-x-auto">
                      <pre className="!bg-transparent !p-0 !m-0">
                        <code>{item.promptCode}</code>
                      </pre>
                    </div>
                  )}

                  {/* Solution Accordion Toggle */}
                  {(item.solutionCode || item.talkingPoints) && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleSolution(item.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md border border-indigo-500/20 transition-all"
                      >
                        <Terminal className="h-3 w-3" />
                        <span>{isSolOpen ? 'Hide Solution' : 'Reveal Solution & Talking Points'}</span>
                        {isSolOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {isSolOpen && (
                        <div className="mt-3 rounded-lg border border-indigo-500/30 bg-[#070a12] p-4 text-xs">
                          {item.solutionCode && (
                            <div className="overflow-x-auto text-emerald-300 font-mono">
                              <pre className="!bg-transparent !p-0 !m-0 leading-relaxed">
                                <code>{item.solutionCode}</code>
                              </pre>
                            </div>
                          )}

                          {item.talkingPoints && (
                            <div className="mt-3 pt-3 border-t border-[#30363d] text-slate-300 text-xs leading-relaxed">
                              <strong className="text-white font-semibold block mb-1">
                                Interview Talking Points:
                              </strong>
                              {item.talkingPoints}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
