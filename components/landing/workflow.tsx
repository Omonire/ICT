'use client';

import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/ui/reveal';

const STEPS = [
  {
    n: '01',
    title: 'Import candidates',
    body: 'CSV upload with column checks, duplicate detection and a review step before anything is committed.',
  },
  {
    n: '02',
    title: 'Configure the exam',
    body: 'Define halls, capacities and Morning / Afternoon sessions across the exam window.',
  },
  {
    n: '03',
    title: 'Generate & preview',
    body: 'The engine packs candidates by career line into the earliest available session and hall.',
  },
  {
    n: '04',
    title: 'Confirm the schedule',
    body: 'Overflow is reported, never hidden. Confirm only when every candidate has a seat.',
  },
  {
    n: '05',
    title: 'Print attendance sheets',
    body: 'One click produces clean, exam-ready PDFs per hall and session for invigilators.',
  },
];

export default function Workflow() {
  return (
    <section id="workflow" className="bg-white py-24 md:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
        <Reveal direction="left">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <span className="font-mono text-[11px] tracking-[0.35em] text-gold-600 uppercase">Workflow</span>
            <p className="mt-6 font-mono text-[clamp(4.5rem,10vw,7rem)] font-bold leading-none tracking-tight text-slate-900">
              01 <span className="text-slate-900/15">/ 05</span>
            </p>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 md:text-[42px] md:leading-[1.1]">
              From raw CSV to a printed sheet in five steps
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-400">
              No spreadsheets circulating by email. No double-booked halls. One
              deterministic pipeline your team can trust on exam morning.
            </p>
            <div className="mt-8">
              <div className="h-px w-full bg-slate-100">
                <div className="h-px w-1/5 bg-purple-500 transition-all duration-1000" />
              </div>
              <p className="mt-2.5 font-mono text-[10px] tracking-[0.25em] text-slate-400 uppercase">
                Step 1 of 5
              </p>
            </div>
            <div className="mt-8 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 transition-all duration-300 hover:border-purple-200 hover:shadow-md">
              <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-gold-600" />
              <p className="text-[12.5px] leading-relaxed text-slate-400">
                Role-based access, JWT sessions, hashed passwords and a full audit log on every action.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120} direction="right">
              <div
                className={cn(
                  'group relative rounded-2xl border p-6 transition-all duration-300 md:p-7',
                  i === 0
                    ? 'border-gold-200 bg-slate-100/50'
                    : 'border-slate-200 bg-slate-50/30 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                )}
              >
                <div
                  className={cn(
                    'pointer-events-none absolute inset-y-4 left-0 w-0.5 rounded-full transition-all duration-300',
                    i === 0 ? 'bg-purple-500' : 'bg-transparent'
                  )}
                />
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-5">
                    <span className="flex flex-col items-start gap-1.5 pt-0.5">
                      <span
                        className={cn(
                          'font-mono text-[12px] transition-colors duration-300',
                          i === 0 ? 'text-gold-600' : 'text-slate-400'
                        )}
                      >
                        {s.n}
                      </span>
                    </span>
                    <div>
                      <h3
                        className={cn(
                          'text-[17px] font-semibold transition-colors duration-300',
                          i === 0 ? 'text-slate-900' : 'text-slate-700'
                        )}
                      >
                        {s.title}
                      </h3>
                      <p
                        className={cn(
                          'mt-2 max-w-lg text-[13.5px] leading-relaxed transition-colors duration-300',
                          i === 0 ? 'text-slate-700' : 'text-slate-400'
                        )}
                      >
                        {s.body}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight
                    className={cn(
                      'h-4.5 w-4.5 shrink-0 transition-all duration-300',
                      i === 0 ? 'text-gold-600 opacity-100' : 'text-slate-400 opacity-0 group-hover:opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
                    )}
                  />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
