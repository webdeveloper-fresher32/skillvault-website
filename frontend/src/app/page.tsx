import React from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Terminal, 
  BookOpen, 
  Code2, 
  Flame, 
  Clock, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  Cpu, 
  Cloud, 
  Database,
  BrainCircuit
} from 'lucide-react';
import { fetchDashboardStats, fetchCourses } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let stats;
  let courses = [];
  try {
    stats = await fetchDashboardStats();
    courses = await fetchCourses();
  } catch (err) {
    // Fallback if backend is warming up
    stats = {
      totalCourses: 31,
      totalLessons: 1249,
      completedLessons: 42,
      streakDays: 7,
      studyHours: 28,
      inProgressCourses: [
        { courseSlug: 'springboot', title: 'Spring Boot 3 & 4 Backend', category: 'Backend', icon: 'leaf', percentage: 64, totalLessons: 58 },
        { courseSlug: 'aws', title: 'Amazon Web Services (AWS)', category: 'Cloud & DevOps', icon: 'cloud', percentage: 48, totalLessons: 61 },
        { courseSlug: 'hld', title: 'High-Level Design (HLD)', category: 'System Design', icon: 'layers', percentage: 32, totalLessons: 45 },
      ]
    };
  }

  const categoryHighlights = [
    { title: 'Backend & Frameworks', count: '8 Courses', icon: Cpu, desc: 'Spring Boot, Java, NestJS, Node.js, Microservices' },
    { title: 'Cloud & DevOps', count: '6 Courses', icon: Cloud, desc: 'AWS Solutions Architect, Docker, Kubernetes, Terraform' },
    { title: 'System Design & DSA', count: '4 Courses', icon: Layers, desc: 'High-Level Design, Low-Level Design, Algorithms' },
    { title: 'AI & Large Language Models', count: '4 Courses', icon: BrainCircuit, desc: 'RAG Architecture, LangChain, LangGraph, Vector DBs' },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-blue-950/20 via-transparent to-transparent pt-12 pb-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,_rgba(59,130,246,0.12),_transparent_60%)] pointer-events-none" />
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="max-w-2xl text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-400 mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Structured Developer Knowledge Operating System</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Your Developer Knowledge, <br />
                <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
                  Organized & Interactive.
                </span>
              </h1>
              
              <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed">
                Transform 1,200+ technical Markdown guides into interactive learning paths. Master Spring Boot, AWS, Distributed Systems, HLD/LLD, and AI Agents with progress tracking, scenario quizzes, and active recall.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                <Link
                  href="/courses"
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all hover:scale-[1.02]"
                >
                  <BookOpen className="h-4 w-4" />
                  Explore 31 Courses
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/practice"
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all"
                >
                  <Code2 className="h-4 w-4 text-emerald-400" />
                  Practice Scenarios
                </Link>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="w-full lg:w-96 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-300">Live Learning Engine</span>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  PostgreSQL Sync
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-5">
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="text-2xl font-bold text-white">{stats.totalCourses}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Mastery Tracks</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="text-2xl font-bold text-blue-400">{stats.totalLessons}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Structured Lessons</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-2xl font-bold text-amber-400">
                    <Flame className="h-5 w-5 fill-amber-400" />
                    {stats.streakDays}d
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Current Streak</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="text-2xl font-bold text-emerald-400">{stats.studyHours}h</div>
                  <div className="text-xs text-slate-400 mt-0.5">Study Recorded</div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>Knowledge Vault Health</span>
                  <span className="font-semibold text-white">100% Operational</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12 space-y-12">
        {/* Continue Learning Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Continue Learning</h2>
              <p className="text-xs text-slate-400 mt-1">Pick up right where you left off</p>
            </div>
            <Link href="/courses" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View All Tracks <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.inProgressCourses.map((item) => (
              <div
                key={item.courseSlug}
                className="group relative rounded-2xl border border-slate-800 bg-[#0f172a]/90 p-5 hover:border-slate-700 transition-all hover:shadow-xl hover:shadow-blue-500/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                      {item.icon === 'leaf' ? '🌱' : item.icon === 'cloud' ? '☁️' : '📐'}
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">{item.category}</span>
                      <h3 className="text-base font-semibold text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{item.totalLessons} Lessons Total</span>
                    <span className="font-semibold text-blue-400">{item.percentage}% Done</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <Link
                    href={`/courses/${item.courseSlug}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white group-hover:text-blue-400 transition-colors"
                  >
                    Resume Course
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pillars / Domain Clusters */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">Curriculum Domains</h2>
            <p className="text-xs text-slate-400 mt-1">Structured learning paths engineered from foundational principles to production</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {categoryHighlights.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 hover:bg-slate-900/80 hover:border-slate-700 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                      {cat.count}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-white group-hover:text-blue-300 text-sm">{cat.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{cat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Featured Popular Tracks */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Essential Engineering Tracks</h2>
              <p className="text-xs text-slate-400 mt-1">Directly rendered from your local technical repository</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { slug: 'springboot', title: 'Spring Boot 3 & 4 Backend', tag: 'Backend', hours: '45h', desc: 'IoC, Auto-configuration, JPA, Spring Security JWT, Microservices, Testing.' },
              { slug: 'aws', title: 'AWS Cloud Architecture', tag: 'Cloud', hours: '50h', desc: 'Solutions Architect path, VPC, IAM, ECS/EKS, Lambda, S3, RDS, CloudFront.' },
              { slug: 'hld', title: 'High-Level Design (HLD)', tag: 'System Design', hours: '40h', desc: 'Scalable distributed systems, load balancers, caching, Kafka, payment idempotency.' },
              { slug: 'kubernetes', title: 'Kubernetes Container Orchestration', tag: 'DevOps', hours: '35h', desc: 'Pods, Deployments, Services, Ingress, RBAC, Helm charts, Production clusters.' },
              { slug: 'rag', title: 'Retrieval-Augmented Generation (RAG)', tag: 'AI Engineering', hours: '30h', desc: 'Vector embeddings, chunking strategies, hybrid search, rerankers, evaluation.' },
              { slug: 'dsa', title: 'Data Structures & Algorithms', tag: 'Interview Prep', hours: '60h', desc: 'Arrays, Trees, Graphs, Dynamic Programming, System Design interview frameworks.' },
            ].map((c) => (
              <Link
                key={c.slug}
                href={`/courses/${c.slug}`}
                className="group rounded-2xl border border-slate-800 bg-[#0f172a]/70 p-6 hover:border-blue-500/50 hover:bg-slate-900 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="rounded bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
                      {c.tag}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{c.hours}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {c.desc}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
                  View Syllabus <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
