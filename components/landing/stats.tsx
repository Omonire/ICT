'use client';

import { useEffect, useRef, useState } from 'react';
import { Reveal } from '@/components/ui/reveal';

const STATS = [
  { value: '12,480+', label: 'candidates seated per cycle', target: 12480 },
  { value: '<4.2s', label: 'to generate a full schedule', target: 4 },
  { value: '0', label: 'seat conflicts permitted', target: 0 },
  { value: '1', label: 'click to print attendance', target: 1 },
];

function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1500;
          const start = performance.now();

          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="font-mono text-[clamp(1.9rem,4vw,3rem)] font-bold tracking-tight text-slate-900">
      <span className="text-gold-600">{prefix}{count.toLocaleString()}{suffix}</span>
    </span>
  );
}

export default function Stats() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 px-6 md:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 100} direction="up">
            <div className="relative text-center">
              <AnimatedCounter target={s.target} suffix={s.value.includes('+') ? '+' : ''} prefix={s.value.includes('<') ? '<' : ''} />
              <p className="mt-2 text-[12px] font-medium tracking-wide text-slate-400">{s.label}</p>
              {i < 3 && (
                <span className="absolute right-[-10px] top-1/2 hidden h-8 w-px -translate-y-1/2 bg-slate-100 md:block" />
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
