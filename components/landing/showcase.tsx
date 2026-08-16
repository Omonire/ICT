'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CalendarCheck2, CheckCircle2, FileSpreadsheet, LayoutDashboard, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger);

const CANDIDATES = [
  { id: 'CAN-00231', name: 'ADEYEMI, Kehinde', prog: 'Computer Eng.', status: 'Scheduled', seat: 'A-014' },
  { id: 'CAN-00187', name: 'NWOSU, Chiamaka', prog: 'Mechatronics', status: 'Scheduled', seat: 'B-032' },
  { id: 'CAN-00302', name: 'OYELOWO, Tunde', prog: 'Information Tech', status: 'Scheduled', seat: 'A-076' },
  { id: 'CAN-00115', name: 'MUSA, Amina B.', prog: 'Biomedical Eng.', status: 'Scheduled', seat: 'C-011' },
  { id: 'CAN-00258', name: 'EZE, David O.', prog: 'Systems Eng.', status: 'Scheduled', seat: 'B-088' },
];

function ConsoleMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f1c] shadow-2xl shadow-black/60">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-gold-400/70" />
        <span className="ml-3 font-mono text-[10px] tracking-widest text-slate-500 uppercase">examflow / schedule</span>
      </div>
      <div className="flex">
        <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-white/10 p-3 sm:flex">
          {[
            { icon: <LayoutDashboard className="h-3.5 w-3.5" />, label: 'Overview', active: false },
            { icon: <Users className="h-3.5 w-3.5" />, label: 'Candidates', active: true },
            { icon: <FileSpreadsheet className="h-3.5 w-3.5" />, label: 'Attendance', active: false },
          ].map((i) => (
            <div
              key={i.label}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium',
                i.active ? 'bg-purple-500/15 text-gold-200' : 'text-slate-500'
              )}
            >
              {i.icon}
              {i.label}
            </div>
          ))}
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="font-mono text-[10px] text-slate-500">SCHEDULE STATUS</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-gold-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">516 / 516 seated</p>
          </div>
        </div>
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-white">Candidates</p>
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-400">
              {CANDIDATES.length} shown
            </span>
          </div>
          <div className="space-y-1.5">
            {CANDIDATES.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="hidden font-mono text-[10px] text-slate-500 sm:inline">{c.id}</span>
                  <span className="truncate text-[12px] font-medium text-slate-200">{c.name}</span>
                  <span className="hidden text-[11px] text-slate-500 lg:inline">{c.prog}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[10px] text-gold-300">{c.seat}</span>
                  <span className="rounded-full border border-gold-400/20 bg-gold-400/10 px-2 py-0.5 text-[9px] font-medium text-gold-300">
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const WORDS = ['Import.', 'Schedule.', 'Print.'];

export default function Showcase() {
  const root = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const pin = pinRef.current;
    if (!el || !pin) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          pin: true,
          anticipatePin: 1,
        },
      });

      tl.fromTo(
        '[data-vt-frame]',
        { clipPath: 'inset(38% 28% 38% 28% round 26px)', scale: 1.5 },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', scale: 1, duration: 0.48 },
        0
      )
        .fromTo(
          '[data-vt-word]',
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.13, stagger: 0.07, ease: 'back.out(2)', overwrite: true },
          0.14
        )
        .fromTo(
          '[data-vt-dot]',
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.12, stagger: 0.07, ease: 'back.out(2.4)' },
          0.16
        )
        .to('[data-vt-word], [data-vt-dot]', { opacity: 0, duration: 0.1 }, 0.44)
        .to('[data-vt-frame]', { clipPath: 'inset(5% 5% 5% 5% round 20px)', scale: 0.985, duration: 0.22 }, 0.76)
        .fromTo(
          '[data-vt-caption]',
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' },
          0.82
        );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} id="demo" className="relative scroll-mt-20 overflow-hidden bg-[#04070e]">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[140px]" />
      <div className="mx-auto max-w-7xl px-6 pt-24 md:pt-28">
        <span className="font-mono text-[11px] tracking-[0.35em] text-gold-300 uppercase" data-reveal>
          The console
        </span>
        <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-white md:text-[42px] md:leading-[1.1]" data-reveal>
          A calm command center for a chaotic week
        </h2>
      </div>

      <div ref={pinRef} className="relative mt-16 h-[320vh]">
        <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden">
          <div className="relative w-full max-w-5xl px-6" data-vt-frame style={{ clipPath: 'inset(38% 28% 38% 28% round 26px)' }}>
            <div className="relative">
              <ConsoleMock />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-[14%] flex justify-center px-6 text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[clamp(1.9rem,4.5vw,3.4rem)] font-bold tracking-tight text-white">
              {WORDS.map((w, i) => (
                <span key={w} className="flex items-center gap-6">
                  {i > 0 && <span data-vt-dot className="h-2.5 w-2.5 rounded-full bg-gold-300" />}
                  <span data-vt-word>{w}</span>
                </span>
              ))}
            </div>
          </div>

          <div data-vt-caption className="pointer-events-none absolute inset-x-0 bottom-8 flex items-center justify-between px-6 font-mono text-[10px] uppercase opacity-0" style={{ opacity: 0 }}>
            <span className="tracking-[0.3em] text-slate-500">ExamFlow / command center</span>
            <span className="tracking-[0.3em] text-gold-300">516 candidates · 5 halls · 0 conflicts</span>
          </div>
        </div>
      </div>
    </section>
  );
}
