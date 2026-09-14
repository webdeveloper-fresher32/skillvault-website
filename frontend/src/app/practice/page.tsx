'use client';

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  HelpCircle 
} from 'lucide-react';
import { fetchQuizzes } from '@/lib/api';

export default function PracticePage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    async function load() {
      const data = await fetchQuizzes();
      setQuizzes(data);
    }
    load();
  }, []);

  const currentQuestion = quizzes[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);
    if (idx === currentQuestion.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="pb-8 border-b border-slate-800 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 mb-3">
          <Zap className="h-3.5 w-3.5" />
          <span>Interactive Practice Engine</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Practice & Scenario Quizzes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Reinforce your knowledge across Spring Boot, AWS VPCs, and High-Level Design scenarios with instant verification.
        </p>
      </div>

      <div className="mt-10">
        {!currentQuestion ? (
          <div className="py-20 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto" />
            <p className="text-sm text-slate-400 mt-4">Loading practice scenarios...</p>
          </div>
        ) : currentIndex >= quizzes.length ? (
          /* Quiz Results Summary */
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Scenario Practice Complete!</h2>
            <p className="text-slate-400 text-sm mt-1">
              You scored <span className="font-bold text-white">{score}</span> out of <span className="font-bold text-white">{quizzes.length}</span>
            </p>

            <button
              onClick={handleRestart}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25"
            >
              <RotateCcw className="h-4 w-4" />
              Retake Practice Session
            </button>
          </div>
        ) : (
          /* Active Question Card */
          <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-6 sm:p-8 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-4 border-b border-slate-800">
              <span className="font-mono text-emerald-400 font-semibold uppercase">{currentQuestion.topic}</span>
              <span>Question {currentIndex + 1} of {quizzes.length}</span>
            </div>

            <h3 className="mt-6 text-xl font-bold text-white leading-snug">
              {currentQuestion.question}
            </h3>

            {/* Multiple Choice Options */}
            <div className="mt-6 space-y-3">
              {currentQuestion.options.map((opt: string, idx: number) => {
                let btnStyle = 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80';
                if (isAnswered) {
                  if (idx === currentQuestion.correctIndex) {
                    btnStyle = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300 font-medium';
                  } else if (idx === selectedOption) {
                    btnStyle = 'border-red-500/60 bg-red-500/15 text-red-300';
                  } else {
                    btnStyle = 'border-slate-800 bg-slate-900/40 text-slate-500 opacity-60';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left text-sm transition-all ${btnStyle}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800/80 font-mono text-xs font-semibold text-slate-300">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="leading-relaxed">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation Section */}
            {isAnswered && (
              <div className="mt-6 p-4 rounded-xl border border-blue-500/20 bg-blue-500/10 text-xs leading-relaxed text-blue-300">
                <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  Explanation & Architecture Insight
                </div>
                {currentQuestion.explanation}
              </div>
            )}

            {/* Next Button */}
            {isAnswered && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-500/25 transition-all"
                >
                  <span>{currentIndex === quizzes.length - 1 ? 'Finish' : 'Next Scenario'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
