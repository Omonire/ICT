'use client';

import {
  CalendarCheck2,
  FileSpreadsheet,
  Gauge,
  MapPin,
  Search,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/ui/reveal';

function ImportVisual() {
  const rows = [
    { name: 'ADEYEMI, Kehinde', prog: 'Computer Eng.', ok: true },
    { name: 'NWOSU, Chiamaka', prog: 'Mechatronics', ok: true },
    { name: 'OYELOWO, Tunde', prog: 'Information Tech', ok: true },
    { name: 'MUSA, Amina B.', prog: 'Biomedical Eng.', ok: false },
  ];
  return (
    <div className="mt-8 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">candidates.csv</span>
        <span className="font-mono text-[10px] text-gold-600">520 rows · valid</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.name}
          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/30 px-3 py-2 animate-fade-in-up"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                r.ok ? 'bg-gold-100 text-gold-600' : 'bg-amber-400/15 text-amber-300'
              )}
            >
              {r.ok ? '✓' : '!'}
            </span>
            <span className="text-[12px] font-medium text-slate-700">{r.name}</span>
          </div>
          <span className="text-[11px] text-slate-400">{r.prog}</span>
        </div>
      ))}
    </div>
  );
}

function SeatGridVisual() {
  const cells = Array.from({ length: 24 });
  const filled = [0, 1, 2, 3, 4, 5, 7, 8, 9, 12, 13, 14, 16, 17, 18, 19];
  return (
    <div className="mt-8">
      <div className="grid grid-cols-8 gap-1.5">
        {cells.map((_, i) => {
          const on = filled.includes(i);
          return (
            <div
              key={i}
              className={cn(
                'aspect-square rounded-md border transition-all duration-300',
                on
                  ? 'border-gold-200 bg-gold-100 hover:bg-gold-200 hover:scale-110'
                  : 'border-slate-200 bg-slate-50/30 hover:bg-slate-100'
              )}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[11px] text-slate-400">Hall A · session 2</span>
        <span className="flex items-center gap-1.5 rounded-full border border-gold-200 bg-gold-50 px-2.5 py-1 font-mono text-[10px] text-gold-600">
          <span className="h-1 w-1 rounded-full bg-gold-400 animate-pulse" /> 0 conflicts
        </span>
      </div>
    </div>
  );
}

function SeatMapVisual() {
  return (
    <div className="mt-8 space-y-1.5">
      {['A-001', 'A-002', 'A-003', 'A-004', 'A-005'].map((seat, i) => (
        <div
          key={seat}
          className={cn(
            'flex items-center justify-between rounded-lg border px-3 py-2 font-mono text-[11px] transition-all duration-300 hover:translate-x-1',
            i === 2
              ? 'border-gold-200 bg-gold-50 text-gold-700'
              : 'border-slate-100 bg-slate-50/30 text-slate-400'
          )}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <span>{seat}</span>
          <span className={i === 2 ? 'text-gold-600' : 'text-slate-400'}>{i === 2 ? 'ADEYEMI, K.' : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function SheetVisual() {
  const rows = Array.from({ length: 6 });
  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-3 py-2">
        <span className="text-[10px] font-semibold text-slate-700">HALL A · ATTENDANCE</span>
        <FileSpreadsheet className="h-3.5 w-3.5 text-gold-600" />
      </div>
      <div className="space-y-1.5 p-3">
        {rows.map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-1.5 animate-shimmer" style={{ animationDelay: `${i * 100}ms` }}>
            <span className="font-mono text-[10px] text-slate-400">A-00{i + 1}</span>
            <span className="h-2 w-10 rounded bg-slate-100" />
            <span className="h-2 w-14 rounded bg-slate-50" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsVisual() {
  const bars = [34, 52, 40, 68, 58, 82, 72, 96];
  return (
    <div className="mt-8 flex items-end justify-between gap-2">
      {bars.map((h, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className="w-full rounded-md bg-purple-500 transition-all duration-500 hover:bg-purple-400"
            style={{ height: h, animationDelay: `${i * 80}ms` }}
          />
        </div>
      ))}
      <div className="ml-2 flex flex-col gap-1.5">
        <span className="font-mono text-[10px] text-slate-400">96%</span>
        <span className="text-[10px] text-slate-400">util</span>
      </div>
    </div>
  );
}

function SearchVisual() {
  return (
    <div className="mt-8 w-full">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 transition-all duration-300 hover:border-purple-300 hover:shadow-md">
        <Search className="h-4 w-4 text-slate-400" />
        <span className="font-mono text-[12px] text-slate-700">CAN-00231</span>
        <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-gold-600">
          <span className="h-1 w-1 rounded-full bg-gold-400 animate-pulse" /> scheduled · Hall B
        </span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: <Upload className="h-4.5 w-4.5" />,
    title: 'Bulk CSV import',
    body: 'Drop a spreadsheet of thousands of candidates. Column checks, duplicate detection and a review step before anything touches the database.',
    visual: <ImportVisual />,
    span: 'lg:col-span-3',
  },
  {
    icon: <CalendarCheck2 className="h-4.5 w-4.5" />,
    title: 'Auto-scheduling engine',
    body: 'A constraint engine packs candidates by career line into the earliest available session and hall — no two candidates share a seat, ever.',
    visual: <SeatGridVisual />,
    span: 'lg:col-span-3',
  },
  {
    icon: <MapPin className="h-4.5 w-4.5" />,
    title: 'Hall & seat maps',
    body: 'Zoom into any hall down to the individual seat and see exactly who sits where, on which date, at which time.',
    visual: <SeatMapVisual />,
    span: 'lg:col-span-2',
  },
  {
    icon: <FileSpreadsheet className="h-4.5 w-4.5" />,
    title: 'Attendance sheets',
    body: 'Exam-ready PDF and HTML sheets per hall and session, generated in one click. Print, staple, invigilate.',
    visual: <SheetVisual />,
    span: 'lg:col-span-2',
  },
  {
    icon: <Gauge className="h-4.5 w-4.5" />,
    title: 'Operations analytics',
    body: 'Live utilization, completion and per-programme breakdowns so the exam cycle never surprises you.',
    visual: <AnalyticsVisual />,
    span: 'lg:col-span-2',
  },
];

export default function Bento() {
  return (
    <section id="platform" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="mb-14 max-w-2xl">
            <span className="font-mono text-[11px] tracking-[0.35em] text-gold-600 uppercase">The platform</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-[42px] md:leading-[1.1]">
              Everything the exam room needs, <span className="text-gold-600">in one console</span>
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">
              From the first candidate row to the moment invigilators staple the
              attendance sheets — one calm, focused operations console.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-4 lg:grid-cols-6">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 100} direction="up" className={f.span}>
              <div className="h-full rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 md:p-7">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-gold-600 transition-all duration-300 hover:scale-110 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600">
                  {f.icon}
                </div>
                <h3 className="mt-5 text-[16px] font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-400">{f.body}</p>
                {f.visual}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={500}>
          <div className="mt-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition-all duration-300 hover:border-slate-300 hover:shadow-lg md:p-7">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
                <div className="lg:w-1/2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-gold-600 transition-all duration-300 hover:scale-110 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600">
                    <Search className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mt-5 text-[16px] font-semibold text-slate-900">Find anyone, instantly</h3>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-400">
                    Search by candidate ID, name, hall or session. Filter, sort and page
                    through thousands of records without breaking a sweat.
                  </p>
                </div>
                <div className="flex-1">
                  <SearchVisual />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
