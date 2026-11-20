'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  HelpCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { fetchQuizzes } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ScenarioQuestion {
  id: number;
  category: string;
  topic: string;
  difficulty: 'Mid-Level' | 'Senior' | 'Staff/Principal';
  scenario: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  architectureTradeoff: string;
}

const PRODUCTION_FALLBACK_SCENARIOS: ScenarioQuestion[] = [
  {
    id: 1,
    category: 'Backend',
    topic: 'Spring Boot & Database Transactions',
    difficulty: 'Senior',
    scenario: 'A microservice processes order checkouts. An inner method annotated with @Transactional(propagation = Propagation.REQUIRES_NEW) is called from an outer method in the same @Service class that is also marked with @Transactional.',
    question: 'Why does the inner method fail to execute in a separate independent transaction when called directly via this.innerMethod()?',
    options: [
      'Spring Boot defaults to atomicity and forces all internal methods into the existing transaction.',
      'Spring transactional proxies intercept external method invocations; calling a method on "this" bypasses the CGLIB proxy.',
      'Propagation.REQUIRES_NEW is only supported when using Hibernate XML configurations, not modern Spring Boot.',
      'PostgreSQL does not support nested autonomous transactions without an external JTA coordinator.'
    ],
    correctIndex: 1,
    explanation: 'Spring transaction management is implemented via dynamic AOP proxies (CGLIB or JDK Dynamic Proxies). When an internal method is invoked directly on the same instance ("this"), the call does not pass through the Spring proxy interceptor, ignoring transaction attributes like REQUIRES_NEW.',
    architectureTradeoff: 'To solve this, extract the inner logic into a separate collaborating @Service bean, or inject the bean into itself via @Lazy / ObjectProvider, or use TransactionTemplate programmatically.'
  },
  {
    id: 2,
    category: 'Cloud & Infrastructure',
    topic: 'AWS Network Topology',
    difficulty: 'Senior',
    scenario: 'An enterprise organization operates 25 AWS accounts across 3 regions. Services in each VPC need bidirectional communication with shared audit, logging, and database VPCs without exceeding VPC peering route table limits.',
    question: 'Which AWS architectural pattern provides transitive routing while keeping peering connections scalable and manageable?',
    options: [
      'Full-mesh VPC Peering connections between all 25 accounts (requiring 300 peering connections).',
      'AWS Transit Gateway acting as a regional cloud hub with VPC attachments and route table isolation.',
      'Configuring dual NAT Gateways in every public subnet with open internet routing tables.',
      'Using AWS Direct Connect virtual interfaces interconnected via S3 bucket policies.'
    ],
    correctIndex: 1,
    explanation: 'AWS VPC Peering is non-transitive: VPC A cannot route through VPC B to reach VPC C. For large multi-account topologies, AWS Transit Gateway acts as a central regional router that supports transitive traffic, scales to thousands of VPCs, and supports route table segmentation.',
    architectureTradeoff: 'Transit Gateway incurs an hourly attachment fee plus per-GB data processing costs ($0.02/GB). For simple point-to-point VPC communication between just two VPCs, direct VPC peering remains cheaper and offers lower sub-millisecond latency.'
  },
  {
    id: 3,
    category: 'System Design',
    topic: 'Distributed Systems & Payment Idempotency',
    difficulty: 'Staff/Principal',
    scenario: 'A high-throughput payment webhook receives duplicate delivery notifications during transient network timeouts. Two simultaneous HTTP POST requests arrive within 15 milliseconds for the exact same transaction ID.',
    question: 'How should the backend guarantee that customer credit cards are not charged twice under severe race conditions?',
    options: [
      'Query the SQL database with SELECT COUNT(*) before inserting the record into the transactions table.',
      'Use atomic distributed lock reservation (e.g. Redis SET key token NX EX 60) coupled with a unique database constraint on the idempotency key.',
      'Rely on HTTP 301 redirects to steer concurrent clients into a serialized round-robin queue.',
      'Enable HTTP keep-alive timeouts and set TCP SYN retries to zero on the application load balancer.'
    ],
    correctIndex: 1,
    explanation: 'A simple SELECT followed by INSERT suffers from a classic "check-then-act" race condition. Atomic key acquisition (e.g. Redis SET key NX with expiration) combined with a unique DB index ensures that only one worker thread can proceed with the settlement while the other is rejected or waits for the cached response.',
    architectureTradeoff: 'If the lock holder crashes midway, the lock must have a sensible TTL (e.g. 120s) so subsequent retries are not deadlocked, and a status field ("PROCESSING" vs "COMPLETED") must distinguish in-flight executions from finalized transactions.'
  },
  {
    id: 4,
    category: 'System Design',
    topic: 'Kafka Message Ordering & Partitioning',
    difficulty: 'Senior',
    scenario: 'An e-commerce order stream requires strict chronological ordering of events (ORDER_CREATED -> PAYMENT_PROCESSED -> ORDER_SHIPPED) per user, but the overall cluster must handle 50,000 orders per second.',
    question: 'How should Kafka producers and consumers be configured to preserve per-order sequence while maintaining high horizontal throughput?',
    options: [
      'Assign all messages to a single global topic partition with 1 consumer instance.',
      'Publish messages with userId as the message key to route each user to a dedicated partition, scaled across N partitions.',
      'Set producer acks=0 and disable consumer commit offsets to speed up consumer throughput.',
      'Enable consumer auto.offset.reset=latest so out-of-order events are skipped automatically.'
    ],
    correctIndex: 1,
    explanation: 'Kafka guarantees total ordering ONLY within an individual partition. By hashing the userId as the message record key, all sequential events for that specific user land on the exact same partition in chronological order, while different users are distributed across all partitions for parallel consumption.',
    architectureTradeoff: 'Key skew can cause partition hotspots if a few users generate disproportionately massive traffic. In extreme cases, compound keys or specialized bucket partitions must be applied.'
  },
  {
    id: 5,
    category: 'Frontend',
    topic: 'Angular Signals & Reactivity',
    difficulty: 'Senior',
    scenario: 'An enterprise financial trading portal renders 500 order book updates per second. The application previously suffered from frame drops because Zone.js ran change detection across the entire DOM tree on every WebSocket tick.',
    question: 'How do Angular Signals with OnPush or zoneless change detection resolve this performance bottleneck?',
    options: [
      'Signals automatically serialize all UI updates into local IndexedDB storage before rendering.',
      'Signals establish fine-grained dependency graphs, directly notifying only the specific DOM bindings that depend on the mutated value without full component tree dirty-checking.',
      'Signals compile the application into WebAssembly (Wasm) bytecode at runtime.',
      'Signals throttle all network requests to 60fps using browser requestAnimationFrame hooks.'
    ],
    correctIndex: 1,
    explanation: 'Zone.js monkey-patches browser async APIs and marks all component views from the root down for verification on any event. Angular Signals introduce fine-grained reactive primitives (signal, computed, effect) that notify consumers with surgical precision, eliminating unnecessary checks across the component hierarchy.',
    architectureTradeoff: 'Signals are synchronous primitives; to handle asynchronous streams of events (like debounceTime or webSocket flows), engineers combine RxJS observables with rxResource or toSignal interop utilities.'
  },
  {
    id: 6,
    category: 'Backend',
    topic: 'PostgreSQL Indexing & JSONB Internals',
    difficulty: 'Senior',
    scenario: 'An application queries a PostgreSQL table containing 20 million rows. A column metadata is of type JSONB. Queries frequently filter on metadata->>\'status\' = \'COMPLETED\' and metadata->\'organizationId\' = \'org_451\'.',
    question: 'Which index structure yields optimal query execution plans and minimal I/O overhead for these searches?',
    options: [
      'A standard B-Tree index on the entire metadata column.',
      'A GIN (Generalized Inverted Index) or an expression B-Tree index on the specific JSONB extracted attributes.',
      'A Hash index on the primary key id column.',
      'A BRIN (Block Range Index) without configuring block size pages.'
    ],
    correctIndex: 1,
    explanation: 'A regular B-Tree on an entire JSONB column only supports equality of the whole document. A GIN index allows fast arbitrary key/value searches within JSONB, while expression B-Tree indexes (e.g. CREATE INDEX ON orders ((metadata->>\'status\'))) are even faster and more compact when query patterns are known.',
    architectureTradeoff: 'GIN indexes are heavier to maintain on high-write workloads and consume more disk space than targeted expression B-Trees.'
  }
];

