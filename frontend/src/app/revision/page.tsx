'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bookmark, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  HelpCircle,
  Eye,
  Check,
  X
} from 'lucide-react';
import { fetchFlashcards } from '@/lib/api';

interface Flashcard {
  id: number;
  category: string;
  topic: string;
  front: string;
  back: string;
  notes?: string;
}

const PRODUCTION_FALLBACK_CARDS: Flashcard[] = [
  {
    id: 1,
    category: 'Backend & Java',
    topic: 'JVM Garbage Collection',
    front: 'What is the primary architectural difference between ZGC and G1GC in modern JVM runtimes (Java 17/21)?',
    back: 'ZGC is a generational concurrent garbage collector designed for ultra-low latency (<1ms max pause time regardless of heap size, up to 16TB) using colored pointers and load barriers. G1GC divides heap into regions and performs incremental generational pauses, prioritizing predictable throughput over sub-millisecond pauses.',
    notes: 'Use ZGC for latency-sensitive financial or real-time trading engines; use G1GC or Parallel GC for batch compute workloads.'
  },
  {
    id: 2,
    category: 'Backend & Java',
    topic: 'Spring Framework',
    front: 'How does Spring manage bean scopes, and why is injecting a Prototype bean into a Singleton bean problematic without ObjectFactory / @Lookup?',
    back: 'Singleton beans are initialized once during application startup. If a Prototype bean is injected via standard @Autowired into a Singleton, the prototype bean is only injected once during construction and never recreated on subsequent calls. Using @Lookup or ObjectProvider<T> ensures a fresh prototype instance is instantiated per invocation.',
    notes: 'Alternatively, use Method Injection or scoped proxies (proxyMode = ScopedProxyMode.TARGET_CLASS).'
  },
  {
    id: 3,
    category: 'System Design',
    topic: 'Distributed Transactions',
    front: 'Why is Two-Phase Commit (2PC) rarely used in modern cloud-native microservices, and what pattern replaces it?',
    back: '2PC is a blocking protocol: if the transaction coordinator fails or network partitions occur during the prepare phase, resource locks remain held indefinitely, collapsing system throughput. Modern microservices use the Saga Pattern (choreography with Kafka events or orchestration via workflow engines like Temporal) with compensating transactions to achieve eventual consistency.',
    notes: 'CAP Theorem: 2PC prioritizes Consistency at the expense of Availability and Partition Tolerance.'
  },
  {
    id: 4,
    category: 'System Design',
    topic: 'Caching Topologies',
    front: 'Explain the difference between Cache-Aside (Lazy Loading) and Write-Through caching patterns.',
    back: 'In Cache-Aside, the application code queries the cache first; on a miss, it queries the database and populates the cache. In Write-Through, the application writes directly to the cache, and the cache synchronously updates the database before returning success, ensuring the cache is always fresh at the expense of higher write latency.',
    notes: 'Cache-Aside is resilient to cache crashes (can fallback to DB directly) and only caches requested data.'
  },
  {
    id: 5,
    category: 'Cloud & Infrastructure',
    topic: 'AWS Cloud Networking',
    front: 'What is the key functional difference between a Security Group and a Network Access Control List (NACL) in an AWS VPC?',
    back: 'Security Groups are stateful firewalls evaluated at the Elastic Network Interface (ENI) instance level (return traffic is automatically allowed regardless of inbound rules). NACLs are stateless firewalls evaluated at the subnet boundary that process rules sequentially by number and require explicit inbound AND outbound rules.',
    notes: 'NACLs support explicit DENY rules (useful for blocking compromised IP ranges); Security Groups only support ALLOW rules.'
  },
  {
    id: 6,
    category: 'Frontend & Architecture',
    topic: 'Angular Signals',
    front: 'How does Angular Signals change detection differ from React’s useState reconciliation model?',
    back: 'In React, invoking setState schedules a re-render of the entire component function and its children down the virtual DOM tree unless memoized with React.memo or useMemo. Angular Signals establish a fine-grained subscriber graph that tracks reactive dependencies directly; only the specific bindings that read the signal in the DOM template update, without re-executing component logic.',
    notes: 'Signals operate synchronously with glitch-free computed diamond-dependency guarantees.'
  },
  {
    id: 7,
    category: 'AI & LLMs',
    topic: 'RAG Architecture',
    front: 'What is the role of a Cross-Encoder Reranker in an enterprise RAG retrieval pipeline?',
    back: 'Vector bi-encoders independently embed query and documents into dense space, allowing fast approximate nearest neighbor (ANN) search over millions of chunks. A cross-encoder reranker takes the top-N candidates (e.g. top 50) and jointly scores [query, chunk] token interactions with full cross-attention, boosting retrieval precision before passing chunks into the LLM context.',
    notes: 'Reranking significantly reduces context hallucination and eliminates irrelevant semantic distractors.'
  }
];

