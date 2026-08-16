'use client';

import { Quote } from 'lucide-react';
import { Reveal } from '@/components/ui/reveal';

const STORIES = [
  {
    quote:
      'We scheduled 12,000 candidates across six campuses in one afternoon. The first year we did this by hand it took our team three weeks.',
    name: 'Dr. Funmilayo Adebayo',
    role: 'Deputy Registrar, Exams & Records',
    initials: 'FA',
  },
  {
    quote:
      'The overflow report is the killer feature. Instead of discovering a full hall at 7am, we know exactly who is unseated weeks before the exam.',
    name: 'Engr. Tunde Oyelowo',
    role: 'ICT Director',
    initials: 'TO',
  },
  {
    quote:
      'Invigilators love the printed sheets. One click, a PDF per hall, zero formatting fights. It just works on exam day.',
    name: 'Chiamaka Nwosu',
    role: 'Examination Officer',
    initials: 'CN',
  },
];

export default function Testimonials() {
  return (
    <section id="stories" className="bg-slate-50 py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="mb-14 max-w-2xl">
            <span className="font-mono text-[11px] tracking-[0.35em] text-gold-600 uppercase">Stories</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-[42px] md:leading-[1.1]">
              Trusted on exam mornings
            </h2>
          </div>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-3">
          {STORIES.map((t, i) => (
            <Reveal key={t.name} delay={i * 150} direction="up">
              <figure
                className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div>
                  <Quote className="h-6 w-6 text-gold-600/40 transition-transform duration-300 hover:scale-110" />
                  <blockquote className="mt-4 text-[14px] leading-relaxed text-slate-700">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                </div>
                <figcaption className="mt-8 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-[12px] font-bold text-white transition-transform duration-300 hover:scale-110 hover:shadow-lg hover:shadow-purple-500/25">
                    {t.initials}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">{t.name}</p>
                    <p className="text-[11.5px] text-slate-400">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
