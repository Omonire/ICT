'use client';

import Link from 'next/link';
import { ArrowRight, CalendarCheck2 } from 'lucide-react';
import { Reveal } from '@/components/ui/reveal';

export default function CtaFooter() {
  return (
    <>
      <section className="bg-white py-28 md:py-36 overflow-hidden">
        <div className="mx-auto max-w-3xl px-6 text-center relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-purple-50 blur-3xl animate-pulse" />
          </div>
          <Reveal>
            <span className="font-mono text-[11px] tracking-[0.35em] text-gold-600 uppercase relative">
              Ready when you are
            </span>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-6 text-[clamp(2.2rem,5.5vw,4rem)] font-bold leading-[1.08] tracking-tight text-slate-900 relative">
              Ship the next exam cycle
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-slate-400 relative">
              Sign in with the demo account and explore a fully seeded environment —
              516 candidates, five halls, twelve sessions, live attendance sheets.
            </p>
          </Reveal>
          <Reveal delay={350}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5 relative">
              <Link
                href="/login"
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-purple-600 px-7 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:bg-purple-500 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5 btn-press"
              >
                Open the live demo
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-7 text-sm font-medium text-slate-700 transition-all duration-300 hover:bg-slate-100 hover:border-slate-300 hover:-translate-y-0.5 btn-press"
              >
                Sign in
              </Link>
            </div>
          </Reveal>
          <Reveal delay={500}>
            <p className="mt-8 font-mono text-[10px] tracking-[0.25em] text-slate-400 uppercase relative">
              demo@examflow.local · demo pass — ask your administrator
            </p>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white transition-transform duration-300 hover:scale-110">
              <CalendarCheck2 className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-slate-900">
              Exam<span className="text-gold-600">Flow</span>
            </span>
            <span className="ml-1 text-[11.5px] text-slate-400">— CBT examination scheduling</span>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-slate-400">
            <a href="#platform" className="transition-all duration-200 hover:text-slate-900 hover:-translate-y-0.5">
              Platform
            </a>
            <a href="#workflow" className="transition-all duration-200 hover:text-slate-900 hover:-translate-y-0.5">
              Workflow
            </a>
            <a href="#stories" className="transition-all duration-200 hover:text-slate-900 hover:-translate-y-0.5">
              Stories
            </a>
            <Link href="/login" className="transition-all duration-200 hover:text-slate-900 hover:-translate-y-0.5">
              Sign in
            </Link>
          </div>
          <p className="font-mono text-[11px] text-slate-400">© 2026 ExamFlow</p>
        </div>
        <p
          aria-hidden
          className="-mb-[0.32em] select-none text-center text-[clamp(4rem,16vw,13rem)] font-bold leading-none tracking-tight text-slate-100"
        >
          ExamFlow
        </p>
      </footer>
    </>
  );
}