export default function PracticePage() {
  const [scenarios, setScenarios] = useState<ScenarioQuestion[]>(PRODUCTION_FALLBACK_SCENARIOS);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [userHistory, setUserHistory] = useState<{ id: number; correct: boolean }[]>([]);

  // Fetch real quizzes from API with graceful fallback
  useEffect(() => {
    let isMounted = true;
    fetchQuizzes()
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data) && data.length > 0) {
          const mapped: ScenarioQuestion[] = data.map((q: any, i: number) => ({
            id: q.id || i + 1,
            category: q.category || 'System Design',
            topic: q.topic || 'Engineering Architecture',
            difficulty: q.difficulty || 'Senior',
            scenario: q.scenario || q.question,
            question: q.question,
            options: q.options || [],
            correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
            explanation: q.explanation || 'Detailed engineering rationale and verified production practice.',
            architectureTradeoff: q.architectureTradeoff || 'Evaluate system constraints, throughput, and consistency requirements before deploying.'
          }));
          setScenarios(mapped);
        }
      })
      .catch(() => {
        // Fallback scenarios remain active
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter scenarios by category
  const filteredScenarios = useMemo(() => {
    if (activeCategory === 'All') return scenarios;
    return scenarios.filter((s) => s.category.toLowerCase().includes(activeCategory.toLowerCase()));
  }, [scenarios, activeCategory]);

  const currentScenario = filteredScenarios[currentIndex] || filteredScenarios[0] || PRODUCTION_FALLBACK_SCENARIOS[0];

  const handleSelectOption = useCallback((idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);
    const isCorrect = idx === currentScenario.correctIndex;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    setUserHistory((prev) => [...prev, { id: currentScenario.id, correct: isCorrect }]);
  }, [isAnswered, currentScenario]);

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= filteredScenarios.length) {
      setSessionCompleted(true);
      return;
    }
    setSelectedOption(null);
    setIsAnswered(false);
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, filteredScenarios.length]);

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setSessionCompleted(false);
    setUserHistory([]);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setSessionCompleted(false);
    setUserHistory([]);
  };

  // Keyboard shortcut listener (1-4 for options, Space/Enter for Next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!isAnswered) {
        if (e.key === '1' || e.key.toLowerCase() === 'a') handleSelectOption(0);
        if (e.key === '2' || e.key.toLowerCase() === 'b') handleSelectOption(1);
        if (e.key === '3' || e.key.toLowerCase() === 'c') handleSelectOption(2);
        if (e.key === '4' || e.key.toLowerCase() === 'd') handleSelectOption(3);
      } else {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, handleSelectOption, handleNext]);

  const accuracyPct = Math.round((score / Math.max(1, filteredScenarios.length)) * 100);

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 pb-20">
      {/* 1. ENTERPRISE HEADER */}
      <PageHeader
        breadcrumbs={[
          { label: 'Platform', href: '/' },
          { label: 'Practice' },
          { label: 'Architectural Scenarios' }
        ]}
        badge={
          <Badge variant="warning" dot>
            Production Scenario Simulator
          </Badge>
        }
        title="Architectural Failure Scenarios & Drills"
        description="Test your engineering instincts against real microservices race conditions, cloud network bottlenecks, and distributed data consistency challenges."
        actions={
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-white/[0.08] bg-[#0f131c] px-4 py-2 text-right">
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wide">Accuracy</div>
              <div className="text-base font-bold text-white font-mono">
                {score} <span className="text-slate-500 text-xs font-normal">/ {filteredScenarios.length}</span>
              </div>
            </div>
          </div>
        }
      >
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-6 border-t border-white/[0.06] mt-6 scrollbar-none">
          {['All', 'Backend', 'Cloud & Infrastructure', 'System Design', 'Frontend'].map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`relative whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none cursor-pointer ${
                  isActive
                    ? 'text-sky-300 font-semibold'
                    : 'bg-[#0f131c] text-slate-400 hover:text-white hover:bg-[#141a26] border border-white/[0.06]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="practice-category-active"
                    className="absolute inset-0 rounded-md bg-sky-500/15 border border-sky-500/30"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{cat}</span>
              </button>
            );
          })}
        </div>
      </PageHeader>

      {/* 2. MAIN SCENARIO VIEW */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mt-8">
        <AnimatePresence mode="wait">
          {sessionCompleted ? (
            /* COMPLETION DEBRIEF REPORT */
            <motion.div
              key="completed-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="rounded-xl border border-white/[0.08] bg-[#0f131c] p-8 text-center max-w-2xl mx-auto shadow-2xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto mb-4">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <h2 className="text-xl font-bold text-white">Scenario Evaluation Complete</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                You evaluated <span className="font-semibold text-white">{score}</span> of <span className="font-semibold text-white">{filteredScenarios.length}</span> architectural challenges correctly ({accuracyPct}% precision).
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3 p-4 rounded-lg bg-[#141a26] border border-white/[0.06] text-center font-mono">
                <div>
                  <div className="text-xs text-slate-500">Correct</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">{score}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Incorrect</div>
                  <div className="text-lg font-bold text-rose-400 mt-0.5">{filteredScenarios.length - score}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Precision</div>
                  <div className="text-lg font-bold text-sky-400 mt-0.5">{accuracyPct}%</div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center gap-3">
                <Button variant="secondary" onClick={handleRestart} icon={<RotateCcw className="h-4 w-4" />}>
                  Retry Scenarios
                </Button>
                <Link href="/courses">
                  <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                    Explore Curriculum
                  </Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            /* ACTIVE SCENARIO CARD */
            <motion.div
              key={currentScenario.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Question Header Card */}
              <div className="rounded-xl border border-white/[0.08] bg-[#0f131c] p-6 shadow-xl">
                <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">
                      {currentScenario.category}
                    </Badge>
                    <Badge variant="neutral">
                      {currentScenario.difficulty}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Scenario {currentIndex + 1} of {filteredScenarios.length}
                  </span>
                </div>

                <div className="text-xs font-mono text-sky-400 mb-1">{currentScenario.topic}</div>
                <div className="rounded-lg bg-[#141a26] border border-white/[0.06] p-4 text-xs sm:text-sm text-slate-300 leading-relaxed font-mono mb-4">
                  <span className="text-slate-500 font-semibold block mb-1 uppercase tracking-wider text-[10px]">
                    System Scenario & Context
                  </span>
                  {currentScenario.scenario}
                </div>

                <h3 className="text-sm sm:text-base font-semibold text-white leading-snug">
                  {currentScenario.question}
                </h3>
              </div>

              {/* Options Grid */}
              <div className="space-y-3">
                {currentScenario.options.map((option, idx) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === currentScenario.correctIndex;

                  let borderClass = 'border-white/[0.08] bg-[#0f131c] hover:bg-[#141a26] hover:border-white/[0.16]';
                  let badgeClass = 'bg-[#141a26] text-slate-400 border border-white/[0.08]';

                  if (isAnswered) {
                    if (isCorrect) {
                      borderClass = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
                      badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                    } else if (isSelected) {
                      borderClass = 'border-rose-500/40 bg-rose-500/10 text-rose-200';
                      badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                    } else {
                      borderClass = 'border-white/[0.04] bg-[#0f131c]/50 opacity-50';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswered}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full rounded-xl border p-4 text-left transition-all duration-150 flex items-start gap-3 cursor-pointer ${borderClass}`}
                    >
                      <span className={`shrink-0 flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold ${badgeClass}`}>
                        {letters[idx]}
                      </span>
                      <span className="text-xs sm:text-sm text-slate-200 leading-relaxed pt-0.5">
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Post-Answer Architectural Breakdown */}
              <AnimatePresence>
                {isAnswered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="rounded-xl border border-white/[0.08] bg-[#0f131c] p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        {selectedOption === currentScenario.correctIndex ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 font-mono">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Optimal Architectural Choice</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 font-mono">
                            <XCircle className="h-4 w-4" />
                            <span>Suboptimal Trade-off Selected</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-500">Shortcuts: Enter or Space for Next</span>
                    </div>

                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Technical Rationale
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        {currentScenario.explanation}
                      </p>
                    </div>

                    <div className="rounded-lg bg-[#141a26] border border-white/[0.06] p-4 text-xs sm:text-sm">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold mb-1">
                        Architectural Trade-Off & Mitigation
                      </div>
                      <p className="text-slate-300 leading-relaxed font-mono text-xs">
                        {currentScenario.architectureTradeoff}
                      </p>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button variant="primary" onClick={handleNext} icon={<ArrowRight className="h-4 w-4" />}>
                        {currentIndex + 1 >= filteredScenarios.length ? 'View Debrief Report' : 'Next Scenario'}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
