'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, RotateCw, Sparkles, ChevronLeft, ChevronRight, BookOpen, Layers } from 'lucide-react';
import { fetchFlashcards } from '@/lib/api';

export default function RevisionPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await fetchFlashcards();
      setCards(data);
    }
    load();
  }, []);

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="pb-8 border-b border-slate-800 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-3">
          <Bookmark className="h-3.5 w-3.5" />
          <span>Active Recall Engine</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Revision & Flashcards</h1>
        <p className="mt-1 text-sm text-slate-400">
          Prepare for interviews and solidify core technical concepts with spaced repetition flashcards.
        </p>
      </div>

      <div className="mt-10 max-w-2xl mx-auto">
        {!currentCard ? (
          <div className="py-20 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mx-auto" />
          </div>
        ) : (
          <div>
            {/* Flashcard Card */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="relative min-h-[320px] cursor-pointer rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0f172a] to-slate-900 p-8 shadow-2xl flex flex-col justify-between hover:border-slate-700 transition-all group"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-amber-400 font-semibold uppercase">{currentCard.category}</span>
                <span className="flex items-center gap-1 text-slate-500 group-hover:text-slate-300">
                  <RotateCw className="h-3.5 w-3.5" />
                  Click to flip
                </span>
              </div>

              <div className="py-6 text-center">
                {!isFlipped ? (
                  <div>
                    <span className="text-[11px] font-mono text-blue-400 uppercase tracking-widest block mb-2">Question / Concept</span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
                      {currentCard.front}
                    </h3>
                  </div>
                ) : (
                  <div>
                    <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-widest block mb-2">Deep Answer</span>
                    <p className="text-base text-slate-200 leading-relaxed font-sans">
                      {currentCard.back}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-800/80">
                <span>Card {currentIndex + 1} of {cards.length}</span>
                <span className="text-amber-400 font-medium">{isFlipped ? 'Revealed' : 'Tap to Reveal'}</span>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-2 text-xs font-semibold text-amber-400 hover:bg-slate-800"
              >
                Flip Card
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-500/20"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
