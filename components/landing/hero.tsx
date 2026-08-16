'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Reveal } from '@/components/ui/reveal';

const FEATURES = [
  'No double bookings',
  'Capacity enforced',
  'Full audit log',
  'Print-ready sheets',
];

export default function Hero() {
  return (
    <section className="relative bg-white pb-20 pt-32 md:pb-28 md:pt-44 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-purple-100/40 blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gold-100/40 blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>
      <div className="mx-auto max-w-7xl px-6 relative">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal delay={100}>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-[12px] font-medium text-gold-600 animate-bounce-in">
              CBT Examination Scheduling — Uniben ICT Center
            </span>
          </Reveal>

          <Reveal delay={200}>
            <h1 className="mt-8 text-[clamp(2.4rem,5.5vw,4.2rem)] font-bold leading-[1.08] tracking-tight text-slate-900">
              Every candidate.
              <br />
              One seat.
              <br />
              <span className="text-gold-600">Zero clashes.</span>
            </h1>
          </Reveal>

          <Reveal delay={350}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-400 md:text-[17px]">
              ExamFlow imports your candidates, runs a conflict-free scheduling
              engine across every hall and session, and hands invigilators
              printable attendance sheets — in seconds.
            </p>
          </Reveal>

          <Reveal delay={500}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-purple-600 px-7 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:bg-purple-500 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5 btn-press"
              >
                Open the console
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href="#platform"
                className="inline-flex h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-7 text-sm font-medium text-slate-700 transition-all duration-300 hover:bg-slate-100 hover:border-slate-300 hover:-translate-y-0.5 btn-press"
              >
                See how it works
              </a>
            </div>
          </Reveal>

          <Reveal delay={650}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {FEATURES.map((t, i) => (
                <span key={t} className="flex items-center gap-2 text-[13px] text-slate-400">
                  <CheckCircle2 className="h-4 w-4 text-gold-400" style={{ animationDelay: `${i * 100}ms` }} />
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
