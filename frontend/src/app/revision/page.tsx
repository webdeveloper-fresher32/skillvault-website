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
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

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
    <div className="min-h-screen bg-[#090b10] text-slate-100 pb-20">
      {/* 1. ENTERPRISE HEADER */}
      <PageHeader
        breadcrumbs={[
          { label: 'Platform', href: '/' },
          { label: 'Revision' },
          { label: 'Flashcards' }
        ]}
        badge={
          <Badge variant="warning" dot>
            Spaced Repetition & Recall
          </Badge>
        }
        title="Engineering Flashcards & Core Principles"
        description="Retain critical distributed systems principles, JVM memory models, and cloud architectural tradeoffs through active recall."
        actions={
          <Badge variant="success" dot>
            {masteredIds.length} of {cards.length} Mastered
          </Badge>
        }
      >
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-6 border-t border-white/[0.06] mt-6 scrollbar-none">
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
                className={`relative whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none cursor-pointer ${
                  isActive
                    ? 'text-amber-300 font-semibold'
                    : 'bg-[#0f131c] text-slate-400 hover:text-white hover:bg-[#141a26] border border-white/[0.06]'
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
      </PageHeader>

      {/* 2. FLASHCARD WORKSPACE */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 mt-8">
        {/* Progress bar */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
          <span>Card {currentIndex + 1} of {filteredCards.length}</span>
          <span className="text-slate-500 hidden sm:inline">Space: Flip • Arrows: Navigate • M: Master</span>
        </div>
        <div className="h-1 w-full rounded-full bg-[#141a26] overflow-hidden mb-6">
          <motion.div
            className="h-full bg-amber-400 rounded-full"
            initial={false}
            animate={{ width: `${((currentIndex + 1) / filteredCards.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Tactile Flashcard Card */}
        <motion.div
          key={`card-shell-${currentCard.id}`}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          onClick={toggleFlip}
          className="min-h-[340px] cursor-pointer rounded-xl border border-white/[0.08] bg-[#0f131c] p-8 shadow-xl flex flex-col justify-between hover:border-white/[0.16] hover:bg-[#141a26] transition-all select-none"
        >
          {/* Card Meta Top */}
          <div className="flex items-center justify-between text-xs pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Badge variant="warning">
                {currentCard.category}
              </Badge>
              <span className="text-slate-400 text-xs font-mono">{currentCard.topic}</span>
            </div>

            <div className="flex items-center gap-2">
              {isCurrentMastered && (
                <Badge variant="success">
                  Mastered
                </Badge>
              )}
              <span className="flex items-center gap-1.5 text-slate-500 text-xs font-mono">
                <RotateCw className="h-3 w-3" />
                {isFlipped ? 'Answer' : 'Question'}
              </span>
            </div>
          </div>

          {/* Card Body with Smooth AnimatePresence */}
          <div className="py-8 text-center my-auto">
            <AnimatePresence mode="wait">
              {!isFlipped ? (
                <motion.div
                  key="front"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-3 font-semibold">
                    Technical Principle & Question
                  </span>
                  <p className="text-base sm:text-lg font-medium text-white max-w-xl mx-auto leading-relaxed">
                    {currentCard.front}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="back"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="text-left"
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block mb-2 font-semibold">
                    Engineering Solution & Internals
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans mb-4">
                    {currentCard.back}
                  </p>

                  {currentCard.notes && (
                    <div className="rounded-lg bg-[#090b10] border border-white/[0.06] p-3 text-xs text-slate-400 font-mono">
                      <span className="text-amber-400 font-semibold block mb-0.5">Production Practice:</span>
                      {currentCard.notes}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card Bottom Bar */}
          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Card #{currentCard.id}</span>
            <span>Click card or hit Space to toggle</span>
          </div>
        </motion.div>

        {/* Card Controls Bar */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            onClick={handlePrev}
            icon={<ChevronLeft className="h-4 w-4" />}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={toggleFlip}
              icon={<RotateCw className="h-3.5 w-3.5" />}
            >
              Flip
            </Button>

            <Button
              variant={isCurrentMastered ? "secondary" : "outline"}
              onClick={toggleMastery}
              icon={<CheckCircle2 className={`h-4 w-4 ${isCurrentMastered ? 'text-emerald-400' : 'text-slate-500'}`} />}
            >
              {isCurrentMastered ? 'Mastered' : 'Mark Mastered'}
            </Button>
          </div>

          <Button
            variant="primary"
            onClick={handleNext}
            icon={<ChevronRight className="h-4 w-4" />}
          >
            Next
          </Button>
        </div>
      </main>
    </div>
  );
}
