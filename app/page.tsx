'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import {
  ArrowRight,
  CalendarCheck2,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  ListFilter,
  MapPin,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import ScrollVideo from '@/components/landing/scroll-video';
import LandingReveal from '@/components/landing/landing-reveal';
import { Reveal } from '@/components/landing/reveal';

const FEATURES = [
  {
    icon: <Upload className="h-5 w-5" />,
    title: 'Bulk candidate import',
    body: 'Drop a CSV with thousands of candidates. Validation catches bad rows, duplicates and missing fields before anything touches the database.',
  },
  {
    icon: <CalendarCheck2 className="h-5 w-5" />,
    title: 'Automatic scheduling',
    body: 'A constraint engine seats every candidate across halls, sessions and dates. No two candidates share a seat. Capacity is never exceeded.',
  },
  {
    icon: <MapPin className="h-5 w-5" />,
    title: 'Hall & seat maps',
    body: 'Inspect any hall down to the individual seat. See exactly who sits where, on which date, at which time.',
  },
  {
    icon: <FileSpreadsheet className="h-5 w-5" />,
    title: 'Printable attendance sheets',
    body: 'Exam-ready PDF and HTML attendance sheets per hall and session, generated in one click. Print, staple, invigilate.',
  },
  {
    icon: <ListFilter className="h-5 w-5" />,
    title: 'Search & filters',
    body: 'Find any candidate by ID, name, hall or session. Filter, sort and page through thousands of records without breaking a sweat.',
  },
  {
    icon: <Gauge className="h-5 w-5" />,
    title: 'Operations analytics',
    body: 'Live utilization, completion and per-group breakdowns so you always know how the exam cycle is tracking.',
  },
];

const STEPS = [
  { n: '01', title: 'Import candidates', body: 'CSV upload with column checks, duplicate detection and a review step before anything is committed.' },
  { n: '02', title: 'Configure the exam', body: 'Define halls, capacities and Morning / Afternoon sessions across the exam window.' },
  { n: '03', title: 'Generate & preview', body: 'The engine packs candidates by career line into the earliest available session and hall.' },
  { n: '04', title: 'Confirm the schedule', body: 'Overflow is reported, not hidden. Confirm only when every candidate has a seat.' },
  { n: '05', title: 'Print attendance sheets', body: 'One click produces clean, exam-ready PDFs per hall and session for invigilators.' },
];

const STATS = [
  { value: '10k+', label: 'Candidates per semester' },
  { value: '<5s', label: 'To generate a full schedule' },
  { value: '0', label: 'Seat conflicts permitted' },
  { value: '1', label: 'Click to print attendance' },
];

function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <CalendarCheck2 className="h-4.5 w-4.5" />
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-slate-900">ExamFlow</span>
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-slate-600 md:flex">
          <a href="#platform" className="hover:text-slate-900">Platform</a>
          <a href="#workflow" className="hover:text-slate-900">Workflow</a>
          <a href="#demo" className="hover:text-slate-900">Live demo</a>
        </nav>
        <Link
          href="/login"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <LayoutDashboard className="h-4 w-4" />
          Sign in
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('[data-hero]', { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(13,148,136,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(13,148,136,0.06) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-32 text-center md:pt-40">
        <div data-hero className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border-[0.5px] border-brand-200 bg-brand-50 px-3 py-1 text-[12px] font-medium text-brand-700">
          <Sparkles className="h-3.5 w-3.5" />
          Built for university operations teams
        </div>
        <h1 data-hero className="mx-auto max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 md:text-6xl">
          Run thousands of CBT exams,
          <span className="text-brand-600"> without a single clash.</span>
        </h1>
        <p data-hero className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
          ExamFlow imports your candidates, allocates halls and seats, and produces
          printable attendance sheets — the reliable backbone for computer-based
          testing at scale.
        </p>
        <div data-hero className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Open the demo <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#demo"
            className="inline-flex h-11 items-center gap-2 rounded-lg border-[0.5px] border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Watch it schedule
          </a>
        </div>
        <div data-hero className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-xl border-[0.5px] border-slate-200 bg-slate-200 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white px-6 py-5 text-center">
              <p className="font-mono text-xl font-semibold text-brand-700">{s.value}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="platform" className="mx-auto max-w-7xl px-6 py-24">
      <Reveal className="mb-12 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-600">Platform</span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Everything the exam room needs</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
          A calm, focused operations console — from candidate lists to the moment
          invigilators print the attendance sheets.
        </p>
      </Reveal>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Reveal key={f.title}>
            <div className="group h-full rounded-[12px] border-[0.5px] border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-hover:bg-brand-50 group-hover:text-brand-700">
                {f.icon}
              </div>
              <h3 className="text-[15px] font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="bg-slate-950 py-24 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-14 text-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-brand-400">Workflow</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">From CSV to printed sheet in five steps</h2>
        </Reveal>
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.n}>
              <div className="relative">
                <span className="font-mono text-sm text-brand-400">{s.n}</span>
                <h3 className="mt-2 text-[15px] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{s.body}</p>
                {i < STEPS.length - 1 && (
                  <div className="absolute -right-5 top-1 hidden text-slate-700 lg:block">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-16 flex flex-wrap items-center justify-center gap-3 text-slate-300">
          <ShieldCheck className="h-4 w-4 text-brand-400" />
          <span className="text-sm">Role-based access, JWT sessions, hashed passwords, and a full audit log on every action.</span>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t-[0.5px] border-slate-200 bg-white py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
            <CalendarCheck2 className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-slate-900">ExamFlow</span>
          <span className="text-[12px] text-slate-400">— CBT examination scheduling</span>
        </div>
        <div className="flex items-center gap-6 text-[12px] text-slate-500">
          <a href="#platform" className="hover:text-slate-800">Platform</a>
          <a href="#workflow" className="hover:text-slate-800">Workflow</a>
          <Link href="/login" className="hover:text-slate-800">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <main className="bg-[#f8fafc]">
      <Navbar />
      <Hero />
      <div id="demo" className="scroll-mt-0">
        <ScrollVideo />
      </div>
      <LandingReveal>
        <Features />
        <Workflow />
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <Reveal>
            <Users className="mx-auto h-10 w-10 text-brand-600" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Ready for the next exam cycle?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
              Sign in with the demo account and explore a fully seeded environment —
              500+ candidates, five halls, twelve sessions, live attendance sheets.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Open the console <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </section>
        <Footer />
      </LandingReveal>
    </main>
  );
}
