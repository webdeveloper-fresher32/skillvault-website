'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Terminal, 
  BookOpen, 
  Code2, 
  Flame, 
  Clock, 
  Layers, 
  Cpu, 
  Cloud, 
  Database,
  BrainCircuit,
  Zap,
  HelpCircle,
  Bookmark,
  CheckCircle2,
  Server,
  Network,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { fetchDashboardStats, fetchCourses, DEFAULT_STATS, DashboardStats, Course } from '@/lib/api';

const DOMAIN_MATRIX = [
  {
    id: 'backend',
    title: 'Backend Systems',
    icon: Cpu,
    count: '8 Tracks',
    lessons: '320+ Lessons',
    topics: ['Spring Boot 3/4', 'Java Concurrency', 'NestJS', 'PostgreSQL Internals', 'Redis Caching'],
    primarySlug: 'springboot',
  },
  {
    id: 'cloud',
    title: 'Cloud & Infrastructure',
    icon: Cloud,
    count: '6 Tracks',
    lessons: '240+ Lessons',
    topics: ['AWS Solutions Architect', 'Kubernetes Clusters', 'Docker Multi-Stage', 'Terraform IaC', 'GitHub Actions'],
    primarySlug: 'aws',
  },
  {
    id: 'system-design',
    title: 'System Design & HLD',
    icon: Network,
    count: '5 Tracks',
    lessons: '180+ Lessons',
    topics: ['Distributed Caching', 'Kafka Partitions', 'Payment Idempotency', 'Database Sharding', 'Rate Limiting'],
    primarySlug: 'hld',
  },
  {
    id: 'ai',
    title: 'AI Engineering & Agents',
    icon: BrainCircuit,
    count: '4 Tracks',
    lessons: '150+ Lessons',
    topics: ['RAG Architectures', 'Vector Databases', 'LangChain LCEL', 'LangGraph State Graphs', 'LLMOps Triad'],
    primarySlug: 'rag',
  },
  {
    id: 'frontend',
    title: 'Frontend Architecture',
    icon: Layers,
    count: '4 Tracks',
    lessons: '160+ Lessons',
    topics: ['Angular Signals', 'Zoneless Change Detection', 'React Architecture', 'Next.js 15 App Router'],
    primarySlug: 'angular',
  },
];