export default function RevisionPage() {
  const [cards, setCards] = useState<Flashcard[]>(PRODUCTION_FALLBACK_CARDS);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<number[]>([]);

  // Load user mastery state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('skillvault_mastered_cards');
      if (saved) {
        setMasteredIds(JSON.parse(saved));
      }
    } catch (_) {}
  }, []);

  // Fetch flashcards from backend with fallback
  useEffect(() => {
    let isMounted = true;
    fetchFlashcards()
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data) && data.length > 0) {
          const mapped: Flashcard[] = data.map((c: any, i: number) => ({
            id: c.id || i + 1,
            category: c.category || 'System Design',
            topic: c.topic || 'Architecture Concept',
            front: c.front || c.question,
            back: c.back || c.answer,
            notes: c.notes || ''
          }));
          setCards(mapped);
        }
      })
      .catch(() => {
        // Fallback cards remain active
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter cards by category
  const filteredCards = useMemo(() => {
    if (activeCategory === 'All') return cards;
    return cards.filter((c) => c.category.toLowerCase().includes(activeCategory.toLowerCase()));
  }, [cards, activeCategory]);

  const currentCard = filteredCards[currentIndex] || filteredCards[0] || PRODUCTION_FALLBACK_CARDS[0];
  const isCurrentMastered = masteredIds.includes(currentCard.id);

  const handleNext = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
  }, [filteredCards.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length);
  }, [filteredCards.length]);

  const toggleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const toggleMastery = () => {
    const next = isCurrentMastered
      ? masteredIds.filter((id) => id !== currentCard.id)
      : [...masteredIds, currentCard.id];
    setMasteredIds(next);
    try {
      localStorage.setItem('skillvault_mastered_cards', JSON.stringify(next));
    } catch (_) {}
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === 'ArrowRight' || e.key === 'j') {
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'k') {
        handlePrev();
      } else if (e.key === 'm') {
        toggleMastery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFlip, handleNext, handlePrev, toggleMastery]);

  const categories = ['All', 'Backend & Java', 'System Design', 'Cloud & Infrastructure', 'Frontend', 'AI & LLMs'];

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 pb-20">
      {/* 1. HEADER BAR */}
      <section className="border-b border-white/[0.06] bg-[#080c14] py-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-mono text-amber-400 mb-3">
                <Bookmark className="h-3.5 w-3.5 text-amber-400" />
                <span>Spaced Repetition & Active Recall</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Engineering Flashcards & Core Principles
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Retain critical distributed systems principles, JVM internals, and cloud tradeoffs through active recall.
              </p>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-slate-400 shrink-0">
              <span className="text-emerald-400 font-semibold">{masteredIds.length}</span> / {cards.length} Mastered
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-white/[0.06]">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                  }}
                  className={`relative px-3 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none cursor-pointer ${
                    isActive
                      ? 'text-amber-300 font-semibold'
                      : 'bg-[#0c1019] text-slate-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="revision-category-active"
                      className="absolute inset-0 rounded-md bg-amber-500/15 border border-amber-500/30"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. FLASHCARD WORKSPACE */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 mt-8">
        {/* Progress bar */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
          <span>Card {currentIndex + 1} of {filteredCards.length}</span>
          <span className="text-slate-500">Shortcuts: Space to flip • Arrows to navigate • M to master</span>
        </div>
        <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden mb-6">
          <motion.div
            className="h-full bg-amber-500 rounded-full"
            initial={false}
            animate={{ width: `${((currentIndex + 1) / filteredCards.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Tactile Flashcard Card */}
        <motion.div
          key={`card-shell-${currentCard.id}`}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          whileHover={{ y: -2 }}
          onClick={toggleFlip}
          className="min-h-[340px] cursor-pointer rounded-xl border border-white/[0.08] bg-[#0a0e17] p-8 shadow-2xl flex flex-col justify-between hover:border-white/[0.18] transition-colors select-none"
        >
          {/* Card Meta Top */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-mono">
              <span className="font-semibold text-amber-400 uppercase tracking-wide text-[11px]">
                {currentCard.category}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px]">{currentCard.topic}</span>
            </div>

            <span className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs font-mono">
              <RotateCw className="h-3 w-3" />
              {isFlipped ? 'Answer Revealed' : 'Click or Space to Flip'}
            </span>
          </div>

          {/* Card Body with Smooth AnimatePresence */}
          <div className="py-6 text-center">
            <AnimatePresence mode="wait">
              {!isFlipped ? (
                <motion.div
                  key="front"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-3">
                    Technical Concept / Architectural Question
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed max-w-2xl mx-auto">
                    {currentCard.front}
                  </h3>
                </motion.div>
              ) : (
                <motion.div
                  key="back"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block mb-3">
                    Production Rationale & Verified Answer
                  </span>
                  <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl mx-auto font-sans">
                    {currentCard.back}
                  </p>
                  {currentCard.notes && (
                    <div className="mt-4 inline-block text-left p-3 rounded-md bg-[#070a12] border border-white/[0.06] text-xs text-slate-400 max-w-xl">
                      <span className="font-mono text-sky-400 font-semibold block mb-0.5">Practical Tip:</span>
                      {currentCard.notes}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card Bottom Meta */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] text-xs">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMastery();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                isCurrentMastered
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/[0.03] text-slate-400 border-white/[0.06] hover:text-white'
              }`}
            >
              {isCurrentMastered ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Bookmark className="h-3.5 w-3.5" />}
              <span>{isCurrentMastered ? 'Mastered' : 'Mark as Mastered (M)'}</span>
            </button>

            <span className="text-amber-400/90 font-mono text-[11px]">
              {isFlipped ? 'Tap to view question' : 'Tap to reveal answer'}
            </span>
          </div>
        </motion.div>

        {/* Controls Bar */}
        <div className="mt-6 flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handlePrev}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0c1019] hover:bg-[#121826] px-4 py-2 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={toggleFlip}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
          >
            {isFlipped ? 'Show Question' : 'Flip Card (Space)'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      </main>
    </div>
  );
}
