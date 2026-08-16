'use client';

import { useEffect, useRef, useState } from 'react';
import { signalBootReady } from '@/lib/boot';

const BOOT_LINES = [
  { text: 'examflow.control — v1.0.0', kind: 'sys', at: 200 },
  { text: 'connecting to database…', kind: 'cmd', at: 520 },
  { text: 'database connected · postgres', kind: 'ok', at: 820 },
  { text: 'loading halls · 5', kind: 'cmd', at: 1080 },
  { text: 'loading sessions · 12', kind: 'cmd', at: 1300 },
  { text: 'loading candidates · 520', kind: 'cmd', at: 1520 },
  { text: 'all systems nominal', kind: 'ok', at: 1780 },
];

export default function Preloader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(0);
  const [pct, setPct] = useState(0);
  const [hidden, setHidden] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';

    let shown = 0;
    const lineTimers = BOOT_LINES.map((l) =>
      window.setTimeout(() => {
        shown += 1;
        setLines(shown);
      }, l.at)
    );

    const start = performance.now();
    const DURATION = 2100;
    let raf = 0;

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION);
      const eased = 1 - Math.pow(1 - p, 2);
      const current = Math.round(eased * 100);
      setPct(current);

      if (current >= 100 && shown >= BOOT_LINES.length && !doneRef.current) {
        doneRef.current = true;
        document.body.style.overflow = '';
        window.setTimeout(() => {
          setHidden(true);
          signalBootReady();
        }, 400);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      lineTimers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      document.body.style.overflow = '';
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-white transition-opacity duration-500"
      style={{ opacity: pct >= 100 ? 0 : 1 }}
      aria-hidden
    >
      <div className="w-full max-w-sm px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div>
            <p className="text-[16px] font-bold tracking-tight text-slate-900">
              Exam<span className="text-gold-600">Flow</span>
            </p>
            <p className="font-mono text-[9.5px] tracking-[0.3em] text-slate-400 uppercase">CBT Examination Control</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 font-mono text-[11.5px] leading-[1.9]">
          {BOOT_LINES.slice(0, lines).map((l, i) => (
            <p
              key={i}
              className={
                l.kind === 'ok' ? 'text-gold-600' : l.kind === 'sys' ? 'text-slate-400' : 'text-slate-700'
              }
            >
              {l.kind === 'cmd' && <span className="mr-1.5 text-gold-400">$</span>}
              {l.text}
            </p>
          ))}
          <p className="text-gold-600">
            <span className="mr-1.5 text-gold-400">$</span>
            <span className="inline-block h-3.5 w-2 translate-y-0.5 animate-pulse bg-gold-400" />
          </p>
        </div>

        <div className="mt-6">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full w-full origin-left rounded-full bg-purple-600 transition-none"
              style={{ transform: `scaleX(${pct / 100})` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.25em] text-slate-400 uppercase">initializing exam console</p>
            <p className="font-mono text-sm font-bold text-slate-900">
              {String(pct).padStart(3, '0')}
              <span className="text-gold-600">%</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
