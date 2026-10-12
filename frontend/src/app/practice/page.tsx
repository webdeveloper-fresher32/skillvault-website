'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
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
  Cpu,
  Cloud,
  Network,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { fetchQuizzes } from '@/lib/api';

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
    <div className="min-h-screen bg-[#06080e] text-slate-100 pb-20">
      {/* 1. HEADER BAR */}
      <section className="border-b border-white/[0.06] bg-[#080c14] py-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-mono text-emerald-400 mb-3">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                <span>Production Scenario Simulator</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Architectural Failure Scenarios & Drills
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                Test your instincts against real microservices race conditions, cloud network bottlenecks, and database deadlocks.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="rounded-lg border border-white/[0.08] bg-[#0c1019] px-3.5 py-2 text-right">
                <div className="text-[11px] font-mono text-slate-500 uppercase">Session Score</div>
                <div className="text-lg font-bold text-white font-mono">
                  {score} <span className="text-slate-500 text-xs font-normal">/ {filteredScenarios.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-white/[0.06]">
            {['All', 'Backend', 'Cloud & Infrastructure', 'System Design', 'Frontend'].map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeCategory === cat
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'bg-[#0c1019] text-slate-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. MAIN SCENARIO VIEW */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mt-8">
        {sessionCompleted ? (
          /* COMPLETION DEBRIEF REPORT */
          <div className="rounded-xl border border-white/[0.08] bg-[#0a0e17] p-8 text-center max-w-2xl mx-auto shadow-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <h2 className="text-2xl font-bold text-white">Scenario Evaluation Complete</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              You verified <span className="font-bold text-white">{score}</span> of <span className="font-bold text-white">{filteredScenarios.length}</span> engineering challenges correctly ({accuracyPct}% precision).
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 p-4 rounded-lg bg-[#070a12] border border-white/[0.06] text-center font-mono">
              <div>
                <div className="text-xs text-slate-500">Correct</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">{score}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Incorrect</div>
                <div className="text-xl font-bold text-rose-400 mt-0.5">{filteredScenarios.length - score}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Accuracy</div>
                <div className="text-xl font-bold text-sky-400 mt-0.5">{accuracyPct}%</div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleRestart}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Retake Scenario Battery
              </button>
              <Link
                href="/interview"
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#0c1019] hover:bg-[#121826] px-5 py-2.5 text-xs font-semibold text-slate-200 transition-colors"
              >
                <BookOpen className="h-4 w-4 text-sky-400" />
                Study 45+ Interview Guides
              </Link>
            </div>
          </div>
        ) : (
          /* ACTIVE SCENARIO CARD */
          <div className="rounded-xl border border-white/[0.08] bg-[#0a0e17] p-6 sm:p-8 shadow-xl">
            {/* Meta bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/[0.06] text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-sky-400 uppercase tracking-wide">
                  {currentScenario.topic}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-[11px] text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                  {currentScenario.difficulty}
                </span>
              </div>
              <div className="font-mono text-slate-400 text-xs">
                Scenario {currentIndex + 1} of {filteredScenarios.length}
              </div>
            </div>

            {/* Linear Progress Bar */}
            <div className="mt-4 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / filteredScenarios.length) * 100}%` }}
              />
            </div>

            {/* Real World Engineering Scenario Context */}
            {currentScenario.scenario && (
              <div className="mt-6 p-4 rounded-lg bg-[#070a12] border border-white/[0.06] text-xs leading-relaxed text-slate-300">
                <span className="font-mono text-[11px] font-semibold uppercase text-slate-500 block mb-1">
                  Engineering Context & Production Environment
                </span>
                {currentScenario.scenario}
              </div>
            )}

            {/* Core Architectural Question */}
            <h3 className="mt-5 text-base sm:text-lg font-bold text-white leading-snug">
              {currentScenario.question}
            </h3>

            {/* Multiple Choice Options */}
            <div className="mt-6 space-y-2.5">
              {currentScenario.options.map((option: string, idx: number) => {
                let stateStyle = 'border-white/[0.08] bg-[#0c1019] text-slate-300 hover:border-white/[0.18] hover:bg-[#111724]';

                if (isAnswered) {
                  if (idx === currentScenario.correctIndex) {
                    stateStyle = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200 font-medium';
                  } else if (idx === selectedOption) {
                    stateStyle = 'border-rose-500/50 bg-rose-500/10 text-rose-300';
                  } else {
                    stateStyle = 'border-white/[0.04] bg-[#080c14] text-slate-500 opacity-60';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full flex items-start gap-3.5 p-3.5 rounded-lg border text-left text-xs sm:text-sm transition-all ${stateStyle} focus:outline-none`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/[0.06] font-mono text-[11px] font-semibold text-slate-400">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="leading-relaxed pt-0.5">{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Keyboard shortcuts reminder */}
            {!isAnswered && (
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Press keys 1-4 or A-D to select</span>
                <span>Instant Evaluation</span>
              </div>
            )}

            {/* Explanation & Tradeoff Insight */}
            {isAnswered && (
              <div className="mt-6 space-y-3">
                <div className="p-4 rounded-lg border border-sky-500/20 bg-sky-500/5 text-xs text-slate-300 leading-relaxed">
                  <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                    <span>Architectural Rationale & Implementation Detail</span>
                  </div>
                  {currentScenario.explanation}
                </div>

                {currentScenario.architectureTradeoff && (
                  <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-200/90 leading-relaxed">
                    <span className="font-semibold text-amber-300 block mb-0.5 font-mono text-[11px]">
                      Production Trade-off & Gotcha:
                    </span>
                    {currentScenario.architectureTradeoff}
                  </div>
                )}
              </div>
            )}

            {/* Advance Button */}
            {isAnswered && (
              <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">Press Space or Enter to continue</span>
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-5 py-2 text-xs font-semibold text-white transition-colors"
                >
                  <span>{currentIndex + 1 >= filteredScenarios.length ? 'Complete Battery' : 'Next Scenario'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
