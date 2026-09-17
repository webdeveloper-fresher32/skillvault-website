'use client';

import React, { useState } from 'react';
import { RotateCw, Sparkles, HelpCircle } from 'lucide-react';

export interface QAPair {
  id?: string;
  category?: string;
  question: string;
  answer: string;
}

export interface FlipCardDeckProps {
  items: QAPair[];
  title?: string;
}

export default function FlipCardDeck({
  items,
  title = 'Interview Q&A Flashcard Deck',
}: FlipCardDeckProps) {
  const [flippedMap, setFlippedMap] = useState<Record<number, boolean>>({});

  const toggleFlip = (index: number) => {
    setFlippedMap((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleFlip(index);
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="my-8">
      {title && (
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-100">{title}</h3>
          <span className="text-xs text-slate-400 font-mono">({items.length} cards)</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, idx) => {
          const isFlipped = !!flippedMap[idx];

          return (
            <div
              key={item.id || idx}
              tabIndex={0}
              role="button"
              aria-label={`Flashcard: ${item.question}`}
              onClick={() => toggleFlip(idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className="h-56 select-none cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl"
              style={{ perspective: '1000px' }}
            >
              <div
                className="relative w-full h-full rounded-xl transition-transform duration-500"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* FRONT FACE */}
                <div
                  className="absolute inset-0 w-full h-full rounded-xl p-4 bg-[#101726] border border-[#30363d] group-hover:border-indigo-500/50 flex flex-col justify-between shadow-lg transition-colors"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        {item.category || `Question #${idx + 1}`}
                      </span>
                      <HelpCircle className="h-4 w-4 text-slate-500 shrink-0" />
                    </div>
                    <p className="text-sm font-semibold text-slate-100 leading-snug line-clamp-4 mt-2">
                      {item.question}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-indigo-400/90 font-medium">
                    <RotateCw className="h-3 w-3" />
                    <span>Tap to reveal answer</span>
                  </div>
                </div>

                {/* BACK FACE */}
                <div
                  className="absolute inset-0 w-full h-full rounded-xl p-4 bg-[#182238] border border-indigo-500/60 flex flex-col justify-between shadow-xl overflow-y-auto"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Answer
                      </span>
                    </div>
                    <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed mt-1">
                      {item.answer}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mt-2 pt-2 border-t border-[#30363d]/60">
                    <RotateCw className="h-3 w-3" />
                    <span>Tap to flip back</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