const CODE_SANDBOX_PREVIEWS = [
  {
    id: 'idempotency',
    tab: 'Distributed Idempotency',
    domain: 'Spring Boot 3 + Redis',
    description: 'Guarantees exactly-once processing for high-frequency financial webhooks using atomic setnx tokens.',
    code: `@Transactional
public PaymentResponse processPayment(String idempotencyKey, PaymentRequest req) {
    Boolean acquired = redisTemplate.opsForValue()
        .setIfAbsent("lock:idem:" + idempotencyKey, "PROCESSING", Duration.ofSeconds(120));
    
    if (Boolean.FALSE.equals(acquired)) {
        throw new DuplicateTransactionException("Request in-flight or already settled: " + idempotencyKey);
    }
    
    PaymentRecord record = paymentRepository.save(new PaymentRecord(req));
    kafkaProducer.publish("payments.settled", record.toEvent());
    return PaymentResponse.from(record);
}`,
  },
  {
    id: 'vpc',
    tab: 'AWS Multi-AZ VPC Spec',
    domain: 'Terraform HCL Infrastructure',
    description: 'Enterprise VPC isolation: dual private application subnets routed through redundant NAT Gateways.',
    code: `resource "aws_vpc" "production_core" {
  cidr_block           = "10.100.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Environment = "Production", Tier = "Critical-Core" }
}

resource "aws_subnet" "private_app" {
  count             = 2
  vpc_id            = aws_vpc.production_core.id
  cidr_block        = cidrsubnet(aws_vpc.production_core.cidr_block, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
}`,
  },
  {
    id: 'signals',
    tab: 'Angular Reactive Signals',
    domain: 'Zoneless Frontend Architecture',
    description: 'High-performance reactive primitive removing Zone.js overhead with fine-grained reactive updates.',
    code: `@Component({
  selector: 'app-telemetry-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <div class="metric">Throughput: {{ liveThroughput() }} req/s</div>
    <div class="status" [class.healthy]="isOperational()">Status: {{ status() }}</div>
  \`
})
export class TelemetryComponent {
  readonly metrics = signal<MetricPacket[]>([]);
  readonly liveThroughput = computed(() => this.metrics().reduce((acc, m) => acc + m.rate, 0));
  readonly isOperational = computed(() => this.liveThroughput() > 0);
}`,
  },
];

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCodeTab, setActiveCodeTab] = useState(0);

  useEffect(() => {
    let isMounted = true;
    try {
      const cached = sessionStorage.getItem('skillvault_stats');
      if (cached) {
        setStats(JSON.parse(cached));
      }
    } catch (_) {}

    Promise.allSettled([fetchDashboardStats(), fetchCourses()]).then(([statsRes, coursesRes]) => {
      if (!isMounted) return;
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
        try {
          sessionStorage.setItem('skillvault_stats', JSON.stringify(statsRes.value));
        } catch (_) {}
      }
      if (coursesRes.status === 'fulfilled' && coursesRes.value) {
        setCourses(coursesRes.value);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 pb-20">
      {/* 1. SYSTEM TELEMETRY STRIP */}
      <div className="border-b border-white/[0.06] bg-[#090d16] px-4 py-2">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PostgreSQL Knowledge Vault Online
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="hidden sm:inline">31 Engineering Tracks Indexed</span>
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="hidden md:inline">1,249 Production Lessons</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <Flame className="h-3 w-3 fill-amber-400" />
              {stats.streakDays} Day Streak
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300 font-medium">{stats.studyHours}h Recorded</span>
          </div>
        </div>
      </div>

      {/* 2. HERO SECTION */}
      <section className="border-b border-white/[0.06] bg-[#080c14] py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-mono text-slate-300 mb-6">
              <Terminal className="h-3.5 w-3.5 text-sky-400" />
              <span>Production-Grade Developer Knowledge Platform</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Engineered Knowledge Paths for <br className="hidden sm:inline" />
              Senior Software Engineers.
            </h1>

            <p className="mt-5 text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl">
              Eliminate surface-level tutorials. Master distributed systems failure modes, cloud architecture trade-offs, Spring Boot microservices, and reactive frontends through structured curricula, interactive scenario drills, and active recall.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/courses"
                prefetch={true}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Browse 31 Course Tracks
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/interview"
                prefetch={true}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#0c1019] hover:bg-[#121826] hover:border-white/[0.2] px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 transition-colors"
              >
                <HelpCircle className="h-4 w-4 text-sky-400" />
                Interview Q&A Hub
              </Link>
              <Link
                href="/practice"
                prefetch={true}
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#0c1019] hover:bg-[#121826] hover:border-white/[0.2] px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 transition-colors"
              >
                <Zap className="h-4 w-4 text-emerald-400" />
                Scenario Practice
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. IN-PROGRESS LEARNING STRIP */}
      {stats.inProgressCourses && stats.inProgressCourses.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-10">
          <div className="rounded-xl border border-white/[0.08] bg-[#0a0e17] p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Active Curriculum Tracks</h2>
                <p className="text-xs text-slate-400 mt-0.5">Resume your recent technical modules</p>
              </div>
              <Link href="/courses" prefetch={true} className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1">
                All Tracks <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.inProgressCourses.map((track) => (
                <div
                  key={track.courseSlug}
                  className="rounded-lg border border-white/[0.06] bg-[#0d121f] p-4 flex flex-col justify-between hover:border-white/[0.14] transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-mono text-[11px] font-semibold text-sky-400 uppercase tracking-wide">
                        {track.category}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">{track.percentage}% Complete</span>
                    </div>
                    <h3 className="font-semibold text-white text-sm line-clamp-1">{track.title}</h3>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-300"
                        style={{ width: `${track.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">{track.totalLessons} Lessons</span>
                    <Link
                      href={`/courses/${track.courseSlug}`}
                      prefetch={true}
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      Resume <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. CURRICULUM DOMAIN MATRIX */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white tracking-tight">Engineering Domain Matrix</h2>
          <p className="text-xs text-slate-400 mt-0.5">Comprehensive specialization paths designed from core theory to production scale</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {DOMAIN_MATRIX.map((domain) => {
            const Icon = domain.icon;
            return (
              <div
                key={domain.id}
                className="rounded-xl border border-white/[0.08] bg-[#0a0e17] p-5 flex flex-col justify-between hover:border-white/[0.16] transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                      {domain.count}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-sm group-hover:text-sky-400 transition-colors">
                    {domain.title}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 mt-1">{domain.lessons}</p>

                  <div className="mt-4 space-y-1.5">
                    {domain.topics.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="h-1 w-1 rounded-full bg-slate-600" />
                        <span className="truncate">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-white/[0.06]">
                  <Link
                    href={`/courses/${domain.primarySlug}`}
                    prefetch={true}
                    className="flex items-center justify-between text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    <span>Inspect Track</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. INTERACTIVE ARCHITECTURAL SANDBOX / CODE SPEC */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-14">
        <div className="rounded-xl border border-white/[0.08] bg-[#0a0e17] overflow-hidden">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0c101a] gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                <h3 className="text-sm font-bold text-white">Production Architecture & Implementation Spec</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Real code from lesson guides solving high-concurrency enterprise problems</p>
            </div>

            {/* Tab switchers */}
            <div className="flex items-center gap-1 bg-[#06080e] p-1 rounded-lg border border-white/[0.06]">
              {CODE_SANDBOX_PREVIEWS.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setActiveCodeTab(idx)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeCodeTab === idx
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.tab}
                </button>
              ))}
            </div>
          </div>

          {/* Sandbox Content Area */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-3">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                {CODE_SANDBOX_PREVIEWS[activeCodeTab].domain}
              </span>
              <h4 className="text-base font-bold text-white">
                {CODE_SANDBOX_PREVIEWS[activeCodeTab].tab}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {CODE_SANDBOX_PREVIEWS[activeCodeTab].description}
              </p>

              <div className="pt-4 border-t border-white/[0.06] space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Tested against high concurrency</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Integrated with full lesson walkthrough</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Interactive Notion notes enabled</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 rounded-lg border border-white/[0.08] bg-[#070a12] p-4 font-mono text-xs overflow-x-auto text-slate-300 leading-relaxed">
              <pre className="text-sky-300/90 whitespace-pre">
                {CODE_SANDBOX_PREVIEWS[activeCodeTab].code}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAST PRODUCTION PORTALS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/interview"
            prefetch={true}
            className="rounded-xl border border-white/[0.08] bg-[#0a0e17] p-5 hover:border-white/[0.16] transition-colors group flex flex-col justify-between"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 mb-4">
                <HelpCircle className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-white text-sm group-hover:text-sky-400 transition-colors">
                Interview Q&A Hub
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                45+ technology tracks with 1,200+ senior engineering interview questions and production trade-offs.
              </p>
            </div>
            <span className="mt-4 text-xs font-semibold text-sky-400 flex items-center gap-1">
              Explore Questions <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          <Link
            href="/practice"
            prefetch={true}
            className="rounded-xl border border-white/[0.08] bg-[#0a0e17] p-5 hover:border-white/[0.16] transition-colors group flex flex-col justify-between"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4">
                <Zap className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                Scenario Practice Engine
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Real engineering failure scenarios with instant architectural evaluation and rationale.
              </p>
            </div>
            <span className="mt-4 text-xs font-semibold text-emerald-400 flex items-center gap-1">
              Take Scenarios <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          <Link
            href="/revision"
            prefetch={true}
            className="rounded-xl border border-white/[0.08] bg-[#0a0e17] p-5 hover:border-white/[0.16] transition-colors group flex flex-col justify-between"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
                <Bookmark className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">
                Spaced Recall Cards
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Active recall flashcards covering JVM memory, AWS VPC peering, and system design patterns.
              </p>
            </div>
            <span className="mt-4 text-xs font-semibold text-amber-400 flex items-center gap-1">
              Start Revision <ArrowRight className="h-3 w-3" />
            </span>
          </Link>

          <Link
            href="/roadmaps"
            prefetch={true}
            className="rounded-xl border border-white/[0.08] bg-[#0a0e17] p-5 hover:border-white/[0.16] transition-colors group flex flex-col justify-between"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-4">
                <Layers className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-white text-sm group-hover:text-purple-400 transition-colors">
                Career Roadmaps
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Step-by-step career milestones for Full-Stack, Backend, AI Engineer, and Cloud & DevOps.
              </p>
            </div>
            <span className="mt-4 text-xs font-semibold text-purple-400 flex items-center gap-1">
              View Roadmaps <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
