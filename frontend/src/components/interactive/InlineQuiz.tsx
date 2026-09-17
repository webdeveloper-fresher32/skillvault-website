'use client';

import React, { useState } from 'react';
import { HelpCircle, CheckCircle, XCircle, RotateCcw } from 'lucide-react';

export interface QuizOption {
  label: string;
  isCorrect: boolean;
}

export interface InlineQuizProps {
  question: string;
  options: QuizOption[];
  explanation: string;
  badgeText?: string;
}

export default function InlineQuiz({
  question,
  options,
  explanation,
  badgeText = 'Concept Checkpoint',
}: InlineQuizProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (index: number) => {
    if (submitted) return;
    setSelectedIndex(index);
    setSubmitted(true);
  };

  const handleReset = () => {
    setSelectedIndex(null);
    setSubmitted(false);
  };

  const isCurrentCorrect = selectedIndex !== null && options[selectedIndex]?.isCorrect;

  return (
    <div className="my-8 rounded-xl border border-amber-500/30 bg-[#101726] p-5 shadow-xl">
      {/* Badge & Question */}
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>{badgeText}</span>
        </span>
      </div>

      <h3 className="text-sm sm:text-base font-bold text-slate-100 leading-snug mb-4">
        {question}
      </h3>

      {/* Options List */}
      <div className="space-y-2.5">
        {options.map((option, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isSelected = selectedIndex === idx;
          const isCorrect = option.isCorrect;

          let btnStyles = 'border-[#30363d] bg-[#182238] text-slate-200 hover:border-amber-400/60 hover:bg-[#1e293b]';

          if (submitted) {
            if (isCorrect) {
              btnStyles = 'border-emerald-500 bg-emerald-950/40 text-emerald-200 font-medium ring-1 ring-emerald-500/50';
            } else if (isSelected && !isCorrect) {
              btnStyles = 'border-rose-500 bg-rose-950/40 text-rose-200 ring-1 ring-rose-500/50';
            } else {
              btnStyles = 'border-[#30363d]/40 bg-[#182238]/40 text-slate-500 opacity-60';
            }
          }

          return (
            <button
              key={idx}
              disabled={submitted}
              onClick={() => handleSelect(idx)}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border text-xs sm:text-sm transition-all ${btnStyles}`}
            >
              <span className="font-mono font-bold shrink-0 text-slate-400">
                {letter})
              </span>
              <span className="flex-1 leading-relaxed">{option.label}</span>
              {submitted && isCorrect && (
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              {submitted && isSelected && !isCorrect && (
                <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation Banner */}
      {submitted && (
        <div
          className={`mt-4 p-3.5 rounded-lg border text-xs leading-relaxed animate-in fade-in duration-200 ${
            isCurrentCorrect
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="font-bold mb-1 flex items-center gap-1.5">
            {isCurrentCorrect ? (
              <>
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span>Correct!</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-rose-400" />
                <span>Not quite right.</span>
              </>
            )}
          </div>
          <p>{explanation}</p>

          <button
            onClick={handleReset}
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white underline"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Try again</span>
          </button>
        </div>
      )}
    </div>
  );
}
